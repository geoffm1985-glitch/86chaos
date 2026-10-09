package com.chiltonappworks.chaos86;

import android.content.Intent;
import android.os.Bundle;
import android.os.RemoteException;
import android.speech.RecognitionService;
import android.speech.SpeechRecognizer;
import java.util.ArrayList;
import java.util.Arrays;

/** Test APK service exercises real Android recognizer binding without cloud audio. */
public class TestRecognitionService extends RecognitionService {
    @Override protected void onStartListening(Intent intent, Callback callback) {
        try {
            callback.readyForSpeech(new Bundle());
            Bundle partial = new Bundle();
            partial.putStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION, new ArrayList<>(Arrays.asList("open")));
            callback.partialResults(partial);
            Bundle result = new Bundle();
            result.putStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION, new ArrayList<>(Arrays.asList("open schedule")));
            callback.results(result);
        } catch (RemoteException error) { throw new IllegalStateException(error); }
    }
    @Override protected void onStopListening(Callback callback) {}
    @Override protected void onCancel(Callback callback) {}
}
