import fs from "node:fs";
const B = new Map(JSON.parse(fs.readFileSync("out/audit.json", "utf8")).audit.map((e) => [e.page, e]));
for (const vp of ["d1440", "m390"]) for (const d of B.get("chair-peer-review-manage").viewports[vp].styles.diffs.filter((d) => /form#2|\|settings|edit form/.test(d.element) && d.severity !== "low")) console.log(vp, d.element, d.property, d.prototype, "|", d.next);
