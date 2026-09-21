# Comimos Acá

Catálogo personal de restaurantes visitados: filtros por barrio/localidad/provincia,
momento del día, precio y puntuación, más un mapa y una ficha de detalle por lugar.

Es una web **estática**: no tiene servidor propio ni base de datos. Todos los
77 lugares viven en `data.js`, generado a partir de `data/lugares-completo.csv`.
Por eso no hace falta pagar hosting ni dominio para tenerla funcionando y
compartirla con quien quieras.

## Ver la web en tu computadora (antes de publicarla)

No hace falta instalar nada especial. Alcanza con:

1. Abrir esta carpeta en una terminal.
2. Correr un servidor local simple (Python ya viene instalado en Mac/Linux; en
   Windows con Python instalado también funciona):

   ```
   python3 -m http.server 8000
   ```

3. Abrir en el navegador: `http://localhost:8000`

(Abrir `index.html` directamente con doble clic también funciona para mirar el
diseño, pero el mapa puede no cargar bien por restricciones del navegador con
archivos locales — para probar todo de verdad, mejor usar el servidor local.)

## Actualizar los datos (agregar un lugar nuevo o corregir un puntaje)

1. Editar `data/lugares-completo.csv` (podés abrirlo con Excel/Google Sheets;
   guardalo de nuevo como CSV, o pedile a Claude que lo edite).
2. Correr:

   ```
   python3 tools/build_data.py
   ```

   Esto regenera `data.js` a partir del CSV. Si agregaste un lugar en un
   barrio nuevo que el script no conoce, te va a avisar por consola — en ese
   caso hay que sumar sus coordenadas a mano en el diccionario `COORDS` de
   `tools/build_data.py` (buscando el barrio en Google Maps y copiando
   latitud/longitud).
3. Subir los cambios a GitHub (ver abajo) para que se actualice la web publicada.

## Publicarla gratis (sin comprar dominio)

### 1. Subir el proyecto a GitHub

1. Crear una cuenta en [github.com](https://github.com) (gratis).
2. Crear un repositorio nuevo, por ejemplo `comimos-aca` (puede ser privado
   o público, cualquiera de las dos opciones sirve para el paso siguiente).
3. Subir el contenido de esta carpeta a ese repositorio. La forma más simple
   si no usaste git antes:
   - En la página del repo recién creado, usar "uploading an existing file"
     y arrastrar todos los archivos de esta carpeta (manteniendo la
     estructura de subcarpetas `data/` y `tools/`).
   - O, si preferís la terminal:
     ```
     git init
     git add .
     git commit -m "Primera versión de Comimos Acá"
     git branch -M main
     git remote add origin https://github.com/TU-USUARIO/comimos-aca.git
     git push -u origin main
     ```

### 2. Conectarlo a Vercel o Netlify (elegí cualquiera de las dos, ambas gratis)

**Con Vercel:**
1. Entrar a [vercel.com](https://vercel.com) y crear cuenta con tu usuario de GitHub.
2. "Add New… → Project" y elegir el repositorio `comimos-aca`.
3. Como es un sitio estático (sin build), dejar todo por defecto y darle "Deploy".
4. En un minuto te da un link tipo `comimos-aca.vercel.app` — ese es el que compartís.

**Con Netlify:**
1. Entrar a [netlify.com](https://netlify.com) y crear cuenta con tu usuario de GitHub.
2. "Add new site → Import an existing project" y elegir el repo.
3. Dejar la configuración de build vacía (no hace falta build command ni carpeta
   de salida especial) y darle "Deploy".
4. Te da un link tipo `comimos-aca.netlify.app`.

Cualquiera de las dos opciones vuelve a publicar la web automáticamente cada
vez que subas un cambio nuevo al repositorio de GitHub (por ejemplo, después
de correr `build_data.py` con lugares nuevos).

### (Opcional) Dominio propio

Si en algún momento querés algo tipo `comimosaca.com.ar` en vez del link
gratuito, se compra en un registrador de dominios (Namecheap, Cloudflare,
NIC.ar para `.com.ar`) y se conecta desde el panel de Vercel/Netlify en
"Domains" siguiendo sus instrucciones — no hace falta tocar nada del código.

## De qué está hecho

- HTML/CSS/JS simple, sin frameworks ni paso de build.
- Mapa con [Leaflet](https://leafletjs.com/) y tiles de
  [OpenStreetMap](https://www.openstreetmap.org/copyright) (gratis, sin API key).
- Fuentes: Newsreader + Work Sans (Google Fonts).
- Las coordenadas de los pines son aproximadas (centro del barrio/localidad),
  no la dirección exacta de cada lugar — ver el comentario en `tools/build_data.py`.
