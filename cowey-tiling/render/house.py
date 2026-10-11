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
    mortar=m_plaster('mortar_bed', (0.25, 0.24, 0.22), rough=0.95, bump=0.4),
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
PATIO = tile_floor('patio', PX0, PX1, PY0, PY1, 0.9, 0.6, 0.005, FFL, M['stone'], GARDEN)
box('patio_bed', (PX1 - PX0, PY1 - PY0, FFL - 0.02), ((PX0 + PX1) / 2, (PY0 + PY1) / 2, (FFL - 0.02) / 2), M['mortar'], coll=GARDEN)
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

# the patio is being laid: a pallet of slabs on the lawn, a bucket of mortar, a spirit level and a rubber mallet
PINE = m_oak('pallet_pine', tone=(0.50, 0.38, 0.24), rough=0.78, along='X', oiled=False)
RUBBER = m_paint('rubber', (0.022, 0.022, 0.022), 0.7)
PALX, PALY = -2.35, -5.45
for k in range(3):
    box(f'pal_bearer{k}', (1.2, 0.09, 0.1), (PALX, PALY - 0.42 + k * 0.42, 0.05), PINE, bevel=0.004, coll=GARDEN)
for k in range(7):
    box(f'pal_deck{k}', (0.1, 0.98, 0.022), (PALX - 0.54 + k * 0.18, PALY, 0.111), PINE, bevel=0.002, coll=GARDEN)
stack_me = bevel_box_mesh(0.895, 0.595, 0.02, bevel=0.0016, segments=2, name='stack_slab', key=('stack_slab',))
if not stack_me.materials:
    stack_me.materials.append(M['stone'])
for k in range(8):
    instance(f'stack_slab{k}', stack_me, (PALX + RNG.uniform(-0.012, 0.012), PALY + RNG.uniform(-0.012, 0.012), 0.132 + k * 0.0205),
             rot=(0, 0, RNG.uniform(-0.012, 0.012)), coll=GARDEN)
STACK_TOP = 0.122 + 8 * 0.0205
box('spirit_level', (1.0, 0.03, 0.06), (PALX + 0.02, PALY + 0.14, STACK_TOP + 0.03), m_paint('level_yellow', (0.62, 0.40, 0.02), 0.35),
    rot=(0, 0, 0.16), bevel=0.004, coll=GARDEN)
mallet = empty('mallet', (PALX - 0.22, PALY - 0.12, STACK_TOP), (0, 0, 0.55), GARDEN)
child(cylinder('mallet_head', 0.045, 0.13, (0, 0, 0.045), RUBBER, rot=(0, math.pi / 2, 0), coll=GARDEN, bevel=0.01), mallet)
child(cylinder('mallet_handle', 0.013, 0.3, (0, -0.17, 0.045), PINE, rot=(math.pi / 2, 0, 0), coll=GARDEN), mallet)
BKX, BKY = -1.15, -4.72
lathe('bucket', [(0, 0), (0.13, 0), (0.165, 0.29), (0.172, 0.295), (0.172, 0.305), (0.16, 0.305), (0.125, 0.012), (0.0, 0.012)],
      RUBBER, loc=(BKX, BKY, 0.0), coll=GARDEN)
disc('bucket_mortar', 0.152, (BKX, BKY, 0.215), M['mortar'], GARDEN)
tube('bucket_handle', [(BKX + 0.17 * math.cos(a), BKY + 0.05 * math.sin(a) - 0.02, 0.29 + 0.03 * math.sin(a)) for a in [i * math.pi / 8 for i in range(9)]],
     0.004, M['steel'], coll=GARDEN)

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

# main house beyond the extension: brick rear and front walls with painted timber sashes, slate terrace roof, rear dormer
MY = 6.2 + 0.25
HF = 12.45                      # outside face of the front wall, the street side
EAVE, RIDGE = 6.3, 8.9
RIDGE_Y = (MY - 0.3 + HF) / 2
ROOMDARK = m_paint('room_dark', (0.05, 0.045, 0.04), 0.9)
ROOMLIT = m_emission('room_lit', (1.0, 0.72, 0.46), 0.9)
CURTAIN = m_fabric('curtain', (0.60, 0.56, 0.48), sheen=0.3, rough=0.9)
CURTAIN2 = m_fabric('curtain2', (0.30, 0.33, 0.34), sheen=0.3, rough=0.9)
BRICK_RED = m_brick2('brick_red', 'XZ', palette='red')


def sash(name, cx, face, z0, z1, w, out, coll=None, lit=False, bars=1, sill=True, curtain=None):
    """Painted timber sliding sash in a wall opening. face: y of the outside wall face; out: -1 faces -y, +1 faces +y."""
    coll = coll or HOUSE
    fy = face - out * 0.1
    hz = (z0 + z1) / 2
    parts = [('hd', (w, 0.08, 0.06), (cx, fy, z1 - 0.03)), ('sb', (w, 0.08, 0.08), (cx, fy, z0 + 0.04)),
             ('jl', (0.065, 0.08, z1 - z0), (cx - w / 2 + 0.0325, fy, hz)), ('jr', (0.065, 0.08, z1 - z0), (cx + w / 2 - 0.0325, fy, hz)),
             ('mr', (w - 0.12, 0.05, 0.05), (cx, fy + out * 0.01, hz))]
    for k in range(bars):
        parts.append((f'gb{k}', (0.028, 0.035, z1 - z0 - 0.12), (cx - (w - 0.13) / 2 + (k + 1) * (w - 0.13) / (bars + 1), fy, hz)))
    for tag, size, loc in parts:
        box(f'{name}_{tag}', size, loc, M['white_frame'], bevel=0.003, coll=coll)
    box(f'{name}_gl', (w - 0.12, 0.008, z1 - z0 - 0.13), (cx, fy, hz + 0.005), M['glass'], coll=coll)
    if sill:
        box(f'{name}_sill', (w + 0.16, 0.15, 0.07), (cx, face - out * 0.025, z0 - 0.035), M['coping'], bevel=0.004, coll=coll)
        box(f'{name}_lint', (w + 0.14, 0.03, 0.17), (cx, face + out * 0.012, z1 + 0.085), M['coping'], bevel=0.003, coll=coll)
    box(f'{name}_room', (w + 0.9, 0.02, z1 - z0 + 0.9), (cx, fy - out * 1.4, hz), ROOMLIT if lit else ROOMDARK, coll=coll)
    cur = curtain or CURTAIN
    for sgn in (-1, 1):
        box(f'{name}_cur{sgn}', (w * 0.2, 0.06, z1 - z0 + 0.1), (cx + sgn * (w / 2 - w * 0.07), fy - out * 0.18, hz - 0.03), cur, bevel=0.025, segments=3, coll=coll)


