'use strict';
/* CROW NEST — shared table. One device (usually the Ref) hosts a table code; the others join it.
   WebRTC through the free PeerJS broker, so GitHub Pages needs no server of our own.
   Whole-state snapshots. Crows merge three ways against the last version the table agreed on (BASE): a change made
   on this device is never overwritten by an older copy, and the Ref's changes still arrive where the player didn't touch.
   ponytail: the pool and villages are still last write wins (the host runs them); per-field ops if that bites. Where the party
   is (scene, village), the DT clock and the journey come only from the Ref's device ("by" below; QA/2026-11-12-logic-review.md).
   Before an incoming update replaces anything here, a local copy is kept (5 at most, one per 2 minutes). */
const NET={peer:null,conns:[],host:false,code:'',ready:false,last:'',pending:false,tries:0};
const PFX='crownest-';
// by: who sent it. Where the party is, the clock and the journey are the Ref's: a device takes them only from the Ref's device (a host
// relays the players' snapshots too, with the scene they last saw). An older version's snapshot has no "by": players still take it.
const snap=()=>{const party=partyOut();return JSON.stringify({by:S.role||'',dev:DEV,party,base:baseOf(party),gone:goneOut(),pool:S.pool,villages:VILLAGES,here:S.here||'',phase:S.phase||'',dt:dtPub(),custom:CUSTOM,hex:null,hping:S.hxPing,
  ...(S.role==='ref'&&S.journey?{journey:JourneyRules.projectJourney(S.journey)}:{}),
  ...(S.role==='ref'&&campId()?{camp:campId()}:{}),
  ...(S.role==='ref'?{ses:sesPub()}:sesSnapOut()), // the session (session.js): the Ref's state; a player's pick and ask // which of the Ref's campaigns this world is (campaign.js): a player's device keeps another one's villages out of it // the Journey runs on the Ref's device; the others get what players may see
  log:{[DEV]:JOURNAL.slice(-60).map(({id,t,who,label,undone})=>({id,t,who,label,undone}))}},(k,v)=>v instanceof Set?[...v]:v)}; // labels only: the host's Ref sees every device's journal
