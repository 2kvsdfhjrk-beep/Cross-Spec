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

FLY = os.path.join(ROOT, 'out', 'fly')
FMTS = os.environ.get('FMTS', 'avif,webp').split(',')

HERO_ALT = 'Back garden at golden hour with a porcelain patio, an outdoor sofa and a brick kitchen extension with its bifold doors open'
ALT = {
    'garden': 'Porcelain patio at golden hour with sunlight falling through a slatted cedar screen',
    'kitchen': 'Kitchen with a green handmade zellige splashback, a marble worktop and globe pendant lights',
    'bath': 'Walk-in shower with large format marble effect porcelain walls, a lit niche and a teak stool',
    'commercial': 'Restaurant bar clad in glazed terracotta finger tiles above a polished large format porcelain floor',
}
SERVICES = [
    ('garden', 'Patios and outdoor', 'Porcelain paving, natural stone, steps, paths and courtyards, laid on a full mortar bed over a compacted base with falls away from the house.'),
    ('kitchen', 'Kitchens, walls and floors', 'Splashbacks, feature walls and kitchen floors in zellige, metro, large format porcelain and natural stone, set out from the centre so the cuts are even.'),
    ('bath', 'Bathrooms and wet rooms', 'Full bathroom refits, walk-in showers and level access wet rooms, tanked and waterproofed before any tiling starts.'),
    ('commercial', 'Commercial tiling', 'Restaurants, shops, offices and communal areas, with large format floors and feature walls planned around how the space is used.'),
]
# the flight: house frames 0-149, then the high street 150-219.
# scroll progress through the story -> frame; flat stretches hold a view while the caption is read
MAP = [[0, 0], [0.03, 0], [0.30, 60], [0.52, 104], [0.62, 130], [0.67, 149], [0.70, 149], [0.735, 150], [0.97, 219], [1, 219]]
BEATS = {'AT1': 0.13, 'AT2': 0.38, 'AT3': 0.615, 'AT4': 0.84}
CHAPTERS = [0.0, 0.29, 0.56, 0.71]
STORY_VH = 900


def poster_html():
    return f'''    <picture class="poster">
      <source type="image/avif" media="(max-aspect-ratio: 1/1)" srcset="img/hero-p-480.avif 480w, img/hero-p-648.avif 648w" sizes="100vw">
      <source type="image/jpeg" media="(max-aspect-ratio: 1/1)" srcset="img/hero-p-480.jpg 480w, img/hero-p-648.jpg 648w" sizes="100vw">
      <source type="image/avif" srcset="img/hero-768.avif 768w, img/hero-1152.avif 1152w" sizes="100vw">
      <img src="img/hero-1152.jpg" srcset="img/hero-768.jpg 768w, img/hero-1152.jpg 1152w" sizes="100vw" width="1152" height="648" alt="{html.escape(HERO_ALT)}" fetchpriority="high">
    </picture>'''


def service_html(shot, title, text):
    return f'''      <article class="svc">
        <picture>
          <source type="image/avif" srcset="img/{shot}-640.avif 640w, img/{shot}-1152.avif 1152w" sizes="(max-width: 700px) 92vw, 380px">
          <img src="img/{shot}-640.jpg" srcset="img/{shot}-640.jpg 640w, img/{shot}-1152.jpg 1152w" sizes="(max-width: 700px) 92vw, 380px" width="640" height="360" alt="{html.escape(ALT[shot])}" loading="lazy" decoding="async">
        </picture>
        <h3>{title}</h3>
        <p>{text}</p>
      </article>'''


def config():
    man = json.load(open(os.path.join(FLY, 'manifest.json')))
    return dict(n=man['n'], cuts=[150], map=MAP, ch=CHAPTERS, L=dict(w=man['L'][0], h=man['L'][1]), P=dict(w=man['P'][0], h=man['P'][1]), fmts=FMTS)


def jsonld():
    data = {
        "@context": "https://schema.org",
        "@type": "HomeAndConstructionBusiness",
        "name": "Cowey Tiling",
        "description": "Family run tiling business for homes and businesses: porcelain patios and outdoor paving, kitchen splashbacks, bathrooms and wet rooms, wall and floor tiling, and commercial tiling.",
        "image": "img/hero-1152.jpg",
        "makesOffer": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": n}} for n in
                       ["Patio and outdoor porcelain paving", "Kitchen tiling and splashbacks", "Bathroom and wet room tiling",
                        "Wall and floor tiling", "Commercial tiling"]],
    }
    return '<script type="application/ld+json">' + json.dumps(data, separators=(',', ':')) + '</script>'


def preload():
    return ('<link rel="preload" as="image" type="image/avif" media="(max-aspect-ratio: 1/1)" imagesrcset="img/hero-p-480.avif 480w, img/hero-p-648.avif 648w" imagesizes="100vw" fetchpriority="high">\n'
            '<link rel="preload" as="image" type="image/avif" media="(min-aspect-ratio: 1.001/1)" imagesrcset="img/hero-768.avif 768w, img/hero-1152.avif 1152w" imagesizes="100vw" fetchpriority="high">')


def build():
    t = open(os.path.join(ROOT, 'r', 'template.html')).read()
    body = (t.replace('%%POSTER%%', poster_html())
             .replace('%%SERVICES%%', '\n'.join(service_html(*x) for x in SERVICES))
             .replace('%%CONFIG%%', json.dumps(config(), separators=(',', ':')))
             .replace('%%JSONLD%%', jsonld())
             .replace('%%PRELOAD%%', preload())
             .replace('%%STORYH%%', str(STORY_VH))
             .replace('%%RANGEH%%', str(STORY_VH - 100)))
    for k, v in BEATS.items():
        body = body.replace(f'%%{k}%%', str(v))
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
<meta property="og:image" content="img/hero-1152.jpg">
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
        f.write('/img/*\n  Cache-Control: public, max-age=31536000, immutable\n/f/*\n  Cache-Control: public, max-age=31536000, immutable\n/*.html\n  Cache-Control: public, max-age=0, must-revalidate\n/\n  Cache-Control: public, max-age=0, must-revalidate\n')
    print('built', len(prod), 'bytes production,', len(body), 'bytes artifact body')


if __name__ == '__main__':
    build()
