import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Huit pages : l'accueil, les quatre documents légaux, la page du lien de
// confirmation de la liste d'attente (build 16) et les deux pages de passage
// des e-mails d'authentification de l'app (compte/, build 17). Chacune a son
// index.html dans son dossier, ce qui donne des adresses propres sur
// GitHub Pages (/cgu/ sert cgu/index.html), sans extension ni redirection.
export default defineConfig({
  base: '/',
  server: { port: 5173, strictPort: true, host: '127.0.0.1' },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        accueil: resolve(import.meta.dirname, 'index.html'),
        mentions: resolve(import.meta.dirname, 'mentions-legales/index.html'),
        confidentialite: resolve(import.meta.dirname, 'confidentialite/index.html'),
        cgu: resolve(import.meta.dirname, 'cgu/index.html'),
        cookies: resolve(import.meta.dirname, 'cookies/index.html'),
        confirmer: resolve(import.meta.dirname, 'confirmer/index.html'),
        compteConfirmer: resolve(import.meta.dirname, 'compte/confirmer/index.html'),
        compteMotDePasse: resolve(import.meta.dirname, 'compte/mot-de-passe/index.html'),
      },
    },
  },
});
