import {it,expect} from 'vitest';import {createRequire} from 'node:module';
const {project}=createRequire(import.meta.url)('../console/telemetry.cjs');
it('publishes only observable fields, excluding credentials, local paths and raw cloud prompts',()=>{
 const secret='private-value';const data=project({timestamp:1,phase:'playing',session:secret,token:secret,processId:1,self:{health:100,healthSecret:secret},executor:{status:'running',secret},actions:[{id:'scan',kind:'scan',token:secret}],enemies:[],diagnostics:{shots:3}}, {cloudCalls:[{at:1,ok:true,action:'scan',ms:10,state:{prompt:secret}}],summary:{wins:0,token:secret}}, {candidate:'test',trial:'run',bridge:secret});
 expect(JSON.stringify(data)).not.toContain(secret);expect(data.cloud.candidate).toBe('scan');expect(data.metrics.shots).toBe(3);
});
it('projects the actual map and route without hidden archetypes or state credentials',()=>{
 const data=project({timestamp:2,self:{room:3,roomType:7},zone:{phase:2,stage:'warning',secondsLeft:18,collapseOrder:'private'},mapView:{open:false,revision:2,observedAt:1,phase:2,stage:'warning',rooms:[{id:3,number:42,x:0,y:0,w:1,h:1,risk:1,visited:true,RoomId:7,seed:'private'}],edges:[[3,4]],session:'private'}},{samples:[{navigation:{revision:2,target:4,route:[3,4],estimatedSeconds:45,token:'private'}}]}, {candidate:'test'});
 expect(data.mapView.rooms[0].number).toBe(42);expect(data.navigation.route).toEqual([3,4]);expect(JSON.stringify(data)).not.toContain('private');expect(data.mapView.rooms[0]).not.toHaveProperty('RoomId');
});
