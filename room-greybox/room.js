import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Room coordinates follow docs/ROOM_DESIGN_SPEC.md: X right, Y into the room,
// Z up. The renderer maps that to Three.js (X, Y-up, Z) = (spec.X, spec.Z, spec.Y).
const scene = new THREE.Scene();
scene.background = new THREE.Color("#091522");
scene.fog = new THREE.Fog("#091522", 13, 25);

const canvas = document.querySelector("#scene");
const stage = document.querySelector(".stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
camera.up.set(0, 1, 0);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 4.5;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(3, 1.15, 2.35);

const MAT = {
  wall: new THREE.MeshStandardMaterial({ color: "#0a3f9e", roughness: 0.88 }),
  sideWall: new THREE.MeshStandardMaterial({ color: "#10284a", roughness: 0.92 }),
  floor: new THREE.MeshStandardMaterial({ color: "#343941", roughness: 0.86 }),
  wood: new THREE.MeshStandardMaterial({ color: "#76563c", roughness: 0.76 }),
  woodEdge: new THREE.MeshStandardMaterial({ color: "#553d2d", roughness: 0.83 }),
  black: new THREE.MeshStandardMaterial({ color: "#111820", roughness: 0.66 }),
  dark: new THREE.MeshStandardMaterial({ color: "#202a36", roughness: 0.7 }),
  steel: new THREE.MeshStandardMaterial({ color: "#9baab9", metalness: 0.58, roughness: 0.35 }),
  white: new THREE.MeshStandardMaterial({ color: "#e9edf3", roughness: 0.55 }),
  gold: new THREE.MeshStandardMaterial({ color: "#c9a24c", metalness: 0.55, roughness: 0.32 }),
  glass: new THREE.MeshPhysicalMaterial({ color: "#9ab8d4", roughness: 0.16, metalness: 0.08, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
};

scene.add(new THREE.HemisphereLight("#dbeaff", "#172032", 1.35));
const ambient = new THREE.AmbientLight("#7894b9", 0.42);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight("#fff1d6", 2.0);
keyLight.position.set(-3.5, 7, 5.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1536, 1536);
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 8;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -4;
keyLight.shadow.bias = -0.0003;
scene.add(keyLight);

const selectable = new Map();
const hitMeshes = [];
const lampLights = new Map();
let selectionHelper = null;

const SPEC = {
  room: { w: 6, d: 4.8, h: 2.8 },
  desk: { min: [1, 0.55, 0], max: [4.2, 1.4, 0.74] },
  wallScreens: [
    { id: "wall-screen-code", name: "墙屏 01 · CODE", min: [1.92, 0, 1.77], max: [2.47, 0.08, 2.11], tone: "#58c7a7", kind: "code" },
    { id: "wall-screen-terminal", name: "墙屏 02 · TERMINAL", min: [2.57, 0, 1.77], max: [3.12, 0.08, 2.11], tone: "#66a9ff", kind: "terminal" },
    { id: "wall-screen-robotics", name: "墙屏 03 · ROBOTICS", min: [1.92, 0, 1.31], max: [2.47, 0.08, 1.65], tone: "#60d3cb", kind: "robotics" },
    { id: "wall-screen-cad-viz", name: "墙屏 04 · CAD / VIZ", min: [2.57, 0, 1.31], max: [3.12, 0.08, 1.65], tone: "#76a9ff", kind: "cad" },
  ],
};

const toWorld = (x, y, z) => new THREE.Vector3(x, z, y);
const centerOf = (min, max) => [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
const sizeOf = (min, max) => [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
const worldBox = (min, max) => {
  const c = centerOf(min, max), s = sizeOf(min, max);
  return { center: toWorld(...c), size: new THREE.Vector3(s[0], s[2], s[1]) };
};

function register(id, name, bounds, root) {
  const record = { id, name, bounds, root };
  selectable.set(id, record);
  root.userData.objectId = id;
  root.userData.objectName = name;
  root.traverse((child) => {
    if (child.isMesh) {
      child.userData.objectId = id;
      child.userData.objectName = name;
      hitMeshes.push(child);
    }
  });
  const option = document.createElement("option");
  option.value = id;
  option.textContent = name;
  document.querySelector("#object-picker").append(option);
  return root;
}

function addGroup(id, name, bounds, parent = scene) {
  const group = new THREE.Group();
  group.name = id;
  parent.add(group);
  return register(id, name, bounds, group);
}

function addBox(parent, name, position, size, material, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, name, position, radiusTop, radiusBottom, height, material, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCanvasPlane(parent, canvasTexture, position, width, height, rotation = null, materialOptions = {}) {
  const material = new THREE.MeshBasicMaterial({ map: canvasTexture, side: THREE.DoubleSide, toneMapped: false, ...materialOptions });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  plane.position.set(...position);
  if (rotation) plane.rotation.set(...rotation);
  parent.add(plane);
  return plane;
}

function screenTexture(kind, accent = "#65d3bc") {
  const c = document.createElement("canvas"); c.width = 640; c.height = 360;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 640, 360);
  grad.addColorStop(0, "#06111e"); grad.addColorStop(1, "#0b2034");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 640, 360);
  ctx.fillStyle = "#10283d"; ctx.fillRect(0, 0, 640, 27);
  ["#ec6a67", "#e4b65a", "#70c994"].forEach((color, i) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(16 + i * 15, 14, 4, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = "#91a8bd"; ctx.font = "600 11px Segoe UI, sans-serif";
  ctx.fillText(({ code: "ENGINEERING / EDITOR", terminal: "SYSTEM TERMINAL", robotics: "ROBOTICS · TELEMETRY", cad: "CAD / DATA VISUALIZATION", desktop: "ROBOT ARM · SIMULATION", laptop: "KNOWLEDGE ATLAS · PREVIEW", crt: "MEDIA ARCHIVE · READY" })[kind] || "ENGINEERING DISPLAY", 56, 18);
  ctx.strokeStyle = "#1b3a52"; ctx.lineWidth = 1;
  for (let x = 0; x < 640; x += 32) { ctx.beginPath(); ctx.moveTo(x, 28); ctx.lineTo(x, 360); ctx.stroke(); }
  for (let y = 28; y < 360; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke(); }
  ctx.fillStyle = accent;
  if (kind === "terminal") {
    ctx.font = "13px Consolas, monospace";
    ["$ ./run-simulation --mode=preview", "loading modules...", "[ ready ] robot arm telemetry", "joints: 04   safety: nominal", "$ _"].forEach((line, i) => ctx.fillText(line, 28, 66 + i * 30));
    ctx.fillStyle = "#77d8b8"; ctx.fillRect(27, 217, 540, 1);
    ctx.fillStyle = "#617a91"; ctx.font = "11px Consolas, monospace";
    for (let i = 0; i < 5; i++) ctx.fillText(`00:${String(14 + i * 7).padStart(2, "0")}  status heartbeat stable`, 30, 247 + i * 20);
  } else if (kind === "robotics") {
    ctx.strokeStyle = accent; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(140, 270); ctx.lineTo(215, 197); ctx.lineTo(283, 227); ctx.lineTo(345, 132); ctx.lineTo(414, 166); ctx.stroke();
    [[140,270],[215,197],[283,227],[345,132],[414,166]].forEach(([x,y]) => { ctx.fillStyle = "#071623"; ctx.beginPath(); ctx.arc(x,y,12,0,Math.PI*2); ctx.fill(); ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.stroke(); });
    ctx.fillStyle = "#091826"; ctx.fillRect(455, 55, 150, 253);
    ctx.fillStyle = "#a8bbce"; ctx.font = "11px Segoe UI"; ctx.fillText("JOINT TELEMETRY", 468, 78);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = "#1e3a51"; ctx.fillRect(468, 99 + i * 31, 118, 8); ctx.fillStyle = accent; ctx.fillRect(468, 99 + i * 31, 44 + ((i * 17) % 62), 8); }
  } else if (kind === "cad" || kind === "desktop") {
    ctx.strokeStyle = "#274963"; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(64 + i * 58, 60); ctx.lineTo(64 + i * 58, 310); ctx.stroke(); }
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(48, 74 + i * 47); ctx.lineTo(592, 74 + i * 47); ctx.stroke(); }
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(75, 260); ctx.lineTo(150, 217); ctx.lineTo(230, 234); ctx.lineTo(308, 152); ctx.lineTo(396, 178); ctx.lineTo(482, 113); ctx.lineTo(562, 137); ctx.stroke();
    ctx.strokeStyle = "#a4bfd4"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(310, 190, 50, .1, 5.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(310, 190, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#122a40"; ctx.fillRect(28, 50, 104, 280);
    ctx.fillStyle = "#8ca7bd"; ctx.font = "11px Consolas, monospace"; ctx.fillText("SCENE", 42, 73);
    ["BASE", "LINK A", "LINK B", "JOINT", "TOOL"].forEach((t, i) => ctx.fillText(`▸ ${t}`, 42, 105 + i * 28));
  } else if (kind === "laptop") {
    ctx.fillStyle = "#071a2a"; ctx.fillRect(26, 46, 588, 286);
    ctx.strokeStyle = "#183953"; ctx.lineWidth = 1;
    for (let r = 0; r < 5; r++) { ctx.beginPath(); ctx.ellipse(320, 190, 70 + r * 44, 24 + r * 27, -.13, 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < 9; i++) {
      const a = i * .72, x = 320 + Math.cos(a) * (92 + (i % 3) * 45), y = 190 + Math.sin(a) * (36 + (i % 3) * 28);
      ctx.fillStyle = i % 3 === 0 ? "#6bdac1" : (i % 3 === 1 ? "#74a9ff" : "#f0c875");
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(x, y, i % 2 ? 4 : 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.fillStyle = "#e5f1fa"; ctx.font = "600 14px Segoe UI"; ctx.fillText("PERSONAL KNOWLEDGE ATLAS", 44, 72);
    ctx.fillStyle = "#87a5c1"; ctx.font = "10px Segoe UI"; ctx.fillText("CONTENT NODES · PLACEHOLDER", 44, 91);
  } else if (kind === "crt") {
    ctx.fillStyle = "#050d16"; ctx.fillRect(18, 43, 604, 300);
    ctx.fillStyle = accent; ctx.font = "600 20px Segoe UI"; ctx.fillText("VHS ARCHIVE", 42, 94);
    ctx.fillStyle = "#acc0d1"; ctx.font = "14px Segoe UI"; ctx.fillText("Select a tape to preview its content module", 42, 132);
    ctx.fillStyle = "#1c3851"; ctx.fillRect(42, 158, 520, 1);
    ["TAPE-01", "TAPE-02", "TAPE-03", "TAPE-04"].forEach((t, i) => { ctx.fillStyle = "#162c40"; ctx.fillRect(42 + i * 138, 184, 120, 95); ctx.fillStyle = accent; ctx.fillRect(42 + i * 138, 184, 120, 3); ctx.fillStyle = "#b5c6d5"; ctx.font = "12px Consolas"; ctx.fillText(t, 53 + i * 138, 221); ctx.fillStyle = "#839ab0"; ctx.font = "10px Segoe UI"; ctx.fillText("[待提供]", 53 + i * 138, 244); });
  } else {
    ctx.fillStyle = "#bdd3e4"; ctx.font = "13px Consolas, monospace";
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 3 === 0 ? accent : (i % 3 === 1 ? "#75aaff" : "#b7c5d1");
      ctx.fillRect(24, 52 + i * 28, 35 + (i * 23) % 54, 4);
      ctx.fillStyle = "#7892a8"; ctx.fillRect(76, 52 + i * 28, 270 + (i * 41) % 190, 4);
      ctx.fillStyle = "#b7c5d1"; ctx.fillRect(80 + (i * 17) % 110, 61 + i * 28, 180 + (i * 31) % 160, 3);
    }
    ctx.fillStyle = "#1b3851"; ctx.fillRect(488, 50, 126, 272);
    ctx.fillStyle = accent; ctx.font = "11px Segoe UI"; ctx.fillText("FILES", 501, 71);
    ["src", "scene", "content", "tests", "assets", "docs"].forEach((t,i)=>{ctx.fillStyle="#9db3c6";ctx.font="10px Consolas";ctx.fillText(`▸ ${t}`,501,96+i*23);});
  }
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const SCREEN_TEXTURES = {
  code: screenTexture("code", "#65d7b1"), terminal: screenTexture("terminal", "#67aaff"),
  robotics: screenTexture("robotics", "#65d7b1"), cad: screenTexture("cad", "#73aaff"),
  desktop: screenTexture("desktop", "#7ac9e6"), laptop: screenTexture("laptop", "#6cdbbd"),
  crt: screenTexture("crt", "#edb96c"),
};

// Room shell: open front and open ceiling keep every object inspectable.
addBox(scene, "floor slab", [3, -0.07, 2.4], [6.12, 0.14, 4.92], MAT.floor);
addBox(scene, "Chelsea Klein Blue back wall", [3, 1.4, -0.06], [6.12, 2.8, 0.12], MAT.wall);
addBox(scene, "left side wall", [-0.06, 1.4, 2.4], [0.12, 2.8, 4.92], MAT.sideWall);
// Right wall built around the exact approved window opening: spec Y .25–1.75, Z 1.05–2.45.
addBox(scene, "right wall rear pier", [6.06, 1.4, 0.125], [0.12, 2.8, 0.25], MAT.sideWall);
addBox(scene, "right wall front pier", [6.06, 1.4, 3.275], [0.12, 2.8, 3.05], MAT.sideWall);
addBox(scene, "right wall sill band", [6.06, 0.525, 1.0], [0.12, 1.05, 1.5], MAT.sideWall);
addBox(scene, "right wall lintel band", [6.06, 2.625, 1.0], [0.12, 0.35, 1.5], MAT.sideWall);
// Restrained Chelsea stripe/scarf placeholder from the approved elevation, no crest or claim of ownership.
{
  const b = { min: [1.95, 0.01, 2.12], max: [2.73, 0.05, 2.30] };
  const g = addGroup("chelsea-wall-accent", "蓝白球迷围巾占位", b);
  addBox(g, "scarf white cloth", [2.34, 2.21, 0.027], [0.78, 0.18, 0.025], MAT.white);
  for (let i = 0; i < 5; i++) addBox(g, `scarf blue stripe ${i}`, [1.99 + i * 0.15, 2.21, 0.043], [0.035, 0.18, 0.009], new THREE.MeshStandardMaterial({ color: "#0a3f9e", roughness: 0.8 }));
  addBox(g, "scarf fringe left", [2.00, 2.115, 0.03], [0.12, 0.035, 0.02], MAT.white);
  addBox(g, "scarf fringe right", [2.68, 2.115, 0.03], [0.12, 0.035, 0.02], MAT.white);
}

// Main desk: dimensions and bounds are taken from the approved room plan.
{
  const b = SPEC.desk;
  const wb = worldBox(b.min, b.max);
  const g = addGroup("workstation", "工程工作站", b, scene);
  addBox(g, "desk top", [wb.center.x, 0.71, wb.center.z], [3.2, 0.06, 0.85], MAT.wood);
  for (const x of [1.08, 4.12]) for (const depth of [0.62, 1.33]) addBox(g, `desk leg ${x}-${depth}`, [x, 0.35, depth], [0.085, 0.70, 0.085], MAT.woodEdge);
  addBox(g, "desk modesty rail", [2.62, 0.48, 1.34], [2.85, 0.36, 0.07], MAT.woodEdge);

  // The wall monitors are four separate meshes/IDs in the required 2 × 2 arrangement.
  for (const screen of SPEC.wallScreens) {
    const gScreen = addGroup(screen.id, screen.name, { min: screen.min, max: screen.max }, scene);
    const wbS = worldBox(screen.min, screen.max);
    addBox(gScreen, "display bezel", [wbS.center.x, wbS.center.y, 0.0], [wbS.size.x, wbS.size.y, 0.08], MAT.black);
    addCanvasPlane(gScreen, SCREEN_TEXTURES[screen.kind], [wbS.center.x, wbS.center.y, 0.041], wbS.size.x - 0.035, wbS.size.y - 0.035);
    addBox(gScreen, "display status LED", [wbS.center.x, wbS.center.y - wbS.size.y / 2 + 0.011, 0.045], [0.045, 0.006, 0.004], new THREE.MeshBasicMaterial({ color: screen.tone }));
  }

  // Desktop monitor explicitly stays left of the laptop; its screen content is a robot simulation.
  {
    const bMon = { min: [2.4, 0.76, 0.74], max: [3.0, 1.0, 1.30] };
    const gMon = addGroup("desktop-monitor-main", "桌面主显示器 · 机器人 CAD", bMon, scene);
    addBox(gMon, "desktop monitor bezel", [2.7, 1.12, 0.80], [0.60, 0.36, 0.08], MAT.black);
    addCanvasPlane(gMon, SCREEN_TEXTURES.desktop, [2.7, 1.12, 0.842], 0.565, 0.325);
    addBox(gMon, "monitor stand neck", [2.7, 0.88, 0.92], [0.07, 0.22, 0.07], MAT.steel);
    addBox(gMon, "monitor stand foot", [2.7, 0.745, 0.95], [0.30, 0.025, 0.20], MAT.steel);
  }
  // Laptop to the right of the separate desktop monitor; the screen carries a concept atlas only.
  {
    const bLap = { min: [3.1, 0.78, 0.74], max: [3.44, 1.03, 0.97] };
    const gLap = addGroup("laptop", "笔记本 · 知识星图应用", bLap, scene);
    addBox(gLap, "laptop keyboard deck", [3.27, 0.755, 0.905], [0.34, 0.025, 0.25], MAT.steel);
    addBox(gLap, "laptop keyboard", [3.27, 0.770, 0.955], [0.29, 0.008, 0.12], MAT.dark);
    for (let row = 0; row < 4; row++) addBox(gLap, `laptop key row ${row}`, [3.27, 0.776, 0.918 + row * 0.025], [0.27, 0.005, 0.006], MAT.steel);
    addBox(gLap, "laptop display lid", [3.27, 0.87, 0.80], [0.33, 0.20, 0.025], MAT.black);
    const plane = addCanvasPlane(gLap, SCREEN_TEXTURES.laptop, [3.27, 0.87, 0.785], 0.30, 0.17);
    plane.rotation.x = -0.12;
    addBox(gLap, "laptop hinge", [3.27, 0.77, 0.80], [0.28, 0.018, 0.035], MAT.dark);
  }
  // Desktop tower under the right side of the desk.
  {
    const bPC = { min: [3.9, 0.62, 0], max: [4.12, 1.12, 0.55] };
    const gPC = addGroup("desktop-pc", "台式电脑主机", bPC, scene);
    addBox(gPC, "PC tower", [4.01, 0.275, 0.87], [0.22, 0.55, 0.50], MAT.black);
    addBox(gPC, "PC front panel", [4.01, 0.285, 1.123], [0.18, 0.45, 0.006], MAT.dark);
    addBox(gPC, "PC status light", [3.95, 0.49, 1.128], [0.025, 0.012, 0.006], new THREE.MeshBasicMaterial({ color: "#63d8b7" }));
  }
  // Keyboard and mouse.
  {
    const b = { min: [2.25, 1.08, 0.75], max: [2.69, 1.28, 0.80] };
    const g = addGroup("keyboard", "机械键盘", b, scene);
    addBox(g, "keyboard body", [2.47, 0.775, 1.18], [0.44, 0.045, 0.20], MAT.black);
    for (let row = 0; row < 5; row++) addBox(g, `key row ${row}`, [2.47, 0.801, 1.105 + row * 0.036], [0.39, 0.009, 0.012], MAT.steel);
  }
  {
    const b = { min: [2.77, 1.08, 0.75], max: [2.89, 1.20, 0.80] };
    const g = addGroup("mouse", "鼠标", b, scene);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), MAT.dark);
    mesh.scale.set(0.06, 0.025, 0.08); mesh.position.set(2.83, 0.775, 1.14); mesh.castShadow = true; g.add(mesh);
  }
}

function flatTexture(label, tone, subline = "[待提供]") {
  const c = document.createElement("canvas"); c.width = 640; c.height = 400;
  const ctx = c.getContext("2d"); ctx.fillStyle = tone; ctx.fillRect(0, 0, 640, 400);
  ctx.strokeStyle = "#ffffff55"; ctx.lineWidth = 3; ctx.strokeRect(18, 18, 604, 364);
  ctx.fillStyle = "#ffffff"; ctx.font = "700 42px Segoe UI, Microsoft YaHei, sans-serif"; ctx.fillText(label, 42, 86);
  ctx.fillStyle = "#d9e3ed"; ctx.font = "20px Segoe UI, Microsoft YaHei, sans-serif"; ctx.fillText(subline, 42, 128);
  ctx.fillStyle = "#ffffff55"; for (let i = 0; i < 8; i++) ctx.fillRect(42, 170 + i * 24, 260 + (i % 3) * 58, 5);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function addTopDocument(id, name, min, max, label, coverColor, isPaper = false) {
  const b = { min, max };
  const g = addGroup(id, name, b, scene);
  const wb = worldBox(min, max);
  const material = new THREE.MeshStandardMaterial({ color: coverColor, roughness: isPaper ? 0.93 : 0.76 });
  const thickness = Math.max(wb.size.y, 0.006);
  addBox(g, `${label} physical sheet`, [wb.center.x, wb.center.y, wb.center.z], [wb.size.x, thickness, wb.size.z], material);
  const texture = flatTexture(label, isPaper ? "#eee6d6" : coverColor, isPaper ? "[待提供]" : "PERSONAL ARCHIVE · [待提供]");
  const plane = addCanvasPlane(g, texture, [wb.center.x, wb.center.y + thickness / 2 + 0.002, wb.center.z], wb.size.x * 0.94, wb.size.z * 0.94, [-Math.PI / 2, 0, 0]);
  plane.material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
  return g;
}

// Four replaceable desk archive objects remain independent physical modules.
addTopDocument("hobby-binder", "Hobby 球星卡册", [1.2, 1.02, 0.74], [1.52, 1.30, 0.79], "Hobby", "#11151b");
addTopDocument("work-paper", "WORK 经历纸张", [3.47, 1.05, 0.74], [3.767, 1.26, 0.742], "WORK", "#eee6d6", true);
addTopDocument("business-card", "个人名片", [1.65, 1.03, 0.74], [1.74, 1.085, 0.742], "[待提供]", "#172c41");
addTopDocument("cv-envelope", "个人 CV 档案袋 · 三语", [3.82, 1.06, 0.74], [4.18, 1.32, 0.765], "CV · 简中 / EN / 繁中", "#c8b58f");

// Desk lamp: its own clickable ID, point light, and independent smooth intensity transition.
{
  const b = { min: [1.45, 0.76, 0.74], max: [1.63, 0.94, 1.22] };
  const g = addGroup("desk-lamp", "桌灯 · 独立开关", b, scene);
  addCylinder(g, "desk lamp base", [1.54, 0.755, 0.85], 0.09, 0.09, 0.025, MAT.dark);
  const a = toWorld(1.54, 0.85, 0.76), bArm = toWorld(1.54, 0.85, 1.12);
  const v = new THREE.Vector3().subVectors(bArm, a);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, v.length(), 12), MAT.steel);
  arm.position.copy(a).add(bArm).multiplyScalar(0.5); arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), v.normalize()); arm.castShadow = true; g.add(arm);
  addCylinder(g, "desk lamp shade", [1.54, 1.13, 0.80], 0.08, 0.12, 0.12, MAT.gold, 20);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), new THREE.MeshBasicMaterial({ color: "#ffd79b" })); glow.position.set(1.54, 1.065, 0.80); g.add(glow);
  const light = new THREE.PointLight("#ffc982", 4.0, 3.0, 2.0); light.position.set(1.54, 1.04, 0.92); scene.add(light);
  lampLights.set("desk-lamp", { light, target: 4.0, glow, on: true });
}

// Floor lamp on the left side; separate state/light from the desk lamp.
{
  const b = { min: [0.62, 0.95, 0], max: [0.92, 1.25, 2.15] };
  const g = addGroup("floor-lamp", "落地灯 · 独立开关", b, scene);
  addCylinder(g, "floor lamp base", [0.77, 0.035, 1.10], 0.15, 0.15, 0.07, MAT.dark, 20);
  addCylinder(g, "floor lamp pole", [0.77, 1.04, 1.10], 0.022, 0.022, 1.96, MAT.steel, 12);
  addCylinder(g, "floor lamp shade", [0.77, 2.04, 1.10], 0.10, 0.17, 0.22, MAT.white, 20);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: "#ffe2ac" })); glow.position.set(0.77, 1.91, 1.10); g.add(glow);
  const light = new THREE.PointLight("#ffdaa2", 2.7, 4.2, 1.7); light.position.set(0.77, 1.87, 1.10); scene.add(light);
  lampLights.set("floor-lamp", { light, target: 2.7, glow, on: true });
}

