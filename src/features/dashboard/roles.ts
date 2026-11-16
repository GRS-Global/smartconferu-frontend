import { Building2, Eye, FileText, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import type { ConferenceRole } from "@/types/conference";

export type RoleFilter = "all" | ConferenceRole;

export interface RoleMeta {
  label: string;
  /** Short label used on chips. */
  chip: string;
  icon: LucideIcon;
  /** Solid accent (icon tile, active border, numbers). */
  accent: string;
  /** Soft tint behind the active tile and chip. */
  soft: string;
}

export const ROLE_META: Record<RoleFilter, RoleMeta> = {
  all: { label: "All conferences", chip: "All", icon: Building2, accent: "var(--navy)", soft: "var(--muted)" },
  author: { label: "As Author", chip: "Author", icon: FileText, accent: "var(--primary)", soft: "var(--primary-soft)" },
  chair: { label: "As Chair", chip: "Chair", icon: ShieldCheck, accent: "var(--secondary)", soft: "var(--secondary-soft)" },
  reviewer: { label: "As Reviewer", chip: "Reviewer", icon: Eye, accent: "var(--success)", soft: "var(--success-soft)" },
  committee: { label: "As Committee Member", chip: "Committee", icon: Users, accent: "var(--cat-virtual)", soft: "var(--cat-virtual-soft)" },
};

/** Order of the role cards: All, then Chair, Author, Reviewer, Committee. */
export const ROLE_ORDER: RoleFilter[] = ["all", "chair", "author", "reviewer", "committee"];
