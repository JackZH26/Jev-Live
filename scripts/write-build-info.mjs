import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const digest=data=>createHash('sha256').update(data).digest('hex');
const modules=['etc-autoplay','etc-policy','etc-tactics','etc-recovery','etc-bridge','etc-map','etc-knowledge'];
const files=[...modules.map(n=>'electron/'+n+'.ts'),'electron/game.ts','shared/etc.ts'];
const strategySources=await Promise.all(files.map(async path=>({path,sha256:digest(await readFile(path))})));
const strategyRuntime=await Promise.all(modules.map(async name=>({path:'dist-main/electron/'+name+'.js',sha256:digest(await readFile('dist-main/electron/'+name+'.js'))})));
let commit='unknown';try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();}catch{}
const {version}=JSON.parse(await readFile('package.json','utf8'));
const info={schemaVersion:1,version,commit,builtAt:new Date().toISOString(),strategyRevision:digest(JSON.stringify(strategySources)).slice(0,12),strategySources,strategyRuntime};
await writeFile('dist-main/build-info.json',JSON.stringify(info,null,2));
console.log('Strategy build '+info.strategyRevision+' · JEV Studio '+version);
