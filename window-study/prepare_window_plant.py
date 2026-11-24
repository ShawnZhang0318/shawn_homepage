"""Fit Poly Haven's CC0 Potted Plant 02 foliage and soil to the existing bay planter.

blender -b -P prepare_window_plant.py -- source.gltf leaf-alpha.png window-plant.glb
Use the 1K glTF files and leaves_alpha from https://polyhaven.com/a/potted_plant_02.
The exported origin is at the soil surface; +Z is up in the room's source mesh.
"""
from pathlib import Path
import sys

import bpy
from mathutils import Matrix


source, alpha, output = [Path(p).resolve() for p in sys.argv[sys.argv.index('--')+1:]]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
leaves = bpy.data.objects['potted_plant_02_leaves']
soil = bpy.data.objects['potted_plant_02_dirt']

# Use the separate opacity scan supplied with the asset. The distributed 1K
# JPEG diffuse image has no alpha channel of its own.
material = leaves.data.materials[0]
nodes = material.node_tree.nodes
surface = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
mask = nodes.new('ShaderNodeTexImage')
mask.image = bpy.data.images.load(str(alpha))
mask.image.colorspace_settings.name = 'Non-Color'
material.node_tree.links.new(mask.outputs['Color'], surface.inputs['Alpha'])

for obj in (leaves, soil):
    # The donor pot is wider and shallower. Fit the soil to the existing
    # 174 mm opening while preserving the height and natural arch of the leaves.
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    for vertex in obj.data.vertices:
        p = vertex.co
        scale = .48 if obj == leaves else .43
        p.x *= scale
        p.y *= scale
        p.z = (p.z - .316) * (.535 if obj == leaves else .31)
        if obj == soil:
            radius = p.xy.length
            if radius > .0866:
                p.x *= .0866 / radius
                p.y *= .0866 / radius

# Keep the curled leaf silhouettes at source resolution. Spend fewer faces
# on the hundreds of small soil clumps tucked inside the pot.
bpy.context.view_layer.objects.active = soil
modifier = soil.modifiers.new('Simplify potting mix', 'DECIMATE')
modifier.ratio = .15
modifier.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.ops.object.select_all(action='DESELECT')
leaves.select_set(True)
soil.select_set(True)
bpy.context.view_layer.objects.active = leaves
bpy.ops.object.join()
leaves.name = 'Bay foliage and potting mix'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
                          export_yup=False, export_animations=False, export_cameras=False,
                          export_lights=False, export_image_format='AUTO')
