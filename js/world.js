import * as THREE from './vendor/three.module.min.js';

// The camera and reveal share one scroll timeline. All surfaces use official art.
export async function createWorld(container, stage, logo) {
    const data = JSON.parse(document.querySelector('#world-data').textContent);
    const game = data.games.find(g => g.id === data.featured);
    const journey = document.querySelector('#feature-journey');
    const controls = [...document.querySelectorAll('[data-scene]')];
    const paths = [game.heroImage || game.image, ...(game.gallery || []).slice(0,2).map(s=>s.image)];
    const renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(Math.max(Math.ceil(devicePixelRatio),2),3));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const loader = new THREE.TextureLoader();
    const results = await Promise.allSettled(paths.map(path=>loader.loadAsync(path)));
    if(results.some(r=>r.status==='rejected')) {
        results.forEach(r=>{if(r.status==='fulfilled')r.value.dispose();});
        renderer.dispose(); throw new Error('Scene artwork could not load');
    }
    const textures=results.map(r=>r.value);
    textures.forEach(texture=>{
        texture.colorSpace=THREE.SRGBColorSpace;
        texture.minFilter=THREE.LinearMipmapLinearFilter;
        texture.magFilter=THREE.LinearFilter;
        texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    });
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(38,1,.1,10);
    camera.position.z=2.5;
    const uniforms={
        uFrom:{value:textures[0]},uTo:{value:textures[0]},
        uCoverFrom:{value:new THREE.Vector2(1,1)},uCoverTo:{value:new THREE.Vector2(1,1)},
        uOriginFrom:{value:new THREE.Vector2(.5,.5)},uOriginTo:{value:new THREE.Vector2(.5,.5)},
        uMix:{value:0},uPan:{value:new THREE.Vector2()},uZoom:{value:1}
    };
    const material=new THREE.ShaderMaterial({
        uniforms,depthTest:false,depthWrite:false,
        vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`
        varying vec2 vUv;
        uniform sampler2D uFrom,uTo;
        uniform vec2 uCoverFrom,uCoverTo,uOriginFrom,uOriginTo,uPan;
        uniform float uMix,uZoom;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){
            vec2 p=(vUv-.5)/uZoom+uPan;
            vec4 from=texture2D(uFrom,p*uCoverFrom+uOriginFrom);
            vec4 to=texture2D(uTo,p*uCoverTo+uOriginTo);
            // A textured paint front, inspired by ITom's material reveal.
            // The texture stays intact; only the boundary between shots is shaded.
            float grain=noise(vUv*vec2(9.,23.))*.075+noise(vUv*vec2(33.,65.))*.018;
            float field=vUv.x*.72+(1.-vUv.y)*.28+grain;
            float threshold=mix(-.12,1.16,uMix);
            float aa=max(fwidth(field)*1.8,.003);
            float reveal=1.-smoothstep(threshold-aa,threshold+aa,field);
            float seam=(1.-smoothstep(.002,.012,abs(field-threshold)))*sin(uMix*3.14159265);
            vec3 color=mix(from.rgb,to.rgb,reveal);
            color=mix(color,color*.62,seam*.35);
            gl_FragColor=vec4(color,1.);
            #include <colorspace_fragment>
        }`
    });
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
    scene.add(plane);container.append(renderer.domElement);
    let paused=false,suspended=false,visible=true,lost=false,raf=0,last=performance.now();
    let progress=0,targetProgress=0,width=1,height=1;
    const pointer=new THREE.Vector2(),smoothPointer=new THREE.Vector2();
    const clamp=THREE.MathUtils.clamp;
    let activeScene=-1;
    function scrollTarget(){
        const rect=journey.getBoundingClientRect();
        const header=parseFloat(getComputedStyle(stage).top)||0;
        targetProgress=clamp((header-rect.top)/Math.max(1,rect.height-height),0,1)*(textures.length-1);
    }
    function cover(index,coverUniform,originUniform){
        const texture=textures[index],ratio=texture.image.width/texture.image.height,viewport=width/height;
        coverUniform.value.set(Math.min(1,viewport/ratio),Math.min(1,ratio/viewport));
        const x=width<701&&index===0?.79:.5;
        originUniform.value.set(x,.5);
    }
    function measure(){
        const rect=stage.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
        renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
        const h=2*Math.tan(THREE.MathUtils.degToRad(19))*2.5;
        plane.scale.set(h*camera.aspect*1.12,h*1.12,1);
        scrollTarget();wake();
    }
    function frame(now){
        raf=0;if(document.hidden||suspended||!visible||lost)return;
        const dt=clamp((now-last)/1000,0,.05);last=now;
        progress=clamp(paused?targetProgress:THREE.MathUtils.damp(progress,targetProgress,8,dt),0,textures.length-1);
        smoothPointer.lerp(paused?new THREE.Vector2():pointer,1-Math.exp(-5*dt));
        const phase=paused?Math.round(progress):progress;
        const from=Math.min(textures.length-1,Math.floor(phase)),to=Math.min(from+1,textures.length-1);
        const mix=THREE.MathUtils.smoothstep(phase-from,.18,.86);
        uniforms.uFrom.value=textures[from];uniforms.uTo.value=textures[to];uniforms.uMix.value=mix;
        cover(from,uniforms.uCoverFrom,uniforms.uOriginFrom);cover(to,uniforms.uCoverTo,uniforms.uOriginTo);
        uniforms.uPan.value.set(smoothPointer.x*.009,smoothPointer.y*.006);
        uniforms.uZoom.value=paused?1:1+Math.sin((phase-from)*Math.PI)*.035;
        plane.rotation.set(smoothPointer.y*.018,smoothPointer.x*.024,0);
        camera.position.x=smoothPointer.x*.015;camera.position.y=-smoothPointer.y*.012;
        logo.style.setProperty('--logo-opacity',String(1-THREE.MathUtils.smoothstep(phase,.08,.55)));
        logo.style.setProperty('--logo-x',`${Math.round(-smoothPointer.x*14*devicePixelRatio)/devicePixelRatio}px`);
        logo.style.setProperty('--logo-y',`${Math.round((smoothPointer.y*9-phase*25)*devicePixelRatio)/devicePixelRatio}px`);
        const current=Math.round(phase);
        stage.dataset.scene=String(current);
        if(current!==activeScene){controls.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===current)));activeScene=current;}
        renderer.render(scene,camera);document.documentElement.classList.add('world-ready');
        if(!paused&&(Math.abs(progress-targetProgress)>.0005||smoothPointer.distanceTo(pointer)>.001))raf=requestAnimationFrame(frame);
    }
    function wake(){if(!raf&&!document.hidden&&!suspended&&visible&&!lost){last=performance.now();raf=requestAnimationFrame(frame);}}
    stage.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||paused)return;const r=stage.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,(e.clientY-r.top)/r.height*2-1);wake();},{passive:true});
    stage.addEventListener('pointerleave',()=>{pointer.set(0,0);wake();});
    addEventListener('scroll',()=>{scrollTarget();wake();},{passive:true});
    controls.forEach((button,index)=>button.addEventListener('click',()=>{
        const rect=journey.getBoundingClientRect();const header=parseFloat(getComputedStyle(stage).top)||0;
        window.scrollTo({top:scrollY+rect.top-header+(rect.height-height)*index/Math.max(1,textures.length-1),behavior:paused?'instant':'smooth'});
    }));
    const resize=new ResizeObserver(measure);resize.observe(stage);
    const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)wake();else{cancelAnimationFrame(raf);raf=0;}});visibility.observe(stage);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else wake();});
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);raf=0;document.documentElement.classList.remove('world-ready','journey-ready');});
    renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;document.documentElement.classList.add('journey-ready');measure();});
    document.documentElement.classList.add('journey-ready');measure();
    return {
        setPaused(value){paused=value;if(value){pointer.set(0,0);smoothPointer.set(0,0);}wake();},
        setSuspended(value){suspended=value;if(value){cancelAnimationFrame(raf);raf=0;}else wake();}
    };
}
