"""Photographic finishing + web encodes.

python post.py <in.png> <out_dir> <basename> [widths] [--warm 1.0] [--vig 0.22] [--bloom 1.0]
Writes <basename>-<w>.avif / .webp / .jpg for each width.
"""
import sys, os, json
import numpy as np
from PIL import Image, ImageFilter


def blur(arr, radius):
    im = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255


def scale_channel(ch, s):
    h, w = ch.shape
    cx, cy = w / 2, h / 2
    im = Image.fromarray(np.clip(ch * 255, 0, 255).astype(np.uint8))
    im = im.transform((w, h), Image.AFFINE, (1 / s, 0, cx - cx / s, 0, 1 / s, cy - cy / s), resample=Image.BICUBIC)
    return np.asarray(im).astype(np.float32) / 255


def finish(path, warm=1.0, vig=0.22, bloom=1.0, ca=0.0007, wb=0.0, lift=0.0):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255
    # white balance shift (positive = warmer) and a gentle shadow lift, like a camera profile
    if wb:
        a = a * np.array([1 + 0.05 * wb, 1 + 0.008 * wb, 1 - 0.06 * wb], np.float32)
    if lift:
        a = a + lift * (1 - a) ** 3
    h, w = a.shape[:2]
    # halation / bloom from highlights
    lum = a.max(axis=2)
    hi = np.clip((lum - 0.80) / 0.2, 0, 1)[..., None] * a
    if bloom > 0:
        b1 = blur(hi, w * 0.0035)
        b2 = blur(hi, w * 0.018)
        tint = np.array([1.0, 0.86 * warm ** 0.2, 0.7 * warm ** 0.4], np.float32)
        a = a + bloom * (b1 * 0.22 + b2 * 0.16 * tint)
    # lateral chromatic aberration, very slight
    if ca:
        # every channel is magnified (never shrunk) so the frame edges stay clean
        a[..., 0] = scale_channel(np.clip(a[..., 0], 0, 1), 1 + ca)
        a[..., 1] = scale_channel(np.clip(a[..., 1], 0, 1), 1 + ca / 2)
    # optical vignette
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / np.sqrt(2)
    a *= (1 - vig * r ** 2.3)[..., None]
    return np.clip(a, 0, 1)


def encode(a, out_dir, base, widths, seed=1):
    os.makedirs(out_dir, exist_ok=True)
    h, w = a.shape[:2]
    full = Image.fromarray((a * 255 + 0.5).astype(np.uint8))
    rng = np.random.default_rng(seed)
    sizes = {}
    for tw in widths:
        if tw > w:
            continue
        th = round(h * tw / w)
        im = full.resize((tw, th), Image.LANCZOS)
        im = im.filter(ImageFilter.UnsharpMask(radius=0.9, percent=32, threshold=2))
        arr = np.asarray(im).astype(np.float32)
        arr += rng.normal(0, 0.5, arr.shape[:2])[..., None]
        im = Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8))
        p = os.path.join(out_dir, f'{base}-{tw}')
        im.save(p + '.avif', quality=58, speed=4)
        im.save(p + '.jpg', quality=80, optimize=True, progressive=True)
        sizes[tw] = {ext: os.path.getsize(p + '.' + ext) for ext in ('avif', 'jpg')}
    return sizes, (w, h)


if __name__ == '__main__':
    src, out_dir, base = sys.argv[1], sys.argv[2], sys.argv[3]
    widths = [int(x) for x in (sys.argv[4] if len(sys.argv) > 4 and not sys.argv[4].startswith('--') else '640,960,1280,1920,2560').split(',')]
    opts = dict(warm=1.0, vig=0.22, bloom=1.0, wb=0.0, lift=0.0)
    for i, x in enumerate(sys.argv):
        if x.startswith('--'):
            opts[x[2:]] = float(sys.argv[i + 1])
    a = finish(src, **opts)
    sizes, dims = encode(a, out_dir, base, widths)
    print(json.dumps({'base': base, 'dims': dims, 'sizes': sizes}))