// Trophy and medal cabinet at the main-wall right end.
{
  const b = { min: [4.25, 0.08, 0], max: [5.05, 0.50, 1.90] };
  const g = addGroup("trophy-cabinet", "奖杯奖牌展示柜", b, scene);
  const c = worldBox(b.min, b.max).center;
  const w = 0.8, d = 0.42, h = 1.90, x = c.x, z = c.z;
  addBox(g, "cabinet base", [x, 0.055, z], [w, 0.11, d], MAT.woodEdge);
  addBox(g, "cabinet top", [x, 1.86, z], [w, 0.08, d], MAT.woodEdge);
  for (const dx of [-w/2 + 0.035, w/2 - 0.035]) addBox(g, `cabinet stile ${dx}`, [x + dx, 0.96, z], [0.07, 1.82, 0.42], MAT.woodEdge);
  addBox(g, "cabinet glass door", [x, 0.96, z + d/2 - 0.025], [0.65, 1.70, 0.018], MAT.glass, false, false);
  for (const y of [0.52, 1.02, 1.49]) addBox(g, `cabinet shelf ${y}`, [x, y, z], [0.64, 0.035, 0.34], MAT.wood);
  // Generic uninscribed trophy on the lower shelf.
  addCylinder(g, "trophy plinth", [4.49, 0.63, 0.27], 0.11, 0.13, 0.09, MAT.gold);
  addCylinder(g, "trophy stem", [4.49, 0.78, 0.27], 0.045, 0.065, 0.22, MAT.gold);
  addCylinder(g, "trophy bowl", [4.49, 0.92, 0.27], 0.12, 0.065, 0.12, MAT.gold, 20);
  addCylinder(g, "trophy cup rim", [4.49, 0.99, 0.27], 0.125, 0.125, 0.025, MAT.gold, 20);
  for (const dx of [-0.14, 0.14]) {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 8, 16, Math.PI), MAT.gold);
    torus.position.set(4.49 + dx, 0.94, 0.27); torus.rotation.z = dx < 0 ? Math.PI/2 : -Math.PI/2; g.add(torus);
  }
  addBox(g, "medal ribbon", [4.75, 1.25, 0.26], [0.08, 0.19, 0.018], MAT.white);
  const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.025, 24), MAT.gold);
  medal.rotation.x = Math.PI / 2; medal.position.set(4.75, 1.12, 0.28); medal.castShadow = true; g.add(medal);
}

