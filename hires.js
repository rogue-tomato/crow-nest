/* Hirelings in the travel day (owner, 2026-11-23): the player plays them.
   - Their role and task are a step of the player's plan (the same chips as the crow's), answered before the plan settles.
   - Their pay is a step too: power × 10 gc (at least 10) and a day's food at the start of each day (Characters p. 47).
   - A hireling not paid when the Ref rolls the day leaves the crow's service by himself (one journal entry, Undo in the toast):
     what the crow lent him comes back (or goes to the loot pool), his own gear goes with him ("willing to return anything
     borrowed", p. 48). Word gets around: no hireling works for the party until the debt is paid (c.debt, on the crow who owes).
   - Their Mind RR after a rest in the Miasma: the player rolls it and tells the Ref, who taps the tier (h.mind, on the hireling).
   Loaded after places.js. */
const HR_ROLES=['guide','scout','tracker','none'];
const hrIn=(c,h)=>(jIn(c).hires||{})[h.uid]||{};
const hrDone=a=>!!a.role&&(a.role==='none'||!!a.task);
const hrUnpaid=()=>PLAY().flatMap(c=>(c.hires||[]).filter(h=>!jHirePaid(h)).map(h=>({c,h})));
const hrDebts=()=>PARTY.flatMap(c=>(c.debt||[]).map((d,k)=>({c,d,k})));
const hrNames=l=>l.length<2?l[0]||'':`${l.slice(0,-1).join(', ')} and ${l[l.length-1]}`;
const hrRations=c=>jRations(c).reduce((a,i)=>a+(i.count||0),0);

/* ---------- the player's steps ---------- */
// a hireling's role and task: the crow's chips; a guide or scout slot someone has is shown taken, with who
function hrStepHTML(c,h,n){const a=hrIn(c,h),u=h.uid,lost=jTotals().lost,others=jAllIn().filter(x=>x.id!==`${c.id}/${u}`);
  const taken=r=>{const o=others.filter(x=>x.x.role===r);return (r==='guide'&&o.length>=1||r==='scout'&&o.length>=(o.some(x=>x.x.task==='places')?2:1))?o[0]:null};
  const who=x=>x.h?esc(x.h.name):jName(x.c);
  const roles=chipBox({label:`${h.name}’s role`,action:'tvhrole',sel:a.role?`${u}:${a.role}`:null,items:HR_ROLES.map(r=>{const t=r==='none'||a.role===r?null:taken(r);
    return {v:`${u}:${r}`,label:r==='none'?'No role':r[0].toUpperCase()+r.slice(1),dis:!!t,why:t?`taken by ${who(t)}`:''}}),
    desc:a.role&&a.role!=='none'?chipBox({cls:'cd-inner',lead:'<span class="cd-lbl" aria-hidden="true">Task</span>',label:'Task',action:'tvhtask',sel:a.task?`${u}:${a.task}`:null,
      items:Object.keys(JRS.ROLES[a.role].tasks).filter(t=>a.role!=='guide'||(lost?t==='back':t!=='back')).map(t=>({v:`${u}:${t}`,label:esc(jTaskDef(t).n)}))}):''});
  const pets=(c.pets||[]).filter(jBig),cart=String(jIn(c).ride||'').startsWith('v:');
  const ride=pets.length||cart?`<div class="hr-ride">${chipBox({lead:'<span class="cd-lbl">Travels</span>',label:`How ${h.name} travels`,action:'tvhride',sel:`${u}:${a.ride||''}`,
    items:[{v:`${u}:`,label:'On foot'},...pets.map(p=>({v:`${u}:p:${p.uid}`,label:`Rides ${esc(p.name)}`})),...(cart?[{v:`${u}:cart`,label:'In your vehicle'}]:[])]})}</div>`:'';
  return tvpStep(n,`${esc(h.name)}, your hireling`,`${esc((MON[h.mon]?.name||'').toLowerCase())}`,roles+ride)}
