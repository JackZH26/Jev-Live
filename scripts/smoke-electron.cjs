const { _electron: electron } = require('playwright');
const path = require('node:path');
const fs = require('node:fs/promises');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const env={...process.env,JEV_TEST_DATA_DIR:await fs.mkdtemp(path.join(process.env.LOCALAPPDATA,'JEV Studio DevTest-'))};
  delete env.ELECTRON_RUN_AS_NODE;delete env.JEV_DEV_URL;
  const app=await electron.launch({args:[root],env,timeout:60000});
  const page=await app.firstWindow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.waitForSelector('.studio-grid');
    const snapshot=await page.evaluate(()=>window.studio.snapshot());
    if(snapshot.mode!=='manual')throw new Error('Must start in manual mode');
    if(await page.evaluate(()=>typeof window.require!=='undefined'))throw new Error('Renderer exposes Node');
    await fs.mkdir(path.join(root,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-results','desktop.png'),fullPage:true});
    await page.locator('.nav-item').last().click();
    await page.waitForSelector('.settings-grid');
    await page.screenshot({path:path.join(root,'test-results','settings.png'),fullPage:true});
    if(process.argv.includes('--obs')) {
      await page.evaluate(()=>window.studio.setupOBS());
      const after=await page.evaluate(()=>window.studio.snapshot());
      if(!after.outputs.youtube.connected || !after.outputs.twitch.connected)throw new Error('Dual OBS missing');
      const windows=await page.evaluate(()=>window.studio.windows());
      console.log(JSON.stringify({dualOBS:true,availableWindows:windows.length}));
    }
    if(errors.length)throw new Error(errors.join('\n'));
    console.log(JSON.stringify({ui:true,rendererIsolated:true,errors}));
  } finally {await app.evaluate(({app})=>app.exit(0));await app.close().catch(()=>{});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
