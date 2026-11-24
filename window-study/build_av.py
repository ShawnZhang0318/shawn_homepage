"""Build the shelf CRT, VHS deck and single sleeve in an existing room GLB.

python build_av.py input-room.glb output-room.glb --blender /path/to/blender
Without --blender, export just the furnished input for the contact bake.
The Chinese logo is the unmodified black-logo PNG embedded by www.infiforce.cn
in its home-page header (retrieved 2026-11-19). The still is local room artwork.
"""
import argparse
import io
import json
import struct
import tempfile
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
from build_awards import finish_awards
from folded_scarf import fold_scarf
from workstation import finish_workstation

HERE = Path(__file__).resolve().parent


def lettering(draw, xy, text, size, color, bold=False):
    font = ImageFont.truetype('C:/Windows/Fonts/'+('arialbd.ttf' if bold else 'arial.ttf'), size)
    draw.text(xy, text, font=font, fill=color, anchor='lm')


def artwork():
    photo=Image.open(HERE/'alive-city/bund-night.jpg').convert('RGB')
    photo=ImageOps.fit(photo,(640,480),centering=(.51,.5)).filter(ImageFilter.GaussianBlur(.8))
    a=np.asarray(photo).astype(float)/255
    y,x=np.mgrid[-1:1:480j,-1:1:640j]
    lum=a@np.array([.22,.70,.08])
    a=(.64*a+.36*lum[:,:,None])**.78
    a*=((1-.20*(x*x+y*y))*(.94+.06*np.cos(np.arange(480)[:,None]*np.pi)))[:,:,None]
    screen=Image.fromarray(np.uint8(np.clip(a*[.81,.91,.92]+[.027,.047,.05],0,1)*255))
    tv=Image.new('RGB',(1680,166),'#373630'); d=ImageDraw.Draw(tv)
    for x,label in [(65,'POWER'),(322,'INPUT'),(557,'PICTURE'),(803,'BRIGHT'),(1012,'VOLUME')]:
        lettering(d,(x,26),label,21,'#c8c0ac')
    lettering(d,(1290,102),'CRT   /   MONITOR',24,'#b6ae9e',True)
    vcr=Image.new('RGB',(1544,332),'#302e2b'); d=ImageDraw.Draw(vcr)
    lettering(d,(55,32),'VIDEO CASSETTE RECORDER',23,'#cec6b4',True)
    lettering(d,(1112,40),'4 HEAD   HI-FI',25,'#baae94')
    lettering(d,(62,184),'EJECT',17,'#c9bfaa')
    for cx,txt in [(340,'REW'),(484,'PLAY'),(634,'F.FWD'),(786,'STOP')]:
        lettering(d,(cx,213),txt,17,'#c2baa9')
    counter=Image.new('RGB',(540,112),'#091715'); d=ImageDraw.Draw(counter)
    lettering(d,(30,38),'SP',17,'#76a99a'); lettering(d,(115,63),'0:00:00',60,'#95ccb5')
    lettering(d,(385,66),'STOP',20,'#709985')
    sleeve=Image.new('RGB',(1280,180),'#d7ceae'); d=ImageDraw.Draw(sleeve)
    d.rounded_rectangle((14,12,1266,168),radius=15,outline='#8b8169',width=2)
    logo=Image.open(HERE/'model/textures/infiforce-logo.png').convert('RGBA')
    logo=logo.resize((280,88),Image.Resampling.LANCZOS)
    sleeve.paste(logo,(56,47),logo)
    lettering(d,(400,95),'INFIFORCE',105,'#232d39',True)
    lettering(d,(1100,94),'VHS',47,'#514e43',True)
    top=Image.new('RGB',(780,460),'#343f4b'); d=ImageDraw.Draw(top)
    d.rectangle((22,24,755,290),fill='#d6ccae')
    top.paste(logo,(57,64),logo)
    lettering(d,(60,220),'INFIFORCE',69,'#222e3d',True)
    for i,c in enumerate(['#60758a','#8596a1','#a3aeb1']):
        d.polygon([(442+i*38,288),(582+i*38,24),(606+i*38,24),(470+i*38,288)],fill=c)
    lettering(d,(44,385),'VIDEO CASSETTE',30,'#d2c6a8')
    maker=Image.new('RGB',(960,56),'#373630'); d=ImageDraw.Draw(maker)
    lettering(d,(15,29),'COLOUR VIDEO MONITOR',31,'#ccc5b4',True)
    lettering(d,(800,29),'CV  /  4:3',26,'#b7ad95')
    # Ink, paper fibres and the low-amplitude stipple in moulded ABS.
    maps=dict(screen=screen,tv=tv,vcr=vcr,counter=counter,label=sleeve,top=top,maker=maker)
    rng=np.random.default_rng(921)
    for key in ('tv','vcr','label','top','maker'):
        a=np.asarray(maps[key]).astype(float)
        a+=rng.normal(0,1.8 if key in ('top','label') else 1.15,(*a.shape[:2],1))
        maps[key]=Image.fromarray(a.clip(0,255).astype('uint8'))
    return maps


