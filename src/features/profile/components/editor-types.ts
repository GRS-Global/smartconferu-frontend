import type { Profile, ProfilePatch } from "@/types/profile";

/** What every My Profile editor (shown in a dialog) is given. `onDone` closes the dialog and may carry the toast text. */
export interface EditorProps {
  profile: Profile;
  save: (patch: ProfilePatch) => Promise<Profile>;
  onDone: (message?: string) => void;
  onCancel: () => void;
}
