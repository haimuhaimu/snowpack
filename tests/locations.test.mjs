import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../docs/core.mjs';

const fixture=()=>({
  version:1,activeTripId:'current',
  wardrobe:[{id:'jacket-photo',name:'我的外套',category:'jacket',color:'black',photo:'data:image/png;base64,AA=='}],
  outfits:[{id:'outfit',name:'这一套',garmentIds:['jacket-photo']}],
  customTemplates:[{id:'remembered',name:'常备纸巾',category:'随身',qty:2,status:'pending',source:'custom'}],
  trips:[
    {id:'current',name:'本周',sport:'ski',overnight:false,createdAt:'2026-11-12T00:00:00.000Z',items:[
      {id:'gel',templateKey:'energy-gel',name:'能量胶',category:'补给',qty:2,status:'packed',source:'template'},
      {id:'jacket',name:'我的外套',category:'穿戴',qty:1,status:'wearing',source:'wardrobe',wardrobeId:'jacket-photo'},
      {id:'check',templateKey:'camera-record-check',name:'相机试录与回放',category:'出发检查',qty:1,status:'pending',source:'template'},
    ]},
    {id:'previous',name:'上周',sport:'both',overnight:true,createdAt:'2026-11-05T00:00:00.000Z',items:[
      {id:'previous-gel',templateKey:'energy-gel',name:'能量胶',category:'补给',qty:4,status:'packed',source:'template'},
    ]},
  ],
});

test('没有装包位置的 v5 备份继续有效，读取与新行程不补写位置',()=>{
  const state=fixture(),before=structuredClone(state);
  assert.equal(core.validateState(state),true);
  assert.equal(core.validateState(JSON.parse(JSON.stringify(state))),true);
  assert.deepEqual(state,before);
  assert.ok(core.createTrip().items.every(item=>!Object.hasOwn(item,'packingLocation')));
});

test('所有受支持的位置可显式指定，位置映射不可修改',()=>{
  assert.equal(typeof core.updateItemLocation,'function');
  assert.ok(Object.isFrozen(core.PACKING_LOCATIONS));
  for(const location of ['boardBag','bootBag','luggage','backpack','pocket','wetBag']) {
    const next=core.updateItemLocation(fixture(),'gel',location);
    assert.equal(core.getActiveTrip(next).items[0].packingLocation,location);
    assert.equal(core.validateState(next),true);
  }
});

test('改位置只改变当前项目，不改变已备状态数量实物照片模板或历史行程',()=>{
  assert.equal(typeof core.updateItemLocation,'function');
  const state=fixture(),before=structuredClone(state);
  const next=core.updateItemLocation(state,'gel','backpack');
  assert.deepEqual(core.getActiveTrip(next).items[0],{...before.trips[0].items[0],packingLocation:'backpack'});
  assert.deepEqual(core.getActiveTrip(next).items.slice(1),before.trips[0].items.slice(1));
  assert.deepEqual(next.trips[1],before.trips[1]);
  assert.deepEqual(next.wardrobe,before.wardrobe);
  assert.deepEqual(next.outfits,before.outfits);
  assert.deepEqual(next.customTemplates,before.customTemplates);
  assert.deepEqual(state,before);
  const wearing=core.updateItemLocation(next,'jacket','luggage');
  assert.equal(core.getActiveTrip(wearing).items[1].status,'wearing');
  assert.equal(core.getActiveTrip(wearing).items[1].qty,1);
});

test('未分配移除可选字段，相同位置或已未分配不产生新状态',()=>{
  assert.equal(typeof core.updateItemLocation,'function');
  const state=fixture();
  assert.equal(core.updateItemLocation(state,'gel','unassigned'),state);
  const located=core.updateItemLocation(state,'gel','pocket');
  assert.equal(core.updateItemLocation(located,'gel','pocket'),located);
  const cleared=core.updateItemLocation(located,'gel','unassigned');
  assert.ok(!Object.hasOwn(core.getActiveTrip(cleared).items[0],'packingLocation'));
  assert.deepEqual(cleared,state);
});

test('未知位置、检查项与非当前行程项目不可指定位置',()=>{
  assert.equal(typeof core.updateItemLocation,'function');
  const state=fixture();
  for(const location of ['drawer','__proto__','constructor','',null,undefined,123]) {
    assert.equal(core.updateItemLocation(state,'gel',location),state);
  }
  assert.equal(core.updateItemLocation(state,'check','backpack'),state);
  assert.equal(core.updateItemLocation(state,'missing','backpack'),state);
  assert.equal(core.updateItemLocation(state,'previous-gel','backpack'),state);
});

test('位置随行程复用并可往返备份，重新出发仍需核对',()=>{
  assert.equal(typeof core.updateItemLocation,'function');
  const located=core.updateItemLocation(fixture(),'gel','wetBag');
  const before=structuredClone(located);
  const duplicated=core.duplicateTrip(located,{name:'下次'});
  const trip=core.getActiveTrip(duplicated);
  assert.equal(trip.items[0].packingLocation,'wetBag');
  assert.equal(trip.items[0].status,'pending');
  assert.equal(trip.items[0].qty,2);
  assert.notEqual(trip.items[0].id,before.trips[0].items[0].id);
  const restored=JSON.parse(JSON.stringify(duplicated));
  assert.equal(core.validateState(restored),true);
  assert.equal(core.getActiveTrip(restored).items[0].packingLocation,'wetBag');
  assert.deepEqual(duplicated.trips.slice(0,2),before.trips);
  assert.deepEqual(located,before);
});

test('记住数量只保存数量，当前位置不进入常用模板或新建行程',()=>{
  assert.equal(typeof core.updateItemLocation,'function');
  const located=core.updateItemLocation(fixture(),'gel','backpack');
  const remembered=core.updateItemQty(located,'gel',4,{remember:true});
  assert.equal(core.getActiveTrip(remembered).items[0].packingLocation,'backpack');
  const template=remembered.customTemplates.find(entry=>entry.templateKey==='energy-gel');
  assert.equal(template.qty,4);
  assert.ok(!Object.hasOwn(template,'packingLocation'));
  const updated=core.updateItemQty(remembered,'gel',6,{remember:true});
  assert.equal(updated.customTemplates.find(entry=>entry.templateKey==='energy-gel').qty,6);
  assert.ok(updated.customTemplates.every(entry=>!Object.hasOwn(entry,'packingLocation')));
  const fresh=core.createTrip({},updated.customTemplates).items.find(entry=>entry.templateKey==='energy-gel');
  assert.equal(fresh.qty,6);
  assert.ok(!Object.hasOwn(fresh,'packingLocation'));
  assert.equal(core.validateState(updated),true);
});

test('备份拒绝未知位置、检查位置与常用模板中的位置字段',()=>{
  const good=fixture();
  good.trips[0].items[0].packingLocation='bootBag';
  assert.equal(core.validateState(good),true);
  for(const location of ['drawer','__proto__',null,123]) {
    const bad=structuredClone(good);
    bad.trips[0].items[0].packingLocation=location;
    assert.equal(core.validateState(bad),false);
  }
  const check=structuredClone(good);
  check.trips[0].items[2].packingLocation='backpack';
  assert.equal(core.validateState(check),false);
  for(const location of ['backpack','unassigned',undefined]) {
    const template=structuredClone(good);
    template.customTemplates[0].packingLocation=location;
    assert.equal(core.validateState(template),false);
  }
});