def rounded(u,v,w,h,r,d):
    points=[]
    for cx,cy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for a in np.deg2rad(np.linspace(start,start+90,7)):
            points.append([u+cx+r*np.cos(a),v+cy+r*np.sin(a),d])
    return np.array(points)


class Model:
    # u reads left-to-right on the fascia, v is height above the shelf,
    # d is depth towards the viewer. All dimensions here are millimetres.
    def __init__(self,origin):
        self.origin=np.array(origin); self.parts=defaultdict(lambda:[[],[],[],[]])

    def face(self,mat,points,uv=None,normals=None):
        p=np.array(points)
        n=np.cross(p[1]-p[0],p[2]-p[0])
        if np.linalg.norm(n)<1e-9: return
        normals=np.tile(n/np.linalg.norm(n),(len(p),1)) if normals is None else np.asarray(normals)
        pos,nor,coords,idx=self.parts[mat]; start=len(pos)
        pos.extend(self.origin+p[:,[2,0,1]]*[.001,-.001,.001])
        nor.extend(normals[:,[2,0,1]]*[1,-1,1])
        coords.extend(uv if uv is not None else [(0,0)]*len(p))
        for i in range(1,len(p)-1): idx.extend([start,start+i+1,start+i])

    def join(self,mat,a,b):
        for i in range(len(a)):
            j=(i+1)%len(a)
            self.face(mat,[a[i],a[j],b[j],b[i]])

    def cap(self,mat,ring):
        center=ring.mean(axis=0)
        for i in range(len(ring)): self.face(mat,[center,ring[i],ring[(i+1)%len(ring)]])

    def solid(self,mat,u,v,w,h,r,back,front,bevel=.6):
        b=min(bevel,r*.7,(front-back)*.35)
        rings=[rounded(u,v,w-2*b,h-2*b,r-b,back),rounded(u,v,w,h,r,back+b),
               rounded(u,v,w,h,r,front-b),rounded(u,v,w-2*b,h-2*b,r-b,front)]
        self.cap(mat,rings[0][::-1])
        for a,c in zip(rings,rings[1:]):self.join(mat,a,c)
        self.cap(mat,rings[-1])

    def print(self,mat,u,v,w,h,d):
        self.face(mat,[(u-w/2,v-h/2,d),(u+w/2,v-h/2,d),(u+w/2,v+h/2,d),(u-w/2,v+h/2,d)],
                  [(0,1),(1,1),(1,0),(0,0)])

    def knob(self,u,v,r,d,mat):
        rings=[rounded(u,v,r*2,r*2,r-.01,d+z) for z in (0,1.5,4.2)]
        self.join('shadow',rings[0],rings[1]); self.join(mat,rings[1],rings[2]); self.cap(mat,rings[2])
        self.solid('index',u,v+r*.58,.85,r*.52,.28,d+4.2,d+4.5,.08)


