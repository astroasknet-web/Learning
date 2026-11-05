import { getAttributionPayload } from "@/lib/attribution";
import { buildCalBookingUrl, type BookingSource } from "@/lib/cal";

/**
 * Client half of the attribution bridge.
 *
 * cal.com is an off-site page, so the moment the visitor leaves growqr.ai
 * everything we know about how they got here — the first-touch UTM snapshot in
 * sessionStorage, the page they clicked from, the modal's solution/agent
 * context — is gone. This parks that context server-side under a uuid and hands
 * the visitor the uuid to carry across in a hidden Cal booking question.
 *
 * WHY FIRE-AND-FORGET, NOT AWAIT. The booking link opens in a new tab. Browsers
 * only allow window.open() while a user gesture is still in scope, and awaiting
 * a fetch ends that scope — Safari in particular would then block the tab. So
 * the uuid is generated locally, the context is posted with sendBeacon (which
 * returns immediately and is delivered by the browser even as the page changes),
 * and the URL is built and opened synchronously.
 *
 * If the beacon never lands — ad blocker, private mode, offline — the booking
 * still works. `source` rides in the URL independently, and the attribution
 * columns stay null, which every downstream consumer already tolerates
 * (deriveLeadSource resolves "Website", exactly as it does for bot leads).
 */

export interface BookingContext {
  source: BookingSource;
  /** Enterprise-modal context, when the click came from one. */
  solution?: string | null;
  agent?: string | null;
}

/**
 * Record the intent and return the URL to open. Never throws: a failure here
 * must cost attribution, never the booking.
 */
export function startBooking(context: BookingContext): string {
  const intentId = newIntentId();
  if (!intentId) return buildCalBookingUrl({ source: context.source });

  try {
    const body = JSON.stringify({
      intentId,
      source: context.source,
      solution: context.solution ?? null,
      agent: context.agent ?? null,
      attribution: getAttributionPayload(),
    });

    // sendBeacon is the only transport guaranteed to survive the navigation
    // that follows. Content-Type matters: without it the browser sends
    // text/plain and the route's JSON.parse still works, but being explicit
    // keeps the request readable in devtools and in logs.
    const blob = new Blob([body], { type: "application/json" });
    const queued = navigator.sendBeacon?.("/api/cal/intent", blob);

    if (!queued) {
      // Older browsers, or a beacon queue that is full. keepalive lets the
      // request outlive the page the same way.
      void fetch("/api/cal/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Storage blocked, serialization failed — fall through with the id anyway.
    // A booking with an unmatched intent is exactly as usable as one with none.
  }

  return buildCalBookingUrl({ source: context.source, intentId });
}

function newIntentId(): string | null {
  try {
    // randomUUID requires a secure context; http://localhost counts, plain http
    // on a LAN address does not — hence the guard rather than a bare call.
    return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : null;
  } catch {
    return null;
  }
}
