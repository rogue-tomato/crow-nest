'use strict';
/* CROW NEST — the table stage (UX redesign, 2026-11-11; docs/ux-redesign/).
   Ref: the dungeon turn is one screen that follows the state of play — set up → turn → fight → after the fight → end of turn.
   Player: a vitals strip (HUD) on every crow tab, damage from anywhere.
   Everyone: one search over rules, items and monsters in the side panel.
   Loads right after app.js; journey.js wraps SCREENS.session after this file.
   S.scene and S.hud are this device's view only: never in snap() or the journal scopes.
   Where the game stands (combat begun or over, the clock held by it, encounters waiting) lives in S.dt (app.js): it is saved,
   journaled and survives a reload. */
S.scene={miss:null,set:false,pick:false,loot:false,focus:null,dock:false};
S.hud=Object.assign({dmg:false,open:false,inv:false,acts:false},S.hud); // inv: the Inventory overlay is open; acts: the Sheet's Actions are expanded

/* ================= Ref: the dungeon stage ================= */
// What the stage shows comes from the game state, so Undo, a reload and the shared table can't leave it stale.
// Creatures on the tracker are an encounter being prepared until the Ref begins combat; only that stops the clock.
// The road works the same way (S.dt.fight, journaled with the session) but has no clock to stop (journey.js).
const inFight=()=>S.phase==='delve'||S.phase==='travel'?S.dt.fight==='on':S.combat.length>0;
const sceneOf=()=>{const t=S.dt;return inFight()?'fight':S.phase==='delve'&&t.fight==='over'?'after':t.end?'end':!t.running&&t.left>=t.len*60?'setup':'turn'};
const dtLeft=()=>S.dt.left;
// A Point of Interest on the road (journey.js, owner 2026-11-16) is played on this same stage: Dungeon turns and their clock, combat,
// loot. stagePoi() is its stop on the journey (null in a dungeon); journey.js sets these hooks. At a POI encounter checks use the
// travel day's EN and the travel tables (Rules: POIs) and there is no greed (Rules: Greed Bonus is for dungeons).
let stagePoi=()=>null,stageEN=()=>enOf(),poiEncHTML=()=>'',poiAskHTML=()=>'';
const stageName=()=>{const p=stagePoi();return p?esc(p.text||'the place'):''};
const greedNow=()=>S.dt.again||stagePoi()?0:[30,20,10][S.dt.n-1]||0; // greed counts only the first time the party enters a dungeon
// the end-of-turn encounter of this turn is dealt with: cleared by hand, or fought (Undo of that fight brings the card back)
const endFought=()=>!!S.dt.end?.fought;
// Run a journaled change; returns the id of the entry it made (true when nothing changed, so there is nothing to undo).
function journaled(label,scopes,fn){const was=JOURNAL[JOURNAL.length-1]?.id;journalRun(label,scopes,fn);const e=JOURNAL[JOURNAL.length-1];return e&&e.id!==was?e.id:true}
// The monsters an encounter line brings, and the line without its per-group buttons (the stage adds them all at once).
function encParts(ec){if(!ec?.hit)return {mons:[],html:''};const t=document.createElement('template');t.innerHTML=encounterText(ec.text,ec);
  const mons=[...t.content.querySelectorAll('[data-action=fight]')].map(b=>({id:b.dataset.id,n:+b.dataset.n||1})).filter(x=>MON[x.id]);
  t.content.querySelectorAll('[data-action=fight]').forEach(b=>b.remove());const html=t.innerHTML;
  t.content.querySelectorAll('a[data-action=open-mon],b.roll').forEach(e=>e.remove());
  return {mons,html,prose:/[a-z]{3,}/i.test(t.content.textContent.replace(/\b(and|or)\b|\d+d\d+/gi,''))}}
function addMonster(id,k=1){const m=MON[id];if(!m)return;for(let j=0;j<k;j++){const n=S.combat.filter(x=>x.id===m.id).length+1;S.combat.push({uid:UID++,id:m.id,n,st:parseInt(m.st.Stamina)||1,ad:parseInt(m.st.AD)||0})}}
// Combat stops the dungeon clock (Rules: the turn is paused for combat). Only Begin combat calls this; the turn comes back when the Ref resumes it.
function pauseForFight(){if(S.phase!=='delve'||!S.dt.running)return false; // the dungeon clock is untouched on the road
  S.dt.running=false;S.dt.held=true;return true}
// One journal entry: the creatures it brings, the clock stopping, the combat state, the card it came from. Undo takes all of it back.
function beginCombat(add){const j=journaled('Combat began',['session'],()=>{add&&add();pauseForFight();S.dt.fight='on'});Object.assign(S.scene,{pick:false,set:false,miss:null,focus:null});return j}
const crLabel=x=>{const m=MON[x.id];return m.name+(x.n>1||S.combat.filter(y=>y.id===x.id).length>1?' #'+x.n:'')};
const focusOf=()=>S.combat.find(x=>x.uid===S.scene.focus)||S.combat.find(x=>x.st>0)||S.combat[0];