def monitor():
    m=Model([.40,.42,1.575])
    for u in (-175,175):
        m.solid('rubber',u,4.6,54,9.2,2,-290,-45)
    shell=[rounded(0,200,w,h,r,d) for w,h,r,d in
           [(324,290,22,-355),(350,310,19,-348),(452,361,14,-241),(452,361,14,-80),
            (467,379,13,-62),(476,382,11,-59),(476,382,11,-13),(470,376,10,-8)]]
    m.cap('case',shell[0][::-1])
    for i,(a,b) in enumerate(zip(shell,shell[1:])):m.join('seam' if i==4 else 'case',a,b)
    opening=[rounded(0,222,w,h,r,d) for w,h,r,d in [(412,312,27,-8),(405,305,25,-6),(390,293,24,-16),(381,285,24,-19)]]
    m.join('case',shell[-1],opening[0])
    for i,(a,b) in enumerate(zip(opening,opening[1:])):m.join('rubber' if i!=1 else 'shadow',a,b)
    m.print('maker',0,384,398,9,-7.93)
    # Contour rings keep the tube convex right up to its rounded mask.
    rim=opening[-1]; center=np.array([0,222,-19])
    def tube_vertex(p,k):
        u,v=(p-center)[:2]*k
        return [u,222+v,-18.9+11*(1-k*k)]
    def glass(pts):
        uv=[(.5+u/381,.5-(v-222)/285) for u,v,d in pts]
        normal=np.array([[22*u/190.5**2,22*(v-222)/142.5**2,1] for u,v,d in pts])
        normal/=np.linalg.norm(normal,axis=1)[:,None]
        m.face('screen',pts,uv,normal)
    for i in range(len(rim)):
        a,b=rim[i],rim[(i+1)%len(rim)]
        glass([tube_vertex(a,0),tube_vertex(a,.1),tube_vertex(b,.1)])
        for k in range(1,10):
            glass([tube_vertex(a,k/10),tube_vertex(a,(k+1)/10),tube_vertex(b,(k+1)/10),tube_vertex(b,k/10)])
    m.solid('shadow',0,39,431,49,5,-8.3,-6.0)
    m.print('tv',0,39,420,41.5,-5.9)
    m.solid('key',-181,34,22,11,2,-5.9,-2)
    m.solid('led',-162,35,4.2,2.6,1,-5.9,-4.8)
    m.solid('key',-117,33,19,9,1.8,-5.9,-2.4)
    for u in (-60,0,53):m.knob(u,34,7.9,-5.9,'key')
    jack=rounded(-143,34,8.3,8.3,4.12,-5.82)
    m.join('edge',jack,rounded(-143,34,6.1,6.1,3.02,-4.9))
    m.cap('shadow',rounded(-143,34,6,6,2.98,-4.96))
    for u in range(101,194,6):
        m.solid('shadow',u,44,2.4,12,1,-5.9,-5.55,.1)
    for side in (-1,1):
        for i in range(15):
            d=-221+i*8.4
            m.face('shadow',[(side*226.1,155,d),(side*226.1,253,d),(side*226.1,252,d+3.7),(side*226.1,154,d+3.7)])
            m.face('edge',[(side*226.2,155,d+3.7),(side*226.2,252,d+3.7),(side*226.2,251,d+4.4),(side*226.2,155,d+4.4)])
    return m


def recorder():
    m=Model([.390,.405,1.405])
    for u in (-156,156):m.solid('rubber',u,3.5,49,7,2,-286,-29)
    m.solid('metal',0,51,430,88,4,-337,-8,1.8)
    m.solid('case',0,50,431,86,4,-14,0,1.8)
    m.print('vcr',0,50,418,80,.04)
    m.solid('shadow',-58,60,261,31,2.6,.05,1.4)
    m.solid('flap',-58,61.6,256,24,1.8,1.4,2.5)
    m.solid('edge',-58,50.7,241,1.1,.40,2.5,2.85,.1)
    m.solid('rubber',144,46,110,31,2.3,.05,1.1)
    m.print('counter',144,46,104,24,1.2)
    for i,u in enumerate([-177,-109,-69,-29,12]):
        m.solid('shadow',u,24,25,9,1,.05,1)
        m.solid('key' if i else 'edge',u,24.5,22.5,6.8,1,1,3.1)
        if i==4:
            m.solid('index',u,24.6,2.7,2.7,.25,3.11,3.24,.05)
        else:
            for offset in ((-1.7,1.7) if i in (1,3) else (0,)):
                direction=-1 if i==1 else 1
                mark=np.array([[-1.1,-1.5],[1.5,0],[-1.1,1.5]])*[direction,1]
                if i==0:mark=mark[:,::-1]
                m.face('index',[[u+offset+a,24.6+b,3.16] for a,b in mark])
    for u in [104,126,148]:m.solid('key',u,21,12,4,1,.1,2.3)
    m.solid('ruby',187,21,6,3,.7,.1,1.2)
    return m


