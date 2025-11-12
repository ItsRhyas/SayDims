# SayDim — Documentación del proyecto

Proyecto: SayDim
Branch: develop

## Resumen

SayDim es una aplicación web ligera que corre en un ESP32 y permite gestionar "Dimensiones" y "Personajes". La interfaz es multipágina (index, dimensión, personaje y agregar) y se sirve desde la microSD junto con los datos. El ESP32 expone endpoints REST para listar y crear recursos, y sirve imágenes directamente desde la SD.

Este repositorio contiene:

- `SayDim/SayDim.ino` — Firmware para ESP32 (server, SD helpers, API, uploads).
- `www/` — Carpeta con la interfaz web (index.html, dimension.html, character.html, add.html, css/, js/).

## Objetivos de esta documentación

1. Explicar la arquitectura y el flujo de datos entre el navegador y el ESP32.
2. Documentar los endpoints HTTP y la estructura de los ficheros JSON usados.
3. Indicar el layout esperado en la tarjeta SD y los pasos para desplegar.
4. Describir la interfaz (multipágina) y el “constructor de poderes” con popup.
5. Guiar en debugging y resolución de problemas (Serial, Network, SD).
6. Proveer instrucciones de desarrollo local y de despliegue en el ESP32.

## Archivos clave

- `SayDim/SayDim.ino`: implementa un servidor WebServer que sirve archivos desde la SD (ruta `/www` preferida) y expone endpoints:

  - `GET /` → `index.html` (served from `/www/index.html`).
  - `GET /index.html`, `/dimension.html`, `/character.html`, `/add.html` → páginas explícitas.
  - `GET /css/*`, `/js/*`, `/img/*` → archivos estáticos desde SD.
  - `GET /api/status`, `GET /api/dimensions`, `GET /api/characters` → APIs JSON.
  - `POST /upload/dimension`, `POST /upload/character` → endpoints para subir imágenes y metadatos.
  - `GET /asset/...` → sirve imágenes guardadas en la SD (p. ej. `/asset/dimensions/abc.jpg`).

- `www/index.html`, `www/dimension.html`, `www/character.html`, `www/add.html`, `www/css/styles.css`, `www/js/app.js`, `www/js/mock.js`: interfaz cliente multipágina.

## Interfaz y flujo de uso

- Inicio (`index.html`):
  - Muestra banners de Dimensiones y una lista de personajes recientes.
- Dimensión (`dimension.html?id=<id>`):
  - Muestra el banner de la dimensión y los personajes pertenecientes a ella.
- Personaje (`character.html?id=<id>`):
  - Muestra detalles, habilidades y “Otras versiones” (mismo nombre en otras dimensiones via `multiverseId`).
- Agregar (`add.html`):
  - Formularios para crear Dimensión y Personaje.
  - Constructor de poderes con popup: añade/elimina filas y guarda en JSON automáticamente.
  - Compresión de imágenes en el navegador: 16:9 (dimensión) y 1:1 (personaje), JPEG optimizado.
  - Spinner de progreso durante procesamiento/subida.

Reglas del servidor:

- Evita duplicados: no permite dimensiones con el mismo nombre ni personajes con el mismo nombre dentro de una misma dimensión (responde 409).
- Asigna `multiverseId` cuando detecta el mismo nombre en dimensiones distintas, y lo propaga a versiones anteriores.
- Enriquecimiento opcional: el listado de personajes puede incluir `dimensionName` para mostrar el nombre de su dimensión.

## Cómo leer esta documentación

Consulta los archivos en `docs/` para detalles técnicos por área (arquitectura, API, layout SD, uso y troubleshooting). Si deseas un resumen rápido, lee este `README.md`.

## Guía rápida

1. Flashea `SayDim.ino` y copia la carpeta `www` a la raíz de la SD.
2. Enciende el ESP32 y abre `http://<ip>/`.
3. Crea una Dimensión en `add.html` y verifica que aparece en la portada.
4. Crea un Personaje y usa el popup de poderes para definir habilidades sin escribir JSON.

Para desarrollo local, abre `www/index.html?mock=1` o sirve la carpeta `www` con un servidor estático y añade `?mock=1` para simular la API.

## Licencia

Añade aquí la licencia que prefieras (MIT, Apache-2.0, etc.). Actualmente no se incluye una licencia explícita en el repositorio.

## Contacto

Para dudas sobre el firmware o la integración, abre un issue en el repositorio con el máximo detalle: versión del ESP32, salida Serial relevante, listado de archivos en la SD (`/ls`) y capturas de la pestaña Network del navegador.
