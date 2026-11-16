import fs from "node:fs";
const L = (f) => new Map(JSON.parse(fs.readFileSync(`out/${f}`, "utf8")).audit.map((e) => [e.page, e]));
const A = L("audit-before-s3.json"), B = L("audit.json");
const k = (d) => `${d.element}|${d.property}`;
for (const id of ["chair-peer-review-manage", "chair-reviewers", "chair-peer-review"]) for (const vp of ["d1440", "m390"]) {
  const x = A.get(id)?.viewports?.[vp]?.styles?.diffs ?? [], y = B.get(id)?.viewports?.[vp]?.styles?.diffs ?? [];
  const sx = new Set(x.filter((d) => d.severity !== "low").map(k));
  for (const d of y.filter((d) => d.severity !== "low" && !sx.has(k(d)))) console.log(id, vp, d.element.slice(0, 50), d.property, "proto:", d.proto ?? d.a, "next:", d.next ?? d.b, d.severity);
}
