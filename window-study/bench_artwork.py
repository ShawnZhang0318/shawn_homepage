"""Print layers for the electronics bench, in the same physical axes as its meshes."""
import io
import json
import math
import random
import struct
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size):
    return ImageFont.truetype("consola.ttf", size)


def paint(directory):
    # Keep markings anchored to the existing eight rotary encoders and four sockets.
    panel = Image.new("RGB", (1200, 860), "#b6bdba")
    d = ImageDraw.Draw(panel)
    def label(x, y, text, size, color="#343c3d"):
        d.text((x,y), text, fill=color, font=font(size))
    label(30,9,"DIGITAL STORAGE OSCILLOSCOPE",21)
    label(42,621,"INPUT CHANNELS",15)
    for x, name in [(125,"1"),(323,"2"),(522,"3"),(723,"4")]:
        label(x,705,"CH "+name,17)
    for y, label1, label2 in [(37,"TIME/DIV","POSITION"),(187,"VOLTS/DIV","POSITION"),
                              (383,"TRIGGER","LEVEL"),(542,"CURSOR","ADJUST")]:
        label(884,y,label1,14); label(1042,y,label2,14)
        d.line((871,y-5,1173,y-5),fill="#6f7979",width=2)
    label(972,774,"USB",13)
    panel.save(directory/"face.png")

    screen = Image.new("RGB",(768,502),"#12232b")
    d=ImageDraw.Draw(screen)
    d.rectangle((0,0,768,32), fill="#273a42")
    d.text((12,6),"AUTO    500 us/div",font=font(16),fill="#c2d1cf")
    d.text((567,6),"Trig'd    T +0.0 s",font=font(15),fill="#9fc6ac")
    for i in range(13):
        x=27+59*i
        d.line((x,41,x,451),fill="#33474d",width=1)
    for i in range(9):
        y=46+50*i
        d.line((20,y,746,y),fill="#33474d",width=1)
    for x in range(30,746,12):
        d.line((x,243,x,249),fill="#79918c")
    for i,col in enumerate(["#eaca74","#8ab889","#72c1cb","#a4a1cf"]):
        points=[]
        for x in range(22,746):
            t=(x-22)/720*math.tau*2.6
            wave=math.sin(t+.75*i)+.21*math.sin(3*t+i)
            y=(133 if i<2 else 342)+50*wave+17*(i%2)
            points.append((x,y))
        d.line(points,fill=col,width=3)
        d.text((17+i*187,470),f"{i+1}   1.00 V",font=font(17),fill=col)
    screen.save(directory/"scope.png")

    bins=Image.new("RGB",(384,384),"#d6d2c0")
    d=ImageDraw.Draw(bins)
    for i in range(12):
        col=i%3;row=i//3;x,y=col*128,row*96
        d.rectangle((x+5,y+8,x+123,y+89),fill="#d9d7c9",outline="#9a9c94",width=2)
        d.text((x+15,y+25),f"{chr(65+row)}{col+1:02}",font=font(38),fill="#393e3c")
    bins.save(directory/"bin-cards.png")

    # Keep the authored grid, scale and registration. Fine cuts run slightly
    # lighter on one edge where the top layer has been compressed.
    raw=(Path(__file__).parent/"model/room-river-facades.glb").read_bytes()
    size=struct.unpack_from("<I",raw,12)[0]
    doc=json.loads(raw[20:20+size])
    m=next(m for m in doc["materials"] if m["name"]=="matgrid")
    t=doc["textures"][m["pbrMetallicRoughness"]["baseColorTexture"]["index"]]
    v=doc["bufferViews"][doc["images"][t["source"]]["bufferView"]]
    start=28+size+v.get("byteOffset",0)
    mat=Image.open(io.BytesIO(raw[start:start+v["byteLength"]])).convert("RGB")
    overlay=Image.new("RGBA",mat.size);d=ImageDraw.Draw(overlay)
    rng=random.Random(138);w,h=mat.size
    for i in range(84):
        x=rng.uniform(.18,.83)*w;y=rng.uniform(.2,.78)*h
        a=rng.choice([.14,-.26,1.03])+rng.gauss(0,.16)
        length=rng.uniform(.012,.2)*w
        dx,dy=math.cos(a)*length,math.sin(a)*length
        d.line((x,y,x+dx,y+dy),fill=(0,15,12,rng.randrange(22,59)),width=1)
        d.line((x,y+1,x+dx,y+dy+1),fill=(172,186,156,rng.randrange(15,34)),width=1)
    mat.paste(overlay,mask=overlay.getchannel("A"))
    mat.save(directory/"mat.jpg",quality=94)


if __name__=="__main__":
    paint(Path(sys.argv[1]))
