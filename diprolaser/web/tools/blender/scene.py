"""Escena de estudio en Blender (Cycles) para renders fotorrealistas de la gorra DIPROLASER.
Se importa desde los scripts de render: build(model, colors) arma todo y devuelve el pivote para girar."""
import bpy, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(HERE, '..', '..'))
HDRI = os.path.join(bpy.utils.system_resource('DATAFILES', path='studiolights/world'), 'studio.exr')

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x / 12.92) if x <= .04045 else ((x + .055) / 1.055) ** 2.4) for x in c) + (1,)

KINDS = {
    #            rugosidad, sheen, sheen_rough, coat, escala bump, fuerza bump
    'tela':   dict(rough=.86, sheen=.55, sheen_rough=.45, coat=0, weave='twill', bump=.30),
    'gamuza': dict(rough=.95, sheen=1.0, sheen_rough=.32, coat=0, weave='suede', bump=.22),
    'poly':   dict(rough=.42, sheen=.25, sheen_rough=.5, coat=.12, weave='fine', bump=.12),
    'malla':  dict(rough=.6, sheen=.3, sheen_rough=.5, coat=0, weave='fine', bump=.12),
}
MODELS = {
    'tela': dict(crown='tela', front='tela', visor='tela'),
    'gamuza': dict(crown='gamuza', front='gamuza', visor='gamuza'),
    'micro': dict(crown='gamuza', front='gamuza', visor='gamuza', perf=True),
    'impermeable': dict(crown='poly', front='poly', visor='poly', perf=True),
    'trucker': dict(crown='malla', front='gamuza', visor='gamuza', mesh=True),
    'bicolor': dict(crown='tela', front='tela', visor='gamuza'),
}

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def node(nt, kind, loc=(0, 0), **inputs):
    n = nt.nodes.new(kind); n.location = loc
    for k, v in inputs.items():
        if k in n.inputs: n.inputs[k].default_value = v
        else: setattr(n, k, v)
    return n

def math_node(nt, op, a, b=None, loc=(0, 0), clamp=False):
    n = nt.nodes.new('ShaderNodeMath'); n.operation = op; n.location = loc; n.use_clamp = clamp
    for i, v in enumerate([a, b]):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: nt.links.new(v, n.inputs[i])
    return n.outputs[0]

def uvmap(nt, name):
    n = nt.nodes.new('ShaderNodeUVMap'); n.uv_map = name
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(n.outputs[0], sep.inputs[0])
    return sep.outputs[0], sep.outputs[1]

def row_mask(nt, d, c, w):
    # 1 dentro de la fila de pespunte centrada en c, ancho w
    diff = math_node(nt, 'SUBTRACT', d, c); ad = math_node(nt, 'ABSOLUTE', diff)
    s = math_node(nt, 'SUBTRACT', ad, w * .5); s = math_node(nt, 'DIVIDE', s, w * .5)
    return math_node(nt, 'SUBTRACT', 1.0, s, clamp=True)

def dash(nt, a, per, on):
    f = math_node(nt, 'DIVIDE', a, per); f = math_node(nt, 'FRACT', f)
    return math_node(nt, 'LESS_THAN', f, on)

