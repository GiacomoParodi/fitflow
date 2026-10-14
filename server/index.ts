// Command-line entry: `npm start` (built interface) or `npm run dev` (Vite with hot reload).
import './quiet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './app';

// Works both from server/ (tsx) and from dist-server/ (bundled): both sit one level below the project root.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));

try {
  const server = await startServer({
    dataDir,
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST || '127.0.0.1',
    ...(dev ? { dev: { root } } : { staticDir: path.join(root, 'dist') }),
  });
  if (server.data.migrated.length) console.log(`Database aggiornato: ${server.data.migrated.join(', ')}`);
  console.log(`GymPlan pronta su ${server.url}`);
  console.log(`Dati salvati in ${dataDir}`);
  const shutdown = () => { server.close().then(() => process.exit(0)); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
