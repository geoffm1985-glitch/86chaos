package com.chiltonappworks.chaos86;

import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import android.view.View;
import android.view.ViewGroup;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private final BackExitGuard backExitGuard = new BackExitGuard();
    @Override public void onPause() { backExitGuard.reset(); super.onPause(); }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ChaosNativePlugin.class);
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        final View contentView = findViewById(android.R.id.content);
        final View webView = getBridge().getWebView();

        contentView.setBackgroundColor(Color.parseColor("#12161A"));
        webView.setBackgroundColor(Color.parseColor("#12161A"));
        webView.setPadding(0, 0, 0, 0);

        if (contentView instanceof ViewGroup) {
            ((ViewGroup) contentView).setClipToPadding(true);
        }

        final WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);

        ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, windowInsets) -> {
            Insets safeInsets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            view.setPadding(
                safeInsets.left,
                safeInsets.top,
                safeInsets.right,
                safeInsets.bottom
            );
            return windowInsets;
        });

        ViewCompat.requestApplyInsets(contentView);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                getBridge().getWebView().evaluateJavascript(
                    "(function(){if(typeof window.__CHAOS_NATIVE_BACK_HANDLER__==='function'){window.__CHAOS_NATIVE_BACK_HANDLER__();return true;}return false;})()",
                    handled -> {
                        if ("true".equals(handled)) return;
                        if (getBridge().getWebView().canGoBack()) {
                            backExitGuard.reset(); getBridge().getWebView().goBack();
                        } else if (backExitGuard.shouldExit(SystemClock.elapsedRealtime())) {
                            finish();
                        } else {
                            Toast.makeText(MainActivity.this, "Press back again within 2 seconds to close 86 Chaos.", Toast.LENGTH_SHORT).show();
                        }
                    });
            }
        });
    }
}
