# ИнфоДа — браузер для Moodle

## Как устроено
- `web/inject.js` — скрипт панели (⚙ / · Точки / ⚡ Авто). Приложение скачивает его с GitHub
  при запуске, поэтому **правки этого файла доходят до телефона без переустановки APK**
  (достаточно закрыть и открыть приложение или перейти на другую страницу).
- `worker.js` — прокси на Cloudflare. Ключ `sk-...` → DeepSeek, любой другой (`AIza...`, `AQ....`) → Gemini.
- `app/` — само Android-приложение. Пересобирается только при правках в `app/`.

## Скачать APK
Всегда последняя версия: https://github.com/mvbulgakova/browse_DA/releases/latest/download/InfoDa.apk

Новые версии ставятся **поверх** старой (ключ подписи постоянный), удалять приложение не нужно.

## Автообновление воркера (по желанию, настраивается один раз)
1. Cloudflare → My Profile → API Tokens → Create Token → шаблон «Edit Cloudflare Workers» → Create.
2. GitHub → Settings → Secrets and variables → Actions → New repository secret:
   - `CLOUDFLARE_API_TOKEN` — этот токен;
   - `CLOUDFLARE_ACCOUNT_ID` — Account ID (Cloudflare → Workers & Pages, справа).
3. Actions → «Deploy Cloudflare Worker» → Run workflow.

После этого любая правка `worker.js` в `main` сама выкатывается на Cloudflare.
Без секретов воркер обновляется вручную: Cloudflare → Workers & Pages → proxy → Edit code → вставить `worker.js` → Deploy.
