import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { openDatabase, hash, uid } from '../src/db.js';
import { createApp } from '../src/server.js';
import { initialState, token, recoveryKey } from '../src/domain.js';

const origin = 'https://lara.test';
async function fixture(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'lara-security-'));
  const db = await openDatabase({ url: null, dataDir: directory });
  const instance = await createApp({ db, startWorker: false, publicOrigin: origin, ...options });
  const server = instance.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await instance.close();
    // Only delete this test's unique temporary directory.
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + '\\') || resolve(directory).startsWith(resolve(tmpdir()) + '/'));
    assert.ok(directory.includes('lara-security-'));
    rmSync(directory, { recursive: true, force: true });
  });
  async function request(path, { method = 'GET', cookie, json, headers = {} } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(method !== 'GET' ? { body: JSON.stringify(json ?? {}) } : {})
    });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { response, status: response.status, body, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function account(name) {
    const result = await request('/api/auth/create', { method: 'POST', json: { name } });
    assert.equal(result.status, 201);
    return { ...result.body, cookie: result.cookie };
  }
  return { db, instance, request, account };
}

test('sessions are private, secure, origin-checked, and required for every private API', async t => {
  const { request, account } = await fixture(t);
  const a = await account('Alice');
  const session = await request('/api/session', { cookie: a.cookie });
  assert.equal(session.status, 200);
  assert.equal(session.response.headers.get('cache-control'), 'no-store');
  assert.equal((await request('/api/state')).status, 401);
  assert.equal((await request('/api/export')).status, 401);
  assert.equal((await request('/api/artifacts/nope/content')).status, 401);
  for (const path of ['/src/server.js', '/.env', '/.git/config']) assert.equal((await request(path)).status, 404);

  const create = await request('/api/auth/create', { method: 'POST', json: { name: 'Bob' } });
  const setCookie = create.response.headers.get('set-cookie');
  for (const attribute of ['HttpOnly', 'SameSite=Strict', 'Secure', 'Path=/']) assert.ok(setCookie.includes(attribute));
  const data = { key: 'Secret', value: 'Do not mutate through another origin' };
  assert.equal((await request('/api/memory', { method: 'POST', cookie: a.cookie, json: data, headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/api/memory', { method: 'POST', cookie: a.cookie, json: data, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await request('/api/memory', { method: 'POST', cookie: a.cookie, json: data, headers: { Origin: '', 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await request('/api/state', { cookie: a.cookie })).body.memories.length, 1);
});

test('workspace isolation covers IDs, artifacts, approvals, and exports', async t => {
  const { db, request, account } = await fixture(t);
  const alice = await account('Alice');
  const bob = await account('Bob');
  const state = (await request('/api/state', { cookie: alice.cookie })).body;
  const memoryId = state.memories[0].id;
  const goalId = state.goals[0].id;
  assert.equal((await request(`/api/memory/${memoryId}`, { method: 'PATCH', cookie: bob.cookie, json: { key: 'Attack', value: 'Changed' } })).status, 404);
  assert.equal((await request(`/api/memory/${memoryId}`, { method: 'DELETE', cookie: bob.cookie })).status, 404);
  assert.equal((await request(`/api/goals/${goalId}`, { method: 'PATCH', cookie: bob.cookie, json: { action: 'run' } })).status, 404);

  const id = uid();
  const artifact = { id, goalId, title: 'Private Alice artifact', filename: 'private.html', mime: 'text/html', size: 38, createdAt: new Date().toISOString(), status: 'private', verification: [{ label: 'test', passed: true, detail: 'fixture' }] };
  await db.saveArtifact(id, alice.user.id, { ...artifact, content: Buffer.from('<h1>Alice private information</h1>').toString('base64') });
  await db.mutate(alice.user.id, s => { s.artifacts.push(artifact); });
  assert.equal((await request(`/api/artifacts/${id}/content`, { cookie: bob.cookie })).status, 404);
  assert.equal((await request(`/api/artifacts/${id}/publish`, { method: 'POST', cookie: bob.cookie })).status, 404);
  const proposal = await request(`/api/artifacts/${id}/publish`, { method: 'POST', cookie: alice.cookie });
  assert.equal(proposal.status, 200);
  assert.equal((await request(`/api/approvals/${proposal.body.approval.id}`, { method: 'POST', cookie: bob.cookie, json: { decision: 'approve' } })).status, 404);
  const exportBob = await request('/api/export', { cookie: bob.cookie });
  assert.equal(exportBob.body.artifacts.length, 0);
  assert.equal(exportBob.body.state.user.name, 'Bob');
  assert.equal(JSON.stringify(exportBob.body).includes('Alice'), false);
  assert.equal(JSON.stringify(exportBob.body).includes(alice.recoveryKey), false);
});

test('recovery rotation requires approval, rejects replay, and revokes old devices', async t => {
  const { request, account } = await fixture(t);
  const a = await account('Recovery owner');
  const anotherDevice = await request('/api/auth/recover', { method: 'POST', json: { recoveryKey: a.recoveryKey } });
  assert.equal(anotherDevice.status, 200);
  assert.equal(anotherDevice.body.user.id, a.user.id);
  const rotation = await request('/api/recovery/rotate', { method: 'POST', cookie: a.cookie });
  assert.equal(rotation.body.approval.status, 'pending');
  assert.equal((await request('/api/session', { cookie: anotherDevice.cookie })).status, 200);
  const approved = await request(`/api/approvals/${rotation.body.approval.id}`, { method: 'POST', cookie: a.cookie, json: { decision: 'approve' } });
  assert.equal(approved.status, 200);
  assert.ok(approved.body.recoveryKey.startsWith('LARA-'));
  assert.notEqual(approved.body.recoveryKey, a.recoveryKey);
  assert.equal((await request('/api/session', { cookie: a.cookie })).status, 200);
  assert.equal((await request('/api/session', { cookie: anotherDevice.cookie })).status, 401);
  assert.equal((await request('/api/auth/recover', { method: 'POST', json: { recoveryKey: a.recoveryKey } })).status, 401);
  assert.equal((await request('/api/auth/recover', { method: 'POST', json: { recoveryKey: approved.body.recoveryKey } })).status, 200);
  assert.equal((await request(`/api/approvals/${rotation.body.approval.id}`, { method: 'POST', cookie: a.cookie, json: { decision: 'approve' } })).status, 409);
});

test('memory deletion checks the exact snapshot, and expired approvals can be denied or replaced', async t => {
  const { db, request, account } = await fixture(t);
  const a = await account('Approval owner');
  const state = (await request('/api/state', { cookie: a.cookie })).body;
  const memory = state.memories[0];
  const first = await request(`/api/memory/${memory.id}`, { method: 'DELETE', cookie: a.cookie });
  await request(`/api/memory/${memory.id}`, { method: 'PATCH', cookie: a.cookie, json: { key: 'Updated name', value: 'A new value' } });
  assert.equal((await request(`/api/approvals/${first.body.approval.id}`, { method: 'POST', cookie: a.cookie, json: { decision: 'approve' } })).status, 409);
  assert.equal((await request(`/api/approvals/${first.body.approval.id}`, { method: 'POST', cookie: a.cookie, json: { decision: 'deny' } })).status, 200);

  const stale = await request(`/api/memory/${memory.id}`, { method: 'DELETE', cookie: a.cookie });
  await db.mutate(a.user.id, s => { s.approvals.find(x => x.id === stale.body.approval.id).expiresAt = '2020-01-01T00:00:00.000Z'; });
  assert.equal((await request(`/api/approvals/${stale.body.approval.id}`, { method: 'POST', cookie: a.cookie, json: { decision: 'approve' } })).status, 409);
  const renewed = await request(`/api/memory/${memory.id}`, { method: 'DELETE', cookie: a.cookie });
  assert.notEqual(renewed.body.approval.id, stale.body.approval.id);
  const after = (await request('/api/state', { cookie: a.cookie })).body;
  assert.equal(after.approvals.find(x => x.id === stale.body.approval.id).status, 'expired');
  assert.equal(after.approvals.filter(x => x.status === 'pending').length, 1);
  await db.mutate(a.user.id, s => { s.approvals.find(x => x.id === renewed.body.approval.id).expiresAt = '2020-01-01T00:00:00.000Z'; });
  assert.equal((await request(`/api/approvals/${renewed.body.approval.id}`, { method: 'POST', cookie: a.cookie, json: { decision: 'deny' } })).status, 200);
  assert.equal((await request('/api/state', { cookie: a.cookie })).body.memories.length, 1);
});

test('import strips completion claims, account identity, public links, and executable privileges', async t => {
  const { request, account } = await fixture(t);
  const a = await account('Import owner');
  const backup = {
    format: 'lara-backup-v1',
    state: { user: { id: 'attacker', name: 'Changed' }, memories: [], messages: [], goals: [{ id: 'g', title: 'Untrusted', prompt: 'Imported app', kind: 'app', status: 'completed', artifactIds: ['a'], evidence: [{ passed: true }], generatedHtml: '<script>steal()</script>' }] },
    artifacts: [{ id: 'a', goalId: 'g', title: 'Untrusted app', filename: 'app.html', mime: 'text/html', status: 'published', publishedToken: 'attacker', publishedUrl: 'https://evil.example', content: Buffer.from('<script>fetch("/api/export")</script>').toString('base64') }]
  };
  assert.equal((await request('/api/import', { method: 'POST', cookie: a.cookie, json: { backup } })).status, 200);
  const state = (await request('/api/state', { cookie: a.cookie })).body;
  assert.equal(state.user.name, 'Import owner');
  const imported = state.goals.find(g => g.title === 'Untrusted');
  assert.equal(imported.status, 'paused');
  assert.deepEqual(imported.evidence, []);
  assert.equal(imported.generatedHtml, undefined);
  const artifact = state.artifacts[0];
  assert.equal(artifact.status, 'private');
  assert.equal(artifact.publishedUrl, undefined);
  assert.equal(artifact.verification[0].passed, false);
  const content = await request(`/api/artifacts/${artifact.id}/content`, { cookie: a.cookie });
  const csp = content.response.headers.get('content-security-policy');
  assert.ok(csp.includes("connect-src 'none'"));
  assert.ok(csp.includes('sandbox allow-scripts allow-downloads'));
  assert.equal(csp.includes('allow-same-origin'), false);
  assert.equal(content.response.headers.get('cache-control'), 'no-store');
  assert.equal((await request('/p/attacker')).status, 404);
});

test('registration count and initial session commit atomically under concurrent creation', async t => {
  const { db } = await fixture(t);
  const previous = process.env.MAX_ACCOUNTS;
  process.env.MAX_ACCOUNTS = '2';
  try {
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => {
      const id = uid();
      return db.createAccount(id, hash(recoveryKey()), initialState(id, 'Concurrent user'), token());
    }));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 2);
    assert.equal(results.filter(r => r.status === 'rejected' && r.reason.status === 503).length, 6);
    assert.equal((await db.query('SELECT COUNT(*) AS total FROM accounts')).rows[0].total, 2);
    assert.equal((await db.query('SELECT COUNT(*) AS total FROM sessions')).rows[0].total, 2);
  } finally {
    if (previous === undefined) delete process.env.MAX_ACCOUNTS; else process.env.MAX_ACCOUNTS = previous;
  }
});

test('chat memory and long replies remain within recovery backup limits', async t => {
  const { db, request, account } = await fixture(t);
  const a = await account('Portable memory');
  const rejected = await request('/api/chat', { method: 'POST', cookie: a.cookie, json: { message: 'Remember: project = ' + 'x'.repeat(4001) } });
  assert.equal(rejected.status, 400);
  assert.equal((await request('/api/state', { cookie: a.cookie })).body.memories.length, 1);
  await db.mutate(a.user.id, s => {
    for (let i = 0; i < 10; i++) s.memories.push({ id: uid(), key: `Research ${i}`, value: 'x'.repeat(4000), updatedAt: new Date().toISOString() });
  });
  const reply = await request('/api/chat', { method: 'POST', cookie: a.cookie, json: { message: 'What do you remember about me?' } });
  assert.equal(reply.status, 200);
  assert.ok(reply.body.message.content.length <= 16000);
  const backup = (await request('/api/export', { cookie: a.cookie })).body;
  const b = await account('Restore destination');
  assert.equal((await request('/api/import', { method: 'POST', cookie: b.cookie, json: { backup } })).status, 200);
});
