# Troubleshooting — Problemas comunes y soluciones

1. HTML carga pero CSS/JS no (404)

- Síntoma: index.html visible pero red no carga `/css/style.css` o `/js/app.js`.
- Causa probable: estructura de la SD no es la esperada (archivos bajo `/www` pero peticiones usan `/css`), o la petición no es atendida.
- Comprobación: visita `http://<ip>/ls` y confirma que `/www/css/style.css` y `/www/js/app.js` aparecen como `EXISTS`.
- Solución: copia toda la carpeta `www` a la raíz de la SD (es decir, que `/www/css/style.css` exista). El firmware ahora intenta resolver con/ sin `/www` pero es más fiable mantener la estructura.

2. `GET /api/dimensions` o `/api/characters` devuelve 404

- Síntoma: la UI no muestra dimensiones/personajes.
- Causa probable: los endpoints no estaban registrados o el servidor no los tenía asignados (ya corregido en firmware reciente).
- Comprobación: en Serial deberías ver `API call: /api/dimensions` al realizar la petición. También prueba en el navegador `http://<ip>/api/dimensions`.
- Solución: si no aparece, asegúrate de haber flasheado el firmware actualizado. Si la llamada aparece pero devuelve 500 o contenido vacío, verifica `/data/dimensions.json` y `/data/characters.json` en la SD.

3. Uploads fallan (500/503/409/400)

- 503: SD no detectada (revisar conexiones CS/MOSI/MISO/SCK y alimentación 3.3V). Revisa Serial al boot para ver "SD initialized".
- 500: error abriendo archivo o escribiendo (tarjeta protegida contra escritura o corrupta). Probar con otra tarjeta o formatear y copiar la estructura.
- 409 (character o dimension): duplicado detectado (mismo nombre en misma dimensión; o dimensión ya existente). Cambia el nombre e intenta otra vez.
- 400 (character): id de dimensión no existe. Asegúrate de crear primero la dimensión y seleccionarla en el formulario.

4. Monitor Serial no muestra trazas de peticiones

- El firmware imprime trazas en handlers principales (handleStaticFile, handleNotFound, api endpoints). Si no ves trazas de peticiones, asegúrate de que el Monitor Serial está abierto a 115200 y que estás viendo la salida posterior a un "Server started".
- Si el ESP reinicia continuamente, abre Serial desde el arranque y pega las líneas iniciales.

5. Imágenes no cargan

- En modo actual, no se usa placeholder remoto cuando estás offline. Si la imagen no está en caché y no hay conexión, se ocultará.
- Si ves `404 Not Found` para `/asset/...` en el Serial, significa que el archivo no existe en la SD o la ruta en el JSON es incorrecta.
  - Verifica con `http://<ip>/ls` y corrige la ruta/archivo.
  - Ejecuta la sincronización desde `index.html` (botón ⌂) para cachear la imagen.

6. No se guardan las vistas/archivos JSON
7. No funcionan páginas distintas a index (404 en /dimension.html o /character.html)

- Causa: firmware antiguo sin rutas explícitas para páginas principales.
- Solución: flashea el firmware actualizado que registra `/dimension.html`, `/character.html` y `/add.html` en el servidor.

8. Envías formularios pero “no pasa nada”

- Abre DevTools (Network) y observa la solicitud a `/upload/dimension` o `/upload/character`.
- Si no hay solicitud, revisa que `www/js/app.js` esté cargando (ver consola) y que el `data-page="add"` exista en `add.html`.
- Si hay solicitud pero falla, verifica códigos 409/400/503 anteriores; revisa también el Monitor Serial.

- Verifica que el ESP puede escribir en SD: revisa que `writeStringToFileFS` devuelve true y que las entradas en `/data/*.json` cambian después de subir.

9. Offline: datos aparecen pero imágenes no

- Causa: las imágenes no se habían sincronizado previamente, o el path en JSON no existe en la SD.
- Solución: estando online, pulsa sincronizar (⌂) en `index.html` y vuelve a probar. Asegúrate de que `image`/`foto` del JSON apunten a `/dimensions/...` o `/characters/...` existentes.

## Diagnósticos útiles

- `http://<esp_ip>/ls` — muestra existencia de ficheros importantes.
- Monitor Serial (115200) — traza de requests, errores y estados SD.
- DevTools Network — cabeceras y respuestas HTTP (404, 500, etc.).
- DevTools Application/Storage — ver y limpiar IndexedDB `saydim-db`.

## Si necesitas ayuda

Adjunta:

- Salida del Monitor Serial completa desde el arranque hasta reproducir el problema.
- Resultado de `http://<ip>/ls`.
- Captura de la pestaña Network mostrando la petición que falla (Headers + Response).

Con eso reviso punto a punto y preparo un parche si hace falta.
