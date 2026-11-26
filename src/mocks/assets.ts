import { designWithoutReference, assetIdsIn, registerMockAsset } from "@/features/certificates/studio/images";
import { ASSET_MAX_BYTES, ASSET_TYPES, type AssetRecord, type AssetService } from "@/services/assets";
import { mockCertificateService } from "./certificates";

/* NEXT_PUBLIC_DATA_SOURCE=mock only (UI work: no network, no accounts). The pictures stay in memory (object URLs) for the page's lifetime, like the
   mock designs; nothing is stored anywhere. It makes the same refusals the real services make. */

interface Stored extends AssetRecord { conferenceId: string }
const store: Stored[] = [];
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const cleanName = (s: string) => s.replace(/\.[A-Za-z0-9]{2,5}$/, "").replace(/\s+/g, " ").trim().slice(0, 120);
const pub = ({ conferenceId: _c, ...rest }: Stored): AssetRecord => { void _c; return rest; };

function check(file: File) {
  if (!ASSET_TYPES.includes(file.type)) throw new Error("Pictures must be PNG (transparent works), JPG or WebP.");
  if (file.size > ASSET_MAX_BYTES) throw new Error("That picture is larger than 2 MB. Please use a smaller one.");
}

export const mockAssetService: AssetService = {
  async list(conferenceDbId) { return store.filter((a) => a.conferenceId === conferenceDbId).map(pub); },
  async create(conferenceDbId, { file, name }) {
    check(file);
    if (store.filter((a) => a.conferenceId === conferenceDbId).length >= 200) throw new Error("This conference already has 200 pictures. Delete some you no longer use first.");
    const a: Stored = { id: uuid(), conferenceId: conferenceDbId, name: cleanName(name ?? "") || cleanName(file.name) || "Picture", contentType: file.type, sizeBytes: file.size, createdAt: new Date().toISOString() };
    registerMockAsset(a.id, URL.createObjectURL(file));
    store.push(a);
    return pub(a);
  },
  async rename(id, name) {
    const a = store.find((x) => x.id === id);
    if (!a) throw new Error("That picture was not found.");
    a.name = cleanName(name) || "Picture";
    return pub(a);
  },
  async replaceImage(id, file) {
    check(file);
    const a = store.find((x) => x.id === id);
    if (!a) throw new Error("That picture was not found.");
    registerMockAsset(id, URL.createObjectURL(file));
    a.contentType = file.type; a.sizeBytes = file.size;
    return pub(a);
  },
  async remove(id, opts) {
    const a = store.find((x) => x.id === id);
    if (!a) return;
    const { designs } = await mockCertificateService.load(a.conferenceId);
    const using = designs.filter((d) => assetIdsIn(d.design).includes(id));
    if (using.length && opts?.removeFromDesigns) { for (const d of using) await mockCertificateService.saveDesign(d.id, { design: designWithoutReference(d.design, `asset:${id}`, false) }); }
    else if (using.length) throw new Error(`This picture is used in ${using.length === 1 ? "the certificate" : "the certificates"} “${using.slice(0, 3).map((d) => d.name).join("”, “")}”. Remove it from there first.`);
    store.splice(store.indexOf(a), 1);
  },
};
