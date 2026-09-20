<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import Avatar from './Avatar.vue';
import { defaultLayout, clampRect, type HostConfig, type HostSnapshot, type Layer, type LayerRect } from '../shared/hosting';
import { providers, providerNames, type Provider } from '../shared/types';
import { t as translate, translateMessage, type Locale, type MessageKey } from '../shared/i18n';
const props=defineProps<{locale:Locale}>();
const t=(key:MessageKey)=>translate(props.locale,key),tr=(text:string)=>translateMessage(props.locale,text);
const api=window.studio, s=ref<HostSnapshot>(), config=ref<HostConfig>(), provider=ref<Provider>('twitch'), selected=ref<Layer>('avatar');
const preview=ref(''), notice=ref(''), pending=ref(false), stage=ref<HTMLElement>(), auth=ref('');
const languages=[['zh-CN','简体中文'],['zh-TW','繁體中文'],['ja','日本語'],['ko','한국어'],['en','English']];
const layers:Layer[]=['game','avatar','chat','captions'];
const layout=computed(()=>config.value!.layouts[provider.value]);
const rectangle=computed(()=>layout.value[selected.value]);
const blockedText=computed({get:()=>config.value?.blockedWords.join('\n')??'',set:value=>{if(config.value)config.value.blockedWords=value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean).slice(0,50);}});
const style=(r:LayerRect)=>({left:r.x/19.2+'%',top:r.y/10.8+'%',width:r.width/19.2+'%',height:r.height/10.8+'%',opacity:r.visible?1:.24});
let timer:ReturnType<typeof setInterval>,polling=false,previewAt=0,audio:HTMLAudioElement|undefined;
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
async function refresh(){if(polling)return;polling=true;try{s.value=await api.hostSnapshot();if(!config.value)config.value=clone(s.value.config);auth.value=(await api.snapshot()).auth.twitch??'';if(Date.now()-previewAt>3500){previewAt=Date.now();preview.value=await api.gamePreview(provider.value).catch(()=>'');}}catch(e){notice.value=String(e);}finally{polling=false;}}
async function run(fn:()=>Promise<unknown>){if(pending.value)return;pending.value=true;notice.value='';try{await fn();await refresh();}catch(e){notice.value=e instanceof Error?e.message:String(e);}finally{pending.value=false;}}
function normalize(){layout.value[selected.value]=clampRect(rectangle.value);}
function drag(event:PointerEvent,layer:Layer,resize=false){selected.value=layer;const rect=layout.value[layer];if(rect.locked||!stage.value||event.button!==0)return;event.preventDefault();const target=event.currentTarget as HTMLElement;target.setPointerCapture(event.pointerId);const start={...rect},x=event.clientX,y=event.clientY,scale=1920/stage.value.clientWidth;const onMove=(e:PointerEvent)=>{const dx=(e.clientX-x)*scale,dy=(e.clientY-y)*scale;layout.value[layer]=clampRect(resize?{...start,width:Math.min(1920-start.x,start.width+dx),height:Math.min(1080-start.y,start.height+dy)}:{...start,x:start.x+dx,y:start.y+dy});};const end=()=>{target.removeEventListener('pointermove',onMove);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',end);};target.addEventListener('pointermove',onMove);target.addEventListener('pointerup',end,{once:true});target.addEventListener('pointercancel',end,{once:true});}
async function save(){await api.saveHostConfig(clone(config.value!));}
async function voice(){await save();audio?.pause();const url=await api.testHostVoice();if(url){audio=new Audio(url);await audio.play();}}
async function importAvatar(){await save();if(await api.importAvatar()){s.value=await api.hostSnapshot();config.value=clone(s.value.config);}}
onMounted(async()=>{await refresh();timer=setInterval(refresh,1200);});onUnmounted(()=>{clearInterval(timer);audio?.pause();});
</script>

<template>
 <div v-if="s&&config" class="host-panel">
  <div v-if="notice||s.error" class="notice" role="alert">{{notice?tr(notice):t(s.error as MessageKey)}}<button @click="notice=''">×</button></div>
  <section class="card layout-card">
   <div class="card-toolbar"><h2>{{t('host.layout')}}</h2><div class="segmented"><button v-for="p in providers" :key="p" :class="{selected:provider===p}" @click="provider=p;preview='';previewAt=0">{{providerNames[p]}}</button></div><span class="meta">1920 × 1080 · 60 FPS</span></div>
   <div class="layout-workspace"><div><div ref="stage" class="layout-stage" :aria-label="t('host.layout')">
    <div v-for="layer in layers" :key="layer" class="scene-layer" :class="{chosen:selected===layer,locked:layout[layer].locked}" :style="style(layout[layer])" :data-layer="layer" @pointerdown="drag($event,layer)">
     <template v-if="layer==='game'"><img v-if="preview" :src="preview" alt=""><div v-else class="game-placeholder"><b>STEAM</b><span>{{t('host.game')}}</span></div></template>
     <Avatar v-else-if="layer==='avatar'" :avatar="config.avatar" :url="s.assetUrl" :level="0"/>
     <div v-else-if="layer==='chat'" class="chat-preview"><b>{{providerNames[provider]}}</b><p>{{t('host.previewChat')}}</p><p v-for="m in s.messages.filter(m=>m.platform===provider).slice(-3)" :key="m.id"><strong>{{m.author}}</strong> {{m.text}}</p></div>
     <div v-else class="caption-preview">{{s.utterance?.text||t('host.captions')}}</div>
     <span v-if="selected===layer" class="layer-name">{{t(('host.'+layer) as MessageKey)}}</span><button v-if="selected===layer&&!layout[layer].locked" class="resize-handle" :aria-label="t('host.resize')" @pointerdown.stop="drag($event,layer,true)"></button>
    </div>
   </div><p class="hint">{{t('host.layoutHint')}}</p></div>
   <div class="layout-inspector"><div class="layer-list"><button v-for="layer in layers" :key="layer" :class="{selected:selected===layer}" @click="selected=layer">{{t(('host.'+layer) as MessageKey)}}</button></div>
    <div class="rect-fields"><label v-for="axis in ['x','y','width','height'] as const" :key="axis">{{axis==='x'||axis==='y'?axis.toUpperCase():t(('host.'+axis) as MessageKey)}}<input type="number" :min="axis==='x'||axis==='y'?0:40" :max="axis==='x'||axis==='width'?1920:1080" v-model.number="rectangle[axis]" @change="normalize"></label></div>
    <label class="check"><input type="checkbox" v-model="rectangle.visible">{{t('host.visible')}}</label><label class="check"><input type="checkbox" v-model="rectangle.locked">{{t('host.locked')}}</label>
    <button @click="config.layouts[provider]=defaultLayout()">{{t('host.reset')}}</button><button @click="providers.forEach(p=>config!.layouts[p]=clone(layout))">{{t('host.copy')}}</button><button class="primary-button" :disabled="pending" @click="run(()=>api.saveHostLayouts(clone(config!.layouts)))">{{t('host.save')}}</button>
   </div></div>
  </section>
  <div class="host-grid">
   <section class="card host-settings"><h2>{{t('host.character')}}</h2><fieldset :disabled="s.running||pending">
    <div class="form-row"><label>{{t('host.name')}}<input v-model="config.avatar.name" maxlength="40"></label><label class="color-picker">{{t('host.color')}}<input type="color" v-model="config.avatar.color"></label></div>
    <div class="inline-buttons"><button @click="config.avatar.kind='builtin'">{{t('host.builtin')}}</button><button @click="run(importAvatar)">{{t('host.import')}}</button></div><p class="hint">{{t('host.assetHint')}}</p>
    <label>{{t('host.persona')}}<textarea v-model="config.persona" maxlength="3000" rows="3"></textarea></label>
    <div class="form-row"><label>{{t('host.language')}}<select v-model="config.language"><option v-for="l in languages" :key="l[0]" :value="l[0]">{{l[1]}}</option></select></label><label v-if="config.speechProvider==='system'">{{t('host.voice')}}<select v-model="config.voice"><option value="">{{t('host.autoVoice')}}</option><option v-for="v in s.voices" :key="v.name" :value="v.name">{{v.name}} · {{v.language}}</option></select></label></div>
    <div class="form-row"><label>{{t('host.speechProvider')}}<select v-model="config.speechProvider"><option value="system">{{t('host.systemVoice')}}</option><option value="melo">{{t('host.meloVoice')}}</option><option value="qwen">Qwen3-TTS · {{t('host.localModel')}}</option></select></label><label v-if="config.speechProvider==='qwen'">{{t('host.voice')}}<select v-model="config.neuralVoice"><option value="">{{t('host.autoVoice')}}</option><option v-for="v in ['aiden','dylan','eric','ono_anna','ryan','serena','sohee','uncle_fu','vivian']" :key="v" :value="v">{{v}}</option></select></label></div>
    <label class="check"><input type="checkbox" v-model="config.speech">{{t('host.speech')}}</label><button :disabled="!config.speech" @click="run(voice)">{{t('host.testVoice')}}</button>
   </fieldset></section>
   <section class="card host-settings"><h2>{{t('host.localModel')}}</h2><fieldset :disabled="s.running||pending">
    <label>{{t('host.runtime')}}<select v-model="config.modelProvider"><option value="ollama">Ollama</option><option value="compatible">{{t('host.compatible')}}</option></select></label>
    <label>{{t('host.endpoint')}}<input v-model="config.apiBase" spellcheck="false" placeholder="http://127.0.0.1:11434"></label>
    <label>{{t('host.model')}}<input v-model="config.model" list="host-models" spellcheck="false"><datalist id="host-models"><option>qwen3.5:4b</option><option>qwen3:4b-instruct-2507-q4_K_M</option></datalist></label>
    <label>{{t('host.compute')}}<select v-model="config.compute"><option value="auto">{{t('host.gpu')}}</option><option value="cpu" :disabled="config.modelProvider!=='ollama'">{{t('host.cpu')}}</option></select></label><p class="info-box">{{t('host.localHint')}}</p>
   </fieldset></section>
   <section class="card host-settings"><h2>{{t('host.controls')}}</h2><p class="hint">{{t('host.manualHint')}}</p><fieldset :disabled="s.running||pending">
    <div class="inline-buttons"><label v-for="p in ['youtube','twitch'] as const" :key="p" class="check"><input type="checkbox" v-model="config.chatPlatforms" :value="p">{{providerNames[p]}}</label></div>
    <label class="check"><input type="checkbox" v-model="config.commentary">{{t('host.commentary')}}</label><label class="check"><input type="checkbox" v-model="config.textReplies">{{t('host.textReplies')}}</label>
    <label>{{t('host.pace')}}<select v-model="config.pace"><option v-for="v in ['calm','balanced','lively'] as const" :value="v" :key="v">{{t(('host.'+v) as MessageKey)}}</option></select></label>
    <label>{{t('host.blockedWords')}}<textarea v-model="blockedText" rows="2" maxlength="2549"></textarea></label><p class="hint">{{t('host.blockedHint')}}</p>
    <div class="form-row"><label>{{t('host.interval')}}<input type="number" v-model.number="config.intervalSec" min="15" max="300"></label><label>{{t('host.limit')}}<input type="number" v-model.number="config.maxPerHour" min="1" max="240"></label></div>
    <button class="primary-button" @click="run(save)">{{t('host.saveSettings')}}</button>
   </fieldset><button v-if="s.running" class="stop-button" :disabled="pending&&!s.warming" @click="s.warming?api.stopHost():run(()=>api.stopHost())">{{t('host.stop')}}</button><button v-else class="primary-button" :disabled="pending" @click="run(async()=>{await save();await api.startHost();})">{{t('host.start')}}</button></section>
   <section class="card host-settings health"><h2>{{t('host.activity')}}</h2><p class="host-status"><i class="dot" :class="{on:s.running}"></i>{{t(s.warming?'host.warming':s.running?'host.running':'host.off')}}</p><div class="host-counters"><div><b>{{s.stats.generated}}</b>{{t('host.generated')}}</div><div><b>{{s.stats.replies}}</b>{{t('host.replies')}}</div><div><b>{{s.stats.failures}}</b>{{t('host.errors')}}</div></div>
    <div v-for="p in ['youtube','twitch'] as const" :key="p" class="chat-health"><b>{{providerNames[p]}}</b><span>{{t(('host.'+(s.chat[p].state==='reauthorize'?'off':s.chat[p].state)) as MessageKey)}}</span><button v-if="p==='twitch'&&s.chat[p].state==='reauthorize'&&!auth" @click="api.connectAccount('twitch').catch(e=>notice=String(e))">{{t('host.reauthorize')}}</button><p v-if="s.chat[p].error">{{t(s.chat[p].error as MessageKey)}}</p></div>
    <p v-if="auth" class="hint">{{tr(auth)}}<button @click="api.cancelLogin('twitch')">{{t('account.cancel')}}</button></p>
    <p class="hint" v-if="s.timing">{{t('host.timing')}} {{(s.timing.modelMs/1000).toFixed(1)}} / {{(s.timing.speechMs/1000).toFixed(1)}} / {{(s.timing.responseP95Ms/1000).toFixed(1)}} s</p>
    <div class="host-transcript" aria-live="polite">{{s.utterance?.text}}</div>
   </section>
  </div>
 </div>
</template>

<style scoped>
.host-panel{display:grid;gap:22px}.layout-workspace{display:grid;grid-template-columns:minmax(0,1fr) 205px;gap:20px;padding:5px 20px 20px}.layout-stage{aspect-ratio:16/9;background:#10111c;position:relative;overflow:hidden;border-radius:12px;isolation:isolate;touch-action:none;container-type:inline-size}.scene-layer{position:absolute;cursor:move;user-select:none;touch-action:none;outline:1px solid transparent}.scene-layer.chosen{outline:2px solid #c5b5ff;z-index:5}.scene-layer.locked{cursor:pointer}.scene-layer img{width:100%;height:100%;object-fit:contain;pointer-events:none}.scene-layer[data-layer=game]{z-index:0}.scene-layer[data-layer=avatar]{z-index:1}.scene-layer[data-layer=chat]{z-index:2}.scene-layer[data-layer=captions]{z-index:3}.scene-layer.chosen[data-layer=game]{z-index:0}.game-placeholder{display:grid;place-content:center;gap:8px;text-align:center;background:radial-gradient(ellipse at 50% 40%,#34334e,#151724);height:100%;color:#a9a8bc}.game-placeholder b{font-size:2.4cqw;letter-spacing:6px}.game-placeholder span{font-size:1.4cqw}.layer-name{position:absolute;left:0;top:0;background:#c5b5ff;color:#262139;font-size:10px;padding:3px 6px;pointer-events:none;border-radius:0 0 6px 0}.resize-handle{position:absolute;right:-4px;bottom:-4px;width:12px;height:12px;background:#fff;border:2px solid #ac94ef;border-radius:3px;padding:0;cursor:nwse-resize}.chat-preview{height:100%;padding:5%;font-size:1.15cqw;line-height:1.7;background:#191525ad;color:#f0eafa;overflow:hidden;border-radius:7px}.chat-preview>b{font-size:1cqw;letter-spacing:1px;color:#ccb6ff}.chat-preview p{margin:.6em 0;background:#ffffff0b;padding:.5em;border-radius:5px;overflow-wrap:anywhere}.chat-preview strong{color:#bdaaff}.caption-preview{display:grid;place-items:center;height:100%;padding:5px;background:#16121cb8;border-radius:8px;color:white;font-size:1.4cqw;text-align:center}.layout-inspector{display:flex;flex-direction:column;gap:9px;align-items:stretch}.layer-list{display:grid;grid-template-columns:1fr 1fr;gap:5px}.layer-list button{font-size:10px;padding:9px 4px}.layer-list .selected{background:#ede7fc;border-color:#c9b9ed;color:#7758ac}.rect-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rect-fields label{font-size:10px;color:#9185a3}.rect-fields input{padding:7px;margin-top:5px}.layout-inspector>.primary-button{margin-top:auto}.hint{font-size:11px;line-height:1.8;color:#908799;margin:12px 0}.host-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.host-settings{padding:24px}.host-settings h2{font-size:17px;margin-bottom:18px}fieldset{border:0;padding:0;margin:0;min-width:0}.host-settings label{display:block;font-size:11px;color:#84798f;margin:15px 0}textarea{resize:vertical;width:100%;font:inherit;font-size:12px;color:#5e586f;line-height:1.7;border:1px solid #e4e1ed;background:#faf9fc;border-radius:9px;padding:10px;margin-top:8px}.check,.host-settings .check{display:flex;gap:8px;align-items:center;font-size:11px;color:#887996;margin:5px 0 10px}.check input{width:15px;height:15px;margin:0;accent-color:#9270c6}.host-settings .form-row{gap:12px;flex-wrap:nowrap}.host-settings .form-row label{min-width:0;flex:1}.host-settings .color-picker{flex:0 0 60px}.color-picker input{height:39px;padding:4px}.inline-buttons{flex-wrap:wrap;gap:8px}.host-counters{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:18px 0;border-bottom:1px solid #eee9f4}.host-counters div{display:grid;gap:10px;font-size:10px;color:#9b8ca9}.host-counters b{font-size:25px;color:#726080;font-weight:450}.host-status{font-size:12px;color:#8e7d9c}.chat-health{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center;font-size:11px;margin:20px 0}.chat-health span{color:#978ba3}.chat-health p{width:100%;font-size:10px;color:#aa839a;margin:0}.host-transcript{margin-top:20px;min-height:70px;border-radius:12px;background:#f3eff7;padding:15px;color:#7a678b;font-size:12px;line-height:1.9}@media(max-width:1250px){.layout-workspace{grid-template-columns:minmax(0,1fr) 180px;gap:14px}.host-settings{padding:19px}.host-grid{gap:16px}.host-settings .form-row{flex-wrap:wrap}}
</style>
