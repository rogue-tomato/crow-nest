'use strict';
/* CROW NEST — the Journey tab: the travel day as one flow (docs/journey.md). The rules come from journey-rules.js. The
   shared state is S.journey (only the Ref writes it; on a server table players get a projection without the Ref's
   script) and each player's crow.trip (their own answers for the day, stamped with the day).
   Slice 3a: Departure, Plan and Roles. The later steps point to the old tabs until slices 3b and 3c. */
const JRS=JourneyRules;
// In Travel the player has Sheet · Inventory · Journey and the Ref Journey · Loot; the old travel tabs wait behind More.
TABS.crow.splice(TABS.crow.findIndex(t=>t[0]==='map'),0,['journey','Journey']);
TABS.session.splice(TABS.session.findIndex(t=>t[0]==='rtravel'),0,['journey','Journey']);
PHASES.travel.crow=['sheet','inventory','journey'];PHASES.travel.session=['journey','loot'];
if(S.phase==='travel'){for(const [a,old] of [['crow',['map','travel']],['session',['rtravel','rmap']]])if(old.includes(S.tab[a]))S.tab[a]='journey'}
// One device without a server keeps the journey in ctk-journey; on a server table the server holds it (app.js skips the key).
try{const j=JSON.parse(store.get('journey')||'null');if(j&&!JRS.validateJourney(j).length)S.journey=j}catch{}
const jSave=()=>store.set('journey',JSON.stringify(S.journey));
// Without a server the Travel day (lost, ticks, checks) is kept with the journey in ctk-jday, so a reload mid-day
// walks on where it was; the journey remembers the day if that copy is missing (a map, if any, restores it too).
if(!window.Cloud?.isActive()&&S.journey.step!=='off'){try{const rt=JSON.parse(store.get('jday')||'null');if(rt&&typeof rt==='object'&&rt.day===S.journey.day)Object.assign(S.rtravel,rt)}catch{}
  if(S.journey.day>S.rtravel.day)S.rtravel.day=S.journey.day}
// every path that changes them renders (the Journey, the old Travel day tab, the map): save after a render when they changed
let J_SAVED='';
const jPersist=()=>{if(window.Cloud?.isActive())return;const s=JSON.stringify(S.journey)+'\n'+JSON.stringify(S.rtravel);if(s===J_SAVED)return;J_SAVED=s;jSave();store.set('jday',JSON.stringify(S.rtravel))};

/* ---------- whose answers, which day ---------- */
const J_STEP={plan:'Plan',roles:'Roles',script:'Script',road:'Road',camp:'Camp',night:'Night',dawn:'Dawn'};
const jStep=()=>S.journey?.step||'off';
// The Ref's device knows the day from the session; players read it from the journey the Ref keeps.
const jDay=()=>S.role==='ref'?S.rtravel.day:(S.journey?.day||1);
// The crow whose answers this device gives: on a server table the account's own crow, never another player's.
const jMe=()=>window.Cloud?.isActive()?hxMine():ME;
const jIn=c=>JRS.inputsFor(c.trip,S.journey?.inputs?.[c.id],jDay());
const jName=c=>esc(c.name.split(' ')[0]);
// crows over the slot limits (a second guide, a third scout): their task does not count until the Ref sorts it out
// every traveller's answers: crows, and their hirelings in travel roles (id "<crow id>/<hireling uid>")
const jHireIn=c=>{const h=jIn(c).hires||{};return (c.hires||[]).filter(x=>h[x.uid]?.role).map(x=>({c,h:x,id:`${c.id}/${x.uid}`,x:{role:'',task:'',...h[x.uid]}}))};
const jAllIn=()=>[...PARTY.map(c=>({c,id:c.id,x:jIn(c)})),...PARTY.flatMap(jHireIn)]; // crows first: a hireling never bumps a crow
const jWho=id=>{const [cid,u]=String(id).split('/'),c=PARTY.find(x=>x.id===cid);if(!u)return c?jName(c):'?';const h=(c?.hires||[]).find(x=>String(x.uid)===u);return h?`${esc(h.name)} (${jName(c)}’s hireling)`:'?'};
const jOver=()=>JRS.slotConflicts(Object.fromEntries(jAllIn().map(a=>[a.id,a.x])));
const jModsIn=()=>{const over=new Set(jOver());return jAllIn().filter(a=>!over.has(a.id)).map(a=>a.x)};
const jMonSpeed=(mon,bless)=>Math.max(...(String(MON[mon]?.st.Speed||'5').match(/\d+/g)||['5']).map(Number))+(bless?3:0); // a flyer ("2, fly 8") goes at its best
const jPetSpeed=p=>jMonSpeed(p.mon,(p.prayer||0)>0); // Mount's Prayer: +3 while it lasts
function jRide(c){const r=String(jIn(c).ride||''),pet=u=>(c.pets||[]).find(p=>String(p.uid)===u);if(r.startsWith('p:')){const p=pet(r.slice(2));return p?{kind:'mount',pets:[p]}:null}
  if(r.startsWith('v:')){const ps=r.slice(2).split(',').map(pet).filter(Boolean);return ps.length?{kind:'cart',pets:ps}:null}return null}
const jSpeedOf=c=>{const r=jStep()!=='off'?jRide(c):null;return r?Math.min(...r.pets.map(jPetSpeed)):speed(c)};
groupSpeed=()=>{const sp=[];for(const c of PARTY){const r=jStep()!=='off'?jRide(c):null,used=new Set((r?.pets||[]).map(p=>p.uid));sp.push(jSpeedOf(c));
  const hs=jStep()!=='off'?jIn(c).hires||{}:{};for(const h of c.hires||[]){const rd=String(hs[h.uid]?.ride||''),p=rd.startsWith('p:')&&(c.pets||[]).find(x=>String(x.uid)===rd.slice(2));
    if(p){used.add(p.uid);sp.push(jPetSpeed(p))}else if(rd==='cart'&&r?.kind==='cart')sp.push(Math.min(...r.pets.map(jPetSpeed)));else sp.push(jMonSpeed(h.mon))}
  for(const p of c.pets||[])if(!used.has(p.uid))sp.push(jPetSpeed(p))}return sp.length?Math.min(...sp):5};
const jTaskDef=k=>{const n=JRS.TASK_NAMES[k];for(const r of TRAVEL){const t=r.tasks.find(t=>t.n===n);if(t)return {...t,role:r.role}}return null};
// Assist (Rules: Assist): a test before the other one; tier 1 −1, tier 2 +1, tier 3 +2 to it. Support Everyone the same.
const J_SHIFT={1:-1,2:1,3:2};
const J_ASSIST={n:'Assist',ch:['A','M','S'],d:'Help another crow’s risky test. You roll first.',o:['Their test −1.','Their test +1.','Their test +2.']};
const jRisky=x=>x.role==='assist'?!!(x.targets||[]).length:!!x.task&&x.role===JRS.roleOf(x.task)&&!JRS.ROLES[x.role].tasks[x.task].safe;
const jWaiting=x=>jRisky(x)&&!x.tier;
// What the others add to this crow's role test: supporters (Support Everyone) and assists that name it.
function jBonus(c){let n=0;const why=[];for(const o of PARTY){if(o===c)continue;const x=jIn(o);
  if(((x.role==='supporter'&&x.task==='everyone')||x.role==='assist')&&(x.targets||[]).includes(c.id)&&x.tier){n+=J_SHIFT[x.tier];why.push(`${jName(o)} ${fmt(J_SHIFT[x.tier])}`)}}
  return {n,why}}
function jPace(){const p=S.journey?.plan;if(p&&p.locked)return p.pace;if(S.area==='session')return S.rtravel.pace;return JRS.paceVote(PARTY.map(c=>jIn(c).pace))||p?.pace||'normal'}
function jTotals(){const lost=S.role==='ref'?!!S.rtravel.lost:!!myPub()?.lost,over=new Set(jOver()),xs=PARTY.map(c=>[c,over.has(c.id)?{...jIn(c),role:'none',task:''}:jIn(c)]);
  const route=Object.fromEntries(JRS.ROUTE_KEYS.filter(k=>S.rtravel.mods?.[k]).map(k=>[k,true]));
  const pace=jPace(),mods={...route,...JRS.modsFromInputs(jModsIn(),{lost})};
  return {T:JRS.dayTotals({pace,mods,lost},groupSpeed()),pace,mods,xs,lost}}

/* ---------- pieces of the panel ---------- */
function jRail(){const st=jStep()==='script'&&S.area!=='session'?'road':jStep(),list=JRS.STEPS.filter(s=>s!=='off'&&(S.area==='session'||s!=='script')),all=JRS.STEPS.indexOf(st);
  return `<div class="jr-rail" role="list" aria-label="Steps of the day">${list.map(s=>{const k=JRS.STEPS.indexOf(s);
    return `<span role="listitem" class="${k<all?'done':k===all?'cur':''}"${k===all?' aria-current="step"':''}>${J_STEP[s]}</span>`}).join('')}</div>`}
function jKpis(t){const T=t.T,pend=jAllIn().filter(a=>jWaiting(a.x)),q=pend.length?'<span aria-hidden="true">?</span>':'';
  const why=[`<b>${PACE[t.pace].label}</b>: ${T.p.hex} hex${T.p.hex>1?'es':''}, EN ${T.p.en}`,
    ...Object.keys(t.mods).map(k=>{const r=RT_ALL.find(x=>x[0]===k);return r?`<b>${esc(r[1])}</b>: ${esc(r[2])}`:''}).filter(Boolean),
    T.sp?`slowest crow, speed ${T.slow}: ${T.sp>0?'+':'−'}${Math.abs(T.sp)} hex`:''].filter(Boolean);
  return `<div class="jr-kpis">${[['Hexes',T.hexes,'today'],['EN',T.en,'d10 ≤ EN'],['Checks',T.chk,'on the road'],['Rest EN',T.ren,'at camp']].map(([k,v,s])=>`<div class="jr-kpi"><small>${k}</small><b>${v}${q}</b><small>${s}</small></div>`).join('')}</div>
   <p class="jr-why">${why.join(' · ')}.${pend.length?` ${pend.map(({x})=>esc(x.role==='assist'?'an assist':JRS.TASK_NAMES[x.task])).join(', ')} still ${pend.length>1?'need their tests':'needs its test'}: the numbers settle when the tiers are in.`:''}${t.lost?' <b>The group is lost.</b>':''}</p>`}
const jTaskLine=x=>x.role==='none'?'No role':x.role==='assist'?`Assist${(x.targets||[]).length?' · '+(x.targets||[]).map(id=>{const o=PARTY.find(c=>c.id===id);return o?jName(o):''}).join(', '):''}`
  :x.role?`${esc(x.role[0].toUpperCase()+x.role.slice(1))}${x.task?' · '+esc(JRS.TASK_NAMES[x.task]):''}${x.task==='track'&&x.what?` (${esc(x.what)})`:''}`:'';
function jStatus(x,step){if(step==='plan')return x.role?['ok',x.role==='none'?'no role':'ready']:['wait','no role yet'];
  if(!jRisky(x))return ['ok',x.role&&x.role!=='none'?'safe':'—'];return x.tier?['ok',`tier ${x.tier}${x.doom?' (doom)':''}${x.effort?' +Effort':''}`]:['wait','no tier yet']}
// Miasma effects that change a travel day (the effect's own text, so the rule stays the table's)
const J_WARN=[MI_NAMES[1],MI_NAMES[7],MI_NAMES[9]];
const jWarns=()=>PARTY.flatMap(c=>c.miasma.filter(m=>J_WARN.includes(m.n)).map(m=>`<p class="jr-warn"><b>${jName(c)} — ${esc(m.n)}:</b> ${esc(m.t)}</p>`)).join('');
function jPartyList(step,actions){const me=jMe();return PARTY.map(c=>{const x=jIn(c),[cls,st]=jStatus(x,step),vote=step==='plan'&&x.pace?` · votes ${PACE[x.pace].label}`:'';
  return `<div class="jr-li${c===me&&S.area!=='session'?' me':''}"><span class="jr-who">${jName(c)}${c===me&&S.area!=='session'?' — you':''}</span><span class="jr-st ${cls}">${st}</span><span class="jr-what">${jTaskLine(x)}${vote}</span>${actions?actions(c,x):''}</div>`}).join('')}

/* ---------- Plan ---------- */
function jRouteHTML(){const ref=S.area==='session',m=ref?(hxHere()?HX:null):myPub();
  if(!m)return `<p class="small muted" style="margin:0">No map today: the Ref counts the hexes.</p>`;
  const per=ref?hxPer():m.per||2,from=ref?HX.known:m.party,ri=m.route.length&&from?hxRouteInfo(m,from,m.route,per):null,by=ref&&HX.routeBy?PARTY.find(c=>c.id===HX.routeBy):null;
  const stops=(ref?HX.pois.filter(p=>p.found):m.pois).filter(p=>m.route.includes(p.k)),x=ref?{}:jIn(jMe()||{});
  return `<p class="small" style="margin:0">${ri?`<b>${ri.n} hex${ri.n>1?'es':''} · ≈ ${dfmt(ri.days)}</b>${ri.road?` · ${ri.road} by road`:''}${by?` · proposed by ${jName(by)}`:''}`:'No route yet.'}</p>
   <p class="small muted" style="margin:.3rem 0 0">${ref?'Players draw the route on their map; you can draw it on Hex map too.':'Tap the map where you want to go: the shortest way is drawn, roads first. Tap a hex on the route to cut it there.'}</p>
   ${!ref&&m.route.length?`<div class="jr-row" style="margin-top:.4rem"><button class="btn sm" data-action="hxundo">Take back a step</button><button class="btn sm ghost" data-action="hxrclear">Clear the route</button></div>`:''}
   ${!ref&&stops.length?`<div class="jr-opts" style="margin-top:.4rem">${stops.map(p=>`<button class="opt" data-action="jnight" data-k="${esc(p.k)}" aria-pressed="${(x.nights||[]).includes(p.k)}"><b>Overnight here</b><span class="small muted">${esc(p.label||tName(m,p.type))}</span></button>`).join('')}</div>`:''}`}
function jPaceVotes(k){return PARTY.filter(c=>jIn(c).pace===k).map(c=>`<i title="${esc(c.name)}">${esc(c.name.split(' ').map(w=>w[0]).join('').slice(0,2))}</i>`).join('')}
function jPlanPlayer(){const c=jMe();if(!c)return `<p class="muted">Open your crow to give your answers.</p>`;const x=jIn(c),t=jTotals();
  const taken=r=>[...PARTY.filter(o=>o!==c&&jIn(o).role===r),...PARTY.flatMap(jHireIn).filter(a=>a.x.role===r).map(a=>({name:a.h.name}))];
  const roleBtn=(r,label,sub)=>{const others=taken(r),full=r==='guide'&&others.length||r==='scout'&&others.length>=2;
    return `<button class="opt" data-action="jrole" data-v="${r}" aria-pressed="${x.role===r}"${full&&x.role!==r?' disabled':''}><b>${label}</b><span class="small muted">${full&&x.role!==r?`taken by ${others.map(jName).join(', ')}`:sub}</span></button>`};
  const role=x.role&&x.role!=='none'&&x.role!=='assist'?JRS.ROLES[x.role]:null;
  const lost=jTotals().lost,tasks=role?Object.keys(role.tasks).map(k=>{const d=jTaskDef(k),scouts=taken('scout');
    const why=x.role==='scout'&&scouts.length&&!scouts.some(o=>jIn(o).task==='places')&&k!=='places'?'a second scout must scout for places'
      :x.role==='guide'&&lost&&k!=='back'?'while lost only Back on Track':x.role==='guide'&&!lost&&k==='back'?'only while lost':'';
    return `<button class="opt" data-action="jtask" data-v="${k}" aria-pressed="${x.task===k}"${why?' disabled':''}><b>${esc(d.n)}</b><span class="small muted">${why||(d.safe?'safe':'risky · '+d.ch.join(' or '))}</span></button>`}).join(''):'';
  const want=x.role==='assist'?1:x.task==='everyone'?3:x.task==='fight'?1:0;
  const pickable=x.role==='assist'?PARTY.filter(o=>o!==c&&jIn(o).role!=='assist'&&jRisky(jIn(o))):x.task==='everyone'?PARTY.filter(o=>o!==c&&['guide','scout','tracker'].includes(jIn(o).role)):PARTY.filter(o=>o!==c);
  const targets=want?`<h4 class="jr-h">${x.role==='assist'?'Whose test do you help?':x.task==='fight'?'Which ally? Their next Mind RR gets +1':'Up to three allies in travel roles'}</h4>
    ${pickable.length?`<div class="jr-opts">${pickable.map(o=>`<button class="opt" data-action="jtarget" data-k="${esc(o.id)}" aria-pressed="${(x.targets||[]).includes(o.id)}"><b>${jName(o)}</b><span class="small muted">${jTaskLine(jIn(o))||'no role yet'}</span></button>`).join('')}</div>`:'<p class="small muted" style="margin:0">Nobody to pick yet.</p>'}`:'';
  return `<section class="hxsec"><h3 class="hxh">Today <span class="muted">day ${jDay()}${t.lost?' · lost':''}</span></h3>${jKpis(t)}${jWarns()}</section>
   <section class="hxsec"><h3 class="hxh">Route</h3>${jRouteHTML()}</section>
   <section class="hxsec"><h3 class="hxh">Pace <span class="muted">your vote; the Ref decides</span></h3>
    <div class="jr-opts">${Object.entries(PACE).map(([k,p])=>`<button class="opt" data-action="jpace" data-v="${k}" aria-pressed="${x.pace===k}"><b>${p.label}</b><span class="small muted">${p.hex} hex${p.hex>1?'es':''} · EN ${p.en}${p.mod?` · role tests ${p.mod==='edge'?'+2':'−2'}`:''}</span><span class="jr-votes">${jPaceVotes(k)}</span></button>`).join('')}</div></section>
   <section class="hxsec"><h3 class="hxh">Your role <span class="muted">supporters, then guide, scouts, trackers</span></h3>
    <div class="jr-opts">${roleBtn('guide','Guide','one per group')}${roleBtn('scout','Scout','one, two with Places')}${roleBtn('tracker','Tracker','any number')}${roleBtn('supporter','Supporter','any number')}${roleBtn('assist','Assist','help a risky test')}<button class="opt" data-action="jrole" data-v="none" aria-pressed="${x.role==='none'}"><b>No role</b><span class="small muted">rest on the road</span></button></div>
    ${tasks?`<h4 class="jr-h">Task</h4><div class="jr-opts">${tasks}</div>`:''}
    ${x.task==='track'?`<label class="small" style="display:block;margin-top:.5rem">What do you track? <input id="jwhat" class="jr-what-in" maxlength="200" value="${esc(S.jDraft??x.what??'')}" placeholder="a creature the Ref agrees is around"></label>`:''}
    ${targets}</section>
   <section class="hxsec"><h3 class="hxh">The party</h3>${jPartyList('plan')}</section>`}
