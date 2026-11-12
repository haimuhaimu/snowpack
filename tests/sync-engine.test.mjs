import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState} from '../docs/core.mjs';
import {splitState} from '../docs/sync-data.mjs';
import {createSyncEngine} from '../docs/sync-engine.mjs';
const CODE='SNOW1-'+ 'a'.repeat(43);
const clone=v=>structuredClone(v);
function setup(initial=createInitialState(),remote=null){
 let local=clone(initial),session=null,backups=[],revision=remote?'r1':null,cloud=clone(remote),writes=0,fail=false,busy=false,afterWrite=null;
 const api={getState:async()=>{if(fail)throw Error('offline');return {revision,snapshot:cloud?(await splitState(cloud)).snapshot:null};},loadAsset:async()=>{throw Error('unexpected photo');},putAsset:async()=>{},putState:async(snapshot,expected)=>{if(expected!==revision){const e=Error('race');e.status=409;throw e;}writes++;cloud=clone(snapshot);revision='r'+(writes+1);if(afterWrite)afterWrite();return {revision};}};
 const store={get:async()=>clone(session),set:async v=>{session=clone(v);},backup:async(state,reason)=>{backups.push({id:String(backups.length),state:clone(state),reason});},listBackups:async()=>clone(backups)};
 const engine=createSyncEngine({readLocal:()=>clone(local),applyLocal:async v=>{local=clone(v);return true;},store,transport:()=>api,canApply:()=>!busy,verifyPhotos:async()=>{},onStatus:()=>{},withLock:fn=>fn()});
 return {engine,api,store,get local(){return local;},set local(v){local=v;},get cloud(){return cloud;},get session(){return session;},get writes(){return writes;},get backups(){return backups;},set fail(v){fail=v;},set busy(v){busy=v;},set afterWrite(v){afterWrite=v;},remoteChange(fn){fn(cloud);revision+='x';}};
}
test('fresh phone downloads cloud before ever uploading default trip',async()=>{const remote=createInitialState();remote.trips[0].items[0].status='packed';const x=setup(createInitialState(),remote);await x.engine.connect(CODE);assert.deepEqual(x.local,remote);assert.equal(x.writes,0);assert.equal(x.engine.getStatus().phase,'synced');});
test('first local records uploaded then separate concurrent edits merge',async()=>{const x=setup();await x.engine.connect(CODE);x.local.trips[0].items[0].status='packed';x.remoteChange(s=>s.trips[0].items[1].status='packed');await x.engine.run();assert.equal(x.cloud.trips[0].items[0].status,'packed');assert.equal(x.cloud.trips[0].items[1].status,'packed');assert.deepEqual(x.local,x.cloud);});
test('offline edit remains local and synchronizes after reload using durable base',async()=>{const x=setup();await x.engine.connect(CODE);x.local.trips[0].items[0].status='packed';x.fail=true;await x.engine.run();assert.equal(x.local.trips[0].items[0].status,'packed');assert.equal(x.engine.getStatus().phase,'error');x.fail=false;await x.engine.run();assert.equal(x.cloud.trips[0].items[0].status,'packed');});
test('overlapping changes preserve both and require explicit resolution',async()=>{const x=setup();await x.engine.connect(CODE);x.local.trips[0].items[0].status='packed';x.remoteChange(s=>s.trips[0].items[0].status='skip');await x.engine.run();assert.equal(x.engine.getStatus().phase,'conflict');assert.equal(x.local.trips[0].items[0].status,'packed');assert.equal(x.cloud.trips[0].items[0].status,'skip');await x.engine.resolve('remote');assert.equal(x.local.trips[0].items[0].status,'skip');assert.equal(x.backups.length,2);});
test('new local edit during upload is rebased instead of lost',async()=>{const x=setup();await x.engine.connect(CODE);x.local.trips[0].items[0].status='packed';x.afterWrite=()=>{x.local.trips[0].items[1].status='wearing';};await x.engine.run();assert.equal(x.local.trips[0].items[1].status,'wearing');x.afterWrite=null;await x.engine.run();assert.equal(x.cloud.trips[0].items[1].status,'wearing');});
test('remote changes wait while editor active',async()=>{const x=setup();await x.engine.connect(CODE);x.remoteChange(s=>s.trips[0].items[0].status='packed');x.busy=true;await x.engine.run();assert.equal(x.local.trips[0].items[0].status,'pending');x.busy=false;await x.engine.run();assert.equal(x.local.trips[0].items[0].status,'packed');});
test('nonempty first connection does not overwrite either side',async()=>{const a=createInitialState(),b=createInitialState();a.trips[0].name='local';b.trips[0].name='remote';const x=setup(a,b);await x.engine.connect(CODE);assert.equal(x.engine.getStatus().phase,'conflict');assert.equal(x.writes,0);assert.equal(x.local.trips[0].name,'local');});
test('disconnect preserves local records and prevents future cloud writes',async()=>{const x=setup();await x.engine.connect(CODE);const local=clone(x.local);await x.engine.disconnect();await x.engine.run();assert.deepEqual(x.local,local);assert.equal(x.engine.getStatus().connected,false);assert.equal(x.session,null);});

