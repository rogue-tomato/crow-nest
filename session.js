'use strict';
/* CROW NEST — the session (owner, 2026-11-20; QA/2026-11-20-session.md). The Ref's starter (variant A of the mockups), who plays
   tonight, frozen crows, a late player let in, End session.
   S.ses is the table's session, part of the campaign's world: on the Ref's device it is saved with the rest of the session
   (ctk-session, saveSession) and parked with its campaign; players get the Ref's copy in the snapshot (sesPub) and keep it in
   ctk-tses until the next one arrives.
     {on, id, at, att: [crow ids playing], frozen: [roster crows not seated at Start], asks: {crow: {at, dev}},
      seats: {device: {crow, at, name}} (who picked whom before Start; key `here:<crow>` = a crow the Ref seats on its own device),
      owners: {crow: {dev, name}} (the device that last seated each crow: whose crow it is; kept across sessions, never published),
      lobby (the Ref has the starter open), solo, last}
   Devices (part 3, owner 2026-11-20): nothing to type. Every device has its id (DEV, ctk-dev) and a label the app reads from the
   browser (sesDevKind: “iPad”, “Android tablet”, “Windows laptop”…); the Ref numbers look-alikes (“iPad 2”). A player's snapshot
   carries both; players only ever see labels. A pick binds the crow to the device (owners), kept across sessions.
   No session on is ordinary play, as before campaigns: everyone plays, nothing is frozen; the starter is optional.
   Inside a session only the attendance plays (PLAY()); a roster crow left out is frozen: no XP, no rest, no journey role, no part
   in the loot, its sheet read-only. Nobody drops mid-session; a late player asks and the Ref lets them in.
   Loads before app.js: functions only; the actions are wired on DOMContentLoaded. */
const SES0=()=>({on:false,att:[],frozen:[],asks:{},seats:{},owners:{},lobby:false});
function sesFix(o){const s={...SES0(),...(o&&typeof o==='object'&&!Array.isArray(o)?o:{})};s.on=!!s.on;s.lobby=!!s.lobby;
  if(!s.owners||typeof s.owners!=='object'||Array.isArray(s.owners))s.owners={};if(s.seated!=null&&(typeof s.seated!=='object'||Array.isArray(s.seated)))s.seated={};
  for(const k of ['att','frozen'])s[k]=Array.isArray(s[k])?s[k].filter(x=>typeof x==='string'):[];
  for(const k of ['asks','seats'])if(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k]))s[k]={};
  if(Array.isArray(o?.asks))s.asks=Object.fromEntries(o.asks.map(id=>[id,{at:0}])); // a player's copy names the asks only
  return s}
const sesS=()=>S.ses||(S.ses=SES0());
// a session is on: the Ref's own; on a player's device only while it sits at the Ref's table
function sesOn(){const s=S.ses;if(!s||!s.on)return false;return S.role==='ref'||typeof NET!=='undefined'&&!!NET.code}
const sesOut=c=>!!c&&sesOn()&&!S.ses.att.includes(c.id);
const sesFrozen=c=>!!c&&sesOn()&&S.ses.frozen.includes(c.id);
// the crows that play: everyone without a session, the attendance inside one (the same array when no session is on)
function PLAY(){return sesOn()?PARTY.filter(c=>S.ses.att.includes(c.id)):PARTY}
// the Ref's Party box (play.js) before a session (owner, 2026-11-21): the open campaign's roster and the crows seated for the next
// session (a device's pick, “plays on this device”), not every crow this device keeps. In a session, and on a player's device, PLAY().
// Only the box: the rules that ask who plays (XP, rests, the Miasma table, the journey) still read PLAY().
// the crows the Ref's device brings to the table (sync.js partyOut): the roster, the seats, and in a session its attendance and asks
function sesTableIds(){const s=sesS(),T=new Set((typeof campRoster==='function'&&campId()?campRoster():[]).map(r=>r.id));
  for(const x of Object.values(s.seats))T.add(x.crow);if(s.on){for(const id of s.att)T.add(id);for(const id of Object.keys(s.asks))T.add(id)}return T}
function sesParty(){if(S.role!=='ref'||sesOn())return PLAY();const R=new Set((typeof campRoster==='function'&&campId()?campRoster():[]).map(r=>r.id));
  for(const x of Object.values(sesS().seats))R.add(x.crow);return PARTY.filter(c=>R.has(c.id))}
