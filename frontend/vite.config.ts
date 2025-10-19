import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';
import path from 'path';

export default defineConfig({
  plugins: [
    svelte({
      preprocess: sveltePreprocess(),
    }),
  ],
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, './src/lib'),
      $components: path.resolve(__dirname, './src/components'),
    },
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.json', '.svelte'],
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
