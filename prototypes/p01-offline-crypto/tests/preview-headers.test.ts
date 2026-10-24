import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build, preview, type PreviewServer } from 'vite';
import { PREVIEW_SECURITY_HEADERS } from '../vite.config';

// ENV-01: checks that `vite preview` really sends the security headers over HTTP.
// It verifies header presence only, not how a browser enforces the CSP (that is ENV-02, manual in Safari).

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const OUT_DIR = 'node_modules/.tmp/preview-headers-test';
const PORT = 4180;

let server: PreviewServer | undefined;

async function get(path: string) {
  return fetch(new URL(path, `http://localhost:${PORT}`));
}

function expectSecurityHeaders(response: Response) {
  for (const [name, value] of Object.entries(PREVIEW_SECURITY_HEADERS)) {
    expect(response.headers.get(name), name).toBe(value);
  }
}

beforeAll(async () => {
  await build({ root: ROOT, logLevel: 'silent', build: { outDir: OUT_DIR, emptyOutDir: true } });
  server = await preview({
    root: ROOT,
    logLevel: 'silent',
    build: { outDir: OUT_DIR },
    preview: { port: PORT, strictPort: true, open: false },
  });
}, 60_000);

afterAll(async () => {
  await server?.close();
});

describe('vite preview security headers', () => {
  it('sends every security header on the HTML page', async () => {
    const response = await get('/');
    expect(response.status).toBe(200);
    expectSecurityHeaders(response);
  });

  it('sends every security header on the built script and stylesheet', async () => {
    const html = await (await get('/')).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1] ?? '');
    expect(assets.length).toBeGreaterThanOrEqual(2);
    for (const asset of assets) {
      const response = await get(asset);
      expect(response.status, asset).toBe(200);
      expectSecurityHeaders(response);
    }
  });

  it('uses a CSP without unsafe sources', () => {
    const csp = PREVIEW_SECURITY_HEADERS['Content-Security-Policy'];
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/unsafe-|\*|data:|blob:/);
  });

  it('builds HTML without inline scripts or styles, so the CSP does not block the page', async () => {
    const html = await (await get('/')).text();
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/<style[\s>]/);
    expect(html).not.toMatch(/\sstyle="/);
  });
});
