import { cn } from "@/lib/cn";

/** Initials from the real name (or the email's first letter) — never an invented person. */
export function initialsOf(firstName: string, lastName: string, email: string): string {
  const letters = [firstName, lastName].map((s) => s.trim()[0]).filter(Boolean).join("");
  return (letters || email.trim()[0] || "").toUpperCase();
}

interface ProfileAvatarProps {
  photoUrl: string;
  initials: string;
  size?: number;
  className?: string;
}

export function ProfileAvatar({ photoUrl, initials, size = 40, className }: ProfileAvatarProps) {
  return photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- a user-uploaded Supabase Storage URL; not worth an image-optimizer remote pattern
    <img src={photoUrl} alt="" width={size} height={size} style={{ width: size, height: size }} className={cn("shrink-0 rounded-full object-cover", className)} />
  ) : (
    // The prototype's DefaultAvatar (initials variant): a plain person silhouette rather than a "?" while there is no name yet.
    <span aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: "#E2E8F0", color: !initials || initials === "?" ? "#94A3B8" : "#334155", letterSpacing: "0.02em" }} className={cn("inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold leading-none", className)}>
      {!initials || initials === "?" ? (
        <svg width="100%" height="100%" viewBox="0 0 64 64" className="block">
          <circle cx="32" cy="25" r="11" fill="currentColor" />
          <path d="M12 58c1.5-11 9.5-18 20-18s18.5 7 20 18z" fill="currentColor" />
        </svg>
      ) : initials}
    </span>
  );
}
