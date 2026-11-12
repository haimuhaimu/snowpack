import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../docs/core.mjs';

const fixture=()=>({version:1,activeTripId:'trip',trips:[{id:'trip',name:'周末',sport:'both',overnight:true,createdAt:'2026-11-12T00:00:00.000Z',items:[
  {id:'packed',name:'能量胶',category:'补给',templateKey:'energy-gel',qty:4,status:'packed',source:'template'},
  {id:'wearing',name:'白外套',category:'穿戴',slot:'jacket',wardrobeId:'jacket',fromOutfit:true,qty:1,status:'wearing',source:'wardrobe'},
  {id:'rental',name:'雪杖',category:'滑行装备',templateKey:'ski-poles',modes:['ski'],qty:1,status:'rental',source:'template'},
  {id:'skip',name:'纸巾',category:'随身',qty:1,status:'skip',source:'custom'},
  {id:'check',name:'相机试录与回放',category:'出发检查',templateKey:'camera-record-check',qty:1,status:'packed',source:'template'},
]}],wardrobe:[{id:'jacket',name:'白外套',category:'jacket',color:'white'},{id:'pants',name:'黑裤',category:'pants',color:'black'},{id:'camera',name:'相机',category:'camera',color:'black'}],outfits:[],customTemplates:[]});
const piece=(id,garmentId,z)=>({id,garmentId,x:310+z*250,y:280+z*70,scale:[0.8,1,1.2][z],rotation:-17+z*22,z});
const withBoard=()=>({...fixture(),board:{background:'dark',pieces:[piece('p-jacket','jacket',0),piece('p-camera','camera',1),piece('p-pants','pants',2)]}});

test('复用当前行程保留数量配置和实物选择，为全部项目换身份并重新确认实装与检查',()=>{
  assert.equal(typeof core.duplicateTrip,'function');
  const state=fixture();
  state.trips.push({...state.trips[0],id:'other-trip',items:[]});
  const before=structuredClone(state), changed=core.duplicateTrip(state,{name:'下周'}), trip=core.getActiveTrip(changed);
  assert.equal(changed.trips.length,3);
  assert.equal(trip.name,'下周');
  assert.equal(trip.sport,'both');
  assert.equal(trip.overnight,true);
  assert.deepEqual(trip.items.map(i=>[i.name,i.qty,i.status]),[['能量胶',4,'pending'],['白外套',1,'pending'],['雪杖',1,'rental'],['纸巾',1,'skip'],['相机试录与回放',1,'pending']]);
  assert.equal(trip.items[1].wardrobeId,'jacket');
  assert.equal(trip.items[1].fromOutfit,true);
  assert.deepEqual(trip.items[2].modes,['ski']);
  assert.ok(trip.items.every(item=>!before.trips[0].items.some(old=>old.id===item.id)));
  assert.deepEqual(changed.trips.slice(0,2),before.trips);
  assert.deepEqual(state,before);
  assert.equal(core.validateState(changed),true);
  const reset=core.getActiveTrip(core.duplicateTrip(state,{keepSkipped:false,keepRental:false}));
  assert.ok(reset.items.every(i=>i.status==='pending'));
});

test('行程复用在100条上限停止且无当前行程时不修改数据',()=>{
  assert.equal(typeof core.duplicateTrip,'function');
  const state=fixture();
  state.trips=Array.from({length:100},(_,i)=>({...state.trips[0],id:`trip-${i}`,items:[]}));
  state.activeTripId='trip-0';
  assert.equal(core.duplicateTrip(state),state);
  assert.equal(core.validateState(state),true);
  state.activeTripId='missing';
  assert.equal(core.duplicateTrip(state),state);
});