function jPlanRef(){const t=jTotals(),over=jOver(),vote=JRS.paceVote(PARTY.map(c=>jIn(c).pace));
  const noRoute=hxHere()&&!HX.route.length,s=S.journey.season;
  return `<section class="hxsec"><h3 class="hxh">Today <span class="muted">day ${jDay()}${S.journey.from?` · from ${esc(VILLAGES.find(v=>v.id===S.journey.from)?.name||S.journey.from)}`:''}</span></h3>${jKpis(t)}${jWarns()}</section>
   <section class="hxsec"><h3 class="hxh">Route</h3>${jRouteHTML()}</section>
   <section class="hxsec"><h3 class="hxh">Pace <span class="muted">${vote?`most votes: ${PACE[vote].label}`:'no clear vote'}</span></h3>
    <div class="jr-opts">${Object.entries(PACE).map(([k,p])=>`<button class="opt" data-action="rpace" data-v="${k}" aria-pressed="${S.rtravel.pace===k}"><b>${p.label}</b><span class="small muted">${p.hex} hex${p.hex>1?'es':''} · EN ${p.en}</span><span class="jr-votes">${jPaceVotes(k)}</span></button>`).join('')}</div></section>
   <section class="hxsec"><h3 class="hxh">The party <span class="muted">${PARTY.filter(c=>jIn(c).role).length} of ${PARTY.length} chose</span></h3>${jPartyList('plan',(c,x)=>over.includes(c.id)?`<div class="jr-act"><button class="btn sm ghost" data-action="jrout" data-k="${esc(c.id)}">Leave ${jName(c)} out</button></div>`:'')}
    ${jHireList('plan')}${over.length?`<p class="jr-warn"><b>Too many in one slot:</b> ${over.map(jWho).join(', ')} — one guide, one scout (two if one scouts for places). Ask them to change, or lock and enter their roles.</p>`:''}</section>
   <section class="hxsec"><h3 class="hxh">Season <span class="muted">for Bad Weather</span></h3>
    <div class="jr-opts">${JRS.SEASONS.map(k=>`<button class="opt" data-action="jseason" data-v="${k}" aria-pressed="${s===k}"><b>${k[0].toUpperCase()+k.slice(1)}</b></button>`).join('')}</div></section>
   ${jHiresRef()}<section class="hxsec"><div class="jr-row"><button class="btn primary" data-action="jlock"${noRoute?' disabled':''}>Lock the plan →</button><button class="btn" data-action="jstay">Stay here today</button></div>
    ${noRoute?'<p class="small muted" style="margin:.4rem 0 0">Waiting for a route on the map.</p>':''}
    ${S.journey.from&&!(S.rtravel.moved>0)?'<div class="jr-row" style="margin-top:.4rem"><button class="btn ghost sm" data-action="jcancel">Cancel the departure</button></div>':''}</section>`}

/* ---------- Roles ---------- */
// Dice for each final tier when a double edge or bane moves the result one tier (bounded 1–3)
function jDice(t,mod,sh){const raw=[1,2,3].filter(r=>Math.max(1,Math.min(3,r+sh))===t);if(!raw.length)return 'never';
  const a=Math.max(2,[2,12-mod,17-mod][raw[0]-1]),z=Math.min(20,[11-mod,16-mod,20][raw[raw.length-1]-1]);return a>z?'never':a>=20?'dice 20':z>=20?`dice ${a}+`:`dice ${a}–${z}`}
// edges and banes on a travel test: the pace; Strong Miasma and the weather for guides, scouts and trackers (one helper for crows and hirelings)
function jEdges(role,pace,fx){const edges=[],banes=[],tr=['guide','scout','tracker'].includes(role);if(role!=='assist'&&pace.mod)(pace.mod==='edge'?edges:banes).push(`${pace.label.toLowerCase()} pace: ${pace.mod}`);
  if(tr&&fx.some(e=>e.kind==='strong'))banes.push('Strong Miasma: bane');if(tr)fx.forEach(e=>{const n=JRS.WEATHER_BANES[e.name];if(n)banes.push(`${e.name}: ${n>1?'double bane':'bane'}`,...Array(n-1).fill(''))});
  return {eb:JRS.edgesBanes(edges.length,banes.length),why:[...edges,...banes.filter(Boolean)]}}
function jTestCard(c,x){const def=x.role==='assist'?J_ASSIST:jTaskDef(x.task),pace=PACE[jPace()],best=def.ch.reduce((a,b)=>c.ch[a]>=c.ch[b]?a:b);
  const b=x.role==='assist'?{n:0,why:[]}:jBonus(c),fx=S.journey.effects||[],role=['guide','scout','tracker'].includes(x.role),edges=[],banes=[];
  if(x.role!=='assist'&&pace.mod)(pace.mod==='edge'?edges:banes).push(`${pace.label.toLowerCase()} pace: ${pace.mod}`);
  if(role&&fx.some(e=>e.kind==='strong'))banes.push('Strong Miasma: bane');
  if(role)fx.forEach(e=>{const n=JRS.WEATHER_BANES[e.name];if(n)banes.push(`${e.name}: ${n>1?'double bane':'bane'}`,...Array(n-1).fill(''))});
  const eb=JRS.edgesBanes(edges.length,banes.length),mod=c.ch[best]+eb.mod+b.n;
  const sub=[`you use ${best} ${fmt(c.ch[best])}`,...edges,...banes.filter(Boolean),...b.why].join(', ')+` → total ${fmt(mod)}${eb.shift?`; ${eb.shift>0?'double edge: one tier up':'double bane: one tier down'}`:''}`;
  const target=x.role==='assist'?PARTY.find(o=>o.id===(x.targets||[])[0]):null;
  return `<p style="margin:0 0 .4rem">${target?`You help <b>${jName(target)}</b>’s ${esc(JRS.TASK_NAMES[jIn(target).task]||'test')}. `:''}${rich(def.d)}</p>
   ${prHTML(def.o.map((o,j)=>[j+1,rich(o)+(eb.shift?`<span class="dice">${jDice(j+1,mod,eb.shift)}</span>`:'')]),{head:`Test 2d10 + ${def.ch.join(' or ')}`,sub,mod:eb.shift?null:mod,on:x.tier||undefined})}
   <h4 class="jr-h">Your result <span class="muted">roll the dice, then tap the tier</span></h4>
   <div class="jr-tiers">${[1,2,3].map(t=>`<button class="btn${x.tier===t?' primary':''}" data-action="jtier" data-v="${t}" aria-pressed="${x.tier===t}">Tier ${t}</button>`).join('')}</div>
   ${x.tier===1?`<label class="check small" style="margin-top:.5rem"><input type="checkbox" data-action="jdoom" ${x.doom?'checked':''}> It was a doom (dice 3 or lower): no Effort for it</label>`:''}
   ${x.tier&&x.tier<3&&!x.doom&&!x.effort&&c.effort>0?`<div class="jr-row" style="margin-top:.5rem"><button class="btn sm" data-action="jspend">Spend 1 Effort → tier ${x.tier+1}</button><span class="small muted">with a fitting expertise · Effort ${c.effort}</span></div>`:''}`}
function jRolesPlayer(){const c=jMe();if(!c)return `<p class="muted">Open your crow to give your answers.</p>`;const x=jIn(c),t=jTotals();
  const body=jRisky(x)?jTestCard(c,x):x.role&&x.role!=='none'&&x.task?`<p style="margin:0"><b>${esc(JRS.TASK_NAMES[x.task])}</b> is safe — nothing to roll.</p><p class="small muted" style="margin:.3rem 0 0">${rich(jTaskDef(x.task).d)}</p>`
    :x.role==='assist'?'<p class="muted" style="margin:0">Pick whose test you help on the Plan — ask the Ref to step back.</p>':'<p class="muted" style="margin:0">No role today.</p>';
  return `<section class="hxsec"><h3 class="hxh">Your test <span class="muted">${jTaskLine(x)||'no role'}</span></h3>${body}</section>
   <section class="hxsec"><h3 class="hxh">Today</h3>${jKpis(t)}</section>
   <section class="hxsec"><h3 class="hxh">The party <span class="muted">supporters roll first</span></h3>${jPartyList('roles')}</section>`}
function jRolesRef(){const t=jTotals(),miss=jAllIn().filter(a=>jWaiting(a.x));
  const acts=(c,x)=>jRisky(x)?`<div class="jr-act" role="group" aria-label="${x.tier?'Change':'Enter'} the tier for ${esc(c.name)}"><span class="small muted" style="align-self:center">${x.tier?'Change':'Enter for '+jName(c)}:</span>${[1,2,3].map(n=>`<button class="btn sm${x.tier===n?' primary':''}" data-action="jrtier" data-k="${esc(c.id)}" data-v="${n}" aria-pressed="${x.tier===n}" aria-label="Tier ${n} for ${esc(c.name)}">${n}</button>`).join('')}${x.tier?'':`<button class="btn sm ghost" data-action="jrout" data-k="${esc(c.id)}">Leave out</button>`}</div>`:'';
  return `<section class="hxsec"><h3 class="hxh">Role tests <span class="muted">${miss.length?`waiting for ${miss.length}`:'all in'}</span></h3>
    <p class="small muted" style="margin:0 0 .3rem">Players roll at the table and tap their tier. You can enter or change one.</p>${jPartyList('roles',acts)}${jHireList('roles')}</section>
   <section class="hxsec"><h3 class="hxh">Today</h3>${jKpis(t)}</section>
   <section class="hxsec"><div class="jr-row"><button class="btn primary" data-action="jprep">Prepare the day →</button><button class="btn ghost" data-action="jbackplan">Back to Plan</button></div></section>`}

/* ---------- Script (the Ref prepares the day) and Road ---------- */
// What a place on the map is for the road: a settlement stops for a vote (rest or go on), a dungeon or ruin for "explore?".
const jPoiKind=p=>{const cat=(HX_POI[p.type]||[])[0];return cat==='Settlements'?'village':['Dungeons','Fortifications','Sacred'].includes(cat)?'poi':''};
const jPoiAt=k=>hxHere()&&HX.pois.find(p=>p.k===k&&p.found&&jPoiKind(p));
const jHexName=k=>{if(!hxHere()||!HX.t[k])return '';const p=jPoiAt(k);return p?esc(p.label||tName(HX,p.type)):esc(tName(HX,HX.t[k]))};
const jChecks=()=>S.rtravel.checks||[];
// the hexmap day log keeps the day's encounters (players see them in their log once the day is over)
const jDayLog=()=>{if(!hxHere())return;const met=k=>(S.journey.script?.stops||[]).filter(x=>x.kind===k&&x.state==='done').map(x=>x.text);const r=hxDayRec();r.enc=met('enc');r.renc=met('rest');saveHX()};
// Wild Animal: the animals of the hex where it happens (journey-rules.js placeOf); without a map, the forest table stays
function jSub(c,k){if(c&&c.hit&&c.text==='Wild Animal'&&hxHere()&&k&&HX.t[k]){const t=JRS.placeOf(HX.t[k]).table;if(t&&TB[t])c.sub=t}return c}
const jEncStop=(c,n,i)=>({id:'e'+n,i,kind:'enc',state:'pending',check:n,text:c.text||'',...(c.sub?{table:c.sub}:{})});
const jPlace=len=>len>1?d(len-1):0; // a hit happens on a hex of the day's path the Ref's procedure picks; the Ref can move it
/** The day's script: the path (the lost walk is rolled now, a d6 per hex), the checks and where the stops are. */
// A route drawn from somewhere else (while lost, or before the token moved) does not start next to the party: not walked.
const jRoute=()=>{const r=S.journey.plan?.route||HX?.route||[];return r[0]===HX?.party?r.slice(1):r};
const jRouteOff=()=>{const r=jRoute();return hxHere()&&!!HX.party&&!rtDay().lost&&r.length>0&&!adj(HX,HX.party,r[0])};
// Lost (Rules): a d6 for each hex the group leaves, among passable neighbours (journey-rules.js lostOrder)
function jLostWalk(from,n){const out=[];let at=from;for(let i=0;i<n;i++){const ns=JRS.lostOrder(nbs(HX,at)),ok=x=>!!x&&hxPass(HX,x.k,true)&&!hxWall(HX,at,x);
  if(!ns.some(ok))break;let r;do{r=d(6)}while(!ok(ns[r-1]));at=ns[r-1].k;out.push(at)}return out}
function jScript(){const T=rtDay(),map=hxHere()&&!!HX.party,plan=S.journey.plan||{},nights=plan.nights||[];let path;
  if(!map)path=Array.from({length:T.hexes+1},(_,n)=>n+',0'); // no map: the steps of the day, counted
  else if(T.lost)path=[HX.party,...jLostWalk(HX.party,T.hexes)];
  else{path=[HX.party];if(!jRouteOff())for(const k of jRoute().slice(0,T.hexes))path.push(k)}
  path=path.slice(0,200);A.rcheck();const stops=[],night=map&&!T.lost?path.findIndex((k,i)=>i>0&&nights.includes(k)):-1;
  jChecks().forEach((c,n)=>{if(c.hit){const i=jPlace(night>0?night+1:path.length);jSub(c,map?path[i]:null);stops.push(jEncStop(c,n,i))}});
  if(map&&!T.lost)path.forEach((k,i)=>{if(!i)return;const p=jPoiAt(k);if(nights.includes(k))stops.push({id:'n'+i,i,k,kind:'night',state:'pending',text:p?p.label||'':''});
    else if(p)stops.push({id:(jPoiKind(p)==='village'?'v':'p')+i,i,k,kind:jPoiKind(p),state:'pending',text:p.label||tName(HX,p.type)})});
  for(const st of stops)if(st.k===undefined&&map)st.k=path[st.i];
  return {path,at:0,lost:!!T.lost,stops:stops.sort((a,b)=>a.i-b.i)}}
const jScriptSet=fn=>{const sc=JSON.parse(JSON.stringify(S.journey.script));fn(sc);sc.stops.sort((a,b)=>a.i-b.i);S.journey={...S.journey,script:sc}};
const J_KIND={enc:'Encounter',rest:'Rest encounter',village:'Village',poi:'Place',night:'Overnight'};
function jStopLine(st,ref){const c=st.kind==='enc'?jChecks()[st.check]:null,where=st.i>0?`hex ${st.i}`:'at the start';
  if(st.kind==='enc')return ref?`<b>Encounter</b> · ${where}: d10 <span class="jr-n">${c?.r}</span> ≤ EN, d100 <span class="jr-n">${c?.roll}</span> → <b>${esc(c?.text||st.text)}</b>${c?.sub?` · <button class="btn sm ghost" data-action="tgo" data-v="${c.sub}">${esc(TB[c.sub]?.title||'table')}</button>`:''}`
    :`<b>Encounter</b>${st.text?': '+esc(st.text):''}`;
  if(st.kind==='rest')return `<b>Rest encounter</b>${ref&&c0(st)?`: d10 <span class="jr-n">${c0(st).r}</span> ≤ EN, d100 <span class="jr-n">${c0(st).roll}</span> → <b>${esc(c0(st).text||st.text)}</b>`:st.text?': '+esc(st.text):''}`;
  return `<b>${J_KIND[st.kind]||'Stop'}</b> · ${where}${st.text?': '+esc(st.text):''}`}
const c0=st=>(S.rtravel.restChecks||[])[st.check];
function jScriptRef(){const sc=S.journey.script,T=rtDay(),last=sc.path.length-1,enc=sc.stops.filter(x=>x.kind==='enc'&&x.state!=='removed');
  return `<section class="hxsec"><h3 class="hxh">The day’s script <span class="muted">only you see this</span></h3>
    <p class="small" style="margin:0 0 .4rem"><b>${last} hex${last===1?'':'es'}</b> today${sc.lost?' — <b>lost</b>: the walk is rolled, a d6 per hex':''} · ${jChecks().length} check${jChecks().length===1?'':'s'} at EN ${T.en} · ${enc.length} encounter${enc.length===1?'':'s'}</p>
    ${sc.stops.filter(x=>x.state!=='removed').map(st=>`<div class="jr-li"><span class="jr-who" style="font-weight:400">${jStopLine(st,true)}</span><span class="jr-st"></span>
      ${st.kind==='enc'?`<div class="jr-act"><button class="btn sm" data-action="jsmove" data-k="${esc(st.id)}" data-v="-1" ${st.i<=0?'disabled':''}>← Earlier</button><button class="btn sm" data-action="jsmove" data-k="${esc(st.id)}" data-v="1" ${st.i>=last?'disabled':''}>Later →</button><button class="btn sm" data-action="jsreroll" data-k="${esc(st.id)}">Reroll</button><button class="btn sm ghost" data-action="jsremove" data-k="${esc(st.id)}">Remove</button></div>`:''}</div>`).join('')||'<p class="small muted" style="margin:0">No stops today: a quiet road.</p>'}
    <div class="jr-row" style="margin-top:.5rem"><button class="btn sm" data-action="jsadd">Add a check</button><span class="small muted">another check at EN ${T.en}</span></div></section>
   ${jRouteOff()?`<section class="hxsec"><p class="jr-warn" style="margin:0">The route doesn’t start next to the party${S.rtravel.mods?.back3?' — the guide found the way, and the party is somewhere else':''}, so the party stays put. Go back to the Plan: the players draw it again from where the party is.</p><div class="jr-row" style="margin-top:.4rem"><button class="btn" data-action="jbackplan">← Back to the Plan</button></div></section>`:''}
   <section class="hxsec"><div class="jr-row"><button class="btn primary" data-action="jgoroad">Go — start the road →</button><button class="btn ghost" data-action="jgo" data-v="roles">← Back to Roles</button></div></section>`}
