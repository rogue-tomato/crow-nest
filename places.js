/* Places (owner, 2026-11-23): the Ref's Villages became Places — the campaign's settlements (villages: VILLAGES, their sheet),
   points of interest and dungeons (PLACES, app.js). One bar button with the list inside, in the village, on the road and in the
   dungeon. On the road, “The crows arrive…” stops the day at one of them without a rest:
   - a settlement: a visit — the party is in the village (trade, train) while the day waits; “The crows set out” goes back to the
     same road (the hexes of today that are left), “End the day in X” spends the night there (scVillage);
   - a point of interest: its scene, as a stop on the road always opened it (jPoiOpen); leaving goes back to the road;
   - a dungeon: today's delve (jExploreHere), named on the camp; its family is the place's.
   Nearby Monster rolls the family of the dungeon the Ref says is closest (S.rtravel.near). Loaded after travel.js. */
const PL_KIND={settlement:'Settlement',poi:'Point of interest',dungeon:'Dungeon'};
const plFind=id=>PLACES.find(p=>p.id===id)||null;
function plNew(label,kind){const p={id:'p'+Date.now().toString(36)+d(999),label:String(label||'').trim().slice(0,80)||'New place',kind,fam:'',note:'',day:null};PLACES.push(p);savePlaces();return p}
// a settlement visited from the road: the village stop the party is in while the journey waits
const plVisit=()=>S.phase==='village'&&typeof jRunning==='function'&&jRunning()&&S.journey.script?.stops.find(x=>x.kind==='village'&&x.state==='explore')||null;
const plLeft=()=>{const sc=S.journey.script;return sc?Math.max(0,sc.path.length-1-sc.at):0};
const plHexes=n=>`${n} hex${n===1?'':'es'}`;
const plIcon=k=>`<span class="pl-ic" aria-hidden="true">${vsvg(WICON[k==='settlement'?'village':k==='dungeon'?'delve':'poi'])}</span>`;
const plSub=p=>p.kind==='dungeon'?`${FAMS[p.fam]||'monsters not set'} · ${p.day?`delved on day ${p.day}`:'not visited'}`:p.day?`visited on day ${p.day}`:'not visited';

/* ---------- the list: settlements, points of interest, dungeons ---------- */
let PL_Q='',PL_NEW=false; // the list's filter and the New place chooser: the Ref's view, never saved
const plHit=n=>!PL_Q.trim()||String(n).toLowerCase().includes(PL_Q.trim().toLowerCase());
vListHTML=sel=>{const onPlace=!!plFind(S.vsel),row=(id,cur,name,sub,kind)=>`<li${plHit(name)?'':' hidden'}><button data-action="vsel" data-v="${esc(id)}" aria-current="${cur}">${plIcon(kind)}<span class="pl-t">${esc(name)}<span>${sub}</span></span></button></li>`;
  const grp=(h,rows)=>rows.length?`<h3 class="pl-h">${h}</h3><ul class="mlist pl-list">${rows.join('')}</ul>`:'';
  const vs=VILLAGES.map(v=>row(v.id,!onPlace&&sel?.id===v.id,`${v.name}${v.home?' · home':''}`,`${v.id===S.here?(partyWaits()?'party starts here · ':'party here · '):''}P ${fmt(v.prosperity)} · day ${v.day}`,'settlement'));
  const of=k=>PLACES.filter(p=>p.kind===k).map(p=>row(p.id,S.vsel===p.id,p.label,esc(plSub(p)),k));
  const n=VILLAGES.length+PLACES.length;
  return `${n>4?`<input id="pl-find" class="pl-find" type="search" placeholder="Find a place" aria-label="Find a place" value="${esc(PL_Q)}" autocomplete="off">`:''}
    ${grp('Settlements',vs)||'<p class="muted small" style="padding:.5rem;margin:0">No villages yet.</p>'}${grp('Points of interest',of('poi'))}${grp('Dungeons',of('dungeon'))}`};
// typing filters the list in place: no render, the field keeps its caret
document.addEventListener('input',e=>{if(e.target.id!=='pl-find')return;PL_Q=e.target.value;
  for(const li of document.querySelectorAll('.pl-list li'))li.hidden=!plHit(li.querySelector('.pl-t')?.firstChild?.textContent||'')});
