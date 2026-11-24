import Image from "next/image";
import Link from "next/link";
import { ProfileProgress, UserMenu } from "@/features/auth/components/user-menu";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { NAV_GROUPS } from "@/lib/navigation";
import { MobileNav } from "./mobile-nav";
import { NavDropdown } from "./nav-dropdown";

/** Sticky top bar: brand and menus on the left, actions on the right (h-16, as in the prototype). */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 w-full border-b border-line/80 bg-white/90 backdrop-blur-md">
      <div className="relative flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:gap-6">
        <div className="flex min-w-0 items-center gap-2 lg:gap-6">
          <MobileNav />
          <Link href="/dashboard" aria-label="Smartconferu home" className="shrink-0 transition-opacity hover:opacity-85">
            <Image src="/smartconferu-lockup.png" alt="Smartconferu" width={127} height={32} priority className="h-8 w-auto" />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
            {NAV_GROUPS.map((group) => (
              <NavDropdown key={group.label} group={group} />
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <ProfileProgress />
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
