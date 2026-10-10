import { useState } from 'react';
import type { Contenuto } from '../../../shared/assistente';
import { api } from '../../api';
import { useApp } from '../../store';
import { ass } from './api';
import { Avviso } from './Contenuto';
import { Risultato, useGenerazione } from './Genera';
import { useAgenti, useDati } from './hooks';
import * as X from './icone';
import { ListaDocumenti } from './Libreria';
import { ElencoProgrammi } from './Programmi';

/** Testo da aggiungere alle note dell'iscritto a partire da un'analisi. */
function comeNota(c: Contenuto, data: string): string {
  if (c.tipo === 'nota') return `[${data}] ${c.testo}`;
  if (c.tipo === 'programma') return `[${data}] Programma: ${c.titolo}`;
  const parti = [`[${data}] Analisi cartella: ${c.sintesi}`];
  if (c.puntiAttenzione.length) parti.push(`Attenzione: ${c.puntiAttenzione.join('; ')}`);
  if (c.daVerificareConMedico.length) parti.push(`Da verificare con il medico: ${c.daVerificareConMedico.join('; ')}`);
  return parti.join('\n');
}

/** Sezione "Cartella e programmi" nella scheda dell'iscritto. */
export function CartellaIscritto({ participantId }: { participantId: number }) {
  const { people, run, notify, openParticipant, today } = useApp();
  const p = people.find(x => x.id === participantId);
  const { data: agenti } = useAgenti();
  const analisti = (agenti ?? []).filter(a => a.compito === 'analizza_cartella');
  const [agenteId, setAgenteId] = useState<number | null>(null);
  const agente = analisti.find(a => a.id === agenteId) ?? analisti[0] ?? null;
  const progs = useDati(() => ass.programmi(participantId), [participantId], ['programmi']);
  const g = useGenerazione();
  const [errore, setErrore] = useState('');
  if (!p) return null;

  const analizza = () => {
    setErrore('');
    if (!agente) return setErrore('Nessun agente di analisi: ripristinalo in Impostazioni → Agenti.');
    void g.avvia({ agenteId: agente.id, partecipanteId: participantId, obiettivo: '', durata: '', attrezzi: [], livello: p.livello, limitazioni: '', note: '', documentiIds: [] });
  };
  const generaProgramma = () => {
    openParticipant(null);
    window.location.hash = `/assistente/genera?iscritto=${participantId}`;
  };
  const aggiungiNote = async (c: Contenuto) => {
    const nota = comeNota(c, today.split('-').reverse().join('/'));
    const err = await run(() => api.updateParticipant(participantId, { note: p.note ? `${p.note}\n\n${nota}` : nota }));
    notify(err ?? 'Aggiunto alle note dell\'iscritto.');
  };
  const programmi = progs.data ?? [];

  return (
    <section className="box ass-cartella" aria-label="Cartella e programmi">
      <div className="ass-cartella-head">
        <div className="box-title">
          <span className="ass-cartella-icon" aria-hidden="true"><X.Scintille size={14} /></span>
          <div className="label text-muted">Cartella e programmi</div>
        </div>
        <div className="ass-cartella-actions">
          {analisti.length > 1 && (
            <select className="input ass-auto ass-input-sm" aria-label="Agente di analisi" value={agente?.id ?? ''} onChange={e => setAgenteId(Number(e.target.value))}>
              {analisti.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-secondary" onClick={generaProgramma}>Genera programma</button>
          <button type="button" className="btn btn-primary" onClick={analizza} disabled={g.out?.stato === 'in_corso'}><X.Scintille size={14} /> Analizza cartella</button>
        </div>
      </div>

      <div className="ass-cartella-group">
        <div className="ass-cartella-sub">Documenti</div>
        <ListaDocumenti partecipanteId={participantId} compatta />
      </div>

      {errore && <div className="error-box" role="alert">{errore}</div>}
      {g.out && (
        <Risultato out={g.out} compito="analizza_cartella" iscritto={{ id: p.id, name: p.name }} input={{ partecipanteId: participantId }} agente={agente}
          onInterrompi={g.interrompi} onRigenera={analizza} onContenuto={c => g.setOut(o => o && { ...o, contenuto: c })}
          extra={g.out.stato === 'fatto' && g.out.contenuto ? (
            <div><button type="button" className="btn btn-ghost" onClick={() => aggiungiNote(g.out!.contenuto!)}>Aggiungi la sintesi alle note</button></div>
          ) : null} />
      )}

      {programmi.length > 0 && (
        <div className="ass-cartella-group">
          <div className="ass-cartella-sub">Programmi salvati <span className="ass-seg-count">{programmi.length}</span></div>
          <ElencoProgrammi list={programmi} />
        </div>
      )}
      <Avviso />
    </section>
  );
}
