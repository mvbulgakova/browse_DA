package com.maria.infoda;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
    /* Скрипт панели ИИ лежит в репозитории (web/inject.js) и скачивается при запуске,
       поэтому для обновления логики не нужно переустанавливать APK. */
    private static final String SCRIPT_URL =
        "https://raw.githubusercontent.com/mvbulgakova/browse_DA/main/web/inject.js";
    private static final String PREFS = "infoda";
    private static final String KEY_SCRIPT = "inject_js";
    /* Убираем старую панель перед вставкой новой версии скрипта */
    private static final String REMOVE_OLD_BAR =
        "['m-ai-bar','m-ai-hz'].forEach(function(id){ var e = document.getElementById(id); if(e) e.remove(); });";

    private WebView webView;
    private volatile String script;
    private volatile long lastFetch = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        script = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_SCRIPT, null);
        if (script == null) script = readAsset("inject.js");
        refreshScript();

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (script != null) view.evaluateJavascript(script, null);
                if (System.currentTimeMillis() - lastFetch > 60_000) refreshScript();
            }
        });

        webView.loadUrl("https://lk.mpgu.su/account/");
    }

    /* Скачиваем свежий скрипт в фоне; если он изменился — сохраняем и сразу подменяем на открытой странице */
    private void refreshScript() {
        lastFetch = System.currentTimeMillis();
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(SCRIPT_URL + "?t=" + System.currentTimeMillis()).openConnection();
                c.setConnectTimeout(5000);
                c.setReadTimeout(5000);
                c.setUseCaches(false);
                if (c.getResponseCode() != 200) return;
                String fresh = readAll(c.getInputStream());
                c.disconnect();
                if (fresh.trim().isEmpty() || fresh.equals(script)) return;
                script = fresh;
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_SCRIPT, fresh).apply();
                runOnUiThread(() -> webView.evaluateJavascript(REMOVE_OLD_BAR + fresh, null));
            } catch (Exception ignored) {
                // Нет сети — работаем на сохранённой версии
            }
        }).start();
    }

    private String readAsset(String name) {
        try {
            return readAll(getAssets().open(name));
        } catch (Exception e) {
            return null;
        }
    }

    private static String readAll(InputStream in) throws java.io.IOException {
        try (InputStream is = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
