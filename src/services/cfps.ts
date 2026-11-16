import { DATA_SOURCE } from "@/lib/config";
import type { CfpDetail, CfpPermissions, CfpRow, PublicCfp } from "@/types/cfp";

/** The Calls for Papers of the signed-in user. A CFP is the conference's own `cfps` row (made with the conference), so every conference has
 *  one. Failures throw like the other services (AuthRequiredError, ServiceConfigError, ServiceError). */
export interface CfpService {
  /** One per conference the user chairs or manages the CFP of. */
  list(): Promise<CfpRow[]>;
  /** One conference's CFP (by the conference's slug); null when it is not theirs. */
  load(slug: string): Promise<CfpDetail | null>;
  /** The CFP at a page address (`/cfp/<page>`), null when no published or closed CFP is there. */
  loadPublic(page: string): Promise<PublicCfp | null>;
  /** Which of these CFP page addresses another CFP already uses (the conference's own is not counted). */
  takenPages(slug: string, pages: string[]): Promise<string[]>;
  /** Chooses the CFP page (once) and publishes the CFP: submissions open at once (`publish_cfp`). */
  publish(slug: string, page: string): Promise<void>;
  /** Closes a published CFP: it stops taking papers (`close_cfp`); the papers already sent stay. */
  close(slug: string): Promise<void>;
  /** Saves the CFP page's text (HTML). */
  saveContent(slug: string, html: string): Promise<void>;
  /** Saves the theme (one of themes.ts). */
  saveTheme(slug: string, themeId: string): Promise<void>;
  /** Adds a CFP manager (they are invited; the email goes out separately: `cfp_manager_invited`). Returns the new member's id. */
  addManager(slug: string, who: { firstName: string; lastName: string; email: string; permissions: CfpPermissions }): Promise<string>;
  /** Saves the manager list as edited: names and permissions of those kept, and takes the removed ones off the CFP. */
  saveManagers(kept: Array<{ id: string; name: string; permissions: CfpPermissions }>, removed: string[]): Promise<void>;
  /** "Closing" a CFP that was never published: its content and theme are cleared and it starts again as an empty draft. */
  discardDraft(slug: string): Promise<void>;
}

export async function getCfpService(): Promise<CfpService> {
  if (DATA_SOURCE === "mock") return (await import("@/mocks/cfps")).mockCfpService;
  return (await import("./supabase/cfps")).supabaseCfpService;
}
