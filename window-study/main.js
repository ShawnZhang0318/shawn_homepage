import {lightStudy,finishShadows} from './evening.js';
import {finishWater} from './river-surface.js?v=facades4';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAGE, PaperSurface } from './paper.js';
import { EyeCamera, FOCUS_VIEWS } from './eye-camera.js?v=window-look-1';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let renderer, scene, camera, paper, surface, texture, baseMaterial, paperMesh;
let state = 'loading', motion = null, selectedIndex = 0;
const raycaster = new THREE.Raycaster();
const home = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1) };
const raised = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1) };
// The existing CPU preview uses right = Z-up × forward (a reflected screen basis).
// Mirror the imported runtime frame and camera together to reproduce that approved view.
const toYUp = a => new THREE.Vector3(-a[0], a[2], -a[1]);
let cameraSource, readyAt, lastPointer = null, eyeCamera;
let roomMeshes = [];
let updateWater, aliveCity;
const restHint = '按住拖动转头 · 滚轮远近 · 点击电脑、窗边或书柜靠近';
function syncViewControls() {
  const enabled = state === 'rest';
  $('views').disabled = !enabled; $('reset-view').disabled = !enabled;
  $('views').value = eyeCamera?.focusId || '';
  $('window-step').hidden=!(enabled && eyeCamera?.focusId==='WINDOW');
  if (enabled) $('hint').textContent = eyeCamera?.focusId ? '拖动转头 · 滚轮远近 · 返回原视角' : restHint;
}
function roomHit(event) {
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1, 1-(event.clientY-r.top)/r.height*2), camera);
  return raycaster.intersectObjects(roomMeshes, false)[0] || null;
}
function focusId(hit) {
  for (let o = hit?.object; o; o = o.parent) {
    const view = FOCUS_VIEWS.find(v => v.id === o.name || v.groups?.includes(o.name) || v.prefixes?.some(prefix => o.name.startsWith(prefix)));
    if (view) return view.id;
  }
  return null;
}

function syncAccessible() {
  const item = surface.items.find(e => e.id === surface.selected);
  $('accessible').textContent = item ? `${item.display_name}，${item.dates}。${item.bullets.join(' ')}` : 'Education 静态展示。可选择原力无限 INFIFORCE 或 Agentic Intelligence Lab。Projects 暂无条目。';
  document.querySelectorAll('#keyboard-items button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === surface.selected)));
}

function select(id) {
  if (state !== 'raised') return;
  surface.select(id); selectedIndex = Math.max(0, surface.items.findIndex(e => e.id === id)); syncAccessible();
}

function resize() {
  if (!renderer) return;
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h;
  // Preserve the original lens and projection; navigation changes eye position/direction only.
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(36 / (2 * cameraSource.focal_mm) / camera.aspect));
  camera.updateProjectionMatrix();
  camera.projectionMatrix.elements[9] = 2 * cameraSource.offset_fraction_of_width_height_right_down[1];
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  updateRaisedPose();
  if (state === 'raised') applyPose(raised);
  if (motion?.target === 'raised') motion.to = clonePose(raised);
}

function updateRaisedPose() {
  if (!camera || !paper) return;
  const distance = eyeCamera?.inspectionDistance() ?? .49;
  const viewH = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2));
  const viewW = viewH * camera.aspect;
  const wide = canvas.clientWidth > 900;
  // Red-frame reading pose: enlarge from the upper-left toward the lower-right.
  // The width limit takes precedence on portrait screens.
  const scale = Math.min(viewH * (wide ? .893 : .84) / .210, viewW * .92 / .148);
  raised.scale.setScalar(scale);
  const halfPageWidth = .074 * scale;
  const offsetX = wide ? Math.min(.19 * viewW, .475 * viewW - halfPageWidth) : 0;
  raised.position.set(offsetX, viewH * (wide ? -.034 : .025), -distance)
    .applyQuaternion(camera.quaternion).add(camera.position);
  raised.quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.045, -.075, -.035)));
}

