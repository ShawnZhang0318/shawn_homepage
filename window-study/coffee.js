import * as THREE from 'three';

export function addHotCoffee(mug, densityAtlas, reduced) {
  // Cup-local coordinates are Z-up. The inner wall tapers to 43.8 mm at the lip.
  const fill = new THREE.Group();
  fill.position.set(1.730, .585, .845);
  mug.add(fill);
  const profile = [[.04365, .0012], [.04315, .00055], [.042, .00012], [.038, 0], [0, 0]];
  const surface = new THREE.Mesh(
    new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), 96),
    new THREE.MeshPhysicalMaterial({color: 0x351a0e, roughness: .18, ior: 1.33})
  );
  surface.rotation.x = Math.PI / 2;
  surface.receiveShadow = true;
  fill.add(surface);

  // The Blender atlas holds 24 frames of density in cup-local coordinates.
  densityAtlas.generateMipmaps = false;
  densityAtlas.minFilter = THREE.LinearFilter;
  const frame = {value: 0};
  const extent = new THREE.Vector3(.18, .14, .202);
  const vapor = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.ShaderMaterial({
    uniforms: {atlas: {value: densityAtlas}, frame, extent: {value: extent}},
    transparent: true, depthWrite: false,
    vertexShader: `
      varying vec3 entry, eye;
      void main() {
        entry = position + .5;
        eye = (inverse(modelViewMatrix) * vec4(0., 0., 0., 1.)).xyz + .5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      uniform sampler2D atlas;
      uniform float frame;
      uniform vec3 extent;
      varying vec3 entry, eye;

      float sliceDensity(float f, float slice, vec2 xy) {
        vec2 tile = vec2(mod(f, 6.), floor(f / 6.)) * 8.
                  + vec2(mod(slice, 8.), floor(slice / 8.));
        vec2 pixel = tile * 32. + .5 + clamp(xy, 0., 1.) * 31.;
        return texture2D(atlas, pixel / vec2(1536., 1024.)).r;
      }
      float density(float f, vec3 p) {
        float z = clamp(p.z, 0., 1.) * 63.;
        return mix(sliceDensity(f, floor(z), p.xy),
                   sliceDensity(f, min(floor(z) + 1., 63.), p.xy), fract(z));
      }
      void main() {
        vec3 ray = normalize(entry - eye);
        vec3 border = mix(vec3(0.), vec3(1.), step(vec3(0.), ray));
        vec3 travel = abs(border - entry) / max(abs(ray), vec3(.000001));
        travel = mix(vec3(1.e6), travel, step(vec3(.000001), abs(ray)));
        vec3 stepSize = ray * min(min(travel.x, travel.y), travel.z) / 36.;
        vec3 p = entry + .5 * stepSize;
        float sum = 0.;
        float next = mod(floor(frame) + 1., 24.);
        for (int i = 0; i < 36; i++) {
          sum += mix(density(floor(frame), p), density(next, p), fract(frame));
          p += stepSize;
        }
        float opacity = 1. - exp(-sum * length(stepSize * extent) * 35.);
        gl_FragColor = vec4(.76, .72, .67, opacity);
        #include <colorspace_fragment>
      }`
  }));
  vapor.scale.copy(extent);
  vapor.position.z = extent.z / 2;
  vapor.raycast = () => {};
  fill.add(vapor);
  return now => { frame.value = reduced.matches ? 0 : (now * .0045) % 24; };
}
