import { MigrationRunnerService } from '../../src/auth/migration-runner.service'

jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
}))
import { readdir, readFile } from 'fs/promises'

function makeClient(queryResults: Array<{ rows: unknown[]; rowCount: number }>) {
  let callCount = 0
  return {
    query:   jest.fn().mockImplementation(() => Promise.resolve(queryResults[callCount++] ?? { rows: [], rowCount: 0 })),
    release: jest.fn(),
  }
}

function makePool(client: ReturnType<typeof makeClient>) {
  return { connect: jest.fn().mockResolvedValue(client) }
}

describe('MigrationRunnerService', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates _migrations table if it does not exist', async () => {
    const client  = makeClient([{ rows: [], rowCount: 0 }])
    const pool    = makePool(client)
    ;(readdir as jest.Mock).mockResolvedValue([])

    const svc = new MigrationRunnerService(pool as never)
    await svc.onApplicationBootstrap()

    const queries = (client.query as jest.Mock).mock.calls.map(([q]: [string]) => q)
    expect(queries.some((q: string) => q.includes('CREATE TABLE IF NOT EXISTS _migrations'))).toBe(true)
  })

  it('applies SQL files in strict alphabetical order', async () => {
    ;(readdir as jest.Mock).mockResolvedValue(['002_b.sql', '001_a.sql'])
    ;(readFile as jest.Mock).mockResolvedValue('SELECT 1;')

    const client = makeClient([
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
    ])
    const pool = makePool(client)
    const svc  = new MigrationRunnerService(pool as never)
    await svc.onApplicationBootstrap()

    const fileCalls = (readFile as jest.Mock).mock.calls.map(([p]: [string]) => p)
    expect(fileCalls[0]).toMatch(/001_a\.sql/)
    expect(fileCalls[1]).toMatch(/002_b\.sql/)
  })

  it('does not re-apply files already recorded in _migrations', async () => {
    ;(readdir as jest.Mock).mockResolvedValue(['001_a.sql'])
    ;(readFile as jest.Mock).mockResolvedValue('SELECT 1;')

    const client = makeClient([
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [{ '?column?': 1 }], rowCount: 1 },
    ])
    const pool = makePool(client)
    const svc  = new MigrationRunnerService(pool as never)
    await svc.onApplicationBootstrap()

    expect(readFile).not.toHaveBeenCalled()
  })

  it('throws when a SQL file execution returns an error', async () => {
    ;(readdir as jest.Mock).mockResolvedValue(['001_a.sql'])
    ;(readFile as jest.Mock).mockResolvedValue('INVALID SQL;')

    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // BEGIN (setup)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // CREATE TABLE _migrations
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // COMMIT (setup)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // SELECT 1 (not applied)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // BEGIN (migration tx)
        .mockRejectedValueOnce(new Error('syntax error'))   // INVALID SQL → throws
        .mockResolvedValue({ rows: [], rowCount: 0 }),      // ROLLBACK (catch block)
      release: jest.fn(),
    }
    const pool = makePool(client)
    const svc  = new MigrationRunnerService(pool as never)
    await expect(svc.onApplicationBootstrap()).rejects.toThrow('syntax error')
  })
})