function plNewHTML(){if(!PL_NEW)return `<button class="btn" data-action="plnewopen">+ New place</button>`;
  return `<div class="box pl-newbox"><h2 class="sec-h">New place<button class="sec-link linkbtn" data-action="plnewopen">Close</button></h2>
    <div class="pl-kinds"><button class="btn" data-action="nvopen">${plIcon('settlement')}Settlement</button><button class="btn" data-action="plnew" data-v="poi">${plIcon('poi')}Point of interest</button><button class="btn" data-action="plnew" data-v="dungeon">${plIcon('dungeon')}Dungeon</button></div></div>`}

/* ---------- a point of interest's or a dungeon's page ---------- */
function plPageHTML(){const p=plFind(S.vsel);if(!p)return '';const k=esc(p.id);
  const kind=chipBox({label:'Kind',action:'plkind',sel:p.kind,items:Object.entries(PL_KIND).map(([v,l])=>({v,label:l}))});
  const fam=p.kind==='dungeon'?`<h3 class="pl-q">Who lives there <small>Nearby Monster rolls their table; a delve here starts with them</small></h3>${chipBox({label:'Who lives there',action:'plfam',sel:p.fam||null,items:Object.entries(FAMS).map(([v,l])=>({v,label:l}))})}`:'';
  return `<div class="box pl-page"><div class="pl-head"><label class="fld pl-name"><b>Name</b><input type="text" data-pl="label" data-k="${k}" value="${esc(p.label)}" maxlength="80"></label>${kind}</div>${fam}
    <label class="fld"><b>Notes</b> <span class="muted small">only you see this</span><textarea data-pl="note" data-k="${k}" rows="4" maxlength="2000">${esc(p.note||'')}</textarea></label>
    <p class="pl-facts muted">${p.day?`${p.kind==='dungeon'?'Delved':'Visited'} <b>day ${p.day}</b>`:'Not visited yet'}</p>
    <div class="tv-acts" style="border:0;padding:0"><span class="grow"></span><button class="linkbtn danger" data-action="pldel" data-k="${k}">Remove the place</button></div></div>`}
// the name and the notes, saved as the field is left
document.addEventListener('change',e=>{const b=e.target,f=b.dataset?.pl,p=f&&plFind(b.dataset.k);if(!p)return;
  if(f==='label')p.label=b.value.trim().slice(0,80)||p.label;else if(f==='note')p.note=b.value.slice(0,2000);savePlaces();render()});

/* ---------- The crows arrive… ---------- */
let PL_ARR={q:'',sel:'',kind:''}; // the dialog's own state: what is typed, the option picked, the kind of a new place
function plArrOpts(){const q=PL_ARR.q.trim(),hit=n=>!q||String(n).toLowerCase().includes(q.toLowerCase());
  const o=[...VILLAGES.filter(v=>hit(v.name)).map(v=>({key:'v:'+v.id,kind:'settlement',name:v.name,sub:`${v.home?'home · ':''}village · Prosperity ${fmt(v.prosperity)}`})),
    ...['poi','dungeon'].flatMap(k=>PLACES.filter(p=>p.kind===k&&hit(p.label)).map(p=>({key:'p:'+p.id,kind:k,name:p.label,sub:plSub(p)})))];
  if(q&&!o.some(x=>x.name.toLowerCase()===q.toLowerCase()))o.push({key:'new',kind:PL_ARR.kind,name:q,sub:'a new place: settlement, point of interest or dungeon',new:true});
  return o}
