import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// package.json からバージョン番号を読み込む
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    open: true,
    fs: {
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});