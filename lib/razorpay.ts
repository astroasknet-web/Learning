import Razorpay from "razorpay";

// Server-side Razorpay client. key_secret never leaves the server.
let cached: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (cached) return cached;
  const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error("Razorpay keys not configured");
  cached = new Razorpay({ key_id, key_secret });
  return cached;
}
