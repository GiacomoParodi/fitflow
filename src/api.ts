import type { AppState, NewParticipantInput, Settings } from '../shared/types';

export class ApiFailure extends Error {}

async function call(method: string, url: string, body?: unknown, headers?: Record<string, string>): Promise<AppState> {
  let res: Response;
  try {
    res = await fetch('/api' + url, {
      method,
      headers: body instanceof Blob ? headers : body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body instanceof Blob ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiFailure('Server non raggiungibile: controlla che l\'app sia avviata.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiFailure(data?.error || `Errore ${res.status}`);
  return data as AppState;
}

export const api = {
  state: () => call('GET', '/state'),
  updateSettings: (patch: Partial<Settings>) => call('PUT', '/settings', patch),

  createCourse: (c: { name: string; giorni: number[]; orario: string; capienza: number }) => call('POST', '/courses', c),
  updateCourse: (id: number, c: { name: string; giorni: number[]; orario: string; capienza: number }) => call('PUT', `/courses/${id}`, c),
  deleteCourse: (id: number) => call('DELETE', `/courses/${id}`),
  addLesson: (courseId: number, date: string) => call('POST', `/courses/${courseId}/lessons`, { date }),
  deleteLesson: (lessonId: number) => call('DELETE', `/lessons/${lessonId}`),
  toggleAttendance: (lessonId: number, participantId: number) => call('POST', `/lessons/${lessonId}/toggle`, { participantId }),
  markAll: (lessonId: number) => call('POST', `/lessons/${lessonId}/mark-all`),

  createPlan: (p: { name: string; mesi: string; prezzo: string }) => call('POST', '/plans', p),
  deletePlan: (id: number) => call('DELETE', `/plans/${id}`),

  createParticipant: (p: NewParticipantInput) => call('POST', '/participants', p),
  updateParticipant: (id: number, patch: Record<string, string | null>) => call('PATCH', `/participants/${id}`, patch),
  unsubscribe: (id: number) => call('DELETE', `/participants/${id}`),
  renewIscrizione: (id: number) => call('POST', `/participants/${id}/renew-iscrizione`),
  registerPayment: (id: number, p: { date: string; planId: number }) => call('POST', `/participants/${id}/payments`, p),
  uploadCert: (id: number, file: File) =>
    call('PUT', `/participants/${id}/cert`, file, { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) }),
  removeCert: (id: number) => call('DELETE', `/participants/${id}/cert`),
  certUrl: (id: number, uploadedAt: string, download = false) =>
    `/api/participants/${id}/cert?v=${encodeURIComponent(uploadedAt)}${download ? '&download' : ''}`,
};
