import type { ConferenceService, DashboardData } from "@/services/conferences";
import { PARITY_CONFERENCES } from "@/mocks/parity-conferences";
import type { AuthorPaper, ChairPaper, Conference, ReviewAssignment, ReviewInvitation, SourceConference } from "@/types/conference";

/* Typed fixtures for UI development only (NEXT_PUBLIC_DATA_SOURCE=mock). Names are invented and
   deliberately unlike any real conference id or acronym. Never loaded unless mock is asked for. */
const conf = (c: Omit<Conference, "status"> & { status?: Conference["status"] }): Conference => ({ status: "active", ...c });

const conferences: SourceConference[] = [
  {
    conference: conf({ id: "demo-dsai-2027", number: 1, acronym: "DSAI 2027", name: "International Conference on Data Systems and Applied Intelligence", startDate: "2027-02-17", endDate: "2027-02-19", city: "Pune", country: "India", reviewDeadline: "2026-12-20", pinned: true }),
    roles: ["chair", "author", "reviewer"],
  },
  {
    conference: conf({ id: "demo-nets-2026", number: 2, acronym: "NETS 2026", name: "Symposium on Networked Systems and Security", startDate: "2026-12-10", endDate: "2026-12-12", city: "Austin", country: "United States", reviewDeadline: "2026-11-01" }),
    roles: ["author", "reviewer"],
  },
  {
    conference: conf({ id: "demo-edtech-2027", number: 3, acronym: "EDTECH 2027", name: "Workshop on Technology-Enhanced Learning", startDate: "2027-03-08", endDate: "2027-03-10", city: "London", country: "United Kingdom" }),
    roles: ["author"],
  },
  {
    conference: conf({ id: "demo-green-2027", number: 4, acronym: "GREENCOMP 2027", name: "Conference on Sustainable Computing", startDate: "2027-06-03", endDate: "2027-06-05", city: "Singapore", country: "Singapore" }),
    roles: ["chair", "committee"],
    committeeRole: "Publicity Chair",
  },
  {
    conference: conf({ id: "demo-hci-2025", number: 5, acronym: "HCI-EU 2025", name: "European Forum on Human-Computer Interaction", status: "archived", startDate: "2025-09-22", endDate: "2025-09-24", city: "Berlin", country: "Germany", reviewDeadline: "2025-07-15" }),
    roles: ["author", "reviewer"],
  },
  {
    conference: conf({ id: "demo-adv-2027", number: 6, acronym: "ADVISORY 2027", name: "Industry Advisory Summit", startDate: "2027-04-20", endDate: "2027-04-21", city: "Toronto", country: "Canada" }),
    roles: ["committee"],
    committeeRole: "Advisory Committee",
  },
];

const authorPapers: AuthorPaper[] = [
  { conferenceId: "demo-dsai-2027", result: "not_registered" },
  { conferenceId: "demo-dsai-2027", result: "no_result" },
  { conferenceId: "demo-nets-2026", result: "registered" },
  { conferenceId: "demo-edtech-2027", result: "no_result" },
  { conferenceId: "demo-edtech-2027", result: "not_accepted" },
  { conferenceId: "demo-edtech-2027", result: "draft" },
  { conferenceId: "demo-hci-2025", result: "registered" },
  { conferenceId: "demo-hci-2025", result: "registered" },
];

const paper = (conferenceId: string, decision: ChairPaper["decision"], extra: Partial<ChairPaper> = {}): ChairPaper => ({ conferenceId, decision, withdrawn: false, registered: false, ...extra });
const chairPapers: ChairPaper[] = [
  ...Array.from({ length: 6 }, () => paper("demo-dsai-2027", "accepted")),
  paper("demo-dsai-2027", "accepted", { registered: true }),
  paper("demo-dsai-2027", "accepted", { registered: true }),
  ...Array.from({ length: 5 }, () => paper("demo-dsai-2027", "rejected")),
  ...Array.from({ length: 3 }, () => paper("demo-dsai-2027", "undecided")),
  paper("demo-dsai-2027", "undecided", { withdrawn: true }),
  ...Array.from({ length: 4 }, () => paper("demo-green-2027", "undecided")),
];

