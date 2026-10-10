// CSV export of the payment list, readable by Excel in Italian locale:
// ";" separator, UTF-8 BOM, comma decimals, dd/mm/yyyy dates, CRLF line ends.
import { fmt } from '../../../shared/dates';
import type { VocePagamento } from '../../../server/modules/finanze/types';
import { decimaleIt } from './formato';

function cell(v: string): string {
  // Neutralise spreadsheet formulas in names typed by users.
  const s = /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export const CSV_HEADER = ['Data', 'Iscritto', 'Corso', 'Abbonamento', 'Dal', 'Al', 'Importo (€)', 'Note'];

export function pagamentiCsv(rows: VocePagamento[]): string {
  const lines = [CSV_HEADER.join(';')];
  for (const r of rows) {
    lines.push([
      fmt(r.data), cell(r.nome), cell(r.corso), cell(r.abbonamento), fmt(r.dal), fmt(r.al),
      decimaleIt(r.importo), r.ritiratoIl ? `Disiscritto il ${fmt(r.ritiratoIl)}` : '',
    ].join(';'));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Hands the file to the browser as a download. */
export function scaricaCsv(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