// the session's number: while one is on, its own; between sessions, the next (the counter moves on at End session)
const sesN=()=>S.role==='ref'&&typeof campSession==='function'?campSession():(+S.ses?.n||1);
const sesHM=t=>t?new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}):'';
const sesDur=t=>{const m=Math.max(0,Math.round((Date.now()-t)/60000));return m<60?`${m} min`:`${Math.floor(m/60)}h ${m%60}m`};
const sesNames=l=>l.length<2?l.join(''):l.slice(0,-1).join(', ')+' and '+l[l.length-1];

/* ---------- the Ref: who is at the table ---------- */
// devices seen at this table since this page loaded (a snapshot from them): device → {at, k}; a closed connection forgets it
const SES_DEV={};let SES_K=0;
const sesName=v=>String(v||'').replace(/\s+/g,' ').trim().slice(0,40); // a device label as it arrives: plain, short
// device identity stays under the hood (owner, 2026-11-20): it reaches the console, never the screen
const sesLog=(...a)=>{try{console.info('[table]',...a)}catch{}};
function sesDevSeen(dev,name){if(!dev||dev===DEV)return;const fresh=!SES_DEV[dev],d=SES_DEV[dev]??={at:Date.now(),k:++SES_K};if(name)d.name=sesName(name);if(fresh)sesLog('device joined',dev,sesDevLabel(dev,d))}
// a device's label for the Ref: the name its player typed, else the name it had when it last seated a crow, else “Device k”
// a device's label for the Ref: its kind (“iPad”), numbered when two look alike (“iPad 2”, in the order they joined)
function sesDevLabel(dev,v){if(dev?.startsWith?.('here:'))return 'This device';const kind=v?.name||Object.values(sesS().owners).find(o=>o.dev===dev)?.name||'A device';
  const same=Object.entries(SES_DEV).filter(([,x])=>(x.name||'A device')===kind).sort((a,b)=>a[1].k-b[1].k);return same.length>1?`${kind} ${same.findIndex(([d])=>d===dev)+1}`:kind}
// what this device is, from the browser: no typing (owner, 2026-11-20)
function sesDevKind(){const ua=navigator.userAgent||'',pf=navigator.userAgentData?.platform||navigator.platform||'',touch=navigator.maxTouchPoints>1;
  if(/iPad/.test(ua)||/Mac/.test(pf+ua)&&touch)return 'iPad';if(/iPhone|iPod/.test(ua))return 'iPhone';
  if(/Android/.test(ua))return /Mobile/.test(ua)?'Android phone':'Android tablet';if(/CrOS/.test(ua))return 'Chromebook';
  if(/Win/.test(pf+ua))return 'Windows laptop';if(/Mac/.test(pf+ua))return 'Mac';if(/Linux/.test(pf+ua))return 'Linux computer';return 'A device'}
function sesDevGone(dev){if(!dev||S.role!=='ref')return;delete SES_DEV[dev];const s=sesS();if(!s.on&&s.seats[dev]){delete s.seats[dev];saveSession()}render()}
// the Ref seats a crow on its own device (a player without a device plays at the Ref's): Ready, and played from the Who menu
function sesSeatHere(id,on){const s=sesS();if(s.on||S.role!=='ref')return;const c=PARTY.find(x=>x.id===id);if(!c||crowDead(c))return;
  if(on){const other=sesSeatOf(id);if(other&&!other[0].startsWith('here:'))return toast(`${c.name} is picked on another device.`);s.seats['here:'+id]={crow:id,at:Date.now(),local:true}}
  else delete s.seats['here:'+id];saveSession();render()}
