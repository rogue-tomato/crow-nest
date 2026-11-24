'use strict';
/* CROW NEST — before the game (owner, 2026-11-24; QA/2026-11-24-ftue-research.md, review page GbkPw5, rounds 4–6).
   Every screen before a session starts is one frame: the builder's step header on top (the Ref: Campaign · Table · Start; a
   player: Table · Crow · Ready), the title in one place, Home's rows, and the builder's bottom bar with a quiet way out at the
   left and the one way on at the right. The bar's left says Nest. Screens:
     home   the Ref: the campaigns (a tap opens one); a player: the table code and their crows, folded under one button
     camp   the Ref, between sessions: what is prepared (Places, Loot, Encounters, Maps, Crows), the last session, Host session N
     homev  the Ref, right after New campaign: the home village the players named, with the institution they chose
     start  the Ref's table before the start: the code and Copy invite, who is here, Start
     seat   a player at the table: pick a crow, then Ready; then the wait with everyone at the table
   Loads before app.js: functions only (app.js's last line renders); the actions are wired on DOMContentLoaded. */
const LOB_AREAS=['home','camp','homev','start','seat'];
const lobArea=()=>LOB_AREAS.includes(S.area);
// a player's crow opened from Home off a table (owner, 2026-11-24): its sheet to read, no play views, back to Home
const lobBook=()=>S.role==='player'&&!!S.book&&S.area==='crow'&&!sesOn();
const LOB_STEPS={ref:['Campaign','Table','Start'],player:['Table','Crow','Ready']};
// The screen as drawn, kept per role and area for the next boot to paint before the scripts run (index.html, the script after
// #dlg): the role switch reloads, and Firefox drew an empty page between the two screens (owner, 2026-11-24). Pre-game screens
// only; the asset version and the open campaign must match, so a stale copy is never shown. A view cache, not a save: no ctk- key.
const LOB_V=(/[?&]v=([^&]+)/.exec(document.currentScript?.src||'')||[])[1]||'';
function lobPaintSave(){if(!lobArea()||S.prep||S.book||!S.role)return;const r=document.documentElement,d={...r.dataset},h={};delete d.theme;
  for(const id of ['top','where','tabs','main','nav']){const e=document.getElementById(id);if(e)h[id]=e.outerHTML}
  try{localStorage.setItem(`nest-paint-${S.role}-${S.area}`,JSON.stringify({v:LOB_V,camp:localStorage.getItem('ctk-camp'),w:innerWidth,c:r.className.replace(/\bboot\b/,'').trim(),d,h}))}catch{}}
// the steps: done = a green tick, the current one ringed and underlined, the next a dashed number (the builder's own header)
function lobRail(cur,subs=[]){return `<nav class="b2-steps lob-rail" aria-label="Before the game">${LOB_STEPS[S.role==='ref'?'ref':'player'].map((l,i)=>`<span class="b2-step${i<cur?' ok':''}"${i===cur?' aria-current="step"':''}><span class="n" aria-hidden="true">${i<cur?'✓':i+1}</span><span class="t"><b>${l}</b><small>${esc(subs[i]||'')}</small></span></span>`).join('')}</nav>`}
// one row (Home's .hmenu): an icon or a crow's disc, the name and a quiet line, and at the end a chevron, a state, or nothing.
// A row that does something is a button; a row that only says something (who sits at the table) is not.
function lobRow({ic,av,t,m='',end='›',act,v,attr='',pressed,dis,cls=''}){const lead=av?crowAv(av,44,dis==='dead'?'dead':''):ic?vsvg(VICON[ic]||VICON.sheet).replace('<svg ','<svg class="ic" '):'';
  const inner=`${lead}<span class="tx"><b>${t}</b>${m?`<span>${m}</span>`:''}</span>${end==='›'?'<i aria-hidden="true">›</i>':end}`;
  return act?`<button type="button" class="${cls}" data-action="${act}"${v!=null?` data-v="${esc(v)}"`:''}${attr?' '+attr:''}${pressed!=null?` aria-pressed="${pressed}"`:''}${dis?' aria-disabled="true"':''}>${inner}</button>`:`<div class="lrow ${cls}">${inner}</div>`}
