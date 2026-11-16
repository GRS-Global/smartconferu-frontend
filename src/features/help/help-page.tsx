import { Bell, ChevronRight, CreditCard, FileText, LifeBuoy, Ticket, UserCog, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";

/* Help (the prototype's HelpPage): quick answers for the most common tasks,each with a link where there is a page for it. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const TOPICS: Array<{ icon: LucideIcon; title: string; body: string; link?: { label: string; href: string } }> = [
  { icon: FileText, title: "Submitting a paper", body: "Open a conference from My Conferences as an Author, then start a New Submission.", link: { label: "My Conferences", href: "/dashboard" } },
  { icon: Users, title: "Reviewing papers", body: "Papers assigned to you appear under the Reviewer role for that conference, together with the review form." },
  { icon: Ticket, title: "Registering for a conference", body: "Open the conference's registration form, pick Physical or Virtual, then fill in that type's form." },
  { icon: UserCog, title: "Your profile", body: "Update your photo, personal details, scholar and professional profile links from My Profile.", link: { label: "My Profile", href: "/profile" } },
  { icon: Bell, title: "Notifications", body: "Email notifications are always on. Add a mobile number in My Profile to also get SMS or WhatsApp alerts.", link: { label: "Notification preferences", href: "/settings" } },
  { icon: CreditCard, title: "Receipts", body: "Your payment receipts are under Account › My Receipts.", link: { label: "My Receipts", href: "/receipts" } },
];

export function HelpPage() {
  return (
    <>
      <PageHeader title="Help" />
      <div className="p-4 sm:p-8">
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-line bg-canvas p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft"><LifeBuoy size={19} aria-hidden="true" className="text-primary" /></div>
          <div>
            <p className="text-sm font-semibold text-ink">How can we help?</p>
            <p className="mt-0.5 text-xs text-ink-muted">Quick answers for the most common tasks on Smartconferu.</p>
          </div>
        </div>
        <div className="grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2">
          {TOPICS.map(({ icon: Icon, title, body, link }) => (
            <div key={title} style={CARD} className="rounded-2xl bg-white p-5">
              <div className="mb-2 flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon size={15} aria-hidden="true" /></div>
                <h3 className="text-sm font-bold text-navy">{title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-ink-muted">{body}</p>
              {link && (link.href.startsWith("/")
                ? <Link href={link.href} className="mt-3 flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline">{link.label} <ChevronRight size={12} aria-hidden="true" /></Link>
                : <a href={link.href} className="mt-3 flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline">{link.label} <ChevronRight size={12} aria-hidden="true" /></a>)}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
