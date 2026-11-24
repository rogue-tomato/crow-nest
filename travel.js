'use strict';
/* CROW NEST — the travel day without a map (owner, 2026-11-23; mock-ups QA/design/travel-nomap, review page GbkPw5).
   journey.js keeps the day's rules and state; this file draws the Ref's Journey — Plan · Road · Camp, the step beside the day's
   numbers and the party, on one 16:9 screen — and settles the plan by itself (no Lock, owner): once every crow in play has
   answered and the votes give a pace (a tie: the Ref picks among the tied), the tests open. A changed answer before Roll the day
   reopens only what it touches: a new role or task clears that traveller's tier; a pace that changes the tests' edge clears every
   risky tier. Ref-only bookkeeping lives in S.rtravel (planSig, tiePace), never in the shared journey. */

/* ---------- the plan settles itself ---------- */
const tvIn=()=>PLAY().filter(c=>!crowDead(c));
// ready when the role is answered in full (tvRoleDone, below): a half-chosen role must not settle the plan
const tvReady=c=>tvRoleDone(jIn(c),c)&&tvRideDone(c)&&(typeof hrDone!=='function'||(c.hires||[]).every(h=>hrDone(hrIn(c,h))));
const tvVotes=()=>tvIn().map(c=>jIn(c).pace).filter(v=>PACE[v]);
const tvCount=k=>tvVotes().filter(v=>v===k).length;
function tvTied(){const n={};for(const v of tvVotes())n[v]=(n[v]||0)+1;const top=Math.max(0,...Object.values(n));return Object.keys(PACE).filter(k=>n[k]===top)}
const tvVote=()=>JRS.paceVote(tvVotes());
const tvTie=()=>tvVotes().length>0&&!tvVote();
const tvTiePick=()=>{const t=S.rtravel.tiePace;return t&&t.day===S.rtravel.day&&tvTied().includes(t.v)?t.v:null};
// the day's pace: the votes; a tie, the Ref's pick among the tied (null until then); nobody voted, the Ref's own
const tvPace=()=>tvVote()||(tvTie()?tvTiePick():S.rtravel.pace||'normal');
const tvSigs=()=>Object.fromEntries(jAllIn().map(a=>[a.id,`${a.x.role||''}:${a.x.task||''}`]));
function tvClearTier(a){if(a.h)jHireRef(a.c,a.h.uid,{tier:0});else jRefSet(a.c.id,{tier:0,doom:false,effort:false})}
function tvSettle(){if(S.role!=='ref'||S.phase!=='travel'||!S.journey)return false;const st=jStep();if(st!=='plan'&&st!=='roles')return false;
  const ready=tvIn().length>0&&tvIn().every(tvReady),pace=tvPace();
  if(st==='plan'){if(!ready||!pace||jOver().length)return false;
    S.rtravel.pace=pace;S.rtravel.planSig=tvSigs();S.journey={...S.journey,day:S.rtravel.day,step:'roles',plan:{route:[],pace,by:'',nights:[],locked:true}};return true}
  if(!ready||!pace){S.journey={...S.journey,step:'plan',plan:S.journey.plan?{...S.journey.plan,locked:false}:null};return true}
  let ch=false;const sig=S.rtravel.planSig||{},now=tvSigs();
  for(const a of jAllIn())if(sig[a.id]!==undefined&&sig[a.id]!==now[a.id]){tvClearTier(a);ch=true}
  const was=S.journey.plan?.pace;if(pace!==was){if(PACE[was]?.mod!==PACE[pace]?.mod)for(const a of jAllIn())if(jRisky(a.x))tvClearTier(a);
    S.rtravel.pace=pace;S.journey={...S.journey,plan:{...S.journey.plan,pace}};ch=true}
  if(ch||JSON.stringify(sig)!==JSON.stringify(now)){S.rtravel.planSig=now;ch=true}return ch}
{const base=render;render=function(){if(tvSettle())jSave();return base.apply(this,arguments)}}

/* ---------- pieces ---------- */
const TV_STEPS=[['Plan',['plan','roles','script']],['Road',['road']],['Camp',['camp','night','dawn']]];
function tvRail(){const st=jCamping()?'camp':jStep(),cur=TV_STEPS.findIndex(s=>s[1].includes(st));
  return `<ol class="tv-rail" aria-label="Steps of the day">${TV_STEPS.map(([l],i)=>`<li class="${i<cur?'done':i===cur?'cur':''}"${i===cur?' aria-current="step"':''}><i aria-hidden="true">${i<cur?'':i+1}</i>${l}</li>`).join('')}</ol>`}
