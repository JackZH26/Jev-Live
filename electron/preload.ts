import { contextBridge, ipcRenderer } from 'electron';
const names=['snapshot','saveSettings','saveJevKey','importGoogleClient','connectAccount','cancelLogin','disconnectAccount','setupOBS','windows','setCapture','preview','launchGame','setMode','startStream','stopStream','openExternal'];
const api=Object.fromEntries(names.map(name=>[name,async(arg?:unknown)=>{
  const result=await ipcRenderer.invoke(`studio:${name}`,arg);
  if(!result.ok)throw new Error(result.error);return result.data;
}]));
contextBridge.exposeInMainWorld('studio',Object.freeze(api));
