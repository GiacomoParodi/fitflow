import { useEffect, useRef, useState } from 'react';
import { fmt, fmtShort } from '../../shared/dates';
import { euro, mesiLabel, paymentPeriod } from '../../shared/rules';
import { api } from '../api';
import { groupLessons } from '../derive';
import { modules } from '../modules';
import * as I from '../icons';
import { useApp } from '../store';
import { CertViewer } from './CertViewer';
import { CloseButton, Dialog } from './Dialog';

const MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf' };

/** Date input that saves shortly after the last change (or on blur), so typing a year doesn't fire four saves. */
function DateField({ id, value, onSave }: { id: string; value: string | null; onSave: (v: string | null) => void }) {
  const [local, setLocal] = useState(value ?? '');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setLocal(value ?? ''), [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = (v: string) => {
    window.clearTimeout(timer.current);
    if (v !== (value ?? '')) onSave(v || null);
  };
  return (
    <input id={id} className="input date-input" type="date" value={local}
      onChange={e => {
        const v = e.target.value;
        setLocal(v);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => commit(v), 700);
      }}
      onBlur={() => commit(local)} />
  );
}

export function ParticipantDialog({ id }: { id: number }) {
  const { state, people, today, act, run, openParticipant } = useApp();
  const p = people.find(x => x.id === id);
  const [payForm, setPayForm] = useState<{ date: string; planId: number } | null>(null);
  const [confirmUnsub, setConfirmUnsub] = useState(false);
  const [certError, setCertError] = useState('');
  const [viewer, setViewer] = useState(false);
  const close = () => openParticipant(null);

  useEffect(() => { if (!p) close(); });
  if (!p) return null;

  const course = state.courses.find(c => c.id === p.courseId);
  const lessons = groupLessons(state.lessons).get(p.courseId) ?? [];
  const plan = payForm ? state.plans.find(x => x.id === payForm.planId) : undefined;
  const preview = payForm && plan && payForm.date ? paymentPeriod(p.pagatoFino, payForm.date, plan.mesi) : null;

  const openPayForm = () => setPayForm({
    date: today,
    planId: state.plans.some(x => x.id === p.planId) ? p.planId! : state.plans[0]?.id ?? 0,
  });
  const confirmPay = async () => {
    if (!payForm || !preview) return;
    if (await act(() => api.registerPayment(p.id, payForm))) setPayForm(null);
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const type = Object.values(MIME_BY_EXT).includes(file.type) ? file.type : MIME_BY_EXT[ext];
    if (!type) return setCertError('Formato non supportato: carica un file PNG, JPEG o PDF.');
    if (file.size > 15 * 1024 * 1024) return setCertError('Il file supera i 15 MB.');
    const blob = file.type === type ? file : new File([file], file.name, { type });
    setCertError((await run(() => api.uploadCert(p.id, blob))) ?? '');
  };

  const cf = p.certFile;

  return (
    <>
      <Dialog onClose={close} className="dialog-wide" labelledBy="pd-title" zIndex={99}>
        <div className="dialog-head">
          <div>
            <div className="dialog-title" id="pd-title">{p.name}</div>
            <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>{course?.name}</div>
          </div>
          <CloseButton onClick={close} />
        </div>

        <hr className="hr" />

        <div className="facts">
          <div><div className="label text-muted">Telefono</div><div className="fact-value nowrap">{p.phone}</div></div>
          <div><div className="label text-muted">Livello</div><div className="fact-value">{p.livello}</div></div>
          <div><div className="label text-muted">Presenze</div><div className="fact-big">{p.presenzePct}</div></div>
        </div>

        {/* Abbonamento */}
        <section className="box" data-severe={p.pay.severe} aria-label="Abbonamento">
          <div className="box-row">
            <div>
              <div className="label text-muted">Abbonamento</div>
              <div className="plan-name">{p.plan?.name ?? 'Nessuno'}</div>
              {p.plan && <div className="text-muted" style={{ fontSize: 12 }}>{mesiLabel(p.plan.mesi)} · {euro(p.plan.prezzo)}</div>}
            </div>
            <div>
              <span className={p.pay.tagClass + ' nowrap'}>{p.pay.label}</span>
              <div style={{ fontSize: 13, marginTop: 6 }}>Pagato fino al <strong>{p.pay.dateLabel}</strong></div>
            </div>
          </div>
          {payForm ? (
            <div className="subform">
              <div className="form-2">
                <div className="field"><label htmlFor="pay-date">Data pagamento</label>
                  <input id="pay-date" className="input" type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} />
                </div>
                <div className="field"><label htmlFor="pay-plan">Abbonamento</label>
                  <select id="pay-plan" className="input" value={payForm.planId} onChange={e => setPayForm({ ...payForm, planId: Number(e.target.value) })}>
                    {state.plans.map(x => <option key={x.id} value={x.id}>{x.name} · {mesiLabel(x.mesi)} · {euro(x.prezzo)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ fontSize: 13 }}>
                Importo <strong>{plan ? euro(plan.prezzo) : '—'}</strong> · copre dal {fmt(preview?.dal)} al <strong>{fmt(preview?.al)}</strong>
              </div>
              <div className="btn-row-8">
                <button type="button" className="btn btn-primary" onClick={confirmPay} disabled={!preview}>Conferma pagamento</button>
                <button type="button" className="btn btn-secondary" onClick={() => setPayForm(null)}>Annulla</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex' }}>
              <button type="button" className="btn btn-primary" onClick={openPayForm} disabled={state.plans.length === 0}><I.Plus /> Registra pagamento</button>
            </div>
          )}
          <div>
            <div className="label text-muted" style={{ marginBottom: 4 }}>Storico pagamenti</div>
            {p.payments.map(py => (
              <div key={py.id} className="history-row">
                <div className="row-title">{fmt(py.date)}</div>
                <div className="text-muted">{py.planName} · {fmt(py.dal)} → {fmt(py.al)}</div>
                <div className="row-title">{euro(py.importo)}</div>
              </div>
            ))}
            {p.payments.length === 0 && <div className="text-muted" style={{ fontSize: 13 }}>Nessun pagamento registrato.</div>}
          </div>
        </section>

        {/* Iscrizione annuale */}
        <section className="box" data-severe={p.iscr.severe} aria-label="Iscrizione annuale">
          <div className="box-row bottom">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="box-title"><div className="label text-muted">Iscrizione annuale</div><span className={p.iscr.tagClass + ' nowrap'}>{p.iscr.label}</span></div>
              <div className="field"><label htmlFor="pd-iscr">Data di scadenza</label>
                <DateField id="pd-iscr" value={p.iscrizioneScadenza} onSave={v => act(() => api.updateParticipant(p.id, { iscrizioneScadenza: v }))} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <div className="text-muted" style={{ fontSize: 12 }}>Quota annuale {euro(state.settings.quotaIscrizione)}</div>
              <button type="button" className="btn btn-secondary" onClick={() => act(() => api.renewIscrizione(p.id))}><I.Refresh /> Rinnova per 1 anno</button>
            </div>
          </div>
        </section>

        {/* Certificato medico */}
        <section className="box" data-severe={p.cert.severe} aria-label="Certificato medico">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="box-title"><div className="label text-muted">Certificato medico</div><span className={p.cert.tagClass + ' nowrap'}>{p.cert.label}</span></div>
            <div className="field"><label htmlFor="pd-cert">Data di scadenza</label>
              <DateField id="pd-cert" value={p.certScadenza} onSave={v => act(() => api.updateParticipant(p.id, { certScadenza: v }))} />
            </div>
            {!p.certScadenza && <div className="warn-text">Inserisci la data di scadenza riportata sul certificato.</div>}
          </div>
          <div className="cert-file">
            <div className="file-icon" data-has-file={!!cf}><I.FileCheck /></div>
            <div className="file-info">
              <div className="label text-muted">Documento</div>
              {cf ? (
                <>
                  <div className="file-name">{cf.name}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {cf.mime === 'application/pdf' ? 'PDF' : 'Immagine'} · {Math.max(1, Math.round(cf.size / 1024))} KB · caricato il {fmt(cf.uploadedAt)}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, marginTop: 2 }}>Nessun file caricato · PNG, JPEG o PDF</div>
              )}
            </div>
            <div className="btn-row">
              {cf && <button type="button" className="btn btn-primary" onClick={() => setViewer(true)}><I.Eye /> Visualizza</button>}
              <label className="btn btn-secondary">
                <I.Upload /> {cf ? 'Sostituisci' : 'Carica file'}
                <input type="file" className="sr-only" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" onChange={onUpload} />
              </label>
              {cf && (
                <button type="button" className="btn btn-icon btn-secondary" title="Rimuovi file" aria-label="Rimuovi file"
                  onClick={() => { if (window.confirm('Rimuovere il file del certificato?')) act(() => api.removeCert(p.id)); }}>
                  <I.Trash />
                </button>
              )}
            </div>
          </div>
          {certError && <div className="error-box" role="alert">{certError}</div>}
        </section>

        {/* Registro presenze */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div className="label text-muted">Registro presenze</div>
            <div className="text-muted" style={{ fontSize: 12 }}>{p.presenzeFatte}/{p.presenzeTotali} lezioni</div>
          </div>
          <div className="register">
            {lessons.map(l => {
              const present = l.present.includes(p.id);
              const f = fmtShort(l.date);
              return (
                <div key={l.id} className="register-cell" title={present ? 'Presente' : 'Assente'}>
                  <div className="register-box" data-present={present}>
                    {present
                      ? <span style={{ color: 'var(--color-bg)', lineHeight: 0 }}><I.Check size={14} /></span>
                      : <span style={{ color: 'var(--color-accent)', lineHeight: 0 }}><I.X size={14} /></span>}
                  </div>
                  <div className="register-date text-muted">{f.day} {f.label}</div>
                </div>
              );
            })}
          </div>
          {lessons.length === 0 && <div className="text-muted" style={{ fontSize: 13 }}>Nessuna lezione registrata.</div>}
        </section>

        {modules.flatMap(m => m.participantSections ?? []).map((Section, i) => <Section key={i} participantId={p.id} />)}

        <section>
          <div className="label text-muted" style={{ marginBottom: 6 }}>Note</div>
          <div className="note-text">{p.note || <span className="text-muted">Nessuna nota.</span>}</div>
        </section>

        <hr className="hr" />

        {confirmUnsub ? (
          <div className="confirm-box" role="alert">
            <div className="row-title">Disiscrivere {p.name} da {course?.name}?</div>
            <div style={{ fontSize: 13 }}>Il partecipante verrà rimosso dal corso e dal registro presenze; il certificato e la cartella dell'assistente (documenti e programmi) verranno cancellati. I pagamenti restano negli incassi.</div>
            <div className="btn-row-8">
              <button type="button" className="btn btn-primary" onClick={() => act(() => api.unsubscribe(p.id))}>Conferma disiscrizione</button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmUnsub(false)}>Annulla</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div className="text-muted" style={{ fontSize: 12 }}>Iscritto a {course?.name}</div>
            <button type="button" className="btn btn-secondary danger-btn" onClick={() => setConfirmUnsub(true)}><I.UserMinus /> Disiscrivi dal corso</button>
          </div>
        )}
      </Dialog>

      {viewer && cf && <CertViewer participantId={p.id} owner={p.name} file={cf} onClose={() => setViewer(false)} />}
    </>
  );
}