// The clock as the table sees it: whether combat has begun is the table's to know; the Ref's encounter results and the d10 at the
// end of the turn stay on the Ref's device.
function dtPub(){const {encs,held,again,was,dungeon,...t}=S.dt; // again (greed already used in this dungeon), was (the clock kept aside at a POI) and dungeon (which family lives there: a place's hidden fam, journey.js jDelvePoi) are the Ref's
return {...t,end:t.end?{step:t.end.step}:null}}
const BASE={},BASEH={},BASEDEV={}; // BASEDEV: the device the last taken version came from
// the crows this device brings to the table (owner, 2026-11-21): the Ref's device, all it holds; any other device, the crows the
// table already knows (taken from it: BASE) and the one its player picked (S.seat, session.js), never the rest of the device's crows
// The Ref's device: the open campaign's roster and the crows seated for the session (session.js sesTableIds), not its other crows.
const partyOut=()=>{if(S.role==='ref'){const T=sesTableIds();return PARTY.filter(c=>T.has(c.id))}return PARTY.filter(c=>BASE[c.id]!==undefined||c.id===S.seat)};
// RECV (ctk-recv, device): crows that first came to this device from a table (another player's, the Ref's). The rest are this device's own
// (made or imported here); a device from before the list counts every crow it held as its own. “Who do you play?” lists own crows only.
const RECV=new Set((()=>{try{const l=JSON.parse(store.get('recv')||'[]');return Array.isArray(l)?l.filter(x=>typeof x==='string'):[]}catch{return []}})());
const saveRecv=()=>store.set('recv',JSON.stringify([...RECV].filter(id=>PARTY.some(c=>c.id===id))));
const crowOwn=c=>!!c&&!RECV.has(c.id);
// HIST: the versions of each crow this device sent or took. A snapshot names, per crow, the version its device last took (base);
// the receiver merges against that one, so a change the other device already took in is not counted twice (XP given by the Ref,
// then counted by the player's rest), and a stale copy never overwrites a newer change.
const HIST={},hh=t=>{let h=5381;for(let i=0;i<t.length;i++)h=(h*33^t.charCodeAt(i))|0;return (h>>>0).toString(36)+'.'+t.length.toString(36)};
const remember=(id,t,sent)=>{const l=HIST[id]||(HIST[id]=[]);const e=l.find(e=>e[0]===t);if(e){if(sent)e[2]=true;return}l.push([t,hh(t),!!sent]);if(l.length>16)l.shift()};
const wasSent=(id,t)=>(HIST[id]||[]).some(e=>e[0]===t&&e[2]);
const baseOf=(l=PARTY)=>{const o={};for(const c of l)if(BASEH[c.id])o[c.id]=BASEH[c.id];return o};
const sentOut=()=>{for(const c of PARTY)remember(c.id,ser(c),true)};
// GONE: crows deleted at this table (id → when). A snapshot without a crow does not delete it (it may simply not have arrived
// there yet: two joins at once, a new crow made while an update was on its way); only a deletion does. A crow brought back by
// Undo carries back (when), which outranks an older deletion.
const GONE=(()=>{try{return JSON.parse(store.get('gone')||'{}')||{}}catch{return {}}})();
const saveGone=()=>{const e=Object.entries(GONE).sort((a,b)=>b[1]-a[1]).slice(0,200);for(const k of Object.keys(GONE))delete GONE[k];Object.assign(GONE,Object.fromEntries(e));store.set('gone',JSON.stringify(GONE))};
const goneOut=()=>GONE;
const alive=x=>!(GONE[x.id]>(x.back||0));
function crowGone(id){GONE[id]=Date.now();saveGone()}
// theirs, mine, and the version they started from (or, from an older version, the one we last agreed on) → the crow to keep
function mergeCrow(x,l,bh,dev){const X=ser(x);if(!l)return [x,false];const L=ser(l);if(L===X)return [x,false];
  // what we hold is that same device's earlier copy, untouched here: its newer one replaces it (three taps in a row are three snapshots)
  if(dev&&BASEDEV[x.id]===dev&&L===BASE[x.id])return [x,false];
  let b=BASE[x.id];if(bh){const f=(HIST[x.id]||[]).find(e=>e[1]===bh);if(f)b=f[0]}
  if(b===undefined||L===b)return [x,false];if(X===b)return [JSON.parse(L),!wasSent(x.id,L),true]; // ours is newer; already on its way (the channel keeps order), no need to send it again
  const B=JSON.parse(b),Lo=JSON.parse(L),out=JSON.parse(X);for(const k of Object.keys(Lo))if(ser(Lo[k])!==ser(B[k]))out[k]=Lo[k];return [out,ser(out)!==X]}
function backupLocal(){if(!PARTY.length)return;const t=Date.now(),l=JSON.parse(store.get('syncbak')||'[]');if(l.length&&t-l[l.length-1].t<120000)return;
  l.push({t,party:ser(PARTY),villages:ser(VILLAGES),...(S.role==='ref'&&campId()?{camp:campId()}:{})});store.set('syncbak',JSON.stringify(l.slice(-5)))}
function restoreLocal(k){const b=JSON.parse(store.get('syncbak')||'[]')[k];if(!b)return;const id=ME?.id;
  // villages belong to a campaign: a copy taken in another one brings back the crows only (one without a campaign is from the first)
  const same=S.role!=='ref'||!campId()||(b.camp||campFirstId()||campId())===campId();
  PARTY.splice(0,PARTY.length,...JSON.parse(b.party).map(reviveCrow));if(same){VILLAGES.splice(0,VILLAGES.length,...JSON.parse(b.villages));saveVillages()}
  ME=PARTY.find(c=>c.id===id)||PARTY[0]||null;NET.last='';render();toast(same?'Your local copy is back':'Your crows are back. The villages in that copy belong to another campaign and stay out.')}

