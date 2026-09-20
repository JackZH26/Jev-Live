# Security and private data

[简体中文](SECURITY.zh-CN.md) · [English](SECURITY.md)

Do not post credentials, stream keys, cookies, OAuth JSON exports, diagnostic dumps or account screenshots in issues, PRs or chat.

JEV Studio keeps runtime data outside its source repository, in Electron's per-user `JEV Studio` data directory. On Windows, OAuth access/refresh tokens, imported Google desktop client credentials and JEV API keys are encrypted using Electron `safeStorage` (Windows DPAPI). The renderer receives account display information, never access tokens, refresh tokens or stream keys. There is no plaintext fallback when the system key store is unavailable.

OBS needs its WebSocket password and streaming service settings in its own configuration. OBS does **not** encrypt these files. Managed OBS copies live under the user's application-data directory, never in the repository, and stream keys are cleared after a confirmed stop. Protect the Windows account and do not upload the OBS data directory. Encryption does not protect a compromised Windows session.

Steam scanning reads local installation manifests, returns only game metadata, and excludes account-owner fields. The screen observer binds to a process inside the selected installation directory. Automatic input requires its window in the foreground, uses a bounded action allowlist and expires within 400 ms. Manual handover invalidates outstanding decisions; parent exit and focus loss release held inputs. OCR text sent to JEV contains visible game content, never OAuth or stream credentials. Playtest menu automation selects BOT MATCH rather than online matchmaking. The optional developer bridge separately uses a session token and rejects network matches; it is not required by the Steam workflow.

Git safeguards:

- `.gitignore` excludes credential exports, runtime state, OBS configuration, recordings and build artifacts.
- `.githooks/pre-commit` checks staged paths and common credential patterns.
- `.githooks/pre-push` also scans newly pushed commit history, so deleting a secret in a later commit does not evade the check.
- Scan diagnostics print filenames and line numbers, never matched values.
- Configure hooks after cloning: `git config core.hooksPath .githooks`.
- Pattern checks reduce accidental leaks but cannot prove that every secret has been detected; review the staged diff before pushing.

If a secret ever reaches a remote, revoke/rotate it first. Removing it from the latest file alone does not remove it from Git history.

Use GitHub's private vulnerability reporting when available. Until it is enabled, report the general issue without exploit credentials or private account data and request a private contact channel.
