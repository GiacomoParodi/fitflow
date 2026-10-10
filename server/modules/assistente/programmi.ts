import type { Database } from '../../db';
import { ApiError } from '../../store';
import {
  normalizzaAnalisi, normalizzaProgramma, type Contenuto, type InputGenerazione, type Programma,
} from '../../../shared/assistente';

type Row = Record<string, unknown>;

/** Porta un contenuto (anche modificato a mano) a una forma valida. */
export function normalizzaContenuto(v: unknown): Contenuto {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  if (o.tipo === 'analisi') return normalizzaAnalisi(o);
  if (o.tipo === 'nota') {
    const testo = typeof o.testo === 'string' ? o.testo.slice(0, 50000) : '';
    return { tipo: 'nota', titolo: typeof o.titolo === 'string' && o.titolo.trim() ? o.titolo.trim().slice(0, 200) : 'Nota', testo };
  }
  return normalizzaProgramma(o);
}

function daRiga(r: Row): Programma {
  return {
    id: r.id as number,
    partecipanteId: r.partecipante_id as number | null,
    agenteId: r.agente_id as number | null,
    agenteNome: r.agente_nome as string,
    titolo: r.titolo as string,
    input: JSON.parse(r.input as string),
    contenuto: JSON.parse(r.contenuto as string),
    stato: r.stato as Programma['stato'],
    creatoIl: r.creato_il as string,
    aggiornatoIl: r.aggiornato_il as string,
  };
}

export class Programmi {
  constructor(private db: Database, private esisteIscritto: (id: number) => boolean, private now: () => string = () => new Date().toISOString()) {}

  elenco(partecipanteId?: number | null): Programma[] {
    const rows = partecipanteId === undefined
      ? this.db.prepare('SELECT * FROM assistente_programmi ORDER BY aggiornato_il DESC, id DESC').all()
      : partecipanteId === null
        ? this.db.prepare('SELECT * FROM assistente_programmi WHERE partecipante_id IS NULL ORDER BY aggiornato_il DESC, id DESC').all()
        : this.db.prepare('SELECT * FROM assistente_programmi WHERE partecipante_id = ? ORDER BY aggiornato_il DESC, id DESC').all(partecipanteId);
    return (rows as Row[]).map(daRiga);
  }

  get(id: number): Programma {
    const r = this.db.prepare('SELECT * FROM assistente_programmi WHERE id = ?').get(id) as Row | undefined;
    if (!r) throw new ApiError(404, 'Programma non trovato.');
    return daRiga(r);
  }

  private campi(b: Record<string, unknown>, cur?: Programma) {
    const contenuto = 'contenuto' in b ? normalizzaContenuto(b.contenuto) : cur?.contenuto;
    if (!contenuto) throw new ApiError(400, 'Il contenuto è obbligatorio.');
    const titoloRaw = typeof b.titolo === 'string' && b.titolo.trim() ? b.titolo.trim() : contenuto.titolo || cur?.titolo || 'Programma';
    const titolo = titoloRaw.slice(0, 200);
    let partecipanteId = cur?.partecipanteId ?? null;
    if ('partecipanteId' in b) {
      partecipanteId = b.partecipanteId === null || b.partecipanteId === undefined || b.partecipanteId === '' ? null : Number(b.partecipanteId);
      if (partecipanteId !== null && (!Number.isInteger(partecipanteId) || !this.esisteIscritto(partecipanteId))) throw new ApiError(400, 'Iscritto non trovato.');
    }
    const stato = 'stato' in b ? b.stato : cur?.stato ?? 'bozza';
    if (stato !== 'bozza' && stato !== 'approvato') throw new ApiError(400, 'Stato non valido.');
    const input = 'input' in b && b.input && typeof b.input === 'object' ? b.input as Partial<InputGenerazione> : cur?.input ?? {};
    const json = JSON.stringify(contenuto);
    if (json.length > 400_000) throw new ApiError(413, 'Il programma è troppo lungo.');
    return { contenuto: { ...contenuto, titolo }, titolo, partecipanteId, stato, input };
  }

  crea(b: Record<string, unknown>, agente?: { id: number; nome: string } | null): Programma {
    const c = this.campi(b);
    const t = this.now();
    const r = this.db.prepare(`INSERT INTO assistente_programmi (partecipante_id, agente_id, agente_nome, titolo, input, contenuto, stato, creato_il, aggiornato_il)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(c.partecipanteId, agente?.id ?? null, agente?.nome ?? '', c.titolo, JSON.stringify(c.input), JSON.stringify(c.contenuto), c.stato as string, t, t);
    return this.get(Number(r.lastInsertRowid));
  }

  aggiorna(id: number, b: Record<string, unknown>): Programma {
    const cur = this.get(id);
    const c = this.campi(b, cur);
    this.db.prepare('UPDATE assistente_programmi SET partecipante_id=?, titolo=?, input=?, contenuto=?, stato=?, aggiornato_il=? WHERE id=?')
      .run(c.partecipanteId, c.titolo, JSON.stringify(c.input), JSON.stringify(c.contenuto), c.stato as string, this.now(), id);
    return this.get(id);
  }

  elimina(id: number) {
    this.get(id);
    this.db.prepare('DELETE FROM assistente_programmi WHERE id = ?').run(id);
  }
}
