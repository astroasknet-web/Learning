export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getRazorpay } from "@/lib/razorpay";
import { resolveBookingAmountINR } from "@/lib/payments/booking-amount";
import { getExpertBySlug } from "@/features/experts/data/experts-data";
import { rateLimit, rateLimited } from "@/lib/rate-limit";

// POST /api/razorpay/order
// Body: { slug: string; start?: string; name?: string; email?: string; topic?: string }
// The charge amount is derived server-side from the expert slug — never trusted
// from the client. Booking intent is stored in the order notes so the payment
// can be reconciled later if needed.
export async function POST(req: NextRequest) {
  const limit = await rateLimit(req, { key: "razorpay-order", limit: 10, windowMs: 10 * 60_000 });
  if (!limit.ok) return rateLimited(limit.retryAfterSec);

  try {
    const body = await req.json().catch(() => ({}));
    const slug: string | undefined = body.slug;

    if (!slug || typeof slug !== "string") {
      return NextResponse.json(
        { status: "error", error: "Missing expert slug" },
        { status: 400 },
      );
    }

    const expert = getExpertBySlug(slug);
    if (!expert) {
      return NextResponse.json(
        { status: "error", error: "Expert not found" },
        { status: 404 },
      );
    }

    const amountINR = resolveBookingAmountINR(slug);
    if (!amountINR || amountINR <= 0) {
      return NextResponse.json(
        { status: "error", error: "Could not determine session price" },
        { status: 500 },
      );
    }

    const rzp = getRazorpay();
    const order = await rzp.orders.create({
      amount: amountINR * 100, // paise
      currency: "INR",
      receipt: `growqr_${Date.now()}`,
      notes: {
        slug,
        start: typeof body.start === "string" ? body.start : "",
        name: typeof body.name === "string" ? body.name : "",
        email: typeof body.email === "string" ? body.email : "",
        topic: typeof body.topic === "string" ? body.topic : "",
      },
    });

    return NextResponse.json({
      status: "success",
      orderId: order.id,
      amount: order.amount, // paise
      currency: order.currency,
    });
  } catch (err) {
    // Log the detail; don't hand Razorpay internals to the caller.
    const message = err instanceof Error ? err.message : "Failed to create order";
    console.error("[razorpay/order]", message);
    return NextResponse.json({ status: "error", error: "Failed to create order" }, { status: 500 });
  }
}