const sesSeatOf=id=>Object.entries(sesS().seats).find(([,x])=>x.crow===id);
// one row per crow of the campaign (its roster, then anyone seated), and a row for a joined device that has not picked yet
function sesRows(){const s=sesS(),R=typeof campRoster==='function'?campRoster():[],seen=new Set(),rows=[];
  // a joined device that has not picked yet: “choosing”, shown on the crow it last played (its snapshot's `me`), else as a device
  const choosing=id=>Object.entries(SES_DEV).find(([d,v])=>!s.seats[d]&&(s.owners[id]?.dev===d||!Object.values(s.owners).some(o=>o.dev===d)&&v.me===id));
  const add=(id,r={})=>{if(!id||seen.has(id))return;seen.add(id);const c=PARTY.find(x=>x.id===id),dead=c?crowDead(c):!!r.dead,seat=sesSeatOf(id),ch=!seat&&choosing(id);
    const dk=seat?seat[0]:ch?ch[0]:null,dv=seat?SES_DEV[seat[0]]:ch?ch[1]:null;
    rows.push({id,c,name:c?.name||r.name||'A crow',lv:c?level(c).lv:+r.lv||1,bg:c?.bg||r.bg||'',stam:c?`${c.stamina}/${stMax(c)}`:'',
      st:dead?'dead':seat?'ready':ch?'choosing':'away',dev:dv||(seat?{at:seat[1].at}:null),local:!!seat?.[1].local,
      dn:dk?sesDevLabel(dk,dv):s.owners[id]?.name||'',own:s.owners[id]?.name||''})};
  for(const r of R)add(r.id,r);for(const x of Object.values(s.seats))add(x.crow);
  for(const [d,v] of Object.entries(SES_DEV))if(!s.seats[d]&&!rows.some(r=>r.st==='choosing'&&r.dev===v)){const own=Object.entries(s.owners).find(([,o])=>o.dev===d),oc=own&&PARTY.find(c=>c.id===own[0]),nm=oc?`${oc.name}’s ${sesDevLabel(d,v)}`:sesDevLabel(d,v);rows.push({id:'dev:'+d,name:nm,st:'choosing',anon:true,dev:v,dn:''})}
  return rows}
// what the table sees of the session (the snapshot carries it; players never get the Ref's device list beyond the rows)
function sesPub(){const s=sesS(),c=typeof campCurrent==='function'?campCurrent():null;
  return {on:s.on,n:sesN(),id:s.id||'',at:s.at||0,att:s.att,frozen:s.frozen,asks:Object.keys(s.asks),lobby:!!s.lobby,camp:c?.name||'',
    seated:Object.fromEntries(Object.values(s.seats).map(x=>[x.crow,1])), // which crows are taken; never which device
    rows:s.on?[]:sesRows().filter(r=>!r.anon).map(r=>({id:r.id,name:r.name,st:r.st}))}} // names and states only: no device ever (owner)
// a snapshot arrived (sync.js applyIn): on the Ref's device a player's pick or ask; on a player's device the Ref's session
function sesTake(o,lead){
  if(S.role==='ref'){if(lead||!o||!o.dev||o.by==='ref')return;sesDevSeen(o.dev,o.dn);if(SES_DEV[o.dev])SES_DEV[o.dev].me=typeof o.me==='string'?o.me:'';const s=sesS();let ch=false;
    const want=o.seat&&typeof o.seat==='object'&&typeof o.seat.crow==='string'?o.seat.crow:null,cur=s.seats[o.dev],nm=SES_DEV[o.dev].name||'';
    if(!s.on){if(want){const other=sesSeatOf(want);if((!other||other[0]===o.dev)&&(cur?.crow!==want||cur?.name!==nm)){s.seats[o.dev]={crow:want,at:cur?.crow===want?cur.at:Date.now(),name:nm};ch=true}}
      else if(cur){delete s.seats[o.dev];ch=true}}
    // whose crow: the device that seats it (before Start) or plays it in the session
    if(ch)sesLog('seat',sesDevLabel(o.dev,SES_DEV[o.dev]),o.dev,'→',want||'(none)');
    const own=s.on?(s.att.includes(want)?want:null):s.seats[o.dev]?.crow;if(own&&(s.owners[own]?.dev!==o.dev||s.owners[own]?.name!==nm)){s.owners[own]={dev:o.dev,name:nm};ch=true}
    const ask=o.ask&&typeof o.ask.crow==='string'?o.ask.crow:null;
    if(s.on&&ask&&!s.att.includes(ask)&&!s.asks[ask]&&!crowDead(PARTY.find(x=>x.id===ask))){s.asks[ask]={at:Date.now(),dev:o.dev};ch=true;const c=PARTY.find(x=>x.id===ask);if(c)setTimeout(()=>toast(`${c.name} asks to join session ${sesN()}`),0)}
    if(ch)saveSession();return}
  if(!lead||!o||!o.ses||typeof o.ses!=='object')return;
  const was=S.ses?sesFix(S.ses):null,now=sesFix(o.ses);S.ses=now;store.set('tses',JSON.stringify(now));sesLanding(was,now)}
