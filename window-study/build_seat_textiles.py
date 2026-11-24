"""Author the four window-seat textiles in the existing room's Z-up frame.

blender -b --factory-startup -P build_seat_textiles.py
The browser binds the existing room fabric materials and their embedded maps.
"""
from math import cos, exp, pi, sin, sqrt
from pathlib import Path

import bmesh
import bpy
import numpy as np

DEST = Path(__file__).resolve().parent / "model" / "seat-textiles.glb"
SEAT_Z = .470
bpy.ops.wm.read_factory_settings(use_empty=True)


def sew(name, material, points, faces, uv, tones):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], faces)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    tex = mesh.uv_layers.new(name="weave").data
    for loop in mesh.loops:
        tex[loop.index].uv = uv[loop.vertex_index]
    tint = mesh.color_attributes.new(name="Cover shading", type="FLOAT_COLOR", domain="POINT")
    for slot, tone in zip(tint.data, tones):
        slot.color = (tone, tone, tone, 1)
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    obj["cover"] = material
    bpy.context.collection.objects.link(obj)
    return obj


def piping(name, material, loops, radius, closed=True):
    pts, uv, shade, faces = [], [], [], []
    for path in loops:
        start = len(pts)
        for i, center in enumerate(path):
            hi = path[(i + 1) % len(path)] if closed or i + 1 < len(path) else center
            lo = path[i - 1] if closed or i else center
            tangent = hi - lo
            tangent /= np.linalg.norm(tangent)
            ref = np.array([1, 0, 0]) if abs(tangent[2]) > .9 else np.array([0, 0, 1])
            normal = np.cross(tangent, ref)
            normal /= np.linalg.norm(normal)
            side = np.cross(tangent, normal)
            for k in range(6):
                angle = k * pi / 3
                pts.append(center + radius * (cos(angle) * normal + sin(angle) * side))
                uv.append((i / len(path), k / 6))
                shade.append(.76)
            if not closed and i == len(path)-1:
                break
            j = (i+1) % len(path)
            for k in range(6):
                m = (k+1) % 6
                faces.append(tuple(start + 6*r+c for r,c in [(i,k),(j,k),(j,m),(i,m)]))
        if not closed:
            faces.append(tuple(start+k for k in reversed(range(6))))
            faces.append(tuple(len(pts)-6+k for k in range(6)))
    sew(name, material, pts, faces, uv, shade)


def cushion(name, material, anchor, along, normal, width, height, loft, phase):
    """Two face panels meet around a pinched seam. Allow broad contact patches
    against the rear ledge and the top of the seat instead of point contacts."""
    anchor, along, normal = map(np.array, (anchor, along, normal))
    def surface(u, v, side):
        # Relaxed corners and an irregular crown produce a soft cut-and-sewn outline.
        x = width/2 * (u * (1-.14*(abs(u)*abs(v))**3) + .021*v*sin(phase))
        h = height * (.5+.525*v*(1-.15*(abs(u)*abs(v))**3))
        h += height*(.024*u*v + .040*(1-u*u)*max(v,0)**3 * cos(phase+3*u))
        bulge = max(0, (1-u*u)*(1-v*v))**.58
        # A few narrow gathers taper in from seams at different angles.
        folds = 0.
        for a, b, slope in [(-.67,-1,.42),(.38,-1,-.32),(-1,.26,.33),(.68,1,-.48),(1,-.18,-.26)]:
            if abs(a)==1:
                run, across = abs(a-u), v-b
            else:
                run, across = abs(b-v), u-a
            distance = (across-slope*run-.025*sin(run*7+phase)) / (.034+.04*run)
            folds += exp(-distance*distance) * exp(-run*run/.14)
        depth = .48*loft + .039*(1-v) + .006*u*sin(phase)
        depth += side*(.0014 + loft*(.64 if side==1 else .85)*bulge)
        depth -= side*.010*folds*sqrt(bulge)
        depth += .004*cos(phase+4*u+2*v)*bulge
        # The back cover flattens against the stone. A short compressed
        # band at the foot of both panels sits continuously on the seat.
        depth = max(.0001,depth)
        xy = anchor + along*x + normal*depth
        z = SEAT_Z + max(0, h - .010*bulge*(1-v)/2)
        point = np.array([*xy,z])
        tone = 1 - .25*exp(-max(0,h)/.023) - .065*folds*bulge
        return point, tone

    cols, rows = 53, 45
    us, vs = np.linspace(-1,1,cols), np.linspace(-1,1,rows)
    pts, uv, tone, faces = [], [], [], []
    for side in (-1, 1):
        start = len(pts)
        for j,v in enumerate(vs):
            for i,u in enumerate(us):
                p, t = surface(u, v, side)
                pts.append(p); uv.append(((u+1)/2, (v+1)/2)); tone.append(t)
                if j and i:
                    d=start+j*cols+i
                    faces.append((d-cols-1,d-cols,d,d-1))
    ring = [*range(cols), *(j*cols+cols-1 for j in range(1,rows)),
            *range(rows*cols-2,(rows-1)*cols-1,-1), *(j*cols for j in range(rows-2,0,-1))]
    count = rows*cols
    for i,a in enumerate(ring):
        b=ring[(i+1)%len(ring)]
        faces.append((a,b,b+count,a+count))
    sew(name, material, pts, faces, uv, tone)
    outline = [(pts[k]+pts[k+count])/2 for k in ring]
    piping(name+'-welt', material, [outline], .0016)


