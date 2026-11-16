/* Data behind the "this action sends N emails" note (sample / mock mode only; see lib/sample-mode.ts). A slice of the prototype's
   email catalogue (src/shared/emailCatalog.js: EMAIL_CATALOG, EMAIL_SEND_TYPES, EMAIL_SAMPLE_VALUES), limited to the emails the
   Register and Create Conference forms announce. Wording is copied from the prototype; add entries here only when a ported
   form needs them. */

export type SendType = "auto" | "chair" | "scheduled" | "bulk";
export type EmailRole = "account" | "chair" | "custom";

export const SEND_TYPES: Record<SendType, { label: string; desc: string }> = {
  auto: { label: "Automatic", desc: "Sent automatically when the event happens." },
  chair: { label: "Chair action", desc: "Sent when the Chair clicks the action." },
  scheduled: { label: "Scheduled reminder", desc: "Sent on a timer, no one has to click anything." },
  bulk: { label: "Bulk / manual", desc: "Written and sent by the Chair." },
};

export const SEND_TYPE_TONE: Record<SendType, { color: string; bg: string }> = {
  auto: { color: "var(--success)", bg: "var(--success-soft)" },
  chair: { color: "var(--primary)", bg: "var(--primary-soft)" },
  scheduled: { color: "var(--warning)", bg: "var(--warning-soft)" },
  bulk: { color: "var(--secondary)", bg: "var(--secondary-soft)" },
};

export const ROLE_TONE: Record<EmailRole, { color: string; bg: string }> = {
  account: { color: "var(--navy)", bg: "var(--muted)" },
  chair: { color: "var(--secondary)", bg: "var(--secondary-soft)" },
  custom: { color: "var(--ink-muted)", bg: "var(--muted)" },
};

const para = (text: string) => text.split(/\n\n+/).filter(Boolean).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
const PLATFORM_SIGN = "The Smartconferu Team";

interface CatalogEntry { key: string; module: "account" | "setup" | "reviewing"; role: EmailRole; sendType: SendType; label: string; trigger: string; to: string; subject: string; body: string }

const CATALOG: CatalogEntry[] = [
  {
    key: "verifyEmail", module: "account", role: "account", sendType: "auto", label: "Verify your email", trigger: "User signs up", to: "Any user",
    subject: "Confirm your email address for Smartconferu",
    body: para(`Hi {{first_name}},\n\nThanks for signing up. Please confirm this is your email address so we can finish setting up your account.\n\nConfirm my email: {{verify_link}}\n\nThis link expires in 24 hours. If you didn't sign up, you can ignore this email.\n\n${PLATFORM_SIGN}`),
  },
  {
    key: "welcome", module: "account", role: "account", sendType: "auto", label: "Welcome to Smartconferu",
    trigger: "Email verified, or someone new is invited or added (reviewer invitation, co-author)", to: "Any user",
    subject: "Welcome to Smartconferu, {{first_name}}",
    body: para(`Hi {{first_name}},\n\nWelcome to Smartconferu! With one account you can submit papers, review for conferences and keep all your certificates and receipts in one place.\n\nSet up your account and complete your profile (with your ORCID iD) so chairs can match you to the right papers: {{profile_link}}\n\n${PLATFORM_SIGN}`),
  },
  {
    key: "conferenceCreated", module: "setup", role: "chair", sendType: "auto", label: "Conference created", trigger: "Chair creates a conference (draft)", to: "Conference Chair",
    subject: "{{conference_name}} is created — here's what's next",
    body: para(`Hi {{first_name}},\n\n{{conference_name}} is saved as a draft. Before you publish, work through the setup checklist: dates, tracks, submission form, review form and registration fees.\n\nOpen your conference: {{dashboard_link}}\n\n${PLATFORM_SIGN}`),
  },
];