function applyIn(msg,merge){
  const o=JSON.parse(msg);if(o.pics)picsIn(o.pics);const me=ME&&ME.id,lead=o.by==='ref'||o.by==null&&S.role!=='ref';backupLocal();
  // a player's device joining a table that has none of its crows yet: its player picks the one to play (the seat picker), the rest stay here
  const fresh=merge&&lead&&S.role!=='ref'&&!PARTY.some(c=>BASE[c.id]!==undefined||o.party.some(x=>x.id===c.id));
  for(const [dev,l] of Object.entries(o.log||{}))if(dev!==DEV)REMOTE_LOG[dev]=l;
  let gone=false;for(const [id,t] of Object.entries(o.gone||{}))if(typeof t==='number'&&!(GONE[id]>=t)){GONE[id]=t;gone=true}if(gone)saveGone();
  const inc=o.party.filter((x,i,a)=>alive(x)&&a.findLastIndex(y=>y.id===x.id)===i), // one copy per id (the last)
    // the Ref opened another campaign since this device last sat at its table: the villages held here are the other world's, they stay out
    other=lead&&o.camp&&S.role!=='ref'&&store.get('tablecamp')&&store.get('tablecamp')!==o.camp,
    mine=PARTY.filter(c=>alive(c)&&!inc.some(x=>x.id===c.id)),myV=merge&&!other?VILLAGES.filter(v=>!o.villages.some(x=>x.id===v.id)):[];
  if(lead&&o.camp&&S.role!=='ref'&&store.get('tablecamp')!==o.camp)store.set('tablecamp',o.camp);
  // compared as this device would hold it: reviveCrow reorders and fills fields, and a copy that differs from what arrived only
  // in that form looked like a change of our own forever (the snapshots then bounced between devices)
  let kept=false;const party=inc.map(x0=>{const x=JSON.parse(ser(reviveCrow(x0)));const [c,k,stale]=mergeCrow(x,PARTY.find(y=>y.id===x.id),o.base?.[x.id],o.dev);kept||=k;const t=ser(x);remember(x.id,t);
    if(!stale){BASE[x.id]=t;BASEH[x.id]=hh(t);BASEDEV[x.id]=o.dev}return c}); // a stale copy is not what the table agreed on
  {let n=0;for(const x of party)if(!PARTY.some(c=>c.id===x.id)&&!RECV.has(x.id)){RECV.add(x.id);n++}if(n)queueMicrotask(saveRecv)} // new here: from the table
  PARTY.splice(0,PARTY.length,...party.map(reviveCrow),...mine);
  ME=PARTY.find(c=>c.id===me)||PARTY[0]||null;store.set('crow',Math.max(0,PARTY.indexOf(ME)));
  VILLAGES.splice(0,VILLAGES.length,...o.villages,...myV);
  for(const it of o.custom)if(!IT[it.id]){addItemDef(it);CUSTOM.push(it)}
  store.set('customItems',JSON.stringify(CUSTOM));
  if('hex' in o)hxIn(o.hex); // the Ref's device keeps its full map and takes only the players' route
  if(o.hping)hxPingIn(o.hping);
  // the Ref's device sent it already projected (projecting twice would drop a stop waiting here); a stray copy never overwrites the Ref's own
  if(lead&&o.journey&&S.role!=='ref'&&!JourneyRules.validateJourney(o.journey).length)S.journey=jTook(o.journey);
  S.pool=o.pool;if(lead){S.here=o.here;if(o.phase!=null){S.phase=o.phase;store.set('phase',o.phase)}}
  sesTake(o,lead);LAST_DEV=o.dev||'';if(fresh&&!sesSeatOk()&&S.area!=='build')S.area='seat';
  if(lead){const t=S.dt,mine=S.role==='ref'?{encs:t.encs,fight:t.fight,held:t.held}:{encs:t.encs,held:t.held},end=t.end;Object.assign(t,o.dt,mine);if(end&&t.end&&t.end.step===end.step)t.end=end} // what only this device knew stays
  saveVillages();saveCrows();if(S.role==='ref')saveSession(); // kept now: the redraw (which also saves) waits while someone types, and a reload then lost the update
  // a joiner's own crows and villages that the table hasn't seen yet go back out on the next render
  // the host answers every update with the table as it now stands (hostIn), instead of passing raw snapshots on
  // a player answers its first snapshot from a table always: the host (a Ref who reloaded too) learns this device, its name and its pick again
  NET.last=NET.host||mine.some(c=>c.id===S.seat)||myV.length||kept||merge&&S.role==='player'?'':snap();
  redraw();
}
// The host takes a player's update and sends the merged table to everyone. Passing each raw snapshot on made every device answer
// every stale copy (dozens of messages per tap with four devices) and let one player's older copy pass for another's change.
let LAST_DEV=''; // the device the last snapshot came from: a connection learns whose it is (session.js forgets a device that leaves)
function hostIn(m){applyIn(m,false);if(NET.pending)window.syncOut()} // a redraw held back while the Ref types still sends
// Don't rebuild the page under someone's fingers: wait while they type or drag.
// A filter box keeps its text in state, so focus there doesn't hold the page back: a removed card must leave the list now.
function redraw(){const a=document.activeElement,sk=a?.matches?.('input[type=search]')?(a.id?'#'+a.id:a.dataset.key?`input.pq[data-key="${a.dataset.key}"]`:''):'';
  if(drag||a&&a.closest('#main,#invov,#panel')&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&!sk){NET.pending=true;return}
  NET.pending=false;const pos=sk?a.selectionStart:0;render();const n=sk&&$(sk);if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch{}}}