const lobRows=a=>`<div class="hmenu lob-rows">${a.join('')}</div>`;
const lobSec=(h,body)=>`<section class="lob-sec">${h?`<h3>${h}</h3>`:''}${body}</section>`;
const LOB_ST={ready:['good','Ready'],choosing:['warn','Choosing'],away:['away','Not here yet'],dead:['dead','Dead']};
const lobState=(st,you)=>`<span class="ss-st ${LOB_ST[st][0]}">${st==='dead'?sSvg('skull',14):''}${LOB_ST[st][1]}${you?' · you':''}</span>`;
const lobRoleSw=()=>`<div class="hrole-sw" role="group" aria-label="Your role on this device">${[['player','Player',VICON.person],['ref','Ref',VICON.ref]].map(([k,h,d])=>`<button type="button" data-action="whoami" data-v="${k}" aria-pressed="${k===S.role}">${vsvg(d)}${h}</button>`).join('')}</div>`;
// the frame: steps, title, body; the bottom bar holds a quiet way out (left) and the one way on (right): bone, or dashed while not yet
function lobFrame({rail='',title,sub='',body,left='',right=''}){return `<div class="lobw"><div class="lob">${rail}<header class="lob-h"><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</header>${body}${left||right?`<div class="lob-foot">${left}<span class="b2-sp"></span>${right}</div>`:''}</div></div>`} // the actions right under the content, in the column (owner, 2026-11-24: no band at the bottom)
const lobQuiet=(t,act,v)=>`<button type="button" class="b2-tert" data-action="${act}"${v!=null?` data-v="${esc(v)}"`:''}>${t}</button>`;
const lobMain=(t,act,{on=true,v,bone=true}={})=>`<button type="button" class="btn${on&&bone?' primary':''}" data-action="${act}"${v!=null?` data-v="${esc(v)}"`:''}${on?'':' disabled'}>${t}</button>`;
const lobArrow=()=>' '+sSvg('arrow');
const lobOwn=c=>typeof crowOwn==='function'?crowOwn(c):true;

/* ---------- Home ---------- */
function homeHTML(){const role=S.role;
  if(!role){const roles=[['player','Player','Make a crow and play from its sheet. You roll real dice; the app does the maths.',VICON.person],['ref','Ref','Run the session: dungeon clock, loot, travel days, villages.',VICON.ref]];
    return lobFrame({title:'Who are you at the table?',body:`<div class="who">${roles.map(([k,h,p,d])=>`<button class="opt who-c" data-action="whoami" data-v="${k}" aria-pressed="false">${vsvg(d)}<h3>${h}</h3><span>${p}</span></button>`).join('')}</div>`})}
  return role==='ref'?lobRefHome():lobPlayerHome()}
// the Ref: the campaigns, the one open now first, then the last played; a tap opens its page
function lobRefHome(){const L=campList(),cur=L.find(e=>e.current),rows=[cur,...L.filter(e=>!e.current).sort((a,b)=>(b.last||0)-(a.last||0))].filter(Boolean);
  const file=`<label class="b2-tert lob-file">${sSvg('up',18)} Import campaign file<input type="file" id="campfile" accept=".json,application/json"></label>`;
  return lobFrame({rail:lobRail(0),title:'Campaigns',body:`${lobRoleSw()}${rows.length?lobRows(rows.map(e=>lobRow({ic:'village',t:esc(e.name),m:esc(campSub(e)),act:'lob-camp',v:e.id}))):'<div class="lob-card"><p class="lob-muted">No campaigns on this device yet</p></div>'}`,
    left:file,right:lobMain(`${sSvg('plus',18)} New campaign`,'camp-new',{bone:!rows.length})})}
