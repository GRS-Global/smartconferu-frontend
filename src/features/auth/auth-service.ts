import { DATA_SOURCE } from "@/lib/config";
import type { AuthService } from "@/services/auth";

/** The auth service. There is none in mock mode (mock has no accounts and never reaches Supabase). */
export async function authService(): Promise<AuthService> {
  if (DATA_SOURCE === "mock") throw new Error("Sign-in is not available in mock data mode.");
  if (DATA_SOURCE === "api") return (await import("@/services/api/auth")).apiAuthService;
  return (await import("@/services/supabase/auth")).supabaseAuthService;
}
