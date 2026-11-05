import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

const baseUrl = SITE_URL;

// Non-production deployments (the growqr-india-demo project on
// growqrinview.vercel.app) serve a byte-identical copy of the site on a
// crawlable host. Their pages already canonicalise to www.growqr.ai because
// SITE_URL is hardcoded, but a canonical is a hint, not a directive — the
// duplicate host stays crawlable and can hold URL-only entries in the index,
// competing with the very domain this file points at.
//
// Fail-open on purpose: indexing is blocked only when the flag is explicitly
// "true", so a missing or misspelled env var can never silently de-index
// production. Set SEO_BLOCK_INDEXING=true on non-production Vercel projects
// only. Paired with the X-Robots-Tag header in next.config.ts, which covers
// hosts a crawler reaches without reading robots.txt first.
const blockIndexing = process.env.SEO_BLOCK_INDEXING === 'true';

export default function robots(): MetadataRoute.Robots {
  if (blockIndexing) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /admin, /experts/connect, /experts/submit are all internal-use-only
        // flows (auth-gated admin, expert calendar OAuth, expert self-intake) —
        // blocked from crawling entirely, on top of their own noindex meta tags.
        disallow: ['/api/', '/admin', '/experts/connect', '/experts/submit'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
