"""Cowey Tiling: one house, garden to shower room.

Usage: python house.py <camera> <width> <height> <samples> <out.png>
Cameras: garden, kitchen, bath (plus *_p portrait variants).
"""
import sys, os, math, random, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view
from lib import *

SUN_ELEV, SUN_ROT = 15.0, 146.6
FFL = 0.15            # finished floor level, patio and kitchen are level
ROOF = 2.95           # extension parapet top
RNG = random.Random(7)

sc = reset()
sky_world(SUN_ELEV, SUN_ROT, strength=0.26)
add_sun(SUN_ELEV, SUN_ROT, strength=7.5, color=(1.0, 0.62, 0.37), angle_deg=0.55)

# ------------------------------------------------------------------ materials
M = dict(
    stone=m_porcelain2('patio_porcelain', tone=(0.37, 0.355, 0.33), rough=0.62),
    stone_in=m_porcelain2('floor_porcelain', tone=(0.41, 0.395, 0.37), rough=0.3, honed=True),
    joint=m_jointing('jointing', (0.055, 0.053, 0.05)),
    brick=m_brick2('brick', 'XZ'),
    brick_y=m_brick2('brick_y', 'YZ'),
    plaster=m_plaster('plaster', (0.80, 0.765, 0.70)),
    ceiling=m_plaster('ceiling', (0.84, 0.82, 0.78), bump=0.02),
    alu=m_powder('anthracite'),
    glass=m_glass('glass'),
    black=m_paint('matt_black', (0.018, 0.018, 0.018), 0.5),
    cedar=m_oak('cedar', tone=(0.30, 0.15, 0.075), rough=0.7, along='X', oiled=False),
    cedar_v=m_oak('cedar_v', tone=(0.27, 0.14, 0.07), rough=0.72, along='Z', oiled=False),
    teak=m_oak('teak', tone=(0.33, 0.19, 0.09), rough=0.55, along='X'),
    oak=m_oak('oak', tone=(0.38, 0.24, 0.12), rough=0.5, along='X'),
    soil=m_soil(),
    grass=m_grass2('lawn', dry=0.2),
    fabric=m_fabric('outdoor_fabric', (0.46, 0.42, 0.36)),
    fabric_rust=m_fabric('cushion_rust', (0.30, 0.10, 0.045)),
    fabric_olive=m_fabric('cushion_olive', (0.13, 0.14, 0.065)),
    lav_stem=m_paint('lavender_stem', (0.09, 0.12, 0.07), 0.7),
    lav_flower=m_fabric('lavender_flower', (0.14, 0.085, 0.30), sheen=0.3, rough=0.8),
    wax=m_ceramic('wax', (0.82, 0.78, 0.68), rough=0.5, speckle=False),
    stipa=m_grass_blade('stipa', dry=0.75),
    fibreclay=m_paint('fibreclay', (0.11, 0.105, 0.10), 0.75),
    coping=m_porcelain2('coping', tone=(0.42, 0.40, 0.37), rough=0.66),
    cabinet=m_paint('cabinet_green', (0.030, 0.050, 0.040), 0.38),
    marble=m_marble('worktop_marble'),
    zellige=m_zellige('zellige'),
    grout=m_plaster('grout', (0.36, 0.35, 0.32), rough=0.95),
    brass=m_metal('brass', (0.80, 0.55, 0.26), 0.22),
    steel=m_metal('steel', (0.75, 0.75, 0.74), 0.18),
    ceramic=m_ceramic('ceramic'),
    terracotta=m_ceramic('terracotta', (0.38, 0.15, 0.07), rough=0.8, speckle=False),
    lemon=m_lemon(),
    nero=m_marble('calacatta_porcelain', base=(0.80, 0.79, 0.765), vein=(0.50, 0.48, 0.45), rough=0.1, coat=0.45, scale=0.65, calm=True),
    bath_floor=m_porcelain_stone('bath_floor', tone=(0.16, 0.155, 0.148), rough=0.5, bump=0.15),
    slate=m_slate('slate_roof'),
    white_frame=m_paint('white_frame', (0.80, 0.80, 0.78), 0.4),
    bulb=m_emission('bulb', (1.0, 0.72, 0.42), 30.0),
    led=m_emission('led_strip', (1.0, 0.78, 0.52), 18.0),
    downlight=m_emission('downlight', (1.0, 0.86, 0.70), 40.0),
)

# porcelain for bathroom walls gets per-tile vein positions through object random offsets
GARDEN = collection('garden')
HOUSE = collection('house')
KITCHEN = collection('kitchen')
BATH = collection('bath')
SRC = collection('sources')
bpy.context.view_layer.layer_collection.children['sources'].exclude = True


# ------------------------------------------------------------------ helpers

def tile_floor(name, x0, x1, y0, y1, sx, sy, joint, top, mat, coll, offset_frac=1 / 3, lippage=0.0004, origin=(0.0, 0.0), thick=0.02):
    """Lay rectangular tiles (sx along X, sy along Y) in a running bond, cutting at the edges."""
    out = []
    r0 = math.floor((y0 - origin[1]) / sy)
    r1 = math.ceil((y1 - origin[1]) / sy)
    for r in range(r0, r1):
        ya, yb = origin[1] + r * sy, origin[1] + (r + 1) * sy
        ya2, yb2 = max(ya, y0), min(yb, y1)
        if yb2 - ya2 < 0.03:
            continue
        off = ((r % 3) * offset_frac * sx) % sx
        c0 = math.floor((x0 - origin[0] + off) / sx) - 1
        c1 = math.ceil((x1 - origin[0] + off) / sx) + 1
        for c in range(c0, c1):
            xa, xb = origin[0] - off + c * sx, origin[0] - off + (c + 1) * sx
            xa2, xb2 = max(xa, x0), min(xb, x1)
            if xb2 - xa2 < 0.03:
                continue
            w, d = xb2 - xa2 - joint, yb2 - ya2 - joint
            me = bevel_box_mesh(round(w, 4), round(d, 4), thick, bevel=0.0016, segments=2, name=f'{name}_m', key=(name, round(w, 4), round(d, 4)))
            if not me.materials:
                me.materials.append(mat)
            z = top - thick / 2 + RNG.uniform(-lippage, lippage)
            o = instance(f'{name}_{r}_{c}', me, ((xa2 + xb2) / 2, (ya2 + yb2) / 2, z),
                         rot=(RNG.uniform(-0.0006, 0.0006), RNG.uniform(-0.0006, 0.0006), 0), coll=coll)
            out.append(o)
    return out


def disc(name, r, loc, mat, coll, segs=32):
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=segs, radius=r)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return mesh_obj(name, me, mat, loc=loc, coll=coll)


def empty(name, loc, rot=(0, 0, 0), coll=None):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    e.rotation_euler = Euler(rot)
    return link(e, coll)


def child(o, parent):
    o.parent = parent
    return o


# ------------------------------------------------------------------ vegetation

def blade_mesh(name, h, w, bend, segs=5, lean=(0, 0)):
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new('UVMap')
    rows = []
    for i in range(segs + 1):
        t = i / segs
        width = w * (1 - t) ** 0.7 + 0.0002
        z = h * t
        off = bend * t * t
        cx, cy = lean[0] * off, lean[1] * off
        rows.append((bm.verts.new((cx - width / 2, cy, z)), bm.verts.new((cx + width / 2, cy, z)), t))
    for i in range(segs):
        a0, b0, t0 = rows[i]
        a1, b1, t1 = rows[i + 1]
        f = bm.faces.new((a0, b0, b1, a1))
        for loop, uv in zip(f.loops, ((0, t0), (1, t0), (1, t1), (0, t1))):
            loop[uv_layer].uv = uv
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def clump(name, n, hmin, hmax, wmin, wmax, spread, bend, mat, seed):
    rr = random.Random(seed)
    bm_all = bmesh.new()
    uvl = bm_all.loops.layers.uv.new('UVMap')
    for k in range(n):
        h = rr.uniform(hmin, hmax)
        w = rr.uniform(wmin, wmax)
        a = rr.uniform(0, 2 * math.pi)
        lean = (math.cos(a), math.sin(a))
        me = blade_mesh('_b', h, w, bend * rr.uniform(0.5, 1.3) * h, lean=lean)
        tmp = bmesh.new()
        tmp.from_mesh(me)
        rot = Euler((rr.uniform(-0.15, 0.15), rr.uniform(-0.15, 0.15), rr.uniform(0, 6.28))).to_matrix().to_4x4()
        r_ = spread * math.sqrt(rr.random())
        th = rr.uniform(0, 6.28)
        mat_ = Matrix_translation((r_ * math.cos(th), r_ * math.sin(th), 0)) @ rot
        bmesh.ops.transform(tmp, matrix=mat_, verts=tmp.verts)
        tmp_me = bpy.data.meshes.new('_t')
        tmp.to_mesh(tmp_me)
        tmp.free()
        bm_all.from_mesh(tmp_me)
        bpy.data.meshes.remove(tmp_me)
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    bm_all.to_mesh(me)
    bm_all.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    return me