def throw():
    # Arc-length cross section of one folded cloth. It wraps up the nose,
    # doubles back over itself and drapes farther on its upper free end.
    along = np.array([.82750298,.56146132])
    front = np.array([-along[1],along[0]])
    nose = np.array([5.60,.54])
    edge = [(.016,.382),(.014,.398),(.011,.431),(.008,.450),(.002,.464),
            (-.012,.471),(-.04,.472),(-.12,.472),(-.21,.472),(-.29,.473),
            (-.34,.474),(-.360,.477),(-.370,.483),(-.370,.491),(-.361,.497),
            (-.346,.498),(-.300,.494),(-.240,.491),(-.170,.493),(-.11,.489),
            (-.055,.493),(-.018,.495),(.002,.491),(.015,.477),(.021,.457),
            (.024,.429),(.025,.405),(.026,.381),(.027,.352)]
    line = np.array(edge)
    path=[]
    for i in range(len(line)-1):
        a,b,c,d = line[max(0,i-1)],line[i],line[i+1],line[min(i+2,len(line)-1)]
        for t in (0,.25,.50,.75):
            path.append(.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t**3))
    path = np.array(path+[line[-1]])
    arclen = np.r_[0,np.cumsum(np.linalg.norm(np.diff(path,axis=0),axis=1))]
    pts, faces, uv, tone, fringes = [], [], [], [], []
    cols = 47
    last = len(path)-1
    for side in (-1, 1):
        start = len(pts)
        for j,(depth,z) in enumerate(path):
            tangent = path[min(last,j+1)]-path[max(0,j-1)]
            tangent /= np.linalg.norm(tangent)
            dz, dd = tangent[0], -tangent[1]
            top = min(1,max(0,(j-50)/8))
            for i,u in enumerate(np.linspace(-1,1,cols)):
                # Wider bends at the free end and relaxed diagonal tension across the top ply.
                w = .206*u + top*(.013*sin(4*arclen[j]+.8)-.016)
                wave = .5+.5*cos(9.2*u+.84*sin(2.9*u)+arclen[j]*6)
                hang = min(1,max(0,(.475-z)/.072))
                d = depth + (.004 + .009*top)*wave*hang + .016*u*top
                height = z + (.0009+.0065*top)*wave*(1-hang)
                height += hang*top*(.013*u+.006*sin(4*u-.5))
                if top and depth < -.23:
                    height += .007*exp(-((depth+.30)/.06)**2)*(1-u*u)
                xy = nose + along*w + front*(d + side*.00185*dd)
                p = np.array([*xy,height + side*.00185*dz])
                pts.append(p); uv.append(((u+1)*.5,arclen[j]/.82))
                tone.append((.74+.08*wave if j<49 else .95+.05*wave))
                if j and i:
                    k=start+j*cols+i;faces.append((k-cols-1,k-cols,k,k-1))
                if j==last and side==1 and i%2==0:
                    for k in (-1,1):
                        phase = 3.7*i+k
                        tip = .014+.004*cos(i*2.1+k)
                        fibres=[]
                        for t in np.linspace(0,1,8):
                            xy2 = (along*(k*.0012+.0015*sin(phase+t*3.2)*t)
                                   +front*(.002*sin(phase)*t+.0012*t*t))
                            fibres.append(p+np.array([*xy2, -tip*t]))
                        fringes.append(fibres)
    count=cols*len(path)
    border=[*range(cols),*(j*cols+cols-1 for j in range(1,len(path))),
            *range(count-2,count-cols-1,-1),*(j*cols for j in range(last-1,0,-1))]
    for i,a in enumerate(border):
        b=border[(i+1)%len(border)];faces.append((a,b,b+count,a+count))
    sew('S01-THROW-folded-wool','checkedwool',pts,faces,uv,tone)
    piping('S01-THROW-fringe','cloth',fringes,.0008,False)


# Each anchor lies on the upholstered side of an existing vertical stone panel.
along_l = np.array([.64278761,-.76604444])
along_r = np.array([-.34202014,-.93969262])
normal_r = np.array([-.93969262,.34202014])
cushion('S01-PILLOW-LEFT-cover','blue',np.array([4.86357,.04313])+.49*along_l,
        along_l,[.76604444,.64278761],.424,.360,.142,.3)
cushion('S01-PILLOW-RIGHT-cover','blue',np.array([6.77059,.96387])+.49*along_r+.135*normal_r,
        along_r,normal_r,.424,.360,.140,1.8)
back = np.array([5.38133,-.57390])
along = np.array([.76604444,.64278761])
anchor = back+along*np.dot(np.array([5.60,-.09])-back,along)
cushion('S01-LUMBAR-cover','oatlinen',anchor,along,[-along[1],along[0]],.392,.237,.121,2.6)
throw()
bpy.ops.export_scene.gltf(filepath=str(DEST),export_format='GLB',export_yup=False,
                          export_extras=True,export_materials='NONE',export_animations=False,
                          export_vertex_color='ACTIVE',export_all_vertex_colors=True)
