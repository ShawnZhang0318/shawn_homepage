import * as THREE from 'three';

// The shelf above each row, the room opening and the glass doors interrupt
// the reflections on these metals. Capture each bay from inside the cabinet.
export function cabinetReflections(renderer, scene, room, toWorld, initialState=true) {
  const bays = [
    {z: 2.40, groups: ['A05','AWARD-CUP-02','AWARD-CUP-03']},
    {z: 1.91, groups: ['AWARD-MEDALS']},
    {z: 1.59, groups: ['AWARD-CUP-04','AWARD-CUP-05','AWARD-PLAQUE']},
  ];
  const targets = [];
  for (const bay of bays) {
    bay.materials = new Set();
    for (const name of bay.groups) {
      const group = room.getObjectByName(name);
      if (!group) continue;
      targets.push(group);
      group.traverse(mesh => {
        if (mesh.isMesh && mesh.material.metalness > .8) {
          // The medal die and its milled edge share an alloy. Keep different
          // shelves independent even if the GLB shares a stock material.
          mesh.material = mesh.material.clone();
          bay.materials.add(mesh.material);
        }
      });
    }
  }
  // One shared probe in front of the coplanar doors captures the opposite wall.
  // The clear glass blends this reflection into the visible books at grazing angles.
  const panes = [];
  for (let i = 1; i <= 4; i++) {
    room.getObjectByName('A02-DOOR'+i)?.traverse(mesh => {
      if (mesh.isMesh && mesh.material.name === 'glass') panes.push(mesh);
    });
  }
  if (panes.length) {
    const bounds = new THREE.Box3();
    const glass = panes[0].material.clone();
    glass.color.setRGB(1,1,1);
    glass.metalness = 1;
    glass.roughness = .08;
    glass.side = THREE.FrontSide;
    glass.depthWrite = false;
    glass.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float angle = 1.0 - abs(dot(normalize(vViewPosition), normal));
        diffuseColor.a = 0.037 + 0.65 * pow(angle, 5.0);
        #include <opaque_fragment>`);
    };
    for (const pane of panes) {
      bounds.expandByObject(pane);
      pane.material = glass;
    }
    const position = bounds.getCenter(new THREE.Vector3()).add(toWorld([.08,0,0]));
    bays.push({position, materials:new Set([glass]), intensity:1});
    targets.push(...panes);
  }
  const cache = new Map();
  function update(state) {
    let textures = cache.get(state);
    if (!textures) {
      const generator = new THREE.PMREMGenerator(renderer);
      const visibility = targets.map(o => o.visible);
      const shadowPending = renderer.shadowMap.needsUpdate;
      try {
        targets.forEach(o => { o.visible = false; });
        renderer.shadowMap.needsUpdate = false;
        textures=bays.map(bay => generator.fromScene(scene,0,.018,120,{
          position:bay.position ?? toWorld([.332,2.144,bay.z]), size:128,
        }));
      } finally {
        targets.forEach((o,i) => { o.visible = visibility[i]; });
        renderer.shadowMap.needsUpdate = shadowPending;
        generator.dispose();
      }
    }
    bays.forEach((bay,i) => {
      for (const mat of bay.materials) {
        mat.envMap = textures[i].texture;
        mat.envMapIntensity = bay.intensity ?? 1.35;
        mat.needsUpdate = true;
      }
    });
    // Keep the immediately preceding state for the return click. Detach all
    // materials from old textures before releasing an evicted set of probes.
    cache.delete(state);
    cache.set(state,textures);
    if (cache.size>2) {
      const oldest=cache.keys().next().value;
      for (const target of cache.get(oldest)) target.dispose();
      cache.delete(oldest);
    }
  }
  update(initialState);
  return update;
}
