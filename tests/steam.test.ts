import { describe,it,expect } from 'vitest';
import { mkdtemp,mkdir,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Steam,parseVdf,pathWithin } from '../electron/steam';
import { screenActions } from '../electron/game';

describe('Steam library',()=>{
 it('reads escaped Windows paths and rejects truncated manifests',()=>{
  expect(parseVdf('"path" "D:\\\\Steam" // comment\n"child" {"name" "Game"}')).toEqual({path:'D:\\Steam',child:{name:'Game'}});
  expect(()=>parseVdf('"root" {"name" "Game"')).toThrow();
  expect(pathWithin('C:\\Steam\\common','C:\\Steam\\common\\..\\secret')).toBe(false);
 });
 it('scans multiple libraries, excludes incomplete installs and launches only discovered numeric IDs',async()=>{
  const root=await mkdtemp(join(tmpdir(),'jev-steam-'));
  try{
   const extra=join(root,'second');await mkdir(join(root,'steamapps','common','Game'),{recursive:true});await mkdir(join(extra,'steamapps','common','ETC'),{recursive:true});
   await writeFile(join(root,'steamapps','libraryfolders.vdf'),`"libraryfolders" {"0" {"path" "${extra.replace(/\\/g,'\\\\')}"}}`);
   await writeFile(join(root,'steamapps','appmanifest_11.acf'),'"AppState" {"appid" "11" "name" "Game" "StateFlags" "4" "installdir" "Game" "LastOwner" "private-owner-fixture"}');
   await writeFile(join(extra,'steamapps','appmanifest_5272970.acf'),'"AppState" {"appid" "5272970" "name" "ETC" "StateFlags" "4" "installdir" "ETC" "buildid" "1"}');
   await writeFile(join(root,'steamapps','appmanifest_12.acf'),'"AppState" {"appid" "12" "name" "Incomplete" "StateFlags" "2" "installdir" "Game"}');
   const urls:string[]=[],steam=new Steam(async url=>{urls.push(url);},root),games=await steam.scan();
   expect(games.map(g=>g.appId)).toEqual(['5272970','11']);expect(JSON.stringify(games)).not.toContain('private-owner');
   await steam.launch('11');expect(urls).toEqual(['steam://rungameid/11']);
   await expect(steam.launch('11/../../install')).rejects.toThrow();await expect(steam.launch('999')).rejects.toThrow();
  }finally{await rm(root,{recursive:true,force:true});}
 });
});
describe('screen game adaptation',()=>{
 const observation=(text:string)=>({connected:true,timestamp:Date.now(),foreground:true,ocrAvailable:true,lines:[{text,x:.1,y:.4,width:.2,height:.05}]});
 it('uses observed menu coordinates, never turns online matchmaking into an action',()=>{
  expect(screenActions(observation('BOT MATCH'),false).actions[1]).toMatchObject({kind:'menu',x:.2,y:.42500000000000004});
  expect(screenActions(observation('MATCH MAKING'),false).actions).toHaveLength(1);
 });
 it('waits on unrecognized or failed observations and respects restart preference',()=>{
  expect(screenActions(observation('Unknown UI'),false).actions[0].kind).toBe('wait');
  expect(screenActions({...observation('Players 19'),error:'capture_unavailable'},false).phase).toBe('loading');
  expect(screenActions(observation('ELIMINATED'),false).actions).toHaveLength(1);
  expect(screenActions(observation('AMMO 30/90'),false).phase).toBe('playing');
 });
});
