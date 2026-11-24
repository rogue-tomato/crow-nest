'use strict';
/* CROW NEST — the Journey tab: the travel day as one flow (docs/journey.md). The rules come from journey-rules.js. The
   shared state is S.journey (only the Ref writes it; players get a projection without the Ref's script, sync.js)
   and each player's crow.trip (their own answers for the day, stamped with the day).
   Slice 3a: Departure, Plan and Roles. The later steps point to the old tabs until slices 3b and 3c. */
const JRS=JourneyRules;
// In Travel the player has Sheet · Inventory · Journey and the Ref Journey · Loot; the old travel tabs wait behind More.
TABS.crow.splice(TABS.crow.findIndex(t=>t[0]==='map'),0,['journey','Journey']);
TABS.session.splice(TABS.session.findIndex(t=>t[0]==='rtravel'),0,['journey','Journey']);
PHASES.travel.crow=['sheet','inventory','journey'];PHASES.travel.session=['journey','loot'];
if(S.phase==='travel'){if(['map','travel'].includes(S.tab.crow))S.tab.crow='journey';if(['rtravel','journey'].includes(S.tab.session))S.tab.session='rmap'} // the Ref's travel day is on the Map
// The journey is kept in ctk-journey.
// J_TAKEN: a player's journey as the Ref's device sent it (already projected: projecting again would drop a stop waiting here) or
// this device's own copy of it; anything else a player holds is projected before it is shown (jPub)
const J_TAKEN=new WeakSet(),jTook=j=>{if(j&&typeof j==='object')J_TAKEN.add(j);return j};
try{const j=JSON.parse(store.get('journey')||'null');if(j&&!JRS.validateJourney(j).length){S.journey=j;if(S.role==='player')jTook(j)}}catch{}
const jSave=()=>store.set('journey',JSON.stringify(S.journey));
// The Travel day (lost, ticks, checks) is kept with the journey in ctk-jday, so a reload mid-day
// walks on where it was; the journey remembers the day if that copy is missing (a map, if any, restores it too).
if(S.journey.step!=='off'){try{const rt=JSON.parse(store.get('jday')||'null');if(rt&&typeof rt==='object'&&rt.day===S.journey.day)Object.assign(S.rtravel,rt)}catch{}
  if(S.journey.day>S.rtravel.day)S.rtravel.day=S.journey.day}
// every path that changes them renders (the Journey, the old Travel day tab, the map): save after a render when they changed
let J_SAVED='';
const jPersist=()=>{const s=JSON.stringify(S.journey)+'\n'+JSON.stringify(S.rtravel);if(s===J_SAVED)return;J_SAVED=s;jSave();store.set('jday',JSON.stringify(S.rtravel))};

/* ---------- whose answers, which day ---------- */
const J_STEP={plan:'Plan',roles:'Roles',script:'Script',road:'Road',camp:'Camp',night:'Night',dawn:'Dawn'};
const jStep=()=>S.journey?.step||'off';
// The Ref's device knows the day from the session; players read it from the journey the Ref keeps.
const jDay=()=>S.role==='ref'?S.rtravel.day:(S.journey?.day||1);
// The crow whose answers this device gives.
const jMe=()=>ME;
const jIn=c=>JRS.inputsFor(c.trip,S.journey?.inputs?.[c.id],jDay());
const jName=c=>esc(c.name.split(' ')[0]);
// crows over the slot limits (a second guide, a third scout): their task does not count until the Ref sorts it out
// every traveller's answers: crows, and their hirelings in travel roles (id "<crow id>/<hireling uid>")
const jHireIn=c=>{const h=jIn(c).hires||{};return (c.hires||[]).filter(x=>h[x.uid]?.role).map(x=>({c,h:x,id:`${c.id}/${x.uid}`,x:{role:'',task:'',...h[x.uid]}}))};
const jAllIn=()=>[...PLAY().map(c=>({c,id:c.id,x:jIn(c)})),...PLAY().flatMap(jHireIn)]; // crows first: a hireling never bumps a crow
const jWho=id=>{const [cid,u]=String(id).split('/'),c=PARTY.find(x=>x.id===cid);if(!u)return c?jName(c):'?';const h=(c?.hires||[]).find(x=>String(x.uid)===u);return h?`${esc(h.name)} (${jName(c)}’s hireling)`:'?'};
const jOver=()=>JRS.slotConflicts(Object.fromEntries(jAllIn().map(a=>[a.id,a.x])));
const jModsIn=()=>{const over=new Set(jOver());return jAllIn().filter(a=>!over.has(a.id)).map(a=>a.x)};
const jMonSpeed=(mon,bless)=>Math.max(...(String(MON[mon]?.st.Speed||'5').match(/\d+/g)||['5']).map(Number))+(bless?3:0); // a flyer ("2, fly 8") goes at its best
const jPetSpeed=p=>jMonSpeed(p.mon,(p.prayer||0)>0); // Mount's Prayer: +3 while it lasts
function jRide(c){const r=String(jIn(c).ride||''),pet=u=>(c.pets||[]).find(p=>String(p.uid)===u);if(r.startsWith('p:')){const p=pet(r.slice(2));return p?{kind:'mount',pets:[p]}:null}
  if(r.startsWith('v:')){const ps=r.slice(2).split(',').map(pet).filter(Boolean);return ps.length?{kind:'cart',pets:ps}:null}return null}
