import fs from "node:fs";
const B = JSON.parse(fs.readFileSync("out/audit.json", "utf8")).audit;
for (const e of B.filter((x) => /^chair-settings/.test(x.page))) { const v = e.viewports.d1440; console.log(e.page.padEnd(32), "style", v.styles?.diffs?.length, "high", v.styles?.diffs?.filter((d) => d.severity === "high").length, "field issues", v.fields?.issues?.length ?? v.fieldIssues?.length, "controls", JSON.stringify(v.controls?.counts ?? v.controls ?? "").slice(0, 60)); }
