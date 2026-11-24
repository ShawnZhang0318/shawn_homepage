"""Finish the furnished GLB after the prop pass. Geometry stays in its original frame.

python room_finishes.py furnished.glb room-river-facades.glb --blender PATH
Photographic source: https://polyhaven.com/a/wood_table_001 (CC0).
"""
import argparse
import copy
import io
import json
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageFilter
from workstation import components, read_attribute

HERE = Path(__file__).resolve().parent
TEXTURES = HERE / 'model' / 'textures'


def encoded(array, fmt, **kwargs):
    stream = io.BytesIO()
    Image.fromarray(np.uint8(np.clip(array, 0, 255))).save(stream, fmt, **kwargs)
    return stream.getvalue()


def wood_maps():
    def source(kind):
        path = TEXTURES / f'wood_table_001_{kind}_1k.jpg'
        return np.asarray(Image.open(path).convert('RGB'), dtype='float32')

    raw = source('diff')
    grain = np.log1p(raw @ [.28, .56, .16])
    grain = np.clip((grain - np.median(grain)) / max(.1, grain.std()), -3, 3)
    veneer = [132, 102, 78] + grain[:, :, None] * [4.5, 4.3, 3.8]
    rough = source('rough')[:, :, 0]
    rough = 144 + .23 * (rough - np.median(rough))
    packed = np.stack([np.full_like(rough, 255), rough, np.zeros_like(rough)], axis=2)
    # Preserve the original 86 mm herringbone lattice; sample along each stave.
    y, x = np.indices((2048, 2048), dtype='float32')
    scale = 9 / 2048 / .086 / np.sqrt(2)
    u, v = (x + y) * scale, (y - x) * scale
    i, j = np.floor(u), np.floor(v)
    across = (i-j) % 12 < 6
    run = np.where(across, (u-j) % 12, (i-v-5) % 12)
    side = np.where(across, v % 1, u % 1)
    seed = np.where(across, j*47, i*61) + np.floor((i-j)/12)*137
    s = ((side*.086/1.4 + np.sin(seed*4.11)) % 1 * grain.shape[1]).astype(int)
    t = ((run*.086/1.4 + np.sin(seed*5.73)) % 1 * grain.shape[0]).astype(int)
    seam = np.minimum.reduce([side, 1-side, run, abs(6-run)])
    value = 2.8*grain[t,s] + 4*np.sin(seed*7.31) - 15*np.clip(1-seam/.034, 0, 1)
    parquet = [144, 107, 80] + value[:, :, None]
    return (encoded(veneer, 'JPEG', quality=92), encoded(packed, 'PNG'),
            encoded(parquet, 'JPEG', quality=90))


def board_uv(pos, normal, triangles, seed):
    labels = components(pos, triangles)
    rng = np.random.default_rng(seed)
    uv = np.empty((len(pos), 2), dtype=np.float32)
    for label in np.unique(labels):
        sel = labels == label
        xyz = pos[sel]
        thin, mid, axis = np.argsort(np.ptp(xyz, axis=0))
        edge = np.abs(normal[sel, axis]) > .8
        u = np.where(edge, xyz[:,thin], xyz[:,mid] + xyz[:,thin])
        v = np.where(edge, xyz[:,mid], xyz[:,axis])
        uv[sel] = np.column_stack([u, v]) / 1.4 + rng.random(2)
    return uv


def lower_cabinet_reveals(doc):
    leaves = []
    for node in doc['nodes']:
        if not node['name'].startswith('A01-DOOR'):
            continue
        mesh = node['mesh']
        panel = next(p for p in doc['meshes'][mesh]['primitives']
                     if doc['materials'][p['material']]['name'] == 'cabinet')
        bounds = doc['accessors'][panel['attributes']['POSITION']]
        origin = node['translation'][1]
        leaves.append((origin + bounds['min'][1], origin + bounds['max'][1], mesh))
    leaves.sort()
    target_gap = .0025
    extensions = {mesh: [0., 0.] for _, _, mesh in leaves}
    for (_, right, mesh), (left, _, adjacent) in zip(leaves, leaves[1:]):
        half = (left - right - target_gap) / 2
        extensions[mesh][1] = half
        extensions[adjacent][0] = -half
    return extensions