const jSpeedOf=c=>{const r=jStep()!=='off'?jRide(c):null;return r?Math.min(...r.pets.map(jPetSpeed)):speed(c)};
// a dead crow (10 wounds) does not travel and does not slow the group; their hirelings and animals still count
groupSpeed=()=>{const sp=[];for(const c of PLAY()){const dead=crowDead(c),r=!dead&&jStep()!=='off'?jRide(c):null,used=new Set((r?.pets||[]).map(p=>p.uid));if(!dead)sp.push(jSpeedOf(c));
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
function jBonus(c){let n=0;const why=[];for(const o of PLAY()){if(o===c)continue;const x=jIn(o);
  if(((x.role==='supporter'&&x.task==='everyone')||x.role==='assist')&&(x.targets||[]).includes(c.id)&&x.tier){n+=J_SHIFT[x.tier];why.push(`${jName(o)} ${fmt(J_SHIFT[x.tier])}`)}}
  return {n,why}}
function jPace(){const p=S.journey?.plan;if(p&&p.locked)return p.pace;if(S.area==='session')return S.rtravel.pace;return JRS.paceVote(PLAY().map(c=>jIn(c).pace))||p?.pace||'normal'}
function jTotals(){const lost=S.role==='ref'?!!S.rtravel.lost:!!myPub()?.lost,over=new Set(jOver()),xs=PLAY().map(c=>[c,over.has(c.id)?{...jIn(c),role:'none',task:''}:jIn(c)]);
  const route=Object.fromEntries(JRS.ROUTE_KEYS.filter(k=>S.rtravel.mods?.[k]).map(k=>[k,true]));
  const pace=jPace(),mods={...route,...JRS.modsFromInputs(jModsIn(),{lost})};
  return {T:JRS.dayTotals({pace,mods,lost},groupSpeed()),pace,mods,xs,lost}}

// Today's hexes: from the answers until the day is prepared, then the hexes the day's script walks. The script fixes the day:
// a later answer (an activity at camp) or a crow slowed by a wound does not change how far the party went today.
const jDayHexes=()=>{const sc=S.journey?.script;return ['script','road','camp','night','dawn'].includes(jStep())&&sc&&Array.isArray(sc.path)?Math.max(0,sc.path.length-1):jTotals().T.hexes};
/* ---------- pieces of the panel ---------- */
// Night and Dawn are part of the camp now (owner's decision 2026-11-16: one button from the camp to the next day)
function jRail(){const st0=jCamping()?'camp':jStep(),st=st0==='script'&&S.area!=='session'?'road':st0,list=JRS.STEPS.filter(s=>!['off','night','dawn'].includes(s)&&(S.area==='session'||s!=='script')),all=JRS.STEPS.indexOf(st);
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
const jWarns=()=>PLAY().flatMap(c=>c.miasma.filter(m=>J_WARN.includes(m.n)).map(m=>`<p class="jr-warn"><b>${jName(c)} — ${esc(m.n)}:</b> ${esc(m.t)}</p>`)).join('');
function jPartyList(step,actions){const me=jMe();return PLAY().map(c=>{const x=jIn(c),[cls,st]=jStatus(x,step),vote=step==='plan'&&x.pace?` · votes ${PACE[x.pace].label}`:'';
  return `<div class="jr-li${c===me&&S.area!=='session'?' me':''}"><span class="jr-who">${crowAv(c,28,crowDead(c)?'dead':'')}${jName(c)}${c===me&&S.area!=='session'?' — you':''}</span><span class="jr-st ${cls}">${st}</span><span class="jr-what">${jTaskLine(x)}${vote}</span>${actions?actions(c,x):''}</div>`}).join('')+sesFrozenRows()} // a frozen crow has no role (session.js)

/* ---------- Plan ---------- */
function jPaceVotes(k){return PLAY().filter(c=>jIn(c).pace===k).map(c=>`<i title="${esc(c.name)}">${esc(c.name.split(' ').map(w=>w[0]).join('').slice(0,2))}</i>`).join('')}
function jPlanPlayer(part){const c=jMe();if(!c)return `<p class="muted">Open your crow to give your answers.</p>`;const x=jIn(c),t=jTotals();
  const taken=r=>[...PLAY().filter(o=>o!==c&&jIn(o).role===r),...PLAY().flatMap(jHireIn).filter(a=>a.x.role===r).map(a=>({name:a.h.name}))];
  // role → its tasks → the chosen task's text: one block (chips.js chipBox; owner, 2026-11-21). A full slot or a task the day rules
  // out stays visible, dashed; the reason is said once under the tasks.
  const ROLES=[['guide','Guide','one per group'],['scout','Scout','one, two with Places'],['tracker','Tracker','any number'],['supporter','Supporter','any number'],['assist','Assist','help a risky test'],['none','No role','rest on the road']];
  const roleItems=ROLES.map(([r,label])=>{const others=r==='none'?[]:taken(r),full=(r==='guide'&&others.length||r==='scout'&&others.length>=2)&&x.role!==r;
    return {v:r,label,dis:!!full,why:full?`taken by ${others.map(jName).join(', ')}`:''}});
  const role=x.role&&x.role!=='none'&&x.role!=='assist'?JRS.ROLES[x.role]:null;
  const lost=jTotals().lost,scouts=taken('scout'),why=k=>x.role==='scout'&&scouts.length&&!scouts.some(o=>jIn(o).task==='places')&&k!=='places'?'A second scout must scout for places.'
      :x.role==='guide'&&lost&&k!=='back'?'While lost, the guide can only try Back on Track.':x.role==='guide'&&!lost&&k==='back'?'Back on Track is only for a lost group.':'';
  const td=x.task&&role?.tasks[x.task]?jTaskDef(x.task):null,whys=role?[...new Set(Object.keys(role.tasks).map(why).filter(Boolean))]:[];
  const tasks=role?chipBox({cls:'cd-inner',lead:'<span class="cd-lbl" aria-hidden="true">Task</span>',label:'Task',action:'jtask',sel:x.task||null,
    items:Object.keys(role.tasks).map(k=>({v:k,label:esc(jTaskDef(k).n),dis:!!why(k),title:why(k)})),
    desc:(td?`<p>${cdName(esc(td.n))}<span class="cd-tag">${td.safe?'safe':`risky · <b>${td.ch.join(' or ')}</b>`}</span></p><p>${rich(td.d)}</p>`:'')
      +(x.task==='track'?`<label class="small" style="display:block;margin-top:.5rem">What do you track? <input id="jwhat" class="jr-what-in" maxlength="200" value="${esc(S.jDraft??x.what??'')}" placeholder="a creature the Ref agrees is around"></label>`:'')
      +(whys.length?`<p class="muted">${whys.join(' ')}</p>`:'')}):'';
  const want=x.role==='assist'?1:x.task==='everyone'?3:x.task==='fight'?1:0;
  const pickable=x.role==='assist'?PLAY().filter(o=>o!==c&&jIn(o).role!=='assist'&&jRisky(jIn(o))):x.task==='everyone'?PLAY().filter(o=>o!==c&&['guide','scout','tracker'].includes(jIn(o).role)):PLAY().filter(o=>o!==c);
  const targets=want?`<h4 class="jr-h">${x.role==='assist'?'Whose test do you help?':x.task==='fight'?'Which ally? Their next Mind RR gets +1':'Up to three allies in travel roles'}</h4>
    ${pickable.length?`<div class="jr-opts">${pickable.map(o=>`<button class="opt" data-action="jtarget" data-k="${esc(o.id)}" aria-pressed="${(x.targets||[]).includes(o.id)}"><b>${jName(o)}</b><span class="small muted">${jTaskLine(jIn(o))||'no role yet'}</span></button>`).join('')}</div>`:'<p class="small muted" style="margin:0">Nobody to pick yet.</p>'}`:'';
  // the role block alone is one step of the player's plan (travel.js)
  const roleBox=chipBox({label:'Your role',action:'jrole',sel:x.role||null,items:roleItems,desc:x.role?`<p>${cdName(ROLES.find(r=>r[0]===x.role)?.[1]||'')}<span class="muted">${ROLES.find(r=>r[0]===x.role)?.[2]||''}</span></p>${tasks}${targets}`:''});
  if(part==='role')return roleBox;
  return `<section class="hxsec"><h3 class="hxh">Today <span class="muted">day ${jDay()}${t.lost?' · lost':''}</span></h3>${jKpis(t)}${jWarns()}</section>
   <section class="hxsec"><h3 class="hxh">Pace <span class="muted">your vote; the Ref decides</span></h3>
    <div class="jr-opts">${Object.entries(PACE).map(([k,p])=>`<button class="opt" data-action="jpace" data-v="${k}" aria-pressed="${x.pace===k}"><b>${p.label}</b><span class="small muted">${p.hex} hex${p.hex>1?'es':''} · EN ${p.en}${p.mod?` · role tests ${p.mod==='edge'?'+2':'−2'}`:''}</span><span class="jr-votes">${jPaceVotes(k)}</span></button>`).join('')}</div></section>
   <section class="hxsec"><h3 class="hxh">Your role <span class="muted">supporters, then guide, scouts, trackers</span></h3>
    ${roleBox}</section>
   <section class="hxsec"><h3 class="hxh">The party</h3>${jPartyList('plan')}</section>`}
function jPlanRef(){const t=jTotals(),over=jOver(),vote=JRS.paceVote(PLAY().map(c=>jIn(c).pace));
  const noRoute=hxHere()&&!HX.route.length,s=S.journey.season;
  const tired=(S.journey.tired||[]).map(id=>PARTY.find(c=>c.id===id)).filter(Boolean);
  return `<section class="hxsec"><h3 class="hxh">Today <span class="muted">day ${jDay()}${S.journey.from?` · from ${esc(VILLAGES.find(v=>v.id===S.journey.from)?.name||S.journey.from)}`:''}</span></h3>${jKpis(t)}${jWarns()}
    ${tired.length?`<p class="jr-warn">${tired.map(jName).join(', ')} didn’t finish a rest last night: an exhaustion wound each (they mark it on their Journey).</p>`:''}</section>
   <section class="hxsec"><h3 class="hxh">Pace <span class="muted">${vote?`most votes: ${PACE[vote].label}`:'no clear vote'}</span></h3>
    <div class="jr-opts">${Object.entries(PACE).map(([k,p])=>`<button class="opt" data-action="rpace" data-v="${k}" aria-pressed="${S.rtravel.pace===k}"><b>${p.label}</b><span class="small muted">${p.hex} hex${p.hex>1?'es':''} · EN ${p.en}</span><span class="jr-votes">${jPaceVotes(k)}</span></button>`).join('')}</div></section>
   <section class="hxsec"><h3 class="hxh">The party <span class="muted">${PLAY().filter(c=>jIn(c).role).length} of ${PLAY().length} chose</span></h3>${jPartyList('plan',(c,x)=>over.includes(c.id)?`<div class="jr-act"><button class="btn sm ghost" data-action="jrout" data-k="${esc(c.id)}">Leave ${jName(c)} out</button></div>`:'')}
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
// a crow's role test: the characteristic, the pace's and the weather's edges and banes, the bonuses (the player's card and the Ref's tiers)
function jTestMod(c,x){const def=x.role==='assist'?J_ASSIST:jTaskDef(x.task),pace=PACE[jPace()],best=def.ch.reduce((a,b)=>c.ch[a]>=c.ch[b]?a:b);
  const b=x.role==='assist'?{n:0,why:[]}:jBonus(c),fx=jFxNow(),role=['guide','scout','tracker'].includes(x.role),edges=[],banes=[];
  if(x.role!=='assist'&&pace.mod)(pace.mod==='edge'?edges:banes).push(`${pace.label.toLowerCase()} pace: ${pace.mod}`);
  if(role&&fx.some(e=>e.kind==='strong'))banes.push('Strong Miasma: bane');
  if(role)fx.forEach(e=>{const n=JRS.WEATHER_BANES[e.name];if(n)banes.push(`${e.name}: ${n>1?'double bane':'bane'}`,...Array(n-1).fill(''))});
  const eb=JRS.edgesBanes(edges.length,banes.length);return {def,best,b,edges,banes,eb,mod:c.ch[best]+eb.mod+b.n}}
// a hireling's: the stat block's characteristics and the edges and banes (Travel Expert rolls twice, the player's to say)
const J_CH={A:'Agility',M:'Mind',S:'Strength'};
function jHireTestMod(h,x){const def=jTaskDef(x.task),st=MON[h.mon]?.st||{},val=k=>parseInt(st[J_CH[k]])||0,best=def.ch.reduce((p,q)=>val(p)>=val(q)?p:q);return val(best)+jEdges(x.role,PACE[jPace()],jFxNow()).eb.mod}
function jTestCard(c,x){const {def,best,b,edges,banes,eb,mod}=jTestMod(c,x);
  const sub=[`you use ${best} ${fmt(c.ch[best])}`,...edges,...banes.filter(Boolean),...b.why].join(', ')+` → total ${fmt(mod)}${eb.shift?`; ${eb.shift>0?'double edge: one tier up':'double bane: one tier down'}`:''}`;
  const target=x.role==='assist'?PARTY.find(o=>o.id===(x.targets||[])[0]):null;
  if(dqTable())return `${target?`<p style="margin:0 0 .4rem">You help <b>${jName(target)}</b>’s ${esc(JRS.TASK_NAMES[jIn(target).task]||'test')}.</p>`:''}${dqTestPillHTML(c,x,mod,eb.shift)}`;
  // the task's own text is on the Plan, under the task chips (owner, 2026-11-21): here only the test; Assist keeps its text (the Plan has none)
  return `${x.role==='assist'?`<p style="margin:0 0 .4rem">${target?`You help <b>${jName(target)}</b>’s ${esc(JRS.TASK_NAMES[jIn(target).task]||'test')}. `:''}${rich(def.d)}</p>`:''}
   ${prHTML(def.o.map((o,j)=>[j+1,rich(o)+(eb.shift?`<span class="dice">${jDice(j+1,mod,eb.shift)}</span>`:'')]),{head:`Test 2d10 + ${def.ch.join(' or ')}`,sub,mod:eb.shift?null:mod,on:x.tier||undefined})}
   <h4 class="jr-h">Your result <span class="muted">roll the dice, then tap the tier</span></h4>
   <div class="jr-tiers">${[1,2,3].map(t=>`<button class="btn${x.tier===t?' primary':''}" data-action="jtier" data-v="${t}" aria-pressed="${x.tier===t}">Tier ${t}</button>`).join('')}</div>
   ${x.tier===1?`<label class="check small" style="margin-top:.5rem"><input type="checkbox" data-action="jdoom" ${x.doom?'checked':''}> It was a doom (dice 3 or lower): no Effort for it</label>`:''}
   ${x.tier&&x.tier<3&&!x.doom&&!x.effort&&c.effort>0?`<div class="jr-row" style="margin-top:.5rem"><button class="btn sm" data-action="jspend">Spend 1 Effort → tier ${x.tier+1}</button><span class="small muted">with a fitting expertise · Effort ${c.effort}</span></div>`:''}`}
function jRolesPlayer(){const c=jMe();if(!c)return `<p class="muted">Open your crow to give your answers.</p>`;const x=jIn(c),t=jTotals();
  const body=jRisky(x)?jTestCard(c,x):x.role&&x.role!=='none'&&x.task?`<p style="margin:0"><b>${esc(JRS.TASK_NAMES[x.task])}</b> is safe — nothing to roll.</p>`
    :x.role==='assist'?'<p class="muted" style="margin:0">Pick whose test you help on the Plan — ask the Ref to step back.</p>':'<p class="muted" style="margin:0">No role today.</p>';
  return `<section class="hxsec"><h3 class="hxh">Your test <span class="muted">${jTaskLine(x)||'no role'}</span></h3>${body}</section>
   <section class="hxsec"><h3 class="hxh">Today</h3>${jKpis(t)}</section>
   <section class="hxsec"><h3 class="hxh">The party <span class="muted">supporters roll first</span></h3>${jPartyList('roles')}</section>`}
function jRolesRef(){const t=jTotals(),miss=jAllIn().filter(a=>jWaiting(a.x)),rows=jAllIn().filter(a=>a.x.role&&a.x.role!=='none'&&(a.x.role==='assist'||a.x.task));
  return `<section class="hxsec"><h3 class="hxh">Role tests <span class="muted">${miss.length?`<span class="dq-count wait">${miss.length}</span>`:'all in'}</span></h3>
    ${rows.map(dqRoleRowHTML).join('')||'<p class="muted" style="margin:0">Nobody has a risky task today.</p>'}</section>
   <section class="hxsec"><h3 class="hxh">Today</h3>${jKpis(t)}</section>
   <section class="hxsec"><div class="jr-row">${miss.length?`<span class="dq-count wait">${miss.map(a=>a.h?esc(a.h.name):jName(a.c)).join(', ')}</span>`:''}<button class="btn primary" data-action="jprep">Prepare the day →</button><button class="btn ghost" data-action="jbackplan">Back to Plan</button></div></section>`}

/* ---------- Script (the Ref prepares the day) and Road ---------- */
// What a place on the map is for the road: a settlement stops for a vote (rest or go on), a dungeon or ruin for "explore?".
const jPoiKind=p=>{const cat=(HX_POI[p.type]||[])[0];return cat==='Settlements'?'village':['Dungeons','Fortifications','Sacred'].includes(cat)?'poi':''};
const jPoiAt=(k,any)=>hxHere()&&HX.pois.find(p=>p.k===k&&(p.found||any)&&jPoiKind(p)); // any: also a place not found yet (Scout for Places)
const jHexName=k=>{if(!hxHere()||!HX.t[k])return '';const p=jPoiAt(k);return p?esc(p.label||tName(HX,p.type)):esc(tName(HX,HX.t[k]))};
const jChecks=()=>S.rtravel.checks||[];
// the hexmap day log keeps the day's encounters (players see them in their log once the day is over)
const jDayLog=()=>{if(!hxHere())return;const met=k=>(S.journey.script?.stops||[]).filter(x=>x.kind===k&&x.state==='done'),r=hxDayRec();
  r.enc=met('enc').map(x=>x.text);r.renc=met('rest').map(x=>x.text);r.encp=met('enc').map(x=>x.say||'an encounter');r.rencp=met('rest').map(x=>x.say||'an encounter at camp');saveHX()}; // encp: the players' log (hexmap.js hxPub)
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
  let dirs=null;if(!map){path=Array.from({length:T.hexes+1},(_,n)=>n+',0');if(T.lost)dirs=path.slice(1).map(()=>d(6))} // no map: the steps of the day, counted; lost, a d6 each (travel.js draws the way)
  else if(T.lost)path=[HX.party,...jLostWalk(HX.party,T.hexes)];
  else{path=[HX.party];if(!jRouteOff())for(const k of jRoute().slice(0,T.hexes))path.push(k)}
  path=path.slice(0,200);A.rcheck();const stops=[],night=map&&!T.lost?path.findIndex((k,i)=>i>0&&nights.includes(k)):-1;
  jChecks().forEach((c,n)=>{if(c.hit){const i=jPlace(night>0?night+1:path.length);jSub(c,map?path[i]:null);stops.push(jEncStop(c,n,i))}});
  if(map&&!T.lost)path.forEach((k,i)=>{if(!i)return;const p=jPoiAt(k,!!S.rtravel.mods?.places);if(nights.includes(k))stops.push({id:'n'+i,i,k,kind:'night',state:'pending',text:p?p.label||'':''});
    else if(p)stops.push({id:(jPoiKind(p)==='village'?'v':'p')+i,i,k,kind:jPoiKind(p),state:'pending',text:p.label||tName(HX,p.type)})});
  for(const st of stops)if(st.k===undefined&&map)st.k=path[st.i];
  return {path,at:0,lost:!!T.lost,...(dirs?{dirs}:{}),stops:stops.sort((a,b)=>a.i-b.i)}}
const jScriptSet=fn=>{const sc=JSON.parse(JSON.stringify(S.journey.script));fn(sc);sc.stops.sort((a,b)=>a.i-b.i);S.journey={...S.journey,script:sc}};
const J_KIND={enc:'Encounter',rest:'Rest encounter',village:'Village',poi:'Place',night:'Overnight'};
// Travel Encounters results that are no secret: once the Ref reveals the stop, players read these; monsters stay unnamed (Ref p38)
const J_SAY={Merchant:'A merchant caravan on the road',Traveler:'Travelers on the road','Strong Miasma':'Strong Miasma','Bad Weather':'Bad Weather'};
// a short text from the Ref (what the players see); cb gets the text
function jAskText(title,msg,val,cb){const dl=$('#dlg');dl.innerHTML=`<form method="dialog"><h2>${esc(title)}</h2>${msg?`<p class="muted">${esc(msg)}</p>`:''}<label class="fld"><b>Players read</b><input type="text" id="jtxt" maxlength="200" autocomplete="off" style="width:100%" value="${esc(val||'')}"></label>
   <div class="row" style="justify-content:flex-end;margin-top:1rem"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" value="ok">Show it to the players</button></div></form>`;
  dlgOk(dl,()=>cb($('#jtxt')?.value||''));dl.showModal();$('#jtxt')?.focus()}
// What players read of an encounter (Ref p38 Monster Names: monsters have no names, the Ref shows their art): the words the Ref
// gave them (stop.say; projectJourney passes only those), else only that something is there
const jSeen=st=>st.text?esc(st.text):st.state==='done'?(st.kind==='rest'?'An encounter at the camp.':'An encounter on the road.'):st.state==='fight'?'A fight.':(st.kind==='rest'?'Something comes to the camp…':'Something is coming…');
function jStopLine(st,ref){const c=st.kind==='enc'?jChecks()[st.check]:null,where=st.i>0?`hex ${st.i}`:'at the start';
  if(st.kind==='enc')return ref?`<b>Encounter</b> · ${where}: d10 <span class="jr-n">${c?.r}</span> ≤ EN, d100 <span class="jr-n">${c?.roll}</span> → <b>${esc(c?.text||st.text)}</b>`
    :`<b>Encounter</b>: ${jSeen(st)}`;
  if(st.kind==='rest')return ref?`<b>Rest encounter</b>${c0(st)?`: d10 <span class="jr-n">${c0(st).r}</span> ≤ EN, d100 <span class="jr-n">${c0(st).roll}</span> → <b>${esc(c0(st).text||st.text)}</b>`:st.text?': '+esc(st.text):''}`:`<b>Rest encounter</b>: ${jSeen(st)}`;
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
function jVotes(key,val,label){const n=PLAY().filter(c=>jIn(c)[key]===val);return `${label} <span class="jr-votes">${n.map(c=>`<i title="${esc(c.name)}">${esc(c.name.split(' ').map(w=>w[0]).join('').slice(0,2))}</i>`).join('')||'<span class="small muted">no votes</span>'}</span>`}
/* ---------- scenes: a merchant caravan and travelers on the road (The Ref: Merchant, Traveler), hirelings (Characters) ---------- */
const J_ORD=['','1st','2nd','3rd','4th','5th','6th'];
const jMon=n=>Object.values(MON).find(m=>m.name===n||m.name===String(n).replace(/^(\w+) Warrior/,'Warrior, $1')); // the tables say "Sword Warrior", the bestiary "Warrior, Sword"
const jRollText=t=>String(t).replace(/(\d+)d(\d+)/g,(m,a,b)=>{let s=0;for(let i=0;i<+a;i++)s+=d(+b);return `${s} (${m})`}); // the Ref's roll, written into the text once
const jGuards=who=>Object.entries(who||{}).map(([n,k])=>`${+k||0} × ${esc(n)}`).join(', '); // who fights, if it comes to that: the encounter card lists them
// the rule of a peaceful encounter is a linked term at its lead, not a “rules” line of its own (owner, 2026-11-24)
const jRuleTerm=(id,t)=>`<a class="term" href="#rule/${id}" data-action="open-rule" data-k="${id}">${t}</a>`;
function jMerchantInfo(sc,ref){const who=`${esc(sc.name)}, ${J_ORD[+sc.lvl]||''} level${sc.name2?` and ${esc(sc.name2)}, ${J_ORD[+sc.lvl2]||''} level`:''}`;return `<div style="margin-top:.4rem"><b>${ref?who:jRuleTerm('ref-merchant',who)}</b> — sells as ${sc.name2?'both institutions':'that institution'}; buys goods at ${+sc.pct||0}% of their value.
  <div class="small" style="margin-top:.3rem">${ref?`Merchant: ${esc(sc.npc)} · guards: ${jGuards(sc.guards)||'none'}`:`${+sc.gn||0} guard${+sc.gn===1?'':'s'}`}</div></div>`}
function jTravelInfo(sc,ref,st){return `<div style="margin-top:.4rem"><b>${+sc.n||0} traveler${+sc.n>1?'s':''}:</b> ${jGuards(sc.who)}
  ${sc.reward?`<p style="margin:.3rem 0 0"><b>Reward:</b> ${esc(sc.reward)}</p>`:`<div class="jr-row" style="margin-top:.3rem"><button class="btn sm" data-action="jtreward" data-k="${esc(st.id)}">The party helped: roll a reward</button></div>`}</div>`} // the Ref's: players see only the stop's say
function jSceneRef(st,c){const t=c?.text||'',sc=st.scene,k=esc(st.id);
  if(t==='Merchant')return sc?jMerchantInfo(sc,true)+`<p class="small" style="margin:.3rem 0 0">The players trade in their Inventory while this card is open: they buy at the card’s price and sell at ${+sc.pct||0}%. Each sale or purchase has its Undo there.</p>`
    :`<div class="jr-row" style="margin-top:.4rem"><button class="btn primary" data-action="jmerchant" data-k="${k}">Roll the merchant</button><span class="small muted">Merchant Sales, 1d10 × 10%, the guards</span></div>`;
  if(t==='Traveler')return sc?jTravelInfo(sc,true,st):`<div class="jr-row" style="margin-top:.4rem"><button class="btn primary" data-action="jtravel" data-k="${k}">Roll the travelers</button><span class="small muted">1d10 humans and what makes them noteworthy</span></div>`;
  // Miasma-Touched (The Ref): 1d6 rolls on Miasma-Touched Humans; their reaction is the card's first block
  if(t==='Miasma-Touched')return sc?.kind==='touched'?`<p class="small" style="margin:.4rem 0 0"><b>${+sc.n||0} roll${+sc.n===1?'':'s'} on Miasma-Touched Humans:</b> ${jGuards(sc.who)}</p>`
    :`<div class="jr-row" style="margin-top:.4rem"><button class="btn sm" data-action="jtouched" data-k="${k}">Roll the humans</button><span class="small muted">1d6 rolls on Miasma-Touched Humans</span></div>`;
  return ''}
const jHirePaid=h=>h.paid===jDay();
// the companions tab's Pay today follows the same day: once, and it counts for the Journey's Plan
{const f=A['hire-pay'];A['hire-pay']=b=>{const h=ME?.hires?.[+b.dataset.k],on=jStep()!=='off';if(h&&on&&jHirePaid(h))return toast(`${h.name} is paid for today`);const d=h?.days;f(b);if(h&&on&&h.days!==d){h.paid=jDay();render()}}}
// a rider (Medium) needs a Large or bigger mount; vehicles count Large animals (Characters: Vehicles)
const jBig=p=>/Large|Huge|Holy/i.test(MON[p.mon]?.st.Size||'');
function jHireRoles(){const c=jMe();if(!c||!(c.hires||[]).length)return '';const x=jIn(c),hs=x.hires||{},lost=jTotals().lost,others=uid=>jAllIn().filter(a=>a.id!==`${c.id}/${uid}`),full=(uid,r)=>{const o=others(uid).filter(a=>a.x.role===r);return r==='guide'&&o.length>=1||r==='scout'&&o.length>=(o.some(a=>a.x.task==='places')?2:1)},opts=[['','No role'],...Object.entries(JRS.ROLES).filter(([r])=>r!=='supporter').flatMap(([r,R])=>Object.keys(R.tasks).map(t=>[`${r}:${t}`,`${r[0].toUpperCase()+r.slice(1)} · ${JRS.TASK_NAMES[t]}`]))];
  return `<section class="hxsec"><h3 class="hxh">Your hirelings’ roles <span class="muted">you play them</span></h3>${c.hires.map(h=>{const a=hs[h.uid]||{},v=a.role&&a.task?`${a.role}:${a.task}`:'';
    const off=k=>{if(!k||k===v)return false;const [r,t]=k.split(':');return full(h.uid,r)||r==='guide'&&(lost?t!=='back':t==='back')};
    const rideOpts=[['','on foot'],...(c.pets||[]).filter(jBig).map(p=>[`p:${p.uid}`,`rides ${p.name}`]),...(String(x.ride||'').startsWith('v:')?[['cart','in your vehicle']]:[])];
    return `<div class="jr-row" style="margin:.3rem 0"><label class="small" style="flex:1 1 14rem">${esc(h.name)} <select class="jr-sel" data-action="jhrole" data-k="${h.uid}" aria-label="${esc(h.name)}’s role">${opts.map(([k,l])=>`<option value="${k}"${k===v?' selected':''}${off(k)?' disabled':''}>${esc(l)}${off(k)?' (taken or not now)':''}</option>`).join('')}</select></label>
      ${rideOpts.length>1?`<label class="small" style="flex:1 1 10rem">travels <select class="jr-sel" data-action="jhride" data-k="${h.uid}" aria-label="How ${esc(h.name)} travels">${rideOpts.map(([k,l])=>`<option value="${k}"${(a.ride||'')===k?' selected':''}>${esc(l)}</option>`).join('')}</select></label>`:''}</div>`}).join('')}</section>`}
// a hireling's risky test on the Roles step: their characteristics from the stat block; the player rolls and taps the tier
function jHireTests(){const c=jMe();if(!c)return '';const rows=jHireIn(c).filter(a=>jRisky(a.x));if(!rows.length)return '';const CH={A:'Agility',M:'Mind',S:'Strength'},pace=PACE[jPace()],fx=jFxNow();
  return rows.map(a=>{const def=jTaskDef(a.x.task),st=MON[a.h.mon]?.st||{},val=k=>parseInt(st[CH[k]])||0,best=def.ch.reduce((p,q)=>val(p)>=val(q)?p:q),expert=(MON[a.h.mon]?.tr||[]).some(t=>t[0]==='Travel Expert');
    const e=jEdges(a.x.role,pace,fx),mod=val(best)+e.eb.mod;
    if(dqTable())return `<section class="hxsec"><h3 class="hxh">${esc(a.h.name)}’s test</h3>${dqTestPillHTML(c,a.x,mod,e.eb.shift).replace(/<button[^>]*jspend[^>]*>[^<]*<\/button>/,'')}</section>`;
    return `<section class="hxsec"><h3 class="hxh">${esc(a.h.name)}’s test <span class="muted">${esc(JRS.TASK_NAMES[a.x.task])}</span></h3>
     ${prHTML(def.o.map((o,j)=>[j+1,rich(o)+(e.eb.shift?`<span class="dice">${jDice(j+1,mod,e.eb.shift)}</span>`:'')]),{head:`Test 2d10 + ${def.ch.join(' or ')}`,sub:[`${esc(a.h.name)} uses ${best} ${fmt(val(best))}`,...e.why].join(', ')+` → total ${fmt(mod)}${e.eb.shift?`; ${e.eb.shift>0?'double edge: one tier up':'double bane: one tier down'}`:''}${expert?' · Travel Expert: roll twice, keep either':''}`,mod:e.eb.shift?null:mod,on:a.x.tier||undefined})}
     <div class="jr-tiers" style="margin-top:.5rem">${[1,2,3].map(t=>`<button class="btn${a.x.tier===t?' primary':''}" data-action="jhtier" data-k="${a.h.uid}" data-v="${t}" aria-pressed="${a.x.tier===t}">Tier ${t}</button>`).join('')}</div></section>`}).join('')}
function jHireList(step){const rows=PLAY().flatMap(jHireIn).filter(a=>a.x.role&&a.x.role!=='none');if(!rows.length)return '';
  const over=jOver(),ref=S.area==='session';
  return rows.map(a=>{const [cls,st]=jStatus(a.x,step);return `<div class="jr-li"><span class="jr-who">${esc(a.h.name)} <span class="muted" style="font-weight:400">· ${jName(a.c)}’s hireling</span></span><span class="jr-st ${cls}">${esc(st)}</span><span class="jr-what">${esc(jTaskLine(a.x)||'')}</span>
    ${ref&&(over.includes(a.id)||step==='roles'&&jRisky(a.x))?`<div class="jr-act">${step==='roles'&&jRisky(a.x)?[1,2,3].map(n=>`<button class="btn sm${a.x.tier===n?' primary':''}" data-action="jrhtier" data-k="${esc(a.c.id)}" data-u="${a.h.uid}" data-v="${n}" aria-pressed="${a.x.tier===n}" aria-label="${esc(a.h.name)}: tier ${n}">Tier ${n}</button>`).join(''):''}<button class="btn sm ghost" data-action="jrhout" data-k="${esc(a.c.id)}" data-u="${a.h.uid}">Leave ${esc(a.h.name)} out</button></div>`:''}</div>`}).join('')}
function jHiresPlayer(){const c=jMe();if(!c||!(c.hires||[]).length)return '';
  return `<section class="hxsec"><h3 class="hxh">Your hirelings <span class="muted">paid at the start of each day</span></h3>${c.hires.map((h,k)=>`<div class="jr-li"><span class="jr-who">${esc(h.name)}</span><span class="jr-st ${jHirePaid(h)?'ok':'wait'}">${jHirePaid(h)?'paid today':'not paid'}</span><span class="jr-what">${hirePay(h)} gc and 1 ration a day</span>${jHirePaid(h)?'':`<div class="jr-act"><button class="btn" data-action="jhpay" data-k="${k}" aria-label="Pay ${esc(h.name)} ${hirePay(h)} gc and 1 ration">Pay ${hirePay(h)} gc + 1 ration</button></div>`}</div>`).join('')}<p class="small muted" style="margin:.4rem 0 0">A hireling who isn’t paid leaves your service.</p></section>`}
function jHiresRef(){const rows=PLAY().flatMap(c=>(c.hires||[]).map((h,k)=>({c,h,k})));if(!rows.length)return '';
  return `<section class="hxsec"><h3 class="hxh">Hirelings <span class="muted">${rows.filter(r=>jHirePaid(r.h)).length} of ${rows.length} paid today</span></h3>${rows.map(({c,h,k})=>`<div class="jr-li"><span class="jr-who">${esc(h.name)} <span class="muted" style="font-weight:400">· ${jName(c)}’s</span></span><span class="jr-st ${jHirePaid(h)?'ok':'wait'}">${jHirePaid(h)?'paid':'not paid'}</span>${jHirePaid(h)?'':`<div class="jr-act"><button class="btn sm ghost" data-action="jhleave" data-c="${esc(c.id)}" data-k="${h.uid}" aria-label="${esc(h.name)} leaves the service">Unpaid: leaves the service</button></div>`}</div>`).join('')}</section>`}
// hirelings are human: those who rested in the Miasma with their crow make the Mind RR too (a Ref procedure; Characters: hirelings follow PC rules)
const jHireNight=()=>PLAY().filter(c=>jRested(c)&&c.lastRest==='miasma').flatMap(c=>(c.hires||[]).map((h,k)=>({c,h,k})));
function jHiresNightRef(){const rows=jHireNight();if(!rows.length)return '';
  return `<section class="hxsec"><h3 class="hxh">Hirelings <span class="muted">their Mind RRs — the players roll</span></h3>${rows.map(({c,h,k})=>{const m=hrMindOf(h),r=m&&{tier:m.t,n:m.n},M=parseInt(MON[h.mon]?.st.Mind)||0;
    return `<div class="jr-li"><span class="jr-who">${esc(h.name)} <span class="muted" style="font-weight:400">· ${jName(c)}’s</span></span><span class="jr-st ${r?'ok':'wait'}">${r?`tier ${r.tier}${r.n?': '+esc(r.n):''}`:'waiting'}</span><span class="jr-what">M ${fmt(M)}, cruelty ${h.cruelty||0}${(h.miasma||[]).length?' · '+esc(h.miasma.join(', ')):''}</span><div class="jr-act">${[1,2,3].map(t=>`<button class="btn sm${r?.tier===t?' primary':''}" data-action="jhmindt" data-c="${esc(c.id)}" data-k="${k}" data-v="${t}" aria-pressed="${r?.tier===t}"${r?' disabled':''} aria-label="${esc(h.name)}: Mind RR tier ${t}, ${TIERS[t-1][0]}">Tier ${t}${typeof hrMindMod==='function'?dqRange(t,hrMindMod(h)):''}</button>`).join('')}</div></div>`}).join('')}</section>`}
// The creatures a road encounter brings: the monsters of its rolled line, a merchant and the guards, the travelers.
function jEncMons(st,c){const out=[],add=(id,n)=>{if(!MON[id]||!(n>0))return;const o=out.find(x=>x.id===id);if(o)o.n+=n;else out.push({id,n})},sc=st.scene;
  if(c?.html){const t=document.createElement('template');t.innerHTML=safeGameHTML(c.html,true);t.content.querySelectorAll('[data-action=fight]').forEach(b=>add(b.dataset.id,+b.dataset.n||1))}
  if(sc?.kind==='merchant'){add(jMon(sc.npc)?.id,1);for(const [n,k] of Object.entries(sc.guards||{}))add(jMon(n)?.id,+k||0)}
  if(sc?.kind==='traveler'||sc?.kind==='touched')for(const [n,k] of Object.entries(sc.who||{}))add(jMon(n)?.id,+k||0);
  return out}
// A revealed encounter on the road is the dungeon's encounter card (encounterHTML, play.js), but an encounter is no fight by itself
// (The Ref p1–9, owner's decision 2026-11-16). The card leads with what the encounter is doing — a monster's behaviour, the
// Miasma-touched's or an animal's reaction, the travelers' prompt (jAttHTML) — then who is there, and Begin combat is one option
// among the others, not the main one. A merchant caravan is a trade (the players buy and sell on their Journey): Done trading
// leads, Fight the caravan is a quiet button; travelers the same.
// Begin combat needs creatures (owner, 2026-11-17: a Nearby Monster opened an empty combat that said “All down”): the
// encounter's own, or creatures the Ref prepared (S.combat). Until its creatures are rolled the card offers that roll instead;
// a creature encounter whose line names no creature the bestiary knows offers Add creatures (the search) instead.
const J_CREATURES=['Any Monster','Nearby Monster','Wild Animal','Miasma-Touched'];
function jEncCardRef(st,c){const k=esc(st.id),mons=jEncMons(st,c),fight=st.state==='fight'&&inFight(), // Undo of “Combat began” brings the card back
  t=c?.text||'',sc=st.scene,trade=t==='Merchant'||sc?.kind==='merchant',trav=t==='Traveler'||sc?.kind==='traveler',cult=sc?.kind==='touched'&&!!sc.goods,peace=trade||trav||cult,first=peace&&!sc; // cult: Miasma-touched cultists who trade (trade.js) // first: roll the caravan or the travelers
  const html=c?.html&&!mons.length?`<p class="st-encw">${safeGameHTML(c.html,true)}</p>`:'',follow=c?.sub&&!c.html&&!['Traveler','Miasma-Touched'].includes(t)?`<div class="st-acts jr-follow"><button class="btn sm" data-action="jfollow" data-k="${k}">Roll ${esc(TB[c.sub]?.title||'the follow-up')}</button></div>`:'';
  const near=!fight&&t==='Nearby Monster'&&!c.sub&&!c.html?jNearHTML(st):'',can=mons.length>0||S.combat.length>0,rolled=!follow&&!near&&!(t==='Miasma-Touched'&&sc?.kind!=='touched');
  const add=!fight&&!peace&&!can&&rolled&&J_CREATURES.includes(t)?`<button class="btn ghost" data-action="find" data-q="">${nest('Add creatures to fight')}</button>`:'';
  return encounterHTML({cls:peace&&!fight?'trade':'hit now',roll:c?.r,title:fight?'In combat':trade?(st.kind==='rest'?'A merchant caravan at the camp':'A merchant caravan — trade'):cult?'Cultists — trade':st.kind==='rest'?'Rest encounter — right now':'Encounter — right now',
    sub:[st.i>0?`hex ${st.i}`:'at the start',c?`d10 ${c.r} ≤ EN${c.roll!=null?`, d100 ${c.roll}`:''}`:'',trade?jRuleTerm('ref-merchant','Merchant'):trav?jRuleTerm('ref-traveler','Traveler'):''].filter(Boolean).join(' · '),
    what:trade&&sc?'':esc(st.text||''),extra:(fight?'':jAttHTML(st,c))+jSceneRef(st,c)+(fight?'':trRefHTML(st))+html+near+(follow?jCtxHTML(st,c):'')+follow+jSayRef(st),mons:fight||peace?[]:mons,
    begin:fight||!can?'':`data-action="jfight" data-k="${k}"`,main:false,quiet:fight||!peace?'':trade?'Fight the caravan':cult?'Fight them':'Fight the travelers',
    acts:fight?`<button class="btn primary st-go" data-action="tab" data-v="session">Back to the combat</button><button class="btn ghost" data-action="jresolve" data-k="${k}">Resolved</button>`
      :peace?`<button class="btn ${first?'':'primary st-go'}" data-action="jresolve" data-k="${k}">${trade?'Done trading — the caravan moves on':cult?'Done trading — they move on':'Resolved — they go their way'}</button>`
      :`${add}<button class="btn" data-action="jresolve" data-k="${k}">No fight — resolved</button>`})}
// Monster from Nearby (The Ref p2): “monsters rolled on the monster dungeon table of the monster type that inhabits the closest
// dungeon”. The closest dungeon is the nearest dungeon marker (J_DUNGEON) on the Ref's map, counted in hexes from the
// encounter's hex; which family lives there is the place's fam once the Ref has said it (the card's chooser or the map editor).
// Without a map, a dungeon on it or its family the card asks; a pick rolls that family's table and stays on the place.
const jStopHex=st=>hxHere()?(st.k&&HX.t[st.k]?st.k:HX.party||null):null;
function jNearDungeon(k){if(!hxHere()){const p=PLACES.find(x=>x.id===S.rtravel.near&&x.kind==='dungeon');return p?{p,d:null}:null}if(!k)return null;let best=null;for(const p of HX.pois)if(jPoiDungeon(p)){const d=hxDist(HX,k,p.k);if(!best||d<best.d)best={p,d}}return best}
const jFam=p=>p&&FAMS[p.fam]?p.fam:'';
function jNearHTML(st){const n=jNearDungeon(jStopHex(st)),k=esc(st.id),f=jFam(n?.p),name=n?esc(n.p.label||tName(HX,n.p.type)):'',where=n?`${esc(tName(HX,n.p.type))}, ${n.d?`${n.d} hex${n.d===1?'':'es'} away`:'right here'}`:'';
  const fams=Object.entries(FAMS).map(([v,l])=>`<button class="btn sm${v===f?' primary':''}" data-action="jnear" data-k="${k}" data-v="${v}"${v===f?' aria-pressed="true"':''}>${v===f?`Roll ${l} Encounters`:l}</button>`).join('');
  return `<div class="jr-near" role="group" aria-label="Monsters from the closest dungeon"><p class="jr-near-t">${n?`The closest dungeon: <b>${name}</b> <span class="muted">· ${where}</span>. `:''}${f?`${FAMS[f]} live there.`:`Which monsters live ${n?'there':'in the closest dungeon'}?`}</p>
    <div class="jr-row">${fams}</div><p class="small muted" style="margin:.3rem 0 0">${f?'Another family: tap it.':`Your pick rolls that family’s dungeon encounters${n?` and stays on ${name}`:''}.`} <a href="#rule/ref-monster-from-nearby" data-action="open-rule" data-k="ref-monster-from-nearby">rules</a></p></div>`}
// Wild animals (The Ref: Wild Animal): the habitat table's line (“1d6 wolves”, “1 dire wolf and 1d6 wolves”) as the creatures
// the card lists, each count rolled once (a Ref procedure) and each kind its bestiary entry; a name the bestiary lacks stays text
const jSing=w=>({wolves:'wolf',oxen:'ox'})[w]||w.replace(/s$/,'');
function jAnimalId(name){const w=String(name).toLowerCase().trim().split(/\s+/);w.push(jSing(w.pop()));const key=w.sort().join(' ');
  return (D.monsters.find(m=>m.fam==='Animal'&&m.id.split('-').sort().join(' ')===key)||{}).id||null}
const jAnimalText=s=>String(s).split(/\s+and\s+/).map(part=>{const m=part.trim().match(/^(?:(\d+)d(\d+)|(\d+))\s+(.+)$/);if(!m)return esc(part);
  const k=m[3]?+m[3]:Array.from({length:+m[1]},()=>d(+m[2])).reduce((a,b)=>a+b,0),id=jAnimalId(m[4]),lab=m[3]?String(k):`${m[1]}d${m[2]} <b class="roll" style="font-size:1rem">${k}</b>`;
  return id&&k>0?`${lab} <a href="#mon/${id}" data-action="open-mon" data-id="${id}">${esc(m[4])}</a> <button class="btn sm" data-action="fight" data-id="${id}" data-n="${k}">+ ${k} to combat</button>`:`${lab} ${esc(m[4])}`}).join(' and ');
// What the encounter is doing (The Ref: Any Monster, Monster from Nearby, Miasma-Touched, Wild Animal, Traveler): the Ref's roll on
// its table (stop.att = {tb, r}), rolled when the Ref reveals it; Reroll, or set it from the table's rows. Only the table's words —
// what it means at the table is the Ref's call. Players never get it (projectJourney leaves att out).
const J_ATT={'Any Monster':['monster-outdoor-behaviors','What the monsters are doing','ref-any-monster'],'Nearby Monster':['monster-outdoor-behaviors','What the monsters are doing','ref-monster-from-nearby'],
  'Miasma-Touched':['miasma-touched-encounters','Their reaction','ref-miasma-touched'],'Wild Animal':['wild-animal-reaction','Their attitude','ref-wild-animal'],'Traveler':['traveler-encounters','What makes it noteworthy','ref-traveler']};
const jAttDef=(st,c)=>J_ATT[c?.text]||(st.scene?.kind==='traveler'?J_ATT.Traveler:st.scene?.kind==='touched'?J_ATT['Miasma-Touched']:null);
const jAttRow=a=>a&&TB[a.tb]?(TB[a.tb].rows.slice(1).find(x=>inRange(x[0],a.r))||null):null;
// a roll on the table; a roll that hits no row (a gap in the book's numbering) is rolled again
const jAttRoll=tb=>{if(!TB[tb])return null;for(let i=0;i<20;i++){const x=rollTable(tb);if(x.row)return {tb,r:x.r}}return null};
// the table's rows in their numbers' order (Wild Animal Reaction and Miasma-Touched Encounters are stored out of order)
const jAttRows=tb=>(TB[tb]?.rows||[]).slice(1).map(x=>({lo:parseInt(x[0],10),cell:String(x[0]).replace(/\s+/g,''),row:x})).filter(x=>x.lo>0).sort((a,b)=>a.lo-b.lo);
// the travelers' prompt from before stop.att (scene.react): its row
const jAttOf=(st,tb)=>st.att?.tb===tb?st.att:st.scene?.kind==='traveler'&&tb==='traveler-encounters'?(()=>{const x=jAttRows(tb).find(y=>String(y.row[1])===String(st.scene.react));return x?{tb,r:x.lo}:null})():null;
function jAttHTML(st,c){const def=jAttDef(st,c);if(!def)return '';const [tb,label,rule]=def,T=TB[tb];if(!T)return '';
  if(tb==='traveler-encounters'&&!st.scene)return ''; // rolled with the travelers
  const a=jAttOf(st,tb),row=jAttRow(a),k=esc(st.id),[hd,...rest]=row?String(row[1]).split(':'):[];
  const opts=jAttRows(tb).map(x=>`<option value="${x.lo}" ${row===x.row?'selected':''}>${esc(x.cell)} · ${esc(String(x.row[1]).split(':')[0])}</option>`).join('');
  const note=tb==='monster-outdoor-behaviors'?'You decide what the monsters are doing — or use the table.':'The table’s prompts aren’t handcuffs: change what you like.';
  return `<div class="jr-att" role="group" aria-label="${esc(label)}"><div class="jr-att-h"><b>${esc(label)}</b><span class="small muted">${esc(T.title)}${a?` · ${esc(T.rows[0][0])} <span class="jr-n">${a.r}</span>`:''}</span></div>
    ${row?`<p class="jr-att-t"><b>${esc(hd.trim())}</b>${rest.length?': '+esc(rest.join(':').trim()):''}</p>${jDiceHTML(st,row)}`:'<p class="jr-att-t muted">Not rolled yet.</p>'}
    <div class="jr-row"><button class="btn sm" data-action="jattroll" data-k="${k}">${a?'Reroll':'Roll it'}</button><label class="small jr-att-set">or set it <select class="jr-sel" data-action="jattset" data-k="${k}" aria-label="Set: ${esc(label)}"><option value="">—</option>${opts}</select></label></div>
    <p class="small muted" style="margin:.3rem 0 0">${note} Only you see this. <a href="#rule/${rule}" data-action="open-rule" data-k="${rule}">rules</a></p></div>`}
// Dice in the line (Miasma-Touched Bandits' “10d10 × 10 gc”, the travelers' “2d6 Miasma-touched humans”, an animal's “1d10
// babies”…): the Ref's to roll (a Ref procedure), so each gets a Roll button and its total; nothing is rolled until asked.
// Kept on the stop (dice: the sum of each), Ref-only like att; a new line clears them.
const J_DICE=/(\d+)d(\d+)(?:\s*[×x]\s*([\d,]+))?(\s*gc\b)?/g;
const jDiceIn=txt=>[...String(txt).matchAll(J_DICE)].slice(0,6).map((m,i)=>({i,n:+m[1],d:+m[2],k:m[3]?+m[3].replace(/,/g,''):1,gc:!!m[4],label:m[0].trim()})).filter(x=>x.n>=1&&x.n<=20&&x.d>=2&&x.d<=100);
function jDiceHTML(st,row){const l=jDiceIn(row[1]);if(!l.length)return '';const k=esc(st.id);
  return `<div class="jr-row jr-dice" role="group" aria-label="Dice in this line">${l.map(x=>{const v=st.dice?.[x.i];
    return `<span class="jr-die">${v?`<b class="jr-dt">${(v*x.k).toLocaleString('en')}${x.gc?' gc':''}</b><span class="small muted">${esc(x.label)}: ${v}${x.k>1?` × ${x.k.toLocaleString('en')}`:''}</span>`:''}<button class="btn sm${v?' ghost':''}" data-action="jattdice" data-k="${k}" data-v="${x.i}" aria-label="${v?'Roll again:':'Roll'} ${esc(x.label)}">${v?'Roll again':`Roll ${esc(x.label)}`}</button></span>`}).join('')}</div>`}
// a new att on the stop; the travelers' prompt is their scene's react too, and the line players read follows it if it was the app's
function jAttSet(id,make){const st0=S.journey.script?.stops.find(x=>x.id===id);if(!st0)return;const c=(st0.kind==='rest'?S.rtravel.restChecks||[]:jChecks())[st0.check],def=jAttDef(st0,c);if(!def)return;
  const a=make(def);if(!a||!jAttRow(a))return;
  jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===id);if(!st)return;st.att=a;delete st.dice;
    if(st.scene?.kind==='traveler'&&def[0]==='traveler-encounters'){const react=String(jAttRow(a)[1]),line=`Traveler: ${st.scene.n} human${st.scene.n>1?'s':''} — ${react.split(':')[0]}`;
      st.scene={...st.scene,react};st.text=line}});
  jDayLog();jDone()}
// What the players see of it: the Ref's words (a merchant, travelers and the weather say themselves); without them, “Something is coming…”
const jSayRef=st=>`<div class="jr-say"><span class="small"><b>Players see:</b> ${st.say?`“${esc(st.say)}”`:'“Something is coming…” — no names (monsters have none: show the art)'}</span><button class="btn sm ghost" data-action="jsay" data-k="${esc(st.id)}">${nest(st.say?'Change':'Tell the players what they see')}</button></div>`;
// A place on the road (Rules: POIs, p29). The map's marker decides (owner, 2026-11-16): a dungeon marker — J_DUNGEON: Hexer's
// Dungeons category without its ruins (cave, mine, dungeon entrance, tomb, labyrinth, dragon lair) and the Underdark's spider nest —
// is a delve: Delve into it → the Dungeon with its clock, a day of its own (owner's ruling 2026-11-11). Any other place (ruins, a
// tower, a shrine, a battlefield…) is a Point of Interest (owner, 2026-11-16): the same stage as a dungeon — Dungeon turns and their
// clock (it stops only on Begin combat, comes back only when the Ref says), the end-of-turn steps, combat, loot — but a scene of the
// travel day: encounter checks use the day's EN and the travel tables, no greed (that is for dungeons), and after 3 DTs the Ref is
// asked whether today's walk gets 1 hex shorter. Leaving goes back to the road; the day goes on (no camp).
// Where it lives: the phase is 'delve' (the stage) while the place's stop on the journey is in state 'explore' at the party's hex
// (jPoiScene). The stop is projected to players, so they see the place's name; the dungeon clock the party had before is kept in
// S.dt.was and comes back when they leave.
const J_DUNGEON=['cave','mine','dungeon-entrance','tomb','labyrinth','dragon-lair','spider-nest'];
const jPoiDungeon=p=>!!p&&J_DUNGEON.includes(p.type);
const jStopPoi=st=>{if(!hxHere())return null;const k=st.k||S.journey.script?.path?.[st.i];return k?HX.pois.find(p=>p.k===k&&jPoiKind(p)==='poi')||null:null};
// the place being explored on the road: its stop (state 'explore' at the party's hex), whatever the phase
const jPoiStop=()=>{if(jStep()!=='road')return null;const sc=S.journey?.script;return sc?.stops?.find(x=>x.kind==='poi'&&x.state==='explore'&&(x.i===undefined||x.i===sc.at))||null};
// the Point of Interest scene: the stage, at that place
const jPoiScene=()=>S.phase==='delve'?jPoiStop():null;
const jPoiAtHere=()=>{const sc=S.journey?.script;return sc?.stops?.find(x=>x.kind==='poi'&&x.i===sc.at&&x.state!=='removed')||null};
const jPoiName=()=>jPoiStop()?.text||'the place';
const jPoiLeft=()=>{const sc=S.journey.script;return sc?sc.path.length-1-sc.at:0};
// The verb is the rules' (owner, 2026-11-16): a point of interest is investigated (Rules: POIs, “to not investigate the POI”); only a
// dungeon marker is delved into. No delve is offered at a place that is not a dungeon.
function jPoiCardRef(st,name){const k=esc(st.id),dun=jPoiDungeon(jStopPoi(st)),left=jPoiLeft();
  if(st.state==='explore'){const on=!!jPoiScene(),rest=on&&jPoiRest();
    return `<div class="jr-att" role="group" aria-label="Investigating"><div class="jr-att-h"><b>${rest?'Resting at':'Investigating'} ${name||'the place'}</b><span class="small muted">a Point of Interest · <a href="#rule/r-pois" data-action="open-rule" data-k="r-pois">POIs</a></span></div>
      <p class="jr-att-t" style="font-weight:400">${rest?`The party rests here: DT ${S.dt.n} has ended. The rest is on the Turn screen; when it ends, DT ${S.dt.n+1} begins here.`:on?`Played in Dungeon turns on the Turn screen (DT ${S.dt.n}). Encounter checks use today’s EN (${rtDay().en}). Leaving goes back to the road.`:'The scene is not open: open it to investigate the place in Dungeon turns, or go on.'}</p></div>
    <div class="jr-row" style="margin-top:.4rem">${on?`<button class="btn primary" data-action="tab" data-v="session">Open the scene →</button>${rest?'':`<button class="btn" data-action="jpoileave">Leave ${name||'it'} → the road</button>`}`
      :`<button class="btn primary" data-action="jexhere" data-k="${k}">Investigate ${name||'it'} →</button><button class="btn" data-action="jexdone" data-k="${k}">Done — go on</button>`}${rest?'':`<button class="btn ghost" data-action="jexshort" ${left>0?'':'disabled'}>Today 1 hex shorter${left>0?` · ${left} left`:''}</button>`}</div>`}
  const fam=dun&&jFam(jStopPoi(st));
  return `<p style="margin:0"><b>${name}</b> is on the way${dun?` — a dungeon${fam?`; ${FAMS[fam]} live there`:''}`:' — a point of interest'}.</p><p class="small" style="margin:.3rem 0">${jVotes('explore','yes',dun?'Delve:':'Investigate:')} · ${jVotes('explore','no','Go on:')}</p>
    <div class="jr-row">${dun?`<button class="btn primary" data-action="jexplore" data-k="${k}">Delve into ${name||'it'} →</button>`:`<button class="btn primary" data-action="jexhere" data-k="${k}">Investigate ${name||'it'} →</button>`}<button class="btn" data-action="jstopon" data-k="${k}">Go on</button></div>`}
// The POI stage's hooks (play.js): today's EN, the road encounters waiting at this hex (their own cards: reveal, reactions, a
// merchant to trade with, Begin combat), and after the 3rd DT the question of a shorter day.
stagePoi=jPoiScene;
stageEN=()=>jPoiScene()?rtDay().en:enOf();
poiEncHTML=()=>{const sc=S.journey.script;if(!jPoiScene()||!sc)return '';const l=jHere(sc).filter(x=>x.kind==='enc');
  return l.length?`<div class="st-roadenc">${l.map(st=>{const h=jStopCardRef(st);return h.startsWith('<div class="st-enc')?h:`<div class="st-enc hit now" role="status">${h}</div>`}).join('')}</div>`:''};
poiAskHTML=()=>{const st=jPoiScene();if(!st||S.dt.n<4)return '';const left=jPoiLeft();
  if(st.short>0)return `<p class="small muted st-poisd">Today’s travel is ${st.short} hex${st.short>1?'es':''} shorter · ${left} left today.${left>0?` <button class="linkbtn" data-action="jpoishort">1 hex more</button>`:''}</p>`;
  if(st.short===0||left<1)return '';
  return `<div class="st-enc prep st-prep st-poiask" role="group" aria-label="A shorter day"><div class="st-ench"><b>More than 3 DTs here</b><span class="muted small"><a href="#rule/r-pois" data-action="open-rule" data-k="r-pois">POIs</a> · ${left} hex${left>1?'es':''} left today</span></div>
    <p class="st-encw">Shorten today’s travel by 1 hex?</p><div class="st-acts"><button class="btn" data-action="jpoishort">Shorten today by 1 hex</button><button class="btn ghost" data-action="jpoishort" data-v="no">Keep today’s path</button></div></div>`};
// Into the place's scene: its stop (or a new one at the party's hex, from a door or Move the party) is explored, the clock the party had is
// kept aside (S.dt.was) and this place starts at DT 1, paused. One journal entry: Undo puts the road back.
function jPoiOpen(id,o={}){const sc0=S.journey.script,here=hxHere()&&HX.party||'0,0';
  const st0=id?sc0?.stops.find(x=>x.id===id):null,p=!st0&&scPoi('poi'),name=st0?.text||(p?scLabel(p):'the place');
  const run=()=>{if(!S.journey.script)S.journey={...S.journey,script:{path:[here],at:0,lost:!!S.rtravel.lost,stops:[]}};
    if(jStep()!=='road')S.journey={...S.journey,step:'road',plan:{...(S.journey.plan||{route:[],pace:S.rtravel.pace,by:'',nights:[]}),locked:true}};
    jScriptSet(sc=>{let st=st0&&sc.stops.find(x=>x.id===st0.id);
      if(!st){const k=sc.path[sc.at];st={id:'p'+sc.at+'x'+sc.stops.length,i:sc.at,kind:'poi',state:'shown',text:name,...(hxHere()&&!sc.lost&&k?{k}:{})};sc.stops.push(st)}
      for(const x of sc.stops)if(x.kind==='poi'&&x.state==='explore'&&x!==st)x.state='done';st.state='explore'});
    const t=S.dt,was=t.was||{...t,running:false,left:dtLeft()};delete was.was;
    jDtSet({...was,n:1,running:false,left:was.len*60,end:null,fight:'',held:false,encs:[],was});
    setPhase('delve');if(S.here){S.here='';saveVillages()}};
  if(o.quiet)run();else journalRun(`Into ${name}`,['session','journey'],run);
  Object.assign(S.scene,{miss:null,set:false,pick:false,focus:null});if(!o.quiet){S.area='session';S.tab.session='session';toast(`Investigating ${name}: a point of interest, played in Dungeon turns`);jDone()}}
// S.dt is one object others hold on to: change its fields, not the object
function jDtSet(o){for(const k of Object.keys(S.dt))delete S.dt[k];Object.assign(S.dt,o)}
// Out of the scene, back on the road: the stop is done, the clock the party had before comes back (paused), the phase is Travel.
function jPoiClose(){const st=jPoiStop();if(st)jScriptSet(sc=>{const x=sc.stops.find(y=>y.id===st.id);if(x)x.state='done'});
  if(S.journey.camp?.place==='poi'){S.journey={...S.journey,camp:null};S.rtravel.restChecks=[]} // left while resting (the token moved, a village): the rest is off
  if(S.dt.was)jDtSet({...S.dt.was,running:false,fight:'',held:false});
  if(S.phase==='delve')setPhase('travel');Object.assign(S.scene,{miss:null,set:false,pick:false,focus:null});jDayLog()}
// An encounter check at the place: today's EN and the travel tables (Rules: POIs); a hit waits at this hex as a road encounter
function jPoiCheck(){const T=rtDay(),c=encChecks(1,T.en)[0];S.rtravel.checks=[...jChecks(),c];const n=S.rtravel.checks.length-1;
  if(c.hit&&S.journey.script)jScriptSet(sc=>{jSub(c,sc.path[sc.at]);const st=jEncStop(c,n,sc.at);if(hxHere()&&!sc.lost)st.k=sc.path[st.i];sc.stops.push(st)});jDayLog();return {...c,en:T.en}}
/* ---------- a rest at a point of interest (owner, 2026-11-16; Rules: Resting, Rest Encounters, Miasma) ----------
   Starting a rest ends the current DT, without the encounter check of its end, and stops the clock (Rules p15). The Ref says where
   the party rests: sheltered in the place (no Miasma: an intact keep, walls of stone or metal — Rules p27) or outdoors, in the
   Miasma. It is out in the wilderness during overland travel, so the Ref rolls a rest check on the travel tables (Rules: Rest
   Encounters), at today's EN as every check at a POI (Rules: POIs; Seclude Camp −1). The players rest with the camp's own panel
   (jCampPlayer: activity, food, the wound, Finish; the Mind RR right after a rest in the Miasma), reached from a Rest button in
   their bar while it lasts. When the Ref ends it a new DT begins here, paused until the Ref starts it. The travel day goes on: the
   step stays 'road', no night, no dawn. S.journey.camp holds the rest while it lasts (place 'poi', closed: sheltered), so jRested,
   jRestAt, the rest checks and the Mind RR are the camp's. Who finished it has had a rest that day (Rules: Exhaustion): the place's
   stop keeps them (rest.ids), and the night's camp owes them no exhaustion wound. */
const jPoiRest=()=>jPoiScene()&&S.journey?.camp?.place==='poi'?S.journey.camp:null;
const jRestOpen=()=>jCamping()||!!jPoiRest();
poiResting=()=>!!jPoiRest();
const jPoiRestedToday=c=>(S.journey?.script?.stops||[]).some(x=>x.kind==='poi'&&Array.isArray(x.rest?.ids)&&x.rest.ids.includes(c.id));
const jPoiRestEN=()=>Math.max(1,rtDay().en-(jSeclude()?1:0)); // Seclude Camp: the EN during the rest −1
// why the party can't start a rest here now ('' when it can). After a rest, another one helps only once 3 DTs have passed (Rules p15).
function jPoiRestWhy(){const st=jPoiScene();if(!st)return 'The party is not at a point of interest.';if(jPoiRest())return 'The party is resting already.';
  if(inFight())return 'End the combat first.';const sc=S.journey.script;if(sc&&jHere(sc).some(x=>x.kind==='enc'))return 'Deal with the encounter here first.';
  const r=st.rest,past=r?S.dt.n-r.n+(S.dt.end?1:0):3;if(past<3)return `The party finished a rest here just before DT ${r.n}: another rest gives its benefits once 3 DTs have passed (${3-past} more).`;return ''}
// crows who rested out of the Miasma: their hirelings rest with them (Characters: hirelings follow PC rules) — cruelty and the effects that last until then end
const jHiresRested=()=>{for(const c of PLAY())if(jRested(c)&&c.lastRest!=='miasma')for(const h of c.hires||[]){h.cruelty=0;h.miasma=(h.miasma||[]).filter(n=>!['cruelty','out'].includes((MI_ROWS().find(r=>r.n===n)||{}).dur))}};
const jCrowScopes=()=>PLAY().map(c=>'crow:'+c.id);
function jPoiRestStart(){const why=jPoiRestWhy();if(why)return toast(why);const st=jPoiScene(),name=st.text||'the place',n=S.dt.n,sc=S.journey.script;
  journalRun(`Rest at ${name}`,['session','journey'],()=>{const t=S.dt;Object.assign(t,{running:false,end:null,held:false,fight:''});
    S.rtravel.hmind={};S.rtravel.restChecks=[];
    S.journey={...S.journey,camp:{place:'poi',k:hxHere()&&!sc?.lost&&st.k?st.k:null,poi:name,closed:null,restart:0,base:Object.fromEntries(PLAY().map(c=>[c.id,c.rests||0]))}}});
  Object.assign(S.scene,{miss:null,set:false,pick:false,focus:null});S.area='session';S.tab.session='session';
  toast(`DT ${n} ends: the party rests at ${name}. Say where they rest, then roll the rest check.`);jDone();scrollTo(0,0)}
// the rest is over: a new DT here, paused; the rest's answers (activity, food, Mind RR) are cleared so the night's camp starts fresh
function jPoiRestEnd(){const st=jPoiScene();if(!st||!jPoiRest())return;const name=st.text||'the place',done=PLAY().filter(c=>!crowDead(c)&&jRested(c)).map(c=>c.id);
  journalRun(`Rested at ${name}`,['session','journey',...jCrowScopes()],()=>{jHiresRested();
    PLAY().forEach(c=>DT_END_CONDITIONS.forEach(k=>c.cond.delete(k))); // effects that end with a DT end halfway through a rest (Rules p15)
    const t=S.dt;t.encs=(t.encs||[]).map(e=>({...e,due:true}));Object.assign(t,{n:t.n+1,left:t.len*60,running:false,end:null,fight:'',held:false});
    jScriptSet(sc=>{const x=sc.stops.find(y=>y.id===st.id);if(x)x.rest={n:t.n,ids:[...new Set([...(x.rest?.ids||[]),...done])]};
      for(const y of sc.stops)if(y.kind==='rest'&&['pending','shown'].includes(y.state))y.state='removed'});
    for(const c of PLAY())jRefSet(c.id,{act:'',pick:'',food:'',mind:0,d10:0,lift:'',lifted:false});
    S.journey={...S.journey,camp:null};S.rtravel.restChecks=[];S.rtravel.hmind={}});
  Object.assign(S.scene,{miss:null,set:false,pick:false,focus:null});toast(`The rest is over: DT ${S.dt.n} begins at ${name}, paused — start it when the party goes on.`);jDone();scrollTo(0,0)}
// The Ref's rest at the place: the stage's main card while it lasts (the camp's sections, jCampRef)
function jPoiRestRef(){const st=jPoiScene(),name=esc(st?.text||'the place');
  return `<section class="st-card st-poirest" aria-label="Resting at ${name}"><header class="st-h"><h2>Resting at ${name}</h2><span class="st-tag warn">DT ${S.dt.n} ended · the clock is stopped</span></header>
    <p class="muted st-lead">The rest ends the turn without its encounter check (<a href="#rule/r-resting" data-action="open-rule" data-k="r-resting">Resting</a>). 6 hours, 4 of them asleep; each player finishes their own rest on their Rest screen.</p>
    <div class="jr">${jCampRef()}</div></section>`}
// today's walk loses its last hex; places and overnight marks past the new end go, encounters move to it
function jShorten(){const sc0=S.journey.script;if(!sc0||sc0.path.length-1<=sc0.at)return false;
  jScriptSet(sc=>{sc.path=sc.path.slice(0,-1);const last=sc.path.length-1;for(const st of sc.stops)if(st.i>last){if(['village','poi','night'].includes(st.kind))st.state='removed';else{st.i=last;if(st.k!==undefined)st.k=sc.path[last]}}});return true}
// The stage's Encounter check and the end of the turn's d10, at a POI: the travel day's EN and tables (Rules: POIs)
{const f=A['enc-check'];A['enc-check']=b=>{if(!jPoiScene())return f(b);const c=jPoiCheck();S.scene.miss=c.hit?null:{r:c.r,en:c.en,hit:false};jDone()}}
{const f=A['end-roll'];A['end-roll']=b=>{if(!jPoiScene()||!S.dt.end)return f(b);const c=jPoiCheck();
  // the hit is the road encounter's card now: the end check only records the roll (fought: next-dt does not carry it into the turn)
  S.dt.end.check={r:c.r,en:c.en,hit:c.hit,...(c.hit?{roll:c.roll,text:c.text,table:'travel-encounters',...(c.sub?{sub:c.sub}:{})}:{})};if(c.hit)S.dt.end.fought=true;jDone()}}
let jCtxHTML=(st,c)=>''; // travel.js: what the table needs to know (the land, for Wild Animal and Bad Weather)
function jStopCardRef(st){const c=st.kind==='enc'?jChecks()[st.check]:st.kind==='rest'?(S.rtravel.restChecks||[])[st.check]:null;
  if(st.kind==='enc'||st.kind==='rest'){if(st.state==='pending')return `<div class="jr-warn" style="border-color:var(--line2);background:none">${st.kind==='rest'?'<b>The rest check hits</b> — players see nothing until you reveal it.':'<b>Encounter here</b> — players see “The road stops”.'}<div>${jStopLine(st,true)}</div></div>${jCtxHTML(st,c)}
      <div class="jr-row" style="margin-top:.4rem"><button class="btn primary" data-action="jreveal" data-k="${esc(st.id)}">Reveal</button>${st.kind==='enc'&&!jPoiScene()?`<button class="btn" data-action="jsmove" data-k="${esc(st.id)}" data-v="1" ${st.i>=S.journey.script.path.length-1?'disabled':''}>Later hex</button>`:''}<button class="btn ghost" data-action="jsremove" data-k="${esc(st.id)}">Remove</button></div>`;
    return jEncCardRef(st,c)}
  const name=esc(st.text||'');
  if(st.kind==='village')return `<p style="margin:0"><b>${name}</b> — the party passes a village with hexes left today.</p><p class="small" style="margin:.3rem 0">${jVotes('stay','rest','Rest here:')} · ${jVotes('stay','go','Go on:')}</p>
    <div class="jr-row"><button class="btn primary" data-action="jstoprest" data-k="${esc(st.id)}">Rest here</button><button class="btn" data-action="jstopon" data-k="${esc(st.id)}">Go on</button></div>`;
  if(st.kind==='poi')return jPoiCardRef(st,name);
  return `<p style="margin:0"><b>Overnight${name?' in '+name:''}</b> — the plan stops here for the night.</p><div class="jr-row" style="margin-top:.4rem"><button class="btn primary" data-action="jcamp">Make camp →</button><button class="btn" data-action="jstopon" data-k="${esc(st.id)}">Go on</button></div>`}
// Walk on: the token moves a hex at a time until a stop or the day's end; Skip goes there at once. Local to this device.
let J_WALK=null,J_WALKING=false;
const jLive=()=>{let r=document.getElementById('jr-live');if(!r&&document.body){r=document.createElement('div');r.id='jr-live';r.setAttribute('aria-live','polite');document.body.append(r)}return r};
if(document.body)jLive();else document.addEventListener('DOMContentLoaded',jLive);
const jSay=t=>{const r=jLive();if(r&&r.textContent!==t)r.textContent=t};
const jWalkStop=()=>{if(J_WALK)clearTimeout(J_WALK);J_WALK=null;J_WALKING=false};
const jWalkDone=()=>{const sc=S.journey?.script;return jStep()!=='road'||!sc||jHere(sc).length>0||sc.at>=sc.path.length-1};
function jWalkTick(){J_WALK=null;if(!J_WALKING)return;if(jWalkDone()){J_WALKING=false;return render()}
  const at=S.journey.script.at;A.jstep();if(S.journey.script?.at===at){J_WALKING=false;toast('Walking stopped: the step didn’t go through');return render()}
  {const sc=S.journey.script;jSay(jHere(sc).length?`Stopped at hex ${sc.at}: ${jHere(sc).map(x=>J_KIND[x.kind]||'stop').join(', ')}`:`Walked to hex ${sc.at} of ${sc.path.length-1}`)}
  if(jWalkDone()){J_WALKING=false;render()}else J_WALK=setTimeout(jWalkTick,matchMedia('(prefers-reduced-motion: reduce)').matches?0:700)}
// Strong Miasma (The Ref): a party lost while it lasts, or lost when it strikes, is carried 1d10 hexes the way the Ref picks — once
const jCarryFx=()=>{const i=(S.journey.effects||[]).findIndex(e=>e.kind==='strong'&&e.until>=S.rtravel.day&&!e.carried);return i>=0&&jStep()==='road'&&(S.journey.script?.lost||rtDay().lost)&&hxHere()&&HX.party?i:-1};
const jCarryCard=()=>jCarryFx()<0?'':`<section class="hxsec"><div class="jr-warn" style="margin:0"><b>Strong Miasma, and the party is lost:</b> it is carried 1d10 hexes. Pick the way:<div class="jr-row" style="margin-top:.4rem">${nbs(HX,HX.party).map(n=>`<button class="btn sm" data-action="jcarry" data-v="${Math.round(n.ang)}">${n.dir}</button>`).join('')}</div></div></section>`;
function jRoadRef(){const sc=S.journey.script,last=sc.path.length-1,here=jHere(sc),next=sc.path[sc.at+1];
  const list=sc.path.map((k,i)=>{const st=sc.stops.filter(x=>x.i===i&&x.state!=='removed');const hn=jHexName(k);return i?`<li class="${i<sc.at?'done':i===sc.at?'cur':''}"><b>${i}.</b> ${hn||'hex '+i}${st.map(x=>(x.kind==='village'||x.kind==='poi')&&x.text&&hn===esc(x.text)?(x.state==='done'?' ✓':''):` · <span class="${x.kind==='enc'?'bad':''}">${x.kind==='enc'?esc(x.text||'encounter'):(x.kind==='village'||x.kind==='poi')&&x.text?esc(x.text):J_KIND[x.kind]||'stop'}</span>${x.state==='done'?' ✓':''}`).join('')}</li>`:''}).join('');
  const head=sc.lost||scPoi('village')||scPoi('poi'); // the status line says “On the road · … · hex i of n today” unless the party stands at a place or is lost
  return `${jCarryCard()}<section class="hxsec">${head?`<h3 class="hxh">Hex ${sc.at} of ${last}${sc.lost?' <span class="muted">· lost</span>':''}</h3>`:''}
    ${here.length?here.map(jStopCardRef).join('<hr style="border:0;border-top:1px solid var(--line)">')
     :sc.at<last?(J_WALKING?`<div class="jr-row"><span class="jr-walking">Walking… ${jHexName(sc.path[sc.at])||'hex '+sc.at}</span><button class="btn primary" data-action="jskip" aria-label="Skip to the next stop">Skip ⏭</button></div>`
       :`<div class="jr-row"><button class="btn primary" data-action="jwalk">Walk on →</button><button class="btn" data-action="jstep">Next hex → ${jHexName(next)||'hex '+(sc.at+1)}</button><button class="btn ghost" data-action="jskip">Skip to the next stop</button><button class="btn ghost" data-action="jstophere">Stop here</button></div>`)
     :`<p style="margin:0 0 .4rem">That’s today’s hexes.</p><div class="jr-row"><button class="btn primary" data-action="jcamp">Make camp →</button></div>`}</section>
   <section class="hxsec"><h3 class="hxh">Today’s path</h3><ol class="jr-path">${list||'<li class="small muted">No moving today.</li>'}</ol></section>`}
const jEncCard=st=>`<div class="jr-warn"><b>${st.state==='fight'?'Fight!':st.kind==='rest'?'Encounter at the camp':'Encounter'}</b> ${jSeen(st)}${st.text?'':' <span class="small">The Ref shows you what you see.</span>'}${st.scene?.kind==='merchant'?jMerchantInfo(st.scene,false)+(st.state==='shown'?trOpenHTML(st):''):st.scene?.kind==='touched'&&st.scene.goods&&st.state==='shown'?trOpenHTML(st):''}${st.state==='fight'?`<div class="jr-row" style="margin-top:.4rem"><button class="btn" data-action="tab" data-v="actions">Actions →</button></div>`:''}</div>`;
// what a player may see: on the Ref's own device (one device) the projection, as the Ref's device shares it
const jPub=()=>S.role!=='ref'&&J_TAKEN.has(S.journey)?S.journey:JRS.projectJourney(S.journey);
function jRoadPlayer(){const sc=jPub().script,c=jMe(),x=c?jIn(c):{};if(!sc)return '<p class="muted">On the road.</p>';
  const here=sc.stops.filter(st=>st.state!=='done'),seen=sc.stops.filter(st=>st.state==='done'&&(st.text||['enc','rest'].includes(st.kind)));
  const card=st=>{if(st.state==='pending')return `<p class="jr-warn" style="border-color:var(--line2);background:none"><b>The road stops.</b> The Ref describes what you see.</p>`;
    if(st.kind==='enc'||st.kind==='rest')return jEncCard(st);
    if(st.kind==='village')return `<p style="margin:0"><b>${esc(st.text||'A village')}</b> — rest here tonight, or go on?</p><div class="jr-opts" style="margin-top:.4rem"><button class="opt" data-action="jvote" data-k="stay" data-v="rest" aria-pressed="${x.stay==='rest'}"><b>Rest here</b></button><button class="opt" data-action="jvote" data-k="stay" data-v="go" aria-pressed="${x.stay==='go'}"><b>Go on</b></button></div>`;
    if(st.kind==='poi'&&st.state==='explore')return jPoiRest()?`<p style="margin:0"><b>Resting at ${esc(st.text||'the place')}.</b> DT ${S.dt.n} has ended; when the rest is over a new DT begins here, then the road goes on.</p>${c&&!jRested(c)?'<div class="jr-row" style="margin-top:.4rem"><button class="btn primary" data-action="tab" data-v="rest">Your rest →</button></div>':''}`
      :`<p style="margin:0"><b>Investigating ${esc(st.text||'the place')}.</b> ${S.phase==='delve'?`A point of interest, played in Dungeon turns (DT ${S.dt.n}); then the road goes on.`:'The Ref plays it out with you; then the road goes on.'}</p>`;
    if(st.kind==='poi'){const dun=jPoiDungeon(jStopPoi(st));return `<p style="margin:0"><b>${esc(st.text||'A place')}</b> is on the way. ${dun?'Delve into it?':'Investigate it?'}</p><div class="jr-opts" style="margin-top:.4rem"><button class="opt" data-action="jvote" data-k="explore" data-v="yes" aria-pressed="${x.explore==='yes'}"><b>${dun?'Delve':'Investigate'}</b></button><button class="opt" data-action="jvote" data-k="explore" data-v="no" aria-pressed="${x.explore==='no'}"><b>Go on</b></button></div>`}
    return `<p style="margin:0"><b>Overnight${st.text?' in '+esc(st.text):''}.</b></p>`};
  return `<section class="hxsec">${sc.lost?'<h3 class="hxh">On the road <span class="muted">lost — the Ref knows where you are</span></h3>':''}${here.length?here.map(card).join(''):'<p class="muted" style="margin:0">The party walks on. The Ref moves the token.</p>'}</section>
   ${seen.length?`<section class="hxsec"><h3 class="hxh">Today so far</h3>${seen.map(st=>`<p class="small" style="margin:0 0 .3rem">${jStopLine(st,false)}</p>`).join('')}</section>`:''}`}
const jFighting=()=>!!S.journey?.script?.stops?.some(x=>x.state==='fight');

/* ---------- Camp, Night, Dawn ---------- */
const J_PLACE={outdoor:'Outdoors',ruin:'A ruin',dungeon:'In a dungeon',home:'Your home village',village:'A village',beacon:'Outdoors, inside a beacon’s light',poi:'At a point of interest'};
const jRestAt=()=>{const cp=S.journey.camp||{place:'outdoor'};return JRS.restAt(cp.place,{closed:cp.closed===true})};
// rested at this camp: the crow's rest count went up since the camp began
const jRested=c=>(c.rests||0)>(S.journey.camp?.base?.[c.id]??Infinity);
const jNeedsMind=c=>jRested(c)&&c.lastRest==='miasma'&&(!(c.miasma||[]).some(m=>m.n===MI_NAMES[13])||miDone(c)); // a 13+ from tonight's roll can still be lifted
const jLiftValid=o=>miDone(o)&&o.miLast.k==='fx'||jIn(o).mind===2;
const jMindDone=c=>{const x=jIn(c),o=x.lift&&PARTY.find(p=>p.id===x.lift);return miDone(c)||x.mind===2||x.mind===3&&!!o&&(jIn(o).lifted||jLiftValid(o))};
// lift (Rules: Miasma, tier 3): an ally who rested with you, at tier 1 or 2, not lifted already
const jLiftable=c=>PLAY().filter(o=>o!==c&&jNeedsMind(o)&&!jIn(o).lifted&&(miDone(o)&&o.miLast.k==='fx'||jIn(o).mind===2)&&!PLAY().some(p=>p!==c&&jIn(p).lift===o.id));
const jLiftBy=c=>PARTY.find(p=>p!==c&&jIn(p).lift===c.id);
const jLiftPending=c=>!!jLiftBy(c)&&!jIn(c).lifted&&jLiftValid(c);
// Fight the Miasma (Supporter, safe): an ally named for it gets +1 on their next Mind RR
// Fight the Miasma (Travel Roles): +1 on the ally's next Mind RR — today's, or one carried from a night without a Mind RR
// The Sheet's Mind RR after a rest in the Miasma (app.js miPending), on a journey. At the camp it is the camp panel's: settled once
// the crow's tier is in (jMindDone: tier 2 and 3 live on the trip, not on the crow). A rest in a dungeon the party went into from
// the road still waits for its roll. Any earlier rest's roll was settled when the Ref began the day (“settled at the table”):
// players are not told on the road, or while they explore, that they rested in the Miasma.
function jMindSettled(c){if(jStep()==='off'||!c||c.lastRest!=='miasma')return false;const base=S.journey?.camp?.base?.[c.id];
  if(base===undefined||(c.rests||0)<=base)return true;return jRestOpen()?jMindDone(c)&&!jLiftPending(c):false}
const jFightBonus=c=>(S.journey.fight||[]).includes(c.id)||PLAY().some(o=>o!==c&&jIn(o).task==='fight'&&(jIn(o).targets||[]).includes(c.id));
const J_RCAMP={outdoor:'miasma',ruin:'ruin',village:'village',home:'village'}; // the Travel day tab's camp
// short: the Ref's camp panel, where the place chips and the status line already say where (owner, 2026-11-20): the line starts with the Miasma;
// the rest checks follow right under it there, so the line does not announce them (owner, 2026-11-21)
function jCampLine(o={}){const r=jRestAt(),cp=S.journey.camp||{};
  if(cp.place==='poi'){const nm=esc(cp.poi||'the place');if(cp.closed==null)return `${nm}: the Ref says where you rest — sheltered (no Miasma) or outdoors (in the Miasma); the Ref rolls a rest check.`;
    return `${nm}, ${cp.closed?'sheltered':'outdoors'}: ${r.mind?'in the Miasma — no Effort back, humans make a Mind RR after the rest':'out of the Miasma — Effort back, cruelty clears'}; the Ref rolls a rest check.`}
  const t=`${r.mind?'in the Miasma — no Effort back, humans make a Mind RR tonight':'out of the Miasma — Effort back, cruelty clears'}${r.check?o.short?'':'; the Ref rolls rest checks':'; no rest checks'}${r.food==='home'?'; your home feeds you':r.food==='inn'?'; the inn feeds you for 5 gc':''}.`;
  return o.short?t[0].toUpperCase()+t.slice(1):`${J_PLACE[cp.place]||'Outdoors'}${cp.poi?' · '+esc(cp.poi):''}: ${t}`}
const jSeclude=()=>PLAY().some(c=>jIn(c).act==='seclude');
const jRestDay=()=>{const m={...S.rtravel.mods};if(jSeclude())m.seclude=true;else delete m.seclude;return JRS.dayTotals({...S.rtravel,mods:m},groupSpeed())};
/* ---------- today's role results (Rules: Travel Roles, p24–26) ----------
   What each traveller's task gives today, in the rules' words, and what is still to do about it. The numbers (hexes, EN, checks,
   lost) are in the day from Prepare the day. A Treasure Hunt's find is the Ref's roll on Minor Treasures; a forager's ration and a
   hunter's catch go into the tracker's pack (a hireling's into the loot pool) — the player rolls their own dice and taps the total. Tracking a creature is the Ref's
   to place. Kept per traveller on the trip (gain): "<task>:<rations>:<parts>", ":g" once given. */
const jGain=x=>{const [t,r,p,g]=String(x.gain||'').split(':');return t?{t,r:+r||0,p:+p||0,given:g==='g'}:null};
// rations or animal parts into a crow's pack: onto the stacks they carry, then the first free slots (canPlace decides); what does
// not fit waits in the loot pool with their name
function jGive(c,id,n,why){if(!(n>0)||!IT[id])return 0;const was=ME;ME=c;let left=n;try{
  for(const i of c.inv.filter(x=>x.id===id&&!x.unid&&x.sec!=='hand')){const k=Math.min(left,Math.max(0,(IT[id].stack||1)-i.count));i.count+=k;left-=k;if(!left)break}
  for(let t=0;left>0&&t<20;t++){const at=firstFit(id);if(!at)break;const k=placeNew(id,at.sec,at.idx,{count:left});if(!k)break;left-=k}}finally{ME=was}
  if(left>0)pushPool(id,left,`${c.name}’s ${why}`);return left}
// a traveller by id ("c1" or "c1/<hireling uid>"): whose crow, the hireling if any, and today's answers
const jTrav=id=>jAllIn().find(a=>a.id===id)||null;
// write a traveller's gain: the player on their own crow (or their hireling); the Ref as an entry in the journey
function jGainSet(a,gain){if(S.area==='session'){if(a.h)jHireRef(a.c,a.h.uid,{gain});else jRefSet(a.c.id,{gain})}
  else{const x=jIn(a.c);if(a.h)jMine({hires:{...(x.hires||{}),[a.h.uid]:{...(x.hires?.[a.h.uid]||{}),gain}}});else jMine({gain})}}
// complete: everything rolled; give: into the crow's pack. A hireling's catch goes into the party's loot pool, and the players decide
// who takes it (owner's decision 2026-11-16).
function jGainGive(a,g){const c=a.c,why=a.x.task==='forage'?'forage':'hunt';
  if(a.h){if(g.r>0)pushPool('ration',g.r,`${a.h.name}’s ${why}`);if(g.p>0)pushPool('animal-part',g.p,`${a.h.name}’s hunt`);jGainSet(a,`${g.t}:${g.r}:${g.p}:g`);
    return toast(`${a.h.name} → the loot pool: ${g.r} ration${g.r===1?'':'s'}${g.p?` and ${g.p} animal part${g.p===1?'':'s'}`:''}`)}
  const miss=[jGive(c,'ration',g.r,why),jGive(c,'animal-part',g.p,'hunt')];
  jGainSet(a,`${g.t}:${g.r}:${g.p}:g`);const n=miss[0]+miss[1];
  toast(`${c.name}: ${g.r} ration${g.r===1?'':'s'}${g.p?` and ${g.p} animal part${g.p===1?'':'s'}`:''}${n?` — ${n} didn’t fit and wait in the loot pool`:''}`)}
const jMineTrav=a=>!!a&&S.area!=='session'&&a.c===jMe(); // this device answers for this traveller
// one traveller's result: {a, head, line, st:[class,text], act} or null (no role, left out)
function jResult(a,lost,over){const x=a.x,ref=S.area==='session',k=esc(a.id),me=jMineTrav(a);if(!x.role||x.role==='none'||over.has(a.id))return null;
  const name=x.role==='assist'?'Assist':JRS.TASK_NAMES[x.task];if(!name)return null;const def=x.role==='assist'?J_ASSIST:jTaskDef(x.task),safe=x.role!=='assist'&&!!JRS.ROLES[x.role]?.tasks[x.task]?.safe,tier=x.doom?1:x.tier||0;
  const head=`${esc(name)}${safe?' <span class="muted">safe</span>':tier?` <span class="muted">tier ${tier}${x.doom?' (doom)':''}</span>`:''}`;
  if(!safe&&!tier)return {a,head,line:'No tier yet: it doesn’t count today.',st:['wait','no tier']};
  if(x.role==='guide'&&(x.task==='back')!==!!lost)return {a,head,line:lost?'While lost the guide can only try Back on Track.':'Back on Track is only for a lost group.',st:['wait','not today']};
  const line=rich(safe?def.d:def.o[tier-1]),key=x.role==='assist'||x.role==='supporter'?null:JRS.fxKey(x.task,tier),fx=key?JRS.FX[key]:{};
  const num=['h','en','ren','chk','rchk','lost','found'].some(f=>fx[f]!==undefined);let st=num?['ok','in today’s numbers']:['ok','applies'],act='',extra='';
  const who=ids=>(ids||[]).map(id=>{const o=PARTY.find(c=>c.id===id);return o?jName(o):''}).filter(Boolean).join(', ');
  if(x.role==='assist'){const t=who(x.targets);extra=t?` For ${t}: their test ${fmt(J_SHIFT[tier])}.`:''}
  if(x.task==='fight'){const t=who(x.targets);extra=t?` ${t} gets +1 on the next Mind RR.`:' No ally picked.';st=t?['ok','held']:['wait','no ally']}
  if(x.task==='everyone'){const t=who(x.targets);extra=t?` ${t}: ${fmt(J_SHIFT[tier])} on travel tests today.`:''}
  if(x.task==='places')extra=lost?' Lost or not, places in the hexes the party walks today are found.':' Places on today’s path are found as the party walks.';
  if(key==='shelter3')extra=' Camp: the ruin is offered as the camp’s place.';
  if(x.task==='track'&&tier>=2){const w=x.what?`“${esc(x.what)}”`:'the creature';st=['wait','the Ref places it'];
    extra=tier===2?` ${ref?`Pick the hex 1 off today’s path where ${w} is.`:`The Ref picks the hex where ${w} is.`}`:` ${ref?`You decide when and where ${w} meets the party today.`:`The Ref decides when and where you meet ${w}.`}`}
  if(fx.loot==='treasure'){const g=jGain(x),found=S.rtravel.found?.[a.id];
    if(g?.given){st=['ok','found'];extra=ref&&found?` Found: <b>${esc(found)}</b> — in the loot pool.`:' The find is in the loot pool.'}
    else{st=['wait',ref?'to roll':'the Ref rolls'];if(ref)act=`<button class="btn sm" data-action="jtreasure" data-k="${k}">Roll Minor Treasures for ${a.h?esc(a.h.name):jName(a.c)}</button>`;else extra=' The Ref rolls on Minor Treasures for it.'}}
  if(['forage','hunt2','hunt3'].includes(fx.loot)){const g=jGain(x),need=fx.loot==='hunt3'?2:fx.loot==='hunt2'?1:0,r=g?.r||0,p=g?.p||0,got=fx.loot==='forage'?true:need===1?r>0:r>0&&p>0;
    if(g?.given){st=['ok',a.h?'in the loot pool':'in the pack'];extra=` ${g.r} ration${g.r===1?'':'s'}${g.p?` and ${g.p} animal part${g.p===1?'':'s'}`:''} — ${a.h?'in the loot pool: the party decides who takes it':me?'in your pack':`in ${jName(a.c)}’s pack`}.`}
    else if(me){st=['wait','your roll'];const it=dqGainItem(a),dice=need===2?'rations 3d6, animal parts 1d6':need?'rations 1d6':'';
      act=fx.loot==='forage'?`<button class="btn sm" data-action="jgain" data-k="${k}" data-f="r" data-v="1">${a.h?'Put 1 ration in the loot pool':'Put 1 ration in your pack'}</button>`
        :dqTable()?`<div class="dq-prow"><span class="t">Roll <span class="muted">${dice}</span></span>${got?dqPill('good',`${r} ration${r===1?'':'s'}${p?` · ${p} part${p===1?'':'s'}`:''}`):dqPill('wait','tell the Ref')}</div>`
        :`<div class="jr-gain">${it?.fields?.()||''}${got?`<div class="jr-row" style="margin-top:.4rem"><button class="btn sm" data-action="jgain" data-k="${k}" data-f="give">${a.h?'Put them in the loot pool':'Put them in your pack'}</button></div>`:''}</div>`}
    else if(ref){st=['wait',got?'to give':'their roll'];const it=dqGainItem(a);
      act=fx.loot==='forage'?`<button class="btn sm" data-action="jrgive" data-k="${k}">${a.h?'Put':`Give ${jName(a.c)}`} ${fx.loot==='forage'?1:r} ration${(fx.loot==='forage'?1:r)===1?'':'s'}${p?` and ${p} part${p===1?'':'s'}`:''}${a.h?' in the loot pool':''}</button>`
        :`<div class="jr-gain">${it?.fields?.()||''}${got?`<div class="jr-row" style="margin-top:.4rem"><button class="btn sm" data-action="jrgive" data-k="${k}">${a.h?'Put':`Give ${jName(a.c)}`} ${r} ration${r===1?'':'s'}${p?` and ${p} part${p===1?'':'s'}`:''}${a.h?' in the loot pool':''}</button></div>`:''}</div>`}
    else st=['wait','their roll']}
  return {a,head,line:line+extra,st,act}}
function jResultsHTML(){const lost=S.area==='session'?!!S.rtravel.lost:!!jPub().script?.lost,over=new Set(jOver()),rows=jAllIn().map(a=>jResult(a,lost,over)).filter(Boolean);if(!rows.length)return '';
  const todo=rows.filter(r=>r.st[0]==='wait').length;
  return `<section class="hxsec jr-res"><h3 class="hxh">Today’s role results <span class="muted">${todo?`${todo} to settle`:'all in the day'}</span></h3>${rows.map(r=>`<div class="jr-li"><span class="jr-who">${jWho(r.a.id)}</span><span class="jr-st ${r.st[0]}">${r.st[1]}</span><span class="jr-what"><b>${r.head}</b> — ${r.line}</span>${r.act?`<div class="jr-act">${r.act}</div>`:''}</div>`).join('')}
</section>`}
// Scout for Places (Rules p26): a POI, dungeon or village on a hex the party walks into is found
// Scout for Places works while lost too (owner's decision 2026-11-16): the party really walks these hexes, so a place in one is found.
// Players get the place on their map (its hex alone, as a found place shows) and in the day's log; not the party's hex or path.
function jScoutPlaces(k){if(!S.rtravel.mods?.places||!hxHere()||!k)return;const ps=HX.pois.filter(p=>p.k===k&&!p.found);if(!ps.length)return;
  for(const p of ps){p.found=true;hxDayRec().found.push(scLabel(p))}HX.seen[k]=1;saveHX();toast(`Scout for Places: ${ps.map(scLabel).join(', ')} found`)}

/* ---------- the camp: rest, the night and dawn on one panel (owner's decision 2026-11-16) ----------
   The players rest here (activity, food, the dice they roll, Finish — rfinish is the one rest); who rested in the Miasma makes the
   Mind RR right after. The Ref sees who still owes something and starts the next day with one button; the night's and dawn's rules
   run inside it (A.rnextday's wrapper: exhaustion owed, effects ending, Fight the Miasma carried, hirelings' rest). */
// At a point of interest (jPoiRest) the same panel: where they rest is sheltered or outdoors, one rest check at today's EN, and the
// rest ends in a new DT here (jpoirestend) instead of the next day.
function jCampRef(){const poi=!!jPoiRest(),cp=S.journey.camp||{},T=jRestDay(),r=jRestAt(),sc=S.journey.script,rest=sc?sc.stops.filter(x=>x.kind==='rest'&&!['done','removed'].includes(x.state)):[];
  const places=['outdoor',...(T.ruin?['ruin']:[]),'village','home','dungeon','beacon'],vill=['village','home'].includes(cp.place),owe=jOwed(),D=S.rtravel.day,due=VILLAGES.filter(v=>v.day+1>=20),lostOn=T.lost&&!T.foundEnd;
  // where they rest: the place chips and the chosen place's line in one block (chips.js chipBox; owner, 2026-11-21)
  const closedQ=`<div class="cd-q"><span>Closed off from the Miasma?</span>${cdChips({label:'Closed off from the Miasma?',action:'jclosed',sel:cp.closed===true?'yes':cp.closed===false?'no':null,items:[{v:'yes',label:'Yes, closed'},{v:'no',label:'No, open'}]})}</div>`;
  const ruinRow=`<div class="jr-row"><button class="btn sm" data-action="rruin">Roll if the ruin is inhabited (10%)</button>${S.rtravel.ruinRoll?`<span>d100 <span class="jr-n">${S.rtravel.ruinRoll}</span> ${S.rtravel.ruinRoll<=10?'<b>inhabited</b> — use an encounter table':'empty'}</span>`:''}</div>`;
  const where=poi?`<section class="hxsec"><h3 class="hxh">Where they rest</h3>
    ${chipBox({label:'Where they rest',action:'jclosed',sel:cp.closed===true?'yes':cp.closed===false?'no':null,items:[{v:'yes',label:'Sheltered'},{v:'no',label:'Outdoors'}],
      desc:cp.closed==null?'<p class="muted">Pick one: the players finish their rest once you have and the rest check is in. The Miasma can’t enter indoor areas entirely enclosed in stone or metal.</p>'
        :`<p>${cdName(cp.closed?'Sheltered':'Outdoors')}${cp.closed?'An intact building closed in stone or metal: out of the Miasma — Effort back, cruelty clears.':'In the Miasma — no Effort back, humans make a Mind RR after the rest.'}</p>`})}</section>`
   :`<section class="hxsec" aria-label="Camp">${chipBox({label:'Where the party camps',action:'jplace',sel:cp.place,items:places.map(k=>({v:k,label:esc(J_PLACE[k])})),
      desc:J_PLACE[cp.place]?`<p>${cdName(esc(J_PLACE[cp.place]))}${jCampLine({short:true})}</p>${cp.place==='ruin'?ruinRow:''}${cp.place==='dungeon'?closedQ:''}`:''})}</section>`;
  return `${where}
   <section class="hxsec dq-camp" aria-label="The rest">${dqCampRestHTML()}</section>
   ${jHiresNightRef()}${poi?`<section class="hxsec jr-next"><h3 class="hxh">After the rest <span class="muted">${owe.length?`${owe.length} still owed`:'everyone is done'}</span></h3>
    <ul class="jr-dawn">${owe.map(o=>`<li class="owe">${o}</li>`).join('')||'<li>Everyone has rested and made their Mind RRs.</li>'}</ul>
    <div class="jr-row" style="margin-top:.5rem"><button class="btn${dqResting()?'':' primary'}" data-action="jpoirestend">End the rest · DT ${S.dt.n+1} →</button></div>
    <p class="small muted" style="margin:.4rem 0 0">The travel day goes on: no night or dawn here. DT ${S.dt.n+1} begins at ${esc(cp.poi||'the place')}, paused until you start it. Effects that end with a DT are over. Undo brings the rest back.</p></section>`:`${jResultsHTML()}
   <section class="hxsec jr-next"><h3 class="hxh">Day ${D+1} <span class="muted">${owe.length?`${owe.length} still owed`:'everyone is done'}</span></h3>
    <ul class="jr-dawn">${[...owe.map(o=>`<li class="owe">${o}</li>`),lostOn?'<li>The group is still lost.</li>':T.lost?'<li>The guide finds the way: no longer lost.</li>':'',
      ...PLAY().filter(c=>miDone(c)&&c.miLast.k==='fx').map(c=>`<li>${jName(c)}: ${esc(c.miLast.hit?.n||'')} (Miasma).</li>`),due.length?`<li>Day 20 in ${due.map(v=>esc(v.name)).join(', ')}: close the cycle on Places.</li>`:'',
      jFxNow().some(e=>jFxOver(e,D+1))?`<li>Ends at dawn: ${jFxNow().filter(e=>jFxOver(e,D+1)).map(e=>esc(e.name)).join(', ')}.</li>`:''].filter(Boolean).join('')||'<li>Everyone has rested and made their Mind RRs.</li>'}</ul>
    <div class="jr-row" style="margin-top:.5rem"><button class="btn${dqResting()?'':' primary'}" data-action="jnextday">Start day ${D+1} →</button>${vill?`<button class="btn" data-action="jstayvillage">Stay in ${esc(cp.poi||'the village')}</button>`:''}${sc&&sc.at<sc.path.length-1&&!PLAY().some(jRested)?'<button class="btn ghost" data-action="jbackroad">← Back to the road</button>':''}</div>
    <p class="small muted" style="margin:.4rem 0 0">Night and dawn happen in this one step: Mind RRs ${owe.length?'still owed are settled at the table':'are in'}; who didn’t rest marks an exhaustion wound; effects of today end. Undo brings the camp back.</p></section>`}`}
// a crow who has not finished the rest yet, as their own panel has it (jCampPlayer): waiting for the checks, food to choose, or free to finish
const jRestState=c=>jRestAt().check&&S.journey.camp?.ready!==true?'waits for checks':!jIn(c).food?'no food yet':'can finish';
const jMindState=c=>miDone(c)?(c.miLast.k==='clear'?'Mind RR tier 3':c.miLast.k==='t2'?'Mind RR tier 2':c.miLast.k==='lift'?`tier 3: lifts ${jName(PARTY.find(p=>p.id===c.miLast.to)||{name:'?'})}`:'Mind RR tier 1: '+esc(c.miLast.hit?.n||'')):jIn(c).mind===2?'Mind RR tier 2':jIn(c).mind===3&&jIn(c).lift?`tier 3: lifts ${jName(PARTY.find(p=>p.id===jIn(c).lift)||{name:'?'})}`:jIn(c).mind===3&&jIn(c).lifted?'lifted to tier 3':'Mind RR owed';
// what the camp still owes before the next day (the Ref may start it anyway; then it is settled at the table)
function jOwed(){const out=[],cp=S.journey.camp||{},sc=S.journey.script;
  const poi=!!jPoiRest();if(poi&&cp.closed==null)out.push('Where they rest: sheltered or outdoors.');
  if(jRestAt().check&&!(S.rtravel.restChecks||[]).length)out.push(poi?'The rest check: not rolled yet.':'Rest checks: not rolled yet.');
  if(sc&&sc.stops.some(x=>x.kind==='rest'&&['pending','shown','fight'].includes(x.state)))out.push('A rest encounter is still open.');
  // a crow who rested at a point of interest today has had the day's rest (Rules: Exhaustion): no wound at dawn for this camp
  for(const c of PLAY()){if(crowDead(c))continue;if(!jRested(c)){if(poi)out.push(`<b>${jName(c)}</b> hasn’t finished the rest: no benefits from it.`);else if(!jPoiRestedToday(c))out.push(`<b>${jName(c)}</b> hasn’t finished a rest: an exhaustion wound at dawn.`)}
    else if(jNeedsMind(c)&&(!jMindDone(c)||jLiftPending(c)))out.push(`<b>${jName(c)}</b>: the Mind RR (slept in the Miasma).`)}
  for(const a of jHireNight())if(!hrMindOf(a.h))out.push(`<b>${esc(a.h.name)}</b> (${jName(a.c)}’s hireling): the Mind RR — its player rolls it.`);
  return out}
// the camp's parts (the POI rest screen draws them as one panel, jCampPlayer; the player's Journey one question at a time, travel.js)
function jCampParts(c){const x=jIn(c),cp=S.journey.camp||{},r=jRestAt(),village=['village','home'].includes(cp.place),poi=cp.place==='poi';
  const seclude=PARTY.find(o=>o!==c&&jIn(o).act==='seclude'),rat=c.inv.filter(i=>i.id==='ration').reduce((a,i)=>a+i.count,0),need=c.miasma.some(m=>m.n===MI_NAMES[3])?2:1,lazy=c.miasma.some(m=>m.n===MI_NAMES[9]);
  const enc=(jPub().script?.stops||[]).filter(y=>y.kind==='rest'&&['shown','fight'].includes(y.state)),wait=r.check&&cp.ready!==true;
  const top=`${enc.length?`<section class="hxsec">${enc.map(jEncCard).join('')}</section>`:''}<section class="hxsec">${poi?`<h3 class="hxh">Rest at ${esc(cp.poi||'the place')} <span class="muted">DT ${S.dt.n} has ended</span></h3>`:''}<p class="small" style="margin:0">${jCampLine()}</p></section>`;
  const ctx=dqRest(),acts=restActs(village&&{inn:true},c),R=dqForm(c),table=dqTable(); // in a village no rest checks (Seclude Camp has nothing to lower); the inn's games are the rules' two
  return {x,cp,r,poi,top,ctx,need,rat,
    act:()=>dqActBlockHTML(c,acts,{act:'jact',off:k=>k==='seclude'&&seclude?`${seclude.name.split(' ')[0]} is on it`:''}),
    food:()=>dqFoodBlockHTML(c,ctx||{kind:'camp',place:cp.place},{act:'jfood'}),
    rest:(skip)=>`${restGainsHTML(c,R,lazy,r.where)}${restWoundsHTML(c,lazy)}
    ${dqMyRestHTML(c,ctx,{h:'',skip,wait:wait?(poi&&cp.closed==null?'The Ref says where you rest, then rolls the rest check':'The Ref rolls the rest checks'):'The Ref finishes the rest'})}
    ${table?'':`<div class="jr-row" style="margin-top:.5rem"><button class="btn primary" data-action="jrest"${wait?' disabled':''}>Finish my rest</button>${wait?`<span class="tv-note">${poi&&cp.closed==null?'first the Ref says where you rest, then the rest check: an encounter would interrupt the rest':'after the Ref’s rest checks: an encounter would interrupt the rest'}</span>`:''}</div>`}`,
    done:()=>{const L=c.rlog&&c.rlog.r===(c.rests||0)?c.rlog.l:S.rest.log;return `<section class="hxsec"><h3 class="hxh">Your rest <span class="muted">finished</span></h3>${L?`<ul class="small jr-log">${L.map(l=>`<li>${safeGameHTML(l,true)}</li>`).join('')}</ul>`:'<p style="margin:0">You finished your rest.</p>'}
    ${c.lastRest==='miasma'?'':`<p class="small muted" style="margin:.3rem 0 0">Out of the Miasma: no Mind RR ${poi?'after this rest':'tonight'}.</p>`}</section>${jNeedsMind(c)?jMindHTML(c):''}${hrMindPlayerHTML(c)}
    <section class="hxsec"><p class="small muted" style="margin:0">${poi?`When the Ref ends the rest, DT ${S.dt.n+1} begins here.`:'The Ref starts the next day when the camp is done.'}</p></section>`}}}
function jCampPlayer(){const c=jMe();if(!c)return `<p class="muted">Open your crow to rest.</p>`;if(crowDead(c))return deadNote(c);const P=jCampParts(c);
  if(jRested(c))return P.top+P.done();
  // the activity: chips, a rule, its text and controls (dice.js dqActBlockHTML); its answers on the crow (c.rq) and the trip (act, food)
  return `${P.top}
   <section class="hxsec"><h3 class="hxh">1 · Your activity <span class="muted">one per rest</span></h3>${P.act()}</section>
   <section class="hxsec"><h3 class="hxh">2 · Food <span class="muted">${P.need} ration${P.need>1?'s':''} · you carry ${P.rat}</span></h3>${P.food()}</section>
   <section class="hxsec jr-finish"><h3 class="hxh">3 · Your rest</h3>${P.rest()}</section>`}
// the Mind RR owed after a rest that ended without one (it is made during the rest now: dice.js): a pill at a table, the compact
// entry without a Ref; then its result
function jMindHTML(c){const x=jIn(c),o=x.lift&&PARTY.find(p=>p.id===x.lift);
  const body=miDone(c)?miResultHTML(c,dqTable()?'':'jmundo'):x.mind===2?'<p style="margin:0">Tier 2: the Miasma doesn’t touch you tonight.</p>':x.mind===3&&o?`<p style="margin:0">Tier 3: you lift <b>${jName(o)}</b> a tier.</p>`:miRRHTML(c);
  return `<section class="hxsec"><h3 class="hxh">Your Mind RR <span class="muted">you slept in the Miasma</span></h3>${body}</section>`}
// Exhaustion (Rules p17): who didn't finish a rest at the last camp marks a wound; the Ref's device lists them (journey.tired),
// the player's device remembers it was marked (ctk-jexh)
const jTiredKey=c=>`${c.id}:${jPub().day}`;
const jTiredOwed=c=>!!c&&!crowDead(c)&&(jPub().tired||[]).includes(c.id)&&store.get('jexh')!==jTiredKey(c)&&S.jExhausted!==jTiredKey(c);
function jTiredCard(){const c=jMe();if(S.area==='session'||!jTiredOwed(c))return '';
  return `<section class="hxsec"><div class="jr-warn" style="margin:0"><b>Day ${jPub().day-1}: you didn’t finish a rest.</b> Each day without one gives an <a href="#rule/r-exhaustion" data-action="open-rule" data-k="r-exhaustion">exhaustion wound</a>; it goes when you finish a rest.
    <div class="jr-row" style="margin-top:.4rem"><button class="btn primary" data-action="jexhaust">Mark the exhaustion wound</button></div></div></section>`}
/* ---------- My crow: what the road asks of the player beyond the vitals strip above (Stamina, AD, wounds, Effort, light live there) ---------- */
function jMyCrow(){const c=jMe();if(!c||S.area==='session')return '';const rat=c.inv.filter(i=>i.id==='ration').reduce((a,i)=>a+i.count,0);
  const chip=(label,val,tab,bad)=>`<button class="jr-chip${bad?' bad':''}" data-action="tab" data-v="${tab}" aria-label="${label} ${val}, open ${tab==='sheet'?'Sheet':'Inventory'}"><span>${label}</span> <b>${val}</b></button>`;
  return `<div class="jr-me" role="group" aria-label="My crow on the road">${chip('Rations',rat,'inventory',!rat)}${c.cruelty?chip('Cruelty',c.cruelty,'sheet',true):''}</div>`}

/* ---------- the tab ---------- */
function jOff(){if(S.area!=='session')return `<section class="hxsec"><h3 class="hxh">Journey</h3><p class="muted" style="margin:0">The Ref starts the journey. Then the day’s steps show here: route and roles, the road, camp and night.</p></section>`;
  const v=VILLAGES.find(x=>x.id===S.here);
  if(v&&S.phase==='village')return jDoorHTML({sc:'vil',ico:'village',k:'Village',name:v.name,text:'',pri:`Set out from ${v.name} →`,act:'jstart'},{goOn:false});
  return `<section class="hxsec"><h3 class="hxh">Journey <span class="muted">day ${S.rtravel.day}</span></h3><p style="margin:0 0 .6rem">Start the day: players then plan the route, vote on the pace and choose their roles here.</p>
   <div class="jr-row"><button class="btn primary" data-action="jstart">${v?`Set out from ${esc(v.name)}`:'Set out'} →</button></div>
</section>`}
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
  // at a table: what to roll and one pill per weather; the Ref enters the tier and rolls the damage or the mold (dice.js)
  if(dqTable()){const ws=jWxTests().filter(w=>!(w.n==='Heat Wave'&&walked<=2)&&!(/rations/.test(w.when)&&!rat&&!jWxGot(x,w.n)));if(!ws.length)return '';
    return `<section class="hxsec"><h3 class="hxh">Weather</h3>${ws.map(w=>J_COLD.includes(w.n)&&c.inv.some(i=>i.id==='cold-weather-gear')?`<div class="dq-prow"><span class="t">${esc(w.n)}</span>${dqPill('good','cold weather gear')}</div>`:dqWxPillHTML(c,w,c.ch[w.ch]-(J_COLD.includes(w.n)?2*dqWxParse(jWxGot(x,w.n)).filter(e=>e.t).length:0))).join('')}</section>`}
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
       :`<h4 class="jr-h">Rations lost <span class="muted">roll it · you carry ${rat}</span></h4><div class="dq-line"><span class="dq-num" role="group" aria-label="Rations lost to mold"><input type="text" inputmode="numeric" id="jmold-${esc(w.n.replace(/ /g,'-'))}" placeholder="–" aria-label="Rations lost to mold" style="width:4rem"></span><button class="btn" data-action="jmoldin" data-k="${esc(w.n)}" data-lo="${mold.lo}" data-hi="${mold.hi}">Lose them</button></div>`)
       :lost!=null?`<p class="small" style="margin:.4rem 0 0">Lost ${lost} ration${+lost===1?'':'s'} to mold.</p>`:t&&/dam/.test(w.tiers[t-1])?`<p class="small" style="margin:.4rem 0 0">Roll the damage and mark it on your <button class="btn sm ghost" data-action="tab" data-v="sheet">Sheet</button>.</p>`:''}</section>`}).join('')}

// over on `day`: Bad Weather lasts 24 hours from the day it strikes (The Ref: Bad Weather), so it ends at the next dawn (owner,
// 2026-11-22: it never ended by itself); the others last through their `until` day
const jFxOver=(e,day)=>e.kind==='weather'?e.until<=day:e.until<day;
const jFxNow=()=>(S.journey?.effects||[]).filter(e=>!jFxOver(e,S.rtravel.day));
function jEffects(){const fx=jFxNow();if(!fx.length||jStep()==='off')return '';
  return `<div class="jr-fx">${fx.map((e,i)=>`<p class="jr-warn"><b>${esc(e.name)}</b> · ${e.kind==='weather'?'until dawn':`until day ${e.until}`}${e.kind==='strong'?': a bane on Mind RRs and on guide, scout and tracker tests':jWxLine(e.name)}${J_COLD.includes(e.name)?` · ${+e.hours||0} hour${+e.hours===1?'':'s'} outside so far`:''}${S.area==='session'?`${J_COLD.includes(e.name)&&e.until-1===S.rtravel.day?` <button class="btn sm" data-action="jhour" data-v="${i}">An hour outside passes</button>${+e.hours>0?` <button class="btn sm ghost" data-action="jhour" data-v="${i}" data-d="-1" aria-label="Take back an hour">−1 hour</button>`:''}`:''} <button class="btn sm ghost" data-action="jendfx" data-v="${i}">End</button>`:''}</p>`).join('')}</div>`}
function jPanel(o={}){const st=jStep(),ref=S.area==='session';
  const body=st==='off'?jOff():st==='plan'?(ref?jPlanRef():jPlanPlayer()):st==='roles'?(ref?jRolesRef():jRolesPlayer())
    :st==='script'?(ref&&S.journey.script?jScriptRef():ref?`<section class="hxsec"><p>No script yet.</p><button class="btn primary" data-action="jprep">Prepare the day →</button></section>`:`<section class="hxsec"><h3 class="hxh">The Ref is preparing the day</h3><p class="muted" style="margin:0">Checks, the path and what waits on it. The road starts in a moment.</p></section><section class="hxsec"><h3 class="hxh">Today</h3>${jKpis(jTotals())}</section>`)
    :st==='road'?(ref&&S.journey.script?jRoadRef():jRoadPlayer())
    :ref?jCampRef():jCampPlayer(); // camp, and the night and dawn of older saves: one panel
  const res=['script','road'].includes(st)||jCamping()&&!ref?jResultsHTML():''; // the Ref's camp places it itself
  const door=ref?jDoor():null;
  // the door is the panel's one primary action while it stands: the day's own next step steps back to secondary
  const main=door?body.replace(/class="btn primary"/g,'class="btn"'):body;
  return `<div class="jr">${st==='off'||o.rail===false?'':jRail()}${door?jDoorHTML(door):''}${ref?jRoadCombatRef()+dqAsksRefHTML():jTiredCard()}${jMyCrow()}${jEffects()}${main}${res}${st==='roles'&&!ref?jHireTests():''}${st==='plan'&&!ref?jHireRoles()+jHiresPlayer():''}${ref?dqWxRefHTML():jWxPlayer()}</div>`}
SCREENS.journey=()=>{if(!S.jOpened){S.jOpened=true;S.hx.panel=true}
  if(S.area==='session')return SCREENS.rmap(); // the Ref's Journey is the Map now (NAV_ALIAS); a link that still names it lands there
  const panel=jPanel(),off=jStep()==='off';
  if(!off&&myPub())return SCREENS.map(panel);
  return `<div class="box jr-plain">${panel}</div>`};
// after a render of the step panel: the current step in view on a scrolling rail, the tracker's field keeps its caret
function jAfterPanel(){const rail=$('.jr-rail'),cur=rail?.querySelector('.cur');if(cur&&rail.scrollWidth>rail.clientWidth)rail.scrollLeft=cur.offsetLeft-(rail.clientWidth-cur.offsetWidth)/2;const w=$('#jwhat');if(w&&S.jFocus){w.focus();w.setSelectionRange(w.value.length,w.value.length)}}
AFTER.journey=()=>{jAfterPanel();if(!$('.hxstage'))return;(S.area==='session'?AFTER.rmap:AFTER.map)()};
{const f=AFTER.rmap;AFTER.rmap=()=>{jAfterPanel();f()}}
/* ---------- the Ref's Map (variant B, owner's pick 2026-11-14): one screen for the travel day and the map ----------
   hexmap.js draws the map; this gives it the day: a title for the strip across the top, the steps (jRail) and the current step's
   panel (jPanel without its rail). In a dungeon the steps wait: the panel only says how the day goes on. */
function jMapDay(){const st=jStep(),R=S.rtravel,v=VILLAGES.find(x=>x.id===S.here),ico=d=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  // .dup: the status line says the same (place, day, pace); the head then shows only in full screen, which covers the line
  const t=(b,sm,i='',dup=true)=>`<span class="hxday-t${dup?' dup':''}">${i}<b>${b}</b><small>${sm}</small></span>`;
  if(jPoiScene()){const n=esc(jPoiName());return {head:t(n,`day ${R.day} · a point of interest · ${jPoiRest()?`resting, DT ${S.dt.n} ended`:`DT ${S.dt.n}`}`,ico(VICON.session)),rail:jRail(),panel:jPanel({rail:false})}}
  if(S.phase==='delve'){const ex=jExploring(),n=esc(ex?jExploreName():'');
    return {head:t(ex?n:'In a dungeon',`day ${R.day}${ex?' · explored from the road':''}`,ico(VICON.session)),rail:ex?jRail():'',
      panel:`<div class="jr"><section class="hxsec"><h3 class="hxh">${ex?`Exploring ${n}`:'In the dungeon'}</h3><p class="small muted" style="margin:0">${ex?`The delve is a day of its own. Leave it on the Turn screen: day ${R.day} ends with a camp here, then the steps go on.`:'When the party comes out, the travel day starts at Plan.'}</p>${ex?'':jSceneDoorBtn('travel','Leave the dungeon → the road','')}</section></div>`}}
  if(st==='off')return {head:S.phase==='village'?t(v?esc(v.name):'In a village',`day ${R.day} · the party is in the village`,ico(VICON.village)):t(`Day ${R.day}`,'no journey running','',!!S.phase),rail:'',panel:jPanel()};
  return {head:t(`Day ${R.day}`,`${PACE[jPace()]?.label||''} · moved ${R.moved||0}/${hxDayHexes()} hex${hxDayHexes()===1?'':'es'}`),rail:jRail(),panel:jPanel({rail:false})}}

/* ---------- actions ---------- */
// A player's answer: on their own crow, for today; a new day starts from a clean sheet but keeps the route proposal.
function jMine(patch){const c=jMe();if(!c){toast('Open your crow first');return null}const day=jDay(),t=c.trip||{};
  const base=t.day===day?t:{...(t.route?{route:t.route,at:t.at}:{}),...(t.ride?{ride:t.ride}:{}),day},n=(t.day===day?t.n||0:0)+1,nk={...(t.day===day&&t.nk||{})}; // how the crow travels carries over to the next day
  for(const k of Object.keys(patch))if(!['day','n','nk','route','at'].includes(k))nk[k]=n; // when each answer was given (journey-rules inputsFor)
  const next={...base,...patch,day,n,nk};
  for(const k of Object.keys(next))if(next[k]===undefined)delete next[k];c.trip=next;return next}
// The Ref's entry for a crow: in the journey (never in a player's crow), for today.
// the Ref's entry for a hireling: the crow's hireling answers with that one changed (a Ref entry for the crow)
const jHireRef=(c,uid,patch)=>{const hs={...(jIn(c).hires||{})};hs[uid]={...(hs[uid]||{}),...patch};jRefSet(c.id,{hires:hs})};
function jRefSet(id,patch){const day=jDay(),cur=S.journey.inputs?.[id],c=PARTY.find(x=>x.id===id),own=c?.trip?.day===day?c.trip:{},n=own.n||0,base=cur&&cur.day===day?{...cur}:{day};
  // an older entry the player has answered over since: the player's newer answers stay theirs, only this entry is the Ref's
  if((base.n||0)!==n)for(const k of Object.keys(own))if(!['day','n','nk'].includes(k)&&JRS.answeredAt(own,k)>(base.n||0))delete base[k];
  S.journey.inputs={...(S.journey.inputs||{}),[id]:{...base,...patch,day,n}}}
// Rest encounters (Rules): an encounter interrupts the rest, so the crows rest once the Ref's rest checks are in and every
// hit is dealt with; the Ref's device keeps that in camp.ready (players don't see the checks)
function jCampReady(){const cp=S.journey.camp,poi=!!jPoiRest();if(S.role!=='ref'||jStep()!=='camp'&&!poi||!cp)return;const sc=S.journey.script,open=!!sc&&sc.stops.some(x=>x.kind==='rest'&&['pending','shown','fight'].includes(x.state));
  // at a point of interest the Ref says first where they rest (sheltered or in the Miasma)
  // a fight on the tracker interrupts it too (an Undo of Combat ended brings one back while its stop stays met)
  const ready=(!jRestAt().check||(S.rtravel.restChecks||[]).length>0&&!open&&!inFight())&&(!poi||cp.closed!=null);if(cp.ready!==ready)S.journey={...S.journey,camp:{...cp,ready}}}
const jDone=()=>{jCampReady();jSave();render()};
// every render on the Ref's device: the fight of a rest encounter ended on the Combat screen (st-endfight → jCombatOver), an Undo,
// a player's update — none of them passed through jDone, so camp.ready stayed false and the players' Finish my rest stayed shut
syncDerived=()=>{if(S.role!=='ref'||!S.journey?.camp)return;const was=S.journey.camp.ready;jCampReady();if(S.journey.camp?.ready!==was)jSave()};
// a spent Effort comes back when the result it raised is changed
const jRefund=(c,x)=>{if(x.effort&&c.trip?.effort){c.effort=Math.min(effMax(c),(c.effort||0)+1)}};
function jCampStart(place,k=null,poi=''){if(S.rtravel)S.rtravel.hmind={};S.journey={...S.journey,camp:{place,k,poi,closed:null,restart:0,base:Object.fromEntries(PLAY().map(c=>[c.id,c.rests||0]))}};S.rtravel.camp=J_RCAMP[place]||null;S.rtravel.restChecks=[]}
const jArrive=()=>{const sc=S.journey.script;if(!sc)return;if(sc.stops.some(x=>x.i===sc.at&&x.kind!=='enc'&&x.state==='pending'))jScriptSet(x=>{for(const st of x.stops)if(st.i===x.at&&st.kind!=='enc'&&st.state==='pending')st.state='shown'})};
const jClean=s=>String(s||'').replace(/\u0000/g,'').replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g,'').slice(0,200);
Object.assign(A,{
  jstart:()=>{const from=S.here||scSheet(scPoi('village'))?.id||'';setPhase('travel');S.journey={...S.journey,step:'plan',day:S.rtravel.day,from,plan:null,inputs:{},script:null,camp:null};if(S.here){S.here='';saveVillages()}jDone()},
  jcancel:()=>{const v=VILLAGES.find(x=>x.id===S.journey.from);askYes('Cancel the departure?',`The party stays${v?' in '+v.name:''}. The players’ answers for today stay on their crows.`,'Cancel the departure',
    ()=>{S.here=S.journey.from||S.here;S.journey={...S.journey,step:'off',plan:null,inputs:{},script:null,camp:null};setPhase('village');jDone()})},
  jseason:b=>{S.journey.season=S.journey.season===b.dataset.v?null:b.dataset.v;jDone()},
  jlock:()=>{const xs=PLAY().map(c=>jIn(c)),route=hxHere()?[...HX.route]:[];
    S.journey={...S.journey,day:S.rtravel.day,step:'roles',plan:{route,pace:S.rtravel.pace,by:hxHere()?(HX.routeBy||''):'',nights:[...new Set(xs.flatMap(x=>x.nights||[]))].filter(k=>route.includes(k)),locked:true}};jDone()},
  jstay:()=>{const k=hxHere()&&HX.party||'0,0',home=!S.rtravel.moved&&VILLAGES.find(v=>v.id===S.journey.from),p=hxHere()&&!S.rtravel.lost&&HX.party?jPoiAt(HX.party):null,vp=p&&jPoiKind(p)==='village'?p:null;
    S.journey={...S.journey,day:S.rtravel.day,step:'camp',plan:{route:[],pace:S.rtravel.pace,by:'',nights:[],locked:true},script:{path:[k],at:0,lost:!!S.rtravel.lost,stops:[]}};
    if(home||vp)jCampStart(home&&home.home?'home':'village',hxHere()&&!S.rtravel.lost?k:null,home?home.name:vp.label||'');else jCampStart('outdoor');jDone()},
  jbackplan:()=>{S.journey={...S.journey,step:'plan',plan:S.journey.plan?{...S.journey.plan,locked:false}:null};jDone()},
  jprep:b=>{const road=b?.dataset?.v==='road',go=()=>{const lost=!!S.rtravel.lost,route=Object.fromEntries(JRS.ROUTE_KEYS.filter(k=>S.rtravel.mods?.[k]).map(k=>[k,true]));
      const over=new Set(jOver()),wx=Object.fromEntries(jFxNow().filter(e=>e.kind==='weather'&&JRS.WEATHER_FX[e.name]).map(e=>[JRS.WEATHER_FX[e.name],true]));S.rtravel.mods={...route,...wx,...JRS.modsFromInputs(jModsIn(),{lost})};if(S.journey.plan?.pace)S.rtravel.pace=S.journey.plan.pace;S.journey={...S.journey,step:road?'road':'script',script:jScript()};if(road)jArrive();jDayLog();if(typeof hxPublish==='function')hxPublish();jDone()};
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
  jstep:()=>{const sc=S.journey.script,k=sc.path[sc.at+1];if(!k)return;if(hxHere()&&HX.party){if(!sc.lost&&HX.route[0]===k)HX.route.shift();hxMove(k,true);jScoutPlaces(k)}else S.rtravel.moved=(S.rtravel.moved||0)+1;
    jScriptSet(x=>{x.at++});jArrive();jDone()},
  jreveal:b=>{let shown;jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st){st.state='shown';const c=(st.kind==='rest'?S.rtravel.restChecks:jChecks())[st.check],say=J_SAY[c?.text];if(say&&!st.say)st.say=say;
      // what it is doing: the Ref's roll on its table, first on the card (travelers roll theirs with the travelers)
      const def=J_ATT[c?.text];if(def&&c.text!=='Traveler'&&!st.att){const a=jAttRoll(def[0]);if(a)st.att=a}
      shown=JSON.parse(JSON.stringify(st))}});
    if(shown){const c=(shown.kind==='rest'?S.rtravel.restChecks:jChecks())[shown.check],day=S.rtravel.day,fx=S.journey.effects||[];
      if(c?.text==='Strong Miasma'&&!fx.some(e=>e.kind==='strong'))S.journey={...S.journey,effects:[...fx,{kind:'strong',name:'Strong Miasma',until:day+1}]};
      if(c?.text==='Bad Weather'){const k=S.journey.script.path[shown.i],place=hxHere()&&k&&HX.t[k]?JRS.placeOf(HX.t[k]):null,group=JRS.weatherGroup(place?.climate||S.rtravel.climate||'temperate',S.journey.season),
        rows=(BOOK['ref-bad-weather']?.body||[]).find(x=>x.tb)?.tb?.slice(1),die=d(6),w=group?JRS.weatherFor(rows,group,die):null;
        S.journey={...S.journey,effects:[...(S.journey.effects||[]),{kind:'weather',name:w||'Bad Weather',until:day+1}]};
        jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===shown.id);st.text=w?`Bad Weather: ${w}`:'Bad Weather — pick it by climate or season';st.say=w?`Bad Weather: ${w}`:'Bad Weather';});
        toast(w?`Bad Weather: ${w} (d6 ${die}, ${group})`:'Bad Weather: set the season (Plan) or pick the weather')}}
    jDone()},
  jexhaust:()=>{const c=jMe();if(!c)return;ME=c;S.jExhausted=jTiredKey(c);store.set('jexh',S.jExhausted);S.pendingWounds+=1;S.pendingWoundType='exhaustion';S.tab.crow='inventory';render()},
  jendfx:b=>{S.journey={...S.journey,effects:(S.journey.effects||[]).filter((e,i)=>i!==+b.dataset.v)};jDone()},
  jfollow:b=>{const st=S.journey.script.stops.find(x=>x.id===b.dataset.k),c=st&&(st.kind==='rest'?S.rtravel.restChecks:jChecks())[st.check];if(!c?.sub)return;const x=rollTable(c.sub),txt=String(x.row[1]).replace(/<[^>]*>/g,''),next=Object.values(TB).find(t=>t.id!==c.sub&&(t.title===txt||t.title===txt.replace(' Dungeon ',' ')));
    if(next){c.via=[...(c.via||[]),txt];c.sub=next.id}else{c.src=x.row[1];c.html=/-animal-encounters$/.test(c.sub)?jAnimalText(x.row[1]):encounterText(x.row[1])}
    jScriptSet(sc=>{const s2=sc.stops.find(y=>y.id===st.id);s2.text=`${c.text}: ${[...(c.via||[]),...(next?[]:[txt])].join(' → ')}`.slice(0,1000)});jDone()},
  // Monster from Nearby: the family of the closest dungeon (jNearHTML) — remembered on that place, then its table is rolled
  jnear:b=>{const st=S.journey.script.stops.find(x=>x.id===b.dataset.k),c=st&&(st.kind==='rest'?S.rtravel.restChecks||[]:jChecks())[st.check],f=b.dataset.v;if(!c||!FAMS[f]||c.html)return;
    const n=jNearDungeon(jStopHex(st));if(n)jFamKeep(n.p,f);
    c.sub=f+'-encounters';c.via=[`${FAMS[f]} Dungeon Encounters`];A.jfollow(b)},
  // Begin combat on the road: the encounter's creatures join the tracker (one journal entry) and the Table opens the combat.
  // No dungeon clock to stop here. With nothing listed, the combat opens with the creature picker.
  jfight:b=>{const st=S.journey.script.stops.find(x=>x.id===b.dataset.k);if(!st)return;const c=(st.kind==='rest'?S.rtravel.restChecks||[]:jChecks())[st.check],mons=jEncMons(st,c);
    if(!mons.length&&!S.combat.length)return toast('No creatures yet: roll them on the card, or add them first'); // never an empty combat
    journalRun('Combat began',['session'],()=>{for(const x of mons)addMonster(x.id,x.n);pauseForFight();S.dt.fight='on'}); // creatures already prepared join too; at a POI the clock stops
    jScriptSet(sc=>{const s2=sc.stops.find(x=>x.id===st.id);if(s2)s2.state='fight'});
    Object.assign(S.scene,{pick:!S.combat.length,focus:null});S.tab.session='session';jDone();scrollTo(0,0)},
  jresolve:b=>{const fought=S.journey.script.stops.find(x=>x.id===b.dataset.k)?.state==='fight';jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st)st.state='done'});jDayLog();jDone();
    const end=()=>{journalRun('Combat ended',['session'],()=>{S.combat=[];S.dt.fight=''});render()};
    if(fought&&S.combat.length)askYes('Clear the combat tracker?',`${S.combat.length} monster${S.combat.length>1?'s are':' is'} still on it.`,'Clear it',end,true);else if(fought&&inFight())end()},
  jstopon:b=>{jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st)st.state='done'});jDone()},
  jstoprest:b=>{jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st)st.state='done'});S.journey={...S.journey,step:'camp'};jCampStart('village',hxHere()?S.journey.script.path[S.journey.script.at]:null,S.journey.script.stops.find(x=>x.id===b.dataset.k)?.text||'');jDone()},
  jexplore:b=>{jWalkStop();jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st)st.state='done'});S.journey={...S.journey,camp:{place:'dungeon',k:null,poi:'',closed:null,restart:0,base:Object.fromEntries(PLAY().map(c=>[c.id,c.rests||0]))}};setPhase('delve');S.tab.session='session';toast('Into the dungeon. The delve is a day of its own: when you leave, the party camps by it.');jDone()},
  // a place that is not a dungeon: the Point of Interest scene (jPoiOpen); Done — go on / Leave: back to the road
  jexhere:b=>{if(inFight())return toast('End the combat first');jWalkStop();jPoiOpen(b.dataset.k)},
  jexdone:b=>{if(jPoiScene())return A.jpoileave();jScriptSet(sc=>{const st=sc.stops.find(x=>x.id===b.dataset.k);if(st)st.state='done'});jDayLog();jDone()},
  jpoileave:()=>{if(!jPoiStop())return;if(S.dt.fight==='on')return toast('End the combat first');if(jPoiRest())return toast(`The party is resting: end the rest first (DT ${S.dt.n+1})`);const name=jPoiName();
    journalRun(`Left ${name}`,['session','journey'],()=>jPoiClose());S.tab.session='rmap';toast(`Back on the road: day ${S.rtravel.day} goes on`);jDone()},
  // a rest at the point of interest (Rules: Resting): the DT ends, the clock stops; End the rest → a new DT here, paused
  jpoirest:()=>jPoiRestStart(),
  jpoirestend:()=>{const cp=jPoiRest();if(!cp)return;if(inFight())return toast('End the combat first');const owe=jOwed(),n=S.dt.n+1;if(!owe.length)return jPoiRestEnd();
    askYes(`End the rest and start DT ${n}?`,`Still owed: ${owe.map(o=>o.replace(/<[^>]*>/g,'')).join(' ')} A Mind RR not entered is settled at the table.`,`End the rest · DT ${n}`,()=>jPoiRestEnd(),true)},
  // an encounter check while exploring: today's EN, here (Rules: POIs)
  jexcheck:()=>{const c=jPoiCheck();toast(c.hit?`d10 ${c.r} ≤ EN ${rtDay().en}: an encounter here`:`d10 ${c.r} > EN ${rtDay().en}: quiet`);jDone()},
  // more than 3 DTs at a place: the Ref can make today's walk 1 or more hexes shorter (Rules: POIs); stops past the new end move to it
  jexshort:()=>{if(!jShorten())return;const st=jPoiStop();if(st)jScriptSet(sc=>{const x=sc.stops.find(y=>y.id===st.id);if(x)x.short=(x.short||0)+1});const left=jPoiLeft();toast(`Today’s walk is 1 hex shorter: ${left} hex${left===1?'':'es'} left`);jDone()},
  // the question after the 3rd DT at a POI: yes (one hex, as Today 1 hex shorter) or no (asked no more here)
  jpoishort:b=>{const st=jPoiStop();if(!st)return;if(b?.dataset?.v==='no'){jScriptSet(sc=>{const x=sc.stops.find(y=>y.id===st.id);if(x)x.short=0});return jDone()}A.jexshort()},
  jstophere:()=>{const sc=S.journey.script,n=sc.path.length-1-sc.at;askYes('Stop here for the night?',`${n} hex${n>1?'es':''} of today’s path ${n>1?'are':'is'} left.`,'Make camp',()=>A.jcamp())},
  jbackroad:()=>{S.journey={...S.journey,step:'road',camp:null};S.rtravel.camp=null;S.rtravel.restChecks=[];if(S.journey.script)jScriptSet(x=>{for(const y of x.stops)if(y.kind==='rest')y.state='removed'});jDone()},
  jcamp:()=>{const sc=S.journey.script,k=sc?.path[sc.at],p=k&&jPoiAt(k);S.journey={...S.journey,step:'camp'};jCampStart(p&&jPoiKind(p)==='village'?'village':rtDay().ruin?'ruin':'outdoor',hxHere()&&!sc?.lost?k||null:null,p?(p.label||''):'');jDone()},
  // Camp
  jplace:b=>{const cp=S.journey.camp||{};S.journey={...S.journey,camp:{...cp,place:b.dataset.v,closed:b.dataset.v==='dungeon'?cp.closed??null:null}};S.rtravel.camp=J_RCAMP[b.dataset.v]||null;jDone()},
  jclosed:b=>{S.journey={...S.journey,camp:{...S.journey.camp,closed:b.dataset.v==='yes'}};jDone()},
  jrestcheck:()=>{if(S.dq?.open==='ref|check')S.dq.open=null; // opened for Roll now anyway: rolled, the line goes to Done (a hit opens it by itself)
    const sec=jSeclude();if(jPoiRest())S.rtravel.restChecks=encChecks(1,jPoiRestEN()); // at a point of interest: one check at today's EN (Rules: POIs)
    else{if(sec)S.rtravel.mods={...S.rtravel.mods,seclude:true};else if(S.rtravel.mods?.seclude){const m={...S.rtravel.mods};delete m.seclude;S.rtravel.mods=m}
    A.rrest()}const sc0=S.journey.script;(S.rtravel.restChecks||[]).forEach(c=>jSub(c,sc0?.path[sc0.at]||HX?.party));const sc=S.journey.script;if(sc)jScriptSet(x=>{x.stops=x.stops.filter(y=>y.kind!=='rest');(S.rtravel.restChecks||[]).forEach((c,n)=>{if(c.hit)x.stops.push({id:'r'+n,i:x.at,kind:'rest',state:'pending',check:n,text:c.text||'',...(c.sub?{table:c.sub}:{}),...(hxHere()&&!x.lost?{k:x.path[x.at]}:{})})})});jDayLog();jDone()},
  jrestart:()=>{const cp=S.journey.camp;S.rtravel.hmind={};S.journey={...S.journey,camp:{...cp,restart:(cp.restart||0)+1,base:Object.fromEntries(PLAY().map(c=>[c.id,c.rests||0]))}};S.rtravel.restChecks=[];
    if(S.journey.script)jScriptSet(x=>{for(const y of x.stops)if(y.kind==='rest'&&y.state!=='done')y.state='removed'});const done=PLAY().filter(jRested);toast(`The rest starts again: new checks, everyone rests again${done.length?`. ${done.map(c=>c.name).join(', ')} had finished: an interrupted rest gives nothing, so take back what it gave`:''}`);jDone()},
  jfinishcamp:()=>{const go=()=>{for(const c of PLAY())if(jRested(c)&&c.lastRest!=='miasma')for(const h of c.hires||[]){h.cruelty=0;h.miasma=(h.miasma||[]).filter(n=>!['cruelty','out'].includes((MI_ROWS().find(r=>r.n===n)||{}).dur))};S.journey={...S.journey,step:PLAY().some(jNeedsMind)?'night':'dawn'};jDone()},miss=PLAY().filter(c=>!jRested(c));
    if(!miss.length)return go();askYes(`${miss.length} crow${miss.length>1?'s haven’t':' hasn’t'} finished the rest`,`${miss.map(c=>c.name).join(', ')}: go on without ${miss.length>1?'their rests':'that rest'}? At dawn the app reminds them of the exhaustion wound.`,'Go on',go,true)},
  jact:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const v=b.dataset.v,next=dqAct(c)===v?null:v;jMine({act:next??'',pick:''});dqMine(c,{act:next,pick:null});jDone()},
  jfood:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const v=x.food===b.dataset.v?'':b.dataset.v;if(v==='inn'&&!c.innFood&&coinsOf(c)<5)return toast('You need 5 gc for the inn');jMine({food:v});jDone()},
  // the player finishes the rest here, on the camp panel, from the camp and their answers (the rest itself is rfinish)
  // the player finishes their own rest here only without a Ref (at a table the Ref's Finish rests everyone: dice.js dqFinish)
  jrest:()=>{const c=jMe(),cp=S.journey.camp||{},ctx=dqRest();if(!c||!ctx)return;if(crowDead(c))return toast(`${c.name} is dead`);if(dqTable())return toast('The Ref finishes the rest');
    if(jRestAt().check&&cp.ready!==true)return toast('Wait for the Ref’s rest checks');if(dqAct(c)===undefined)dqMine(c,{act:''});const left=dqCrowItems(c,ctx).filter(x=>x.st==='wait');if(left.length){S.dq.open=left[0].key;S.dq.fromWait=true;render();return toast(`Still waiting: ${String(left[0].what||'').replace(/<[^>]+>/g,'')}`)}
    journalRun('Finished a rest',[`crow:${c.id}`,'pool','journey'],()=>dqFinishCrows(ctx,[c]));S.rest.log=c.rlog?.l||null;jDone()},
  // Night
  jmundo:()=>{const c=jMe();if(!c)return;miUndo(c);jMine({mind:0,d10:0});jDone()},
  jwalk:()=>{jWalkStop();J_WALKING=true;jWalkTick()},
  jskip:()=>{jWalkStop();for(let n=0;n<200&&!jWalkDone();n++)A.jstep();jDone()},
  jride:b=>{const c=jMe();if(!c)return;jMine({ride:b.dataset.v||''});jDone()},
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
    for(const c of PLAY()){const g=d(6);for(let i=0;i<g;i++){const n=rollTable('merchant-guards').row[1];guards[n]=(guards[n]||0)+1}}
    const inst=key(name)||'store',two=y?{inst2:key(y.row[1])||'store',name2:y.row[1],lvl2:J_ORD.indexOf(y.row[2])}:{};
    jScriptSet(sc=>{const st=sc.stops.find(z=>z.id===b.dataset.k);if(!st)return;st.scene={kind:'merchant',inst,name,lvl,pct,npc,guards,...two};st.text=`Merchant: ${name} (${x.row[2]} level)${y?` and ${y.row[1]} (${y.row[2]})`:''}, buys at ${pct}%`;if(!st.say)st.say=J_SAY.Merchant});jDone()},
  jtravel:b=>{const n=d(10),who={};for(let i=0;i<n;i++){const s=rollTable('travelers').row[1];who[s]=(who[s]||0)+1}const att=jAttRoll('traveler-encounters'),react=String(jAttRow(att)?.[1]||'');
    jScriptSet(sc=>{const st=sc.stops.find(y=>y.id===b.dataset.k);if(!st)return;st.scene={kind:'traveler',n,who,react};if(att)st.att=att;st.text=`Traveler: ${n} human${n>1?'s':''} — ${react.split(':')[0]}`;if(!st.say)st.say=J_SAY.Traveler});jDone()},
  // Miasma-Touched (The Ref): roll 1d6 times on Miasma-Touched Humans (a roll in the book's gap, 29, is rolled again)
  jtouched:b=>{const n=d(6),who={};for(let i=0;i<n;i++){let s='';for(let t=0;t<20&&!s;t++)s=String(rollTable('miasma-touched-humans').row?.[1]||'');if(s)who[s]=(who[s]||0)+1}
    jScriptSet(sc=>{const st=sc.stops.find(y=>y.id===b.dataset.k);if(st)st.scene={kind:'touched',n,who}});jDone()},
  // the encounter's reaction, behaviour or prompt: roll again, or the Ref sets the row
  jattroll:b=>{jAttSet(b.dataset.k,def=>jAttRoll(def[0]))},
  jattdice:b=>{const id=b.dataset.k,st=S.journey.script?.stops.find(x=>x.id===id),c=st&&(st.kind==='rest'?S.rtravel.restChecks||[]:jChecks())[st.check],def=st&&jAttDef(st,c),row=def&&jAttRow(jAttOf(st,def[0])),x=row&&jDiceIn(row[1])[+b.dataset.v];if(!x)return;
    let v=0;for(let j=0;j<x.n;j++)v+=d(x.d);jScriptSet(sc=>{const s2=sc.stops.find(y=>y.id===id);if(s2)s2.dice={...(s2.dice||{}),[x.i]:v}});toast(`${x.label}: ${(v*x.k).toLocaleString('en')}${x.gc?' gc':''}`);jDone()},
  jattset:b=>{const r=parseInt(b.value,10);if(!(r>0))return;jAttSet(b.dataset.k,def=>({tb:def[0],r}))},
  jtreward:b=>{const r=jRollText(rollTable('traveler-rewards').row[1]).replace(/^(\d+) \((\d+d\d+)\) × ([\d,]+) gc/,(m,n,dd,k)=>`${(+n*+k.replace(/,/g,'')).toLocaleString('en')} gc (${dd} × ${k})`);jScriptSet(sc=>{const st=sc.stops.find(y=>y.id===b.dataset.k);if(st?.scene)st.scene={...st.scene,reward:r}});jDone()},
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
  jmoldin:b=>{const n=parseInt(document.getElementById('jmold-'+b.dataset.k.replace(/ /g,'-'))?.value,10);if(!(n>=+b.dataset.lo&&n<=+b.dataset.hi))return toast(`Rations lost: ${b.dataset.lo}–${b.dataset.hi}`);A.jmold({dataset:{k:b.dataset.k,v:n}})},
  jmold:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const n=b.dataset.k,got=jWxGot(x,n);if(!got||got.includes('/'))return;let k=+b.dataset.v,lost=0;
    for(const r of jRations(c)){if(!k)break;const m=Math.min(k,r.count);addCount(r,-m);k-=m;lost+=m}c.inv=c.inv.filter(i=>!(J_RATIONS.includes(i.id)&&i.count<=0));jMine({wx:jWxSet(x,n,`${got}/${lost}`)});toast(`${lost} ration${lost===1?'':'s'} lost to mold`);jDone()},
  // the lifted crow's own device applies it (players write only their crow); the Ref's device can apply it for them
  jgodawn:()=>{const miss=[...PLAY().filter(c=>jNeedsMind(c)&&(!jMindDone(c)||jLiftPending(c))),...jHireNight().filter(a=>!hrMindOf(a.h)).map(a=>a.h)],go=()=>{S.journey={...S.journey,step:'dawn'};jDone()};
    if(!miss.length)return go();askYes(`${miss.length} Mind RR${miss.length>1?'s':''} missing`,`${miss.map(c=>c.name).join(', ')}: the Mind RR after a rest in the Miasma is not optional. Enter it, or go on and settle it at the table.`,'Go on anyway',go)},
  // Dawn in a village: the day ends there and the party stays (the village is the camp's place: its hex, or its name without a map)
  jstayvillage:()=>{const cp=S.journey.camp||{},p=hxHere()&&cp.k?HX.pois.find(x=>x.k===cp.k&&jPoiKind(x)==='village'):null,
      v=(!S.rtravel.moved&&VILLAGES.find(x=>x.id===S.journey.from))||(p&&scSheet(p))||VILLAGES.find(x=>cp.poi&&scNorm(x.name)===scNorm(cp.poi));
    if(!v&&cp.poi)return scAskSheet(cp.poi,nv=>scEndIn(nv,true));scEndIn(v,true)},
  // players' votes at a stop
  jvote:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const k=b.dataset.k;jMine({[k]:x[k]===b.dataset.v?'':b.dataset.v});jDone()},
  jdawn:()=>jCompound(()=>{A.rnextday();jDone()}),
  // the camp's one button: night and dawn in one go (asks first when someone still owes a rest or a Mind RR)
  jnextday:()=>{const owe=jOwed(),n=S.rtravel.day+1;if(!owe.length)return A.jdawn();
    askYes(`Start day ${n}?`,`Still owed: ${owe.map(o=>o.replace(/<[^>]*>/g,'')).join(' ')} Who didn’t rest marks an exhaustion wound; a Mind RR not entered is settled at the table.`,`Start day ${n}`,()=>A.jdawn(),true)},
  // what the players see of an encounter: the Ref's words (Ref p38: no monster names — show the art)
  jsay:b=>{const st=S.journey.script?.stops.find(x=>x.id===b.dataset.k);if(!st)return;
    jAskText('What do the players see?','Describe it without a name: monsters have none (Ref p38) — show them the art. Players read this on their Journey and in the log.',st.say||'',v=>{
      jScriptSet(sc=>{const s2=sc.stops.find(x=>x.id===st.id);if(!s2)return;const t=jClean(v).trim();if(t)s2.say=t;else delete s2.say});jDayLog();jDone()})},
  // role results: a tracker taps the dice they rolled; the catch goes into the pack
  jgain:b=>{const a=jTrav(b.dataset.k);if(!a||!jMineTrav(a))return;const fx=JRS.FX[JRS.fxKey(a.x.task,a.x.doom?1:a.x.tier)]||{},g=jGain(a.x)||{t:a.x.task,r:0,p:0};if(g.given)return toast('Already in the pack');
    if(b.dataset.f==='give'){g.t=a.x.task;jGainGive(a,g);return jDone()}
    if(fx.loot==='forage'){g.r=1;g.p=0}else if(b.dataset.f==='p')g.p=+b.dataset.v;else g.r=+b.dataset.v;g.t=a.x.task;
    const done=fx.loot==='forage'||fx.loot==='hunt2'&&g.r>0||fx.loot==='hunt3'&&g.r>0&&g.p>0;
    if(done)jGainGive(a,g);else jGainSet(a,`${g.t}:${g.r}:${g.p}`);jDone()},
  jrgive:b=>{const a=jTrav(b.dataset.k);if(!a)return;const fx=JRS.FX[JRS.fxKey(a.x.task,a.x.doom?1:a.x.tier)]||{},g=jGain(a.x)||{t:a.x.task,r:0,p:0};if(g.given)return;if(fx.loot==='forage'){g.r=1;g.p=0}g.t=a.x.task;jGainGive(a,g);jDone()},
  // Treasure Hunt tier 2 or 3: the Ref rolls Minor Treasures (as Loot → Quick treasure); the find goes into the loot pool
  jtreasure:b=>{const a=jTrav(b.dataset.k);if(!a||jGain(a.x)?.given)return;const x=rollTable('minor-treasures'),t=treasureToPool('minor-treasures',x.row);
    S.rtravel.found={...(S.rtravel.found||{}),[a.id]:String(t).slice(0,200)};jGainSet(a,'treasure:0:0:g');toast(`Minor Treasures d100 ${x.r}: ${t} → loot pool`);jDone()},
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
document.addEventListener('change',e=>{if(e.target.id==='jwhat'){S.jDraft=null;S.jFocus=false;jMine({what:jClean(e.target.value)});jDone()}else if(e.target.dataset?.action==='jdoom')A.jdoom();else if(e.target.dataset?.action==='jattset')A.jattset(e.target)});
// a draft stays on this device while typed (a change from the table re-renders the panel)
document.addEventListener('input',e=>{if(e.target.id==='jwhat'){S.jDraft=e.target.value;S.jFocus=true}});
document.addEventListener('focusout',e=>{if(e.target.id==='jwhat')S.jFocus=false});
// Dawn on the Travel day tab also moves the journey to the next day.
const jOnScript=()=>['script','road'].includes(jStep())&&!!S.journey.script;
for(const k of ['hxgo','hxstep']){const f=A[k];A[k]=b=>jOnScript()?toast('Today the party walks the day’s script: Next hex on the Map’s panel'):f(b)}
// Put the party here on a scripted day: today's path ends on that hex. Encounters still ahead happen here; a place still ahead
// (village, point of interest, overnight) stays where it is and leaves today's path, unless it is the hex the party was put on
// (as Today 1 hex shorter does). Before 2026-11-17 every stop moved here, so a token dropped on Gadwick asked about Fallen Keep.
{const f=A.hxput;A.hxput=b=>{const on=jOnScript();const out=f(b);if(on&&HX?.party===b.dataset.k)jScriptSet(sc=>{const old=sc.path;sc.path=[...sc.path.slice(0,sc.at),HX.party];
  for(const st of sc.stops)if(st.i>sc.at){const k=st.k||old[st.i];if(['village','poi','night'].includes(st.kind)&&k!==HX.party){st.state='removed';continue}st.i=sc.at;if(st.k!==undefined)st.k=HX.party}});if(on)render();return out}}
{const f=A.rnextday;A.rnextday=b=>{for(const c of PLAY())for(const p of c.pets||[])if(p.prayer>0)p.prayer-=1; // Mount's Prayer: a number of days
  const on=jStep()!=='off',fight=on?PLAY().filter(c=>jFightBonus(c)&&!(jNeedsMind(c)&&jMindDone(c))).map(c=>c.id):S.journey.fight;
  // the day ends at a camp: who didn't finish a rest owes an exhaustion wound (Rules: Exhaustion); hirelings who rested with their
  // crow out of the Miasma lose cruelty and the effects that last until then (Characters: hirelings follow PC rules)
  // a rest finished at a point of interest that day is the day's rest too (jPoiRestedToday)
  const camp=on&&jCamping()&&!!S.journey.camp?.base,tired=camp?PLAY().filter(c=>!crowDead(c)&&!jRested(c)&&!jPoiRestedToday(c)).map(c=>c.id):[];
  if(camp)jHiresRested();
  let out;jCompound(()=>{out=f(b);if(on)S.journey={...S.journey,step:'plan',day:S.rtravel.day,from:'',plan:S.journey.plan?{...S.journey.plan,locked:false}:null,inputs:{},script:null,camp:null,
  effects:(S.journey.effects||[]).filter(e=>!jFxOver(e,S.rtravel.day)),...(fight&&fight.length||S.journey.fight?{fight:fight||[]}:{}),...(tired.length||S.journey.tired?{tired}:{})}});if(on)render();return out}} // the old Travel day tab's Start day too: drawn and saved

{const base=SCREENS.session;SCREENS.session=()=>{const sc=S.journey?.script,st=sc&&sc.stops.find(x=>x.i===sc.at&&x.kind==='poi');
  if(S.phase==='travel')return inFight()?stageHTML('fight',fightHTML()):stageHTML('turn',jRoadPrepHTML()); // the same combat screen as in a dungeon
  const poi=jPoiScene();if(poi){const n=esc(poi.text||'the place'),rest=jPoiRest(),why=rest?'':jPoiRestWhy();
    // the rest (jPoiRestRef) is the stage's card while it lasts; a rest encounter's combat and its aftermath are the stage's own
    const head=`<div class="banner st-poib scdoor">${rest?`<span class="msg">The party rests here: DT ${S.dt.n} has ended.</span>`:''}${rest?'':`<button class="btn sm" data-action="jpoirest"${why?` aria-disabled="true" title="${esc(why)}"`:''}>Rest here</button><button class="btn sm jr-go" data-action="jpoileave">Leave ${n} → the road</button>`}</div>`;
    return head+(rest&&!['fight','after'].includes(sceneOf())?stageHTML('rest',jPoiRestRef()):base())}
  // the way out of the scene heads the Turn screen: the delve from the road (Leave → camp); a dungeon on the map (Leave → the road).
  // A dungeon-only game (no map) keeps its stage clear: Menu → Move the party
  const back=S.phase==='delve'&&jStep()==='road'?`<div class="banner scdoor"><span class="msg">The delve is a day of its own: leaving, the party camps by it and day ${S.rtravel.day+1} begins.</span><button class="btn sm jr-go" data-action="jleave">Leave ${esc(S.journey.camp?.poi||st?.text||jExploreName())} → camp</button></div>`
    :S.phase==='delve'&&S.role==='ref'&&!jRunning()&&scMap()&&!inFight()?`<div class="banner scdoor">${jSceneDoorBtn('travel','Leave the dungeon → the road','sm')}</div>`:'';return back+base()}}
// Creatures added on the road (Bestiary, side panel, search, roll tables) wait on the encounter card, as in a dungeon; Begin combat opens the fight.
function jRoadPrepHTML(){return `<section class="st-card" aria-label="Encounter on the road"><header class="st-h"><h2>On the road</h2>${S.combat.length?'':'<span class="st-tag">No combat</span>'}<span class="st-clk muted small">day ${jDay()}</span></header>
  ${S.combat.length?preparedHTML():`<p class="muted st-lead">No creatures yet. Add them from the Bestiary, a roll table or the search: they wait here until you begin combat.</p><div class="st-acts"><button class="btn" data-action="find" data-q="">Add a creature</button><button class="btn ghost" data-action="tab" data-v="rmap">Back to the Map</button></div>`}</section>`}
// On the Ref's Journey: creatures waiting for Begin combat, or a fight that no road encounter started.
function jRoadCombatRef(){if(S.phase!=='travel')return '';const enc=(S.journey.script?.stops||[]).some(x=>x.state==='fight');
  return inFight()?(enc?'':`<section class="hxsec"><div class="jr-warn" style="margin:0"><b>In combat</b> on the road.<div class="jr-row" style="margin-top:.4rem"><button class="btn primary" data-action="tab" data-v="session">Back to the combat</button></div></div></section>`)
    :S.combat.length?`<section class="hxsec">${preparedHTML()}</section>`:''}
// End combat on the road (play.js st-endfight): the fight was the encounter, so it is met; the Table goes back to the Journey.
function jCombatOver(){const sc=S.journey?.script;if(sc?.stops?.some(x=>x.state==='fight')){jScriptSet(x=>{for(const st of x.stops)if(st.state==='fight')st.state='done'});jDayLog();jSave()}if(S.phase==='travel')S.tab.session='rmap'} // at a POI the stage stays: after the combat, then the turn
// Leaving: the delve took a day of its own, however many Dungeon turns (owner's ruling, 2026-11-11): the day moves on and the party
// rests by the place (Camp → Night → Dawn as on the road)
Object.assign(A,{jleave:()=>jCompound(()=>{const sc=S.journey.script,k=sc?sc.path[sc.at]:null,p=k&&hxHere()?jPoiAt(k):null,base=S.journey.camp?.base,so=window.syncOut;setPhase('travel');window.syncOut=()=>{};try{A.rnextday()}finally{window.syncOut=so}
  S.journey={...S.journey,step:'camp',script:{path:[k||(hxHere()&&HX.party)||'0,0'],at:0,lost:!!S.rtravel.lost,stops:[]}};jCampStart('outdoor',hxHere()&&!S.rtravel.lost?k:null,p?.label||'');if(base)S.journey={...S.journey,camp:{...S.journey.camp,base}};S.tab.session='rmap';jDone()})});

/* ---------- the scene and the place: one set of rules for every way in (QA/2026-11-12-logic-review.md) ----------
   The Ref's device decides where the party is; players at a table only follow it (app.js sceneWhy, sync.js). With a map and the
   party on it, the party's hex decides: Village only on a settlement, Dungeon only on a dungeon, fortification or sacred place
   (the places the road offers to explore, jPoiKind), and the village sheet is the one named like the place. A journey day runs in
   Travel, or in the Dungeon it explores from the road (camp.place 'dungeon'): entering a village ends it, leaving one starts it at
   Plan, leaving the dungeon camps by it (jleave). Without a map the Ref says where the party is, as before. */
const scMap=()=>S.role==='ref'&&hxHere()&&!!HX.party; // the map decides where the party can be
const scPoi=kind=>scMap()?HX.pois.find(p=>p.k===HX.party&&jPoiKind(p)===kind)||null:null; // the Ref knows places the players have not found yet
const scLabel=p=>p.label||tName(HX,p.type);
const scNorm=x=>String(x||'').trim().toLowerCase();
const scSheet=p=>p&&VILLAGES.find(v=>scNorm(v.name)===scNorm(scLabel(p)))||null;
const scOnMap=v=>!!v&&hxHere()&&HX.pois.some(p=>jPoiKind(p)==='village'&&scNorm(scLabel(p))===scNorm(v.name));
const scWhere=()=>`hex ${HX.party} (${tName(HX,HX.t[HX.party]||'')})`;
const jRunning=()=>jStep()!=='off';
const jExploring=()=>jStep()==='road'&&S.journey.camp?.place==='dungeon';
const jCamping=()=>['camp','night','dawn'].includes(jStep());
// today's journey has used the day once a hex is walked, the party camps or explores: ending it then closes the day
const jDayUsed=()=>(S.rtravel.moved||0)>0||jCamping()||jExploring()||!!jPoiStop();
// A change made around a journaled action (the end of a day: rnextday, inside leaving a dungeon or staying in a village): the entry it files
// takes the state from before the whole change and after it, so Undo brings all of it back (the scene, the journey's step, the day).
function jCompound(fn){const t0=Date.now(),pre={};for(const k of ['session','villages','journey'])pre[k]=scopeGet(k);let out;try{out=fn()}finally{let n=0;
  for(const e of JOURNAL)if(e.t>=t0&&e.dev===DEV&&!e.undoes&&!e.undone){e.scopes.forEach((sc,k)=>{if(sc in pre)e.before[k]=pre[sc];e.after[k]=scopeGet(sc)});n++}if(n)saveJournal()}return out}
{const base=sceneWhy;sceneWhy=k=>{const b=base(k);if(b||S.role!=='ref'||k===S.phase)return b;
  if(S.dt.fight==='on')return 'End the combat first.';
  if(!k&&jRunning())return `The party is on a journey (day ${jDay()}, ${J_STEP[jStep()]}).`;
  if(k==='village'&&scMap()&&!scPoi('village'))return `The party is at ${scWhere()}, not in a village. Walk there on the Map’s Road step, or put the party on its hex there.`;
  if(k==='delve'&&scMap()&&!scPoi('poi'))return `The party is at ${scWhere()}, not at a dungeon or a point of interest. Walk there on the Map’s Road step, or put the party on its hex there.`;
  if(k==='delve'&&jCamping())return `The party is camping (${J_STEP[jStep()]}). Start the next day on the Map first.`;
  return ''}}
sceneArriveWhy=v=>{if(S.role!=='ref'||!v)return '';if(S.dt.fight==='on')return 'End the combat first.';if(!scMap())return '';const p=scPoi('village');
  if(!p)return `The party is at ${scWhere()}, not in a village. It arrives on the Map’s Road step, or put it on the village’s hex there.`;const s=scSheet(p);
  if(s?s.id!==v.id:scOnMap(v))return `The party is in ${scLabel(p)}, not in ${v.name}.`;return ''}; // a place no sheet is named for takes a sheet that is on no hex
// a new village sheet for a place on the map (a preset when the name is one: Gadwick, Liston)
const scNewSheet=name=>{const P=Object.values(V_PRESETS).find(x=>scNorm(x.name)===scNorm(name));return mkVillage(P?{name:P.name,note:P.note,inst:P.inst}:{name})};
const scAskSheet=(name,then)=>askYes(`${name} has no village sheet yet`,`Create one, so players can trade there? Its institutions are set on Places. A sheet you made under another name: pick it on Places → Party arrives here.`,`Create ${name}`,()=>then(scNewSheet(name)),true);
// The party is in village v (null: one the Ref picks on Villages). endDay: today's journey day closes (Dawn → Stay in the village);
// without it a departure that walked nothing is called off (Cancel the departure). Either way the journey stops.
function scEndIn(v,endDay){jCompound(()=>{if(jPoiStop())jPoiClose();if(endDay&&jRunning())A.rnextday();
  if(jRunning()){S.journey={...S.journey,step:'off',plan:null,inputs:{},script:null,camp:null,from:''};S.rtravel.camp=null;S.rtravel.restChecks=[]}
  const p=v&&scMap()?HX.pois.find(x=>x.k===HX.party&&jPoiKind(x)==='village'&&!x.found):null;if(p){p.found=true;HX.seen[p.k]=1;hxDayRec().found.push(scLabel(p));saveHX()} // they are in it: the players know it now
  if(v){S.here=v.id;S.vsel=v.id}setPhase('village');saveVillages();
  toast(v?`The party is in ${v.name}`:'The party is in a village: Places → Party arrives here');jDone()})}
function scVillage(id){const p=scPoi('village'),v=id?VILLAGES.find(x=>x.id===id):scSheet(p)||(!scMap()&&jRunning()&&!jDayUsed()?VILLAGES.find(x=>x.id===S.journey.from):null); // no map: a departure called off goes back where it left
  if(id&&!v)return;if(id){const why=sceneArriveWhy(v);if(why)return toast(why)}
  if(!v&&p)return scAskSheet(scLabel(p),nv=>scVillage(nv.id));
  if(!jRunning())return scEndIn(v,false);
  const name=v?v.name:'the village';
  if(!jDayUsed()){toast(`Departure called off: the party stays in ${name}`);return scEndIn(v,false)}
  askYes(`End today’s journey in ${name}?`,`Day ${S.rtravel.day} ends here: the party spends the night in ${name} and wakes on day ${S.rtravel.day+1}. Players rest in the village (Rest on their Sheet).`,`End the day in ${name}`,()=>scEndIn(v,true),true)}
// Into a dungeon from a journey: the same as Explore on the road, today is the delve (Leave → camp by it)
function jExploreHere(){if(!S.journey.script)S.journey={...S.journey,script:{path:[(hxHere()&&HX.party)||'0,0'],at:0,lost:!!S.rtravel.lost,stops:[]}};
  const sc=S.journey.script;if(sc.stops.some(x=>x.i===sc.at&&x.kind==='poi'&&x.state!=='done'))jScriptSet(x=>{for(const st of x.stops)if(st.i===x.at&&st.kind==='poi')st.state='done'});
  S.journey={...S.journey,step:'road',plan:{...(S.journey.plan||{route:[],pace:S.rtravel.pace,by:'',nights:[]}),locked:true},camp:{place:'dungeon',k:null,poi:'',closed:null,restart:0,base:Object.fromEntries(PLAY().map(c=>[c.id,c.rests||0]))}};
  setPhase('delve');if(S.here){S.here='';saveVillages()}}
const jExploreName=()=>{if(S.journey.camp?.place==='dungeon'&&S.journey.camp.poi)return S.journey.camp.poi;const sc=S.journey.script,k=sc?.path[sc.at],p=k&&hxHere()?HX.pois.find(x=>x.k===k&&jPoiKind(x)==='poi'):null;return p?scLabel(p):'the dungeon'};
{const base=sceneTo;sceneTo=to=>{if(S.role!=='ref'||sceneWhy(to))return base(to); // base says why
  if(to==='village')return scVillage();
  if(to==='delve'){const name=(scPoi('poi')&&scLabel(scPoi('poi')))||'the dungeon';if(!jRunning()){toast(`The party enters ${name}`);return base(to)}
    if(scPoi('poi')&&!jPoiDungeon(scPoi('poi'))){const st=jPoiAtHere();return jPoiOpen(st?.id)} // not a dungeon: its Point of Interest scene
    jExploreHere();S.tab.session='session';toast(`Into ${name}. The delve is a day of its own: when you leave, the party camps by it.`);return jDone()}
  if(to==='travel'){if(jPoiScene())return A.jpoileave();if(S.phase==='delve'&&jExploring())return askYes(`Leave ${jExploreName()}?`,`The delve took a day of its own: day ${S.rtravel.day} ends with a camp here.`,'Leave → camp',()=>A.jleave(),true);
    if(!jRunning()){A.jstart();S.area='session';S.tab.session='rmap';return render()}}
  return base(to)}}
{const base=sceneArrive;sceneArrive=id=>S.role==='ref'?scVillage(id):base(id)}
// Put the party here (Map): the scene follows the hex it lands on
{const f=A.hxput;A.hxput=b=>{const out=f(b);if(S.role!=='ref'||!scMap())return out;let moved='';
  if(S.phase==='village'&&sceneArriveWhy(vHere())){const s=scSheet(scPoi('village'));if(s){S.here=s.id;S.vsel=s.id;saveVillages();moved=`The party is in ${s.name}`}else{S.here='';saveVillages();setPhase('travel');moved='The party is on the road now'}}
  else if(S.phase==='delve'&&jPoiScene()?.k&&HX.party!==jPoiScene().k){jPoiClose();moved='The party has left the place, on the road'}
  else if(S.phase==='delve'&&!scPoi('poi')){setPhase('travel');moved='The party is out of the dungeon, on the road'}
  if(moved){toast(moved);render()}return out}}
/* ---------- the Ref's doors (owner, 2026-11-17): the scene changes where the party stands, not in the bar ----------
   On the road, the place on the party's hex (village, dungeon, point of interest) offers its way in: a place card on top of the
   Map's step panel, and the same block in the party's hex card when the Ref opens it. Not on the panel while a stop card of today's
   road asks about it (Investigate / Rest here) or after the road answered it (left, gone on), not in combat, and not after Go on
   (S.doorOff, this device only). The hex card keeps it whenever the Ref opens the party's hex. Inside a
   scene the way out is in its banner (Turn: the point of interest, the dungeon; Villages: Set out). No map: Menu → Move the party
   Every door calls sceneTo/sceneArrive (data-action phase), so sceneWhy still says why not. */
function jDoor(o={}){if(S.role!=='ref'||S.phase!=='travel'||!scMap()||S.dt.fight==='on'||inFight())return null;
  const v=scPoi('village'),p=v?null:scPoi('poi');if(!v&&!p)return null;const sc=S.journey?.script;
  if(!o.card){if(S.doorOff===HX.party||!['road','camp','off'].includes(jStep()))return null;if(sc&&sc.stops.some(x=>(x.kind==='village'||x.kind==='poi')&&x.state!=='removed'&&(x.i===sc.at||x.k===HX.party)))return null} // its stop card asks, or today's road already answered it (left, gone on)
  const name=scLabel(v||p),d=S.rtravel.day;
  if(v)return {sc:'vil',ico:'village',k:'Village',name,to:'village',pri:`Enter ${name} →`,
    text:jRunning()&&jDayUsed()?`Entering ends day ${d} here: the party sleeps in ${name}, players trade and rest there.`:jRunning()?`Entering calls today’s departure off: the party stays in ${name}.`:`The party goes into ${name}: players trade and rest there.`};
  const dun=jPoiDungeon(p);
  return {sc:'dun',ico:dun?'delve':'poi',k:dun?'Dungeon':'Point of interest',name,to:'delve',pri:`${dun?'Delve into':'Investigate'} ${name} →`,
    text:dun?(jRunning()?'The delve is a day of its own: Dungeon turns, the clock and greed. Leaving, the party camps outside.':'Dungeon turns and the clock.')+(jFam(p)?` ${FAMS[p.fam]} live here: the delve rolls their encounters.`:' Which monsters live here is not set yet: pick them in the delve’s setup or the map editor.')
      :jRunning()?`Played in Dungeon turns; encounter checks use today’s EN (${rtDay().en}) and the travel tables. Leaving goes back to the road.`:'Played in Dungeon turns.'}}
// a door's button: data-action phase goes through sceneTo; a door the rules close stays tappable and says why (aria-disabled)
const jSceneDoorBtn=(to,label,cls,act)=>{const why=act?'':sceneWhy(to);return `<button class="btn ${cls||''}${cls==='hb'&&!why?' pri':''}${cls!=='hb'&&!why&&!/sm/.test(cls||'')?' primary':''}" data-action="${act||'phase'}"${act?'':` data-v="${to}"`}${why?` aria-disabled="true" title="${esc(why)}"`:''}>${esc(label)}</button>`};
function jDoorHTML(d,o={}){const why=d.act?'':sceneWhy(d.to);
  return `<section class="hxsec door" data-door="${d.sc}" aria-label="${esc(d.name)}: ${esc(d.k)}"><div class="door-h">${vsvg(WICON[d.ico])}<div><h3>${esc(d.name)}</h3><span class="door-k"><b>${esc(d.k)}</b></span></div></div>
   ${d.text?`<p>${esc(d.text)}</p>`:''}${why?`<p class="small door-why">${esc(why)}</p>`:''}
   <div class="jr-row">${jSceneDoorBtn(d.to,d.pri,'',d.act)}${o.goOn===false?'':'<button class="btn" data-action="dooron">Go on</button>'}</div></section>`}
// the same door in the hex card of the party's hex (hexmap.js hxHexCard), when the Ref opens it
const jDoorCard=()=>{const d=jDoor({card:true});if(!d)return '';const why=sceneWhy(d.to);
  return `<div class="hxdoor" data-door="${d.sc}"><span class="door-k">${vsvg(WICON[d.ico])}<b>${esc(d.k)}</b></span><div class="nm">${esc(d.name)}</div>${d.text?`<p>${esc(d.text)}</p>`:''}${why?`<p class="door-why">${esc(why)}</p>`:''}<div class="r">${jSceneDoorBtn(d.to,d.pri,'hb')}<button type="button" class="hb" data-action="dooron">Go on</button></div></div>`};
A.dooron=()=>{S.doorOff=HX?.party||'';if(S.hx)S.hx.sel=null;render()};
/* ---------- the dungeon's monsters (owner, 2026-11-18) ----------
   A dungeon marker on the Ref's map remembers which family lives there (poi.fam: Monster from Nearby's chooser, the map editor's
   Monsters here). The delve at that place uses it: while the party delves there, the delve's family (S.dt.dungeon: its encounter
   checks, the creature picker) is the place's, whichever door led in (the step panel's or hex card's Delve into X →, a stop card's
   Delve, Menu → Move the party → Dungeon, Start DT on the stage, a reload). A place with no family keeps the delve's current choice;
   only an explicit choice of the Ref is remembered on the place (owner, 2026-11-20): the family set when the marker is placed (the map
   editor asks), the Monster from Nearby chooser, the delve setup's Monsters here or its Remember button. Nothing rolled is stored by
   itself. A change during the delve changes the place too: one dungeon, one family. Ref's device only:
   S.dt.dungeon is not sent to the table (dtPub), poi.fam never is (hxPub). A point of interest (Investigate) has no family: its
   encounters use the travel tables (Rules: POIs). */
const jDelvePoi=()=>{if(S.role!=='ref'||S.phase!=='delve'||jPoiScene())return null;
  if(!scMap()){const n=jExploring()&&S.journey.camp?.poi;return n&&PLACES.find(x=>x.kind==='dungeon'&&x.label===n)||null}const sc=S.journey?.script,at=k=>k&&HX.pois.find(p=>p.k===k&&jPoiDungeon(p));
  return at(HX.party)||jExploring()&&at(sc?.path?.[sc.at])||null}; // the party's hex; on a journey, the hex the day explores
const jFamKeep=(p,f)=>{if(!p||!FAMS[f]||p.fam===f)return false;p.fam=f;if(p.kind)savePlaces();else saveHX();return true};
// the setup's Monsters here select (app.js dt-dun): the pick is the place's
function jFamPick(f){const p=jDelvePoi();if(jFamKeep(p,f))toast(`${FAMS[f]} live in ${scLabel(p)}: remembered ${p.kind?'in Places':'on the map'}`)}
// the delve follows the place (every render and journal entry on the Ref's device, so every way in is covered)
{const base=syncDerived;syncDerived=()=>{base();const p=jDelvePoi(),f=jFam(p);if(f&&S.dt.dungeon!==f)S.dt.dungeon=f}}
// the setup's line under Monsters here (play.js setFormHTML): whether the family is the place's
famNoteHTML=()=>{const p=jDelvePoi();if(!p)return '';const n=esc(scLabel(p));
  return jFam(p)?`<p class="small muted st-fam">Remembered on ${n}: Monster from Nearby rolls the same. A change here changes ${n}.</p>`
    :`<div class="st-fam"><p class="small muted">${n} has no family yet: nothing is stored until you choose. A pick here is remembered there, and Monster from Nearby then rolls the same.</p><button type="button" class="btn sm" data-action="dt-famkeep">Remember: ${esc(FAMS[S.dt.dungeon]||'')} live in ${n}</button></div>`};
A['dt-famkeep']=()=>{jFamPick(S.dt.dungeon);render()};
// The status line under the bar (app.js drawWhere): the day, the place on the road, the point of interest
{const base=whereParts;whereParts=()=>{const p=jPoiScene(),d=jDay(),T=S.dt;
  if(p)return ['poi',p.text||'A point of interest','point of interest',jPoiRest()?`resting, DT ${T.n} has ended`:`DT ${T.n}`,`day ${d} on the road`];
  if(S.phase==='delve'&&jExploring()){const n=jExploreName();return n==='the dungeon'?['delve','In a dungeon',`DT ${T.n}`,`day ${d}, explored from the road`]:['delve',n,'dungeon',`DT ${T.n}`,`day ${d}, explored from the road`]} // a dungeon without a name (no map): not “the dungeon · dungeon”
  if(S.phase==='travel'){const st=jStep(),sc=S.role==='ref'?S.journey?.script:jPub().script,v=scPoi('village'),q=v?null:scPoi('poi');
    const at=v?`at the gate of ${scLabel(v)}`:q?(jPoiDungeon(q)?`at the mouth of ${scLabel(q)}`:`at ${scLabel(q)}`):''; // the Ref's map only: players hear it from the Ref
    const step=st==='road'&&sc?(sc.lost?'lost':`${PACE[jPace()]?.label||'Normal'} pace · hex ${sc.at} of ${sc.n??Math.max(0,sc.path.length-1)} today`):jCamping()?'camp':J_STEP[st]?`${J_STEP[st]} step`:'';
    return ['travel','On the road',`day ${d}`,at||step]}
  if(S.phase==='village'){const r=base();if(S.role!=='ref')r[3]=`day ${d}`;return r}
  return base()}}
// Old saves and partial undos can hold a scene the rules no longer allow; the Ref's device puts it right before drawing.
function sceneFix(){if(S.role!=='ref')return;
  if(S.here&&!S.phase)setPhase('village');else if(S.here&&S.phase!=='village'){S.here='';saveVillages()}
  if(!jRunning())return;
  if(S.phase==='village'&&S.journey.script?.stops.some(x=>x.kind==='village'&&x.state==='explore'))return; // the same test as places.js plVisit, which loads after this runs
  if(S.phase==='village'){const p=scPoi('village'),s=scSheet(p),inIt=S.here&&(!scMap()||p&&(s?s.id===S.here:!scOnMap(vHere())));
    if(inIt){S.journey={...S.journey,step:'off',plan:null,inputs:{},script:null,camp:null,from:''};jSave()}else{if(S.here){S.here='';saveVillages()}setPhase('travel')}}
  else if(!S.phase)setPhase('travel');
  else if(S.phase==='delve'&&!jExploring()&&!jPoiScene()){if(jCamping())setPhase('travel');else{jExploreHere();jSave()}}
  // a place explored on the road in a save from before the Point of Interest scene (travel, stop 'explore'): into its scene
  else if(S.phase==='travel'&&jPoiStop()&&!inFight()){jPoiOpen(jPoiStop().id,{quiet:true});jSave()}}
// The Villages screen when the map and the village disagree (a save from before these rules)
{const base=SCREENS.village;SCREENS.village=()=>{const v=vHere(),why=S.role==='ref'&&S.phase==='village'&&v?sceneArriveWhy(v):'',p=why&&hxHere()?HX.pois.find(x=>jPoiKind(x)==='village'&&scNorm(scLabel(x))===scNorm(v.name)):null;
  const out=!why&&S.role==='ref'&&S.phase==='village'&&v&&typeof plVisit==='function'&&plVisit()?plVisitHTML(v):!why&&S.role==='ref'&&S.phase==='village'&&v?`<div class="banner scdoor"><span class="msg">Players trade, rest and train here.</span><button class="btn sm jr-go" data-action="vleave">Set out from ${esc(v.name)} →</button></div>`:'';
  return (why?`<div class="banner bad"><span class="msg"><b>The map has the party at hex ${esc(HX.party)}</b>, not in ${esc(v.name)}.</span>${p?`<button class="btn sm" data-action="hxput" data-k="${esc(p.k)}">Put the party in ${esc(v.name)}</button>`:''}<button class="btn sm primary" data-action="vleave">Set out from ${esc(v.name)} →</button></div>`:out)+dqVillageTopHTML()+base()}}

/* ---------- signals outside the tab ---------- */
// What the journey wants from this player now (for the "next" banner and the dot on the tab).
function jWants(){if(S.area!=='crow'||S.phase!=='travel'&&!jPoiScene())return null;const c=jMe();if(!c)return null;const x=jIn(c),st=jStep();if(crowDead(c))return null;
  if(st==='roles'&&jWaiting(x))return `<b>Your test is waiting.</b> Roll it${dqTable()?' and tell the Ref your tier':' and tap your tier'}.`;
  if(st==='plan'&&!x.role)return '<b>Plan the day:</b> vote on the pace and choose your role.';
  if(st==='plan'&&(c.hires||[]).some(h=>!jHirePaid(h)))return '<b>Pay your hirelings</b> for today, or they leave.';
  if(st==='roles'&&jHireIn(c).some(a=>jWaiting(a.x)))return `<b>Your hireling’s test is waiting.</b> Roll it${dqTable()?' and tell the Ref the tier':' and tap the tier'}.`;
  {const cold=(S.journey.effects||[]).find(e=>J_COLD.includes(e.name)&&e.until-1===jDay()&&(e.hours||0)>String(jWxGot(x,e.name)||'').split(',').filter(Boolean).length&&!c.inv.some(i=>i.id==='cold-weather-gear'));if(cold&&['road','camp'].includes(st))return `<b>${esc(cold.name)}:</b> another hour outside — your Strength RR.`}
  const live=(jPub().script?.stops||[]).find(y=>['shown','fight'].includes(y.state)&&(y.kind==='enc'||y.kind==='rest'));
  if(live&&(st==='road'||st==='camp')){if(live.state==='fight'&&S.area==='crow'&&S.tab.crow==='sheet')return null;return `<b>${live.state==='fight'?'Fight':'Encounter'}:</b> ${jSeen(live)}`}
  {const L=jPoiRest()?'<b>Rest:</b>':'<b>Camp:</b>';
  if(jRestOpen()&&!jRested(c)&&(!jRestAt().check||S.journey.camp?.ready===true))return dqTable()?`${L} choose your activity and food; tell the Ref what you roll.`:`${L} finish your rest.`;
  if(jRestOpen()&&jNeedsMind(c)&&!jMindDone(c))return `${L} you slept in the Miasma — make your Mind RR${dqTable()?' and tell the Ref':''}.`}
  if(jTiredOwed(c))return '<b>You didn’t rest last night:</b> mark the exhaustion wound.';
  {const a=jAllIn().find(y=>y.c===c&&!y.h),fx=a&&JRS.FX[JRS.fxKey(a.x.task,a.x.doom?1:a.x.tier)];if(['road','camp'].includes(st)&&fx&&['forage','hunt2','hunt3'].includes(fx.loot)&&!jGain(a.x)?.given)return `<b>${esc(JRS.TASK_NAMES[a.x.task])}:</b> ${fx.loot==='forage'?'put your ration in your pack':'roll for your catch and tap the total'}.`}
  if(st==='road'){const s2=jPub().script?.stops?.find(y=>!['done','removed','pending'].includes(y.state)&&!(y.state==='explore'&&jPoiScene()));if(s2){if(s2.kind==='enc')return `<b>${s2.state==='fight'?'Fight':'Encounter'}:</b> ${jSeen(s2)}`;
    if(s2.kind==='village'&&!x.stay)return `<b>Vote:</b> rest in ${esc(s2.text||'the village')}?`;if(s2.kind==='poi'&&s2.state==='explore')return `<b>Investigating:</b> ${esc(s2.text||'the place')}`;if(s2.kind==='poi'&&!x.explore)return `<b>Vote:</b> ${jPoiDungeon(jStopPoi(s2))?'delve into':'investigate'} ${esc(s2.text||'the place')}?`}}
  return null}
// The Point of Interest scene: Move the party and the status line name the place (the stage itself: play.js).
// The colour stays the dungeon's ember: it says “Dungeon turns and their clock” (visual.css); the words and the mark say which place.
{const n=Object.getOwnPropertyDescriptor(PHASES.delve,'n').value,ic=PHASES.delve.icon,poi=()=>!!jPoiScene()||S.role==='ref'&&S.phase==='travel'&&jRunning()&&!!scPoi('poi')&&!jPoiDungeon(scPoi('poi'));
  Object.defineProperty(PHASES.delve,'n',{get:()=>poi()?'Point of Interest':n,configurable:true,enumerable:true});
  Object.defineProperty(PHASES.delve,'icon',{get:()=>poi()?'◈':ic,configurable:true,enumerable:true});
  // Move the party says what the third place's tap does there: investigate the place (the verb of Rules: POIs), not a delve
  Object.defineProperty(PHASES.delve,'tip',{get:()=>{const st=jPoiScene();if(st)return `Point of Interest: ${st.text||'the place'}`;return poi()?`Investigate ${scLabel(scPoi('poi'))}`:''},configurable:true,enumerable:true})}
// players investigate it from their Sheet as in a dungeon; the Journey stays (the day goes on; a merchant met here trades there).
// While the Ref has the party rest here, Rest joins the bar: the camp's rest panel (jCampPlayer), not the dungeon's Rest form.
{const f=NAV.crow;NAV.crow=()=>jPoiScene()?(jPoiRest()?['sheet','rest','journey','companions']:['sheet','journey','companions']):f()}
{const base=SCREENS.rest;SCREENS.rest=()=>jPoiRest()?`<div class="box jr-plain jr-poirest"><div class="jr">${jCampPlayer()}</div></div>`:base()}
// where what the journey wants is done: the Rest screen for a rest at a point of interest, else the Journey
const jWantsTab=w=>jPoiRest()&&/^<b>Rest:/.test(w||'')?'rest':'journey';
{const base=nextHTML;nextHTML=function(){const h=base(),w=h?null:jWants(),tab=jWantsTab(w);if(h||S.tab.crow===tab)return h;
  return w?`<div class="banner"><span class="msg">${w}</span><button class="btn sm primary jr-go" data-action="tab" data-v="${tab}">${tab==='rest'?'Rest':'Journey'} →</button></div>`:''}}
let J_VIEW='';
// the step panel is on screen: a player's Journey, or the Ref's Map (its old Journey key lands there) outside the editor
const jTabNow=()=>S.area==='session'&&['journey','rmap'].includes(S.tab.session)?'rmap':S.tab[S.area];
const jOnPanel=()=>S.area==='session'?jTabNow()==='rmap'&&!S.hx.edit:S.tab[S.area]==='journey';
{const base=render;render=function(){sceneFix();
  const pane=$('.hxpanel,.jr-plain,.tv,.tvp'),top=pane?.scrollTop,a=document.activeElement,key=a&&a.dataset?.action&&pane?.contains(a)?[a.dataset.action,a.dataset.v,a.dataset.k]:null,view=[S.area,jTabNow(),jStep()].join('|'),same=view===J_VIEW;J_VIEW=view;
  const f=roadFight();
  PHASES.travel.session=f?['journey','session','loot']:['journey','loot']; // the bar itself is NAV (app.js)
  TABS.session.find(t=>t[0]==='session')[1]=S.phase==='travel'?'Combat':jPoiScene()?'Turn':'Dungeon turn';
  base();jPersist();const w=jWants(),wt=jWantsTab(w),dot=S.tab[S.area]!==wt&&!!w;
  for(const k of ['journey','rest'])for(const tab of $$(`.vbtn[data-v=${k}]`)){const on=dot&&k===wt,l=k==='rest'?'Rest':'Journey';tab.classList.toggle('jr-dot',on);tab.classList.toggle('enc',on&&/Encounter|Fight/.test(w||''));tab.setAttribute('aria-label',on?`${l} — waiting for you`:l)}
  if(jOnPanel()){const p=$('.hxpanel,.jr-plain,.tv,.tvp');if(p&&top!=null&&same)p.scrollTop=top;
    if(!same)scrollTo(0,0); // a new step opens at its top: the panel is the page now, not a scroll box of its own (no map, 2026-11-23)
    $('.hxstage')?.toggleAttribute('data-jr-tall',['roles','camp','night','dawn'].includes(jStep())); // the map is not needed: a taller sheet on narrow screens
    // keyboard: the same button again; if the action took it away, the card's main button; a new step, its heading
    if(key){const sel=`[data-action="${key[0]}"]${key[1]!=null?`[data-v="${CSS.escape(key[1])}"]`:''}${key[2]!=null?`[data-k="${CSS.escape(key[2])}"]`:''}`,again=p?.querySelector(sel);
      if(again)again.focus({preventScroll:true});else if(!same){const h=p?.querySelector('.jr .hxh,.tv-main h3,.tvp-cur h3');if(h){h.tabIndex=-1;h.focus({preventScroll:true})}}
      else{const f=p?.querySelector(`[data-action="${key[0]}"]:not([disabled])`)||p?.querySelector('.jr .hxsec .btn.primary:not([disabled]),.tv-main .btn.primary:not([disabled])')||p?.querySelector('.jr .hxsec button:not([disabled]),.tv-main button:not([disabled])');if(f)f.focus({preventScroll:true});else{const h=p?.querySelector('.jr .hxsec .hxh');if(h){h.tabIndex=-1;h.focus({preventScroll:true})}}}}}}}
// A save from before the scene rules is put right as it opens, not at the first tap (app.js drew the page before this file loaded).
{const was=ser([S.phase,S.here,S.journey]);sceneFix();let again=ser([S.phase,S.here,S.journey])!==was;
  // app.js and play.js drew the page before the Journey joined the bar: a reload on the road landed on the next screen (Loot)
  for(const a of ['crow','session']){const L=wsNav(a),land=wsLand(a);if(S.phase==='travel'&&land==='journey'&&S.tab[a]!=='journey'&&S.tab[a]===L.filter(t=>t!=='journey')[0]){S.tab[a]='journey';S.vtab[a][S.phase]='journey';again=true}}
  // the Ref's Map was drawn before hexmap.js and this file loaded (an empty screen): draw it now
  if(S.role==='ref'&&S.area==='session'&&S.tab.session==='rmap')again=true;
  // a point of interest was drawn before its hooks (play.js's stage: greed, the dungeon's setup; no banner, no rest): draw it again
  if(jPoiScene())again=true;
  if(again)render()}
