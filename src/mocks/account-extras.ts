import type { AccountExtrasService } from "@/services/account-extras";
import type { PaperCandidate, ProposalConference, Publication, Receipt, WatchedCfp } from "@/types/account";

/* NEXT_PUBLIC_DATA_SOURCE=mock only (UI work: no network, no accounts): the prototype's sample receipts, watchlist and papers, kept in memory for the
   page's lifetime. Nothing is stored anywhere. */

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const store: { receipts: Receipt[]; watch: string[]; pubs: Array<Publication & { kind: "preprint" | "slides" }>; proposals: number } = {
  receipts: [
    { id: 2959300, description: "Executive license for ICTCS 2026", amount: 965, date: "2026-01-12" },
    { id: 3407630, description: "Professional license for ICICT 2027", amount: 405, date: "2026-03-18" },
    { id: 3709998, description: "Professional license for SmartCom 2027", amount: 485, date: "2026-05-02" },
    { id: 4240062, description: "Professional license for ISBM 2026", amount: 565, date: "2026-07-09" },
    { id: 6531285, description: "Annual deposit for agreement 302749", amount: 3800, date: "2026-08-01" },
    { id: 6962660, description: "Annual invoice for agreement 302749, Smartconferu", amount: 9756.5, date: "2026-08-15" },
    { id: 7063692, description: "Annual invoice for agreement 302749, Smartconferu", amount: 11854.1, date: "2026-08-20" },
  ],
  watch: ["quantcomp-2027", "cybersec-2027"],
  pubs: [],
  proposals: 0,
};

const CFPS: WatchedCfp[] = [
  { cfpPage: "cybersec-2027", slug: "cybersec-2027", acronym: "CYBERSEC 2027", name: "International Conference on Cybersecurity", country: "Singapore", submissionDeadline: "2026-12-15", endDate: "2027-03-20", topics: ["privacy engineering", "threat intelligence", "zero trust architecture"] },
  { cfpPage: "quantcomp-2027", slug: "quantcomp-2027", acronym: "QUANTCOMP 2027", name: "Quantum Computing Symposium", country: "Germany", submissionDeadline: "2026-12-10", endDate: "2027-05-14", topics: ["quantum algorithms", "quantum error correction"] },
  { cfpPage: "blockchain-2027", slug: "blockchain-2027", acronym: "BLOCKCHAIN 2027", name: "Blockchain and Distributed Ledgers Forum", country: "United Arab Emirates", submissionDeadline: "2027-01-25", endDate: "2027-06-02", topics: ["distributed ledgers", "smart contracts"] },
  { cfpPage: "marinesci-2027", slug: "marinesci-2027", acronym: "MARINESCI 2027", name: "Marine Sciences Congress", country: "Norway", submissionDeadline: "2027-02-20", endDate: "2027-08-11", topics: ["ocean engineering", "marine ecosystems"] },
];

const PAPERS: PaperCandidate[] = [
  { id: "p-1042", label: "ISBM-1042", conferenceAcronym: "ISBM 2026", conferenceName: "International Symposium on Business and Management", title: "Platform ecosystems and the decline of the product moat", abstract: "We study how platform ecosystems reshape competitive advantage for incumbent product firms.", keywords: ["platforms", "competitive advantage", "strategy"], authors: [{ name: "Alex Morgan", email: "alex@example.com" }, { name: "Priya Nair", email: "priya@example.com" }], date: "Jul 14, 2026" },
  { id: "p-1301", label: "DSAI-1301", conferenceAcronym: "DSAI 2027", conferenceName: "International Conference on Data Systems and Applied Intelligence", title: "Streaming feature stores for low-latency retrieval", abstract: "A feature store design that keeps online features fresh within tens of milliseconds.", keywords: ["feature stores", "streaming"], authors: [{ name: "Alex Morgan", email: "alex@example.com" }], date: "Oct 02, 2026" },
];

export const mockAccountExtrasService: AccountExtrasService = {
  async receipts() { return clone(store.receipts); },
  async deleteReceipt(id) { store.receipts = store.receipts.filter((r) => r.id !== id); },

  async watchlist() { return clone(CFPS.filter((c) => store.watch.includes(c.slug))); },
  async searchCfps(text, exclude) {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return clone(CFPS.filter((c) => !exclude.includes(c.slug) && (c.acronym.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))).slice(0, 6));
  },
  async addToWatchlist(slug) { if (!store.watch.includes(slug)) store.watch.push(slug); },
  async removeFromWatchlist(slugs) { store.watch = store.watch.filter((s) => !slugs.includes(s)); },

  async myPapers() { return clone(PAPERS); },
  async publications(kind) { return clone(store.pubs.filter((p) => p.kind === kind)); },
  async createPublication(input) {
    const names = input.authors.filter((a) => a.firstName || a.lastName).map((a) => `${a.firstName} ${a.lastName}`.trim()).join(", ");
    store.pubs.unshift({ id: `pub-${Date.now()}`, kind: input.kind, title: input.title.trim() || (input.kind === "slides" ? "Untitled slides" : "Untitled preprint"), authors: names || "Not set", source: input.kind === "slides" ? (input.event?.trim() || null) : (input.fromPaper?.acronym ?? null), paperId: input.fromPaper?.id ?? null });
  },

  async proposalConferences(): Promise<ProposalConference[]> {
    return [
      { slug: "demo-dsai-2027", acronym: "DSAI 2027", name: "International Conference on Data Systems and Applied Intelligence", endDate: "2027-02-19" },
      { slug: "isbm-2026", acronym: "ISBM 2026", name: "International Symposium on Business and Management", endDate: "2026-08-20" },
    ];
  },
  async submitProposal() { store.proposals += 1; },
};
