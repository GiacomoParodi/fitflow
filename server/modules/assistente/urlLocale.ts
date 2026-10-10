import net from 'node:net';
import { ApiError } from '../../store';

/** true se l'indirizzo IP è di questo computer o della rete locale. */
export function ipLocale(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 169 && b === 254) || ip === '0.0.0.0';
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::1' || x === '::') return true;
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipLocale(mapped[1]);
    return /^f[cd][0-9a-f]{2}:/.test(x) || /^fe[89ab][0-9a-f]:/.test(x);
  }
  return false;
}

/**
 * Controlla che l'URL del motore AI punti a questo computer o alla rete locale
 * (loopback, IP privati, nomi .local / localhost). Restituisce l'URL normalizzato senza "/" finale.
 */
export function validaUrlLocale(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new ApiError(400, 'Indirizzo non valido: scrivi ad esempio http://127.0.0.1:11434');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new ApiError(400, 'L\'indirizzo deve iniziare con http:// o https://');
  if (u.username || u.password) throw new ApiError(400, 'L\'indirizzo non può contenere nome utente o password.');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const ok = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || ipLocale(host);
  if (!ok) {
    throw new ApiError(400,
      `"${u.hostname}" non è un indirizzo locale. Per tenere i dati su questo computer l'assistente accetta solo ` +
      'indirizzi di questo computer o della rete locale (127.0.0.1, localhost, 192.168.x.x, 10.x.x.x, nomi .local).');
  }
  return (u.origin + u.pathname).replace(/\/+$/, '');
}
