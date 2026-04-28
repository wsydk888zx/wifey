import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@wifey/story-core': resolve(__dirname, '../../packages/story-core/src/index.js'),
      '@wifey/story-content': resolve(__dirname, '../../packages/story-content/src/index.js'),
    },
  },
});
