# JEV Studio: early research and design delivery (before development)

[简体中文](design-delivery-2026-09-20.md) · [English](design-delivery-2026-09-20.en.md)

Research date: 2026-09-20. This is an archival concept-stage record. See [current acceptance](../docs/PHASE1_STATUS.en.md) for subsequent development.

The design defines autoplay and manual play. Both automatically provide commentary, voice answers and text replies; only game operation changes between AI and user. Text sending depends on platform permissions. Switching during a stream preserves interaction.

- [Full research and design](../docs/DESIGN.en.md): open-source comparison, JEV boundaries, product flow, game adaptation, OBS outputs, platform permissions, interaction, recovery, cost and acceptance.
- [Interactive UI prototype](../prototype/index.html): open in a browser, choose either mode and switch during a simulated stream; switch platforms, drag/resize avatar and chat, adjust opacity, switch landscape/portrait and export layout JSON.
- [Autoplay preview](../prototype/preview-desktop.png), [manual preview](../prototype/preview-manual.png) and [portrait preview](../prototype/preview-portrait.png).
- [GitHub research snapshot](github-snapshot-2026-09-20.json): repository activity and license metadata from GitHub's API. Its Open-LLM-VTuber license detection was incomplete; the design explains the LICENSE text separately.

The prototype is a local single-file HTML document without external scripts, account connections or network streaming. Video, avatar and chat are concept demonstrations, not installed game integration or a working streaming system. Its SVG avatar is a placeholder; final characters require selection/creation and suitable rights.

Local headless Chrome checks covered loading, Twitch chat isolation, resize/drag, simulated start/stop, portrait mode, all six layers, layout export and a 390px viewport. Dual-mode checks covered pre-stream selection, switching both ways during simulation, retained automatic interaction/mute state, hidden automatic-control buttons in manual mode, and retained mode after ending simulation. These checks found no page-script errors; real streaming and long-duration validation were not performed at this concept stage.

This original design delivery did not start a real stream or change OBS, game, Steam or platform-account settings.
