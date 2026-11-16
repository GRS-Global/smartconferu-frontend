import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Pages only: skip Next internals and static files (anything with a file extension).
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
