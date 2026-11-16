import fs from "node:fs";
let f = "src/mocks/reviewer.ts", s = fs.readFileSync(f, "utf8");
s = s.replace(`import { mockSlug } from "@/mocks/parity";`, `import { PARITY, mockSlug } from "@/mocks/parity";`);
s = s.replace(`const NETS = "demo-nets-2026";`, `const NETS = "demo-nets-2026";
// Visual QA only: the prototype's headline conference answers with the demo conference, and this reviewer holds the prototype's papers there.
const ISBM = "demo-dsai-2027";
const parityPapers: ReviewerPaper[] = PARITY ? [
  p(680, ISBM, "ISBM", "AI Automation in Business Process Reengineering", { track: "Business Analytics", keywords: ["business process reengineering", "AI automation", "process mining", "SME productivity", "automation readiness"], abstract: "Business process reengineering (BPR) projects increasingly rely on AI-driven automation, yet mid-size enterprises struggle to tell which processes will actually benefit. This paper studies 42 BPR initiatives in Indian manufacturing and services firms with 2,501,000 employees, where machine-learning and robotic automation were introduced between 2019 and 2025. Using process-mining logs and structured interviews with 68 process owners, we measure cycle time, error rate and cost per transaction before and after automation." }),
  p(701, ISBM, "ISBM", "Usage-Based Pricing and Churn in B2B SaaS Subscriptions", { response: "pending", track: "Digital Business" }),
  p(732, ISBM, "ISBM", "Machine-Learning Maintenance Scheduling for Indian Railway Rolling Stock", { draft: true, track: "Operations & Supply Chain" }),
] : [];`);
s = s.replace(`    p(122, NETS, "NETS", "Zero-Trust Segmentation at Scale", { review: { score: 4, submittedAt: "Oct 20, 2026" } }),
  ],`, `    p(122, NETS, "NETS", "Zero-Trust Segmentation at Scale", { review: { score: 4, submittedAt: "Oct 20, 2026" } }),
    ...parityPapers,
  ],`);
s = s.replace("storagePath: null }], decision: null }", `storagePath: PARITY ? "qa/paper.pdf" : null }], decision: null }`);
fs.writeFileSync(f, s);
f = "src/mocks/author-submissions.ts"; s = fs.readFileSync(f, "utf8");
s = s.replace(`import { mockSlug } from "@/mocks/parity";`, `import { PARITY, mockSlug } from "@/mocks/parity";`);
s = s.replace(`  async fileUrl() {
    throw new Error("Files are not available in mock data mode.");`, `  async fileUrl() {
    if (PARITY) return "/__qa-paper.pdf"; // visual QA serves a small PDF at this address
    throw new Error("Files are not available in mock data mode.");`);
fs.writeFileSync(f, s);
