'use strict';
/* CROW NEST — the dice at the table (owner's decision, 2026-11-21; dice.css; docs in CODEX_NOTES.md, QA/2026-11-21-dice.md).
   Players roll real dice wherever they like and only SAY the result or the tier; the Ref records it with one tap on their console,
   and the app shows what happens. Players never type dice results at a table. Where the Ref rolls (encounters, the rest check,
   weather damage and mold, gambling), the Ref has one Roll button. No grids of numbers: a value a player says is one compact field
   with − and +, the computed result beside it. Character creation is the only place the app rolls for a player.
   Without a Ref (a player's device not at a table) the player gets the same compact entry on their own device.
   It uses journey.js (jIn, jRefSet, jRestOpen …) only when called, and only after checking it is there.

   Shared state (additive, per crow, so the per-top-level-key merge of sync.js keeps the player's and the Ref's writes apart):
     c.rq   {r, act, pick, part, size, plus, crafty, lore, wounds, food, where} — the player's rest answers (their device), valid
            while r === c.rests (a finished rest raises c.rests, so the answers of the last rest expire by themselves)
     c.rv   {r, act, food, cr:[{t,crit,doom}], hv, mind:{t,d,re,clear,lift}, nobet} — what the Ref entered for that rest
     c.rlog {r, l:[…]} — what the finished rest did (the Ref's device writes it; the player's Rest screen shows it)
     c.owed {id, n, t} — wounds the Ref's device dealt (a hungry rest, weather damage); the player's device marks them (c.owedTaken)
     c.sask {uid} — the player asks to Study a held item; c.sres {uid, t, r} the Ref's tier for it
     c.bet  {id, game, pick, bet} — a bet placed at the inn; c.betr {id, a, b, won, net} the Ref's roll for it
     S.dt.rest {base, where, chk} — a rest the Ref began in a dungeon (shared with the clock, saved and journaled with the session)
   S.dq (open line, Undo ids) is this device's view: never in snap().
   Loads before app.js (app.js's first render already draws the Rest screen and the Ref's panels); what needs app.js — S, A,
   SCREENS — is set by dqInit(), which app.js calls before that render. */
function dqInit(){S.dq={open:null,undo:{},mnow:{},wx:{}};Object.assign(A,DQ_ACTIONS);SCREENS.rmiasma=dqMiasmaScreen}

/* ---------- small pieces ---------- */
const dqName=c=>esc(String(c?.name||'?').split(' ')[0]);
// a player at a table (or reconnecting to one) never enters a die: their device shows what to roll and waits for the Ref
const dqTable=()=>S.role!=='ref'&&hasTable();
const rqOf=c=>c&&c.rq&&c.rq.r===(c.rests||0)?c.rq:null;
const rvOf=c=>c&&c.rv&&c.rv.r===(c.rests||0)?c.rv:null;
function dqMine(c,patch){c.rq={...(rqOf(c)||{r:c.rests||0}),...patch}}
function dqRef(c,patch){c.rv={...(rvOf(c)||{r:c.rests||0}),...patch}}
const dqKey=s=>esc(String(s));
// one compact field: [−] value [+], typeable; f names the field of the line (k) it belongs to
function dqNumHTML({k,f,v,label,lo=0,hi=99,wait}){const val=v==null||v===''?'':String(v);
  return `<span class="dq-num${wait||val===''?' wait':''}" role="group" aria-label="${label}"><button type="button" data-action="dqn" data-k="${dqKey(k)}" data-f="${f}" data-d="-1" data-lo="${lo}" data-hi="${hi}" aria-label="${label}: one less">−</button><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" data-dq="${dqKey(k)}" data-f="${f}" data-lo="${lo}" data-hi="${hi}" value="${val}" placeholder="–" aria-label="${label}"><button type="button" data-action="dqn" data-k="${dqKey(k)}" data-f="${f}" data-d="1" data-lo="${lo}" data-hi="${hi}" aria-label="${label}: one more">+</button></span>`}
// tiers: Tier 1/2/3 (and Doom where the test has one); was: the tier the Ref entered before the player spent Effort (struck)
// mod (a roll whose modifier the app knows, as a Mind RR): each button says the totals and the dice that make its tier (owner, 2026-11-24)
// dice: the dice alone (a board whose heading gives the totals once)
const dqRange=(t,mod,dice)=>mod==null?'':`<small class="dq-rng">${dice?diceFor(t,mod):`${TIERS[t-1][0]}${mod?` · ${diceFor(t,mod)}`:''}`}</small>`;
function dqTiersHTML({k,sel,doom,was,label='',mod,dice}){const n=[1,2,3];
  return `<div class="dq-tiers${doom!==undefined?' n4':''}" role="group" aria-label="${label||'Tier'}">${n.map(t=>`<button type="button" class="btn${was===t?' was':''}" data-action="dqt" data-k="${dqKey(k)}" data-v="${t}" aria-pressed="${sel===t}" aria-label="${label?label+': ':''}Tier ${t}${mod!=null?`, ${TIERS[t-1][0]}`:''}${was===t?' (before the Effort)':''}">${was===t?`<s>Tier ${t}</s>`:`Tier ${t}`}${dqRange(t,mod,dice)}</button>`).join('')}${doom!==undefined?`<button type="button" class="btn doom" data-action="dqt" data-k="${dqKey(k)}" data-v="doom" aria-pressed="${!!doom}" aria-label="${label?label+': ':''}Doom">Doom</button>`:''}</div>`}
const dqPill=(st,t)=>`<span class="dq-pill ${st}">${t}</span>`;
const dqEye=`<span class="dq-eye">only you</span>`;
const dqItemReal=i=>esc(IT[i.id]?.name||'?'); // the Ref's eyes only (an unidentified item's real name)

/* ---------- the rest the table is in ---------- */
// kind camp|poi (journey.js), dungeon (S.dt.rest, the Ref began it on the stage), village (whoever answered on their Rest screen)
function dqRest(){
  if(typeof jRestOpen==='function'&&S.journey&&jStep()!=='off'&&(S.phase==='travel'||S.phase==='delve')&&jRestOpen()){const r=jRestAt(),poi=!!jPoiRest(),cp=S.journey.camp||{};
    return {kind:poi?'poi':'camp',where:poi&&cp.closed==null?null:r.where,check:r.check,id:poi?`p${S.dt.n}.${cp.restart||0}`:`c${S.journey.day}.${cp.restart||0}`,...dqIn(PLAY().filter(c=>!crowDead(c)&&!jRested(c)),poi?`p${S.dt.n}.${cp.restart||0}`:`c${S.journey.day}.${cp.restart||0}`),place:cp.place,label:poi?`at ${esc(cp.poi||'the place')}`:esc((J_PLACE[cp.place]||'Outdoors').toLowerCase())}}
  if(S.phase==='delve'&&S.dt.rest&&!(typeof jPoiScene==='function'&&jPoiScene())){const b=S.dt.rest.base||{};
    return {kind:'dungeon',where:S.dt.rest.where||null,check:true,id:`d${S.dt.n}`,...dqIn(PLAY().filter(c=>!crowDead(c)&&(c.rests||0)<=(b[c.id]??(c.rests||0))),`d${S.dt.n}`),label:'in the dungeon'}}
  if(S.phase==='village'&&vHere()){const v=vHere();return {kind:'village',where:'clear',check:false,v,id:'v'+v.id,...dqIn(PLAY().filter(c=>!crowDead(c)&&rqOf(c)),'v'+v.id),label:esc(v.name)}}
  return null}
// who the Ref left out of this rest (“Doesn’t rest”: no benefits, and on a journey an exhaustion wound at dawn)
const dqIn=(l,id)=>({crows:l.filter(c=>rvOf(c)?.out!==id),out:l.filter(c=>rvOf(c)?.out===id)}); // out: the rest's id (a crow who didn't rest keeps its rest count)
const dqInRest=(c,ctx=dqRest())=>!!ctx&&ctx.crows.includes(c);
// the player's form for the rest: their answers over the defaults (the Rest screen's controls read it)
const dqForm=c=>({act:null,pick:null,part:'angel-part',size:1,plus:false,crafty:false,loreExp:null,wounds:null,...(rqOf(c)||{}),act:dqAct(c)??null});
function dqAct(c){const q=rqOf(c),v=rvOf(c);if(q&&q.act!=null)return q.act;if(v&&v.act!=null)return v.act;if(q&&q.act===null)return undefined; // null: the player took their choice back
  if(typeof jRestOpen==='function'&&S.journey&&jStep()!=='off'&&jRestOpen()){const x=jIn(c);if(x.act)return x.act} // an answer from before (the trip)
  return undefined}
const dqNeed=c=>c.miasma.some(m=>m.n===MI_NAMES[3])?2:1;
const dqRations=c=>c.inv.filter(i=>i.id==='ration'&&!i.unid).reduce((a,i)=>a+i.count,0);
// food: camp and POI on the trip (jfood, the Ref's jRefSet); a village decides it (home, the inn, or one's own ration); a dungeon asks
function dqFood(c,ctx){if(!ctx)return undefined;if(ctx.kind==='camp'||ctx.kind==='poi'){const f=jIn(c).food;return f||undefined}
  const q=rqOf(c),v=rvOf(c);if(q?.food)return q.food;if(v?.food)return v.food;
  if(ctx.kind==='village'){const rv=restVillage(c);return rv.at==='home'?'home':rv.at==='inn'?'inn':dqRations(c)>=dqNeed(c)?'own':'none'}
  return dqRations(c)>=dqNeed(c)?'own':undefined} // a dungeon, or one's own rest: a meal from one's own rations unless the player says otherwise
const DQ_FOOD={own:'eats',inn:'the inn',home:'fed at home',none:'goes hungry'};
function dqFoodOpts(c,ctx){const rat=dqRations(c),need=dqNeed(c),l=[];
  if(ctx.kind==='camp'&&ctx.place==='home')l.push(['home','Home','your own village feeds you']);
  if((ctx.kind==='camp'||ctx.kind==='poi')&&['village','home'].includes(ctx.place))l.push(['inn','Inn · 5 gc',c.innFood?'paid':'paid as the rest ends']);
  l.push(['own',`Eat ${need} ration${need>1?'s':''}`,rat?`${rat} carried`:'none carried']);l.push(['none','Go hungry','no benefits, a starvation wound']);return l}
function dqFoodSet(c,ctx,v,who){if(ctx.kind==='camp'||ctx.kind==='poi'){if(who==='ref')jRefSet(c.id,{food:v});else jMine({food:v});return}
  if(who==='ref')dqRef(c,{food:v});else dqMine(c,{food:v})}