// the line under Monsters here: whether the family is the one remembered on the place delved (journey.js)
let famNoteHTML=()=>'';
function setFormHTML(){const t=S.dt;
  if(stagePoi())return `<div class="st-set">
    <label>Turn length <select data-action="dt-len">${[20,30,60].map(n=>`<option value="${n}" ${t.len===n?'selected':''}>${n} min</option>`).join('')}</select></label>
    <p class="st-en"><a class="term" href="#rule/en" data-term="en">EN</a> <b>${stageEN()}</b> <span class="muted">today’s, from the travel day: an encounter on d10 ≤ ${stageEN()}, rolled on the travel tables (<a href="#rule/r-pois" data-action="open-rule" data-k="r-pois">POIs</a>)</span></p></div>`;
  return `<div class="st-set">
    <label>Turn length <select data-action="dt-len">${[20,30,60].map(n=>`<option value="${n}" ${t.len===n?'selected':''}>${n} min</option>`).join('')}</select></label>
    <label>Monsters here <select data-action="dt-dun">${Object.entries(FAMS).map(([k,v])=>`<option value="${k}" ${t.dungeon===k?'selected':''}>${v}</option>`).join('')}</select></label>${famNoteHTML()}
    <label class="check"><input type="checkbox" data-action="dt-crowd" ${t.crowded?'checked':''}> Crowded level <span class="muted">+1 EN</span></label>
    <label class="check"><input type="checkbox" data-action="dt-chaos" ${t.chaos?'checked':''}> Trail of chaos <span class="muted">+1 EN</span></label>
    <p class="st-en"><a class="term" href="#rule/en" data-term="en">EN</a> <b>${enOf()}</b> <span class="muted">an encounter on d10 ≤ ${enOf()}</span>${t.n>1||t.left<t.len*60?(t.running?' <span class="muted small st-nd">Pause the clock to start a new delve.</span>':` <button class="btn sm ghost" data-action="st-newdelve">New delve: back to DT 1</button>`):''}</p></div>`}
const setSummary=()=>stagePoi()?`${S.dt.len} min · today’s EN ${stageEN()}`:`${S.dt.len} min · ${FAMS[S.dt.dungeon]} · EN ${enOf()}${greedNow()?` · greed +${greedNow()}%`:''}`;
// One encounter card, whatever brought it: a check that hit in the dungeon, the end of the turn, the road (journey.js), or the
// creatures the Ref puts together himself. Who comes (each creature with its count), what the table said, one Begin combat.
// o: cls (hit now / hit soon / prep), roll, title, sub, what, extra (what the source adds: a merchant, a follow-up roll),
//    mons [{id,n}], edit (steppers: the creatures are on the tracker already), begin (Begin combat's attributes), main, acts.
// o.quiet: a fight is not this encounter's next step (a merchant, travelers): the acts first, then a quiet button with this label
function encounterHTML(o){const n=o.mons.reduce((a,x)=>a+x.n,0);
  const row=x=>{const m=MON[x.id];return `<li><span class="enc-m"><a class="pname" href="#mon/${m.id}" data-action="open-mon" data-id="${m.id}">${esc(m.name)}</a><span class="muted small">Power ${esc(m.st.Power||'?')} · Stamina ${esc(m.st.Stamina||'?')}</span></span>${o.edit
    ?`<span class="stepper"><button data-action="st-less" data-id="${m.id}" aria-label="Remove one ${esc(m.name)}">−</button><b>${x.n}</b><button data-action="fight" data-id="${m.id}" aria-label="Add one ${esc(m.name)}">+</button></span>`
    :`<b class="enc-n" aria-label="${x.n} ${esc(m.name)}">× ${x.n}</b>`}</li>`};
  return `<div class="st-enc ${o.cls}" role="status"><div class="st-ench">${o.roll!=null?`<span class="roll">${o.roll}</span>`:''}<b>${o.title}</b>${o.sub?`<span class="muted small">${o.sub}</span>`:''}</div>
    ${o.what?`<p class="st-encw">${o.what}</p>`:''}${o.extra||''}
    ${o.mons.length?`<ul class="st-prepl" aria-label="Creatures">${o.mons.map(row).join('')}</ul>`:''}
    <div class="st-acts">${o.quiet?(o.acts||'')+(o.begin?`<button class="btn ghost" ${o.begin}>${o.quiet}</button>`:''):`${o.begin?`<button class="btn ${o.main?'primary':''} st-go" ${o.begin}>Begin combat${n?` · ${n} creature${n>1?'s':''}`:''}</button>`:''}${o.acts||''}`}</div></div>`}
// An encounter that hit stays on the stage until the Ref starts the fight or lets it pass. A sign (d10 above 1) arrives next turn.
function encCardHTML(ec,src){const end=src==='end',key=end?'data-src="end"':`data-k="${ec.k}"`;
  if(!ec.hit)return `<div class="st-enc miss" role="status"><span class="roll">${ec.r}</span><span class="msg">Above EN ${ec.en}: nothing comes.</span>${end?'':'<button class="xbtn" data-action="st-encx" aria-label="Clear the result">✕</button>'}</div>`;
  if(end&&endFought())return `<div class="st-enc miss" role="status"><span class="roll">${ec.r}</span><span class="msg">Encounter dealt with.</span></div>`;
  const {mons,html,prose}=encParts(ec),now=ec.r===1||ec.due;
  return encounterHTML({cls:`hit ${now?'now':'soon'}`,roll:ec.r,title:ec.due?'Encounter due this turn':now?'Encounter — right now':'Encounter on its way',
    sub:`d10 ${ec.r} ≤ EN ${ec.en} · ${esc(TB[ec.table].title)} d100 ${ec.roll}${now?'':' · give the players a sign; it arrives during the next turn'}`,
    what:!mons.length||prose?html:'',mons,begin:mons.length?`data-action="st-fight" ${key}`:'',main:now,
    acts:end&&!now?'':`<button class="btn ghost" data-action="st-encx" ${key}>${mons.length?'No combat — clear':'Clear'}</button>`})}