document.addEventListener('focusout',()=>NET.pending&&setTimeout(()=>NET.pending&&redraw(),0));
document.addEventListener('pointerup',()=>NET.pending&&setTimeout(()=>NET.pending&&redraw(),50));

// portraits (portrait.js) ride along only when this device has not sent them since its connections opened: compared without them
const withPics=(s,all)=>{const p=picsForSend(all);return Object.keys(p).length?s.slice(0,-1)+',"pics":'+JSON.stringify(p)+'}':s};
window.syncOut=()=>{if(!NET.ready)return;const s=snap();if(s===NET.last)return;NET.last=s;sentOut();const m=withPics(s);for(const c of NET.conns)if(c.open)c.send(m)};

function wire(c){
  c.on('open',()=>{NET.conns.push(c);NET.tries=0;PICS_SENT.clear();if(NET.host){NET.last=snap();sentOut();c.send(withPics(NET.last,true))}drawNet()});
  c.on('data',m=>{const first=!NET.ready;NET.ready=true;NET.fresh=false;if(NET.host){hostIn(m);if(LAST_DEV)c.dev=LAST_DEV}else applyIn(m,first);if(first)drawNet()});
  c.on('close',()=>{NET.conns=NET.conns.filter(x=>x!==c);drawNet();if(NET.host&&c.dev)sesDevGone(c.dev);if(!NET.host&&NET.peer)retry()});
}
function retry(){NET.ready=false;drawNet();if(NET.tries++<20)setTimeout(()=>NET.peer&&!NET.conns.length&&(NET.host?start():connect()),3000)}
// A direct link that finds no way between the two devices either fails (PeerJS: an error and no 'close', it never opened) or waits
// for ever: a join hung on Connecting… (owner, 2026-11-24). After 5 s the device goes through the public relays instead (relay.js),
// and stays with them for the rest of this table.
function connect(){if(NET.via==='relay')return relayJoin();if(!NET.peer||NET.peer.destroyed)return start();const c=NET.peer.connect(PFX+NET.code,{reliable:true});wire(c);
  const fail=()=>{if(c.open||c.failed)return;c.failed=true;c.close();if(NET.peer&&!NET.conns.length)relayJoin()};
  c.on('error',fail);setTimeout(fail,5000)}
