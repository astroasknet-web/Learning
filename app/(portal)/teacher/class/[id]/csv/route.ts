import { currentUser } from "@/lib/portal/guard";
import * as classes from "@/lib/lms/classes";

export const dynamic = "force-dynamic";

/** Gradebook download for a class the signed-in teacher owns. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await currentUser();
  if (!me || (me.role !== "teacher" && me.role !== "admin")) return new Response("Please log in.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const id = Math.trunc(Number((await ctx.params).id));
  const cls = Number.isInteger(id) ? await classes.ownedClass(me, id) : null;
  if (!cls) return new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
  const csv = classes.toCsv(await classes.gradebook(cls.id));
  const name = cls.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "class";
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="gradebook-${name}.csv"`, "Cache-Control": "no-store" } });
}
