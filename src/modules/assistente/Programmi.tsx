import { useId, useState } from 'react';
import { BLOCCHI, type Contenuto, type Programma } from '../../../shared/assistente';
import { CloseButton, Dialog } from '../../components/Dialog';
import * as I from '../../icons';
import { useApp } from '../../store';
import { ass, avvisaCambio, messaggio } from './api';
import { Avviso, EditorContenuto, Stampa, VistaContenuto } from './Contenuto';
import { fmtData, useDati } from './hooks';
import * as X from './icone';
import { SchedaEsercizio } from './Libreria';

const TIPO: Record<Contenuto['tipo'], string> = { programma: 'Programma', analisi: 'Analisi', nota: 'Nota' };

function TagStato({ stato }: { stato: Programma['stato'] }) {
  return <span className={`tag ${stato === 'approvato' ? 'tag-success' : 'tag-neutral'} nowrap`}>{stato === 'approvato' ? 'Approvato' : 'Bozza'}</span>;
}

/** Riassunto breve del contenuto (numero di esercizi, durata…). */
function riassunto(c: Contenuto): string {
  if (c.tipo === 'programma') {
    const n = BLOCCHI.reduce((s, b) => s + c[b].length, 0);
    return [c.durata, n ? `${n} esercizi` : ''].filter(Boolean).join(' · ');
  }
  if (c.tipo === 'analisi') return c.eserciziConsigliati.length ? `${c.eserciziConsigliati.length} esercizi consigliati` : 'Analisi';
  return 'Nota';
}
const sottotitolo = (c: Contenuto) => (c.tipo === 'programma' ? c.obiettivo : c.tipo === 'analisi' ? c.sintesi : c.testo);

