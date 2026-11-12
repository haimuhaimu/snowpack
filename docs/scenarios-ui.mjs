import {icon} from './icons.mjs?v=alpine-v7.1';
import {SCENARIO_BUNDLES,getScenarioItems,applyScenarioItems} from './scenarios.mjs?v=alpine-v7.1';
import {getActiveTrip} from './core.mjs?v=alpine-v7.1';

export function openScenarioDialog({getState,showModal,closeModal,save,onApplied,esc}) {
  const trip=getActiveTrip(getState()),selections=new Map();
  let current=SCENARIO_BUNDLES[0].id;
  const findItem=(entry,items)=>items.find(item=>item.templateKey===entry.key || item.name.trim().normalize('NFKC').toLowerCase()===entry.name.trim().normalize('NFKC').toLowerCase());
  const render=()=>{
    const bundle=SCENARIO_BUNDLES.find(entry=>entry.id===current);
    const entries=getScenarioItems(trip,current);
    if(!selections.has(current))selections.set(current,new Set(entries.filter(entry=>{const item=findItem(entry,trip.items);return !item || item.status==='skip';}).map(entry=>entry.key)));
    const selected=selections.get(current);
    showModal('按这次，补齐。',`<form id="scenario-form"><p class="small-note">从这次要做的事开始。逐项调整后，只补进当前行程。</p><div class="scenario-tabs" aria-label="选择出行场景">${SCENARIO_BUNDLES.map(entry=>`<button class="scenario-tab ${entry.id===current?'active':''}" type="button" data-scenario="${entry.id}" aria-pressed="${entry.id===current}">${icon({camera:'camera',transit:'ticket',overnight:'moon','day-return':'mountain'}[entry.id],16)}<span>${esc(entry.title)}</span></button>`).join('')}</div><div class="scenario-description"><h3>${esc(bundle.title)}</h3><p>${esc(bundle.description)}</p></div><div class="scenario-list" aria-label="场景装备">${entries.map(entry=>{
      const item=findItem(entry,trip.items),included=Boolean(item && item.status!=='skip');
      return `<label class="catalog-option ${included?'included':''}"><input type="checkbox" name="scenario-item" value="${entry.key}" ${included?'disabled':''} ${selected.has(entry.key)?'checked':''}><span><strong>${esc(entry.name)}</strong>${entry.note?`<small>${esc(entry.note)}</small>`:''}</span><em>${included?'已在清单':item?'恢复待核对':entry.category==='出发检查'?'检查事项':'可选装备'}</em></label>`;
    }).join('')}</div><div class="scenario-footer"><div class="scenario-selection"><span id="scenario-count"></span><button type="button" class="text-button" id="scenario-clear">清空选择</button></div><p class="photo-error" id="scenario-error" role="status" hidden></p><button class="primary full-button" id="scenario-submit" type="submit"></button><p class="form-note">这是可选组合。原有数量和勾选保留，不设为以后每次提醒。</p></div></form>`);
    const form=document.querySelector('#scenario-form');
    const update=()=>{
      form.querySelector('#scenario-count').textContent=`已选 ${selected.size} 项`;
      const button=form.querySelector('#scenario-submit');
      button.textContent=selected.size?`补进本次清单 · ${selected.size} 项`:'当前没有选中的待补项目';
      button.disabled=!selected.size;
    };
    form.addEventListener('click',event=>{
      const tab=event.target.closest('[data-scenario]');
      if(tab){current=tab.dataset.scenario;render();document.querySelector(`[data-scenario="${current}"]`)?.focus();return;}
      if(event.target.closest('#scenario-clear')){selected.clear();form.querySelectorAll('[name="scenario-item"]').forEach(input=>input.checked=false);update();}
    });
    form.addEventListener('change',event=>{
      if(event.target.name!=='scenario-item')return;
      event.target.checked?selected.add(event.target.value):selected.delete(event.target.value);
      update();
    });
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const state=getState(),active=getActiveTrip(state),error=form.querySelector('#scenario-error');
      const fail=message=>{error.textContent=message;error.hidden=false;};
      if(active.id!==trip.id){fail('当前行程已改变，请关闭后重新选择。');return;}
      const next=applyScenarioItems(state,current,[...selected]),updated=getActiveTrip(next);
      const changed=updated.items.filter(item=>!active.items.some(old=>old.id===item.id) || (item.status==='pending' && active.items.some(old=>old.id===item.id && old.status==='skip'))).length;
      if(!changed){fail('未补入项目：所选项可能已经在清单中，或本次清单已满。');return;}
      if(!save(next,`已补入或恢复 ${changed} 项${changed<selected.size?'，其余已在清单或超出容量':''}，请实际装包后核对。`)){fail('未能保存，选择仍保留。可先导出备份或减少照片后重试。');return;}
      closeModal();onApplied();
    });
    update();
  };
  render();
}
