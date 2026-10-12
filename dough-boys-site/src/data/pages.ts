/*
  One entry per page. The layout refuses to render a page that is not listed here, so every page
  gets a title, description, canonical URL, social tags and breadcrumbs from the same place.
  The build stops if anything is missing or repeated; lengths outside the targets are warned about.
*/

export interface PageMeta {
  path: string;
  title: string; // 50 to 60 characters: main phrase first, brand last
  description: string; // 140 to 160 characters
  h1: string; // the page's only h1, as the built page must show it
  crumb: string; // label in breadcrumbs
  parent?: PageKey;
  index: boolean; // false: noindex and left out of the sitemap
  sources: string[]; // files whose last commit date is the page's sitemap lastmod
}

export const pages = {
  home: {
    path: '/',
    title: 'Pizza in Great Yarmouth | Dough Boys, Just Good Pizza',
    description:
      'Dough Boys is a pizza kiosk in Great Yarmouth, NR30 3JG. Pizzas from £12, sides and dessert pizzas, plus pizza for parties, events and big orders.',
    h1: 'Dough Boys: Pizza in Great Yarmouth',
    crumb: 'Home',
    index: true,
    sources: ['src/pages/index.astro', 'src/data/menu.ts', 'src/data/gallery.ts'],
  },
  menu: {
    path: '/menu/',
    title: 'Our Pizza Menu and Prices in Great Yarmouth | Dough Boys',
    description:
      'See the full Dough Boys menu: nine pizzas from £12, garlic bread and mac & cheese, dessert pizzas at £8, dips and cold drinks at our Great Yarmouth kiosk.',
    h1: 'Pizza menu and prices',
    crumb: 'Menu',
    parent: 'home',
    index: true,
    sources: ['src/pages/menu/index.astro', 'src/data/menu.ts'],
  },
  enquire: {
    path: '/enquire/',
    title: 'Pizza for Parties, Events and Big Orders | Dough Boys',
    description:
      'Planning a party, an event or a big order in Great Yarmouth? Tell Dough Boys what you need, from a few pizzas to feeding a crowd, and we’ll get back to you.',
    h1: 'Pizza for parties, events and big orders',
    crumb: 'Enquire',
    parent: 'home',
    index: true,
    sources: ['src/pages/enquire/index.astro'],
  },
  thanks: {
    path: '/enquire/thanks/',
    title: 'Thanks for Your Enquiry | Dough Boys, Great Yarmouth',
    description:
      'Thanks for getting in touch with Dough Boys in Great Yarmouth. We have your enquiry and will reply by phone or email as soon as we can. Hungry meanwhile?',
    h1: 'Thanks, we’ve got your enquiry',
    crumb: 'Thank you',
    parent: 'enquire',
    index: false,
    sources: ['src/pages/enquire/thanks/index.astro'],
  },
  loyalty: {
    path: '/loyalty-card/',
    title: 'Pizza Loyalty Card: Nine Stamps, Then One Free | Dough Boys',
    description:
      'Get a stamp with every pizza you buy at Dough Boys in Great Yarmouth. Fill all nine stamps on your loyalty card and your next pizza is on us. Here’s how.',
    h1: 'The Dough Boys loyalty card',
    crumb: 'Loyalty card',
    parent: 'home',
    index: true,
    sources: ['src/pages/loyalty-card/index.astro', 'src/components/LoyaltyCard.astro'],
  },
  gallery: {
    path: '/gallery/',
    title: 'Pizza Photos and Our Great Yarmouth Kiosk | Dough Boys',
    description:
      'Photos of Dough Boys pizzas fresh out of the oven, from the Double Pepperoni to the Hot Meat, plus a look inside our kiosk and busy nights in Great Yarmouth.',
    h1: 'Pizza photos from our Great Yarmouth kiosk',
    crumb: 'Gallery',
    parent: 'home',
    index: true,
    sources: ['src/pages/gallery/index.astro', 'src/data/gallery.ts'],
  },
  find: {
    path: '/find-us/',
    title: 'How to Find Our Pizza Kiosk in Great Yarmouth | Dough Boys',
    description:
      'Find the Dough Boys pizza kiosk in Great Yarmouth, NR30 3JG: directions, how to spot us, opening times and how to get in touch, plus our company details.',
    h1: 'Find Dough Boys in Great Yarmouth',
    crumb: 'Find us',
    parent: 'home',
    index: true,
    sources: ['src/pages/find-us/index.astro', 'src/data/business.ts'],
  },
  privacy: {
    path: '/privacy/',
    title: 'Privacy Policy, Cookies and Your Data | Dough Boys',
    description:
      'How Dough Boys uses the details you send us, why this website sets no cookies, how our cookie-free visitor statistics work and how to use your data rights.',
    h1: 'Privacy policy',
    crumb: 'Privacy policy',
    parent: 'home',
    index: true,
    sources: ['src/pages/privacy/index.astro', 'src/data/business.ts'],
  },
  notFound: {
    path: '/404.html',
    title: 'Page Not Found | Dough Boys, Great Yarmouth',
    description:
      'Sorry, that page isn’t here. Head back to the Dough Boys homepage, see the pizza menu and prices, or find our pizza kiosk in Great Yarmouth, NR30 3JG.',
    h1: 'Sorry, we can’t find that page',
    crumb: 'Page not found',
    index: false,
    sources: ['src/pages/404.astro'],
  },
} satisfies Record<string, PageMeta>;

export type PageKey = keyof typeof pages;
export const pageList = Object.entries(pages).map(([key, p]) => ({ key: key as PageKey, ...(p as PageMeta) }));

/* Home > Parent > Page */
export function trail(key: PageKey): { name: string; path: string }[] {
  const out: { name: string; path: string }[] = [];
  let k: PageKey | undefined = key;
  while (k) {
    const p: PageMeta = pages[k];
    out.unshift({ name: p.crumb, path: p.path });
    k = p.parent;
  }
  if (out[0]?.path !== '/') out.unshift({ name: pages.home.crumb, path: '/' });
  return out;
}

/* ---------- build-time checks ---------- */
const problems: string[] = [];
const warnings: string[] = [];
const seen = { title: new Map<string, string>(), description: new Map<string, string>(), h1: new Map<string, string>() };
for (const p of pageList) {
  for (const field of ['title', 'description', 'h1'] as const) {
    const v = p[field]?.trim();
    if (!v) { problems.push(`${p.key}: missing ${field}`); continue; }
    const other = seen[field].get(v.toLowerCase());
    if (other) problems.push(`${p.key}: same ${field} as ${other}`);
    seen[field].set(v.toLowerCase(), p.key);
  }
  if (!p.index) continue;
  if (p.title.length < 45 || p.title.length > 62) warnings.push(`${p.key}: title is ${p.title.length} characters (aim for 50 to 60)`);
  if (p.description.length < 130 || p.description.length > 165) warnings.push(`${p.key}: description is ${p.description.length} characters (aim for 140 to 160)`);
}
if (problems.length) throw new Error(`Page metadata problems:\n  ${problems.join('\n  ')}`);
if (warnings.length && !(globalThis as { __dbPagesWarned?: boolean }).__dbPagesWarned) {
  (globalThis as { __dbPagesWarned?: boolean }).__dbPagesWarned = true;
  console.warn(`[dough-boys] Page metadata warnings:\n  ${warnings.join('\n  ')}`);
}
