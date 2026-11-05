import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import * as files from "@/lib/market/storage";
import { appSecret } from "@/lib/portal/crypto";
import type { Storage } from "./client";

/**
 * Uploaded files (resumes, expert photos ...) live on the server's disk (lib/market/storage.ts). A "signed link" is a URL that carries
 * its own expiry and an HMAC of bucket + path + expiry made with the app secret, so it can be handed to an admin or put in an email
 * without making the file public, and stops working when it expires.
 */
const origin = (): string => (process.env.PORTAL_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

async function sign(bucket: string, path: string, exp: number): Promise<string> {
  return createHmac("sha256", await appSecret()).update(`file\n${bucket}\n${path}\n${exp}`).digest("hex");
}

export async function verifySignedFile(bucket: string, path: string, exp: string | null, sig: string | null): Promise<boolean> {
  const n = Number(exp);
  if (!sig || !Number.isFinite(n) || n < Math.floor(Date.now() / 1000)) return false;
  const want = Buffer.from(await sign(bucket, path, n));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

const fail = (message: string) => ({ message, code: "STORAGE", details: message, hint: "" });

export const storage: Storage = {
  from(bucket: string) {
    return {
      async upload(path, body) {
        const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
        return (await files.put(bucket, path, bytes)) ? { data: { path }, error: null } : { data: null, error: fail("Could not save the file") };
      },
      async createSignedUrl(path, expiresInSeconds) {
        const exp = Math.floor(Date.now() / 1000) + Math.max(60, Math.trunc(expiresInSeconds));
        const sig = await sign(bucket, path, exp);
        const url = `${origin()}/api/files/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}?exp=${exp}&sig=${sig}`;
        return { data: { signedUrl: url }, error: null };
      },
      async download(path) {
        const buf = await files.get(bucket, path);
        return buf ? { data: new Blob([new Uint8Array(buf)]), error: null } : { data: null, error: fail("Object not found") };
      },
      getPublicUrl(path) {
        return { data: { publicUrl: `${origin()}/api/files/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}` } };
      },
      async remove(paths) {
        for (const p of paths) await files.remove(bucket, p);
        return { data: [], error: null };
      },
    };
  },
};
