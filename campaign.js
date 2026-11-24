'use strict';
/* CROW NEST — campaigns: save slots for the Ref's worlds on one device (owner, 2026-11-20; QA/2026-11-20-campaigns.md).
   A campaign is the WORLD: the villages, where
   the party is and the scene, the journey day, the session state (clock, combat, party loot pool, XP lines), the Journal, a
   session number and a roster of the crows that played in it (a last-known snapshot, for display only).
   Crows, display settings, the Ref's prepared loot, custom item cards and the table connection belong to the DEVICE and are never
   touched by a switch, and so is the hex map (Menu → Maps; owner, 2026-11-23: a tool, not part of play). Players' devices have no campaigns.
   Storage: the open campaign lives in the same ctk-* keys as always (every other script reads them as before). The others are
   parked under ctk-c-<id>-<key>; ctk-camps lists them all, ctk-camp names the open one. A switch parks the open world (written
   and read back), then empties the live world keys and copies the other campaign in (read back), then drops its parked copy.
   Each step is written to ctk-campswap first, so a page that dies halfway finishes or undoes the switch on the next load
   (campRecover, below, before app.js reads anything). Then the page reloads, so every script starts from the new world.
   This file loads BEFORE app.js: its top level uses localStorage only; everything else runs later. */
const CAMP_WORLD=['villages','places','here','phase','journey','jday','session','journal'];
// for the record (QA note): every other ctk-* key the code uses stays with the device
const CAMP_DEVICE=['role','theme','font','fs','dev','net','area','crows','crow','gone','syncbak','pendw','jexh','customItems','loot','demoGone','intro','sheetvar','tablecamp','camps','camp','campswap'];
const CAMP_PLAIN=['here','phase']; // plain text in storage; the rest is JSON
const CAMP_ID=/^c[a-z0-9]{4,24}$/;
const campK=(id,k)=>`ctk-c-${id}-${k}`;
let CAMP_LOCK=false; // set once a switch has written the new world: the old page must not write its world over it before the reload
const lsGet=k=>{try{return localStorage.getItem(k)}catch{return null}};

/* ---------- whose world this page plays in (owner, 2026-11-21; QA/2026-11-21-worlds.md) ---------- */
// The role is decided once per page: changing it writes ctk-role and reloads (app.js whoami), so nothing of the other role stays in memory.
// A player on a device that keeps the Ref's campaigns (ctk-camps exists, even empty) plays in a world of its own: every world key,
// and the player's table keys, live under ctk-p-<key> (store.get/set in app.js map them through campKey). A players-only device
// (no ctk-camps) keeps the plain keys: nothing is migrated. Crows, display, prepared loot, custom cards stay the device's.
const CAMP_ROLE0=lsGet('ctk-role')||'';
const CAMP_PKEYS=['hexmap','hexpub','hexdraft','villages','places','here','phase','journey','jday','session','journal','net','syncbak','tses','seat','tablecamp'];
const CAMP_PWORLD=CAMP_ROLE0==='player'&&lsGet('ctk-camps')!=null;
const campKey=k=>CAMP_PWORLD&&CAMP_PKEYS.includes(k)?'ctk-p-'+k:'ctk-'+k;

/* ---------- one tab at a time (owner, 2026-11-20) ---------- */
// The tab that changes the game holds ctk-tab = {id, t} and renews it every 1.5 s. Another tab of the site opened while the lock is
// fresh (younger than 5 s) writes nothing and shows “CROW NEST is open in another tab” with “Use here instead”, which takes the lock
// and reloads; the old tab sees the lock go (a storage event, its next renewal, or its next write) and stops the same way.
// A tab that crashed or closed without letting go is passed over once its lock is 5 s old. Every write through store.set checks
// the lock first (campLocked), so a tab that missed the event still writes nothing after the takeover.
const TAB={id:Math.random().toString(36).slice(2,10),blocked:false,why:'',iv:0},TAB_TTL=5000,TAB_BEAT=1500;
const tabLock=()=>{try{return JSON.parse(localStorage.getItem('ctk-tab')||'null')}catch{return null}};
const tabMine=()=>{const l=tabLock();return !l||l.id===TAB.id};
function tabClaim(){try{localStorage.setItem('ctk-tab',JSON.stringify({id:TAB.id,t:Date.now()}))}catch{}}
function tabBeat(){if(TAB.blocked)return;if(!tabMine())return tabBlock('taken');tabClaim()}
function tabStart(){let take=false;try{take=sessionStorage.getItem('ctk-tabtake')==='1';sessionStorage.removeItem('ctk-tabtake')}catch{}
  const l=tabLock();if(!take&&l&&l.id!==TAB.id&&Date.now()-(+l.t||0)<TAB_TTL){TAB.blocked=true;TAB.why='open';return}
  tabClaim();clearInterval(TAB.iv);TAB.iv=setInterval(tabBeat,TAB_BEAT)}
function tabBlock(why){if(TAB.blocked)return;TAB.blocked=true;TAB.why=why;clearInterval(TAB.iv);
  try{if(typeof NET!=='undefined'&&NET.peer){NET.peer.destroy();NET.peer=null;NET.conns=[];NET.ready=false;relayStop()}}catch{} // the other tab holds the table now
  tabShow()}
function tabShow(){if(!document.body)return;let d=document.getElementById('tabdlg');if(!d){d=document.createElement('dialog');d.id='tabdlg';d.className='tabdlg';d.setAttribute('aria-labelledby','tabdlg-h');document.body.append(d);
    d.addEventListener('cancel',e=>e.preventDefault())}
  d.innerHTML=`<h2 id="tabdlg-h">CROW NEST is ${TAB.why==='taken'?'now ':''}open in another tab</h2>
   <p>${TAB.why==='taken'?'You went on in another tab, so this one stopped.':'Only one tab can change the game on this device at a time.'} This tab saves nothing and is not connected to the table.</p>
   <p>Close this tab, or use CROW NEST here instead: the other tab stops and shows this message, and this one reloads with the latest game.</p>
   <div class="row"><button type="button" class="btn primary" id="tabtake">Use here instead</button></div>`;
  d.querySelector('#tabtake').onclick=()=>{try{sessionStorage.setItem('ctk-tabtake','1')}catch{}tabClaim();location.reload()};
  if(!d.open){for(const x of document.querySelectorAll('dialog[open]'))if(x!==d)x.close();d.showModal()}d.querySelector('#tabtake').focus()}
