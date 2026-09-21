import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export interface BuildInfo {version:string;strategyRevision:string;commit:string;builtAt:string}
export function readBuildInfo(directory:string,version:string):BuildInfo{
 try{const value=JSON.parse(readFileSync(join(directory,'build-info.json'),'utf8'));
  if(value.schemaVersion!==1||!/^[a-f0-9]{12}$/.test(value.strategyRevision)||typeof value.version!=='string'||typeof value.builtAt!=='string')throw Error('Invalid build information');
  return {version:value.version,strategyRevision:value.strategyRevision,commit:typeof value.commit==='string'?value.commit:'unknown',builtAt:value.builtAt};
 }catch{return {version,strategyRevision:'unknown',commit:'unknown',builtAt:''};}
}