for(const pauseAt of ['list','verify','backup'])test(`restore preserves new local edits made during async ${pauseAt}`,async()=>{
 let local=createInitialState(),applied=0,release,enter;
 const selected=clone(local);selected.trips[0].name='older backup';
 const entered=new Promise(resolve=>{enter=resolve;});
 const pause=async()=>{enter();await new Promise(resolve=>{release=resolve;});};
 const store={get:async()=>null,listBackups:async()=>{if(pauseAt==='list')await pause();return [{id:'restore',state:selected}];},
  backup:async()=>{if(pauseAt==='backup')await pause();}};
 const engine=createSyncEngine({readLocal:()=>clone(local),applyLocal:async value=>{applied++;local=clone(value);return true;},store,
  transport:()=>null,verifyPhotos:async()=>{if(pauseAt==='verify')await pause();}});
 const recovery=engine.recoverBackup('restore');
 await entered;local.trips[0].items[0].status='packed';release();
 await assert.rejects(recovery,/本机|编辑/);
 assert.equal(applied,0);
 assert.equal(local.trips[0].items[0].status,'packed');
 assert.notEqual(local.trips[0].name,'older backup');
});

test('restore waits for active editing and never overwrites an editor opened while saving its safety copy',async()=>{
 let local=createInitialState(),busy=true,applied=0,backups=0;
 const selected=clone(local);selected.trips[0].name='older backup';
 const store={get:async()=>null,listBackups:async()=>[{id:'restore',state:selected}],backup:async()=>{backups++;busy=true;}};
 const engine=createSyncEngine({readLocal:()=>clone(local),applyLocal:async value=>{applied++;local=clone(value);return true;},store,
  transport:()=>null,canApply:()=>!busy});
 await assert.rejects(()=>engine.recoverBackup('restore'),/本机|编辑/);
 assert.equal(backups,0);assert.equal(applied,0);
 busy=false;
 await assert.rejects(()=>engine.recoverBackup('restore'),/本机|编辑/);
 assert.equal(backups,1);assert.equal(applied,0);
 assert.notEqual(local.trips[0].name,'older backup');
});

test('unchanged restore saves the previous local record before applying and reports local save failures',async()=>{
 for(const canSave of [true,false]){
  let local=createInitialState();const before=clone(local),selected=clone(local),copies=[];
  selected.trips[0].name='older backup';
  const store={get:async()=>null,listBackups:async()=>[{id:'restore',state:selected}],backup:async value=>{copies.push(clone(value));}};
  const engine=createSyncEngine({readLocal:()=>clone(local),applyLocal:async value=>{assert.deepEqual(copies,[before]);if(canSave)local=clone(value);return canSave;},store,transport:()=>null});
  if(canSave){await engine.recoverBackup('restore');assert.deepEqual(local,selected);}
  else{await assert.rejects(()=>engine.recoverBackup('restore'),/本机无法保存/);assert.deepEqual(local,before);}
 }
});
test('local edit during unchanged remote read is not reported as synced',async()=>{const x=setup();await x.engine.connect(CODE);const get=x.api.getState;x.api.getState=async()=>{const r=await get();x.local.trips[0].items[0].status='packed';return r;};await x.engine.run();assert.equal(x.engine.getStatus().phase,'pending');assert.equal(x.cloud.trips[0].items[0].status,'pending');});

