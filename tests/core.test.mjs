import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../docs/core.mjs';

const fixture = () => ({version:1,activeTripId:'t1',trips:[{id:'t1',name:'周末',sport:'both',overnight:false,createdAt:'2026-11-12T00:00:00.000Z',items:[
  {id:'i1',name:'雪服外套',category:'穿戴',slot:'jacket',qty:1,status:'pending',source:'template'},
  {id:'i2',name:'雪裤',category:'穿戴',slot:'pants',qty:1,status:'packed',source:'template'},
]}],wardrobe:[
  {id:'g1',name:'白外套',category:'jacket',color:'white'},
  {id:'g2',name:'黑裤子',category:'pants',color:'black'},
  {id:'g3',name:'红外套',category:'jacket',color:'red'},
],outfits:[{id:'o1',name:'白黑',garmentIds:['g1','g2']},{id:'o2',name:'红黑',garmentIds:['g3','g2']}],customTemplates:[]});

test('默认状态可用，新增行程独立重置且按板型和过夜筛选', () => {
  const state = core.createInitialState();
  assert.equal(state?.version,1);
  assert.equal(core.getActiveTrip(state)?.name,'本次出发');
  assert.deepEqual(state.wardrobe,[]);
  assert.deepEqual(state.outfits,[]);
  const snow = core.createTrip({name:'单板',sport:'snowboard',overnight:false});
  const ski = core.createTrip({name:'双板',sport:'ski',overnight:true});
  assert.ok(snow.items.some(i=>i.name.includes('单板雪鞋')));
  assert.ok(!snow.items.some(i=>i.name.includes('双板雪鞋') || i.name==='雪杖'));
  assert.ok(ski.items.some(i=>i.name==='雪杖'));
  assert.ok(ski.items.some(i=>i.name.includes('洗漱')));
  assert.ok(!snow.items.some(i=>i.name.includes('洗漱')));
  assert.ok(snow.items.every(i=>i.status==='pending'));
  assert.ok(ski.items.every(i=>i.status==='pending'));
  assert.deepEqual(snow.items.filter(i=>i.category==='可选护具').map(i=>i.name),['护臀','护膝','护腕']);
  assert.ok(snow.items.every(i=>!ski.items.some(other=>other.id===i.id)));
});

test('只改当前行程且保留旧状态，租借待取不算完成', () => {
  const state=fixture();
  state.trips.push({...state.trips[0],id:'t2',items:[{...state.trips[0].items[0],id:'other'}]});
  const before=structuredClone(state);
  const changed=core.setItemStatus(state,'i1','rental');
  assert.equal(changed?.trips[0].items[0].status,'rental');
  assert.equal(changed.trips[1].items[0].status,'pending');
  assert.deepEqual(state,before);
  assert.deepEqual(core.summarizeTrip(changed.trips[0]),{total:2,ready:1,pending:0,rental:1,skipped:0});
  const excluded=core.setItemStatus(changed,'i1','skip');
  assert.deepEqual(core.summarizeTrip(excluded.trips[0]),{total:1,ready:1,pending:0,rental:0,skipped:1});
  assert.deepEqual(core.setItemStatus(state,'i1','unrecognized'),state);
});

test('数量按项目计数，增加已带件数需要重新确认，减少可保留', () => {
  const state=fixture();
  const increased=core.updateItemQty(state,'i2',3);
  assert.equal(increased?.trips[0].items[1].qty,3);
  assert.equal(increased.trips[0].items[1].status,'pending');
  assert.equal(state.trips[0].items[1].qty,1);
  assert.equal(core.summarizeTrip(increased.trips[0]).total,2);
  const ready=core.setItemStatus(increased,'i2','wearing');
  assert.equal(core.updateItemQty(ready,'i2',2).trips[0].items[1].status,'wearing');
  assert.equal(core.updateItemQty(state,'i1',999).trips[0].items[0].qty,99);
  assert.equal(core.updateItemQty(state,'i1',0).trips[0].items[0].qty,1);
});