addEventListener('storage',e=>{if(e.key==='ctk-tab'&&!TAB.blocked&&!tabMine())tabBlock('taken')});
addEventListener('pagehide',()=>{if(!TAB.blocked&&tabMine())try{localStorage.removeItem('ctk-tab')}catch{}}); // a reload or a closed tab lets go at once
addEventListener('pageshow',e=>{if(e.persisted&&!TAB.blocked){const l=tabLock();if(l&&l.id!==TAB.id&&Date.now()-(+l.t||0)<TAB_TTL)tabBlock('taken');else tabStart()}});
tabStart();
// store.set asks before every write (app.js): nothing from a tab that does not hold the lock, and no world key while a switch reloads
function campLocked(k){if(TAB.blocked)return true;if(!tabMine()){tabBlock('taken');return true}return CAMP_LOCK&&CAMP_WORLD.includes(k)}
// no campaign open on the Ref's device: the world lives in memory only (store.set keeps mem), so nothing the Ref taps there
// (a journal line, a monster added from Look up, the default clock) turns into a campaign on the next load
const campVoid=k=>CAMP_ROLE0==='ref'&&CAMP_WORLD.includes(k)&&!campId();
const lsDel=k=>{if(TAB.blocked)return;try{localStorage.removeItem(k)}catch{}};
// written and read back; throws when the browser refuses (QuotaExceededError) or keeps something else
function lsPut(k,v){if(TAB.blocked)throw Error('This tab does not hold the game');localStorage.setItem(k,v);if(localStorage.getItem(k)!==v)throw Error('storage did not keep '+k)}
const campQuota=e=>!!e&&(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'||e.code===22||e.code===1014||/quota|did not keep/i.test(e.message||''));
const campNewId=()=>'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function campMetaRead(){try{const l=JSON.parse(lsGet('ctk-camps')||'null');return Array.isArray(l)&&l.every(e=>e&&CAMP_ID.test(e.id)&&typeof e.name==='string')?l:null}catch{return null}}
const campMetaWrite=l=>lsPut('ctk-camps',JSON.stringify(l));
// the ids that have parked keys (a list lost or broken is rebuilt from these: nothing parked is ever dropped)
function campParkedIds(){const s=new Set();try{for(let i=0;i<localStorage.length;i++){const m=/^ctk-c-(c[a-z0-9]{4,24})-(\w+)$/.exec(localStorage.key(i)||'');if(m&&CAMP_WORLD.includes(m[2]))s.add(m[1])}}catch{}return [...s]}

/* ---------- an interrupted switch ---------- */
// ctk-campswap = {from,to,step,keys}: keys are the world keys the campaign being opened has. Steps:
//   park  — the open world is being copied out: the live keys are untouched; undo = drop the partial copy
//   load  — the parked copy of `from` is complete; the live keys are being replaced by `to`: redo the load (both copies exist)
//   clean — `to` is live and current; its parked copy is being dropped: finish that
function campLoad(j){for(const k of CAMP_WORLD)lsDel('ctk-'+k);if(!j.to)return;
  for(const k of j.keys){const v=lsGet(campK(j.to,k));if(v!=null)lsPut('ctk-'+k,v)}}
function campUnload(j){ // back to `from`: its parked copy is complete (none: no campaign is open)
  for(const k of CAMP_WORLD)lsDel('ctk-'+k);if(!j.from){lsDel('ctk-camp');return}
  for(const k of CAMP_WORLD){const v=lsGet(campK(j.from,k));if(v!=null)lsPut('ctk-'+k,v)}
  for(const k of CAMP_WORLD)lsDel(campK(j.from,k));lsPut('ctk-camp',j.from);campUnpark(j.from)}
const campUnpark=id=>{const l=campMetaRead(),e=l&&l.find(x=>x.id===id);if(e?.keys){delete e.keys;try{campMetaWrite(l)}catch{}}};
// deleting the open campaign (campDelete): its live world, its entry and ctk-camp go; nothing of it is parked
function campDrop(j){for(const k of CAMP_WORLD)lsDel('ctk-'+k);lsDel('ctk-camp');const l=campMetaRead();if(l){const i=l.findIndex(x=>x.id===j.del);if(i>=0){l.splice(i,1);campMetaWrite(l)}}
  for(const k of CAMP_WORLD)lsDel(campK(j.del,k))}
function campFinish(j){lsPut('ctk-camp',j.to);j.step='clean';lsPut('ctk-campswap',JSON.stringify(j));for(const k of CAMP_WORLD)lsDel(campK(j.to,k));
  const l=campMetaRead();if(l){const e=l.find(x=>x.id===j.to);if(e){delete e.keys;try{campMetaWrite(l)}catch{}}}lsDel('ctk-campswap')}
let CAMP_RECOVERED='';
function campRecover(){let j=null;try{j=JSON.parse(lsGet('ctk-campswap')||'null')}catch{}if(!j)return;
  // from: null when no campaign was open (a load without parking); step 'del': the open campaign (del) is being deleted, then `to` (if any) opens
  const id=v=>CAMP_ID.test(v||''),del=j.step==='del';
  if(j.from!=null&&!id(j.from)||!(id(j.to)||del&&j.to==null)||del&&!id(j.del)||!Array.isArray(j.keys)){lsDel('ctk-campswap');return}
  j.keys=j.keys.filter(k=>CAMP_WORLD.includes(k));
  try{
    if(del){campDrop(j);if(!j.to){lsDel('ctk-campswap');CAMP_RECOVERED='gone';return}j.step='load';lsPut('ctk-campswap',JSON.stringify(j))}
    if(j.step==='park'){if(j.from){for(const k of CAMP_WORLD)lsDel(campK(j.from,k));campUnpark(j.from)}lsDel('ctk-campswap');CAMP_RECOVERED='back';return}
    if(j.step==='load'){try{campLoad(j)}catch(e){campUnload(j);lsDel('ctk-campswap');CAMP_RECOVERED='back';return}campFinish(j);CAMP_RECOVERED='done';return}
    if(j.step==='clean'){campFinish(j);CAMP_RECOVERED='done'}
  }catch{} // the journal stays: the next load tries again
}
if(!TAB.blocked)campRecover(); // a tab that does not hold the game never finishes another tab's switch

/* ---------- the list ---------- */
const campNow=()=>Date.now();
function campRosterOf(raw){let l=[];try{l=JSON.parse(raw||'[]')}catch{}let g={};try{g=JSON.parse(lsGet('ctk-gone')||'{}')||{}}catch{}
  return (Array.isArray(l)?l:[]).filter(c=>c&&c.id&&!(g[c.id]>(c.back||0))).map(c=>({id:c.id,name:String(c.name||'A crow'),bg:String(c.bg||''),t:campNow()}))}
// the live world holds a game: a map, a village or a Journal line (the default clock, journey and day do not count). Only such a
// world becomes a campaign by itself (an old save from before campaigns, or a list that was lost).
function campLegacy(){
  return ['villages','journal'].some(k=>{try{const v=JSON.parse(lsGet('ctk-'+k)||'null');return Array.isArray(v)&&v.length>0}catch{return false}})}
// the list exists, every parked campaign is in it and the open world (if any) has an entry. No campaign is a valid state (owner,
// 2026-11-21): ctk-camps = [] and no ctk-camp, e.g. a new Ref device or after deleting the last one; nothing is created for it.
// First open of an old save: its game becomes campaign 1, session 1 (owner, 2026-11-20), named after its map; nothing is copied or moved.
function campEnsure(){let l=campMetaRead();const had=!!l;l=l||[];let cur=lsGet('ctk-camp'),ch=!had;if(cur&&!CAMP_ID.test(cur))cur=null;
  for(const id of campParkedIds())if(!l.some(e=>e.id===id)&&id!==cur){l.push({id,name:'Recovered campaign',created:campNow(),last:0,n:1,roster:[],keys:CAMP_WORLD.filter(k=>lsGet(campK(id,k))!=null)});ch=true}
  if(!cur||!l.some(e=>e.id===cur)){
    if(campLegacy()){ // the live world has no entry: it gets one (with the id ctk-camp names, if any)
      let map=null;try{map=JSON.parse(lsGet('ctk-hexmap')||'null')?.name||null}catch{}
      const e={id:cur||campNewId(),name:had?'Recovered campaign':map?String(map).slice(0,60):'My campaign',created:campNow(),last:campNow(),n:1,roster:had?[]:campRosterOf(lsGet('ctk-crows')),first:!had};
      l.unshift(e);cur=e.id;ch=true}
    else{if(cur)lsDel('ctk-camp');cur=null}} // nothing worth keeping is live: no campaign is open
  const ce=cur&&l.find(e=>e.id===cur);if(ce?.keys){delete ce.keys;ch=true} // the open one is live, not parked
  if(ch){try{campMetaWrite(l);if(cur)lsPut('ctk-camp',cur)}catch{}}
  return {l,cur}}
const campId=()=>{const c=lsGet('ctk-camp');return c&&CAMP_ID.test(c)?c:null};
// the Ref's device has no campaign open: the table's screens wait on Campaigns (app.js renderBody), nothing is hosted or started
const campNone=()=>CAMP_ROLE0==='ref'&&typeof S!=='undefined'&&S.role==='ref'&&!campId();
// a Ref's device knows it keeps campaigns from the first load on (ctk-camps, [] at first): a player there gets a world of its own
if(!TAB.blocked&&CAMP_ROLE0==='ref')campEnsure();
// the first campaign holds whatever this device kept before campaigns existed (a local backup without a campaign is from it)
const campFirstId=()=>(campMetaRead()||[]).find(e=>e.first)?.id||null;

/* ---------- what a row says ---------- */
function campRaw(id){const cur=id===campId(),o={};for(const k of CAMP_WORLD){const v=lsGet(cur?'ctk-'+k:campK(id,k));if(v!=null)o[k]=v}return o}
const campBytes=o=>Object.entries(o).reduce((a,[k,v])=>a+2*(k.length+v.length),0);
function campSumRaw(w){const P=k=>{try{return JSON.parse(w[k]||'null')}catch{return null}};const m=P('hexmap'),v=P('villages'),s=P('session');
  return {map:m&&typeof m==='object'&&m.name?String(m.name):null,vil:Array.isArray(v)?v.length:0,day:+(s?.rtravel?.day||m?.day||0)||0}}
function campSumLive(){return {map:typeof HX!=='undefined'&&HX?String(HX.name||'Hex map'):null,vil:typeof VILLAGES!=='undefined'?VILLAGES.length:0,day:+(S?.rtravel?.day||0)}}
// newest first, then the open one stays on top
function campList(){const {l,cur}=campEnsure();return l.map(e=>({...e,current:e.id===cur,sum:e.id===cur&&typeof VILLAGES!=='undefined'?campSumLive():e.sum||campSumRaw(campRaw(e.id)),
  last:e.id===cur?Math.max(e.last||0,(typeof JOURNAL!=='undefined'&&JOURNAL.at(-1)?.t)||0):e.last||0}))}
const campCurrent=()=>campList().find(e=>e.current)||null;
const campSession=()=>campCurrent()?.n||1;
function campSetSession(n,id=campId()){n=Math.max(1,Math.min(9999,Math.floor(+n)||1));const l=campEnsure().l,e=l.find(x=>x.id===id);if(!e)return false;e.n=n;campMetaWrite(l);return true}
function campRename(id,name){name=String(name||'').trim().slice(0,60);if(!name)return false;const l=campEnsure().l,e=l.find(x=>x.id===id);if(!e)return false;e.name=name;campMetaWrite(l);return true}
const campRoster=(id=campId())=>(campEnsure().l.find(e=>e.id===id)?.roster||[]).map(r=>({...r}));

/* ---------- the roster: crows that played here ---------- */
// A crow joins the roster when it changes while this campaign is open on the Ref's device (a player's update counts), or when it
// is new here. A crow that sits unchanged on this device from another campaign is not counted. The entry is a snapshot for display.
const CAMP_SEEN=new Map();let CAMP_TICK=0;
function campTick(force){if(S.role!=='ref'||typeof PARTY==='undefined'||CAMP_LOCK)return;const t=campNow();if(!force&&t-CAMP_TICK<2000)return;CAMP_TICK=t;
  const l=campMetaRead(),id=campId(),e=l&&l.find(x=>x.id===id);if(!e)return;e.roster??=[];let ch=false;
  for(const c of PARTY){const s=ser(c),was=CAMP_SEEN.get(c.id);CAMP_SEEN.set(c.id,s);const r=e.roster.find(x=>x.id===c.id);
    const snap={id:c.id,name:String(c.name||''),bg:String(c.bg||''),lv:level(c).lv,dead:crowDead(c)};
    if(r){if(r.name!==snap.name||r.bg!==snap.bg||r.lv!==snap.lv||!!r.dead!==snap.dead){Object.assign(r,snap,{t});ch=true}}
  } // who joins the roster: the attendance of a session (campRosterAdd, session.js), not a change seen here
  if(e.needHome&&typeof VILLAGES!=='undefined'&&VILLAGES.some(v=>v.home)){delete e.needHome;ch=true} // the first step is done
  if(ch)try{campMetaWrite(l)}catch{}}
let CAMP_BASE_DONE=false;
// the attendance of a session joins the roster (session.js: Start, a late player let in); a snapshot for display
function campRosterAdd(cs){const l=campMetaRead(),e=l&&l.find(x=>x.id===campId());if(!e||!cs.length)return;e.roster??=[];const t=campNow();
  for(const c of cs){const snap={id:c.id,name:String(c.name||''),bg:String(c.bg||''),lv:level(c).lv,dead:crowDead(c),t},r=e.roster.find(x=>x.id===c.id);if(r)Object.assign(r,snap);else e.roster.push(snap)}
  try{campMetaWrite(l)}catch{}}
function campBaseline(){for(const c of PARTY)CAMP_SEEN.set(c.id,ser(c));CAMP_BASE_DONE=true}

/* ---------- switching ---------- */
// Everything this page holds goes to its keys first (the redraw saves most of it on every render; these are the rest).
function campFlush(){try{saveSession();saveVillages();saveJournal();if(typeof jPersist==='function')jPersist();if(typeof hxDraftKeep==='function')hxDraftKeep();saveCrows()}catch{}}
class CampFull extends Error{constructor(m){super(m||'Not enough space on this device');this.name='CampFull'}}
// stop: for tests only — leave the switch as a crashed page would, after that step ('park', 'load-half', 'clean')
// from: null when no campaign is open (a new device, the open one just deleted): nothing is parked, the other world is loaded
function campSwap(from,to,stop){const l=campMetaRead(),A=from?l.find(e=>e.id===from):null;
  const keys=CAMP_WORLD.filter(k=>lsGet(campK(to,k))!=null); // what is really parked, not what the list says
  const j={from:A?from:null,to,step:'park',keys,t:campNow()};
  try{lsPut('ctk-campswap',JSON.stringify(j))}catch(e){lsDel('ctk-campswap');throw new CampFull()}
  const live={};if(A)for(const k of CAMP_WORLD){const v=lsGet('ctk-'+k);if(v!=null)live[k]=v}
  if(A)try{for(const k of CAMP_WORLD){if(k in live)lsPut(campK(from,k),live[k]);else lsDel(campK(from,k))}
    A.keys=Object.keys(live);A.sum=campSumRaw(live);A.last=Math.max(A.last||0,(typeof JOURNAL!=='undefined'&&JOURNAL.at(-1)?.t)||0,campNow());
    A.uid=Math.max(A.uid||0,typeof UID==='number'?UID:0);A.size=campBytes(live);campMetaWrite(l)}
  catch(e){for(const k of CAMP_WORLD)lsDel(campK(from,k));delete A.keys;lsDel('ctk-campswap');throw campQuota(e)?new CampFull():e}
  if(stop==='park')return 'stopped';
  j.step='load';try{lsPut('ctk-campswap',JSON.stringify(j))}catch(e){if(A)for(const k of CAMP_WORLD)lsDel(campK(from,k));lsDel('ctk-campswap');throw new CampFull()}
  if(stop==='load-half'){for(const k of CAMP_WORLD)lsDel('ctk-'+k);const v=lsGet(campK(to,keys[0]));if(keys[0]&&v!=null)lsPut('ctk-'+keys[0],v);return 'stopped'}
  try{campLoad(j)}catch(e){try{campUnload(j)}finally{lsDel('ctk-campswap')}throw campQuota(e)?new CampFull():e}
  if(stop==='clean'){lsPut('ctk-camp',to);j.step='clean';lsPut('ctk-campswap',JSON.stringify(j));return 'stopped'}
  campFinish(j);return 'done'}
// Open another campaign: park this world, bring that one in, reload. A table must be left first (campOpenUI asks).
function campOpen(id,o={}){const {l,cur}=campEnsure();if(cur&&id===cur)return 'current';if(!l.some(e=>e.id===id))throw Error('No such campaign');
  if(sessionOn())throw Error(campSessionWhy());
  if(typeof NET!=='undefined'&&NET.code&&!o.leaveTable)throw Error('table');
  campFlush();const r=campSwap(cur,id,o.stop);CAMP_LOCK=true; // synchronous: nothing reaches the table in between
  if(typeof NET!=='undefined'&&NET.code)leaveTable(); // only once the switch is done: a full storage leaves the table as it was
  if(r==='stopped')return r;
  S.area=o.area||'session';try{lsPut('ctk-area',S.area);sessionStorage.setItem('ctk-campnote',JSON.stringify({id,left:!!o.leaveTable}))}catch{}
  if(o.reload!==false)setTimeout(()=>location.reload(),30);return 'done'}
// a new world, parked. Its home village (owner, 2026-11-20): home 'create' (default) — none yet, the village editor is the first
// step when it opens (needHome); or {camp, id} — a copy of a village from this or a parked campaign (campVillages), as it is
// now, made home. A Hexer map or none. Session 1, empty pool, empty Journal. Returns its id; campOpen(id) opens it.
function campNew(o={}){const {l}=campEnsure();const id=campNewId(),name=String(o.name||'').trim().slice(0,60)||'New campaign';
  const pick=o.home&&typeof o.home==='object'?campVillages().find(x=>x.camp===o.home.camp&&x.v.id===o.home.id):null;
  if(o.home&&typeof o.home==='object'&&!pick)throw Error('That village is not on this device');
  const vil=pick?[{...JSON.parse(JSON.stringify(pick.v)),id:'v'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),home:true}]:[];
  const w={villages:JSON.stringify(vil),here:vil[0]?.id||'',phase:vil.length?'village':'',journal:'[]'}; // a picked home village: the party is there (owner)
  if(o.map&&typeof o.map==='object'){const m={...o.map,day:1,moved:0};w.hexmap=JSON.stringify(m)}
  campPark(l,{id,name,created:campNow(),last:0,n:1,roster:[],...(pick?{}:{needHome:true})},w);return id}
