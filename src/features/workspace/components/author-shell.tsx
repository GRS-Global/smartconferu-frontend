"use client";

import type { ReactNode } from "react";
import type { Conference, ConferenceRole } from "@/types/conference";
import { ConferenceShell, ConferenceMonogram } from "./conference-shell";

export { ConferenceMonogram };

/** The Author workspace's frame: the shared conference shell with the author's menu. `active` is the menu item that is lit
 *  ("overview", "submissions", …), or null on a page the menu has no item for (a paper). */
export function AuthorShell({ conference, roles, others, active, children }: { conference: Conference; roles: ConferenceRole[]; others: Conference[]; active: string | null; children: ReactNode }) {
  return <ConferenceShell role="author" conference={conference} roles={roles} others={others} active={active}>{children}</ConferenceShell>;
}
