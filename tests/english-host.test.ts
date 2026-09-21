import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {englishHostConfig,hostConfigSchema} from '../shared/hosting';
import {Hosting} from '../electron/hosting';
import {Store} from '../electron/storage';

const dirs:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true});});
it('migrates experimental saved voices to English Melo while preserving the private reference',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'jev-english-'));dirs.push(directory);
 const saved=hostConfigSchema.parse({language:'ko',speechProvider:'qwen-clone',neuralVoice:'sohee',voiceClone:{asset:'a'.repeat(32)+'.wav',name:'reference.wav',text:'Welcome back.'}});
 await writeFile(join(directory,'host.json'),JSON.stringify(saved));
 const host=new Hosting(new Store(directory,{} as any),{} as any,()=>'',()=>undefined);
 vi.spyOn(host.speech,'voices').mockResolvedValue([]);await host.init();
 expect(host.config).toMatchObject({language:'en',speechProvider:'melo',voiceClone:saved.voiceClone});
 expect(englishHostConfig({...saved,speechProvider:'qwen'}).speechProvider).toBe('melo');
 expect(englishHostConfig({}).speechProvider).toBe('melo');
});
it('never reuses a saved Chinese Windows voice for the English preview',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'jev-english-'));dirs.push(directory);
 const host=new Hosting(new Store(directory,{} as any),{} as any,()=>'',()=>undefined);
 host.config=englishHostConfig({speechProvider:'system',voice:'Chinese voice'});
 host.voices=[{name:'Chinese voice',language:'zh-CN'},{name:'English voice',language:'en-US'}];
 const synth=vi.spyOn(host.speech,'synthesize').mockResolvedValue({id:'test.wav',data:Buffer.alloc(44),duration:1});
 expect(await host.speechReady()).toBe(true);
 await host.testVoice('ja');
 expect(synth.mock.calls[0][1]).toBe('');
 expect(synth.mock.calls[0][2]).toBe('en');
 expect(host.utterance?.language).toBe('en');
 host.voices=[{name:'Chinese voice',language:'zh-CN'}];
 expect(await host.speechReady()).toBe(false);
});
