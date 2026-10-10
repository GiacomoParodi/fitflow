import './quiet';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';

// Loaded at runtime (not as a static import) so quiet.ts can silence its ExperimentalWarning first.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

export type Database = DatabaseSyncType;

/**
 * A schema change. Ids are "<modulo>/<NNN>-<descrizione>" and must never change once released:
 * the id is what marks a migration as applied.
 */
export interface Migration {
  id: string;
  up: (db: Database) => void;
}

export function openDatabase(file: string): Database {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  return db;
}

export function transaction<T>(db: Database, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/**
 * Applies pending migrations in order, each in its own transaction.
 * When an existing database is about to change, a copy is saved first in `backupDir`.
 */
export function migrate(db: Database, migrations: Migration[], backupDir: string | null): string[] {
  const ids = new Set<string>();
  for (const m of migrations) {
    if (ids.has(m.id)) throw new Error(`Migrazione duplicata: ${m.id}`);
    ids.add(m.id);
  }
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set((db.prepare('SELECT id FROM schema_migrations').all() as { id: string }[]).map(r => r.id));
  const pending = migrations.filter(m => !applied.has(m.id));
  if (!pending.length) return [];

  // Databases from before migrations existed already hold data in the core tables.
  const hasData = applied.size > 0
    || !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'courses'").get();
  if (hasData && backupDir) backupDatabase(db, backupDir, 'pre-aggiornamento');

  const mark = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)');
  for (const m of pending) {
    transaction(db, () => {
      m.up(db);
      mark.run(m.id, new Date().toISOString());
    });
  }
  return pending.map(m => m.id);
}

/** Consistent snapshot of the live database (safe while the app is running). */
export function backupDatabase(db: Database, dir: string, label: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  let file = path.join(dir, `${label}-${stamp}.sqlite`);
  for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, `${label}-${stamp}-${n}.sqlite`);
  db.prepare('VACUUM INTO ?').run(file);
  return file;
}

/**
 * Key/value settings for a module, stored in the shared `settings` table under "<ns>.<key>".
 * The core module uses no namespace.
 */
export function moduleSettings<T extends object>(db: Database, ns: string, defaults: T) {
  const prefix = ns ? ns + '.' : '';
  return {
    get(): T {
      const out = { ...defaults } as Record<string, unknown>;
      const rows = db.prepare('SELECT key, value FROM settings WHERE key LIKE ?').all(prefix + '%') as { key: string; value: string }[];
      for (const r of rows) {
        const k = r.key.slice(prefix.length);
        if (k in defaults) out[k] = JSON.parse(r.value);
      }
      return out as T;
    },
    set(patch: Partial<T>) {
      const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      transaction(db, () => {
        for (const [k, v] of Object.entries(patch)) if (k in defaults && v !== undefined) up.run(prefix + k, JSON.stringify(v));
      });
    },
  };
}
