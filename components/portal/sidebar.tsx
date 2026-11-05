"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { BookOpen, Briefcase, ClipboardList, FileText, Globe2, GraduationCap, LayoutDashboard, LifeBuoy, LogOut, Menu, PlusSquare, QrCode, Receipt, Share2, ShieldCheck, UserRound, Users, Video, X } from "lucide-react";
import { logoutAction } from "@/app/(portal)/actions";

/** The signed-in person's menu: a vertical sidebar on large screens, a slide-in drawer on small ones, with Log out pinned at the bottom. */
export type IconKey = "account" | "passport" | "studio" | "internships" | "applications" | "courses" | "classes" | "abroad" | "share" | "hiring" | "post" | "crm" | "console" | "caseload" | "teacher" | "children" | "billing" | "support";
export interface NavItem { key: string; href: string; label: string; icon: IconKey }
export interface NavGroup { title: string; items: NavItem[] }

const ICONS: Record<IconKey, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  account: LayoutDashboard, passport: QrCode, studio: FileText, internships: Briefcase, applications: ClipboardList, courses: BookOpen, classes: Video,
  abroad: Globe2, share: Share2, hiring: Users, post: PlusSquare, crm: Globe2, console: ShieldCheck, caseload: Users, teacher: GraduationCap, children: UserRound, billing: Receipt, support: LifeBuoy,
};
const ROLE: Record<string, string> = { student: "Student", teacher: "Teacher", parent: "Parent", employer: "Employer", admin: "Administrator", counselor: "Counsellor" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function Panel({ user, groups, active, onNavigate }: { user: { name: string; email: string; role: string }; groups: NavGroup[]; active: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-black/[0.07] p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#7857ff] via-[#d946ef] to-[#ff6a2f] text-[15px] font-bold text-white shadow-md" aria-hidden>{initials(user.name)}</span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink">{user.name}</p>
          <p className="truncate text-[12.5px] text-ink-4">{user.email}</p>
          <span className="mt-1 inline-block rounded-full bg-orange-light px-2 py-0.5 text-[11px] font-semibold text-orange-deep">{ROLE[user.role] ?? user.role}</span>
        </div>
      </div>

      <nav aria-label="Account" className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.title} className="mb-5 last:mb-0">
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((n) => {
                const Icon = ICONS[n.icon];
                const on = active === n.key;
                return (
                  <li key={n.key}>
                    <Link
                      href={n.href}
                      onClick={onNavigate}
                      aria-current={on ? "page" : undefined}
                      className={`group relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium transition ${on ? "bg-gradient-to-r from-orange-light to-orange-lighter text-ink" : "text-ink-3 hover:bg-cream-2 hover:text-ink"}`}
                    >
                      {on ? <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-orange" aria-hidden /> : null}
                      <Icon className={`h-[18px] w-[18px] shrink-0 transition ${on ? "text-orange" : "text-ink-4 group-hover:text-ink-2"}`} aria-hidden />
                      <span className="truncate">{n.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-black/[0.07] p-3">
        <form action={logoutAction}>
          <button type="submit" className="flex min-h-[46px] w-full items-center gap-3 rounded-xl px-3 text-[14.5px] font-semibold text-ink-3 transition hover:bg-red-50 hover:text-red-700">
            <LogOut className="h-[18px] w-[18px]" aria-hidden /> Log out
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PortalSidebar({ user, groups, active }: { user: { name: string; email: string; role: string }; groups: NavGroup[]; active: string }) {
  const [open, setOpen] = useState(false);
  const current = groups.flatMap((g) => g.items).find((n) => n.key === active)?.label ?? "Menu";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Large screens: a sticky sidebar under the site bar. */}
      <aside className="sticky top-[132px] hidden h-[calc(100vh-152px)] w-[280px] shrink-0 overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-card lg:block" aria-label="Your account">
        <Panel user={user} groups={groups} active={active} />
      </aside>

      {/* Small screens: a bar showing where you are, and a drawer. */}
      <div className="lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="portal-drawer" className="flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] font-semibold text-ink shadow-card">
          <span className="flex items-center gap-2.5"><Menu className="h-5 w-5 text-orange" aria-hidden /> {current}</span>
          <span className="text-[12.5px] font-medium text-ink-4">Menu</span>
        </button>
        {open ? (
          <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Account menu">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div id="portal-drawer" className="absolute inset-y-0 left-0 w-[88vw] max-w-[340px] bg-white shadow-2xl">
              <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-ink-3 hover:bg-cream-2" aria-label="Close menu"><X className="h-5 w-5" aria-hidden /></button>
              <Panel user={user} groups={groups} active={active} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
