// Скрипт панели ИИ. Приложение скачивает его с GitHub при каждом запуске,
// поэтому правки этого файла доходят до телефона без переустановки APK.
(function(){
if(document.getElementById('m-ai-bar')) return;
var DEFAULT_PROXY = 'https://proxy.mariya-bulgakova2004.workers.dev';
var bar = document.createElement('div');
bar.id = 'm-ai-bar';
bar.style = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;gap:8px;align-items:center;';
bar.innerHTML = '<button id="btn-cfg" style="background:#2c2c2e;color:#fff;border:1px solid #555;border-radius:50%;width:36px;height:36px;font:15px sans-serif;">⚙</button>' +
'<button id="btn-g" style="background:#2c2c2e;color:#fff;border:1px solid #555;border-radius:50%;width:36px;height:36px;font:bold 15px sans-serif;">G</button>' +
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
  var k = prompt('1. API-ключи через запятую, пробуются по очереди.\nGemini: AIza…/AQ.…  GitHub: github_pat_…/ghp_…  Mistral: mstrl_…  OpenRouter: sk-or-…  HuggingFace: hf_…  NVIDIA: nvapi-…  Groq: gsk_…  Cerebras: csk-…  DeepSeek: sk-…', loadKeyString());
  if(k !== null){
    saveKeyString(k.trim());
    if(k.trim()) checkKeys(getKeys());
  }
  var p = prompt('2. Адрес твоего воркера Cloudflare:', localStorage.getItem('ai_proxy') || DEFAULT_PROXY);
  if(p !== null) localStorage.setItem('ai_proxy', p.trim().replace(/\/$/, ''));
};
// Конвертация картинок-формул МПГУ в Base64
// Формулы в Moodle — крошечные картинки (20–40 px): увеличиваем в 3–4 раза с белыми полями,
// иначе модель не различает степени, индексы и множители в показателях
function imgToB64(img){
  try {
    var w = img.naturalWidth || img.width || 200, h = img.naturalHeight || img.height || 60;
    var scale = Math.max(1, Math.min(4, 160 / h, 1600 / w)), pad = 24;
    var c = document.createElement('canvas');
    c.width = Math.round(w * scale) + pad * 2;
    c.height = Math.round(h * scale) + pad * 2;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, pad, pad, Math.round(w * scale), Math.round(h * scale));
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
  t = String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(t); } catch(e){}
  var ri = t.lastIndexOf('"results"');
  var a = ri > 0 ? t.lastIndexOf('{', ri) : t.indexOf('{'), b = t.lastIndexOf('}');
  if(a >= 0 && b > a){ try { return JSON.parse(t.slice(a, b + 1)); } catch(e){} }
  return null;
}
function clean(s){ return String(s || '').replace(/\s+/g, ' ').trim(); }
function lsGet(k, def){ try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch(e){ return def; } }
function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function hash(s){ var h = 5381; for(var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + '_' + s.length; }
function short(s){ return String(s || '').replace(/\s+/g, ' ').slice(0, 220); }

// Несколько ключей можно ввести через запятую/пробел — они пробуются по очереди
// Ключи хранятся в самом приложении (одни на все сайты и не пропадают); без нового APK — в localStorage сайта
function bridge(){ try { return window.InfoDa && typeof window.InfoDa.getKeys === 'function' ? window.InfoDa : null; } catch(e){ return null; } }
function loadKeyString(){
  var b = bridge(), local = '';
  try { local = localStorage.getItem('ai_key') || ''; } catch(e){}
  if(!b) return local;
  var s = '';
  try { s = String(b.getKeys() || ''); } catch(e){}
  if(s === '__denied__') return local;
  if(!s && local){ try { b.setKeys(local); } catch(e){} s = local; }
  return s;
}
function saveKeyString(v){
  var b = bridge(), ok = false;
  if(b){ try { var res = b.setKeys(v); ok = res === true || String(res) === 'true'; } catch(e){} }
  try { if(ok) localStorage.removeItem('ai_key'); else localStorage.setItem('ai_key', v); } catch(e){}
}
function getKeys(){ return loadKeyString().split(/[\s,;]+/).filter(Boolean); }
function keyTag(key){ return key.slice(-6); }

// Модели с исчерпанной квотой запоминаются до времени сброса, чтобы не тратить на них время
function isBlocked(tag, model){ return (lsGet('ai_blocked', {})[tag + '|' + model] || 0) > Date.now(); }
function block(tag, model, msg, defMs){
  var ms = defMs || 3600e3;
  var m = /(?:retry|try again) in\s*(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(?:([\d.]+)s)?/i.exec(msg || '');
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
    var r = await tfetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=' + encodeURIComponent(key), {}, 15000);
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
  tick();
  var resp = await tfetch(proxy + '?key=' + encodeURIComponent(key), {
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
  tick();
  var r = await tfetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }, 75000);
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

// Проверка ключей после сохранения: показывает, какие ключи рабочие и сколько моделей видят картинки
async function checkKeys(keys){
  var lines = [];
  for(var i = 0; i < keys.length; i++){
    var key = keys[i], prov = provider(key), name = { gemini: 'Gemini', deepseek: 'DeepSeek' }[prov] || OAI[prov].name;
    var head = name + ' …' + keyTag(key) + ': ';
    try {
      if(prov === 'deepseek'){ lines.push(head + 'проверяется только при запросе (через воркер)'); continue; }
      var url = prov === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=' + encodeURIComponent(key) : (OAI[prov].listUrl || OAI[prov].base + '/models');
      var r = prov === 'gemini' ? await tfetch(url, {}, 15000) : await httpFor(OAI[prov])(url, { headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' } }, 15000);
      var raw = await r.text(), d = null;
      try { d = JSON.parse(raw); } catch(e){}
      if(!r.ok){ lines.push(head + '✕ ' + (pickError(d) || ('HTTP ' + r.status + ' ' + short(raw)))); continue; }
      ['ai_models_' + keyTag(key), 'ai_models_' + prov + keyTag(key)].forEach(function(k){ try { localStorage.removeItem(k); } catch(e){} });
      var list = prov === 'gemini' ? await getModels(key) : await getOaiModels(prov, key);
      var vis = prov === 'gemini' ? list.length : list.filter(function(m){ return m.vision; }).length;
      lines.push(head + '✓ моделей: ' + list.length + ', видят картинки: ' + vis);
    } catch(e){ lines.push(head + '✕ сеть: ' + short(e.message)); }
  }
  alert('Проверка ключей:\n' + lines.join('\n'));
}
// fetch с ограничением по времени — запрос не может «зависнуть» навсегда
function tfetch(url, opts, ms){
  opts = opts || {};
  var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if(ctl) opts.signal = ctl.signal;
  var timer = setTimeout(function(){ if(ctl) ctl.abort(); }, ms || 60000);
  return fetch(url, opts).then(function(r){ clearTimeout(timer); return r; }, function(e){
    clearTimeout(timer);
    throw new Error(e && e.name === 'AbortError' ? 'нет ответа за ' + Math.round((ms || 60000) / 1000) + ' с' : (e && e.message) || String(e));
  });
}
// Запрос через приложение (для API без CORS). Возвращает объект, похожий на Response
var httpSeq = 0, httpWait = {};
window.__infodaHttp = function(id, status, text){ var w = httpWait[id]; if(w){ delete httpWait[id]; w(status, text); } };
function nativeFetch(url, opts, ms){
  var b = bridge();
  if(!b || typeof b.http !== 'function') return Promise.reject(new Error('нужна новая версия приложения (скачайте APK по ссылке и установите поверх)'));
  opts = opts || {};
  return new Promise(function(resolve, reject){
    var id = 'h' + (++httpSeq);
    var timer = setTimeout(function(){ delete httpWait[id]; reject(new Error('нет ответа за ' + Math.round((ms || 90000) / 1000) + ' с')); }, ms || 90000);
    httpWait[id] = function(status, text){
      clearTimeout(timer);
      if(!status) return reject(new Error(text || 'сеть'));
      resolve({ ok: status >= 200 && status < 300, status: status, text: function(){ return Promise.resolve(text); }, json: function(){ return Promise.resolve(JSON.parse(text)); } });
    };
    b.http(id, url, opts.method || 'GET', JSON.stringify(opts.headers || {}), opts.body == null ? null : String(opts.body));
  });
}
// Счётчик попыток на кнопке: видно, что работа идёт
var progressBtn = null, progressN = 0;
function tick(){ progressN++; if(progressBtn) progressBtn.textContent = '…' + progressN; }

// Тип ключа по префиксу
function provider(key){
  if(/^(AIza|AQ\.)/.test(key)) return 'gemini';
  if(/^sk-or-/.test(key)) return 'openrouter';
  if(/^gsk_/.test(key)) return 'groq';
  if(/^(github_pat_|ghp_)/.test(key)) return 'github';
  if(/^nvapi-/.test(key)) return 'nvidia';
  if(/^hf_/.test(key)) return 'huggingface';
  if(/^csk-/.test(key)) return 'cerebras';
  if(/^sk-/.test(key)) return 'deepseek';
  if(/^mstrl_/i.test(key) || /^[A-Za-z0-9]{32}$/.test(key)) return 'mistral';
  return 'gemini';
}
// OpenAI-совместимые API (все разрешают запросы прямо из браузера)
var OAI = {
  groq: { name: 'Groq', base: 'https://api.groq.com/openai/v1',
    fallback: [{ id: 'meta-llama/llama-4-scout-17b-16e-instruct', vision: true }, { id: 'openai/gpt-oss-120b' }, { id: 'llama-3.3-70b-versatile' }] },
  openrouter: { name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', fallback: [] },
  mistral: { name: 'Mistral', base: 'https://api.mistral.ai/v1',
    fallback: [{ id: 'mistral-medium-latest', vision: true }, { id: 'mistral-small-latest', vision: true }] },
  cerebras: { name: 'Cerebras', base: 'https://api.cerebras.ai/v1', fallback: [{ id: 'gpt-oss-120b' }, { id: 'llama-3.3-70b' }] },
  // GitHub Models: GPT-4.1/GPT-4o по токену GitHub; без CORS — запросы идут через приложение
  github: { name: 'GitHub', base: 'https://models.github.ai/inference', listUrl: 'https://models.github.ai/catalog/models', native: true,
    fallback: [{ id: 'openai/gpt-4.1', vision: true }, { id: 'openai/gpt-4o', vision: true }, { id: 'openai/gpt-4.1-mini', vision: true }, { id: 'openai/gpt-4o-mini', vision: true }] },
  nvidia: { name: 'NVIDIA', base: 'https://integrate.api.nvidia.com/v1', native: true,
    fallback: [{ id: 'meta/llama-4-maverick-17b-128e-instruct', vision: true }] },
  huggingface: { name: 'HuggingFace', base: 'https://router.huggingface.co/v1', fallback: [{ id: 'Qwen/Qwen3-VL-30B-A3B-Instruct', vision: true }] }
};
function httpFor(P){ return P.native ? nativeFetch : tfetch; }
function sizeOf(id){ var m = /(\d+)b\b/i.exec(id); return m ? +m[1] : 0; }
async function getOaiModels(prov, key){
  var P = OAI[prov], ck = 'ai_models_' + prov + keyTag(key), cache = lsGet(ck, null);
  if(cache && cache.ts > Date.now() - 86400e3 && cache.list && cache.list.length) return cache.list;
  var list = [];
  try {
    var r = await httpFor(P)(P.listUrl || (P.base + '/models'), { headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' } }, 15000);
    var d = await r.json(), arr = Array.isArray(d) ? d : d && Array.isArray(d.data) ? d.data : [];
    if(prov === 'github'){
      var pref = function(id){ return /gpt-5(?!.*nano)|gpt-4\.1(?!-)|gpt-4o(?!-)/.test(id) ? 3 : /gpt-4\.1-mini|gpt-4o-mini|gpt-5.*mini/.test(id) ? 2 : /llama-4|grok|phi-4-multimodal|mistral-medium/.test(id) ? 1 : 0; };
      list = arr.filter(function(m){ return m && m.id && (m.supported_input_modalities || []).indexOf('text') >= 0 && !/embed/.test(m.id); })
        .map(function(m){ return { id: m.id, vision: (m.supported_input_modalities || []).indexOf('image') >= 0, w: pref(m.id) }; })
        .sort(function(a, b){ return (b.vision - a.vision) || (b.w - a.w); });
    } else if(prov === 'huggingface'){
      list = arr.filter(function(m){ return m && m.id && (m.providers || []).some(function(p){ return p.status === 'live'; }); })
        .map(function(m){ var mods = m.architecture && m.architecture.input_modalities || []; return { id: m.id, vision: mods.indexOf('image') >= 0 }; })
        .sort(function(a, b){ return (b.vision - a.vision) || (sizeOf(b.id) - sizeOf(a.id)); });
    } else if(prov === 'openrouter'){
      list = arr.filter(function(m){ return m && m.id && (/:free$/.test(m.id) || (m.pricing && +m.pricing.prompt === 0 && +m.pricing.completion === 0 && m.id !== 'openrouter/auto')); })
        .map(function(m){ var mods = m.architecture && m.architecture.input_modalities || []; return { id: m.id, vision: mods.indexOf('image') >= 0, ctx: m.context_length || 0 }; })
        .sort(function(a, b){ return (b.vision - a.vision) || (b.ctx - a.ctx); });
    } else if(prov === 'mistral'){
      list = arr.filter(function(m){ return m && m.id && (!m.capabilities || m.capabilities.completion_chat) && !/embed|moderation|ocr|transcri|voxtral|codestral|devstral|saba/.test(m.id) && /latest$/.test(m.id); })
        .map(function(m){ return { id: m.id, vision: !!(m.capabilities && m.capabilities.vision), w: /magistral/.test(m.id) ? -1 : /^mistral-medium/.test(m.id) ? 4 : /^mistral-large|^pixtral-large/.test(m.id) ? 3 : /small/.test(m.id) ? 1 : 0 }; })
        .sort(function(a, b){ return (b.vision - a.vision) || (b.w - a.w); });
    } else {
      list = arr.filter(function(m){ return m && m.id && m.active !== false && !/whisper|tts|guard|playai|orpheus|distil|compound|allam|embed|rerank|parse|safety|reward|retriever|clip|deplot/i.test(m.id); })
        .map(function(m){ return { id: m.id, vision: /llama-4|vision|scout|maverick|-vl\b|vl-|multimodal|vila/i.test(m.id) }; })
        .sort(function(a, b){ return (b.vision - a.vision) || (sizeOf(b.id) - sizeOf(a.id)); });
    }
  } catch(e){}
  if(!list.length) return P.fallback;
  lsSet(ck, { ts: Date.now(), list: list.slice(0, 15) });
  return list;
}
function partsToText(parts){
  return parts.map(function(p){ return typeof p.text === 'string' ? p.text : '[картинка-формула]'; }).join('\n');
}
async function callOai(prov, key, model, parts, useImg){
  var content = useImg ? parts.map(function(p){
    if(!p.inlineData) return { type: 'text', text: p.text };
    var url = 'data:' + p.inlineData.mimeType + ';base64,' + p.inlineData.data;
    return { type: 'image_url', image_url: prov === 'mistral' ? url : { url: url } };
  }) : partsToText(parts);
  var headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key };
  if(prov === 'openrouter') headers['X-Title'] = 'InfoDa';
  tick();
  var r = await httpFor(OAI[prov])(OAI[prov].base + '/chat/completions', {
    method: 'POST', headers: headers,
    body: JSON.stringify({ model: model, messages: [{ role: 'user', content: content }], temperature: 0.1 })
  }, 75000);
  var raw = await r.text(), d = null;
  try { d = JSON.parse(raw); } catch(e){}
  var err = pickError(d) || (r.ok ? '' : 'HTTP ' + r.status + ': ' + short(raw));
  var text = err ? '' : pickText(d);
  if(!err && !text) err = 'пустой ответ';
  return { status: r.status, text: text, error: err };
}
async function askOai(prov, key, parts, accept){
  var P = OAI[prov], tag = keyTag(key), list = await getOaiModels(prov, key);
  var hasImg = parts.some(function(p){ return p.inlineData; });
  var tries = 0, limited = [], other = [], blind = 0;
  for(var i = 0; i < list.length && tries < 6; i++){
    var m = list[i];
    // Формулы в картинках: модель без зрения только угадывает — такие не используем
    if(hasImg && !m.vision){ blind++; continue; }
    if(isBlocked(tag, m.id)){ limited.push(m.id); continue; }
    tries++;
    var r;
    try { r = await callOai(prov, key, m.id, parts, hasImg); }
    catch(e){
      // Модель не уложилась во время — пробуем следующую; другая сетевая ошибка — следующий ключ
      if(/нет ответа/.test(e.message)){ other.push(m.id + ': ' + e.message); continue; }
      other.push('сеть: ' + short(e.message)); break;
    }
    if(r.text){
      if(accept(r.text)) return { text: r.text, model: P.name + ' ' + m.id };
      other.push(m.id + ': не выбрала ни одного варианта');
      continue;
    }
    if(hasImg && r.status === 400 && /image|vision|multimodal/i.test(r.error)){ block(tag, m.id, '', 7 * 86400e3); continue; }
    var msg = r.error;
    if(/free-models-per-day/i.test(msg)){ block(tag, '*', '', 6 * 3600e3); limited.push('дневной лимит бесплатных моделей'); break; }
    if(r.status === 429 || /quota|rate limit|exhausted/i.test(msg)){ block(tag, m.id, msg); limited.push(m.id); continue; }
    if(r.status === 404 || /not found|does not exist|decommission|deprecat|not supported/i.test(msg)){ block(tag, m.id, '', 86400e3); continue; }
    if(r.status === 401 || r.status === 403 || /invalid api key|unauthori|no auth|api key/i.test(msg)){ block(tag, '*', '', 600e3); other.push('ключ не принят: ' + short(msg)); break; }
    other.push(m.id + ': ' + short(msg));
  }
  var line = '';
  if(limited.length) line += 'лимиты исчерпаны (' + limited.join(', ') + ')';
  if(other.length) line += (line ? '; ' : '') + other.join('; ');
  if(!line && blind) line = 'нет моделей, которые видят картинки-формулы';
  throw new Error(line || 'нет доступных моделей');
}

// Порядок провайдеров: сначала те, что лучше всего читают формулы-картинки
var PROVIDER_ORDER = { gemini: 0, github: 1, mistral: 2, openrouter: 3, huggingface: 4, nvidia: 5, groq: 6, cerebras: 7, deepseek: 8 };
async function askAI(keys, parts, accept){
  var errors = [];
  keys = keys.slice().sort(function(a, b){ return PROVIDER_ORDER[provider(a)] - PROVIDER_ORDER[provider(b)]; });
  for(var ki = 0; ki < keys.length; ki++){
    var key = keys[ki], tag = keyTag(key), name = 'Ключ …' + tag, prov = provider(key);
    if(prov === 'deepseek'){
      try {
        var ds = await callProxy(key, parts);
        if(accept(ds.text)) return ds;
        errors.push(name + ' (DeepSeek): не выбрала ни одного варианта');
      } catch(e){ errors.push(name + ' (DeepSeek): ' + short(e.message)); }
      continue;
    }
    if(isBlocked(tag, '*')){ errors.push(name + ': временно пропущен (ключ не принят или дневной лимит)'); continue; }
    if(OAI[prov]){
      try { return await askOai(prov, key, parts, accept); } catch(e){ errors.push(name + ' (' + OAI[prov].name + '): ' + short(e.message)); }
      continue;
    }
    var models = await getModels(key), tries = 0, limited = [], other = [];
    for(var mi = 0; mi < models.length && tries < 8; mi++){
      var model = models[mi];
      if(isBlocked(tag, model)){ limited.push(model); continue; }
      tries++;
      var r;
      try { r = await callGemini(key, model, parts); }
      catch(e){
        if(/нет ответа/.test(e.message)){ other.push(model + ': ' + e.message); continue; }
        // Сеть/CORS не пустили напрямую — пробуем через воркер
        try { return await callProxy(key, parts); } catch(e2){ other.push(short(e2.message)); }
        break;
      }
      if(r.text){
        if(accept(r.text)) return { text: r.text, model: model };
        other.push(model + ': не выбрала ни одного варианта');
        continue;
      }
      var msg = r.error;
      if(r.status === 429 || /quota|exhausted|rate limit/i.test(msg)){ block(tag, model, msg); limited.push(model); continue; }
      if(r.status === 404 || /not found|deprecat|no longer|not supported|update your code/i.test(msg)){ block(tag, model, '', 86400e3); continue; }
      if(r.status === 401 || r.status === 403 || /api key|api_key|permission/i.test(msg)){ block(tag, '*', '', 600e3); other.push('ключ не принят: ' + short(msg)); break; }
      other.push(model + ': ' + short(msg));
    }
    var line = name + ' (Gemini): ';
    if(limited.length) line += 'лимиты исчерпаны (' + limited.join(', ') + ')';
    if(other.length) line += (limited.length ? '; ' : '') + other.join('; ');
    if(!limited.length && !other.length) line += 'нет доступных моделей';
    errors.push(line);
  }
  throw new Error('Не удалось получить ответ.\n' + errors.join('\n'));
}

var INSTRUCTION = 'Ты решаешь тест Moodle (математика, теория вероятностей и др.). Для каждого вопроса выбери id правильных вариантов. ' +
  'Если inputType=radio — ровно один id, если checkbox — все верные id. Картинки после текста — формулы к соответствующему вопросу или варианту. ' +
  'Формулы на картинках читай очень внимательно: степени (², ³), коэффициенты в знаменателях (σ² или 2σ²), пределы интегралов, множители перед корнем. ' +
  'В поле solution СНАЧАЛА перепиши формулу вопроса и формулы ВСЕХ вариантов в LaTeX (по одной на строку, с id), ' +
  'потом реши задачу по стандартным определениям и формулам и сравни свой результат с каждым переписанным вариантом символ за символом. ' +
  'correctIds никогда не оставляй пустым — если не уверена, выбери наиболее вероятный вариант. ' +
  'Верни ТОЛЬКО JSON: {"results":[{"questionIndex":0,"solution":"...","correctIds":["q0_opt0"]}]}\n';

var inflight = {};
async function runAI(mode){
  var keys = getKeys();
  if(!keys.length){ document.getElementById('btn-cfg').click(); keys = getKeys(); if(!keys.length) return; }
// sk- = DeepSeek (только текст), всё остальное (AIza..., AQ. ...) = Gemini (текст + картинки)
  var withImages = keys.some(function(k){ return provider(k) !== 'deepseek'; });
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
      var alt = clean(im.alt || im.title || '');
      if(b64){ parts.push({ text: label + (alt ? ' (подпись картинки: ' + alt + ')' : '') + ':' }); parts.push({ inlineData: { mimeType: 'image/png', data: b64 } }); }
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
    var accept = function(t){
      var pj = parseLoose(t), arr = !pj ? [] : Array.isArray(pj) ? pj : Array.isArray(pj.results) ? pj.results : Array.isArray(pj.answers) ? pj.answers : [];
      return arr.some(function(r){ var c = r && (Array.isArray(r.correctIds) ? r.correctIds : r.correctIds ? [r.correctIds] : []); return c.some(function(id){ return !!document.querySelector('[data-ai-id="' + String(id).replace(/[^\w-]/g, '') + '"]'); }); });
    };
    // Одна страница — один запрос: если «Точки» и «Авто» нажаты подряд, обе кнопки ждут один и тот же ответ
    progressBtn = btn; progressN = 0;
    var res;
    if(hit) res = { text: hit.text, model: hit.model + ' (кэш)' };
    else {
      if(!inflight[ck]) inflight[ck] = askAI(keys, parts, accept).finally(function(){ delete inflight[ck]; });
      res = await inflight[ck];
    }
    cache = lsGet('ai_cache', {});
    hit = cache[ck];
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

// Кнопка G: копирует вопрос с вариантами и открывает поиск Google в режиме ИИ (во внешнем браузере, тест не закрывается)
function altOf(el){ return [].map.call(el.querySelectorAll('img'), function(im){ return clean(im.alt || im.title || ''); }).filter(Boolean).join(' '); }
function questionsAsText(){
  var out = [];
  document.querySelectorAll('.que').forEach(function(q){
    var qEl = q.querySelector('.qtext') || q;
    var t = clean(qEl.innerText), a = altOf(qEl);
    if(a) t += ' ' + a;
    else if(qEl.querySelector('img')) t += ' (в вопросе есть формула-картинка)';
    var opts = [];
    q.querySelectorAll('.answer .r0, .answer .r1').forEach(function(row){
      var inp = row.querySelector('input[type="radio"], input[type="checkbox"]');
      if(!inp) return;
      var lbl = row.querySelector('[data-region="answer-label"]') || row;
      var o = clean(lbl.innerText), oa = altOf(lbl);
      opts.push(String.fromCharCode(1072 + opts.length) + ') ' + clean(o + ' ' + oa));
    });
    var multi = !!q.querySelector('.answer input[type="checkbox"]');
    out.push(t + '\nВарианты: ' + opts.join('; ') + '\n' + (multi ? 'Какие варианты правильные (может быть несколько)?' : 'Какой вариант правильный?'));
  });
  return out.join('\n\n');
}
function copyText(t){
  var b = bridge();
  if(b && typeof b.copy === 'function'){ try { b.copy(t); return true; } catch(e){} }
  try {
    var ta = document.createElement('textarea');
    ta.value = t; ta.style = 'position:fixed;top:-1000px;opacity:0;';
    document.body.appendChild(ta); ta.select();
    var ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch(e){ return false; }
}
document.getElementById('btn-g').onclick = function(){
  var t = questionsAsText();
  if(!t){ alert('На этой странице не найдено вопросов (.que)'); return; }
  copyText(t);
  var url = 'https://www.google.com/search?udm=50&q=' + encodeURIComponent(t.slice(0, 1800));
  var b = bridge();
  if(b && typeof b.openExternal === 'function') b.openExternal(url);
  else alert('Вопрос скопирован. Откройте Google и вставьте его.\n(Чтобы кнопка сама открывала Google, обновите приложение.)');
};
document.getElementById('btn-dots').onclick = function(){ runAI('dots'); };
document.getElementById('btn-auto').onclick = function(){ runAI('auto'); };
})();
