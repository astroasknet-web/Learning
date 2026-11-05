import { ImageResponse } from "next/og";
import { createHash } from "node:crypto";
import { captchaMode, imageCode } from "@/lib/portal/captcha";
import { databaseConfigured } from "@/lib/portal/db";
import { clientIp, fails, recordFail } from "@/lib/portal/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const W = 240;
const H = 80;
const COLORS = ["#4f46e5", "#db2777", "#ea580c", "#0f766e", "#7c3aed", "#be123c", "#1d4ed8"];

/** A number from 0 to 1 that is always the same for the same token and slot, so the picture does not change on reload. */
const rnd = (seed: Buffer, i: number): number => seed[i % seed.length] / 255;

/** Draws the code as a picture (not text), with tilted letters, lines and dots, so it reads for a person and not for a simple script. */
export async function GET(req: Request) {
  const none = (status: number) => new Response("Not available", { status, headers: { "Cache-Control": "no-store" } });
  if (!databaseConfigured() || captchaMode() !== "image") return none(404);
  const token = new URL(req.url).searchParams.get("t") ?? "";
  try {
    const ip = await clientIp();
    if ((await fails(`capimg:${ip}`)) >= 80) return none(429);
    await recordFail(`capimg:${ip}`);
    const code = await imageCode(token);
    if (!code) return none(400);
    const seed = createHash("sha256").update(`look:${token}`).digest();
    const chars = code.split("");
    const lines = [0, 1, 2, 3, 4].map((i) => ({ y: 8 + rnd(seed, i) * (H - 16), a: -18 + rnd(seed, i + 5) * 36, c: COLORS[Math.floor(rnd(seed, i + 10) * COLORS.length)], w: 1.5 + rnd(seed, i + 15) * 1.5 }));
    const dots = Array.from({ length: 26 }, (_, i) => ({ x: rnd(seed, i * 2 + 3) * W, y: rnd(seed, i * 2 + 4) * H, s: 2 + rnd(seed, i + 7) * 3, c: COLORS[i % COLORS.length] }));
    return new ImageResponse(
      (
        <div style={{ width: W, height: H, display: "flex", position: "relative", background: "linear-gradient(120deg,#eef2ff,#fdf2f8 55%,#fff7ed)", overflow: "hidden" }}>
          {dots.map((d, i) => (
            <div key={`d${i}`} style={{ position: "absolute", left: d.x, top: d.y, width: d.s, height: d.s, borderRadius: 9999, background: d.c, opacity: 0.35 }} />
          ))}
          {chars.map((ch, i) => (
            <div
              key={`c${i}`}
              style={{
                position: "absolute",
                left: 14 + i * 36 + (rnd(seed, 20 + i) - 0.5) * 8,
                top: 12 + (rnd(seed, 30 + i) - 0.5) * 14,
                fontSize: 40 + Math.floor(rnd(seed, 40 + i) * 10),
                fontWeight: 800,
                color: COLORS[Math.floor(rnd(seed, 50 + i) * COLORS.length)],
                transform: `rotate(${Math.round(-26 + rnd(seed, 60 + i) * 52)}deg)`,
              }}
            >
              {ch}
            </div>
          ))}
          {lines.map((l, i) => (
            <div key={`l${i}`} style={{ position: "absolute", left: -10, top: l.y, width: W + 20, height: l.w, background: l.c, opacity: 0.55, transform: `rotate(${l.a}deg)` }} />
          ))}
        </div>
      ),
      { width: W, height: H, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return none(500);
  }
}
