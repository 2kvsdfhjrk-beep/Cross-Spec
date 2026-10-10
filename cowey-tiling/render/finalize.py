"""Grade and encode every finished render, then rebuild the site.

python finalize.py [shot ...]   (default: every shot whose render exists)
"""
import os, sys, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import post

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FINAL = os.path.join(ROOT, 'out', 'final')
IMG = os.path.join(ROOT, 'site', 'img')

GRADE = {
    'garden': dict(wb=0.55, lift=0.03, bloom=0.8, vig=0.22),
    'kitchen': dict(wb=0.2, lift=0.025, bloom=1.0, vig=0.24),
    'bath': dict(wb=0.05, lift=0.0, bloom=0.7, vig=0.18),
    'commercial': dict(wb=0.1, lift=0.02, bloom=1.15, vig=0.28),
}
WIDTHS = {'L': [960, 1440, 1920, 2400], 'P': [640, 1080]}

shots = sys.argv[1:] or list(GRADE)
report = {}
for shot in shots:
    for key in ('L', 'P'):
        src = os.path.join(FINAL, f'{shot}_{key}.png')
        if not os.path.exists(src):
            continue
        a = post.finish(src, **GRADE[shot])
        base = shot if key == 'L' else f'{shot}-p'
        sizes, dims = post.encode(a, IMG, base, WIDTHS[key])
        report[f'{shot}_{key}'] = {w: round(v['avif'] / 1024) for w, v in sizes.items()}
print(json.dumps(report))
subprocess.run([sys.executable, os.path.join(ROOT, 'r', 'build_site.py')], check=True)
