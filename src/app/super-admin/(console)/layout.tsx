"use client";
import { ConsoleShell } from "@/features/super-admin/components/shell";
import { AdminSessionProvider } from "@/features/super-admin/session";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sa-root">
      <AdminSessionProvider>
        <ConsoleShell>{children}</ConsoleShell>
      </AdminSessionProvider>
    </div>
  );
}
