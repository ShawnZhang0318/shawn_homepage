import * as THREE from 'three';

// Room coordinates are Z-up. Look across the left part of the opening,
// slightly above the horizon. The eastern towers are further to the right.
export const windowStation = {
  eye: [5.46, -.05, 1.70],
  target: [7.40, -9.86, 3.55],
};

// A single fixed scale about the original eye keeps every skyline vertex on
// its original sightline in the room view. It also preserves wall thicknesses,
// street gaps, roof shapes, and the level river surface in the miniature.
export function placeWaterfront(room, homeEye, exteriorScale = .018) {
  const water = room.getObjectByName('SH-HUANGPU');
  const modelRoot = water.parent;
  const exterior = modelRoot.children.filter(node => node.name.startsWith('SH-'));
  const bank = new THREE.Group();
  bank.name = 'Fixed waterfront';
  modelRoot.add(bank);
  bank.position.fromArray(homeEye).multiplyScalar(1 - exteriorScale);
  bank.scale.setScalar(exteriorScale);
  for (const node of exterior) bank.add(node);

  // The original water rectangle ran underneath the building at river level.
  // Trim its near edge beyond the bay before bringing the waterfront closer.
  // The original local positions still drive the reflection shader.
  const azimuth = THREE.MathUtils.degToRad(5.8);
  const inland = new THREE.Vector2(
    .6 * Math.cos(azimuth) + .8 * Math.sin(azimuth),
    -.8 * Math.cos(azimuth) + .6 * Math.sin(azimuth),
  );
  const origin = new THREE.Vector2(5.82, -.29);
  const homeDepth = (homeEye[0]-origin.x)*inland.x + (homeEye[1]-origin.y)*inland.y;
  const nearEdge = homeDepth + (.8-homeDepth)/exteriorScale;
  water.traverse(mesh => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.clone();
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i);
      const depth = (x-origin.x)*inland.x + (y-origin.y)*inland.y;
      if (depth >= nearEdge) continue;
      const shift = nearEdge - depth;
      positions.setXY(i, x + shift*inland.x, y + shift*inland.y);
    }
    positions.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    mesh.geometry = geometry;
  });
}
