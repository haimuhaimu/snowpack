import {createInitialState,validateState} from './core.mjs';

const ASSET_REF=/^asset:([a-f0-9]{64})$/;
const PHOTO=/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const PHOTO_LIMIT=1500000,PHOTO_BUDGET=8000000;
const PLACEHOLDER='data:image/png;base64,AA==';
const PHOTO_FIELDS=['photo','cutout'];
const FORBIDDEN_KEYS=new Set(['__proto__','prototype','constructor']);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const clone=value=>structuredClone(value);

// Check descriptors before touching values so remote metadata cannot invoke getters.
// This also rejects values that JSON would silently drop or change when persisted.
function pureJSON(value) {
  const ancestors=new Set();let nodes=0;
  function visit(current,depth) {
    if(++nodes>2000000 || depth>64)return false;
    if(current===null || typeof current==='string' || typeof current==='boolean')return true;
    if(typeof current==='number')return Number.isFinite(current);
    if(typeof current!=='object' || ancestors.has(current))return false;
    const array=Array.isArray(current),prototype=Object.getPrototypeOf(current);
    if(array ? prototype!==Array.prototype : prototype!==Object.prototype && prototype!==null)return false;
    if(Object.getOwnPropertySymbols(current).length)return false;
    const descriptors=Object.getOwnPropertyDescriptors(current),keys=Object.keys(descriptors);
    if(array && (keys.length!==current.length+1 || !own(descriptors,'length')))return false;
    ancestors.add(current);
    for(const key of keys) {
      if(array && key==='length')continue;
      const descriptor=descriptors[key];
      if(FORBIDDEN_KEYS.has(key) || !own(descriptor,'value') || !descriptor.enumerable)return false;
      if(array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key)>=current.length))return false;
      if(!visit(descriptor.value,depth+1))return false;
    }
    ancestors.delete(current);return true;
  }
  try{return visit(value,0);}catch{return false;}
}

const validState=value=>pureJSON(value) && validateState(value);
async function digest(value) {
  if(!globalThis.crypto?.subtle)throw new Error('当前浏览器无法安全校验同步照片，请使用 HTTPS 页面。');
  const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}

/** Separate immutable photo assets from metadata without changing the v1 backup schema. */
export async function splitState(state) {
  if(!validState(state))throw new Error('本机记录格式不完整，未上传。');
  const snapshot=clone(state),assets=new Map(),hashes=new Map();
  for(const garment of snapshot.wardrobe)for(const field of PHOTO_FIELDS) {
    const photo=garment[field];if(!photo)continue;
    let hash=hashes.get(photo);
    if(!hash){hash=await digest(photo);hashes.set(photo,hash);assets.set(hash,photo);}
    garment[field]=`asset:${hash}`;
  }
  return {snapshot,assets};
}

/** Check metadata structure. Actual image formats and budgets are checked on hydration. */
export function validateSnapshot(snapshot) {
  try {
    if(!pureJSON(snapshot) || !Array.isArray(snapshot?.wardrobe))return false;
    const check=clone(snapshot);
    for(const garment of check.wardrobe)for(const field of PHOTO_FIELDS) {
      if(!own(garment,field) || garment[field]==='')continue;
      if(typeof garment[field]!=='string' || !ASSET_REF.test(garment[field]))return false;
      garment[field]=PLACEHOLDER;
    }
    return validateState(check);
  }catch{return false;}
}

/** Restore assets, verify their content hashes, and re-run the full local-state validator. */
export async function hydrateState(snapshot,loadAsset) {
  if(!validateSnapshot(snapshot) || typeof loadAsset!=='function')throw new Error('云端记录格式不完整，本机记录未改动。');
  const state=clone(snapshot),assets=new Map();let photoLength=0;
  for(const garment of state.wardrobe)for(const field of PHOTO_FIELDS) {
    if(!garment[field])continue;
    const hash=ASSET_REF.exec(garment[field])[1];
    let photo=assets.get(hash);
    if(photo===undefined) {
      photo=await loadAsset(hash);
      if(typeof photo!=='string' || photo.length>PHOTO_LIMIT || !PHOTO.test(photo))throw new Error('云端照片缺失或格式不正确，本机记录未改动。');
      if(await digest(photo)!==hash)throw new Error('云端照片校验不一致，本机记录未改动。');
      assets.set(hash,photo);
    }
    // Count references, not unique assets: the local state still embeds every photo.
    photoLength+=photo.length;
    if(photoLength>PHOTO_BUDGET)throw new Error('云端照片超过当前浏览器记录的容量限制，本机记录未改动。');
    garment[field]=photo;
  }
  if(!validState(state))throw new Error('云端记录或照片不完整，本机记录未改动。');
  return state;
}

