package com.maria.infoda;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;

    private static final String AI_SCRIPT =
        "(function(){" +
        "if(document.getElementById('m-ai-bar')) return;" +
        "var PROXY_URL = 'https://proxy.mariya-bulgakova2004.workers.dev';" +
        
        "var bar = document.createElement('div');" +
        "bar.id = 'm-ai-bar';" +
        "bar.style = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;gap:10px;';" +
        "bar.innerHTML = '<button id=\"btn-dots\" style=\"background:#333;color:#fff;border:none;border-radius:20px;padding:10px 18px;font:bold 14px sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.4);\">· Точки</button>' +" +
        "'<button id=\"btn-auto\" style=\"background:#0a84ff;color:#fff;border:none;border-radius:20px;padding:10px 18px;font:bold 14px sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.4);\">⚡ Авто</button>';" +
        "document.body.appendChild(bar);" +

        "var keyBtn = document.createElement('button');" +
        "keyBtn.innerHTML = '⚙';" +
        "keyBtn.style = 'position:fixed;bottom:16px;left:16px;z-index:2147483647;background:#333;color:#fff;border:none;border-radius:50%;width:40px;height:40px;font:16px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3);';" +
        "document.body.appendChild(keyBtn);" +

        "keyBtn.onclick = function(){" +
        "  var k = prompt('Введи DeepSeek API Key (sk-...):', localStorage.getItem('ds_api_key') || '');" +
        "  if(k !== null) localStorage.setItem('ds_api_key', k.trim());" +
        "};" +

        "async function callAI(key, payload){" +
        "  var res = await fetch(PROXY_URL + '?key=' + encodeURIComponent(key), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });" +
        "  return await res.json();" +
        "}" +

        "async function runAI(mode){" +
        "  var key = localStorage.getItem('ds_api_key');" +
        "  if(!key){ keyBtn.click(); key = localStorage.getItem('ds_api_key'); if(!key) return; }" +
        
        "  var activeBtn = mode === 'auto' ? document.getElementById('btn-auto') : document.getElementById('btn-dots');" +
        "  var origText = activeBtn.textContent;" +
        "  activeBtn.textContent = 'Думаю...';" +
        
        "  document.querySelectorAll('.ai-stealth-dot').forEach(function(e){ e.remove(); });" +

        "  var questions = [];" +
        "  var blocks = document.querySelectorAll('.que, .question, [class*=\"question\"], .card, fieldset');" +
        "  if(!blocks.length) blocks = [document.body];" +

        "  blocks.forEach(function(q, qi){" +
        "    var qText = q.innerText.trim();" +
        "    var opts = [];" +
        "    q.querySelectorAll('input[type=\"radio\"], input[type=\"checkbox\"], label, .answer, .option').forEach(function(el, oi){" +
        "      var inp = el.tagName === 'INPUT' ? el : el.querySelector('input');" +
        "      if(inp && inp.type !== 'hidden'){" +
        "        var id = 'q'+qi+'_opt'+oi;" +
        "        inp.setAttribute('data-ai-id', id);" +
        "        opts.push({ id:id, text:el.innerText.trim() });" +
        "      }" +
        "    });" +
        "    if(qText && opts.length > 0) questions.push({ questionIndex:qi, text:qText.slice(0, 1000), options:opts });" +
        "  });" +

        "  if(!questions.length){ activeBtn.textContent = 'Нет вопросов!'; setTimeout(function(){ activeBtn.textContent = origText; }, 2000); return; }" +

        "  var pr = 'Реши тест и верни ТОЛЬКО JSON объект с массивом результатов: [{\"questionIndex\":0,\"correctOptionTexts\":[\"текст правильного варианта\"]}] на основе текста вопроса и вариантов. Вопросы:\\n' + JSON.stringify(questions);" +
        "  try {" +
        "    var data = await callAI(key, { contents:[{parts:[{text:pr}]}] });" +
        "    var rawText = data.candidates[0].content.parts[0].text;" +
        "    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();" +
        "    var parsed = JSON.parse(rawText);" +
        "    var res = Array.isArray(parsed) ? parsed : (parsed.results || parsed.answers || []);" +
        "" +
        "    res.forEach(function(r){" +
        "      (r.correctOptionTexts||[]).forEach(function(ansText){" +
        "        document.querySelectorAll('input[data-ai-id]').forEach(function(inp){" +
        "          var parent = inp.closest('label') || inp.parentElement || inp.closest('.answer');" +
        "          if(parent && (parent.innerText.includes(ansText) || ansText.includes(parent.innerText.trim()))){" +
        "            if(mode === 'auto'){" +
        "              if(!inp.checked){ inp.click(); inp.dispatchEvent(new Event('change',{bubbles:true})); }" +
        "            } else {" +
        "              var dot = document.createElement('span');" +
        "              dot.className = 'ai-stealth-dot';" +
        "              dot.style = 'display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff3b30;margin-left:8px;vertical-align:middle;';" +
        "              parent.appendChild(dot);" +
        "            }" +
        "          }" +
        "        });" +
        "      });" +
        "    });" +
        "    activeBtn.textContent = '✅ Готово';" +
        "    setTimeout(function(){ activeBtn.textContent = origText; }, 2500);" +
        "  } catch(e){" +
        "    activeBtn.textContent = '❌ Ошибка';" +
        "    setTimeout(function(){ activeBtn.textContent = origText; }, 2500);" +
        "  }" +
        "};" +

        "document.getElementById('btn-dots').onclick = function(){ runAI('dots'); };" +
        "document.getElementById('btn-auto').onclick = function(){ runAI('auto'); };" +
        "})();";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

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
                view.evaluateJavascript(AI_SCRIPT, null);
            }
        });

        webView.loadUrl("https://lk.mpgu.su/account/");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
