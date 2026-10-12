# SEO and hosting report: doughboysyarmouth.co.uk

Prepared 12 October 2026 against `action.md`. The new site is in `dough-boys-site/`; the earlier GitHub Pages version in
`dough-boys/` has not been changed.

## Summary

The website is built and checked, ready for Netlify. Three things stand between it and going live, and all three
need you:

1. **Company details.** Send the registered company name, company number and registered office address. Once the
   site is on doughboysyarmouth.co.uk, the production build deliberately stops until they are in
   `src/data/business.ts`, because a limited company must show them on its website. Until then it builds normally at
   its netlify.app address, so you can preview it.
2. **The domain.** Buy `doughboysyarmouth.co.uk` (if not already yours) and point it at Netlify.
3. **Netlify.** Connect this GitHub repository. `netlify.toml` already holds every setting.

Results on the finished build (mobile Lighthouse, a production-like server):

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Home | 99 | 100 | 100 | 100 |
| Menu | 100 | 100 | 100 | 100 |
| Enquire | 100 | 100 | 100 | 100 |
| Loyalty card | 100 | 100 | 100 | 100 |
| Gallery | 99 | 100 | 100 | 100 |
| Find us | 100 | 100 | 100 | 100 |
| Privacy | 100 | 100 | 100 | 100 |
| Enquiry thank-you | 100 | 100 | 100 | 66 (not indexed, on purpose) |
| 404 | 100 | 100 | 100 | 63 (not indexed, on purpose) |

Zero accessibility violations (axe, 27 runs), zero HTML errors, zero broken internal links, 197 of 197 automated
page checks passed, no Content-Security-Policy violations or console errors on any page.

## 0. Project context

| Field | Value |
| --- | --- |
| Site name | Dough Boys |
| Production domain | https://doughboysyarmouth.co.uk |
| Preferred host form | Non-www. `www` redirects to it. |
| Business type | Local business (pizza kiosk, takeaway) |
| Location served | Great Yarmouth, NR30 3JG |
| Primary audience | Locals and visitors in Great Yarmouth wanting pizza; people planning parties, events and big orders |
| Target search phrases | Proposed, please confirm: pizza Great Yarmouth; pizza kiosk Great Yarmouth; best pizza in Great Yarmouth; pepperoni pizza Great Yarmouth; dessert pizza Great Yarmouth; pizza for parties and events Great Yarmouth; takeaway pizza Great Yarmouth; pizza loyalty card Great Yarmouth; Dough Boys Great Yarmouth |
| Language and region | en-GB |
| Registered company | Yes, a limited company. **Name, number and registered office still needed.** |
| Analytics | Cloudflare Web Analytics (cookie-free) |
| Host | Netlify |

Not yet supplied and therefore left off the site rather than guessed: street address, phone number, email address
and opening hours. Each appears automatically once added to `src/data/business.ts`.

## Audit findings (the site before this work)

1. Everything was on one page, so the menu, enquiries, loyalty card and gallery had no addresses of their own to rank.
2. It lived in a subfolder of a GitHub Pages site: no custom domain, no control over headers or redirects, no 404 page.
3. No canonical tags, robots.txt, sitemap or breadcrumbs. Structured data pointed at the github.io address.
4. Fonts came from Google's servers: three families, render-blocking, and a third-party request on every visit.
5. Photos were single-size WebP files. Phones downloaded the full-size videos. The 170 KB logo was repeated inside
   the page.
6. Enquiries were copied into an Instagram message by hand. Nothing was stored, and there was no form handling.
7. No privacy policy, no company details, no security headers.
8. Inline scripts and styles throughout, which rule out a strict Content-Security-Policy.

## What was changed and why

**Framework and rendering (Phase 1).** Rebuilt with Astro as a static site. Every page's words, headings, links and
metadata are in the HTML itself. JavaScript is used only for the homepage scroll film, the photo viewer and friendlier
form messages. Every link is a real link.

**Pages (Phases 1, 5, 10).** The single page became eight, each aimed at one search phrase:

- `/`: the scroll film, now with a visible heading ("Pizza in Great Yarmouth") and an opening line saying what you are,
  who for and where.
- `/menu/`: the full menu with sections and prices.
- `/enquire/`: parties, events and big orders, with a real form.
- `/loyalty-card/`: how the card works.
- `/gallery/`: the photos and the kiosk video.
- `/find-us/`: where you are and how to get in touch, plus the company details.
- `/privacy/`: the privacy policy.
- `/enquire/thanks/`: the thank-you page.
- A custom 404 page.

The homepage keeps the full experience but links out to each page rather than repeating it: four favourite pizzas
instead of the whole menu, for example. Every page is one click from the homepage and from the footer.

