"""Build the leatherbound About notebook in metres, in the room's Z-up coordinates."""
from math import cos, exp, pi, sin, sqrt
from pathlib import Path

import bpy
import numpy as np

bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat


def packed_image(name, rgb, data=False):
    h, w = rgb.shape[:2]
    image = bpy.data.images.new(name, w, h, alpha=False, is_data=data)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:,:,:3] = rgb
    image.pixels.foreach_set(rgba.ravel())
    image.pack()
    return image


def black_leather():
    """A fine pebbled hide with irregular cell boundaries and sparse pores."""
    mat = material('Black fine-grain calfskin', (.014, .014, .015), .76)
    rng = np.random.default_rng(7)
    h, w, pitch = 768, 512, 4
    y, x = np.mgrid[:h,:w]
    cy, cx = y//pitch, x//pitch
    centres = rng.uniform(.08,.92,(h//pitch,w//pitch,2))
    near = np.full((h,w), np.inf)
    second = near.copy()
    for dy in (-1,0,1):
        for dx in (-1,0,1):
            offsets = centres[(cy+dy)%(h//pitch),(cx+dx)%(w//pitch)]
            d = ((x/pitch-cx-dx-offsets[:,:,0])**2
                 + (y/pitch-cy-dy-offsets[:,:,1])**2)
            second = np.minimum(second,np.maximum(near,d))
            near = np.minimum(near,d)
    furrows = np.exp(-7*(np.sqrt(second)-np.sqrt(near)))
    height = -.32*furrows - .13*(rng.random((h,w)) < .043)
    dy, dx = np.gradient(height)
    normals = np.stack((-dx, -dy, np.ones_like(dx)),axis=-1)
    normals /= np.linalg.norm(normals,axis=-1,keepdims=True)
    nodes = mat.node_tree.nodes
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = packed_image('Calfskin pebbles and pores', normals*.5+.5, True)
    bump = nodes.new('ShaderNodeNormalMap')
    mat.node_tree.links.new(tex.outputs['Color'], bump.inputs['Color'])
    mat.node_tree.links.new(bump.outputs['Normal'], nodes.get('Principled BSDF').inputs['Normal'])
    return mat


leather = black_leather()
welt = material('Black turned leather edge', (.012, .012, .013), .82)
paper = material('Warm cotton paper', (1,1,1), .97)
# One paper stock for the flyleaf, fold and handwritten page.
rng = np.random.default_rng(25)
fibres = rng.normal(0,1,(1116,768))
fibres = (fibres + .6*np.roll(fibres,1,axis=1) + .35*np.roll(fibres,2,axis=1))
paper_rgb = np.clip((np.array([222,205,177]) + 1.6*fibres[:,:,None])/255,0,1)
sheet = paper.node_tree.nodes.new('ShaderNodeTexImage')
sheet.image = packed_image('Uncoated cream paper', paper_rgb)
paper.node_tree.links.new(sheet.outputs['Color'],
                          paper.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
edge_tints = [material(f'Folded section {i}', (k, .86*k, .66*k), .96)
              for i, k in enumerate((.62, .67, .65, .71))]


def grid(name, sample, finish, nu, nv, parent=None, down=False):
    vertices, coords, faces = [], [], []
    for j in range(nv + 1):
        # Denser near the top and bottom to resolve the corner radii.
        v = (1-cos(pi*j/nv))/2
        for i in range(nu + 1):
            u = i/nu
            vertices.append(sample(u, v))
            coords.append((u, 1-v))
            if i < nu and j < nv:
                k = j*(nu+1) + i
                quad = (k, k+1, k+nu+2, k+nu+1)
                faces.append(quad[::-1] if down else quad)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    mesh.materials.append(finish)
    uv = mesh.uv_layers.new(name='Surface')
    for loop in mesh.loops:
        uv.data[loop.index].uv = coords[loop.vertex_index]
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def thicken(obj, depth, edge):
    obj.data.materials.append(edge)
    solid = obj.modifiers.new('Cut section', 'SOLIDIFY')
    solid.thickness = depth
    solid.offset = -1
    solid.material_offset_rim = 1
    return obj


def corner(v, length, radius):
    d = max(0, radius - length*min(v, 1-v))
    return radius - sqrt(max(0, radius*radius-d*d))


def cover_height(u, v):
    return .00143 + u*(.00030*sin(3*pi*v+.6*u) + .00022*cos(2*pi*u))


def cover_surface(u, v):
    inset = corner(v, .229, .009)
    x = u*(.159-inset)
    y = (v-.5)*.229
    return x, y, cover_height(u, v)


def underside(x, y):
    v = y/.229 + .5
    return cover_height(x/(.159-corner(v,.229,.009)), v) - .00285


hinge = bpy.data.objects.new('AboutCoverHinge', None)
bpy.context.collection.objects.link(hinge)
spine_x, spine_z = .0035, .00195
radius = .0108
axis_z = spine_z + radius
stations = 8


def cover_origin(p):
    angle = pi*p
    return (spine_x*cos(angle) - radius*sin(angle),
            axis_z + spine_x*sin(angle) + radius*cos(angle))


hinge.location.x, hinge.location.z = cover_origin(0)
hinge['foldPath'] = [coordinate for i in range(stations+1)
                     for coordinate in cover_origin(i/stations)]
for name, parent in [('Fixed back cover', None), ('Opening front cover', hinge)]:
    board = thicken(grid(name, cover_surface, leather, 24, 48, parent), .00285, welt)
    if parent is None:
        board.location = (spine_x, 0, spine_z)


# The bent strip joins the two cut covers end to end. Outer and inner skins
# change radius through the fold, preserving thickness at every key position.
def fold(u, v, p, face):
    # The closed spine rounds the page block; when open it nests underneath
    # the sewn fold. The covers rotate about the same axis as the leaves.
    end_x, end_z = cover_origin(p)
    angle = pi*p
    reach = .0144*(1-p) + .0024*p
    t = 1-u
    ax, az = spine_x-reach, spine_z
    bx, bz = end_x-reach*cos(angle), end_z-reach*sin(angle)
    x = t**3*spine_x + 3*t*t*u*ax + 3*t*u*u*bx + u**3*end_x
    z = t**3*spine_z + 3*t*t*u*az + 3*t*u*u*bz + u**3*end_z
    dx = t*t*(ax-spine_x) + 2*t*u*(bx-ax) + u*u*(end_x-bx)
    dz = t*t*(az-spine_z) + 2*t*u*(bz-az) + u*u*(end_z-bz)
    d = max(1e-8, (dx*dx+dz*dz)**.5)
    return x+face*.001425*dz/d, (v-.5)*.229, z-face*.001425*dx/d


for name, finish, cross, reverse in [
    ('Spine lining', leather, lambda v:(v,1), True),
    ('Spine outer leather', leather, lambda v:(v,-1), False),
    ('Spine head cut', welt, lambda v:(1,2*v-1), False),
    ('Spine tail cut', welt, lambda v:(0,2*v-1), True),
]:
    def strip(u,v,p):
        y, face = cross(v)
        return fold(u,y,p,face)

    skin = grid(name, lambda u,v: strip(u,v,0), finish, 24, 4, down=reverse)
    for uv in skin.data.uv_layers.active.data:
        uv.uv.x *= .025/.159
    skin.shape_key_add(name='Shut')
    for i in range(1, stations+1):
        shape = skin.shape_key_add(name=f'Fold{i}')
        for j in range(5):
            for k in range(25):
                shape.data[j*25+k].co = strip(k/24, (1-cos(pi*j/4))/2, i/stations)


# Each half fills the space between its cover and the reading surface.
# Both top pages terminate on the same line at the sewing axis. The head,
# tail and fore-edges are sampled directly from the same page family.
nu, nv, layers = 64, 40, 22


def page_point(side, u, v, layer, opened):
    left = side == 'left'
    y = (v-.5)*.220
    # Fan the individual gatherings very slightly at the trimmed edges.
    ripple = .00013*sin(17*pi*layer)
    y += (2*v-1)*ripple*u
    outer = .158 - corner(v,.220,.0037) + ripple
    inner = spine_x*(1-layer)
    x = inner + (outer-inner)*u
    board_x = max(0,x-spine_x)
    bottom = spine_z + (-underside(board_x,y) if left else
                        cover_height(board_x/.159, y/.229+.5))
    # The top sheet rises just beside the sewing, then settles under its
    # own weight. Keep the closed block flat underneath the Work sheet.
    reach = .037 if left else .044
    shoulder = (.0074 if left else .0063)*(1-exp(-u/.037))*exp(-u*.158/reach)
    sag = -.00105*u + .00033*u*u*sin((2.1*v+.32*u)*pi)
    open_profile = shoulder + sag
    shut_profile = -.00016*u
    top = axis_z + shut_profile*(1-opened) + open_profile*opened
    z = bottom + layer*(top-bottom)
    if left:
        # Hinge-local coordinates reflected vertically. After rotation the
        # two gathered blocks open to opposite sides of the sewing axis.
        return x-spine_x,y,spine_z-z
    return x,y,z


def add_relaxed_shape(obj, samples):
    obj.shape_key_add(name='Shut')
    shape = obj.shape_key_add(name='Spread')
    for pt, pos in zip(shape.data,samples):
        pt.co = pos


for side, title in [('left','AboutBlankLeaf'), ('right','AboutWrittenLeaf')]:
    left = side == 'left'
    parent = hinge if left else None
    surface = grid(title, lambda u,v: page_point(side,u,v,1,0),
                   paper,nu,nv,parent,down=left)
    add_relaxed_shape(surface, (page_point(side,i/nu,(1-cos(pi*j/nv))/2,1,1)
                                for j in range(nv+1) for i in range(nu+1)))
    # Soft contact darkening is confined to the last few millimetres at
    # the sewing, where the facing leaves occlude the room light.
    tint = surface.data.color_attributes.new(name='Paper contact',type='FLOAT_COLOR',domain='POINT')
    for i, value in enumerate(tint.data):
        u = (i%(nu+1))/nu
        shade = 1-.26*exp(-u/.031)
        value.color = (shade,shade,shade,1)

    for edge,border,n,reverse in [
        ('fore', lambda s:(1,s), nv, False),
        ('head', lambda s:(s,1), nu, True),
        ('tail', lambda s:(s,0), nu, False),
        ('bound',lambda s:(0,s), nv, True),
    ]:
        shut, relaxed, faces = [], [], []
        for j in range(layers+1):
            t = j/layers
            for i in range(n+1):
                s = (1-cos(pi*i/n))/2 if edge in ('fore','bound') else i/n
                u,v = border(s)
                shut.append(page_point(side,u,v,t,0))
                relaxed.append(page_point(side,u,v,t,1))
                if j<layers and i<n:
                    k = j*(n+1)+i
                    q = (k,k+1,k+n+2,k+n+1)
                    faces.append(q[::-1] if reverse != left else q)
        name = f'{side} {edge} signatures'
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(shut,[],faces)
        mesh.update()
        obj = bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = parent
        for finish in edge_tints:
            mesh.materials.append(finish)
        for face in mesh.polygons:
            row = face.index//n
            face.material_index = (1,2,1,3,1,0,2)[row%7]
        add_relaxed_shape(obj,relaxed)


# Apply only static thickness modifiers so the cut edges and reverse-face
# material slots are exported while the spine keeps its shape keys.
for obj in bpy.context.scene.objects:
    for modifier in list(obj.modifiers):
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)

target = Path(__file__).resolve().parent / 'model/about-notebook.glb'
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', export_extras=True,
                          export_yup=False, export_animations=False)
