# Steam Playtest 2026.09.21.05 release acceptance

[简体中文](STEAM_PLAYTEST_20260921.md) · Author: [JackZ / X](https://x.com/jackzhj). Follow and join the discussion.

On 2026-09-21, both **default and candidate** for Enter the Cube Playtest **5272970** were updated to Steam **BuildID 25425783**. The lobby displays **Playtest 2026.09.21.05**. The Windows Shipping client, Linux server and backend use `etc-playtest-20260921-05`. Parent game AppID 5030940 was not published.

This release includes the current native executor and map observation interface. Room knowledge, countdown planning and defensive policies remain part of Jev Live; updating the Steam package does not automatically start Jev services.

## Acceptance results

- Both complete official depot manifests match the immutable artifact: 137 files, with matching paths, sizes, Steam SHA-1 and local SHA-256 checks.
- The Steam client actually upgraded from BuildID 25420188, downloading 84,240,160 bytes. All 137 installed files passed verification again.
- The installed game was launched through Steam, with its Steam parent process, correct lobby version, real Steam authentication and existing EA entitlement verified.
- BOT match loading, movement, firing (magazine 12 to 11), M-map open/close, ESC menu and return to lobby passed. F2 did not open a debug interface.
- Backend/release tests: 100 passed; Studio: 177 passed; upload transport: 6 passed; type checks passed. The matching dedicated server started and continued sending current-version heartbeats.

## Scope and limits

The build update is complete. Valve build review remains pending and the Playtest remains **Not playable / signup hidden**. Successful developer-account launch does not establish ordinary participant availability. Access, participants and invitation quotas were not expanded or reset.

The server retains its existing drained maintenance state. Online admission correctly shows “Servers are preparing”; a complete three-human online match was not tested. Before publication, the same native package completed one local Jev match, officially placing 13th with confirmed input release. This is neither a full match on the Steam-installed build nor two consecutive first places. The winning-streak objective remains unmet.

Previous Steam BuildID **25420188** and its compatible server package remain available for rollback. The first content-depot processing attempt failed on Steam; re-upload succeeded. Only the two verified complete manifests were committed, with no intermediate or incomplete release.

Installation, launch, branch and server receipts remain locally under `C:/LYRAETC/Saved/Playtest/Releases/20260921-05/`. Screenshots containing invitation codes are local only. Accounts, keys, session credentials and raw private screenshots are excluded from Git.
