import { it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

it('blocks runtime files and detects secrets in earlier history without printing values',()=>{
  const root=mkdtempSync(join(tmpdir(),'jev-git-scan-'));
  const scanner=resolve('scripts/check-secrets.mjs');
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,stdio:'pipe'});
  try {
    git('init','-b','main');git('config','user.name','Test');git('config','user.email','test@example.invalid');
    writeFileSync(join(root,'session.json'),'{}');git('add','session.json');
    let result=spawnSync(process.execPath,[scanner,'--staged'],{cwd:root,encoding:'utf8'});expect(result.status).toBe(1);expect(result.stderr).toContain('Blocked private/runtime file');
    git('rm','--cached','session.json');
    const fake='ghp_'+'A'.repeat(36);writeFileSync(join(root,'notes.txt'),fake);git('add','notes.txt');
    result=spawnSync(process.execPath,[scanner,'--staged'],{cwd:root,encoding:'utf8'});expect(result.status).toBe(1);expect(result.stderr).not.toContain(fake);
    git('commit','-m','fixture secret');writeFileSync(join(root,'notes.txt'),'clean');git('add','notes.txt');git('commit','-m','fixture cleanup');
    const head=git('rev-parse','HEAD').toString().trim();
    result=spawnSync(process.execPath,[scanner,'--push'],{cwd:root,encoding:'utf8',input:`refs/heads/main ${head} refs/heads/main ${'0'.repeat(40)}\n`});
    expect(result.status).toBe(1);expect(result.stderr).not.toContain(fake);expect(result.stderr).toContain('Possible secret');
  } finally {rmSync(root,{recursive:true,force:true});}
});
