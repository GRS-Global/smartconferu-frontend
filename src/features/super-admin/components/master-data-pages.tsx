"use client";
/* Master data (the prototype's CataloguePages.jsx and MasterPages.jsx › ResearchAreasPage), kept in
   the database through the API. Nothing is deleted: societies are deactivated, institutions and
   research areas retired (and can come back). Society logo upload waits for file storage (S3): the
   shipped logos (public/societies/<key>.*) are shown, else the acronym tile. A society's member
   count needs backend work. */
import { useMemo, useState } from "react";
import { Building2, GitMerge, Landmark, Network, Pencil, Plus, Power, RotateCcw, Upload } from "lucide-react";
import { SOCIETIES } from "@/lib/societies";
import {
  createInstitution,
  createResearchArea,
  createSociety,
  loadInstitutions,
  loadResearchAreas,
  loadSocieties,
  mergeInstitution,
  updateInstitution,
  updateResearchArea,
  updateSociety,
  type Institution,
  type PrimaryArea,
  type SecondaryArea,
  type Society,
} from "../services";
import { useData } from "../use-data";
import { Badge, Button, Card, CardTitle, Drawer, errorText, ExtLink, Failed, Loading, PageTitle, SortTh, TextField, Toast, Toolbar, useSort } from "./ui";

const LOGOS = new Map(SOCIETIES.map((s) => [s.id, s.logo]));
const splitList = (text: string) => text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function DrawerFooter({ onCancel, onSave, label, busy, disabled }: { onCancel: () => void; onSave: () => void; label: string; busy: boolean; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <Button tone="neutral" variant="soft" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button onClick={onSave} busy={busy} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}

function FormError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-[12.5px] -mt-2 mb-3" style={{ color: "var(--danger)" }}>
      {error}
    </p>
  ) : null;
}

/** Runs a save, keeps the drawer open with the API's message when it fails. */
function useSave() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, save };
}

function Monogram({ text, logo }: { text: string; logo?: string | null }) {
  if (logo) {
    return (
      <span className="w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0 overflow-hidden border" style={{ borderColor: "var(--border)", background: "#FFFFFF" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" className="max-w-[34px] max-h-[34px] object-contain" />
      </span>
    );
  }
  return (
    <span className="w-10 h-10 rounded-lg inline-flex items-center justify-center text-[10.5px] font-bold shrink-0 text-center leading-tight px-1" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
      {text.slice(0, 7)}
    </span>
  );
}

function FootNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12.5px] mt-3" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

// ---------- Societies ----------

function SocietyDrawer({ society, existing, onClose, onSaved }: { society: Society | "new"; existing: Society[]; onClose: () => void; onSaved: (s: Society, isNew: boolean) => void }) {
  const isNew = society === "new";
  const [form, setForm] = useState({ name: isNew ? "" : society.name, acronym: isNew ? "" : society.acronym, url: isNew ? "" : (society.url ?? "") });
  const { busy, error, save } = useSave();
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const duplicate = existing.some((s) => (isNew || s.id !== society.id) && (norm(s.name) === norm(form.name) || (form.acronym.trim() && s.acronym.toLowerCase() === form.acronym.trim().toLowerCase())));
  const valid = form.name.trim() && form.acronym.trim() && !duplicate;
  const submit = () =>
    void save(async () => {
      const values = { name: form.name.trim(), acronym: form.acronym.trim(), url: form.url.trim() || null };
      onSaved(isNew ? await createSociety(values) : await updateSociety(society.id, values), isNew);
    });
  const logo = isNew ? null : LOGOS.get(society.key);
  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? "Add a society" : `Edit ${society.acronym}`}
      subtitle={isNew ? "It appears in the Memberships dropdown for every member." : "Changes show everywhere this society is used."}
      footer={<DrawerFooter onCancel={onClose} onSave={submit} label={isNew ? "Add society" : "Save changes"} busy={busy} disabled={!valid} />}
    >
      <TextField label="Official name" value={form.name} onChange={set("name")} placeholder="e.g. Indian Society for Technical Education" required />
      <TextField label="Acronym" value={form.acronym} onChange={set("acronym")} placeholder="e.g. ISTE" required />
      {duplicate && <FormError error="A society with this name or acronym is already in the list." />}
      <TextField label="Website" value={form.url} onChange={set("url")} placeholder="https://" />
      <div>
        <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Logo
        </span>
        <div className="flex items-center gap-3">
          <Monogram text={form.acronym || "?"} logo={logo} />
          <span className="inline-flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-[13px] cursor-not-allowed" style={{ borderColor: "var(--border-strong)", color: "var(--text-faint)" }} title="Coming soon">
            <Upload size={15} /> {logo ? "Replace logo" : "Upload logo"}
          </span>
        </div>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>
          Square PNG or SVG. Without one, the acronym tile is shown. Uploading logos is coming soon.
        </p>
      </div>
      <div className="mt-4">
        <FormError error={error} />
      </div>
    </Drawer>
  );
}

