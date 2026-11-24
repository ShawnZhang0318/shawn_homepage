"""Blender cotton-stock business card, all print on the front; original desk anchor."""
import json
from pathlib import Path
import bpy

HERE=Path(__file__).resolve().parent
DEST=HERE/'model'
bpy.ops.wm.read_factory_settings(use_empty=True)

def finish(name,rgb,rough=.88):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    shader=mat.node_tree.nodes.get('Principled BSDF')
    color=[v/255 for v in rgb]
    color=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in color]
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=rough
    return mat

edge=finish('Name card / cotton stock edge',(203,193,172))
front=finish('Name card / front print',(222,215,199))
nodes=front.node_tree.nodes;shader=nodes.get('Principled BSDF')
ink=nodes.new('ShaderNodeTexImage');ink.image=bpy.data.images.load(str(DEST/'textures/business-card-front.png'));ink.image.pack()
front.node_tree.links.new(ink.outputs['Color'],shader.inputs['Base Color'])
grain=nodes.new('ShaderNodeTexImage');grain.image=bpy.data.images.load(str(DEST/'textures/business-card-grain.png'));grain.image.colorspace_settings.name='Non-Color';grain.image.pack()
normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.12
front.node_tree.links.new(grain.outputs['Color'],normal.inputs['Color']);front.node_tree.links.new(normal.outputs['Normal'],shader.inputs['Normal'])

bpy.ops.mesh.primitive_cube_add(size=1,location=(1.565,.580,.740275))
card=bpy.context.object;card.name='Cotton stock 90 x 55 mm';card.dimensions=(.09,.055,.00055)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
card.data.materials.append(edge)
mod=card.modifiers.new('Soft die-cut paper edges','BEVEL');mod.width=.00016;mod.segments=3
bpy.ops.object.modifier_apply(modifier=mod.name)
points=[(1.5202,.6073,.74058),(1.6098,.6073,.74058),(1.6098,.5527,.74058),(1.5202,.5527,.74058)]
mesh=bpy.data.meshes.new('Front-only printed face');mesh.from_pydata(points,[],[(0,2,1),(0,3,2)]);mesh.update()
uv=mesh.uv_layers.new(name='Print UV');coords=[(0,0),(1,0),(1,1),(0,1)]
for loop in mesh.loops:uv.data[loop.index].uv=coords[loop.vertex_index]
face=bpy.data.objects.new('Business card front',mesh);bpy.context.collection.objects.link(face);face.data.materials.append(front)
face['emailRegionUV']=[.07,.07,.93,.32]
bpy.ops.wm.save_as_mainfile(filepath=str(DEST/'business-card.blend'))
bpy.ops.export_scene.gltf(filepath=str(DEST/'business-card.glb'),export_format='GLB',export_yup=False,export_extras=True,
                         export_animations=False,export_lights=False,export_cameras=False)
(DEST/'business-card-review.json').write_text(json.dumps({'sizeM':[.09,.055,.00055],'deskPlaneM':.740,
    'contentSide':'front only','email':'shawn_0318@163.com','placement':'Original P03 anchor, existing notebook clearance shift retained',
    'source':'Blender authored cotton-stock geometry and locally typeset artwork','visualApproval':'Pending user review'},indent=2),encoding='utf8')
print('FRONT-ONLY BUSINESS CARD EXPORTED')
