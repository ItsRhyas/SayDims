# Layout esperado en la tarjeta SD

Para que SayDim funcione correctamente, la tarjeta SD debe tener la siguiente estructura mínima:

Root of SD (ejemplo)

```
/www/
  index.html
  dimension.html
  character.html
  add.html
  css/
    styles.css
  js/
    app.js
    mock.js
  img/
/data/
  dimensions.json
  characters.json
  order.json
/dimensions/   # imágenes subidas por dimensiones
/characters/   # imágenes subidas por personajes
```

## Puntos importantes

- `www/` contiene la UI estática. El servidor buscará preferentemente `/www/<ruta>`.
- Si copias desde el repo, copia exactamente la carpeta `www` a la raíz de la SD.
- `data/*.json` deben existir (el firmware intentará crearlos si faltan). Si ya existen, deben contener un array JSON válido (por ejemplo `[]`).
- Las imágenes subidas se guardan en `/dimensions` y `/characters` y se referencian desde los objetos JSON como `/dimensions/<id>.jpg`.

## Recomendaciones

- Formatea la SD en FAT32 para mayor compatibilidad.
- Usa una tarjeta de buena calidad y evita velocidades excesivas; el firmware prueba iniciar a 10MHz y luego a la frecuencia por defecto.
- Si el navegador muestra 404, usa el endpoint `/ls` en el ESP (`http://<ip>/ls`) para listar la existencia de rutas comunes.

## Cómo copiar

En Windows, monta la SD y copia el contenido del repo `www` a la raíz de la tarjeta (arrastrar `www` completa). Asegúrate de mantener subcarpetas `css`, `js`, `img`.