test('修改数量可显式记住现有模板，新行程应用最新数量且本次装包需要重新确认',()=>{
  const state=fixture();
  state.customTemplates=[{id:'template',name:'旧名称',category:'补给',templateKey:'energy-gel',qty:2,status:'pending',source:'template'}];
  const before=structuredClone(state), remembered=core.updateItemQty(state,'packed',6,{remember:true});
  assert.equal(remembered.customTemplates[0].qty,6);
  assert.equal(remembered.customTemplates[0].id,'template');
  assert.equal(remembered.trips[0].items[0].status,'pending');
  assert.equal(core.isItemRemembered(remembered,'packed'),true);
  assert.equal(core.isItemRemembered(remembered,'missing'),false);
  assert.equal(core.createTrip({},remembered.customTemplates).items.find(i=>i.templateKey==='energy-gel').qty,6);
  const temporary=core.updateItemQty(remembered,'packed',7);
  assert.equal(temporary.customTemplates[0].qty,6);
  assert.deepEqual(state,before);
  assert.equal(core.validateState(remembered),true);
});

test('记住已有数量可创建模板，实物只修改本次数量而不创建通用模板',()=>{
  assert.equal(typeof core.isItemRemembered,'function');
  const state=fixture();
  assert.equal(core.isItemRemembered(state,'wearing'),false);
  const remembered=core.updateItemQty(state,'packed',4,{remember:true});
  assert.equal(remembered.customTemplates.length,1);
  assert.equal(remembered.customTemplates[0].qty,4);
  assert.equal(remembered.customTemplates[0].status,'pending');
  assert.equal(remembered.customTemplates[0].source,'template');
  assert.equal(Object.hasOwn(remembered.customTemplates[0],'wardrobeId'),false);
  assert.equal(core.isItemRemembered(remembered,'packed'),true);
  assert.equal(remembered.trips[0].items[0].status,'packed');
  const garment=core.updateItemQty(state,'wearing',2,{remember:true});
  assert.equal(garment.trips[0].items[1].qty,2);
  assert.equal(garment.trips[0].items[1].status,'pending');
  assert.deepEqual(garment.customTemplates,[]);
  assert.equal(core.validateState(remembered),true);
});

test('自定义同名再次添加合并数量并恢复跳过项，记住时更新唯一模板',()=>{
  const state=fixture();
  state.customTemplates=[{id:'template',name:'纸巾',category:'随身',qty:2,status:'pending',source:'custom'}];
  const changed=core.addCustomItem(state,{name:'  纸巾  ',category:'其他',qty:3},true);
  assert.equal(changed.trips[0].items.length,5);
  assert.deepEqual(changed.trips[0].items[3],{id:'skip',name:'纸巾',category:'随身',qty:3,status:'pending',source:'custom'});
  assert.equal(changed.customTemplates.length,1);
  assert.equal(changed.customTemplates[0].qty,3);
  const packed=core.addCustomItem(state,{name:'能量胶',qty:3},false);
  assert.equal(packed.trips[0].items[0].status,'packed');
  const more=core.addCustomItem(packed,{name:'能量胶',qty:5},false);
  assert.equal(more.trips[0].items[0].status,'pending');
  const english=core.addCustomItem(state,{name:'ＵＳＢ',qty:2},false);
  assert.equal(core.addCustomItem(english,{name:' usb ',qty:4},false).trips[0].items.length,6);
  assert.equal(core.validateState(changed),true);
});

test('显式重新选择装备库项目恢复跳过状态且记住当前数量，保留已装与检查历史',()=>{
  const state=fixture();
  state.trips[0].items[0].status='skip';
  const changed=core.addCatalogItems(state,['energy-gel','camera-record-check'],{remember:true});
  assert.equal(changed.trips[0].items[0].status,'pending');
  assert.equal(changed.trips[0].items[0].qty,4);
  assert.equal(changed.trips[0].items[4].status,'packed');
  assert.equal(changed.customTemplates.find(i=>i.templateKey==='energy-gel').qty,4);
  assert.equal(changed.trips[0].items.length,5);
  assert.equal(state.trips[0].items[0].status,'skip');
  assert.equal(core.validateState(changed),true);
});

