import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import {
  parseGrowqrProfileId,
  fetchGrowqrProfile,
  buildProfileSummary,
} from "@/lib/growqr-profile";

/**
 * Resolves a pasted GrowQR profile link into the trimmed summary the
 * internship form uses to prefill itself.
 *
 * Read-only over data the profile page already serves publicly, so there's no
 * new exposure here. It's rate limited anyway: it makes an outbound request
 * per call and shouldn't become a way to hammer the app from our origin.
 */
export async function GET(req: NextRequest) {
  const limit = await rateLimit(req, { key: "growqr-profile", limit: 20, windowMs: 10 * 60_000 });
  if (!limit.ok) return rateLimited(limit.retryAfterSec);

  const input = req.nextUrl.searchParams.get("url") ?? "";
  const id = parseGrowqrProfileId(input);

  if (!id) {
    return NextResponse.json(
      { error: "Enter your GrowQR profile link, for example https://app.growqr.ai/p/your-id" },
      { status: 400 }
    );
  }

  const result = await fetchGrowqrProfile(id);

  if (result.status === "not_found") {
    return NextResponse.json(
      { error: "We couldn't find that GrowQR profile. Check the link and try again." },
      { status: 404 }
    );
  }

  if (result.status === "unavailable") {
    return NextResponse.json(
      { error: "Couldn't reach GrowQR just now. You can keep filling the form and continue." },
      { status: 503 }
    );
  }

  return NextResponse.json({ profile: buildProfileSummary(result.profile) });
}
