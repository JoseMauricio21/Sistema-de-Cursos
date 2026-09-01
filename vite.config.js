import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Use built-in esbuild minifier to avoid optional terser dependency in CI.
    minify: 'esbuild',
  },
  server: {
    port: 3000,
    open: true,
  },
})
