import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,validateState} from '../docs/core.mjs';
const stateWith=photos=>({...createInitialState(),wardrobe:photos.map((photo,i)=>({id:`photo-${i}`,name:'装备',category:'jacket',color:'black',photo}))});

test('重复保存相同照片复用成功校验，仍运行真实正则校验新照片',t=>{
 const photo='data:image/jpeg;base64,'+'B'.repeat(600000),state=stateWith([photo]);
 const original=RegExp.prototype.test;let scans=0;
 t.mock.method(RegExp.prototype,'test',function(value){if(value===photo)scans++;return original.call(this,value);});
 for(let i=0;i<5;i++)assert.equal(validateState(state),true);
 assert.equal(scans,1);
});

test('缓存命中仍拒绝 JPEG 抠图、缺少原图、坏字符、额外字段和总容量超限',()=>{
 const jpeg='data:image/jpeg;base64,YQ==',png='data:image/png;base64,Yg==';
 const state=stateWith([jpeg]);state.wardrobe[0].cutout=png;assert.equal(validateState(state),true);
 for(const mutate of [g=>{g.cutout=jpeg;},g=>{g.photo='';},g=>{delete g.photo;},g=>{g.photo=png+'!';},g=>{g.color='invalid';},g=>{g.extra=true;}]){
  const changed=structuredClone(state);mutate(changed.wardrobe[0]);assert.equal(validateState(changed),false);
 }
 const large='data:image/png;base64,'+'C'.repeat(1400000);
 assert.equal(validateState(stateWith([large])),true);
 assert.equal(validateState(stateWith(Array(6).fill(large))),false);
});

test('照片缓存受容量约束，旧照片被逐出后重新执行校验',t=>{
 const photos=Array.from({length:7},(_,i)=>'data:image/jpeg;base64,'+String.fromCharCode(68+i).repeat(1200000));
 const original=RegExp.prototype.test;let firstScans=0;
 t.mock.method(RegExp.prototype,'test',function(value){if(value===photos[0])firstScans++;return original.call(this,value);});
 for(const photo of photos)assert.equal(validateState(stateWith([photo])),true);
 assert.equal(validateState(stateWith([photos[0]])),true);
 assert.equal(firstScans,2);
});
