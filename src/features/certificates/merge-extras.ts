import { CERTIFICATE_TYPES, type CertTypeKey, type Design, type MergeExtras } from "./data";
import { signatoriesOf, studioFromDesign } from "./studio/model";

/** The certificate type of a design: the one it carries, else the one its type line names ("OF PARTICIPATION"), for designs made before it was stored. */
export function typeKeyOf(design: Pick<Design, "typeKey" | "typeLine">): CertTypeKey | undefined {
  if (design.typeKey) return design.typeKey;
  const line = (design.typeLine || "").trim().toUpperCase();
  return CERTIFICATE_TYPES.find((t) => t.line === line)?.key;
}

/** What the merge fields need from the design itself: its certificate type and the first signature block on it. */
export function extrasOf(design: Design): MergeExtras {
  const doc = design.studio ?? studioFromDesign(design);
  const first = signatoriesOf(doc)[0] ?? design.signatories?.[0];
  return { typeKey: typeKeyOf(design), signatory: first ? { name: first.name, title: first.title } : undefined };
}
