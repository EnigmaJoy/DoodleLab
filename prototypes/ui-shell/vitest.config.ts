import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Swap argon2-bundled for a WASM-free test double — the bundled file is
      // browser-only (no ENVIRONMENT_IS_NODE) and crashes in the Vitest worker.
      'argon2-browser/dist/argon2-bundled.min.js': path.resolve(
        __dirname,
        'lib/vault/__mocks__/argon2-bundled.ts',
      ),
    },
  },
})