export function SocietiesPage() {
  const { data, error, loading, reload, setData } = useData(loadSocieties);
  const [tab, setTab] = useState<"active" | "inactive" | "all">("active");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Society | "new" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const all = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return all.filter((s) => (tab === "all" || s.status === tab) && (!q || `${s.name} ${s.acronym}`.toLowerCase().includes(q))).sort((a, b) => a.acronym.localeCompare(b.acronym));
  }, [all, tab, query]);
  const { sorted, sort, toggle: sortBy } = useSort(rows, {
    society: { get: (s) => s.acronym },
    website: { get: (s) => s.url ?? "" },
    status: { get: (s) => s.status },
  });
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const count = (k: typeof tab) => all.filter((s) => k === "all" || s.status === k).length;
  const th = (label: string, key: string, className?: string) => <SortTh label={label} sortKey={key} sort={sort} onSort={sortBy} className={className} />;
  const replace = (s: Society) => setData([...all.filter((x) => x.id !== s.id), s].sort((a, b) => a.acronym.localeCompare(b.acronym)));
  const toggle = async (s: Society) => {
    try {
      const next = await updateSociety(s.id, { status: s.status === "active" ? "inactive" : "active" });
      replace(next);
      setToast(next.status === "active" ? `${s.acronym} is back in the dropdown` : `${s.acronym} hidden from new memberships`);
    } catch (e) {
      setToast(errorText(e));
    }
  };
  return (
    <>
      <PageTitle title="Societies" icon={Landmark} />
      <Card className="!p-0">
        <Toolbar
          tabs={[
            ["active", "Active", count("active")],
            ["inactive", "Deactivated", count("inactive")],
            ["all", "All", count("all")],
          ]}
          tab={tab}
          setTab={setTab}
          query={query}
          setQuery={setQuery}
          placeholder="Search name or acronym"
          right={
            <Button onClick={() => setEditing("new")} className="shrink-0">
              <Plus size={16} />
              Add
            </Button>
          }
        />
        <div className="overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                {th("Society", "society", "!pl-6")}
                {th("Website", "website")}
                {th("Status", "status")}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} style={s.status === "inactive" ? { opacity: 0.65 } : undefined}>
                  <td className="!pl-6">
                    <div className="flex items-center gap-3">
                      <Monogram text={s.acronym} logo={LOGOS.get(s.key)} />
                      <div className="min-w-0">
                        <p className="font-semibold" style={{ color: "var(--text)" }}>
                          {s.acronym}
                        </p>
                        <p className="text-[12.5px] truncate max-w-[340px]" style={{ color: "var(--text-muted)" }}>
                          {s.name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="text-[13px]">
                    <ExtLink href={s.url} />
                  </td>
                  <td>{s.status === "inactive" ? <Badge tone="neutral">Deactivated</Badge> : <Badge tone="success">Active</Badge>}</td>
                  <td className="pr-6">
                    <div className="flex justify-end gap-1">
                      <button className="sa-icon-btn cursor-pointer" aria-label={`Edit ${s.acronym}`} title="Edit" onClick={() => setEditing(s)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        className="sa-icon-btn cursor-pointer"
                        aria-label={s.status === "inactive" ? `Reactivate ${s.acronym}` : `Deactivate ${s.acronym}`}
                        title={s.status === "inactive" ? "Reactivate" : "Deactivate — hide from new memberships"}
                        onClick={() => void toggle(s)}
                      >
                        {s.status === "inactive" ? <RotateCcw size={16} /> : <Power size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4} className="!py-12 text-center" style={{ color: "var(--text-muted)" }}>
                    No societies match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <FootNote>Deactivated societies stay on existing members&apos; profiles but can&apos;t be picked for new memberships.</FootNote>
      {editing && (
        <SocietyDrawer
          society={editing}
          existing={all}
          onClose={() => setEditing(null)}
          onSaved={(s, isNew) => {
            replace(s);
            setEditing(null);
            setToast(isNew ? `${s.acronym} added to the list` : `${s.acronym} saved`);
          }}
        />
      )}
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}

// ---------- Institutions ----------

function InstitutionDrawer({ institution, all, onClose, onSaved }: { institution: Institution | "new"; all: Institution[]; onClose: () => void; onSaved: (i: Institution, isNew: boolean) => void }) {
  const isNew = institution === "new";
  const [form, setForm] = useState({
    name: isNew ? "" : institution.name,
    aliases: isNew ? "" : institution.aliases.join(", "),
    country: isNew ? "" : (institution.country ?? ""),
    departments: isNew ? "" : institution.departments.join("\n"),
  });
  const { busy, error, save } = useSave();
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  // One per line; duplicates (by normalized name) are dropped, first spelling kept.
  const departments = form.departments
    .split("\n")
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d, i, list) => list.findIndex((x) => norm(x) === norm(d)) === i);
  const clash = all.some((i) => (isNew || i.id !== institution.id) && norm(i.name) === norm(form.name));
  const submit = () =>
    void save(async () => {
      const values = { name: form.name.trim(), aliases: splitList(form.aliases), country: form.country.trim() || null, departments };
      onSaved(isNew ? await createInstitution(values) : await updateInstitution(institution.id, values), isNew);
    });
  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? "Add an institution" : `Edit ${institution.name}`}
      subtitle="One official name, the short forms people type, and its verified departments."
      footer={<DrawerFooter onCancel={onClose} onSave={submit} label={isNew ? "Add institution" : "Save changes"} busy={busy} disabled={!form.name.trim() || clash} />}
    >
      <TextField label="Official name" value={form.name} onChange={set("name")} placeholder="e.g. Indian Institute of Technology Bombay" required hint="Full name, no abbreviations; add the city only to tell campuses apart." />
      {clash && <FormError error="This institution is already in the list." />}
      <TextField label="Short forms" value={form.aliases} onChange={set("aliases")} placeholder="IIT Bombay, IITB" hint="Comma-separated. Searching for any of them finds this institution." />
      <TextField label="Country" value={form.country} onChange={set("country")} placeholder="e.g. India" />
      <label className="block mb-4">
        <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Departments{" "}
          <span className="font-normal" style={{ color: "var(--text-muted)" }}>
            ({departments.length})
          </span>
        </span>
        <textarea className="sa-input !h-auto py-2.5 leading-relaxed" rows={7} value={form.departments} onChange={(e) => set("departments")(e.target.value)} placeholder={"Department of Computer Science & Engineering\nSchool of Management"} />
        <span className="block text-[12.5px] mt-1.5" style={{ color: "var(--text-muted)" }}>
          One per line, full official name (“Department of …”, “School of …”). Members pick from this list; anything else comes to Approvals › Department Names.
        </span>
      </label>
      <FormError error={error} />
    </Drawer>
  );
}

