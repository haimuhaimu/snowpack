import {getActiveTrip,getCatalogItems,addCatalogItems} from './core.mjs?v=alpine-v7.1';

// Optional starting lists. Applying a bundle only adds the items explicitly selected.
export const SCENARIO_BUNDLES=Object.freeze([
  {
    id:'camera',title:'Insta360 拍摄',
    description:'拍摄与试录的可选起步清单，按自己的机型和拍摄计划选择。',
    keys:['insta360-camera','camera-battery','camera-card','camera-pole','camera-mount','camera-cover','lens-cloth','camera-power-check','camera-space-check','camera-record-check','camera-cable'],
  },
  {
    id:'transit',title:'交通与租借',
    description:'装备运输、行程凭证与预约核对，按本次交通和租借安排选择。',
    keys:['board-bag','boot-bag','travel-ticket','luggage-tag','rental-booking','booking-check','travel-check'],
  },
  {
    id:'overnight',title:'过夜与换洗',
    description:'住宿、换洗和备用穿戴，按这次需要补充。',
    keys:['underwear','spare-socks','casual-clothes','toiletries','charger','wet-dry-bag','spare-ski-socks','spare-gloves'],
  },
  {
    id:'day-return',title:'滑后与返程',
    description:'换鞋、湿物分装与返程补给，按实际需要选择。',
    keys:['after-ski-shoes','wet-dry-bag','equipment-wipe','changing-mat','return-snacks'],
  },
].map(bundle=>Object.freeze({...bundle,keys:Object.freeze(bundle.keys)})));

export function getScenarioItems(trip,scenarioId) {
  const bundle=SCENARIO_BUNDLES.find(candidate=>candidate.id===scenarioId);
  if (!bundle) return [];
  const available=new Map(getCatalogItems(trip).map(entry=>[entry.key,entry]));
  return bundle.keys.map(key=>available.get(key)).filter(Boolean);
}

export function applyScenarioItems(state,scenarioId,selectedKeys=[]) {
  if (!Array.isArray(selectedKeys) || selectedKeys.length===0) return state;
  const selected=new Set(selectedKeys);
  const keys=getScenarioItems(getActiveTrip(state),scenarioId)
    .filter(entry=>selected.has(entry.key)).map(entry=>entry.key);
  return keys.length ? addCatalogItems(state,keys,{remember:false}) : state;
}
