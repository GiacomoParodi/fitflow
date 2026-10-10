import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { transaction, type Database } from '../../../db';
import { ApiError } from '../../../store';
import type { Documento, RisultatoRicerca, StatoDocumento } from '../../../../shared/assistente';
import type { AiProvider } from '../providers';
import { haFts } from '../migrazioni';
import { MAX_FILE_BYTES, TIPI, estraiTesto, suddividi, tipoFile } from './estrazione';
import { coseno, daBlob, paroleChiave, punteggioLike, queryFts, versoBlob } from './testo';

type Row = Record<string, unknown>;

/** Motore e modello da usare per gli embedding, o null (solo ricerca testuale). */
export type RisolviEmbedding = () => Promise<{ provider: AiProvider; modello: string } | null>;

export interface AmbitoRicerca {
  conoscenze?: boolean;
  documenti?: boolean;
  /** Cartella di questo iscritto. */
  partecipanteId?: number | null;
  /** Documenti scelti esplicitamente: sempre inclusi e favoriti. */
  documentiIds?: number[];
}

interface Lavoro { id: number; soloVettori: boolean }

const BATCH_EMBEDDING = 16;

export class Documenti {
  private fts: boolean;
  private coda: Lavoro[] = [];
  private inCorso: string | null = null;
  private running: Promise<void> | null = null;
  private stopped = false;
  readonly dir: string;

  constructor(private db: Database, dataDir: string, private risolviEmbedding: RisolviEmbedding, private now: () => string = () => new Date().toISOString()) {
    this.fts = haFts(db);
    this.dir = path.join(dataDir, 'assistente', 'documenti');
  }

  // ─── Letture ──────────────────────────────────────────────────────────

  private daRiga(r: Row): Documento {
    return {
      id: r.id as number,
      origine: r.origine as Documento['origine'],
      partecipanteId: r.partecipante_id as number | null,
      titolo: r.titolo as string,
      nomeFile: r.nome_file as string,
      mime: r.mime as string,
      dimensione: r.dimensione as number,
      stato: r.stato as StatoDocumento,
      errore: r.errore as string | null,
      caratteri: r.caratteri as number,
      estratti: (r.n_estratti as number) ?? 0,
      estrattiConVettore: (r.n_vettori as number) ?? 0,
      modelloEmbedding: r.modello_embedding as string | null,
      caricatoIl: r.caricato_il as string,
    };
  }

  private static SELECT = `SELECT d.*,
    (SELECT COUNT(*) FROM assistente_estratti e WHERE e.documento_id = d.id) AS n_estratti,
    (SELECT COUNT(*) FROM assistente_estratti e WHERE e.documento_id = d.id AND e.vettore IS NOT NULL) AS n_vettori
    FROM assistente_documenti d`;

  /** `partecipanteId`: undefined = tutti, null = solo libreria generale e schede di base, numero = cartella. */
  elenco(partecipanteId?: number | null): Documento[] {
    let rows: Row[];
    if (partecipanteId === undefined) rows = this.db.prepare(`${Documenti.SELECT} ORDER BY d.origine DESC, d.caricato_il DESC, d.id DESC`).all() as Row[];
    else if (partecipanteId === null) rows = this.db.prepare(`${Documenti.SELECT} WHERE d.partecipante_id IS NULL ORDER BY d.origine DESC, d.caricato_il DESC, d.id DESC`).all() as Row[];
    else rows = this.db.prepare(`${Documenti.SELECT} WHERE d.partecipante_id = ? ORDER BY d.caricato_il DESC, d.id DESC`).all(partecipanteId) as Row[];
    return rows.map(r => this.daRiga(r));
  }

  get(id: number): Documento {
    const r = this.db.prepare(`${Documenti.SELECT} WHERE d.id = ?`).get(id) as Row | undefined;
    if (!r) throw new ApiError(404, 'Documento non trovato.');
    return this.daRiga(r);
  }

  file(id: number): { path: string; name: string; mime: string } {
    const r = this.db.prepare('SELECT origine, percorso, nome_file, mime FROM assistente_documenti WHERE id = ?').get(id) as Row | undefined;
    if (!r || !r.percorso) throw new ApiError(404, 'Documento non trovato.');
    const p = r.origine === 'base' ? r.percorso as string : path.join(this.dir, r.percorso as string);
    if (!fs.existsSync(p)) throw new ApiError(404, 'Il file del documento non c\'è più.');
    return { path: p, name: r.nome_file as string, mime: r.mime as string };
  }

