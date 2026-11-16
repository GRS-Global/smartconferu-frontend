/* eslint-disable react/no-unescaped-entities -- the page text is the prototype's, word for word */
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, Eye, FileText, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Modal } from "@/components/ui/modal";
import { getAccountExtrasService } from "@/services/account-extras";
import type { Receipt } from "@/types/account";
import { PageLoading, PageProblem } from "./page-states";

/* My Receipts (the prototype's MyReceiptsPage): payments made on Smartconferu, newest first, with a search, the total paid and a delete that asks first.
   They are the person's own rows (user_receipts, migration 0050). The eye and the download open the receipt as a printable page ("Save as PDF"). */

const formatCurrency = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A receipt as a printable page in a new window; `print` also opens the print dialog (where "Save as PDF" is the download). */
function openReceipt(r: Receipt, print: boolean) {
  const w = window.open("", "_blank", "width=720,height=820");
  if (!w) return;
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${r.id}</title><style>body{font-family:system-ui,sans-serif;color:#0F172A;margin:48px}h1{font-size:22px;margin:0 0 4px}.m{color:#64748B;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:28px}td,th{text-align:left;padding:12px 8px;border-bottom:1px solid #E2E8F0;font-size:14px}.t{font-size:18px;font-weight:700;text-align:right;margin-top:20px}</style></head><body><h1>Smartconferu receipt</h1><div class="m">Receipt #${r.id} · ${esc(r.date)} · Paid</div><table><tr><th>Payment description</th><th style="text-align:right">Amount</th></tr><tr><td>${esc(r.description)}</td><td style="text-align:right">${formatCurrency(r.amount)}</td></tr></table><div class="t">Total paid ${formatCurrency(r.amount)}</div></body></html>`);
  w.document.close();
  if (print) { w.focus(); w.print(); }
}

export function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [problem, setProblem] = useState("");
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getAccountExtrasService().then((svc) => svc.receipts()).then(
      (r) => { if (alive) { setReceipts(r); setProblem(""); } },
      (e: unknown) => { if (alive) setProblem(e instanceof Error ? e.message : "Something went wrong."); },
    );
    return () => { alive = false; };
  }, [tick]);

  if (problem) return <PageProblem title="My Receipts" heading="Couldn't load your receipts." message={problem} onRetry={() => { setProblem(""); setTick((t) => t + 1); }} />;
  if (!receipts) return <PageLoading title="My Receipts" label="Loading your receipts" />;

  const filtered = receipts.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.description.toLowerCase().includes(q) || String(r.id).includes(q);
  });

  const totalPaid = receipts.reduce((sum, r) => sum + r.amount, 0);

  const performDelete = async (id: number) => {
    setBusy(true);
    try {
      await (await getAccountExtrasService()).deleteReceipt(id);
      setReceipts((list) => (list ?? []).filter((r) => r.id !== id));
      setConfirmDeleteId(null);
    } catch (e) {
      setConfirmDeleteId(null);
      setProblem(e instanceof Error ? e.message : "We couldn't delete that receipt.");
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="My Receipts" />
      <div className="p-8">
        <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-xl p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <p style={{ color: "var(--ink-soft)" }} className="text-sm leading-relaxed max-w-xl">
            Receipts for payments you've made on Smartconferu. Deleting one removes your access to it for good, so save a copy first if you might need it later.
          </p>
          <div style={{ background: "#FFFFFF", border: "1px solid var(--border)" }} className="rounded-xl px-4 py-3 text-right shrink-0">
            <div style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold">Total Paid</div>
            <div style={{ color: "var(--navy)" }} className="text-lg font-bold">{formatCurrency(totalPaid)}</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 style={{ color: "var(--navy)" }} className="text-base font-bold">
            Payment History <span style={{ color: "var(--ink-faint)" }} className="font-medium">({receipts.length})</span>
          </h2>
          <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="flex items-center gap-2 px-3 py-2 rounded-lg">
            <Search size={15} style={{ color: "var(--ink-faint)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search receipts..."
              style={{ color: "var(--ink)" }}
              className="bg-transparent text-sm outline-none w-56 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl overflow-x-auto">
          <table className="ui-table w-full text-sm">
            <thead>
              <tr style={{ background: "var(--canvas)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-5 py-3">#</th>
                <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-5 py-3">Payment Description</th>
                <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-5 py-3">Amount</th>
                <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-5 py-3">Status</th>
                <th style={{ color: "var(--ink-muted)" }} className="text-right font-semibold text-xs px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--muted)" : "none" }}
                  className="transition-colors"
                >
                  <td className="px-5 py-3.5" style={{ color: "var(--ink-faint)" }}>{r.id}</td>
                  <td className="px-5 py-3.5" style={{ color: "var(--ink)" }}><span className="font-semibold">{r.description}</span></td>
                  <td className="px-5 py-3.5" style={{ color: "var(--ink)" }}>{formatCurrency(r.amount)}</td>
                  <td className="px-5 py-3.5">
                    <span style={{ color: "var(--success)", background: "var(--success-soft)" }} className="text-xs font-semibold px-2.5 py-1 rounded-full">Paid</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button style={{ color: "var(--ink-faint)" }} className="p-1.5 rounded-lg hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] transition-colors cursor-pointer" onClick={() => openReceipt(r, false)} aria-label={`View invoice for receipt ${r.id}`} title="View invoice">
                        <Eye size={15} />
                      </button>
                      <button style={{ color: "var(--ink-faint)" }} className="p-1.5 rounded-lg hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] transition-colors cursor-pointer" onClick={() => openReceipt(r, true)} aria-label={`Download receipt ${r.id}`} title="Download receipt">
                        <Download size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(r.id)}
                        style={{ color: "var(--ink-faint)" }}
                        className="p-1.5 rounded-lg hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                        aria-label={`Delete receipt ${r.id}`}
                        title="Delete receipt"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-14 text-center">
              <FileText size={28} style={{ color: "var(--border-strong)" }} className="mx-auto mb-2" />
              <p style={{ color: "var(--ink-faint)" }} className="text-sm">
                {receipts.length === 0 ? "You have no receipts yet." : "No receipts match your search."}
              </p>
            </div>
          )}
        </div>
      </div>

      {confirmDeleteId && (
        <Modal title="Delete Receipt" onClose={() => setConfirmDeleteId(null)} maxWidth="max-w-sm">
          <div className="flex items-start gap-3 mb-5">
            <div style={{ background: "var(--danger-soft)" }} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0">
              <AlertTriangle size={18} style={{ color: "var(--danger)" }} />
            </div>
            <p style={{ color: "var(--ink-soft)" }} className="text-sm leading-relaxed">
              Once deleted, you won't be able to access this receipt again. Are you sure you want to continue?
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setConfirmDeleteId(null)}
              style={{ border: "1.5px solid var(--border)", color: "var(--ink-muted)" }}
              className="px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={busy} onClick={() => void performDelete(confirmDeleteId)}
              style={{ background: "var(--danger)" }}
              className="px-4 py-2 rounded-lg text-white text-sm font-semibold hover:bg-[var(--danger-hover)] transition-colors cursor-pointer disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
