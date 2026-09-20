// Strictly project game telemetry. Never forward bridge sessions, paths or tokens.
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined).map(k=>[k,o[k]]));
function project(o,live,meta){const calls=live?.cloudCalls||[],last=calls.findLast(c=>c.ok);
 return {updatedAt:o.timestamp,candidate:meta.candidate,phase:o.phase,game:'Enter the Cube Playtest',
  self:pick(o.self,['position','health','maxHealth','magazine','reserve','weapon','protected','traveling','healing','room','roomType','danger','kills']),
  zone:pick(o.zone,['phase','stage','secondsLeft']),
  mapView:o.mapView?{...pick(o.mapView,['open','revision','observedAt','phase','stage']),rooms:(o.mapView.rooms||[]).map(r=>pick(r,['id','number','x','y','w','h','risk','visited'])),edges:(o.mapView.edges||[]).filter(e=>Array.isArray(e)&&e.length===2&&e.every(Number.isInteger))}:null,
  navigation:pick(live?.samples?.at(-1)?.navigation,['revision','reason','lastReviewReason','target','route','estimatedSeconds']),
  knowledge:pick(live?.samples?.at(-1)?.knowledge?.currentRoom,['id','name','rules','crossingEstimateSeconds']),
  executor:pick(o.executor,['objective','status','reason','failures','pathStatus']),
  actions:(o.actions||[]).map(a=>pick(a,['id','kind','distance','safe','destination','destinationRisk','rank'])),
  enemies:(o.enemies||[]).map(e=>pick(e,['id','position','distance'])),
  cloud:{candidate:last?.action||'',lastMs:calls.at(-1)?.ms??null,requests:live?.cloudStats?.jevRequests||0,responses:live?.cloudStats?.jevResponses||0,latencies:calls.map(c=>c.ms).filter(Number.isFinite)},
  metrics:{...pick(live?.summary,['frames','decisions','matches','wins','losses','lastPlacement','p95LatencyMs']),shots:o.diagnostics?.shots||0},trial:meta.trial};
}
module.exports={project};
