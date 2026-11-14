import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: permite publicar em subpastas (ex.: GitHub Pages)
  base: './',
  // O FFmpeg.wasm cria um Web Worker internamente; o Vite não pode "pré-empacotar"
  // essas libs, senão o worker quebra.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  worker: {
    format: 'es',
  },
});