// stops at the party's place on the path that still need something
const jHere=sc=>sc.stops.filter(x=>x.i===sc.at&&!['done','removed'].includes(x.state));
function jVotes(key,val,label){const n=PARTY.filter(c=>jIn(c)[key]===val);return `${label} <span class="jr-votes">${n.map(c=>`<i title="${esc(c.name)}">${esc(c.name.split(' ').map(w=>w[0]).join('').slice(0,2))}</i>`).join('')||'<span class="small muted">no votes</span>'}</span>`}
/* ---------- scenes: a merchant caravan and travelers on the road (The Ref: Merchant, Traveler), hirelings (Characters) ---------- */
const J_ORD=['','1st','2nd','3rd','4th','5th','6th'];
const jMon=n=>Object.values(MON).find(m=>m.name===n||m.name===String(n).replace(/^(\w+) Warrior/,'Warrior, $1')); // the tables say "Sword Warrior", the bestiary "Warrior, Sword"
const jFightBtn=(name,n)=>{const m=jMon(name);return m?` <button class="btn sm" data-action="fight" data-id="${m.id}" data-n="${n}">+ ${n} to combat</button>`:''};
const jRollText=t=>String(t).replace(/(\d+)d(\d+)/g,(m,a,b)=>{let s=0;for(let i=0;i<+a;i++)s+=d(+b);return `${s} (${m})`}); // the Ref's roll, written into the text once
const jGuards=(who,ref)=>Object.entries(who||{}).map(([n,k])=>`${+k||0} × ${esc(n)}${ref?jFightBtn(n,+k||0):''}`).join(', ');
function jMerchantInfo(sc,ref){return `<div style="margin-top:.4rem"><b>${esc(sc.name)}, ${J_ORD[+sc.lvl]||''} level${sc.name2?` and ${esc(sc.name2)}, ${J_ORD[+sc.lvl2]||''} level`:''}</b> — sells as ${sc.name2?'both institutions':'that institution'}; buys goods at ${+sc.pct||0}% of their value.
  <div class="small" style="margin-top:.3rem">${ref?`Merchant: ${esc(sc.npc)}${jFightBtn(sc.npc,1)} · guards: ${jGuards(sc.guards,true)||'none'}`:`${+sc.gn||0} guard${+sc.gn===1?'':'s'}`} · <a href="#rule/ref-merchant" data-action="open-rule" data-k="ref-merchant">rules</a></div></div>`}
function jTravelInfo(sc,ref,st){return `<div style="margin-top:.4rem"><b>${+sc.n||0} traveler${+sc.n>1?'s':''}${ref?':':''}</b> ${ref?jGuards(sc.who,true):''}<p style="margin:.3rem 0 0">${esc(ref?sc.react:sc.title||'')}</p>
  ${sc.reward?`<p style="margin:.3rem 0 0"><b>Reward:</b> ${esc(sc.reward)}</p>`:ref?`<div class="jr-row" style="margin-top:.3rem"><button class="btn sm" data-action="jtreward" data-k="${esc(st.id)}">The party helped: roll a reward</button></div>`:''}
  <div class="small" style="margin-top:.3rem"><a href="#rule/ref-traveler" data-action="open-rule" data-k="ref-traveler">rules</a></div></div>`}
function jSceneRef(st,c){const t=c?.text||'',sc=st.scene;
  if(t==='Merchant')return sc?jMerchantInfo(sc,true):`<div class="jr-row" style="margin-top:.4rem"><button class="btn sm" data-action="jmerchant" data-k="${esc(st.id)}">Roll the merchant</button></div>`;
  if(t==='Traveler')return sc?jTravelInfo(sc,true,st):`<div class="jr-row" style="margin-top:.4rem"><button class="btn sm" data-action="jtravel" data-k="${esc(st.id)}">Roll the travelers</button></div>`;
  return ''}
// players trade with the caravan on their own crow: buy at the listed price (placed like a village purchase), sell one at a time
function jTrade(st){const c=jMe(),sc=st.scene;if(!c||!sc||sc.kind!=='merchant')return '';const ins=[sc.inst,sc.inst2].filter(Boolean),v={inst:Object.fromEntries([[sc.inst,{lvl:+sc.lvl}],...(sc.inst2?[[sc.inst2,{lvl:+sc.lvl2}]]:[])]),prosperity:0,auction:{}},stock=stockOf(v).filter(s=>ins.includes(s.k)).sort((a,b)=>a.it.price-b.it.price||a.it.name.localeCompare(b.it.name)),gc=coinsOf(c),pk=S.jPick?.['b'+st.id],pick=stock.some(s=>s.it.id===pk)?pk:(stock.find(s=>s.it.price<=gc)||stock[0])?.it.id,sk=S.jPick?.['s'+st.id];
  const sells=c.inv.filter(i=>{const it=shown(i);return it&&!isPurse(i)&&i.id!=='gold-coins'&&it.cat!=='unidentified'&&buyersOf(it).some(k=>ins.includes(k))&&(i.val??it.price)>0});
  const viaRef=window.Cloud?.isActive()&&S.role!=='ref'; // on a server table a player can't add cards: the Ref does
  return `<h4 class="jr-h">Buy <span class="muted">${esc(sc.name)}, ${J_ORD[+sc.lvl]||''} level · you have ${coinsOf(c)} gc</span></h4>${viaRef?'<p class="small muted" style="margin:0 0 .3rem">On this table the Ref adds what you buy: tell them the card; they place it and take the coins.</p>':''}
   <div class="jr-row"><select id="jbuy-${esc(st.id)}" class="jr-sel" data-action="jpick" data-k="b${esc(st.id)}" aria-label="Card to buy">${stock.map(s=>`<option value="${s.it.id}"${s.it.id===pick?' selected':''}>${esc(s.it.name)} — ${s.it.price} gc${s.it.price>gc?' (too dear)':''}</option>`).join('')}</select><button class="btn" data-action="jbuy" data-k="${esc(st.id)}"${stock.length&&!viaRef?'':' disabled'}>Buy</button></div>
   <h4 class="jr-h">Sell <span class="muted">at ${+sc.pct||0}% of the value</span></h4>
   <div class="jr-row"><select id="jsell-${esc(st.id)}" class="jr-sel" data-action="jpick" data-k="s${esc(st.id)}" aria-label="Card to sell">${sells.map(i=>`<option value="${i.uid}"${String(i.uid)===sk?' selected':''}>${esc(nm(i))} — ${Math.floor((i.val??shown(i).price)*sc.pct/100)} gc</option>`).join('')||'<option value="">Nothing they buy</option>'}</select><button class="btn" data-action="jsell" data-k="${esc(st.id)}"${sells.length?'':' disabled'}>Sell one</button></div>`}
const jHirePaid=h=>h.paid===jDay();
// the companions tab's Pay today follows the same day: once, and it counts for the Journey's Plan
{const f=A['hire-pay'];A['hire-pay']=b=>{const h=ME?.hires?.[+b.dataset.k],on=jStep()!=='off';if(h&&on&&jHirePaid(h))return toast(`${h.name} is paid for today`);const d=h?.days;f(b);if(h&&on&&h.days!==d){h.paid=jDay();render()}}}
// a rider (Medium) needs a Large or bigger mount; vehicles count Large animals (Characters: Vehicles)
const jBig=p=>/Large|Huge|Holy/i.test(MON[p.mon]?.st.Size||'');
function jRidePlayer(){const c=jMe();if(!c||!(c.pets||[]).some(jBig))return '';const x=jIn(c),r=String(x.ride||''),cart=r.startsWith('v:')?r.slice(2).split(','):[];
  return `<section class="hxsec"><h3 class="hxh">How you travel <span class="muted">the slowest sets the pace</span></h3>
   <div class="jr-opts"><button class="opt" data-action="jride" data-v="" aria-pressed="${!r}"><b>On foot</b><span class="small muted">speed ${speed(c)}</span></button>
    ${c.pets.filter(jBig).map(p=>`<button class="opt" data-action="jride" data-v="p:${p.uid}" aria-pressed="${r==='p:'+p.uid}"><b>Ride ${esc(p.name)}</b><span class="small muted">speed ${jPetSpeed(p)}${(p.prayer||0)>0?' (Mount’s Prayer)':''}</span></button>`).join('')}</div>
   <h4 class="jr-h">Or a vehicle <span class="muted">the animals pulling it set its speed; they can’t be ridden</span></h4>
   <div class="jr-opts">${c.pets.filter(jBig).map(p=>`<button class="opt" data-action="jcart" data-v="${p.uid}" aria-pressed="${cart.includes(String(p.uid))}"><b>${esc(p.name)} pulls</b><span class="small muted">speed ${jPetSpeed(p)}</span></button>`).join('')}</div>
   <p class="small muted" style="margin:.4rem 0 0"><a href="#rule/c-vehicles" data-action="open-rule" data-k="c-vehicles">Vehicles</a>: how many Large animals each needs, and one human driving it.</p></section>`}
function jHireRoles(){const c=jMe();if(!c||!(c.hires||[]).length)return '';const x=jIn(c),hs=x.hires||{},lost=jTotals().lost,others=uid=>jAllIn().filter(a=>a.id!==`${c.id}/${uid}`),full=(uid,r)=>{const o=others(uid).filter(a=>a.x.role===r);return r==='guide'&&o.length>=1||r==='scout'&&o.length>=(o.some(a=>a.x.task==='places')?2:1)},opts=[['','No role'],...Object.entries(JRS.ROLES).filter(([r])=>r!=='supporter').flatMap(([r,R])=>Object.keys(R.tasks).map(t=>[`${r}:${t}`,`${r[0].toUpperCase()+r.slice(1)} · ${JRS.TASK_NAMES[t]}`]))];
  return `<section class="hxsec"><h3 class="hxh">Your hirelings’ roles <span class="muted">you play them</span></h3>${c.hires.map(h=>{const a=hs[h.uid]||{},v=a.role&&a.task?`${a.role}:${a.task}`:'';
    const off=k=>{if(!k||k===v)return false;const [r,t]=k.split(':');return full(h.uid,r)||r==='guide'&&(lost?t!=='back':t==='back')};
    const rideOpts=[['','on foot'],...(c.pets||[]).filter(jBig).map(p=>[`p:${p.uid}`,`rides ${p.name}`]),...(String(x.ride||'').startsWith('v:')?[['cart','in your vehicle']]:[])];
    return `<div class="jr-row" style="margin:.3rem 0"><label class="small" style="flex:1 1 14rem">${esc(h.name)} <select class="jr-sel" data-action="jhrole" data-k="${h.uid}" aria-label="${esc(h.name)}’s role">${opts.map(([k,l])=>`<option value="${k}"${k===v?' selected':''}${off(k)?' disabled':''}>${esc(l)}${off(k)?' (taken or not now)':''}</option>`).join('')}</select></label>
      ${rideOpts.length>1?`<label class="small" style="flex:1 1 10rem">travels <select class="jr-sel" data-action="jhride" data-k="${h.uid}" aria-label="How ${esc(h.name)} travels">${rideOpts.map(([k,l])=>`<option value="${k}"${(a.ride||'')===k?' selected':''}>${esc(l)}</option>`).join('')}</select></label>`:''}</div>`}).join('')}</section>`}
// a hireling's risky test on the Roles step: their characteristics from the stat block; the player rolls and taps the tier
function jHireTests(){const c=jMe();if(!c)return '';const rows=jHireIn(c).filter(a=>jRisky(a.x));if(!rows.length)return '';const CH={A:'Agility',M:'Mind',S:'Strength'},pace=PACE[jPace()],fx=S.journey.effects||[];
  return rows.map(a=>{const def=jTaskDef(a.x.task),st=MON[a.h.mon]?.st||{},val=k=>parseInt(st[CH[k]])||0,best=def.ch.reduce((p,q)=>val(p)>=val(q)?p:q),expert=(MON[a.h.mon]?.tr||[]).some(t=>t[0]==='Travel Expert');
    const e=jEdges(a.x.role,pace,fx),mod=val(best)+e.eb.mod;
    return `<section class="hxsec"><h3 class="hxh">${esc(a.h.name)}’s test <span class="muted">${esc(JRS.TASK_NAMES[a.x.task])}</span></h3>
     ${prHTML(def.o.map((o,j)=>[j+1,rich(o)+(e.eb.shift?`<span class="dice">${jDice(j+1,mod,e.eb.shift)}</span>`:'')]),{head:`Test 2d10 + ${def.ch.join(' or ')}`,sub:[`${esc(a.h.name)} uses ${best} ${fmt(val(best))}`,...e.why].join(', ')+` → total ${fmt(mod)}${e.eb.shift?`; ${e.eb.shift>0?'double edge: one tier up':'double bane: one tier down'}`:''}${expert?' · Travel Expert: roll twice, keep either':''}`,mod:e.eb.shift?null:mod,on:a.x.tier||undefined})}
     <div class="jr-tiers" style="margin-top:.5rem">${[1,2,3].map(t=>`<button class="btn${a.x.tier===t?' primary':''}" data-action="jhtier" data-k="${a.h.uid}" data-v="${t}" aria-pressed="${a.x.tier===t}">Tier ${t}</button>`).join('')}</div></section>`}).join('')}
function jHireList(step){const rows=PARTY.flatMap(jHireIn).filter(a=>a.x.role&&a.x.role!=='none');if(!rows.length)return '';
  const over=jOver(),ref=S.area==='session';
  return rows.map(a=>{const [cls,st]=jStatus(a.x,step);return `<div class="jr-li"><span class="jr-who">${esc(a.h.name)} <span class="muted" style="font-weight:400">· ${jName(a.c)}’s hireling</span></span><span class="jr-st ${cls}">${esc(st)}</span><span class="jr-what">${esc(jTaskLine(a.x)||'')}</span>
    ${ref&&(over.includes(a.id)||step==='roles'&&jRisky(a.x))?`<div class="jr-act">${step==='roles'&&jRisky(a.x)?[1,2,3].map(n=>`<button class="btn sm${a.x.tier===n?' primary':''}" data-action="jrhtier" data-k="${esc(a.c.id)}" data-u="${a.h.uid}" data-v="${n}" aria-pressed="${a.x.tier===n}" aria-label="${esc(a.h.name)}: tier ${n}">Tier ${n}</button>`).join(''):''}<button class="btn sm ghost" data-action="jrhout" data-k="${esc(a.c.id)}" data-u="${a.h.uid}">Leave ${esc(a.h.name)} out</button></div>`:''}</div>`}).join('')}
function jHiresPlayer(){const c=jMe();if(!c||!(c.hires||[]).length)return '';
  return `<section class="hxsec"><h3 class="hxh">Your hirelings <span class="muted">paid at the start of each day</span></h3>${c.hires.map((h,k)=>`<div class="jr-li"><span class="jr-who">${esc(h.name)}</span><span class="jr-st ${jHirePaid(h)?'ok':'wait'}">${jHirePaid(h)?'paid today':'not paid'}</span><span class="jr-what">${hirePay(h)} gc and 1 ration a day</span>${jHirePaid(h)?'':`<div class="jr-act"><button class="btn" data-action="jhpay" data-k="${k}" aria-label="Pay ${esc(h.name)} ${hirePay(h)} gc and 1 ration">Pay ${hirePay(h)} gc + 1 ration</button></div>`}</div>`).join('')}<p class="small muted" style="margin:.4rem 0 0">A hireling who isn’t paid leaves your service.</p></section>`}
function jHiresRef(){const rows=PARTY.flatMap(c=>(c.hires||[]).map((h,k)=>({c,h,k})));if(!rows.length)return '';
  return `<section class="hxsec"><h3 class="hxh">Hirelings <span class="muted">${rows.filter(r=>jHirePaid(r.h)).length} of ${rows.length} paid today</span></h3>${rows.map(({c,h,k})=>`<div class="jr-li"><span class="jr-who">${esc(h.name)} <span class="muted" style="font-weight:400">· ${jName(c)}’s</span></span><span class="jr-st ${jHirePaid(h)?'ok':'wait'}">${jHirePaid(h)?'paid':'not paid'}</span>${jHirePaid(h)?'':`<div class="jr-act"><button class="btn sm ghost" data-action="jhleave" data-c="${esc(c.id)}" data-k="${h.uid}" aria-label="${esc(h.name)} leaves the service">Unpaid: leaves the service</button></div>`}</div>`).join('')}</section>`}
// hirelings are human: those who rested in the Miasma with their crow make the Mind RR too (a Ref procedure; Characters: hirelings follow PC rules)
const jHireNight=()=>PARTY.filter(c=>jRested(c)&&c.lastRest==='miasma').flatMap(c=>(c.hires||[]).map((h,k)=>({c,h,k})));
function jHiresNightRef(){const rows=jHireNight();if(!rows.length)return '';const res=S.rtravel.hmind||{};
  return `<section class="hxsec"><h3 class="hxh">Hirelings <span class="muted">their Mind RRs — you roll</span></h3>${rows.map(({c,h,k})=>{const r=res[h.uid],M=parseInt(MON[h.mon]?.st.Mind)||0;
    return `<div class="jr-li"><span class="jr-who">${esc(h.name)} <span class="muted" style="font-weight:400">· ${jName(c)}’s</span></span><span class="jr-st ${r?'ok':'wait'}">${r?`tier ${r.tier}${r.n?': '+esc(r.n):''}`:'waiting'}</span><span class="jr-what">M ${fmt(M)}, cruelty ${h.cruelty||0}${(h.miasma||[]).length?' · '+esc(h.miasma.join(', ')):''}</span>${r?'':`<div class="jr-act"><button class="btn sm" data-action="jhmind" data-c="${esc(c.id)}" data-k="${k}" aria-label="Roll ${esc(h.name)}’s Mind RR">Roll the Mind RR</button></div>`}</div>`}).join('')}</section>`}
