import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createInitialState,validateState,removeGarment} from '../docs/core.mjs';
import {splitState,hydrateState,validateSnapshot,mergeStates,isPristineState} from '../docs/sync-data.mjs';

const png='data:image/png;base64,YQ==';
const jpeg='data:image/jpeg;base64,Yg==';
const webp='data:image/webp;base64,Yw==';
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex');
const ref=value=>`asset:${hash(value)}`;
const copy=value=>structuredClone(value);
const item=(id,name)=>({id,name,category:'随身',qty:1,status:'pending',source:'custom'});
const garment=(id,photo)=>({id,name:id,category:'jacket',color:'black',...(photo===undefined?{}:{photo})});
const piece=(id,garmentId)=>({id,garmentId,x:500,y:400,scale:1,rotation:0,z:0});
const fixture=()=>({version:1,activeTripId:'trip-a',trips:[{id:'trip-a',name:'周末',sport:'both',overnight:false,createdAt:'2026-11-12T00:00:00.000Z',items:[item('item-a','水'),item('item-b','纸巾')]}],wardrobe:[garment('garment-a',png)],outfits:[],customTemplates:[]});
const packedFixture=()=>{const state=fixture();state.wardrobe[0].photo=ref(png);return state;};
const noConflict=result=>{assert.deepEqual(result.conflicts,[]);assert.ok(result.state);assert.equal(validateState(result.state),true);return result.state;};
const hasConflict=result=>{assert.equal(result.state,null);assert.ok(result.conflicts.length);assert.ok(result.conflicts.every(c=>typeof c.path==='string'&&typeof c.label==='string'&&c.label.length));return result.conflicts;};

test('照片拆分保留可选字段、按完整数据 URL 的 SHA-256 去重且不修改原记录',async()=>{
  const state=fixture();state.wardrobe.push(garment('garment-b',png),garment('garment-c',''),garment('garment-d'));
  state.wardrobe[0].cutout=webp;
  const before=copy(state),{snapshot,assets}=await splitState(state);
  assert.deepEqual(state,before);
  assert.equal(snapshot.wardrobe[0].photo,ref(png));
  assert.equal(snapshot.wardrobe[0].cutout,ref(webp));
  assert.equal(snapshot.wardrobe[1].photo,ref(png));
  assert.equal(snapshot.wardrobe[2].photo,'');
  assert.equal(Object.hasOwn(snapshot.wardrobe[3],'photo'),false);
  assert.deepEqual(assets,new Map([[hash(png),png],[hash(webp),webp]]));
  assert.equal(validateSnapshot(snapshot),true);
  assert.deepEqual(await hydrateState(snapshot,id=>assets.get(id)),state);
});

test('拆分拒绝非法原记录而不是将未知字段或无效照片送往云端',async()=>{
  const extra=fixture();extra.token='private';
  const broken=fixture();broken.wardrobe[0].photo='https://example.com/photo.png';
  await assert.rejects(()=>splitState(extra));
  await assert.rejects(()=>splitState(broken));
});

test('云端元数据只接受完整 v1 结构与小写哈希引用，继续拒绝坏引用和额外字段',()=>{
  assert.equal(validateSnapshot(packedFixture()),true);
  for(const mutate of [
    s=>{s.wardrobe[0].photo=png;},s=>{s.wardrobe[0].photo='asset:abc';},
    s=>{s.wardrobe[0].photo=`asset:${'A'.repeat(64)}`;},s=>{s.version=2;},
    s=>{s.wardrobe[0].cutout=ref(webp);delete s.wardrobe[0].photo;},
    s=>{s.activeTripId='missing';},s=>{s.extra=true;},
    s=>{s.outfits.push({id:'outfit',name:'搭配',garmentIds:['missing']});},
  ]){const state=packedFixture();mutate(state);assert.equal(validateSnapshot(state),false);}
});

test('输入必须是无原型攻击字段、访问器、循环和非 JSON 值的普通数据',async()=>{
  let getterCalls=0;
  const accessor=packedFixture();Object.defineProperty(accessor,'board',{get(){getterCalls++;return undefined;},enumerable:true});
  const proto=packedFixture();Object.defineProperty(proto.wardrobe[0],'__proto__',{value:{polluted:true},enumerable:true});
  const inherited=packedFixture();Object.setPrototypeOf(inherited.wardrobe[0],{bad:true});
  const symbol=packedFixture();symbol[Symbol('private')]=true;
  const undefinedValue=packedFixture();undefinedValue.board=undefined;
  const cycle=packedFixture();cycle.board=cycle;
  for(const state of [accessor,proto,inherited,symbol,undefinedValue,cycle]){
    assert.equal(validateSnapshot(state),false);
    await assert.rejects(()=>hydrateState(state,()=>png));
  }
  assert.equal(getterCalls,0);
  assert.equal({}.polluted,undefined);
});

