/* Interior reflection field: cool bay glazing, warm practicals and diffuse ceiling.
   Radiance is linear HDR. PMREM filters this field per material roughness. */
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export function addInteriorSoftness(scene, camera) {
  const size = new THREE.Vector2();
  const uniforms = { frame: { value: null }, pixel: { value: new THREE.Vector2() } };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, blending: THREE.NoBlending, depthWrite: false,
    depthFunc: THREE.GreaterDepth, toneMapped: false,
    vertexShader: `
      varying vec2 coord;
      void main() {
        coord = uv;
        // The room is under 10 m across. Only fragments with a nearer
        // opaque surface pass the depth test; the river and sky pass through.
        vec4 cutoff = projectionMatrix * vec4(0., 0., -12., 1.);
        gl_Position = vec4(position.xy, cutoff.z / cutoff.w, 1.);
      }`,
    fragmentShader: `
      uniform sampler2D frame;
      uniform vec2 pixel;
      varying vec2 coord;
      void main() {
        vec2 x = vec2(pixel.x, 0.), y = vec2(0., pixel.y);
        vec3 neighbours = texture2D(frame, coord+x).rgb + texture2D(frame, coord-x).rgb
                        + texture2D(frame, coord+y).rgb + texture2D(frame, coord-y).rgb;
        gl_FragColor = vec4(.68 * texture2D(frame, coord).rgb + .08 * neighbours, 1.);
      }`,
  });
  const pass = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  pass.frustumCulled = false;
  pass.renderOrder = Infinity;
  // Only the final eye view runs the filter. Rain and cabinet reflection
  // captures use their existing layers, without copying or filtering them.
  pass.layers.set(2);
  camera.layers.enable(2);
  pass.raycast = () => {};
  pass.onBeforeRender = renderer => {
    renderer.getDrawingBufferSize(size);
    let frame = uniforms.frame.value;
    if (!frame || frame.image.width !== size.x || frame.image.height !== size.y) {
      frame?.dispose();
      frame = new THREE.FramebufferTexture(size.x, size.y);
      frame.minFilter = frame.magFilter = THREE.LinearFilter;
      uniforms.frame.value = frame;
    }
    uniforms.pixel.value.set(.85 / size.x, .85 / size.y).multiplyScalar(renderer.getPixelRatio());
    renderer.copyFramebufferToTexture(frame);
  };
  scene.add(pass);
}

export function lightStudy(renderer, scene) {
  const w=256,h=128, texels=new Float32Array(w*h*4);
  const lobes=[
    [[-1,.20,.30], [1.35,1.87,2.8], 13],
    [[.72,.40,-.45], [2.5,1.52,.69], 20],
    [[-.32,.15,-.93], [2.8,1.80,.91], 35],
    [[.1,.80,.42], [1.25,.93,.69], 5],
  ].map(([dir,color,power])=>[new THREE.Vector3(...dir).normalize(),color,power]);
  const direction=new THREE.Vector3();
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const phi=((x+.5)/w-.5)*2*Math.PI, lat=((y+.5)/h-.5)*Math.PI;
    direction.set(Math.cos(phi)*Math.cos(lat),Math.sin(lat),Math.sin(phi)*Math.cos(lat));
    const idx=4*(y*w+x);
    const rgb=[.13,.11,.085];
    for(const [axis,color,power] of lobes){
      const l=Math.pow(Math.max(0,direction.dot(axis)),power);
      for(let i=0;i<3;i++)rgb[i]+=color[i]*l;
    }
    texels.set([...rgb,1],idx);
  }
  const field=new THREE.DataTexture(texels,w,h,THREE.RGBAFormat,THREE.FloatType);
  field.mapping=THREE.EquirectangularReflectionMapping;field.needsUpdate=true;
  const pmrem=new THREE.PMREMGenerator(renderer);
  const reflection=pmrem.fromEquirectangular(field);
  scene.environment=reflection.texture;scene.environmentIntensity=.34;
  pmrem.dispose();field.dispose();
  scene.background=new THREE.Color('#171924');
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  // Furniture is static; animate only the separately held sheet, outside the shadow cache.
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  scene.add(new THREE.HemisphereLight(0xbac9e3,0x867561,.19));
  const windowFill=new THREE.DirectionalLight(0xbbcff3,.26);
  windowFill.position.set(-6.3,2.2,.5);windowFill.target.position.set(-3.4,.78,-1.3);
  windowFill.castShadow=true;
  windowFill.shadow.mapSize.set(1024,1024);
  Object.assign(windowFill.shadow.camera,{left:-3.9,right:3.9,top:3.1,bottom:-3.1,near:.1,far:11});
  windowFill.shadow.camera.updateProjectionMatrix();
  // The rain refraction capture is the first render in a frame and uses layer 1.
  // Pin the static shadow pass to both room layers, independent of that camera.
  windowFill.shadow.camera.layers.enable(1);
  windowFill.shadow.normalBias=.003;
  scene.add(windowFill,windowFill.target);
  // Broad indirect illumination from the opal fixture on the painted ceiling and walls.
  const ceilingBounce = new THREE.HemisphereLight(0xffecda, 0xc5a48c, .34);
  scene.add(ceilingBounce);
  return ceilingBounce;
}

