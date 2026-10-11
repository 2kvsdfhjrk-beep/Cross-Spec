"""Grade the drone frames, cut the 16:9 and 9:16 crops, encode them for the scroll player.

python frames.py [--only N,N] [--test]
Reads out/fly/house/*.png then out/fly/street/*.png as one continuous flight.
Writes site/f/L/NNN.avif|webp, site/f/P/NNN.avif|webp, the poster and the service card images in site/img,
and out/fly/manifest.json for build_site.py.
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from post import blur, scale_channel

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLY = os.path.join(ROOT, 'out', 'fly')
SITE = os.environ.get('SITE_DIR', os.path.join(ROOT, 'site'))
SEQS = [('house', 150), ('street', 70)]

GRADE = {
    'garden': dict(wb=0.55, lift=0.03, bloom=0.8, vig=0.22),
    'kitchen': dict(wb=0.2, lift=0.025, bloom=1.0, vig=0.24),
    'bath': dict(wb=0.05, lift=0.0, bloom=0.7, vig=0.18),
    'commercial': dict(wb=0.1, lift=0.02, bloom=1.15, vig=0.28),
}
# grade zones along each flight: (frame, look), blended in between
ZONES = {'house': [(0, 'garden'), (56, 'garden'), (76, 'kitchen'), (108, 'kitchen'), (124, 'bath'), (149, 'bath')],
         'street': [(0, 'commercial'), (69, 'commercial')]}
# frames used as still photos: poster, service cards
STILLS = {'hero': ('house', 0), 'garden': ('house', 30), 'kitchen': ('house', 90), 'bath': ('house', 149), 'commercial': ('street', 69)}


def grade_for(seq, f):
    z = ZONES[seq]
    for (f0, a), (f1, b) in zip(z, z[1:]):
        if f0 <= f <= f1:
            t = 0 if f1 == f0 else (f - f0) / (f1 - f0)
            t = t * t * (3 - 2 * t)
            return {k: GRADE[a][k] * (1 - t) + GRADE[b][k] * t for k in GRADE[a]}
    return dict(GRADE[z[-1][1]])


def develop(path, wb, lift, bloom, warm=1.0, ca=0.0006, **_):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255
    if wb:
        a = a * np.array([1 + 0.05 * wb, 1 + 0.008 * wb, 1 - 0.06 * wb], np.float32)
    if lift:
        a = a + lift * (1 - a) ** 3
    w = a.shape[1]
    if bloom > 0:
        hi = np.clip((a.max(axis=2) - 0.80) / 0.2, 0, 1)[..., None] * a
        tint = np.array([1.0, 0.86 * warm ** 0.2, 0.7 * warm ** 0.4], np.float32)
        a = a + bloom * (blur(hi, w * 0.0035) * 0.22 + blur(hi, w * 0.018) * 0.16 * tint)
    if ca:
        a[..., 0] = scale_channel(np.clip(a[..., 0], 0, 1), 1 + ca)
        a[..., 1] = scale_channel(np.clip(a[..., 1], 0, 1), 1 + ca / 2)
    return np.clip(a, 0, 1)


def vignette(a, vig):
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / np.sqrt(2)
    return a * (1 - vig * r ** 2.3)[..., None]


def crops(a):
    s = a.shape[0]
    short = round(s * 9 / 16)
    o = (s - short) // 2
    return {'L': a[o:o + short, :], 'P': a[:, o:o + short]}


def to_im(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))


def sharpen(im):
    return im.filter(ImageFilter.UnsharpMask(radius=0.8, percent=28, threshold=2))


def main():
    only = None
    if '--only' in sys.argv:
        only = {int(x) for x in sys.argv[sys.argv.index('--only') + 1].split(',')}
    aq, wq = int(os.environ.get('AVIF_Q', '50')), int(os.environ.get('WEBP_Q', '68'))
    for k in ('L', 'P'):
        os.makedirs(os.path.join(SITE, 'f', k), exist_ok=True)
    os.makedirs(os.path.join(SITE, 'img'), exist_ok=True)
    total = {'L': {'avif': 0, 'webp': 0}, 'P': {'avif': 0, 'webp': 0}}
    gi = 0
    dims = None
    still_at = {v: k for k, v in STILLS.items()}
    for seq, n in SEQS:
        for f in range(n):
            idx = gi
            gi += 1
            if only is not None and idx not in only:
                continue
            src = os.path.join(FLY, seq, f'{f:04d}.png')
            if not os.path.exists(src):
                continue
            g = grade_for(seq, f)
            a = develop(src, **g)
            for k, c in crops(a).items():
                im = sharpen(to_im(vignette(c, g['vig'])))
                dims = dims or {}
                dims[k] = im.size
                base = os.path.join(SITE, 'f', k, f'{idx:03d}')
                im.save(base + '.avif', quality=aq, speed=6)
                im.save(base + '.webp', quality=wq, method=4)
                total[k]['avif'] += os.path.getsize(base + '.avif')
                total[k]['webp'] += os.path.getsize(base + '.webp')
                name = still_at.get((seq, f))
                if name:
                    widths = {'L': [768, 1152], 'P': [480, 648]}[k] if name == 'hero' else ([640, 1152] if k == 'L' else [])
                    for w in widths:
                        sm = im if w == im.size[0] else im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
                        tag = name if k == 'L' else f'{name}-p'
                        out = os.path.join(SITE, 'img', f'{tag}-{w}')
                        sm.save(out + '.avif', quality=62, speed=4)
                        sm.save(out + '.jpg', quality=82, optimize=True, progressive=True)
            print('frame', idx, seq, f, flush=True)
    man = dict(n=gi, L=dims['L'] if dims else None, P=dims['P'] if dims else None, kb={k: {e: round(v / 1024) for e, v in d.items()} for k, d in total.items()})
    if only is None:
        json.dump(man, open(os.path.join(FLY, 'manifest.json'), 'w'))
    print(json.dumps(man))


if __name__ == '__main__':
    main()