// Independent mechanical workbench and articulated proxy arm.
{
  const b = { min: [4.30, 1.55, 0], max: [5.15, 2.35, 0.74] };
  const g = addGroup("robotic-workbench", "机械臂独立侧台", b, scene);
  addBox(g, "robot side table top", [4.725, 0.71, 1.95], [0.85, 0.06, 0.80], MAT.wood);
  for (const x of [4.37, 5.08]) for (const z of [1.64, 2.26]) addBox(g, `robot table leg ${x}-${z}`, [x, 0.35, z], [0.07, 0.70, 0.07], MAT.woodEdge);
}
{
  const b = { min: [4.45, 1.65, 0.74], max: [5.00, 2.25, 1.85] };
  const g = addGroup("robotic-arm", "机械臂", b, scene);
  addCylinder(g, "robot arm base", [4.73, 0.79, 1.95], 0.25, 0.27, 0.14, MAT.dark, 24);
  addCylinder(g, "robot base ring", [4.73, 0.88, 1.95], 0.22, 0.22, 0.045, MAT.steel, 24);
  const joints = [toWorld(4.73, 1.95, 0.94), toWorld(4.73, 1.84, 1.32), toWorld(4.76, 1.62, 1.52), toWorld(4.72, 1.72, 1.76)];
  function link(name, a, bPt, radius, material) {
    const v = new THREE.Vector3().subVectors(bPt, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.75, radius, v.length(), 16), material);
    mesh.position.copy(a).add(bPt).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), v.clone().normalize()); mesh.castShadow = true; g.add(mesh);
  }
  link("shoulder link", joints[0], joints[1], 0.105, MAT.steel);
  link("forearm link", joints[1], joints[2], 0.085, MAT.dark);
  link("wrist link", joints[2], joints[3], 0.065, MAT.steel);
  for (let i = 0; i < joints.length; i++) {
    const joint = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.14 : 0.105, 16, 12), new THREE.MeshStandardMaterial({ color: i % 2 ? "#2162ae" : "#414d5a", metalness: 0.35, roughness: 0.4 }));
    joint.position.copy(joints[i]); joint.castShadow = true; g.add(joint);
  }
  const p = joints[3];
  link("gripper mount", p, p.clone().add(new THREE.Vector3(0, -0.07, 0.05)), 0.045, MAT.dark);
  const finger1 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.15, 0.045), MAT.steel); finger1.position.copy(p).add(new THREE.Vector3(-0.075, -0.12, 0.075)); finger1.rotation.z = -0.24; g.add(finger1);
  const finger2 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.15, 0.045), MAT.steel); finger2.position.copy(p).add(new THREE.Vector3(0.075, -0.12, 0.075)); finger2.rotation.z = 0.24; g.add(finger2);
}

