import { API_URL, DATA_SOURCE, SUPABASE_URL } from "@/lib/config";

/* Pictures on a certificate are referred to by id and drawn from storage:
     sig:<id>    a signature of the conference's signature library
     asset:<id>  a picture of its picture library (logos, backgrounds, graphics)
   Both are readable without sign-in by their (random) id, because they are printed on every certificate that uses them: by the own backend
   (`api` mode), from a public Supabase bucket (object name = the id), or from memory (`mock` mode, UI work only). Anything else in an image's `src`
   (a conference logo's address, the platform mark, an old data URL) is used as it is. */

const mockPictures = new Map<string, string>();
/** Mock mode only: where the picture an in-memory asset was made from can be shown (an object URL). */
export const registerMockAsset = (id: string, url: string) => { mockPictures.set(id, url); };
const mockSignaturePictures = new Map<string, string>();
/** Mock mode only: where the picture an in-memory signature was made from can be shown. */
export const registerMockSignature = (id: string, url: string) => { mockSignaturePictures.set(id, url); };

export const signatureImageUrl = (id: string): string =>
  DATA_SOURCE === "api" ? `${API_URL}/api/v1/certificates/signature-image/${id}`
    : DATA_SOURCE === "mock" ? mockSignaturePictures.get(id) ?? ""
      : `${SUPABASE_URL}/storage/v1/object/public/certificate-signatures/${id}`;

export const assetImageUrl = (id: string): string =>
  DATA_SOURCE === "api" ? `${API_URL}/api/v1/certificates/asset-image/${id}`
    : DATA_SOURCE === "mock" ? mockPictures.get(id) ?? ""
      : `${SUPABASE_URL}/storage/v1/object/public/certificate-assets/${id}`;

/** An image element's `src` as something an <img> can load. */
export function resolveImageSrc(src: string | undefined): string | undefined {
  if (src?.startsWith("sig:")) return signatureImageUrl(src.slice(4));
  if (src?.startsWith("asset:")) return assetImageUrl(src.slice(6));
  return src;
}

const idsIn = (design: unknown, prefix: "sig" | "asset"): string[] =>
  [...new Set([...JSON.stringify(design ?? {}).matchAll(new RegExp(`${prefix}:([0-9a-f-]{36})`, "gi"))].map((m) => m[1].toLowerCase()))];
/** The library signatures a design uses. */
export const signatureIdsIn = (design: unknown): string[] => idsIn(design, "sig");
/** The library pictures a design uses. */
export const assetIdsIn = (design: unknown): string[] => idsIn(design, "asset");

/**
 * The design without every use of a library picture or signature (`ref` is `sig:<id>` or `asset:<id>`): the studio elements that show it go
 * (with `wholeGroup`, the rest of their group too: a signature is one group of picture, line and wording) and any other place that names it
 * (a page background) is cleared. Same rule as the backend (certificate-rules.ts, withoutReference).
 */
export function designWithoutReference<T>(design: T, ref: string, wholeGroup: boolean): T {
  const key = ref.toLowerCase();
  const hit = (v: unknown) => typeof v === "string" && v.toLowerCase().includes(key);
  const clean = (v: unknown): unknown => (hit(v) ? "" : Array.isArray(v) ? v.map(clean) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)])) : v);
  let next: unknown = design;
  const studio = (design as { studio?: { elements?: Array<Record<string, unknown>> } } | null)?.studio;
  if (studio && Array.isArray(studio.elements)) {
    const gone = studio.elements.filter((e) => hit(e.src));
    const ids = new Set(gone.map((e) => e.id));
    const groups = new Set(wholeGroup ? gone.map((e) => e.groupId).filter(Boolean) : []);
    next = { ...(design as object), studio: { ...studio, elements: studio.elements.filter((e) => !ids.has(e.id) && !(e.groupId && groups.has(e.groupId))) } };
  }
  return clean(next) as T;
}

/** The message a service gives when a signature / picture is still on a certificate. */
export const isInUseError = (e: unknown): e is Error => e instanceof Error && /Remove it from there first\./.test(e.message);
