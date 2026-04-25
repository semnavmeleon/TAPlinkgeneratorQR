# QR Generator

Генератор QR-кодов с полной стилизацией, градиентами, логотипом и динамическими редиректами.
Работает полностью в браузере — без сервера, без аккаунта, без сторонних запросов.

![preview](https://i.imgur.com/j6vGRAT.png)

---

## Возможности

- **Стили точек** — rounded, dots, classy, classy-rounded, square, extra-rounded
- **Стили угловых блоков** — dot, square, extra-rounded; применяется ко всем 4 блокам QR, включая паттерны выравнивания
- **Градиенты** — линейный и радиальный для точек, угловых блоков и фона, с настройкой угла
- **Логотип** — drag & drop или выбор файла, настройка размера и отступа
- **Динамические QR** — редирект через собственный сервер или готовую короткую ссылку
- **Пресеты** — сохранение и загрузка настроек в `localStorage`
- **Экспорт** — PNG, SVG, JPEG, WebP; скачать или скопировать в буфер обмена
- **Импорт / экспорт** конфига в JSON

---

## Структура

```
index.html                  — приложение (один файл, без сборки)
qr-code-styling-custom.js  — модифицированная библиотека QR-рендеринга
_redirects                  — правила редиректа для Netlify
qr-src/                     — TypeScript-исходники библиотеки (для пересборки)
```

---

## Запуск

Открыть `index.html` напрямую в браузере не получится из-за ограничений CORS при загрузке локальных скриптов. Нужен любой локальный сервер:

```bash
# Node.js
npx serve .

# Python
python -m http.server 8080
```

Затем открыть `http://localhost:3000` (или порт, который укажет сервер).

---

## Деплой на Netlify

Репозиторий готов к деплою как статический сайт. Достаточно подключить GitHub-репозиторий в Netlify — файл `_redirects` уже настроен.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

---

## Пересборка библиотеки

Исходники в `qr-src/src/`. Основная логика — `qr-src/src/core/QRSVG.ts`.

```bash
cd qr-src
npm install
npx esbuild src/index.ts \
  --bundle --format=iife --global-name=QRCodeStyling \
  --outfile=../qr-code-styling-custom.js \
  --platform=browser --external:canvas --external:jsdom --minify \
  "--footer:js=QRCodeStyling=QRCodeStyling.default;"
```

---

## Что изменено в библиотеке

Оригинальная [`qr-code-styling`](https://github.com/kozakdenys/qr-code-styling) применяет стили (`cornersSquareOptions`, `cornersDotOptions`) только к трём finder-паттернам по углам. Паттерны выравнивания (alignment patterns, QR версии ≥ 2) рендерились как обычные точки.

В этом форке добавлен метод `drawAlignmentPatterns()` в `QRSVG.ts`:

- Паттерны выравнивания исключены из общего цикла `drawDots()`
- Рисуются отдельно с теми же стилями и градиентами, что и угловые finder-паттерны
- Позиции рассчитываются по стандартной таблице QR ISO 18004 (версии 2–40)

---

## Стек

| | |
|---|---|
| UI | Vanilla JS / HTML / CSS — без фреймворков |
| QR | [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) (модифицированный форк) |
| Сборка | [esbuild](https://esbuild.github.io/) |
