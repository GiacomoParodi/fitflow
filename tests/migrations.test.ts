import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openData } from '../server/app';
import { serverModules } from '../server/modules';
import type { ServerModule } from '../server/modules/types';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'corsi-mig-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('migrations', () => {
  it('applies each migration once and backs up before changing an existing database', () => {
    const first = openData(dir);
    expect(first.migrated).toContain('core/001-schema-iniziale');
    first.store.createCourse({ name: 'Yoga', giorni: [1], orario: '20:00', capienza: 10 });
    first.close();

    const extra: ServerModule = {
      id: 'prova',
      migrations: [{ id: 'prova/001-tabella', up: db => db.exec('CREATE TABLE prova (id INTEGER PRIMARY KEY)') }],
    };
    const second = openData(dir, [...serverModules, extra]);
    expect(second.migrated).toEqual(['prova/001-tabella']);
    expect(second.store.courses()).toHaveLength(1);
    second.close();

    const backups = fs.readdirSync(path.join(dir, 'backup'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^pre-aggiornamento-.*\.sqlite$/);

    const third = openData(dir, [...serverModules, extra]);
    expect(third.migrated).toEqual([]);
    third.close();
    expect(fs.readdirSync(path.join(dir, 'backup'))).toHaveLength(1);
  });
});
