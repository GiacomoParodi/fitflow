import './dashboard.css';
import { fmtLong, weekday } from '../../shared/dates';
import { PageHead, SectionTitle } from '../components/PageHead';
import { countLabel } from '../derive';
import { useApp } from '../store';

interface Avviso {
  key: string;
  pid: number;
  courseId: number;
  name: string;
  desc: string;
  label: string;
  tagClass: string;
  severe: boolean;
}

export function Dashboard() {
  const { state, people, today, go, openParticipant } = useApp();
  const { courses, settings } = state;

  const todayCourses = courses
    .filter(c => c.giorni.includes(weekday(today)))
    .sort((a, b) => a.orario.localeCompare(b.orario));
  const certDaRinnovare = people.filter(p => p.cert.status !== 'valido').length;

  const avvisi: Avviso[] = [];
  for (const p of people) {
    const base = { pid: p.id, courseId: p.courseId, name: p.name };
    if (p.cert.status !== 'valido') avvisi.push({
      ...base, key: `${p.id}-cert`, label: p.cert.label, tagClass: p.cert.tagClass, severe: p.cert.severe,
      desc: p.certScadenza ? `Certificato medico · scade il ${p.cert.dateLabel}` : 'Certificato medico mancante',
    });
    if (p.pay.status !== 'valido') avvisi.push({
      ...base, key: `${p.id}-pay`, label: p.pay.label, tagClass: p.pay.tagClass, severe: p.pay.severe,
      desc: p.pagatoFino ? `Abbonamento ${p.plan?.name ?? ''} · pagato fino al ${p.pay.dateLabel}` : `Abbonamento ${p.plan?.name ?? ''} · nessun pagamento`,
    });
    if (p.iscr.status !== 'valido') avvisi.push({
      ...base, key: `${p.id}-iscr`, label: p.iscr.label, tagClass: p.iscr.tagClass, severe: p.iscr.severe,
      desc: p.iscrizioneScadenza ? `Iscrizione annuale · scade il ${p.iscr.dateLabel}` : 'Iscrizione annuale mancante',
    });
  }
  avvisi.sort((a, b) => Number(b.severe) - Number(a.severe));

  const openAvviso = (a: Avviso) => { go('corsi', a.courseId); openParticipant(a.pid); };

  return (
    <div className="page page-narrow">
      <PageHead
        page="dashboard"
        title="Panoramica"
        aside={
          <div className="greeting">
            <strong>Ciao{settings.instructorName ? `, ${settings.instructorName}` : ''}</strong>
            <span className="text-muted">{fmtLong(today)}</span>
          </div>
        }
      />

      <div className="kpis">
        <div className="kpi kpi-1">
          <div className="label">Iscritti totali</div>
          <div className="kpi-value">{people.length}</div>
        </div>
        <div className="kpi kpi-2">
          <div className="label">Corsi attivi</div>
          <div className="kpi-value">{courses.length}</div>
        </div>
        <div className="kpi kpi-3">
          <div className="label">Certificati da rinnovare</div>
          <div className="kpi-value">{certDaRinnovare}</div>
        </div>
      </div>

      <hr className="hr" />

      <div className="cols-2">
        <section className="col-left">
          <SectionTitle num="02">Lezioni di oggi</SectionTitle>
          {todayCourses.map(c => (
            <button key={c.id} type="button" className="clickable lesson-row" onClick={() => go('corsi', c.id)}>
              <div className="lesson-time">{c.orario}</div>
              <div className="lesson-body">
                <div className="row-title">{c.name}</div>
                <div className="row-sub text-muted">{countLabel(people.filter(p => p.courseId === c.id).length, c)}</div>
              </div>
            </button>
          ))}
          {todayCourses.length === 0 && <div className="empty text-muted">Nessuna lezione in programma oggi.</div>}
        </section>

        <section className="col-right">
          <SectionTitle num="03">Avvisi</SectionTitle>
          {avvisi.map(a => (
            <button key={a.key} type="button" className="clickable alert-row" data-severe={a.severe} onClick={() => openAvviso(a)}>
              <div style={{ minWidth: 0 }}>
                <div className="row-title">{a.name}</div>
                <div className="row-sub text-muted">{a.desc}</div>
              </div>
              <span className={a.tagClass}>{a.label}</span>
            </button>
          ))}
          {avvisi.length === 0 && <div className="empty text-muted">Nessun avviso: tutti in regola.</div>}
        </section>
      </div>
    </div>
  );
}
