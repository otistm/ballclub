import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // point at engine source so dev/build never needs a separate engine build
      '@ballclub/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url))
    }
  },
  server: {
    port: 5173
  },
  build: {
    target: 'es2022',
    sourcemap: true
  }
});
