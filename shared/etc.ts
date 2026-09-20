import { z } from 'zod';

export const ETC_APP_ID = '5272970';
export const ETC_PROTOCOL = 3;
export const ETC_MAX_AGE_MS = 250;
export const ETC_LEASE_MS = 250;
const finite = z.number().finite();
const vector = z.tuple([finite, finite, finite]);
export const etcActionSchema = z.object({
  id: z.string().min(1).max(160),
  kind: z.enum(['wait','scan','engage','cover','loot','pickup','portal','reload','heal','equip','new_match','inspect_map']),
  distance: finite.nonnegative(), target: z.string().max(160).optional(),
  safe: z.boolean(), destination: z.number().int().optional(), rank: finite.optional(),
  destinationRisk:z.number().int().min(0).max(4).optional(),
});
export const etcObservationSchema = z.object({
  version: z.literal(ETC_PROTOCOL), appId: z.literal(ETC_APP_ID),
  session: z.string().min(1).max(80), matchId: z.string().max(100),
  timestamp: finite, frame: z.number().int().nonnegative(), processId: z.number().int().positive(),
  phase: z.enum(['menu','loading','playing','dead','ended','paused','unsupported']),
  mode: z.enum(['manual','auto']), epoch: z.number().int().nonnegative(), ack: z.number().int().nonnegative(),
  foreground: z.boolean(), map: z.string().max(200),
  zone:z.object({phase:z.number().int().nonnegative(),stage:z.enum(['warning','collapse','complete']),secondsLeft:finite.min(-1)}).optional(),
  mapView:z.object({open:z.boolean(),revision:z.number().int().nonnegative(),observedAt:finite,
    phase:z.number().int().nonnegative(),stage:z.enum(['warning','collapse','complete']),
    rooms:z.array(z.object({id:z.number().int(),number:z.number().int(),x:finite,y:finite,w:finite.positive(),h:finite.positive(),risk:z.number().int().min(0).max(4),visited:z.boolean()})).max(128),
    edges:z.array(z.tuple([z.number().int(),z.number().int()])).max(512),
  }).optional(),
  self: z.object({position:vector, health:finite.nonnegative(), maxHealth:finite.positive(),
    magazine:z.number().int().min(-1), reserve:z.number().int().min(-1), weapon:z.string().max(160),
    protected:z.boolean(), traveling:z.boolean(), healing:z.boolean(), room:z.number().int(),roomType:z.number().int().min(1).max(98).optional(),
    danger:z.boolean(), evacuationSeconds:finite, kills:z.number().int().nonnegative(),grounded:z.boolean().optional()}),
  enemies: z.array(z.object({id:z.string().max(160),position:vector,velocity:vector,distance:finite.nonnegative()})).max(32),
  actions: z.array(etcActionSchema).max(128),
  result: z.object({placement:z.number().int().min(1),won:z.boolean()}).refine(r=>r.won===(r.placement===1)).nullable(),
  diagnostics:z.object({heldInputs:z.number().int().nonnegative(),shots:z.number().int().nonnegative(),
    stuck:z.boolean(),observationMs:finite.nonnegative(),lastAction:z.string().max(160)}),
  executor:z.object({
    kind:z.literal('shared-bot-v1'), objective:z.string().max(160),
    status:z.enum(['running','succeeded','blocked','paused','released']),
    reason:z.string().max(80), failures:z.number().int().nonnegative(),
    pathStatus:z.number().int().min(0).max(3),
  }).optional(),
});
export type EtcObservation = z.infer<typeof etcObservationSchema>;
export type EtcAction = z.infer<typeof etcActionSchema>;
export interface EtcCommand {version:3;session:string;matchId:string;token:string;id:number;epoch:number;mode:'auto'|'manual';frame:number;expiresAt:number;action:string}
export interface EtcSummary {
  connected:boolean; protocol:number; frames:number; decisions:number; lastLatencyMs:number;
  p95LatencyMs:number; matches:number; wins:number; losses:number; interrupted:number;
  lastPlacement:number|null; shots:number; kills:number; room:number; health:number;
  magazine:number; reserve:number; strategy:string;
}
