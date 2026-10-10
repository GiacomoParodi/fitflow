import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cartella `content/` del progetto (libreria esercizi e schede di conoscenza). Funziona da sorgente (tsx),
 * dal bundle `dist-server/` e dall'app desktop: si risale dalla posizione di questo codice finché si trova
 * una cartella con `package.json` e `content/`. FITFLOW_CONTENT_DIR ha la precedenza.
 */
export function cartellaContenuti(): string | null {
  if (process.env.FITFLOW_CONTENT_DIR) return path.resolve(process.env.FITFLOW_CONTENT_DIR);
  const starts: string[] = [];
  try { starts.push(path.dirname(fileURLToPath(import.meta.url))); } catch { /* non ESM */ }
  const resources = (process as { resourcesPath?: string }).resourcesPath;
  if (resources) starts.push(resources, path.join(resources, 'app'));
  starts.push(process.cwd());
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 8; i++) {
      const c = path.join(dir, 'content');
      if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
      if (fs.existsSync(path.join(c, 'esercizi.json'))) return c;
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return null;
}
