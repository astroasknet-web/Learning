import { z } from "zod";
import { ok, staffApi } from "@/lib/pay/http";
import { PayError } from "@/lib/pay/orders";
import { listItems, listRuns, reconcileProvider } from "@/lib/pay/reconcile";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/reconciliation[?runId=]: recent runs, or the differences found in one run (permission: view) */
export const GET = staffApi((m) => (m === "GET" ? "view" : "reconcile"), async (req) => {
  const run = new URL(req.url).searchParams.get("runId");
  return ok(run ? await listItems(Number(run)) : await listRuns());
});

const schema = z.object({ provider: z.enum(["razorpay", "stripe"]), hours: z.number().int().min(1).max(24 * 14).default(48), confirm: z.literal(true) });

/** POST /api/v1/admin/reconciliation: run a reconciliation now. Body: { provider, hours?, confirm: true }  (permission: reconcile) */
export const POST = staffApi("reconcile", async (req, staff) => {
  const b = schema.parse(await req.json().catch(() => ({})));
  const to = new Date();
  try {
    return ok(await reconcileProvider(b.provider, { from: new Date(to.getTime() - b.hours * 3_600_000), to }, `staff:${staff.user.id}`), 201);
  } catch (e) {
    throw e instanceof PayError ? e : new PayError("reconciliation_failed", "The reconciliation could not be completed. Check the provider settings.", 502);
  }
});