// every village on this device: the open campaign's and the parked ones', with the campaign each belongs to
function campVillages(){const {l,cur}=campEnsure(),out=[];
  for(const e of l){let vs=[];if(e.id===cur&&typeof VILLAGES!=='undefined')vs=VILLAGES;else try{vs=JSON.parse(lsGet(e.id===cur?'ctk-villages':campK(e.id,'villages'))||'[]')}catch{}
    for(const v of Array.isArray(vs)?vs:[])if(v&&v.id&&v.name)out.push({camp:e.id,campName:e.name,v})}
  return out}
// the open campaign has no home village yet: the Ref's first step (campHomeHTML on the table's screens, the landing after it opens)
const campNeedsHome=()=>{if(S.role!=='ref'||typeof VILLAGES==='undefined'||VILLAGES.some(v=>v.home))return false;const l=campMetaRead();return !!l?.find(e=>e.id===campId())?.needHome};
function campHomeHTML(){if(S.area!=='session'||!campNeedsHome())return '';const c=campCurrent(),onV=S.tab.session==='village';
  return `<div class="banner cp-home" role="status"><span class="msg"><b>${esc(c?.name||'This campaign')} starts with its home village.</b> ${onV?'Create it here: its institutions decide what the crows can buy, sell and do. Keep “The crows’ home village” ticked.':'Nothing else is set up until it exists.'}</span>${onV?'':'<button class="btn sm primary" data-action="goto" data-v="session/village">Create the home village →</button>'}</div>`}
