// The photographed light columns stay anchored to the far bank. Replace the
// mirrored foreground rows with irregular overlapping samples of the same water.
export function finishWater(room, reduced) {
  const time={value:0};
  room.getObjectByName('SH-HUANGPU').traverse(mesh=>{
    if(!mesh.isMesh)return;
    const mat=mesh.material.clone();
    mesh.material=mat;
    mat.onBeforeCompile=shader=>{
      shader.uniforms.waterTime=time;
      shader.vertexShader='varying vec2 waterXY;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nwaterXY=position.xy-vec2(5.82,-0.29);');
      shader.fragmentShader='varying vec2 waterXY; uniform float waterTime;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
        float r=max(length(waterXY),1.);
        float across=dot(waterXY,vec2(.8,.6));
        float away=dot(waterXY,vec2(.6,-.8));
        float bearing=atan(across,away)-radians(5.8);
        float photoX=(bearing/radians(60.)+.5)*1500.;
        float u=clamp((photoX+1450.)/4400.,.001,.999);
        float row=.75+67.5*(1./r-cos(bearing)/750.)/.34906585;
        float wave=sin(dot(waterXY,vec2(.19,.29))+waterTime*.49)
                 +.47*sin(dot(waterXY,vec2(-.37,.12))-waterTime*.37);
        float weight=smoothstep(.754,.90,row);
        float y=min(row,.996)+.0009*weight*wave;
        float drift=.00015*weight*wave;
        vec4 shore=texture2D(map,vec2(u+drift,clamp((y-.75)*4.,0.,.998)));
        float a=.907+.074*sin(row*14.+2.1*sin(row*3.1+u*11.)+u*5.3);
        float b=.907+.081*sin(row*19.3+u*7.1+1.7*sin(row*2.18-u*9.));
        vec4 water=mix(texture2D(map,vec2(u+drift*2.,(a+.001*wave-.75)*4.)),
                       texture2D(map,vec2(u-drift,(b-.001*wave-.75)*4.)),
                       .47+.19*sin(row*5.1+u*17.));
        diffuseColor*=mix(shore,water,smoothstep(.955,1.055,row));
      `);
    };
    mat.needsUpdate=true;
  });
  return now=>{time.value=reduced.matches?0:now*.001;};
}