function clonePose(pose) { return { position: pose.position.clone(), quaternion: pose.quaternion.clone(), scale: pose.scale.clone() }; }
function applyPose(pose) { paper.position.copy(pose.position); paper.quaternion.copy(pose.quaternion); paper.scale.copy(pose.scale); }
function transition(target) {
  if (!paper || (target === 'raised' && state !== 'rest') || (target === 'rest' && !['raising', 'raised'].includes(state))) return;
  surface.hover(null); lastPointer = null;
  if (target === 'raised') { eyeCamera.freeze(); updateRaisedPose(); paperMesh.material = new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false,color:0xfffcf5,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}); paperMesh.material.needsUpdate = true; }
  motion = { target, from: clonePose(paper), to: clonePose(target === 'raised' ? raised : home), start: performance.now(), duration: reduced.matches ? 0 : target === 'raised' ? 950 : 720 };
  state = target === 'raised' ? 'raising' : 'lowering';
  syncViewControls();
  $('pickup').hidden = true; $('putdown').hidden = false;
  $('putdown').disabled = state === 'lowering'; $('keyboard-items').hidden = true;
  $('hint').textContent = target === 'raised' ? '正在拿起纸张…' : '正在放回原位…';
}

function pointerHit(event) {
  if (!paper || !['rest', 'raised'].includes(state)) return null;
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX - r.left) / r.width * 2 - 1, 1 - (event.clientY - r.top) / r.height * 2), camera);
  const hit = raycaster.intersectObject(paper, true)[0];
  if (!hit) return null;
  if (state === 'rest') { const front = roomHit(event); if (front && front.distance < hit.distance - .003 && !paper.getObjectById(front.object.id)) return null; }
  return { hit, region: hit.uv ? surface.hit(hit.uv.x * PAGE.width, hit.uv.y * PAGE.height) : null };
}

canvas.addEventListener('pointermove', event => {
  if (!surface || eyeCamera?.drag?.moved) return; lastPointer = { clientX: event.clientX, clientY: event.clientY };
  const result = pointerHit(event);
  const item = state === 'raised' && result?.region?.kind === 'item' ? result.region.id : null;
  surface.hover(item);
  const focus = state === 'rest' && focusId(roomHit(event));
  canvas.style.cursor = item || (state === 'rest' && result) || focus ? 'pointer' : state === 'rest' ? 'grab' : 'default';
});
canvas.addEventListener('pointerleave', () => { lastPointer = null; surface?.hover(null); });
canvas.addEventListener('click', event => {
  if (eyeCamera?.suppressClick) { eyeCamera.suppressClick = false; return; }
  const result = pointerHit(event);
  if (state === 'rest') {
    if (result) return transition('raised');
    const id = focusId(roomHit(event)); if (id) eyeCamera.focus(id);
    return;
  }
  if (!result) return;
  if (result.region?.kind === 'item') return select(result.region.id);
  if (result.region?.kind === 'static') return;
  transition('rest');
});
$('pickup').addEventListener('click', () => { transition('raised'); canvas.focus({ preventScroll: true }); });
$('putdown').addEventListener('click', () => transition('rest'));
$('views').addEventListener('change', e => e.target.value ? eyeCamera.focus(e.target.value) : eyeCamera.reset());
$('reset-view').addEventListener('click', () => eyeCamera.reset());
$('step-left').onclick=()=>eyeCamera.stepSide(-1);
$('step-right').onclick=()=>eyeCamera.stepSide(1);
window.addEventListener('keydown', event => {
  if(state==='rest' && eyeCamera?.focusId==='WINDOW' && ['ArrowLeft','ArrowRight','a','d'].includes(event.key) && event.target.tagName!=='SELECT'){
    if(!event.repeat) eyeCamera.stepSide(['ArrowLeft','a'].includes(event.key)?-1:1);
    event.preventDefault();return;
  }
  if (event.key === 'Escape') { if (state === 'rest') eyeCamera?.reset(); else transition('rest'); event.preventDefault(); }
  if (state !== 'raised' || event.target.tagName === 'BUTTON') return;
  if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) {
    selectedIndex = (selectedIndex + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : surface.items.length - 1)) % surface.items.length;
    surface.hover(surface.items[selectedIndex].id); event.preventDefault();
  }
  if (event.key === 'Enter' || event.key === ' ') { select(surface.items[selectedIndex].id); event.preventDefault(); }
});
window.addEventListener('resize', resize);

