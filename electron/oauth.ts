import { message, t, type Locale } from '../shared/i18n';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { Store } from './storage';
import { ApiError, delay, form, jsonRequest } from './http';
import type { Account, OAuthProvider as Provider } from '../shared/types';

const twitchBaseScopes='channel:read:stream_key channel:manage:broadcast';
const scopes = { youtube: 'https://www.googleapis.com/auth/youtube.force-ssl', twitch: twitchBaseScopes+' user:read:chat user:write:chat' };
export interface Credentials { access_token:string; refresh_token:string; expiresAt:number; scope?:string[] | string; clientId:string; account:Account }
export function createPKCE() {
  const verifier = randomBytes(48).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url'), state: randomBytes(32).toString('base64url') };
}
export function equalState(expected:string, actual:string|null) {
  return !!actual && Buffer.byteLength(expected) === Buffer.byteLength(actual) && timingSafeEqual(Buffer.from(expected),Buffer.from(actual));
}
export function officialAuthUrl(raw:string, provider:Provider) {
  const u = new URL(raw);
  const allowed = provider === 'youtube' ? ['accounts.google.com'] : ['www.twitch.tv','id.twitch.tv'];
  if (u.protocol !== 'https:' || !allowed.includes(u.hostname) || u.username || u.password || u.port) throw new Error(message('error.authOrigin'));
  return u.href;
}

