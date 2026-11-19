import * as THREE from 'three';

// A living night view of Lujiazui behind the bay window.
//
// The photograph sits on the same arc the arc study approved (same anchor,
// bearing and height per photo row), but it is drawn by a shader that keeps
// the city awake: office windows switch on and off, LED facades breathe,
// aircraft beacons blink on the tower tops, cruise boats cross the river and
// the reflections shimmer. Rain falls between the glass and the city, and
// drops on the panes refract a buffer of the city drawn from the same eye.

const PHOTO = new URL('./bund-night.jpg', import.meta.url).href;
const PX = [2000, 667];            // photo size in pixels; shader coordinates are in these pixels
const SHORE = .752;                // photo row where the far bank meets the river
// Tower tops, in photo pixels: Oriental Pearl, Shanghai Tower, SWFC (two corners), Jin Mao.
const BEACONS = [[809, 16, 0], [1238, 37, .35], [1099, 149, .6], [1157, 149, .62], [1044, 171, .2]];

const GLSL_NOISE = /* glsl */`
float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5; } return s; }
float lum(vec3 c){ return dot(c,vec3(.2126,.7152,.0722)); }
`;

// ---------------------------------------------------------------- the city
function arcGeometry(toWorld) {
  const radius = 42, segments = 160;
  const height = v => 1.87 + 48.75 * (-.09 + (.75 - v) * Math.PI / 9);
  // [photo row, height in room metres]. Rows outside 0..1 are drawn by the shader:
  // above is sky, below is more river nearer the building.
  const rows = [[-1.6, 62], [0, height(0)], [1, height(1)], [1.6, -15], [2.6, -40]];
  const vertices = [], uv = [], indices = [];
  for (let j = 0; j < rows.length; j++) {
    const [v, z] = rows[j];
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const edge = Math.max(0, (Math.abs(u - .5) - .28) / .22);
      const bearing = THREE.MathUtils.degToRad(6.7 + 70 * (u - .5) + Math.sign(u - .5) * 30 * edge * edge);
      const forward = radius * Math.cos(bearing), side = radius * Math.sin(bearing);
      const p = toWorld([5.82 + .6 * forward + .8 * side, -.29 - .8 * forward + .6 * side, z]);
      vertices.push(p.x, p.y, p.z);
      uv.push(u, v);
      if (i && j) {
        const k = j * (segments + 1) + i;
        indices.push(k - segments - 2, k - 1, k, k - segments - 2, k, k - segments - 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  return g;
}

const cityFragment = /* glsl */`
uniform sampler2D map; uniform float uTime, uGain, uRain;
varying vec2 vP;
const vec2 PX=vec2(${PX[0]}.,${PX[1]}.);
const float SHORE=${SHORE};
${GLSL_NOISE}
vec3 photo(vec2 uv){ return texture2D(map,vec2(uv.x,1.-clamp(uv.y,.0005,.9995))).rgb; }

// The river: the photographed reflections, displaced by moving ripples that
// grow toward the viewer. Below the photo the water band is mirrored onward.
vec3 river(vec2 uv,float t){
  float v=uv.y, near=v-SHORE;
  float vv=v;
  if(v>1.){ float k=(v-1.)/.2; vv=1.-abs(fract(k*.5)*2.-1.)*.2; near=.25+(v-1.)*.6; }
  float s=1.+near*16.;
  vec2 q=vec2(uv.x*PX.x/(9.*s),v*PX.y/(1.5*s));
  float n=vn(q+vec2(t*.12,-t*.8))+.55*vn(q*2.3+vec2(-t*.2,-t*1.3));
  float n2=vn(q*1.7+vec2(4.,-t*1.1));
  vec2 off=vec2((n-.78)*2.4*s,(n2-.5)*.9*s)/PX;
  vec2 p=vec2(uv.x,vv)+off;
  vec3 c=(photo(p)+photo(p+vec2(0.,s*.9/PX.y))+photo(p-vec2(0.,s*.9/PX.y)))/3.;
  c*=.82+.5*pow(n2,3.);                                  // glints on the crests
  c*=mix(1.,.45,smoothstep(1.,2.5,v));                   // nearer water holds less light
  return mix(photo(uv),c,smoothstep(0.,.012,near));      // the shoreline stays crisp
}

// Office windows: a few switch off or on over minutes, a few hold a television.
vec3 windows(vec3 c,vec2 uv,float t){
  float L=lum(c), mx=max(c.r,max(c.g,c.b)), sat=(mx-min(c.r,min(c.g,c.b)))/max(mx,1e-4);
  float above=1.-smoothstep(SHORE-.02,SHORE-.005,uv.y);
  float office=smoothstep(.06,.22,L)*(1.-smoothstep(.42,.68,sat))*above;
  vec2 cell=floor(uv*PX/vec2(3.,2.));
  float r=h12(cell);
  float slot=floor(t/(30.+r*70.)+r*13.);
  float s=h12(cell+slot*7.31);
  float k=mix(1.,.18,step(s,.07));
  k*=mix(1.,.65+.35*sin(t*7.+r*40.)*sin(t*2.3+r*9.),step(.988,s));
  c*=mix(1.,k,office);
  // LED facades (the saturated lights) breathe in a slow upward wave
  float led=smoothstep(.04,.2,L)*smoothstep(.45,.75,sat)*above;
  c*=1.+led*.16*sin(t*.7-uv.y*38.+uv.x*5.);
  return c;
}

// Red aircraft warning lights on the tower tops.
vec3 beacons(vec2 px,float t){
  vec3 add=vec3(0.);
  ${BEACONS.map(([x, y, ph]) => `{ float ph=fract(t*.5+${ph.toFixed(2)}); float on=smoothstep(0.,.04,ph)*(1.-smoothstep(.14,.22,ph));
    vec2 d=px-vec2(${x}.,${y}.); float e=dot(d,d); add+=vec3(1.,.07,.03)*on*(exp(-e/2.5)*2.4+exp(-e/45.)*.35); }`).join('\n  ')}
  return add;
}

// Night cruise boats crossing the river, with their reflections.
vec3 boat(vec3 c,vec2 px,float t,float i){
  float yb=SHORE*PX.y+16.+i*42.;                  // waterline row; nearer boats are lower and larger
  float L=46.+i*38., H=6.+i*5.;
  float period=170.+i*90.;
  float x=fract(t/period+.31+i*.43)*(PX.x+L*2.)-L;
  if(i>.5) x=PX.x-x;
  float dx=px.x-x, dy=yb-px.y;                    // dy>0 above the waterline
  float taper=L*.5-max(0.,dy)*1.2;
  if(abs(dx)<taper && dy>0. && dy<H){
    float row=dy/H;
    vec3 col=vec3(.004,.004,.006);
    float hue=fract(t*.05+i*.3+dx/L*.5);
    vec3 neon=.5+.5*cos(6.2832*(hue+vec3(0.,.33,.67)));
    col+=step(.82,row)*neon*1.6;                                            // roof outline
    col+=step(.38,row)*step(row,.66)*step(.35,fract(dx/3.2))*vec3(1.,.72,.38)*1.3; // cabin windows
    col+=step(row,.18)*vec3(.9,.8,.6)*.25*step(.6,fract(dx/7.));           // deck lights
    return col;
  }
  float ry=px.y-yb;                               // reflection below the hull
  if(abs(dx)<L*.5 && ry>0. && ry<H*3.5){
    float w=vn(vec2(dx*.25,ry*.9-t*3.));
    float fall=(1.-ry/(H*3.5));
    return c+vec3(1.,.7,.45)*.10*fall*fall*smoothstep(.45,.8,w)*(1.-abs(dx)/(L*.5));
  }
  return c;
}

void main(){
  float t=uTime;
  vec2 uv=vP; vec2 px=uv*PX;
  vec3 c;
  if(uv.y<0.){
    // sky above the photo: its top row, fading darker
    c=photo(vec2(uv.x,.004))*mix(1.,.45,smoothstep(0.,1.2,-uv.y));
  } else if(uv.y>SHORE){
    c=river(uv,t);
  } else {
    c=windows(photo(uv),uv,t);
  }
  // low cloud drifting over the sky, lit purple by the city underneath
  float base=lum(photo(vec2(uv.x,clamp(uv.y,0.,1.))));
  float sky=(1.-smoothstep(.03,.12,base))*(1.-smoothstep(.45,.62,uv.y));
  float cl=fbm(vec2(uv.x*7.+t*.0035,uv.y*4.2-t*.001));
  c+=sky*smoothstep(.42,.85,cl)*vec3(.030,.016,.045)*(.55+clamp(uv.y+.3,0.,1.));
  c+=beacons(px,t);
  if(uv.y>SHORE && uv.y<1.){ c=boat(c,px,t,0.); c=boat(c,px,t,1.); }
  // rain: a faint veil over the distance
  c=mix(c,vec3(.035,.03,.05),.07*uRain);
  gl_FragColor=vec4(c*uGain,1.);
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------- the rain
function rainMesh(count, frame, U) {
  let s = 20261119;
  const rnd = () => ((s = Math.imul(s ^ s >>> 15, s | 1) + 0x6D2B79F5 | 0), ((s ^ s >>> 7) >>> 0) / 4294967296);
  const a = new Float32Array(count * 4), b = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const f = frame.near + Math.pow(rnd(), 1.7) * 16;     // denser near the glass, where it reads
    a.set([(rnd() - .5) * (6 + f * 1.6), f, rnd() * 12, rnd()], i * 4);
    b.set([.75 + rnd() * .5, .6 + rnd() * .8], i * 2);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
  g.setIndex([0, 1, 2, 1, 3, 2]);
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 4));
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(b, 2));
  g.instanceCount = count;
  const m = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec4 aA; attribute vec2 aB;
      uniform float uTime, uRain; uniform vec3 uO, uF, uS; uniform vec2 uScreen; uniform sampler2D tCity;
      varying vec2 vQ; varying vec3 vC;
      void main(){
        float speed=7.5*aB.x;
        vec3 p=uO+uS*aA.x+uF*aA.y+vec3(0.,mod(aA.z-uTime*speed,12.)-5.,0.);
        float len=speed/30.*aB.y;                                  // one thirtieth of a second of its fall
        vec4 A=modelViewMatrix*vec4(p,1.), B=modelViewMatrix*vec4(p+(vec3(0.,1.,0.)+uS*.10)*len,1.);
        float pix=-A.z*2./(uScreen.y*projectionMatrix[1][1]);
        float W=.0011*aB.y, w=max(W,pix*.75);
        vec4 M=mix(A,B,position.y); M.x+=position.x*w;
        vec4 clip=projectionMatrix*M;
        vec2 suv=clamp(clip.xy/clip.w*.5+.5,0.,1.);
        vec3 c=texture(tCity,suv).rgb;
        float on=step(aA.w,uRain);
        vQ=position.xy;
        vC=(c*1.3+vec3(.010,.010,.013))*min(1.,W/w)*on*smoothstep(.4,1.4,-A.z);
        gl_Position=clip; if(on<.5) gl_Position=vec4(2.,2.,2.,1.);
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vQ; varying vec3 vC;
      void main(){ float k=(1.-vQ.x*vQ.x)*smoothstep(1.,.3,vQ.y)*smoothstep(0.,.08,vQ.y);
        gl_FragColor=vec4(vC*k,1.);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'Rain outside the bay'; mesh.frustumCulled = false; mesh.raycast = () => {};
  return mesh;
}

// ------------------------------------------------------- drops on the glass
const dropsGLSL = /* glsl */`
uniform sampler2D tCity; uniform vec2 uScreen; uniform float uTime, uRain;
varying vec3 vDropW;
${GLSL_NOISE}
// beads resting on the pane; each lands, sits, and slowly dries
vec4 beads(vec2 p,float cs,float seed,float t){
  vec2 q=p/cs, id=floor(q), f=fract(q)-.5;
  float r0=h12(id+seed);
  vec2 c=(vec2(h12(id+seed+3.1),h12(id+seed+7.7))-.5)*.5;
  float life=fract(t*.025*(.6+r0)+h12(id+seed+5.));
  float rad=mix(.10,.36,r0*r0)*smoothstep(0.,.03,life)*mix(1.,.55,life);
  rad*=step(seed>5.?.75:.55,h12(id+seed+11.));
  vec2 d=(f-c)/max(rad,1e-4); d.y*=1.15;
  float m=smoothstep(1.,.78,length(d))*step(.001,rad);
  return vec4(d,m,rad*cs);
}
// drops running down, each with a wet trail that clears the beads behind it
vec4 runners(vec2 p,float t,out float trail){
  float cw=.11, col=floor(p.x/cw), r=h12(vec2(col,3.7));
  trail=0.;
  if(r<.45) return vec4(0.);
  float span=2.4, speed=mix(.05,.16,h12(vec2(col,8.1)));
  float tt=t*speed+r*20.;
  tt+=.04*sin(t*1.3+r*30.);                        // stop and go
  float yd=span-mod(tt,span);
  float ly=mod(p.y,span);
  float xo=cw*(col+.5+.22*sin(ly*9.+r*6.));
  float dy=ly-yd, dx=p.x-xo;
  float rad=mix(.008,.013,r);
  vec2 d=vec2(dx,dy*.8)/rad;
  float m=smoothstep(1.,.75,length(d));
  float above=step(0.,dy)*(1.-smoothstep(0.,.35,dy));
  trail=above*smoothstep(.0055,.0025,abs(dx));
  float tm=above*smoothstep(.0028,.0012,abs(dx))*.55;
  vec2 tn=vec2(dx/.0028,0.);
  return vec4(mix(tn,d,m),max(m,tm),rad);
}
vec4 dropField(vec2 p,float t){
  float trail;
  vec4 r=runners(p,t,trail);
  vec4 a=beads(p,.034,1.,t), b=beads(p+.37,.016,9.,t*1.3);
  a.z*=1.-trail; b.z*=1.-trail;
  vec4 o=b; if(a.z>o.z) o=a; if(r.z>o.z) o=r;
  return o;
}
`;

function addDrops(material, U) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    Object.assign(shader.uniforms, { tCity: U.tCity, uScreen: U.uScreen, uTime: U.uTime, uRain: U.uRain });
    shader.vertexShader = 'varying vec3 vDropW;\n' + shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nvDropW=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader = dropsGLSL + shader.fragmentShader.replace('#include <opaque_fragment>', /* glsl */`
      {
        vec3 nW=inverseTransformDirection(normal,viewMatrix);
        vec3 tW=normalize(cross(vec3(0.,1.,0.),nW)+vec3(1e-5));
        vec2 g=vec2(dot(vDropW,tW),vDropW.y);
        float pxm=length(fwidth(g));                       // metres per pixel on the pane
        vec4 dr=dropField(g,uTime);
        float m=dr.z*(1.-smoothstep(.004,.012,pxm))*uRain;
        if(m>.001){
          float radPx=dr.w/max(pxm,1e-5);
          vec2 suv=gl_FragCoord.xy/uScreen-dr.xy*radPx*1.8/uScreen;   // a drop is a lens: the view turns over
          vec3 seen=texture2D(tCity,clamp(suv,0.,1.)).rgb;
          float rim=smoothstep(.5,1.,length(dr.xy));
          seen=seen*mix(1.2,.55,rim)+vec3(.012,.012,.016)*rim;
          vec3 n3=normalize(vec3(dr.xy,.7));
          seen+=vec3(1.,.8,.55)*.16*pow(max(0.,dot(n3,normalize(vec3(-.4,.55,.75)))),40.);
          outgoingLight=mix(outgoingLight,seen,m);
          diffuseColor.a=mix(diffuseColor.a,1.,m*.94);
        }
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'alive-drops';
  material.needsUpdate = true;
}

// ---------------------------------------------------------------- install
export async function installAliveCity({ scene, room, camera, renderer, toWorld, reduced }) {
  const texture = await new THREE.TextureLoader().loadAsync(PHOTO);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const target = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true, type: THREE.HalfFloatType });
  const U = {
    map: { value: texture }, uTime: { value: 0 }, uGain: { value: 1 }, uRain: { value: 1 },
    tCity: { value: target.texture }, uScreen: { value: new THREE.Vector2(1, 1) },
    uO: { value: new THREE.Vector3() }, uF: { value: new THREE.Vector3() }, uS: { value: new THREE.Vector3() },
  };

  // the city arc, also drawn alone (layer 1) into the buffer the glass and rain look through
  const city = new THREE.Mesh(arcGeometry(toWorld), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.DoubleSide, depthWrite: true,
    vertexShader: 'varying vec2 vP; void main(){ vP=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: cityFragment,
  }));
  city.name = 'Shanghai living arc'; city.frustumCulled = false; city.raycast = () => {};
  city.layers.enable(1);
  room.traverse(node => { if (node.name.startsWith('SH-')) node.visible = false; });
  scene.add(city);

  // rain volume: from just outside the bay glass out toward the river
  const F = toWorld([.6, -.8, 0]).normalize(), S = toWorld([.8, .6, 0]).normalize();
  const C = toWorld([5.82, -.29, 0]);
  room.updateMatrixWorld(true);
  const box = new THREE.Box3(), point = new THREE.Vector3();
  let glass = 0;
  room.traverse(o => {
    if (!o.isMesh || o.material?.name !== 'window') return;
    box.setFromObject(o);
    for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z])
      glass = Math.max(glass, point.set(x, 0, z).sub(C).dot(F));
  });
  // the frames and sills just around the glass go into the buffer as well (with the lights that
  // show them), so a drop over the frame refracts the frame and not the city behind it
  room.traverse(o => {
    if (!o.isMesh || o.material?.transparent || !o.visible) return;
    box.setFromObject(o);
    let reach = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z])
      reach = Math.max(reach, point.set(x, 0, z).sub(C).dot(F));
    if (reach > glass - 1.2) o.layers.enable(1);
  });
  for (const root of [scene, room]) root.traverse(o => { if (o.isLight) o.layers.enable(1); });
  U.uO.value.copy(C); U.uF.value.copy(F); U.uS.value.copy(S);
  const rain = rainMesh(1600, { near: glass + .35 }, U);
  scene.add(rain);

  const panes = new Set();
  room.traverse(o => { if (o.isMesh && o.material?.name === 'window') panes.add(o.material); });
  for (const material of panes) addDrops(material, U);

  const size = new THREE.Vector2();
  let rainWanted = 1;
  return {
    setRain(on) { rainWanted = on ? 1 : 0; },
    get raining() { return rainWanted === 1; },
    frame(now) {
      const still = reduced.matches;
      U.uTime.value = still ? 42 : now * .001;
      U.uRain.value += (rainWanted - U.uRain.value) * (still ? 1 : .03);
      rain.visible = !still && U.uRain.value > .01;
      renderer.getDrawingBufferSize(size);
      U.uScreen.value.copy(size);
      const w = Math.max(2, Math.round(size.x / 2)), h = Math.max(2, Math.round(size.y / 2));
      if (target.width !== w || target.height !== h) target.setSize(w, h);
      // draw only the city, from this eye, into the buffer
      const mask = camera.layers.mask;
      camera.layers.set(1);
      const before = renderer.getRenderTarget();
      renderer.setRenderTarget(target); renderer.render(scene, camera);
      renderer.setRenderTarget(before);
      camera.layers.mask = mask;
    },
  };
}