// a player: the code from the Ref (its label above, nothing inside), then the crows folded under one button; the two actions of
// another kind (New crow, Import) apart from the crows; with no crow yet they show at once (owner, 2026-11-24)
function lobPlayerHome(){const L=PARTY.filter(lobOwn),at=typeof NET!=='undefined'&&NET.code&&!NET.host,busy=at&&!(NET.ready&&NET.conns.length);
  const over=S.sesOver&&!sesOn()?`<div class="lob-card lob-over"><span class="tx"><b>Session ${S.sesOver} is over</b>${S.ses?.camp?`<span>${esc(S.ses.camp)}</span>`:''}</span></div>`:'';
  const err=!at&&S.joinErr;
  // Join sits beside the field it sends (owner, 2026-11-24: at the bottom it hung below the crows); it needs no crow: the seat offers New crow too
  const go=at?(busy?lobMain('Joining…','lob-join',{on:false}):lobMain(`Pick your crow${lobArrow()}`,'go',{v:'seat'})):lobMain(`Join${lobArrow()}`,'lob-join',{on:!!(S.joinCode||err)});
  // the field and Join in one card across the column, the label above it as a section's (owner, 2026-11-24: variant 2 with 3's label)
  const code=lobSec('Table code',`<div class="lob-card lob-codebox"><div class="lob-coderow"><label class="lob-field${err?' err':''}"><input id="lob-code" aria-label="Table code" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(at?NET.code:(S.joinCode||err||''))}"${at?' disabled':''}>${busy?'<span class="lob-spin" aria-hidden="true"></span>':''}</label>${go}</div>${err?'<p class="lob-err" role="alert">No table with this code</p>':''}</div>`);
  const acts=`<div class="lob-acts"><button type="button" class="sp-q" data-action="new-crow">${sSvg('plus',18)} New crow</button>${sesImportHTML()}</div>`;
  const open=store.get('crowsopen')==='1';
  const crows=!L.length?lobSec('Your crows',acts):`<section class="lob-sec"><button type="button" class="lob-disc" data-action="lob-crows" aria-expanded="${open}"><span>Your crows</span><span class="n">${L.length}</span>${vsvg(open?'<path d="M6 15l6-6 6 6"/>':'<path d="M6 9l6 6 6-6"/>')}</button>
    ${open?`${lobRows(L.map(c=>lobRow({av:c,t:esc(c.name),m:`${crowDead(c)?'Dead · ':''}${esc(c.bg)} · level ${level(c).lv}`,act:'lob-crow',attr:`data-i="${PARTY.indexOf(c)}"`,dis:crowDead(c)?'dead':''})))}${acts}`:''}</section>`;
  return lobFrame({rail:lobRail(0,[busy?'joining…':at?NET.code:'']),title:'Join a table',body:`${over}${lobRoleSw()}${code}${crows}`,left:at?lobQuiet('Leave the table','lob-leave'):''})}

/* ---------- the Ref: a campaign between sessions ---------- */
function lobCampHTML(){if(S.role!=='ref'||campNone())return '';const cp=campCurrent(),n=sesN(),s=sesS(),wp=whereParts();
  const P=typeof PLACES!=='undefined'?PLACES:[],dn=P.filter(p=>p.kind==='dungeon').length,pi=P.filter(p=>p.kind==='poi').length,home=VILLAGES.find(v=>v.home);
  const pl=[VILLAGES.length&&`${VILLAGES.length} settlement${VILLAGES.length>1?'s':''}`,dn&&`${dn} dungeon${dn>1?'s':''}`,pi&&`${pi} point${pi>1?'s':''} of interest`].filter(Boolean).join(', ');
  const R=typeof campRoster==='function'?campRoster():[],dead=R.filter(r=>{const c=PARTY.find(x=>x.id===r.id);return c?crowDead(c):!!r.dead}).length;
  const last=s.last?.n?lobSec('Last session',lobRows([lobRow({ic:'session',t:`Session ${s.last.n}`,m:`ended ${sesHM(s.last.end)}${s.last.at?` · ${sesDur2(s.last.at,s.last.end)}`:''}`,act:'journal'})])):'';
  const rows=[lobRow({ic:'village',t:'Places',m:pl?`${home?esc(home.name)+' · ':''}${pl}`:'No places yet',act:'lob-prep',v:'session/village'}),
    lobRow({ic:'loot',t:'Loot',m:LOOT.length?`${LOOT.length} prepared · ${LOOT.slice(0,2).map(p=>esc(p.name||'')).join(', ')}`:'Nothing prepared yet',act:'lob-prep',v:'library/presets'}),
    lobRow({ic:'actions',t:'Encounters',m:'Monsters and roll tables',act:'lob-prep',v:'library/monsters'}),
    lobRow({ic:'rmap',t:'Maps',m:'Draw a hex map, generate one, export it',act:'lob-prep',v:'maps'}),
    lobRow({ic:'companions',t:'Crows',m:R.length?`${R.length} in the roster${dead?` · ${dead} dead`:''}`:'Players bring their own',act:'lob-prep',v:'crows'})];
  const on=sesOn(),hosted=typeof NET!=='undefined'&&NET.code&&NET.host;
  return lobFrame({rail:lobRail(0,[cp?.name||'']),title:esc(cp?.name||'Campaign'),sub:`${on?`Session ${n} is on`:`Session ${n} next`} · ${esc(wp[1]||'')}`,body:`${last}${lobSec('Prepare',lobRows(rows))}`,
    left:lobQuiet('← Campaigns','go','home'),right:on?lobMain(`Back to the game${lobArrow()}`,'ses-continue'):lobMain(`${hosted?'Open the table':`Host session ${n}`}${lobArrow()}`,'lob-host')})}
