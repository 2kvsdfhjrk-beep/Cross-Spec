"""Assemble the Cowey Tiling site from finished renders.

python build_site.py            -> writes site/ (production) and artifact/ (claude.ai page)
Expects out/final/<shot>_L.png|json and <shot>_P.png|json, and site/img encodes from post.py.
"""
import os, json, html, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FINAL = os.environ.get('FINAL_DIR', os.path.join(ROOT, 'out', 'final'))
SITE = os.environ.get('SITE_DIR', os.path.join(ROOT, 'site'))
ART = os.environ.get('ART_DIR', os.path.join(ROOT, 'artifact'))
IMG = os.path.join(SITE, 'img')

L_WIDTHS = [960, 1440, 1920, 2400]
P_WIDTHS = [640, 1080]

SHOTS = [
    dict(name='garden', alt='Porcelain patio at golden hour outside a brick kitchen extension with the bifold doors open',
         fx=(0.5, 0.62), pfx=(0.5, 0.6), portal='garden_door'),
    dict(name='kitchen', alt='Kitchen with a green handmade zellige splashback, a marble topped island and globe pendant lights',
         fx=(0.5, 0.5), pfx=(0.7, 0.5), portal='kitchen_door'),
    dict(name='bath', alt='Walk-in shower with large format marble effect porcelain walls, a lit niche and a frosted window',
         fx=(0.5, 0.5), pfx=(0.5, 0.5), glow='bath_niche'),
    dict(name='commercial', alt='Restaurant with a polished large format porcelain floor and a bar clad in glazed terracotta finger tiles',
         fx=(0.5, 0.5), pfx=(0.42, 0.5), glow={'L': 'pendant_2', 'P': 'pendant_4'}),
]
SERVICES = [
    ('garden', 'Patios and outdoor', 'Porcelain paving, natural stone, steps, paths and courtyards, laid on a full mortar bed over a compacted base with falls away from the house.'),
    ('kitchen', 'Kitchens, walls and floors', 'Splashbacks, feature walls and kitchen floors in zellige, metro, large format porcelain and natural stone, set out from the centre so the cuts are even.'),
    ('bath', 'Bathrooms and wet rooms', 'Full bathroom refits, walk-in showers and level access wet rooms, tanked and waterproofed before any tiling starts.'),
    ('commercial', 'Commercial tiling', 'Restaurants, shops, offices and communal areas, with large format floors and feature walls planned around how the space is used.'),
]
TIMELINE = [
    dict(type='hold', shot='garden', **{'from': 0.0, 'to': 0.165}, k=1.07),
    dict(type='portal', a='garden', b='kitchen', **{'from': 0.165, 'to': 0.305}),
    dict(type='hold', shot='kitchen', **{'from': 0.305, 'to': 0.44}, k=1.06),
    dict(type='portal', a='kitchen', b='bath', **{'from': 0.44, 'to': 0.575}),
    dict(type='hold', shot='bath', **{'from': 0.575, 'to': 0.70}, k=1.05),
    dict(type='glow', a='bath', b='commercial', **{'from': 0.70, 'to': 0.83}),
    dict(type='hold', shot='commercial', **{'from': 0.83, 'to': 1.0}, k=1.06),
]
CHAPTERS = [0.0, 0.29, 0.56, 0.81]


def srcset(name, widths, ext, portrait=False):
    tag = f'{name}-p' if portrait else name
    return ', '.join(f'img/{tag}-{w}.{ext} {w}w' for w in widths if os.path.exists(os.path.join(IMG, f'{tag}-{w}.{ext}')))


def shot_html(s, first):
    n = s['name']
    lazy = '' if first else ' loading="lazy"'
    prio = ' fetchpriority="high"' if first else ' fetchpriority="low"'
    cls = 'shot' if first else 'shot later'
    return f'''    <figure class="{cls}" data-shot="{n}" style="--fx:{s['fx'][0]*100:.0f}%;--fy:{s['fx'][1]*100:.0f}%">
      <picture>
        <source type="image/avif" media="(max-aspect-ratio: 4/5)" srcset="{srcset(n, P_WIDTHS, 'avif', True)}" sizes="100vw">
        <source type="image/jpeg" media="(max-aspect-ratio: 4/5)" srcset="{srcset(n, P_WIDTHS, 'jpg', True)}" sizes="100vw">
        <source type="image/avif" srcset="{srcset(n, L_WIDTHS, 'avif')}" sizes="100vw">
        <img src="img/{n}-1440.jpg" srcset="{srcset(n, L_WIDTHS, 'jpg')}" sizes="100vw" width="2400" height="1350" alt="{html.escape(s['alt'])}" decoding="async"{lazy}{prio}>
      </picture>
    </figure>'''


def service_html(shot, title, text):
    s = next(x for x in SHOTS if x['name'] == shot)
    return f'''      <article class="svc">
        <picture>
          <source type="image/avif" srcset="img/{shot}-960.avif 960w, img/{shot}-1440.avif 1440w" sizes="(max-width: 700px) 92vw, 380px">
          <img src="img/{shot}-960.jpg" width="960" height="540" alt="{html.escape(s['alt'])}" loading="lazy" decoding="async" style="object-position:{s['fx'][0]*100:.0f}% {s['fx'][1]*100:.0f}%">
        </picture>
        <h3>{title}</h3>
        <p>{text}</p>
      </article>'''


