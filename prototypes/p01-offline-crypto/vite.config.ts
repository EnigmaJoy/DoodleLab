import { defineConfig } from 'vitest/config';

// Headers for `vite preview`, the only mode allowed for crypto experiments.
// The dev server cannot use them: HMR needs a WebSocket and Vite injects CSS as inline styles.
// CSP reduces the XSS surface but is not a complete defense against a compromised origin.
export const PREVIEW_SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
} as const;

export default defineConfig({
  server: {
    // Bind to loopback only: http://localhost is a Secure Context, LAN addresses over HTTP are not.
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: 'localhost',
    port: 4173,
    strictPort: true,
    headers: PREVIEW_SECURITY_HEADERS,
  },
  test: {
    // The smoke check receives its environment as a parameter, so no DOM emulation is needed.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
