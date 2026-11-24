"""Refit just the 90 shelf volumes in a copy of the original window-study GLB.

Usage: python build_books.py ORIGINAL.glb model/room-river-facades.glb
The shelf order, titles and two resting angles come from the room authoring files.
"""
import argparse
import io
import json
import struct
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


SOURCE = Path(__file__).resolve().parents[2] / 'design/detail-models/BATCH-02-V1.8.1'
FONTS = Path('C:/Windows/Fonts')
W, H, COLS = 320, 432, 10
# Each run is a deliberate sequence of bindings, from the free end to the
# cabinet side. A few matching volumes interrupt groups of unrelated editions.
ROWS = [
    'pjcmmfjjpcccltpsssmfp', 'pclllfjjmtbpfsccmp',
    'jrrrmppcfjjlmtpbccfm', 'pcjfmmllpbstttcj', 'cjpffmsssplcbmj',
]
# binding family, nominal thickness, height, depth (metres), roughness
FORMATS = {
    'c': ('cloth', .044,.259,.187,.94), 'l': ('leather',.048,.237,.168,.56),
    'p': ('paper', .024,.207,.146,.84), 'j': ('journal',.013,.254,.183,.90),
    'm': ('manual',.048,.291,.207,.67), 'f': ('folio',.058,.314,.222,.75),
    't': ('cloth set',.034,.223,.160,.92), 's': ('calf set',.036,.237,.172,.64),
    'b': ('pocket',.023,.170,.120,.86), 'r': ('paper set',.027,.219,.156,.85),
}
PALETTES = {
    'c':['#304944','#494738','#413d49','#4c5a63','#696246','#653f39'],
    'l':['#493529','#683f2e','#503d33'], 'p':['#c3b69b','#907c67','#656f72','#b3a487'],
    'j':['#a39c80','#56676a','#aaa08c','#876555'],
    'm':['#445963','#715143','#9c633d','#566048','#824e44'],
    'f':['#b4a78d','#9b917b','#657270','#ad906e'],
    'b':['#5a5141','#625057'], 's':['#855630'], 'r':['#a69276'], 't':['#3f5050'],
}


