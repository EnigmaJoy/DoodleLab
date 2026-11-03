import argon2 from 'argon2-browser'

export interface Argon2Params {
  memory:      number   // KB, default 65536 (64 MB)
  iterations:  number   // default 3
  parallelism: number   // default 1
  hashLength:  number   // default 32 bytes
}

const DEFAULTS: Argon2Params = {
  memory:      65536,
  iterations:  3,
  parallelism: 1,
  hashLength:  32,
}

/**
 * In Node.js environments (tests), argon2-browser's Emscripten dist tries to
 * load the WASM via fetch(), which fails. We pre-configure globalThis.self with
 * a custom instantiateWasm hook so the WASM bytes are read via fs instead.
 * This is a no-op in browser environments where fetch works normally.
 */
function ensureNodeWasmLoader(): void {
  if (
    typeof process === 'object' &&
    typeof process.versions?.node === 'string' &&
    typeof (globalThis as Record<string, unknown>).self === 'undefined'
  ) {
    const fs  = require('fs')   as typeof import('fs')
    const url = require('url')  as typeof import('url')
    const path = require('path') as typeof import('path')
    const wasmPath = path.resolve(
      path.dirname(url.fileURLToPath(import.meta.url)),
      '../../node_modules/argon2-browser/dist/argon2.wasm',
    )
    ;(globalThis as Record<string, unknown>).self = {
      Module: {
        instantiateWasm(
          imports: WebAssembly.Imports,
          successCallback: (instance: WebAssembly.Instance) => void,
        ) {
          const bytesBuffer = new Uint8Array(fs.readFileSync(wasmPath)).buffer as ArrayBuffer
          WebAssembly.instantiate(bytesBuffer, imports).then((output: WebAssembly.WebAssemblyInstantiatedSource) => {
            successCallback(output.instance)
          })
          return {}
        },
      },
      process,
    }
  }
}

/**
 * Derives a non-extractable AES-256-GCM CryptoKey from a password and salt
 * using Argon2id (OWASP 2023 parameters by default).
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  params?: Partial<Argon2Params>,
): Promise<CryptoKey> {
  ensureNodeWasmLoader()
  const p = { ...DEFAULTS, ...params }
  const result = await argon2.hash({
    pass:        password,
    salt:        salt,
    type:        argon2.ArgonType.Argon2id,
    mem:         p.memory,
    time:        p.iterations,
    parallelism: p.parallelism,
    hashLen:     p.hashLength,
  })
  const hashBuf = new Uint8Array(result.hash).buffer as ArrayBuffer
  return crypto.subtle.importKey(
    'raw',
    hashBuf,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}
