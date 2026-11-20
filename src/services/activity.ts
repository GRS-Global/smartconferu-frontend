import { DATA_SOURCE } from "@/lib/config";
import { api } from "@/lib/api-client";
import { getSupabase } from "@/lib/supabase";
import type { ChairActivityLog } from "@/types/chair";
import { AuthRequiredError, ServiceError } from "./errors";

/** A person's own Activity Log for one conference. An author: what they did and what the chair did to their papers, in the Submissions module only (the
 *  database view `my_activity_log`, migration 0040). A reviewer: the entries of their own reviewer role — their reviews and the chair assigning or removing
 *  them (`my_reviewer_activity_log`, migration 0041). Until the migration is run there is simply nothing to show. */
export async function loadMyActivityLogs(conferenceSlug: string, role: "author" | "reviewer" = "author"): Promise<ChairActivityLog[]> {
  if (DATA_SOURCE === "mock") {
    // Mock mode: the sample log, narrowed the way the view narrows it.
    const { getChairService } = await import("./chair");
    return (await (await getChairService()).loadActivityLogs(conferenceSlug)).filter((l) => (role === "author" ? l.module === "Submissions" : l.module === "Peer Review")).map(({ reviewerName, ...rest }) => { void reviewerName; return rest; });
  }
  if (DATA_SOURCE === "api") {
    // Own backend: GET /conferences/:id/my-activity answers with this person's own entries (Backend/src/modules/conferences/my-activity.service.ts).
    const rows = await api<Array<{ id: string; at: string; actorName: string; actorRole: ChairActivityLog["actorRole"]; action: string; module: string; description: string; status: "success" | "failed"; previousValue: string | null; newValue: string | null }>>(`/conferences/${encodeURIComponent(conferenceSlug)}/my-activity`, { query: { role, limit: 500 } });
    return rows.map((l) => ({ id: l.id, datetime: l.at, actorName: l.actorName, actorRole: l.actorRole, action: l.action, module: l.module, description: l.description, status: l.status, ...(l.previousValue ? { previousValue: l.previousValue } : {}), ...(l.newValue ? { newValue: l.newValue } : {}) } satisfies ChairActivityLog));
  }
  const db = getSupabase();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new AuthRequiredError();
  const conf = await db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1);
  if (conf.error) throw new ServiceError("We couldn't read this conference.");
  const id = (conf.data?.[0] as { id: string } | undefined)?.id;
  if (!id) return [];
  const { data, error } = await db.from(role === "author" ? "my_activity_log" : "my_reviewer_activity_log").select("id, created_at, actor_name, actor_role, action, module, description, status, previous_value, new_value").eq("conference_id", id).order("created_at", { ascending: false }).limit(1000);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message ?? "")) return [];
    throw new ServiceError("We couldn't read your activity log.");
  }
  return ((data ?? []) as Array<{ id: string; created_at: string; actor_name: string; actor_role: string; action: string; module: string; description: string; status: string; previous_value: string | null; new_value: string | null }>).map((l) => ({
    id: l.id, datetime: l.created_at, actorName: l.actor_name, actorRole: (["chair", "author", "reviewer"].includes(l.actor_role) ? l.actor_role : "system") as ChairActivityLog["actorRole"],
    action: l.action, module: l.module, description: l.description, status: l.status === "failed" ? "failed" : "success",
    ...(l.previous_value ? { previousValue: l.previous_value } : {}), ...(l.new_value ? { newValue: l.new_value } : {}),
  } satisfies ChairActivityLog));
}
