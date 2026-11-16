import { getSupabase } from "@/lib/supabase";
import type { ConferenceRequest, NewConferenceInput } from "@/types/conference-request";
import type { ConferenceRequestService } from "../conference-requests";
import { currentUser, fail } from "./shared";

/* A new conference is one `conferences` row in status pending_approval (the default); `created_by` is the signed-in user (column default and insert
   policy). The Super Admin approves it with decide_conference_request. Mirrors data/workspace.js › createConference. */

const MODE = { "in-person": "in_person", virtual: "virtual", hybrid: "hybrid" } as const;
const slugOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 40);
const blank = (v: string) => (v.trim() === "" ? null : v.trim());
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

interface Row { id: string; slug: string; acronym: string; title: string; about: string | null; status: string; created_at: string; admin_note: string | null; mode: string | null; web_page: string | null; venue: string | null; city: string | null; country: string | null; start_date: string | null; end_date: string | null; primary_area: string | null; secondary_area: string | null; contact_email: string | null; details: { type?: string } | null }

export const supabaseConferenceRequestService: ConferenceRequestService = {
  async list() {
    const db = getSupabase();
    const me = await currentUser(db);
    const { data, error } = await db.from("conferences").select("id, slug, acronym, title, about, status, created_at, admin_note, mode, web_page, venue, city, country, start_date, end_date, primary_area, secondary_area, contact_email, details").eq("created_by", me.id).in("status", ["pending_approval", "rejected"]).order("created_at", { ascending: false });
    if (error) fail(error, "read your conference requests");
    return ((data ?? []) as Row[]).map((r): ConferenceRequest => ({
      id: r.id, slug: r.slug, acronym: r.acronym, title: r.title, status: r.status === "rejected" ? "rejected" : "pending", submittedAt: day(r.created_at), decidedNote: r.admin_note ?? "",
      type: r.details?.type ?? "conference", eventType: r.mode ?? "", webPage: r.web_page ?? "", venue: r.venue ?? "", city: r.city ?? "", country: r.country ?? "", startDate: day(r.start_date), endDate: day(r.end_date),
      primaryArea: r.primary_area ?? "", secondaryArea: r.secondary_area ?? "", contactEmail: r.contact_email ?? "", about: r.about ?? "",
    }));
  },
  async create(form: NewConferenceInput) {
    const db = getSupabase();
    await currentUser(db);
    const base = slugOf(form.acronym || form.title) || `conf${Date.now()}`;
    const row = {
      acronym: form.acronym.trim(), title: form.title.trim(), about: blank(form.about), mode: form.eventType ? MODE[form.eventType] : null, venue: blank(form.venue), city: blank(form.city), state: blank(form.state), country: blank(form.country),
      web_page: blank(form.webPage), contact_email: blank(form.contactEmail), primary_area: blank(form.primaryArea), secondary_area: blank(form.secondaryArea), start_date: blank(form.startDate), end_date: blank(form.endDate),
      details: { type: form.type, typeInfo: form.type === "other" ? form.typeInfo.trim() : undefined, timezone: blank(form.timezone) ?? undefined, address: blank(form.address) ?? undefined, postalCode: blank(form.postalCode) ?? undefined, eventType: form.eventType || undefined },
    };
    // A taken URL id gets a number on the end (icx2027 → icx2027-2) instead of failing.
    for (let n = 1; n <= 5; n += 1) {
      const slug = n === 1 ? base : `${base}-${n}`;
      const { data, error } = await db.from("conferences").insert({ ...row, slug }).select("id").single();
      if (!error) return { id: (data as { id: string }).id, slug };
      if (!/duplicate key.*slug/i.test(error.message)) fail(error, "create a conference");
    }
    throw new Error("That acronym is already taken by another conference — add the year or another word to it.");
  },
};