def front_door(name, x0, x1, face, out, col, coll=None, z0=0.15):
    """Panelled front door with a glazed fanlight, set back in its opening (x0..x1, z0..z0+2.6)."""
    coll = coll or HOUSE
    cx, w = (x0 + x1) / 2, x1 - x0
    fy = face - out * 0.12
    paint = m_paint(f'{name}_paint', col, 0.3)
    box(f'{name}_leaf', (w - 0.1, 0.05, 2.05), (cx, fy, z0 + 1.03), paint, bevel=0.004, coll=coll)
    for (px, pz, ph) in [(-0.22, 1.42, 0.78), (0.22, 1.42, 0.78), (-0.22, 0.45, 0.6), (0.22, 0.45, 0.6)]:
        box(f'{name}_pan_{px}_{pz}', (w * 0.3, 0.012, ph), (cx + px * w / 0.92, fy + out * 0.03, z0 + pz), paint, bevel=0.012, segments=3, coll=coll)
    for (sx_, sz_, x_, z_) in [(w, 0.07, cx, z0 + 2.1), (0.05, 2.6, x0 + 0.025, z0 + 1.3), (0.05, 2.6, x1 - 0.025, z0 + 1.3), (w, 0.05, cx, z0 + 2.575)]:
        box(f'{name}_fr_{x_:.2f}_{z_:.2f}', (sx_, 0.09, sz_), (x_, fy, z_), M['white_frame'], bevel=0.003, coll=coll)
    box(f'{name}_fan', (w - 0.1, 0.008, 0.38), (cx, fy, z0 + 2.33), M['glass'], coll=coll)
    box(f'{name}_fanroom', (w + 0.3, 0.02, 0.8), (cx, fy - out * 1.2, z0 + 2.2), ROOMDARK, coll=coll)
    sphere(f'{name}_knob', 0.03, (cx, fy + out * 0.05, z0 + 1.12), M['brass'], coll=coll)
    box(f'{name}_letter', (0.26, 0.015, 0.06), (cx, fy + out * 0.03, z0 + 0.88), M['brass'], bevel=0.003, coll=coll)
    box(f'{name}_step', (w + 0.2, 0.3, z0), (cx, face + out * 0.12, z0 / 2), M['coping'], bevel=0.004, coll=coll)


def house_front(tag, x0, x1, face, out, mat, coll, door_left=True, door_col=(0.03, 0.06, 0.12), lit=(), curtain=None, wide=False):
    """Front facade of a terraced house: door and ground floor window, first floor sashes."""
    w = x1 - x0
    if wide:
        ups = [x0 + w * 0.2, x0 + w * 0.5, x0 + w * 0.8]
        dx = x0 + w * 0.5
        gws = [(x0 + w * 0.2, 1.7), (x0 + w * 0.8, 1.7)]
    else:
        ups = [x0 + w * 0.27, x0 + w * 0.73]
        dx = x0 + 0.95 if door_left else x1 - 0.95
        gws = [(x1 - w * 0.33 if door_left else x0 + w * 0.33, min(2.2, w * 0.42))]
    holes = [(dx - 0.5, dx + 0.5, 0.0, 2.75)] + [(c - g / 2, c + g / 2, 0.9, 2.45) for c, g in gws] + [(c - 0.6, c + 0.6, 3.5, 4.95) for c in ups]
    wall_with_holes(f'{tag}_front', x0, x1, 0.0, EAVE, 0.3, holes, mat, y=face if out < 0 else face - 0.3, coll=coll)
    front_door(f'{tag}_door', dx - 0.5, dx + 0.5, face, out, door_col, coll=coll)
    for i, (c, g) in enumerate(gws):
        sash(f'{tag}_gw{i}', c, face, 0.9, 2.45, g, out, coll=coll, lit=(f'g{i}' in lit), bars=2 if g > 1.5 else 1, curtain=curtain)
    for i, c in enumerate(ups):
        sash(f'{tag}_uw{i}', c, face, 3.5, 4.95, 1.2, out, coll=coll, lit=(f'u{i}' in lit), curtain=curtain)
    box(f'{tag}_band', (w, 0.04, 0.075), ((x0 + x1) / 2, face + out * 0.02, 3.05), M['coping'], coll=coll)


def terrace_roof(tag, x0, x1, y_rear, y_front, coll, chimneys=()):
    """Two slate pitches over a row of houses, ridge along X, with chimney stacks on the party walls."""
    ry = (y_rear + y_front) / 2
    for side, (ya, yb) in ((-1, (y_rear - 0.35, ry)), (1, (y_front + 0.35, ry))):
        me = bpy.data.meshes.new(f'{tag}_roofpl')
        bm = bmesh.new()
        vs = [bm.verts.new((x0, ya, EAVE)), bm.verts.new((x1, ya, EAVE)), bm.verts.new((x1, yb, RIDGE)), bm.verts.new((x0, yb, RIDGE))]
        bm.faces.new(vs if side < 0 else vs[::-1])
        bm.to_mesh(me)
        bm.free()
        box_uv(me)
        o = mesh_obj(f'{tag}_roof_{side}', me, M['slate'], coll=coll)
        o.modifiers.new('sol', 'SOLIDIFY').thickness = 0.06
        box(f'{tag}_fascia_{side}', (x1 - x0, 0.03, 0.22), ((x0 + x1) / 2, ya + side * 0.01, EAVE - 0.08), M['white_frame'], coll=coll)
        tube(f'{tag}_gutter_{side}', [(x0, ya + side * 0.07, EAVE - 0.08), (x1, ya + side * 0.07, EAVE - 0.08)], 0.055, M['alu'], coll=coll)
    box(f'{tag}_ridge', (x1 - x0, 0.2, 0.08), ((x0 + x1) / 2, ry, RIDGE + 0.02), M['terracotta'], coll=coll)
    for i, cxp in enumerate(chimneys):
        box(f'{tag}_chim{i}', (0.9, 0.6, 1.6), (cxp, ry, RIDGE + 0.55), BRICK_RED if i % 3 == 1 else M['brick'], coll=coll)
        box(f'{tag}_chimcap{i}', (1.0, 0.7, 0.08), (cxp, ry, RIDGE + 1.38), M['coping'], coll=coll)
        for k in range(2):
            cylinder(f'{tag}_pot{i}{k}', 0.1, 0.36, (cxp - 0.2 + k * 0.4, ry, RIDGE + 1.6), M['terracotta'], coll=coll)


