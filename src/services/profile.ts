import { DATA_SOURCE } from "@/lib/config";
import type { Profile, ProfilePatch, ProfileVerification } from "@/types/profile";
// The own backend is the data source: loaded with the page, not as a separate request when first used (it sits on every page's first data read).
import { apiProfileService } from "./api/profile";

/** The contract the profile screens depend on. Failures throw AuthRequiredError (no session),
 *  ServiceConfigError (Supabase not configured) or ServiceError (a request failed, message ready to show). */
export interface ProfileService {
  /** Loads the signed-in user's profile. First applies sign-up details left by registration (see applySignupDetails). */
  load(): Promise<Profile>;
  /** Saves part of the profile and resolves to the stored result. */
  save(patch: ProfilePatch): Promise<Profile>;
  /** Another person’s profile by its public address (/author/<slug>), only when they switched “Public profile” on; null otherwise (and until migration 0027_public_profile.sql is run). Their e-mail addresses, phone and postal address are never part of it. */
  loadPublic(slug: string): Promise<Profile | null>;
  /** Uploads a (cropped) photo and resolves to its storage path, which is then saved with `save({ photoPath })`. */
  uploadPhoto(photo: Blob): Promise<string>;
  /** Own backend only: emails the verification link for a saved personal / professional address again. */
  /** Own backend only: asks the Super Admin to verify the whole profile (the green tick). */
  requestVerification?(note: string): Promise<ProfileVerification>;
  /** Own backend only: takes back a waiting verification request. */
  withdrawVerification?(): Promise<ProfileVerification>;
  resendEmailVerification?(slot: "personal" | "professional"): Promise<void>;
}

/** There is no profile service in mock mode (mock has no accounts and never reaches Supabase). */
export async function getProfileService(): Promise<ProfileService> {
  if (DATA_SOURCE === "mock") throw new Error("Profiles are not available in mock data mode.");
  if (DATA_SOURCE === "api") return apiProfileService;
  return (await import("./supabase/profile")).supabaseProfileService;
}
