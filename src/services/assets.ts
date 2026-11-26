import { DATA_SOURCE } from "@/lib/config";

/** A picture in the conference's library for its certificates (logos, backgrounds, graphics). Shown with `assetImageUrl(id)`; a design refers to it as `asset:<id>`. */
export interface AssetRecord { id: string; name: string; contentType: string; sizeBytes: number; createdAt: string }

export const ASSET_MAX_BYTES = 2 * 1024 * 1024;
export const ASSET_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** The same checks the servers make, so a wrong file is refused before anything is sent. Returns a sentence, or "" when the file is fine. */
export function checkAssetFile(file: File): string {
  if (!ASSET_TYPES.includes(file.type)) return `“${file.name}” is not a PNG (transparent works), JPG or WebP picture.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  if (file.size > ASSET_MAX_BYTES) return `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB: please use one under 2 MB.`;
  return "";
}

export interface AssetService {
  list(conferenceDbId: string): Promise<AssetRecord[]>;
  create(conferenceDbId: string, input: { file: File; name?: string }): Promise<AssetRecord>;
  rename(id: string, name: string): Promise<AssetRecord>;
  /** Replaces the picture itself, keeping the asset (so every design that uses it shows the new one). */
  replaceImage(id: string, file: File): Promise<AssetRecord>;
  /** Refused while a design still uses the picture (the message says which). */
  /** Refused while a design still uses the picture, unless `removeFromDesigns`: then it is taken off those designs first. */
  remove(id: string, opts?: { removeFromDesigns?: boolean }): Promise<void>;
}

/** The picture library: the own backend in `api` mode, Supabase (migration 0049) by default, memory in `mock` mode. */
export async function getAssetService(): Promise<AssetService> {
  if (DATA_SOURCE === "mock") return (await import("@/mocks/assets")).mockAssetService;
  if (DATA_SOURCE === "api") return (await import("./api/assets")).apiAssetService;
  return (await import("./supabase/assets")).supabaseAssetService;
}
