import { useState } from 'react';
import { fmtShort } from '../../shared/dates';
import type { Course } from '../../shared/types';
import { api } from '../api';
import { NewParticipantDialog } from '../components/NewParticipantDialog';
import { PageHead } from '../components/PageHead';
import { countLabel, giorniLabel, groupLessons, type DecoratedParticipant } from '../derive';
import * as I from '../icons';
import { useApp } from '../store';

export function Corsi() {
  const { state, people, route, go } = useApp();
  const { courses } = state;
  const selected = courses.find(c => c.id === route.courseId) ?? courses[0];

  return (
    <div className="page">
      <PageHead page="corsi" title="Corsi" />
      {courses.length === 0 ? (
        <div className="text-muted" style={{ fontSize: 14 }}>
          Nessun corso ancora. <a href="#/impostazioni">Crea il primo corso in Impostazioni</a>.
        </div>
      ) : (
        <div className="master-detail">
          <div className="course-list">
            {courses.map(c => {
              const n = people.filter(p => p.courseId === c.id).length;
              return (
                <button key={c.id} type="button" className="clickable course-card" aria-current={c.id === selected.id}
                  onClick={() => go('corsi', c.id)}>
                  <div className="course-card-name">{c.name}</div>
                  <div className="course-card-meta">{giorniLabel(c)} · {c.orario}</div>
                  <div className="capacity">
                    <div className="capacity-track">
                      <div className="capacity-fill" style={{ width: Math.min(100, Math.round((n / c.capienza) * 100)) + '%' }} />
                    </div>
                    <div className="capacity-label">{countLabel(n, c)}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <CourseDetail key={selected.id} course={selected} />
        </div>
      )}
    </div>
  );
}

function CourseDetail({ course }: { course: Course }) {
  const { people } = useApp();
  const [view, setView] = useState<'iscritti' | 'presenze'>('iscritti');
  const [newOpen, setNewOpen] = useState(false);
  const list = people.filter(p => p.courseId === course.id);

  return (
    <div className="course-detail">
      <div className="course-head">
        <h2 className="course-title">{course.name}</h2>
        <div className="text-muted nowrap" style={{ fontSize: 13 }}>{giorniLabel(course)} · {course.orario}</div>
      </div>
      <div className="text-muted" style={{ fontSize: 13, marginBottom: 18 }}>Posti occupati: {countLabel(list.length, course)}</div>
      <hr className="hr" />

      {view === 'iscritti' ? (
        <>
          <div className="toolbar">
            <ViewSwitch view={view} setView={setView} />
            <button type="button" className="btn btn-primary" onClick={() => setNewOpen(true)}><I.Plus /> Nuovo iscritto</button>
          </div>
          <IscrittiTable list={list} />
        </>
      ) : (
        <Presenze course={course} list={list} toolbar={<ViewSwitch view={view} setView={setView} />} />
      )}

      {newOpen && <NewParticipantDialog course={course} enrolled={list.length} onClose={() => setNewOpen(false)} />}
    </div>
  );
}

function ViewSwitch({ view, setView }: { view: 'iscritti' | 'presenze'; setView: (v: 'iscritti' | 'presenze') => void }) {
  return (
    <div className="seg" role="group" aria-label="Vista">
      <button type="button" className="seg-opt" aria-pressed={view === 'iscritti'} onClick={() => setView('iscritti')}>Iscritti</button>
      <button type="button" className="seg-opt" aria-pressed={view === 'presenze'} onClick={() => setView('presenze')}>Presenze</button>
    </div>
  );
}

function IscrittiTable({ list }: { list: DecoratedParticipant[] }) {
  const { openParticipant } = useApp();
  if (list.length === 0) {
    return <div className="empty text-muted">Nessun iscritto. Usa "Nuovo iscritto" per aggiungere il primo.</div>;
  }
  return (
    <div className="scroll-x">
      <table className="table">
        <thead>
          <tr><th>Nome</th><th>Abbonamento</th><th>Iscrizione</th><th>Certificato</th><th>Presenze</th></tr>
        </thead>
        <tbody>
          {list.map(p => (
            <tr key={p.id} className="row-link" tabIndex={0} onClick={() => openParticipant(p.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openParticipant(p.id); } }}>
              <td>
                <div className="row-title">{p.name}</div>
                <div className="cell-sub text-muted">{p.phone}</div>
              </td>
              <td>
                <div className="cell-inline"><span className="row-title">{p.plan?.name ?? 'Nessuno'}</span><span className={p.pay.tagClass}>{p.pay.label}</span></div>
                <div className="cell-sub text-muted">Pagato fino al {p.pay.dateLabel}</div>
              </td>
              <td>
                <span className={p.iscr.tagClass + ' nowrap'}>{p.iscr.label}</span>
                <div className="cell-sub spaced text-muted">{p.iscr.dateLabel}</div>
              </td>
              <td>
                <span className={p.cert.tagClass + ' nowrap'}>{p.cert.label}</span>
                <div className="cell-sub spaced text-muted">{p.cert.dateLabel}</div>
              </td>
              <td className="text-muted">{p.presenzePct}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Presenze({ course, list, toolbar }: { course: Course; list: DecoratedParticipant[]; toolbar: React.ReactNode }) {
  const { state, today, act, openParticipant } = useApp();
  const [newDate, setNewDate] = useState(today);
  const lessons = groupLessons(state.lessons).get(course.id) ?? [];

  const addLesson = () => { if (newDate) act(() => api.addLesson(course.id, newDate)); };
  const removeLesson = (id: number, label: string) => {
    if (window.confirm(`Eliminare la lezione del ${label} e le presenze segnate?`)) act(() => api.deleteLesson(id));
  };

  return (
    <>
      <div className="toolbar">
        {toolbar}
        <div className="toolbar-group">
          <input className="input" type="date" aria-label="Data della nuova lezione" value={newDate}
            onChange={e => setNewDate(e.target.value)} style={{ width: 170 }} />
          <button type="button" className="btn btn-primary" onClick={addLesson} disabled={!newDate}><I.Plus /> Aggiungi data</button>
        </div>
      </div>

      {lessons.length === 0 && (
        <div className="text-muted" style={{ padding: '16px 0', fontSize: 13 }}>
          Nessuna lezione registrata. Aggiungi una data per iniziare a segnare le presenze.
        </div>
      )}
      <div className="scroll-x">
        <div className="grid-wrap" role="table" aria-label="Registro presenze">
          <div className="grid-row grid-head" role="row">
            <div className="grid-name text-muted" role="columnheader">Nome</div>
            {lessons.map(l => {
              const f = fmtShort(l.date);
              const n = list.filter(p => l.present.includes(p.id)).length;
              return (
                <div key={l.id} className="grid-col" role="columnheader">
                  <div className="grid-day text-muted">{f.day}</div>
                  <div className="grid-date" data-empty={n === 0}>
                    {f.label}
                    <button type="button" className="lesson-remove" title="Elimina lezione" aria-label={`Elimina lezione del ${f.label}`}
                      onClick={() => removeLesson(l.id, f.label)}><I.X size={12} /></button>
                  </div>
                  <button type="button" className="btn btn-ghost grid-all" onClick={() => act(() => api.markAll(l.id))}>
                    Tutti {n}/{list.length}
                  </button>
                </div>
              );
            })}
            <div className="grid-tot-head text-muted" role="columnheader">Tot.</div>
          </div>
          {list.map(p => (
            <div key={p.id} className="grid-row" role="row">
              <button type="button" className="clickable grid-name" role="rowheader" onClick={() => openParticipant(p.id)}>{p.name}</button>
              {lessons.map(l => {
                const present = l.present.includes(p.id);
                return (
                  <div key={l.id} className="grid-col" role="cell">
                    <button type="button" className="check" aria-pressed={present}
                      aria-label={`${p.name}, ${fmtShort(l.date).label}: ${present ? 'presente' : 'assente'}`}
                      onClick={() => act(() => api.toggleAttendance(l.id, p.id))}>
                      {present && <span style={{ color: 'var(--color-bg)', lineHeight: 0 }}><I.Check /></span>}
                    </button>
                  </div>
                );
              })}
              <div className="grid-tot" role="cell">{p.presenzePct}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="hint text-muted">Clicca un quadrato per segnare presente o assente. "Tutti" segna l'intera lezione.</div>
    </>
  );
}
