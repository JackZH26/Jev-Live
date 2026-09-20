# ETC gameplay knowledge and map planning

[中文](ROOM_KNOWLEDGE.md) · Knowledge version: etc-20260921-03

Current UE room catalog, implementation records and source code take precedence over older design proposals. The referenced legacy Godot GDD was unavailable locally; it is not silently treated as current. These are short authored summaries, not copies of the original design documents.

Only the current room arrival title identifies its archetype. Map display numbers and instance slots are not archetype IDs. The cloud receives global rules, the current room and already visited room identities; unknown future rooms and hidden random schedules stay unknown. A real M-map opening produces the room graph snapshot. Closing M freezes it until the next review.

Local control requests a review initially, before the countdown refresh (at least the estimated crossing time plus 8 seconds), after a phase change and after repeated route failures. Combat, recent damage and last-second evacuation defer the overlay. The cloud selects a safe target and an immediate tactical action; the shared controller still handles real-time traversal and hazards. Replies from another room, map revision or phase cannot change the route.

Knowledge also decides whether relocation is worthwhile. In confirmed terrain/cover types 004/005/009/013/014/017/018/022/025, a safe room and stocked primary weapon enable defensive holding and temporarily exclude aimless portal travel. Enemy sightings, damage and room warnings remain monitored; danger immediately restores evacuation. Unknown types and active-mechanism rooms receive no assumption that standing still is safe. This avoids unnecessary exposure after resupply; it grants no immunity to gunfire or collapse.

Traversal budgets below are initial conservative policy estimates, not measured guaranteed times. Unvisited rooms use a 30-second estimate. Yellow transit rooms are rejected when arrival plus crossing plus an 8-second buffer would miss the warning deadline. Safe destinations prefer short paths and multiple safe exits; no future collapse order is used.

A starter-pistol or ammunition-depleted player may make a brief supply attempt in a verified terrain room only when an actual map snapshot is at most 15 seconds old and matches the phase, the current room is only yellow, a safe exit exists, supplies are within 12 metres and the countdown covers collection, estimated crossing and an 8-second margin. Enemies, recent damage, an active evacuation timer, hazard rooms or stale maps disable this exception. Eligible supply actions are also sent to Jev; they do not permit prolonged defense in a warned room. Newly established defensive conditions cancel an older optional portal objective immediately.

Confirmed corrections: collision damage is currently 60, replacing historical 75/100 examples; room 026 now rotates a single spotlight, replacing the initial four-light design; 027 obstacles push while water is lethal. Older TEST labels do not override the current formal 001–028 catalog. Room 003 special mechanics have not been verified; that uncertainty remains explicit.

