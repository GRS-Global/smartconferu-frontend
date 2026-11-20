"use client";
/* Global search (Ctrl/⌘ K), the prototype's SearchPalette: pages, conferences, people and
   waiting requests from one box. Arrow keys move, Enter opens, Esc closes. Mounted only while
   open, so every opening starts with an empty box. */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CornerDownLeft, Inbox, LayoutGrid, Search, Users } from "lucide-react";
import { loadConferences, loadUsers, type AdminConference, type AdminUser } from "../services";
import { QUEUE_INFO, type PendingItem } from "../pending";
import { Avatar, waitingLabel, type Icon } from "./ui";

const MAX_PER_GROUP = 5;

export interface SearchPage {
  href: string;
  label: string;
  caption: string;
  icon: Icon;
}

interface Hit {
  key: string;
  group: string;
  title: string;
  sub: string;
  href: string;
  icon?: Icon;
  person?: string;
}

export function SearchPalette({ onClose, pages, pending }: { onClose: () => void; pages: SearchPage[]; pending: PendingItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [conferences, setConferences] = useState<AdminConference[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    loadConferences().then(setConferences).catch(() => undefined);
  }, []);
  // People are searched on the API (there can be many); waits a moment while typing.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return undefined;
    const t = setTimeout(() => {
      loadUsers({ search: q, limit: MAX_PER_GROUP })
        .then((page) => setUsers(page.data))
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    const has = (...fields: (string | null | undefined)[]) => !q || fields.some((f) => f?.toLowerCase().includes(q));
    const groups: Hit[][] = [
      pages
        .filter((p) => has(p.label, p.caption))
        .map((p) => ({ key: `page-${p.href}`, group: "Pages", title: p.label, sub: p.caption, href: p.href, icon: p.icon })),
      conferences
        .filter((c) => c.status !== "deleted" && has(c.acronym, c.title, c.city, c.country, c.requester?.name))
        .map((c) => ({ key: `conf-${c.id}`, group: "Conferences", title: c.acronym, sub: c.title, href: `/super-admin/conferences/${c.id}`, icon: CalendarDays })),
      (q.length >= 2 ? users : []).map((u) => ({ key: `user-${u.id}`, group: "People", title: u.name, sub: u.email ?? "no email", href: `/super-admin/users/${u.id}`, person: u.name })),
      pending
        .filter((p) => has(p.acronym, p.title, p.person))
        .map((p) => ({ key: `wait-${p.queue}-${p.id}`, group: "Waiting for you", title: `${p.acronym} · ${QUEUE_INFO[p.queue].label}`, sub: `${p.person} · ${waitingLabel(p.since)}`, href: p.href, icon: Inbox })),
    ];
    return groups.flatMap((g) => g.slice(0, MAX_PER_GROUP));
  }, [query, pages, conferences, users, pending]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    onClose();
    router.push(h.href);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, hits.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hits.length, onClose]);

  const at = Math.min(cursor, Math.max(hits.length - 1, 0));
  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0" style={{ background: "rgba(11,16,32,0.45)" }} onClick={onClose} />
      <div className="relative w-full max-w-[600px] bg-white rounded-2xl overflow-hidden sa-pop" style={{ boxShadow: "var(--shadow-pop)" }} role="dialog" aria-modal="true" aria-label="Search">
        <div className="flex items-center gap-3 px-5 border-b" style={{ borderColor: "var(--border)" }}>
          <Search size={18} style={{ color: "var(--text-faint)" }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => e.key === "Enter" && go(hits[at])}
            placeholder="Search conferences, people, requests, pages…"
            className="flex-1 h-14 outline-none text-[15px] bg-transparent"
            style={{ color: "var(--text)" }}
            aria-label="Search"
          />
          <kbd className="text-[11px] font-semibold rounded-md px-1.5 py-0.5" style={{ background: "var(--muted)", color: "var(--text-muted)" }}>
            Esc
          </kbd>
        </div>
        <ul className="max-h-[420px] overflow-y-auto py-2" role="listbox">
          {hits.map((h, i) => {
            const header = h.group !== lastGroup;
            lastGroup = h.group;
            const on = i === at;
            return (
              <li key={h.key}>
                {header && (
                  <p className="px-5 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                    {h.group}
                  </p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(h)}
                  className="w-full flex items-center gap-3 px-5 py-2.5 text-left cursor-pointer"
                  style={{ background: on ? "var(--primary-soft)" : undefined }}
                >
                  {h.person ? (
                    <Avatar name={h.person} size={32} />
                  ) : (
                    <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                      {h.icon ? <h.icon size={16} /> : <LayoutGrid size={16} />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold truncate" style={{ color: on ? "var(--primary)" : "var(--text)" }}>
                      {h.title}
                    </span>
                    <span className="block text-[12.5px] truncate" style={{ color: "var(--text-muted)" }}>
                      {h.sub}
                    </span>
                  </span>
                  {on && <CornerDownLeft size={15} style={{ color: "var(--text-faint)" }} />}
                </button>
              </li>
            );
          })}
          {hits.length === 0 && (
            <li className="px-5 py-10 text-center text-[13.5px]" style={{ color: "var(--text-muted)" }}>
              <Users size={20} className="mx-auto mb-2" style={{ color: "var(--text-faint)" }} />
              Nothing matches “{query}”.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
