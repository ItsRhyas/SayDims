# SayDim — Documentación del proyecto

Proyecto: SayDim
Branch: develop

## Resumen

SayDim es una pequeña aplicación web que corre desde un ESP32 y sirve una interfaz para gestionar "Dimensiones" y "Personajes". Los recursos web (HTML/CSS/JS) y los datos (JSON) se almacenan en una tarjeta SD; el ESP32 actúa como servidor HTTP que entrega archivos estáticos y expone API REST básicas para listar/crear dimensiones y personajes y para subir imágenes.

Este repositorio contiene:

- `SayDim/SayDim.ino` — Firmware para ESP32 (server, SD helpers, API, uploads).
- `www/` — Carpeta con la interfaz web (index.html, css/, js/).

## Objetivos de esta documentación

1. Explicar la arquitectura y el flujo de datos entre el navegador y el ESP32.
2. Documentar los endpoints HTTP y la estructura de los ficheros JSON usados.
3. Indicar el layout esperado en la tarjeta SD y los pasos para desplegar.
4. Guiar en debugging y resolución de problemas (Serial, Network, SD).
5. Proveer instrucciones de desarrollo local y de despliegue en el ESP32.

## Archivos clave

- `SayDim/SayDim.ino`: implementa un servidor WebServer que sirve archivos desde la SD (ruta `/www` preferida) y expone endpoints:

  - `GET /` → `index.html` (served from `/www/index.html`).
  - `GET /css/*`, `/js/*`, `/img/*` → archivos estáticos desde SD.
  - `GET /api/status`, `GET /api/dimensions`, `GET /api/characters` → APIs JSON.
  - `POST /upload/dimension`, `POST /upload/character` → endpoints para subir imágenes y metadatos.

- `www/index.html`, `www/css/style.css`, `www/js/app.js`: interfaz cliente que consume las APIs anteriores.

## Cómo leer esta documentación

Consulta los archivos en `docs/` para detalles técnicos por área (arquitectura, API, layout SD, uso y troubleshooting). Si deseas un resumen rápido, lee este `README.md`.

## Licencia

Añade aquí la licencia que prefieras (MIT, Apache-2.0, etc.). Actualmente no se incluye una licencia explícita en el repositorio.

## Contacto

Para dudas sobre el firmware o la integración, abre un issue en el repositorio con el máximo detalle: versión del ESP32, salida Serial relevante, listado de archivos en la SD (`/ls`) y capturas de la pestaña Network del navegador.