def fabric_material(name, kind, color, role, uvnames, perforated=False, mesh=False, aov_part=1.0, decal=False):
    K = KINDS[kind]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = node(nt, 'ShaderNodeOutputMaterial', (900, 0))
    bsdf = node(nt, 'ShaderNodeBsdfPrincipled', (500, 0))
    bsdf.inputs['Base Color'].default_value = srgb(color)
    bsdf.inputs['Roughness'].default_value = K['rough']
    bsdf.inputs['Sheen Weight'].default_value = K['sheen']
    bsdf.inputs['Sheen Roughness'].default_value = K['sheen_rough']
    bsdf.inputs['Sheen Tint'].default_value = (1, 1, 1, 1)
    bsdf.inputs['Coat Weight'].default_value = K['coat']
    # textura de tejido en coordenadas del objeto (1 unidad = 10 cm)
    tc = node(nt, 'ShaderNodeTexCoord', (-1400, 0))
    if K['weave'] == 'twill':
        wv = node(nt, 'ShaderNodeTexWave', (-1100, 200), wave_type='BANDS', bands_direction='DIAGONAL')
        wv.inputs['Scale'].default_value = 95; wv.inputs['Distortion'].default_value = 1.2; wv.inputs['Detail'].default_value = 1
        nt.links.new(tc.outputs['Object'], wv.inputs['Vector'])
        nz = node(nt, 'ShaderNodeTexNoise', (-1100, -50)); nz.inputs['Scale'].default_value = 900; nz.inputs['Detail'].default_value = 2
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        h = math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', wv.outputs['Fac'], .8), math_node(nt, 'MULTIPLY', nz.outputs['Fac'], .5))
    elif K['weave'] == 'suede':
        nz = node(nt, 'ShaderNodeTexNoise', (-1100, -50)); nz.inputs['Scale'].default_value = 700; nz.inputs['Detail'].default_value = 6; nz.inputs['Roughness'].default_value = .7
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        nz2 = node(nt, 'ShaderNodeTexNoise', (-1100, 150)); nz2.inputs['Scale'].default_value = 22; nz2.inputs['Detail'].default_value = 3
        nt.links.new(tc.outputs['Object'], nz2.inputs['Vector'])
        h = math_node(nt, 'ADD', nz.outputs['Fac'], math_node(nt, 'MULTIPLY', nz2.outputs['Fac'], .35))
        # variación de tono de la gamuza
        mix = node(nt, 'ShaderNodeMix', (200, 250)); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = .35; mix.inputs[6].default_value = srgb(color)
        ramp = node(nt, 'ShaderNodeMapRange', (0, 250)); ramp.inputs['To Min'].default_value = .8; ramp.inputs['To Max'].default_value = 1.15
        nt.links.new(nz2.outputs['Fac'], ramp.inputs['Value'])
        cmb = node(nt, 'ShaderNodeCombineColor', (100, 350))
        for i in range(3): nt.links.new(ramp.outputs[0], cmb.inputs[i])
        nt.links.new(cmb.outputs[0], mix.inputs[7])
        nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    else:
        wv = node(nt, 'ShaderNodeTexWave', (-1100, 200), wave_type='BANDS', bands_direction='X')
        wv.inputs['Scale'].default_value = 260
        nt.links.new(tc.outputs['Object'], wv.inputs['Vector'])
        h = math_node(nt, 'MULTIPLY', wv.outputs['Fac'], .5)
    # pespuntes
    thread = None
    if role in ('crown', 'front'):
        sd, al = uvmap(nt, uvnames[1]); ed, ar = uvmap(nt, uvnames[2])
        r1 = math_node(nt, 'MAXIMUM', row_mask(nt, sd, .016, .0028), row_mask(nt, sd, .03, .0028))
        t1 = math_node(nt, 'MULTIPLY', r1, dash(nt, al, .034, .76))
        r2 = math_node(nt, 'MAXIMUM', row_mask(nt, ed, .035, .003), row_mask(nt, ed, .05, .003))
        t2 = math_node(nt, 'MULTIPLY', r2, dash(nt, ar, .034, .76))
        thread = math_node(nt, 'MAXIMUM', t1, t2)
    elif role in ('visorTop', 'visorBottom'):
        s_, t_ = uvmap(nt, uvnames[0]); _, al = uvmap(nt, uvnames[1])
        acc = None
        for k in range(8):
            r = row_mask(nt, t_, .955 - k * .072, .0062)
            acc = r if acc is None else math_node(nt, 'MAXIMUM', acc, r)
        thread = math_node(nt, 'MULTIPLY', acc, dash(nt, al, .036, .78))
    if thread is not None:
        h = math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', h, .5), math_node(nt, 'MULTIPLY', thread, 1.6))
        # el hilo es apenas más claro y más brillante que la tela
        tm = node(nt, 'ShaderNodeMix', (300, 120)); tm.data_type = 'RGBA'; tm.blend_type = 'MIX'
        nt.links.new(thread, tm.inputs['Factor'])
        base_link = bsdf.inputs['Base Color'].links[0].from_socket if bsdf.inputs['Base Color'].is_linked else None
        if base_link: nt.links.new(base_link, tm.inputs[6])
        else: tm.inputs[6].default_value = srgb(color)
        c = srgb(color); tm.inputs[7].default_value = (min(1, c[0] * 1.5 + .012), min(1, c[1] * 1.5 + .012), min(1, c[2] * 1.5 + .012), 1)
        nt.links.new(tm.outputs[2], bsdf.inputs['Base Color'])
    bump = node(nt, 'ShaderNodeBump', (200, -250)); bump.inputs['Strength'].default_value = K['bump']; bump.inputs['Distance'].default_value = .002
    nt.links.new(h, bump.inputs['Height']); nt.links.new(bump.outputs[0], bsdf.inputs['Normal'])
    shader = bsdf.outputs[0]
    # perforaciones o malla: huecos reales (transparencia)
    if perforated or mesh:
        tex = node(nt, 'ShaderNodeTexVoronoi' if perforated else 'ShaderNodeTexWave', (-600, -500))
        if perforated:
            tex.feature = 'F1'; tex.inputs['Scale'].default_value = 26; tex.inputs['Randomness'].default_value = 0
            nt.links.new(tc.outputs['Object'], tex.inputs['Vector'])
            hole = math_node(nt, 'LESS_THAN', tex.outputs['Distance'], .17)
        else:
            vor = node(nt, 'ShaderNodeTexVoronoi', (-600, -700)); vor.feature = 'DISTANCE_TO_EDGE'; vor.inputs['Scale'].default_value = 70; vor.inputs['Randomness'].default_value = 0
            nt.links.new(tc.outputs['Object'], vor.inputs['Vector'])
            hole = math_node(nt, 'GREATER_THAN', vor.outputs['Distance'], .12)
        tr = node(nt, 'ShaderNodeBsdfTransparent', (500, -300))
        mx = node(nt, 'ShaderNodeMixShader', (700, 0))
        nt.links.new(hole, mx.inputs[0]); nt.links.new(shader, mx.inputs[1]); nt.links.new(tr.outputs[0], mx.inputs[2])
        shader = mx.outputs[0]
    nt.links.new(shader, out.inputs['Surface'])
    # AOVs: parte (para recolorear) y coordenadas del logo en el frente
    aov = node(nt, 'ShaderNodeOutputAOV', (900, -300)); aov.aov_name = 'part'
    aov.inputs['Value'].default_value = aov_part
    if decal:
        u, v = uvmap(nt, uvnames[0])
        du = math_node(nt, 'ADD', math_node(nt, 'DIVIDE', math_node(nt, 'SUBTRACT', u, 0.0), .64), .5)
        dv = math_node(nt, 'ADD', math_node(nt, 'DIVIDE', math_node(nt, 'SUBTRACT', v, .6), .64), .5)
        cc = node(nt, 'ShaderNodeCombineXYZ', (700, -500)); nt.links.new(du, cc.inputs[0]); nt.links.new(dv, cc.inputs[1])
        aov2 = node(nt, 'ShaderNodeOutputAOV', (900, -500)); aov2.aov_name = 'decal'
        nt.links.new(cc.outputs[0], aov2.inputs['Color'])
    return m

