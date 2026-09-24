# 86 Chaos 17.1.8

## 86Voice Resilient Mobile Capture Repair

17.1.8 replaces the mobile microphone's dependency on the browser Web Speech service with a real microphone-recording pipeline designed for Android/PWA use.

### Repairs

- Keeps Voice as the first bottom-toolbar control.
- Opens the 86Voice controller visibly above the mobile toolbar on the first tap.
- Uses `MediaRecorder` as the preferred mobile/PWA capture path.
- Sends only short, size-limited audio clips to the existing authenticated `/api/voice-command` route for transcription.
- Keeps App Check, Firebase ID-token authorization, workspace rate limiting, MIME allowlisting, and server-side Gemini credentials in the transcription path.
- Retains native `SpeechRecognition` on compatible desktop browsers as a secondary path.
- Shows live status for permission, recording, transcription, processing, and errors instead of failing silently.
- Preserves all 17.1.7 Concept 1, Schedule Builder, Spanish, System Administrator, toolbar, and release-gate repairs.

### Certification status

Source and targeted validation may pass locally. The microphone is not considered deployment-confirmed until 17.1.8 is deployed to `testing.86chaos.com` and the browser regression is executed against the deployed app on the real test environment.
