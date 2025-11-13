# Arquitectura de SayDim

## Resumen

SayDim está diseñado como una aplicación cliente/servidor ligera donde:

- El servidor es el ESP32 con soporte para tarjeta microSD.
- El cliente es una app multipágina (HTML/CSS/JS) servida desde la SD y consumida por el navegador.

## Diagramas

Diagrama de clases
![alt text](CasosDeUso.png)

Diagrama de casos de uso
![alt text](CasosDeUso.png)

## Componentes

1. Firmware (ESP32)

   - Librerías principales: WiFi, WebServer, SD, SPI, ArduinoJson.
   - Funciones clave:
     - `handleStaticFile()` — resuelve peticiones a ficheros y las sirve (soporta `.gz`).
     - `handleAsset()` — rutas `/asset/` que mapean a recursos en SD (imágenes subidas).
     - `apiDimensions()` / `apiCharacters()` — devuelven JSON con los datos actuales.
     - `handleUploadDimension()` / `handleUploadCharacter()` — procesan uploads (multipart) y escriben en SD.
   - Estructura de datos: dimensiones y personajes se almacenan en `/data/dimensions.json` y `/data/characters.json`.

2. Interfaz web

   - Páginas: `index.html`, `dimension.html`, `character.html`, `add.html`.
   - Estilos y scripts: `www/css/styles.css`, `www/js/app.js`, `www/js/mock.js`.
   - Flujo: el JS consume `GET /api/dimensions` y `GET /api/characters` y usa `/upload/*` para enviar formularios con archivos. En `add.html`, un popup construye el JSON de poderes.
   - Offline-first (cliente):
     - IndexedDB con stores: `dimensions`, `characters`, `images` (Blob), `meta` (p.ej. `lastSync`).
     - `performSync()` descarga JSON e imágenes desde `/api/*` y `/asset/*` y los guarda en caché.
     - `fetchJSON()` intenta red; si falla, cae a los stores de IndexedDB (incluye filtro por `dim`).
     - `attachImage()` muestra primero el blob cacheado; si no existe y hay conexión, usa `/asset/<path>`; si no, oculta la imagen (sin placeholders remotos).
     - `normalizeAssetPath()` garantiza claves coherentes en caché (p.ej. `/dimensions/a.jpg` y `dimensions/a.jpg`).
     - Sin Service Worker: los HTML deben poder servirse en el momento del acceso; los datos/imagenes sí pueden venir del caché.

3. Tarjeta SD
   - Debe contener al menos:
     - `/www/index.html`, `/www/dimension.html`, `/www/character.html`, `/www/add.html`
     - `/www/css/styles.css`, `/www/js/app.js`, `/www/js/mock.js`
     - `/data/*.json` (inicializados si vacíos)
     - `/dimensions/` y `/characters/` (imágenes subidas)

## Comunicación

- HTTP simple: el navegador hace peticiones GET/POST a la IP del ESP32 (ej. `http://192.168.1.200`).
- No hay autenticación por defecto.

## Decisiones de diseño

- Servir archivos desde SD reduce la memoria ocupada en la flash del ESP y facilita actualizar la UI sin recompilar.
- Se soporta `/asset/` para diferenciar recursos que vienen del almacenamiento (imágenes subidas) de los fijos en `/www`.
- En el cliente, las imágenes se recomprimen (JPEG) y se recortan a la relación de aspecto esperada antes de subir para reducir tamaño.
- El código prioriza simplicidad y trazabilidad (varias salidas Serial para debugging).
- Soporte offline sin SW: elección de IndexedDB por estar disponible en HTTP; se evita sobrecargar el ESP32 con sincronizaciones automáticas agresivas.

## Limitaciones

- No hay autenticación ni HTTPS (por simplicidad y limitaciones del ESP32/SD).
- Performance en SD puede variar según la tarjeta y frecuencia SPI.
- Manejo de concurrencia simple: WebServer síncrono; cargas grandes pueden bloquear si la SD es lenta.
- Sin Service Worker: no se pueden abrir páginas nuevas estando completamente offline; necesitas que el servidor sirva el HTML al menos una vez.
