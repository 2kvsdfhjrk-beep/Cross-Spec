"""Cowey Tiling: the street in front of the house and the coffee shop across the road.

Imported after house.py (same Blender scene): front gardens, pavements, road, the terrace opposite,
and a coffee shop being fitted out, whose floor is laid as the drone flies in (CAFE_TILES).
"""
import math, random
import bpy, bmesh
from mathutils import Vector, Euler
from lib import *
import house as H
from house import M, box, cylinder, sphere, lathe, tube, plane, instance, empty, child, add_light, wall_with_holes, \
    bevel_box_mesh, collection, m_paint, m_glass, m_emission, m_ceramic, m_fabric, m_metal, m_marble, m_plaster, m_oak, FFL

RNG = random.Random(23)
STREET = collection('street')
CAFE = collection('cafe')
HF = H.HF


def m_tilegrid(name, color, w, h, grout=(0.33, 0.32, 0.30), rough=0.12, var=0.08, offset=0.0, mortar=0.004):
    """Glazed tiles as a texture: per tile tone, recessed grout lines, glossy coat."""
    nb = NB(name)
    tc = nb.n('ShaderNodeTexCoord')
    br = nb.n('ShaderNodeTexBrick', offset=offset, offset_frequency=2, squash=1.0, squash_frequency=2)
    nb.l(tc.outputs['Object'], br.inputs['Vector'])
    br.inputs['Color1'].default_value = (*[c * (1 - var) for c in color], 1)
    br.inputs['Color2'].default_value = (*[c * (1 + var * 0.5) for c in color], 1)
    br.inputs['Mortar'].default_value = (*grout, 1)
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = mortar
    br.inputs['Mortar Smooth'].default_value = 0.4
    br.inputs['Bias'].default_value = 0.0
    br.inputs['Brick Width'].default_value = w
    br.inputs['Row Height'].default_value = h
    n = nb.noise(tc.outputs['Object'], 40, 4, 0.5)
    nrm = nb.bump(nb.math('ADD', nb.math('SUBTRACT', 1.0, br.outputs['Fac']), nb.math('MULTIPLY', n.outputs['Fac'], 0.15)), 0.6, 0.003)
    return nb.finish(nb.principled(br.outputs['Color'], rough, spec=0.5, normal=nrm, coat=0.3))


