import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Hosting } from './hosting';
import { providers, type Provider } from '../shared/types';
import { recordOverlayEvent } from '../shared/overlay-health';
export class OverlayServer {
 private server?:Server;private token=randomBytes(24).toString('hex');private origin='';
 private previewOrigin="'none'";
 constructor(private host:Hosting,private dist:string){}
 allowLocalPreview(origin:string){const u=new URL(origin);if(u.origin!==origin||u.protocol!=='http:'||u.hostname!=='127.0.0.1'||!u.port)throw new Error('Loopback preview origin required');this.previewOrigin=origin;}
 async start(){this.server=createServer(async(req,res)=>{const fail=(code:number)=>{res.writeHead(code).end();};try{
  if(req.headers.host!==new URL(this.origin).host)return fail(403);const url=new URL(req.url??'/',this.origin);res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(url.pathname.startsWith('/live2d/')){if(req.method!=='GET')return fail(405);const allowed=new Set(['/live2d/runtime/live2dcubismcore.min.js','/live2d/jev-girl/jev-girl.model3.json','/live2d/jev-girl/jev-girl.moc3','/live2d/jev-girl/jev-girl.cdi3.json','/live2d/jev-girl/jev-girl.2048/texture_00.png']);if(!allowed.has(url.pathname))return fail(404);const mime=url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.json')?'application/json':url.pathname.endsWith('.png')?'image/png':'application/octet-stream';res.setHeader('Content-Type',mime);res.end(await readFile(join(this.dist,url.pathname.slice(1))));return;}
  if(url.pathname.startsWith('/assets/')){if(req.method!=='GET')return fail(405);const file=resolve(this.dist,'.'+url.pathname);if(!file.startsWith(resolve(this.dist,'assets')+require('node:path').sep))return fail(403);const mime=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream';res.setHeader('Content-Type',mime);res.end(await readFile(file));return;}
  const parts=url.pathname.split('/').filter(Boolean);if(parts[0]!==this.token)return fail(404);const p=parts[2] as Provider;
  // The desktop file-origin preview can load only read-only assets behind the random capability.
  if(['avatar','audio'].includes(parts[1])&&req.method==='GET'&&['null','http://127.0.0.1:5173'].includes(req.headers.origin??'')){res.setHeader('Access-Control-Allow-Origin',req.headers.origin!);res.setHeader('Vary','Origin');}
  if(parts[1]==='view'&&providers.includes(p)&&req.method==='GET'){res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob:; worker-src 'self' blob:; frame-ancestors "+this.previewOrigin);res.end((await readFile(join(this.dist,'overlay.html'),'utf8')).replaceAll('./assets/','/assets/'));return;}
  if(parts[1]==='state'&&providers.includes(p)&&req.method==='GET'){this.host.overlay[p].lastSeen=Date.now();res.setHeader('Content-Type','application/json');res.end(JSON.stringify(this.host.forOutput(p)));return;}
  if(parts[1]==='ack'&&providers.includes(p)&&req.method==='POST'){if(req.headers.origin!==this.origin)return fail(403);const kind=url.searchParams.get('kind')??'started';if(!recordOverlayEvent(this.host.overlay[p],kind==='error'?'audioError':kind,url.searchParams.get('code')??'legacy'))return fail(400);res.end('{}');return;}
  if(parts[1]==='audio'&&/^[a-f0-9]{32}\.wav$/.test(parts[2])&&req.method==='GET'){const data=this.host.audioData(parts[2]);if(!data)return fail(404);res.setHeader('Content-Type','audio/wav');res.end(data);return;}
  if(parts[1]==='avatar'&&parts[2]===this.host.config.avatar.asset&&parts[2]&&req.method==='GET'){res.setHeader('Content-Type',parts[2].endsWith('.vrm')?'model/gltf-binary':parts[2].endsWith('.png')?'image/png':parts[2].endsWith('.webp')?'image/webp':'image/jpeg');res.end(await readFile(join(this.host.assets,parts[2])));return;}
  fail(404);
 }catch{if(!res.headersSent)res.writeHead(500);res.end();}});await new Promise<void>(r=>this.server!.listen(0,'127.0.0.1',r));const a=this.server.address();if(!a||typeof a==='string')throw new Error('host.overlayError');this.origin='http://127.0.0.1:'+a.port;}
 url(provider:Provider){return this.origin+'/'+this.token+'/view/'+provider;}
  assetURL(){return this.host.config.avatar.asset?this.origin+'/'+this.token+'/avatar/'+this.host.config.avatar.asset:'';}
 audioURL(){return this.host.utterance?.audio?this.origin+'/'+this.token+'/audio/'+this.host.utterance.audio:'';}
 close(){this.server?.closeAllConnections();this.server?.close();}
}
