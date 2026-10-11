"""Grade the drone frames, cut the 16:9 and 9:16 crops, and encode them as short H.264 video chunks for the scroll player.

python frames.py [--skip-grade]
Reads out/fly/world/NNNN.png (one continuous flight).
Writes site/v/{L,P}-k.mp4, the poster and the service photos in site/img, and out/fly/manifest.json for build_site.py.
"""
import os, sys, json, subprocess, shutil
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from post import blur, scale_channel

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLY = os.path.join(ROOT, 'out', 'fly')
SRC = os.path.join(FLY, 'world')
ENC = os.path.join(ROOT, 'out', 'enc')
SITE = os.environ.get('SITE_DIR', os.path.join(ROOT, 'site'))
N = 290
FPS = 30
CHUNKS = [(0, 118), (118, 60), (178, 112)]          # garden and kitchen; hallway and bathroom; street and coffee shop
CRF = int(os.environ.get('CRF', '23'))
GOP = int(os.environ.get('GOP', '4'))
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')

GRADE = {
    'garden': dict(wb=0.55, lift=0.03, bloom=0.8, vig=0.22),
    'kitchen': dict(wb=0.2, lift=0.025, bloom=1.0, vig=0.24),
    'hall': dict(wb=0.3, lift=0.02, bloom=0.9, vig=0.24),
    'bath': dict(wb=0.05, lift=0.0, bloom=0.7, vig=0.18),
    'street': dict(wb=0.25, lift=0.03, bloom=0.7, vig=0.2),
    'cafe': dict(wb=0.15, lift=0.02, bloom=1.1, vig=0.26),
}
ZONES = [(0, 'garden'), (56, 'garden'), (76, 'kitchen'), (110, 'kitchen'), (124, 'hall'), (142, 'hall'), (152, 'bath'), (170, 'bath'),
         (186, 'street'), (232, 'street'), (248, 'cafe'), (289, 'cafe')]
# frames used as still photos: the poster (must be frame 0) and the service cards
STILLS = {'hero': 0, 'garden': 40, 'kitchen': 90, 'hall': 132, 'bath': 158, 'commercial': 289}


def grade_for(f):
    for (f0, a), (f1, b) in zip(ZONES, ZONES[1:]):
        if f0 <= f <= f1:
            t = 0 if f1 == f0 else (f - f0) / (f1 - f0)
            t = t * t * (3 - 2 * t)
            return {k: GRADE[a][k] * (1 - t) + GRADE[b][k] * t for k in GRADE[a]}
    return dict(GRADE[ZONES[-1][1]])


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
    short = round(s * 9 / 16 / 2) * 2
    o = (s - short) // 2
    return {'L': a[o:o + short, :], 'P': a[:, o:o + short]}


def to_im(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))


def save_still(im, name, key):
    widths = {'L': [768, 1152], 'P': [480, 648]}[key] if name == 'hero' else ([640, 1152] if key == 'L' else [])
    for w in widths:
        sm = im if w == im.size[0] else im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
        tag = name if key == 'L' else f'{name}-p'
        out = os.path.join(SITE, 'img', f'{tag}-{w}')
        sm.save(out + '.avif', quality=62, speed=4)
        sm.save(out + '.jpg', quality=82, optimize=True, progressive=True)


def grade_all():
    still_at = {v: k for k, v in STILLS.items()}
    for k in ('L', 'P'):
        os.makedirs(os.path.join(ENC, k), exist_ok=True)
    os.makedirs(os.path.join(SITE, 'img'), exist_ok=True)
    for f in range(N):
        src = os.path.join(SRC, f'{f:04d}.png')
        g = grade_for(f)
        a = develop(src, **g)
        for k, c in crops(a).items():
            im = to_im(vignette(c, g['vig'])).filter(ImageFilter.UnsharpMask(radius=0.8, percent=28, threshold=2))
            im.save(os.path.join(ENC, k, f'{f:04d}.png'), compress_level=1)
            if f in still_at:
                save_still(im, still_at[f], k)
        if f % 20 == 0:
            print('graded', f, flush=True)


def encode():
    os.makedirs(os.path.join(SITE, 'v'), exist_ok=True)
    sizes = {}
    for k in ('L', 'P'):
        for i, (start, n) in enumerate(CHUNKS):
            out = os.path.join(SITE, 'v', f'{k}-{i}.mp4')
            cmd = [FFMPEG, '-y', '-loglevel', 'error', '-framerate', str(FPS), '-start_number', str(start), '-i', os.path.join(ENC, k, '%04d.png'),
                   '-frames:v', str(n), '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
                   '-c:v', 'libx264', '-preset', 'slow', '-crf', str(CRF), '-g', str(GOP), '-keyint_min', str(GOP), '-sc_threshold', '0', '-bf', '0',
                   '-tune', 'film', '-profile:v', 'high', '-level', '4.0', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                   '-color_range', 'tv', '-movflags', '+faststart', '-an', out]
            subprocess.run(cmd, check=True)
            sizes[f'{k}-{i}'] = round(os.path.getsize(out) / 1024)
    return sizes


def main():
    if '--skip-grade' not in sys.argv:
        grade_all()
    sizes = encode()
    dims = {k: Image.open(os.path.join(ENC, k, '0000.png')).size for k in ('L', 'P')}
    man = dict(n=N, fps=FPS, chunks=[dict(start=s, n=n) for s, n in CHUNKS], L=dims['L'], P=dims['P'], kb=sizes)
    json.dump(man, open(os.path.join(FLY, 'manifest.json'), 'w'))
    print(json.dumps(man))


if __name__ == '__main__':
    main()
