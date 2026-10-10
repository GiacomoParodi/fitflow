// Loads the example data from the design prototype, with dates moved relative to today.
// Usage: npm run demo   (only on an empty database)
import './quiet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, addMonths, daysBetween, todayISO } from '../shared/dates';
import type { Livello } from '../shared/types';
import { openData } from './app';

/** The prototype's "today". Every date below is shifted by whole weeks so weekdays still match. */
const PROTO_TODAY = '2026-09-26';

const COURSES = [
  { key: 'c1', name: 'PILATES MATTUTINO', giorni: [1, 3, 5], orario: '09:00', capienza: 15 },
  { key: 'c2', name: 'FUNCTIONAL TRAINING', giorni: [2, 4], orario: '18:30', capienza: 20 },
  { key: 'c3', name: 'YOGA SERALE', giorni: [1, 3], orario: '20:00', capienza: 12 },
  { key: 'c4', name: 'ZUMBA', giorni: [6], orario: '10:00', capienza: 25 },
];

// [nome, corso, telefono, abbonamento, pagato fino al, scadenza certificato, scadenza iscrizione, livello, note, presenze, iscritto da (mesi fa)]
type Row = [string, string, string, string, string, string, string, Livello, string, number[], number];
const ROWS: Row[] = [
  ['Giulia Rossi', 'c1', '333 111 2233', 'Mensile', '2026-10-01', '2027-03-14', '2027-08-31', 'Intermedio', 'Nessuna nota.', [1, 1, 1, 1, 1], 5],
  ['Marco Bianchi', 'c1', '333 222 4455', 'Mensile', '2026-09-29', '2027-05-02', '2027-08-31', 'Base', 'Preferisce lezioni in prima fila.', [1, 1, 0, 1, 1], 5],
  ['Elena Verdi', 'c1', '333 333 5566', 'Trimestrale', '2026-12-01', '2026-10-12', '2027-08-31', 'Avanzato', '', [1, 1, 1, 1, 1], 5],
  ['Paolo Neri', 'c1', '333 444 6677', 'Mensile', '2026-09-05', '2027-01-20', '2026-09-30', 'Base', 'Contattare per rinnovo quota.', [0, 1, 0, 1, 1], 5],
  ['Francesca Colombo', 'c1', '333 555 7788', 'Semestrale', '2027-02-01', '2027-06-08', '2027-08-31', 'Intermedio', '', [1, 0, 1, 1, 1], 5],
  ['Davide Fontana', 'c1', '333 666 8899', 'Mensile', '2026-10-01', '2026-08-30', '2027-08-31', 'Base', 'Certificato da rinnovare urgentemente.', [1, 1, 1, 0, 1], 5],
  ['Chiara Ricci', 'c1', '333 777 9900', 'Annuale', '2027-09-01', '2026-11-19', '2027-08-31', 'Avanzato', '', [1, 1, 1, 1, 1], 5],
  ['Luca Moretti', 'c2', '334 111 2200', 'Trimestrale', '2026-11-03', '2027-04-11', '2027-08-31', 'Avanzato', '', [1, 1, 1, 1, 1], 5],
  ['Sara Gallo', 'c2', '334 222 3311', 'Mensile', '2026-09-28', '2027-07-25', '2027-08-31', 'Intermedio', '', [1, 0, 1, 1, 1], 5],
  ['Andrea Conti', 'c2', '334 333 4422', 'Mensile', '2026-10-03', '2026-10-09', '2027-08-31', 'Base', '', [1, 1, 1, 1, 0], 5],
  ['Valentina Barbieri', 'c2', '334 444 5533', 'Trimestrale', '2026-12-03', '2027-02-17', '2027-08-31', 'Avanzato', '', [1, 1, 1, 1, 1], 5],
  ['Simone Longo', 'c2', '334 555 6644', 'Mensile', '2026-09-10', '2026-12-03', '2026-09-15', 'Base', 'Ha saltato le ultime lezioni.', [0, 0, 1, 0, 1], 5],
  ['Alice Mancini', 'c2', '334 666 7755', 'Mensile', '2026-10-03', '2027-05-29', '2027-08-31', 'Intermedio', '', [1, 1, 1, 1, 1], 5],
  ['Federica Testa', 'c3', '335 111 8899', 'Trimestrale', '2026-11-05', '2027-08-21', '2027-08-31', 'Intermedio', '', [1, 1, 0, 1, 1], 4],
  ['Matteo Rinaldi', 'c3', '335 222 9900', 'Mensile', '2026-10-05', '2027-01-15', '2027-08-31', 'Avanzato', '', [1, 1, 1, 1, 1], 4],
  ['Laura Costa', 'c3', '335 333 0011', 'Mensile', '2026-09-27', '2027-06-06', '2027-08-31', 'Base', '', [1, 0, 1, 1, 0], 3],
  ['Nicola Ferri', 'c3', '335 444 1122', 'Mensile', '2026-10-05', '2026-09-02', '2027-08-31', 'Base', 'Certificato scaduto, non può allenarsi.', [0, 1, 1, 0, 1], 3],
  ['Martina Villa', 'c3', '335 555 2233', 'Annuale', '2027-09-05', '2027-03-28', '2027-08-31', 'Intermedio', '', [1, 1, 1, 1, 1], 1],
  ['Roberto Pini', 'c4', '336 111 3344', 'Mensile', '2026-10-02', '2026-12-18', '2027-08-31', 'Base', '', [1, 1, 0, 1, 1], 1],
  ['Ilaria Marino', 'c4', '336 222 4455', 'Trimestrale', '2026-12-02', '2027-09-09', '2027-08-31', 'Intermedio', '', [1, 1, 1, 1, 1], 1],
  ['Stefano Grasso', 'c4', '336 333 5566', 'Mensile', '2026-09-30', '2027-04-22', '2026-10-10', 'Base', '', [0, 1, 0, 1, 1], 0],
  ['Giorgia Leone', 'c4', '336 444 6677', 'Mensile', '2026-10-02', '2026-10-30', '2027-08-31', 'Avanzato', '', [1, 1, 1, 1, 1], 0],
];

