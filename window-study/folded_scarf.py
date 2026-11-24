"""Drape the existing Chelsea artwork over both sides of its brass rail."""
import numpy as np


RAIL_Z = 2.157
HEM_Z = 1.35
THICKNESS = .005


def drape(x, z, rear=False, inside=False):
    t = (RAIL_Z - z) / (RAIL_Z - HEM_Z)
    loose = 1 - np.exp(-(t / .19) ** 2)
    u = (x - 1.345) / .19
    wave = np.cos(2 * np.pi * (1.38 * u + .13 * np.sin(t * 3.8)))
    if rear:
        dx = loose * (.031 * t + .003 * np.sin(t * 4.7))
        y = .026 + loose * (-.005 + .004 * wave) + THICKNESS * inside
        height = z - .112 * t + loose * .008 * (u - .5)
    else:
        dx = loose * (-.010 * t + .003 * np.sin(t * 6))
        y = .044 + loose * (.016 + .012 * wave + .004 * np.sin(u * 13 - t * 3))
        y -= THICKNESS * inside
        height = z + loose * (.011 * (u - .5) + .0025 * wave)
    return np.stack(np.broadcast_arrays(x + dx, y, height), axis=-1)


def folded_body(mat, attr):
    # One continuous strip from the front hem, over the rail, to the rear hem.
    x = np.linspace(1.345, 1.535, 55)
    z = np.linspace(HEM_Z, RAIL_Z, 105)[:, None]
    theta = np.linspace(0, np.pi, 19)[1:-1, None]
    layers = []
    for inside in (False, True):
        radius = .004 if inside else .009
        roll = np.stack(np.broadcast_arrays(x, .035 + radius * np.cos(theta),
                                            RAIL_Z + radius * np.sin(theta)), axis=-1)
        layers.append(np.concatenate([drape(x, z, inside=inside), roll,
                                      drape(x, z[::-1], rear=True, inside=inside)]))
    rows, cols = layers[0].shape[:2]
    grid = np.arange(rows * cols).reshape(rows, cols)
    inner = grid + grid.size
    faces = []

    def quads(a, b, c, d):
        faces.extend([np.stack(v, axis=-1).reshape(-1, 3) for v in ((a,b,c),(a,c,d))])

    quads(grid[:-1,:-1],grid[1:,:-1],grid[1:,1:],grid[:-1,1:])
    quads(inner[:-1,1:],inner[1:,1:],inner[1:,:-1],inner[:-1,:-1])
    rim = np.concatenate([grid[0],grid[1:,-1],grid[-1,-2::-1],grid[-2:0:-1,0]])
    nxt = np.roll(rim,-1)
    quads(rim,nxt,nxt+grid.size,rim+grid.size)
    positions = np.concatenate(layers).reshape(-1,3)
    triangles = np.concatenate(faces)
    a,b,c = positions[triangles].transpose(1,0,2)
    face_normals = np.cross(b-a,c-a)
    normals = np.zeros_like(positions)
    for i in range(3):
        np.add.at(normals,triangles[:,i],face_normals)
    normals /= np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12)
    return dict(material=mat,indices=attr(triangles.ravel(),'SCALAR'),
                attributes=dict(POSITION=attr(positions,'VEC3'),NORMAL=attr(normals,'VEC3')))


def fold_scarf(doc, buf, attr):
    mesh = next(m for m in doc['meshes'] if m['name']=='D01')
    def read(index, columns):
        a = doc['accessors'][index]
        v = doc['bufferViews'][a['bufferView']]
        dtype = {5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']]
        return np.frombuffer(buf,dtype=dtype,count=a['count']*columns,
                             offset=v['byteOffset']+a.get('byteOffset',0)).reshape(-1,columns).copy()

    def warp(points,rear):
        x,y,z = points.T
        former = (.033 + .004*np.cos((x-1.34)*np.pi*17) + .004*np.sin((z-1.35)*np.pi*3)
                  + .006*np.exp(-((z-1.37)/.07)**2))
        surface = drape(x,z,rear,inside=rear)
        surface[:,1] += y-former + .00065
        return surface

    output = []
    for p in mesh['primitives']:
        name = doc['materials'][p['material']]['name']
        if name=='scarfblue':
            output.append(folded_body(p['material'],attr))
            continue
        if name not in ('paperwhite','chelsea_crest','fringewhite'):
            output.append(p)
            continue
        pts = read(p['attributes']['POSITION'],3).astype(float)
        normals = read(p['attributes']['NORMAL'],3)
        for rear in ([False] if name=='chelsea_crest' else [False,True]):
            q = dict(p, attributes=p['attributes'].copy())
            if rear and name=='paperwhite':
                tris = read(p['indices'],1).reshape(-1,3)
                bands = tris[pts[tris,2].max(axis=1)<1.47]
                q['indices'] = attr(bands.ravel(),'SCALAR')
            jac = np.stack([(warp(pts+axis*1e-5,rear)-warp(pts-axis*1e-5,rear))/2e-5
                            for axis in np.eye(3)],axis=-1)
            n = (np.linalg.inv(jac).transpose(0,2,1) @ normals[:,:,None])[:,:,0]
            n /= np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-12)
            q['attributes'].update(POSITION=attr(warp(pts,rear),'VEC3'),NORMAL=attr(n,'VEC3'))
            output.append(q)
    mesh['primitives'] = output
