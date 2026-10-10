import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { transaction, type Database, type Migration } from './db';
import { addDays, addMonths, endOfMonth, isISODate, todayISO } from '../shared/dates';
import { paymentPeriod, renewedIscrizione } from '../shared/rules';
import {
  LIVELLI,
  type AppState, type Course, type Lesson, type Livello, type NewParticipantInput,
  type Participant, type Payment, type Plan, type Settings,
} from '../shared/types';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const bad = (msg: string) => new ApiError(400, msg);
const notFound = (what: string) => new ApiError(404, `${what} non trovato.`);

const CORE_SCHEMA = `
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  giorni TEXT NOT NULL,
  orario TEXT NOT NULL,
  capienza INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  mesi INTEGER NOT NULL,
  prezzo REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  livello TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  pagato_fino TEXT,
  iscrizione_scadenza TEXT,
  cert_scadenza TEXT,
  cert_file_path TEXT,
  cert_file_name TEXT,
  cert_file_mime TEXT,
  cert_file_size INTEGER,
  cert_uploaded_at TEXT,
  iscritto_il TEXT NOT NULL,
  ritirato_il TEXT
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  dal TEXT NOT NULL,
  al TEXT NOT NULL,
  importo REAL NOT NULL,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  UNIQUE (course_id, date)
);
CREATE TABLE IF NOT EXISTS attendance (
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_participants_course ON participants(course_id);
CREATE INDEX IF NOT EXISTS idx_payments_participant ON payments(participant_id);
`;

/** Schema history of the core module. Append new entries; never edit released ones. */
export const coreMigrations: Migration[] = [
  { id: 'core/001-schema-iniziale', up: db => db.exec(CORE_SCHEMA) },
];

const DEFAULT_SETTINGS: Settings = {
  instructorName: 'Marco',
  quotaIscrizione: 30,
  scadenzaStagione: '',
  sogliaCertificato: 30,
  sogliaIscrizione: 30,
  sogliaAbbonamento: 4,
};

const DEFAULT_PLANS: Omit<Plan, 'id'>[] = [
  { name: 'Mensile', mesi: 1, prezzo: 45 },
  { name: 'Trimestrale', mesi: 3, prezzo: 120 },
  { name: 'Semestrale', mesi: 6, prezzo: 220 },
  { name: 'Annuale', mesi: 12, prezzo: 400 },
];

export const ALLOWED_CERT_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/pdf': '.pdf',
};

/** Next 31 August on or after today: the usual end of a sports season. */
function defaultSeasonEnd(today: string): string {
  const y = Number(today.slice(0, 4));
  const thisYear = `${y}-08-31`;
  return today <= thisYear ? thisYear : `${y + 1}-08-31`;
}

type Row = Record<string, unknown>;

function str(v: unknown, field: string, { required = true, max = 200 } = {}): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw bad(`${field} è obbligatorio.`);
  if (s.length > max) throw bad(`${field} è troppo lungo.`);
  return s;
}

function optDate(v: unknown, field: string): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (!isISODate(v)) throw bad(`${field}: data non valida.`);
  return v;
}

function reqDate(v: unknown, field: string): string {
  const d = optDate(v, field);
  if (!d) throw bad(`${field} è obbligatoria.`);
  return d;
}

