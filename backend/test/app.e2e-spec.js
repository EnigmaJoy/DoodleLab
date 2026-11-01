"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env['SESSION_SECRET'] = 'a'.repeat(32);
process.env['TOKEN_ENCRYPTION_KEY'] = 'a'.repeat(64);
process.env['KEYCLOAK_BFF_CLIENT_SECRET'] = 'test-secret';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['FRONTEND_URL'] = 'http://localhost:3000';
const testing_1 = require("@nestjs/testing");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const app_module_1 = require("../src/app.module");
const migration_runner_service_1 = require("../src/auth/migration-runner.service");
const app_bootstrap_service_1 = require("../src/app-bootstrap.service");
const oidc_client_service_1 = require("../src/auth/oidc/oidc-client.service");
const session_store_interface_1 = require("../src/auth/types/session-store.interface");
const pending_auth_store_1 = require("../src/auth/providers/pending-auth.store");
const pg_module_1 = require("../src/database/pg.module");
const in_memory_session_store_1 = require("../src/auth/providers/in-memory-session.store");
const token_crypto_1 = require("../src/auth/token/token-crypto");
class InMemoryPendingAuthStore {
    constructor() {
        this.rows = new Map();
    }
    seed(id, row) { this.rows.set(id, row); }
    async create(flow) {
        const { randomBytes } = await Promise.resolve().then(() => require('crypto'));
        const id = randomBytes(32).toString('hex');
        const state = randomBytes(32).toString('hex');
        const nonce = randomBytes(32).toString('hex');
        const codeVerifier = randomBytes(64).toString('hex');
        const row = { id, state, nonce, codeVerifier, flow, expiresAt: new Date(Date.now() + 600_000) };
        this.rows.set(id, row);
        return { id, state, nonce, codeVerifier };
    }
    async consume(id, state) {
        const row = this.rows.get(id);
        if (!row || row.state !== state || row.expiresAt <= new Date()) {
            return undefined;
        }
        this.rows.delete(id);
        return { nonce: row.nonce, codeVerifier: row.codeVerifier, flow: row.flow };
    }
}
const mockOidc = {
    buildAuthorizationUrl: jest.fn().mockReturnValue('http://keycloak/auth?state=s&code_challenge=c&nonce=n'),
    exchangeCode: jest.fn(),
    revokeToken: jest.fn().mockResolvedValue(undefined),
    buildLogoutUrl: jest.fn().mockReturnValue('http://keycloak/logout?id_token_hint=x&post_logout_redirect_uri=http://localhost:3000'),
};
const mockPgPool = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }), connect: jest.fn() };
describe('Agenda API (e2e)', () => {
    let app;
    beforeAll(async () => {
        const moduleRef = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        })
            .overrideProvider(migration_runner_service_1.MigrationRunnerService)
            .useValue({ onApplicationBootstrap: async () => undefined })
            .overrideProvider(app_bootstrap_service_1.AppBootstrapService)
            .useValue({ onApplicationBootstrap: async () => undefined })
            .overrideProvider(oidc_client_service_1.OidcClientService)
            .useValue(mockOidc)
            .overrideProvider(session_store_interface_1.SESSION_STORE)
            .useValue(new in_memory_session_store_1.InMemorySessionStore())
            .overrideProvider(pending_auth_store_1.PendingAuthStore)
            .useValue(new InMemoryPendingAuthStore())
            .overrideProvider(pg_module_1.PG_POOL)
            .useValue(mockPgPool)
            .compile();
        app = moduleRef.createNestApplication();
        app.use(cookieParser());
        app.setGlobalPrefix('api');
        await app.init();
    });
    afterAll(async () => {
        await app.close();
    });
    describe('GET /api/health', () => {
        it('returns 200 with status ok without any authentication', async () => {
            const res = await request(app.getHttpServer()).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: 'ok' });
        });
    });
    describe('protected endpoints', () => {
        it('GET /api/auth/me returns 401 without any cookie', async () => {
            const res = await request(app.getHttpServer()).get('/api/auth/me');
            expect(res.status).toBe(401);
        });
        it('GET /api/auth/me returns 401 with a fabricated session_id cookie', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/auth/me')
                .set('Cookie', 'session_id=fabricated-session-that-does-not-exist');
            expect(res.status).toBe(401);
        });
        it('GET /api/auth/me returns 401 when a raw Bearer token is supplied in the Authorization header', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/auth/me')
                .set('Authorization', 'Bearer some.fake.jwt');
            expect(res.status).toBe(401);
        });
        it('401 response body does not contain session or token details', async () => {
            const res = await request(app.getHttpServer())
                .get('/api/auth/me')
                .set('Cookie', 'session_id=leaking-test');
            expect(res.status).toBe(401);
            const body = JSON.stringify(res.body);
            expect(body).not.toContain('leaking-test');
            expect(body).not.toContain('session_id');
            expect(body).not.toContain('stack');
        });
    });
});
describe('Auth endpoints (e2e)', () => {
    let app;
    let inMemorySessionStore;
    let inMemoryPendingAuthStore;
    beforeAll(async () => {
        inMemorySessionStore = new in_memory_session_store_1.InMemorySessionStore();
        inMemoryPendingAuthStore = new InMemoryPendingAuthStore();
        jest.clearAllMocks();
        const moduleRef = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        })
            .overrideProvider(migration_runner_service_1.MigrationRunnerService)
            .useValue({ onApplicationBootstrap: async () => undefined })
            .overrideProvider(app_bootstrap_service_1.AppBootstrapService)
            .useValue({ onApplicationBootstrap: async () => undefined })
            .overrideProvider(oidc_client_service_1.OidcClientService)
            .useValue(mockOidc)
            .overrideProvider(session_store_interface_1.SESSION_STORE)
            .useValue(inMemorySessionStore)
            .overrideProvider(pending_auth_store_1.PendingAuthStore)
            .useValue(inMemoryPendingAuthStore)
            .overrideProvider(pg_module_1.PG_POOL)
            .useValue({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }), connect: jest.fn() })
            .compile();
        app = moduleRef.createNestApplication();
        app.use(cookieParser());
        app.setGlobalPrefix('api');
        await app.init();
    });
    afterAll(async () => { await app.close(); });
    it('GET /api/auth/login returns 302 with auth_tx cookie HttpOnly SameSite=Lax', async () => {
        const res = await request(app.getHttpServer()).get('/api/auth/login');
        expect(res.status).toBe(302);
        const setCookie = (res.headers['set-cookie'] ?? []);
        const txCookie = setCookie.find((c) => c.startsWith('auth_tx='));
        expect(txCookie).toBeTruthy();
        expect(txCookie).toMatch(/HttpOnly/i);
        expect(txCookie).toMatch(/SameSite=Lax/i);
    });
    it('auth_tx value is an opaque hex string (not JWT, not JSON)', async () => {
        const res = await request(app.getHttpServer()).get('/api/auth/login');
        const setCookie = (res.headers['set-cookie'] ?? []);
        const txCookie = setCookie.find((c) => c.startsWith('auth_tx='));
        const value = txCookie.split(';')[0].split('=')[1];
        expect(value).toMatch(/^[0-9a-f]+$/);
        expect(() => JSON.parse(value)).toThrow();
        expect(value.split('.').length).not.toBe(3);
    });
    it('GET /api/auth/register returns 302 with auth_tx cookie', async () => {
        const res = await request(app.getHttpServer()).get('/api/auth/register');
        expect(res.status).toBe(302);
        const setCookie = (res.headers['set-cookie'] ?? []);
        expect(setCookie.some((c) => c.startsWith('auth_tx='))).toBe(true);
    });
    function expectAuthErrorRedirect(res, code) {
        expect(res.status).toBe(302);
        expect(res.headers['location']).toBe(`http://localhost:3000/?auth_error=${code}`);
        const setCookie = (res.headers['set-cookie'] ?? []);
        expect(setCookie.some((c) => c.startsWith('session_id='))).toBe(false);
        expect(setCookie.some((c) => c.startsWith('XSRF-TOKEN='))).toBe(false);
        const txCookie = setCookie.find((c) => c.startsWith('auth_tx='));
        expect(txCookie).toBeTruthy();
        expect(txCookie).toMatch(/Max-Age=0/i);
    }
    function seedPending(id, state, expiresInMs = 60_000) {
        inMemoryPendingAuthStore.seed(id, {
            id, state, nonce: 'n', codeVerifier: 'cv', flow: 'login',
            expiresAt: new Date(Date.now() + expiresInMs),
        });
    }
    it('callback: no auth_tx cookie -> failed', async () => {
        const res = await request(app.getHttpServer()).get('/api/auth/callback?code=x&state=y');
        expectAuthErrorRedirect(res, 'failed');
    });
    it('callback: error=access_denied -> cancelled', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/auth/callback?error=access_denied')
            .set('Cookie', 'auth_tx=some-tx-id');
        expectAuthErrorRedirect(res, 'cancelled');
    });
    it('callback: error=server_error -> failed', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/auth/callback?error=server_error')
            .set('Cookie', 'auth_tx=some-tx-id');
        expectAuthErrorRedirect(res, 'failed');
    });
    it('callback: access_denied with state consumes the pending row; follow-up is failed', async () => {
        seedPending('tx-cancel', 'state-c');
        const first = await request(app.getHttpServer())
            .get('/api/auth/callback?error=access_denied&state=state-c')
            .set('Cookie', 'auth_tx=tx-cancel');
        expectAuthErrorRedirect(first, 'cancelled');
        const second = await request(app.getHttpServer())
            .get('/api/auth/callback?code=c&state=state-c')
            .set('Cookie', 'auth_tx=tx-cancel');
        expectAuthErrorRedirect(second, 'failed');
    });
    it('callback: exchangeCode rejects -> failed', async () => {
        mockOidc.exchangeCode.mockRejectedValueOnce(new Error('boom'));
        seedPending('tx-exch', 'state-exch');
        const res = await request(app.getHttpServer())
            .get('/api/auth/callback?code=c&state=state-exch')
            .set('Cookie', 'auth_tx=tx-exch');
        expectAuthErrorRedirect(res, 'failed');
    });
    it('callback: hostile error params are never reflected', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/auth/callback?error=%3Cscript%3E&error_description=evil')
            .set('Cookie', 'auth_tx=some-tx-id');
        expect(res.status).toBe(302);
        expect(res.headers['location']).toBe('http://localhost:3000/?auth_error=failed');
    });
    it('callback: wrong state -> failed', async () => {
        seedPending('tx-id-1', 'correct-state');
        const res = await request(app.getHttpServer())
            .get('/api/auth/callback?code=c&state=wrong-state')
            .set('Cookie', 'auth_tx=tx-id-1');
        expectAuthErrorRedirect(res, 'failed');
    });
    it('callback: wrong state does not destroy the legitimate transaction', async () => {
        mockOidc.exchangeCode.mockResolvedValueOnce({
            idTokenClaims: { sub: 'u1', acr: '2', nonce: 'n' },
            refreshToken: 'rt', idTokenRaw: 'raw',
        });
        seedPending('tx-keep', 'right-state');
        const bad = await request(app.getHttpServer())
            .get('/api/auth/callback?code=c&state=wrong-state')
            .set('Cookie', 'auth_tx=tx-keep');
        expectAuthErrorRedirect(bad, 'failed');
        const good = await request(app.getHttpServer())
            .get('/api/auth/callback?code=c&state=right-state')
            .set('Cookie', 'auth_tx=tx-keep');
        expect(good.status).toBe(302);
        expect(good.headers['location']).toBe('http://localhost:3000/?view=menu');
        const setCookie = (good.headers['set-cookie'] ?? []);
        expect(setCookie.some((c) => c.startsWith('session_id='))).toBe(true);
        expect(setCookie.some((c) => c.startsWith('XSRF-TOKEN='))).toBe(true);
    });
    it('callback: consume throwing during failure handling still redirects and clears auth_tx', async () => {
        const spy = jest.spyOn(inMemoryPendingAuthStore, 'consume').mockRejectedValueOnce(new Error('db down'));
        try {
            const res = await request(app.getHttpServer())
                .get('/api/auth/callback?error=access_denied&state=x')
                .set('Cookie', 'auth_tx=tx-dbdown');
            expectAuthErrorRedirect(res, 'cancelled');
        }
        finally {
            spy.mockRestore();
        }
    });
    it('callback: expired auth_tx -> failed', async () => {
        seedPending('tx-expired', 'state-x', -1000);
        const res = await request(app.getHttpServer())
            .get('/api/auth/callback?code=c&state=state-x')
            .set('Cookie', 'auth_tx=tx-expired');
        expectAuthErrorRedirect(res, 'failed');
    });
    it('callback: valid acr=2 -> 302; session_id HttpOnly Strict Path=/; XSRF-TOKEN not HttpOnly; auth_tx cleared', async () => {
        mockOidc.exchangeCode.mockResolvedValueOnce({
            idTokenClaims: { sub: 'u1', email: 'u@test.com', acr: '2', nonce: 'n' },
            refreshToken: 'rt',
            idTokenRaw: 'raw-jwt',
        });
        inMemoryPendingAuthStore.seed('tx-ok', {
            id: 'tx-ok', state: 'state-ok', nonce: 'n',
            codeVerifier: 'cv', flow: 'login',
            expiresAt: new Date(Date.now() + 60_000),
        });
        const res = await request(app.getHttpServer())
            .get('/api/auth/callback?code=code-abc&state=state-ok')
            .set('Cookie', 'auth_tx=tx-ok');
        expect(res.status).toBe(302);
        const setCookie = (res.headers['set-cookie'] ?? []);
        const sessionCookie = setCookie.find((c) => c.startsWith('session_id='));
        expect(sessionCookie).toMatch(/HttpOnly/i);
        expect(sessionCookie).toMatch(/SameSite=Strict/i);
        expect(sessionCookie).toMatch(/Path=\//i);
        expect(sessionCookie).not.toMatch(/Max-Age/i);
        const csrfCookie = setCookie.find((c) => c.startsWith('XSRF-TOKEN='));
        expect(csrfCookie).not.toMatch(/HttpOnly/i);
        expect(csrfCookie).toMatch(/SameSite=Strict/i);
        const txCookie = setCookie.find((c) => c.startsWith('auth_tx='));
        expect(txCookie).toMatch(/Max-Age=0/i);
    });
    it('callback: acr absent -> failed', async () => {
        mockOidc.exchangeCode.mockResolvedValueOnce({
            idTokenClaims: { sub: 'u1', nonce: 'n' },
            refreshToken: 'rt', idTokenRaw: 'raw',
        });
        inMemoryPendingAuthStore.seed('tx-no-acr', {
            id: 'tx-no-acr', state: 'state-no-acr', nonce: 'n',
            codeVerifier: 'cv', flow: 'login',
            expiresAt: new Date(Date.now() + 60_000),
        });
        const res = await request(app.getHttpServer())
            .get('/api/auth/callback?code=c&state=state-no-acr')
            .set('Cookie', 'auth_tx=tx-no-acr');
        expectAuthErrorRedirect(res, 'failed');
    });
    it('callback: acr=1 (insufficient) -> failed, no session created', async () => {
        mockOidc.exchangeCode.mockResolvedValueOnce({
            idTokenClaims: { sub: 'u1', acr: '1', nonce: 'n' },
            refreshToken: 'rt', idTokenRaw: 'raw',
        });
        inMemoryPendingAuthStore.seed('tx-acr1', {
            id: 'tx-acr1', state: 'state-acr1', nonce: 'n',
            codeVerifier: 'cv', flow: 'login',
            expiresAt: new Date(Date.now() + 60_000),
        });
        const setSpy = jest.spyOn(inMemorySessionStore, 'set');
        const res = await request(app.getHttpServer())
            .get('/api/auth/callback?code=c&state=state-acr1')
            .set('Cookie', 'auth_tx=tx-acr1');
        try {
            expectAuthErrorRedirect(res, 'failed');
            expect(setSpy).not.toHaveBeenCalled();
        }
        finally {
            setSpy.mockRestore();
        }
    });
    it('callback replay: second call with same auth_tx -> failed', async () => {
        mockOidc.exchangeCode.mockResolvedValueOnce({
            idTokenClaims: { sub: 'u1', acr: '2', nonce: 'n' },
            refreshToken: 'rt', idTokenRaw: 'raw',
        });
        inMemoryPendingAuthStore.seed('tx-replay', {
            id: 'tx-replay', state: 'state-replay', nonce: 'n',
            codeVerifier: 'cv', flow: 'login',
            expiresAt: new Date(Date.now() + 60_000),
        });
        const first = await request(app.getHttpServer())
            .get('/api/auth/callback?code=c&state=state-replay')
            .set('Cookie', 'auth_tx=tx-replay');
        expect(first.status).toBe(302);
        const second = await request(app.getHttpServer())
            .get('/api/auth/callback?code=c&state=state-replay')
            .set('Cookie', 'auth_tx=tx-replay');
        expectAuthErrorRedirect(second, 'failed');
    });
    it('POST /api/auth/logout without session -> 401', async () => {
        const res = await request(app.getHttpServer()).post('/api/auth/logout');
        expect(res.status).toBe(401);
    });
    it('POST /api/auth/logout with valid session -> 200; logoutUrl; cookies cleared', async () => {
        const ENCRYPTION_KEY = 'a'.repeat(64);
        const crypto = new token_crypto_1.TokenCrypto(ENCRYPTION_KEY);
        const sessionId = 'test-logout-session-id';
        await inMemorySessionStore.set(sessionId, {
            user: { sub: 'u1', acr: '2' },
            acr: '2',
            csrfToken: 'csrf-val',
            encryptedRefreshToken: crypto.encrypt('refresh-token'),
            encryptedIdToken: crypto.encrypt('id-token-raw'),
            expiresAt: Date.now() + 60_000,
        });
        const res = await request(app.getHttpServer())
            .post('/api/auth/logout')
            .set('Cookie', `session_id=${sessionId}; XSRF-TOKEN=csrf-val`)
            .set('X-CSRF-Token', 'csrf-val');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('logoutUrl');
        const setCookie = (res.headers['set-cookie'] ?? []);
        expect(setCookie.some((c) => /session_id=.*Max-Age=0/i.test(c))).toBe(true);
        expect(setCookie.some((c) => /XSRF-TOKEN=.*Max-Age=0/i.test(c))).toBe(true);
    });
});
//# sourceMappingURL=app.e2e-spec.js.map