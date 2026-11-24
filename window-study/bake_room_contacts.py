"""Blender Cycles bake for the closed, furnished room. Called by room_finishes.py."""
import json
import math
from pathlib import Path
import struct
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector


def receiving(name, mat):
    furniture = name.startswith(('A01','A02','A03','A04','T01','T02','T03','T04','S01','S02'))
    architecture = name.startswith(('WALL','CEILING','FLOOR','CROWN','D1')) or name in ('W1','W2','W3','D02')
    return (furniture or architecture or name in ('M04','M05')) and mat in {
        'cream','trim','wood','wooddark','woodlight','joinery','joinery-worktop','cabinet',
        'stone','parquet','rugweave','blue','cloth','checkedwool','oatlinen'}


args = sys.argv[sys.argv.index('--')+1:]
source, directory = (Path(p).resolve() for p in args[:2])
# Optional runtime placement matrices (Three.js column-major) for a local
# rebake on the existing worktop and ceiling UV islands.
placements = json.loads(Path(args[2]).read_text(encoding='utf8')) if len(args)>2 else {}
desk_insert = Path(args[3]) if len(args)>3 else None
raw = source.read_bytes()
size = struct.unpack_from('<I',raw,12)[0]
doc = json.loads(raw[20:20+size])
buf = memoryview(raw)[28+size:]


def read(index, width):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    return np.frombuffer(buf, {5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],
                         a['count']*width,view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,width)


def collect(index, parent):
    node=doc['nodes'][index]
    if 'matrix' in node:
        local=Matrix(np.array(node['matrix']).reshape(4,4).T)
    else:
        x,y,z,w=node.get('rotation',(0,0,0,1))
        local=Matrix.LocRotScale(Vector(node.get('translation',(0,0,0))),Quaternion((w,x,y,z)),Vector(node.get('scale',(1,1,1))))
    world=parent @ local
    name=node['name']
    if name in placements:
        world = parent @ Matrix(np.array(placements[name]).reshape(4,4).T) @ local
    if name.startswith(('SH-','OUT-')) or name=='P02' or (desk_insert and name=='L01'):
        return
    if 'mesh' in node:
        for j,p in enumerate(doc['meshes'][node['mesh']]['primitives']):
            mat=doc['materials'][p['material']]
            if mat.get('alphaMode')=='BLEND':
                continue
            receive=name in ('T01','CEILING') if placements else receiving(name,mat['name'])
            batch=groups[receive]
            pos=read(p['attributes']['POSITION'],3)
            tri=read(p['indices'],1).reshape(-1,3).astype('int32')
            # The runtime splits vertices at normal/UV seams. Join those in the
            # bake mesh so a continuous cushion or moulding gets usable UV islands.
            if receive and placements:
                uv = read(p['attributes']['TEXCOORD_1'],2)[tri.ravel()].copy()
                uv[:,1] = 1-uv[:,1]
                existing_uv.append(uv)
            if receive and not placements:
                pos, welded = np.unique(pos.round(6), axis=0, return_inverse=True)
                tri = welded[tri]
            transform=np.asarray(world)
            batch['vertices'].append(pos @ transform[:3,:3].T + transform[:3,3])
            batch['faces'].append(tri+batch['offset'])
            batch['offset']+=len(pos)
            if receive:
                chunks.append((f"{node['mesh']}_{j}",tri.size))
    for child in node.get('children',[]):
        collect(child,world)


groups=[dict(vertices=[],faces=[],offset=0) for _ in range(2)]
chunks=[]
existing_uv=[]
for root in doc['scenes'][doc.get('scene',0)]['nodes']:
    collect(root,Matrix.Rotation(math.pi/2,4,'X'))

if desk_insert:
    # The insert is already expressed in the desk's metre-based Z-up frame.
    raw = desk_insert.read_bytes()
    size = struct.unpack_from('<I',raw,12)[0]
    doc = json.loads(raw[20:20+size])
    buf = memoryview(raw)[28+size:]
    for i,node in enumerate(doc['nodes']):
        if node['name'].startswith('L01 '):
            collect(i,Matrix.Identity(4))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
for label,batch in zip(('Static occluders','Receiving surfaces'),groups):
    points=np.concatenate(batch['vertices']).astype('float32')
    triangles=np.concatenate(batch['faces']).astype('int32')
    mesh=bpy.data.meshes.new(label)
    mesh.vertices.add(len(points));mesh.vertices.foreach_set('co',points.ravel())
    mesh.loops.add(triangles.size);mesh.loops.foreach_set('vertex_index',triangles.ravel())
    mesh.polygons.add(len(triangles));mesh.polygons.foreach_set('loop_start',np.arange(0,triangles.size,3,dtype='int32'))
    mesh.update(calc_edges=True)
    obj=bpy.data.objects.new(label,mesh)
    scene.collection.objects.link(obj)

# Blender's smart projection supplies separate charts for the board faces,
# wall returns and upholstery. Store per-corner UVs to preserve GLB seams.
bpy.context.view_layer.objects.active=obj
obj.select_set(True)
if placements:
    mesh.uv_layers.new(name='Installed room contacts').data.foreach_set('uv',np.concatenate(existing_uv).ravel())
else:
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.12,island_margin=.002,area_weight=.6)
    bpy.ops.object.mode_set(mode='OBJECT')
coords=np.empty(len(mesh.loops)*2,dtype='float32')
mesh.uv_layers.active.data.foreach_get('uv',coords)
coords=coords.reshape(-1,2);coords[:,1]=1-coords[:,1]
start=0;maps={}
for key,count in chunks:
    if key in maps:
        raise ValueError('Bake receivers must be unique mesh instances')
    maps[key]=coords[start:start+count];start+=count
np.savez_compressed(directory/'contact-uv.npz',**maps)

atlas=bpy.data.images.new('Room indirect visibility',2048,2048,alpha=False)
atlas.colorspace_settings.name='Non-Color'
material=bpy.data.materials.new('Local occlusion, independent of lamp state')
material.use_nodes=True
nodes=material.node_tree.nodes
ao=nodes.new('ShaderNodeAmbientOcclusion')
ao.inputs['Distance'].default_value=.48
ao.samples=64
emission=nodes.new('ShaderNodeEmission')
material.node_tree.links.new(ao.outputs['AO'],emission.inputs['Color'])
material.node_tree.links.new(emission.outputs[0],nodes.get('Material Output').inputs['Surface'])
target=nodes.new('ShaderNodeTexImage');target.image=atlas;nodes.active=target
mesh.materials.append(material)
scene.render.engine='CYCLES'
scene.cycles.samples=2
scene.render.bake.margin=4
bpy.ops.object.bake(type='EMIT')
atlas.filepath_raw=str(directory/'contacts.png');atlas.file_format='PNG';atlas.save()
