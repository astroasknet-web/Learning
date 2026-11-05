import { NextResponse } from "next/server";
import { currentUser } from "@/lib/portal/guard";
import { hasAnalytics } from "@/lib/reading/access";
import { getAssessment, reviewItems } from "@/lib/reading/store";
import { buildResults } from "@/lib/reading/views";

export const dynamic = "force-dynamic";

const q = (v: unknown): string => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // a spreadsheet must never run a student's text as a formula
  return `"${s.replace(/"/g, '""')}"`;
};

/** The student's own report as a CSV: summary, area scores, skills and every question. Package students only; the server checks, not the page. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me || me.role !== "student") return NextResponse.redirect(new URL("/login", process.env.PORTAL_APP_URL ?? "http://localhost:3000"));
  const { id } = await ctx.params;
  if (!(await hasAnalytics(me.id))) return new NextResponse("Reports are part of the Reading Studio package.", { status: 403 });
  const a = await getAssessment(me.id, id);
  const v = a && a.status === "submitted" ? await buildResults(me.id, id) : null;
  if (!a || !v) return new NextResponse("Not found", { status: 404 });
  const lines: string[] = [];
  lines.push(["English Reading Studio report"].map(q).join(","));
  lines.push(["Assessment", a.kind, "Date", a.submittedAt, "Version", v.version].map(q).join(","));
  lines.push(["Overall score (provisional)", v.overall.score ?? "n/a", "Classification", v.overall.classification ?? ""].map(q).join(","));
  lines.push(["Reading speed (estimate, wpm)", v.tiles.wpm ?? "n/a", "Comprehension %", v.tiles.comprehensionPct ?? "n/a", "Accuracy %", v.tiles.qaPct ?? "n/a"].map(q).join(","));
  lines.push("");
  lines.push(["Area", "Score", "Weight %", "Counts for %", "Points added"].map(q).join(","));
  for (const d of v.dimensions) lines.push([d.label, d.score ?? "not assessed", d.weight, d.score === null ? 0 : d.effectiveWeight, d.contribution].map(q).join(","));
  lines.push("");
  lines.push(["Skill", "Correct", "Asked", "Accuracy %", "Confidence"].map(q).join(","));
  for (const s of v.skills ?? []) lines.push([s.label, s.correct, s.attempted, s.accuracy ?? "n/a", s.confidence].map(q).join(","));
  lines.push("");
  lines.push(["#", "Skill", "Result", "Your answer", "Supported answer", "Seconds", "Guide seconds"].map(q).join(","));
  (await reviewItems(a)).forEach((r, i) => lines.push([i + 1, r.skill, r.correct ? "correct" : r.skipped ? "not answered" : "incorrect", r.chosen, r.correctText, r.ms === null ? "" : Math.round(r.ms / 1000), r.expectedSecs].map(q).join(",")));
  return new NextResponse(lines.join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="reading-report-${id.slice(0, 8)}.csv"`, "cache-control": "no-store" } });
}
