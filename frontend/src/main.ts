/**
 * Main entry point for Liquid Democracy Engine frontend
 */

import App from './App.svelte';

const app = new App({
  target: document.getElementById('app')!,
});

export default app;
