import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardView, type DashboardVariant } from "@/features/dashboard/components/dashboard-view";

export const metadata: Metadata = { title: "My Conferences" };

// Same URLs as the prototype: /dashboard/a, /b, /c (the layouts first shown to the client) and /d (the default).
const VARIANTS: DashboardVariant[] = ["a", "b", "c", "d"];

export function generateStaticParams() {
  return VARIANTS.map((variant) => ({ variant }));
}

export default async function DashboardVariantPage({ params }: PageProps<"/dashboard/[variant]">) {
  const { variant } = await params;
  if (!VARIANTS.includes(variant as DashboardVariant)) notFound();
  return (
    <DashboardView variant={variant as DashboardVariant} />
  );
}
