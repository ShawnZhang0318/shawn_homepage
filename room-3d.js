import * as THREE from "./node_modules/three/build/three.module.js";
import { RoundedBoxGeometry } from "./node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js";

const canvas = document.getElementById("room3dCanvas");
const room = document.getElementById("roomScene");
const viewport = document.getElementById("roomViewport");

if (canvas && room && viewport) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch (error) {
    room.classList.add("is-no-webgl");
  }

  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x08132b, 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08132b);
    scene.fog = new THREE.Fog(0x08132b, 11, 26);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.08, 80);
    camera.position.set(0, 2.75, 4.0);
    camera.rotation.order = "YXZ";
    camera.rotation.x = -0.16;

    const mat = (color, roughness = 0.55, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const wallBlueMap = makeWallTexture();
    const wallBlue = new THREE.MeshStandardMaterial({ map: wallBlueMap, bumpMap: wallBlueMap, bumpScale: 0.006, roughness: 0.96 });
    const wallInset = mat(0x061b57, 0.92);
    const trimBlue = mat(0x1647ba, 0.42, 0.18);
    const woodMap = makeWoodTexture();
    const walnut = new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodMap, bumpMap: woodMap, bumpScale: 0.018, roughness: 0.58, metalness: 0.01 });
    const darkWood = mat(0x392318, 0.48);
    const blackMetal = mat(0x111722, 0.26, 0.72);
    const graphite = mat(0x202733, 0.34, 0.34);
    const monitorBlack = mat(0x090d14, 0.39, 0.22);
    const blueMetal = mat(0x1a3871, 0.31, 0.72);
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: makePaperTexture(), roughness: 0.91 });
    const ceramic = mat(0xe6e2da, 0.24);
    const copper = mat(0x9c5e31, 0.31, 0.75);
    const fabric = new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeFabricTexture(), roughness: 0.99 });
    const chelseaBlue = mat(0x092c88, 0.96);
    const offWhite = mat(0xe7e3d8, 0.84);

    const roomMeshes = [];
    const hotspotTargets = new Map();

    function add(mesh, position, rotation) {
      if (position) mesh.position.set(position[0], position[1], position[2]);
      if (rotation) mesh.rotation.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      roomMeshes.push(mesh);
      return mesh;
    }

    function box(width, height, depth, material, position, rotation, radius = 0.025, segments = 3) {
      const geometry = radius > 0 ?
        new RoundedBoxGeometry(width, height, depth, segments, Math.min(radius, height / 2, depth / 2, width / 2)) :
        new THREE.BoxGeometry(width, height, depth);
      return add(new THREE.Mesh(geometry, material), position, rotation);
    }

    function plane(width, height, material, position, rotation) {
      return add(new THREE.Mesh(new THREE.PlaneGeometry(width, height), material), position, rotation);
    }

    function cylinder(radiusTop, radiusBottom, height, material, position, rotation, radialSegments = 24) {
      return add(new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), material), position, rotation);
    }

    function sphere(radius, material, position, scale) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material);
      if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
      return add(mesh, position);
    }

    function addBetween(a, b, radius, material, radiusEnd = radius) {
      const start = new THREE.Vector3(a[0], a[1], a[2]);
      const end = new THREE.Vector3(b[0], b[1], b[2]);
      const direction = new THREE.Vector3().subVectors(end, start);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusEnd, radius, direction.length(), 20), material);
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      roomMeshes.push(mesh);
      return mesh;
    }

    function textureFromCanvas(canvasElement) {
      const texture = new THREE.CanvasTexture(canvasElement);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
      return texture;
    }

    function makeWoodTexture() {
      const c = document.createElement("canvas");
      c.width = 1024; c.height = 512;
      const g = c.getContext("2d");
      const pixels = g.createImageData(c.width, c.height);
      for (let y = 0; y < c.height; y++) {
        const slowGrain = Math.sin(y * 0.11 + Math.sin(y * 0.012) * 2.8) * 3.4 + Math.sin(y * 0.035) * 2.2;
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const random = (n - Math.floor(n) - 0.5) * 7;
          const fine = Math.sin(x * 0.018 + y * 0.43) * 1.1 + Math.sin(x * 0.006 + y * 0.22) * 1.5;
          const shade = slowGrain + fine + random;
          pixels.data[i] = 101 + shade;
          pixels.data[i + 1] = 70 + shade * 0.76;
          pixels.data[i + 2] = 48 + shade * 0.58;
          pixels.data[i + 3] = 255;
        }
      }
      g.putImageData(pixels, 0, 0);
      g.globalAlpha = 0.11; g.strokeStyle = "#d7b48b"; g.lineWidth = 1;
      for (let i = 0; i < 28; i++) {
        const y = (i * 19) % c.height;
        g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(280, y + 3, 690, y - 4, 1024, y + 2); g.stroke();
      }
      g.globalAlpha = 1;
      return textureFromCanvas(c);
    }

    function makeWallTexture() {
      const c = document.createElement("canvas"); c.width = 384; c.height = 384;
      const g = c.getContext("2d");
      const pixels = g.createImageData(c.width, c.height);
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const n = Math.sin(x * 91.7 + y * 37.4) * 43758.5453;
        const grain = (n - Math.floor(n) - 0.5) * 7 + Math.sin(x * 0.06 + y * 0.09) * 1.4;
        pixels.data[i] = 8 + grain * 0.22;
        pixels.data[i + 1] = 36 + grain * 0.62;
        pixels.data[i + 2] = 105 + grain;
        pixels.data[i + 3] = 255;
      }
      g.putImageData(pixels, 0, 0);
      return textureFromCanvas(c);
    }

    function makeFabricTexture() {
      const c = document.createElement("canvas"); c.width = 128; c.height = 128;
      const g = c.getContext("2d");
      g.fillStyle = "#182235"; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = "rgba(155,174,207,.075)"; g.lineWidth = 1;
      for (let i = -128; i < 256; i += 4) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke();
        g.beginPath(); g.moveTo(i, 128); g.lineTo(i + 128, 0); g.stroke();
      }
      const pixels = g.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const n = Math.sin(i * 0.123) * 43758.5453;
        const grain = (n - Math.floor(n) - 0.5) * 9;
        pixels.data[i] = Math.max(0, pixels.data[i] + grain);
        pixels.data[i + 1] = Math.max(0, pixels.data[i + 1] + grain);
        pixels.data[i + 2] = Math.max(0, pixels.data[i + 2] + grain);
      }
      g.putImageData(pixels, 0, 0);
      const texture = textureFromCanvas(c);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      return texture;
    }

    function makeLeatheretteTexture() {
      const c = document.createElement("canvas"); c.width = 512; c.height = 512;
      const g = c.getContext("2d");
      g.fillStyle = "#10357e"; g.fillRect(0, 0, c.width, c.height);
      const pixels = g.getImageData(0, 0, c.width, c.height);
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const grain = (n - Math.floor(n) - 0.5) * 13 + Math.sin(x * .12 + y * .09) * 1.8;
        pixels.data[i] = Math.max(0, Math.min(255, pixels.data[i] + grain * .35));
        pixels.data[i + 1] = Math.max(0, Math.min(255, pixels.data[i + 1] + grain * .65));
        pixels.data[i + 2] = Math.max(0, Math.min(255, pixels.data[i + 2] + grain));
        pixels.data[i + 3] = 255;
      }
      g.putImageData(pixels, 0, 0);
      g.globalAlpha = .13; g.strokeStyle = "#9fb3db"; g.lineWidth = 1;
      for (let i = 0; i < 34; i++) {
        const x = (i * 37) % 512, y = (i * 71) % 512;
        g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 12, y - 6, x + 24, y + 7, x + 37, y + 1); g.stroke();
      }
      g.globalAlpha = 1;
      const texture = textureFromCanvas(c);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1.5, 1.5);
      return texture;
    }

    function makePaperTexture() {
      const c = document.createElement("canvas"); c.width = 700; c.height = 960;
      const g = c.getContext("2d");
      g.fillStyle = "#e9ddbd"; g.fillRect(0, 0, c.width, c.height);
      const paperGrain = g.createImageData(c.width, c.height);
      for (let i = 0; i < paperGrain.data.length; i += 4) {
        const n = Math.sin(i * .017) * 43758.5453;
        const shade = (n - Math.floor(n) - .5) * 8;
        paperGrain.data[i] = 233 + shade; paperGrain.data[i + 1] = 221 + shade; paperGrain.data[i + 2] = 189 + shade * .8; paperGrain.data[i + 3] = 44;
      }
      g.putImageData(paperGrain, 0, 0);
      g.strokeStyle = "rgba(80,111,127,.22)"; g.lineWidth = 1.5;
      for (let y = 126; y < 960; y += 48) {
        g.beginPath(); g.moveTo(42, y + Math.sin(y * .08) * 1.2); g.lineTo(670, y + Math.sin(y * .055) * 1.4); g.stroke();
      }
      g.strokeStyle = "rgba(183,91,68,.38)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(105, 24); g.bezierCurveTo(103, 280, 108, 610, 104, 940); g.stroke();
      const hand = 'italic 600 32px "Segoe Print", "Bradley Hand", cursive';
      const ink = "#34473d", greenInk = "#536c43", redInk = "#b96f55";
      g.save(); g.translate(124, 82); g.rotate(-.018); g.fillStyle = "#26372f"; g.font = 'italic 700 70px "Segoe Print", "Bradley Hand", cursive'; g.fillText("Work", 0, 0); g.restore();
      g.save(); g.translate(410, 68); g.rotate(.018); g.fillStyle = greenInk; g.font = 'italic 600 22px "Segoe Print", "Bradley Hand", cursive'; g.fillText("tape 01 · now playing", 0, 0); g.restore();
      g.save(); g.translate(126, 119); g.rotate(-.008); g.fillStyle = redInk; g.font = 'italic 600 25px "Segoe Print", "Bradley Hand", cursive'; g.fillText("Research · AI · Robotics", 0, 0); g.restore();
      g.fillStyle = ink; g.font = 'italic 500 21px "Segoe Print", "Bradley Hand", cursive';
      g.fillText("AI products, embodied robots & mechanical design", 126, 151);
      g.fillText("From research prototypes to shipped systems.", 126, 177);
      g.fillStyle = redInk; g.font = 'italic 600 27px "Segoe Print", "Bradley Hand", cursive'; g.fillText("Companies", 126, 217);

      const entries = [
        ["INFIFORCE · SHENZHEN", "2026.05—08", "Research assistant · home-service robotics"],
        ["HKU · AGENTIC INTELLIGENCE LAB", "2026.05—08", "Research intern · embodied agents"],
        ["YOUWEIZHI · ZHUHAI", "2026.02—04", "AI full-stack engineer · study companion"],
        ["NAVIGATOR ROBOTICS LAB", "2022.11—NOW", "Founder · mechanical lead · RoboMaster"]
      ];
      entries.forEach((entry, i) => {
        const y = 266 + i * 91;
        g.save(); g.translate(140, y); g.rotate(Math.sin(i * 3.1) * .009);
        g.strokeStyle = redInk; g.lineWidth = 2.2; g.beginPath(); g.ellipse(-21, -10, 17, 16, .06 * Math.sin(i), 0, Math.PI * 2); g.stroke();
        g.fillStyle = redInk; g.font = 'italic 600 18px "Segoe Print", "Bradley Hand", cursive'; g.textAlign = "center"; g.fillText(String(i + 1).padStart(2, "0"), -21, -4); g.textAlign = "left";
        g.fillStyle = ink; g.font = 'italic 600 24px "Segoe Print", "Bradley Hand", cursive'; g.fillText(entry[0], 14, 0, 325);
        g.fillStyle = greenInk; g.font = 'italic 600 19px "Segoe Print", "Bradley Hand", cursive'; g.textAlign = "right"; g.fillText(entry[1], 650, 0); g.textAlign = "left";
        g.fillStyle = "rgba(52,71,61,.88)"; g.font = 'italic 500 27px "Segoe Print", "Bradley Hand", cursive'; g.fillText(entry[2], 16, 34, 520);
        g.restore();
      });
      g.save(); g.translate(126, 652); g.rotate(-.014); g.fillStyle = redInk; g.font = 'italic 600 31px "Segoe Print", "Bradley Hand", cursive'; g.fillText("Projects", 0, 0); g.restore();
      const projects = [
        ["FundaNotes · AI learning product", "ONGOING"],
        ["Home-service robotics", "2026"],
        ["RoboMaster competition robots", "2024—25"]
      ];
      projects.forEach((entry, i) => {
        const y = 709 + i * 59;
        g.save(); g.translate(140, y); g.rotate(Math.sin(i * 2.4) * .01);
        g.fillStyle = redInk; g.font = 'italic 500 18px "Segoe Print", "Bradley Hand", cursive'; g.textAlign = "center"; g.fillText(String(i + 6).padStart(2, "0"), -20, 0); g.textAlign = "left";
        g.fillStyle = ink; g.font = 'italic 600 23px "Segoe Print", "Bradley Hand", cursive'; g.fillText(entry[0], 14, 0, 400);
        g.fillStyle = greenInk; g.font = 'italic 600 18px "Segoe Print", "Bradley Hand", cursive'; g.textAlign = "right"; g.fillText(entry[1], 555, 0); g.textAlign = "left"; g.restore();
      });
      g.save(); g.translate(470, 920); g.rotate(-.035); g.fillStyle = "rgba(166,108,78,.56)"; g.font = 'italic 500 19px "Segoe Print", "Bradley Hand", cursive'; g.fillText("Yitong Zhang", 0, 0); g.restore();
      return textureFromCanvas(c);
    }

    function makeScreenTexture(kind) {
      const c = document.createElement("canvas"); c.width = 1200; c.height = 675;
      const g = c.getContext("2d");
      g.fillStyle = "#071427"; g.fillRect(0, 0, 1200, 675);
      g.fillStyle = "#111f34"; g.fillRect(0, 0, 1200, 38);
      ["#ef6d68", "#e6b957", "#55c889"].forEach((color, i) => { g.fillStyle = color; g.beginPath(); g.arc(24 + i * 25, 19, 6, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = "#adc0d8"; g.font = "14px Consolas"; g.fillText(kind.toUpperCase() + "  /  YITONG'S WORKSPACE", 98, 24);
      g.strokeStyle = "rgba(90,132,184,.2)"; g.lineWidth = 1;
      for (let x = 0; x < 1200; x += 36) { g.beginPath(); g.moveTo(x, 38); g.lineTo(x, 675); g.stroke(); }
      for (let y = 38; y < 675; y += 36) { g.beginPath(); g.moveTo(0, y); g.lineTo(1200, y); g.stroke(); }

      if (kind === "code" || kind === "terminal") {
        g.fillStyle = "#0b1a2d"; g.fillRect(0, 38, 172, 637);
        g.fillStyle = "#7f96b6"; g.font = "15px Consolas";
        for (let i = 0; i < 19; i++) g.fillText((i % 4 === 0 ? "▸ " : "  ") + ["src", "components", "robotics", "planner", "README.md"][i % 5], 18, 77 + i * 27);
        for (let i = 0; i < 23; i++) {
          const y = 84 + i * 23; g.fillStyle = i % 4 === 0 ? "#55b7d6" : i % 3 === 0 ? "#8fc78a" : "#d1bb8d";
          g.fillRect(205 + (i % 5) * 32, y, 170 + (i % 7) * 42, 5);
          g.fillStyle = "#6685a7"; g.fillRect(225 + (i % 3) * 20, y + 9, 105 + (i % 8) * 28, 3);
        }
      } else if (kind === "cad" || kind === "laptop") {
        g.strokeStyle = "rgba(45,173,223,.68)"; g.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
          const x = 375 + i * 37; const y = 170 + Math.sin(i * .54) * 95;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + 65, y - 27); g.lineTo(x + 65, y + 65); g.lineTo(x, y + 94); g.closePath(); g.stroke();
        }
        g.strokeStyle = "#55c8ff"; g.lineWidth = 3;
        g.beginPath(); g.moveTo(300, 420); g.lineTo(410, 380); g.lineTo(520, 425); g.lineTo(620, 345); g.lineTo(760, 380); g.lineTo(855, 250); g.lineTo(940, 212); g.stroke();
        g.fillStyle = "#70a8ca"; g.font = "18px Consolas"; g.fillText("ASSEMBLY  /  ROBOT JOINT 02", 245, 93);
      } else if (kind === "robot") {
        g.strokeStyle = "rgba(51,188,234,.62)"; g.lineWidth = 3;
        for (let r = 30; r < 380; r += 42) { g.beginPath(); g.arc(590, 350, r, 0, Math.PI * 2); g.stroke(); }
        const pts = [[390, 490], [440, 320], [600, 260], [745, 340], [840, 178]];
        g.strokeStyle = "#66d3ef"; g.lineWidth = 22; g.lineCap = "round";
        for (let i = 0; i < pts.length - 1; i++) { g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[i + 1]); g.stroke(); }
        pts.forEach(([x, y]) => { g.fillStyle = "#a4e4f3"; g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fill(); });
        g.fillStyle = "#6a8aa8"; g.font = "20px Consolas"; g.fillText("ARM 04  ·  READY", 72, 610);
      } else {
        g.strokeStyle = "rgba(28,155,231,.5)"; g.lineWidth = 3;
        for (let j = 0; j < 5; j++) {
          g.beginPath();
          for (let i = 0; i <= 90; i++) {
            const x = 130 + i * 11; const y = 340 + Math.sin(i * .12 + j * .5) * (60 + j * 25) + Math.cos(i * .045) * 55;
            if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
      }
      return textureFromCanvas(c);
    }

    function addMonitor(x, y, z, width, height, kind, desktop = false) {
      const frameDepth = desktop ? 0.075 : 0.085;
      const frameBody = desktop ? graphite : monitorBlack;
      box(width, height, frameDepth, frameBody, [x, y, z], null, desktop ? 0.032 : 0.045, 6);
      const screen = new THREE.MeshBasicMaterial({ map: makeScreenTexture(kind), toneMapped: false });
      plane(width - 0.075, height - 0.075, screen, [x, y, z + frameDepth / 2 + 0.006]);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshBasicMaterial({ color: 0x5bd6bd, toneMapped: false }));
      led.position.set(x + width * 0.39, y - height * 0.47, z + frameDepth / 2 + 0.012); scene.add(led); roomMeshes.push(led);
      if (!desktop) {
        const wallPlate = box(0.23, 0.17, 0.025, blackMetal, [x, y, z - frameDepth / 2 - 0.015], null, 0.012, 4);
        addBetween([x, y, z - frameDepth / 2 - 0.025], [x, y, z - frameDepth / 2 - 0.09], 0.018, blackMetal);
        // Short threaded mounting lugs at both sides of the plate.
        for (const side of [-1, 1]) {
          addBetween([x + side * 0.07, y, z - frameDepth / 2 - 0.02], [x + side * 0.07, y, z - frameDepth / 2 - 0.075], 0.008, blueMetal);
        }
        return;
      }
      const screenBottom = y - height / 2;
      box(0.075, screenBottom - 0.84, 0.072, graphite, [x, (screenBottom + 0.84) / 2, z - 0.012], null, 0.022, 5);
      box(0.31, 0.025, 0.21, blackMetal, [x, 0.849, z + 0.015], null, 0.03, 5);
      box(0.18, 0.004, 0.008, mat(0x808b98, 0.44, 0.42), [x, 0.863, z + 0.103], null, 0.003, 3);
    }

    function addTrophy(x, y, z, scale, color, engraving) {
      const metal = new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.58 });
      const brightMetal = new THREE.MeshStandardMaterial({ color: 0xe1c579, roughness: 0.26, metalness: 0.62 });
      const darkBase = mat(0x171c26, 0.52, 0.12);
      const plate = new THREE.MeshBasicMaterial({ map: makeSmallLabel(engraving || "ROBOTICS · AWARD", "#302615"), toneMapped: false });
      // Stepped dark plinth with a brass plate that faces into the room (+X).
      box(0.42 * scale, 0.065 * scale, 0.31 * scale, darkBase, [x, y + 0.033 * scale, z], null, 0.028 * scale, 5);
      box(0.34 * scale, 0.13 * scale, 0.25 * scale, darkBase, [x, y + 0.13 * scale, z], null, 0.025 * scale, 5);
      box(0.25 * scale, 0.036 * scale, 0.012 * scale, brightMetal, [x + 0.141 * scale, y + 0.13 * scale, z], [0, Math.PI / 2, 0], 0.006 * scale, 4);
      plane(0.215 * scale, 0.023 * scale, plate, [x + 0.149 * scale, y + 0.13 * scale, z], [0, Math.PI / 2, 0]);
      cylinder(0.052 * scale, 0.12 * scale, 0.135 * scale, metal, [x, y + 0.268 * scale, z]);
      cylinder(0.135 * scale, 0.135 * scale, 0.05 * scale, metal, [x, y + 0.36 * scale, z], null, 48);
      const profile = [
        new THREE.Vector2(0.00, 0.00), new THREE.Vector2(0.075, 0.00),
        new THREE.Vector2(0.115, 0.08), new THREE.Vector2(0.158, 0.36),
        new THREE.Vector2(0.174, 0.49), new THREE.Vector2(0.19, 0.52),
        new THREE.Vector2(0.185, 0.545), new THREE.Vector2(0.163, 0.534),
        new THREE.Vector2(0.15, 0.47), new THREE.Vector2(0.128, 0.35),
        new THREE.Vector2(0.094, 0.12), new THREE.Vector2(0.00, 0.105)
      ];
      const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), metal);
      cup.position.set(x, y + 0.36 * scale, z); cup.scale.setScalar(scale); cup.castShadow = true; cup.receiveShadow = true; scene.add(cup); roomMeshes.push(cup);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.183 * scale, 0.009 * scale, 10, 48), brightMetal);
      rim.position.set(x, y + 0.90 * scale, z); rim.rotation.x = Math.PI / 2; scene.add(rim); roomMeshes.push(rim);
      // Cup handles sit on opposite sides as viewed from the front, with their loops upright.
      const handleLeft = new THREE.Mesh(new THREE.TorusGeometry(0.083 * scale, 0.014 * scale, 10, 32), metal);
      handleLeft.position.set(x + 0.015 * scale, y + 0.72 * scale, z - 0.158 * scale); handleLeft.rotation.y = Math.PI / 2; scene.add(handleLeft); roomMeshes.push(handleLeft);
      const handleRight = handleLeft.clone(); handleRight.position.z = z + 0.158 * scale; scene.add(handleRight); roomMeshes.push(handleRight);
      const crest = new THREE.Mesh(new THREE.ShapeGeometry(makeStarShape(0.055 * scale, 0.024 * scale, 5)), new THREE.MeshStandardMaterial({ color: 0x604c2b, roughness: 0.36, metalness: 0.58, side: THREE.DoubleSide }));
      crest.position.set(x + 0.14 * scale, y + 0.66 * scale, z); crest.rotation.y = Math.PI / 2; scene.add(crest); roomMeshes.push(crest);
      const footRing = new THREE.Mesh(new THREE.TorusGeometry(0.093 * scale, 0.009 * scale, 8, 32), brightMetal);
      footRing.position.set(x, y + 0.405 * scale, z); footRing.rotation.x = Math.PI / 2; scene.add(footRing); roomMeshes.push(footRing);
    }

    function makeStarShape(outerRadius, innerRadius, points) {
      const shape = new THREE.Shape();
      for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = -Math.PI / 2 + i * Math.PI / points;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      shape.closePath();
      return shape;
    }

    function addMedal(x, y, z, scale, color, ribbonColor) {
      const metal = new THREE.MeshStandardMaterial({ color, roughness: 0.29, metalness: 0.62 });
      const brightMetal = new THREE.MeshStandardMaterial({ color: 0xf2d68b, roughness: 0.24, metalness: 0.68 });
      const ribbon = new THREE.MeshStandardMaterial({ color: ribbonColor, roughness: 0.9, metalness: 0.01 });
      const stripe = new THREE.MeshStandardMaterial({ color: 0xe7e3d8, roughness: 0.9 });
      const ribbonShape = new THREE.Shape();
      ribbonShape.moveTo(-0.078 * scale, 0.245 * scale);
      ribbonShape.lineTo(0.078 * scale, 0.245 * scale);
      ribbonShape.lineTo(0.072 * scale, -0.018 * scale);
      ribbonShape.lineTo(0.006 * scale, -0.104 * scale);
      ribbonShape.lineTo(-0.072 * scale, -0.018 * scale);
      ribbonShape.closePath();
      const ribbonMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(ribbonShape, { depth: 0.004 * scale, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.001 * scale, bevelThickness: 0.001 * scale }), ribbon);
      ribbonMesh.position.set(x - 0.04 * scale, y + 0.02 * scale, z);
      ribbonMesh.rotation.y = Math.PI / 2; ribbonMesh.castShadow = true; ribbonMesh.receiveShadow = true; scene.add(ribbonMesh); roomMeshes.push(ribbonMesh);
      // Two inset woven stripes and small edge stitches keep the ribbon reading as fabric.
      for (const offset of [-0.042, 0.042]) {
        box(0.009 * scale, 0.23 * scale, 0.003 * scale, stripe, [x + 0.001 * scale, y + 0.13 * scale, z + offset * scale], [0, Math.PI / 2, 0], 0.002 * scale, 2);
      }
      const stitch = mat(0xc5a56a, 0.84, 0.04);
      for (let i = 0; i < 8; i++) {
        const yy = y + (0.20 - i * 0.026) * scale;
        box(0.0025 * scale, 0.004 * scale, 0.003 * scale, stitch, [x + 0.002 * scale, yy, z - 0.069 * scale], null, 0.001, 2);
        box(0.0025 * scale, 0.004 * scale, 0.003 * scale, stitch, [x + 0.002 * scale, yy, z + 0.069 * scale], null, 0.001, 2);
      }

      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.024 * scale, 0.005 * scale, 8, 20), brightMetal);
      loop.position.set(x + 0.012 * scale, y - 0.06 * scale, z); loop.rotation.y = Math.PI / 2; scene.add(loop); roomMeshes.push(loop);
      cylinder(0.008 * scale, 0.008 * scale, 0.03 * scale, brightMetal, [x + 0.014 * scale, y - 0.075 * scale, z], [0, 0, -Math.PI / 2], 16);
      const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.048 * scale, 0.048 * scale, 0.018 * scale, 64), metal);
      medal.position.set(x + 0.018 * scale, y - 0.12 * scale, z);
      medal.rotation.z = -Math.PI / 2; medal.castShadow = true; scene.add(medal); roomMeshes.push(medal);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.044 * scale, 0.006 * scale, 10, 48), brightMetal);
      rim.position.set(x + 0.038 * scale, y - 0.12 * scale, z); rim.rotation.y = Math.PI / 2; scene.add(rim); roomMeshes.push(rim);
      const inset = new THREE.Mesh(new THREE.TorusGeometry(0.032 * scale, 0.0025 * scale, 6, 32), metal);
      inset.position.set(x + 0.04 * scale, y - 0.12 * scale, z); inset.rotation.y = Math.PI / 2; scene.add(inset); roomMeshes.push(inset);
      const emblem = new THREE.Mesh(new THREE.ShapeGeometry(makeStarShape(0.024 * scale, 0.010 * scale, 6)), new THREE.MeshStandardMaterial({ color: 0x795d2d, roughness: 0.4, metalness: 0.72, side: THREE.DoubleSide }));
      emblem.position.set(x + 0.04 * scale, y - 0.12 * scale, z); emblem.rotation.y = Math.PI / 2; scene.add(emblem); roomMeshes.push(emblem);
    }

    function addCertificate(x, y, z, width, height, title, rotationY) {
      const frame = mat(0x45301e, 0.32, 0.42);
      const paper = new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeCertificateTexture(title), roughness: 0.88 });
      box(width + 0.09, height + 0.09, 0.075, frame, [x, y, z], [0, rotationY, 0], 0.03);
      plane(width, height, paper, [x + (rotationY === 0 ? 0 : 0.043), y, z + (rotationY === 0 ? 0.043 : 0)], [0, rotationY, 0]);
    }

    function makeCertificateTexture(title) {
      const c = document.createElement("canvas"); c.width = 512; c.height = 680;
      const g = c.getContext("2d");
      g.fillStyle = "#eadfc3"; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = "#9d8051"; g.lineWidth = 8; g.strokeRect(22, 22, 468, 636);
      g.fillStyle = "#314d45"; g.font = "bold 26px Georgia"; g.textAlign = "center"; g.fillText("CERTIFICATE", 256, 118);
      g.font = "22px Georgia"; g.fillStyle = "#75684f"; g.fillText(title, 256, 270);
      g.fillRect(120, 340, 272, 3); g.fillRect(158, 375, 196, 2);
      g.beginPath(); g.arc(256, 535, 48, 0, Math.PI * 2); g.stroke();
      return textureFromCanvas(c);
    }

    function createRoom() {
      // Three perpendicular room walls and a real floor define the space.
      box(8.7, 0.16, 8.2, walnut, [0, -0.08, -0.15], null, 0.04, 4);
      box(8.7, 3.8, 0.18, wallBlue, [0, 1.9, -3.95], null, 0.015);
      box(0.18, 3.8, 7.9, wallBlue, [-4.3, 1.9, 0], null, 0.015);
      box(0.18, 3.8, 7.9, wallBlue, [4.3, 1.9, 0], null, 0.015);
      box(8.6, 0.18, 0.16, darkWood, [0, 0.08, -3.82], null, 0.025);
      box(0.16, 0.18, 7.8, darkWood, [-4.19, 0.08, 0], null, 0.025);
      box(0.16, 0.18, 7.8, darkWood, [4.19, 0.08, 0], null, 0.025);
      // Restrained wall battens add depth without filling the room with decor.
      for (let x = -3.85; x <= 3.85; x += 1.28) {
        box(0.035, 3.6, 0.035, wallInset, [x, 1.88, -3.84], null, 0.012);
      }

      // Main workstation: 2 x 2 large displays, plus a normal desktop monitor and laptop below.
      const screenModes = [["code", "cad"], ["robot", "terminal"]];
      const screenW = 1.16, screenH = screenW * 9 / 16;
      const xCenters = [-0.32, 0.92], yCenters = [2.86, 2.14];
      for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
        addMonitor(xCenters[col], yCenters[row], -3.78, screenW, screenH, screenModes[row][col], false);
      }
      const monitorAnchor = new THREE.Vector3(0.3, 2.52, -3.72);
      addMonitor(-0.18, 1.23, -2.03, 0.86, 0.484, "desktop", true);
      hotspotTargets.set("computer", monitorAnchor);

      // Walnut L desk with a rounded corner. Every control faces the chair.
      box(3.55, 0.13, 1.32, walnut, [0, 0.76, -1.51], null, 0.11, 6);
      box(0.96, 0.13, 2.48, walnut, [-2.22, 0.76, 0.14], null, 0.11, 6);
      // A single rounded return forms the L; the mechanics bench is a separate work area.
      // Drawer blocks, supports, and pulls.
      [-1.16, 1.18].forEach((x) => {
        box(0.58, 0.63, 0.78, darkWood, [x, 0.39, -1.51], null, 0.045, 5);
        for (let i = 0; i < 2; i++) {
          box(0.14, 0.025, 0.035, copper, [x, 0.49 - i * 0.22, -1.105], null, 0.016);
        }
      });
      [[-1.58, -2.02], [1.58, -1.02], [-2.58, -0.72], [-1.88, 1.08]].forEach(([x, z]) => {
        box(0.11, 0.68, 0.13, darkWood, [x, 0.37, z], null, 0.035, 4);
      });
      box(2.86, 0.055, 0.28, darkWood, [0, 0.31, -1.51], null, 0.035, 4);

      // A stitched desk mat grounds the controls and keeps keyboard/mouse within one reach zone.
      box(1.0, 0.018, 0.46, mat(0x202630, 0.94), [0.34, 0.837, -1.31], null, 0.055, 5);
      box(0.68, 0.025, 0.29, monitorBlack, [0.18, 0.859, -1.31], null, 0.035, 4);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 17; c++) {
        const keyW = c === 16 ? 0.034 : c === 12 && r === 4 ? 0.09 : 0.031;
        const x = -0.13 + c * 0.037;
        const z = -1.414 + r * 0.052;
        if (c === 13 && r === 4) continue;
        box(keyW, 0.012, 0.035, c === 16 ? blueMetal : graphite, [x, 0.879, z], null, 0.006, 3);
      }
      const mouseShell = new THREE.Mesh(new THREE.SphereGeometry(0.065, 32, 20), graphite);
      mouseShell.scale.set(0.81, 0.55, 1.3); add(mouseShell, [0.75, 0.894, -1.31]);
      box(0.012, 0.008, 0.046, blueMetal, [0.75, 0.922, -1.336], null, 0.005, 3);
      addBetween([0.75, 0.921, -1.286], [0.75, 0.924, -1.24], 0.0025, blackMetal);

      // Laptop shell, keyboard, hinge, and open screen angle toward the seated user.
      const laptopSilver = mat(0x8995a5, 0.38, 0.68);
      const laptopDark = mat(0x111720, 0.54, 0.16);
      const laptopX = 0.82, laptopZ = -1.87;
      box(0.58, 0.038, 0.42, laptopSilver, [laptopX, 0.853, laptopZ], null, 0.035, 5);
      box(0.52, 0.009, 0.25, mat(0x6a7582, 0.42, 0.5), [laptopX, 0.877, laptopZ - 0.065], null, 0.014, 4);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 13; c++) {
        const x = laptopX - 0.223 + c * 0.036;
        const z = laptopZ - 0.15 + r * 0.043;
        const keyW = r === 3 && c === 5 ? 0.12 : 0.026;
        if (r === 3 && c > 5 && c < 9) continue;
        box(keyW, 0.008, 0.028, c === 12 ? blueMetal : laptopDark, [x, 0.884, z], null, 0.004, 3);
      }
      // The touchpad is a distinct glass inset, with a fine chamfer around its edge.
      box(0.17, 0.006, 0.11, mat(0x5f6b78, 0.34, 0.42), [laptopX, 0.881, laptopZ + 0.11], null, 0.014, 4);
      box(0.155, 0.003, 0.095, mat(0x788491, 0.3, 0.28), [laptopX, 0.885, laptopZ + 0.11], null, 0.012, 4);
      // Two real hinge barrels join the keyboard deck and lid.
      cylinder(0.018, 0.018, 0.105, blackMetal, [laptopX - 0.16, 0.88, laptopZ - 0.195], [0, 0, Math.PI / 2], 20);
      cylinder(0.018, 0.018, 0.105, blackMetal, [laptopX + 0.16, 0.88, laptopZ - 0.195], [0, 0, Math.PI / 2], 20);
      box(0.58, 0.36, 0.035, laptopSilver, [laptopX, 1.065, laptopZ - 0.29], [0.12, 0, 0], 0.025, 5);
      box(0.54, 0.323, 0.008, laptopDark, [laptopX, 1.065, laptopZ - 0.267], [0.12, 0, 0], 0.018, 4);
      plane(0.515, 0.292, new THREE.MeshBasicMaterial({ map: makeScreenTexture("laptop"), toneMapped: false }), [laptopX, 1.065, laptopZ - 0.261], [0.12, 0, 0]);
      sphere(0.006, blackMetal, [laptopX, 1.236, laptopZ - 0.255]);
      // Small port apertures and feet reveal a thin manufactured aluminum chassis.
      for (let i = 0; i < 3; i++) box(0.026, 0.009, 0.004, laptopDark, [laptopX - 0.294, 0.849, laptopZ - 0.13 + i * 0.075], null, 0.003, 2);

      // Work sheet: readable at close range, naturally placed on the right side.
      const workPaper = plane(0.21, 0.297, paperMat, [1.4, 0.842, -1.25], [-Math.PI / 2, 0, 0.08]);
      workPaper.material.side = THREE.DoubleSide;
      const penMat = mat(0x25334c, 0.28, 0.65);
      cylinder(0.005, 0.005, 0.17, penMat, [1.62, 0.849, -1.25], [Math.PI / 2, 0, -0.15], 12);
      hotspotTargets.set("paper", new THREE.Vector3(1.4, 0.88, -1.25));

      // Task lamp, useful small tools, and mug.
      const lampBase = cylinder(0.17, 0.19, 0.04, copper, [-1.35, 0.85, -1.55]);
      const lampJoint1 = [-1.35, 1.32, -1.51], lampJoint2 = [-1.02, 1.84, -1.56];
      cylinder(0.035, 0.04, 0.49, copper, [-1.35, 1.09, -1.51], null);
      addBetween(lampJoint1, lampJoint2, 0.035, copper);
      sphere(0.07, blackMetal, lampJoint1);
      sphere(0.065, blackMetal, lampJoint2);
      const shadeMaterial = new THREE.MeshStandardMaterial({ color: 0xa86442, roughness: 0.34, metalness: 0.55, side: THREE.DoubleSide });
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.3, 48, 1, true), shadeMaterial);
      shade.position.set(-0.98, 1.99, -1.57); add(shade);
      const innerShade = new THREE.Mesh(new THREE.ConeGeometry(0.214, 0.274, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8a56e, roughness: 0.7, side: THREE.BackSide }));
      innerShade.position.set(-0.98, 1.99, -1.57); add(innerShade);
      const shadeRim = new THREE.Mesh(new THREE.TorusGeometry(0.226, 0.012, 10, 48), shadeMaterial);
      shadeRim.position.set(-0.98, 1.84, -1.57); shadeRim.rotation.x = Math.PI / 2; scene.add(shadeRim); roomMeshes.push(shadeRim);
      const bulb = new THREE.PointLight(0xffd29c, 12, 3.4, 2);
      bulb.position.set(-0.98, 1.88, -1.57); scene.add(bulb);
      sphere(0.045, mat(0xffe3b6, 0.4, 0.02), [-0.98, 1.9, -1.57]);
      cylinder(0.105, 0.12, 0.21, ceramic, [-0.94, 0.93, -1.64]);
      cylinder(0.101, 0.105, 0.02, mat(0x49301e, 0.3), [-0.94, 1.045, -1.64]);
      const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 10, 28), ceramic);
      mugHandle.position.set(-0.80, 0.94, -1.64); mugHandle.rotation.y = Math.PI / 2; scene.add(mugHandle);

      // Personal return: a real-sized padded trading-card album, business card, and resume envelope.
      const albumX = -2.23, albumZ = 0.26;
      const albumMap = makeLeatheretteTexture();
      const albumLeather = new THREE.MeshStandardMaterial({ color: 0xffffff, map: albumMap, bumpMap: albumMap, bumpScale: 0.006, roughness: 0.84, metalness: 0.015 });
      const albumPages = mat(0xd8d0bd, 0.92, 0.01);
      box(0.31, 0.035, 0.405, albumLeather, [albumX, 0.846, albumZ], [0, -0.035, 0], 0.034, 6);
      box(0.29, 0.027, 0.382, albumPages, [albumX, 0.875, albumZ], [0, -0.035, 0], 0.022, 5);
      box(0.315, 0.035, 0.41, albumLeather, [albumX, 0.901, albumZ], [0, -0.035, 0], 0.035, 6);
      box(0.055, 0.07, 0.396, chelseaBlue, [albumX - 0.13, 0.883, albumZ], [0, -0.035, 0], 0.025, 5);
      const seamMat = mat(0x8c9dbd, 0.78, 0.02);
      box(0.24, 0.003, 0.004, seamMat, [albumX + 0.014, 0.921, albumZ - 0.183], [0, -0.035, 0], 0.001, 2);
      box(0.24, 0.003, 0.004, seamMat, [albumX + 0.014, 0.921, albumZ + 0.183], [0, -0.035, 0], 0.001, 2);
      box(0.004, 0.003, 0.34, seamMat, [albumX - 0.133, 0.921, albumZ], [0, -0.035, 0], 0.001, 2);
      box(0.004, 0.003, 0.34, seamMat, [albumX + 0.157, 0.921, albumZ], [0, -0.035, 0], 0.001, 2);
      const hobbyFoil = new THREE.MeshBasicMaterial({ map: makeFoilText("HOBBY", "#d9bf77"), transparent: true, toneMapped: false, depthWrite: false });
      plane(0.12, 0.033, hobbyFoil, [albumX + 0.012, 0.923, albumZ - 0.045], [-Math.PI / 2, 0, -0.035]);
      const zipperMetal = mat(0xa1a8ae, 0.4, 0.58);
      for (let i = 0; i < 14; i++) {
        const z = albumZ - 0.16 + i * 0.024;
        box(0.006, 0.004, 0.006, zipperMetal, [albumX - 0.145, 0.899, z], null, 0.002, 2);
      }
      box(0.012, 0.018, 0.018, zipperMetal, [albumX - 0.146, 0.902, albumZ - 0.17], null, 0.004, 3);

      const cardX = -1.65, cardZ = 0.54;
      box(0.09, 0.006, 0.055, offWhite, [cardX, 0.839, cardZ], [0, -0.05, 0], 0.004, 4);
      box(0.082, 0.002, 0.048, chelseaBlue, [cardX, 0.843, cardZ], [0, -0.05, 0], 0.003, 4);
      plane(0.072, 0.042, new THREE.MeshBasicMaterial({ map: makeSmallLabel("Y · CARD", "#e9e0cb"), transparent: true, toneMapped: false }), [cardX, 0.8445, cardZ], [-Math.PI / 2, 0, -0.05]);

      const letterX = -2.27, letterZ = -0.49;
      box(0.22, 0.008, 0.15, mat(0xe4ddcd, 0.9, 0), [letterX, 0.84, letterZ], [0, 0.035, 0], 0.008, 4);
      box(0.07, 0.004, 0.045, mat(0xcbbd9d, 0.86, 0), [letterX, 0.847, letterZ], [0, 0.035, 0], 0.003, 3);
      cylinder(0.012, 0.012, 0.006, copper, [letterX, 0.852, letterZ], null, 24);
      hotspotTargets.set("album", new THREE.Vector3(albumX, 0.95, albumZ));
      hotspotTargets.set("card", new THREE.Vector3(cardX, 0.87, cardZ));
      hotspotTargets.set("letter", new THREE.Vector3(letterX, 0.87, letterZ));

      // Ergonomic chair and a discreet Chelsea scarf, seen from behind.
      const chairX = 0.35, chairZ = -0.25;
      cylinder(0.08, 0.1, 0.68, blackMetal, [chairX, 0.43, chairZ]);
      box(0.54, 0.14, 0.58, fabric, [chairX, 0.79, chairZ], null, 0.1, 6);
      box(0.54, 0.64, 0.12, fabric, [chairX, 1.14, chairZ + 0.34], [-0.07, 0, 0], 0.1, 6);
      box(0.52, 0.075, 0.13, blackMetal, [chairX, 1.48, chairZ + 0.32], null, 0.035, 5);
      for (const sign of [-1, 1]) {
        addBetween([chairX + sign * 0.26, 0.63, chairZ], [chairX + sign * 0.26, 0.86, chairZ + 0.09], 0.03, blackMetal);
        box(0.11, 0.04, 0.48, blackMetal, [chairX + sign * 0.3, 0.92, chairZ + 0.02], null, 0.022, 4);
      }
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        const wheelX = chairX + Math.sin(a) * 0.34, wheelZ = chairZ + Math.cos(a) * 0.34;
        addBetween([chairX, 0.12, chairZ], [wheelX, 0.12, wheelZ], 0.028, blackMetal);
        sphere(0.075, blackMetal, [wheelX, 0.09, wheelZ], [1.35, 0.65, 0.65]);
      }
      box(0.20, 0.58, 0.02, chelseaBlue, [chairX, 1.14, chairZ + 0.41], null, 0.03, 5);
      for (let i = 0; i < 3; i++) box(0.20, 0.035, 0.007, offWhite, [chairX, 1.23 - i * 0.14, chairZ + 0.43], null, 0.012, 3);

      // Left personal wall: real shelves, trophies, medals, and framed honors.
      box(2.2, 0.12, 0.58, walnut, [-3.96, 2.95, -0.05], [0, Math.PI / 2, 0], 0.04, 4);
      box(1.48, 0.12, 0.58, walnut, [-3.96, 1.87, -0.55], [0, Math.PI / 2, 0], 0.04, 4);
      addTrophy(-3.62, 3.02, -0.68, 0.52, 0xcda747, "RMU · LIAONING · 1ST");
      addTrophy(-3.62, 3.02, 0.06, 0.46, 0xc9ccd2, "RMU · GUANGDONG · 2ND");
      const medalSet = [[0xd0a644, 0x183c83], [0xb9c1ca, 0x841f36]];
      medalSet.forEach((item, i) => addMedal(-4.02, 2.42, -0.08 + i * 0.38, 0.72, item[0], item[1]));
      addCertificate(-4.18, 2.25, 1.02, 0.73, 0.88, "RMU · LIAONING 1ST · 2025", Math.PI / 2);
      addCertificate(-4.18, 2.25, 2.02, 0.6, 0.74, "RMU · GUANGDONG 2ND · 2024", Math.PI / 2);
      const awardAnchor = new THREE.Vector3(-4.15, 2.46, -0.1);
      hotspotTargets.set("awards", awardAnchor);

      // Right wall window and a compact robotics/mechanical workbench.
      box(0.14, 3.8, 0.18, wallInset, [4.22, 1.9, 0], null, 0.015);
      const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x121d36 });
      const windowImage = plane(3.05, 1.82, windowMaterial, [4.12, 2.48, -0.35], [0, -Math.PI / 2, 0]);
      box(0.09, 1.96, 0.10, darkWood, [4.04, 2.48, -1.92], null, 0.022);
      box(0.09, 1.96, 0.10, darkWood, [4.04, 2.48, 1.22], null, 0.022);
      box(0.09, 0.1, 3.2, darkWood, [4.04, 3.46, -0.35], null, 0.02);
      box(0.09, 0.1, 3.2, darkWood, [4.04, 1.5, -0.35], null, 0.02);
      box(0.08, 1.86, 0.09, darkWood, [4.025, 2.48, -0.35], null, 0.015);
      box(0.08, 0.08, 3.1, walnut, [3.98, 2.39, -0.35], null, 0.018);
      const windowAnchor = new THREE.Vector3(4.05, 2.55, -0.35);
      hotspotTargets.set("window", windowAnchor);

      // Small, functional mechanics bench on the right return.
      box(0.58, 0.11, 2.8, walnut, [3.34, 0.77, -0.12], null, 0.065, 4);
      for (const z of [-1.25, 1.04]) for (const x of [3.08, 3.64]) box(0.1, 0.7, 0.1, darkWood, [x, 0.36, z], null, 0.025);
      box(0.43, 0.26, 0.48, blackMetal, [3.19, 0.95, -1.1], null, 0.05);
      box(0.44, 0.22, 0.14, graphite, [3.19, 1.16, -1.1], null, 0.035);
      // A modeled desktop robot arm with joints, links, and a simple gripper.
      cylinder(0.32, 0.35, 0.11, blueMetal, [3.48, 0.88, 0.55]);
      cylinder(0.22, 0.28, 0.18, blackMetal, [3.48, 1.03, 0.55]);
      const a1 = [3.48, 1.15, 0.55], a2 = [3.48, 1.65, 0.24], a3 = [3.35, 2.0, -0.16], a4 = [3.35, 1.78, -0.42];
      addBetween(a1, a2, 0.085, blueMetal, 0.11); addBetween(a2, a3, 0.065, blueMetal, 0.085); addBetween(a3, a4, 0.05, blackMetal, 0.07);
      [a1, a2, a3].forEach((p, i) => sphere(i ? 0.13 : 0.16, blackMetal, p));
      addBetween([3.35, 1.78, -0.42], [3.23, 1.69, -0.51], 0.025, copper);
      addBetween([3.35, 1.78, -0.42], [3.47, 1.69, -0.51], 0.025, copper);
      // Caliper, a small vise, and a gear blank.
      box(0.06, 0.025, 0.62, blueMetal, [3.6, 0.85, -0.95], null, 0.01);
      box(0.23, 0.18, 0.24, graphite, [3.15, 0.92, -0.95], null, 0.025);
      const gear = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 10, 24), copper);
      gear.position.set(3.43, 0.87, -0.95); gear.rotation.x = -Math.PI / 2; scene.add(gear); roomMeshes.push(gear);
      hotspotTargets.set("robot", new THREE.Vector3(3.47, 1.62, 0.15));

      // Hanging Chelsea scarf in the personal wall, away from the work controls.
      box(0.08, 0.6, 0.04, copper, [-4.06, 3.32, 2.8], null, 0.02);
      box(0.045, 0.95, 0.26, chelseaBlue, [-4.0, 2.67, 2.8], null, 0.015);
      for (let i = 0; i < 3; i++) box(0.012, 0.075, 0.26, offWhite, [-3.97, 2.88 - i * 0.22, 2.8], null, 0.008);
    }

    function makeSmallLabel(text, color) {
      const c = document.createElement("canvas"); c.width = 512; c.height = 176;
      const g = c.getContext("2d");
      g.fillStyle = "rgba(13,34,78,.88)"; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = "rgba(209,179,112,.72)"; g.lineWidth = 4; g.strokeRect(8, 8, 496, 160);
      g.fillStyle = color; g.font = "bold 72px Georgia"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 256, 88);
      return textureFromCanvas(c);
    }

    function makeFoilText(text, color) {
      const c = document.createElement("canvas"); c.width = 512; c.height = 160;
      const g = c.getContext("2d");
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = color; g.font = '600 96px "Segoe Print", "Bradley Hand", cursive';
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, c.width / 2, c.height / 2 + 2);
      return textureFromCanvas(c);
    }

    function addLights() {
      scene.add(new THREE.HemisphereLight(0x9fbaff, 0x382c25, 0.92));
      scene.add(new THREE.AmbientLight(0xc5d4ff, 0.28));
      const key = new THREE.DirectionalLight(0xffdfbe, 1.28);
      key.position.set(-2.8, 5.6, 3.4); key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -7; key.shadow.camera.right = 7;
      key.shadow.camera.top = 7; key.shadow.camera.bottom = -5; key.shadow.bias = -0.00035; key.shadow.radius = 5;
      scene.add(key);
      const blueFill = new THREE.PointLight(0x255cff, 2.6, 7, 2);
      blueFill.position.set(0, 2.8, -3.0); scene.add(blueFill);
      const warmFill = new THREE.PointLight(0xffba76, 3.1, 4.5, 2);
      warmFill.position.set(-1.25, 2.1, -1.35); scene.add(warmFill);
      const roomLight = new THREE.PointLight(0xffd3a0, 3.0, 7, 2);
      roomLight.position.set(1.5, 3.1, 1.1); scene.add(roomLight);
      const awardsFill = new THREE.PointLight(0xffd89b, 3.4, 3.2, 2);
      awardsFill.position.set(-3.0, 3.25, -0.05); scene.add(awardsFill);
    }

    function loadBundPhoto() {
      const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/5/5f/Lujiazui_skyline_by_night_from_Bund%2C_fully_illuminated.jpg";
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(imageUrl, function (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        windowImageMaterial.map = texture;
        windowImageMaterial.color.set(0xffffff);
        windowImageMaterial.needsUpdate = true;
      }, undefined, function () {
        // Keep the real window and frame; only the view uses the local rendered fallback.
        loader.load("assets/room-view-window.webp", function (texture) {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.repeat.set(0.68, 0.57); texture.offset.set(0.16, 0.22);
          windowImageMaterial.map = texture;
          windowImageMaterial.needsUpdate = true;
        });
      });
    }

    addLights();
    createRoom();
    const windowImageMaterial = new THREE.MeshBasicMaterial({ color: 0x7188b5, side: THREE.DoubleSide, toneMapped: false });
    const windowImage = scene.children.find((mesh) => mesh.isMesh && mesh.geometry.type === "PlaneGeometry" && mesh.position.x === 4.12);
    if (windowImage) windowImage.material = windowImageMaterial;
    loadBundPhoto();

    function registerHotspots() {
      const bindings = {
        "hotspot--window": "window",
        "hotspot--awards": "awards",
        "hotspot--computer": "computer",
        "hotspot--album": "album",
        "hotspot--card": "card",
        "hotspot--letter": "letter",
        "hotspot--paper": "paper"
      };
      Object.keys(bindings).forEach(function (className) {
        const button = room.querySelector("." + className);
        const target = hotspotTargets.get(bindings[className]);
        if (button && target) button.userData = { target };
      });
    }

    function placeHotspots() {
      const activeWall = room.dataset.wall;
      const classByWall = {
        work: ["hotspot--computer", "hotspot--awards", "hotspot--paper", "hotspot--album", "hotspot--card", "hotspot--letter"],
        personal: ["hotspot--awards", "hotspot--album", "hotspot--card", "hotspot--letter"],
        window: ["hotspot--window", "hotspot--computer"]
      };
      const visible = new Set(classByWall[activeWall] || classByWall.work);
      const sizes = {
        "hotspot--computer": activeWall === "window" ? [23, 18] : [34, 25],
        "hotspot--awards": activeWall === "personal" ? [22, 24] : [12, 17],
        "hotspot--window": [50, 34],
        "hotspot--paper": [13, 18],
        "hotspot--album": [14, 10],
        "hotspot--card": [9, 8],
        "hotspot--letter": [12, 10]
      };
      room.querySelectorAll(".room-hotspot").forEach(function (button) {
        const entry = button.userData;
        const className = Array.from(button.classList).find((name) => name.startsWith("hotspot--"));
        if (!visible.has(className)) {
          button.style.display = "none"; return;
        }
        if (!entry || !entry.target) return;
        const point = entry.target.clone().project(camera);
        const inside = point.z > -1 && point.z < 1 && Math.abs(point.x) < 0.97 && Math.abs(point.y) < 0.97;
        button.style.display = inside ? "block" : "none";
        const size = sizes[className] || [12, 12];
        button.style.width = size[0] + "%";
        button.style.height = size[1] + "%";
        button.style.left = ((point.x + 1) * 50).toFixed(2) + "%";
        button.style.top = ((1 - point.y) * 50).toFixed(2) + "%";
      });
    }

    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    let pressPoint = null;
    viewport.addEventListener("pointerdown", function (event) { pressPoint = [event.clientX, event.clientY]; });
    viewport.addEventListener("pointerup", function (event) {
      if (!pressPoint || Math.hypot(event.clientX - pressPoint[0], event.clientY - pressPoint[1]) > 5) { pressPoint = null; return; }
      pressPoint = null;
      const anchor = room.querySelector(".room-hotspots").getBoundingClientRect();
      pointer.x = ((event.clientX - anchor.left) / anchor.width) * 2 - 1;
      pointer.y = -(((event.clientY - anchor.top) / anchor.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(roomMeshes, false)[0];
      if (!hit) return;
      const object = hit.object;
      const openId = object.userData.openDialog;
      if (openId) {
        const button = room.querySelector('[data-open="' + openId + '"]');
        if (button) button.click();
      }
    });

    const navButtons = Array.from(document.querySelectorAll("[data-wall-view]"));
    const clock = new THREE.Clock();
    let targetYaw = 0;
    let targetZoom = 1;

    function resize() {
      const width = Math.max(1, viewport.clientWidth);
      const height = Math.max(1, viewport.clientHeight);
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 720 ? 1.25 : 1.65));
      camera.aspect = width / height;
      camera.fov = width / height < 0.72 ? (Math.abs(targetYaw) > 43 ? 72 : 55) : 40;
      camera.updateProjectionMatrix();
    }

    function animate() {
      requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const yaw = THREE.MathUtils.degToRad(targetYaw);
      const portrait = viewport.clientWidth / Math.max(1, viewport.clientHeight) < 0.72;
      const targetFov = portrait ? (Math.abs(targetYaw) > 43 ? 72 : 55) : 40;
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 3.6, delta);
      camera.updateProjectionMatrix();
      const dolly = 5.1 * (1 - 1 / targetZoom);
      const sideView = Math.min(1, Math.abs(targetYaw) / 90);
      const sideZ = targetYaw > 0 ? 1.15 : -0.35;
      camera.position.x = -Math.sin(yaw) * dolly;
      camera.position.y = 2.75;
      camera.position.z = THREE.MathUtils.lerp(portrait ? 3.0 : 4.0, sideZ, sideView) - Math.cos(yaw) * dolly;
      camera.rotation.y = THREE.MathUtils.damp(camera.rotation.y, yaw, 4.4, delta);
      const targetPitch = targetYaw > 43 ? -0.05 : targetYaw < -43 ? -0.08 : -0.16;
      camera.rotation.x = THREE.MathUtils.damp(camera.rotation.x, targetPitch, 5, delta);
      // Light, fabric, and paper receive real soft shadows; the small indicator breathes gently.
      renderer.render(scene, camera);
      placeHotspots();
    }

    window.Room3D = {
      setView: function (yawDegrees, zoom) {
        targetYaw = THREE.MathUtils.clamp(Number(yawDegrees) || 0, -90, 90);
        targetZoom = THREE.MathUtils.clamp(Number(zoom) || 1, 1, 2.4);
        navButtons.forEach(function (button) {
          const target = button.getAttribute("data-wall-view");
          const active = target === (targetYaw > 43 ? "personal" : targetYaw < -43 ? "window" : "work");
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-pressed", String(active));
        });
      }
    };
    registerHotspots();
    window.Room3D.setView(window.room3DState ? window.room3DState.yaw : 0, window.room3DState ? window.room3DState.zoom : 1);
    window.addEventListener("resize", resize, { passive: true });
    resize();
    animate();
  }
}
