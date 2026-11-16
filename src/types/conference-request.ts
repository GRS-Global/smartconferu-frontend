/** What "Create New Conference" asks (the prototype's CREATE_CONFERENCE_INITIAL_FORM, minus the map position). */
export interface NewConferenceInput {
  type: string; typeInfo: string; title: string; acronym: string; eventType: "in-person" | "virtual" | "hybrid" | ""; webPage: string;
  venue: string; address: string; city: string; state: string; postalCode: string; country: string;
  startDate: string; endDate: string; timezone: string; about: string; primaryArea: string; secondaryArea: string; contactEmail: string;
}
export const EMPTY_NEW_CONFERENCE: NewConferenceInput = {
  type: "conference", typeInfo: "", title: "", acronym: "", eventType: "", webPage: "", venue: "", address: "", city: "", state: "", postalCode: "", country: "",
  startDate: "", endDate: "", timezone: "", about: "", primaryArea: "", secondaryArea: "", contactEmail: "",
};

export type RequestStatus = "pending" | "rejected";
/** One conference the signed-in user asked for that the Super Admin has not approved (or has declined). */
export interface ConferenceRequest {
  id: string; slug: string; acronym: string; title: string; status: RequestStatus; submittedAt: string; decidedNote: string;
  type: string; eventType: string; webPage: string; venue: string; city: string; country: string; startDate: string; endDate: string; primaryArea: string; secondaryArea: string; contactEmail: string; about: string;
}