def Matrix_translation(v):
    from mathutils import Matrix
    return Matrix.Translation(v)


def sk(node, ident):
    for x in node.inputs:
        if x.identifier == ident:
            return x
    raise KeyError(ident)


def scatter(name, target, src_coll, density, seed, scale=(0.7, 1.3), coll=None, tilt=0.12):
    """Geometry-nodes scatter of instances from src_coll across target's faces."""
    ng = bpy.data.node_groups.new(name, 'GeometryNodeTree')
    ng.interface.new_socket(name='Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket(name='Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes
    L = ng.links.new
    gi = N.new('NodeGroupInput')
    go = N.new('NodeGroupOutput')
    dist = N.new('GeometryNodeDistributePointsOnFaces')
    dist.distribute_method = 'RANDOM'
    dist.inputs['Density'].default_value = density
    dist.inputs['Seed'].default_value = seed
    ci = N.new('GeometryNodeCollectionInfo')
    ci.inputs['Collection'].default_value = src_coll
    ci.inputs['Separate Children'].default_value = True
    ci.inputs['Reset Children'].default_value = True
    inst = N.new('GeometryNodeInstanceOnPoints')
    inst.inputs['Pick Instance'].default_value = True
    rv_rot = N.new('FunctionNodeRandomValue')
    rv_rot.data_type = 'FLOAT_VECTOR'
    rv_rot.inputs['Min'].default_value = (-tilt, -tilt, 0)
    rv_rot.inputs['Max'].default_value = (tilt, tilt, 6.283)
    rv_rot.inputs['Seed'].default_value = seed + 1
    rv_sc = N.new('FunctionNodeRandomValue')
    rv_sc.data_type = 'FLOAT'
    sk(rv_sc, 'Min_001').default_value = scale[0]
    sk(rv_sc, 'Max_001').default_value = scale[1]
    rv_sc.inputs['Seed'].default_value = seed + 2
    rv_idx = N.new('FunctionNodeRandomValue')
    rv_idx.data_type = 'INT'
    sk(rv_idx, 'Min_002').default_value = 0
    sk(rv_idx, 'Max_002').default_value = 100
    rv_idx.inputs['Seed'].default_value = seed + 3
    join = N.new('GeometryNodeJoinGeometry')
    L(gi.outputs['Geometry'], dist.inputs['Mesh'])
    L(dist.outputs['Points'], inst.inputs['Points'])
    L(ci.outputs['Instances'], inst.inputs['Instance'])
    L(rv_idx.outputs[2], inst.inputs['Instance Index'])
    L(rv_rot.outputs[0], inst.inputs['Rotation'])
    L(rv_sc.outputs[1], inst.inputs['Scale'])
    L(gi.outputs['Geometry'], join.inputs['Geometry'])
    L(inst.outputs['Instances'], join.inputs['Geometry'])
    L(join.outputs['Geometry'], go.inputs['Geometry'])
    mod = target.modifiers.new(name, 'NODES')
    mod.node_group = ng
    return mod


def make_clumps(prefix, count, **kw):
    c = bpy.data.collections.new(prefix)
    SRC.children.link(c)
    for i in range(count):
        me = clump(f'{prefix}{i}', seed=sum(map(ord, prefix)) * 31 + i, **kw)
        o = bpy.data.objects.new(f'{prefix}{i}', me)
        c.objects.link(o)
    return c


# =============================================================== GARDEN
PX0, PX1, PY0, PY1 = -3.72, 4.3, -4.2, 0.0
tile_floor('patio', PX0, PX1, PY0, PY1, 0.9, 0.6, 0.005, FFL, M['stone'], GARDEN)
box('patio_bed', (PX1 - PX0, PY1 - PY0, FFL - 0.006), ((PX0 + PX1) / 2, (PY0 + PY1) / 2, (FFL - 0.006) / 2), M['joint'], coll=GARDEN)
# porcelain riser along the patio edge where it steps down to the lawn
x = PX0
while x < PX1 - 0.01:
    w = min(0.9, PX1 - x)
    box(f'riser_{x:.2f}', (w - 0.005, 0.02, FFL - 0.004), (x + w / 2, PY0 - 0.01, (FFL - 0.004) / 2), M['stone'], bevel=0.0015, coll=GARDEN)
    x += 0.9

# lawn
LX0, LX1, LY0, LY1 = -3.72, 4.33, -14.2, PY0 - 0.02
lawn = plane('lawn', LX1 - LX0, LY1 - LY0, ((LX0 + LX1) / 2, (LY0 + LY1) / 2, 0.0), M['soil'], coll=GARDEN, subdiv=40)
ground = plane('ground_far', 300, 300, (0, -40, -0.01), M['soil'], coll=GARDEN)
lawn_clumps = make_clumps('lawnclump', 8, n=30, hmin=0.05, hmax=0.12, wmin=0.0024, wmax=0.0042, spread=0.03, bend=0.7, mat=M['grass'])
scatter('lawn_scatter', lawn, lawn_clumps, density=1500, seed=3, scale=(0.7, 1.4))

# left boundary: horizontal slatted cedar fence
FX = -4.32
for k in range(9):
    y = 0.0 - k * 1.8
    box(f'post_{k}', (0.09, 0.09, 1.86), (FX - 0.05, y, 0.93), M['cedar_v'], bevel=0.003, coll=GARDEN)
z = 0.06
while z < 1.8:
    box(f'slat_{z:.2f}', (0.022, 14.6, 0.145), (FX, -7.2, z + 0.0725), M['cedar'], bevel=0.002, coll=GARDEN)
    z += 0.16
# raised sleeper bed along the fence: lavender and grasses
box('sleeper_front', (0.1, 9.6, 0.45), (-3.77, -4.8, 0.225), M['teak'], bevel=0.005, coll=GARDEN)
box('sleeper_cap', (0.14, 9.6, 0.04), (-3.77, -4.8, 0.47), M['teak'], bevel=0.006, coll=GARDEN)
bed_soil = plane('bed_soil', 0.48, 9.6, (-4.06, -4.8, 0.42), M['soil'], coll=GARDEN, subdiv=12)


def lavender_mesh(name, seed):
    rr = random.Random(seed)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    for k in range(70):
        th = rr.uniform(0, 6.283)
        r0 = 0.11 * math.sqrt(rr.random())
        lean = rr.uniform(0.05, 0.42)
        L = rr.uniform(0.34, 0.56)
        d = Vector((math.cos(th) * math.sin(lean), math.sin(th) * math.sin(lean), math.cos(lean)))
        base = Vector((r0 * math.cos(th), r0 * math.sin(th), 0))
        side = d.cross(Vector((0, 0, 1)))
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        wv = 0.0013
        segs = 4
        prev = None
        for i in range(segs + 1):
            t = i / segs
            c = base + d * (L * t)
            a_ = bm.verts.new(c - side * wv)
            b_ = bm.verts.new(c + side * wv)
            if prev:
                f = bm.faces.new((prev[0], prev[1], b_, a_))
                f.material_index = 0
                for lp, uv in zip(f.loops, ((0, prev[2]), (1, prev[2]), (1, t), (0, t))):
                    lp[uvl].uv = uv
            prev = (a_, b_, t)
        tip = base + d * L
        res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        q = d.to_track_quat('Z', 'Y')
        for v in res['verts']:
            co = v.co.copy()
            co.x *= 0.0085
            co.y *= 0.0085
            co.z *= 0.042
            v.co = q @ co + tip + d * 0.03
        for f in {f for v in res['verts'] for f in v.link_faces}:
            f.material_index = 1
            f.smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(M['lav_stem'])
    me.materials.append(M['lav_flower'])
    return me


lav = bpy.data.collections.new('lavender')
SRC.children.link(lav)
for i in range(4):
    o = bpy.data.objects.new(f'lav{i}', lavender_mesh(f'lav{i}', 300 + i))
    lav.objects.link(o)
scatter('lav_scatter', bed_soil, lav, density=4.2, seed=12, scale=(0.85, 1.2), tilt=0.06)
stipa = make_clumps('stipa', 4, n=110, hmin=0.45, hmax=0.9, wmin=0.0028, wmax=0.0045, spread=0.12, bend=0.6, mat=M['stipa'])

# right boundary: stock brick garden wall with a coping
box('gwall', (0.23, 14.5, 0.9), (4.45, -7.25, 0.45), M['brick_y'], coll=GARDEN)
box('gwall_cope', (0.3, 14.5, 0.05), (4.45, -7.25, 0.925), M['coping'], bevel=0.003, coll=GARDEN)
# slatted cedar screen on top of the low wall: sun falls through it in stripes
for k in range(9):
    box(f'spost_{k}', (0.07, 0.07, 0.95), (4.45, -k * 1.8, 1.42), M['cedar_v'], bevel=0.003, coll=GARDEN)
z = 0.97
while z < 1.85:
    box(f'sslat_{z:.2f}', (0.02, 14.5, 0.07), (4.42, -7.25, z + 0.035), M['cedar'], bevel=0.002, coll=GARDEN)
    z += 0.105

# planters either side of the doors with grasses
for i, (px, py) in enumerate([(-2.95, -0.55), (3.55, -0.6)]):
    lathe(f'planter_{i}', [(0.0, 0.0), (0.24, 0.0), (0.30, 0.62), (0.31, 0.63), (0.31, 0.65), (0.285, 0.65), (0.27, 0.6), (0.0, 0.6)],
          M['fibreclay'], loc=(px, py, FFL), coll=GARDEN)
    top = disc(f'planter_soil_{i}', 0.27, (px, py, FFL + 0.58), M['soil'], GARDEN)
    scatter(f'pl_scatter_{i}', top, stipa, density=30.0, seed=20 + i, scale=(0.9, 1.25), tilt=0.1)

# outdoor lounge: teak sofa with deep cushions, coffee table, lantern
SX, SY = -3.12, -2.45
fab = M['fabric']
for (lx, ly) in [(-0.36, -1.08), (0.36, -1.08), (-0.36, 1.08), (0.36, 1.08)]:
    box(f'sofa_foot_{lx}_{ly}', (0.07, 0.07, 0.06), (SX + lx, SY + ly, FFL + 0.03), M['teak'], bevel=0.005, coll=GARDEN)
box('sofa_base', (0.86, 2.3, 0.22), (SX, SY, FFL + 0.06 + 0.11), M['teak'], bevel=0.012, segments=3, coll=GARDEN)
for s_ in (-1, 1):
    box(f'sofa_arm_{s_}', (0.86, 0.12, 0.40), (SX, SY + s_ * 1.21, FFL + 0.06 + 0.2), M['teak'], bevel=0.014, segments=3, coll=GARDEN)
for k in range(3):
    yy = SY - 0.74 + k * 0.74
    box(f'seat_cushion_{k}', (0.74, 0.73, 0.15), (SX + 0.05, yy, FFL + 0.28 + 0.075), fab, bevel=0.05, segments=6, coll=GARDEN)
    box(f'back_cushion_{k}', (0.2, 0.73, 0.5), (SX - 0.3, yy, FFL + 0.62), fab, rot=(0, -0.16, RNG.uniform(-0.02, 0.02)), bevel=0.06, segments=6, coll=GARDEN)
box('scatter_cushion_a', (0.13, 0.45, 0.45), (SX - 0.13, SY - 0.86, FFL + 0.62), M['fabric_rust'], rot=(0.15, -0.32, 0.28), bevel=0.05, segments=6, coll=GARDEN)
box('scatter_cushion_b', (0.13, 0.42, 0.42), (SX - 0.14, SY + 0.9, FFL + 0.6), M['fabric_olive'], rot=(-0.1, -0.3, -0.22), bevel=0.05, segments=6, coll=GARDEN)
CTX, CTY = SX + 1.2, SY
for k in range(5):
    box(f'ct_slat{k}', (0.11, 1.1, 0.03), (CTX - 0.25 + k * 0.125, CTY, FFL + 0.385), M['teak'], bevel=0.004, coll=GARDEN)
for (lx, ly) in [(-0.27, -0.5), (0.27, -0.5), (-0.27, 0.5), (0.27, 0.5)]:
    box(f'ct_leg_{lx}_{ly}', (0.05, 0.05, 0.37), (CTX + lx, CTY + ly, FFL + 0.185), M['teak'], bevel=0.005, coll=GARDEN)
# lantern with a lit candle
LNX, LNY, LZ = CTX + 0.05, CTY - 0.25, FFL + 0.4
for (bx, by) in [(-0.08, -0.08), (0.08, -0.08), (-0.08, 0.08), (0.08, 0.08)]:
    box(f'lan_bar_{bx}_{by}', (0.012, 0.012, 0.3), (LNX + bx, LNY + by, LZ + 0.15), M['black'], coll=GARDEN)
box('lan_base', (0.18, 0.18, 0.02), (LNX, LNY, LZ + 0.01), M['black'], bevel=0.003, coll=GARDEN)
box('lan_top', (0.19, 0.19, 0.03), (LNX, LNY, LZ + 0.31), M['black'], bevel=0.004, coll=GARDEN)
for (gx, gy, sx_, sy_) in [(0, -0.081, 0.15, 0.004), (0, 0.081, 0.15, 0.004), (-0.081, 0, 0.004, 0.15), (0.081, 0, 0.004, 0.15)]:
    box(f'lan_glass_{gx}_{gy}', (sx_, sy_, 0.27), (LNX + gx, LNY + gy, LZ + 0.155), M['glass'], coll=GARDEN)
cylinder('candle', 0.035, 0.1, (LNX, LNY, LZ + 0.07), M['wax'], coll=GARDEN)
sphere('flame', 0.006, (LNX, LNY, LZ + 0.132), m_emission('flame', (1.0, 0.55, 0.2), 60.0), coll=GARDEN, scale=(1, 1, 2.2))
add_light('POINT', (LNX, LNY, LZ + 0.135), 0.8, (1, 0.6, 0.3), size=0.008, name='candle_light')
lathe('jug', [(0, 0), (0.06, 0), (0.075, 0.05), (0.07, 0.15), (0.05, 0.21), (0.055, 0.24), (0.05, 0.245), (0.045, 0.21), (0.0, 0.21)],
      M['ceramic'], loc=(CTX - 0.12, CTY + 0.22, FFL + 0.4), coll=GARDEN)
TUMB = m_glass('tumbler', tint=(0.98, 0.98, 0.98))
for k, (gx, gy) in enumerate([(CTX + 0.1, CTY + 0.3), (CTX + 0.16, CTY + 0.12)]):
    lathe(f'tumbler{k}', [(0, 0), (0.035, 0), (0.04, 0.1), (0.037, 0.1), (0.032, 0.006), (0.0, 0.006)], TUMB, loc=(gx, gy, FFL + 0.4), coll=GARDEN)
lathe('bowl_out', [(0, 0), (0.05, 0), (0.12, 0.045), (0.14, 0.07), (0.135, 0.072), (0.115, 0.05), (0.0, 0.01)],
      M['terracotta'], loc=(CTX - 0.05, CTY - 0.02 + 0.3, FFL + 0.4), coll=GARDEN)


# =============================================================== EXTENSION
WALL_T = 0.35
EX0, EX1 = -3.3, 3.3        # interior width
OX0, OX1 = -2.3, 2.3        # bifold opening
OPEN_TOP = 2.45
# facade, brick, with the bifold opening
wall_with_holes('facade', EX0 - WALL_T, EX1 + WALL_T, 0.0, ROOF - 0.05, WALL_T, [(OX0, OX1, FFL, OPEN_TOP)], M['brick'], y=0.0, coll=HOUSE)
# steel lintel and parapet coping
box('lintel', (OX1 - OX0 + 0.3, 0.012, 0.22), (0, -0.006, OPEN_TOP + 0.11), M['alu'], coll=HOUSE)
box('parapet_cope', (EX1 - EX0 + 2 * WALL_T + 0.08, WALL_T + 0.1, 0.06), (0, WALL_T / 2 - 0.02, ROOF - 0.02), M['alu'], bevel=0.004, coll=HOUSE)
# side walls of the extension (brick outside, plaster inside)
for sx in (-1, 1):
    box(f'ext_side_{sx}', (WALL_T, 6.2, ROOF - 0.05), (sx * (EX1 + WALL_T / 2), 3.1 + WALL_T / 2, (ROOF - 0.05) / 2), M['brick_y'], coll=HOUSE)
# roof slab with a rooflight opening over the island
RL = (-1.25, 1.25, 2.4, 3.6)
for (a0, a1, b0, b1) in [(EX0, EX1, WALL_T, RL[2]), (EX0, EX1, RL[3], 6.2), (EX0, RL[0], RL[2], RL[3]), (RL[1], EX1, RL[2], RL[3])]:
    box(f'roof_{a0}_{b0}', (a1 - a0, b1 - b0, 0.2), ((a0 + a1) / 2, (b0 + b1) / 2, 2.85), M['ceiling'], coll=HOUSE)
box('rooflight_glass', (RL[1] - RL[0], RL[3] - RL[2], 0.012), ((RL[0] + RL[1]) / 2, (RL[2] + RL[3]) / 2, 3.075), M['glass'], coll=HOUSE)
# downpipe at the right corner
tube('downpipe', [(EX1 + WALL_T + 0.06, -0.06, 0.05), (EX1 + WALL_T + 0.06, -0.06, 1.0), (EX1 + WALL_T + 0.06, -0.06, 2.0), (EX1 + WALL_T + 0.06, -0.06, 2.85)], 0.034, M['alu'], coll=HOUSE)
box('hopper', (0.16, 0.14, 0.14), (EX1 + WALL_T + 0.06, -0.06, 2.82), M['alu'], bevel=0.004, coll=HOUSE)
# wall lights either side of the doors
for i, wx in enumerate((-2.95, 2.95)):
    cylinder(f'wall_light_{i}', 0.04, 0.2, (wx, -0.06, 2.05), M['black'], coll=HOUSE)
    cylinder(f'wall_light_glow_{i}', 0.03, 0.004, (wx, -0.06, 1.948), M['bulb'], coll=HOUSE)
    add_light('SPOT', (wx, -0.06, 1.94), 6.0, (1, 0.75, 0.48), size=0.02, rot=(0, 0, 0), spot=55, blend=0.8, name=f'wl_down_{i}')
# bifold frame and the folded door stack (outward opening, stacked at the right jamb)
for (sx_, sz_, x_, z_) in [((OX1 - OX0), 0.07, 0, OPEN_TOP - 0.035), ((OX1 - OX0), 0.02, 0, FFL + 0.01), (0.07, OPEN_TOP - FFL, OX0 + 0.035, (OPEN_TOP + FFL) / 2), (0.07, OPEN_TOP - FFL, OX1 - 0.035, (OPEN_TOP + FFL) / 2)]:
    box(f'bf_frame_{x_}_{z_}', (sx_, 0.07, sz_), (x_, 0.06, z_), M['alu'], bevel=0.003, coll=HOUSE)
PW = (OX1 - OX0 - 0.14) / 6
ph = OPEN_TOP - FFL - 0.1
for k in range(6):
    ang = math.pi / 2 + (0.11 if k % 2 == 0 else -0.11)
    e = empty(f'panel_{k}', (OX1 - 0.09 - k * 0.072, -0.02, FFL + 0.03), (0, 0, ang), HOUSE)
    # frame (as four bars) and glass, panel spans local -X from the hinge line
    child(box(f'pf_t{k}', (PW, 0.06, 0.06), (-PW / 2, 0, ph - 0.03), M['alu'], bevel=0.003, coll=HOUSE), e)
    child(box(f'pf_b{k}', (PW, 0.06, 0.1), (-PW / 2, 0, 0.05), M['alu'], bevel=0.003, coll=HOUSE), e)
    child(box(f'pf_l{k}', (0.06, 0.06, ph), (-0.03, 0, ph / 2), M['alu'], bevel=0.003, coll=HOUSE), e)
    child(box(f'pf_r{k}', (0.06, 0.06, ph), (-PW + 0.03, 0, ph / 2), M['alu'], bevel=0.003, coll=HOUSE), e)
    child(box(f'pg{k}', (PW - 0.1, 0.024, ph - 0.15), (-PW / 2, 0, ph / 2 + 0.02), M['glass'], coll=HOUSE), e)
    child(box(f'ph{k}', (0.02, 0.03, 0.22), (-PW + 0.07, 0.04, 1.0), M['black'], bevel=0.003, coll=HOUSE), e)

# main house beyond the extension: brick rear wall, sash windows, slate roof, chimney
MY = 6.2 + 0.25
wall_with_holes('main_rear', -4.6, 4.6, 0.0, 6.3, 0.3, [(-2.8, -1.6, 3.5, 4.95), (1.4, 2.6, 3.5, 4.95), (-3.65, 3.65, 0.0, 2.95)], M['brick'], y=MY - 0.3, coll=HOUSE)
for i, (a0, a1) in enumerate([(-2.8, -1.6), (1.4, 2.6)]):
    cx = (a0 + a1) / 2
    for (sx_, sz_, x_, z_) in [((a1 - a0), 0.06, cx, 4.92), ((a1 - a0), 0.08, cx, 3.53), (0.06, 1.45, a0 + 0.03, 4.225), (0.06, 1.45, a1 - 0.03, 4.225), ((a1 - a0), 0.05, cx, 4.24)]:
        box(f'sash_{i}_{x_}_{z_}', (sx_, 0.06, sz_), (x_, MY - 0.25, z_), M['white_frame'], bevel=0.003, coll=HOUSE)
    box(f'win_glass_{i}', (a1 - a0 - 0.1, 0.01, 1.35), (cx, MY - 0.24, 4.225), M['glass'], coll=HOUSE)
    box(f'win_dark_{i}', (a1 - a0, 0.02, 1.45), (cx, MY - 0.02, 4.225), m_paint(f'room_dark_{i}', (0.03, 0.028, 0.025), 0.9), coll=HOUSE)
    box(f'sill_{i}', (a1 - a0 + 0.12, 0.12, 0.06), (cx, MY - 0.33, 3.47), M['coping'], bevel=0.003, coll=HOUSE)
    box(f'lintel_{i}', (a1 - a0 + 0.1, 0.02, 0.075), (cx, MY - 0.31, 5.0), M['coping'], coll=HOUSE)
# roof: two pitches, ridge along X
roof_w, eave_z, ridge_z, ridge_y = 9.6, 6.3, 8.9, MY + 3.0
for side in (-1, 1):
    yy0 = MY - 0.35 if side < 0 else ridge_y + 3.35
    me = bpy.data.meshes.new('roofpl')
    bm = bmesh.new()
    vs = [bm.verts.new((-roof_w / 2, yy0, eave_z)), bm.verts.new((roof_w / 2, yy0, eave_z)),
          bm.verts.new((roof_w / 2, ridge_y, ridge_z)), bm.verts.new((-roof_w / 2, ridge_y, ridge_z))]
    bm.faces.new(vs)
    bm.to_mesh(me)
    bm.free()
    box_uv(me)
    o = mesh_obj(f'roof_{side}', me, M['slate'], coll=HOUSE)
    o.modifiers.new('sol', 'SOLIDIFY').thickness = 0.06
box('fascia', (roof_w, 0.03, 0.22), (0, MY - 0.36, eave_z - 0.08), M['white_frame'], coll=HOUSE)
tube('gutter', [(-roof_w / 2, MY - 0.42, eave_z - 0.08), (0, MY - 0.42, eave_z - 0.08), (roof_w / 2, MY - 0.42, eave_z - 0.08)], 0.055, M['alu'], coll=HOUSE)
box('chimney', (0.8, 0.6, 2.0), (-3.4, ridge_y, ridge_z + 0.4), M['brick'], coll=HOUSE)
for k in range(2):
    cylinder(f'pot{k}', 0.11, 0.38, (-3.6 + k * 0.4, ridge_y, ridge_z + 1.59), M['terracotta'], coll=HOUSE)

# =============================================================== KITCHEN
FAR = 6.2   # face of the old rear wall inside the kitchen
tile_floor('kfloor', EX0, EX1, WALL_T, FAR, 0.9, 0.6, 0.002, FFL, M['stone_in'], KITCHEN, lippage=0.0002)
box('kfloor_bed', (EX1 - EX0, FAR - WALL_T, 0.1), (0, (WALL_T + FAR) / 2, FFL - 0.06), M['grout'], coll=KITCHEN)
# interior wall linings
box('k_left', (0.02, FAR - WALL_T, 2.75 - FFL), (EX0 + 0.01, (WALL_T + FAR) / 2, (2.75 + FFL) / 2), M['plaster'], coll=KITCHEN)
box('k_right', (0.02, FAR - WALL_T, 2.75 - FFL), (EX1 - 0.01, (WALL_T + FAR) / 2, (2.75 + FFL) / 2), M['plaster'], coll=KITCHEN)
DX0, DX1, DTOP = 2.12, 2.98, 2.25    # doorway to the shower room
wall_with_holes('k_far', EX0, EX1, FFL, 2.75, 0.25, [(DX0, DX1, FFL, DTOP)], M['plaster'], y=FAR, coll=KITCHEN)
for (sx_, sz_, x_, z_) in [((DX1 - DX0 + 0.14), 0.07, (DX0 + DX1) / 2, DTOP + 0.035), (0.07, DTOP - FFL, DX0 - 0.035, (DTOP + FFL) / 2), (0.07, DTOP - FFL, DX1 + 0.035, (DTOP + FFL) / 2)]:
    box(f'arch_{x_}_{z_}', (sx_, 0.02, sz_), (x_, FAR - 0.01, z_), M['white_frame'], bevel=0.002, coll=KITCHEN)
box('k_ceiling', (EX1 - EX0, FAR - WALL_T, 0.02), (0, (WALL_T + FAR) / 2, 2.76), M['ceiling'], coll=KITCHEN)
# reveal of the rooflight
for (a, b, c, d) in [(RL[0], RL[1], RL[2], RL[2] + 0.02), (RL[0], RL[1], RL[3] - 0.02, RL[3]), (RL[0], RL[0] + 0.02, RL[2], RL[3]), (RL[1] - 0.02, RL[1], RL[2], RL[3])]:
    box(f'rl_rev_{a}_{c}', (b - a, d - c, 0.32), ((a + b) / 2, (c + d) / 2, 2.91), M['ceiling'], coll=KITCHEN)
bpy.data.objects.remove(bpy.data.objects['k_ceiling'])
for (dx, dy) in [(-2.2, 1.4), (2.2, 1.4), (-2.2, 4.6), (2.2, 4.6), (-0.5, 5.4), (1.0, 5.4)]:
    cylinder(f'dl_{dx}_{dy}', 0.04, 0.004, (dx, dy, 2.747), M['downlight'], coll=KITCHEN)
    add_light('SPOT', (dx, dy, 2.72), 22.0, (1.0, 0.84, 0.66), size=0.03, spot=70, blend=0.9, name=f'k_spot_{dx}_{dy}')

# back run: base units, worktop, zellige wall, shelf, sink and brass tap
RUN0, RUN1 = -2.68, 1.85
WT = FFL + 0.9
box('base_units', (RUN1 - RUN0, 0.6, 0.78), ((RUN0 + RUN1) / 2, FAR - 0.32, FFL + 0.1 + 0.39), M['cabinet'], bevel=0.003, coll=KITCHEN)
box('plinth', (RUN1 - RUN0, 0.55, 0.1), ((RUN0 + RUN1) / 2, FAR - 0.31, FFL + 0.05), m_paint('plinth', (0.02, 0.024, 0.022), 0.6), coll=KITCHEN)
x = RUN0
while x < RUN1 - 0.05:
    w = min(0.6, RUN1 - x)
    box(f'door_gap_{x:.2f}', (0.004, 0.005, 0.74), (x, FAR - 0.618, FFL + 0.49), m_paint('gap', (0.004, 0.005, 0.004), 0.9), coll=KITCHEN)
    box(f'pull_{x:.2f}', (0.012, 0.025, 0.14), (x + w - 0.06, FAR - 0.635, FFL + 0.75), M['brass'], bevel=0.003, coll=KITCHEN)
    x += w
box('worktop', (RUN1 - RUN0, 0.64, 0.03), ((RUN0 + RUN1) / 2, FAR - 0.32, WT + 0.015), M['marble'], bevel=0.002, coll=KITCHEN)
# zellige: 100 mm tiles, full height from worktop to ceiling
ZX0, ZX1, ZZ0, ZZ1 = -2.68, 1.85, WT + 0.03, 2.75
box('zellige_backing', (ZX1 - ZX0, 0.01, ZZ1 - ZZ0), ((ZX0 + ZX1) / 2, FAR - 0.004, (ZZ0 + ZZ1) / 2), M['grout'], coll=KITCHEN)
zvars = []
for vi in range(8):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=10, y_segments=10, size=0.0495)
    rr = random.Random(100 + vi)
    ph = [rr.uniform(0, 6.28) for _ in range(6)]
    for v in bm.verts:
        u, w_ = v.co.x / 0.0495, v.co.y / 0.0495
        v.co.z = 0.0012 * (math.sin(u * 2.1 + ph[0]) * math.sin(w_ * 1.7 + ph[1]) + 0.5 * math.sin(u * 3.7 + ph[2]) * math.cos(w_ * 2.9 + ph[3]))
        edge = max(abs(u), abs(w_))
        if edge > 0.97:
            v.co.x += 0.0007 * math.sin(w_ * 5 + ph[4])
            v.co.y += 0.0007 * math.sin(u * 5 + ph[5])
            v.co.z -= 0.0012
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=-0.009)
    me = bpy.data.meshes.new(f'zellige_v{vi}')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    sub = None
    me.materials.append(M['zellige'])
    box_uv(me)
    zvars.append(me)