const LESSONS: Record<string, string[]> = {
  c1: ['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21', '2026-09-23'],
  c2: ['2026-09-10', '2026-09-15', '2026-09-17', '2026-09-22', '2026-09-24'],
  c3: ['2026-09-09', '2026-09-14', '2026-09-16', '2026-09-21', '2026-09-23'],
  c4: ['2026-08-29', '2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26'],
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = openData(path.resolve(process.env.DATA_DIR || path.join(root, 'data')));
const store = data.store;

if (!store.isEmpty()) {
  console.error('Il database contiene già dei corsi: i dati di esempio si caricano solo su un database vuoto.');
  process.exit(1);
}

const today = todayISO();
const shift = Math.round(daysBetween(PROTO_TODAY, today) / 7) * 7;
const d = (iso: string) => addDays(iso, shift);
// Members on the regular season keep the season end from the settings.
const season = store.settings().scadenzaStagione;
const plans = new Map(store.plans().map(p => [p.name, p]));
const monthsAgo = (n: number) => {
  const x = addDays(addMonths(today.slice(0, 7) + '-01', -n), 9);
  return x > today ? today : x;
};

store.db.exec('BEGIN');
const courseIds = new Map<string, number>();
for (const c of COURSES) courseIds.set(c.key, store.createCourse(c));

const ids: number[] = [];
for (const [name, course, phone, planName, pagatoFino, cert, iscr, livello, note, , ago] of ROWS) {
  const plan = plans.get(planName);
  if (!plan) throw new Error(`Abbonamento "${planName}" mancante: ripristina gli abbonamenti predefiniti.`);
  ids.push(store.insertDemoParticipant({
    courseId: courseIds.get(course)!, name, phone, livello, note, plan,
    pagatoFino: d(pagatoFino), certScadenza: d(cert), iscrizioneScadenza: iscr === '2027-08-31' ? season : d(iscr), iscrittoIl: monthsAgo(ago),
  }));
}

// Someone who left two months ago, so the enrolment trend has a dip like in the design.
const gone = store.insertDemoParticipant({
  courseId: courseIds.get('c4')!, name: 'Ex iscritto', phone: '-', livello: 'Base', note: '', plan: plans.get('Mensile')!,
  pagatoFino: monthsAgo(2), certScadenza: d('2027-01-01'), iscrizioneScadenza: d('2027-08-31'), iscrittoIl: monthsAgo(5),
});
store.db.prepare('UPDATE participants SET ritirato_il = ? WHERE id = ?').run(monthsAgo(2), gone);

const att = store.db.prepare('INSERT INTO attendance (lesson_id, participant_id) VALUES (?, ?)');
for (const [course, dates] of Object.entries(LESSONS)) {
  dates.forEach((date, i) => {
    const lessonId = store.addLesson(courseIds.get(course)!, { date: d(date) })!;
    ROWS.forEach((r, j) => { if (r[1] === course && r[9][i]) att.run(lessonId, ids[j]); });
  });
}
store.db.exec('COMMIT');
data.close();
console.log(`Dati di esempio caricati: ${COURSES.length} corsi, ${ROWS.length} iscritti.`);
