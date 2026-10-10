import './quiet';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api';
import { Store } from './store';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const port = Number(process.env.PORT) || 3000;
// Bound to this computer only: the app has no login, so it must not be reachable from the network.
const host = process.env.HOST || '127.0.0.1';
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));

const store = new Store(dataDir);
const app = express();
app.disable('x-powered-by');
app.use('/api', createApi(store));

if (dev) {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('Interfaccia non ancora compilata: esegui prima "npm run build" (oppure usa "npm run dev").');
    process.exit(1);
  }
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(port, host, () => {
  console.log(`Gestione Corsi pronta su http://localhost:${port}`);
  console.log(`Dati salvati in ${dataDir}`);
});

const shutdown = () => { store.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
