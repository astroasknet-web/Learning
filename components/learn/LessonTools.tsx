"use client";

import { useEffect, useState } from "react";

/**
 * Small helpers for long lesson pages (university programme courses have 4-5 lessons per unit, each in a collapsible panel).
 * - HashOpen: when the page is opened at #<lesson-slug> (for example from the course curriculum), open that lesson and scroll to it.
 * - ExpandAll: one button to open or close every lesson panel. Without JavaScript the panels still open by hand.
 */
export function HashOpen() {
  useEffect(() => {
    const go = () => {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (!id) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        window.requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
      }
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);
  return null;
}

export function ExpandAll({ target = "lessons" }: { target?: string }) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    const root = document.getElementById(target);
    if (!root) return;
    const next = !open;
    root.querySelectorAll("details").forEach((d) => { d.open = next; });
    setOpen(next);
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={open} className="min-h-[40px] rounded-lg border border-black/[0.18] bg-white px-4 text-[14px] font-medium text-ink hover:bg-cream-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep">
      {open ? "Collapse all lessons" : "Expand all lessons"}
    </button>
  );
}
