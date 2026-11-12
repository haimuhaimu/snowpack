import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../docs/core.mjs';

const copy=value=>structuredClone(value);
const garment=(id,category)=>({id,name:id,category,color:'black'});
const generic=(id,slot,status='pending')=>({id,name:id,category:'穿戴',slot,status,qty:1,source:'template'});
const owned=(id,wardrobeId,status)=>({id,name:id,category:'穿戴',wardrobeId,status,qty:2,source:'wardrobe',packingLocation:'luggage'});
const fixture=()=>({version:1,activeTripId:'trip',trips:[{id:'trip',name:'本次',sport:'both',overnight:false,createdAt:'2026-11-13T00:00:00.000Z',items:[generic('generic-jacket','jacket'),generic('packed-pants','pants','packed'),generic('rental-helmet','helmet','rental')]}],wardrobe:[garment('jacket','jacket'),garment('pants','pants'),garment('helmet','helmet'),garment('skis','skis')],outfits:[],customTemplates:[]});
function add(state,ids){assert.equal(typeof core.addGarmentsToTrip,'function');return core.addGarmentsToTrip(state,ids);}

test('单品直接加入当前行程，去重未知 ID 并替代未装通用品，不创建搭配',()=>{
 const state=fixture(),before=copy(state);
 const result=add(state,['jacket','jacket','missing','helmet','pants','skis']);
 assert.deepEqual(state,before);
 assert.equal(result.trips[0].items.find(i=>i.id==='generic-jacket').status,'skip');
 assert.equal(result.trips[0].items.find(i=>i.id==='rental-helmet').status,'skip');
 assert.equal(result.trips[0].items.find(i=>i.id==='packed-pants').status,'packed');
 assert.deepEqual(result.trips[0].items.filter(i=>i.source==='wardrobe').map(i=>[i.wardrobeId,i.status,i.qty,i.category]),[
  ['jacket','pending',1,'穿戴'],['helmet','pending',1,'穿戴'],['pants','pending',1,'穿戴'],['skis','pending',1,'滑行装备']]);
 assert.ok(result.trips[0].items.filter(i=>i.source==='wardrobe').every(i=>!Object.hasOwn(i,'fromOutfit')));
 assert.equal(result.outfits,state.outfits);assert.deepEqual(result.outfits,[]);assert.equal(result.wardrobe,state.wardrobe);
 assert.equal(core.validateState(result),true);
 assert.equal(add(result,['jacket','helmet','pants','skis']),result);
});

test('重新选中已跳过实物恢复待装，保留已装、穿身上、租借及数量位置',()=>{
 const state=fixture();state.trips[0].items=[owned('j','jacket','skip'),owned('p','pants','packed'),owned('h','helmet','wearing'),owned('s','skis','rental')];
 const result=add(state,['jacket','pants','helmet','skis']);
 assert.deepEqual(result.trips[0].items.map(i=>[i.status,i.qty,i.packingLocation]),[['pending',2,'luggage'],['packed',2,'luggage'],['wearing',2,'luggage'],['rental',2,'luggage']]);
 assert.equal(state.trips[0].items[0].status,'skip');assert.equal(result.trips[0].items[1],state.trips[0].items[1]);
 assert.equal(add(result,['jacket','pants','helmet','skis']),result);
});

test('空选择、非数组或全是未知 ID 不更改任何项目，只修改当前行程',()=>{
 const state=fixture();
 for(const ids of [[],null,undefined,'jacket',['missing',null,2]])assert.equal(add(state,ids),state);
 const other={...copy(state.trips[0]),id:'other',items:[generic('other-jacket','jacket')]};state.trips.push(other);
 assert.equal(add(state,['jacket']).trips[1],other);
 assert.equal(add({...state,activeTripId:'missing'},['jacket']).activeTripId,'missing');
});

test('容量按唯一新增实物计算，不够时整次选择不修改，满额仍可恢复已有实物',()=>{
 const state=fixture();state.trips[0].items=Array.from({length:599},(_,i)=>({id:`item-${i}`,name:`物品${i}`,category:'随身',qty:1,status:'pending',source:'custom'}));
 state.trips[0].items[0]=generic('generic-jacket','jacket');
 assert.equal(add(state,['jacket','pants']),state);
 assert.equal(state.trips[0].items[0].status,'pending');
 const full=add(state,['jacket','jacket','missing']);assert.equal(full.trips[0].items.length,600);
 assert.equal(core.validateState(full),true);assert.equal(add(full,['pants']),full);
 const selected=full.trips[0].items.find(i=>i.wardrobeId==='jacket');selected.status='skip';
 const restored=add(full,['jacket']);assert.equal(restored.trips[0].items.length,600);assert.equal(restored.trips[0].items.at(-1).status,'pending');
});

test('直接选装不受搭配的 30 件上限限制，搭配入口共享规则并保留来源标记',()=>{
 const state=fixture();state.wardrobe=Array.from({length:31},(_,i)=>garment(`gear-${i}`,'accessory'));
 const direct=add(state,state.wardrobe.map(g=>g.id));assert.equal(direct.trips[0].items.filter(i=>i.source==='wardrobe').length,31);assert.deepEqual(direct.outfits,[]);
 const outfitState=fixture();outfitState.outfits=[{id:'outfit',name:'这套',garmentIds:['jacket','helmet']}];
 const fromOutfit=core.addOutfitToTrip(outfitState,'outfit');
 assert.deepEqual(fromOutfit.trips[0].items.filter(i=>i.source==='wardrobe').map(i=>[i.wardrobeId,i.fromOutfit]),[['jacket',true],['helmet',true]]);
 assert.equal(core.addOutfitToTrip(fromOutfit,'outfit'),fromOutfit);
 const firstDirect=add(outfitState,['jacket']),thenOutfit=core.addOutfitToTrip(firstDirect,'outfit');
 assert.equal(Object.hasOwn(thenOutfit.trips[0].items.find(i=>i.wardrobeId==='jacket'),'fromOutfit'),false);
 assert.equal(thenOutfit.trips[0].items.find(i=>i.wardrobeId==='helmet').fromOutfit,true);
});
