import { contextBridge, ipcRenderer } from 'electron';
const names=['snapshot','setLocale','scanSteam','addSteamGame','selectSteamGame','removeSteamGame','saveSettings','selectPlatforms','saveJevKey','importGoogleClient','connectAccount','cancelLogin','disconnectAccount','saveXSource','removeXSource','setupOBS','windows','setCapture','preview','launchGame','setMode','startStream','stopStream','openExternal'];
names.push('hostSnapshot','saveHostConfig','saveHostLayouts','saveHostKey','importAvatar','startHost','stopHost','testHostVoice','applyHostLayout','gamePreview');
const api=Object.fromEntries(names.map(name=>[name,async(arg?:unknown)=>{
  const result=await ipcRenderer.invoke(`studio:${name}`,arg);
  if(!result.ok)throw new Error(result.error);return result.data;
}]));
contextBridge.exposeInMainWorld('studio',Object.freeze(api));
