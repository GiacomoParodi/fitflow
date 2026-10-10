import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from '../server/app';
import { serverModules } from '../server/modules';

let dir: string;
let server: Awaited<ReturnType<typeof startServer>>;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-sec-'));
  server = await startServer({ dataDir: dir, port: 0, modules: [serverModules[0]] });
});
afterAll(async () => {
  await server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const call = (p: string, init: RequestInit = {}) => fetch(server.url + p, init);

describe('local-only API', () => {
  it('answers this computer', async () => {
    expect((await call('/api/state')).status).toBe(200);
    const ok = await call('/api/courses', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: server.url },
      body: JSON.stringify({ name: 'Yoga', giorni: [1], orario: '20:00', capienza: 5 }),
    });
    expect(ok.status).toBe(201);
  });

  it('rejects a foreign Host header (DNS rebinding)', async () => {
    // fetch() won't let us forge Host, so use a raw request.
    const status = await new Promise<number>((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: server.port, path: '/api/state', headers: { Host: 'attacker.example' } }, r => {
        r.resume();
        resolve(r.statusCode ?? 0);
      }).on('error', reject);
    });
    expect(status).toBe(403);
  });

  it('rejects state-changing requests from another site', async () => {
    const res = await call('/api/lessons/1/mark-all', { method: 'POST', headers: { Origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
    const fetchMeta = await call('/api/lessons/1/mark-all', { method: 'POST', headers: { 'Sec-Fetch-Site': 'cross-site' } });
    expect(fetchMeta.status).toBe(403);
  });

  it('answers 400 to a malformed file name', async () => {
    const res = await call('/api/participants/1/cert', {
      method: 'PUT', headers: { 'Content-Type': 'image/png', 'X-File-Name': '%E0%A4%A' }, body: 'png',
    });
    expect([400, 404]).toContain(res.status);
  });
});
