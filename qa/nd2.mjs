import fs from "node:fs";
const B = new Map(JSON.parse(fs.readFileSync("out/audit.json", "utf8")).audit.map((e) => [e.page, e]));
const ds = B.get("chair-peer-review-manage").viewports.d1440.styles.diffs;
console.log(JSON.stringify(ds.filter((d) => /edit form|write your review of/.test(d.element)), null, 1).slice(0, 900));
const r = B.get("chair-reviewers").viewports.d1440.styles.diffs.find((d) => /on-time/.test(d.element)); console.log(JSON.stringify(r).slice(0, 700));
