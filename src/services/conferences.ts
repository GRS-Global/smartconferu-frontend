import { DATA_SOURCE } from "@/lib/config";
import type { DashboardSource, ReviewInvitation } from "@/types/conference";

export interface DashboardData {
  source: DashboardSource;
  invitations: ReviewInvitation[];
}

/** The contract the UI depends on. Failures throw: AuthRequiredError (no session), ServiceConfigError
 *  (Supabase not configured) or ServiceError (a request failed, with a message ready to show). */
export interface ConferenceService {
  loadDashboard(): Promise<DashboardData>;
  respondToInvitation(invitationId: string, accept: boolean, reason?: string): Promise<void>;
}

/** The service for the configured data source. `mock` is only used when NEXT_PUBLIC_DATA_SOURCE=mock;
 *  there is no fallback from one source to the other. */
export async function getConferenceService(): Promise<ConferenceService> {
  if (DATA_SOURCE === "mock") return (await import("@/mocks/conferences")).mockConferenceService;
  if (DATA_SOURCE === "api") return (await import("./api/conferences")).apiConferenceService;
  return (await import("./supabase/conferences")).supabaseConferenceService;
}