# our house: three first floor sashes at the back, the middle one smaller
REAR_WIN = [(-2.7, 1.15, 4.95, True), (0.0, 0.75, 4.7, False), (2.7, 1.15, 4.95, False)]
wall_with_holes('main_rear', -4.6, 4.6, 0.0, EAVE, 0.3, [(cx - w / 2, cx + w / 2, 3.5, top) for cx, w, top, _ in REAR_WIN] + [(-3.65, 3.65, 0.0, 2.95)],
                M['brick'], y=MY - 0.3, coll=HOUSE)
for i, (cx, w, top, lit) in enumerate(REAR_WIN):
    sash(f'mrw{i}', cx, MY - 0.3, 3.5, top, w, -1, lit=lit, bars=0 if w < 1 else 1)
# rear dormer (loft conversion) in dark zinc with a wide window
ZINC = m_paint('zinc', (0.075, 0.08, 0.085), 0.42)
DY0 = 7.1
dz0 = EAVE + (DY0 - (MY - 0.65)) * (RIDGE - EAVE) / (RIDGE_Y - (MY - 0.65))
box('dormer', (3.4, RIDGE_Y - DY0, 8.75 - (dz0 - 0.4)), (0, (DY0 + RIDGE_Y) / 2, (8.75 + dz0 - 0.4) / 2), ZINC, bevel=0.01, coll=HOUSE)
box('dormer_trim', (3.5, 0.1, 0.1), (0, DY0 - 0.02, 8.74), ZINC, bevel=0.005, coll=HOUSE)
box('dormer_room', (2.6, 0.01, 1.25), (0, DY0 - 0.004, dz0 + 0.95), ROOMDARK, coll=HOUSE)
box('dormer_glass', (2.5, 0.008, 1.15), (0, DY0 - 0.025, dz0 + 0.95), M['glass'], coll=HOUSE)
for (sx_, sz_, x_, z_) in [(2.62, 0.06, 0, dz0 + 1.55), (2.62, 0.07, 0, dz0 + 0.35), (0.06, 1.25, -1.28, dz0 + 0.95), (0.06, 1.25, 1.28, dz0 + 0.95), (0.05, 1.2, -0.42, dz0 + 0.95), (0.05, 1.2, 0.42, dz0 + 0.95)]:
    box(f'dormer_fr_{x_}_{z_:.2f}', (sx_, 0.06, sz_), (x_, DY0 - 0.04, z_), M['alu'], bevel=0.002, coll=HOUSE)
# front wall: bathroom casement (open), front door, front room sash, three sashes above
CX0, CX1, CZ0, CZ1 = 2.0, 3.1, FFL + 0.95, FFL + 2.15
wall_with_holes('main_front', -4.6, 4.6, 0.0, EAVE, 0.3,
                [(CX0, CX1, CZ0, CZ1), (-0.55, 0.45, 0.0, 2.75), (-3.5, -1.6, 0.9, 2.45), (-3.2, -2.0, 3.5, 4.95), (-0.6, 0.6, 3.5, 4.95), (2.0, 3.2, 3.5, 4.95),
                 (1.15, 1.75, FFL + 1.2, FFL + 1.5)], M['brick'], y=HF - 0.3, coll=HOUSE)
box('niche_patch', (0.62, 0.12, 0.32), (1.45, HF - 0.06, FFL + 1.35), M['brick'], coll=HOUSE)
front_door('mfdoor', -0.55, 0.45, HF, 1, (0.035, 0.075, 0.055))
sash('mfw_gf', -2.55, HF, 0.9, 2.45, 1.9, 1, bars=2)
for i, cx in enumerate((-2.6, 0.0, 2.6)):
    sash(f'mfw{i}', cx, HF, 3.5, 4.95, 1.2, 1, lit=(i == 0))
box('mf_band', (9.2, 0.04, 0.075), (0, HF + 0.02, 3.05), M['coping'], coll=HOUSE)
# the bathroom casement, hinged on its left jamb and swung out over the front garden
cfy = HF - 0.08
for (sx_, sz_, x_, z_) in [(CX1 - CX0, 0.06, (CX0 + CX1) / 2, CZ1 - 0.03), (CX1 - CX0, 0.07, (CX0 + CX1) / 2, CZ0 + 0.035),
                           (0.06, CZ1 - CZ0, CX0 + 0.03, (CZ0 + CZ1) / 2), (0.06, CZ1 - CZ0, CX1 - 0.03, (CZ0 + CZ1) / 2)]:
    box(f'cas_fr_{x_:.2f}_{z_:.2f}', (sx_, 0.07, sz_), (x_, cfy, z_), M['white_frame'], bevel=0.003, coll=HOUSE)
box('cas_sill', (CX1 - CX0 + 0.16, 0.15, 0.07), ((CX0 + CX1) / 2, HF + 0.025, CZ0 - 0.035), M['coping'], bevel=0.004, coll=HOUSE)
box('cas_lint', (CX1 - CX0 + 0.14, 0.03, 0.17), ((CX0 + CX1) / 2, HF + 0.012, CZ1 + 0.085), M['coping'], bevel=0.003, coll=HOUSE)
hinge = empty('cas_hinge', (CX0 + 0.06, cfy + 0.035, CZ0 + 0.07), (0, 0, math.radians(78)), HOUSE)
SW, SH = CX1 - CX0 - 0.12, CZ1 - CZ0 - 0.13
FROST_B = m_glass('frosted_bath', tint=(0.96, 0.96, 0.95), rough=0.35)
for (sx_, sz_, x_, z_) in [(SW, 0.05, SW / 2, SH - 0.025), (SW, 0.06, SW / 2, 0.03), (0.05, SH, 0.025, SH / 2), (0.05, SH, SW - 0.025, SH / 2)]:
    child(box(f'cas_s_{x_:.2f}_{z_:.2f}', (sx_, 0.05, sz_), (x_, 0.03, z_), M['white_frame'], bevel=0.003, coll=HOUSE), hinge)
