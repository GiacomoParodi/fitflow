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
import * as X from './icone';

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
export function Risultato({ out, compito, iscritto, input, agente, onContenuto, onSalvato, onInterrompi, onRigenera, extra }: {
  out: Uscita; compito: Agente['compito']; iscritto: { id: number; name: string } | null; input: Partial<InputGenerazione>; agente: Agente | null;
  onContenuto: (c: Contenuto) => void; onSalvato?: () => void; onInterrompi: () => void; onRigenera?: () => void; extra?: React.ReactNode;
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
  const busy = out.stato === 'in_corso';

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
    <div className="ass-doc" data-busy={busy} aria-busy={busy}>
      <div className="ass-doc-bar">
        <div className="ass-doc-status" role="status" aria-live="polite">
          {busy && <><span className="ass-pulse" aria-hidden="true" />{out.ragionamento ? 'Il modello sta ragionando…' : out.testo ? 'Sta scrivendo…' : 'Preparo il contesto…'}</>}
          {out.stato === 'fatto' && (salvatoId
            ? <><span className="ass-dot" data-stato="ok" aria-hidden="true" />Salvato tra i programmi</>
            : <><span className="ass-dot" data-stato="accento" aria-hidden="true" />Bozza pronta: rivedila prima di usarla</>)}
          {out.stato === 'interrotto' && <><span className="ass-dot" data-stato="spento" aria-hidden="true" />Interrotto</>}
          {out.stato === 'errore' && <><span className="ass-dot" data-stato="errore" aria-hidden="true" />Non completato</>}
        </div>
        <div className="ass-doc-actions">
          {busy && <button type="button" className="btn btn-secondary" onClick={onInterrompi}><I.X /> Interrompi</button>}
          {!busy && onRigenera && (out.stato !== 'fatto' || c) && (
            <button type="button" className="btn btn-ghost" onClick={onRigenera} title="Genera una nuova proposta con la stessa richiesta"><X.Rigenera size={15} /> Rigenera</button>
          )}
          {out.stato === 'fatto' && c && (
            <>
              <button type="button" className="btn btn-secondary" aria-pressed={modifica} onClick={() => setModifica(m => !m)}>
                {modifica ? <><X.Occhio size={15} /> Anteprima</> : <><X.Matita size={15} /> Modifica</>}
              </button>
              <button type="button" className="btn btn-secondary btn-icon" onClick={() => setStampa(true)} aria-label="Stampa" title="Stampa"><X.Stampante size={16} /></button>
              <button type="button" className="btn btn-primary" onClick={salva} disabled={salvando}>{salvatoId ? 'Salva modifiche' : 'Salva'}</button>
            </>
          )}
        </div>
      </div>
      <div className="ass-doc-body">
        {(out.fonti.length > 0 || out.modello) && (
          <div className="ass-context"><X.Libro size={13} /><span>
            {out.modello && <>Modello <span className="ass-doc-model">{out.modello}</span>{out.fonti.length > 0 && ' · '}</>}
            {out.fonti.length > 0 && <>Contesto: {out.fonti.join(' · ')}{out.tagliati > 0 ? ` · ${out.tagliati} estratti esclusi per spazio` : ''}</>}
          </span></div>
        )}
        {out.errore && <div className="error-box" role="alert">{out.errore}</div>}
        {out.avvisi.length > 0 && (
          <div className="ass-callout" role="note">
            <X.Avviso size={16} />
            <ul className="ass-list">{out.avvisi.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </div>
        )}
        {extra}
        {c ? (modifica ? <EditorContenuto c={c} onChange={onContenuto} /> : <VistaContenuto c={c} onApri={setScheda} />)
          : live ? <div className="ass-live"><VistaContenuto c={live} /></div>
            : out.testo ? <pre className="ass-raw">{out.testo}</pre>
              : busy ? (
                <div className="ass-skeleton" aria-hidden="true">
                  <div className="ass-sk ass-sk-title" /><div className="ass-sk" style={{ width: '45%' }} />
                  <div className="ass-sk-gap" />
                  <div className="ass-sk" /><div className="ass-sk" style={{ width: '88%' }} /><div className="ass-sk" style={{ width: '72%' }} />
                  <div className="ass-sk-hint">Con un modello locale la prima risposta può richiedere qualche decina di secondi.</div>
                </div>
              ) : null}
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

const DURATE = ['30 minuti', '45 minuti', '60 minuti', '75 minuti', '90 minuti'];

/** Stato vuoto dell'area risultato. */
function RisultatoVuoto({ libero }: { libero: boolean }) {
  return (
    <div className="ass-doc ass-doc-empty">
      <div className="ass-empty-icon" aria-hidden="true"><X.Scintille size={28} /></div>
      <h3 className="ass-empty-title">{libero ? 'La risposta comparirà qui' : 'Il programma comparirà qui'}</h3>
      <p className="ass-empty-text">
        {libero ? 'Scrivi la domanda e premi Chiedi: la risposta arriva mentre il modello la scrive.'
          : 'Descrivi la seduta a sinistra e premi Genera programma: la proposta arriva mentre il modello la scrive.'}
      </p>
      {!libero && (
        <ol className="ass-empty-steps">
          <li><span className="ass-step-n">1</span><span><strong>Descrivi</strong> obiettivo, durata, attrezzi e limitazioni</span></li>
          <li><span className="ass-step-n">2</span><span><strong>Genera</strong> una bozza con riscaldamento, parte centrale e defaticamento</span></li>
          <li><span className="ass-step-n">3</span><span><strong>Rivedi</strong>, modifica, salva o stampa</span></li>
        </ol>
      )}
    </div>
  );
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
  const libero = compito === 'libero';

  return (
    <div className="ass-genera">
      <form className="card ass-form" onSubmit={e => { e.preventDefault(); avvia(); }} aria-label="Richiesta all'assistente">
        <div className="ass-form-head">
          <h2 className="card-title">{libero ? 'Domanda' : 'Nuova seduta'}</h2>
          <div className="card-sub">{libero ? 'Chiedi un consiglio all\'assistente.' : 'Descrivi la lezione: l\'assistente propone una bozza da rivedere.'}</div>
        </div>
        <div className="field">
          <label htmlFor={`${id}-p`}>Iscritto</label>
          <select id={`${id}-p`} className="input" value={pid ?? ''} onChange={e => { setPid(e.target.value ? Number(e.target.value) : null); setDocs([]); }}>
            <option value="">Nessuno: seduta generica</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {!libero && (
          <>
            <div className="field">
              <label htmlFor={`${id}-o`}>Obiettivo</label>
              <input id={`${id}-o`} className="input" list={`${id}-ol`} value={f.obiettivo} onChange={e => setF({ ...f, obiettivo: e.target.value })} placeholder="Es. mobilità e postura" />
              <datalist id={`${id}-ol`}>{OBIETTIVI.map(o => <option key={o} value={o} />)}</datalist>
            </div>
            <div className="ass-form-pair">
              <div className="field">
                <span className="field-label" id={`${id}-d`}>Durata</span>
                <div className="seg ass-seg-fill" role="group" aria-labelledby={`${id}-d`}>
                  {DURATE.map(d => (
                    <button key={d} type="button" className="seg-opt" aria-pressed={f.durata === d} aria-label={d} onClick={() => setF({ ...f, durata: d })}>
                      {d.replace(' minuti', '′')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="field-label" id={`${id}-l`}>Livello</span>
                <div className="seg ass-seg-fill" role="group" aria-labelledby={`${id}-l`}>
                  {LIVELLI.map(l => <button key={l} type="button" className="seg-opt" aria-pressed={f.livello === l} onClick={() => setF({ ...f, livello: l })}>{l}</button>)}
                </div>
              </div>
            </div>
            <fieldset className="ass-fieldset">
              <legend className="field-label">Attrezzi disponibili</legend>
              <div className="ass-chips">
                {ATTREZZI.filter(a => a !== 'tappetino').map(a => <button key={a} type="button" className="chip" aria-pressed={attrezzi.includes(a)} onClick={() => toggle(a)}>{a}</button>)}
              </div>
              <div className="ass-help">{attrezzi.length ? `${attrezzi.length} selezionati · il tappetino si dà per scontato` : 'Nessuno = solo corpo libero (il tappetino si dà per scontato).'}</div>
            </fieldset>
            <div className="field">
              <label htmlFor={`${id}-lim`}>Limitazioni o problemi</label>
              <textarea id={`${id}-lim`} className="input ass-short" value={f.limitazioni} onChange={e => setF({ ...f, limitazioni: e.target.value })} placeholder="Es. fastidio al ginocchio destro, evitare salti" />
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor={`${id}-n`}>{libero ? 'Domanda' : 'Note'}</label>
          <textarea id={`${id}-n`} className={`input ${libero ? 'ass-prompt-q' : 'ass-short'}`} value={f.note} onChange={e => setF({ ...f, note: e.target.value })}
            placeholder={libero ? 'Es. Come adatto il plank per chi ha mal di schiena?' : 'Es. lezione di gruppo, spazio ridotto'} />
        </div>
        <div className="ass-form-more">
          <div className="field">
            <label htmlFor={`${id}-a`}>Agente</label>
            <select id={`${id}-a`} className="input" value={agente?.id ?? ''} onChange={e => setAgenteId(Number(e.target.value))}>
              {usabili.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          {disponibili.length > 0 && (
            <details className="ass-details">
              <summary><X.Freccia size={14} /> Documenti da considerare {docs.length > 0 && <span className="tag tag-accent">{docs.length}</span>}</summary>
              <div className="ass-checks">
                {disponibili.map(d => (
                  <label key={d.id} className="ass-check">
                    <input type="checkbox" checked={docs.includes(d.id)} onChange={e => setDocs(l => (e.target.checked ? [...l, d.id] : l.filter(x => x !== d.id)))} />
                    <span>{d.titolo} <span className="text-muted">· {d.partecipanteId ? 'cartella' : 'libreria'}</span></span>
                  </label>
                ))}
                <div className="ass-help">Anche senza selezione l'assistente cerca i passaggi pertinenti nelle fonti dell'agente.</div>
              </div>
            </details>
          )}
        </div>
        {errore && <div className="error-box" role="alert">{errore}</div>}
        <button type="submit" className="btn btn-primary btn-lg btn-block ass-submit" disabled={g.out?.stato === 'in_corso'}>
          <X.Scintille size={16} /> {libero ? 'Chiedi' : g.out?.contenuto ? 'Genera di nuovo' : 'Genera programma'}
        </button>
      </form>
      <div className="ass-result">
        {g.out
          ? <Risultato out={g.out} compito={compito} iscritto={persona} input={input} agente={agente} onInterrompi={g.interrompi} onRigenera={avvia}
              onContenuto={c => g.setOut(o => o && { ...o, contenuto: c })} />
          : <RisultatoVuoto libero={libero} />}
      </div>
    </div>
  );
}
