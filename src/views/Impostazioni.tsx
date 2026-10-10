import './impostazioni.css';
import { useEffect, useState } from 'react';
import { WEEKDAYS_SHORT } from '../../shared/dates';
import { euro, mesiLabel } from '../../shared/rules';
import type { Course, Settings } from '../../shared/types';
import { api } from '../api';
import { PageHead, SectionTitle } from '../components/PageHead';
import { giorniLabel } from '../derive';
import { modules } from '../modules';
import * as I from '../icons';
import { useApp } from '../store';

const WEEK = [1, 2, 3, 4, 5, 6, 0];
/** Numbered sections on this page before the ones added by modules. */
const CORE_SECTIONS = 5;

export function Impostazioni() {
  return (
    <div className="page page-narrow">
      <PageHead page="impostazioni" title="Impostazioni" />
      <div className="settings-grid">
        <div className="col-left">
          <PlansTable />
          <hr className="hr" />
          <CoursesSection />
        </div>
        <div className="col-right">
          <NewPlanForm />
          <hr className="hr" />
          <SectionTitle num="03" tight>Iscrizione annuale</SectionTitle>
          <div className="section-desc text-muted">La scadenza della stagione si propone in automatico ai nuovi iscritti.</div>
          <div className="form-2">
            <SettingField k="quotaIscrizione" label="Quota iscrizione (€)" type="number" />
            <SettingField k="scadenzaStagione" label="Scadenza stagione" type="date" />
          </div>
          <hr className="hr" />
          <SectionTitle num="05" tight>Generali</SectionTitle>
          <div className="section-desc text-muted">Giorni di anticipo con cui una scadenza diventa "in scadenza".</div>
          <div className="stack-form">
            <SettingField k="instructorName" label="Nome istruttore" type="text" />
            <div className="form-3">
              <SettingField k="sogliaCertificato" label="Certificato (gg)" type="number" />
              <SettingField k="sogliaIscrizione" label="Iscrizione (gg)" type="number" />
              <SettingField k="sogliaAbbonamento" label="Abbonamento (gg)" type="number" />
            </div>
          </div>
        </div>
      </div>
      {modules.flatMap(m => m.settings ?? []).map((sec, i) => (
        <section key={sec.title}>
          <hr className="hr" />
          <SectionTitle num={String(CORE_SECTIONS + i + 1).padStart(2, '0')}>{sec.title}</SectionTitle>
          <sec.Component />
        </section>
      ))}
    </div>
  );
}

