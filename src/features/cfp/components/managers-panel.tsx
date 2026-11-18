"use client";

import { Building2, Check, GitMerge, Info, Plus, ShieldCheck, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { sendActionEmails } from "@/services/action-emails";
import { getChairService } from "@/services/chair";
import { getCfpService } from "@/services/cfps";
import { AuthRequiredError } from "@/services/errors";
import { DEFAULT_CFP_PERMISSIONS, type CfpManager, type CfpPermissions } from "@/types/cfp";
import type { PoolReviewer } from "@/types/chair";
import { ScheduledEmailsPanel } from "./scheduled-emails-panel";

/* CFP Managers and Add a CFP Manager (the prototype's CFPManagersPage and AddCFPManagerPage): who helps run this Call for Papers and what each may do.
   A manager is a member of the conference with the role CFP manager (`conference_members`); the three permissions (Edit, Publish, Update managers)
   are kept with the member and checked by the database (migration 0045: publishing and closing, editing the CFP, and adding / removing managers).
   "Add from PC" lists the conference's reviewer committee. Adding invites them: they accept on their dashboard, and the email says how.
   "Organization admins" has nothing in the database yet, so it is drawn but off. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const FIELD = "w-full rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:border-primary";
const LABEL = "mb-1.5 block text-xs font-semibold text-ink-soft";
const PERMISSIONS: Array<{ key: keyof CfpPermissions; label: string; desc: string }> = [
  { key: "edit", label: "Edit", desc: "Edit the CFP metadata and content, change the theme, upload the logo" },
  { key: "publish", label: "Publish", desc: "Publish the CFP on the Smartconferu server" },
  { key: "updateManagers", label: "Update managers", desc: "Add/delete all managers and edit their information and permissions" },
];
const split = (full: string) => { const parts = full.trim().split(/\s+/).filter(Boolean); return parts.length <= 1 ? { first: full.trim(), last: "" } : { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] }; };

interface Row { id: string; first: string; last: string; email: string; permissions: CfpPermissions }
function Success({ title, text, button, onClick }: { title: string; text: string; button: string; onClick: () => void }) {
  return (
    <div className="flex items-center justify-center p-8" style={{ minHeight: "60vh" }}>
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft"><Check size={28} strokeWidth={2.5} aria-hidden="true" className="text-success" /></div>
        <h2 className="mb-2 text-lg font-bold text-navy">{title}</h2>
        <p className="mb-6 text-sm text-ink-muted">{text}</p>
        <Button onClick={onClick}>{button}</Button>
      </div>
    </div>
  );
}
function Box({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="h-4 w-4 cursor-pointer rounded accent-[var(--primary)]" />;
}

export function ManagersPanel({ slug, acronym, managers, onAdd, onDone, onChanged, onSessionEnded }: { slug: string; acronym: string; managers: CfpManager[]; onAdd: () => void; onDone: () => void; onChanged: () => void; onSessionEnded: () => void }) {
  const [rows, setRows] = useState<Row[]>(() => managers.map((m) => ({ id: m.id, ...(({ first, last }) => ({ first, last }))(split(m.name)), email: m.email, permissions: { ...m.permissions } })));
  const [removed, setRemoved] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (id: string, patch: Partial<Row>) => setRows((l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const toggle = (id: string, key: keyof CfpPermissions) => setRows((l) => l.map((r) => (r.id === id ? { ...r, permissions: { ...r.permissions, [key]: !r.permissions[key] } } : r)));
  const remove = (id: string) => { setRows((l) => l.filter((r) => r.id !== id)); setRemoved((l) => [...l, id]); };
  const save = async () => {
    setBusy(true); setError("");
    try {
      await (await getCfpService()).saveManagers(slug, rows.map((r) => ({ id: r.id, name: `${r.first} ${r.last}`.trim(), permissions: r.permissions })), removed);
      setSaved(true); onChanged();
    } catch (e) { if (e instanceof AuthRequiredError) onSessionEnded(); else setError(e instanceof Error ? e.message : "Couldn't save the managers."); } finally { setBusy(false); }
  };
  if (saved) return <Success title="Managers updated" text={`Your changes to ${acronym}'s manager list have been saved.`} button="Back to Overview" onClick={onDone} />;
  const cell = "w-full rounded-md border border-transparent px-2 py-1 text-sm font-medium text-ink outline-none transition-colors hover:border-line focus:border-primary";
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div style={{ border: "1px solid var(--primary-soft-border)" }} className="flex items-start gap-2.5 rounded-xl bg-primary-soft px-4 py-3">
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-[#1E4E8C]">Grant or revoke permissions by ticking the boxes below, or edit a name directly in the table. Click &quot;Save Changes&quot; when you&apos;re done.</p>
      </div>
      <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3 pt-5">
          <h2 className="flex items-center gap-2.5 text-[15px] font-extrabold text-navy"><User size={16} aria-hidden="true" className="text-primary" /> List of Managers</h2>
          <button type="button" onClick={onAdd} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover"><Plus size={14} aria-hidden="true" /> Add Manager</button>
        </div>
        <div className="overflow-x-auto">
          <table className="ui-table w-full text-sm" style={{ tableLayout: "fixed", minWidth: 820 }}>
            <colgroup><col style={{ width: "15%" }} /><col style={{ width: "15%" }} /><col style={{ width: "21%" }} /><col style={{ width: "11%" }} /><col style={{ width: "11%" }} /><col style={{ width: "11%" }} /><col style={{ width: "11%" }} /><col style={{ width: "5%" }} /></colgroup>
            <thead>
              <tr className="border-y border-line bg-canvas">
                <th className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold text-ink-muted">First Name</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-ink-muted">Last Name</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-ink-muted">Email</th>
                {PERMISSIONS.map((p) => <th key={p.key} className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold text-ink-muted">{p.label}</th>)}
                <th className="px-3 py-3"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={m.id} className={i < rows.length - 1 ? "border-b border-muted" : ""}>
                  <td className="px-5 py-2.5"><input aria-label={`First name of ${m.first} ${m.last}`} value={m.first} onChange={(e) => update(m.id, { first: e.target.value })} className={cell} /></td>
                  <td className="px-4 py-2.5"><input aria-label={`Last name of ${m.first} ${m.last}`} value={m.last} onChange={(e) => update(m.id, { last: e.target.value })} className={cell} /></td>
                  <td className="overflow-hidden px-4 py-2.5"><span className="block truncate text-sm text-ink-muted">{m.email}</span></td>
                  {PERMISSIONS.map((p) => <td key={p.key} className="px-3 py-2.5 text-center"><Box checked={m.permissions[p.key]} onChange={() => toggle(m.id, p.key)} label={`${p.label} for ${m.first} ${m.last}`} /></td>)}
                  <td className="px-3 py-2.5 text-center"><button type="button" onClick={() => remove(m.id)} aria-label={`Remove ${m.first} ${m.last}`} className="cursor-pointer text-ink-faint transition-colors hover:text-danger"><Trash2 size={14} aria-hidden="true" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="py-10 text-center">
              <User size={26} aria-hidden="true" className="mx-auto mb-2 text-line-strong" />
              <p className="text-sm text-ink-faint">No managers yet — add one to help run this CFP.</p>
            </div>
          )}
        </div>
      </div>
      <div style={CARD} className="rounded-2xl bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-extrabold text-navy"><ShieldCheck size={16} aria-hidden="true" className="text-primary" /> Permissions</h2>
        <div className="space-y-2.5">
          {PERMISSIONS.map((p, i) => <div key={p.key} className="flex items-baseline gap-2 text-sm"><span className="shrink-0 font-bold text-primary">{i + 1}.</span><span className="text-ink"><strong>{p.label}:</strong> <span className="text-ink-muted">{p.desc}</span></span></div>)}
        </div>
      </div>
      <div style={CARD} className="rounded-2xl bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-extrabold text-navy"><Building2 size={16} aria-hidden="true" className="text-primary" /> Organization admins</h2>
        <p className="-mt-2 mb-3 text-xs text-ink-faint">Org admins can create conferences and manage the team for every conference an organization runs. Not available yet — Smartconferu does not keep organizations.</p>
        <div className="flex items-center gap-2">
          <input disabled aria-label="Organization admin's email" type="email" placeholder="colleague@university.edu" className={`${FIELD} flex-1 opacity-60`} />
          <button type="button" disabled className="cursor-not-allowed rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white opacity-50">Invite</button>
        </div>
      </div>
      <ScheduledEmailsPanel slug={slug} title="Team emails sent automatically" desc="Follow-ups the system sends after you invite someone to the team." keys={["teamInviteReminder", "teamMemberJoined"]} />
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      <div className="flex items-center justify-between pb-4 pt-1">
        <Button variant="outline" onClick={onDone} disabled={busy}>Cancel</Button>
        <Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save Changes"}</Button>
      </div>
    </div>
  );
}

interface AddProps { slug: string; acronym: string; confName: string; managers: CfpManager[]; onDone: () => void; onAdded: () => void; onSessionEnded: () => void }

export function AddManagerPanel({ slug, acronym, confName, managers, onDone, onAdded, onSessionEnded }: AddProps) {
  const [mode, setMode] = useState<"manual" | "pc">("manual");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", subject: `CFP Manager for ${confName}`, message: "" });
  const [perms, setPerms] = useState<CfpPermissions>({ ...DEFAULT_CFP_PERMISSIONS });
  const [pool, setPool] = useState<PoolReviewer[] | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [pcPerms, setPcPerms] = useState<Record<string, CfpPermissions>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [added, setAdded] = useState(0);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (mode !== "pc" || pool) return undefined;
    let cancelled = false;
    getChairService().then((c) => c.loadReviewerPool(slug)).then((p) => { if (!cancelled) setPool(p.reviewers.filter((r) => r.status !== "declined")); }).catch(() => { if (!cancelled) { setPool([]); setError("Couldn't load the program committee."); } });
    return () => { cancelled = true; };
  }, [mode, pool, slug]);

  const have = new Set(managers.map((m) => m.email.toLowerCase()));
  const candidates = (pool ?? []).filter((r) => r.email && !have.has(r.email.toLowerCase()));
  const permsOf = (id: string) => pcPerms[id] ?? DEFAULT_CFP_PERMISSIONS;
  const chosen = candidates.filter((c) => picked[c.memberId]);

  const run = async (people: Array<{ firstName: string; lastName: string; email: string; permissions: CfpPermissions }>) => {
    setBusy(true); setError("");
    try {
      const svc = await getCfpService();
      let last: string | null = null;
      for (const p of people) {
        const id = await svc.addManager(slug, p);
        last = (await sendActionEmails("cfp_manager_invited", { memberId: id, subject: form.subject.trim(), message: form.message.trim() })) ?? last;
      }
      setNotice(last); setAdded(people.length); onAdded();
    } catch (e) { if (e instanceof AuthRequiredError) onSessionEnded(); else setError(e instanceof Error ? e.message : "Couldn't add the manager."); } finally { setBusy(false); }
  };
  const addOne = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !/^\S+@\S+\.\S+$/.test(form.email.trim())) { setError("Please fill in first name, last name and a valid email."); return; }
    void run([{ firstName: form.firstName, lastName: form.lastName, email: form.email, permissions: perms }]);
  };
  const addFromPc = () => {
    if (!chosen.length) { setError("Select at least one Program Committee member to add."); return; }
    void run(chosen.map((c) => { const s = split(c.name); return { firstName: s.first, lastName: s.last || s.first, email: c.email, permissions: permsOf(c.memberId) }; }));
  };

  if (added > 0) {
    return <Success title={added > 1 ? `${added} managers added` : "Manager added"} text={notice ?? (added > 1 ? `${added} new managers can now help run ${acronym}'s CFP.` : `They'll receive an email with instructions on how to log in and manage ${acronym}'s CFP.`)} button="Back to Managers" onClick={onDone} />;
  }
  const tab = (key: "manual" | "pc", icon: React.ReactNode, text: string) => (
    <button type="button" onClick={() => { setMode(key); setError(""); }} aria-pressed={mode === key} className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${mode === key ? "bg-navy text-white" : "text-ink-muted"}`}>{icon} {text}</button>
  );
  const permBox = (p: CfpPermissions, onToggle: (k: keyof CfpPermissions) => void, label: string) => (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
      {PERMISSIONS.map((x) => <label key={x.key} className="flex cursor-pointer items-center gap-2 text-sm text-ink"><Box checked={p[x.key]} onChange={() => onToggle(x.key)} label={`${x.label} ${label}`} /> {x.label}</label>)}
    </div>
  );
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div style={CARD} className="flex w-fit items-center gap-1 rounded-2xl bg-white p-1.5">
        {tab("manual", <User size={14} aria-hidden="true" />, "Add one manager")}
        {tab("pc", <GitMerge size={14} aria-hidden="true" />, "Add from PC")}
      </div>
      {mode === "manual" ? (
        <div style={CARD} className="space-y-3.5 rounded-2xl bg-white p-6">
          <h2 className="mb-1 flex items-center gap-2.5 text-[15px] font-extrabold text-navy"><User size={16} aria-hidden="true" className="text-primary" /> Manager details</h2>
          <div className="grid grid-cols-2 gap-3.5">
            <div><label htmlFor="mg-first" className={LABEL}>First name *</label><input id="mg-first" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} maxLength={100} className={FIELD} /></div>
            <div><label htmlFor="mg-last" className={LABEL}>Last name *</label><input id="mg-last" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} maxLength={100} className={FIELD} /></div>
          </div>
          <div><label htmlFor="mg-email" className={LABEL}>Email *</label><input id="mg-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={254} className={FIELD} /></div>
          <div><span className={LABEL}>Permissions</span>{permBox(perms, (k) => setPerms((p) => ({ ...p, [k]: !p[k] })), "permission")}</div>
          <div><label htmlFor="mg-subject" className={LABEL}>Email subject</label><input id="mg-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} maxLength={300} className={FIELD} /></div>
          <div><label htmlFor="mg-message" className={LABEL}>Message <span className="font-normal text-ink-faint">(optional)</span></label><textarea id="mg-message" rows={3} value={form.message} onChange={(e) => set("message", e.target.value)} maxLength={3000} placeholder="Add a personal note to the invitation" className={`${FIELD} resize-none`} /></div>
        </div>
      ) : (
        <div style={CARD} className="space-y-3.5 rounded-2xl bg-white p-6">
          <h2 className="mb-1 flex items-center gap-2.5 text-[15px] font-extrabold text-navy"><GitMerge size={16} aria-hidden="true" className="text-primary" /> Program Committee</h2>
          <p className="text-xs text-ink-faint">Members of this conference&apos;s program committee who are not CFP managers yet. Each gets their own permissions.</p>
          {pool === null ? <div role="status" aria-label="Loading the program committee" className="h-24 animate-pulse rounded-xl border border-line bg-canvas" /> : candidates.length === 0 ? (
            <p className="rounded-lg bg-canvas px-3 py-4 text-center text-sm text-ink-faint">Everyone on the program committee is already a manager, or the committee is empty.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <button type="button" onClick={() => setPicked(Object.fromEntries(candidates.map((c) => [c.memberId, true])))} className="cursor-pointer text-primary hover:underline">Select all</button>
                <button type="button" onClick={() => setPicked({})} className="cursor-pointer text-ink-muted hover:underline">Select none</button>
                <span className="ml-auto text-ink-faint">{chosen.length} selected</span>
              </div>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {candidates.map((c) => (
                  <li key={c.memberId} className="space-y-2 px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-3"><Box checked={Boolean(picked[c.memberId])} onChange={() => setPicked((s) => ({ ...s, [c.memberId]: !s[c.memberId] }))} label={`Select ${c.name}`} /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{c.name}</span><span className="block truncate text-xs text-ink-faint">{c.email}</span></span></label>
                    {picked[c.memberId] && <div className="pl-7">{permBox(permsOf(c.memberId), (k) => setPcPerms((m) => ({ ...m, [c.memberId]: { ...permsOf(c.memberId), [k]: !permsOf(c.memberId)[k] } })), `for ${c.name}`)}</div>}
                  </li>
                ))}
              </ul>
              <div><label htmlFor="pc-subject" className={LABEL}>Email subject</label><input id="pc-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} maxLength={300} className={FIELD} /></div>
            </>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      <div className="flex items-center justify-between pb-4 pt-1">
        <Button variant="outline" onClick={onDone} disabled={busy}>Cancel</Button>
        {mode === "manual"
          ? <Button onClick={addOne} disabled={busy}><Plus size={14} aria-hidden="true" /> {busy ? "Adding…" : "Add Manager"}</Button>
          : <Button onClick={addFromPc} disabled={busy || chosen.length === 0}><Plus size={14} aria-hidden="true" /> {busy ? "Adding…" : chosen.length > 1 ? `Add ${chosen.length} managers` : "Add Manager"}</Button>}
      </div>
    </div>
  );
}
