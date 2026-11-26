import { designWithoutReference, registerMockSignature, signatureIdsIn } from "@/features/certificates/studio/images";
import type { SignatureRecord, SignatureService } from "@/services/signatures";
import { mockCertificateService } from "./certificates";

/* NEXT_PUBLIC_DATA_SOURCE=mock only (UI work: no network, no accounts). The pictures stay in memory (object URLs) for the page's lifetime, like the
   mock designs. It makes the same refusals the real services make. */

interface Stored extends SignatureRecord { conferenceId: string }
const store: Stored[] = [];
let n = 0;
const uuid = () => `11111111-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const pub = ({ conferenceId: _c, ...rest }: Stored): SignatureRecord => { void _c; return rest; };
const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX = 1024 * 1024;

function check(file: File) {
  if (!TYPES.includes(file.type)) throw new Error("Signatures must be a PNG (transparent works best), JPG or WebP image.");
  if (file.size > MAX) throw new Error("That image is larger than 1 MB. Please use a smaller one.");
}

export const mockSignatureService: SignatureService = {
  async list(conferenceDbId) { return store.filter((s) => s.conferenceId === conferenceDbId).map(pub); },
  async create(conferenceDbId, { file, name, designation, institution }) {
    check(file);
    const first = !store.some((s) => s.conferenceId === conferenceDbId);
    const s: Stored = { id: uuid(), conferenceId: conferenceDbId, name: name.trim(), designation: designation.trim(), institution: institution.trim(), contentType: file.type, sizeBytes: file.size, isDefault: first, createdAt: new Date().toISOString() };
    registerMockSignature(s.id, URL.createObjectURL(file));
    store.push(s);
    return pub(s);
  },
  async update(id, patch) {
    const s = store.find((x) => x.id === id);
    if (!s) throw new Error("That signature was not found.");
    if (patch.name !== undefined) s.name = patch.name.trim();
    if (patch.designation !== undefined) s.designation = patch.designation.trim();
    if (patch.institution !== undefined) s.institution = patch.institution.trim();
    if (patch.isDefault === true) store.filter((x) => x.conferenceId === s.conferenceId).forEach((x) => { x.isDefault = x.id === id; });
    return pub(s);
  },
  async replaceImage(id, file) {
    check(file);
    const s = store.find((x) => x.id === id);
    if (!s) throw new Error("That signature was not found.");
    registerMockSignature(id, URL.createObjectURL(file));
    s.contentType = file.type; s.sizeBytes = file.size;
    return pub(s);
  },
  async remove(id, opts) {
    const s = store.find((x) => x.id === id);
    if (!s) return;
    const { designs } = await mockCertificateService.load(s.conferenceId);
    const using = designs.filter((d) => signatureIdsIn(d.design).includes(id));
    if (using.length && opts?.removeFromDesigns) { for (const d of using) await mockCertificateService.saveDesign(d.id, { design: designWithoutReference(d.design, `sig:${id}`, true) }); }
    else if (using.length) throw new Error(`This signature is used in ${using.length === 1 ? "the certificate" : "the certificates"} “${using.slice(0, 3).map((d) => d.name).join("”, “")}”. Remove it from there first.`);
    store.splice(store.indexOf(s), 1);
  },
};
