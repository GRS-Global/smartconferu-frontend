"use client";
/* Chairs' requests to delete an archived conference that are waiting for a decision (the
   prototype's DeletionRequestsBanner). Shown on the Dashboard and on Conferences; each row opens the
   conference, where the decision is made. Renders nothing when none are waiting. */
import Link from "next/link";
import { ArrowRight, Trash2 } from "lucide-react";
import type { DeletionRequest } from "../services";
import { Card, CardTitle, fmtDate } from "./ui";

export function DeletionRequestsBanner({ requests }: { requests: DeletionRequest[] }) {
  const asks = requests.filter((d) => d.status === "pending");
  if (!asks.length) return null;
  return (
    <Card style={{ borderColor: "var(--danger)" }}>
      <CardTitle title={`Deletion requests (${asks.length})`} subtitle="Chairs asking for an archived conference to be deleted" />
      <ul className="-mt-2">
        {asks.map((d) => (
          <li key={d.id} style={{ borderTop: "1px solid var(--muted)" }}>
            <Link href={`/super-admin/conferences/${d.conferenceId}`} className="sa-row-link">
              <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0" style={{ background: "var(--danger-soft)", color: "var(--danger-ink)" }}>
                <Trash2 size={17} />
              </span>
              <span className="flex-1 min-w-0 text-left">
                <span className="block text-[14px] font-semibold truncate" style={{ color: "var(--text)" }}>
                  {d.acronym}
                </span>
                <span className="block text-[12.5px] truncate" style={{ color: "var(--text-muted)" }}>
                  {d.requestedBy.name} · {fmtDate(d.createdAt)} · “{d.reason}”
                </span>
              </span>
              <ArrowRight size={16} style={{ color: "var(--text-faint)" }} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
