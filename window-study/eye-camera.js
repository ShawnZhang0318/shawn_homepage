import * as THREE from 'three';

const rad = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const wrap = value => Math.atan2(Math.sin(value), Math.cos(value));
const smooth = t => t*t*(3-2*t);
// Local interaction tuning, not an anatomical measurement or a claimed reference-site limit.
export const EYE_LIMITS = { yaw: 70, pitchUp: 25, pitchDown: 30, zoomIn: 2.4, zoomOut: .5, clearance: .22 };
export const FOCUS_VIEWS = [
  { id: 'WINDOW', label: '窗边', eye: [4.8, 1.95, 1.60], target: [5.78, .10, 1.35], clickPoint: [5.8, -.25, 1.65],
    groups: ['W1', 'W2', 'W3', 'FA', 'FB', 'FC', 'FD'], prefixes: ['S01', 'S02'] },
  { id: 'BOOKCASE', label: '书柜', eye: [2.1, 2.25, 1.75], target: [.30, 1.30, 1.55], clickPoint: [.45, 1.45, 1.90],
    groups: ['A01', 'A02', 'A03', 'A04', 'A05', 'M01', 'M02', 'M03', 'M04', 'M05'],
    prefixes: ['A01-', 'A02-', 'A03-', 'BOOK-', 'AWARD-', 'M03-'] },
  { id: 'E05', label: '桌面电脑', eye: [2.10, 1.55, 1.65], target: [2.10, .36, 1.04] },
  { id: 'E06', label: '笔记本电脑', eye: [2.93, 1.40, 1.60], target: [2.93, .32, .92] },
  { id: 'E01', label: 'VS Code 屏幕', eye: [2.135, 1.75, 1.85], target: [2.135, .09, 1.96] },
  { id: 'E02', label: 'RViz 屏幕', eye: [2.965, 1.75, 1.85], target: [2.965, .09, 1.96] },
  { id: 'E03', label: 'SolidWorks 屏幕', eye: [2.135, 1.75, 1.75], target: [2.135, .09, 1.47] },
  { id: 'E04', label: '数据分析屏幕', eye: [2.965, 1.75, 1.75], target: [2.965, .09, 1.47] },
];

