import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../docs/core.mjs';

const photo='data:image/jpeg;base64,YQ==';
const cutout='data:image/png;base64,Yg==';
const fixture=()=>({version:1,activeTripId:'trip',trips:[{id:'trip',name:'本次',sport:'both',overnight:false,createdAt:'2026-11-12T00:00:00.000Z',items:[]}],
  wardrobe:[{id:'jacket',name:'白外套',category:'jacket',color:'white',photo},{id:'pants',name:'黑雪裤',category:'pants',color:'black',photo},
    {id:'camera',name:'我的相机',category:'camera',color:'black',photo}],
  outfits:[{id:'look',name:'白黑',garmentIds:['jacket','pants']},{id:'single',name:'单件',garmentIds:['jacket']}],customTemplates:[]});
const piece=(id,garmentId,z)=>({id,garmentId,x:800,y:550,scale:1,rotation:0,z});
const withBoard=()=>({...fixture(),board:{background:'paper',pieces:[piece('p-jacket','jacket',0),piece('p-pants','pants',1),piece('p-camera','camera',2)]}});

test('读取旧存档得到空画板，不补写存档或自动把衣橱上墙',()=>{
  assert.equal(typeof core.getBoard,'function');
  const state=fixture(), before=structuredClone(state);
  assert.deepEqual(core.getBoard(state),{background:'paper',pieces:[]});
  assert.deepEqual(core.BOARD_SIZE,{width:1600,height:1100});
  assert.deepEqual(state,before);
  assert.equal(Object.hasOwn(state,'board'),false);
});

test('单件上墙只引用现存实物，重复加入幂等且不改变原图或其他数据',()=>{
  assert.equal(typeof core.addBoardPiece,'function');
  const state=fixture(), before=structuredClone(state);
  assert.equal(core.addBoardPiece(state,'missing'),state);
  const added=core.addBoardPiece(state,'camera');
  assert.equal(added.board.pieces.length,1);
  const placed=added.board.pieces[0];
  assert.equal(placed.garmentId,'camera');
  assert.ok(placed.id && placed.id!=='camera');
  assert.equal(placed.z,0);
  assert.equal(core.addBoardPiece(added,'camera'),added);
  assert.equal(core.validateState(added),true);
  assert.deepEqual(added.wardrobe,before.wardrobe);
  assert.deepEqual(added.trips,before.trips);
  assert.deepEqual(state,before);
});

test('全部上墙只补缺，保留已编辑贴纸的位置层级与背景',()=>{
  assert.equal(typeof core.addAllWardrobeToBoard,'function');
  const state={...fixture(),board:{background:'dark',pieces:[{...piece('existing','pants',0),x:213,y:674,scale:1.6,rotation:31}]}};
  const before=structuredClone(state);
  const added=core.addAllWardrobeToBoard(state);
  assert.equal(added.board.background,'dark');
  assert.deepEqual(added.board.pieces[0],before.board.pieces[0]);
  assert.equal(added.board.pieces.length,3);
  assert.deepEqual(new Set(added.board.pieces.map(p=>p.garmentId)),new Set(['jacket','pants','camera']));
  assert.equal(core.addAllWardrobeToBoard(added),added);
  assert.deepEqual(state,before);
  assert.equal(core.validateState(added),true);
});

test('拖动缩放旋转限制为画布内有效数值，不允许补丁改引用和层级',()=>{
  assert.equal(typeof core.updateBoardPiece,'function');
  const state=withBoard(), before=structuredClone(state);
  const moved=core.updateBoardPiece(state,'p-jacket',{x:-20,y:2000,scale:20,rotation:450,garmentId:'camera',z:99});
  assert.deepEqual(moved.board.pieces[0],{id:'p-jacket',garmentId:'jacket',x:0,y:1100,scale:3,rotation:90,z:0});
  const shrunk=core.updateBoardPiece(moved,'p-jacket',{scale:0.01});
  assert.equal(shrunk.board.pieces[0].scale,0.2);
  for (const value of [NaN,Infinity,-Infinity,'120',null,undefined]) {
    assert.equal(core.updateBoardPiece(shrunk,'p-jacket',{x:value,y:value,scale:value,rotation:value}),shrunk);
  }
  assert.equal(core.updateBoardPiece(state,'missing',{x:20}),state);
  assert.equal(core.updateBoardPiece(state,'p-jacket',null),state);
  assert.deepEqual(state,before);
  assert.deepEqual(moved.trips,state.trips);
  assert.equal(core.validateState(moved),true);
});