// the session starter (session.js) says when a session is running. Switching campaigns waits
// for the end of a session (owner, 2026-11-20): campOpen and the Campaigns screen refuse while sessionOn().
function sessionOn(){return typeof S!=='undefined'&&S.role==='ref'&&!!S.ses?.on} // session.js: started on the starter, ended by End session
const campSessionWhy=()=>`End session ${campSession()} first (Menu → End session).`;
// writes a parked campaign: its keys (read back), then its list entry; nothing is left half-written
function campPark(l,e,w){const ks=Object.keys(w).filter(k=>CAMP_WORLD.includes(k));
  try{for(const k of ks)lsPut(campK(e.id,k),w[k]);e.keys=ks;e.sum=campSumRaw(w);e.size=campBytes(w);l.push(e);campMetaWrite(l)}
  catch(err){for(const k of CAMP_WORLD)lsDel(campK(e.id,k));throw campQuota(err)?new CampFull():err}}
// delete a campaign. A parked one: its keys, then its entry. The open one too (owner, 2026-11-21): its live world, its entry and
// ctk-camp go (journal step 'del'), then the most recently played other campaign is loaded without parking, else no campaign is
// open; the page reloads. Crows, prepared loot, custom cards and display settings stay. Not while its session runs.
// The one the open campaign gives way to: the other most recently played
const campNext=(l,cur)=>l.filter(e=>e.id!==cur).sort((a,b)=>(b.last||0)-(a.last||0))[0]||null;
function campDelete(id,o={}){const {l,cur}=campEnsure();const i=l.findIndex(e=>e.id===id);if(i<0)return false;
  if(id!==cur){for(const k of CAMP_WORLD)lsDel(campK(id,k));l.splice(i,1);campMetaWrite(l);return true}
  if(sessionOn())throw Error(campSessionWhy());
  const nx=campNext(l,cur),j={from:null,to:nx?.id||null,step:'del',del:cur,keys:nx?CAMP_WORLD.filter(k=>lsGet(campK(nx.id,k))!=null):[],t:campNow()};
  lsPut('ctk-campswap',JSON.stringify(j));CAMP_LOCK=true; // from here on nothing of this page reaches its world keys
  campDrop(j);
  if(j.to){j.step='load';lsPut('ctk-campswap',JSON.stringify(j));try{campLoad(j)}catch(e){try{campUnload(j)}finally{lsDel('ctk-campswap')}}
    if(lsGet('ctk-campswap'))campFinish(j)}
  else lsDel('ctk-campswap');
  if(typeof NET!=='undefined'&&NET.code)leaveTable(); // the table was this campaign's
  S.area=j.to?'session':'camps';try{lsPut('ctk-area',S.area);sessionStorage.setItem('ctk-campnote',JSON.stringify({id:j.to,gone:l[i].name}))}catch{}
  if(o.reload!==false)setTimeout(()=>location.reload(),30);return true}