// Creatures added before combat begins (the picker, Add to combat in the Bestiary or the search): the same card, its counts on steppers.
function preparedHTML(){const ids=[...new Set(S.combat.map(x=>x.id))];
  const road=S.phase==='travel'; // no family picker on the road: the search finds any creature
  return encounterHTML({cls:'prep st-prep',title:'Encounter prepared',sub:!road&&S.dt.running?'the clock keeps running until combat begins':'combat has not begun',
    mons:ids.map(id=>({id,n:S.combat.filter(x=>x.id===id).length})),edit:true,begin:'data-action="st-begin"',main:true,
    acts:`${road?'<button class="btn" data-action="find" data-q="">Add a creature</button>':S.scene.pick?'':`<button class="btn" data-action="st-pick">Add a creature</button>`}<button class="btn ghost" data-action="st-clear">No combat — clear</button>`})}
// Add creatures by name: this dungeon's family first, anything else through the search panel.
function creaturePickerHTML(){const fam=S.phase==='delve'&&!stagePoi()?D.monsters.filter(m=>m.fam===FAMS[S.dt.dungeon]):[];
  return `<div class="pk"><div class="pk-h"><h3>${fam.length?`${FAMS[S.dt.dungeon]} creatures`:'Add a creature'}</h3><button class="btn sm ghost" data-action="st-pick">Done</button></div>
    ${fam.map(m=>`<div class="pk-row"><a class="pname" href="#mon/${m.id}" data-action="open-mon" data-id="${m.id}">${esc(m.name)}</a><span class="muted small">Power ${esc(m.st.Power||'?')} · Stamina ${esc(m.st.Stamina||'?')}</span><button class="btn sm" data-action="fight" data-id="${m.id}" aria-label="Add ${esc(m.name)}">Add</button></div>`).join('')}
    <button class="btn sm ghost pk-find" data-action="find" data-q="">${nest('Find any other creature')}</button></div>`}
function turnHTML(st){const t=S.dt,left=dtLeft(),setup=st==='setup',sc=S.scene,encs=t.encs||[],prep=S.combat.length>0,poi=!!stagePoi(),roads=poi?poiEncHTML():'',urgent=prep||encs.some(e=>e.r===1||e.due)||!!roads;
  return `<section class="st-card" aria-label="${poi?`${stageName()}: turn ${t.n}`:'Dungeon turn'}">
    <header class="st-h"><h2>${poi?`${stageName()} · turn ${t.n}`:`Dungeon turn ${t.n}`}</h2>${setup?'<span class="st-tag">Not started</span>':`<span class="st-tag ${t.running?'on':'warn'}">${t.running?'Clock running':'Clock paused'}</span>
      <button class="st-sum" data-action="st-set" aria-expanded="${!!sc.set}"><span>${setSummary()}</span><i aria-hidden="true">${sc.set?'Done':'Change'}</i></button>`}</header>
    ${setup||sc.set?setFormHTML():''}
    ${setup&&poi?`<p class="muted st-lead">The clock stops when combat begins.</p>`
      :setup?`<p class="muted st-lead">${greedNow()?`Treasure found this turn: <a class="term" href="#rule/greed" data-term="greed">greed</a> +${greedNow()}%.`:'No greed bonus after DT 3.'} The clock stops when combat begins.</p>`
      :`<div class="st-clock ${t.running?'':'paused'}"><span class="clock" id="bigclock">${mmss(left)}</span><span class="st-bar" aria-hidden="true"><i id="bigbar" style="width:${100*left/(t.len*60)}%"></i></span></div>`}
    <div class="st-acts"><button class="btn ${urgent||t.running&&!setup?'':'primary'} st-go" data-action="dt-run">${setup?`Start DT ${t.n}`:t.running?'Pause the clock':'Resume the clock'}</button>
      <button class="btn hint" data-action="enc-check" data-term="enc-check">Encounter check</button>${prep?'':`<button class="btn" data-action="st-pick" aria-expanded="${!!sc.pick}">Prepare an encounter</button>`}${setup?'':`<button class="btn ghost" data-action="dt-end">End the turn</button>`}${poi?'':`<button class="btn ghost" data-action="dq-rest">Rest</button>`}</div>
    ${poi?poiAskHTML():''}${prep?preparedHTML():''}${sc.pick?`<div class="st-who">${creaturePickerHTML()}</div>`:''}
    ${sc.miss?encCardHTML(sc.miss,'scene'):''}${encs.map(e=>encCardHTML(e,'scene')).join('')}${roads}
  </section>`}
// The creature in focus is its stat block (statblockHTML, the same one the Bestiary shows) with the combat controls on top:
// Stamina and AD read now/max, the one damage field of the screen under them, Remove at the foot. The description folds.
// Wide: a panel beside the list that stays in view. Narrow: a panel docked at the bottom of the screen — name, Stamina, damage —
// whose stat block opens inside it (S.scene.dock), so the list stays the overview and switching is one tap (play.css).
function focusHTML(x){const m=MON[x.id],adMax=parseInt(m.st.AD)||0,lab=crLabel(x),open=!!S.scene.dock;
  const ctl=`<form class="fo-dmg" data-form="mdmg" data-uid="${x.uid}"><label for="fo-n">${x.st?'Damage to':'Stamina back to'} ${esc(lab)}</label>
      <div class="row"><input type="number" class="stp-in" id="fo-n" name="n" min="0" inputmode="numeric" placeholder="0">${x.st?`<button class="btn primary">Apply damage</button>`:''}<button class="btn ${x.st?'ghost fo-heal':'primary'}" name="heal" value="1">Restore Stamina</button></div>
      ${adMax&&x.st?'<p class="small muted fo-adn">Armor (AD) absorbs damage first.</p>':''}</form>`;
  return `<section class="st-focus ${open?'open':''} ${x.st?'':'is-down'}" aria-label="${esc(lab)}">
    <header class="fo-h"><h3>${esc(lab)}</h3>${x.st?'':'<span class="fo-down">Down</span>'}
      <button type="button" class="btn sm ghost fo-tog" data-action="st-dock" aria-expanded="${open}">${open?'Close':'Stat block'}</button></header>
    ${statblockHTML(m,{x,ctl,fold:true})}
    <div class="fo-foot"><button class="btn sm ghost danger" data-action="unfight" data-uid="${x.uid}">Remove ${esc(lab)} from the tracker</button></div>
  </section>`}
