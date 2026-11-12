import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoardHistory,recordBoardChange,travelBoardHistory,makeStatusUndo,undoItemStatus} from '../docs/history.mjs';

const sample=()=>({activeTripId:'trip',trips:[{id:'trip',items:[{id:'gel',qty:2,status:'pending'}]}],wardrobe:[{id:'jacket',photo:'original'}],board:{background:'paper',pieces:[{id:'piece',garmentId:'jacket',x:100,y:100,scale:1,rotation:0,z:0}]}});
test('board undo only restores layout, retaining newer item and photo edits',()=>{
 const a=sample(),b=structuredClone(a);b.board.pieces[0].x=400;
 const history=recordBoardChange(createBoardHistory(),a,b);b.trips[0].items[0].qty=4;b.wardrobe[0].photo='new photo';
 const undone=travelBoardHistory(history,b,'undo');
 assert.equal(undone.state.board.pieces[0].x,100);assert.equal(undone.state.trips[0].items[0].qty,4);assert.equal(undone.state.wardrobe[0].photo,'new photo');
 const redone=travelBoardHistory(undone.history,undone.state,'redo');assert.equal(redone.state.board.pieces[0].x,400);assert.equal(b.board.pieces[0].x,400);
});
test('new board change clears redo; unrelated changes do not create history',()=>{
 const a=sample(),b=structuredClone(a);b.board.background='ice';
 let history=recordBoardChange(createBoardHistory(),a,b);const undone=travelBoardHistory(history,b,'undo');
 const c=structuredClone(undone.state);c.board.background='dark';history=recordBoardChange(undone.history,undone.state,c);
 assert.equal(travelBoardHistory(history,c,'redo'),null);assert.equal(recordBoardChange(history,c,{...c,trips:[]}),history);
});
test('board undo refuses stale state and removed garment references',()=>{
 const a=sample(),b=structuredClone(a);b.board.pieces=[];const history=recordBoardChange(createBoardHistory(),a,b);
 assert.equal(travelBoardHistory(history,{...b,wardrobe:[]},'undo'),null);
 assert.equal(travelBoardHistory(history,{...b,board:{...b.board,background:'dark'}},'undo'),null);
});
test('status undo preserves unrelated state and restores rental intent',()=>{
 const a=sample();a.trips[0].items[0].status='rental';const b=structuredClone(a);b.trips[0].items[0].status='packed';
 const action=makeStatusUndo(a,b,'gel');b.board.background='dark';const restored=undoItemStatus(b,action);
 assert.equal(restored.trips[0].items[0].status,'rental');assert.equal(restored.board.background,'dark');assert.equal(b.trips[0].items[0].status,'packed');
});
test('status undo cannot overwrite later quantity/status edit or another active trip',()=>{
 const a=sample(),b=structuredClone(a);b.trips[0].items[0].status='packed';const action=makeStatusUndo(a,b,'gel');
 const changed=structuredClone(b);changed.trips[0].items[0].qty=4;assert.equal(undoItemStatus(changed,action),null);
 assert.equal(undoItemStatus({...b,activeTripId:'other'},action),null);assert.equal(undoItemStatus(a,action),null);
});
