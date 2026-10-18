export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      const url = new URL(request.url);
      const key = (url.searchParams.get('key') || '').trim();
      const rawBody = await request.json();

      // 1. Если это DeepSeek
      if (key.startsWith('sk-')) {
        let promptText = "";
        if (rawBody.contents && rawBody.contents[0]) {
          promptText = rawBody.contents[0].parts[0].text;
        } else if (rawBody.messages) {
          promptText = rawBody.messages[1] ? rawBody.messages[1].content : JSON.stringify(rawBody);
        } else {
          promptText = JSON.stringify(rawBody);
        }

        const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: 'Ты решаешь тест Moodle. Верни ТОЛЬКО валидный JSON формата: {"results":[{"questionIndex":0,"correctIds":["q0_opt0"]}]}' },
              { role: 'user', content: promptText }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1
          })
        });

        const dsData = await dsRes.json();
        const answerText = dsData.choices && dsData.choices[0] ? dsData.choices[0].message.content : '{"results":[]}';
        const formatted = { candidates: [{ content: { parts: [{ text: answerText }] } }] };
        return new Response(JSON.stringify(formatted), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // 2. Если это Gemini
      let geminiBody = rawBody;
      if (!rawBody.contents && rawBody.messages) {
        const textContent = rawBody.messages.map(m => m.content).join('\n');
        geminiBody = {
          contents: [{ parts: [{ text: textContent }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
        };
      } else if (!rawBody.generationConfig) {
        geminiBody.generationConfig = { responseMimeType: 'application/json', temperature: 0.1 };
      }

      const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(key)}`;
      const r = await fetch(gUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody)
      });

      const data = await r.json();

      // Железобетонная защита: если Google вернул другой формат, аккуратно приводим его к стандарту приложения
      if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        return new Response(JSON.stringify(data), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // Если ответ пришёл в поле text или другом виде — заворачиваем в нужную структуру
      let extractedText = "{\"results\":[]}";
      if (data && data.promptFeedback) {
        extractedText = "{\"results\":[]}";
      } else {
        extractedText = JSON.stringify(data);
      }

      const safeResponse = {
        candidates: [{
          content: {
            parts: [{ text: extractedText }]
          }
        }]
      };

      return new Response(JSON.stringify(safeResponse), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

    } catch (e) {
      // Даже при сбое воркер вернет пустой JSON без падения приложения
      const fallback = { candidates: [{ content: { parts: [{ text: '{"results":[]}' }] } }] };
      return new Response(JSON.stringify(fallback), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
  }
};
