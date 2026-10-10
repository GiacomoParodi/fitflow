import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BLOCCHI, BLOCCO_LABEL,
  type Blocco, type Contenuto, type ContenutoAnalisi, type ContenutoProgramma, type EsercizioConsigliato, type EsercizioProgramma,
} from '../../../shared/assistente';
import * as I from '../../icons';
import { ass, type EsercizioTrovato } from './api';
import * as X from './icone';

// ─── Libreria per il completamento dei nomi ────────────────────────────

let cacheLibreria: Promise<EsercizioTrovato[]> | null = null;
function libreria(): Promise<EsercizioTrovato[]> {
  cacheLibreria ??= ass.esercizi({}).catch(() => { cacheLibreria = null; return []; });
  return cacheLibreria;
}
export function useLibreria() {
  const [lib, setLib] = useState<EsercizioTrovato[]>([]);
  useEffect(() => { let on = true; libreria().then(l => { if (on) setLib(l); }); return () => { on = false; }; }, []);
  return lib;
}
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
function trova(lib: EsercizioTrovato[], nome: string) {
  const n = norm(nome);
  return n ? lib.find(e => [e.nome, ...e.altriNomi].some(x => norm(x) === n)) : undefined;
}

/** Avvertenza discreta sui contenuti generati. */
export function Avviso({ className }: { className?: string }) {
  return (
    <div className={`ass-disclaimer${className ? ` ${className}` : ''}`}>
      <X.Info size={13} /> <span>Suggerimenti generati da un modello locale: la valutazione resta del professionista.</span>
    </div>
  );
}

// ─── Sola lettura ──────────────────────────────────────────────────────

function Sezione({ titolo, children, conta }: { titolo: string; children: React.ReactNode; conta?: number }) {
  return (
    <section className="ass-sec">
      <h4 className="ass-sec-title">{titolo}{conta !== undefined && <span className="ass-sec-count">{conta}</span>}</h4>
      {children}
    </section>
  );
}

function Elenco({ titolo, voci }: { titolo: string; voci: string[] }) {
  if (!voci.length) return null;
  return <Sezione titolo={titolo}><ul className="ass-list">{voci.map((v, i) => <li key={i}>{v}</li>)}</ul></Sezione>;
}

/** Riquadro evidenziato (avvertenze, cose da verificare con il medico). */
function Richiamo({ titolo, voci }: { titolo: string; voci: string[] }) {
  if (!voci.length) return null;
  return (
    <div className="ass-callout" role="note">
      <X.Avviso size={16} />
      <div>
        <div className="ass-callout-title">{titolo}</div>
        <ul className="ass-list">{voci.map((v, i) => <li key={i}>{v}</li>)}</ul>
      </div>
    </div>
  );
}

function Fonti({ voci }: { voci: string[] }) {
  if (!voci.length) return null;
  return (
    <footer className="ass-sources">
      <div className="ass-sources-title"><X.Libro size={13} /> Fonti</div>
      <ul>{voci.map((v, i) => <li key={i}>{v}</li>)}</ul>
    </footer>
  );
}

function TagLibreria({ e, onApri }: { e: { id: string | null; fuoriLibreria?: boolean }; onApri?: (id: string) => void }) {
  if (e.fuoriLibreria || !e.id) return <span className="tag tag-warning nowrap" title="Esercizio proposto dal modello che non è nella libreria">Fuori libreria</span>;
  return onApri
    ? <button type="button" className="ass-lib-link nowrap" onClick={() => onApri(e.id!)} title="Apri la scheda dell'esercizio">In libreria <X.Freccia size={12} /></button>
    : <span className="tag tag-neutral nowrap">In libreria</span>;
}

function RigaLettura({ e, n, onApri }: { e: EsercizioProgramma; n: number; onApri?: (id: string) => void }) {
  const dose = [e.serie, e.ripetizioni].filter(Boolean).join(' × ');
  return (
    <li className="ass-ex">
      <span className="ass-ex-n" aria-hidden="true">{n}</span>
      <div className="ass-ex-main">
        <div className="ass-ex-name"><strong>{e.nome}</strong> <TagLibreria e={e} onApri={onApri} /></div>
        {e.indicazioni && <div className="ass-ex-text">{e.indicazioni}</div>}
        {e.motivazione && <div className="ass-ex-why">{e.motivazione}</div>}
      </div>
      <div className="ass-ex-dose">
        {dose && <div className="ass-ex-reps" title={e.serie ? 'Serie × ripetizioni o durata' : 'Ripetizioni o durata'}>{dose}</div>}
        {e.recupero && e.recupero !== '—' && <div className="ass-ex-rest"><X.Orologio size={12} /> {e.recupero}</div>}
      </div>
    </li>
  );
}

