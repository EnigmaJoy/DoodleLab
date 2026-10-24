// Non-invasive capability check for P-01.
// It only inspects whether APIs exist: it never calls crypto.subtle, never generates keys,
// never opens an IndexedDB database and never persists anything.

export interface SmokeEnvironment {
  readonly isSecureContext: unknown;
  readonly crypto: unknown;
  readonly indexedDB: unknown;
  readonly navigator: unknown;
  readonly location: unknown;
}

export type CheckStatus = 'ok' | 'fail';

export interface CheckResult {
  readonly id: 'secure-context' | 'web-crypto' | 'indexeddb';
  readonly label: string;
  readonly status: CheckStatus;
  readonly detail: string;
}

export interface BrowserInfo {
  readonly userAgent: string;
  readonly vendor: string;
  readonly maxTouchPoints: number | null;
  readonly origin: string;
}

// The report is environment evidence ENV-00 only: it must never be read as a P01-xx result.
export interface SmokeReport {
  readonly evidenceId: 'ENV-00';
  readonly scope: 'api-presence-only';
  readonly cryptoValidated: false;
  readonly checkedAt: string;
  readonly allApisExposed: boolean;
  readonly checks: readonly CheckResult[];
  readonly browser: BrowserInfo;
}

export const SUBTLE_METHODS = [
  'encrypt',
  'decrypt',
  'sign',
  'verify',
  'digest',
  'generateKey',
  'deriveKey',
  'deriveBits',
  'importKey',
  'exportKey',
  'wrapKey',
  'unwrapKey',
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function hasFunction(target: unknown, name: string): boolean {
  return isObject(target) && typeof target[name] === 'function';
}

function readString(target: unknown, name: string): string {
  if (!isObject(target)) return 'unknown';
  const value = target[name];
  return typeof value === 'string' ? value : 'unknown';
}

function checkSecureContext(env: SmokeEnvironment): CheckResult {
  const secure = env.isSecureContext === true;
  return {
    id: 'secure-context',
    label: 'Secure Context',
    status: secure ? 'ok' : 'fail',
    detail: secure
      ? 'window.isSecureContext is true'
      : 'window.isSecureContext is not true: use https or http://localhost',
  };
}

function checkWebCrypto(env: SmokeEnvironment): CheckResult {
  const subtle = isObject(env.crypto) ? env.crypto['subtle'] : undefined;
  if (!isObject(subtle)) {
    return {
      id: 'web-crypto',
      label: 'Web Crypto (crypto.subtle)',
      status: 'fail',
      detail: 'crypto.subtle is not exposed (it requires a Secure Context)',
    };
  }
  const missing: string[] = SUBTLE_METHODS.filter((name) => !hasFunction(subtle, name));
  if (!hasFunction(env.crypto, 'getRandomValues')) missing.push('crypto.getRandomValues');
  return {
    id: 'web-crypto',
    label: 'Web Crypto (crypto.subtle)',
    status: missing.length === 0 ? 'ok' : 'fail',
    detail:
      missing.length === 0
        ? `crypto.subtle exposes ${SUBTLE_METHODS.length} methods and crypto.getRandomValues is present (presence only, nothing invoked: algorithm support is not verified)`
        : `missing: ${missing.join(', ')}`,
  };
}

function checkIndexedDB(env: SmokeEnvironment): CheckResult {
  const present = hasFunction(env.indexedDB, 'open');
  return {
    id: 'indexeddb',
    label: 'IndexedDB',
    status: present ? 'ok' : 'fail',
    detail: present
      ? 'indexedDB.open is present (no database opened: real availability, quota and eviction are not verified)'
      : 'indexedDB is not exposed',
  };
}

function collectBrowserInfo(env: SmokeEnvironment): BrowserInfo {
  const touch = isObject(env.navigator) ? env.navigator['maxTouchPoints'] : undefined;
  return {
    userAgent: readString(env.navigator, 'userAgent'),
    vendor: readString(env.navigator, 'vendor'),
    maxTouchPoints: typeof touch === 'number' ? touch : null,
    origin: readString(env.location, 'origin'),
  };
}

export function runSmokeCheck(env: SmokeEnvironment, now: () => Date = () => new Date()): SmokeReport {
  const checks = [checkSecureContext(env), checkWebCrypto(env), checkIndexedDB(env)];
  return {
    evidenceId: 'ENV-00',
    scope: 'api-presence-only',
    cryptoValidated: false,
    checkedAt: now().toISOString(),
    allApisExposed: checks.every((check) => check.status === 'ok'),
    checks,
    browser: collectBrowserInfo(env),
  };
}