function plArrDraw(){const dl=$('#dlg');if(dl?.dataset.k!=='arrive')return;const o=plArrOpts();if(!o.some(x=>x.key===PL_ARR.sel))PL_ARR.sel=o[0]?.key||'';
  const cur=o.find(x=>x.key===PL_ARR.sel),G=[['settlement','Settlements'],['poi','Points of interest'],['dungeon','Dungeons']];
  const opt=x=>`<li role="option" id="pl-o-${esc(x.key.replace(':','-'))}" data-pl-opt="${esc(x.key)}" aria-selected="${x.key===PL_ARR.sel}" class="${x.new?'new':''}">${x.new?'<span class="pl-ic" aria-hidden="true">＋</span>':plIcon(x.kind)}<span><b>${x.new?`New place “${esc(x.name)}”`:esc(x.name)}</b><small>${esc(x.sub)}</small></span></li>`;
  const list=G.map(([k,h])=>{const r=o.filter(x=>!x.new&&x.kind===k);return r.length?`<li role="presentation" class="pl-oh">${h}</li>${r.map(opt).join('')}`:''}).join('')+o.filter(x=>x.new).map(opt).join('');
  const kinds=cur?.new?`<div class="pl-arr-kind">${chipBox({label:'What is it',lead:'<span class="cd-lbl">What is it?</span>',action:'plarrkind',sel:PL_ARR.kind||null,items:Object.entries(PL_KIND).map(([v,l])=>({v,label:l}))})}</div>`:'';
  const left=plLeft(),kind=cur?.kind;
  const note=!cur?'':kind==='dungeon'?'Today’s delve: when the crows leave the dungeon, they make camp by it.':`No rest: day ${jDay()} goes on; ${left?`${plHexes(left)} of today ${left===1?'is':'are'} left`:'today’s road is walked'} when the crows set out again.`;
  $('#pl-arr-list').innerHTML=list||'<li class="pl-oh">No places yet: type a name</li>';
  const q=$('#pl-arr-q');if(q)q.setAttribute('aria-activedescendant',cur?'pl-o-'+cur.key.replace(':','-'):'');
  $('#pl-arr-more').innerHTML=kinds+(note?`<p class="muted pl-arr-note">${note}</p>`:'');
  const go=$('#pl-arr-go'),ok=!!cur&&(!cur.new||!!PL_ARR.kind);go.disabled=!ok;go.textContent=cur?`Arrive at ${cur.name}`:'Arrive';
  $('#pl-arr-list [aria-selected=true]')?.scrollIntoView({block:'nearest'})}
function plArriveOpen(){const dl=$('#dlg');PL_ARR={q:'',sel:'',kind:''};dl.dataset.k='arrive';
  dl.innerHTML=`<form method="dialog" class="pl-arr"><h2>The crows arrive</h2>
    <input id="pl-arr-q" type="search" placeholder="Where? Type a place" aria-label="Where the crows arrive" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="pl-arr-list">
    <ul id="pl-arr-list" class="pl-arr-list" role="listbox" aria-label="Places"></ul><div id="pl-arr-more"></div>
    <div class="row" style="justify-content:flex-end;gap:16px;margin-top:12px"><button class="btn ghost" value="cancel">Cancel</button><button type="button" class="btn primary" id="pl-arr-go" data-pl-go>Arrive</button></div></form>`;
  dl.onclose=()=>{dl.dataset.k=''};dl.onsubmit=null;
  dl.onclick=e=>{const o=e.target.closest('[data-pl-opt]');if(o){PL_ARR.sel=o.dataset.plOpt;plArrDraw();if(e.detail>1)plArrGo();return}if(e.target.closest('[data-pl-go]'))plArrGo()};
  dl.oninput=e=>{if(e.target.id!=='pl-arr-q')return;PL_ARR.q=e.target.value;PL_ARR.sel='';plArrDraw()};
  dl.onkeydown=e=>{if(e.target.id!=='pl-arr-q')return;const o=plArrOpts(),i=o.findIndex(x=>x.key===PL_ARR.sel);
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const n=o[(i+(e.key==='ArrowDown'?1:o.length-1))%o.length];if(n){PL_ARR.sel=n.key;plArrDraw()}}
    else if(e.key==='Enter'){e.preventDefault();plArrGo()}};
  if(!dl.open)dl.showModal();plArrDraw();$('#pl-arr-q').focus()}
function plArrGo(){const cur=plArrOpts().find(x=>x.key===PL_ARR.sel);if(!cur||cur.new&&!PL_ARR.kind)return;$('#dlg').close();
  let v=null,p=null;
  if(cur.new){if(PL_ARR.kind==='settlement')v=mkVillage({name:cur.name});else p=plNew(cur.name,PL_ARR.kind)}
  else if(cur.key.startsWith('v:'))v=VILLAGES.find(x=>x.id===cur.key.slice(2));else p=plFind(cur.key.slice(2));
  if(v||p)plArrive(v,p)}
