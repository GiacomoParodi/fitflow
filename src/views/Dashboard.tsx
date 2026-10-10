import './dashboard.css';
import { useState, type ReactNode } from 'react';
import { WEEKDAYS_SHORT, addDays, fmtLong, weekday } from '../../shared/dates';
import type { Course } from '../../shared/types';
import { PageHead } from '../components/PageHead';
import * as I from '../icons';
import { useApp } from '../store';

type Kind = 'cert' | 'pay' | 'iscr';
type Filter = 'tutti' | Kind;

interface Avviso {
  key: string;
  kind: Kind;
  pid: number;
  courseId: number;
  name: string;
  course: string;
  desc: string;
  label: string;
  tagClass: string;
  severe: boolean;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'tutti', label: 'Tutti' },
  { id: 'cert', label: 'Certificati' },
  { id: 'pay', label: 'Pagamenti' },
  { id: 'iscr', label: 'Iscrizioni' },
];
const LIMIT = 8;
const WEEKDAY_NAMES = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 13) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

export function Dashboard() {
  const { state, people, today, go, openParticipant } = useApp();
  const { courses, settings } = state;

  const enrolled = (c: Course) => people.filter(p => p.courseId === c.id).length;
  const todayCourses = courses
    .filter(c => c.giorni.includes(weekday(today)))
    .sort((a, b) => a.orario.localeCompare(b.orario));
  const upcoming: { key: string; date: string; course: Course }[] = [];
  for (let d = 1; d <= 7 && upcoming.length < 5; d++) {
    const date = addDays(today, d);
    for (const c of courses.filter(c => c.giorni.includes(weekday(date))).sort((a, b) => a.orario.localeCompare(b.orario))) {
      if (upcoming.length < 5) upcoming.push({ key: `${date}-${c.id}`, date, course: c });
    }
  }
  const posti = courses.reduce((s, c) => s + c.capienza, 0);
  const certDaRinnovare = people.filter(p => p.cert.status !== 'valido');
  const certGravi = certDaRinnovare.filter(p => p.cert.severe).length;
  const payDaRegolare = people.filter(p => p.pay.status !== 'valido');
  const payGravi = payDaRegolare.filter(p => p.pay.severe).length;

  const avvisi: Avviso[] = [];
  for (const p of people) {
    const course = courses.find(c => c.id === p.courseId)?.name ?? '';
    const base = { pid: p.id, courseId: p.courseId, name: p.name, course };
    if (p.cert.status !== 'valido') avvisi.push({
      ...base, kind: 'cert', key: `${p.id}-cert`, label: p.cert.label, tagClass: p.cert.tagClass, severe: p.cert.severe,
      desc: p.certScadenza ? `Certificato medico · scade il ${p.cert.dateLabel}` : 'Certificato medico mancante',
    });
    if (p.pay.status !== 'valido') avvisi.push({
      ...base, kind: 'pay', key: `${p.id}-pay`, label: p.pay.label, tagClass: p.pay.tagClass, severe: p.pay.severe,
      desc: p.pagatoFino ? `Abbonamento ${p.plan?.name ?? ''} · pagato fino al ${p.pay.dateLabel}` : `Abbonamento ${p.plan?.name ?? ''} · nessun pagamento`,
    });
    if (p.iscr.status !== 'valido') avvisi.push({
      ...base, kind: 'iscr', key: `${p.id}-iscr`, label: p.iscr.label, tagClass: p.iscr.tagClass, severe: p.iscr.severe,
      desc: p.iscrizioneScadenza ? `Iscrizione annuale · scade il ${p.iscr.dateLabel}` : 'Iscrizione annuale mancante',
    });
  }
  avvisi.sort((a, b) => Number(b.severe) - Number(a.severe));

  const openAvviso = (a: Avviso) => { go('corsi', a.courseId); openParticipant(a.pid); };
  const date = fmtLong(today);
  const subtitle = `${greeting()}${settings.instructorName ? `, ${settings.instructorName}` : ''} · ${date.charAt(0).toLowerCase()}${date.slice(1)}`;

  return (
    <div className="page">
      <PageHead page="dashboard" title="Panoramica" subtitle={subtitle} />

      <div className="dash-metrics">
        <Metric icon={<UsersIcon />} tone="accent" label="Iscritti totali" value={people.length}
          note={posti ? `su ${posti} posti disponibili` : 'Nessun posto disponibile'} />
        <Metric icon={<CalendarIcon />} tone="teal" label="Corsi attivi" value={courses.length}
          note={todayCourses.length === 1 ? '1 lezione oggi' : `${todayCourses.length} lezioni oggi`} />
        <Metric icon={<HeartIcon />} tone={certGravi ? 'danger' : certDaRinnovare.length ? 'warning' : 'success'}
          label="Certificati da rinnovare" value={certDaRinnovare.length}
          note={certDaRinnovare.length ? (certGravi ? `${certGravi} scaduti o mancanti` : 'In scadenza a breve') : 'Tutti in regola'} />
        <Metric icon={<CardIcon />} tone={payGravi ? 'danger' : payDaRegolare.length ? 'warning' : 'success'}
          label="Pagamenti da regolare" value={payDaRegolare.length}
          note={payDaRegolare.length ? (payGravi ? `${payGravi} scaduti o mai pagati` : 'In scadenza a breve') : 'Tutti in regola'} />
      </div>

      <div className="dash-cols">
        <div className="dash-stack">
          <section className="card card-flush dash-panel" aria-labelledby="dash-lezioni">
            <div className="dash-panel-head">
              <div>
                <h2 id="dash-lezioni" className="card-title">Lezioni di oggi</h2>
                <div className="card-sub">{todayCourses.length ? `${todayCourses.length} in programma` : 'Nessuna in programma'}</div>
              </div>
            </div>
            {todayCourses.length === 0 ? (
              <div className="dash-empty">
                <span className="dash-empty-icon"><CalendarIcon size={22} /></span>
                <div className="dash-empty-title">Nessuna lezione oggi</div>
                <div className="dash-empty-text">Nessun corso si tiene di {WEEKDAY_NAMES[weekday(today)]}.</div>
                <button type="button" className="btn btn-secondary" onClick={() => go('corsi')}>Vai ai corsi</button>
              </div>
            ) : (
              <div className="list">
                {todayCourses.map(c => {
                  const n = enrolled(c);
                  const pct = c.capienza ? Math.min(1, n / c.capienza) : 0;
                  return (
                    <button key={c.id} type="button" className="list-row dash-lesson" onClick={() => go('corsi', c.id)}>
                      <span className="dash-lesson-time tabular">{c.orario}</span>
                      <span className="dash-lesson-body">
                        <span className="dash-lesson-name">{c.name}</span>
                        <span className="row-sub">{n >= c.capienza ? 'Completo' : c.capienza - n === 1 ? '1 posto libero' : `${c.capienza - n} posti liberi`}</span>
                      </span>
                      <span className="dash-lesson-fill">
                        <span className="sr-only">{n} iscritti su {c.capienza}</span>
                        <span className="dash-lesson-count tabular" aria-hidden="true">{n}<span className="text-tertiary">/{c.capienza}</span></span>
                        <span className="dash-meter" data-full={n >= c.capienza} aria-hidden="true">
                          <span style={{ width: `${Math.round(pct * 100)}%` }} />
                        </span>
                      </span>
                      <Chevron />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          {upcoming.length > 0 && (
            <section className="card card-flush dash-panel" aria-labelledby="dash-prossime">
              <div className="dash-panel-head">
                <div>
                  <h2 id="dash-prossime" className="card-title">Prossime lezioni</h2>
                  <div className="card-sub">Nei prossimi 7 giorni</div>
                </div>
              </div>
              <div className="list">
                {upcoming.map(({ key, date, course: c }, i) => (
                  <button key={key} type="button" className="list-row dash-lesson dash-next" onClick={() => go('corsi', c.id)}>
                    <span className="dash-next-day" data-repeat={i > 0 && upcoming[i - 1].date === date}>
                      <span className="dash-next-wd">{WEEKDAYS_SHORT[weekday(date)]}</span>
                      <span className="dash-next-num tabular">{Number(date.slice(8, 10))}</span>
                    </span>
                    <span className="dash-lesson-body">
                      <span className="dash-lesson-name">{c.name}</span>
                      <span className="row-sub tabular">{c.orario} · {enrolled(c)}/{c.capienza} iscritti</span>
                    </span>
                    <Chevron />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <Avvisi avvisi={avvisi} onOpen={openAvviso} />
      </div>
    </div>
  );
}

function Avvisi({ avvisi, onOpen }: { avvisi: Avviso[]; onOpen: (a: Avviso) => void }) {
  const [filter, setFilter] = useState<Filter>('tutti');
  const [all, setAll] = useState(false);
  const count = (f: Filter) => (f === 'tutti' ? avvisi.length : avvisi.filter(a => a.kind === f).length);
  const shown = filter === 'tutti' ? avvisi : avvisi.filter(a => a.kind === filter);
  const visible = all ? shown : shown.slice(0, LIMIT);
  const gravi = avvisi.filter(a => a.severe).length;

  return (
    <section className="card card-flush dash-panel" aria-labelledby="dash-avvisi">
      <div className="dash-panel-head">
        <div>
          <h2 id="dash-avvisi" className="card-title">Avvisi</h2>
          <div className="card-sub">
            {avvisi.length === 0 ? 'Nessuna scadenza da seguire' : `${avvisi.length} da seguire${gravi ? ` · ${gravi} urgenti` : ''}`}
          </div>
        </div>
        {avvisi.length > 0 && (
          <div className="seg" role="group" aria-label="Filtra avvisi">
            {FILTERS.map(f => (
              <button key={f.id} type="button" className="seg-opt" aria-pressed={filter === f.id}
                onClick={() => { setFilter(f.id); setAll(false); }}>
                {f.label}<span className="dash-seg-count tabular">{count(f.id)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {avvisi.length === 0 ? (
        <div className="dash-empty">
          <span className="dash-empty-icon" data-tone="success"><I.Check size={20} /></span>
          <div className="dash-empty-title">Tutti in regola</div>
          <div className="dash-empty-text">Certificati, pagamenti e iscrizioni sono validi.</div>
        </div>
      ) : shown.length === 0 ? (
        <div className="dash-empty dash-empty-sm">Nessun avviso in questa categoria.</div>
      ) : (
        <>
          <div className="list">
            {visible.map(a => (
              <button key={a.key} type="button" className="list-row dash-alert" onClick={() => onOpen(a)}>
                <span className="dash-alert-icon" data-tone={a.severe ? 'danger' : 'warning'} aria-hidden="true">
                  {a.kind === 'cert' ? <HeartIcon size={15} /> : a.kind === 'pay' ? <CardIcon size={15} /> : <IdIcon size={15} />}
                </span>
                <span className="dash-alert-body">
                  <span className="dash-alert-name">{a.name}{a.course && <span className="dash-alert-course"> · {a.course}</span>}</span>
                  <span className="row-sub">{a.desc}</span>
                </span>
                <span className={a.tagClass}>{a.label}</span>
                <Chevron />
              </button>
            ))}
          </div>
          {shown.length > LIMIT && (
            <div className="dash-more">
              <button type="button" className="btn btn-ghost" onClick={() => setAll(v => !v)} aria-expanded={all}>
                {all ? 'Mostra meno' : `Mostra tutti (${shown.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Metric({ icon, tone, label, value, note }: { icon: ReactNode; tone: string; label: string; value: number; note: string }) {
  return (
    <div className="metric dash-metric">
      <div className="metric-label"><span className="dash-metric-icon" data-tone={tone}>{icon}</span>{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

/* Small line icons for this page (Lucide-style). */
function Svg({ size = 15, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
  );
}
const UsersIcon = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Svg>
);
const CalendarIcon = ({ size }: { size?: number }) => (
  <Svg size={size}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Svg>
);
const HeartIcon = ({ size }: { size?: number }) => (
  <Svg size={size}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></Svg>
);
const CardIcon = ({ size }: { size?: number }) => (
  <Svg size={size}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></Svg>
);
const IdIcon = ({ size }: { size?: number }) => (
  <Svg size={size}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M15 8h2M15 12h2M7 16h10" /></Svg>
);
const Chevron = () => (
  <svg className="dash-chevron" width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1.5 1.5 6.5 6.5l-5 5" /></svg>
);
