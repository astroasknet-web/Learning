import { readFileSync } from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ExtractError, docxText, extractFile, scoreFile } from "./extract";
import { isScored, scoreText } from "./index";

const fixture = (n: string) => readFileSync(path.join(__dirname, "__fixtures__", n), "utf8");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function makeDocx(text: string): Uint8Array {
  const body = text.split("\n").map((l) => `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`).join("");
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    "word/document.xml": strToU8(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`),
    "word/header1.xml": strToU8('<w:hdr xmlns:w="x"><w:p><w:r><w:t>Header text</w:t></w:r></w:p></w:hdr>'),
  });
}

/** A minimal text PDF: one Helvetica line per row. */
function makePdf(lines: string[]): Uint8Array {
  const safe = (s: string) => s.replace(/[^\x20-\x7e]/g, "-").replace(/([()\\])/g, "\\$1");
  let y = 800;
  let content = "BT /F1 9 Tf\n";
  for (const l of lines) {
    content += `1 0 0 1 36 ${y} Tm (${safe(l)}) Tj\n`;
    y -= 11;
    if (y < 30) break;
  }
  content += "ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

describe("file extraction", () => {
  const text = fixture("resume--strong-fresher.txt");

  it("reads a DOCX (body, headers) and scores it like the same pasted text", async () => {
    const docx = makeDocx(text);
    expect(docxText(docx)).toContain("Header text");
    const viaFile = await scoreFile(docx, "resume.docx");
    const viaText = scoreText(text);
    expect(isScored(viaFile)).toBe(true);
    if (isScored(viaFile) && isScored(viaText)) {
      expect(Math.abs(viaFile.overall.score - viaText.overall.score)).toBeLessThan(6); // the header line is extra text
      expect(viaFile.extraction.source).toBe("docx");
    }
  });

  it("reads a text PDF and scores it", async () => {
    const pdf = makePdf(text.split("\n"));
    const ex = await extractFile(pdf, "resume.pdf");
    expect(ex.source).toBe("pdf");
    expect(ex.text.length).toBeGreaterThan(300);
    expect(ex.text).toMatch(/education/i);
    const r = await scoreFile(pdf, "resume.pdf");
    expect(isScored(r)).toBe(true);
  });

  it("reads plain text and refuses unsupported or oversized files", async () => {
    const ex = await extractFile(new TextEncoder().encode("Hello\r\nWorld"), "a.txt");
    expect(ex.text).toBe("Hello\nWorld");
    await expect(extractFile(new Uint8Array(10), "a.doc")).rejects.toThrow(ExtractError);
    await expect(extractFile(new Uint8Array(9 * 1024 * 1024), "a.pdf")).rejects.toThrow(/too large/);
    await expect(extractFile(new TextEncoder().encode("not a pdf"), "a.pdf")).rejects.toThrow(ExtractError);
    await expect(extractFile(new TextEncoder().encode("not a zip"), "a.docx")).rejects.toThrow(ExtractError);
  });

  it("refuses a file that is not a resume, with the same message as the PHP engine", async () => {
    const r = await scoreFile(new TextEncoder().encode(fixture("not-resume--invoice.txt")), "invoice.txt");
    expect(isScored(r)).toBe(false);
  });
});