// the stop the crows arrive at, on the party's hex of today's road
function plStop(kind,text,state){let id='';jScriptSet(sc=>{id='a'+sc.at+'x'+sc.stops.length;sc.stops.push({id,i:sc.at,kind,state,text:String(text).slice(0,200)})});return id}
function plArrive(v,p){const name=v?v.name:p.label;
  journalRun(`The crows arrive at ${name}`,['session','journey','places'],()=>{
    if(v){jScriptSet(sc=>{for(const x of sc.stops)if(x.kind==='village'&&x.state==='explore')x.state='done'});plStop('village',v.name,'explore');
      S.here=v.id;S.vsel=v.id;setPhase('village');saveVillages()}
    else if(p.kind==='poi'){p.day=S.rtravel.day;savePlaces();jPoiOpen(plStop('poi',p.label,'shown'),{quiet:true})}
    else{p.day=S.rtravel.day;savePlaces();jExploreHere();S.journey={...S.journey,camp:{...S.journey.camp,poi:p.label.slice(0,200)}};if(FAMS[p.fam])S.dt.dungeon=p.fam}
    jSave()});
  S.area='session';S.tab.session=v?'village':'session';
  toast(v?`The crows are in ${v.name}: the day goes on`:p.kind==='poi'?`Investigating ${p.label}: a point of interest, played in Dungeon turns`:`Into ${p.label}: today’s delve`);render();scrollTo(0,0)}
// the settlement's banner while the day waits outside (journey.js Places wrapper)
function plVisitHTML(v){const left=plLeft();
  return `<div class="banner scdoor pl-visit"><span class="msg">From the road, day ${jDay()} · ${left?`${plHexes(left)} of today left`:'today’s road is walked'}</span><button class="btn sm" data-action="plstay">End the day in ${esc(v.name)}</button><button class="btn sm jr-go" data-action="vleave">The crows set out →</button></div>`}
// the Ref's Journey while the party is in a settlement from the road: the road waits
function plVisitCard(){const v=vHere(),left=plLeft();
  return `<section class="tv-card pl-wait"><h3>In ${esc(v?.name||'the village')} <small>from the road, day ${jDay()}</small></h3><p class="muted">${left?`${plHexes(left)} of today left`:'Today’s road is walked'}.</p>
    <div class="tv-acts" style="border:0;padding:0"><button class="btn primary" data-action="vleave">The crows set out →</button><button class="btn ghost" data-action="plstay">End the day in ${esc(v?.name||'the village')}</button></div></section>`}

/* ---------- Nearby Monster: the dungeon the Ref says is closest (no map) ---------- */
{const base=jNearHTML;jNearHTML=st=>{if(hxHere())return base(st);const ds=PLACES.filter(p=>p.kind==='dungeon'),n=jNearDungeon(),cur=n?.p,f=jFam(cur),k=esc(st.id);
  const dun=ds.length?chipBox({cls:'pl-near-d',label:'The closest dungeon',action:'plnear',sel:cur?.id||null,items:ds.map(p=>({v:p.id,label:`${esc(p.label)} <small>${esc(FAMS[p.fam]||'monsters not set')}</small>`}))}):'';
  const fams=Object.entries(FAMS).map(([v,l])=>`<button class="btn sm${v===f?' primary':''}" data-action="jnear" data-k="${k}" data-v="${v}"${v===f?' aria-pressed="true"':''}>${v===f?`Roll ${l} Encounters`:l}</button>`).join('');
  const t=ds.length?'Which dungeon is closest?':'Which monsters live in the closest dungeon?';
  const note=cur?(f?`Another family: tap it (remembered on ${esc(cur.label)}).`:`Who lives in ${esc(cur.label)}? Your pick is remembered there and rolls its encounters.`):'Your pick rolls that family’s dungeon encounters.';
  return `<div class="jr-near pl-near" role="group" aria-label="Monsters from the closest dungeon"><p class="jr-near-t">${t}</p>${dun}<div class="jr-row">${fams}</div><p class="small muted">${note} <a href="#rule/ref-monster-from-nearby" data-action="open-rule" data-k="ref-monster-from-nearby">rules</a></p></div>`}}

