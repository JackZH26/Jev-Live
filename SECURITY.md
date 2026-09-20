# Security and private data

Do not post credentials, stream keys, cookies, OAuth JSON exports, diagnostic dumps or account screenshots in issues, PRs or chat.

JEV Studio keeps runtime data outside its source repository, in Electron's per-user `JEV Studio` data directory. On Windows, OAuth access/refresh tokens, imported Google desktop client credentials and JEV API keys are encrypted using Electron `safeStorage` (Windows DPAPI). The renderer receives account display information, never access tokens, refresh tokens or stream keys. There is no plaintext fallback when the system key store is unavailable.

OBS needs its WebSocket password and streaming service settings in its own configuration. OBS does **not** encrypt these files. Managed OBS copies live under the user's application-data directory, never in the repository, and stream keys are cleared after a confirmed stop. Protect the Windows account and do not upload the OBS data directory. Encryption does not protect a compromised Windows session.

The game bridge is opt-in, uses a session-specific secret in a local mailbox, only permits a bounded set of game actions, and rejects online matches. Manual handover invalidates outstanding decisions; short leases release held actions after the controller disappears.

Git safeguards:

- `.gitignore` excludes credential exports, runtime state, OBS configuration, recordings and build artifacts.
- `.githooks/pre-commit` checks staged paths and common credential patterns.
- `.githooks/pre-push` also scans newly pushed commit history, so deleting a secret in a later commit does not evade the check.
- Scan diagnostics print filenames and line numbers, never matched values.
- Configure hooks after cloning: `git config core.hooksPath .githooks`.
- Pattern checks reduce accidental leaks but cannot prove that every secret has been detected; review the staged diff before pushing.

If a secret ever reaches a remote, revoke/rotate it first. Removing it from the latest file alone does not remove it from Git history.

Use GitHub's private vulnerability reporting when available. Until it is enabled, report the general issue without exploit credentials or private account data and request a private contact channel.
