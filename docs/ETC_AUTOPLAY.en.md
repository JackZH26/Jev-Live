# ETC-specific autoplay: source analysis, implementation and acceptance

[简体中文](ETC_AUTOPLAY.md) · 2026-09-20

This phase targets offline Enter the Cube Playtest battle royale (5272970). The objective is a high full-match win rate approaching skilled human play. **Esports-level play and guaranteed wins are not established.** Autoplay does not require OBS, streaming accounts or broadcasting. The normal entry remains the Steam library.

## Source findings

ETC paths below are relative to its project root. Game source is not copied into the public JEV repository.

| Implementation | Existing behavior | Integration consequence |
| --- | --- | --- |
| `Private/AI/EtcBotController.cpp` | AIController, Sight/Damage perception, 3500 cm sight / 4000 cm loss range, 90° half-angle, inventory and team components | Do not replace the local player's controller with a BotController |
| `Private/AI/EtcBotBrainComponent.cpp` | Re-evaluates every 0.25 s; Wander/Loot/Transit/Fight/Evac/Hold; evacuation, loadout, ammo, pickups, cover scouting, navigation failures and stuck handling | Reuse rules and gameplay facilities through a separate player adapter |
| `Private/AI/EtcBotAimComponent.cpp` | Reaction timer, angular error, fire gate, direct rotation, Pro ADS | A difficulty named Pro does not establish professional human skill |
| `Private/AI/EtcBotDifficultySettings.cpp` | Regular: 280–420 ms reaction / 4.5° cone; Pro: 80–120 ms / 0.6° cone / 0.45° fire gate | Useful baseline opponents; never lower difficulty to inflate evaluation |
| `EtcBotPathfinder`, room state and map assembly | Room graph, collapse warnings, local navigation and portals; the existing bot can access the planned final safe room | Expose current public information, not future collapse schedules or concealed opponents |
| Hazard subsystem and room 015/016/019 APIs | Dynamic routing, waiting, crouch/jump/sprint and escape behavior | Static NavMesh alone cannot handle these rooms |
| QuickBar, consumables, chests | Real equipment, ammunition, healing casts, inventory caps and interactions | Use normal player rules without changing stats |
| Match result subsystem | Authoritative eliminations, placements and winner | Count official outcomes, not command acknowledgements |

Most ETC sources are under `Plugins/GameFeatures/EtcCore/Source/EtcCoreRuntime/`; Lyra QuickBar is under `Source/LyraGame/Equipment/`.

The previous JEV controller used Windows OCR text/menu coordinates, a 250 ms polling timer, default 800 ms decisions and 300 ms individual inputs. Local behavior was a fixed action sequence. It lacked enemy localization, ammo awareness, continuous aim, hazard state and official results. The old optional bridge observed every 200 ms and directly rotated toward targets, but was disconnected from the Steam workflow. Faster cloud requests alone cannot fix those limitations.

## Three control layers

1. **Native ETC execution, every frame:** observe visible opponents and drive the real player through ordinary weapon, healing, pickup, portal and hazard rules. Bound aiming speed and gate shooting.
2. **Local JEV policy, target 20 Hz:** select evacuation, cover, fighting, reloading, switching, healing, supplies and room rotation. Maintain goals briefly, remember visits and cool down stuck objectives.
3. **Optional cloud JEV advice, at least 800 ms apart:** use official SDK `systemOne` over current valid affordances. One outstanding request, 1200 ms timeout, no blocking of local control. A bounded preference cannot override evacuation or low-health safety. Cancel and discard stale epoch/match/action replies.

`electron/etc-autoplay.ts` has no OBS, OAuth or Broadcast dependency. Local play works with no streaming platforms or credentials. SteamObserver identifies the installed process/window and no longer injects gameplay input in this path. Other Steam games retain manual play and streaming; general-purpose autoplay is outside this phase.

## Implemented scope

- API v3 exposes own health, weapon/ammo, casting/protection/travel, current room and public danger; visible enemy position/velocity, without hidden enemy HP or wall tracking.
- Visibility filters view direction, occlusion, flash effects, protection, portal travel and team damage rules. The initial approximate cone is 100° total with a 70 m cap; calibration against the actual camera remains open.
- Aim follows Lyra `CameraTowardsFocus` from the real player camera rather than bot eye position. Aim, fire and limited strafing can run together. Initial limits: 150 ms acquisition, 360°/s turning, 0.8° fire gate and small stable error. These are engineering defaults, not a validated model of human motor behavior.
- Empty weapons switch or reload; low health seeks cover from known threats; healing is preferred without a visible threat and an ongoing safe cast is preserved.
- Public collapse/preview danger prioritizes an adjacent safe room. Sufficient supplies reduce chest looting. **Multi-room risk-optimal routing remains unimplemented.**
- Recompute navigation at most every 200 ms; reject missing/partial paths. Around 1.8 s without progress flags a stuck objective, cooled down for 5 s. Clear paths on portal/world changes.
- Reuse generic hazard directives plus train 015, rotor 016 and board 019 APIs, before combat. **Real player acceptance for every room remains open.**
- Normal player GAS, equipment, consumable casts, chest and portal entry points; no health, ammo, damage or movement-speed overrides. Initial local match starts with 19 bots; existing auto-restart setting controls subsequent matches.
- Show P95 command latency, wins/completed results and ammo. A visible UI or connected protocol is not full-match acceptance.

