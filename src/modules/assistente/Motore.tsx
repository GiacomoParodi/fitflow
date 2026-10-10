import { useEffect, useId, useRef, useState } from 'react';
import type { ModelloConsigliato, ProviderKind, StatoMotore } from '../../../shared/assistente';
import * as I from '../../icons';
import { useApp } from '../../store';
import { ass, avvisaCambio, messaggio, scaricaModello } from './api';
import { fmtByte, useDati, useStato } from './hooks';

// ─── Download di un modello con avanzamento ────────────────────────────

export function Scarica({ nome, etichetta = 'Scarica', primario }: { nome: string; etichetta?: string; primario?: boolean }) {
  const [prog, setProg] = useState<{ stato: string; pct: number | null } | null>(null);
  const [errore, setErrore] = useState('');
  const ac = useRef<AbortController | null>(null);
  useEffect(() => () => ac.current?.abort(), []);

  const avvia = async () => {
    setErrore('');
    setProg({ stato: 'Avvio…', pct: null });
    ac.current = new AbortController();
    let ok = false;
    try {
      await scaricaModello(nome, e => {
        if (e.tipo === 'avanzamento') {
          const pct = e.totale ? Math.round(((e.completato ?? 0) / e.totale) * 100) : null;
          const stato = e.stato.startsWith('pulling') && e.totale ? `Scaricamento ${fmtByte(e.completato)} di ${fmtByte(e.totale)}`
            : e.stato === 'verifying sha256 digest' ? 'Verifica…' : e.stato === 'success' ? 'Completato' : e.stato.startsWith('pulling manifest') ? 'Preparazione…' : 'Installazione…';
          setProg({ stato, pct });
        } else if (e.tipo === 'errore') setErrore(e.messaggio);
        else if (e.tipo === 'fine') ok = true;
      }, ac.current.signal);
    } catch (e) {
      if (!ac.current?.signal.aborted) setErrore(messaggio(e));
    }
    setProg(null);
    if (ok) avvisaCambio('motore');
  };

  if (prog) {
    return (
      <div className="ass-download" role="status" aria-live="polite">
        <div className="capacity">
          <div className="capacity-track" role="progressbar" aria-label={`Scaricamento di ${nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={prog.pct ?? undefined}>
            <div className="capacity-fill" style={{ width: `${prog.pct ?? 4}%` }} />
          </div>
          <span className="capacity-label nowrap">{prog.pct !== null ? `${prog.pct}%` : ''}</span>
        </div>
        <div className="ass-row ass-small">
          <span className="text-muted">{prog.stato}</span>
          <button type="button" className="btn btn-ghost" onClick={() => ac.current?.abort()}>Annulla</button>
        </div>
      </div>
    );
  }
  return (
    <div className="ass-download">
      <button type="button" className={`btn ${primario ? 'btn-primary' : 'btn-secondary'}`} onClick={avvia}><I.Download /> {etichetta}</button>
      {errore && <div className="error-box" role="alert">{errore}</div>}
    </div>
  );
}

function CardModello({ m, scaricabile }: { m: ModelloConsigliato; scaricabile: boolean }) {
  return (
    <div className="ass-model" data-consigliato={m.consigliato}>
      <div className="ass-row">
        <div>
          <div className="row-title">{m.titolo}</div>
          <code className="ass-code">{m.nome}</code>
        </div>
        <div className="ass-tags">
          {m.consigliato && <span className="tag tag-accent nowrap">Consigliato</span>}
          {!m.adatto && <span className="tag tag-outline nowrap">Serve più memoria</span>}
          {m.installato && <span className="tag tag-neutral nowrap"><I.Check size={12} />&nbsp;Installato</span>}
        </div>
      </div>
      <div className="text-muted ass-small">{m.descrizione}</div>
      <div className="ass-row ass-small">
        <span className="text-muted">≈ {String(m.dimensioneGb).replace('.', ',')} GB · {m.tipo === 'chat' ? 'modello di testo' : 'embedding'} · da {m.ramMinGb} GB di RAM</span>
        {!m.installato && scaricabile && <Scarica nome={m.nome} primario={m.consigliato} />}
      </div>
    </div>
  );
}

// ─── Guida al primo utilizzo ───────────────────────────────────────────

/** Schermata guida quando il motore non risponde o manca un modello. */
export function Guida({ stato, onVerifica, verificando }: { stato: StatoMotore; onVerifica: () => void; verificando: boolean }) {
  const cons = useDati(ass.consigliati, [stato.modelli.length], ['motore']);
  const chat = cons.data?.modelli.find(m => m.consigliato && m.tipo === 'chat');
  const emb = cons.data?.modelli.find(m => m.consigliato && m.tipo === 'embedding');
  const ollama = stato.provider === 'ollama';

  return (
    <div className="ass-guide">
      {!stato.raggiungibile ? (
        <>
          <h3 className="ass-guide-title">{ollama ? 'Per iniziare serve Ollama' : 'Il server del modello non risponde'}</h3>
          <p className="text-muted">
            L'assistente usa un modello linguistico che gira <strong>su questo computer</strong>: i dati degli iscritti non escono mai.
            {ollama ? ' Il motore gratuito che lo fa funzionare si chiama Ollama.' : ` FitFlow lo cerca su ${stato.url}.`}
          </p>
          {ollama ? (
            <ol className="ass-steps">
              <li>Scarica Ollama per Mac o Windows da <a href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com/download</a>.</li>
              <li>Installalo e avvialo: compare un'icona a forma di lama nella barra dei menu (Mac) o vicino all'orologio (Windows).</li>
              <li>Torna qui e premi <strong>Verifica di nuovo</strong>: potrai scaricare il modello consigliato con un clic.</li>
            </ol>
          ) : (
            <ol className="ass-steps">
              <li>Apri il programma del modello (es. LM Studio) e avvia il suo server locale.</li>
              <li>Controlla l'indirizzo in Impostazioni → Motore AI, poi premi <strong>Verifica di nuovo</strong>.</li>
            </ol>
          )}
          {stato.errore && <div className="text-muted ass-small">Dettaglio: {stato.errore}</div>}
        </>
      ) : (
        <>
          <h3 className="ass-guide-title">Scarica il modello consigliato</h3>
          <p className="text-muted">
            {ollama ? 'Ollama è attivo' : 'Il server è attivo'}{stato.versione ? ` (versione ${stato.versione})` : ''}. Per questo computer
            ({String(stato.ramGb).replace('.', ',')} GB di memoria) il modello più adatto è quello qui sotto: si scarica una volta sola e poi funziona anche senza internet.
          </p>
          {ollama ? (
            <div className="ass-stack-sm">
              {chat && <CardModello m={chat} scaricabile />}
              {emb && !emb.installato && <CardModello m={emb} scaricabile />}
            </div>
          ) : (
            <p className="text-muted">Carica un modello nel programma del server (es. LM Studio) e premi Verifica di nuovo.</p>
          )}
        </>
      )}
      <div className="btn-row-8">
        <button type="button" className="btn btn-primary" onClick={onVerifica} disabled={verificando}><I.Refresh /> {verificando ? 'Verifica…' : 'Verifica di nuovo'}</button>
        <a className="btn btn-secondary" href="#/impostazioni">Impostazioni del motore</a>
      </div>
    </div>
  );
}

// ─── Impostazioni → Motore AI ──────────────────────────────────────────

export function ImpostazioniMotore() {
  const { notify } = useApp();
  const { data: stato, ricarica, caricamento } = useStato();
  const cons = useDati(ass.consigliati, [stato?.modelli.length ?? -1], ['motore']);
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [errore, setErrore] = useState('');
  const id = useId();
  useEffect(() => { if (stato) { setUrl(stato.impostazioni.url); setApiKey(stato.impostazioni.apiKey); } }, [stato?.impostazioni.url, stato?.impostazioni.apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stato) return <div className="text-muted ass-small">{caricamento ? 'Verifica del motore…' : 'Stato non disponibile.'}</div>;
  const s = stato.impostazioni;

  const salva = async (patch: Record<string, unknown>) => {
    setErrore('');
    try {
      await ass.impostazioni(patch);
      avvisaCambio('motore');
      await ricarica();
    } catch (e) {
      setErrore(messaggio(e));
      if (stato) { setUrl(stato.impostazioni.url); }
    }
  };
  const chat = stato.modelli.filter(m => !m.embedding);
  const emb = stato.modelli.filter(m => m.embedding);
  const ollama = s.provider === 'ollama';

  return (
    <div className="ass-settings">
      <div className="section-desc text-muted">Il modello linguistico gira su questo computer (o sulla rete locale): FitFlow non usa servizi su internet.</div>
      <div className="settings-grid">
        <div className="col-left ass-stack">
          <div className="field">
            <label id={`${id}-p`}>Motore</label>
            <div className="seg" role="group" aria-labelledby={`${id}-p`}>
              {(['ollama', 'openai'] as ProviderKind[]).map(p => (
                <button key={p} type="button" className="seg-opt" aria-pressed={s.provider === p} onClick={() => p !== s.provider && salva({ provider: p })}>
                  {p === 'ollama' ? 'Ollama' : 'Compatibile OpenAI (LM Studio, llama.cpp)'}
                </button>
              ))}
            </div>
          </div>
          <div className="form-2">
            <div className="field">
              <label htmlFor={`${id}-u`}>Indirizzo</label>
              <input id={`${id}-u`} className="input" value={url} onChange={e => setUrl(e.target.value)}
                onBlur={() => url !== s.url && salva({ url })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
            </div>
            {!ollama && (
              <div className="field">
                <label htmlFor={`${id}-k`}>Chiave API (facoltativa)</label>
                <input id={`${id}-k`} className="input" type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  onBlur={() => apiKey !== s.apiKey && salva({ apiKey })} />
              </div>
            )}
          </div>
          <div className="hint text-muted">Solo indirizzi di questo computer o della rete locale (es. http://127.0.0.1:11434, 192.168.x.x, nome.local).</div>
          {errore && <div className="error-box" role="alert">{errore}</div>}

          <div className="ass-status" data-ok={stato.raggiungibile}>
            <span className={`tag ${stato.raggiungibile ? 'tag-neutral' : 'tag-accent'} nowrap`}>{stato.raggiungibile ? 'Connesso' : 'Non raggiungibile'}</span>
            <span className="ass-small">
              {stato.raggiungibile
                ? `${ollama ? 'Ollama' : 'Server'}${stato.versione ? ` ${stato.versione}` : ''} · ${stato.modelli.length} modelli installati · ${stato.ramGb.toString().replace('.', ',')} GB di memoria`
                : stato.errore}
            </span>
            <button type="button" className="btn btn-ghost" onClick={() => { avvisaCambio('motore'); void ricarica(); }}><I.Refresh /> Verifica</button>
          </div>

          <div className="form-2">
            <div className="field">
              <label htmlFor={`${id}-c`}>Modello predefinito degli agenti</label>
              <select id={`${id}-c`} className="input" value={s.modelloChat} onChange={e => salva({ modelloChat: e.target.value })}>
                <option value="">Automatico (il consigliato, se installato)</option>
                {chat.map(m => <option key={m.nome} value={m.nome}>{m.nome}{m.parametri ? ` · ${m.parametri}` : ''}</option>)}
                {s.modelloChat && !chat.some(m => m.nome === s.modelloChat) && <option value={s.modelloChat}>{s.modelloChat} (non installato)</option>}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${id}-e`}>Modello di embedding</label>
              <select id={`${id}-e`} className="input" value={s.modelloEmbedding} onChange={e => salva({ modelloEmbedding: e.target.value })}>
                <option value="">Automatico (se installato)</option>
                {emb.map(m => <option key={m.nome} value={m.nome}>{m.nome}</option>)}
                {s.modelloEmbedding && !emb.some(m => m.nome === s.modelloEmbedding) && <option value={s.modelloEmbedding}>{s.modelloEmbedding} (non installato)</option>}
              </select>
            </div>
          </div>
          <div className="hint text-muted">
            L'embedding permette di trovare i passaggi dei documenti per significato; senza, si cerca per parole.
            {stato.indicizzazione.inCoda > 0 || stato.indicizzazione.inCorso ? ` Indicizzazione in corso: ${stato.indicizzazione.inCorso ?? ''} (${stato.indicizzazione.inCoda} in coda).` : ''}
          </div>
          <div className="btn-row-8">
            <button type="button" className="btn btn-secondary" onClick={async () => {
              try { await ass.reindicizza(); notify('Reindicizzazione avviata: procede in background.'); avvisaCambio('documenti'); } catch (e) { notify(messaggio(e)); }
            }}><I.Refresh /> Reindicizza documenti</button>
          </div>

          {stato.modelli.length > 0 && (
            <div className="scroll-x">
              <table className="table">
                <thead><tr><th>Modelli installati</th><th>Tipo</th><th>Dimensione</th></tr></thead>
                <tbody>
                  {stato.modelli.map(m => (
                    <tr key={m.nome}>
                      <td><code className="ass-code">{m.nome}</code>{m.quantizzazione && <span className="text-muted ass-small"> · {m.quantizzazione}</span>}</td>
                      <td className="text-muted ass-small">{m.embedding ? 'embedding' : 'testo'}</td>
                      <td className="text-muted ass-small nowrap">{fmtByte(m.dimensione)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="col-right ass-stack-sm">
          <h5 className="ass-h5">Modelli consigliati</h5>
          <div className="text-muted ass-small">Scelti per un buon italiano e risposte strutturate affidabili su computer con 8 GB di memoria.{!ollama && ' Con questo motore si scaricano dal suo programma.'}</div>
          {cons.data?.modelli.map(m => <CardModello key={m.nome} m={m} scaricabile={ollama && stato.raggiungibile} />)}
        </div>
      </div>
    </div>
  );
}
