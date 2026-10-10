import { useId, useState } from 'react';
import type { Contenuto, Programma } from '../../../shared/assistente';
import { CloseButton, Dialog } from '../../components/Dialog';
import { useApp } from '../../store';
import { ass, avvisaCambio, messaggio } from './api';
import { EditorContenuto, Stampa, VistaContenuto } from './Contenuto';
import { fmtData, useDati } from './hooks';
import { SchedaEsercizio } from './Libreria';

const TIPO: Record<Contenuto['tipo'], string> = { programma: 'Programma', analisi: 'Analisi', nota: 'Nota' };

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
    <Dialog onClose={onClose} className="dialog-wide ass-prog-dialog" labelledBy={id} zIndex={110}>
      <div className="dialog-head">
        <div>
          <div className="label text-muted">{TIPO[p.contenuto.tipo]}{nome ? ` · ${nome}` : ''} · {fmtData(p.aggiornatoIl)}</div>
          <div className="dialog-title" id={id}>{p.titolo}</div>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="ass-row">
        <div className="seg" role="group" aria-label="Stato">
          <button type="button" className="seg-opt" aria-pressed={p.stato === 'bozza'} onClick={() => p.stato !== 'bozza' && salva({ stato: 'bozza' })}>Bozza</button>
          <button type="button" className="seg-opt" aria-pressed={p.stato === 'approvato'} onClick={() => p.stato !== 'approvato' && salva({ stato: 'approvato' })}>Approvato</button>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" aria-pressed={modifica} onClick={() => setModifica(m => !m)}>{modifica ? 'Anteprima' : 'Modifica'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => setStampa(true)}>Stampa</button>
          {cambiato && <button type="button" className="btn btn-primary" onClick={async () => { if (await salva({ contenuto: c })) { setModifica(false); notify('Modifiche salvate.'); } }}>Salva</button>}
        </div>
      </div>
      {p.agenteNome && <div className="text-muted ass-small">Generato con l'agente "{p.agenteNome}". Suggerimenti di un modello locale: la valutazione resta del professionista.</div>}
      {modifica ? <EditorContenuto c={c} onChange={setC} /> : <VistaContenuto c={c} onApri={setScheda} />}
      <hr className="hr" />
      {conferma ? (
        <div className="confirm-box" role="alert">
          <div>Eliminare definitivamente "{p.titolo}"?</div>
          <div className="btn-row-8">
            <button type="button" className="btn btn-primary" onClick={elimina}>Elimina</button>
            <button type="button" className="btn btn-secondary" onClick={() => setConferma(false)}>Annulla</button>
          </div>
        </div>
      ) : (
        <div><button type="button" className="btn btn-ghost danger-btn" onClick={() => setConferma(true)}>Elimina</button></div>
      )}
      {stampa && <Stampa c={c} iscritto={nome} data={fmtData(p.aggiornatoIl)} onDone={() => setStampa(false)} />}
      {scheda && <SchedaEsercizio id={scheda} onClose={() => setScheda(null)} />}
    </Dialog>
  );
}

/** Tabella di programmi (pagina Programmi e scheda iscritto). */
export function TabellaProgrammi({ list, mostraIscritto }: { list: Programma[]; mostraIscritto: boolean }) {
  const { people } = useApp();
  const [aperto, setAperto] = useState<Programma | null>(null);
  return (
    <>
      <div className="scroll-x">
        <table className="table">
          <thead><tr><th>Titolo</th>{mostraIscritto && <th>Iscritto</th>}<th>Tipo</th><th>Stato</th><th>Aggiornato</th></tr></thead>
          <tbody>
            {list.map(p => (
              <tr key={p.id} className="row-link" tabIndex={0} onClick={() => setAperto(p)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAperto(p); } }}>
                <td><div className="row-title">{p.titolo}</div></td>
                {mostraIscritto && <td className="ass-small">{people.find(x => x.id === p.partecipanteId)?.name ?? <span className="text-muted">—</span>}</td>}
                <td className="ass-small">{TIPO[p.contenuto.tipo]}</td>
                <td><span className={`tag ${p.stato === 'approvato' ? 'tag-neutral' : 'tag-outline'} nowrap`}>{p.stato === 'approvato' ? 'Approvato' : 'Bozza'}</span></td>
                <td className="text-muted ass-small nowrap">{fmtData(p.aggiornatoIl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {aperto && <ProgrammaDialog key={aperto.id} programma={aperto} onClose={() => setAperto(null)} />}
    </>
  );
}

export function Programmi() {
  const { people } = useApp();
  const [filtro, setFiltro] = useState<string>('');
  const id = useId();
  const progs = useDati(() => ass.programmi(filtro === '' ? undefined : filtro === 'generale' ? 'generale' : Number(filtro)), [filtro], ['programmi']);
  const list = progs.data ?? [];
  return (
    <div className="ass-stack">
      <div className="toolbar">
        <div className="field">
          <label htmlFor={`${id}-f`}>Iscritto</label>
          <select id={`${id}-f`} className="input" value={filtro} onChange={e => setFiltro(e.target.value)}>
            <option value="">Tutti</option>
            <option value="generale">Senza iscritto</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <a className="btn btn-primary" href="#/assistente/genera">Nuovo programma</a>
      </div>
      {progs.errore && <div className="error-box" role="alert">{progs.errore}</div>}
      {list.length > 0 ? <TabellaProgrammi list={list} mostraIscritto /> : !progs.caricamento && (
        <div className="empty text-muted">Nessun programma salvato{filtro ? ' per questo filtro' : ''}. Generane uno e premi Salva.</div>
      )}
    </div>
  );
}
