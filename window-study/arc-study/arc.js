import * as THREE from 'three';

// The anchor and bearing are expressed in the room model's Z-up coordinates.
// Only the mesh goes through the room's coordinate conversion, once at load.
export async function installArc(scene, room, toWorld, anisotropy) {
  const texture = await new THREE.TextureLoader().loadAsync(
    new URL('./lujiazui-night.png', import.meta.url).href);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  const radius = 42;
  const vertices = [], uv = [], indices = [];
  const segments = 160;
  // Keep the original landmark proportions in the main view. The peripheral
  // photo districts extend round the oblique end panes without repeating.
  // Each pair is a vertical photo coordinate and a height in metres.
  const height = v => 1.87 + 48.75 * (-.09 + (.75-v)*Math.PI/9);
  const rows = [[0,60],[0,height(0)],[.75,height(.75)],[.87,height(.87)],
    [.94,height(.97)],[.98,-13],[1,-33]];
  for (let j=0; j<rows.length; j++) {
    const [v,z] = rows[j];
    for (let i=0; i<=segments; i++) {
      const u = i/segments;
      const edge = Math.max(0,(Math.abs(u-.5)-.28)/.22);
      const bearing = THREE.MathUtils.degToRad(6.7+70*(u-.5)+Math.sign(u-.5)*30*edge*edge);
      const forward = radius*Math.cos(bearing), side = radius*Math.sin(bearing);
      const p = toWorld([5.82+.6*forward+.8*side,-.29-.8*forward+.6*side,z]);
      vertices.push(p.x,p.y,p.z);
      uv.push(u,1-v);
      if (i && j) {
        const k = j*(segments+1)+i;
        indices.push(k-segments-2,k-1,k,k-segments-2,k,k-segments-1);
      }
    }
  }
  const mesh = new THREE.BufferGeometry();
  mesh.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  mesh.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  mesh.setIndex(indices);
  const screen = new THREE.Mesh(mesh,new THREE.MeshBasicMaterial({
    map:texture, side:THREE.DoubleSide
  }));
  screen.name = 'Shanghai photographic arc';
  room.traverse(node => {if(node.name.startsWith('SH-')) node.visible=false;});
  scene.add(screen);
}
