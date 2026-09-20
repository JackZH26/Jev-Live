import { describe, it, expect } from 'vitest';
import { catalogs, locales, t, message, translateMessage, normalizeLocale } from '../shared/i18n';
import { ui } from '../shared/locales/ui';
import { runtime } from '../shared/locales/runtime';
import { steam } from '../shared/locales/steam';
import { x } from '../shared/locales/x';
import { etc } from '../shared/locales/etc';
import { settingsSchema } from '../electron/storage';

describe('five-language contract',()=>{
  it('has unique keys, complete translations and identical interpolation fields',()=>{
    const rows=[...ui,...runtime,...steam,...x,...etc];
    expect(new Set(rows.map(r=>r[0])).size).toBe(rows.length);
    for(const row of rows){
      expect(row).toHaveLength(locales.length+1);
      const params=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
      for(const value of row.slice(1)){
        expect(value.trim(),row[0]).not.toBe('');
        expect(params(value),row[0]).toEqual(params(row[5]));
      }
    }
    for(const locale of locales)expect(Object.keys(catalogs[locale])).toHaveLength(rows.length);
  });
  it('renders the same stored event and error in any supported language',()=>{
    for(const locale of locales){
      expect(translateMessage(locale,message('error.generic'))).toBe(t(locale,'error.generic'));
      expect(t(locale,'account.login',{provider:'Twitch'})).toContain('Twitch');
      expect(translateMessage(locale,'@jev:broken')).toBe(t(locale,'error.generic'));
      expect(t(locale,'author.label')).toContain('@jackzhj');
    }
    expect(new Set(locales.map(l=>translateMessage(l,message('settings.saved')))).size).toBe(5);
  });
  it('migrates old settings, accepts the five locales and rejects unsupported saved values',()=>{
    expect(settingsSchema.parse({}).locale).toBe('zh-CN');
    for(const locale of locales)expect(settingsSchema.parse({locale}).locale).toBe(locale);
    expect(settingsSchema.safeParse({locale:'de'}).success).toBe(false);
    expect(normalizeLocale('de')).toBe('zh-CN');
    expect(settingsSchema.parse({}).enabledPlatforms).toEqual(['youtube','twitch']);
    expect(settingsSchema.parse({enabledPlatforms:[]}).enabledPlatforms).toEqual([]);
    expect(settingsSchema.safeParse({enabledPlatforms:['youtube','youtube']}).success).toBe(false);
  });
});
