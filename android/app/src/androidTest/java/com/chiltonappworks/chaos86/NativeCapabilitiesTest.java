package com.chiltonappworks.chaos86;

import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import static org.junit.Assert.*;
import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.intent.Intents;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class NativeCapabilitiesTest {
    private String js(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(expression, value -> { result.set(value); latch.countDown(); }));
        assertTrue("WebView callback timed out", latch.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    private String waitFor(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        long deadline = System.currentTimeMillis() + 30000;
        String value;
        do { value = js(scenario, expression); if (value != null && !value.equals("null") && !value.equals("false")) return value; Thread.sleep(100); }
        while (System.currentTimeMillis() < deadline);
        fail("Native bridge never completed: " + expression); return "";
    }
    private void ready(ActivityScenario<MainActivity> scenario) throws Exception {
        waitFor(scenario, "!!(window.Capacitor && Capacitor.Plugins.ChaosNative)");
        assertEquals("true", js(scenario, "Capacitor.isPluginAvailable('ChaosNative')"));
        assertEquals("true", js(scenario, "Capacitor.isPluginAvailable('LocalNotifications')"));
    }
    @Test public void pdfSaveWritesExactBytesThroughRealActivityResultAndBridge() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File file = new File(context.getCacheDir(), "native-schedule-test.pdf");
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
        byte[] bytes = "%PDF-1.4\n86 Chaos schedule test\n%%EOF".getBytes(StandardCharsets.UTF_8);
        Intents.init();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new android.app.Instrumentation.ActivityResult(Activity.RESULT_OK, new Intent().setData(uri)));
            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            js(scenario, "window.__nativeSaveResult=null; Capacitor.Plugins.ChaosNative.saveFile({base64:'"+base64+"',filename:'schedule.pdf',mimeType:'application/pdf'}).then(r=>window.__nativeSaveResult=r).catch(e=>window.__nativeSaveResult={error:e.message})");
            String result = waitFor(scenario, "window.__nativeSaveResult");
            assertFalse(result, new JSONObject(result).optBoolean("cancelled", true));
            assertArrayEquals(bytes, Files.readAllBytes(file.toPath()));
        } finally { Intents.release(); file.delete(); }
    }
    @Test public void documentCancellationIsNotReportedAsSuccessfulSave() throws Exception {
        Intents.init();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new android.app.Instrumentation.ActivityResult(Activity.RESULT_CANCELED, null));
            js(scenario,"window.__nativeSaveResult=null;Capacitor.Plugins.ChaosNative.saveFile({base64:'cGRm',filename:'schedule.pdf',mimeType:'application/pdf'}).then(r=>window.__nativeSaveResult=r).catch(e=>window.__nativeSaveResult={error:e.message})");
            assertTrue(new JSONObject(waitFor(scenario,"window.__nativeSaveResult")).getBoolean("cancelled"));
        } finally { Intents.release(); }
    }
    private void shell(String command) throws Exception {
        try (ParcelFileDescriptor descriptor = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
             java.io.FileInputStream stream = new java.io.FileInputStream(descriptor.getFileDescriptor())) { while(stream.read()!=-1) {} }
    }
    @Test public void grantedMicrophoneDeliversNativeTranscriptAndEndsSession() throws Exception {
        Context target = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String testPackage = InstrumentationRegistry.getInstrumentation().getContext().getPackageName();
        String previous = android.provider.Settings.Secure.getString(target.getContentResolver(), "voice_recognition_service");
        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(target.getPackageName(),Manifest.permission.RECORD_AUDIO);
        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(testPackage,Manifest.permission.RECORD_AUDIO);
        shell("settings put secure voice_recognition_service " + testPackage + "/com.chiltonappworks.chaos86.TestRecognitionService");
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            js(scenario,"window.__nativeSpeechResult=null;(async()=>{const p=Capacitor.Plugins.ChaosNative;await p.addListener('speechResult',e=>{if(e.sessionId==='native-test'&&e.isFinal)window.__nativeSpeechResult={text:e.text}});await p.addListener('speechError',e=>window.__nativeSpeechResult={error:e.error});await p.startSpeech({sessionId:'native-test',language:'en-US',partialResults:true});})().catch(e=>window.__nativeSpeechResult={error:e.message})");
            JSONObject result=new JSONObject(waitFor(scenario,"window.__nativeSpeechResult"));
            assertEquals(result.toString(),"open schedule",result.optString("text"));
            js(scenario,"Capacitor.Plugins.ChaosNative.stopSpeech({sessionId:'native-test'})");
        } finally { shell(previous == null ? "settings delete secure voice_recognition_service" : "settings put secure voice_recognition_service " + previous); }
    }

    @Test public void grantedLocationReachesPackagedGeolocationApi() throws Exception {
        Context target=InstrumentationRegistry.getInstrumentation().getTargetContext();
        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(target.getPackageName(),Manifest.permission.ACCESS_COARSE_LOCATION);
        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(target.getPackageName(),Manifest.permission.ACCESS_FINE_LOCATION);
        shell("settings put secure location_mode 3");
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            js(scenario,"window.__nativeLocation=null;navigator.geolocation.getCurrentPosition(p=>window.__nativeLocation={lat:p.coords.latitude,lon:p.coords.longitude},e=>window.__nativeLocation={error:e.message},{enableHighAccuracy:true,timeout:20000,maximumAge:30000})");
            JSONObject location=new JSONObject(waitFor(scenario,"window.__nativeLocation"));
            assertTrue(location.toString(),location.has("lat") && location.has("lon"));
            assertTrue(Math.abs(location.getDouble("lat")-41.88)<0.1);
        }
    }

    @Test public void localReminderPersistsAcrossActivityRestartAndCanBeCancelled() throws Exception {
        Context target=InstrumentationRegistry.getInstrumentation().getTargetContext();
        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(target.getPackageName(),Manifest.permission.POST_NOTIFICATIONS);
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            js(scenario,"window.__nativeReminder=null;(async()=>{const p=Capacitor.registerPlugin('LocalNotifications');await p.schedule({notifications:[{id:180012,title:'86 Chaos test',body:'Device local reminder',isExactNotification:false,schedule:{at:new Date(Date.now()+3600000)}}]});window.__nativeReminder={scheduled:true};})().catch(e=>window.__nativeReminder={error:e.message})");
            assertTrue(new JSONObject(waitFor(scenario,"window.__nativeReminder")).getBoolean("scheduled"));
        }
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            js(scenario,"window.__nativeReminder=null;(async()=>{const p=Capacitor.registerPlugin('LocalNotifications');const before=await p.getPending();await p.cancel({notifications:[{id:180012}]});const after=await p.getPending();window.__nativeReminder={persisted:before.notifications.some(n=>n.id===180012),removed:!after.notifications.some(n=>n.id===180012)};})().catch(e=>window.__nativeReminder={error:e.message})");
            JSONObject result=new JSONObject(waitFor(scenario,"window.__nativeReminder"));
            assertTrue(result.toString(),result.getBoolean("persisted"));assertTrue(result.toString(),result.getBoolean("removed"));
        }
    }
}
