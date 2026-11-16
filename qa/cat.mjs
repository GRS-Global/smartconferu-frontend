import * as m from "../../src/shared/emailCatalog.js";
const keys = ["acceptance", "minorRevision", "majorRevision", "waitlisted", "rejection", "registrationConfirmed", "decisionChanged", "finalDecisionReviewers", "cameraReadyReminder"];
const by = m.EMAIL_BY_KEY ?? Object.fromEntries((m.EMAIL_CATALOG ?? []).map((e) => [e.key, e]));
for (const k of keys) { const e = by[k]; console.log(JSON.stringify({ key: k, role: e?.role, label: e?.label, send: e?.sendType, count: e?.also ? 2 : 1, to: e?.to, also: e?.also, when: e?.when ?? e?.trigger })); }
console.log(Object.keys(by["acceptance"] ?? {}).join(","));
