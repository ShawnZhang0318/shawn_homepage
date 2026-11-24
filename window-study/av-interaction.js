import * as THREE from 'three';

// Recorder parts and cassette bodies share the Z-up, metre-based frame in build_av.py.
function surfaceOf(group, name) {
  return group.children.find(child => child.material?.name === 'AV / ' + name);
}

function makeHingedFlap(recorder) {
  const flap = surfaceOf(recorder, 'flap');
  const edge = surfaceOf(recorder, 'edge');
  // The polished strip shares a primitive with the stationary eject key.
  const { index, attributes } = edge.geometry;
  const stripIndices = [], keyIndices = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const target = attributes.position.getZ(a) > 1.45 ? stripIndices : keyIndices;
    target.push(a, index.getX(i + 1), index.getX(i + 2));
  }
  const strip = edge.clone();
  strip.geometry = edge.geometry.clone();
  strip.geometry.setIndex(stripIndices);
  edge.geometry.setIndex(keyIndices);
  const hinge = new THREE.Group();
  hinge.position.set(.392, .463, 1.4814);
  recorder.add(hinge);
  for (const part of [flap, strip]) {
    hinge.add(part);
    part.position.sub(hinge.position);
  }
  return hinge;
}

// Cut a rectangular passage through the front panel, its printed face and the
// front wall of the chassis. Interpolate the existing panel artwork at cut edges.
const opening = { left: .338, right: .588, bottom: 1.4493, top: 1.4802, back: .207 };
function cutLoadingSlot(mesh) {
  const original = mesh.geometry;
  const index = original.index, pos = original.attributes.position;
  const normal = original.attributes.normal, uv = original.attributes.uv;
  const vertices = [], normals = [], texcoords = [], indices = [];
  function emit(poly) {
    const start = vertices.length / 3;
    for (const v of poly) {
      vertices.push(...v.slice(0,3)); normals.push(...v.slice(3,6));
      if (uv) texcoords.push(v[6],v[7]);
    }
    for (let i=1; i+1<poly.length; i++) indices.push(start,start+i,start+i+1);
  }
  const planes = [[1,opening.left,1],[1,opening.right,-1],[2,opening.bottom,1],[2,opening.top,-1],[0,opening.back,1]];
  for (let i=0; i<index.count; i+=3) {
    let poly = [0,1,2].map(k => {
      const j = index.getX(i+k);
      const v = [pos.getX(j),pos.getY(j),pos.getZ(j),normal.getX(j),normal.getY(j),normal.getZ(j)];
      if (uv) v.push(uv.getX(j),uv.getY(j));
      return v;
    });
    if (planes.some(([axis,bound,sign]) => poly.every(v => sign*(v[axis]-bound)<=0))) {
      emit(poly);
      continue;
    }
    for (const [axis,bound,sign] of planes) {
      const outside=[], inside=[];
      for (let k=0; k<poly.length; k++) {
        const a=poly[k], b=poly[(k+1)%poly.length];
        const da=sign*(a[axis]-bound), db=sign*(b[axis]-bound);
        (da<0 ? outside : inside).push(a);
        if ((da<0 && db>0) || (da>0 && db<0)) {
          const t=da/(da-db), cut=a.map((n,c)=>n+t*(b[c]-n));
          outside.push(cut); inside.push(cut);
        } else if (da===0) {
          outside.push(a);
        }
      }
      if (outside.length>=3) emit(outside);
      poly=inside;
      if (poly.length<3) break;
    }
  }
  const cut = new THREE.BufferGeometry();
  cut.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  cut.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  if (uv) cut.setAttribute('uv',new THREE.Float32BufferAttribute(texcoords,2));
  cut.setIndex(indices);
  mesh.geometry = cut;
  original.dispose();
}

