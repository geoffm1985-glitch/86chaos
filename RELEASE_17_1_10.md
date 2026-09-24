# 86 Chaos 17.1.10

## 86Voice Production 17.0.29 Lifecycle Restoration

17.1.10 restores the microphone lifecycle from the deployed production 17.0.29 build while preserving the new 17.1.x Concept 1 UI.

### Restored behavior
- The bottom toolbar remains the new six-button Concept 1 toolbar with Voice first.
- Tapping Voice invokes the same 17.0.29 controller behavior: open the 86Voice panel, wait 80 ms, construct `SpeechRecognition` / `webkitSpeechRecognition`, and call `start()`.
- Final native transcripts continue into the current 17.1.x 86Voice command parser and safety workflow.
- The experimental MediaRecorder + server transcription path is no longer part of the active client microphone flow.

### Preserved
- New Concept 1 navigation and page redesign.
- Current 86Voice panel presentation, typed-command fallback, parser, confirmations, undo safeguards, and permissions.
- Spanish support and all non-voice repairs through 17.1.9.

This is a targeted production-parity repair. It does not certify the release gate until the deployed testing build is exercised on the real device/browser path.