def cassette():
    m=Model([.404,.802,1.405])
    # A horizontal slipcase with an exposed short end and a recessed cassette.
    m.solid('rubber',0,14.6,190,25,2.1,-114,-2)
    for height in (1.1,28.1):m.solid('sleeve',0,height,198,2.2,.8,-119,0)
    m.solid('sleeve',0,14.6,198,25.2,.85,-2.1,0)
    m.solid('sleeve',98,14.6,2,25.2,.8,-119,-1)
    m.solid('sleeve',0,14.6,198,25.2,.85,-119,-117)
    m.print('label',0,14.7,190,24,.10)
    m.face('top',[(-96,29.27,-116),(-96,29.27,-2),(96,29.27,-2),(96,29.27,-116)],
           [(0,0),(0,1),(1,1),(1,0)])
    for d in np.arange(-100,-22,5):
        m.face('edge',[(-95.15,6,d),(-95.15,23,d),(-95.15,23,d+1),(-95.15,6,d+1)])
    return m


def soften_surface_grain(doc, buf):
    # Work on local brightness at the scale of individual fibres and grain
    # lines. The same signed adjustment to R, G and B preserves their spacing.
    grain_maps = {'joinery', 'parquet', 'rugweave', 'checkedwool', 'oatlinen',
                  'chairweave', 'Medal ribbon / woven twill'}
    images = {im['bufferView']: im['name'] for im in doc['images'] if im['name'] in grain_maps}
    for material in doc['materials']:
        if material['name'] in grain_maps | {'joinery-worktop'} and 'normalTexture' in material:
            material['normalTexture']['scale'] *= .85

    packed = bytearray()
    for index, view in enumerate(doc['bufferViews']):
        start = view['byteOffset']
        payload = memoryview(buf)[start:start + view['byteLength']]
        if index in images:
            with Image.open(io.BytesIO(payload)) as image:
                pixels = np.array(image)
                # The mesh chair encodes its yarn in opacity rather than colour.
                chair = images[index] == 'chairweave'
                detail = pixels[:, :, 3] if chair else np.array(image.convert('L'))
                detail = detail.astype(np.float32)
                local = cv2.bilateralFilter(detail, 13, 22 if not chair else 70, 2.6)
                change = np.rint(.24 * (local - detail)).astype(np.int16)
                channels = pixels[:, :, 3:] if chair else pixels[:, :, :3]
                channels[:] = np.clip(channels.astype(np.int16) + change[:, :, None], 0, 255)
            output = io.BytesIO()
            Image.fromarray(pixels).save(output, 'PNG', optimize=True)
            payload = output.getvalue()
        packed.extend(bytes(-len(packed) % 4))
        view.update(byteOffset=len(packed), byteLength=len(payload))
        packed.extend(payload)
    return packed


