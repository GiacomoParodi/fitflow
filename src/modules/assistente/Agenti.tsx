import { useId, useState } from 'react';
import { COMPITI, COMPITO_LABEL, type Agente, type AgenteInput, type FontiAgente } from '../../../shared/assistente';
import { CloseButton, Dialog } from '../../components/Dialog';
import * as I from '../../icons';
import { useApp } from '../../store';
import { ass, avvisaCambio, messaggio } from './api';
import { useAgenti, useStato } from './hooks';

const FONTI: { k: keyof FontiAgente; label: string; help: string }[] = [
  { k: 'esercizi', label: 'Libreria esercizi', help: 'propone esercizi della libreria, filtrati per attrezzi, livello e cautele' },
  { k: 'conoscenze', label: 'Schede di conoscenza', help: 'le schede di base incluse in FitFlow' },
  { k: 'documenti', label: 'Documenti della libreria', help: 'manuali, dispense e altri file caricati in Libreria' },
  { k: 'cartella', label: 'Cartella dell\'iscritto', help: 'scheda, note e documenti caricati nella scheda della persona' },
];

const PROMPT_NUOVO = 'Sei un esperto di ginnastica e allenamento. Ti rivolgi a un istruttore professionista, in italiano. Non fai diagnosi; in presenza di segnali d\'allarme indichi di rivolgersi al medico.';

function nuovo(): AgenteInput {
  return {
    nome: 'Nuovo agente', descrizione: '', compito: 'genera_programma', modello: '', modelloEmbedding: '', promptSistema: PROMPT_NUOVO,
    temperatura: 0.4, topP: 0.9, topK: 40, contesto: 8192, maxRisposta: 2048, seed: null, ragionamento: false,
    fonti: { esercizi: true, conoscenze: true, documenti: true, cartella: true }, estratti: 6,
  };
}

function Numero({ label, help, value, onChange, min, max, step }: {
  label: string; help: string; value: number | null; onChange: (v: number | null) => void; min: number; max: number; step: number;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" type="number" min={min} max={max} step={step} value={value ?? ''} aria-describedby={`${id}-h`}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      <div id={`${id}-h`} className="ass-help text-muted">{help}</div>
    </div>
  );
}

