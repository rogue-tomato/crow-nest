'use strict';
/* UI only. Cloud owns the durable game state and delivery queue. */
(() => {
  if (!window.CROW_SERVER?.enabled) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'account-dialog';
  dialog.dataset.cloudUi = 'true';
  dialog.setAttribute('aria-labelledby', 'account-title');
  document.body.append(dialog);
  const initialLocal = JSON.parse(ser(PARTY));
  let view = 'home', message = '', isError = false, busy = false;
  let characters = [], adventures = [], code = null;
  const cloud = () => window.Cloud;
  const state = () => cloud()?.state || {};
  const needsSignIn = () => !state().user || !state().authenticated;
  const button = (action, title, extra = '') => `<button type="button" class="btn" data-account="${action}" ${extra}>${title}</button>`;
  const statusHTML = () => `<span class="account-status" data-status="${esc(state().status || 'Connecting')}"><strong>${esc(state().status || 'Connecting')}</strong>${state().pending ? ` · ${esc(state().pending)} pending` : ''}</span>`;
  const active = () => state().snapshot;
  const rows = result => Array.isArray(result) ? result : result?.characters || result?.adventures || [];
  async function request(path, body, method = 'POST') {
    const r = await fetch(path, {method, credentials:'same-origin', headers: body === undefined ? {} : {'Content-Type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body)});
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || data.error?.message || (typeof data.error === 'string' ? data.error : 'The request could not be completed.'));
    return data;
  }
  async function loadLists() {
    if (!state().user) return;
    const [cs, as] = await Promise.all([request('/api/characters', undefined, 'GET'), request('/api/adventures', undefined, 'GET')]);
    characters = rows(cs); adventures = rows(as);
  }
  function info(text, error = false) { message = text; isError = error; draw(); }
  function userName() { return state().user?.name || 'Account'; }
  function authHTML() {
    if (view === 'reset') return `<form class="account-form" data-account-form="reset"><h3>Choose a new password</h3><label>New password<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><button class="btn primary">Reset password</button></form>`;
    if (view === 'recover') return `<form class="account-form" data-account-form="recover"><h3>Recover your account</h3><p class="muted">We will email a link to reset your password.</p><label>Email<input name="email" type="email" autocomplete="email" required></label><button class="btn primary">Send recovery link</button>${button('signin', 'Back to sign in')}</form>`;
    const signup = view === 'signup';
    return `<div class="account-grid"><div><h3>${signup ? 'Make a place at the table' : 'Your crows, wherever you play'}</h3><p class="muted">Keep your characters and adventures on the server. Your table can continue when the Referee goes offline.</p><p class="small muted">Existing characters on this device stay here until you choose which ones to import.</p></div><form class="account-form" data-account-form="${signup ? 'signup' : 'signin'}">${signup ? '<label>Name<input name="name" autocomplete="name" maxlength="100" required></label>' : ''}<label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="${signup ? 12 : 1}" maxlength="128" required></label><button class="btn primary">${signup ? 'Create account' : 'Sign in'}</button><div class="account-actions">${button(signup ? 'signin' : 'signup', signup ? 'I have an account' : 'Create account')}${!signup ? button('recover', 'Forgot password?') : ''}</div></form></div>`;
  }
  function characterName(c) { return c.body?.name || c.data?.name || c.name || 'Unnamed crow'; }
  function homeHTML() {
    const snapshot = active(), adv = snapshot?.adventure, personal = state().adventureId?.startsWith('character:');
    const title = adv?.name || adv?.title || adventures.find(a => a.id === state().adventureId)?.title || 'Current adventure';
    const role = snapshot?.role || adv?.role;
    return `<div class="account-lead"><div><h3>${esc(userName())}</h3><span class="small muted">${esc(state().user.email || '')}</span></div><div class="account-actions">${button('settings', 'Manage account')}${button('signout', 'Sign out')}</div></div>
      <section class="account-section"><div class="account-lead"><h3>${state().adventureId ? esc(title) : 'Your table'}</h3>${statusHTML()}</div>
      ${state().error ? `<div class="account-message error">${esc(state().error.message || state().error)}<div class="account-actions">${button('retry', 'Try again')}${button('queue', 'Review pending changes')}</div></div>` : ''}
      ${state().adventureId ? `<p class="small muted">${personal ? 'This character is saved to your account.' : 'Adventure progress is kept separately from your saved character.'}</p><div class="account-actions">${button('continue', 'Continue playing')}${role === 'referee' || role === 'ref' ? button('start', 'Start a play session') : ''}${button('close-adventure', 'Leave this view')}${button('queue', 'Sync details')}</div>${code ? `<div class="account-message"><span class="small muted">Session code · ${esc(code.expiresAt ? 'expires '+new Date(code.expiresAt).toLocaleString() : 'share with your players')}</span><div class="account-code">${esc(code.code)}</div></div>` : ''}${!personal && role==='referee' && snapshot?.session && !snapshot.session.endedAt ? button('end','End session') : ''}` : '<p class="muted">Join a play session or open one of your adventures below.</p>'}
      </section><div class="account-grid"><section class="account-section"><h3>Join a session</h3><form class="account-form" data-account-form="join"><label>Session code<input name="code" autocomplete="off" autocapitalize="characters" maxlength="24" required></label><label>Your character<select name="characterId" required><option value="">Choose a crow</option>${characters.map(c=>`<option value="${esc(c.id)}">${esc(characterName(c))}</option>`).join('')}</select></label><button class="btn primary" ${characters.length ? '' : 'disabled'}>Join with this crow</button></form><p class="small muted">Only the selected character joins this adventure.</p></section><section class="account-section"><h3>Your adventures</h3><div class="account-list">${adventures.length ? adventures.map(a=>`<div class="account-row"><div><strong>${esc(a.title || a.name || 'Adventure')}</strong><span class="muted small">${esc(a.role || 'Member')}</span></div>${button('open-adventure','Open',`data-id="${esc(a.id)}"`)}</div>`).join('') : '<p class="muted">No adventures yet.</p>'}</div><form class="account-form" data-account-form="adventure"><label>New adventure<input name="title" maxlength="120" placeholder="Adventure name" required></label><button class="btn">Create as Referee</button></form></section></div>
      ${!personal&&role==='referee'&&snapshot?.participants?.length ? `<section class="account-section"><h3>Players</h3><div class="account-list">${snapshot.participants.filter(p=>p.accountId!==state().user.id).map(p=>`<div class="account-row"><div><strong>${esc(snapshot.entities[p.entityKey]?.data?.name||'Player')}</strong><span class="small muted">${snapshot.presence?.some(x=>x.accountId===p.accountId)?'Online':'Offline'}</span></div>${button('revoke-member','Revoke access',`data-id="${esc(p.accountId)}"`)}</div>`).join('')}</div></section>`:''}<section class="account-section"><div class="account-lead"><h3>Your characters</h3><div class="account-actions">${button('new-character','Create character')}${button('import','Import from this device')}</div></div><div class="account-list">${characters.length ? characters.map(c=>`<div class="account-row"><div><strong>${esc(characterName(c))}</strong><span class="muted small">Saved to your account</span></div>${button('open-character','Open',`data-id="${esc(c.id)}"`)}</div>`).join('') : '<p class="muted">Create a crow, or import one that belongs to you.</p>'}</div></section>`;
  }
  function settingsHTML() {
    return `${button('home','← Back to table')}<div class="account-grid account-section"><form class="account-form" data-account-form="profile"><h3>Profile</h3><label>Name<input name="name" value="${esc(userName())}" maxlength="100" required></label><button class="btn primary">Save name</button></form><form class="account-form" data-account-form="password"><h3>Change password</h3><label>Current password<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>New password<input name="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><button class="btn">Change password</button></form></div><section class="account-section"><form class="account-form" data-account-form="email"><h3>Email</h3><label>New email<input name="newEmail" type="email" autocomplete="email" required></label><button class="btn">Request email change</button><p class="small muted">Follow the confirmation emails to complete the change.</p></form></section><section class="account-section"><h3>Other devices</h3><p class="muted">Sign out other devices. Their pending changes will wait until you sign in again.</p>${button('revoke','Sign out other devices')}</section>`;
  }
  function importHTML() {
    const local = cloud().legacyCharacters ? cloud().legacyCharacters() : initialLocal;
    return `${button('home','← Back to table')}<section class="account-section"><h3>Choose your characters</h3><p class="muted">A previous shared table may have left other players’ crows on this device. Select only characters that belong to you.</p><p class="small muted">A local backup is kept before import. The original saves are preserved.</p><form class="account-form" data-account-form="import"><div class="account-list">${local.length ? local.map((c,k)=>`<label class="account-row account-import-label"><input type="checkbox" name="selected" value="${k}"><span><strong>${esc(c.name || 'Unnamed crow')}</strong><span class="muted small">${esc(c.bg || '')}</span></span></label>`).join('') : '<p>No local characters to import.</p>'}</div><button class="btn primary" ${local.length?'':'disabled'}>Import selected characters</button></form></section>`;
  }
  function queueHTML() {
    const operations = (cloud().operations?.() || []).map(row=>({...row,operationId:row.op?.operationId||row.operationId,type:row.op?.type||row.type,status:row.state||row.status,error:row.code||row.error}));
    return `${button('home','← Back to table')}<section class="account-section"><h3>Sync details</h3>${statusHTML()}<p class="muted">Changes are saved on this device before sending. Shared item transfers wait for the server. Discarding a blocked change also removes following dependent changes.</p><div class="account-actions">${button('retry','Try again')}${button('export-queue','Download pending changes')}</div><div class="account-list">${Array.isArray(operations) && operations.length ? operations.map(o=>`<div class="account-row"><div><strong>${esc(o.label || o.type || o.operation?.type || 'Pending change')}</strong><span class="small muted">${esc(cloud().describeConflict?.(o.error?.message || o.error || o.status) || o.error?.message || o.error || o.status || 'Waiting to sync')}</span></div>${o.status==='conflict'||o.error||state().error ? button('discard','Discard this change',`data-id="${esc(o.operationId || o.operation?.operationId)}"`) : ''}</div>`).join('') : '<p class="muted">No pending changes in this view.</p>'}</div><p class="small muted">Deleting browser storage removes changes that have not reached the server. Download pending changes before clearing storage.</p></section>`;
  }
  function draw() {
    if (!dialog.open) return;
    const title = needsSignIn() ? (view==='signup'?'Create account':view==='recover'?'Recover access':view==='reset'?'Reset password':'Account') : view==='settings'?'Your account':view==='import'?'Import characters':view==='queue'?'Sync details':'Account & Table';
    dialog.innerHTML = `<header class="account-head"><h2 id="account-title">${title}</h2><button type="button" class="ibtn" data-account="dismiss" aria-label="Close account">✕</button></header><div class="account-body" ${busy?'aria-busy="true"':''}>${message?`<div role="status" class="account-message ${isError?'error':''}">${esc(message)}</div>`:''}${view==='queue'?queueHTML():needsSignIn()||view==='reset'?authHTML()+(state().pending?`<section class="account-section">${statusHTML()}<p>Your pending changes are still saved on this device.</p>${button('queue','Review pending changes')}</section>`:''):view==='settings'?settingsHTML():view==='import'?importHTML():homeHTML()}</div>`;
    if (busy) dialog.querySelectorAll('button:not([data-account=dismiss]),input,select').forEach(b=>b.disabled=true);
  }
  async function run(fn) {
    if (busy) return;
    busy=true; message=''; isError=false;
    const focused=document.activeElement;
    dialog.querySelectorAll('button:not([data-account=dismiss]),input,select').forEach(b=>b.disabled=true);
    try { await fn(); } catch(e) { message=e.message || 'Please try again.'; isError=true; }
    finally { busy=false; draw(); if(focused?.name)dialog.querySelector(`[name="${focused.name}"]`)?.focus(); }
  }
  async function open() {
    await cloud().ready;
    view='home'; message='';
    if(!dialog.open)dialog.showModal(); draw();
    await run(async()=>{try{await cloud().refreshAccount();}catch(e){if(e.status!==401)throw e;}if(state().user)await loadLists();});
  }
  dialog.addEventListener('click',e=>{
    const b=e.target.closest('[data-account]'); if(!b)return;
    const action=b.dataset.account;
    if(action==='dismiss'||action==='continue')return dialog.close();
    if(['home','settings','signup','signin','recover','import','queue'].includes(action)){view=action;message='';draw();return;}
    run(async()=>{
      if(action==='retry'){await cloud().retry();await loadLists();}
      if(action==='signout'){await request('/api/auth/sign-out',{});await cloud().logout();characters=[];adventures=[];view='home';}
      if(action==='revoke-member'){await request('/api/adventures/'+encodeURIComponent(state().adventureId)+'/members/'+encodeURIComponent(b.dataset.id),undefined,'DELETE');message='Player access revoked.';}
      if(action==='revoke'){await request('/api/auth/revoke-other-sessions',{});message='Other devices have been signed out.';}
      if(action==='open-adventure'){await cloud().openAdventure(b.dataset.id);code=null;dialog.close();}
      if(action==='close-adventure'){await cloud().closeAdventure();code=null;}
      if(action==='open-character'){await cloud().openCharacter(b.dataset.id);dialog.close();}
      if(action==='new-character'){await cloud().closeAdventure();dialog.close();A['new-crow']({dataset:{}});}
      if(action==='start'){const result=await cloud().startSession(state().adventureId);if(result?.pending){message='Session request saved locally. Reconnect and try again to see its code.';}else{code=result;await cloud().openAdventure(state().adventureId);}}
      if(action==='end'){const result=await cloud().endSession();if(result?.pending){message='The request to end the session is saved locally. It will be confirmed after reconnecting.';}else{code=null;await cloud().openAdventure(state().adventureId);message='Session ended. Adventure progress is saved.';}}
      if(action==='discard'){await cloud().discardConflict(b.dataset.id);message='The pending change was discarded. Server progress is unchanged.';}
      if(action==='export-queue'){
        const blob=new Blob([JSON.stringify(await cloud().exportQueue(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='crow-nest-pending.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    });
  });
  dialog.addEventListener('submit',e=>{
    const form=e.target.closest('[data-account-form]');if(!form)return;e.preventDefault();
    const data=Object.fromEntries(new FormData(form)); const action=form.dataset.accountForm;
    run(async()=>{
      if(action==='signin'){await request('/api/auth/sign-in/email',{email:data.email,password:data.password});await cloud().refreshAccount();await loadLists();view='home';}
      if(action==='signup'){await request('/api/auth/sign-up/email',{name:data.name,email:data.email,password:data.password,callbackURL:location.origin+'/'});view='signin';message='Check your email to verify your account, then sign in.';}
      if(action==='recover'){await request('/api/auth/request-password-reset',{email:data.email,redirectTo:location.origin+'/?reset=1'});message='If an account exists for that email, a recovery link is on its way.';}
      if(action==='reset'){const token=new URLSearchParams(location.search).get('token');await request('/api/auth/reset-password',{token,newPassword:data.password});history.replaceState(null,'',location.pathname);view='signin';message='Password reset. Sign in with your new password.';}
      if(action==='profile'){await request('/api/auth/update-user',{name:data.name});await cloud().refreshAccount();message='Name saved.';}
      if(action==='email'){await request('/api/auth/change-email',{newEmail:data.newEmail,callbackURL:location.origin+'/'});message='Check your email to approve and verify the new address.';}
      if(action==='password'){await request('/api/auth/change-password',{...data,revokeOtherSessions:true});message='Password changed. Other devices have been signed out.';}
      if(action==='adventure'){const a=await cloud().createAdventure(data.title);if(a?.pending){message='Adventure request saved locally. Reconnect, then open it from Your adventures.';}else{await loadLists();await cloud().openAdventure(a.adventure?.id||a.id);}}
      if(action==='join'){const joined=await cloud().joinSession(data.code.trim().toUpperCase(),data.characterId);if(joined?.pending){message='Join request saved locally. Your place at the table needs server confirmation.';}else{if(joined?.adventure?.id&&state().adventureId!==joined.adventure.id)await cloud().openAdventure(joined.adventure.id);await loadLists();dialog.close();}}
      if(action==='import'){
        const selected=new FormData(form).getAll('selected'),local=cloud().legacyCharacters?cloud().legacyCharacters():initialLocal;
        if(!selected.length)throw new Error('Choose at least one character that belongs to you.');
        for(const k of selected)await cloud().importCharacter(local[+k],{sourceId:local[+k].id});
        await loadLists();view='home';message=`${selected.length} character${selected.length===1?'':'s'} imported. Original saves are preserved.`;
      }
    });
  });
  document.addEventListener('click',e=>{if(e.target.closest('#netbtn,[data-action=net],#cloud-status')){e.preventDefault();e.stopImmediatePropagation();open();}},true);
  const statusButton=document.createElement('button');statusButton.id='cloud-status';statusButton.className='tbtn';statusButton.setAttribute('aria-label','Account and sync status');document.querySelector('#top')?.append(statusButton);
  function updateStatus(){statusButton.innerHTML=statusHTML();const label=document.querySelector('#netbtn .lbl');if(label)label.textContent='Account';if(dialog.open&&!busy&&!dialog.contains(document.activeElement))draw();}
  document.addEventListener('cloudchange',updateStatus);
  window.AccountUI={open,refresh:loadLists};
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/cloud-worker.js').catch(()=>{toast('Offline reopening is unavailable. Keep this tab open while offline.');});
  Promise.resolve(cloud()?.ready).then(()=>{updateStatus();const q=new URLSearchParams(location.search);if(q.get('token')&&q.get('reset')){view='reset';dialog.showModal();draw();}});
})();