/* ---------- the campaign file ---------- */
// {format:'crow-nest-campaign', v:1, name, sessionN, roster, world:{key: value}, items}. No crows. JSON keys hold their JSON; a value
// that does not parse is kept as {$raw}. items: the custom item cards the world names (a Ref-made card in the pool, an enchanted blade).
function campFile(id){const e=campEnsure().l.find(x=>x.id===id);if(!e)return null;if(id===campId())campFlush();const raw=campRaw(id),world={};
  for(const [k,v] of Object.entries(raw)){if(CAMP_PLAIN.includes(k)){world[k]=v;continue}try{world[k]=JSON.parse(v)}catch{world[k]={$raw:v}}}
  const all=Object.values(raw).join('\n'),items=(typeof CUSTOM!=='undefined'?CUSTOM:[]).filter(it=>all.includes('"'+it.id+'"'));
  return {format:'crow-nest-campaign',v:1,name:e.name,sessionN:e.n||1,roster:e.roster||[],exported:new Date().toISOString(),world,items}}
const campFileName=n=>(String(n).replace(/[^\w-]+/g,'_').replace(/^_+|_+$/g,'')||'campaign')+'.crow-nest-campaign.json';
function campDownload(id){const f=campFile(id);if(!f)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(f)],{type:'application/json'}));
  a.download=campFileName(f.name);a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);return f}
// what is wrong with a file ('' when it can be imported)
function campCheck(f){if(!f||typeof f!=='object')return 'This is not a campaign file.';if(f.format!=='crow-nest-campaign')return f.hexes?'This is a Hexer map. Load it in Menu → Maps.':'This is not a CROW NEST campaign file.';
  if(f.v!==1)return `This campaign file is version ${String(f.v).slice(0,10)}; this CROW NEST reads version 1.`;
  if(typeof f.name!=='string'||!f.name.trim())return 'The campaign file has no name.';if(!f.world||typeof f.world!=='object'||Array.isArray(f.world))return 'The campaign file has no world.';
  const w=f.world,arr=k=>w[k]==null||Array.isArray(w[k])||w[k]?.$raw!=null,obj=k=>w[k]==null||typeof w[k]==='object';
  if(!arr('villages')||!arr('places')||!arr('journal'))return 'The places or the Journal in this file are damaged.';
  if(!obj('hexmap')||!obj('session')||!obj('journey'))return 'The map, the session or the journey in this file is damaged.';
  if(['here','phase'].some(k=>w[k]!=null&&typeof w[k]!=='string'))return 'Where the party is in this file is damaged.';
  if(f.items!=null&&!Array.isArray(f.items))return 'The item cards in this file are damaged.';return ''}
// a new campaign from a file: never replaces one already here; a name already used gets a number
function campImport(f){const bad=campCheck(f);if(bad)throw Error(bad);const {l}=campEnsure();
  let name=f.name.trim().slice(0,56),base=name,k=2;while(l.some(e=>e.name.toLowerCase()===name.toLowerCase()))name=`${base} (${k++})`;
  const w={};for(const [key,v] of Object.entries(f.world)){if(!CAMP_WORLD.includes(key)||v===undefined)continue;w[key]=CAMP_PLAIN.includes(key)?String(v):v&&v.$raw!=null?String(v.$raw):JSON.stringify(v)}
  const roster=(Array.isArray(f.roster)?f.roster:[]).filter(r=>r&&r.id).map(r=>({id:String(r.id),name:String(r.name||'A crow').slice(0,60),bg:String(r.bg||'').slice(0,60),lv:+r.lv||1,dead:!!r.dead,t:+r.t||0}));
  const id=campNewId();campPark(l,{id,name,created:campNow(),last:0,n:Math.max(1,Math.floor(+f.sessionN)||1),roster,imported:campNow()},w);
  // the item cards it names that this device lacks (device data: added, never replaced)
  if(Array.isArray(f.items)&&typeof addItemDef==='function'){let n=0;for(const it of f.items)if(it&&typeof it.id==='string'&&it.name&&!IT[it.id]){addItemDef(it);CUSTOM.push(it);n++}if(n)store.set('customItems',JSON.stringify(CUSTOM))}
  return {id,name,renamed:name!==base}}

