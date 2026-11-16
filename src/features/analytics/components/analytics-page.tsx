"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, FileText, Users, Building2, Globe2, MapPinned, Database, ClipboardList, TrendingUp, type LucideIcon } from "lucide-react";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { useChairConference } from "@/features/chair/use-chair-conference";
import type { Conference } from "@/types/conference";
import { buildAnalytics, type AnalyticsData } from "../data";
import OverviewTab from "../tabs/overview-tab";
import SubmissionsTab from "../tabs/submissions-tab";
import AuthorsTab from "../tabs/authors-tab";
import InstitutionsTab from "../tabs/institutions-tab";
import CountriesTab from "../tabs/countries-tab";
import RegionTab from "../tabs/region-tab";
import MasterDataTab from "../tabs/master-data-tab";
import ReviewTab from "../tabs/review-tab";
import TrendsTab from "../tabs/trends-tab";

/* The chair's Analytics (the prototype's ChairAnalyticsPage): a banner with the acceptance rate and nine tabs. Everything is computed from the
   conference's own submitted papers (data.ts); a tab whose data the database does not hold shows the prototype's empty state. The prototype's
   "Ask AI" button and "Master Link" widget are left out there too: they imply features that do not exist. */

const TABS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "submissions", label: "Submissions", icon: FileText },
  { id: "authors", label: "Authors", icon: Users },
  { id: "institutions", label: "Institutions", icon: Building2 },
  { id: "countries", label: "Countries", icon: Globe2 },
  { id: "region", label: "Region", icon: MapPinned },
  { id: "masterdata", label: "Master Data", icon: Database },
  { id: "review", label: "Review", icon: ClipboardList },
  { id: "trends", label: "Trends", icon: TrendingUp },
];

// Banner card: eyebrow + conference title / location on the left, the acceptance-rate pill on the right.
function AnalyticsBanner({ conference, data }: { conference: Conference; data: AnalyticsData }) {
  const s = data.summary;
  const location = [conference.city, conference.country].filter(Boolean).join(", ");
  const subtitle = [conference.name, location].filter(Boolean).join(" · ");

  return (
    <div className="px-4 sm:px-8 pt-8 pb-0">
      <div
        style={{
          borderTop: "1px solid var(--border)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
          borderLeft: "3px solid var(--primary)", boxShadow: "var(--shadow-card)",
        }}
        className="bg-white rounded-2xl pl-5 pr-5 py-4 flex items-center justify-between gap-4 flex-wrap"
      >
        <div className="min-w-0">
          <div style={{ color: "var(--primary)" }} className="text-[11px] font-bold uppercase tracking-wide">Conference Analytics</div>
          <h1 style={{ color: "var(--navy)", letterSpacing: "-0.02em" }} className="text-xl leading-tight font-extrabold mt-0.5 truncate">
            {conference.acronym || conference.name || "Analytics"}
          </h1>
          {subtitle && <p style={{ color: "var(--ink-muted)" }} className="text-xs mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className="rounded-xl px-4 py-2 text-center shrink-0">
          <div style={{ color: "var(--primary)" }} className="text-lg font-extrabold leading-tight">{s.acceptanceRate}%</div>
          <div style={{ color: "var(--primary)" }} className="text-[10px] font-bold uppercase tracking-wide">Acceptance</div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsView({ conference, data }: { conference: Conference; data: AnalyticsData }) {
  const [activeTab, setActiveTab] = useState("overview");
  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div>
      <AnalyticsBanner conference={conference} data={data} />

      <div className="px-4 sm:px-8 pt-5">
        <div className="flex items-center gap-1 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === activeTab;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  color: isActive ? "var(--primary)" : "var(--ink-muted)",
                  borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors hover:text-[var(--primary)] shrink-0 cursor-pointer"
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-8 pt-6">
        {active.id === "overview" && <OverviewTab conference={conference} data={data} onTabChange={setActiveTab} />}
        {active.id === "submissions" && <SubmissionsTab data={data} />}
        {active.id === "authors" && <AuthorsTab data={data} />}
        {active.id === "institutions" && <InstitutionsTab data={data} />}
        {active.id === "countries" && <CountriesTab data={data} />}
        {active.id === "region" && <RegionTab data={data} />}
        {active.id === "masterdata" && <MasterDataTab />}
        {active.id === "review" && <ReviewTab />}
        {active.id === "trends" && <TrendsTab />}
      </div>
    </div>
  );
}

export function AnalyticsPage({ slug }: { slug: string }) {
  const { state, retry } = useChairConference(slug);
  const ready = state.status === "ready" ? state : null;
  const data = useMemo(() => (ready ? buildAnalytics(ready.data, ready.conference) : null), [ready]);

  const gate = workspaceGate(state, retry, { title: "Analytics", loadingLabel: "Loading the analytics", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the analytics." });
  if (gate || !ready || !data) return gate;
  const { conference, roles, others, data: chair } = ready;

  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="analytics" screening={chair.screening}>
      <AnalyticsView key={conference.id} conference={conference} data={data} />
    </ConferenceShell>
  );
}
