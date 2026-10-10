import express, { type NextFunction, type Request, type Response } from 'express';
import { ALLOWED_CERT_TYPES, ApiError, type Store } from './store';

const MAX_CERT_BYTES = 15 * 1024 * 1024;

function id(req: Request, name = 'id'): number {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n < 1) throw new ApiError(400, 'Identificativo non valido.');
  return n;
}

/** Core JSON API. Every mutation answers with the full, fresh state so the client never drifts. */
export function createApi(store: Store) {
  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));

  const send = (res: Response, status = 200) => res.status(status).json(store.state());

  api.get('/state', (_req, res) => send(res));

  api.put('/settings', (req, res) => { store.updateSettings(req.body ?? {}); send(res); });

  api.post('/courses', (req, res) => { store.createCourse(req.body ?? {}); send(res, 201); });
  api.put('/courses/:id', (req, res) => { store.updateCourse(id(req), req.body ?? {}); send(res); });
  api.delete('/courses/:id', (req, res) => { store.deleteCourse(id(req)); send(res); });
  api.post('/courses/:id/lessons', (req, res) => { store.addLesson(id(req), req.body ?? {}); send(res, 201); });

  api.post('/plans', (req, res) => { store.createPlan(req.body ?? {}); send(res, 201); });
  api.delete('/plans/:id', (req, res) => { store.deletePlan(id(req)); send(res); });

  api.post('/participants', (req, res) => { store.createParticipant(req.body ?? {}); send(res, 201); });
  api.patch('/participants/:id', (req, res) => { store.updateParticipant(id(req), req.body ?? {}); send(res); });
  api.delete('/participants/:id', (req, res) => { store.unsubscribe(id(req)); send(res); });
  api.post('/participants/:id/renew-iscrizione', (req, res) => { store.renewIscrizione(id(req)); send(res); });
  api.post('/participants/:id/payments', (req, res) => { store.registerPayment(id(req), req.body ?? {}); send(res, 201); });

  api.put(
    '/participants/:id/cert',
    express.raw({ type: Object.keys(ALLOWED_CERT_TYPES), limit: MAX_CERT_BYTES }),
    (req, res) => {
      const mime = String(req.headers['content-type'] ?? '').split(';')[0].trim();
      if (!Buffer.isBuffer(req.body)) throw new ApiError(400, 'Formato non supportato: carica un file PNG, JPEG o PDF.');
      const name = fileNameHeader(req);
      store.saveCertFile(id(req), req.body, mime, name);
      send(res);
    },
  );
  api.get('/participants/:id/cert', (req, res) => {
    const f = store.certFile(id(req));
    res.setHeader('Content-Type', f.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.attachment(f.name);
    if (req.query.download === undefined) {
      // Inline for the viewer, but keep the original file name.
      res.setHeader('Content-Disposition', String(res.getHeader('Content-Disposition')).replace(/^attachment/, 'inline'));
    }
    // dotfiles: the data folder may sit under a hidden directory (e.g. ~/.config on Linux).
    res.sendFile(f.path, { dotfiles: 'allow' });
  });
  api.delete('/participants/:id/cert', (req, res) => { store.removeCertFile(id(req)); send(res); });

  api.delete('/lessons/:id', (req, res) => { store.deleteLesson(id(req)); send(res); });
  api.post('/lessons/:id/toggle', (req, res) => { store.toggleAttendance(id(req), Number(req.body?.participantId)); send(res); });
  api.post('/lessons/:id/mark-all', (req, res) => { store.markAll(id(req)); send(res); });

  return api;
}

/** Turns thrown errors into JSON answers ({ error }) for every module. */
/** File name sent by the browser in X-File-Name (URI-encoded), without control characters. */
export function fileNameHeader(req: Request): string {
  let name = String(req.headers['x-file-name'] ?? '');
  try { name = decodeURIComponent(name); } catch { throw new ApiError(400, 'Nome del file non valido.'); }
  return name.replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.too.large') return res.status(413).json({ error: 'Il file è troppo grande.' });
  if (e?.status && e.status < 500) return res.status(e.status).json({ error: 'Richiesta non valida.' });
  console.error(err);
  res.status(500).json({ error: 'Errore interno del server.' });
}