test('自定义物品记入模板后新行程为待装，临时项目不会进入模板', () => {
  const state=fixture();
  const added=core.addCustomItem(state,{name:'  相机  ',category:'随身',qty:2},true);
  assert.equal(added?.trips[0].items.at(-1).name,'相机');
  assert.equal(added.customTemplates.length,1);
  assert.equal(state.customTemplates.length,0);
  const next=core.createTrip({name:'下次',sport:'ski',overnight:false},added.customTemplates);
  const camera=next.items.find(i=>i.name==='相机');
  assert.equal(camera.status,'pending');
  assert.equal(camera.qty,2);
  assert.notEqual(camera.id,added.trips[0].items.at(-1).id);
  assert.notEqual(camera.id,added.customTemplates[0].id);
  const temporary=core.addCustomItem(added,{name:'礼物',category:'随身',qty:1},false);
  assert.equal(temporary.customTemplates.length,1);
  assert.deepEqual(core.addCustomItem(state,{name:'  ',category:'随身',qty:1}),state);
});

test('加入搭配保留已装状态，替代未装通用品，去重且不把拥有当已带', () => {
  const state=fixture();
  const before=structuredClone(state);
  const added=core.addOutfitToTrip(state,'o1');
  assert.equal(added?.trips[0].items[0].status,'skip');
  assert.equal(added.trips[0].items[1].status,'packed');
  assert.deepEqual(added.trips[0].items.filter(i=>i.source==='wardrobe').map(i=>[i.wardrobeId,i.status,i.fromOutfit]),[['g1','pending',true],['g2','pending',true]]);
  const packed=core.setItemStatus(added,added.trips[0].items.find(i=>i.wardrobeId==='g1').id,'packed');
  const repeated=core.addOutfitToTrip(packed,'o1');
  assert.equal(repeated.trips[0].items.length,4);
  assert.equal(repeated.trips[0].items.find(i=>i.wardrobeId==='g1').status,'packed');
  const alternate=core.addOutfitToTrip(repeated,'o2');
  assert.equal(alternate.trips[0].items.find(i=>i.wardrobeId==='g1').status,'packed');
  assert.equal(alternate.trips[0].items.filter(i=>i.wardrobeId==='g2').length,1);
  assert.deepEqual(state,before);
});

test('配色建议仅用已录入实物，优先同色/中性色且最多六组', () => {
  assert.deepEqual(core.suggestOutfits([]),[]);
  assert.deepEqual(core.suggestOutfits([{id:'j',name:'外套',category:'jacket',color:'black'}]),[]);
  const wardrobe=[{id:'j1',name:'红外套',category:'jacket',color:'red'},{id:'j2',name:'黑外套',category:'jacket',color:'black'},
    {id:'p1',name:'紫裤',category:'pants',color:'purple'},{id:'p2',name:'黑裤',category:'pants',color:'black'},
    {id:'p3',name:'蓝裤',category:'pants',color:'blue'},{id:'p4',name:'黄裤',category:'pants',color:'yellow'}];
  const suggestions=core.suggestOutfits(wardrobe);
  assert.equal(suggestions.length,6);
  assert.deepEqual(suggestions[0].garmentIds.slice(0,2),['j2','p2']);
  assert.ok(suggestions.every(s=>s.garmentIds.every(id=>wardrobe.some(g=>g.id===id)) && typeof s.reason==='string' && Number.isFinite(s.score)));
  assert.ok(suggestions.every((s,i)=>i===0 || suggestions[i-1].score>=s.score));
});

test('重新加入搭配将已跳过实物恢复待装，保留其他已有状态', () => {
  const added=core.addOutfitToTrip(fixture(),'o1');
  const jacketId=added.trips[0].items.find(i=>i.wardrobeId==='g1').id;
  const pantsId=added.trips[0].items.find(i=>i.wardrobeId==='g2').id;
  const skipped=core.setItemStatus(added,jacketId,'skip');
  for (const status of ['pending','rental','packed','wearing']) {
    const before=core.setItemStatus(skipped,pantsId,status);
    const restored=core.addOutfitToTrip(before,'o1');
    assert.equal(restored.trips[0].items.find(i=>i.wardrobeId==='g1').status,'pending');
    assert.equal(restored.trips[0].items.find(i=>i.wardrobeId==='g2').status,status);
    assert.equal(restored.trips[0].items.filter(i=>i.wardrobeId==='g1').length,1);
    assert.equal(before.trips[0].items.find(i=>i.wardrobeId==='g1').status,'skip');
  }
});