function VistaProgramma({ p, onApri }: { p: ContenutoProgramma; onApri?: (id: string) => void }) {
  const tot = BLOCCHI.reduce((n, b) => n + p[b].length, 0);
  return (
    <article className="ass-article">
      <header className="ass-article-head">
        {p.titolo !== 'Programma di allenamento' && <div className="ass-article-kicker">Programma di allenamento</div>}
        <h3 className="ass-article-title">{p.titolo}</h3>
        <div className="ass-meta">
          {p.obiettivo && <span>{p.obiettivo}</span>}
          {p.durata && <span><X.Orologio size={13} /> {p.durata}</span>}
          {tot > 0 && <span>{tot} esercizi</span>}
        </div>
      </header>
      {BLOCCHI.map(b => p[b].length > 0 && (
        <Sezione key={b} titolo={BLOCCO_LABEL[b]} conta={p[b].length}>
          <ol className="ass-exlist">{p[b].map((e, i) => <RigaLettura key={i} e={e} n={i + 1} onApri={onApri} />)}</ol>
        </Sezione>
      ))}
      <Richiamo titolo="Avvertenze" voci={p.avvertenze} />
      {p.note && <Sezione titolo="Note"><p className="ass-prose">{p.note}</p></Sezione>}
      <Fonti voci={p.fonti} />
    </article>
  );
}

function VistaAnalisi({ a, onApri }: { a: ContenutoAnalisi; onApri?: (id: string) => void }) {
  return (
    <article className="ass-article">
      <header className="ass-article-head">
        {a.titolo !== 'Analisi della cartella' && <div className="ass-article-kicker">Analisi della cartella</div>}
        <h3 className="ass-article-title">{a.titolo}</h3>
      </header>
      {a.sintesi && <p className="ass-prose ass-lead">{a.sintesi}</p>}
      <Elenco titolo="Punti di attenzione" voci={a.puntiAttenzione} />
      <Elenco titolo="Obiettivi suggeriti" voci={a.obiettiviSuggeriti} />
      {a.eserciziConsigliati.length > 0 && (
        <Sezione titolo="Esercizi consigliati" conta={a.eserciziConsigliati.length}>
          <ol className="ass-exlist">
            {a.eserciziConsigliati.map((e, i) => (
              <li key={i} className="ass-ex">
                <span className="ass-ex-n" aria-hidden="true">{i + 1}</span>
                <div className="ass-ex-main">
                  <div className="ass-ex-name"><strong>{e.nome}</strong> <TagLibreria e={e} onApri={onApri} /></div>
                  {e.motivazione && <div className="ass-ex-text">{e.motivazione}</div>}
                </div>
              </li>
            ))}
          </ol>
        </Sezione>
      )}
      <Richiamo titolo="Da verificare con un medico" voci={a.daVerificareConMedico} />
      {a.note && <Sezione titolo="Note"><p className="ass-prose">{a.note}</p></Sezione>}
      <Fonti voci={a.fonti} />
    </article>
  );
}

export function VistaContenuto({ c, onApri }: { c: Contenuto; onApri?: (id: string) => void }) {
  if (c.tipo === 'programma') return <VistaProgramma p={c} onApri={onApri} />;
  if (c.tipo === 'analisi') return <VistaAnalisi a={c} onApri={onApri} />;
  return (
    <article className="ass-article">
      <header className="ass-article-head"><h3 className="ass-article-title">{c.titolo}</h3></header>
      <p className="ass-prose">{c.testo}</p>
    </article>
  );
}

// ─── Modifica ──────────────────────────────────────────────────────────

const righe = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);

function CampoTesto({ label, value, onChange, area, rows }: { label: string; value: string; onChange: (v: string) => void; area?: boolean; rows?: number }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {area
        ? <textarea id={id} className="input" rows={rows ?? 3} value={value} onChange={e => onChange(e.target.value)} />
        : <input id={id} className="input" value={value} onChange={e => onChange(e.target.value)} />}
    </div>
  );
}

