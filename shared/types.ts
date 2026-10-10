// Data shapes exchanged between server and client.

export type Livello = 'Base' | 'Intermedio' | 'Avanzato';
export const LIVELLI: Livello[] = ['Base', 'Intermedio', 'Avanzato'];

export interface Course {
  id: number;
  name: string;
  /** Weekdays the course runs on, 0 = domenica … 6 = sabato. */
  giorni: number[];
  /** "HH:MM" */
  orario: string;
  capienza: number;
}

export interface Plan {
  id: number;
  name: string;
  mesi: number;
  prezzo: number;
}

export const TEMI = ['auto', 'chiaro', 'scuro'] as const;
export type Tema = (typeof TEMI)[number];
/** Accent colors, as in macOS System Settings → Appearance. */
export const ACCENTI = ['blu', 'viola', 'rosa', 'rosso', 'arancione', 'giallo', 'verde', 'grafite'] as const;
export type Accento = (typeof ACCENTI)[number];

export interface Settings {
  instructorName: string;
  /** Appearance: light/dark (auto follows the system) and accent color. */
  tema: Tema;
  accento: Accento;
  quotaIscrizione: number;
  /** Default end of season proposed to new members. */
  scadenzaStagione: string;
  sogliaCertificato: number;
  sogliaIscrizione: number;
  sogliaAbbonamento: number;
}

export interface CertFile {
  name: string;
  mime: string;
  size: number;
  uploadedAt: string;
}

export interface Payment {
  id: number;
  date: string;
  dal: string;
  al: string;
  importo: number;
  planId: number | null;
  planName: string;
}

export interface Participant {
  id: number;
  courseId: number;
  name: string;
  phone: string;
  livello: Livello;
  note: string;
  planId: number | null;
  pagatoFino: string | null;
  iscrizioneScadenza: string | null;
  certScadenza: string | null;
  certFile: CertFile | null;
  iscrittoIl: string;
  payments: Payment[];
}

export interface Lesson {
  id: number;
  courseId: number;
  date: string;
  /** Ids of participants marked present. */
  present: number[];
}

export interface MonthlyCount {
  /** "YYYY-MM" */
  month: string;
  count: number;
}

export interface AppState {
  courses: Course[];
  plans: Plan[];
  settings: Settings;
  /** Active participants only. */
  participants: Participant[];
  lessons: Lesson[];
  /** Active members at the end of each of the last 6 months (current month last). */
  andamento: MonthlyCount[];
  /** Total of payments registered in the current month, including people who have since left. */
  incassoMese: number;
}

export interface NewParticipantInput {
  courseId: number;
  name: string;
  phone: string;
  livello: Livello;
  note: string;
  planId: number;
  iscrizioneScadenza: string | null;
  certScadenza: string | null;
  paid: boolean;
}
