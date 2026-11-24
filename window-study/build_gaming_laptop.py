"""Blender-authored gaming laptop shell, retaining the installed LCD and key legends.

Run: D:/Develop/blender.exe -b --python-exit-code 1 -P build_gaming_laptop.py
Coordinates are the original room's metres / Z-up, before the existing desk rotation.
"""
import json
import math
import struct
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE=Path(__file__).resolve().parent
DEST=HERE/'model'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1
bpy.context.preferences.filepaths.save_version=0
materials={}

def finish(name,hex_color,rough=.55,metal=.2):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    rgb=np.array(list(bytes.fromhex(hex_color)),dtype=float)/255
    rgb=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
    shader=mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*rgb,1)
    shader.inputs['Metallic'].default_value=metal
    shader.inputs['Roughness'].default_value=rough
    materials[name]=mat
    return mat

shell=finish('Gaming laptop / satin graphite','525963',.40,.48)
deck=finish('Gaming laptop / anodized gunmetal deck','515964',.47,.36)
black=finish('Gaming laptop / recessed polymer','171b21',.78,.02)
alloy=finish('Gaming laptop / bead blasted edges','676e75',.48,.64)
pad=finish('Gaming laptop / glass touchpad','343b44',.45,.1)
gasket=finish('Gaming laptop / keyboard well','10151b',.87,0)
blue=finish('Gaming laptop / restrained keyboard light','8cabb9',.5,.05)
blue.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(.20,.29,.34,1)
blue.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.24

def mesh_object(name,points,faces,mat):
    data=bpy.data.meshes.new(name);data.from_pydata(points,[],faces);data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
    return obj

def bevel(obj,radius,segments=3):
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Machined edge radius','BEVEL');mod.width=radius;mod.segments=segments
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in obj.data.polygons:face.use_smooth=True
    mod=obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=40
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def box(name,center,size,mat,radius=.0007,basis=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center);obj=bpy.context.object;obj.name=name
    if basis is not None:obj.rotation_euler=Matrix(basis).transposed().to_euler()
    obj.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    if radius:bevel(obj,min(radius,min(size)*.42))
    return obj

def chassis_ring(inset, rear_z, front_z):
    left, right = 2.743+inset, 3.117-inset
    rear, front = .193+inset, .456-inset
    corners = [(left+.019,rear), (right-.019,rear), (right,rear+.015),
               (right,front-.006), (right-.006,front), (left+.006,front),
               (left,front-.006), (left,rear+.015)]
    return [(x,y,rear_z+(front_z-rear_z)*(y-rear)/(front-rear)) for x,y in corners]

def ring_shell(name, rings, mat, radius):
    n=len(rings[0])
    faces=[tuple(reversed(range(n))), tuple(range((len(rings)-1)*n,len(rings)*n))]
    for level in range(len(rings)-1):
        a=level*n
        faces.extend((a+i,a+(i+1)%n,a+(i+1)%n+n,a+i+n) for i in range(n))
    return bevel(mesh_object(name,[point for ring in rings for point in ring],faces,mat),radius,2)

# The side silhouette narrows from the rear cooling chamber to a lifted front lip.
body=ring_shell('Faceted magnesium lower tub', [
    chassis_ring(.006,.743,.7465),chassis_ring(.0008,.7465,.7515),
    chassis_ring(0,.7576,.7576)],shell,.0006)
ring_shell('Inset assembly seam',[chassis_ring(.001,.7576,.7576),
           chassis_ring(.001,.7583,.7583)],black,.00016)
ring_shell('Overhanging palm deck',[chassis_ring(0,.7583,.7583),
           chassis_ring(0,.7599,.7599),chassis_ring(.0006,.7605,.7605)],deck,.00025)

# Actual side and rear exhaust openings, cut into the chassis rather than painted on.
cutters=[]
for x in [2.743,3.117]:
    for i in range(9):
        cutters.append(box('Vent cutter',(x,.221+i*.0048,.7515),(.009,.0027,.0068),black,0))
for x in [2.800,3.060]:
    cutters.append(box('Rear outlet cutter',(x,.195,.7515),(.068,.012,.008),black,0))
for y in (.286,.308):
    cutters.append(box('Type A socket cutter',(2.744,y,.753),(.012,.014,.0054),black,.00045))
