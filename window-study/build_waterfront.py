"""Build the fixed Pudong volumes in the 8805 room's original Z-up metre coordinates."""
import io
import json
import struct
from copy import deepcopy
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
parent = ROOT.with_name('WINDOW-STUDY-V0.1') / 'model/BATCH-02-EQUIPMENT.glb'
original = parent.read_bytes()
size = struct.unpack_from('<I', original, 12)[0]
doc = json.loads(original[20:20+size])
binary = bytearray(original[28+size:])
origin = np.array([5.82, -.29, 1.67])
span = np.pi / 3
ground = origin[2] - 67.5


def append_view(data, target=None):
    binary.extend(b'\0' * (-len(binary) % 4))
    item = dict(buffer=0, byteOffset=len(binary), byteLength=len(data))
    if target:
        item['target'] = target
    doc['bufferViews'].append(item)
    binary.extend(data)
    return len(doc['bufferViews']) - 1


def accessor(values, dtype, kind, component, target):
    a = np.asarray(values, dtype=dtype)
    item = dict(bufferView=append_view(a.tobytes(), target), componentType=component,
                count=len(a), type=kind)
    if kind == 'VEC3':
        item.update(min=a.min(axis=0).tolist(), max=a.max(axis=0).tolist())
    doc['accessors'].append(item)
    return len(doc['accessors']) - 1


def primitive(vertices, uv, triangles, material):
    return dict(attributes={'POSITION': accessor(vertices, '<f4', 'VEC3', 5126, 34962),
                            'TEXCOORD_0': accessor(uv, '<f4', 'VEC2', 5126, 34962)},
                indices=accessor(np.array(triangles).reshape(-1), '<u4', 'SCALAR', 5125, 34963),
                material=material)


def place(x, y, distance):
    angle = (x / 1500 - .5) * span + np.deg2rad(5.8)
    along, across = np.cos(angle), np.sin(angle)
    return origin + np.array([.6*along+.8*across, -.8*along+.6*across,
                              -.09 + (.75-y/500)*span/3]) * distance


mat = next(i for i,m in enumerate(doc['materials']) if m['name']=='sh-waterfront')
tex = doc['materials'][mat]['pbrMetallicRoughness']['baseColorTexture']['index']
image = doc['images'][doc['textures'][tex]['source']]
view = doc['bufferViews'][image['bufferView']]
source = np.array(Image.open(io.BytesIO(binary[view['byteOffset']:view['byteOffset']+view['byteLength']])).convert('RGB'))
h,w = source.shape[:2]
scale = np.array([w/1500, h/500])


def material(name, pixels):
    stream = io.BytesIO()
    Image.fromarray(pixels).save(stream, format='PNG')
    doc['images'].append(dict(name=name, bufferView=append_view(stream.getvalue()), mimeType='image/png'))
    doc['textures'].append(dict(sampler=doc['textures'][tex]['sampler'],source=len(doc['images'])-1))
    m = deepcopy(doc['materials'][mat])
    m['name'] = name
    m['pbrMetallicRoughness']['baseColorTexture']['index'] = len(doc['textures'])-1
    doc['materials'].append(m)
    return len(doc['materials'])-1


# A building atlas has two disjoint regions: the photographed wall and a
# neutral, fine-grained roof. Padding keeps facade lights off roof edges.
roof_regions = {}
def facade_material(name, facade):
    height, width = facade.shape[:2]
    yy, xx = np.indices((24, width))
    grain = ((xx * 7 + yy * 11 + xx * yy) % 9) - 4
    roof_tile = (np.array([39, 39, 46]) + grain[..., None]).astype(np.uint8)
    image = np.concatenate((facade, np.repeat(facade[-1:], 3, axis=0), roof_tile), axis=0)
    m = material(name, image)
    roof_regions[m] = (height / len(image), (height + 6) / len(image), (len(image)-3) / len(image))
    return m