// the day's pay: one tap when there is enough; what is short said at once, and that he leaves at the roll
function hrPayHTML(c,h,n){const k=c.hires.indexOf(h),pay=hirePay(h),gc=coinsOf(c),rat=hrRations(c),short=gc<pay?`you have ${gc} gc`:!rat?'you have no ration':'';
  return tvpStep(n,`Pay ${esc(h.name)} for today`,'',`<div class="hr-pay"><span class="big">${pay} gc + 1 ration</span>${short?dqPill('bad',short):`<span class="tv-note">you have ${gc} gc · ${rat} ration${rat===1?'':'s'}</span>`}</div>
    ${short?`<p class="tv-note hr-short">Not paid, ${esc(h.name)} leaves your service when the Ref rolls the day.</p>`:''}
    <div class="tvp-acts">${short?'':`<button class="btn primary" data-action="jhpay" data-k="${k}">Pay ${esc(h.name)}</button>`}<button class="linkbtn" data-action="hire-del" data-k="${k}">Let ${esc(h.name)} go${short?' now':''}</button></div>`)}
// the folded lines of the crow's hirelings: role and task, paid
const hrLines=(c,open)=>(c.hires||[]).filter(h=>hrDone(hrIn(c,h))).map(h=>tvpDone(esc(h.name),`${jTaskLine(hrIn(c,h))}${jHirePaid(h)?' · paid':''}`,open&&`h:${h.uid}`));
// what the plan asks next of the crow's hirelings (n: the first step number free), or ''
function hrNextHTML(c,st,n){const hs=c.hires||[];if(!hs.length)return '';
  const q=st==='plan'?hs.findIndex(h=>!hrDone(hrIn(c,h))):-1;if(q>=0){const h=hs[q],up=!jHirePaid(h)?tvpNext(n+hs.length,`Pay ${esc(h.name)} for today · ${hirePay(h)} gc and 1 ration`):'';return hrStepHTML(c,h,n+q)+up}
  const p=hs.findIndex(h=>!jHirePaid(h));return p>=0?hrPayHTML(c,hs[p],n+hs.length+p):''}

/* ---------- the Ref: Roll the day lets the unpaid go ---------- */
function hrLeaveUnpaid(){const l=hrUnpaid();if(!l.length)return;
  journalRun(`${hrNames(l.map(x=>x.h.name))} left unpaid`,[...new Set(l.map(x=>'crow:'+x.c.id)),'pool'],()=>{for(const {c,h} of l){const k=c.hires.indexOf(h);if(k<0)continue;
    for(const i of [...(h.inv||[])])petBack(c,h,i);c.hires.splice(k,1);(c.debt??=[]).push({name:h.name,gc:hirePay(h),day:jDay()})}});
  render()}
const hrUnpaidNote=()=>{const l=hrUnpaid();if(!l.length)return '';const one=l.length===1;
  return `<span class="tv-note hr-bad">${hrNames(l.map(x=>esc(x.h.name)))} ${one?`isn’t paid: leaves ${jName(l[0].c)}’s service`:'aren’t paid: they leave'} when you roll</span>`};
// the roll is the step becoming the road on the Ref's device, by any way (Roll the day, an old save's Script step); a reload on
// the road is not a roll
let HR_LAST='';
{const base=render;render=function(){const st=S.role==='ref'&&S.journey?jStep():'',roll=st==='road'&&['plan','roles','script'].includes(HR_LAST);HR_LAST=st;
  const r=base.apply(this,arguments);if(roll&&hrUnpaid().length)setTimeout(hrLeaveUnpaid,0);return r}}

/* ---------- the debt: no hireling works for the party ---------- */
function hrDebtHTML(){const l=hrDebts();if(!l.length)return '';
  return `<div class="banner bad hr-debt"><div class="msg"><b>No hireling will work for the party</b><span>${l.map(({c,d})=>`${esc(d.name)} left ${c===ME?'you':jName(c)} unpaid on day ${d.day}: ${c===ME?'you owe':`${jName(c)} owes`} ${esc(d.name)} ${d.gc} gc.`).join(' ')} Word gets around until the debt is paid.</span></div>
    ${l.filter(x=>x.c===ME).map(x=>`<button class="btn" data-action="hrdebt" data-k="${x.k}"${coinsOf(ME)<x.d.gc?` disabled title="You have ${coinsOf(ME)} gc"`:''}>Pay the debt · ${x.d.gc} gc</button>`).join('')}</div>`}