// The tracker: every creature as one line (who, how hurt) — the overview. The one in focus opens beside the list, or under it on a narrow screen.
function combatHTML(){const pick=S.scene.pick,f=focusOf();
  if(!S.combat.length)return `<div class="crs"><div class="cr-list"><p class="muted cr-none">No creatures on the tracker.</p>${pick?'':`<div class="cr-add"><button class="btn" data-action="st-pick">Add a creature</button></div>`}</div>${pick?`<div class="st-focus">${creaturePickerHTML()}</div>`:''}</div>`;
  const row=x=>{const m=MON[x.id],max=parseInt(m.st.Stamina)||1,on=!pick&&x===f;
    return `<button class="cr ${x.st?'':'down'}" data-action="st-focus" data-uid="${x.uid}" aria-pressed="${on}"><span class="cr-n">${esc(crLabel(x))}</span><span class="hp" aria-hidden="true"><i style="width:${100*x.st/max}%;${x.st&&x.st/max<.34?'background:var(--danger)':''}"></i></span><span class="cr-hp">${x.st?`<b>${x.st}</b>/${max}`:'down'}</span></button>`};
  return `<div class="crs"><div class="cr-list">${S.combat.map(row).join('')}<div class="cr-add"><button class="btn" data-action="st-pick" aria-expanded="${!!pick}">${pick?'Done adding':'Add a creature'}</button></div></div>${pick?`<div class="st-focus">${creaturePickerHTML()}</div>`:f?focusHTML(f):''}</div>`}
function fightHTML(){const t=S.dt,alive=S.combat.filter(x=>x.st>0).length,n=S.combat.length;
  return `<section class="st-card st-fight" aria-label="Combat">
    <header class="st-h"><h2>Combat</h2><span class="st-tag ${alive?'bad':n?'good':''}">${alive?`${alive} of ${n} standing`:n?'All down':'No creatures yet'}</span>
      ${S.phase==='delve'?`<span class="st-clk muted small">DT ${t.n} · <span id="bigclock">${mmss(dtLeft())}</span> ${t.running?'· clock running <button class="btn sm ghost" data-action="dt-run">Pause</button>':'· <b class="warn-t">clock paused</b>'}</span>`
        :S.phase==='travel'?`<span class="st-clk muted small">On the road · day ${typeof jDay==='function'?jDay():S.rtravel.day}</span>`:''}
      <button class="btn ${alive||!n?'':'primary'} st-end" data-action="st-endfight">End combat</button></header>
    ${combatHTML()}</section>`}
// Quick drops: the two things a Ref does after a fight without opening the card catalogue.
function lootQuickHTML(){
  return `<div class="st-loot">${greedNow()&&S.phase==='delve'?`<p class="small muted st-greed">Treasure found this turn: <a class="term" href="#rule/greed" data-term="greed">greed</a> +${greedNow()}%.</p>`:''}<div class="st-lrow"><span class="muted small">Roll treasure</span>${QT.map(([k,l])=>`<button class="btn sm hint" data-action="qroll" data-v="${k}" data-term="tip-${k}" aria-label="${l}">${l.replace(/ treasure$/,'').replace(/^What’s the (\w)/,(m,c)=>c.toUpperCase()).replace(/\?$/,'')}</button>`).join('')}</div>
    ${S.lookup.qres||''}
    ${LOOT.length?`<div class="st-lrow"><span class="muted small">Prepared</span>${LOOT.map(p=>`<button class="btn sm" data-action="loot-drop" data-v="${p.id}" title="${esc(lootSummary(p))}">${esc(p.name||'Untitled')}</button>`).join('')}</div>`:''}
    <div class="st-lrow"><button class="btn sm ghost" data-action="st-cat">Pick a card or prepare loot →</button></div></div>`}
function afterHTML(){const t=S.dt,end=!!t.end,back=t.held&&!end;
  return `<section class="st-card st-after" aria-label="After the combat">
    <header class="st-h"><h2>After the combat</h2><span class="st-tag ${back?'warn':'good'}">${back?'Clock still paused':'Tracker cleared'}</span></header>
    <p class="muted st-lead">Drop what the party finds into the loot pool; players take it from their Inventory.</p>
    ${lootQuickHTML()}
    <div class="st-acts"><button class="btn primary st-go" data-action="st-resume">${end?`Back to the end of DT ${t.n}`:back?`Resume DT ${t.n} · ${mmss(dtLeft())} left`:'Back to the turn'}</button>${back?`<button class="btn ghost" data-action="st-resume" data-v="stay">Stay paused</button>`:''}</div>
  </section>`}
