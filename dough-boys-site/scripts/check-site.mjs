#!/usr/bin/env node
/*
  Checks a running copy of the site the way a search engine sees it: raw HTML, no JavaScript.

    npm run check:site                                    # a local copy, e.g. `netlify dev` on port 8888
    npm run check:site -- https://doughboysyarmouth.co.uk # the live site: also checks redirects and production headers

  Exits with an error if anything fails.
*/
import http from 'node:http';
import https from 'node:https';

const CANON = 'https://doughboysyarmouth.co.uk';
const base = (process.argv[2] || 'http://localhost:8888').replace(/\/$/, '');
const live = base === CANON;
let passed = 0, failed = 0;
const ok = (cond, msg, detail = '') => {
  if (cond) passed++; else failed++;
  console.log(`  ${cond ? '✓' : '✗'} ${msg}${!cond && detail ? `  (${detail})` : ''}`);
  return cond;
};
const info = (msg) => console.log(`  · ${msg}`);
const section = (t) => console.log(`\n${t}`);
const local = (u) => u.replace(CANON, base);

/* a raw request that never follows redirects and can set the Host header */
function request(url, { method = 'GET', host } = {}) {
  const u = new URL(url);
  const mod = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(u, { method, headers: { 'user-agent': 'dough-boys-site-check', ...(host ? { host } : {}) } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const meta = (html, name) => (html.match(new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`)) || [])[1];

/* ---------- robots.txt and sitemap.xml ---------- */
section('robots.txt and sitemap.xml');
const robots = await request(`${base}/robots.txt`);
ok(robots.status === 200, 'robots.txt returns 200', robots.status);
ok(/User-agent: \*\s+Allow: \//.test(robots.body) && !/Disallow: \/\s/.test(robots.body), 'robots.txt allows crawling of the whole site');
ok(robots.body.includes(`Sitemap: ${CANON}/sitemap.xml`), 'robots.txt points to the sitemap');
const sm = await request(`${base}/sitemap.xml`);
const locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const mods = [...sm.body.matchAll(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)].map((m) => m[1]);
ok(sm.status === 200 && /xml/.test(sm.headers['content-type'] || ''), 'sitemap.xml returns 200 as XML', `${sm.status} ${sm.headers['content-type']}`);
ok(locs.length > 0 && mods.length === locs.length, `sitemap lists ${locs.length} pages, each with a lastmod date`);
ok(locs.every((l) => l.startsWith(`${CANON}/`) && l.endsWith('/')), 'every sitemap URL is on the canonical host with a trailing slash');

/* ---------- every page ---------- */
const extra = [`${CANON}/enquire/thanks/`];
const seen = { title: new Map(), description: new Map(), h1: new Map() };
for (const loc of [...locs, ...extra]) {
  const inSitemap = locs.includes(loc);
  section(`${loc.replace(CANON, '') || '/'}${inSitemap ? '' : ' (not in sitemap)'}`);
  const r = await request(local(loc));
  const html = r.body;
  ok(r.status === 200, 'returns 200', r.status);
  ok(/^<!DOCTYPE html><html lang="en-GB"/i.test(html), 'html lang="en-GB" with a doctype');
  ok(/<meta charset="utf-8">/.test(html) && /<meta name="viewport" content="width=device-width, initial-scale=1/.test(html), 'charset and viewport');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = meta(html, 'description') || '';
  ok(title.length >= 30 && title.length <= 65, `title, ${title.length} characters: "${title}"`);
  ok(desc.length >= 120 && desc.length <= 165, `description, ${desc.length} characters`);
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  ok(canonical === loc, 'self-referencing canonical', canonical);
  const robotsMeta = meta(html, 'robots');
  if (inSitemap) ok(!robotsMeta, 'indexable (no robots noindex)');
  else ok(/noindex/.test(robotsMeta || ''), 'noindex, as intended');
  const h1s = (html.match(/<h1[\s>][\s\S]*?<\/h1>/g) || []).map(strip);
  ok(h1s.length === 1 && h1s[0].length > 3, `exactly one h1: "${h1s[0]}"`);
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
  ok(levels[0] === 1 && levels.every((l, i) => i === 0 || l <= levels[i - 1] + 1), 'headings start at h1 and never skip a level', levels.join(','));
  for (const [k, v] of [['title', title], ['description', desc], ['h1', h1s[0]]]) {
    const other = seen[k].get(v);
    ok(!other, `${k} is unique`, other && `same as ${other}`);
    seen[k].set(v, loc);
  }
  for (const k of ['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'og:locale', 'og:site_name', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    if (!meta(html, k)) ok(false, `has ${k}`);
  }
  ok(meta(html, 'og:locale') === 'en_GB' && meta(html, 'twitter:card') === 'summary_large_image' && meta(html, 'og:url') === loc, 'Open Graph and Twitter tags present and consistent');
  ok(/<link rel="icon" href="\/favicon\.ico"/.test(html) && /<link rel="icon" href="\/favicon\.svg"/.test(html) && /<link rel="apple-touch-icon"/.test(html) && /<link rel="manifest"/.test(html), 'favicon set and web manifest linked');

  /* structured data */
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let nodes = [];
  try { nodes = blocks.flatMap((b) => JSON.parse(b)['@graph'] || []); ok(blocks.length > 0, `structured data parses (${nodes.map((n) => n['@type']).join(', ')})`); }
  catch (e) { ok(false, 'structured data parses', e.message); }
  const biz = nodes.find((n) => n['@type'] === 'Restaurant');
  ok(biz && biz.name && biz.address?.postalCode && biz.address?.addressLocality && biz.url && biz.logo, 'Restaurant has name, url, logo and address');
  ok(nodes.some((n) => n['@type'] === 'WebSite'), 'WebSite node present');
  if (loc !== `${CANON}/`) {
    const bc = nodes.find((n) => n['@type'] === 'BreadcrumbList');
    const items = bc?.itemListElement || [];
    ok(items.length >= 2 && items[0].item === `${CANON}/` && items.at(-1).item === loc && items.every((it, i) => it.position === i + 1), 'BreadcrumbList from Home to this page');
    ok(/<nav class="crumbs" aria-label="Breadcrumb">/.test(html), 'visible breadcrumbs');
  }

  /* content and links without JavaScript */
  const main = (html.match(/<main[\s\S]*?<\/main>/) || [''])[0];
  ok(strip(main).length > 300, `main content is in the HTML (${strip(main).length} characters of text)`);
  const internal = [...html.matchAll(/<a [^>]*href="(\/[^"#]*)"/g)].map((m) => m[1]);
  ok(internal.length >= 8 && internal.every((h) => h === '/' || h.endsWith('/') || /\.[a-z0-9]+$/i.test(h)), `${internal.length} internal links, all real hrefs ending in a slash or a file`);
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  ok(imgs.every((t) => /\swidth="\d+"/.test(t) && /\sheight="\d+"/.test(t) && /\salt(="|[\s>])/.test(t)), `all ${imgs.length} images have width, height and alt`);
  ok(!/\bclick here\b/i.test(strip(main)), 'no "click here" link text');
}

/* ---------- 404 ---------- */
section('Not found');
const nf = await request(`${base}/this-page-does-not-exist/`);
ok(nf.status === 404, 'an unknown URL returns a real 404 status', nf.status);
ok(/Sorry, we can.t find that page/.test(nf.body) && /href="\/menu\/"/.test(nf.body), 'the custom 404 page is shown, with links back into the site');

/* ---------- Open Graph image ---------- */
section('Share image');
const og = await request(local(`${CANON}/og.jpg`));
ok(og.status === 200 && og.headers['content-type'] === 'image/jpeg', 'og:image loads as a JPEG', `${og.status} ${og.headers['content-type']}`);

/* ---------- headers ---------- */
section('Response headers');
const home = await request(`${base}/`);
const h = home.headers;
ok(h['strict-transport-security'] === 'max-age=63072000; includeSubDomains; preload', 'Strict-Transport-Security with preload');
ok(h['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff');
ok(h['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy');
ok(/camera=\(\)/.test(h['permissions-policy'] || '') && /microphone=\(\)/.test(h['permissions-policy'] || ''), 'Permissions-Policy turns off camera, microphone, geolocation and more');
ok(/frame-ancestors 'self'/.test(h['content-security-policy'] || '') && /default-src 'self'/.test(h['content-security-policy'] || ''), 'Content-Security-Policy with frame-ancestors \'self\'');
if (live) ok(!h['x-robots-tag'], 'production has no X-Robots-Tag');
else info(`this copy sends X-Robots-Tag: ${h['x-robots-tag'] || '(none)'} (production must send none)`);
const asset = (home.body.match(/href="(\/_astro\/[^"]+\.css)"/) || [])[1];
if (asset) {
  const a = await request(`${base}${asset}`, { method: 'HEAD' });
  if (live) ok(a.headers['cache-control'] === 'public, max-age=31536000, immutable', 'fingerprinted files cached for a year', a.headers['cache-control']);
  else info(`fingerprinted file Cache-Control here: ${a.headers['cache-control']} (the local server ignores caching rules; production should say immutable)`);
}

/* ---------- redirects ---------- */
section('Redirects');
async function oneHop(from, to, opts) {
  const r = await request(from, opts);
  const loc = r.headers.location;
  const next = loc ? await request(loc.startsWith('http') ? (live ? loc : local(loc)) : `${base}${loc}`) : null;
  ok(r.status === 301 && loc === to && next?.status === 200, `${opts?.host ? `Host ${opts.host} ` : ''}${from.replace(base, '')} → 301 → ${to}, which returns 200 (one hop)`, `${r.status} ${loc} then ${next?.status}`);
}
if (live) {
  await oneHop('http://doughboysyarmouth.co.uk/', `${CANON}/`);
  await oneHop('https://www.doughboysyarmouth.co.uk/', `${CANON}/`);
  await oneHop('http://www.doughboysyarmouth.co.uk/menu/', `${CANON}/menu/`);
  await oneHop(`${CANON}/menu`, `${CANON}/menu/`);
} else {
  await oneHop(`${base}/menu/`, `${CANON}/menu/`, { host: 'www.doughboysyarmouth.co.uk' });
  info('http → https and /menu → /menu/ are handled by Netlify itself and can only be checked on the live domain');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
