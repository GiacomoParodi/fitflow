import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openData, type OpenedData } from '../server/app';
import type { Store } from '../server/store';

let dir: string;
let store: Store;
let data: OpenedData;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'corsi-test-'));
  data = openData(dir, undefined, () => '2026-09-26');
  store = data.store;
});
afterEach(() => {
  data.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const course = (capienza = 2) => store.createCourse({ name: 'Pilates', giorni: [3, 1], orario: '09:00', capienza });
const plan = (name: string) => store.plans().find(p => p.name === name)!;
const enrol = (courseId: number, name = 'Anna', paid = true) => store.createParticipant({
  courseId, name, phone: '333', livello: 'Base', note: '', planId: plan('Mensile').id,
  iscrizioneScadenza: '2027-08-31', certScadenza: null, paid,
});

describe('Store', () => {
  it('starts with the default plans and settings', () => {
    expect(store.plans().map(p => p.name)).toEqual(['Mensile', 'Trimestrale', 'Semestrale', 'Annuale']);
    expect(store.settings()).toMatchObject({ quotaIscrizione: 30, scadenzaStagione: '2027-08-31', sogliaAbbonamento: 4 });
  });

  it('orders course days Monday first', () => {
    course();
    expect(store.courses()[0].giorni).toEqual([1, 3]);
  });

  it('enrols with a first payment and enforces capacity', () => {
    const c = course(1);
    const id = enrol(c);
    const p = store.participants().find(x => x.id === id)!;
    expect(p.pagatoFino).toBe('2026-10-26');
    expect(p.payments).toHaveLength(1);
    expect(store.state().incassoMese).toBe(45);
    expect(() => enrol(c, 'Bruno')).toThrow('Il corso è al completo.');
  });

  it('leaves an unpaid member with no coverage', () => {
    const id = enrol(course(), 'Anna', false);
    expect(store.participants().find(x => x.id === id)!.pagatoFino).toBeNull();
  });

  it('registers an early renewal from the old expiry', () => {
    const id = enrol(course());
    store.registerPayment(id, { date: '2026-09-26', planId: plan('Trimestrale').id });
    const p = store.participants()[0];
    expect(p.pagatoFino).toBe('2027-01-26');
    expect(p.planId).toBe(plan('Trimestrale').id);
    expect(p.payments[0]).toMatchObject({ dal: '2026-10-26', al: '2027-01-26', importo: 120 });
  });

  it('tracks attendance and mark-all toggling', () => {
    const c = course();
    const a = enrol(c, 'Anna'), b = enrol(c, 'Bruno');
    const lesson = store.addLesson(c, { date: '2026-09-21' })!;
    expect(store.addLesson(c, { date: '2026-09-21' })).toBeNull();
    store.toggleAttendance(lesson, a);
    expect(store.lessons()[0].present).toEqual([a]);
    store.markAll(lesson);
    expect(store.lessons()[0].present.sort()).toEqual([a, b].sort());
    store.markAll(lesson);
    expect(store.lessons()[0].present).toEqual([]);
  });

  it('unsubscribes but keeps payments for the takings', () => {
    const c = course();
    const id = enrol(c);
    const lesson = store.addLesson(c, { date: '2026-09-21' })!;
    store.toggleAttendance(lesson, id);
    store.unsubscribe(id);
    expect(store.participants()).toHaveLength(0);
    expect(store.lessons()[0].present).toEqual([]);
    expect(store.state().incassoMese).toBe(45);
    expect(() => store.unsubscribe(id)).toThrow();
  });

  it('refuses to delete a plan in use or a course with members', () => {
    const c = course();
    enrol(c);
    expect(() => store.deletePlan(plan('Mensile').id)).toThrow(/usato da 1 iscritto/);
    expect(() => store.deleteCourse(c)).toThrow(/1 iscritto/);
    store.deletePlan(plan('Annuale').id);
    expect(store.plans()).toHaveLength(3);
  });

  it('stores, replaces and removes certificate files', () => {
    const id = enrol(course());
    expect(() => store.saveCertFile(id, Buffer.from('x'), 'text/plain', 'a.txt')).toThrow(/PNG, JPEG o PDF/);
    store.saveCertFile(id, Buffer.from('%PDF-1.4'), 'application/pdf', 'cert.pdf');
    const first = store.certFile(id);
    expect(fs.readFileSync(first.path, 'utf8')).toBe('%PDF-1.4');
    store.saveCertFile(id, Buffer.from('png'), 'image/png', 'cert.png');
    expect(store.participants()[0].certFile).toMatchObject({ name: 'cert.png', mime: 'image/png', size: 3 });
    store.removeCertFile(id);
    expect(store.participants()[0].certFile).toBeNull();
  });

  it('computes the enrolment trend over six months', () => {
    enrol(course(5));
    const trend = store.state().andamento;
    expect(trend.map(m => m.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(trend.map(m => m.count)).toEqual([0, 0, 0, 0, 0, 1]);
  });

  it('validates input', () => {
    expect(() => store.createCourse({ name: 'X', giorni: [], orario: '09:00', capienza: 5 })).toThrow(/almeno un giorno/);
    expect(() => store.createCourse({ name: 'X', giorni: [1], orario: '9', capienza: 5 })).toThrow(/Orario/);
    expect(() => store.updateSettings({ scadenzaStagione: '2026-02-30' })).toThrow(/data non valida/);
    expect(() => store.createPlan({ name: '', mesi: 1, prezzo: 10 })).toThrow(/nome, durata/);
  });
});