test('导入允许有效历史快照，拒绝未知版本、坏引用、重复标识和危险照片', () => {
  const state=fixture();
  assert.equal(core.validateState(state),true);
  assert.equal(core.validateState(core.createInitialState()),true);
  const history=fixture();
  history.trips[0].items.push({id:'old',name:'已删除外套',category:'穿戴',slot:'jacket',qty:1,status:'packed',source:'wardrobe',wardrobeId:'deleted',fromOutfit:true});
  assert.equal(core.validateState(history),true);
  const mutations=[
    s=>{s.version=2;}, s=>{s.activeTripId='missing';}, s=>{s.trips[0].items[0].qty=NaN;},
    s=>{s.trips[0].items[0].qty=100;}, s=>{s.trips[0].items[0].status='done';},
    s=>{s.wardrobe[0].id='';}, s=>{s.wardrobe[1].id='g1';},
    s=>{s.outfits[0].garmentIds=['missing'];}, s=>{s.outfits[0].garmentIds=['g1','g1'];},
    s=>{s.wardrobe[0].photo='javascript:alert(1)';},
    s=>{s.wardrobe[0].photo='data:image/svg+xml;base64,PHN2Zz4=';},
    s=>{s.wardrobe[0].photo='data:image/png;base64,'+'A'.repeat(1500001);},
    s=>{s.trips[0].items[0].name='x'.repeat(121);},
    s=>{s.trips.push({...structuredClone(s.trips[0]),id:'t2'});},
    s=>{s.wardrobe[0].category='invalid';}, s=>{s.wardrobe[0].color='invalid';},
    s=>{Object.defineProperty(s,'__proto__',{value:{polluted:true},enumerable:true});},
  ];
  for (const mutate of mutations) {
    const bad=fixture(); mutate(bad);
    assert.equal(core.validateState(bad),false,mutate.toString());
  }
  assert.equal(core.validateState(null),false);
  assert.equal(core.validateState([]),false);
});

test('日滑默认包含补给与收纳，相机仅显式选择时加入且装包和检查分开', () => {
  const plain=core.createTrip({sport:'snowboard'});
  for (const name of ['能量胶','能量棒／零食','水壶／保温杯','装备收纳袋']) assert.ok(plain.items.some(i=>i.name===name),name);
  assert.ok(!plain.items.some(i=>i.name==='Insta360 相机'));
  const camera=core.createTrip({sport:'ski',camera:true});
  assert.ok(camera.items.some(i=>i.name==='Insta360 相机' && i.category==='拍摄'));
  assert.ok(camera.items.some(i=>i.name==='相机试录与回放' && i.category==='出发检查'));
  assert.ok(!camera.items.some(i=>i.name==='单板雪鞋'));
  assert.ok(!camera.items.some(i=>i.name==='备用相机电池'));
  assert.ok(camera.items.every(i=>i.status==='pending'));
  assert.ok(core.validateState({version:1,trips:[camera],activeTripId:camera.id,wardrobe:[],outfits:[],customTemplates:[]}));
});

test('装备库按板型筛选，日滑仍可查到过夜项且加载不改变旧行程', () => {
  assert.equal(typeof core.getCatalogItems,'function');
  const state=fixture(), before=structuredClone(state);
  state.trips[0].sport='snowboard'; before.trips[0].sport='snowboard';
  const entries=core.getCatalogItems(state.trips[0]);
  assert.ok(entries.some(i=>i.name==='单板雪鞋'));
  assert.ok(!entries.some(i=>i.name==='双板雪鞋' || i.name==='雪杖'));
  assert.ok(entries.some(i=>i.name==='洗漱用品'));
  assert.ok(entries.some(i=>i.name==='Insta360 相机'));
  assert.deepEqual(state,before);
});

