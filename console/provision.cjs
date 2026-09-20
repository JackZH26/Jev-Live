// Run with Electron. Secrets live in a separate DPAPI vault outside every repo.
const {app,safeStorage}=require('electron'),path=require('node:path'),crypto=require('node:crypto');
app.disableHardwareAcceleration();app.whenReady().then(async()=>{
 const {Store}=require('../dist-main/electron/storage');const store=new Store(path.join(process.env.LOCALAPPDATA,'JevPrivateConsole'),safeStorage);await store.init();
 let config=await store.get('server');if(!config){const password=crypto.randomBytes(18).toString('base64url'),salt=crypto.randomBytes(16).toString('hex');
  config={origin:'https://etc.jackz.co',salt,password_hash:crypto.pbkdf2Sync(password,Buffer.from(salt,'hex'),240000,32,'sha256').toString('hex'),session_key:crypto.randomBytes(32).toString('hex'),ingest_token:crypto.randomBytes(32).toString('hex')};
  await store.set('password',password);await store.set('server',config);
 }
 if(process.argv.includes('--export-server'))process.stdout.write(JSON.stringify(config));
 else if(process.argv.includes('--show-password'))process.stdout.write(await store.get('password'));
 else console.log('Private console credentials provisioned in the local encrypted vault.');
}).catch(()=>{console.error('Credential provisioning failed; values withheld.');process.exitCode=1}).finally(()=>app.exit(process.exitCode||0));