/* ---------- Mind RR after a rest in the Miasma: the player rolls, the Ref taps the tier ---------- */
const hrMindKey=()=>`${jDay()}.${S.journey?.camp?.restart||0}`;
const hrMindOf=h=>h.mind?.k===hrMindKey()?h.mind:null;
const hrMindMod=h=>(parseInt(MON[h.mon]?.st.Mind)||0)-(h.cruelty||0)-((S.journey?.effects||[]).some(e=>e.kind==='strong')?2:0);
const hrMindPill=h=>{const m=hrMindOf(h);return !m?dqPill('wait','tell the Ref'):m.t===1?dqPill('bad',`Tier 1${m.n?' · '+esc(m.n):''}`):dqPill('good',`Tier ${m.t}`)};
function hrMindPlayerHTML(c){if(!(jRested(c)&&c.lastRest==='miasma')||!(c.hires||[]).length)return '';
  return `<section class="hxsec hr-mind"><h3 class="hxh">Your hirelings’ Mind RR <span class="muted">the Miasma, tonight</span></h3>${c.hires.map(h=>{const m=hrMindMod(h);
    return `<div class="dq-prow"><span class="t">${esc(h.name)} <span class="muted">2d10 ${m<0?'−':'+'} ${Math.abs(m)}</span></span>${hrMindPill(h)}</div>`}).join('')}</section>`}

Object.assign(A,{
  tvhrole:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const [u,r]=String(b.dataset.v).split(':'),hs={...(x.hires||{})},cur=hs[u]||{};
    hs[u]=cur.role===r?{...(cur.ride?{ride:cur.ride}:{})}:{role:r,tier:0,...(cur.ride?{ride:cur.ride}:{})};jMine({hires:hs});jDone()},
  tvhtask:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const v=String(b.dataset.v),i=v.indexOf(':'),u=v.slice(0,i),t=v.slice(i+1),hs={...(x.hires||{})},cur=hs[u]||{};if(!cur.role)return;
    hs[u]={...cur,task:cur.task===t?'':t,tier:0};jMine({hires:hs});jDone()},
  tvhride:b=>{const c=jMe(),x=c&&jIn(c);if(!x)return;const v=String(b.dataset.v),i=v.indexOf(':'),u=v.slice(0,i),r=v.slice(i+1),hs={...(x.hires||{})},cur={...(hs[u]||{})};
    if(r)cur.ride=r;else delete cur.ride;hs[u]=cur;jMine({hires:hs});jDone()},
  hrdebt:b=>{const k=+b.dataset.k,d=ME?.debt?.[k];if(!d)return;if(coinsOf(ME)<d.gc)return toast(`You need ${d.gc} gc`);
    journalRun(`Paid ${d.name} the debt`,[`crow:${ME.id}`],()=>{payCoins(ME,d.gc);ME.debt.splice(k,1)});render()},
  // the Ref's tap of the tier the player said (journey.js jHiresNightRef); a Tier 1 rolls the Miasma table on the Ref's device
  jhmindt:b=>{const c=PARTY.find(x=>x.id===b.dataset.c),h=c?.hires?.[+b.dataset.k],t=+b.dataset.v;if(!h||!t)return;
    journalRun(`${h.name}: Mind RR tier ${t}`,[`crow:${c.id}`],()=>{let n='';
      if(t===1){h.cruelty=(h.cruelty||0)+1;const rows=MI_ROWS();for(let i=0;i<20;i++){const v=d(10)+h.cruelty,hit=rows.find(x=>v>=x.lo&&v<=x.hi);if(!hit)break;if(hit.lo<13&&(h.miasma||[]).includes(hit.n))continue;n=hit.n;h.miasma=[...(h.miasma||[]),hit.n];break}}
      if(t===3){h.cruelty=0;h.miasma=(h.miasma||[]).filter(x=>(MI_ROWS().find(r=>r.n===x)||{}).dur!=='cruelty')}
      h.mind={k:hrMindKey(),t,n}});jDone()}});
// a Change on a hireling's line reopens his role (journey.js keeps his ride)
{const base=A.tvchange;A.tvchange=b=>{const v=String(b.dataset.v||'');if(!v.startsWith('h:'))return base(b);const c=jMe(),x=c&&jIn(c);if(!x)return;
  const u=v.slice(2),hs={...(x.hires||{})},cur=hs[u]||{};hs[u]=cur.ride?{ride:cur.ride}:{};jMine({hires:hs});jDone()}}
// no hireling works for a party that owes one
{const base=A['hire-add'];A['hire-add']=b=>{if(hrDebts().length)return toast('No hireling will work for the party until the debt is paid');return base(b)}}
// Go without X: their hirelings are left out with them
{const base=A.jrout;A.jrout=b=>{const c=PARTY.find(x=>x.id===b?.dataset?.k);if(c)for(const h of c.hires||[])if(!hrDone(hrIn(c,h)))jHireRef(c,h.uid,{role:'none',task:'',tier:0});return base(b)}}
