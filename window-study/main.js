import { installLinksScreen } from './links-screen.js?v=nearby-links';
import { installPostsMonitor } from './posts-monitor.js?v=nearby-links';
import { installBusinessCard } from './business-card.js?v=front-only';
import { loadScreenFonts } from './screen-browser.js?v=dark-studio';
import { loadingPhase, assetProgress, loadedAsset, revealStudy, loadingFailed } from './opening.js?v=2';
import { createStudyHUD } from './hud.js?v=posts-screen';
import {lightStudy,finishShadows,addInteriorSoftness} from './evening.js?v=bench-restored';
import {cabinetReflections} from './award-finish.js?v=lamp-states';
import {finishWater} from './river-surface.js?v=facades4';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAGE, PaperSurface } from './paper.js';
import { EyeCamera, FOCUS_VIEWS } from './eye-camera.js?v=robotics-hud';
import { installTapeDeck } from './av-interaction.js?v=whole-cassette';
import { placeLaptop, installSeatTextiles, installGamingLaptop } from './seat-and-laptop.js?v=tapered-deck';
import { installDeskDetails } from './desk-details.js?v=connected-wrist';
import { installBenchFinish } from './bench-finish.js?v=servo-arm';
import { addHotCoffee } from './coffee.js?v=blender-plume';
import { aboutCopy, installAboutNotebook, notebookShift } from './about-notebook.js?v=sewn-spread';

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
let updateWater, aliveCity, tapeDeck, practicals, updateCabinetReflection;
let updateSteam;
let notebook, aboutMotion, aboutAfterPaper;
let postsMonitor, postsLeg, linksScreen, linksLeg;
let businessCard,cardCopyTimer;
const aboutButton = $('open-about'), closeAboutButton = $('close-about');
const ease = t => THREE.MathUtils.smoothstep(t, 0, 1);
let pendingSceneAction;
const hud = createStudyHUD({
  onSelectNavSection(section) {
    if (section === 'about') {
      if (state === 'about') { syncHUD(); return; }
      runSceneAction(openAbout);
    }
    else if (section === 'posts') {
      if (['approaching-posts', 'posts'].includes(state)) { syncHUD(); return; }
      runSceneAction(openPosts);
    }
    else if (section === 'links') {
      if (['approaching-links', 'links'].includes(state)) { syncHUD(); return; }
      runSceneAction(openLinks);
    }
    else if (section === 'lab') runSceneAction(() => {
      eyeCamera.focus('ROBOTICS');
      hud.update({ activeSection: 'lab' });
    });
    else if (section === 'work') {
      if (['approaching-work', 'raising', 'raised'].includes(state)) {
        syncHUD();
        canvas.focus({ preventScroll: true });
        return;
      }
      runSceneAction(() => {
        approachWork();
        canvas.focus({ preventScroll: true });
      });
    }
  },
  onResetCamera: () => runSceneAction(() => eyeCamera.reset()),
  onSelectCameraPreset: preset => runSceneAction(() => preset ? eyeCamera.focus(preset) : eyeCamera.reset()),
});
window.addEventListener('screen-navigate', event => {
  const section = event.detail;
  if (section === 'posts' && ['posts','approaching-posts'].includes(state)) return;
  if (section === 'links' && ['links','approaching-links'].includes(state)) return;
  if (section === 'home') runSceneAction(() => eyeCamera.reset());
  if (section === 'posts') runSceneAction(openPosts);
  if (section === 'links') runSceneAction(openLinks);
});
function runSceneAction(action) {
  if (state === 'loading') return;
  if (['approaching-card','raising-card','card','lowering-card'].includes(state)) {
    pendingSceneAction=action;closeCard();return;
  }
  if (['approaching-links', 'links'].includes(state)) leaveLinks();
  if (['approaching-posts', 'posts'].includes(state)) leavePosts();
  if (state === 'approaching-work') {
    eyeCamera.stop();
    state = 'rest';
    pendingSceneAction = null;
  }
  if (state === 'rest') { action(); return; }
  pendingSceneAction = action;
  if (state === 'about') closeAbout();
  else if (state !== 'lowering') transition('rest');
}