/* ---------- storage ---------- */
function campUsage(){let b=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);b+=2*(k.length+(localStorage.getItem(k)||'').length)}}catch{}return b}
const campMB=b=>b<1e6?`${Math.max(1,Math.round(b/1024))} KB`:`${(b/1048576).toFixed(1)} MB`;

/* ---------- the Campaigns screen (the Ref's; Menu → Campaigns, Home) ---------- */
const CAMP_IC={more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  up:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',down:'<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  pen:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',num:'<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',bin:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  book:'<path d="M5 19.5V5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2 2 2 0 0 0 2 2h12"/><path d="M10 3v7l2-1.6 2 1.6V3"/>'};
const campSvg=(k,w=20)=>`<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CAMP_IC[k]}</svg>`;
function campAgo(t){if(!t)return 'not played yet';const d=Math.floor((campNow()-t)/864e5),D=new Date(t);
  if(d<1&&new Date().toDateString()===D.toDateString())return 'last played today';if(d<2)return 'last played yesterday';if(d<14)return `last played ${d} days ago`;if(d<60)return `last played ${Math.round(d/7)} weeks ago`;
  return 'last played in '+D.toLocaleDateString('en-GB',{month:'long',...(D.getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{})})}
function campCrows(e,max=3){const r=(e.roster||[]).filter(x=>!x.dead);if(!r.length)return (e.roster||[]).length?'every crow fallen':'no crows yet';
  return r.length>max?`${r.length} crows`:r.map(x=>x.name).join(', ')}
const campSub=e=>[e.current&&sessionOn()?`Session ${e.n||1} on`:`Session ${e.n||1} next`,campCrows(e),`${e.sum?.vil||0} village${e.sum?.vil===1?'':'s'}`,e.sum?.day?'day '+e.sum.day:'',campAgo(e.last)].filter(Boolean).join(' · ');
function campsHTML(){if(S.role!=='ref')return '';const L=campList(),c=L.find(e=>e.current),U=S.campUi??={menu:null};
  const others=L.filter(e=>!e.current).sort((a,b)=>(b.last||0)-(a.last||0)),rows=[c,...others].filter(Boolean),used=campUsage();
  const row=e=>{const open=U.menu===e.id,sz=e.current?campBytes(campRaw(e.id)):e.size||campBytes(campRaw(e.id));
    return `<li class="cp-row${e.current?' cur':''}"><span class="cp-t"><span class="nm">${esc(e.name)}</span>${e.current?'<span class="cp-cur">current</span>':''}<span class="sub">${esc(campSub(e))} · ${campMB(sz)}</span></span>
     ${e.current?`<button type="button" class="btn primary cp-cont" data-action="ses-continue" aria-label="Continue ${esc(e.name)}">Continue →</button>`:`<button type="button" class="btn" data-action="camp-open" data-v="${e.id}" aria-label="Open ${esc(e.name)}">Open</button>`}
     <button type="button" class="cp-more" data-action="camp-more" data-v="${e.id}" aria-label="More for ${esc(e.name)}" aria-haspopup="menu" aria-expanded="${open}">${campSvg('more')}</button>
     ${open?`<div class="cp-pop" role="menu" aria-label="${esc(e.name)}"><button type="button" role="menuitem" data-action="camp-export" data-v="${e.id}">${campSvg('down',18)} Export campaign file</button><button type="button" role="menuitem" data-action="camp-rename" data-v="${e.id}">${campSvg('pen',18)} ${nest('Rename')}</button><button type="button" role="menuitem" data-action="camp-num" data-v="${e.id}">${campSvg('num',18)} ${nest('Session number')}</button><hr><button type="button" role="menuitem" class="bad" data-action="camp-del" data-v="${e.id}">${campSvg('bin',18)} Delete</button></div>`:''}</li>`};
  // no campaign on this device (owner, 2026-11-21): one line and the two ways to get one, nothing else
  if(!L.length)return `<div class="cp cp-none"><p class="cp-none-t">No campaign on this device</p>
   <div class="cp-acts"><button type="button" class="btn primary" data-action="camp-new">${campSvg('plus',18)} ${nest('New campaign')}</button><label class="btn cpfile">${campSvg('up',18)} ${nest('Import campaign file')}<input type="file" id="campfile" accept=".json,application/json"></label></div></div>`;
  // Continue sits on the current campaign's row (Home keeps its own Continue card; owner, 2026-11-20)
  return `<div class="cp">
   <h3 class="cp-h">All campaigns <span class="m">${L.length} on this device</span></h3>
   <ul class="cp-list">${rows.map(row).join('')}</ul>
   <div class="cp-acts"><button type="button" class="btn" data-action="camp-new">${campSvg('plus',18)} ${nest('New campaign')}</button><label class="btn cpfile">${campSvg('up',18)} ${nest('Import campaign file')}<input type="file" id="campfile" accept=".json,application/json"></label></div>
   <p class="cp-note">Opening another campaign keeps this one as it is. A table is hosted for one campaign at a time.</p>
   <p class="cp-note cp-store"${used>4e6?' data-full="1"':''}>Storage on this device: <b>${campMB(used)}</b> used of about 5 MB.${used>4e6?' Nearly full: export a campaign you are not playing and delete it.':''}</p></div>`}

/* ---------- dialogs ---------- */
const campDlg=(html,k)=>{const dl=$('#dlg');dl.dataset.k=k;dl.innerHTML=`<form method="dialog" class="cpd">${html}</form>`;dl.onclose=()=>{dl.dataset.k=''};dl.onsubmit=null;if(!dl.open)dl.showModal();return dl};
function campFullDlg(){campDlg(`<h2>Not enough space on this device</h2><p>Nothing was changed. This browser keeps about 5 MB for CROW NEST and <b>${campMB(campUsage())}</b> are in use.</p><p>Export a campaign you are not playing, delete it here, then try again.</p>
  <div class="row"><button class="btn primary" value="ok">OK</button></div>`,'campfull');$('#dlg').onclick=null}
function campErr(e){if(e instanceof CampFull||campQuota(e))return campFullDlg();toast(e?.message||'That did not work')}
// Open: a table is hosted for one campaign at a time. Hosting (or joined to) a table, the switch leaves it after asking: the players'
// devices keep their crows and show the table as lost; the Ref hosts a new table in the other campaign and gives them its code.
function campOpenUI(id){const L=campList(),e=L.find(x=>x.id===id),c=L.find(x=>x.current);if(!e)return;if(e.current){S.area='session';render();return scrollTo(0,0)}
  if(sessionOn())return toast(campSessionWhy());
  const go=leave=>{try{campOpen(id,{leaveTable:leave})}catch(err){campErr(err)}};
  if(typeof NET!=='undefined'&&NET.code){const n=NET.conns.length;
    const dl=campDlg(`<h2>Leave table ${esc(NET.code)}?</h2><p>${NET.host?`You host table <b>${esc(NET.code)}</b> for ${esc(c?.name||'this campaign')}${n?`; ${n} device${n>1?'s are':' is'} joined`:''}.`:`This device is joined to table <b>${esc(NET.code)}</b>.`} A table is hosted for one campaign at a time: opening ${esc(e.name)} ends it, and the players see the table as lost.</p>
      <p>At the start of the next session, host a new table in ${esc(e.name)} and give the players its code. Their crows stay on their devices and join it.</p>
      <div class="row"><button type="button" class="btn ghost" data-cp="no">Stay at the table</button><button type="button" class="btn primary" data-cp="yes">Leave and open ${esc(e.name)}</button></div>`,'campleave');
    dl.onclick=ev=>{const b=ev.target.closest('[data-cp]');if(!b)return;dl.close();if(b.dataset.cp==='yes')go(true)};return}
  go(false)}
function campNewDlg(){if(sessionOn())return toast(campSessionWhy());
  const VS=campVillages(),N=S.campNew={name:'',home:'create',pick:VS[0]?`${VS[0].camp}:${VS[0].v.id}`:'',map:null,mapName:''};
  const draw=()=>{const dl=$('#dlg'),nm=N.name.trim(),ok=dl.querySelector('[data-cn=ok]');
    ok.textContent=nm?`Create ${nm}`:'Create the campaign';ok.disabled=!nm||N.home==='pick'&&!N.pick;
    for(const b of dl.querySelectorAll('[data-ch]'))b.setAttribute('aria-pressed',String(b.dataset.ch===N.home));
    dl.querySelector('.cn-pick').hidden=N.home!=='pick';
  };
  const byCamp=[...new Set(VS.map(x=>x.camp))].map(id=>VS.filter(x=>x.camp===id));
  const dl=campDlg(`<h2>New campaign</h2><p>A new world: no village progress, session 1.</p><p class="cn-crows">Crows stay on their players’ devices and join any campaign.</p>
    <label class="cpf"><span>Name</span><input type="text" id="cn-name" maxlength="60" autocomplete="off" placeholder="The Iron Coast"></label>
    <fieldset class="cpo"><legend>Home village</legend><div class="opt2"><button type="button" data-ch="create" aria-pressed="true">Create a new village<small>its name and one institution, the next step</small></button><button type="button" data-ch="pick" aria-pressed="false"${VS.length?'':' disabled'}>Pick an existing village<small>${VS.length?'a copy, as it is now':'no villages on this device yet'}</small></button></div>
      <label class="cpf cn-pick" hidden><span>Village to copy</span><select id="cn-pick">${byCamp.map(g=>`<optgroup label="${esc(g[0].campName)}">${g.map(x=>`<option value="${x.camp}:${esc(x.v.id)}">${esc(x.v.name)}${x.v.home?' · home':''} — ${esc(x.campName)}</option>`).join('')}</optgroup>`).join('')}</select></label></fieldset>
    <div class="row"><button type="button" class="btn ghost" data-cn="cancel">Cancel</button><button type="button" class="btn primary" data-cn="ok" disabled>Create the campaign</button></div>`,'campnew');
  const inp=$('#cn-name');inp.oninput=()=>{N.name=inp.value;draw()};inp.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();dl.querySelector('[data-cn=ok]').click()}};
  const sel=$('#cn-pick');if(sel){sel.value=N.pick;sel.onchange=()=>{N.pick=sel.value;draw()}}
  dl.onclick=ev=>{const b=ev.target.closest('[data-ch],[data-cm],[data-cn]');if(!b)return;
    if(b.dataset.ch&&!b.disabled){N.home=b.dataset.ch;draw();if(N.home==='pick')sel?.focus()}
    else if(b.dataset.cn==='cancel')dl.close();
    else if(b.dataset.cn==='ok'){const nm=N.name.trim();if(!nm)return inp.focus();if(sessionOn()){dl.close();return toast(campSessionWhy())}
      const [pc,...pv]=N.pick.split(':'),home=N.home==='pick'?{camp:pc,id:pv.join(':')}:'create';
      let id;try{id=campNew({name:nm,home})}catch(err){dl.close();return campErr(err)}
      dl.close();S.campNew=null;campOpenUI(id)}};
  draw();inp.focus()}