const assignment = (conferenceId: string, paperLabel: string, extra: Partial<ReviewAssignment> = {}): ReviewAssignment => ({ conferenceId, paperLabel, reviewed: false, declined: false, dueDate: null, ...extra });
const reviewerAssignments: ReviewAssignment[] = [
  assignment("demo-dsai-2027", "DSAI-3", { reviewed: true }),
  assignment("demo-dsai-2027", "DSAI-9", { dueDate: "2027-01-10" }),
  assignment("demo-dsai-2027", "DSAI-11"),
  assignment("demo-nets-2026", "NETS-4", { reviewed: true }),
  assignment("demo-nets-2026", "NETS-8", { dueDate: "2026-10-01" }),
  assignment("demo-nets-2026", "NETS-12", { declined: true }),
  assignment("demo-hci-2025", "HCI-2", { reviewed: true }),
  assignment("demo-hci-2025", "HCI-5", { reviewed: true }),
];

const invitations: ReviewInvitation[] = [
  { id: "inv-1", conferenceId: "demo-quant-2027", acronym: "QUANT 2027", conferenceName: "Symposium on Quantum Information Systems", country: "Japan", invitedBy: "Program Chair, QUANT 2027", invitedAt: "Oct 20, 2026", maxPapers: 4, status: "pending", respondedAt: "", declineReason: "", respondBy: "2026-10-29" },
  { id: "inv-2", conferenceId: "demo-bio-2027", acronym: "BIOCOMP 2027", conferenceName: "Conference on Computational Biology", country: "Netherlands", invitedBy: "Program Chair, BIOCOMP 2027", invitedAt: "Oct 12, 2026", maxPapers: null, status: "pending", respondedAt: "", declineReason: "", respondBy: "2026-11-20" },
  { id: "inv-3", conferenceId: "demo-nets-2026", acronym: "NETS 2026", conferenceName: "Symposium on Networked Systems and Security", country: "United States", invitedBy: "Program Chair, NETS 2026", invitedAt: "Aug 02, 2026", maxPapers: 5, status: "accepted", respondedAt: "Aug 03, 2026", declineReason: "" },
  { id: "inv-4", conferenceId: "demo-old-2026", acronym: "OLDCON 2026", conferenceName: "Legacy Systems Workshop", country: "France", invitedBy: "Program Chair, OLDCON 2026", invitedAt: "Jun 11, 2026", maxPapers: 3, status: "declined", respondedAt: "Jun 12, 2026", declineReason: "Too many commitments" },
];

const state = { invitations: invitations.map((i) => ({ ...i })) };

/* Visual QA only: NEXT_PUBLIC_MOCK_FIXTURES=parity lists the prototype's own 50 sample conferences (generated by
   qa/gen-parity-fixtures.mjs) instead of the invented demo ones. Per-conference paper / review counts are NOT mirrored
   (the prototype derives them from ~100 in-source sample papers), so those stay empty in this mode. */
const PARITY = process.env.NEXT_PUBLIC_MOCK_FIXTURES === "parity";
const parityConferences: SourceConference[] = PARITY_CONFERENCES.map((c) => ({
  conference: { id: c.id, number: c.number, acronym: c.acronym, name: c.name, status: c.status, startDate: c.startDate, endDate: c.endDate, city: c.city, country: c.country, pinned: c.pinned },
  roles: [...c.roles],
}));

export const mockConferenceService: ConferenceService = {
  async loadDashboard(): Promise<DashboardData> {
    return {
      source: {
        conferences: PARITY ? parityConferences : conferences,
        authorPapers: PARITY ? [] : authorPapers,
        chairPapers: PARITY ? [] : chairPapers,
        reviewerAssignments: PARITY ? [] : reviewerAssignments,
        certificates: PARITY ? [] : [
          { conferenceId: "demo-hci-2025", type: "presentation" },
          { conferenceId: "demo-hci-2025", type: "appreciation" },
          { conferenceId: "demo-hci-2025", type: "appreciation" },
        ],
      },
      invitations: state.invitations.map((i) => ({ ...i })),
    };
  },
  async respondToInvitation(id, accept, reason) {
    const inv = state.invitations.find((i) => i.id === id);
    if (!inv) throw new Error("Invitation not found");
    inv.status = accept ? "accepted" : "declined";
    inv.respondedAt = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    inv.declineReason = accept ? "" : reason ?? "";
  },
};