nx, nz = int((ZX1 - ZX0) / 0.1), int((ZZ1 - ZZ0) / 0.1)
for i in range(nx):
    for j in range(nz):
        me = RNG.choice(zvars)
        instance(f'z_{i}_{j}', me, (ZX0 + 0.05 + i * 0.1 + RNG.uniform(-0.0006, 0.0006), FAR - 0.012, ZZ0 + 0.05 + j * 0.1 + RNG.uniform(-0.0006, 0.0006)),
                 rot=(math.pi / 2 + RNG.uniform(-0.006, 0.006), RNG.choice([0, math.pi / 2, math.pi, -math.pi / 2]) + RNG.uniform(-0.006, 0.006), 0), coll=KITCHEN)
# oak shelf with an LED strip and a few pieces
box('shelf', (1.6, 0.26, 0.045), (-0.6, FAR - 0.13 - 0.012, WT + 0.62), M['oak'], bevel=0.003, coll=KITCHEN)
box('shelf_led', (1.55, 0.008, 0.004), (-0.6, FAR - 0.2, WT + 0.596), M['led'], coll=KITCHEN)
add_light('AREA', (-0.6, FAR - 0.2, WT + 0.592), 9.0, (1, 0.8, 0.56), size=(1.5, 0.01), rot=(0, 0, 0), name='shelf_light')
lathe('vase1', [(0, 0), (0.05, 0), (0.065, 0.06), (0.06, 0.15), (0.03, 0.22), (0.033, 0.26), (0.0, 0.26)], M['ceramic'], loc=(-1.1, FAR - 0.13, WT + 0.6425), coll=KITCHEN)
lathe('vase2', [(0, 0), (0.06, 0), (0.075, 0.04), (0.07, 0.1), (0.045, 0.13), (0.0, 0.13)], M['terracotta'], loc=(-0.85, FAR - 0.12, WT + 0.6425), coll=KITCHEN)
for k in range(4):
    cylinder(f'plate{k}', 0.12, 0.012, (-0.2, FAR - 0.13, WT + 0.649 + k * 0.013), M['ceramic'], coll=KITCHEN, bevel=0.003)
