<script setup lang="ts">
import {ref,watch,onMounted,onBeforeUnmount} from 'vue';
import type {HostConfig} from '../shared/hosting';
const props=defineProps<{avatar:HostConfig['avatar'];url?:string;level?:number}>();const mount=ref<HTMLElement>(),failed=ref(false);let cleanup=()=>{};
async function load(){cleanup();failed.value=false;if(props.avatar.kind!=='vrm'||!props.url||!mount.value)return;
 try{const T=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{VRMLoaderPlugin,VRMUtils}=await import('@pixiv/three-vrm');const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,0.01,100),renderer=new T.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;mount.value.appendChild(renderer.domElement);const manager=new T.LoadingManager();const allowed=props.url;manager.setURLModifier(url=>{if(url===allowed||url.startsWith('blob:')||url.startsWith('data:'))return url;throw new Error('External model resources blocked');});const loader=new GLTFLoader(manager);loader.register(parser=>new VRMLoaderPlugin(parser));let disposed=false,frame=0;const resize=new ResizeObserver(()=>{if(!mount.value)return;const {width,height}=mount.value.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();});resize.observe(mount.value);cleanup=()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();scene.traverse((o:any)=>{o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){if(!m)continue;for(const v of Object.values(m))if(v instanceof T.Texture)v.dispose();m.dispose();}});renderer.dispose();renderer.domElement.remove();};
 const gltf=await loader.loadAsync(props.url);if(disposed){VRMUtils.deepDispose(gltf.scene);return;}const vrm=gltf.userData.vrm;if(!vrm)throw new Error('Invalid VRM');VRMUtils.rotateVRM0(vrm);scene.add(vrm.scene);const left=vrm.humanoid.getNormalizedBoneNode('leftUpperArm'),right=vrm.humanoid.getNormalizedBoneNode('rightUpperArm');if(left)left.rotation.z=-1.1;if(right)right.rotation.z=1.1;scene.add(new T.HemisphereLight(0xffffff,0x8888aa,1));const light=new T.DirectionalLight(0xffffff,1);light.position.set(1,2,3);scene.add(light);const box=new T.Box3().setFromObject(vrm.scene),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());camera.position.set(center.x,center.y+size.y*.15,size.y*2.1);camera.lookAt(center.x,center.y+size.y*.1,center.z);let last=performance.now();const loop=(now:number)=>{if(disposed)return;const delta=Math.min(.05,(now-last)/1000);last=now;vrm.expressionManager?.setValue('aa',Math.min(1,(props.level??0)*3));vrm.expressionManager?.setValue('blink',now%4300<130?1:0);vrm.update(delta);renderer.render(scene,camera);frame=requestAnimationFrame(loop);};frame=requestAnimationFrame(loop);
 }catch{failed.value=true;}}