/** Lista modificabile come testo, una voce per riga (conserva le righe vuote mentre si scrive). */
function CampoLista({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join('\n'));
  useEffect(() => { if (righe(text).join('\n') !== value.join('\n')) setText(value.join('\n')); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <CampoTesto label={`${label} (una per riga)`} area value={text} onChange={t => { setText(t); onChange(righe(t)); }} />;
}

function RigaEsercizio({ e, n, tot, lib, listId, onChange, onMove, onRemove }: {
  e: EsercizioProgramma; n: number; tot: number; lib: EsercizioTrovato[]; listId: string;
  onChange: (e: EsercizioProgramma) => void; onMove: (d: -1 | 1) => void; onRemove: () => void;
}) {
  const id = useId();
  const set = (k: keyof EsercizioProgramma) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...e, [k]: ev.target.value });
  const collega = () => {
    const m = trova(lib, e.nome);
    if (m && m.id !== e.id) onChange({ ...e, id: m.id, fuoriLibreria: false });
    else if (!m && e.id && !lib.some(x => x.id === e.id && norm(x.nome) === norm(e.nome))) onChange({ ...e, id: null, fuoriLibreria: true });
  };
  return (
    <div className="ass-ex-edit" role="group" aria-label={`Esercizio ${n + 1}: ${e.nome || 'senza nome'}`}>
      <div className="ass-ex-edit-head">
        <span className="ass-ex-n" aria-hidden="true">{n + 1}</span>
        <div className="field ass-grow">
          <label htmlFor={`${id}-n`} className="sr-only">Esercizio</label>
          <input id={`${id}-n`} className="input ass-ex-edit-name" list={listId} value={e.nome} placeholder="Nome dell'esercizio" onChange={set('nome')} onBlur={collega} />
        </div>
        <TagLibreria e={e} />
        <div className="ass-ex-tools">
          <button type="button" className="btn btn-icon btn-ghost" aria-label="Sposta su" title="Sposta su" disabled={n === 0} onClick={() => onMove(-1)}>↑</button>
          <button type="button" className="btn btn-icon btn-ghost" aria-label="Sposta giù" title="Sposta giù" disabled={n === tot - 1} onClick={() => onMove(1)}>↓</button>
          <button type="button" className="btn btn-icon btn-ghost ass-danger-icon" aria-label="Elimina esercizio" title="Elimina" onClick={onRemove}><I.Trash /></button>
        </div>
      </div>
      <div className="form-3">
        <div className="field"><label htmlFor={`${id}-s`}>Serie</label><input id={`${id}-s`} className="input" value={e.serie} onChange={set('serie')} /></div>
        <div className="field"><label htmlFor={`${id}-r`}>Ripetizioni o durata</label><input id={`${id}-r`} className="input" value={e.ripetizioni} onChange={set('ripetizioni')} /></div>
        <div className="field"><label htmlFor={`${id}-c`}>Recupero</label><input id={`${id}-c`} className="input" value={e.recupero} onChange={set('recupero')} /></div>
      </div>
      <div className="form-2">
        <div className="field"><label htmlFor={`${id}-i`}>Indicazioni</label><textarea id={`${id}-i`} className="input ass-short" value={e.indicazioni} onChange={set('indicazioni')} /></div>
        <div className="field"><label htmlFor={`${id}-m`}>Motivazione</label><textarea id={`${id}-m`} className="input ass-short" value={e.motivazione} onChange={set('motivazione')} /></div>
      </div>
    </div>
  );
}

const nuovoEsercizio = (): EsercizioProgramma => ({ id: null, nome: '', serie: '', ripetizioni: '', recupero: '', indicazioni: '', motivazione: '', fuoriLibreria: true });

function EditorProgramma({ p, onChange }: { p: ContenutoProgramma; onChange: (p: ContenutoProgramma) => void }) {
  const lib = useLibreria();
  const listId = useId();
  const setBlocco = (b: Blocco, list: EsercizioProgramma[]) => onChange({ ...p, [b]: list });
  return (
    <div className="ass-editor">
      <datalist id={listId}>{lib.map(e => <option key={e.id} value={e.nome} />)}</datalist>
      <CampoTesto label="Titolo" value={p.titolo} onChange={v => onChange({ ...p, titolo: v })} />
      <div className="form-2">
        <CampoTesto label="Obiettivo" value={p.obiettivo} onChange={v => onChange({ ...p, obiettivo: v })} />
        <CampoTesto label="Durata" value={p.durata} onChange={v => onChange({ ...p, durata: v })} />
      </div>
      {BLOCCHI.map(b => (
        <section key={b} className="ass-sec">
          <h4 className="ass-sec-title">{BLOCCO_LABEL[b]}<span className="ass-sec-count">{p[b].length}</span></h4>
          <div className="ass-ex-edits">
            {p[b].map((e, i) => (
              <RigaEsercizio key={i} e={e} n={i} tot={p[b].length} lib={lib} listId={listId}
                onChange={x => setBlocco(b, p[b].map((y, k) => (k === i ? x : y)))}
                onMove={d => { const l = [...p[b]]; [l[i], l[i + d]] = [l[i + d], l[i]]; setBlocco(b, l); }}
                onRemove={() => setBlocco(b, p[b].filter((_, k) => k !== i))} />
            ))}
          </div>
          <div><button type="button" className="btn btn-ghost" onClick={() => setBlocco(b, [...p[b], nuovoEsercizio()])}><I.Plus /> Aggiungi esercizio</button></div>
        </section>
      ))}
      <CampoLista label="Avvertenze" value={p.avvertenze} onChange={v => onChange({ ...p, avvertenze: v })} />
      <CampoTesto label="Note dell'istruttore" area value={p.note} onChange={v => onChange({ ...p, note: v })} />
      <CampoLista label="Fonti" value={p.fonti} onChange={v => onChange({ ...p, fonti: v })} />
    </div>
  );
}

