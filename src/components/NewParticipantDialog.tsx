import './new-participant.css';
import { useRef, useState } from 'react';
import { addMonths, fmt } from '../../shared/dates';
import { euro, mesiLabel } from '../../shared/rules';
import { LIVELLI, type Course, type Livello } from '../../shared/types';
import { api } from '../api';
import { countLabel } from '../derive';
import { useApp } from '../store';
import { CloseButton, Dialog, useDialogClose } from './Dialog';

type FieldKey = 'name' | 'phone' | 'plan';

export function NewParticipantDialog({ course, enrolled, onClose }: { course: Course; enrolled: number; onClose: () => void }) {
  return (
    <Dialog onClose={onClose} className="nf-dialog" labelledBy="nf-title" zIndex={100}>
      <NewParticipantForm course={course} enrolled={enrolled} onClose={onClose} />
    </Dialog>
  );
}

function NewParticipantForm({ course, enrolled, onClose }: { course: Course; enrolled: number; onClose: () => void }) {
  const { state, today, run } = useApp();
  const animateClose = useDialogClose();
  const [f, setF] = useState({
    name: '', phone: '', livello: 'Base' as Livello, planId: state.plans[0]?.id ?? 0,
    iscrizioneScadenza: state.settings.scadenzaStagione, certScadenza: '', paid: true, note: '',
  });
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<Set<FieldKey>>(new Set());
  const [busy, setBusy] = useState(false);
  const refs = { name: useRef<HTMLInputElement>(null), phone: useRef<HTMLInputElement>(null), plan: useRef<HTMLSelectElement>(null) };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF({ ...f, [k]: k === 'planId' ? Number(e.target.value) : e.target.value });
    if (invalid.size) {
      const next = new Set(invalid);
      next.delete(k === 'planId' ? 'plan' : k as FieldKey);
      setInvalid(next);
    }
  };
  const plan = state.plans.find(p => p.id === f.planId);
  const full = enrolled >= course.capienza;

  const fail = (msg: string, fields: FieldKey[] = []) => {
    setError(msg);
    setInvalid(new Set(fields));
    if (fields[0]) refs[fields[0]].current?.focus();
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const missing: FieldKey[] = [];
    if (!f.name.trim()) missing.push('name');
    if (!f.phone.trim()) missing.push('phone');
    if (missing.length) return fail(missing.length === 2 ? 'Nome e telefono sono obbligatori.' : missing[0] === 'name' ? 'Il nome è obbligatorio.' : 'Il telefono è obbligatorio.', missing);
    if (!plan) return fail('Scegli un abbonamento (puoi crearne uno in Impostazioni).', ['plan']);
    if (full) return fail('Il corso è al completo.');
    setBusy(true);
    const err = await run(() => api.createParticipant({
      courseId: course.id, name: f.name, phone: f.phone, livello: f.livello, note: f.note, planId: f.planId,
      iscrizioneScadenza: f.iscrizioneScadenza || null, certScadenza: f.certScadenza || null, paid: f.paid,
    }));
    setBusy(false);
    if (err) fail(err);
    else animateClose(onClose);
  };

  return (
    <form className="nf-form" onSubmit={save} noValidate>
      <div className="nf-head">
        <div className="nf-head-text">
          <div className="dialog-title" id="nf-title">Nuovo iscritto</div>
          <div className="nf-sub">
            {course.name} · <span className="tabular" data-full={full}>posti occupati {countLabel(enrolled, course)}</span>
          </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="nf-body">
        {full && <div className="info-box nf-full" role="status">Il corso è al completo: per iscrivere qualcuno aumenta la capienza in Impostazioni → Corsi.</div>}

        <fieldset className="nf-group">
          <legend className="nf-legend">Dati personali</legend>
          <div className="nf-card">
            <div className="form-2">
              <div className="field"><label htmlFor="nf-name">Nome e cognome</label>
                <input id="nf-name" ref={refs.name} className="input" value={f.name} onChange={set('name')} placeholder="Es. Anna Bruni" autoFocus
                  autoComplete="off" aria-invalid={invalid.has('name') || undefined} aria-required="true" />
              </div>
              <div className="field"><label htmlFor="nf-phone">Telefono</label>
                <input id="nf-phone" ref={refs.phone} className="input" type="tel" value={f.phone} onChange={set('phone')} placeholder="333 000 0000"
                  autoComplete="off" aria-invalid={invalid.has('phone') || undefined} aria-required="true" />
              </div>
            </div>
            <div className="field">
              <span className="field-label" id="nf-livello">Livello</span>
              <div className="seg nf-seg" role="group" aria-labelledby="nf-livello">
                {LIVELLI.map(l => (
                  <button key={l} type="button" className="seg-opt" aria-pressed={f.livello === l} onClick={() => setF({ ...f, livello: l })}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="nf-group">
          <legend className="nf-legend">Abbonamento</legend>
          <div className="nf-card">
            <div className="field"><label htmlFor="nf-plan">Piano</label>
              <select id="nf-plan" ref={refs.plan} className="input" value={f.planId} onChange={set('planId')} aria-invalid={invalid.has('plan') || undefined}>
                {state.plans.length === 0 && <option value={0}>Nessun abbonamento disponibile</option>}
                {state.plans.map(p => <option key={p.id} value={p.id}>{p.name} · {mesiLabel(p.mesi)} · {euro(p.prezzo)}</option>)}
              </select>
            </div>
            <div className="field">
              <span className="field-label" id="nf-paid">Primo pagamento</span>
              <div className="seg nf-seg" role="group" aria-labelledby="nf-paid">
                <button type="button" className="seg-opt" aria-pressed={f.paid} onClick={() => setF({ ...f, paid: true })}>Pagato oggi</button>
                <button type="button" className="seg-opt" aria-pressed={!f.paid} onClick={() => setF({ ...f, paid: false })}>Da pagare</button>
              </div>
            </div>
            {plan && (
              <div className="nf-summary" aria-live="polite">
                {f.paid ? (
                  <>
                    <div><div className="nf-summary-label">Importo incassato oggi</div><div className="nf-summary-value tabular">{euro(plan.prezzo)}</div></div>
                    <div><div className="nf-summary-label">Coperto fino al</div><div className="nf-summary-value tabular">{fmt(addMonths(today, plan.mesi))}</div></div>
                  </>
                ) : (
                  <>
                    <div><div className="nf-summary-label">Importo</div><div className="nf-summary-value tabular">{euro(plan.prezzo)}</div></div>
                    <div><div className="nf-summary-label">Stato</div><div className="nf-summary-value nf-due">Risulterà da pagare</div></div>
                  </>
                )}
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="nf-group">
          <legend className="nf-legend">Scadenze</legend>
          <div className="nf-card">
            <div className="form-2">
              <div className="field"><label htmlFor="nf-iscr">Iscrizione annuale</label><input id="nf-iscr" className="input" type="date" value={f.iscrizioneScadenza} onChange={set('iscrizioneScadenza')} /></div>
              <div className="field"><label htmlFor="nf-cert">Certificato medico</label><input id="nf-cert" className="input" type="date" value={f.certScadenza} onChange={set('certScadenza')} /></div>
            </div>
            {!f.certScadenza && <div className="nf-hint">Se il certificato non è ancora arrivato lascia vuoto: risulterà mancante.</div>}
          </div>
        </fieldset>

        <fieldset className="nf-group">
          <legend className="nf-legend"><label htmlFor="nf-note">Note</label></legend>
          <div className="nf-card">
            <textarea id="nf-note" className="input" value={f.note} onChange={set('note')} placeholder="Informazioni utili per l'istruttore" rows={3} />
          </div>
        </fieldset>
      </div>

      <div className="nf-foot">
        {error ? <div className="error-box nf-error" role="alert">{error}</div> : <div />}
        <div className="nf-buttons">
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => animateClose(onClose)}>Annulla</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Iscrizione…' : 'Iscrivi'}</button>
        </div>
      </div>
    </form>
  );
}
