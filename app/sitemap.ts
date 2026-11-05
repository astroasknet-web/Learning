import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const PATHS = ["/", "/courses", "/exam-prep", "/school", "/vedic-math", "/olympiad/imo"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({ url: `${SITE_URL}${p === "/" ? "" : p}`, lastModified: new Date() }));
}