function openCard() {
  if(!businessCard||state!=='rest') return;
  const target=businessCard.center();
  $('pickup').hidden=true;$('close-card').hidden=false;$('card-status').hidden=false;
  $('card-status').textContent='CLICK THE EMAIL TO COPY';
  hud.update({activeSection:null});
  if(camera.position.distanceTo(target)<.8) {
    eyeCamera.freeze();businessCard.raise(camera,reduced.matches,performance.now());state='raising-card';
  } else {
    const position=toYUp([1.65,1.03,1.24]);
    const quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(position,target,camera.up));
    state='approaching-card';eyeCamera.begin(position,quaternion,'CONTACT');
  }
  canvas.focus({preventScroll:true});syncViewControls();
}
function finishCard() {
  state='rest';eyeCamera.enabled=true;eyeCamera.stop();
  $('close-card').hidden=true;$('card-status').hidden=true;$('pickup').hidden=false;
  clearTimeout(cardCopyTimer);syncViewControls();
}
function closeCard() {
  if(state==='lowering-card') return;
  if(state==='approaching-card') {eyeCamera.stop();businessCard.restore();finishCard();return;}
  if(!['raising-card','card'].includes(state)) return;
  businessCard.lower(reduced.matches,performance.now());state='lowering-card';syncViewControls();
}
async function copyCardEmail() {
  try {
    await navigator.clipboard.writeText('shawn_0318@163.com');
    $('card-status').textContent='EMAIL COPIED ✓';
  } catch {$('card-status').textContent='COPY: shawn_0318@163.com';}
  clearTimeout(cardCopyTimer);cardCopyTimer=setTimeout(()=>{$('card-status').textContent='CLICK THE EMAIL TO COPY';},2000);
}
function syncHUD() {
  hud.update({
    ready: state !== 'loading',
    controlsEnabled: state === 'rest',
    isLightOn: $('ceiling-light').getAttribute('aria-pressed') === 'true',
    isRaining: aliveCity?.raining ?? false,
    currentCameraPreset: eyeCamera?.focusId || '',
    ...(state === 'about' ? { activeSection: 'about' } : {}),
    ...(['approaching-work', 'raising', 'raised'].includes(state) ? { activeSection: 'work' } : {}),
    ...(['approaching-posts', 'posts'].includes(state) ? { activeSection: 'posts' } : {}),
    ...(['approaching-links', 'links'].includes(state) ? { activeSection: 'links' } : {}),
  });
}

function moveToLinks(position, duration) {
  const orientation = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, linksScreen.target, camera.up));
  eyeCamera.begin(position, orientation, 'LINKS');
  if (eyeCamera.flight && !reduced.matches) eyeCamera.flight.duration = duration;
}
function openLinks() {
  if (!linksScreen || state !== 'rest') return;
  const url = new URL(location.href);
  url.searchParams.set('section', 'links');
  history.replaceState(null, '', url);
  if (linksScreen.readable()) {
    state = 'links'; linksLeg = null;
    eyeCamera.freeze(); linksScreen.show();
  } else {
    state = 'approaching-links';
    linksLeg = camera.position.distanceTo(linksScreen.target) > linksScreen.approach.distanceTo(linksScreen.target) + .08 ? 'walking' : 'sitting';
    moveToLinks(linksLeg === 'walking' ? linksScreen.approach : linksScreen.near, linksLeg === 'walking' ? 1300 : 700);
  }
  $('pickup').hidden = true;
  $('close-links').hidden = false;
  canvas.focus({ preventScroll: true });
  syncViewControls();
}
function leaveLinks(reset = false) {
  const url = new URL(location.href);
  if (url.searchParams.get('section') === 'links') {
    url.searchParams.delete('section');
    history.replaceState(null, '', url);
  }
  linksScreen?.hide();
  eyeCamera.enabled = true;
  eyeCamera.stop();
  state = 'rest';
  linksLeg = null;
  $('close-links').hidden = true;
  $('pickup').hidden = false;
  hud.update({ activeSection: null });
  if (reset) eyeCamera.reset();
  syncViewControls();
}

