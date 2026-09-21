import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

it.skipIf(process.platform!=='win32')('selects a matching strategy package and rejects it after the source changes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'jev-launcher-'));
 try{
  await mkdir(join(root,'scripts'),{recursive:true});
  const launcher=join(root,'scripts/start-local-studio.ps1');await writeFile(launcher,await readFile('scripts/start-local-studio.ps1'));
  const files=['etc-autoplay','etc-policy','etc-tactics','etc-recovery','etc-bridge','etc-map','etc-knowledge'].map(n=>'electron/'+n+'.ts').concat(['electron/game.ts','shared/etc.ts']);
  const sha256=createHash('sha256').update('current').digest('hex');
  for(const file of files){await mkdir(join(root,file,'..'),{recursive:true});await writeFile(join(root,file),'current');}
  for(const name of ['hosting','current']){await mkdir(join(root,'release',name,'win-unpacked/resources'),{recursive:true});await writeFile(join(root,'release',name,'win-unpacked/JEV Studio.exe'),'never executed by CheckOnly');}
  const info={schemaVersion:1,strategyRevision:'matching',strategySources:files.map(path=>({path,sha256}))};
  await writeFile(join(root,'release/current/win-unpacked/resources/build-info.json'),JSON.stringify(info));
  // The older hosting location used to win solely because of path ordering.
  await writeFile(join(root,'release/hosting/win-unpacked/resources/build-info.json'),JSON.stringify({...info,strategySources:files.map(path=>({path,sha256:'outdated'}))}));
  const run=()=>execFileSync('powershell.exe',['-NoProfile','-File',launcher,'-CheckOnly'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
  expect(run()).toContain('release\\current\\win-unpacked\\JEV Studio.exe');
  await writeFile(join(root,'electron/etc-policy.ts'),'new strategy');
  expect(run).toThrow();
 }finally{const target=resolve(root);if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('jev-launcher-'))throw Error('Unexpected test cleanup path');await rm(target,{recursive:true,force:true});}
},15000);