// Side-wall window and a lightweight layered block city. The opening has no wall collider.
{
  const b = { min: [6.00, 0.25, 1.05], max: [6.12, 1.75, 2.45] };
  const g = addGroup("night-city-window", "夜景城市窗", b, scene);
  // Interior frame around the aperture; positions use world Y for height and world Z for depth.
  const frame = new THREE.MeshStandardMaterial({ color: "#e7edf4", roughness: 0.5, metalness: 0.18 });
  const xFrame = 5.94;
  addBox(g, "window frame upper", [xFrame, 2.45, 1.0], [0.13, 0.07, 1.56], frame);
  addBox(g, "window frame lower", [xFrame, 1.05, 1.0], [0.13, 0.07, 1.56], frame);
  addBox(g, "window frame rear", [xFrame, 1.75, 0.25], [0.13, 1.47, 0.07], frame);
  addBox(g, "window frame front", [xFrame, 1.75, 1.75], [0.13, 1.47, 0.07], frame);
  // Distant night gradient and two depth layers of low-poly skyline silhouettes.
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.48, 1.38), new THREE.MeshBasicMaterial({ color: "#0a1c34", side: THREE.DoubleSide }));
  bg.rotation.y = -Math.PI / 2; bg.position.set(8.8, 1.75, 1.0); g.add(bg);
  const cityMatFar = new THREE.MeshStandardMaterial({ color: "#1b2d49", roughness: 1 });
  const cityMatNear = new THREE.MeshStandardMaterial({ color: "#111f36", roughness: 1 });
  const rows = [
    { x: 8.0, mat: cityMatFar, shapes: [[0.26,0.54,0.25],[0.48,0.75,0.31],[0.72,0.42,0.24],[0.95,0.86,0.27],[1.22,0.59,0.32],[1.45,0.43,0.23]] },
    { x: 7.1, mat: cityMatNear, shapes: [[0.18,0.39,0.30],[0.42,0.61,0.26],[0.68,0.33,0.32],[0.91,0.72,0.31],[1.20,0.46,0.29],[1.44,0.56,0.25]] },
  ];
  for (let layer = 0; layer < rows.length; layer++) {
    const row = rows[layer];
    row.shapes.forEach(([z, height, width], i) => {
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.16 + layer * 0.12), row.mat);
      building.position.set(row.x, 1.08 + height / 2, 0.30 + z); building.castShadow = false; g.add(building);
      const rowsOfWindows = Math.max(1, Math.floor(height / 0.16));
      for (let r = 0; r < rowsOfWindows; r++) {
        if ((i + r) % 2 !== 0) continue;
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.035, 0.025), new THREE.MeshBasicMaterial({ color: (i + r) % 3 ? "#d9a75e" : "#5fb6db" }));
        win.position.set(row.x - width / 2 - 0.006, 1.12 + r * 0.13, 0.35 + z); g.add(win);
      }
    });
  }
  // Low-intensity glass at the inner reveal adds a subtle reflection without hiding the city.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.49, 1.39), MAT.glass);
  glass.rotation.y = -Math.PI / 2; glass.position.set(5.90, 1.75, 1.0); g.add(glass);
  for (const z of [0.77, 1.27]) addBox(g, `window mullion ${z}`, [5.89, 1.75, z], [0.06, 1.40, 0.025], frame);
  addBox(g, "window cross rail", [5.89, 1.76, 1.0], [0.06, 0.025, 1.50], frame);
}

