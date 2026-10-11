"""The drone flight: one continuous camera move from the back garden to the coffee shop across the road.

python fly.py <size> <samples> <out_dir> <frames>
  frames: "0-289", "0,40,80" or "all"
Renders square frames (size x size) so one render serves both the 16:9 and the 9:16 crop.
The patio slabs and the coffee shop floor are laid as the drone passes (see animate()).
"""
import sys, os, math, json, time, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import house as H
import street as ST
import bpy
from mathutils import Vector, Quaternion, Euler
from lib import render_settings

N = 290
# (frame, camera position, look-at point). Speed comes from the spacing of the frames.
KEYS = [
    (0,   (0.55, -9.4, 1.95), (0.20, 0.0, 1.05)),
    (24,  (0.75, -6.4, 1.62), (0.15, 1.2, 0.95)),
    (46,  (0.60, -3.2, 1.45), (0.25, 3.5, 1.12)),
    (62,  (0.50, -0.8, 1.38), (0.35, 4.5, 1.22)),
    (74,  (1.00, 1.10, 1.40), (-0.20, 5.6, 1.18)),
    (90,  (2.10, 2.70, 1.45), (-0.60, 6.0, 1.28)),
    (106, (2.50, 4.55, 1.40), (2.40, 7.6, 1.25)),
    (118, (2.56, 6.05, 1.38), (2.56, 9.0, 1.00)),
    (132, (2.56, 7.60, 1.42), (2.56, 10.6, 0.78)),
    (146, (2.56, 9.30, 1.45), (2.56, 12.4, 1.45)),
    (158, (2.50, 10.55, 1.50), (2.20, 13.0, 1.45)),
    (170, (2.55, 11.70, 1.62), (2.60, 14.5, 1.70)),
    (178, (2.56, 12.55, 1.72), (2.90, 16.0, 1.80)),
    (192, (3.20, 14.60, 2.30), (5.50, 20.0, 2.20)),
    (210, (5.70, 18.60, 2.70), (10.2, 25.0, 2.00)),
    (226, (9.70, 23.60, 2.20), (11.2, 30.0, 1.50)),
    (238, (11.15, 26.60, 1.62), (11.2, 32.0, 1.30)),
    (248, (11.20, 28.00, 1.50), (11.0, 33.0, 1.20)),
    (268, (11.15, 29.60, 1.42), (10.6, 33.5, 1.05)),
    (289, (11.05, 30.45, 1.38), (10.5, 33.6, 1.12)),
]
# exposure follows the camera like a drone's auto exposure
EXPO = [(0, -0.85), (56, -0.85), (74, -0.3), (104, -0.3), (122, 0.15), (140, 0.15), (152, 0.0), (168, 0.0), (184, -0.25), (232, -0.25), (248, 0.25), (289, 0.25)]
LENS = 22.0


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
    dh = heading(t + 1.5) - heading(t - 1.5)
    dh = (dh + math.pi) % (2 * math.pi) - math.pi
    roll = max(-0.06, min(0.06, -dh * 0.9))
    return pos, q @ Quaternion((0, 0, 1), roll)


# ------------------------------------------------------------------ the tiling, done as the drone passes
CAM_Y = [hermite(KEYS, f, 1).y for f in range(N)]


def frame_when_y(y):
    for f, cy in enumerate(CAM_Y):
        if cy >= y:
            return f
    return N


rr = random.Random(5)
PATIO = []
xs = [o.location.x for o in H.PATIO]
ys = sorted({round(o.location.y, 2) for o in H.PATIO}, reverse=True)      # rows, house side first
for o in H.PATIO:
    loc, rot = o.location.copy(), o.rotation_euler.copy()
    row = ys.index(round(loc.y, 2))
    land = 12.0 + row * 2.6 + 3.0 * (loc.x - min(xs)) / (max(xs) - min(xs)) + rr.uniform(-0.5, 0.5)
    PATIO.append(dict(o=o, loc=loc, rot=rot, land=land, dur=13.0, h=0.75, tilt=(rr.uniform(-0.12, 0.12), rr.uniform(-0.12, 0.12), rr.uniform(-0.08, 0.08))))
