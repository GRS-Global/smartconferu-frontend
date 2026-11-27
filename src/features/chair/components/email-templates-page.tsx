"use client";

import { Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { Switch } from "@/components/ui/switch";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { getChairService } from "@/services/chair";
import { AuthRequiredError } from "@/services/errors";
import type { ConferenceTemplate, EmailTemplates, PlatformTemplate } from "@/types/chair";
import { useEmailTemplates } from "../use-email-templates";
import { EmailTemplateEditor } from "./email-template-editor";

/* Conference Settings › Email Templates (the prototype's EmailTemplatesPane): tabs by where an email comes in (All, one per module,
   Custom), every email a card — its name, how it is sent (Automatic / Chair action / Scheduled reminder), an on / off switch, when it goes
   out, who gets it and the start of its subject, with a pencil to edit — and the "Sections" rail to jump to one. The platform's defaults are
   \`email_templates\`; the conference's own copy is \`conference_email_templates\` (made on the first change; the real emails use it;
   "Reset to default" removes it); custom emails (key \`custom:<id>\`) live in the same table. The text is edited as the email's HTML with
   merge fields and a sandboxed preview; the prototype's rich-text editor (CKEditor) is not ported. Reads "No email templates yet" until
   migration 0005_email_templates.sql is run. The same pane is the Templates tab of Email Communication (\`authorOnly\`). */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const MODULES: Array<[string, string]> = [["account", "Account & security"], ["team", "Organization & team"], ["setup", "Conference setup"], ["submission", "Call for Papers & submission"], ["recruitment", "Reviewer recruitment"], ["reviewing", "Review assignment & reviewing"], ["decision", "Decision"], ["after", "Registration & camera-ready"]];
const SEND_TYPES: Record<string, { label: string; cls: string }> = {
  auto: { label: "Automatic", cls: "bg-success-soft text-success-ink" },
  chair: { label: "Chair action", cls: "bg-primary-soft text-primary" },
  scheduled: { label: "Scheduled reminder", cls: "bg-warning-soft text-warning-ink" },
  bulk: { label: "Bulk / manual", cls: "bg-muted text-ink-soft" },
};
const tokensOf = (...texts: string[]) => [...new Set(texts.flatMap((t) => [...t.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1])))];
const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

interface Editing { rev?: number; key: string; label: string; custom: boolean; isNew: boolean; subject: string; body: string; enabled: boolean; hasCopy: boolean; fields: string[]; def: PlatformTemplate | null }

