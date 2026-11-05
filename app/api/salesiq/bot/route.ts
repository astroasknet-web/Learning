import { NextRequest, NextResponse, after } from "next/server";
import { createLogger } from "@/lib/log";
import { routeMessage } from "@/lib/bot/router";
import { verifySalesIqSignature } from "@/lib/bot/signature";
import { recordTurn, extractBotText } from "@/lib/bot/transcript";
import { parseSession, resolvePage, type RawSalesIqPayload } from "@/lib/bot/context";

/**
 * SalesIQ webhook bot entrypoint. See docs/salesiq-bot/WEBHOOK_CONTRACT.md.
 *
 * AUTH (rewritten 2026-08-01, replacing the temporary DIAGNOSTIC_MODE bypass):
 * two accepted proofs, either one sufficient.
 *
 *  1. `x-siqsignature` — an RSA signature over the raw body, verified against
 *     the bot's public key (SALESIQ_PUBLIC_KEY). This is the real mechanism:
 *     the live bot has `webhook.secured = true` with a public key and NO
 *     custom headers configured, confirmed against the SalesIQ API.
 *  2. `x-growqr-bot` — the original shared secret. Retained because it costs
 *     nothing and covers the case where custom webhook headers are configured
 *     later, but SalesIQ does not send it today, so it cannot be the only gate.
 *
 * Fail closed: an unproven request gets 401. `SALESIQ_AUTH_MODE=observe` logs
 * the verdict and proceeds instead — that is the one-live-request escape hatch
 * for pinning the (undocumented) signature variant, see lib/bot/signature.ts.
 * It is IGNORED in production (see observeModeActive) so that a stray env var
 * cannot reopen this endpoint; asking people to remember was not a control.
 *
 * Hard rule: never return a non-2xx to an authenticated request, and never
 * take longer than ~5s — either makes the bot look broken to the visitor.
 * Every path below returns a valid `reply`/`context`/`forward` body,
 * including the catch-all.
 */

const log = createLogger("salesiq-bot");

interface AuthVerdict {
  ok: boolean;
  via: string;
}

function authorize(req: NextRequest, rawBody: string): AuthVerdict {
  const secret = process.env.SALESIQ_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-growqr-bot") === secret) {
    return { ok: true, via: "shared_secret" };
  }

  const result = verifySalesIqSignature(
    rawBody,
    req.headers.get("x-siqsignature"),
    process.env.SALESIQ_PUBLIC_KEY,
  );
  if (result.ok) return { ok: true, via: `signature:${result.matched}` };

  return { ok: false, via: result.reason ?? "unknown" };
}

/**
 * Observe mode downgrades this endpoint to unauthenticated, so it is confined
 * to non-production. Otherwise one stray env var in Vercel would silently turn
 * the bot webhook into an open write path into the CRM pipeline, with only a
 * log line to say so. It exists to pin the undocumented signature variant
 * against a real delivery, which is a thing you do in preview, not in prod.
 */
function observeModeActive(): boolean {
  if (process.env.SALESIQ_AUTH_MODE !== "observe") return false;
  if (process.env.NODE_ENV === "production") {
    log.error("SALESIQ_AUTH_MODE=observe is IGNORED in production — failing closed");
    return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  // Raw text, not req.json(): the signature covers the exact bytes sent, and
  // re-serialising a parsed object would change key order and whitespace.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ action: "reply", replies: [] }, { status: 400 });
  }

  const verdict = authorize(req, rawBody);

  if (!verdict.ok) {
    if (!observeModeActive()) {
      log.warn(`rejected unauthenticated webhook request (${verdict.via})`);
      return NextResponse.json({ action: "reply", replies: [] }, { status: 401 });
    }
    // Observe mode: surface everything needed to pin the signature variant.
    log.warn("SALESIQ_AUTH_MODE=observe — proceeding despite failed auth", {
      reason: verdict.via,
      hasSiqSignature: Boolean(req.headers.get("x-siqsignature")),
      hasSharedSecret: Boolean(req.headers.get("x-growqr-bot")),
      headerNames: [...req.headers.keys()].join(","),
    });
  } else {
    log.info(`authenticated via ${verdict.via}`);
  }

  let payload: RawSalesIqPayload;
  try {
    payload = JSON.parse(rawBody) as RawSalesIqPayload;
  } catch {
    return NextResponse.json({ action: "reply", replies: [] }, { status: 400 });
  }

  try {
    const response = await routeMessage(payload);

    // Transcript capture lives HERE rather than inside routeMessage because
    // this is the only point where both sides of the turn exist: the router
    // has ~20 return sites, and the visitor's message plus the bot's final
    // answer only meet again once one of them has won. parseSession is pure,
    // so calling it a second time costs nothing.
    //
    // after(), so it cannot spend any of SalesIQ's 5-second budget; wrapped,
    // because after() throws outside a request scope and a transcript must
    // never be why a reply fails to send.
    try {
      after(async () => {
        try {
          const session = parseSession(payload);
          await recordTurn({
            conversationId: session.conversationId,
            visitorText: session.text,
            replies: extractBotText(response),
            pagePath: resolvePage(session),
          });
        } catch (error) {
          log.error("recordTurn hook failed:", error);
        }
      });
    } catch (error) {
      log.error("could not schedule recordTurn:", error);
    }

    return NextResponse.json(response);
  } catch (error) {
    // Never let an internal error surface as a broken bot to the visitor.
    log.error("routeMessage threw:", error);
    return NextResponse.json({
      action: "forward",
      replies: ["Something went wrong on our end — let me connect you with our team."],
    });
  }
}
