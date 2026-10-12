# Dough Boys website

The website for Dough Boys, the pizza kiosk in Great Yarmouth (NR30 3JG), built to go live at
**https://doughboysyarmouth.co.uk** on Netlify.

It is a static site made with [Astro](https://astro.build): every page is plain HTML at build time, so it loads fast,
works without JavaScript and is easy for search engines to read. The only JavaScript is the scroll animation on the
homepage, the photo viewer and the enquiry form checks.

## Pages

| Page | Address | Source |
| --- | --- | --- |
| Home (the scroll film) | `/` | `src/pages/index.astro` |
| Menu and prices | `/menu/` | `src/pages/menu/index.astro`, data in `src/data/menu.ts` |
| Parties, events and big orders | `/enquire/` | `src/pages/enquire/index.astro` (Netlify Forms) |
| Enquiry thank-you (not indexed) | `/enquire/thanks/` | `src/pages/enquire/thanks/index.astro` |
| Loyalty card | `/loyalty-card/` | `src/pages/loyalty-card/index.astro` |
| Gallery | `/gallery/` | `src/pages/gallery/index.astro`, data in `src/data/gallery.ts` |
| Find us (contact page) | `/find-us/` | `src/pages/find-us/index.astro` |
| Privacy policy | `/privacy/` | `src/pages/privacy/index.astro` |
| Not found | any unknown address | `src/pages/404.astro` |

`robots.txt` and `sitemap.xml` are generated from `src/pages/robots.txt.ts` and `src/pages/sitemap.xml.ts`.

## Changing things

- **Business details** (address, phone, email, opening hours, company details): `src/data/business.ts`.
  The footer, find-us page, privacy policy and search-engine data all read from here. Leave an optional field empty
  and it disappears from the site.
- **Prices and dishes**: `src/data/menu.ts`. The homepage favourites, the menu page and the menu data for search
  engines update together.
- **Page titles and descriptions**: `src/data/pages.ts`. Every page must be listed here; the build stops if a title,
  description or main heading is missing or used twice.
- **Photos**: add the original to `src/assets/img/gallery/` and list it in `src/data/gallery.ts`. Smaller AVIF and
  WebP copies are made automatically.

## Run it on your computer

You need [Node.js](https://nodejs.org) 22.12 or newer.

```sh
cd dough-boys-site
npm install
npm run dev        # http://localhost:4321, reloads as you edit
npm run build      # builds the site into dist/ and runs the checks
npm run preview    # serves the built dist/ folder
```

`npm run build` runs `astro build` and then `scripts/postbuild.mjs`, which:

1. checks every page has a title, description, canonical address, social sharing tags and exactly one `h1`, with no
   repeats across pages, and that the sitemap lists exactly the pages that should be indexed. Any problem fails the
   build, so it can never be deployed;
2. writes `dist/_headers` with the Content-Security-Policy (including hashes of the few inline snippets) and, on
   anything other than the production deploy, `X-Robots-Tag: noindex`.

## Checks

```sh
npm run check:html                          # HTML validation of dist/ (html-validate)
npm run check:site                          # metadata, structured data, 404, headers on a local copy
npm run check:site -- https://doughboysyarmouth.co.uk   # the same on the live site, plus redirects
```

`check:site` expects a running copy; locally that is `npx netlify-cli dev --dir dist` (port 8888), which also applies
the headers and redirects from `netlify.toml`.

## Preview copy on GitHub Pages

Until Netlify is set up, a preview of the built site is published at
https://2kvsdfhjrk-beep.github.io/Cross-Spec/dough-boys-preview/ (hidden from search engines). Refresh it with:

```sh
npm run build && npm run preview:pages   # rewrites dist/ into ../dough-boys-preview/, then commit and push
```

It cannot send enquiries (that needs Netlify) and leaves out the WebM videos. Delete `../dough-boys-preview/` once the
Netlify site is live.

## Deploy on Netlify

1. In Netlify, choose **Add new site > Import an existing project** and pick this GitHub repository.
2. Netlify reads `netlify.toml` from the repository root: base directory `dough-boys-site`, build command
   `npm run build`, publish directory `dist`, Node 22. Nothing to fill in by hand.
3. Add the environment variables you need (see `.env.example`) under **Site configuration > Environment variables**.
4. Under **Domain management**, add `doughboysyarmouth.co.uk` as the primary domain and `www.doughboysyarmouth.co.uk`
   as an alias, then point the domain's DNS at Netlify. HTTPS certificates are issued automatically.
5. Under **Forms**, turn on form detection and add an email notification so enquiries reach your inbox.

### Before going live on the domain

As a limited company, the site has to show the registered company name, number, place of registration and registered
office (Companies Act 2006). Fill in the `company` fields in `src/data/business.ts`. **Once the site is on
doughboysyarmouth.co.uk, the production build on Netlify stops with an error until they are filled in.** Before the
domain is added, the site builds normally at its `netlify.app` address, so you can preview it; local builds and deploy
previews always work.

### Environment variables

| Name | What it does |
| --- | --- |
| `PUBLIC_CF_BEACON_TOKEN` | Cloudflare Web Analytics token. Empty: no analytics. Never loads on deploy previews. |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | Only if you verify Google Search Console by meta tag rather than DNS. |
| `PUBLIC_BING_SITE_VERIFICATION` | Only if you verify Bing Webmaster Tools by meta tag. |
| `CONTEXT`, `URL` | Set by Netlify. Only `production` is indexable; a production build whose `URL` is doughboysyarmouth.co.uk also requires the company details. |

## Headers, redirects and caching

- `netlify.toml` (repository root): `www` to the bare domain in one 301, HSTS (with preload), `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, and one-year immutable caching for the
  fingerprinted files in `/_astro/`.
- `dist/_headers` (generated): Content-Security-Policy with `frame-ancestors 'self'`, plus `X-Robots-Tag: noindex`
  outside production.
- Netlify upgrades plain `http` to `https` itself, and sends `/menu` to `/menu/` because every page is a folder with
  an `index.html`. Pages and links all use the trailing-slash form.

## Notes

- The copyright year in the footer comes from the build date, so it updates with every deploy.
- `sitemap.xml` dates each page by the last Git commit that changed its source files.
- The older single-page version of the site, hosted on GitHub Pages from `../dough-boys/`, is unchanged.