function openLoadingBay(recorder) {
  for (const name of ['metal','case','vcr','shadow']) cutLoadingSlot(surfaceOf(recorder,name));
  const {left,right,bottom,top,back}=opening, front=.3914;
  const shell=new THREE.BoxGeometry(front-back,right-left,top-bottom);
  // BoxGeometry emits its +X end first. Leave the front of the tape well open.
  shell.setIndex(Array.from(shell.index.array).slice(6));
  shell.clearGroups();
  const well=new THREE.Mesh(shell,new THREE.MeshStandardMaterial({
    color:0x181a1b,roughness:.87,side:THREE.BackSide,
  }));
  well.position.set((back+front)/2,(left+right)/2,(top+bottom)/2);
  recorder.add(well);
}

const ease = THREE.MathUtils.smootherstep;
export function installTapeDeck(room, reduced, videoSource) {
  const monitor = room.getObjectByName('M01');
  const recorder = room.getObjectByName('M02');
  const pack = room.getObjectByName('M03-TAPE-01');
  if (!monitor || !recorder || !pack) return null;

  const screen = surfaceOf(monitor, 'screen');
  const originalScreen = screen.material;
  const hinge = makeHingedFlap(recorder);
  openLoadingBay(recorder);
  // The complete 198 × 119 × 29.27 mm labelled block travels as one assembly.
  const clearOfShelf = new THREE.Vector3(.19, 0, .0448);
  const aligned = new THREE.Vector3(.114, -.339, .0448);
  const seated = new THREE.Vector3(-.052, -.339, .0448);
  let state = 'shelved', started, moving = false, video, videoMaterial;

  function prepareVideo() {
    if (!videoSource || video) return;
    video = document.createElement('video');
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoSource;
    const texture = new THREE.VideoTexture(video);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    videoMaterial = new THREE.MeshBasicMaterial({map: texture, side: originalScreen.side, toneMapped: false});
    // Prime playback with the tape-click gesture. The TV switches inputs only
    // when the transport is seated and the video actually starts playing.
    video.muted = true;
    video.play().then(() => {
      if (moving) { video.pause(); video.currentTime = 0; }
    }).catch(() => {});
    video.addEventListener('playing', () => {
      if (!moving) { screen.material = videoMaterial; state = 'playing'; }
    });
    video.addEventListener('ended', () => { state = 'loaded'; });
    video.addEventListener('error', () => {
      screen.material = originalScreen;
      if (!moving) state = 'media-error';
    });
  }

  function playVideo() {
    if (!video) return;
    video.muted = false;
    video.currentTime = 0;
    video.play().then(() => { screen.material = videoMaterial; state = 'playing'; })
      .catch(() => { screen.material = originalScreen; state = video.error ? 'media-error' : 'loaded'; });
  }

  function update(now) {
    if (!moving) return;
    const t = reduced.matches ? 2.9 : (now - started) / 1000;
    if (t < .7) {
      pack.position.copy(clearOfShelf).multiplyScalar(ease(t,0,.7));
    } else if (t < 1.8) {
      state = 'aligning';
      pack.position.copy(clearOfShelf);
      pack.position.y = aligned.y*ease(t,.7,1.50);
      pack.position.x = THREE.MathUtils.lerp(clearOfShelf.x,aligned.x,ease(t,1.42,1.8));
    } else {
      state = 'inserting';
      pack.position.lerpVectors(aligned,seated,ease(t,1.8,2.61));
    }
    hinge.rotation.y = Math.PI/2 * ease(t,1.38,1.8) * (1-ease(t,2.61,2.9));
    if (t >= 2.9) {
      moving = false;
      state = 'loaded';
      playVideo();
    }
  }

  return {
    get state() { return state; },
    update,
    click(object, camera) {
      for (let part = object; part; part = part.parent) {
        if (part === monitor && camera.focusId === 'M01' && !moving && video && state !== 'playing') {
          playVideo();
          return true;
        }
        if (part !== pack) continue;
        if (camera.focusId !== 'M01') { camera.focus('M01'); return true; }
        if (state === 'shelved') {
          state = 'lifting';
          started = performance.now();
          moving = true;
          prepareVideo();
        }
        return true;
      }
      return false;
    }
  };
}