test('保存搭配保留所选装备的完整布局且过滤画板其他装备，载入使用新贴纸身份',()=>{
  assert.equal(typeof core.saveBoardOutfit,'function');
  assert.equal(typeof core.loadOutfitBoard,'function');
  const state=withBoard(),before=structuredClone(state);
  const saved=core.saveBoardOutfit(state,{name:'白黑',garmentIds:['pants','jacket','missing','pants']});
  const outfit=saved.outfits[0];
  assert.deepEqual(outfit.garmentIds,['pants','jacket']);
  assert.equal(outfit.board.background,'dark');
  assert.deepEqual(outfit.board.pieces.map(({id,...p})=>p),[
    {garmentId:'jacket',x:310,y:280,scale:0.8,rotation:-17,z:0},
    {garmentId:'pants',x:810,y:420,scale:1.2,rotation:27,z:1},
  ]);
  assert.ok(outfit.board.pieces.every(p=>!state.board.pieces.some(old=>old.id===p.id)));
  const loaded=core.loadOutfitBoard({...saved,board:{background:'paper',pieces:[]}},outfit.id);
  assert.deepEqual(loaded.board.pieces.map(({id,...p})=>p),outfit.board.pieces.map(({id,...p})=>p));
  assert.equal(loaded.board.background,'dark');
  assert.ok(loaded.board.pieces.every(p=>!outfit.board.pieces.some(old=>old.id===p.id)));
  assert.deepEqual(loaded.trips,before.trips);
  assert.deepEqual(state,before);
  assert.equal(core.validateState(JSON.parse(JSON.stringify(loaded))),true);
});

test('保存搭配为不在画板的所选装备补齐布局，旧搭配也能载入有效画板',()=>{
  assert.equal(typeof core.saveBoardOutfit,'function');
  const state=fixture(),saved=core.saveBoardOutfit(state,{name:'白黑',garmentIds:['jacket','pants']});
  assert.equal(saved.outfits[0].board.pieces.length,2);
  assert.equal(core.validateState(saved),true);
  state.outfits=[{id:'legacy',name:'旧搭配',garmentIds:['jacket','pants']}];
  const loaded=core.loadOutfitBoard(state,'legacy');
  assert.deepEqual(new Set(loaded.board.pieces.map(p=>p.garmentId)),new Set(['jacket','pants']));
  assert.equal(new Set(loaded.board.pieces.map(p=>`${p.x},${p.y}`)).size,2);
  assert.equal(core.validateState(loaded),true);
  assert.equal(core.loadOutfitBoard(state,'missing'),state);
  assert.equal(core.saveBoardOutfit(state,{name:'空',garmentIds:['missing']}),state);
  const many=fixture();
  many.wardrobe=Array.from({length:31},(_,i)=>({id:`g-${i}`,name:`装备${i}`,category:'bag',color:'black'}));
  assert.equal(core.saveBoardOutfit(many,{name:'过多',garmentIds:many.wardrobe.map(g=>g.id)}),many);
});

test('可导入旧搭配和有效布局快照，拒绝快照坏引用、重复标识、越界和不完整选择',()=>{
  const state=withBoard();
  state.outfits=[{id:'snapshot',name:'白黑',garmentIds:['jacket','pants'],board:{background:'ice',pieces:[piece('s-jacket','jacket',0),piece('s-pants','pants',1)]}}];
  assert.equal(core.validateState(state),true);
  const mutations=[s=>{s.outfits[0].board.pieces[0].garmentId='camera';},s=>{s.outfits[0].board.pieces[0].x=-1;},s=>{s.outfits[0].board.pieces[0].id='p-jacket';},s=>{s.outfits[0].board.pieces[0].z=1;},s=>{s.outfits[0].board.pieces.pop();},s=>{s.outfits[0].board.width=1600;}];
  for(const mutate of mutations) {
    const bad=structuredClone(state);mutate(bad);
    assert.equal(core.validateState(bad),false,mutate.toString());
  }
});