export function finishShadows(room){
  // Move the fixture and both lighting nodes together in the room's Z-up frame.
  const ceilingOffset = new THREE.Vector3(-.74, -.12, 0);
  room.getObjectByName('L03-CEILING').position.add(ceilingOffset);
  const groups = { desk: {bit:1}, picture: {bit:2}, floor: {bit:4} };
  for (const group of Object.values(groups)) {
    group.lights = []; group.surfaces = []; group.on = true;
  }
  const hits = new Map();
  const pictureFittings = new Set();
  const floorReflection = {value:1};
  // Use the room's Z-up mounting frame, shared by the desk and its light nodes.
  const deskFrame = room.getObjectByName('L03-CEILING').parent;
  for (const node of [...deskFrame.children]) {
    if (/^(Desk.reflector|Writing.surface.bounce)/.test(node.name)) node.removeFromParent();
  }
  RectAreaLightUniformsLib.init();
  // Model the illuminated opening just below the rolled lip of the shade.
  const aperture = new THREE.RectAreaLight(0xffe3c5, 78, .17, .17);
  aperture.name = 'Desk shade aperture';
  aperture.position.set(1.066,.4625,1.093);
  aperture.rotation.y = .12;
  // LTC derives the emitting side from the winding of its rectangle. Restore
  // that winding inside the room's mirrored coordinate frame.
  aperture.scale.x = -1;

  const bounce = new THREE.RectAreaLight(0xffcf9e, 3.2, .56, .32);
  bounce.name = 'Light returned by the writing surface';
  bounce.position.set(1.18,.43,.755);
  bounce.rotation.x = Math.PI;
  bounce.scale.x = -1;

  // A weaker direct component supplies contact and cast shadows. The broad
  // penumbra fades before the geometric cutoff at the cone boundary.
  const direct = new THREE.SpotLight(0xffdab5, .62, 2.8, 1.42, .92, 2);
  direct.name = 'Desk lamp shadow light';
  direct.position.copy(aperture.position);
  direct.target.position.set(1.02,.4625,.74);
  direct.castShadow = true;
  direct.shadow.mapSize.setScalar(512);
  direct.shadow.camera.near = .025;
  direct.shadow.camera.layers.enable(1);
  direct.shadow.radius = 3;
  direct.shadow.bias = -.00018;
  direct.shadow.normalBias = .001;
  deskFrame.add(aperture,bounce,direct,direct.target);
  for (const light of [aperture,bounce,direct]) groups.desk.lights.push([light,light.intensity]);
  const lampSettings = [
    [/^Picture.tube/, 'picture', .056, 0xffe9d2, .64],
    [/^Floor.lamp.shade/, 'floor', 1.42, 0xffdfa9, 3.4],
    [/^Floor.lamp.uplight/, 'floor', 2.10, 0xffdbad, 3.3],
    [/^Central.opal.downlight/, null, 9.7, 0xffecda, 7.2],
    [/^Central.diffuse.floor.return/, null, 1.60, 0xffe3c8, 6],
    [/^Window.seat.spill/, null, .19, 0xc8d9ff, 2.3],
    [/^Monitor.wall.bounce/, null, .15, 0xc5d8f2, 1.6],
    [/^Bookcase.wash/, null, .075, 0xffe4c8, .9],
  ];
  room.traverse(o=>{
    if(o.isMesh){
      const m=o.material;
      if(m.name==='window' && !m.userData.paneReflection) reflectLamp(m, floorReflection);
      const group=o.parent?.name||'';
      o.receiveShadow=!m.transparent && !m.isMeshBasicMaterial;
      // Exterior and enclosing architecture are outside the interior key's emitting area.
      o.castShadow=o.receiveShadow && !/^(WALL|CEIL|OUT-|SH-|FLOOR|W[123]$|P02)/.test(group) && m.name!=='notepaper';
      let fixture;
      if (/^L01(?:_|$)/.test(o.name) || group === 'L01') fixture = 'desk';
      if (group === 'L02') fixture = 'floor';
      if (group === 'D03' && ['lampbodybluegray','light'].includes(m.name)) fixture = 'picture';
      if (group === 'D03' && ['paperwhite','steel'].includes(m.name)) pictureFittings.add(o);
      if (fixture) {
        hits.set(o,fixture);
        if (m.name==='Frosted desk bulb') o.castShadow=false;
        const radiance = {
          'ivory-lampshade-lit':[0xffdba5,.85], light:[0xffddae,1.52],
          'Frosted desk bulb':[0xffdfb0,1.9], paperwhite:[0xffe1bb,.97],
        }[m.name];
        if (radiance) {
          const surface = o.material = m.clone();
          surface.emissive.setHex(radiance[0]);
          surface.emissiveIntensity = radiance[1];
          if (m.name==='ivory-lampshade-lit') {
            surface.onBeforeCompile=shader=>{
              shader.vertexShader='varying vec3 vFixtureLocal;\n'+shader.vertexShader
                .replace('#include <begin_vertex>','#include <begin_vertex>\nvFixtureLocal=position;');
              shader.fragmentShader='varying vec3 vFixtureLocal;\n'+shader.fragmentShader
                .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n'+
                  'totalEmissiveRadiance *= 0.40 + 0.98 * exp(-pow(abs(vFixtureLocal.z-1.608)/0.093,2.0));');
            };
            surface.customProgramCacheKey=()=> 'linen-shade';
          }
          groups[fixture].surfaces.push([surface,radiance[1]]);
        }
      }
    }
    if (o.isLight) {
      if (/^Central[ _]/.test(o.name)) o.position.add(ceilingOffset);
      const setting=lampSettings.find(([pattern])=>pattern.test(o.name));
      if (setting) {
        const [,id,power,color,range]=setting;
        o.color.setHex(color); o.intensity=power; o.distance=range;
        if (id) groups[id].lights.push([o,power]);
      }
      if (o.isSpotLight && /Central.opal.downlight/.test(o.name)){
        o.castShadow=true;
        o.shadow.mapSize.setScalar(1536);
        o.shadow.camera.near=.08;
        o.shadow.camera.layers.enable(1);
        o.shadow.bias=-.00022; o.shadow.normalBias=.0027;
        o.angle=1.29;
        o.penumbra=.73;
      }
    }
  });
  function fixture(hit) {
    const mesh=hit?.object ?? hit;
    if (pictureFittings.has(mesh) && hit.point && hit.point.y>2.575) return 'picture';
    return hits.get(mesh);
  }
  return {
    fixture,
    get mask() {
      return Object.values(groups).reduce((bits, group) => bits | (group.on ? group.bit : 0), 0);
    },
    toggle(hit) {
      const id = fixture(hit);
      if (!id) return false;
      const group=groups[id];
      group.on=!group.on;
      for (const [source,intensity] of group.lights) source.intensity=group.on ? intensity : 0;
      for (const [surface,intensity] of group.surfaces) surface.emissiveIntensity=group.on ? intensity : 0;
      if (id==='floor') floorReflection.value=group.on ? 1 : .08;
      return true;
    },
  };
}