test('置前置后和移出画板整理层级，移出不删除实物或搭配',()=>{
  assert.equal(typeof core.reorderBoardPiece,'function');
  const state=withBoard();
  const front=core.reorderBoardPiece(state,'p-jacket','front');
  assert.deepEqual(front.board.pieces.map(p=>[p.id,p.z]),[['p-pants',0],['p-camera',1],['p-jacket',2]]);
  const back=core.reorderBoardPiece(front,'p-jacket','back');
  assert.deepEqual(back.board.pieces.map(p=>[p.id,p.z]),[['p-jacket',0],['p-pants',1],['p-camera',2]]);
  assert.equal(core.reorderBoardPiece(back,'p-jacket','back'),back);
  assert.equal(core.reorderBoardPiece(back,'p-jacket','invalid'),back);
  const removed=core.removeBoardPiece(front,'p-camera');
  assert.deepEqual(removed.board.pieces.map(p=>[p.id,p.z]),[['p-pants',0],['p-jacket',1]]);
  assert.deepEqual(removed.wardrobe,state.wardrobe);
  assert.deepEqual(removed.outfits,state.outfits);
  assert.equal(core.removeBoardPiece(removed,'missing'),removed);
  assert.equal(core.validateState(removed),true);
});

test('重新排版保持贴纸身份，只整理当前画板且二次整理结果稳定',()=>{
  assert.equal(typeof core.arrangeBoard,'function');
  const state=withBoard(), before=structuredClone(state);
  const arranged=core.arrangeBoard(state);
  assert.deepEqual(arranged.board.pieces.map(p=>[p.id,p.garmentId]),before.board.pieces.map(p=>[p.id,p.garmentId]));
  assert.ok(new Set(arranged.board.pieces.map(p=>`${p.x},${p.y}`)).size>1);
  assert.equal(core.validateState(arranged),true);
  assert.deepEqual(core.arrangeBoard(arranged),arranged);
  assert.deepEqual(arranged.wardrobe,state.wardrobe);
  assert.deepEqual(arranged.outfits,state.outfits);
  assert.deepEqual(arranged.trips,state.trips);
  assert.deepEqual(state,before);
  const empty=fixture();
  assert.equal(core.arrangeBoard(empty),empty);
});

test('背景只接受已有选项，更换背景不改贴纸和其他状态',()=>{
  assert.equal(typeof core.setBoardBackground,'function');
  const state=withBoard();
  const changed=core.setBoardBackground(state,'ice');
  assert.equal(changed.board.background,'ice');
  assert.deepEqual(changed.board.pieces,state.board.pieces);
  assert.equal(core.setBoardBackground(changed,'ice'),changed);
  assert.equal(core.setBoardBackground(changed,'unknown'),changed);
  const old=fixture();
  assert.deepEqual(core.setBoardBackground(old,'dark').board,{background:'dark',pieces:[]});
});

test('删除实物同步清理画板和搭配引用，保留已装包的行程快照',()=>{
  assert.equal(typeof core.removeGarment,'function');
  const state=withBoard();
  state.trips[0].items.push({id:'historical-item',name:'白外套',category:'穿戴',slot:'jacket',qty:2,status:'packed',source:'wardrobe',wardrobeId:'jacket',fromOutfit:true});
  const before=structuredClone(state);
  const removed=core.removeGarment(state,'jacket');
  assert.deepEqual(removed.wardrobe.map(g=>g.id),['pants','camera']);
  assert.deepEqual(removed.board.pieces.map(p=>[p.garmentId,p.z]),[['pants',0],['camera',1]]);
  assert.deepEqual(removed.outfits,[{id:'look',name:'白黑',garmentIds:['pants']}]);
  assert.deepEqual(removed.trips,before.trips);
  assert.equal(core.validateState(removed),true);
  assert.deepEqual(state,before);
  assert.equal(core.removeGarment(removed,'missing'),removed);
  assert.equal(Object.hasOwn(core.removeGarment(fixture(),'jacket'),'board'),false);
});

test('所有装备类型可存衣橱，加入行程时进入对应清单分类',()=>{
  const state=fixture();
  state.wardrobe=['snowboard','skis','boots','poles','camera','bag'].map((category,i)=>({id:`gear-${i}`,name:`装备${i}`,category,color:'black',photo}));
  state.outfits=[{id:'gear-look',name:'全套',garmentIds:state.wardrobe.map(g=>g.id)}];
  assert.equal(core.validateState(state),true);
  const added=core.addOutfitToTrip(state,'gear-look');
  assert.deepEqual(added.trips[0].items.map(i=>i.category),['滑行装备','滑行装备','滑行装备','滑行装备','拍摄','随身']);
  assert.ok(added.trips[0].items.every(i=>i.status==='pending'));
  assert.equal(core.validateState(added),true);
});

