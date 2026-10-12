import type { APIRoute } from 'astro';
import { pageList } from '../data/pages';
import { lastmod } from '../lib/lastmod';

/* Only indexable pages, each at its canonical URL, dated by its last real change */
export const GET: APIRoute = ({ site }) => {
  const urls = pageList
    .filter((p) => p.index)
    .map((p) => `  <url>\n    <loc>${new URL(p.path, site).href}</loc>\n    <lastmod>${lastmod(p.sources)}</lastmod>\n  </url>`);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
