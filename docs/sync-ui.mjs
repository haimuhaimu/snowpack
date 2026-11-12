const PHASE_LABELS={disconnected:'尚未连接',pending:'等待同步',syncing:'正在同步',synced:'已同步',conflict:'需要确认记录',error:'同步暂未完成'};
const DEFAULT_MESSAGES={disconnected:'连接后，在手机和电脑上接着整理。',pending:'本机修改已保留，正在等待同步。',syncing:'正在核对两台设备的记录与照片。',synced:'这台设备已与云端同步。',conflict:'两台设备修改了相同内容，自动合并已暂停。',error:'本机记录仍然保留，请检查网络后重试。'};
const dateLabel=value=>{
  const date=new Date(value);
  return value && Number.isFinite(date.getTime())?date.toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'尚未完成';
};
const BACKUP_REASONS={
  'first-connect-local':'首次连接前 · 本机记录','first-connect-remote':'首次连接时 · 云端记录',
  'conflict-local':'选择前 · 本机记录','conflict-remote':'选择前 · 云端记录',
  'before-restore':'恢复前 · 本机记录',
};
const backupReason=value=>Object.hasOwn(BACKUP_REASONS,value)?BACKUP_REASONS[value]:(typeof value==='string' && value.trim()?value.slice(0,100):'自动保留的记录');