function int(v: unknown, field: string, min: number, max = 100000): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${field}: valore non valido.`);
  return n;
}

function num(v: unknown, field: string, min: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < min) throw bad(`${field}: valore non valido.`);
  return Math.round(n * 100) / 100;
}

function giorni(v: unknown): number[] {
  if (!Array.isArray(v) || v.length === 0) throw bad('Scegli almeno un giorno della settimana.');
  const days = [...new Set(v.map(d => int(d, 'Giorno', 0, 6)))];
  // Monday-first order, as people read a week.
  return days.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
}

function orario(v: unknown): string {
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw bad('Orario non valido (HH:MM).');
  return v;
}

export class Store {
  readonly filesDir: string;
  /** Overridable for tests. */
  today: () => string = () => todayISO();

  /** `db` must already be migrated (see coreMigrations). */
  constructor(readonly db: Database, dataDir: string) {
    this.filesDir = path.join(dataDir, 'certificati');
    fs.mkdirSync(this.filesDir, { recursive: true });
    this.ensureDefaults();
  }

  private tx<T>(fn: () => T): T {
    return transaction(this.db, fn);
  }

  private ensureDefaults() {
    const insert = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    const defaults = { ...DEFAULT_SETTINGS, scadenzaStagione: defaultSeasonEnd(this.today()) };
    for (const [k, v] of Object.entries(defaults)) insert.run(k, JSON.stringify(v));
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM plans').get() as { n: number };
    const seeded = this.db.prepare("SELECT 1 FROM settings WHERE key = 'plansSeeded'").get();
    if (n === 0 && !seeded) {
      const ins = this.db.prepare('INSERT INTO plans (name, mesi, prezzo) VALUES (?, ?, ?)');
      for (const p of DEFAULT_PLANS) ins.run(p.name, p.mesi, p.prezzo);
    }
    // Remember that defaults were created, so deleting every plan doesn't bring them back.
    this.db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('plansSeeded', 'true')").run();
  }

  // ─── Reads ─────────────────────────────────────────────────────────────

  settings(): Settings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = JSON.parse(r.value);
    return out as unknown as Settings;
  }

  courses(): Course[] {
    return (this.db.prepare('SELECT * FROM courses ORDER BY id').all() as Row[]).map(r => ({
      id: r.id as number, name: r.name as string, giorni: JSON.parse(r.giorni as string), orario: r.orario as string, capienza: r.capienza as number,
    }));
  }

  plans(): Plan[] {
    return this.db.prepare('SELECT id, name, mesi, prezzo FROM plans ORDER BY mesi, prezzo').all() as unknown as Plan[];
  }

  private course(id: number): Course {
    const c = this.courses().find(x => x.id === id);
    if (!c) throw notFound('Corso');
    return c;
  }

  private plan(id: number): Plan {
    const p = this.db.prepare('SELECT id, name, mesi, prezzo FROM plans WHERE id = ?').get(id) as Plan | undefined;
    if (!p) throw notFound('Abbonamento');
    return p;
  }

  private participantRow(id: number): Row {
    const r = this.db.prepare('SELECT * FROM participants WHERE id = ? AND ritirato_il IS NULL').get(id) as Row | undefined;
    if (!r) throw notFound('Iscritto');
    return r;
  }

  private activeCount(courseId: number): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM participants WHERE course_id = ? AND ritirato_il IS NULL').get(courseId) as { n: number }).n;
  }

  participants(): Participant[] {
    const rows = this.db.prepare('SELECT * FROM participants WHERE ritirato_il IS NULL ORDER BY name COLLATE NOCASE').all() as Row[];
    const pays = this.db.prepare(`
      SELECT p.* FROM payments p JOIN participants x ON x.id = p.participant_id
      WHERE x.ritirato_il IS NULL ORDER BY p.date DESC, p.id DESC`).all() as Row[];
    const byP = new Map<number, Payment[]>();
    for (const p of pays) {
      const list = byP.get(p.participant_id as number) ?? [];
      list.push({ id: p.id as number, date: p.date as string, dal: p.dal as string, al: p.al as string, importo: p.importo as number, planId: p.plan_id as number | null, planName: p.plan_name as string });
      byP.set(p.participant_id as number, list);
    }
    return rows.map(r => ({
      id: r.id as number,
      courseId: r.course_id as number,
      name: r.name as string,
      phone: r.phone as string,
      livello: r.livello as Livello,
      note: r.note as string,
      planId: r.plan_id as number | null,
      pagatoFino: r.pagato_fino as string | null,
      iscrizioneScadenza: r.iscrizione_scadenza as string | null,
      certScadenza: r.cert_scadenza as string | null,
      certFile: r.cert_file_path ? {
        name: r.cert_file_name as string, mime: r.cert_file_mime as string, size: r.cert_file_size as number, uploadedAt: r.cert_uploaded_at as string,
      } : null,
      iscrittoIl: r.iscritto_il as string,
      payments: byP.get(r.id as number) ?? [],
    }));
  }

  lessons(): Lesson[] {
    const rows = this.db.prepare('SELECT id, course_id, date FROM lessons ORDER BY date, id').all() as Row[];
    const att = this.db.prepare('SELECT lesson_id, participant_id FROM attendance').all() as Row[];
    const byL = new Map<number, number[]>();
    for (const a of att) {
      const list = byL.get(a.lesson_id as number) ?? [];
      list.push(a.participant_id as number);
      byL.set(a.lesson_id as number, list);
    }
    return rows.map(r => ({ id: r.id as number, courseId: r.course_id as number, date: r.date as string, present: byL.get(r.id as number) ?? [] }));
  }

  state(): AppState {
    const today = this.today();
    const andamento = [];
    const countAt = this.db.prepare('SELECT COUNT(*) AS n FROM participants WHERE iscritto_il <= ? AND (ritirato_il IS NULL OR ritirato_il > ?)');
    for (let i = 5; i >= 0; i--) {
      const monthStart = addMonths(today.slice(0, 7) + '-01', -i);
      const end = i === 0 ? today : endOfMonth(monthStart);
      andamento.push({ month: monthStart.slice(0, 7), count: (countAt.get(end, end) as { n: number }).n });
    }
    const { total } = this.db.prepare('SELECT COALESCE(SUM(importo), 0) AS total FROM payments WHERE substr(date, 1, 7) = ?').get(today.slice(0, 7)) as { total: number };
    return {
      courses: this.courses(), plans: this.plans(), settings: this.settings(),
      participants: this.participants(), lessons: this.lessons(),
      andamento, incassoMese: total,
    };
  }

  // ─── Settings ──────────────────────────────────────────────────────────

  updateSettings(patch: Record<string, unknown>) {
    const clean: Partial<Settings> = {};
    if ('instructorName' in patch) clean.instructorName = str(patch.instructorName, 'Nome istruttore', { required: false, max: 60 });
    if ('quotaIscrizione' in patch) clean.quotaIscrizione = num(patch.quotaIscrizione, 'Quota iscrizione', 0);
    if ('scadenzaStagione' in patch) clean.scadenzaStagione = reqDate(patch.scadenzaStagione, 'Scadenza stagione');
    if ('sogliaCertificato' in patch) clean.sogliaCertificato = int(patch.sogliaCertificato, 'Soglia certificato', 0, 365);
    if ('sogliaIscrizione' in patch) clean.sogliaIscrizione = int(patch.sogliaIscrizione, 'Soglia iscrizione', 0, 365);
    if ('sogliaAbbonamento' in patch) clean.sogliaAbbonamento = int(patch.sogliaAbbonamento, 'Soglia abbonamento', 0, 365);
    const up = this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    this.tx(() => { for (const [k, v] of Object.entries(clean)) up.run(k, JSON.stringify(v)); });
  }

  // ─── Courses ───────────────────────────────────────────────────────────

  private courseInput(body: Row) {
    return {
      name: str(body.name, 'Nome del corso', { max: 80 }),
      giorni: giorni(body.giorni),
      orario: orario(body.orario),
      capienza: int(body.capienza, 'Capienza', 1, 1000),
    };
  }

  createCourse(body: Row): number {
    const c = this.courseInput(body);
    const r = this.db.prepare('INSERT INTO courses (name, giorni, orario, capienza) VALUES (?, ?, ?, ?)').run(c.name, JSON.stringify(c.giorni), c.orario, c.capienza);
    return Number(r.lastInsertRowid);
  }

  updateCourse(id: number, body: Row) {
    this.course(id);
    const c = this.courseInput(body);
    const n = this.activeCount(id);
    if (c.capienza < n) throw bad(`La capienza non può essere inferiore agli iscritti attuali (${n}).`);
    this.db.prepare('UPDATE courses SET name = ?, giorni = ?, orario = ?, capienza = ? WHERE id = ?').run(c.name, JSON.stringify(c.giorni), c.orario, c.capienza, id);
  }

  deleteCourse(id: number) {
    this.course(id);
    const n = this.activeCount(id);
    if (n > 0) throw bad(`Non puoi eliminare un corso con ${n} ${n === 1 ? 'iscritto' : 'iscritti'}: prima disiscrivili.`);
    const files = this.db.prepare('SELECT cert_file_path FROM participants WHERE course_id = ? AND cert_file_path IS NOT NULL').all(id) as Row[];
    this.db.prepare('DELETE FROM courses WHERE id = ?').run(id);
    for (const f of files) this.unlinkFile(f.cert_file_path as string);
  }

  // ─── Plans ─────────────────────────────────────────────────────────────

  createPlan(body: Row): number {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const mesi = Number(body.mesi), prezzo = Number(body.prezzo);
    if (!name || !Number.isInteger(mesi) || mesi < 1 || !(prezzo > 0)) throw bad('Inserisci nome, durata in mesi e prezzo.');
    if (name.length > 60 || mesi > 120) throw bad('Valori non validi.');
    const r = this.db.prepare('INSERT INTO plans (name, mesi, prezzo) VALUES (?, ?, ?)').run(name, mesi, Math.round(prezzo * 100) / 100);
    return Number(r.lastInsertRowid);
  }

  deletePlan(id: number) {
    this.plan(id);
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM participants WHERE plan_id = ? AND ritirato_il IS NULL').get(id) as { n: number };
    if (n > 0) throw bad(`Non puoi eliminare un abbonamento usato da ${n} ${n === 1 ? 'iscritto.' : 'iscritti.'}`);
    this.db.prepare('DELETE FROM plans WHERE id = ?').run(id);
  }

  // ─── Participants ──────────────────────────────────────────────────────

  createParticipant(body: Partial<NewParticipantInput>): number {
    const courseId = int(body.courseId, 'Corso', 1, Number.MAX_SAFE_INTEGER);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (!name || !phone) throw bad('Nome e telefono sono obbligatori.');
    if (name.length > 120 || phone.length > 40) throw bad('Nome o telefono troppo lunghi.');
    const planId = Number(body.planId);
    const plan = this.db.prepare('SELECT id, name, mesi, prezzo FROM plans WHERE id = ?').get(planId) as Plan | undefined;
    if (!plan) throw bad('Scegli un abbonamento (puoi crearne uno in Impostazioni).');
    const livello = LIVELLI.includes(body.livello as Livello) ? body.livello as Livello : 'Base';
    const iscr = optDate(body.iscrizioneScadenza, 'Scadenza iscrizione');
    const cert = optDate(body.certScadenza, 'Scadenza certificato');
    const note = str(body.note ?? '', 'Note', { required: false, max: 2000 });
    const today = this.today();

    return this.tx(() => {
      const course = this.course(courseId);
      if (this.activeCount(courseId) >= course.capienza) throw bad('Il corso è al completo.');
      const pagatoFino = body.paid ? addMonths(today, plan.mesi) : null;
      const r = this.db.prepare(`INSERT INTO participants
        (course_id, name, phone, livello, note, plan_id, pagato_fino, iscrizione_scadenza, cert_scadenza, iscritto_il)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(courseId, name, phone, livello, note, plan.id, pagatoFino, iscr, cert, today);
      const id = Number(r.lastInsertRowid);
      if (pagatoFino) {
        this.db.prepare('INSERT INTO payments (participant_id, date, dal, al, importo, plan_id, plan_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(id, today, today, pagatoFino, plan.prezzo, plan.id, plan.name);
      }
      return id;
    });
  }

  updateParticipant(id: number, body: Row) {
    this.participantRow(id);
    const sets: string[] = [];
    const vals: (string | null)[] = [];
    if ('iscrizioneScadenza' in body) { sets.push('iscrizione_scadenza = ?'); vals.push(optDate(body.iscrizioneScadenza, 'Scadenza iscrizione')); }
    if ('certScadenza' in body) { sets.push('cert_scadenza = ?'); vals.push(optDate(body.certScadenza, 'Scadenza certificato')); }
    if ('name' in body) { sets.push('name = ?'); vals.push(str(body.name, 'Nome', { max: 120 })); }
    if ('phone' in body) { sets.push('phone = ?'); vals.push(str(body.phone, 'Telefono', { max: 40 })); }
    if ('livello' in body) {
      if (!LIVELLI.includes(body.livello as Livello)) throw bad('Livello non valido.');
      sets.push('livello = ?'); vals.push(body.livello as string);
    }
    if ('note' in body) { sets.push('note = ?'); vals.push(str(body.note, 'Note', { required: false, max: 2000 })); }
    if (!sets.length) return;
    this.db.prepare(`UPDATE participants SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
  }

  renewIscrizione(id: number) {
    const r = this.participantRow(id);
    const next = renewedIscrizione(r.iscrizione_scadenza as string | null, this.today());
    this.db.prepare('UPDATE participants SET iscrizione_scadenza = ? WHERE id = ?').run(next, id);
  }

  registerPayment(id: number, body: Row) {
    const r = this.participantRow(id);
    const date = reqDate(body.date, 'Data pagamento');
    const plan = this.plan(Number(body.planId));
    const { dal, al } = paymentPeriod(r.pagato_fino as string | null, date, plan.mesi);
    this.tx(() => {
      this.db.prepare('INSERT INTO payments (participant_id, date, dal, al, importo, plan_id, plan_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, date, dal, al, plan.prezzo, plan.id, plan.name);
      this.db.prepare('UPDATE participants SET pagato_fino = ?, plan_id = ? WHERE id = ?').run(al, plan.id, id);
    });
  }

  /**
   * Unsubscribing keeps the record (and its payments, for the monthly takings and the
   * enrolment trend) but drops it from the course, the attendance register and its certificate file.
   */
  unsubscribe(id: number) {
    const r = this.participantRow(id);
    this.tx(() => {
      this.db.prepare('DELETE FROM attendance WHERE participant_id = ?').run(id);
      this.db.prepare(`UPDATE participants SET ritirato_il = ?, cert_file_path = NULL, cert_file_name = NULL,
        cert_file_mime = NULL, cert_file_size = NULL, cert_uploaded_at = NULL WHERE id = ?`).run(this.today(), id);
    });
    if (r.cert_file_path) this.unlinkFile(r.cert_file_path as string);
  }

  // ─── Certificate files ─────────────────────────────────────────────────

  saveCertFile(id: number, data: Buffer, mime: string, originalName: string) {
    const r = this.participantRow(id);
    const ext = ALLOWED_CERT_TYPES[mime];
    if (!ext) throw bad('Formato non supportato: carica un file PNG, JPEG o PDF.');
    if (!data.length) throw bad('Il file è vuoto.');
    const name = path.basename(originalName || `certificato${ext}`).slice(0, 200);
    const file = `${id}-${randomUUID()}${ext}`;
    fs.writeFileSync(path.join(this.filesDir, file), data);
    this.db.prepare(`UPDATE participants SET cert_file_path = ?, cert_file_name = ?, cert_file_mime = ?,
      cert_file_size = ?, cert_uploaded_at = ? WHERE id = ?`).run(file, name, mime, data.length, this.today(), id);
    if (r.cert_file_path) this.unlinkFile(r.cert_file_path as string);
  }

  certFile(id: number): { path: string; name: string; mime: string } {
    const r = this.participantRow(id);
    if (!r.cert_file_path) throw notFound('Certificato');
    return { path: path.join(this.filesDir, r.cert_file_path as string), name: r.cert_file_name as string, mime: r.cert_file_mime as string };
  }

  removeCertFile(id: number) {
    const r = this.participantRow(id);
    this.db.prepare(`UPDATE participants SET cert_file_path = NULL, cert_file_name = NULL, cert_file_mime = NULL,
      cert_file_size = NULL, cert_uploaded_at = NULL WHERE id = ?`).run(id);
    if (r.cert_file_path) this.unlinkFile(r.cert_file_path as string);
  }

  private unlinkFile(file: string) {
    fs.rm(path.join(this.filesDir, path.basename(file)), { force: true }, () => {});
  }

  // ─── Lessons & attendance ──────────────────────────────────────────────

  addLesson(courseId: number, body: Row): number | null {
    this.course(courseId);
    const date = reqDate(body.date, 'Data della lezione');
    const r = this.db.prepare('INSERT OR IGNORE INTO lessons (course_id, date) VALUES (?, ?)').run(courseId, date);
    return r.changes ? Number(r.lastInsertRowid) : null;
  }

  deleteLesson(lessonId: number) {
    const r = this.db.prepare('DELETE FROM lessons WHERE id = ?').run(lessonId);
    if (!r.changes) throw notFound('Lezione');
  }

  private lessonCourse(lessonId: number): number {
    const l = this.db.prepare('SELECT course_id FROM lessons WHERE id = ?').get(lessonId) as Row | undefined;
    if (!l) throw notFound('Lezione');
    return l.course_id as number;
  }

  toggleAttendance(lessonId: number, participantId: number) {
    const courseId = this.lessonCourse(lessonId);
    const p = this.participantRow(participantId);
    if (p.course_id !== courseId) throw bad('L\'iscritto non fa parte di questo corso.');
    this.tx(() => {
      const del = this.db.prepare('DELETE FROM attendance WHERE lesson_id = ? AND participant_id = ?').run(lessonId, participantId);
      if (!del.changes) this.db.prepare('INSERT INTO attendance (lesson_id, participant_id) VALUES (?, ?)').run(lessonId, participantId);
    });
  }

  /** Marks everyone present, or clears the lesson if everyone already was. */
  markAll(lessonId: number) {
    const courseId = this.lessonCourse(lessonId);
    const ids = (this.db.prepare('SELECT id FROM participants WHERE course_id = ? AND ritirato_il IS NULL').all(courseId) as Row[]).map(r => r.id as number);
    const present = new Set((this.db.prepare('SELECT participant_id FROM attendance WHERE lesson_id = ?').all(lessonId) as Row[]).map(r => r.participant_id as number));
    const all = ids.every(id => present.has(id));
    this.tx(() => {
      if (all) this.db.prepare('DELETE FROM attendance WHERE lesson_id = ?').run(lessonId);
      else {
        const ins = this.db.prepare('INSERT OR IGNORE INTO attendance (lesson_id, participant_id) VALUES (?, ?)');
        for (const id of ids) ins.run(lessonId, id);
      }
    });
  }

  // ─── Demo data ─────────────────────────────────────────────────────────

  isEmpty(): boolean {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM courses').get() as { n: number }).n === 0;
  }

  /** Inserts a participant with arbitrary history; used by the demo seeder only. */
  insertDemoParticipant(p: {
    courseId: number; name: string; phone: string; livello: Livello; note: string; plan: Plan;
    pagatoFino: string; certScadenza: string; iscrizioneScadenza: string; iscrittoIl: string;
  }): number {
    const r = this.db.prepare(`INSERT INTO participants
      (course_id, name, phone, livello, note, plan_id, pagato_fino, iscrizione_scadenza, cert_scadenza, iscritto_il)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(p.courseId, p.name, p.phone, p.livello, p.note, p.plan.id, p.pagatoFino, p.iscrizioneScadenza, p.certScadenza, p.iscrittoIl);
    const id = Number(r.lastInsertRowid);
    const ins = this.db.prepare('INSERT INTO payments (participant_id, date, dal, al, importo, plan_id, plan_name) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const today = this.today();
    let al = p.pagatoFino;
    for (let i = 0; i < 2; i++) {
      const dal = addMonths(al, -p.plan.mesi);
      if (i > 0 && dal < p.iscrittoIl) break;
      // Paid when the period started, or a few days ago for an early renewal.
      const date = dal <= today ? dal : addDays(today, -3);
      ins.run(id, date < p.iscrittoIl ? p.iscrittoIl : date, dal, al, p.plan.prezzo, p.plan.id, p.plan.name);
      al = dal;
    }
    return id;
  }
}
