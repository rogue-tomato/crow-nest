'use strict';
/* CROW NEST — shared table. One device (usually the Ref) hosts a table code; the others join it.
   WebRTC through the free PeerJS broker, so GitHub Pages needs no server of our own.
   Whole-state snapshots. Crows merge three ways against the last version the table agreed on (BASE): a change made
   on this device is never overwritten by an older copy, and the Ref's changes still arrive where the player didn't touch.
   ponytail: the pool, clock and villages are still last write wins (the host runs them); per-field ops if that bites.
   Before an incoming update replaces anything here, a local copy is kept (5 at most, one per 2 minutes). */
const NET={peer:null,conns:[],host:false,code:'',ready:false,last:'',pending:false,tries:0};
const PFX='crownest-';
const snap=()=>JSON.stringify({party:PARTY,pool:S.pool,villages:VILLAGES,here:S.here||'',phase:S.phase||'',dt:S.dt,custom:CUSTOM,hex:hxPub(),hping:S.hxPing,
  ...(S.role==='ref'&&S.journey?{journey:JourneyRules.projectJourney(S.journey)}:{}), // the Journey runs on the Ref's device; the others get what players may see
  log:{[DEV]:JOURNAL.slice(-60).map(({id,t,who,label,undone})=>({id,t,who,label,undone}))}},(k,v)=>v instanceof Set?[...v]:v); // labels only: the host's Ref sees every device's journal
const BASE={};
// theirs, mine, and the version we last agreed on → the crow to keep
function mergeCrow(x,l){const X=ser(x),b=BASE[x.id];if(!l)return [x,false];const L=ser(l);
  if(L===X||b===undefined||L===b)return [x,false];if(X===b)return [JSON.parse(L),true];
  const B=JSON.parse(b),Lo=JSON.parse(L),out=JSON.parse(X);for(const k of Object.keys(Lo))if(ser(Lo[k])!==ser(B[k]))out[k]=Lo[k];return [out,true]}
function backupLocal(){if(!PARTY.length)return;const t=Date.now(),l=JSON.parse(store.get('syncbak')||'[]');if(l.length&&t-l[l.length-1].t<120000)return;
  l.push({t,party:ser(PARTY),villages:ser(VILLAGES)});store.set('syncbak',JSON.stringify(l.slice(-5)))}
function restoreLocal(k){const b=JSON.parse(store.get('syncbak')||'[]')[k];if(!b)return;const id=ME?.id;
  PARTY.splice(0,PARTY.length,...JSON.parse(b.party).map(reviveCrow));VILLAGES.splice(0,VILLAGES.length,...JSON.parse(b.villages));saveVillages();
  ME=PARTY.find(c=>c.id===id)||PARTY[0]||null;NET.last='';render();toast('Your local copy is back')}

function applyIn(msg,merge){
  const o=JSON.parse(msg),me=ME&&ME.id;backupLocal();
  for(const [dev,l] of Object.entries(o.log||{}))if(dev!==DEV)REMOTE_LOG[dev]=l;
  const mine=merge?PARTY.filter(c=>!o.party.some(x=>x.id===c.id)):[],myV=merge?VILLAGES.filter(v=>!o.villages.some(x=>x.id===v.id)):[];
  let kept=false;const party=o.party.map(x=>{const [c,k]=mergeCrow(x,PARTY.find(y=>y.id===x.id));kept||=k;BASE[x.id]=ser(x);return c});
  PARTY.splice(0,PARTY.length,...party.map(reviveCrow),...mine);
  ME=PARTY.find(c=>c.id===me)||PARTY[0]||null;store.set('crow',Math.max(0,PARTY.indexOf(ME)));
  VILLAGES.splice(0,VILLAGES.length,...o.villages,...myV);
  for(const it of o.custom)if(!IT[it.id]){addItemDef(it);CUSTOM.push(it)}
  store.set('customItems',JSON.stringify(CUSTOM));
  if('hex' in o)hxIn(o.hex); // the Ref's device keeps its full map and takes only the players' route
  if(o.hping)hxPingIn(o.hping);
  // the Ref's device sent it already projected (projecting twice would drop a stop waiting here); a stray copy never overwrites the Ref's own
  if(o.journey&&S.role!=='ref'&&!JourneyRules.validateJourney(o.journey).length)S.journey=o.journey;
  S.pool=o.pool;S.here=o.here;if(o.phase!=null){S.phase=o.phase;store.set('phase',o.phase)}Object.assign(S.dt,o.dt);saveVillages();
  // a joiner's own crows and villages that the table hasn't seen yet go back out on the next render
  NET.last=mine.length||myV.length||kept?'':snap();
  redraw();
}
// Don't rebuild the page under someone's fingers: wait while they type or drag.
function redraw(){const a=document.activeElement;
  if(drag||a&&a.closest('#main')&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){NET.pending=true;return}
  NET.pending=false;render()}
