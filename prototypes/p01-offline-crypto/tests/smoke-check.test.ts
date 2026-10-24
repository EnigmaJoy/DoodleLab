import { describe, expect, it, vi } from 'vitest';
import { SUBTLE_METHODS, runSmokeCheck, type SmokeEnvironment } from '../src/smoke-check';

const FIXED_NOW = () => new Date('2026-01-01T00:00:00.000Z');

function fakeSubtle() {
  return Object.fromEntries(SUBTLE_METHODS.map((name) => [name, vi.fn()]));
}

function fullEnvironment(overrides: Partial<SmokeEnvironment> = {}): SmokeEnvironment {
  return {
    isSecureContext: true,
    crypto: { subtle: fakeSubtle(), getRandomValues: vi.fn() },
    indexedDB: { open: vi.fn(), deleteDatabase: vi.fn() },
    navigator: { userAgent: 'SyntheticAgent/1.0', vendor: 'Synthetic', maxTouchPoints: 0 },
    location: { origin: 'http://localhost:5173' },
    ...overrides,
  };
}

function statusOf(env: SmokeEnvironment, id: string) {
  return runSmokeCheck(env, FIXED_NOW).checks.find((check) => check.id === id)?.status;
}

describe('runSmokeCheck', () => {
  it('reports every API as exposed when every API is present', () => {
    const report = runSmokeCheck(fullEnvironment(), FIXED_NOW);
    expect(report.allApisExposed).toBe(true);
    expect(report.checks.map((check) => check.status)).toEqual(['ok', 'ok', 'ok']);
    expect(report.checkedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('declares its scope as environment evidence ENV-00, never as crypto validation', () => {
    for (const env of [fullEnvironment(), fullEnvironment({ crypto: undefined, indexedDB: undefined })]) {
      const report = runSmokeCheck(env, FIXED_NOW);
      expect(report.evidenceId).toBe('ENV-00');
      expect(report.scope).toBe('api-presence-only');
      expect(report.cryptoValidated).toBe(false);
      expect(report).not.toHaveProperty('allPassed');
    }
  });

  it('states that algorithm support is not verified', () => {
    const webCrypto = runSmokeCheck(fullEnvironment(), FIXED_NOW).checks.find((check) => check.id === 'web-crypto');
    expect(webCrypto?.detail).toContain('algorithm support is not verified');
  });

  it('collects reproducibility info about the browser', () => {
    const report = runSmokeCheck(fullEnvironment(), FIXED_NOW);
    expect(report.browser).toEqual({
      userAgent: 'SyntheticAgent/1.0',
      vendor: 'Synthetic',
      maxTouchPoints: 0,
      origin: 'http://localhost:5173',
    });
  });

  it('fails the secure context check unless isSecureContext is exactly true', () => {
    expect(statusOf(fullEnvironment({ isSecureContext: false }), 'secure-context')).toBe('fail');
    expect(statusOf(fullEnvironment({ isSecureContext: undefined }), 'secure-context')).toBe('fail');
    expect(statusOf(fullEnvironment({ isSecureContext: 'true' }), 'secure-context')).toBe('fail');
  });

  it('fails the Web Crypto check when crypto.subtle is missing', () => {
    expect(statusOf(fullEnvironment({ crypto: { getRandomValues: vi.fn() } }), 'web-crypto')).toBe('fail');
    expect(statusOf(fullEnvironment({ crypto: undefined }), 'web-crypto')).toBe('fail');
  });

  it('lists the missing crypto.subtle methods', () => {
    const subtle = fakeSubtle();
    delete subtle['wrapKey'];
    const report = runSmokeCheck(fullEnvironment({ crypto: { subtle, getRandomValues: vi.fn() } }), FIXED_NOW);
    const webCrypto = report.checks.find((check) => check.id === 'web-crypto');
    expect(webCrypto?.status).toBe('fail');
    expect(webCrypto?.detail).toContain('wrapKey');
    expect(report.allApisExposed).toBe(false);
  });

  it('fails the IndexedDB check when indexedDB is missing', () => {
    expect(statusOf(fullEnvironment({ indexedDB: undefined }), 'indexeddb')).toBe('fail');
    expect(statusOf(fullEnvironment({ indexedDB: {} }), 'indexeddb')).toBe('fail');
  });

  it('is non-invasive: it never invokes Web Crypto or IndexedDB', () => {
    const env = fullEnvironment();
    runSmokeCheck(env, FIXED_NOW);
    const crypto = env.crypto as { subtle: Record<string, ReturnType<typeof vi.fn>>; getRandomValues: ReturnType<typeof vi.fn> };
    const indexedDB = env.indexedDB as Record<string, ReturnType<typeof vi.fn>>;
    for (const fn of [...Object.values(crypto.subtle), crypto.getRandomValues, ...Object.values(indexedDB)]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('degrades gracefully when navigator and location are unavailable', () => {
    const report = runSmokeCheck(fullEnvironment({ navigator: undefined, location: null }), FIXED_NOW);
    expect(report.browser).toEqual({ userAgent: 'unknown', vendor: 'unknown', maxTouchPoints: null, origin: 'unknown' });
  });
});
