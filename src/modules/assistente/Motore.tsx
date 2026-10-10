import { useEffect, useId, useRef, useState } from 'react';
import type { ModelloConsigliato, ProviderKind, StatoMotore } from '../../../shared/assistente';
import * as I from '../../icons';
import { useApp } from '../../store';
import { ass, avvisaCambio, messaggio, scaricaModello } from './api';
import { fmtByte, useDati, useStato } from './hooks';
import * as X from './icone';

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
        <div className="ass-progress-row">
          <div className="ass-progress" role="progressbar" aria-label={`Scaricamento di ${nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={prog.pct ?? undefined}
            data-indeterminato={prog.pct === null}>
            <div className="ass-progress-fill" style={prog.pct !== null ? { width: `${prog.pct}%` } : undefined} />
          </div>
          <span className="ass-progress-pct tabular">{prog.pct !== null ? `${prog.pct}%` : ''}</span>
        </div>
        <div className="ass-progress-info">
          <span>{prog.stato}</span>
          <button type="button" className="btn btn-ghost" onClick={() => ac.current?.abort()}>Annulla</button>
        </div>
      </div>
    );
  }
  return (
    <div className="ass-download">
      <button type="button" className={`btn ${primario ? 'btn-primary' : 'btn-secondary'}`} onClick={avvia}><X.Download size={14} /> {etichetta}</button>
      {errore && <div className="error-box" role="alert">{errore}</div>}
    </div>
  );
}

function CardModello({ m, scaricabile }: { m: ModelloConsigliato; scaricabile: boolean }) {
  return (
    <div className="ass-model" data-consigliato={m.consigliato}>
      <div className="ass-model-head">
        <span className="ass-model-icon" data-tipo={m.tipo} aria-hidden="true">{m.tipo === 'chat' ? <X.Scintille size={16} /> : <X.Cerca size={16} />}</span>
        <div className="ass-model-name">
          <div className="ass-row-title">{m.titolo}</div>
          <code className="ass-code">{m.nome}</code>
        </div>
        <div className="ass-tags">
          {m.consigliato && <span className="tag tag-accent nowrap">Consigliato</span>}
          {!m.adatto && <span className="tag tag-warning nowrap">Serve più memoria</span>}
          {m.installato && <span className="tag tag-success nowrap"><I.Check size={11} /> Installato</span>}
        </div>
      </div>
      <div className="ass-model-desc">{m.descrizione}</div>
      <div className="ass-model-foot">
        <span className="ass-model-specs tabular">≈ {String(m.dimensioneGb).replace('.', ',')} GB · {m.tipo === 'chat' ? 'testo' : 'embedding'} · da {m.ramMinGb} GB di RAM</span>
        {!m.installato && scaricabile && <Scarica nome={m.nome} primario={m.consigliato} />}
      </div>
    </div>
  );
}

// ─── Guida al primo utilizzo ───────────────────────────────────────────

function Passi({ voci }: { voci: React.ReactNode[] }) {
  return (
    <ol className="ass-steps">
      {voci.map((v, i) => <li key={i}><span className="ass-step-n">{i + 1}</span><span>{v}</span></li>)}
    </ol>
  );
}

/** Schermata guida quando il motore non risponde o manca un modello. */
export function Guida({ stato, onVerifica, verificando }: { stato: StatoMotore; onVerifica: () => void; verificando: boolean }) {
  const cons = useDati(ass.consigliati, [stato.modelli.length], ['motore']);
  const chat = cons.data?.modelli.find(m => m.consigliato && m.tipo === 'chat');
  const emb = cons.data?.modelli.find(m => m.consigliato && m.tipo === 'embedding');
  const ollama = stato.provider === 'ollama';

  return (
    <div className="ass-guide">
      <div className="card ass-guide-card">
        <div className="ass-empty-icon ass-guide-icon" aria-hidden="true"><X.Scintille size={30} /></div>
        {!stato.raggiungibile ? (
          <>
            <div className="ass-guide-kicker">Primo passo</div>
            <h2 className="ass-guide-title">{ollama ? 'Per iniziare serve Ollama' : 'Il server del modello non risponde'}</h2>
            <p className="ass-guide-text">
              L'assistente usa un modello linguistico che gira <strong>su questo computer</strong>: i dati degli iscritti non escono mai.
              {ollama ? ' Il motore gratuito che lo fa funzionare si chiama Ollama.' : ` FitFlow lo cerca su ${stato.url}.`}
            </p>
            {ollama ? (
              <Passi voci={[
                <>Scarica Ollama per Mac, Windows o Linux da <a href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com/download</a>.</>,
                <>Installalo e avvialo: compare un'icona a forma di lama nella barra dei menu (Mac) o vicino all'orologio (Windows).</>,
                <>Torna qui e premi <strong>Verifica di nuovo</strong>: potrai scaricare il modello consigliato con un clic.</>,
              ]} />
            ) : (
              <Passi voci={[
                <>Apri il programma del modello (es. LM Studio) e avvia il suo server locale.</>,
                <>Controlla l'indirizzo in Impostazioni → Motore AI, poi premi <strong>Verifica di nuovo</strong>.</>,
              ]} />
            )}
            {stato.errore && <div className="ass-guide-detail"><span className="ass-dot" data-stato="spento" aria-hidden="true" /> {stato.errore}</div>}
          </>
        ) : (
          <>
            <div className="ass-guide-kicker"><span className="ass-dot" data-stato="ok" aria-hidden="true" /> {ollama ? 'Ollama è attivo' : 'Il server è attivo'}{stato.versione ? ` · versione ${stato.versione}` : ''}</div>
            <h2 className="ass-guide-title">Scarica il modello consigliato</h2>
            <p className="ass-guide-text">
              Per questo computer ({String(stato.ramGb).replace('.', ',')} GB di memoria) il modello più adatto è quello qui sotto:
              si scarica una volta sola e poi funziona anche senza internet.
            </p>
            {ollama ? (
              <div className="ass-guide-models">
                {chat && <CardModello m={chat} scaricabile />}
                {emb && !emb.installato && <CardModello m={emb} scaricabile />}
              </div>
            ) : (
              <p className="ass-guide-text">Carica un modello nel programma del server (es. LM Studio) e premi Verifica di nuovo.</p>
            )}
          </>
        )}
        <div className="ass-guide-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={onVerifica} disabled={verificando}><I.Refresh /> {verificando ? 'Verifica…' : 'Verifica di nuovo'}</button>
          <a className="btn btn-secondary btn-lg" href="#/impostazioni/motore-ai">Impostazioni del motore</a>
        </div>
      </div>
    </div>
  );
}

// ─── Impostazioni → Motore AI ──────────────────────────────────────────

/** Riga di impostazione: etichetta (e spiegazione) a sinistra, controllo a destra. */
export function RigaImp({ label, help, htmlFor, children, id }: { label: React.ReactNode; help?: React.ReactNode; htmlFor?: string; id?: string; children: React.ReactNode }) {
  return (
    <div className="ass-set-row">
      <div className="ass-set-label">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span id={id}>{label}</span>}
        {help && <div className="ass-set-help">{help}</div>}
      </div>
      <div className="ass-set-control">{children}</div>
    </div>
  );
}

export function ImpostazioniMotore() {
  const { notify } = useApp();
  const { data: stato, ricarica, caricamento } = useStato();
  const cons = useDati(ass.consigliati, [stato?.modelli.length ?? -1], ['motore']);
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [errore, setErrore] = useState('');
  const id = useId();
  useEffect(() => { if (stato) { setUrl(stato.impostazioni.url); setApiKey(stato.impostazioni.apiKey); } }, [stato?.impostazioni.url, stato?.impostazioni.apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stato) return <div className="ass-loading" role="status"><span className="ass-spinner" aria-hidden="true" />{caricamento ? 'Verifica del motore…' : 'Stato non disponibile.'}</div>;
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
  const pronto = stato.raggiungibile && stato.modelloChatInstallato;
  const indicizza = stato.indicizzazione.inCoda > 0 || stato.indicizzazione.inCorso;

  return (
    <div className="ass-settings">
      <p className="ass-settings-desc">Il modello linguistico gira su questo computer (o sulla rete locale): FitFlow non usa servizi su internet.</p>
      <div className="ass-settings-grid">
        <div className="ass-settings-col">
          <div className="card card-flush ass-group">
            <div className="ass-status-row">
              <span className="ass-status-icon" data-stato={pronto ? 'ok' : stato.raggiungibile ? 'avviso' : 'spento'} aria-hidden="true"><X.Chip size={18} /></span>
              <div className="ass-row-main">
                <div className="ass-row-title"><span className="ass-dot" data-stato={pronto ? 'ok' : stato.raggiungibile ? 'avviso' : 'spento'} aria-hidden="true" /> {stato.raggiungibile ? (pronto ? 'Connesso e pronto' : 'Connesso · nessun modello di testo') : 'Non raggiungibile'}</div>
                <div className="ass-row-sub">
                  {stato.raggiungibile
                    ? `${ollama ? 'Ollama' : 'Server'}${stato.versione ? ` ${stato.versione}` : ''} · ${stato.modelli.length} modelli installati · ${stato.ramGb.toString().replace('.', ',')} GB di memoria`
                    : stato.errore}
                </div>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => { avvisaCambio('motore'); void ricarica(); }}><I.Refresh /> Verifica</button>
            </div>
          </div>

          <div className="card card-flush ass-group">
            <RigaImp label="Motore" id={`${id}-p`}>
              <div className="seg" role="group" aria-labelledby={`${id}-p`}>
                {(['ollama', 'openai'] as ProviderKind[]).map(p => (
                  <button key={p} type="button" className="seg-opt" aria-pressed={s.provider === p} onClick={() => p !== s.provider && salva({ provider: p })}>
                    {p === 'ollama' ? 'Ollama' : 'Compatibile OpenAI'}
                  </button>
                ))}
              </div>
            </RigaImp>
            <RigaImp label="Indirizzo" htmlFor={`${id}-u`} help="Solo questo computer o la rete locale (es. 127.0.0.1:11434, 192.168.x.x, nome.local).">
              <input id={`${id}-u`} className="input" value={url} onChange={e => setUrl(e.target.value)}
                onBlur={() => url !== s.url && salva({ url })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
            </RigaImp>
            {!ollama && (
              <RigaImp label="Chiave API" htmlFor={`${id}-k`} help="Facoltativa: solo per i server che la richiedono (LM Studio, llama.cpp).">
                <input id={`${id}-k`} className="input" type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  onBlur={() => apiKey !== s.apiKey && salva({ apiKey })} />
              </RigaImp>
            )}
          </div>
          {errore && <div className="error-box" role="alert">{errore}</div>}

          <div className="card card-flush ass-group">
            <RigaImp label="Modello degli agenti" htmlFor={`${id}-c`} help="Usato dagli agenti che non ne indicano uno.">
              <select id={`${id}-c`} className="input" value={s.modelloChat} onChange={e => salva({ modelloChat: e.target.value })}>
                <option value="">Automatico (il consigliato, se installato)</option>
                {chat.map(m => <option key={m.nome} value={m.nome}>{m.nome}{m.parametri ? ` · ${m.parametri}` : ''}</option>)}
                {s.modelloChat && !chat.some(m => m.nome === s.modelloChat) && <option value={s.modelloChat}>{s.modelloChat} (non installato)</option>}
              </select>
            </RigaImp>
            <RigaImp label="Modello di embedding" htmlFor={`${id}-e`} help="Trova i passaggi dei documenti per significato; senza, si cerca per parole.">
              <select id={`${id}-e`} className="input" value={s.modelloEmbedding} onChange={e => salva({ modelloEmbedding: e.target.value })}>
                <option value="">Automatico (se installato)</option>
                {emb.map(m => <option key={m.nome} value={m.nome}>{m.nome}</option>)}
                {s.modelloEmbedding && !emb.some(m => m.nome === s.modelloEmbedding) && <option value={s.modelloEmbedding}>{s.modelloEmbedding} (non installato)</option>}
              </select>
            </RigaImp>
            <RigaImp label="Documenti" help={indicizza
              ? <><span className="ass-spinner" aria-hidden="true" /> Indicizzazione in corso: {stato.indicizzazione.inCorso ?? ''} ({stato.indicizzazione.inCoda} in coda)</>
              : 'Ricalcola gli estratti di tutti i documenti, ad esempio dopo aver cambiato modello di embedding.'}>
              <button type="button" className="btn btn-secondary" onClick={async () => {
                try { await ass.reindicizza(); notify('Reindicizzazione avviata: procede in background.'); avvisaCambio('documenti'); } catch (e) { notify(messaggio(e)); }
              }}><I.Refresh /> Reindicizza</button>
            </RigaImp>
          </div>

          {stato.modelli.length > 0 && (
            <div className="ass-subgroup">
              <h3 className="ass-group-title">Modelli installati</h3>
              <div className="card card-flush ass-group">
                {stato.modelli.map(m => (
                  <div key={m.nome} className="ass-set-row ass-set-row-compact">
                    <span className="ass-model-icon" data-tipo={m.embedding ? 'embedding' : 'chat'} aria-hidden="true">{m.embedding ? <X.Cerca size={14} /> : <X.Scintille size={14} />}</span>
                    <div className="ass-row-main">
                      <code className="ass-code ass-code-strong">{m.nome}</code>
                      <div className="ass-row-sub">{m.embedding ? 'Embedding' : 'Testo'}{m.parametri ? ` · ${m.parametri}` : ''}{m.quantizzazione ? ` · ${m.quantizzazione}` : ''}</div>
                    </div>
                    <span className="ass-row-sub tabular nowrap">{fmtByte(m.dimensione)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="ass-settings-col">
          <div className="ass-subgroup">
            <h3 className="ass-group-title">Modelli consigliati</h3>
            <p className="ass-set-help">Scelti per un buon italiano e risposte strutturate affidabili su computer con 8 GB di memoria.{!ollama && ' Con questo motore si scaricano dal suo programma.'}</p>
            <div className="ass-models">
              {cons.data?.modelli.map(m => <CardModello key={m.nome} m={m} scaricabile={ollama && stato.raggiungibile} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