function tick(now) {
  requestAnimationFrame(tick);
  if (!renderer || document.hidden) return;
  eyeCamera?.update(now);
  updateWater?.(now);
  aliveCity?.frame(now);
  if (motion) {
    const t = motion.duration ? Math.min(1, (now - motion.start) / motion.duration) : 1;
    const ease = t * t * (3 - 2 * t);
    paper.position.lerpVectors(motion.from.position, motion.to.position, ease);
    // Lift out of the notebook before travelling; exact original pose at both endpoints.
    paper.position.y += Math.sin(Math.PI * t) * .055;
    paper.quaternion.slerpQuaternions(motion.from.quaternion, motion.to.quaternion, ease);
    paper.scale.lerpVectors(motion.from.scale, motion.to.scale, ease);
    if (t === 1) {
      const target = motion.target; applyPose(motion.to); motion = null;
      state = target === 'raised' ? 'raised' : 'rest'; readyAt = now;
      $('putdown').disabled = false; $('putdown').hidden = state === 'rest'; $('pickup').hidden = state !== 'rest';
      $('keyboard-items').hidden = state !== 'raised';
      $('hint').textContent = state === 'raised' ? '点击公司查看 · 点击纸面空白处或 Esc 放下' : restHint;
      eyeCamera.enabled = state === 'rest'; syncViewControls();
      if (state === 'rest') {
        const dynamicMaterial = paperMesh.material; paperMesh.material = baseMaterial; dynamicMaterial.dispose();
        surface.selected = null; surface.hovered = null; surface.draw(); syncAccessible();
      }
    }
  } else if (state === 'raised' && !reduced.matches) {
    const t = (now - readyAt) / 1000;
    paper.position.copy(raised.position).add(new THREE.Vector3(0, Math.sin(t * 1.15) * .00065, 0).applyQuaternion(camera.quaternion));
    paper.quaternion.copy(raised.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(t * .8) * .0018));
    if (lastPointer) {
      const result = pointerHit(lastPointer);
      surface.hover(result?.region?.kind === 'item' ? result.region.id : null);
    }
  }
  renderer.render(scene, camera);
}

