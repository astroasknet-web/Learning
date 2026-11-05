import { unzipSync } from "fflate";

/**
 * Upload security screening (port of Portal\Scanner). Layered and honest about what it is:
 *  1. ClamAV over a clamd TCP socket when CLAMAV_HOST is set (CLAMAV_PORT, default 3310).
 *  2. Built-in heuristics (always on): EICAR test signature, executable headers, embedded PHP/script, active PDF content (JavaScript, Launch,
 *     embedded files), Office macros, zip bombs, images that are not decodable images.
 * Heuristics catch the common abuse of a document vault; they are not a replacement for a full antivirus engine.
 */
export type ScanResult = ["clean" | "flagged", string];

const latin1 = (b: Uint8Array): string => Buffer.from(b).toString("latin1");
const startsWith = (b: Uint8Array, sig: number[]): boolean => sig.every((x, i) => b[i] === x);

export async function scan(bytes: Uint8Array, ext: string): Promise<ScanResult> {
  let engine = "heuristic";
  if (process.env.CLAMAV_HOST) {
    const r = await clam(bytes);
    if (r === "infected") return ["flagged", "Antivirus engine reported malware"];
    if (r === "clean") engine = "clamav+heuristic";
  }
  const h = heuristics(bytes, ext);
  return h === null ? ["clean", engine] : ["flagged", h];
}

async function clam(bytes: Uint8Array): Promise<"infected" | "clean" | "unavailable"> {
  const net = await import("node:net");
  return new Promise((resolve) => {
    const s = net.connect({ host: process.env.CLAMAV_HOST as string, port: Number(process.env.CLAMAV_PORT ?? 3310) });
    let resp = "";
    s.setTimeout(15000, () => { s.destroy(); resolve("unavailable"); });
    s.on("error", () => resolve("unavailable"));
    s.on("data", (d) => { resp += d.toString("latin1"); });
    s.on("close", () => resolve(resp.includes("FOUND") ? "infected" : resp.includes("OK") ? "clean" : "unavailable"));
    s.write("zINSTREAM\0");
    for (let i = 0; i < bytes.length; i += 8192) {
      const chunk = Buffer.from(bytes.subarray(i, i + 8192));
      const len = Buffer.alloc(4);
      len.writeUInt32BE(chunk.length);
      s.write(Buffer.concat([len, chunk]));
    }
    s.write(Buffer.alloc(4));
  });
}

/** Does the data decode as a PNG or JPEG header (PHP used getimagesize)? */
function isImage(b: Uint8Array): boolean {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return b.length > 24 && latin1(b.subarray(12, 16)) === "IHDR";
  if (startsWith(b, [0xff, 0xd8, 0xff])) {
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return true; // a start-of-frame marker with dimensions
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
  }
  return false;
}

export function heuristics(bytes: Uint8Array, ext: string): string | null {
  if (bytes.length === 0) return "File could not be read";
  const head = latin1(bytes.subarray(0, 8));
  if (head.startsWith("MZ") || head.startsWith("\x7fELF") || head.startsWith("#!") || head.startsWith("\xCA\xFE\xBA\xBE")) return "Executable content is not allowed";
  const size = bytes.length;
  const body = latin1(bytes.subarray(0, 6 * 1024 * 1024)); // scan up to the first 6 MB for signatures
  if (body.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) return "Test malware signature detected";
  if (ext !== "docx" && /<\?php|<\?=|<script[\s>]/i.test(body)) return "Embedded script content is not allowed";
  if (ext === "pdf") {
    if (!body.startsWith("%PDF-")) return "Not a valid PDF";
    if (/\/(JavaScript|JS|Launch|RichMedia|EmbeddedFile|XFA)\b/.test(body)) return "PDF contains active or embedded content (scripts or attachments). Export a flat PDF and try again";
  }
  if (["jpg", "jpeg", "png"].includes(ext) && !isImage(bytes)) return "Not a valid image";
  if (ext === "docx") {
    let files: Record<string, Uint8Array>;
    let total = 0;
    try {
      // Read only the sizes: unzip with a filter that skips every file, collecting the declared uncompressed sizes.
      const names: string[] = [];
      files = unzipSync(bytes, { filter: (f) => { names.push(f.name.toLowerCase()); total += f.originalSize; return false; } });
      void files;
      if (names.length > 2000) return "Document archive is unusually large";
      for (const n of names) if (n.includes("vbaproject") || n.includes("activex") || /\.(exe|dll|bat|js|vbs|ps1)$/.test(n)) return "Word document contains macros or executable parts";
    } catch {
      return "Not a valid Word document";
    }
    if (total > 150 * 1024 * 1024 || (size > 0 && total / size > 200)) return "Document archive expands suspiciously (possible zip bomb)";
  }
  return null;
}
