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
        "bar.style = 'position:fixed;bottom:8px;right:8px;z-index:2147483647;display:flex;gap:5px;opacity:0.32;font:12px sans-serif;';" +
        "bar.innerHTML = '<button id=\"m-ai-dot\" style=\"background:#222;color:#fff;border:1px solid #555;border-radius:12px;padding:5px 10px;\">·</button>' +" +
        "'<button id=\"m-ai-auto\" style=\"background:#222;color:#fff;border:1px solid #555;border-radius:12px;padding:5px 9px;\">⚡</button>' +" +
        "'<button id=\"m-ai-key\" style=\"background:#222;color:#fff;border:1px solid #555;border-radius:12px;padding:5px 8px;\">⚙</button>';" +
        "document.body.appendChild(bar);" +
        "var hz = document.createElement('div');" +
        "hz.style = 'position:fixed;bottom:0;left:0;width:45px;height:45px;z-index:2147483646;';" +
        "var lt = 0; hz.ontouchend = function(){ var n=Date.now(); if(n-lt<350) bar.style.display=(bar.style.display==='none'?'flex':'none'); lt=n; };" +
        "document.body.appendChild(hz);" +
        "document.getElementById('m-ai-key').onclick = function(){" +
        "  var k = prompt('Введи DeepSeek API Key (sk-...):', localStorage.getItem('ds_api_key') || '');" +
        "  if(k !== null) localStorage.setItem('ds_api_key', k.trim());" +
        "};" +
        "async function callAI(key, payload){" +
        "  var res = await fetch(PROXY_URL + '?key=' + encodeURIComponent(key), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });" +
        "  return await res.json();" +
        "}" +
        "async function solve(mode){" +
        "  var key = localStorage.getItem('ds_api_key');" +
        "  if(!key){ document.getElementById('m-ai-key').click(); key = localStorage.getItem('ds_api_key'); if(!key) return; }" +
        "  var btn = document.getElementById('m-ai-dot'); btn.textContent = '…';" +
        "  document.querySelectorAll('.ai-stealth-dot').forEach(function(e){ e.remove(); });" +
        "  var questions = [];" +
        "  document.querySelectorAll('.que').forEach(function(q, qi){" +
        "    var qc = q.querySelector('.qtext') ? q.querySelector('.qtext').cloneNode(true) : q.cloneNode(true);" +
        "    qc.querySelectorAll('script[type*=\"math/tex\"]').forEach(function(s){ s.replaceWith(' [Формула: ' + s.textContent + '] '); });" +
        "    var opts = [];" +
        "    q.querySelectorAll('.answer input[type=\"radio\"], .answer input[type=\"checkbox\"]').forEach(function(inp, oi){" +
        "      if(inp.type==='hidden') return;" +
        "      var id = 'q'+qi+'_opt'+oi; inp.setAttribute('data-ai-id', id);" +
        "      var c = inp.closest('.r0, .r1, .d-flex, label') || inp.parentElement;" +
        "      var lc = c.cloneNode(true);" +
        "      lc.querySelectorAll('script[type*=\"math/tex\"]').forEach(function(s){ s.replaceWith(' [Формула: ' + s.textContent + '] '); });" +
        "      opts.push({ id:id, type:inp.type, text:lc.innerText.trim() });" +
        "    });" +
        "    var txts = [];" +
        "    q.querySelectorAll('.answer input[type=\"text\"], .answer input[type=\"number\"]').forEach(function(inp, ti){" +
        "      var id = 'q'+qi+'_txt'+ti; inp.setAttribute('data-ai-id', id); txts.push(id);" +
        "    });" +
        "    questions.push({ questionIndex:qi, questionText:qc.innerText.trim(), options:opts, textInputIds:txts });" +
        "  });" +
        "  if(!questions.length){ btn.textContent='!'; setTimeout(function(){btn.textContent='·';},1500); return; }" +
        "  var pr = 'Реши тест Moodle и верни ТОЛЬКО JSON объект с массивом results: [{\"questionIndex\":0,\"correctOptionIds\":[\"q0_opt1\"],\"textAnswers\":{\"q0_txt0\":\"ответ\"}}]. Вопросы:\\n' + JSON.stringify(questions);" +
        "  try {" +
        "    var data = await callAI(key, { contents:[{parts:[{text:pr}]}] });" +
        "    var rawText = data.candidates[0].content.parts[0].text;" +
        "    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();" +
        "    var parsed = JSON.parse(rawText);" +
        "    var res = Array.isArray(parsed) ? parsed : (parsed.results || parsed.answers || []);" +
        "    res.forEach(function(r){" +
        "      (r.correctOptionIds||[]).forEach(function(id){" +
        "        var el = document.querySelector('[data-ai-id=\"'+id+'\"]');" +
        "        if(!el) return;" +
        "        if(mode==='auto'){ if(!el.checked){ el.click(); el.dispatchEvent(new Event('change',{bubbles:true})); } }" +
        "        else { var row = el.closest('.r0, .r1, .d-flex, label') || el.parentElement; var d = document.createElement('span'); d.className='ai-stealth-dot'; d.style='display:inline-block;width:4px;height:4px;border-radius:50%;background:#777;opacity:0.55;margin-left:6px;vertical-align:middle;'; row.appendChild(d); }" +
        "      });" +
        "      if(r.textAnswers){ Object.keys(r.textAnswers).forEach(function(id){" +
        "        var inp = document.querySelector('[data-ai-id=\"'+id+'\"]'); if(!inp) return;" +
        "        if(mode==='auto'){ inp.value=r.textAnswers[id]; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true})); }" +
        "        else { inp.placeholder = r.textAnswers[id]; }" +
        "      }); }" +
        "    });" +
        "    btn.textContent = '·';" +
        "  } catch(e){ btn.textContent = '✕'; setTimeout(function(){btn.textContent='·';},2000); }" +
        "}" +
        "document.getElementById('m-ai-dot').onclick = function(){ solve('stealth'); };" +
        "document.getElementById('m-ai-auto').onclick = function(){ solve('auto'); };" +
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

        // Сюда можно сразу прописать адрес твоего ИнфоДа, чтобы при запуске открывался он
        webView.loadUrl("https://moodle.tspu.edu.ru"); // или точная ссылка на твой вуз
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
