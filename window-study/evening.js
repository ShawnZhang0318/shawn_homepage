/* Interior reflection field: cool bay glazing, warm practicals and diffuse ceiling.
   Radiance is linear HDR. PMREM filters this field per material roughness. */
import * as THREE from 'three';

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
  scene.add(new THREE.HemisphereLight(0xc2c9e2,0x80644f,.29));
  const key=new THREE.DirectionalLight(0xffd2a1,.32);
  key.position.set(-1.65,2.72,-3.9);key.target.position.set(-2.9,.66,-.62);
  key.castShadow=true;key.shadow.mapSize.set(512,512);key.shadow.radius=4;
  Object.assign(key.shadow.camera,{left:-4.2,right:4.2,top:3,bottom:-3,near:.06,far:12});key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias=.003;key.shadow.bias=-.00015;
  scene.add(key,key.target);
  const windowFill=new THREE.DirectionalLight(0xa6baf5,.25);
  windowFill.position.set(-6.3,2.2,.5);windowFill.target.position.set(-3.4,.78,-1.3);
  scene.add(windowFill,windowFill.target);
  // Broad indirect illumination from the opal fixture on the painted ceiling and walls.
  const ceilingBounce = new THREE.HemisphereLight(0xffe5c7, 0xd5b499, 1.05);
  scene.add(ceilingBounce);
  return ceilingBounce;
}

export function finishShadows(room){
  room.traverse(o=>{
    if(o.isMesh){
      const m=o.material;
      if(m.name==='window' && !m.userData.paneReflection) reflectLamp(m);
      const group=o.parent?.name||'';
      o.receiveShadow=!m.transparent && !m.isMeshBasicMaterial;
      // Exterior and enclosing architecture are outside the interior key's emitting area.
      o.castShadow=o.receiveShadow && !/^(WALL|CEIL|OUT-|SH-|FLOOR|W[123]$|P02)/.test(group) && m.name!=='notepaper';
    }
    if(o.isSpotLight && /Desk.reflector/.test(o.name)){
      o.castShadow=true;o.shadow.mapSize.set(512,512);
      o.shadow.camera.near=.015;o.shadow.bias=-.001;o.shadow.normalBias=.001;
    }
  });
}

// Analytic reflection of the existing floor lamp diffuser, clipped by each real pane.
// Ray and plane normals are evaluated in view space, so the cue moves with the eye.
function reflectLamp(material) {
  material.userData.paneReflection=true;
  material.depthWrite=false;
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 reflectedRay = reflect(-normalize(vViewPosition),normalize(normal));
      vec3 lampCenter = (viewMatrix * vec4(-5.97,1.615,-1.43,1.)).xyz;
      vec3 toLamp = lampCenter + vViewPosition;
      float rayDistance = dot(toLamp,reflectedRay);
      vec3 miss = inverseTransformDirection(normalize(toLamp-reflectedRay*rayDistance+vec3(.000001)),viewMatrix)
                  * length(toLamp-reflectedRay*rayDistance);
      float shade = (1.-smoothstep(.86,1.12,length(miss/vec3(.21,.118,.21))))*step(0.,rayDistance);
      float grazing = pow(1.-abs(dot(normalize(vViewPosition),normal)),5.);
      diffuseColor.a = .02+.045*grazing+shade*(.034+.085*grazing);
      outgoingLight = mix(outgoingLight,vec3(.96,.70,.41),shade);
      #include <opaque_fragment>`);
  };
}