# sink and brass tap
cutter = box('sink_cutter', (0.56, 0.4, 0.2), (0.55, FAR - 0.33, WT), None, coll=SRC)
wt = bpy.data.objects['worktop']
bo = wt.modifiers.new('sink', 'BOOLEAN'); bo.object = cutter; bo.operation = 'DIFFERENCE'; bo.solver = 'EXACT'
sst = m_metal('sink_steel', (0.62, 0.62, 0.61), 0.28)
for (sx_, sy_, sz_, x_, y_, z_) in [(0.56, 0.4, 0.004, 0.55, FAR - 0.33, WT - 0.2), (0.004, 0.4, 0.2, 0.272, FAR - 0.33, WT - 0.1), (0.004, 0.4, 0.2, 0.828, FAR - 0.33, WT - 0.1), (0.56, 0.004, 0.2, 0.55, FAR - 0.528, WT - 0.1), (0.56, 0.004, 0.2, 0.55, FAR - 0.132, WT - 0.1)]:
    box(f'sink_{x_}_{y_}_{z_}', (sx_, sy_, sz_), (x_, y_, z_), sst, coll=KITCHEN)
cylinder('sink_waste', 0.035, 0.003, (0.55, FAR - 0.33, WT - 0.197), sst, coll=KITCHEN)
tube('tap', [(0.55, FAR - 0.06, WT + 0.03), (0.55, FAR - 0.06, WT + 0.25), (0.55, FAR - 0.07, WT + 0.36), (0.55, FAR - 0.15, WT + 0.38), (0.55, FAR - 0.24, WT + 0.33), (0.55, FAR - 0.25, WT + 0.29)], 0.011, M['brass'], coll=KITCHEN)
cylinder('tap_base', 0.025, 0.03, (0.55, FAR - 0.06, WT + 0.045), M['brass'], coll=KITCHEN, bevel=0.003)
# bowl of lemons and a board on the worktop
lathe('fruit_bowl', [(0, 0), (0.06, 0), (0.13, 0.04), (0.17, 0.085), (0.165, 0.09), (0.125, 0.048), (0.0, 0.012)], M['ceramic'], loc=(-1.65, FAR - 0.32, WT + 0.03), coll=KITCHEN)
for k in range(6):
    a = k * 1.1
    sphere(f'lemon{k}', 0.036, (-1.65 + 0.07 * math.cos(a), FAR - 0.32 + 0.07 * math.sin(a), WT + 0.075 + (0.03 if k == 5 else 0)), M['lemon'], coll=KITCHEN, scale=(1, 1.25, 1))
