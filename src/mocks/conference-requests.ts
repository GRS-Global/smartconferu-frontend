import type { ConferenceRequest } from "@/types/conference-request";
import type { ConferenceRequestService } from "../services/conference-requests";

/* Mock mode (NEXT_PUBLIC_DATA_SOURCE=mock) only: requests live in memory for the page's life. */
const rows: ConferenceRequest[] = process.env.NEXT_PUBLIC_MOCK_FIXTURES === "parity"
  ? [{ id: "1", slug: "mirc2027", acronym: "MIRC 2027", title: "Manila International Research Conference 2026", status: "pending", submittedAt: "2026-10-19", decidedNote: "", type: "conference", eventType: "in_person", webPage: "https://mirc.example.org", venue: "", city: "Manila", country: "Philippines", startDate: "2027-03-10", endDate: "2027-03-12", primaryArea: "Computer Science & AI", secondaryArea: "", contactEmail: "info@mirc.example.org", about: "" }]
  : [];

export const mockConferenceRequestService: ConferenceRequestService = {
  async cancel(id) { const i = rows.findIndex((r) => r.id === id); if (i >= 0) rows.splice(i, 1); },
  async list() { return [...rows]; },
  async create(form) {
    const slug = (form.acronym || form.title).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 40) || "conf";
    rows.unshift({ id: `mock-${rows.length + 1}`, slug, acronym: form.acronym, title: form.title, status: "pending", submittedAt: new Date().toISOString().slice(0, 10), decidedNote: "", type: form.type, eventType: form.eventType, webPage: form.webPage, venue: form.venue, city: form.city, country: form.country, startDate: form.startDate, endDate: form.endDate, primaryArea: form.primaryArea, secondaryArea: form.secondaryArea, contactEmail: form.contactEmail, about: form.about });
    return { id: `mock-${rows.length}`, slug };
  },
};
