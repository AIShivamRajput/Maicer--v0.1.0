# Third-party software and models

Maicer uses the components below. Each keeps its own licence. Check the links before you redistribute anything.

## Dependencies (npm)

| Component | Use | Licence |
|---|---|---|
| Electron 43.8.3 | desktop app shell | MIT |
| uiohook-napi (optional) | key-release detection | MIT |
| electron-builder 26.18.0 | builds the Windows installer | MIT |

## Engines (downloaded by the build, not stored in this repository)

| Component | Pinned to | Use | Licence |
|---|---|---|---|
| whisper.cpp (ggml-org) | release v1.8.2 | speech recognition | MIT |
| llama.cpp (ggml-org) | tag b4150, source commit `a5e47592b6171ae21f3eaa1aba6fb2b707875063` | writing model runtime | MIT |
| Microsoft Visual C++ Redistributable | Microsoft download link | Windows runtime | Microsoft's redistributable terms |

## Models (downloaded by the build, not stored in this repository)

| Model | Use | Licence |
|---|---|---|
| Whisper `ggml-base` (quantised q5_1) from `ggerganov/whisper.cpp` on Hugging Face | speech recognition | MIT (released by OpenAI under MIT) |
| Qwen2.5-1.5B-Instruct (Q4_K_M GGUF) from `Qwen/Qwen2.5-1.5B-Instruct-GGUF` | writing | Apache-2.0 |

## What this means

- The repository contains no model weights and no engine binaries.
- The installer you build does contain them. If you share that installer, follow each component's licence,
  including any requirement to include its licence text or attribution.
- Logo and icon artwork were created for this project and are covered by the repository licence (MIT).
