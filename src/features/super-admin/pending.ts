/* Everything waiting for a Super Admin's decision, across the live queues, oldest first (the
   prototype's pendingAll). Used by the sidebar counts, the bell, the review-promise strip, Ctrl K
   and the dashboard. */
import { CalendarPlus, FileCheck2, Hourglass, Trash2 } from "lucide-react";
import { loadCfps, loadConferences, loadDeletionRequests, loadLicenseRequests, type AdminConference, type DeletionRequest, type LicenseRequest } from "./services";
import { daysSince, SLA_DAYS, type Icon } from "./components/ui";

export type QueueKey = "requests" | "deletions" | "licenses" | "cfps";
export const QUEUE_KEYS: QueueKey[] = ["requests", "deletions", "licenses", "cfps"];

export const QUEUE_INFO: Record<QueueKey, { label: string; icon: Icon; href: string; noun: string }> = {
  requests: { label: "Conference Requests", icon: CalendarPlus, href: "/super-admin/conference-requests", noun: "request" },
  deletions: { label: "Deletion Requests", icon: Trash2, href: "/super-admin/deletion-requests", noun: "request" },
  licenses: { label: "License Extensions", icon: Hourglass, href: "/super-admin/license-requests", noun: "request" },
  cfps: { label: "CFP Page Review", icon: FileCheck2, href: "/super-admin/cfp-review", noun: "page" },
};

export interface PendingItem {
  queue: QueueKey;
  id: string;
  /** The conference acronym (what the bell and the lists show first). */
  acronym: string;
  title: string;
  person: string;
  since: string;
  /** Where the decision is made. */
  href: string;
}

export const isLate = (p: { since: string }) => daysSince(p.since) > SLA_DAYS;

export function pendingFrom(requests: AdminConference[], deletions: DeletionRequest[], licenses: LicenseRequest[] = [], cfps: AdminConference[] = []): PendingItem[] {
  return [
    ...requests
      .filter((c) => c.status === "pending_approval")
      .map((c) => ({
        queue: "requests" as const,
        id: c.id,
        acronym: c.acronym,
        title: c.title,
        person: c.requester?.name ?? "—",
        since: c.createdAt ?? new Date().toISOString(),
        href: `/super-admin/conference-requests?open=${c.id}`,
      })),
    ...deletions
      .filter((d) => d.status === "pending")
      .map((d) => ({
        queue: "deletions" as const,
        id: d.id,
        acronym: d.acronym,
        title: d.title,
        person: d.requestedBy.name,
        since: d.createdAt,
        href: `/super-admin/conferences/${d.conferenceId}`,
      })),
    ...licenses
      .filter((l) => l.status === "pending")
      .map((l) => ({
        queue: "licenses" as const,
        id: l.id,
        acronym: l.conferenceAcronym,
        title: l.conferenceTitle,
        person: l.requestedByName,
        since: l.createdAt,
        href: `/super-admin/license-requests?open=${l.id}`,
      })),
    ...cfps.map((c) => ({
      queue: "cfps" as const,
      id: c.id,
      acronym: c.acronym,
      title: c.title,
      person: c.requester?.name ?? "—",
      since: c.createdAt ?? new Date().toISOString(),
      href: `/super-admin/cfp-review?open=${c.id}`,
    })),
  ].sort((a, b) => a.since.localeCompare(b.since));
}

export async function loadPending(): Promise<PendingItem[]> {
  const [requests, deletions, licenses, cfps] = await Promise.all([loadConferences("pending_approval"), loadDeletionRequests("pending"), loadLicenseRequests("pending").catch(() => []), loadCfps("in_review").catch(() => [])]);
  return pendingFrom(requests, deletions, licenses, cfps);
}
