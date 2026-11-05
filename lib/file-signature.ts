/**
 * Server-side content-type validation by magic bytes ("file signature").
 *
 * A browser-supplied `Content-Type` / `File.type` is client-controlled and
 * trivially spoofed, so the upload routes cannot trust it alone. Callers still
 * enforce the declared MIME and the size limit; this confirms the actual bytes
 * begin with the signature for the type they claim to be. Valid files always
 * carry these signatures, so legitimate uploads are unaffected.
 */
export type UploadKind = "pdf" | "png" | "jpeg" | "webp";

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) return false;
  }
  return true;
}

/** True if `buf` begins with the file signature for `kind`. */
export function hasMagicBytes(buf: ArrayBuffer, kind: UploadKind): boolean {
  const b = new Uint8Array(buf);
  switch (kind) {
    case "pdf":
      // "%PDF-"
      return startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case "png":
      return startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpeg":
      // JPEG SOI marker; covers JFIF/Exif variants.
      return startsWith(b, [0xff, 0xd8, 0xff]);
    case "webp":
      // "RIFF" <4 bytes size> "WEBP"
      return (
        startsWith(b, [0x52, 0x49, 0x46, 0x46]) &&
        b.length >= 12 &&
        b[8] === 0x57 &&
        b[9] === 0x45 &&
        b[10] === 0x42 &&
        b[11] === 0x50
      );
  }
}

/** Map a validated image MIME to its UploadKind (null if not an allowed image). */
export function imageKindFromMime(mime: string): UploadKind | null {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpeg";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}
