import { DATA_SOURCE } from "@/lib/config";

/** A signatory in the conference's signature library. The picture is read with `signatureImageUrl(id)` (features/certificates/studio/images.ts). */
export interface SignatureRecord { id: string; name: string; designation: string; institution: string; contentType: string; sizeBytes: number; isDefault: boolean; createdAt: string }

export interface SignatureService {
  list(conferenceDbId: string): Promise<SignatureRecord[]>;
  /** PNG (transparent works), JPG or WebP, up to 1 MB. The first signature of a conference becomes its default. */
  create(conferenceDbId: string, input: { file: File; name: string; designation: string; institution: string }): Promise<SignatureRecord>;
  update(id: string, patch: { name?: string; designation?: string; institution?: string; isDefault?: boolean }): Promise<SignatureRecord>;
  replaceImage(id: string, file: File): Promise<SignatureRecord>;
  /** Refused while a certificate design still uses the signature (the message says which), unless `removeFromDesigns`: then its blocks are taken off those designs first. */
  remove(id: string, opts?: { removeFromDesigns?: boolean }): Promise<void>;
}

/** The signature library: the own backend in `api` mode, Supabase (migration 0048) in the default mode, memory in `mock` mode. */
export async function getSignatureService(): Promise<SignatureService | null> {
  if (DATA_SOURCE === "mock") return (await import("@/mocks/signatures")).mockSignatureService;
  if (DATA_SOURCE === "api") return (await import("./api/signatures")).apiSignatureService;
  return (await import("./supabase/signatures")).supabaseSignatureService;
}
