import fs from "node:fs";
const f = "../src/mocks/chair.ts"; let s = fs.readFileSync(f, "utf8");
const a = `  async loadEmailLogs() { return []; },`;
if (!s.includes(a)) throw new Error("x");
s = s.replace(a, () => `  // QA only (parity fixtures): four sample sends, as the prototype's sample data has, so the table can be compared.
  async loadEmailLogs() {
    if (!PARITY) return [];
    const mk = (id: string, createdAt: string, subject: string, template: string): import("@/types/chair").ChairEmailLog => ({ id, createdAt, event: "sample", template, toName: "Mihir Chauhan", toEmail: "gauravgjind@gmail.com", recipientType: "Author", subject, body: "<p>Sample email.</p>", status: "sent", error: "" });
    return [mk("l1", "2026-11-03T07:00:00Z", "Revision Required – ISBM-680", "Revision Request"), mk("l2", "2026-11-02T07:00:00Z", "Acceptance Notification – ISBM-717", "Acceptance Notification"), mk("l3", "2026-10-31T08:00:00Z", "Book your presentation slot – ISBM 2026-27", "Slot Booking"), mk("l4", "2026-10-25T10:00:00Z", "Submission Confirmation – ISBM-693", "Submission Confirmation")];
  },`);
fs.writeFileSync(f, s); console.log("ok");
