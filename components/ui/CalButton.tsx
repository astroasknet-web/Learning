"use client";

import { buildCalBookingUrl, type BookingSource } from "@/lib/cal";
import { startBooking } from "@/lib/cal/intent";

/**
 * "Book a 15-minute call" trigger, reused on business pages and the seeker
 * waitlist. Plain link that opens the Cal.com booking page in a new tab —
 * no in-page embed/popup on our own site.
 *
 * The click also records a booking intent (lib/cal/intent.ts) so the UTM
 * snapshot and page context survive the hop to Cal's off-site form. That is
 * best-effort by construction: the `href` below already carries `source`, so if
 * JavaScript never runs, or the beacon is blocked, the link still works and the
 * booking is still attributed to the right surface — just without campaign
 * detail.
 */
export default function CalButton({
  label = "Book a 15-minute call",
  className,
  source,
  solution,
  agent,
}: {
  label?: string;
  className?: string;
  /** Which surface this button lives on — see BOOKING_SOURCES in lib/cal.ts. */
  source: BookingSource;
  solution?: string | null;
  agent?: string | null;
}) {
  return (
    <a
      href={buildCalBookingUrl({ source })}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(event) => {
        // Modified clicks (new tab/window, middle click) are the browser's to
        // handle — hijacking them would break expected behaviour for the sake
        // of attribution.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        // Synchronous: startBooking never awaits, so the user gesture is still
        // in scope when window.open runs and the tab is not popup-blocked.
        window.open(startBooking({ source, solution, agent }), "_blank", "noopener,noreferrer");
      }}
    >
      {label}
    </a>
  );
}
