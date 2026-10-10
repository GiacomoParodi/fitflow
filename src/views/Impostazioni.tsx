import './impostazioni.css';
import { useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { WEEKDAYS_SHORT } from '../../shared/dates';
import { euro, mesiLabel } from '../../shared/rules';
import type { Accento, Course, Settings, Tema } from '../../shared/types';
import { api } from '../api';
import { PageHead } from '../components/PageHead';
import { giorniLabel } from '../derive';
import { modules } from '../modules';
import * as I from '../icons';
import { useApp } from '../store';

const WEEK = [1, 2, 3, 4, 5, 6, 0];

// ─── Sections (left column, as in macOS System Settings) ─────────────────

interface Section {
  id: string;
  title: string;
  /** Short line under the pane title. */
  desc?: string;
  /** Icon tile color (a system color token). */
  tint: string;
  icon: ComponentType;
  /** Sections with the same group sit together in the list. */
  group: number;
  Component: ComponentType;
}

/** Lucide glyphs used only by the section list. */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
  );
}
const G = {
  card: () => <Glyph><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></Glyph>,
  calendar: () => <Glyph><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Glyph>,
  bell: () => <Glyph><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Glyph>,
  gear: () => <I.Gear size={14} />,
  appearance: () => <Glyph><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></Glyph>,
  sparkles: () => <I.Sparkles size={14} />,
  bot: () => <Glyph><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M12 8V4H8M2 14h2M20 14h2M15 13v2M9 13v2" /></Glyph>,
  monitor: () => <Glyph><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></Glyph>,
  puzzle: () => <Glyph><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 12h6M12 9v6" /></Glyph>,
};

const CORE_SECTIONS: Section[] = [
  { id: 'abbonamenti', title: 'Abbonamenti', tint: '--green', icon: G.card, group: 0, Component: PlansPane,
    desc: 'Si scelgono all\'iscrizione e a ogni pagamento. La durata stabilisce fino a quando il pagamento copre l\'iscritto.' },
  { id: 'corsi', title: 'Corsi', tint: '--orange', icon: G.calendar, group: 0, Component: CoursesPane,
    desc: 'Giorni e orario decidono quali lezioni compaiono in dashboard; la capienza limita le iscrizioni.' },
  { id: 'scadenze', title: 'Iscrizione e avvisi', tint: '--red', icon: G.bell, group: 0, Component: DeadlinesPane,
    desc: 'Quota e scadenza dell\'iscrizione annuale, e con quanto anticipo segnalare le scadenze.' },
  { id: 'generali', title: 'Generali', tint: '--graphite', icon: G.gear, group: 1, Component: GeneralPane },
  { id: 'aspetto', title: 'Aspetto', tint: '--indigo', icon: G.appearance, group: 1, Component: AppearancePane,
    desc: 'Tema chiaro o scuro e colore di evidenziazione di pulsanti, selezioni e grafici.' },
];

/** Look of the sections added by modules (by title); unknown ones get a neutral tile. */
const MODULE_LOOK: Record<string, { tint: string; icon: ComponentType }> = {
  'Motore AI': { tint: '--purple', icon: G.sparkles },
  'Agenti': { tint: '--pink', icon: G.bot },
  'App desktop': { tint: '--blue', icon: G.monitor },
};

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Built on first use: `modules` imports this file, so it is not ready while this module loads. */
let sectionsCache: Section[] | null = null;
function allSections(): Section[] {
  return sectionsCache ??= [
    ...CORE_SECTIONS,
    ...modules.flatMap(m => m.settings ?? []).map(sec => ({
      id: slug(sec.title), title: sec.title, group: 2, Component: sec.Component,
      ...(MODULE_LOOK[sec.title] ?? { tint: '--graphite', icon: G.puzzle }),
    })),
  ];
}