**Addresses (Phase 2).** Short, lowercase, hyphenated addresses ending in a slash. One canonical host
(`https://doughboysyarmouth.co.uk`). A single 301 from `www` (both `http` and `https`) to the bare domain. A real 404
status with links back to the main pages. There are no old addresses on this domain to redirect.

**Metadata (Phase 3).** All of it is written by one component, `src/components/Seo.astro`, from one list,
`src/data/pages.ts`:

- titles of 50 to 59 characters, phrase first and brand last;
- descriptions of 146 to 158 characters;
- self-referencing canonical links;
- Open Graph and Twitter cards with a 1200×630 image;
- the favicon set (`favicon.ico`, SVG favicon, Apple touch icon, 192 and 512 px icons, a maskable icon) and a web
  manifest.

The build stops if a page is missing a title, description or h1, or repeats another page's. It warns if a length
drifts outside the target.

**Structured data (Phase 4).** Every page carries the following, each matching what the page shows:

- `Restaurant`: name, address, logo, image, cuisine, price range, menu link and Instagram;
- `WebSite`;
- `WebPage`;
- `BreadcrumbList` on every inner page.

The menu page adds the full `Menu` with every item and price, and the gallery adds an `ImageGallery`. Phone, email,
opening hours and the company's legal name are added automatically once you supply them.

**Crawling and indexing (Phase 5).**

- `robots.txt` allows everything and names the sitemap.
- `sitemap.xml` is generated at build time. It lists the seven indexable pages, each dated by the last Git commit that
  changed it.
- The thank-you and 404 pages carry `noindex`.
- Every non-production build sends `X-Robots-Tag: noindex`. Only Netlify's production context (`CONTEXT=production`)
  is indexable, so a preview can't leak into Google.
- Visible breadcrumbs appear on every inner page, and all link text is descriptive.

**Performance (Phase 6).**

- **Photos** come as AVIF with a WebP fallback, in several widths, each with `srcset`, `sizes`, width and height. Only
  photos below the first screen are lazy-loaded.
- **Videos** are fingerprinted so they can be cached for a year, and phones get copies half the size. The homepage
  video starts only after the page has loaded, and below-the-fold video posters load as you approach them.
- **Fonts** are self-hosted WOFF2, Latin only, with `font-display: swap`. Two families (Barlow Condensed and Leckerli
  One), with the two critical weights preloaded and size-matched fallbacks to stop text jumping. The body font, Rubik,
  was dropped to meet the two-family limit; body text now uses the device's own font.
- **Logo:** the full logo is one cached file, compressed by 55% with no visible change.
- **CSS and JavaScript:** two small stylesheets per page. JavaScript on the homepage is 8 KB compressed, and most
  inner pages have none. No render-blocking scripts.
- **The intro curtain** was shortened so that it never hides the first screen from the browser's "largest paint"
  measure.
- **The film's images wait:** the spinning pizza and falling pepperoni load once the first screen is in (or as soon as
  you scroll), so they never compete with it.
- **Video codecs are declared:** each video source states its exact codec, so a browser that can't play one format
  skips it rather than downloading it first.

**Accessibility (Phase 7).**

- Header, nav, main and footer landmarks, plus a skip link.
- A visible focus ring that contrasts on both dark and light sections.
- Every form field has a label, with clear error messages announced to screen readers.
- Meaningful alt text on photos and empty alt on decoration.
- A full static layout for anyone who prefers reduced motion.

**Security headers (Phase 8).** Set in `netlify.toml`:

- HSTS (two years, subdomains, preload);
- `nosniff`;
- `strict-origin-when-cross-origin`;
- a Permissions-Policy that turns off camera, microphone, geolocation, payment and USB;
- `X-Frame-Options`;
- `Cross-Origin-Opener-Policy`.

The Content-Security-Policy is generated at build time in `dist/_headers`. It allows only this site, plus Cloudflare's
analytics script, and includes `frame-ancestors 'self'`. The few inline snippets are allowed by hash, not by
`unsafe-inline`.

**UK legal and trust (Phase 9).**

- A UK GDPR privacy policy: the controller, what is collected and why, lawful bases, processors (Netlify, Cloudflare),
  international transfers, retention, rights and the ICO.
- No cookies at all, and the analytics are cookie-free, so no banner is needed under PECR. The policy says so.
- Companies Act disclosure in the footer and on the find-us page, built from the company fields.
- An automatic copyright year.
- No terms page, because nothing is sold or booked online.

**Analytics and search tools (Phase 11).** Cloudflare Web Analytics loads only when its token is set, and never on
previews. Google Search Console and Bing verification are by DNS (preferred) or by an optional meta tag set through an
environment variable.

**Deployment (Phase 12).**

