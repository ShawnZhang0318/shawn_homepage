import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Group, MathUtils} from 'three';

export async function installDeskDetails(room) {
  const groups = ['C01', 'L01', 'R01', 'R01-BASE', 'R01-GRIPPER',
    'R01-LINK1', 'R01-LINK2', 'R01-LINK3', 'R01-J1', 'R01-J2', 'R01-J3', 'R01-J4'];
  const frame = room.getObjectByName('C01').parent;
  const {scene} = await new GLTFLoader().loadAsync('./model/desk-details.glb?v=connected-wrist');
  const chair = new Group();
  chair.name = 'C01';
  chair.position.set(2.8, 1.335, 0); // Seat gas-lift axis, in room coordinates.
  for (const part of scene.children.filter(part => part.name.startsWith('C01_'))) {
    part.position.sub(chair.position);
    chair.add(part);
  }
  chair.rotation.z = MathUtils.degToRad(-14);
  scene.add(chair);
  for (const name of groups) room.getObjectByName(name)?.removeFromParent();
  frame.add(scene);
}