const STORAGE_KEY = 'fitflow.impostazioni.sezione';
/** #/impostazioni/<sezione> opens that section directly (e.g. links from other pages). */
const sectionFromHash = () => window.location.hash.replace(/^#/, '').split('/')[2] ?? '';
const known = (id: string | null | undefined) => allSections().some(s => s.id === id);

function initialSection(): string {
  const fromHash = sectionFromHash();
  if (known(fromHash)) return fromHash;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && known(saved)) return saved;
  } catch { /* storage unavailable */ }
  return allSections()[0].id;
}

export function Impostazioni() {
  const SECTIONS = allSections();
  const [current, setCurrent] = useState(initialSection);
  const navRef = useRef<HTMLElement>(null);

  const select = useCallback((id: string) => {
    setCurrent(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* storage unavailable */ }
    window.history.replaceState(null, '', `#/impostazioni/${id}`);
  }, []);

  useEffect(() => {
    const onHash = () => { const id = sectionFromHash(); if (known(id)) setCurrent(id); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Up/down arrows move through the list, like a macOS source list.
  const onNavKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = SECTIONS.findIndex(s => s.id === current) + (e.key === 'ArrowDown' ? 1 : -1);
    const next = SECTIONS[(i + SECTIONS.length) % SECTIONS.length];
    select(next.id);
    navRef.current?.querySelector<HTMLButtonElement>(`[data-id="${next.id}"]`)?.focus();
  };

  const sec = SECTIONS.find(s => s.id === current) ?? SECTIONS[0];

  return (
    <div className="page imp-page">
      <PageHead page="impostazioni" title="Impostazioni" />
      <div className="imp-layout">
        <nav className="imp-nav" aria-label="Sezioni delle impostazioni" ref={navRef} onKeyDown={onNavKey}>
          {SECTIONS.map((s, i) => (
            <button key={s.id} type="button" data-id={s.id}
              className={`imp-nav-item${i > 0 && SECTIONS[i - 1].group !== s.group ? ' imp-nav-gap' : ''}`}
              aria-current={s.id === sec.id ? 'page' : undefined} onClick={() => select(s.id)}>
              <span className="imp-tile" style={{ '--tile': `var(${s.tint})` } as CSSProperties}><s.icon /></span>
              <span className="imp-nav-label">{s.title}</span>
            </button>
          ))}
        </nav>
        <section className="imp-pane" aria-labelledby="imp-pane-title" key={sec.id}>
          <header className="imp-pane-head">
            <span className="imp-tile imp-tile-lg" style={{ '--tile': `var(${sec.tint})` } as CSSProperties}><sec.icon /></span>
            <div className="imp-pane-head-text">
              <h2 id="imp-pane-title" className="imp-pane-title">{sec.title}</h2>
              {sec.desc && <p className="imp-pane-desc">{sec.desc}</p>}
            </div>
          </header>
          <div className={sec.group === 2 ? 'imp-module' : 'imp-body'}>
            <sec.Component />
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Building blocks: grouped card with rows ─────────────────────────────

function Group({ title, footer, children, flush }: { title?: ReactNode; footer?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <div className="imp-group-wrap">
      {title && <h3 className="imp-group-title">{title}</h3>}
      <div className={`imp-group${flush ? ' imp-group-flush' : ''}`}>{children}</div>
      {footer && <div className="imp-group-foot">{footer}</div>}
    </div>
  );
}

/** Edits one setting locally and saves it when the field loses focus. Laid out as a settings row. */
function SettingRow({ k, label, type, unit }: { k: keyof Settings; label: string; type: 'text' | 'number' | 'date'; unit?: string }) {
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
    <div className="imp-row">
      <div className="imp-row-text">
        <label className="imp-row-label" htmlFor={`set-${k}`}>{label}</label>
      </div>
      <div className="imp-row-control">
        <input id={`set-${k}`} className={`input imp-input imp-input-${type}`} type={type} min={type === 'number' ? 0 : undefined} value={value}
          onChange={e => setValue(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        {unit && <span className="imp-unit">{unit}</span>}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, children }: { icon: ComponentType; title: string; children: ReactNode }) {
  return (
    <div className="imp-empty">
      <span className="imp-empty-icon"><Icon /></span>
      <div className="imp-empty-title">{title}</div>
      <div className="text-muted">{children}</div>
    </div>
  );
}

// ─── Abbonamenti ─────────────────────────────────────────────────────────

function PlansPane() {
  return (
    <div className="imp-split">
      <PlansTable />
      <NewPlanForm />
    </div>
  );
}

function PlansTable() {
  const { state, people, run } = useApp();
  const [error, setError] = useState('');
  const remove = async (id: number) => setError((await run(() => api.deletePlan(id))) ?? '');

  return (
    <Group title="Abbonamenti in uso" flush>
      {state.plans.length === 0 ? (
        <EmptyState icon={G.card} title="Nessun abbonamento">Aggiungine uno per poter iscrivere qualcuno.</EmptyState>
      ) : (
        <div className="scroll-x">
          <table className="table imp-table">
            <thead><tr><th>Nome</th><th>Durata</th><th className="right">Prezzo</th><th className="right">Iscritti</th><th><span className="sr-only">Azioni</span></th></tr></thead>
            <tbody>
              {state.plans.map(pl => (
                <tr key={pl.id}>
                  <td className="row-title">{pl.name}</td>
                  <td className="text-muted nowrap">{mesiLabel(pl.mesi)}</td>
                  <td className="right nowrap">{euro(pl.prezzo)}</td>
                  <td className="right text-muted">{people.filter(p => p.planId === pl.id).length}</td>
                  <td className="imp-actions">
                    <button type="button" className="btn btn-ghost imp-btn-sm imp-btn-danger" onClick={() => remove(pl.id)}
                      aria-label={`Elimina ${pl.name}`}>Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <div className="error-box imp-inline-error" role="alert">{error}</div>}
    </Group>
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
    <Group title="Nuovo abbonamento">
      <form className="imp-form" onSubmit={e => { e.preventDefault(); void add(); }}>
        <div className="imp-form-grid">
          <div className="field imp-form-wide"><label htmlFor="np-name">Nome</label><input id="np-name" className="input" value={form.name} onChange={set('name')} placeholder="Es. Semestrale" /></div>
          <div className="field"><label htmlFor="np-mesi">Durata (mesi)</label><input id="np-mesi" className="input" type="number" min="1" value={form.mesi} onChange={set('mesi')} placeholder="Es. 6" /></div>
          <div className="field"><label htmlFor="np-prezzo">Prezzo (€)</label><input id="np-prezzo" className="input" type="number" min="0" value={form.prezzo} onChange={set('prezzo')} placeholder="Es. 220" /></div>
        </div>
        {error && <div className="error-box" role="alert">{error}</div>}
        <div className="imp-form-actions">
          <button type="submit" className="btn btn-primary"><I.Plus /> Aggiungi abbonamento</button>
        </div>
      </form>
    </Group>
  );
}

// ─── Corsi ───────────────────────────────────────────────────────────────

interface CourseForm { name: string; giorni: number[]; orario: string; capienza: string }
const EMPTY_COURSE: CourseForm = { name: '', giorni: [], orario: '18:00', capienza: '15' };

function CoursesPane() {
  const { state, people, run } = useApp();
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseForm>(EMPTY_COURSE);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const startEdit = (c: Course) => {
    setEditing(c);
    setForm({ name: c.name, giorni: c.giorni, orario: c.orario, capienza: String(c.capienza) });
    setError('');
    nameRef.current?.focus();
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
    <div className="imp-split">
      <Group title="Corsi in calendario" flush>
        {state.courses.length === 0 ? (
          <EmptyState icon={G.calendar} title="Nessun corso">Crea il primo con il modulo «Nuovo corso».</EmptyState>
        ) : (
          <div className="scroll-x">
            <table className="table imp-table">
              <thead><tr><th>Nome</th><th>Giorni</th><th>Orario</th><th>Iscritti</th><th><span className="sr-only">Azioni</span></th></tr></thead>
              <tbody>
                {state.courses.map(c => {
                  const n = people.filter(p => p.courseId === c.id).length;
                  return (
                    <tr key={c.id} data-editing={editing?.id === c.id || undefined}>
                      <td className="row-title">{c.name}</td>
                      <td className="text-muted nowrap">{giorniLabel(c)}</td>
                      <td className="text-muted">{c.orario}</td>
                      <td className="nowrap">
                        <span className="imp-cap">
                          <span className="imp-cap-track" aria-hidden="true">
                            <span className="imp-cap-fill" data-full={n >= c.capienza || undefined}
                              style={{ width: `${Math.min(100, (n / Math.max(1, c.capienza)) * 100)}%` }} />
                          </span>
                          <span className="text-muted">{n}/{c.capienza}</span>
                        </span>
                      </td>
                      <td className="imp-actions">
                        <button type="button" className="btn btn-ghost imp-btn-sm" onClick={() => startEdit(c)} aria-label={`Modifica ${c.name}`}>Modifica</button>
                        <button type="button" className="btn btn-ghost imp-btn-sm imp-btn-danger" onClick={() => remove(c)} aria-label={`Elimina ${c.name}`}>Elimina</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {listError && <div className="error-box imp-inline-error" role="alert">{listError}</div>}
      </Group>

      <Group title={editing ? `Modifica ${editing.name}` : 'Nuovo corso'}>
        <form className="imp-form" onSubmit={e => { e.preventDefault(); void save(); }}>
          <div className="imp-form-grid">
            <div className="field imp-form-wide"><label htmlFor="nc-name">Nome</label><input id="nc-name" ref={nameRef} className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Es. Pilates serale" /></div>
            <div className="field"><label htmlFor="nc-orario">Orario</label><input id="nc-orario" className="input" type="time" value={form.orario} onChange={e => setForm({ ...form, orario: e.target.value })} /></div>
            <div className="field"><label htmlFor="nc-cap">Capienza</label><input id="nc-cap" className="input" type="number" min="1" value={form.capienza} onChange={e => setForm({ ...form, capienza: e.target.value })} /></div>
          </div>
          <div className="field">
            <span className="field-label" id="nc-giorni">Giorni</span>
            <div className="imp-days" role="group" aria-labelledby="nc-giorni">
              {WEEK.map(d => (
                <button key={d} type="button" className="chip imp-day" aria-pressed={form.giorni.includes(d)} onClick={() => toggleDay(d)}>{WEEKDAYS_SHORT[d]}</button>
              ))}
            </div>
          </div>
          {error && <div className="error-box" role="alert">{error}</div>}
          <div className="imp-form-actions">
            {editing && <button type="button" className="btn btn-secondary" onClick={reset}>Annulla</button>}
            <button type="submit" className="btn btn-primary">{editing ? 'Salva modifiche' : <><I.Plus /> Aggiungi corso</>}</button>
          </div>
        </form>
      </Group>
    </div>
  );
}

// ─── Iscrizione annuale e avvisi ─────────────────────────────────────────

function DeadlinesPane() {
  return (
    <div className="imp-cols">
      <Group title="Iscrizione annuale" footer="La scadenza della stagione si propone in automatico ai nuovi iscritti.">
        <SettingRow k="quotaIscrizione" label="Quota iscrizione" type="number" unit="€" />
        <SettingRow k="scadenzaStagione" label="Scadenza stagione" type="date" />
      </Group>
      <Group title="Avvisi e scadenze" footer={'Giorni di anticipo con cui una scadenza diventa "in scadenza".'}>
        <SettingRow k="sogliaCertificato" label="Certificato medico" type="number" unit="giorni" />
        <SettingRow k="sogliaIscrizione" label="Iscrizione" type="number" unit="giorni" />
        <SettingRow k="sogliaAbbonamento" label="Abbonamento" type="number" unit="giorni" />
      </Group>
    </div>
  );
}

// ─── Generali ────────────────────────────────────────────────────────────

function GeneralPane() {
  return (
    <div className="imp-cols">
      <Group title="Istruttore" footer="Compare nel saluto della dashboard.">
        <SettingRow k="instructorName" label="Nome istruttore" type="text" />
      </Group>
    </div>
  );
}

// ─── Aspetto ─────────────────────────────────────────────────────────────

const THEMES: { v: Tema; label: string }[] = [
  { v: 'auto', label: 'Automatico' },
  { v: 'chiaro', label: 'Chiaro' },
  { v: 'scuro', label: 'Scuro' },
];

const ACCENTS: { v: Accento; label: string; token: string }[] = [
  { v: 'blu', label: 'Blu', token: '--blue' },
  { v: 'viola', label: 'Viola', token: '--purple' },
  { v: 'rosa', label: 'Rosa', token: '--pink' },
  { v: 'rosso', label: 'Rosso', token: '--red' },
  { v: 'arancione', label: 'Arancione', token: '--orange' },
  { v: 'giallo', label: 'Giallo', token: '--yellow' },
  { v: 'verde', label: 'Verde', token: '--green' },
  { v: 'grafite', label: 'Grafite', token: '--graphite' },
];

/** A tiny window drawn in a fixed light or dark palette, whatever the current theme. */
function MiniWindow({ look }: { look: 'light' | 'dark' }) {
  return (
    <span className={`imp-mini imp-mini-${look}`}>
      <span className="imp-mini-bar"><i /><i /><i /></span>
      <span className="imp-mini-body">
        <span className="imp-mini-side"><i className="imp-mini-sel" /><i /><i /></span>
        <span className="imp-mini-main"><i className="imp-mini-acc" /><i /><i className="imp-mini-short" /></span>
      </span>
    </span>
  );
}

type Look = Partial<Pick<Settings, 'tema' | 'accento'>>;

function AppearancePane() {
  const { state, act } = useApp();
  // The choice shows as selected right away; the app switches as soon as the server confirms.
  const [pending, setPending] = useState<Look>({});
  const tema = pending.tema ?? state.settings.tema ?? 'auto';
  const accento = pending.accento ?? state.settings.accento ?? 'blu';

  const choose = async (patch: Look) => {
    setPending(patch);
    await act(() => api.updateSettings(patch));
    setPending({});
  };

  return (
    <Group>
      <div className="imp-row imp-row-tall">
        <div className="imp-row-text">
          <span className="imp-row-label" id="imp-tema">Aspetto</span>
          <div className="imp-row-hint">Automatico segue il tema chiaro o scuro del computer.</div>
        </div>
        <div className="imp-themes" role="group" aria-labelledby="imp-tema">
          {THEMES.map(t => (
            <button key={t.v} type="button" className="imp-theme" aria-pressed={tema === t.v} onClick={() => tema !== t.v && choose({ tema: t.v })}>
              <span className="imp-thumb" data-look={t.v}>
                <MiniWindow look={t.v === 'scuro' ? 'dark' : 'light'} />
                {t.v === 'auto' && <span className="imp-thumb-half"><MiniWindow look="dark" /></span>}
              </span>
              <span className="imp-theme-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="imp-row imp-row-tall">
        <div className="imp-row-text">
          <span className="imp-row-label" id="imp-accento">Colore di evidenziazione</span>
          <div className="imp-row-hint">Pulsanti principali, selezioni e grafici.</div>
        </div>
        <div className="imp-accents" role="group" aria-labelledby="imp-accento">
          {ACCENTS.map(a => (
            <button key={a.v} type="button" className="imp-swatch" aria-pressed={accento === a.v} aria-label={a.label} title={a.label}
              style={{ '--sw': `var(${a.token})` } as CSSProperties} onClick={() => accento !== a.v && choose({ accento: a.v })}>
              <span className="imp-swatch-dot" />
              <span className="imp-swatch-name" aria-hidden="true">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Group>
  );
}
