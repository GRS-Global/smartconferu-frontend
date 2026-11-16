// Chair Peer Review slice 2: unit test of src/features/chair/assign-rules.ts (conflicts, ranking, limits, declined papers, the auto-assign plan, the default
// review deadline). The rules are the prototype's (rankReviewersFor, reviewerConflicts, AutoAssignModal's plan, newAssignmentDueISO) without keyword
// matching. Usage: node assign-rules-test.mjs   (Node 24 runs the .ts file directly)
import assert from "node:assert/strict";
import { reviewerConflict, isOnPaper, loadOf, rankReviewersFor, planAutoAssign, newAssignmentDue } from "../src/features/chair/assign-rules.ts";

let pass = 0;
const t = (name, fn) => { try { fn(); pass += 1; console.log("ok   ", name); } catch (e) { console.log("FAIL ", name, "\n     ", e.message.split("\n")[0]); process.exitCode = 1; } };
const rev = (i, over = {}) => ({ memberId: `m${i}`, userId: `u${i}`, name: `Reviewer ${i}`, email: `r${i}@uni${i}.edu`, tracks: [], status: "active", invitedAt: "", ...over });
const auth = (name, email) => ({ name, email, affiliation: "", country: "", corresponding: false, hasAccount: true });
const row = (id, over = {}) => ({ paper: { id, dbId: `db-${id}`, authors: [auth("Some Author", "a@other.org")], ...(over.paper ?? {}) }, reviewers: over.reviewers ?? [], declined: over.declined ?? [], target: over.target ?? 2, canAssign: over.canAssign ?? true, decided: false });
const on = (r) => ({ r: { reviewerId: r.userId, awaitingInvite: false } });

// conflicts
t("author by email", () => assert.equal(reviewerConflict(rev(1), { authors: [auth("X", "R1@Uni1.edu")] }), "Author of this paper"));
t("author by name", () => assert.equal(reviewerConflict(rev(1, { name: "Dr Jane Roe" }), { authors: [auth("dr jane roe ", "other@x.org")] }), "Author of this paper"));
t("same institution (email domain)", () => assert.equal(reviewerConflict(rev(1), { authors: [auth("Pat Lee", "pat@uni1.edu")] }), "Same institution as Pat Lee"));
t("webmail is not an institution", () => assert.equal(reviewerConflict(rev(1, { email: "x@gmail.com" }), { authors: [auth("Pat Lee", "pat@gmail.com")] }), ""));
t("no conflict", () => assert.equal(reviewerConflict(rev(1), { authors: [auth("Pat Lee", "pat@elsewhere.org")] }), ""));

// presence and load
const pool = [rev(1), rev(2), rev(3), rev(4)];
const rows = [row("P1", { reviewers: [on(pool[0]), on(pool[1])] }), row("P2", { reviewers: [on(pool[0])] }), row("P3", { reviewers: [] })];
t("isOnPaper uses the account id", () => assert.equal(isOnPaper(pool[0], rows[0]), true));
t("isOnPaper false when not assigned", () => assert.equal(isOnPaper(pool[2], rows[0]), false));
t("queued reviewer (awaiting invite) matched by member id", () => assert.equal(isOnPaper(rev(9, { userId: null }), { reviewers: [{ r: { reviewerId: "m9", awaitingInvite: true } }] }), true));
t("load counts the papers a reviewer is on", () => assert.deepEqual(pool.map((p) => loadOf(p, rows)), [2, 1, 0, 0]));