class Envelope:
    """Separate the face corners at the material seams, like a textured box."""
    def __init__(self, mat):
        self.mat = mat
        self.points, self.uvs, self.faces, self.light = [], [], [], []

    def face(self, points, uvs, light=1, roof=False):
        wall_height, top, bottom = roof_regions[self.mat]
        index = len(self.points)
        self.points.extend(points)
        for u, v in uvs:
            self.uvs.append((u, top + v*(bottom-top) if roof else v*wall_height))
            self.light.append([light]*3)
        for j in range(1,len(points)-1):
            self.faces.append((index, index+j, index+j+1))

    def primitive(self):
        mesh = primitive(self.points, self.uvs, self.faces, self.mat)
        mesh['attributes']['COLOR_0'] = accessor(self.light, '<f4', 'VEC3', 5126, 34962)
        return mesh


# Profiles measured on a 1500 x 500 working copy of the embedded original.
# Each ring is (image row, left silhouette, right silhouette). Depth is in metres.
round_plan = [(np.sin(a),-np.cos(a)) for a in np.arange(32)*2*np.pi/32]
faceted = [(-1,-.45),(-.66,-.97),(.37,-1),(1,-.39),(.89,.66),(.4,1),(-.73,.91),(-1,.4)]
wedge = [(-1,-.44),(.28,-1),(1,-.49),(.96,.9),(-.87,1)]
groups = []


def building(name,distance):
    group=dict(name=name,distance=distance,sections=[])
    groups.append(group)
    return group


def section(group,plan,depth,rings,foundation=False):
    group['sections'].append((plan,depth,rings,foundation))


def symmetric(group,depth,rows):
    section(group, round_plan,depth,[(y,606.4-r,606.4+r) for y,r in rows])


pearl=building('Oriental Pearl',873)
symmetric(pearl,1,[(10,.55),(40,.8),(51,1.5),(56,2.0),(69,2.4),(74,4.5),(77,6.1),(82,7.1),(86,5.6),(89,3.1),(105,3.2),(109,5.4),(112,3.6),(120,6.0)])
symmetric(pearl,1,[(118,3),(120,9),(124,15.4),(129,19.5),(136,21.4),(143,19.9),(149,16.5),(153,10.8),(157,3.3)])
for left,right in [(594,599),(600,606),(612,618)]:
    section(pearl,round_plan,2.4,[(153,left+1,right),(259,left-1,right)])
for y in [173,192,215,236,254]:
    section(pearl,faceted,3,[(y,597,615),(y+2.1,597,615)])
symmetric(pearl,1,[(256,4),(259,13),(264,20),(271,24.2),(280,26.3),(287,25.0),(295,21),(301,15),(305,6)])
for rings in [[(299,583,590),(320,575,582),(341,565,572),(353,560,568)],
              [(299,621,629),(320,628,637),(341,636,645),(356,640,650)],
              [(302,593,601),(353,593,602)],[(302,604,611),(356,607,616)]]:
    section(pearl,round_plan,3.3,rings,True)

jin=building('Jin Mao Tower',1192)
section(jin,faceted,20,[(128,782.4,783.4),(142,781.7,784.4),(145,779.6,786),
 (152,779,787),(156,774,792),(161,773,794),(164,768.8,797),(170,766,800),(182,766,800),
 (185,764.8,802),(201,764.8,802),(203,763.3,803.5),(219,763.3,803.5),(222,762,805),
 (238,762,805),(241,760,806.7),(257,760,806.7),(260,758.7,808.2),(284,758.7,808.2),
 (286,757,810.8),(326,757,810.8)],True)
swfc=building('World Financial Center',1270)
section(swfc,wedge,22,[(143,822.8,869.8),(185,823.5,870.4),(257,823.7,870.5),(326,824,871)],True)
section(swfc,wedge,16,[(115.5,821.7,829),(125,821.8,829.1),(143.5,822.8,831.5)])
section(swfc,wedge,16,[(111,862.2,869.5),(120.5,862.2,869.8),(143.5,856.4,869.8)])
section(swfc,wedge,16,[(110.7,865.8,869.3),(115.9,822,869.6),(119.5,822,868.9),(121.8,822.3,845),(124.4,823,829)])
shanghai=building('Shanghai Tower',1320)
section(shanghai,round_plan,1,[(26.6,915,929),(28.2,913,936.5),(32.5,912,941.8),
 (62,911.7,943.4),(101,911.3,945.1),(143,909.2,946.2),(189,906.9,947.6),
 (232,904,949),(279,902,951.2),(328,900,953)],True)

