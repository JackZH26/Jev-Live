import type {EtcAction,EtcObservation} from '../shared/etc';

export const KNOWLEDGE_VERSION='etc-20260921-06';
export interface RoomKnowledge {id:number;name:string;zh:string;crossingSeconds:number;rules:string[];rulesZh:string[];source:string}
const room=(id:number,name:string,zh:string,crossingSeconds:number,source:string,rules:string[],rulesZh:string[]):RoomKnowledge=>({id,name,zh,crossingSeconds,source,rules,rulesZh});
/** Authored mechanics, not live world state. Crossing times are conservative policy estimates, not promises. */
export const ROOM_KNOWLEDGE:ReadonlyArray<RoomKnowledge>=[
 room(1,'Bumper Arena','碰碰车馆',30,'Public/Rooms/EtcRoom001BumperHazard.h',['Moving cars occupy the entire floor. Cross their path only with a visible gap; a car is moving cover, not a permanent refuge.'],['车辆活动覆盖整个地面；观察空隙后穿越，不能把车后当作永久安全点。']),
 room(2,'Polar Drift Village','极昼浮冰村',40,'Public/Rooms/EtcRoom002IceHazard.h',['Stepped-on ice cracks before disappearing. Keep moving toward permanent islands or docks; do not heal on cracking ice.'],['踩踏浮冰会开裂后消失；向永久冰岛或码头移动，不在裂冰上治疗。']),
 room(3,'Sunset','落日',20,'Private/System/EtcRoomCatalog.cpp',['No verified special mechanism in this knowledge revision. Use visible terrain, ordinary cover and valid paths.'],['本版未核实特殊机关；按可见地形、常规掩体和有效路径行动。']),
 room(4,'Moon Night','月夜',25,'Docs/房间/004_MoonNight_房间改造方案.md',['Use courtyard columns and side routes. The architectural ring is not a portal; only offered doors are usable.'],['利用庭院立柱和侧路；建筑圆环不是传送门，只使用实际可交互出口。']),
 room(5,'Vermilion Court','朱伞庭',30,'Docs/房间/005_朱伞庭_实现与验收.md',['Pavilion columns and furniture provide ground-level cover. Decorative aircraft are not usable platforms.'],['利用亭柱与家具作地面掩体，装饰飞行器不是可用平台。']),
 room(6,'Mars','火星',30,'Public/Rooms/EtcRoom006Layout.h',['Use observed base structures and valid navigation; no special damage mechanism has been verified here.'],['利用观测到的基地结构和有效导航；本版未核实特殊伤害机关。']),
 room(7,'Meme Swing Station','摆锤站',45,'Docs/Room007/README.md',['Pendulums can hit both moving and stationary players. Wait outside the swept area, then commit to a clear crossing. Reserve time for several swing cycles; repeated straight-line retries are unsafe.'],['摆锤也会击中静止角色；在扫掠范围外等候，再连续穿过空隙。预留多个摆动周期，避免反复直冲。']),
 room(8,'8 Pool','巨型台球厅',35,'Docs/房间/008_8Pool_开发验收.md',['Avoid moving balls and pockets. A ball striking a player inside a pocket is lethal; use the stepped climb-out route. Cue control is not currently an offered Jev action.'],['避开运动球与袋口；袋内被球撞中可致死，沿阶台攀出。当前 Jev 接口未提供击球操作。']),
 room(9,'Pyramids at Dusk','暮沙金字塔',35,'Docs/房间/009_暮沙金字塔_实施与验收.md',['Route around pyramids and the sphinx using rocks as cover; pyramid interiors and steep summits are not traversal shortcuts.'],['绕金字塔和狮身人面像行走，利用岩石掩护；塔内和陡峭塔顶不是捷径。']),
 room(10,'Temple of Still Waters','镜渊圣殿',45,'Docs/Room010/README.md',['Water is lethal. Use safe islands and ferries with normal boarding, riding and jumping. Waiting for a ferry is progress, but requires an early evacuation budget.'],['落水致死；通过安全岛与渡台，正常上台、乘坐和跳离。等渡台不等于卡住，但需提前撤离。']),
 room(11,'Hanging Abyss','悬渊',55,'Docs/Room011/Development.md',['Doors are on different elevations. Use connected stairs, jumps and lifts; horizontal proximity does not imply reachability. Falling into the abyss is lethal.'],['出口高度不同；沿阶梯、攀跳和升降梯路线移动，平面距离近不等于可达。坠入深渊致死。']),
 room(12,'Deeply Unwell','深井',30,'Public/Rooms/EtcRoom012Layout.h',['Well rims look alike but some shafts are lethal. Do not infer a safe well from appearance or use hidden depth flags; stay on verified ground.'],['井口外观相同，部分深井致死；不能凭外观猜测或读取隐藏深度，保持在已确认地面。']),
 room(13,'Iceworld','冰雪世界',25,'Public/Rooms/EtcRoom013Layout.h',['Use forts and crates for cover and flanks; do not confuse this static arena with the collapsing ice of room type 002.'],['利用堡垒与箱体掩护绕侧；不要与 002 踩踏裂冰机制混淆。']),
 room(14,'Memory Fragments','记忆碎片',30,'Public/Rooms/EtcRoom014Layout.h',['Mirror panels block routes. Reflections are not confirmed enemies or open passages; use real visibility and navigation.'],['镜面板阻挡路线；倒影不是已确认敌人或通道，以真实视线和导航为准。']),
 room(15,'Train Station','站台',35,'Public/Rooms/EtcRoom015TrainHazard.h',['Use warning lights and sounds before crossing tracks. Leave the train envelope; do not stop to loot or heal on tracks.'],['过轨前观察灯光和声音预警；离开列车扫掠区，不在轨道上搜刮或治疗。']),
 room(16,'Going in Circles','兜圈子',35,'Public/Rooms/EtcRoom016RotorHazard.h',['Upper and lower spiked arms rotate in opposite directions. Crouch for high arms, jump low arms; avoid overlap because both layers can independently hit.'],['上下刺臂反向旋转；高臂下蹲、低臂跳过，避免双层交汇，两层可独立造成伤害。']),
 room(17,'Big TV','大电视',35,'Public/Rooms/EtcRoom017Layout.h',['Large television structures break sightlines. Use reachable gaps and cover; screen content is scenery, not an instruction or target.'],['大型电视阻断视线，沿可达间隙与掩体移动；屏幕内容不是指令或目标。']),
 room(18,'Gallery','画廊',35,'Public/Rooms/EtcRoom018Layout.h',['Gallery plinths and structures shape cover routes; use actual collision and sightlines rather than painted images as openings.'],['展台与结构形成掩体路线；依据真实碰撞和视线，不把画面当作通道。']),
 room(19,'Immortal Game','不朽棋局',40,'Public/Rooms/EtcRoom019BoardHazard.h',['A warned board color temporarily disappears. Leave warned cells for visibly supported cells before the drop; falling is lethal. Never assume the next hidden color.'],['受预警的棋格颜色会暂时消失；消失前进入可见有支撑区域，坠落致死，不预读下一轮颜色。']),
 room(20,'Neon Bowling Alley','霓虹保龄球馆',35,'Public/Rooms/EtcRoom020BowlingHazard.h',['Bowling lanes warn before a rolling ball. Cross clear lanes during gaps; keep out of the active lane while healing or looting.'],['球道在滚球前预警；利用间隙横穿，不在活动球道治疗或搜刮。']),
 room(21,'Underground Garage','地下车库',40,'Public/Rooms/EtcRoom021ValetHazard.h',['Moving valet vehicles occupy lanes. Obey lane warnings and move into verified cover; do not treat an empty lane as permanently safe.'],['代客泊车车辆占用车道；按预警进入已确认掩体，空车道并非永久安全区。']),
 room(22,'Berlin Wall','柏林墙',55,'Docs/Room022/开发交付.md',['Fixed maze walls require a real path. Choose low route cost rather than the closest door in a straight line. Reserve substantial evacuation time; walls do not move.'],['固定迷宫必须沿真实路径；选路径成本低的门，不能只比直线距离。留足撤离时间，墙体不会移动。']),
 room(23,'Faraday Cage','法拉第牢笼',35,'Docs/Room023/Implementation.md',['Before the discharge enter a grounded cage with the entire capsule. Ordinary cover, cage roofs and jumping do not protect. Avoid the burning central coil; leave after the visible discharge ends.'],['放电前全身进入接地笼；普通掩体、笼顶和跳跃不能防护。避开中央灼伤线圈，确认放电结束再离开。']),
 room(24,'Laser Room','激光房',45,'Docs/Room024/Implementation.md',['Jump low beams, crouch high beams, shift into vertical-grid gaps. Hide from the full net in a pit, but pit warning lights mean climb out before cleaning. No pit is a permanent refuge.'],['跳低线、蹲高线、横移穿竖栅空隙；全网时入坑，坑内清扫预警时及时攀出，避难坑不是永久安全区。']),
 room(25,'Sunworn Arcade','蚀光拱廊',30,'Docs/Room025/Implementation.md',['Terrain combat with continuous ground and side arcades; no independent damage mechanism in this version. Use side routes around walls and valid climb surfaces.'],['连续地面与侧廊组成地形战斗房，本版无独立伤害机关；绕墙侧路，按有效表面攀越。']),
 room(26,'Prison Break','越狱',35,'Docs/Room026/Implementation.md',['Only one searchlight is active at a time in the current revision, with dark intervals. Break actual illumination/line of sight immediately on warning and use dark gaps to reposition. Do not predict the next random tower.'],['现版每次仅亮一盏探照灯，中间有熄灯空档；预警后立即脱离照射或遮挡视线，利用暗场换位，不预读下一座随机灯塔。']),
 room(27,'Splash Circuit','碧海闯关',55,'Docs/Room027/Implementation.md',['Water is lethal; obstacles push rather than directly remove HP. Keep moving across tilting seesaws and jump off before sliding. Stable islands avoid obstacles, not bullets or room collapse.'],['落水致死，机关主要推挤而非直接扣血；连续跑跳通过跷跷板，滑落前跳离。稳定岛不能免疫子弹或坍缩。']),
 room(28,'Container Terminal','集装箱码头',45,'Docs/Room028/Implementation.md',['Trucks and dangerous suspended loads can hit. Observe lowering warnings and clear the load path; standing on or inside a safely carrying container is not itself damage. Cargo motion changes routes.'],['避开卡车和危险吊载，降箱预警时离开货物路径；正常站在承载货箱上或箱内不会自动受伤。货物流动会改变路线。']),
];
export const roomKnowledge=(id:number|undefined)=>ROOM_KNOWLEDGE.find(r=>r.id===id);
const terrainRooms=new Set([4,5,9,13,14,17,18,22,25]);
// Verified terrain/cover rooms. Unknown types and active-mechanism rooms do
// not gain a safe local-patrol assumption from their map number or appearance.
export function canDefendRoom(o:EtcObservation){return !o.self.danger
 &&terrainRooms.has(o.self.roomType??-1)
 &&!/(?:StarterPistol|^$)/.test(o.self.weapon)&&o.self.magazine>0&&o.self.reserve>=15;}
