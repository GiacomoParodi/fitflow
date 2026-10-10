import './corsi.css';
import { useState, type ReactNode } from 'react';
import { fmtShort } from '../../shared/dates';
import type { Course } from '../../shared/types';
import { api } from '../api';
import { NewParticipantDialog } from '../components/NewParticipantDialog';
import { PageHead } from '../components/PageHead';
import { giorniLabel, groupLessons, type DecoratedParticipant } from '../derive';
import * as I from '../icons';
import { useApp } from '../store';

type View = 'iscritti' | 'presenze';

export function Corsi() {
  const { state, people, route, go } = useApp();
  const { courses } = state;
  const selected = courses.find(c => c.id === route.courseId) ?? courses[0];

  return (
    <div className="page">
      <PageHead page="corsi" title="Corsi"
        aside={courses.length > 0 ? <a className="btn btn-secondary" href="#/impostazioni/corsi">Gestisci corsi</a> : undefined} />
      {courses.length === 0 ? (
        <div className="card corsi-empty-page">
          <span className="corsi-empty-icon"><CalendarIcon /></span>
          <div className="corsi-empty-title">Nessun corso</div>
          <div className="corsi-empty-text">Crea il primo corso in Impostazioni: nome, giorni, orario e capienza. Poi potrai aggiungere gli iscritti e segnare le presenze.</div>
          <a className="btn btn-primary" href="#/impostazioni/corsi">Apri Impostazioni</a>
        </div>
      ) : (
        <div className="corsi-layout">
          <nav className="card corsi-list" aria-label="Elenco corsi">
            <div className="corsi-list-head">{courses.length === 1 ? '1 corso' : `${courses.length} corsi`}</div>
            {courses.map(c => {
              const n = people.filter(p => p.courseId === c.id).length;
              const pct = c.capienza ? Math.min(100, Math.round((n / c.capienza) * 100)) : 0;
              return (
                <button key={c.id} type="button" className="corsi-item" aria-current={c.id === selected.id ? 'true' : undefined}
                  onClick={() => go('corsi', c.id)}>
                  <span className="corsi-item-top">
                    <span className="corsi-item-name">{c.name}</span>
                    <span className="corsi-item-count tabular">{n}/{c.capienza}</span>
                  </span>
                  <span className="corsi-item-meta">{giorniLabel(c)} · <span className="tabular">{c.orario}</span></span>
                  <span className="corsi-bar" data-full={n >= c.capienza} aria-hidden="true"><span style={{ width: pct + '%' }} /></span>
                </button>
              );
            })}
          </nav>
          <CourseDetail key={selected.id} course={selected} />
        </div>
      )}
    </div>
  );
}

