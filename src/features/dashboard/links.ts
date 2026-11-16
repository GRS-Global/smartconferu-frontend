import { PROTOTYPE_URL } from "@/lib/config";
import type { ConferenceRole } from "@/types/conference";

/** The author workspace is a page of this app; the other roles' workspaces are not ported yet and open in the prototype. */
export function conferenceWorkspaceHref(conferenceId: string, role: ConferenceRole): string {
  return `${PROTOTYPE_URL}/prototype/conference/${encodeURIComponent(conferenceId)}/${role}`;
}
