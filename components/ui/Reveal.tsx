"use client";

import type { ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right";

interface RevealProps {
  children: ReactNode;
  /** @deprecated kept for API compatibility — no longer animates. */
  direction?: Direction;
  /** @deprecated kept for API compatibility — no longer animates. */
  offset?: number;
  /** @deprecated kept for API compatibility — no longer animates. */
  delay?: number;
  /** @deprecated kept for API compatibility — no longer animates. */
  duration?: number;
  /** @deprecated kept for API compatibility — no longer animates. */
  scrub?: boolean | number;
  /** @deprecated kept for API compatibility — no longer animates. */
  start?: string;
  /** @deprecated kept for API compatibility — no longer animates. */
  end?: string;
  /** @deprecated kept for API compatibility — no longer animates. */
  stagger?: number | null;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * Reveal — render-only passthrough.
 *
 * RELIABILITY OVER EFFECTS: this used to drive a GSAP + ScrollTrigger
 * scroll-reveal (content started at opacity:0 + offset and faded in when its
 * trigger fired). On cold first loads the trigger start-positions were
 * computed against an unsettled layout (fonts/images not yet loaded), so
 * above-the-fold sections never fired and stayed blank/shifted until a manual
 * reload. That was the production "blank sections on first visit" bug.
 *
 * The animation has been removed entirely. Children now render in their final
 * position, fully visible, on first paint — with NO dependency on JavaScript,
 * ScrollTrigger, IntersectionObserver, or any scroll position. Content can
 * never be left hidden. The props are kept only so the ~25 existing call sites
 * compile unchanged.
 */
export default function Reveal({
  children,
  className,
  as = "div",
}: RevealProps) {
  const Tag = as as React.ElementType;
  return <Tag className={className}>{children}</Tag>;
}
