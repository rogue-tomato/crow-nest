'use strict';
/* CROW NEST — a crow in a file (owner, 2026-11-20; QA/2026-11-20-seats.md). Export from the crow's Edit screen; Import on a player's
   “Who do you play tonight?”, Home and the crow roster.
   File: {format:'crow-nest-crow', v:1, crow, items, exported}; items = the custom cards the crow carries (a Ref-made card, an
   enchanted blade). A bare crow (the “Download a copy first” file from Delete) is read too.
   Import never replaces silently: a crow with the same id asks Replace / Keep both / Cancel. Item ids (uid) that clash with any on this
   device are given new ones; cards this app does not know are left out and named; the crow's Sets come back through reviveCrow.
   Loads before app.js: functions only (called after every script has loaded). */
const CROWFILE_MAX=2*1024*1024;
function crowFileOf(c){const s=ser(c),items=(typeof CUSTOM!=='undefined'?CUSTOM:[]).filter(it=>s.includes('"'+it.id+'"'));
  const pics=c.pic&&PICS[c.pic]?{[c.pic]:PICS[c.pic]}:{}; // its portrait (portrait.js)
  return {format:'crow-nest-crow',v:1,crow:JSON.parse(s),items,pics,exported:new Date().toISOString()}}
function crowExport(c){if(!c)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(crowFileOf(c))],{type:'application/json'}));
  a.download=(c.name.replace(/[^\w-]+/g,'_').replace(/^_+|_+$/g,'')||'crow')+'.crow.json';a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);toast(`${c.name} exported`)}
// what is wrong with a file ('' when it can be read); returns {err} or {crow, items}
function crowFileRead(text){if(typeof text!=='string')return {err:'That file could not be read.'};if(text.length>CROWFILE_MAX)return {err:'That file is too big for a crow (over 2 MB).'};
  let o;try{o=JSON.parse(text)}catch{return {err:'That isn’t a crow file (not JSON).'}}
  if(o&&o.format==='crow-nest-campaign')return {err:'That is a campaign file. The Ref opens it in Campaigns.'};
  if(o&&o.hexes)return {err:'That is a Hexer map, not a crow.'};
  if(o&&o.format==='crow-nest-crow'&&o.v!==1)return {err:`This crow file is version ${String(o.v).slice(0,8)}; this CROW NEST reads version 1.`};
  const c=o&&o.format==='crow-nest-crow'?o.crow:o,items=o&&o.format==='crow-nest-crow'&&Array.isArray(o.items)?o.items:[];
  if(!c||typeof c!=='object'||Array.isArray(c))return {err:'That isn’t a crow file.'};
  if(typeof c.id!=='string'||!c.id||c.id.length>60||typeof c.name!=='string'||!c.name.trim())return {err:'That crow has no id or no name: the file is damaged.'};
  if(!Array.isArray(c.inv)||!c.ch||typeof c.ch!=='object'||!['A','M','S'].every(k=>Number.isFinite(+c.ch[k])))return {err:`${c.name.slice(0,40)}: the inventory or the characteristics are missing; the file is damaged.`};
  for(const k of ['wounds','cond'])if(c[k]!=null&&!Array.isArray(c[k]))return {err:`${c.name.slice(0,40)}: ${k} is damaged.`};
  for(const k of ['txp','stBase','stamina','effort','cruelty'])if(c[k]!=null&&!Number.isFinite(+c[k]))return {err:`${c.name.slice(0,40)}: ${k} is not a number; the file is damaged.`};
  const pics=o&&o.format==='crow-nest-crow'&&o.pics&&typeof o.pics==='object'?o.pics:{};
  if(c.pic!=null&&(typeof c.pic!=='string'||!picOk(c.pic,pics[c.pic])))delete c.pic; // a portrait only when the file brings a valid one
  return {crow:c,items:items.filter(it=>it&&typeof it.id==='string'&&typeof it.name==='string'),pics:c.pic?{[c.pic]:pics[c.pic]}:{}}}
