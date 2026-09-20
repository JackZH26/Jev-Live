import { z } from 'zod';
import { Store } from './storage';
import { message } from '../shared/i18n';
import type { XSourceSummary } from '../shared/types';

export const xStudioUrl='https://studio.x.com/live';
// Only X's ingest hosts. Never pass arbitrary user-supplied URLs to an encoder.
export function validXServer(value:string) {
  try {
    const u=new URL(value);
    return /^rtmps?:$/.test(u.protocol)&&!u.username&&!u.password&&!u.search&&!u.hash&&
      (u.hostname.endsWith('.pscp.tv')||u.hostname.endsWith('.video.x.com'))&&
      ['', '80', '443', '1935'].includes(u.port)&&u.pathname.length>1&&!/\s|[\\]/.test(value);
  } catch {return false;}
}
const schema=z.object({name:z.string().trim().min(1).max(80),server:z.string().trim().max(1000).refine(validXServer),key:z.string().trim().min(8).max(4096).regex(/^[^\s\x00-\x1f\x7f]+$/)});
/** Source configuration is not an OAuth account or proof of platform ingestion. */
export class XLive {
  constructor(private store:Store){}
  async summary():Promise<XSourceSummary>{const source=await this.store.get<{name:string}>('stream.x');return {configured:!!source,name:source?.name??''};}
  async save(value:unknown){const result=schema.safeParse(value);if(!result.success)throw new Error(message('error.xSourceInvalid'));await this.store.set('stream.x',result.data);}
  async remove(){await this.store.set('stream.x',undefined);}
  async destination(){const result=schema.safeParse(await this.store.get('stream.x'));if(!result.success)throw new Error(message('error.xSourceRequired'));return {server:result.data.server,key:result.data.key};}
}