def m_flags(name, tone, w, h, rough=0.82):
    """Concrete paving flags: per flag shade, joints, weathered speckle."""
    nb = NB(name)
    tc = nb.n('ShaderNodeTexCoord')
    br = nb.n('ShaderNodeTexBrick', offset=0.0, offset_frequency=2, squash=1.0, squash_frequency=2)
    nb.l(tc.outputs['Object'], br.inputs['Vector'])
    br.inputs['Color1'].default_value = (*[c * 0.86 for c in tone], 1)
    br.inputs['Color2'].default_value = (*[c * 1.08 for c in tone], 1)
    br.inputs['Mortar'].default_value = (*[c * 0.55 for c in tone], 1)
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = 0.005
    br.inputs['Mortar Smooth'].default_value = 0.3
    br.inputs['Brick Width'].default_value = w
    br.inputs['Row Height'].default_value = h
    n1 = nb.noise(tc.outputs['Object'], 3.5, 6, 0.6)
    n2 = nb.noise(tc.outputs['Object'], 220, 3, 0.6)
    mott = nb.maprange(n1.outputs['Fac'], 0.3, 0.7, 0.82, 1.1)
    m = nb.n('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    nb.i(m, 'Factor_Float').default_value = 1.0
    nb.l(br.outputs['Color'], nb.i(m, 'A_Color'))
    nb.l(mott, nb.i(m, 'B_Color'))
    nrm = nb.bump(nb.math('ADD', nb.math('SUBTRACT', 1.0, br.outputs['Fac']), nb.math('MULTIPLY', n2.outputs['Fac'], 0.25)), 0.5, 0.004)
    return nb.finish(nb.principled(nb.o(m, 'Result_Color'), rough, spec=0.35, normal=nrm))


def m_asphalt(name='asphalt'):
    nb = NB(name)
    v = nb.coords('Object')
    fine = nb.noise(v, 480, 2, 0.6)
    patch = nb.noise(v, 0.6, 6, 0.6)
    col = nb.ramp(fine.outputs['Fac'], [(0.35, (0.030, 0.030, 0.031)), (0.62, (0.060, 0.059, 0.057)), (0.78, (0.095, 0.092, 0.088))]).outputs['Color']
    m = nb.n('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    nb.i(m, 'Factor_Float').default_value = 1.0
    nb.l(col, nb.i(m, 'A_Color'))
    nb.l(nb.maprange(patch.outputs['Fac'], 0.3, 0.7, 0.85, 1.15), nb.i(m, 'B_Color'))
    nrm = nb.bump(fine.outputs['Fac'], 0.35, 0.002)
    return nb.finish(nb.principled(nb.o(m, 'Result_Color'), 0.86, spec=0.4, normal=nrm))


S = dict(
    flags=m_flags('pavement_flags', (0.33, 0.325, 0.31), 0.6, 0.6),
    asphalt=m_asphalt(),
    kerb=m_porcelain_stone('granite_kerb', tone=(0.30, 0.30, 0.30), rough=0.7, scale=3.0),
    gravel=m_plaster('gravel', (0.42, 0.39, 0.34), rough=0.95, bump=0.9),
    hedge=None,
    shop=m_paint('shop_green', (0.020, 0.055, 0.042), 0.3),
    gold=m_metal('gold_leaf', (0.83, 0.62, 0.30), 0.22),
    bmarble=m_marble('nero_marquina', base=(0.025, 0.025, 0.027), vein=(0.55, 0.54, 0.52), rough=0.12, coat=0.4, scale=1.3),
    wmarble=m_marble('carrara_floor', base=(0.80, 0.79, 0.77), vein=(0.42, 0.41, 0.40), rough=0.12, coat=0.4, scale=1.1),
    metro=m_tilegrid('metro_white', (0.80, 0.79, 0.75), 0.15, 0.075, offset=0.5, rough=0.08),
    risers=m_tilegrid('riser_green', (0.035, 0.12, 0.085), 0.075, 0.15, rough=0.08, var=0.2),
    screed=m_plaster('screed', (0.43, 0.42, 0.40), rough=0.85, bump=0.08),
    steel=m_metal('espresso_steel', (0.78, 0.78, 0.77), 0.16),
    enamel=m_paint('enamel_green', (0.02, 0.06, 0.045), 0.25),
    velvet=m_fabric('banquette_velvet', (0.30, 0.13, 0.06), sheen=0.8, rough=0.7),
    leaf=None,
)
nbl = NB('box_leaves')
vv = nbl.coords('Object')
nz = nbl.noise(vv, 38, 6, 0.65)
lc = nbl.ramp(nz.outputs['Fac'], [(0.35, (0.018, 0.04, 0.012)), (0.65, (0.05, 0.10, 0.03))]).outputs['Color']
S['leaf'] = nbl.finish(nbl.principled(lc, 0.55, spec=0.4, normal=nbl.bump(nz.outputs['Fac'], 0.9, 0.02), sss=0.15))

# ------------------------------------------------------------------ street levels (y runs across the street)
PAV0, PAV1 = 14.5, 16.5          # pavement on our side
KERB1 = 16.65
ROAD1 = 23.35                    # far edge of the road
OPAV0, OPAV1 = 23.5, 25.5        # pavement opposite
OF = 27.6                        # face of the terrace opposite
X0, X1 = -48.0, 48.0
ROADZ = -0.12

box('pavement_ours', (X1 - X0, PAV1 - PAV0, 0.1), (0, (PAV0 + PAV1) / 2, -0.05), S['flags'], coll=STREET)
box('kerb_ours', (X1 - X0, 0.15, 0.25), (0, KERB1 - 0.075, -0.125 + 0.0), S['kerb'], bevel=0.01, coll=STREET)
box('road', (X1 - X0, ROAD1 - KERB1, 0.1), (0, (KERB1 + ROAD1) / 2, ROADZ - 0.05), S['asphalt'], coll=STREET)
box('kerb_opp', (X1 - X0, 0.15, 0.25), (0, ROAD1 + 0.075, -0.125), S['kerb'], bevel=0.01, coll=STREET)
box('pavement_opp', (X1 - X0, OPAV1 - OPAV0, 0.1), (0, (OPAV0 + OPAV1) / 2, -0.05), S['flags'], coll=STREET)
# gullies along the kerbs
for gx in (-14.0, 9.0, 31.0):
    for gy in (KERB1 + 0.25, ROAD1 - 0.25):
        box(f'gully_{gx}_{gy}', (0.45, 0.3, 0.01), (gx, gy, ROADZ + 0.002), M['black'], coll=STREET)
# front gardens on both sides: gravel, low brick walls with stone copings, tiled paths to the doors
box('fg_ours', (X1 - X0, PAV0 - HF, 0.06), (0, (HF + PAV0) / 2, -0.03), S['gravel'], coll=STREET)
box('fg_opp', (X1 - X0, OF - OPAV1, 0.06), (0, (OPAV1 + OF) / 2, -0.03), S['gravel'], coll=STREET)


def garden_wall(tag, x0, x1, y, gaps):
    merged = []
    for a, b in sorted(gaps):
        if merged and a <= merged[-1][1] + 0.3:
            merged[-1] = (merged[-1][0], max(merged[-1][1], b))
        else:
            merged.append((a, b))
    xs = [x0] + [g for gap in merged for g in gap] + [x1]
    for i in range(0, len(xs), 2):
        a, b = xs[i], xs[i + 1]
        if b - a < 0.05:
            continue
        box(f'{tag}_{a:.1f}', (b - a, 0.22, 0.72), ((a + b) / 2, y, 0.36), M['brick'] if RNG.random() < 0.6 else H.BRICK_RED, coll=STREET)
        box(f'{tag}_cope_{a:.1f}', (b - a, 0.28, 0.07), ((a + b) / 2, y, 0.755), M['coping'], bevel=0.004, coll=STREET)
        for px in (a + 0.2, b - 0.2):
            box(f'{tag}_pier_{px:.1f}', (0.4, 0.34, 0.95), (px, y, 0.475), M['brick'], coll=STREET)
            box(f'{tag}_piercap_{px:.1f}', (0.46, 0.4, 0.06), (px, y, 0.98), M['coping'], bevel=0.004, coll=STREET)


# doors along our side (house.py NEIGH) and the terrace opposite
our_doors = [-0.05]
for i, (a, b, wide) in enumerate(H.NEIGH):
    our_doors.append((a + b) / 2 if wide else (a + 0.95 if i % 2 == 0 else b - 0.95))
garden_wall('fw_ours', X0, X1, PAV0 - 0.11, sorted([(d - 0.55, d + 0.55) for d in our_doors]))
# our own path: black and white chequer laid on the diagonal
CHK = [m_ceramic('path_w', (0.70, 0.67, 0.60), 0.32, False), m_ceramic('path_b', (0.025, 0.025, 0.027), 0.28, False)]
pp = {0: [], 1: []}
px0, px1, py0, py1 = -0.6, 0.5, HF + 0.3, PAV0 - 0.22
for a in range(-12, 13):
    for b in range(-30, 31):
        cx, cy = -0.05 + a * 0.1, (py0 + py1) / 2 + b * 0.1
        sq = [(cx, cy - 0.05), (cx + 0.05, cy), (cx, cy + 0.05), (cx - 0.05, cy)]
        pp[(a + b) % 2].append(H.clip_poly(sq, px0, px1, py0, py1))
for k in (0, 1):
    H.tile_polys(f'path_tiles_{k}', pp[k], 0.012, 0.012, CHK[k], STREET)
box('path_bed', (px1 - px0, py1 - py0, 0.012), ((px0 + px1) / 2, (py0 + py1) / 2, -0.004), M['grout'], coll=STREET)
for edge in (px0 - 0.03, px1 + 0.03):
    box(f'path_edge_{edge:.2f}', (0.05, py1 - py0, 0.06), (edge, (py0 + py1) / 2, 0.01), H.BRICK_RED, coll=STREET)
# clipped box balls in the front garden
for (bx_, by_, r_) in [(-1.6, 13.4, 0.32), (1.4, 13.6, 0.26), (3.9, 13.3, 0.3)]:
    sphere(f'boxball_{bx_}', r_, (bx_, by_, r_ * 0.85), S['leaf'], coll=STREET, scale=(1, 1, 0.9))
# wheelie bins in a couple of front gardens
BIN = m_paint('bin_grey', (0.07, 0.075, 0.075), 0.5)
for (bx_, by_) in [(-6.2, 13.1), (-5.5, 13.1), (16.2, 13.2)]:
    box(f'bin_{bx_}', (0.58, 0.72, 1.0), (bx_, by_, 0.52), BIN, bevel=0.02, segments=3, coll=STREET)
    box(f'binlid_{bx_}', (0.6, 0.76, 0.05), (bx_, by_ - 0.01, 1.04), BIN, bevel=0.015, segments=3, coll=STREET)

# ------------------------------------------------------------------ the terrace opposite
OPP = []
x = -42.0
i = 0
while x < 42.0:
    OPP.append((x, x + 5.6, i))
    x += 5.6
    i += 1
CAFE_X0, CAFE_X1 = 8.4, 14.0
opp_doors = []
for (a, b, i) in OPP:
    if abs(a - CAFE_X0) < 0.01:
        continue
    mat = H.BRICK_RED if i % 3 else M['brick']
    H.house_front(f'of{i}', a, b, OF, -1, mat, STREET, door_left=(i % 2 == 1), door_col=H.DOORS[(i + 2) % len(H.DOORS)],
                  lit=('u0',) if i % 4 == 0 else (('g0',) if i % 5 == 2 else ()), curtain=H.CURTAIN if i % 2 else H.CURTAIN2)
    opp_doors.append(a + 0.95 if i % 2 == 1 else b - 0.95)
gaps = sorted([(d - 0.55, d + 0.55) for d in opp_doors] + [(CAFE_X0 - 0.1, CAFE_X1 + 0.1)])
garden_wall('fw_opp', X0, X1, OPAV1 + 0.11, gaps)
box('cafe_forecourt', (CAFE_X1 - CAFE_X0 + 0.2, OF - OPAV1, 0.1), ((CAFE_X0 + CAFE_X1) / 2, (OPAV1 + OF) / 2, -0.046), S['flags'], coll=STREET)
H.terrace_roof('opp_row', -42.0, 42.0, OF, OF + 6.3, STREET, chimneys=[a for (a, b, i) in OPP[1:]][::2])
box('opp_rear', (84.0, 0.3, H.EAVE), (0, OF + 6.45, H.EAVE / 2), M['brick'], coll=STREET)
# Victorian street lamps (not yet lit)
LAMP = m_paint('lamp_black', (0.02, 0.022, 0.022), 0.4)
for (lx, ly) in [(-16.0, PAV1 - 0.35), (6.0, PAV1 - 0.35), (28.0, PAV1 - 0.35), (-6.0, OPAV0 + 0.35), (18.0, OPAV0 + 0.35), (40.0, OPAV0 + 0.35)]:
    cylinder(f'lamp_base_{lx}', 0.13, 0.6, (lx, ly, 0.3), LAMP, coll=STREET, bevel=0.02)
    cylinder(f'lamp_pole_{lx}', 0.055, 3.6, (lx, ly, 2.4), LAMP, coll=STREET)
    box(f'lamp_cross_{lx}', (0.5, 0.04, 0.04), (lx, ly, 3.9), LAMP, coll=STREET)
    box(f'lamp_box_{lx}', (0.32, 0.32, 0.5), (lx, ly, 4.45), M['glass'], coll=STREET)
    lathe(f'lamp_cap_{lx}', [(0, 0), (0.24, 0), (0.06, 0.18), (0.0, 0.22)], LAMP, loc=(lx, ly, 4.7), coll=STREET)
    box(f'lamp_bottom_{lx}', (0.22, 0.22, 0.05), (lx, ly, 4.18), LAMP, coll=STREET)

# ------------------------------------------------------------------ the coffee shop
CW0, CW1 = CAFE_X0 + 0.3, CAFE_X1 - 0.3     # inside faces of the party walls
CD0, CD1 = OF + 0.15, OF + 6.0              # inside the shopfront to the back wall
CTOP = 3.2
DX0_, DX1_ = 10.6, 11.8                     # entrance
# upper floor facade over the shop
wall_with_holes('cafe_upper', CAFE_X0, CAFE_X1, 3.95, H.EAVE, 0.3, [(c - 0.6, c + 0.6, 4.25, 5.6) for c in (CAFE_X0 + 1.5, CAFE_X1 - 1.5)], M['brick'], y=OF, coll=CAFE)
for k, c in enumerate((CAFE_X0 + 1.5, CAFE_X1 - 1.5)):
    H.sash(f'cafe_uw{k}', c, OF, 4.25, 5.6, 1.2, -1, coll=CAFE, lit=(k == 0))
# shopfront: pilasters, fascia with gilded lettering, cornice, tiled stall risers, glazing, open door
for px in (CAFE_X0 + 0.15, CAFE_X1 - 0.15):
    box(f'cafe_pil_{px}', (0.3, 0.2, 3.3), (px, OF - 0.1, 1.65), S['shop'], bevel=0.01, coll=CAFE)
    box(f'cafe_cons_{px}', (0.34, 0.3, 0.5), (px, OF - 0.15, 3.55), S['shop'], bevel=0.02, segments=3, coll=CAFE)
box('cafe_fascia', (CAFE_X1 - CAFE_X0 - 0.6, 0.12, 0.55), ((CAFE_X0 + CAFE_X1) / 2, OF - 0.06, 3.55), S['shop'], bevel=0.01, coll=CAFE)
box('cafe_cornice', (CAFE_X1 - CAFE_X0 + 0.1, 0.36, 0.1), ((CAFE_X0 + CAFE_X1) / 2, OF - 0.12, 3.88), S['shop'], bevel=0.02, segments=3, coll=CAFE)
try:
    font = bpy.data.fonts.load('/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf')
except Exception:
    font = None
cu = bpy.data.curves.new('cafe_sign', 'FONT')
cu.body = 'C O F F E E'
if font:
    cu.font = font
cu.size = 0.3
cu.extrude = 0.006
cu.align_x = 'CENTER'
cu.align_y = 'CENTER'
sign = bpy.data.objects.new('cafe_sign', cu)
sign.data.materials.append(S['gold'])
CAFE.objects.link(sign)
sign.location = ((CAFE_X0 + CAFE_X1) / 2, OF - 0.125, 3.55)
sign.rotation_euler = Euler((math.pi / 2, 0, 0))
# stall risers in glazed green tile under the windows
for (a, b) in ((CAFE_X0 + 0.3, DX0_), (DX1_, CAFE_X1 - 0.3)):
    box(f'cafe_riser_{a}', (b - a, 0.16, 0.55), ((a + b) / 2, OF - 0.06, 0.275), S['risers'], coll=CAFE)
    box(f'cafe_sill_{a}', (b - a, 0.2, 0.06), ((a + b) / 2, OF - 0.06, 0.58), S['shop'], bevel=0.006, coll=CAFE)
    box(f'cafe_glass_{a}', (b - a - 0.08, 0.012, 2.35), ((a + b) / 2, OF, 1.8), H.M['glass'], coll=CAFE)
    for xx in (a + 0.03, b - 0.03):
        box(f'cafe_mull_{xx:.2f}', (0.06, 0.08, 2.5), (xx, OF, 1.85), S['shop'], bevel=0.004, coll=CAFE)
    box(f'cafe_transom_{a}', (b - a, 0.08, 0.06), ((a + b) / 2, OF, 2.65), S['shop'], bevel=0.004, coll=CAFE)
    box(f'cafe_top_{a}', (b - a, 0.08, 0.06), ((a + b) / 2, OF, 3.08), S['shop'], bevel=0.004, coll=CAFE)
    n = int((b - a) / 0.55)
    for k in range(1, n):
        box(f'cafe_tbar_{a}_{k}', (0.03, 0.05, 0.4), (a + k * (b - a) / n, OF, 2.86), S['shop'], coll=CAFE)
box('cafe_door_head', (DX1_ - DX0_ + 0.1, 0.1, 0.08), ((DX0_ + DX1_) / 2, OF, 2.48), S['shop'], bevel=0.004, coll=CAFE)
box('cafe_door_fan', (DX1_ - DX0_, 0.012, 0.55), ((DX0_ + DX1_) / 2, OF, 2.8), H.M['glass'], coll=CAFE)
for xx in (DX0_ - 0.03, DX1_ + 0.03):
    box(f'cafe_jamb_{xx:.2f}', (0.08, 0.12, 2.5), (xx, OF, 1.25), S['shop'], bevel=0.004, coll=CAFE)
door = empty('cafe_door', (DX0_ + 0.04, OF + 0.06, 0.16), (0, 0, math.radians(84)), CAFE)
child(box('cafe_door_stile', (DX1_ - DX0_ - 0.08, 0.05, 2.28), ((DX1_ - DX0_ - 0.08) / 2, 0, 1.14), S['shop'], bevel=0.004, coll=CAFE), door)
child(box('cafe_door_glass', (DX1_ - DX0_ - 0.3, 0.02, 1.55), ((DX1_ - DX0_ - 0.08) / 2, 0, 1.38), H.M['glass'], coll=CAFE), door)
child(box('cafe_door_pull', (0.02, 0.05, 0.45), (DX1_ - DX0_ - 0.2, -0.05, 1.05), M['brass'], bevel=0.005, coll=CAFE), door)
# mosaic threshold in the doorway
mos = {0: [], 1: []}
for a in range(12):
    for b in range(6):
        x_, y_ = DX0_ + 0.05 + a * 0.095, OF - 0.25 + b * 0.07
        mos[(a + b) % 2].append([(x_, y_), (x_ + 0.09, y_), (x_ + 0.09, y_ + 0.065), (x_, y_ + 0.065)])
for k in (0, 1):
    H.tile_polys(f'cafe_mosaic_{k}', mos[k], FFL, 0.012, CHK[k], CAFE)
box('cafe_step', (DX1_ - DX0_ + 0.3, 0.5, FFL - 0.012), ((DX0_ + DX1_) / 2, OF - 0.03, (FFL - 0.012) / 2), M['grout'], coll=CAFE)
# bay trees in planters either side of the door
for bx_ in (DX0_ - 0.55, DX1_ + 0.55):
    box(f'planter_{bx_}', (0.42, 0.42, 0.48), (bx_, OF - 0.45, 0.24), S['shop'], bevel=0.01, coll=CAFE)
    cylinder(f'bay_stem_{bx_}', 0.018, 0.75, (bx_, OF - 0.45, 0.85), M['oak'], coll=CAFE)
    sphere(f'bay_ball_{bx_}', 0.3, (bx_, OF - 0.45, 1.45), S['leaf'], coll=CAFE, scale=(1, 1, 1.05))

# interior shell
box('cafe_ceiling', (CW1 - CW0, CD1 - CD0 + 0.2, 0.05), ((CW0 + CW1) / 2, (CD0 + CD1) / 2, CTOP + 0.025), M['ceiling'], coll=CAFE)
box('cafe_wall_l', (0.1, CD1 - CD0 + 0.2, CTOP), (CW0 - 0.05, (CD0 + CD1) / 2, CTOP / 2), m_brick2('cafe_brick', 'YZ', palette='red'), coll=CAFE)
box('cafe_wall_r', (0.1, CD1 - CD0 + 0.2, CTOP), (CW1 + 0.05, (CD0 + CD1) / 2, CTOP / 2), m_plaster('cafe_plaster', (0.78, 0.74, 0.66)), coll=CAFE)
box('cafe_back', (CW1 - CW0, 0.1, CTOP), ((CW0 + CW1) / 2, CD1 + 0.05, CTOP / 2), S['metro'], coll=CAFE)
box('cafe_screed', (CW1 - CW0, CD1 - CD0, FFL - 0.02), ((CW0 + CW1) / 2, (CD0 + CD1) / 2, (FFL - 0.02) / 2), S['screed'], coll=CAFE)
# the floor being laid: 300 mm chequerboard in black and white marble effect porcelain
CAFE_TILES = []
T = 0.3
KY1 = CD1 - 1.6                 # tiles stop at the counter
BANQ = (CW1 - 0.5, 28.3, CW1, 30.9)      # the fixed banquette stands on the screed
tile_meshes = {}


def cafe_tile_me(w, h, black):
    key = ('cafe_tile', round(w, 3), round(h, 3), black)
    if key not in tile_meshes:
        me = bevel_box_mesh(round(w - 0.003, 4), round(h - 0.003, 4), 0.012, bevel=0.0012, segments=2, name='cafe_tile', key=key)
        if not me.materials:
            me.materials.append(S['bmarble'] if black else S['wmarble'])
        tile_meshes[key] = me
    return tile_meshes[key]


ccx = (CW0 + CW1) / 2 - T / 2           # a joint on the centre line, cuts equal both sides
na = int((CW1 - CW0) / T / 2) + 2
for a in range(-na, na + 1):
    for b in range(int((KY1 - CD0) / T) + 1):
        xa, xb = max(ccx + a * T, CW0), min(ccx + (a + 1) * T, CW1)
        ya, yb = CD0 + b * T, min(CD0 + (b + 1) * T, KY1)
        if xb - xa < 0.03 or yb - ya < 0.03:
            continue
        cx, cy = (xa + xb) / 2, (ya + yb) / 2
        if BANQ[0] - 0.05 < cx < BANQ[2] and BANQ[1] < cy < BANQ[3]:
            continue
        full = abs(xb - xa - T) < 1e-6 and abs(yb - ya - T) < 1e-6
        o = instance(f'cafe_tile_{a}_{b}', cafe_tile_me(xb - xa, yb - ya, (a + b) % 2 == 1), (cx, cy, FFL - 0.006 + RNG.uniform(-0.0002, 0.0002)),
                     rot=(0, 0, RNG.choice([0, math.pi]) + (RNG.choice([0, math.pi / 2]) if full else 0)), coll=CAFE)
        CAFE_TILES.append(o)
# counter faced in green zellige under a white marble top
KX0, KX1, KY0 = 9.3, 13.1, KY1 + 0.02
KH = 1.05
box('counter_core', (KX1 - KX0, 0.62, KH - 0.04), ((KX0 + KX1) / 2, KY0 + 0.31, (KH - 0.04) / 2 + 0.0), m_paint('counter_core', (0.1, 0.1, 0.1), 0.6), coll=CAFE)
for i in range(int((KX1 - KX0) / 0.1)):
    for j in range(int((KH - FFL - 0.1) / 0.1 + 0.01)):
        instance(f'cz_{i}_{j}', RNG.choice(H.zvars), (KX0 + 0.05 + i * 0.1 + RNG.uniform(-0.0006, 0.0006), KY0 - 0.003, FFL + 0.15 + j * 0.1),
                 rot=(math.pi / 2 + RNG.uniform(-0.006, 0.006), RNG.choice([0, math.pi / 2, math.pi, -math.pi / 2]), 0), coll=CAFE)
box('counter_kick', (KX1 - KX0, 0.04, 0.1), ((KX0 + KX1) / 2, KY0 + 0.03, FFL + 0.05), M['black'], coll=CAFE)
box('counter_top', (KX1 - KX0 + 0.06, 0.7, 0.04), ((KX0 + KX1) / 2, KY0 + 0.32, KH + 0.0), S['wmarble'], bevel=0.004, coll=CAFE)
TOPZ = KH + 0.02
# espresso machine, grinder, cups and a cake stand on the counter
EX = 10.35
box('esp_body', (0.78, 0.5, 0.42), (EX, KY0 + 0.38, TOPZ + 0.25), S['steel'], bevel=0.03, segments=4, coll=CAFE)
box('esp_tray', (0.8, 0.22, 0.04), (EX, KY0 + 0.1, TOPZ + 0.05), S['steel'], bevel=0.01, coll=CAFE)
box('esp_cuprail', (0.74, 0.44, 0.04), (EX, KY0 + 0.4, TOPZ + 0.48), S['steel'], bevel=0.01, coll=CAFE)
for k, gx in enumerate((EX - 0.22, EX + 0.22)):
    cylinder(f'esp_group{k}', 0.045, 0.08, (gx, KY0 + 0.1, TOPZ + 0.27), S['steel'], coll=CAFE, bevel=0.01)
    cylinder(f'esp_pf{k}', 0.04, 0.05, (gx, KY0 + 0.1, TOPZ + 0.2), S['steel'], coll=CAFE, bevel=0.008)
    box(f'esp_handle{k}', (0.03, 0.16, 0.03), (gx, KY0 - 0.02, TOPZ + 0.19), M['black'], bevel=0.01, coll=CAFE)
    tube(f'esp_wand{k}', [(gx + (0.32 if k else -0.32), KY0 + 0.2, TOPZ + 0.36), (gx + (0.34 if k else -0.34), KY0 + 0.12, TOPZ + 0.2), (gx + (0.34 if k else -0.34), KY0 + 0.1, TOPZ + 0.08)], 0.006, S['steel'], coll=CAFE)
CUP = m_ceramic('cup_white', (0.82, 0.81, 0.78), 0.2, False)
for k in range(10):
    lathe(f'cup{k}', [(0, 0), (0.025, 0), (0.04, 0.06), (0.037, 0.062), (0.022, 0.006), (0, 0.006)], CUP,
          loc=(EX - 0.3 + (k % 5) * 0.12, KY0 + 0.32 + (k // 5) * 0.12, TOPZ + 0.5), coll=CAFE, segments=24)
box('grinder_base', (0.2, 0.26, 0.38), (11.05, KY0 + 0.38, TOPZ + 0.19), M['black'], bevel=0.02, segments=3, coll=CAFE)
lathe('grinder_hopper', [(0, 0), (0.05, 0), (0.1, 0.2), (0.0, 0.2)], m_glass('smoked', tint=(0.35, 0.3, 0.25)), loc=(11.05, KY0 + 0.38, TOPZ + 0.38), coll=CAFE)
cylinder('cake_plate', 0.17, 0.012, (12.35, KY0 + 0.3, TOPZ + 0.12), CUP, coll=CAFE, bevel=0.003)
cylinder('cake_stem', 0.02, 0.1, (12.35, KY0 + 0.3, TOPZ + 0.06), CUP, coll=CAFE)
cylinder('cake', 0.11, 0.08, (12.35, KY0 + 0.3, TOPZ + 0.17), m_paint('sponge', (0.36, 0.20, 0.08), 0.8), coll=CAFE, bevel=0.01)
lathe('cake_dome', [(0, 0), (0.165, 0), (0.165, 0.12), (0.12, 0.2), (0.03, 0.24), (0.0, 0.25)], m_glass('dome'), loc=(12.35, KY0 + 0.3, TOPZ + 0.126), coll=CAFE)
# back wall: oak shelves with jars and cups, pendants over the counter
for k, z_ in enumerate((1.75, 2.25)):
    box(f'cafe_shelf{k}', (3.2, 0.24, 0.04), ((CW0 + CW1) / 2, CD1 - 0.12, z_), M['oak'], bevel=0.004, coll=CAFE)
    xx = (CW0 + CW1) / 2 - 1.5
    while xx < (CW0 + CW1) / 2 + 1.5:
        if RNG.random() < 0.5:
            lathe(f'jar_{k}_{xx:.2f}', [(0, 0), (0.05, 0), (0.05, 0.16), (0.035, 0.18), (0.0, 0.18)], m_glass(f'jar{k}', tint=(0.85, 0.8, 0.7)), loc=(xx, CD1 - 0.12, z_ + 0.02), coll=CAFE, segments=24)
            cylinder(f'beans_{k}_{xx:.2f}', 0.045, 0.1, (xx, CD1 - 0.12, z_ + 0.07), m_paint('beans', (0.09, 0.045, 0.02), 0.6), coll=CAFE)
        else:
            lathe(f'scup_{k}_{xx:.2f}', [(0, 0), (0.03, 0), (0.045, 0.07), (0.0, 0.07)], CUP, loc=(xx, CD1 - 0.12, z_ + 0.02), coll=CAFE, segments=24)
        xx += RNG.uniform(0.13, 0.22)
for k, px in enumerate((10.0, 11.2, 12.4)):
    lathe(f'cafe_shade{k}', [(0.0, 0.205), (0.032, 0.205), (0.2, 0.0), (0.192, 0.0), (0.026, 0.19), (0.0, 0.19)], S['enamel'], loc=(px, KY0 + 0.2, 2.2), coll=CAFE)
    sphere(f'cafe_bulb{k}', 0.035, (px, KY0 + 0.2, 2.26), m_emission('cafe_bulb', (1.0, 0.7, 0.42), 25.0), coll=CAFE)
    tube(f'cafe_flex{k}', [(px, KY0 + 0.2, 2.4), (px, KY0 + 0.2, 2.8), (px, KY0 + 0.2, CTOP)], 0.003, M['black'], coll=CAFE)
    l = add_light('SPOT', (px, KY0 + 0.2, 2.215), 30.0, (1, 0.72, 0.44), size=0.03, spot=100, blend=0.6, name=f'cafe_pend{k}')
for (dx, dy) in [(9.5, 29.0), (12.5, 29.0), (9.5, 30.6), (12.5, 30.6)]:
    cylinder(f'cafe_dl_{dx}_{dy}', 0.035, 0.004, (dx, dy, CTOP - 0.003), M['downlight'], coll=CAFE)
    add_light('SPOT', (dx, dy, CTOP - 0.02), 26.0, (1.0, 0.84, 0.66), size=0.025, spot=70, blend=0.8, name=f'cafe_dl_{dx}_{dy}')
H.fill_light('cafe_fill', ((CW0 + CW1) / 2, (CD0 + CD1) / 2, CTOP - 0.06), 60.0, (3.2, 3.6))
# banquette along the plaster wall
box('banquette_seat', (0.5, 2.6, 0.32), (CW1 - 0.25, 29.6, FFL + 0.32), S['velvet'], bevel=0.04, segments=4, coll=CAFE)
box('banquette_base', (0.46, 2.56, 0.32), (CW1 - 0.25, 29.6, FFL + 0.14), M['oak'], bevel=0.005, coll=CAFE)
box('banquette_back', (0.14, 2.6, 0.55), (CW1 - 0.07, 29.6, FFL + 0.75), S['velvet'], bevel=0.05, segments=5, coll=CAFE)
