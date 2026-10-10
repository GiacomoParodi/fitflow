import { fileNameHeader } from '../../api';
import express, { type Request, type Response } from 'express';
import { ApiError } from '../../store';
import type { EventoDownload, EventoGenerazione } from '../../../shared/assistente';
import { consigliati } from './modelli';
import { URL_PREDEFINITI } from './providers';
import { isAbort } from './providers/http';
import { MAX_FILE_BYTES } from './conoscenza/estrazione';
import { genera, prepara } from './generazione/esegui';
import type { Assistente } from './servizio';

function id(req: Request, name = 'id'): number {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n < 1) throw new ApiError(400, 'Identificativo non valido.');
  return n;
}

/** ?iscritto=12 → 12, ?iscritto=generale → null, assente → undefined */
function iscrittoQuery(req: Request): number | null | undefined {
  const v = req.query.iscritto;
  if (v === undefined || v === '') return undefined;
  if (v === 'generale' || v === 'null') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new ApiError(400, 'Iscritto non valido.');
  return n;
}

/** AbortSignal che scatta quando il client chiude la connessione (pulsante "Interrompi"). */
function segnaleDa(req: Request, res: Response): AbortController {
  const ac = new AbortController();
  res.on('close', () => { if (!res.writableFinished) ac.abort(); });
  req.on('aborted', () => ac.abort());
  return ac;
}

