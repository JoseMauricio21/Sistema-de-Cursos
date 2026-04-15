import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
  },
  server: {
    port: 3000,
    open: true,
  },
})
