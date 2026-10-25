import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as cookieParser from 'cookie-parser'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'

describe('Agenda API (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/health', () => {
    it('returns 200 with status ok without any authentication', async () => {
      const res = await request(app.getHttpServer()).get('/api/health')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ status: 'ok' })
    })
  })

  describe('protected endpoints', () => {
    it('GET /api/auth/me returns 401 without any cookie', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/me')
      expect(res.status).toBe(401)
    })

    it('GET /api/auth/me returns 401 with a fabricated session_id cookie', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', 'session_id=fabricated-session-that-does-not-exist')
      expect(res.status).toBe(401)
    })

    it('GET /api/auth/me returns 401 when a raw Bearer token is supplied in the Authorization header', async () => {
      // The session guard does not read Bearer tokens; only session cookies are accepted.
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer some.fake.jwt')
      expect(res.status).toBe(401)
    })

    it('401 response body does not contain session or token details', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', 'session_id=leaking-test')
      expect(res.status).toBe(401)
      const body = JSON.stringify(res.body)
      expect(body).not.toContain('leaking-test')
      expect(body).not.toContain('session_id')
      expect(body).not.toContain('stack')
    })
  })
})
