package com.chiltonappworks.chaos86;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.OutputStream;
import java.util.ArrayList;

@CapacitorPlugin(name = "ChaosNative", permissions = {
    @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
})
public class ChaosNativePlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private String speechSession;
    private PluginCall pendingSpeech;
    private PluginCall pendingFile;
    private byte[] fileBytes;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable speechTimeout;
    private WebView printView;

    private void speechEvent(String type, String session, String text, boolean isFinal, String error) {
        JSObject event = new JSObject();
        event.put("sessionId", session);
        event.put("text", text);
        event.put("isFinal", isFinal);
        event.put("error", error);
        notifyListeners(type, event);
    }

    private void endSpeech() {
        String ended = speechSession;
        speechSession = null;
        if (speechTimeout != null) mainHandler.removeCallbacks(speechTimeout);
        if (recognizer != null) { recognizer.cancel(); recognizer.destroy(); recognizer = null; }
        if (ended != null) speechEvent("speechEnd", ended, "", false, "");
    }

    @PluginMethod
    public void startSpeech(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (recognizer != null || pendingSpeech != null) { call.reject("86Voice is already listening.", "busy"); return; }
            pendingSpeech = call;
            if (getPermissionState("microphone") == PermissionState.GRANTED) beginSpeech(call);
            else requestPermissionForAlias("microphone", call, "microphoneResult");
        });
    }

    @PermissionCallback
    private void microphoneResult(PluginCall call) {
        if (pendingSpeech != call) return;
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            pendingSpeech = null;
            call.reject("Allow microphone access in Android app settings to use 86Voice.", "not-allowed");
            return;
        }
        getActivity().runOnUiThread(() -> beginSpeech(call));
    }

    private void beginSpeech(PluginCall call) {
        if (pendingSpeech != call) return;
        pendingSpeech = null;
        final String session = call.getString("sessionId", "");
        if (session.isEmpty()) { call.reject("A speech session is required."); return; }
        // Prefer the user's configured service; on-device availability alone
        // does not guarantee that the requested language model is installed.
        boolean onDevice = !SpeechRecognizer.isRecognitionAvailable(getContext()) && Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext());
        if (!onDevice && !SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Enable an Android speech recognition service in device settings to use 86Voice.", "service-not-allowed");
            return;
        }
        try {
            speechSession = session;
            recognizer = onDevice ? SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext()) : SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new RecognitionListener() {
                public void onReadyForSpeech(Bundle params) { if (session.equals(speechSession)) speechEvent("speechReady", session, "", false, ""); }
                public void onBeginningOfSpeech() {}
                public void onRmsChanged(float rmsdB) {}
                public void onBufferReceived(byte[] buffer) {}
                public void onEndOfSpeech() {}
                public void onEvent(int eventType, Bundle params) {}
                private void result(Bundle bundle, boolean isFinal) {
                    if (!session.equals(speechSession)) return;
                    ArrayList<String> words = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (words != null && !words.isEmpty()) speechEvent("speechResult", session, words.get(0), isFinal, "");
                    if (isFinal) endSpeech();
                }
                public void onPartialResults(Bundle results) { result(results, false); }
                public void onResults(Bundle results) { result(results, true); }
                public void onError(int code) {
                    if (!session.equals(speechSession)) return;
                    String error;
                    switch (code) {
                        case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: error = "not-allowed"; break;
                        case SpeechRecognizer.ERROR_AUDIO: error = "audio-capture"; break;
                        case SpeechRecognizer.ERROR_NETWORK:
                        case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: error = "network"; break;
                        case SpeechRecognizer.ERROR_NO_MATCH:
                        case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: error = "no-speech"; break;
                        default: error = "service-not-allowed";
                    }
                    speechEvent("speechError", session, "", false, error);
                    endSpeech();
                }
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", "en-US"));
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, call.getBoolean("partialResults", true));
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            recognizer.startListening(intent);
            speechTimeout = () -> {
                if (session.equals(speechSession)) { speechEvent("speechError", session, "", false, "no-speech"); endSpeech(); }
            };
            mainHandler.postDelayed(speechTimeout, 45000);
            call.resolve();
        } catch (Exception error) {
            endSpeech();
            call.reject("Android speech recognition could not start. Check the device speech service and microphone settings.", "service-not-allowed", error);
        }
    }

    @PluginMethod
    public void stopSpeech(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String session = call.getString("sessionId", "");
            if (pendingSpeech != null && session.equals(pendingSpeech.getString("sessionId"))) {
                pendingSpeech.reject("Voice session cancelled.", "aborted"); pendingSpeech = null;
            }
            if (session.equals(speechSession)) endSpeech();
            call.resolve();
        });
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        if (pendingFile != null) { call.reject("Finish saving the current document first."); return; }
        String encoded = call.getString("base64", "");
        String filename = call.getString("filename", "86chaos-export").replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        String mime = call.getString("mimeType", "application/octet-stream").split(";")[0].trim();
        if (filename.length() > 180) filename = filename.substring(0, 180);
        if (!mime.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+") || encoded.length() > 28000000) { call.reject("The export type or file size is unsupported."); return; }
        try {
            fileBytes = Base64.decode(encoded, Base64.DEFAULT);
            if (fileBytes.length == 0) throw new IllegalArgumentException("Empty export");
            pendingFile = call;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mime);
            intent.putExtra(Intent.EXTRA_TITLE, filename);
            startActivityForResult(call, intent, "documentCreated");
        } catch (Exception error) { pendingFile = null; fileBytes = null; call.reject("The file could not be prepared for saving.", error); }
    }

    @ActivityCallback
    private void documentCreated(PluginCall call, ActivityResult result) {
        PluginCall savedCall = pendingFile;
        byte[] savedBytes = fileBytes;
        pendingFile = null; fileBytes = null;
        if (savedCall == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject response = new JSObject(); response.put("cancelled", true); savedCall.resolve(response); return;
        }
        execute(() -> {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(result.getData().getData(), "w")) {
                if (output == null) throw new IllegalStateException("Document provider did not open the file.");
                output.write(savedBytes); output.flush();
                JSObject response = new JSObject(); response.put("cancelled", false); savedCall.resolve(response);
            } catch (Exception error) { savedCall.reject("Android could not save the document. Choose another location and try again.", error); }
        });
    }

    @PluginMethod
    public void shareText(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("text/plain");
                intent.putExtra(Intent.EXTRA_SUBJECT, call.getString("title", "86 Chaos"));
                intent.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
                getActivity().startActivity(Intent.createChooser(intent, "Share with"));
                call.resolve();
            } catch (Exception error) { call.reject("Android sharing is unavailable.", error); }
        });
    }

    @PluginMethod
    public void printPage(PluginCall call) {
        getActivity().runOnUiThread(() -> printWebView(getBridge().getWebView(), call));
    }

    private void printWebView(WebView view, PluginCall call) {
        try {
            PrintManager manager = (PrintManager) getActivity().getSystemService(android.content.Context.PRINT_SERVICE);
            if (manager == null) throw new IllegalStateException("Printing unavailable");
            String title = call.getString("title", "86 Chaos");
            manager.print(title, view.createPrintDocumentAdapter(title), new PrintAttributes.Builder().build());
            call.resolve();
        } catch (Exception error) { call.reject("Android printing is unavailable on this device.", error); }
    }

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html", "");
        if (html.isEmpty() || html.length() > 2000000) { call.reject("The print document is empty or too large."); return; }
        getActivity().runOnUiThread(() -> {
            if (printView != null) printView.destroy();
            printView = new WebView(getActivity());
            printView.getSettings().setJavaScriptEnabled(false);
            printView.getSettings().setAllowFileAccess(false);
            printView.getSettings().setBlockNetworkLoads(true);
            printView.setWebViewClient(new WebViewClient() {
                private boolean printed;
                @Override public void onPageFinished(WebView view, String url) {
                    if (!printed) { printed = true; printWebView(view, call); }
                }
            });
            printView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }

    @Override protected void handleOnPause() { getActivity().runOnUiThread(this::endSpeech); }
    @Override protected void handleOnDestroy() {
        getActivity().runOnUiThread(() -> { endSpeech(); if (printView != null) { printView.destroy(); printView = null; } });
    }
}
