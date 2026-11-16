/** The prototype's demo logins (DEMO_ACCOUNTS / ROLE_CONFIG): shown on Sign in only in sample / mock mode (lib/sample-mode.ts), where a row
 *  just fills in the two boxes. They are sample credentials for the clickable demo, not accounts of this app. */
export const DEMO_ACCOUNTS = [
  { role: "chair", email: "chair@smartconferu.com", password: "chair@123" },
  { role: "author", email: "author@smartconferu.com", password: "author@123" },
  { role: "reviewer", email: "reviewer@smartconferu.com", password: "reviewer@123" },
] as const;

export const DEMO_ROLE_TONE = {
  chair: { label: "Chair", color: "var(--secondary)", bg: "var(--secondary-soft)" },
  author: { label: "Author", color: "var(--primary)", bg: "var(--primary-soft)" },
  reviewer: { label: "Reviewer", color: "var(--success)", bg: "var(--success-soft)" },
} as const;
