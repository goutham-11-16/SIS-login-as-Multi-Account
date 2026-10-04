package com.kare.sisportal;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public class MainActivity extends Activity {
    private WebView webView;
    private LocalWebServer server;
    private SisEngine sisEngine;
    private static final int SERVER_PORT = 8089;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Pure OLED Black Status Bar & Navigation Bar
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.BLACK);
        window.setNavigationBarColor(Color.BLACK);

        // Start Local Embedded Server
        sisEngine = new SisEngine();
        server = new LocalWebServer(SERVER_PORT, getAssets(), sisEngine);
        try {
            server.start();
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Setup Fullscreen Layout & WebView
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.BLACK);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        container.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        setContentView(container);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("tel:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception ignored) {}
                } else if (url.contains("whatsapp.com") || url.startsWith("whatsapp:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception ignored) {}
                } else if (url.startsWith("mailto:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse(url));
                        startActivity(intent);
                        return true;
                    } catch (Exception ignored) {}
                }
                return false;
            }
        });

        // Load Local Portal
        webView.loadUrl("http://127.0.0.1:" + SERVER_PORT + "/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                "(() => {" +
                "  if (typeof goBack === 'function') {" +
                "    const generic = document.getElementById('tab-content-generic');" +
                "    const modal = document.querySelector('.modal.show');" +
                "    if ((generic && !generic.classList.contains('d-none')) || modal || (typeof activeTab !== 'undefined' && activeTab !== 'home')) {" +
                "      goBack();" +
                "      return true;" +
                "    }" +
                "  }" +
                "  return false;" +
                "})()",
                result -> {
                    if (!"true".equals(result)) {
                        super.onBackPressed();
                    }
                }
            );
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (server != null) {
            server.stop();
        }
        if (webView != null) {
            webView.destroy();
        }
    }
}