const sesDur2=(a,b)=>{const m=Math.max(0,Math.round((b-a)/60000));return m<60?`${m} min`:`${Math.floor(m/60)} h ${m%60} min`};

/* ---------- the Ref: the home village, right after New campaign ---------- */
// the players named it while making their crows and told the Ref, with the one institution they chose (Character p. 48)
function lobHomeVHTML(){if(S.role!=='ref'||campNone())return '';const NV=S.newv??={name:'',home:true,preset:'start',extra:'alchemist'};NV.home=true;NV.preset='start';
  const ex=Object.keys(INST).filter(k=>!HOME_START.includes(k));
  return lobFrame({rail:lobRail(0,[campCurrent()?.name||'']),title:'Home village',sub:'Blacksmith, crypt, general store, inn and temple at level 1, plus one more (Character p. 48)',
    body:`${lobSec('Name',`<label class="fld"><input type="text" data-action="nvname" value="${esc(NV.name)}" aria-label="Name" placeholder="" autocomplete="off"></label>`)}
      ${lobSec('One more institution',`<div class="cd-chips" role="group" aria-label="One more institution">${ex.map(k=>`<button type="button" class="cd-chip" data-action="lob-extra" data-v="${k}" aria-pressed="${NV.extra===k}">${esc(INST[k].n)}</button>`).join('')}</div>`)}`,
    left:lobQuiet('Later','go','camp'),right:lobMain('Create village','lob-homev')})}