box('board', (0.36, 0.022, 0.5), (1.45, FAR - 0.06, WT + 0.27), M['oak'], rot=(-0.12, 0, 0), bevel=0.004, coll=KITCHEN)
# tall units on the left wall (oven and pantry)
box('tall_units', (0.62, 2.4, 2.3), (EX0 + 0.31, FAR - 1.2, FFL + 1.15), M['cabinet'], bevel=0.003, coll=KITCHEN)
for k in range(1, 4):
    box(f'tall_gap_{k}', (0.005, 0.004, 2.25), (EX0 + 0.622, FAR - 2.4 + k * 0.6, FFL + 1.15), m_paint('gap2', (0.004, 0.005, 0.004), 0.9), coll=KITCHEN)
    box(f'tall_pull_{k}', (0.025, 0.012, 0.3), (EX0 + 0.64, FAR - 2.4 + k * 0.6 - 0.05, FFL + 1.1), M['brass'], bevel=0.003, coll=KITCHEN)

# island with pendants
IX, IY = 0.0, 3.0
FROST = m_glass('frosted_glass', tint=(0.97, 0.96, 0.94), rough=0.45)
box('island', (2.6, 0.95, 0.82), (IX, IY, FFL + 0.1 + 0.41), M['cabinet'], bevel=0.003, coll=KITCHEN)
box('island_plinth', (2.5, 0.85, 0.1), (IX, IY, FFL + 0.05), m_paint('plinth2', (0.02, 0.024, 0.022), 0.6), coll=KITCHEN)
box('island_top', (2.7, 1.05, 0.04), (IX, IY, WT + 0.02), M['marble'], bevel=0.003, coll=KITCHEN)
for k, px in enumerate((-0.8, 0.0, 0.8)):
    sphere(f'pendant_{k}', 0.12, (px, IY, 1.95), FROST, coll=KITCHEN)
    sphere(f'pendant_bulb_{k}', 0.022, (px, IY, 1.95), m_emission('filament', (1.0, 0.62, 0.3), 28.0), coll=KITCHEN)
    tube(f'flex_{k}', [(px, IY, 2.07), (px, IY, 2.4), (px, IY, 2.75)], 0.003, M['black'], coll=KITCHEN)
    cylinder(f'rose_{k}', 0.05, 0.02, (px, IY, 2.74), M['black'], coll=KITCHEN)
    lp = add_light('POINT', (px, IY, 1.95), 14.0, (1, 0.72, 0.44), size=0.03, name=f'pendant_light_{k}')
