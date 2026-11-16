"use client";

import type { ChairPaper, ScreeningCriteria } from "@/types/chair";
import { checkDecisionOf } from "../stage";
import { plagDecisionOf } from "../screening";
import { Btn, InitialCheckSection, PlagiarismSection, ScreeningModal } from "./screening-ui";

/* Peer Review › the Initial check / Plagiarism cells' "View report" (the prototype's ScreeningReportModal): both steps in one place, each under its
   own heading with its own decision, so "Passed" and "Hold" are never read as one status. Shows the newest version's record. */
export function ScreeningReportModal({ paper, n, criteria, screening, onClose }: { paper: ChairPaper; n: number; criteria: ScreeningCriteria; screening: { initialCheck: boolean; plagiarism: boolean }; onClose: () => void }) {
  const rec = paper.screening[String(n)];
  const initialPassed = checkDecisionOf(rec) === "passed";
  const sections = [
    screening.initialCheck && { key: "initial", title: "Initial check", body: <InitialCheckSection rec={rec} criteria={criteria} /> },
    screening.plagiarism && {
      key: "plag", title: "Plagiarism check",
      body: screening.initialCheck && !initialPassed && plagDecisionOf(rec) === "pending"
        ? <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-xl px-3.5 py-2.5 text-sm text-ink-soft">Starts once the initial check is passed.</div>
        : <PlagiarismSection rec={rec} criteria={criteria} />,
    },
  ].filter((s): s is { key: string; title: string; body: React.ReactElement } => Boolean(s));
  return (
    <ScreeningModal title={`Screening Report — V${n}`} subtitle={`${paper.id} · ${paper.title}`} onClose={onClose} width={580} footer={<Btn onClick={onClose}>Close</Btn>}>
      <div className="space-y-5">
        {sections.map((s, i) => (
          <section key={s.key}>
            <h4 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-navy">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-soft text-[11px] text-primary">{i + 1}</span>{s.title}
            </h4>
            {s.body}
          </section>
        ))}
      </div>
    </ScreeningModal>
  );
}
