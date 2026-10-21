# Zona Gamer – Catálogo web

Web con todos los productos del proveedor, con portadas y pedido directo por WhatsApp (+54 9 351 384-5195).

## Cómo funciona

1. `scripts/build.js` baja el Excel del proveedor desde Google Drive.
2. `scripts/parse.js` lo lee hoja por hoja y calcula el precio de venta (**costo × 2**).
3. `scripts/images.js` busca la portada de cada juego (Steam y Wikipedia) y la guarda en `data/image-cache.json` para no buscarla de nuevo.
4. Se genera `public/data/catalogo.json`, que es lo que muestra la web (`public/`).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run actualizar` | Baja el Excel y regenera el catálogo |
| `npm run ver` | Abre la web en http://localhost:8080 |
| `npm run reintentar-portadas` | Vuelve a buscar las portadas que no se encontraron |
| `npm run verificar-portadas` | Revisa que todas las portadas guardadas sigan cargando |

## Cambiar cosas

- **Ganancia:** `MARGIN` en `scripts/parse.js` (2 = 100%).
- **WhatsApp:** `WHATSAPP` en `public/app.js` y el texto del pie en `public/index.html`.
- **Logo y colores:** logo en `public/img/` (sacado del manual de marca). Colores en `:root` de `public/styles.css`: rojo #FF0000, verde #00FF00, dorado, negro, blanco y gris #808080.
- **Videos de "Cómo instalar":** pegar los links de YouTube en `public/tutoriales/videos.json`.
- **Portada equivocada o faltante:** agregarla en `data/image-overrides.json`, por ejemplo:
  ```json
  { "Crash Bandicoot Quadrilogy": "https://link-a-la-imagen.jpg" }
  ```
  La clave es el nombre del juego como aparece en `data/image-cache.json`.

## Publicación

La web está en **https://zonagamer.app** (GitHub Pages + dominio en Cloudflare).

En GitHub, `.github/workflows/actualizar.yml` regenera y publica la web en GitHub Pages
todos los días a las 7:00 y a las 15:00, y cada vez que se suben cambios.