/* ---------- the Ref: the table before the start ---------- */
function startHTML(){if(S.role!=='ref')return '';const s=sesS(),n=sesN(),cp=campCurrent?.();
  if(s.on)return lobFrame({rail:lobRail(2,[cp?.name||'',NET.code||'']),title:`Session ${n} is on`,sub:`Started ${sesHM(s.at)}`,body:'',left:lobQuiet('← '+esc(cp?.name||'Campaign'),'go','camp'),right:lobMain(`Back to the game${lobArrow()}`,'ses-continue')});
  const host=typeof NET!=='undefined'&&NET.code&&NET.host,rows=sesRows(),live=rows.filter(r=>r.st!=='dead'&&!r.anon),k=live.filter(r=>r.st==='ready').length,m=live.length,wp=whereParts();
  // the player's code card on the Ref's side: the label above, the code as text (no box: the Ref cannot change it), Copy invite beside it (owner, 2026-11-24: B)
  const table=host?lobSec('Table code',`<div class="lob-card lob-codebox"><div class="lob-coderow"><span class="lob-k" aria-label="Table code ${esc(NET.code).split('').join(' ')}">${esc(NET.code)}</span><button type="button" class="btn" data-action="lob-invite">${sSvg('copy',18)} Copy invite</button></div></div>`)
    :lobSec('Table',`<div class="lob-card lob-codebox"><div class="lob-coderow"><button type="button" class="btn primary" data-action="ses-host">Host a table</button><button type="button" class="linkbtn" data-action="ses-solo">${nest('or play on this device')}</button></div></div>`);
  // a crow on the Ref's own device: a quiet toggle at the row's end (the starter's “Plays on this device”)
  const here=r=>!r.anon&&r.st!=='dead'&&(r.local||r.st==='away'&&r.c)?`<button type="button" class="btn sm ghost lob-here" data-action="ses-here" data-v="${esc(r.id)}" data-on="${r.local?0:1}" aria-pressed="${!!r.local}" aria-label="${esc(r.name)} plays on this device">${r.local?'On this device':'Play here'}</button>`:'';
  const crows=rows.length?lobRows(rows.map(r=>lobRow({av:r.c||{name:r.name},t:esc(r.anon?'A player':r.name),m:r.anon?'choosing a crow':`${esc(r.bg)}${r.bg?' · ':''}level ${r.lv}`,end:`${here(r)}${lobState(r.st)}`,dis:r.st==='dead'?'dead':''}))):'<div class="lob-card"><p class="lob-muted">Nobody here yet</p></div>';
  const all=k&&k===m,label=all?`Start session ${n}`:k?`Start with ${k} of ${m}`:`Start session ${n}`;
  return lobFrame({rail:lobRail(1,[cp?.name||'',host?NET.code:'',`${k} of ${m} ready`]),title:`Session ${n}`,sub:`${esc(cp?.name||'')} · ${esc(wp[1]||'')} · <button type="button" class="linkbtn" data-action="move">move</button>`,
    body:`${table}${lobSec('Crows',crows)}`,left:host?lobQuiet('Stop hosting','ses-unhost'):lobQuiet('← '+esc(cp?.name||'Campaign'),'go','camp'),
    right:`<button type="button" class="btn${all?' primary':''}" data-action="ses-start"${k?'':' disabled'}>${label}${lobArrow()}</button>`})}

/* ---------- a player at the table: who do you play, then the wait ---------- */
function seatHTML(){if(S.role!=='player')return '';const s=S.ses||SES0(),code=typeof NET!=='undefined'?NET.code:'',me=PARTY.find(c=>c.id===S.seat),n=s.n||1;
  if(!code)return lobPlayerHome();
  const sub=`${esc(s.camp||'')}${s.camp?' · ':''}session ${n}`;
  if(me&&!crowDead(me)&&!s.on){const R=(s.rows||[]).filter(r=>r.id!==me.id);
    return lobFrame({rail:lobRail(3,[code,me.name,'']),title:'Waiting for the Ref…',sub,
      body:lobSec('At the table',lobRows([...R.map(r=>lobRow({av:{name:r.name},t:esc(r.name),end:lobState(r.st==='dead'?'dead':r.st)})),lobRow({av:me,t:esc(me.name),m:`${esc(me.bg)} · level ${level(me).lv}`,end:lobState('ready',true)})])),
      left:lobQuiet('Change crow','seat-change')})}
  // this device's own crows only (made or imported here: sync.js crowOwn), never one that came from the table (owner, 2026-11-21)
  const last=store.get('lastseat'),L=PARTY.filter(lobOwn).sort((a,b)=>(b.id===last)-(a.id===last)),pick=L.find(c=>c.id===S.pick&&!crowDead(c)&&!sesTaken(c.id));
  const rows=L.map(c=>{const dead=crowDead(c),taken=sesTaken(c.id),off=dead||taken,on=pick===c;
    return lobRow({av:c,t:esc(c.name),m:dead?'Dead':taken?'Taken':`${esc(c.bg)} · level ${level(c).lv}`,act:'lob-pick',v:c.id,pressed:on,dis:off?(dead?'dead':'taken'):'',end:on?`<span class="lob-ok">${sSvg('check',20)}</span>`:''})});
  const acts=`<div class="lob-acts"><button type="button" class="sp-q" data-action="new-crow">${sSvg('plus',18)} New crow</button>${sesImportHTML()}</div>`;
  return lobFrame({rail:lobRail(1,[code,pick?pick.name:'']),title:'Who do you play?',sub,body:`${rows.length?lobRows(rows):''}${acts}`,
    left:lobQuiet('Leave the table','lob-leave'),right:lobMain(`Ready${lobArrow()}`,'seat-pick',{on:!!pick,v:pick?.id})})}

