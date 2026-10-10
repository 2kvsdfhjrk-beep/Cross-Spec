"""Shared Blender helpers for the Cowey Tiling renders.

Everything is procedural: materials are node graphs, geometry is built with
bmesh, and every render goes through Cycles with the OpenImageDenoise pass.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Euler, Matrix

R = math.radians

# ---------------------------------------------------------------- scene setup

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.render.use_persistent_data = True
    sc.unit_settings.system = 'METRIC'
    return sc


def render_settings(w, h, samples=256, threshold=0.012, exposure=0.0, look='AgX - Medium High Contrast',
                    wb=None, clamp_indirect=8.0, bounces=(12, 6, 6, 12, 16)):
    sc = bpy.context.scene
    c = sc.cycles
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = threshold
    c.adaptive_min_samples = min(64, samples)
    c.use_denoising = True
    c.denoiser = 'OPENIMAGEDENOISE'
    c.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    c.denoising_prefilter = 'ACCURATE'
    try:
        c.denoising_quality = 'HIGH'
    except Exception:
        pass
    c.max_bounces, c.diffuse_bounces, c.glossy_bounces, c.transmission_bounces, c.transparent_max_bounces = bounces
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.blur_glossy = 1.0
    c.sample_clamp_direct = 0
    c.sample_clamp_indirect = clamp_indirect
    c.use_light_tree = True
    c.pixel_filter_type = 'BLACKMAN_HARRIS'
    c.filter_width = 1.5
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    vs = sc.view_settings
    vs.view_transform = 'AgX'
    vs.look = look
    vs.exposure = exposure
    if wb:
        vs.use_white_balance = True
        vs.white_balance_temperature = wb
    s = sc.render.image_settings
    s.file_format = 'PNG'
    s.color_mode = 'RGB'
    s.color_depth = '16'
    sc.render.threads_mode = 'AUTO'


def render(path, camera):
    sc = bpy.context.scene
    sc.camera = camera
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------- world / light

def sky_world(elev_deg, rot_deg, strength=1.0, air=1.0, aerosol=1.0, ozone=1.0, altitude=40.0, extra=None):
    """Physically based sky without the sun disc (the disc is lit by a Sun lamp instead)."""
    sc = bpy.context.scene
    w = bpy.data.worlds.new('sky')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'MULTIPLE_SCATTERING'
    sky.sun_disc = False
    sky.sun_elevation = R(elev_deg)
    sky.sun_rotation = R(rot_deg)
    sky.altitude = altitude
    sky.air_density = air
    sky.aerosol_density = aerosol
    sky.ozone_density = ozone
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    w.cycles.sampling_method = 'MANUAL'
    w.cycles.sample_map_resolution = 2048
    return w


def flat_world(color=(0.02, 0.02, 0.02), strength=1.0):
    sc = bpy.context.scene
    w = bpy.data.worlds.new('flat')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*color, 1)
    bg.inputs['Strength'].default_value = strength
    return w


def sun_dir(elev_deg, rot_deg):
    e, r = R(elev_deg), R(rot_deg)
    return Vector((math.sin(r) * math.cos(e), math.cos(r) * math.cos(e), math.sin(e)))


def add_sun(elev_deg, rot_deg, strength=4.0, color=(1, 0.8, 0.6), angle_deg=0.6):
    d = sun_dir(elev_deg, rot_deg)
    l = bpy.data.lights.new('sun', 'SUN')
    l.energy = strength
    l.color = color
    l.angle = R(angle_deg)
    o = bpy.data.objects.new('sun', l)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    return o


def add_light(kind, loc, energy, color=(1, 0.85, 0.7), size=0.05, rot=None, spot=None, blend=0.6, name='light', shadow_soft=None):
    l = bpy.data.lights.new(name, kind)
    l.energy = energy
    l.color = color
    if kind in ('POINT', 'SPOT'):
        l.shadow_soft_size = size
    if kind == 'AREA':
        l.shape = 'RECTANGLE'
        if isinstance(size, (tuple, list)):
            l.size, l.size_y = size
        else:
            l.size = l.size_y = size
    if kind == 'SPOT':
        l.spot_size = R(spot or 60)
        l.spot_blend = blend
    o = bpy.data.objects.new(name, l)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    if rot:
        o.rotation_euler = Euler(rot)
    return o


def aim(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = d.to_track_quat('-Z', 'Y')


def camera(name, loc, target=None, lens=28, yaw=None, pitch=90.0, roll=0.0, shift=(0, 0), fstop=None, focus=None, sensor=36.0, fit='HORIZONTAL'):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = sensor
    cd.sensor_fit = fit
    if fit == 'VERTICAL':
        cd.sensor_height = 24.0
    cd.shift_x, cd.shift_y = shift
    cd.clip_start = 0.02
    cd.clip_end = 400
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.aperture_blades = 7
        cd.dof.aperture_rotation = R(10)
        if isinstance(focus, (int, float)):
            cd.dof.focus_distance = focus
    o = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    if target is not None:
        aim(o, target)
    else:
        o.rotation_euler = Euler((R(pitch), R(roll), R(yaw or 0)))
    if fstop and focus is not None and not isinstance(focus, (int, float)):
        cd.dof.focus_object = focus
    return o


# ------------------------------------------------------------------ geometry

def link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


def mesh_obj(name, me, mat=None, loc=(0, 0, 0), rot=(0, 0, 0), coll=None, scale=None):
    o = bpy.data.objects.new(name, me)
    if mat is not None:
        if not me.materials:
            me.materials.append(mat)
    o.location = loc
    o.rotation_euler = Euler(rot)
    if scale:
        o.scale = scale
    return link(o, coll)


_bevel_cache = {}


def bevel_box_mesh(sx, sy, sz, bevel=0.002, segments=2, name='box', key=None):
    """Box mesh centred on the origin with a real chamfer applied into the mesh data."""
    k = key or (round(sx, 5), round(sy, 5), round(sz, 5), bevel, segments)
    if k in _bevel_cache:
        return _bevel_cache[k]
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if bevel > 0:
        o = bpy.data.objects.new('_tmp', me)
        bpy.context.scene.collection.objects.link(o)
        m = o.modifiers.new('bv', 'BEVEL')
        m.width = min(bevel, min(sx, sy, sz) * 0.45)
        m.segments = segments
        m.limit_method = 'NONE'
        m.harden_normals = True
        for p in me.polygons:
            p.use_smooth = True
        dg = bpy.context.evaluated_depsgraph_get()
        ev = o.evaluated_get(dg)
        me2 = bpy.data.meshes.new_from_object(ev)
        me2.name = name
        bpy.data.objects.remove(o)
        bpy.data.meshes.remove(me)
        me = me2
    box_uv(me)
    _bevel_cache[k] = me
    return me


def box_uv(me):
    """Planar UVs from object space so texture scale stays in metres."""
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active.data
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if ax == 2:
                uv[li].uv = (co.x, co.y)
            elif ax == 1:
                uv[li].uv = (co.x, co.z)
            else:
                uv[li].uv = (co.y, co.z)


def box(name, size, loc, mat=None, rot=(0, 0, 0), bevel=0.0, segments=2, coll=None):
    me = bevel_box_mesh(*size, bevel=bevel, segments=segments, name=name)
    if mat is not None and not me.materials:
        me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    o.location = loc
    o.rotation_euler = Euler(rot)
    if mat is not None and me.materials and me.materials[0] != mat:
        o.material_slots[0].link = 'OBJECT'
        o.material_slots[0].material = mat
    return link(o, coll)


def poly_prism(name, pts, z0, z1, mat=None, coll=None, bevel=0.0):
    """Extrude a 2D polygon (list of (x,y)) between z0 and z1."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z0)) for x, y in pts]
    f = bm.faces.new(vs)
    bmesh.ops.recalc_face_normals(bm, faces=[f])
    if f.normal.z > 0:
        f.normal_flip()
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    top = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    for v in top:
        v.co.z = z1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    box_uv(me)
    o = mesh_obj(name, me, mat, coll=coll)
    if bevel > 0:
        m = o.modifiers.new('bv', 'BEVEL')
        m.width = bevel
        m.segments = 2
        m.harden_normals = True
        for p in me.polygons:
            p.use_smooth = True
    return o


