import { api } from "@/lib/api-client";
import { requestStatusOf, type ConferenceRequest, type NewConferenceInput } from "@/types/conference-request";
import type { ConferenceRequestService } from "../conference-requests";

/* "Create New Conference" and the list of requests through the own backend: `POST /conferences` (the request waits for a Super Admin) and
   `GET /conferences` (its `requests` lists what the person asked for that is pending or declined). The backend makes the URL id (slug)
   from the acronym and keeps it unique, so no retry loop is needed here. Backend/src/modules/conferences. */

const MODE = { "in-person": "in_person", virtual: "virtual", hybrid: "hybrid" } as const;
const blank = (v: string) => (v.trim() === "" ? null : v.trim());
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

interface ConferenceResponse {
  id: string; slug: string; acronym: string; title: string; about: string | null; mode: string | null; venue: string | null; city: string | null; country: string | null;
  webPage: string | null; contactEmail: string | null; primaryArea: string | null; secondaryArea: string | null; startDate: string | null; endDate: string | null;
  status: string; adminNote: string | null; createdAt: string; details: { type?: string } | null;
}

export const apiConferenceRequestService: ConferenceRequestService = {
  async list() {
    const { requests } = await api<{ requests: ConferenceResponse[] }>("/conferences");
    return requests.map((r): ConferenceRequest => ({
      id: r.id, slug: r.slug, acronym: r.acronym, title: r.title, status: requestStatusOf(r.status), submittedAt: day(r.createdAt), decidedNote: r.adminNote ?? "",
      type: r.details?.type ?? "conference", eventType: r.mode ?? "", webPage: r.webPage ?? "", venue: r.venue ?? "", city: r.city ?? "", country: r.country ?? "", startDate: day(r.startDate), endDate: day(r.endDate),
      primaryArea: r.primaryArea ?? "", secondaryArea: r.secondaryArea ?? "", contactEmail: r.contactEmail ?? "", about: r.about ?? "",
    }));
  },

  async create(form: NewConferenceInput) {
    const created = await api<{ id: string; slug: string }>("/conferences", {
      method: "POST",
      body: {
        acronym: form.acronym.trim(), title: form.title.trim(), about: blank(form.about), mode: form.eventType ? MODE[form.eventType] : null,
        venue: blank(form.venue), city: blank(form.city), state: blank(form.state), country: blank(form.country), webPage: blank(form.webPage), contactEmail: blank(form.contactEmail),
        primaryArea: blank(form.primaryArea), secondaryArea: blank(form.secondaryArea), startDate: blank(form.startDate), endDate: blank(form.endDate),
        // What the backend has no column for travels in `details`, as the Supabase version kept it.
        details: { type: form.type, typeInfo: form.type === "other" ? form.typeInfo.trim() : undefined, timezone: blank(form.timezone) ?? undefined, address: blank(form.address) ?? undefined, postalCode: blank(form.postalCode) ?? undefined, eventType: form.eventType || undefined },
      },
    });
    return { id: created.id, slug: created.slug };
  },

  async cancel(id: string, reason?: string) {
    await api<void>(`/conferences/${id}/cancel-request`, { method: "POST", body: { reason: reason?.trim() || undefined } });
  },
};