const ABSENT=Symbol('absent');
const valueAt=(value,key)=>own(value,key)?value[key]:ABSENT;
const copyValue=value=>value===ABSENT?ABSENT:clone(value);
const escapePath=value=>String(value).replaceAll('~','~0').replaceAll('/','~1');
function equal(a,b) {
  if(a===b)return true;
  if(a===ABSENT || b===ABSENT || a===null || b===null || typeof a!=='object' || typeof b!=='object')return false;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  const aKeys=Object.keys(a),bKeys=Object.keys(b);
  return aKeys.length===bKeys.length && aKeys.every(key=>own(b,key) && equal(a[key],b[key]));
}
const collectionKinds={trips:'trip',wardrobe:'garment',outfits:'outfit',customTemplates:'item'};
const labels={trips:'行程',items:'清单项目',wardrobe:'装备',outfits:'搭配',customTemplates:'常用装备',name:'名称',color:'颜色',category:'类别',sport:'板型',overnight:'过夜设置',packingLocation:'收纳位置',board:'画板布局',garmentIds:'搭配单品'};

/** Three-way merge. Conflicts always return null; callers retain both source snapshots. */
export function mergeStates(base,local,remote) {
  const conflicts=[];
  const conflict=(path,label)=>{if(!conflicts.some(entry=>entry.path===path))conflicts.push({path,label});return ABSENT;};
  if(![base,local,remote].every(validState))return {state:null,conflicts:[{path:'/',label:'记录格式不完整'}]};

  function atomic(before,here,there,path,label) {
    if(equal(here,there))return copyValue(here);
    if(equal(here,before))return copyValue(there);
    if(equal(there,before))return copyValue(here);
    return conflict(path,label);
  }
  function record(before,here,there,path,kind) {
    const result={},groups=kind==='item'?[{keys:['qty','status'],label:'数量与装包状态'}]:kind==='garment'?[{keys:PHOTO_FIELDS,label:'原照片与抠图'}]:[];
    const grouped=new Set(groups.flatMap(group=>group.keys));
    for(const {keys,label} of groups) {
      const select=value=>Object.fromEntries(keys.filter(key=>own(value,key)).map(key=>[key,value[key]]));
      const merged=atomic(select(before),select(here),select(there),`${path}/${keys.join('+')}`,label);
      if(merged!==ABSENT)Object.assign(result,merged);
    }
    for(const key of new Set([...Object.keys(before),...Object.keys(here),...Object.keys(there)])) {
      if(grouped.has(key) || kind==='state' && key==='activeTripId')continue;
      const nextPath=`${path}/${escapePath(key)}`,label=labels[key] || '记录字段';
      const a=valueAt(before,key),b=valueAt(here,key),c=valueAt(there,key);
      const childKind=kind==='state'?collectionKinds[key]:kind==='trip' && key==='items'?'item':null;
      const merged=childKind?collection(a,b,c,nextPath,childKind,label):atomic(a,b,c,nextPath,label);
      if(merged!==ABSENT)result[key]=merged;
    }
    return result;
  }
  function entity(before,here,there,path,kind,label) {
    if(equal(here,there))return copyValue(here);
    if(equal(here,before))return copyValue(there);
    if(equal(there,before))return copyValue(here);
    // Deletion vs editing and different additions with the same ID have no safe winner.
    if(before===ABSENT || here===ABSENT || there===ABSENT)return conflict(path,`${label}删除或修改冲突`);
    return record(before,here,there,path,kind);
  }
  function collection(before,here,there,path,kind,label) {
    if(equal(here,there))return clone(here);
    if(equal(here,before))return clone(there);
    if(equal(there,before))return clone(here);
    const index=rows=>new Map(rows.map(row=>[row.id,row]));
    const a=index(before),b=index(here),c=index(there),result=[];
    // Keep local display order, then append remote additions. Layout ordering is atomic.
    for(const id of new Set([...b.keys(),...c.keys(),...a.keys()])) {
      const merged=entity(a.get(id)??ABSENT,b.get(id)??ABSENT,c.get(id)??ABSENT,`${path}/${escapePath(id)}`,kind,label);
      if(merged!==ABSENT)result.push(merged);
    }
    return result;
  }

  const state=record(base,local,remote,'','state');
  const tripIds=new Set(state.trips.map(trip=>trip.id));
  state.activeTripId=tripIds.has(local.activeTripId)?local.activeTripId:remote.activeTripId;
  if(!tripIds.has(state.activeTripId))conflict('/activeTripId','当前行程已被两端修改或删除');
  if(!conflicts.length && !validState(state))conflict('/','合并后的容量或装备引用不完整');
  return {state:conflicts.length?null:state,conflicts};
}

/** A generated starter checklist may be replaced on first connection; edited records may not. */
export function isPristineState(state) {
  if(!validState(state) || state.trips.length!==1 || state.wardrobe.length || state.outfits.length || state.customTemplates.length || own(state,'board'))return false;
  const withoutGeneratedIdentity=trip=>{
    const {id,createdAt,items,...fields}=trip;
    return {...fields,items:items.map(({id,...item})=>item)};
  };
  return equal(withoutGeneratedIdentity(state.trips[0]),withoutGeneratedIdentity(createInitialState().trips[0]));
}
