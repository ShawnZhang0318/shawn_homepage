import * as THREE from 'three';

// Map a DOM rectangle onto the four projected corners of the physical LCD.
// This keeps the text selectable, accessible and sharp at the current zoom.
function screenTransform(points, width, height) {
  const [p0, p1, p2, p3] = points;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  const divisor = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(divisor) < .000001) return null;
  const g = (sx * dy2 - dx2 * sy) / divisor;
  const h = (dx1 * sy - sx * dy1) / divisor;
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  return 'matrix3d(' + [
    a/width, d/width, 0, g/width,
    b/height, e/height, 0, h/height,
    0, 0, 1, 0,
    p0.x, p0.y, 0, 1,
  ].join(',') + ')';
}


// The same real LCD geometry backs both the distant texture and the close,
// interactive DOM surface. The panel is shown only while reading that screen.
export function attachScreenPanel(lcd, camera, panel, canvas, name, width, height) {
  lcd.updateWorldMatrix(true, false);
  lcd.geometry.computeBoundingBox();
  const { min, max } = lcd.geometry.boundingBox;
  const positions = lcd.geometry.attributes.position;
  const targets = [[min.x,max.z],[max.x,max.z],[max.x,min.z],[min.x,min.z]];
  const corners = targets.map(([x,z]) => {
    let best = Infinity, index = 0;
    for (let i=0; i<positions.count; i++) {
      const distance = (positions.getX(i)-x)**2 + (positions.getZ(i)-z)**2;
      if (distance < best) { best = distance; index = i; }
    }
    return new THREE.Vector3().fromBufferAttribute(positions,index).applyMatrix4(lcd.matrixWorld);
  });
  const geometry = lcd.geometry.clone();
  const uv = new Float32Array(positions.count*2);
  for (let i=0; i<positions.count; i++) {
    uv[i*2] = (positions.getX(i)-min.x)/(max.x-min.x);
    uv[i*2+1] = (positions.getZ(i)-min.z)/(max.z-min.z);
  }
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  lcd.geometry = geometry;
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  lcd.material = new THREE.MeshBasicMaterial({ map, toneMapped: false });
  lcd.material.name = name;
  lcd.userData.interactiveDisplay = true;
  document.getElementById('stage').append(panel);
  const center = corners.reduce((point,corner)=>point.add(corner), new THREE.Vector3()).multiplyScalar(.25);
  const right = corners[1].clone().sub(corners[0]);
  const up = corners[0].clone().sub(corners[3]);
  const normal = new THREE.Vector3().crossVectors(right,up).normalize();
  return {
    center, normal,
    invalidate() { map.needsUpdate = true; },
    readable(minWidth = Math.min(420, innerWidth * .7)) {
      const towardsEye = camera.position.clone().sub(center).normalize();
      if (normal.dot(towardsEye) < .5) return false;
      const points = corners.map(point => point.clone().project(camera));
      if (points.some(point => point.z < -1 || point.z > 1)) return false;
      const edge = (a, b) => Math.hypot((a.x-b.x)*innerWidth/2, (a.y-b.y)*innerHeight/2);
      return Math.min(edge(points[0],points[1]),edge(points[3],points[2])) >= minWidth;
    },
    frame() {
      if (panel.hidden) return;
      const points = corners.map(point => {
        const p = point.clone().project(camera);
        return { x: (p.x+1)/2*innerWidth, y: (1-p.y)/2*innerHeight };
      });
      const transform = screenTransform(points,width,height);
      if (transform) panel.style.transform = transform;
    },
  };
}
