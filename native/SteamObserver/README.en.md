# Windows Steam game observation and input helper

[简体中文](README.md) · [English](README.en.md)

The desktop main process starts this helper over private standard input/output with the selected Steam installation directory. It identifies a visible game process within that directory, uses `PrintWindow` to read only that window, and returns Windows OCR text with normalized coordinates. It opens no network port, reads no game-process memory, and modifies/injects no game files. Observation alone is the default.

Automatic input requires explicit enablement and the target window in the foreground. Allowed actions are bounded movement, turning, firing, reloading, interaction, jumping and recognized menu coordinates, at most 400 ms each. An independent input thread checks focus and leases every 10 ms without waiting for capture, OCR or network. Manual handover, parent exit and focus loss release automatic input; old control epochs are rejected. Windows `SendInput` remains subject to system integrity restrictions without bypassing elevated processes or anti-cheat.

Source builds require .NET 10 SDK: run `npm run build:native` in the repository root. Ignored `dist-native/` output is packaged with its self-contained runtime and third-party licenses; end users need no SDK. Build artifacts, game captures and installation manifests stay out of Git.

Current candidates use OCR and ETC-specific rules, which cannot establish full spatial understanding, enemy positions or tactical quality. Game language, available OCR languages, HUD, window size and game updates affect recognition. Five-language UI support does not establish recognition of five game languages; the first game test uses English.

References: [PrintWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-printwindow), [SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput), [Windows OCR](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine).
