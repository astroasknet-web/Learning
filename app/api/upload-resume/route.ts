import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isDatabaseConfigured } from "@/lib/data/server";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { hasMagicBytes } from "@/lib/file-signature";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  // Unauthenticated route writing to storage with the service-role key —
  // limit before reading the body so a flood can't stream 10 MB per request.
  const limit = await rateLimit(req, { key: "upload-resume", limit: 5, windowMs: 10 * 60_000 });
  if (!limit.ok) return rateLimited(limit.retryAfterSec);

  // Demo mode (no the database configured): no bucket to write to. Return a
  // placeholder so the apply form can proceed; nothing is stored.
  if (!isDatabaseConfigured()) return NextResponse.json({ path: "demo-preview", url: null });

  try {
    const formData = await req.formData();

    // Bot gate. This route writes to storage with the service-role key and is
    // reachable by anyone, so the rate limit alone (per-instance, and therefore
    // leaky across serverless cold starts) is not enough to stop a scripted
    // flood filling the bucket with 10 MB PDFs. Checked before the file is
    // touched so a rejected caller never costs us an upload.
    const token = formData.get("token");
    if (!(await verifyTurnstile(typeof token === "string" ? token : undefined, "upload-resume"))) {
      return NextResponse.json(
        { error: "Security verification failed. Please refresh and try again." },
        { status: 403 },
      );
    }

    const db = createAdminClient();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    if (file.type !== "application/pdf")
      return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: "File must be under 10 MB." }, { status: 400 });

    const bytes = await file.arrayBuffer();
    // Content-Type is client-supplied and spoofable; confirm the actual bytes
    // are a PDF so the bucket can't be filled with disguised files.
    if (!hasMagicBytes(bytes, "pdf"))
      return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${timestamp}-${safeName}`;

    const { error } = await db.storage
      .from("resumes")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });

    if (error) {
      console.error("the database upload error:", error);
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
    }

    // Signed URL valid for 1 year — used in the confirmation email.
    const { data: signed } = await db.storage
      .from("resumes")
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    // The DB stores `path` (the source of truth); admin views resolve a fresh
    // signed URL from it. If signing fails, return null rather than an unsigned
    // public URL that would be a dead link on a private bucket — the caller
    // already falls back to `path`.
    if (!signed?.signedUrl) console.warn("upload-resume: signed URL creation failed for", path);
    const url = signed?.signedUrl ?? null;

    return NextResponse.json({ path, url });
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