const tvSeason=()=>`<span class="tv-season" role="group" aria-label="Season, for Bad Weather">Season ${JRS.SEASONS.map(k=>`<button type="button" class="cd-chip" data-action="jseason" data-v="${k}" aria-pressed="${S.journey.season===k}">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</span>`;
const tvAfter=()=>['script','road','camp','night','dawn'].includes(jStep())||jCamping();
function tvKpis(){const after=tvAfter(),T=after?rtDay():jTotals().T,q=!after&&jAllIn().some(a=>jWaiting(a.x)),p=PACE[after?jPace():tvPace()||'normal'];
  const cells=[['Hexes',after?jDayHexes():T.hexes,after?'today':`${p.label.toLowerCase()} pace`],['EN',T.en,'d10 ≤ EN'],['Checks',after?jChecks().length:T.chk,after?`${jChecks().filter(c=>c.hit).length} encounter${jChecks().filter(c=>c.hit).length===1?'':'s'}`:'on the road'],['Rest EN',T.ren,'at camp']];
  return `<div class="tv-kpis">${cells.map(([k,v,m],i)=>`<div class="tv-kpi${i?'':' big'}"><small>${k}</small><b>${v}${q&&i<2?'<q aria-label="(not settled)">?</q>':''}</b><small>${m}</small></div>`).join('')}</div>`}
const tvAv=(c,h)=>h?`<span class="tv-av" aria-hidden="true">${esc((h.name||'?')[0])}</span>`:crowAv(c,32,crowDead(c)?'dead':'');
const tvRide=c=>{const r=jStep()!=='off'?jRide(c):null;return r?(r.kind==='mount'?`rides ${esc(r.pets[0].name)}`:`${r.pets.map(p=>esc(p.name)).join(' and ')} pull the cart`):''};
// the Miasma on the crow's line (owner, 2026-11-23: the Ref's Miasma view left the bar)
const tvMi=c=>c.cruelty||c.miasma.length?`<span class="tv-mi">${[c.cruelty?`cruelty ${c.cruelty}`:'',...c.miasma.map(m=>esc(m.n))].filter(Boolean).join(' · ')}</span>`:'';
function tvRows(){const out=[];for(const c of PLAY()){const x=jIn(c);out.push({c,id:c.id,x});for(const h of c.hires||[])out.push({c,h,id:`${c.id}/${h.uid}`,x:(x.hires||{})[h.uid]||{}})}return out}
function tvRow(a,st,what){const {c,h,x}=a,sub=h?`${jName(c)}’s hireling${jHirePaid(h)?'':' · <span class="hr-bad">✗ not paid</span>'}`:[tvMi(c),tvRide(c)].filter(Boolean).join(' · ');
  return `<div class="tv-row${h?' hire':''}">${tvAv(c,h)}<span class="nm"><b>${h?esc(h.name):jName(c)}</b>${sub?`<span>${sub}</span>`:''}</span><span class="what">${what??(x.role&&x.role!=='none'?jTaskLine(x):x.role==='none'?'<span class="muted">no role today</span>':'<span class="muted">—</span>')}</span><span class="st">${st}</span></div>`}
const tvWarns=()=>{const tired=(S.journey.tired||[]).map(id=>PARTY.find(c=>c.id===id)).filter(Boolean);
  return jWarns()+(tired.length?`<p class="jr-warn">${tired.map(jName).join(', ')} didn’t finish a rest last night: an exhaustion wound each (they mark it on their Journey).</p>`:'')};
// the way the players showed on the table (Owlbear): the route's own modifiers
const TV_WAY=[['road','Road all day','+1 hex'],['river','Ford or upstream','−1 hex'],['down','Downstream','+1 hex'],['dungeon','Monster lands','EN +1']];
function tvPaceHTML(){const tied=tvTie()?tvTied():[],pick=tvTiePick(),p=tvPace(),vs=k=>`<span class="jr-votes">${jPaceVotes(k)}</span>`;
  if(tied.length&&!pick)return `<div class="tv-tie"><h4>Pace · a tie <span class="tv-note">you pick</span></h4><div class="cd-chips" role="group" aria-label="Pace: the tie">${tied.map(k=>`<button type="button" class="cd-chip" data-action="tvtie" data-v="${k}" aria-pressed="false">${PACE[k].label}${vs(k)}</button>`).join('')}</div></div>`;
  const P=PACE[p],others=Object.keys(PACE).filter(k=>k!==p&&tvCount(k));
  return `<div class="tv-sec"><h4>Pace <span class="tv-note">${pick?'a tie: your pick':tvVotes().length?'the players’ votes decide':'nobody voted: yours'}</span></h4>
    <p class="tv-pace"><b>${P.label}</b>${vs(p)}<span class="tv-note">${P.hex} hex${P.hex>1?'es':''} · EN ${P.en}${others.length?' · '+others.map(k=>`${PACE[k].label} ${tvCount(k)}`).join(', '):''}</span></p>
    ${pick?`<div class="cd-chips" role="group" aria-label="Pace: the tie">${tied.map(k=>`<button type="button" class="cd-chip" data-action="tvtie" data-v="${k}" aria-pressed="${k===p}">${PACE[k].label}</button>`).join('')}</div>`
      :tvVotes().length?'':`<div class="cd-chips" role="group" aria-label="Pace">${Object.entries(PACE).map(([k,x])=>`<button type="button" class="cd-chip" data-action="rpace" data-v="${k}" aria-pressed="${k===p}">${x.label}</button>`).join('')}</div>`}</div>`}
function tvWay(){const m=S.rtravel.mods||{},none=!TV_WAY.some(([k])=>m[k]);
  return `<section class="tv-card"><div class="tv-sec"><h4>Which way today <span class="tv-note">what the players showed</span></h4><div class="cd-box flat"><div class="cd-chips" role="group" aria-label="The way today">
    <button type="button" class="cd-chip" data-action="tvway" data-v="" aria-pressed="${none}">Open country</button>${TV_WAY.map(([k,l,e])=>`<button type="button" class="cd-chip" data-action="tvway" data-v="${k}" aria-pressed="${!!m[k]}">${l} <span class="cd-why">${e}</span></button>`).join('')}</div></div></div>${tvPaceHTML()}</section>`}

/* ---------- the steps ---------- */
function tvPlan(){const wait=tvIn().filter(c=>!tvReady(c)),over=jOver(),tie=tvTie()&&!tvTiePick(),n=tvIn().length;
  const rows=tvRows().map(a=>tvRow(a,!a.h&&crowDead(a.c)?dqPill('bad','dead'):over.includes(a.id)?dqPill('bad','slot taken'):(a.h?hrDone(a.x):tvRoleDone(a.x,a.c))?dqPill('good','ready'):dqPill('wait','choosing'))).join('');
  const why=over.length?dqPill('bad',`${over.map(jWho).join(', ')}: one guide, one scout (two with Places)`):wait.length?dqPill('wait',`${wait.map(jName).join(', ')} ${wait.length>1?'are':'is'} choosing`):tie?dqPill('wait','Pick the pace'):'';
  const out=over.filter(id=>!String(id).includes('/')).map(id=>`<button class="btn ghost" data-action="jrout" data-k="${esc(id)}">Leave ${jWho(id)} out</button>`).join('');
  return `<section class="tv-card"><div class="tv-board"><h3>The party <small>${n-wait.length} of ${n} ready · the tests open when everyone is</small></h3>${rows}${sesFrozenRows()}</div>${tvWarns()}
    <div class="tv-acts"><button class="btn" data-action="jprep" data-v="road" disabled>Roll the day →</button>${why}${hrUnpaidNote()}<span class="grow"></span>${out}${wait.length?`<button class="btn ghost" data-action="jrout" data-k="${esc(wait[0].id)}">Go without ${jName(wait[0])}</button>`:''}<button class="btn ghost" data-action="jstay">Stay here today</button>${S.journey.from&&!(S.rtravel.moved>0)?'<button class="btn ghost" data-action="jcancel">Cancel the departure</button>':''}</div></section>`}
const TV_ORDER=['supporter','assist','guide','scout','tracker','none',''];
function tvTests(){const all=jAllIn().slice().sort((a,b)=>TV_ORDER.indexOf(a.x.role||'')-TV_ORDER.indexOf(b.x.role||'')),miss=all.filter(a=>jWaiting(a.x));
  const rows=all.map(a=>{const x=a.x,risky=jRisky(x),def=x.role==='assist'?J_ASSIST:x.task?jTaskDef(x.task):null;
    const st=risky?dqTiersHTML({k:`${a.id}|tier`,sel:x.doom?0:x.tier||0,doom:a.h?undefined:!!x.doom,was:x.effort&&x.tier>1?x.tier-1:undefined,label:a.h?a.h.name:a.c.name,mod:jTierMod(a),dice:true}):x.role&&x.role!=='none'?dqPill('good','safe'):'';
    return tvRow(a,st,x.role&&x.role!=='none'?`${jTaskLine(x)} <span class="muted">· ${risky?`2d10 + ${def?.ch?.join(' or ')||'?'}`:'safe'}</span>${x.effort&&x.tier?' <span class="dq-tag warn">+1 Effort</span>':''}`:'<span class="muted">no role today</span>')}).join('');
  return `<section class="tv-card"><div class="tv-board"><h3>Role tests <small>totals: tier 1 ≤11 · tier 2 12–16 · tier 3 17+</small></h3>${rows}</div>${tvWarns()}
    <div class="tv-acts"><button class="btn${miss.length?'':' primary'}" data-action="jprep" data-v="road">Roll the day →</button>${miss.length?dqPill('wait',`${miss.length} test${miss.length>1?'s':''} to go`):`<span class="tv-note">rolls today’s ${rtDay().chk} check${rtDay().chk===1?'':'s'} and opens the road</span>`}${hrUnpaidNote()}<span class="grow"></span><button class="btn ghost" data-action="jstay">Stay here today</button></div></section>`}
// the road: the day's hexes, the party's marker on the one the token stands on in Owlbear; what waits ahead is the Ref's to see
const TV_HEX='<polygon points="42,2 82,25 82,71 42,94 2,71 2,25"/>';
function tvStrip(sc){const last=sc.path.length-1,at=sc.at,from=VILLAGES.find(v=>v.id===S.journey.from);
  const cell=i=>{const st=sc.stops.filter(x=>x.i===i&&x.state!=='removed'&&x.kind!=='rest'),enc=st.find(x=>x.kind==='enc'),pl=st.find(x=>x.kind==='village'||x.kind==='poi');
    const live=enc&&enc.state!=='done',cls=[i===0?'start':'',i<at?'done':i===at?'cur':'',live?(i===at?'now':'ev'):'',i===last&&i>0&&!live?'camp':''].filter(Boolean).join(' ');
    const cap=live?(i===at?esc(enc.text||'Encounter'):'Encounter'):enc?`${esc(String(enc.text||'Encounter').split(':')[0])} ✓`:pl?esc(pl.text||''):i===0?esc(from?.name||'Start'):i===last&&i>0?'camp':'';
    const dd=sc.lost&&i&&sc.dirs?.[i-1],dir=dd?TV_DIRS[S.rtravel.flat?'flat':'pointy'][dd-1]:null;
    return `<div class="tv-hx ${cls}${dir?' dir':''}" role="listitem">${i===at?'<span class="here">Here</span>':''}<svg viewBox="0 0 84 96" aria-hidden="true">${TV_HEX}<text x="42" y="48">${dir?dir[0]:i?i:'⌂'}</text></svg><span class="cap">${dir&&!live?`${dd} · ${dir[1]}`:cap}</span></div>`};
  return `<div class="tv-strip" role="list" aria-label="Today’s hexes">${sc.path.map((k,i)=>cell(i)).join('')}</div>`}
function tvRoad(){const sc=S.journey.script;if(!sc)return '';const last=sc.path.length-1,here=jHere(sc),ahead=sc.stops.filter(x=>x.kind==='enc'&&x.state==='pending'&&x.i>sc.at).length;
  const walk=here.length?`<div class="tv-walk"><button class="btn" disabled>Next hex → ${Math.min(last,sc.at+1)}</button><button class="btn ghost" data-action="jstophere">Make camp here</button></div>`
    :sc.at<last?(J_WALKING?`<div class="tv-walk"><span class="jr-walking">Walking… hex ${sc.at}</span><button class="btn primary" data-action="jskip">Skip ⏭</button></div>`
      :`<div class="tv-walk"><button class="btn primary" data-action="jstep">Next hex → ${sc.at+1}</button><button class="btn" data-action="jwalk">Walk on to the next stop</button><button class="btn" data-action="plarrive">${nest('The crows arrive')}</button><button class="btn ghost" data-action="jstophere">Make camp here</button></div>`)
    :`<div class="tv-walk"><button class="btn primary" data-action="jcamp">Make camp →</button><button class="btn" data-action="plarrive">${nest('The crows arrive')}</button></div>`;
  // a stop here: its card takes the step's room; the day's hexes wait in the side column (tvRoadSide)
  if(here.length){const card=jStopCardRef(here[0]),more=here.length>1?`<p class="tv-note">and ${here.length-1} more here, next</p>`:'';
    return /^\s*<div class="st-enc/.test(card)?card+more:`<section class="tv-card">${card}${more}</section>`} // an encounter's card is a card already
  return `<section class="tv-card tv-road"><div><p class="tv-roadh"><b>Hex ${sc.at} of ${last}</b>${sc.lost?`<span class="tv-lost"><span class="tag">Lost</span><span class="tv-note">${sc.dirs?'a d6 per hex: the arrow is the way':'each hex by a d6'}</span><button type="button" class="cd-chip" data-action="tvflat" aria-label="Hex grid: ${S.rtravel.flat?'flat':'pointy'} tops (change)">${S.rtravel.flat?'Flat':'Pointy'} hexes</button></span>`:''}<span class="muted">${sc.lost?'':here.length?'a stop here':ahead?`${ahead} encounter${ahead>1?'s':''} ahead`:'a quiet road'}</span><button class="linkbtn" data-action="jsadd">Add a check</button></p>${tvStrip(sc)}</div>${walk}