for k, sx in enumerate((-0.75, -0.25)):
    e = empty(f'stool{k}', (sx, IY - 0.75, FFL), (0, 0, 0.1 * k), KITCHEN)
    child(cylinder(f'stool_seat{k}', 0.19, 0.04, (0, 0, 0.66), M['oak'], coll=KITCHEN, bevel=0.006), e)
    for a in range(4):
        ang = a * math.pi / 2 + math.pi / 4
        lg = child(box(f'stool_leg{k}{a}', (0.022, 0.022, 0.66), (0.13 * math.cos(ang), 0.13 * math.sin(ang), 0.33), M['black'], bevel=0.003, coll=KITCHEN), e)
        lg.rotation_euler = Euler((0.12 * math.sin(ang), -0.12 * math.cos(ang), 0))
    child(box(f'stool_ring{k}', (0.24, 0.24, 0.015), (0, 0, 0.25), M['black'], coll=KITCHEN), e)
# interior bounce light from the opening (sky), keeps the interior readable from outside

# =============================================================== SHOWER ROOM
BX0, BX1, BY0, BY1 = 1.6, 4.0, FAR + 0.25, FAR + 2.75
BTOP = 2.6
box('b_floor_bed', (BX1 - BX0, BY1 - BY0, 0.1), ((BX0 + BX1) / 2, (BY0 + BY1) / 2, FFL - 0.06), M['grout'], coll=BATH)
tile_floor('bfloor', BX0, BX1, BY0, BY1, 0.6, 0.6, 0.002, FFL, M['bath_floor'], BATH, offset_frac=0.0, lippage=0.0001, origin=(BX0, BY0))
box('b_ceiling', (BX1 - BX0, BY1 - BY0, 0.02), ((BX0 + BX1) / 2, (BY0 + BY1) / 2, BTOP + 0.01), M['ceiling'], coll=BATH)
# black marble wall slabs 600 x 1200, vertical, with a niche cut on the joint
NX0, NX1, NZ0, NZ1 = 2.2, 2.8, FFL + 1.2, FFL + 1.5


