<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import type { Snapshot, Settings, Provider } from '../shared/types';
const api=window.studio;
const s=ref<Snapshot>();const edit=ref<Settings>();const page=ref<'studio'|'settings'>('studio');
const output=ref<Provider>('youtube'),preview=ref(''),notice=ref(''),key=ref(''),pending=ref('');
const windows=ref<{label:string;value:string}[]>([]),selected=ref('');let timer:ReturnType<typeof setInterval>,previewAt=0,polling=false;
const ready=computed(()=>!!s.value?.accounts.youtube && !!s.value?.accounts.twitch && s.value?.outputs.youtube.ready && s.value?.outputs.twitch.ready && !!s.value?.settings.gameWindow);
const active=computed(()=>s.value?.broadcast.state!=='idle');
const stateLabels:Record<string,string>={idle:'尚未开播',preparing:'准备中',sending:'正在推流',stopping:'停止中',recovery:'需要恢复检查'};
async function refresh(){
 if(polling)return;polling=true;
 try {s.value=await api.snapshot();if(!edit.value)edit.value={...s.value.settings};if(!selected.value)selected.value=s.value.settings.gameWindow;
 if(page.value==='studio' && s.value.outputs[output.value].connected && Date.now()-previewAt>3000){previewAt=Date.now();preview.value=await api.preview(output.value).catch(()=>'');}}
 catch(e){notice.value=String(e);}finally{polling=false;}
}
async function run(name:string,fn:()=>Promise<unknown>){pending.value=name;notice.value='';try{await fn();await refresh();}catch(e){notice.value=e instanceof Error?e.message:String(e);}finally{pending.value='';}}
async function connect(p:Provider){void run(`login-${p}`,()=>api.connectAccount(p));}
async function save(){if(edit.value)await run('save',async()=>{await api.saveSettings({...edit.value!});notice.value='设置已保存';});}
async function importGoogle(){await run('import',async()=>{if(await api.importGoogleClient()){s.value=await api.snapshot();edit.value={...s.value.settings};}});}
async function refreshWindows(){await run('windows',async()=>{windows.value=await api.windows();const game=windows.value.find(w=>/UnrealEditor|Lyra|Enter the Cube/i.test(w.label));if(game&&!selected.value)selected.value=game.value;});}
function open(url:string){void run('open',()=>api.openExternal(url));}
onMounted(async()=>{if(!api){notice.value='请通过 JEV Studio 桌面应用打开；浏览器页面不具有游戏与账号权限。';return;}await refresh();timer=setInterval(refresh,1000);});
onUnmounted(()=>clearInterval(timer));
</script>