// ranking
t("candidates exclude those already on the paper", () => assert.deepEqual(rankReviewersFor(rows[0], pool, rows, null).map((c) => c.rev.memberId), ["m3", "m4"]));
t("candidates exclude someone who declined this paper", () => assert.deepEqual(rankReviewersFor(row("P9", { declined: [{ name: "reviewer 3" }] }), pool, rows, null).map((c) => c.rev.memberId), ["m3x"].filter(() => false).concat(["m4", "m2", "m1"])));
t("lightest load first", () => assert.deepEqual(rankReviewersFor(rows[2], pool, rows, null).map((c) => c.rev.memberId), ["m3", "m4", "m2", "m1"]));
t("conflicts and full reviewers sort last, and are flagged", () => {
  const r = row("P8", { paper: { authors: [auth("Pat", "pat@uni3.edu")] } });
  const c = rankReviewersFor(r, pool, rows, 1);
  // m3 is in conflict (same institution) so it is last; of the rest, m4 is under the limit, m2 and m1 are at it (lighter first).
  assert.deepEqual(c.map((x) => x.rev.memberId), ["m4", "m2", "m1", "m3"]);
  assert.equal(c.find((x) => x.rev.memberId === "m3").conflict, "Same institution as Pat");
  assert.equal(c.find((x) => x.rev.memberId === "m1").full, true);
  assert.equal(c.find((x) => x.rev.memberId === "m2").full, true);
  assert.equal(c.find((x) => x.rev.memberId === "m4").full, false);
});

// the plan
t("plan fills each paper up to the target, no one twice on a paper", () => {
  const rs = [row("A"), row("B"), row("C")];
  const plan = planAutoAssign(rs, pool, rs, null);
  plan.forEach((p) => { assert.equal(p.reviewers.length, 2); assert.equal(new Set(p.reviewers.map((r) => r.memberId)).size, 2); });
});
t("plan spreads the load (every pick counts toward the next paper)", () => {
  const rs = [row("A"), row("B"), row("C"), row("D")];
  const plan = planAutoAssign(rs, pool, rs, null);
  const per = {}; plan.forEach((p) => p.reviewers.forEach((r) => { per[r.memberId] = (per[r.memberId] ?? 0) + 1; }));
  assert.deepEqual(Object.values(per).sort(), [2, 2, 2, 2]);
});
t("plan serves the paper with the fewest reviewers first", () => {
  const rs = [row("A", { reviewers: [on(pool[0])] }), row("B", { reviewers: [] })];
  assert.deepEqual(planAutoAssign(rs, pool, rs, null).map((p) => p.row.paper.id), ["B", "A"]);
});
t("plan only fills the missing slots", () => {
  const rs = [row("A", { reviewers: [on(pool[0])], target: 3 })];
  assert.equal(planAutoAssign(rs, pool, rs, null)[0].reviewers.length, 2);
});
t("plan never picks a conflict or a reviewer at the limit", () => {
  const r = row("A", { paper: { authors: [auth("Pat", "pat@uni3.edu")] } });
  const rs = [r, ...rows];
  const plan = planAutoAssign([r], pool, rs, 1);
  assert.deepEqual(plan[0].reviewers.map((x) => x.memberId), ["m4"]);
});
t("plan leaves a slot empty when nobody is eligible", () => {
  const r = row("A", { target: 2 });
  const plan = planAutoAssign([r], [rev(1)], [r], null);
  assert.equal(plan[0].reviewers.length, 1);
  assert.equal(plan[0].need - plan[0].reviewers.length, 1);
});
t("plan with an empty pool is empty", () => assert.equal(planAutoAssign([row("A")], [], [row("A")], null)[0].reviewers.length, 0));

// default deadline
const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
t("deadline: the days a reviewer gets, from today", () => assert.equal(newAssignmentDue({ timeline: { reviewDays: 14, closesAt: "" } }, "2026-12-05"), d(14)));
t("deadline: never later than the end of the reviewing period", () => assert.equal(newAssignmentDue({ timeline: { reviewDays: 14, closesAt: "2026-11-05T12:00" } }, "2026-12-05"), "2026-11-05"));
t("deadline: without days, the conference deadline", () => assert.equal(newAssignmentDue({ timeline: { reviewDays: 0, closesAt: "" } }, "2026-12-05"), "2026-12-05"));
t("deadline: no settings, the conference deadline", () => assert.equal(newAssignmentDue(null, "2026-12-05"), "2026-12-05"));

console.log(`\n${pass} passed${process.exitCode ? ", some FAILED" : ""}`);
