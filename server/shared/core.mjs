import {GEAR_CATALOG} from './catalog.mjs';
export {GEAR_GROUPS,GEAR_CATALOG} from './catalog.mjs';

export const CATEGORIES = Object.freeze({jacket:'雪服外套',pants:'雪裤',mid:'保暖中层',base:'贴身上衣',helmet:'头盔',goggles:'雪镜',gloves:'手套',accessory:'配件',snowboard:'单板',skis:'双板',snowboardBoots:'单板雪鞋',skiBoots:'双板雪鞋',boots:'雪鞋（未分板型）',poles:'雪杖',camera:'相机',bag:'背包／装备包'});
export const BOARD_SIZE = Object.freeze({width:1600,height:1100});
export const BOARD_ITEM_SIZES = Object.freeze(Object.fromEntries(Object.entries({
  jacket:[300,340],pants:[240,360],mid:[270,310],base:[230,290],helmet:[235,210],goggles:[240,145],gloves:[180,190],
  snowboard:[170,550],skis:[190,540],snowboardBoots:[245,240],skiBoots:[245,240],boots:[245,240],poles:[180,510],camera:[170,180],bag:[240,300],accessory:[200,200],
}).map(([category,size])=>[category,Object.freeze(size)])));
export const STATUS_LABELS = Object.freeze({pending:'待装',packed:'已装包',wearing:'穿身上',rental:'到场待取',skip:'本次不带'});
export const PACKING_LOCATIONS = Object.freeze({unassigned:'未分配',boardBag:'板包',bootBag:'雪鞋包',luggage:'行李箱',backpack:'随身背包',pocket:'衣服口袋',wetBag:'干湿分装袋'});
export const COLORS = Object.freeze([
  {id:'black',label:'黑色',hex:'#202726'}, {id:'white',label:'白色',hex:'#F6F5EE'},
  {id:'gray',label:'灰色',hex:'#89918E'}, {id:'navy',label:'藏蓝',hex:'#253B59'},
  {id:'blue',label:'蓝色',hex:'#397CAA'}, {id:'green',label:'绿色',hex:'#547D59'},
  {id:'orange',label:'橙色',hex:'#DF773D'}, {id:'red',label:'红色',hex:'#BD4A44'},
  {id:'yellow',label:'黄色',hex:'#DDB64C'}, {id:'purple',label:'紫色',hex:'#8666A0'},
  {id:'pink',label:'粉色',hex:'#D99AAE'}, {id:'beige',label:'米色',hex:'#C8B99A'},
  {id:'multi',label:'多色',hex:'#A79888'},
].map(Object.freeze));