function endDTHTML(){
  const e=S.dt.end,n=S.dt.n,ec=e.check,poi=!!stagePoi(),roads=poi?poiEncHTML():'';
  const uds=PLAY().flatMap(c=>c.inv.filter(i=>!i.unid&&IT[i.id].ud&&/DT/.test(IT[i.id].ud[1])&&(i.lit||!IT[i.id].light)).map(i=>`<li><b>${esc(c.name)}</b> · ${esc(IT[i.id].name)} <span class="muted">${i.ud} UD</span></li>`));
  const conds=PLAY().flatMap(c=>[...c.cond].filter(k=>DT_END_CONDITIONS.includes(k)).map(k=>`${esc(c.name)} — ${k}`));
  const steps=[['Everyone rolls usage dice',uds.length?`${uds.length} rolled`:'none running'],['Conditions that end now',conds.length?'cleared':'none active'],['Encounter check',ec?(ec.hit?`d10 ${ec.r}: encounter`:`d10 ${ec.r}: nothing`):'']];
  const body=e.step===1?`<p class="st-lead">Players roll each <a class="term" href="#rule/ud-roll" data-term="ud-roll">usage die</a> and remove a die for every 1–2. Their sheets ask them to.</p>${uds.length?`<ul class="st-list">${uds.join('')}</ul>`:'<p class="muted small">No usage dice are running.</p>'}<div class="st-acts"><button class="btn primary st-go" data-action="end-step">Usage dice done</button></div>`
    :e.step===2?`${conds.length?`<p class="st-lead">${conds.join(' · ')}</p>`:'<p class="muted st-lead">No condition ends with the turn.</p>'}<div class="st-acts"><button class="btn primary st-go" data-action="end-cond">${conds.length?'Clear them':'Next'}</button></div>`
    :!ec?`<p class="st-lead">d10 ≤ <a class="term" href="#rule/en" data-term="en">EN</a> ${stageEN()}${poi?' (today’s)':''} brings an encounter${poi?' from the travel tables':''}.</p><div class="st-acts"><button class="btn primary st-go" data-action="end-roll">Roll d10</button></div>`
    :poi?`${ec.hit?`<p class="st-lead"><span class="roll">${ec.r}</span> d10 ≤ EN ${ec.en}: <b>${esc(ec.text||'an encounter')}</b> — on its card below.</p>`:encCardHTML(ec,'end')}${roads}<div class="st-acts"><button class="btn ${roads?'':'primary'} st-go" data-action="next-dt">Start DT ${n+1}</button></div>`
    :`${encCardHTML(ec,'end')}<div class="st-acts"><button class="btn ${ec.hit&&ec.r===1&&!endFought()?'':'primary'} st-go" data-action="next-dt">Start DT ${n+1}</button></div>`;
  return `<section class="st-card st-endc" aria-label="End of ${poi?'the turn':'the dungeon turn'}">
    <header class="st-h"><h2>End of DT ${n}</h2><span class="st-tag on">Step ${e.step} of 3</span></header>
    <ol class="st-steps">${steps.map(([h,sum],k)=>{const no=k+1,cls=e.step>no?'done':e.step===no?'cur':'next';
      return `<li class="${cls}"><span class="st-sn" aria-hidden="true">${cls==='done'?'✓':no}</span><div><h3>${h}${cls==='done'&&sum?` <span class="muted small">${sum}</span>`:''}</h3>${cls==='cur'?body:''}</div></li>`}).join('')}</ol>
    ${poi?`<p class="st-left small muted">Done here? <button class="linkbtn" data-action="jpoileave">Leave ${stageName()} → back to the road</button></p>`:'<p class="st-left small muted">The party has left the dungeon? <button class="linkbtn" data-action="st-newdelve">New delve: back to DT 1</button></p>'}
  </section>`}
// Party at a glance: numbers that always matter, flags only when something is wrong. The name opens the sheet and comes back.
function partyTile(c){const l=lightOf(c),mx=stMax(c),sp=speed(c),flags=[];
  if(!l)flags.push('<span class="pflag bad">No light</span>');
  if(c.stamina===0)flags.push('<span class="pflag bad">No Stamina</span>');
  if(sp<5)flags.push(`<span class="pflag warn">Speed ${sp}</span>`);
  if(c.cruelty)flags.push(`<span class="pflag bad mi">Cruelty ${c.cruelty}</span>`); // the Miasma is harm: blood (owner, 2026-11-16)
  for(const k of c.cond)flags.push(`<span class="chip on hint ${condTone(k)}" data-term="c-${k}" tabindex="0">${k}</span>`);
  return `<div class="ptile"><div class="pt-top"><a class="pname" href="#" data-action="open-crow" data-i="${PARTY.indexOf(c)}" data-back="1">${crowAv(c,32,crowDead(c)?'dead':sesOut(c)?'frozen':'')}${esc(c.name)}</a><span class="pt-light small ${l?'muted':''}">${l?`${esc(IT[l.id].name)}${l.ud!=null?` · ${l.ud} UD`:''}`:''}</span></div>
    <div class="pt-row"><span class="hp lv-${hpLv(c.stamina,mx)}" aria-hidden="true"><i style="width:${100*c.stamina/mx}%"></i></span><span class="pt-n"><b>${c.stamina}</b>/${mx}</span><span class="pt-n">AD <b>${adNow(c)}</b></span><span class="pt-n ${c.wounds.size>=7?'bad':''}">Wounds <b>${c.wounds.size}</b></span></div>
    ${flags.length?`<div class="pt-flags">${flags.join('')}</div>`:''}${dqInRest(c)?'':dqStudyCardHTML(c)}</div>`}
