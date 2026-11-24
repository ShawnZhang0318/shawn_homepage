"""Blender -b -P prepare_bench_finish.py. Run bench_artwork.py tmp/bench-review first."""
from collections import defaultdict
from math import cos, sin, pi
from pathlib import Path
import json
import bmesh
import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
ART = PROJECT / 'tmp/bench-review'
parts = json.loads((PROJECT/'design/detail-models/BATCH-02-V1.8.1/equipment-source.json').read_bytes())['parts']
bpy.ops.wm.read_factory_settings(use_empty=True)
meshes = defaultdict(lambda: [[], [], []])
mats = {}
X,Y,Z=np.eye(3)
U=np.array([cos(40*pi/180),sin(40*pi/180),0])
V=np.cross(Z,U)
S=np.array([4.21,.16,.740])
def at(x,y,z):
    return S+x*U+y*V+z*Z

def finish(name, rgb, rough, metal=0, image=None, alpha=1, glow=0):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    s=m.node_tree.nodes.get("Principled BSDF")
    c=np.array(list(bytes.fromhex(rgb)))/255
    s.inputs['Base Color'].default_value=[*np.where(c<.04045,c/12.92,((c+.055)/1.055)**2.4),1]
    s.inputs['Roughness'].default_value=rough
    s.inputs['Metallic'].default_value=metal
    s.inputs['Alpha'].default_value=alpha
    if image:
        im=m.node_tree.nodes.new('ShaderNodeTexImage')
        im.image=bpy.data.images.load(str(ART/image))
        m.node_tree.links.new(im.outputs['Color'],s.inputs['Base Color'])
        if glow:
            m.node_tree.links.new(im.outputs['Color'],s.inputs['Emission Color'])
            s.inputs['Emission Strength'].default_value=glow
    mats[name]=m
    return name

case=finish('Scope moulded shell','47515b',.47)
panel=finish('Instrument panel silk','ffffff',.46,.09,'face.png')
screen=finish('Scope phosphor and graticule','ffffff',.34,0,'scope.png',glow=.37)
rubber=finish('Grip elastomer','262a2b',.70)
rim=finish('Burnished aluminium','9ba8ab',.32,.76)
dark=finish('Graphite engineering plastic','3b4345',.47)
inset=finish('Recess and button seals','151c20',.68)
key=finish('Scope silicone keys','b9bbae',.69)
gold=finish('Plated terminals','baa370',.40,.68)
card=finish('Drawer inventory cards','ffffff',.83,0,'bin-cards.png')
poly=finish('Smoked translucent polypropylene','a4b8bb',.47,0,alpha=.57)
pull=finish('Moulded drawer grip','b5cbcb',.37)
tray=finish('Bead-blasted utility tray','727d81',.52,.57)
mat=finish('Cutting grid and fine cuts','ffffff',.89,0,'mat.jpg')
mat_edge=finish('Cutting mat ply','153b33',.77)
accent=finish('Oxide red handle moulding','934e36',.52)
black=finish('Injection moulded case','343a3f',.53)
white=finish('Ink and knob pointers','d6d9cb',.68)
brass=finish('Gold board test pads','bfa86e',.45,.61)
colours=[finish('Channel '+str(i+1),rgb,.58) for i,rgb in enumerate(['bf9e56','82a984','6c9ca8','8e92ac'])]

def add(m,points,faces,uv=None):
    vs,fs,coords=meshes[group,m]
    i=len(vs)
    vs.extend(points);fs.extend(tuple(i+j for j in f) for f in faces)
    coords.extend(uv if uv is not None else [(0,0)]*len(points))

def rows(m,rings,cap=True,uv=None):
    k,n=len(rings),len(rings[0])
    fs=[(r*n+i,r*n+(i+1)%n,(r+1)*n+(i+1)%n,(r+1)*n+i) for r in range(k-1) for i in range(n)]
    if cap: fs += [tuple(reversed(range(n))),tuple(range((k-1)*n,k*n))]
    add(m,np.reshape(rings,(-1,3)),fs,uv)

