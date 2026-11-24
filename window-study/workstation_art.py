"""Local LCD artwork and repeatable material samples for desk hardware."""
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFont


@lru_cache(None)
def font(size):
    return ImageFont.truetype('C:/Windows/Fonts/consola.ttf', size)


def display_image(laptop):
    width, height = (1200, 818) if laptop else (1536, 742)
    image = Image.new('RGB', (width, height), '#20242a')
    d = ImageDraw.Draw(image)
    def bar(box, color):
        d.rectangle(box, fill=color)
    def label(x, y, text, color='#c6ccd3', size=18):
        d.text((x,y), text, fill=color, font=font(size))
    bar((0,0,width,40), '#333941')
    label(18,10,'Signal analysis   /   response.ipynb' if laptop else 'Terminal    File    Edit    View    Search',size=17)
    label(width-85,9,'─  □  ×',size=16)
    if laptop:
        label(54,68,'Frequency response', '#e3e5e7',32)
        label(55,121,'In [4]:   magnitude = 20 * np.log10(np.abs(response))','#94b7c2')
        label(55,153,'          ax.semilogx(frequency, magnitude)','#94b7c2')
        bar((50,210,1150,745),'#d5d8d7')
        label(108,238,'Transfer function magnitude', '#343d44',23)
        x0,x1,y0,y1 = 151,1083,307,669
        for i in range(5):
            y = y0+(y1-y0)*i/4
            d.line((x0,y,x1,y),fill='#adb5b7')
            label(101,y-12,str(-10*i),'#424e54',17)
        for i in range(4):
            x=x0+(x1-x0)*i/3
            d.line((x,y0,x,y1),fill='#adb5b7')
            label(x-12,y1+9,('10','100','1k','10k')[i],'#424e54',17)
        label(521,703,'Frequency (Hz)','#424e54',18)
        t=np.linspace(0,1,500)
        db=-10*np.log10(1+(10**(3*t)/70)**2)
        for curve,color in [(db,'#317586'),(db-.65+.78*np.sin(43*t)*np.exp(-2*t),'#a86e46')]:
            d.line(list(zip(x0+t*(x1-x0),y0-curve/40*(y1-y0))),fill=color,width=3)
        label(54,769,'Python 3     •     Kernel idle','#9fa8ad',15)
    else:
        bar((0,43,295,height-27),'#292d34')
        label(22,70,'WORKSPACE','#a9b2bb',16)
        for i,name in enumerate(['▾ studio','  ▾ src','      camera.py','      response.py','      scene.py','  ▸ assets','  ▸ renders','    pyproject.toml']):
            label(23,117+31*i,name,'#ccd0d4',19)
        label(322,61,'response.py','#dae0e4',19)
        lines=['import numpy as np','','def magnitude(frequency, cutoff):','    ratio = frequency / cutoff','    response = 1 / (1 + 1j * ratio)','    return 20 * np.log10(np.abs(response))','','frequency = np.geomspace(10, 10_000, 400)','level = magnitude(frequency, cutoff=700)','','for f, value in zip(frequency, level):','    print(f"{f:8.1f} Hz    {value:6.2f} dB")']
        for i,line in enumerate(lines):
            label(335,116+28*i,f'{i+1:2}', '#65717d')
            label(395,116+28*i,line,'#aabfce' if i in (0,2,5,10) else '#cdcabd',22)
        bar((296,492,width,494),'#424952')
        label(324,514,'TERMINAL     OUTPUT','#c8d0d5',16)
        for i,line in enumerate(['~/studio $ python -i src/response.py','   9828.4 Hz    -22.97 dB','  10000.0 Hz    -23.12 dB','>>> ']):
            label(325,555+30*i,line,'#a4beb1' if i in (0,3) else '#b9bec4',19)
        bar((0,height-26,width,height),'#374a54')
        label(18,height-23,'main      src/response.py',size=14)
        label(width-249,height-23,'Python 3     UTF-8',size=14)
    return image


def perforated_steel():
    y,x=np.mgrid[:128,:128]
    row=y//16
    radius=np.hypot((x+8*(row%2))%16-8,y%16-8)
    alpha=255*np.clip(radius-5.7,0,1)
    rim=10*np.exp(-((radius-6.7)/1.1)**2)
    return Image.fromarray(np.stack((64+rim,67+rim,68+rim,alpha),axis=-1).astype('uint8'))