const partyBoxHTML=()=>`<section class="st-party" aria-label="Party"><h2 class="sec-h">Party</h2>${[...sesParty().map(partyTile),...sesShownOut().map(sesTile)].join('')||(S.role==='ref'&&!sesOn()&&PARTY.length?'<p class="muted small">Nobody is seated for the next session yet.</p>':'<p class="muted small">No crows yet. Players make them on their own devices and join your <b>table</b>; they appear here.</p>')}</section>`;
function stagePoolHTML(st){const open=S.scene.loot&&st!=='after';
  return `<div class="st-pool">${poolHTML(true)}${st==='after'?'':`<div class="st-poolf"><button class="btn sm" data-action="st-loot" aria-expanded="${open}">${open?'Close':'+ Add loot'}</button></div>${open?lootQuickHTML():''}`}</div>`}
// One stage for the table: the main card, the party and the loot pool beside it. On the road (journey.js) the main card is the combat.
const stageHTML=(st,main)=>`<div class="stage st-${st}"><div class="st-main">${main}</div>
    <aside class="st-side">${partyBoxHTML()}${stagePoolHTML(st)}</aside></div>`;
// a rest the Ref began in the dungeon (dice.js) is the stage's main card until a fight takes over
SCREENS.session=()=>{const st=sceneOf();return S.dt.rest&&S.phase==='delve'&&!stagePoi()&&!['fight','after'].includes(st)?stageHTML('rest',dqDungeonRestHTML()):stageHTML(st,st==='fight'?fightHTML():st==='after'?afterHTML():st==='end'?endDTHTML():turnHTML(st))};
// A new state starts at its top: a page scrolled down in the fight must not open the next card half off the screen.
let SCENE_SEEN='';
// A docked creature panel sits at the bottom of the screen: messages (Undo) rise above it instead of covering it.
// --dockh: from the bottom bar to the dock's top. At the end of the page the dock leaves the bottom edge and rises with the page's
// last lines; the toast rises with it (it used to stay where a stuck dock would end and sat on the panel).
function dockMark(){const f=$('.crs>.st-focus'),cs=f&&getComputedStyle(f),on=!!cs&&cs.position==='sticky'&&cs.bottom!=='auto';
  document.body.classList.toggle('docked',on);let h=0;if(on){const top=f.getBoundingClientRect().top,nb=parseFloat(cs.bottom)||0;h=Math.max(0,innerHeight-top-nb)}
  const R=document.documentElement.style;R.setProperty('--dockh',Math.round(h)+'px');
  if(on){const r=f.getBoundingClientRect();R.setProperty('--dockl',Math.round(r.left+8)+'px');R.setProperty('--dockr',Math.round(document.documentElement.clientWidth-r.right+8)+'px')}}
addEventListener('resize',()=>requestAnimationFrame(dockMark));
addEventListener('scroll',()=>{if(document.body.classList.contains('docked'))dockMark()},{passive:true});
AFTER.session=()=>{dockMark();if(S.phase!=='delve')return;const st=sceneOf();if(SCENE_SEEN&&SCENE_SEEN!==st&&scrollY>0)scrollTo(0,0);SCENE_SEEN=st};
Object.assign(A,{
  'st-set':()=>{S.scene.set=!S.scene.set;render()},
  'st-pick':()=>{S.scene.pick=!S.scene.pick;render()},
  'st-loot':()=>{S.scene.loot=!S.scene.loot;render()},
  // “Pick a card” opens Loot with the card catalogue unfolded and its filter focused (S.lookup.find, as Find a specific card does)
  'st-cat':()=>{S.lookup.find=true;S.area='session';S.tab.session='loot';render();scrollTo(0,0);$('.pq[data-key=loot]')?.focus()},
  'st-dock':()=>{S.scene.dock=!S.scene.dock;render();if(!S.scene.dock)$('#fo-n')?.focus({preventScroll:true})},
  'st-focus':b=>{S.scene.focus=+b.dataset.uid;S.scene.pick=false;render();const f=$('.st-focus');if(f&&f.getBoundingClientRect().bottom>screenBottom())f.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});if(matchMedia('(pointer:fine)').matches)$('#fo-n')?.focus({preventScroll:true})},
  'st-less':b=>{const k=S.combat.map(x=>x.id).lastIndexOf(b.dataset.id);if(k>=0)S.combat.splice(k,1);render()},
  'st-clear':()=>{journalRun('Encounter cleared',['session'],()=>{S.combat=[]});S.scene.pick=false;render()},
  // Begin combat: the one step that stops the clock. From an encounter card it brings the creatures of the line with it.
  'st-begin':()=>{if(!S.combat.length)return;beginCombat();if(S.phase==='travel'){S.area='session';S.tab.session='session';scrollTo(0,0)}render()}, // on the road: opens the combat screen
  'st-fight':b=>{const end=b.dataset.src==='end',k=+b.dataset.k,ec=end?S.dt.end?.check:(S.dt.encs||[]).find(e=>e.k===k),{mons}=encParts(ec);if(!mons.length)return;
    beginCombat(()=>{for(const x of mons)addMonster(x.id,x.n);if(end)S.dt.end.fought=true;else S.dt.encs=(S.dt.encs||[]).filter(e=>e.k!==k)});render()},
  'st-encx':b=>{if(b.dataset.src==='end'){if(S.dt.end)S.dt.end.fought=true}else if(b.dataset.k)S.dt.encs=(S.dt.encs||[]).filter(e=>e.k!==+b.dataset.k);else S.scene.miss=null;render()},
  'st-endfight':()=>{const alive=S.combat.filter(x=>x.st>0).length,go=()=>{journalRun('Combat ended',['session'],()=>{S.combat=[];if(S.phase==='delve')S.dt.fight='over';else if(S.phase==='travel')S.dt.fight=''});Object.assign(S.scene,{pick:false,focus:null});S.lookup.qres='';
      if((S.phase==='travel'||stagePoi())&&typeof jCombatOver==='function')jCombatOver();render()};
    alive?askYes('End combat?',`${alive} creature${alive>1?'s are':' is'} still standing. The tracker is cleared; Undo brings it back.`,'End combat',go,true):go()},
  // The turn's clock comes back only when the Ref says so.
  'st-resume':b=>{const t=S.dt;if(b.dataset.v!=='stay'&&t.held&&!t.end&&t.left>0)t.running=true;t.fight='';t.held=false;render()},
  // Greed applies only on the first entry into a dungeon (r-greed-bonus), so a new delve asks which it is.
  'st-newdelve':()=>{const dl=$('#dlg');dl.returnValue='';dl.innerHTML=`<form method="dialog"><h2>Start a new delve?</h2><p class="muted">The dungeon clock goes back to DT 1 with a full turn. Undo brings this one back.</p><p>The greed bonus (+30%, +20%, +10% on treasure in the first three DTs) counts only the first time the party enters a dungeon.</p><div class="row" style="justify-content:flex-end;flex-wrap:wrap;margin-top:1rem"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn" value="same">Same dungeon again</button><button class="btn primary" value="new">A new dungeon</button></div></form>`;
    $$('[data-close]',dl).forEach(b=>b.onclick=()=>dl.close());
    dl.onclose=()=>{const v=dl.returnValue;if(v!=='same'&&v!=='new')return;const run=()=>{journalRun('New delve: DT 1',['session'],()=>{Object.assign(S.dt,{n:1,running:false,left:S.dt.len*60,end:null,fight:'',held:false,encs:[],again:v==='same'})});Object.assign(S.scene,{miss:null,set:false,pick:false,focus:null});render()};run()};
    dl.showModal()},
});
// Keyboard: when a stage action was pressed from the keyboard, the next main button takes the focus, so Enter walks the flow.
for(const k of ['dt-run','dt-end','end-step','end-cond','end-roll','next-dt','enc-check','st-fight','st-begin','st-clear','st-encx','st-resume','st-pick','st-set','st-loot']){const f=A[k];
  A[k]=b=>{const kb=b?.matches?.(':focus-visible'),r=f(b);if(kb&&S.area==='session')((k==='st-pick'&&S.scene.pick?$('.pk .btn[data-action=fight],.pk .btn'):k==='st-set'&&S.scene.set?$('.st-set select'):k==='st-loot'&&S.scene.loot?$('.st-pool .st-loot .btn'):null)||$('.st-main .btn.primary')||$('.st-main .btn'))?.focus({preventScroll:true});return r}}

