import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
const blocked=/(^|\/)(\.env(?:\..*)?|client[_-]secret[^/]*\.json|credentials[^/]*\.json|secrets[^/]*\.json|vault\.bin|oauth[^/]*\.json|tokens?[^/]*\.json|session\.json|command\.json|state\.json|service\.json(?:\.bak)?|\.local|runtime|recordings|game-session|obs|node_modules|dist-main|release)(\/|$)|\.(pem|p12|pfx|key|keystore|token|dmp)$/i;
const patterns=[
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk|sk-proj)-[A-Za-z0-9_-]{24,}\b/,
  /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|stream[_-]?key|server[_-]?password)["']?\s*[:=]\s*["']([A-Za-z0-9_+\/.=-]{16,})["']/i,
  /rtmps?:\/\/[^\s"']+\/(?:live_)[A-Za-z0-9_?=&-]{20,}/i
];
let failures=0;
function check(path,content,ref){
  if(blocked.test(path)&&!path.endsWith('.example')){console.error(`Blocked private/runtime file: ${path} (${ref})`);failures++;return;}
  if(content.includes('\0'))return;
  for(const [index,line] of content.split('\n').entries()){
    if(patterns.some(p=>p.test(line))){console.error(`Possible secret: ${path}:${index+1} (${ref}); value withheld`);failures++;}
  }
}
if(process.argv.includes('--staged')){
  for(const path of git('diff','--cached','--name-only','--diff-filter=ACMR','-z').split('\0').filter(Boolean))check(path,git('show',`:${path}`),'staged');
}else if(process.argv.includes('--push')){
  const refs=readFileSync(0,'utf8').trim().split('\n').filter(Boolean);
  const visited=new Set();
  for(const ref of refs){const [,local,,remote]=ref.trim().split(/\s+/);if(!local||/^0+$/.test(local))continue;
    const commits=git('rev-list',/^0+$/.test(remote)?local:`${remote}..${local}`).trim().split('\n').filter(Boolean);
    for(const commit of commits){if(visited.has(commit))continue;visited.add(commit);
      for(const path of git('diff-tree','--root','--no-commit-id','--name-only','--diff-filter=ACMR','-r','-z',commit).split('\0').filter(Boolean))check(path,git('show',`${commit}:${path}`),commit.slice(0,8));
    }
  }
}else{
  for(const path of git('ls-files','-z').split('\0').filter(Boolean))check(path,git('show',`HEAD:${path}`),'HEAD');
}
if(failures){console.error(`Secret scan blocked ${failures} item(s). Remove private data before committing or pushing.`);process.exit(1);}
console.log('Secret scan passed. No blocked files or credential patterns found.');
