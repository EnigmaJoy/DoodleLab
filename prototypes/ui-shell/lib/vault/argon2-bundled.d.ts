// Type shim for the WASM-bundled build of argon2-browser.
// argon2-bundled.min.js embeds the WASM binary as a base64 data URI — no separate
// WASM file fetch, no require('fs'), no Node.js built-ins. Safe for Next.js / Turbopack.
// The public API is identical to the main argon2-browser package.
declare module 'argon2-browser/dist/argon2-bundled.min.js' {
  import type Argon2Browser from 'argon2-browser'
  const argon2: typeof Argon2Browser
  export = argon2
}
