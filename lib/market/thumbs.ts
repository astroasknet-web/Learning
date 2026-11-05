import fs from "node:fs";
import path from "node:path";

/**
 * Course thumbnails: one 1920x1080 and one 640x360 WebP per course in public/course-thumbs, drawn by scripts/thumbs/build.mjs. A course without a picture
 * (a newly added one) keeps the generated vector cover, so nothing ever shows a broken image.
 */
let have: Set<string> | null = null;
function set(): Set<string> {
  if (have) return have;
  try {
    have = new Set(fs.readdirSync(path.join(process.cwd(), "public", "course-thumbs")).filter((f) => f.endsWith("-640.webp")).map((f) => f.slice(0, -"-640.webp".length)));
  } catch { have = new Set(); }
  return have;
}
export const hasThumb = (slug: string): boolean => set().has(slug);
export const thumbSmall = (slug: string): string => `/course-thumbs/${slug}-640.webp`;
export const thumbFull = (slug: string): string => `/course-thumbs/${slug}.webp`;
