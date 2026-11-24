import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Group } from 'three';

export async function installBenchFinish(room) {
  const {scene: detail} = await new GLTFLoader().loadAsync('./model/bench-finish.glb?v=bench-restored');
  const frame = room.getObjectByName('R02').parent;
  const mounts = new Map();
  const parts = detail.children.slice();
  for (const part of parts) {
    const id = part.userData.benchMount;
    if (id === 'R01-GRIPPER') continue;
    if (!mounts.has(id)) {
      let target = room.getObjectByName(id);
      if (target.isMesh && id !== 'R04') {
        const anchor = new Group();
        anchor.name = target.name;
        anchor.position.copy(target.position);
        anchor.quaternion.copy(target.quaternion);
        anchor.scale.copy(target.scale);
        target.parent.add(anchor);
        target.removeFromParent();
        target = anchor;
      } else if (id !== 'R04') {
        for (const old of target.children.slice()) if (old.isMesh) old.removeFromParent();
      }
      mounts.set(id, target);
    }
    const target = mounts.get(id);
    part.position.sub(target.position);
    target.add(part);
  }
}