function iniziaNdjson(res: Response) {
  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

const scrivi = (res: Response, e: EventoGenerazione | EventoDownload) => { if (!res.writableEnded) res.write(JSON.stringify(e) + '\n'); };

export function creaRouter(a: Assistente, today: () => string) {
  const r = express.Router();
  r.use(express.json({ limit: '1mb' }));

  // ─── Motore ─────────────────────────────────────────────────────────
  r.get('/stato', async (_req, res) => { res.json(await a.stato()); });

  r.put('/impostazioni', async (req, res) => {
    const prima = a.impostazioni.get();
    const body = { ...(req.body ?? {}) } as Record<string, unknown>;
    // Cambiando motore senza indicare l'URL si propone quello tipico del nuovo motore.
    if (body.provider && body.provider !== prima.provider && body.url === undefined && prima.url === URL_PREDEFINITI[prima.provider]) {
      body.url = URL_PREDEFINITI[body.provider as 'ollama' | 'openai'] ?? prima.url;
    }
    a.impostazioni.aggiorna(body);
    a.invalidaCache();
    void a.documenti.aggiornaVettori().catch(() => 0);
    res.json(await a.stato());
  });

  r.get('/modelli', async (_req, res) => { res.json(await a.modelli(true)); });

  r.get('/modelli/consigliati', async (_req, res) => {
    let installati: Awaited<ReturnType<Assistente['modelli']>> = [];
    try { installati = await a.modelli(true); } catch { /* motore spento: nessuno installato */ }
    res.json({ ramGb: a.ram, modelli: consigliati(a.ram, installati) });
  });

  r.post('/modelli/scarica', async (req, res) => {
    const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    if (!nome || nome.length > 200 || /[\s"'<>]/.test(nome)) throw new ApiError(400, 'Nome del modello non valido.');
    const p = a.provider();
    if (!p.pull) throw new ApiError(400, 'Con questo motore i modelli si scaricano dal suo programma (es. LM Studio), non da FitFlow.');
    await p.version();
    const ac = segnaleDa(req, res);
    iniziaNdjson(res);
    try {
      for await (const ev of p.pull(nome, ac.signal)) {
        scrivi(res, { tipo: 'avanzamento', stato: ev.status, completato: ev.completed, totale: ev.total });
      }
      a.invalidaCache();
      void a.documenti.aggiornaVettori().catch(() => 0);
      scrivi(res, { tipo: 'fine' });
    } catch (e) {
      if (!ac.signal.aborted) scrivi(res, { tipo: 'errore', messaggio: e instanceof ApiError ? e.message : 'Download non riuscito.' });
    }
    res.end();
  });

  // ─── Agenti ─────────────────────────────────────────────────────────
  r.get('/agenti', (_req, res) => { res.json(a.agenti.elenco()); });
  r.post('/agenti', (req, res) => { res.status(201).json(a.agenti.crea(req.body ?? {})); });
  r.post('/agenti/ripristina', (_req, res) => { res.json(a.agenti.ripristina()); });
  r.put('/agenti/:id', (req, res) => { res.json(a.agenti.aggiorna(id(req), req.body ?? {})); });
  r.delete('/agenti/:id', (req, res) => { a.agenti.elimina(id(req)); res.json(a.agenti.elenco()); });
  r.post('/agenti/:id/duplica', (req, res) => { res.status(201).json(a.agenti.duplica(id(req))); });

  // ─── Libreria esercizi ──────────────────────────────────────────────
  r.get('/esercizi/filtri', (_req, res) => { res.json(a.libreria.filtri()); });
  r.get('/esercizi', (req, res) => {
    const q = (k: string) => (typeof req.query[k] === 'string' ? req.query[k] as string : undefined);
    const att = q('attrezzi');
    res.json(a.libreria.cerca({
      q: q('q'), categoria: q('categoria'), livello: q('livello'), obiettivo: q('obiettivo'),
      attrezzi: att === undefined ? null : att.split(',').map(s => s.trim()).filter(Boolean),
      limite: Math.min(500, Number(q('limite')) || 500),
    }));
  });
  r.get('/esercizi/:eid', (req, res) => {
    const e = a.libreria.get(String(req.params.eid));
    if (!e) throw new ApiError(404, 'Esercizio non trovato.');
    res.json(e);
  });

  // ─── Documenti ──────────────────────────────────────────────────────
  r.get('/documenti', (req, res) => { res.json(a.documenti.elenco(iscrittoQuery(req))); });
  r.post(
    '/documenti',
    express.raw({ type: () => true, limit: MAX_FILE_BYTES + 1024 }),
    (req, res) => {
      if (!Buffer.isBuffer(req.body)) throw new ApiError(400, 'Nessun file ricevuto.');
      const nome = fileNameHeader(req);
      const pidH = req.headers['x-participant-id'];
      let pid: number | null = null;
      if (pidH !== undefined && pidH !== '') {
        pid = Number(pidH);
        if (!Number.isInteger(pid) || !a.core.participants().some(p => p.id === pid)) throw new ApiError(400, 'Iscritto non trovato.');
      }
      res.status(201).json(a.documenti.carica(req.body, nome, pid));
    },
  );
  r.get('/documenti/:id', (req, res) => { res.json(a.documenti.get(id(req))); });
  r.patch('/documenti/:id', (req, res) => { res.json(a.documenti.rinomina(id(req), String(req.body?.titolo ?? ''))); });
  r.delete('/documenti/:id', (req, res) => { a.documenti.elimina(id(req)); res.json({ ok: true }); });
  r.get('/documenti/:id/file', (req, res) => {
    const f = a.documenti.file(id(req));
    res.setHeader('Content-Type', f.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.attachment(f.name);
    res.sendFile(f.path, { dotfiles: 'allow' });
  });
  r.get('/documenti/:id/testo', (req, res) => { res.json({ testo: a.documenti.testoCompleto(id(req)) }); });
  r.post('/documenti/:id/reindicizza', (req, res) => { a.documenti.reindicizza(id(req)); res.json(a.documenti.get(id(req))); });
  r.post('/reindicizza', (_req, res) => {
    a.libreria.carica(a.contentDir);
    a.documenti.sincronizzaConoscenze(a.contentDir);
    a.documenti.reindicizza();
    res.json({ ok: true });
  });

  r.get('/cerca', async (req, res) => {
    const q = String(req.query.q ?? '');
    const pid = iscrittoQuery(req);
    res.json(await a.documenti.cerca(q, { conoscenze: true, documenti: true, partecipanteId: pid ?? null }, Math.min(30, Number(req.query.limite) || 8)));
  });

  // ─── Generazione ────────────────────────────────────────────────────
  r.post('/genera', async (req, res) => {
    const ac = segnaleDa(req, res);
    const prep = await prepara(a, req.body ?? {}, today(), ac.signal);
    iniziaNdjson(res);
    try {
      for await (const ev of genera(a, prep, ac.signal)) scrivi(res, ev);
    } catch (e) {
      if (!ac.signal.aborted && !isAbort(e)) {
        scrivi(res, { tipo: 'errore', messaggio: e instanceof ApiError ? e.message : 'Errore durante la generazione.' });
        if (!(e instanceof ApiError)) console.error(e);
      }
    }
    res.end();
  });

  // ─── Programmi salvati ──────────────────────────────────────────────
  r.get('/programmi', (req, res) => { res.json(a.programmi.elenco(iscrittoQuery(req))); });
  r.get('/programmi/:id', (req, res) => { res.json(a.programmi.get(id(req))); });
  r.post('/programmi', (req, res) => {
    const b = req.body ?? {};
    let agente: { id: number; nome: string } | null = null;
    if (b.agenteId) { try { const ag = a.agenti.get(Number(b.agenteId)); agente = { id: ag.id, nome: ag.nome }; } catch { agente = null; } }
    res.status(201).json(a.programmi.crea(b, agente));
  });
  r.put('/programmi/:id', (req, res) => { res.json(a.programmi.aggiorna(id(req), req.body ?? {})); });
  r.delete('/programmi/:id', (req, res) => { a.programmi.elimina(id(req)); res.json({ ok: true }); });

  return r;
}
