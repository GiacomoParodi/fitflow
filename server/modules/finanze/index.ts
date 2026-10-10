import express from 'express';
import type { ServerModule } from '../types';
import { parseFiltri, riepilogo } from './report';

/**
 * Finanze: read-only reports on the payments recorded by the core (takings, best-selling plans,
 * takings per course, who still has to pay). It owns no tables; it only adds an index for date ranges.
 */
export const finanzeModule: ServerModule = {
  id: 'finanze',
  migrations: [
    { id: 'finanze/001-indice-data-pagamenti', up: db => db.exec('CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date)') },
  ],
  createRouter(ctx) {
    const router = express.Router();
    router.get('/riepilogo', (req, res) => {
      const today = ctx.today();
      const filtri = parseFiltri(req.query as Record<string, unknown>, today, ctx.db);
      res.json(riepilogo(ctx.db, today, ctx.core.settings().sogliaAbbonamento, filtri));
    });
    return router;
  },
};
