'use strict';
/* CROW NEST — shared table. One device (usually the Ref) hosts a table code; the others join it.
   WebRTC through the free PeerJS broker, so GitHub Pages needs no server of our own.
   ponytail: whole-state snapshots, last write wins. Two people changing things in the same ~second
   can overwrite each other (e.g. both take the last potion); per-field ops on the host if that bites. */
const NET={peer:null,conns:[],host:false,code:'',ready:false,last:'',pending:false,tries:0};
const PFX='crownest-';
const snap=()=>JSON.stringify({party:PARTY,pool:S.pool,villages:VILLAGES,here:S.here||'',dt:S.dt,custom:CUSTOM},(k,v)=>v instanceof Set?[...v]:v);

function applyIn(msg,merge){
  const o=JSON.parse(msg),me=ME&&ME.id;
  const mine=merge?PARTY.filter(c=>!o.party.some(x=>x.id===c.id)):[],myV=merge?VILLAGES.filter(v=>!o.villages.some(x=>x.id===v.id)):[];
  PARTY.splice(0,PARTY.length,...o.party.map(reviveCrow),...mine);
  ME=PARTY.find(c=>c.id===me)||PARTY[0]||null;store.set('crow',Math.max(0,PARTY.indexOf(ME)));
  VILLAGES.splice(0,VILLAGES.length,...o.villages,...myV);
  for(const it of o.custom)if(!IT[it.id]){addItemDef(it);CUSTOM.push(it)}
  store.set('customItems',JSON.stringify(CUSTOM));
  S.pool=o.pool;S.here=o.here;Object.assign(S.dt,o.dt);saveVillages();
  // a joiner's own crows and villages that the table hasn't seen yet go back out on the next render
  NET.last=mine.length||myV.length?'':snap();
  redraw();
}
// Don't rebuild the page under someone's fingers: wait while they type or drag.
function redraw(){const a=document.activeElement;
  if(drag||a&&a.closest('#main')&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){NET.pending=true;return}
  NET.pending=false;render()}
document.addEventListener('focusout',()=>NET.pending&&setTimeout(()=>NET.pending&&redraw(),0));
document.addEventListener('pointerup',()=>NET.pending&&setTimeout(()=>NET.pending&&redraw(),50));

window.syncOut=()=>{if(!NET.ready)return;const s=snap();if(s===NET.last)return;NET.last=s;for(const c of NET.conns)if(c.open)c.send(s)};

function wire(c){
  c.on('open',()=>{NET.conns.push(c);NET.tries=0;if(NET.host){NET.last=snap();c.send(NET.last)}drawNet()});
  c.on('data',m=>{const first=!NET.ready;NET.ready=true;applyIn(m,first&&!NET.host);if(first)drawNet();
    if(NET.host)for(const x of NET.conns)if(x!==c&&x.open)x.send(m)});
  c.on('close',()=>{NET.conns=NET.conns.filter(x=>x!==c);drawNet();if(!NET.host&&NET.peer)retry()});
}
function retry(){NET.ready=false;drawNet();if(NET.tries++<20)setTimeout(()=>NET.peer&&!NET.conns.length&&(NET.host?start():connect()),3000)}
function connect(){if(!NET.peer||NET.peer.destroyed)return start();wire(NET.peer.connect(PFX+NET.code,{reliable:true}))}
function start(){
  if(typeof Peer==='undefined'){toast('Table sync needs the internet (the PeerJS script didn’t load).');return}
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
function openTable(host,code){NET.host=host;NET.code=code;NET.ready=false;NET.tries=0;store.set('net',JSON.stringify({host,code}));start()}
function leaveTable(){NET.peer?.destroy();NET.peer=null;NET.conns=[];NET.ready=false;NET.code='';store.set('net','');drawNet()}

function drawNet(){const b=$('#netbtn');if(!b)return;
  const on=NET.ready&&(NET.host||NET.conns.length),n=NET.conns.length;
  b.querySelector('.lbl').textContent=NET.code?NET.code+(NET.host?` · ${n} joined`:''):'Table';
  b.dataset.state=!NET.code?'off':on?'on':'wait';
  const dl=$('#dlg');if(dl.open&&dl.dataset.k==='net')netDialog()}

function netDialog(){const dl=$('#dlg');dl.dataset.k='net';
  const st=!NET.code?'':NET.host?(NET.conns.length?`${NET.conns.length} device${NET.conns.length>1?'s':''} joined.`:'Waiting for players to join.'):NET.ready&&NET.conns.length?'Connected to the table.':'Connecting…';
  dl.innerHTML=NET.code?`<form method="dialog"><h2>Table <span class="tnum">${esc(NET.code)}</span></h2>
    <p>${st}</p><p class="small muted">${NET.host?'Players open this site, tap <b>Table</b> and type this code. Keep this device online: it holds the table.':'Crows, the loot pool, villages and the DT clock are shared with everyone at this table.'}</p>
    <div class="row" style="justify-content:space-between"><button type="button" class="btn ghost" data-net="leave">Leave the table</button><button class="btn primary">Done</button></div></form>`
   :`<form method="dialog"><h2>Table</h2><p class="small muted">Share crows, the loot pool, villages and the DT clock between devices. Needs the internet.</p>
    <p><b>Join a table</b></p><div class="row"><input type="text" id="netcode" placeholder="Code from the Ref" autocomplete="off" autocapitalize="characters" maxlength="8" style="text-transform:uppercase;flex:1" aria-label="Table code"><button type="button" class="btn primary" data-net="join">Join</button></div>
    <p class="small muted">Your crows on this device are added to the table when you join.</p>
    <p style="margin-top:1.25rem"><b>Or host one</b> <span class="small muted">— usually the Ref. The table’s state starts from this device.</span></p>
    <div class="row" style="justify-content:space-between"><button type="button" class="btn" data-net="host">Host a new table</button><button class="btn ghost">Close</button></div></form>`;
  dl.onclose=()=>{dl.dataset.k=''};
  dl.onclick=e=>{const b=e.target.closest('[data-net]');if(!b)return;const k=b.dataset.net;
    if(k==='leave'){leaveTable();netDialog()}
    if(k==='host'){let c='';for(let i=0;i<5;i++)c+='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)];openTable(true,c);netDialog()}
    if(k==='join'){const c=$('#netcode').value.trim().toUpperCase();if(!c)return $('#netcode').focus();openTable(false,c);netDialog()}};
  dl.onsubmit=null;$('#netcode')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dl.querySelector('[data-net=join]').click()}});
  if(!dl.open)dl.showModal()}

document.addEventListener('click',e=>{if(e.target.closest('#netbtn'))netDialog()});
// back to the same table after a reload
try{const n=JSON.parse(store.get('net')||'null');if(n&&n.code)openTable(n.host,n.code)}catch{}
drawNet();
