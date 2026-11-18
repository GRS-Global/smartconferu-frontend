import { DATA_SOURCE } from "@/lib/config";
import type { ConferenceRequest, NewConferenceInput } from "@/types/conference-request";

/** Asking for a new conference (it waits for the Super Admin) and the list of what the user asked for. Failures throw like the other services. */
export interface ConferenceRequestService {
  list(): Promise<ConferenceRequest[]>;
  create(form: NewConferenceInput): Promise<{ id: string; slug: string }>;
}

export async function getConferenceRequestService(): Promise<ConferenceRequestService> {
  if (DATA_SOURCE === "mock") return (await import("@/mocks/conference-requests")).mockConferenceRequestService;
  if (DATA_SOURCE === "api") return (await import("./api/conference-requests")).apiConferenceRequestService;
  return (await import("./supabase/conference-requests")).supabaseConferenceRequestService;
}
