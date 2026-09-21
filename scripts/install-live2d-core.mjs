import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
const file=fileURLToPath(new URL('../public/live2d/runtime/live2dcubismcore.min.js',import.meta.url));
const source='https://cubism.live2d.com/sdk-web/core/05/live2dcubismcore.min.js';
const expected='25ae938cb4fe282ce189b357bcc97e603d1e1f7ec78bf04150d401c23cdc792f';
const valid=data=>createHash('sha256').update(data).digest('hex')===expected;
if(await readFile(file).then(valid).catch(()=>false)){console.log('Live2D Core 5.2 verified.');process.exit(0);}
if(process.argv.includes('--check'))throw new Error('Missing or changed Live2D Core. Read docs/LIVE2D.en.md and run npm run setup:live2d.');
console.log('Cubism Core is proprietary, outside the project MIT license. Download/use is subject to https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html');
const response=await fetch(source,{redirect:'error',signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error('Live2D download failed: '+response.status);
const data=Buffer.from(await response.arrayBuffer());
if(!valid(data))throw new Error('Live2D Core checksum changed; refusing unreviewed runtime.');
await mkdir(dirname(file),{recursive:true});await writeFile(file,data);console.log('Installed pinned Live2D Core 5.2 locally.');
