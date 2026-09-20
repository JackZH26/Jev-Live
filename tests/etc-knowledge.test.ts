import {it,expect} from 'vitest';
import {EtcKnowledge,ROOM_KNOWLEDGE,roomKnowledge,canDefendRoom} from '../electron/etc-knowledge';
import {etcObservationSchema,type EtcObservation} from '../shared/etc';
const state=(match='m',slot=27,type?:number)=>({matchId:match,phase:'playing',self:{room:slot,roomType:type}} as EtcObservation);
it('learns archetypes only from visited arrival titles, never map display numbers',()=>{
 const k=new EtcKnowledge(),o=state();k.observe(o);expect(k.context(o).currentRoom).toBeNull();
 o.self.roomType=7;k.observe(o);expect(k.context(o).currentRoom?.id).toBe(7);expect(k.crossingSeconds(27)).toBe(45);expect(k.crossingSeconds(7)).toBe(30);
 k.observe(state('new',27));expect(k.visited.size).toBe(0);
});
it('has bilingual, sourced entries for the current 28-room catalog with explicit uncertainty',()=>{
 expect(ROOM_KNOWLEDGE.map(r=>r.id)).toEqual(Array.from({length:28},(_,i)=>i+1));
 for(const r of ROOM_KNOWLEDGE){expect(r.source).toMatch(/^(Docs|Public|Private)\//);expect(r.rulesZh.length).toBe(r.rules.length);expect(r.crossingSeconds).toBeGreaterThanOrEqual(20);}
 expect(roomKnowledge(26)?.rules.join(' ')).toContain('Only one searchlight');expect(roomKnowledge(27)?.rules.join(' ')).toContain('push rather than');
 expect(roomKnowledge(12)?.rules.join(' ')).toContain('hidden depth');expect(roomKnowledge(99)).toBeUndefined();
});
it('rejects corrupt room identities at the bridge schema boundary',()=>{
 const shape=etcObservationSchema.shape.self;
 expect(shape.shape.roomType.safeParse(99).success).toBe(false);expect(shape.shape.roomType.safeParse(undefined).success).toBe(true);
});
it('defends only a known safe terrain room with a stocked primary, not a guessed type or hazard room',()=>{
 const o=state('m',27,5);Object.assign(o.self,{danger:false,weapon:'ID_ETC_SMG02_C',magazine:30,reserve:105});
 expect(canDefendRoom(o)).toBe(true);o.self.danger=true;expect(canDefendRoom(o)).toBe(false);
 o.self.danger=false;o.self.roomType=1;expect(canDefendRoom(o)).toBe(false);
 o.self.roomType=undefined;expect(canDefendRoom(o)).toBe(false);
 o.self.roomType=5;o.self.weapon='ID_ETC_StarterPistol_C';expect(canDefendRoom(o)).toBe(false);
});
