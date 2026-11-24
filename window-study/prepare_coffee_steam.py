"""Bake one animated Blender Bézier plume into a tiled volume texture."""
import math
from pathlib import Path

import bpy
import numpy as np


bpy.ops.wm.read_factory_settings(use_empty=True)
curve = bpy.data.curves.new('Coffee steam centreline', 'CURVE')
curve.dimensions = '3D'
curve.resolution_u = 12
spine = curve.splines.new('BEZIER')
# Cup coordinates in metres, starting at the liquid. One spline for every frame.
knots = np.array([(0, 0, 0), (.003, 0, .027), (-.003, .002, .054),
                  (-.018, .005, .096), (-.012, .008, .135),
                  (.017, .009, .174), (.040, .012, .202)])
spine.bezier_points.add(len(knots) - 1)
plume = bpy.data.objects.new('Steam', curve)
bpy.context.collection.objects.link(plume)

# Each frame contains 8 × 8 horizontal slices. Each slice is 32 × 32 samples.
atlas = np.zeros((4 * 256, 6 * 256), dtype=np.float32)
x = np.linspace(-.09, .09, 32)[None, :]
y = np.linspace(-.07, .07, 32)[:, None]
for frame in range(24):
    phase = math.tau * frame / 24
    for point, (cx, cy, z) in zip(spine.bezier_points, knots):
        h = z / .202
        point.co = (cx + .009 * h * math.sin(6*h - phase),
                    cy + .006 * h * math.cos(5*h - phase), z)
        point.handle_left_type = point.handle_right_type = 'AUTO'
    bpy.context.view_layer.update()
    evaluated = plume.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    path = np.array([v.co[:] for v in mesh.vertices])
    evaluated.to_mesh_clear()
    assert np.all(np.diff(path[:, 2]) > 0)
    for layer, h in enumerate(np.linspace(0, 1, 64)):
        cx, cy = [np.interp(h * .202, path[:, 2], path[:, axis]) for axis in (0, 1)]
        width = (.0049 + .018*h) * (1 + .08 * math.sin(10*h - phase))
        radius_sq = ((x - cx) / width)**2 + ((y - cy) / (.90*width))**2
        # A single density maximum per slice. The top spreads and evaporates.
        density = np.exp(-.5 * radius_sq) * (1 - h**2)**2 * min(1, h/.07)
        row = (frame // 6) * 256 + (layer // 8) * 32
        col = (frame % 6) * 256 + (layer % 8) * 32
        atlas[row:row + 32, col:col + 32] = density

image = bpy.data.images.new('Coffee steam density', atlas.shape[1], atlas.shape[0], alpha=False)
image.colorspace_settings.name = 'Non-Color'
rgba = np.repeat(atlas[:, :, None], 4, axis=2)
rgba[:, :, 3] = 1
image.pixels.foreach_set(rgba.ravel())
image.filepath_raw = str(Path(__file__).parent / 'model/textures/coffee-steam.png')
image.file_format = 'PNG'
image.save()
