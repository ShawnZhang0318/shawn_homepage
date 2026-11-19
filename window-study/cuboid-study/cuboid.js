import * as THREE from 'three';

export function addCuboid(scene, camera, room) {
  // One metre-based mesh, positioned once in the room's fixed reference frame.
  const planeCentre = new THREE.Vector3(5.93, -.28, 1.45);
  const along = new THREE.Vector3(.8, .6, 0);
  const outward = new THREE.Vector3(.6, -.8, 0);
  const location = planeCentre.addScaledVector(outward, 8).addScaledVector(along, -1.1);
  const geometry = new THREE.BoxGeometry(1.6, 1.4, 1.15);
  const materials = [0x537f90, 0x41616a, 0xefcf96, 0x796a4f, 0xb88247, 0xd19a60]
    .map(color => new THREE.MeshBasicMaterial({color, toneMapped:false}));
  const box = new THREE.Mesh(geometry, materials);
  box.position.set(-location.x, location.z, -location.y);
  box.rotation.y = .13;
  box.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({color:0x352b23, toneMapped:false})));
  scene.add(box);
  box.updateMatrixWorld(true);

  // One fixed skyline point, for comparing lateral travel against the marker.
  let towerTip;
  room.traverse(mesh => {
    if (!mesh.isMesh || !/Oriental.Pearl/.test(mesh.name)) return;
    const vertices = mesh.geometry.attributes.position;
    for (let i = 0; i < vertices.count; ++i) {
      const v = new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld);
      if (!towerTip || v.y > towerTip.y) towerTip = v;
    }
  });
  const project = point => {
    const p = point.clone().project(camera);
    return [(p.x + 1)*innerWidth/2, (1-p.y)*innerHeight/2];
  };
  const vertices = geometry.attributes.position;
  const corners = Array.from({length:vertices.count}, (_,i) =>
    new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(box.matrixWorld));
  return () => {
    const xy=corners.map(project), xs=xy.map(p=>p[0]), ys=xy.map(p=>p[1]);
    return {width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),
      centre:project(box.position),tower:project(towerTip),distance:camera.position.distanceTo(box.position),
      matrix:box.matrixWorld.toArray()};
  };
}