function moveToPosts(eye, duration) {
  const position = toYUp(eye);
  const target = toYUp([2.10, .298662, 1.042445]);
  const orientation = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, target, camera.up));
  eyeCamera.begin(position, orientation, 'POSTS');
  if (eyeCamera.flight && !reduced.matches) eyeCamera.flight.duration = duration;
}

function openPosts() {
  if (!postsMonitor || state !== 'rest') return;
  const url = new URL(location.href);
  url.searchParams.set('section', 'posts');
  history.replaceState(null, '', url);
  if (postsMonitor.readable()) {
    state = 'posts'; postsLeg = null;
    eyeCamera.freeze(); postsMonitor.show();
  } else {
    state = 'approaching-posts';
    const target = toYUp([2.10, .298662, 1.042445]);
    const approach = [2.10, 1.35, 1.48];
    postsLeg = camera.position.distanceTo(target) > toYUp(approach).distanceTo(target) + .08 ? 'walking' : 'sitting';
    moveToPosts(postsLeg === 'walking' ? approach : [2.10, .93, 1.13], postsLeg === 'walking' ? 1300 : 700);
  }
  $('pickup').hidden = true;
  $('close-posts').hidden = false;
  canvas.focus({ preventScroll: true });
  syncViewControls();
}

function leavePosts(reset = false) {
  const url = new URL(location.href);
  if (url.searchParams.get('section') === 'posts') {
    url.searchParams.delete('section');
    history.replaceState(null, '', url);
  }
  postsMonitor?.hide();
  eyeCamera.enabled = true;
  eyeCamera.stop();
  state = 'rest';
  postsLeg = null;
  $('close-posts').hidden = true;
  $('pickup').hidden = false;
  hud.update({ activeSection: null });
  if (reset) eyeCamera.reset();
  syncViewControls();
}

function approachWork() {
  if (!paper || state !== 'rest') return;
  const position = toYUp([1.62, 1.16, 1.43]);
  const orientation = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, home.position, camera.up));
  state = 'approaching-work';
  eyeCamera.begin(position, orientation, 'WORK');
  if (eyeCamera.flight && !reduced.matches) eyeCamera.flight.duration = 1500;
  $('pickup').hidden = true;
  $('hint').textContent = '正在走近桌边…';
  canvas.focus({ preventScroll: true });
  syncViewControls();
}

for (const type of ['pointerdown', 'wheel']) {
  canvas.addEventListener(type, () => {
    if (['approaching-links', 'links'].includes(state)) { leaveLinks(); return; }
    if (['approaching-posts', 'posts'].includes(state)) { leavePosts(); return; }
    if (state !== 'approaching-work') return;
    eyeCamera.stop();
    state = 'rest';
    $('pickup').hidden = false;
    hud.update({ activeSection: null });
    syncViewControls();
  }, { capture: true, passive: true });
}


function openAbout() {
  if (['raising', 'raised', 'lowering'].includes(state)) {
    aboutAfterPaper = true;
    if (state !== 'lowering') transition('rest');
    return;
  }
  if (!notebook || state !== 'rest') return;
  state = 'about';
  const target = toYUp([1.27 + notebookShift, .495, .758]);
  const distance = Math.max(.39, .29 / camera.aspect);
  const position = target.clone().add(new THREE.Vector3(0, .88, -.475).multiplyScalar(distance));
  const orientation = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, target, camera.up));
  eyeCamera.begin(position, orientation, 'ABOUT');
  aboutMotion = { start: performance.now(), closing: false };
  $('pickup').hidden = true;
  $('hint').textContent = 'About';
  aboutButton.setAttribute('aria-expanded', 'true');
  closeAboutButton.hidden = false;
  closeAboutButton.disabled = true;
  $('about-copy').hidden = false;
  syncViewControls();
}

function closeAbout() {
  if (state !== 'about' || aboutMotion) return;
  closeAboutButton.disabled = true;
  aboutMotion = { start: performance.now(), closing: true };
}