# Foreground occluders and two mid-rise silhouettes establish a second bank layer.
for name,distance,depth,outline in [
 ('Riverside Hall West',862,7,[(324,739,831),(327,737,834),(332,739,833),(357,739,833)]),
 ('Riverside Hall East',855,7,[(327,899,953),(331,897,955),(356,898,955)]),
 ('East Quay Offices',1070,11,[(268,928,950),(271,924,961),(276,925,961),(327,925,961)]),
 ('West Bank Offices',980,15,[(227,699,704),(230,676,723),(233,676,723),(345,677,724)]),
 ('East Bank Offices',958,15,[(228,995,1001),(231,980,1022),(235,979,1024),(350,979,1025)])]:
    section(building(name,distance),wedge,depth,outline,True)


def mask_for(group):
    mask=np.zeros((h,w),np.uint8)
    for _,_,rings,_ in group['sections']:
        outline=[(left,y) for y,left,right in rings]+[(right,y) for y,left,right in reversed(rings)]
        cv2.fillPoly(mask,[np.rint(np.array(outline)*scale).astype(np.int32)],255)
    return mask


# Remove only extracted silhouettes from the farther layer; fill hidden texels
# from the local surroundings. Facade crops retain the original night detail.
for g in groups:
    g['mask']=mask_for(g)
occupied=np.zeros((h,w),np.uint8)
for g in sorted(groups,key=lambda g:g['distance']):
    x,y,ww,hh=cv2.boundingRect(g['mask'])
    x0=max(0,x-4); y0=max(0,y-4); x1=min(w,x+ww+4); y1=min(h,y+hh+4)
    crop=source[y0:y1,x0:x1].copy()
    nearer=occupied[y0:y1,x0:x1]
    if np.any(nearer):
        crop=cv2.inpaint(crop,nearer,3,cv2.INPAINT_TELEA)
    g['crop']=(x0,y0,crop.shape[1],crop.shape[0])
    g['material']=facade_material(g['name']+' photographic facade',crop)
    occupied=cv2.bitwise_or(occupied,g['mask'])
# Where a tower has been removed, fill the occluded rear lots with nearby
# street detail. Broad inpainting makes blurred wedges visible between towers.
backdrop=source.copy()
cut=cv2.dilate(occupied,np.ones((3,3),np.uint8))
for y,mask in enumerate(cut):
    starts=np.flatnonzero(np.diff(np.r_[False,mask>0,False]))
    for left,right in starts.reshape(-1,2):
        length=right-left
        offsets=np.arange(length)
        donor=left-length+offsets
        if left<length or np.any(mask[donor]):
            donor=right+offsets
        donor=np.clip(donor,0,w-1)
        backdrop[y,left:right]=source[y,donor]
# Site axes: X along the riverfront, Y inland from the window, Z absolute height.
# The photograph calibrates visible facade detail. It does not determine the
# shape of the land or drag a building's back corners toward an image plane.
azimuth=np.deg2rad(5.8)
along=np.array([.8,.6,0])*np.cos(azimuth)-np.array([.6,-.8,0])*np.sin(azimuth)
inland=np.array([.6,-.8,0])*np.cos(azimuth)+np.array([.8,.6,0])*np.sin(azimuth)
grade=ground+3.15

def world(x,y,z):
    return origin+along*x+inland*y+np.array([0,0,z-origin[2]])

def abscissa(u,y):
    return y*np.tan((u/1500-.5)*span)

def elevation(u,v,y):
    ray_length=np.hypot(abscissa(u,y),y)
    return origin[2]+ray_length*(-.09+(.75-v/500)*span/3)

def image_row(x,y,z):
    return 500*(.75-((z-origin[2])/np.hypot(x,y)+.09)/(span/3))

