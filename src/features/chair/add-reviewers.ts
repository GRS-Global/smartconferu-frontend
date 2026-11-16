import { sendActionEmails } from "@/services/action-emails";
import { getChairService } from "@/services/chair";
import type { PoolReviewer } from "@/types/chair";

/** What the chair picked in "Add reviewers": people from the committee, or someone new to invite (they join the committee and get the paper). */
export type AddPick = { rev: PoolReviewer } | { invite: { name: string; email: string } };

/** Gives one paper to the picked reviewers (inviting the new ones first) and emails them: the invitation for a new person, the assignment for
 *  everyone who has an account. A reviewer who has not accepted the committee invitation gets the paper queued, as on the Reviewers page. */
export async function addReviewersToPaper(slug: string, paperDbId: string, picks: AddPick[], due: string): Promise<{ names: string[]; count: number; mail: string | null }> {
  const svc = await getChairService();
  let mail: string | null = null; let count = 0; const names: string[] = [];
  for (const p of picks) {
    let rev: PoolReviewer;
    if ("rev" in p) rev = p.rev;
    else {
      const res = await svc.inviteReviewer(slug, { name: p.invite.name, email: p.invite.email, tracks: [] });
      if (res.created) mail = (await sendActionEmails("reviewer_invited", { memberId: res.memberId })) ?? mail;
      rev = { memberId: res.memberId, userId: res.userId, name: p.invite.name, email: p.invite.email, tracks: [], status: "invited", invitedAt: "" };
    }
    const given = await svc.assignPapers(rev, [paperDbId], due);
    count += given.length; names.push(rev.name);
    if (rev.userId) for (const id of given) mail = (await sendActionEmails("reviews_assigned", { submissionId: id, reviewerIds: [rev.userId] })) ?? mail;
  }
  return { names, count, mail };
}