function updateAbout(now) {
  if (!aboutMotion) return;
  const { start, closing } = aboutMotion;
  const elapsed = now - start;
  const duration = closing ? 950 : 2000;
  const progress = reduced.matches ? (closing ? 0 : 1) :
    closing ? 1 - elapsed / duration : (elapsed - 800) / 1200;
  const move = ease(progress * 2);
  const slide = THREE.MathUtils.smoothstep(move, .18, .78);
  const height = .058 * THREE.MathUtils.smoothstep(move, 0, .18)
    - .085 * THREE.MathUtils.smoothstep(move, .78, 1);
  paper.position.copy(home.position).add(toYUp([.225 * slide, -.065 * slide, height]));
  notebook.pose(ease(progress * 2 - 1));
  if (!reduced.matches && elapsed < duration) return;
  aboutMotion = null;
  renderer.shadowMap.needsUpdate = true;
  if (!closing) {
    // ABOUT stays on the desk, unlike the held WORK sheet. Keep EyeCamera
    // active so input continues from its current pose, even during opening.
    // The 'about' state keeps the notebook open independently of navigation.
    closeAboutButton.disabled = false;
    closeAboutButton.focus({preventScroll:true});
    return;
  }
  applyPose(home);
  state = 'rest';
  eyeCamera.enabled = true;
  // A clicked destination takes over from the current eye pose after closing.
  if (!pendingSceneAction) eyeCamera.reset();
  $('pickup').hidden = false;
  $('hint').textContent = restHint;
  closeAboutButton.hidden = true;
  $('about-copy').hidden = true;
  aboutButton.setAttribute('aria-expanded', 'false');
  hud.update({ activeSection: null });
  aboutButton.focus({preventScroll:true});
}
function refreshReflections() {
  const ceilingBit = $('ceiling-light').getAttribute('aria-pressed') === 'true' ? 8 : 0;
  updateCabinetReflection(practicals.mask | ceilingBit);
}
const restHint = '按住拖动转头 · 滚轮远近 · 点击电脑、窗边或书柜靠近';
function syncViewControls() {
  const enabled = state === 'rest';
  syncHUD();
  $('views').disabled = !enabled; $('reset-view').disabled = !enabled;
  $('views').value = enabled ? eyeCamera?.focusId || '' : '';
  $('window-step').hidden=!(enabled && eyeCamera?.focusId==='WINDOW');
  if (enabled) {
    const focusedHint = eyeCamera?.focusId === 'M01' && tapeDeck?.state === 'shelved'
      ? '点击左侧「原力无限 INFIFORCE」磁带装带'
      : '拖动转头 · 滚轮远近 · 返回原视角';
    $('hint').textContent = eyeCamera?.focusId ? focusedHint : restHint;
  }
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
  if (target === 'rest') hud.update({ activeSection: null });
  surface.hover(null); lastPointer = null;
  if (target === 'raised') { eyeCamera.freeze(); updateRaisedPose(); paperMesh.material = new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false,color:0xfffcf5,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}); paperMesh.material.needsUpdate = true; }
  motion = { target, from: clonePose(paper), to: clonePose(target === 'raised' ? raised : home), start: performance.now(), duration: reduced.matches ? 0 : target === 'raised' ? 950 : 720 };
  state = target === 'raised' ? 'raising' : 'lowering';
  syncViewControls();
  $('pickup').hidden = true; $('putdown').hidden = false;
  $('putdown').disabled = state === 'lowering'; $('keyboard-items').hidden = true;
  $('hint').textContent = target === 'raised' ? '正在拿起纸张…' : '正在放回原位…';
}

function canInteractWithRoom() {
  return state === 'rest' || state === 'about';
}

function pointerHit(event) {
  if (!paper || !(canInteractWithRoom() || state === 'raised')) return null;
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX - r.left) / r.width * 2 - 1, 1 - (event.clientY - r.top) / r.height * 2), camera);
  const hit = raycaster.intersectObject(paper, true)[0];
  if (!hit) return null;
  if (canInteractWithRoom()) { const front = roomHit(event); if (front && front.distance < hit.distance - .003 && !paper.getObjectById(front.object.id)) return null; }
  return { hit, region: hit.uv ? surface.hit(hit.uv.x * PAGE.width, hit.uv.y * PAGE.height) : null };
}

