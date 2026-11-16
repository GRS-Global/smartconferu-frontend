import { DATA_SOURCE } from "@/lib/config";
import type { FlyerDesign, SavedFlyer } from "@/features/flyer/data";

/** The speaker flyer template of a conference (`conference_flyers`, migration 0048). Failures throw like the other services (AuthRequiredError,
 *  ServiceConfigError, ServiceError with a message ready to show). */
export interface FlyerService {
  /** The saved flyer of a conference (by its database id); null when the chair has not saved one yet. */
  load(conferenceDbId: string): Promise<SavedFlyer | null>;
  /** Saves the design and whether authors can see it (the download counter is kept). Returns what is now stored. */
  save(conferenceDbId: string, design: FlyerDesign, published: boolean): Promise<SavedFlyer>;
  /** The published flyer template of a conference (by its slug) for someone who has a paper there (`my_published_flyer`, migration 0049); null when
   *  nothing is published (or until the migration is run). */
  loadPublished(conferenceSlug: string): Promise<FlyerDesign | null>;
  /** One more download of the flyer, for the chair's count (`count_flyer_download`). Never throws. */
  countDownload(conferenceSlug: string): Promise<void>;
}

/** The service for the configured data source (no fallback from one to the other). */
export async function getFlyerService(): Promise<FlyerService> {
  if (DATA_SOURCE === "mock") return (await import("@/mocks/flyers")).mockFlyerService;
  return (await import("./supabase/flyers")).supabaseFlyerService;
}
