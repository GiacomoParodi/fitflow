import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  normalizzaAnalisi, normalizzaProgramma, parseJsonTollerante,
  type Agente, type Contenuto, type InputGenerazione,
} from '../../../shared/assistente';
import { ATTREZZI } from '../../../shared/esercizi';
import { LIVELLI } from '../../../shared/types';
import { todayISO, fmt } from '../../../shared/dates';
import * as I from '../../icons';
import { useApp } from '../../store';
import { ass, avvisaCambio, generaStream, messaggio } from './api';
import { EditorContenuto, Stampa, VistaContenuto } from './Contenuto';
import { SchedaEsercizio } from './Libreria';
import { useAgenti, useDati } from './hooks';

const OBIETTIVI = ['Tonificazione generale', 'Mobilità e postura', 'Forza degli arti inferiori', 'Core e stabilità', 'Resistenza cardiovascolare', 'Equilibrio e prevenzione cadute', 'Schiena: lombalgia aspecifica'];

interface Uscita {
  stato: 'in_corso' | 'fatto' | 'errore' | 'interrotto';
  testo: string;
  ragionamento: boolean;
  fonti: string[];
  modello: string;
  tagliati: number;
  contenuto: Contenuto | null;
  avvisi: string[];
  errore: string;
}

/** Anteprima mentre il testo arriva: JSON parziale → programma/analisi. */
function anteprima(testo: string, compito: Agente['compito']): Contenuto | null {
  if (compito === 'libero') return testo.trim() ? { tipo: 'nota', titolo: 'Risposta', testo } : null;
  const parsed = parseJsonTollerante(testo);
  if (!parsed) return null;
  const c = compito === 'analizza_cartella' ? normalizzaAnalisi(parsed) : normalizzaProgramma(parsed);
  return c;
}

/** Parte comune a "Genera" e "Analizza cartella": esegue in streaming e mostra/modifica/salva il risultato. */
export function useGenerazione() {
  const [out, setOut] = useState<Uscita | null>(null);
  const ac = useRef<AbortController | null>(null);
  useEffect(() => () => ac.current?.abort(), []);

  const avvia = async (input: InputGenerazione) => {
    ac.current?.abort();
    const ctl = new AbortController();
    ac.current = ctl;
    setOut({ stato: 'in_corso', testo: '', ragionamento: false, fonti: [], modello: '', tagliati: 0, contenuto: null, avvisi: [], errore: '' });
    try {
      await generaStream(input, e => {
        setOut(o => {
          if (!o) return o;
          switch (e.tipo) {
            case 'contesto': return { ...o, fonti: e.fonti, modello: e.modello, tagliati: e.tagliati };
            case 'testo': return { ...o, testo: o.testo + e.delta, ragionamento: false };
            case 'ragionamento': return { ...o, ragionamento: true };
            case 'risultato': return { ...o, stato: 'fatto', contenuto: e.contenuto, avvisi: e.avvisi };
            case 'errore': return { ...o, stato: 'errore', errore: e.messaggio };
            default: return o;
          }
        });
      }, ctl.signal);
      setOut(o => (o && o.stato === 'in_corso' ? { ...o, stato: 'errore', errore: 'La risposta si è interrotta.' } : o));
    } catch (e) {
      setOut(o => o && (ctl.signal.aborted ? { ...o, stato: 'interrotto' } : { ...o, stato: 'errore', errore: messaggio(e) }));
    }
  };
  const interrompi = () => ac.current?.abort();
  return { out, setOut, avvia, interrompi };
}

