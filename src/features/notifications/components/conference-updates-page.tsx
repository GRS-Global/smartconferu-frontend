"use client";

import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { useConferenceFrame } from "@/features/workspace/use-conference-frame";
import { NotificationsPage } from "./notifications-page";

/** Updates in a conference's Author or Reviewer menu (the prototype's NotificationsPage with a conference): the same inbox as the
 *  global Notifications page, narrowed to what this conference sent to this role, inside the conference frame. */
export function ConferenceUpdatesPage({ slug, role }: { slug: string; role: "author" | "reviewer" }) {
  const { state, retry } = useConferenceFrame(slug, role);
  const gate = workspaceGate(state, retry, { title: "Updates", loadingLabel: "Loading your updates", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you hold no such role in it. Pick one from My Conferences.", errorTitle: "Couldn't load your updates." });
  if (gate || state.status !== "ready") return gate;
  return (
    <ConferenceShell role={role} conference={state.conference} roles={state.roles} others={state.others} active="updates">
      <NotificationsPage scope={{ slug, role, acronym: state.conference.acronym }} />
    </ConferenceShell>
  );
}