test('恢复校验实际内容哈希、复用相同资产且不修改元数据',async()=>{
  const state=packedFixture();state.wardrobe.push(garment('garment-b',ref(png)));
  const before=copy(state);let reads=0;
  const restored=await hydrateState(state,async id=>{assert.equal(id,hash(png));reads++;return png;});
  assert.equal(restored.wardrobe[0].photo,png);assert.equal(restored.wardrobe[1].photo,png);
  assert.equal(reads,1);assert.deepEqual(state,before);
  await assert.rejects(()=>hydrateState(state,()=>jpeg));
  await assert.rejects(()=>hydrateState(state,()=>undefined));
  await assert.rejects(()=>hydrateState(state,()=>{throw new Error('offline');}));
});

test('恢复后的逐张与合计照片预算、抠图类型仍由真实内容约束',async()=>{
  const large='data:image/png;base64,'+'A'.repeat(1400000);
  const total=fixture();total.wardrobe=Array.from({length:6},(_,i)=>garment(`garment-${i}`,ref(large)));
  assert.equal(validateSnapshot(total),true);
  await assert.rejects(()=>hydrateState(total,()=>large));
  const huge='data:image/png;base64,'+'B'.repeat(1500000);
  const single=packedFixture();single.wardrobe[0].photo=ref(huge);
  await assert.rejects(()=>hydrateState(single,()=>huge));
  const wrongCutout=packedFixture();wrongCutout.wardrobe[0].cutout=ref(jpeg);
  await assert.rejects(()=>hydrateState(wrongCutout,id=>id===hash(jpeg)?jpeg:png));
  const invalidImage='data:image/svg+xml;base64,YQ==';
  const svg=packedFixture();svg.wardrobe[0].photo=ref(invalidImage);
  await assert.rejects(()=>hydrateState(svg,()=>invalidImage));
});

test('不同设备修改不同项目与字段时全部保留，并且不修改输入',()=>{
  const base=fixture(),local=copy(base),remote=copy(base);
  local.trips[0].items[0].status='packed';remote.trips[0].items[1].packingLocation='backpack';
  local.wardrobe[0].name='绿外套';remote.wardrobe[0].color='green';
  const before=[copy(base),copy(local),copy(remote)];
  const merged=noConflict(mergeStates(base,local,remote));
  assert.equal(merged.trips[0].items[0].status,'packed');assert.equal(merged.trips[0].items[1].packingLocation,'backpack');
  assert.equal(merged.wardrobe[0].name,'绿外套');assert.equal(merged.wardrobe[0].color,'green');
  assert.deepEqual([base,local,remote],before);
});

test('按 ID 合并新增行程、项目、衣橱、搭配与常用装备并保留单侧删除',()=>{
  const base=fixture(),local=copy(base),remote=copy(base);
  local.trips[0].items=local.trips[0].items.filter(i=>i.id!=='item-a');remote.trips[0].items.push(item('item-c','纸巾二'));
  local.wardrobe.push(garment('garment-b'));remote.wardrobe.push(garment('garment-c'));
  local.outfits.push({id:'outfit-b',name:'本机搭配',garmentIds:['garment-b']});remote.outfits.push({id:'outfit-c',name:'云端搭配',garmentIds:['garment-c']});
  local.customTemplates.push(item('template-b','电池'));remote.customTemplates.push(item('template-c','充电线'));
  remote.trips.push({...copy(remote.trips[0]),id:'trip-b',items:[item('item-d','水二')]});
  const merged=noConflict(mergeStates(base,local,remote));
  assert.deepEqual(merged.trips[0].items.map(i=>i.id),['item-b','item-c']);
  assert.equal(merged.trips.length,2);assert.equal(merged.wardrobe.length,3);
  assert.equal(merged.outfits.length,2);assert.equal(merged.customTemplates.length,2);
});

test('同一字段的相反修改产生可定位冲突，相同修改则只合并一次',()=>{
  const base=fixture(),local=copy(base),remote=copy(base);
  local.wardrobe[0].name='外套一';remote.wardrobe[0].name='外套二';
  const conflicts=hasConflict(mergeStates(base,local,remote));
  assert.ok(conflicts.some(c=>c.path.includes('garment-a')&&c.path.includes('name')));
  remote.wardrobe[0].name='外套一';
  assert.equal(noConflict(mergeStates(base,local,remote)).wardrobe[0].name,'外套一');
});

test('数量和装包状态整体合并，防止增量数量被另一设备误标为已装',()=>{
  const base=fixture(),local=copy(base),remote=copy(base);
  local.trips[0].items[0].qty=2;remote.trips[0].items[0].status='packed';
  hasConflict(mergeStates(base,local,remote));
  remote.trips[0].items[0].status='pending';remote.trips[0].items[0].packingLocation='luggage';
  const merged=noConflict(mergeStates(base,local,remote));
  assert.equal(merged.trips[0].items[0].qty,2);assert.equal(merged.trips[0].items[0].status,'pending');
  assert.equal(merged.trips[0].items[0].packingLocation,'luggage');
});