/* ---------- wiring ---------- */
// an invite link (Copy invite): …/#join=CODE opens Home with the code in its field; a device with no role yet is a player's
// app.js calls this right before its first render (S exists by then): the invite link, and prep surviving a reload of this tab
function lobBoot(){const m=location.hash.match(/^#join=([A-Za-z0-9]{4,8})$/);
  if(m){S.joinCode=m[1].toUpperCase();history.replaceState(null,'',location.pathname+location.search);if(!S.role){S.role='player';store.set('role','player')}S.area='home'}
  try{if(sessionStorage.getItem('ctk-prep')==='1')S.prep=true}catch{}}
addEventListener('DOMContentLoaded',()=>{
  Object.assign(A,{
    'lob-camp':b=>{const e=campList().find(x=>x.id===b.dataset.v);if(!e)return;if(e.current){S.area=campNeedsHome()?'homev':'camp';render();return scrollTo(0,0)}campOpenUI(e.id)},
    // a prepared thing opens its own screen; its way back is the campaign (the bar's left, while no session is on)
    'lob-prep':b=>{S.prep=true;A.goto(b)},
    'lob-host':()=>{if(!(NET.code&&NET.host))A['ses-host']();S.area='start';sesLobby(true);render();scrollTo(0,0)},
    'lob-homev':()=>{const NV=S.newv;if(!NV?.name.trim()){$('#main [data-action=nvname]')?.focus();return toast('Name the village first.')}A.nvadd();S.area='camp';render();scrollTo(0,0)},
    'lob-extra':b=>{S.newv.extra=b.dataset.v;render()},
    'lob-invite':()=>{const c=NET.code,cp=campCurrent?.(),t=`${cp?.name?cp.name+' · ':''}table ${c}\n${location.origin}${location.pathname}#join=${c}`;
      (navigator.clipboard?.writeText(t)||Promise.reject()).then(()=>toast('Invite copied: the code and a link'),()=>toast(`The code is ${c}`))},
    'lob-crow':b=>{S.book=!(typeof NET!=='undefined'&&NET.code&&sesOn());A['open-crow'](b)},
    'lob-crows':()=>{store.set('crowsopen',store.get('crowsopen')==='1'?'':'1');render()},
    'lob-join':()=>{const v=($('#lob-code')?.value||'').trim().toUpperCase();if(!v)return $('#lob-code')?.focus();S.joinErr=null;S.joinCode=v;NET.fresh=true;openTable(false,v);render()},
    'lob-leave':()=>{leaveTable();S.seat=null;store.set('seat','');S.pick=null;S.area='home';render()},
    'lob-pick':b=>{if(b.getAttribute('aria-disabled')==='true')return toast(crowDead(PARTY.find(c=>c.id===b.dataset.v))?'A dead crow cannot play.':'That crow is taken on another device.');S.pick=S.pick===b.dataset.v?null:b.dataset.v;render()}});
  // Ready spends the pick: the next time the picker opens, nothing is picked yet
  {const f=A['seat-pick'];A['seat-pick']=b=>{S.pick=null;return f(b)}}
  // typing the code lights Join (no render per key); Enter joins
  document.addEventListener('input',e=>{if(e.target.id!=='lob-code')return;S.joinCode=e.target.value.trim().toUpperCase();S.joinErr=null;
    const j=$('.lob-coderow [data-action=lob-join]');if(j){const on=!!S.joinCode;j.disabled=!on;j.classList.toggle('primary',on)}$('.lob-field')?.classList.remove('err');$('.lob-err')?.remove()});
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='lob-code'){e.preventDefault();A['lob-join']()}})});
