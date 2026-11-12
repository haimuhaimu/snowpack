import test from 'node:test';
import assert from 'node:assert/strict';
import {GEAR_CATALOG,getActiveTrip,validateState} from '../docs/core.mjs';
import {SCENARIO_BUNDLES,getScenarioItems,applyScenarioItems} from '../docs/scenarios.mjs';

const item=(id,key,name,status,qty=1)=>({id,templateKey:key,name,category:'拍摄',qty,status,source:'template'});
const fixture=()=>({
  version:1,activeTripId:'current',wardrobe:[],outfits:[],
  customTemplates:[{id:'remembered',name:'常备纸巾',category:'随身',qty:2,status:'pending',source:'custom'}],
  trips:[
    {id:'current',name:'本周',sport:'ski',overnight:false,createdAt:'2026-11-12T00:00:00.000Z',items:[
      item('camera','insta360-camera','Insta360 相机','packed',2),
      item('cable','camera-cable','相机充电线','skip',4),
    ]},
    {id:'previous',name:'上周',sport:'both',overnight:true,createdAt:'2026-11-05T00:00:00.000Z',items:[
      item('previous-camera','insta360-camera','Insta360 相机','packed'),
    ]},
  ],
});

test('情景包是只读选择，返回真实且适用本次板型的装备库条目',()=>{
  assert.ok(SCENARIO_BUNDLES.length>0);
  assert.ok(Object.isFrozen(SCENARIO_BUNDLES));
  for(const bundle of SCENARIO_BUNDLES) {
    assert.ok(Object.isFrozen(bundle));
    assert.ok(Object.isFrozen(bundle.keys));
    assert.ok(bundle.title && bundle.description);
    assert.equal(new Set(bundle.keys).size,bundle.keys.length);
    for(const sport of ['snowboard','ski','both']) {
      const entries=getScenarioItems({sport},bundle.id);
      assert.ok(entries.length>0);
      for(const entry of entries) {
        assert.ok(bundle.keys.includes(entry.key));
        assert.equal(entry,GEAR_CATALOG.find(candidate=>candidate.key===entry.key));
        assert.ok(sport==='both' || !entry.modes || entry.modes.includes(sport));
      }
    }
  }
  const camera=getScenarioItems({sport:'ski'},'camera');
  assert.ok(camera.some(entry=>entry.key==='camera-cable'));
  assert.ok(camera.some(entry=>entry.key==='camera-record-check' && entry.category==='出发检查'));
});

test('仅查看情景或未显式勾选时不改变行程，未知情景也不添加装备',()=>{
  const state=fixture(),before=structuredClone(state);
  getScenarioItems(getActiveTrip(state),'camera');
  assert.equal(applyScenarioItems(state,'camera'),state);
  assert.equal(applyScenarioItems(state,'camera',[]),state);
  assert.equal(applyScenarioItems(state,'camera',null),state);
  assert.deepEqual(getScenarioItems(getActiveTrip(state),'missing'),[]);
  assert.equal(applyScenarioItems(state,'missing',['camera-card']),state);
  assert.deepEqual(state,before);
});

test('只加入当前包中显式选择的项目，保留数量已装状态历史行程和常用模板',()=>{
  const state=fixture(),before=structuredClone(state);
  const next=applyScenarioItems(state,'camera',[
    'insta360-camera','camera-cable','camera-card','underwear','snowboard','unknown',
  ]);
  const trip=getActiveTrip(next);
  assert.deepEqual(trip.items.map(entry=>entry.templateKey),['insta360-camera','camera-cable','camera-card']);
  assert.equal(trip.items[0].qty,2);
  assert.equal(trip.items[0].status,'packed');
  assert.equal(trip.items[1].qty,4);
  assert.equal(trip.items[1].status,'pending');
  assert.equal(trip.items[2].status,'pending');
  assert.deepEqual(next.trips[1],before.trips[1]);
  assert.deepEqual(next.customTemplates,before.customTemplates);
  assert.deepEqual(state,before);
  assert.equal(validateState(next),true);
});

test('重复选择不重复新增，同名旧项目恢复时保留原数量',()=>{
  const state=fixture();
  state.trips[0].items.push({id:'legacy-card',name:'相机存储卡',category:'拍摄',qty:3,status:'skip',source:'custom'});
  const first=applyScenarioItems(state,'camera',['camera-card','camera-card']);
  const trip=getActiveTrip(first);
  assert.equal(trip.items.length,3);
  assert.equal(trip.items[2].id,'legacy-card');
  assert.equal(trip.items[2].qty,3);
  assert.equal(trip.items[2].status,'pending');
  assert.equal(applyScenarioItems(first,'camera',['camera-card']),first);
  assert.equal(validateState(first),true);
});

test('行程容量不足只补入可容纳的项目，满额仍可恢复已有跳过项',()=>{
  const state=fixture();
  state.trips[0].items=Array.from({length:599},(_,index)=>({
    id:`full-${index}`,name:`已有物品 ${index}`,category:'自定义',qty:1,status:'pending',source:'custom',
  }));
  const next=applyScenarioItems(state,'camera',['camera-card','camera-cable']);
  assert.equal(getActiveTrip(next).items.length,600);
  assert.equal(validateState(next),true);
  const added=getActiveTrip(next).items.at(-1);
  assert.ok(['camera-card','camera-cable'].includes(added.templateKey));
  assert.equal(applyScenarioItems(next,'transit',['board-bag','boot-bag']),next);
  added.status='skip';
  const restored=applyScenarioItems(next,'camera',[added.templateKey]);
  assert.equal(getActiveTrip(restored).items.length,600);
  assert.equal(getActiveTrip(restored).items.at(-1).status,'pending');
  assert.equal(getActiveTrip(next).items.at(-1).status,'skip');
});
