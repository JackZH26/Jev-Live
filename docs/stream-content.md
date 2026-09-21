# Enter the Cube stream content

The host keeps the original English Melo voice. For the selected Steam game
5030940 or Playtest 5272970, it rotates short introductions across six topics
(two variations each) and four wishlist reminders. Defaults: at least 180 seconds
between introductions and 600 seconds between wishlist reminders. Both can be
disabled in the host panel. Viewer replies take priority. Other games do not use
this material.

An introduction needs 20 quiet seconds. During gameplay, fresh game telemetry
must show no visible enemies, damage, shots, dangerous room, healing, reloading
or portal travel. Missing telemetry defers introductions. A new threat cancels
an introduction still being synthesized or played. General commentary remains
independent; these scripts describe rules, not invented current events.

Connected YouTube/Twitch questions get the same curated reference, matched to
their topic, with unknown release dates and prices explicitly left unknown.
All replies remain English, including questions written in another language.

The host panel has a copyable public-stream message with the **main store**:
https://store.steampowered.com/app/5030940/. After a public stream starts, paste
and pin it in the platform chat. This is a prepared message, not a confirmation
of a platform pin. Current X integration is RTMP only: no automatic chat reading,
posting or pinning. Private rehearsals never auto-post promotional messages.

## Source and scope (2026-09-21)

- The original Godot GDD path recorded by the game project was unavailable.
  Used the maintained GDD-derived design instead:
  `Docs/玩法循环/核心玩法循环移植设计.md` in the ETC project, covering
  GDD v3.4 sections 3, 4.6, 6 and 7.4, with later UE project constraints.
- The official English Steam store description confirms third-person battle
  royale, collapsing cube, looting, portals, trains, pool tables and chessboards.
- Curated topics: core loop, collapse, portals, authored room interiors with
  changing connections, room variety, and the special sniper room broadcast.
- Omitted numerical player/room counts, damage/timing values and new design
  proposals that may differ from the installed candidate. Room themes are not
  claims about the room currently on screen.

## Game audio

Explicit capture selection and stream start restore the owned ETC Audio source:
scene enabled, unmuted, stream track 1 enabled and monitoring disabled. Other
track assignments and the game/voice gain balance are preserved. Normal polling
does not force unmute. The game itself must allow background audio if another
window is used during streaming.
