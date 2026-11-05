import { SITE_URL } from "@/lib/seo";

/**
 * The GrowQR wordmark as the hosted asset every email points at.
 *
 * Emails used to draw the mark as styled text ("Grow[Q]R" set in Georgia).
 * That cost nothing to render but it was not the logo: no scanner motif, no
 * "Agentic AI" lockup, and a different shape in every client that fell back
 * off the serif. One constant here means a rebrand is a single file swap
 * rather than an edit in every template.
 */
export const EMAIL_LOGO_URL = `${SITE_URL}/emailogo.png`;

/**
 * The logo as an `<img>`, linked back to the site.
 *
 * The asset is 400x200, so every width used here is half size or smaller and
 * stays sharp on retina. `alt` carries the brand for the many clients that
 * block images by default, and the explicit width/height stops the layout
 * jumping while it loads.
 */
export function emailLogo(opts: { width?: number; align?: "left" | "center" } = {}): string {
  const { width = 132, align = "left" } = opts;
  const height = Math.round(width / 2);
  return `<a href="${SITE_URL}" target="_blank" style="text-decoration:none;border:0;"><img src="${EMAIL_LOGO_URL}" width="${width}" height="${height}" alt="GrowQR" style="display:${align === "center" ? "inline-block" : "block"};border:0;outline:none;text-decoration:none;width:${width}px;height:${height}px;"></a>`;
}