test('two devices viewing different active trips stay synced without alternating writes',async()=>{
 const initial=createInitialState();initial.trips.push({...clone(initial.trips[0]),id:'trip-other',name:'另一趟',items:[]});
 let cloud=clone(initial),revision='r1',writes=0;
 const api={getState:async()=>({revision,snapshot:(await splitState(cloud)).snapshot}),
  putState:async(snapshot,expected)=>{assert.equal(expected,revision);writes++;cloud=clone(snapshot);revision=`r${writes+1}`;return {revision};},
  loadAsset:async()=>{throw Error('unexpected photo');},putAsset:async()=>{throw Error('unexpected photo');}};
 function device(activeTripId){
  let local=clone(initial),session={code:CODE,base:clone(initial),revision:'r1',lastSynced:null};local.activeTripId=activeTripId;
  const store={get:async()=>clone(session),set:async value=>{session=clone(value);}};
  const engine=createSyncEngine({readLocal:()=>clone(local),applyLocal:async value=>{local=clone(value);return true;},store,transport:()=>api});
  return {engine,get local(){return local;}};
 }
 const first=device(initial.activeTripId),second=device('trip-other');
 for(let round=0;round<3;round++){await second.engine.run();await first.engine.run();}
 assert.equal(writes,0);
 assert.equal(first.local.activeTripId,initial.activeTripId);assert.equal(second.local.activeTripId,'trip-other');
 second.local.trips[0].items[0].status='packed';await second.engine.run();await first.engine.run();
 assert.equal(writes,1);assert.equal(first.local.trips[0].items[0].status,'packed');
 for(let round=0;round<2;round++){await first.engine.run();await second.engine.run();}
 assert.equal(writes,1);assert.equal(first.local.activeTripId,initial.activeTripId);assert.equal(second.local.activeTripId,'trip-other');
 assert.equal(first.engine.getStatus().phase,'synced');assert.equal(second.engine.getStatus().phase,'synced');
});

test('uploading an already saved local edit does not reapply local state or discard its undo history',async()=>{
 let local=createInitialState(),session={code:CODE,base:clone(local),revision:'r1',lastSynced:null},applies=0,writes=0,undo=['board change'];
 let cloud=clone(local),revision='r1';local.trips[0].items[0].status='packed';
 const store={get:async()=>clone(session),set:async value=>{session=clone(value);}};
 const api={getState:async()=>({revision,snapshot:(await splitState(cloud)).snapshot}),putState:async(snapshot,expected)=>{assert.equal(expected,revision);writes++;cloud=clone(snapshot);revision='r2';return {revision};},putAsset:async()=>{},loadAsset:async()=>{throw Error('unexpected photo');}};
 const engine=createSyncEngine({readLocal:()=>clone(local),applyLocal:async value=>{applies++;undo=[];local=clone(value);return true;},store,transport:()=>api});
 await engine.run();
 assert.equal(writes,1);assert.equal(applies,0);assert.deepEqual(undo,['board change']);
 assert.equal(cloud.trips[0].items[0].status,'packed');assert.deepEqual(session.base,local);assert.equal(engine.getStatus().phase,'synced');
});

test('first sync still persists the generated initial state before acknowledging its baseline',async()=>{
 const initial=createInitialState();let local=clone(initial),session={code:CODE,base:null,revision:null,lastSynced:null},applies=0,persisted=null;
 const store={get:async()=>clone(session),set:async value=>{session=clone(value);}};
 const api={getState:async()=>({revision:null,snapshot:null}),putState:async()=>({revision:'r1'}),putAsset:async()=>{},loadAsset:async()=>{throw Error('unexpected photo');}};
 const engine=createSyncEngine({readLocal:()=>clone(local),applyLocal:async value=>{applies++;persisted=clone(value);local=clone(value);return true;},store,transport:()=>api});
 await engine.run();
 assert.equal(applies,1);assert.deepEqual(persisted,initial);assert.deepEqual(session.base,persisted);assert.equal(engine.getStatus().phase,'synced');
});
