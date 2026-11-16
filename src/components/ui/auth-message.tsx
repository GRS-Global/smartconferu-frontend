import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Inline success / error banner for auth forms (errors are announced assertively). */
export function AuthMessage({ tone = "success", children }: { tone?: "error" | "success"; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("mb-3 rounded-lg px-3.5 py-2.5 text-sm font-medium", tone === "error" ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>
      {children}
    </div>
  );
}
