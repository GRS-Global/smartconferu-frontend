// One-off edit helper: in parity mode the mock paper belongs to the conference under its dashboard id, so the chair's paper pages resolve in visual QA.
import fs from "node:fs";
const file = "../src/mocks/chair.ts";
let s = fs.readFileSync(file, "utf8");
let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 70)); return; } s = s.replace(a, b); n += 1; };
rep('import { mockSlug } from "@/mocks/parity";', 'import { mockSlug, PARITY, PARITY_ALIAS_FROM, PARITY_ALIAS_TO } from "@/mocks/parity";');
rep("    return {\n      paper, data: await this.loadConference(paper.conferenceId),", "    // Visual QA (parity mode): the demo conference is listed on the dashboard under the prototype's id, so the paper belongs to that one.\n    return {\n      paper: PARITY && paper.conferenceId === PARITY_ALIAS_TO ? { ...paper, conferenceId: PARITY_ALIAS_FROM } : paper, data: await this.loadConference(paper.conferenceId),");
fs.writeFileSync(file, s);
console.log("applied", n);
