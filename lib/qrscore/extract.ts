import { strFromU8, unzipSync } from "fflate";
import { getDocumentProxy, extractText } from "unpdf";
import { scoreExtraction, type QrResult, type ScoreOptions } from "./index";
import type { Extraction } from "./resume-gate";
import { normalize } from "./text";

/**
 * Turn an uploaded resume file (.pdf, .docx, .txt) into text, then score it (port of Extract\TextExtractor, DocxExtractor and
 * the pure-JS part of PdfExtractor). Server-side only.
 *
 * PDF note: the PHP engine could shell out to Poppler and Tesseract OCR when the host allowed it. Here PDFs are read with
 * pdf.js (via unpdf), which handles ordinary text PDFs. Scanned (image-only) PDFs yield too little text and are refused with
 * the same "paste the text instead" message; OCR is a separate phase.
 */
export const MAX_BYTES = 8 * 1024 * 1024;

export class ExtractError extends Error {}

export async function extractFile(data: Uint8Array, filename: string): Promise<Extraction> {
  if (data.byteLength > MAX_BYTES) throw new ExtractError("That file is too large (maximum 8 MB).");
  const ext = (filename.split(".").pop() ?? "").toLowerCase();

  if (ext === "pdf") {
    const text = await pdfText(data);
    return { text: normalize(text), source: "pdf", method: "pdfjs", confidence: text.trim().length > 200 ? "high" : "low", note: data.length && isEncrypted(data) ? "The PDF is encrypted; text may be incomplete." : null };
  }
  if (ext === "docx") {
    return { text: normalize(docxText(data)), source: "docx", method: "zip-xml", confidence: "high" };
  }
  if (["txt", "text", "md", ""].includes(ext)) {
    return { text: normalize(new TextDecoder("utf-8").decode(data)), source: "text", method: "raw", confidence: "high" };
  }
  throw new ExtractError(`Unsupported file type '.${ext}'. Supported: .pdf, .docx, .txt. For legacy .doc, please re-save as .docx or paste the text.`);
}

/** Score an uploaded file in one step. */
export async function scoreFile(data: Uint8Array, filename: string, options: ScoreOptions = {}): Promise<QrResult> {
  return scoreExtraction(await extractFile(data, filename), options);
}

function isEncrypted(data: Uint8Array): boolean {
  return Buffer.from(data.subarray(0, Math.min(data.length, 1_000_000))).includes("/Encrypt");
}

async function pdfText(data: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(data)); // pdf.js takes ownership of the buffer, so pass a copy
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  } catch {
    throw new ExtractError("We could not read this PDF. Paste the text instead, or upload a DOCX.");
  }
}

/** word/document.xml plus headers and footers, paragraphs and breaks as newlines (same steps as the PHP DocxExtractor). */
export function docxText(data: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, { filter: (f) => f.name === "word/document.xml" || /^word\/(header|footer)\d*\.xml$/.test(f.name) });
  } catch {
    throw new ExtractError("We could not open this DOCX file.");
  }
  const parts = ["word/document.xml", ...Object.keys(files).filter((n) => n !== "word/document.xml")];
  let text = "";
  for (const part of parts) {
    const xml = files[part];
    if (!xml || xml.length === 0) continue;
    text += xmlToText(strFromU8(xml)) + "\n";
  }
  return text.trim();
}

function xmlToText(xml: string): string {
  let x = xml.replace(/<w:p\b[^>]*>/g, "\n").replace(/<w:tab\b[^>]*\/?>/g, "\t").replace(/<w:br\b[^>]*\/?>/g, "\n");
  x = x.replace(/<[^>]*>/g, ""); // strip_tags
  x = decodeEntities(x);
  return x.replace(/[  ]{2,}/gu, " ");
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
    const l = e.toLowerCase();
    if (l === "amp") return "&";
    if (l === "lt") return "<";
    if (l === "gt") return ">";
    if (l === "quot") return '"';
    if (l === "apos") return "'";
    const code = l.startsWith("#x") ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  });
}
