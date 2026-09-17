/**
 * Compilación de la DEMOSTRACIÓN: un solo archivo HTML que se abre con doble
 * clic, sin servidor, sin internet y sin base de datos.
 *
 * Cambia dos módulos por sus versiones locales (la capa de datos y el cliente
 * de Supabase) y empaqueta todo en formato clásico, para que funcione incluso
 * abriendo el archivo desde el escritorio (protocolo file://).
 */

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const raiz = path.dirname(fileURLToPath(import.meta.url));

function intercambiarPorDemo() {
  return {
    name: 'rp-intercambio-demo',
    enforce: 'pre' as const,
    async resolveId(this: any, source: string, importer: string | undefined, options: any) {
      if (!importer) return null;
      const resuelto = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resuelto) return null;
      const archivo = resuelto.id.split('?')[0];
      if (archivo === path.resolve(raiz, 'src/lib/db.ts')) return path.resolve(raiz, 'demo/db.demo.ts');
      if (archivo === path.resolve(raiz, 'src/supabase.ts')) return path.resolve(raiz, 'demo/supabase.demo.ts');
      return null;
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [intercambiarPorDemo(), react(), tailwindcss()],
  define: {
    'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify('')
  },
  build: {
    outDir: 'demo-dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: path.resolve(raiz, 'demo/index.html'),
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'demo.js',
        assetFileNames: 'demo.[ext]'
      }
    }
  }
});
