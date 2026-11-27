"use client";
/* Super Admin › Email Templates (the prototype's EmailTemplatesPage, database mode): the platform's
   default emails. Every conference gets its own copy when it is approved, which its chairs can
   change, so an edit here applies to conferences approved from now on. Edited as plain text,
   sent as HTML (the prototype's emailText.js). */
import { useMemo, useState } from "react";
import { Mail, Search, Send } from "lucide-react";
import { emailPreviewDoc, emailSubject } from "@/features/chair/email-preview";
import { useAdmin } from "../session";
import { loadEmailTemplates, saveEmailTemplate, testEmailTemplate, type EmailTemplate } from "../services";
import { useData } from "../use-data";
import { Badge, Button, Card, errorText, Failed, Loading, PageTitle, Toast, type Tone } from "./ui";

const htmlToText = (html: string) =>
  html
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/p>\s*<p>/g, "\n\n")
    .replace(/<[^>]+>/g, "")
    .trim();
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const textToHtml = (text: string) =>
  text
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
const varsOf = (...texts: string[]) => [...new Set(texts.join(" ").match(/{{\s*\w+\s*}}/g)?.map((v) => v.replace(/[{}\s]/g, "")) ?? [])];
// How each email goes out (the prototype's EMAIL_SEND_TYPES), and its badge colour.
const SEND_TYPES: Record<string, [string, Tone]> = { auto: ["Automatic", "primary"], chair: ["Chair action", "secondary"], scheduled: ["Scheduled reminder", "warning"], bulk: ["Bulk / manual", "neutral"] };
const MODULE_LABEL = (m: string | null) => (m ? m.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Other");

function TemplateEditor({ template, onSaved }: { template: EmailTemplate; onSaved: (t: EmailTemplate, toast: string) => void }) {
  const { me } = useAdmin();
  const initial = { subject: template.subject, body: htmlToText(template.body) };
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = subject !== initial.subject || body !== initial.body;
  const vars = varsOf(template.subject, template.body);
  const preview = emailPreviewDoc(subject, textToHtml(body), "International Conference X 2027", "ICX 2027");

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      onSaved(await saveEmailTemplate(template.key, { subject: subject.trim(), body: textToHtml(body) }), `“${template.label}” saved`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const test = async () => {
    setBusy("test");
    setError(null);
    try {
      await testEmailTemplate(template.key, { subject, body: textToHtml(body) });
      onSaved(template, `Test sent to ${me.email}: “${emailSubject(subject, "International Conference X 2027", "ICX 2027")}”`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-[17px] font-semibold" style={{ color: "var(--text)" }}>
            {template.label}
          </h3>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {[template.triggerText, template.recipients && `to ${template.recipients}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        {template.sendType && <Badge tone={(SEND_TYPES[template.sendType] ?? [template.sendType, "neutral"])[1]}>{(SEND_TYPES[template.sendType] ?? [template.sendType])[0]}</Badge>}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
              Subject
            </span>
            <input className="sa-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
              Body
            </span>
            <textarea className="sa-input font-mono !text-[12.5px] leading-relaxed" rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          {vars.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>
                Merge fields — click to add
              </p>
              <div className="flex flex-wrap gap-1.5">
                {vars.map((v) => (
                  <button key={v} type="button" onClick={() => setBody((b) => `${b}{{${v}}}`)} className="rounded-md px-2 py-0.5 text-[12px] font-mono" style={{ background: "var(--muted)", color: "var(--text-soft)" }}>{`{{${v}}}`}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>
            Preview with sample values
          </p>
          <iframe title="Email preview" sandbox="" srcDoc={preview} className="w-full h-[460px] rounded-xl" style={{ border: "1px solid var(--border)", background: "#FFFFFF" }} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-[13px] mt-4" style={{ color: "var(--danger-ink)" }}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 mt-6 pt-5 border-t" style={{ borderColor: "var(--border)" }}>
        <Button tone="primary" variant="soft" busy={busy === "test"} onClick={() => void test()}>
          <Send size={15} />
          Send me a test
        </Button>
        <Button disabled={!dirty || !subject.trim()} busy={busy === "save"} onClick={() => void save()}>
          Save template
        </Button>
      </div>
    </Card>
  );
}

export function EmailTemplatesPage() {
  const { data, error, loading, reload, setData } = useData(loadEmailTemplates);
  const [module, setModule] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const all = useMemo(() => data ?? [], [data]);
  const modules = useMemo(() => [...new Set(all.map((t) => t.module ?? ""))], [all]);
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const q = query.toLowerCase();
  const list = all.filter((t) => (module === "all" || (t.module ?? "") === module) && (!q || `${t.label} ${t.triggerText ?? ""} ${t.subject}`.toLowerCase().includes(q)));
  const current = all.find((t) => t.key === selected) ?? list[0] ?? all[0];
  return (
    <>
      <PageTitle title="Email Templates" icon={Mail} />
      <p className="mb-4 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        These are the platform&apos;s default emails. Every conference gets its own copy when it&apos;s approved, which its chairs can change — so an edit here applies to conferences approved from now on.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <Card className="!p-0 overflow-hidden self-start">
          <div className="p-4 flex flex-col gap-2 border-b" style={{ borderColor: "var(--border)" }}>
            <label className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
              <input className="sa-input !pl-9" placeholder="Search emails" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <select className="sa-input" value={module} onChange={(e) => setModule(e.target.value)}>
              <option value="all">All modules ({all.length})</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {MODULE_LABEL(m || null)}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {list.map((t) => (
              <button key={t.key} onClick={() => setSelected(t.key)} className="w-full text-left px-4 py-2.5 border-b" style={{ borderColor: "var(--border)", background: t.key === current?.key ? "var(--primary-soft)" : "#FFFFFF" }}>
                <span className="block text-[13.5px] font-semibold truncate" style={{ color: t.key === current?.key ? "var(--primary)" : "var(--text)" }}>
                  {t.label}
                </span>
                <span className="block text-[12px] truncate" style={{ color: "var(--text-muted)" }}>
                  {t.triggerText ?? t.subject}
                </span>
              </button>
            ))}
            {!list.length && (
              <p className="p-6 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
                No emails match.
              </p>
            )}
          </div>
        </Card>
        {current && (
          <TemplateEditor
            key={`${current.key}-${current.updatedAt ?? ""}`}
            template={current}
            onSaved={(t, text) => {
              setData(all.map((x) => (x.key === t.key ? t : x)));
              setToast(text);
            }}
          />
        )}
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
