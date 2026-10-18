// Скрипт панели ИИ. Приложение скачивает его с GitHub при каждом запуске,
// поэтому правки этого файла доходят до телефона без переустановки APK.
(function(){
if(document.getElementById('m-ai-bar')) return;
var DEFAULT_PROXY = 'https://proxy.mariya-bulgakova2004.workers.dev';
var bar = document.createElement('div');
bar.id = 'm-ai-bar';
bar.style = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;gap:8px;align-items:center;';
bar.innerHTML = '<button id="btn-cfg" style="background:#2c2c2e;color:#fff;border:1px solid #555;border-radius:50%;width:36px;height:36px;font:15px sans-serif;">⚙</button>' +
'<button id="btn-dots" style="background:#2c2c2e;color:#fff;border:1px solid #555;border-radius:18px;padding:8px 16px;font:bold 13px sans-serif;">· Точки</button>' +
'<button id="btn-auto" style="background:#0a84ff;color:#fff;border:none;border-radius:18px;padding:8px 16px;font:bold 13px sans-serif;">⚡ Авто</button>';
document.body.appendChild(bar);
// Двойной тап в левом нижнем углу — спрятать/показать кнопки
var hz = document.createElement('div');
hz.id = 'm-ai-hz';
hz.style = 'position:fixed;bottom:0;left:0;width:45px;height:45px;z-index:2147483646;';
var lt = 0; hz.ontouchend = function(){ var n=Date.now(); if(n-lt<350) bar.style.display=(bar.style.display==='none'?'flex':'none'); lt=n; };
document.body.appendChild(hz);
document.getElementById('btn-cfg').onclick = function(){
  var k = prompt('1. API-ключи через запятую (AIza... / AQ.... = Gemini, sk-... = DeepSeek). Пробуются по очереди:', localStorage.getItem('ai_key') || '');
  if(k !== null) localStorage.setItem('ai_key', k.trim());
  var p = prompt('2. Адрес твоего воркера Cloudflare:', localStorage.getItem('ai_proxy') || DEFAULT_PROXY);
  if(p !== null) localStorage.setItem('ai_proxy', p.trim().replace(/\/$/, ''));
};
// Конвертация картинок-формул МПГУ в Base64
function imgToB64(img){
  try {
    var c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width || 200;
    c.height = img.naturalHeight || img.height || 60;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  } catch(e){ return null; }
}
// Достаём текст из ответа воркера/Gemini. Все обращения к [0] — только после проверок
function pickText(d){
  if(!d || typeof d !== 'object') return '';
  if(typeof d.text === 'string') return d.text;
  var c = Array.isArray(d.candidates) ? d.candidates[0] : null;
  var p = c && c.content && Array.isArray(c.content.parts) ? c.content.parts : [];
  var t = p.map(function(x){ return x && typeof x.text === 'string' && !x.thought ? x.text : ''; }).join('');
  if(t) return t;
  var ch = Array.isArray(d.choices) ? d.choices[0] : null;
  return ch && ch.message && typeof ch.message.content === 'string' ? ch.message.content : '';
}
function pickError(d){
  if(!d || typeof d !== 'object') return '';
  var e = d.error;
  if(!e) return '';
  if(typeof e === 'string') return e;
  return e.message ? String(e.message) : JSON.stringify(e);
}
// Разбор JSON от модели: срезаем ```json-обёртки и лишний текст вокруг объекта
function parseLoose(t){
  t = String(t || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(t); } catch(e){}
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  if(a >= 0 && b > a){ try { return JSON.parse(t.slice(a, b + 1)); } catch(e){} }
  return null;
}
function clean(s){ return String(s || '').replace(/\s+/g, ' ').trim(); }
function lsGet(k, def){ try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch(e){ return def; } }
function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function hash(s){ var h = 5381; for(var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + '_' + s.length; }
function short(s){ return String(s || '').replace(/\s+/g, ' ').slice(0, 220); }

// Несколько ключей можно ввести через запятую/пробел — они пробуются по очереди
function getKeys(){ return (localStorage.getItem('ai_key') || '').split(/[\s,;]+/).filter(Boolean); }
function keyTag(key){ return key.slice(-6); }

// Модели с исчерпанной квотой запоминаются до времени сброса, чтобы не тратить на них время
function isBlocked(tag, model){ return (lsGet('ai_blocked', {})[tag + '|' + model] || 0) > Date.now(); }
function block(tag, model, msg, defMs){
  var ms = defMs || 3600e3;
  var m = /retry in\s*(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(?:([\d.]+)s)?/i.exec(msg || '');
  if(m && (m[1] || m[2] || m[3])) ms = ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) * 1000 + 5000;
  var b = lsGet('ai_blocked', {}), now = Date.now();
  Object.keys(b).forEach(function(k){ if(b[k] < now) delete b[k]; });
  b[tag + '|' + model] = now + ms;
  var real = /model:\s*([\w.\-]+)/i.exec(msg || '');
  if(real) b[tag + '|' + real[1]] = now + ms;
  lsSet('ai_blocked', b);
}

var FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemma-3-27b-it', 'gemma-3-12b-it'];
// Порядок: свежие flash → flash-lite → pro → gemma (у gemma отдельная большая бесплатная квота)
function modelRank(n){
  if(/gemma/.test(n)) return 3;
  if(/flash-lite/.test(n)) return 1;
  if(/flash/.test(n)) return 0;
  return 2;
}
function modelVer(n){ var m = /(\d+(?:\.\d+)?)/.exec(n.replace(/^gemma-/, 'gemma-0')); var size = /(\d+)b/.exec(n); return (m ? parseFloat(m[1]) : 0) * 1000 + (size ? +size[1] : 0); }
async function getModels(key){
  var tag = keyTag(key), cache = lsGet('ai_models_' + tag, null);
  if(cache && cache.ts > Date.now() - 86400e3 && cache.list && cache.list.length) return cache.list;
  try {
    var r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=' + encodeURIComponent(key));
    var d = await r.json();
    var list = (d && Array.isArray(d.models) ? d.models : [])
      .filter(function(m){ return m && Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.indexOf('generateContent') >= 0; })
      .map(function(m){ return String(m.name || '').replace(/^models\//, ''); })
      .filter(function(n){ return /^(gemini|gemma)/.test(n) && !/embed|aqa|image|tts|audio|live|native|imagen|veo|robotics|computer|learnlm|nano|-e\d+b|-1b/.test(n); });
    list.sort(function(a, b){ return modelRank(a) - modelRank(b) || modelVer(b) - modelVer(a) || a.length - b.length; });
    if(list.length){
      list = list.filter(function(n){ return n !== 'gemini-3.8-flash'; });
      list.unshift('gemini-3.8-flash');
      lsSet('ai_models_' + tag, { ts: Date.now(), list: list });
      return list;
    }
  } catch(e){}
  return FALLBACK_MODELS;
}

// Запрос через воркер Cloudflare (нужен для DeepSeek и как запасной путь)
async function callProxy(key, parts){
  var proxy = localStorage.getItem('ai_proxy') || DEFAULT_PROXY;
  var resp = await fetch(proxy + '?key=' + encodeURIComponent(key), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ parts: parts })
  });
  var raw = await resp.text(), data = null;
  try { data = JSON.parse(raw); } catch(e){}
  if(!data) throw new Error('прокси вернул не JSON (HTTP ' + resp.status + '): ' + short(raw));
  if(!resp.ok || data.ok === false || pickError(data)) throw new Error(pickError(data) || ('HTTP ' + resp.status + ': ' + short(raw)));
  var text = pickText(data);
  if(!text) throw new Error('в ответе нет текста: ' + short(raw));
  return { text: text, model: data.model || 'proxy' };
}

// Прямой запрос к Google Gemini API (CORS разрешён), без воркера
async function callGemini(key, model, parts){
  var gemma = /gemma/.test(model);
  var body = {
    contents: [{ role: 'user', parts: parts }],
    generationConfig: gemma ? { temperature: 0.1 } : { responseMimeType: 'application/json', temperature: 0.1 }
  };
  var r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  var raw = await r.text(), d = null;
  try { d = JSON.parse(raw); } catch(e){}
  var err = pickError(d) || (r.ok ? '' : 'HTTP ' + r.status + ': ' + short(raw));
  var text = err ? '' : pickText(d);
  if(!err && !text){
    var c = d && Array.isArray(d.candidates) ? d.candidates[0] : null;
    err = d && d.promptFeedback && d.promptFeedback.blockReason ? 'запрос заблокирован (' + d.promptFeedback.blockReason + ')' : 'пустой ответ' + (c && c.finishReason ? ' (' + c.finishReason + ')' : '');
  }
  return { status: r.status, text: text, error: err };
}

async function askAI(keys, parts){
  var errors = [];
  for(var ki = 0; ki < keys.length; ki++){
    var key = keys[ki], tag = keyTag(key), name = 'Ключ …' + tag;
    if(key.indexOf('sk-') === 0){
      try { return await callProxy(key, parts); } catch(e){ errors.push(name + ' (DeepSeek): ' + short(e.message)); }
      continue;
    }
    if(isBlocked(tag, '*')){ errors.push(name + ': ключ не принят Google (пропущен)'); continue; }
    var models = await getModels(key), tries = 0, limited = [], other = [];
    for(var mi = 0; mi < models.length && tries < 8; mi++){
      var model = models[mi];
      if(isBlocked(tag, model)){ limited.push(model); continue; }
      tries++;
      var r;
      try { r = await callGemini(key, model, parts); }
      catch(e){
        // Сеть/CORS не пустили напрямую — пробуем через воркер
        try { return await callProxy(key, parts); } catch(e2){ other.push(short(e2.message)); }
        break;
      }
      if(r.text) return { text: r.text, model: model };
      var msg = r.error;
      if(r.status === 429 || /quota|exhausted|rate limit/i.test(msg)){ block(tag, model, msg); limited.push(model); continue; }
      if(r.status === 404 || /not found|deprecat|no longer|not supported|update your code/i.test(msg)){ block(tag, model, '', 86400e3); continue; }
      if(r.status === 401 || r.status === 403 || /api key|api_key|permission/i.test(msg)){ block(tag, '*', '', 600e3); other.push('ключ не принят: ' + short(msg)); break; }
      other.push(model + ': ' + short(msg));
    }
    var line = name + ': ';
    if(limited.length) line += 'лимиты исчерпаны (' + limited.join(', ') + ')';
    if(other.length) line += (limited.length ? '; ' : '') + other.join('; ');
    if(!limited.length && !other.length) line += 'нет доступных моделей';
    errors.push(line);
  }
  throw new Error('Не удалось получить ответ.\n' + errors.join('\n'));
}

var INSTRUCTION = 'Ты решаешь тест Moodle (математика, теория вероятностей и др.). Для каждого вопроса выбери id правильных вариантов. ' +
  'Если inputType=radio — ровно один id, если checkbox — все верные id. Картинки после текста — формулы к соответствующему вопросу или варианту. ' +
  'Верни ТОЛЬКО JSON без пояснений: {"results":[{"questionIndex":0,"correctIds":["q0_opt0"]}]}\n';

async function runAI(mode){
  var keys = getKeys();
  if(!keys.length){ document.getElementById('btn-cfg').click(); keys = getKeys(); if(!keys.length) return; }
// sk- = DeepSeek (только текст), всё остальное (AIza..., AQ. ...) = Gemini (текст + картинки)
  var withImages = keys.some(function(k){ return k.indexOf('sk-') !== 0; });
  var btn = mode === 'auto' ? document.getElementById('btn-auto') : document.getElementById('btn-dots');
  var orig = btn.getAttribute('data-orig') || btn.textContent;
  btn.setAttribute('data-orig', orig);
  btn.textContent = '…';
  document.querySelectorAll('.ai-stealth-dot').forEach(function(e){ e.remove(); });
  var qBlocks = document.querySelectorAll('.que');
  if(!qBlocks.length){ alert('На этой странице не найдено вопросов (.que)'); btn.textContent = orig; return; }
  var parts = [{ text: INSTRUCTION }];
  var optCount = 0;
  function addImages(el, label){
    el.querySelectorAll('img').forEach(function(im){
      var b64 = withImages ? imgToB64(im) : null;
      if(b64){ parts.push({ text: label + ':' }); parts.push({ inlineData: { mimeType: 'image/png', data: b64 } }); }
      else parts.push({ text: label + ': [картинка-формула ' + clean(im.alt || (im.src || '').split('/').pop()) + ']' });
    });
  }
  qBlocks.forEach(function(q, qi){
    var qEl = q.querySelector('.qtext') || q;
    parts.push({ text: '\n=== Вопрос ' + qi + ' ===\n' + clean(qEl.innerText) });
    addImages(qEl, 'Формула к вопросу ' + qi);
    q.querySelectorAll('.answer .r0, .answer .r1').forEach(function(row, oi){
      var inp = row.querySelector('input[type="radio"], input[type="checkbox"]');
      if(!inp) return;
      var id = 'q' + qi + '_opt' + oi;
      inp.setAttribute('data-ai-id', id);
      var lbl = row.querySelector('[data-region="answer-label"]') || row;
      parts.push({ text: 'Вариант ' + id + ' (inputType=' + inp.type + '): ' + clean(lbl.innerText) });
      addImages(lbl, 'Формула варианта ' + id);
      optCount++;
    });
  });
  if(!optCount){ alert('Не найдено вариантов ответа (radio/checkbox) в вопросах'); btn.textContent = orig; return; }
  try {
    // Кэш: повторное нажатие (Точки → Авто) на той же странице не тратит запрос
    var ck = hash(JSON.stringify(parts));
    var cache = lsGet('ai_cache', {});
    var hit = cache[ck];
    var res = hit ? { text: hit.text, model: hit.model + ' (кэш)' } : await askAI(keys, parts);
    var text = res.text;
    var parsed = parseLoose(text);
    if(!parsed) throw new Error('Модель ' + res.model + ' вернула не JSON: ' + short(text));
    var list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.results) ? parsed.results : Array.isArray(parsed.answers) ? parsed.answers : [];
    var marked = 0;
    list.forEach(function(r){
      if(!r) return;
      var cIds = Array.isArray(r.correctIds) ? r.correctIds : (r.correctIds ? [r.correctIds] : []);
      cIds.forEach(function(id){
        var inp = document.querySelector('[data-ai-id="' + String(id).replace(/[^\w-]/g, '') + '"]');
        if(!inp) return;
        marked++;
        var row = inp.closest('.r0, .r1') || inp.parentElement;
        if(mode === 'auto'){
          if(inp.disabled) row.style.outline = '1px dashed #30d158';
          else if(!inp.checked){ inp.click(); inp.dispatchEvent(new Event('change', {bubbles:true})); }
        } else {
          var dot = document.createElement('span');
          dot.className = 'ai-stealth-dot';
          dot.style = 'display:inline-block;width:5px;height:5px;border-radius:50%;background:#777;opacity:0.65;margin-left:8px;align-self:center;flex-shrink:0;';
          row.appendChild(dot);
        }
      });
    });
    if(!marked) throw new Error('Модель ' + res.model + ' не указала ни одного известного варианта. Ответ: ' + short(text));
    if(!hit){
      cache[ck] = { text: text, model: res.model, ts: Date.now() };
      var ks = Object.keys(cache).sort(function(a, b){ return cache[b].ts - cache[a].ts; });
      ks.slice(30).forEach(function(k){ delete cache[k]; });
      lsSet('ai_cache', cache);
    }
    btn.title = res.model;
    btn.textContent = '✓';
    setTimeout(function(){ btn.textContent = orig; }, 1800);
  } catch(e){
    alert('Ошибка: ' + ((e && e.message) ? e.message : String(e)));
    btn.textContent = '✕';
    setTimeout(function(){ btn.textContent = orig; }, 2000);
  }
}
document.getElementById('btn-dots').onclick = function(){ runAI('dots'); };
document.getElementById('btn-auto').onclick = function(){ runAI('auto'); };
})();
