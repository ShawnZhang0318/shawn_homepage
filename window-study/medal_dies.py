"""Seven unlettered relief dies. Height, roughness and recess colour share one field."""
import cv2
import numpy as np
from PIL import Image, ImageDraw


def die_field(index):
    size=384; center=size/2
    im=Image.new('L',(size,size),0);d=ImageDraw.Draw(im)
    def xy(x,y):
        return (center+x,center-y)
    def line(pts,w=4,v=175):
        d.line([xy(*p) for p in pts],fill=v,width=w,joint='curve')
    def ellipse(x,y,rx,ry,level):
        d.ellipse([xy(x-rx,y+ry),xy(x+rx,y-ry)],fill=level)
    def poly(points,level):
        d.polygon([xy(*p) for p in points],fill=level)
    # Stems, individual lanceolate leaves and their veins remain legible
    # under grazing light without baking a bright or dark outline into the die.
    for sign in (-1,1):
        angles=np.linspace(-1.44,.79,90)
        line([(sign*112*np.cos(a),121*np.sin(a)) for a in angles],4,100)
        for j,a in enumerate(np.linspace(-1.32,.70,11)):
            x=sign*112*np.cos(a);y=121*np.sin(a)
            for inward in (-1,1):
                lean=a+np.pi/2+inward*.69
                axis=np.array([sign*np.cos(lean),np.sin(lean)])*(22+4*np.cos(a))
                normal=np.array([-axis[1],axis[0]])*.21
                start=np.array([x,y]);end=start+axis
                shape=[start+axis*t+normal*np.sin(np.pi*t) for t in np.linspace(0,1,10)]
                shape += [start+axis*t-normal*np.sin(np.pi*t) for t in np.linspace(1,0,10)]
                poly(shape,118+j%3*10);line([start+.2*axis,start+.82*axis],2,176)
    # Each edition was struck from a different central die.
    if index==0:  # panelled football
        ellipse(0,6,56,56,108)
        for a in np.arange(5)*2*np.pi/5+.31:
            line([(22*np.cos(a),6+22*np.sin(a)),(43*np.cos(a),6+43*np.sin(a)),
                  (55*np.cos(a+.19),6+55*np.sin(a+.19))],4,47)
        poly([(24*np.cos(a),6+24*np.sin(a)) for a in np.arange(5)*2*np.pi/5+.31],174)
    elif index==1:  # swept flame and tapered torch
        poly([(-23,6),(22,6),(8,-62),(-5,-70)],142)
        line([(-27,10),(25,10)],7,219)
        poly([(-19,15),(-32,40),(-17,67),(-15,43),(8,89),(8,60),(26,73),(19,45),(31,53),(21,25),(5,16)],189)
    elif index==2:  # faceted five point star
        pts=[((61 if i%2==0 else 26)*np.cos(i*np.pi/5+np.pi/2),
              6+(61 if i%2==0 else 26)*np.sin(i*np.pi/5+np.pi/2)) for i in range(10)]
        for i in range(10):poly([(0,6),pts[i],pts[(i+1)%10]],200 if i%2 else 121)
    elif index==3:  # running lanes around a banking bend
        for i in range(4):
            a=np.linspace(-.8,2.48,30)
            pts=[((34+i*10)*np.cos(t),8+(31+i*10)*np.sin(t)) for t in a]
            line([(-41+i*7,-50),*pts],4,154+i*12)
    elif index==4:  # mountain ridgeline
        poly([(-69,-31),(-28,32),(-14,17),(12,64),(69,-31)],147)
        poly([(12,64),(36,-24),(18,-5),(6,-22),(-4,1)],209)
        line([(-56,-40),(53,-40)],4,138)
    elif index==5:  # three ripples beneath a rising sun
        ellipse(0,26,24,24,190)
        for a in np.linspace(.15,np.pi-.15,9):
            line([(34*np.cos(a),26+34*np.sin(a)),(48*np.cos(a),26+48*np.sin(a))],3,150)
        for y in (-11,-28,-45):
            line([(x,y+7*np.sin(x*.052)) for x in np.linspace(-59,59,65)],5,165)
    else:  # split feathers on an ascending wing
        for i in range(6):
            poly([(-45+i*4,-55+i*8),(-30+i*6,-7+i*6),(52-i*6,62+i*3),
                  (39-i*7,27+i*6),(-11+i*2,-15+i*4)],104+18*i)
    y,x=np.mgrid[:size,:size];r=np.hypot(x-center,y-center)
    relief=cv2.GaussianBlur(np.asarray(im,dtype=np.float32),(0,0),2.1)/255*1.25
    a=np.arctan2(y-center,x-center)
    relief+=.19*np.exp(-((r-151)/4.8)**2)*(.55+.45*np.cos(66*a+index))
    relief+=.42*np.exp(-((r-159)/2.4)**2)+.30*np.exp(-((r-127)/2.1)**2)
    return relief


def struck_medal(index,center):
    radius=[44.7,45.2,44.,45.4,44.6,45.,44.3][index]
    thickness=[3.7,4.0,3.6,4.2,3.65,4.1,3.8][index]
    field=die_field(index)
    a=np.arange(192)*2*np.pi/192
    c,s=np.cos(a),np.sin(a)
    rows=[];shade=[]
    # From the face centre out to the radiused rim and around to the reverse.
    def ring(r,x,factor):
        rows.append(np.array([np.broadcast_to(x,c.shape),r*c,r*s]).T)
        shade.append(np.broadcast_to(factor,c.shape))
    for r in np.linspace(.02,radius*.915,70):
        ix=np.clip(np.rint(192+181*r/radius*c).astype(int),0,383)
        iy=np.clip(np.rint(192-181*r/radius*s).astype(int),0,383)
        h=field[iy,ix]
        ring(r,thickness*.5+h,.76+.23*np.clip(h,0,1))
    for r,x,v in [(radius*.93,thickness*.5+.65,.9),(radius*.957,thickness*.5+1.15,1.),
                  (radius*.979,thickness*.5+.75,.94),(radius,thickness*.5-.3,.90),
                  (radius+.15*np.cos(74*a),-.58*thickness,.79),(radius-.65,-thickness*.7,.85),
                  (.02,-thickness*.7,.80)]:
        ring(r,x,v)
    p=np.array(rows);side=np.roll(p,-1,axis=1)-np.roll(p,1,axis=1)
    normals=np.cross(np.gradient(p,axis=0),side)
    normals/=np.linalg.norm(normals,axis=2,keepdims=True).clip(1e-12)
    r,cnt=p.shape[:2];rr,cc=np.mgrid[:r-1,:cnt]
    aa=rr*cnt+cc;bb=rr*cnt+(cc+1)%cnt
    indices=np.stack([aa,aa+cnt,bb+cnt,aa,bb+cnt,bb],axis=-1).ravel()
    phi=np.deg2rad([-5,8,-3,5,-7,4,9][index])
    rot=np.array([[np.cos(phi),-np.sin(phi),0],[np.sin(phi),np.cos(phi),0],[0,0,1]])
    coords=p.reshape(-1,3)
    uv=.5+coords[:,1:3]/(2.2*radius)
    return center+.001*coords@rot.T,normals.reshape(-1,3)@rot.T,uv,np.repeat(np.ravel(shade)[:,None],3,axis=1),indices