</section>`}
function tvRoadSide(){const sc=S.journey.script;if(!sc||!jHere(sc).length)return '';
  return `<section class="tv-card"><div class="tv-sec"><h4>Today’s hexes${sc.lost?' <span class="tv-mi">lost</span>':''}</h4>${tvStrip(sc)}<div class="tv-acts" style="border:0;padding:0"><button class="btn ghost" data-action="jstophere">Make camp here</button><button class="linkbtn" data-action="jsadd">Add a check</button></div></div></section>`}

// today's role results, one line a traveller (journey.js jResult): what is settled says so; what waits keeps its words and its act
function tvResults(lost=!!S.rtravel.lost){const over=new Set(jOver()),rows=jAllIn().map(a=>jResult(a,lost,over)).filter(Boolean);if(!rows.length)return '';
  const todo=rows.filter(r=>r.st[0]==='wait').length,cls={ok:'good',wait:'wait',bad:'bad'};
  return `<section class="tv-card"><div class="tv-board"><h3>Today’s results <small>${todo?`${todo} to settle`:'all in the day'}</small></h3>${rows.map(r=>`<div class="tv-row side${r.a.h?' hire':''}">${tvAv(r.a.c,r.a.h)}<span class="nm"><b>${r.a.h?esc(r.a.h.name):jName(r.a.c)}</b><span>${r.head}${r.st[0]==='wait'?` — ${r.line}`:''}</span></span><span class="st">${dqPill(cls[r.st[0]]||'',r.st[1])}</span>${r.act?`<div class="act">${r.act}</div>`:''}</div>`).join('')}</div></section>`}

/* ---------- an encounter asks what its table needs (owner, 2026-11-23: only when it needs it; the last answer pressed) ---------- */
const TV_LAND=[['grassland','Grassland'],['forest','Forest'],['marsh-swamp','Marsh'],['hill-mountain','Hills'],['desert','Desert'],['cold-climate','Cold lands'],['coastal','Coast']]; // the animal tables' lands (The Ref: Wild Animal)
const TV_CLIME=[['temperate','Temperate'],['cold','Cold lands'],['desert','Desert'],['tropical','Tropical']];
const tvCheckOf=st=>st&&(st.kind==='rest'?S.rtravel.restChecks||[]:jChecks())[st.check];
jCtxHTML=(st,c)=>{if(!c)return '';const k=esc(st.id);
  if(c.text==='Wild Animal'&&!c.html&&st.state!=='pending'){const cur=c.land||'forest',last=TV_LAND.find(l=>l[0]===S.rtravel.land);
    return `<div class="tv-ctx"><p class="tv-ctx-h" title="The animals live by the land${last?`; last time: ${last[1].toLowerCase()}`:''}">Where are the crows?</p><div class="cd-chips" role="group" aria-label="The land">${TV_LAND.map(([v,l])=>`<button type="button" class="cd-chip" data-action="tvland" data-k="${k}" data-v="${v}" aria-pressed="${v===cur}">${l}</button>`).join('')}</div></div>`}
  if(c.text==='Bad Weather'&&st.state==='pending'){const cur=S.rtravel.climate||'temperate',g=JRS.weatherGroup(cur,S.journey.season),rows=(BOOK['ref-bad-weather']?.body||[]).find(x=>x.tb)?.tb?.slice(1),pair=g&&rows?`${JRS.weatherFor(rows,g,1)} or ${JRS.weatherFor(rows,g,2)}`:'';
    return `<div class="tv-ctx"><p class="tv-ctx-h">Where and when? <span class="tv-note">${pair?`${esc(pair)} · any die, odd the first`:'set the season at the top'}</span></p><div class="cd-chips" role="group" aria-label="The land">${TV_CLIME.map(([v,l])=>`<button type="button" class="cd-chip" data-action="tvclime" data-v="${v}" aria-pressed="${v===cur}">${l}</button>`).join('')}</div></div>`}
  return ''};
// a Wild Animal revealed takes the land of the last one (the Ref changes it on the card)
{const f=A.jreveal;A.jreveal=b=>{const st=S.journey.script?.stops.find(x=>x.id===b.dataset.k),c=tvCheckOf(st);if(c?.text==='Wild Animal'&&!c.land&&S.rtravel.land){c.land=S.rtravel.land;c.sub=`${c.land}-animal-encounters`}return f(b)}}
// Lost (Rules): a d6 for each hex the group leaves, counted clockwise from the northernmost neighbour; a grid with pointy tops has
// none due north, so from the north-east (as the map did). The Ref says which grid the table's Owlbear map has.
const TV_DIRS={pointy:[['↗','NE'],['→','E'],['↘','SE'],['↙','SW'],['←','W'],['↖','NW']],flat:[['↑','N'],['↗','NE'],['↘','SE'],['↓','S'],['↙','SW'],['↖','NW']]};

/* ---------- the Ref's Journey ---------- */
function tvRef(){const st=jStep();if(typeof plVisit==='function'&&plVisit())return `<div class="tv"><header class="tv-head">${tvRail()}${tvSeason()}</header><div class="tv-grid"><div class="tv-main">${plVisitCard()}</div><aside class="tv-side">${tvKpis()}</aside></div></div>`;
  if(st==='off'||S.phase!=='travel'||jPoiScene())return '';
  const main=st==='plan'?tvPlan():st==='roles'?tvTests():st==='script'?(S.journey.script?`<section class="tv-card">${jScriptRef()}</section>`:''):st==='road'?tvRoad():`<section class="tv-card">${jCampRef()}</section>`;
  const side=tvKpis()+(st==='plan'||st==='roles'?tvWay():'')+(st==='road'?tvRoadSide():'')+((st==='road'&&!jHere(S.journey.script||{stops:[]}).length)||st==='script'?tvResults():'');
  const stop=st==='road'&&S.journey.script&&jHere(S.journey.script).length>0;
  return `<div class="tv${stop?' stop':''}"><header class="tv-head">${tvRail()}${tvSeason()}</header><div class="tv-grid"><div class="tv-main">${jRoadCombatRef()}${dqAsksRefHTML()}${jEffects()}${main}${dqWxRefHTML()}</div><aside class="tv-side">${side}</aside></div></div>`}
{const old=SCREENS.rmap;SCREENS.rmap=()=>tvRef()||old()}
// the status line names the day's three steps: the roles and the script are the Plan now
{const base=whereParts;whereParts=()=>{const w=base();return w[0]==='travel'?w.map(x=>x==='Roles step'||x==='Script step'?'Plan step':x):w}}
Object.assign(A,{
  tvtie:b=>{S.rtravel.tiePace={day:S.rtravel.day,v:b.dataset.v};jDone()},
  tvland:b=>{const c=tvCheckOf(S.journey.script?.stops.find(x=>x.id===b.dataset.k));if(!c)return;c.land=b.dataset.v;c.sub=`${c.land}-animal-encounters`;S.rtravel.land=c.land;jDone()},
  tvclime:b=>{S.rtravel.climate=b.dataset.v;jDone()},
  tvflat:()=>{S.rtravel.flat=!S.rtravel.flat;jDone()},
  tvway:b=>{const k=b.dataset.v,m={...(S.rtravel.mods||{})};if(!k)for(const r of JRS.ROUTE_KEYS)delete m[r];else if(m[k])delete m[k];else m[k]=true;S.rtravel.mods=m;jDone()}});

/* ---------- the player's Journey: one question open at a time (owner, 2026-11-23) ----------
   A tap answers and the next question opens; an answer folds into a line with Change until the Ref rolls the day. Then the test,
   the road and the camp as journey.js draws them, under the plan's lines. */
const tvpDone=(k,v,ch)=>`<div class="tvp-done"><span class="tick" aria-hidden="true">✓</span><span><span class="k">${k}</span><span class="v">${v}</span></span>${ch?`<button class="linkbtn" data-action="tvchange" data-v="${ch}">Change</button>`:''}</div>`;
const tvpNext=(n,t)=>`<div class="tvp-next"><i aria-hidden="true">${n}</i><span>${t}</span></div>`;
const tvpStep=(n,t,sub,body)=>`<section class="tvp-cur"><h3 class="tvp-q"><span class="n" aria-hidden="true">${n}</span>${t}${sub?` <small>${sub}</small>`:''}</h3>${body}</section>`;
// a role is answered when nothing more is asked of it: its task, the ally a fight or an assist names, what a tracker tracks,
// the allies Support Everyone names (none to name while no other crow is a guide, scout or tracker: it opens again when one is)
const tvAllies=c=>PLAY().some(o=>o!==c&&['guide','scout','tracker'].includes(jIn(o).role));
const tvRoleDone=(x,c)=>!!x.role&&(x.role==='none'||(x.role==='assist'?(x.targets||[]).length>0:!!x.task&&(x.task!=='track'||!!x.what)&&(x.task!=='fight'||(x.targets||[]).length>0)&&(x.task!=='everyone'||(x.targets||[]).length>0||!tvAllies(c))));
function tvpParty(me,f){return `<div class="tvp-party">${PLAY().filter(o=>o!==me).map(o=>{const [cls,t]=f(o);return `<span class="${cls}">${crowAv(o,28,crowDead(o)?'dead':'')}${jName(o)} <em>${t}</em></span>`}).join('')}</div>`}
function tvPlayer(){const st=jStep(),c=jMe();if(st==='off'||!c||S.phase!=='travel'||jPoiScene()||crowDead(c))return '';
  const x=jIn(c),open=st==='plan'||st==='roles',lines=[];
  if(x.pace)lines.push(tvpDone('Your vote',`${PACE[x.pace].label} pace`,open&&'pace'));
  if(tvRoleDone(x,c))lines.push(tvpDone('Your role',jTaskLine(x),open&&'role'));
  if(tvBig(c).length&&tvRideDone(c))lines.push(tvpDone('You travel',tvRideLine(c),open&&'ride'));
  lines.push(...hrLines(c,open));const hn=open&&hrNextHTML(c,st,tvBig(c).length?4:3);
  let cur='',pre='';const ask=()=>tvpStep(1,'How fast?','your vote · the votes decide',`<div class="tvp-opts">${Object.entries(PACE).map(([k,p])=>`<button class="opt" data-action="jpace" data-v="${k}" aria-pressed="false"><b>${p.label}</b><span class="small muted">${p.hex} hex${p.hex>1?'es':''} · EN ${p.en}${p.mod?` · role tests ${p.mod==='edge'?'+2':'−2'}`:''}</span><span class="jr-votes">${jPaceVotes(k)}</span></button>`).join('')}</div>`);
  // the questions are the plan's: on the road and at camp a crow the Ref answered for (or who never voted) is never stopped by them
  if(st==='plan'&&!x.pace)cur=ask()+tvpNext(2,'Your role');
  else if(st==='plan'&&!tvRoleDone(x,c))cur=tvpStep(2,'Your role today','supporters, then the guide, scouts, trackers',jPlanPlayer('role'));
  else if(st==='plan'&&!tvRideDone(c))cur=tvRideStep(c,3);
  else if(st==='plan'&&hn)cur=hn;
  else if(st==='plan')cur=`<section class="tvp-cur ready"><div class="tvp-wait">${dqPill('good','You’re ready')}<span class="tv-note">the tests open when everyone is</span></div>${tvpParty(c,o=>tvReady(o)?['ok','✓ ready']:['wait','◷ choosing'])}</section>`;
  else if(st==='roles')cur=(x.pace?'':ask())+(hn||'')+'<div class="tvp-tests">'+(jRisky(x)?tvpStep(3,`Your test: ${esc(x.role==='assist'?'Assist':JRS.TASK_NAMES[x.task])}`,'',jTestCard(c,x)):`<section class="tvp-cur"><div class="tvp-wait">${dqPill('good',x.role==='none'?'No role today':`${esc(JRS.TASK_NAMES[x.task]||'')} is safe`)}<span class="tv-note">nothing to roll</span></div></section>`)
    +jHireTests()+'</div>'+tvpParty(c,o=>{const y=jIn(o);return jRisky(y)?(y.tier?['ok',`✓ tier ${y.tier}`]:['wait','◷ testing']):['ok','✓ safe']});
  else if(st==='road')cur=`<section class="tvp-cur">${jRoadPlayer()}</section>${tvResults(!!jPub().script?.lost)}`;
  else{const cs=st==='camp'&&tvCampSteps(c);if(cs){lines.splice(0,lines.length,...cs.lines);pre=cs.top;cur=cs.cur}else cur=`<section class="tvp-cur">${jPanel({rail:false})}</section>`}
  // My crow (rations, cruelty) closes the row of answers, not a row of its own; camp has it through jPanel
  const me=st==='plan'||st==='roles'||st==='road'?jMyCrow():'';
  return `<div class="tvp">${jTiredCard()}${jEffects()}${pre}${lines.length||me?`<div class="tvp-lines">${lines.join('')}${me}</div>`:''}${cur}${jWxPlayer()}</div>`}
{const old=SCREENS.journey;SCREENS.journey=()=>S.area==='session'?old():tvPlayer()||old()}
// a keyboard answer folds its question away: the focus goes on to the next question, or else to the last Change
// (after chips.js, which keeps it on a chip still drawn)
document.addEventListener('click',e=>{if(e.detail!==0||!e.target.closest?.('.tvp'))return;setTimeout(()=>{const a=document.activeElement;if(a&&a!==document.body&&a.isConnected)return;
  ($('.tvp-cur button:not([disabled])')||$$('.tvp-done [data-action=tvchange]').pop())?.focus({preventScroll:true})},0)});
Object.assign(A,{tvchange:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;if(b.dataset.v==='pace')jMine({pace:''});else if(b.dataset.v==='ride')jMine({ride:''});else if(b.dataset.v==='act'){jMine({act:'',pick:''});dqMine(c,{act:null,pick:null})}else if(b.dataset.v==='food')jMine({food:''});else{jRefund(c,x);jMine({role:'',task:'',targets:[],tier:0,doom:false,effort:false,what:''})}jDone()}});
/* ---------- how the crow travels: a step of the plan when the crow has a Large animal (owner, 2026-11-24) ----------
   ride: '' not answered, 'foot', 'p:<uid>' rides it, 'v:<uid>,…' a vehicle they pull (journey.js jRide); yesterday's answer carries
   over (jMine). One tap answers: each animal alone pulls, any two together (with three or more), or all of them. */
const tvBig=c=>(c.pets||[]).filter(jBig);
const tvRideDone=c=>!tvBig(c).length||jIn(c).ride==='foot'||!!jRide(c);
function tvRideStep(c,n){const ps=tvBig(c),slow=a=>Math.min(...a.map(jPetSpeed)),both=ps.map(p=>esc(p.name)).join(' and ');
  const items=[{v:'foot',label:'On foot',why:`speed ${speed(c)}`},...ps.map(p=>({v:'p:'+p.uid,label:`Ride ${esc(p.name)}`,why:`speed ${jPetSpeed(p)}${(p.prayer||0)>0?' · Mount’s Prayer':''}`})),
    ...ps.map(p=>({v:'v:'+p.uid,label:`${esc(p.name)} pulls a vehicle`,why:`speed ${jPetSpeed(p)}`})),
    ...(ps.length>2?ps.flatMap((p,i)=>ps.slice(i+1).map(q=>({v:`v:${p.uid},${q.uid}`,label:`${esc(p.name)} and ${esc(q.name)} pull a vehicle`,why:`speed ${slow([p,q])}`}))):[]),
    ...(ps.length>1?[{v:'v:'+ps.map(p=>p.uid).join(','),label:`${ps.length>2?'All of them':both} pull a vehicle`,why:`speed ${slow(ps)}`}]:[])];
  return tvpStep(n,'How you travel','the slowest sets the pace · <a href="#rule/c-vehicles" data-action="open-rule" data-k="c-vehicles">Vehicles</a>',chipBox({label:'How you travel',action:'jride',sel:null,items}))}
const tvRideLine=c=>{const r=jRide(c),slow=a=>Math.min(...a.map(jPetSpeed));if(!r)return `On foot · speed ${speed(c)}`;
  return r.kind==='mount'?`Ride ${esc(r.pets[0].name)} · speed ${jPetSpeed(r.pets[0])}`:`${r.pets.map(p=>esc(p.name)).join(' and ')} pull${r.pets.length>1?'':'s'} a vehicle · speed ${slow(r.pets)}`};
// Go without X: they travel on foot if they never said
{const base=A.jrout;A.jrout=b=>{const c=PARTY.find(x=>x.id===b?.dataset?.k);if(c&&!tvRideDone(c))jRefSet(c.id,{ride:'foot'});return base(b)}}
/* ---------- the camp, one question at a time (the mock's p6; owner, 2026-11-24: all of it at once scrolled) ----------
   The camp's line and a rest encounter first; the answers fold into lines with Change; then the activity, the food, and the rest
   (what to tell the Ref, the wait, Finish without a Ref). A finished rest is the old panel (journey.js jCampParts().done). */
function tvCampSteps(c){if(jRested(c))return null;const P=jCampParts(c),ctx=P.ctx||{kind:'camp',place:P.cp.place},a=dqAct(c),it=a===undefined?null:dqActItem(c,ctx),f=dqFood(c,ctx);
  const choosing=a===undefined||it?.st==='wait'&&/choosing/.test(it.what||''),food={own:`Eat ${P.need} ration${P.need>1?'s':''}`,inn:'The inn',home:'Fed at home',none:'Go hungry'};
  const lines=[];if(!choosing)lines.push(tvpDone('Your activity',it?.line||it?.what||'No activity','act'));if(f!==undefined)lines.push(tvpDone('Food',food[f]||esc(f),'food'));
  const cur=choosing?tvpStep(1,'Your activity','one per rest',P.act())+tvpNext(2,'Food')
    :f===undefined?tvpStep(2,'Food',`${P.need} ration${P.need>1?'s':''} · you carry ${P.rat}`,P.food())+tvpNext(3,'Your rest')
    :`<section class="tvp-cur jr-finish"><h3 class="tvp-q"><span class="n" aria-hidden="true">3</span>Your rest</h3>${P.rest(['act','food'])}</section>`;
  return {top:P.top,lines,cur}}
// the modifier a role test's tier buttons count with (totals and dice on each): the crow's card's, or the hireling's
const jTierMod=a=>{try{return a.h?jHireTestMod(a.h,a.x):jTestMod(a.c,a.x).mod}catch{return 0}};
