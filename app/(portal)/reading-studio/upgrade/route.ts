import { NextResponse } from "next/server";
import { currentUser } from "@/lib/portal/guard";
import { buyLink, hasTrack, isTrack, type Track } from "@/lib/reading/access";
import { logEvent } from "@/lib/reading/store";

export const dynamic = "force-dynamic";

/**
 * Every "upgrade" button points here: the click is counted (for the administrator's conversion view) and the student goes to the existing checkout
 * for the track they were looking at. Nothing here grants access. The track comes from ?track=, or from where the click happened (an essay test or the
 * reading-tests page means the Indian competitive exams track).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = (url.searchParams.get("from") ?? "page").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "page";
  const asked = url.searchParams.get("track") ?? "";
  const track: Track = isTrack(asked) ? asked : /^(essay|reading-tests)/.test(from) ? "indian" : "skills";
  const base = process.env.PORTAL_APP_URL || url.origin;
  const me = await currentUser();
  if (!me) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/reading-studio/upgrade?from=${from}&track=${track}`)}`, base));
  if (me.role !== "student") return NextResponse.redirect(new URL("/reading-studio", base));
  if (await hasTrack(me.id, track)) return NextResponse.redirect(new URL("/reading-studio/dashboard", base));
  await logEvent(me.id, "cta_click", `${from}:${track}`);
  return NextResponse.redirect(new URL(buyLink(track), base));
}
