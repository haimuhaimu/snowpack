import {icon} from './icons.mjs?v=alpine-v7.1';
import {CATEGORIES,BOARD_SIZE,BOARD_ITEM_SIZES,getBoard,addBoardPiece,addAllWardrobeToBoard,updateBoardPiece,removeBoardPiece,reorderBoardPiece,setBoardBackground,arrangeBoard} from './core.mjs?v=packing-v2';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons=Object.fromEntries(['plus','minus','fit','grid','move','up','edit','close','photo','check','undo','redo','jacket','snowboard','goggles','bag','hanger','snowflake'].map(name=>[name,icon(name,18)]));
export const pieceSize=category=>BOARD_ITEM_SIZES[category]||BOARD_ITEM_SIZES.accessory;
let selected=null,panMode=false,showNames=false,fullscreen=true,libraryOpen=false,multiSelect=false;
const chosen=new Set(),OUTFIT_LIMIT=30;
let lastViewport={width:0,height:0},restoreBoardFocus=false;
let view={x:0,y:0,zoom:.5},shouldFit=true,lastIds='';
export function requestBoardFit({resetSelection=false}={}){shouldFit=true;if(resetSelection){multiSelect=false;chosen.clear();selected=null;panMode=false;}}
function outfitPieces(board){return multiSelect?board.pieces.filter(p=>chosen.has(p.id)):board.pieces;}
function selectedPieces(board){return board.pieces.filter(p=>multiSelect?chosen.has(p.id):p.id===selected);}
function canSaveOutfit(board){const count=outfitPieces(board).length;return count>0&&count<=OUTFIT_LIMIT;}
function selectionHint(board){const count=outfitPieces(board).length;return count>OUTFIT_LIMIT?`每套最多 ${OUTFIT_LIMIT} 件，请${multiSelect?'减少选择':'开启多选'}`:multiSelect?`点选装备组合 · 每套最多 ${OUTFIT_LIMIT} 件`:'保存当前画板上的全部装备';}
const thumb=g=>g.cutout||g.photo;
const shape=g=>`<span class="board-no-photo">${icon(({skis:'ski',poles:'ski',snowboard:'snowboard',skiBoots:'shoe',snowboardBoots:'shoe',boots:'shoe',mid:'jacket',base:'jacket',accessory:'snowflake',gloves:'snowflake'})[g.category]||g.category,52)}<small>${esc(CATEGORIES[g.category]||'装备')}</small></span>`;
function pieceMarkup(p,g){const [w,h]=pieceSize(g.category),active=multiSelect?chosen.has(p.id):selected===p.id;return `<button type="button" class="board-piece ${thumb(g)?g.cutout?'has-cutout':'has-photo':'without-photo'} ${active?multiSelect?'is-chosen':'selected':''}" data-piece="${esc(p.id)}" aria-label="${multiSelect&&active?'取消选择':'选择'}${esc(g.name)}" aria-pressed="${active}" style="left:${p.x}px;top:${p.y}px;width:${w}px;height:${h}px;z-index:${p.z};transform:translate(-50%,-50%) rotate(${p.rotation}deg) scale(${p.scale})">${thumb(g)?`<img decoding="async" src="${thumb(g)}" alt="${esc(g.name)}" draggable="false">`:shape(g)}<span class="piece-selection-mark" aria-hidden="true">${icons.check}</span><span class="piece-caption">${esc(g.name)}${g.photo&&!g.cutout?'<small>原图 · 可自动抠图</small>':''}</span></button>`;}
export function renderBoard(state){
 const b=getBoard(state),present=new Set(b.pieces.map(p=>p.garmentId));
 if(!b.pieces.some(p=>p.id===selected))selected=null;
 const presentIds=new Set(b.pieces.map(p=>p.id));for(const id of chosen)if(!presentIds.has(id))chosen.delete(id);
 const ids=b.pieces.map(p=>p.id).sort().join('|');if(ids!==lastIds){shouldFit=true;lastIds=ids;}
 return `<section class="board-shell ${multiSelect?'multi-select-mode':''} ${fullscreen?'is-fullscreen':''} ${libraryOpen?'library-open':''}" aria-label="装备画板"><div class="board-toolbar"><div class="board-title"><span class="eyebrow">MY GEAR, MY STYLE</span><strong>我的装备墙 <small>${b.pieces.length} 件</small></strong></div><div class="board-top-actions"><button class="board-tool" data-board="upload" aria-label="添加装备照片">${icons.plus}<span class="upload-label">加照片</span></button><button class="board-tool shelf-toggle" data-board="library" aria-expanded="${libraryOpen}">${icons.bag}<span>装备</span></button><button class="board-tool" data-board="arrange" title="自动排版">${icons.grid}<span>排齐</span></button><button class="board-tool" data-board="fullscreen" aria-label="${fullscreen?'收起画板':'展开画板'}">${icons.fit}<span class="expand-label">${fullscreen?'收起':'展开'}</span></button></div></div><div class="board-workflow" aria-label="画板操作"><button class="board-tool board-select-mode ${multiSelect?'active':''}" data-board="multi-select" aria-pressed="${multiSelect}" aria-label="${multiSelect?'结束多选装备':'多选装备'}">${icons.check}<span>${multiSelect?'结束多选':'多选'}</span></button><div class="board-history" aria-label="画板编辑历史"><button class="board-tool" data-board="undo" aria-label="撤销画板编辑" title="撤销 · Ctrl / ⌘ Z" disabled>${icons.undo}</button><button class="board-tool" data-board="redo" aria-label="重做画板编辑" title="重做 · Ctrl / ⌘ Shift Z" disabled>${icons.redo}</button></div><button class="board-tool board-save-outfit" data-board="save-outfit" aria-label="存为搭配" ${canSaveOutfit(b)?'':'disabled'}>${icons.hanger}<span>存为搭配</span></button><span class="board-workflow-note" role="status" ${!multiSelect&&b.pieces.length>OUTFIT_LIMIT?'':'hidden'}>${!multiSelect&&b.pieces.length>OUTFIT_LIMIT?selectionHint(b):''}</span></div><div class="board-layout"><aside class="board-shelf"><div class="shelf-heading"><span>我的装备 <small>${state.wardrobe.length}</small></span><button data-board="all" class="text-button">全部上墙</button></div><div class="board-shelf-items">${state.wardrobe.map(g=>`<button class="shelf-item ${present.has(g.id)?'on-board':''}" data-board-garment="${esc(g.id)}" aria-label="${present.has(g.id)?'定位':'贴上'}${esc(g.name)}"><span class="shelf-image">${thumb(g)?`<img decoding="async" src="${thumb(g)}" alt="" draggable="false">`:shape(g)}</span><span class="shelf-copy"><strong>${esc(g.name)}</strong><small>${present.has(g.id)?'已上墙':CATEGORIES[g.category]}</small></span></button>`).join('')||'<p class="shelf-empty">把雪服、雪板、头盔<br>都收进这里。</p>'}<button class="shelf-add" data-board="upload">${icons.plus}<span>加装备照片</span></button></div></aside><div class="board-viewport board-${b.background} ${panMode?'pan-mode':''} ${showNames?'show-names':''}" tabindex="0" role="group" aria-label="自由摆放装备；拖动装备改变位置，拖动空白移动画布"><div class="board-watermark" aria-hidden="true"><span>SNOW / ARCHIVE</span><span>YOUR WINTER, ARRANGED.</span></div><div class="board-world" style="width:${BOARD_SIZE.width}px;height:${BOARD_SIZE.height}px">${[...b.pieces].sort((a,b)=>a.z-b.z).map(p=>pieceMarkup(p,state.wardrobe.find(g=>g.id===p.garmentId))).join('')}</div>${b.pieces.length?'':`<div class="board-empty"><div class="empty-stickers" aria-hidden="true"><i>${icons.jacket}</i><i>${icons.goggles}</i><i>${icons.snowboard}</i></div><h2>把喜欢的装备，<br>贴成自己的风格。</h2><p>上传照片，自动抠成贴纸。<br>雪服、雪板、小配件，都可以自由摆。</p><button class="primary" data-board="upload">${icons.plus}放上第一件</button></div>`}<div class="board-corner-note">${b.pieces.length?'拖动摆放 · 双指缩放':'你的装备画板'}</div><div class="board-view-controls"><button data-board="pan" class="board-tool ${panMode?'active':''}" aria-label="移动画布模式" aria-pressed="${panMode}">${icons.move}</button><button data-board="zoom-out" class="board-tool" aria-label="缩小画布">${icons.minus}</button><button data-board="fit" class="board-zoom-label" aria-label="适合画面">适合</button><button data-board="zoom-in" class="board-tool" aria-label="放大画布">${icons.plus}</button></div></div></div><div class="board-bottom"><div class="board-inspector" id="board-inspector"></div><div class="board-options"><div class="board-backgrounds" aria-label="画板背景">${[['paper','纸白'],['ice','冰蓝'],['dark','夜色']].map(([id,label])=>`<button class="board-background ${b.background===id?'active':''}" data-board-bg="${id}" aria-label="${label}画板" aria-pressed="${b.background===id}"><i class="swatch-${id}"></i>${label}</button>`).join('')}</div><button class="board-label-toggle" data-board="names" aria-pressed="${showNames}">${showNames?'隐藏名称':'显示名称'}</button></div></div></section>`;
}
export function mountBoard(root,{getState,save,editGarment,addGarment,packGarments=null,saveOutfit=()=>{},undoBoard=()=>{},redoBoard=()=>{},canUndoBoard=false,canRedoBoard=false,getHistoryState=null}){
 const shell=root.querySelector('.board-shell');if(!shell)return()=>{};
 const viewport=shell.querySelector('.board-viewport'),world=shell.querySelector('.board-world');
 const pieceElements=new Map([...world.querySelectorAll('[data-piece]')].map(el=>[el.dataset.piece,el]));
 const zoomLabel=shell.querySelector('.board-zoom-label');
 const outside=[document.querySelector('.topbar'),document.querySelector('.bottom-nav'),root.querySelector('.page-head'),root.querySelector('.wardrobe-mode'),root.querySelector(':scope > .form-note')].filter(Boolean);
 const oldOverflow=document.body.style.overflow;
 function immersive(){outside.forEach(el=>el.inert=fullscreen);document.body.style.overflow=fullscreen?'hidden':oldOverflow;}
 immersive();
 const controller=new AbortController(),opts={signal:controller.signal};let ro,frame,previewFrame=0,pendingPreview=null,gestureRect=null,gesture=null,pointers=new Map(),suppressUntil=0;
 function cancelPreview(){if(previewFrame)cancelAnimationFrame(previewFrame);previewFrame=0;pendingPreview=null;}
 function flushPreview(){const paint=pendingPreview;cancelPreview();paint?.();}
 function preview(paint){pendingPreview=paint;if(!previewFrame)previewFrame=requestAnimationFrame(flushPreview);}
 function current(){return getBoard(getState());}
 function applyView(){world.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.zoom})`;zoomLabel.textContent=`${Math.round(view.zoom*100)}%`;}
 function fit(){const b=current(),state=getState();let bounds={l:0,t:0,r:BOARD_SIZE.width,b:BOARD_SIZE.height};if(b.pieces.length){bounds={l:Infinity,t:Infinity,r:-Infinity,b:-Infinity};for(const p of b.pieces){const g=state.wardrobe.find(g=>g.id===p.garmentId);const [w,h]=pieceSize(g.category);const a=p.rotation*Math.PI/180;const ew=(Math.abs(w*Math.cos(a))+Math.abs(h*Math.sin(a)))*p.scale/2;const eh=(Math.abs(h*Math.cos(a))+Math.abs(w*Math.sin(a)))*p.scale/2;bounds.l=Math.min(bounds.l,p.x-ew);bounds.r=Math.max(bounds.r,p.x+ew);bounds.t=Math.min(bounds.t,p.y-eh);bounds.b=Math.max(bounds.b,p.y+eh);}}const width=viewport.clientWidth,height=viewport.clientHeight;view.zoom=Math.max(.12,Math.min(1.5,(width-64)/(bounds.r-bounds.l),(height-Math.min(94,Math.max(40,height*.16)))/(bounds.b-bounds.t)));view.x=width/2-(bounds.l+bounds.r)/2*view.zoom;view.y=height/2-(bounds.t+bounds.b)/2*view.zoom;applyView();shouldFit=false;}
 function zoom(factor,cx=viewport.clientWidth/2,cy=viewport.clientHeight/2){const next=Math.max(.12,Math.min(3,view.zoom*factor));const ratio=next/view.zoom;view.x=cx-(cx-view.x)*ratio;view.y=cy-(cy-view.y)*ratio;view.zoom=next;applyView();}
 function inspect(){
  const board=current(),p=board.pieces.find(p=>p.id===selected),g=p&&getState().wardrobe.find(g=>g.id===p.garmentId);
  const count=outfitPieces(board).length;
  world.querySelectorAll('[data-piece]').forEach(el=>{
   const active=multiSelect?chosen.has(el.dataset.piece):el.dataset.piece===selected;
   const piece=board.pieces.find(p=>p.id===el.dataset.piece),garment=piece&&getState().wardrobe.find(g=>g.id===piece.garmentId);
   el.classList.toggle('selected',!multiSelect&&active);el.classList.toggle('is-chosen',multiSelect&&active);el.setAttribute('aria-pressed',String(active));
   if(garment)el.setAttribute('aria-label',`${multiSelect&&active?'取消选择':'选择'}${garment.name}`);
  });
  shell.classList.toggle('multi-select-mode',multiSelect);
  viewport.setAttribute('aria-label',multiSelect?'多选装备；点按选择或取消选择，拖动移动画布，双指缩放':'自由摆放装备；拖动装备改变位置，拖动空白移动画布');
  shell.querySelector('.board-corner-note').textContent=board.pieces.length?multiSelect?'点选组合 · 双指缩放':'拖动摆放 · 双指缩放':'你的装备画板';
  const modeButton=shell.querySelector('[data-board=multi-select]');
  modeButton.classList.toggle('active',multiSelect);modeButton.setAttribute('aria-pressed',String(multiSelect));
  modeButton.setAttribute('aria-label',multiSelect?'结束多选装备':'多选装备');modeButton.querySelector('span').textContent=multiSelect?'结束多选':'多选';
  const saveButton=shell.querySelector('[data-board=save-outfit]');
  saveButton.disabled=!canSaveOutfit(board);saveButton.setAttribute('aria-label',`将${multiSelect?'已选':'画板上全部'} ${count} 件装备存为搭配`);saveButton.title=selectionHint(board);
  const limitNote=shell.querySelector('.board-workflow-note');limitNote.hidden=multiSelect||count<=OUTFIT_LIMIT;limitNote.textContent=limitNote.hidden?'':selectionHint(board);
  shell.querySelector('[data-board=undo]').disabled=!canUndoBoard;
  shell.querySelector('[data-board=redo]').disabled=!canRedoBoard;
  const packCount=selectedPieces(board).length;
  const packButton=typeof packGarments==='function'&&(multiSelect||p)?`<button class="board-tool board-pack-selection" data-board="pack-garments" aria-label="将已选 ${packCount} 件装备加入当前行程清单" ${packCount?'':'disabled'}>${icons.bag}<span>加入清单</span></button>`:'';
  const inspectorMarkup=multiSelect?`<div class="board-selection-summary"><strong aria-live="polite">已选 ${count} 件</strong><small>${selectionHint(board)}</small></div><div class="board-selection-actions"><button class="board-tool" data-board="select-all" aria-label="选择画板上全部装备" ${count===board.pieces.length?'disabled':''}>全选</button><button class="board-tool" data-board="clear-selection" aria-label="清空已选装备" ${count?'':'disabled'}>清空</button></div>`:p?`<div class="selected-gear"><strong>${esc(g.name)}</strong><small>${g.cutout?'透明贴纸':g.photo?'原图 · 可抠图':'尚未添加照片'}</small></div><div class="piece-sliders"><label>大小 <input type="range" data-adjust="scale" aria-label="装备大小" min="0.2" max="3" step="0.05" value="${p.scale}"></label><label>角度 <input type="range" data-adjust="rotation" aria-label="装备角度" min="-180" max="179" step="1" value="${p.rotation}"></label></div><div class="piece-actions"><button data-board="front" class="board-tool" aria-label="置于最前">${icons.up}</button><button data-board="edit" class="board-tool" aria-label="编辑选中装备">${icons.edit}<span>${g.photo&&!g.cutout?'编辑 / 抠图':'编辑'}</span></button><button data-board="remove" class="board-tool" aria-label="从画板移出">${icons.close}</button></div>`:`<p class="board-idle-hint">${icons.move}<span>${count>OUTFIT_LIMIT?selectionHint(board)+'，再存为搭配。':'点选调整装备，或用多选组合搭配。'}</span></p>`;
  shell.querySelector('#board-inspector').innerHTML=inspectorMarkup+packButton;
 }
 function setMultiSelect(active){
  multiSelect=active;
  if(active){panMode=false;viewport.classList.remove('pan-mode');const pan=shell.querySelector('[data-board=pan]');pan.classList.remove('active');pan.setAttribute('aria-pressed','false');}
  inspect();
 }
 function toggleChosen(id){if(chosen.has(id))chosen.delete(id);else chosen.add(id);inspect();}

 function paintPiece(p){const el=pieceElements.get(p.id);if(!el)return;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;el.style.transform=`translate(-50%,-50%) rotate(${p.rotation}deg) scale(${p.scale})`;}
 function commit(next,message='',{geometryOnly=false}={}){
  cancelPreview();
  // A caller without live history availability retains the original full render.
  const preserve=geometryOnly&&typeof getHistoryState==='function';
  const focusedAdjust=shell.contains(document.activeElement)?document.activeElement?.dataset?.adjust:null;
  const ok=save(next,message,preserve?{deferRender:true}:{});
  if(!ok||preserve)current().pieces.forEach(paintPiece);
  if(preserve){
   if(ok)({canUndoBoard,canRedoBoard}=getHistoryState());inspect();
   if(focusedAdjust)shell.querySelector(`[data-adjust="${CSS.escape(focusedAdjust)}"]`)?.focus({preventScroll:true});
  }
  return ok;
 }
 function select(id){selected=id;inspect();}
 function focusPiece(p){if(multiSelect){chosen.add(p.id);inspect();}else select(p.id);view.x=viewport.clientWidth/2-p.x*view.zoom;view.y=viewport.clientHeight/2-p.y*view.zoom;applyView();}
 shell.addEventListener('pointerdown',()=>{suppressUntil=0;},opts);
 shell.addEventListener('click',event=>{
  if(performance.now()<suppressUntil){suppressUntil=0;event.preventDefault();return;}
  const b=event.target.closest('button');if(!b)return;
  if(b.disabled)return;
  if(b.dataset.piece){multiSelect?toggleChosen(b.dataset.piece):select(b.dataset.piece);return;}
  if(b.dataset.boardGarment){libraryOpen=false;shell.classList.remove('library-open');shell.querySelector('.shelf-toggle').setAttribute('aria-expanded','false');const p=current().pieces.find(p=>p.garmentId===b.dataset.boardGarment);if(p)focusPiece(p);else commit(addBoardPiece(getState(),b.dataset.boardGarment));return;}
  if(b.dataset.boardBg){commit(setBoardBackground(getState(),b.dataset.boardBg));return;}
  const action=b.dataset.board;if(!action)return;
  if(action==='multi-select'){setMultiSelect(!multiSelect);return;}
  if(action==='select-all'){current().pieces.forEach(p=>chosen.add(p.id));inspect();return;}
  if(action==='clear-selection'){chosen.clear();inspect();return;}
  if(action==='pack-garments'){const ids=selectedPieces(current()).map(p=>p.garmentId);if(ids.length&&typeof packGarments==='function')packGarments(ids);return;}
  if(action==='save-outfit'){if(canSaveOutfit(current()))saveOutfit(outfitPieces(current()).map(p=>p.garmentId));return;}
  if(action==='undo'){if(canUndoBoard)undoBoard();return;}
  if(action==='redo'){if(canRedoBoard)redoBoard();return;}
  if(action==='library'){libraryOpen=!libraryOpen;shell.classList.toggle('library-open',libraryOpen);b.setAttribute('aria-expanded',String(libraryOpen));return;}
  if(action==='upload'){addGarment();return;}
  if(action==='all'){commit(addAllWardrobeToBoard(getState()),'已有装备都上墙了。');return;}
  if(action==='arrange'){shouldFit=true;commit(arrangeBoard(getState()),'已重新排齐。');return;}
  if(action==='fit'){fit();return;}
  if(action==='zoom-in'||action==='zoom-out'){zoom(action==='zoom-in'?1.2:1/1.2);return;}
  if(action==='pan'){panMode=!panMode;if(panMode&&multiSelect)setMultiSelect(false);viewport.classList.toggle('pan-mode',panMode);b.classList.toggle('active',panMode);b.setAttribute('aria-pressed',String(panMode));return;}
  if(action==='names'){showNames=!showNames;viewport.classList.toggle('show-names',showNames);b.textContent=showNames?'隐藏名称':'显示名称';b.setAttribute('aria-pressed',String(showNames));return;}
  if(action==='fullscreen'){fullscreen=!fullscreen;shell.classList.toggle('is-fullscreen',fullscreen);immersive();b.setAttribute('aria-label',fullscreen?'收起画板':'展开画板');b.querySelector('.expand-label').textContent=fullscreen?'收起':'展开';requestAnimationFrame(fit);return;}
  const p=current().pieces.find(p=>p.id===selected);if(!p)return;
  if(action==='front')commit(reorderBoardPiece(getState(),p.id,'front'));
  if(action==='edit')editGarment(p.garmentId);
  if(action==='remove')commit(removeBoardPiece(getState(),p.id),'已从画板移出，装备仍在衣橱。');
 },opts);
 shell.addEventListener('input',event=>{const key=event.target.dataset.adjust;if(!key)return;const p=current().pieces.find(p=>p.id===selected);if(p){const next={...p,[key]:Number(event.target.value)};preview(()=>paintPiece(next));}},opts);
 shell.addEventListener('change',event=>{const key=event.target.dataset.adjust;if(key&&selected)commit(updateBoardPiece(getState(),selected,{[key]:Number(event.target.value)}),'',{geometryOnly:true});},opts);
 function point(event){const r=gestureRect||(gestureRect=viewport.getBoundingClientRect());return{x:event.clientX-r.left,y:event.clientY-r.top};}
 globalThis.addEventListener?.('scroll',()=>{gestureRect=null;},{...opts,capture:true,passive:true});
 function startPinch(){const [a,b]=[...pointers.values()];const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};gesture={mode:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),startZoom:view.zoom,wx:(center.x-view.x)/view.zoom,wy:(center.y-view.y)/view.zoom,moved:true};}
 viewport.addEventListener('pointerdown',event=>{
  if(event.button!==0&&event.pointerType!=='touch')return;if(event.target.closest('[data-board]'))return;
  if(pointers.size>=2)return;if(!pointers.size){flushPreview();gestureRect=null;}event.preventDefault();viewport.focus({preventScroll:true});viewport.setPointerCapture(event.pointerId);const pos=point(event);pointers.set(event.pointerId,pos);
  if(pointers.size===2){cancelPreview();if(gesture?.mode==='piece')paintPiece(gesture.original);else applyView();startPinch();return;}
  if(pointers.size>2)return;
  const piece=event.target.closest('[data-piece]');const p=piece&&current().pieces.find(p=>p.id===piece.dataset.piece);
  if(p&&multiSelect){gesture={mode:'selection',id:p.id,start:pos,x:view.x,y:view.y,moved:false};}
  else if(p&&!panMode){select(p.id);gesture={mode:'piece',id:p.id,start:pos,original:{...p},next:{...p},moved:false};}
  else{if(!p&&!multiSelect)select(null);gesture={mode:'pan',start:pos,x:view.x,y:view.y,moved:false};}
 },opts);
 function movePointer(event){if(!pointers.has(event.pointerId)||!gesture)return;const pos=point(event);pointers.set(event.pointerId,pos);
  if(gesture.mode==='pinch'&&pointers.size>=2){const[a,b]=[...pointers.values()];const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;view.zoom=Math.max(.12,Math.min(3,gesture.startZoom*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance));view.x=cx-gesture.wx*view.zoom;view.y=cy-gesture.wy*view.zoom;preview(applyView);return;}
  const dx=pos.x-gesture.start.x,dy=pos.y-gesture.start.y;if(Math.hypot(dx,dy)>4)gesture.moved=true;
  if(gesture.mode==='piece'){gesture.next={...gesture.original,x:Math.max(0,Math.min(BOARD_SIZE.width,gesture.original.x+dx/view.zoom)),y:Math.max(0,Math.min(BOARD_SIZE.height,gesture.original.y+dy/view.zoom))};const next=gesture.next;preview(()=>paintPiece(next));}
  else if(gesture.mode==='pan'||(gesture.mode==='selection'&&gesture.moved)){view.x=gesture.x+dx;view.y=gesture.y+dy;preview(applyView);}
 }
 viewport.addEventListener('pointermove',movePointer,opts);
 function endPointer(event,cancel=false){if(!pointers.has(event.pointerId))return;if(!cancel)movePointer(event);cancel?cancelPreview():flushPreview();pointers.delete(event.pointerId);if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
  if(gesture?.mode==='pinch'&&pointers.size===1){const pos=[...pointers.values()][0];gesture={mode:'pan',start:pos,x:view.x,y:view.y,moved:true};return;}
  if(pointers.size)return;const done=gesture;gesture=null;gestureRect=null;suppressUntil=done?.mode==='selection'||(!cancel&&done?.moved)?performance.now()+350:0;
  if(done?.mode==='selection'&&!cancel&&!done.moved)toggleChosen(done.id);
  if(done?.mode==='piece'){if(cancel||!done.moved)paintPiece(done.original);else commit(updateBoardPiece(getState(),done.id,{x:done.next.x,y:done.next.y}),'',{geometryOnly:true});}
 }
 viewport.addEventListener('pointerup',e=>endPointer(e),opts);viewport.addEventListener('pointercancel',e=>endPointer(e,true),opts);
 viewport.addEventListener('lostpointercapture',e=>endPointer(e,true),opts);
 viewport.addEventListener('wheel',event=>{event.preventDefault();if(!pointers.size)gestureRect=null;const pos=point(event);if(event.ctrlKey||event.metaKey)zoom(Math.exp(-event.deltaY*.008),pos.x,pos.y);else{view.x-=event.deltaX;view.y-=event.deltaY;applyView();}}, {...opts,passive:false});
 shell.addEventListener('keydown',event=>{
  if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
  if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='z'){
   event.preventDefault();if(event.shiftKey){if(canRedoBoard)redoBoard();}else if(canUndoBoard)undoBoard();return;
  }
  const p=!multiSelect&&current().pieces.find(p=>p.id===selected);
  if(viewport.contains(event.target)&&p&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
   event.preventDefault();const step=event.shiftKey?20:5;commit(updateBoardPiece(getState(),p.id,{x:p.x+({'ArrowLeft':-step,'ArrowRight':step}[event.key]||0),y:p.y+({'ArrowUp':-step,'ArrowDown':step}[event.key]||0)}),'',{geometryOnly:true});
  }else if(event.key==='Escape'){
   event.preventDefault();if(multiSelect){setMultiSelect(false);return;}
   select(null);if(fullscreen){fullscreen=false;shell.classList.remove('is-fullscreen');immersive();const toggle=shell.querySelector('[data-board=fullscreen]');toggle.setAttribute('aria-label','展开画板');toggle.querySelector('.expand-label').textContent='展开';fit();}
  }
 },opts);
 ro=new ResizeObserver(()=>{gestureRect=null;const changed=lastViewport.width!==viewport.clientWidth||lastViewport.height!==viewport.clientHeight;lastViewport={width:viewport.clientWidth,height:viewport.clientHeight};if(shouldFit||changed)fit();else applyView();});ro.observe(viewport);inspect();frame=requestAnimationFrame(()=>{shouldFit?fit():applyView();});
 if(restoreBoardFocus){restoreBoardFocus=false;viewport.focus({preventScroll:true});}
 return()=>{restoreBoardFocus=shell.contains(document.activeElement);controller.abort();ro?.disconnect();cancelAnimationFrame(frame);cancelPreview();pointers.clear();gesture=null;gestureRect=null;outside.forEach(el=>el.inert=false);document.body.style.overflow=oldOverflow;};
}
