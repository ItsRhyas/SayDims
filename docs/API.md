# API REST de SayDim

Todas las rutas usan HTTP simples (sin autenticación) y devuelven JSON o archivos estáticos.

## Base URL

`http://<ESP32_IP>/` (ej. `http://192.168.1.200`)

## Endpoints

- `GET /api/status`

  - Respuesta: `{ "sdAvailable": true|false }`
  - Uso: comprobar si el servidor detectó la SD.

- `GET /api/dimensions`

  - Descripción: devuelve la lista de dimensiones (orden respetando `/data/order.json`).
  - Respuesta: Array de objetos Dimension. Ejemplo:
    ```json
    [
      {
        "id": "abc123",
        "nombre": "Mundo A",
        "descripcion": "...",
        "history": "...",
        "image": "/dimensions/abc123.jpg"
      }
    ]
    ```

- `GET /api/characters?dim=<ID>&sort=<field>&dir=asc|desc`

  - Parámetros opcionales:
    - `dim` — filtrar por dimensión
    - `sort` — campo `name` o `vida` (el cliente usa `name`/`vida`/`created`)
    - `dir` — `asc` o `desc` (default `asc`)
  - Respuesta: Array de objetos Character. El servidor puede enriquecer con `dimensionName`.
  - Campos relevantes:
    - `id`, `nombre`, `dimension` (id), `dimensionName` (opcional), `vida`, `foto` (ruta como `/characters/<id>.jpg`), `descripcion`, `powers` (array), `comentarios`, `created` (epoch seg, sincronizado vía NTP en firmware), `multiverseId` (opcional)
  - Ejemplo:
    ```json
    [
      {
        "id": "c1",
        "nombre": "Hero",
        "dimension": "abc123",
        "dimensionName": "Mundo A",
        "vida": 100,
        "foto": "/characters/c1.jpg",
        "powers": [
          {
            "nombre": "Fuego",
            "descripcion": "Lanza bola de fuego",
            "daño": 25,
            "cooldown": 3
          },
          { "nombre": "Escudo", "descripcion": "Absorbe daño por 5s" }
        ],
        "created": "1670000000",
        "multiverseId": "mv-1700000000"
      }
    ]
    ```

- `POST /upload/dimension` (multipart/form-data)

  - Campos del formulario esperados:
    - `name` — nombre
    - `description` — descripción
    - `history` — historia
    - `image` — archivo (image/\*)
  - Efecto: guarda la imagen en `/dimensions/<id>.jpg`, añade entrada en `/data/dimensions.json` y añade `id` a `/data/order.json`.
  - Respuesta:
    - `200 OK` con cuerpo `{ "ok": true, "id": "<id>" }`.
    - `409` si ya existe una dimensión con el mismo nombre.
    - `503` si SD no disponible.

- `POST /upload/character` (multipart/form-data)

  - Campos del formulario esperados:
    - `nombre`, `dimension` (id), `vida`, `descripcion`, `powers` (JSON array string), `foto` (file), `comentarios`
  - Efecto: escribe la imagen en `/characters/<id>.jpg` y añade objeto en `/data/characters.json`.
  - Reglas del servidor:
    - Rechaza duplicados de nombre dentro de la misma dimensión (`409`).
    - Si detecta el mismo nombre en otra dimensión, asigna/propaga `multiverseId`.
    - Si `dimension` no existe, responde `400`.
  - Respuesta:
    - `200 OK` con cuerpo `{ "ok": true, "id": "<id>", "multiverseId": "..."? }`.
    - `409` si duplicado en la misma dimensión.
    - `400` si la dimensión no existe.
    - `503` si SD no disponible.

- `GET /asset/<path>`

  - Sirve archivos ubicados en la SD fuera de `/www`, por ejemplo `GET /asset/dimensions/abc.jpg` devolverá `/dimensions/abc.jpg`.

  - Notas de cliente (offline):
    - El cliente normaliza `image`/`foto` a una clave de caché (`/dimensions/...`, `/characters/...`).
    - Si existe un blob cacheado en IndexedDB, se usa en preferencia a la red; si no hay blob y no hay conexión, la imagen no se muestra (no placeholder).

## MIME y cabeceras

- El servidor asigna `Content-Type` por extensión (.css → text/css, .js → application/javascript, .jpg/png → image/\*, .json → application/json).
- Si existe versión gz (`*.gz`), el servidor sirve con `Content-Encoding: gzip`.
- Se añade `Cache-Control: public, max-age=86400` para archivos estáticos.
  - Las rutas `/asset/...` sirven imágenes desde la SD con caché habilitada.

## Errores comunes

- `404 Not Found` — archivo no presente en la SD o ruta mal formada.
  - Común al acceder a `/asset/...` si la imagen nunca fue subida o el JSON referencia un path inexistente. Verifica con `/ls`.
- `503` — SD no detectada.
- `500` — error interno al abrir el archivo.

## Notas de seguridad

- No expongas este dispositivo en redes públicas sin firewall/seguridad; no hay autenticación ni cifrado por defecto.