test('删除装备也清理搭配布局并重排层级，但历史实物行程保持不变',()=>{
  const state=withBoard();
  state.outfits=[{id:'snapshot',name:'白黑',garmentIds:['jacket','pants'],board:{background:'ice',pieces:[piece('s-jacket','jacket',0),piece('s-pants','pants',1)]}}];
  const before=structuredClone(state),removed=core.removeGarment(state,'jacket');
  assert.deepEqual(removed.outfits[0].board.pieces.map(p=>[p.garmentId,p.z]),[['pants',0]]);
  assert.deepEqual(removed.outfits[0].garmentIds,['pants']);
  assert.deepEqual(removed.trips,before.trips);
  assert.equal(core.validateState(removed),true);
  assert.deepEqual(state,before);
});

test('明确单双板雪鞋与板杖类型替代旧库条目，模糊雪鞋不会错误替代两类',()=>{
  const state=fixture();
  state.trips[0].items=['snowboard','snowboard-boots','skis','ski-boots','ski-poles'].map((templateKey,i)=>({id:`generic-${i}`,templateKey,name:`旧名称${i}`,category:'滑行装备',qty:1,status:'pending',source:'template'}));
  state.wardrobe=['snowboard','snowboardBoots','skis','skiBoots','poles'].map((category,i)=>({id:`gear-${i}`,name:`我的装备${i}`,category,color:'black'}));
  state.outfits=[{id:'gear-outfit',name:'明确装备',garmentIds:state.wardrobe.map(g=>g.id)}];
  const added=core.addOutfitToTrip(state,'gear-outfit');
  assert.deepEqual(added.trips[0].items.slice(0,5).map(i=>i.status),['skip','skip','skip','skip','skip']);
  assert.ok(added.trips[0].items.slice(5).every(i=>i.category==='滑行装备'));
  assert.equal(core.validateState(added),true);
  assert.ok(core.BOARD_ITEM_SIZES.snowboardBoots && core.BOARD_ITEM_SIZES.skiBoots);
  const legacy=structuredClone(state);
  legacy.wardrobe=[{id:'legacy-boots',name:'我的雪鞋',category:'boots',color:'black'}];
  legacy.outfits=[{id:'legacy-look',name:'旧雪鞋',garmentIds:['legacy-boots']}];
  assert.deepEqual(core.addOutfitToTrip(legacy,'legacy-look').trips[0].items.slice(0,5).map(i=>i.status),['pending','pending','pending','pending','pending']);
  for(const status of ['packed','wearing']) {
    const history=structuredClone(state);history.trips[0].items[0].status=status;
    assert.equal(core.addOutfitToTrip(history,'gear-outfit').trips[0].items[0].status,status);
  }
});

test('新装备库项目显式携带板与雪鞋槽位，未来搭配不会生成重复待装项',()=>{
  const state=fixture(),trip=core.createTrip({sport:'both'});
  state.trips=[trip];state.activeTripId=trip.id;
  state.wardrobe=[{id:'my-boots',name:'我的单板鞋',category:'snowboardBoots',color:'black'}];
  state.outfits=[{id:'boots-look',name:'单板鞋',garmentIds:['my-boots']}];
  const added=core.addOutfitToTrip(state,'boots-look');
  assert.equal(added.trips[0].items.find(i=>i.templateKey==='snowboard-boots').status,'skip');
  assert.equal(added.trips[0].items.find(i=>i.templateKey==='ski-boots').status,'pending');
  assert.equal(added.trips[0].items.find(i=>i.templateKey==='snowboard-boots').slot,'snowboardBoots');
});

test('行程满600项时加入搭配不超限也不先隐藏通用品',()=>{
  const state=fixture();
  state.trips[0].items=Array.from({length:600},(_,i)=>({id:`full-${i}`,name:`物品${i}`,category:'自定义',qty:1,status:'pending',source:'custom'}));
  state.trips[0].items[0]={id:'generic',name:'雪服外套',category:'穿戴',slot:'jacket',qty:1,status:'pending',source:'template'};
  state.outfits=[{id:'outfit',name:'白外套',garmentIds:['jacket']}];
  assert.equal(core.validateState(state),true);
  assert.equal(core.addOutfitToTrip(state,'outfit'),state);
});