def build(source,target):
    data=source.read_bytes(); n=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+n]); buf=bytearray(data[28+n:])
    if any(m['name']=='AV / screen' for m in doc['materials']):raise ValueError('Use the room before the AV pass as input')
    def append(data,target=None):
        buf.extend(bytes(-len(buf)%4)); v=dict(buffer=0,byteOffset=len(buf),byteLength=len(data))
        if target:v['target']=target
        buf.extend(data);doc['bufferViews'].append(v);return len(doc['bufferViews'])-1
    def attr(a,kind):
        idx=kind=='SCALAR'; a=np.asarray(a,dtype='<u2' if idx else '<f4')
        v=dict(type=kind,componentType=5123 if idx else 5126,count=len(a),bufferView=append(a.tobytes(),34963 if idx else 34962))
        if kind=='VEC3':v.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
        doc['accessors'].append(v);return len(doc['accessors'])-1
    def texture(image,name):
        output=io.BytesIO();image.save(output,'PNG',optimize=True)
        index=len(doc['textures']);doc['textures'].append(dict(sampler=0,source=len(doc['images'])))
        doc['images'].append(dict(name=name,mimeType='image/png',bufferView=append(output.getvalue())))
        return index
    textures={key:texture(image,'AV / '+key) for key,image in artwork().items()}
    colors={'case':('#373630',.63),'seam':('#201e1d',.71),'shadow':('#171a1b',.72),
        'rubber':('#272728',.89),'key':('#514d47',.46),'edge':('#807d70',.52),
        'index':('#c3bca1',.70),'led':('#78b398',.35),'metal':('#43413d',.51),
        'flap':('#42413c',.68),'ruby':('#74372d',.6),'sleeve':('#394656',.74)}
    mats={}
    for key in list(colors)+list(textures):
        color,rough=colors.get(key,('#ffffff',.68))
        rgb=np.array(list(bytes.fromhex(color[1:])))/255
        linear=np.where(rgb<.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
        pbr=dict(baseColorFactor=[*linear,1],roughnessFactor=rough,metallicFactor=.18 if key=='metal' else 0)
        material=dict(name='AV / '+key,doubleSided=True,pbrMetallicRoughness=pbr)
        if key in textures:pbr['baseColorTexture']={'index':textures[key]}
        if key in ('screen','counter'):
            pbr.update(roughnessFactor=.23,baseColorFactor=[.17,.19,.19,1])
            material.update(emissiveTexture={'index':textures[key]},emissiveFactor=[.78,.81,.81])
        mats[key]=len(doc['materials']); doc['materials'].append(material)
    nodes={node['name']:node for node in doc['nodes']}
    for name,model in [('M01',monitor()),('M02',recorder()),('M03-TAPE-01',cassette())]:
        prim=[]
        for mat,(pos,norm,uv,indices) in model.parts.items():
            attributes=dict(POSITION=attr(pos,'VEC3'),NORMAL=attr(norm,'VEC3'))
            if mat in textures:attributes['TEXCOORD_0']=attr(uv,'VEC2')
            prim.append(dict(attributes=attributes,material=mats[mat],indices=attr(indices,'SCALAR')))
        doc['meshes'][nodes[name]['mesh']]['primitives']=prim
    omitted={i for i,node in enumerate(doc['nodes']) if node['name'] in ('M03-TAPE-02','M03-TAPE-03','M03-TAPE-04')}
    assert len(omitted)==3
    for node in doc['nodes']:
        if 'children' in node:node['children']=[i for i in node['children'] if i not in omitted]
    finish_awards(doc,buf,attr,texture)
    fold_scarf(doc,buf,attr)
    finish_workstation(doc,buf,attr,texture)
    buf=soften_surface_grain(doc,buf)
    # Intermediate veneer used by the standalone prop export.
    cabinet = next(m for m in doc['materials'] if m['name'] == 'joinery')
    veneer = cabinet['pbrMetallicRoughness']['baseColorTexture']
    image = doc['images'][doc['textures'][veneer['index']]['source']]
    view = doc['bufferViews'][image['bufferView']]
    start = view['byteOffset']
    with Image.open(io.BytesIO(buf[start:start + view['byteLength']])) as source_wood:
        wood = source_wood.convert('RGB')
        base = wood.resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))
    desk = next(m for m in doc['materials'] if m['name'] == 'joinery-worktop')
    desk_wood = Image.blend(Image.new('RGB', wood.size, base), wood, .35)
    shared_wood = texture(desk_wood, 'Joinery / subdued wood grain')
    for material in (desk, cabinet):
        material['pbrMetallicRoughness']['baseColorTexture']['index'] = shared_wood
        material['normalTexture']['scale'] *= .35
    buf.extend(bytes(-len(buf)%4));doc['buffers'][0]['byteLength']=len(buf)
    header=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode();header+=b' '*(-len(header)%4)
    target.write_bytes(struct.pack('<4sIIII',b'glTF',2,28+len(header)+len(buf),len(header),0x4e4f534a)+header+
                       struct.pack('<II',len(buf),0x004e4942)+buf)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('source',type=Path);parser.add_argument('target',type=Path)
    parser.add_argument('--blender', help='Bake the furnished room and apply the runtime wood and textile finishes')
    args=parser.parse_args()
    if args.blender:
        from room_finishes import bake_and_finish
        with tempfile.TemporaryDirectory() as directory:
            furnished = Path(directory) / 'furnished.glb'
            build(args.source, furnished)
            bake_and_finish(furnished, args.target, args.blender)
    else:
        build(args.source,args.target)