function CourseDetail({ course }: { course: Course }) {
  const { state, people, today, act } = useApp();
  const [view, setView] = useState<View>('iscritti');
  const [newOpen, setNewOpen] = useState(false);
  const [newDate, setNewDate] = useState(today);
  const list = people.filter(p => p.courseId === course.id);
  const lessons = groupLessons(state.lessons).get(course.id) ?? [];

  const slots = lessons.length * list.length;
  const marks = lessons.reduce((s, l) => s + list.filter(p => l.present.includes(p.id)).length, 0);
  const media = slots ? Math.round((marks / slots) * 100) + '%' : '—';
  const avvisi = list.reduce((s, p) => s + [p.cert, p.pay, p.iscr].filter(c => c.status !== 'valido').length, 0);
  const urgenti = list.reduce((s, p) => s + [p.cert, p.pay, p.iscr].filter(c => c.severe).length, 0);

  const addLesson = () => { if (newDate) act(() => api.addLesson(course.id, newDate)); };

  return (
    <div className="corsi-detail">
      <header className="card corsi-head">
        <div className="corsi-head-top">
          <div className="corsi-head-title">
            <h2 className="corsi-title">{course.name}</h2>
            <div className="corsi-sub">{giorniLabel(course)} · <span className="tabular">{course.orario}</span></div>
          </div>
          <div className="corsi-actions">
            <div className="seg" role="group" aria-label="Vista">
              <button type="button" className="seg-opt" aria-pressed={view === 'iscritti'} onClick={() => setView('iscritti')}>Iscritti</button>
              <button type="button" className="seg-opt" aria-pressed={view === 'presenze'} onClick={() => setView('presenze')}>Presenze</button>
            </div>
            {view === 'iscritti' ? (
              <button type="button" className="btn btn-primary" onClick={() => setNewOpen(true)}><I.Plus /> Nuovo iscritto</button>
            ) : (
              <div className="corsi-add">
                <input className="input" type="date" aria-label="Data della nuova lezione" value={newDate}
                  onChange={e => setNewDate(e.target.value)} />
                <button type="button" className="btn btn-primary" onClick={addLesson} disabled={!newDate}><I.Plus /> Aggiungi data</button>
              </div>
            )}
          </div>
        </div>
        <dl className="corsi-stats">
          <Stat label="Posti occupati" value={<>{list.length}<span className="corsi-stat-of">/{course.capienza}</span></>}
            meter={course.capienza ? Math.min(1, list.length / course.capienza) : 0} full={list.length >= course.capienza} />
          <Stat label="Presenza media" value={media} note={lessons.length === 1 ? 'su 1 lezione' : `su ${lessons.length} lezioni`} />
          <Stat label="Avvisi aperti" value={avvisi} note={avvisi ? (urgenti ? `${urgenti} urgenti` : 'in scadenza') : 'tutti in regola'}
            tone={urgenti ? 'danger' : avvisi ? 'warning' : undefined} />
        </dl>
      </header>

      {view === 'iscritti' ? <IscrittiTable list={list} onNew={() => setNewOpen(true)} /> : <Presenze course={course} list={list} />}

      {newOpen && <NewParticipantDialog course={course} enrolled={list.length} onClose={() => setNewOpen(false)} />}
    </div>
  );
}

function Stat({ label, value, note, meter, full, tone }: {
  label: string; value: ReactNode; note?: string; meter?: number; full?: boolean; tone?: 'danger' | 'warning';
}) {
  return (
    <div className="corsi-stat">
      <dt>{label}</dt>
      <dd>
        <span className="corsi-stat-value tabular">{value}</span>
        {meter !== undefined && (
          <span className="corsi-bar corsi-stat-bar" data-full={full} aria-hidden="true"><span style={{ width: Math.round(meter * 100) + '%' }} /></span>
        )}
        {note && <span className="corsi-stat-note" data-tone={tone}>{note}</span>}
      </dd>
    </div>
  );
}