async function init() {
  const [content, cameraData] = await Promise.all([
    fetch('./content.json').then(r => { if (!r.ok) throw Error('Content missing'); return r.json(); }),
    fetch('./model/camera.json').then(r => r.json()),
    document.fonts.load('600 38px Caveat'), document.fonts.load('400 35px WenKai'),
    document.fonts.load('600 27px DetailHand'),
  ]);
  cameraSource = cameraData;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  scene = new THREE.Scene(); scene.background = new THREE.Color('#435f7f');
  camera = new THREE.PerspectiveCamera(48.936, 1, cameraData.near_m, 6200);
  camera.position.copy(toYUp(cameraData.world_position_xyz_m));
  camera.up.copy(toYUp(cameraData.world_up_hint_xyz)); camera.lookAt(toYUp(cameraData.world_target_xyz_m)); camera.updateMatrixWorld();
  const ceilingBounce=lightStudy(renderer,scene);
  const gltf = await new GLTFLoader().loadAsync('./model/room-river-facades.glb');
  gltf.scene.scale.x = -1;
  finishShadows(gltf.scene);
  const windowLook = location.pathname.startsWith('/window-look/');
  let windowStation;
  if (windowLook) {
    const study = await import('./window-look/waterfront.js?v=2');
    const closerBank = location.pathname.startsWith('/window-look/closer/');
    study.placeWaterfront(gltf.scene, cameraData.world_position_xyz_m, closerBank ? .0135 : .018);
    windowStation = closerBank
      ? { ...study.windowStation, target: [7.40, -9.86, 4.34] }
      : study.windowStation;
  }
  if (location.pathname.startsWith('/arc-study/')) {
    const {installArc} = await import('./arc-study/arc.js');
    await installArc(scene, gltf.scene, toYUp, renderer.capabilities.getMaxAnisotropy());
  } else if (!/\/(window-look|arc-study)\//.test(location.pathname) && new URLSearchParams(location.search).get('exterior') !== 'facades') {
    const {installAliveCity} = await import('./alive-city/alive.js?v=1');
    aliveCity = await installAliveCity({scene, room: gltf.scene, camera, renderer, toWorld: toYUp, reduced});
    const rain = $('rain');
    rain.hidden = false;
    rain.onclick = () => {
      aliveCity.setRain(!aliveCity.raining);
      rain.setAttribute('aria-pressed', String(aliveCity.raining));
      rain.textContent = aliveCity.raining ? '下雨' : '雨停';
    };
  } else {
    updateWater=finishWater(gltf.scene,reduced);
  }
  const centralLights=[[ceilingBounce,ceilingBounce.intensity]], centralDiffusers=new Set();
  gltf.scene.traverse(object=>{
    if(object.isLight && /^Central[ _]/.test(object.name)) centralLights.push([object,object.intensity]);
    if(object.isMesh && object.material.name==='opalglass') centralDiffusers.add(object.material);
  });
  const dimmer=$('ceiling-light');
  dimmer.disabled=centralLights.length===0;
  dimmer.onclick=()=>{
    const on=dimmer.getAttribute('aria-pressed')!=='true';
    for(const [light,intensity] of centralLights) light.intensity=on?intensity:0;
    for(const material of centralDiffusers) material.emissiveIntensity=on?1:0;
    dimmer.setAttribute('aria-pressed',String(on));
    dimmer.textContent=on?'顶灯开':'顶灯关';
  };
  scene.add(gltf.scene); scene.updateMatrixWorld(true);
  const original = gltf.scene.getObjectByName('P02');
  if (!original) throw new Error('P02 paper not found in unchanged model');
  const center = toYUp([1.322, .460, .76904]);
  const angle = THREE.MathUtils.degToRad(-14);
  // Canonical +X right, +Y page top, +Z front. The model UV v grows toward page bottom.
  const right = toYUp([Math.cos(angle), Math.sin(angle), 0]);
  const up = toYUp([Math.sin(angle), -Math.cos(angle), 0]);
  const normal = new THREE.Vector3().crossVectors(right, up);
  const basis = new THREE.Matrix4().makeBasis(right, up, normal);
  home.position.copy(center); home.quaternion.setFromRotationMatrix(basis);
  const frame = new THREE.Matrix4().compose(home.position, home.quaternion, home.scale);
  paper = new THREE.Group(); paper.name = 'P02-inspection-pivot'; scene.add(paper); applyPose(home);
  const originalMeshes = []; original.traverse(o => { if (o.isMesh) originalMeshes.push(o); });
  for (const mesh of originalMeshes) {
    let geometry = mesh.geometry.clone();
    const transform = new THREE.Matrix4().multiplyMatrices(frame.clone().invert(), mesh.matrixWorld);
    geometry.applyMatrix4(transform);
    // Baking a reflected import frame requires restoring winding as well as normals.
    if (transform.determinant() < 0) {
      const indices = geometry.index.array;
      for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    }
    // Smooth the existing shallow bend in this inspection renderer only; positions/UV unchanged.
    geometry.deleteAttribute('normal');
    const welded = mergeVertices(geometry, 1e-7); geometry.dispose(); geometry = welded; geometry.computeVertexNormals();
    const copy = new THREE.Mesh(geometry, mesh.material.clone()); copy.name = mesh.name; paper.add(copy);
    copy.material.side = THREE.DoubleSide;
    if (copy.material.name === 'notepaper') {
      paperMesh = copy; baseMaterial = copy.material;
      baseMaterial.polygonOffset = true; baseMaterial.polygonOffsetFactor = -2; baseMaterial.polygonOffsetUnits = -2;
    }
  }
  original.visible = false;
  if (!paperMesh) throw new Error('Original notepaper surface missing');
  // Use the verified standalone copy for the tiny resting texture; full anisotropy
  // keeps the original writing visible at the grazing desktop angle.
  const restingTexture = await new THREE.TextureLoader().loadAsync('./model/textures/work-handwritten-note.png');
  restingTexture.flipY = false; restingTexture.colorSpace = THREE.SRGBColorSpace;
  restingTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  baseMaterial.map = restingTexture; baseMaterial.needsUpdate = true;
  surface = new PaperSurface(content, restingTexture.image);
  texture = new THREE.CanvasTexture(surface.canvas); texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  surface.onchange = () => { texture.needsUpdate = true; };
  for (const item of surface.items) {
    const button = document.createElement('button'); button.textContent = `${item.number} ${item.display_name}`;
    button.dataset.id = item.id; button.addEventListener('click', () => select(item.id)); $('keyboard-items').append(button);
  }
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh) return;
    for (let p=o; p; p=p.parent) if (!p.visible) return;
    roomMeshes.push(o);
  });
  eyeCamera = new EyeCamera(camera, canvas, roomMeshes.filter(o => !paper.getObjectById(o.id)), toYUp, reduced, syncViewControls, windowStation);
  if (new URLSearchParams(location.search).get('study') === 'cuboid') {
    const {addCuboid} = await import('./cuboid-study/cuboid.js');
    window.cuboidMeasurement = addCuboid(scene, camera, gltf.scene);
  }
  for (const v of FOCUS_VIEWS) { const o=document.createElement('option'); o.value=v.id; o.textContent=v.label; $('views').append(o); }
  state = 'rest'; syncViewControls(); resize(); syncAccessible(); $('loading').hidden = true; $('pickup').disabled = false;
  if (new URLSearchParams(location.search).get('view') === 'window') eyeCamera.focus('WINDOW');
  requestAnimationFrame(tick);
  // Read-only diagnostics for reproducible native pointer tests; no test-only state transitions.
  window.paperReview = {
    snapshot: () => ({ state, selected: surface.selected, hovered: surface.hovered, contentBottom: surface.contentBottom,
      projection: camera.projectionMatrix.toArray(), view: eyeCamera.snapshot(), regions: structuredClone(surface.regions), cameraId: cameraSource.camera_id, pose: clonePose(paper), home: clonePose(home),
      fontReady: document.fonts.check('600 38px Caveat') && document.fonts.check('400 35px WenKai'), triangles: renderer.info.render.triangles }),
    towerHeights: () => {
      const heights = {};
      const point = new THREE.Vector3();
      gltf.scene.traverse(mesh => {
        if (!mesh.isMesh || !/Oriental.Pearl|Shanghai.Tower/.test(mesh.name)) return;
        const positions = mesh.geometry.attributes.position;
        let low = Infinity, high = -Infinity;
        for (let i = 0; i < positions.count; ++i) {
          point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(camera);
          low = Math.min(low, point.y);
          high = Math.max(high, point.y);
        }
        heights[mesh.name] = (high - low) * innerHeight / 2;
      });
      return heights;
    },
    waterfrontMatrices: () => gltf.scene.children.flatMap(root => {
      const matrices = [];
      root.traverse(node => {
        if (node.name.startsWith('SH-')) matrices.push(node.matrixWorld.toArray());
      });
      return matrices;
    }),
    paperPoint: (x, y) => {
      scene.updateMatrixWorld(true);
      // Original mesh follows the shallow notebook bend; nearest UV vertex avoids assuming flatness.
      const uv = paperMesh.geometry.attributes.uv, pos = paperMesh.geometry.attributes.position;
      let best = Infinity, index = 0;
      for (let i = 0; i < uv.count; i++) { const d = (uv.getX(i) - x / PAGE.width) ** 2 + (uv.getY(i) - y / PAGE.height) ** 2; if (d < best) { best = d; index = i; } }
      const p = new THREE.Vector3().fromBufferAttribute(pos, index).applyMatrix4(paperMesh.matrixWorld).project(camera);
      return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
    },
    focusPoints: () => FOCUS_VIEWS.map(v => { const p=toYUp(v.clickPoint || v.target).project(camera); return {id:v.id,x:(p.x+1)/2*innerWidth,y:(1-p.y)/2*innerHeight}; }),
    textureDataURL: () => surface.canvas.toDataURL('image/png'),
  };
}

init().catch(error => { console.error(error); $('loading').textContent = `预览未能载入：${error.message}。请通过本目录的本地 HTTP 服务打开。`; state = 'error'; });
