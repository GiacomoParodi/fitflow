import './participant.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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

/** System hues for the monogram avatar: each person keeps the same one. */
const AVATAR_HUES = ['--blue', '--purple', '--pink', '--orange', '--green', '--teal', '--indigo', '--red'];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Circular monogram with a stable tint per person. */
export function PdAvatar({ id, name, size = 72 }: { id: number; name: string; size?: number }) {
  const hue = AVATAR_HUES[Math.abs(id) % AVATAR_HUES.length];
  return (
    <div className="pd-avatar" aria-hidden="true"
      style={{ ['--pd-hue' as string]: `var(${hue})`, width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {initials(name)}
    </div>
  );
}

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
    <input id={id} className="input pd-date" type="date" value={local}
      onChange={e => {
        const v = e.target.value;
        setLocal(v);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => commit(v), 700);
      }}
      onBlur={() => commit(local)} />
  );
}

/** A titled group of rows, as in System Settings / Health. */
function Group({ title, aside, footer, children, label }: { title: string; aside?: ReactNode; footer?: ReactNode; children: ReactNode; label?: string }) {
  return (
    <section className="pd-group" aria-label={label ?? title}>
      <div className="pd-group-head">
        <h3 className="pd-group-title">{title}</h3>
        {aside && <div className="pd-group-aside">{aside}</div>}
      </div>
      <div className="pd-card">{children}</div>
      {footer && <div className="pd-group-foot">{footer}</div>}
    </section>
  );
}

function Row({ label, htmlFor, children, sub }: { label: ReactNode; htmlFor?: string; children?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="pd-row">
      <div className="pd-row-label">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
        {sub && <div className="pd-row-sub">{sub}</div>}
      </div>
      {children !== undefined && <div className="pd-row-value">{children}</div>}
    </div>
  );
}