<template>
 <div class="shell">
  <aside class="sidebar">
   <div class="brand"><span class="brand-mark">J</span><div>JEV <b>Studio</b><small>为游戏而生的直播工作台</small></div></div>
   <div class="workspace"><span class="workspace-icon">✦</span><div>我的直播间<small>本机工作空间</small></div><span class="chevron">⌄</span></div>
   <div class="nav-label">工作空间</div>
   <button class="nav-item" :class="{chosen:page==='studio'}" @click="page='studio'"><span>▣</span>直播工作台</button>
   <button class="nav-item" :class="{chosen:page==='settings'}" @click="page='settings'"><span>⚙</span>连接与设置</button>
   <div class="sidebar-bottom"><span class="dot"></span> Phase 01 · 开发预览<small>自动游玩 · YouTube · Twitch</small><div class="version">JEV STUDIO <span>v0.1.0</span></div></div>
  </aside>
  <main>
   <header><div class="breadcrumb">工作空间 <span>/</span> {{page==='studio'?'直播工作台':'连接与设置'}}</div><div class="local-badge"><span class="dot"></span> 本机运行 · 凭证加密</div></header>
   <div v-if="notice" class="notice" role="alert">{{notice}}<button aria-label="关闭提示" @click="notice=''">×</button></div>
   <template v-if="s">
   <section class="page-heading"><div><p class="eyebrow">{{page==='studio'?'YOUR ALWAYS-ON STUDIO':'MAKE IT YOURS'}}</p><h1>{{page==='studio'?'让游戏，持续发生。':'连接你的直播世界。'}}</h1><p class="subtitle">{{page==='studio'?'从一场游戏开始，连接两个频道。':'一次配置，之后通过平台官方页面直接登录。'}}</p></div><div v-if="page==='studio'" class="session-status"><span class="dot" :class="{on:active}"></span>{{stateLabels[s.broadcast.state]||s.broadcast.state}}</div></section>
   <template v-if="page==='studio'">
    <div class="studio-grid"><div class="primary-column">
     <section class="card preview-card"><div class="card-toolbar"><div class="segmented"><button v-for="p in (['youtube','twitch'] as const)" :key="p" :class="{selected:output===p}" @click="output=p;preview='';previewAt=0"><span :class="p">{{p==='youtube'?'▶':'▣'}}</span> {{p==='youtube'?'YouTube':'Twitch'}}</button></div><span class="meta">1920 × 1080 <span>60 FPS</span></span></div>
      <div class="preview"><img v-if="preview" :src="preview" alt="OBS 当前真实输出预览"><div v-else class="preview-empty"><div class="cube-icon">◇</div><h2>你的游戏，即将上场</h2><p>准备 OBS 并选择游戏窗口后<br>这里会显示真实的直播画面</p><button class="light-button" :disabled="!!s.busy" @click="run('obs',()=>api.setupOBS())">{{s.busy||'准备两路 OBS'}}</button></div><div class="preview-label">{{preview?'OBS 实时预览 · 不代表已开播':'等待游戏画面'}} <span>{{output.toUpperCase()}}</span></div></div>
      <div class="capture-row"><select aria-label="选择游戏窗口" v-model="selected"><option value="">选择要直播的游戏窗口</option><option v-if="selected&&!windows.some(w=>w.value===selected)" :value="selected">{{selected}}</option><option v-for="w in windows" :key="w.value" :value="w.value">{{w.label}}</option></select><button :disabled="!s.outputs.youtube.connected" @click="refreshWindows">刷新</button><button :disabled="!selected || !!s.busy" @click="run('capture',()=>api.setCapture(selected))">应用</button></div>
     </section>
     <section class="card game-card"><div class="section-title"><div><span class="small-icon">⌘</span><h2>游戏控制</h2><span class="pill" :class="{green:s.gameConnected}">{{s.gameConnected?'已连接':'未连接'}}</span></div><button class="text-button" :disabled="!!s.busy" @click="run('game',()=>api.launchGame())">启动 ETC 开发版 ↗</button></div><div class="game-summary"><div class="game-art">ETC<span>ENTER THE CUBE</span></div><div><h3>Enter the Cube</h3><p>本机人机对战 · {{s.settings.decisionProvider==='jev'?'JEV 决策':'本地基础策略'}}</p></div><div class="mode-switch"><button :class="{selected:s.mode==='manual'}" @click="run('manual',()=>api.setMode('manual'))">手动玩</button><button :class="{selected:s.mode==='auto'}" :disabled="!s.gameConnected" @click="run('auto',()=>api.setMode('auto'))">✦ 自动玩</button></div></div><div class="game-detail"><span>{{s.gameConnected?`状态：${s.game?.phase} · HP ${Math.round(s.game?.health||0)}`:'启动游戏后，桥接会自动连接'}}</span><span>紧急接管 <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>M</kbd></span></div><div class="decision"><span class="dot" :class="{on:s.mode==='auto'}"></span>{{s.gameError||s.decision}}</div></section>
    </div><div class="secondary-column">
     <section class="card channels-card"><div class="section-title"><h2>直播频道</h2><span class="meta">2 个平台</span></div><article v-for="p in (['youtube','twitch'] as const)" :key="p" class="channel"><div class="channel-heading"><div :class="['platform-icon',p]">{{p==='youtube'?'▶':'▣'}}</div><div><h3>{{p==='youtube'?'YouTube':'Twitch'}}</h3><p>{{s.accounts[p]?.name||'尚未连接账号'}}</p></div><span v-if="s.accounts[p]" class="linked">✓</span></div><div v-if="s.auth[p]" class="auth-state">{{s.auth[p]}}<button @click="api.cancelLogin(p)">取消登录</button></div><button v-else-if="!s.accounts[p]" class="connect-button" @click="connect(p)">通过 {{p==='youtube'?'Google':'Twitch'}} 官方登录 ↗</button><div v-else class="channel-stats"><span><i class="dot" :class="{on:s.outputs[p].active}"></i>{{s.outputs[p].active?'推流中':s.outputs[p].connected?'OBS 就绪':'等待 OBS'}}</span><button class="text-button" :disabled="active" @click="run('disconnect',()=>api.disconnectAccount(p))">退出账号</button></div><div class="output-metrics"><span>已发送 <b>{{(s.outputs[p].bytes/1048576).toFixed(1)}} MB</b></span><span>丢帧 <b>{{s.outputs[p].skipped}}</b></span></div></article><button class="text-button setup-link" :disabled="!!s.busy" @click="run('obs',()=>api.setupOBS())">{{s.busy || '连接 / 准备两路 OBS'}} ↗</button></section>
     <section class="card live-card"><h2>准备好，就开播。</h2><p>检查游戏画面与声音，再开始同时推流。</p><div class="visibility"><span>YouTube</span><b>{{{private:'私密',unlisted:'不公开',public:'公开'}[s.settings.youtubePrivacy]}}</b></div><div class="visibility"><span>Twitch</span><b>公开直播</b></div><button v-if="!active" class="primary-button" :disabled="!ready||!!s.busy" @click="run('start',()=>api.startStream())"><span>◉</span> 开始双路直播</button><button v-else class="stop-button" :disabled="!!s.busy" @click="run('stop',()=>api.stopStream())">■ 结束双路直播</button><small>{{!ready?'完成账号连接、OBS 和游戏窗口设置后即可开播':'开播将向两个平台实际发送当前画面和声音'}}</small><button v-if="s.broadcast.youtubeUrl" class="text-button" @click="open(s.broadcast.youtubeUrl)">查看 YouTube 直播 ↗</button><button v-if="s.broadcast.twitchUrl" class="text-button" @click="open(s.broadcast.twitchUrl)">查看 Twitch 直播 ↗</button></section>
    </div></div>
    <section class="card activity-card"><div class="section-title"><h2>运行记录</h2><span class="meta">仅显示本机事件，不包含密钥</span></div><div v-for="(item,i) in s.logs.slice(0,5)" :key="i" class="log-line"><time>{{item.at}}</time><span>{{item.message}}</span></div></section>
    <p class="phase-note">第一阶段：游戏控制与双路推流。虚拟头像、自动解说和评论回复尚未启用；两种游戏模式将共用后续的互动模块。</p>
   </template>
   <div v-else-if="edit" class="settings-grid">
    <section class="card settings-card"><p class="eyebrow">01 · OFFICIAL ACCOUNTS</p><h2>官方账号授权</h2><p>主播账号使用官方网页登录。开发者应用只需为软件配置一次。</p><label>Google Desktop Client ID<input v-model="edit.googleClientId" placeholder="…apps.googleusercontent.com" autocomplete="off"></label><div class="inline-buttons"><button @click="importGoogle">导入 Google 客户端 JSON</button><button class="text-button" @click="open('https://console.cloud.google.com/apis/credentials')">打开 Google 控制台 ↗</button></div><label>Twitch Public Client ID<input v-model="edit.twitchClientId" placeholder="开发者控制台中的 Client ID" autocomplete="off"></label><button class="text-button" @click="open('https://dev.twitch.tv/console/apps')">注册 Twitch 应用 ↗</button><div class="info-box">Google 应用类型选“桌面应用”，开启 YouTube Data API v3。Twitch 应用类型选“Public”，登录无需应用密钥。凭证不会回显到界面。</div></section>
    <section class="card settings-card"><p class="eyebrow">02 · GAME INTELLIGENCE</p><h2>游戏与自动决策</h2><label>ETC 工程目录<input v-model="edit.gameProject"></label><label>自动控制策略<select v-model="edit.decisionProvider"><option value="rules">本地基础策略 · 无 API 费用</option><option value="jev">JEV · 结构化游戏决策</option></select></label><label>JEV API Key <span class="label-detail">{{s.hasJevKey?'已加密保存':'尚未配置'}}</span><div class="input-button"><input type="password" v-model="key" autocomplete="new-password" placeholder="在本机输入，保存后不再显示"><button :disabled="!key" @click="run('key',async()=>{await api.saveJevKey(key);key='';})">保存密钥</button></div></label><label>决策间隔（毫秒）<input type="number" min="300" max="5000" v-model.number="edit.decisionIntervalMs"></label><label class="checkbox"><input type="checkbox" v-model="edit.autoRestart">对局结束后自动开始下一局</label><div class="info-box">自动游戏需要编译 ETC Bridge。手动模式关闭游戏动作，保留画面观察与推流。Ctrl + Alt + M 可随时接管。</div></section>
    <section class="card settings-card"><p class="eyebrow">03 · BROADCAST</p><h2>直播设置</h2><label>直播标题<input v-model="edit.title" maxlength="100"></label><div class="form-row"><label>YouTube 可见范围<select v-model="edit.youtubePrivacy"><option value="private">私密 · 首次测试推荐</option><option value="unlisted">不公开</option><option value="public">公开</option></select></label><label>视频码率（kbps）<input type="number" v-model.number="edit.bitrate" min="1500" max="8000"></label></div><label>OBS 安装目录<input v-model="edit.obsDirectory"></label><div class="info-box">软件创建独立的 YouTube / Twitch OBS 配置。默认 1080p60、NVENC 编码和游戏进程音频。Twitch 开播是公开的。</div></section>
    <section class="card settings-card next-card"><div class="orb">✦</div><h2>一次配置，持续创作。</h2><p>账号、游戏控制和直播输出分别运行。游戏切换为手动，不会停止正在进行的直播。</p><button class="primary-button" :disabled="!!pending||!!s.busy" @click="save">保存设置</button><button class="text-button" @click="page='studio'">回到直播工作台 →</button><small>第一阶段开发版 · 实际平台直播需账号开通直播权限</small></section>
   </div>
   </template>
   <div v-else class="loading">正在连接本机工作台…</div>
  </main>
 </div>
</template>