Missing or unvalidated: weapon-specific engagement range/ADS, projectile lead/drop, grenade tactics, audio memory, multi-room risk routing, online matches and sustained win-rate optimization. The current reaction/error settings do not establish human-like play.

## Protocol and stopping

The private mailbox is `%LOCALAPPDATA%/JevLive/etc-bridge`: `session.json`, `state.json`, `command.json`, all excluded from Git. Once the integration ships in ETC, normal Steam launch discovers the JEV session; ordinary users need no source project or editor.

- Random 256-bit token, 1 s heartbeat, 3 s session expiry, bound to the game PID identified inside the selected Steam installation. Editor/other test processes cannot claim the session.
- Target 50 ms observations; 128 KB read limit; schema, AppID, PID, session, clock and monotonic-frame validation. Reject observations older than 250 ms.
- Commands carry version/session/token/matchId/id/epoch/frame/expiry and may reference only recently offered actions. No console, script or arbitrary-target endpoint.
- 250 ms command lease. Reject duplicate IDs, old epochs/matches, stale frames and excessive leases. Focus loss, expired lease, disconnect and pawn/world changes release held inputs.
- Manual takeover increases epoch, cancels advice and serializes release after pending writes. Old async results cannot restore automatic mode. Ctrl+Alt+M remains available.
- Requested matches get at most 120 s through actual drop-in; positively observed portal travel gets at most 15 s. Native input still expires, with reauthorization only after the matching fresh destination state.
- Ordinary frame stalls pause commands for at most 1 s. Resuming requires fresh foreground telemetry from the same match and control epoch; timeout, identity mismatch and manual takeover stop control. A Windows file-replacement gap may reuse only an authenticated frame within its original 250 ms freshness limit.
- Only `NM_Standalone` is supported; network matches report unsupported.

The default mailbox is single-controller. Use `--isolated` for acceptance alongside another JEV instance: separate app data and control directory, with the installed game launched through Steam using its private directory argument. Close the Steam game before this test. The existing broadcasting instance is not modified.

## Acceptance

```powershell
npm run check
npm test
npm run build
# Probe the actual installed Steam game; no automatic match or stream
node scripts/smoke-autoplay.cjs
# After a compatible game build is installed: full matches, no OBS setup
node scripts/smoke-autoplay.cjs --run --matches 20
# When another JEV instance is running, close the Steam game first
node scripts/smoke-autoplay.cjs --run --isolated --matches 1
```

ETC developers install the source adapter with `integrations/etc/install.ps1 -Project <ETC-root>` and build through ETC's `Tools/Build.bat`. Native automation test `Project.ETC.Jev.PlayerMotor` covers reaction/turn limits, shortest rotation, frame hitches, occlusion/protection/empty-ammo fire gates and lease/epoch/frame validation. Code-level automation does not replace Steam match acceptance.

Reports go to `test-results/etc-autoplay/acceptance.json` with a whitelist of summary fields, no tokens/accounts/keys. Deduplicate official results; manual intervention or interrupted/missing results are not autonomous wins. Latency means **observation timestamp to completed command write**, not end-to-end hit latency. Ammo decreases estimate shots; they do not establish hit accuracy.

Retested on 2026-09-20: installed Steam candidate BuildID **25420188** successfully connects **API v3** and executes automatic match start and real player movement. The missing-interface result for old build 25364079 no longer applies. See the [latest acceptance record](ETC_AUTOPLAY_ACCEPTANCE.en.md) for completed matches, takeover checks and remaining limits.

## Win-rate benchmark

September 21 rematch fix: after an official result, the desktop asks SteamObserver to click the real recognized Return to Lobby button. Only after observing the lobby does it rearm native control and start the next match. Unconsumed clicks retry from fresh observations every 1.5 seconds; a 30-second return timeout stops control. Loading and room selection are separate from lobby dwell; the lobby has no artificial delay.

Focus loss pauses commands while retaining the user's automatic-mode intent, without stealing focus. Resumption requires the same process/session/match/epoch, a focus-loss or lease-expiry release, zero held inputs and at least 750 ms of fresh stable foreground observations. Explicit manual takeover, a paused game, identity changes and other release reasons still stop control. A match interrupted by focus loss does not count as a complete automatic win.

An explicit Auto request made while the game is already in the background waits for stable foreground observations before obtaining a native control lease. No gameplay input is sent while waiting. The request binds the original session, process, match, epoch and acknowledgment; subsequent manual takeover or identity changes cancel it. Background pauses do not consume lobby-return or loading timeouts.

First validate the complete path in a compatible Steam candidate: menu → drop → equipment → combat → portals → evacuation → official result → lobby → restart, plus focus loss, manual takeover and controller disconnect. Normal user acceptance must use a genuine Steam installation/launch.

Compare local-only and local+JEV on the same game version, bot count/difficulty, recording map seeds. Separate tuning seeds from held-out evaluation. Begin with 20 functional runs, then at least 100 held-out matches. Report win rate, placement distribution, kills, survival duration, hazard deaths, stuck time, observation/command latency, cloud latency and input release. Keep failed matches and never count early exits as wins.

Proposed gates, **not yet achieved**: P95 command latency ≤100 ms under normal load; disconnected input release ≤300 ms subject to game-frame scheduling; ≥90% wins across 100 matches against 19 Regular bots, then progress to Expert/Pro. A finite 100% sample cannot guarantee every future win.

Optimize measured failure causes in order: collapse/hazards/stuck navigation, equipment and shot accuracy, then tactics. Never improve reported numbers by lowering opposition, changing damage, using hidden state or excluding failures.
