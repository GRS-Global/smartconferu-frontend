import type { AuthorSubmissionService } from "@/services/author-submissions";
import { PARITY, mockSlug } from "@/mocks/parity";
import type { AuthorInput, AuthorPaper, AuthorSubmission, ConferenceDetails, PaperAuthor, PaperDetailsPatch } from "@/types/author-submission";

/* Typed fixtures for NEXT_PUBLIC_DATA_SOURCE=mock (UI work only; no network, no accounts). Conference ids match
   src/mocks/conferences.ts. They cover every status the page can show: draft, revision (decision and screening), waitlist,
   under review, accepted (registration pending / registered), not accepted and withdrawn. */

const me: PaperAuthor = { name: "Test Person", email: "you@example.org", affiliation: "IIT Delhi", country: "India", corresponding: true };
const co = (name: string, corresponding = false): PaperAuthor => ({ name, email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.org`, affiliation: "Example University", country: "India", corresponding });

const paper = (n: number, conferenceId: string, prefix: string, title: string, over: Partial<AuthorSubmission>): AuthorSubmission => ({
  id: `${prefix}-${n}`, dbId: `mock-sub-${prefix}-${n}`, conferenceId, title, authors: [me, co("Dr. Rahman")],
  submittedAt: "Sep 14, 2026", lastUpdate: "Oct 02, 2026", track: "General Track", presentationType: "Paper Presentation",
  withdrawn: false, mySubmission: true, myCorresponding: true, result: "no_result", decision: null, uploadPending: false, screeningRequest: null, ...over,
});

const DSAI = "demo-dsai-2027";
const NETS = "demo-nets-2026";
const FIXTURES: AuthorSubmission[] = [
  paper(77, DSAI, "DSAI", "Federated Learning for Privacy-Preserving IoT Analytics", { result: "not_registered", submittedAt: "Aug 19, 2026" }),
  paper(81, DSAI, "DSAI", "Scenario-Based Forecasting of Media Supply and Demand", {}),
  paper(90, DSAI, "DSAI", "Gaze-Aware Interfaces for Seminars", { result: "draft", submittedAt: null, track: "Poster Track", presentationType: "Poster" }),
  paper(95, DSAI, "DSAI", "Adaptive Curriculum Sequencing with Bandits", { decision: "revise", mySubmission: false, myCorresponding: false, authors: [co("Dr. Rahman", true), me] }),
  paper(96, DSAI, "DSAI", "Corrected Upload Needed: Abstract Missing", { screeningRequest: { kind: "correction", version: 1, deadline: "Nov 12, 2026" } }),
  paper(97, DSAI, "DSAI", "A Waitlisted Study of Edge Caching", { decision: "waitlist" }),
  paper(98, DSAI, "DSAI", "Withdrawn Draft on Sparse Attention", { withdrawn: true }),
  paper(118, NETS, "NETS", "Edge Caching under Intermittent Connectivity", { result: "registered" }),
  paper(119, NETS, "NETS", "A Rejected Proposal on Mesh Routing", { result: "not_accepted" }),
];

const DETAILS: Record<string, ConferenceDetails> = {
  [DSAI]: { acronym: "DSAI 2027", name: "International Conference on Data Systems and Applied Intelligence", city: "Pune", state: "Maharashtra", country: "India", webPage: "https://example.org/dsai", contactEmail: "chairs@example.org" },
  [NETS]: { acronym: "NETS 2026", name: "Symposium on Networked Systems and Security", city: "Austin", state: "", country: "United States", webPage: "", contactEmail: "" },
};

const toPaper = (p: AuthorSubmission): AuthorPaper => {
  const status: AuthorPaper["status"] = p.result === "draft" ? "draft" : p.result === "registered" || p.result === "not_registered" ? "accepted" : p.result === "not_accepted" ? "rejected" : p.decision || p.screeningRequest ? "under_review" : "submitted";
  const conf = DETAILS[p.conferenceId];
  const nets = p.conferenceId === NETS;
  return {
    ...p,
    myEmails: ["you@example.org"],
    authors: p.authors.map((a, i) => ({ ...a, isMe: i === 0 || a.email === "you@example.org" })),
    status,
    abstract: "We study how the system behaves under load and propose a lightweight method that keeps latency low.\n\nExperiments on three public benchmarks confirm the gains.",
    keywords: ["edge computing", "federated learning", "latency"],
    versions: p.result === "draft" ? [] : [{ name: `${p.id}_paper_v1.pdf`, uploadedAt: "Sep 14, 2026", storagePath: null }, ...(p.id.endsWith("77") ? [{ name: `${p.id}_paper_v2.pdf`, uploadedAt: "Oct 02, 2026", storagePath: null }] : [])],
    supporting: p.id.endsWith("77") ? [{ name: "dataset-description.pdf", uploadedAt: "Oct 02, 2026", storagePath: null, type: "Supplementary material" }] : [],
    decisionTold: status === "accepted" ? "accept" : status === "rejected" ? "reject" : p.decision,
    decisionNote: status === "accepted" ? "Congratulations. Please register by the date in the email." : "",
    comments: status === "accepted" || status === "rejected" ? [{ n: 1, text: "A clear paper. Please state the limits of the evaluation more directly.", submittedAt: "Oct 20, 2026" }] : [],
    withdrawnAt: "Oct 25, 2026",
    withdrawnBy: "author",
    screeningNotice: p.screeningRequest ? { kind: p.screeningRequest.kind, version: p.screeningRequest.version, deadline: p.screeningRequest.deadline, reasons: ["The abstract is missing. Please add an abstract of 150–250 words."], note: "Please re-upload.", by: "Conference Chair", similarity: null } : null,
    conference: { id: p.conferenceId, acronym: conf?.acronym ?? "", name: conf?.name ?? "", status: nets ? "active" : "active", startDate: nets ? "2026-12-10" : "2027-02-17", endDate: nets ? "2026-12-12" : "2027-02-19" },
  };
};

// Changes made in this session (mock mode keeps them in memory, like src/mocks/conferences.ts).
const changes = new Map<string, Partial<Pick<AuthorPaper, "title" | "abstract" | "keywords" | "authors" | "withdrawn" | "status" | "versions" | "supporting">>>();
const byDbId = (dbId: string) => FIXTURES.find((x) => x.dbId === dbId);

export const mockAuthorSubmissionService: AuthorSubmissionService = {
  async loadSubmitForm(slug) { return mockSlug(slug) === "demo-dsai-2027" ? { slug, acronym: "DSAI 2027", name: "Demo conference", closed: false, deadline: "", guidelines: "", tracks: ["General Track"], presentationTypes: ["Paper Presentation", "Poster Presentation", "Workshop"], extras: [], me: { name: "Asha Verma", email: "asha@example.org", affiliation: "", country: "" } } : null; },
  async checkDuplicate() { return { found: false, mine: false }; },
  async submitPaper() { return { dbId: "mock-new", label: "DSAI-99" }; },
  async paperByLabel(label) {
    const p = FIXTURES.find((x) => x.id === label);
    return p ? { ...toPaper(p), ...(changes.get(p.id) ?? {}) } : null;
  },
  async uploadFile(dbId, file, as) {
    const p = byDbId(dbId);
    if (!p) return;
    const now = { name: file.name, uploadedAt: "Oct 30, 2026", storagePath: null as string | null };
    const cur = changes.get(p.id) ?? {};
    const base = toPaper(p);
    changes.set(p.id, as === "supporting"
      ? { ...cur, supporting: [...(cur.supporting ?? base.supporting), { ...now, type: "Supplementary material" }] }
      : { ...cur, versions: [...(cur.versions ?? base.versions), now] });
  },
  async updateDetails(dbId, patch: PaperDetailsPatch) {
    const p = byDbId(dbId);
    if (p) changes.set(p.id, { ...changes.get(p.id), title: patch.title.trim(), abstract: patch.abstract.trim(), keywords: patch.keywords });
  },
  async saveAuthors(dbId, authors: AuthorInput[]) {
    const p = byDbId(dbId);
    if (p) changes.set(p.id, { ...changes.get(p.id), authors: authors.map((a) => ({ ...a, isMe: a.email.toLowerCase() === "you@example.org" })) });
  },
  async withdraw(dbId) {
    const p = byDbId(dbId);
    if (p) changes.set(p.id, { ...changes.get(p.id), withdrawn: true });
  },
  async fileUrl() {
    if (PARITY) return "/__qa-paper.pdf"; // visual QA serves a small PDF at this address
    throw new Error("Files are not available in mock data mode.");
  },
  async conferenceDetails(conferenceSlug) {
    return DETAILS[mockSlug(conferenceSlug)] ? { ...DETAILS[mockSlug(conferenceSlug)] } : null;
  },
  async listForConference(conferenceSlug) {
    return FIXTURES.filter((p) => p.conferenceId === mockSlug(conferenceSlug)).map((p) => ({ ...p, authors: p.authors.map((a) => ({ ...a })) }));
  },
};
