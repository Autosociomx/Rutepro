/**
 * Toma lo que produjo `vite build --config vite.demo.config.ts` y lo funde en
 * UN solo archivo .html que se abre con doble clic, sin internet.
 *
 * Dos reglas aprendidas a golpes:
 *
 * 1. El guion va al final del <body>, no en el <head>. El original era un
 *    módulo (se ejecuta al terminar de cargar la página); incrustado tal cual
 *    en el <head> corre antes de que exista el <body> y la aplicación no
 *    encuentra dónde montarse: pantalla negra.
 *
 * 2. Cualquier retoque al HTML va ANTES de incrustar el guion. El paquete
 *    lleva plantillas de impresión con etiquetas como </head> o </body>
 *    dentro de cadenas de texto, y un reemplazo hecho después las tomaría
 *    por marcado real y partiría el archivo a la mitad.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(raiz, 'demo-dist');
const salidaDir = path.join(raiz, 'demo');
const salida = path.join(salidaDir, 'RutePro-Demo-Panaderia.html');

const candidatos = [path.join(dist, 'index.html'), path.join(dist, 'demo', 'index.html')];
const rutaHtml = candidatos.find((c) => existsSync(c));
if (!rutaHtml) throw new Error('No se encontró el HTML generado en demo-dist/.');

const js = readFileSync(path.join(dist, 'demo.js'), 'utf8');
const rutaCss = path.join(dist, 'demo.css');
const css = existsSync(rutaCss) ? readFileSync(rutaCss, 'utf8') : '';

// ── 1. Retoques al HTML, con el guion todavía fuera ──
let resultado = readFileSync(rutaHtml, 'utf8')
  .replace('</head>', `  <!--
    Demostración de RutePro en un solo archivo.
    Funciona sin internet y sin base de datos: todo se guarda en este
    navegador. Nada de lo que se capture aquí sale de la computadora.
  -->
</head>`)
  // Los estilos sí van en el <head>, para que no haya un parpadeo sin formato.
  .replace(/<link[^>]*href="[^"]*demo\.css"[^>]*>/i, () => (css ? `<style>\n${css}\n</style>` : ''))
  // Se quita la etiqueta del guion original: se vuelve a poner al final.
  .replace(/<script[^>]*src="[^"]*demo\.js"[^>]*><\/script>\s*/i, () => '');

// ── 2. Secuencias que el analizador de HTML confundiría con marcado ──
const jsSeguro = js
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<!--/g, '<\\!--');

for (const prohibido of ['</script', '<!--']) {
  if (jsSeguro.includes(prohibido)) {
    throw new Error(`El paquete contiene «${prohibido}» sin escapar: rompería el HTML.`);
  }
}

// ── 3. El guion, hasta el final del cuerpo ──
const cierreCuerpo = resultado.lastIndexOf('</body>');
if (cierreCuerpo === -1) throw new Error('El HTML generado no tiene </body>.');
resultado =
  resultado.slice(0, cierreCuerpo) +
  `<script>\n${jsSeguro}\n</script>\n  ` +
  resultado.slice(cierreCuerpo);

if (/<script[^>]*src=/.test(resultado) || /<link[^>]*stylesheet/.test(resultado)) {
  throw new Error('Quedaron recursos externos sin incrustar: el archivo no sería autónomo.');
}

if (!existsSync(salidaDir)) mkdirSync(salidaDir, { recursive: true });
writeFileSync(salida, resultado, 'utf8');

const mb = (Buffer.byteLength(resultado, 'utf8') / 1048576).toFixed(2);
console.log(`✓ Demostración empaquetada: demo/${path.basename(salida)} (${mb} MB)`);
