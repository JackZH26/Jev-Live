import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
if(process.platform!=='win32')throw new Error('The Steam observation helper requires Windows.');
execFileSync('dotnet',['publish','native/SteamObserver/SteamObserver.csproj','-c','Release','-o','dist-native'],{stdio:'inherit',windowsHide:true});
const assets=JSON.parse(readFileSync('native/SteamObserver/obj/project.assets.json','utf8'));
mkdirSync('dist-native/licenses',{recursive:true});
for(const [name,lib]of Object.entries(assets.libraries))for(const root of Object.keys(assets.packageFolders)){
 const folder=join(root,lib.path??name.toLowerCase());if(!existsSync(folder))continue;
 for(const file of readdirSync(folder).filter(f=>/license|third.party.notices/i.test(f))){
  copyFileSync(join(folder,file),join('dist-native/licenses',name.replaceAll('/','-')+'-'+file));
 }
}
// Framework runtime packs are not included in the assets.libraries collection.
for(const root of Object.keys(assets.packageFolders))for(const pack of ['microsoft.netcore.app.runtime.win-x64','microsoft.windowsdesktop.app.runtime.win-x64','microsoft.windows.sdk.net.ref']){
 const base=join(root,pack);if(!existsSync(base))continue;
 for(const version of readdirSync(base))for(const file of ['LICENSE.TXT','LICENSE.txt','LICENSE','THIRD-PARTY-NOTICES.TXT','ThirdPartyNotices.txt']){
  const source=join(base,version,file);if(existsSync(source))copyFileSync(source,join('dist-native/licenses',pack+'-'+version+'-'+file));
 }
}
