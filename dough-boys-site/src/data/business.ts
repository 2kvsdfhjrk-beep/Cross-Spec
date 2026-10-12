/*
  Everything the site says about the business lives here, so the footer, the find-us page,
  the privacy policy and the structured data for search engines always agree.

  Optional fields: leave them as '' (or []) and they are simply left off the site.
  Company fields: required by law for a limited company. A production build on Netlify
  stops with an error until they are filled in, so the site can never go live without them.
*/

export type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export interface Hours { days: Day[]; opens: string; closes: string } // 24-hour times, e.g. '12:00'

export const business = {
  name: 'Dough Boys',
  slogan: 'Just good pizza',
  url: 'https://doughboysyarmouth.co.uk',
  instagram: 'doughboysyarmouth',

  address: {
    street: '', // optional: the kiosk's street address, exactly as on Google Business Profile
    locality: 'Great Yarmouth',
    region: 'Norfolk',
    postcode: 'NR30 3JG',
    country: 'GB',
  },

  phone: '', // optional, e.g. '01493 000000'
  email: '', // optional, e.g. 'hello@doughboysyarmouth.co.uk'
  openingHours: [] as Hours[], // optional, e.g. [{ days: ['Friday', 'Saturday'], opens: '12:00', closes: '21:00' }]

  company: {
    legalName: '', // REQUIRED: the name registered at Companies House, e.g. 'Dough Boys Yarmouth Ltd'
    number: '', // REQUIRED: the 8-character company number
    registeredIn: 'England and Wales',
    registeredOffice: '', // REQUIRED: the registered office address, on one line
  },
};

export const instagramUrl = `https://www.instagram.com/${business.instagram}/`;
export const instagramDm = `https://ig.me/m/${business.instagram}`;
export const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  [business.name, business.address.street, business.address.locality, business.address.postcode].filter(Boolean).join(', '),
)}`;
export const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(
  [business.address.street, business.address.locality, business.address.postcode].filter(Boolean).join(', '),
)}`;

export const addressLine = [business.address.street, business.address.locality, business.address.postcode].filter(Boolean).join(', ');

export const companyMissing = (['legalName', 'number', 'registeredOffice'] as const).filter((k) => !business.company[k].trim());
export const hasCompany = companyMissing.length === 0;

/* "Dough Boys is a trading name of ... Ltd, registered in England and Wales, company number ..., registered office ..." */
export const companyDisclosure = hasCompany
  ? `${business.name} is a trading name of ${business.company.legalName}, a company registered in ${business.company.registeredIn}, ` +
    `company number ${business.company.number}. Registered office: ${business.company.registeredOffice}.`
  : '';

const DAY_ORDER: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const to12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 && h < 24 ? 'pm' : 'am';
  const hh = h % 12 || 12;
  return m ? `${hh}.${String(m).padStart(2, '0')}${suffix}` : `${hh}${suffix}`;
};
/* [{ days: 'Friday to Sunday', times: '12pm to 9pm' }] */
export const hoursText = business.openingHours.map((h) => {
  const idx = h.days.map((d) => DAY_ORDER.indexOf(d)).sort((a, b) => a - b);
  const run = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  const days = idx.length > 2 && run ? `${DAY_ORDER[idx[0]]} to ${DAY_ORDER[idx[idx.length - 1]]}` : idx.map((i) => DAY_ORDER[i]).join(', ');
  return { days, times: `${to12(h.opens)} to ${to12(h.closes)}` };
});

/* Netlify sets CONTEXT. Only the real production deploy is held to the company-details rule. */
const context = process.env.CONTEXT ?? '';
if (!hasCompany) {
  const msg =
    `Company details missing in src/data/business.ts: ${companyMissing.join(', ')}. ` +
    'A limited company must show its registered name, number, place of registration and registered office on its website (Companies Act 2006).';
  if (context === 'production' || process.env.REQUIRE_COMPANY_DETAILS === '1') throw new Error(msg);
  else if (!(globalThis as { __dbWarned?: boolean }).__dbWarned) {
    (globalThis as { __dbWarned?: boolean }).__dbWarned = true;
    console.warn(`\n[dough-boys] ${msg} Preview builds continue; the production build will stop here.\n`);
  }
}
