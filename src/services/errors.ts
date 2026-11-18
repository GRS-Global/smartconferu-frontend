/** Supabase isn't configured (missing URL / anon key). Shown as an error, never as an empty list. */
export class ServiceConfigError extends Error {
  constructor(message = "Supabase isn't configured for this app (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).") {
    super(message);
    this.name = "ServiceConfigError";
  }
}

/** There is no signed-in session in this browser. */
export class AuthRequiredError extends Error {
  constructor(message = "Sign in to see your conferences.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

/** The password (or code, or provider) was right, but the account has two-step verification on: the sign-in is finished by sending the code from the
 *  authenticator app (or a recovery code) to `verifyMfa`. Not a failure to show, a step to ask for. */
export class MfaRequiredError extends Error {
  constructor(message = "Enter the code from your authenticator app.") {
    super(message);
    this.name = "MfaRequiredError";
  }
}

/** A failed request, with a sentence that is ready to show. */
export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceError";
  }
}