/* ================= Player: the vitals strip ================= */
function hudHTML(){const c=ME;if(!c||S.area!=='crow'||crowDead(c))return ''; // a dead crow has no vitals to play (its sheet says it is dead)
  const sp=speed(c),lit=lightOf(c),mx=stMax(c),ad=adNow(c),w=c.wounds.size,vil=S.phase==='village';
  const cell=(key,label,v,cls,note,extra='')=>`<div class="hud-c hint ${cls}" data-term="${key}" data-note="${esc(note)}" tabindex="0" aria-label="${label}: ${esc(note)}"><span class="k">${label}</span><span class="v">${v}</span>${extra}</div>`;
  const eff=`<span class="hud-st"><button class="st" data-action="effort" data-d="-1" aria-label="Spend 1 Effort">−</button><button class="st" data-action="effort" data-d="1" aria-label="Regain 1 Effort">+</button></span>`;
  const bonus=(c.effortBonus?`<span class="bonus hint" data-term="tip-effort-bonus" tabindex="0">+${c.effortBonus}</span>`:'')+(c.lore?.n?`<button class="bonus hint" data-action="lore-spend" data-term="tip-lore" aria-label="Spend 1 Effort for ${esc(c.lore.exp)}">+${c.lore.n} ${esc(c.lore.exp)}</button>`:'');
  // two groups: the numbers (a tidy grid that wraps by whole columns) and the one thing to do, Take damage, which never joins them.
  // Take damage is harm, so it is blood, the same in every scene — not the bone of a primary action (owner's decision). Closed it is the
  // quiet red outline (like "Let go"), so the sheet doesn't shout; it fills red only while its form is open (owner, 2026-11-18).
  return `<section class="hud ${S.hud.open?'open':''}" aria-label="${esc(c.name)} now"><div class="hud-grid"><div class="hud-stats">
    ${cell('stamina','Stamina',`${c.stamina}<small>/${mx}</small>`,c.stamina===0?'bad':'',c.stamina===0?'next damage becomes wounds':c.stamina<mx?`${mx-c.stamina} lost`:'full',`<span class="hud-bar lv-${hpLv(c.stamina,mx)}" aria-hidden="true"><i style="width:${100*c.stamina/mx}%"></i></span>`)}
    ${cell('ad','AD',`${ad}<small>/${adMax(c)}</small>`,'',adSources(c).length?adSources(c).map(i=>IT[i.id].name).join(' + '):'no armor worn')}
    ${cell('wounds','Wounds',`${w}<small>/10</small>`,w>=7?'bad':w?'warn':'',w?'death at 10':'none')}
    ${cell('speed','Speed',`${sp}`,'hopt '+(sp===0?'bad':sp<5?'warn':''),speedWhy(c))}
    <div class="hud-c hud-eff"><span class="k hint" data-term="effort" tabindex="0">Effort</span><span class="v">${c.effort}<small>/${effMax(c)}</small>${bonus}</span>${eff}</div>
    ${vil?cell('sale','Gold',`${coinsOf(c).toLocaleString('en')}<small>gc</small>`,'hopt',`in ${purses(c).length} purse${purses(c).length===1?'':'s'}, room for ${purseRoom(c)} more`):cell('light','Light',lit?esc(shown(lit).name):'Dark',lit?'hopt lt':'hopt lt bad',lit?`${IT[lit.id].light?IT[lit.id].light.join('/')+' squares':''}${lit.ud!=null?` · ${lit.ud} UD`:''}`:'in the dark: double bane')}
    </div><div class="hud-do"><button class="btn danger${S.hud.dmg?' solid':''} hud-dmg" data-action="hud-dmg" aria-expanded="${!!S.hud.dmg}" aria-controls="hud-pop" title="Take damage or heal (D)">Take damage</button>
    <button class="hud-more" data-action="hud-open" aria-expanded="${!!S.hud.open}" aria-label="${S.hud.open?'Show fewer vitals':'Show all vitals: Speed, Effort, light'}"><span aria-hidden="true">${S.hud.open?'▴':'▾'}</span></button></div></div>
    ${S.hud.dmg?`<form class="hud-pop" id="hud-pop" data-form="dmg"><label class="hud-pt" for="hud-n">Damage taken — or Stamina healed</label><input type="number" class="stp-in" id="hud-n" name="n" min="0" max="99" inputmode="numeric" aria-label="Damage or healing amount" placeholder="0">
      <label class="check"><input type="checkbox" name="p"> <a class="term" href="#rule/piercing" data-term="piercing">Piercing</a></label>
      ${adSources(c).filter(i=>IT[i.id].cat!=='armor').map(i=>`<label class="check"><input type="checkbox" name="parry" value="${i.uid}" checked> <a class="term" href="#rule/q-parry" data-term="q-parry">Parry</a> with ${esc(IT[i.id].name)} (AD ${adOf(c,i)})</label>`).join('')}
      <button class="btn danger solid">Take damage</button><button type="button" class="btn good solid" data-action="heal">Heal</button>
      <p class="small muted">Armor (AD) goes first, then Stamina, then wounds. Undo takes it back.</p></form>`:''}
  </section>`}
