import { message } from '../shared/i18n';
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const settingsSchema = z.object({
  locale: z.enum(['zh-CN','zh-TW','ja','ko','en']).default('zh-CN'),
  googleClientId: z.string().max(250).default(''), twitchClientId: z.string().max(250).default(''),
  obsDirectory: z.string().max(500).default('C:\\Program Files\\obs-studio'),
  gameWindow: z.string().max(1000).default(''),
  steamAppId:z.string().regex(/^\d*$/).max(12).default(''),
  addedSteamGames:z.array(z.string().regex(/^\d+$/).max(12)).max(200).default([]),
  title: z.string().trim().min(1).max(100).default('Enter the Cube · JEV Studio'),
  youtubePrivacy: z.enum(['private', 'unlisted', 'public']).default('private'),
  decisionProvider: z.enum(['rules', 'jev']).default('rules'),
  decisionIntervalMs: z.number().int().min(300).max(5000).default(800),
  autoRestart: z.boolean().default(false), bitrate: z.number().int().min(1500).max(8000).default(6000)
});
export async function atomicWrite(path: string, value: string | Buffer) {
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, value, {mode: 0o600});
  try {
    for(let attempt=0;;attempt++) {
      try {await rename(tmp,path);return;}
      catch(e:any) {
        if(attempt>=7 || !['EPERM','EACCES','EBUSY'].includes(e.code))throw e;
        // UE/OBS file readers briefly hold Windows handles without delete sharing.
        await new Promise(r=>setTimeout(r,5*(attempt+1)));
      }
    }
  } finally {await unlink(tmp).catch(()=>{});}
}
export interface Cipher { encryptString(value:string):Buffer; decryptString(value:Buffer):string; isEncryptionAvailable():boolean }
export class Store {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string, private cipher: Cipher) {}
  async init() { await mkdir(this.directory, { recursive: true }); }
  async settings() {
    try { return settingsSchema.parse(JSON.parse(await readFile(join(this.directory,'settings.json'),'utf8'))); }
    catch (e:any) { if (e.code === 'ENOENT') return settingsSchema.parse({}); throw new Error(message('error.settings')); }
  }
  async saveSettings(value: unknown) { await atomicWrite(join(this.directory, 'settings.json'), JSON.stringify(settingsSchema.parse(value), null, 2)); }
  private async secrets(): Promise<Record<string, unknown>> {
    if (!this.cipher.isEncryptionAvailable()) throw new Error(message('error.secureStore'));
    try { return JSON.parse(this.cipher.decryptString(await readFile(join(this.directory, 'vault.bin')))); }
    catch (e:any) { if (e.code === 'ENOENT') return {}; throw new Error(message('error.decrypt')); }
  }
  async get<T>(key: string): Promise<T | undefined> { await this.chain; return (await this.secrets())[key] as T | undefined; }
  set(key: string, value: unknown) {
    const update = this.chain.then(async () => {
      const data = await this.secrets();
      if (value === undefined) delete data[key]; else data[key] = value;
      await atomicWrite(join(this.directory, 'vault.bin'), this.cipher.encryptString(JSON.stringify(data)));
    });
    this.chain = update.catch(() => {}); return update;
  }
}