- `netlify.toml` at the repository root holds the base directory, build command, publish folder, Node 22, redirects and
  headers, so Netlify needs no dashboard settings.
- `.env.example` documents the four variables. No secrets are committed.
- `.gitignore` covers build output, dependencies and env files.
- `README.md` explains how to run, build, deploy and edit.

## Verification (Phase 13)

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Production build passes cleanly | Pass, with one deliberate stop | `npm run build` exits 0 with no warnings that affect output. With `CONTEXT=production` for doughboysyarmouth.co.uk and the company fields still empty it stops with "Company details missing… (Companies Act 2006)", as designed; for a netlify.app address it builds, so the site can be previewed first. With test company details in a scratch copy, the production build passes, sends no `X-Robots-Tag`, and the footer, copyright line and structured data show the company. |
| 2 | Each template fetched without JavaScript | Pass | `scripts/check-site.mjs` fetched the raw HTML of all 8 pages. Main text, the single h1, title, description, canonical, Open Graph, favicons and parsed JSON-LD are present on every one. |
| 3 | HTTP, www and trailing-slash variants each a single 301 | Partly verified; finish after launch | Netlify's own parsers accept both `www` rules. Netlify's local server returns one `301` from `www.doughboysyarmouth.co.uk/menu/` straight to `https://doughboysyarmouth.co.uk/menu/`, and that address returns 200. `http`→`https` and `/menu`→`/menu/` are handled by Netlify itself on the live domain. Run `npm run check:site -- https://doughboysyarmouth.co.uk` after launch: it tests all four in one go. |
| 4 | Unknown URL returns 404 with the custom page | Pass | `/this-page-does-not-exist/` returns status 404 with the "Sorry, we can't find that page" page and links to home, menu, enquire and find us. |
| 5 | robots.txt and sitemap.xml load; sitemap URLs 200 and canonical | Pass | Both return 200. All 7 sitemap URLs return 200, are on the canonical host with a trailing slash, carry a self-referencing canonical, and are the only indexable pages (the build checks this too). |
| 6 | Broken links | Internal pass; external not checkable here | linkinator crawled the whole site: 130 links, 0 broken. This build environment blocks outside websites, so the 5 external links are listed under "Not completed". |
| 7 | HTML validation | Pass | html-validate (recommended rules plus no inline styles): 0 errors on all 9 pages. |
| 8 | No repeated titles, descriptions or h1s | Pass | Checked at build time and again on the served pages: all unique. |
| 9 | Structured data valid | Pass offline; run Google's test after launch | Every JSON-LD block type-checks against the schema.org definitions (schema-dts): 0 errors. A deliberately broken copy produced 16 errors, so the check works. Google's Rich Results Test and validator.schema.org are blocked from this environment; see owner actions. |
| 10 | Lighthouse mobile, every template, 95+ | Pass | See the table at the top. LCP 1.1 to 2.2 s, CLS 0, TBT 0 ms on every page. The homepage, run six times on the final build, scored 98 to 99 with LCP 1.7 to 2.0 s; the gallery scored 99 with LCP 2.2 s. The two pages under 95 for SEO are the thank-you and 404 pages, which are deliberately `noindex`; Lighthouse marks any `noindex` page down. |
| 11 | Accessibility scan, zero violations | Pass | axe-core 4.14 (WCAG 2.0, 2.1 and 2.2 A/AA plus best practice): 0 violations on all 9 pages on phone, desktop and reduced motion. Text axe could not judge, mostly over photos and textures, was measured from rendered pixels. Body and heading text measured 6.9:1 to 17:1. The small rotating "Scroll for pizza" badge now has a dark outline so it reads over the bright photo. |
| 12 | Section 8 headers present | Pass on Netlify's local server; recheck live | `curl -I` shows every header from the CSP down to COOP. Netlify's local server overrides `Cache-Control` for development, so the one-year rule for `/_astro/*` was confirmed with Netlify's own config parser. `check:site` verifies it on the live site. |
| 13 | Preview noindex, production not | Pass | `CONTEXT=deploy-preview` and local builds write `X-Robots-Tag: noindex`. `CONTEXT=production` writes no `X-Robots-Tag`. It is decided by Netlify's `CONTEXT` variable, so a production build can never inherit it. |
| 14 | Open Graph image absolute and loads | Pass locally | `og:image` is `https://doughboysyarmouth.co.uk/og.jpg` (1200×630 JPEG) on every page and is served as `image/jpeg`. Check the share preview with a social debugger once the domain is live. |

Also checked: every page loaded with the real Content-Security-Policy enforced on phone and desktop sizes. There were
no policy violations, console errors or failed requests, and the homepage film still plays correctly from end to end.

## Not completed, and why

