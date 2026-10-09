// Present the existing voice lifecycle with Android's recognition service.
// Every callback is bound to a session so late transcripts cannot commit commands.
export function createNativeSpeechRecognition(plugin) {
  return class NativeSpeechRecognition {
    constructor() {
      this.lang = 'en-US';
      this.interimResults = true;
      this.listeners = [];
      this.sessionId = `native_voice_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      this.closed = false;
      this.started = false;
    }
    start() {
      this.closed = false;
      this.startSession().catch(error => {
        if (this.closed) return;
        this.onerror?.({ error: error.code || 'service-not-allowed', message: error.message });
        this.finish();
      });
    }
    async startSession() {
      for (const eventName of ['speechResult', 'speechError', 'speechEnd', 'speechReady']) {
        const handle = await plugin.addListener(eventName, event => {
          if (this.closed || event.sessionId !== this.sessionId) return;
          if (eventName === 'speechResult') {
            const result = Object.assign([{ transcript: event.text || '' }], { isFinal: event.isFinal === true });
            this.onresult?.({ resultIndex: 0, results: [result] });
          } else if (eventName === 'speechError') {
            this.onerror?.({ error: event.error, message: event.message });
            this.finish();
          } else if (eventName === 'speechEnd') this.finish();
          else if (!this.started) { this.started = true; this.onstart?.(); }
        });
        if (this.closed) { await handle.remove(); return; }
        this.listeners.push(handle);
      }
      if (this.closed) return;
      await plugin.startSpeech({ sessionId: this.sessionId, language: this.lang, partialResults: this.interimResults });
      if (this.closed) await plugin.stopSpeech({ sessionId: this.sessionId });
    }
    finish() {
      if (this.closed) return;
      this.closed = true;
      for (const handle of this.listeners.splice(0)) Promise.resolve(handle.remove()).catch(() => {});
      this.onend?.();
    }
    stop() {
      this.finish();
      Promise.resolve(plugin.stopSpeech({ sessionId: this.sessionId })).catch(() => {});
    }
    abort() { this.stop(); }
  };
}