def wall_slabs(prefix, a0, a1, z0, z1, place, holes=(), cols=None):
    cols = cols or []
    if not cols:
        a = a0
        while a < a1 - 0.01:
            cols.append((a, min(a + 0.6, a1)))
            a += 0.6
    for (a, b_) in cols:
        w = b_ - a
        z = z0
        while z < z1 - 0.01:
            h = min(1.2, z1 - z)
            pieces = [(z, z + h)]
            for (ha0, ha1, hz0, hz1) in holes:
                if ha0 <= a + w / 2 <= ha1 and hz0 < z + h and hz1 > z:
                    pieces = [(z, hz0), (hz1, z + h)]
            for (pz0, pz1) in pieces:
                if pz1 - pz0 > 0.02:
                    place(prefix, a + w / 2, (pz0 + pz1) / 2, w - 0.002, pz1 - pz0 - 0.002)
            z += h


def place_back(prefix, ca, cz, w, h):
    me = bevel_box_mesh(round(w, 4), 0.012, round(h, 4), bevel=0.001, segments=2, name='nero_slab', key=('nb', round(w, 4), round(h, 4)))
    if not me.materials:
        me.materials.append(M['nero'])
    instance(f'{prefix}_{ca:.2f}_{cz:.2f}', me, (ca, BY1 - 0.006, cz), coll=BATH)


def place_left(prefix, ca, cz, w, h):
    me = bevel_box_mesh(0.012, round(w, 4), round(h, 4), bevel=0.001, segments=2, name='nero_slab_side', key=('ns', round(w, 4), round(h, 4)))
    if not me.materials:
        me.materials.append(M['nero'])
    instance(f'{prefix}_{ca:.2f}_{cz:.2f}', me, (BX0 + 0.006, ca, cz), coll=BATH)


def place_right(prefix, ca, cz, w, h):
    me = bevel_box_mesh(0.012, round(w, 4), round(h, 4), bevel=0.001, segments=2, name='nero_slab_side', key=('ns', round(w, 4), round(h, 4)))
    if not me.materials:
        me.materials.append(M['nero'])
    instance(f'{prefix}_{ca:.2f}_{cz:.2f}', me, (BX1 - 0.006, ca, cz), coll=BATH)


WZ0, WZ1, WY0, WY1 = FFL + 1.24, FFL + 1.96, BY0 + 0.6, BY0 + 1.8
wall_slabs('bk', BX0 + 0.012, BX1 - 0.012, FFL, BTOP, place_back, holes=[(NX0, NX1, NZ0, NZ1)], cols=[(BX0 + 0.012, 2.2), (2.2, 2.8), (2.8, 3.4), (3.4, BX1 - 0.012)])
wall_slabs('bl', BY0, BY1, FFL, BTOP, place_left)
wall_slabs('br', BY0, BY1, FFL, BTOP, place_right, holes=[(WY0, WY1, WZ0 - 0.04, WZ1 + 0.04)])
# the niche box, lined in the same marble, LED strip under its head
for (sx_, sy_, sz_, x_, y_, z_) in [(NX1 - NX0, 0.1, 0.012, (NX0 + NX1) / 2, BY1 + 0.05 - 0.012, NZ0 + 0.006),
                                     (NX1 - NX0, 0.1, 0.012, (NX0 + NX1) / 2, BY1 + 0.05 - 0.012, NZ1 - 0.006),
                                     (0.012, 0.1, NZ1 - NZ0, NX0 + 0.006, BY1 + 0.05 - 0.012, (NZ0 + NZ1) / 2),
                                     (0.012, 0.1, NZ1 - NZ0, NX1 - 0.006, BY1 + 0.05 - 0.012, (NZ0 + NZ1) / 2),
                                     (NX1 - NX0, 0.012, NZ1 - NZ0, (NX0 + NX1) / 2, BY1 + 0.094, (NZ0 + NZ1) / 2)]:
    box(f'niche_{x_:.3f}_{z_:.3f}', (sx_, sy_, sz_), (x_, y_, z_), M['nero'], bevel=0.001, coll=BATH)
box('niche_led', (NX1 - NX0 - 0.03, 0.006, 0.003), ((NX0 + NX1) / 2, BY1 - 0.006, NZ1 - 0.0135), M['led'], coll=BATH)
add_light('AREA', ((NX0 + NX1) / 2, BY1 - 0.01, NZ1 - 0.016), 3.0, (1, 0.8, 0.58), size=(NX1 - NX0 - 0.04, 0.01), name='niche_light')
amber = m_glass('amber_glass', tint=(0.55, 0.25, 0.06), shadow_pass=True)
cylinder('bottle1', 0.032, 0.17, (2.48, BY1 + 0.04, NZ0 + 0.012 + 0.085), amber, coll=BATH, bevel=0.004)
cylinder('bottle1_cap', 0.012, 0.035, (2.48, BY1 + 0.04, NZ0 + 0.012 + 0.19), M['black'], coll=BATH)
cylinder('bottle2', 0.03, 0.14, (2.6, BY1 + 0.035, NZ0 + 0.012 + 0.07), m_ceramic('bottle_white', (0.80, 0.79, 0.76), 0.5, False), coll=BATH, bevel=0.004)
cylinder('bottle2_cap', 0.011, 0.03, (2.6, BY1 + 0.035, NZ0 + 0.012 + 0.155), M['black'], coll=BATH)
lathe('soap_dish', [(0, 0), (0.05, 0), (0.06, 0.012), (0.0, 0.012)], m_ceramic('dish', (0.12, 0.11, 0.1), 0.6, False), loc=(2.75, BY1 + 0.035, NZ0 + 0.012), coll=BATH)
# shower fittings: matt black ceiling rose, rain head, valve; linear drain; glass screen
SHX = 2.5
cylinder('rain_arm', 0.012, 0.15, (SHX, BY1 - 0.35, BTOP - 0.075), M['black'], coll=BATH)
cylinder('rain_head', 0.15, 0.012, (SHX, BY1 - 0.35, BTOP - 0.155), M['black'], coll=BATH, bevel=0.003)
cylinder('valve', 0.065, 0.014, (SHX, BY1 - 0.012 - 0.007, FFL + 1.0), M['black'], rot=(math.pi / 2, 0, 0), coll=BATH, bevel=0.003)
box('valve_lever', (0.012, 0.03, 0.12), (SHX, BY1 - 0.04, FFL + 1.0), M['black'], bevel=0.003, coll=BATH)
box('drain', (BX1 - BX0 - 0.2, 0.05, 0.003), ((BX0 + BX1) / 2, BY1 - 0.12, FFL + 0.0005), M['steel'], coll=BATH)
box('screen', (0.008, 1.1, 2.0), (BX0 + 0.55, BY1 - 0.55 - 0.012, FFL + 1.0), M['glass'], coll=BATH)
box('screen_bar', (0.016, 1.1, 0.016), (BX0 + 0.55, BY1 - 0.55, FFL + 2.0), M['black'], coll=BATH)
box('towel_rail', (0.6, 0.02, 0.02), (BX1 - 0.04, BY1 - 1.4, FFL + 1.2), M['black'], rot=(0, 0, math.pi / 2), coll=BATH)
box('towel', (0.06, 0.45, 0.6), (BX1 - 0.06, BY1 - 1.4, FFL + 0.96), m_paint('towel', (0.66, 0.63, 0.58), 0.95), bevel=0.02, segments=4, coll=BATH)
for (dx, dy) in [(SHX, BY1 - 0.45), (2.0, BY0 + 0.6)]:
    cylinder(f'bdl_{dx}_{dy}', 0.035, 0.004, (dx, dy, BTOP - 0.003), M['downlight'], coll=BATH)
    s = add_light('SPOT', (dx, dy, BTOP - 0.02), 28.0, (1.0, 0.86, 0.7), size=0.025, spot=60, blend=0.75, name=f'b_spot_{dx}')
    s.rotation_euler = Euler((math.radians(-14) if dy > BY1 - 1 else 0, 0, 0))

