const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),{evaluate}=require('./hybrid-streak.cjs');
const root=path.resolve(__dirname,'..'),arg=(n,d)=>{const i=process.argv.indexOf(n);return i<0?d:process.argv[i+1]};
(async()=>{const candidate=arg('--candidate',''),matches=Number(arg('--matches','5'));if(!path.isAbsolute(candidate)||!Number.isInteger(matches)||matches<1||matches>100)throw Error('invalid_arguments');
 const receipts=[];const report=path.join(root,'test-results','hybrid-series-'+Date.now()+'.json');
 for(let i=0;i<matches;i++){
  console.log(JSON.stringify({seriesMatch:i+1,maximum:matches,candidate}));let result;
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(path.join(root,'node_modules/electron/dist/electron.exe'),[path.join(__dirname,'validate-hybrid-local.cjs'),'--candidate',candidate,'--jev','--seconds','1800','--requests','1200'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let pending='';child.stdout.on('data',chunk=>{pending+=chunk;const lines=pending.split('\n');pending=lines.pop();for(const line of lines){try{const value=JSON.parse(line);if(value.pid||value.summary){console.log(line);if(value.summary)result=value}}catch{}}});
  child.stderr.on('data',()=>{});await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});
  if(!result?.out)throw Error('trial_failed_without_receipt');const r=JSON.parse(await fs.readFile(path.join(result.out,'receipt.json'),'utf8'));receipts.push({file:result.out,r});
  const ledger=evaluate(receipts);await fs.writeFile(report,JSON.stringify(ledger,null,2));console.log(JSON.stringify({seriesReport:report,streak:ledger.streak,lastPlacement:r.summary?.lastPlacement}));
  if(ledger.passed){console.log('TWO_CONSECUTIVE_OFFICIAL_FIRSTS');return}
  if(r.stopReason!=='official_result'||!r.manualRelease){console.log('Series stopped for inspection after incomplete trial or release failure.');process.exitCode=2;return}
 }
 console.log('Batch complete; inspect receipts before continuing.');
})().catch(()=>{console.error('Acceptance series failed; inspect the last receipt.');process.exitCode=1});
