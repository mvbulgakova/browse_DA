/*
 * Прокси для InfoDa Browser.
 *
 * ЗАПРОС (единый для любых ключей):
 *   POST <worker>?key=<API_KEY>
 *   { "parts": [ { "text": "..." }, { "inlineData": { "mimeType": "image/png", "data": "<base64>" } }, ... ] }
 *   (для совместимости также принимаются старые форматы: Gemini "contents" и OpenAI "messages")
 *
 * ОТВЕТ (всегда JSON, всегда одна и та же форма):
 *   успех:  { "ok": true,  "provider": "gemini"|"deepseek", "model": "...", "text": "<ответ модели>" }
 *   ошибка: { "ok": false, "provider": "...", "status": 400, "error": "<понятный текст ошибки>" }
 *
 * Тип ключа: "sk-..." → DeepSeek, всё остальное (AIza..., AQ. ...) → Gemini.
 * Список моделей Gemini можно переопределить переменной окружения GEMINI_MODELS (через запятую).
 */

const DEFAULT_GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest'];
const DEEPSEEK_MODEL = 'deepseek-chat';

const SYSTEM_PROMPT =
  'Ты решаешь тест Moodle. Для каждого вопроса выбери id правильных вариантов. ' +
  'Если inputType=radio — ровно один id, если checkbox — все верные id. ' +
  'Верни ТОЛЬКО валидный JSON формата: {"results":[{"questionIndex":0,"correctIds":["q0_opt0"]}]}';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function reply(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function fail(provider, status, error) {
  return reply({ ok: false, provider, status, error: String(error || 'Неизвестная ошибка') }, status >= 400 ? status : 502);
}

// Приводим любой входящий формат к массиву parts: [{text}|{inlineData}]
function normalizeParts(body) {
  if (!body || typeof body !== 'object') return [];
  if (Array.isArray(body.parts)) return body.parts;
  if (Array.isArray(body.contents)) {
    const out = [];
    body.contents.forEach(c => (c && Array.isArray(c.parts) ? c.parts : []).forEach(p => out.push(p)));
    return out;
  }
  if (Array.isArray(body.messages)) {
    return body.messages
      .filter(m => m && m.role !== 'system')
      .map(m => ({ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }));
  }
  if (typeof body.prompt === 'string') return [{ text: body.prompt }];
  return [];
}

// Читаем ответ upstream как текст и пытаемся разобрать JSON, не падая на HTML-страницах ошибок
async function readUpstream(res) {
  const raw = await res.text();
  try {
    return { json: JSON.parse(raw), raw };
  } catch (e) {
    return { json: null, raw };
  }
}

function upstreamError(json, raw) {
  if (json && json.error) {
    if (typeof json.error === 'string') return json.error;
    if (json.error.message) return json.error.message;
    return JSON.stringify(json.error);
  }
  if (json) return JSON.stringify(json).slice(0, 500);
  return (raw || '').slice(0, 500) || 'Пустой ответ сервера';
}

async function callDeepSeek(key, parts) {
  const userText = parts
    .map(p => (p && typeof p.text === 'string' ? p.text : p && (p.inlineData || p.inline_data) ? '[картинка-формула недоступна]' : ''))
    .filter(Boolean)
    .join('\n');

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  const { json, raw } = await readUpstream(res);
  if (!res.ok || !json || json.error) {
    return fail('deepseek', res.ok ? 502 : res.status, 'DeepSeek: ' + upstreamError(json, raw));
  }
  const choice = Array.isArray(json.choices) ? json.choices[0] : null;
  const text = choice && choice.message && typeof choice.message.content === 'string' ? choice.message.content : '';
  if (!text) return fail('deepseek', 502, 'DeepSeek вернул пустой ответ: ' + JSON.stringify(json).slice(0, 300));
  return reply({ ok: true, provider: 'deepseek', model: json.model || DEEPSEEK_MODEL, text });
}

// Ошибки, при которых имеет смысл попробовать следующую модель из списка
function shouldFallback(status, message) {
  if (status === 404 || status === 429 || status === 500 || status === 503) return true;
  return /not found|deprecat|no longer|not supported|update your code|overloaded|unavailable/i.test(message || '');
}

async function callGemini(key, parts, models) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  };

  let lastError = 'Нет доступных моделей Gemini';
  let lastStatus = 502;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const { json, raw } = await readUpstream(res);

    if (!res.ok || !json || json.error) {
      lastStatus = res.ok ? 502 : res.status;
      lastError = `Gemini (${model}): ` + upstreamError(json, raw);
      if (shouldFallback(res.status, lastError)) continue;
      return fail('gemini', lastStatus, lastError);
    }

    const cand = Array.isArray(json.candidates) ? json.candidates[0] : null;
    const cParts = cand && cand.content && Array.isArray(cand.content.parts) ? cand.content.parts : [];
    const text = cParts
      .filter(p => p && typeof p.text === 'string' && !p.thought)
      .map(p => p.text)
      .join('');

    if (!text) {
      const block = json.promptFeedback && json.promptFeedback.blockReason;
      const reason = block ? 'запрос заблокирован (' + block + ')' : cand && cand.finishReason ? 'finishReason=' + cand.finishReason : 'пустой ответ';
      return fail('gemini', 502, `Gemini (${model}): ${reason}`);
    }
    return reply({ ok: true, provider: 'gemini', model, text });
  }

  return fail('gemini', lastStatus, lastError);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return fail('proxy', 405, 'Нужен POST-запрос');

    try {
      const key = (new URL(request.url).searchParams.get('key') || '').trim();
      if (!key) return fail('proxy', 400, 'Не передан API-ключ (?key=...)');

      let body;
      try {
        body = JSON.parse(await request.text());
      } catch (e) {
        return fail('proxy', 400, 'Тело запроса не является JSON');
      }

      const parts = normalizeParts(body).filter(p => p && (typeof p.text === 'string' || p.inlineData || p.inline_data));
      if (!parts.length) return fail('proxy', 400, 'Пустой запрос: нет ни текста, ни картинок');

      if (key.startsWith('sk-')) return await callDeepSeek(key, parts);

      const models = ((env && env.GEMINI_MODELS) || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      return await callGemini(key, parts, models.length ? models : DEFAULT_GEMINI_MODELS);
    } catch (e) {
      return fail('proxy', 500, 'Ошибка воркера: ' + (e && e.message ? e.message : e));
    }
  },
};
