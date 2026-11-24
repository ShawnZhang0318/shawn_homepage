import * as THREE from 'three';

// Each vessel is built bow-first along local X. Section dimensions and cabin
// coordinates are fractions of its length, with Y=0 at the waterline.
const hullSections = [
  [-.50, .052, .024], [-.47, .078, .034], [-.29, .091, .037],
  [.12, .090, .038], [.31, .077, .042], [.43, .044, .049], [.50, .002, .056],
];
const atlasHeight = .16;

function cabinLights(decks, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let state = seed;
  function random() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  }
  for (const {stern, bow, floor, roof} of decks) {
    let x = stern + .023;
    while (x < bow - .033) {
      const width = Math.min(.016 + .025 * random(), bow - .024 - x);
      const level = .36 + .64 * random() ** .65;
      const warmth = random();
      const top = (1 - (roof - .006) / atlasHeight) * canvas.height;
      const bottom = (1 - (floor + .006 + random() * .004) / atlasHeight) * canvas.height;
      const left = (x + .5) * canvas.width;
      const color = (v) => 'rgb(' + [232, 175 + warmth * 30, 116 + warmth * 64]
        .map(channel => Math.round(channel * level * v)).join(',') + ')';
      const shade = ctx.createLinearGradient(0, top, 0, bottom);
      shade.addColorStop(0, color(.77));
      shade.addColorStop(.32, color(1));
      shade.addColorStop(1, color(.60));
      ctx.fillStyle = shade;
      ctx.fillRect(left, top, width * canvas.width, bottom - top);
      // Cabin partitions, partially drawn blinds and the occasional silhouette.
      if (random() < .52) {
        ctx.fillStyle = 'rgba(14,12,12,.73)';
        ctx.fillRect(left, top, width * canvas.width * (.18 + .43 * random()), bottom - top);
      }
      x += width + .005 + random() * .013;
    }
    // A lit doorway and its overhead fixture pick out one end of each deck.
    const door = (stern + .55) * canvas.width;
    const sill = (1 - (floor + .005) / atlasHeight) * canvas.height;
    const lintel = (1 - (roof - .006) / atlasHeight) * canvas.height;
    ctx.fillStyle = '#cfa076';
    ctx.fillRect(door, lintel, 5, sill-lintel);
    ctx.fillStyle = '#fff1d0';
    ctx.fillRect(door-1, lintel, 7, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Four vertices per cross-section. Flare, sheer and changes in beam give
// the bow, side and transom distinct profiles even when viewed obliquely.
function shell(sections, length, material) {
  const positions = [], indices = [];
  for (const [x, beam, top, bottom, lowerBeam] of sections) {
    for (const [y, z] of [[bottom, -lowerBeam], [top, -beam], [top, beam], [bottom, lowerBeam]]) {
      positions.push(x * length, y * length, z * length);
    }
  }
  for (let i = 0; i + 1 < sections.length; i++) {
    for (let edge = 0; edge < 4; edge++) {
      const a = 4 * i + edge, b = 4 * i + (edge + 1) % 4;
      indices.push(a, b, b + 4, a, b + 4, a + 4);
    }
  }
  const end = positions.length / 3 - 4;
  indices.push(0, 3, 2, 0, 2, 1, end, end + 1, end + 2, end, end + 2, end + 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return new THREE.Mesh(geometry, material);
}

// Both the saloon glass and the broken light on the water sample this same
// radiance field. Local changes affect a few bays at a time.
const lighting = `
  uniform sampler2D lamps;
  uniform float seconds, lengthM;
  vec3 cabin(vec2 p) {
    vec2 uv = vec2(p.x + .5, p.y / .16);
    vec3 light = texture2D(lamps, clamp(uv, 0., 1.)).rgb;
    float shadow = smoothstep(.55,.94,sin(p.x*37.+seconds*.17)*sin(p.x*21.-seconds*.29));
    return light * (1.0 - .25*shadow);
  }
`;

function paint(lamps, seconds, length, lit, color) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {lamps: {value: lamps}, seconds, lengthM: {value: length}, base: {value: new THREE.Color(color)}},
    vertexShader: `
      varying vec3 local; varying float haze;
      void main(){
        local=position;
        vec4 view=modelViewMatrix*vec4(position,1.);
        haze=exp(-.006*length(view.xyz));
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader: `
      ${lighting}
      uniform vec3 base; varying vec3 local; varying float haze;
      void main(){
        vec3 n=normalize(cross(dFdx(local),dFdy(local)));
        float sky=abs(n.y);
        vec3 c=base*(.68+.47*sky+.12*n.z);
        ${lit ? 'c+=cabin(local.xy/lengthM)*abs(n.z);' : ''}
        gl_FragColor=vec4(mix(vec3(.035,.029,.043),c,haze),1.);
        #include <colorspace_fragment>
      }`,
  });
}

function reflectedCabin(lamps, seconds, length) {
  // A horizontal patch at the waterline. Trace back from each small wave
  // toward the lit side of the vessel; oblique views shift the streaks.
  const geometry = new THREE.PlaneGeometry(length * 2.5, length * 6);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {lamps: {value: lamps}, seconds, lengthM: {value: length}},
    vertexShader: `
      varying vec3 local, eye, world;
      void main(){
        local=position; world=(modelMatrix*vec4(position,1.)).xyz;
        vec3 ray=cameraPosition-world;
        eye=vec3(dot(ray,modelMatrix[0].xyz),ray.y,dot(ray,modelMatrix[2].xyz));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader: `
      ${lighting}
      varying vec3 local, eye, world;
      float hash(vec2 p){return fract(sin(dot(p,vec2(17.13,91.7)))*4375.23);}
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
      }
      void main(){
        vec3 p=local/lengthM;
        float reach=abs(p.z)-.066;
        if(reach<0. || p.z*eye.z<=0.) discard;
        vec2 water=world.xz;
        float wave=noise(vec2(dot(water,vec2(.8,.6))*14.+seconds*.26,
                              dot(water,vec2(-.6,.8))*64.-seconds*.94));
        float swell=noise(water*7.+vec2(seconds*.23,0.));
        vec2 hit=vec2(p.x-reach*eye.x/max(abs(eye.z),.01),reach*eye.y/max(abs(eye.z),.01));
        hit+=reach*vec2((swell-.5)*.16,(wave-.5)*.14);
        float spread=.008+.021*reach;
        vec3 lit=cabin(hit)*.5+(cabin(hit+vec2(spread,.004))+cabin(hit-vec2(spread,.004)))*.25;
        float crest=smoothstep(.27,.72,wave)*exp(-1.45*reach);
        gl_FragColor=vec4(lit,.69*crest);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(geometry, material);
}

function vessel(length, decks, seed, seconds) {
  const group = new THREE.Group();
  const lamps = cabinLights(decks, seed);
  const hull = paint(lamps, seconds, length, false, '#363745');
  const walls = paint(lamps, seconds, length, true, '#414047');
  const roofPaint = paint(lamps, seconds, length, false, '#47464b');
  group.add(shell(hullSections.map(([x,b,y]) => [x,b,y,0,b*.73]), length, hull));
  for (const {stern, bow, floor, roof, beam} of decks) {
    const frames = [[stern, .72], [stern+.027, 1], [bow-.046, 1], [bow,.68]];
    group.add(shell(frames.map(([x,b]) => [x,b*beam,roof,floor,b*beam*1.05]), length, walls));
    group.add(shell(frames.map(([x,b]) => [x,b*beam+.004,roof+.003,roof,b*beam+.004]), length, roofPaint));
  }
  group.add(reflectedCabin(lamps, seconds, length));
  group.traverse(o => { o.layers.enable(1); o.raycast = () => {}; });
  return group;
}

// A closed route in the horizontal plane. The rounded ends join the two
// parallel legs tangentially so the bow leads through both turns.
function riverPass(distance, halfRun, bend) {
  const leg = 2 * halfRun, turn = Math.PI * bend;
  const lap = 2 * (leg + turn);
  let s = THREE.MathUtils.euclideanModulo(distance, lap);
  if (s < leg) return {x: s - halfRun, z: -bend, dx: 1, dz: 0};
  s -= leg;
  if (s < turn) {
    const a = s / bend;
    return {x: halfRun + bend*Math.sin(a), z: -bend*Math.cos(a), dx: Math.cos(a), dz: Math.sin(a)};
  }
  s -= turn;
  if (s < leg) return {x: halfRun - s, z: bend, dx: -1, dz: 0};
  const a = (s - leg) / bend;
  return {x: -halfRun - bend*Math.sin(a), z: bend*Math.cos(a), dx: -Math.cos(a), dz: -Math.sin(a)};
}

export function addRiverBoats(scene, toWorld, seconds) {
  const routes = [
    {name:'Evening ferry', length:1.80, riverDepth:31, halfRun:6.2, bend:1.45, offset:5.5, speed:-.090, seed:37,
      decks:[{stern:-.41,bow:.38,floor:.036,roof:.085,beam:.069},
             {stern:.05,bow:.32,floor:.085,roof:.117,beam:.053}]},
    {name:'River excursion boat', length:2.225, riverDepth:24.5, halfRun:5.4, bend:1.70, offset:-3.2, speed:.100, seed:73,
      decks:[{stern:-.40,bow:.37,floor:.037,roof:.079,beam:.070},
             {stern:-.28,bow:.28,floor:.082,roof:.118,beam:.058}]},
  ];
  const riverOrigin = toWorld([5.82,-.29,-2.23]);
  const forward = toWorld([.6,-.8,0]), across = toWorld([.8,.6,0]);
  const tangent = new THREE.Vector3();
  for (const route of routes) {
    route.boat = vessel(route.length, route.decks, route.seed, seconds);
    route.boat.name = route.name;
    scene.add(route.boat);
  }
  return () => {
    for (const r of routes) {
      const path = riverPass(r.halfRun + r.offset + seconds.value*r.speed, r.halfRun, r.bend);
      r.boat.position.copy(riverOrigin).addScaledVector(across,path.x).addScaledVector(forward,r.riverDepth + path.z);
      tangent.copy(across).multiplyScalar(path.dx).addScaledVector(forward,path.dz).multiplyScalar(Math.sign(r.speed));
      r.boat.rotation.y = Math.atan2(-tangent.z, tangent.x);
    }
  };
}
