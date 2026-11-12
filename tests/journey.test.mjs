import test from 'node:test';
import assert from 'node:assert/strict';
import {getTripReadiness} from '../docs/journey.mjs';

const item=(id,status,category='穿戴',qty=1)=>({id,name:id,category,qty,status,source:'template'});

test('装包进度只统计实物项目，数量与出发检查不计入装包总数',()=>{
  const trip={items:[
    item('socks','pending','穿戴',6),
    item('jacket','wearing'),
    item('goggles','packed'),
    item('skis','rental','滑行装备'),
    item('camera-test','pending','出发检查'),
    item('booking','packed','出发检查'),
  ]};
  const result=getTripReadiness(trip);
  assert.deepEqual(result.gear,{total:4,ready:2,pending:1,rental:1,skipped:0});
  assert.deepEqual(result.checks,{total:2,ready:1,pending:1,skipped:0});
  assert.deepEqual(result.pendingGear.map(i=>i.id),['socks']);
  assert.deepEqual(result.rentals.map(i=>i.id),['skis']);
  assert.deepEqual(result.checksToDo.map(i=>i.id),['camera-test']);
});

test('跳过的实物和检查分别披露，不进入总数或待办列表',()=>{
  const result=getTripReadiness({items:[
    item('spare-gloves','skip'),
    item('record-test','skip','出发检查'),
  ]});
  assert.deepEqual(result.gear,{total:0,ready:0,pending:0,rental:0,skipped:1});
  assert.deepEqual(result.checks,{total:0,ready:0,pending:0,skipped:1});
  assert.deepEqual(result.pendingGear,[]);
  assert.deepEqual(result.rentals,[]);
  assert.deepEqual(result.checksToDo,[]);
});

test('旧备份中的租借状态检查仍待确认，穿身上状态检查沿用已确认口径',()=>{
  const result=getTripReadiness({items:[
    item('battery','rental','出发检查'),
    item('space','wearing','出发检查'),
    item('playback','packed','出发检查'),
    item('weather','pending','出发检查'),
  ]});
  assert.deepEqual(result.gear,{total:0,ready:0,pending:0,rental:0,skipped:0});
  assert.deepEqual(result.checks,{total:4,ready:2,pending:2,skipped:0});
  assert.deepEqual(result.rentals,[]);
  assert.deepEqual(result.checksToDo.map(i=>i.id),['battery','weather']);
});

test('分类保留原始顺序与项目，不修改被冻结的行程',()=>{
  const trip={items:[
    item('phone','pending','随身'),
    item('ticket','pending','随身'),
    item('boots','rental','滑行装备'),
    item('poles','rental','滑行装备'),
    item('power','pending','出发检查'),
    item('travel','pending','出发检查'),
  ]};
  const before=structuredClone(trip);
  trip.items.forEach(Object.freeze);
  Object.freeze(trip.items);
  Object.freeze(trip);
  const result=getTripReadiness(trip);
  assert.deepEqual(result.pendingGear.map(i=>i.id),['phone','ticket']);
  assert.deepEqual(result.rentals.map(i=>i.id),['boots','poles']);
  assert.deepEqual(result.checksToDo.map(i=>i.id),['power','travel']);
  assert.deepEqual(result.pendingGear[0],before.items[0]);
  assert.deepEqual(trip,before);
});

test('空行程返回独立的零进度和空待办',()=>{
  assert.deepEqual(getTripReadiness({items:[]}),{
    gear:{total:0,ready:0,pending:0,rental:0,skipped:0},
    checks:{total:0,ready:0,pending:0,skipped:0},
    pendingGear:[],rentals:[],checksToDo:[],
  });
});