/** Pannello del risultato: streaming, avvisi, modifica, salvataggio, stampa. */
export function Risultato({ out, compito, iscritto, input, agente, onContenuto, onSalvato, onInterrompi, extra }: {
  out: Uscita; compito: Agente['compito']; iscritto: { id: number; name: string } | null; input: Partial<InputGenerazione>; agente: Agente | null;
  onContenuto: (c: Contenuto) => void; onSalvato?: () => void; onInterrompi: () => void; extra?: React.ReactNode;
}) {
  const { notify } = useApp();
  const [modifica, setModifica] = useState(false);
  const [salvatoId, setSalvatoId] = useState<number | null>(null);
  const [stampa, setStampa] = useState(false);
  const [scheda, setScheda] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (out.stato === 'in_corso') { setSalvatoId(null); setModifica(false); } }, [out.stato]);

  const live = useMemo(() => (out.stato === 'in_corso' ? anteprima(out.testo, compito) : null), [out.testo, out.stato, compito]);
  const c = out.contenuto;

  const salva = async () => {
    if (!c) return;
    setSalvando(true);
    try {
      if (salvatoId) await ass.salvaProgramma(salvatoId, { contenuto: c });
      else {
        const p = await ass.creaProgramma({ partecipanteId: iscritto?.id ?? null, agenteId: agente?.id ?? null, contenuto: c, input });
        setSalvatoId(p.id);
      }
      avvisaCambio('programmi');
      notify(salvatoId ? 'Modifiche salvate.' : 'Salvato tra i programmi (bozza).');
      setModifica(false);
      onSalvato?.();
    } catch (e) {
      notify(messaggio(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="ass-output" aria-busy={out.stato === 'in_corso'}>
      <div className="ass-row ass-output-head">
        <div className="ass-small" role="status" aria-live="polite">
          {out.stato === 'in_corso' && <><span className="ass-pulse" aria-hidden="true" /> {out.ragionamento ? 'Il modello sta ragionando…' : out.testo ? 'Sta scrivendo…' : 'Preparo il contesto…'}</>}
          {out.stato === 'fatto' && (salvatoId ? 'Salvato tra i programmi' : 'Bozza pronta: rivedila prima di usarla')}
          {out.stato === 'interrotto' && 'Interrotto.'}
          {out.stato === 'errore' && 'Non completato.'}
          {out.modello && <span className="text-muted"> · {out.modello}</span>}
        </div>
        <div className="btn-row">
          {out.stato === 'in_corso' && <button type="button" className="btn btn-secondary" onClick={onInterrompi}><I.X /> Interrompi</button>}
          {out.stato === 'fatto' && c && (
            <>
              <button type="button" className="btn btn-secondary" aria-pressed={modifica} onClick={() => setModifica(m => !m)}>{modifica ? 'Anteprima' : 'Modifica'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setStampa(true)}>Stampa</button>
              <button type="button" className="btn btn-primary" onClick={salva} disabled={salvando}>{salvatoId ? 'Salva modifiche' : 'Salva'}</button>
            </>
          )}
        </div>
      </div>
      {out.fonti.length > 0 && <div className="text-muted ass-small">Fonti nel contesto: {out.fonti.join(' · ')}</div>}
      {out.errore && <div className="error-box" role="alert">{out.errore}</div>}
      {out.avvisi.length > 0 && (
        <div className="ass-callout" role="note">
          <ul className="ass-list">{out.avvisi.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}
      {extra}
      <div className="ass-output-body">
        {c ? (modifica ? <EditorContenuto c={c} onChange={onContenuto} /> : <VistaContenuto c={c} onApri={setScheda} />)
          : live ? <div className="ass-live"><VistaContenuto c={live} /></div>
            : out.testo ? <pre className="ass-raw">{out.testo}</pre>
              : out.stato === 'in_corso' ? <div className="text-muted ass-small">Con un modello locale la prima risposta può richiedere qualche decina di secondi.</div> : null}
      </div>
      {stampa && c && <Stampa c={c} iscritto={iscritto?.name ?? null} data={fmt(todayISO())} onDone={() => setStampa(false)} />}
      {scheda && <SchedaEsercizio id={scheda} onClose={() => setScheda(null)} />}
    </div>
  );
}

function iscrittoDaHash(): number | null {
  const m = window.location.hash.match(/[?&]iscritto=(\d+)/);
  return m ? Number(m[1]) : null;
}

export function Genera() {
  const { people } = useApp();
  const { data: agenti } = useAgenti();
  const usabili = (agenti ?? []).filter(a => a.compito !== 'analizza_cartella');
  const [agenteId, setAgenteId] = useState<number | null>(null);
  const agente = usabili.find(a => a.id === agenteId) ?? usabili[0] ?? null;
  const [pid, setPid] = useState<number | null>(() => { const n = iscrittoDaHash(); return n && people.some(p => p.id === n) ? n : null; });
  const persona = people.find(p => p.id === pid) ?? null;
  const [f, setF] = useState({ obiettivo: '', durata: '45 minuti', livello: persona?.livello ?? 'Base', limitazioni: '', note: '' });
  const [attrezzi, setAttrezzi] = useState<string[]>([]);
  const [docs, setDocs] = useState<number[]>([]);
  const [errore, setErrore] = useState('');
  const g = useGenerazione();
  const id = useId();
  const docGen = useDati(() => ass.documenti('generale'), [], ['documenti']);
  const docPers = useDati(() => (pid ? ass.documenti(pid) : Promise.resolve([])), [pid], ['documenti']);
  const disponibili = [...(docPers.data ?? []), ...(docGen.data ?? []).filter(d => d.origine === 'caricato')].filter(d => d.stato === 'pronto');

  useEffect(() => { if (persona) setF(x => ({ ...x, livello: persona.livello })); }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  const compito = agente?.compito ?? 'genera_programma';
  const input: InputGenerazione = {
    agenteId: agente?.id ?? 0, partecipanteId: pid, obiettivo: f.obiettivo, durata: f.durata, attrezzi,
    livello: f.livello, limitazioni: f.limitazioni, note: f.note, documentiIds: docs,
  };
  const avvia = () => {
    setErrore('');
    if (!agente) return setErrore('Nessun agente disponibile: creane uno in Impostazioni → Agenti.');
    if (compito === 'genera_programma' && !f.obiettivo.trim()) return setErrore('Indica l\'obiettivo della seduta.');
    if (compito === 'libero' && !f.note.trim()) return setErrore('Scrivi la domanda.');
    void g.avvia(input);
  };
  const toggle = (a: string) => setAttrezzi(l => (l.includes(a) ? l.filter(x => x !== a) : [...l, a]));

  return (
    <div className="ass-genera">
      <form className="ass-form ass-stack" onSubmit={e => { e.preventDefault(); avvia(); }} aria-label="Richiesta all'assistente">
        <div className="form-2">
          <div className="field">
            <label htmlFor={`${id}-p`}>Iscritto (facoltativo)</label>
            <select id={`${id}-p`} className="input" value={pid ?? ''} onChange={e => { setPid(e.target.value ? Number(e.target.value) : null); setDocs([]); }}>
              <option value="">Nessuno: seduta generica</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${id}-a`}>Agente</label>
            <select id={`${id}-a`} className="input" value={agente?.id ?? ''} onChange={e => setAgenteId(Number(e.target.value))}>
              {usabili.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
        </div>
        {compito !== 'libero' ? (
          <>
            <div className="form-2">
              <div className="field">
                <label htmlFor={`${id}-o`}>Obiettivo</label>
                <input id={`${id}-o`} className="input" list={`${id}-ol`} value={f.obiettivo} onChange={e => setF({ ...f, obiettivo: e.target.value })} placeholder="Es. mobilità e postura" />
                <datalist id={`${id}-ol`}>{OBIETTIVI.map(o => <option key={o} value={o} />)}</datalist>
              </div>
              <div className="field">
                <label htmlFor={`${id}-d`}>Durata</label>
                <select id={`${id}-d`} className="input" value={f.durata} onChange={e => setF({ ...f, durata: e.target.value })}>
                  {['30 minuti', '45 minuti', '60 minuti', '75 minuti', '90 minuti'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label id={`${id}-l`}>Livello</label>
              <div className="seg" role="group" aria-labelledby={`${id}-l`}>
                {LIVELLI.map(l => <button key={l} type="button" className="seg-opt" aria-pressed={f.livello === l} onClick={() => setF({ ...f, livello: l })}>{l}</button>)}
              </div>
            </div>
            <fieldset className="ass-fieldset">
              <legend className="ass-legend">Attrezzi disponibili <span className="text-muted">— nessuno = solo corpo libero (il tappetino si dà per scontato)</span></legend>
              <div className="ass-chips">
                {ATTREZZI.filter(a => a !== 'tappetino').map(a => <button key={a} type="button" className="ass-chip" aria-pressed={attrezzi.includes(a)} onClick={() => toggle(a)}>{a}</button>)}
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor={`${id}-lim`}>Limitazioni o problemi</label>
              <textarea id={`${id}-lim`} className="input ass-short" value={f.limitazioni} onChange={e => setF({ ...f, limitazioni: e.target.value })} placeholder="Es. fastidio al ginocchio destro, evitare salti" />
            </div>
          </>
        ) : null}
        <div className="field">
          <label htmlFor={`${id}-n`}>{compito === 'libero' ? 'Domanda' : 'Note'}</label>
          <textarea id={`${id}-n`} className="input ass-short" value={f.note} onChange={e => setF({ ...f, note: e.target.value })}
            placeholder={compito === 'libero' ? 'Es. Come adatto il plank per chi ha mal di schiena?' : 'Es. lezione di gruppo, spazio ridotto'} />
        </div>
        {disponibili.length > 0 && (
          <details className="ass-details">
            <summary>Documenti da considerare {docs.length > 0 && <span className="tag tag-accent">{docs.length}</span>}</summary>
            <div className="ass-stack-sm">
              {disponibili.map(d => (
                <label key={d.id} className="ass-check">
                  <input type="checkbox" checked={docs.includes(d.id)} onChange={e => setDocs(l => (e.target.checked ? [...l, d.id] : l.filter(x => x !== d.id)))} />
                  <span>{d.titolo} <span className="text-muted">— {d.partecipanteId ? 'cartella' : 'libreria'}</span></span>
                </label>
              ))}
              <div className="text-muted ass-small">Anche senza selezione l'assistente cerca i passaggi pertinenti nelle fonti dell'agente.</div>
            </div>
          </details>
        )}
        {errore && <div className="error-box" role="alert">{errore}</div>}
        <div className="btn-row-8">
          <button type="submit" className="btn btn-primary" disabled={g.out?.stato === 'in_corso'}>
            {compito === 'libero' ? 'Chiedi' : g.out?.contenuto ? 'Genera di nuovo' : 'Genera programma'}
          </button>
        </div>
      </form>
      <div className="ass-result">
        {g.out
          ? <Risultato out={g.out} compito={compito} iscritto={persona} input={input} agente={agente} onInterrompi={g.interrompi}
              onContenuto={c => g.setOut(o => o && { ...o, contenuto: c })} />
          : (
            <div className="ass-empty text-muted">
              <div className="label">Risultato</div>
              <p>Compila la richiesta e premi <strong>Genera programma</strong>: la proposta comparirà qui mentre il modello la scrive, poi potrai modificarla, salvarla e stamparla.</p>
            </div>
          )}
      </div>
    </div>
  );
}