child(box('cas_glass', (SW - 0.08, 0.008, SH - 0.09), (SW / 2, 0.03, SH / 2), FROST_B, coll=HOUSE), hinge)
child(box('cas_stay', (0.012, 0.3, 0.012), (0.25, -0.15, 0.02), M['brass'], coll=HOUSE), hinge)

# the rest of the terrace on this side: next door either side (double fronted), then narrower houses along the street
NEIGH = [(-13.8, -4.6, True), (4.6, 13.8, True)]
x = 13.8
while x < 44:
    NEIGH.append((x, x + 5.6, False))
    NEIGH.append((-x - 5.6, -x, False))
    x += 5.6
DOORS = [(0.03, 0.06, 0.12), (0.30, 0.04, 0.035), (0.02, 0.02, 0.02), (0.06, 0.1, 0.07), (0.32, 0.30, 0.26)]
for i, (a, b, wide) in enumerate(NEIGH):
    mat = BRICK_RED if i % 4 == 2 else M['brick']
    house_front(f'nf{i}', a, b, HF, 1, mat, HOUSE, door_left=(i % 2 == 0), door_col=DOORS[i % len(DOORS)], wide=wide,
                lit=('u1',) if i % 3 == 0 else (('g0',) if i % 4 == 1 else ()), curtain=CURTAIN2 if i % 2 else CURTAIN)
    if wide:
        rw = [(a + b) / 2 - 2.4, (a + b) / 2 + 2.4]
        wall_with_holes(f'nb_rear{i}', a, b, 0.0, EAVE, 0.3, [(c - 0.58, c + 0.58, 3.5, 4.95) for c in rw], mat, y=MY - 0.3, coll=HOUSE)
        for k, c in enumerate(rw):
            sash(f'nb_rw{i}{k}', c, MY - 0.3, 3.5, 4.95, 1.16, -1, lit=(k == 1 and i == 1))
    else:
        box(f'nb_rearplain{i}', (b - a, 0.3, EAVE), ((a + b) / 2, MY - 0.15, EAVE / 2), mat, coll=HOUSE)
terrace_roof('our_row', -47.0, 47.0, MY - 0.3, HF, HOUSE, chimneys=[-13.8, -4.6, 4.6, 13.8, 19.4, 25.0, 30.6, -19.4, -25.0, -30.6, -36.2, 36.2])
# next door's single storey extensions, with glazed doors to their gardens
for side in (-1, 1):
    ex = side * 6.9
    box(f'nb_ext_{side}', (4.2, 4.0, 2.9), (ex, MY - 2.0, 1.45), M['brick'], coll=HOUSE)
    box(f'nb_ext_cope_{side}', (4.3, 4.1, 0.06), (ex, MY - 2.0, 2.93), M['alu'], coll=HOUSE)
    box(f'nb_ext_dark_{side}', (3.0, 0.01, 2.2), (ex, MY - 4.006, 1.25), ROOMDARK, coll=HOUSE)
    box(f'nb_ext_glass_{side}', (3.0, 0.008, 2.2), (ex, MY - 4.03, 1.25), M['glass'], coll=HOUSE)
    for k in range(5):
        box(f'nb_ext_mul_{side}_{k}', (0.06, 0.05, 2.25), (ex - 1.5 + k * 0.75, MY - 4.04, 1.25), M['alu'], coll=HOUSE)
    for z_ in (0.17, 2.35):
        box(f'nb_ext_tr_{side}_{z_}', (3.06, 0.05, 0.06), (ex, MY - 4.04, z_), M['alu'], coll=HOUSE)

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

# =============================================================== HALLWAY
HALL = collection('hall')
HX0, HX1, HY0, HY1 = 1.9, 3.2, MY, 9.75
HTOP = 2.8


def fill_light(name, loc, energy, size, color=(1.0, 0.86, 0.72)):
    o = add_light('AREA', loc, energy, color, size=size, name=name)
    o.visible_camera = False
    o.visible_glossy = False
    return o


def clip_poly(pts, x0, x1, y0, y1):
    def clip(pts, inside, inter):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            if inside(b):
                if not inside(a):
                    out.append(inter(a, b))
                out.append(b)
            elif inside(a):
                out.append(inter(a, b))
        return out

    def ix(a, b, x):
        t = (x - a[0]) / (b[0] - a[0])
        return (x, a[1] + t * (b[1] - a[1]))

    def iy(a, b, y):
        t = (y - a[1]) / (b[1] - a[1])
        return (a[0] + t * (b[0] - a[0]), y)
    for inside, inter in [(lambda p: p[0] >= x0, lambda a, b: ix(a, b, x0)), (lambda p: p[0] <= x1, lambda a, b: ix(a, b, x1)),
                          (lambda p: p[1] >= y0, lambda a, b: iy(a, b, y0)), (lambda p: p[1] <= y1, lambda a, b: iy(a, b, y1))]:
        if not pts:
            break
        pts = clip(pts, inside, inter)
    return pts


def shrink(pts, d):
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    out = []
    for (x, y) in pts:
        dx, dy = x - cx, y - cy
        L = math.hypot(dx, dy) or 1.0
        out.append((x - dx / L * d, y - dy / L * d))
    return out