function jStopCardRef(st){const c=st.kind==='enc'?jChecks()[st.check]:st.kind==='rest'?(S.rtravel.restChecks||[])[st.check]:null;
  if(st.kind==='enc'||st.kind==='rest'){if(st.state==='pending')return `<div class="jr-warn" style="border-color:var(--line2);background:none">${st.kind==='rest'?'<b>The rest check hits</b> — players see nothing until you reveal it.':'<b>Encounter here</b> — players see “The road stops”.'}<div>${jStopLine(st,true)}</div></div>
      <div class="jr-row" style="margin-top:.4rem"><button class="btn primary" data-action="jreveal" data-k="${esc(st.id)}">Reveal</button>${st.kind==='enc'?`<button class="btn" data-action="jsmove" data-k="${esc(st.id)}" data-v="1" ${st.i>=S.journey.script.path.length-1?'disabled':''}>Later hex</button>`:''}<button class="btn ghost" data-action="jsremove" data-k="${esc(st.id)}">Remove</button></div>`;
    return `<div class="jr-warn"><b>${st.state==='fight'?'Fight':'Encounter'}:</b> ${esc(st.text)}${jSceneRef(st,c)}${c?.sub&&!c.html&&!['Traveler'].includes(c.text)?`<div style="margin-top:.4rem"><button class="btn sm" data-action="jfollow" data-k="${esc(st.id)}">Roll ${esc(TB[c.sub]?.title||'the follow-up')}</button></div>`:''}${c?.html?`<div style="margin-top:.4rem">${safeGameHTML(c.html,true)}</div>`:''}</div>
      <div class="jr-row" style="margin-top:.4rem">${st.state==='shown'?`<button class="btn" data-action="jfight" data-k="${esc(st.id)}">Fight</button>`:''}<button class="btn primary" data-action="jresolve" data-k="${esc(st.id)}">Resolved</button></div>`}
  const name=esc(st.text||'');
  if(st.kind==='village')return `<p style="margin:0"><b>${name}</b> — the party passes a village with hexes left today.</p><p class="small" style="margin:.3rem 0">${jVotes('stay','rest','Rest here:')} · ${jVotes('stay','go','Go on:')}</p>
    <div class="jr-row"><button class="btn primary" data-action="jstoprest" data-k="${esc(st.id)}">Rest here</button><button class="btn" data-action="jstopon" data-k="${esc(st.id)}">Go on</button></div>`;
  if(st.kind==='poi')return `<p style="margin:0"><b>${name}</b> is on the way.</p><p class="small" style="margin:.3rem 0">${jVotes('explore','yes','Explore:')} · ${jVotes('explore','no','Go on:')}</p>
    <div class="jr-row"><button class="btn primary" data-action="jexplore" data-k="${esc(st.id)}">Explore →</button><button class="btn" data-action="jstopon" data-k="${esc(st.id)}">Go on</button></div>`;
  return `<p style="margin:0"><b>Overnight${name?' in '+name:''}</b> — the plan stops here for the night.</p><div class="jr-row" style="margin-top:.4rem"><button class="btn primary" data-action="jcamp">Make camp →</button><button class="btn" data-action="jstopon" data-k="${esc(st.id)}">Go on</button></div>`}
// Walk on: the token moves a hex at a time until a stop or the day's end; Skip goes there at once. Local to this device.
let J_WALK=null,J_WALKING=false;
const jLive=()=>{let r=document.getElementById('jr-live');if(!r&&document.body){r=document.createElement('div');r.id='jr-live';r.setAttribute('aria-live','polite');document.body.append(r)}return r};
if(document.body)jLive();else document.addEventListener('DOMContentLoaded',jLive);
const jSay=t=>{const r=jLive();if(r&&r.textContent!==t)r.textContent=t};
const jWalkStop=()=>{if(J_WALK)clearTimeout(J_WALK);J_WALK=null;J_WALKING=false};
const jWalkDone=()=>{const sc=S.journey?.script;return jStep()!=='road'||!sc||jHere(sc).length>0||sc.at>=sc.path.length-1};
function jWalkTick(){J_WALK=null;if(!J_WALKING)return;if(jWalkDone()){J_WALKING=false;return render()}if(window.Cloud?.isCommitting?.()){J_WALK=setTimeout(jWalkTick,250);return}
  if(window.Cloud?.hasConflict?.()){J_WALKING=false;toast('Walking stopped: resolve the conflict first');return render()}
  const at=S.journey.script.at;A.jstep();if(S.journey.script?.at===at){J_WALKING=false;toast('Walking stopped: the step didn’t go through');return render()}
  {const sc=S.journey.script;jSay(jHere(sc).length?`Stopped at hex ${sc.at}: ${jHere(sc).map(x=>J_KIND[x.kind]||'stop').join(', ')}`:`Walked to hex ${sc.at} of ${sc.path.length-1}`)}
  if(jWalkDone()){J_WALKING=false;render()}else J_WALK=setTimeout(jWalkTick,matchMedia('(prefers-reduced-motion: reduce)').matches?0:700)}
// Strong Miasma (The Ref): a party lost while it lasts, or lost when it strikes, is carried 1d10 hexes the way the Ref picks — once
const jCarryFx=()=>{const i=(S.journey.effects||[]).findIndex(e=>e.kind==='strong'&&e.until>=S.rtravel.day&&!e.carried);return i>=0&&jStep()==='road'&&(S.journey.script?.lost||rtDay().lost)&&hxHere()&&HX.party?i:-1};
const jCarryCard=()=>jCarryFx()<0?'':`<section class="hxsec"><div class="jr-warn" style="margin:0"><b>Strong Miasma, and the party is lost:</b> it is carried 1d10 hexes. Pick the way:<div class="jr-row" style="margin-top:.4rem">${nbs(HX,HX.party).map(n=>`<button class="btn sm" data-action="jcarry" data-v="${Math.round(n.ang)}">${n.dir}</button>`).join('')}</div></div></section>`;
function jRoadRef(){const sc=S.journey.script,last=sc.path.length-1,here=jHere(sc),next=sc.path[sc.at+1];
  const list=sc.path.map((k,i)=>{const st=sc.stops.filter(x=>x.i===i&&x.state!=='removed');return i?`<li class="${i<sc.at?'done':i===sc.at?'cur':''}"><b>${i}.</b> ${jHexName(k)||'hex '+i}${st.map(x=>` · <span class="${x.kind==='enc'?'bad':''}">${x.kind==='enc'?esc(x.text||'encounter'):(x.kind==='village'||x.kind==='poi')&&x.text?esc(x.text):J_KIND[x.kind]||'stop'}</span>${x.state==='done'?' ✓':''}`).join('')}</li>`:''}).join('');
  return `${jCarryCard()}<section class="hxsec"><h3 class="hxh">On the road <span class="muted">hex ${sc.at} of ${last}${sc.lost?' · lost':''}</span></h3>
    ${here.length?here.map(jStopCardRef).join('<hr style="border:0;border-top:1px solid var(--line)">')
     :sc.at<last?(J_WALKING?`<div class="jr-row"><span class="jr-walking">Walking… ${jHexName(sc.path[sc.at])||'hex '+sc.at}</span><button class="btn primary" data-action="jskip" aria-label="Skip to the next stop">Skip ⏭</button></div>`
       :`<div class="jr-row"><button class="btn primary" data-action="jwalk">Walk on →</button><button class="btn" data-action="jstep">Next hex → ${jHexName(next)||'hex '+(sc.at+1)}</button><button class="btn ghost" data-action="jskip">Skip to the next stop</button><button class="btn ghost" data-action="jstophere">Stop here</button></div>`)
     :`<p style="margin:0 0 .4rem">That’s today’s hexes.</p><div class="jr-row"><button class="btn primary" data-action="jcamp">Make camp →</button></div>`}</section>
   <section class="hxsec"><h3 class="hxh">Today’s path</h3><ol class="jr-path">${list||'<li class="small muted">No moving today.</li>'}</ol></section>`}
const jEncCard=st=>`<div class="jr-warn"><b>${st.state==='fight'?'Fight!':st.kind==='rest'?'Encounter at the camp':'Encounter'}</b> ${esc(st.text||'')}${st.scene?.kind==='merchant'?jMerchantInfo(st.scene,false)+(st.state==='shown'?jTrade(st):''):st.scene?.kind==='traveler'?jTravelInfo(st.scene,false,st):''}${st.state==='fight'?`<div class="jr-row" style="margin-top:.4rem"><button class="btn" data-action="tab" data-v="actions">Actions →</button></div>`:''}</div>`;
// what a player may see: on the Ref's own device (one device) the projection, as a server table gives it
const jPub=()=>S.role==='ref'?JRS.projectJourney(S.journey):S.journey;
function jRoadPlayer(){const sc=jPub().script,c=jMe(),x=c?jIn(c):{};if(!sc)return '<p class="muted">On the road.</p>';
  const here=sc.stops.filter(st=>st.state!=='done'),seen=sc.stops.filter(st=>st.state==='done'&&st.text);
  const card=st=>{if(st.state==='pending')return `<p class="jr-warn" style="border-color:var(--line2);background:none"><b>The road stops.</b> The Ref describes what you see.</p>`;
    if(st.kind==='enc'||st.kind==='rest')return jEncCard(st);
    if(st.kind==='village')return `<p style="margin:0"><b>${esc(st.text||'A village')}</b> — rest here tonight, or go on?</p><div class="jr-opts" style="margin-top:.4rem"><button class="opt" data-action="jvote" data-k="stay" data-v="rest" aria-pressed="${x.stay==='rest'}"><b>Rest here</b></button><button class="opt" data-action="jvote" data-k="stay" data-v="go" aria-pressed="${x.stay==='go'}"><b>Go on</b></button></div>`;
    if(st.kind==='poi')return `<p style="margin:0"><b>${esc(st.text||'A place')}</b> is on the way. Explore it?</p><div class="jr-opts" style="margin-top:.4rem"><button class="opt" data-action="jvote" data-k="explore" data-v="yes" aria-pressed="${x.explore==='yes'}"><b>Explore</b></button><button class="opt" data-action="jvote" data-k="explore" data-v="no" aria-pressed="${x.explore==='no'}"><b>Go on</b></button></div>`;
    return `<p style="margin:0"><b>Overnight${st.text?' in '+esc(st.text):''}.</b></p>`};
  return `<section class="hxsec"><h3 class="hxh">On the road <span class="muted">${sc.lost?'lost — the Ref knows where you are':`hex ${sc.at}`}</span></h3>${here.length?here.map(card).join(''):'<p class="muted" style="margin:0">The party walks on. The Ref moves the token.</p>'}</section>
   ${seen.length?`<section class="hxsec"><h3 class="hxh">Today so far</h3>${seen.map(st=>`<p class="small" style="margin:0 0 .3rem">${jStopLine(st,false)}</p>`).join('')}</section>`:''}`}
const jFighting=()=>!!S.journey?.script?.stops?.some(x=>x.state==='fight');

/* ---------- Camp, Night, Dawn ---------- */
const J_PLACE={outdoor:'Outdoors',ruin:'A ruin',dungeon:'In a dungeon',home:'Your home village',village:'A village',beacon:'Outdoors, inside a beacon’s light'};
const jRestAt=()=>{const cp=S.journey.camp||{place:'outdoor'};return JRS.restAt(cp.place,{closed:cp.closed===true})};
// rested at this camp: the crow's rest count went up since the camp began
const jRested=c=>(c.rests||0)>(S.journey.camp?.base?.[c.id]??Infinity);
const jNeedsMind=c=>jRested(c)&&c.lastRest==='miasma'&&(!(c.miasma||[]).some(m=>m.n===MI_NAMES[13])||miDone(c)); // a 13+ from tonight's roll can still be lifted
const jLiftValid=o=>miDone(o)&&o.miLast.k==='fx'||jIn(o).mind===2;
const jMindDone=c=>{const x=jIn(c),o=x.lift&&PARTY.find(p=>p.id===x.lift);return miDone(c)||x.mind===2||x.mind===3&&!!o&&(jIn(o).lifted||jLiftValid(o))};
// lift (Rules: Miasma, tier 3): an ally who rested with you, at tier 1 or 2, not lifted already
const jLiftable=c=>PARTY.filter(o=>o!==c&&jNeedsMind(o)&&!jIn(o).lifted&&(miDone(o)&&o.miLast.k==='fx'||jIn(o).mind===2)&&!PARTY.some(p=>p!==c&&jIn(p).lift===o.id));
const jLiftBy=c=>PARTY.find(p=>p!==c&&jIn(p).lift===c.id);
const jLiftPending=c=>!!jLiftBy(c)&&!jIn(c).lifted&&jLiftValid(c);
const jLiftCard=(c,ref)=>{const by=jLiftBy(c),x=jIn(c);if(!by||x.lifted||!jLiftValid(c))return '';const t1=miDone(c)&&c.miLast.k==='fx';
  return `<div class="jr-note" style="margin:0 0 .5rem"><b>${jName(by)} helped ${ref?jName(c):'you'} resist:</b> ${t1?'tier 1 becomes tier 2 — the cruelty and the effect go.':'tier 2 becomes tier 3.'}<div class="jr-row" style="margin-top:.4rem"><button class="btn primary" data-action="${ref?'jrlift':'jmlifted'}" data-k="${esc(c.id)}">Apply: tier ${t1?1:2} → ${t1?2:3}</button></div></div>`};
// Fight the Miasma (Supporter, safe): an ally named for it gets +1 on their next Mind RR
// Fight the Miasma (Travel Roles): +1 on the ally's next Mind RR — today's, or one carried from a night without a Mind RR
const jFightBonus=c=>(S.journey.fight||[]).includes(c.id)||PARTY.some(o=>o!==c&&jIn(o).task==='fight'&&(jIn(o).targets||[]).includes(c.id));
const J_RCAMP={outdoor:'miasma',ruin:'ruin',village:'village',home:'village'}; // the Travel day tab's camp
function jCampLine(){const r=jRestAt(),cp=S.journey.camp||{};
  return `${J_PLACE[cp.place]||'Outdoors'}${cp.poi?' · '+esc(cp.poi):''}: ${r.mind?'in the Miasma — no Effort back, humans make a Mind RR tonight':'out of the Miasma — Effort back, cruelty clears'}${r.check?'; the Ref rolls rest checks':'; no rest checks'}${r.food==='home'?'; your home feeds you':r.food==='inn'?'; the inn feeds you for 5 gc':''}.`}
const jSeclude=()=>PARTY.some(c=>jIn(c).act==='seclude');
const jRestDay=()=>{const m={...S.rtravel.mods};if(jSeclude())m.seclude=true;else delete m.seclude;return JRS.dayTotals({...S.rtravel,mods:m},groupSpeed())};
function jCampRef(){const cp=S.journey.camp||{},T=jRestDay(),r=jRestAt(),sc=S.journey.script,rest=sc?sc.stops.filter(x=>x.kind==='rest'&&!['done','removed'].includes(x.state)):[];
  const places=['outdoor',...(T.ruin?['ruin']:[]),'village','home','dungeon','beacon'];
  return `<section class="hxsec"><h3 class="hxh">Camp <span class="muted">${jCampLine()}</span></h3>
    <div class="jr-opts">${places.map(k=>`<button class="opt" data-action="jplace" data-v="${k}" aria-pressed="${cp.place===k}"><b>${J_PLACE[k]}</b></button>`).join('')}</div>
    ${cp.place==='ruin'?`<div class="jr-row" style="margin-top:.5rem"><button class="btn sm" data-action="rruin">Roll if the ruin is inhabited (10%)</button>${S.rtravel.ruinRoll?`<span>d100 <span class="jr-n">${S.rtravel.ruinRoll}</span> ${S.rtravel.ruinRoll<=10?'<b>inhabited</b> — use an encounter table':'empty'}</span>`:''}</div>`:''}
    ${cp.place==='dungeon'?`<p class="small" style="margin:.5rem 0 .3rem">Is this place closed off from the Miasma?</p><div class="jr-row"><button class="btn sm${cp.closed===true?' primary':''}" data-action="jclosed" data-v="yes" aria-pressed="${cp.closed===true}">Yes, closed</button><button class="btn sm${cp.closed===false?' primary':''}" data-action="jclosed" data-v="no" aria-pressed="${cp.closed===false}">No, open</button></div>`:''}</section>
   ${r.check?`<section class="hxsec"><h3 class="hxh">Rest checks <span class="muted">EN ${T.ren}${jSeclude()?' (Seclude Camp −1)':''} · ${T.rchk} check${T.rchk>1?'s':''}</span></h3>
     ${(S.rtravel.restChecks||[]).map((c,k)=>encLine(c,k,'Check')).join('')||''}
     ${rest.map(jStopCardRef).join('')}
     <div class="jr-row" style="margin-top:.4rem">${rest.some(x=>['shown','fight'].includes(x.state))?'':`<button class="btn" data-action="jrestcheck">${(S.rtravel.restChecks||[]).length?'Roll again':'Roll rest checks'}</button>`}${(cp.restart||0)||(sc?sc.stops.some(x=>x.kind==='rest'&&x.state!=='removed'):false)?`<button class="btn ghost" data-action="jrestart">Rest interrupted — start again</button>`:''}</div></section>`:''}
   <section class="hxsec"><h3 class="hxh">The party <span class="muted">${PARTY.filter(jRested).length} of ${PARTY.length} rested</span></h3>
    ${PARTY.map(c=>{const x=jIn(c),act=RACT.find(a=>a[0]===x.act);return `<div class="jr-li"><span class="jr-who">${jName(c)}</span><span class="jr-st ${jRested(c)?'ok':'wait'}">${jRested(c)?'rested':'not yet'}</span><span class="jr-what">${x.act==='gamble'?'Gamble at the inn':act?esc(act[1]):'no activity yet'}${x.food==='none'?' · no food':x.food?' · eats':''}</span></div>`}).join('')}
    <p class="small muted" style="margin:.4rem 0 0">Each player finishes their own rest; it feeds them, heals and counts their XP.</p></section>
   <section class="hxsec"><div class="jr-row"><button class="btn primary" data-action="jfinishcamp">Finish the rest →</button>${sc&&sc.at<sc.path.length-1&&!PARTY.some(jRested)?'<button class="btn ghost" data-action="jbackroad">← Back to the road</button>':''}</div></section>`}