/** A fresh random loopback port and single-use state for each Google login. */
export async function googleCode(clientId:string, open:(url:string)=>Promise<void>, signal:AbortSignal, locale:Locale='en') {
  const pkce = createPKCE();
  let accept!:(code:string)=>void, decline!:(error:Error)=>void;
  const result = new Promise<string>((resolve,reject)=>{ accept=resolve; decline=reject; });
  // Install a handler now, even if opening the browser fails before we await result.
  void result.catch(()=>{});
  let used=false;
  const server = createServer((req,res)=>{
    const url=new URL(req.url ?? '/', 'http://127.0.0.1');
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','no-referrer');
    if (req.method !== 'GET' || url.pathname !== '/oauth/callback') { res.writeHead(404).end('Not found'); return; }
    if(used || !equalState(pkce.state,url.searchParams.get('state'))) { res.writeHead(400).end(t(locale,'auth.callbackInvalid')); return; }
    used=true;
    if(url.searchParams.has('error')) { res.end(t(locale,'auth.callbackCancelled')); decline(new Error(message('error.youtubeCancelled'))); return; }
    const code=url.searchParams.get('code');
    if(!code || code.length > 4096) { res.writeHead(400).end('Missing code.'); decline(new Error(message('error.authCode'))); return; }
    res.end(t(locale,'auth.callbackDone')); accept(code);
  });
  const abort=()=>decline(new Error(message('error.authExpired')));
  signal.addEventListener('abort',abort,{once:true});
  try {
    await new Promise<void>((resolve,reject)=>{ server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
    const address=server.address();
    if(!address || typeof address === 'string') throw new Error(message('error.callback'));
    const redirect=`http://127.0.0.1:${address.port}/oauth/callback`;
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',scope:scopes.youtube,state:pkce.state,code_challenge:pkce.challenge,code_challenge_method:'S256',access_type:'offline',prompt:'consent'}).toString();
    if(signal.aborted) throw new Error(message('error.cancelled'));
    await open(officialAuthUrl(url.href,'youtube'));
    return {code:await result, redirect, verifier:pkce.verifier};
  } finally { signal.removeEventListener('abort',abort); server.close(); server.closeAllConnections(); }
}

export class OAuth {
  readonly pending = new Map<Provider,AbortController>();
  readonly status: Partial<Record<Provider,string>> = {};
  private refreshing=new Map<Provider,Promise<Credentials>>();
  constructor(private store:Store, private open:(url:string)=>Promise<void>, private log:(message:string)=>void) {}
  async accounts():Promise<Record<Provider,Account|null>> {
    const youtube=await this.store.get<Credentials>('oauth.youtube'); const twitch=await this.store.get<Credentials>('oauth.twitch');
    return {youtube:youtube?.account ?? null,twitch:twitch?.account ?? null};
  }
  cancel(provider:Provider) { this.pending.get(provider)?.abort(); }
  async login(provider:Provider) {
    if(this.pending.has(provider)) throw new Error(message('error.authPending'));
    const settings=await this.store.settings();
    const clientId=provider==='youtube'?settings.googleClientId:settings.twitchClientId;
    if(!clientId) throw new Error(message('error.clientNeeded',{provider:provider==='youtube'?'Google Desktop':'Twitch Public'}));
    const controller=new AbortController(); this.pending.set(provider,controller);
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(10*60*1000)]);
    this.status[provider]=message('auth.waiting');
    try {
      let tokens:any;
      if(provider==='youtube') {
        const code=await googleCode(clientId,this.open,signal,settings.locale);
        const secret=await this.store.get<string>('google.clientSecret');
        tokens=await jsonRequest('https://oauth2.googleapis.com/token',{...form({client_id:clientId,...(secret?{client_secret:secret}:{}),code:code.code,code_verifier:code.verifier,redirect_uri:code.redirect,grant_type:'authorization_code'}),signal});
      } else {
        const device=await jsonRequest('https://id.twitch.tv/oauth2/device',{...form({client_id:clientId,scopes:scopes.twitch}),signal});
        const url=officialAuthUrl(device.verification_uri,'twitch');
        this.status.twitch=message('auth.code',{code:String(device.user_code).slice(0,20)});
        await this.open(url);
        const deadline=Date.now()+Math.min(Number(device.expires_in)*1000,600000);
        let interval=Math.max(5,Number(device.interval)||5)*1000;
        while(Date.now()<deadline) {
          await delay(interval,signal);
          try {
            tokens=await jsonRequest('https://id.twitch.tv/oauth2/token',{...form({client_id:clientId,scopes:scopes.twitch,device_code:device.device_code,grant_type:'urn:ietf:params:oauth:grant-type:device_code'}),signal}); break;
          } catch(error) {
            if(error instanceof ApiError && ['authorization_pending','authorization pending'].includes(error.code)) continue;
            if(error instanceof ApiError && error.code==='slow_down') { interval+=5000; continue; }
            throw error;
          }
        }
        if(!tokens) throw new Error(message('error.twitchTimeout'));
      }
      signal.throwIfAborted();
      if(!tokens.access_token || !tokens.refresh_token) throw new Error(message('error.offlineAccess'));
      const credential:Credentials={...tokens,expiresAt:Date.now()+Number(tokens.expires_in)*1000,clientId,account:{id:'',name:'',connected:true}};
      credential.account=await this.identify(provider,credential);
      signal.throwIfAborted();
      await this.store.set(`oauth.${provider}`,credential);
      this.log(message('event.authorized',{provider:provider==='youtube'?'YouTube':'Twitch'}));
    } finally { this.pending.delete(provider); delete this.status[provider]; }
  }
  private async identify(provider:Provider, c:Credentials):Promise<Account> {
    if(provider==='youtube') {
      const data=await jsonRequest('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{headers:{Authorization:`Bearer ${c.access_token}`}});
      if(!data.items?.length) throw new Error(message('error.noChannel'));
      return {id:data.items[0].id,name:data.items[0].snippet.title,connected:true};
    }
    const validated=await jsonRequest('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:`OAuth ${c.access_token}`}});
    if(validated.client_id!==c.clientId || !twitchBaseScopes.split(' ').every(s=>validated.scopes?.includes(s))) throw new Error(message('error.twitchScope'));
    return {id:validated.user_id,name:validated.login,connected:true};
  }
  async credentials(provider:Provider):Promise<Credentials> {
    const c=await this.store.get<Credentials>(`oauth.${provider}`);
    if(!c) throw new Error(message('error.loginNeeded',{provider}));
    if(c.expiresAt>Date.now()+120000) return c;
    const existing=this.refreshing.get(provider); if(existing) return existing;
    const work=(async()=>{
      const secret=provider==='youtube'?await this.store.get<string>('google.clientSecret'):undefined;
      const tokens=await jsonRequest(provider==='youtube'?'https://oauth2.googleapis.com/token':'https://id.twitch.tv/oauth2/token',form({client_id:c.clientId,grant_type:'refresh_token',refresh_token:c.refresh_token,...(secret?{client_secret:secret}:{})}));
      const updated:Credentials={...c,...tokens,refresh_token:tokens.refresh_token||c.refresh_token,expiresAt:Date.now()+tokens.expires_in*1000};
      // Persist rotated Twitch refresh token before exposing its new access token.
      await this.store.set(`oauth.${provider}`,updated); return updated;
    })();
    this.refreshing.set(provider,work);
    try { return await work; } finally { this.refreshing.delete(provider); }
  }
  async validateTwitch() {
    if(!await this.store.get('oauth.twitch')) return;
    const c=await this.credentials('twitch');
    try { await this.identify('twitch',c); }
    catch(e) { if(e instanceof ApiError && e.status===401) { await this.store.set('oauth.twitch',undefined); this.log(message('event.twitchInvalid')); } else throw e; }
  }
  async disconnect(provider:Provider) {
    this.cancel(provider);
    // Wait for in-flight login and refresh to settle before deleting credentials.
    while(this.pending.has(provider)) await delay(50);
    await this.refreshing.get(provider)?.catch(()=>{});
    const c=await this.store.get<Credentials>(`oauth.${provider}`);
    if(c) {
      const endpoint=provider==='youtube'?'https://oauth2.googleapis.com/revoke':'https://id.twitch.tv/oauth2/revoke';
      try {
        const response=await fetch(endpoint,{...form({token:provider==='youtube'?c.refresh_token:c.access_token,...(provider==='twitch'?{client_id:c.clientId}:{})}),signal:AbortSignal.timeout(10000),redirect:'error'});
        if(!response.ok) this.log(message('event.revokeFailed'));
      } catch { this.log(message('event.revokeOffline')); }
    }
    await this.store.set(`oauth.${provider}`,undefined);
  }
}