nodes={node.get('name'):node for node in doc['nodes']}
def put(name,prims):
    if name in nodes:
        doc['meshes'][nodes[name]['mesh']]['primitives']=prims
        return
    doc['meshes'].append(dict(name=name,primitives=prims))
    doc['nodes'][0]['children'].append(len(doc['nodes']))
    doc['nodes'].append(dict(name=name,mesh=len(doc['meshes'])-1))

def ribbon(name,sections,m):
    verts=[];uv=[];idx=[]
    for i,pair in enumerate(sections):
        for xyz,st in pair:
            verts.append(xyz);uv.append(st)
        if i:
            k=2*i;idx.extend([(k-2,k-1,k),(k,k-1,k+1)])
    put(name,[primitive(verts,uv,idx,m)])

# The core city is rectilinear. Long stretches at each end of the river
# are visible obliquely and recede naturally with distance along the quay.
photo=cv2.resize(backdrop,(1500,500),interpolation=cv2.INTER_AREA)
skyline_sky=np.median(photo[:314,196:215],axis=1)
sky_colour=np.vstack([skyline_sky, np.repeat(skyline_sky[-1:],186,axis=0)])
# Sky pixels only, including the original hue gradient and low-frequency texture.
sky_texture=np.tile(sky_colour[:,None,:],(1,64,1)).astype(np.uint8)
sky_mat=material('River night sky',sky_texture)
angles=np.linspace(-np.pi,np.pi,240)
sky_pos=[];sky_uv=[];sky_faces=[]
for j,v in enumerate([-1500,0,100,220,315,375,700]):
    z=origin[2]+3800*(-.09+(.75-v/500)*span/3)
    for i,a in enumerate(angles):
        sky_pos.append(world(3800*np.sin(a),3800*np.cos(a),z))
        sky_uv.append((.5,np.clip(v/500,0,1)))
        if j and i:
            k=j*len(angles)+i
            sky_faces.extend([(k-len(angles)-1,k-1,k),(k-len(angles)-1,k,k-len(angles))])
put('SH-NIGHT-SKY',[primitive(sky_pos,sky_uv,sky_faces,sky_mat)])

# Get each remaining street roofline from the original, after the nine
# independently modelled buildings have been removed from their background.
difference=np.linalg.norm(cv2.blur(photo,(3,3)).astype(float)-sky_colour[:,None,:],axis=2)
active=(difference[220:367]>17).astype(np.float32)
active=cv2.boxFilter(active,-1,(3,7))>.64
roof=220+np.argmax(np.vstack([active,np.ones((1,1500),bool)]),axis=0)
roof=cv2.medianBlur(roof.astype(np.float32)[None,:],5).ravel()

bank_mat=facade_material('Pudong original street facades',backdrop[:int(h*.75)+2])
stone_mat=material('Embankment masonry',source[int(h*.741):int(h*.750),:,:])
# Asphalt and planted parcels darken into the distant night haze. A single
# flat-colour land rectangle reads as a solid band across the river horizon.
paving=np.empty((256,1024,3),np.uint8)
rng=np.random.default_rng(8805)
edge=source[int(.729*h):int(.74*h)]
for j in range(256):
    t=j/255
    base=(1-t)*np.array([28,26,24])+t*np.array([34,34,52])
    lights=cv2.resize(edge[j%len(edge):j%len(edge)+1],(1024,1))[0]
    paving[j]=np.clip(base+(lights.astype(float)-20)*(.34*(1-t)**2)+rng.normal(0,2,(1024,1)),0,255)
paving_mat=material('Promenade and ground',paving)
# Distinct central parcels keep their own photo intervals. The peripheral
# buildings reuse individual local facade strips in a different site plan;
# no mirrored city or repeated panoramic backdrop.
boundaries=[0,38,83,124,158,198,248,277,324,359,409,465,500,547,582,628,674,
  733,758,813,875,900,961,978,1029,1050,1106,1133,1177,1203,1250,1294,1334,1366,1396,1441,1463,1500]
lots=[]
for i,(lo,hi) in enumerate(zip(boundaries,boundaries[1:])):
    height_ref=np.percentile(roof[lo:hi],25)
    setback=np.clip(1100-(height_ref-260)*2.5,895,1250)+[5,38,-13,61,-29][i%5]
    for g in groups:
        x0,_,width,_=g['crop']
        if lo < (x0+width)/scale[0] and hi > x0/scale[0]:
            setback=max(setback,g['distance']+95)
    lots.append((lo,hi,lo,hi,setback))