const SPORTS = new Set(['snowboard','ski','both']);
const READY = new Set(['packed','wearing']);
const BOARD_BACKGROUNDS = new Set(['paper','ice','dark']);
const EQUIPMENT_CATEGORIES = Object.freeze({snowboard:'滑行装备',skis:'滑行装备',snowboardBoots:'滑行装备',skiBoots:'滑行装备',boots:'滑行装备',poles:'滑行装备',camera:'拍摄',bag:'随身'});
const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
const shortText = (value,max) => typeof value==='string' && value.trim().length>0 && value.length<=max && !/[\u0000-\u001f\u007f]/.test(value);
const normalizeText = (value,max,fallback='') => typeof value==='string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max) || fallback : fallback;
const quantity = value => Number.isFinite(Number(value)) ? Math.max(1,Math.min(99,Math.floor(Number(value)))) : 1;
let sequence = 0;
export function uid(prefix='id') {
  const salt = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${normalizeText(prefix,20,'id')}-${salt}`;
}

const nameIdentity = name => typeof name==='string' ? name.trim().normalize('NFKC').toLowerCase() : '';
const matchesSport = (entry,sport) => sport==='both' || !entry.modes || entry.modes.includes(sport);
const matchesEntry = (item,entry) => (Boolean(entry.key || entry.templateKey) && item.templateKey===(entry.key || entry.templateKey)) || nameIdentity(item.name)===nameIdentity(entry.name);

export function getCatalogItems(trip) {
  const sport=SPORTS.has(trip?.sport) ? trip.sport : 'both';
  return GEAR_CATALOG.filter(entry=>matchesSport(entry,sport));
}
export function catalogItemInTrip(trip,entry) {
  return Boolean(entry && trip?.items?.some(item=>matchesEntry(item,entry)));
}

function itemFromTemplate(template,source='template') {
  return {
    id:uid('item'),name:normalizeText(template.name,120),category:normalizeText(template.category,40,'自定义'),
    ...(template.slot ? {slot:template.slot} : {}),
    ...(template.modes ? {modes:[...template.modes]} : {}),
    ...(template.key || template.templateKey ? {templateKey:template.key || template.templateKey} : {}),
    qty:quantity(template.qty),status:'pending',source,
  };
}

export function createTrip({name='新行程',sport='both',overnight=false,camera=false}={},customTemplates=[]) {
  const selectedSport = SPORTS.has(sport) ? sport : 'both';
  const templates = GEAR_CATALOG.filter(t=>(t.default && (!t.overnight || overnight)) || (camera && t.cameraDefault));
  const items = templates.filter(t=>matchesSport(t,selectedSport)).map(t=>itemFromTemplate(t));
  const appliedTemplateIds = new Set();
  for (const template of customTemplates) {
    if (!matchesSport(template,selectedSport)) continue;
    const existingIndex=items.findIndex(item=>matchesEntry(item,template));
    if (existingIndex>=0) {
      const item=items[existingIndex];
      if (!appliedTemplateIds.has(item.id)) {
        items[existingIndex]={...item,qty:quantity(template.qty)};
        appliedTemplateIds.add(item.id);
      }
      continue;
    }
    if (items.length>=600) break;
    const item=itemFromTemplate(template,'custom');
    items.push(item);
    appliedTemplateIds.add(item.id);
  }
  return {id:uid('trip'),name:normalizeText(name,80,'新行程'),sport:selectedSport,overnight:Boolean(overnight),createdAt:new Date().toISOString(),items};
}

export function createInitialState() {
  const trip = createTrip({name:'本次出发',sport:'both',overnight:false});
  return {version:1,trips:[trip],activeTripId:trip.id,wardrobe:[],outfits:[],customTemplates:[]};
}
export function getActiveTrip(state) {
  return state.trips.find(trip=>trip.id===state.activeTripId);
}
function mapCurrentTrip(state,update) {
  return {...state,trips:state.trips.map(trip=>trip.id===state.activeTripId ? update(trip) : trip)};
}
export function duplicateTrip(state,{name,keepSkipped=true,keepRental=true}={}) {
  const current=getActiveTrip(state);
  if (!current || state.trips.length>=100) return state;
  const trip={...current,id:uid('trip'),name:normalizeText(name,80,`${current.name} · 新行程`.slice(0,80)),createdAt:new Date().toISOString(),
    items:current.items.map(item=>({...item,id:uid('item'),...(item.modes ? {modes:[...item.modes]} : {}),
      status:item.status==='skip' && keepSkipped ? 'skip' : item.status==='rental' && keepRental ? 'rental' : 'pending'}))};
  return {...state,trips:[...state.trips,trip],activeTripId:trip.id};
}
function rememberItem(state,item) {
  if (!item || item.source==='wardrobe') return state;
  const matches=state.customTemplates.filter(template=>matchesEntry(template,item));
  if (matches.length) {
    if (matches.every(template=>template.qty===item.qty)) return state;
    return {...state,customTemplates:state.customTemplates.map(template=>matchesEntry(template,item) ? {...template,qty:item.qty} : template)};
  }
  if (state.customTemplates.length>=300) return state;
  return {...state,customTemplates:[...state.customTemplates,{...itemFromTemplate(item,item.source),id:uid('template')}]};
}
export function isItemRemembered(state,itemId) {
  const item=getActiveTrip(state)?.items.find(entry=>entry.id===itemId);
  return Boolean(item && item.source!=='wardrobe' && state.customTemplates.some(template=>matchesEntry(template,item)));
}
export function addCatalogItems(state,keys,{remember=false}={}) {
  const trip=getActiveTrip(state);
  if (!trip || !Array.isArray(keys)) return state;
  const selectedKeys=new Set(keys);
  const selected=getCatalogItems(trip).filter(entry=>selectedKeys.has(entry.key));
  const items=[...trip.items];
  let changed=state,itemsChanged=false;
  for (const entry of selected) {
    let index=items.findIndex(item=>matchesEntry(item,entry));
    if (index<0) {
      if (items.length>=600) continue;
      index=items.length;
      items.push(itemFromTemplate(entry));
      itemsChanged=true;
    } else if (items[index].status==='skip') {
      items[index]={...items[index],status:'pending'};
      itemsChanged=true;
    }
    if (remember) {
      const item=items[index];
      changed=rememberItem(changed,{...item,
        ...(entry.slot ? {slot:entry.slot} : {}),...(entry.modes ? {modes:[...entry.modes]} : {}),templateKey:entry.key});
    }
  }
  return itemsChanged ? mapCurrentTrip(changed,current=>({...current,items})) : changed;
}
export function setItemStatus(state,itemId,status) {
  if (!own(STATUS_LABELS,status)) return state;
  return mapCurrentTrip(state,trip=>({...trip,items:trip.items.map(item=>item.id===itemId ? {...item,status} : item)}));
}
export function updateItemLocation(state,itemId,location) {
  if (typeof location!=='string' || !own(PACKING_LOCATIONS,location)) return state;
  const item=getActiveTrip(state)?.items.find(entry=>entry.id===itemId);
  if (!item || item.category==='出发检查') return state;
  if (location==='unassigned' ? !own(item,'packingLocation') : item.packingLocation===location) return state;
  return mapCurrentTrip(state,trip=>({...trip,items:trip.items.map(entry=>{
    if (entry.id!==itemId) return entry;
    const updated={...entry};
    if (location==='unassigned') delete updated.packingLocation;
    else updated.packingLocation=location;
    return updated;
  })}));
}
export function updateItemQty(state,itemId,qty,{remember=false}={}) {
  const item=getActiveTrip(state)?.items.find(entry=>entry.id===itemId);
  if (!item) return state;
  const normalized = quantity(qty);
  const changed=mapCurrentTrip(state,trip=>({...trip,items:trip.items.map(item=>item.id===itemId ? {
    ...item,qty:normalized,status:normalized>item.qty && READY.has(item.status) ? 'pending' : item.status,
  } : item)}));
  return remember ? rememberItem(changed,{...item,qty:normalized}) : changed;
}
export function summarizeTrip(trip) {
  const summary = {total:0,ready:0,pending:0,rental:0,skipped:0};
  for (const item of trip?.items || []) {
    if (item.status==='skip') { summary.skipped++; continue; }
    summary.total++;
    if (READY.has(item.status)) summary.ready++;
    else if (item.status==='rental') summary.rental++;
    else summary.pending++;
  }
  return summary;
}
export function addCustomItem(state,{name,category,qty=1},remember=true) {
  const itemName = normalizeText(name,120);
  const trip=getActiveTrip(state);
  if (!itemName || !trip) return state;
  const existing=trip.items.find(item=>nameIdentity(item.name)===nameIdentity(itemName));
  if (existing) {
    const changed=updateItemQty(state,existing.id,qty,{remember});
    return existing.status==='skip' ? setItemStatus(changed,existing.id,'pending') : changed;
  }
  if (trip.items.length>=600) return state;
  const item = {id:uid('item'),name:itemName,category:normalizeText(category,40,'自定义'),qty:quantity(qty),status:'pending',source:'custom'};
  const changed = mapCurrentTrip(state,trip=>({...trip,items:[...trip.items,item]}));
  return remember ? rememberItem(changed,item) : changed;
}
export function addOutfitToTrip(state,outfitId) {
  const outfit = state.outfits.find(entry=>entry.id===outfitId);
  const trip=getActiveTrip(state);
  if (!outfit || !trip) return state;
  const garments = outfit.garmentIds.map(id=>state.wardrobe.find(g=>g.id===id)).filter(Boolean);
  const existingGarments=new Set(trip.items.map(item=>item.wardrobeId));
  if (trip.items.length+garments.filter(garment=>!existingGarments.has(garment.id)).length>600) return state;
  const slots = new Set(garments.map(g=>g.category));
  const selectedGarments = new Set(garments.map(g=>g.id));
  return mapCurrentTrip(state,trip=>{
    const existing = new Set(trip.items.map(item=>item.wardrobeId).filter(Boolean));
    // Adding never silently removes another real garment or a confirmed packed item.
    const items = trip.items.map(item=>{
      if (selectedGarments.has(item.wardrobeId) && item.status==='skip') return {...item,status:'pending'};
      const slot=item.slot || GEAR_CATALOG.find(entry=>entry.key===item.templateKey)?.slot;
      return item.source==='template' && slots.has(slot) && !READY.has(item.status) ? {...item,status:'skip'} : item;
    });
    for (const garment of garments) {
      if (existing.has(garment.id)) continue;
      existing.add(garment.id);
      items.push({id:uid('item'),name:garment.name,category:EQUIPMENT_CATEGORIES[garment.category] || '穿戴',slot:garment.category,qty:1,status:'pending',source:'wardrobe',wardrobeId:garment.id,fromOutfit:true});
    }
    return {...trip,items};
  });
}

export function getBoard(state) {
  return state.board ?? {background:'paper',pieces:[]};
}
const orderedPieces = board => [...board.pieces].sort((a,b)=>a.z-b.z);
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const finiteNumber = value => typeof value==='number' && Number.isFinite(value);
const BOARD_PIECE_KEYS = ['id','garmentId','x','y','scale','rotation','z'];
function normalizedRotation(value) {
  const result=((value+180)%360+360)%360-180;
  return result===-180 && value>0 ? 180 : result;
}
function boardPlacement(index,total,category) {
  const columns=Math.min(total,Math.ceil(Math.sqrt(total*BOARD_SIZE.width/BOARD_SIZE.height)));
  const rows=Math.ceil(total/columns);
  const cellWidth=(BOARD_SIZE.width-160)/columns;
  const cellHeight=(BOARD_SIZE.height-160)/rows;
  const [width,height]=BOARD_ITEM_SIZES[category] || BOARD_ITEM_SIZES.accessory;
  const emphasis=['jacket','pants','snowboard','skis'].includes(category) ? 1 : 0.9;
  return {
    x:Math.round(80+cellWidth*(index%columns+0.5)),
    y:Math.round(80+cellHeight*(Math.floor(index/columns)+0.5)),
    scale:Number(clamp(Math.min(cellWidth/(width+50),cellHeight/(height+50))*emphasis,0.2,1.35).toFixed(3)),
    rotation:total>12 ? 0 : [-5,4,-3,6,0][index%5],
  };
}
function replaceBoardPieces(state,pieces) {
  const board=getBoard(state);
  const normalized=pieces.map((piece,z)=>piece.z===z ? piece : {...piece,z});
  if (board.pieces.length===normalized.length && normalized.every((piece,index)=>BOARD_PIECE_KEYS.every(key=>piece[key]===board.pieces[index][key]))) return state;
  return {...state,board:{...board,pieces:normalized}};
}

export function addBoardPiece(state,garmentId) {
  const garment=state.wardrobe.find(item=>item.id===garmentId);
  const board=getBoard(state);
  if (!garment || board.pieces.length>=300 || board.pieces.some(piece=>piece.garmentId===garmentId)) return state;
  const pieces=orderedPieces(board);
  pieces.push({id:uid('piece'),garmentId,...boardPlacement(pieces.length,pieces.length+1,garment.category),z:pieces.length});
  return replaceBoardPieces(state,pieces);
}
export function addAllWardrobeToBoard(state) {
  const board=getBoard(state);
  const existing=new Set(board.pieces.map(piece=>piece.garmentId));
  const missing=state.wardrobe.filter(garment=>!existing.has(garment.id)).slice(0,300-board.pieces.length);
  if (!missing.length) return state;
  const pieces=orderedPieces(board), total=pieces.length+missing.length;
  for (const garment of missing) {
    pieces.push({id:uid('piece'),garmentId:garment.id,...boardPlacement(pieces.length,total,garment.category),z:pieces.length});
  }
  return replaceBoardPieces(state,pieces);
}
export function updateBoardPiece(state,pieceId,patch) {
  const board=getBoard(state);
  if (!plainObject(patch) || !board.pieces.some(piece=>piece.id===pieceId)) return state;
  const changes={};
  if (finiteNumber(patch.x)) changes.x=clamp(patch.x,0,BOARD_SIZE.width);
  if (finiteNumber(patch.y)) changes.y=clamp(patch.y,0,BOARD_SIZE.height);
  if (finiteNumber(patch.scale)) changes.scale=clamp(patch.scale,0.2,3);
  if (finiteNumber(patch.rotation)) changes.rotation=normalizedRotation(patch.rotation);
  if (!Object.keys(changes).length) return state;
  return replaceBoardPieces(state,orderedPieces(board).map(piece=>piece.id===pieceId ? {...piece,...changes} : piece));
}
export function removeBoardPiece(state,pieceId) {
  const board=getBoard(state);
  if (!board.pieces.some(piece=>piece.id===pieceId)) return state;
  return replaceBoardPieces(state,orderedPieces(board).filter(piece=>piece.id!==pieceId));
}
export function reorderBoardPiece(state,pieceId,direction='front') {
  if (!['front','back'].includes(direction)) return state;
  const pieces=orderedPieces(getBoard(state));
  const index=pieces.findIndex(piece=>piece.id===pieceId);
  if (index<0) return state;
  const [piece]=pieces.splice(index,1);
  if (direction==='front') pieces.push(piece); else pieces.unshift(piece);
  return replaceBoardPieces(state,pieces);
}
export function setBoardBackground(state,background) {
  const board=getBoard(state);
  if (!BOARD_BACKGROUNDS.has(background) || board.background===background) return state;
  return {...state,board:{...board,background}};
}
export function arrangeBoard(state) {
  const pieces=orderedPieces(getBoard(state));
  if (!pieces.length) return state;
  const categories=new Map(state.wardrobe.map(garment=>[garment.id,garment.category]));
  return replaceBoardPieces(state,pieces.map((piece,index)=>({...piece,...boardPlacement(index,pieces.length,categories.get(piece.garmentId))})));
}
function outfitBoard(state,garmentIds,board) {
  const selected=new Set(garmentIds);
  const pieces=orderedPieces(board).filter(piece=>selected.has(piece.garmentId)).map((piece,z)=>({...piece,id:uid('piece'),z}));
  const placed=new Set(pieces.map(piece=>piece.garmentId));
  for (const garmentId of garmentIds) {
    if (placed.has(garmentId)) continue;
    const garment=state.wardrobe.find(entry=>entry.id===garmentId);
    pieces.push({id:uid('piece'),garmentId,...boardPlacement(pieces.length,garmentIds.length,garment.category),z:pieces.length});
  }
  return {background:board.background,pieces};
}
export function saveBoardOutfit(state,{name,garmentIds}={}) {
  if (!Array.isArray(garmentIds) || state.outfits.length>=200) return state;
  const existing=new Set(state.wardrobe.map(garment=>garment.id));
  const selected=[...new Set(garmentIds)].filter(id=>existing.has(id));
  if (!selected.length || selected.length>30) return state;
  const outfit={id:uid('outfit'),name:normalizeText(name,120,'新搭配'),garmentIds:selected,board:outfitBoard(state,selected,getBoard(state))};
  return {...state,outfits:[...state.outfits,outfit]};
}
export function loadOutfitBoard(state,outfitId) {
  const outfit=state.outfits.find(entry=>entry.id===outfitId);
  if (!outfit) return state;
  const selected=outfit.garmentIds.filter(id=>state.wardrobe.some(garment=>garment.id===id));
  if (!selected.length) return state;
  return {...state,board:outfitBoard(state,selected,outfit.board || {background:getBoard(state).background,pieces:[]})};
}
export function removeGarment(state,garmentId) {
  if (!state.wardrobe.some(garment=>garment.id===garmentId)) return state;
  const changed={...state,wardrobe:state.wardrobe.filter(garment=>garment.id!==garmentId),
    outfits:state.outfits.map(outfit=>outfit.garmentIds.includes(garmentId) ? {...outfit,garmentIds:outfit.garmentIds.filter(id=>id!==garmentId),
      ...(outfit.board ? {board:{...outfit.board,pieces:orderedPieces(outfit.board).filter(piece=>piece.garmentId!==garmentId).map((piece,z)=>({...piece,z}))}} : {})} : outfit).filter(outfit=>outfit.garmentIds.length)};
  // Trip items are snapshots: deleting an owned garment must not erase packing history.
  if (!state.board) return changed;
  return replaceBoardPieces(changed,orderedPieces(state.board).filter(piece=>piece.garmentId!==garmentId));
}

const NEUTRALS = new Set(['black','white','gray','navy','beige']);
function pairing(a,b) {
  if (a===b && a!=='multi') return {score:90,reason:'同色系组合，整体更统一。这里只比较颜色，不判断保暖或防护。'};
  if (NEUTRALS.has(a) && NEUTRALS.has(b)) return {score:80,reason:'两件都是中性色，配色比较容易协调。保暖与功能仍需单独确认。'};
  if (NEUTRALS.has(a) || NEUTRALS.has(b)) return {score:70,reason:'用中性色搭一件彩色，主次比较清楚。请按实际天气确认衣物功能。'};
  return {score:a==='multi' || b==='multi' ? 40 : 50,reason:'两件都有明显色彩，可以试试对比搭配；请结合实物确认。配色不代表保暖效果。'};
}
export function suggestOutfits(wardrobe) {
  const jackets = wardrobe.filter(g=>g.category==='jacket');
  const pants = wardrobe.filter(g=>g.category==='pants');
  const suggestions = [];
  for (const jacket of jackets) for (const pant of pants) {
    suggestions.push({garmentIds:[jacket.id,pant.id],...pairing(jacket.color,pant.color)});
  }
  return suggestions.sort((a,b)=>b.score-a.score).slice(0,6);
}

const plainObject = value => value!==null && typeof value==='object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const keysOnly = (value,allowed) => plainObject(value) && Object.keys(value).every(key=>allowed.includes(key));
const list = (value,max) => Array.isArray(value) && value.length<=max;
const validId = id => shortText(id,100) && id===id.trim();
// Cache only successful checks of immutable strings, never mutable state objects.
// This stays within the existing photo budget and releases older photo references.
const validatedPhotos=new Map();let validatedPhotoLength=0;
function validPhoto(value) {
  if(value===undefined || value==='')return true;
  if(typeof value!=='string' || value.length>1500000)return false;
  if(validatedPhotos.has(value))return true;
  if(!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return false;
  while(validatedPhotoLength+value.length>8000000 || validatedPhotos.size>=600){
    const oldest=validatedPhotos.keys().next().value;
    validatedPhotos.delete(oldest);validatedPhotoLength-=oldest.length;
  }
  validatedPhotos.set(value,true);validatedPhotoLength+=value.length;
  return true;
}
const validCutout = (value,photo) => value===undefined || value==='' || (typeof photo==='string' && photo.length>0 && typeof value==='string' && (value.startsWith('data:image/png;base64,') || value.startsWith('data:image/webp;base64,')) && validPhoto(value));
const ITEM_KEYS = ['id','name','category','slot','modes','qty','status','source','wardrobeId','fromOutfit','templateKey','packingLocation'];
function validItem(item,template=false) {
  if (!keysOnly(item,ITEM_KEYS) || !validId(item.id) || !shortText(item.name,120) || !shortText(item.category,40)) return false;
  if (!Number.isInteger(item.qty) || item.qty<1 || item.qty>99 || !own(STATUS_LABELS,item.status)) return false;
  if (!['template','custom','wardrobe'].includes(item.source)) return false;
  // Keep backups portable across catalog updates without accepting arbitrary metadata.
  if (item.templateKey!==undefined && (typeof item.templateKey!=='string' || !/^[a-z][a-z0-9-]{0,63}$/.test(item.templateKey) || item.source==='wardrobe')) return false;
  if (item.slot!==undefined && !own(CATEGORIES,item.slot)) return false;
  if (item.modes!==undefined && (!list(item.modes,2) || item.modes.length<1 || new Set(item.modes).size!==item.modes.length || item.modes.some(mode=>!['snowboard','ski'].includes(mode)))) return false;
  if (own(item,'packingLocation') && (template || item.category==='出发检查' || typeof item.packingLocation!=='string' || !own(PACKING_LOCATIONS,item.packingLocation))) return false;
  if (item.fromOutfit!==undefined && typeof item.fromOutfit!=='boolean') return false;
  if (item.source==='wardrobe') {
    if (template || !validId(item.wardrobeId)) return false;
  } else if (item.wardrobeId!==undefined || item.fromOutfit!==undefined) return false;
  return true;
}
function validBoard(board,garmentIds,reserveId,max=300) {
  if (!keysOnly(board,['background','pieces']) || !BOARD_BACKGROUNDS.has(board.background) || !list(board.pieces,max)) return false;
  const includedGarments=new Set(),layers=new Set();
  for (const piece of board.pieces) {
    if (!keysOnly(piece,BOARD_PIECE_KEYS) || !reserveId(piece.id) || !garmentIds.has(piece.garmentId) || includedGarments.has(piece.garmentId)) return false;
    if (!finiteNumber(piece.x) || piece.x<0 || piece.x>BOARD_SIZE.width || !finiteNumber(piece.y) || piece.y<0 || piece.y>BOARD_SIZE.height) return false;
    if (!finiteNumber(piece.scale) || piece.scale<0.2 || piece.scale>3 || !finiteNumber(piece.rotation) || piece.rotation<-180 || piece.rotation>180) return false;
    if (!Number.isInteger(piece.z) || piece.z<0 || piece.z>=board.pieces.length || layers.has(piece.z)) return false;
    includedGarments.add(piece.garmentId);layers.add(piece.z);
  }
  return true;
}

export function validateState(data) {
  try {
    if (!keysOnly(data,['version','trips','activeTripId','wardrobe','outfits','customTemplates','board']) || data.version!==1) return false;
    if (!list(data.trips,100) || data.trips.length===0 || !list(data.wardrobe,300) || !list(data.outfits,200) || !list(data.customTemplates,300)) return false;
    const allIds = new Set();
    const reserveId = id => { if (!validId(id) || allIds.has(id)) return false; allIds.add(id); return true; };
    let photosLength = 0;
    for (const garment of data.wardrobe) {
      if (!keysOnly(garment,['id','name','category','color','photo','cutout']) || !reserveId(garment.id) || !shortText(garment.name,120) || !own(CATEGORIES,garment.category) || !COLORS.some(c=>c.id===garment.color) || !validPhoto(garment.photo) || !validCutout(garment.cutout,garment.photo)) return false;
      photosLength += (garment.photo?.length || 0)+(garment.cutout?.length || 0);
      if (photosLength>8000000) return false;
    }
    const garmentIds = new Set(data.wardrobe.map(g=>g.id));
    for (const outfit of data.outfits) {
      if (!keysOnly(outfit,['id','name','garmentIds','board']) || !reserveId(outfit.id) || !shortText(outfit.name,120) || !list(outfit.garmentIds,30) || outfit.garmentIds.length===0 || new Set(outfit.garmentIds).size!==outfit.garmentIds.length || outfit.garmentIds.some(id=>!garmentIds.has(id))) return false;
      if (outfit.board!==undefined && (!validBoard(outfit.board,new Set(outfit.garmentIds),reserveId,30) || outfit.board.pieces.length!==outfit.garmentIds.length)) return false;
    }
    if (data.board!==undefined && !validBoard(data.board,garmentIds,reserveId)) return false;
    for (const trip of data.trips) {
      if (!keysOnly(trip,['id','name','sport','overnight','createdAt','items']) || !reserveId(trip.id) || !shortText(trip.name,80) || !SPORTS.has(trip.sport) || typeof trip.overnight!=='boolean' || !shortText(trip.createdAt,40) || !Number.isFinite(Date.parse(trip.createdAt)) || !list(trip.items,600)) return false;
      const includedGarments = new Set();
      for (const item of trip.items) {
        if (!validItem(item) || !reserveId(item.id)) return false;
        if (item.wardrobeId) {
          if (includedGarments.has(item.wardrobeId)) return false;
          includedGarments.add(item.wardrobeId);
        }
      }
    }
    if (!data.trips.some(trip=>trip.id===data.activeTripId)) return false;
    for (const template of data.customTemplates) if (!validItem(template,true) || !reserveId(template.id)) return false;
    return true;
  } catch { return false; }
}
