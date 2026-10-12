/*
  Makes a preview copy of the built site for GitHub Pages, at
  https://2kvsdfhjrk-beep.github.io/Cross-Spec/dough-boys-preview/

    npm run build && node scripts/pages-preview.mjs

  GitHub Pages serves the site from a sub-folder and cannot run Netlify features, so the copy:
  - points every root-relative address (/menu/, /_astro/…) into the sub-folder;
  - renames _astro to assets (GitHub Pages skips folders that start with an underscore);
  - leaves out the WebM videos (every current browser plays the MP4s), to keep the repository smaller;
  - keeps search engines out with noindex on every page;
  - shows the enquiry thank-you page instead of sending, because the form only works on Netlify.
  The real site is the Netlify build; delete ../dough-boys-preview once that is live.
*/
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT = new URL('../../dough-boys-preview/', import.meta.url).pathname;
const PREFIX = '/Cross-Spec/dough-boys-preview';

if (!existsSync(join(DIST, 'index.html'))) { console.error('Build the site first: npm run build'); process.exit(1); }
rmSync(OUT, { recursive: true, force: true });
cpSync(DIST, OUT, { recursive: true, filter: (src) => !src.endsWith('/_headers') && !src.endsWith('.webm') });
renameSync(join(OUT, '_astro'), join(OUT, 'assets'));

const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
let pages = 0;
for (const file of walk(OUT)) {
  if (!/\.(html|css|webmanifest)$/.test(file)) continue;
  let s = readFileSync(file, 'utf8');
  // asset paths first (as a placeholder, so the page-link pass below cannot prefix them twice)
  s = s.replaceAll('/_astro/', '/\u0000assets/')
    .replace(/(href|src|action)="\/(?![\/\u0000])/g, `$1="${PREFIX}/`)
    .replace(/"(start_url|scope|src)": "\/(?!\u0000)/g, `"$1": "${PREFIX}/`)
    .replaceAll('/\u0000assets/', `${PREFIX}/assets/`);
  if (s.includes(`${PREFIX}${PREFIX}`)) throw new Error(`${file}: an address was prefixed twice`);
  if (file.endsWith('.html')) {
    pages++;
    s = s.replace(/<source src="[^"]+\.webm"[^>]*>/g, '');
    s = s.replace(/<meta name="robots" content="[^"]*">/, '');
    s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="robots" content="noindex, nofollow">');
    if (s.includes('id="enq-form"')) {
      s = s.replace(/(<form class="enq-form" id="enq-form"[^>]*?)method="POST"/, '$1method="GET"');
      s = s.replace('<button class="eq eq-dark" type="submit">',
        '<p class="f-note"><strong>Preview copy:</strong> nothing is sent from here. Sending shows the thank-you page; the real form works once the site is on Netlify.</p><button class="eq eq-dark" type="submit">');
    }
  }
  writeFileSync(file, s);
}
/* every root-relative address must now point inside the preview folder */
for (const file of walk(OUT).filter((f) => /\.(html|css|webmanifest)$/.test(f))) {
  const s = readFileSync(file, 'utf8');
  const stray = [...s.matchAll(/(?:href|src|action|srcset|poster|data-full|data-poster)="(\/[^"]*)"|url\("?(\/[^")]*)/g)]
    .map((m) => m[1] || m[2]).filter((u) => !u.startsWith('//') && !u.startsWith(`${PREFIX}/`));
  if (stray.length) throw new Error(`${file}: addresses outside the preview folder: ${stray.slice(0, 5).join(', ')}`);
}
console.log(`[pages-preview] ${pages} pages written to dough-boys-preview/ for ${PREFIX}/`);
