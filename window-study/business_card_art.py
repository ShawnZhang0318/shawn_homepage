"""Typeset all contact information on one front face; no reverse-side content."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve().parent
DEST=HERE/'model/textures'
W,H=2160,1320
P=24  # pixels per millimetre, for a 90 x 55 mm card
rng=np.random.default_rng(318)
noise=rng.normal(0,.7,(H,W,1))
pixels=np.clip(np.array([222,215,199])[None,None,:]+noise,0,255).astype('uint8')
image=Image.fromarray(pixels);draw=ImageDraw.Draw(image)
def font(size,bold=False):
    return ImageFont.truetype(str(HERE/'fonts/Inter.ttf'),round(size*P))
def text(value,x,y,size,color=(44,42,37)):
    draw.text((x*P,y*P),value,font=font(size),fill=color,stroke_width=0)
text('Yitong Zhang',8,8.5,6.7)
draw.text((8*P,19.5*P),'张艺桐',font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',round(3.1*P)),fill=(76,70,59))
text('AI · ROBOTICS · INTERACTIVE SYSTEMS',8,27,1.95,(95,86,69))
draw.line((8*P,35.8*P,82*P,35.8*P),fill=(169,154,127),width=2)
text('EMAIL',8,39,1.55,(113,99,78))
text('shawn_0318@163.com',8,43,3.0)
image.save(DEST/'business-card-front.png')
grain=rng.normal(0,1,(512,512))
normal=np.dstack((128+np.gradient(grain,axis=1)*1.5,128+np.gradient(grain,axis=0)*1.5,np.full_like(grain,255)))
Image.fromarray(np.clip(normal,0,255).astype('uint8')).save(DEST/'business-card-grain.png')
print('Front-only name card artwork saved.')