export function ParticipantDialog({ id }: { id: number }) {
  const { state, people, today, act, run, openParticipant } = useApp();
  const p = people.find(x => x.id === id);
  const [payForm, setPayForm] = useState<{ date: string; planId: number } | null>(null);
  const [confirmUnsub, setConfirmUnsub] = useState(false);
  const [certError, setCertError] = useState('');
  const [viewer, setViewer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLHeadingElement>(null);
  const unsubCancelRef = useRef<HTMLButtonElement>(null);
  const close = () => openParticipant(null);

  useEffect(() => { if (!p) close(); });

  // Show the name in the title bar once the big one has scrolled under it.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { rootMargin: '-60px 0px 0px 0px', threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [!!p]);

  useEffect(() => { if (confirmUnsub) unsubCancelRef.current?.focus(); }, [confirmUnsub]);

  if (!p) return null;

  const course = state.courses.find(c => c.id === p.courseId);
  const lessons = groupLessons(state.lessons).get(p.courseId) ?? [];
  const plan = payForm ? state.plans.find(x => x.id === payForm.planId) : undefined;
  const preview = payForm && plan && payForm.date ? paymentPeriod(p.pagatoFino, payForm.date, plan.mesi) : null;
  const pct = p.presenzeTotali ? Math.round((p.presenzeFatte / p.presenzeTotali) * 100) : 0;

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
  const modSections = modules.flatMap(m => m.participantSections ?? []);

  return (
    <>
      <Dialog onClose={close} variant="sheet" className="pd-sheet" labelledBy="pd-title" zIndex={99}>
        <div className="dialog-sheet-bar" data-scrolled={scrolled}>
          <div className="pd-bar-title" aria-hidden={!scrolled} data-visible={scrolled}>
            <PdAvatar id={p.id} name={p.name} size={26} />
            <span className="pd-bar-name">{p.name}</span>
          </div>
          <CloseButton onClick={close} />
        </div>

        <div className="dialog-sheet-body">
          {/* Intestazione */}
          <header className="pd-hero">
            <PdAvatar id={p.id} name={p.name} />
            <div className="pd-hero-text">
              <h2 className="pd-name" id="pd-title" ref={heroRef}>{p.name}</h2>
              <div className="pd-course">{course?.name ?? 'Nessun corso'}</div>
            </div>
          </header>

          <div className="pd-facts">
            <a className="pd-fact pd-fact-link" href={`tel:${p.phone.replace(/[^\d+]/g, '')}`} title={`Chiama ${p.phone}`}>
              <span className="pd-fact-label">Telefono</span>
              <span className="pd-fact-value tabular nowrap">{p.phone || '—'}</span>
            </a>
            <div className="pd-fact">
              <span className="pd-fact-label">Livello</span>
              <span className="pd-fact-value">{p.livello}</span>
            </div>
            <div className="pd-fact">
              <span className="pd-fact-label">Presenze</span>
              <span className="pd-fact-value tabular">{p.presenzePct}</span>
              <span className="pd-meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
            </div>
          </div>

          {/* Abbonamento */}
          <Group title="Abbonamento" aside={<span className={p.pay.tagClass}>{p.pay.label}</span>}>
            <Row label="Piano" sub={p.plan ? `${mesiLabel(p.plan.mesi)} · ${euro(p.plan.prezzo)}` : undefined}>
              <span className="pd-strong">{p.plan?.name ?? 'Nessuno'}</span>
            </Row>
            <Row label="Pagato fino al"><span className="tabular" data-tone={p.pay.severe ? 'danger' : undefined}>{p.pay.dateLabel}</span></Row>
            {payForm ? (
              <div className="pd-subform">
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
                <div className="pd-summary">
                  <div><div className="pd-summary-label">Importo</div><div className="pd-summary-value tabular">{plan ? euro(plan.prezzo) : '—'}</div></div>
                  <div><div className="pd-summary-label">Copertura</div><div className="pd-summary-value tabular">{fmt(preview?.dal)} → {fmt(preview?.al)}</div></div>
                </div>
                <div className="pd-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setPayForm(null)}>Annulla</button>
                  <button type="button" className="btn btn-primary" onClick={confirmPay} disabled={!preview}>Conferma pagamento</button>
                </div>
              </div>
            ) : (
              <button type="button" className="pd-row pd-row-action" onClick={openPayForm} disabled={state.plans.length === 0}>
                <I.Plus /> Registra pagamento
              </button>
            )}
          </Group>

          <Group title="Storico pagamenti" aside={p.payments.length > 0 ? <span className="text-muted tabular">{p.payments.length}</span> : undefined}>
            {p.payments.map(py => (
              <div key={py.id} className="pd-row">
                <div className="pd-row-label">
                  <span className="tabular">{fmt(py.date)}</span>
                  <div className="pd-row-sub tabular">{py.planName} · {fmt(py.dal)} → {fmt(py.al)}</div>
                </div>
                <div className="pd-row-value pd-strong tabular">{euro(py.importo)}</div>
              </div>
            ))}
            {p.payments.length === 0 && <div className="pd-row pd-empty">Nessun pagamento registrato.</div>}
          </Group>

          {/* Iscrizione annuale */}
          <Group title="Iscrizione annuale" aside={<span className={p.iscr.tagClass}>{p.iscr.label}</span>}>
            <Row label="Scadenza" htmlFor="pd-iscr">
              <DateField id="pd-iscr" value={p.iscrizioneScadenza} onSave={v => act(() => api.updateParticipant(p.id, { iscrizioneScadenza: v }))} />
            </Row>
            <Row label="Rinnovo" sub={`Quota annuale ${euro(state.settings.quotaIscrizione)}`}>
              <button type="button" className="btn btn-secondary" onClick={() => act(() => api.renewIscrizione(p.id))}><I.Refresh /> Rinnova per 1 anno</button>
            </Row>
          </Group>

          {/* Certificato medico */}
          <Group title="Certificato medico" aside={<span className={p.cert.tagClass}>{p.cert.label}</span>}
            footer={!p.certScadenza ? <span className="warn-text">Inserisci la data di scadenza riportata sul certificato.</span> : undefined}>
            <Row label="Scadenza" htmlFor="pd-cert">
              <DateField id="pd-cert" value={p.certScadenza} onSave={v => act(() => api.updateParticipant(p.id, { certScadenza: v }))} />
            </Row>
            <div className="pd-row pd-file">
              <div className="pd-file-icon" data-has-file={!!cf}><I.FileCheck /></div>
              <div className="pd-file-info">
                {cf ? (
                  <>
                    <div className="pd-file-name" title={cf.name}>{cf.name}</div>
                    <div className="pd-row-sub tabular">
                      {cf.mime === 'application/pdf' ? 'PDF' : 'Immagine'} · {Math.max(1, Math.round(cf.size / 1024))} KB · caricato il {fmt(cf.uploadedAt)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="pd-file-name">Nessun documento</div>
                    <div className="pd-row-sub">PNG, JPEG o PDF, fino a 15 MB</div>
                  </>
                )}
              </div>
              <div className="pd-file-actions">
                {cf && <button type="button" className="btn btn-secondary" onClick={() => setViewer(true)}><I.Eye /> Visualizza</button>}
                <label className="btn btn-secondary">
                  <I.Upload /> {cf ? 'Sostituisci' : 'Carica file'}
                  <input type="file" className="sr-only" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" onChange={onUpload} />
                </label>
                {cf && (
                  <button type="button" className="btn btn-icon pd-icon-danger" title="Elimina file" aria-label="Elimina file del certificato"
                    onClick={() => { if (window.confirm('Rimuovere il file del certificato?')) act(() => api.removeCert(p.id)); }}>
                    <I.Trash />
                  </button>
                )}
              </div>
            </div>
            {certError && <div className="pd-row"><div className="error-box pd-grow" role="alert">{certError}</div></div>}
          </Group>

          {/* Registro presenze */}
          <Group title="Registro presenze" aside={<span className="text-muted tabular">{p.presenzeFatte}/{p.presenzeTotali} lezioni</span>}>
            {lessons.length > 0 ? (
              <div className="pd-register">
                {lessons.map(l => {
                  const present = l.present.includes(p.id);
                  const f = fmtShort(l.date);
                  return (
                    <div key={l.id} className="pd-reg-cell" title={`${fmt(l.date)} · ${present ? 'Presente' : 'Assente'}`}>
                      <div className="pd-reg-dot" data-present={present}>
                        {present && <I.Check size={12} />}
                        <span className="sr-only">{present ? 'Presente' : 'Assente'}</span>
                      </div>
                      <div className="pd-reg-day">{f.day}</div>
                      <div className="pd-reg-date tabular">{f.label}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pd-row pd-empty">Nessuna lezione registrata.</div>
            )}
          </Group>

          {/* Sezioni dei moduli (es. Cartella e programmi dell'assistente) */}
          {modSections.length > 0 && (
            <div className="pd-modules">
              {modSections.map((Section, i) => <Section key={i} participantId={p.id} />)}
            </div>
          )}

          <Group title="Note">
            <div className="pd-row pd-note">{p.note || <span className="text-muted">Nessuna nota.</span>}</div>
          </Group>

          {/* Disiscrizione */}
          <section className="pd-group" aria-label="Disiscrizione">
            {confirmUnsub ? (
              <div className="pd-card pd-confirm" role="alert">
                <div className="pd-confirm-title">Disiscrivere {p.name} da {course?.name}?</div>
                <div className="pd-confirm-text">
                  Il partecipante verrà rimosso dal corso e dal registro presenze; il certificato e la cartella dell'assistente
                  (documenti e programmi) verranno cancellati. I pagamenti restano negli incassi.
                </div>
                <div className="pd-actions">
                  <button type="button" ref={unsubCancelRef} className="btn btn-secondary" onClick={() => setConfirmUnsub(false)}>Annulla</button>
                  <button type="button" className="btn pd-btn-destructive" onClick={() => act(() => api.unsubscribe(p.id))}><I.UserMinus /> Conferma disiscrizione</button>
                </div>
              </div>
            ) : (
              <div className="pd-card">
                <button type="button" className="pd-row pd-row-action pd-row-danger" onClick={() => setConfirmUnsub(true)}>
                  <I.UserMinus /> Disiscrivi dal corso
                </button>
              </div>
            )}
            <div className="pd-group-foot">Iscritto a {course?.name}</div>
          </section>
        </div>
      </Dialog>

      {viewer && cf && <CertViewer participantId={p.id} owner={p.name} file={cf} onClose={() => setViewer(false)} />}
    </>
  );
}
