import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { Store } from '../electron/storage';
import { OAuth, createPKCE, equalState, googleCode, officialAuthUrl } from '../electron/oauth';
import { ControlGate } from '../electron/game';
import { Broadcast } from '../electron/broadcast';
import { Platforms } from '../electron/platforms';
import { ApiError } from '../electron/http';

const dirs:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllGlobals();for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
async function storage(){
  const dir=await mkdtemp(join(tmpdir(),'jev-test-'));dirs.push(dir);
  const store=new Store(dir,{isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s).map(x=>x^173),decryptString:b=>Buffer.from(b).map(x=>x^173).toString()});await store.init();return store;
}
describe('credential boundaries',()=>{
  it('serializes concurrent vault writes without losing another provider',async()=>{
    const store=await storage();await Promise.all([store.set('one',{token:'fake'.repeat(8)}),store.set('two',{token:'fixture'.repeat(8)})]);
    expect(await store.get('one')).toEqual({token:'fake'.repeat(8)});expect(await store.get('two')).toEqual({token:'fixture'.repeat(8)});
    expect((await readFile(join(store.directory,'vault.bin'))).includes(Buffer.from('fake'.repeat(8)))).toBe(false);
  });
  it('never falls back to plaintext if OS encryption is unavailable',async()=>{
    const base=await storage();const store=new Store(base.directory,{isEncryptionAvailable:()=>false,encryptString:()=>Buffer.alloc(0),decryptString:()=>''});
    await expect(store.set('secret','fixture')).rejects.toThrow('error.secureStore');
  });
  it('uses a fresh valid PKCE challenge and rejects mismatched state',()=>{
    const a=createPKCE(),b=createPKCE();expect(a.verifier.length).toBeGreaterThanOrEqual(43);expect(a.verifier).not.toBe(b.verifier);
    expect(createHash('sha256').update(a.verifier).digest('base64url')).toBe(a.challenge);
    expect(equalState(a.state,a.state)).toBe(true);expect(equalState(a.state,b.state)).toBe(false);expect(equalState(a.state,null)).toBe(false);
  });
  it('rejects phishing auth origins, credentials and nonstandard ports',()=>{
    for(const url of ['https://www.twitch.tv.evil.test/activate','http://www.twitch.tv/activate','https://user@www.twitch.tv/activate','https://www.twitch.tv:8443/activate'])expect(()=>officialAuthUrl(url,'twitch')).toThrow();
    expect(officialAuthUrl('https://www.twitch.tv/activate?device-code=TEST','twitch')).toContain('www.twitch.tv');
  });
  it('keeps the loopback alive after an invalid state and closes after valid code',async()=>{
    let redirect='';
    const result=await googleCode('test-client',async raw=>{
      const url=new URL(raw);redirect=url.searchParams.get('redirect_uri')!;
      const bad=await fetch(`${redirect}?code=test&state=invalid`);expect(bad.status).toBe(400);
      const good=await fetch(`${redirect}?code=valid-test&state=${url.searchParams.get('state')}`);expect(good.status).toBe(200);
    },new AbortController().signal);
    expect(result.code).toBe('valid-test');expect(new URL(redirect).hostname).toBe('127.0.0.1');
    await expect(fetch(redirect)).rejects.toThrow();
  });
  it('cancels login and closes the callback listener',async()=>{
    const control=new AbortController();let redirect='';
    await expect(googleCode('test',async raw=>{redirect=new URL(raw).searchParams.get('redirect_uri')!;control.abort();},control.signal)).rejects.toThrow();
    await expect(fetch(redirect)).rejects.toThrow();
  });
  it('rotates a Twitch refresh token once across concurrent callers',async()=>{
    const store=await storage();await store.set('oauth.twitch',{access_token:'expired',refresh_token:'old',expiresAt:1,clientId:'client',account:{id:'1',name:'fixture',connected:true}});
    const fetcher=vi.fn(async()=>{await new Promise(r=>setTimeout(r,15));return new Response(JSON.stringify({access_token:'new',refresh_token:'rotated',expires_in:14400}),{status:200});});vi.stubGlobal('fetch',fetcher);
    const auth=new OAuth(store,async()=>{},()=>{});const result=await Promise.all([auth.credentials('twitch'),auth.credentials('twitch'),auth.credentials('twitch')]);
    expect(fetcher).toHaveBeenCalledTimes(1);expect(result.every(c=>c.refresh_token==='rotated')).toBe(true);
    expect((await store.get<any>('oauth.twitch')).refresh_token).toBe('rotated');
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).not.toContain('client_secret');
  });
});
describe('manual handover',()=>{
  it('rejects late AI decisions after switching to manual and back',()=>{
    const gate=new ControlGate();const first=gate.change('auto'),at=Date.now();expect(gate.permits(first,at)).toBe(true);
    gate.change('manual');expect(gate.permits(first,at)).toBe(false);const second=gate.change('auto');expect(gate.permits(first,at)).toBe(false);expect(gate.permits(second,at)).toBe(true);
  });
  it('rejects old observations and future clock anomalies',()=>{
    const gate=new ControlGate();const epoch=gate.change('auto');expect(gate.permits(epoch,1000,4000)).toBe(false);expect(gate.permits(epoch,10000,4000)).toBe(false);
  });
});
describe('dual-output transaction',()=>{
  async function fixture(){
    const store=await storage();await store.saveSettings({...await store.settings(),gameWindow:'fixture-window',steamAppId:'5272970',addedSteamGames:['5272970']});
    const calls:string[]=[];
    const obs:any={states:{youtube:{connected:true,ready:true,active:false},twitch:{connected:true,ready:true,active:false}},poll:async()=>{},windows:async()=>[{value:'fixture-window'}],service:async(p:string)=>{calls.push(`service:${p}`);},start:async(p:string)=>{calls.push(`start:${p}`);},stop:vi.fn(async(p:string)=>{calls.push(`stop:${p}`);}),clearKey:async()=>{}};
    const auth:any={accounts:async()=>({youtube:{},twitch:{}}),validateTwitch:async()=>{}};
    const platforms:any={twitchDestination:async()=>({server:'rtmp://fixture',key:'test',url:'https://www.twitch.tv/fixture'}),createYouTubeBroadcast:async()=>({id:'broadcast'}),createYouTubeStream:async()=>({id:'stream',cdn:{ingestionInfo:{ingestionAddress:'rtmp://fixture',streamName:'test'}}}),bind:async()=>{},finish:vi.fn(async()=>{})};
    return {store,obs,auth,platforms,calls,broadcast:new Broadcast(store,obs,auth,platforms,()=>{})};
  }
  it('prepares both destinations before starting and never confuses pushing with platform confirmation',async()=>{
    const f=await fixture();await f.broadcast.start();expect(f.calls.slice(0,4)).toEqual(['service:youtube','service:twitch','start:youtube','start:twitch']);expect(f.broadcast.state.state).toBe('sending');
  });
  it('stops both outputs and finishes its own YouTube event if second output fails',async()=>{
    const f=await fixture();f.obs.start=async(p:string)=>{if(p==='twitch')throw new Error('fixture-fail');};await expect(f.broadcast.start()).rejects.toThrow('fixture-fail');
    expect(f.obs.stop).toHaveBeenCalledWith('youtube');expect(f.obs.stop).toHaveBeenCalledWith('twitch');expect(f.platforms.finish).toHaveBeenCalledWith('broadcast');expect(f.broadcast.state.state).toBe('idle');
  });
  it('keeps durable recovery information if stopping cannot be confirmed',async()=>{
    const f=await fixture();await f.broadcast.start();f.obs.stop=async()=>{throw new Error('disconnected');};await expect(f.broadcast.stop()).rejects.toThrow();
    expect((await f.store.get<any>('broadcast')).state).toBe('recovery');const recovered=new Broadcast(f.store,f.obs,{} as any,f.platforms,()=>{});await recovered.init();expect(recovered.state.youtubeId).toBe('broadcast');
  });
  it('does not touch a pre-existing stream when preflight fails',async()=>{
    const f=await fixture();f.obs.states.twitch.active=true;await expect(f.broadcast.start()).rejects.toThrow();expect(f.obs.stop).not.toHaveBeenCalled();expect(f.platforms.finish).not.toHaveBeenCalled();
  });
  it('requires a selected library game before creating any broadcast resources',async()=>{
    const f=await fixture();await f.store.saveSettings({...await f.store.settings(),steamAppId:''});await expect(f.broadcast.start()).rejects.toThrow('error.steamSelection');expect(f.calls).toEqual([]);
  });
  it('streams YouTube alone without Twitch credentials and leaves a separate Twitch stream untouched',async()=>{
    const f=await fixture();await f.store.saveSettings({...await f.store.settings(),enabledPlatforms:['youtube']});
    f.auth.accounts=async()=>({youtube:{},twitch:null});f.auth.validateTwitch=vi.fn(()=>{throw new Error('must not validate Twitch');});
    f.platforms.twitchDestination=vi.fn(()=>{throw new Error('must not access Twitch');});f.obs.states.twitch.active=true;
    await f.broadcast.start();expect(f.calls).toEqual(['service:youtube','start:youtube']);
    expect(f.broadcast.state.platforms).toEqual(['youtube']);expect(f.auth.validateTwitch).not.toHaveBeenCalled();
    await f.broadcast.stop();expect(f.obs.stop).toHaveBeenCalledTimes(1);expect(f.obs.stop).toHaveBeenCalledWith('youtube');expect(f.platforms.twitchDestination).not.toHaveBeenCalled();
  });
  it('supports Twitch alone without creating YouTube resources',async()=>{
    const f=await fixture();await f.store.saveSettings({...await f.store.settings(),enabledPlatforms:['twitch']});
    f.auth.accounts=async()=>({youtube:null,twitch:{}});f.obs.states.youtube.ready=false;
    f.platforms.createYouTubeBroadcast=vi.fn(()=>{throw new Error('must not access YouTube');});
    await f.broadcast.start();expect(f.calls).toEqual(['service:twitch','start:twitch']);await f.broadcast.stop();
    expect(f.platforms.createYouTubeBroadcast).not.toHaveBeenCalled();expect(f.platforms.finish).not.toHaveBeenCalled();expect(f.obs.stop).toHaveBeenCalledWith('twitch');
  });
  it('requires a platform before contacting services or changing outputs',async()=>{
    const f=await fixture();await f.store.saveSettings({...await f.store.settings(),enabledPlatforms:[]});
    f.auth.accounts=vi.fn();await expect(f.broadcast.start()).rejects.toThrow('channels.minimum');
    expect(f.auth.accounts).not.toHaveBeenCalled();expect(f.calls).toEqual([]);expect(f.broadcast.state.state).toBe('idle');
  });
  it('reports YouTube activation rejection without starting either selected output',async()=>{
    const f=await fixture();
    const platforms=new Platforms({credentials:async()=>({access_token:'fixture'})} as any);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:{errors:[{reason:'livePermissionBlocked'}]}}),{status:403})));
    f.platforms.createYouTubeBroadcast=platforms.createYouTubeBroadcast.bind(platforms);
    f.platforms.twitchDestination=vi.fn();
    await expect(f.broadcast.start()).rejects.toThrow('error.youtubeLiveUnavailable');
    expect(f.calls.some(c=>c.startsWith('start:'))).toBe(false);expect(f.platforms.twitchDestination).not.toHaveBeenCalled();
    expect(f.broadcast.state.state).toBe('idle');expect((await f.store.settings()).enabledPlatforms).toEqual(['youtube','twitch']);
  });
  it('recovers the original selected outputs even if settings change after a crash',async()=>{
    const f=await fixture();await f.store.saveSettings({...await f.store.settings(),enabledPlatforms:['youtube']});await f.broadcast.start();
    await f.store.saveSettings({...await f.store.settings(),enabledPlatforms:['twitch']});
    const recovered=new Broadcast(f.store,f.obs,f.auth,f.platforms,()=>{});await recovered.init();await recovered.stop();
    expect(f.obs.stop).toHaveBeenCalledTimes(1);expect(f.obs.stop).toHaveBeenCalledWith('youtube');
  });
  it('rolls back only selected outputs and leaves idle stop harmless',async()=>{
    const f=await fixture();await f.broadcast.stop();expect(f.obs.stop).not.toHaveBeenCalled();
    await f.store.saveSettings({...await f.store.settings(),enabledPlatforms:['youtube']});f.obs.start=async()=>{throw new Error('startup-failed');};
    await expect(f.broadcast.start()).rejects.toThrow('startup-failed');expect(f.obs.stop).toHaveBeenCalledTimes(1);expect(f.obs.stop).toHaveBeenCalledWith('youtube');
  });
});

describe('platform error guidance',()=>{
  it.each(['livePermissionBlocked','liveStreamingNotEnabled'])('explains YouTube %s without exposing the provider body',async code=>{
    const p=new Platforms({credentials:async()=>({access_token:'fixture'})} as any);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:{message:'private provider content',errors:[{reason:code}]}}),{status:403})));
    const error=await p.createYouTubeBroadcast('Fixture','private').catch(e=>e);
    expect(error.message).toContain('error.youtubeLiveUnavailable');expect(error.message).toContain(code);expect(error.message).not.toContain('private provider content');
  });
  it('does not mislabel unrelated permission errors as YouTube activation',async()=>{
    const p=new Platforms({credentials:async()=>({access_token:'fixture'})} as any);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:{errors:[{reason:'forbidden'}]}}),{status:403})));
    await expect(p.createYouTubeBroadcast('Fixture','private')).rejects.toBeInstanceOf(ApiError);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'livePermissionBlocked'}),{status:403})));
    await expect(p.twitch('streams')).rejects.toBeInstanceOf(ApiError);
  });
});