// Open framed media table with CRT, shelf-mounted VCR and four separate VHS modules.
{
  const b = { min: [0.15, 0.15, 0], max: [0.90, 0.55, 0.68] };
  const g = addGroup("media-table", "VHS 媒体边桌", b, scene);
  addBox(g, "media table top", [0.525, 0.66, 0.35], [0.75, 0.04, 0.40], MAT.wood);
  addBox(g, "media shelf support", [0.50, 0.49, 0.35], [0.64, 0.025, 0.34], MAT.woodEdge);
  for (const x of [0.19, 0.86]) for (const z of [0.19, 0.51]) addBox(g, `media table frame ${x}-${z}`, [x, 0.34, z], [0.045, 0.68, 0.045], MAT.steel);
}
{
  const b = { min: [0.20, 0.18, 0.68], max: [0.68, 0.52, 1.10] };
  const g = addGroup("crt-display", "CRT 内容显示器", b, scene);
  addBox(g, "CRT shell", [0.44, 0.89, 0.35], [0.48, 0.42, 0.34], MAT.dark);
  addBox(g, "CRT bezel", [0.44, 0.89, 0.526], [0.40, 0.32, 0.025], MAT.black);
  addCanvasPlane(g, SCREEN_TEXTURES.crt, [0.44, 0.89, 0.541], 0.36, 0.28);
  addBox(g, "CRT lower controls", [0.44, 0.705, 0.531], [0.26, 0.035, 0.025], MAT.dark);
}
{
  const b = { min: [0.20, 0.18, 0.50], max: [0.62, 0.52, 0.62] };
  const g = addGroup("vcr-player", "VCR 播放器", b, scene);
  addBox(g, "VCR body", [0.41, 0.56, 0.35], [0.42, 0.12, 0.34], MAT.dark);
  addBox(g, "VCR front face", [0.41, 0.56, 0.526], [0.39, 0.075, 0.008], MAT.black);
  for (let i = 0; i < 4; i++) addBox(g, `VCR button ${i}`, [0.29 + i * 0.075, 0.557, 0.533], [0.028, 0.022, 0.008], i === 0 ? MAT.gold : MAT.steel);
}
for (let i = 0; i < 4; i++) {
  const z0 = 0.20 + i * 0.032;
  const b = { min: [0.68, z0, 0.68 + i * 0.032], max: [0.90, z0 + 0.13, 0.71 + i * 0.032] };
  const id = `tape-${String(i + 1).padStart(2, "0")}`;
  const g = addGroup(id, `VHS 磁带 ${String(i + 1).padStart(2, "0")} · [待提供]`, b, scene);
  addBox(g, "VHS cassette shell", [0.79, 0.695 + i * 0.032, 0.265 + i * 0.032], [0.22, 0.027, 0.13], new THREE.MeshStandardMaterial({ color: i % 2 ? "#343d49" : "#202832", roughness: 0.72 }));
  addBox(g, "VHS label", [0.79, 0.710 + i * 0.032, 0.265 + i * 0.032], [0.16, 0.004, 0.072], MAT.white);
}

