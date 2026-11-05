import { describe, it, expect } from "vitest";
import { hasMagicBytes, imageKindFromMime } from "./file-signature";

function buf(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe("hasMagicBytes", () => {
  it("accepts a real PDF header and rejects a spoofed one", () => {
    expect(hasMagicBytes(buf([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]), "pdf")).toBe(true);
    // Bytes claiming to be a PDF but starting with HTML/script.
    expect(hasMagicBytes(buf([0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]), "pdf")).toBe(false);
  });

  it("accepts PNG, JPEG and WebP signatures", () => {
    expect(hasMagicBytes(buf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "png")).toBe(true);
    expect(hasMagicBytes(buf([0xff, 0xd8, 0xff, 0xe0]), "jpeg")).toBe(true);
    expect(
      hasMagicBytes(buf([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), "webp"),
    ).toBe(true);
  });

  it("rejects the wrong image type and too-short buffers", () => {
    // A PNG passed off as JPEG.
    expect(hasMagicBytes(buf([0x89, 0x50, 0x4e, 0x47]), "jpeg")).toBe(false);
    expect(hasMagicBytes(buf([0x52, 0x49, 0x46, 0x46]), "webp")).toBe(false); // no WEBP tag
    expect(hasMagicBytes(buf([]), "pdf")).toBe(false);
  });

  it("maps image MIME types to kinds", () => {
    expect(imageKindFromMime("image/png")).toBe("png");
    expect(imageKindFromMime("image/jpeg")).toBe("jpeg");
    expect(imageKindFromMime("image/webp")).toBe("webp");
    expect(imageKindFromMime("image/gif")).toBeNull();
  });
});