/* ---------- one line of the rest: what the Ref enters, what the player sees ---------- */
// item: {key, c, who, what, st:'wait'|'done'|'bad', line (Done text), body(ref) (the open line's controls), get/set/tap/roll,
//        pt (the player's title), pill (the player's pill)}
const dqCraftPts=r=>r.doom?0:r.t!=null?Math.max(1,+r.t):0;
const dqCraftMods=(c,R)=>{const m=c.ch.M+(R.plus?4:0)+(R.crafty&&c.npcType==='Crafty'?2:0);return `2d10 ${m<0?'−':'+'} ${Math.abs(m)}`};
function dqCraftItem(c,ctx,R,v){const it=IT[R.pick],pj=(c.crafts||[]).find(x=>x.id===R.pick),have=pj?.pts||0,goal=it.craft.goal,k=`${c.id}|craft`;
  const rolls=(v?.cr?.length?v.cr:[{}]),last=rolls[rolls.length-1],complete=!!v?.cr?.length&&(last.doom||last.t!=null&&!last.crit),pts=rolls.map(dqCraftPts),sum=pts.reduce((a,b)=>a+b,0);
  const got=rolls.filter(r=>r.t!=null||r.doom).map(dqCraftPts),tot=got.length?`${[have,...got].join(' + ')} = <b>${have+sum} / ${goal}</b>${have+sum>=goal?' · done':''}`:''; // only the totals entered
  return {key:k,c,kind:'craft',what:`Crafting total <span class="muted">${esc(it.name)} ${have} / ${goal}</span>`,st:complete?'done':'wait',
    line:`Craft · ${esc(it.name)} ${have+sum} / ${goal}${have+sum>=goal?' · finished':''}`,
    // the first roll: its total, crit and doom; a crit's roll: its total and one crit marker (a crit can crit again)
    body:()=>rolls.map((r,i)=>`<div class="dq-line">${i?'<span class="k">Crit</span>':''}${dqNumHTML({k,f:'cr.'+i,v:r.t,label:`${dqName(c)}: ${i?'crit roll total':'crafting total'}`,lo:1,hi:60,wait:r.t==null&&!r.doom})}<button type="button" class="dq-tog crit" data-action="dqt" data-k="${k}" data-v="crit.${i}" aria-pressed="${!!r.crit}">crit</button>${i?'':`<button type="button" class="dq-tog doom" data-action="dqt" data-k="${k}" data-v="doom.${i}" aria-pressed="${!!r.doom}">doom</button>`}</div>`).join('')+(tot?`<div class="dq-line"><span class="dq-ir${have+sum>=goal&&complete?' good':''}">${tot}</span></div>`:''),
    get:f=>{const [a,i]=f.split('.');return a==='cr'?rolls[+i]?.t??null:null},
    set:(f,val)=>{const i=+f.split('.')[1],l=rolls.map(x=>({...x}));l[i]={...l[i],t:val};dqRef(c,{cr:l.filter((x,j)=>j<=i||x.t!=null||x.doom)})},
    tap:t=>{const [a,i0]=t.split('.'),i=+i0;let l=rolls.map(x=>({...x}));l[i]={...l[i]};if(a==='crit'){l[i].crit=!l[i].crit;l[i].doom=false;l=l.slice(0,i+1);if(l[i].crit)l.push({})}else{l[i].doom=!l[i].doom;l[i].crit=false;l=l.slice(0,i+1)}dqRef(c,{cr:l})},
    pt:`Craft <span class="muted">${esc(it.name)} ${have} / ${goal} · ${dqCraftMods(c,R)}</span>`,pill:complete?dqPill('good',`${have+sum} / ${goal}`):dqPill('wait',rolls.length>1?'say the crit roll':'say your total')}}
function dqHarvestItem(c,ctx,R,v){const p=IT[R.part]||IT['angel-part'],k=`${c.id}|harvest`,n=v?.hv;
  return {key:k,c,kind:'harvest',what:`${esc(p.name)} <span class="muted">${R.size}d6</span>`,st:n!=null?'done':'wait',line:`${n} ${esc(p.name)}`,
    body:()=>`<div class="dq-line">${dqNumHTML({k,f:'hv',v:n,label:`${dqName(c)}: ${esc(p.name)}, ${R.size}d6`,lo:R.size,hi:6*R.size})}${n!=null?`<span class="dq-ir good"><b>${n} ${esc(p.name)}</b></span>`:''}</div>`,
    get:()=>n??null,set:(f,val)=>dqRef(c,{hv:val==null?null:Math.max(R.size,Math.min(6*R.size,val))}),
    pt:`Harvest <span class="muted">${esc(p.name)} · ${R.size}d6</span>`,pill:n!=null?dqPill('good',`${n} parts`):dqPill('wait','say the total')}}
// the activity, as one line: a choice with nothing to roll is Done at once; a roll waits for the Ref
function dqActItem(c,ctx){const a=dqAct(c),R=dqForm(c),v=rvOf(c),k=`${c.id}|act`,nm0=x=>(RACT.find(y=>y[0]===x)||(x==='gamble'?RACT_GAMBLE:null)||[])[1]||x;
  const choosing=(t,pt)=>({key:k,c,kind:'act',what:`${t} <span class="muted">choosing</span>`,st:'wait',body:()=>`<div class="dq-opts"><button type="button" class="btn" data-action="dqt" data-k="${k}" data-v="none">No activity</button>${ctx.kind==='own'?'':`<button type="button" class="btn ghost" data-action="dqt" data-k="${k}" data-v="out">Doesn’t rest</button>`}</div>`,tap:v=>dqRef(c,v==='out'?{out:ctx.id}:{act:''}),pt,pill:dqPill('wait','choose')});
  if(a===undefined)return choosing('Activity','Your activity');
  if(a==='')return {key:k,c,kind:'act',st:'done',line:'No activity',pt:'No activity',pill:dqPill('good','chosen')};
  const done=(line,pt,pill='good')=>({key:k,c,kind:'act',st:'done',line,pt:pt||line,pill:dqPill(pill,pill==='good'?'chosen':'')});
  const inv=uid=>c.inv.find(i=>String(i.uid)===String(uid));
  if(['identify','repair','lore','craft','tend'].includes(a)&&!R.pick)return choosing(esc(nm0(a)),esc(nm0(a)));
  if(a==='identify'){const i=inv(R.pick);if(!i)return choosing('Identify','Identify Item');return {key:k,c,kind:'act',st:'done',line:`Identify · ${dqItemReal(i)} ${dqEye}`,pt:`Identify <span class="muted">${esc(nm(i))}</span>`,pill:dqPill('good','as the rest ends')}}
  if(a==='repair'){const i=inv(R.pick);return done(`Repair · ${i?esc(IT[i.id].name):'?'}`,`Repair <span class="muted">${i?esc(nm(i)):''}</span>`)}
  if(a==='lore'){const i=inv(R.pick);return done(`Lore book · ${esc(i?.topic||R.loreExp||LORE_EXP[0])}`,'Study a Lore Book')}
  if(a==='tend')return done(`Tend Wounds · ${esc(R.pick)}`)
  if(a==='craft'){if(!IT[R.pick]?.craft)return choosing('Craft','Craft Equipment');return dqCraftItem(c,ctx,R,v)}
  if(a==='harvest')return dqHarvestItem(c,ctx,R,v);
  if(a==='gamble')return null; // the bet is its own line (dqBetItem)
  if(a==='stone')return STONE_BEN[R.pick]?done(`Alteration stone · ${esc(STONE_BEN[R.pick][0])}`):choosing('Alteration stone','Make an alteration stone');
  return done(esc(nm0(a)))}