wings=[(280,325),(1128,1175),(355,403),(1288,1336),(425,463),(1370,1395),(164,198),(1051,1103),(1252,1292),(333,358),(1465,1495),(504,542)]
for side,start in [(-1,0),(1,1500)]:
    for i in range(24):
        a,b=wings[(i*(5 if side>0 else 7)+(2 if side>0 else 0))%len(wings)]
        extent=(b-a)*(.86+.16*((i*3+(side+1))%5))
        end=start+side*extent
        lo,hi=sorted([start,end])
        lots.append((lo,hi,a,b,970+((i*47+side*55)%280)))
        start=end

# Closed street wings with independent footprints, parapets, roofs, rear walls
# and street gaps. The lit facade is sampled only below its own roof boundary.
def city_block(lo,hi,src_lo,src_hi,y,depth,profile,bottom,base_row=None,mat=bank_mat,metres_per_row=None):
    envelope = Envelope(mat)
    columns = np.linspace(lo+.16,hi-.16,max(4,int((hi-lo)/2)))
    rows = []
    for u in columns:
        src = src_lo+(src_hi-src_lo)*(u-lo)/(hi-lo)
        x = abscissa(u,y)
        v = profile(src)
        z = (max(bottom+.8,elevation(src,v,y)) if metres_per_row is None
             else bottom+max(3,(base_row-v)*metres_per_row))
        base = max(v+2,min(374,image_row(x,y,bottom))) if base_row is None else base_row
        points = [world(x,y,bottom),world(x,y,z),world(x,y+depth,z),world(x,y+depth,bottom)]
        rows.append((src/1500, v/(375+2/scale[1]), base/(375+2/scale[1]), points))
    for left,right in zip(rows,rows[1:]):
        u0,v0,b0,q = left
        u1,v1,b1,r = right
        envelope.face([q[0],r[0],r[1],q[1]],[(u0,b0),(u1,b1),(u1,v1),(u0,v0)])
        envelope.face([q[1],r[1],r[2],q[2]],[(u0,0),(u1,0),(u1,1),(u0,1)],roof=True)
        envelope.face([q[2],r[2],r[3],q[3]],[(u0,v0),(u1,v1),(u1,b1),(u0,b0)],.72)
        envelope.face([q[3],r[3],r[0],q[0]],[(u0,0),(u1,0),(u1,1),(u0,1)],.5,roof=True)
    # Give each side its own span of windows, proportional to its length in
    # metres. A single texture column stretched down a whole side smears lights.
    width = abscissa(hi,y)-abscissa(lo,y)
    width_uv = (src_hi-src_lo)/1500
    inset = width_uv * min(.15,2/max(5,src_hi-src_lo))
    span_uv = min(.76,depth/width)*width_uv
    for row, direction, light in [(rows[0],1,.78),(rows[-1],-1,.86)]:
        u,v,base,q = row
        edge = u+direction*inset
        # Sample inside the facade below the roofline to avoid carrying sky
        # over the return on stepped roofs.
        inside_row = profile(1500*(edge+direction*span_uv))/(375+2/scale[1])
        far_v = min(base-.002,max(v,inside_row))
        envelope.face(q,[(edge,base),(edge,v),(edge+direction*span_uv,far_v),
                         (edge+direction*span_uv,base)],light)
    return envelope.primitive()

for i,(lo,hi,a,b,y) in enumerate(lots):
    put(f'SH-block-{i:02}',[city_block(lo,hi,a,b,y,19+(i*11)%35,
        lambda x:roof[int(np.clip(x,0,1499))],grade)])

# The quay is a physical vertical retaining wall with a level paved top.
extent=5900
ribbon('SH-PUDONG',[
 [(world(x,750,ground),(i/32,1)),(world(x,750,grade),(i/32,0))]
 for i,x in enumerate(np.linspace(-extent,extent,161))],stone_mat)
