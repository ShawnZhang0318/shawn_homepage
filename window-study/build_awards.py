"""Refine existing trophy and medal geometry in the shelf AV build."""
import numpy as np
import cv2
from PIL import Image
from pathlib import Path
from cup_forms import futsal_cup
from medal_dies import struck_medal


def finish_awards(doc,buf,attr,texture):
    meshes={m['name']:m for m in doc['meshes']}
    def material(name,color,rough,metal):
        doc['materials'].append(dict(name=name,pbrMetallicRoughness=dict(
            baseColorFactor=[*color,1],metallicFactor=metal,roughnessFactor=rough)))
        return len(doc['materials'])-1
    antique=material('Struck medal bronze',[.80,.54,.235],.30,.86)
    def read(index):
        a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
        return np.frombuffer(buf,dtype='<f4',offset=view['byteOffset']+a.get('byteOffset',0),
                             count=a['count']*3).reshape(-1,3).astype(float)
    def deform(p,fn):
        points=read(p['attributes']['POSITION']);normals=read(p['attributes']['NORMAL'])
        eps=1e-6
        jac=np.stack([(fn(points+axis*eps)-fn(points-axis*eps))/(2*eps) for axis in np.eye(3)],axis=2)
        norm=(np.linalg.inv(jac).transpose(0,2,1)@normals[:,:,None])[:,:,0]
        norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-12)
        p['attributes'].update(POSITION=attr(fn(points),'VEC3'),NORMAL=attr(norm,'VEC3'))
    finishes={
        'gilt':material('Cup / polished yellow gold',[.98,.74,.29],.17,.95),
        'ebony':material('Cup / black enamel',[.022,.024,.029],.23,.16),
    }
    textures=Path(__file__).resolve().parent/'model/textures'
    for key,rgb in [('ribbon blue',[.02,.10,.55]),('ribbon ivory',[.86,.83,.72]),('ribbon red',[.69,.022,.027])]:
        finishes[key]=material(key,rgb,.53,0)
        doc['materials'][finishes[key]]['doubleSided']=True
    rng=np.random.default_rng(618)
    y,x=np.mgrid[:256,:512]
    grain=rng.normal(0,2,(256,512))
    # Circumferential polishing leaves fine bands. Broader, uneven buffed
    # areas survive mipmapping in the cabinet view without drawn highlights.
    broad=cv2.resize(rng.uniform(-1,1,(12,16)).astype('float32'),(512,256),interpolation=cv2.INTER_CUBIC)
    # Only the high-frequency response of an unmarked area of the real cup
    # is stored. The reflected room still determines highlights and shadows.
    real_grain=np.asarray(Image.open(textures/'polished-metal-grain.png').resize((512,256)),dtype=float)
    polish=real_grain+21*broad+rng.normal(0,5,(256,1))
    packed=np.full((256,512,3),255,np.uint8)
    packed[:,:,1]=np.clip(polish,85,240).astype('uint8')
    polish_map=texture(Image.fromarray(packed),'Metal / polishing roughness')
    pbr=doc['materials'][finishes['gilt']]['pbrMetallicRoughness']
    pbr['roughnessFactor']*=1.42
    pbr['metallicRoughnessTexture']={'index':polish_map}

    nodes={n['name']:n for n in doc['nodes']}
    for name in ('Shelf upper','Shelf middle','Shelf lower'):
        extensions=nodes[name]['extensions']
        del extensions['KHR_lights_punctual']
        if not extensions:
            del nodes[name]['extensions']
    # All six cups share one mesh; the nodes only set their shelf positions.
    reference=nodes['AWARD-CUP-03']['mesh']
    assembly=doc['meshes'][reference]
    for name in ('A05','AWARD-CUP-02','AWARD-CUP-03','AWARD-CUP-04','AWARD-CUP-05','AWARD-PLAQUE'):
        node=nodes[name]; prior=doc['meshes'][node['mesh']]
        base=read(prior['primitives'][0]['attributes']['POSITION'])
        seat=(base.min(axis=0)+base.max(axis=0))/2
        seat[2]=base[:,2].min()
        node.update(mesh=reference,translation=seat.tolist())
    assembly['primitives']=[]
    for key,(pos,norm,indices) in futsal_cup().items():
        pos=np.asarray(pos);norm=np.asarray(norm)
        radius=np.maximum(np.linalg.norm(pos[:,:2],axis=1),.01)
        inward=np.clip(-np.sum(pos[:,:2]*norm[:,:2],axis=1)/radius,0,1)
        shade=1-.37*inward*np.clip((307-pos[:,2])/124,0,1)
        attributes=dict(POSITION=attr(pos*.001,'VEC3'),NORMAL=attr(norm,'VEC3'),
                        COLOR_0=attr(np.repeat(shade[:,None],3,axis=1),'VEC3'),
                        TEXCOORD_0=attr(np.c_[.5+np.arctan2(pos[:,1],pos[:,0])/(2*np.pi),pos[:,2]/320],'VEC2'))
        assembly['primitives'].append(dict(material=finishes[key],indices=attr(indices,'SCALAR'),attributes=attributes))
    medals=meshes['AWARD-MEDALS']
    centers=np.linspace(1.853,2.447,7)
    wy,wx=np.mgrid[:1024,:128]
    weave=220+12*np.cos(wx*1.62+2*np.sin(wy*1.47))+8*np.cos((wx+wy)*.66)
    fabric=texture(Image.fromarray(weave.astype('uint8')).convert('RGB'),'Medal ribbon / woven twill')
    for p in medals['primitives']:
        name=doc['materials'][p['material']]['name']
        if name=='brass':
            pos=read(p['attributes']['POSITION'])
            # Keep the rod, mountings and bails. Replace all seven older discs.
            acc=doc['accessors'][p['indices']];bv=doc['bufferViews'][acc['bufferView']]
            tris=np.frombuffer(buf,dtype={5123:'<u2',5125:'<u4'}[acc['componentType']],
                               offset=bv['byteOffset']+acc.get('byteOffset',0),count=acc['count']).reshape(-1,3).copy()
            q=pos[tris]
            mid=centers[np.argmin(abs(q[:,:,1].mean(axis=1)[:,None]-centers),axis=1)]
            legs=(q[:,:,2].min(axis=1)>1.923)&(np.max(abs(q[:,:,1]-mid[:,None]),axis=1)<.0165)
            keep=tris[(q[:,:,2].max(axis=1)>1.932)|legs]
            used,local=np.unique(keep,return_inverse=True)
            original_normals=read(p['attributes']['NORMAL'])
            p.update(indices=attr(local.ravel(),'SCALAR'),material=antique,
                     attributes=dict(POSITION=attr(pos[used],'VEC3'),NORMAL=attr(original_normals[used],'VEC3')))
        elif name in ('scarfred','fringewhite','blue'):
            def folds(points):
                x,y,z=points.T
                i=np.argmin(abs(y[:,None]-centers),axis=1)
                across=(y-centers[i])/.0115
                t=np.clip((z-1.939)/.206,0,1)
                weight=np.sin(np.pi*t)**2
                moved=points.copy()
                moved[:,0]+=.0027*weight*np.sin(across*2.3+t*4.5+i*.77)
                moved[:,1]+=.0014*weight*np.sin(t*6+i)
                return moved
            deform(p,folds)
            dye={'blue':[.035,.090,.17],'scarfred':[.39,.047,.043],'fringewhite':[.75,.68,.54]}[name]
            p['material']=material('Woven medal ribbon '+name,dye,.93,0)
            pos=read(p['attributes']['POSITION']); mid=centers[np.argmin(abs(pos[:,1,None]-centers),axis=1)]
            p['attributes']['TEXCOORD_0']=attr(np.c_[.5+(pos[:,1]-mid)/.029,(pos[:,2]-1.934)/.222],'VEC2')
            doc['materials'][p['material']]['pbrMetallicRoughness']['baseColorTexture']={'index':fabric}
    tones=[(.85,.63,.29),(.82,.56,.24),(.92,.72,.41),(.80,.60,.32),
           (.86,.66,.36),(.82,.58,.26),(.91,.70,.37)]
    for i,y in enumerate(centers):
        pos,norm,uv,shade,idx=struck_medal(i,np.array([.260,y,1.885]))
        minted=material('Medal / unlettered die '+str(i+1),tones[i],.34+i%3*.033,.91)
        doc['materials'][minted]['pbrMetallicRoughness']['metallicRoughnessTexture']={'index':polish_map}
        medals['primitives'].append(dict(material=minted,indices=attr(idx,'SCALAR'),attributes=dict(
            POSITION=attr(pos,'VEC3'),NORMAL=attr(norm,'VEC3'),TEXCOORD_0=attr(uv,'VEC2'),COLOR_0=attr(shade,'VEC3'))))
