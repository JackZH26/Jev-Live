// Fetch a bounded, anonymized PUBG subset of the researchers' public TwitchChat archive.
// No cookies, accounts, browser sessions, video downloads or platform writes.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inflateRawSync,crc32} from 'node:zlib';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]??'test-results/chat-fixtures');
const archive='https://osf.io/download/bys56/';
async function range(start,end){
 const value=start<0?`bytes=${start}`:`bytes=${start}-${end}`;
 const r=await fetch(archive,{headers:{Range:value},signal:AbortSignal.timeout(30000)});
 if(r.status!==206||!r.headers.get('content-range')){await r.body?.cancel();throw Error('Archive must support bounded range reads');}
 const b=Buffer.from(await r.arrayBuffer());if(b.length>4_000_000)throw Error('Archive range exceeds bound');return b;
}
const tail=await range(-65557),end=tail.lastIndexOf(Buffer.from('PK\x05\x06'));
if(end<0)throw Error('ZIP directory missing');
const centralSize=tail.readUInt32LE(end+12),centralOffset=tail.readUInt32LE(end+16);
if(centralSize>2_000_000)throw Error('Unexpected archive directory size');
const directory=await range(centralOffset,centralOffset+centralSize-1),entries=[];
for(let p=0;p<directory.length;){
 if(directory.readUInt32LE(p)!==0x02014b50)throw Error('Invalid ZIP directory');
 const nameLen=directory.readUInt16LE(p+28),extraLen=directory.readUInt16LE(p+30),commentLen=directory.readUInt16LE(p+32);
 entries.push({name:directory.toString('utf8',p+46,p+46+nameLen),method:directory.readUInt16LE(p+10),crc:directory.readUInt32LE(p+16),compressed:directory.readUInt32LE(p+20),size:directory.readUInt32LE(p+24),offset:directory.readUInt32LE(p+42)});
 p+=46+nameLen+extraLen+commentLen;
}
function unpack(e,b,base=0){
 const p=e.offset-base;if(b.readUInt32LE(p)!==0x04034b50)throw Error('Invalid ZIP record');
 const from=p+30+b.readUInt16LE(p+26)+b.readUInt16LE(p+28),compressed=b.subarray(from,from+e.compressed);
 if(compressed.length!==e.compressed||e.size>5_000_000)throw Error('Invalid member size');
 const data=e.method===8?inflateRawSync(compressed,{maxOutputLength:5_000_000}):e.method===0?compressed:null;
 if(!data||data.length!==e.size||crc32(data)!==e.crc)throw Error('ZIP integrity check failed');return data;
}
async function member(e){return unpack(e,await range(e.offset,e.offset+30+Buffer.byteLength(e.name)+e.compressed+255),e.offset);}
const metas=entries.filter(e=>e.name.endsWith('_meta.json')),metaStart=Math.min(...metas.map(e=>e.offset));
const metadata=await range(metaStart,centralOffset-1),candidates=[];
for(const e of metas){const meta=JSON.parse(unpack(e,metadata,metaStart));if(meta.stream_game_id==='493057'&&meta.stream_language==='en'){
 const file=entries.find(f=>f.name===e.name.replace('Meta_Data/','').replace('_meta.json','.csv'));
 if(file&&file.compressed>=20000&&file.compressed<2_000_000)candidates.push({file,meta});
}}
function csv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
const messages=[],selected=[],viewers=new Map(),streamers=new Set();let segmentOffset=0;
for(const {file,meta} of candidates){
 const streamer=file.name.split('/').at(-1).split('_')[0];if(streamers.has(streamer))continue;streamers.add(streamer);
 const raw=await member(file),rows=csv(raw.toString('utf8'));if(rows[0].join(',')!=='Time,User,Message')throw Error('Unexpected chat columns');let kept=0,last=0;
 for(const row of rows.slice(1)){
  if(messages.length>=2000||kept>=750)break;
  const seconds=Number(row[0]);let text=(row[2]??'').replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|@[\w.-]+/gi,'[redacted]').replace(/\b(?:\+?\d[\d ()-]{8,}\d)\b/g,'[redacted]').replace(/[\x00-\x1f]/g,' ').trim();
  if(!text||text.length>600||!Number.isFinite(seconds)||seconds<0||/\[redacted\]/.test(text))continue;
  const identity=streamer+':'+row[1];if(!viewers.has(identity))viewers.set(identity,'Viewer '+String(viewers.size+1).padStart(4,'0'));
  const id='captured-'+String(messages.length+1).padStart(5,'0');last=seconds*1000;
  messages.push({id,text,viewer:viewers.get(identity),offsetMs:segmentOffset+last,platform:'twitch',kind:'captured',category:'archived-pubg-chat'});kept++;
 }
 selected.push({member:file.name,streamDate:meta.stream_start_date,gameId:meta.stream_game_id,language:meta.stream_language,kept,sha256:createHash('sha256').update(raw).digest('hex')});segmentOffset+=last+30000;
 if(messages.length>=2000)break;
}
if(messages.length<1000)throw Error('Insufficient PUBG messages; no synthetic padding was added');
const dataset={version:1,game:'PUBG: BATTLEGROUNDS',description:'Archived English Twitch PUBG chat from the public TwitchChat research dataset (2019). Re-pseudonymized for LOCAL SIMULATION ONLY. This is neither current live chat nor evidence about the current ETC match.',sources:[{url:'https://osf.io/39ev7/',description:'Charles Ringer, Mihalis A. Nicolaou, James Alfred Walker: TwitchChat: A Dataset for Exploring Livestream Chat (2020). PUBG subset selected by Twitch game ID 493057.'},{url:'https://osf.io/download/bys56/',description:'Public research archive data_set.zip; source records stay outside Git.'}],messages};
await mkdir(out,{recursive:true});await writeFile(join(out,'pubg-captured.json'),JSON.stringify(dataset,null,2));await writeFile(join(out,'provenance.json'),JSON.stringify({retrievedAt:new Date().toISOString(),archive,gameId:'493057',selected,messages:messages.length,uniqueTexts:new Set(messages.map(m=>m.text)).size,transformations:['Filter to documented PUBG game ID and English streams','Replace researcher-hashed viewer IDs with local labels','Exclude links, mentions, emails and likely phone numbers','Concatenate source segments; preserve within-segment message timing'],limitations:['Historical 2019 public research data, not current platform ingestion','Untrusted audience text; not a source of current gameplay facts','No redistribution permission is inferred from the code MIT license; raw/subset data remains local']},null,2));
console.log(JSON.stringify({captured:messages.length,uniqueTexts:new Set(messages.map(m=>m.text)).size,streams:selected.length,file:join(out,'pubg-captured.json')}));
