# 86 Chaos 17.1.9

## 86Voice Panel-First Reliability Repair

17.1.9 corrects the mobile 86Voice interaction order and isolates speech transcription from legacy voice-intent model configuration.

### Repairs

- The first mobile Voice tap opens the 86Voice command panel only.
- Microphone capture starts only after pressing **Start Listening** inside the visible panel.
- Voice errors remain visible inside 86Voice instead of existing only as a global error card.
- Server transcription defaults to `gemini-3.5-flash-lite`, no longer inherits `VOICE_GEMINI_MODEL`, and automatically retires stale Gemini 2.5 voice overrides that can return HTTP 404 on newer API projects.
- Safe provider diagnostics record status/model/MIME/byte count without logging credentials or raw audio.
- Existing MediaRecorder, Web Speech, typed-command, authentication, App Check, and rate-limit protections remain in place.

### Certification status

Source validation is not the same as a real phone microphone test. 17.1.9 must still be deployed to `testing.86chaos.com` and exercised on the real Android/PWA environment before the microphone is called deployment-confirmed.