const CONF_SIGN = `Best regards,
The {{conference_name}} Team`;
CATALOG.push(
  {
    key: "reviewThanks", module: "reviewing", role: "custom", sendType: "auto", label: "Thank you for your review", trigger: "Reviewer submits a review", to: "Reviewer",
    subject: "Thank you for your review of \"{{paper_title}}\"",
    body: para(`Dear {{first_name}},

Thank you for reviewing "{{paper_title}}". A copy of your review is below for your records:

{{review_copy}}

You can edit it until the decision is made.

${CONF_SIGN}`),
  },
  {
    key: "reviewSubmittedChair", module: "reviewing", role: "chair", sendType: "auto", label: "Review submitted", trigger: "Reviewer submits", to: "Conference Chair",
    subject: "New review on \"{{paper_title}}\" — score {{score}}",
    body: para(`Hi {{first_name}},

{{reviewer_name}} submitted a review of "{{paper_title}}".

Score: <b>{{score}}</b>

${CONF_SIGN}`),
  },
  {
    key: "chairDecisionReady", module: "reviewing", role: "chair", sendType: "auto", label: "Paper ready for decision", trigger: "Last required review arrives", to: "Conference Chair",
    subject: "Ready for decision: \"{{paper_title}}\"",
    body: para(`Hi {{first_name}},

All required reviews are in for "{{paper_title}}".

Average score: <b>{{avg_score}}</b>
Spread: {{score_spread}}

Record a decision: {{submission_link}}

${CONF_SIGN}`),
  },
);

/** The prototype's EMAIL_SAMPLE_VALUES for the merge fields these emails use. */
const SAMPLE_VALUES: Record<string, string> = {
  first_name: "Mihir", last_name: "Chauhan",
  conference_name: "International Conference on Technology & Computer Science", conference_acronym: "ICTCS 2026",
  verify_link: "https://smartconferu.com/verify/•••", profile_link: "https://smartconferu.com/profile", dashboard_link: "https://smartconferu.com/chair/ictcs2026",
  paper_title: "Cloud-Native Architecture Patterns for Edge Computing", submission_link: "https://smartconferu.com/s/ictcs-142", reviewer_name: "Dr. Priya Nair",
  review_copy: "Score 4 / 5 · Clear methodology; the evaluation could compare against one more baseline.", score: "4 / 5", avg_score: "3.8 / 5", score_spread: "3 – 5",
};

/** One email an action sends. Either a catalogue `key`, or a fully custom email (label, subject, body, sendType). */
export interface NoteEmail {
  key?: string;
  label?: string;
  when?: string;
  to?: string | string[];
  /** More recipients of the same email (the prototype's "also"): they add to the count. */
  also?: string[];
  /** Merge fields filled for this email only (undefined ones keep the sample value). */
  values?: Record<string, string | undefined>;
  recipientName?: string;
  subject?: string;
  body?: string;
  sendType?: SendType;
}

export interface ResolvedEmail {
  id: string;
  role: EmailRole;
  sendType: SendType;
  label: string;
  when: string;
  to: string[];
  count: number;
  subject: string;
  body: string;
  sender: string;
  account: boolean;
}

const asList = (v: string | string[] | undefined): string[] => (v == null || v === "" ? [] : Array.isArray(v) ? v.filter(Boolean) : [v]);

/** Same resolution as the prototype's resolveEmailItem for these cases: the recipient line, the greeting name taken from the
 *  recipient (unless it is a role or an address), merge fields filled with the sample values. */
export function resolveEmail(item: NoteEmail, conference?: { name: string; acronym: string }, index = 0): ResolvedEmail {
  const meta = CATALOG.find((c) => c.key === item.key);
  const role: EmailRole = meta?.role ?? "custom";
  const to = [...(asList(item.to).length ? asList(item.to) : [meta?.to ?? "Recipient"]), ...(item.also ?? [])];
  const greet = String(item.recipientName || to[0] || "").replace(/<.*>/, "").trim();
  const personal = greet && !greet.includes("@") && !/\b(chair|reviewer|author|member|user|admin|team|recipient|registrant|audience|email)s?\b/i.test(greet);
  const values: Record<string, string> = {
    ...SAMPLE_VALUES,
    ...(personal ? { first_name: greet.split(" ")[0], last_name: greet.split(" ").slice(1).join(" ") } : {}),
    ...(conference ? { conference_name: conference.name, conference_acronym: conference.acronym } : {}),
    ...Object.fromEntries(Object.entries(item.values ?? {}).filter(([, v]) => v != null)) as Record<string, string>,
  };
  const fill = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (m, k: string) => values[k] ?? m);
  const account = meta?.module === "account";
  const label = item.label || meta?.label || "Email notification";
  return {
    id: `${item.key ?? "custom"}-${index}`, role, sendType: item.sendType ?? meta?.sendType ?? "chair", label, when: item.when || meta?.trigger || "",
    to, count: to.length, subject: fill(item.subject || meta?.subject || `Notification: ${label}`), body: fill(item.body || meta?.body || "<p>Dear {{first_name}},</p>"),
    sender: account ? "Smartconferu <no-reply@smartconferu.com>" : `${conference?.acronym || "Smartconferu"} Secretariat <notifications@smartconferu.com>`,
    account,
  };
}
