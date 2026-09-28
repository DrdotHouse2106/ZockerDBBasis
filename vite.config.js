import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

const backend = `http://localhost:${process.env.PORT || 3000}`;

// Oberfläche eines Zusatzmoduls (zockerdb.de) – fehlt es oder ist ZOCKERDB_MODULE=aus, entsteht die Basis-Version
const modulDatei = path.resolve('geschaeft/client/index.jsx');
const modulAus = ['aus', 'false', '0', 'nein'].includes(String(process.env.ZOCKERDB_MODULE ?? '').toLowerCase());
const modul = !modulAus && fs.existsSync(modulDatei) ? modulDatei : path.resolve('client/src/modul-leer.js');

export default defineConfig({
  root: 'client',
  publicDir: 'public',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@zockerdb/modul': modul },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
    // Das Modul liegt außerhalb von client/
    fs: { allow: ['.'] },
    proxy: {
      '/api': backend,
      '/uploads': backend,
    },
  },
});
