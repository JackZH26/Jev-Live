import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, settingsSchema } from '../electron/storage';
import { XLive, validXServer } from '../electron/x-live';
const dirs:string[]=[];
afterEach(async()=>{for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});});
describe('X source credentials',()=>{
 it('permits official ingest hosts and rejects arbitrary destinations and credentials in URLs',()=>{
  for(const u of ['rtmps://sg.pscp.tv:443/x/','rtmp://sg.pscp.tv:80/x','rtmps://ingest.video.x.com/live'])expect(validXServer(u)).toBe(true);
  for(const u of ['https://sg.pscp.tv/x','rtmp://127.0.0.1/live','rtmps://sg.pscp.tv.evil.test/x','rtmps://evilpscp.tv/x','rtmps://user:pass@sg.pscp.tv/x','rtmps://sg.pscp.tv/x?key=secret','rtmps://sg.pscp.tv/x#secret','rtmps://sg.pscp.tv:22/x'])expect(validXServer(u),u).toBe(false);
 });
 it('encrypts the source, exposes metadata only and removes it without touching OAuth',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'jev-x-test-'));dirs.push(dir);
  const store=new Store(dir,{isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s).map(v=>v^173),decryptString:b=>Buffer.from(b).map(v=>v^173).toString()});await store.init();
  const x=new XLive(store);const source={name:'Fixture source',server:'rtmps://sg.pscp.tv/x',key:'fixture-private-stream-key'};
  await store.set('oauth.youtube',{fixture:true});await x.save(source);
  expect(await x.summary()).toEqual({configured:true,name:'Fixture source'});expect(await x.destination()).toEqual({server:source.server,key:source.key});
  const raw=await readFile(join(dir,'vault.bin'));expect(raw.includes(Buffer.from(source.key))).toBe(false);expect(raw.includes(Buffer.from(source.server))).toBe(false);
  await expect(x.save({...source,key:'bad\nkey'})).rejects.toThrow('error.xSourceInvalid');expect((await x.destination()).key).toBe(source.key);
  await x.remove();expect(await x.summary()).toEqual({configured:false,name:''});expect(await store.get('oauth.youtube')).toEqual({fixture:true});await expect(x.destination()).rejects.toThrow('error.xSourceRequired');
 });
 it('keeps existing selected platforms on migration and accepts all three explicitly',()=>{
  expect(settingsSchema.parse({}).enabledPlatforms).toEqual(['youtube','twitch']);
  expect(settingsSchema.parse({enabledPlatforms:['twitch']}).enabledPlatforms).toEqual(['twitch']);
  expect(settingsSchema.parse({enabledPlatforms:['youtube','twitch','x']}).enabledPlatforms).toEqual(['youtube','twitch','x']);
  expect(settingsSchema.safeParse({enabledPlatforms:['x','x']}).success).toBe(false);
 });
});