function campRenameDlg(id){const e=campList().find(x=>x.id===id);if(!e)return;
  const dl=campDlg(`<h2>Rename ${esc(e.name)}</h2><label class="cpf"><span>Name</span><input type="text" id="cr-name" maxlength="60" autocomplete="off" value="${esc(e.name)}"></label>
    <div class="row"><button type="button" class="btn ghost" data-cp="no">Cancel</button><button class="btn primary" data-cp="yes">Rename</button></div>`,'camprename');
  const inp=$('#cr-name');inp.select();
  dl.onsubmit=ev=>{ev.preventDefault();const v=inp.value.trim();if(!v)return inp.focus();try{campRename(id,v)}catch(err){dl.close();return campErr(err)}dl.close();toast(`Renamed: ${v}`);render()};
  dl.onclick=ev=>{if(ev.target.closest('[data-cp=no]'))dl.close()}}
function campNumDlg(id){const e=campList().find(x=>x.id===id);if(!e)return;
  const dl=campDlg(`<h2>Session number</h2><p>${esc(e.name)} plays session <b>${e.n||1}</b> next. Change it if you counted differently.</p><label class="cpf"><span>Next session</span><input type="number" id="cs-n" min="1" max="9999" value="${e.n||1}"></label>
    <div class="row"><button type="button" class="btn ghost" data-cp="no">Cancel</button><button class="btn primary">Save</button></div>`,'campnum');
  const inp=$('#cs-n');inp.select();
  dl.onsubmit=ev=>{ev.preventDefault();try{campSetSession(inp.value,id)}catch(err){dl.close();return campErr(err)}dl.close();render()};
  dl.onclick=ev=>{if(ev.target.closest('[data-cp=no]'))dl.close()}}
