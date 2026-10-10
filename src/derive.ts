// View-model helpers: turn raw state into what the screens show.
import { WEEKDAYS_SHORT, fmt } from '../shared/dates';
import { CERT_LABELS, ISCR_LABELS, PAY_LABELS, isSevere, status, type Status } from '../shared/rules';
import type { AppState, Course, Lesson, Participant, Plan } from '../shared/types';

export const TAG_CLASS: Record<Status, string> = {
  valido: 'tag tag-neutral',
  in_scadenza: 'tag tag-outline',
  scaduto: 'tag tag-accent',
  mancante: 'tag tag-accent',
};

export interface Check {
  status: Status;
  label: string;
  tagClass: string;
  severe: boolean;
  dateLabel: string;
}

export interface DecoratedParticipant extends Participant {
  plan: Plan | undefined;
  pay: Check;
  cert: Check;
  iscr: Check;
  presenzeFatte: number;
  presenzeTotali: number;
  presenzePct: string;
}

function check(iso: string | null, warn: number, labels: Record<Status, string>, today: string): Check {
  const s = status(iso, warn, today);
  return { status: s, label: labels[s], tagClass: TAG_CLASS[s], severe: isSevere(s), dateLabel: fmt(iso) };
}

export function decorate(state: AppState, today: string): DecoratedParticipant[] {
  const { settings } = state;
  const lessonsByCourse = groupLessons(state.lessons);
  return state.participants.map(p => {
    const ls = lessonsByCourse.get(p.courseId) ?? [];
    const fatte = ls.filter(l => l.present.includes(p.id)).length;
    return {
      ...p,
      plan: state.plans.find(x => x.id === p.planId),
      pay: check(p.pagatoFino, settings.sogliaAbbonamento, PAY_LABELS, today),
      cert: check(p.certScadenza, settings.sogliaCertificato, CERT_LABELS, today),
      iscr: check(p.iscrizioneScadenza, settings.sogliaIscrizione, ISCR_LABELS, today),
      presenzeFatte: fatte,
      presenzeTotali: ls.length,
      presenzePct: (ls.length ? Math.round((fatte / ls.length) * 100) : 0) + '%',
    };
  });
}

export function groupLessons(lessons: Lesson[]): Map<number, Lesson[]> {
  const m = new Map<number, Lesson[]>();
  for (const l of lessons) {
    const list = m.get(l.courseId) ?? [];
    list.push(l);
    m.set(l.courseId, list);
  }
  return m;
}

export function giorniLabel(c: Pick<Course, 'giorni'>): string {
  return c.giorni.map(d => WEEKDAYS_SHORT[d]).join(' · ');
}

export function countLabel(n: number, c: Course): string {
  return `${n}/${c.capienza} iscritti`;
}