// How two devices find each other: STUN finds the direct way through each router. PeerJS's own TURN relays (eu-0/us-0.turn.peerjs.com)
// are gone (their names no longer resolve); where no direct way exists, relay.js carries the table instead.
const PEER_OPTS={config:{iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'}]}};
// PeerJS is loaded only when a table is opened: at load it starts WebRTC (~300 ms of frozen page), which a solo game never needs
let PEERJS=null;
const loadPeer=()=>PEERJS??=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';s.onload=ok;s.onerror=()=>{PEERJS=null;s.remove();no()};document.head.append(s)});
function start(){if(TAB.blocked)return; // a tab that does not hold the game stays off the table (campaign.js)
  if(typeof Peer==='undefined'){loadPeer().then(start,()=>toast('Table sync needs the internet (the PeerJS script didn’t load).'));return}
  NET.peer?.destroy();NET.conns=[];
  const p=NET.peer=NET.host?new Peer(PFX+NET.code,PEER_OPTS):new Peer(PEER_OPTS);
  p.on('open',()=>{NET.tries=0;if(NET.host){NET.ready=true;NET.last=''}else connect();drawNet()});
  if(!NET.host)setTimeout(()=>{if(NET.peer===p&&!p.open&&!NET.conns.length)relayJoin()},5000); // PeerJS's broker itself out of reach
  p.on('connection',c=>NET.host&&wire(c));
  p.on('disconnected',()=>!p.destroyed&&p.reconnect());
  p.on('error',e=>{
    if(e.type==='unavailable-id')return NET.tries++<10?setTimeout(start,3000):toast(`Table ${NET.code} is already hosted somewhere else.`);
    if(e.type==='peer-unavailable'){if(NET.fresh&&!NET.host){const c=NET.code;NET.fresh=false;leaveTable();S.joinErr=c;return render()}toast(`No table ${NET.code} right now — is the host online? Retrying…`);return retry()}
    if(e.type==='network'||e.type==='server-error'||e.type==='socket-error')return retry();
    toast('Table sync: '+e.type)});
  drawNet();
}
function openTable(host,code){NET.host=host;NET.code=code;NET.ready=false;NET.tries=0;NET.via='';store.set('net',JSON.stringify({host,code}));start();if(host&&!TAB.blocked)relayHost(code)} // the host also listens on the relays (relay.js)
function leaveTable(){NET.peer?.destroy();NET.peer=null;NET.conns=[];NET.ready=false;NET.code='';relayStop();store.set('net','');if(S.role==='player')setPhase('');drawNet()} // a player off a table has no scene

// The Table button (#netbtn): a self-contained piece at the right end of the status line under the bar (owner, 2026-11-18; it was a
// bar cell). Its state is a mark of its own shape AND words, never colour alone (topbar.css):
//   on    — a filled green dot; the host also sees how many devices joined;   wait — a hollow sulphur ring, “Connecting…”;
//   lost  — a red diamond, the wifi struck through, “Lost · retrying”;           off  — a dashed ring, the wifi struck through, “Join a table”.
// The full state is always in its aria-label and title; the dialog (netDialog) is the same as before.
function netState(){const on=NET.ready&&(NET.host||NET.conns.length);return !NET.code?'off':on?'on':NET.tries>0?'lost':'wait'}
function drawNet(){const b=$('#netbtn');if(!b)return;
  const n=NET.conns.length,st=netState(),c=esc(NET.code||'');
  const say=st==='off'?'Shared table: host or join':`Table ${NET.code}: ${st==='lost'?'connection lost, retrying':st==='wait'?'connecting':NET.host?`you host it, ${n} device${n===1?'':'s'} joined`:'joined'}`;
  b.querySelector('.lbl').innerHTML=st==='off'?'<span class="w">Join a table</span>':`<span class="w">${st==='lost'?'Lost · retrying':st==='wait'?'Connecting…':'Table'} </span><b>${c}</b>`;
  b.querySelector('.netn')?.remove();if(st==='on'&&NET.host)b.insertAdjacentHTML('beforeend',`<span class="netn" aria-hidden="true">${n}</span>`);
  b.dataset.state=st;b.setAttribute('aria-label',say);b.title=say;if(typeof whereFit==='function')whereFit();
  const dl=$('#dlg');if(dl.open&&dl.dataset.k==='net')netDialog()}

function netDialog(){const dl=$('#dlg');dl.dataset.k='net';
  const st=!NET.code?'':NET.host?(NET.conns.length?`${NET.conns.length} device${NET.conns.length>1?'s':''} joined.`:'Waiting for players to join.'):NET.ready&&NET.conns.length?`Connected to the table${NET.via==='relay'?' through a relay':''}.`:'Connecting…';
  dl.innerHTML=NET.code?`<form method="dialog"><h2>Table <span class="tnum">${esc(NET.code)}</span></h2>
    <p>${st}</p><p class="small muted">${NET.host?'Players open this site, tap <b>Table</b> and type this code. Keep this device online: it holds the table.':'Crows, the loot pool, villages and the DT clock are shared with everyone at this table.'}</p>
    ${(()=>{const l=JSON.parse(store.get('syncbak')||'[]');return l.length?`<details style="margin:.5rem 0 1rem"><summary class="small">Restore my local copy</summary><p class="small muted">Copies of this device’s crows and villages, kept before table updates replaced them.</p><div class="row">${l.map((b,k)=>`<button type="button" class="btn sm" data-net="restore:${k}">${new Date(b.t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</button>`).reverse().join('')}</div></details>`:''})()}
    <div class="row" style="justify-content:space-between"><button type="button" class="btn ghost" data-net="leave">Leave the table</button><button class="btn primary">Done</button></div></form>`
   :`<form method="dialog"><h2>Table</h2><p class="small muted">Share crows, the loot pool, villages and the DT clock between devices. Needs the internet.</p>
    <p><b>Join a table</b></p>    <div class="row"><input type="text" id="netcode" placeholder="Code from the Ref" autocomplete="off" autocapitalize="characters" maxlength="8" style="text-transform:uppercase;flex:1" aria-label="Table code"><button type="button" class="btn primary" data-net="join">Join</button></div>
    <p class="small muted">After joining you pick the crow you play; the others stay on this device.</p>
    <p style="margin-top:1.25rem"><b>Or host one</b> <span class="small muted">— usually the Ref. The table’s state starts from this device.</span></p>
    <div class="row" style="justify-content:space-between"><button type="button" class="btn" data-net="host">Host a new table</button><button class="btn ghost">Close</button></div></form>`;
  dl.onclose=()=>{dl.dataset.k=''};
  dl.onclick=e=>{const b=e.target.closest('[data-net]');if(!b)return;const k=b.dataset.net;
    if(k==='leave'){leaveTable();render();netDialog()}
    if(k.startsWith('restore:')){restoreLocal(+k.slice(8));dl.close()}
    if(k==='host'){if(S.role==='ref'&&campNone()){dl.close();S.area='camps';render();return toast('Open or create a campaign first.')}let c='';for(let i=0;i<5;i++)c+='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)];openTable(true,c);render();netDialog()}
    if(k==='join'){const c=$('#netcode').value.trim().toUpperCase();if(!c)return $('#netcode').focus();openTable(false,c);render();netDialog()}};
  dl.onsubmit=null;$('#netcode')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dl.querySelector('[data-net=join]').click()}});
  if(!dl.open)dl.showModal()}

document.addEventListener('click',e=>{if(e.target.closest('#netbtn'))netDialog()});
// back to the same table after a reload
// a saved table reconnects once the page is idle, so its WebRTC start-up never lands on the first paint
try{const n=JSON.parse(store.get('net')||'null');if(n&&n.code)(window.requestIdleCallback||setTimeout)(()=>openTable(n.host,n.code),{timeout:2500})}catch{}
drawNet();
