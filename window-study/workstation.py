"""Finish the existing workstation meshes in their authored, Z-up coordinates."""
import json
import struct
from pathlib import Path
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from workstation_art import display_image, perforated_steel


def components(points, triangles):
    # GLB splits vertices at UV and normal seams. Weld only for identifying parts.
    verts, inv = np.unique(points, axis=0, return_inverse=True)
    faces = inv[triangles]
    a, b = faces.ravel(), np.roll(faces,1,axis=1).ravel()
    graph = coo_matrix((np.ones(len(a)),(a,b)),shape=(len(verts),len(verts)))
    _, labels = connected_components(graph,directed=False)
    return labels[inv]


def rim(w,h,r):
    rings=[]
    for sx,sy,angle in [(1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)]:
        a=np.deg2rad(np.linspace(angle,angle+90,6))
        rings.extend(zip(sx*(w/2-r)+r*np.cos(a),sy*(h/2-r)+r*np.sin(a)))
    return np.array(rings)


def join_rings(rows, reverse=False, cap=False):
    rings=np.asarray(rows)
    ids=np.arange(rings.shape[0]*rings.shape[1]).reshape(rings.shape[:2])
    a,b=ids[:-1],np.roll(ids[:-1],-1,axis=1)
    c,d=np.roll(ids[1:],-1,axis=1),ids[1:]
    tris=np.concatenate([np.stack(t,axis=-1).reshape(-1,3) for t in ((a,b,c),(a,c,d))])
    pts=rings.reshape(-1,3)
    if cap:
        for ring, flip in [(ids[0],True),(ids[-1],False)]:
            faces=np.column_stack([ring,np.roll(ring,-1),np.full(len(ring),len(pts))])
            pts=np.vstack([pts,pts[ring].mean(0)])
            tris=np.vstack([tris,faces[:,::-1] if flip else faces])
    return pts,tris[:,::-1] if reverse else tris


def normals_at(pts,tri):
    a,b,c=pts[tri].transpose(1,0,2)
    cross=np.cross(b-a,c-a)
    normals=np.zeros_like(pts)
    for j in range(3):
        np.add.at(normals,tri[:,j],cross)
    return normals/np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12)


