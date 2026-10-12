import type { APIRoute } from 'astro';

/* Everything public may be crawled. Preview deploys are kept out of search by the X-Robots-Tag header instead. */
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
