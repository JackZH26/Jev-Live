# ETC local game bridge

[简体中文](README.md) · [English](README.en.md)

**Optional developer integration example only.** The studio adds/selects games from Steam and launches them through Steam. Streamers do not need source code, an editor or this bridge. This directory preserves research prototype code; the current desktop controller observes game windows and sends bounded input instead of launching a development project.

An optional integration for the Enter the Cube development project, using existing EtcCoreRuntime / Lyra interfaces. No game content or Unreal source is included.

`install.ps1 -Project <project directory>` copies the two `EtcJevBridge` files into `Private/Development` and adds one hook to module startup and shutdown. Only these three integration locations change; maps are untouched. Close the editor and build through the project's `Tools/Build.bat`.

The studio resolves the engine through `Tools/Engine.bat`, then launches a standalone game with `-game -JevBridgeDir=<user data directory>`. Network matches do not expose control.

Protocol v1 uses local JSON mailboxes, all excluded from Git:

- `session.json`: session ID and random authentication token.
- `state.json`: observations, position, health, phase, candidate actions and acknowledgements, updated approximately every 200 ms.
- `command.json`: sequence number, epoch, mode, expiry, an action chosen from candidates and authentication information.

Manual handover increases the epoch, cancels JEV requests and releases automatic input. Old epochs, duplicate sequence numbers, expired commands, wrong sessions and non-candidate actions are rejected. Individual actions last at most 1.8 seconds; a missing controller cannot hold movement or firing indefinitely. Expected map transitions suspend decisions until fresh observations return.

Actions include observing, navigation, turning, approaching/opening supply chests, entering revealed portals, shooting visible opponents, reloading, jumping and starting a local bot match. Enemy observations use field-of-view and line-of-sight checks.

Limits: basic tactics; not yet complete for hazardous-room avoidance, post-loot weapon optimization, win-rate benchmarks, online multiplayer or injection into Steam releases. JEV uses the official SDK and abandons timed-out decisions. The keyless local policy provides baseline validation, not a substitute for JEV quality evaluation.
