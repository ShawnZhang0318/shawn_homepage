"""Six shelf trophies, dimensioned in millimetres about their existing seats."""
from collections import defaultdict

import numpy as np
from scipy.interpolate import CubicSpline, PchipInterpolator


class Cup:
    def __init__(self):
        self.parts=defaultdict(lambda: [[],[],[]])

    def surface(self,key,points,wrap):
        # Rings are wound counterclockwise and run from the foot towards the
        # mouth, then back down the inner wall. Average adjacent face normals.
        p=np.asarray(points)
        up=np.gradient(p,axis=0)
        across=np.roll(p,-1,axis=1)-np.roll(p,1,axis=1)
        normals=np.cross(across,up)
        normals/=np.maximum(np.linalg.norm(normals,axis=2,keepdims=True),1e-12)
        pos,nor,idx=self.parts[key]; start=len(pos); rows,cols=p.shape[:2]
        pos.extend(p.reshape(-1,3));nor.extend(normals.reshape(-1,3))
        for j in range(rows-1):
            for i in range(cols if wrap else cols-1):
                a=start+j*cols+i; b=start+j*cols+(i+1)%cols
                idx.extend((a,b,b+cols,a,b+cols,a+cols))

    def lathe(self,key,profile,flutes=(0,0)):
        # Profile entries are (z, radius, optional flute amplitude).
        a=np.arange(96)*2*np.pi/96
        rings=[]
        for entry in profile:
            z,r=entry[:2]; amp=entry[2] if len(entry)>2 else 0
            # Pressed lobes fade into the lip; the shallow die draw twists as
            # it rises, leaving different reflection widths on the shoulders.
            radius=r+amp*(.78*np.cos(flutes[0]*a+.009*z)+.22*np.cos(2*flutes[0]*a+.018*z))
            rings.append(np.column_stack([radius*np.cos(a),radius*np.sin(a),np.full_like(a,z)]))
        self.surface(key,rings,True)

    def flat(self,key,vertices):
        p=np.asarray(vertices); normal=np.cross(p[1]-p[0],p[2]-p[0]);normal/=np.linalg.norm(normal)
        pos,nor,idx=self.parts[key]; s=len(pos);pos.extend(p);nor.extend([normal]*len(p))
        for i in range(1,len(p)-1):idx.extend((s,s+i,s+i+1))

    def plinth(self,key,width,h,cut):
        # Hand-eased corners, low projecting shoe, taper and polished top edge.
        profile=[(0,width-3),(1.6,width),(4.0,width),(5.4,width-2.5),
                 (6.0,width-4.5),(h-3,width-10),(h-1.1,width-10),(h,width-12)]
        rows=[]
        for z,w in profile:
            r=w/2;k=r-cut
            rows.append(np.array([[a,b,z] for a,b in [(r,k),(k,r),(-k,r),(-r,k),(-r,-k),(-k,-r),(k,-r),(r,-k)]]))
        for low,high in zip(rows,rows[1:]):
            for i in range(8):
                j=(i+1)%8;self.flat(key,[low[i],low[j],high[j],high[i]])
        self.flat(key,rows[0][::-1]);self.flat(key,rows[-1])

def turning(profile,samples):
    z,r=np.array(profile).T;f=PchipInterpolator(z,r)
    return [(v,float(f(v))) for v in np.linspace(z[0],z[-1],samples)]


def futsal_cup():
    cup=Cup()
    gold='gilt'
    cup.plinth('ebony',115,63,4)
    cup.lathe(gold,turning([(62,44),(65,46),(70,44),(73,40),(83,39),(92,36),
                           (97,38),(101,32),(104,34),(108,26),(114,24),(127,19),
                           (135,16),(143,22),(152,23),(159,15),(162,11)],80))
    outline=turning([(160,11),(175,23),(199,34),(232,44),(267,50),(297,53),(312,54)],64)
    profile=[(z,r,3.1*np.sin(np.pi*(z-160)/152)**.8) for z,r in outline]
    cup.lathe(gold,[(160,.02,0)]+profile+[(312.9,53.4,0),(312,52.7,0)]+
              [(z+.7,r-1.4,a*.90) for z,r,a in profile[-2:0:-1]]+[(161.1,.02,0)],(12,3))
    for z in (307.8,311,314,317):
        cup.lathe(gold,[(z-.9,53.5),(z-.4,54.6),(z+.35,54.9),(z+.85,53.5)])
    cup.lathe(gold,turning([(312,53),(318,52),(321,42),(324,29),(329,17),(332,9),
                           (336,5),(339,7),(341,5),(343,4),(347,8),(354,8),(359,.05)],64))

    def scroll(path,width,depth):
        path=np.array(path); knots=np.r_[0,np.cumsum(np.linalg.norm(np.diff(path,axis=0),axis=1))]
        spline=CubicSpline(knots,path,axis=0);rings=[]
        for t in np.linspace(0,knots[-1],48):
            c=spline(t); tangent=spline(t,1);tangent/=np.linalg.norm(tangent)
            b=np.cross(tangent,[1.,0,0]); b/=np.linalg.norm(b); a=np.cross(b,tangent)
            rings.append([c+a*depth*np.cos(q)+b*width*np.sin(q) for q in np.arange(12)*np.pi/6])
        cup.surface(gold,rings,True)
    for side in (-1,1):
        scroll([[0,side*y,z] for y,z in [(50,291),(58,312),(70,316),(77,298),(75,268),
               (64,243),(52,229),(40,218)]],2.8,3.2)
        scroll([[0,side*y,z] for y,z in [(62,243),(68,262),(65,276),(58,279),(55,269),(59,265)]],2.1,2.4)
        # Each tail turns in space; the lighter reverse becomes visible at the twists.
        for k,color in enumerate(('ribbon blue','ribbon ivory','ribbon red')):
            verts=[]
            for t in np.linspace(0,1,39):
                phase=k*1.65+side*.75
                cy=side*(52+(22+2*k)*(1-np.exp(-5*t))+13*np.sin(4.1*t+phase)*t)
                cx=(13*np.sin(5*t+phase)+2*k)*t
                z=297-(142+13*((k+side)%3))*t
                theta=.28+1.25*np.sin(4.7*t+phase)
                edge=np.array([np.sin(theta),side*np.cos(theta),.15])*2.9
                c=np.array([cx,cy,z])
                verts.append([c-edge,c+edge])
            for lower,higher in zip(verts,verts[1:]):
                cup.flat(color,[lower[0],lower[1],higher[1],higher[0]])
    # Low gold fleurons around the scalloped crown, with open space in each loop.
    for angle in np.arange(10)*np.pi/5:
        radial=np.array([np.cos(angle),np.sin(angle),0]);tan=np.array([-np.sin(angle),np.cos(angle),0])
        ring=[]
        for a in np.linspace(0,2*np.pi,23):
            ring.append(radial*(49.6+3*np.sin(a/2)**2)+tan*(4.6*np.sin(a))+[0,0,317+9.6*np.sin(a/2)**2])
        # Tubular ornament in the local circumferential / vertical plane.
        bands=[]
        for i,c in enumerate(ring):
            v=ring[min(i+1,len(ring)-1)]-ring[max(i-1,0)];v/=np.linalg.norm(v)
            b=np.cross(v,radial); b/=np.linalg.norm(b)
            bands.append([c+1.05*(radial*np.cos(q)+b*np.sin(q)) for q in np.arange(8)*np.pi/4])
        cup.surface(gold,bands,True)
    return cup.parts