function jCampPlayer(){const c=jMe();if(!c)return `<p class="muted">Open your crow to rest.</p>`;const x=jIn(c),cp=S.journey.camp||{},r=jRestAt(),village=['village','home'].includes(cp.place);
  const seclude=PARTY.find(o=>o!==c&&jIn(o).act==='seclude'),rat=c.inv.filter(i=>i.id==='ration').reduce((a,i)=>a+i.count,0),need=c.miasma.some(m=>m.n===MI_NAMES[3])?2:1;
  const acts=[...RACT.map(a=>[a[0],a[1]]),...(village?[['gamble','Gamble at the inn']]:[])];
  if(jRested(c))return `<section class="hxsec"><h3 class="hxh">Camp <span class="muted">rested</span></h3><p style="margin:0">You finished your rest.${c.lastRest==='miasma'?' Tonight you make your Mind RR.':''}</p>${S.rest.log?`<div class="small" style="margin-top:.4rem">${S.rest.log.map(l=>`<div>${safeGameHTML(l,true)}</div>`).join('')}</div>`:''}</section>`;
  const enc=(jPub().script?.stops||[]).filter(y=>y.kind==='rest'&&['shown','fight'].includes(y.state));
  return `${enc.length?`<section class="hxsec">${enc.map(jEncCard).join('')}</section>`:''}<section class="hxsec"><h3 class="hxh">Camp</h3><p class="small" style="margin:0">${jCampLine()}</p></section>
   <section class="hxsec"><h3 class="hxh">Your activity <span class="muted">one per rest</span></h3>
    <div class="jr-opts">${acts.map(([k,l])=>{const off=k==='seclude'&&seclude;return `<button class="opt" data-action="jact" data-v="${k}" aria-pressed="${x.act===k}"${off&&x.act!==k?' disabled':''}><b>${esc(l)}</b>${off?`<span class="small muted">${jName(seclude)} is on it</span>`:''}</button>`}).join('')}
     <button class="opt" data-action="jact" data-v="" aria-pressed="${x.day===jDay()&&x.act===''}"><b>No activity</b></button></div></section>
   <section class="hxsec"><h3 class="hxh">Food <span class="muted">${need} ration${need>1?'s':''} · you carry ${rat}</span></h3>
    <div class="jr-opts">${cp.place==='home'?`<button class="opt" data-action="jfood" data-v="home" aria-pressed="${x.food==='home'}"><b>Home</b><span class="small muted">your own village feeds you</span></button>`:''}${village?`<button class="opt" data-action="jfood" data-v="inn" aria-pressed="${x.food==='inn'}"><b>Inn · 5 gc</b><span class="small muted">${c.innFood?'paid: a bed and a day’s food':'paid as you finish the rest'}</span></button>`:''}
     <button class="opt" data-action="jfood" data-v="own" aria-pressed="${x.food==='own'}"${rat?'':' disabled'}><b>Eat ${need} ration${need>1?'s':''}</b>${rat?'':`<span class="small muted">none on you${S.pool.some(i=>i.id==='ration')?' — some in the loot pool':''}</span>`}</button>
     <button class="opt" data-action="jfood" data-v="none" aria-pressed="${x.food==='none'}"><b>Go hungry</b><span class="small muted">no benefits, a starvation wound</span></button></div></section>
   <section class="hxsec">${r.check&&cp.ready!==true?`<p class="jr-note" style="margin:0 0 .4rem">Wait for the Ref’s rest checks: an encounter would interrupt the rest.</p>`:''}<div class="jr-row"><button class="btn primary" data-action="jrest"${r.check&&cp.ready!==true?' disabled':''}>Finish my rest →</button></div><p class="small muted" style="margin:.4rem 0 0">The Rest tab opens with your camp, activity and food filled in: pick what the activity is for and finish there.</p></section>`}
function jNightPlayer(){const c=jMe();if(!c)return '';if(!jNeedsMind(c))return `<section class="hxsec"><h3 class="hxh">Night</h3><p style="margin:0">${jRested(c)?'You slept out of the Miasma — nothing to roll.':'You haven’t rested at this camp.'}</p></section>`;
  const x=jIn(c),rr=JRS.mindRR(c,{fight:jFightBonus(c),strong:(S.journey.effects||[]).some(e=>e.kind==='strong')}),rows=MI_ROWS();
  const lift=jLiftCard(c,false);
  if(miDone(c))return `<section class="hxsec"><h3 class="hxh">Night <span class="muted">your Mind RR</span></h3>${lift}${miResultHTML(c,'jmundo')}</section>`;
  if(x.mind===2)return `<section class="hxsec"><h3 class="hxh">Night</h3>${lift}<p style="margin:0">Tier 2: the Miasma doesn’t touch you tonight.</p>${x.lifted?'':'<button class="btn sm ghost" data-action="jmind" data-v="0" style="margin-top:.4rem">Change</button>'}</section>`;
  if(x.mind===3&&x.lift){const o=PARTY.find(p=>p.id===x.lift);return `<section class="hxsec"><h3 class="hxh">Night <span class="muted">tier 3</span></h3><p style="margin:0">You help <b>${o?jName(o):'an ally'}</b> resist: their result goes up a tier${o&&jIn(o).lifted?' — done':''}.</p>${o&&jIn(o).lifted?'':'<button class="btn sm ghost" data-action="jmlift" data-k="" style="margin-top:.4rem">Change</button>'}</section>`}
  return `<section class="hxsec"><h3 class="hxh">Night <span class="muted">you slept in the Miasma</span></h3>
    ${prHTML([[1,'Cruelty +1, then d10 + cruelty on Miasma Effects.'],[2,'Nothing happens.'],[3,'Cruelty back to 0 (or lift a human ally’s result one tier).']],{head:'Mind RR · 2d10 + M − cruelty',sub:`M ${fmt(c.ch.M)}, cruelty ${c.cruelty}${rr.mod!==c.ch.M-c.cruelty?', Fight the Miasma +1':''}${rr.bane?' · Strong Miasma: bane':''} → total ${fmt(rr.mod)}`,mod:rr.mod,on:x.mind||undefined})}
    ${x.lifted?`<p class="jr-note" style="margin:.5rem 0 0"><b>Lifted to tier 3.</b> Choose: clear your cruelty, or lift another human.</p>`:`<div class="jr-tiers" style="margin-top:.5rem">${[1,2,3].map(t=>`<button class="btn${x.mind===t?' primary':''}" data-action="jmind" data-v="${t}" aria-pressed="${x.mind===t}">Tier ${t}</button>`).join('')}</div>`}
    ${x.mind===1?`<h4 class="jr-h">Your d10 <span class="muted">roll it, tap the number; the app adds cruelty ${c.cruelty+1}</span></h4><div class="jr-opts" style="grid-template-columns:repeat(5,minmax(0,1fr))">${Array.from({length:10},(_,k)=>`<button class="opt" data-action="jmd10" data-v="${k+1}" style="align-items:center"><b>${k+1}</b></button>`).join('')}</div>`:''}
    ${x.mind===3?`<div class="jr-row" style="margin-top:.5rem"><button class="btn primary" data-action="jmclear">Clear my cruelty${c.cruelty?` (${c.cruelty} → 0)`:''}</button></div>
      ${!jLiftable(c).length&&PARTY.some(o=>o!==c&&jNeedsMind(o)&&!jMindDone(o))?`<p class="small muted" style="margin:.4rem 0 0">To lift an ally instead, wait until ${PARTY.filter(o=>o!==c&&jNeedsMind(o)&&!jMindDone(o)).map(jName).join(' or ')} enters a tier 1 or 2 — it appears here.</p>`:''}
      ${jLiftable(c).length?`<h4 class="jr-h">Or lift a human who rested with you <span class="muted">their result goes up a tier</span></h4><div class="jr-row">${jLiftable(c).map(o=>`<button class="btn" data-action="jmlift" data-k="${esc(o.id)}">${jName(o)}: tier ${miDone(o)?1:2} → ${miDone(o)?2:3}</button>`).join('')}</div>`:''}`:''}</section>`}
function jNightRef(){const who=PARTY.filter(jNeedsMind);
  return `<section class="hxsec"><h3 class="hxh">Night <span class="muted">${who.length+jHireNight().length?`${who.filter(c=>jMindDone(c)&&!jLiftPending(c)).length+jHireNight().filter(a=>S.rtravel.hmind?.[a.h.uid]).length} of ${who.length+jHireNight().length} Mind RRs in`:'nobody slept in the Miasma'}</span></h3>
    ${who.map(c=>`${jLiftCard(c,true)}<div class="jr-li"><span class="jr-who">${jName(c)}</span><span class="jr-st ${jMindDone(c)?'ok':'wait'}">${miDone(c)?(c.miLast.k==='clear'?'tier 3':'tier 1: '+esc(c.miLast.hit.n)):jIn(c).mind===2?'tier 2':jIn(c).mind===3&&jIn(c).lift?`tier 3: lifts ${jName(PARTY.find(p=>p.id===jIn(c).lift)||{name:'?'})}`:jIn(c).mind===3&&jIn(c).lifted?'lifted to tier 3: choosing':'waiting'}</span><span class="jr-what">M ${fmt(c.ch.M)}, cruelty ${c.cruelty}</span>
      ${jMindDone(c)?'':jIn(c).lifted?`<div class="jr-act"><span class="small muted" style="align-self:center">For ${jName(c)}:</span><button class="btn sm" data-action="jrclear" data-k="${esc(c.id)}">Clear cruelty</button></div>`:`<div class="jr-act"><span class="small muted" style="align-self:center">For ${jName(c)}:</span><button class="btn sm" data-action="rmroll" data-k="${PARTY.indexOf(c)}">Tier 1 — roll d10</button><button class="btn sm" data-action="jrmind2" data-k="${esc(c.id)}">Tier 2</button></div>`}</div>`).join('')}</section>
   ${jHiresNightRef()}<section class="hxsec"><div class="jr-row"><button class="btn primary" data-action="jgodawn">To dawn →</button><button class="btn ghost" data-action="jgo" data-v="camp">← Back to camp</button></div></section>`}
function jDawnRef(){const T=rtDay(),cp=S.journey.camp||{},vill=['village','home'].includes(cp.place),due=VILLAGES.filter(v=>v.day+1>=20),lostOn=T.lost&&!T.foundEnd;
  const rows=[`Day ${S.rtravel.day} ends; day ${S.rtravel.day+1} begins.`,...PARTY.filter(c=>!jRested(c)).map(c=>`${esc(c.name)} didn’t rest: an exhaustion wound (mark it on the Sheet).`),
    ...PARTY.filter(c=>miDone(c)&&c.miLast.k==='fx').map(c=>`${esc(c.name)}: ${esc(c.miLast.hit.n)} (Miasma).`),lostOn?'The group is still lost.':T.lost?'The guide finds the way: no longer lost.':'',
    due.length?`Day 20 in ${due.map(v=>esc(v.name)).join(', ')}: close the cycle on Villages & XP.`:''].filter(Boolean);
  return `<section class="hxsec"><h3 class="hxh">Dawn</h3><ul class="jr-dawn">${rows.map(r=>`<li>${r}</li>`).join('')}</ul></section>
   <section class="hxsec"><div class="jr-row">${vill?`<button class="btn primary" data-action="jdawn">Set out →</button><button class="btn" data-action="jstayvillage">Stay in the village</button>`:`<button class="btn primary" data-action="jdawn">Start day ${S.rtravel.day+1} →</button>`}<button class="btn ghost" data-action="jgo" data-v="${PARTY.some(jNeedsMind)?'night':'camp'}">← Back</button></div></section>`}

function jDawnPlayer(){const c=jMe(),tired=c&&!jRested(c)&&S.journey.camp,marked=S.jExhausted===`${c?.id}:${S.journey.day}`;
  return `<section class="hxsec"><h3 class="hxh">Dawn</h3><p style="margin:0">The Ref closes the day.</p>
   ${tired?`<p class="jr-warn">You didn’t finish a rest: a day without one gives an exhaustion wound.</p><div class="jr-row" style="margin-top:.4rem">${marked?'<span class="small muted">Marked.</span>':'<button class="btn primary" data-action="jexhaust">Mark the exhaustion wound</button>'}</div>`:'<p class="small muted" style="margin:.3rem 0 0">Your Sheet is up to date: Stamina, wounds and effects.</p>'}</section>`}
/* ---------- My crow: the player's numbers without leaving the map ---------- */
function jMyCrow(){const c=jMe();if(!c||S.area==='session')return '';const l=lightOf(c),rat=c.inv.filter(i=>i.id==='ration').reduce((a,i)=>a+i.count,0);
  const chip=(label,val,tab,bad)=>`<button class="jr-chip${bad?' bad':''}" data-action="tab" data-v="${tab}" aria-label="${label} ${val}, open ${tab==='sheet'?'Sheet':'Inventory'}"><span>${label}</span> <b>${val}</b></button>`;
  return `<div class="jr-me" role="group" aria-label="My crow">${chip('Stamina',`${c.stamina}/${stMax(c)}`,'sheet',c.stamina===0)}${chip('AD',adNow(c),'sheet')}${chip('Wounds',c.wounds.size,'sheet',c.wounds.size>0)}
    ${chip('Effort',`${c.effort}/${effMax(c)}`,'sheet')}${chip('Light',l?`${esc(IT[l.id].name)}${l.ud!=null?' · '+l.ud+' UD':''}`:'none','inventory',!l)}${chip('Rations',rat,'inventory',!rat)}${c.cruelty?chip('Cruelty',c.cruelty,'sheet',true):''}</div>`}

/* ---------- the tab ---------- */
function jOff(){if(S.area!=='session')return `<section class="hxsec"><h3 class="hxh">Journey</h3><p class="muted" style="margin:0">The Ref starts the journey. Then the day’s steps show here: route and roles, the road, camp and night.</p></section>`;
  const v=VILLAGES.find(x=>x.id===S.here);
  return `<section class="hxsec"><h3 class="hxh">Journey <span class="muted">day ${S.rtravel.day}</span></h3><p style="margin:0 0 .6rem">Start the day: players then plan the route, vote on the pace and choose their roles here.</p>
   <div class="jr-row"><button class="btn primary" data-action="jstart">${v?`Party leaves ${esc(v.name)}`:'Set out'} →</button></div>
   ${hxHere()?'':'<p class="small muted" style="margin:.5rem 0 0">No map on this device for this adventure: the journey runs without one, hexes as a count.</p>'}</section>`}
const jWxLine=n=>{const k=JRS.WEATHER_FX[n],h=k?Math.abs(JRS.FX[k].h):0,bn=JRS.WEATHER_BANES[n],id=`ref-${String(n).toLowerCase().replace(/ /g,'-')}`;
  return [h?`${h} hex${h>1?'es':''} less a day (tomorrow's numbers; today the Ref can camp early)`:'',bn?`${bn>1?'a double bane':'a bane'} on guide, scout and tracker tests`:'',
    BOOK[id]?`<a href="#rule/${id}" data-action="open-rule" data-k="${id}">rules</a>`:''].filter(Boolean).map((x,i)=>(i?' · ':': ')+x).join('')};
// Weather tests (The Ref: Blizzard, Cold Snap, Heat Wave, Rain, Thunderstorm): the player rolls 2d10 + S or M and taps the tier;
// rations lost to mold come off the crow's own stack
function jWxTests(){const fx=(S.journey.effects||[]).filter(e=>e.kind==='weather'&&e.until-1===jDay()).map(e=>e.name); // the 24 hours begin the day it strikes: tested that day, once
  return [...new Set(fx)].map(n=>{const B=BOOK[`ref-${String(n).toLowerCase().replace(/ /g,'-')}`];if(!B)return null;const i=B.body.findIndex(p=>p.roll);if(i<0)return null;
    return {n,when:B.body.slice(0,i).map(p=>p.x).filter(Boolean).join(' '),roll:B.body[i].roll,ch:(B.body[i].roll.match(/\+ ([ASM])\b/)||[])[1]||'S',tiers:B.body.filter(p=>p.tier).map(p=>p.x),after:B.body.slice(i+1).filter(p=>!p.tier&&p.x).map(p=>p.x).join(' ')}}).filter(Boolean)}
