import {it,expect} from 'vitest';import {createRequire} from 'node:module';
const {project}=createRequire(import.meta.url)('../console/telemetry.cjs');
it('publishes only observable fields, excluding credentials, local paths and raw cloud prompts',()=>{
 const secret='private-value';const data=project({timestamp:1,phase:'playing',session:secret,token:secret,processId:1,self:{health:100,healthSecret:secret},executor:{status:'running',secret},actions:[{id:'scan',kind:'scan',token:secret}],enemies:[],diagnostics:{shots:3}}, {cloudCalls:[{at:1,ok:true,action:'scan',ms:10,state:{prompt:secret}}],summary:{wins:0,token:secret}}, {candidate:'test',trial:'run',bridge:secret});
 expect(JSON.stringify(data)).not.toContain(secret);expect(data.cloud.candidate).toBe('scan');expect(data.metrics.shots).toBe(3);
});