function formatBounds(bounds) {
  const f = (n) => Number(n).toFixed(2);
  return `X ${f(bounds.min[0])}–${f(bounds.max[0])} · Y ${f(bounds.min[1])}–${f(bounds.max[1])} · Z ${f(bounds.min[2])}–${f(bounds.max[2])} m`;
}
function selectObject(id) {
  const record = selectable.get(id);
  if (!record) return;
  document.querySelector("#selection-name").textContent = record.name;
  document.querySelector("#selection-id").textContent = record.id;
  document.querySelector("#selection-bounds").textContent = formatBounds(record.bounds);
  document.querySelector("#object-picker").value = id;
  if (selectionHelper) { scene.remove(selectionHelper); selectionHelper.geometry.dispose(); selectionHelper.material.dispose(); }
  selectionHelper = new THREE.BoxHelper(record.root, "#61d9bd");
  selectionHelper.material.depthTest = false; selectionHelper.material.transparent = true; selectionHelper.material.opacity = 0.95;
  scene.add(selectionHelper);
}

function toggleLamp(id) {
  const state = lampLights.get(id);
  if (!state) return;
  state.on = !state.on;
  state.target = state.on ? (id === "desk-lamp" ? 4.0 : 2.7) : 0;
  state.glow.material.color.set(state.on ? "#ffe0a6" : "#4a5663");
  const record = selectable.get(id);
  document.querySelector("#selection-name").textContent = `${record.name} · ${state.on ? "开启" : "关闭"}`;
}