function MergeDrawer({ institution, all, onClose, onMerged }: { institution: Institution; all: Institution[]; onClose: () => void; onMerged: (kept: Institution) => void }) {
  const options = all.filter((i) => i.id !== institution.id && i.status === "active").sort((a, b) => a.name.localeCompare(b.name));
  const [into, setInto] = useState(options[0]?.id ?? "");
  const { busy, error, save } = useSave();
  const target = options.find((i) => i.id === into);
  return (
    <Drawer
      open
      onClose={onClose}
      title={`Merge ${institution.name}`}
      subtitle="Use this when two entries are the same institution."
      footer={<DrawerFooter onCancel={onClose} onSave={() => void save(async () => onMerged(await mergeInstitution(institution.id, into)))} label="Merge" busy={busy} disabled={!into} />}
    >
      <label className="block">
        <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Keep this one
        </span>
        <select className="sa-input cursor-pointer" value={into} onChange={(e) => setInto(e.target.value)}>
          {options.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      {target && (
        <p className="text-[13px] mt-4 rounded-xl p-4" style={{ background: "var(--muted)", color: "var(--text-soft)" }}>
          “{institution.name}” is retired and becomes a short form of <b>{target.name}</b>, so searching for it still finds the right one. Profiles and reviewer records that used it point at {target.name}, and conflict-of-interest checks run again.
        </p>
      )}
      <div className="mt-4">
        <FormError error={error} />
      </div>
    </Drawer>
  );
}

export function InstitutionsPage() {
  const { data, error, loading, reload, setData } = useData(loadInstitutions);
  const [tab, setTab] = useState<"active" | "retired" | "all">("active");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ mode: "new" } | { mode: "edit" | "merge"; institution: Institution } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const all = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => {
    const q = norm(query);
    return all.filter((i) => (tab === "all" || i.status === tab) && (!q || [i.name, ...i.aliases, i.country ?? ""].some((f) => norm(f).includes(q)))).sort((a, b) => a.name.localeCompare(b.name));
  }, [all, tab, query]);
  const { sorted, sort, toggle: sortBy } = useSort(rows, {
    institution: { get: (i) => i.name },
    aliases: { get: (i) => i.aliases.length, first: "desc" },
    country: { get: (i) => i.country ?? "" },
    departments: { get: (i) => i.departments.length, first: "desc" },
    people: { get: (i) => (i.status === "retired" ? null : i.people), first: "desc" },
    status: { get: (i) => i.status },
  });
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const count = (k: typeof tab) => all.filter((i) => k === "all" || i.status === k).length;
  const th = (label: string, key: string, className?: string) => <SortTh label={label} sortKey={key} sort={sort} onSort={sortBy} className={className} />;
  const replace = (i: Institution) => setData(all.map((x) => (x.id === i.id ? Object.assign({}, x, i, { people: x.people }) : x)).concat(all.some((x) => x.id === i.id) ? [] : [i]));
  const toggle = async (i: Institution) => {
    try {
      const next = await updateInstitution(i.id, { status: i.status === "active" ? "retired" : "active" });
      replace(next);
      setToast(next.status === "active" ? `${i.name} restored` : `${i.name} retired`);
    } catch (e) {
      setToast(errorText(e));
    }
  };
  return (
    <>
      <PageTitle title="Institutions" icon={Building2} />
      <Card className="!p-0">
        <Toolbar
          tabs={[
            ["active", "Active", count("active")],
            ["retired", "Retired", count("retired")],
            ["all", "All", count("all")],
          ]}
          tab={tab}
          setTab={setTab}
          query={query}
          setQuery={setQuery}
          placeholder="Search name or short form"
          right={
            <Button onClick={() => setEditing({ mode: "new" })} className="shrink-0">
              <Plus size={16} />
              Add
            </Button>
          }
        />
        <div className="overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                {th("Institution", "institution", "!pl-6")}
                {th("Short forms", "aliases")}
                {th("Country", "country")}
                {th("Departments", "departments")}
                {th("People", "people")}
                {th("Status", "status")}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((i) => (
                <tr key={i.id} style={i.status === "retired" ? { opacity: 0.65 } : undefined}>
                  <td className="!pl-6">
                    <p className="font-semibold" style={{ color: "var(--text)" }}>
                      {i.name}
                    </p>
                    {i.mergedInto && (
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        Merged into {i.mergedInto.name}
                      </p>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                      {i.aliases.slice(0, 4).map((a) => (
                        <Badge key={a} tone="neutral">
                          {a}
                        </Badge>
                      ))}
                      {i.aliases.length > 4 && <Badge tone="neutral">+{i.aliases.length - 4}</Badge>}
                      {!i.aliases.length && (
                        <span className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
                          None
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-[13px]">{i.country ?? "—"}</td>
                  <td>
                    {i.departments.length ? (
                      <span title={i.departments.join("\n")}>
                        <Badge tone="primary">{i.departments.length}</Badge>
                      </span>
                    ) : (
                      <span className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
                        None
                      </span>
                    )}
                  </td>
                  <td>{i.status === "retired" ? "—" : i.people}</td>
                  <td>{i.status === "retired" ? <Badge tone="neutral">Retired</Badge> : <Badge tone="success">Active</Badge>}</td>
                  <td className="pr-6">
                    <div className="flex justify-end gap-1">
                      {i.status === "retired" ? (
                        <button className="sa-icon-btn cursor-pointer" aria-label={`Restore ${i.name}`} title="Restore" onClick={() => void toggle(i)}>
                          <RotateCcw size={16} />
                        </button>
                      ) : (
                        <>
                          <button className="sa-icon-btn cursor-pointer" aria-label={`Edit ${i.name}`} title="Edit" onClick={() => setEditing({ mode: "edit", institution: i })}>
                            <Pencil size={16} />
                          </button>
                          <button className="sa-icon-btn cursor-pointer" aria-label={`Merge ${i.name}`} title="Merge into another" onClick={() => setEditing({ mode: "merge", institution: i })}>
                            <GitMerge size={16} />
                          </button>
                          <button className="sa-icon-btn cursor-pointer" aria-label={`Retire ${i.name}`} title="Retire — hide from search" onClick={() => void toggle(i)}>
                            <Power size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="!py-12 text-center" style={{ color: "var(--text-muted)" }}>
                    No institutions match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <FootNote>Retired institutions don&apos;t appear in search. Merging keeps the old name as a short form, so people typing it still find the right one.</FootNote>
      {editing?.mode === "new" && (
        <InstitutionDrawer
          institution="new"
          all={all}
          onClose={() => setEditing(null)}
          onSaved={(i) => {
            replace(i);
            setEditing(null);
            setToast(`${i.name} added`);
          }}
        />
      )}
      {editing?.mode === "edit" && (
        <InstitutionDrawer
          institution={editing.institution}
          all={all}
          onClose={() => setEditing(null)}
          onSaved={(i) => {
            replace(i);
            setEditing(null);
            setToast(`${i.name} saved`);
          }}
        />
      )}
      {editing?.mode === "merge" && (
        <MergeDrawer
          institution={editing.institution}
          all={all}
          onClose={() => setEditing(null)}
          onMerged={(kept) => {
            setEditing(null);
            setToast(`Merged into ${kept.name}`);
            reload();
          }}
        />
      )}
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}

// ---------- Research areas ----------

export function ResearchAreasPage() {
  const { data, error, loading, reload } = useData(loadResearchAreas);
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null); // area id being renamed inline
  const [draft, setDraft] = useState("");
  const [newSub, setNewSub] = useState("");
  const [newPrimary, setNewPrimary] = useState<{ group: string | null; name: string }>({ group: null, name: "" });
  const [toast, setToast] = useState<string | null>(null);
  const { error: saveError, setError, save } = useSave();
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const primaries = data.flatMap((g) => g.areas.map((a) => ({ ...a, group: g.label })));
  const current = primaries.find((p) => p.id === selected) ?? primaries[0];
  const totalSubs = primaries.reduce((n, a) => n + a.subareas.filter((s) => s.status === "active").length, 0);
  const group = newPrimary.group ?? data[0]?.label ?? "Other";

  const rename = (area: SecondaryArea | PrimaryArea) => {
    const name = draft.trim();
    setRenaming(null);
    if (!name || name === area.name) return;
    void save(async () => {
      const res = await updateResearchArea(area.id, { name });
      setToast(`Renamed to ${name}${res.conferencesRenamed ? ` — conferences using it now show the new name` : ""}`);
      reload();
    });
  };
  const toggleRetire = (area: SecondaryArea | PrimaryArea) =>
    void save(async () => {
      await updateResearchArea(area.id, { status: area.status === "active" ? "retired" : "active" });
      setToast(area.status === "active" ? `${area.name} retired — existing conferences keep it, new ones can't pick it` : `${area.name} restored`);
      reload();
    });
  const addSub = () => {
    const name = newSub.trim();
    if (!current || !name || current.subareas.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    void save(async () => {
      await createResearchArea({ name, parentId: current.id });
      setToast(`${name} added under ${current.name}`);
      setNewSub("");
      reload();
    });
  };
  const addPrimary = () => {
    const name = newPrimary.name.trim();
    if (!name || primaries.some((a) => a.name.toLowerCase() === name.toLowerCase())) return;
    void save(async () => {
      const created = await createResearchArea({ name, groupLabel: group });
      setToast(`${name} added`);
      setNewPrimary({ group, name: "" });
      setSelected(created.id);
      reload();
    });
  };
  const nameCell = (area: SecondaryArea | PrimaryArea, big = false) =>
    renaming === area.id ? (
      <input
        className="sa-input flex-1"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") rename(area);
          if (e.key === "Escape") setRenaming(null);
        }}
        onBlur={() => rename(area)}
        aria-label={`New name for ${area.name}`}
      />
    ) : (
      <span className={`flex-1 min-w-0 ${big ? "" : "text-[13.5px]"}`} style={{ color: "var(--text)" }}>
        {area.name}
        {area.status === "retired" && (
          <Badge tone="neutral" className="ml-2">
            Retired
          </Badge>
        )}
      </span>
    );

  return (
    <>
      <PageTitle title="Research Areas" icon={Network} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card className="!p-5">
          <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            Primary areas
          </p>
          <p className="text-[22px] font-bold" style={{ color: "var(--text)" }}>
            {primaries.filter((a) => a.status === "active").length}
          </p>
        </Card>
        <Card className="!p-5">
          <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            Secondary areas in use
          </p>
          <p className="text-[22px] font-bold" style={{ color: "var(--text)" }}>
            {totalSubs}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <Card className="!p-0 overflow-hidden self-start">
          <div className="max-h-[560px] overflow-y-auto py-2">
            {data.map((g) => (
              <div key={g.label}>
                <p className="px-5 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                  {g.label}
                </p>
                {g.areas.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setSelected(a.id);
                      setRenaming(null);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-5 py-2 text-left text-[13.5px] cursor-pointer"
                    style={{ ...(a.id === current?.id ? { background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 600 } : { color: "var(--text-soft)" }), opacity: a.status === "retired" ? 0.6 : 1 }}
                  >
                    <span className="truncate">{a.name}</span>
                    <span className="text-[12px] shrink-0" style={{ color: "var(--text-faint)" }}>
                      {a.subareas.filter((s) => s.status === "active").length}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-[12.5px] font-semibold mb-2" style={{ color: "var(--text)" }}>
              Add a primary area
            </p>
            <select className="sa-input mb-2 cursor-pointer" value={group} onChange={(e) => setNewPrimary((p) => ({ ...p, group: e.target.value }))} aria-label="Group">
              {data.map((g) => (
                <option key={g.label}>{g.label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input className="sa-input" placeholder="e.g. Maritime Studies" value={newPrimary.name} onChange={(e) => setNewPrimary((p) => ({ ...p, name: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addPrimary()} aria-label="New primary area" />
              <Button variant="soft" onClick={addPrimary} disabled={!newPrimary.name.trim()} aria-label="Add primary area">
                <Plus size={15} />
              </Button>
            </div>
          </div>
        </Card>

        {current && (
          <Card>
            <CardTitle
              title={nameCell(current, true)}
              subtitle={`${current.subareas.filter((s) => s.status === "active").length} secondary areas · used by ${current.conferences} conference${current.conferences === 1 ? "" : "s"}`}
              right={
                <div className="flex gap-1 shrink-0">
                  <button
                    className="sa-icon-btn cursor-pointer"
                    title="Rename"
                    aria-label={`Rename ${current.name}`}
                    onClick={() => {
                      setRenaming(current.id);
                      setDraft(current.name);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button className="sa-icon-btn cursor-pointer" title={current.status === "active" ? "Retire — hide from new conferences" : "Restore"} aria-label={current.status === "active" ? `Retire ${current.name}` : `Restore ${current.name}`} onClick={() => toggleRetire(current)}>
                    {current.status === "active" ? <Power size={15} /> : <RotateCcw size={15} />}
                  </button>
                </div>
              }
            />
            <ul className="divide-y divide-[var(--border)]">
              {current.subareas.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5" style={s.status === "retired" ? { opacity: 0.55 } : undefined}>
                  {nameCell(s)}
                  <span className="text-[12px] w-[96px] text-right shrink-0" style={{ color: "var(--text-muted)" }}>
                    {s.conferences} conference{s.conferences === 1 ? "" : "s"}
                  </span>
                  <button
                    className="sa-icon-btn cursor-pointer"
                    aria-label={`Rename ${s.name}`}
                    title="Rename"
                    onClick={() => {
                      setRenaming(s.id);
                      setDraft(s.name);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button className="sa-icon-btn cursor-pointer" aria-label={`${s.status === "retired" ? "Restore" : "Retire"} ${s.name}`} title={s.status === "retired" ? "Restore" : "Retire — hide from new conferences"} onClick={() => toggleRetire(s)}>
                    {s.status === "retired" ? <RotateCcw size={15} /> : <Power size={15} />}
                  </button>
                </li>
              ))}
              {current.subareas.length === 0 && (
                <li className="py-3 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                  No secondary areas yet.
                </li>
              )}
            </ul>
            <div className="flex gap-2 mt-4">
              <input className="sa-input" placeholder={`Add a secondary area under ${current.name}`} value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSub()} aria-label="New secondary area" />
              <Button onClick={addSub} disabled={!newSub.trim()}>
                <Plus size={15} />
                Add
              </Button>
            </div>
            {saveError && (
              <p role="alert" className="text-[13px] mt-3" style={{ color: "var(--danger)" }} onClick={() => setError(null)}>
                {saveError}
              </p>
            )}
            <FootNote>Renaming updates every conference that uses the area. Retired areas stay on existing conferences but can&apos;t be picked for new ones.</FootNote>
          </Card>
        )}
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