def read_attribute(doc, buf, i):
    a=doc['accessors'][i]
    v=doc['bufferViews'][a['bufferView']]
    width={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
    return np.frombuffer(buf,dtype={5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']],
                         offset=v.get('byteOffset',0)+a.get('byteOffset',0),
                         count=a['count']*width).reshape(-1,width).copy()


def mount_laptop_lid(parts, name, data, attr, materials):
    # The original lid heel was over the function keys, 72 mm ahead of its pivots.
    # Move the complete lid as a rigid assembly, including lens and rear applique.
    for p in parts:
        pts,tri=data(p)
        labels=components(pts,tri)
        remove=np.zeros(len(pts),dtype=bool)
        moved=False
        for i in np.unique(labels):
            mask=labels==i
            lo,hi=pts[mask].min(0),pts[mask].max(0)
            if name(p)=='rubber' and .050<hi[0]-lo[0]<.055 and hi[1]<.208 and lo[2]>.764:
                remove[mask]=True
            elif hi[2]>.785 or (name(p)=='silver' and lo[2]>.762):
                pts[mask]+=[0,-.0725,.021]
                moved=True
        if moved:
            p['attributes']['POSITION']=attr(pts,'VEC3')
        if remove.any():
            p['indices']=attr(tri[~remove[tri[:,0]]].ravel(),'SCALAR')

    # The editable hinge assembly is exported from Blender with the room's
    # Z-up axes, applied transforms and its origin on the pivot pin.
    raw=Path(__file__).with_name('model').joinpath('laptop-hinge.glb').read_bytes()
    size=struct.unpack_from('<I',raw,12)[0]
    hinge=json.loads(raw[20:20+size])
    buf=memoryview(raw)[28+size:]
    first_material=len(materials)
    materials.extend(hinge['materials'])
    for primitive in hinge['meshes'][0]['primitives']:
        attrs=primitive['attributes']
        points=read_attribute(hinge,buf,attrs['POSITION'])
        normals=attr(read_attribute(hinge,buf,attrs['NORMAL']),'VEC3')
        indices=attr(read_attribute(hinge,buf,primitive['indices']).ravel(),'SCALAR')
        for x in (2.7925,3.0675):
            parts.append(dict(attributes=dict(POSITION=attr(points+[x,.2013,.765],'VEC3'),NORMAL=normals),
                              indices=indices,material=first_material+primitive['material']))


def finish_workstation(doc,buf,attr,texture):
    meshes={m['name']:m['primitives'] for m in doc['meshes']}
    materials=doc['materials']
    def name(p):
        return materials[p['material']]['name']
    def read(i):
        return read_attribute(doc,buf,i)
    def data(p):
        return read(p['attributes']['POSITION']).astype(float),read(p['indices']).reshape(-1,3)
    def material(label,color,rough,metal=0,**extra):
        materials.append(dict(name=label,pbrMetallicRoughness=dict(baseColorFactor=[*color,1],
                              roughnessFactor=rough,metallicFactor=metal),**extra))
        return len(materials)-1
    def add(group,mat,pts,tri,uv=None):
        attrs=dict(POSITION=attr(pts,'VEC3'),NORMAL=attr(normals_at(pts,tri),'VEC3'))
        if uv is not None:
            attrs['TEXCOORD_0']=attr(uv,'VEC2')
        meshes[group].append(dict(material=mat,indices=attr(tri.ravel(),'SCALAR'),attributes=attrs))
    repeat_sampler=len(doc['samplers'])
    doc['samplers'].append(dict(doc['samplers'][0],wrapS=10497,wrapT=10497))
    def mapped(label,img,rough,metal=0,**extra):
        i=material(label,[1,1,1],rough,metal,**extra)
        pattern=texture(img,label)
        doc['textures'][pattern]['sampler']=repeat_sampler
        materials[i]['pbrMetallicRoughness']['baseColorTexture']={'index':pattern}
        return i
    def lcd(label,tex):
        # The LCD emits its image; only the low-reflectance cover glass catches room light.
        return material(label,[.011,.014,.017],.36,.04,extras=dict(switchedDisplayGlass=True),
                        emissiveTexture=dict(index=tex),emissiveFactor=[.82,.86,.88])

    bezel=material('Workstation / moulded graphite',[.040,.047,.053],.47,.10)
    gasket=material('Panel / recessed seal',[.011,.013,.015],.78)
    for group in ('E01','E02','E03','E04'):
        body,panel=meshes[group][:2]
        pts,_=data(panel)
        lo,hi=pts.min(0),pts.max(0)
        ctr=(lo+hi)/2
        width,_,height=hi-lo
        tex=materials[panel['material']]['pbrMetallicRoughness']['baseColorTexture']['index']
        panel['material']=lcd(group+' / antiglare LCD',tex)
        body['material']=bezel
        # Seat the glass behind a radiused bezel and its recessed black lip.
        rows=[]
        for outset,y in [(.008,.088),(.008,.092),(.005,.095),(.0014,.095),(-.0003,.0933)]:
            outline=rim(width+outset*2,height+outset*2,.004+max(0,outset)*.38)
            rows.append(np.column_stack([ctr[0]+outline[:,0],np.full(len(outline),y),ctr[2]+outline[:,1]]))
        add(group,bezel,*join_rings(rows[:4],reverse=True))
        add(group,gasket,*join_rings(rows[3:],reverse=True))

    mount_laptop_lid(meshes['E06'],name,data,attr,materials)
    for group in ('E05','E06'):
        laptop=group=='E06'
        panel=next(p for p in meshes[group] if name(p)=='screenink')
        pts,_=data(panel)
        lo,hi=pts.min(0),pts.max(0)
        # Follow the lid tilt. Keep display artwork on the actual front plane.
        low=pts[np.isclose(pts[:,2],lo[2],atol=.00005),1].max()
        high=pts[np.isclose(pts[:,2],hi[2],atol=.00005),1].max()
        screen=np.array([[lo[0],low,lo[2]],[hi[0],low,lo[2]],[hi[0],high,hi[2]],[lo[0],high,hi[2]]])
        screen[:,1]+=.0007
        for p in meshes[group][:]:
            if name(p) not in ('cyan','silver','amber'): continue
            v,tr=data(p)
            # Old lines float above the display. Keep the webcam, chin stamp,
            # power lens and keyboard/lid details outside the active glass.
            y=np.interp(v[:,2],[lo[2],hi[2]],[low,high])
            ink=(v[:,2]>lo[2])&(v[:,2]<hi[2])&(v[:,1]>y-.0006)&(v[:,1]<y+.012)
            keep=tr[~ink[tr].all(axis=1)]
            if not len(keep):
                meshes[group].remove(p)
            elif len(keep)<len(tr):
                p['indices']=attr(keep.ravel(),'SCALAR')
        # The new front replaces the blank inset. Two nearly coplanar front
        # faces otherwise fight for depth at the default room distance.
        meshes[group].remove(panel)
        tex=texture(display_image(laptop),group+' / working display')
        add(group,lcd(group+' / working LCD',tex),screen,np.array([[0,2,1],[0,3,2]]),
            np.array([[0,1],[1,1],[1,0],[0,0]]))

    # Sculpt the keys in their existing ANSI layout. The original atlas and
    # all key centres remain aligned, including the tall Enter and wide Space.
    for group in ('E08','E06'):
        p=next(p for p in meshes[group] if name(p)=='keyboardkeys')
        pts,tri=data(p)
        uv=read(p['attributes']['TEXCOORD_0'])
        ids=components(pts,tri)
        positions,indices,coords=[],[],[]
        count=0
        laptop=group=='E06'
        for i in np.unique(ids):
            local=pts[ids==i]
            lo,hi=local.min(0),local.max(0)
            center=(lo+hi)/2
            w,h,depth=hi-lo
            top=np.isclose(local[:,2],hi[2],rtol=0,atol=.00001)
            xy=local[top,:2]-center[:2]
            transform=np.linalg.lstsq(np.c_[xy,np.ones(len(xy))],uv[ids==i][top],rcond=None)[0]
            inset=.0006 if laptop else .0020
            rows=[]
            for cut,elev in [(0,0),(.00015,.24),(inset,.87),(inset+.00055,1)]:
                outline=rim(w-2*cut,h-2*cut,min(.0018,w/6,h/6))
                rows.append(np.c_[center[:2]+outline,np.full(len(outline),lo[2]+elev*depth)])
            shoulder=rows[-1]
            for scale in (.74,.42,.13):
                xy=(shoulder[:,:2]-center[:2])*scale
                dish=(1-scale**2)*(.00020 if laptop else .00105)
                rows.append(np.c_[center[:2]+xy,np.full(len(xy),hi[2]-dish)])
            v,t=join_rings(rows,cap=True)
            positions.append(v);indices.append(t+count);count+=len(v)
            coords.append(np.c_[v[:,:2]-center[:2],np.ones(len(v))]@transform)
        meshes[group].remove(p)
        add(group,p['material'],np.vstack(positions),np.vstack(indices),np.vstack(coords))

    # Shape the whole mouse assembly together so the wheel, thumb buttons
    # and feet still meet the shell. The palm arches on the right-hand grip.
    def grip(v):
        x=(v[:,0]-2.47)/.039
        y=(v[:,1]-.628)/.059
        height=np.clip((v[:,2]-.742)/.041,0,1)
        q=v.copy()
        q[:,0]+=.0058*height*(.5+.5*y)-.004*np.exp(-((y-.12)/.50)**2)*np.minimum(x,0)
        q[:,2]+=.0075*height*(1+.48*x)*np.exp(-((y-.32)/.78)**2)
        return q
    for p in meshes['E09']:
        v,_=data(p)
        jac=np.stack([(grip(v+e*1e-6)-grip(v-e*1e-6))/2e-6 for e in np.eye(3)],axis=2)
        n=(np.linalg.inv(jac).transpose(0,2,1)@read(p['attributes']['NORMAL'])[:,:,None])[:,:,0]
        p['attributes'].update(POSITION=attr(grip(v),'VEC3'),NORMAL=attr(n/np.linalg.norm(n,axis=1)[:,None],'VEC3'))
        if name(p)=='mousebutton':
            p['material']=material('Mouse / satin click shells',[.075,.086,.093],.41)

    # Replace the front wire grid by a single, optically open punched sheet.
    steel=mapped('Tower / perforated steel',perforated_steel(),.52,.30,alphaMode='BLEND',doubleSided=True)
    p=next(p for p in meshes['E07'] if name(p)=='dark')
    v,tr=data(p)
    wires=(v[:,1]>.591)&(v[:,1]<.596)&(v[:,2]>.146)&(v[:,2]<.554)
    p['indices']=attr(tr[~wires[tr].all(axis=1)].ravel(),'SCALAR')
    grille=np.array([[1.263,.593,.147],[1.467,.593,.147],[1.467,.593,.555],[1.263,.593,.555]])
    add('E07',steel,grille,np.array([[0,2,1],[0,3,2]]),grille[:,[0,2]]/.036)
