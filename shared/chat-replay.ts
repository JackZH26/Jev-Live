import {z} from 'zod';
export const replayMessageSchema=z.object({id:z.string().min(1).max(120),text:z.string().trim().min(1).max(600),viewer:z.string().min(1).max(80),offsetMs:z.number().finite().nonnegative(),platform:z.enum(['youtube','twitch']).default('twitch'),kind:z.enum(['captured','synthetic']),category:z.string().max(60).default('chat')});
export const replayDatasetSchema=z.object({version:z.literal(1),game:z.string().min(1).max(150),description:z.string().max(2000),sources:z.array(z.object({url:z.string().url(),description:z.string().max(1000)})).max(30),messages:z.array(replayMessageSchema).min(1).max(20000)}).superRefine((v,c)=>{if(new Set(v.messages.map(m=>m.id)).size!==v.messages.length)c.addIssue({code:'custom',message:'Duplicate replay IDs'});if(v.messages.some(m=>m.kind==='captured')&&!v.sources.length)c.addIssue({code:'custom',message:'Captured messages require provenance'});});
export type ReplayDataset=z.infer<typeof replayDatasetSchema>;
export type ReplayPace='quiet'|'normal'|'burst'|'original';
/** Seeded order/timing lets a failed listening session be reproduced. */
export function replaySchedule(dataset:ReplayDataset,pace:ReplayPace,seed=21){
 let value=seed>>>0;const random=()=>{value=(Math.imul(1664525,value)+1013904223)>>>0;return value/4294967296;};
 const rows=[...dataset.messages];
 if(pace==='original'){rows.sort((a,b)=>a.offsetMs-b.offsetMs);const start=rows[0].offsetMs;return rows.map(row=>({...row,dueMs:row.offsetMs-start}));}
 for(let i=rows.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}
 let dueMs=0;
 return rows.map((row,i)=>{if(i){const burst=pace==='burst'&&i%30<10;dueMs+=Math.round(pace==='quiet'?12000+random()*18000:burst?150+random()*400:pace==='normal'?1800+random()*5200:2500+random()*6000);}return {...row,dueMs};});
}
