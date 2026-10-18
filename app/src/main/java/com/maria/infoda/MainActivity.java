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
        "  var k = prompt('1. API-ключ (sk-... = DeepSeek, только текст; AIza... / AQ. ... = Gemini, текст + картинки):', localStorage.getItem('ai_key') || '');" +
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

        /* Достаём текст из ответа воркера. Основной формат: {ok:true,text:'...'}; старые форматы читаются только с проверками */
        "function pickText(d){" +
        "  if(!d || typeof d !== 'object') return '';" +
        "  if(typeof d.text === 'string') return d.text;" +
        "  var c = Array.isArray(d.candidates) ? d.candidates[0] : null;" +
        "  var p = c && c.content && Array.isArray(c.content.parts) ? c.content.parts : [];" +
        "  var t = p.map(function(x){ return x && typeof x.text === 'string' && !x.thought ? x.text : ''; }).join('');" +
        "  if(t) return t;" +
        "  var ch = Array.isArray(d.choices) ? d.choices[0] : null;" +
        "  return ch && ch.message && typeof ch.message.content === 'string' ? ch.message.content : '';" +
        "}" +

        "function pickError(d){" +
        "  if(!d || typeof d !== 'object') return '';" +
        "  var e = d.error;" +
        "  if(!e) return '';" +
        "  if(typeof e === 'string') return e;" +
        "  return e.message ? String(e.message) : JSON.stringify(e);" +
        "}" +

        /* Разбор JSON от модели: срезаем ```json-обёртки и лишний текст вокруг объекта */
        "function parseLoose(t){" +
        "  t = String(t || '').replace(/```json/gi, '').replace(/```/g, '').trim();" +
        "  try { return JSON.parse(t); } catch(e){}" +
        "  var a = t.indexOf('{'), b = t.lastIndexOf('}');" +
        "  if(a >= 0 && b > a){ try { return JSON.parse(t.slice(a, b + 1)); } catch(e){} }" +
        "  return null;" +
        "}" +

        "function clean(s){ return String(s || '').replace(/\\s+/g, ' ').trim(); }" +

        "async function runAI(mode){" +
        "  var key = (localStorage.getItem('ai_key') || '').trim();" +
        "  if(!key){ document.getElementById('btn-cfg').click(); key = (localStorage.getItem('ai_key') || '').trim(); if(!key) return; }" +
        "  var proxy = localStorage.getItem('ai_proxy') || DEFAULT_PROXY;" +
        /* sk- = DeepSeek (только текст), всё остальное (AIza..., AQ. ...) = Gemini (текст + картинки) */
        "  var isDeepSeek = key.indexOf('sk-') === 0;" +

        "  var btn = mode === 'auto' ? document.getElementById('btn-auto') : document.getElementById('btn-dots');" +
        "  var orig = btn.textContent; btn.textContent = '…';" +
        "  document.querySelectorAll('.ai-stealth-dot').forEach(function(e){ e.remove(); });" +

        "  var qBlocks = document.querySelectorAll('.que');" +
        "  if(!qBlocks.length){ alert('На этой странице не найдено вопросов (.que)'); btn.textContent = orig; return; }" +

        "  var parts = [{ text: 'Вопросы теста Moodle. У каждого варианта указан его id и inputType. Картинки после текста — это формулы к соответствующему вопросу или варианту.\\n' }];" +
        "  var optCount = 0;" +

        "  function addImages(el, label){" +
        "    el.querySelectorAll('img').forEach(function(im){" +
        "      var b64 = isDeepSeek ? null : imgToB64(im);" +
        "      if(b64){ parts.push({ text: label + ':' }); parts.push({ inlineData: { mimeType: 'image/png', data: b64 } }); }" +
        "      else parts.push({ text: label + ': [картинка-формула ' + clean(im.alt || (im.src || '').split('/').pop()) + ']' });" +
        "    });" +
        "  }" +

        "  qBlocks.forEach(function(q, qi){" +
        "    var qEl = q.querySelector('.qtext') || q;" +
        "    parts.push({ text: '\\n=== Вопрос ' + qi + ' ===\\n' + clean(qEl.innerText) });" +
        "    addImages(qEl, 'Формула к вопросу ' + qi);" +
        "    q.querySelectorAll('.answer .r0, .answer .r1').forEach(function(row, oi){" +
        "      var inp = row.querySelector('input[type=\"radio\"], input[type=\"checkbox\"]');" +
        "      if(!inp) return;" +
        "      var id = 'q' + qi + '_opt' + oi;" +
        "      inp.setAttribute('data-ai-id', id);" +
        "      var lbl = row.querySelector('[data-region=\"answer-label\"]') || row;" +
        "      parts.push({ text: 'Вариант ' + id + ' (inputType=' + inp.type + '): ' + clean(lbl.innerText) });" +
        "      addImages(lbl, 'Формула варианта ' + id);" +
        "      optCount++;" +
        "    });" +
        "  });" +
        "  if(!optCount){ alert('Не найдено вариантов ответа (radio/checkbox) в вопросах'); btn.textContent = orig; return; }" +

        "  try {" +
        "    var resp = await fetch(proxy + '?key=' + encodeURIComponent(key), {" +
        "      method: 'POST'," +
        "      headers: { 'Content-Type': 'text/plain;charset=utf-8' }," +
        "      body: JSON.stringify({ parts: parts })" +
        "    });" +

        "    var rawResp = await resp.text();" +
        "    var data = null;" +
        "    try { data = JSON.parse(rawResp); } catch(e){}" +
        "    if(!data) throw new Error('Прокси вернул не JSON (HTTP ' + resp.status + '): ' + rawResp.slice(0, 400));" +
        "    if(!resp.ok || data.ok === false || pickError(data)){" +
        "      throw new Error(pickError(data) || ('HTTP ' + resp.status + ': ' + rawResp.slice(0, 400)));" +
        "    }" +

        "    var text = pickText(data);" +
        "    if(!text) throw new Error('В ответе сервера нет текста: ' + rawResp.slice(0, 400));" +
        "    var parsed = parseLoose(text);" +
        "    if(!parsed) throw new Error('Модель вернула не JSON: ' + text.slice(0, 400));" +
        "    var list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.results) ? parsed.results : Array.isArray(parsed.answers) ? parsed.answers : [];" +

        "    var marked = 0;" +
        "    list.forEach(function(r){" +
        "      if(!r) return;" +
        "      var cIds = Array.isArray(r.correctIds) ? r.correctIds : (r.correctIds ? [r.correctIds] : []);" +
        "      cIds.forEach(function(id){" +
        "        var inp = document.querySelector('[data-ai-id=\"' + String(id).replace(/[^\\w-]/g, '') + '\"]');" +
        "        if(!inp) return;" +
        "        marked++;" +
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
        "    if(!marked) throw new Error('ИИ не указал ни одного известного варианта. Ответ: ' + text.slice(0, 400));" +

        "    btn.textContent = '✓';" +
        "    setTimeout(function(){ btn.textContent = orig; }, 1800);" +
        "  } catch(e){" +
        "    alert('Ошибка: ' + ((e && e.message) ? e.message : String(e)));" +
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
