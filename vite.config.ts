import { defineConfig } from 'vite';

// For GitHub Pages project sites, the app is served from /<repo-name>/.
// Set BASE_PATH at build time (the deploy workflow does this) or override here.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