/* ---------- the map maker (Menu → Maps): its places into the campaign's Places ---------- */
// a map's settlements, dungeons and points of interest that Places has not got yet (by name); other marks (roads, resources) stay on the map
function plMapNew(){if(typeof HX==='undefined'||!HX?.pois)return [];const seen=new Set([...VILLAGES.map(v=>v.name),...PLACES.map(p=>p.label)].map(scNorm)),out=[];
  for(const p of HX.pois){const k=jPoiKind(p),kind=k==='village'?'settlement':k==='poi'?(jPoiDungeon(p)?'dungeon':'poi'):null,name=scLabel(p);
    if(kind&&name&&!seen.has(scNorm(name))){seen.add(scNorm(name));out.push({p,kind,name})}}return out}
const plCamp=()=>typeof campId==='function'&&campId()&&campMetaRead()?.find(e=>e.id===campId())?.name||'';
function plMapHTML(){const n=plMapNew().length;if(!n)return '';const c=plCamp();
  return `<h4>Places</h4><div class="r"><button type="button" class="hb" data-action="pladdmap">Add its ${n} new place${n===1?'':'s'} to ${esc(c||'Places')}</button></div>`}

Object.assign(A,{
  pladdmap:()=>{const l=plMapNew();if(!l.length)return;
    journalRun(`${l.length} place${l.length===1?'':'s'} from ${HX.name}`,['places','villages'],()=>{for(const x of l){if(x.kind==='settlement')scNewSheet(x.name);else{const p=plNew(x.name,x.kind);if(FAMS[x.p.fam])p.fam=x.p.fam}}savePlaces();saveVillages()});
    toast(`${l.length} place${l.length===1?'':'s'} added to ${plCamp()||'Places'}`);render()},
  plnewopen:()=>{PL_NEW=!PL_NEW;render()},
  plnew:b=>{const p=plNew('',b.dataset.v);PL_NEW=false;S.vsel=p.id;render();setTimeout(()=>{const i=$(`[data-pl=label][data-k="${p.id}"]`);i?.focus();i?.select()},0)},
  plkind:b=>{const p=plFind(S.vsel),k=b.dataset.v;if(!p||p.kind===k)return;
    if(k!=='settlement'){p.kind=k;savePlaces();return render()}
    // a settlement is a village with its sheet: institutions, prosperity, the market
    askYes(`Make ${p.label} a village?`,'It gets a village sheet: institutions, Prosperity and a market for players. Its notes go with it.',`Make ${p.label} a village`,()=>{
      journalRun(`${p.label} became a village`,['places','villages'],()=>{const v=mkVillage({name:p.label});v.note=p.note||'';PLACES.splice(PLACES.indexOf(p),1);savePlaces();saveVillages();S.vsel=v.id});render()},true)},
  plfam:b=>{const p=plFind(S.vsel);if(!p)return;p.fam=p.fam===b.dataset.v?'':b.dataset.v;savePlaces();render()},
  pldel:b=>{const p=plFind(b.dataset.k);if(!p)return;askYes(`Remove ${p.label}?`,'It leaves Places. Undo in the Journal brings it back.',`Remove ${p.label}`,()=>{
    journalRun(`Removed ${p.label}`,['places'],()=>{PLACES.splice(PLACES.indexOf(p),1);savePlaces()});S.vsel=VILLAGES[0]?.id||null;render()})},
  plarrive:()=>plArriveOpen(),
  plarrkind:b=>{PL_ARR.kind=b.dataset.v;plArrDraw()},
  plstay:()=>{if(S.here)scVillage(S.here)},
  plnear:b=>{S.rtravel.near=S.rtravel.near===b.dataset.v?'':b.dataset.v;jSave();render()}});
// the crows set out from a settlement they came to from the road: the visit is over, the same road goes on
{const base=A.vleave;A.vleave=b=>{const st=plVisit();if(!st)return base(b);
  journalRun(`The crows set out from ${vHere()?.name||'the village'}`,['session','journey'],()=>{jScriptSet(sc=>{const x=sc.stops.find(y=>y.id===st.id);if(x)x.state='done'});S.here='';saveVillages();setPhase('travel');jSave()});
  S.area='session';S.tab.session='rmap';render();scrollTo(0,0)}}