// a player's device follows the Ref: the starter opened (pick a crow), the session started (to your sheet), it ended
function sesLanding(was,now){if(S.role!=='player')return;const n=now.n||1;
  // the session ended: the device goes home and says so (owner, 2026-11-24: nothing on the screen changed); a view state, not shared
  if(was?.on&&!now.on){S.seat=null;store.set('seat','');S.ask=null;S.pick=null;S.sesOver=was.n||n;S.trade=null;if(S.hud)S.hud.inv=false;S.area='home';setTimeout(()=>{if(typeof leaveTable==='function'&&NET.code&&!NET.host){leaveTable();render()}},0);return}
  // a session this device has not seen start: to the seated crow's sheet; a late arrival without a seat picks one (the Ref lets it in)
  if(now.on&&(!was?.on||was.id!==now.id)){S.sesOver=null;const c=PARTY.find(x=>x.id===S.seat);
    if(c&&now.att.includes(c.id)){ME=c;store.set('crow',PARTY.indexOf(c));S.area='crow';S.tab.crow='sheet';S.crowOpen=true;if(was&&!was.on)setTimeout(()=>toast(`Session ${n} started`),0)}
    else if(S.area!=='build')S.area='seat';return}
  if(!now.on&&now.lobby&&(!was||!was.lobby)){S.sesOver=null;if(!sesSeatOk()&&!/^(build)$/.test(S.area))S.area='seat'}}
// a player picks the crow to play: the seat goes to the Ref, and only this crow of the device goes to the table (sync.js partyOut)
function sesPick(c){S.seat=c.id;store.set('seat',c.id);store.set('lastseat',c.id);ME=c;store.set('crow',PARTY.indexOf(c))}
const sesSeatOk=()=>!!S.seat&&PARTY.some(c=>c.id===S.seat&&!crowDead(c));
// a seat taken on another device (the Ref's copy names every device's pick)
const sesTaken=id=>S.seat!==id&&(!!S.ses?.seated?.[id]||sesOn()&&S.ses.att.includes(id));
// what this device puts in its snapshot: the player's pick, a late player's ask
function sesSnapOut(){if(S.role!=='player')return {};return {seat:S.seat?{crow:S.seat}:null,me:ME?.id||'',dn:sesDevKind(),...(S.ask&&sesOut(PARTY.find(c=>c.id===S.ask))?{ask:{crow:S.ask}}:{})}}

/* ---------- the roster: who attended ---------- */
function sesRosterAdd(ids){if(typeof campRosterAdd==='function')campRosterAdd(ids.map(id=>PARTY.find(c=>c.id===id)).filter(Boolean))}

/* ---------- start, let in, end ---------- */
function sesStart(solo){if(S.role!=='ref'||sesOn())return;if(typeof campNone==='function'&&campNone()){S.area='camps';render();return toast('Open or create a campaign first.')}const s=sesS(),n=sesN();
  const alive=id=>{const c=PARTY.find(x=>x.id===id);return !!c&&!crowDead(c)};
  // who plays: the seated crows only, a device's pick or the Ref's “plays on this device” (owner, 2026-11-21: never every crow on the device)
  const att=[...new Set(Object.values(s.seats).map(x=>x.crow))].filter(alive);
  if(!att.length)return solo?sesSoloDlg():toast('Nobody has picked a crow yet.');
  const R=typeof campRoster==='function'?campRoster():[],frozen=R.filter(r=>!att.includes(r.id)&&!(PARTY.find(c=>c.id===r.id)?crowDead(PARTY.find(c=>c.id===r.id)):r.dead)).map(r=>r.id);
  journalRun(`Session ${n} started`,['ses'],()=>{S.ses={...s,on:true,id:'s'+n+'-'+Date.now().toString(36),at:Date.now(),att,frozen,asks:{},lobby:false,solo:!!solo}});
  sesRosterAdd(att);saveSession();
  const L=wsNav('session');S.area='session';S.tab.session=wsLand('session');S.start=null;
  render();scrollTo(0,0);toast(`Session ${n} started${frozen.length?` · ${frozen.length} frozen`:''}`)}