document.addEventListener('focusout',()=>NET.pending&&setTimeout(()=>NET.pending&&redraw(),0));
document.addEventListener('pointerup',()=>NET.pending&&setTimeout(()=>NET.pending&&redraw(),50));

window.syncOut=()=>{if(window.CROW_SERVER?.enabled||!NET.ready)return;const s=snap();if(s===NET.last)return;NET.last=s;for(const c of NET.conns)if(c.open)c.send(s)};

function wire(c){
  c.on('open',()=>{NET.conns.push(c);NET.tries=0;if(NET.host){NET.last=snap();c.send(NET.last)}drawNet()});
  c.on('data',m=>{const first=!NET.ready;NET.ready=true;applyIn(m,first&&!NET.host);if(first)drawNet();
    if(NET.host)for(const x of NET.conns)if(x!==c&&x.open)x.send(m)});
  c.on('close',()=>{NET.conns=NET.conns.filter(x=>x!==c);drawNet();if(!NET.host&&NET.peer)retry()});
}
function retry(){NET.ready=false;drawNet();if(NET.tries++<20)setTimeout(()=>NET.peer&&!NET.conns.length&&(NET.host?start():connect()),3000)}
function connect(){if(!NET.peer||NET.peer.destroyed)return start();wire(NET.peer.connect(PFX+NET.code,{reliable:true}))}
// PeerJS is loaded only when a table is opened: at load it starts WebRTC (~300 ms of frozen page), which a solo game never needs
let PEERJS=null;
const loadPeer=()=>PEERJS??=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';s.onload=ok;s.onerror=()=>{PEERJS=null;s.remove();no()};document.head.append(s)});
function start(){
  if(typeof Peer==='undefined'){loadPeer().then(start,()=>toast('Table sync needs the internet (the PeerJS script didn’t load).'));return}
  NET.peer?.destroy();NET.conns=[];
  const p=NET.peer=NET.host?new Peer(PFX+NET.code):new Peer();
  p.on('open',()=>{NET.tries=0;if(NET.host){NET.ready=true;NET.last=''}else connect();drawNet()});
  p.on('connection',c=>NET.host&&wire(c));
  p.on('disconnected',()=>!p.destroyed&&p.reconnect());
  p.on('error',e=>{
    if(e.type==='unavailable-id')return NET.tries++<10?setTimeout(start,3000):toast(`Table ${NET.code} is already hosted somewhere else.`);
    if(e.type==='peer-unavailable'){toast(`No table ${NET.code} right now — is the host online? Retrying…`);return retry()}
    if(e.type==='network'||e.type==='server-error'||e.type==='socket-error')return retry();
    toast('Table sync: '+e.type)});
  drawNet();
}
function openTable(host,code){if(window.CROW_SERVER?.enabled)return toast('Use Account to open a server adventure.');NET.host=host;NET.code=code;NET.ready=false;NET.tries=0;store.set('net',JSON.stringify({host,code}));start()}
function leaveTable(){NET.peer?.destroy();NET.peer=null;NET.conns=[];NET.ready=false;NET.code='';store.set('net','');drawNet()}

