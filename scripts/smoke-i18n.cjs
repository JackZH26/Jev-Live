const { _electron: electron }=require('playwright');
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const data=await fs.mkdtemp(path.join(process.env.LOCALAPPDATA,'JEV Studio LanguageTest-'));
 const env={...process.env,JEV_TEST_DATA_DIR:data};
 delete env.ELECTRON_RUN_AS_NODE;delete env.JEV_DEV_URL;
 const launch=()=>electron.launch({args:[root],env,timeout:60000});
 let app=await launch();const errors=[];
 try{
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  await page.waitForSelector('.studio-grid');
  const initial=await page.evaluate(()=>window.studio.snapshot());
  await page.locator('.platform-toggle input').nth(1).uncheck();
  for(let n=0;n<50;n++){if((await page.evaluate(()=>window.studio.snapshot())).settings.enabledPlatforms.length===1)break;await page.waitForTimeout(50);}
  assert.deepEqual((await page.evaluate(()=>window.studio.snapshot())).settings.enabledPlatforms,['youtube']);
  await page.locator('.platform-toggle input').first().uncheck();
  for(let n=0;n<50;n++){if(!(await page.evaluate(()=>window.studio.snapshot())).settings.enabledPlatforms.length)break;await page.waitForTimeout(50);}
  assert.deepEqual((await page.evaluate(()=>window.studio.snapshot())).settings.enabledPlatforms,[]);
  assert(await page.locator('.live-card .primary-button').isDisabled());
  await page.locator('.platform-toggle input').first().check();
  for(let n=0;n<50;n++){if((await page.evaluate(()=>window.studio.snapshot())).settings.enabledPlatforms.length===1)break;await page.waitForTimeout(50);}
  await fs.mkdir(path.join(root,'test-results'),{recursive:true});
  const headings={'zh-CN':'让游戏，持续发生。','zh-TW':'讓遊戲，持續發生。',ja:'ゲームの続きを、配信しよう。',ko:'게임의 다음 순간을, 함께.',en:'Keep the game going.'};
  for(const locale of ['zh-CN','zh-TW','ja','ko','en']){
   await page.selectOption('#language',locale);
   await page.waitForFunction(l=>document.documentElement.lang===l,locale);
   assert.equal(await page.locator('h1').innerText(),headings[locale]);
   await page.locator('.connect-button').first().click();
   await page.waitForSelector('[role=alert]');
   const alert=await page.locator('[role=alert]').innerText();
   assert(!alert.includes('@jev:')&&!alert.includes('error.'),'Error must be translated');
   assert(alert.includes('Google'),'Missing client ID explanation must identify Google');
   assert((await page.locator('.author-card').innerText()).includes('@jackzhj'));
   const next=await page.evaluate(()=>window.studio.snapshot());
   assert.equal(next.settings.locale,locale);
   assert.equal(next.mode,initial.mode);
   assert.deepEqual(next.broadcast,initial.broadcast);
   assert.deepEqual(next.outputs,initial.outputs);
   await page.locator('[role=alert] button').click();
   await page.screenshot({path:path.join(root,'test-results',`language-${locale}.png`),fullPage:true});
   await page.locator('.nav-item').last().click();
   await page.waitForSelector('.settings-grid');
   const save=await page.locator('.next-card .primary-button').innerText();
   assert(!save.includes('settings.'));
   await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1080,820));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
   assert(!overflow,`Settings overflow at minimum width: ${locale}`);
   await page.screenshot({path:path.join(root,'test-results',`settings-${locale}.png`),fullPage:true});
   await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1480,960));
   await page.locator('.nav-item').first().click();
  }
  await app.evaluate(({shell})=>{globalThis.openedAuthor='';shell.openExternal=async url=>{globalThis.openedAuthor=url;};});
  await page.locator('.author-card').click();
  await page.waitForTimeout(100);
  assert.equal(await app.evaluate(()=>globalThis.openedAuthor),'https://x.com/jackzhj');
  await app.evaluate(({app})=>app.exit(0));await app.close().catch(()=>{});
  app=await launch();const reopened=await app.firstWindow();
  await reopened.waitForSelector('.studio-grid');
  assert.equal(await reopened.locator('#language').inputValue(),'en');
  assert.deepEqual((await reopened.evaluate(()=>window.studio.snapshot())).settings.enabledPlatforms,['youtube']);
  assert.equal(await reopened.locator('.platform-toggle input').nth(1).isChecked(),false);
  assert.equal(await reopened.locator('h1').innerText(),headings.en);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({languages:5,translatedErrors:true,persisted:true,independentControls:true,authorLink:true,minWidth:1080}));
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