test('旧行程可补给和拍摄追加，重复勾选不重复并保留状态数量与历史', () => {
  assert.equal(typeof core.addCatalogItems,'function');
  const state=fixture();
  state.trips[0].items.push({id:'gel',name:'能量胶',category:'自定义',qty:4,status:'skip',source:'custom'});
  state.trips[0].items[1].qty=3;
  state.trips.push({id:'history',name:'上次',sport:'both',overnight:false,createdAt:'2026-11-01T00:00:00.000Z',items:[{id:'old-camera',name:'旧相机',category:'随身',qty:2,status:'packed',source:'custom'}]});
  const before=structuredClone(state);
  const entries=core.getCatalogItems(state.trips[0]);
  const keys=['能量胶','Insta360 相机','雪裤'].map(name=>entries.find(i=>i.name===name).key);
  const added=core.addCatalogItems(state,[...keys,keys[1],'unknown-key']);
  assert.equal(added.trips[0].items.length,4);
  assert.deepEqual(added.trips[0].items.slice(0,2),before.trips[0].items.slice(0,2));
  assert.deepEqual(added.trips[0].items[2],{...before.trips[0].items[2],status:'pending'});
  assert.deepEqual(added.trips[1],before.trips[1]);
  assert.equal(added.trips[0].items.at(-1).status,'pending');
  assert.equal(added.trips[0].items.at(-1).templateKey,keys[1]);
  assert.equal(added.customTemplates.length,0);
  assert.deepEqual(core.addCatalogItems(added,keys),added);
  assert.deepEqual(state,before);
  assert.equal(core.validateState(added),true);
});

test('库检测同时识别旧同名自定义和有稳定键的重命名项目，包括本次不带', () => {
  assert.equal(typeof core.catalogItemInTrip,'function');
  const trip=fixture().trips[0];
  const entry=core.getCatalogItems(trip).find(i=>i.name==='雪服外套');
  assert.equal(core.catalogItemInTrip(trip,entry),true);
  trip.items[0]={...trip.items[0],name:'我的外套',templateKey:entry.key,status:'skip'};
  assert.equal(core.catalogItemInTrip(trip,entry),true);
  delete trip.items[0].templateKey;
  assert.equal(core.catalogItemInTrip(trip,entry),false);
  trip.items[0]={...trip.items[0],name:' 雪服外套 ',source:'custom'};
  assert.equal(core.catalogItemInTrip(trip,entry),true);
});

test('记住库项仅存一次，新行程不与基础或同名自定义重复且重新待装', () => {
  assert.equal(typeof core.addCatalogItems,'function');
  const state=fixture();
  const entries=core.getCatalogItems(state.trips[0]);
  const keys=['能量胶','Insta360 相机'].map(name=>entries.find(i=>i.name===name).key);
  const remembered=core.addCatalogItems(state,keys,{remember:true});
  assert.equal(remembered.customTemplates.length,2);
  const twice=core.addCatalogItems(remembered,keys,{remember:true});
  assert.deepEqual(twice,remembered);
  const templates=[...twice.customTemplates,{id:'another-template',name:'Insta360 相机',category:'拍摄',qty:3,status:'packed',source:'custom'}];
  const next=core.createTrip({sport:'snowboard',camera:true},templates);
  assert.equal(next.items.filter(i=>i.name==='能量胶').length,1);
  assert.equal(next.items.filter(i=>i.name==='Insta360 相机').length,1);
  assert.ok(next.items.every(i=>i.status==='pending'));
  assert.ok(core.validateState(twice));
});

test('记住的板型专用库项不会跨板型出现，库元数据不进入备份项目', () => {
  assert.equal(typeof core.addCatalogItems,'function');
  const state=fixture();
  const entries=core.getCatalogItems(state.trips[0]);
  const board=entries.find(i=>i.name==='单板雪鞋');
  const changed=core.addCatalogItems(state,[board.key],{remember:true});
  const next=core.createTrip({sport:'ski'},changed.customTemplates);
  assert.ok(!next.items.some(i=>i.name==='单板雪鞋'));
  for (const item of [...changed.trips[0].items,...changed.customTemplates]) {
    for (const field of ['key','group','note','default','overnight','cameraDefault']) assert.equal(Object.hasOwn(item,field),false,field);
  }
});