function drawNet(){const b=$('#netbtn');if(!b)return;
  const on=NET.ready&&(NET.host||NET.conns.length),n=NET.conns.length;
  const l=b.querySelector('.lbl');l.textContent=NET.code||'Join table';if(NET.code)l.removeAttribute('data-short');else l.dataset.short='Table';if(NET.code&&NET.host)b.dataset.n=l.dataset.n=n;else{delete b.dataset.n;delete l.dataset.n}
  b.dataset.state=!NET.code?'off':on?'on':'wait';
  const dl=$('#dlg');if(dl.open&&dl.dataset.k==='net')netDialog()}

function netDialog(){const dl=$('#dlg');dl.dataset.k='net';
  const st=!NET.code?'':NET.host?(NET.conns.length?`${NET.conns.length} device${NET.conns.length>1?'s':''} joined.`:'Waiting for players to join.'):NET.ready&&NET.conns.length?'Connected to the table.':'Connecting…';
  dl.innerHTML=NET.code?`<form method="dialog"><h2>Table <span class="tnum">${esc(NET.code)}</span></h2>
    <p>${st}</p><p class="small muted">${NET.host?'Players open this site, tap <b>Table</b> and type this code. Keep this device online: it holds the table.':'Crows, the loot pool, villages and the DT clock are shared with everyone at this table.'}</p>
    ${(()=>{const l=JSON.parse(store.get('syncbak')||'[]');return l.length?`<details style="margin:.5rem 0 1rem"><summary class="small">Restore my local copy</summary><p class="small muted">Copies of this device’s crows and villages, kept before table updates replaced them.</p><div class="row">${l.map((b,k)=>`<button type="button" class="btn sm" data-net="restore:${k}">${new Date(b.t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</button>`).reverse().join('')}</div></details>`:''})()}
    <div class="row" style="justify-content:space-between"><button type="button" class="btn ghost" data-net="leave">Leave the table</button><button class="btn primary">Done</button></div></form>`
   :`<form method="dialog"><h2>Table</h2><p class="small muted">Share crows, the loot pool, villages and the DT clock between devices. Needs the internet.</p>
    <p><b>Join a table</b></p><div class="row"><input type="text" id="netcode" placeholder="Code from the Ref" autocomplete="off" autocapitalize="characters" maxlength="8" style="text-transform:uppercase;flex:1" aria-label="Table code"><button type="button" class="btn primary" data-net="join">Join</button></div>
    <p class="small muted">Your crows on this device are added to the table when you join.</p>
    <p style="margin-top:1.25rem"><b>Or host one</b> <span class="small muted">— usually the Ref. The table’s state starts from this device.</span></p>
    <div class="row" style="justify-content:space-between"><button type="button" class="btn" data-net="host">Host a new table</button><button class="btn ghost">Close</button></div></form>`;
  dl.onclose=()=>{dl.dataset.k=''};
  dl.onclick=e=>{const b=e.target.closest('[data-net]');if(!b)return;const k=b.dataset.net;
    if(k==='leave'){leaveTable();netDialog()}
    if(k.startsWith('restore:')){restoreLocal(+k.slice(8));dl.close()}
    if(k==='host'){let c='';for(let i=0;i<5;i++)c+='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)];openTable(true,c);netDialog()}
    if(k==='join'){const c=$('#netcode').value.trim().toUpperCase();if(!c)return $('#netcode').focus();openTable(false,c);netDialog()}};
  dl.onsubmit=null;$('#netcode')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dl.querySelector('[data-net=join]').click()}});
  if(!dl.open)dl.showModal()}

document.addEventListener('click',e=>{if(!window.CROW_SERVER?.enabled&&e.target.closest('#netbtn'))netDialog()});
// back to the same table after a reload
// a saved table reconnects once the page is idle, so its WebRTC start-up never lands on the first paint; server mode never opens one
try{const n=JSON.parse(store.get('net')||'null');if(!window.CROW_SERVER?.enabled&&n&&n.code)(window.requestIdleCallback||setTimeout)(()=>openTable(n.host,n.code),{timeout:2500})}catch{}
drawNet();
