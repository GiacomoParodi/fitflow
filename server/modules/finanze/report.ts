// Payment reports, computed read-only on the core tables (payments, participants, courses, plans).
import { addMonths, daysBetween, endOfMonth, isISODate } from '../../../shared/dates';
import { isSevere, status, type Status } from '../../../shared/rules';
import type { Database } from '../../db';
import { ApiError } from '../../store';
import type {
  DaPagare, FiltriFinanze, RiepilogoFinanze, VoceAbbonamento, VoceCorso, VoceMese, VocePagamento,
} from './types';

const bad = (msg: string) => new ApiError(400, msg);
const cents = (n: number) => Math.round(n * 100) / 100;

/** At most this many months in the monthly chart (a longer custom period shows its last months). */
export const MAX_MESI = 36;
/** A shorter period is shown inside the 12 months ending with it, for context. */
const MIN_MESI = 12;

function one(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

/** Validates the query string (?dal=&al=&corso=&abbonamento=). Missing dates default to the current month. */
export function parseFiltri(query: Record<string, unknown>, today: string, db: Database): FiltriFinanze {
  const dalRaw = one(query.dal), alRaw = one(query.al);
  const dal = dalRaw === undefined || dalRaw === '' ? today.slice(0, 7) + '-01' : dalRaw;
  const al = alRaw === undefined || alRaw === '' ? endOfMonth(today) : alRaw;
  if (!isISODate(dal)) throw bad('Data di inizio non valida (formato AAAA-MM-GG).');
  if (!isISODate(al)) throw bad('Data di fine non valida (formato AAAA-MM-GG).');
  if (dal > al) throw bad('La data di inizio deve venire prima della data di fine.');

  let corso: number | null = null;
  const corsoRaw = one(query.corso);
  if (corsoRaw !== undefined && corsoRaw !== '') {
    const n = Number(corsoRaw);
    if (!Number.isInteger(n) || n < 1) throw bad('Corso non valido.');
    if (!db.prepare('SELECT 1 FROM courses WHERE id = ?').get(n)) throw new ApiError(404, 'Corso non trovato.');
    corso = n;
  }

  let abbonamento: string | null = null;
  const abbRaw = one(query.abbonamento);
  if (abbRaw !== undefined && abbRaw !== '') {
    if (typeof abbRaw !== 'string' || abbRaw.length > 60) throw bad('Abbonamento non valido.');
    abbonamento = abbRaw;
  }
  return { dal, al, corso, abbonamento };
}

/** "YYYY-MM" months of the chart for a period: the period's months, padded back to 12, capped at 36. */
export function mesiGrafico(dal: string, al: string): string[] {
  const first = dal.slice(0, 7), last = al.slice(0, 7);
  const out: string[] = [];
  for (let m = first + '-01'; m.slice(0, 7) <= last; m = addMonths(m, 1)) out.push(m.slice(0, 7));
  let start = first + '-01';
  while (out.length < MIN_MESI) {
    start = addMonths(start, -1);
    out.unshift(start.slice(0, 7));
  }
  return out.slice(-MAX_MESI);
}

type Row = Record<string, unknown>;

export function riepilogo(db: Database, today: string, sogliaAbbonamento: number, f: FiltriFinanze): RiepilogoFinanze {
  // Filters shared by every payment query (alias p = payments, x = participants).
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (f.corso !== null) { where.push('x.course_id = ?'); args.push(f.corso); }
  if (f.abbonamento !== null) { where.push('p.plan_name = ?'); args.push(f.abbonamento); }
  const extra = where.length ? ' AND ' + where.join(' AND ') : '';
  const from = 'FROM payments p JOIN participants x ON x.id = p.participant_id JOIN courses c ON c.id = x.course_id';
  const inPeriod = `p.date >= ? AND p.date <= ?${extra}`;
  const periodArgs = [f.dal, f.al, ...args];

  const t = db.prepare(`SELECT COALESCE(SUM(p.importo), 0) AS incassato, COUNT(*) AS pagamenti,
    COUNT(DISTINCT p.participant_id) AS persone ${from} WHERE ${inPeriod}`).get(...periodArgs) as Row;
  const incassato = cents(t.incassato as number), nPag = t.pagamenti as number;
  const totali = { incassato, pagamenti: nPag, persone: t.persone as number, medio: nPag ? cents(incassato / nPag) : 0 };

  // Active members, for "iscritti attivi" columns and the current situation.
  const activeWhere: string[] = ['a.ritirato_il IS NULL'];
  const activeArgs: (string | number)[] = [];
  if (f.corso !== null) { activeWhere.push('a.course_id = ?'); activeArgs.push(f.corso); }
  if (f.abbonamento !== null) { activeWhere.push('pl.name = ?'); activeArgs.push(f.abbonamento); }
  const attivi = db.prepare(`SELECT a.id, a.name, a.course_id, a.pagato_fino, pl.name AS plan_name, c.name AS course_name
    FROM participants a JOIN courses c ON c.id = a.course_id LEFT JOIN plans pl ON pl.id = a.plan_id
    WHERE ${activeWhere.join(' AND ')} ORDER BY a.name COLLATE NOCASE`).all(...activeArgs) as Row[];

  // Per plan: every plan sold in the period plus the plans on offer (so a plan nobody buys still shows).
  const byPlan = new Map<string, VoceAbbonamento>();
  const voce = (nome: string) => {
    let v = byPlan.get(nome);
    if (!v) byPlan.set(nome, v = { nome, pagamenti: 0, totale: 0, quota: 0, iscrittiAttivi: 0 });
    return v;
  };
  for (const r of db.prepare(`SELECT p.plan_name AS nome, COUNT(*) AS n, SUM(p.importo) AS tot ${from}
    WHERE ${inPeriod} GROUP BY p.plan_name`).all(...periodArgs) as Row[]) {
    const v = voce(r.nome as string);
    v.pagamenti = r.n as number;
    v.totale = cents(r.tot as number);
  }
  for (const p of db.prepare('SELECT name FROM plans').all() as Row[]) {
    if (f.abbonamento === null || p.name === f.abbonamento) voce(p.name as string);
  }
  for (const a of attivi) if (a.plan_name) voce(a.plan_name as string).iscrittiAttivi++;
  const abbonamenti = [...byPlan.values()]
    .map(v => ({ ...v, quota: incassato ? Math.round((v.totale / incassato) * 1000) / 10 : 0 }))
    .sort((a, b) => b.totale - a.totale || b.pagamenti - a.pagamenti || b.iscrittiAttivi - a.iscrittiAttivi || a.nome.localeCompare(b.nome, 'it'));

  // Per course.
  const courseRows = db.prepare('SELECT id, name FROM courses ORDER BY id').all() as Row[];
  const byCourse = new Map<number, VoceCorso>();
  for (const c of courseRows) {
    if (f.corso !== null && c.id !== f.corso) continue;
    byCourse.set(c.id as number, { id: c.id as number, nome: c.name as string, incassato: 0, pagamenti: 0, iscrittiAttivi: 0, medioPerIscritto: null });
  }
  for (const r of db.prepare(`SELECT x.course_id AS id, COUNT(*) AS n, SUM(p.importo) AS tot ${from}
    WHERE ${inPeriod} GROUP BY x.course_id`).all(...periodArgs) as Row[]) {
    const v = byCourse.get(r.id as number);
    if (v) { v.pagamenti = r.n as number; v.incassato = cents(r.tot as number); }
  }
  for (const a of attivi) {
    const v = byCourse.get(a.course_id as number);
    if (v) v.iscrittiAttivi++;
  }
  const corsi = [...byCourse.values()]
    .map(v => ({ ...v, medioPerIscritto: v.iscrittiAttivi ? cents(v.incassato / v.iscrittiAttivi) : null }))
    .sort((a, b) => b.incassato - a.incassato || a.nome.localeCompare(b.nome, 'it'));

  // Monthly trend.
  const mesiList = mesiGrafico(f.dal, f.al);
  const byMonth = new Map<string, Row>();
  const mStart = mesiList[0] + '-01', mEnd = endOfMonth(mesiList[mesiList.length - 1] + '-01');
  for (const r of db.prepare(`SELECT substr(p.date, 1, 7) AS mese, COUNT(*) AS n, SUM(p.importo) AS tot ${from}
    WHERE p.date >= ? AND p.date <= ?${extra} GROUP BY mese`).all(mStart, mEnd, ...args) as Row[]) {
    byMonth.set(r.mese as string, r);
  }
  const dalM = f.dal.slice(0, 7), alM = f.al.slice(0, 7);
  const mesi: VoceMese[] = mesiList.map(m => ({
    mese: m,
    incassato: cents((byMonth.get(m)?.tot as number) ?? 0),
    pagamenti: (byMonth.get(m)?.n as number) ?? 0,
    nelPeriodo: m >= dalM && m <= alM,
  }));

  // Payment list, newest first.
  const pagamenti: VocePagamento[] = (db.prepare(`SELECT p.id, p.date, p.dal, p.al, p.importo, p.plan_name,
    x.id AS pid, x.name, x.course_id, x.ritirato_il, c.name AS course_name ${from}
    WHERE ${inPeriod} ORDER BY p.date DESC, p.id DESC`).all(...periodArgs) as Row[]).map(r => ({
    id: r.id as number,
    data: r.date as string,
    participantId: r.pid as number,
    nome: r.name as string,
    courseId: r.course_id as number,
    corso: r.course_name as string,
    abbonamento: r.plan_name as string,
    dal: r.dal as string,
    al: r.al as string,
    importo: r.importo as number,
    ritiratoIl: (r.ritirato_il as string | null) ?? null,
  }));

  // Current situation of active members (always "today", whatever the period).
  const count: Record<Status, number> = { valido: 0, in_scadenza: 0, scaduto: 0, mancante: 0 };
  const elenco: DaPagare[] = [];
  for (const a of attivi) {
    const s = status(a.pagato_fino as string | null, sogliaAbbonamento, today);
    count[s]++;
    if (s !== 'valido') {
      elenco.push({
        id: a.id as number, nome: a.name as string, courseId: a.course_id as number, corso: a.course_name as string,
        abbonamento: (a.plan_name as string | null) ?? null, pagatoFino: (a.pagato_fino as string | null) ?? null, stato: s,
      });
    }
  }
  const rank = (d: DaPagare) => (isSevere(d.stato) ? 0 : 1);
  elenco.sort((a, b) => rank(a) - rank(b)
    || (a.pagatoFino === null ? -1 : b.pagatoFino === null ? 1 : daysBetween(b.pagatoFino, a.pagatoFino))
    || a.nome.localeCompare(b.nome, 'it'));

  const nomi = new Set<string>();
  for (const r of db.prepare('SELECT name FROM plans ORDER BY mesi, prezzo').all() as Row[]) nomi.add(r.name as string);
  for (const r of db.prepare('SELECT DISTINCT plan_name FROM payments ORDER BY plan_name').all() as Row[]) nomi.add(r.plan_name as string);

  return {
    filtri: f,
    totali,
    abbonamenti,
    corsi,
    mesi,
    pagamenti,
    situazione: {
      attivi: attivi.length,
      inRegola: count.valido,
      inScadenza: count.in_scadenza,
      daPagare: count.scaduto + count.mancante,
      elenco,
    },
    opzioni: {
      corsi: courseRows.map(c => ({ id: c.id as number, nome: c.name as string })),
      abbonamenti: [...nomi],
    },
  };
}