/** Finestra di un programma salvato: lettura, modifica, approvazione, stampa, eliminazione. */
export function ProgrammaDialog({ programma, onClose }: { programma: Programma; onClose: () => void }) {
  const { people, notify } = useApp();
  const [p, setP] = useState(programma);
  const [c, setC] = useState<Contenuto>(programma.contenuto);
  const [modifica, setModifica] = useState(false);
  const [stampa, setStampa] = useState(false);
  const [scheda, setScheda] = useState<string | null>(null);
  const [conferma, setConferma] = useState(false);
  const id = useId();
  const nome = people.find(x => x.id === p.partecipanteId)?.name ?? null;
  const cambiato = JSON.stringify(c) !== JSON.stringify(p.contenuto);

  const salva = async (patch: Partial<Pick<Programma, 'contenuto' | 'stato'>>) => {
    try {
      const n = await ass.salvaProgramma(p.id, patch);
      setP(n);
      setC(n.contenuto);
      avvisaCambio('programmi');
      return true;
    } catch (e) {
      notify(messaggio(e));
      return false;
    }
  };
  const elimina = async () => {
    try { await ass.eliminaProgramma(p.id); avvisaCambio('programmi'); onClose(); } catch (e) { notify(messaggio(e)); }
  };

  return (
    <Dialog onClose={onClose} className="ass-prog-dialog" labelledBy={id} zIndex={110}>
      <div className="ass-pd-head">
        <div className="ass-pd-meta">
          <span>{TIPO[p.contenuto.tipo]}</span>
          {nome && <span><X.Persona size={13} /> {nome}</span>}
          <span>Aggiornato il {fmtData(p.aggiornatoIl)}</span>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="ass-pd-bar">
        <div className="seg" role="group" aria-label="Stato">
          <button type="button" className="seg-opt" aria-pressed={p.stato === 'bozza'} onClick={() => p.stato !== 'bozza' && salva({ stato: 'bozza' })}>Bozza</button>
          <button type="button" className="seg-opt" aria-pressed={p.stato === 'approvato'} onClick={() => p.stato !== 'approvato' && salva({ stato: 'approvato' })}>Approvato</button>
        </div>
        <div className="ass-doc-actions">
          <button type="button" className="btn btn-secondary" aria-pressed={modifica} onClick={() => setModifica(m => !m)}>
            {modifica ? <><X.Occhio size={15} /> Anteprima</> : <><X.Matita size={15} /> Modifica</>}
          </button>
          <button type="button" className="btn btn-secondary btn-icon" onClick={() => setStampa(true)} aria-label="Stampa" title="Stampa"><X.Stampante size={16} /></button>
          {cambiato && <button type="button" className="btn btn-primary" onClick={async () => { if (await salva({ contenuto: c })) { setModifica(false); notify('Modifiche salvate.'); } }}>Salva</button>}
        </div>
      </div>
      <h2 className="sr-only" id={id}>{p.titolo}</h2>
      <div className="ass-pd-body">
        {modifica ? <EditorContenuto c={c} onChange={setC} /> : <VistaContenuto c={c} onApri={setScheda} />}
      </div>
      <div className="ass-pd-foot">
        {p.agenteNome && <div className="ass-help">Generato con l'agente "{p.agenteNome}".</div>}
        <Avviso />
        {conferma ? (
          <div className="confirm-box" role="alert">
            <div>Eliminare definitivamente "{p.titolo}"?</div>
            <div className="btn-row-8">
              <button type="button" className="btn btn-danger" onClick={elimina}>Elimina</button>
              <button type="button" className="btn btn-secondary" onClick={() => setConferma(false)}>Annulla</button>
            </div>
          </div>
        ) : (
          <div><button type="button" className="btn btn-ghost ass-danger-text" onClick={() => setConferma(true)}><I.Trash /> Elimina programma</button></div>
        )}
      </div>
      {stampa && <Stampa c={c} iscritto={nome} data={fmtData(p.aggiornatoIl)} onDone={() => setStampa(false)} />}
      {scheda && <SchedaEsercizio id={scheda} onClose={() => setScheda(null)} />}
    </Dialog>
  );
}

/** Programmi come righe raggruppate (scheda iscritto). */
export function ElencoProgrammi({ list }: { list: Programma[] }) {
  const [aperto, setAperto] = useState<Programma | null>(null);
  return (
    <>
      <div className="ass-rows">
        {list.map(p => (
          <button key={p.id} type="button" className="ass-row-btn" onClick={() => setAperto(p)}>
            <span className="ass-file" data-tipo="prog" aria-hidden="true"><X.Scintille size={15} /></span>
            <span className="ass-row-main">
              <span className="ass-row-title">{p.titolo}</span>
              <span className="ass-row-sub">{TIPO[p.contenuto.tipo]} · {riassunto(p.contenuto)} · {fmtData(p.aggiornatoIl)}</span>
            </span>
            <TagStato stato={p.stato} />
            <span className="ass-chevron" aria-hidden="true"><X.Freccia size={14} /></span>
          </button>
        ))}
      </div>
      {aperto && <ProgrammaDialog key={aperto.id} programma={aperto} onClose={() => setAperto(null)} />}
    </>
  );
}

/** Programmi come griglia di schede (pagina Programmi). */
function GrigliaProgrammi({ list }: { list: Programma[] }) {
  const { people } = useApp();
  const [aperto, setAperto] = useState<Programma | null>(null);
  return (
    <>
      <div className="ass-prog-grid">
        {list.map(p => {
          const nome = people.find(x => x.id === p.partecipanteId)?.name;
          const sub = sottotitolo(p.contenuto);
          return (
            <button key={p.id} type="button" className="ass-prog-card" onClick={() => setAperto(p)}>
              <span className="ass-prog-top">
                <span className="ass-prog-type">{TIPO[p.contenuto.tipo]}</span>
                <TagStato stato={p.stato} />
              </span>
              <span className="ass-prog-title">{p.titolo}</span>
              {sub && <span className="ass-prog-sub">{sub}</span>}
              <span className="ass-prog-foot">
                <span className="ass-prog-who"><X.Persona size={13} /> {nome ?? 'Seduta generica'}</span>
                <span className="tabular">{fmtData(p.aggiornatoIl)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {aperto && <ProgrammaDialog key={aperto.id} programma={aperto} onClose={() => setAperto(null)} />}
    </>
  );
}

type FiltroStato = 'tutti' | 'bozza' | 'approvato';

export function Programmi() {
  const { people } = useApp();
  const [filtro, setFiltro] = useState<string>('');
  const [stato, setStato] = useState<FiltroStato>('tutti');
  const id = useId();
  const progs = useDati(() => ass.programmi(filtro === '' ? undefined : filtro === 'generale' ? 'generale' : Number(filtro)), [filtro], ['programmi']);
  const tutti = progs.data ?? [];
  const list = stato === 'tutti' ? tutti : tutti.filter(p => p.stato === stato);
  const conta = (s: FiltroStato) => (s === 'tutti' ? tutti.length : tutti.filter(p => p.stato === s).length);
  return (
    <div className="ass-section">
      <div className="toolbar">
        <div className="toolbar-group">
          <div className="seg" role="group" aria-label="Stato dei programmi">
            {(['tutti', 'bozza', 'approvato'] as FiltroStato[]).map(s => (
              <button key={s} type="button" className="seg-opt" aria-pressed={stato === s} onClick={() => setStato(s)}>
                {s === 'tutti' ? 'Tutti' : s === 'bozza' ? 'Bozze' : 'Approvati'} <span className="ass-seg-count">{conta(s)}</span>
              </button>
            ))}
          </div>
          <label htmlFor={`${id}-f`} className="sr-only">Iscritto</label>
          <select id={`${id}-f`} className="input ass-auto" value={filtro} onChange={e => setFiltro(e.target.value)}>
            <option value="">Tutti gli iscritti</option>
            <option value="generale">Senza iscritto</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <a className="btn btn-primary" href="#/assistente/genera"><I.Plus /> Nuovo programma</a>
      </div>
      {progs.errore && <div className="error-box" role="alert">{progs.errore}</div>}
      {list.length > 0 ? <GrigliaProgrammi list={list} /> : !progs.caricamento && (
        <div className="card ass-empty-card">
          <div className="ass-empty-icon" aria-hidden="true"><X.Documento size={26} /></div>
          <h3 className="ass-empty-title">Nessun programma{filtro || stato !== 'tutti' ? ' per questo filtro' : ' salvato'}</h3>
          <p className="ass-empty-text">Genera una seduta e premi Salva: la ritrovi qui, pronta da rivedere, approvare e stampare.</p>
          <a className="btn btn-secondary" href="#/assistente/genera"><X.Scintille size={15} /> Vai a Genera</a>
        </div>
      )}
    </div>
  );
}