def simple_material(name, color, rough=.5, metal=0, coat=0, image=None, aov_part=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = node(nt, 'ShaderNodeOutputMaterial', (600, 0)); bsdf = node(nt, 'ShaderNodeBsdfPrincipled', (300, 0))
    bsdf.inputs['Base Color'].default_value = srgb(color); bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal; bsdf.inputs['Coat Weight'].default_value = coat
    shader = bsdf.outputs[0]
    if image:
        tx = node(nt, 'ShaderNodeTexImage', (0, 0)); tx.image = bpy.data.images.load(image)
        nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color'])
        tr = node(nt, 'ShaderNodeBsdfTransparent', (300, -200)); mx = node(nt, 'ShaderNodeMixShader', (450, 0))
        nt.links.new(tx.outputs['Alpha'], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(shader, mx.inputs[2])
        shader = mx.outputs[0]
    nt.links.new(shader, out.inputs['Surface'])
    aov = node(nt, 'ShaderNodeOutputAOV', (600, -200)); aov.aov_name = 'part'; aov.inputs['Value'].default_value = aov_part
    return m

def build(model='tela', colors=None, samples=96, res=720):
    colors = colors or dict(crown='#141416', visor='#141416', under='#c81e28')
    M = MODELS[model]
    reset()
    sc = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=os.path.join(WEB, 'build', 'cap.gltf'))
    objs = [o for o in sc.objects if o.type == 'MESH']
    uvn = [uv.name for uv in objs[0].data.uv_layers]
    pivot = bpy.data.objects.new('pivot', None); sc.collection.objects.link(pivot)
    for o in objs:
        o.parent = pivot
        for p in o.data.polygons: p.use_smooth = True
    mats = {
        'front': fabric_material('front', M['front'], colors['crown'], 'front', uvn, aov_part=1, decal=True),
        'crown': fabric_material('crown', M['crown'], colors['crown'], 'crown', uvn, perforated=M.get('perf', False), mesh=M.get('mesh', False), aov_part=1),
        'visorTop': fabric_material('visorTop', M['visor'], colors['visor'], 'visorTop', uvn, aov_part=2),
        'visorBottom': fabric_material('visorBottom', M['visor'], colors['under'], 'visorBottom', uvn, aov_part=3),
        'edge': fabric_material('edge', M['visor'], colors['visor'], 'edge', uvn, aov_part=2),
        'button': fabric_material('button', M['front'], colors['crown'], 'button', uvn, aov_part=1),
        'bind': fabric_material('bind', M['front'] if M['front'] != 'malla' else 'tela', colors['crown'], 'bind', uvn, aov_part=1),
        'sweat': simple_material('sweat', '#0d0d0f', rough=.8),
        'plastic': simple_material('plastic', '#0c0c0e', rough=.32, coat=.6),
        'hole': simple_material('hole', '#020202', rough=1),
        'label': simple_material('label', '#ffffff', rough=.3, metal=.55, coat=.6, image=os.path.join(WEB, 'build', 'img', 'label.png')),
        'eyelet': fabric_material('eyelet', 'tela', colors['crown'], 'eyelet', uvn, aov_part=1),
    }
    pick = {'front': 'front', 'sideL': 'crown', 'sideR': 'crown', 'backL': 'crown', 'backR': 'crown', 'visorTop': 'visorTop', 'visorBottom': 'visorBottom', 'visorEdge': 'edge', 'button': 'button', 'bindBase': 'bind', 'bindArch': 'bind', 'sweat': 'sweat', 'label': 'label'}
    for o in objs:
        n = o.name.split('.')[0]
        key = pick.get(n) or ('eyelet' if n.startswith('eyelet') else 'hole' if n.startswith('hole') else 'plastic' if n.startswith('snap') else None)
        o.data.materials.clear(); o.data.materials.append(mats[key or 'plastic'])
        if key in ('crown', 'front'):
            sol = o.modifiers.new('grosor', 'SOLIDIFY'); sol.thickness = .006; sol.offset = -1; sol.use_even_offset = True
    # piso que solo recibe sombra
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -.64))
    floor = bpy.context.active_object; floor.is_shadow_catcher = True
    # luces de estudio: softbox principal, relleno, contraluz cálido-rojo de marca
    def area(name, loc, size, power, color=(1, 1, 1), target=(0, 0, -.1)):
        d = bpy.data.lights.new(name, 'AREA'); d.size = size; d.energy = power; d.color = color; d.shape = 'DISK'
        o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.location = loc
        dirv = Vector(target) - Vector(loc); o.rotation_euler = dirv.to_track_quat('-Z', 'Y').to_euler()
        return o
    area('key', (-3.2, -4.2, 3.6), 3.5, 900)
    area('fill', (4.2, -3.0, 1.2), 4.0, 220)
    area('rim', (2.6, 3.8, 2.4), 2.0, 520, (1, .42, .42))
    area('top', (0, 0, 5.5), 4.0, 160)
    # mundo: estudio tenue para reflejos
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; wt = w.node_tree
    bg = wt.nodes['Background']; env = wt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(HDRI)
    wt.links.new(env.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = .35
    # cámara
    cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 70
    cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
    # render
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
    sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 6; sc.cycles.transparent_max_bounces = 16
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'None'
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    return dict(scene=sc, pivot=pivot, cam=cam, mats=mats)

def place_camera(cam, yaw_deg=35, pitch_deg=14, dist=7.4, target=(0, -.32, -.08)):
    # yaw: 0 = de frente (la gorra mira hacia -Y en Blender); positivo = hacia su lado izquierdo
    y, p = math.radians(yaw_deg), math.radians(pitch_deg)
    t = Vector(target)
    cam.location = t + Vector((math.sin(y) * math.cos(p) * dist, -math.cos(y) * math.cos(p) * dist, math.sin(p) * dist))
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()