| Type | Name | Crossing budget (s) | Decision context | Source in game project |
|---|---|---:|---|---|
| 001 | Bumper Arena | 30 | Moving cars occupy the entire floor. Cross their path only with a visible gap; a car is moving cover, not a permanent refuge. | Public/Rooms/EtcRoom001BumperHazard.h |
| 002 | Polar Drift Village | 40 | Stepped-on ice cracks before disappearing. Keep moving toward permanent islands or docks; do not heal on cracking ice. | Public/Rooms/EtcRoom002IceHazard.h |
| 003 | Sunset | 20 | No verified special mechanism in this knowledge revision. Use visible terrain, ordinary cover and valid paths. | Private/System/EtcRoomCatalog.cpp |
| 004 | Moon Night | 25 | Use courtyard columns and side routes. The architectural ring is not a portal; only offered doors are usable. | Docs/房间/004_MoonNight_房间改造方案.md |
| 005 | Vermilion Court | 30 | Pavilion columns and furniture provide ground-level cover. Decorative aircraft are not usable platforms. | Docs/房间/005_朱伞庭_实现与验收.md |
| 006 | Mars | 30 | Use observed base structures and valid navigation; no special damage mechanism has been verified here. | Public/Rooms/EtcRoom006Layout.h |
| 007 | Meme Swing Station | 45 | Pendulums can hit both moving and stationary players. Wait outside the swept area, then commit to a clear crossing. Reserve time for several swing cycles; repeated straight-line retries are unsafe. | Docs/Room007/README.md |
| 008 | 8 Pool | 35 | Avoid moving balls and pockets. A ball striking a player inside a pocket is lethal; use the stepped climb-out route. Cue control is not currently an offered Jev action. | Docs/房间/008_8Pool_开发验收.md |
| 009 | Pyramids at Dusk | 35 | Route around pyramids and the sphinx using rocks as cover; pyramid interiors and steep summits are not traversal shortcuts. | Docs/房间/009_暮沙金字塔_实施与验收.md |
| 010 | Temple of Still Waters | 45 | Water is lethal. Use safe islands and ferries with normal boarding, riding and jumping. Waiting for a ferry is progress, but requires an early evacuation budget. | Docs/Room010/README.md |
| 011 | Hanging Abyss | 55 | Doors are on different elevations. Use connected stairs, jumps and lifts; horizontal proximity does not imply reachability. Falling into the abyss is lethal. | Docs/Room011/Development.md |
| 012 | Deeply Unwell | 30 | Well rims look alike but some shafts are lethal. Do not infer a safe well from appearance or use hidden depth flags; stay on verified ground. | Public/Rooms/EtcRoom012Layout.h |
| 013 | Iceworld | 25 | Use forts and crates for cover and flanks; do not confuse this static arena with the collapsing ice of room type 002. | Public/Rooms/EtcRoom013Layout.h |
| 014 | Memory Fragments | 30 | Mirror panels block routes. Reflections are not confirmed enemies or open passages; use real visibility and navigation. | Public/Rooms/EtcRoom014Layout.h |
| 015 | Train Station | 35 | Use warning lights and sounds before crossing tracks. Leave the train envelope; do not stop to loot or heal on tracks. | Public/Rooms/EtcRoom015TrainHazard.h |
| 016 | Going in Circles | 35 | Upper and lower spiked arms rotate in opposite directions. Crouch for high arms, jump low arms; avoid overlap because both layers can independently hit. | Public/Rooms/EtcRoom016RotorHazard.h |
| 017 | Big TV | 35 | Large television structures break sightlines. Use reachable gaps and cover; screen content is scenery, not an instruction or target. | Public/Rooms/EtcRoom017Layout.h |
| 018 | Gallery | 35 | Gallery plinths and structures shape cover routes; use actual collision and sightlines rather than painted images as openings. | Public/Rooms/EtcRoom018Layout.h |
| 019 | Immortal Game | 40 | A warned board color temporarily disappears. Leave warned cells for visibly supported cells before the drop; falling is lethal. Never assume the next hidden color. | Public/Rooms/EtcRoom019BoardHazard.h |
| 020 | Neon Bowling Alley | 35 | Bowling lanes warn before a rolling ball. Cross clear lanes during gaps; keep out of the active lane while healing or looting. | Public/Rooms/EtcRoom020BowlingHazard.h |
| 021 | Underground Garage | 40 | Moving valet vehicles occupy lanes. Obey lane warnings and move into verified cover; do not treat an empty lane as permanently safe. | Public/Rooms/EtcRoom021ValetHazard.h |
| 022 | Berlin Wall | 55 | Fixed maze walls require a real path. Choose low route cost rather than the closest door in a straight line. Reserve substantial evacuation time; walls do not move. | Docs/Room022/开发交付.md |
| 023 | Faraday Cage | 35 | Before the discharge enter a grounded cage with the entire capsule. Ordinary cover, cage roofs and jumping do not protect. Avoid the burning central coil; leave after the visible discharge ends. | Docs/Room023/Implementation.md |
| 024 | Laser Room | 45 | Jump low beams, crouch high beams, shift into vertical-grid gaps. Hide from the full net in a pit, but pit warning lights mean climb out before cleaning. No pit is a permanent refuge. | Docs/Room024/Implementation.md |
| 025 | Sunworn Arcade | 30 | Terrain combat with continuous ground and side arcades; no independent damage mechanism in this version. Use side routes around walls and valid climb surfaces. | Docs/Room025/Implementation.md |
| 026 | Prison Break | 35 | Only one searchlight is active at a time in the current revision, with dark intervals. Break actual illumination/line of sight immediately on warning and use dark gaps to reposition. Do not predict the next random tower. | Docs/Room026/Implementation.md |
| 027 | Splash Circuit | 55 | Water is lethal; obstacles push rather than directly remove HP. Keep moving across tilting seesaws and jump off before sliding. Stable islands avoid obstacles, not bullets or room collapse. | Docs/Room027/Implementation.md |
| 028 | Container Terminal | 45 | Trucks and dangerous suspended loads can hit. Observe lowering warnings and clear the load path; standing on or inside a safely carrying container is not itself damage. Cargo motion changes routes. | Docs/Room028/Implementation.md |

Validation separates software checks from live match evidence. Unit tests cover knowledge boundaries, pre/post-refresh review, countdown-aware routing and stale reply rejection. A local packaged match must additionally prove actual M openings, observed snapshots, cloud requests containing the correct room context, official placement and released inputs. Passing these does not imply two consecutive wins or a Steam release.
