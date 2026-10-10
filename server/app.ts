import './quiet';
import express from 'express';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { createApi, errorHandler } from './api';
import { migrate, openDatabase, type Database } from './db';
import { serverModules } from './modules';
import type { ModuleContext, ServerModule } from './modules/types';
import { Store } from './store';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Only this computer's own pages may use the API. Blocks DNS rebinding (a website pointing its own
 * domain at 127.0.0.1: the Host header then names that domain) and cross-site requests that change data
 * (another website's page firing POSTs at the local port).
 */
export function localOnly(checkHost: boolean): express.RequestHandler {
  return (req, res, next) => {
    const host = String(req.headers.host ?? '');
    const hostname = host.replace(/:\d+$/, '').toLowerCase();
    if (checkHost && !LOOPBACK_HOSTS.has(hostname)) {
      return res.status(403).json({ error: 'Accesso consentito solo da questo computer.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.headers.origin;
      let sameOrigin = true;
      if (origin) {
        try { sameOrigin = new URL(origin).host.toLowerCase() === host.toLowerCase(); } catch { sameOrigin = false; }
      }
      if (!sameOrigin || req.headers['sec-fetch-site'] === 'cross-site') {
        return res.status(403).json({ error: 'Richiesta da un altro sito rifiutata.' });
      }
    }
    next();
  };
}

export interface AppOptions {
  dataDir: string;
  /** Folder with the built interface (index.html). Omit when `dev` serves it through Vite. */
  staticDir?: string;
  /** Serve the interface through Vite with hot reload (development only). */
  dev?: { root: string };
  modules?: ServerModule[];
  today?: () => string;
  /** Address the server listens on; the Host check only applies on loopback (the default). */
  host?: string;
}

export interface OpenedData {
  db: Database;
  store: Store;
  ctx: ModuleContext;
  /** Migration ids applied during this start. */
  migrated: string[];
  close: () => void;
}

/** Opens (and migrates) the data folder. Shared by the server, the demo seeder and tests. */
export function openData(dataDir: string, modules: ServerModule[] = serverModules, today?: () => string): OpenedData {
  const file = path.join(dataDir, 'fitflow.sqlite');
  // First release used a different file name: carry it over (with its WAL files) on upgrade.
  const legacy = path.join(dataDir, 'gestione-corsi.sqlite');
  if (!fs.existsSync(file) && fs.existsSync(legacy)) {
    for (const ext of ['', '-wal', '-shm']) if (fs.existsSync(legacy + ext)) fs.renameSync(legacy + ext, file + ext);
  }
  const db = openDatabase(file);
  const migrated = migrate(db, modules.flatMap(m => m.migrations), path.join(dataDir, 'backup'));
  const store = new Store(db, dataDir);
  if (today) store.today = today;
  const ctx: ModuleContext = { db, dataDir, core: store, today: () => store.today() };
  for (const m of modules) m.init?.(ctx);
  store.onUnsubscribe.push(pid => { for (const m of modules) m.onParticipantRemoved?.(ctx, pid); });
  return { db, store, ctx, migrated, close: () => db.close() };
}

export async function createApp(opts: AppOptions) {
  const modules = opts.modules ?? serverModules;
  const data = openData(opts.dataDir, modules, opts.today);
  const app = express();
  app.disable('x-powered-by');
  const host = opts.host ?? '127.0.0.1';
  app.use(localOnly(host === '127.0.0.1' || host === 'localhost' || host === '::1'));

  const api = express.Router();
  for (const m of modules) {
    if (m.createRouter) api.use('/' + m.id, m.createRouter(data.ctx));
  }
  api.get('/modules', (_req, res) => res.json(modules.map(m => m.id)));
  api.use(createApi(data.store));
  api.use((_req, res) => { res.status(404).json({ error: 'Risorsa non trovata.' }); });
  api.use(errorHandler);
  app.use('/api', api);

  if (opts.dev) {
    const { createServer } = await import('vite');
    const vite = await createServer({ root: opts.dev.root, server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else if (opts.staticDir) {
    const dist = opts.staticDir;
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
      throw new Error('Interfaccia non ancora compilata: esegui prima "npm run build" (oppure usa "npm run dev").');
    }
    app.use(express.static(dist));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  return { app, data };
}

export interface StartOptions extends AppOptions {
  /** 0 picks a free port. */
  port: number;
  host?: string;
}

/** Starts the HTTP server. Bound to 127.0.0.1 by default: the app has no login. */
export async function startServer(opts: StartOptions) {
  const { app, data } = await createApp(opts);
  const host = opts.host ?? '127.0.0.1';
  const server = await new Promise<import('node:http').Server>((resolve, reject) => {
    const s = app.listen(opts.port, host, () => resolve(s));
    s.on('error', reject);
  });
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    url: `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`,
    data,
    close: () => new Promise<void>(resolve => server.close(() => { data.close(); resolve(); })),
  };
}
