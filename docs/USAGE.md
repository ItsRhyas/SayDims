# Uso y despliegue de SayDim

## Requisitos

- ESP32 (compatible con core esp32 Arduino)
- Tarjeta microSD (FAT32)
- Cable USB para programar ESP32
- Arduino IDE o PlatformIO para compilar y flashear

## Preparación de la SD

1. Formatea la tarjeta SD en FAT32.
2. Copia la carpeta `www` desde este repositorio a la raíz de la SD.
3. Inserta la SD en el módulo/slot conectado al ESP32 (CS=GPIO5 por defecto en el firmware).

## Configurar y flashear el firmware

1. Abre `SayDim/SayDim.ino` en Arduino IDE o PlatformIO.
2. Ajusta parámetros de red si quieres otra IP: `local_IP`, `gateway`, `subnet`, `primaryDNS`.
3. Asegura los pines SPI en `SPI.begin(SCK, MISO, MOSI, CS);` si tu placa usa otros pines.
4. Compila y flashea al ESP32.

## Probar la aplicación

1. Inserta la SD y enciende el ESP32.
2. Abre el Monitor Serial a 115200 baudios para inspeccionar mensajes (arranque, SD init, IP).
3. En el navegador visita `http://<esp32_ip>/` (ej. `http://192.168.1.200`).
4. Si ves HTML sin CSS/JS, comprueba `/ls` y revisa la estructura en la SD.

## Subir imágenes desde la web

- Usa los formularios en la UI (para dimensiones y personajes). Las peticiones `POST /upload/*` guardan imágenes y actualizan los JSON en `/data`.

## Pruebas locales

Para desarrollar la UI localmente sin el ESP puedes ejecutar un servidor HTTP simple en la carpeta `www`:

```powershell
# Desde la carpeta www
python -m http.server 8000
# Abrir http://localhost:8000
```

Esto permite depurar CSS/JS sin necesidad de la tarjeta SD ni el ESP (pero las llamadas a `/api` fallarán a menos que crees un mock server).

## Modo sin servidor (mock)

Para trabajar 100% en tu PC sin encender el ESP32, el proyecto incluye un modo de simulación que intercepta las llamadas a la API y devuelve datos falsos:

- Abre `www/index.html` en tu navegador con el parámetro `?mock=1`.
  - Ejemplo: `file:///C:/ruta/a/www/index.html?mock=1`
  - Opcional: si usas un servidor estático (p. ej. `python -m http.server`), visita `http://localhost:8000/index.html?mock=1`.

Qué hace el modo mock:

- Responde a `GET /api/status`, `GET /api/dimensions`, `GET /api/characters` con datos simulados en memoria.
- Simula `POST /upload/dimension` y `POST /upload/character` devolviendo `200 OK` y agregando entradas en memoria (no persiste en disco).
- Las rutas de imágenes `/asset/...` no existen en mock; las entradas simuladas usan URLs HTTP de ejemplo para que se muestren imágenes.

Para desactivar el mock, elimina `?mock=1` de la URL.

## Copias de seguridad

Haz copia de `/data/*.json` regularmente si añades muchas dimensiones/personajes.
