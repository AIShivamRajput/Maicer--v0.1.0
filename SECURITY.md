# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately to the
maintainers through GitHub's "Report a vulnerability" option on the repository, or by
email to the address listed in the repository profile. We will acknowledge the report and
work on a fix before any public disclosure.

## Scope

In scope: the Electron app in this repository, its build workflow, and the handling of
settings, files and clipboard data.

Out of scope: third-party engines and models (whisper.cpp, llama.cpp and the model files),
except where Maicer's use of them is unsafe.

## What the app does and does not do

- It makes no network requests except to 127.0.0.1 (the local writing model server).
- It does not store API keys or account credentials, and it has no sign-in.
- Settings are validated against an allow-list before they are saved.
- Windows are sandboxed, have context isolation on, and cannot open pop-ups or navigate away.
- The log file records error codes and messages, not audio, transcripts or clipboard contents.
