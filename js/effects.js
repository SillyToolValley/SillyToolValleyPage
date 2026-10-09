import * as THREE from './vendor/three.module.min.js';

// Original shaders informed by observed Igloo scene dissolves and ITom's paint reveal.
// No reference-site code, textures, or models are bundled.
const noiseGLSL = `
float hash13(vec3 p) { p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z); }
float noise3(vec3 p) {
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float surfaceField(vec3 p) {return clamp((p.y+2.4)/5.6 + (noise3(p*3.7)-.5)*.23,.02,.98);}
`;

export function makeToonMaterial({map=null,color=0xffffff,dissolve={value:0}}={}) {
    const mat = new THREE.MeshBasicMaterial({map,color});
    mat.onBeforeCompile = shader => {
        shader.uniforms.uDissolve=dissolve;
        shader.vertexShader = `varying vec3 vToonNormal;varying vec3 vLocalPosition;varying vec3 vEye;\n`+shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          vToonNormal=normalize(mat3(modelMatrix)*normal);
          vLocalPosition=position;
          vEye=cameraPosition-(modelMatrix*vec4(position,1.)).xyz;`);
        shader.fragmentShader = `uniform float uDissolve;varying vec3 vToonNormal;varying vec3 vLocalPosition;varying vec3 vEye;\n${noiseGLSL}\n`+shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float field=surfaceField(vLocalPosition);
          if(uDissolve>field) discard;
          vec3 n=normalize(vToonNormal);
          float lambert=dot(n,normalize(vec3(-.55,1.,.7)));
          float aa=max(fwidth(lambert)*1.1,.014);
          float band=smoothstep(-.1-aa,-.1+aa,lambert)*.32+smoothstep(.55-aa,.55+aa,lambert)*.25;
          vec3 shadow=vec3(.47,.57,.70);
          vec3 light=mix(shadow,vec3(1.14,1.10,.99),band+.25);
          float rim=pow(1.-max(0.,dot(n,normalize(vEye))),3.5)*smoothstep(.0,.4,lambert);
          diffuseColor.rgb=diffuseColor.rgb*light + rim*vec3(.16,.20,.16);
          float edge=1.-smoothstep(0.,.025,field-uDissolve);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.39,.10),edge*step(.005,uDissolve));`);
    };
    mat.customProgramCacheKey=()=> 'stv-toon-dissolve-1';
    return mat;
}

export function makePaintMaterial(texture,accent=0xf77c35) {
    const uniforms={uReveal:{value:0},uOpacity:{value:1},uDissolve:{value:0},uBend:{value:0},uOrigin:{value:new THREE.Vector2(.4,.45)}};
    const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide});
    mat.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,uniforms);
        shader.vertexShader='uniform vec2 uOrigin;uniform float uBend;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          transformed.z += uBend*(sin(uv.x*3.14159)*.28+exp(-length(uv-uOrigin)*7.)*.48);`);
        shader.uniforms.uAccent={value:new THREE.Color(accent)};
        shader.fragmentShader=`uniform float uReveal;uniform float uOpacity;uniform float uDissolve;uniform vec2 uOrigin;uniform vec3 uAccent;\n${noiseGLSL}\n`+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          vec2 uv=vMapUv;
          float grain=noise3(vec3(uv*vec2(22.,180.),0.));
          float brush=length((uv-uOrigin)*vec2(1.,.75)) + (noise3(vec3(uv*9.,0.))-.5)*.14 + grain*.035;
          float paint=(1.-smoothstep(uReveal*1.45-.035,uReveal*1.45+.015,brush))*smoothstep(0.,.06,uReveal);
          float dissolveField=clamp(uv.x*.7+noise3(vec3(uv*18.,0.))*.3,.001,.999);
          if(uDissolve>dissolveField)discard;
          float lum=dot(diffuseColor.rgb,vec3(.299,.587,.114));
          vec3 ink=mix(vec3(.17,.23,.26),vec3(.88,.91,.85),smoothstep(.05,.9,lum));
          ink*=.95+grain*.05;
          diffuseColor.rgb=mix(ink,diffuseColor.rgb,paint);
          diffuseColor.a*=uOpacity;`);
    };
    mat.customProgramCacheKey=()=> 'stv-brush-reveal-1';
    return {material:mat,uniforms};
}

export function createSurfaceParticles(positions,colors,count) {
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const seeds=new Float32Array(count);for(let i=0;i<count;i++)seeds[i]=(i*.6180339887)%1;
    geo.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
    const uniforms={uTime:{value:0},uScatter:{value:0},uOpacity:{value:0},uPixelRatio:{value:1},uPointer:{value:new THREE.Vector3(99,99,99)}};
    const mat=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,vertexColors:true,
        vertexShader:`attribute float aSeed;uniform float uTime;uniform float uScatter;uniform float uPixelRatio;uniform vec3 uPointer;
          varying vec3 vColor;varying float vAlpha;${noiseGLSL}
          void main(){
            float amount=smoothstep(aSeed*.36,aSeed*.36+.64,uScatter);
            vec3 dir=normalize(position+vec3(sin(aSeed*61.),cos(aSeed*47.),sin(aSeed*29.))*.7);
            vec3 p=position+dir*amount*(3.+aSeed*5.);
            p.y+=sin(uTime*.65+aSeed*30.)*amount*.36;
            float angle=amount*1.8+uTime*.06*amount;
            p.xz=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p.xz;
            vec3 delta=p-uPointer;float repel=1.-smoothstep(0.,1.4,length(delta));
            p+=normalize(delta+vec3(.0001))*repel*.65;
            vec4 mv=modelViewMatrix*vec4(p,1.);
            gl_Position=projectionMatrix*mv;
            gl_PointSize=clamp((2.1+aSeed*1.8)*uPixelRatio*(9./-mv.z),1.,7.);
            vColor=mix(color,vec3(1.,.39,.1),amount*.35+repel*.3);
            vAlpha=.6+aSeed*.4;
          }`,
        fragmentShader:`uniform float uOpacity;varying vec3 vColor;varying float vAlpha;
          void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vColor,uOpacity*vAlpha*(1.-smoothstep(.25,.5,d)));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`
    });
    return {object:new THREE.Points(geo,mat),uniforms};
}

export function createTransitionPass(renderer) {
    const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});
    target.texture.colorSpace=THREE.LinearSRGBColorSpace;
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    const uniforms={uScene:{value:target.texture},uVelocity:{value:0},uTime:{value:0},uAspect:{value:1},uStrength:{value:0}};
    const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
        vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
        fragmentShader:`varying vec2 vUv;uniform sampler2D uScene;uniform float uVelocity;uniform float uTime;uniform float uAspect;uniform float uStrength;${noiseGLSL}
        void main(){
          vec2 uv=vUv;float strength=min(.045,abs(uVelocity)*.006)*uStrength;
          float noise=noise3(vec3(uv*vec2(8.,18.),uTime*.6));
          uv.x+=(noise-.5)*strength;
          uv.y+=sin(uv.x*11.+uTime)*strength*.18;
          vec2 shift=(uv-.5)*strength*.34;
          vec3 c=vec3(texture2D(uScene,uv+shift).r,texture2D(uScene,uv).g,texture2D(uScene,uv-shift).b);
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
    return {
        uniforms,
        resize(w,h){target.setSize(w,h);uniforms.uAspect.value=w/h;},
        render(world,worldCamera){renderer.setRenderTarget(target);renderer.render(world,worldCamera);renderer.setRenderTarget(null);renderer.render(scene,camera);},
        dispose(){target.dispose();material.dispose();}
    };
}