function EditorAgente({ agente, onClose }: { agente: Agente | null; onClose: () => void }) {
  const [a, setA] = useState<AgenteInput>(() => {
    if (!agente) return nuovo();
    const { id: _id, predefinito: _p, aggiornatoIl: _u, ...rest } = agente;
    return rest;
  });
  const [errore, setErrore] = useState('');
  const [salvando, setSalvando] = useState(false);
  const { data: stato } = useStato();
  const id = useId();
  const set = <K extends keyof AgenteInput>(k: K, v: AgenteInput[K]) => setA(x => ({ ...x, [k]: v }));
  const chat = stato?.modelli.filter(m => !m.embedding) ?? [];
  const emb = stato?.modelli.filter(m => m.embedding) ?? [];

  const salva = async () => {
    setSalvando(true);
    setErrore('');
    try {
      if (agente) await ass.salvaAgente(agente.id, a); else await ass.creaAgente(a);
      avvisaCambio('agenti');
      onClose();
    } catch (e) {
      setErrore(messaggio(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog onClose={onClose} className="dialog-wide ass-agent-dialog" labelledBy={`${id}-t`} zIndex={120}>
      <div className="dialog-head">
        <div>
          <div className="dialog-title" id={`${id}-t`}>{agente ? `Modifica ${agente.nome}` : 'Nuovo agente'}</div>
          <div className="text-muted ass-small">Ogni parametro si può cambiare; i valori predefiniti vanno bene per un computer con 8 GB.</div>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="ass-stack">
        <div className="form-2">
          <div className="field"><label htmlFor={`${id}-n`}>Nome</label><input id={`${id}-n`} className="input" value={a.nome} onChange={e => set('nome', e.target.value)} /></div>
          <div className="field">
            <label htmlFor={`${id}-c`}>Compito</label>
            <select id={`${id}-c`} className="input" value={a.compito} onChange={e => set('compito', e.target.value as AgenteInput['compito'])}>
              {COMPITI.map(c => <option key={c} value={c}>{COMPITO_LABEL[c]}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label htmlFor={`${id}-d`}>Descrizione</label><input id={`${id}-d`} className="input" value={a.descrizione} onChange={e => set('descrizione', e.target.value)} /></div>
        <div className="form-2">
          <div className="field">
            <label htmlFor={`${id}-m`}>Modello</label>
            <input id={`${id}-m`} className="input" list={`${id}-ml`} placeholder="Predefinito del motore" value={a.modello} onChange={e => set('modello', e.target.value.trim())} />
            <datalist id={`${id}-ml`}>{chat.map(m => <option key={m.nome} value={m.nome} />)}</datalist>
            <div className="ass-help text-muted">Vuoto = quello scelto in Motore AI. Si può indicare qualsiasi modello installato.</div>
          </div>
          <div className="field">
            <label htmlFor={`${id}-em`}>Modello di embedding</label>
            <input id={`${id}-em`} className="input" list={`${id}-el`} placeholder="Predefinito del motore" value={a.modelloEmbedding} onChange={e => set('modelloEmbedding', e.target.value.trim())} />
            <datalist id={`${id}-el`}>{emb.map(m => <option key={m.nome} value={m.nome} />)}</datalist>
            <div className="ass-help text-muted">Per la ricerca nei documenti. Se diverso da quello del motore, i documenti vanno reindicizzati con lo stesso modello.</div>
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${id}-p`}>Prompt di sistema</label>
          <textarea id={`${id}-p`} className="input ass-prompt" value={a.promptSistema} onChange={e => set('promptSistema', e.target.value)} />
          <div className="ass-help text-muted">Le istruzioni permanenti: ruolo, tono, regole di sicurezza. Il formato della risposta viene aggiunto automaticamente in base al compito.</div>
        </div>
        <div className="form-3">
          <Numero label="Temperatura" min={0} max={2} step={0.05} value={a.temperatura} onChange={v => set('temperatura', v ?? 0)}
            help="Creatività. Bassa (0,2–0,5) = risposte coerenti e prevedibili." />
          <Numero label="Top P" min={0.01} max={1} step={0.05} value={a.topP} onChange={v => set('topP', v ?? 0.9)}
            help="Usa solo le parole più probabili fino a questa soglia. 0,9 va bene quasi sempre." />
          <Numero label="Top K" min={1} max={500} step={1} value={a.topK} onChange={v => set('topK', v ?? 40)}
            help="Parole candidate a ogni passo. Più basso = più conservativo." />
          <Numero label="Contesto (token)" min={1024} max={131072} step={1024} value={a.contesto} onChange={v => set('contesto', v ?? 8192)}
            help="Quanto testo legge insieme (1 token ≈ 3–4 caratteri). Più alto = più documenti ma più memoria: 8192 per 8 GB." />
          <Numero label="Lunghezza massima risposta" min={128} max={16384} step={128} value={a.maxRisposta} onChange={v => set('maxRisposta', v ?? 2048)}
            help="In token. Un programma completo richiede circa 1500–2500." />
          <Numero label="Seed" min={0} max={2147483647} step={1} value={a.seed} onChange={v => set('seed', v)}
            help="Numero fisso = stessa risposta a parità di dati. Vuoto = variabile." />
        </div>
        <label className="ass-check">
          <input type="checkbox" checked={a.ragionamento} onChange={e => set('ragionamento', e.target.checked)} />
          <span><strong>Ragionamento</strong> <span className="text-muted">— per i modelli che "pensano" prima di rispondere (es. Qwen): a volte più accurato, ma molto più lento. Consigliato spento.</span></span>
        </label>
        <fieldset className="ass-fieldset">
          <legend className="label text-muted">Fonti da usare</legend>
          {FONTI.map(f => (
            <label key={f.k} className="ass-check">
              <input type="checkbox" checked={a.fonti[f.k]} onChange={e => set('fonti', { ...a.fonti, [f.k]: e.target.checked })} />
              <span>{f.label} <span className="text-muted">— {f.help}</span></span>
            </label>
          ))}
          <div className="form-3">
            <Numero label="Estratti da recuperare" min={0} max={50} step={1} value={a.estratti} onChange={v => set('estratti', v ?? 0)}
              help="Passaggi dei documenti inclusi nel contesto (0 = nessuno)." />
          </div>
        </fieldset>
        {errore && <div className="error-box" role="alert">{errore}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
          <button type="button" className="btn btn-primary" onClick={salva} disabled={salvando}>{salvando ? 'Salvataggio…' : 'Salva agente'}</button>
        </div>
      </div>
    </Dialog>
  );
}

export function ImpostazioniAgenti() {
  const { notify } = useApp();
  const { data: agenti, errore } = useAgenti();
  const [edit, setEdit] = useState<Agente | 'nuovo' | null>(null);
  const [confermaRipristino, setConfermaRipristino] = useState(false);

  const azione = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); avvisaCambio('agenti'); if (ok) notify(ok); } catch (e) { notify(messaggio(e)); }
  };

  return (
    <div className="ass-settings">
      <div className="section-desc text-muted">
        Un agente è una "ricetta" per il modello: compito, istruzioni, parametri e fonti. Puoi crearne di nuovi (es. uno per il pilates) o cambiare modello in futuro.
      </div>
      <div className="scroll-x">
        <table className="table">
          <thead><tr><th>Agente</th><th>Compito</th><th>Modello</th><th /></tr></thead>
          <tbody>
            {agenti?.map(a => (
              <tr key={a.id}>
                <td>
                  <div className="row-title">{a.nome}</div>
                  {a.descrizione && <div className="text-muted ass-small">{a.descrizione}</div>}
                </td>
                <td className="ass-small nowrap">{COMPITO_LABEL[a.compito]}</td>
                <td className="ass-small">{a.modello ? <code className="ass-code">{a.modello}</code> : <span className="text-muted">predefinito</span>}</td>
                <td className="nowrap" style={{ textAlign: 'right' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setEdit(a)}>Modifica</button>
                  <button type="button" className="btn btn-ghost" onClick={() => azione(() => ass.duplicaAgente(a.id), 'Agente duplicato.')}>Duplica</button>
                  <button type="button" className="btn btn-ghost" onClick={() => {
                    if (window.confirm(`Eliminare l'agente "${a.nome}"?`)) void azione(() => ass.eliminaAgente(a.id));
                  }}>Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {agenti?.length === 0 && <div className="empty text-muted">Nessun agente: creane uno o ripristina i predefiniti.</div>}
      {errore && <div className="error-box" role="alert">{errore}</div>}
      <div className="btn-row-8 ass-mt">
        <button type="button" className="btn btn-primary" onClick={() => setEdit('nuovo')}><I.Plus /> Nuovo agente</button>
        <button type="button" className="btn btn-secondary" onClick={() => setConfermaRipristino(true)}><I.Refresh /> Ripristina predefiniti</button>
      </div>
      {confermaRipristino && (
        <div className="confirm-box ass-mt" role="alert">
          <div>"Generatore di esercizi" e "Analisi cartella" torneranno ai valori originali (ricreati se eliminati). Gli altri agenti restano come sono.</div>
          <div className="btn-row-8">
            <button type="button" className="btn btn-primary" onClick={() => { setConfermaRipristino(false); void azione(ass.ripristinaAgenti, 'Agenti predefiniti ripristinati.'); }}>Ripristina</button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfermaRipristino(false)}>Annulla</button>
          </div>
        </div>
      )}
      {edit && <EditorAgente agente={edit === 'nuovo' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
