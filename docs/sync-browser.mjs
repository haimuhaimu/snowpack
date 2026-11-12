import {createSyncEngine} from './sync-engine.mjs?v=sync-v1';
const DB='snowpack.sync.v1';
export function createSyncStore(){
 let connection;
 const db=()=>connection??=new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{request.result.createObjectStore('records');};request.onsuccess=()=>{const result=request.result;result.onversionchange=()=>result.close();resolve(result);};request.onerror=()=>reject(Error('本机无法保存同步信息，请检查浏览器存储设置。'));request.onblocked=()=>reject(Error('请关闭其他雪前窗口后重试。'));});
 async function read(key){const c=await db();return new Promise((resolve,reject)=>{const tx=c.transaction('records','readonly'),r=tx.objectStore('records').get(key);r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(Error('本机同步记录读取失败。'));});}
 async function write(key,value){const c=await db();return new Promise((resolve,reject)=>{const tx=c.transaction('records','readwrite');tx.objectStore('records').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(Error('本机同步空间不足，原记录仍保留。'));});}
 return {get:()=>read('session'),set:value=>write('session',value),listBackups:async()=>await read('backups')||[],backup:async(state,reason)=>{const entries=await read('backups')||[];entries.unshift({id:crypto.randomUUID(),createdAt:new Date().toISOString(),reason,state});await write('backups',entries.slice(0,4));}};
}
export function createSyncTransport(endpoint,code){
 async function request(kind,{hash,method='GET',body,revision}={}){
  const url=new URL(endpoint);url.searchParams.set('kind',kind);if(hash)url.searchParams.set('hash',hash);
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
  const headers={Authorization:'Bearer '+code};
  if(method==='PUT'){headers['Content-Type']=kind==='state'?'application/json':'text/plain';if(kind==='state')headers[revision===null?'If-None-Match':'If-Match']=revision===null?'*':revision;}
  try{
   const response=await fetch(url,{method,headers,body,cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});
   if(!response.ok){const e=Error(response.status===413?'同步内容超过云端容量，本机记录仍保留。':response.status===401?'同步码不正确或已失效。':'云端暂时不可用，本机记录已保留。');e.status=response.status;throw e;}
   const limit=kind==='asset'?1500000:2001000;const reader=response.body.getReader();let size=0;const chunks=[];
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('云端响应过大，本机记录未改动。');}chunks.push(value);}
   const bytes=new Uint8Array(size);let cursor=0;for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.length;}
   const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   return kind==='asset'&&method==='GET'?text:JSON.parse(text);
  }finally{clearTimeout(timeout);}
 }
 return {getState:()=>request('state'),loadAsset:hash=>request('asset',{hash}),putAsset:(hash,data)=>request('asset',{hash,method:'PUT',body:data}),putState:(snapshot,revision)=>request('state',{method:'PUT',body:JSON.stringify({snapshot}),revision})};
}
export function startBrowserSync({endpoint,...options}){
 const store=createSyncStore();let timer,poll,stopped=false;
 const engine=createSyncEngine({...options,store,transport:code=>createSyncTransport(endpoint,code),withLock:async fn=>{
  if(!navigator.locks)throw Error('当前浏览器暂不支持安全同步，请使用新版 Safari 或 Chrome。本机记录不受影响。');
  return navigator.locks.request('snowpack-cloud-sync',fn);
 }});
 const run=()=>{if(!stopped&&document.visibilityState!=='hidden')engine.run().catch(()=>options.onStatus({phase:'error',connected:false,message:'无法开启同步，本机记录仍保留。'}));};
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(run,1800);};
 const visibility=()=>{if(document.visibilityState==='visible')run();};
 window.addEventListener('online',run);window.addEventListener('focus',run);document.addEventListener('visibilitychange',visibility);
 poll=setInterval(run,30000);run();
 return {engine,schedule,markChanged(){engine.localChanged();schedule();},dispose(){stopped=true;clearTimeout(timer);clearInterval(poll);window.removeEventListener('online',run);window.removeEventListener('focus',run);document.removeEventListener('visibilitychange',visibility);}};
}
