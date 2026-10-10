import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openData, startServer, type OpenedData } from '../server/app';
import { mesiGrafico, parseFiltri, riepilogo } from '../server/modules/finanze/report';
import type { FiltriFinanze } from '../server/modules/finanze/types';
import type { Store } from '../server/store';
import { pagamentiCsv } from '../src/modules/finanze/csv';
import { euroIt } from '../src/modules/finanze/formato';
import { rangeFor, stagione } from '../src/modules/finanze/periodi';

const TODAY = '2026-10-10';
let dir: string;
let store: Store;
let data: OpenedData;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finanze-test-'));
  data = openData(dir, undefined, () => TODAY);
  store = data.store;
});
afterEach(() => {
  data.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const plan = (name: string) => store.plans().find(p => p.name === name)!;
const enrol = (courseId: number, name: string, planName = 'Mensile', paid = true) => store.createParticipant({
  courseId, name, phone: '333', livello: 'Base', note: '', planId: plan(planName).id,
  iscrizioneScadenza: '2027-08-31', certScadenza: null, paid,
});
const pay = (id: number, date: string, planName: string) => store.registerPayment(id, { date, planId: plan(planName).id });
const report = (f: Partial<FiltriFinanze> = {}) =>
  riepilogo(data.db, TODAY, store.settings().sogliaAbbonamento, { dal: '2026-10-01', al: '2026-10-31', corso: null, abbonamento: null, ...f });

/**
 * Pilates: Anna (Mensile, paid today; renewed early with a Trimestrale on 05/10), Bruno (Mensile, unpaid).
 * Yoga: Carla (Annuale, paid today, then leaves), Dario (Mensile paid in September, due on 2026-10-12).
 */
function seed() {
  const pilates = store.createCourse({ name: 'Pilates', giorni: [1], orario: '09:00', capienza: 10 });
  const yoga = store.createCourse({ name: 'Yoga', giorni: [3], orario: '20:00', capienza: 10 });
  const anna = enrol(pilates, 'Anna');
  pay(anna, '2026-10-05', 'Trimestrale');
  const bruno = enrol(pilates, 'Bruno', 'Mensile', false);
  const carla = enrol(yoga, 'Carla', 'Annuale');
  store.unsubscribe(carla);
  const dario = enrol(yoga, 'Dario', 'Mensile', false);
  pay(dario, '2026-09-12', 'Mensile');
  return { pilates, yoga, anna, bruno, carla, dario };
}

describe('Finanze: riepilogo', () => {
  it('totals the period, counting people who have since left', () => {
    seed();
    expect(report().totali).toEqual({ incassato: 45 + 120 + 400, pagamenti: 3, persone: 2, medio: 188.33 });
    expect(report({ dal: '2026-09-01', al: '2026-09-30' }).totali).toEqual({ incassato: 45, pagamenti: 1, persone: 1, medio: 45 });
    expect(report({ dal: '2025-01-01', al: '2025-12-31' }).totali).toEqual({ incassato: 0, pagamenti: 0, persone: 0, medio: 0 });
  });

  it('ranks plans by takings with share and current active members', () => {
    seed();
    const r = report();
    expect(r.abbonamenti.map(a => [a.nome, a.pagamenti, a.totale, a.quota, a.iscrittiAttivi])).toEqual([
      ['Annuale', 1, 400, 70.8, 0],
      ['Trimestrale', 1, 120, 21.2, 1],
      ['Mensile', 1, 45, 8, 2],
      ['Semestrale', 0, 0, 0, 0],
    ]);
  });

  it('keeps the historic plan name after a plan is deleted', () => {
    const c = store.createCourse({ name: 'Zumba', giorni: [6], orario: '10:00', capienza: 5 });
    const promo = store.createPlan({ name: 'Promo', mesi: 1, prezzo: 30 });
    const id = store.createParticipant({ courseId: c, name: 'Elio', phone: '1', livello: 'Base', note: '', planId: promo, iscrizioneScadenza: null, certScadenza: null, paid: true });
    pay(id, '2026-10-06', 'Mensile');
    store.deletePlan(promo);
    const r = report();
    expect(r.abbonamenti.find(a => a.nome === 'Promo')).toMatchObject({ pagamenti: 1, totale: 30, iscrittiAttivi: 0 });
    expect(r.opzioni.abbonamenti).toContain('Promo');
    expect(report({ abbonamento: 'Promo' }).totali.incassato).toBe(30);
  });

  it('breaks takings down by course, with the average per active member', () => {
    const { pilates, yoga } = seed();
    expect(report().corsi).toEqual([
      { id: yoga, nome: 'Yoga', incassato: 400, pagamenti: 1, iscrittiAttivi: 1, medioPerIscritto: 400 },
      { id: pilates, nome: 'Pilates', incassato: 165, pagamenti: 2, iscrittiAttivi: 2, medioPerIscritto: 82.5 },
    ]);
  });

  it('applies course and plan filters everywhere', () => {
    const { pilates } = seed();
    const r = report({ corso: pilates });
    expect(r.totali.incassato).toBe(165);
    expect(r.corsi.map(c => c.nome)).toEqual(['Pilates']);
    expect(r.pagamenti.map(p => p.nome)).toEqual(['Anna', 'Anna']);
    expect(r.situazione.attivi).toBe(2);

    const m = report({ abbonamento: 'Mensile' });
    expect(m.totali).toMatchObject({ incassato: 45, pagamenti: 1 });
    expect(m.abbonamenti.map(a => a.nome)).toEqual(['Mensile']);
    // Active members whose current plan is Mensile: Bruno and Dario (Anna moved to Trimestrale).
    expect(m.situazione.attivi).toBe(2);
  });

  it('builds the monthly trend over 12 months, highlighting the period', () => {
    seed();
    const r = report();
    expect(r.mesi).toHaveLength(12);
    expect(r.mesi[0].mese).toBe('2025-11');
    expect(r.mesi.at(-2)).toEqual({ mese: '2026-09', incassato: 45, pagamenti: 1, nelPeriodo: false });
    expect(r.mesi.at(-1)).toEqual({ mese: '2026-10', incassato: 565, pagamenti: 3, nelPeriodo: true });
    expect(mesiGrafico('2025-09-01', '2026-08-31')).toHaveLength(12);
    expect(mesiGrafico('2020-01-01', '2026-10-31')).toHaveLength(36);
    expect(mesiGrafico('2020-01-01', '2026-10-31').at(-1)).toBe('2026-10');
  });

  it('lists payments newest first and flags people who left', () => {
    const { carla } = seed();
    const list = report().pagamenti;
    expect(list.map(p => [p.data, p.nome, p.abbonamento, p.importo])).toEqual([
      ['2026-10-10', 'Carla', 'Annuale', 400],
      ['2026-10-10', 'Anna', 'Mensile', 45],
      ['2026-10-05', 'Anna', 'Trimestrale', 120],
    ]);
    expect(list[0]).toMatchObject({ participantId: carla, corso: 'Yoga', ritiratoIl: TODAY, dal: '2026-10-10', al: '2027-10-10' });
    expect(list[2]).toMatchObject({ dal: '2026-11-10', al: '2027-02-10', ritiratoIl: null });
  });

  it('classifies active members today with the plan threshold', () => {
    const { bruno, dario } = seed();
    const s = report().situazione;
    expect(s).toMatchObject({ attivi: 3, inRegola: 1, inScadenza: 1, daPagare: 1 });
    expect(s.elenco).toEqual([
      { id: bruno, nome: 'Bruno', courseId: expect.any(Number), corso: 'Pilates', abbonamento: 'Mensile', pagatoFino: null, stato: 'mancante' },
      { id: dario, nome: 'Dario', courseId: expect.any(Number), corso: 'Yoga', abbonamento: 'Mensile', pagatoFino: '2026-10-12', stato: 'in_scadenza' },
    ]);
    store.updateSettings({ sogliaAbbonamento: 1 });
    expect(riepilogo(data.db, TODAY, 1, report().filtri).situazione.inScadenza).toBe(0);
  });

  it('validates the filters', () => {
    const p = (q: Record<string, unknown>) => parseFiltri(q, TODAY, data.db);
    expect(p({})).toEqual({ dal: '2026-10-01', al: '2026-10-31', corso: null, abbonamento: null });
    expect(() => p({ dal: '2026-02-30' })).toThrow(/inizio non valida/);
    expect(() => p({ al: '10/10/2026' })).toThrow(/fine non valida/);
    expect(() => p({ dal: '2026-10-20', al: '2026-10-01' })).toThrow(/prima della data di fine/);
    expect(() => p({ corso: 'abc' })).toThrow(/Corso non valido/);
    expect(() => p({ corso: '99' })).toThrow(/Corso non trovato/);
    expect(() => p({ abbonamento: 'x'.repeat(61) })).toThrow(/Abbonamento non valido/);
  });
});

describe('Finanze: API', () => {
  it('answers on /api/finanze/riepilogo with Italian errors', async () => {
    data.close();
    const srv = await startServer({ dataDir: dir, port: 0, today: () => TODAY });
    try {
      const ok = await fetch(`${srv.url}/api/finanze/riepilogo?dal=2026-10-01&al=2026-10-31`);
      expect(ok.status).toBe(200);
      expect((await ok.json()).totali.incassato).toBe(0);
      const ko = await fetch(`${srv.url}/api/finanze/riepilogo?dal=ieri`);
      expect(ko.status).toBe(400);
      expect(await ko.json()).toEqual({ error: 'Data di inizio non valida (formato AAAA-MM-GG).' });
    } finally {
      await srv.close();
      data = openData(dir, undefined, () => TODAY);
    }
  });
});

describe('Finanze: interfaccia', () => {
  it('computes the period presets', () => {
    expect(rangeFor('mese', '2026-10-10')).toEqual({ dal: '2026-10-01', al: '2026-10-31' });
    expect(rangeFor('mese-scorso', '2026-03-31')).toEqual({ dal: '2026-02-01', al: '2026-02-28' });
    expect(rangeFor('tre-mesi', '2026-01-15')).toEqual({ dal: '2025-11-01', al: '2026-01-31' });
    expect(rangeFor('anno', '2026-10-10')).toEqual({ dal: '2026-01-01', al: '2026-12-31' });
    expect(stagione('2026-10-10')).toEqual({ dal: '2026-09-01', al: '2027-08-31' });
    expect(stagione('2026-08-31')).toEqual({ dal: '2025-09-01', al: '2026-08-31' });
    expect(stagione('2026-09-01')).toEqual({ dal: '2026-09-01', al: '2027-08-31' });
  });

  it('formats euros the Italian way', () => {
    expect(euroIt(1240)).toBe('€1.240');
    expect(euroIt(188.333)).toBe('€188,33');
    expect(euroIt(0)).toBe('€0');
  });

  it('exports a CSV for Italian Excel', () => {
    const csv = pagamentiCsv([
      { id: 1, data: '2026-10-05', participantId: 1, nome: 'Rossi; Anna "Ann"', courseId: 1, corso: 'Pilates', abbonamento: 'Mensile', dal: '2026-10-05', al: '2026-11-05', importo: 1234.5, ritiratoIl: null },
      { id: 2, data: '2026-10-06', participantId: 2, nome: '=HYPERLINK("x")', courseId: 1, corso: 'Yoga', abbonamento: 'Annuale', dal: '2026-10-06', al: '2027-10-06', importo: 400, ritiratoIl: '2026-10-08' },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Data;Iscritto;Corso;Abbonamento;Dal;Al;Importo (€);Note');
    expect(lines[1]).toBe('05/10/2026;"Rossi; Anna ""Ann""";Pilates;Mensile;05/10/2026;05/11/2026;1234,50;');
    expect(lines[2]).toBe('06/10/2026;"\'=HYPERLINK(""x"")";Yoga;Annuale;06/10/2026;06/10/2027;400,00;Disiscritto il 08/10/2026');
    expect(lines[3]).toBe('');
  });
});
