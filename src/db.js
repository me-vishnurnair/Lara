import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const hash = value => createHash('sha256').update(value).digest('hex');
export const uid = () => randomUUID();

export async function openDatabase({ url = process.env.DATABASE_URL, dataDir = process.env.DATA_DIR || './data' } = {}) {
  let pool, sqlite;
  if (url) {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 15000,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
    pool.on('error', error => console.error('Database pool unavailable:', error.code || 'connection error'));
  } else {
    if (process.env.RENDER || process.env.NODE_ENV === 'production') throw new Error('Production requires DATABASE_URL; an ephemeral disk cannot hold recovery data.');
    const { DatabaseSync } = await import('node:sqlite');
    mkdirSync(resolve(dataDir), { recursive: true });
    sqlite = new DatabaseSync(resolve(dataDir, 'lara.sqlite'));
    sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  }
  const query = async (sql, values = [], client = pool) => {
    if (pool) return client.query(sql, values);
    const statement = sqlite.prepare(sql.replace(/\$\d+/g, '?'));
    if (/^\s*(SELECT|WITH)|RETURNING/i.test(sql)) return { rows: statement.all(...values) };
    const result = statement.run(...values);
    return { rows: [], rowCount: Number(result.changes) };
  };
  await query(`CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, recovery_hash TEXT UNIQUE NOT NULL, state TEXT NOT NULL, created_at BIGINT NOT NULL, revision INTEGER NOT NULL DEFAULT 1)`);
  if(pool)await query('ALTER TABLE accounts ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1');
  else if(!sqlite.prepare('PRAGMA table_info(accounts)').all().some(c=>c.name==='revision'))sqlite.exec('ALTER TABLE accounts ADD COLUMN revision INTEGER NOT NULL DEFAULT 1');
  await query(`CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL)`);
  await query(`CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, data TEXT NOT NULL, created_at BIGINT NOT NULL)`);
  await query(`CREATE TABLE IF NOT EXISTS publications (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE)`);
  await query(`CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at BIGINT NOT NULL)`);
  const read = async id => {
    const { rows } = await query('SELECT state FROM accounts WHERE id=$1', [id]);
    return rows[0] ? JSON.parse(rows[0].state) : null;
  };
  // A row lock makes each account mutation atomic, including across web instances.
  // Mutation callbacks MUST be synchronous and MUST NOT perform external effects.
  const mutate = async (id, fn, transactional = false) => {
    const client = pool ? await pool.connect() : null;
    try {
      if (pool) await client.query('BEGIN'); else sqlite.exec('BEGIN IMMEDIATE');
      const { rows } = await query(`SELECT state FROM accounts WHERE id=$1${pool ? ' FOR UPDATE' : ''}`, [id], client);
      if (!rows[0]) throw new Error('Workspace not found');
      const state = JSON.parse(rows[0].state);
      let result = fn(state, (sql,values=[]) => query(sql,values,client));
      if (result instanceof Promise && !transactional) throw new Error('State mutation must be synchronous');
      result = await result;
      await query('UPDATE accounts SET state=$1,revision=revision+1 WHERE id=$2', [JSON.stringify(state), id], client);
      if (pool) await client.query('COMMIT'); else sqlite.exec('COMMIT');
      return result;
    } catch (error) {
      if (pool) await client.query('ROLLBACK'); else sqlite.exec('ROLLBACK');
      throw error;
    } finally { client?.release(); }
  };
  // SQLite operations share a connection; serialize complete transactions around awaits.
  let queue = Promise.resolve();
  const serial = fn => {
    if (pool) return fn();
    const next = queue.then(fn, fn); queue = next.catch(() => {}); return next;
  };
  const store = {
    kind: pool ? 'PostgreSQL' : 'SQLite',
    read: id => serial(() => read(id)),
    async changedState(id, revision=0){
      const {rows}=await store.query('SELECT state,revision FROM accounts WHERE id=$1 AND revision<>$2',[id,revision]);
      return rows[0]?{...JSON.parse(rows[0].state),revision:Number(rows[0].revision)}:null;
    },
    mutate: (id, fn) => serial(() => mutate(id, fn)),
    transaction: (id, fn) => serial(() => mutate(id, fn, true)),
    query: (sql, values) => serial(() => query(sql, values)),
    async createAccount(id, recoveryHash, state, initialSession) {
      const limit = Number(process.env.MAX_ACCOUNTS || 20);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('MAX_ACCOUNTS must be an integer from 1 to 100.');
      return serial(async () => {
        const client = pool ? await pool.connect() : null;
        try {
          if (pool) {
            await client.query('BEGIN');
            // Serialize registration across instances: a count checked before
            // this transaction would allow concurrent signups past the cap.
            await client.query('SELECT pg_advisory_xact_lock(20261114, 1)');
          } else sqlite.exec('BEGIN IMMEDIATE');
          const { rows } = await query('SELECT COUNT(*) AS total FROM accounts', [], client);
          if (Number(rows[0].total) >= limit) throw Object.assign(new Error('New workspace registration is at capacity. Existing workspaces can still sign in.'), { status: 503 });
          await query('INSERT INTO accounts (id,recovery_hash,state,created_at) VALUES ($1,$2,$3,$4)', [id, recoveryHash, JSON.stringify(state), Date.now()], client);
          if (initialSession) await query('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [hash(initialSession), id, Date.now() + 30 * 86400000], client);
          if (pool) await client.query('COMMIT'); else sqlite.exec('COMMIT');
        } catch (error) {
          if (pool) await client.query('ROLLBACK'); else sqlite.exec('ROLLBACK');
          throw error;
        } finally { client?.release(); }
      });
    },
    async findRecovery(recoveryKey) {
      const { rows } = await store.query('SELECT id FROM accounts WHERE recovery_hash=$1', [hash(recoveryKey)]);
      return rows[0]?.id;
    },
    async session(token) {
      const { rows } = await store.query('SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>$2', [hash(token), Date.now()]);
      return rows[0]?.user_id;
    },
    async addSession(userId, token) {
      await store.query('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [hash(token), userId, Date.now() + 30 * 86400000]);
    },
    async saveArtifact(id, userId, data) {
      await store.query('INSERT INTO artifacts (id,user_id,data,created_at) VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING', [id, userId, JSON.stringify(data), Date.now()]);
    },
    async artifact(id, userId) {
      const { rows } = await store.query('SELECT data FROM artifacts WHERE id=$1 AND user_id=$2', [id, userId]);
      return rows[0] ? JSON.parse(rows[0].data) : null;
    },
    async rate(key, max, duration) {
      const id = hash(key), now = Date.now();
      const { rows } = await store.query(`INSERT INTO rate_limits (id,count,resets_at) VALUES ($1,1,$2) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN rate_limits.resets_at<$3 THEN 1 ELSE rate_limits.count+1 END, resets_at=CASE WHEN rate_limits.resets_at<$4 THEN $5 ELSE rate_limits.resets_at END RETURNING count`, [id, now + duration, now, now, now + duration]);
      return rows[0].count <= max;
    },
    async ping() { await store.query('SELECT 1'); },
    async close() { await queue; if (pool) await pool.end(); else sqlite.close(); }
  };
  return store;
}