/** Edits one setting locally and saves it when the field loses focus. */
function SettingField({ k, label, type }: { k: keyof Settings; label: string; type: 'text' | 'number' | 'date' }) {
  const { state, act } = useApp();
  const saved = String(state.settings[k] ?? '');
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);

  const commit = async () => {
    if (value === saved) return;
    const v = type === 'number' ? Number(value) : value;
    if (!(await act(() => api.updateSettings({ [k]: v })))) setValue(saved);
  };

  return (
    <div className="field">
      <label htmlFor={`set-${k}`}>{label}</label>
      <input id={`set-${k}`} className="input" type={type} min={type === 'number' ? 0 : undefined} value={value}
        onChange={e => setValue(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
    </div>
  );
}

function PlansTable() {
  const { state, people, run } = useApp();
  const [error, setError] = useState('');
  const remove = async (id: number) => setError((await run(() => api.deletePlan(id))) ?? '');

  return (
    <>
      <SectionTitle num="01" tight>Abbonamenti</SectionTitle>
      <div className="section-desc text-muted">Si scelgono all'iscrizione e a ogni pagamento. La durata stabilisce fino a quando il pagamento copre l'iscritto.</div>
      <div className="scroll-x">
        <table className="table">
          <thead><tr><th>Nome</th><th>Durata</th><th>Prezzo</th><th>Iscritti</th><th><span className="sr-only">Azioni</span></th></tr></thead>
          <tbody>
            {state.plans.map(pl => (
              <tr key={pl.id}>
                <td className="row-title">{pl.name}</td>
                <td className="text-muted nowrap">{mesiLabel(pl.mesi)}</td>
                <td className="row-title nowrap">{euro(pl.prezzo)}</td>
                <td className="text-muted">{people.filter(p => p.planId === pl.id).length}</td>
                <td style={{ textAlign: 'right' }}><button type="button" className="btn btn-ghost" onClick={() => remove(pl.id)}>Elimina</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.plans.length === 0 && <div className="empty text-muted">Nessun abbonamento: aggiungine uno per poter iscrivere qualcuno.</div>}
      {error && <div className="error-box settings-error" role="alert">{error}</div>}
    </>
  );
}

function NewPlanForm() {
  const { run } = useApp();
  const empty = { name: '', mesi: '', prezzo: '' };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const add = async () => {
    const err = await run(() => api.createPlan(form));
    setError(err ?? '');
    if (!err) setForm(empty);
  };

  return (
    <>
      <SectionTitle num="02">Nuovo abbonamento</SectionTitle>
      <div className="stack-form">
        <div className="field"><label htmlFor="np-name">Nome</label><input id="np-name" className="input" value={form.name} onChange={set('name')} placeholder="Es. Semestrale" /></div>
        <div className="form-2">
          <div className="field"><label htmlFor="np-mesi">Durata (mesi)</label><input id="np-mesi" className="input" type="number" min="1" value={form.mesi} onChange={set('mesi')} placeholder="Es. 6" /></div>
          <div className="field"><label htmlFor="np-prezzo">Prezzo (€)</label><input id="np-prezzo" className="input" type="number" min="0" value={form.prezzo} onChange={set('prezzo')} placeholder="Es. 220" /></div>
        </div>
        {error && <div className="error-box" role="alert">{error}</div>}
        <button type="button" className="btn btn-primary btn-block" onClick={add}><I.Plus /> Aggiungi abbonamento</button>
      </div>
    </>
  );
}

interface CourseForm { name: string; giorni: number[]; orario: string; capienza: string }
const EMPTY_COURSE: CourseForm = { name: '', giorni: [], orario: '18:00', capienza: '15' };

function CoursesSection() {
  const { state, people, run } = useApp();
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseForm>(EMPTY_COURSE);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const startEdit = (c: Course) => {
    setEditing(c);
    setForm({ name: c.name, giorni: c.giorni, orario: c.orario, capienza: String(c.capienza) });
    setError('');
  };
  const reset = () => { setEditing(null); setForm(EMPTY_COURSE); setError(''); };
  const toggleDay = (d: number) => setForm(f => ({ ...f, giorni: f.giorni.includes(d) ? f.giorni.filter(x => x !== d) : [...f.giorni, d] }));

  const save = async () => {
    const body = { ...form, capienza: Number(form.capienza) };
    const err = await run(() => (editing ? api.updateCourse(editing.id, body) : api.createCourse(body)));
    setError(err ?? '');
    if (!err) reset();
  };
  const remove = async (c: Course) => {
    if (!window.confirm(`Eliminare il corso ${c.name} con tutte le sue lezioni?`)) return;
    setListError((await run(() => api.deleteCourse(c.id))) ?? '');
    if (editing?.id === c.id) reset();
  };

  return (
    <>
      <SectionTitle num="04" tight>Corsi</SectionTitle>
      <div className="section-desc text-muted">Giorni e orario decidono quali lezioni compaiono in dashboard; la capienza limita le iscrizioni.</div>
      <div className="scroll-x">
        <table className="table">
          <thead><tr><th>Nome</th><th>Giorni</th><th>Orario</th><th>Iscritti</th><th><span className="sr-only">Azioni</span></th></tr></thead>
          <tbody>
            {state.courses.map(c => (
              <tr key={c.id}>
                <td className="row-title">{c.name}</td>
                <td className="text-muted nowrap">{giorniLabel(c)}</td>
                <td className="text-muted">{c.orario}</td>
                <td className="text-muted nowrap">{people.filter(p => p.courseId === c.id).length}/{c.capienza}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => startEdit(c)}>Modifica</button>
                  <button type="button" className="btn btn-ghost" onClick={() => remove(c)}>Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.courses.length === 0 && <div className="empty text-muted">Nessun corso: creane uno qui sotto.</div>}
      {listError && <div className="error-box settings-error" role="alert">{listError}</div>}

      <h5 style={{ margin: '24px 0 12px' }}>{editing ? `Modifica ${editing.name}` : 'Nuovo corso'}</h5>
      <div className="stack-form">
        <div className="form-2">
          <div className="field"><label htmlFor="nc-name">Nome</label><input id="nc-name" className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Es. Pilates serale" /></div>
          <div className="form-2">
            <div className="field"><label htmlFor="nc-orario">Orario</label><input id="nc-orario" className="input" type="time" value={form.orario} onChange={e => setForm({ ...form, orario: e.target.value })} /></div>
            <div className="field"><label htmlFor="nc-cap">Capienza</label><input id="nc-cap" className="input" type="number" min="1" value={form.capienza} onChange={e => setForm({ ...form, capienza: e.target.value })} /></div>
          </div>
        </div>
        <div className="field">
          <label id="nc-giorni">Giorni</label>
          <div className="seg day-picker" role="group" aria-labelledby="nc-giorni">
            {WEEK.map(d => (
              <button key={d} type="button" className="seg-opt" aria-pressed={form.giorni.includes(d)} onClick={() => toggleDay(d)}>{WEEKDAYS_SHORT[d]}</button>
            ))}
          </div>
        </div>
        {error && <div className="error-box" role="alert">{error}</div>}
        <div className="btn-row-8">
          <button type="button" className="btn btn-primary" onClick={save}>{editing ? 'Salva modifiche' : <><I.Plus /> Aggiungi corso</>}</button>
          {editing && <button type="button" className="btn btn-secondary" onClick={reset}>Annulla</button>}
        </div>
      </div>
    </>
  );
}
