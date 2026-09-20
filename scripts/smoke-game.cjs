// Explicit opt-in integration acceptance; launches only a local ETC development game.
const { _electron: electron } = require('playwright');
const { execFileSync }=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const root=path.resolve(__dirname,'..'),env={...process.env,JEV_TEST_DATA_DIR:path.join(process.env.LOCALAPPDATA,'JEV Studio DevTest')};
  delete env.ELECTRON_RUN_AS_NODE;delete env.JEV_DEV_URL;
  const app=await electron.launch({args:[root],env,timeout:60000}),page=await app.firstWindow();let gamePid;
  const report={observations:[],manualHandover:false,dualCapture:false};
  try {
    await page.waitForSelector('.studio-grid');
    await page.evaluate(()=>window.studio.launchGame());
    gamePid=(await page.evaluate(()=>window.studio.snapshot())).gamePid;
    const deadline=Date.now()+180000;
    let state;
    do{await pause(1000);state=await page.evaluate(()=>window.studio.snapshot());if(state.gameConnected)break;}while(Date.now()<deadline);
    if(!state.gameConnected)throw new Error('ETC bridge did not connect in three minutes');
    console.log('ETC bridge connected; testing automatic local match.');
    await page.evaluate(()=>window.studio.setupOBS());
    const windows=await page.evaluate(()=>window.studio.windows());
    const target=windows.find(w=>/UnrealEditor\.exe/i.test(w.value)&&!/Unreal Editor/i.test(w.label)&&/Lyra|ETC|Enter the Cube/i.test(w.label));
    if(target){await page.evaluate(value=>window.studio.setCapture(value),target.value);report.dualCapture=true;}
    await page.evaluate(()=>window.studio.setMode('auto'));
    for(let i=0;i<90;i++){
      await pause(1000);const s=await page.evaluate(()=>window.studio.snapshot());
      if(s.game)report.observations.push({at:s.game.timestamp,phase:s.game.phase,position:s.game.position,health:s.game.health,action:s.game.lastAction,ack:s.game.ack,mode:s.mode});
      if(i%15===0)console.log(JSON.stringify({elapsed:i,phase:s.game?.phase,decision:s.decision,connected:s.gameConnected,error:s.gameError}));
    }
    await page.evaluate(()=>window.studio.setMode('manual'));await pause(1800);
    const handover=await page.evaluate(()=>window.studio.snapshot());
    report.manualHandover=handover.mode==='manual'&&handover.game?.mode==='manual';
    await fs.mkdir(path.join(root,'test-results'),{recursive:true});
    await fs.writeFile(path.join(root,'test-results','game-acceptance.json'),JSON.stringify(report,null,2));
    await page.screenshot({path:path.join(root,'test-results','game-studio.png'),fullPage:true});
    const positions=new Set(report.observations.filter(s=>s.phase==='playing').map(s=>s.position.map(x=>Math.round(x/50)).join(',')));
    console.log(JSON.stringify({playingPositions:positions.size,manualHandover:report.manualHandover,dualCapture:report.dualCapture}));
    if(positions.size<3||!report.manualHandover)throw new Error('Gameplay acceptance incomplete; inspect local report');
  } finally {
    await page.evaluate(()=>window.studio.setMode('manual')).catch(()=>{});
    if(gamePid) {try{execFileSync('powershell.exe',['-NoProfile','-Command',`$p=Get-Process -Id ${gamePid} -ErrorAction SilentlyContinue; if($p){$null=$p.CloseMainWindow()}`],{windowsHide:true});}catch{}}
    await app.evaluate(({app})=>app.exit(0));await app.close().catch(()=>{});
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