test('原图与抠图整体合并，不能将新原图和另一设备的旧抠图拼在一起',()=>{
  const base=fixture(),local=copy(base),remote=copy(base);
  local.wardrobe[0].photo=jpeg;remote.wardrobe[0].cutout=webp;
  hasConflict(mergeStates(base,local,remote));
});

test('当前画板及搭配保存的画板都整体处理并保护层级一致性',()=>{
  const base=fixture();base.board={background:'paper',pieces:[piece('piece-a','garment-a')]};
  base.outfits=[{id:'outfit-a',name:'周末搭配',garmentIds:['garment-a'],board:{background:'paper',pieces:[piece('piece-b','garment-a')]}}];
  let local=copy(base),remote=copy(base);local.board.pieces[0].x=700;remote.board.background='dark';
  hasConflict(mergeStates(base,local,remote));
  local=copy(base);remote=copy(base);local.outfits[0].board.pieces[0].x=700;remote.outfits[0].board.background='dark';
  hasConflict(mergeStates(base,local,remote));
});

test('删除与编辑或同 ID 的不同新增均保留冲突，不静默复活或吞掉记录',()=>{
  const base=fixture(),local=removeGarment(base,'garment-a'),remote=copy(base);remote.wardrobe[0].name='改过的外套';
  hasConflict(mergeStates(base,local,remote));
  const sameLocal=copy(base),sameRemote=copy(base);sameLocal.wardrobe.push(garment('new-id',png));sameRemote.wardrobe.push(garment('new-id',jpeg));
  hasConflict(mergeStates(base,sameLocal,sameRemote));
  assert.equal(noConflict(mergeStates(base,local,copy(base))).wardrobe.length,0);
});

test('合并后坏引用或超出照片预算会转为冲突，保留历史行程中的衣橱快照',()=>{
  const base=fixture(),local=removeGarment(base,'garment-a'),remote=copy(base);
  remote.outfits.push({id:'new-outfit',name:'新搭配',garmentIds:['garment-a']});
  hasConflict(mergeStates(base,local,remote));
  const big='data:image/png;base64,'+'C'.repeat(1400000),largeBase=fixture();largeBase.wardrobe=[];
  const largeLocal=copy(largeBase),largeRemote=copy(largeBase);
  for(let i=0;i<3;i++){largeLocal.wardrobe.push(garment(`local-${i}`,big));largeRemote.wardrobe.push(garment(`remote-${i}`,big));}
  hasConflict(mergeStates(largeBase,largeLocal,largeRemote));
  const historical=copy(base);historical.trips[0].items.push({id:'historical-item',name:'外套',category:'穿戴',source:'wardrobe',wardrobeId:'garment-a',qty:1,status:'packed'});
  const historicalMerged=noConflict(mergeStates(historical,removeGarment(historical,'garment-a'),copy(historical)));
  assert.equal(historicalMerged.trips[0].items.at(-1).wardrobeId,'garment-a');
});

test('当前行程优先保留本机选择，被删除后使用仍存在的云端选择',()=>{
  const base=fixture();base.trips.push({...copy(base.trips[0]),id:'trip-b',items:[]});
  const local=copy(base),remote=copy(base);remote.activeTripId='trip-b';
  assert.equal(noConflict(mergeStates(base,local,remote)).activeTripId,'trip-a');
  remote.trips=remote.trips.filter(t=>t.id!=='trip-a');
  assert.equal(noConflict(mergeStates(base,local,remote)).activeTripId,'trip-b');
});

test('新设备默认数据识别忽略生成 ID 与时间，但任何实际改动都不能被当作空白覆盖',()=>{
  const initial=createInitialState();assert.equal(isPristineState(initial),true);
  const another=createInitialState();assert.notEqual(initial.trips[0].id,another.trips[0].id);assert.equal(isPristineState(another),true);
  for(const mutate of [
    s=>{s.trips[0].name='旅行';},s=>{s.trips[0].items[0].status='packed';},s=>{s.trips[0].items[0].qty=2;},
    s=>{s.trips[0].items.pop();},s=>{s.trips[0].items[0].packingLocation='backpack';},
    s=>{s.wardrobe.push(garment('added'));},s=>{s.board={background:'paper',pieces:[]};},
    s=>{s.customTemplates.push(item('template','自定义'));},
  ]){const changed=copy(initial);mutate(changed);assert.equal(isPristineState(changed),false);}
  assert.equal(isPristineState(null),false);hasConflict(mergeStates(initial,initial,{invalid:true}));
});