canvas.addEventListener('pointermove', event => {
  if(state==='card') {canvas.style.cursor=businessCard.emailHit(roomHit(event))?'pointer':'default';return;}
  if (!surface || eyeCamera?.drag?.moved) return; lastPointer = { clientX: event.clientX, clientY: event.clientY };
  const result = pointerHit(event);
  const item = state === 'raised' && result?.region?.kind === 'item' ? result.region.id : null;
  surface.hover(item);
  const hit = canInteractWithRoom() ? roomHit(event) : null;
  const focus = focusId(hit) || practicals?.fixture(hit) || (state === 'rest' && notebook?.contains(hit?.object));
  canvas.style.cursor = item || (canInteractWithRoom() && result) || focus ? 'pointer' : canInteractWithRoom() ? 'grab' : 'default';
});
canvas.addEventListener('pointerleave', () => { lastPointer = null; surface?.hover(null); });
canvas.addEventListener('click', event => {
  if (eyeCamera?.suppressClick) { eyeCamera.suppressClick = false; return; }
  if(state==='card') {if(businessCard.emailHit(roomHit(event))) copyCardEmail();return;}
  const result = pointerHit(event);
  if (canInteractWithRoom()) {
    if (result) return runSceneAction(approachWork);
    const hit = roomHit(event);
    if(businessCard?.contains(hit?.object)) return runSceneAction(openCard);
    if (notebook?.contains(hit?.object)) {
      if (state === 'rest') openAbout();
      return;
    }
    if (practicals.toggle(hit)) {
      refreshReflections();
      return;
    }
    if (state === 'rest' && tapeDeck?.click(hit?.object, eyeCamera)) {
      syncViewControls();
      return;
    }
    const id = focusId(hit);
    if (id === 'E05') return runSceneAction(openPosts);
    if (id === 'E06') return runSceneAction(openLinks);
    if (id) runSceneAction(() => eyeCamera.focus(id));
    return;
  }
  if (!result) return;
  if (result.region?.kind === 'item') return select(result.region.id);
  if (result.region?.kind === 'static') return;
  transition('rest');
});
$('pickup').addEventListener('click', approachWork);
$('putdown').addEventListener('click', () => transition('rest'));
closeAboutButton.addEventListener('click', closeAbout);
$('close-posts').addEventListener('click', () => leavePosts(true));
$('close-links').addEventListener('click', () => leaveLinks(true));
$('close-card').addEventListener('click',closeCard);
$('views').addEventListener('change', e => e.target.value ? eyeCamera.focus(e.target.value) : eyeCamera.reset());
$('step-left').onclick=()=>eyeCamera.stepSide(-1);
$('step-right').onclick=()=>eyeCamera.stepSide(1);
window.addEventListener('keydown', event => {
  if (state === 'loading' || state === 'error') return;
  if(['approaching-card','raising-card','card','lowering-card'].includes(state)) {
    if(event.key==='Escape') {closeCard();event.preventDefault();}
    if(state==='card'&&event.key.toLowerCase()==='c') {copyCardEmail();event.preventDefault();}
    return;
  }
  if (['approaching-links', 'links'].includes(state)) {
    if (event.key === 'Escape') { leaveLinks(true); event.preventDefault(); }
    return;
  }
  if (['approaching-posts', 'posts'].includes(state)) {
    if (event.key === 'Escape') { leavePosts(true); event.preventDefault(); }
    return;
  }
  if (state === 'approaching-work' && event.key === 'Escape') {
    runSceneAction(() => {
      hud.update({ activeSection: null });
      $('pickup').hidden = false;
      eyeCamera.reset();
    });
    event.preventDefault();
    return;
  }
  if (state === 'about') {
    if (event.key === 'Escape') closeAbout();
    return;
  }
  if (event.target.closest?.('.site-header')) return;
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
  if(state==='approaching-card'&&!eyeCamera.flight) {
    eyeCamera.freeze();businessCard.raise(camera,reduced.matches,now);state='raising-card';
  }
  if(['raising-card','lowering-card'].includes(state)) {
    const result=businessCard.frame(now);
    if(result==='card') {state='card';syncViewControls();}
    if(result==='rest') finishCard();
  }
  if (state === 'approaching-work' && !eyeCamera.flight) {
    state = 'rest';
    transition('raised');
  }
  if (state === 'approaching-posts' && !eyeCamera.flight) {
    if (postsLeg === 'walking') {
      postsLeg = 'sitting';
      moveToPosts([2.10, .93, 1.13], 700);
    } else {
      eyeCamera.freeze();
      state = 'posts';
      postsMonitor.show();
      syncViewControls();
    }
  }
  if (state === 'approaching-links' && !eyeCamera.flight) {
    if (linksLeg === 'walking') {
      linksLeg = 'sitting';
      moveToLinks(linksScreen.near, 700);
    } else {
      eyeCamera.freeze();
      state = 'links';
      linksScreen.show();
      syncViewControls();
    }
  }
  linksScreen?.frame();
  postsMonitor?.frame(canInteractWithRoom());
  updateAbout(now);
  if (pendingSceneAction && state === 'about' && !aboutMotion) closeAbout();
  if (pendingSceneAction && state === 'rest') {
    const action = pendingSceneAction; pendingSceneAction = null; action();
  }
  tapeDeck?.update(now);
  updateSteam?.(now);
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
        if (aboutAfterPaper) {
          aboutAfterPaper = false;
          openAbout();
        }
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
  await loadingPhase('LOADING THE ROOM', .06);
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
  const loader = new GLTFLoader();
  const [gltf, bayPlant, contactMap, steamAtlas, notebookModel] = await Promise.all([
    loader.loadAsync('./model/room-river-facades.glb?v=1fb9b63b', event => assetProgress(0, event)),
    loader.loadAsync('./model/window-plant.glb?v=scan1', event => assetProgress(1, event)),
    new THREE.TextureLoader().loadAsync('./model/textures/desk-ceiling-contacts.png?v=desk-clearance'),
    new THREE.TextureLoader().loadAsync('./model/textures/coffee-steam.png'),
    loader.loadAsync('./model/about-notebook.glb?v=sewn-spread', event => assetProgress(4, event)),
  ].map((task, index) => task.then(asset => { loadedAsset(index); return asset; })));
  await loadingPhase('ARRANGING THE STUDY', .64);
  // These two receivers use the original UV atlas, baked at the new placements.
  contactMap.channel = 1;
  contactMap.flipY = false;
  for (const name of ['T01', 'CEILING']) {
    gltf.scene.getObjectByName(name).traverse(mesh => {
      if (!mesh.isMesh || !mesh.material.aoMap) return;
      mesh.material = mesh.material.clone();
      mesh.material.aoMap = contactMap;
    });
  }
  const planter = gltf.scene.getObjectByName('S02-PLANT');
  const soilAndLeaves = new Set(['wooddark', 'leaf', 'leafdark', 'leaflight']);
  for (const mesh of [...planter.children]) {
    if (soilAndLeaves.has(mesh.material?.name)) planter.remove(mesh);
  }
  bayPlant.scene.position.set(4.98, -.33, 1.015);
  bayPlant.scene.rotation.z = 1.6;
  bayPlant.scene.traverse(mesh => {
    if (mesh.material?.name !== 'potted_plant_02_leaves') return;
    // The scan uses a cutout atlas. Write depth for each curled blade.
    mesh.material.transparent = false;
    mesh.material.depthWrite = true;
    mesh.material.alphaTest = .45;
  });
  planter.add(bayPlant.scene);
  // Move the album and its hinged cover together down the existing incline.
  const albumShift = new THREE.Vector3(.855197831554018, 0, -.5183017160933442).multiplyScalar(.06);
  for (const name of ['P01', 'P01-COVER']) {
    const albumPart = gltf.scene.getObjectByName(name);
    albumPart.position.add(albumShift);
    const origin = albumPart.userData.motion?.origin_xyz_m;
    if (origin) albumPart.userData.motion.origin_xyz_m = new THREE.Vector3(...origin).add(albumShift).toArray();
  }
  gltf.scene.scale.x = -1;
  placeLaptop(gltf.scene, FOCUS_VIEWS.find(view => view.id === 'E06'));
  await Promise.all([installSeatTextiles(gltf.scene), installDeskDetails(gltf.scene), installGamingLaptop(gltf.scene)]);
  businessCard=await installBusinessCard(gltf.scene);
  await installBenchFinish(gltf.scene);
  practicals = finishShadows(gltf.scene);
  updateSteam = addHotCoffee(gltf.scene.getObjectByName('DESK-MUG'), steamAtlas, reduced);
  await loadingPhase('PREPARING THE NIGHT VIEW', .77);
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
      syncHUD();
    };
  } else {
    updateWater=finishWater(gltf.scene,reduced);
  }
  await loadingPhase('PREPARING LIGHT & SHADOW', .88);
  const centralLights=[[ceilingBounce,ceilingBounce.intensity]], centralDiffusers=new Set();
  const displays=[];
  gltf.scene.traverse(object=>{
    if(object.isLight && /^Central[ _]/.test(object.name)) centralLights.push([object,object.intensity]);
    if(object.isMesh && object.material.name==='opalglass') centralDiffusers.add(object.material);
    if(object.isMesh && object.material.userData.switchedDisplayGlass){
      const lit=object.material;
      const unlit=new THREE.MeshBasicMaterial({
        map:lit.emissiveMap, color:lit.emissive.clone().multiplyScalar(lit.emissiveIntensity),
        side:lit.side, toneMapped:lit.toneMapped,
      });
      displays.push({mesh:object,lit,unlit});
    }
  });
  const dimmer=$('ceiling-light');
  dimmer.disabled=centralLights.length===0;
  dimmer.onclick=()=>{
    const on=dimmer.getAttribute('aria-pressed')!=='true';
    for(const [light,intensity] of centralLights) light.intensity=on?intensity:0;
    for(const material of centralDiffusers) material.emissiveIntensity=on?1:0;
    for(const {mesh,lit,unlit} of displays) {
      if (!mesh.userData.interactiveDisplay) mesh.material=on?lit:unlit;
    }
    dimmer.setAttribute('aria-pressed',String(on));
    syncHUD();
    refreshReflections();
  };
  notebook = installAboutNotebook(gltf.scene, notebookModel.scene);
  for (const paragraph of aboutCopy) {
    const p = document.createElement('p');
    p.textContent = paragraph;
    $('about-copy').append(p);
  }
  scene.add(gltf.scene); scene.updateMatrixWorld(true);
  await loadScreenFonts();
  postsMonitor = installPostsMonitor(gltf.scene, camera);
  linksScreen = installLinksScreen(gltf.scene, camera);
  tapeDeck = installTapeDeck(gltf.scene, reduced, canvas.dataset.infiforceVideo);
  updateCabinetReflection=cabinetReflections(renderer,scene,gltf.scene,toYUp,practicals.mask | 8);
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
  home.position.add(toYUp([notebookShift, 0, 0]));
  applyPose(home);
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
  addInteriorSoftness(scene, camera);
  if (new URLSearchParams(location.search).get('study') === 'cuboid') {
    const {addCuboid} = await import('./cuboid-study/cuboid.js');
    window.cuboidMeasurement = addCuboid(scene, camera, gltf.scene);
  }
  for (const v of FOCUS_VIEWS) { const o=document.createElement('option'); o.value=v.id; o.textContent=v.label; $('views').append(o); }
  resize(); syncAccessible();
  await loadingPhase('PREPARING LIGHT & SHADOW', .94);
  aliveCity?.frame(performance.now());
  renderer.render(scene, camera);
  await revealStudy();
  state = 'rest'; syncViewControls(); $('pickup').disabled = false;
  aboutButton.disabled = false;
  if (new URLSearchParams(location.search).get('view') === 'window') eyeCamera.focus('WINDOW');
  requestAnimationFrame(tick);
  // Read-only diagnostics for reproducible native pointer tests; no test-only state transitions.
  window.paperReview = {
    snapshot: () => ({ state, cardCenter:businessCard?.center().toArray(), tapeState: tapeDeck?.state, selected: surface.selected, hovered: surface.hovered, contentBottom: surface.contentBottom,
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
    cardPoint:(u,v)=>businessCard.point(camera,u,v),
  };
  const initialSection = new URLSearchParams(location.search).get('section');
  if (['about', 'work', 'lab', 'posts', 'links'].includes(initialSection)) {
    document.querySelector('[data-section="' + initialSection + '"]').click();
  }

}

init().catch(error => { console.error(error); state = 'error'; loadingFailed(); });