- **Company disclosure.** Waiting for the legal name, company number and registered office. Production deploys on
  doughboysyarmouth.co.uk stop until they are added.
- **Live-domain checks:**
  - the `http`→`https` and `/menu`→`/menu/` redirects;
  - live caching headers;
  - PageSpeed Insights on the real host;
  - the social share preview.

  These need the domain pointed at Netlify first. `npm run check:site -- https://doughboysyarmouth.co.uk` covers most
  of them.
- **External links.** The build environment blocks outside sites, so these five were not clicked:
  - instagram.com/doughboysyarmouth
  - ig.me/m/doughboysyarmouth
  - the Google Maps search link
  - the Apple Maps search link
  - ico.org.uk/make-a-complaint
- **Google Rich Results Test and validator.schema.org.** Blocked from here. The offline schema check passed.
- **The enquiry form.** Netlify only switches on form handling during a real deploy. Send a test enquiry after the first
  deploy and check it under Forms.
- **Local SEO details.** Without a street address, phone number, opening hours and map coordinates, Google will list
  these as "recommended" fields missing from the business data. That is a warning, not an error. Add them to
  `src/data/business.ts` when you can, exactly as on your Google Business Profile.
- **Blog or articles.** Not built. This is a local business site, not a content-led one. See owner action 7.

## Owner actions

1. **Domain and DNS.**
   - Buy `doughboysyarmouth.co.uk`.
   - In Netlify, add it as the primary domain and `www.doughboysyarmouth.co.uk` as an alias.
   - Point the DNS at Netlify. HTTPS certificates are automatic.
2. **Netlify setup.**
   - Import this GitHub repository; `netlify.toml` does the rest.
   - Add `PUBLIC_CF_BEACON_TOKEN`.
   - Under Forms, add an email notification for the "enquiry" form, and send a test enquiry.
3. **Company details.** Send me (or fill in) the legal name, company number and registered office. Optionally add the
   street address, phone, email and opening hours too.
4. **Google Search Console.**
   - Verify with a DNS TXT record, or set `PUBLIC_GOOGLE_SITE_VERIFICATION`.
   - Submit `https://doughboysyarmouth.co.uk/sitemap.xml`.
   - Request indexing of the homepage, `/menu/` and `/enquire/`.
5. **Bing Webmaster Tools.** Import the site from Search Console, or verify by DNS or `PUBLIC_BING_SITE_VERIFICATION`.
6. **Google Business Profile.**
   - Create or claim it.
   - Make the name, address, phone and hours match the site exactly.
   - Set the website to `https://doughboysyarmouth.co.uk/` and add the menu link.
7. **Content and links.**
   - Publish useful updates regularly: new pizzas, specials, events you have catered.
   - Get listed in reputable local directories and on local event, tourism and supplier sites.
   - Ask partners to link to you.
8. **Monthly.** Review Search Console for indexing errors, Core Web Vitals and the searches people use to find you.
9. **After launch.**
   - Run `npm run check:site -- https://doughboysyarmouth.co.uk` and PageSpeed Insights.
   - Run Google's Rich Results Test on the homepage and `/menu/`.
   - Check the share preview with a social debugger.
10. **The old GitHub Pages copy** at `2kvsdfhjrk-beep.github.io/Cross-Spec/dough-boys/` is still public and could
    compete with the new domain in search. Once the new site is live, I suggest pointing it at the new domain: a
    canonical link plus a redirect page. I have not changed it, and will only do so when you confirm.

## Please check these assumptions

- **The search phrases** listed in section 0.
- **Privacy policy:**
  - that enquiries are kept for up to 12 months;
  - that Netlify and Cloudflare are the only services involved;
  - that you have no email address you would rather people used for data requests.
- **The allergen line on the menu:** "Allergies or intolerances? Please tell us before you order and we'll talk you
  through what's in each pizza."
- **The loyalty card wording:** nine stamps, then the next pizza is free, as printed on the card.

## Main files

| File | What it does |
| --- | --- |
| `netlify.toml` (repository root) | Build settings, the www redirect, security and caching headers |
| `dough-boys-site/src/data/business.ts` | Business and company details, the single source for footer, find-us, privacy and structured data |
| `dough-boys-site/src/data/pages.ts` | Every page's title, description and h1, with build-time checks |
| `dough-boys-site/src/data/menu.ts` | The menu and prices |
| `dough-boys-site/src/components/Seo.astro` | All head metadata and structured data |
| `dough-boys-site/scripts/postbuild.mjs` | Page checks after every build; writes the CSP and the preview noindex header |
| `dough-boys-site/scripts/check-site.mjs` | `npm run check:site`: checks a running copy, or the live site, the way a search engine sees it |
| `dough-boys-site/README.md` | How to run, build, deploy and edit |
