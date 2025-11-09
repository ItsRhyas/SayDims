# ProjectSay — Versión de servidor integrado

Este repositorio contiene la versión del servidor para ESP32 que usa el servidor síncrono del core (`WebServer`) y almacenamiento en la memoria flash del dispositivo (SPIFFS). Esta versión evita dependencias asíncronas (ESPAsyncWebServer / AsyncTCP) y no requiere módulo microSD por defecto.

## Resumen

- Servidor HTTP: `WebServer` (incluido en el core de ESP32 para Arduino).
- Almacenamiento: `SPIFFS` (flash interna). JSON y las imágenes se escriben/leen desde SPIFFS.
- UI: Single Page App (HTML+JS) embebida en el sketch y servida en `/`.
- Endpoints principales:
  - `GET /` – página principal (SPA embebida).
  - `GET /api/dimensions` – lista de dimensiones (JSON).
  - `GET /api/characters` – lista de personajes (soporta filtros y orden).
  - `POST /upload/dimension` – subir una dimensión (form-data con campos e imagen).
  - `POST /upload/character` – subir un personaje (form-data con campos e imagen).
  - `GET /asset/<path>` – sirve imágenes almacenadas en SPIFFS.

> Nota: en esta versión NO se usa la tarjeta microSD. Todas las lecturas/escrituras son en SPIFFS.

## Archivos importantes

- `ProjectSay_simple.ino` — sketch principal (usa WebServer + SPIFFS + ArduinoJson).
- `README.md` — este archivo.

## Requisitos / Librerías

- Arduino IDE con soporte para ESP32 (el core de ESP32 que uses en tu entorno).
- Librerías usadas por el sketch (instaladas desde el Gestor de librerías si fuera necesario):
  - `ArduinoJson` (v6 compatible).
  - `SPIFFS` / `FS` — provistos por el core ESP32.
  - `WebServer` — provisto por el core ESP32.

Recomendación: usa una versión reciente del core ESP32 en Arduino IDE. Si tu compilación original funcionó, usa esa misma versión para reproducibilidad.

## Configuraciones y cambios importantes (MUST READ)

Para que otros obtengan el mismo comportamiento/hay que replicar estas configuraciones y cambios que apliqué:

1. Ubicación del sketch

   - El sketch simplificado debe residir en su propia carpeta: `ProjectSay_simple`.
   - IMPORTANTE: Arduino compila todos los `.ino` dentro de la misma carpeta como un único sketch; si dejas `ProjectSay.ino` (la versión original con AsyncWebServer) en la misma carpeta, obtendrás errores de "redefinición" y conflictos de enums (`HTTP_GET`, `HTTP_POST`, etc.).
   - Acción: abre únicamente `c:\Users\David\OneDrive\Documentos\Arduino\ProjectSay_simple\ProjectSay_simple.ino` en el IDE.

2. WiFi y IP estática

   - En el sketch definí valores por defecto para conectar a la red y una IP fija:
     - `local_IP(192,168,1,200)` — cambia a la IP que te convenga o quita la llamada a `WiFi.config` si prefieres DHCP.
     - Las credenciales WiFi están en el sketch: `const char* ssid` y `const char* password`.
   - Si necesitas que el dispositivo tenga la misma IP en tu red, deja `WiFi.config(local_IP, gateway, subnet, primaryDNS)` como está.

3. SPIFFS

   - El sketch llama `SPIFFS.begin(true)` en `setup()` (el `true` permite formatear si la partición está corrupta). Esto puede borrar contenido previo en SPIFFS cuando se ejecuta por primera vez en una flash recién particionada.
   - Partición de SPIFFS: la capacidad disponible depende de la partición seleccionada en el menú `Tools > Partition Scheme` del Arduino IDE. Si planeas almacenar varias imágenes, asegúrate de seleccionar una partición que deje suficiente espacio para SPIFFS.
   - Recomendación: elegir una opción con suficiente SPIFFS (por ejemplo, la opción "Default" o similar que proporciona espacio razonable), y comprobar `SPIFFS.totalBytes()`/`SPIFFS.usedBytes()` si necesitas monitorizar espacio.

4. Rutas y formato de datos

   - JSON de dimensiones: `/data/dimensions.json`
   - JSON de personajes: `/data/characters.json`
   - Orden de dimensiones: `/data/order.json`
   - Imágenes de dimensiones: `/dimensions/<id>.jpg` (se sirven vía `/asset/dimensions/<id>.jpg`)
   - Imágenes de personajes: `/characters/<id>.jpg` (se sirven vía `/asset/characters/<id>.jpg`)

