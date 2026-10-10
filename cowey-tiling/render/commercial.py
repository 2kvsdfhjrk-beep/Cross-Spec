"""Cowey Tiling: a restaurant fit-out at night.

Usage: python commercial.py <camera> <width> <height> <samples> <out.png>
"""
import sys, os, math, random, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view
from lib import *

RNG = random.Random(11)
sc = reset()
flat_world((0.004, 0.005, 0.008), 1.0)

W0, W1, D, HGT = -4.0, 4.0, 15.0, 3.4
ROOM = collection('room')

M = dict(
    floor=m_porcelain2('polished_floor', tone=(0.30, 0.29, 0.275), rough=0.07, honed=True, bump=0.3, coat=0.7),
    grout=m_paint('floor_grout', (0.06, 0.058, 0.055), 0.9),
    plaster=m_plaster('dark_plaster', (0.11, 0.045, 0.035), rough=0.85, bump=0.08),
    ceiling=m_paint('ceiling_dark', (0.03, 0.03, 0.03), 0.8),
    marble=m_marble('bar_marble', base=(0.78, 0.77, 0.74), vein=(0.32, 0.31, 0.29), rough=0.12, coat=0.4, scale=0.9, calm=True),
    oak=m_oak('oak', tone=(0.30, 0.18, 0.09), rough=0.45, along='X'),
    brass=m_metal('brass', (0.80, 0.56, 0.27), 0.25),
    black=m_paint('black', (0.015, 0.015, 0.015), 0.45),
    velvet=None,
    bulb=m_emission('filament', (1.0, 0.62, 0.3), 26.0),
    led=m_emission('led', (1.0, 0.74, 0.46), 14.0),
    frost=m_glass('frost', tint=(0.97, 0.95, 0.92), rough=0.45),
    cream=m_zellige('cream_glaze', ramp_colors=[(0.0, (0.62, 0.57, 0.47)), (0.5, (0.70, 0.65, 0.55)), (1.0, (0.76, 0.72, 0.62))], pooling=False),
    finger=m_zellige('finger_glaze', ramp_colors=[(0.0, (0.20, 0.055, 0.025)), (0.4, (0.28, 0.085, 0.038)), (0.8, (0.36, 0.12, 0.05)), (1.0, (0.42, 0.16, 0.07))], pooling=False),
)
# velvet banquette
nb = NB('velvet')
p = nb.principled((0.035, 0.07, 0.055), 0.8, spec=0.3)
p.inputs['Sheen Weight'].default_value = 1.0
p.inputs['Sheen Roughness'].default_value = 0.4
p.inputs['Sheen Tint'].default_value = (0.5, 0.7, 0.6, 1)
M['velvet'] = nb.finish(p)


def tile_rect_floor():
    joint = 0.002
    for r in range(int(D / 0.6) + 1):
        y0, y1 = r * 0.6, min(D, (r + 1) * 0.6)
        if y1 - y0 < 0.03:
            continue
        off = (r % 2) * 0.6
        x = W0 - off
        while x < W1:
            a, b = max(x, W0), min(x + 1.2, W1)
            if b - a > 0.03:
                me = bevel_box_mesh(round(b - a - joint, 4), round(y1 - y0 - joint, 4), 0.012, bevel=0.0012, segments=2, name='fl', key=('fl', round(b - a, 4), round(y1 - y0, 4)))
                if not me.materials:
                    me.materials.append(M['floor'])
                instance(f'fl_{r}_{x:.2f}', me, ((a + b) / 2, (y0 + y1) / 2, -0.006 + RNG.uniform(-0.0002, 0.0002)), coll=ROOM)
            x += 1.2


tile_rect_floor()
box('floor_bed', (W1 - W0, D, 0.02), (0, D / 2, -0.012), M['grout'], coll=ROOM)
# walls and ceiling
box('wall_left', (0.1, D, HGT), (W0 - 0.05, D / 2, HGT / 2), M['plaster'], coll=ROOM)
box('wall_right', (0.1, D, HGT), (W1 + 0.05, D / 2, HGT / 2), M['plaster'], coll=ROOM)
box('ceiling', (W1 - W0, D, 0.1), (0, D / 2, HGT + 0.05), M['ceiling'], coll=ROOM)
box('wall_back', (W1 - W0, 0.1, HGT), (0, -0.05, HGT / 2), M['plaster'], coll=ROOM)

