import { ui } from './locales/ui';
import { runtime } from './locales/runtime';
import { steam } from './locales/steam';
import { x } from './locales/x';
import { etc } from './locales/etc';
export const locales=['zh-CN','zh-TW','ja','ko','en'] as const;
export type Locale=typeof locales[number];
type Row=readonly [string,string,string,string,string,string];
const rows:readonly Row[]=[...ui,...runtime,...steam,...x,...etc];
export type MessageKey=typeof ui[number][0] | typeof runtime[number][0] | typeof steam[number][0] | typeof x[number][0] | typeof etc[number][0];
export const catalogs=Object.fromEntries(locales.map((locale,i)=>[locale,Object.fromEntries(rows.map(row=>[row[0],row[i+1]]))])) as Record<Locale,Record<MessageKey,string>>;
export function normalizeLocale(value:unknown):Locale{return locales.includes(value as Locale)?value as Locale:'zh-CN';}
export function t(locale:Locale,key:MessageKey,params:Record<string,string|number>={}) {
  return (catalogs[locale]?.[key]??catalogs.en[key]??key).replace(/\{(\w+)\}/g,(all,name)=>String(params[name]??all));
}
/** Keep events and errors language-neutral until display, so existing logs switch too. */
export function message(key:MessageKey,params:Record<string,string|number>={}) {return '@jev:'+JSON.stringify({key,params});}
export function translateMessage(locale:Locale,value:string) {
  if(!value.startsWith('@jev:'))return value;
  try {const item=JSON.parse(value.slice(5));return t(locale,item.key,item.params);}catch{return t(locale,'error.generic');}
}
