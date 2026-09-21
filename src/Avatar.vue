<script setup lang="ts">
import {ref,watch,onMounted,onBeforeUnmount} from 'vue';
import type {HostConfig} from '../shared/hosting';
import {createLive2DAvatar} from './live2d-avatar';
import portrait from './assets/streamer/neutral-v1.png';
const props=defineProps<{avatar:HostConfig['avatar'];url?:string;level?:number}>();const mount=ref<HTMLElement>(),failed=ref(false),ready=ref(false);let cleanup=()=>{},generation=0;
async function load(){cleanup();const current=++generation;failed.value=false;ready.value=false;if(!mount.value)return;
 if(props.avatar.kind==='builtin'){const live=createLive2DAvatar(mount.value,()=>props.level??0);cleanup=live.dispose;try{await live.ready;if(current===generation)ready.value=true;}catch{if(current===generation)failed.value=true;}return;}
 if(props.avatar.kind!=='vrm'||!props.url)return;
 try{const T=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{VRMLoaderPlugin,VRMUtils}=await import('@pixiv/three-vrm');const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,0.01,100),renderer=new T.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;mount.value.appendChild(renderer.domElement);const manager=new T.LoadingManager();const allowed=props.url;manager.setURLModifier(url=>{if(url===allowed||url.startsWith('blob:')||url.startsWith('data:'))return url;throw new Error('External model resources blocked');});const loader=new GLTFLoader(manager);loader.register(parser=>new VRMLoaderPlugin(parser));let disposed=false,frame=0;const resize=new ResizeObserver(()=>{if(!mount.value)return;const {width,height}=mount.value.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();});resize.observe(mount.value);cleanup=()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();scene.traverse((o:any)=>{o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){if(!m)continue;for(const v of Object.values(m))if(v instanceof T.Texture)v.dispose();m.dispose();}});renderer.dispose();renderer.domElement.remove();};
 const gltf=await loader.loadAsync(props.url);if(disposed){VRMUtils.deepDispose(gltf.scene);return;}const vrm=gltf.userData.vrm;if(!vrm)throw new Error('Invalid VRM');VRMUtils.rotateVRM0(vrm);scene.add(vrm.scene);const left=vrm.humanoid.getNormalizedBoneNode('leftUpperArm'),right=vrm.humanoid.getNormalizedBoneNode('rightUpperArm');if(left)left.rotation.z=-1.1;if(right)right.rotation.z=1.1;scene.add(new T.HemisphereLight(0xffffff,0x8888aa,1));const light=new T.DirectionalLight(0xffffff,1);light.position.set(1,2,3);scene.add(light);const box=new T.Box3().setFromObject(vrm.scene),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());camera.position.set(center.x,center.y+size.y*.15,size.y*2.1);camera.lookAt(center.x,center.y+size.y*.1,center.z);let last=performance.now();const loop=(now:number)=>{if(disposed)return;const delta=Math.min(.05,(now-last)/1000);last=now;vrm.expressionManager?.setValue('aa',Math.min(1,(props.level??0)*3));vrm.expressionManager?.setValue('blink',now%4300<130?1:0);vrm.update(delta);renderer.render(scene,camera);frame=requestAnimationFrame(loop);};frame=requestAnimationFrame(loop);
 }catch{failed.value=true;}}
watch(()=>[props.avatar.kind,props.url],load);onMounted(load);onBeforeUnmount(()=>{generation++;cleanup();});
</script>
<template>
 <div class="avatar-stage" :style="{'--accent':avatar.color}" ref="mount" :data-avatar-state="failed?'error':ready?'ready':'loading'" :data-avatar-kind="avatar.kind==='builtin'?'live2d':avatar.kind">
  <img v-if="avatar.kind==='image'&&url" :src="url" alt="" :style="{transform:`translateY(${-Math.min(7,(level||0)*12)}px)`}">
  <img v-if="failed" :src="portrait" alt="Static avatar fallback">
 </div>
</template>
<style scoped>
.avatar-stage{width:100%;height:100%;position:relative;overflow:hidden}.avatar-stage img,.avatar-stage svg{width:100%;height:100%;object-fit:contain;position:absolute;inset:0}.avatar-stage:deep(canvas){display:block;position:absolute;inset:0}
</style>