# --- the bar: fluted terracotta finger tiles, marble top, brass foot rail
BX0, BX1, BY0, BY1, BH = -2.75, -2.1, 2.2, 10.2, 1.08
box('bar_core', (BX1 - BX0, BY1 - BY0, BH - 0.04), ((BX0 + BX1) / 2, (BY0 + BY1) / 2, (BH - 0.04) / 2), M['black'], coll=ROOM)
fing = []
for vi in range(4):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 0.014
        v.co.y *= 0.0275
        v.co.z *= 0.296
    me = bpy.data.meshes.new(f'finger_{vi}')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('_tmp', me)
    bpy.context.scene.collection.objects.link(o)
    m = o.modifiers.new('bv', 'BEVEL')
    m.width = 0.006
    m.segments = 4
    m.harden_normals = True
    for pl in me.polygons:
        pl.use_smooth = True
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    bpy.data.objects.remove(o)
    me2.materials.append(M['finger'])
    box_uv(me2)
    fing.append(me2)
n_cols = int((BY1 - BY0) / 0.0285)
for i in range(n_cols):
    for j in range(3):
        instance(f'fg_{i}_{j}', RNG.choice(fing), (BX1 + 0.008, BY0 + 0.015 + i * 0.0285, 0.06 + 0.15 + j * 0.3 + RNG.uniform(-0.0005, 0.0005)),
                 rot=(0, RNG.uniform(-0.01, 0.01), RNG.uniform(-0.01, 0.01)), coll=ROOM)
box('bar_plinth', (0.05, BY1 - BY0, 0.06), (BX1 - 0.01, (BY0 + BY1) / 2, 0.03), M['black'], coll=ROOM)
box('bar_top', (0.82, BY1 - BY0 + 0.1, 0.04), ((BX0 + BX1) / 2 + 0.06, (BY0 + BY1) / 2, BH + 0.02), M['marble'], bevel=0.004, coll=ROOM)
tube('foot_rail', [(BX1 + 0.18, BY0 + 0.1, 0.22), (BX1 + 0.18, (BY0 + BY1) / 2, 0.22), (BX1 + 0.18, BY1 - 0.1, 0.22)], 0.022, M['brass'], coll=ROOM)
for k in range(8):
    y = BY0 + 0.3 + k * (BY1 - BY0 - 0.6) / 7
    cylinder(f'rail_post{k}', 0.01, 0.2, (BX1 + 0.11, y, 0.22), M['brass'], rot=(0, math.pi / 2, 0), coll=ROOM)
box('bar_led', (0.004, BY1 - BY0 - 0.1, 0.004), (BX1 + 0.05, (BY0 + BY1) / 2, BH - 0.005), M['led'], coll=ROOM)
add_light('AREA', (BX1 + 0.06, (BY0 + BY1) / 2, BH - 0.01), 60.0, (1, 0.72, 0.45), size=(0.02, BY1 - BY0 - 0.2), name='bar_under')
# stools
for k in range(7):
    y = BY0 + 0.6 + k * 1.1
    e_ = bpy.data.objects.new(f'stool{k}', None)
    link(e_, ROOM)
    e_.location = (BX1 + 0.55, y, 0)
    e_.rotation_euler = Euler((0, 0, RNG.uniform(-0.3, 0.3)))
    st = cylinder(f'stool_seat{k}', 0.2, 0.05, (0, 0, 0.76), M['velvet'], coll=ROOM, bevel=0.015)
    st.parent = e_
    for a in range(4):
        ang = a * math.pi / 2 + math.pi / 4
        lg = box(f'stool_leg{k}{a}', (0.02, 0.02, 0.74), (0.15 * math.cos(ang), 0.15 * math.sin(ang), 0.37), M['black'], bevel=0.003, coll=ROOM)
        lg.parent = e_
        lg.rotation_euler = Euler((0.14 * math.sin(ang), -0.14 * math.cos(ang), 0))
    rg = box(f'stool_ring{k}', (0.27, 0.27, 0.012), (0, 0, 0.3), M['brass'], coll=ROOM)
    rg.parent = e_

# --- back bar: cream glazed tiles, oak shelves, backlit bottles
BBX = W0 + 0.02
box('backbar_counter', (0.55, BY1 - BY0, 0.9), (W0 + 0.3, (BY0 + BY1) / 2, 0.45), M['oak'], bevel=0.003, coll=ROOM)
box('backbar_top', (0.6, BY1 - BY0, 0.03), (W0 + 0.3, (BY0 + BY1) / 2, 0.915), M['marble'], bevel=0.003, coll=ROOM)
cream = []
for vi in range(4):
    me = bevel_box_mesh(0.009, 0.0725, 0.2925, bevel=0.0025, segments=3, name=f'cream_{vi}', key=('cream', vi))
    me.materials.append(M['cream'])
    cream.append(me)