const jWxGot=(x,n)=>{const m=String(x.wx||'').split(';').find(s=>s.startsWith(n+':'));return m?m.slice(n.length+1):''};
const jWxSet=(x,n,v)=>[...String(x.wx||'').split(';').filter(s=>s&&!s.startsWith(n+':')),...(v?[`${n}:${v}`]:[])].join(';');
const jMold=t=>{const m=String(t).match(/lose (\d+)d6(?: \+ (\d+))?|lose (\d+) ration/);if(!m)return null;if(m[3])return {fixed:+m[3]};const n=+m[1],p=+(m[2]||0);return {lo:n+p,hi:6*n+p}};
const J_RATIONS=['ration','hearty-ration'],J_COLD=['Blizzard','Cold Snap'];
const jRations=c=>c.inv.filter(i=>J_RATIONS.includes(i.id)).sort((a,b)=>J_RATIONS.indexOf(a.id)-J_RATIONS.indexOf(b.id));
function jWxPlayer(){const c=jMe();if(!c||!['road','camp'].includes(jStep()))return '';const x=jIn(c),rat=jRations(c).reduce((a,i)=>a+i.count,0),walked=jPub().script?.at||0;
  return jWxTests().filter(w=>!(w.n==='Heat Wave'&&walked<=2)&&!(J_COLD.includes(w.n)&&c.inv.some(i=>i.id==='cold-weather-gear'))&&!(/rations/.test(w.when)&&!rat&&!jWxGot(x,w.n))).map(w=>{
    if(J_COLD.includes(w.n)){const ts=String(jWxGot(x,w.n)||'').split(',').filter(Boolean).map(Number),mod=c.ch[w.ch]-2*ts.length,hours=+(S.journey.effects||[]).find(e=>e.name===w.n)?.hours||0;
      return `<section class="hxsec"><h3 class="hxh">${esc(w.n)} <span class="muted">${hours>ts.length?`hour ${ts.length+1} of ${hours}: your test is due`:'each hour outside without cold weather gear'}</span></h3><p class="small" style="margin:0 0 .4rem">${esc(w.when)}</p>
       ${prHTML(w.tiers.map((o,j)=>[j+1,esc(o)]),{head:`Test ${esc(w.roll)}${ts.length?` · hour ${ts.length+1}`:''}`,sub:`you use ${w.ch} ${fmt(c.ch[w.ch])}${ts.length?`, −2 for each of ${ts.length} earlier test${ts.length>1?'s':''}`:''} → total ${fmt(mod)}`,mod})}
       ${ts.length?`<p class="small" style="margin:.4rem 0 0">So far: ${ts.map(t=>'tier '+t).join(', ')}. Roll the damage and mark it on your Sheet.</p>`:''}
       ${hours>0&&ts.length>=hours?`<p class="jr-note" style="margin:.5rem 0 0">Hour ${ts.length} done — the Ref marks the next hour outside.</p>`:`<div class="jr-tiers" style="margin-top:.5rem">${[1,2,3].map(k=>`<button class="btn" data-action="jwx" data-k="${esc(w.n)}" data-v="${k}">Hour ${ts.length+1}: tier ${k}</button>`).join('')}</div>`}${ts.length?`<div class="jr-row" style="margin-top:.4rem"><button class="btn sm ghost" data-action="jwxundo" data-k="${esc(w.n)}">Undo the last</button></div>`:''}</section>`}
    const got=jWxGot(x,w.n),t=+String(got).split('/')[0]||0,lost=String(got).split('/')[1],mold=t&&jMold(w.tiers[t-1]);
    return `<section class="hxsec"><h3 class="hxh">${esc(w.n)} <span class="muted">your test</span></h3><p class="small" style="margin:0 0 .4rem">${esc(w.when)}</p>
     ${prHTML(w.tiers.map((o,j)=>[j+1,esc(o)]),{head:`Test ${esc(w.roll)}`,sub:`you use ${w.ch} ${fmt(c.ch[w.ch])}`,mod:c.ch[w.ch],on:t||undefined})}${w.after?`<p class="small muted" style="margin:.4rem 0 0">${esc(w.after)}</p>`:''}
     <div class="jr-tiers" style="margin-top:.5rem">${[1,2,3].map(k=>`<button class="btn${t===k?' primary':''}" data-action="jwx" data-k="${esc(w.n)}" data-v="${k}" aria-pressed="${t===k}">Tier ${k}</button>`).join('')}</div>
     ${mold&&lost==null?(mold.fixed?`<div class="jr-row" style="margin-top:.5rem"><button class="btn primary" data-action="jmold" data-k="${esc(w.n)}" data-v="${mold.fixed}"${rat?'':' disabled'}>Lose ${mold.fixed} ration${mold.fixed>1?'s':''} to mold</button></div>`
       :`<h4 class="jr-h">Rations lost <span class="muted">roll it, tap the number · you carry ${rat}</span></h4><div class="jr-opts" style="grid-template-columns:repeat(auto-fill,minmax(3.2rem,1fr))">${Array.from({length:mold.hi-mold.lo+1},(_,k)=>`<button class="opt" data-action="jmold" data-k="${esc(w.n)}" data-v="${mold.lo+k}" style="align-items:center"><b>${mold.lo+k}</b></button>`).join('')}</div>`)
       :lost!=null?`<p class="small" style="margin:.4rem 0 0">Lost ${lost} ration${+lost===1?'':'s'} to mold.</p>`:t&&/dam/.test(w.tiers[t-1])?`<p class="small" style="margin:.4rem 0 0">Roll the damage and mark it on your <button class="btn sm ghost" data-action="tab" data-v="sheet">Sheet</button>.</p>`:''}</section>`}).join('')}
let J_AWAY=null;
const jSeenNow=()=>{const j=jPub(),c=jMe();return {cid:c?.id||'',adv:window.Cloud?.state?.adventureId||'',day:j.day,step:j.step,stops:(j.script?.stops||[]).filter(x=>['shown','fight','done'].includes(x.state)&&x.text).map(x=>({id:x.id,t:x.text,k:x.kind})),fx:(j.effects||[]).map(e=>e.name),until:Object.fromEntries((j.effects||[]).map(e=>[e.name,e.until]))}};
function jAwayLines(a,b){if(!a||a.cid!==b.cid||a.adv!==b.adv||b.step==='off')return [];if(a.step==='off')return [`The party set out: day ${b.day}, ${J_STEP[b.step]||b.step}.`];const out=[];
  if(b.day!==a.day)out.push(`Day ${a.day} ended; it is day ${b.day} now (${J_STEP[b.step]||b.step}).`);else if(b.step!==a.step)out.push(`The day moved on: ${J_STEP[a.step]||a.step} → ${J_STEP[b.step]||b.step}.`);
  if(b.day===a.day)for(const s of b.stops)if(!a.stops.some(x=>x.id===s.id))out.push(`${J_KIND[s.k]||'Stop'}: ${s.t}`);
  for(const n of b.fx)if(!a.fx.includes(n)){const u=b.until?.[n];out.push(`${n} (${u===b.day?'until the end of today':u===b.day+1?'until the end of tomorrow':u?'until day '+u:'for now'})`)}return out}
// present: the last render showed this Journey tab in a visible page; changes seen then are not news
let J_PRESENT=false;
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')J_PRESENT=false});
function jAwayBox(){if(S.area!=='crow'||S.tab.crow!=='journey'||S.role==='ref')return '';const now=jSeenNow();
  if(!J_PRESENT){let was=null;try{was=JSON.parse(store.get('jseen')||'null')}catch{}const l=jAwayLines(was,now);
    if(J_AWAY&&J_AWAY.cid!==now.cid)J_AWAY=null;if(l.length)J_AWAY={cid:now.cid,lines:[...(J_AWAY?.lines||[]),...l.filter(x=>!J_AWAY?.lines.includes(x))]}}
  J_PRESENT=document.visibilityState==='visible'&&(S.hx.panel||!myPub()); // the step panel is on screen
  if(J_PRESENT)store.set('jseen',JSON.stringify(now));
  return J_AWAY&&J_AWAY.cid===now.cid?`<section class="hxsec jr-away"><h3 class="hxh">While you were away</h3><ul class="jr-dawn">${J_AWAY.lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul><div class="jr-row" style="margin-top:.4rem"><button class="btn sm" data-action="jaway">Got it</button></div></section>`:''}
Object.assign(A,{jaway:()=>{J_AWAY=null;render()}});
function jEffects(){const fx=S.journey?.effects||[];if(!fx.length||jStep()==='off')return '';
  return `<div class="jr-fx">${fx.map((e,i)=>`<p class="jr-warn"><b>${esc(e.name)}</b> · until day ${e.until}${e.kind==='strong'?': a bane on Mind RRs and on guide, scout and tracker tests':jWxLine(e.name)}${J_COLD.includes(e.name)?` · ${+e.hours||0} hour${+e.hours===1?'':'s'} outside so far`:''}${S.area==='session'?`${J_COLD.includes(e.name)&&e.until-1===S.rtravel.day?` <button class="btn sm" data-action="jhour" data-v="${i}">An hour outside passes</button>${+e.hours>0?` <button class="btn sm ghost" data-action="jhour" data-v="${i}" data-d="-1" aria-label="Take back an hour">−1 hour</button>`:''}`:''} <button class="btn sm ghost" data-action="jendfx" data-v="${i}">End</button>`:''}</p>`).join('')}</div>`}
function jPanel(){const st=jStep(),ref=S.area==='session';
  const body=st==='off'?jOff():st==='plan'?(ref?jPlanRef():jPlanPlayer()):st==='roles'?(ref?jRolesRef():jRolesPlayer())
    :st==='script'?(ref&&S.journey.script?jScriptRef():ref?`<section class="hxsec"><p>No script yet.</p><button class="btn primary" data-action="jprep">Prepare the day →</button></section>`:`<section class="hxsec"><h3 class="hxh">The Ref is preparing the day</h3><p class="muted" style="margin:0">Checks, the path and what waits on it. The road starts in a moment.</p></section><section class="hxsec"><h3 class="hxh">Today</h3>${jKpis(jTotals())}</section>`)
    :st==='road'?(ref&&S.journey.script?jRoadRef():jRoadPlayer())
    :st==='camp'?(ref?jCampRef():jCampPlayer()):st==='night'?(ref?jNightRef():jNightPlayer())
    :ref?jDawnRef():jDawnPlayer();
  return `<div class="jr">${st==='off'?'':jRail()}${ref?'':jAwayBox()}${jMyCrow()}${jEffects()}${body}${st==='roles'&&!ref?jHireTests():''}${st==='plan'&&!ref?jRidePlayer()+jHireRoles()+jHiresPlayer():''}${ref?'':jWxPlayer()}</div>`}
SCREENS.journey=()=>{if(!S.jOpened){S.jOpened=true;S.hx.panel=true}const panel=jPanel(),off=jStep()==='off';
  if(S.area==='session'){if(!off&&hxHere()){if(S.hx.edit)S.hx.edit=false;return SCREENS.rmap(panel)}}
  else if(!off&&myPub())return SCREENS.map(panel);
  return `<div class="box jr-plain">${panel}</div>`};
AFTER.journey=()=>{const rail=$('.jr-rail'),cur=rail?.querySelector('.cur');if(cur&&rail.scrollWidth>rail.clientWidth)rail.scrollLeft=cur.offsetLeft-(rail.clientWidth-cur.offsetWidth)/2;const w=$('#jwhat');if(w&&S.jFocus){w.focus();w.setSelectionRange(w.value.length,w.value.length)}if(!$('.hxstage'))return;(S.area==='session'?AFTER.rmap:AFTER.map)()};

/* ---------- actions ---------- */
// A player's answer: on their own crow, for today; a new day starts from a clean sheet but keeps the route proposal.
function jMine(patch){const c=jMe();if(!c){toast('Open your crow first');return null}const day=jDay(),t=c.trip||{};
  const base=t.day===day?t:{...(t.route?{route:t.route,at:t.at}:{}),day},next={...base,...patch,day,n:(t.day===day?t.n||0:0)+1};
  for(const k of Object.keys(next))if(next[k]===undefined)delete next[k];c.trip=next;return next}
// The Ref's entry for a crow: in the journey (never in a player's crow), for today.
// the Ref's entry for a hireling: the crow's hireling answers with that one changed (a Ref entry for the crow)
const jHireRef=(c,uid,patch)=>{const hs={...(jIn(c).hires||{})};hs[uid]={...(hs[uid]||{}),...patch};jRefSet(c.id,{hires:hs})};
function jRefSet(id,patch){const day=jDay(),cur=S.journey.inputs?.[id],c=PARTY.find(x=>x.id===id),own=c?.trip?.day===day?c.trip:{},n=own.n||0,base=cur&&cur.day===day?{...cur}:{day};
  // an older entry the player has answered over since: the player's newer answers stay theirs, only this entry is the Ref's
  if((base.n||0)!==n)for(const k of Object.keys(own))if(k!=='day'&&k!=='n')delete base[k];
  S.journey.inputs={...(S.journey.inputs||{}),[id]:{...base,...patch,day,n}}}
// Rest encounters (Rules): an encounter interrupts the rest, so the crows rest once the Ref's rest checks are in and every
// hit is dealt with; the Ref's device keeps that in camp.ready (players don't see the checks)
function jCampReady(){const cp=S.journey.camp;if(S.role!=='ref'||jStep()!=='camp'||!cp)return;const sc=S.journey.script,open=!!sc&&sc.stops.some(x=>x.kind==='rest'&&['pending','shown','fight'].includes(x.state));
  const ready=!jRestAt().check||(S.rtravel.restChecks||[]).length>0&&!open;if(cp.ready!==ready)S.journey={...S.journey,camp:{...cp,ready}}}
