import fs from 'node:fs';
import path from 'node:path';
import { transaction, type Database } from '../../../db';
import { ATTREZZI, CATEGORIE, LIVELLI_ESERCIZIO, type Esercizio, type LivelloEsercizio } from '../../../../shared/esercizi';
import { haFts } from '../migrazioni';
import { normalizza, paroleChiave, punteggioLike, queryFts } from './testo';

export interface FiltroEsercizi {
  q?: string;
  categoria?: string;
  /** Attrezzi disponibili: l'esercizio deve richiedere solo questi (il corpo libero va sempre bene). */
  attrezzi?: string[] | null;
  /** Livello massimo. */
  livello?: string;
  obiettivo?: string;
  limite?: number;
}

export interface EsercizioTrovato extends Esercizio {
  punteggio: number;
  /** Cautele che corrispondono alle limitazioni indicate. */
  cauteleRilevanti: string[];
}

const ORDINE_LIVELLO: Record<string, number> = { base: 0, intermedio: 1, avanzato: 2 };

/** "Base"/"Intermedio"/"Avanzato" (livelli degli iscritti) → livello della libreria. */
export function livelloLibreria(v: string | undefined | null): LivelloEsercizio | undefined {
  const n = normalizza(v ?? '');
  return (LIVELLI_ESERCIZIO as readonly string[]).includes(n) ? n as LivelloEsercizio : undefined;
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Controllo leggero del formato: scarta le voci senza i campi essenziali. */
export function validaEsercizio(v: unknown): Esercizio | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id.trim() || typeof o.nome !== 'string' || !o.nome.trim()) return null;
  return {
    id: o.id.trim(),
    nome: o.nome.trim(),
    altriNomi: arr(o.altriNomi),
    categoria: (CATEGORIE as readonly string[]).includes(o.categoria as string) ? o.categoria as Esercizio['categoria'] : 'forza',
    attrezzi: arr(o.attrezzi) as Esercizio['attrezzi'],
    muscoliPrincipali: arr(o.muscoliPrincipali),
    muscoliSecondari: arr(o.muscoliSecondari),
    livello: livelloLibreria(o.livello as string) ?? 'base',
    esecuzione: typeof o.esecuzione === 'string' ? o.esecuzione : '',
    indicazioni: arr(o.indicazioni),
    erroriComuni: arr(o.erroriComuni),
    cautele: arr(o.cautele),
    regressioni: arr(o.regressioni),
    progressioni: arr(o.progressioni),
    obiettivi: arr(o.obiettivi),
    dosaggio: typeof o.dosaggio === 'string' ? o.dosaggio : '',
  };
}

function testoRicerca(e: Esercizio): string {
  return [e.nome, ...e.altriNomi, e.categoria, ...e.attrezzi, ...e.muscoliPrincipali, ...e.muscoliSecondari, ...e.obiettivi, e.esecuzione].join(' \n');
}

export class LibreriaEsercizi {
  private fts: boolean;
  constructor(private db: Database) { this.fts = haFts(db); }