// Analytic reflection of the existing floor lamp diffuser, clipped by each real pane.
// Ray and plane normals are evaluated in view space, so the cue moves with the eye.
function reflectLamp(material, floorReflection) {
  material.userData.paneReflection=true;
  material.depthWrite=false;
  material.onBeforeCompile=shader=>{
    shader.uniforms.floorLampReflection = floorReflection;
    shader.fragmentShader = 'uniform float floorLampReflection;\n' + shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 reflectedRay = reflect(-normalize(vViewPosition),normalize(normal));
      vec3 lampCenter = (viewMatrix * vec4(-5.97,1.615,-1.43,1.)).xyz;
      vec3 toLamp = lampCenter + vViewPosition;
      float rayDistance = dot(toLamp,reflectedRay);
      vec3 miss = inverseTransformDirection(normalize(toLamp-reflectedRay*rayDistance+vec3(.000001)),viewMatrix)
                  * length(toLamp-reflectedRay*rayDistance);
      float shade = (1.-smoothstep(.86,1.12,length(miss/vec3(.21,.118,.21))))*step(0.,rayDistance)*floorLampReflection;
      float grazing = pow(1.-abs(dot(normalize(vViewPosition),normal)),5.);
      diffuseColor.a = .02+.045*grazing+shade*(.034+.085*grazing);
      outgoingLight = mix(outgoingLight,vec3(.96,.70,.41),shade);
      #include <opaque_fragment>`);
  };
}
