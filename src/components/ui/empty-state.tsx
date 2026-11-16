import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="px-4 py-14 text-center">
      <Icon size={28} className="mx-auto mb-3 text-line-strong" aria-hidden="true" />
      <p className="mb-1 text-sm font-semibold text-navy">{title}</p>
      {description && <p className="mx-auto mb-2 max-w-md text-[13px] text-ink-muted">{description}</p>}
      {action}
    </div>
  );
}