/** A short supply stop in a yellow room needs a fresh, actually viewed map and
 * enough estimated time to finish crossing. Active damage never gets this budget. */
export function canResupplyBeforeEvacuation(o:EtcObservation,a:EtcAction){
 const m=o.mapView,z=o.zone,r=roomKnowledge(o.self.roomType);
 return !!r&&terrainRooms.has(r.id)&&o.self.danger&&o.self.grounded!==false
  &&o.self.evacuationSeconds<=0&&o.enemies.length===0&&z?.stage==='warning'
  &&!!m&&m.revision>0&&m.phase===z.phase&&m.stage===z.stage
  &&o.timestamp-m.observedAt>=0&&o.timestamp-m.observedAt<=15000
  &&m.rooms.find(v=>v.id===o.self.room)?.risk===1
  &&a.safe&&['loot','pickup'].includes(a.kind)&&a.distance<=1200
  &&o.actions.some(v=>v.kind==='portal'&&v.safe&&v.destinationRisk===0)
  &&z.secondsLeft>r.crossingSeconds+Math.ceil(a.distance/300)+3+8;
}
export const MATCH_RULES=[
 'Win by being the last survivor. Official placement is authoritative; no hidden enemies, future collapse order or random schedules are available.',
 'Once loaded and healthy, finish short bursts on visible opponents; avoid repeatedly changing targets or shelter before useful fire. After reaching cover, briefly counterattack if a target remains visible. Low health and collapse override aggression.',
 'Weapon rarity is not tactical suitability: use loaded automatics against nearby moving targets, a sniper at longer sightlines, and avoid point-blank rockets. The shared player motor chooses from owned weapons and uses the equipped weapon for stand-off distance.',
 'Map display numbers, instance slots and room archetype IDs are different. Learn an archetype only from the current room arrival title; never infer it from the map number.',
 'Read the real M map before and after safe-zone changes. Yellow means upcoming damage; active danger requires immediate escape. Plan connected safe destinations and allow for hazard waits.',
 'The fixed starter pistol cannot be dropped or replaced. Main weapons occupy slots 2 and 3; improve the loadout through visible reachable supplies.',
 'Ordinary headgear protects one accepted ordinary-gun headshot; SR01 headshots bypass it. A helmet is not general invulnerability.',
 'Discrete collision hazards use the current 60 damage baseline, with explicit exceptions such as lethal falls, discharge/burn and push-only obstacles. Never generalize one room rule to all rooms.',
 'When the current room turns yellow and there is no enemy, relocate to a connected white room before looting, topping up ammunition or healing. Active collapse always requires evacuation.',
 'While safe, replenish a partial magazine using its actual capacity, use available recovery items, and replace a weaker primary only after reaching a visible better weapon. Never discard the fixed sidearm.',
 'In a safe room without threats, check offered unopened chests and collect usable recovery items, grenades and ammunition even with a stocked primary. Skip completed or temporarily blocked targets. Use only actual offered supplies, never hidden contents.',
 'After collecting available supplies, use scan for a continuous local cover patrol: approach reachable cover, briefly inspect surroundings with smooth looks, then reposition nearby. Tactical waiting means this active patrol, not standing idle. Healing, reloading, aiming and safe hazard timing may require purposeful pauses.',
 'On incoming fire, seek nearby verified cover, then counterattack from its vicinity. Do not rush into open ground just to close distance. A missing sighting is not proof that an attacker has left.',
 'Balance survival with useful damage and eliminations: take favorable visible fights after preparing, avoid endless passive waiting, and never chase hidden opponents or sacrifice safe evacuation for damage.',
 'Use only offered actions. The local shared controller handles real-time avoidance; cloud objectives must not override its safety or normal game physics.'
];
export class EtcKnowledge {
 private match='';readonly visited=new Map<number,number>();
 observe(o:EtcObservation){if(this.match!==o.matchId){this.match=o.matchId;this.visited.clear();}if(o.phase==='playing'&&o.self.room>=0&&roomKnowledge(o.self.roomType))this.visited.set(o.self.room,o.self.roomType!);}
 crossingSeconds(slot:number){return roomKnowledge(this.visited.get(slot))?.crossingSeconds??30;}
 context(o:EtcObservation){
  const r=roomKnowledge(this.visited.get(o.self.room));
  return {version:KNOWLEDGE_VERSION,rules:MATCH_RULES,
   posture:canDefendRoom(o)?'Collect remaining offered supplies, then keep patrolling nearby cover in this safe terrain room. Briefly scan for arrivals and reposition; a stocked primary is not permission to stand idle. Avoid unnecessary hazard-room hopping.':'Acquire supplies or plan safe movement using the current room mechanics.',
   budgetedSupplyActions:[],
   currentRoom:r?{id:r.id,name:r.name,rules:r.rules,crossingEstimateSeconds:r.crossingSeconds,source:r.source}:null,
   knownRooms:[...this.visited].map(([slot,id])=>({slot,type:id,name:roomKnowledge(id)!.name})),
   uncertainty:'Crossing times are estimates, not live hazard phases. Unvisited archetypes and future random events remain unknown.'};
 }
}