  /**
   * Carica `esercizi.json` (upsert per id; gli esercizi tolti dal file escono dalla libreria).
   * Se il file manca, è vuoto o non valido non fa nulla.
   */
  carica(dir: string | null): { caricati: number; scartati: number } {
    if (!dir) return { caricati: 0, scartati: 0 };
    const file = path.join(dir, 'esercizi.json');
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return { caricati: 0, scartati: 0 };
    }
    if (!Array.isArray(raw)) return { caricati: 0, scartati: 0 };
    const list = raw.map(validaEsercizio).filter((e): e is Esercizio => !!e);
    const unique = new Map(list.map(e => [e.id, e]));
    if (!unique.size) return { caricati: 0, scartati: raw.length };
    transaction(this.db, () => {
      const up = this.db.prepare(`INSERT INTO assistente_esercizi (id, nome, categoria, livello, attrezzi, dati, testo) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET nome=excluded.nome, categoria=excluded.categoria, livello=excluded.livello,
        attrezzi=excluded.attrezzi, dati=excluded.dati, testo=excluded.testo`);
      for (const e of unique.values()) up.run(e.id, e.nome, e.categoria, e.livello, JSON.stringify(e.attrezzi), JSON.stringify(e), testoRicerca(e));
      const ids = [...unique.keys()];
      const existing = (this.db.prepare('SELECT id FROM assistente_esercizi').all() as { id: string }[]).map(r => r.id);
      const del = this.db.prepare('DELETE FROM assistente_esercizi WHERE id = ?');
      for (const id of existing) if (!unique.has(id)) del.run(id);
      if (this.fts) {
        this.db.exec('DELETE FROM assistente_esercizi_fts');
        const ins = this.db.prepare('INSERT INTO assistente_esercizi_fts (eid, testo) VALUES (?, ?)');
        for (const id of ids) ins.run(id, testoRicerca(unique.get(id)!));
      }
    });
    return { caricati: unique.size, scartati: raw.length - list.length };
  }

  conta(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM assistente_esercizi').get() as { n: number }).n;
  }

  tutti(): Esercizio[] {
    return (this.db.prepare('SELECT dati FROM assistente_esercizi ORDER BY nome COLLATE NOCASE').all() as { dati: string }[]).map(r => JSON.parse(r.dati));
  }

  get(id: string): Esercizio | null {
    const r = this.db.prepare('SELECT dati FROM assistente_esercizi WHERE id = ?').get(id) as { dati: string } | undefined;
    return r ? JSON.parse(r.dati) : null;
  }

  /** Categorie e attrezzi effettivamente presenti, per i filtri dell'interfaccia. */
  filtri() {
    const all = this.tutti();
    const att = new Set(all.flatMap(e => e.attrezzi));
    return {
      totale: all.length,
      categorie: CATEGORIE.filter(c => all.some(e => e.categoria === c)),
      attrezzi: [...ATTREZZI.filter(a => att.has(a)), ...[...att].filter(a => !(ATTREZZI as readonly string[]).includes(a))],
      livelli: LIVELLI_ESERCIZIO,
    };
  }

  /** Punteggi di pertinenza testuale per id (più alto = più pertinente). */
  private pertinenza(q: string): Map<string, number> {
    const out = new Map<string, number>();
    const words = paroleChiave(q);
    if (!words.length) return out;
    if (this.fts) {
      const fq = queryFts(q);
      if (fq) {
        try {
          const rows = this.db.prepare('SELECT eid, bm25(assistente_esercizi_fts) AS s FROM assistente_esercizi_fts WHERE assistente_esercizi_fts MATCH ? ORDER BY s LIMIT 400').all(fq) as { eid: string; s: number }[];
          rows.forEach((r, i) => out.set(r.eid, 1 + (rows.length - i) / rows.length));
          return out;
        } catch { /* query non valida: ripiego */ }
      }
    }
    for (const r of this.db.prepare('SELECT id, testo FROM assistente_esercizi').all() as { id: string; testo: string }[]) {
      const s = punteggioLike(r.testo, words);
      if (s > 0) out.set(r.id, s);
    }
    return out;
  }

  /**
   * Cerca esercizi. `q` e `obiettivo` ordinano per pertinenza; categoria, attrezzi e livello filtrano.
   * `limitazioni` segnala le cautele che le riguardano (e abbassa quegli esercizi in classifica).
   */
  cerca(f: FiltroEsercizi & { limitazioni?: string }): EsercizioTrovato[] {
    const lv = livelloLibreria(f.livello);
    // Il tappetino si dà per scontato: è sempre disponibile.
    const disp = f.attrezzi ? new Set([...f.attrezzi, 'tappetino'].map(normalizza)) : null;
    const q = [f.q, f.obiettivo].filter(Boolean).join(' ');
    const pert = q.trim() ? this.pertinenza(q) : null;
    const limWords = paroleChiave(f.limitazioni ?? '');
    const qObj = paroleChiave(f.obiettivo ?? '');

    const out: EsercizioTrovato[] = [];
    for (const e of this.tutti()) {
      if (f.categoria && e.categoria !== f.categoria) continue;
      if (lv && ORDINE_LIVELLO[e.livello] > ORDINE_LIVELLO[lv]) continue;
      if (disp && !e.attrezzi.every(a => disp.has(normalizza(a)))) continue;
      let score = 0;
      if (pert) {
        const p = pert.get(e.id) ?? 0;
        if (f.q && !p) continue; // con una ricerca esplicita si mostrano solo i risultati pertinenti
        score += p;
      }
      // Bonus se un obiettivo dell'esercizio corrisponde a quello richiesto.
      if (qObj.length) score += punteggioLike(e.obiettivi.join(' '), qObj) * 0.5;
      const cauteleRilevanti = limWords.length ? e.cautele.filter(c => punteggioLike(c, limWords) > 0) : [];
      if (cauteleRilevanti.length) score -= 1.5;
      out.push({ ...e, punteggio: score, cauteleRilevanti });
    }
    out.sort((a, b) => b.punteggio - a.punteggio || a.nome.localeCompare(b.nome));
    return f.limite ? out.slice(0, f.limite) : out;
  }

  /** Trova un esercizio per nome o altro nome (per riconoscere esercizi della libreria scritti senza id). */
  perNome(nome: string): Esercizio | null {
    const n = normalizza(nome).replace(/[^a-z0-9]+/g, ' ').trim();
    if (!n) return null;
    for (const e of this.tutti()) {
      for (const x of [e.nome, ...e.altriNomi]) {
        if (normalizza(x).replace(/[^a-z0-9]+/g, ' ').trim() === n) return e;
      }
    }
    return null;
  }
}

