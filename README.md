# QR Generator

Генератор QR-кодов с поддержкой стилизации, градиентов, логотипа и пресетов. Работает полностью в браузере — без сервера и сторонних запросов.

![preview](https://i.imgur.com/placeholder.png)

## Возможности

- **Статические QR** — ссылка или любой текст
- **Динамические QR** — редирект через собственный сервер или короткую ссылку
- **Стили точек** — rounded, dots, classy, classy-rounded, square, extra-rounded
- **Стили угловых блоков** — dot, square, extra-rounded (применяется ко всем 4 блокам, включая паттерны выравнивания)
- **Градиенты** — линейный / радиальный для точек, угловых блоков и фона, с настройкой угла
- **Логотип** — drag & drop или выбор файла, настройка размера и отступа
- **Пресеты** — сохранение и загрузка конфигураций в `localStorage`
- **Экспорт** — PNG, SVG, JPEG, WebP; скачать или скопировать в буфер
- **Импорт / экспорт** настроек в JSON

## Файлы

```
index.html                  — приложение (всё в одном файле)
qr-code-styling-custom.js  — модифицированная библиотека QR-рендеринга
_redirects                  — правила редиректа для Netlify
qr-src/                     — TypeScript-исходники библиотеки (для пересборки)
```

## Запуск

Открыть `index.html` напрямую в браузере **не получится** из-за ограничений CORS при загрузке локальных скриптов. Нужен любой локальный сервер:

```bash
# Node.js
npx serve .

# Python
python -m http.server 8080
```

Затем открыть `http://localhost:3000` (или порт, который укажет сервер).

## Деплой на Netlify

Репозиторий готов к деплою как статический сайт. Достаточно подключить GitHub-репозиторий в Netlify — файл `_redirects` уже настроен.

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

## Что изменено в библиотеке

Оригинальная [`qr-code-styling`](https://github.com/kozakdenys/qr-code-styling) применяет стили (`cornersSquareOptions`, `cornersDotOptions`) только к трём finder-паттернам по углам. Паттерны выравнивания (alignment patterns, QR версии ≥ 2) рендерились как обычные точки.

В этом форке добавлен метод `drawAlignmentPatterns()` в `QRSVG.ts`:

- Паттерны выравнивания исключены из общего цикла `drawDots()`
- Вместо этого они рисуются отдельно с теми же стилями и градиентами, что и угловые finder-паттерны
- Позиции рассчитываются по стандартной таблице QR ISO 18004 (версии 2–40)

## Стек

- Vanilla JS / HTML / CSS — без фреймворков
- [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) (модифицированный форк, собран через esbuild)