5. Cambios funcionales aplicados por mí

   - Eliminé dependencias de `ESPAsyncWebServer` y `AsyncTCP` en esta versión. Esto evita conflictos y problemas de compatibilidad con mbedTLS, lwIP, etc.
   - Moví y dejé el sketch `ProjectSay_simple.ino` en una carpeta independiente (`ProjectSay_simple`) para impedir que el IDE compile ambas versiones simultáneamente.
   - Reemplacé el almacenamiento en microSD por SPIFFS en el código del sketch (funciones de lectura/escritura ahora usan `SPIFFS.open`).
   - Embebí la SPA (HTML + JS) directamente en el sketch en la constante `index_html[]` para que no dependamos de archivos externos. (Si prefieres, puedo extraerla como `index.html` en SPIFFS.)
   - Añadí impresiones por Serial en `setup()` para ver progreso de arranque (SPIFFS, WiFi, IP y servidor).

6. Permisos y formato de subida

   - Los endpoints `/upload/*` esperan `multipart/form-data` (formularios con campos y archivos). El cliente web del SPA utiliza `FormData` para enviar los campos correctos.

7. Serial / debug
   - Velocidad del Serial Monitor: `115200`.
   - Mensajes clave que verás al arrancar: "Simple server starting...", estado de SPIFFS, intentos de conexión WiFi y la IP asignada (o mensaje de error si falla).

## Cómo compilar y subir

1. Abre Arduino IDE.
2. File -> Open -> selecciona `c:\Users\David\OneDrive\Documentos\Arduino\ProjectSay_simple\ProjectSay_simple.ino`.
3. Tools:
   - Board: tu modelo ESP32.
   - Partition Scheme: selecciona una que deje suficiente espacio para SPIFFS (si planeas muchas imágenes aumenta la partición de SPIFFS).
   - Puerto y velocidad serial adecuados.
4. Compilar > Subir.
5. Abrir Serial Monitor (115200) y observar mensajes de arranque.

## Cómo probar la aplicación

1. Abre el navegador en la misma red y navega a la IP que muestre el Serial (o a `http://192.168.1.200` si dejaste ese IP fija).
2. Verás la SPA. Crea una dimensión mediante el formulario (sube una imagen) y luego crea personajes.
3. Las imágenes se servirán desde `/asset/...` y los JSON se almacenan en `/data/*` dentro de SPIFFS.

## Si quieres volver a usar microSD

- Cambios mínimos para migrar a SD:
  1. Reemplaza funciones de `SPIFFS.open/read/write` por `SD.open/read/write` y usa las rutas con `/<folder>/<file>` según tu tarjeta (por ejemplo `/sd/dimensions/...` si montas SD con prefijo).
  2. Inicializa SD con `SD.begin(CS_PIN)` en `setup()` y maneja reintentos como desees.
  3. Ten cuidado con el orden de inicialización y evita iniciar el servidor hasta que SD esté montada si dependes de archivos en la SD.
- Si quieres, lo hago yo: puedo crear una rama/archivo `ProjectSay_sd.ino` que reimplemente solo las funciones de almacenamiento usando la microSD.

## Problemas conocidos y soluciones

- Errores de compilación con `HTTP_GET`/`HTTP_POST`/`HTTP_DELETE` o símbolos duplicados:
  - Ocurren si tienes el sketch original con `ESPAsyncWebServer` en la misma carpeta. Solución: abre sólo `ProjectSay_simple` en el IDE (que esté en su carpeta propia).
- Falta de espacio en SPIFFS:
  - Cambia la partición en las opciones de la placa o mueve imágenes a una microSD.
- Error al subir archivos (upload callbacks no llamados): comprueba que el formulario en el navegador envía `multipart/form-data` y no JSON.

## Próximos pasos recomendados

- Extraer la SPA a archivos `index.html`, `app.js` y `style.css` en SPIFFS para una edición más fácil.
- Agregar monitor de uso de SPIFFS y mostrar advertencia en la UI cuando el espacio sea bajo.
- Si necesitas muchas imágenes, implementar almacenamiento en microSD (puedo hacerlo por ti).

---

Si quieres que cambie algo en esta documentación o que genere una versión que sirva la SPA desde SPIFFS en lugar de embebida, lo hago ahora.
