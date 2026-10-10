import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BLOCCHI, BLOCCO_LABEL,
  type Blocco, type Contenuto, type ContenutoAnalisi, type ContenutoProgramma, type EsercizioConsigliato, type EsercizioProgramma,
} from '../../../shared/assistente';
import * as I from '../../icons';
import { ass, type EsercizioTrovato } from './api';

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

// ─── Sola lettura ──────────────────────────────────────────────────────

function Elenco({ titolo, voci, evidenzia }: { titolo: string; voci: string[]; evidenzia?: boolean }) {
  if (!voci.length) return null;
  return (
    <div className={evidenzia ? 'ass-callout' : undefined}>
      <div className="label text-muted ass-sub">{titolo}</div>
      <ul className="ass-list">{voci.map((v, i) => <li key={i}>{v}</li>)}</ul>
    </div>
  );
}

function TagLibreria({ e, onApri }: { e: { id: string | null; fuoriLibreria?: boolean }; onApri?: (id: string) => void }) {
  if (e.fuoriLibreria || !e.id) return <span className="tag tag-outline nowrap" title="Esercizio proposto dal modello che non è nella libreria">fuori libreria</span>;
  return onApri
    ? <button type="button" className="tag tag-neutral nowrap ass-tag-btn" onClick={() => onApri(e.id!)} title="Apri la scheda dell'esercizio">libreria</button>
    : <span className="tag tag-neutral nowrap">libreria</span>;
}