def plane(name, sx, sy, loc, mat=None, rot=(0, 0, 0), coll=None, subdiv=0):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=max(1, subdiv), y_segments=max(1, subdiv), size=0.5)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    box_uv(me)
    return mesh_obj(name, me, mat, loc=loc, rot=rot, coll=coll)


def wall_with_holes(name, x0, x1, z0, z1, thick, holes, mat, y=0.0, coll=None, axis='X'):
    """Wall slab in the XZ plane (or YZ when axis='Y') with rectangular openings.
    holes: list of (a0, a1, z0, z1) along the wall axis. The wall occupies y..y+thick."""
    xs = sorted(set([x0, x1] + [h[0] for h in holes] + [h[1] for h in holes]))
    zs = sorted(set([z0, z1] + [h[2] for h in holes] + [h[3] for h in holes]))
    parts = []
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            cx, cz = (xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2
            if any(h[0] <= cx <= h[1] and h[2] <= cz <= h[3] for h in holes):
                continue
            parts.append((xs[i], xs[i + 1], zs[j], zs[j + 1]))
    bm = bmesh.new()
    for a0, a1, b0, b1 in parts:
        verts = []
        for (a, b, c) in [(a0, 0, b0), (a1, 0, b0), (a1, 0, b1), (a0, 0, b1), (a0, 1, b0), (a1, 1, b0), (a1, 1, b1), (a0, 1, b1)]:
            yy = y + b * thick
            co = (a, yy, c) if axis == 'X' else (yy, a, c)
            verts.append(bm.verts.new(co))
        fs = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
        for f in fs:
            bm.faces.new([verts[i] for i in f])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    # remove internal coincident faces between adjacent blocks
    seen = {}
    dup = []
    for f in bm.faces:
        k = tuple(sorted(tuple(round(c, 5) for c in v.co) for v in f.verts))
        if k in seen:
            dup += [f, seen[k]]
        else:
            seen[k] = f
    bmesh.ops.delete(bm, geom=list(set(dup)), context='FACES')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    box_uv(me)
    return mesh_obj(name, me, mat, coll=coll)


def lathe(name, profile, mat=None, loc=(0, 0, 0), segments=64, coll=None, smooth=True):
    """Revolve a list of (radius, z) points around Z."""
    bm = bmesh.new()
    rings = []
    for r_, z in profile:
        ring = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            ring.append(bm.verts.new((r_ * math.cos(a), r_ * math.sin(a), z)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(segments):
            a, b = rings[k][i], rings[k][(i + 1) % segments]
            c, d = rings[k + 1][(i + 1) % segments], rings[k + 1][i]
            try:
                bm.faces.new((a, b, c, d))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    return mesh_obj(name, me, mat, loc=loc, coll=coll)


def tube(name, pts, radius, mat=None, coll=None, res=4, bevel_res=12):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = bevel_res
    cu.use_fill_caps = True
    sp = cu.splines.new('NURBS')
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1)
    sp.use_endpoint_u = True
    sp.order_u = min(4, len(pts))
    sp.resolution_u = res * 4
    o = bpy.data.objects.new(name, cu)
    if mat:
        cu.materials.append(mat)
    return link(o, coll)


def cylinder(name, r, h, loc, mat=None, rot=(0, 0, 0), segments=48, coll=None, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r, radius2=r, depth=h)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = abs(p.normal.z) < 0.5
    o = mesh_obj(name, me, mat, loc=loc, rot=rot, coll=coll)
    if bevel > 0:
        m = o.modifiers.new('bv', 'BEVEL')
        m.width = bevel
        m.segments = 3
        m.limit_method = 'ANGLE'
        m.harden_normals = True
    return o


def sphere(name, r, loc, mat=None, coll=None, scale=None, subdiv=4):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return mesh_obj(name, me, mat, loc=loc, coll=coll, scale=scale)


def instance(name, me, loc, rot=(0, 0, 0), coll=None, scale=None, mat=None):
    o = bpy.data.objects.new(name, me)
    o.location = loc
    o.rotation_euler = Euler(rot)
    if scale:
        o.scale = scale
    if mat is not None:
        o.material_slots[0].link = 'OBJECT'
        o.material_slots[0].material = mat
    return link(o, coll)


def collection(name, hide=False):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    if hide:
        c.hide_render = True
    return c


def set_visibility(o, camera=True, shadow=True, glossy=True, diffuse=True, transmission=True):
    o.visible_camera = camera
    o.visible_shadow = shadow
    o.visible_glossy = glossy
    o.visible_diffuse = diffuse
    o.visible_transmission = transmission


# ------------------------------------------------------------ node builders

class NB:
    """Tiny node graph builder for materials."""

    def __init__(self, name):
        self.mat = bpy.data.materials.new(name)
        self.mat.use_nodes = True
        self.nt = self.mat.node_tree
        self.nt.nodes.clear()
        self.out = self.nt.nodes.new('ShaderNodeOutputMaterial')

    def n(self, kind, **kw):
        node = self.nt.nodes.new(kind)
        for k, v in kw.items():
            if k in node.inputs:
                node.inputs[k].default_value = v
            else:
                setattr(node, k, v)
        return node

    def i(self, node, name):
        """Input by name, falling back to identifier."""
        for s in node.inputs:
            if s.identifier == name:
                return s
        return node.inputs[name]

    def o(self, node, name):
        for s in node.outputs:
            if s.identifier == name:
                return s
        return node.outputs[name]

    def l(self, a, b):
        self.nt.links.new(a, b)

    def set(self, node, name, v):
        sock = self.i(node, name)
        if hasattr(v, 'is_output') or isinstance(v, bpy.types.NodeSocket):
            self.l(v, sock)
        else:
            sock.default_value = v

    # common pieces
    def coords(self, kind='Object', offset_random=0.0, scale=None):
        tc = self.n('ShaderNodeTexCoord')
        v = tc.outputs[kind]
        if offset_random:
            oi = self.n('ShaderNodeObjectInfo')
            m = self.n('ShaderNodeVectorMath', operation='MULTIPLY_ADD')
            self.l(oi.outputs['Random'], m.inputs[0])
            m.inputs[1].default_value = (offset_random * 1.37, offset_random * 0.71, offset_random * 0.53)
            self.l(v, m.inputs[2])
            v = m.outputs[0]
        if scale is not None:
            s = self.n('ShaderNodeVectorMath', operation='MULTIPLY')
            self.l(v, s.inputs[0])
            s.inputs[1].default_value = scale if isinstance(scale, (tuple, list)) else (scale, scale, scale)
            v = s.outputs[0]
        return v

    def noise(self, vec, scale, detail=6, rough=0.55, dist=0.0, kind='FBM', dims='3D', lac=2.0):
        nz = self.n('ShaderNodeTexNoise', noise_dimensions=dims, noise_type=kind)
        self.l(vec, nz.inputs['Vector'])
        nz.inputs['Scale'].default_value = scale
        nz.inputs['Detail'].default_value = detail
        nz.inputs['Roughness'].default_value = rough
        nz.inputs['Lacunarity'].default_value = lac
        nz.inputs['Distortion'].default_value = dist
        return nz

    def ramp(self, fac, stops, interp='LINEAR'):
        r = self.n('ShaderNodeValToRGB')
        cr = r.color_ramp
        cr.interpolation = interp
        while len(cr.elements) > len(stops):
            cr.elements.remove(cr.elements[-1])
        while len(cr.elements) < len(stops):
            cr.elements.new(0.5)
        for el, (pos, col) in zip(cr.elements, stops):
            el.position = pos
            el.color = (*col, 1) if len(col) == 3 else col
        self.l(fac, r.inputs['Fac'])
        return r

    def math(self, op, a, b=None, clamp=False):
        m = self.n('ShaderNodeMath', operation=op)
        m.use_clamp = clamp
        for idx, v in enumerate([a, b]):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                m.inputs[idx].default_value = v
            else:
                self.l(v, m.inputs[idx])
        return m.outputs[0]

    def mixc(self, fac, a, b, blend='MIX'):
        m = self.n('ShaderNodeMix', data_type='RGBA', blend_type=blend)
        for ident, v in (('Factor_Float', fac), ('A_Color', a), ('B_Color', b)):
            s = self.i(m, ident)
            if isinstance(v, (int, float)):
                s.default_value = v
            elif isinstance(v, tuple):
                s.default_value = (*v, 1) if len(v) == 3 else v
            else:
                self.l(v, s)
        return self.o(m, 'Result_Color')

    def maprange(self, v, a0, a1, b0, b1, clamp=True):
        m = self.n('ShaderNodeMapRange')
        m.clamp = clamp
        self.l(v, m.inputs['Value'])
        m.inputs['From Min'].default_value = a0
        m.inputs['From Max'].default_value = a1
        m.inputs['To Min'].default_value = b0
        m.inputs['To Max'].default_value = b1
        return m.outputs['Result']

    def bump(self, height, strength=0.2, distance=0.01, normal=None):
        b = self.n('ShaderNodeBump')
        b.inputs['Strength'].default_value = strength
        b.inputs['Distance'].default_value = distance
        self.l(height, b.inputs['Height'])
        if normal is not None:
            self.l(normal, b.inputs['Normal'])
        return b.outputs['Normal']

    def principled(self, base=None, rough=0.5, metal=0.0, spec=0.5, normal=None, coat=0.0, coat_rough=0.03,
                   sss=0.0, sss_radius=(1, 0.5, 0.25), sss_scale=0.01, trans=0.0, ior=1.5, emission=None, estr=0.0,
                   alpha=1.0, coat_normal=None, sheen=0.0):
        p = self.n('ShaderNodeBsdfPrincipled')
        for ident, v in (('Base Color', base), ('Roughness', rough), ('Metallic', metal), ('Specular IOR Level', spec),
                         ('Coat Weight', coat), ('Coat Roughness', coat_rough), ('Subsurface Weight', sss),
                         ('Transmission Weight', trans), ('IOR', ior), ('Alpha', alpha), ('Sheen Weight', sheen)):
            if v is None:
                continue
            s = p.inputs[ident]
            if isinstance(v, (int, float)):
                s.default_value = v
            elif isinstance(v, tuple):
                s.default_value = (*v, 1) if len(v) == 3 else v
            else:
                self.l(v, s)
        p.inputs['Subsurface Radius'].default_value = sss_radius
        p.inputs['Subsurface Scale'].default_value = sss_scale
        if normal is not None:
            self.l(normal, p.inputs['Normal'])
        if coat_normal is not None:
            self.l(coat_normal, p.inputs['Coat Normal'])
        if emission is not None:
            s = p.inputs['Emission Color']
            if isinstance(emission, tuple):
                s.default_value = (*emission, 1)
            else:
                self.l(emission, s)
            p.inputs['Emission Strength'].default_value = estr
        return p

    def finish(self, shader, disp=None):
        self.l(shader.outputs[0], self.out.inputs['Surface'])
        if disp is not None:
            self.l(disp, self.out.inputs['Displacement'])
        return self.mat


def obj_random(nb):
    return nb.n('ShaderNodeObjectInfo').outputs['Random']


# ------------------------------------------------------------- materials

def m_simple(name, color, rough=0.5, metal=0.0, coat=0.0, spec=0.5):
    nb = NB(name)
    return nb.finish(nb.principled(color, rough, metal, spec=spec, coat=coat))


def m_porcelain_stone(name='porcelain_stone', tone=(0.42, 0.39, 0.34), rough=0.62, scale=1.0, bump=0.35, honed=False):
    """Stone-effect porcelain (sandstone / limestone look). Each object gets its own variation."""
    nb = NB(name)
    v = nb.coords('Object', offset_random=37.0, scale=scale)
    n1 = nb.noise(v, 0.9, 7, 0.58)
    n2 = nb.noise(v, 5.5, 9, 0.62)
    n3 = nb.noise(v, 38.0, 3, 0.5)
    wav = nb.n('ShaderNodeTexWave', wave_type='BANDS', bands_direction='DIAGONAL')
    nb.l(v, wav.inputs['Vector'])
    wav.inputs['Scale'].default_value = 0.55
    wav.inputs['Distortion'].default_value = 7
    wav.inputs['Detail'].default_value = 4
    wav.inputs['Detail Roughness'].default_value = 0.6
    t = nb.math('ADD', nb.math('MULTIPLY', n1.outputs['Fac'], 0.7), nb.math('MULTIPLY', wav.outputs['Fac'], 0.3))
    t = nb.math('ADD', t, nb.math('MULTIPLY', nb.math('SUBTRACT', n2.outputs['Fac'], 0.5), 0.35))
    lo = tuple(c * 0.78 for c in tone)
    hi = tuple(min(1, c * 1.2) for c in tone)
    warm = (tone[0] * 1.08, tone[1] * 0.98, tone[2] * 0.86)
    col = nb.ramp(t, [(0.28, lo), (0.5, tone), (0.62, warm), (0.8, hi)]).outputs['Color']
    # fine dark grains
    vor = nb.n('ShaderNodeTexVoronoi', feature='F1')
    nb.l(v, vor.inputs['Vector'])
    vor.inputs['Scale'].default_value = 160
    grain = nb.maprange(vor.outputs['Distance'], 0.0, 0.12, 0.55, 1.0)
    gmix = nb.n('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    nb.i(gmix, 'Factor_Float').default_value = 0.6
    nb.l(col, nb.i(gmix, 'A_Color'))
    nb.l(grain, nb.i(gmix, 'B_Color'))
    col = nb.o(gmix, 'Result_Color')
    # per-object tone shift (real batches vary slightly)
    rnd = obj_random(nb)
    shift = nb.maprange(rnd, 0, 1, 0.92, 1.07)
    hsv = nb.n('ShaderNodeHueSaturation')
    nb.l(col, hsv.inputs['Color'])
    nb.l(shift, hsv.inputs['Value'])
    hsv.inputs['Saturation'].default_value = 0.95
    col = hsv.outputs['Color']
    r = nb.maprange(n2.outputs['Fac'], 0.3, 0.7, rough - 0.08, rough + 0.1)
    if honed:
        r = nb.maprange(n2.outputs['Fac'], 0.3, 0.7, 0.28, 0.42)
    h = nb.math('ADD', nb.math('MULTIPLY', n2.outputs['Fac'], 0.6), nb.math('MULTIPLY', n3.outputs['Fac'], 0.4))
    h = nb.math('ADD', h, nb.math('MULTIPLY', vor.outputs['Distance'], 0.5))
    nrm = nb.bump(h, bump, 0.0015)
    return nb.finish(nb.principled(col, r, spec=0.45, normal=nrm))


def m_jointing(name='jointing', color=(0.07, 0.066, 0.06)):
    nb = NB(name)
    v = nb.coords('Object', scale=1.0)
    n = nb.noise(v, 90, 4, 0.6)
    col = nb.ramp(n.outputs['Fac'], [(0.3, tuple(c * 0.75 for c in color)), (0.7, tuple(c * 1.3 for c in color))]).outputs['Color']
    nrm = nb.bump(n.outputs['Fac'], 0.6, 0.002)
    return nb.finish(nb.principled(col, 0.92, spec=0.3, normal=nrm))


def m_brick(name='brick', axis='XZ'):
    """UK stretcher bond: 215 x 65 mm bricks, 10 mm joints, stock-brick colour mix."""
    nb = NB(name)
    tc = nb.n('ShaderNodeTexCoord')
    sep = nb.n('ShaderNodeSeparateXYZ')
    nb.l(tc.outputs['Object'], sep.inputs[0])
    comb = nb.n('ShaderNodeCombineXYZ')
    if axis == 'XZ':
        nb.l(sep.outputs['X'], comb.inputs['X'])
        nb.l(sep.outputs['Z'], comb.inputs['Y'])
        nb.l(sep.outputs['Y'], comb.inputs['Z'])
    else:
        nb.l(sep.outputs['Y'], comb.inputs['X'])
        nb.l(sep.outputs['Z'], comb.inputs['Y'])
        nb.l(sep.outputs['X'], comb.inputs['Z'])
    v = comb.outputs[0]
    br = nb.n('ShaderNodeTexBrick', offset=0.5, offset_frequency=2, squash=1.0, squash_frequency=2)
    nb.l(v, br.inputs['Vector'])
    br.inputs['Color1'].default_value = (1, 1, 1, 1)
    br.inputs['Color2'].default_value = (0, 0, 0, 1)
    br.inputs['Mortar'].default_value = (0.5, 0.5, 0.5, 1)
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = 0.0105
    br.inputs['Mortar Smooth'].default_value = 0.25
    br.inputs['Bias'].default_value = 0.0
    br.inputs['Brick Width'].default_value = 0.225
    br.inputs['Row Height'].default_value = 0.075
    # per-brick random value lives in the colour output of a black/white brick
    rnd = nb.n('ShaderNodeRGBToBW')
    nb.l(br.outputs['Color'], rnd.inputs['Color'])
    tones = [(0.0, (0.43, 0.30, 0.16)), (0.25, (0.52, 0.38, 0.21)), (0.45, (0.58, 0.45, 0.27)),
             (0.62, (0.47, 0.30, 0.17)), (0.78, (0.36, 0.20, 0.11)), (0.9, (0.55, 0.42, 0.25)), (1.0, (0.30, 0.22, 0.14))]
    bcol = nb.ramp(rnd.outputs['Val'], tones, 'CONSTANT').outputs['Color']
    n1 = nb.noise(v, 30, 8, 0.65)
    n2 = nb.noise(v, 2.5, 5, 0.6)
    mott = nb.maprange(n1.outputs['Fac'], 0.25, 0.75, 0.72, 1.18)
    m1 = nb.n('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    nb.i(m1, 'Factor_Float').default_value = 1.0
    nb.l(bcol, nb.i(m1, 'A_Color'))
    nb.l(mott, nb.i(m1, 'B_Color'))
    bcol = nb.o(m1, 'Result_Color')
    soot = nb.maprange(n2.outputs['Fac'], 0.45, 0.75, 1.0, 0.78)
    m2 = nb.n('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    nb.i(m2, 'Factor_Float').default_value = 1.0
    nb.l(bcol, nb.i(m2, 'A_Color'))
    nb.l(soot, nb.i(m2, 'B_Color'))
    bcol = nb.o(m2, 'Result_Color')
    n3 = nb.noise(v, 140, 3, 0.5)
    mortar = nb.ramp(n3.outputs['Fac'], [(0.3, (0.30, 0.29, 0.26)), (0.7, (0.46, 0.44, 0.40))]).outputs['Color']
    col = nb.mixc(br.outputs['Fac'], bcol, mortar)
    h = nb.math('SUBTRACT', 1.0, br.outputs['Fac'])
    h = nb.math('ADD', nb.math('MULTIPLY', h, 1.0), nb.math('MULTIPLY', n1.outputs['Fac'], 0.25))
    h = nb.math('ADD', h, nb.math('MULTIPLY', n3.outputs['Fac'], 0.12))
    nrm = nb.bump(h, 0.9, 0.006)
    r = nb.maprange(br.outputs['Fac'], 0, 1, 0.82, 0.95)
    return nb.finish(nb.principled(col, r, spec=0.35, normal=nrm))


def m_plaster(name='plaster', color=(0.80, 0.77, 0.71), rough=0.9, bump=0.05):
    nb = NB(name)
    v = nb.coords('Object')
    n = nb.noise(v, 6, 8, 0.6)
    f = nb.noise(v, 260, 3, 0.5)
    col = nb.ramp(n.outputs['Fac'], [(0.35, tuple(c * 0.965 for c in color)), (0.65, color)]).outputs['Color']
    nrm = nb.bump(nb.math('ADD', n.outputs['Fac'], nb.math('MULTIPLY', f.outputs['Fac'], 0.4)), bump, 0.002)
    return nb.finish(nb.principled(col, rough, spec=0.35, normal=nrm))


def m_paint(name, color, rough=0.42):
    nb = NB(name)
    v = nb.coords('Object')
    f = nb.noise(v, 300, 2, 0.5)
    nrm = nb.bump(f.outputs['Fac'], 0.03, 0.001)
    r = nb.maprange(nb.noise(v, 4, 4, 0.5).outputs['Fac'], 0.3, 0.7, rough - 0.05, rough + 0.06)
    return nb.finish(nb.principled(color, r, spec=0.45, normal=nrm))


def m_metal(name, color, rough=0.3, aniso=0.0):
    nb = NB(name)
    v = nb.coords('Object')
    n = nb.noise(v, 18, 6, 0.6)
    r = nb.maprange(n.outputs['Fac'], 0.3, 0.7, rough * 0.8, rough * 1.25)
    p = nb.principled(color, r, metal=1.0)
    p.inputs['Anisotropic'].default_value = aniso
    return nb.finish(p)


def m_powder(name, color=(0.035, 0.04, 0.045), rough=0.42):
    """Powder-coated aluminium (anthracite window frames)."""
    nb = NB(name)
    v = nb.coords('Object')
    f = nb.noise(v, 400, 2, 0.5)
    nrm = nb.bump(f.outputs['Fac'], 0.08, 0.001)
    return nb.finish(nb.principled(color, rough, metal=0.35, spec=0.5, normal=nrm))


def m_glass(name='glass', tint=(0.93, 0.97, 0.95), rough=0.0, shadow_pass=True):
    nb = NB(name)
    p = nb.principled(tint, rough, trans=1.0, ior=1.52, spec=0.5)
    if not shadow_pass:
        return nb.finish(p)
    lp = nb.n('ShaderNodeLightPath')
    tr = nb.n('ShaderNodeBsdfTransparent')
    tr.inputs['Color'].default_value = (*tint, 1)
    mix = nb.n('ShaderNodeMixShader')
    nb.l(lp.outputs['Is Shadow Ray'], mix.inputs['Fac'])
    nb.l(p.outputs[0], mix.inputs[1])
    nb.l(tr.outputs[0], mix.inputs[2])
    return nb.finish(mix)


def m_emission(name, color=(1, 0.8, 0.55), strength=20.0):
    nb = NB(name)
    e = nb.n('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1)
    e.inputs['Strength'].default_value = strength
    return nb.finish(e)


def m_oak(name='oak', tone=(0.36, 0.22, 0.11), rough=0.5, along='X', oiled=True):
    nb = NB(name)
    tc = nb.n('ShaderNodeTexCoord')
    sc = {'X': (0.6, 22, 22), 'Y': (22, 0.6, 22), 'Z': (22, 22, 0.6)}[along]
    v = nb.n('ShaderNodeVectorMath', operation='MULTIPLY')
    nb.l(tc.outputs['Object'], v.inputs[0])
    v.inputs[1].default_value = sc
    oi = obj_random(nb)
    add = nb.n('ShaderNodeVectorMath', operation='MULTIPLY_ADD')
    nb.l(oi, add.inputs[0])
    add.inputs[1].default_value = (7.1, 3.3, 5.9)
    nb.l(v.outputs[0], add.inputs[2])
    vv = add.outputs[0]
    g = nb.noise(vv, 1.6, 9, 0.66, dist=0.5)
    wav = nb.n('ShaderNodeTexWave', wave_type='RINGS', rings_direction='SPHERICAL')
    nb.l(vv, wav.inputs['Vector'])
    wav.inputs['Scale'].default_value = 0.35
    wav.inputs['Distortion'].default_value = 9
    wav.inputs['Detail'].default_value = 3
    t = nb.math('ADD', nb.math('MULTIPLY', g.outputs['Fac'], 0.65), nb.math('MULTIPLY', wav.outputs['Fac'], 0.35))
    dark = tuple(c * 0.62 for c in tone)
    light = tuple(min(1, c * 1.32) for c in tone)
    col = nb.ramp(t, [(0.25, dark), (0.5, tone), (0.75, light)]).outputs['Color']
    pores = nb.noise(vv, 60, 2, 0.5)
    nrm = nb.bump(nb.math('ADD', t, nb.math('MULTIPLY', pores.outputs['Fac'], 0.5)), 0.12, 0.001)
    return nb.finish(nb.principled(col, rough, spec=0.45, normal=nrm, coat=0.15 if oiled else 0.0, coat_rough=0.25))


def m_zellige(name='zellige', ramp_colors=None, pooling=True):
    """Handmade glazed tile: per-tile colour, glaze pooling at edges, glassy coat."""
    nb = NB(name)
    rnd = obj_random(nb)
    cols = ramp_colors or [(0.0, (0.010, 0.050, 0.034)), (0.35, (0.016, 0.082, 0.055)),
                           (0.7, (0.028, 0.120, 0.080)), (1.0, (0.050, 0.170, 0.115))]
    base = nb.ramp(rnd, cols).outputs['Color']
    v = nb.coords('Object', offset_random=11.0)
    n = nb.noise(v, 22, 6, 0.6)
    tone = nb.maprange(n.outputs['Fac'], 0.3, 0.7, 0.72, 1.3)
    m = nb.n('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    nb.i(m, 'Factor_Float').default_value = 1.0
    nb.l(base, nb.i(m, 'A_Color'))
    nb.l(tone, nb.i(m, 'B_Color'))
    col = nb.o(m, 'Result_Color')
    if pooling:
        geo = nb.n('ShaderNodeNewGeometry')
        edge = nb.maprange(geo.outputs['Pointiness'], 0.5, 0.56, 0.0, 1.0)
        lighter = nb.mixc(0.55, col, (0.55, 0.62, 0.52), 'SCREEN')
        col = nb.mixc(edge, col, lighter)
    vor = nb.n('ShaderNodeTexVoronoi', feature='F1')
    nb.l(v, vor.inputs['Vector'])
    vor.inputs['Scale'].default_value = 420
    pin = nb.maprange(vor.outputs['Distance'], 0.0, 0.06, 0.0, 1.0)
    h = nb.math('ADD', nb.math('MULTIPLY', n.outputs['Fac'], 0.8), nb.math('MULTIPLY', pin, 0.25))
    nrm = nb.bump(h, 0.22, 0.0015)
    p = nb.principled(col, 0.18, spec=0.5, normal=nrm, coat=1.0, coat_rough=0.015)
    p.inputs['Coat IOR'].default_value = 1.52
    return nb.finish(p)


def m_marble(name='marble', base=(0.80, 0.79, 0.76), vein=(0.30, 0.29, 0.28), rough=0.14, coat=0.35, scale=1.0, dark=False, calm=False):
    nb = NB(name)
    v = nb.coords('Object', offset_random=19.0, scale=scale)
    warp = nb.noise(v, 1.1, 8, 0.62)
    vadd = nb.n('ShaderNodeVectorMath', operation='MULTIPLY_ADD')
    nb.l(warp.outputs['Color'], vadd.inputs[0])
    vadd.inputs[1].default_value = (0.9, 0.9, 0.9)
    nb.l(v, vadd.inputs[2])
    vw = vadd.outputs[0]
    w1 = nb.n('ShaderNodeTexWave', wave_type='BANDS', bands_direction='DIAGONAL', wave_profile='SIN')
    nb.l(vw, w1.inputs['Vector'])
    w1.inputs['Scale'].default_value = 0.9
    w1.inputs['Distortion'].default_value = 6 if calm else 14
    w1.inputs['Detail'].default_value = 6
    w1.inputs['Detail Scale'].default_value = 1.8
    w1.inputs['Detail Roughness'].default_value = 0.62
    w2 = nb.n('ShaderNodeTexWave', wave_type='BANDS', bands_direction='X', wave_profile='SIN')
    nb.l(vw, w2.inputs['Vector'])
    w2.inputs['Scale'].default_value = 2.2
    w2.inputs['Distortion'].default_value = 9 if calm else 20
    w2.inputs['Detail'].default_value = 8
    v1 = nb.maprange(w1.outputs['Fac'], 0.0, 0.018 if calm else 0.07, 1.0, 0.0)
    v2 = nb.maprange(w2.outputs['Fac'], 0.0, 0.012 if calm else 0.03, 0.4 if calm else 0.55, 0.0)
    vein_amt = nb.math('MAXIMUM', v1, v2)
    cloud = nb.noise(v, 3.0, 6, 0.6)
    bcol = nb.ramp(cloud.outputs['Fac'], [(0.3, tuple(c * 0.93 for c in base)), (0.7, base)]).outputs['Color']
    col = nb.mixc(vein_amt, bcol, vein)
    h = nb.math('MULTIPLY', vein_amt, -0.3)
    nrm = nb.bump(h, 0.05, 0.001)
    return nb.finish(nb.principled(col, rough, spec=0.55, normal=nrm, coat=coat, coat_rough=0.02))


def m_ceramic(name='ceramic', color=(0.78, 0.75, 0.69), rough=0.35, speckle=True):
    nb = NB(name)
    v = nb.coords('Object', scale=1.0)
    col = color
    if speckle:
        vor = nb.n('ShaderNodeTexVoronoi', feature='F1')
        nb.l(v, vor.inputs['Vector'])
        vor.inputs['Scale'].default_value = 300
        sp = nb.maprange(vor.outputs['Distance'], 0.0, 0.08, 0.0, 1.0)
        col = nb.mixc(sp, (0.18, 0.15, 0.12), color)
    n = nb.noise(v, 40, 3, 0.5)
    nrm = nb.bump(n.outputs['Fac'], 0.04, 0.001)
    return nb.finish(nb.principled(col, rough, spec=0.5, normal=nrm, coat=0.4, coat_rough=0.12))


def m_lemon(name='lemon'):
    nb = NB(name)
    v = nb.coords('Object', offset_random=5.0)
    vor = nb.n('ShaderNodeTexVoronoi', feature='F1')
    nb.l(v, vor.inputs['Vector'])
    vor.inputs['Scale'].default_value = 260
    n = nb.noise(v, 9, 4, 0.5)
    col = nb.ramp(n.outputs['Fac'], [(0.3, (0.62, 0.38, 0.008)), (0.7, (0.80, 0.52, 0.02))]).outputs['Color']
    nrm = nb.bump(vor.outputs['Distance'], 0.25, 0.001)
    return nb.finish(nb.principled(col, 0.38, spec=0.5, normal=nrm, sss=0.25, sss_radius=(1, 0.7, 0.2), sss_scale=0.006))


def m_grass_blade(name='grass_blade', dry=0.25):
    nb = NB(name)
    rnd = obj_random(nb)
    uv = nb.n('ShaderNodeUVMap')
    sep = nb.n('ShaderNodeSeparateXYZ')
    nb.l(uv.outputs['UV'], sep.inputs[0])
    # random per instance colour
    base = nb.ramp(rnd, [(0.0, (0.030, 0.070, 0.012)), (0.45, (0.052, 0.110, 0.020)),
                         (0.8, (0.090, 0.140, 0.028)), (1.0, (0.20, 0.19, 0.07))]).outputs['Color']
    tip = nb.mixc(dry, base, (0.42, 0.36, 0.14))
    col = nb.mixc(sep.outputs['Y'], nb.mixc(0.5, base, (0.0, 0.0, 0.0)), tip)
    p = nb.principled(col, 0.45, spec=0.35)
    tl = nb.n('ShaderNodeBsdfTranslucent')
    nb.l(col, tl.inputs['Color'])
    mix = nb.n('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = 0.32
    nb.l(p.outputs[0], mix.inputs[1])
    nb.l(tl.outputs[0], mix.inputs[2])
    return nb.finish(mix)


def m_soil(name='soil'):
    nb = NB(name)
    v = nb.coords('Object')
    n = nb.noise(v, 12, 8, 0.6)
    col = nb.ramp(n.outputs['Fac'], [(0.35, (0.022, 0.026, 0.010)), (0.65, (0.05, 0.055, 0.02))]).outputs['Color']
    nrm = nb.bump(n.outputs['Fac'], 0.4, 0.01)
    return nb.finish(nb.principled(col, 0.95, spec=0.3, normal=nrm))


# ------------------------------------------------------------- v2 materials

def _cell_random(nb, vec, w, h, offset=0.5):
    """Per-brick random colour from integer cell coordinates (stretcher bond)."""
    sep = nb.n('ShaderNodeSeparateXYZ')
    nb.l(vec, sep.inputs[0])
    row = nb.math('FLOOR', nb.math('DIVIDE', sep.outputs['Y'], h))
    shift = nb.math('MULTIPLY', nb.math('FLOORED_MODULO', row, 2.0), offset)
    col = nb.math('FLOOR', nb.math('ADD', nb.math('DIVIDE', sep.outputs['X'], w), shift))
    comb = nb.n('ShaderNodeCombineXYZ')
    nb.l(col, comb.inputs['X'])
    nb.l(row, comb.inputs['Y'])
    wn = nb.n('ShaderNodeTexWhiteNoise', noise_dimensions='3D')
    nb.l(comb.outputs[0], wn.inputs['Vector'])
    return wn.outputs['Color'], wn.outputs['Value']


def m_brick2(name='brick', axis='XZ', palette='stock'):
    nb = NB(name)
    tc = nb.n('ShaderNodeTexCoord')
    sep = nb.n('ShaderNodeSeparateXYZ')
    nb.l(tc.outputs['Object'], sep.inputs[0])
    comb = nb.n('ShaderNodeCombineXYZ')
    a, b = ('X', 'Z') if axis == 'XZ' else ('Y', 'Z')
    nb.l(sep.outputs[a], comb.inputs['X'])
    nb.l(sep.outputs[b], comb.inputs['Y'])
    nb.l(sep.outputs['Y' if axis == 'XZ' else 'X'], comb.inputs['Z'])
    v = comb.outputs[0]
    br = nb.n('ShaderNodeTexBrick', offset=0.5, offset_frequency=2, squash=1.0, squash_frequency=2)
    nb.l(v, br.inputs['Vector'])
    br.inputs['Color1'].default_value = (1, 1, 1, 1)
    br.inputs['Color2'].default_value = (0, 0, 0, 1)
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = 0.0105
    br.inputs['Mortar Smooth'].default_value = 0.35
    br.inputs['Brick Width'].default_value = 0.225
    br.inputs['Row Height'].default_value = 0.075
    rc, rv = _cell_random(nb, v, 0.225, 0.075)
    rs = nb.n('ShaderNodeSeparateColor')
    nb.l(rc, rs.inputs['Color'])
    if palette == 'stock':
        tones = [(0.0, (0.50, 0.38, 0.22)), (0.18, (0.56, 0.44, 0.27)), (0.34, (0.60, 0.50, 0.33)), (0.5, (0.52, 0.36, 0.20)),
                 (0.62, (0.44, 0.27, 0.15)), (0.72, (0.36, 0.25, 0.20)), (0.8, (0.30, 0.24, 0.22)), (0.9, (0.58, 0.46, 0.30)), (1.0, (0.40, 0.30, 0.19))]
    else:
        tones = [(0.0, (0.42, 0.17, 0.10)), (0.3, (0.48, 0.21, 0.12)), (0.6, (0.38, 0.15, 0.09)), (0.85, (0.30, 0.14, 0.10)), (1.0, (0.52, 0.27, 0.16))]
    bcol = nb.ramp(rs.outputs['Red'], tones, 'CONSTANT').outputs['Color']
    val = nb.maprange(rs.outputs['Green'], 0, 1, 0.82, 1.12)
    n1 = nb.noise(v, 26, 8, 0.68)
    n2 = nb.noise(v, 3.0, 5, 0.6)
    n3 = nb.noise(v, 160, 3, 0.55)
    mott = nb.maprange(n1.outputs['Fac'], 0.25, 0.75, 0.70, 1.22)
    burn = nb.maprange(n2.outputs['Fac'], 0.5, 0.78, 1.0, 0.7)
    f = nb.math('MULTIPLY', nb.math('MULTIPLY', val, mott), burn)
    # flashed bricks: darker ends on some
    flash = nb.math('MULTIPLY', nb.math('GREATER_THAN', rs.outputs['Blue'], 0.78), 0.25)
    f = nb.math('MULTIPLY', f, nb.math('SUBTRACT', 1.0, flash))
    m1 = nb.n('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    nb.i(m1, 'Factor_Float').default_value = 1.0
    nb.l(bcol, nb.i(m1, 'A_Color'))
    nb.l(f, nb.i(m1, 'B_Color'))
    bcol = nb.o(m1, 'Result_Color')
    mort = nb.ramp(n3.outputs['Fac'], [(0.3, (0.33, 0.31, 0.27)), (0.7, (0.50, 0.47, 0.42))]).outputs['Color']
    col = nb.mixc(br.outputs['Fac'], bcol, mort)
    # grime: darker at the base of the wall
    gen = nb.n('ShaderNodeSeparateXYZ')
    nb.l(tc.outputs['Generated'], gen.inputs[0])
    base = nb.maprange(gen.outputs['Z'], 0.0, 0.12, 0.72, 1.0)
    m2 = nb.n('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    nb.i(m2, 'Factor_Float').default_value = 1.0
    nb.l(col, nb.i(m2, 'A_Color'))
    nb.l(base, nb.i(m2, 'B_Color'))
    col = nb.o(m2, 'Result_Color')
    h = nb.math('SUBTRACT', 1.0, br.outputs['Fac'])
    h = nb.math('ADD', h, nb.math('MULTIPLY', n1.outputs['Fac'], 0.35))
    h = nb.math('ADD', h, nb.math('MULTIPLY', n3.outputs['Fac'], 0.2))
    nrm = nb.bump(h, 1.0, 0.008)
    r = nb.maprange(br.outputs['Fac'], 0, 1, 0.8, 0.96)
    return nb.finish(nb.principled(col, r, spec=0.32, normal=nrm))


def m_porcelain2(name='porcelain', tone=(0.33, 0.32, 0.30), rough=0.62, honed=False, warmth=1.0, bump=1.0, coat=0.0):
    """Sandstone-effect porcelain: clouding, riven bands, fine grain and the odd rust fleck."""
    nb = NB(name)
    v = nb.coords('Object', offset_random=41.0)
    rnd = obj_random(nb)
    cloud = nb.noise(v, 0.7, 6, 0.6)
    wav = nb.n('ShaderNodeTexWave', wave_type='BANDS', bands_direction='X', wave_profile='SIN')
    nb.l(v, wav.inputs['Vector'])
    wav.inputs['Scale'].default_value = 1.1
    wav.inputs['Distortion'].default_value = 5.5
    wav.inputs['Detail'].default_value = 5
    wav.inputs['Detail Scale'].default_value = 1.4
    wav.inputs['Detail Roughness'].default_value = 0.65
    fine = nb.noise(v, 9.0, 10, 0.66)
    grain = nb.noise(v, 220, 2, 0.5)
    t = nb.math('ADD', nb.math('MULTIPLY', cloud.outputs['Fac'], 0.55), nb.math('MULTIPLY', wav.outputs['Fac'], 0.3))
    t = nb.math('ADD', t, nb.math('MULTIPLY', nb.math('SUBTRACT', fine.outputs['Fac'], 0.5), 0.5))
    dark = tuple(c * 0.74 for c in tone)
    light = tuple(min(1, c * 1.28) for c in tone)
    warm = (tone[0] * (1 + 0.12 * warmth), tone[1] * (1 + 0.03 * warmth), tone[2] * (1 - 0.08 * warmth))
    col = nb.ramp(t, [(0.22, dark), (0.42, tone), (0.56, warm), (0.7, light), (0.86, tuple(c * 1.1 for c in tone))]).outputs['Color']
    gm = nb.maprange(grain.outputs['Fac'], 0.3, 0.7, 0.86, 1.1)
    m1 = nb.n('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    nb.i(m1, 'Factor_Float').default_value = 1.0
    nb.l(col, nb.i(m1, 'A_Color'))
    nb.l(gm, nb.i(m1, 'B_Color'))
    col = nb.o(m1, 'Result_Color')
    vor = nb.n('ShaderNodeTexVoronoi', feature='F1')
    nb.l(v, vor.inputs['Vector'])
    vor.inputs['Scale'].default_value = 26
    rust = nb.maprange(vor.outputs['Distance'], 0.0, 0.035, 0.55, 0.0)
    rustmask = nb.math('MULTIPLY', rust, nb.math('GREATER_THAN', nb.noise(v, 2.0, 2, 0.5).outputs['Fac'], 0.6))
    col = nb.mixc(rustmask, col, (tone[0] * 1.05, tone[1] * 0.72, tone[2] * 0.45))
    hsv = nb.n('ShaderNodeHueSaturation')
    nb.l(col, hsv.inputs['Color'])
    nb.l(nb.maprange(rnd, 0, 1, 0.9, 1.08), hsv.inputs['Value'])
    nb.l(nb.maprange(rnd, 0, 1, 0.92, 1.06), hsv.inputs['Saturation'])
    col = hsv.outputs['Color']
    if honed:
        r = nb.maprange(fine.outputs['Fac'], 0.3, 0.7, rough - 0.05, rough + 0.06)
    else:
        r = nb.maprange(fine.outputs['Fac'], 0.3, 0.7, rough - 0.1, rough + 0.12)
    rel = nb.noise(v, 34, 6, 0.62)
    micro = nb.noise(v, 520, 2, 0.5)
    h = nb.math('ADD', nb.math('MULTIPLY', rel.outputs['Fac'], 0.7), nb.math('MULTIPLY', micro.outputs['Fac'], 0.3))
    h = nb.math('ADD', h, nb.math('MULTIPLY', wav.outputs['Fac'], 0.25))
    nrm = nb.bump(h, 0.32 * bump if not honed else 0.08 * bump, 0.0012)
    return nb.finish(nb.principled(col, r, spec=0.5, normal=nrm, coat=coat, coat_rough=0.03))


def m_fabric(name, color, sheen=0.6, rough=0.85):
    nb = NB(name)
    v = nb.coords('Object', scale=1.0)
    w = nb.noise(v, 900, 2, 0.5)
    n = nb.noise(v, 6, 4, 0.5)
    col = nb.ramp(n.outputs['Fac'], [(0.3, tuple(c * 0.93 for c in color)), (0.7, color)]).outputs['Color']
    nrm = nb.bump(w.outputs['Fac'], 0.25, 0.0008)
    p = nb.principled(col, rough, spec=0.35, normal=nrm, sheen=sheen)
    p.inputs['Sheen Roughness'].default_value = 0.45
    return nb.finish(p)


def m_grass2(name='lawn2', dry=0.2):
    """Grass with per-blade colour, root shading and patchy lawn variation by position."""
    nb = NB(name)
    oi = nb.n('ShaderNodeObjectInfo')
    rnd = oi.outputs['Random']
    loc = oi.outputs['Location']
    patch = nb.noise(loc, 0.35, 3, 0.5).outputs['Fac']
    patch2 = nb.noise(loc, 1.6, 2, 0.5).outputs['Fac']
    uv = nb.n('ShaderNodeUVMap')
    sep = nb.n('ShaderNodeSeparateXYZ')
    nb.l(uv.outputs['UV'], sep.inputs[0])
    base = nb.ramp(rnd, [(0.0, (0.028, 0.062, 0.010)), (0.4, (0.045, 0.095, 0.016)), (0.75, (0.075, 0.125, 0.022)), (1.0, (0.13, 0.15, 0.04))]).outputs['Color']
    dryc = nb.mixc(nb.maprange(patch, 0.45, 0.7, 0.0, 0.55), base, (0.20, 0.18, 0.07))
    lush = nb.mixc(nb.maprange(patch2, 0.3, 0.6, 0.35, 0.0), dryc, (0.02, 0.05, 0.008))
    tip = nb.mixc(dry, lush, (0.36, 0.32, 0.13))
    col = nb.mixc(sep.outputs['Y'], nb.mixc(0.55, lush, (0.0, 0.0, 0.0)), tip)
    p = nb.principled(col, 0.42, spec=0.38)
    tl = nb.n('ShaderNodeBsdfTranslucent')
    nb.l(col, tl.inputs['Color'])
    mix = nb.n('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = 0.3
    nb.l(p.outputs[0], mix.inputs[1])
    nb.l(tl.outputs[0], mix.inputs[2])
    return nb.finish(mix)


def m_slate(name='slate_roof'):
    """Natural slate roof: 500 mm slates, 250 mm courses, varied blue-greys."""
    nb = NB(name)
    uv = nb.n('ShaderNodeUVMap')
    br = nb.n('ShaderNodeTexBrick', offset=0.5, offset_frequency=2, squash=1.0, squash_frequency=2)
    nb.l(uv.outputs['UV'], br.inputs['Vector'])
    br.inputs['Color1'].default_value = (1, 1, 1, 1)
    br.inputs['Color2'].default_value = (0, 0, 0, 1)
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = 0.004
    br.inputs['Mortar Smooth'].default_value = 0.2
    br.inputs['Brick Width'].default_value = 0.30
    br.inputs['Row Height'].default_value = 0.20
    rv = nb.n('ShaderNodeRGBToBW')
    nb.l(br.outputs['Color'], rv.inputs['Color'])
    col = nb.ramp(rv.outputs['Val'], [(0.0, (0.030, 0.033, 0.038)), (0.4, (0.042, 0.046, 0.052)), (0.75, (0.036, 0.038, 0.042)), (1.0, (0.055, 0.058, 0.062))], 'CONSTANT').outputs['Color']
    n = nb.noise(uv.outputs['UV'], 18, 6, 0.6)
    col = nb.mixc(nb.maprange(n.outputs['Fac'], 0.3, 0.7, 0.0, 0.35), col, (0.075, 0.078, 0.08))
    col = nb.mixc(br.outputs['Fac'], col, (0.01, 0.01, 0.011))
    h = nb.math('ADD', nb.math('SUBTRACT', 1.0, br.outputs['Fac']), nb.math('MULTIPLY', n.outputs['Fac'], 0.2))
    nrm = nb.bump(h, 0.6, 0.004)
    r = nb.maprange(n.outputs['Fac'], 0.3, 0.7, 0.42, 0.62)
    return nb.finish(nb.principled(col, r, spec=0.5, normal=nrm))