/** The shared app modal owns its shell; this module only updates its own panel. */
export function mountSyncUI({engine,showModal,closeModal,esc,icon,download,onRestoreBackup}) {
  const modal=document.querySelector('#modal'),headerButton=document.querySelector('#sync-button');
  let panel=null,status=engine.getStatus(),busy=false,disposed=false,backupRows=new Map(),backupRequest=0;
  const current=()=>!disposed && panel?.isConnected && modal?.open && panel.dataset.syncModal==='true';
  const field=selector=>current()?panel.querySelector(selector):null;
  const notice=(message,error=false)=>{
    const target=field('[data-sync-notice]');if(!target)return;
    target.textContent=message;target.hidden=!message;target.classList.toggle('is-error',error);
  };

  function clearSecrets() {
    if(!panel)return;
    const input=panel.querySelector('[name="sync-code"]'),fallback=panel.querySelector('[data-sync-code-fallback]');
    if(input)input.value='';
    if(fallback){fallback.querySelector('textarea').value='';fallback.hidden=true;}
  }

  function update(next=engine.getStatus()) {
    if(disposed)return;
    const previousPhase=status?.phase;
    status=next || {phase:'disconnected',connected:false};
    const phase=Object.hasOwn(PHASE_LABELS,status.phase)?status.phase:'error';
    if(headerButton) {
      headerButton.dataset.syncPhase=phase;
      headerButton.setAttribute('aria-label',`设备同步，${PHASE_LABELS[phase]}`);
      headerButton.title=`设备同步 · ${PHASE_LABELS[phase]}`;
    }
    if(!current())return;
    const connected=Boolean(status.connected),syncing=phase==='syncing',conflict=phase==='conflict';
    panel.dataset.syncPhase=phase;
    panel.querySelector('[data-sync-status-title]').textContent=PHASE_LABELS[phase];
    panel.querySelector('[data-sync-status-message]').textContent=status.message || DEFAULT_MESSAGES[phase];
    panel.querySelector('[data-sync-connect]').hidden=connected;
    panel.querySelector('[data-sync-connected]').hidden=!connected;
    panel.querySelector('[data-sync-disconnect]').hidden=!connected;
    panel.querySelector('[data-sync-conflict]').hidden=!conflict;
    panel.querySelector('[data-sync-conflict-message]').textContent=status.message || DEFAULT_MESSAGES.conflict;
    panel.querySelector('[data-sync-last]').textContent=dateLabel(status.lastSynced);
    if(phase==='synced' && previousPhase!==phase && panel.querySelector('[data-sync-notice]').classList.contains('is-error'))notice('');
    panel.querySelector('[name="sync-code"]').disabled=busy;
    panel.querySelector('[data-sync-connect-submit]').disabled=busy;
    for(const button of panel.querySelectorAll('[data-sync-action]')) {
      const action=button.dataset.syncAction;
      button.disabled=busy || (action==='run' && (!connected || syncing || conflict)) || (['copy','disconnect'].includes(action) && !connected);
    }
    if(!connected) {
      const fallback=panel.querySelector('[data-sync-code-fallback]');
      fallback.querySelector('textarea').value='';fallback.hidden=true;
    }
  }

  async function perform(action,{success='',failure='操作暂时未完成，请稍后重试。'}={}) {
    if(busy || disposed)return false;
    busy=true;notice('');update();
    try {
      await action();
      const next=engine.getStatus();update(next);
      if(next.phase==='error'){notice(next.message || failure,true);return false;}
      if(success && next.phase!=='conflict')notice(success);
      return true;
    }catch {
      notice(failure,true);return false;
    }finally {
      busy=false;update();
    }
  }

  async function copyCode() {
    if(busy)return;
    const owner=panel;
    try {
      const code=await engine.getCode();
      if(!current() || panel!==owner)return;
      if(typeof code!=='string' || !code)throw new Error('No code');
      try {
        if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(code);
        if(!current() || panel!==owner)return;
        const fallback=field('[data-sync-code-fallback]');fallback.querySelector('textarea').value='';fallback.hidden=true;
        notice('同步码已复制。请在你自己的另一台设备中粘贴连接。');
      }catch {
        if(!current() || panel!==owner)return;
        const fallback=field('[data-sync-code-fallback]'),textarea=fallback.querySelector('textarea');
        fallback.hidden=false;textarea.value=code;textarea.focus();textarea.select();
        textarea.setSelectionRange(0,code.length);
        notice('浏览器未允许自动复制。同步码已选中，可长按或使用复制菜单。');
      }
    }catch {
      if(current() && panel===owner)notice('暂时无法读取同步码，请稍后重试。',true);
    }
  }

  async function loadBackups() {
    const owner=panel,request=++backupRequest,target=field('[data-sync-backup-list]');
    if(!target)return;
    target.textContent='正在读取本机恢复备份…';
    try {
      const rows=await engine.listBackups();
      if(!current() || panel!==owner || request!==backupRequest)return;
      backupRows=new Map((Array.isArray(rows)?rows:[]).filter(row=>row && typeof row.id==='string' && row.state).map(row=>[row.id,row]));
      field('[data-sync-backup-count]').textContent=backupRows.size?`${backupRows.size} 份`:'';
      if(!backupRows.size){target.innerHTML='<p class="small-note">还没有恢复备份。首次处理两端记录或恢复时会自动保留。</p>';return;}
      target.innerHTML=[...backupRows.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(row=>`<article class="sync-backup"><div class="sync-backup-copy"><h4>${esc(dateLabel(row.createdAt))}</h4><p>${esc(backupReason(row.reason))}</p></div><div class="sync-backup-actions"><button type="button" class="secondary" data-sync-action="download-backup" data-backup-id="${esc(row.id)}" aria-label="下载 ${esc(dateLabel(row.createdAt))} 的恢复备份">${icon('download',16)}下载</button><button type="button" class="text-button" data-sync-action="restore-backup" data-backup-id="${esc(row.id)}" aria-label="恢复 ${esc(dateLabel(row.createdAt))} 的记录">恢复</button></div></article>`).join('');
      update();
    }catch {
      if(current() && panel===owner && request===backupRequest)target.textContent='暂时无法读取本机恢复备份，可以稍后重新读取。';
    }
  }

  async function onAction(event) {
    const button=event.target.closest('[data-sync-action]');
    if(!button || !current() || !panel.contains(button) || button.disabled)return;
    const action=button.dataset.syncAction;
    if(action==='run'){await perform(()=>engine.run());return;}
    if(action==='copy'){await copyCode();return;}
    if(action==='hide-code'){
      const fallback=field('[data-sync-code-fallback]');fallback.querySelector('textarea').value='';fallback.hidden=true;
      field('[data-sync-action="copy"]')?.focus();return;
    }
    if(action==='disconnect') {
      if(!window.confirm('断开这台设备的自动同步？本机记录与云端记录都会保留，另一台设备仍可继续同步。'))return;
      if(await perform(()=>engine.disconnect(),{success:'已断开本机连接，记录仍然保留。'}))clearSecrets();
      return;
    }
    if(action==='resolve-local' || action==='resolve-remote') {
      if(await perform(()=>engine.resolve(action==='resolve-local'?'local':'remote')) && current()) {
        if(field('[data-sync-backups]').open)await loadBackups();
      }
      return;
    }
    if(action==='reload-backups'){await loadBackups();return;}
    const backup=backupRows.get(button.dataset.backupId);
    if(!backup)return;
    if(action==='download-backup') {
      try {
        const date=new Date(backup.createdAt),stamp=Number.isFinite(date.getTime())?date.toISOString().slice(0,19).replaceAll(':','-'):'本机';
        download(JSON.stringify(backup.state,null,2),`雪前-恢复备份-${stamp}.json`);
        notice('已发起下载，备份包含照片，请保存在你自己的文件中。');
      }catch{notice('未能生成备份文件，请稍后重试。',true);}
      return;
    }
    if(action==='restore-backup') {
      if(!window.confirm(`恢复 ${dateLabel(backup.createdAt)} 的记录？当前本机记录会先保存为恢复备份，再换成所选记录；已连接时会继续同步到其他设备。`))return;
      if(await perform(()=>engine.recoverBackup(backup.id),{success:'恢复记录已保存到本机。',failure:'恢复暂时未能完成，请查看同步状态与本机恢复备份。'})) {
        onRestoreBackup?.();
        if(current())await loadBackups();
      }
    }
  }

  function open() {
    if(disposed)return;
    clearSecrets();backupRequest++;backupRows=new Map();
    showModal('设备同步',`<section class="sync-panel" data-sync-modal="true" data-sync-panel>
      <div class="sync-status" role="status" aria-live="polite" aria-atomic="true"><span class="sync-status-icon" aria-hidden="true">${icon('refresh',22)}</span><div><h3 data-sync-status-title></h3><p data-sync-status-message></p></div></div>
      <div data-sync-connect><p class="sync-intro">手机和电脑各连接一次，之后清单、装备照片、画板和搭配就能接着整理。</p>
        <form data-sync-form><div class="field"><label for="sync-code-input">同步码</label><input id="sync-code-input" name="sync-code" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="128" placeholder="粘贴你的专属同步码" aria-describedby="sync-privacy-note" required></div><button type="submit" class="primary full-button" data-sync-connect-submit>连接这台设备</button></form>
        <p class="form-note" id="sync-privacy-note">连接后才会把清单与照片上传到你的私有云空间。同步码就是访问凭据，请只在自己的设备使用；另一台已连接的设备可在这里复制同步码。</p>
      </div>
      <div data-sync-connected hidden><p class="sync-last">上次同步 <span data-sync-last>尚未完成</span></p><div class="sync-main-actions"><button type="button" class="primary" data-sync-action="run">${icon('refresh',17)}立即同步</button><button type="button" class="secondary" data-sync-action="copy">复制同步码</button></div><p class="form-note">本机修改会自动同步。手机和电脑使用同一个同步码，即可访问这份清单与照片。</p>
        <div class="sync-code-fallback" data-sync-code-fallback hidden><label for="sync-code-copy">同步码 · 请只在自己的设备使用</label><textarea id="sync-code-copy" readonly rows="3" spellcheck="false" autocomplete="off" aria-label="可选择复制的同步码"></textarea><button type="button" class="text-button" data-sync-action="hide-code">收起同步码</button></div>
      </div>
      <section class="sync-conflict" data-sync-conflict hidden aria-labelledby="sync-conflict-title"><h3 id="sync-conflict-title">保留哪一份完整记录？</h3><p data-sync-conflict-message></p><p>选择前会先把本机与云端两份记录保存为本机恢复备份。所选整份记录会成为两端的新版本。</p><div class="sync-conflict-actions"><button type="button" class="secondary" data-sync-action="resolve-local">以本机整份记录为准</button><button type="button" class="secondary" data-sync-action="resolve-remote">使用云端整份记录</button></div></section>
      <p class="sync-notice" data-sync-notice role="status" aria-live="polite" hidden></p>
      <details class="sync-backups" data-sync-backups><summary>本机恢复备份 <span data-sync-backup-count></span></summary><p class="form-note">处理两端记录或恢复前自动保留，只存放在这台设备。下载的备份包含照片。</p><div class="sync-backup-list" data-sync-backup-list></div><button type="button" class="text-button" data-sync-action="reload-backups">重新读取备份</button></details>
      <div class="sync-disconnect" data-sync-disconnect><button type="button" class="text-button" data-sync-action="disconnect">断开本机连接</button><p class="small-note">断开后，本机记录仍然保留。</p></div>
    </section>`);
    panel=document.querySelector('#modal-content > [data-sync-modal="true"]');
    if(!panel)return;
    panel.addEventListener('click',onAction);
    panel.querySelector('[data-sync-form]').addEventListener('submit',async event=>{
      event.preventDefault();if(busy || !current())return;
      const input=panel.querySelector('[name="sync-code"]'),code=input.value.trim();
      if(!code){input.focus();return;}
      if(await perform(()=>engine.connect(code),{failure:'连接暂时未完成，请核对同步码和网络后重试。'}))input.value='';
    });
    panel.querySelector('[data-sync-backups]').addEventListener('toggle',event=>{if(event.currentTarget.open)loadBackups();});
    update();
  }

  // Attach once at mount. Reopening creates listeners only on the new panel node.
  if(headerButton){headerButton.innerHTML=`${icon('refresh',20)}<span class="sync-indicator" aria-hidden="true"></span>`;headerButton.addEventListener('click',open);}
  modal?.addEventListener('close',clearSecrets);
  update();
  return {open,update,dispose(){disposed=true;backupRequest++;clearSecrets();headerButton?.removeEventListener('click',open);modal?.removeEventListener('close',clearSecrets);panel=null;backupRows.clear();}};
}