cutters.append(box('Type C socket cutter',(3.116,.286,.753),(.012,.009,.0038),black,.0014))
bpy.ops.object.select_all(action='DESELECT')
for obj in cutters:obj.select_set(True)
bpy.context.view_layer.objects.active=cutters[0];bpy.ops.object.join();cutter=bpy.context.object
bpy.context.view_layer.objects.active=body
mod=body.modifiers.new('Functional exhaust recesses','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
for y in (.286,.308):
    box('USB-A dark socket insert',(2.747,y,.7536),(.005,.011,.0014),black,.0002)
box('USB-C contact tongue',(3.113,.286,.753),(.004,.0064,.0007),alloy,.0002)
for x in [2.747,3.113]:box('Dark backing inside side outlet',(x,.241,.7515),(.001,.052,.008),black,.0002)
for x in [2.800,3.060]:
    box('Recessed rear outlet backing',(x,.199,.7515),(.068,.001,.008),black,.0002)
    for i in range(13):box('Rear exhaust vane',(x-.029+i*.0048,.196,.7515),(.0012,.005,.007),black,.0002)

# Two shallow banks of slanted ribs leave an open centre between the hinges.
for x in [2.807,3.053]:
    intake_length=.063
    box('Inset cooling grille',(x,.223,.76057),(intake_length,.0065,.00014),gasket,.00005)
    for i in range(16):
        rib=box('Diagonal cooling rib',(x-.028+i*.0037,.223,.76077),(.0011,.0068,.00032),deck,.0001)
        rib.rotation_euler.z=math.radians(22 if x<2.93 else -22)

# Four rubber feet touch the unchanged 740 mm desktop plane.
for x in [2.776,3.084]:
    for y in [.218,.430]:
        top=.743+(.7465-.743)*(y-.199)/(.450-.199)+.00025
        box('Desk contact foot',(x,y,(.740+top)/2),(.029,.012,top-.740),black,.001)

# Smaller twin pivots and rigid lid stays connect the display heel to the deck.
for x in [2.7925,3.0675]:
    box('Hinge mounting shoe',(x,.202,.7623),(.035,.013,.0038),shell,.0015)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.0055,depth=.037,location=(x,.202,.768),rotation=(0,math.pi/2,0))
    pin=bpy.context.object;pin.name='Separate hinge barrel';pin.data.materials.append(alloy);bevel(pin,.0006,2)
    foot=[(x+dx,.202+dy,.768) for dx,dy in [(-.012,-.003),(.012,-.003),(.012,.003),(-.012,.003)]]
    heel=[(x+dx,.205+dy,.786) for dx,dy in [(-.009,-.0028),(.009,-.0028),(.009,.0028),(-.009,.0028)]]
    ring_shell('Tapered hinge arm',[foot,heel],shell,.0009)

# Match the existing active screen exactly; only its housing is replaced.
X=Vector((1,0,0));up=Vector((0,-.069784,.226875)).normalized();normal=X.cross(up)
if normal.y<0:normal=-normal
center=Vector((2.93,.1686819866,.9077125192))
half_w=.3440799713/2;half_h=Vector((0,-.069784,.226875)).length/2
basis=[X,up,X.cross(up)]  # Right-handed rotation; the shell thickness is symmetric.
def lid_ring(width, bottom, top, depth, corner):
    profile=[(-width+corner,bottom),(width-corner,bottom),(width,bottom+corner),
             (width,top-corner),(width-corner,top),(-width+corner,top),
             (-width,top-corner),(-width,bottom+corner)]
    return [center+x*X+y*up+depth*normal for x,y in profile]

outer=lid_ring(half_w+.0058,-half_h-.013,half_h+.006,.0006,.0035)
rim=lid_ring(half_w+.0058,-half_h-.013,half_h+.006,-.0032,.0035)
rear=lid_ring(half_w+.0036,-half_h-.0108,half_h+.0038,-.0058,.0035)
ring_shell('Folded aluminium lid with bevelled perimeter',[rear,rim],shell,.00035)
# One continuous front frame. Its central aperture is real geometry.
inner=lid_ring(half_w-.00015,-half_h+.00015,half_h-.00015,.0006,.00015)
rings=[rim,outer,inner]
faces=[(j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i) for j in range(2) for i in range(8)]
bezel=mesh_object('Continuous fine display bezel',[p for ring in rings for p in ring],faces,black)
# The front face points toward the room seat, including after the room mirror.
for poly in bezel.data.polygons:
    if poly.index>=8 and poly.normal.dot(normal)<0: poly.flip()
webcam=center+(half_h+.0032)*up+normal*.00075
box('Webcam aperture',webcam,(.0038,.0019,.00035),gasket,.00016,basis)