DOOR = Vector((11.2, ST.OF + 0.15, 0))
CAFE = []
for o in ST.CAFE_TILES:
    loc, rot = o.location.copy(), o.rotation_euler.copy()
    d = (Vector((loc.x, loc.y, 0)) - DOOR).length
    CAFE.append(dict(o=o, loc=loc, rot=rot, land=246.0 + d / 0.13 + rr.uniform(-0.6, 0.6), dur=11.0, h=0.6,
                     tilt=(rr.uniform(-0.14, 0.14), rr.uniform(-0.14, 0.14), rr.uniform(-0.1, 0.1))))


def with_object_alpha(mat):
    """Let a material fade with the object's colour alpha, so a tile can arrive without popping into view."""
    nt = mat.node_tree
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    src = out.inputs['Surface'].links[0].from_socket
    oi = nt.nodes.new('ShaderNodeObjectInfo')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(oi.outputs['Alpha'], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(src, mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])


for mat in {H.M['stone'], ST.S['wmarble'], ST.S['bmarble']}:
    with_object_alpha(mat)


def place(t, f):
    s = (f - (t['land'] - t['dur'])) / t['dur']
    o = t['o']
    if s <= 0:
        o.location = t['loc'] - Vector((0, 0, 3.0))       # not laid yet, out of sight below the ground
        o.rotation_euler = t['rot']
        o.color = (1, 1, 1, 0)
        return
    if s >= 1:
        o.location = t['loc']
        o.rotation_euler = t['rot']
        o.color = (1, 1, 1, 1)
        return
    k = (1 - s) ** 2.2                                    # lowered quickly, then eased onto the bed
    o.location = t['loc'] + Vector((0, 0, t['h'] * k))
    a, b, c = t['tilt']
    o.rotation_euler = Euler((t['rot'].x + a * k, t['rot'].y + b * k, t['rot'].z + c * k))
    u = min(1.0, s / 0.45)
    o.color = (1, 1, 1, u * u * (3 - 2 * u))


def animate(f):
    for t in PATIO:
        place(t, f)
    for t in CAFE:
        place(t, f)
    # the garden is behind the camera once it is in the hallway
    bpy.data.collections['garden'].hide_render = f >= 126


def frame_list(spec):
    if spec == 'all':
        return list(range(N))
    out = []
    for part in spec.split(','):
        if '-' in part:
            a, b = part.split('-')
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


if __name__ == '__main__':
    size, samples, out_dir, spec = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4]
    os.makedirs(out_dir, exist_ok=True)
    render_settings(size, size, samples=samples, threshold=float(os.environ.get('THRESH', '0.03')))
    sc = bpy.context.scene
    c = sc.cycles
    c.adaptive_min_samples = min(16, samples)
    c.max_bounces, c.diffuse_bounces, c.glossy_bounces, c.transmission_bounces = [int(x) for x in os.environ.get('BOUNCES', '6,3,3,6').split(',')]
    sc.render.use_persistent_data = True
    sc.render.image_settings.color_depth = '8'
    cd = bpy.data.cameras.new('drone')
    cd.lens = LENS
    cd.sensor_width = 36.0
    cd.sensor_fit = 'HORIZONTAL'
    cd.clip_start = 0.03
    cd.clip_end = 500
    cam = bpy.data.objects.new('drone', cd)
    sc.collection.objects.link(cam)
    cam.rotation_mode = 'QUATERNION'
    sc.camera = cam
    log = {}
    for f in frame_list(spec):
        out = os.path.join(out_dir, f'{f:04d}.png')
        if os.path.exists(out) and not os.environ.get('FORCE'):
            continue
        pos, q = pose(f)
        cam.location = pos
        cam.rotation_quaternion = q
        animate(f)
        sc.view_settings.exposure = piecewise(EXPO, f)
        sc.render.filepath = out
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        log[f] = round(time.time() - t0, 1)
        print(f'FRAME {f} {log[f]}s', flush=True)
    json.dump(log, open(os.path.join(out_dir, f'times_{spec.replace(",", "_")[:40]}.json'), 'w'))