function sesLetIn(id){const s=sesS();if(!s.on||s.att.includes(id))return;const c=PARTY.find(x=>x.id===id);if(!c)return;if(crowDead(c))return toast(`${c.name} is dead`);
  journalRun(`${c.name} joins session ${sesN()}`,['ses'],()=>{S.ses={...s,att:[...s.att,id],frozen:s.frozen.filter(x=>x!==id),asks:Object.fromEntries(Object.entries(s.asks).filter(([k])=>k!==id))}});
  sesRosterAdd([id]);saveSession();render();toast(`${c.name} is in: playing the rest of session ${sesN()}`)}
function sesEnd(){const s=sesS();if(!s.on)return;const n=sesN();
  journalRun(`Session ${n} ended`,['ses'],()=>{S.ses={...SES0(),owners:s.owners,last:{n,at:s.at,end:Date.now(),id:s.id}};if(typeof campSetSession==='function')campSetSession(n+1)});
  S.area='camp';saveSession();render();toast(`Session ${n} ended · ${campCurrent?.()?.name||''} · next: session ${n+1}`);
  if(typeof NET!=='undefined'&&NET.code&&NET.host)setTimeout(()=>{leaveTable();render()},1500)}

/* ---------- dead crows and the Journal ---------- */
// A death undone by the Journal only in the session it happened in (owner): an entry that killed a crow remembers the session.
function sesUndoWhy(list){for(const e of list){if(!e.death||e.kind==='undo')continue;const here=sesOn()&&e.ses&&S.ses.id===e.ses;
    if(e.ses&&!here)return `${e.deathOf||'That crow'} died in an earlier session. A death is undone only in the session it happened in.`}
  return ''}