export class EyeCamera {
  constructor(camera, canvas, meshes, toWorld, reduced, changed, windowStation) {
    Object.assign(this, { camera, canvas, meshes, toWorld, reduced, changed, windowStation });
    this.home = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
    this.euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    this.yaw = this.euler.y; this.pitch = this.euler.x;
    this.wantedYaw = this.yaw; this.wantedPitch = this.pitch;
    this.baseYaw = this.yaw; this.basePitch = this.pitch;
    this.station = camera.position.clone(); this.destination = camera.position.clone();
    this.zoom = 0; this.focusId = null; this.flight = null; this.enabled = true;
    this.drag = null; this.suppressClick = false; this.lastTime = null; this.blocked = false;
    this.ray = new THREE.Raycaster();
    this.sideOffset=0;
    this.wire();
  }
  wire() {
    this.canvas.addEventListener('pointerdown', e => {
      if (!this.enabled || !e.isPrimary || e.button !== 0) return;
      this.stop(); this.suppressClick = false;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: this.wantedYaw, pitch: this.wantedPitch, moved: false };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', e => {
      const d = this.drag; if (!d || d.id !== e.pointerId || !this.enabled) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.hypot(dx, dy) > 6) d.moved = true;
      if (!d.moved) return;
      this.suppressClick = true;
      const sensitivity = rad(100) / Math.max(500, this.canvas.clientWidth);
      const atWindow = this.focusId === 'WINDOW';
      const yawLimit = rad(EYE_LIMITS.yaw);
      this.wantedYaw = this.baseYaw + clamp(wrap(d.yaw + dx * sensitivity - this.baseYaw), -yawLimit, yawLimit);
      this.wantedPitch = clamp(d.pitch + dy * sensitivity,
        Math.max(rad(-65), this.basePitch - rad(atWindow ? 6 : EYE_LIMITS.pitchDown)),
        Math.min(rad(45), this.basePitch + rad(atWindow ? 6 : EYE_LIMITS.pitchUp)));
      this.canvas.style.cursor = 'grabbing'; e.preventDefault();
    });
    const release = e => {
      if (this.drag?.id !== e.pointerId) return;
      this.suppressClick ||= this.drag.moved || e.type !== 'pointerup';
      this.drag = null;
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('lostpointercapture', e => { if (this.drag?.id === e.pointerId) { this.drag = null; this.suppressClick = true; } });
    window.addEventListener('blur', () => { this.drag = null; this.suppressClick = true; });
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault(); if (!this.enabled) return;
      this.stopFlight();
      const amount = clamp(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1), -240, 240) * -.0018;
      const nextZoom = this.focusId==='WINDOW' ? clamp(this.zoom+amount,-.30,.40) : clamp(this.zoom + amount, -EYE_LIMITS.zoomOut, EYE_LIMITS.zoomIn);
      const forward = this.camera.getWorldDirection(new THREE.Vector3());
      const requested = this.destination.clone().addScaledVector(forward, nextZoom - this.zoom);
      this.destination.copy(this.safeMove(this.camera.position, requested));
      this.zoom = nextZoom + this.destination.clone().sub(requested).dot(forward); this.changed();
    }, { passive: false });
  }
  stopFlight() {
    if (!this.flight) return;
    this.flight = null; this.destination.copy(this.camera.position); this.station.copy(this.camera.position); this.zoom = 0;
    this.baseYaw = this.yaw; this.basePitch = this.pitch;
  }
  stop() {
    this.stopFlight(); this.destination.copy(this.camera.position);
    this.wantedYaw = this.yaw; this.wantedPitch = this.pitch;
  }
  freeze() { this.stop(); this.enabled = false; this.drag = null; }
  stepSide(sign) {
    if(this.flight || !this.enabled || this.focusId!=='WINDOW')return;
    const right=new THREE.Vector3(-.8,0,-.6);
    const next=clamp(this.sideOffset+sign*.20,-.40,.40);
    const old=this.destination.clone();
    this.destination.copy(this.safeMove(this.camera.position,old.clone().addScaledVector(right,next-this.sideOffset)));
    this.sideOffset+=this.destination.clone().sub(old).dot(right);
  }
  inspectionDistance() {
    this.ray.set(this.camera.position, this.camera.getWorldDirection(new THREE.Vector3()));
    this.ray.near = 0; this.ray.far = 1.5;
    const hit = this.ray.intersectObjects(this.meshes, false)[0];
    // Keep the held sheet in front of a close monitor while retaining its apparent size.
    return hit ? clamp(hit.distance * .45, .12, .49) : .49;
  }
  safeMove(from, to) {
    const delta = to.clone().sub(from), length = delta.length();
    if (length < 1e-7) return to.clone();
    const forward = delta.normalize();
    let right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < .001) right.set(1, 0, 0); else right.normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    let allowed = length;
    // Conservative nine-ray eye-clearance bundle against actual visible meshes.
    // This guards navigation; it is not a full character-physics solver.
    for (const [x, y] of [[0,0],[-1,0],[1,0],[0,1],[0,-1],[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7]]) {
      const origin = from.clone().addScaledVector(right, x * .11).addScaledVector(up, y * .11);
      this.ray.set(origin, forward); this.ray.near = 0; this.ray.far = length + EYE_LIMITS.clearance;
      const hit = this.ray.intersectObjects(this.meshes, false)[0];
      if (hit) allowed = Math.min(allowed, Math.max(0, hit.distance - EYE_LIMITS.clearance));
    }
    this.blocked = allowed < length - 1e-5;
    return from.clone().addScaledVector(forward, allowed);
  }
  begin(position, quaternion, id) {
    if (!this.enabled) return;
    this.stop(); this.focusId = id; this.zoom = 0;this.sideOffset=0;
    const to = this.safeMove(this.camera.position, position);
    this.flight = { start: performance.now(), duration: this.reduced.matches ? 0 : id==='WINDOW'?3000:1000,
      from: this.camera.position.clone(), to, qFrom: this.camera.quaternion.clone(), qTo: quaternion.clone() };
    this.changed();
  }
  focus(id) {
    const view = (id === 'WINDOW' && this.windowStation) || FOCUS_VIEWS.find(v => v.id === id);
    if (!view) return;
    const eye = this.toWorld(view.eye), target = this.toWorld(view.target);
    const actual = this.safeMove(this.camera.position, eye);
    if (id === 'WINDOW' && !this.windowStation) {
      // Preserve the gaze while walking to a visible window. From elsewhere
      // use the room's original viewing bearing for the window station.
      const pane = this.toWorld(view.clickPoint).project(this.camera);
      const visible = pane.z > -1 && pane.z < 1 && Math.abs(pane.x) <= 1 && Math.abs(pane.y) <= 1;
      this.begin(actual, visible ? this.camera.quaternion : this.home.quaternion, id);
      return;
    }
    const matrix = new THREE.Matrix4().lookAt(actual, target, new THREE.Vector3(0, 1, 0));
    this.begin(actual, new THREE.Quaternion().setFromRotationMatrix(matrix), id);
  }
  reset() { this.begin(this.home.position, this.home.quaternion, null); }
  update(now) {
    const dt = this.lastTime === null ? 1 / 60 : Math.min(.05, (now - this.lastTime) / 1000); this.lastTime = now;
    if (!this.enabled) return;
    if (this.flight) {
      const f = this.flight, t = f.duration ? clamp((now - f.start) / f.duration, 0, 1) : 1;
      const progress = smooth(t);
      this.camera.position.lerpVectors(f.from, f.to, progress);
      this.camera.quaternion.slerpQuaternions(f.qFrom, f.qTo, progress);
      this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ'); this.yaw = this.euler.y; this.pitch = this.euler.x;
      this.wantedYaw = this.yaw; this.wantedPitch = this.pitch;
      if (t === 1) {
        this.flight = null; this.station.copy(this.camera.position); this.destination.copy(this.camera.position);
        this.baseYaw = this.yaw; this.basePitch = this.pitch;
        this.changed();
      }
    } else {
      const a = this.reduced.matches ? 1 : 1 - Math.exp(-16 * dt);
      this.yaw += wrap(this.wantedYaw - this.yaw) * a; this.pitch += (this.wantedPitch - this.pitch) * a;
      if (Math.abs(wrap(this.wantedYaw - this.yaw)) < 1e-6) this.yaw = this.wantedYaw;
      if (Math.abs(this.wantedPitch - this.pitch) < 1e-6) this.pitch = this.wantedPitch;
      this.camera.quaternion.setFromEuler(this.euler.set(this.pitch, this.yaw, 0, 'YXZ'));
      this.camera.position.lerp(this.destination, a);
      if (this.camera.position.distanceTo(this.destination) < 1e-6) this.camera.position.copy(this.destination);
    }
    this.camera.updateMatrixWorld();
  }
  snapshot() {
    return { position: this.camera.position.toArray(), quaternion: this.camera.quaternion.toArray(),
      focus: this.focusId, flying: !!this.flight, enabled: this.enabled, zoom: this.zoom,lens:this.camera.zoom,sideOffset:this.sideOffset,
      yawOffsetDegrees: THREE.MathUtils.radToDeg(wrap(this.yaw - this.baseYaw)),
      pitchOffsetDegrees: THREE.MathUtils.radToDeg(this.pitch - this.basePitch), blocked: this.blocked,
      limits: EYE_LIMITS, home: { position: this.home.position.toArray(), quaternion: this.home.quaternion.toArray() } };
  }
}
