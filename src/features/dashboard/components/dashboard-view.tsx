"use client";

import { TriangleAlert } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { PROTOTYPE_URL } from "@/lib/config";
import { useRouter } from "next/navigation";
import { openPrototypePage } from "@/lib/navigation";
import type { Conference, ConferenceRole } from "@/types/conference";
import { buildDashboardRows } from "../derive";
import { ROLE_META, type RoleFilter } from "../roles";
import { roleLanding } from "@/features/workspace/menus";
import { answerInvitation, useDashboardData } from "../use-dashboard-data";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { InvitationList, InvitationStrip, PendingInvitations, useInvitations } from "./invitations";
import { OptionABC } from "./option-abc";
import { OptionD, type SlotContext } from "./option-d";

export type DashboardVariant = "a" | "b" | "c" | "d";

const inviteRole = (role: string) => role === "all" || role === "reviewer";

export function DashboardView({ variant }: { variant: DashboardVariant }) {
  const { state, reload, retry } = useDashboardData();

  if (state.status === "loading") return <Page><DashboardSkeleton /></Page>;
  // The session is gone or was refused while loading: clear it and go to the login page (it returns here afterwards).
  if (state.status === "auth") return <Page><DashboardSkeleton /><SessionEnded onRecovered={retry} /></Page>;
  if (state.status === "error") {
    return (
      <Page><Frame>
        <EmptyState
          icon={TriangleAlert}
          title={state.config ? "The database connection isn't set up." : "Couldn't load your conferences."}
          description={state.message}
          action={state.config ? undefined : <Button size="sm" onClick={retry}>Try again</Button>}
        />
      </Frame></Page>
    );
  }
  return <Loaded variant={variant} data={state.data} reload={reload} />;
}

/** Page title and breadcrumb: "My Conferences", then the picked role once one is chosen. */
function Page({ role = "all", children }: { role?: RoleFilter; children: React.ReactNode }) {
  const crumbs = [{ label: "My Conferences" }, ...(role !== "all" ? [{ label: ROLE_META[role].chip }] : [])];
  return (
    <>
      <PageHeader title="My Conferences" breadcrumbs={crumbs} />
      {children}
    </>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="p-8"><div className="rounded-2xl border border-line bg-white">{children}</div></div>;
}

function Loaded({ variant, data, reload }: { variant: DashboardVariant; data: NonNullable<Extract<ReturnType<typeof useDashboardData>["state"], { status: "ready" }>["data"]>; reload: () => void }) {
  const [today] = useState(() => new Date());
  const [role, setRole] = useState<RoleFilter>(variant === "d" ? "all" : "author");
  const rows = useMemo(() => buildDashboardRows(data.source, today), [data.source, today]);

  // The author workspace is a page of this app; the reviewer and chair workspaces, registration is not ported yet: they open in the prototype.
  const router = useRouter();
  const onEnter = useCallback((conf: Conference, role: ConferenceRole) => {
    const { href, external } = roleLanding(conf.id, role);
    if (external) openPrototypePage(href); else router.push(href);
  }, [router]);
  const onRegister = useCallback((conf: Conference) => { openPrototypePage(`${PROTOTYPE_URL}/prototype/registration/${encodeURIComponent(conf.id)}`); }, []);
  const onOpenCertificates = useCallback(() => { router.push("/my-certificates"); }, [router]);
  const openWorkspace = useCallback((conferenceId: string) => { const { href, external } = roleLanding(conferenceId, "reviewer"); if (external) openPrototypePage(href); else router.push(href); }, [router]);

  const [listView, setListView] = useState(() => {
    try { return window.sessionStorage.getItem("smartconferu.dashboard.listView") === "history" ? "history" : "conferences"; } catch { return "conferences"; }
  });
  const changeListView = (v: string) => {
    setListView(v);
    try { window.sessionStorage.setItem("smartconferu.dashboard.listView", v); } catch { /* storage off */ }
  };

  const invitations = useInvitations({ invitations: data.invitations, respond: answerInvitation, onAnswered: reload, onOpenWorkspace: openWorkspace });
  const openInvitations = () => {
    changeListView("conferences");
    // Two frames: the role switch has to render the pending list before we can scroll to it.
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("dashboard-pending-invitations")?.scrollIntoView({ behavior: "smooth", block: "start" })));
  };

  if (variant !== "d") {
    return <Page role={role}><OptionABC variant={variant} rows={rows} onEnter={onEnter} onRegister={onRegister} onOpenCertificates={onOpenCertificates} onRoleChange={setRole} /></Page>;
  }
  return (
    <Page role={role}>
      <OptionD
        onRoleChange={setRole}
        rows={rows}
        onEnter={onEnter}
        onRegister={onRegister}
        onOpenCertificates={onOpenCertificates}
        // Invitations live under All conferences and As a Reviewer (pending list above the table, History tab).
        // Under Author / Chair / Committee only the one-line strip shows, and its button switches to Reviewer.
        banner={({ role, pickRole }: SlotContext) => !inviteRole(role) && (
          <InvitationStrip pending={invitations.pending} onAccept={invitations.openAccept} onDecline={invitations.openDecline} onReview={() => { pickRole("reviewer"); openInvitations(); }} />
        )}
        listTop={({ role }: SlotContext) => inviteRole(role) && (
          <PendingInvitations pending={invitations.pending} onAccept={invitations.openAccept} onDecline={invitations.openDecline} onOpenWorkspace={openWorkspace} />
        )}
        extraView={({ role }: SlotContext) => (inviteRole(role) ? {
          key: "history",
          label: "History",
          render: () => <InvitationList view="history" list={invitations.history} onAccept={invitations.openAccept} onDecline={invitations.openDecline} onOpenWorkspace={openWorkspace} />,
        } : null)}
        listView={listView}
        onListViewChange={changeListView}
      />
      {invitations.ui}
    </Page>
  );
}