const picker = document.querySelector("#object-picker");
picker.addEventListener("change", () => { if (picker.value) selectObject(picker.value); });
const viewTargets = {
  front: { eye: [3.1, 2.70, 9.8], target: [3.0, 1.24, 2.35] },
  side: { eye: [0.55, 2.9, 2.55], target: [5.65, 1.35, 2.45] },
  top: { eye: [3.1, 11.2, 2.5], target: [3.0, 0.10, 2.45] },
  reset: { eye: [5.45, 3.7, 9.0], target: [3.0, 1.2, 2.4] },
};
function setView(name) {
  const view = viewTargets[name] || viewTargets.reset;
  camera.position.set(...view.eye);
  controls.target.set(...view.target);
  controls.update();
  document.querySelectorAll("[data-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.view === name)));
}
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
canvas.addEventListener("pointerup", (event) => {
  if (event.button !== 0 || event.movementX > 4 || event.movementY > 4) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(hitMeshes, false).find((item) => item.object.userData.objectId);
  if (!hit) return;
  const id = hit.object.userData.objectId;
  selectObject(id);
  if (id === "desk-lamp" || id === "floor-lamp") toggleLamp(id);
});
canvas.addEventListener("pointermove", (event) => {
  if (event.buttons) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(hitMeshes, false).length > 0;
  canvas.style.cursor = hit ? "pointer" : "grab";
});

function resize() {
  const rect = stage.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
window.addEventListener("resize", resize);
resize();
setView("reset");
document.querySelector("#loading-state").hidden = true;

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  for (const state of lampLights.values()) state.light.intensity += (state.target - state.light.intensity) * Math.min(1, dt * 5.5);
  controls.update();
  if (selectionHelper) selectionHelper.update();
  renderer.render(scene, camera);
}
animate();
