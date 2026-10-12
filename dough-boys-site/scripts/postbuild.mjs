/*
  Runs after `astro build`:
  1. Checks every page for the metadata rules (title, description, canonical, one h1, nothing repeated).
     Any problem stops the build, so a broken page can never be deployed.
  2. Writes dist/_headers with the Content-Security-Policy, including hashes of the few inline
     scripts and styles, and X-Robots-Tag: noindex on anything that is not the production deploy.
*/
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const SITE = 'https://doughboysyarmouth.co.uk';
const context = process.env.CONTEXT || 'local';
const production = context === 'production';

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html'));
const urlFor = (file) => {
  const rel = relative(DIST, file).split(sep).join('/');
  return rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? `/${rel.slice(0, -10)}` : `/${rel}`;
};
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/\s+/g, ' ').trim();
const attr = (html, re) => (html.match(re) || [])[1];

const problems = [];
const seen = { title: new Map(), description: new Map(), h1: new Map() };
const scriptHashes = new Set();
const styleHashes = new Set();
const sha = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const indexable = [];

for (const file of htmlFiles) {
  const url = urlFor(file);
  const html = readFileSync(file, 'utf8');
  const is404 = url === '/404.html';
  const noindex = /<meta name="robots" content="noindex/.test(html);
  const found = {
    title: attr(html, /<title>([^<]*)<\/title>/),
    description: attr(html, /<meta name="description" content="([^"]*)"/),
    h1: (html.match(/<h1[\s>][\s\S]*?<\/h1>/g) || []).map(text),
  };
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  if (!/^<!DOCTYPE html><html lang="en-GB"/i.test(html)) problems.push(`${url}: missing doctype or lang="en-GB"`);
  if (!found.title) problems.push(`${url}: no <title>`);
  if (!found.description) problems.push(`${url}: no meta description`);
  if (found.h1.length !== 1) problems.push(`${url}: ${found.h1.length} h1 elements (needs exactly one)`);
  if (!is404 && canonical !== SITE + url) problems.push(`${url}: canonical is ${canonical}, expected ${SITE + url}`);
  for (const key of ['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'og:locale', 'og:site_name']) {
    if (!html.includes(`<meta property="${key}"`)) problems.push(`${url}: missing ${key}`);
  }
  if (!/<meta property="og:image" content="https:\/\//.test(html)) problems.push(`${url}: og:image is not an absolute https URL`);
  for (const key of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    if (!html.includes(`<meta name="${key}"`)) problems.push(`${url}: missing ${key}`);
  }
  if (/\sstyle="/.test(html)) problems.push(`${url}: inline style attribute (blocked by the Content-Security-Policy)`);
  for (const [field, value] of [['title', found.title], ['description', found.description], ['h1', found.h1[0]]]) {
    if (!value) continue;
    const other = seen[field].get(value.toLowerCase());
    if (other) problems.push(`${url}: same ${field} as ${other}`);
    seen[field].set(value.toLowerCase(), url);
  }
  if (!noindex && !is404) indexable.push(SITE + url);

  for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(attrs) || /application\/ld\+json/.test(attrs)) continue;
    scriptHashes.add(sha(body));
  }
  for (const [, body] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) styleHashes.add(sha(body));
}

/* the sitemap must list exactly the indexable pages */
const sitemap = existsSync(join(DIST, 'sitemap.xml')) ? readFileSync(join(DIST, 'sitemap.xml'), 'utf8') : '';
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
if (JSON.stringify(listed) !== JSON.stringify([...indexable].sort())) {
  problems.push(`sitemap.xml lists ${JSON.stringify(listed)} but the indexable pages are ${JSON.stringify(indexable.sort())}`);
}

if (problems.length) {
  console.error(`\n[postbuild] ${problems.length} problem(s):\n  ${problems.join('\n  ')}\n`);
  process.exit(1);
}

const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...scriptHashes].join(' ')} https://static.cloudflareinsights.com`,
  `style-src 'self' ${[...styleHashes].join(' ')}`,
  "img-src 'self' data:",
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const lines = ['# Written by scripts/postbuild.mjs. Static headers are in netlify.toml.', '/*', `  Content-Security-Policy: ${csp}`];
if (!production) lines.push('  X-Robots-Tag: noindex');
writeFileSync(join(DIST, '_headers'), lines.join('\n') + '\n');

console.log(`[postbuild] ${htmlFiles.length} pages checked, ${indexable.length} in the sitemap. ` +
  `CSP: ${scriptHashes.size} script and ${styleHashes.size} style hashes. ` +
  `Context "${context}": ${production ? 'indexable' : 'X-Robots-Tag: noindex'}.`);