  testoCompleto(id: number): string {
    return (this.db.prepare('SELECT testo FROM assistente_estratti WHERE documento_id = ? ORDER BY ordine').all(id) as { testo: string }[]).map(r => r.testo).join('\n\n');
  }

  stato() {
    return { inCoda: this.coda.length, inCorso: this.inCorso };
  }

  // ─── Scritture ────────────────────────────────────────────────────────

  carica(data: Buffer, nomeOriginale: string, partecipanteId: number | null): Documento {
    const nome = path.basename(nomeOriginale || '').slice(0, 200) || 'documento';
    const { ext, mime } = tipoFile(nome);
    if (!data.length) throw new ApiError(400, 'Il file è vuoto.');
    if (data.length > MAX_FILE_BYTES) throw new ApiError(413, 'Il file supera i 20 MB.');
    fs.mkdirSync(this.dir, { recursive: true });
    const stored = randomUUID() + ext;
    fs.writeFileSync(path.join(this.dir, stored), data);
    const titolo = nome.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || nome;
    const r = this.db.prepare(`INSERT INTO assistente_documenti (origine, partecipante_id, titolo, nome_file, mime, dimensione, percorso, impronta, stato, caricato_il)
      VALUES ('caricato', ?, ?, ?, ?, ?, ?, ?, 'in_attesa', ?)`).run(
      partecipanteId, titolo, nome, mime, data.length, stored, createHash('sha256').update(data).digest('hex'), this.now(),
    );
    const id = Number(r.lastInsertRowid);
    this.accoda(id, false);
    return this.get(id);
  }

  rinomina(id: number, titolo: string): Documento {
    const t = titolo.trim().slice(0, 200);
    if (!t) throw new ApiError(400, 'Il titolo è obbligatorio.');
    this.get(id);
    this.db.prepare('UPDATE assistente_documenti SET titolo = ? WHERE id = ?').run(t, id);
    return this.get(id);
  }

  elimina(id: number) {
    const d = this.get(id);
    if (d.origine === 'base') throw new ApiError(400, 'Le schede di conoscenza di base non si possono eliminare.');
    const r = this.db.prepare('SELECT percorso FROM assistente_documenti WHERE id = ?').get(id) as { percorso: string | null };
    transaction(this.db, () => {
      this.cancellaEstratti(id);
      this.db.prepare('DELETE FROM assistente_documenti WHERE id = ?').run(id);
    });
    this.coda = this.coda.filter(j => j.id !== id);
    if (r.percorso) fs.rmSync(path.join(this.dir, r.percorso), { force: true });
  }

