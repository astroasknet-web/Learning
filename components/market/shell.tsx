import type { ReactNode } from "react";
import { databaseConfigured } from "@/lib/portal/db";
import { getSession } from "@/lib/portal/session";
import type { PortalUser } from "@/lib/portal/session";
import SiteChrome from "@/components/layout/SiteChrome";
import PortalSidebar from "@/components/portal/sidebar";
import { groupsFor } from "@/components/portal/shell";

/** Page frame for the public marketplace pages (internships, courses): logo, a small menu and, once signed in, the student's links. */
export async function currentViewer(): Promise<PortalUser | null> {
  if (!databaseConfigured()) return null;
  try {
    return (await getSession())?.user ?? null;
  } catch {
    return null;
  }
}


export function MarketShell({ user, active, children }: { user: PortalUser | null; active: "internships" | "courses" | "abroad" | "applications" | "employer" | ""; children: ReactNode }) {
  // A signed-in student browsing internships keeps their sidebar, so the menu looks the same on every page they use.
  if (user && user.role === "student" && (active === "internships" || active === "applications")) {
    return (
      <SiteChrome>
        <div className="min-h-[60vh] bg-cream-2">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-start lg:gap-8 lg:py-8">
            <PortalSidebar user={{ name: user.name, email: user.email, role: user.role }} groups={groupsFor(user.role)} active={active} />
            <main id="main" className="w-full min-w-0 flex-1">{children}</main>
          </div>
        </div>
      </SiteChrome>
    );
  }
  return (
    <SiteChrome>
      <div className="min-h-[60vh] bg-cream-2"><main id="main" className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">{children}</main></div>
    </SiteChrome>
  );
}