@lru_cache(None)
def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def cover_tile(code, title, number, volume, rng):
    color = PALETTES[code][rng.integers(len(PALETTES[code]))]
    tile = Image.new('RGB', (W,H), color)
    d = ImageDraw.Draw(tile)
    gold, bone, ink = '#b99a63', '#d4c6a8', '#332e29'
    light = code in 'pfjr'
    print_color = ink if light else bone
    cn = font('simsun.ttc' if code in 'clstrb' else 'msyhbd.ttc', 31)
    small, roman = font('georgia.ttf',12), font('georgia.ttf',24)
    def vertical(text, y, step, face, fill):
        for k, ch in enumerate(text):
            d.text((46,y+k*step),ch,font=face,fill=fill,anchor='mt')
    def side_title(y, fill):
        for k in range(0,len(title),4):
            d.text((178,y+32*(k//4)),title[k:k+4],font=font('simsun.ttc',25),fill=fill,anchor='mt')
    if code in 'lst':
        # Bound sets have continuous tooling but independently worn boards.
        for y in (26,32,112,118,286,292,398):
            d.line((4,y,88,y), fill=gold, width=2 if y in (32,118,292) else 1)
        d.rectangle((11,128,80,273),fill='#453528' if code=='s' else '#383735')
        d.rectangle((14,131,77,270),outline=gold)
        vertical(title,139,19,font('simsun.ttc',17),gold)
        d.text((46,327),('I','II','III','IV','V')[volume%5],font=roman,fill=gold,anchor='mm')
        d.rounded_rectangle((100,17,257,413),radius=5,outline=gold,width=2)
        side_title(105,gold)
    elif code in 'mf' and number%3==0:
        accent = ('#a24f33','#456567','#8b7942','#984733')[number%4]
        d.rectangle((3,25,265,151 if code=='f' else 112),fill=accent)
        d.line((6,143 if code=='f' else 104,261,143 if code=='f' else 104),fill=bone,width=2)
        d.text((45,58),'图 录' if code=='f' else '手 册',font=font('simhei.ttf',19),fill=bone,anchor='mm')
        vertical(title,169 if code=='f' else 133,35,cn,ink if code=='f' else bone)
        for i in range(5):
            d.arc((121+i*8,210+i*8,252-i*8,339-i*8),20,292,fill=accent,width=2)
        side_title(47,bone)
    elif code in 'mf':
        # A wrapped paper jacket or a printed technical binding. The graphic
        # continues across the hinge when the side of a forward book is visible.
        accent=('#824830','#384f51','#735d45','#454752')[number%4]
        if number%2:
            for j in range(4):
                base=235+13*j
                d.polygon([(4,base+27),(263,base-62),(263,base-57),(4,base+32)], fill=accent)
            vertical(title,39,34,cn,print_color)
            side_title(52,print_color)
        else:
            d.rectangle((3,310,265,423),fill=accent)
            for x in range(12,264,17):
                d.line((x,406,x+56,332),fill='#ad9877',width=1)
            vertical(title,80,32,font('simsun.ttc',29),print_color)
            side_title(89,print_color)
    elif code in 'pjrb':
        if code in 'pr':
            d.rectangle((3,287,265,399),fill=('#674935','#455359','#825442')[number%3] if code!='r' else '#705044')
            d.ellipse((153,248,225,320),fill='#a77752')
        elif code=='j':
            d.rectangle((8,21,83,73),outline=print_color,width=2)
            d.text((46,47),f'{number%19+1:02}',font=roman,fill=print_color,anchor='mm')
        # Some narrow editions read along the spine, others in vertical type.
        if code in 'pj':
            strip=Image.new('RGBA',(248,45)); sd=ImageDraw.Draw(strip)
            sd.text((1,20),title,font=font('simhei.ttf',33),fill=print_color,anchor='lm')
            strip=strip.transpose(Image.Transpose.ROTATE_270)
            tile.paste(strip,(20,87),strip)
        else:
            vertical(title,55,31,cn,print_color)
        side_title(83,print_color)
    else:
        start = int(rng.integers(52,92))
        vertical(title,start,34,cn,gold if number%3 else bone)
        d.line((30,360,61,360),fill=gold,width=2)
        d.ellipse((38,370,53,385),outline=gold,width=2)
        side_title(75,bone)
    # Hinge shadow, exposed fibres, gently faded shoulders and page signatures.
    a=np.asarray(tile).astype(float)
    yy,xx=np.mgrid[:H,:W]
    grain=rng.normal(0,1.9,(H,W))
    if code in 'ct':
        grain+=2.4*np.sin(xx*2.42)+1.6*np.sin(yy*2.11)
    mot=np.array(Image.fromarray(rng.integers(0,255,(18,11),dtype='uint8')).resize((W,H),Image.Resampling.BICUBIC))
    field=grain+(mot.astype(float)-128)*.026
    field-=12*np.exp(-((xx-98)/2.8)**2)
    field+=9*np.exp(-np.minimum(yy,H-1-yy)/7)
    a+=field[:,:,None]
    page=np.array([222,210,181] if code in 'lstb' else [225,219,203],dtype=float)+rng.uniform(-8,5)
    edge=rng.normal(0,3,H)-rng.choice([0,0,0,8,14],H)
    a[:,274:]=page+edge[:,None,None]+grain[:,274:,None]*.45
    return Image.fromarray(a.clip(0,255).astype('uint8'))


class Geometry:
    def __init__(self, cell):
        self.cell=cell
        self.pos=[]; self.norm=[]; self.uv=[]; self.indices=[]

    def quad(self, vertices, pixels):
        start=len(self.pos)
        n=np.cross(np.subtract(vertices[1],vertices[0]),np.subtract(vertices[2],vertices[0]))
        n=n/np.linalg.norm(n)
        self.pos.extend(vertices); self.norm.extend([n]*4)
        col,row=self.cell%COLS,self.cell//COLS
        self.uv.extend([((col+x/W)/COLS,(row+y/H)/9) for x,y in pixels])
        self.indices.extend(start+i for i in (0,1,2,0,2,3))


def book_shape(cell,code,w,h,depth):
    g=Geometry(cell)
    hard=code in 'clstfm'
    board=.0022 if hard else .00075
    lip=.0032 if hard else .0008
    camber=min(w*.22,.0068) if code in 'clst' else min(w*.07,.0022)
    root=depth-camber
    plain=[(105,393)]*4
    # Covers run past the page block on three sides. The fore corners on
    # cloth and calf editions have a small radius visible on the outer board.
    corner=.0036 if hard else .0014
    profile=[(0,corner),(corner,0),(root,0),(root,h),(corner,h),(0,h-corner)]
    for low,high in ((0,board),(w-board,w)):
        outline=[(x,low,z) for x,z in profile]
        other=[(x,high,z) for x,z in profile]
        for i in range(len(profile)):
            j=(i+1)%len(profile)
            g.quad([outline[i],other[i],other[j],outline[j]],plain)
        for y,reverse in ((low,False),(high,True)):
            # Fan of quads across the six-sided, convex board.
            for ids in ((0,1,2,3),(0,3,4,5)):
                ids=ids[::-1] if reverse else ids
                verts=[(profile[i][0],y,profile[i][1]) for i in ids]
                uv=[(95+(1-x/root)*171,4+(1-z/h)*(H-8)) for x,_,z in verts]
                g.quad(verts,uv)
    # A curved binding wraps from board to board. Independent top and bottom
    # caps close the arch; thin paperback spines remain nearly square.
    cut=np.linspace(0,1,13)
    for a,b in zip(cut[:-1],cut[1:]):
        x1=root+camber*np.sin(np.pi*a); x2=root+camber*np.sin(np.pi*b)
        y1,y2=a*w,b*w
        g.quad([(x1,y1,0),(x2,y2,0),(x2,y2,h),(x1,y1,h)],
               [(87-83*a,H-4),(87-83*b,H-4),(87-83*b,4),(87-83*a,4)])
        for z,reverse in ((h,False),(0,True)):
            v=[(root-.0006,y1,z),(x1,y1,z),(x2,y2,z),(root-.0006,y2,z)]
            g.quad(v[::-1] if reverse else v,plain)
    # Sections across the fore-edge show the shallow concavity of a bound
    # block and a slight step between sewn gatherings. Edge UVs run across leaves.
    z0,z1=lip,h-lip
    for a,b in zip(cut[:-1],cut[1:]):
        y1=board+(w-2*board)*a; y2=board+(w-2*board)*b
        x1=lip+.0035*np.sin(np.pi*a); x2=lip+.0035*np.sin(np.pi*b)
        yuv1,yuv2=5+a*(H-10),5+b*(H-10)
        for z,reverse in ((z1,False),(z0,True)):
            v=[(x1,y1,z),(root,y1,z),(root,y2,z),(x2,y2,z)]
            uv=[(279,yuv1),(315,yuv1),(315,yuv2),(279,yuv2)]
            g.quad(v[::-1] if reverse else v,uv[::-1] if reverse else uv)
        g.quad([(x1,y1,z0),(x1,y1,z1),(x2,y2,z1),(x2,y2,z0)],
               [(279,yuv1),(315,yuv1),(315,yuv2),(279,yuv2)])
    return g


def build(source, target):
    data=source.read_bytes()
    n=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+n]); binary=bytearray(data[28+n:])
    meshes={m['name']:m for m in doc['meshes']}
    if any(m['name']=='Library bindings: cloth' for m in doc['materials']):
        raise ValueError('Supply the original room GLB as the input.')
    def view(raw,target_type=None):
        binary.extend(bytes(-len(binary)%4))
        info=dict(buffer=0,byteOffset=len(binary),byteLength=len(raw))
        if target_type: info['target']=target_type
        doc['bufferViews'].append(info); binary.extend(raw)
        return len(doc['bufferViews'])-1
    def attr(arr,kind,index=False):
        arr=np.asarray(arr,dtype='<u2' if index else '<f4')
        info=dict(type=kind,componentType=5123 if index else 5126,count=len(arr),
                  bufferView=view(arr.tobytes(),34963 if index else 34962))
        if kind=='VEC3': info.update(min=arr.min(axis=0).tolist(),max=arr.max(axis=0).tolist())
        doc['accessors'].append(info)
        return len(doc['accessors'])-1
    read=lambda name: json.loads((SOURCE/name).read_text(encoding='utf8'))
    catalog={b['group']:b for b in read('book-catalogue.json')}
    rows=read('BOOK_SUPPORT_PARAMETERS.json')
    atlas=Image.new('RGB',(W*COLS,H*9))
    tex_id=len(doc['textures']); materials={}
    for code,(family,_,_,_,roughness) in FORMATS.items():
        materials[code]=len(doc['materials'])
        doc['materials'].append(dict(name='Library bindings: '+family,pbrMetallicRoughness=dict(
            baseColorTexture={'index':tex_id},metallicFactor=0,roughnessFactor=roughness)))
    cell=0
    for row,pattern in zip(rows,ROWS,strict=True):
        books=row['books']; assert len(books)==len(pattern)
        rng=np.random.default_rng(819+cell)
        widths=[]; heights=[]; depths=[]
        locked=2 if row['lean'] else 0
        for i,(name,code) in enumerate(zip(books,pattern)):
            old=catalog[name]; _,w,h,d,_=FORMATS[code]
            variation=.012 if code in 'rst' or (code=='l' and pattern.count('l')>=3) else .13
            widths.append(old['width_m'] if i<locked else w*rng.uniform(1-variation,1+variation))
            # Keep the leaner's existing point of contact and its taller neighbour.
            heights.append(old['height_m'] if i<locked else min(max(catalog[b]['height_m'] for b in books),h*rng.uniform(1-variation,1+variation)))
            depths.append(min(old['depth_m'],d*rng.uniform(.97,1.03)))
        scale=sum(catalog[b]['width_m'] for b in books[locked:])/sum(widths[locked:])
        widths[locked:]=[w*scale for w in widths[locked:]]
        right=row['right_m']
        for i in reversed(range(len(books))):
            name=books[i]; code=pattern[i]; g=book_shape(cell,code,widths[i],heights[i],depths[i])
            pos=np.array(g.pos); normals=np.array(g.norm)
            ang=np.deg2rad(-catalog[name]['lean_toward_positive_y_degrees'])
            rot=np.array([[1,0,0],[0,np.cos(ang),-np.sin(ang)],[0,np.sin(ang),np.cos(ang)]])
            pos=pos@rot.T
            old=meshes[name]['primitives']
            front=max(doc['accessors'][p['attributes']['POSITION']]['max'][0] for p in old)
            setback=rng.uniform(.002,.017) if code not in 'rst' else .006
            pos+=np.array([front-setback-pos[:,0].max(),right-pos[:,1].max(),row['z']-pos[:,2].min()])
            right=pos[:,1].min()
            run=0
            while i>run and pattern[i-run-1]==code: run+=1
            tile=cover_tile(code,catalog[name]['title'],cell,run,rng)
            atlas.paste(tile,(cell%COLS*W,cell//COLS*H))
            meshes[name]['primitives']=[dict(attributes=dict(POSITION=attr(pos,'VEC3'),NORMAL=attr(normals@rot.T,'VEC3'),
                TEXCOORD_0=attr(g.uv,'VEC2')),indices=attr(g.indices,'SCALAR',True),material=materials[code])]
            cell+=1
    assert cell==90
    jpg=io.BytesIO(); atlas.save(jpg,'JPEG',quality=92,subsampling=0,optimize=True)
    doc['textures'].append(dict(sampler=0,source=len(doc['images'])))
    doc['images'].append(dict(name='Library binding artwork and leaf edges',mimeType='image/jpeg',bufferView=view(jpg.getvalue())))
    binary.extend(bytes(-len(binary)%4)); doc['buffers'][0]['byteLength']=len(binary)
    header=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode()
    header+=b' '*(-len(header)%4)
    target.write_bytes(struct.pack('<4sIIII',b'glTF',2,28+len(header)+len(binary),len(header),0x4e4f534a)+
                       header+struct.pack('<II',len(binary),0x004e4942)+binary)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path); parser.add_argument('target',type=Path)
    args=parser.parse_args()
    build(args.source,args.target)
