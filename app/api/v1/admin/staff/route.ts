import { z } from "zod";
import { grantStaff } from "@/lib/pay/admin";
import { pool, rows } from "@/lib/pay/db";
import { ok, staffApi } from "@/lib/pay/http";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/staff: who has which payment role (permission: manage_staff, admins only). Portal admins always have the admin role. */
export const GET = staffApi("manage_staff", async () =>
  ok(await rows(pool, "SELECT s.user_id AS userId, s.role, u.email, u.name FROM pay_staff s JOIN users u ON u.id = s.user_id ORDER BY s.created_at")));

const schema = z.object({ userId: z.number().int().positive(), role: z.enum(["support", "finance", "admin"]).nullable() });

/** POST /api/v1/admin/staff: grant a role, or revoke it with role null. Separation of duties: nobody can change their own role. */
export const POST = staffApi("manage_staff", async (req, staff) => {
  const b = schema.parse(await req.json().catch(() => ({})));
  if (b.userId === staff.user.id) return Response.json({ error: { code: "forbidden", message: "You cannot change your own payment role." } }, { status: 403 }) as never;
  await grantStaff(staff.user.id, b.userId, b.role);
  return ok({ done: true });
});