const jDone=()=>{jCampReady();jSave();render()};
// a spent Effort comes back when the result it raised is changed
const jRefund=(c,x)=>{if(x.effort&&c.trip?.effort){c.effort=Math.min(effMax(c),(c.effort||0)+1)}};
function jCampStart(place,k=null,poi=''){if(S.rtravel)S.rtravel.hmind={};S.journey={...S.journey,camp:{place,k,poi,closed:null,restart:0,base:Object.fromEntries(PARTY.map(c=>[c.id,c.rests||0]))}};S.rtravel.camp=J_RCAMP[place]||null;S.rtravel.restChecks=[]}
const jArrive=()=>{const sc=S.journey.script;if(!sc)return;if(sc.stops.some(x=>x.i===sc.at&&x.kind!=='enc'&&x.state==='pending'))jScriptSet(x=>{for(const st of x.stops)if(st.i===x.at&&st.kind!=='enc'&&st.state==='pending')st.state='shown'})};
const jClean=s=>String(s||'').replace(/\u0000/g,'').replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g,'').slice(0,200);
Object.assign(A,{
  jstart:()=>{setPhase('travel');S.journey={...S.journey,step:'plan',day:S.rtravel.day,from:S.here||'',plan:null,inputs:{},script:null,camp:null};S.here='';jDone()},
  jcancel:()=>{const v=VILLAGES.find(x=>x.id===S.journey.from);askYes('Cancel the departure?',`The party stays${v?' in '+v.name:''}. The players’ answers for today stay on their crows.`,'Cancel the departure',
    ()=>{S.here=S.journey.from||S.here;S.journey={...S.journey,step:'off',plan:null,inputs:{},script:null,camp:null};setPhase('village');jDone()})},
  jseason:b=>{S.journey.season=S.journey.season===b.dataset.v?null:b.dataset.v;jDone()},
  jlock:()=>{const xs=PARTY.map(c=>jIn(c)),route=hxHere()?[...HX.route]:[];
    S.journey={...S.journey,day:S.rtravel.day,step:'roles',plan:{route,pace:S.rtravel.pace,by:hxHere()?(HX.routeBy||''):'',nights:[...new Set(xs.flatMap(x=>x.nights||[]))].filter(k=>route.includes(k)),locked:true}};jDone()},
  jstay:()=>{const k=hxHere()&&HX.party||'0,0',home=!S.rtravel.moved&&VILLAGES.find(v=>v.id===S.journey.from),p=hxHere()&&!S.rtravel.lost&&HX.party?jPoiAt(HX.party):null,vp=p&&jPoiKind(p)==='village'?p:null;
    S.journey={...S.journey,day:S.rtravel.day,step:'camp',plan:{route:[],pace:S.rtravel.pace,by:'',nights:[],locked:true},script:{path:[k],at:0,lost:!!S.rtravel.lost,stops:[]}};
    if(home||vp)jCampStart(home&&home.home?'home':'village',hxHere()&&!S.rtravel.lost?k:null,home?home.name:vp.label||'');else jCampStart('outdoor');jDone()},
  jbackplan:()=>{S.journey={...S.journey,step:'plan',plan:S.journey.plan?{...S.journey.plan,locked:false}:null};jDone()},
  jprep:()=>{const go=()=>{const lost=!!S.rtravel.lost,route=Object.fromEntries(JRS.ROUTE_KEYS.filter(k=>S.rtravel.mods?.[k]).map(k=>[k,true]));
      const over=new Set(jOver()),wx=Object.fromEntries((S.journey.effects||[]).filter(e=>e.kind==='weather'&&JRS.WEATHER_FX[e.name]).map(e=>[JRS.WEATHER_FX[e.name],true]));S.rtravel.mods={...route,...wx,...JRS.modsFromInputs(jModsIn(),{lost})};if(S.journey.plan?.pace)S.rtravel.pace=S.journey.plan.pace;S.journey={...S.journey,step:'script',script:jScript()};jDayLog();if(typeof hxPublish==='function')hxPublish();jDone()};
    const miss=jAllIn().filter(a=>jWaiting(a.x));if(!miss.length)return go();
    const plain=x=>x.role==='assist'?'Assist':JRS.TASK_NAMES[x.task]||x.role;
    askYes(`${miss.length} test${miss.length>1?'s':''} without a tier`,`${miss.map(a=>`${jWho(a.id).replace(/<[^>]*>/g,'')} (${plain(a.x)})`).join(', ')}: leave ${miss.length>1?'them':'it'} out and prepare the day? Or enter the tier first.`,'Leave out and go on',
      ()=>{for(const a of miss){if(a.h)jHireRef(a.c,a.h.uid,{role:'none',task:'',tier:0});else jRefSet(a.c.id,{role:'none',task:'',tier:0,targets:[]})}go()})},
  jgo:b=>{S.journey={...S.journey,step:b.dataset.v};jDone()},
  // Script
  jsmove:b=>{const T=S.journey.script.path.length-1;jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(!st)return;st.i=Math.max(0,Math.min(T,st.i+ +b.dataset.v));if(hxHere()&&!sc.lost)st.k=sc.path[st.i];else delete st.k;
    const c=jChecks()[st.check];if(st.kind==='enc'&&c){jSub(c,sc.path[st.i]);if(c.sub)st.table=c.sub}});jDone()},
  jsremove:b=>{jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st)st.state='removed'});jDone()},
  jsreroll:b=>{const T=rtDay();jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(!st||st.kind!=='enc')return;const c=jSub(encChecks(1,T.en)[0],sc.path[st.i]);S.rtravel.checks[st.check]=c;
      if(c.hit){st.text=c.text||'';if(c.sub)st.table=c.sub;else delete st.table;st.state='pending'}else st.state='removed'});jDayLog();toast(S.rtravel.checks.some(c=>c.hit)?'Rerolled':'Rerolled — quiet now');jDone()},
  jsadd:()=>{const T=rtDay(),c=encChecks(1,T.en)[0];S.rtravel.checks=[...jChecks(),c];const n=S.rtravel.checks.length-1;
    if(c.hit)jScriptSet(sc=>{const i=jPlace(sc.path.length);jSub(c,sc.path[i]);const st=jEncStop(c,n,i);if(hxHere()&&!sc.lost)st.k=sc.path[st.i];sc.stops.push(st)});jDayLog();toast(c.hit?`Encounter: ${c.text}`:'Quiet');jDone()},
  jgoroad:()=>{S.journey={...S.journey,step:'road'};jArrive();jDone()},
  // Road
  jstep:()=>{const sc=S.journey.script,k=sc.path[sc.at+1];if(!k)return;if(hxHere()&&HX.party){if(!sc.lost&&HX.route[0]===k)HX.route.shift();hxMove(k,true)}else S.rtravel.moved=(S.rtravel.moved||0)+1;
    jScriptSet(x=>{x.at++});jArrive();jDone()},
  jreveal:b=>{let shown;jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st){st.state='shown';shown=JSON.parse(JSON.stringify(st))}});
    if(shown){const c=(shown.kind==='rest'?S.rtravel.restChecks:jChecks())[shown.check],day=S.rtravel.day,fx=S.journey.effects||[];
      if(c?.text==='Strong Miasma'&&!fx.some(e=>e.kind==='strong'))S.journey={...S.journey,effects:[...fx,{kind:'strong',name:'Strong Miasma',until:day+1}]};
      if(c?.text==='Bad Weather'){const k=S.journey.script.path[shown.i],place=hxHere()&&k&&HX.t[k]?JRS.placeOf(HX.t[k]):null,group=JRS.weatherGroup(place?.climate||'temperate',S.journey.season),
        rows=(BOOK['ref-bad-weather']?.body||[]).find(x=>x.tb)?.tb?.slice(1),die=d(6),w=group?JRS.weatherFor(rows,group,die):null;
        S.journey={...S.journey,effects:[...(S.journey.effects||[]),{kind:'weather',name:w||'Bad Weather',until:day+1}]};
        jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===shown.id);st.text=w?`Bad Weather: ${w}`:'Bad Weather — pick it by climate or season';});
        toast(w?`Bad Weather: ${w} (d6 ${die}, ${group})`:'Bad Weather: set the season (Plan) or pick the weather')}}
    jDone()},
  jexhaust:()=>{const c=jMe();if(!c)return;ME=c;S.jExhausted=`${c.id}:${S.journey.day}`;S.pendingWounds+=1;S.pendingWoundType='exhaustion';S.tab.crow='inventory';render()},
  jendfx:b=>{S.journey={...S.journey,effects:(S.journey.effects||[]).filter((e,i)=>i!==+b.dataset.v)};jDone()},
  jfollow:b=>{const st=S.journey.script.stops.find(x=>x.id===b.dataset.k),c=st&&(st.kind==='rest'?S.rtravel.restChecks:jChecks())[st.check];if(!c?.sub)return;const x=rollTable(c.sub),txt=String(x.row[1]).replace(/<[^>]*>/g,''),next=Object.values(TB).find(t=>t.id!==c.sub&&(t.title===txt||t.title===txt.replace(' Dungeon ',' ')));
    if(next){c.via=[...(c.via||[]),txt];c.sub=next.id}else{c.src=x.row[1];c.html=encounterText(x.row[1])}
    jScriptSet(sc=>{const s2=sc.stops.find(y=>y.id===st.id);s2.text=`${c.text}: ${[...(c.via||[]),...(next?[]:[txt])].join(' → ')}`.slice(0,1000)});jDone()},
  jfight:b=>{jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st)st.state='fight'});toast('Fight: the Combat tab tracks the monsters');jDone()},
  jresolve:b=>{const fought=S.journey.script.stops.find(x=>x.id===b.dataset.k)?.state==='fight';jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st)st.state='done'});jDayLog();jDone();
    if(fought&&S.combat.length)askYes('Clear the combat tracker?',`${S.combat.length} monster${S.combat.length>1?'s are':' is'} still on it.`,'Clear it',()=>{S.combat=[];render()},true)},
  jstopon:b=>{jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st)st.state='done'});jDone()},
  jstoprest:b=>{jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st)st.state='done'});S.journey={...S.journey,step:'camp'};jCampStart('village',hxHere()?S.journey.script.path[S.journey.script.at]:null,S.journey.script.stops.find(x=>x.id===b.dataset.k)?.text||'');jDone()},
  jexplore:b=>{jWalkStop();jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st)st.state='done'});S.journey={...S.journey,camp:{place:'dungeon',k:null,poi:'',closed:null,restart:0,base:Object.fromEntries(PARTY.map(c=>[c.id,c.rests||0]))}};setPhase('delve');S.tab.session='session';toast('Into the dungeon. The delve is a day of its own: when you leave, the party camps by it.');jDone()},
  jstophere:()=>{const sc=S.journey.script,n=sc.path.length-1-sc.at;askYes('Stop here for the night?',`${n} hex${n>1?'es':''} of today’s path ${n>1?'are':'is'} left.`,'Make camp',()=>A.jcamp())},
  jbackroad:()=>{S.journey={...S.journey,step:'road',camp:null};S.rtravel.camp=null;S.rtravel.restChecks=[];if(S.journey.script)jScriptSet(x=>{for(const y of x.stops)if(y.kind==='rest')y.state='removed'});jDone()},
  jcamp:()=>{const sc=S.journey.script,k=sc?.path[sc.at],p=k&&jPoiAt(k);S.journey={...S.journey,step:'camp'};jCampStart(p&&jPoiKind(p)==='village'?'village':rtDay().ruin?'ruin':'outdoor',hxHere()&&!sc?.lost?k||null:null,p?(p.label||''):'');jDone()},
  // Camp
  jplace:b=>{const cp=S.journey.camp||{};S.journey={...S.journey,camp:{...cp,place:b.dataset.v,closed:b.dataset.v==='dungeon'?cp.closed??null:null}};S.rtravel.camp=J_RCAMP[b.dataset.v]||null;jDone()},
  jclosed:b=>{S.journey={...S.journey,camp:{...S.journey.camp,closed:b.dataset.v==='yes'}};jDone()},
  jrestcheck:()=>{const sec=jSeclude();if(sec)S.rtravel.mods={...S.rtravel.mods,seclude:true};else if(S.rtravel.mods?.seclude){const m={...S.rtravel.mods};delete m.seclude;S.rtravel.mods=m}
    A.rrest();const sc0=S.journey.script;(S.rtravel.restChecks||[]).forEach(c=>jSub(c,sc0?.path[sc0.at]||HX?.party));const sc=S.journey.script;if(sc)jScriptSet(x=>{x.stops=x.stops.filter(y=>y.kind!=='rest');(S.rtravel.restChecks||[]).forEach((c,n)=>{if(c.hit)x.stops.push({id:'r'+n,i:x.at,kind:'rest',state:'pending',check:n,text:c.text||'',...(c.sub?{table:c.sub}:{}),...(hxHere()&&!x.lost?{k:x.path[x.at]}:{})})})});jDayLog();jDone()},
  jrestart:()=>{const cp=S.journey.camp;S.rtravel.hmind={};S.journey={...S.journey,camp:{...cp,restart:(cp.restart||0)+1,base:Object.fromEntries(PARTY.map(c=>[c.id,c.rests||0]))}};S.rtravel.restChecks=[];
    if(S.journey.script)jScriptSet(x=>{for(const y of x.stops)if(y.kind==='rest'&&y.state!=='done')y.state='removed'});const done=PARTY.filter(jRested);toast(`The rest starts again: new checks, everyone rests again${done.length?`. ${done.map(c=>c.name).join(', ')} had finished: an interrupted rest gives nothing, so take back what it gave`:''}`);jDone()},
  jfinishcamp:()=>{const go=()=>{for(const c of PARTY)if(jRested(c)&&c.lastRest!=='miasma')for(const h of c.hires||[]){h.cruelty=0;h.miasma=(h.miasma||[]).filter(n=>!['cruelty','out'].includes((MI_ROWS().find(r=>r.n===n)||{}).dur))};S.journey={...S.journey,step:PARTY.some(jNeedsMind)?'night':'dawn'};jDone()},miss=PARTY.filter(c=>!jRested(c));
    if(!miss.length)return go();askYes(`${miss.length} crow${miss.length>1?'s haven’t':' hasn’t'} finished the rest`,`${miss.map(c=>c.name).join(', ')}: go on without ${miss.length>1?'their rests':'that rest'}? At dawn the app reminds them of the exhaustion wound.`,'Go on',go,true)},
  jact:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;jMine({act:x.act===b.dataset.v&&x.day===jDay()?'':b.dataset.v,pick:''});jDone()},
  jfood:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const v=x.food===b.dataset.v?'':b.dataset.v;if(v==='inn'&&!c.innFood&&coinsOf(c)<5)return toast('You need 5 gc for the inn');jMine({food:v});jDone()},
  // the player finishes the rest on the Rest tab, filled in from the camp and their answers (the rest itself is rfinish)
  jrest:()=>{const c=jMe(),x=c&&jIn(c),cp=S.journey.camp||{};if(!x)return;if(jRestAt().check&&cp.ready!==true)return toast('Wait for the Ref’s rest checks');if(x.food==='inn'&&!c.innFood){if(coinsOf(c)<5)return toast('You need 5 gc for the inn');payCoins(c,5);c.innFood=true;toast('A bed and a day’s food at the inn: 5 gc')} // the inn is paid as the rest begins
    ME=c;S.rest.home=x.food==='home'&&cp.place==='home';S.rest.where=jRestAt().where;S.rest.act=x.act&&x.act!=='gamble'?x.act:null;S.rest.pick=null;S.rest.ration=x.food!=='none';S.rest.log=null;
    if(x.act==='gamble')toast('Gamble at the inn on the Village tab (Services)');S.tab.crow='rest';render();scrollTo(0,0)},
  // Night
  jmind:b=>{const t=+b.dataset.v;jMine({mind:t,d10:0});jDone()},
  jmd10:b=>{const c=jMe();if(!c)return;const r=+b.dataset.v,rows=MI_ROWS(),h=JRS.miasmaHit(c,rows,r);
    if(h.again)return toast(`You already have ${h.hit.n} — roll the d10 again`);
    const o=JRS.miasmaRoll(c,rows,()=>r,c.rests||0);c.cruelty=o.cruelty;c.miasma=o.miasma;c.miLast=o.miLast;jMine({mind:1,d10:r});jDone()},
  jmclear:()=>{const c=jMe();if(!c)return;miClear(c);jMine({mind:3});jDone()},
  jmundo:()=>{const c=jMe();if(!c)return;miUndo(c);jMine({mind:0,d10:0});jDone()},
  jrmind2:b=>{jRefSet(b.dataset.k,{mind:2});jDone()},
  jwalk:()=>{jWalkStop();J_WALKING=true;jWalkTick()},
  jskip:()=>{jWalkStop();for(let n=0;n<200&&!jWalkDone();n++)A.jstep();jDone()},
  jride:b=>{const c=jMe();if(!c)return;jMine({ride:b.dataset.v||''});jDone()},
  jcart:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const r=String(x.ride||''),cur=r.startsWith('v:')?r.slice(2).split(',').filter(Boolean):[],u=b.dataset.v,next=cur.includes(u)?cur.filter(v=>v!==u):[...cur,u];jMine({ride:next.length?'v:'+next.join(','):''});jDone()},
  jhrole:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const [role,task]=String(b.value||'').split(':'),hs={...(x.hires||{})},ride=hs[b.dataset.k]?.ride;if(role)hs[b.dataset.k]={role,task,tier:0,...(ride?{ride}:{})};else if(ride)hs[b.dataset.k]={ride};else delete hs[b.dataset.k];jMine({hires:hs});jDone()},
  jhride:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const hs={...(x.hires||{})},u=b.dataset.k,cur={...(hs[u]||{})};if(b.value)cur.ride=b.value;else delete cur.ride;if(Object.keys(cur).length)hs[u]=cur;else delete hs[u];jMine({hires:hs});jDone()},
  jrhtier:b=>{const c=PARTY.find(x=>x.id===b.dataset.k);if(!c)return;const u=b.dataset.u,cur=jIn(c).hires?.[u];if(!cur)return;jHireRef(c,u,{tier:cur.tier===+b.dataset.v?0:+b.dataset.v});jDone()},
  jrhout:b=>{const c=PARTY.find(x=>x.id===b.dataset.k);if(!c)return;jHireRef(c,b.dataset.u,{role:'none',task:'',tier:0});jDone()},
  jhtier:b=>{const c=jMe(),x=c&&jIn(c),u=b.dataset.k;if(!x?.hires?.[u])return;const t=+b.dataset.v;jMine({hires:{...x.hires,[u]:{...x.hires[u],tier:x.hires[u].tier===t?0:t}}});jDone()},
  jhour:b=>{const i=+b.dataset.v,dn=+(b.dataset.d||1);S.journey={...S.journey,effects:(S.journey.effects||[]).map((e,k)=>k===i?{...e,hours:Math.max(0,(+e.hours||0)+dn)}:e)};if(dn>0)toast('An hour outside: players in the cold make their Strength RR');jDone()},
  jmerchant:b=>{const real=()=>{for(let i=0;i<50;i++){const r=rollTable('merchant-sales');if(J_ORD.indexOf(r.row[2])>0)return r}return null};
    // 99-100: roll until two different institutions in a row; the merchant is both (The Ref: Merchant)
    let x=rollTable('merchant-sales'),y=null;if(J_ORD.indexOf(x.row[2])<1){x=real();for(let i=0;i<50&&x;i++){y=real();if(y&&y.row[1]!==x.row[1])break;x=y;y=null}}if(!x)return toast('No merchant rolled');
    const name=x.row[1],lvl=J_ORD.indexOf(x.row[2]),pct=d(10)*10,npc=(TB['merchant-npc']?.rows.find(r=>r[0]===name)||[])[1]||name,guards={},key=n=>Object.keys(INST).find(k=>INST[k].n===n);
    for(const c of PARTY){const g=d(6);for(let i=0;i<g;i++){const n=rollTable('merchant-guards').row[1];guards[n]=(guards[n]||0)+1}}
    const inst=key(name)||'store',two=y?{inst2:key(y.row[1])||'store',name2:y.row[1],lvl2:J_ORD.indexOf(y.row[2])}:{};
    jScriptSet(sc=>{const st=sc.stops.find(z=>z.id===b.dataset.k);if(!st)return;st.scene={kind:'merchant',inst,name,lvl,pct,npc,guards,...two};st.text=`Merchant: ${name} (${x.row[2]} level)${y?` and ${y.row[1]} (${y.row[2]})`:''}, buys at ${pct}%`});jDone()},
  jtravel:b=>{const n=d(10),who={};for(let i=0;i<n;i++){const s=rollTable('travelers').row[1];who[s]=(who[s]||0)+1}const react=String(rollTable('traveler-encounters').row[1]);
    jScriptSet(sc=>{const st=sc.stops.find(y=>y.id===b.dataset.k);if(!st)return;st.scene={kind:'traveler',n,who,react};st.text=`Traveler: ${n} human${n>1?'s':''} — ${react.split(':')[0]}`});jDone()},
  jtreward:b=>{const r=jRollText(rollTable('traveler-rewards').row[1]).replace(/^(\d+) \((\d+d\d+)\) × ([\d,]+) gc/,(m,n,dd,k)=>`${(+n*+k.replace(/,/g,'')).toLocaleString('en')} gc (${dd} × ${k})`);jScriptSet(sc=>{const st=sc.stops.find(y=>y.id===b.dataset.k);if(st?.scene)st.scene={...st.scene,reward:r}});jDone()},
  jbuy:b=>{const c=jMe(),it=IT[document.getElementById('jbuy-'+b.dataset.k)?.value];if(!c||!it)return;if(window.Cloud?.isActive()&&S.role!=='ref')return toast('The Ref adds what you buy on this table');if(coinsOf(c)<it.price)return toast(`You need ${it.price} gc`);ME=c;S.placing={id:it.id,count:1,buy:it.price};S.tab.crow='inventory';render()},
  jsell:b=>{const c=jMe(),st=S.journey.script?.stops.find(y=>y.id===b.dataset.k)||jPub().script?.stops.find(y=>y.id===b.dataset.k),sc=st?.scene,i=c?.inv.find(x=>x.uid===+document.getElementById('jsell-'+b.dataset.k)?.value);if(!c||!sc||!i)return;
    if(isPurse(i)||i.id==='gold-coins')return;const it=shown(i),p=Math.floor((i.val??it.price)*sc.pct/100);
    // on a server table a player can't put coins in the loot pool: the purse must hold them
    if(window.Cloud?.isActive()&&S.role!=='ref'&&purses(c).reduce((a,x)=>a+purseMax(x)-(x.coins||0),0)<p)return toast(`Your purse has no room for ${p} gc`);if((i.count||1)<=1)c.inv=c.inv.filter(x=>x!==i);else i.count-=1;const left=addCoins(c,p);
    if(left>0){S.pool.push({uid:UID++,id:'gold-coins',count:left,from:c.name});toast(`Sold for ${p} gc — ${left} gc didn’t fit in the purse and wait in the loot pool`)}else toast(`Sold ${nm(i)} for ${p} gc`);jDone()},
  jhpay:b=>{const c=jMe(),h=c?.hires?.[+b.dataset.k];if(!h||jHirePaid(h))return;const pay=hirePay(h),r=jRations(c)[0];if(coinsOf(c)<pay)return toast(`You need ${pay} gc`);if(!r)return toast('You need a ration for them');
    payCoins(c,pay);addCount(r,-1);c.inv=c.inv.filter(i=>!(J_RATIONS.includes(i.id)&&i.count<=0));h.days=(h.days||0)+1;h.paid=jDay();toast(`${h.name} paid for the day`);jDone()},
  jhleave:b=>{const cid=b.dataset.c,uid=+b.dataset.k,c0=PARTY.find(x=>x.id===cid),h0=c0?.hires?.find(x=>x.uid===uid);if(!h0)return;
    askYes(`${h0.name} leaves ${c0.name}’s service?`,'Not paid today. The cards they carry come back if there’s room, otherwise to the loot pool.','Leaves',()=>{const c=PARTY.find(x=>x.id===cid),k=c?.hires?.findIndex(x=>x.uid===uid)??-1;if(k<0)return;const h=c.hires[k];for(const i of [...(h.inv||[])])petBack(c,h,i);c.hires.splice(k,1);jDone()})},
  jhmind:b=>{const c=PARTY.find(x=>x.id===b.dataset.c),h=c?.hires?.[+b.dataset.k];if(!h)return;const M=parseInt(MON[h.mon]?.st.Mind)||0,strong=(S.journey.effects||[]).some(e=>e.kind==='strong'&&e.until>=S.rtravel.day);
    const r1=d(10),r2=d(10),tot=r1+r2+M-(h.cruelty||0)-(strong?2:0),tier=r1+r2<=3?1:tierOfTotal(tot);let n='';
    if(tier===1){h.cruelty=(h.cruelty||0)+1;const rows=MI_ROWS();for(let i=0;i<20;i++){const v=d(10)+h.cruelty,hit=rows.find(x=>v>=x.lo&&v<=x.hi);if(!hit)break;if(hit.lo<13&&(h.miasma||[]).includes(hit.n))continue;n=hit.n;h.miasma=[...(h.miasma||[]),hit.n];break}}
    if(tier===3){h.cruelty=0;h.miasma=(h.miasma||[]).filter(n=>(MI_ROWS().find(r=>r.n===n)||{}).dur!=='cruelty')}S.rtravel.hmind={...(S.rtravel.hmind||{}),[h.uid]:{tier,n}};toast(`${h.name}: 2d10 ${r1+r2} + M ${M} − cruelty → ${tot}: tier ${tier}${n?' — '+n:''}`);jDone()},
  jcarry:b=>{const fi=jCarryFx();if(fi<0)return;const ang=+b.dataset.v,n=d(10),sc=S.journey.script;let k=HX.party,moved=0;
    for(let i=0;i<n;i++){const nx=nbs(HX,k).find(x=>Math.abs(((x.ang-ang)%360+540)%360-180)<1);if(!nx||!HX.t[nx.k]||!hxPass(HX,nx.k,true))break;k=nx.k;moved++} // stops before water or the map's edge
    S.journey={...S.journey,effects:S.journey.effects.map((e,i)=>i===fi?{...e,carried:true}:e)};
    if(sc&&!sc.lost)jScriptSet(x=>{x.lost=true;for(const st of x.stops)delete st.k}); // got lost during the day: from here players see no path
    if(moved){HX.party=k;HX.lostTrail.push(k);HX.route=[];S.hx.follow=k;
      // the day's lost walk goes on from where the Miasma left them; stops keep their places on the path
      if(sc)jScriptSet(x=>{const rest=x.path.length-1-x.at;x.path=[...x.path.slice(0,x.at),k,...jLostWalk(k,rest)];for(const st of x.stops)if(st.i>=x.path.length)st.i=x.path.length-1;for(const st of x.stops)if(st.k!==undefined)st.k=x.path[st.i]});saveHX()}
    toast(`d10 ${n}: carried ${moved} hex${moved===1?'':'es'}${moved<n?' (stopped at water or the map’s edge)':''}`);jDone()},
  jwx:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const n=b.dataset.k,t=+b.dataset.v,got=jWxGot(x,n);if(J_COLD.includes(n)){const ts=String(got||'').split(',').filter(Boolean),hrs=+(S.journey.effects||[]).find(e=>e.name===n)?.hours||0;if(hrs>0&&ts.length>=hrs)return toast('Wait for the Ref’s next hour');jMine({wx:jWxSet(x,n,[...ts,t].join(','))});return jDone()}
    if(String(got).includes('/'))return toast('Already done for today');jMine({wx:jWxSet(x,n,+got===t?'':String(t))});jDone()},
  jwxundo:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const n=b.dataset.k;jMine({wx:jWxSet(x,n,String(jWxGot(x,n)||'').split(',').filter(Boolean).slice(0,-1).join(','))});jDone()},
  jmold:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const n=b.dataset.k,got=jWxGot(x,n);if(!got||got.includes('/'))return;let k=+b.dataset.v,lost=0;
    for(const r of jRations(c)){if(!k)break;const m=Math.min(k,r.count);addCount(r,-m);k-=m;lost+=m}c.inv=c.inv.filter(i=>!(J_RATIONS.includes(i.id)&&i.count<=0));jMine({wx:jWxSet(x,n,`${got}/${lost}`)});toast(`${lost} ration${lost===1?'':'s'} lost to mold`);jDone()},
  jmlift:b=>{const c=jMe();if(!c)return;jMine({mind:3,lift:b.dataset.k||''});jDone()},
  // the lifted crow's own device applies it (players write only their crow); the Ref's device can apply it for them
  jmlifted:()=>{const c=jMe();if(!c||!jLiftBy(c)||jIn(c).lifted||!jLiftValid(c))return;if(miDone(c)&&c.miLast.k==='fx'){miUndo(c);jMine({mind:2,d10:0,lifted:true})}else jMine({mind:3,lifted:true});jDone()},
  jrclear:b=>{const c=PARTY.find(x=>x.id===b.dataset.k);if(!c)return;miClear(c);jRefSet(c.id,{mind:3});jDone()},
  jrlift:b=>{const c=PARTY.find(x=>x.id===b.dataset.k);if(!c||!jLiftBy(c)||jIn(c).lifted||!jLiftValid(c))return;if(miDone(c)&&c.miLast.k==='fx'){miUndo(c);jRefSet(c.id,{mind:2,d10:0,lifted:true})}else jRefSet(c.id,{mind:3,lifted:true});jDone()},
  jgodawn:()=>{const miss=[...PARTY.filter(c=>jNeedsMind(c)&&(!jMindDone(c)||jLiftPending(c))),...jHireNight().filter(a=>!S.rtravel.hmind?.[a.h.uid]).map(a=>a.h)],go=()=>{S.journey={...S.journey,step:'dawn'};jDone()};
    if(!miss.length)return go();askYes(`${miss.length} Mind RR${miss.length>1?'s':''} missing`,`${miss.map(c=>c.name).join(', ')}: the Mind RR after a rest in the Miasma is not optional. Enter it, or go on and settle it at the table.`,'Go on anyway',go)},
  jstayvillage:()=>{const cp=S.journey.camp||{},v=(!S.rtravel.moved&&VILLAGES.find(x=>x.id===S.journey.from))||VILLAGES.find(x=>cp.poi&&x.name===cp.poi);
    A.rnextday();S.journey={...S.journey,step:'off',plan:null,inputs:{},script:null,camp:null,from:''};if(v)S.here=v.id;setPhase('village');jDone()},
  // players' votes at a stop
  jvote:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const k=b.dataset.k;jMine({[k]:x[k]===b.dataset.v?'':b.dataset.v});jDone()},
  jdawn:()=>{A.rnextday();jDone()},
  jrtier:b=>{const c=PARTY.find(x=>x.id===b.dataset.k),x=c&&jIn(c);if(!x)return;jRefSet(c.id,{role:x.role,task:x.task||'',targets:x.targets||[],tier:+b.dataset.v,doom:false});jDone()},
  jrout:b=>{jRefSet(b.dataset.k,{role:'none',task:'',tier:0,targets:[]});jDone()},
  // players
  jpace:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;jMine({pace:x.pace===b.dataset.v?'':b.dataset.v});jDone()},
  jrole:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;jRefund(c,x);const r=x.role===b.dataset.v?'':b.dataset.v;jMine({role:r,task:'',targets:[],tier:0,doom:false,effort:false,what:''});jDone()},
  jtask:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;jRefund(c,x);jMine({task:x.task===b.dataset.v?'':b.dataset.v,targets:[],tier:0,doom:false,effort:false,what:''});jDone()},
  jtarget:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const id=b.dataset.k,max=x.role==='assist'||x.task==='fight'?1:3,cur=x.targets||[];
    const next=cur.includes(id)?cur.filter(t=>t!==id):max===1?[id]:[...cur,id].slice(-max);jMine({targets:next});jDone()},
  jnight:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const k=b.dataset.k,n=x.nights||[];jMine({nights:n.includes(k)?n.filter(h=>h!==k):[...n,k]});jDone()},
  jtier:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const t=+b.dataset.v;jRefund(c,x);jMine({tier:x.tier===t?0:t,doom:false,effort:false});jDone()},
  jdoom:()=>{const c=jMe(),x=c&&jIn(c);if(!x)return;jMine({doom:!x.doom});jDone()},
  // Effort (Rules): with a fitting expertise, 1 Effort raises a result that is not a doom by one tier
  jspend:()=>{const c=jMe(),x=c&&jIn(c);if(!x||!x.tier||x.tier>=3||x.doom||x.effort||!(c.effort>0))return;c.effort--;jMine({tier:x.tier+1,effort:true});toast(`Effort ${c.effort} left · tier ${x.tier+1}`);jDone()}});
