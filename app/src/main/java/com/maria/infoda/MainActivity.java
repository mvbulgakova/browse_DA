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
        "var DEFAULT_PROXY = 'https://proxy.mariya-bulgakova2004.workers.dev';" +

        "var bar = document.createElement('div');" +
        "bar.id = 'm-ai-bar';" +
        "bar.style = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;gap:8px;align-items:center;';" +
        "bar.innerHTML = '<button id=\"btn-cfg\" style=\"background:#2c2c2e;color:#fff;border:1px solid #555;border-radius:50%;width:36px;height:36px;font:15px sans-serif;\">⚙</button>' +" +
        "'<button id=\"btn-dots\" style=\"background:#2c2c2e;color:#fff;border:1px solid #555;border-radius:18px;padding:8px 16px;font:bold 13px sans-serif;\">· Точки</button>' +" +
        "'<button id=\"btn-auto\" style=\"background:#0a84ff;color:#fff;border:none;border-radius:18px;padding:8px 16px;font:bold 13px sans-serif;\">⚡ Авто</button>';" +
        "document.body.appendChild(bar);" +

        /* Двойной тап в левом нижнем углу — спрятать/показать кнопки */
        "var hz = document.createElement('div');" +
        "hz.style = 'position:fixed;bottom:0;left:0;width:45px;height:45px;z-index:2147483646;';" +
        "var lt = 0; hz.ontouchend = function(){ var n=Date.now(); if(n-lt<350) bar.style.display=(bar.style.display==='none'?'flex':'none'); lt=n; };" +
        "document.body.appendChild(hz);" +

        "document.getElementById('btn-cfg').onclick = function(){" +
        "  var k = prompt('1. API Ключ (sk-... от DeepSeek ИЛИ AIza... от Gemini для картинок):', localStorage.getItem('ai_key') || '');" +
        "  if(k !== null) localStorage.setItem('ai_key', k.trim());" +
        "  var p = prompt('2. Адрес твоего воркера Cloudflare:', localStorage.getItem('ai_proxy') || DEFAULT_PROXY);" +
        "  if(p !== null) localStorage.setItem('ai_proxy', p.trim().replace(/\\/$/, ''));" +
        "};" +

        /* Конвертация картинок-формул МПГУ в Base64 */
        "function imgToB64(img){" +
        "  try {" +
        "    var c = document.createElement('canvas');" +
        "    c.width = img.naturalWidth || img.width || 200;" +
        "    c.height = img.naturalHeight || img.height || 60;" +
        "    var ctx = c.getContext('2d');" +
        "    ctx.fillStyle = '#FFFFFF';" +
        "    ctx.fillRect(0, 0, c.width, c.height);" +
        "    ctx.drawImage(img, 0, 0);" +
        "    return c.toDataURL('image/png').split(',')[1];" +
        "  } catch(e){ return null; }" +
        "}" +

        "async function runAI(mode){" +
        "  var key = localStorage.getItem('ai_key');" +
        "  if(!key){ document.getElementById('btn-cfg').click(); key = localStorage.getItem('ai_key'); if(!key) return; }" +
        "  var proxy = localStorage.getItem('ai_proxy') || DEFAULT_PROXY;" +
        "  var isGemini = key.indexOf('AIza') === 0;" +

        "  var btn = mode === 'auto' ? document.getElementById('btn-auto') : document.getElementById('btn-dots');" +
        "  var orig = btn.textContent; btn.textContent = '…';" +
        "  document.querySelectorAll('.ai-stealth-dot').forEach(function(e){ e.remove(); });" +

        "  var qBlocks = document.querySelectorAll('.que');" +
        "  if(!qBlocks.length){ alert('На этой странице не найдено вопросов (.que)'); btn.textContent = orig; return; }" +

        "  var geminiParts = [{ text: 'Ты решаешь тест по математике/теории вероятностей в Moodle. Для каждого вопроса выбери правильные id вариантов. Если inputType=radio — ровно один id, если checkbox — все верные id. Верни ТОЛЬКО JSON формата: {\"results\":[{\"questionIndex\":0,\"correctIds\":[\"q0_opt0\"]}]}\\n' }];" +
        "  var dsQuestions = [];" +

        "  qBlocks.forEach(function(q, qi){" +
        "    var qEl = q.querySelector('.qtext') || q;" +
        "    var qText = qEl.innerText.replace(/\\s+/g, ' ').trim();" +
        "    geminiParts.push({ text: '\\n=== Вопрос ' + qi + ': ' + qText + ' ===\\n' });" +
        "    qEl.querySelectorAll('img').forEach(function(im){" +
        "      var b64 = isGemini ? imgToB64(im) : null;" +
        "      if(b64) geminiParts.push({ inlineData: { mimeType: 'image/png', data: b64 } });" +
        "      else qText += ' [Формула-картинка: ' + im.src.split('/').pop() + ']';" +
        "    });" +

        "    var opts = [];" +
        "    q.querySelectorAll('.answer .r0, .answer .r1').forEach(function(row, oi){" +
        "      var inp = row.querySelector('input[type=\"radio\"], input[type=\"checkbox\"]');" +
        "      if(!inp) return;" +
        "      var id = 'q' + qi + '_opt' + oi;" +
        "      inp.setAttribute('data-ai-id', id);" +
        "      var lbl = row.querySelector('[data-region=\"answer-label\"]') || row;" +
        "      var oText = lbl.innerText.replace(/\\s+/g, ' ').trim();" +
        "      geminiParts.push({ text: 'Вариант ' + id + ' (' + inp.type + '): ' + oText });" +
        "      lbl.querySelectorAll('img').forEach(function(im){" +
        "        var b64 = isGemini ? imgToB64(im) : null;" +
        "        if(b64) geminiParts.push({ inlineData: { mimeType: 'image/png', data: b64 } });" +
        "        else oText += ' [Картинка формулы]';" +
        "      });" +
        "      opts.push({ id: id, inputType: inp.type, text: oText });" +
        "    });" +
        "    dsQuestions.push({ questionIndex: qi, question: qText, options: opts });" +
        "  });" +

        "  try {" +
        "    var bodyObj = isGemini ? " +
        "      { contents: [{ parts: geminiParts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } } :" +
        "      { model: 'deepseek-chat', messages: [{ role: 'system', content: 'Реши тест Moodle. Верни ТОЛЬКО JSON: {\"results\":[{\"questionIndex\":0,\"correctIds\":[\"q0_opt0\"]}]}' }, { role: 'user', content: JSON.stringify(dsQuestions) }], response_format: { type: 'json_object' }, temperature: 0.1 };" +

        "    var resp = await fetch(proxy + '?key=' + encodeURIComponent(key), {" +
        "      method: 'POST'," +
        "      headers: { 'Content-Type': 'text/plain;charset=utf-8' }," +
        "      body: JSON.stringify(bodyObj)" +
        "    });" +

        "    var data = await resp.json();" +
        "    if(!resp.ok || data.error){" +
        "      var msg = (data.error && data.error.message) ? data.error.message : JSON.stringify(data);" +
        "      throw new Error(msg);" +
        "    }" +

        "    var raw = isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;" +
        "    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();" +
        "    var parsed = JSON.parse(raw);" +
        "    var list = parsed.results || parsed.answers || [];" +

        "    list.forEach(function(r){" +
        "      var cIds = r.correctIds || [];" +
        "      cIds.forEach(function(id){" +
        "        var inp = document.querySelector('[data-ai-id=\"' + id + '\"]');" +
        "        if(!inp) return;" +
        "        var row = inp.closest('.r0, .r1') || inp.parentElement;" +
        "        if(mode === 'auto'){" +
        "          if(inp.disabled) row.style.outline = '1px dashed #30d158';" +
        "          else if(!inp.checked){ inp.click(); inp.dispatchEvent(new Event('change', {bubbles:true})); }" +
        "        } else {" +
        "          var dot = document.createElement('span');" +
        "          dot.className = 'ai-stealth-dot';" +
        "          dot.style = 'display:inline-block;width:5px;height:5px;border-radius:50%;background:#777;opacity:0.65;margin-left:8px;align-self:center;flex-shrink:0;';" +
        "          row.appendChild(dot);" +
        "        }" +
        "      });" +
        "    });" +

        "    btn.textContent = '✓';" +
        "    setTimeout(function(){ btn.textContent = orig; }, 1800);" +
        "  } catch(e){" +
        "    alert('Ошибка: ' + e.message);" +
        "    btn.textContent = '✕';" +
        "    setTimeout(function(){ btn.textContent = orig; }, 2000);" +
        "  }" +
        "}" +

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
