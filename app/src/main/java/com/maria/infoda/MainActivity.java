package com.maria.infoda;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
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
    private static final String KEY_API_KEYS = "api_keys";
    /* Ключи API отдаются скрипту только на этих сайтах */
    private static final String[] TRUSTED_HOSTS = { "mpgu.su" };
    /* Убираем старую панель перед вставкой новой версии скрипта */
    private static final String REMOVE_OLD_BAR =
        "['m-ai-bar','m-ai-hz'].forEach(function(id){ var e = document.getElementById(id); if(e) e.remove(); });";

    private WebView webView;
    private volatile String script;
    private volatile long lastFetch = 0;
    private volatile String currentHost = "";

    /* Мост для скрипта панели: ключи в памяти приложения (одни на все сайты), буфер обмена, внешний браузер */
    private class Bridge {
        private boolean trusted() {
            String h = currentHost == null ? "" : currentHost;
            for (String t : TRUSTED_HOSTS) if (h.equals(t) || h.endsWith("." + t)) return true;
            return false;
        }

        @JavascriptInterface
        public String getKeys() {
            if (!trusted()) return "__denied__";
            return getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_API_KEYS, "");
        }

        @JavascriptInterface
        public boolean setKeys(String keys) {
            if (!trusted()) return false;
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_API_KEYS, keys == null ? "" : keys).apply();
            return true;
        }

        @JavascriptInterface
        public void copy(String text) {
            runOnUiThread(() -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("question", text));
            });
        }

        @JavascriptInterface
        public void openExternal(String url) {
            if (url == null || !url.startsWith("https://")) return;
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                }
            });
        }
    }

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

        webView.addJavascriptInterface(new Bridge(), "InfoDa");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                currentHost = hostOf(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                currentHost = hostOf(url);
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

    private static String hostOf(String url) {
        try {
            String h = Uri.parse(url).getHost();
            return h == null ? "" : h.toLowerCase();
        } catch (Exception e) {
            return "";
        }
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
