import { useState } from 'react';
import { addMonths, fmt } from '../../shared/dates';
import { euro, mesiLabel } from '../../shared/rules';
import { LIVELLI, type Course, type Livello } from '../../shared/types';
import { api } from '../api';
import { countLabel } from '../derive';
import { useApp } from '../store';
import { CloseButton, Dialog } from './Dialog';

export function NewParticipantDialog({ course, enrolled, onClose }: { course: Course; enrolled: number; onClose: () => void }) {
  const { state, today, run } = useApp();
  const [f, setF] = useState({
    name: '', phone: '', livello: 'Base' as Livello, planId: state.plans[0]?.id ?? 0,
    iscrizioneScadenza: state.settings.scadenzaStagione, certScadenza: '', paid: true, note: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: k === 'planId' ? Number(e.target.value) : e.target.value });
  const plan = state.plans.find(p => p.id === f.planId);

  const save = async () => {
    if (!f.name.trim() || !f.phone.trim()) return setError('Nome e telefono sono obbligatori.');
    if (!plan) return setError('Scegli un abbonamento (puoi crearne uno in Impostazioni).');
    if (enrolled >= course.capienza) return setError('Il corso è al completo.');
    setBusy(true);
    const err = await run(() => api.createParticipant({
      courseId: course.id, name: f.name, phone: f.phone, livello: f.livello, note: f.note, planId: f.planId,
      iscrizioneScadenza: f.iscrizioneScadenza || null, certScadenza: f.certScadenza || null, paid: f.paid,
    }));
    setBusy(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <Dialog onClose={onClose} className="dialog-form" labelledBy="nf-title" zIndex={100}>
      <div className="dialog-head">
        <div>
          <div className="kicker" style={{ fontSize: 11 }}>Nuovo iscritto</div>
          <div className="dialog-title" id="nf-title">{course.name}</div>
          <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>Posti occupati {countLabel(enrolled, course)}</div>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <hr className="hr" />
      <div className="form-2">
        <div className="field"><label htmlFor="nf-name">Nome e cognome</label><input id="nf-name" className="input" value={f.name} onChange={set('name')} placeholder="Es. Anna Bruni" autoFocus /></div>
        <div className="field"><label htmlFor="nf-phone">Telefono</label><input id="nf-phone" className="input" type="tel" value={f.phone} onChange={set('phone')} placeholder="333 000 0000" /></div>
        <div className="field"><label htmlFor="nf-plan">Abbonamento</label>
          <select id="nf-plan" className="input" value={f.planId} onChange={set('planId')}>
            {state.plans.map(p => <option key={p.id} value={p.id}>{p.name} · {mesiLabel(p.mesi)} · {euro(p.prezzo)}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="nf-livello">Livello</label>
          <select id="nf-livello" className="input" value={f.livello} onChange={set('livello')}>
            {LIVELLI.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="nf-iscr">Scadenza iscrizione annuale</label><input id="nf-iscr" className="input" type="date" value={f.iscrizioneScadenza} onChange={set('iscrizioneScadenza')} /></div>
        <div className="field"><label htmlFor="nf-cert">Scadenza certificato medico</label><input id="nf-cert" className="input" type="date" value={f.certScadenza} onChange={set('certScadenza')} /></div>
      </div>
      <div className="field"><label id="nf-paid">Primo pagamento abbonamento</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="seg" role="group" aria-labelledby="nf-paid">
            <button type="button" className="seg-opt" aria-pressed={f.paid} onClick={() => setF({ ...f, paid: true })}>Pagato oggi</button>
            <button type="button" className="seg-opt" aria-pressed={!f.paid} onClick={() => setF({ ...f, paid: false })}>Da pagare</button>
          </div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {plan && (f.paid ? `${euro(plan.prezzo)} · coperto fino al ${fmt(addMonths(today, plan.mesi))}` : 'Risulterà da pagare')}
          </div>
        </div>
      </div>
      <div className="field"><label htmlFor="nf-note">Note</label><textarea id="nf-note" className="input" value={f.note} onChange={set('note')} placeholder="Informazioni utili per l'istruttore" /></div>
      {error && <div className="error-box" role="alert">{error}</div>}
      <div className="dialog-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>Iscrivi al corso</button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
      </div>
    </Dialog>
  );
}