for i in range(int((BY1 - BY0) / 0.075)):
    for j in range(int((HGT - 0.95) / 0.3)):
        instance(f'ct_{i}_{j}', RNG.choice(cream), (W0 + 0.005, BY0 + 0.0375 + i * 0.075, 0.95 + 0.15 + j * 0.3), coll=ROOM)
GLASS = [m_glass(f'bottle_{k}', tint=t) for k, t in enumerate([(0.30, 0.42, 0.20), (0.55, 0.28, 0.08), (0.85, 0.85, 0.82), (0.15, 0.2, 0.25), (0.6, 0.45, 0.2)])]
LIQ = [m_glass(f'liquid_{k}', tint=t) for k, t in enumerate([(0.75, 0.42, 0.12), (0.85, 0.75, 0.5), (0.4, 0.12, 0.08)])]
for s_, z in enumerate((1.45, 1.95, 2.45)):
    box(f'shelf{s_}', (0.26, BY1 - BY0 - 0.4, 0.035), (W0 + 0.14, (BY0 + BY1) / 2, z), M['oak'], bevel=0.003, coll=ROOM)
    box(f'shelf_led{s_}', (0.006, BY1 - BY0 - 0.5, 0.004), (W0 + 0.24, (BY0 + BY1) / 2, z - 0.02), M['led'], coll=ROOM)
    add_light('AREA', (W0 + 0.2, (BY0 + BY1) / 2, z - 0.025), 22.0, (1, 0.74, 0.46), size=(0.02, BY1 - BY0 - 0.6), name=f'shelf_light{s_}')
    y = BY0 + 0.4
    while y < BY1 - 0.4:
        h = RNG.choice([0.24, 0.28, 0.3, 0.33])
        r_ = RNG.choice([0.035, 0.04, 0.045])
        prof = [(0, 0), (r_, 0), (r_, h * 0.68), (r_ * 0.45, h * 0.8), (0.013, h * 0.86), (0.013, h), (0, h)]
        lathe(f'bt_{s_}_{y:.2f}', prof, RNG.choice(GLASS), loc=(W0 + 0.15 + RNG.uniform(-0.03, 0.03), y, z + 0.0175), segments=28, coll=ROOM)
        y += r_ * 2 + RNG.uniform(0.02, 0.06)

# --- pendants over the bar
PEND = []
for k in range(6):
    y = BY0 + 0.6 + k * (BY1 - BY0 - 1.2) / 5
    px, pz = (BX0 + BX1) / 2 + 0.05, 2.25
    sphere(f'pend{k}', 0.13, (px, y, pz), M['frost'], coll=ROOM)
    sphere(f'pend_bulb{k}', 0.022, (px, y, pz), M['bulb'], coll=ROOM)
    tube(f'pend_flex{k}', [(px, y, pz + 0.12), (px, y, (pz + HGT) / 2), (px, y, HGT)], 0.003, M['black'], coll=ROOM)
    add_light('POINT', (px, y, pz), 16.0, (1, 0.7, 0.42), size=0.03, name=f'pend_light{k}')
    PEND.append((px, y, pz))

# --- banquette along the right wall with marble tables
box('banquette_seat', (0.55, 9.0, 0.45), (W1 - 0.3, 6.5, 0.225), M['velvet'], bevel=0.03, segments=4, coll=ROOM)
for k in range(9):
    box(f'banquette_back{k}', (0.16, 0.96, 0.62), (W1 - 0.1, 2.5 + k * 1.0, 0.76), M['velvet'], bevel=0.05, segments=5, coll=ROOM)
