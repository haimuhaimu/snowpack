import test from 'node:test';
import assert from 'node:assert/strict';
import {mountBoard,requestBoardFit} from '../docs/board.mjs';

// A DOM/scheduler boundary for the real mounted handlers. This does not model
// browser layout, physical touch, image decoding, or native pointer capture.
function harness(t,{saveSucceeds=true}={}) {
 const frames=new Map();let nextFrame=0,rectReads=0,pieceWrites=0,saves=0,lastSaveOptions;
 const globals=['document','ResizeObserver','CSS','requestAnimationFrame','cancelAnimationFrame'];
 const old=new Map(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const element=(dataset={})=>{
  const listeners=new Map(),classes=new Set(),attributes=new Map(),children=new Map(),captures=new Set();
  const node={dataset,style:{},clientWidth:1600,clientHeight:1100,
   classList:{toggle(key,on){if(on===undefined)on=!classes.has(key);on?classes.add(key):classes.delete(key);},add:key=>classes.add(key),remove:key=>classes.delete(key)},
   setAttribute:(key,value)=>attributes.set(key,value),querySelector(selector){if(!children.has(selector))children.set(selector,element());return children.get(selector);},querySelectorAll:()=>[],
   closest:selector=>selector==='[data-piece]'&&dataset.piece?node:null,
   addEventListener(type,fn,options){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);options?.signal?.addEventListener('abort',()=>listeners.set(type,listeners.get(type).filter(value=>value!==fn)),{once:true});},
   emit(type,event){for(const fn of listeners.get(type)||[])fn({button:0,pointerType:'touch',pointerId:1,target:node,preventDefault(){},...event});},
   focus(){document.activeElement=node;},contains:target=>target===node,
   setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),
   getBoundingClientRect(){rectReads++;return {left:10,top:20};},
  };return node;
 };
 const shell=element(),viewport=element(),world=element(),piece=element({piece:'p'}),inspectorInputs=new Map();
 piece.style=new Proxy({left:'800px',top:'550px'},{set(object,key,value){pieceWrites++;object[key]=value;return true;}});
 const otherQuery=shell.querySelector.bind(shell);
 shell.querySelector=selector=>selector==='.board-viewport'?viewport:selector==='.board-world'?world:inspectorInputs.get(selector)||otherQuery(selector);
 shell.contains=target=>[shell,viewport,world,piece,...inspectorInputs.values()].includes(target);
 Object.defineProperty(shell.querySelector('#board-inspector'),'innerHTML',{set(value){inspectorInputs.clear();for(const key of ['scale','rotation']){const match=value.match(new RegExp(`data-adjust="${key}"[^>]*value="([^"]+)"`));if(match){const input=element({adjust:key});input.value=match[1];inspectorInputs.set(`[data-adjust="${key}"]`,input);}}}});
 world.querySelector=()=>piece;world.querySelectorAll=()=>[piece];
 const root={querySelector:selector=>selector==='.board-shell'?shell:null};
 Object.assign(globalThis,{document:{body:{style:{}},activeElement:null,querySelector:()=>null},ResizeObserver:class{observe(){}disconnect(){}},CSS:{escape:value=>value},requestAnimationFrame:callback=>{frames.set(++nextFrame,callback);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id)});
 const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
 let state={wardrobe:[{id:'g',name:'外套',category:'jacket',color:'black'}],board:{background:'paper',pieces:[{id:'p',garmentId:'g',x:800,y:550,scale:1,rotation:0,z:0}]}};
 requestBoardFit({resetSelection:true});
 const cleanup=mountBoard(root,{getState:()=>state,save:(next,message,options)=>{saves++;lastSaveOptions=options;if(saveSucceeds)state=next;return saveSucceeds;},getHistoryState:()=>({canUndoBoard:saveSucceeds&&saves>0,canRedoBoard:false})});
 flush();pieceWrites=0;rectReads=0;
 t.after(()=>{cleanup();for(const [key,descriptor] of old){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 const send=(type,x,y=100,extra={})=>viewport.emit(type,{clientX:x,clientY:y,target:piece,...extra});
 return {send,flush,cleanup,piece,world,shell,get state(){return state;},get saves(){return saves;},get lastSaveOptions(){return lastSaveOptions;},get writes(){return pieceWrites;},get rectReads(){return rectReads;},get pendingFrames(){return frames.size;}};
}

test('同一帧内多次拖动只绘制最新位置，拖动期间不保存或反复读取画布边界',t=>{
 const h=harness(t);h.send('pointerdown',100);
 h.send('pointermove',130);h.send('pointermove',160);h.send('pointermove',190);
 assert.equal(h.writes,0);assert.equal(h.saves,0);assert.equal(h.rectReads,1);
 h.flush();assert.equal(h.writes,3);assert.equal(h.piece.style.left,'860px');
});

test('抬手提交最后坐标，即使最后位置没有单独触发 pointermove',t=>{
 const h=harness(t);h.send('pointerdown',100);h.send('pointermove',130);h.send('pointerup',190);
 assert.equal(h.saves,1);assert.equal(h.state.board.pieces[0].x,860);assert.equal(h.pendingFrames,0);
 h.flush();assert.equal(h.piece.style.left,'860px');
});

test('只有按下和抬手也按最终位移提交一次',t=>{
 const h=harness(t);h.send('pointerdown',100);h.send('pointerup',160);
 assert.equal(h.saves,1);assert.equal(h.state.board.pieces[0].x,840);
});

test('取消拖动恢复原位，排队帧不能随后把装备移回预览位置',t=>{
 const h=harness(t);h.send('pointerdown',100);h.send('pointermove',190);h.send('pointercancel',190);
 h.flush();assert.equal(h.piece.style.left,'800px');assert.equal(h.saves,0);assert.equal(h.pendingFrames,0);
});

test('意外失去指针捕获按取消处理，不保存排队中的位置',t=>{
 const h=harness(t);h.send('pointerdown',100);h.send('pointermove',190);h.send('lostpointercapture',190);
 h.flush();assert.equal(h.piece.style.left,'800px');assert.equal(h.saves,0);assert.equal(h.pendingFrames,0);
});

test('第二指接管缩放时恢复拖动物件，排队的旧拖动不再绘制或保存',t=>{
 const h=harness(t);h.send('pointerdown',100);h.send('pointermove',190);h.send('pointerdown',300,100,{pointerId:2});
 h.flush();assert.equal(h.piece.style.left,'800px');assert.equal(h.saves,0);
 h.send('pointercancel',300,100,{pointerId:2});h.send('pointercancel',190);
});

test('保存失败恢复上次位置并清理待绘制帧',t=>{
 const h=harness(t,{saveSucceeds:false});h.send('pointerdown',100);h.send('pointermove',190);h.send('pointerup',220);
 h.flush();assert.equal(h.saves,1);assert.equal(h.state.board.pieces[0].x,800);assert.equal(h.piece.style.left,'800px');assert.equal(h.pendingFrames,0);
});

test('卸载画板清理待绘制帧，旧手势不能继续修改元素',t=>{
 const h=harness(t);h.send('pointerdown',100);h.send('pointermove',190);h.cleanup();
 const before=h.piece.style.left;h.flush();assert.equal(h.piece.style.left,before);assert.equal(h.pendingFrames,0);assert.equal(h.saves,0);
});

test('几何编辑使用保留画板的保存契约，并刷新撤销按钮',t=>{
 const h=harness(t);h.send('pointerdown',100);h.send('pointerup',160);
 assert.deepEqual(h.lastSaveOptions,{deferRender:true});
 assert.equal(h.shell.querySelector('[data-board=undo]').disabled,false);
 assert.equal(h.shell.querySelector('[data-board=redo]').disabled,true);
 assert.equal(h.world.querySelector('[data-piece="p"]'),h.piece);
});

test('滑块和方向键编辑同样保留已挂载的画板并刷新保存后的几何',t=>{
 const h=harness(t);h.send('pointerdown',100);h.send('pointerup',100);
 h.shell.emit('input',{target:{dataset:{adjust:'scale'},value:'1.5'}});
 h.shell.emit('change',{target:{dataset:{adjust:'scale'},value:'1.5'}});
 assert.deepEqual(h.lastSaveOptions,{deferRender:true});assert.equal(h.state.board.pieces[0].scale,1.5);
 // The keyboard route is scoped to the viewport; send its focused node.
 h.shell.emit('keydown',{target:document.activeElement,key:'ArrowRight'});
 assert.equal(h.state.board.pieces[0].x,805);assert.deepEqual(h.lastSaveOptions,{deferRender:true});
 assert.equal(h.world.querySelector('[data-piece="p"]'),h.piece);assert.equal(h.pendingFrames,0);
});

test('失败的滑块保存恢复控件原值和焦点，不启用撤销',t=>{
 const h=harness(t,{saveSucceeds:false});h.send('pointerdown',100);h.send('pointerup',100);
 const slider=h.shell.querySelector('[data-adjust="scale"]');slider.focus();slider.value='1.5';
 h.shell.emit('input',{target:slider});h.shell.emit('change',{target:slider});h.flush();
 const restored=h.shell.querySelector('[data-adjust="scale"]');
 assert.equal(restored.value,'1');assert.equal(document.activeElement,restored);
 assert.equal(h.state.board.pieces[0].scale,1);assert.equal(h.shell.querySelector('[data-board=undo]').disabled,true);
});