// the crow as it will join this device: known cards only, new uids where they clash, a new id for “keep both”
function crowFilePrep(f,newId){const c=JSON.parse(JSON.stringify(f.crow)),left=[];picsIn(f.pics);
  for(const it of f.items)if(!IT[it.id]){addItemDef(it);CUSTOM.push(it);store.set('customItems',JSON.stringify(CUSTOM))}
  const used=new Set([...PARTY.filter(x=>x.id!==(newId?null:c.id)).flatMap(x=>[x.inv,...(x.pets||[]).map(p=>p.inv||[]),...(x.hires||[]).map(h=>h.inv||[])].flat().map(i=>i.uid)),...S.pool.map(p=>p.uid)]);
  const fix=inv=>(Array.isArray(inv)?inv:[]).filter(i=>{if(!i||typeof i.id!=='string'||!IT[i.id]){left.push(i?.id||'?');return false}return true}).map(i=>{
    let u=+i.uid;if(!Number.isFinite(u)||used.has(u)){u=UID++}used.add(u);if(UID<=u)UID=u+1;return {...i,uid:u,count:Math.max(1,+i.count||1)}});
  c.inv=fix(c.inv);for(const p of c.pets||[])p.inv=fix(p.inv);for(const h of c.hires||[])h.inv=fix(h.inv);
  if(newId){c.id='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);c.name=crowFreeName(c.name)}
  if(typeof GONE==='object'&&GONE[c.id])c.back=Date.now(); // deleted at this table once: the import brings it back
  const r=reviveCrow(c);r.stamina=Math.max(0,Math.min(+r.stamina||0,stMax(r)));r.effort=Math.max(0,Math.min(+r.effort||0,effMax(r)));return {c:r,left}}
const crowFreeName=n=>{let k=2,x=`${n} (${k})`;while(PARTY.some(c=>c.name===x))x=`${n} (${++k})`;return x};
function crowFileAdd(f,mode){const old=PARTY.find(c=>c.id===f.crow.id),{c,left}=crowFilePrep(f,mode==='both');
  journalRun(mode==='replace'?`Replaced ${old.name} from a file`:`Imported ${c.name}`,['crow:'+c.id],()=>{const i=PARTY.findIndex(x=>x.id===c.id);if(i>=0)PARTY[i]=c;else PARTY.push(c)});
  if(typeof RECV!=='undefined'&&RECV.delete(c.id))saveRecv(); // imported here: this device's own
  saveCrows();if(S.area!=='seat'){ME=c;store.set('crow',PARTY.indexOf(c))}render();
  toast(`${c.name} ${mode==='replace'?'replaced from the file':'is on this device'}${left.length?`. Left out ${left.length} card${left.length>1?'s':''} this app doesn’t know (${[...new Set(left)].slice(0,3).join(', ')})`:''}`)}
function crowImportText(text){const f=crowFileRead(text);if(f.err)return toast(f.err),f;const old=PARTY.find(c=>c.id===f.crow.id);if(!old){crowFileAdd(f,'new');return f}
  const dl=$('#dlg');dl.dataset.k='crowclash';
  dl.innerHTML=`<form method="dialog" class="cpd"><h2>${esc(old.name)} is already on this device</h2><p>The file holds ${esc(f.crow.name)}${f.crow.name!==old.name?` (here: ${esc(old.name)})`:''}: level ${level(reviveCrow(JSON.parse(JSON.stringify(f.crow)))).lv}, ${(f.crow.inv||[]).length} card${(f.crow.inv||[]).length===1?'':'s'}. The one here has level ${level(old).lv} and ${old.inv.length} card${old.inv.length===1?'':'s'}.</p>
    <ul class="ss-ul"><li><b>Replace</b> puts the file’s version in place of the one here. Undo in the Journal brings this one back.</li><li><b>Keep both</b> adds the file’s crow as a new crow: “${esc(crowFreeName(f.crow.name))}”.</li></ul>
    <div class="row"><button type="button" class="btn ghost" data-cf="no">Cancel</button><button type="button" class="btn" data-cf="both">Keep both</button><button type="button" class="btn primary" data-cf="replace">Replace</button></div></form>`;
  dl.onclose=()=>{dl.dataset.k=''};dl.onsubmit=null;dl.onclick=e=>{const b=e.target.closest('[data-cf]');if(!b)return;dl.close();if(b.dataset.cf!=='no')crowFileAdd(f,b.dataset.cf)};
  dl.showModal();dl.querySelector('[data-cf=no]').focus();return f}
// the button: a label around a hidden file input (a keyboard user tabs to the input inside it)
const crowImportBtn=cls=>`<label class="${cls?'opt '+cls:'btn'} crowfile">${typeof sSvg==='function'?sSvg('up',22):''}<b>${nest('Import a crow from a file')}</b><span class="muted small">a .json exported from a crow’s Edit screen</span><input type="file" class="crowfile-in" accept=".json,application/json" aria-label="Import a crow from a file"></label>`;
document.addEventListener('change',e=>{if(!e.target.classList?.contains('crowfile-in'))return;const f=e.target.files[0];e.target.value='';if(!f)return;
  if(f.size>CROWFILE_MAX)return toast('That file is too big for a crow (over 2 MB).');f.text().then(crowImportText,()=>toast('That file could not be read.'))});
