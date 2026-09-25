import { readFile, readdir, stat, realpath } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SteamGame } from '../shared/types';
import { message } from '../shared/i18n';

type Vdf={ [key:string]: string|Vdf };
/** Valve KeyValues subset used in libraryfolders.vdf and app manifests. Never evaluate it. */
export function parseVdf(text:string):Vdf {
 const tokens=[...text.matchAll(/"((?:\\.|[^"\\])*)"|([{}])|\/\/[^\r\n]*/g)].filter(m=>!m[0].startsWith('//')).map(m=>m[2]??m[1].replace(/\\([\\"])/g,'$1'));
 let pos=0;
 const object=(nested=false):Vdf=>{const result:Vdf=Object.create(null);while(pos<tokens.length){const key=tokens[pos++];if(key==='}'){if(!nested)throw new Error('Unexpected VDF close');return result;}const value=tokens[pos++];if(value===undefined||value==='}')throw new Error('Invalid VDF');result[key]=value==='{'?object(true):value;}if(nested)throw new Error('Unclosed VDF');return result;};
 return object();
}
export function pathWithin(root:string,target:string){const r=relative(resolve(root),resolve(target));return !!r&&!r.startsWith('..')&&!isAbsolute(r);}
export class Steam {
 games:SteamGame[]=[];
 constructor(private open:(url:string)=>Promise<void>,private rootOverride?:string){}
 async root(){
  if(this.rootOverride)return this.rootOverride;
  try{const {stdout}=await promisify(execFile)('reg.exe',['query','HKCU\\Software\\Valve\\Steam','/v','SteamPath'],{windowsHide:true});const value=stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i)?.[1].trim();if(value)return value;}catch{}
  throw new Error(message('error.steamMissing'));
 }
 async scan(){
  const root=await this.root(),libraries=new Set([root]);
  try{const raw=parseVdf(await readFile(join(root,'steamapps','libraryfolders.vdf'),'utf8')).libraryfolders;if(typeof raw==='object')for(const [key,entry]of Object.entries(raw)){if(!/^\d+$/.test(key))continue;const path=typeof entry==='string'?entry:entry.path;if(typeof path==='string')libraries.add(path);}}catch{}
  const found=new Map<string,SteamGame>();
  for(const library of libraries){
   const steamapps=join(library,'steamapps');let files:string[];try{files=await readdir(steamapps);}catch{continue;}
   for(const file of files.filter(f=>/^appmanifest_\d+\.acf$/i.test(f))){
    try{
     const app=parseVdf(await readFile(join(steamapps,file),'utf8')).AppState as Vdf;
     if(!app||typeof app.appid!=='string'||!/^\d+$/.test(app.appid)||file!==`appmanifest_${app.appid}.acf`||typeof app.name!=='string'||typeof app.installdir!=='string')continue;
     if(!(Number(app.StateFlags)&4)||app.appid==='228980')continue;
     const common=join(steamapps,'common'),folder=resolve(common,app.installdir);
     if(!pathWithin(common,folder)||!(await stat(folder)).isDirectory())continue;
     const actual=await realpath(folder);if(!pathWithin(await realpath(common),actual))continue;
     const config=app.UserConfig as Vdf|undefined;
     found.set(app.appid,{appId:app.appid,name:app.name,installDirectory:actual,buildId:String(app.buildid??''),branch:typeof config?.BetaKey==='string'?config.BetaKey:'public',autoSupport:app.appid==='5272970'?'experimental':'unavailable'});
    }catch{/* Skip incomplete downloads and malformed manifests; never expose raw account metadata. */}
   }
  }
  this.games=[...found.values()].sort((a,b)=>(a.appId==='5272970'?-1:b.appId==='5272970'?1:a.name.localeCompare(b.name)));return this.games;
 }
 async get(appId:string){if(!/^\d+$/.test(appId))throw new Error(message('error.steamSelection'));return (await this.scan()).find(g=>g.appId===appId);}
 async launch(appId:string){if(!await this.get(appId))throw new Error(message('error.steamSelection'));await this.open(`steam://rungameid/${appId}`);}
 /** Gracefully close only the installed ETC Playtest after its confirmed result. */
 async closePlaytest(processId:number,signal:AbortSignal){
  if(!Number.isSafeInteger(processId)||processId<=0)throw new Error('Invalid Playtest process');
  const game=await this.get('5272970');if(!game)throw new Error(message('error.steamSelection'));
  signal.throwIfAborted();
  const expected=join(game.installDirectory,'Lyra','Binaries','Win64','LyraGame-Win64-Shipping.exe').replace(/'/g,"''");
  const script=`$ErrorActionPreference='Stop'\n$targetGame=Get-Process -Id ${processId} -ErrorAction Stop\nif($targetGame.Path -ne '${expected}'){throw 'Playtest process changed'}\nif(-not $targetGame.CloseMainWindow()){throw 'Playtest window could not close'}\nif(-not $targetGame.WaitForExit(10000)){throw 'Playtest did not exit'}`;
  await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,signal,timeout:15000});
 }
}
