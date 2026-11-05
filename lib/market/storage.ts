import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Private file storage (port of Portal\Storage). Files are kept on the server's disk under STORAGE_DIR (default ./storage), in one
 * folder per bucket ("resumes", "vault", "internship-resumes" ...). Nothing here is served directly: downloads go through routes that
 * check who is asking (or a signed link, see lib/data/storage.ts).
 *
 * On Hostinger set STORAGE_DIR to a folder outside the app folder (for example /home/<user>/growqr-storage) so a redeploy never
 * touches uploaded files.
 */
const root = (): string => path.resolve(process.env.STORAGE_DIR ?? "storage");

function localPath(bucket: string, p: string): string {
  const safe = p.split("/").map((s) => s.replace(/[^\w.\-]/g, "_")).filter((s) => s !== "" && s !== "." && s !== "..").join("/");
  const folder = ({ vault: "abroad", resumes: "resumes" } as Record<string, string>)[bucket] ?? bucket.replace(/[^\w-]/g, "_");
  return path.join(root(), folder, safe);
}

/** Store (or replace) an object. */
export async function put(bucket: string, p: string, data: Uint8Array, _mime = "application/octet-stream"): Promise<boolean> {
  try {
    const file = localPath(bucket, p);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    return true;
  } catch {
    return false;
  }
}

/** Read an object, or null when it does not exist. */
export async function get(bucket: string, p: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(localPath(bucket, p));
  } catch {
    return null;
  }
}

export async function remove(bucket: string, p: string): Promise<boolean> {
  try {
    await fs.unlink(localPath(bucket, p));
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "ENOENT";
  }
}