function IscrittiTable({ list, onNew }: { list: DecoratedParticipant[]; onNew: () => void }) {
  const { openParticipant } = useApp();
  if (list.length === 0) {
    return (
      <div className="card corsi-empty">
        <span className="corsi-empty-icon"><UsersIcon /></span>
        <div className="corsi-empty-title">Nessun iscritto</div>
        <div className="corsi-empty-text">Aggiungi il primo iscritto a questo corso.</div>
        <button type="button" className="btn btn-primary" onClick={onNew}><I.Plus /> Nuovo iscritto</button>
      </div>
    );
  }
  return (
    <div className="card card-flush">
      <div className="scroll-x">
        <table className="table corsi-table">
          <thead>
            <tr><th>Nome</th><th>Abbonamento</th><th>Iscrizione</th><th>Certificato</th><th className="right">Presenze</th></tr>
          </thead>
          <tbody>
            {list.map(p => (
              <tr key={p.id} className="row-link" tabIndex={0} onClick={() => openParticipant(p.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openParticipant(p.id); } }}>
                <td>
                  <div className="row-title">{p.name}</div>
                  <div className="cell-sub spaced">{p.phone || '—'}</div>
                </td>
                <td>
                  <div className="cell-inline"><span>{p.plan?.name ?? 'Nessuno'}</span><span className={p.pay.tagClass}>{p.pay.label}</span></div>
                  <div className="cell-sub spaced">Pagato fino al {p.pay.dateLabel}</div>
                </td>
                <td>
                  <span className={p.iscr.tagClass}>{p.iscr.label}</span>
                  <div className="cell-sub spaced">{p.iscr.dateLabel}</div>
                </td>
                <td>
                  <span className={p.cert.tagClass}>{p.cert.label}</span>
                  <div className="cell-sub spaced">{p.cert.dateLabel}</div>
                </td>
                <td className="right">
                  <div className="corsi-pct">
                    <span className="tabular">{p.presenzePct}</span>
                    <span className="corsi-bar corsi-pct-bar" aria-hidden="true">
                      <span style={{ width: p.presenzeTotali ? Math.round((p.presenzeFatte / p.presenzeTotali) * 100) + '%' : 0 }} />
                    </span>
                  </div>
                  <div className="cell-sub spaced tabular">{p.presenzeFatte} su {p.presenzeTotali}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Presenze({ course, list }: { course: Course; list: DecoratedParticipant[] }) {
  const { state, act, openParticipant } = useApp();
  const lessons = groupLessons(state.lessons).get(course.id) ?? [];

  const removeLesson = (id: number, label: string) => {
    if (window.confirm(`Eliminare la lezione del ${label} e le presenze segnate?`)) act(() => api.deleteLesson(id));
  };

  if (lessons.length === 0) {
    return (
      <div className="card corsi-empty">
        <span className="corsi-empty-icon"><CalendarIcon /></span>
        <div className="corsi-empty-title">Nessuna lezione registrata</div>
        <div className="corsi-empty-text">Scegli una data in alto e premi "Aggiungi data" per iniziare a segnare le presenze.</div>
      </div>
    );
  }

  return (
    <>
      <div className="card card-flush">
        <div className="scroll-x corsi-att-scroll">
          <table className="corsi-att" aria-label="Registro presenze">
            <thead>
              <tr>
                <th scope="col" className="corsi-att-name">Nome</th>
                {lessons.map(l => {
                  const f = fmtShort(l.date);
                  const n = list.filter(p => l.present.includes(p.id)).length;
                  const complete = list.length > 0 && n === list.length;
                  return (
                    <th key={l.id} scope="col" className="corsi-att-col">
                      <div className="corsi-att-date">
                        <span className="corsi-att-day">{f.day}</span>
                        <span className="corsi-att-num tabular" data-empty={n === 0}>{f.label}</span>
                        <button type="button" className="corsi-att-remove" title="Elimina lezione" aria-label={`Elimina lezione del ${f.label}`}
                          onClick={() => removeLesson(l.id, f.label)}><I.X size={11} /></button>
                      </div>
                      <button type="button" className="corsi-att-all tabular" data-complete={complete}
                        aria-label={`Segna tutti presenti il ${f.label}: ${n} su ${list.length}`}
                        onClick={() => act(() => api.markAll(l.id))}>
                        Tutti {n}/{list.length}
                      </button>
                    </th>
                  );
                })}
                <td className="corsi-att-fill" aria-hidden="true" />
                <th scope="col" className="corsi-att-tot">Presenza</th>
              </tr>
            </thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id}>
                  <th scope="row" className="corsi-att-name">
                    <button type="button" className="clickable corsi-att-person" onClick={() => openParticipant(p.id)}>{p.name}</button>
                  </th>
                  {lessons.map(l => {
                    const present = l.present.includes(p.id);
                    return (
                      <td key={l.id} className="corsi-att-col">
                        <button type="button" className="corsi-check" aria-pressed={present}
                          aria-label={`${p.name}, ${fmtShort(l.date).label}: ${present ? 'presente' : 'assente'}`}
                          onClick={() => act(() => api.toggleAttendance(l.id, p.id))}>
                          {present && <I.Check size={13} />}
                        </button>
                      </td>
                    );
                  })}
                  <td className="corsi-att-fill" aria-hidden="true" />
                  <td className="corsi-att-tot tabular">{p.presenzePct}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td className="corsi-att-none" colSpan={lessons.length + 3}>Nessun iscritto a questo corso.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="hint">Clicca un cerchio per segnare presente o assente. "Tutti" segna l'intera lezione; passa sopra una data per eliminarla.</div>
    </>
  );
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