function campDelDlg(id){const L=campList(),e=L.find(x=>x.id===id);if(!e)return;if(e.current&&sessionOn())return toast(campSessionWhy());
  const nx=e.current?campNext(L,e.id):null,tb=e.current&&typeof NET!=='undefined'&&NET.code?` Table ${esc(NET.code)} closes.`:'';
  const dl=campDlg(`<h2>Delete ${esc(e.name)}?</h2><p>Its map, villages, journey, loot pool, Journal and session count are removed from this device. Crows are not deleted: they live on their players’ devices.</p>
    ${e.current?`<p>${nx?`${esc(nx.name)} opens next.`:'No campaign is left on this device.'}${tb}</p>`:''}
    <p class="cpd-t"><b>Export it first</b> if you might want it back.</p><p><button type="button" class="btn" data-cp="exp">${campSvg('down',18)} Export campaign file</button></p>
    <label class="cpf"><span>Type <b>${esc(e.name)}</b> to delete it</span><input type="text" id="cd-name" autocomplete="off"></label>
    <div class="row"><button type="button" class="btn ghost" data-cp="no">Cancel</button><button type="button" class="btn danger" data-cp="yes" disabled>Delete the campaign</button></div>`,'campdel');
  const inp=$('#cd-name'),ok=dl.querySelector('[data-cp=yes]');inp.oninput=()=>{ok.disabled=inp.value.trim().toLowerCase()!==e.name.trim().toLowerCase()};
  dl.onclick=ev=>{const b=ev.target.closest('[data-cp]');if(!b)return;
    if(b.dataset.cp==='exp'){campDownload(id);toast(`${e.name} exported`)}else if(b.dataset.cp==='no')dl.close();
    else if(b.dataset.cp==='yes'&&!b.disabled){if(e.current)campFlush();try{campDelete(id)}catch(err){dl.close();return campErr(err)}dl.close();S.campUi.menu=null;if(e.current)return;toast(`${e.name} deleted`);render()}};
  dl.querySelector('[data-cp=exp]').focus()}
const campMenuClose=focus=>{const U=S.campUi;if(!U?.menu)return;const id=U.menu;U.menu=null;render();if(focus)$(`.cp-more[data-v="${id}"]`)?.focus()};

/* ---------- wiring: after every script has loaded ---------- */
addEventListener('DOMContentLoaded',()=>{
  Object.assign(A,{
    'camp-continue':()=>{S.area=campNone()?'home':campNeedsHome()?'homev':'camp';render();scrollTo(0,0)},
    'camp-open':b=>campOpenUI(b.dataset.v),
    'camp-more':b=>{const U=S.campUi??={menu:null},id=b.dataset.v;U.menu=U.menu===id?null:id;render();if(U.menu)$('.cp-pop [role=menuitem]')?.focus();else $(`.cp-more[data-v="${id}"]`)?.focus()},
    'camp-export':b=>{S.campUi.menu=null;const f=campDownload(b.dataset.v);render();if(f)toast(`${f.name} exported: ${campFileName(f.name)}`)},
    'camp-rename':b=>{S.campUi.menu=null;render();campRenameDlg(b.dataset.v)},
    'camp-num':b=>{S.campUi.menu=null;render();campNumDlg(b.dataset.v)},
    'camp-del':b=>{S.campUi.menu=null;render();campDelDlg(b.dataset.v)},
    'camp-new':()=>campNewDlg()});
  document.addEventListener('click',e=>{if(S.campUi?.menu&&!e.target.closest('.cp-pop,.cp-more'))campMenuClose(false)});
  // the first step done: the party is in its new home village (owner, 2026-11-20)
  {const f=A.nvadd;A.nvadd=b=>{const need=campNeedsHome(),r=f(b),h=need&&VILLAGES.find(v=>v.home);if(h&&!S.here){S.here=h.id;saveVillages();setPhase('village');render()}return r}}
  document.addEventListener('keydown',e=>{if(!S.campUi?.menu||!e.target.closest?.('.cp-pop,.cp-more'))return;
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();campMenuClose(true);return}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){const it=[...document.querySelectorAll('.cp-pop [role=menuitem]')],i=it.indexOf(document.activeElement);e.preventDefault();it[(i+(e.key==='ArrowDown'?1:it.length-1))%it.length]?.focus()}},true);
  document.addEventListener('change',e=>{if(e.target.id!=='campfile')return;const f=e.target.files[0];e.target.value='';if(!f)return;
    f.text().then(t=>{let o;try{o=JSON.parse(t)}catch{return toast('That isn’t a campaign file (not JSON).')}
      try{const r=campImport(o);render();toast(r.renamed?`Imported as ${r.name}: a campaign with that name is already here.`:`${r.name} imported. Open it from the list.`)}catch(err){campErr(err)}})});
  // the open campaign: the uid floor (an item made in another campaign never shares an id with one parked here), a pool item that
  // shares its id with a crow's card (a file from another device) gets a new one; then the roster's starting point
  if(S.role==='ref'){const {l}=campEnsure();const top=Math.max(0,...l.map(e=>+e.uid||0));if(UID<=top)UID=top+1;
    const used=new Set(PARTY.flatMap(c=>[c.inv,...(c.pets||[]).map(p=>p.inv||[]),...(c.hires||[]).map(p=>p.inv||[])].flat().map(i=>i.uid)));let fixed=false;
    for(const p of S.pool){if(used.has(p.uid)){p.uid=UID++;fixed=true}used.add(p.uid)}if(fixed)saveSession()}
  campBaseline();
  let note=null;try{note=JSON.parse(sessionStorage.getItem('ctk-campnote')||'null');sessionStorage.removeItem('ctk-campnote')}catch{}
  if(note&&S.role==='ref'){const c=campCurrent();if(note.gone)setTimeout(()=>toast(`${note.gone} deleted${c?` · ${c.name} is open`:''}`),450);
    else if(c)setTimeout(()=>toast(`Opened ${c.name} · session ${c.n||1}${note.left?'. The table was closed: host a new one when the next session starts.':''}`),450)}
  // an empty campaign starts on the village editor: its home village is the first step
  if(S.role==='ref'&&campNeedsHome()&&(note||S.area==='session')){S.area='homev';render()}
  else if(S.role==='ref'&&note&&!note.gone&&!sessionOn()){S.area='camp';render()}
  if(TAB.blocked)tabShow();
  else if(CAMP_RECOVERED&&S.role==='ref'){const c=campCurrent();setTimeout(()=>toast(CAMP_RECOVERED==='gone'?'A deletion was interrupted; it is finished: no campaign is open.':CAMP_RECOVERED==='done'?`A campaign switch was interrupted; it is finished: ${c?.name||''} is open.`:c?`A campaign switch was interrupted; nothing changed: ${c.name} is still open.`:'A campaign switch was interrupted; nothing changed.'),450)}
  if(S.area==='camps')render()});
