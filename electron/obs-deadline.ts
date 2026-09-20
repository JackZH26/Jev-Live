/** OBS may keep a socket alive while its UI thread stops answering requests. */
export function boundObsRequests<T extends {call:(...args:any[])=>Promise<any>;disconnect:()=>Promise<void>}>(client:T,timeoutMs=8000):T{
 const call=client.call.bind(client);
 client.call=((...args:any[])=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{reject(new Error('OBS request timed out'));void client.disconnect().catch(()=>{});},timeoutMs);
  Promise.resolve().then(()=>call(...args)).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
 })) as T['call'];
 return client;
}