test('备份兼容无库键旧记录与未来库键，拒绝异常库键和衣橱键混用', () => {
  const old=fixture();
  assert.equal(core.validateState(old),true);
  const future=fixture(); future.trips[0].items[0].templateKey='future-resort-item-v2';
  assert.equal(core.validateState(future),true);
  for (const key of ['', 'x'.repeat(65), ' has-spaces', '<script>', null, 3, '__proto__']) {
    const bad=fixture(); bad.trips[0].items[0].templateKey=key;
    assert.equal(core.validateState(bad),false,JSON.stringify(key));
  }
  const wardrobe=core.addOutfitToTrip(fixture(),'o1');
  wardrobe.trips[0].items.find(i=>i.source==='wardrobe').templateKey='jacket';
  assert.equal(core.validateState(wardrobe),false);
});

test('按需防护与保养配件可独立加入，不随拍摄包自动加入', () => {
  const trip=core.createTrip({sport:'snowboard',camera:true});
  const state={version:1,trips:[trip],activeTripId:trip.id,wardrobe:[],outfits:[],customTemplates:[]};
  const names=['相机防丢绳','适配镜头保护镜','太阳镜','对讲机','滑雪蜡／保养用品'];
  assert.ok(names.every(name=>!trip.items.some(item=>item.name===name)));
  const catalog=core.getCatalogItems(trip);
  const keys=names.map(name=>{
    const entry=catalog.find(item=>item.name===name);
    assert.ok(entry,`${name} 可在装备库中找到`);
    return entry.key;
  });
  const added=core.addCatalogItems(state,keys);
  assert.ok(names.every(name=>added.trips[0].items.some(item=>item.name===name && item.status==='pending')));
});

test('全库可加入并有效往返备份，未选板型与未知键不能旁路加入', () => {
  const state=fixture();
  const catalog=core.getCatalogItems(state.trips[0]);
  const added=core.addCatalogItems(state,catalog.map(entry=>entry.key),{remember:true});
  assert.equal(core.validateState(JSON.parse(JSON.stringify(added))),true);
  assert.equal(new Set(added.trips[0].items.map(item=>item.name)).size,added.trips[0].items.length);
  assert.equal(new Set(catalog.map(entry=>entry.key)).size,catalog.length);
  assert.ok(catalog.every(entry=>core.GEAR_GROUPS.some(group=>group.id===entry.group)));
  const ski=core.createTrip({sport:'ski'});
  const skiState={version:1,trips:[ski],activeTripId:ski.id,wardrobe:[],outfits:[],customTemplates:[]};
  const snowboardKey=catalog.find(entry=>entry.name==='单板雪鞋').key;
  assert.equal(core.addCatalogItems(skiState,[snowboardKey,'missing'],{remember:true}),skiState);
});

test('新行程同名或同键默认项保留首个已记住数量，后续重复模板不能覆盖', () => {
  const templates=[
    {id:'gel-first',name:'能量胶',category:'补给',qty:5,status:'packed',source:'custom'},
    {id:'gel-duplicate',name:'我的能量胶',category:'补给',templateKey:'energy-gel',qty:9,status:'skip',source:'template'},
    {id:'battery-first',name:'我的相机电池',category:'拍摄',templateKey:'camera-battery',qty:2,status:'packed',source:'template'},
    {id:'battery-duplicate',name:'相机电池',category:'拍摄',qty:8,status:'packed',source:'custom'},
    {id:'gift-first',name:'礼物',category:'随身',qty:3,status:'packed',source:'custom'},
    {id:'gift-duplicate',name:'礼物',category:'随身',qty:7,status:'packed',source:'custom'},
  ];
  const before=structuredClone(templates);
  const trip=core.createTrip({sport:'snowboard',camera:true},templates);
  assert.deepEqual(trip.items.filter(i=>i.templateKey==='energy-gel').map(i=>[i.name,i.qty,i.status]),[['能量胶',5,'pending']]);
  assert.deepEqual(trip.items.filter(i=>i.templateKey==='camera-battery').map(i=>[i.name,i.qty,i.status]),[['相机电池',2,'pending']]);
  assert.deepEqual(trip.items.filter(i=>i.name==='礼物').map(i=>[i.qty,i.status]),[[3,'pending']]);
  assert.deepEqual(templates,before);
  assert.equal(core.validateState({version:1,trips:[trip],activeTripId:trip.id,wardrobe:[],outfits:[],customTemplates:templates}),true);
});
