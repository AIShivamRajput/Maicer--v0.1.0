# Maicer

Maicer is a Windows app for writing code and text with your voice. Hold **Ctrl + M**, speak, and let go.
The result is pasted where your cursor is.

> **Alpha.** Maicer runs on your own PC. It has been tested by its authors on logic and security checks only.
> Expect rough edges, and please report what you find (see [Reporting problems](#reporting-problems)).

## Download and install

1. Go to the [Releases page](https://github.com/AIShivamRajput/Maicer-v.1.0.0/releases/latest) and download the
   **Maicer-Setup-<version>.exe** installer.
2. Run it. Windows will say **"Windows protected your PC"**, because the installer is not code-signed yet.
   Click **More info**, then **Run anyway**.
3. Follow the installer. Tick **Run Maicer** at the end if it's offered.

## First run

1. On the Home screen, click **Allow microphone**. Windows asks for permission. Click **Allow**.
   Ctrl + M will not record until this is done.
2. Open Notepad and click on the empty page.
3. Hold **Ctrl + M**, say "write a function that adds two numbers", and let go.
4. The result appears at your cursor. The History screen shows what was written.

## How it works

- Hold **Ctrl + M** to record. Let go to process.
- Press **Ctrl + M** again while it's processing to interrupt and give a new instruction.
- Press **Escape** to stop the current work. Escape only works while Maicer is busy.
- Speech is turned into text on your computer (whisper.cpp).
- Text or code is written on your computer by a local model (llama.cpp).
- The result is pasted into the window that had focus. If focus moves while it's processing, the result is
  copied to the clipboard instead, so it never lands in the wrong window.

## Requirements

- Windows 10 or 11, 64-bit.
- **8 GB of RAM recommended.** Estimates, not measured:

  | Mode | While idle | While dictating |
  |---|---|---|
  | Fast (default) | about 2–3 GB | peaks around 3–3.5 GB |
  | Memory saver | about 300–400 MB | peaks around 2.5–3 GB briefly |

  On a 4 GB PC, Maicer may be slow, may slow other programs, or may fail to load its model. Use Memory saver.
- About 1.4 GB of disk space for the installer, which includes the models. The installed size is larger.
- Everything runs on your processor. Speed depends on your PC. The first request after starting, or after
  Memory saver unloads the model, is the slowest.

## Limitations

- It pastes the whole result at once. It does not type it in as it's written.
- It can't edit existing code in place.
- It runs on Windows only.
- It can't paste into windows that run as administrator. Maicer itself doesn't need administrator rights.
- Speed and output quality have not been measured.
- Languages other than English are listed in Settings but untested.

## Warnings

- **Keyboard.** To detect when you let go of Ctrl + M, Maicer uses a keyboard module that sees every keystroke on
  your PC. The code only checks for Ctrl and M, and it doesn't log or send keystrokes. You can read the handler in
  `src/main.js`. If the module can't load, Maicer uses press-Ctrl + M-again-to-finish instead.
- **Clipboard.** Results are copied to the clipboard in order to paste them, and selected text is copied when you
  ask Maicer to rewrite or convert it. Clipboard managers and other apps can see this text. Maicer restores your
  previous clipboard if you haven't copied anything new.
- **Pasted commands.** Maicer pastes what the model writes. If it's a command and you press Enter in a terminal,
  the command runs. Read it before you run it. Generated code can contain bugs and security problems.
- **History is saved.** Every paste is stored in a local history, including passwords or secrets you dictate. Delete
  single entries on the History screen, or use **Clear all** in Settings.

## Privacy

Speech recognition and writing run on your computer. Maicer does not send your audio or text to any server.
Maicer only connects to `127.0.0.1`, its own local model server.

## Where Maicer keeps its files

- `%APPDATA%\Maicer`: settings, history database and `maicer.log`.
- `%LOCALAPPDATA%\Maicer`: the helper script used for pasting and focus checks.

`maicer.log` records error codes and messages only. It never contains audio, transcripts or clipboard contents.

## Troubleshooting

- **Ctrl + M does nothing:** check that Maicer is running (tray icon) and that the Home screen shows microphone allowed.
  Another app may use Ctrl + M. Change the shortcut in Settings.
- **"Allow your microphone first":** click **Allow microphone** on the Home screen. Check Windows Settings →
  Privacy & security → Microphone.
- **"Voice files missing":** the installer is incomplete. Download the latest release again.
- **Text doesn't appear:** click into a text box first. Some apps don't accept paste, and administrator windows block it.
- **The first request is slow:** expected while the model loads.

## Reporting problems

Open an issue on the repository. Include your Windows version, your RAM, what you pressed and said, what you expected,
and the error from `%APPDATA%\Maicer\maicer.log`. Check the log before sharing it.

For security problems, do not open a public issue. See [SECURITY.md](SECURITY.md).

---

## For developers

### Build from source

```bash
npm ci
npm test           # logic, settings and security tests
npm run dist       # builds dist/Maicer-Setup-*.exe on Windows
```

Requirements: Node.js 22.12 or newer, and npm. The Windows GitHub Actions build compiles the pinned llama.cpp
source commit with the Visual Studio C++ toolchain provided by the runner.

A local build does not download the speech and writing engines, so the app shows "Voice files missing" unless
you add them. The GitHub Actions workflow (`.github/workflows/build.yml`) downloads them.

### Releases

Pushing a version tag such as `v0.1.0` runs the security checks, tests and Windows build, then publishes
`Maicer-Setup-v0.1.0.exe` as a GitHub Release only when all required jobs pass. Workflow runs also upload
the installer as a downloadable artifact. The tag version must match `package.json`.

### Engines, models and checksums

`build/engine-sources.json` lists pinned engine sources and the SHA-256 of every binary, model and runtime file the build downloads.

- The llama.cpp Windows release does not publish an authenticated SHA-256, so Actions builds it from a pinned source commit
  instead of accepting an unchecked binary. The pinned commit is checked against the configured SHA before compilation.
- Changing a file, tag or hash is a reviewable change. Don't change one without checking the source first.

### Project layout

- `src/main.js`: the Electron main process (hotkey, recording, pasting, tray, windows).
- `src/ai/`: the writing model client and the engine that combines speech and writing.
- `src/speech/`: the speech recognition wrapper.
- `src/vad/`, `src/audio/`: voice-activity detection and WAV encoding.
- `src/hotkey/`: the push-to-talk state machine.
- `src/insertion/`: the paste and focus helper for Windows.
- `src/history/`, `src/analytics/`: the local history database and line counting.
- `src/settings/`: settings validation.
- `src/ui/`: the dashboard, the status pill and the hidden recorder page.
- `test/`: logic, state, settings and security tests.

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence and credits

MIT. See [LICENSE](LICENSE).

Maicer is built on Electron, whisper.cpp, llama.cpp, the Whisper models (OpenAI), the Qwen2.5 models (Alibaba Cloud),
uiohook-napi and electron-builder. Their licences are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