for k in range(4):
    ty = 3.0 + k * 2.2
    cylinder(f'tbl_top{k}', 0.36, 0.03, (W1 - 1.0, ty, 0.74), M['marble'], coll=ROOM, bevel=0.004)
    cylinder(f'tbl_col{k}', 0.035, 0.7, (W1 - 1.0, ty, 0.375), M['black'], coll=ROOM)
    cylinder(f'tbl_foot{k}', 0.24, 0.02, (W1 - 1.0, ty, 0.01), M['black'], coll=ROOM, bevel=0.004)
    cylinder(f'candle{k}', 0.03, 0.06, (W1 - 0.95, ty + 0.05, 0.785), m_glass(f'votive{k}', tint=(0.9, 0.8, 0.6)), coll=ROOM)
    sphere(f'flame{k}', 0.006, (W1 - 0.95, ty + 0.05, 0.79), m_emission(f'flame{k}', (1.0, 0.55, 0.2), 40.0), coll=ROOM, scale=(1, 1, 1.8))
    add_light('POINT', (W1 - 0.95, ty + 0.05, 0.8), 0.6, (1, 0.6, 0.3), size=0.01, name=f'candle_light{k}')
    for s_ in (-1, 1):
        ch = box(f'chair{k}{s_}', (0.42, 0.42, 0.05), (W1 - 1.45, ty + s_ * 0.45, 0.46), M['oak'], bevel=0.01, coll=ROOM)
        box(f'chairback{k}{s_}', (0.04, 0.42, 0.35), (W1 - 1.66, ty + s_ * 0.45, 0.7), M['oak'], bevel=0.01, coll=ROOM)
        for a in range(4):
            box(f'chairleg{k}{s_}{a}', (0.025, 0.025, 0.44), (W1 - 1.45 + (0.17 if a % 2 else -0.17), ty + s_ * 0.45 + (0.17 if a > 1 else -0.17), 0.22), M['black'], bevel=0.003, coll=ROOM)
# wall sconces over the banquette
for k in range(5):
    y = 2.2 + k * 2.2
    cylinder(f'sconce{k}', 0.08, 0.12, (W1 - 0.06, y, 1.9), M['brass'], rot=(0, math.pi / 2, 0), coll=ROOM, bevel=0.003)
    sphere(f'sconce_glow{k}', 0.05, (W1 - 0.14, y, 1.9), M['frost'], coll=ROOM)
    add_light('POINT', (W1 - 0.16, y, 1.9), 7.0, (1, 0.7, 0.42), size=0.03, name=f'sconce_light{k}')

# --- shopfront at the far end: night street beyond
box('front_glass', (W1 - W0, 0.02, HGT - 0.4), (0, D, 0.2 + (HGT - 0.4) / 2), m_glass('shop_glass', tint=(0.92, 0.95, 0.95)), coll=ROOM)
for i in range(5):
    box(f'mullion{i}', (0.06, 0.08, HGT), (W0 + i * 2.0, D, HGT / 2), M['black'], coll=ROOM)
box('transom', (W1 - W0, 0.08, 0.08), (0, D, 2.6), M['black'], coll=ROOM)
# night street outside the shopfront: pavement, road, a lit terrace opposite and street lamps
plane('pavement', 30, 3.5, (0, D + 1.8, 0.0), m_porcelain2('pavement', tone=(0.12, 0.115, 0.11), rough=0.55), coll=ROOM)
plane('road', 40, 9, (0, D + 8.0, -0.12), m_paint('asphalt', (0.02, 0.02, 0.021), 0.6), coll=ROOM)
# the terrace opposite: dim brick lit by the street lamps, a scatter of lit windows, shopfronts below
nb = NB('terrace_opposite')
tc = nb.n('ShaderNodeTexCoord')
sep = nb.n('ShaderNodeSeparateXYZ')
nb.l(tc.outputs['Object'], sep.inputs[0])
comb = nb.n('ShaderNodeCombineXYZ')
nb.l(sep.outputs['X'], comb.inputs['X'])
nb.l(sep.outputs['Y'], comb.inputs['Y'])
grid = nb.n('ShaderNodeTexBrick', offset=0.0, offset_frequency=1, squash=1.0, squash_frequency=1)
nb.l(comb.outputs[0], grid.inputs['Vector'])
grid.inputs['Color1'].default_value = (1, 1, 1, 1)
grid.inputs['Color2'].default_value = (0, 0, 0, 1)
grid.inputs['Mortar'].default_value = (0, 0, 0, 1)
grid.inputs['Mortar Size'].default_value = 1.0
grid.inputs['Mortar Smooth'].default_value = 0.0
grid.inputs['Brick Width'].default_value = 3.4
grid.inputs['Row Height'].default_value = 3.1
rv = nb.n('ShaderNodeRGBToBW')
nb.l(grid.outputs['Color'], rv.inputs['Color'])
window = nb.math('SUBTRACT', 1.0, grid.outputs['Fac'])
lit = nb.math('MULTIPLY', nb.math('GREATER_THAN', rv.outputs['Val'], 0.58), window)
wincol = nb.ramp(rv.outputs['Val'], [(0.58, (1.0, 0.66, 0.36)), (0.8, (1.0, 0.8, 0.58)), (1.0, (0.85, 0.88, 1.0))]).outputs['Color']
em = nb.n('ShaderNodeEmission')
nb.l(wincol, em.inputs['Color'])
em.inputs['Strength'].default_value = 1.4
facade_col = nb.mixc(window, (0.10, 0.06, 0.04), (0.01, 0.012, 0.016))
facade = nb.principled(facade_col, 0.6, spec=0.4)
mix = nb.n('ShaderNodeMixShader')
nb.l(lit, mix.inputs['Fac'])
nb.l(facade.outputs[0], mix.inputs[1])
nb.l(em.outputs[0], mix.inputs[2])
terrace = nb.finish(mix)
plane('terrace', 40, 14, (0, D + 13.0, 7.0), terrace, rot=(math.pi / 2, 0, 0), coll=ROOM)
for k in range(6):
    sx_ = -12 + k * 5.0
    box(f'shopfront{k}', (3.8, 0.05, 2.6), (sx_, D + 12.9, 1.4), m_emission(f'shop{k}', (1.0, 0.78 - 0.05 * (k % 3), 0.55), 0.22 + 0.12 * (k % 2)), coll=ROOM)
