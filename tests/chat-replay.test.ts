import {describe,it,expect,vi,afterEach} from 'vitest';
import {Chat} from '../electron/chat';
import {replyLanguage,matchesReplyLanguage} from '../shared/reply-language';
import {hostConfigSchema,type ChatMessage} from '../shared/hosting';
import {replayDatasetSchema,replaySchedule} from '../shared/chat-replay';
const message:ChatMessage={id:'sample',platform:'twitch',authorId:'viewer',author:'Viewer',text:'How do you choose cover?',at:Date.now(),self:false};
afterEach(()=>vi.unstubAllGlobals());
describe('isolated audience rehearsal',()=>{
 it('uses English for hosting and unsupported languages, matching supported comment scripts',()=>{
  expect(hostConfigSchema.parse({}).language).toBe('en');
  for(const [text,language] of [['为什么不先找掩体？','zh-CN'],['這個房間怎麼走？','zh-TW'],['How do I reload?','en'],['どの武器が好きですか？','ja'],['어떤 무기가 좋아요?','ko'],['¿Cuál es tu arma favorita?','en'],['Как выбрать оружие?','en'],['مرحبا','en'],['🔥🔥','en']])expect(replyLanguage(text)).toBe(language);
 });
 it('rejects Japanese text for Korean speech instead of trusting the chosen language label',()=>{expect(matchesReplyLanguage('隠れることが基本です。','ko')).toBe(false);expect(matchesReplyLanguage('엄폐물을 먼저 찾는 편이에요.','ko')).toBe(true);expect(matchesReplyLanguage('先找掩体。','en')).toBe(false);});
 it('feeds the same receive callback, deduplicates, and never calls a platform in simulation',async()=>{
  const receive=vi.fn(),auth={credentials:vi.fn()},fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  const chat=new Chat(auth as any,receive,'simulation');await chat.start(['youtube','twitch']);chat.ingestReplay(message);chat.ingestReplay(message);
  expect(receive).toHaveBeenCalledOnce();expect(receive.mock.calls[0][0].simulation).toBe(true);
  await chat.send(chat.messages[0],'Use nearby cover.');expect(chat.simulatedReplies).toHaveLength(1);expect(fetcher).not.toHaveBeenCalled();expect(auth.credentials).not.toHaveBeenCalled();chat.stop();await expect(chat.send(chat.messages[0],'late')).rejects.toThrow();
 });
 it('refuses replay ingress and egress in a live instance before any network call',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const chat=new Chat({} as any,()=>{});
  expect(()=>chat.ingestReplay(message)).toThrow('isolated');await expect(chat.send({...message,simulation:true},'reply')).rejects.toThrow('never');expect(fetcher).not.toHaveBeenCalled();
 });
 it('keeps only bounded display history after a two-thousand-message burst',()=>{const receive=vi.fn(),chat=new Chat({} as any,receive,'simulation');for(let i=0;i<2000;i++)chat.ingestReplay({...message,id:'burst-'+i});expect(receive).toHaveBeenCalledTimes(2000);expect(chat.messages).toHaveLength(200);expect(chat.messages[0].id).toBe('burst-1800');expect(chat.status.twitch.received).toBe(2000);});
 it('preserves recorded timing and makes random replay reproducible without changing provenance',()=>{
  const data=replayDatasetSchema.parse({version:1,game:'PUBG',description:'fixture',sources:[{url:'https://example.test/dataset',description:'test source'}],messages:Array.from({length:2000},(_,i)=>({id:String(i),viewer:'Viewer '+i%50,text:'message '+i,offsetMs:9000+i*200,platform:'twitch',kind:'captured'}))});
  expect(replaySchedule(data,'original')[0].dueMs).toBe(0);expect(replaySchedule(data,'original')[1].dueMs).toBe(200);
  const a=replaySchedule(data,'burst',1),b=replaySchedule(data,'burst',1),c=replaySchedule(data,'burst',2);expect(a).toEqual(b);expect(a).not.toEqual(c);expect(new Set(a.map(v=>v.id)).size).toBe(2000);expect(a.every(v=>v.kind==='captured')).toBe(true);expect(a.slice(1).every((v,i)=>v.dueMs>a[i].dueMs)).toBe(true);
 });
 it('rejects untraceable captured data and duplicate source IDs',()=>{
  const row={id:'same',viewer:'Viewer',text:'hi',offsetMs:0,kind:'captured'};
  expect(replayDatasetSchema.safeParse({version:1,game:'PUBG',description:'',sources:[],messages:[row]}).success).toBe(false);
  expect(replayDatasetSchema.safeParse({version:1,game:'PUBG',description:'',sources:[{url:'https://example.test',description:''}],messages:[row,row]}).success).toBe(false);
 });
});
