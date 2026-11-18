"use client";
/* Master data (the prototype's SocietiesPage, InstitutionsPage, ResearchAreasPage), now kept in
   the database through the API. Nothing is deleted: societies are deactivated, institutions and
   research areas retired (and can come back). Society logo upload is not in the launch: the
   shipped logos (public/societies/<key>.*) are shown. */
import { useMemo, useState } from "react";
import { Building2, GitMerge, Landmark, Network, Pencil, Plus, Power, RotateCcw } from "lucide-react";
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
import { Badge, Button, Card, Drawer, errorText, ExtLink, Failed, Loading, Modal, PageTitle, TextField, Toast, Toolbar } from "./ui";

const LOGOS = new Map(SOCIETIES.map((s) => [s.id, s.logo]));
const splitList = (text: string) => text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

function DrawerFooter({ onCancel, onSave, label, busy, disabled }: { onCancel: () => void; onSave: () => void; label: string; busy: boolean; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <Button tone="neutral" variant="outline" onClick={onCancel} disabled={busy}>
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
    <p role="alert" className="text-[13px] mt-1" style={{ color: "var(--danger)" }}>
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

// ---------- Societies ----------

function SocietyDrawer({ society, onClose, onSaved }: { society: Society | "new"; onClose: () => void; onSaved: (s: Society, isNew: boolean) => void }) {
  const isNew = society === "new";
  const [form, setForm] = useState({ name: isNew ? "" : society.name, acronym: isNew ? "" : society.acronym, url: isNew ? "" : (society.url ?? "") });
  const { busy, error, save } = useSave();
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name.trim() && form.acronym.trim();
  const submit = () =>
    void save(async () => {
      const values = { name: form.name.trim(), acronym: form.acronym.trim(), url: form.url.trim() || null };
      onSaved(isNew ? await createSociety(values) : await updateSociety(society.id, values), isNew);
    });
  return (
    <Drawer open onClose={onClose} title={isNew ? "Add a society" : `Edit ${society.acronym}`} footer={<DrawerFooter onCancel={onClose} onSave={submit} label={isNew ? "Add society" : "Save"} busy={busy} disabled={!valid} />}>
      <TextField label="Official name" value={form.name} onChange={set("name")} placeholder="e.g. Indian Society for Technical Education" required />
      <TextField label="Acronym" value={form.acronym} onChange={set("acronym")} placeholder="e.g. ISTE" required />
      <TextField label="Website" value={form.url} onChange={set("url")} placeholder="https://" />
      <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        Logo upload is coming soon.
      </p>
      <FormError error={error} />
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
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const count = (k: typeof tab) => all.filter((s) => k === "all" || s.status === k).length;
  const q = query.toLowerCase();
  const rows = all.filter((s) => (tab === "all" || s.status === tab) && (!q || `${s.name} ${s.acronym}`.toLowerCase().includes(q)));
  const replace = (s: Society) => setData([...all.filter((x) => x.id !== s.id), s].sort((a, b) => a.acronym.localeCompare(b.acronym)));
  const toggle = async (s: Society) => {
    try {
      const next = await updateSociety(s.id, { status: s.status === "active" ? "inactive" : "active" });
      replace(next);
      setToast(next.status === "active" ? `${s.acronym} reactivated` : `${s.acronym} deactivated — hidden from new memberships`);
    } catch (e) {
      setToast(errorText(e));
    }
  };
  return (
    <>
      <PageTitle
        title="Societies"
        description="The professional societies members can list under My Profile › Memberships."
        icon={Landmark}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} />
            Add society
          </Button>
        }
      />
      <Card className="!p-0">
        <Toolbar tabs={[["active", "Active", count("active")], ["inactive", "Deactivated", count("inactive")], ["all", "All", count("all")]]} tab={tab} setTab={setTab} query={query} setQuery={setQuery} placeholder="Search societies" />
        <div className="overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                <th className="!pl-6">Society</th>
                <th>Website</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} style={s.status === "inactive" ? { opacity: 0.65 } : undefined}>
                  <td className="!pl-6">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0 overflow-hidden" style={{ border: "1px solid var(--border)", background: "#FFFFFF" }}>
                        {LOGOS.get(s.key) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={LOGOS.get(s.key)} alt="" className="max-w-[32px] max-h-[32px] object-contain" />
                        ) : (
                          <Landmark size={18} style={{ color: "var(--text-faint)" }} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold" style={{ color: "var(--text)" }}>
                          {s.acronym}
                        </p>
                        <p className="text-[12.5px] truncate max-w-[360px]" style={{ color: "var(--text-muted)" }}>
                          {s.name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <ExtLink href={s.url} />
                  </td>
                  <td>{s.status === "inactive" ? <Badge tone="neutral">Deactivated</Badge> : <Badge tone="success">Active</Badge>}</td>
                  <td className="text-right !pr-6 whitespace-nowrap">
                    <button className="sa-icon-btn" aria-label={`Edit ${s.acronym}`} title="Edit" onClick={() => setEditing(s)}>
                      <Pencil size={16} />
                    </button>
                    <button className="sa-icon-btn" aria-label={s.status === "inactive" ? `Reactivate ${s.acronym}` : `Deactivate ${s.acronym}`} title={s.status === "inactive" ? "Reactivate" : "Deactivate — hide from new memberships"} onClick={() => void toggle(s)}>
                      {s.status === "inactive" ? <RotateCcw size={16} /> : <Power size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="!pl-6 py-8 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                    No societies here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {editing && (
        <SocietyDrawer
          society={editing}
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

function InstitutionDrawer({ institution, onClose, onSaved }: { institution: Institution | "new"; onClose: () => void; onSaved: (i: Institution, isNew: boolean) => void }) {
  const isNew = institution === "new";
  const [form, setForm] = useState({
    name: isNew ? "" : institution.name,
    aliases: isNew ? "" : institution.aliases.join(", "),
    country: isNew ? "" : (institution.country ?? ""),
    departments: isNew ? "" : institution.departments.join("\n"),
  });
  const { busy, error, save } = useSave();
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () =>
    void save(async () => {
      const values = { name: form.name.trim(), aliases: splitList(form.aliases), country: form.country.trim() || null, departments: form.departments.split("\n").map((d) => d.trim()).filter(Boolean) };
      onSaved(isNew ? await createInstitution(values) : await updateInstitution(institution.id, values), isNew);
    });
  return (
    <Drawer open onClose={onClose} title={isNew ? "Add an institution" : `Edit ${institution.name}`} footer={<DrawerFooter onCancel={onClose} onSave={submit} label={isNew ? "Add institution" : "Save"} busy={busy} disabled={!form.name.trim()} />}>
      <TextField label="Official name" value={form.name} onChange={set("name")} placeholder="e.g. Indian Institute of Technology Bombay" required hint="Full name, no abbreviations; add the city if two share a name." />
      <TextField label="Short forms" value={form.aliases} onChange={set("aliases")} placeholder="IIT Bombay, IITB" hint="Comma-separated. Searching for any of them finds this institution." />
      <TextField label="Country" value={form.country} onChange={set("country")} placeholder="e.g. India" />
      <label className="block mb-4">
        <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Departments
        </span>
        <textarea className="sa-input !h-auto py-2.5 leading-relaxed" rows={7} value={form.departments} onChange={(e) => set("departments")(e.target.value)} placeholder={"Department of Computer Science & Engineering\nDepartment of Electrical Engineering"} />
        <span className="block text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
          One per line.
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
  return (
    <Drawer open onClose={onClose} title={`Merge ${institution.name}`} subtitle="For a duplicate: it is retired and its names become short forms of the one you keep." footer={<DrawerFooter onCancel={onClose} onSave={() => void save(async () => onMerged(await mergeInstitution(institution.id, into)))} label="Merge" busy={busy} disabled={!into} />}>
      <label className="block mb-4">
        <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
          Keep this institution
        </span>
        <select className="sa-input" value={into} onChange={(e) => setInto(e.target.value)}>
          {options.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <FormError error={error} />
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
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const count = (k: typeof tab) => all.filter((i) => k === "all" || i.status === k).length;
  const q = query.toLowerCase();
  const rows = all.filter((i) => (tab === "all" || i.status === tab) && (!q || `${i.name} ${i.aliases.join(" ")} ${i.country ?? ""}`.toLowerCase().includes(q)));
  const replace = (i: Institution) => setData(all.map((x) => (x.id === i.id ? Object.assign({}, x, i, { people: x.people }) : x)).concat(all.some((x) => x.id === i.id) ? [] : [i]));
  const toggle = async (i: Institution) => {
    try {
      const next = await updateInstitution(i.id, { status: i.status === "active" ? "retired" : "active" });
      replace(next);
      setToast(next.status === "active" ? `${i.name} restored` : `${i.name} retired — hidden from search`);
    } catch (e) {
      setToast(errorText(e));
    }
  };
  return (
    <>
      <PageTitle
        title="Institutions"
        description="Approved institution names: what the institution search offers in profiles and invitations."
        icon={Building2}
        actions={
          <Button onClick={() => setEditing({ mode: "new" })}>
            <Plus size={16} />
            Add institution
          </Button>
        }
      />
      <Card className="!p-0">
        <Toolbar tabs={[["active", "Active", count("active")], ["retired", "Retired", count("retired")], ["all", "All", count("all")]]} tab={tab} setTab={setTab} query={query} setQuery={setQuery} placeholder="Search name or short form" />
        <div className="overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                <th className="!pl-6">Institution</th>
                <th>Short forms</th>
                <th>Country</th>
                <th>Departments</th>
                <th>People</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} style={i.status === "retired" ? { opacity: 0.65 } : undefined}>
                  <td className="!pl-6">
                    <p className="font-semibold max-w-[320px]" style={{ color: "var(--text)" }}>
                      {i.name}
                    </p>
                    {i.mergedInto && (
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        Merged into {i.mergedInto.name}
                      </p>
                    )}
                  </td>
                  <td className="text-[13px] max-w-[220px] truncate">{i.aliases.join(", ") || "—"}</td>
                  <td>{i.country ?? "—"}</td>
                  <td className="tabular-nums">{i.departments.length || "—"}</td>
                  <td className="tabular-nums">{i.status === "retired" ? "—" : i.people}</td>
                  <td>{i.status === "retired" ? <Badge tone="neutral">Retired</Badge> : <Badge tone="success">Active</Badge>}</td>
                  <td className="text-right !pr-6 whitespace-nowrap">
                    {i.status === "retired" ? (
                      <button className="sa-icon-btn" aria-label={`Restore ${i.name}`} title="Restore" onClick={() => void toggle(i)}>
                        <RotateCcw size={16} />
                      </button>
                    ) : (
                      <>
                        <button className="sa-icon-btn" aria-label={`Edit ${i.name}`} title="Edit" onClick={() => setEditing({ mode: "edit", institution: i })}>
                          <Pencil size={16} />
                        </button>
                        <button className="sa-icon-btn" aria-label={`Merge ${i.name}`} title="Merge into another" onClick={() => setEditing({ mode: "merge", institution: i })}>
                          <GitMerge size={16} />
                        </button>
                        <button className="sa-icon-btn" aria-label={`Retire ${i.name}`} title="Retire — hide from search" onClick={() => void toggle(i)}>
                          <Power size={16} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="!pl-6 py-8 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                    No institutions here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {editing?.mode === "new" && (
        <InstitutionDrawer institution="new" onClose={() => setEditing(null)} onSaved={(i) => { replace(i); setEditing(null); setToast(`${i.name} added`); }} />
      )}
      {editing?.mode === "edit" && (
        <InstitutionDrawer institution={editing.institution} onClose={() => setEditing(null)} onSaved={(i) => { replace(i); setEditing(null); setToast(`${i.name} saved`); }} />
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

type AreaAction = { kind: "rename"; area: SecondaryArea | PrimaryArea } | { kind: "add-sub"; primary: PrimaryArea } | { kind: "add-primary"; group: string };

export function ResearchAreasPage() {
  const { data, error, loading, reload } = useData(loadResearchAreas);
  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState<AreaAction | null>(null);
  const [name, setName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const { busy, error: saveError, setError, save } = useSave();
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const primaries = data.flatMap((g) => g.areas.map((a) => ({ ...a, group: g.label })));
  const current = primaries.find((p) => p.id === selected) ?? primaries[0];
  const totalSubs = primaries.reduce((n, a) => n + a.subareas.filter((s) => s.status === "active").length, 0);

  const open = (a: AreaAction) => {
    setAction(a);
    setName(a.kind === "rename" ? a.area.name : "");
    setError(null);
  };
  const submit = () =>
    void save(async () => {
      if (!action) return;
      const n = name.trim();
      if (action.kind === "rename") {
        const res = await updateResearchArea(action.area.id, { name: n });
        setToast(`Renamed to ${n}${res.conferencesRenamed ? ` — ${res.conferencesRenamed} conference${res.conferencesRenamed === 1 ? "" : "s"} updated` : ""}`);
      } else if (action.kind === "add-sub") {
        await createResearchArea({ name: n, parentId: action.primary.id });
        setToast(`${n} added under ${action.primary.name}`);
      } else {
        const created = await createResearchArea({ name: n, groupLabel: action.group });
        setSelected(created.id);
        setToast(`${n} added`);
      }
      setAction(null);
      reload();
    });
  const toggle = async (area: SecondaryArea | PrimaryArea) => {
    try {
      await updateResearchArea(area.id, { status: area.status === "active" ? "retired" : "active" });
      setToast(area.status === "active" ? `${area.name} retired — existing conferences keep it` : `${area.name} restored`);
      reload();
    } catch (e) {
      setToast(errorText(e));
    }
  };

  return (
    <>
      <PageTitle
        title="Research Areas"
        description={`The taxonomy conferences choose from: ${primaries.length} primary areas, ${totalSubs} secondary areas. Renaming one renames it on every conference that uses it.`}
        icon={Network}
        actions={
          <Button onClick={() => open({ kind: "add-primary", group: current?.group ?? data[0]?.label ?? "Other" })}>
            <Plus size={16} />
            Add primary area
          </Button>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4 !p-0 !pb-2">
          {data.map((g) => (
            <div key={g.label}>
              <p className="sa-caption !mt-4 !px-6">{g.label}</p>
              <ul>
                {g.areas.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => setSelected(a.id)} className="sa-row-link !py-2.5" style={{ background: current?.id === a.id ? "var(--primary-soft)" : undefined, opacity: a.status === "retired" ? 0.6 : 1 }}>
                      <span className="flex-1 min-w-0 text-[13.5px] font-semibold truncate" style={{ color: current?.id === a.id ? "var(--primary)" : "var(--text)" }}>
                        {a.name}
                      </span>
                      <span className="text-[12px] tabular-nums" style={{ color: "var(--text-faint)" }}>
                        {a.subareas.filter((s) => s.status === "active").length}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
        {current && (
          <Card className="lg:col-span-8 !p-0">
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                  {current.group}
                </p>
                <h3 className="text-[18px] font-semibold" style={{ color: "var(--text)" }}>
                  {current.name} {current.status === "retired" && <Badge tone="neutral">Retired</Badge>}
                </h3>
                <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {current.conferences} conference{current.conferences === 1 ? "" : "s"} in this area
                </p>
              </div>
              <div className="flex gap-1">
                <button className="sa-icon-btn" title="Rename" aria-label={`Rename ${current.name}`} onClick={() => open({ kind: "rename", area: current })}>
                  <Pencil size={16} />
                </button>
                <button className="sa-icon-btn" title={current.status === "active" ? "Retire" : "Restore"} aria-label={current.status === "active" ? `Retire ${current.name}` : `Restore ${current.name}`} onClick={() => void toggle(current)}>
                  {current.status === "active" ? <Power size={16} /> : <RotateCcw size={16} />}
                </button>
                <Button variant="soft" onClick={() => open({ kind: "add-sub", primary: current })}>
                  <Plus size={15} />
                  Add secondary area
                </Button>
              </div>
            </div>
            <table className="sa-table">
              <thead>
                <tr>
                  <th className="!pl-6">Secondary area</th>
                  <th>Conferences</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {current.subareas.map((s) => (
                  <tr key={s.id} style={s.status === "retired" ? { opacity: 0.65 } : undefined}>
                    <td className="!pl-6 font-medium" style={{ color: "var(--text)" }}>
                      {s.name}
                    </td>
                    <td className="tabular-nums">{s.conferences || "—"}</td>
                    <td>{s.status === "retired" ? <Badge tone="neutral">Retired</Badge> : <Badge tone="success">Active</Badge>}</td>
                    <td className="text-right !pr-6 whitespace-nowrap">
                      <button className="sa-icon-btn" title="Rename" aria-label={`Rename ${s.name}`} onClick={() => open({ kind: "rename", area: s })}>
                        <Pencil size={16} />
                      </button>
                      <button className="sa-icon-btn" title={s.status === "active" ? "Retire — hide from new conferences" : "Restore"} aria-label={s.status === "active" ? `Retire ${s.name}` : `Restore ${s.name}`} onClick={() => void toggle(s)}>
                        {s.status === "active" ? <Power size={16} /> : <RotateCcw size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
                {current.subareas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="!pl-6 py-6 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                      No secondary areas yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}
      </div>
      {action && (
        <Modal
          title={action.kind === "rename" ? `Rename “${action.area.name}”` : action.kind === "add-sub" ? `Add a secondary area under ${action.primary.name}` : "Add a primary area"}
          onClose={() => setAction(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button tone="neutral" variant="outline" onClick={() => setAction(null)}>
                Cancel
              </Button>
              <Button busy={busy} disabled={name.trim().length < 2} onClick={submit}>
                {action.kind === "rename" ? "Rename" : "Add"}
              </Button>
            </div>
          }
        >
          {action.kind === "add-primary" && (
            <label className="block mb-4">
              <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
                Heading
              </span>
              <select className="sa-input" value={action.group} onChange={(e) => setAction({ kind: "add-primary", group: e.target.value })}>
                {data.map((g) => (
                  <option key={g.label}>{g.label}</option>
                ))}
              </select>
            </label>
          )}
          <TextField label="Name" value={name} onChange={setName} required hint={action.kind === "rename" ? "Conferences using it are renamed too." : undefined} />
          <FormError error={saveError} />
        </Modal>
      )}
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
