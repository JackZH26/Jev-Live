// Use Windows Git Credential Manager in memory. Never write or print credentials.
import { execFileSync } from 'node:child_process';
const owner='JackZH26', repo='Jev-Live';
const raw=execFileSync('git',['credential','fill'],{input:`protocol=https\nhost=github.com\nusername=${owner}\n\n`,encoding:'utf8',env:{...process.env,GCM_INTERACTIVE:'never',GIT_TERMINAL_PROMPT:'0'},stdio:['pipe','pipe','pipe']});
const secret=raw.split('\n').find(line=>line.startsWith('password='))?.slice(9);
if(!secret)throw new Error('No GitHub credential available. Connect through Git Credential Manager.');
async function request(method,path,body){
  const r=await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`,{method,headers:{Authorization:`Bearer ${secret}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error(`GitHub repository update returned ${r.status}`);
  return r.json();
}
const updated=await request('PATCH','',{description:'Open-source desktop studio for AI gameplay and multistreaming: JEV control, official YouTube/Twitch OAuth, and isolated OBS outputs. Windows-first early alpha.',homepage:'https://github.com/JackZH26/Jev-Live#readme'});
await request('PUT','/topics',{names:['ai-gaming','electron','jev','live-streaming','multistreaming','obs-studio','twitch','typescript','vtuber','windows','youtube']});
console.log(JSON.stringify({repository:updated.full_name,description:updated.description,updated:true}));
