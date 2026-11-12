// Transient, scoped history: never keep copies of photos or roll back unrelated records.
const boardOf=state=>state.board??{background:'paper',pieces:[]};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const createBoardHistory=()=>({past:[],future:[]});
export function recordBoardChange(history,before,after){
 const a=boardOf(before),b=boardOf(after);
 if(same(a,b))return history;
 return {past:[...history.past,{before:structuredClone(a),after:structuredClone(b)}].slice(-40),future:[]};
}
export function travelBoardHistory(history,state,direction){
 if(!['undo','redo'].includes(direction))return null;
 const undo=direction==='undo',entry=(undo?history.past:history.future).at(-1);
 if(!entry||!same(boardOf(state),undo?entry.after:entry.before))return null;
 const board=undo?entry.before:entry.after,ids=new Set(state.wardrobe.map(g=>g.id));
 if(board.pieces.some(p=>!ids.has(p.garmentId)))return null;
 return {state:{...state,board:structuredClone(board)},history:undo?{past:history.past.slice(0,-1),future:[...history.future,entry]}:{past:[...history.past,entry],future:history.future.slice(0,-1)}};
}
export function makeStatusUndo(before,after,itemId){
 const tripId=before.activeTripId;
 const a=before.trips.find(t=>t.id===tripId)?.items.find(i=>i.id===itemId);
 const b=after.trips.find(t=>t.id===tripId)?.items.find(i=>i.id===itemId);
 return a&&b&&a.status!==b.status?{tripId,itemId,before:a.status,after:b.status,qty:b.qty}:null;
}
export function undoItemStatus(state,action){
 if(!action||state.activeTripId!==action.tripId)return null;
 const item=state.trips.find(t=>t.id===action.tripId)?.items.find(i=>i.id===action.itemId);
 if(!item||item.status!==action.after||item.qty!==action.qty)return null;
 return {...state,trips:state.trips.map(t=>t.id===action.tripId?{...t,items:t.items.map(i=>i.id===action.itemId?{...i,status:action.before}:i)}:t)};
}
