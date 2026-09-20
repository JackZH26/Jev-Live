import {describe,it,expect} from 'vitest';import {streamChecks} from '../shared/readiness';import type {Snapshot} from '../shared/types';
const fixture=()=>({settings:{enabledPlatforms:['x'],gameWindow:'game'},selectedGame:{appId:'5272970'},gameConnected:true,xSource:{configured:true},accounts:{},outputs:{x:{connected:true,ready:true}}}) as unknown as Snapshot;
describe('stream setup explanations',()=>{
 it('only requires selected platform accounts and detects a stopped Steam game',()=>{const s=fixture();expect(streamChecks(s).every(c=>c.ready)).toBe(true);s.gameConnected=false;expect(streamChecks(s).filter(c=>!c.ready).map(c=>c.id)).toEqual(['running','capture']);});
 it('names the account and output that block readiness',()=>{const s=fixture();s.settings.enabledPlatforms=['twitch'];s.outputs.twitch={connected:false,ready:false} as any;expect(streamChecks(s).filter(c=>!c.ready).map(c=>c.id)).toEqual(['account-twitch','obs-twitch']);});
});
