import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'

/**
 * Intercept *.module.css imports during tests and return a Proxy that maps
 * every class name key back to itself.  This avoids running the Tailwind v4
 * PostCSS plugin (which crashes in jsdom) while still letting CSS-module
 * imports compile cleanly.
 */
/**
 * The virtual ID must NOT end with .css or Vite's css plugin will grab it.
 * We use the \0 convention + a .js extension to stay invisible to css:process.
 */
const CSS_MODULE_STUB_RE = /\.module\.css(\?.*)?$/

function cssModuleStubPlugin(): Plugin {
  return {
    name: 'vitest:css-module-stub',
    enforce: 'pre',
    resolveId(id) {
      if (CSS_MODULE_STUB_RE.test(id)) {
        // Virtual module id — must not end with .css
        return '\0css-module-stub.js'
      }
    },
    load(id) {
      if (id === '\0css-module-stub.js') {
        return `
const handler = { get(_, prop) { return prop } }
export default new Proxy({}, handler)
`
      }
    },
  }
}

export default defineConfig({
  plugins: [cssModuleStubPlugin(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
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
