import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function placeLaptop(room, view) {
  // The user's side of the keyboard faces +Y in the source room. Turn that
  // side toward the desktop seat at the smaller X coordinate.
  const pivot = new THREE.Vector3(2.93, .335, .740);
  const turn = new THREE.Matrix4().makeTranslation(...pivot.toArray())
    .multiply(new THREE.Matrix4().makeRotationZ(THREE.MathUtils.degToRad(47)))
    .multiply(new THREE.Matrix4().makeTranslation(0, .22, 0))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  room.getObjectByName('E06').applyMatrix4(turn);
  const rotated = p => new THREE.Vector3(...p).applyMatrix4(turn).toArray();
  view.eye = rotated(view.eye);
  view.target = rotated([2.93, .169, .908]);
  view.clickPoint = view.target;
}

export async function installGamingLaptop(room) {
  const laptop=room.getObjectByName('E06');
  const {scene}=await new GLTFLoader().loadAsync('./model/gaming-laptop.glb?v=tapered-deck');
  // Keep the exact interactive glass and its UV/camera contract. The authored
  // chassis inherits the existing placement matrix through the E06 parent.
  for(const child of [...laptop.children]) {
    if(child.material?.name !== 'E06 / working LCD') laptop.remove(child);
  }
  laptop.add(scene);
}

export async function installSeatTextiles(room) {
  const { scene: textiles } = await new GLTFLoader().loadAsync('./model/seat-textiles.glb');
  const materials = new Map();
  const names = ['S01-PILLOW-LEFT', 'S01-PILLOW-RIGHT', 'S01-THROW', 'S01-LUMBAR'];
  for (const name of names) {
    room.getObjectByName(name).traverse(object => {
      if (!object.isMesh || materials.has(object.material.name)) return;
      const material = object.material.clone();
      // The old atlas maps the previous topology. The refined covers carry
      // their own contact darkening in vertex colours along the stitched edges.
      material.aoMap = null;
      material.vertexColors = true;
      materials.set(material.name, material);
    });
  }
  textiles.traverse(object => {
    if (object.isMesh) object.material = materials.get(object.userData.cover);
  });
  const frame = room.getObjectByName('S01-THROW').parent;
  for (const name of names) frame.remove(room.getObjectByName(name));
  frame.add(textiles);
}
