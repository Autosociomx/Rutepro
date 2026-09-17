/**
 * Toma lo que produjo `vite build --config vite.demo.config.ts` y lo funde en
 * UN solo archivo .html: el guion y los estilos quedan incrustados, de modo
 * que el archivo se pueda mandar por WhatsApp o copiar en una memoria y
 * abrirse con doble clic, sin internet.
 *
 * Cuidado con el orden: cualquier retoque al HTML (comentarios, etiquetas) va
 * ANTES de incrustar el guion. El paquete contiene plantillas de impresión con
 * etiquetas como </head> dentro de cadenas de texto, y un reemplazo hecho
 * después las tomaría por HTML real y partiría el archivo a la mitad.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(raiz, 'demo-dist');
const salidaDir = path.join(raiz, 'demo');
const salida = path.join(salidaDir, 'RutePro-Demo-Panaderia.html');

// Vite conserva la ruta relativa de la entrada: el HTML puede quedar en
// demo-dist/ o en demo-dist/demo/.
const candidatos = [path.join(dist, 'index.html'), path.join(dist, 'demo', 'index.html')];
const rutaHtml = candidatos.find((c) => existsSync(c));
if (!rutaHtml) throw new Error('No se encontró el HTML generado en demo-dist/.');

const js = readFileSync(path.join(dist, 'demo.js'), 'utf8');
const rutaCss = path.join(dist, 'demo.css');
const css = existsSync(rutaCss) ? readFileSync(rutaCss, 'utf8') : '';

// 1) Retoques al HTML, con el guion todavía fuera.
let resultado = readFileSync(rutaHtml, 'utf8').replace(
  '</head>',
  `  <!--
    RutePro · Demostración de un solo archivo.
    Funciona sin internet y sin base de datos: todo se guarda en este
    navegador. Nada de lo que se capture aquí sale de la computadora.
  -->
</head>`
);

// 2) El guion se incrusta codificado en base64 y se ejecuta al abrir la
//    página. Suena rebuscado, pero es lo único confiable: el paquete lleva
//    plantillas de impresión con etiquetas HTML dentro de cadenas de texto, y
//    el analizador del navegador las confunde con marcado real y parte el
//    archivo a la mitad. En base64 no hay ni un «<» que pueda malinterpretar.
const paquete = Buffer.from(js, 'utf8').toString('base64');

const cargador = `<script id="rp-paquete" type="application/rutepro">${paquete}</script>
<script>
  (function () {
    var b64 = document.getElementById('rp-paquete').textContent.trim();
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var codigo = new TextDecoder('utf-8').decode(bytes);
    // El guion original era un módulo (se ejecutaba al final del documento).
    // Como aquí es un guion clásico dentro del <head>, hay que esperar a que
    // exista el <body>; si no, la app no encuentra dónde montarse.
    var arrancar = function () { (0, eval)(codigo); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', arrancar);
    } else {
      arrancar();
    }
  })();
</script>`;

// 3) Incrustar. Se usa una función como reemplazo: con una cadena, secuencias
//    como `$&` dentro del paquete se interpretarían como referencias a la
//    coincidencia.
resultado = resultado
  .replace(/<script[^>]*src="[^"]*demo\.js"[^>]*><\/script>/i, () => cargador)
  .replace(/<link[^>]*href="[^"]*demo\.css"[^>]*>/i, () => (css ? `<style>\n${css}\n</style>` : ''));

if (/<script[^>]*src=/.test(resultado) || /<link[^>]*stylesheet/.test(resultado)) {
  throw new Error('Quedaron recursos externos sin incrustar: el archivo no sería autónomo.');
}

if (!existsSync(salidaDir)) mkdirSync(salidaDir, { recursive: true });
writeFileSync(salida, resultado, 'utf8');

const mb = (Buffer.byteLength(resultado, 'utf8') / 1048576).toFixed(2);
console.log(`✓ Demostración empaquetada: demo/${path.basename(salida)} (${mb} MB)`);