Object.assign(A,{'hud-dmg':()=>{S.hud.dmg=!S.hud.dmg;render();if(S.hud.dmg)$('#hud-n')?.focus()},'hud-open':()=>{S.hud.open=!S.hud.open;render()}});

/* ================= One search: rules, items, monsters ================= */
function findResults(q){const s=q.trim().toLowerCase();if(!s)return rulesResults('');
  const sc=n=>{n=n.toLowerCase();return n===s?3:n.startsWith(s)?2:n.split(/[\s,()]+/).some(w=>w.startsWith(s))?1:0};
  const top=(list,name)=>list.map(x=>[sc(name(x)),x]).filter(x=>x[0]).sort((a,b)=>b[0]-a[0]||name(a[1]).localeCompare(name(b[1]))).slice(0,8).map(x=>x[1]);
  const ref=S.role!=='player',mons=ref?top(D.monsters,m=>m.name):[],items=top(D.items.filter(i=>!i.base&&i.cat!=='unidentified'),i=>i.name),tabs=ref?top(D.tables,t=>t.title):[];
  const row=(a,t,sub)=>`<li><a href="#" ${a}><i class="fn">${hl(t,q.trim())}</i><span>${esc(sub)}</span></a></li>`;
  const grp=(h,l)=>l.length?`<h3 class="sec-h sm">${h}</h3><ul class="list-links">${l.join('')}</ul>`:'';
  const rules=ruleSearch(q);
  const out=grp('Monsters',mons.map(m=>row(`data-action="open-mon" data-id="${m.id}"`,m.name,`${m.fam} · Power ${m.st.Power??'?'}`)))
    +grp('Items',items.map(i=>row(`data-action="open-item" data-id="${i.id}"`,i.name,`${CATL[i.cat]||''}${i.price!=null?' · '+gc(i.price):''}`)))
    +rules.map(([h,l])=>`<h3 class="sec-h sm">${h}</h3>${rlist(l)}`).join('')
    +grp('Roll tables',tabs.map(t=>row(`data-action="find-table" data-v="${t.id}"`,t.title,'opens in Look up')));
  return out||`<p>Nothing found for “${esc(q)}”. Try a shorter word, or browse below.</p>`+rulesResults('')}
const findOpen=q=>{openPanel({t:'index',q:q||''});const i=$('#ridx');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}};
Object.assign(A,{
  find:b=>findOpen(b?.dataset?.q),
  'find-table':b=>{S.area='library';S.lib.cat='tables';S.tbl.pick=b.dataset.v;S.tbl.roll=null;closePanel();render();scrollTo(0,0)},
});
// Keys: / opens the search from anywhere; D opens Take damage on a crow. Never while typing.
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest?.('input,textarea,select,[contenteditable]')||$('dialog[open]'))return;
  if(e.key==='/'||e.code==='Slash'&&!e.shiftKey){e.preventDefault();findOpen('')}
  else if(e.code==='KeyD'&&S.area==='crow'&&ME&&!S.moving&&!S.placing){e.preventDefault();if(!S.hud.dmg)A['hud-dmg']();else $('#hud-n')?.focus()}});
render();