/* ---------- the starter (the Ref; Menu → Start session N, Home → Continue) ---------- */
const SIC={up:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',copy:'<rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  frost:'<path d="M12 2v20M4.2 6.5l15.6 9M4.2 17.5l15.6-9"/><path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5"/>',arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>'};
const sSvg=(k,w=18)=>`<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SIC[k]}</svg>`;
SIC.ring='<circle cx="12" cy="12" r="7"/>';SIC.x='<path d="M6 6l12 12M18 6 6 18"/>';SIC.skull='<path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="m12.5 17-.5-1-.5 1h1z"/>';SIC.dev='<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M11 18.5h2"/>';SIC.home='<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>';
// the starter (the table before the start): lobby.js startHTML
// “or play on this device” (no table): the Ref ticks which of this device's crows play; only those are seated, then the session starts
function sesSoloDlg(){if(S.role!=='ref'||sesOn())return;const s=sesS(),n=sesN(),dl=$('#dlg'),L=PARTY.filter(c=>!crowDead(c));
  const taken=id=>{const x=sesSeatOf(id);return !!x&&!x[0].startsWith('here:')},on=new Set(Object.values(s.seats).filter(x=>x.local&&!taken(x.crow)).map(x=>x.crow));
  dl.dataset.k='sessolo';
  const draw=()=>{dl.innerHTML=`<form method="dialog" class="cpd ss-solo"><h2>Who plays on this device?</h2>
    ${L.length?`<div class="sp-toks">${L.map(c=>{const off=taken(c.id);return `<button type="button" class="sp-tok${off?' off':''}" data-pk="${esc(c.id)}" aria-pressed="${on.has(c.id)}"${off?' aria-disabled="true"':''}>${crowAv(c,44)}<span><b>${esc(c.name)}</b><span class="muted">${off?'Picked on another device':`${esc(c.bg)} · level ${level(c).lv}`}</span></span></button>`}).join('')}</div>`:'<p>No crow on this device yet.</p>'}
    <div class="row"><button type="button" class="btn ghost" data-cp="no">Cancel</button><button type="button" class="btn primary" data-cp="yes"${on.size?'':' disabled'}>${on.size?`Start session ${n} with ${on.size}`:`Start session ${n}`}</button></div></form>`};
  draw();dl.onclose=()=>{dl.dataset.k=''};dl.onsubmit=null;
  dl.onclick=e=>{const t=e.target.closest('[data-pk]');if(t){if(t.getAttribute('aria-disabled')!=='true'){const id=t.dataset.pk;on.has(id)?on.delete(id):on.add(id);draw();dl.querySelector(`[data-pk="${CSS.escape(id)}"]`)?.focus()}return}
    const b=e.target.closest('[data-cp]');if(!b||b.disabled)return;dl.close();if(b.dataset.cp!=='yes')return;
    for(const c of L)if(!taken(c.id)){if(on.has(c.id))s.seats['here:'+c.id]={crow:c.id,at:Date.now(),local:true};else delete s.seats['here:'+c.id]}
    saveSession();sesStart(true)};
  if(!dl.open)dl.showModal();(dl.querySelector('[data-pk]:not([aria-disabled])')||dl.querySelector('[data-cp=no]')).focus()}
function sesStartAsk(){const rows=sesRows(),live=rows.filter(r=>r.st!=='dead'&&!r.anon),ready=live.filter(r=>r.st==='ready'),miss=live.filter(r=>r.st!=='ready');
  if(!ready.length)return toast('Nobody has picked a crow yet.');if(!miss.length)return sesStart();
  const dl=$('#dlg');dl.dataset.k='sesstart';
  dl.innerHTML=`<form method="dialog" class="cpd sl-confirm"><h2>Start without ${miss.length>1?'them':esc(miss[0].name.split(' ')[0])}?</h2>
    <p class="sl-out">${miss.map(r=>`<span>${sSvg('frost',16)} <b>${esc(r.name)}</b></span>`).join('')}</p>
    <p>${miss.length>1?'They sit':esc(miss[0].name.split(' ')[0])+' sits'} this session out: no XP, no part in play. You can let them in later.</p>
    <div class="row"><button type="button" class="btn ghost" data-cp="no">Wait</button><button type="button" class="btn primary" data-cp="yes">Start with ${ready.length} of ${live.length}</button></div></form>`;
  dl.onclose=()=>{dl.dataset.k=''};dl.onsubmit=null;dl.onclick=e=>{const b=e.target.closest('[data-cp]');if(!b)return;dl.close();if(b.dataset.cp==='yes')sesStart()};dl.showModal();dl.querySelector('[data-cp=no]').focus()}
function sesEndAsk(){const s=sesS();if(!s.on)return;const n=sesN(),cp=campCurrent?.(),fz=s.frozen.map(id=>PARTY.find(c=>c.id===id)?.name||(campRoster?.()||[]).find(r=>r.id===id)?.name).filter(Boolean);
  const wp=whereParts(),dl=$('#dlg');dl.dataset.k='sesend';
  dl.innerHTML=`<form method="dialog" class="cpd"><h2>End session ${n}?</h2><p>${cp?esc(cp.name)+' · ':''}started ${sesHM(s.at)} · ${sesDur(s.at)}.</p>
    <ul class="ss-ul">${fz.length?`<li>${esc(sesNames(fz))} thaw${fz.length>1?'':'s'}.</li>`:''}<li>The Journal gets “Session ${n} ended”; the next start is session ${n+1}.</li>
    <li>Everything stays where it is: ${esc(wp[1])}, the map, the loot pool (${S.pool.length} card${S.pool.length===1?'':'s'}), the clock${S.dt.running?' (still running)':' (paused)'}.</li><li><b>The table closes: the players’ devices go to their Home.</b></li></ul>
    <p class="small">XP for treasure is not part of ending: it comes when the party gets home (Places → XP for treasure brought home).</p>
    <div class="row"><button type="button" class="btn ghost" data-cp="no">Keep playing</button><button type="button" class="btn primary" data-cp="yes">End session ${n}</button></div></form>`;
  dl.onclose=()=>{dl.dataset.k=''};dl.onsubmit=null;dl.onclick=e=>{const b=e.target.closest('[data-cp]');if(!b)return;dl.close();if(b.dataset.cp==='yes')sesEnd()};dl.showModal();dl.querySelector('[data-cp=no]').focus()}
function sesLetAsk(id){const s=sesS(),c=PARTY.find(x=>x.id===id);if(!c||!s.on)return;if(crowDead(c))return toast(`${c.name} is dead`);const a=s.asks[id],n=sesN(),dl=$('#dlg');dl.dataset.k='seslet';
  dl.innerHTML=`<form method="dialog" class="cpd"><h2>Let ${esc(c.name)} in?</h2><p>${a?`${esc(c.name)}’s player asked at ${sesHM(a.at)}, after session ${n} started.`:`${esc(c.name)} is not playing in session ${n}.`}</p>
    <ul class="ss-ul"><li>${esc(c.name)} thaws now and plays the rest of the session.</li><li>Where: with the party, unless you put ${esc(c.name.split(' ')[0])} elsewhere.</li></ul>
    <div class="row"><button type="button" class="btn ghost" data-cp="no">Not now</button><button type="button" class="btn primary" data-cp="yes">Let ${esc(c.name.split(' ')[0])} in</button></div></form>`;
  dl.onclose=()=>{dl.dataset.k=''};dl.onsubmit=null;dl.onclick=e=>{const b=e.target.closest('[data-cp]');if(!b)return;dl.close();if(b.dataset.cp==='yes')sesLetIn(id)};dl.showModal();dl.querySelector('[data-cp=no]').focus()}

/* ---------- a player: who do you play tonight, waiting: lobby.js seatHTML ---------- */
const sesImportHTML=()=>`<label class="sp-q crowfile">${sSvg('up',18)} ${nest('Import from file')}<input type="file" class="crowfile-in" accept=".json,application/json" aria-label="Import a crow from a file"></label>`;
function sesOutBanner(c){const s=S.ses,n=sesN(),fz=sesFrozen(c),asked=!!s.asks[c.id];
  const why=fz?`${esc(c.name)} is frozen this session`:`${esc(c.name)} is not playing in session ${n}`;
  if(S.role==='ref')return `<div class="ss-out" role="status">${sSvg('frost',30)}<span><b>${why}</b><span class="muted">${asked?'Their player asks to join. ':''}Read-only until you let ${esc(c.name.split(' ')[0])} in or the session ends.</span></span><button type="button" class="btn primary" data-action="ses-let" data-v="${esc(c.id)}">Let ${esc(c.name.split(' ')[0])} in</button></div>`;
  return `<div class="ss-out" role="status">${sSvg('frost',30)}<span><b>${why}</b><span class="muted">${fz?`You arrived after the start of session ${n}. `:''}Until the Ref lets you in, this sheet is read-only: no XP, fights, rests or trades.</span></span>${asked||S.ask===c.id?'<span class="ss-st warn">Asked · waiting for the Ref</span>':`<button type="button" class="btn primary" data-action="ses-ask" data-v="${esc(c.id)}">Ask the Ref to let me in</button>`}</div>`}
// after every render: a sheet out of the session is read-only (inert), its banner stays usable; the Ref sees who asks to join
function sesAfterRender(){const pg=$('#main>.page');document.body.classList.remove('ses-ro');if(!pg)return;
  // a dead crow's sheet says so itself: nothing to ask or let in
  if(S.area==='crow'&&ME&&sesOut(ME)&&!crowDead(ME)){pg.insertAdjacentHTML('afterbegin',sesOutBanner(ME));for(const el of pg.children)if(!el.classList.contains('ss-out'))el.inert=true;
    document.body.classList.add('ses-ro');const iv=$('#invov');if(iv&&!iv.hidden)iv.inert=true;const f=$('#invfab');if(f)f.hidden=true}
  else{const iv=$('#invov');if(iv)iv.inert=false}
  if(S.role==='ref'&&sesOn()&&S.area==='session'){const asks=Object.keys(S.ses.asks).map(id=>PARTY.find(c=>c.id===id)).filter(c=>c&&sesOut(c)&&!crowDead(c));
    if(asks.length)pg.insertAdjacentHTML('afterbegin',`<div class="banner ss-asks" role="status"><span class="msg">${asks.map(c=>`<b>${esc(c.name)}</b>`).join(', ')} ask${asks.length>1?'':'s'} to join session ${sesN()}.</span>${asks.map(c=>`<button type="button" class="btn sm primary" data-action="ses-let" data-v="${esc(c.id)}">Let ${esc(c.name.split(' ')[0])} in</button>`).join('')}</div>`)}}
// the party tile of a crow out of the session (play.js partyBoxHTML): striped, “Frozen this session”, Let … in
function sesTile(c){const t=partyTile(c).replace('<div class="ptile">','<div class="ptile frozen">').replace('</a>',`</a><span class="ss-frz">${sSvg('frost',15)} ${sesFrozen(c)?'Frozen this session':'Not in this session'}</span>`);
  return S.role==='ref'&&!crowDead(c)?t.replace(/<\/div>$/,`<div class="pt-let"><button type="button" class="btn sm" data-action="ses-let" data-v="${esc(c.id)}">Let ${esc(c.name.split(' ')[0])} in</button></div></div>`):t}
// crows the party lists show striped: the frozen roster crows on this device, and anyone who asked to join
const sesShownOut=()=>sesOn()?PARTY.filter(c=>sesOut(c)&&!crowDead(c)&&(sesFrozen(c)||S.ses.asks[c.id])):[];
// the journey's party list (journey.js jPartyList): a frozen crow has no role
const sesFrozenRows=()=>sesShownOut().map(c=>`<div class="jr-li frz"><span class="jr-who">${crowAv(c,28,'frozen')}${esc(c.name)}</span><span class="jr-st muted">${sSvg('frost',14)} Frozen this session</span><span class="jr-what">No role</span></div>`).join('');
// the Journal's “Session N started”: end it from there
const sesJournalBtn=e=>S.role==='ref'&&sesOn()&&e.label===`Session ${sesN()} started`&&!e.undone?'<button class="btn sm" data-action="ses-endask">End this session</button>':'';

/* ---------- wiring ---------- */
addEventListener('DOMContentLoaded',()=>{
  if(S.role==='player'){try{const t=JSON.parse(store.get('tses')||'null');if(t)S.ses=sesFix(t)}catch{}S.seat=store.get('seat')||null}
  Object.assign(A,{
    'ses-continue':()=>{if(S.role==='ref'&&campNone())S.area='camps';else if(!sesOn()&&S.role==='ref'){S.area='start';sesLobby(true)}else{S.area='session';if(typeof campNeedsHome==='function'&&campNeedsHome())S.tab.session='village'}render();scrollTo(0,0)},
    'ses-start':b=>{if(b.disabled||b.getAttribute('aria-disabled')==='true')return toast('Nobody has picked a crow yet.');sesStartAsk()},
    'ses-solo':()=>sesSoloDlg(),
    // the starter's own way back from Host a table (owner, 2026-11-22): the table closes, joined devices drop off
    'ses-unhost':()=>{if(NET.conns.length)return askYes(`Stop hosting table ${NET.code}?`,`${NET.conns.length} device${NET.conns.length>1?'s':''} joined will drop off the table.`,'Stop hosting',()=>{leaveTable();render()});leaveTable();render()},
    'ses-host':()=>{if(S.role==='ref'&&campNone()){S.area='camps';render();return toast('Open or create a campaign first.')}let c='';for(let i=0;i<5;i++)c+='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)];openTable(true,c);render()},
    'ses-copy':()=>{const c=NET.code;(navigator.clipboard?.writeText(c)||Promise.reject()).then(()=>toast(`Copied ${c}`),()=>toast(`The code is ${c}`))},
    'ses-endask':()=>sesEndAsk(),
    'ses-let':b=>sesLetAsk(b.dataset.v),
    'ses-ask':b=>{if(crowDead(PARTY.find(c=>c.id===b.dataset.v)))return toast('A dead crow cannot play.');S.ask=b.dataset.v;render();toast('Asked: the Ref lets you in')},
    'seat-pick':b=>{if(b.getAttribute('aria-disabled')==='true')return toast(crowDead(PARTY.find(c=>c.id===b.dataset.v))?'A dead crow cannot play.':'That crow is taken on another device.');
      const c=PARTY.find(x=>x.id===b.dataset.v);if(!c)return;sesPick(c);
      // the Ref seating the crows (the starter is open): wait for the start; otherwise play
      if(sesOn()||!S.ses?.lobby){S.area='crow';S.tab.crow='sheet';S.crowOpen=true}render();scrollTo(0,0)},
    'seat-change':()=>{S.seat=null;store.set('seat','');render()},
    'ses-here':b=>sesSeatHere(b.dataset.v,b.dataset.on==='1')});
  if(S.role==='player'&&S.ses)render()}); // a player's copy of the table's session, back from ctk-tses
function sesLobby(on){const s=sesS();if(S.role!=='ref'||s.on||s.lobby===on)return;s.lobby=on;saveSession()}