/** The tabs, cards, rail and dialogs. `authorOnly` shows only the author-facing emails (Email Communication › Email Templates). */
export function EmailTemplatesPane({ slug, conferenceName, conferenceAcronym, templates, reload, authorOnly = false, openKey, back }: { slug: string; conferenceName: string; conferenceAcronym: string; templates: EmailTemplates; reload: () => void; authorOnly?: boolean; /** Where "Back to …" leads (the page whose "Edit template" opened this). */ back?: { href: string; label: string } | null; /** A template to open in its editor at once (from "Edit template" on the review settings). */ openKey?: string }) {
  const [tab, setTab] = useState("all");
  const [flash, setFlash] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [edit, setEdit] = useState<Editing | null>(null);
  const [del, setDel] = useState<{ key: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<FlowToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);


  const platform = templates.platform.filter((t) => t.module !== "account" && (!authorOnly || t.role === "author"));
  const customs = Object.values(templates.mine).filter((t) => t.custom);
  const effective = (t: PlatformTemplate): ConferenceTemplate => templates.mine[t.key] ?? { key: t.key, label: t.label, enabled: true, subject: t.subject, body: t.body, custom: false };
  const mods = MODULES.map(([key, label]) => ({ key, label, list: platform.filter((t) => t.module === key) })).filter((m) => m.list.length);
  const shownMods = tab === "all" ? mods : tab === "custom" ? [] : mods.filter((m) => m.key === tab);
  const showCustoms = tab === "all" || tab === "custom";
  const total = platform.length + customs.length;

  const run = async (job: () => Promise<void>, done: FlowToastData): Promise<boolean> => {
    setBusy(true); setError("");
    try { await job(); setToast(done); reload(); return true; } catch (e) {
      setError(e instanceof AuthRequiredError ? "Your session ended — please sign in again." : e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally { setBusy(false); }
  };
  const openPlatform = (t: PlatformTemplate) => { const c = effective(t); setEdit({ key: t.key, label: t.label, custom: false, isNew: false, subject: c.subject, body: c.body, enabled: c.enabled, hasCopy: Boolean(templates.mine[t.key]), fields: tokensOf(t.subject, t.body), def: t }); setError(""); };
  const opened = useRef("");
  useEffect(() => {
    if (!openKey || opened.current === openKey) return;
    const t = templates.platform.find((x) => x.key === openKey);
    opened.current = openKey;
    // Opening the editor the page was asked for is the effect: the dialog is state, set once on arrival.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t) { openPlatform(t); requestAnimationFrame(() => document.getElementById(`et-${t.key}`)?.scrollIntoView({ block: "center" })); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, templates]);
  const openCustom = (t: ConferenceTemplate) => { setEdit({ key: t.key, label: t.label, custom: true, isNew: false, subject: t.subject, body: t.body, enabled: t.enabled, hasCopy: true, fields: [], def: null }); setError(""); };
  const openNew = () => { setEdit({ key: `custom:${Date.now().toString(36)}`, label: "", custom: true, isNew: true, subject: "", body: "<p>Hi {{first_name}},</p><p></p>", enabled: true, hasCopy: false, fields: [], def: null }); setError(""); };
  const toggle = (t: PlatformTemplate, on: boolean) => { const c = effective(t); void run(() => getChairService().then((s) => s.saveEmailTemplate(slug, { ...c, label: t.label, enabled: on })), { title: on ? "Email turned on" : "Email turned off", text: `${t.label} ${on ? "is sent" : "is not sent"} for this conference.` }); };
  const toggleCustom = (t: ConferenceTemplate, on: boolean) => { void run(() => getChairService().then((s) => s.saveEmailTemplate(slug, { ...t, enabled: on })), { title: on ? "Email turned on" : "Email turned off", text: `${t.label || "Untitled Email"} is ${on ? "available" : "hidden"} in Send Email.` }); };
  const save = async () => {
    if (!edit) return;
    if (edit.custom && !edit.label.trim()) { setError("Give this email a name."); return; }
    if (!edit.subject.trim()) { setError("The email needs a subject."); return; }
    if (await run(() => getChairService().then((s) => s.saveEmailTemplate(slug, { key: edit.key, label: edit.custom ? edit.label.trim() : edit.label, enabled: edit.enabled, subject: edit.subject.trim(), body: edit.body, custom: edit.custom })), { title: "Email saved", text: `${edit.label || "The email"} was saved for this conference.` })) setEdit((e) => (e ? { ...e, hasCopy: true, isNew: false } : e));
  };
  const reset = async () => {
    if (!edit || edit.custom) return;
    if (await run(() => getChairService().then((s) => s.deleteEmailTemplate(slug, edit.key)), { title: "Back to the default", text: `${edit.label} uses the platform's text again.` })) setEdit((e) => (e && e.def ? { ...e, subject: e.def.subject, body: e.def.body, enabled: true, hasCopy: false, rev: (e.rev ?? 0) + 1 } : null));
  };
  const removeCustom = async () => {
    if (!del) return;
    if (await run(() => getChairService().then((s) => s.deleteEmailTemplate(slug, del.key)), { title: "Email deleted", text: `${del.label || "The email"} was deleted.` })) setDel(null);
  };
  const TONE: Record<string, { color: string; bg: string }> = { auto: { color: "var(--success-ink)", bg: "var(--success-soft)" }, chair: { color: "var(--primary)", bg: "var(--primary-soft)" }, scheduled: { color: "var(--warning-ink)", bg: "var(--warning-soft)" }, bulk: { color: "var(--secondary)", bg: "var(--secondary-soft)" } };
  const jumpTo = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); setFlash(id); setTimeout(() => setFlash((f) => (f === id ? null : f)), 1600); };
  const card = (id: string, label: string, pillKey: string, when: string, to: string, enabled: boolean, subject: string, onToggle: (v: boolean) => void, onEdit: () => void, extra?: React.ReactNode, custom = false) => {
    const st = SEND_TYPES[pillKey] ?? { label: pillKey, cls: "" };
    const tone = TONE[pillKey] ?? TONE.chair;
    const tile = custom ? { color: "var(--ink-muted)", bg: "var(--muted)" } : { color: "var(--primary)", bg: "var(--primary-soft)" };
    const [main, ...also] = to.split(" · ");
    const flashing = flash === id;
    return (
      <div key={id} id={id} data-tour={shownMods[0]?.list[0] && id === `et-${shownMods[0].list[0].key}` ? "et-first-card" : undefined} style={{ border: `1px solid ${flashing ? "var(--primary)" : "var(--border)"}`, boxShadow: flashing ? "0 0 0 4px var(--primary-soft), var(--shadow-card)" : "var(--shadow-card)", scrollMarginTop: 88 }} className="flex flex-col rounded-2xl bg-white p-5 transition-shadow duration-500">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span style={{ background: tile.bg, color: tile.color }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"><Mail size={16} aria-hidden="true" /></span>
            <div className="min-w-0"><span className="block truncate text-sm font-bold text-navy">{label}</span>{st.label && <span style={{ background: tone.bg, color: tone.color }} className="mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold">{st.label}</span>}</div>
          </div>
          <Switch label={`${label} on or off`} checked={enabled} onChange={onToggle} disabled={busy} />
        </div>
        <div className="mb-3 mt-3 flex-1 space-y-1 text-[11.5px] leading-relaxed text-ink-muted">
          {when && <div><span className="font-semibold text-ink-faint">When:</span> {when}</div>}
          {to && <div><span className="font-semibold text-ink-faint">To:</span> {main}{also.length > 0 && <span className="text-ink-faint"> · also {also.join(", ")}</span>}</div>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-muted pt-3">
          <div className="min-w-0 truncate text-[11px] text-ink-faint" title={subject}>{subject}</div>
          <div className="flex shrink-0 items-center gap-2">{extra}<button type="button" onClick={onEdit} aria-label={`Edit ${label}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:border-[var(--primary-soft-border)] hover:text-primary"><Pencil size={13} aria-hidden="true" /></button></div>
        </div>
      </div>
    );
  };

  const tabs: Array<[string, string, number]> = [["all", "All", total], ...mods.map((m): [string, string, number] => [m.key, m.label, m.list.length]), ["custom", "Custom", customs.length]];
  const visibleGroups = [
    ...shownMods.map((m) => ({ id: `et-${m.key}`, label: m.label, cards: m.list.map((t) => ({ id: `et-${t.key}`, name: t.label, enabled: effective(t).enabled })) })),
    ...(showCustoms && customs.length ? [{ id: "et-custom", label: "Custom emails", cards: customs.map((t) => ({ id: `et-${t.key}`, name: t.label || "Untitled Email", enabled: t.enabled })) }] : []),
  ];
  const visibleCount = visibleGroups.reduce((n, g) => n + g.cards.length, 0);
  const current = activeGroup ?? visibleGroups[0]?.id ?? "";

  if (edit) {
    const def = edit.def;
    return (
      <>
        <EmailTemplateEditor edit={edit} setEdit={setEdit} moduleLabel={MODULES.find(([k]) => k === def?.module)?.[1] ?? ""} sendLabel={SEND_TYPES[def?.sendType ?? ""]?.label ?? ""} conferenceName={conferenceName} acronym={conferenceAcronym} back={back ?? null} busy={busy} error={error} onSave={() => void save()} onReset={() => void reset()} onDelete={() => { setDel({ key: edit.key, label: edit.label }); setEdit(null); }} onClose={() => { if (!busy) { setEdit(null); setError(""); } }} />
        <FlowToast toast={toast} onClose={closeToast} />
      </>
    );
  }
  return (
    <>
      {error && !edit && !del && <p role="alert" className="mb-3 text-sm font-semibold text-danger-ink">{error}</p>}
      {templates.platform.length === 0 ? (
        <div style={CARD} className="rounded-2xl bg-white p-8 text-center text-sm text-ink-muted">No email templates yet. Run <code>supabase/migrations/0005_email_templates.sql</code> and they appear here.</div>
      ) : (
        <div>
          {/* Toolbar: the module filter (or, in Email Communication, a note) + Create Custom Email. */}
          <div className="mb-6 flex flex-wrap items-start gap-3">
            {authorOnly ? (
              <p className="min-w-[260px] flex-1 self-center text-sm text-ink-muted">Templates for the submission lifecycle — author-facing emails plus any custom drafts.</p>
            ) : (
              <div data-tour="et-tabs" role="tablist" aria-label="Filter email templates by module" style={CARD} className="flex min-w-[260px] flex-1 flex-wrap items-center gap-1.5 rounded-2xl bg-white p-1.5">
                {tabs.map(([k, l, n]) => (
                  <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ background: tab === k ? "var(--navy)" : "transparent", color: tab === k ? "#FFFFFF" : "var(--ink-soft)" }} className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-[13px] font-semibold transition-colors ${tab === k ? "" : "hover:bg-canvas hover:text-navy"}`}>
                    {l}
                    <span style={{ background: tab === k ? "rgba(255,255,255,0.18)" : "var(--primary-soft)", color: tab === k ? "#FFFFFF" : "var(--primary)" }} className="min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-extrabold">{n}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" data-tour="et-create" onClick={openNew} disabled={busy} style={{ border: "1.5px dashed var(--primary-soft-border)" }} className="flex h-[52px] shrink-0 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-primary transition-colors hover:bg-primary-soft disabled:opacity-50"><Plus size={16} aria-hidden="true" /> Create Custom Email</button>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-8">
              {shownMods.map((m) => (
                <section key={m.key} id={`et-${m.key}`} style={{ scrollMarginTop: 88 }}>
                  <div className="mb-3 flex items-center gap-2"><h3 className="text-sm font-bold text-navy">{m.label}</h3><span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-extrabold text-ink-muted">{m.list.length}</span></div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {m.list.map((t) => { const c = effective(t); return card(`et-${t.key}`, t.label, t.sendType, t.trigger, t.recipients, c.enabled, plain(c.subject) || t.label, (v) => toggle(t, v), () => openPlatform(t)); })}
                  </div>
                </section>
              ))}
              {showCustoms && (
                <section id="et-custom" style={{ scrollMarginTop: 88 }}>
                  <div className="mb-3 flex items-center gap-2"><h3 className="text-sm font-bold text-navy">Custom emails</h3><span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-extrabold text-ink-muted">{customs.length}</span></div>
                  {customs.length === 0 ? <p style={{ border: "1.5px dashed var(--border)" }} className="rounded-2xl p-10 text-center text-sm text-ink-faint">No custom emails yet. Create one and pick it from Send Email.</p> : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {customs.map((t) => card(`et-${t.key}`, t.label || "Untitled Email", "bulk", "Chair sends it from Send Email", "Chosen audience", t.enabled, t.subject || "No subject yet", (v) => toggleCustom(t, v), () => openCustom(t), <button type="button" onClick={() => { setError(""); setDel({ key: t.key, label: t.label }); }} aria-label={`Delete ${t.label}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger-ink"><Trash2 size={13} aria-hidden="true" /></button>, true))}
                    </div>
                  )}
                </section>
              )}
              {visibleCount === 0 && <div style={{ border: "1.5px dashed var(--border)" }} className="rounded-2xl p-10 text-center"><p className="text-sm text-ink-faint">No emails in this category yet.</p></div>}
            </div>

            {/* "Sections": each module and its emails; click to jump down to it. */}
            {visibleGroups.length > 0 && (
              <nav aria-label="Email template sections" style={CARD} className="sticky top-20 hidden max-h-[calc(100vh-104px)] flex-col overflow-hidden rounded-2xl bg-white xl:flex">
                <div className="shrink-0 border-b border-muted px-4 py-3.5"><h4 className="text-xs font-bold text-navy">Sections</h4><p className="mt-0.5 text-[11px] text-ink-muted">{visibleCount} email{visibleCount === 1 ? "" : "s"} · click to jump to one</p></div>
                <div className="overflow-y-auto overscroll-contain p-2">
                  {visibleGroups.map((g) => {
                    const active = current === g.id;
                    return (
                      <div key={g.id} className="mb-1 last:mb-0">
                        <button type="button" onClick={() => { setActiveGroup(g.id); jumpTo(g.id); }} aria-current={active ? "location" : undefined} style={{ background: active ? "var(--primary-soft)" : "transparent", color: active ? "var(--primary)" : "var(--navy)" }} className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold transition-colors ${active ? "" : "hover:bg-canvas"}`}>
                          <span className="truncate">{g.label}</span>
                          <span style={{ background: active ? "#FFFFFF" : "var(--muted)", color: active ? "var(--primary)" : "var(--ink-muted)" }} className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold">{g.cards.length}</span>
                        </button>
                        <ul style={{ borderLeft: `2px solid ${active ? "var(--primary-soft-border)" : "var(--muted)"}` }} className="mb-1.5 ml-3.5 mt-0.5 pl-1.5">
                          {g.cards.map((c) => (
                            <li key={c.id}>
                              <button type="button" onClick={() => { setActiveGroup(g.id); jumpTo(c.id); }} title={c.name} style={{ color: flash === c.id ? "var(--primary)" : "var(--ink-soft)" }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-canvas hover:text-navy">
                                <span aria-label={c.enabled ? "Enabled" : "Disabled"} style={{ background: c.enabled ? "var(--success)" : "var(--border-strong)" }} className="h-1.5 w-1.5 shrink-0 rounded-full" />
                                <span className="truncate">{c.name}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </nav>
            )}
          </div>
        </div>
      )}

      <Dialog open={del !== null} onClose={() => { if (!busy) setDel(null); }} title="Delete this email?" size="md">
        {del && (<><p className="text-sm text-ink-soft"><b className="text-navy">{del.label || "Untitled Email"}</b> is deleted for this conference.</p>{error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setDel(null)} disabled={busy}>Cancel</Button><Button className="bg-danger hover:bg-danger" onClick={() => void removeCustom()} disabled={busy}><Trash2 size={14} aria-hidden="true" /> {busy ? "Deleting…" : "Delete"}</Button></div></>)}
      </Dialog>
      <FlowToast toast={toast} onClose={closeToast} />
    </>
  );
}

export function EmailTemplatesPage({ slug }: { slug: string }) {
  const { state, retry, reload } = useEmailTemplates(slug);
  const asked = useSearchParams();
  const gate = workspaceGate(state, retry, { title: "Email Templates", loadingLabel: "Loading the email templates", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the email templates." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others, screening, templates } = state;
  // Opened from a settings page's "Edit template": go straight to that email and offer the way back (only to a page of this app).
  const back = asked.get("back") ?? "";
  const backOk = back.startsWith("/chair/") && !back.startsWith("//");
  const backLabel = (asked.get("backLabel") ?? "").slice(0, 60) || "where you were";
  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="settings/email-templates" screening={screening}>
      <PageHeader title="Email Templates" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }, { label: "Conference Settings" }, { label: "Email Templates", strong: true }]} />
      <div className="hd-page p-8"><EmailTemplatesPane slug={slug} conferenceName={conference.name} conferenceAcronym={conference.acronym} templates={templates} reload={reload} openKey={asked.get("template") ?? undefined} back={backOk ? { href: back, label: backLabel } : null} /></div>
    </ConferenceShell>
  );
}