function EditorAnalisi({ a, onChange }: { a: ContenutoAnalisi; onChange: (a: ContenutoAnalisi) => void }) {
  const lib = useLibreria();
  const setEs = (i: number, e: EsercizioConsigliato) => onChange({ ...a, eserciziConsigliati: a.eserciziConsigliati.map((x, k) => (k === i ? e : x)) });
  return (
    <div className="ass-editor">
      <CampoTesto label="Titolo" value={a.titolo} onChange={v => onChange({ ...a, titolo: v })} />
      <CampoTesto label="Sintesi" area rows={5} value={a.sintesi} onChange={v => onChange({ ...a, sintesi: v })} />
      <CampoLista label="Punti di attenzione" value={a.puntiAttenzione} onChange={v => onChange({ ...a, puntiAttenzione: v })} />
      <CampoLista label="Obiettivi suggeriti" value={a.obiettiviSuggeriti} onChange={v => onChange({ ...a, obiettiviSuggeriti: v })} />
      <section className="ass-sec">
        <h4 className="ass-sec-title">Esercizi consigliati</h4>
        {a.eserciziConsigliati.map((e, i) => (
          <div key={i} className="ass-ex-mini">
            <input className="input" aria-label="Esercizio" value={e.nome} onChange={ev => setEs(i, { ...e, nome: ev.target.value })}
              onBlur={() => { const m = trova(lib, e.nome); setEs(i, m ? { ...e, id: m.id, fuoriLibreria: false } : { ...e, id: null, fuoriLibreria: true }); }} />
            <input className="input" aria-label="Motivazione" value={e.motivazione} onChange={ev => setEs(i, { ...e, motivazione: ev.target.value })} />
            <button type="button" className="btn btn-icon btn-ghost ass-danger-icon" aria-label="Elimina esercizio" onClick={() => onChange({ ...a, eserciziConsigliati: a.eserciziConsigliati.filter((_, k) => k !== i) })}><I.Trash /></button>
          </div>
        ))}
        <div><button type="button" className="btn btn-ghost" onClick={() => onChange({ ...a, eserciziConsigliati: [...a.eserciziConsigliati, { id: null, nome: '', motivazione: '', fuoriLibreria: true }] })}><I.Plus /> Aggiungi esercizio</button></div>
      </section>
      <CampoLista label="Da verificare con un medico" value={a.daVerificareConMedico} onChange={v => onChange({ ...a, daVerificareConMedico: v })} />
      <CampoTesto label="Note dell'istruttore" area value={a.note} onChange={v => onChange({ ...a, note: v })} />
      <CampoLista label="Fonti" value={a.fonti} onChange={v => onChange({ ...a, fonti: v })} />
    </div>
  );
}

export function EditorContenuto({ c, onChange }: { c: Contenuto; onChange: (c: Contenuto) => void }) {
  if (c.tipo === 'programma') return <EditorProgramma p={c} onChange={onChange} />;
  if (c.tipo === 'analisi') return <EditorAnalisi a={c} onChange={onChange} />;
  return (
    <div className="ass-editor">
      <CampoTesto label="Titolo" value={c.titolo} onChange={v => onChange({ ...c, titolo: v })} />
      <CampoTesto label="Testo" area rows={12} value={c.testo} onChange={v => onChange({ ...c, testo: v })} />
    </div>
  );
}

// ─── Stampa ────────────────────────────────────────────────────────────

/** Vista stampabile: montata sul body, stampa e si chiude da sola. */
export function Stampa({ c, iscritto, data, onDone }: { c: Contenuto; iscritto: string | null; data: string; onDone: () => void }) {
  useEffect(() => {
    document.body.classList.add('ass-printing');
    const done = () => onDone();
    window.addEventListener('afterprint', done);
    const t = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('ass-printing');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div className="ass-print">
      <div className="ass-print-head">
        <div>
          <div className="ass-print-kicker">FitFlow · {c.tipo === 'programma' ? 'Programma di allenamento' : c.tipo === 'analisi' ? 'Analisi della cartella' : 'Nota'}</div>
          {iscritto && <div className="ass-print-name">{iscritto}</div>}
        </div>
        <div className="ass-print-date">{data}</div>
      </div>
      <VistaContenuto c={c} />
      <div className="ass-print-foot">Bozza preparata con un assistente AI locale e rivista dall'istruttore.</div>
    </div>,
    document.body,
  );
}