def config():
    shots = {}
    for s in SHOTS:
        entry = {}
        for key in ('L', 'P'):
            meta = json.load(open(os.path.join(FINAL, f"{s['name']}_{key}.json")))
            dims = meta['_dims']
            fx = s['fx'] if key == 'L' else s['pfx']
            e = dict(w=dims[0], h=dims[1], fx=fx[0], fy=fx[1])
            if 'portal' in s:
                e['portal'] = meta[s['portal']]
            if 'glow' in s:
                gk = s['glow'][key] if isinstance(s['glow'], dict) else s['glow']
                rect = meta[gk]
                # niche: aim at the LED strip just under its head, not the middle of the recess
                e['glow'] = [round((rect[0] + rect[2]) / 2, 4), round(rect[1] + (rect[3] - rect[1]) * 0.06, 4)] if len(rect) == 4 else rect[:2]
            entry[key] = e
        shots[s['name']] = entry
    return dict(shots=shots, timeline=TIMELINE, chapters=CHAPTERS)


def jsonld():
    data = {
        "@context": "https://schema.org",
        "@type": "HomeAndConstructionBusiness",
        "name": "Cowey Tiling",
        "description": "Family run tiling business for homes and businesses: porcelain patios and outdoor paving, kitchen splashbacks, bathrooms and wet rooms, wall and floor tiling, and commercial tiling.",
        "image": "img/garden-1440.jpg",
        "makesOffer": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": n}} for n in
                       ["Patio and outdoor porcelain paving", "Kitchen tiling and splashbacks", "Bathroom and wet room tiling",
                        "Wall and floor tiling", "Commercial tiling"]],
    }
    return '<script type="application/ld+json">' + json.dumps(data, separators=(',', ':')) + '</script>'


def preload():
    n = SHOTS[0]['name']
    return (f'<link rel="preload" as="image" type="image/avif" media="(max-aspect-ratio: 4/5)" imagesrcset="{srcset(n, P_WIDTHS, "avif", True)}" imagesizes="100vw" fetchpriority="high">\n'
            f'<link rel="preload" as="image" type="image/avif" media="(min-aspect-ratio: 4.001/5)" imagesrcset="{srcset(n, L_WIDTHS, "avif")}" imagesizes="100vw" fetchpriority="high">')


def portrait_css():
    rules = []
    for s in SHOTS:
        rules.append(f".shot[data-shot={s['name']}]{{--fx:{s['pfx'][0]*100:.0f}%!important;--fy:{s['pfx'][1]*100:.0f}%!important}}")
    return '<style>@media (max-aspect-ratio: 4/5){' + ''.join(rules) + '}</style>'


def build():
    t = open(os.path.join(ROOT, 'r', 'template.html')).read()
    body = (t.replace('%%SHOTS%%', '\n'.join(shot_html(s, i == 0) for i, s in enumerate(SHOTS)))
             .replace('%%SERVICES%%', '\n'.join(service_html(*x) for x in SERVICES))
             .replace('%%CONFIG%%', json.dumps(config(), separators=(',', ':')))
             .replace('%%JSONLD%%', jsonld())
             .replace('%%PRELOAD%%', preload() + '\n' + portrait_css()))
    os.makedirs(ART, exist_ok=True)
    with open(os.path.join(ART, 'index.html'), 'w') as f:
        f.write('<title>Cowey Tiling</title>\n<meta name="description" content="Family run tiling business: porcelain patios, kitchens, bathrooms and wet rooms, walls and floors, and commercial tiling.">\n' + body)
    head = '''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Cowey Tiling | Patio, Kitchen, Bathroom and Commercial Tiling</title>
<meta name="description" content="Cowey Tiling is a family run tiling business. Porcelain patios and outdoor paving, kitchen splashbacks, bathrooms and wet rooms, wall and floor tiling, and commercial tiling. Site visit and written quote.">
<meta name="theme-color" content="#0d0d0b">
<meta property="og:type" content="website">
<meta property="og:title" content="Cowey Tiling">
<meta property="og:description" content="Family run tiling, inside and out. Patios, kitchens, bathrooms, walls and floors, and commercial work.">
<meta property="og:image" content="img/garden-1440.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230d0d0b'/%3E%3Crect x='7' y='7' width='8' height='8' fill='%23d8b47a'/%3E%3Crect x='17' y='7' width='8' height='8' fill='%23f2efe9'/%3E%3Crect x='7' y='17' width='8' height='8' fill='%23f2efe9'/%3E%3Crect x='17' y='17' width='8' height='8' fill='%232f4a3f'/%3E%3C/svg%3E">
'''
    # move the head-only parts (preconnect, fonts, preload, style) into <head>
    cut = body.index('<header')
    head_part, rest = body[:cut], body[cut:]
    prod = head + head_part + '</head>\n<body>\n' + rest + '</body>\n</html>\n'
    with open(os.path.join(SITE, 'index.html'), 'w') as f:
        f.write(prod)
    import shutil
    shutil.copy(os.path.join(ROOT, 'r', 'README-site.txt'), os.path.join(SITE, 'README.txt'))
    open(os.path.join(SITE, '.nojekyll'), 'w').close()
    with open(os.path.join(SITE, 'robots.txt'), 'w') as f:
        f.write('User-agent: *\nAllow: /\n')
    # cache rules for Netlify or Cloudflare Pages style hosts: images never change, the page revalidates
    with open(os.path.join(SITE, '_headers'), 'w') as f:
        f.write('/img/*\n  Cache-Control: public, max-age=31536000, immutable\n/*.html\n  Cache-Control: public, max-age=0, must-revalidate\n/\n  Cache-Control: public, max-age=0, must-revalidate\n')
    print('built', len(prod), 'bytes production,', len(body), 'bytes artifact body')


if __name__ == '__main__':
    build()