document.addEventListener('change',e=>{if(e.target.id==='jwhat'){S.jDraft=null;S.jFocus=false;jMine({what:jClean(e.target.value)});jDone()}else if(e.target.dataset?.action==='jdoom')A.jdoom()});
// a draft stays on this device while typed (a change from the table re-renders the panel)
document.addEventListener('input',e=>{if(e.target.id==='jwhat'){S.jDraft=e.target.value;S.jFocus=true}});
document.addEventListener('focusout',e=>{if(e.target.id==='jwhat')S.jFocus=false});
// Dawn on the Travel day tab also moves the journey to the next day.
const jOnScript=()=>['script','road'].includes(jStep())&&!!S.journey.script;
for(const k of ['hxgo','hxstep']){const f=A[k];A[k]=b=>jOnScript()?toast('Today the party walks the day’s script: Next hex on the Journey panel'):f(b)}
{const f=A.hxput;A.hxput=b=>{const on=jOnScript();const out=f(b);if(on&&HX?.party===b.dataset.k)jScriptSet(sc=>{sc.path=[...sc.path.slice(0,sc.at),HX.party];
  for(const st of sc.stops)if(st.i>sc.at){st.i=sc.at;if(st.k!==undefined)st.k=HX.party}});if(on)render();return out}}
{const f=A.rnextday;A.rnextday=b=>{for(const c of PARTY)for(const p of c.pets||[])if(p.prayer>0)p.prayer-=1; // Mount's Prayer: a number of days
  const on=jStep()!=='off',fight=on?PARTY.filter(c=>jFightBonus(c)&&!(jNeedsMind(c)&&jMindDone(c))).map(c=>c.id):S.journey.fight;
  const out=f(b);if(on){S.journey={...S.journey,step:'plan',day:S.rtravel.day,from:'',plan:S.journey.plan?{...S.journey.plan,locked:false}:null,inputs:{},script:null,camp:null,
  effects:(S.journey.effects||[]).filter(e=>e.until>=S.rtravel.day),...(fight&&fight.length||S.journey.fight?{fight:fight||[]}:{})};render()}return out}} // the old Travel day tab's Start day too: drawn and saved

{const base=SCREENS.session;SCREENS.session=()=>{const sc=S.journey?.script,st=sc&&sc.stops.find(x=>x.i===sc.at&&x.kind==='poi');
  if(S.phase==='travel')return `<div class="cols"><div class="stack"><div class="box"><h2 class="sec-h">Combat <span class="muted">on the road · add monsters from the encounter or Look up → Monsters</span></h2>${combatHTML()}</div>
    <div class="row"><button class="btn" data-action="tab" data-v="journey">← Journey</button></div></div>
    <div class="stack"><div class="box"><h2 class="sec-h">Party</h2>${PARTY.map(partyTile).join('')}</div>${poolHTML(true)}</div></div>`;
  const back=S.phase==='delve'&&jStep()==='road'?`<div class="banner"><span class="msg"><b>Exploring${st?.text?' '+esc(st.text):''}</b> from the road. The delve is a day of its own: when the party leaves, day ${S.rtravel.day+1} ends with a camp here.</span><button class="btn sm primary jr-go" data-action="jleave">Leave${st?.text?' '+esc(st.text):''} → camp</button></div>`:'';return back+base()}}
// Leaving: the delve took a day of its own, however many Dungeon turns (owner's ruling, 2026-11-11): the day moves on and the party
// rests by the place (Camp → Night → Dawn as on the road)
Object.assign(A,{jleave:()=>{const sc=S.journey.script,k=sc?sc.path[sc.at]:null,p=k&&hxHere()?jPoiAt(k):null,base=S.journey.camp?.base,so=window.syncOut;setPhase('travel');window.syncOut=()=>{};try{A.rnextday()}finally{window.syncOut=so}
  S.journey={...S.journey,step:'camp',script:{path:[k||(hxHere()&&HX.party)||'0,0'],at:0,lost:!!S.rtravel.lost,stops:[]}};jCampStart('outdoor',hxHere()&&!S.rtravel.lost?k:null,p?.label||'');if(base)S.journey={...S.journey,camp:{...S.journey.camp,base}};S.tab.session='journey';jDone()}});

/* ---------- signals outside the tab ---------- */
// What the journey wants from this player now (for the "next" banner and the dot on the tab).
function jWants(){if(S.area!=='crow'||S.phase!=='travel')return null;const c=jMe();if(!c)return null;const x=jIn(c),st=jStep();
  if(st==='roles'&&jWaiting(x))return '<b>Your test is waiting.</b> Roll it at the table and tap your tier.';
  if(st==='plan'&&!x.role)return '<b>Plan the day:</b> vote on the pace and choose your role.';
  if(st==='plan'&&(c.hires||[]).some(h=>!jHirePaid(h)))return '<b>Pay your hirelings</b> for today, or they leave.';
  if(st==='roles'&&jHireIn(c).some(a=>jWaiting(a.x)))return '<b>Your hireling’s test is waiting.</b> Roll it and tap the tier.';
  {const cold=(S.journey.effects||[]).find(e=>J_COLD.includes(e.name)&&e.until-1===jDay()&&(e.hours||0)>String(jWxGot(x,e.name)||'').split(',').filter(Boolean).length&&!c.inv.some(i=>i.id==='cold-weather-gear'));if(cold&&['road','camp'].includes(st))return `<b>${esc(cold.name)}:</b> another hour outside — your Strength RR.`}
  const live=(jPub().script?.stops||[]).find(y=>['shown','fight'].includes(y.state)&&(y.kind==='enc'||y.kind==='rest'));
  if(live&&(st==='road'||st==='camp')){if(live.state==='fight'&&S.tab.crow==='actions')return null;return `<b>${live.state==='fight'?'Fight':'Encounter'}:</b> ${esc(live.text||'')}`}
  if(st==='camp'&&!jRested(c)&&(!jRestAt().check||S.journey.camp?.ready===true))return '<b>Camp:</b> finish your rest.';
  if(st==='night'&&jLiftPending(c))return `<b>Night:</b> ${jName(jLiftBy(c))} lifted your Mind RR one tier — apply it.`;
  if(st==='night'&&jNeedsMind(c)&&!jMindDone(c))return '<b>Night:</b> make your Mind RR.';
  if(st==='dawn'&&S.journey.camp&&!jRested(c)&&S.jExhausted!==`${c.id}:${S.journey.day}`)return '<b>Dawn:</b> you didn’t rest — mark the exhaustion wound.';
  if(st==='road'){const s2=S.journey.script?.stops?.find(y=>!['done','removed','pending'].includes(y.state));if(s2){if(s2.kind==='enc')return `<b>${s2.state==='fight'?'Fight':'Encounter'}:</b> ${esc(s2.text||'')}`;
    if(s2.kind==='village'&&!x.stay)return `<b>Vote:</b> rest in ${esc(s2.text||'the village')}?`;if(s2.kind==='poi'&&!x.explore)return `<b>Vote:</b> explore ${esc(s2.text||'the place')}?`}}
  return null}
{const base=nextHTML;nextHTML=function(){const h=base();if(h||S.tab.crow==='journey')return h;const w=jWants();
  return w?`<div class="banner"><span class="msg">${w}</span><button class="btn sm primary jr-go" data-action="tab" data-v="journey">Journey →</button></div>`:''}}
let J_VIEW='';
{const base=render;render=function(){if(window.Cloud?.isActive()&&S.role==='player'&&S.area==='session')S.area='crows'; // the Ref's screens are not a player's
  const pane=$('.hxpanel,.jr-plain'),top=pane?.scrollTop,a=document.activeElement,key=a&&a.dataset?.action&&pane?.contains(a)?[a.dataset.action,a.dataset.v,a.dataset.k]:null,view=[S.area,S.tab[S.area],jStep()].join('|'),same=view===J_VIEW;J_VIEW=view;
  const f=S.phase==='travel'&&(jFighting()||S.combat?.length>0);
  PHASES.travel.crow=jFighting()?['sheet','inventory','actions','journey']:['sheet','inventory','journey'];PHASES.travel.session=f?['journey','session','loot']:['journey','loot'];
  TABS.session.find(t=>t[0]==='session')[1]=S.phase==='travel'?'Combat':'Dungeon turn';
  if(!(S.area==='crow'&&S.tab.crow==='journey'))J_PRESENT=false;
  base();jPersist();const w=jWants(),tab=$('#tabs [data-v=journey]'),dot=S.tab[S.area]!=='journey'&&!!w;
  if(tab){tab.classList.toggle('jr-dot',dot);tab.classList.toggle('enc',/Encounter|Fight/.test(w||''));if(dot)tab.setAttribute('aria-label','Journey — waiting for you');else tab.removeAttribute('aria-label')}
  if(S.tab[S.area]==='journey'){const p=$('.hxpanel,.jr-plain');if(p&&top!=null&&same)p.scrollTop=top;
    $('.hxstage')?.toggleAttribute('data-jr-tall',['roles','camp','night','dawn'].includes(jStep())); // the map is not needed: a taller sheet on narrow screens
    // keyboard: the same button again; if the action took it away, the card's main button; a new step, its heading
    if(key){const sel=`[data-action="${key[0]}"]${key[1]!=null?`[data-v="${CSS.escape(key[1])}"]`:''}${key[2]!=null?`[data-k="${CSS.escape(key[2])}"]`:''}`,again=p?.querySelector(sel);
      if(again)again.focus({preventScroll:true});else if(!same){const h=p?.querySelector('.jr .hxh');if(h){h.tabIndex=-1;h.focus({preventScroll:true})}}
      else{const f=p?.querySelector(`[data-action="${key[0]}"]:not([disabled])`)||p?.querySelector('.jr .hxsec .btn.primary:not([disabled])')||p?.querySelector('.jr .hxsec button:not([disabled])');if(f)f.focus({preventScroll:true});else{const h=p?.querySelector('.jr .hxsec .hxh');if(h){h.tabIndex=-1;h.focus({preventScroll:true})}}}}}}}
