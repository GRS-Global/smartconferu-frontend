import { roleLanding } from "@/features/workspace/menus";
import type { ConferenceRole } from "@/types/conference";

/** The page a role lands on in a conference. */
export function conferenceWorkspaceHref(conferenceId: string, role: ConferenceRole): string {
  return roleLanding(conferenceId, role).href;
}