ribbon('SH-quayside-ground',[
 [(world(x,750,grade),((x+extent)/(2*extent),0)),(world(x,2300,grade),((x+extent)/(2*extent),1))]
 for x in [-extent,extent]],paving_mat)

# A subdued, distant built frontage terminates the view between separate
# city blocks. Each parcel has a street face and a return, standing on grade.
hazy=np.round(.69*source[:int(h*.75)+2]+.31*np.array([38,38,55])).astype(np.uint8)
haze_mat=facade_material('Distant street in river haze',hazy)
# Intact facades with both roof and base visible in the reference. Sample each
# vertical wall from its own roof down to its own base, including at oblique
# ends of the quay; projecting the sky into an upper storey produces ghosting.
rear_facades=[(96,120,296,350),(130,152,285,350),(279,308,281,350),
              (333,355,257,344),(417,450,249,330),(1049,1088,250,300),
              (1139,1174,276,348),(1303,1333,300,338),(1466,1490,288,348)]
for i,(lo,hi,a,b,_) in enumerate(lots):
    start,end,top,base=rear_facades[(i*5+i//6)%len(rear_facades)]
    def rear_roof(x):
        return max(top,roof[int(np.clip(x,0,1499))]+2)
    put(f'SH-rear-parcel-{i:02}',[city_block(lo,hi,start,end,1590+(i*29)%170,
        32,rear_roof,grade,base_row=base,mat=haze_mat,metres_per_row=.70)])
# Lower buildings already visible behind the promenade in the original image.
# Use their original frontages, set back from the wall, with service gaps.
fronts=[(4,32,342),(49,78,335),(94,128,341),(149,179,338),(205,240,348),
        (260,286,340),(310,351,330),(374,409,329),(413,482,332),(485,541,331),
        (548,572,340),(642,689,328),(696,734,344),(837,894,329),(961,978,341),
        (1025,1081,336),(1084,1129,309),(1151,1181,336),(1202,1219,343),
        (1245,1291,332),(1297,1332,340),(1351,1387,332),(1405,1438,344),(1462,1497,341)]
for i,(lo,hi,roof_row) in enumerate(fronts):
    def lower_roof(u):
        if i in (9,11):
            s=(u-(hi+lo)/2)/((hi-lo)/2)
            return roof_row+10*(1-np.sqrt(max(0,1-s*s)))
        return roof_row+1.3*np.sin((u-lo)*.04)
    put(f'SH-quay-frontage-{i:02}',[city_block(lo,hi,lo,hi,852+(i*11)%43,16,lower_roof,grade,base_row=356)])

# The vegetation has an uneven crown rather than the parapet of a building.
# Each longitudinal slice meets its neighbours and samples only the park strip.
for i,(lo,hi,a,b,_) in enumerate(lots):
    canopy=Envelope(bank_mat)
    last=None
    for u in np.linspace(lo,hi,max(8,int((hi-lo)/1.7))):
        src=np.interp(u,[lo,hi],[a,b])
        x=abscissa(u,774)
        crown=6.5+1.1*np.sin(x*.19)+1.35*np.cos(x*.33+.5)
        section=[(774,grade,372),(774.4,grade+crown*.64,365),
                 (776,grade+crown,357),(779.3,grade+crown*.92,358),
                 (782,grade+crown*.54,364),(782.7,grade,372)]
        current=[(world(x,y,z),(src/1500,v/(375+2/scale[1]))) for y,z,v in section]
        if last:
            for n in range(len(section)-1):
                quad=[last[n],current[n],current[n+1],last[n+1]]
                canopy.face([q[0] for q in quad],[q[1] for q in quad])
        last=current
    put(f'SH-promenade-{i:02}',[canopy.primitive()])

# One level water surface crosses the full opening and meets the quay at Y=750.
# Build a reflection-only atlas so the city/sky cannot appear in the water mesh.
# The outer light columns correspond to the same facade intervals as the lots.
water=source[int(h*.75):]
tex_lo,tex_hi=-1450,2950
atlas_u=np.linspace(tex_lo,tex_hi,5500)
donor=np.clip(atlas_u,0,1500)
for lo,hi,a,b,_ in lots:
    sel=(atlas_u>=lo)&(atlas_u<hi)
    donor[sel]=np.interp(atlas_u[sel],[lo,hi],[a,b])
water_image=water[:,np.clip(np.rint(donor*w/1500).astype(int),0,w-1)]
water_mat=material('River reflection field',water_image)
ribbon('SH-HUANGPU',[
 [(world(x,-1200,ground),(0,1)),(world(x,750,ground),(1,0))]
 for x in [-extent,extent]],water_mat)

for g in groups:
    envelope=Envelope(g['material'])
    x0,y0,cw,ch=g['crop']
    anchor=np.mean([(l+r)/2 for _,_,rs,_ in g['sections'] for v,l,r in rs])
    frontage=g['distance']*np.cos((anchor/1500-.5)*span)
    for plan,depth,rings,foundation in g['sections']:
        levels=list(rings)+([rings[-1]] if foundation else [])
        floors=[]
        for j,(v,left,right) in enumerate(levels):
            xl,xr=abscissa(left,frontage),abscissa(right,frontage)
            half=(xr-xl)/2
            deep=half if depth==1 else min(depth,half*1.3)
            floor=elevation((left+right)/2,v,frontage)
            z=grade if foundation and j==len(rings) else max(grade+.10,floor)
            line=[]
            for sx,sd in plan:
                x=(xr+xl)/2+sx*half
                # Calibrate fixed facade UVs at the original window: the two
                # visible elevations already have their correct highlights.
                photo_x=1500*(.5+np.arctan2(x,frontage+sd*deep)/span)
                photo_x=np.clip(photo_x,left+.035*(right-left),right-.035*(right-left))
                tex_v=image_row(x,frontage+sd*deep,z) if j<len(rings) else v
                wall_v=(np.clip(tex_v,v-2,v+2)*scale[1]-y0)/ch
                line.append((world(x,frontage+sd*deep,z), ((photo_x*scale[0]-x0)/cw,wall_v)))
            floors.append(line)
        for j,(upper,lower) in enumerate(zip(floors,floors[1:])):
            for i,(sx,sd) in enumerate(plan):
                k=(i+1)%len(plan)
                dx,dy=plan[k][0]-sx,plan[k][1]-sd
                severity=abs(dy)/(np.hypot(dx,dy)+1e-8)
                quad=[upper[i],upper[k],lower[k],lower[i]]
                coords=[q[1] for q in quad]
                if abs(dx)<.18*abs(dy):
                    # At a deep return the two world corners can share almost
                    # one photo column. Allocate actual neighbouring facade bays.
                    direction=-1 if sx>0 else 1
                    side_uv=min(.32,(abs(dy)*.24))*((levels[j][2]-levels[j][1])*scale[0]/cw)
                    coords=[coords[0],(coords[0][0]+direction*side_uv,coords[1][1]),
                            (coords[3][0]+direction*side_uv,coords[2][1]),coords[3]]
                envelope.face([q[0] for q in quad],coords,1-.12*severity)
        for floor in (floors[0],floors[-1]):
            envelope.face([q[0] for q in floor],[((sx+1)/2,(sd+1)/2) for sx,sd in plan],roof=True)
    prim=envelope.primitive()
    name='SH-volume '+g['name']
    doc['meshes'].append(dict(name=name,primitives=[prim]))
    doc['nodes'][0]['children'].append(len(doc['nodes']))
    doc['nodes'].append(dict(name=name,mesh=len(doc['meshes'])-1,
                             extras=dict(centreDistanceMetres=g['distance'])))
binary.extend(b'\0'*(-len(binary)%4))
doc['buffers'][0]['byteLength']=len(binary)
header=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode('utf8')
header+=b' '*(-len(header)%4)
result=struct.pack('<4sIIII',b'glTF',2,28+len(header)+len(binary),len(header),0x4e4f534a)+header+struct.pack('<II',len(binary),0x004e4942)+binary
(ROOT/'model/room-river-facades.glb').write_bytes(result)
print(f'{len(groups)} fixed volumes; {len(lots)} quayside parcels; {len(result):,} bytes')
