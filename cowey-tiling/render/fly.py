"""Drone flythrough frames: one continuous camera move per location.

python fly.py <house|street> <size> <samples> <out_dir> <frames>
  frames: "0-199", "0,40,80" or "all"
Renders square frames (size x size) so one render serves both the 16:9 and the 9:16 crop.
"""
import sys, os, math, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
WHICH = sys.argv[1]
if WHICH == 'house':
    import house as S
else:
    import commercial as S
import bpy
from mathutils import Vector, Quaternion
from lib import render_settings

# (frame, camera position, look-at point). Speed comes from the spacing of the frames.
PATHS = {
    'house': dict(
        frames=150,
        keys=[
            (0,   (0.55, -9.4, 1.95), (0.20, 0.0, 1.05)),
            (22,  (0.75, -6.4, 1.62), (0.15, 1.2, 1.12)),
            (44,  (0.60, -3.2, 1.45), (0.25, 3.5, 1.20)),
            (60,  (0.50, -0.8, 1.38), (0.35, 4.5, 1.22)),
            (72,  (1.00, 1.10, 1.40), (-0.20, 5.6, 1.18)),
            (88,  (2.10, 2.70, 1.45), (-0.60, 6.0, 1.28)),
            (104, (2.50, 4.55, 1.40), (2.30, 7.4, 1.30)),
            (117, (2.58, 6.05, 1.36), (2.55, 9.0, 1.33)),
            (132, (2.64, 6.72, 1.38), (2.50, 9.0, 1.42)),
            (149, (2.74, 6.95, 1.42), (2.45, 8.95, 1.45)),
        ],
        # exposure follows the camera like a drone's auto exposure
        expo=[(0, -0.85), (56, -0.85), (72, -0.3), (108, -0.3), (122, 0.0), (149, 0.05)],
        lens=22.0,
    ),
    'street': dict(
        frames=70,
        keys=[
            (0,  (-3.05, 4.60, 1.62), (-4.00, 4.75, 1.62)),
            (14, (-2.50, 4.00, 1.52), (-3.60, 5.70, 1.45)),
            (30, (-1.20, 3.00, 1.40), (-2.40, 7.50, 1.10)),
            (50, (-0.10, 4.00, 1.10), (-1.80, 9.20, 0.90)),
            (69, (0.25, 6.60, 1.05), (-2.20, 10.5, 0.85)),
        ],
        expo=[(0, 0.3), (20, 0.5), (69, 0.5)],
        lens=22.0,
    ),
}
P = PATHS[WHICH]
KEYS = P['keys']


def hermite(keys, t, idx):
    """Cubic Hermite through keys[i][idx] with Catmull-Rom tangents in units per frame, at rest at both ends."""
    ts = [k[0] for k in keys]
    vs = [Vector(k[idx]) for k in keys]
    n = len(keys)
    if t <= ts[0]:
        return vs[0].copy()
    if t >= ts[-1]:
        return vs[-1].copy()
    i = max(j for j in range(n - 1) if ts[j] <= t)

    def tan(j):
        if j == 0 or j == n - 1:
            return Vector((0, 0, 0))
        return (vs[j + 1] - vs[j - 1]) / (ts[j + 1] - ts[j - 1])
    dt = ts[i + 1] - ts[i]
    s = (t - ts[i]) / dt
    h00, h10, h01, h11 = 2 * s**3 - 3 * s**2 + 1, s**3 - 2 * s**2 + s, -2 * s**3 + 3 * s**2, s**3 - s**2
    return h00 * vs[i] + h10 * dt * tan(i) + h01 * vs[i + 1] + h11 * dt * tan(i + 1)


def piecewise(pts, t):
    if t <= pts[0][0]:
        return pts[0][1]
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t <= t1:
            s = (t - t0) / (t1 - t0)
            s = s * s * (3 - 2 * s)
            return v0 + (v1 - v0) * s
    return pts[-1][1]


def heading(t):
    d = hermite(KEYS, t, 2) - hermite(KEYS, t, 1)
    return math.atan2(d.y, d.x)


def pose(t):
    pos = hermite(KEYS, t, 1)
    tgt = hermite(KEYS, t, 2)
    q = (tgt - pos).to_track_quat('-Z', 'Y')
    # bank gently into turns, the way a drone does
    dh = heading(t + 1.5) - heading(t - 1.5)
    dh = (dh + math.pi) % (2 * math.pi) - math.pi
    roll = max(-0.06, min(0.06, -dh * 0.9))
    q = q @ Quaternion((0, 0, 1), roll)
    return pos, q


def frame_list(spec, n):
    if spec == 'all':
        return list(range(n))
    out = []
    for part in spec.split(','):
        if '-' in part:
            a, b = part.split('-')
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


if __name__ == '__main__':
    size, samples, out_dir, spec = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
    os.makedirs(out_dir, exist_ok=True)
    render_settings(size, size, samples=samples, threshold=float(os.environ.get('THRESH', '0.03')))
    sc = bpy.context.scene
    c = sc.cycles
    c.adaptive_min_samples = min(16, samples)
    c.max_bounces, c.diffuse_bounces, c.glossy_bounces, c.transmission_bounces = [int(x) for x in os.environ.get('BOUNCES', '8,4,4,8').split(',')]
    sc.render.use_persistent_data = True
    sc.render.image_settings.color_depth = '8'
    cd = bpy.data.cameras.new('drone')
    cd.lens = P['lens']
    cd.sensor_width = 36.0
    cd.sensor_fit = 'HORIZONTAL'
    cd.clip_start = 0.03
    cd.clip_end = 500
    cam = bpy.data.objects.new('drone', cd)
    sc.collection.objects.link(cam)
    cam.rotation_mode = 'QUATERNION'
    sc.camera = cam
    log = {}
    for f in frame_list(spec, P['frames']):
        out = os.path.join(out_dir, f'{f:04d}.png')
        if os.path.exists(out) and not os.environ.get('FORCE'):
            continue
        pos, q = pose(f)
        cam.location = pos
        cam.rotation_quaternion = q
        sc.view_settings.exposure = piecewise(P['expo'], f)
        sc.render.filepath = out
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        log[f] = round(time.time() - t0, 1)
        print(f'FRAME {f} {log[f]}s', flush=True)
    json.dump(log, open(os.path.join(out_dir, f'times_{spec.replace(",", "_")[:40]}.json'), 'w'))
