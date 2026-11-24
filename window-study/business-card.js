import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function installBusinessCard(room) {
  const original=room.getObjectByName('P03');
  const {scene}=await new GLTFLoader().loadAsync('./model/business-card.glb?v=front-only');
  original.clear();original.add(scene);
  let motion,homeMatrix,homeFrame,homeWorld,parentInverse,pose;
  let automatic=true;
  const center=()=>new THREE.Box3().setFromObject(original).getCenter(new THREE.Vector3());
  function apply(position,quaternion) {
    const frame=new THREE.Matrix4().compose(position,quaternion,new THREE.Vector3(1,1,1));
    original.matrix.copy(parentInverse).multiply(frame).multiply(homeFrame.clone().invert()).multiply(homeWorld);
    original.matrixWorldNeedsUpdate=true;original.updateMatrixWorld(true);
    pose={position:position.clone(),quaternion:quaternion.clone()};
  }
  function restore() {
    if(homeMatrix) {
      original.matrix.copy(homeMatrix);original.matrix.decompose(original.position,original.quaternion,original.scale);
      original.matrixAutoUpdate=automatic;original.updateMatrixWorld(true);
    }
    motion=null;
  }
  return {
    center,
    contains:object=>!!object&&!!original.getObjectById(object.id),
    raise(camera,reduced,now) {
      original.updateWorldMatrix(true,true);
      homeMatrix=original.matrix.clone();homeWorld=original.matrixWorld.clone();
      parentInverse=original.parent.matrixWorld.clone().invert();automatic=original.matrixAutoUpdate;
      const right=new THREE.Vector3(1,0,0).transformDirection(homeWorld);
      const up=new THREE.Vector3(0,-1,0).transformDirection(homeWorld);
      const normal=new THREE.Vector3().crossVectors(right,up).normalize();
      const quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,normal));
      const position=center();homeFrame=new THREE.Matrix4().compose(position,quaternion,new THREE.Vector3(1,1,1));
      const desiredFraction=Math.min(560,innerWidth-48)/innerWidth;
      const distance=Math.max(.18,.09/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect*desiredFraction));
      const target=camera.position.clone().addScaledVector(camera.getWorldDirection(new THREE.Vector3()),distance);
      target.add(new THREE.Vector3(0,-.012,0).applyQuaternion(camera.quaternion));
      original.matrixAutoUpdate=false;pose={position,quaternion};
      motion={from:pose,to:{position:target,quaternion:camera.quaternion.clone()},start:now,duration:reduced?0:650,target:'card'};
    },
    lower(reduced,now) {
      if(!homeFrame||!pose) return;
      const position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();homeFrame.decompose(position,quaternion,scale);
      motion={from:pose,to:{position,quaternion},start:now,duration:reduced?0:550,target:'rest'};
    },
    frame(now) {
      if(!motion) return null;
      const t=motion.duration?Math.min(1,(now-motion.start)/motion.duration):1;
      const ease=t*t*(3-2*t);
      apply(motion.from.position.clone().lerp(motion.to.position,ease),motion.from.quaternion.clone().slerp(motion.to.quaternion,ease));
      if(t<1) return null;
      const target=motion.target;motion=null;if(target==='rest') restore();return target;
    },
    restore,
    emailHit:hit=>hit?.object.material?.name==='Name card / front print'&&hit.uv?.y>.66&&hit.uv?.y<.95,
    point(camera,u=.5,v=.5) {
      original.updateWorldMatrix(true,true);
      const p=new THREE.Vector3(1.5202+.0896*u,.6073-.0546*v,.74058).applyMatrix4(original.matrixWorld).project(camera);
      return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
    },
  };
}
