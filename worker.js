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
      const bodyText = await request.text();

      // Если ключ начинается на sk- — отправляем в DeepSeek
      if (key.startsWith('sk-')) {
        const r = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key
          },
          body: bodyText
        });
        return new Response(await r.text(), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // Любой другой ключ — отправляем в Gemini (gemini-3.8-flash с поддержкой картинок!)
      const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.0-flash'];
      let lastResText = '';
      let lastStatus = 500;

      for (const m of models) {
        const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`;
        const r = await fetch(gUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyText
        });
        lastResText = await r.text();
        lastStatus = r.status;
        if (r.ok) {
          return new Response(lastResText, { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
      }
      return new Response(lastResText, { status: lastStatus, headers: { ...cors, 'Content-Type': 'application/json' } });

    } catch (e) {
      return new Response(JSON.stringify({ error: { message: e.message } }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }
};
