import { message } from '../shared/i18n';
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) { super(message('error.api',{status,code})); }
}
export async function jsonRequest<T = any>(url: string, init: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(url, { ...init, signal: init.signal ? AbortSignal.any([timeout, init.signal]) : timeout, redirect: 'error' });
  const data = await response.json() as any;
  if (!response.ok) {
    // Never relay provider messages, bodies, request URLs or credentials into renderer/logs.
    const raw = typeof data.error === 'string' ? data.error : data.error?.errors?.[0]?.reason ?? data.message ?? 'request_failed';
    const code = /^[a-zA-Z0-9_ ]{1,80}$/.test(raw) ? raw : 'request_failed';
    throw new ApiError(response.status, code);
  }
  return data;
}
export function form(values: Record<string,string>) { return { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams(values) }; }
export const delay = (ms:number, signal?:AbortSignal) => new Promise<void>((resolve,reject) => {
  if(signal?.aborted) { reject(new Error(message('error.operationCancelled'))); return; }
  const abort = () => { clearTimeout(timer); reject(new Error(message('error.operationCancelled'))); };
  const timer=setTimeout(()=>{ signal?.removeEventListener('abort',abort); resolve(); },ms);
  signal?.addEventListener('abort',abort,{once:true});
});
