import {validateState} from './core.mjs?v=alpine-v7.1';
import {splitState,hydrateState,mergeStates,isPristineState} from './sync-data.mjs?v=sync-v1';
const copy=v=>structuredClone(v);
const same=(a,b)=>{if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));};
// Each device keeps its own selected trip. Navigation alone must not rewrite the cloud.
const sameShared=(a,b)=>{if(!a||!b)return a===b;const {activeTripId:aId,...aData}=a,{activeTripId:bId,...bData}=b;return same(aData,bData);};
export const validSyncCode=code=>typeof code==='string'&&/^SNOW1-[A-Za-z0-9_-]{43}$/.test(code);
export function createSyncEngine({readLocal,applyLocal,store,transport,canApply=()=>true,verifyPhotos=async()=>{},onStatus=()=>{},withLock=fn=>fn()}){
 let running=null,status={phase:'disconnected',message:'连接一次，手机和电脑自动同步。',connected:false,lastSynced:null};
 const report=(phase,message,record)=>{status={phase,message,connected:Boolean(record?.code),lastSynced:record?.lastSynced||null};onStatus({...status});};
 const persistConflict=async(record,local,remote,revision,message)=>{record={...record,conflict:{local:copy(local),remote:copy(remote),revision,message},pending:null};await store.set(record);report('conflict',message,record);return record;};
 async function applyPending(record){
   if(!record.pending)return record;
   if(!canApply()){report('pending','本机已保存，结束当前编辑后继续同步。',record);return null;}
   const {source,remote,revision}=record.pending,current=readLocal();
   const merged=mergeStates(source,current,remote);
   if(!merged.state)return persistConflict(record,current,remote,revision,'同步期间两台设备修改了相同内容，请选择保留的版本。');
   if(!validateState(merged.state))throw Error('云端记录未通过检查，本机记录未改动。');
   await verifyPhotos(merged.state.wardrobe);
   // Decoding is async: restart from the durable pending record if editing resumed.
   if(!canApply()||!same(current,readLocal())){report('pending','本机已保存，稍后继续同步。',record);return null;}
   // A local upload is already saved: reapplying it would reset UI undo history.
   // The first baseline still needs a durable write when readLocal returns a generated default.
   if((!record.base || !same(current,merged.state)) && !await applyLocal(merged.state))throw Error('本机空间不足，云端记录尚未写入此设备。');
   record={...record,base:remote,revision,pending:null,conflict:null,lastSynced:new Date().toISOString()};
   await store.set(record);return record;
 }
 async function cycle(){
  let record=await store.get();
  if(!record?.code){report('disconnected','连接一次，手机和电脑自动同步。',null);return;}
  if(record.conflict){report('conflict',record.conflict.message,record);return;}
  if(record.pending){record=await applyPending(record);if(!record||record.conflict)return;}
  if(!canApply()){report('pending','本机已保存，结束当前编辑后继续同步。',record);return;}
  report('syncing','正在同步清单和衣橱…',record);
  const local=copy(readLocal());
  if(!validateState(local))throw Error('请先修复本机记录，再继续同步。');
  const api=transport(record.code),response=await api.getState();
  if(!response||!(response.revision===null||typeof response.revision==='string')||Boolean(response.snapshot)!==Boolean(response.revision))throw Error('云端响应不完整，本机记录未改动。');
  if(!same(local,readLocal())||!canApply()){report('pending','本机已保存，稍后继续同步。',record);return;}
  if(record.base&&response.revision===record.revision&&sameShared(local,record.base)){report('synced','清单、衣橱和搭配已同步。',record);return;}
  const localParts=await splitState(local);
  let remote=null;
  if(response.snapshot){
   remote=record.base&&response.revision===record.revision?record.base:await hydrateState(response.snapshot,async hash=>localParts.assets.get(hash)??await api.loadAsset(hash));
   await verifyPhotos(remote.wardrobe);
  }
  if(!same(local,readLocal())||!canApply()){report('pending','本机已保存，稍后继续同步。',record);return;}
  let candidate=local;
  if(remote){
   if(!record.base){
    if(isPristineState(local)||same(local,remote))candidate=remote;
    else {await persistConflict(record,local,remote,response.revision,'首次连接发现本机和云端都有记录，请选择一份作为同步起点。');return;}
   }else{
    const merged=mergeStates(record.base,local,remote);
    if(!merged.state){await persistConflict(record,local,remote,response.revision,'两台设备修改了相同内容。两份记录都在，请选择保留的版本。');return;}
    candidate=merged.state;
   }
  }else if(record.base){throw Error('云端原记录暂时不可用，已停止上传以保护本机记录。');}
  let revision=response.revision;
  if(!sameShared(candidate,remote)){
   const parts=await splitState(candidate),remoteRefs=new Set(response.snapshot?.wardrobe.flatMap(g=>[g.photo,g.cutout]).filter(Boolean)||[]);
   for(const [hash,data]of parts.assets)if(!remoteRefs.has('asset:'+hash))await api.putAsset(hash,data);
   if(!same(local,readLocal())||!canApply()){report('pending','本机已保存，稍后继续同步。',record);return;}
   const result=await api.putState(parts.snapshot,response.revision);
   if(typeof result?.revision!=='string'||!result.revision)throw Error('云端尚未确认保存，将重新核对后重试。');
   revision=result.revision;
  }
  // Save the reconciliation intent BEFORE touching local state. A reload can resume it.
  record={...record,pending:{source:local,remote:candidate,revision}};
  await store.set(record);
  record=await applyPending(record);if(!record||record.conflict)return;
  if(sameShared(readLocal(),record.base))report('synced','清单、衣橱和搭配已同步。',record);
  else report('pending','新修改已在本机保存，等待同步。',record);
 }
 async function run(){
  if(running)return running;
  running=withLock(async()=>{
   try{await cycle();}
   catch(error){const r=await store.get();const message=error.status===401?'同步码不正确或已失效，请重新连接。':error.status===409?'另一台设备刚更新了记录，稍后自动重新核对。':error.message?.includes('云端')||error.message?.includes('本机')||error.message?.includes('同步')?error.message:'暂时无法连接，本机记录已保留，联网后会重试。';report(error.status===409?'pending':'error',message,r);}
  }).finally(()=>{running=null;});return running;
 }
 async function connect(input){
  const code=input.trim();if(!validSyncCode(code))throw Error('同步码格式不正确，请粘贴完整的专属同步码。');
  await withLock(async()=>{const probe=await transport(code).getState();if(!probe||!('snapshot'in probe))throw Error('同步服务暂时不可用，请稍后重试。');const old=await store.get();if(old&&old.code!==code)await store.backup(readLocal(),'更换同步空间前');await store.set(old?.code===code?old:{code,base:null,revision:null,lastSynced:null});});
  await run();
 }
 async function resolve(side){
  if(!['local','remote'].includes(side))return;
  await withLock(async()=>{let r=await store.get();if(!r?.conflict)return;const current=copy(readLocal()),c=r.conflict;await store.backup(current,'冲突处理前 · 本机');await store.backup(c.remote,'冲突处理前 · 云端');r={...r,base:c.remote,revision:c.revision,conflict:null,pending:side==='remote'?{source:current,remote:c.remote,revision:c.revision}:null};await store.set(r);});await run();
 }
 return {run,connect,resolve,localChanged(){if(status.connected&&status.phase!=='conflict'){status={...status,phase:'pending',message:'已保存在本机，等待同步。'};onStatus({...status});}},getStatus:()=>({...status}),getCode:async()=>(await store.get())?.code||'',
  disconnect:async()=>{await withLock(async()=>{await store.set(null);report('disconnected','已断开，本机记录仍保留。',null);});},
  listBackups:()=>store.listBackups(),recoverBackup:async id=>{
   await withLock(async()=>{
    const current=copy(readLocal());
    const ensureUnchanged=()=>{if(!canApply()||!same(current,readLocal()))throw Error('本机正在编辑或有新修改，已停止恢复，请结束编辑后重试。');};
    ensureUnchanged();
    const b=(await store.listBackups()).find(x=>x.id===id);
    ensureUnchanged();
    if(!b||!validateState(b.state))throw Error('恢复副本不可用。');
    await verifyPhotos(b.state.wardrobe);
    ensureUnchanged();
    await store.backup(current,'恢复副本前');
    ensureUnchanged();
    if(!await applyLocal(copy(b.state)))throw Error('本机无法保存恢复副本。');
   });
   await run();
  },
 };
}
