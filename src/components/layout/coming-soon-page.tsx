"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";

interface ComingSoonPageProps {
  title: string;
  /** An element such as <Award size={22} /> (a component itself cannot be handed from a server page to this client component). */
  icon: ReactNode;
  /** One or two sentences on what the page will be. */
  description: string;
  /** The menu the page sits under, for the breadcrumb. */
  section?: string;
}

/** A menu page that is not built yet: the title, a "Coming soon" card and a way back. Inside the signed-in app shell (the top bar stays). */
export function ComingSoonPage({ title, icon, description, section }: ComingSoonPageProps) {
  const router = useRouter();
  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push("/dashboard");
  };
  return (
    <>
      <PageHeader title={title} breadcrumbs={[...(section ? [{ label: section }] : []), { label: title }]} />
      <div className="px-4 pb-10 pt-6 sm:px-8">
        <div className="mx-auto max-w-[520px] rounded-2xl border border-line bg-white px-8 py-12 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">{icon}</span>
          <span className="inline-block rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">Coming soon</span>
          <h2 className="mt-3 text-lg font-bold text-navy">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>
          <button type="button" onClick={back} className="mt-6 cursor-pointer rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover">Go back</button>
        </div>
      </div>
    </>
  );
}