def tile_polys(name, polys, top, thick, mat, coll, joint=0.0012):
    """Extrude 2D tile shapes into one mesh, each pulled in a little to leave a grout joint."""
    bm = bmesh.new()
    for pts in polys:
        if len(pts) < 3:
            continue
        area = sum(pts[i - 1][0] * pts[i][1] - pts[i][0] * pts[i - 1][1] for i in range(len(pts))) / 2
        if abs(area) < 3e-5:
            continue
        if area < 0:
            pts = pts[::-1]
        pts = shrink(pts, joint)
        lip = RNG.uniform(-0.0003, 0.0003)
        t_ = [bm.verts.new((x, y, top + lip)) for x, y in pts]
        b_ = [bm.verts.new((x, y, top - thick)) for x, y in pts]
        bm.faces.new(t_)
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((b_[i], b_[j], t_[j], t_[i]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    box_uv(me)
    o = mesh_obj(name, me, mat, coll=coll)
    bv = o.modifiers.new('bev', 'BEVEL')
    bv.width = 0.0009
    bv.segments = 2
    bv.limit_method = 'ANGLE'
    return o


def strip_polys(x0, x1, y0, y1, piece):
    """Cut a band into pieces of the given length along its long side."""
    out = []
    if x1 - x0 >= y1 - y0:
        a = x0
        while a < x1 - 0.005:
            out.append([(a, y0), (min(a + piece, x1), y0), (min(a + piece, x1), y1), (a, y1)])
            a += piece
    else:
        a = y0
        while a < y1 - 0.005:
            out.append([(x0, a), (x1, a), (x1, min(a + piece, y1)), (x0, min(a + piece, y1))])
            a += piece
    return out


# Victorian geometric floor: octagon and dot field inside a black, terracotta and black border
GEO = dict(cream=m_ceramic('geo_cream', (0.70, 0.65, 0.55), rough=0.3, speckle=False),
           black=m_ceramic('geo_black', (0.022, 0.022, 0.024), rough=0.26, speckle=False),
           red=m_ceramic('geo_red', (0.40, 0.13, 0.06), rough=0.32, speckle=False),
           blue=m_ceramic('geo_blue', (0.07, 0.11, 0.16), rough=0.3, speckle=False))
box('h_floor_bed', (HX1 - HX0, HY1 - HY0, 0.1), ((HX0 + HX1) / 2, (HY0 + HY1) / 2, FFL - 0.06), M['grout'], coll=HALL)
polys = {k: [] for k in GEO}
b1, b2, b3 = 0.035, 0.075, 0.035          # black line, terracotta squares, black line
X0, X1, Y0, Y1 = HX0, HX1, HY0, HY1
for (ax0, ax1, ay0, ay1) in [(X0, X1, Y0, Y0 + b1), (X0, X1, Y1 - b1, Y1), (X0, X0 + b1, Y0 + b1, Y1 - b1), (X1 - b1, X1, Y0 + b1, Y1 - b1)]:
    polys['black'] += strip_polys(ax0, ax1, ay0, ay1, 0.3)
i0, i1, j0, j1 = X0 + b1, X1 - b1, Y0 + b1, Y1 - b1
for (ax0, ax1, ay0, ay1, along) in [(i0 + b2, i1 - b2, j0, j0 + b2, 'x'), (i0 + b2, i1 - b2, j1 - b2, j1, 'x'), (i0, i0 + b2, j0 + b2, j1 - b2, 'y'), (i1 - b2, i1, j0 + b2, j1 - b2, 'y')]:
    L = (ax1 - ax0) if along == 'x' else (ay1 - ay0)
    n = max(1, round(L / b2))
    step = L / n
    for k in range(n):
        if along == 'x':
            polys['red'].append([(ax0 + k * step, ay0), (ax0 + (k + 1) * step, ay0), (ax0 + (k + 1) * step, ay1), (ax0 + k * step, ay1)])
        else:
            polys['red'].append([(ax0, ay0 + k * step), (ax1, ay0 + k * step), (ax1, ay0 + (k + 1) * step), (ax0, ay0 + (k + 1) * step)])
for (cx_, cy_) in [(i0 + b2 / 2, j0 + b2 / 2), (i1 - b2 / 2, j0 + b2 / 2), (i0 + b2 / 2, j1 - b2 / 2), (i1 - b2 / 2, j1 - b2 / 2)]:
    polys['blue'].append([(cx_ - b2 / 2, cy_ - b2 / 2), (cx_ + b2 / 2, cy_ - b2 / 2), (cx_ + b2 / 2, cy_ + b2 / 2), (cx_ - b2 / 2, cy_ + b2 / 2)])
k0, k1, l0, l1 = i0 + b2, i1 - b2, j0 + b2, j1 - b2
for (ax0, ax1, ay0, ay1) in [(k0, k1, l0, l0 + b3), (k0, k1, l1 - b3, l1), (k0, k0 + b3, l0 + b3, l1 - b3), (k1 - b3, k1, l0 + b3, l1 - b3)]:
    polys['black'] += strip_polys(ax0, ax1, ay0, ay1, 0.3)
F0, F1, G0, G1 = k0 + b3 + 0.004, k1 - b3 - 0.004, l0 + b3 + 0.004, l1 - b3 - 0.004
P = 0.12                                   # octagon width, set out from the centre of the hall
R_ = P / (2 * math.cos(math.pi / 8))
H_ = P * (1 - math.tan(math.pi / 8)) / 2   # half diagonal of the dots
ccx, ccy = (F0 + F1) / 2, (G0 + G1) / 2
ni, nj = int((F1 - F0) / P / 2) + 2, int((G1 - G0) / P / 2) + 2
for a in range(-ni, ni + 1):
    for b in range(-nj, nj + 1):
        ox, oy = ccx + a * P, ccy + b * P
        octo = [(ox + R_ * math.cos(math.pi / 8 + k * math.pi / 4), oy + R_ * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)]
        polys['cream'].append(clip_poly(octo, F0, F1, G0, G1))
        dx_, dy_ = ox + P / 2, oy + P / 2
        dot = [(dx_ + H_, dy_), (dx_, dy_ + H_), (dx_ - H_, dy_), (dx_, dy_ - H_)]
        polys['black'].append(clip_poly(dot, F0, F1, G0, G1))
for k, mat in GEO.items():
    tile_polys(f'hall_geo_{k}', polys[k], FFL, 0.012, mat, HALL)

# walls: lower half painted deep green under a dado rail, warm white above, white skirting and cornice
HGREEN = m_paint('hall_green', (0.04, 0.072, 0.058), 0.45)
SKIRT = M['white_frame']
LDOOR = (7.35, 8.2)
wall_with_holes('hw_l', HY0, HY1, FFL, HTOP, 0.1, [(LDOOR[0], LDOOR[1], FFL, 2.25)], M['plaster'], y=HX0 - 0.1, coll=HALL, axis='Y')
wall_with_holes('hw_r', HY0, HY1, FFL, HTOP, 0.1, [], M['plaster'], y=HX1, coll=HALL, axis='Y')
wall_with_holes('hwp_l', HY0, HY1, FFL, FFL + 0.92, 0.003, [(LDOOR[0], LDOOR[1], FFL, FFL + 0.92)], HGREEN, y=HX0 + 0.0005, coll=HALL, axis='Y')
wall_with_holes('hwp_r', HY0, HY1, FFL, FFL + 0.92, 0.003, [], HGREEN, y=HX1 - 0.0035, coll=HALL, axis='Y')
for side, xf, sgn in (('l', HX0, 1), ('r', HX1, -1)):
    runs = [(HY0, LDOOR[0] - 0.05), (LDOOR[1] + 0.05, HY1)] if side == 'l' else [(HY0, HY1)]
    for (ra, rb) in runs:
        box(f'dado_{side}_{ra:.2f}', (0.025, rb - ra, 0.045), (xf + sgn * 0.0125, (ra + rb) / 2, FFL + 0.92), SKIRT, bevel=0.006, segments=3, coll=HALL)
        box(f'skirt_{side}_{ra:.2f}', (0.02, rb - ra, 0.18), (xf + sgn * 0.01, (ra + rb) / 2, FFL + 0.09), SKIRT, bevel=0.003, coll=HALL)
    box(f'cornice_{side}', (0.08, HY1 - HY0, 0.08), (xf + sgn * 0.04, (HY0 + HY1) / 2, HTOP - 0.04), SKIRT, bevel=0.02, segments=3, coll=HALL)
box('h_ceiling', (HX1 - HX0 + 0.2, HY1 - HY0, 0.02), ((HX0 + HX1) / 2, (HY0 + HY1) / 2, HTOP + 0.01), M['ceiling'], coll=HALL)
box('h_rose', (0.24, 0.24, 0.02), ((HX0 + HX1) / 2, 8.1, HTOP - 0.01), SKIRT, bevel=0.01, segments=3, coll=HALL)
# panelled door to the front room, closed
DOORW = m_paint('door_white', (0.78, 0.77, 0.74), 0.35)
box('hdoor', (0.045, LDOOR[1] - LDOOR[0] - 0.02, 2.08), (HX0 - 0.05, (LDOOR[0] + LDOOR[1]) / 2, FFL + 1.04), DOORW, bevel=0.003, coll=HALL)
for (py, pz, ph) in [(-0.19, 1.45, 0.8), (0.19, 1.45, 0.8), (-0.19, 0.45, 0.62), (0.19, 0.45, 0.62)]:
    box(f'hdoor_pan_{py}_{pz}', (0.012, 0.3, ph), (HX0 - 0.024, (LDOOR[0] + LDOOR[1]) / 2 + py, FFL + pz), DOORW, bevel=0.012, segments=3, coll=HALL)
sphere('hdoor_knob', 0.028, (HX0 - 0.0, LDOOR[1] - 0.09, FFL + 1.0), M['brass'], coll=HALL)
for (sy_, sz_, y_, z_) in [(0.06, 2.12, LDOOR[0] - 0.03, FFL + 1.06), (0.06, 2.12, LDOOR[1] + 0.03, FFL + 1.06), (LDOOR[1] - LDOOR[0] + 0.12, 0.07, (LDOOR[0] + LDOOR[1]) / 2, 2.285)]:
    box(f'harch_{y_:.2f}_{z_:.2f}', (0.018, sy_, sz_), (HX0 + 0.009, y_, z_), SKIRT, bevel=0.004, coll=HALL)
# column radiator and a round brass mirror on the right wall, a framed print on the left
for k in range(20):
    box(f'rad_col{k}', (0.09, 0.024, 0.6), (HX1 - 0.065, 7.35 + k * 0.046, FFL + 0.47), SKIRT, bevel=0.008, segments=3, coll=HALL)
for z_ in (FFL + 0.2, FFL + 0.74):
    cylinder(f'rad_hdr{z_:.2f}', 0.016, 0.9, (HX1 - 0.065, 7.79, z_), SKIRT, rot=(math.pi / 2, 0, 0), coll=HALL)
MIRROR = m_metal('mirror', (0.92, 0.92, 0.92), 0.02)
cylinder('h_mirror', 0.3, 0.006, (HX1 - 0.025, 7.8, 1.72), MIRROR, rot=(0, math.pi / 2, 0), coll=HALL)
cylinder('h_mirror_rim', 0.32, 0.02, (HX1 - 0.012, 7.8, 1.72), M['brass'], rot=(0, math.pi / 2, 0), coll=HALL, bevel=0.006)
box('h_print_frame', (0.025, 0.52, 0.68), (HX0 + 0.0125, 9.0, 1.78), M['oak'], bevel=0.004, coll=HALL)
box('h_print', (0.004, 0.42, 0.58), (HX0 + 0.027, 9.0, 1.78), m_paint('print', (0.42, 0.36, 0.28), 0.8), coll=HALL)
# pendant
sphere('h_pendant', 0.12, ((HX0 + HX1) / 2, 8.1, HTOP - 0.55), FROST, coll=HALL)
sphere('h_bulb', 0.02, ((HX0 + HX1) / 2, 8.1, HTOP - 0.55), m_emission('h_filament', (1.0, 0.62, 0.3), 28.0), coll=HALL)
tube('h_flex', [((HX0 + HX1) / 2, 8.1, HTOP - 0.43), ((HX0 + HX1) / 2, 8.1, HTOP - 0.2), ((HX0 + HX1) / 2, 8.1, HTOP)], 0.003, M['black'], coll=HALL)
add_light('POINT', ((HX0 + HX1) / 2, 8.1, HTOP - 0.55), 16.0, (1, 0.72, 0.44), size=0.03, name='h_pendant_light')
fill_light('h_fill', ((HX0 + HX1) / 2, 8.1, HTOP - 0.05), 22.0, (0.9, 2.6))
# end wall with the open door into the bathroom
BDX0, BDX1 = 2.15, 2.95
wall_with_holes('h_end', 0.9, 4.4, FFL, HTOP, 0.1, [(BDX0, BDX1, FFL, 2.25)], M['plaster'], y=HY1, coll=HALL)
for (sx_, sz_, x_, z_) in [(0.06, 2.12, BDX0 - 0.03, FFL + 1.06), (0.06, 2.12, BDX1 + 0.03, FFL + 1.06), (BDX1 - BDX0 + 0.12, 0.07, (BDX0 + BDX1) / 2, 2.285)]:
    box(f'barch_{x_:.2f}_{z_:.2f}', (sx_, 0.018, sz_), (x_, HY1 - 0.009, z_), SKIRT, bevel=0.004, coll=HALL)
bdoor = empty('bdoor_hinge', (BDX1 - 0.01, HY1 + 0.12, FFL + 0.005), (0, 0, math.radians(-100)), HALL)
child(box('bdoor_leaf', (BDX1 - BDX0 - 0.02, 0.04, 2.07), (-(BDX1 - BDX0) / 2, 0.0, 1.035), DOORW, bevel=0.003, coll=HALL), bdoor)
child(box('bdoor_pan1', (0.28, 0.012, 0.8), (-0.21, 0.025, 1.45), DOORW, bevel=0.012, segments=3, coll=HALL), bdoor)
child(box('bdoor_pan2', (0.28, 0.012, 0.8), (-0.59, 0.025, 1.45), DOORW, bevel=0.012, segments=3, coll=HALL), bdoor)
child(sphere('bdoor_knob', 0.026, (-(BDX1 - BDX0) + 0.08, 0.04, 1.0), M['brass'], coll=HALL), bdoor)

# =============================================================== BATHROOM (front of the house, level access wet room)
BX0, BX1, BY0, BY1 = 1.0, 4.3, HY1 + 0.1, HF - 0.3
BTOP = 2.8
box('b_floor_bed', (BX1 - BX0, BY1 - BY0, 0.1), ((BX0 + BX1) / 2, (BY0 + BY1) / 2, FFL - 0.06), M['grout'], coll=BATH)
tile_floor('bfloor', BX0, BX1, BY0, BY1, 0.6, 0.6, 0.002, FFL, M['bath_floor'], BATH, offset_frac=0.0, lippage=0.0001, origin=(BX0, BY0))
box('b_ceiling', (BX1 - BX0, BY1 - BY0, 0.02), ((BX0 + BX1) / 2, (BY0 + BY1) / 2, BTOP + 0.01), M['ceiling'], coll=BATH)
box('b_wall_l', (0.1, BY1 - BY0, BTOP), (BX0 - 0.05, (BY0 + BY1) / 2, BTOP / 2), M['plaster'], coll=BATH)
box('b_wall_r', (0.3, BY1 - BY0, BTOP), (BX1 + 0.15, (BY0 + BY1) / 2, BTOP / 2), M['plaster'], coll=BATH)
NX0, NX1, NZ0, NZ1 = 1.15, 1.75, FFL + 1.2, FFL + 1.5


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


def slab_me(axis, w, h):
    key = ('nb' if axis == 'x' else 'ns', round(w, 4), round(h, 4))
    me = bevel_box_mesh(round(w, 4), 0.012, round(h, 4), bevel=0.001, segments=2, name='nero_slab', key=key) if axis == 'x' else \
        bevel_box_mesh(0.012, round(w, 4), round(h, 4), bevel=0.001, segments=2, name='nero_slab_side', key=key)
    if not me.materials:
        me.materials.append(M['nero'])
    return me


def place_front(prefix, ca, cz, w, h):
    instance(f'{prefix}_{ca:.2f}_{cz:.2f}', slab_me('x', w, h), (ca, BY1 - 0.006, cz), coll=BATH)


def place_back(prefix, ca, cz, w, h):
    instance(f'{prefix}_{ca:.2f}_{cz:.2f}', slab_me('x', w, h), (ca, BY0 + 0.006, cz), coll=BATH)


def place_left(prefix, ca, cz, w, h):
    instance(f'{prefix}_{ca:.2f}_{cz:.2f}', slab_me('y', w, h), (BX0 + 0.006, ca, cz), coll=BATH)


def place_right(prefix, ca, cz, w, h):
    instance(f'{prefix}_{ca:.2f}_{cz:.2f}', slab_me('y', w, h), (BX1 - 0.006, ca, cz), coll=BATH)


wall_slabs('bf', BX0 + 0.012, BX1 - 0.012, FFL, BTOP, place_front, holes=[(CX0, CX1, CZ0, CZ1), (NX0, NX1, NZ0, NZ1)],
           cols=[(BX0 + 0.012, NX0), (NX0, NX1), (NX1, CX0), (CX0, 2.55), (2.55, CX1), (CX1, 3.7), (3.7, BX1 - 0.012)])
wall_slabs('bb', BX0 + 0.012, BX1 - 0.012, FFL, BTOP, place_back, holes=[(BDX0 - 0.02, BDX1 + 0.02, FFL, 2.27)],
           cols=[(BX0 + 0.012, 1.55), (1.55, BDX0 - 0.02), (BDX0 - 0.02, BDX1 + 0.02), (BDX1 + 0.02, 3.6), (3.6, BX1 - 0.012)])
wall_slabs('bl', BY0, BY1, FFL, BTOP, place_left)
wall_slabs('br', BY0, BY1, FFL, BTOP, place_right)
# window reveal lined in the same porcelain, marble sill
for (sx_, sy_, sz_, x_, z_) in [(0.012, 0.21, CZ1 - CZ0, CX0 + 0.006, (CZ0 + CZ1) / 2), (0.012, 0.21, CZ1 - CZ0, CX1 - 0.006, (CZ0 + CZ1) / 2),
                                (CX1 - CX0, 0.21, 0.012, (CX0 + CX1) / 2, CZ1 - 0.006)]:
    box(f'brev_{x_:.2f}_{z_:.2f}', (sx_, 0.197, sz_), (x_, BY1 + 0.0865, z_), M['nero'], bevel=0.001, coll=BATH)
box('b_winsill', (CX1 - CX0 + 0.06, 0.225, 0.025), ((CX0 + CX1) / 2, BY1 + 0.0725, CZ0 - 0.0125), M['marble'], bevel=0.003, coll=BATH)
# niche lined in the same porcelain, LED strip under its head
for (sx_, sy_, sz_, x_, y_, z_) in [(NX1 - NX0, 0.1, 0.012, (NX0 + NX1) / 2, BY1 + 0.05 - 0.012, NZ0 + 0.006),
                                     (NX1 - NX0, 0.1, 0.012, (NX0 + NX1) / 2, BY1 + 0.05 - 0.012, NZ1 - 0.006),
                                     (0.012, 0.1, NZ1 - NZ0, NX0 + 0.006, BY1 + 0.05 - 0.012, (NZ0 + NZ1) / 2),
                                     (0.012, 0.1, NZ1 - NZ0, NX1 - 0.006, BY1 + 0.05 - 0.012, (NZ0 + NZ1) / 2),
                                     (NX1 - NX0, 0.012, NZ1 - NZ0, (NX0 + NX1) / 2, BY1 + 0.094, (NZ0 + NZ1) / 2)]:
    box(f'niche_{x_:.3f}_{z_:.3f}', (sx_, sy_, sz_), (x_, y_, z_), M['nero'], bevel=0.001, coll=BATH)
box('niche_led', (NX1 - NX0 - 0.03, 0.006, 0.003), ((NX0 + NX1) / 2, BY1 - 0.006, NZ1 - 0.0135), M['led'], coll=BATH)
add_light('AREA', ((NX0 + NX1) / 2, BY1 - 0.01, NZ1 - 0.016), 3.0, (1, 0.8, 0.58), size=(NX1 - NX0 - 0.04, 0.01), name='niche_light')
amber = m_glass('amber_glass', tint=(0.55, 0.25, 0.06), shadow_pass=True)
cylinder('bottle1', 0.032, 0.17, (1.38, BY1 + 0.04, NZ0 + 0.012 + 0.085), amber, coll=BATH, bevel=0.004)
cylinder('bottle1_cap', 0.012, 0.035, (1.38, BY1 + 0.04, NZ0 + 0.012 + 0.19), M['black'], coll=BATH)
cylinder('bottle2', 0.03, 0.14, (1.5, BY1 + 0.035, NZ0 + 0.012 + 0.07), m_ceramic('bottle_white', (0.80, 0.79, 0.76), 0.5, False), coll=BATH, bevel=0.004)
cylinder('bottle2_cap', 0.011, 0.03, (1.5, BY1 + 0.035, NZ0 + 0.012 + 0.155), M['black'], coll=BATH)
lathe('soap_dish', [(0, 0), (0.05, 0), (0.06, 0.012), (0.0, 0.012)], m_ceramic('dish', (0.12, 0.11, 0.1), 0.6, False), loc=(1.64, BY1 + 0.035, NZ0 + 0.012), coll=BATH)
# shower: matt black ceiling rain head, valve on the side wall, linear drain along the front wall
SHX, SHY = 1.45, BY1 - 0.5
cylinder('rain_arm', 0.012, 0.15, (SHX, SHY, BTOP - 0.075), M['black'], coll=BATH)
cylinder('rain_head', 0.15, 0.012, (SHX, SHY, BTOP - 0.155), M['black'], coll=BATH, bevel=0.003)
cylinder('valve', 0.065, 0.014, (BX0 + 0.019, SHY - 0.1, FFL + 1.05), M['black'], rot=(0, math.pi / 2, 0), coll=BATH, bevel=0.003)
box('valve_lever', (0.03, 0.012, 0.12), (BX0 + 0.04, SHY - 0.1, FFL + 1.05), M['black'], bevel=0.003, coll=BATH)
box('drain', (0.95, 0.05, 0.003), (BX0 + 0.5, BY1 - 0.1, FFL + 0.0005), M['steel'], coll=BATH)
# vanity: wall hung oak unit with a stone basin, wall tap and a round mirror
VX = BX1 - 0.012 - 0.23
VY = 10.95
box('vanity', (0.46, 0.9, 0.4), (VX, VY, FFL + 0.62), M['oak'], bevel=0.004, coll=BATH)
lathe('basin', [(0, 0), (0.15, 0), (0.19, 0.12), (0.185, 0.125), (0.14, 0.018), (0.0, 0.018)], M['ceramic'], loc=(VX - 0.02, VY, FFL + 0.82), coll=BATH)
box('tap_spout', (0.17, 0.02, 0.02), (BX1 - 0.012 - 0.085, VY, FFL + 1.1), M['black'], bevel=0.004, coll=BATH)
for dy in (-0.12, 0.12):
    cylinder(f'tap_h{dy}', 0.018, 0.04, (BX1 - 0.03, VY + dy, FFL + 1.1), M['black'], rot=(0, math.pi / 2, 0), coll=BATH, bevel=0.003)
cylinder('b_mirror', 0.3, 0.006, (BX1 - 0.03, VY, 1.68), MIRROR, rot=(0, math.pi / 2, 0), coll=BATH)
cylinder('b_mirror_rim', 0.315, 0.016, (BX1 - 0.02, VY, 1.68), M['black'], rot=(0, math.pi / 2, 0), coll=BATH, bevel=0.004)
for (dx, dy) in [(2.55, 10.45), (3.55, 11.4), (1.5, 10.5)]:
    cylinder(f'bdl_{dx}_{dy}', 0.035, 0.004, (dx, dy, BTOP - 0.003), M['downlight'], coll=BATH)
    add_light('SPOT', (dx, dy, BTOP - 0.02), 22.0, (1.0, 0.86, 0.7), size=0.025, spot=65, blend=0.8, name=f'b_spot_{dx}')
fill_light('b_fill', (2.6, 11.0, BTOP - 0.05), 30.0, (1.6, 1.4))

# =============================================================== CAMERAS
# the drone camera and its path live in fly.py, which imports this scene