test('备份校验拒绝坏画板坐标、重复层级、无效引用和额外字段',()=>{
  assert.equal(core.validateState(fixture()),true);
  assert.equal(core.validateState(withBoard()),true);
  const mutations=[
    s=>{s.board.background='other';},s=>{s.board.width=1200;},s=>{s.board.pieces[0].x=-1;},s=>{s.board.pieces[0].x=1601;},
    s=>{s.board.pieces[0].y=1101;},s=>{s.board.pieces[0].x=NaN;},s=>{s.board.pieces[0].y=Infinity;},
    s=>{s.board.pieces[0].scale=0;},s=>{s.board.pieces[0].scale=3.1;},s=>{s.board.pieces[0].rotation=181;},
    s=>{s.board.pieces[0].rotation='0';},s=>{s.board.pieces[0].z=2;},s=>{s.board.pieces[0].z=0.5;},
    s=>{s.board.pieces[0].z=3;},s=>{s.board.pieces[0].garmentId='missing';},s=>{s.board.pieces[0].garmentId='pants';},
    s=>{s.board.pieces[0].id='camera';},s=>{s.board.pieces[0].id='p-pants';},s=>{s.board.pieces[0].photo=photo;},
  ];
  for (const mutate of mutations) {
    const bad=withBoard();mutate(bad);
    assert.equal(core.validateState(bad),false,mutate.toString());
  }
});

test('抠图仅允许有原图的PNG或WebP，双图合计受现有照片预算限制',()=>{
  const state=fixture();
  state.wardrobe[0].cutout=cutout;
  assert.equal(core.validateState(state),true);
  state.wardrobe[0].cutout='data:image/webp;base64,Yg==';
  assert.equal(core.validateState(state),true);
  const mutations=[
    s=>{delete s.wardrobe[0].photo;},s=>{s.wardrobe[0].photo='';},s=>{s.wardrobe[0].cutout=photo;},
    s=>{s.wardrobe[0].cutout='https://example.com/image.png';},s=>{s.wardrobe[0].cutout='data:image/svg+xml;base64,Yg==';},
    s=>{s.wardrobe[0].cutout='data:image/png;base64,'+'A'.repeat(1500001);},
  ];
  for (const mutate of mutations) {
    const bad=structuredClone(state);mutate(bad);
    assert.equal(core.validateState(bad),false,mutate.toString());
  }
  const large=fixture();
  large.outfits=[];
  large.wardrobe=Array.from({length:3},(_,i)=>({id:`large-${i}`,name:'装备',category:'bag',color:'black',photo:'data:image/jpeg;base64,'+'A'.repeat(1400000),cutout:'data:image/png;base64,'+'A'.repeat(1400000)}));
  assert.equal(core.validateState(large),false);
  large.wardrobe.pop();
  assert.equal(core.validateState(large),true);
});

test('四件装备自动排版按长板实际高度留空，避免相邻两行长板重叠',()=>{
  const state=fixture();
  state.outfits=[];
  state.wardrobe=['snowboard','jacket','pants','skis'].map((category,i)=>({id:`long-${i}`,name:`装备${i}`,category,color:'black'}));
  const placed=core.addAllWardrobeToBoard(state);
  const board=placed.board.pieces.find(p=>p.garmentId==='long-0');
  const skis=placed.board.pieces.find(p=>p.garmentId==='long-3');
  const halfHeight=(p,w,h)=>p.scale*(Math.abs(w*Math.sin(p.rotation*Math.PI/180))+Math.abs(h*Math.cos(p.rotation*Math.PI/180)))/2;
  const boardBottom=board.y+halfHeight(board,170,550);
  const skisTop=skis.y-halfHeight(skis,190,540);
  assert.ok(boardBottom<skisTop,`长板底部 ${boardBottom} 应留在下一行双板顶部 ${skisTop} 之前`);
  assert.equal(core.validateState(placed),true);
});

test('常规十二件装备重排后的旋转包围盒保持在画布内且彼此分开',()=>{
  assert.ok(core.BOARD_ITEM_SIZES);
  const state=fixture();state.outfits=[];
  state.wardrobe=['jacket','pants','snowboard','skis','poles','helmet','goggles','boots','bag','camera','mid','gloves'].map((category,i)=>({id:`regular-${i}`,name:`装备${i}`,category,color:'black'}));
  const arranged=core.arrangeBoard(core.addAllWardrobeToBoard(state));
  const boxes=arranged.board.pieces.map(p=>{
    const garment=state.wardrobe.find(g=>g.id===p.garmentId);
    const [w,h]=core.BOARD_ITEM_SIZES[garment.category];
    const angle=p.rotation*Math.PI/180;
    const halfWidth=p.scale*(Math.abs(w*Math.cos(angle))+Math.abs(h*Math.sin(angle)))/2;
    const halfHeight=p.scale*(Math.abs(w*Math.sin(angle))+Math.abs(h*Math.cos(angle)))/2;
    return {id:p.id,left:p.x-halfWidth,right:p.x+halfWidth,top:p.y-halfHeight,bottom:p.y+halfHeight};
  });
  assert.ok(boxes.every(b=>b.left>=0&&b.right<=1600&&b.top>=0&&b.bottom<=1100));
  for (let i=0;i<boxes.length;i++) for (let j=i+1;j<boxes.length;j++) {
    const a=boxes[i],b=boxes[j];
    assert.ok(a.right<b.left||b.right<a.left||a.bottom<b.top||b.bottom<a.top,`装备 ${i} 与 ${j} 的包围盒不应重叠`);
  }
});