def outline(w,h,r,steps=6):
    r=min(r,w*.49,h*.49)
    result=[]
    for sx,sy,a in [(1,1,0),(-1,1,.5*pi),(-1,-1,pi),(1,-1,1.5*pi)]:
        for t in np.linspace(a,a+.5*pi,steps):
            result.append((sx*(w*.5-r)+r*cos(t),sy*(h*.5-r)+r*sin(t)))
    return np.array(result)

def box(m,center,dim,r=.001,b=.0006,axes=(X,Y,Z)):
    w,h,t=dim; u,v,z=axes
    b=min(b,min(dim)*.24,r*.65)
    rings=[]
    for cut,delta in [(b,-t/2),(b*.26,-t/2+b*.25),(0,-t/2+b),
                      (0,t/2-b),(b*.26,t/2-b*.25),(b,t/2)]:
        xy=outline(w-2*cut,h-2*cut,max(.00005,r-cut),3 if r<.0026 else 6)
        rings.append(center+delta*z+xy[:,0,None]*u+xy[:,1,None]*v)
    rows(m,rings)

def decal(m,center,w,h,right,up,uv=(0,0,1,1)):
    u0,v0,u1,v1=uv
    add(m,[center+right*x*w/2+up*y*h/2 for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]],
        [(0,1,2,3)],[(u0,v0),(u1,v0),(u1,v1),(u0,v1)])

