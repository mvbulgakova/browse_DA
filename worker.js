export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    // Ключ DeepSeek передается из приложения
    const apiKey = url.searchParams.get('key');

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Не указан DeepSeek API Key' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    try {
      const clientBody = await request.json();
      
      // Конвертируем запрос из формата Gemini в стандартный формат DeepSeek (OpenAI-compatible)
      const promptText = clientBody.contents[0].parts[0].text;

      const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'Ты помощник для прохождения тестов. Отвечай строго в формате JSON, без лишнего текста и markdown-оберток, если требуется.' },
            { role: 'user', content: promptText }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })
      });

      const dsData = await deepseekResponse.json();
      
      // Превращаем ответ DeepSeek обратно в формат, который ожидает наш скрипт в браузере
      const answerText = dsData.choices[0].message.content;
      const formattedResponse = {
        candidates: [{
          content: {
            parts: [{ text: answerText }]
          }
        }]
      };

      return new Response(JSON.stringify(formattedResponse), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }
};