# Reuse the original sculpted keycaps, ANSI legends and UVs, but fill the deck
# more naturally: 18% deeper keyboard and 18 mm less unused rear deck.
raw=(DEST/'room-river-facades.glb').read_bytes();json_len=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+json_len]);buf=memoryview(raw)[28+json_len:]
def attribute(index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    count={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];dtype={5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
    return np.frombuffer(buf,dtype=dtype,offset=v.get('byteOffset',0)+a.get('byteOffset',0),count=a['count']*count).reshape(-1,count).copy()
original=next(m for m in doc['meshes'] if m.get('name')=='E06')
primitive=next(p for p in original['primitives'] if doc['materials'][p['material']]['name']=='keyboardkeys')
points=attribute(primitive['attributes']['POSITION']).astype(float)
points[:,1]=(points[:,1]-.32274)*1.18+.2955
points[:,2]+=.0018
faces=attribute(primitive['indices']).reshape(-1,3)
uv=attribute(primitive['attributes']['TEXCOORD_0'])
uv[:,1]=1-uv[:,1]  # glTF V starts at the top; Blender's image UV starts at the bottom.
key_mat=finish('Gaming laptop / original crisp key legends','ffffff',.68,0)
tex_id=doc['materials'][primitive['material']]['pbrMetallicRoughness']['baseColorTexture']['index']
img=doc['images'][doc['textures'][tex_id]['source']];view=doc['bufferViews'][img['bufferView']]
texture_file=DEST/'textures/gaming-laptop-keycaps.png';texture_file.write_bytes(bytes(buf[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]))
image=bpy.data.images.load(str(texture_file));image.pack()
node=key_mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
shader=key_mat.node_tree.nodes.get('Principled BSDF');key_mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
key_mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Emission Color']);shader.inputs['Emission Strength'].default_value=.12
keys=mesh_object('Reproportioned sculpted keyboard',points,faces,key_mat)
layer=keys.data.uv_layers.new(name='UVMap')  # Same active UV name as the joined chassis meshes.
for loop in keys.data.loops:layer.data[loop.index].uv=uv[loop.vertex_index]
wasd=finish('Gaming laptop / smoked slate WASD','576878',.62,.12)
wasd_ink=wasd.node_tree.nodes.new('ShaderNodeTexImage');wasd_ink.image=image
wasd_shader=wasd.node_tree.nodes.get('Principled BSDF')
wasd.node_tree.links.new(wasd_ink.outputs['Color'],wasd_shader.inputs['Emission Color'])
wasd_shader.inputs['Emission Strength'].default_value=.75
keys.data.materials.append(wasd)
# These UV rectangles enclose the four complete keys in the original legend atlas.
w_mask=(uv[:,0]>.121)&(uv[:,0]<.161)&(uv[:,1]>.529)&(uv[:,1]<.661)
asd_mask=(uv[:,0]>.090)&(uv[:,0]<.212)&(uv[:,1]>.385)&(uv[:,1]<.518)
accent=w_mask|asd_mask
for face in keys.data.polygons:
    face.use_smooth=True
    indices=list(face.vertices)
    assert accent[indices].all() or not accent[indices].any(), 'Partial WASD key face'
    if accent[indices[0]]: face.material_index=1
keybed=finish('Gaming laptop / graphite keyboard surround','363d46',.62,.20)
box('Recessed keyboard bed',(2.929,.2955,.76059),(.322,.118,.00018),keybed,.00007)

box('Touchpad shadow gap',(2.909,.402,.76067),(.120,.064,.00032),black,.00013)
box('Frosted glass trackpad',(2.909,.402,.76088),(.1185,.0625,.00025),pad,.00010)
box('Power button',(3.094,.224,.7610),(.012,.0055,.001),black,.00035)
box('Power indicator',(3.094,.224,.7616),(.004,.0007,.0002),blue,.00007)

# Keep a non-exported guide for the original LCD aperture in the editable source.
screen_points=attribute(next(p for p in original['primitives'] if doc['materials'][p['material']]['name']=='E06 / working LCD')['attributes']['POSITION'])
guide=mesh_object('REFERENCE ONLY - original interactive LCD',screen_points,[(0,2,1),(0,3,2)],black)
guide['runtimeReferenceOnly']=True;guide.hide_render=True
del raw,buf,doc

bpy.context.view_layer.update()
authored=[o for o in scene.objects if o.type=='MESH' and o!=guide]
minimum=min((o.matrix_world@v.co).z for o in authored for v in o.data.vertices)
assert abs(minimum-.740)<.00002,minimum
assert points[:,1].min()>.230 and points[:,1].max()<.357
report={'scope':'Local Blender prop revision only; existing room and LCD unchanged','style':'Restrained gaming laptop, satin graphite, twin hinge, narrow rear intake',
        'bodyWidthM':.374,'bodyDepthM':.263,'rearIntakeDepthM':.0065,'keyboardDepthBeforeM':.09724,'keyboardDepthAfterM':float(np.ptp(points[:,1])),
        'deskSupportPlaneM':.740,'evaluatedMinimumZ':minimum,'activeLCD':'Original runtime LCD retained at its exact original vertices',
        'visualApproval':'Pending user review','objects':len(authored),'triangles':sum(len(p.vertices)-2 for o in authored for p in o.data.polygons)}
(DEST/'gaming-laptop-review.json').write_text(json.dumps(report,indent=2),encoding='utf8')
bpy.ops.wm.save_as_mainfile(filepath=str(DEST/'gaming-laptop.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in authored:obj.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.object.join()
bpy.context.object.name='Gaming laptop authored assembly'
bpy.ops.export_scene.gltf(filepath=str(DEST/'gaming-laptop.glb'),export_format='GLB',use_selection=True,export_yup=False,
                         export_extras=True,export_animations=False,export_lights=False,export_cameras=False)
print('GAMING LAPTOP COMPLETE',json.dumps(report))
