import { dictionaries } from "./data";
import { strWordCount, trimChars, mbLen, phpTrim } from "./php";
import { fold } from "./text";

/** Splits resume text into labelled sections by detecting heading lines (port of Extract\Segmenter). */
export interface Segmented {
  sections: Record<string, string>;
  order: string[];
  headings: Record<string, string>;
  lines: string[];
}

export function segment(text: string): Segmented {
  const dict = dictionaries().section_headings as Record<string, string[]>;
  const lines = text.split("\n");
  const sections: Record<string, string> = { preamble: "" };
  const order = ["preamble"];
  const headings: Record<string, string> = {};
  let current = "preamble";

  for (const line of lines) {
    const key = headingKey(line, dict);
    if (key !== null) {
      current = key;
      if (!(current in sections)) {
        sections[current] = "";
        order.push(current);
      }
      headings[current] = phpTrim(line);
      continue;
    }
    sections[current] += line + "\n";
  }
  for (const k of Object.keys(sections)) sections[k] = phpTrim(sections[k]);
  return { sections, order, headings, lines };
}

function headingKey(line: string, dict: Record<string, string[]>): string | null {
  const trimmed = phpTrim(line);
  if (trimmed === "" || mbLen(trimmed) > 60) return null;
  const clean = trimChars(trimmed, " \t:_—-=•|");
  const folded = fold(clean);
  if (folded === "") return null;

  for (const [key, phrases] of Object.entries(dict)) {
    for (const phrase of phrases) {
      const p = fold(phrase);
      if (folded === p) return key;
      if (folded.startsWith(p) && strWordCount(folded) <= strWordCount(p) + 1) return key;
    }
  }
  return null;
}

/** The education block, or the whole text when none was labelled. */
export function educationBlock(seg: Segmented, fullText: string): string {
  const edu = seg.sections["education"] ?? "";
  return edu !== "" ? edu : fullText;
}
