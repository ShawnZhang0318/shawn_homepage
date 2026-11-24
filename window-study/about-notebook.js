import * as THREE from 'three';

// Move the closed book, opened insert and resting Work sheet together.
export const notebookShift = .085;

export const aboutCopy = [
  'Hi, I’m Yitong.',
  'I’m studying AI and Entrepreneurship at HKUST. I got into robotics through RoboMaster, where I started Navigator Robotics Lab and led the mechanical team. A lot of what I learned came from getting a robot ready for competition with people who knew things I didn’t.',
  'Since then, I’ve worked on embodied AI and helped build FundaNotes, an AI tool for studying. My favorite part is getting a prototype into someone’s hands and seeing what they actually do with it.',
];

export function installAboutNotebook(room, model) {
  const original = room.getObjectByName('DESK-NOTEBOOK');
  original.position.x += notebookShift;
  room.getObjectByName('P03').position.y += .10;
  const hinge = model.getObjectByName('AboutCoverHinge');
  const path = hinge.userData.foldPath;
  const segments = path.length / 2 - 1;
  const pivotX = (path[0] + path.at(-2)) / 2;
  const pivotZ = (path[1] + path.at(-1)) / 2;
  const offsetX = path[0] - pivotX;
  const offsetZ = path[1] - pivotZ;
  const spine = [];
  const pages = [];
  model.traverse(part => {
    if (part.morphTargetDictionary?.Spread !== undefined) pages.push(part);
    if (part.morphTargetDictionary?.Fold1 !== undefined) spine.push(part);
  });
  const written = model.getObjectByName('AboutWrittenLeaf');
  const ink = document.createElement('canvas');
  ink.width = 768;
  ink.height = 1116;
  const pen = ink.getContext('2d');
  // Write on the same Blender paper stock used across the open spread.
  pen.drawImage(written.material.map.image, 0, 0, ink.width, ink.height);
  pen.fillStyle = '#241b15';
  let y = 105;
  for (const [index, paragraph] of aboutCopy.entries()) {
    pen.font = index === 0 ? '700 68px Caveat' : '600 52px Caveat';
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (pen.measureText(next).width > 638 && line) {
        pen.fillText(line, 65, y);
        y += 58;
        line = word;
      } else line = next;
    }
    pen.fillText(line, 65, y);
    y += index === 0 ? 94 : 80;
  }
  const inkMap = new THREE.CanvasTexture(ink);
  inkMap.colorSpace = THREE.SRGBColorSpace;
  inkMap.flipY = false;
  inkMap.anisotropy = 8;
  written.material = written.material.clone();
  written.material.map = inkMap;
  model.position.set(1.277, .495, .740);
  original.add(model);
  for (const child of [...original.children]) if (child !== model) child.removeFromParent();
  model.traverse(object => {
    if (!object.isMesh) return;
    // Covers and page edges cast the notebook silhouette. A shadow map
    // cannot resolve the tiny clearance between neighbouring paper surfaces.
    object.castShadow = object !== written && object.name !== 'AboutBlankLeaf';
    object.receiveShadow = true;
  });
  return {
    contains: object => Boolean(object && original.getObjectById(object.id)),
    pose(progress) {
      for (const page of pages) {
        page.morphTargetInfluences[page.morphTargetDictionary.Spread] = progress;
      }
      const step = progress * segments;
      const i = Math.min(Math.floor(step), segments - 1);
      const mix = step - i;
      // Rotate the stack around the sewing axis, including between spine keys.
      const angle = Math.PI * progress;
      hinge.position.x = pivotX + Math.cos(angle)*offsetX - Math.sin(angle)*offsetZ;
      hinge.position.z = pivotZ + Math.sin(angle)*offsetX + Math.cos(angle)*offsetZ;
      hinge.rotation.y = -angle;
      for (const skin of spine) {
        skin.morphTargetInfluences.fill(0);
        if (i > 0) skin.morphTargetInfluences[i-1] = 1 - mix;
        skin.morphTargetInfluences[i] = mix;
      }
    },
  };
}