add_light('AREA', (2.5, FAR + 0.3, 2.45), 25.0, (1.0, 0.9, 0.78), size=(1.6, 0.6), name='bath_ceiling_bounce')
# frosted window high on the right wall, lit by evening daylight
box('bwin_glass', (0.01, WY1 - WY0, WZ1 - WZ0), (BX1 - 0.002, (WY0 + WY1) / 2, (WZ0 + WZ1) / 2), m_emission('frosted_day', (1.0, 0.93, 0.84), 2.2), coll=BATH)
for (sy_, sz_, y_, z_) in [((WY1 - WY0 + 0.08), 0.04, (WY0 + WY1) / 2, WZ1 + 0.02), ((WY1 - WY0 + 0.08), 0.04, (WY0 + WY1) / 2, WZ0 - 0.02), (0.04, (WZ1 - WZ0), WY0 - 0.02, (WZ0 + WZ1) / 2), (0.04, (WZ1 - WZ0), WY1 + 0.02, (WZ0 + WZ1) / 2)]:
    box(f'bwin_frame_{y_:.2f}_{z_:.2f}', (0.05, sy_, sz_), (BX1 - 0.02, y_, z_), M['white_frame'], bevel=0.003, coll=BATH)
l = add_light('AREA', (BX1 - 0.03, (WY0 + WY1) / 2, (WZ0 + WZ1) / 2), 55.0, (1.0, 0.9, 0.78), size=(WY1 - WY0, WZ1 - WZ0), name='bwin_light')
l.rotation_euler = Euler((0, math.radians(-90), 0))
for (dx, dy) in [(3.5, BY0 + 1.2), (1.95, BY1 - 1.5)]:
    cylinder(f'bdl2_{dx}_{dy}', 0.035, 0.004, (dx, dy, BTOP - 0.003), M['downlight'], coll=BATH)
    add_light('SPOT', (dx, dy, BTOP - 0.02), 18.0, (1.0, 0.86, 0.7), size=0.025, spot=70, blend=0.8, name=f'b_spot2_{dx}')

# neighbouring houses either side, so the boundary isn't an empty horizon
for side in (-1, 1):
    nx = side * 9.4
    box(f'nb_house_{side}', (9.0, 9.0, 6.3), (nx, MY + 4.5, 3.15), M['brick'], coll=HOUSE)
    box(f'nb_ext_{side}', (4.2, 4.0, 2.9), (side * 6.9, MY - 2.0, 1.45), m_plaster(f'render_{side}', (0.72, 0.69, 0.63), bump=0.08), coll=HOUSE)
    box(f'nb_ext_cope_{side}', (4.3, 4.1, 0.06), (side * 6.9, MY - 2.0, 2.93), M['alu'], coll=HOUSE)
    for k in range(2):
        wx = nx + (-2.2 + k * 4.4)
        box(f'nb_win_{side}_{k}', (1.2, 0.02, 1.4), (wx, MY - 0.01, 4.2), M['glass'], coll=HOUSE)
        box(f'nb_wind_{side}_{k}', (1.2, 0.02, 1.4), (wx, MY + 0.02, 4.2), m_paint(f'nbdark{side}{k}', (0.02, 0.02, 0.02), 0.9), coll=HOUSE)
        box(f'nb_sill_{side}_{k}', (1.32, 0.12, 0.06), (wx, MY - 0.06, 3.47), M['coping'], coll=HOUSE)
    for sgn in (-1, 1):
        me = bpy.data.meshes.new('nbroof')
        bm = bmesh.new()
        y0 = MY - 0.35 if sgn < 0 else MY + 9.35
        vs = [bm.verts.new((nx - 4.6, y0, 6.3)), bm.verts.new((nx + 4.6, y0, 6.3)), bm.verts.new((nx + 4.6, MY + 4.5, 8.8)), bm.verts.new((nx - 4.6, MY + 4.5, 8.8))]
        bm.faces.new(vs)
        bm.to_mesh(me)
        bm.free()
        box_uv(me)
        o = mesh_obj(f'nb_roof_{side}_{sgn}', me, M['slate'], coll=HOUSE)
        o.modifiers.new('sol', 'SOLIDIFY').thickness = 0.06

# teak shower stool with a rolled towel
for (lx, ly) in [(-0.14, -0.1), (0.14, -0.1), (-0.14, 0.1), (0.14, 0.1)]:
    box(f'bstool_leg_{lx}_{ly}', (0.035, 0.035, 0.42), (1.98 + lx, BY1 - 0.32 + ly, FFL + 0.21), M['teak'], bevel=0.004, coll=BATH)
for k in range(5):
    box(f'bstool_slat{k}', (0.38, 0.05, 0.025), (1.98, BY1 - 0.32 - 0.12 + k * 0.06, FFL + 0.43), M['teak'], bevel=0.004, coll=BATH)
TOWEL = m_fabric('towel_white', (0.78, 0.76, 0.72), sheen=0.8, rough=0.95)
cylinder('rolled_towel', 0.07, 0.3, (1.98, BY1 - 0.32, FFL + 0.512), TOWEL, rot=(0, math.pi / 2, 0.15), coll=BATH, bevel=0.03)

# =============================================================== CAMERAS
CAMS = {
    'garden':  dict(loc=(0.35, -7.9, 1.0), yaw=-1.0, lens=24, shift=(0.0, 0.045), fstop=7.1, focus=7.0),
    'kitchen': dict(loc=(0.1, 0.6, 1.36), yaw=-2.0, lens=22, shift=(0.0, 0.03), fstop=5.6, focus=5.2),
    'bath':    dict(loc=(2.5, FAR + 0.42, 1.3), yaw=0.0, lens=19, shift=(0.0, -0.07), fstop=4.0, focus=2.2),
}
CAMS['garden_p'] = dict(loc=(0.3, -7.9, 1.0), yaw=-1.0, lens=17, shift=(0.0, 0.07), fstop=7.1, focus=7.0, fit='VERTICAL')
CAMS['kitchen_p'] = dict(loc=(1.2, 0.75, 1.36), yaw=1.25, lens=16, shift=(0.0, -0.05), fstop=5.6, focus=5.2, fit='VERTICAL')
CAMS['bath_p'] = dict(loc=(2.5, FAR + 0.42, 1.3), yaw=0.0, lens=15, shift=(0.0, -0.03), fstop=4.0, focus=2.2, fit='VERTICAL')
cams = {}
for k, c in CAMS.items():
    cams[k] = camera(f'cam_{k}', c['loc'], lens=c['lens'], pitch=90, yaw=c['yaw'], shift=c['shift'], fstop=c['fstop'], focus=c['focus'], fit=c.get('fit', 'HORIZONTAL'))


def portal_rect(cam_obj, corners):
    bpy.context.view_layer.update()
    pts = [world_to_camera_view(sc, cam_obj, Vector(p)) for p in corners]
    xs = [p.x for p in pts]
    ys = [1 - p.y for p in pts]
    return [round(min(xs), 4), round(min(ys), 4), round(max(xs), 4), round(max(ys), 4)]


if __name__ == '__main__':
    which, W, H, S, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
    EXPOS = {'garden': -0.85, 'kitchen': -0.3, 'bath': 0.0}
    render_settings(W, H, samples=S, exposure=float(os.environ.get('EXPO', EXPOS.get(which.split('_')[0], -1.0))), look=os.environ.get('LOOK', 'AgX - Medium High Contrast'))
    sc.render.resolution_x, sc.render.resolution_y = W, H
    cam = cams[which]
    if which == 'garden':
        # interior lighting stays on, visible through the open doors
        pass
    info = {'_dims': [W, H]}
    info['garden_door'] = portal_rect(cam, [(OX0, 0.06, FFL), (OX1, 0.06, FFL), (OX0, 0.06, OPEN_TOP), (OX1, 0.06, OPEN_TOP)])
    info['kitchen_door'] = portal_rect(cam, [(DX0, FAR, FFL), (DX1, FAR, FFL), (DX0, FAR, DTOP), (DX1, FAR, DTOP)])
    info['bath_niche'] = portal_rect(cam, [(NX0, BY1, NZ0), (NX1, BY1, NZ0), (NX0, BY1, NZ1), (NX1, BY1, NZ1)])
    json.dump(info, open(out.replace('.png', '.json'), 'w'))
    render(out, cam)