def finish(source, target, directory):
    raw = source.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+size])
    buf = bytearray(raw[28+size:])

    def view(payload):
        buf.extend(bytes(-len(buf) % 4))
        index = len(doc['bufferViews'])
        doc['bufferViews'].append(dict(buffer=0, byteOffset=len(buf), byteLength=len(payload)))
        buf.extend(payload)
        return index

    def attribute(array, kind):
        if kind == 'SCALAR':
            array = np.asarray(array, dtype='<u2' if array.max() < 65535 else '<u4')
            ctype = 5123 if array.itemsize == 2 else 5125
        else:
            array = np.asarray(array, dtype='<f4')
            ctype = 5126
        acc = dict(bufferView=view(array.tobytes()), componentType=ctype, count=len(array), type=kind)
        if kind == 'VEC3':
            acc.update(min=array.min(0).tolist(), max=array.max(0).tolist())
        doc['accessors'].append(acc)
        return len(doc['accessors'])-1

    def texture(name, payload, mime, sampler=1):
        index = len(doc['images'])
        doc['images'].append(dict(name=name, bufferView=view(payload), mimeType='image/'+mime))
        doc['textures'].append(dict(source=index, sampler=sampler))
        return len(doc['textures'])-1

    veneer, rough, parquet = wood_maps()
    timber = texture('Satin timber', veneer, 'jpeg')
    finish_map = texture('Timber finish roughness', rough, 'png')
    timber_normal = texture('Timber pores', (TEXTURES/'wood_table_001_nor_gl_1k.jpg').read_bytes(), 'jpeg')
    floor = texture('Individual parquet staves', parquet, 'jpeg', 0)
    visibility = Image.open(directory/'contacts.png').convert('L').filter(ImageFilter.MedianFilter(3))
    stream = io.BytesIO()
    visibility.save(stream, 'PNG')
    atlas = texture('Cycles room contact visibility', stream.getvalue(), 'png', 0)
    textile_normal = next(m['normalTexture']['index'] for m in doc['materials'] if m['name']=='oatlinen')
    variants = {}

    door_edges = lower_cabinet_reveals(doc)
    with np.load(directory/'contact-uv.npz') as maps:
        for key in maps.files:
            mesh, part = map(int, key.split('_'))
            prim = doc['meshes'][mesh]['primitives'][part]
            attrs = prim['attributes']
            original = prim['material']
            name = doc['materials'][original]['name']
            pos = read_attribute(doc, buf, attrs['POSITION'])
            norm = read_attribute(doc, buf, attrs['NORMAL'])
            tri = read_attribute(doc, buf, prim['indices']).ravel()
            uv = maps[key]
            if len(uv) != len(tri):
                raise ValueError(f'Stale bake for primitive {key}')
            # Split vertices only at new lightmap seams, retaining the authored normals.
            pairs, inverse = np.unique(np.column_stack([tri, (uv*1e6).round().astype(int)]),
                                       axis=0, return_inverse=True)
            used = pairs[:,0]
            if not np.array_equal(used, np.arange(len(pos))):
                for attr, old in list(attrs.items()):
                    if attr != 'TEXCOORD_1':
                        attrs[attr] = attribute(read_attribute(doc, buf, old)[used], doc['accessors'][old]['type'])
            attrs['TEXCOORD_1'] = attribute(pairs[:,1:]/1e6, 'VEC2')
            prim['indices'] = attribute(inverse, 'SCALAR')
            if mesh in door_edges and name == 'cabinet':
                # Retain both 28 mm frame stiles and their bevels. Stretch only
                # the flat field and straight rails between them. Hinges stay put.
                y = pos[:,1]
                y += np.interp(y, [y.min()+.028, y.max()-.028], door_edges[mesh])
                attrs['POSITION'] = attribute(pos[used], 'VEC3')
            wood = name in ('joinery','joinery-worktop','wood','wooddark','woodlight')
            if wood:
                coords = board_uv(pos, norm, tri.reshape(-1,3), 17*mesh + part)
                attrs['TEXCOORD_0'] = attribute(coords[used], 'VEC2')
            if name in ('cloth','blue'):
                # Weave wraps over the cushion top and around its upholstered edges.
                coords = np.column_stack([pos[:,0]+.57*pos[:,1], pos[:,2]+.82*pos[:,1]]) / .38
                attrs['TEXCOORD_0'] = attribute(coords[used], 'VEC2')
            if original not in variants:
                mat = copy.deepcopy(doc['materials'][original])
                strength = {'trim':.22, 'oatlinen':.17, 'blue':.38, 'cloth':.44,
                            'cream':.49, 'stone':.56}.get(name, .70)
                mat['occlusionTexture'] = dict(index=atlas, texCoord=1, strength=strength)
                pbr = mat['pbrMetallicRoughness']
                if wood:
                    tint = {'wooddark':[.68,.69,.68], 'joinery-worktop':[1,.97,.94],
                            'woodlight':[1,1,.98]}.get(name, [.94,.94,.94])
                    pbr.update(baseColorTexture=dict(index=timber), baseColorFactor=[*tint,1],
                               roughnessFactor=1, metallicFactor=0, metallicRoughnessTexture=dict(index=finish_map))
                    mat['normalTexture'] = dict(index=timber_normal, scale=.095)
                elif name == 'parquet':
                    pbr.update(baseColorTexture=dict(index=floor), roughnessFactor=.52)
                elif name in ('cloth','blue','oatlinen','checkedwool','rugweave'):
                    if name in ('cloth','blue'):
                        mat['normalTexture'] = dict(index=textile_normal, scale=.21)
                    mat.setdefault('extensions', {})['KHR_materials_sheen'] = dict(
                        sheenColorFactor=[.11,.10,.085], sheenRoughnessFactor=.85)
                    if 'KHR_materials_sheen' not in doc['extensionsUsed']:
                        doc['extensionsUsed'].append('KHR_materials_sheen')
                variants[original] = len(doc['materials'])
                doc['materials'].append(mat)
            prim['material'] = variants[original]
    buf.extend(bytes(-len(buf)%4))
    doc['buffers'][0]['byteLength'] = len(buf)
    header = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode()
    header += b' ' * (-len(header)%4)
    staged = target.with_suffix('.pending.glb')
    staged.write_bytes(struct.pack('<4sIIII', b'glTF', 2, 28+len(header)+len(buf), len(header), 0x4e4f534a)
                       + header + struct.pack('<II', len(buf), 0x004e4942) + buf)
    staged.replace(target)


def bake_and_finish(source, target, blender):
    with tempfile.TemporaryDirectory() as temp:
        subprocess.run([blender, '-b', '--factory-startup', '--python-exit-code', '1',
                        '--python', str(HERE/'bake_room_contacts.py'), '--', str(source.resolve()), temp], check=True)
        finish(source, target, Path(temp))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('target', type=Path)
    parser.add_argument('--blender', default=shutil.which('blender') or 'blender')
    args = parser.parse_args()
    bake_and_finish(args.source, args.target, args.blender)
