import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hostConfigSchema} from '../shared/hosting';
import {validateVoiceReference} from '../electron/voice-reference';
import {Hosting} from '../electron/hosting';
import {Store} from '../electron/storage';
import * as neural from '../electron/neural-speech';
import * as model from '../electron/host-model';

const dirs:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllGlobals();for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});});
function wave(seconds=4){const b=Buffer.alloc(44+48000*seconds);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);for(let at=44;at<b.length;at+=2)b.writeInt16LE(at%1000-500,at);return b;}
async function setup(){const directory=await mkdtemp(join(tmpdir(),'jev-clone-'));dirs.push(directory);const store=new Store(directory,{isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s),decryptString:b=>b.toString()});await store.init();const h=new Hosting(store,{} as any,()=>'',()=>undefined);return {h,directory};}
async function importReference(h:Hosting,directory:string){const path=join(directory,'english.wav');await writeFile(path,wave());await h.importVoiceReference(path);await h.save({...h.config,speechProvider:'qwen-clone',language:'en',voiceClone:{...h.config.voiceClone,text:'Welcome back. Let us enjoy the game together.'}});}

describe('paused voice cloning and English migration',()=>{
 it('preserves the private reference while migrating saved settings and every preview to English Melo',async()=>{
  const {h,directory}=await setup();await importReference(h,directory);
  const config=hostConfigSchema.parse(JSON.parse(await readFile(join(directory,'host.json'),'utf8')));
  expect(config.voiceClone.asset).toMatch(/^[a-f0-9]{32}\.wav$/);
  expect(await readFile(join(directory,'voice-references',config.voiceClone.asset))).toEqual(wave());
  expect(config.voiceClone.name).toBe('english.wav');
  const second=new Hosting(new Store(directory,{} as any),{} as any,()=>'',()=>undefined);
  vi.spyOn(second.speech,'voices').mockResolvedValue([]);await second.init();
  const speech=vi.spyOn(neural,'neuralSpeech').mockResolvedValue({id:'sample.wav',data:wave(1),duration:1});
  for(const language of ['en','zh-CN','zh-TW','ja','ko'] as const)await second.testVoice(language);
  expect(speech.mock.calls.map(c=>c[2])).toEqual(['en','en','en','en','en']);
  for(const call of speech.mock.calls){expect(call[4]).toBe('melo');expect(call[5]).toBeUndefined();}
  expect(second.config.language).toBe('en');
 });
 it('keeps the English voice when replying to a Chinese viewer through the full host routing',async()=>{
  const {h,directory}=await setup();await importReference(h,directory);h.config.commentary=false;h.running=true;(h as any).controller=new AbortController();
  const chat={id:'viewer-1',platform:'twitch' as const,authorId:'viewer',author:'Viewer',text:'这个箱子值得开吗？',at:Date.now(),self:false};
  h.chat.messages.push(chat);(h as any).pending.push(chat);
  vi.spyOn(model,'generateHostText').mockResolvedValue('Check the surroundings before opening that crate.');
  const speech=vi.spyOn(neural,'neuralSpeech').mockResolvedValue({id:'sample.wav',data:wave(1),duration:1});
  await (h as any).tick();expect(speech.mock.calls[0][2]).toBe('en');expect(speech.mock.calls[0][4]).toBe('melo');expect(speech.mock.calls[0][5]).toBeUndefined();expect(h.utterance?.audio).toBe('sample.wav');h.stop();
 });
 it('retains the experimental preset helper but previews it only in English',async()=>{
  const {h}=await setup();h.config=hostConfigSchema.parse({speechProvider:'qwen',neuralVoice:'serena',language:'en'});
  const speech=vi.spyOn(neural,'neuralSpeech').mockResolvedValue({id:'sample.wav',data:wave(1),duration:1});
  await h.testVoice('ja');expect(speech.mock.calls[0][1]).toBe('serena');
 });
 it('fails preflight and synthesis with no reference instead of substituting another voice',async()=>{
  const {h}=await setup();h.config=hostConfigSchema.parse({speechProvider:'qwen-clone'});
  const speech=vi.spyOn(neural,'neuralSpeech');expect(await h.speechReady()).toBe(false);
  await expect(h.testVoice('ko')).rejects.toThrow('host.voiceReferenceRequired');expect(speech).not.toHaveBeenCalled();expect(h.utterance?.audio).toBeUndefined();
 });
 it('rejects silence, truncated files, out-of-range duration and forged PCM headers',()=>{
  expect(validateVoiceReference(wave())).toBe(4);
  const silent=wave();silent.fill(0,44);const forged=wave();forged.writeUInt32LE(1,28);
  for(const data of [silent,wave(2),wave(21),wave().subarray(0,100),forged,Buffer.from('https://example.com/voice.wav')])expect(()=>validateVoiceReference(data)).toThrow('host.voiceReferenceInvalid');
 });
 it('rejects paths in saved reference IDs and does not replace a valid reference on bad import',async()=>{
  expect(hostConfigSchema.safeParse({voiceClone:{asset:'../other.wav'}}).success).toBe(false);
  const {h,directory}=await setup();await importReference(h,directory);const before=h.config.voiceClone;
  const path=join(directory,'invalid.wav');await writeFile(path,'invalid');await expect(h.importVoiceReference(path)).rejects.toThrow();expect(h.config.voiceClone).toEqual(before);
 });
 it('sends the clip only to the clone endpoint and verifies its distinct service identity',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(wave(1),{headers:{'Content-Type':'audio/wav'}}));vi.stubGlobal('fetch',fetcher);
  const reference={audio:wave().toString('base64'),text:'Welcome back. Let us enjoy the game together.'};
  await neural.neuralSpeech('こんにちは。','ryan','ja',new AbortController().signal,'qwen-clone',reference);
  expect(fetcher.mock.calls[0][0]).toBe('http://127.0.0.1:11438/speech');expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({voice:'',language:'ja',reference});
  fetcher.mockResolvedValue(new Response(JSON.stringify({ready:true,provider:'qwen3-tts'})));expect(await neural.neuralHealth('qwen-clone')).toBe(false);
  fetcher.mockResolvedValue(new Response(JSON.stringify({ready:true,provider:'qwen3-tts-clone'})));expect(await neural.neuralHealth('qwen-clone')).toBe(true);
 });
});