function dqFoodItem(c,ctx){const f=dqFood(c,ctx),k=`${c.id}|food`;
  if(f===undefined)return {key:k,c,kind:'food',what:`Food <span class="muted">choosing</span>`,st:'wait',body:()=>`<div class="dq-opts" role="group" aria-label="${dqName(c)}’s food">${dqFoodOpts(c,ctx).map(([v,l])=>`<button type="button" class="btn" data-action="dqt" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`,
    tap:v=>dqFoodSet(c,ctx,v,'ref'),pt:'Food',pill:dqPill('wait','choose')};
  // a meal (one's own, or at home) is the rule: no line; the inn and going hungry are worth a line in Done
  if(f==='own'||f==='home')return null;
  return {key:k,c,kind:'food',st:f==='none'?'bad':'done',line:f==='none'?'<b>Goes hungry</b>':f==='inn'?`Inn · ${c.innFood?'paid':`${INN_NIGHT} gc as the rest ends`}`:'Fed at home',pt:'Food',pill:dqPill(f==='none'?'bad':'good',DQ_FOOD[f])}}
// the Mind RR after a rest in the Miasma (Rules: Miasma), made before the rest ends (owner, 2026-11-21) and applied by Finish
const dqLost=c=>c.miasma.some(m=>m.n===MI_NAMES[13]);
const dqMind=c=>rvOf(c)?.mind||null;
const dqLiftBy=(c,ctx)=>ctx.crows.find(o=>o!==c&&dqMind(o)?.t===3&&dqMind(o)?.lift===c.id);
// what the crow's Mind RR comes to: t (after a lift), its d10 hit (tier 1), complete
function dqMindOf(c,ctx){const m=dqMind(c);if(!m?.t)return {t:0,complete:false};const by=dqLiftBy(c,ctx),t=by?Math.min(3,m.t+1):m.t;
  if(t===1){if(m.d==null)return {t,complete:false};const h=JourneyRules.miasmaHit(c,MI_ROWS(),m.d);return {t,d:m.d,re:!!m.re,hit:h.hit,cr:h.cr,again:h.again,complete:!!h.hit&&!h.again}}
  if(t===3&&by)return {t,by,clear:true,complete:true};
  if(t===3)return {t,clear:!!m.clear,lift:m.lift||'',complete:!!m.clear||!!m.lift&&!!ctx.crows.find(o=>o.id===m.lift)};
  return {t,by,complete:true}}
const dqMindMod=c=>{const j=typeof jFightBonus==='function'&&S.journey&&jStep()!=='off'&&jRestOpen?.(),rr=j?JourneyRules.mindRR(c,{fight:jFightBonus(c),strong:(S.journey.effects||[]).some(e=>e.kind==='strong')}):{mod:c.ch.M-c.cruelty};return rr.mod};
function dqMindItem(c,ctx){if(ctx.where!=='miasma'||dqLost(c))return null;const k=`${c.id}|mind`,m=dqMind(c)||{},o=dqMindOf(c,ctx),mod=dqMindMod(c);
  const liftable=ctx.crows.filter(x=>x!==c&&ctx.where==='miasma'&&!dqLost(x)&&[1,2].includes(dqMind(x)?.t)&&!dqLiftBy(x,ctx)&&dqMind(x)?.lift!==c.id);
  const lift=o.lift&&PARTY.find(x=>x.id===o.lift);
  const line=!o.complete?'':o.t===1?`Mind RR · <b>${o.d}: ${esc(o.hit.n)}</b>`:o.t===2?`Mind RR · Tier 2${o.by?` (lifted by ${dqName(o.by)})`:''}`:o.by?`Mind RR · lifted to Tier 3: cruelty ${c.cruelty} → 0`:o.clear?`Mind RR · Tier 3: cruelty ${c.cruelty} → 0`:`Mind RR · Tier 3: lifts ${dqName(lift)}`;
  return {key:k,c,kind:'mind',what:`Mind RR <span class="muted">cruelty ${c.cruelty}${c.miasma.length?' · '+c.miasma.map(x=>esc(x.n)).join(', '):''}</span>`,st:!o.complete?'wait':o.t===1?'bad':'done',line,
    tiers:()=>`${o.by?`<p class="dq-empty">${dqName(o.by)} lifts ${dqName(c)}: ${m.t===1?'Tier 1 → 2, the effect goes':'Tier 2 → 3'}.</p>`:''}${dqTiersHTML({k,sel:m.t||0,label:`${dqName(c)}: Mind RR`,mod})}`,
    extra:()=>o.t===1?`<span class="dq-line"><span class="k">d10</span>${dqNumHTML({k,f:'d',v:m.d,label:`${dqName(c)}: Miasma d10`,lo:1,hi:10})}${o.hit?`<span class="dq-ir ${o.again?'wait':'bad'}">${o.d} + ${o.cr} = ${o.d+o.cr}: <b>${esc(o.hit.n)}</b>${o.again?' — has it, roll again':''}</span>`:''}</span>`
      :o.t===3&&!o.by?`<span class="dq-opts"><button type="button" class="btn" data-action="dqt" data-k="${k}" data-v="clear" aria-pressed="${!!m.clear}">Clear cruelty ${c.cruelty} → 0</button>${liftable.map(x=>`<button type="button" class="btn" data-action="dqt" data-k="${k}" data-v="lift:${esc(x.id)}" aria-pressed="${m.lift===x.id}">Lift ${dqName(x)} · Tier ${dqMind(x).t} → ${dqMind(x).t+1}</button>`).join('')}${lift&&!liftable.includes(lift)?`<button type="button" class="btn" data-action="dqt" data-k="${k}" data-v="lift:${esc(lift.id)}" aria-pressed="true">Lift ${dqName(lift)}</button>`:''}</span>`:'',
    body:function(){const x=this.extra();return `<div class="dq-line">${this.tiers()}</div>${x?`<div class="dq-line">${x}</div>`:''}`},
    get:()=>m.d??null,set:(f,v)=>{const was=m.d!=null&&JourneyRules.miasmaHit(c,MI_ROWS(),m.d).again;dqRef(c,{mind:{...m,d:v==null?null:Math.max(1,Math.min(10,v)),re:!!(m.re||was)}})},
    tap:v=>{if(v==='clear')return dqRef(c,{mind:{t:3,clear:!m.clear}});if(String(v).startsWith('lift:')){const id=String(v).slice(5);return dqRef(c,{mind:{t:3,lift:m.lift===id?'':id}})}
      const t=+v;dqRef(c,{mind:m.t===t?{}:{t}})},
    closes:v=>v==='2'||v==='clear'||String(v).startsWith('lift:'),
    pt:`Mind RR <span class="muted">2d10 ${mod<0?'−':'+'} ${Math.abs(mod)}</span>`,pill:!o.complete?dqPill('wait','tell the Ref'):o.t===1?dqPill('bad',`Tier 1 · ${esc(o.hit.n)}`):dqPill('good',`Tier ${o.t}`)}}
// Study (Rules p. 37: a test, once per item, held or worn): the player asks on their device; the Ref sees the real name and taps the tier
const dqStudyOpen=c=>{const s=c.sask,i=s&&c.inv.find(x=>x.uid===s.uid);return i&&i.unid&&!i.tried?i:null};
function dqStudyItem(c,ref=true){const i=dqStudyOpen(c),k=`${c.id}|study`;if(!i){const r=c.sres,j=r&&c.inv.find(x=>x.uid===r.uid);
    if(!r||r.r!==(c.rests||0)||!j)return null;return {key:k,c,kind:'study',st:r.t===1?'bad':'done',line:`Study · ${dqItemReal(j)} · Tier ${r.t}${r.t===3?'':' '+dqEye}`,pt:`Study <span class="muted">${esc(nm(j))}</span>`,pill:dqPill(r.t===1?'bad':'good',r.t===3?'Tier 3 · identified':`Tier ${r.t}`)}}
  const mod=c.ch.M;
  return {key:k,c,kind:'study',what:`Study <span class="muted">${esc(nm(i))}</span>`,st:'wait',
    body:r=>`${r!==false&&ref?`<p class="dq-empty">It is a <b>${dqItemReal(i)}</b> ${dqEye}</p>`:''}${dqTiersHTML({k,sel:0,label:`${dqName(c)}: Study`,mod:c.ch.M})}`,
    tap:v=>dqStudySet(c,i,+v),closes:()=>true,pt:`Study <span class="muted">${esc(nm(i))} · 2d10 ${mod<0?'−':'+'} ${Math.abs(mod)}</span>`,pill:dqPill('wait','tell the Ref')}}
function dqStudySet(c,i,t){journalRun(`Study: ${IT[i.id].name}, tier ${t}`,[`crow:${c.id}`],()=>{i.tried=true;if(t===3)i.unid=false;c.sres={uid:i.uid,t,r:c.rests||0}})}
// gambling at the inn (Characters: The Inn): the player places the bet on their device, the Ref rolls with one button
const dqBetOpen=c=>c.bet&&c.bet.id&&(!c.betr||c.betr.id!==c.bet.id)?c.bet:null;
const dqBetCall=b=>b.game==='ou'?`calls ${b.pick==='seven'?'Exactly 7':b.pick[0].toUpperCase()+b.pick.slice(1)}`:`guesses ${b.pick}`;
const dqBetGame=b=>b.game==='ou'?'Over/Under 7':'Guess the Number';
const dqBetRes=r=>`${r.b!=null?`2d6: ${r.a} + ${r.b} = ${r.a+r.b}`:`d6: ${r.a}`} · ${r.won?`right, ×${r.mul}: <b>+${r.net} gc</b>`:`<b>−${r.bet} gc</b>`}`;
function dqBetItem(c,ctx){const b=dqBetOpen(c),k=`${c.id}|bet`,r=c.betr,inRest=ctx&&dqAct(c)==='gamble';
  if(b)return {key:k,c,kind:'bet',act:true,what:`Gamble <span class="muted">${dqBetGame(b)} · ${dqBetCall(b)} · ${b.bet} gc</span>`,st:'wait',
    roll:()=>dqBetRoll(c),btn:`<button type="button" class="btn" data-action="dqroll" data-k="${k}">Roll ${b.game==='ou'?'2d6':'d6'}</button>`,
    pt:`Gamble <span class="muted">${dqBetGame(b)} · ${dqBetCall(b)} · ${b.bet} gc</span>`,pill:dqPill('wait','the Ref rolls')};
  if(r&&c.bet&&r.id===c.bet.id&&(!ctx||r.r===(c.rests||0)))return {key:k,c,kind:'bet',st:r.won?'done':'bad',line:`Gamble · ${dqBetRes(r)}`,undo:S.dq.undo[k],pt:`Gamble <span class="muted">${dqBetGame(c.bet)} · ${dqBetCall(c.bet)}</span>`,pill:dqPill(r.won?'good':'bad',r.won?`+${r.net} gc`:`−${r.bet} gc`)};
  if(inRest&&!rvOf(c)?.nobet)return {key:k,c,kind:'bet',what:'Gamble <span class="muted">placing a bet</span>',st:'wait',body:()=>`<div class="dq-opts"><button type="button" class="btn" data-action="dqt" data-k="${k}" data-v="nobet">No bet</button></div>`,tap:()=>dqRef(c,{nobet:true}),pt:'Gamble at the inn',pill:dqPill('wait','place a bet')};
  if(inRest)return {key:k,c,kind:'bet',st:'done',line:'Gamble · no bet',pt:'Gamble at the inn',pill:dqPill('good','no bet')};
  return null}
function dqBetMax(v){return v?INST.inn.val[Math.min(lvlOf(v,'inn'),5)-1]+v.prosperity:0}
function dqBetRoll(c){const b=dqBetOpen(c);if(!b)return;if(coinsOf(c)<b.bet)return toast(`${c.name} has only ${coinsOf(c)} gc`);
  const id=journaled(`${c.name} gambled ${b.bet} gc`,[`crow:${c.id}`,'pool'],()=>{let a=d(6),bb=null,won=false,mul=0;
    if(b.game==='ou'){bb=d(6);const t=a+bb,res=t>7?'over':t<7?'under':'seven';won=res===b.pick;mul=res==='seven'?4:2}else{won=a===+b.pick;mul=5}
    payCoins(c,b.bet);const pay=won?mul*b.bet:0,over=pay?addCoins(c,pay):0;if(over)S.pool.push({uid:UID++,id:'gold-coins',count:over,from:c.name});
    c.betr={id:b.id,a,b:bb,won,mul,bet:b.bet,net:pay-b.bet,r:c.rests||0}});
  if(typeof id==='string')S.dq.undo[`${c.id}|bet`]=id}

/* ---------- the Ref's own lines: where (a dungeon), the rest check ---------- */
function dqRefItems(ctx){const out=(ctx.out||[]).map(c=>({key:`${c.id}|out`,c,kind:'out',st:'bad',line:'<b>Doesn’t rest</b>: no benefits',body:()=>`<div class="dq-opts"><button type="button" class="btn" data-action="dqt" data-k="${c.id}|out" data-v="in">${dqName(c)} rests after all</button></div>`,tap:()=>dqRef(c,{out:false}),closes:()=>true}));
  if(ctx.kind==='dungeon'){const w=ctx.where;out.push({key:'ref|where',c:null,kind:'where',what:'Where <span class="muted">closed off from the Miasma?</span>',st:w?'done':'wait',line:w==='clear'?'Closed off from the Miasma':'Open to the Miasma: humans make a Mind RR',
      body:()=>`<div class="dq-opts"><button type="button" class="btn" data-action="dqt" data-k="ref|where" data-v="clear" aria-pressed="${w==='clear'}">Closed off from the Miasma</button><button type="button" class="btn" data-action="dqt" data-k="ref|where" data-v="miasma" aria-pressed="${w==='miasma'}">Open to the Miasma</button></div>`,
      tap:v=>{S.dt.rest={...S.dt.rest,where:v}},closes:()=>true});
    const ch=S.dt.rest?.chk;out.push({key:'ref|check',c:null,kind:'check',act:!ch,what:`Rest check <span class="muted">d10 ≤ EN ${enOf()}</span>`,st:!ch?'wait':ch.hit&&!ch.ok?'wait':'done',
      line:ch?(ch.hit?`Rest check · d10 ${ch.r}: an encounter${ch.ok?' — dealt with':''}`:`Rest check · d10 ${ch.r}, nothing comes`):'',
      btn:!ch?`<button type="button" class="btn" data-action="dqroll" data-k="ref|check">Roll d10</button>`:'',
      body:()=>ch?.hit?`<p class="dq-res bad"><b>d10 ${ch.r} ≤ EN ${ch.en}: ${esc(ch.text||'an encounter')}</b></p>${(S.dt.encs||[]).map(e=>encCardHTML(e,'scene')).join('')}<div class="dq-opts"><button type="button" class="btn" data-action="dqt" data-k="ref|check" data-v="ok">Dealt with</button></div>`:'',
      roll:()=>{const ec=doEncCheck(enOf());S.dt.rest={...S.dt.rest,chk:{r:ec.r,en:ec.en,hit:ec.hit,text:ec.text||''}};if(ec.hit){S.dt.encs=[...(S.dt.encs||[]),{...ec,k:UID++}];S.dq.open='ref|check';S.dq.fromWait=true}},
      tap:()=>{S.dt.rest={...S.dt.rest,chk:{...S.dt.rest.chk,ok:true}}},closes:()=>true})}
  if(ctx.kind==='camp'||ctx.kind==='poi'){const r=jRestAt(),cp=S.journey.camp||{},sc=S.journey.script,poi=ctx.kind==='poi',T=jRestDay();
    if(r.check||poi){const chk=S.rtravel.restChecks||[],rest=sc?sc.stops.filter(x=>x.kind==='rest'&&!['done','removed'].includes(x.state)):[],open=rest.some(x=>['pending','shown','fight'].includes(x.state));
      const ready=chk.length>0&&!open&&!inFight(),en=poi?jPoiRestEN():T.ren,n=poi?1:T.rchk;
      // the check waits until everyone resting has an activity: Seclude Camp lowers the EN (owner, 2026-11-22); the Ref may still roll now
      const pend=chk.length?[]:(ctx.crows||[]).filter(c=>dqAct(c)===undefined),who=pend.map(dqName).join(', ');
      out.push({key:'ref|check',c:null,kind:'check',act:!chk.length&&!(poi&&cp.closed==null)&&!pend.length,forceOpen:open||inFight(),what:`Rest check${n>1?'s':''} <span class="muted">${pend.length?`waits for ${who} to pick an activity`:`d10 ≤ EN ${en}${jSeclude()?' (Seclude Camp −1)':''}${n>1?` · ${n} checks`:''}`}</span>`,st:ready&&(!poi||cp.closed!=null)?'done':'wait',
        line:`Rest check${n>1?'s':''} · ${chk.map(x=>'d10 '+x.r).join(', ')}${chk.some(x=>x.hit)?': encounter dealt with':', nothing comes'} <span class="muted">EN ${en}${jSeclude()?' (Seclude Camp −1)':''}</span>`,
        btn:!chk.length&&!(poi&&cp.closed==null)?`<button type="button" class="btn" data-action="jrestcheck">Roll ${n>1?`${n} × d10`:'d10'}</button>`:'',
        body:()=>poi&&cp.closed==null?'<p class="dq-empty">Say where they rest first: sheltered or outdoors.</p>':pend.length?`<p class="dq-empty">${who} ${pend.length>1?'have':'has'} no activity yet. Seclude Camp lowers the EN (d10 ≤ EN ${en} now) by 1, so the check comes after the activities.</p><div class="dq-opts"><button type="button" class="btn ghost" data-action="jrestcheck">Roll now anyway</button></div>`:`${chk.map((x,k)=>x.hit?'':encLine(x,k,'Check')).join('')}${rest.map(jStopCardRef).join('')}${chk.length&&!rest.some(x=>['shown','fight'].includes(x.state))?'<div class="dq-opts"><button type="button" class="btn" data-action="jrestcheck">Roll again</button></div>':''}`})}}
  return out}

/* ---------- all the lines of the rest, ordered by crow ---------- */
function dqCrowItems(c,ctx){return [dqActItem(c,ctx),dqFoodItem(c,ctx),ctx.kind==='village'?dqBetItem(c,ctx):null,dqStudyItem(c),dqMindItem(c,ctx)].filter(Boolean)}
function dqRestItems(ctx=dqRest(),crows){if(!ctx)return [];return [...(crows?[]:dqRefItems(ctx)),...(crows||ctx.crows).flatMap(c=>dqCrowItems(c,ctx))]}
// lines outside a rest the Ref answers (Study, bets at the inn); journey.js adds the travel day's own
let DQ_MORE=[];
// a player's own rest without a Ref and outside a scene: where they say they rested
const dqOwnCtx=c=>({kind:'own',where:rqOf(c)?.where||null,check:false,crows:[c],label:''});
function dqAllItems(){const ctx=dqRest(),l=dqRestItems(ctx),seen=new Set(l.map(x=>x.key));
  if(S.role!=='ref'&&ME&&!dqTable())for(const it of dqCrowItems(ME,ctx||dqOwnCtx(ME)))if(!seen.has(it.key)){l.push(it);seen.add(it.key)}
  for(const c of PLAY()){for(const it of [dqStudyItem(c),dqBetItem(c,null)])if(it&&!seen.has(it.key)){l.push(it);seen.add(it.key)}}
  for(const f of DQ_MORE)for(const it of f())if(it&&!seen.has(it.key)){l.push(it);seen.add(it.key)}return l}
const dqFind=k=>dqAllItems().find(x=>x.key===k);

/* ---------- the Ref's queue (03R3A): Waiting (◷ n) and Done; one line opens at a time ---------- */
function dqLineHTML(it,ref){const who=it.c?dqName(it.c):'',open=(S.dq.open===it.key||it.forceOpen)&&!!it.body,k=dqKey(it.key);
  if(open)return `<div class="dq-qo${it.st==='wait'?'':' done'}" role="group" aria-label="${who?who+': ':''}${esc((it.what||it.line||'').replace(/<[^>]+>/g,''))}"><header>${who?`<span class="who">${who}</span>`:''}<span>${it.what||it.line}</span><button type="button" class="btn sm ghost x" data-action="dqo" data-k="${k}">Close</button></header>${it.body(ref)}</div>`;
  if(it.st==='wait')return it.act&&it.btn?`<div class="dq-q wait act"><span class="who">${who}</span><span class="what">${it.what}</span>${it.btn}</div>`
    :`<button type="button" class="dq-q wait" data-action="dqo" data-k="${k}"${it.body?'':' disabled'}><span class="who">${who}</span><span class="what">${it.what}</span></button>`;
  const undo=it.undo&&JOURNAL.find(e=>e.id===it.undo&&!e.undone);
  return `<div class="dq-q done${it.st==='bad'?' bad':''}"${it.body?` data-action="dqo" data-k="${k}" role="button" tabindex="0" aria-label="${who?who+': ':''}${esc(String(it.line).replace(/<[^>]+>/g,''))} — change"`:''}><span class="who">${who}</span><span class="what">${it.line}</span>${undo?`<button type="button" class="btn sm ghost" data-action="dqundo" data-k="${k}">Undo</button>`:''}</div>`}
// a line opened from Waiting stays there while it is open (the Ref may still step its value); closed, it moves to Done
function dqQueueHTML(items,{ref=true,head='',fin=''}={}){const inWait=x=>x.st==='wait'||x.key===S.dq.open&&S.dq.fromWait,wait=items.filter(inWait),done=items.filter(x=>!inWait(x)),n=items.filter(x=>x.st==='wait').length;
  return `<div class="dq-rest">${head}<div class="dq-qcols"><section aria-label="Waiting"><h3 class="dq-qh">Waiting <span class="dq-count ${n?'wait':'ok'}">${n}</span></h3><div class="dq-ql">${wait.map(x=>dqLineHTML(x,ref)).join('')||'<p class="dq-empty">Nothing waits.</p>'}</div></section>
    <section aria-label="Done"><h3 class="dq-qh">Done</h3><div class="dq-ql">${done.map(x=>dqLineHTML(x,ref)).join('')||'<p class="dq-empty">Nothing yet.</p>'}</div></section></div>${fin}</div>`}
function dqRestRefHTML(ctx=dqRest(),o={}){if(!ctx)return '';const items=[...dqRestItems(ctx),...(o.more||[])],left=items.filter(x=>x.st==='wait').length;
  if(!ctx.crows.length&&ctx.kind==='village')return '';
  const lab=ctx.kind==='dungeon'?`Finish the rest · DT ${S.dt.n+1}`:'Finish the rest';
  const head=`<p class="dq-rest-h">${o.title===''?'':`<b>${o.title||'Rest'}</b>`}<span class="muted">${ctx.label}${o.where===false?'':ctx.where==='miasma'?' · in the Miasma':ctx.where==='clear'?' · out of the Miasma':''}</span></p>`;
  // the footer holds the one primary and what is left; a rarer action (Rest interrupted) sits under the lists
  const ex=o.extra?`<div class="dq-extra">${o.extra}</div>`:'';
  const fin=`${ex}${ctx.crows.length?`<div class="dq-fin">${left?`<span class="dq-count wait">${left} left</span>`:''}<button type="button" class="btn ${o.primary===false?'':'primary'}" data-action="dq-finish"${left?' disabled':''}>${lab}</button></div>`:''}`;
  return dqQueueHTML(items,{ref:true,head,fin})}

// the journey's camp and a rest at a point of interest (journey.js jCampRef): the queue while anyone still rests, then who did
const dqResting=()=>{const ctx=dqRest();return !!ctx&&ctx.crows.length>0};
function dqCampRestHTML(){const ctx=dqRest();if(!ctx)return '';const sc=S.journey.script,cp=S.journey.camp||{},chk=(S.rtravel.restChecks||[]).length;
  const restart=(cp.restart||0)||chk||(sc?sc.stops.some(x=>x.kind==='rest'&&x.state!=='removed'):false)?`<button type="button" class="btn ghost" data-action="jrestart">Rest interrupted</button>`:'';
  const now=PLAY().map(dqMindNowItem).filter(Boolean);
  // the place chips right above (jCampRef's chipBox) already say in or out of the Miasma: the queue's head does not repeat it
  if(ctx.crows.length)return dqRestRefHTML(ctx,{extra:restart,more:now,where:false});
  const alive=PLAY().filter(c=>!crowDead(c)),rested=alive.filter(jRested);
  return `<p class="dq-rest-h"><b>Rest</b><span class="dq-count ${rested.length===alive.length?'ok':'wait'}">${rested.length===alive.length?'everyone rested':`${rested.length} of ${alive.length} rested`}</span></p>
    ${now.length?dqQueueHTML(now,{ref:true}):''}
    <ul class="small" style="margin:.3rem 0 0;padding-left:1.1rem">${rested.map(c=>`<li><b>${dqName(c)}</b> · ${c.lastRest==='miasma'?jMindState(c):'out of the Miasma'}</li>`).join('')}</ul>`}

// the Ref's rest in a dungeon (03R3A dungeon): the stage's main card while it lasts
function dqDungeonRestHTML(){const ctx=dqRest();if(!ctx)return '';const left=dqRestItems(ctx).filter(x=>x.st==='wait').length;
  return `<section class="st-card st-dqrest" aria-label="Rest"><header class="st-h"><h2>Rest</h2>${left?`<span class="dq-count wait">${left} waiting</span>`:'<span class="dq-count ok">ready</span>'}</header>
    <p class="muted st-lead">DT ${S.dt.n} has ended · <a href="#rule/r-resting" data-action="open-rule" data-k="r-resting">Resting</a></p>
    ${dqRestRefHTML(ctx,{title:'',extra:'<button type="button" class="btn ghost" data-action="dq-restx">Rest interrupted</button>',more:PLAY().map(dqMindNowItem).filter(Boolean)})}</section>`}
// the Ref's Villages page: the rest of those who rest at the inn or at home, the bets at the inn, Study asks
function dqVillageTopHTML(){if(S.role!=='ref'||S.phase!=='village')return '';const ctx=dqRest();
  const bets=ctx&&ctx.crows.length?PLAY().filter(c=>!ctx.crows.includes(c)).map(c=>dqBetItem(c,null)).filter(x=>x&&x.st==='wait'):[];
  return `${ctx&&ctx.crows.length?`<div class="box dq-vrest"><h2 class="sec-h">The rest</h2>${dqRestRefHTML(ctx,{title:'',more:[...bets,...PLAY().map(dqMindNowItem).filter(Boolean)]})}</div>`:''}${ctx&&ctx.crows.length?'':dqBetsRefHTML()}${dqAsksRefHTML()?`<div class="box">${dqAsksRefHTML()}</div>`:''}`}

/* ---------- Finish the rest: everyone's rest at once, on the Ref's device (or the player's own, without a Ref) ---------- */
// The rest itself is app.js restApply (food, Stamina, wounds, Effort, the activity, XP, pets, UD); then the Mind RR the Ref entered.
function dqRestR(c,ctx){const R=dqForm(c),v=rvOf(c)||{},f=dqFood(c,ctx);
  return {...R,where:ctx.where,food:f||'none',cr:(v.cr||[]).map(dqCraftPts),hv:v.hv,home:f==='home'}}
// o: dqMindOf taken before the rest raised c.rests (the entries belong to the rest that just ended)
function dqMindApply(c,ctx,log,o){const camp=ctx.kind==='camp'||ctx.kind==='poi',rest=c.rests||0;if(!o?.complete)return;
  if(o.t===1){const r=JourneyRules.miasmaRoll(c,MI_ROWS(),()=>o.d,rest);r.miLast.rerolled=!!o.re;c.cruelty=r.cruelty;c.miasma=r.miasma;c.miLast=r.miLast;log.push(`<b>Mind RR tier 1:</b> cruelty ${r.cruelty}, ${esc(r.miLast.hit.n)}`);if(camp)jRefSet(c.id,{mind:1,d10:o.d})}
  else if(o.t===2){c.miLast={rest,k:'t2',snap:miSnap(c),...(o.by?{by:o.by.id}:{})};log.push(`Mind RR tier 2${o.by?` (${esc(o.by.name)} lifted you)`:''}: the Miasma doesn’t touch you`);if(camp)jRefSet(c.id,{mind:2,...(o.by?{lifted:true}:{})})}
  else if(o.clear){const was=c.cruelty;miClear(c);if(o.by)c.miLast.by=o.by.id;log.push(`Mind RR tier 3${o.by?` (${esc(o.by.name)} lifted you)`:''}: cruelty ${was} → 0`);if(camp)jRefSet(c.id,{mind:3,...(o.by?{lifted:true}:{})})}
  else if(o.lift){const to=PARTY.find(x=>x.id===o.lift);c.miLast={rest,k:'lift',to:o.lift,snap:miSnap(c)};log.push(`Mind RR tier 3: you lift ${esc(to?.name||'an ally')}`);if(camp)jRefSet(c.id,{mind:3,lift:o.lift})}}
// owed wounds: the device that plays the crow marks them (S.pendingWounds); the id says which were taken already
function dqOwe(c,n,t,why){if(!(n>0))return;c.owed={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),n,t:t||null,why:why||''}}
function dqFinishCrows(ctx,crows){const done=[];
  const mind=new Map(crows.map(c=>[c,ctx.where==='miasma'?dqMindOf(c,ctx):null])); // every entry is read before any rest moves c.rests on
  for(const c of crows){const R=dqRestR(c,ctx),out=restApply(c,R),log=out.log;if(mind.get(c))dqMindApply(c,ctx,log,mind.get(c));
    c.rlog={r:c.rests||0,l:log.slice(0,30)};done.push(c.name)}
  return done}
function dqFinish(){const ctx=dqRest();if(!ctx||!ctx.crows.length)return;const items=dqRestItems(ctx),left=[...items,...PLAY().map(dqMindNowItem).filter(Boolean),...(ctx.kind==='village'?PLAY().filter(c=>!ctx.crows.includes(c)).map(c=>dqBetItem(c,null)).filter(Boolean):[])].filter(x=>x.st==='wait');
  if(left.length){S.dq.open=left[0].key;S.dq.fromWait=true;render();return toast(`${left.length} still waiting`)}
  const crows=[...ctx.crows],sc=[...crows.map(c=>`crow:${c.id}`),'pool','session',...(ctx.kind==='camp'||ctx.kind==='poi'?['journey']:[]),...(ctx.kind==='village'?['villages']:[])];
  journalRun(ctx.kind==='dungeon'?`Rested: DT ${S.dt.n} → ${S.dt.n+1}`:'Finished the rest',sc,()=>{dqFinishCrows(ctx,crows);
    if(ctx.kind==='dungeon'){PLAY().forEach(c=>DT_END_CONDITIONS.forEach(k=>c.cond.delete(k)));const t=S.dt;t.encs=(t.encs||[]).map(e=>({...e,due:true}));
      Object.assign(t,{n:t.n+1,left:t.len*60,running:false,end:null,fight:'',held:false,rest:null})}});
  S.dq.open=null;toast(ctx.kind==='dungeon'?`The rest is over: DT ${S.dt.n} begins, paused.`:`Rest finished for ${crows.map(dqName).join(', ')}`);
  if(typeof jDone==='function'&&(ctx.kind==='camp'||ctx.kind==='poi'))jDone();else render()}

/* ---------- the player's side: what to roll, then one pill (08R3); the entry itself only without a Ref ---------- */
// o.skip: kinds whose settled line the screen shows already (the camp's steps fold the activity and the food into lines)
function dqMyRestHTML(c,ctx,o={}){const items=(ctx?dqCrowItems(c,ctx):[]).filter(x=>!(o.skip?.includes(x.kind)&&x.st!=='wait'));const table=dqTable();
  if(!table)return `<section class="dq-mine" aria-label="Your rest">${o.h??'<h3 class="hxh">Your rest</h3>'}${items.length?dqQueueHTML(items,{ref:false}):'<p class="dq-empty">Choose an activity above.</p>'}</section>`;
  const rows=items.filter(x=>x.pt).map(x=>`<div class="dq-prow"><span class="t">${x.pt}</span>${x.pill}</div>`).join('');
  return `<section class="dq-mine" aria-label="Your rest">${o.h??'<h3 class="hxh">Your rest</h3>'}<div class="dq-plist">${rows||'<p class="dq-empty">Choose an activity above.</p>'}</div>${ctx?`<p class="dq-pend">${o.wait||'The Ref finishes the rest'}</p>`:`<p class="dq-pend">${o.wait||'The Ref starts the rest'}</p>`}</section>`}
// the finished rest's lines on the crow (c.rlog), shown once on this device
function dqLogHTML(c){const L=c.rlog;if(!L||L.r!==(c.rests||0)||S.dq.seen===`${c.id}:${L.r}`)return '';
  return `<div class="result good dq-log" role="status" style="margin-bottom:1rem"><div class="row" style="justify-content:space-between"><b>Rest finished.</b><button type="button" class="xbtn" data-action="dqseen" aria-label="Hide">✕</button></div><ul style="margin:.4rem 0 0">${L.l.map(x=>`<li>${safeGameHTML(x,true)}</li>`).join('')}</ul></div>`}

/* ---------- the activity: chips, a thin rule, the chosen one's text and controls in one container (chipdesc 3A/4A) ---------- */
function dqActBlockHTML(c,acts,o={}){const R=dqForm(c),det=restDetail(c,R),a=R.act;
  const chips=[...acts.map(([k,l])=>{const off=o.off?.(k);return `<button type="button" class="dq-chip" data-action="${o.act||'ract'}" data-v="${k}" aria-pressed="${a===k}"${off&&a!==k?' disabled':''}>${esc(l)}${off&&a!==k?` <span class="muted">· ${esc(off)}</span>`:''}</button>`}),`<button type="button" class="dq-chip" data-action="${o.act||'ract'}" data-v="" aria-pressed="${a===''}">No activity</button>`].join('');
  const cur=acts.find(x=>x[0]===a),id=cur?.[2],link=a==='gamble'?`<a class="rule-link" href="#rule/${INST.inn.rule}" data-action="open-rule" data-k="${INST.inn.rule}">Full rule →</a>`:id&&BOOK[id]?`<a class="rule-link" href="#rule/${id}" data-action="open-rule" data-k="${id}">Full rule →</a>`:id&&IT[id]?`<a class="rule-link" href="#item/${id}" data-action="open-item" data-id="${id}">The card →</a>`:'';
  return `<div class="dq-cd${cur?' on':''}" role="group" aria-label="Rest activity"><div class="dq-chips">${chips}</div>${cur?`<div class="dq-desc"><p><span class="cd-name">${esc(cur[1])}</span>${esc(cur[3]||'')} ${link}</p>${det[a]?.()||''}</div>`:''}</div>`}
function dqFoodBlockHTML(c,ctx,o={}){const f=dqFood(c,ctx);
  return `<div class="dq-food" role="group" aria-label="Food"><div class="dq-chips">${dqFoodOpts(c,ctx).map(([v,l,sub])=>`<button type="button" class="dq-chip" data-action="${o.act||'dqfood'}" data-v="${v}" aria-pressed="${f===v}" title="${esc(sub)}"${v==='own'&&!dqRations(c)?' disabled':''}>${l}</button>`).join('')}</div></div>`}

/* ---------- Study outside a rest: a card under the crow in the Ref's Party column (06B) ---------- */
function dqStudyCardHTML(c){const i=dqStudyOpen(c);if(!i||S.role!=='ref')return '';const k=`${c.id}|study`;
  return `<div class="dq-ask" role="group" aria-label="${dqName(c)} studies ${esc(nm(i))}"><b>Studies ${esc(nm(i))}</b><p>It is a <b>${dqItemReal(i)}</b> ${dqEye}</p>${dqTiersHTML({k,sel:0,label:`${dqName(c)}: Study`,mod:c.ch.M})}</div>`}
// the asks no rest holds, for a Ref page without a Party column (the journey's step panel, Villages)
function dqAsksRefHTML(){if(S.role!=='ref')return '';const ctx=dqRest(),l=[];
  for(const c of PLAY()){if(dqStudyOpen(c)&&!dqInRest(c,ctx))l.push(`<div><b class="small">${dqName(c)}</b>${dqStudyCardHTML(c)}</div>`)}
  return l.length?`<section class="hxsec dq-asks" aria-label="Asks"><h3 class="hxh">Study</h3>${l.join('')}</section>`:''}
// the bets at the inn (07R2A) on the Ref's Villages page: who, the call, one Roll, the payout with Undo
function dqBetsRefHTML(){if(S.role!=='ref'||S.phase!=='village'||!vHere())return '';const v=vHere(),ctx=dqRest();
  const rows=PLAY().map(c=>dqInRest(c,ctx)&&dqAct(c)==='gamble'?null:dqBetItem(c,null)).filter(Boolean);if(!rows.length)return '';
  return `<div class="box dq-bets"><h2 class="sec-h">Bets at the inn <span class="muted">${esc(v.name)} · 1–${dqBetMax(v)} gc</span></h2>${dqQueueHTML(rows,{ref:true})}</div>`}

/* ---------- the bet form (the inn's card in Services, and the Gamble activity): at a table it places the bet; the Ref rolls ---------- */
function dqBetFormHTML(c){const v=vHere();if(!v||!lvlOf(v,'inn'))return '<p class="small muted" style="margin:0">Gambling needs an inn.</p>';const max=dqBetMax(v),G=S.gamble??={bet:1,game:'ou',pick:'over'},b=dqBetOpen(c),r=c.betr&&c.bet&&c.betr.id===c.bet.id?c.betr:null,table=dqTable();
  const form=`<div class="row"><select data-action="gmode" aria-label="Game"><option value="ou" ${G.game==='ou'?'selected':''}>Over/Under 7 (2d6)</option><option value="num" ${G.game==='num'?'selected':''}>Guess the Number (d6)</option></select>
      ${G.game==='ou'?`<select data-action="gpick" aria-label="Your call">${['over','under','seven'].map(x=>`<option ${G.pick===x?'selected':''}>${x}</option>`).join('')}</select>`:`<select data-action="gpick" aria-label="Your number">${[1,2,3,4,5,6].map(x=>`<option ${+G.pick===x?'selected':''}>${x}</option>`).join('')}</select>`}
      <label class="small">Bet <input type="number" data-action="gbet" min="1" max="${max}" value="${Math.min(G.bet,max)}"></label>${table?`<button type="button" class="btn sm" data-action="dqbet">Place the bet</button>`:`<button class="btn sm" data-action="gamble">Roll</button>`}</div>`;
  return `<p class="small" style="margin:0 0 .5rem">Bet 1–${max} gc: Over/Under 7 pays 2× (Exactly 7 pays 4×), Guess the Number pays 5×.</p>
    ${b&&table?`<div class="dq-prow"><span class="t">${dqBetGame(b)} <span class="muted">${dqBetCall(b)} · ${b.bet} gc</span></span>${dqPill('wait','the Ref rolls')}<button type="button" class="btn sm ghost" data-action="dqbetx">Take back</button></div>`:form}
    ${r&&table?`<div class="dq-prow"><span class="t">Last bet <span class="muted">${dqBetGame(c.bet)} · ${dqBetCall(c.bet)}</span></span>${dqPill(r.won?'good':'bad',r.won?`+${r.net} gc`:`−${r.bet} gc`)}<p class="r">${dqBetRes(r).replace(/<\/?b>/g,'')}</p></div>`:''}
    ${!table&&G.last?`<div class="result" style="margin-top:.5rem">${G.last}</div>`:''}`}

/* ---------- a Mind RR still owed after a rest that ended without one (older saves; the Ref's Miasma view, a player without a Ref) ----------
   It applies at once: tier 1 with its d10, tier 2, tier 3's Clear cruelty; a change undoes the earlier result first. */
const dqMindNowDone=c=>miDone(c)&&c.miLast?.now;
function dqMindNowItem(c){if(c.lastRest!=='miasma'||dqLost(c)&&!dqMindNowDone(c))return null;if(!miPending(c)&&!dqMindNowDone(c))return null;
  const k=`${c.id}|mnow`,L=dqMindNowDone(c)?c.miLast:null,stg=S.dq.mnow[c.id]||{},t=L?(L.k==='fx'?1:L.k==='t2'?2:3):stg.t||0,dd=L?.k==='fx'?L.r:stg.d,base=L?L.snap:{cruelty:c.cruelty,miasma:c.miasma};
  const h=t===1&&dd!=null?JourneyRules.miasmaHit({...c,...base},MI_ROWS(),dd):null,mod=c.ch.M-base.cruelty;
  const undo=()=>{if(dqMindNowDone(c))miUndo(c)};
  const apply=(nt,nd)=>journalRun('Miasma roll',[`crow:${c.id}`],()=>{undo();S.dq.mnow[c.id]={t:nt,d:nd};if(nt===1&&nd!=null){const x=JourneyRules.miasmaHit(c,MI_ROWS(),nd);if(x.hit&&!x.again){const r=JourneyRules.miasmaRoll(c,MI_ROWS(),()=>nd,c.rests||0);r.miLast.now=true;r.miLast.rerolled=!!stg.re;c.cruelty=r.cruelty;c.miasma=r.miasma;c.miLast=r.miLast}else S.dq.mnow[c.id].re=true}
    if(nt===2)c.miLast={rest:c.rests||0,k:'t2',now:true,snap:miSnap(c)}},{quiet:true});
  return {key:k,c,kind:'mnow',what:`Mind RR <span class="muted">after the last rest · cruelty ${base.cruelty}</span>`,st:!L?'wait':L.k==='fx'?'bad':'done',
    line:!L?'':L.k==='fx'?`Mind RR · <b>${L.r}: ${esc(L.hit.n)}</b>`:L.k==='t2'?'Mind RR · Tier 2':`Mind RR · Tier 3: cruelty ${L.snap.cruelty} → 0`,
    tiers:()=>dqTiersHTML({k,sel:t,label:`${dqName(c)}: Mind RR`,mod}),
    extra:()=>t===1?`<span class="dq-line">${dqNumHTML({k,f:'d',v:dd,label:`${dqName(c)}: Miasma d10`,lo:1,hi:10})}${h?.hit?`<span class="dq-ir ${h.again?'wait':'bad'}">${dd} + ${h.cr} = ${dd+h.cr}: <b>${esc(h.hit.n)}</b>${h.again?' — has it, roll again':''}</span>`:''}</span>`:t===3?`<button type="button" class="btn" data-action="dqt" data-k="${k}" data-v="clear" aria-pressed="${L?.k==='clear'}">Clear cruelty · ${base.cruelty} → 0</button>`:'',
    body:function(){return `<div class="dq-line">${this.tiers()}</div>${this.extra()?`<div class="dq-line">${this.extra()}</div>`:''}`},
    get:()=>dd??null,set:(f,v)=>apply(1,v),tap:v=>{if(v==='clear')return journalRun('Cruelty removed',[`crow:${c.id}`],()=>{undo();if(L?.k!=='clear'){miClear(c);c.miLast.now=true;S.dq.mnow[c.id]={t:3}}},{quiet:true});const nt=+v;if(nt===t){undo();S.dq.mnow[c.id]={};return}apply(nt,nt===1?null:undefined);if(nt===3)S.dq.mnow[c.id]={t:3}},
    closes:v=>v==='2'||v==='clear',pt:`Mind RR <span class="muted">2d10 ${mod<0?'−':'+'} ${Math.abs(mod)}</span>`,pill:!L?dqPill('wait','tell the Ref'):L.k==='fx'?dqPill('bad',`Tier 1 · ${esc(L.hit.n)}`):dqPill('good',L.k==='t2'?'Tier 2':'Tier 3')}}
DQ_MORE.push(()=>PLAY().map(dqMindNowItem));

/* ---------- the Ref's Miasma view (01R2A): one row per crow — the tiers, the d10 field, the effect's full name ---------- */
const dqMindParts=it=>({a:it.tiers(),b:it.extra()});
function dqMindRowHTML(it){const c=it.c,p=dqMindParts(it),st=it.st;
  return `<div class="dq-mrow ${st}" role="group" aria-label="${esc(c.name)}: Mind RR"><div class="who"><b>${esc(c.name)}</b><span class="muted">cruelty ${c.cruelty}${c.miasma.length?' · '+c.miasma.map(x=>esc(x.n)).join(', '):''}</span></div>
    <div class="a">${p.a}</div><div class="b">${p.b}</div><div class="st">${st==='wait'?'<span class="dq-st wait">waiting</span>':st==='bad'?'<span class="dq-st bad">tier 1</span>':'<span class="dq-st ok">done</span>'}</div></div>`}
const dqMiasmaScreen=()=>{const ctx=dqRest(),rest=ctx&&ctx.where==='miasma'?ctx.crows.map(c=>dqMindItem(c,ctx)).filter(Boolean):[],now=PLAY().map(dqMindNowItem).filter(Boolean),rows=MI_ROWS();
  const items=[...rest,...now],wait=items.filter(x=>x.st==='wait').length,others=PLAY().filter(c=>!items.some(x=>x.c===c));
  const title=rest.length?`during the rest ${ctx.label}`:now.length?'after the last rest':'';
  return `<div class="dq-mview"><h1 class="dq-rest-h" style="margin:0 0 .75rem"><span>Mind RR</span>${title?`<span class="muted small">${title}</span>`:''}${items.length?`<span class="dq-count ${wait?'wait':'ok'}">${wait?`${wait} waiting`:'all in'}</span>`:''}</h1>
    ${items.length?'':`<p class="muted">Nobody owes a Mind RR now.</p>`}
    <div class="dq-mlist">${items.map(dqMindRowHTML).join('')}</div>
    ${others.length?`<ul class="small muted" style="margin:.75rem 0;padding-left:1.1rem">${others.map(c=>`<li><b>${esc(c.name)}</b> · ${c.lastRest==='miasma'?'last rest in the Miasma':c.lastRest==='clear'?'last rest out of the Miasma':'no rest yet'}${c.cruelty?` · cruelty ${c.cruelty}`:''}${c.miasma.length?' · '+c.miasma.map(x=>esc(x.n)).join(', '):''}</li>`).join('')}</ul>`:''}
    <details class="fold box" style="margin-top:1rem"><summary><h2 class="sec-h">Miasma Effects <span class="muted">d10 + cruelty · both effects apply</span></h2></summary><div class="mifx">${rows.map(r=>`<details><summary><span class="r">${r.hi===99?r.lo+'+':r.lo+'–'+r.hi}</span><b>${esc(r.n)}</b><span class="small muted">${DUR_TXT[r.dur]||''}</span></summary><div>${esc(r.t)}<div class="small"><b>Also:</b> ${esc(r.up)}</div></div></details>`).join('')}</div></details></div>`};

/* ---------- actions ---------- */
const dqDone=()=>{if(typeof jDone==='function'&&S.journey&&jStep()!=='off')jDone();else render()};
function dqAfter(it,closes){if(closes){S.dq.open=null}dqDone()}
const dqClamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const DQ_ACTIONS={
  dqo:b=>{const k=b.dataset.k;S.dq.open=S.dq.open===k?null:k;S.dq.fromWait=!!S.dq.open&&dqFind(k)?.st==='wait';render();if(S.dq.open)requestAnimationFrame(()=>{const n=document.querySelector(`.dq-qo input,.dq-qo .dq-tiers .btn,.dq-qo .btn:not(.x)`);n?.focus({preventScroll:false})})},
  dqn:b=>{const it=dqFind(b.dataset.k);if(!it?.set)return;const lo=+b.dataset.lo,hi=+b.dataset.hi,cur=it.get?.(b.dataset.f);it.set(b.dataset.f,cur==null?lo:dqClamp(cur+ +b.dataset.d,lo,hi));dqDone()},
  dqt:b=>{const it=dqFind(b.dataset.k);if(!it?.tap)return;const v=b.dataset.v;it.tap(v);dqAfter(it,it.closes?.(v)||it.kind==='act'||it.kind==='food'||it.kind==='bet')},
  dqroll:b=>{const it=dqFind(b.dataset.k);if(!it?.roll)return;it.roll();dqDone()},
  dqundo:b=>{const id=S.dq.undo[b.dataset.k],e=JOURNAL.find(x=>x.id===id);if(e)undoEntry(e);delete S.dq.undo[b.dataset.k];dqDone()},
  'dq-finish':()=>dqFinish(),
  dqbet:()=>{const c=ME,v=vHere(),G=S.gamble;if(!c||!v||!G)return;const max=dqBetMax(v),bet=Math.max(1,Math.min(max,+G.bet||1));if(coinsOf(c)<bet)return toast('Not enough coins');
    c.bet={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),game:G.game,pick:String(G.pick),bet};render()},
  dqbetx:()=>{const c=ME;if(c&&dqBetOpen(c)){c.bet=null;render()}},
  dqseen:()=>{const c=ME;if(c?.rlog)S.dq.seen=`${c.id}:${c.rlog.r}`;render()},
  dqfood:b=>{const c=ME,ctx=dqRest()||{kind:'own'};if(!c)return;dqFoodSet(c,ctx,dqFood(c,ctx)===b.dataset.v&&rqOf(c)?.food?'':b.dataset.v,'me');dqDone()},
  // the Ref begins a rest in a dungeon (Rules: Resting): the turn ends without its encounter check; who rests is the party now
  'dq-rest':()=>{if(inFight())return toast('End the combat first');journalRun(`Rest: DT ${S.dt.n} ends`,['session'],()=>{Object.assign(S.dt,{running:false,end:null,held:false,rest:{base:Object.fromEntries(PLAY().map(c=>[c.id,c.rests||0])),where:null,chk:null}})});
    S.dq.open='ref|where';S.dq.fromWait=true;toast(`DT ${S.dt.n} ends: the party rests. Say where, then roll the rest check.`);render()},
  'dq-restx':()=>{if(!S.dt.rest)return;journalRun('Rest interrupted',['session'],()=>{S.dt.rest={...S.dt.rest,chk:null}});render()},
  'dq-restoff':()=>{if(!S.dt.rest)return;journalRun('Rest called off',['session'],()=>{S.dt.rest=null});render()}};
// a typed value: Enter or leaving the field keeps it; an empty field clears it
document.addEventListener('change',e=>{const t=e.target;if(!t.matches?.('input[data-dq]'))return;const it=dqFind(t.dataset.dq);if(!it?.set)return;
  const n=parseInt(String(t.value).replace(/[^0-9]/g,''),10);it.set(t.dataset.f,Number.isFinite(n)?dqClamp(n,+t.dataset.lo,+t.dataset.hi):null);dqDone()});
document.addEventListener('keydown',e=>{const t=e.target;if(e.key==='Enter'&&t.matches?.('input[data-dq]')){e.preventDefault();t.blur()}
  if((e.key==='Enter'||e.key===' ')&&t.matches?.('.dq-q.done[data-action=dqo]')){e.preventDefault();t.click()}});

/* ---------- derived on every render: wounds the Ref dealt are marked on the device that plays the crow ---------- */
// app.js renderBody calls it
// owedTaken: the ids already marked (an Undo on the Ref's device can bring an older one back: it is not marked twice)
function dqTakeOwed(){const c=ME;if(S.role==='ref'||!c||!c.owed)return;const t=[].concat(c.owedTaken||[]);if(t.includes(c.owed.id))return;
  S.pendingWounds=(S.pendingWounds||0)+c.owed.n;S.pendingWoundType=c.owed.t||null;c.owedTaken=[...t,c.owed.id].slice(-12);toast(`${c.owed.why?c.owed.why+': ':''}mark ${c.owed.n} wound${c.owed.n>1?'s':''} in your backpack`)}

/* ================= the travel day (journey.js): roles, hirelings' tests, weather, hunting ================= */
/* ---------- role tests (02R2A): per traveller Tier 1/2/3 and Doom; the player spends Effort on their own device ---------- */
const dqTaskName=x=>x.role==='assist'?'Assist':JRS.TASK_NAMES[x.task]||'';
function dqRoleItem(a){const x=a.x;if(!x.role||x.role==='none'||!jRisky(x))return null;const k=`${a.id}|tier`,c=a.c,hire=!!a.h;
  return {key:k,c,kind:'tier',st:!x.tier?'wait':x.doom?'bad':'done',tap:v=>{
    if(hire)return jHireRef(c,a.h.uid,{tier:x.tier===+v?0:+v});
    if(v==='doom')return jRefSet(c.id,{role:x.role,task:x.task||'',targets:x.targets||[],tier:x.doom?0:1,doom:!x.doom,effort:false});
    const t=+v;jRefSet(c.id,{role:x.role,task:x.task||'',targets:x.targets||[],tier:x.tier===t&&!x.doom?0:t,doom:false,effort:false})}}}
DQ_MORE.push(()=>typeof jAllIn==='function'&&S.journey&&jStep()==='roles'?jAllIn().map(dqRoleItem):[]);
// the Ref's row for one traveller: who, the task, the status; the outcome with the Effort tag; the tiers (the one before the Effort struck)
function dqRoleRowHTML(a){const x=a.x,def=x.role==='assist'?J_ASSIST:jTaskDef(x.task),name=a.h?`${esc(a.h.name)} <span class="muted">${jName(a.c)}’s hireling</span>`:jName(a.c),task=`${esc(x.role[0].toUpperCase()+x.role.slice(1))} · ${esc(dqTaskName(x))}`;
  if(!jRisky(x))return `<div class="dq-row done"><header><b>${name}</b><span class="muted">${task}</span><span class="dq-st ok">safe</span></header></div>`;
  const t=x.tier||0,st=!t?'wait':x.doom?'bad':'done',out=t?rich(def.o[(x.doom?1:t)-1]||''):'';
  return `<div class="dq-row ${st}"><header><b>${name}</b><span class="muted">${task}</span><span class="dq-st ${st==='wait'?'wait':st==='bad'?'bad':'ok'}">${!t?'waiting':x.doom?'doom':'tier '+t}</span></header>
    ${t?`<p class="dq-what">${x.effort?'<span class="dq-tag warn">+1 Effort</span> ':''}${out}</p>`:''}${dqTiersHTML({k:`${a.id}|tier`,sel:x.doom?0:t,doom:a.h?undefined:!!x.doom,was:x.effort&&t>1?t-1:undefined,label:a.h?a.h.name:a.c.name,mod:typeof jTierMod==='function'?jTierMod(a):0})}</div>`}
// the player's own test at a table (08R2B): what to roll, one pill, the Effort to spend; the outcome once the Ref has it
function dqTestPillHTML(c,x,mod,shift){const def=x.role==='assist'?J_ASSIST:jTaskDef(x.task),t=x.tier||0,roll=`2d10 ${mod<0?'−':'+'} ${Math.abs(mod)}${shift?`, ${shift>0?'double edge':'double bane'}`:''}`;
  const spend=t&&t<3&&!x.doom&&!x.effort&&c.effort>0?`<button type="button" class="btn sm" data-action="jspend" aria-label="Spend 1 Effort: tier ${t+1}">+1 Effort</button>`:'';
  return `<div class="dq-prow"><span class="t">${esc(dqTaskName(x))} <span class="muted">${roll}</span></span>${!t?dqPill('wait','tell the Ref'):x.doom?dqPill('bad','Doom'):dqPill('good',`Tier ${t}`)}${spend}${x.effort?'<span class="dq-tag warn">+1 Effort</span>':''}${t?`<p class="r">${rich(def.o[(x.doom?1:t)-1]||'')}</p>`:''}</div>`}

/* ---------- hunting and foraging (05R2A): the totals the player says, in compact fields; the goods go to the pack ---------- */
function dqGainItem(a){const x=a.x;if(!x.role||x.role==='none')return null;const fx=JRS.FX[JRS.fxKey(x.task,x.doom?1:x.tier)]||{};if(!['hunt2','hunt3'].includes(fx.loot))return null;
  const g=jGain(x)||{t:x.task,r:0,p:0},three=fx.loot==='hunt3',k=`${a.id}|gain`;if(g.given)return {key:k,c:a.c,kind:'gain',st:'done'};
  return {key:k,c:a.c,kind:'gain',st:'wait',three,g,get:f=>g[f]||null,
    // the values stay editable until the one Give tap (a − / + step must not hand goods over halfway)
    set:(f,v)=>jGainSet(a,`${x.task}:${f==='r'?v||0:g.r}:${f==='p'?v||0:g.p}`),
    fields:()=>`<div class="dq-line"><span class="k">Rations</span>${dqNumHTML({k,f:'r',v:g.r||null,label:`${a.h?esc(a.h.name):jName(a.c)}: rations, ${three?'3d6':'1d6'}`,lo:three?3:1,hi:three?18:6})}</div>${three?`<div class="dq-line"><span class="k">Parts</span>${dqNumHTML({k,f:'p',v:g.p||null,label:`${a.h?esc(a.h.name):jName(a.c)}: animal parts, 1d6`,lo:1,hi:6})}</div>`:''}`}}
DQ_MORE.push(()=>typeof jAllIn==='function'&&S.journey&&['script','road','camp'].includes(jStep())?jAllIn().map(dqGainItem):[]);

/* ---------- weather (04R2B): the tier per crow, the Ref rolls the damage or the mold with one button ---------- */
const dqDice=t=>{const m=String(t).match(/(\d+)d(\d+)(?:\s*\+\s*(\d+))?/);return m?{n:+m[1],d:+m[2],p:+(m[3]||0)}:null};
const dqRollDice=o=>{let s=o.p;for(let i=0;i<o.n;i++)s+=d(o.d);return s};
const dqDieTxt=o=>`${o.n}d${o.d}${o.p?' + '+o.p:''}`;
// who tests: no cold weather gear for the cold; a heat wave after 2 hexes; mold only with rations
function dqWxWho(w){const walked=S.journey.script?.at||0;return PLAY().filter(c=>!crowDead(c)&&!(w.n==='Heat Wave'&&walked<=2)&&!(/rations/.test(w.when)&&!jRations(c).length&&!jWxGot(jIn(c),w.n)))}
const dqWxCold=n=>J_COLD.includes(n);
// one crow's entry for one weather: hours (cold: one entry per hour, "t" or "t=dmg"), or "t", "t=dmg", "t/lost"
function dqWxParse(got){const l=String(got||'').split(',').filter(Boolean).map(s=>{const m=s.match(/^(\d)(?:=(\d+))?(?:\/(\d+))?$/);return m?{t:+m[1],dmg:m[2]!=null?+m[2]:null,lost:m[3]!=null?+m[3]:null}:{t:0}});return l}
const dqWxJoin=l=>l.map(e=>`${e.t}${e.dmg!=null?'='+e.dmg:''}${e.lost!=null?'/'+e.lost:''}`).join(',');
function dqWxItem(c,w){const x=jIn(c),cold=dqWxCold(w.n),gear=cold&&c.inv.some(i=>i.id==='cold-weather-gear'),l=dqWxParse(jWxGot(x,w.n)),k=`${c.id}|wx|${w.n}`;if(gear)return {key:k,c,w,gear:true,st:'done'};
  const hours=cold?+(S.journey.effects||[]).find(e=>e.name===w.n)?.hours||0:1,cur=cold?(l.length<hours||!l.length?{t:0,new:true}:l[l.length-1]):l[0]||{t:0,new:true};
  const tierTxt=cur.t?w.tiers[cur.t-1]||'':'',dmg=/dam/.test(tierTxt)?dqDice(tierTxt):null,mold=cur.t?jMold(tierTxt):null;
  const needRoll=cur.t&&!cur.new&&(dmg&&cur.dmg==null||mold&&cur.lost==null),idle=cold&&hours>0&&l.length>=hours&&!needRoll;
  const write=nl=>jRefSet(c.id,{wx:jWxSet(x,w.n,dqWxJoin(nl))});
  return {key:k,c,w,kind:'wx',cold,hours,l,cur,dmg,mold,st:idle||cur.t&&!needRoll&&!cur.new?(cur.dmg>0||cur.lost>0?'bad':'done'):hours===0?'done':'wait',
    tap:v=>{const t=+v;if(cold){const nl=[...l];if(cur.new)nl.push({t});else if(cur.dmg==null)nl[nl.length-1]={t};write(nl)}else if(cur.dmg==null&&cur.lost==null)write(cur.t===t?[]:[{t}])},
    roll:()=>{if(!needRoll)return;const nl=[...l],i=cold?nl.length-1:0;
      const id=journaled(`${w.n}: ${c.name}`,[`crow:${c.id}`,'journey'],()=>{if(dmg){const n=dqRollDice(dmg),s0=c.stamina,st=Math.min(c.stamina,n);c.stamina-=st;const wd=n-st;if(wd>0)dqOwe(c,wd,null,`${w.n}: ${n} P damage`);nl[i]={...nl[i],dmg:n};S.dq.wx[k]=`${dqDieTxt(dmg)} → ${n}: Stamina ${s0} → ${c.stamina}${wd?`, ${wd} wound${wd>1?'s':''}`:''}`}
        else if(mold){let n=mold.fixed||dqRollDice(dqDice(tierTxt)),lost=0;for(const r of jRations(c)){if(!n)break;const m=Math.min(n,r.count);addCount(r,-m);n-=m;lost+=m}c.inv=c.inv.filter(i=>!(J_RATIONS.includes(i.id)&&i.count<=0));nl[i]={...nl[i],lost};S.dq.wx[k]=`${mold.fixed?'':dqDieTxt(dqDice(tierTxt))+' → '}${lost} ration${lost===1?'':'s'} lost to mold`}
        write(nl)});if(typeof id==='string')S.dq.undo[k]=id}}}
DQ_MORE.push(()=>typeof jWxTests==='function'&&S.journey&&['road','camp'].includes(jStep())?jWxTests().flatMap(w=>dqWxWho(w).map(c=>dqWxItem(c,w))):[]);
function dqWxRowHTML(it){const c=it.c,w=it.w,k=it.key;if(it.gear)return `<div class="dq-row done"><header><b>${jName(c)}</b><span class="dq-st q muted">– cold weather gear</span></header></div>`;
  const cur=it.cur,needRoll=cur.t&&!cur.new&&(it.dmg&&cur.dmg==null||it.mold&&cur.lost==null),undo=S.dq.undo[k]&&JOURNAL.find(e=>e.id===S.dq.undo[k]&&!e.undone);
  const res=cur.dmg!=null?`<span class="dq-ir bad">${S.dq.wx[k]?esc(S.dq.wx[k]).replace(/→ (\d+):/,'→ <b>$1:')+'</b>':`<b>${cur.dmg} P damage</b>`}</span>`:cur.lost!=null?`<span class="dq-ir bad"><b>${S.dq.wx[k]?esc(S.dq.wx[k]):cur.lost+' rations lost to mold'}</b></span>`:'';
  const head=it.cold&&it.hours?`hour ${Math.min(it.l.length+(cur.new?1:0),it.hours)}`:'';
  return `<div class="dq-row ${it.st==='bad'?'bad':it.st}"><header><b>${jName(c)}</b>${head?`<span class="muted">${head}</span>`:''}<span class="dq-st ${it.st==='wait'?'wait':it.st==='bad'?'bad':'ok'}">${it.st==='wait'?(needRoll?'to roll':'waiting'):cur.dmg?`${cur.dmg} P dam`:cur.lost?`${cur.lost} lost`:it.hours===0?'no hour yet':'tier '+cur.t}</span></header>
    ${it.hours===0?'<p class="dq-what">No hour outside yet.</p>':`<div class="dq-line">${dqTiersHTML({k,sel:cur.new?0:cur.t,label:`${c.name}: ${w.n}`,mod:0})}${needRoll?`<button type="button" class="btn" data-action="dqroll" data-k="${dqKey(k)}">${it.dmg?'Roll '+dqDieTxt(it.dmg):it.mold.fixed?`Lose ${it.mold.fixed} ration${it.mold.fixed>1?'s':''}`:'Roll '+dqDieTxt(dqDice(w.tiers[cur.t-1]))}</button>`:''}</div>`}
    ${res?`<div class="dq-line">${res}${undo?`<button type="button" class="btn sm ghost" data-action="dqundo" data-k="${dqKey(k)}">Undo</button>`:''}</div>`:''}</div>`}
// the Ref's weather tests on the road and at camp
function dqWxRefHTML(){if(S.area!=='session'||!['road','camp'].includes(jStep()))return '';const ws=jWxTests();if(!ws.length)return '';
  return ws.map(w=>{const items=dqWxWho(w).map(c=>dqWxItem(c,w)),left=items.filter(x=>x.st==='wait').length;
    return `<section class="hxsec dq-wx"><h3 class="hxh">${esc(w.n)} <span class="muted">${esc(w.roll.replace(/^2d10 \+ (\w)$/,(m,a)=>`${a==='S'?'Strength':a==='M'?'Mind':'Agility'} test`))}${left?` · <span class="dq-count wait">${left}</span>`:''}</span></h3>${items.map(dqWxRowHTML).join('')}</section>`}).join('')}
// the player's weather line at a table: what to roll, one pill, the result
function dqWxPillHTML(c,w,mod){const it=dqWxItem(c,w),cur=it.cur,roll=`${esc(w.n)} <span class="muted">2d10 ${mod<0?'−':'+'} ${Math.abs(mod)}${it.cold&&it.hours?` · hour ${Math.min(it.l.length+(cur.new?1:0),it.hours)}`:''}</span>`;
  const pill=it.hours===0?dqPill('good','no hour yet'):cur.new||!cur.t?dqPill('wait','tell the Ref'):cur.dmg!=null?dqPill('bad',`Tier ${cur.t} · ${cur.dmg} P damage`):cur.lost!=null?dqPill(cur.lost?'bad':'good',`Tier ${cur.t} · ${cur.lost} ration${cur.lost===1?'':'s'} lost`):(it.dmg||it.mold)?dqPill('wait',`Tier ${cur.t} · the Ref rolls`):dqPill('good',`Tier ${cur.t}`);
  return `<div class="dq-prow"><span class="t">${roll}</span>${pill}${cur.t&&!cur.new?`<p class="r">${esc(w.tiers[cur.t-1]||'')}</p>`:''}</div>`}