nb = NB('dusk_sky')
tc = nb.n('ShaderNodeTexCoord')
sep = nb.n('ShaderNodeSeparateXYZ')
nb.l(tc.outputs['Generated'], sep.inputs[0])
g = nb.ramp(sep.outputs['Y'], [(0.0, (0.05, 0.05, 0.09)), (0.5, (0.02, 0.03, 0.08)), (1.0, (0.005, 0.008, 0.03))])
em = nb.n('ShaderNodeEmission')
nb.l(g.outputs['Color'], em.inputs['Color'])
em.inputs['Strength'].default_value = 1.0
plane('sky', 80, 40, (0, D + 30.0, 20.0), nb.finish(em), rot=(math.pi / 2, 0, 0), coll=ROOM)
for k, lx in enumerate((-3.5, 4.5)):
    cylinder(f'lamp_pole{k}', 0.06, 5.0, (lx, D + 3.2, 2.5), M['black'], coll=ROOM)
    sphere(f'lamp_head{k}', 0.16, (lx, D + 3.2, 5.0), m_emission(f'lamp{k}', (1.0, 0.78, 0.5), 25.0), coll=ROOM)
    add_light('POINT', (lx, D + 3.2, 4.9), 900.0, (1.0, 0.75, 0.48), size=0.15, name=f'street_lamp{k}')

# ceiling: dark with a few spots washing the bar front
for k in range(5):
    y = 3.0 + k * 1.7
    cylinder(f'cspot{k}', 0.03, 0.004, (BX1 + 0.5, y, HGT - 0.003), m_emission('cs', (1, 0.82, 0.62), 30.0), coll=ROOM)
    s = add_light('SPOT', (BX1 + 0.5, y, HGT - 0.02), 18.0, (1, 0.8, 0.58), size=0.02, spot=36, blend=0.6, name=f'cspot_l{k}')
    aim(s, (BX1 + 0.02, y, 0.55))

CAMS = {
    'commercial': dict(loc=(0.55, 0.45, 1.32), yaw=4.0, lens=24, shift=(0.0, 0.02), fstop=2.8, focus=4.5),
    'commercial_p': dict(loc=(0.45, 0.45, 1.32), yaw=9.0, lens=21, shift=(0.0, 0.0), fstop=2.8, focus=4.5, fit='VERTICAL'),
}
cams = {k: camera(f'cam_{k}', c['loc'], lens=c['lens'], pitch=90, yaw=c['yaw'], shift=c['shift'], fstop=c['fstop'], focus=c['focus'], fit=c.get('fit', 'HORIZONTAL')) for k, c in CAMS.items()}

if __name__ == '__main__':
    which, Wd, Ht, S, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
    render_settings(Wd, Ht, samples=S, exposure=float(os.environ.get('EXPO', '0.5')), look='AgX - Medium High Contrast')
    bpy.context.view_layer.update()
    cam = cams[which]
    pts = {}
    for k, pnt in enumerate(PEND):
        v = world_to_camera_view(sc, cam, Vector(pnt))
        pts[f'pendant_{k}'] = [round(v.x, 4), round(1 - v.y, 4), round(v.z, 3)]
    pts['_dims'] = [Wd, Ht]
    json.dump(pts, open(out.replace('.png', '.json'), 'w'))
    render(out, cam)
