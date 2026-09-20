# ETC autoplay API v3

[简体中文](README.md)

ETC developers compile this integration into a game build. Players continue adding and launching Enter the Cube Playtest through Steam; no source project or editor is required.

```powershell
./integrations/etc/install.ps1 -Project <ETC-project-root>
# In ETC, with the editor closed, follow its build rules
./Tools/Build.bat LyraGame Shipping
```

The installer copies Bridge, Motor and native test files into `EtcCoreRuntime/Private/Development`, retaining module Install/Uninstall hooks. It does not modify maps, assets, weapon data or the Steam installation, and does not publish a Steam update. Package and release through ETC's existing Steam candidate/release workflow.

Once included in the installed game, the bridge reads JEV's short-lived session under `%LOCALAPPDATA%/JevLive/etc-bridge`, bound to the actual game PID. JEV targets 20 Hz structured observation/tactical commands; the game executes every frame. Offline bot matches only. Manual mode, focus loss, disconnects and expired commands release automatic input. Never commit session files or tokens.

Native constraints test: `Project.ETC.Jev.PlayerMotor`. See [design and acceptance](../../docs/ETC_AUTOPLAY.en.md) for limitations and testing. Steam Build 25364079 did not connect to v3 during probing; compilation does not establish publication or full-match acceptance.
