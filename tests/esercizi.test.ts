import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ATTREZZI, CATEGORIE, LIVELLI_ESERCIZIO, type Categoria, type Esercizio } from '../shared/esercizi';

const ROOT = fileURLToPath(new URL('../content', import.meta.url));
const esercizi: Esercizio[] = JSON.parse(readFileSync(join(ROOT, 'esercizi.json'), 'utf8'));

const CAMPI_TESTO = ['id', 'nome', 'esecuzione', 'dosaggio'] as const;
const CAMPI_LISTA = [
  'altriNomi', 'attrezzi', 'muscoliPrincipali', 'muscoliSecondari', 'indicazioni',
  'erroriComuni', 'cautele', 'regressioni', 'progressioni', 'obiettivi',
] as const;
const CAMPI = [...CAMPI_TESTO, ...CAMPI_LISTA, 'categoria', 'livello'];

/** Minimo di esercizi richiesti per ciascuna categoria. */
const MINIMO_PER_CATEGORIA: Record<Categoria, number> = {
  forza: 30, core: 15, cardio: 6, pliometria: 5, mobilita: 10,
  stretching: 8, equilibrio: 6, posturale: 8, respirazione: 3,
};

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const nonVuoto = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

describe('libreria esercizi: struttura', () => {
  it('è un array di 150–200 esercizi', () => {
    expect(Array.isArray(esercizi)).toBe(true);
    expect(esercizi.length).toBeGreaterThanOrEqual(150);
    expect(esercizi.length).toBeLessThanOrEqual(200);
  });

  it('ogni esercizio ha esattamente i campi del tipo Esercizio', () => {
    for (const e of esercizi) {
      expect(Object.keys(e).sort(), e.id).toEqual([...CAMPI].sort());
    }
  });

  it('i campi testuali non sono vuoti', () => {
    for (const e of esercizi) {
      for (const k of CAMPI_TESTO) expect(nonVuoto(e[k]), `${e.id}.${k}`).toBe(true);
    }
  });

  it('i campi lista sono array di stringhe non vuote, senza doppioni', () => {
    for (const e of esercizi) {
      for (const k of CAMPI_LISTA) {
        const v = e[k] as unknown;
        expect(Array.isArray(v), `${e.id}.${k}`).toBe(true);
        const arr = v as unknown[];
        for (const s of arr) expect(nonVuoto(s), `${e.id}.${k}`).toBe(true);
        expect(new Set(arr).size, `${e.id}.${k} doppioni`).toBe(arr.length);
      }
    }
  });

  it('categoria, livello e attrezzi sono valori ammessi', () => {
    for (const e of esercizi) {
      expect(CATEGORIE, e.id).toContain(e.categoria);
      expect(LIVELLI_ESERCIZIO, e.id).toContain(e.livello);
      for (const a of e.attrezzi) expect(ATTREZZI, `${e.id}: ${a}`).toContain(a);
    }
  });

  it('le liste didattiche hanno un contenuto minimo', () => {
    for (const e of esercizi) {
      expect(e.muscoliPrincipali.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.indicazioni.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.indicazioni.length, e.id).toBeLessThanOrEqual(4);
      expect(e.erroriComuni.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.cautele.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.obiettivi.length, e.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("l'esecuzione è una descrizione di 2–5 frasi", () => {
    for (const e of esercizi) {
      const frasi = e.esecuzione.split(/[.!?](?:\s|$)/).filter((f) => f.trim().length > 0);
      expect(frasi.length, e.id).toBeGreaterThanOrEqual(2);
      expect(frasi.length, e.id).toBeLessThanOrEqual(5);
    }
  });
});

describe('libreria esercizi: id e riferimenti', () => {
  const ids = new Set(esercizi.map((e) => e.id));

  it('gli id sono unici e in kebab-case', () => {
    expect(ids.size).toBe(esercizi.length);
    for (const e of esercizi) expect(e.id, e.id).toMatch(KEBAB);
  });

  it('i nomi sono unici', () => {
    const nomi = esercizi.map((e) => e.nome.toLowerCase());
    expect(new Set(nomi).size).toBe(nomi.length);
  });

  it('regressioni e progressioni puntano a esercizi esistenti e non a sé stessi', () => {
    for (const e of esercizi) {
      for (const r of [...e.regressioni, ...e.progressioni]) {
        expect(ids.has(r), `${e.id} -> ${r}`).toBe(true);
        expect(r, `${e.id} si riferisce a sé stesso`).not.toBe(e.id);
      }
    }
  });

  it('un esercizio non è sia regressione sia progressione dello stesso', () => {
    for (const e of esercizi) {
      const comuni = e.regressioni.filter((r) => e.progressioni.includes(r));
      expect(comuni, e.id).toEqual([]);
    }
  });

  it('le catene sono coerenti: A non è insieme progressione e regressione di B', () => {
    const perId = new Map(esercizi.map((e) => [e.id, e]));
    for (const e of esercizi) {
      for (const p of e.progressioni) {
        expect(perId.get(p)!.progressioni, `${e.id} <-> ${p}`).not.toContain(e.id);
      }
      for (const r of e.regressioni) {
        expect(perId.get(r)!.regressioni, `${e.id} <-> ${r}`).not.toContain(e.id);
      }
    }
  });
});

describe('libreria esercizi: copertura', () => {
  it('ogni categoria ha un numero minimo di esercizi', () => {
    for (const c of CATEGORIE) {
      const n = esercizi.filter((e) => e.categoria === c).length;
      expect(n, c).toBeGreaterThanOrEqual(MINIMO_PER_CATEGORIA[c]);
    }
  });

  it('ogni livello è rappresentato', () => {
    for (const l of LIVELLI_ESERCIZIO) {
      expect(esercizi.some((e) => e.livello === l), l).toBe(true);
    }
  });

  it('almeno il 40% degli esercizi è a corpo libero', () => {
    const corpoLibero = esercizi.filter((e) => e.attrezzi.length === 0).length;
    expect(corpoLibero / esercizi.length).toBeGreaterThanOrEqual(0.4);
  });

  it('gli attrezzi principali sono coperti', () => {
    const principali = [
      'manubri', 'kettlebell', 'bilanciere', 'elastico', 'mini band', 'fitball', 'TRX', 'step', 'panca',
      'sbarra', 'cavi', 'palla medica', 'bosu', 'foam roller', 'spalliera', 'cerchio pilates',
    ];
    for (const a of principali) {
      expect(esercizi.some((e) => (e.attrezzi as string[]).includes(a)), a).toBe(true);
    }
  });

  it('ci sono esercizi per gli obiettivi più richiesti', () => {
    for (const o of ['lombalgia aspecifica', 'postura', 'anziani', 'principianti', 'pilates', 'equilibrio']) {
      const n = esercizi.filter((e) => e.obiettivi.includes(o)).length;
      expect(n, o).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('schede di conoscenza', () => {
  const dir = join(ROOT, 'conoscenze');
  const schede = readdirSync(dir).filter((f) => f.endsWith('.md'));

  it('esistono almeno 6 schede', () => {
    expect(schede.length).toBeGreaterThanOrEqual(6);
  });

  it('ogni scheda ha un titolo, sezioni e contenuto', () => {
    for (const f of schede) {
      const testo = readFileSync(join(dir, f), 'utf8');
      expect(testo.trim().length, f).toBeGreaterThan(500);
      expect(testo, f).toMatch(/^# \S/);
      expect((testo.match(/^## \S/gm) ?? []).length, f).toBeGreaterThanOrEqual(3);
    }
  });

  it('è presente la scheda sui segnali d\'allarme', () => {
    expect(schede).toContain('segnali-di-allarme.md');
  });
});