function TabellaEsercizi({ esercizi, onApri }: { esercizi: EsercizioProgramma[]; onApri?: (id: string) => void }) {
  return (
    <div className="scroll-x">
      <table className="table ass-ex-table">
        <thead><tr><th>Esercizio</th><th>Serie</th><th>Rip. / durata</th><th>Recupero</th><th>Indicazioni</th></tr></thead>
        <tbody>
          {esercizi.map((e, i) => (
            <tr key={i}>
              <td>
                <div className="cell-inline ass-wrap"><strong>{e.nome}</strong> <TagLibreria e={e} onApri={onApri} /></div>
                {e.motivazione && <div className="text-muted ass-small">{e.motivazione}</div>}
              </td>
              <td className="nowrap">{e.serie}</td>
              <td className="nowrap">{e.ripetizioni}</td>
              <td className="nowrap">{e.recupero}</td>
              <td className="ass-small">{e.indicazioni}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VistaProgramma({ p, onApri }: { p: ContenutoProgramma; onApri?: (id: string) => void }) {
  return (
    <div className="ass-stack">
      <div>
        <h4 className="ass-title">{p.titolo}</h4>
        <div className="text-muted ass-small">{[p.obiettivo, p.durata].filter(Boolean).join(' · ')}</div>
      </div>
      {BLOCCHI.map(b => p[b].length > 0 && (
        <section key={b}>
          <div className="label text-muted ass-sub">{BLOCCO_LABEL[b]}</div>
          <TabellaEsercizi esercizi={p[b]} onApri={onApri} />
        </section>
      ))}
      <Elenco titolo="Avvertenze" voci={p.avvertenze} evidenzia />
      {p.note && <div><div className="label text-muted ass-sub">Note</div><div className="note-text">{p.note}</div></div>}
      <Elenco titolo="Fonti" voci={p.fonti} />
    </div>
  );
}

function VistaAnalisi({ a, onApri }: { a: ContenutoAnalisi; onApri?: (id: string) => void }) {
  return (
    <div className="ass-stack">
      <h4 className="ass-title">{a.titolo}</h4>
      {a.sintesi && <div><div className="label text-muted ass-sub">Sintesi</div><div className="note-text">{a.sintesi}</div></div>}
      <Elenco titolo="Punti di attenzione" voci={a.puntiAttenzione} />
      <Elenco titolo="Obiettivi suggeriti" voci={a.obiettiviSuggeriti} />
      {a.eserciziConsigliati.length > 0 && (
        <div>
          <div className="label text-muted ass-sub">Esercizi consigliati</div>
          <ul className="ass-list">
            {a.eserciziConsigliati.map((e, i) => (
              <li key={i}><strong>{e.nome}</strong> <TagLibreria e={e} onApri={onApri} />{e.motivazione && <> — {e.motivazione}</>}</li>
            ))}
          </ul>
        </div>
      )}
      <Elenco titolo="Da verificare con un medico" voci={a.daVerificareConMedico} evidenzia />
      {a.note && <div><div className="label text-muted ass-sub">Note</div><div className="note-text">{a.note}</div></div>}
      <Elenco titolo="Fonti" voci={a.fonti} />
    </div>
  );
}

export function VistaContenuto({ c, onApri }: { c: Contenuto; onApri?: (id: string) => void }) {
  if (c.tipo === 'programma') return <VistaProgramma p={c} onApri={onApri} />;
  if (c.tipo === 'analisi') return <VistaAnalisi a={c} onApri={onApri} />;
  return <div className="ass-stack"><h4 className="ass-title">{c.titolo}</h4><div className="note-text">{c.testo}</div></div>;
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
        <div className="field ass-grow">
          <label htmlFor={`${id}-n`}>Esercizio</label>
          <input id={`${id}-n`} className="input" list={listId} value={e.nome} onChange={set('nome')} onBlur={collega} />
        </div>
        <div className="ass-ex-edit-tag"><TagLibreria e={e} /></div>
        <div className="btn-row">
          <button type="button" className="btn btn-icon btn-secondary" aria-label="Sposta su" disabled={n === 0} onClick={() => onMove(-1)}>↑</button>
          <button type="button" className="btn btn-icon btn-secondary" aria-label="Sposta giù" disabled={n === tot - 1} onClick={() => onMove(1)}>↓</button>
          <button type="button" className="btn btn-icon btn-secondary" aria-label="Elimina esercizio" onClick={onRemove}><I.Trash /></button>
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
    <div className="ass-stack">
      <datalist id={listId}>{lib.map(e => <option key={e.id} value={e.nome} />)}</datalist>
      <CampoTesto label="Titolo" value={p.titolo} onChange={v => onChange({ ...p, titolo: v })} />
      <div className="form-2">
        <CampoTesto label="Obiettivo" value={p.obiettivo} onChange={v => onChange({ ...p, obiettivo: v })} />
        <CampoTesto label="Durata" value={p.durata} onChange={v => onChange({ ...p, durata: v })} />
      </div>
      {BLOCCHI.map(b => (
        <section key={b} className="ass-stack-sm">
          <div className="label text-muted">{BLOCCO_LABEL[b]}</div>
          {p[b].map((e, i) => (
            <RigaEsercizio key={i} e={e} n={i} tot={p[b].length} lib={lib} listId={listId}
              onChange={x => setBlocco(b, p[b].map((y, k) => (k === i ? x : y)))}
              onMove={d => { const l = [...p[b]]; [l[i], l[i + d]] = [l[i + d], l[i]]; setBlocco(b, l); }}
              onRemove={() => setBlocco(b, p[b].filter((_, k) => k !== i))} />
          ))}
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
    <div className="ass-stack">
      <CampoTesto label="Titolo" value={a.titolo} onChange={v => onChange({ ...a, titolo: v })} />
      <CampoTesto label="Sintesi" area rows={5} value={a.sintesi} onChange={v => onChange({ ...a, sintesi: v })} />
      <CampoLista label="Punti di attenzione" value={a.puntiAttenzione} onChange={v => onChange({ ...a, puntiAttenzione: v })} />
      <CampoLista label="Obiettivi suggeriti" value={a.obiettiviSuggeriti} onChange={v => onChange({ ...a, obiettiviSuggeriti: v })} />
      <div className="ass-stack-sm">
        <div className="label text-muted">Esercizi consigliati</div>
        {a.eserciziConsigliati.map((e, i) => (
          <div key={i} className="ass-ex-mini">
            <input className="input" aria-label="Esercizio" value={e.nome} onChange={ev => setEs(i, { ...e, nome: ev.target.value })}
              onBlur={() => { const m = trova(lib, e.nome); setEs(i, m ? { ...e, id: m.id, fuoriLibreria: false } : { ...e, id: null, fuoriLibreria: true }); }} />
            <input className="input" aria-label="Motivazione" value={e.motivazione} onChange={ev => setEs(i, { ...e, motivazione: ev.target.value })} />
            <button type="button" className="btn btn-icon btn-secondary" aria-label="Elimina esercizio" onClick={() => onChange({ ...a, eserciziConsigliati: a.eserciziConsigliati.filter((_, k) => k !== i) })}><I.Trash /></button>
          </div>
        ))}
        <div><button type="button" className="btn btn-ghost" onClick={() => onChange({ ...a, eserciziConsigliati: [...a.eserciziConsigliati, { id: null, nome: '', motivazione: '', fuoriLibreria: true }] })}><I.Plus /> Aggiungi esercizio</button></div>
      </div>
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
    <div className="ass-stack">
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
          <div className="kicker">FitFlow · {c.tipo === 'programma' ? 'Programma di allenamento' : c.tipo === 'analisi' ? 'Analisi della cartella' : 'Nota'}</div>
          {iscritto && <div className="ass-print-name">{iscritto}</div>}
        </div>
        <div className="ass-small">{data}</div>
      </div>
      <VistaContenuto c={c} />
      <div className="ass-print-foot text-muted">Bozza preparata con un assistente AI locale e rivista dall'istruttore.</div>
    </div>,
    document.body,
  );
}