  /**
   * Indicizza le schede di conoscenza (`content/conoscenze/*.md`) come documenti di base in sola lettura:
   * aggiunge le nuove, riaggiorna quelle cambiate, toglie quelle sparite.
   */
  sincronizzaConoscenze(contentDir: string | null) {
    const dir = contentDir ? path.join(contentDir, 'conoscenze') : null;
    const files = dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.(md|markdown|txt)$/i.test(f)).sort() : [];
    const seen = new Set<string>();
    for (const f of files) {
      const full = path.join(dir!, f);
      let data: Buffer;
      try { data = fs.readFileSync(full); } catch { continue; }
      const chiave = 'conoscenze/' + f;
      seen.add(chiave);
      const hash = createHash('sha256').update(data).digest('hex');
      const text = data.toString('utf8');
      const titolo = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || f.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      const cur = this.db.prepare('SELECT id, impronta, percorso FROM assistente_documenti WHERE chiave = ?').get(chiave) as { id: number; impronta: string; percorso: string } | undefined;
      if (cur && cur.impronta === hash && cur.percorso === full) continue;
      if (cur) {
        this.db.prepare("UPDATE assistente_documenti SET titolo=?, percorso=?, impronta=?, dimensione=?, stato='in_attesa', errore=NULL WHERE id=?")
          .run(titolo, full, hash, data.length, cur.id);
        if (cur.impronta !== hash) this.accoda(cur.id, false);
      } else {
        const r = this.db.prepare(`INSERT INTO assistente_documenti (origine, partecipante_id, chiave, titolo, nome_file, mime, dimensione, percorso, impronta, stato, caricato_il)
          VALUES ('base', NULL, ?, ?, ?, ?, ?, ?, ?, 'in_attesa', ?)`).run(chiave, titolo, f, TIPI['.md'].mime, data.length, full, hash, this.now());
        this.accoda(Number(r.lastInsertRowid), false);
      }
    }
    const stale = (this.db.prepare("SELECT id, chiave FROM assistente_documenti WHERE origine = 'base'").all() as { id: number; chiave: string }[])
      .filter(r => !seen.has(r.chiave));
    for (const r of stale) {
      transaction(this.db, () => {
        this.cancellaEstratti(r.id);
        this.db.prepare('DELETE FROM assistente_documenti WHERE id = ?').run(r.id);
      });
    }
  }

  /** Rimette in coda i documenti rimasti a metà (es. app chiusa durante l'indicizzazione). */
  riprendi() {
    const rows = this.db.prepare("SELECT id FROM assistente_documenti WHERE stato IN ('in_attesa', 'elaborazione')").all() as { id: number }[];
    for (const r of rows) this.accoda(r.id, false);
  }

  /** Reindicizza da capo (testo e vettori): un documento o tutti. */
  reindicizza(id?: number) {
    const ids = id ? [this.get(id).id] : (this.db.prepare('SELECT id FROM assistente_documenti').all() as { id: number }[]).map(r => r.id);
    for (const x of ids) {
      this.db.prepare("UPDATE assistente_documenti SET stato = 'in_attesa', errore = NULL WHERE id = ?").run(x);
      this.accoda(x, false);
    }
  }

  /** Calcola i vettori mancanti o fatti con un altro modello di embedding (dopo un cambio di modello). */
  async aggiornaVettori() {
    const emb = await this.risolviEmbedding().catch(() => null);
    if (!emb) return 0;
    const rows = this.db.prepare(`SELECT DISTINCT d.id FROM assistente_documenti d JOIN assistente_estratti e ON e.documento_id = d.id
      WHERE d.stato = 'pronto' AND (e.vettore IS NULL OR e.modello_embedding IS NOT ?)`).all(emb.modello) as { id: number }[];
    for (const r of rows) this.accoda(r.id, true);
    return rows.length;
  }

  // ─── Coda di indicizzazione ───────────────────────────────────────────

  private accoda(id: number, soloVettori: boolean) {
    const ex = this.coda.find(j => j.id === id);
    if (ex) ex.soloVettori = ex.soloVettori && soloVettori;
    else this.coda.push({ id, soloVettori });
    if (!this.running && !this.stopped) {
      this.running = this.lavora().finally(() => { this.running = null; });
    }
  }

  /** Risolve quando la coda è vuota (utile nei test). */
  async attendi() {
    while (this.running) await this.running;
  }

  ferma() {
    this.stopped = true;
    this.coda = [];
  }

  private async lavora() {
    // Lascia finire la richiesta HTTP che ha accodato il lavoro.
    await new Promise(r => setImmediate(r));
    while (this.coda.length && !this.stopped) {
      const job = this.coda.shift()!;
      try {
        await this.esegui(job);
      } catch {
        // Database chiuso (app in chiusura) o errore imprevisto: si ferma senza far cadere il processo.
        this.stopped = true;
      } finally {
        this.inCorso = null;
      }
    }
  }

  private async esegui(job: Lavoro) {
    const row = this.db.prepare('SELECT * FROM assistente_documenti WHERE id = ?').get(job.id) as Row | undefined;
    if (!row) return;
    this.inCorso = row.titolo as string;
    try {
      if (!job.soloVettori) await this.estrai(row);
      if (this.stopped) return;
      await this.vettori(job.id);
    } catch (e) {
      if (this.stopped) return;
      const msg = e instanceof ApiError ? e.message : 'Errore durante la lettura del documento.';
      this.db.prepare("UPDATE assistente_documenti SET stato = 'errore', errore = ? WHERE id = ?").run(msg, job.id);
    }
  }

  private cancellaEstratti(docId: number) {
    if (this.fts) {
      this.db.prepare('DELETE FROM assistente_estratti_fts WHERE rowid IN (SELECT id FROM assistente_estratti WHERE documento_id = ?)').run(docId);
    }
    this.db.prepare('DELETE FROM assistente_estratti WHERE documento_id = ?').run(docId);
  }

  private async estrai(row: Row) {
    const id = row.id as number;
    this.db.prepare("UPDATE assistente_documenti SET stato = 'elaborazione', errore = NULL WHERE id = ?").run(id);
    const p = row.origine === 'base' ? row.percorso as string : path.join(this.dir, row.percorso as string);
    let data: Buffer;
    try { data = fs.readFileSync(p); } catch { throw new ApiError(404, 'Il file del documento non c\'è più.'); }
    const text = await estraiTesto(data, row.nome_file as string);
    if (this.stopped) return;
    const pezzi = suddividi(text);
    transaction(this.db, () => {
      this.cancellaEstratti(id);
      const ins = this.db.prepare('INSERT INTO assistente_estratti (documento_id, ordine, testo) VALUES (?, ?, ?)');
      const insFts = this.fts ? this.db.prepare('INSERT INTO assistente_estratti_fts (rowid, testo) VALUES (?, ?)') : null;
      pezzi.forEach((t, i) => {
        const r = ins.run(id, i, t);
        insFts?.run(Number(r.lastInsertRowid), `${row.titolo as string}\n${t}`);
      });
      if (text.replace(/\s/g, '').length < 20) {
        const msg = /pdf$/i.test(row.nome_file as string)
          ? 'Nessun testo trovato: probabilmente è una scansione (immagine). Serve un PDF con testo selezionabile.'
          : 'Nessun testo trovato nel documento.';
        this.db.prepare("UPDATE assistente_documenti SET stato = 'senza_testo', errore = ?, caratteri = 0, modello_embedding = NULL WHERE id = ?").run(msg, id);
      } else {
        this.db.prepare("UPDATE assistente_documenti SET stato = 'pronto', caratteri = ?, modello_embedding = NULL WHERE id = ?").run(text.length, id);
      }
    });
  }

  /** Calcola gli embedding degli estratti senza vettore (o con un modello diverso). Se non si può, resta la ricerca testuale. */
  private async vettori(docId: number) {
    const st = this.db.prepare('SELECT stato FROM assistente_documenti WHERE id = ?').get(docId) as { stato: string } | undefined;
    if (st?.stato !== 'pronto') return;
    let emb: Awaited<ReturnType<RisolviEmbedding>>;
    try { emb = await this.risolviEmbedding(); } catch { emb = null; }
    if (!emb) return;
    const rows = this.db.prepare('SELECT id, testo FROM assistente_estratti WHERE documento_id = ? AND (vettore IS NULL OR modello_embedding IS NOT ?) ORDER BY ordine')
      .all(docId, emb.modello) as { id: number; testo: string }[];
    const up = this.db.prepare('UPDATE assistente_estratti SET vettore = ?, modello_embedding = ? WHERE id = ?');
    try {
      for (let i = 0; i < rows.length; i += BATCH_EMBEDDING) {
        if (this.stopped) return;
        const batch = rows.slice(i, i + BATCH_EMBEDDING);
        const vecs = await emb.provider.embed(emb.modello, batch.map(r => r.testo));
        transaction(this.db, () => batch.forEach((r, k) => up.run(versoBlob(vecs[k]), emb!.modello, r.id)));
      }
      this.db.prepare('UPDATE assistente_documenti SET modello_embedding = ?, errore = NULL WHERE id = ?').run(emb.modello, docId);
    } catch (e) {
      if (this.stopped) return;
      const msg = e instanceof ApiError ? e.message : 'errore del motore';
      this.db.prepare('UPDATE assistente_documenti SET errore = ? WHERE id = ?').run(`Ricerca per significato non disponibile (${msg}); resta attiva la ricerca per parole.`, docId);
    }
  }

  // ─── Ricerca ─────────────────────────────────────────────────────────

  private ambitoSql(a: AmbitoRicerca): { sql: string; params: (number | string)[] } {
    const parts: string[] = [];
    const params: (number | string)[] = [];
    if (a.conoscenze) parts.push("d.origine = 'base'");
    if (a.documenti) parts.push("(d.origine = 'caricato' AND d.partecipante_id IS NULL)");
    if (a.partecipanteId) { parts.push('d.partecipante_id = ?'); params.push(a.partecipanteId); }
    const ids = (a.documentiIds ?? []).filter(n => Number.isInteger(n));
    // Documents picked by id: only general ones or those in this person's own folder.
    if (ids.length) {
      parts.push(`(d.id IN (${ids.map(() => '?').join(',')}) AND (d.partecipante_id IS NULL OR d.partecipante_id = ?))`);
      params.push(...ids, a.partecipanteId ?? -1);
    }
    return { sql: parts.length ? `(${parts.join(' OR ')}) AND d.stato = 'pronto'` : '0', params };
  }

  /**
   * Ricerca ibrida: testo (FTS5 o LIKE) + similarità coseno dei vettori quando c'è un modello di embedding,
   * combinate con Reciprocal Rank Fusion.
   */
  async cerca(
    query: string, ambito: AmbitoRicerca, limite = 8, signal?: AbortSignal,
    embedding?: Awaited<ReturnType<RisolviEmbedding>>,
  ): Promise<RisultatoRicerca[]> {
    const { sql, params } = this.ambitoSql(ambito);
    const ranks = new Map<number, number>();
    const add = (list: number[], weight = 1) => list.forEach((id, i) => ranks.set(id, (ranks.get(id) ?? 0) + weight / (60 + i)));

    // Testuale
    const words = paroleChiave(query);
    if (words.length) {
      let ids: number[] = [];
      const fq = this.fts ? queryFts(query) : null;
      if (fq) {
        try {
          ids = (this.db.prepare(`SELECT e.id FROM assistente_estratti_fts f JOIN assistente_estratti e ON e.id = f.rowid
            JOIN assistente_documenti d ON d.id = e.documento_id WHERE assistente_estratti_fts MATCH ? AND ${sql}
            ORDER BY bm25(assistente_estratti_fts) LIMIT 200`).all(fq, ...params) as { id: number }[]).map(r => r.id);
        } catch { ids = []; }
      } else {
        const rows = this.db.prepare(`SELECT e.id, e.testo FROM assistente_estratti e JOIN assistente_documenti d ON d.id = e.documento_id WHERE ${sql}`).all(...params) as { id: number; testo: string }[];
        ids = rows.map(r => ({ id: r.id, s: punteggioLike(r.testo, words) })).filter(r => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 200).map(r => r.id);
      }
      add(ids);
    }

    // Per significato
    if (query.trim()) {
      const emb = embedding !== undefined ? embedding : await this.risolviEmbedding().catch(() => null);
      if (emb) {
        const rows = this.db.prepare(`SELECT e.id, e.vettore FROM assistente_estratti e JOIN assistente_documenti d ON d.id = e.documento_id
          WHERE e.vettore IS NOT NULL AND e.modello_embedding = ? AND ${sql}`).all(emb.modello, ...params) as { id: number; vettore: Uint8Array }[];
        if (rows.length) {
          try {
            const [qv] = await emb.provider.embed(emb.modello, [query.slice(0, 2000)], signal);
            const scored = rows.map(r => ({ id: r.id, s: coseno(qv, daBlob(r.vettore)) })).filter(r => r.s > 0.15).sort((a, b) => b.s - a.s).slice(0, 200);
            add(scored.map(r => r.id));
          } catch (e) {
            if (signal?.aborted) throw e;
            /* motore non disponibile: resta la ricerca testuale */
          }
        }
      }
    }

    // Documenti scelti esplicitamente: piccolo vantaggio.
    const chosen = new Set(ambito.documentiIds ?? []);
    const ids = [...ranks.keys()];
    if (!ids.length) return [];
    const info = new Map((this.db.prepare(`SELECT e.id, e.documento_id, e.testo, d.titolo, d.origine, d.partecipante_id FROM assistente_estratti e
      JOIN assistente_documenti d ON d.id = e.documento_id WHERE e.id IN (${ids.map(() => '?').join(',')})`).all(...ids) as Row[]).map(r => [r.id as number, r]));
    return ids
      .map(id => {
        const r = info.get(id)!;
        const bonus = chosen.has(r.documento_id as number) ? 1 / 60 : 0;
        return {
          estrattoId: id, documentoId: r.documento_id as number, documento: r.titolo as string, origine: r.origine as 'base' | 'caricato',
          partecipanteId: r.partecipante_id as number | null, testo: r.testo as string, punteggio: (ranks.get(id) ?? 0) + bonus,
        };
      })
      .sort((a, b) => b.punteggio - a.punteggio)
      .slice(0, limite);
  }

  /** Primi estratti di ciascun documento (per avere una visione d'insieme della cartella). */
  iniziDocumenti(docIds: number[], perDoc: number, partecipanteId: number | null): RisultatoRicerca[] {
    const out: RisultatoRicerca[] = [];
    // Only general documents or the given person's own folder: never another member's records.
    const q = this.db.prepare(`SELECT e.id, e.documento_id, e.testo, d.titolo, d.origine, d.partecipante_id FROM assistente_estratti e
      JOIN assistente_documenti d ON d.id = e.documento_id WHERE e.documento_id = ? AND d.stato = 'pronto'
      AND (d.partecipante_id IS NULL OR d.partecipante_id = ?) ORDER BY e.ordine LIMIT ?`);
    for (const id of docIds) {
      for (const r of q.all(id, partecipanteId ?? -1, perDoc) as Row[]) {
        out.push({ estrattoId: r.id as number, documentoId: id, documento: r.titolo as string, origine: r.origine as 'base' | 'caricato', partecipanteId: r.partecipante_id as number | null, testo: r.testo as string, punteggio: 0 });
      }
    }
    return out;
  }
}