watch(()=>[props.avatar.kind,props.url],load);onMounted(load);onBeforeUnmount(()=>cleanup());
</script>
<template>
 <div class="avatar-stage" :style="{'--accent':avatar.color}" ref="mount">
  <img v-if="avatar.kind==='image'&&url" :src="url" alt="" :style="{transform:`translateY(${-Math.min(7,(level||0)*12)}px)`}">
  <svg v-if="avatar.kind==='builtin'||failed" viewBox="0 0 360 520" xmlns="http://www.w3.org/2000/svg" aria-label="JEV original virtual host">
   <defs><linearGradient id="coat" x2="1" y2="1"><stop stop-color="#323d64"/><stop offset="1" stop-color="#141a30"/></linearGradient><linearGradient id="hair" x2=".7" y2="1"><stop stop-color="#fff"/><stop offset=".5" stop-color="#dfe4f8"/><stop offset="1" stop-color="#8c9abf"/></linearGradient><linearGradient id="skin" x2=".7" y2="1"><stop stop-color="#ffe9dc"/><stop offset="1" stop-color="#e3b9af"/></linearGradient></defs>
   <g class="avatar-breathe">
    <path d="M54 520 65 366Q74 333 128 320L151 301H209L234 320Q291 334 300 370L315 520Z" fill="url(#coat)"/>
    <path d="M137 320 151 295V258H207V295L222 320 180 385Z" fill="url(#skin)"/>
    <path d="m125 321 55 46 54-46 8 199H116Z" fill="#f6f5ff"/>
    <path d="m180 369-13 37 10 79 16-1 8-78Z" :fill="avatar.color"/>
    <path d="m123 320 48 88-40-12 9 32-32 92H68l-2-146Q72 340 123 320m114 0-48 88 40-12-9 32 32 92h50l-8-151q-5-27-57-49" fill="#242e4c" stroke="#58678b" stroke-width="3"/>
    <path d="M80 391 59 520M278 391l32 129" stroke="#7886b0" stroke-width="6"/>
    <path d="M106 379h23m-17 18h17m105-18h28" :stroke="avatar.color" stroke-width="6" stroke-linecap="round"/>
    <rect x="232" y="438" width="29" height="35" rx="7" :fill="avatar.color"/><path d="m241 447 10 10-10 10" fill="none" stroke="white" stroke-width="3"/>
    <path d="M93 199Q88 136 113 100q68-67 138 4 30 45 9 117l-22 37-112 12Z" fill="#8c9bbb"/>
    <path d="M113 168Q119 127 176 129q57-1 68 43l-4 78q-10 48-61 69-48-21-62-68Z" fill="url(#skin)"/>
    <path d="M107 216q-25-17-16 19 8 27 26 24m126-43q25-17 16 19-8 27-25 24" fill="#edc2b5"/>
    <g class="avatar-eyes"><path d="M124 221q23-14 41 0m31 0q24-14 42 0" fill="none" stroke="#344261" stroke-width="6" stroke-linecap="round"/><ellipse cx="148" cy="228" rx="10" ry="14" :fill="avatar.color"/><ellipse cx="217" cy="228" rx="10" ry="14" :fill="avatar.color"/><ellipse cx="151" cy="222" rx="4" ry="5" fill="white"/><ellipse cx="220" cy="222" rx="4" ry="5" fill="white"/><path d="M129 199q16-8 30-2m44 0q15-6 29 1" fill="none" stroke="#7c7180" stroke-width="4"/></g>
    <path d="m179 240-3 14 8 1" fill="none" stroke="#c89491" stroke-width="3" stroke-linecap="round"/>
    <ellipse v-if="(level||0)>.04" cx="181" cy="277" rx="12" :ry="3+Math.min(14,(level||0)*45)" fill="#803e53"/>
    <path v-else d="M165 275q17 12 32-1" fill="none" stroke="#a36b75" stroke-width="3" stroke-linecap="round"/>
    <path d="M94 231 85 179l12-22-11-26 29-15-1-28 35 7 22-26 24 19 41-5 7 27 28 18-9 30 15 36-25 57-9-59-32-35 3 50-36-39-23 54-10-51-35 48 2-38Z" fill="url(#hair)" stroke="#8896b5" stroke-width="2"/>
    <path d="m159 112 17 44 5-47m29 9 17 30m-84-25-18 37" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="5"/>
    <path d="M97 197Q87 122 126 99m116 10q30 32 20 90" fill="none" stroke="#303b58" stroke-width="15"/><rect x="83" y="193" width="24" height="58" rx="12" :fill="avatar.color"/><rect x="249" y="193" width="24" height="58" rx="12" :fill="avatar.color"/><path d="M262 242q-1 35-42 37" fill="none" stroke="#3c4868" stroke-width="6"/><rect x="207" y="273" width="25" height="10" rx="5" fill="#485378"/>
   </g>
  </svg>
 </div>
</template>
<style scoped>
.avatar-stage{width:100%;height:100%;position:relative;overflow:hidden}.avatar-stage img,.avatar-stage svg{width:100%;height:100%;object-fit:contain;position:absolute;inset:0}.avatar-stage:deep(canvas){display:block;position:absolute;inset:0}.avatar-breathe{animation:breathe 4s ease-in-out infinite;transform-origin:50% 100%}.avatar-eyes{animation:blink 4.3s infinite;transform-origin:50% 224px}@keyframes breathe{50%{transform:translateY(3px) rotate(.5deg)}}@keyframes blink{0%,95%,100%{transform:scaleY(1)}97%{transform:scaleY(.06)}}
</style>