def lathe(m,center,axis,profile,n=32,rib=0):
    axis=np.array(axis)/np.linalg.norm(axis)
    u=np.cross(axis,Z if abs(axis[2])<.85 else X);u/=np.linalg.norm(u)
    v=np.cross(axis,u)
    angles=np.arange(n)*2*pi/n
    circle=np.cos(angles)[:,None]*u+np.sin(angles)[:,None]*v
    rad=(1+rib*np.cos(angles*(n//2)))[:,None]
    rows(m,[center+axis*h+r*rad*circle for h,r in profile])

def sources(groupname,label=None):
    return [p for p in parts if p['group']==groupname and (label is None or p['label']==label)]

def reuse(m,p):
    add(m,p['vertices'],p['faces'])

def bounds(p):
    v=np.array(p['vertices'])
    return (v.max(0)+v.min(0))/2,np.ptp(v,axis=0)

group='R02'
box(case,at(0,-.001,.0795),(.208,.150,.151),.008,.004,(U,V,Z))
box(rubber,at(0,.0688,.0795),(.2095,.007,.1515),.003,.0015,(U,V,Z))
box(case,at(0,.073,.0795),(.206,.006,.149),.003,.0014,(U,V,Z))
box(key,at(0,.0761,.0795),(.198,.002,.142),.003,.0005,(U,V,Z))
decal(panel,at(0,.07718,.0795),.190,.135,U,Z)
box(inset,at(-.027,.0785,.0965),(.134,.004,.097),.003,.0007,(U,V,Z))
decal(screen,at(-.027,.08058,.0965),.126,.089,U,Z)
for p in sources(group):
    label=p['label']
    if label=='scope rubber foot': reuse(rubber,p)
    elif label.startswith('BNC shell'): reuse(rim,p)
    elif label=='BNC recessed dielectric':reuse(key,p)
    elif label=='BNC centre contact':reuse(gold,p)
    elif label=='scope USB recess':reuse(inset,p)
    elif label=='scope USB tongue':reuse(rim,p)
    elif label=='scope power key':reuse(dark,p)
    elif label=='scope function key':reuse(key,p)
for i,p in enumerate(sources(group,'channel colour marker')):reuse(colours[i],p)
for x in [.056,.086]:
    for z in [.132,.107,.075,.048]:
        r=.006 if x<.07 else .0047
        base=at(x,.07725,z)
        lathe(rim,base,V,[(0,r*1.15),(.001,r*1.16),(.0014,r*.98)])
        lathe(dark,base,V,[(.0013,r*.92),(.002,r),(.0064,r),(.0072,r*.89)],48,.055)
        box(white,base+.0073*V+.0025*Z,(.00065,.00018,.0022),.0001,.00004,(U,V,Z))
# Fold-flat strap and two pivot bosses, with clearance over the housing.
for sign in [-1,1]:
    lathe(rubber,at(sign*.104,-.004,.124),sign*U,[(0,.009),(.002,.009),(.003,.007)])
    box(dark,at(sign*.1065,-.004,.144),(.0038,.010,.043),.002,.0008,(U,V,Z))
    for j in range(13):
        box(inset,at(sign*.10404,-.049+j*.0063,.094),(.00045,.0024,.031),.0008,.00008,(U,V,Z))
box(dark,at(0,-.004,.164),(.215,.011,.005),.0023,.0011,(U,V,Z))
box(rubber,at(0,-.004,.164),(.111,.015,.008),.0035,.0016,(U,V,Z))

for i in range(12):
    group=f'R03-BIN-{i+1:02}'
    pieces=sources(group)
    for p in pieces:
        if p['label'].startswith('pull '): continue
        center,size=bounds(p)
        box(pull if 'rim' in p['label'] else poly,center,size,r=.0013,b=.00032)
    center,size=bounds(next(p for p in pieces if p['label']=='bin bottom'))
    x,y,z=center
    face=y+size[1]/2
    box(dark,np.array([x,face+.0008,z+.0315]),(.036,.0016,.014),.0011,.00035)
    col,row=i%3,i//3
    decal(card,np.array([x,face+.00166,z+.0315]),.0325,.0115,X,Z,
          (col/3,1-(row+1)/4,(col+1)/3,1-row/4))
    for s in [-1,1]:
        box(pull,np.array([x+s*.014,face+.0038,z+.012]),(.004,.0078,.005),.0017)
    box(pull,np.array([x,face+.0071,z+.0133]),(.032,.004,.005),.0018,.0008)
    # A few loose ceramic capacitors and terminal blocks are visible through
    # the translucent drawer fronts. Each rests on its individual bottom.
    for j in range(5):
        cx=x+((j*7+i*3)%11-5)*.0048
        cy=face-.011-(j%3)*.018
        box([dark,accent,key][i%3],np.array([cx,cy,z+.0058]),(.008,.006,.010),.001)

group='TOOL-CASE'
for p in sources(group):
    if p['label'] not in ('closed case lid','lid edge','front latch'):
        reuse(rim if 'spanner' in p['label'] or 'hinge' in p['label'] else black,p)
box(black,np.array([3.911,.069,1.007]),(.205,.094,.005),.004,.001)
for y in [.034,.046,.093,.105]:
    box(dark,np.array([3.911,y,1.0101]),(.174,.0034,.0024),.0014,.0006)
for x in [3.852,3.970]:
    box(rim,np.array([x,.118,1.0025]),(.015,.0034,.010),.0011)
    box(black,np.array([x,.1198,.9998]),(.010,.0016,.003),.0006)

group='R02-TRAY'
box(rubber,np.array([3.911,.215,.7477]),(.100,.104,.0154),.006,.0018)
box(tray,np.array([3.911,.215,.7565]),(.105,.110,.0032),.006,.001)
# Raised rolled edge around the original bearing support level.
rings=[]
for cut,z in [(0,.7571),(0,.761),(.001,.762),(.003,.762),(.004,.761),(.006,.7581)]:
    xy=outline(.105-2*cut,.110-2*cut,max(.001,.006-cut*.65))
    rings.append(np.c_[xy+[3.911,.215],np.full(len(xy),z)])
rows(tray,rings,False)

group='R02-MAT'
center=np.array([3.90621305,.73560675,.7425])
box(mat_edge,center,(.490,.360,.005),.006,.0005,(U,V,Z))
xy=outline(.489,.359,.006)
add(mat,center+xy[:,0,None]*U+xy[:,1,None]*V+Z*.00253,
    [tuple(range(len(xy)))],np.c_[.5+xy[:,0]/.490,.5+xy[:,1]/.360])

group='TOOL-DRIVER'
for p in sources(group):
    label=p['label']
    if label not in ('handle grip insert','handle collar','contoured handle'):
        reuse(rim,p)
origin=np.array([3.746782,.740202,.754526])
axis=np.array([.7639,.6410,-.0744]);axis/=np.linalg.norm(axis)
lathe(rubber,origin,axis,[(-.066,.0045),(-.063,.0085),(-.057,.010),(-.043,.0104),
      (-.029,.0109),(-.015,.0111),(-.010,.0103),(-.005,.0074),(-.003,.0062)],48,.046)
lathe(accent,origin,axis,[(-.064,.0066),(-.060,.0096),(-.056,.0104),(-.055,.0102)],48)
for h in [-.045,-.038,-.031,-.024]:
    lathe(dark,origin,axis,[(h-.0015,.0106),(h,.011),(h+.0014,.0107)],48,.033)
lathe(accent,origin,axis,[(-.0065,.0084),(-.004,.0081),(.001,.0065),(.002,.006)],40)
lathe(rim,origin,axis,[(.0019,.0059),(.003,.006),(.004,.0052)],36)

group='R04'
for x in [.173,.305]:
    for y in [.613,.694]:
        p=at(x,y,.00962)
        lathe(brass,p,Z,[(0,.0024),(.0002,.00235)])
        lathe(inset,p,Z,[(.0002,.00105),(.00024,.00105)],20)
for x in [.183,.19,.198,.205,.273,.282]:
    p=at(x,.67,.00962)
    box(key,p+.00075*Z,(.0032,.0016,.0015),.00036,.0002,(U,V,Z))
    for s in [-1,1]:
        box(rim,p+s*.00155*U+.00056*Z,(.0009,.0019,.00112),.0002,.0001,(U,V,Z))
for x,y in [(.198,.63),(.273,.684)]:
    p=at(x,y,.00962)
    lathe(inset,p,Z,[(0,.0036),(.001,.0037),(.005,.0036)])
    lathe(rim,p,Z,[(.005,.0035),(.00535,.0032)])

# The installed robot already provides the two jaws; fittings sit on its
# existing end effector without replacing the arm assembly.
group='R01-GRIPPER'
center=np.array([4.135528,.503098,1.13022])
a=np.array([.5348,.84495,0]);a/=np.linalg.norm(a)
b=np.cross(Z,a)
box(rim,center+.006*Z,(.052,.041,.012),.0022,.001,(a,b,Z))
for sign in [-1,1]:
    p=center+sign*.0215*a+.027*Z
    lathe(rim,p,sign*a,[(0,.010),(.004,.010),(.005,.0085)])
    lathe(inset,p,sign*a,[(.005,.0033),(.0053,.0033)],6)
    for j in range(4):
        box(dark,center+sign*.0136*a+Z*(-.014-j*.004),(.003,.010,.0015),.0005,.00025,(a,b,Z))

for (group,material),(verts,faces,coords) in meshes.items():
    mesh=bpy.data.meshes.new(group+' '+material)
    mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(mesh);bm.free()
    if material in (screen,panel,mat,card):
        uv=mesh.uv_layers.new(name='Ink')
        for loop in mesh.loops:uv.data[loop.index].uv=coords[loop.vertex_index]
    for face in mesh.polygons:face.use_smooth=len(face.vertices)==4 and material not in (panel,card,screen)
    obj=bpy.data.objects.new(mesh.name,mesh)
    obj['benchMount']=group
    obj.data.materials.append(mats[material]);bpy.context.collection.objects.link(obj)
bpy.ops.export_scene.gltf(filepath=str(HERE/'model/bench-finish.glb'),export_format='GLB',export_yup=False,
                          export_extras=True,export_animations=False,export_lights=False,export_cameras=False)
