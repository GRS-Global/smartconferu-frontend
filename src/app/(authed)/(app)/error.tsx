"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-4 sm:p-8">
      <div className="rounded-2xl border border-line bg-white">
        <EmptyState
          icon={TriangleAlert}
          title="Something went wrong loading this page."
          description="Try again. If it keeps happening, contact support."
          action={<Button size="sm" onClick={reset}>Try again</Button>}
        />
      </div>
    </div>
  );
}
