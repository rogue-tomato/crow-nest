'use strict';
/* CROW NEST — prototype. Vanilla JS, no build step: open index.html.
   Data: data.js (generated from the Playtest 3 PDFs), rules.js (hand-written glossary). */
Object.assign(GLOSS,{
  'q-reload':['Reload','Use a maneuver to load 1 ammunition before each attack.','',[]],
  'q-heavy':['Heavy','Upgrading this weapon’s material costs more and gives a bigger bonus.','',['crafting']],
});
const D=window.DATA, IT={}, MON={}, TB={};
D.items.forEach(i=>IT[i.id]=i); D.monsters.forEach(m=>MON[m.id]=m); D.tables.forEach(t=>TB[t.id]=t);
// data.js as generated put Major Treasures 38–73 after Minor Treasures' 101+ row (tools/build_data.py now files them right; the
// data needs the PDFs to regenerate). Until then the rows go back where their numbers belong, only when they fill Major's gap exactly.
(()=>{const mi=TB['minor-treasures'],ma=TB['major-treasures'];if(!mi||!ma)return;const n=r=>parseInt(r[0]),k=mi.rows.findIndex(r=>/^\d+\+/.test(r[0]));
  if(k<0||k===mi.rows.length-1)return;const tail=mi.rows.slice(k+1),have=new Set(ma.rows.slice(1).map(n));
  if(tail.some(r=>isNaN(n(r))||have.has(n(r)))||!have.has(Math.min(...tail.map(n))-1))return;
  mi.rows=mi.rows.slice(0,k+1);ma.rows=[ma.rows[0],...[...ma.rows.slice(1),...tail].sort((a,b)=>n(a)-n(b))]})();
// Miasma-Touched Humans skips 29 in The Ref itself (26–28 Cultist (Power 7), then 30–32). The owner gave 29 to its neighbour
// (2026-11-17): 26–29 Cultist (Power 7). Only while the gap is exactly there.
(()=>{const t=TB['miasma-touched-humans'],i=t?t.rows.findIndex(r=>r[0]==='26-28'):-1;if(i>0&&/^30-/.test(t.rows[i+1]?.[0]||''))t.rows[i]=['26-29',t.rows[i][1]]})();
// Stat blocks as data.js was generated (QA/2026-11-16-statblocks.md; tools/monsters.py and build_data.py are fixed, the data needs
// the PDFs to regenerate). Each repair runs only where the damage reads one way; once the data is regenerated none of them applies.
//  1. A wrapped Equipment/Spellbooks line pushed the attack table into the traits (22 humans): the line became an unnamed trait,
//     the table traits "Attack", "Range", "12-16", "17+" (its rows run together in the last; later rows in traits named like
//     "Corrupt (+2)"). The line rejoins its field (with a space or ", ": the one that gives names the book has), the rows → atk.
//  2. A resistance table under a trait (Alchemist's Fire Bomb: traits "≤11", "12-16", "17+" = "10 dam 5 dam 0 dam") → tr[i][2].
//  3. "Melee 1/Ranged 5" + "3 dam" came out as one number ("Ranged 53", t2 "dam 5 dam"): split where one split only gives a range
//     and a tier-2 damage (no leading zero, 1 ≤ tier 2 ≤ tier 3, range ≤ 50, the weapon's own range when it is an item).
//  4. "2 P dam 4 P dam" in t2 with t3 empty → t2, t3.
//  5. A trait whose text ends with its RR table ("… Agility RR. 1 15 dam 2 7 dam 3 No effect") → tr[i][2], if it splits one way
//     into three parts that each start like a tier's text.
// SB_FIX: id → what was rebuilt (tests, QA). SB_CHECK: id → what the data can't tell (the stat block shows a missing range).
//  6. Ranges the extractor dropped because the book writes them another way ("Range 10", "Range Unlimited", "3 Cube w 10"),
//     copied from The Ref for Playtest 3 (checked against the PDF, 2026-11-17). The book's own wording is kept.
// SB_BOOK: what reads oddly but is printed so in The Ref (the name's Power differs from the block's in six human stat blocks).
const SB_FIX={},SB_CHECK={},SB_BOOK={};
const BOOK_RANGE={'elementalist-power-10/Erupt':'3 Cube w 10','angel-e/Melt Beam':'Range Unlimited','demon-f/Hurl Dark':'Range 10','ring-collector/Kneel':'Range 10'};
const BOOK_PRINTED={'cultist-power-4':'3','cultist-power-7':'6','cultist-power-10':'6','elementalist-power-7':'6','illusionist-power-5':'2','thief-power-9':'6'};
(()=>{const low=s=>s.toLowerCase().replace(/\s*\(\d+\)$/,'').trim(),idOf=s=>s.toLowerCase().replace(/\*/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const SPELL=new Set(D.items.filter(i=>i.cat==='spellbook').map(i=>low(i.name.replace(/ Book$/,'')))),GEAR=new Set(D.items.filter(i=>i.cat!=='spellbook').map(i=>low(i.name)));
  const DAM='\\d+ (?:[A-Z] )?dam\\**',HDR=['Attack','Range','12-16','17+'],note=(o,id,s)=>(o[id]||=[]).push(s);
  const ROW=new RegExp(`\\s*([^()]+?)\\s*\\(([+-]\\d+)\\)(\\**)\\s*((?:Melee|Ranged) \\d+(?:\\/Ranged \\d+)?(?: \\(\\d+ tar(?:gets)?\\))?)\\s+(${DAM})\\s+(${DAM})\\s*`,'y');
  const rows=s=>{const out=[];let m;ROW.lastIndex=0;while(ROW.lastIndex<s.length&&(m=ROW.exec(s)))out.push({name:m[1]+m[3],bonus:m[2],range:m[4],t2:m[5],t3:m[6]});
    return ROW.lastIndex===s.length||!s.trim()?out:null};
  const join=(base,cont,known)=>{if(base.split('(').length>base.split(')').length)return base+' '+cont; // inside "(4; Historical …"
    const a=base.split(/,\s*/).pop(),b=cont.split(/,\s*/)[0],word=known.has(low(a+' '+b)),list=known.has(low(a))&&known.has(low(b));
    return word===list?null:base+(word?' ':', ')+cont};
  const part=s=>/^[A-Z0-9]/.test(s)&&!/^(?:[A-Z] )?dam\b/.test(s); // a tier's text starts like one: "The…", "Slide 4", "15 dam" — not "dam", "P dam."
  const rrSplit=t=>{const m=t.match(/^(.*\bRR\b\.?)\s+1\s+(.+)$/s);if(!m)return null;const s=m[2],sol=[];
    for(let i=s.indexOf(' 2 ');i>=0;i=s.indexOf(' 2 ',i+1)){const l=s.slice(0,i),r=s.slice(i+3);
      for(let j=r.indexOf(' 3 ');j>=0;j=r.indexOf(' 3 ',j+1)){const x=r.slice(0,j),y=r.slice(j+3);if([l,x,y].every(part))sol.push([l,x,y])}}
    return sol.length===1?[m[1],sol[0]]:null};
  for(const m of D.monsters){const id=m.id,tr=m.tr;
    // 1
    const k=tr.findIndex(t=>t[0]==='Attack'&&!t[1]);
    if(!m.atk.length&&k>=0&&HDR.every((h,i)=>tr[k+i]&&tr[k+i][0]===h&&(i===3||!tr[k+i][1]))){
      let s=tr[k+3][1],e=k+4;while(tr[e]&&/^[^()]+\([+-]\d+\)\**$/.test(tr[e][0])){s+=' '+tr[e][0]+' '+tr[e][1];e++}
      const atk=rows(s),wrap=k===1&&!tr[0][0]?tr[0][1]:null,fields=['Equipment','Spells','Spellbooks'].filter(f=>m.st[f]);
      const field=wrap!=null&&fields.length===1?fields[0]:null,joined=field&&join(m.st[field],wrap,field==='Equipment'?GEAR:SPELL);
      if(atk&&atk.length&&(k===0||joined)){if(joined){note(SB_FIX,id,`${field}: “${m.st[field]}” + “${wrap}”`);m.st[field]=joined}
        m.atk=atk;tr.splice(0,e);atk.forEach(a=>note(SB_FIX,id,`attack ${a.name} ${a.bonus}, ${a.range}, 12–16 ${a.t2}, 17+ ${a.t3}`))}
      else note(SB_CHECK,id,`the attack table came out as text (“${s.trim()}”)${wrap!=null?` after a wrapped line (“${wrap}”)`:''}; not rebuilt`)}
    // 2
    for(let i=1;i+2<tr.length;i++){const [h1,h2,h3]=tr.slice(i,i+3);
      if(h1[0]==='≤11'&&!h1[1]&&h2[0]==='12-16'&&!h2[1]&&h3[0]==='17+'){const v=h3[1].match(new RegExp(`^(${DAM}|No effect) (${DAM}|No effect) (${DAM}|No effect)$`));
        if(v&&tr[i-1][0]&&!tr[i-1][2]){tr[i-1][2]=v.slice(1,4);tr.splice(i,3);note(SB_FIX,id,`${tr[i-1][0]}: RR ≤11 ${v[1]} / 12–16 ${v[2]} / 17+ ${v[3]}`)}}}
    // 3, 4
    for(const a of m.atk){
      const j=a.bonus&&!a.t3&&a.range.match(/^(.*(?:Melee|Ranged) )(\d{2,})$/),t=j&&a.t2.match(new RegExp(`^((?:[A-Z] )?dam\\**) (${DAM})$`));
      if(t){const hi=parseInt(t[2]),c=[],w=IT[idOf(a.name)],wr=w&&w.range&&w.range.match(/(\d+)$/);
        for(let i=1;i<j[2].length;i++){const r=j[2].slice(0,i),x=j[2].slice(i);if(!/^0/.test(r)&&!/^0/.test(x)&&+x>=1&&+x<=hi&&+r<=50)c.push([r,x])}
        const pick=wr?c.filter(([r])=>r===wr[1]):c;
        if(pick.length===1){const was=`${a.range} ${a.t2}`;a.range=j[1]+pick[0][0];a.t2=`${pick[0][1]} ${t[1]}`;a.t3=t[2];note(SB_FIX,id,`${a.name}: “${was}” → ${a.range}, 12–16 ${a.t2}, 17+ ${a.t3}`)}
        else note(SB_CHECK,id,`${a.name}: “${a.range} ${a.t2}”: the range and the 12–16 damage ran together and split more than one way`)}
      const p=a.bonus&&!a.t3&&a.t2.match(new RegExp(`^(${DAM}) (${DAM})$`));
      if(p){a.t2=p[1];a.t3=p[2];note(SB_FIX,id,`${a.name}: “${p[0]}” → 12–16 ${a.t2}, 17+ ${a.t3}`)}
      const br=BOOK_RANGE[id+'/'+a.name];if(a.bonus&&!a.range&&br){a.range=br;note(SB_FIX,id,`${a.name}: range “${br}” (The Ref)`)}
      if(a.bonus&&!a.range)note(SB_CHECK,id,`${a.name}: no range in the data`)}
    // 5
    for(const t of tr)if(!t[2]){const r=rrSplit(t[1]);if(r){t[1]=r[0];t[2]=r[1]}}
    const pw=m.name.match(/\(Power (\d+)\)/);if(pw&&pw[1]!==m.st.Power)note(BOOK_PRINTED[id]===m.st.Power?SB_BOOK:SB_CHECK,id,`the name says Power ${pw[1]}, the block Power ${m.st.Power}`);
    if(!m.atk.length&&!SB_CHECK[id])note(SB_CHECK,id,'no attacks in the data')}})();

/* ================= helpers ================= */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// No "…" on a control (owner, 2026-11-21; QA/2026-11-21-ellipsis.md). A control that opens something with its own content — a dialog
// with a form or choices, a list, a picker, a panel, a file picker — ends in this small chevron: nest('New campaign'). One that only
// asks "Are you sure?" (Delete, End session, Remove the map) says its plain verb. h is HTML: escape user text before passing it.
const NEST_SVG='<svg class="nest-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 5.5 15.5 12 9 18.5"/></svg>';
const nest=h=>`<span class="nest">${h}${NEST_SVG}</span>`;
// Saved encounter caches are untrusted HTML. Keep only our small presentation
// vocabulary and reconstruct monster links/actions from validated catalog IDs.
function safeGameHTML(value,monsters=false){const template=document.createElement('template');template.innerHTML=String(value??'');
  const walk=node=>{if(node.nodeType===3)return esc(node.nodeValue);if(node.nodeType!==1)return '';const body=[...node.childNodes].map(walk).join(''),tag=node.tagName.toLowerCase();
    if(['b','strong','em','i'].includes(tag))return `<${tag}>${body}</${tag}>`;if(tag==='br')return '<br>';
    const id=node.getAttribute('data-id'),action=node.getAttribute('data-action');
    if(monsters&&id&&MON[id]&&tag==='a'&&action==='open-mon')return `<a href="#mon/${esc(id)}" data-action="open-mon" data-id="${esc(id)}">${body}</a>`;
    const n=Number(node.getAttribute('data-n'));if(monsters&&id&&MON[id]&&tag==='button'&&action==='fight'&&Number.isInteger(n)&&n>0&&n<=100)return `<button class="btn sm" data-action="fight" data-id="${esc(id)}" data-n="${n}">${body}</button>`;
    return body};return [...template.content.childNodes].map(walk).join('')}
const d=n=>1+Math.floor(Math.random()*n);
const fmt=n=>(n>=0?'+':'−')+Math.abs(n);
const gc=n=>n==null?'Ref sets value':n.toLocaleString('en')+' gc';
const rich=s=>String(s??'').replace(/\[\[([\w-]+)\|([^\]]+)\]\]/g,(m,k,l)=>`<a class="term" href="#rule/${k}" data-term="${k}">${l}</a>`);
// Every number field becomes [−] value [+] wherever it is drawn (pages and dialogs); the value stays typeable.
function stepperize(){for(const i of document.querySelectorAll('input[type=number]:not(.stp-in)')){i.classList.add('stp-in');i.style.width='';const w=document.createElement('span');w.className='numstep';i.replaceWith(w);
  w.innerHTML=`<button type="button" class="stp" data-step="-1" aria-label="Decrease">−</button><button type="button" class="stp" data-step="1" aria-label="Increase">+</button>`;w.insertBefore(i,w.lastChild)}}
new MutationObserver(stepperize).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',e=>{const b=e.target.closest('.stp');if(!b)return;const i=b.parentNode.querySelector('input'),lo=i.min===''?-Infinity:+i.min,hi=i.max===''?Infinity:+i.max;
  i.value=Math.min(hi,Math.max(lo,(+i.value||0)+b.dataset.step*(+i.dataset.inc||1)));i.dispatchEvent(new Event('change',{bubbles:true}))});
function toast(t){const e=$('#toast');e.innerHTML=`<span class="tmsg">${esc(t)}</span>`;e.classList.add('on');toastRoom(e);clearTimeout(toast.t);toast.t=setTimeout(()=>toastOff(e),2800)}
// A toast never sits on something that can be tapped (owner, 2026-11-17: Undo covered “Remove … from the tracker”). While it
// shows, body.toasting and --toasth (the band from the screen's bottom edge to just above the toast) let the page, the side
// panel, the inventory and the combat's creature panel keep their last controls above it (play.css).
// Over the combat's docked creature panel the toast takes a band at the top of the dock itself (the dock grows by it), so it
// covers neither the dock's buttons nor the page above it.
// The room stays when the toast goes, until the next render: taking it away at once moved the page (or the dock) under a
// pointer about to tap, so a tap landed on the wrong control.
// The Inventory keeps room at its end for the round button (6rem, sheet.css) only when its content scrolls anyway: content that fits
// gets no scroll for an empty band (owner, 2026-11-24). Re-checked when the content or the window changes size.
const INV_RO=typeof ResizeObserver==='function'?new ResizeObserver(()=>invRoom()):null;
function invRoom(){const b=$('#invov .invov-b'),c=b?.firstElementChild;if(!c)return;
  b.classList.toggle('fits',c.getBoundingClientRect().height+parseFloat(getComputedStyle(b).paddingTop)<=b.clientHeight+.5);
  if(INV_RO&&INV_RO.el!==c){INV_RO.disconnect();INV_RO.observe(b,{box:'border-box'});INV_RO.observe(c);INV_RO.el=c}}
// The same for the page: the room under it for the round button only when the page scrolls anyway (sheet.css body.fab-fits)
const PAGE_RO=typeof ResizeObserver==='function'?new ResizeObserver(()=>pageRoom()):null;
function pageRoom(){const b=document.body,m=$('#main');if(!m)return;if(!b.classList.contains('has-fab')){b.classList.remove('fab-fits');return}
  // measured on the taller page (a shorter one, even for a moment, would clamp the scroll): its height less the room, plus the end a fitting page has
  const was=b.classList.contains('fab-fits');b.classList.remove('fab-fits');const full=parseFloat(getComputedStyle(m).paddingBottom),h=document.documentElement.scrollHeight;
  b.classList.add('fab-fits');const fit=h-full+parseFloat(getComputedStyle(m).paddingBottom)<=innerHeight;if(!fit)b.classList.remove('fab-fits');
  if(PAGE_RO&&!PAGE_RO.on){PAGE_RO.observe(m);PAGE_RO.on=true}return was!==fit}
function toastRoom(e){const on=e.classList.contains('on'),R=document.documentElement.style,dock=document.body.classList.contains('docked')&&typeof dockMark==='function';
  document.body.classList.toggle('toasting',on);if(dock)dockMark();R.setProperty('--toastbox',on?Math.ceil(e.offsetHeight+12)+'px':'0px');if(dock)dockMark();
  R.setProperty('--toasth',on?Math.ceil(e.offsetHeight+(parseFloat(getComputedStyle(e).bottom)||0)+8)+'px':'0px')}
function toastOff(e){e.classList.remove('on');toastOff.later=true}
const toastRoomDone=()=>{if(!toastOff.later)return;toastOff.later=false;const e=$('#toast');if(e&&!e.classList.contains('on'))toastRoom(e)};
// ponytail: localStorage is this device's cache; sync.js shares the game state at the table.
// campKey (campaign.js): a player on a device that keeps the Ref's campaigns has a world of its own (ctk-p-*). campLocked: a switch is
// reloading the page. campVoid: no campaign is open on the Ref's device, so its world stays in memory.
const mem={};const store={get:k=>{if(campVoid(k))return mem[k];try{return localStorage.getItem(campKey(k))??mem[k]}catch{return mem[k]}},set:(k,v)=>{if(campLocked(k))return;mem[k]=v;if(campVoid(k))return;try{localStorage.setItem(campKey(k),v)}catch{}}};

// Auto-link rule words inside card text so nobody has to search for them (first hit of each).
const AUTO=[[/\bManeuver\b/,'maneuver'],[/\b(?:Agility|Mind|Strength|M|A|S)? ?RR\b/,'rr'],[/\bDTs?\b|\bdungeon turns?\b/,'dt'],[/\bUD\b/,'ud'],[/\bwounds?\b/,'wounds'],[/\bStamina\b/,'stamina'],[/\bprone\b/,'c-prone'],[/\bgrabbed\b/,'c-grabbed'],[/\bweakened\b/,'c-weakened'],[/\bvulnerable\b/,'c-vulnerable'],[/\bblessed\b/,'c-blessed'],[/\bLight \d+\/\d+/,'light'],[/\bbane\b/,'bane'],[/\bedge\b/,'edge'],[/\brest\b/,'rest'],[/\bP dam\b/,'piercing'],[/\bcrafting rolls?\b/,'crafting'],
  [/\b[Oo]pportunity attacks?\b/,'r-opportunity-attack'],[/\bcounter\b/,'r-counter'],[/\breach\b/,'r-reach'],[/\bactions?\b/,'r-actions'],[/\bcrits?\b/,'r-crits-and-dooms'],[/\bdooms?\b/,'r-crits-and-dooms'],[/\b[Pp]ush \d+\b/,'r-forced-movement'],[/\bdifficult terrain\b/,'r-difficult-terrain'],[/\bline of effect\b/,'r-line-of-effect'],[/\bcover\b/,'r-cover'],[/\btests?\b/,'r-making-a-test'],[/\bsurprised\b/,'r-surprised'],[/\bsquares?\b/,'r-grid-and-distance']];
function linkify(t){
  let s=esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
  for(const [re,k] of AUTO){let done=false;s=s.replace(new RegExp(re.source,'g'),(m,off,all)=>{if(done)return m;const before=all.slice(0,off);if(/<[^>]*$/.test(before)||/<a [^>]*>[^<]*$/.test(before))return m;done=true;return `<a class="term" href="#rule/${k}" data-term="${k}">${m}</a>`})}
  return s;
}
const QK={light:'q-light',disengage:'q-disengage',parry:'q-parry',pummeling:'q-pummeling',dismember:'q-dismember',brutal:'q-brutal',cumbersome:'q-cumbersome',slashing:'slashing',bashing:'bashing',chopping:'chopping',stabbing:'stabbing',bow:'bow',reload:'q-reload',heavy:'q-heavy'};
const quals=(q,it)=>esc(q||'').split(/,\s*/).map(w=>{const m=w.match(/^Enchantment: (.+)/),e=m&&enchOf(m[1],enchKind(it)||'w');if(e)return `<a class="term" href="#rule/${e.rule}" data-term="en-${e.kind}-${e.n}">${w}</a>`;const k=QK[w.toLowerCase().split(' ')[0]];return k?`<a class="term" href="#rule/${k}" data-term="${k}">${w}</a>`:w}).join(', ');

/* ================= tiers (Forge Steel-style power roll) ================= */
const TIERS=[['≤11',1],['12–16',2],['17+',3]];
function diceFor(t,mod){const lo=[2,12-mod,17-mod][t-1],hi=[11-mod,16-mod,20][t-1];const a=Math.max(2,lo),b=Math.min(20,hi);if(t===1)return b<2?'never (only a doom)':`dice ${b<=2?'2':'2–'+b}`;if(a>20)return 'only on a crit';return t===3?`dice ${a>=20?'20':a+'+'}`:`dice ${a}–${b}`}
// rows: [[tierNo, text]], o: {head, sub, mod, on}
function prHTML(rows,o={}){
  return `<div class="pr"><div class="h">${o.head||'Test'}${o.sub?`<span class="muted">${o.sub}</span>`:''}</div>${rows.map(([t,x])=>`<div class="r ${o.on===t?'on':o.on?'dim':''}"><div class="t">${TIERS[t-1][0]}</div><div class="x">${x}${o.mod!=null?`<span class="dice">${diceFor(t,o.mod)}</span>`:''}</div></div>`).join('')}</div>`;
}
const tierNoOfHdr=h=>h.startsWith('≤')?1:h.startsWith('12')?2:3;
function tierOfTotal(total){return total<=11?1:total<=16?2:3}

/* ================= character & state ================= */
// Random start so cards and pool entries made on different devices at the table never share a uid.
let UID=1+Math.floor(Math.random()*2**40);
const inst=(id,sec,idx,x={})=>{const it=IT[id];return Object.assign({uid:UID++,id,sec,idx,count:1,ud:it&&it.ud?it.ud[0]:undefined},Object.fromEntries(Object.entries(x).filter(e=>e[1]!==undefined)))}; // {ud:undefined} from the pool keeps the item's usage die
function mkChar(o){return Object.assign({id:'c'+Date.now().toString(36)+d(1e6),txp:0,xpSpent:0,stBase:7,stamina:null,effort:null,cruelty:0,cond:new Set(),miasma:[],wounds:new Set(),inv:[],exp:{gen:[],wpn:[],mag:[]},traits:[],ch:{A:0,M:0,S:0}},o)}
let ME=null;
const PARTY=[];
const LVL=TB['character-level'].rows.slice(1).map(r=>({lv:parseInt(r[0]),min:+r[1].replace(/,/g,'').match(/\d+/)[0],eff:+r[2],ch:r[3]==='Yes'}));
const {level,stMax,effMax}=CrowsRules.createLevels(LVL);
PARTY.forEach(c=>{c.stamina??=stMax(c);c.effort??=effMax(c)});
// Crows are cached on this device; at a shared table (sync.js) the host's copy wins.
const reviveCrow=c=>Object.assign(mkChar({}),c,{cond:new Set(c.cond),wounds:new Set(c.wounds),pets:(c.pets||[]).map(p=>Object.assign(p,{len:p.len||{pack:parseInt(MON[p.mon]?.st.Slots)||0}})),hires:(c.hires||[]).map(h=>Object.assign({wounds:[],inv:[]},h,{len:h.len||{pack:parseInt(MON[h.mon]?.st.Slots)||0}}))});
try{let saved=JSON.parse(store.get('crows')||'null');const DEMO=['Bram Hollow|Village Watch','Wren|Thief','Sister Ada|Acolyte of the Healer','Osk|Archer'];if(saved&&!store.get('demoGone')){saved=saved.filter(c=>!DEMO.includes(c.name+'|'+c.bg));store.set('demoGone','1')}if(saved){PARTY.splice(0,PARTY.length,...saved.map(reviveCrow));UID=Math.max(UID,...PARTY.flatMap(c=>c.inv.map(i=>i.uid+1)))}}catch{}
const saveCrows=()=>store.set('crows',JSON.stringify(PARTY,(k,v)=>v instanceof Set?[...v]:v));
// Effort above the maximum is a separate bonus (Good Night's Rest), so the sheet never shows 3 / 2.
PARTY.forEach(c=>{if(c.effort>effMax(c)){c.effortBonus=(c.effortBonus||0)+c.effort-effMax(c);c.effort=effMax(c)}});
ME=PARTY[+store.get('crow')||0]||PARTY[0];

const S={area:store.get('area')||'home',tab:{crow:null,session:null},b:null,lib:{cat:'items',q:'',pick:null},
  village:{prosperity:0},
  dt:{n:1,running:false,left:30*60,len:30,dungeon:'undead',crowded:false,chaos:false,end:null,fight:'',held:false,encs:[]},
  pool:[],
  combat:[], placing:null, pendingWounds:0,
  travel:{pace:'normal',role:'Scout',task:null,tier:null},
  rtravel:{day:1,pace:'normal',mods:{},checks:[],restChecks:[],lost:false,camp:null},
  journey:JourneyRules.defaultJourney(), // the travel day as one flow (journey-rules.js); the Ref's device shares what players may see
  mi:{last:null},rest:{act:null,pick:null,wounds:null,where:null,ration:true,part:'angel-part',size:1,plus:false,log:null,hv:null,cr:[]},test:null,
  rmi:{}, sell:{sel:{},greed:{},val:{},to:{},ar:{}},
  lookup:{q:'',kw:false,pick:null,find:false}, fold:{}, // fold: which folded sections (<details data-fold>) are open on this device; view state, never shared
  mon:{q:'',fam:'',pick:'angel-a'}, tbl:{q:'',pick:'travel-encounters',roll:null,mod:0},
};
const LEN={hand:2,magic:3,belt:4,pack:10};
const SEC_NAME={hand:'Hand',magic:'Magic slot',belt:'Belt',pack:'Backpack'};

/* ================= inventory rules ================= */
const {isCumb,sizeIn,lenOf,occ,wearable,canPlace}=CrowsRules.createRules(IT);
// Dead: a wound in all 10 backpack slots (Rules: Wounds). Nothing in the app brings it back: no rest, no XP share; the player
// makes a new crow (the builder's “Replacing a dead crow?” note). Lost to the Miasma (13+) is not death: the crow becomes the
// Ref's NPC and can still rest (Miasma Effects 13+), so it is left as it was.
const crowDead=c=>!!c&&c.wounds.size>=10;
const deadNote=c=>`<div class="banner bad" role="status"><span class="msg"><b>${esc(c.name)} is dead.</b> A wound in every backpack slot. No rest brings them back — make a new crow from Crows.</span></div>`;
function speed(c){const o=occ(c,'pack');let p=0;for(const w of c.wounds)if(o[w])p++;const base=Math.max(0,5-p);return c.cond.has('grabbed')||c.cond.has('unconscious')?0:c.cond.has('prone')?Math.floor(base/2):base}
const speedWhy=c=>c.cond.has('unconscious')?'unconscious':c.cond.has('grabbed')?'grabbed':c.cond.has('prone')?'prone: halved':speed(c)<5?`−${5-speed(c)} from wounds`:'squares per move';
const armorOf=c=>c.inv.find(i=>i.worn);
const isShield=it=>it.cat==='armor'&&/Shield$/.test(it.name);
// Parry X: a wielded weapon absorbs damage like a shield; Swordplay adds Strength to slashing weapons' Parry
const parryOf=(c,it)=>{const x=+((it.q||'').match(/Parry (\d+)/)||[])[1]||0;return x&&c.traits.some(t=>t.n==='Swordplay')&&it.wtype==='Slashing'?x+c.ch.S:x};
const adBase=(c,i)=>{const it=IT[i.id];return it.cat==='armor'?it.ad:parryOf(c,it)};
const adOf=(c,i)=>i.ad??adBase(c,i);
const adSources=c=>{const h=c.inv.filter(i=>i.sec==='hand'&&!i.unid);return [...h.filter(i=>isShield(IT[i.id])),armorOf(c),...h.filter(i=>!isShield(IT[i.id])&&parryOf(c,IT[i.id]))].filter(Boolean)};
function adNow(c){return adSources(c).reduce((a,i)=>a+adOf(c,i),0)}
function adMax(c){return adSources(c).reduce((a,i)=>a+adBase(c,i),0)}
const lightOf=c=>c.inv.find(i=>i.lit);
// A purse placed from the loot pool may have no coins field yet (older saves too): read it as 0.
const isPurse=i=>i.id.includes('coin-purse');
const purses=c=>c.inv.filter(isPurse);
const purse=c=>purses(c)[0];
const purseMax=p=>p?({'coin-purse':500,'fine-coin-purse':750,'masterwork-coin-purse':1000}[p.id]||500):0;
const purseRoom=c=>purses(c).reduce((a,p)=>a+purseMax(p)-(p.coins||0),0);
// Fills every purse in turn; returns the gc that did not fit.
function addCoins(c,n,ps=purses(c)){for(const p of ps){const k=Math.min(n,purseMax(p)-(p.coins||0));if(k>0){p.coins=(p.coins||0)+k;n-=k}}return n}

/* ================= unidentified magic items ================= */
// The real item stays in i.id (slots, stack, wearable are physical facts); only what the player reads is hidden.
const isMagic=it=>!!it&&(it.cat==='magic'||!!it.magic);
const KIND=[['ring','a ring'],['wand','a wand'],['potion','a potion'],['belt','a belt'],['crown','a crown'],['glove','gloves'],['gauntlet','gauntlets'],['boot','boots'],['poulaine','shoes'],['mask','a mask'],['necklace','a necklace'],['amulet','an amulet'],['cloak','a cloak'],['hat','a hat'],['key','a key'],['bag','a bag'],['box','a box'],['trap','a trap'],['branch','a branch'],['staff','a staff'],['monocle','a monocle'],['eye','an eye'],['medallion','a medallion'],['stone','a stone'],['cottage','a tiny house'],['book','a book'],['orb','an orb'],['whistle','a whistle'],['teeth','a string of teeth']];
function kindOf(r){const n=r.name.toLowerCase();const k=KIND.find(([w])=>new RegExp('\\b'+w).test(n));return k?k[1]:r.cat==='weapon'?'a weapon':r.cat==='armor'?'armor':'something'}
function shown(x){const r=IT[x.id];if(!x.unid)return x.topic?Object.assign({},r,{name:`${r.name} (${x.topic})`}):r;const base=IT[/ring\b/i.test(r.name)?'magic-ring':/wand\b/i.test(r.name)?'magic-wand':/potion/i.test(r.name)?'potion':'unidentified-item'];
  return Object.assign({},base,{id:r.id,slots:r.slots,stack:r.stack,wear:r.wear||base.wear,looks:kindOf(r),price:null,ud:null,light:null,tiers:null,q:null,attack:null,range:null,ad:null,craft:null,upg:null,real:r})}
const nm=x=>shown(x).name;

/* ================= card component ================= */
const CATL={weapon:'Weapon',armor:'Armor',spellbook:'Spellbook',magic:'Magic item',alchemy:'Alchemy',gear:'Gear',treasure:'Treasure',material:'Crafting material',ammo:'Ammunition',unidentified:'Unidentified'};
function tierGrid(t){return `<div class="tt" style="grid-template-columns:repeat(${t.h.length},1fr)">${t.h.map(h=>`<div class="th">${esc(h.replace('-','–'))}</div>`).join('')}${t.v.map(v=>`<div>${linkify(v)}</div>`).join('')}</div>`}
function cardHTML(it,i,o={}){
  const n=i?i.count:o.n||1, lines=[];
  if(it.range||it.attack)lines.push(`<div class="ln">${esc(it.range||'')}${it.attack?` · <b>Attack</b> ${esc(it.attack)}`:''}${it.target?` · <b>Target</b> ${esc(it.target)}`:''}</div>`);
  if(it.school)lines.push(`<div class="ln"><b>Rank ${it.rank??'?'}</b> · ${esc(it.school)}</div>`);
  if(it.ad)lines.push(`<div class="ln"><b>AD</b> ${i&&i.ad!=null?`${i.ad} / ${it.ad}`:it.ad}${i&&i.worn?' · <b>worn</b>':''}</div>`);
  if(it.tiers)lines.push(tierGrid(it.tiers));
  if(it.q)lines.push(`<div class="q">${quals(it.q,it)}</div>`);
  if(it.looks)lines.push(`<div class="ln"><b>Looks like</b> ${esc(it.looks)} — it hums with magic. <a class="term" href="#rule/r-iding-magic-items" data-term="r-iding-magic-items">Identify it</a> to learn what it does.</div>`);
  if(it.text)lines.push(`<div class="txt">${linkify(it.text)}</div>`);
  if(it.ud){const left=i?.ud??it.ud[0];lines.push(`<div class="ln"><a class="term" href="#rule/ud" data-term="ud">UD</a> <span class="pips">${Array.from({length:it.ud[0]},(_,k)=>`<button class="pip ${k<left?'':'gone'}" data-action="${i&&!o.ro?'ud':''}" data-uid="${i?.uid||''}" aria-label="${k<left?'Remove a usage die (rolled 1–2)':'Restore a usage die'}" ${i&&!o.ro?'':'tabindex="-1"'}></button>`).join('')}</span> <span class="small">${esc(it.ud[1])}</span></div>`)}
  if(i&&isPurse(i))lines.push(`<div class="ln"><b>${i.coins||0} gc</b> inside (max ${purseMax(i)})</div>`);
  const acts=[];
  if(i&&!o.ro){
    if(it.light&&i.sec==='hand')acts.push(`<button data-action="light" data-uid="${i.uid}" aria-pressed="${!!i.lit}">${i.lit?'Lit — douse':'Light it'}</button>`);
    if(it.cat==='armor'&&!isShield(it)&&i.sec==='pack')acts.push(`<button data-action="wear" data-uid="${i.uid}" aria-pressed="${!!i.worn}">${i.worn?'Worn':'Wear'}</button>`);
    if(it.stack>1&&!i.unid)acts.push(`<button data-action="cnt" data-d="-1" data-uid="${i.uid}" aria-label="Use one">${/Ration|Feed/.test(it.name)?'Eat 1':'Use 1'}</button><button data-action="cnt" data-d="1" data-uid="${i.uid}" aria-label="Add one">+1</button>`);
    if(isPurse(i))acts.push(`<button data-action="coins" data-uid="${i.uid}">${nest('Coins')}</button>`);
    if(i.id==='gold-coins'&&ME?.inv.includes(i)&&purseRoom(ME)>0)acts.push(`<button data-action="pour" data-uid="${i.uid}">Into purse</button>`);
    if(i.unid)acts.push(`<button data-action="id-study" data-uid="${i.uid}" ${i.tried?'disabled':''}>${i.tried?'Studied':'Study'}</button><button data-action="id-use" data-uid="${i.uid}">Use it</button>`);
  }
  return `<article class="card c-${it.cat} ${o.full?'full':''} ${i?.lit?'lit':''} ${i&&S.moving===i.uid?'moving':''}" ${i?`data-uid="${i.uid}"`:''} ${i&&!o.ro?`tabindex="0" aria-label="${esc(it.name)}: press Enter to move"`:''} data-id="${it.id}">
    ${n>1?`<span class="badge">×${n}</span>`:''}
    ${o.info!==false?`<button class="info" data-action="${i?'open-inst':'open-item'}" data-uid="${i?.uid||''}" data-id="${it.id}" aria-label="Details for ${esc(it.name)}">i</button>`:''}
    <div class="catl">${CATL[it.cat]||''}${it.wtype?' · '+esc(it.wtype):''}${it.wear?' · wearable':''}</div>
    <div class="nm">${esc(it.name)}</div>
    <div class="meta"><span><a class="term" href="#rule/stack" data-term="stack">Stack</a> ${it.stack||1}</span><span>${it.slots||1} <a class="term" href="#rule/slots" data-term="slots">slot${(it.slots||1)>1?'s':''}</a>${isCumb(it)?' · 2 hands':''}</span></div>
    ${lines.join('')}
    ${acts.length?`<div class="acts">${acts.join('')}</div>`:''}
    ${i?.extra?`<div class="ln small"><b>${esc(i.extra)}</b></div>`:''}<div class="price"><span>${i&&!i.unid&&refPriced(i)&&valWords(i,1)||gc(it.price)}${n>1&&it.price?' each':''}</span>${n>1?`<span>${n} / ${it.stack}</span>`:''}</div>
  </article>`;
}
const usedIn=id=>{const it=IT[id];const words=it.name.toLowerCase().replace(/^crafting material, /,'').split(' ').filter(w=>w.length>2);return D.items.filter(x=>x.craft&&(x.craft.mats.toLowerCase().includes(it.name.toLowerCase())||(it.cat==='material'&&words.every(w=>x.craft.mats.toLowerCase().includes(w.replace(/s$/,''))))))};

/* ================= search ================= */
function searchItems(q,kw){
  q=q.trim().toLowerCase();if(!q)return [];
  const name=[],made=[],text=[];
  for(const it of D.items){if(it.base)continue;
    const n=it.name.toLowerCase();let s=n===q?100:n.startsWith(q)?80:n.split(/[\s,]+/).some(w=>w.startsWith(q))?60:n.includes(q)?40:0;
    if(s){name.push([s,it]);continue}
    if(!kw)continue;
    if(it.craft&&it.craft.mats.toLowerCase().includes(q))made.push([0,it,`made from ${it.craft.mats}`]);
    else if((it.text+' '+(it.q||'')).toLowerCase().includes(q))text.push([0,it,'in card text']);
  }
  name.sort((a,b)=>b[0]-a[0]||a[1].name.localeCompare(b[1].name));
  return [['Card names',name.slice(0,30)],['Crafted from it',made],['Mentioned in card text',text.slice(0,30)]].filter(g=>g[1].length);
}
const hl=(s,q)=>{const i=s.toLowerCase().indexOf(q.toLowerCase());return !q||i<0?esc(s):esc(s.slice(0,i))+'<mark>'+esc(s.slice(i,i+q.length))+'</mark>'+esc(s.slice(i+q.length))};
// ARIA combobox: results show while typing; arrows + Enter pick.
function mountSearch(root,{onPick,kw=()=>false,onInput,value=''}){
  root.innerHTML=`<div class="combo"><input type="search" role="combobox" aria-expanded="false" aria-controls="${root.id}-lb" aria-autocomplete="list" placeholder="Type a card name…" value="${esc(value)}"><ul class="lb" id="${root.id}-lb" role="listbox"></ul></div>`;
  const inp=$('input',root),lb=$('ul',root);let opts=[],act=-1;
  const draw=()=>{const q=inp.value;const g=searchItems(q,kw());opts=[];
    lb.innerHTML=g.map(([h,arr])=>`<li class="gh" role="presentation">${h}</li>`+arr.map(([s,it,why])=>{opts.push(it);return `<li role="option" id="${root.id}-o${opts.length-1}" data-i="${opts.length-1}"><span>${hl(it.name,q)}</span><small>${why?esc(why):`${it.slots||1} slot · stack ${it.stack||1}`}</small></li>`}).join('')).join('')+(q&&!opts.length?'<li class="gh">No card with that name. Try “Search all keywords”.</li>':'');
    act=opts.length?0:-1;mark();inp.setAttribute('aria-expanded',opts.length?'true':'false');onInput&&onInput(q)};
  const mark=()=>{$$('[role=option]',lb).forEach(li=>li.setAttribute('aria-selected',+li.dataset.i===act));if(act>=0){inp.setAttribute('aria-activedescendant',`${root.id}-o${act}`);$(`#${root.id}-o${act}`)?.scrollIntoView({block:'nearest'})}};
  inp.addEventListener('input',draw);
  inp.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){act=Math.min(opts.length-1,act+1);mark();e.preventDefault()}else if(e.key==='ArrowUp'){act=Math.max(0,act-1);mark();e.preventDefault()}else if(e.key==='Enter'&&act>=0){onPick(opts[act]);e.preventDefault()}});
  lb.addEventListener('click',e=>{const li=e.target.closest('[role=option]');if(li)onPick(opts[+li.dataset.i])});
  root.redraw=draw;if(value)draw();return inp;
}

/* ================= shell ================= */
const TABS={crow:[['sheet','Sheet'],['inventory','Inventory'],['actions','Actions'],['traits','Traits'],['companions','Companions'],['pets','Pets'],['hirelings','Hirelings'],['map','Map'],['travel','Travel roles'],['rest','Rest'],['miasma','Miasma'],['market','Village']],
  session:[['session','Dungeon turn'],['loot','Loot'],['rtravel','Manual travel'],['rmap','Journey'],['rmiasma','Miasma'],['village','Places & XP']]};
/* ---------- phase: where the party is. It picks the tabs that matter now, the "Now" bar and the Home checklist. ---------- */
const PHASES={
  village:{n:'Village',icon:'⌂',crow:['sheet','inventory','market','rest','traits','pets','hirelings'],session:['village','loot']},
  travel:{n:'Travel',icon:'⇢',crow:['sheet','inventory','map','travel','rest','miasma'],session:['rtravel','rmap','rmiasma','loot']},
  delve:{n:'Dungeon',icon:'▣',crow:['sheet','inventory','actions','rest'],session:['session','loot','rmiasma']},
};
S.phase=store.get('phase')||'';S.role=store.get('role')||'';if(S.role==='player'&&!store.get('net'))S.phase=''; // a player off a table has no scene (owner, 2026-11-23)
S.more=false;S.crowOpen=S.area==='crow';S.back=null;
/* The game the Ref is running (clock, combat, loot pool, travel day, XP lines) is kept on the Ref's device, so a reload resumes it.
   Gameplay only: what the stage shows (focus, open pickers) stays out. A player's device takes it from the Ref's (sync.js).
   dt.fight: '' | 'on' (combat began) | 'over' (ended, the turn not resumed yet); dt.held: combat
   stopped a running clock; dt.encs: encounter-check results still waiting for the Ref. Old saves lack them: '' / false / []. */
const SESSION_GAP=10*60*1000; // closed longer than this, the table stopped playing: the clock comes back paused, not run out
let SESSION_NOTE='';
const savePend=()=>{store.set('pendw',S.pendingWounds&&ME?JSON.stringify({c:ME.id,n:S.pendingWounds,t:S.pendingWoundType||null}):'')};
function restorePend(){try{const o=JSON.parse(store.get('pendw')||'null');if(o&&ME&&o.c===ME.id&&o.n>0){S.pendingWounds=Math.min(10,o.n|0);S.pendingWoundType=o.t||null}}catch{}}
function saveSession(){if(S.role!=='ref')return;
  store.set('session',ser({v:1,t:Date.now(),dt:S.dt,combat:S.combat,pool:S.pool,rtravel:S.rtravel,xp:S.xp&&(S.xp.rows.length||S.xp.pset)?S.xp:null,ses:S.ses||null}))} // an XP table nobody touched (the Village draws one) is not saved: its players count is recomputed // ses: the table's session (session.js)
function restoreSession(){if(S.role!=='ref')return;let o=null;try{o=JSON.parse(store.get('session')||'null')}catch{}
  if(!o||o.v!==1||!o.dt||typeof o.dt.n!=='number')return;
  Object.assign(S.dt,{fight:'',held:false,encs:[]},o.dt);
  if(!['','on','over'].includes(S.dt.fight))S.dt.fight='';if(!Array.isArray(S.dt.encs))S.dt.encs=[];
  if(Array.isArray(o.combat))S.combat=o.combat.filter(x=>x&&MON[x.id]);if(Array.isArray(o.pool))S.pool=o.pool.filter(x=>x&&IT[x.id]);
  if(o.rtravel&&typeof o.rtravel==='object')Object.assign(S.rtravel,o.rtravel);if(o.xp&&Array.isArray(o.xp.rows))S.xp=o.xp;if(o.ses)S.ses=sesFix(o.ses);
  const top=Math.max(0,...S.combat.map(x=>x.uid),...S.pool.map(x=>x.uid),...S.dt.encs.map(x=>x.k||0));if(UID<=top)UID=top+1;
  const t=S.dt,gap=Math.max(0,Date.now()-(+o.t||0));
  if(t.running){if(gap>SESSION_GAP){t.running=false;SESSION_NOTE=`The page was closed for ${Math.round(gap/60000)} min: DT ${t.n} is paused at ${mmss(t.left)}.`}
    else{t.left=Math.max(0,t.left-Math.floor(gap/1000));if(!t.left){t.running=false;if(!t.end)t.end={step:1};SESSION_NOTE=`DT ${t.n} ran out while the page was reloading.`}}}}
addEventListener('pagehide',()=>saveSession());
const setPhase=k=>{if(S.phase!==k){S.phase=k;store.set('phase',k)}};
/* Every way of moving the party between village, road and dungeon goes through sceneTo (a door, Menu → Move the party) or sceneArrive (Villages →
   Party arrives here). sceneWhy(k) / sceneArriveWhy(v): why that is not possible now, '' when it is. Here they hold the manual rules
   (players at a table never move the party); journey.js adds the map and the journey day (QA/2026-11-12-logic-review.md). */
let sceneWhy=k=>S.role==='player'?'The Ref moves the party between village, road and dungeon.':'';
let sceneArriveWhy=v=>'';
let sceneTo=to=>{const why=sceneWhy(to);if(why)return toast(why);setPhase(to);if(S.role==='ref'&&to!=='village'&&S.here){S.here='';saveVillages()}render()};
let sceneArrive=id=>{const v=VILLAGES.find(x=>x.id===id);if(!v)return;const why=sceneArriveWhy(v);if(why)return toast(why);S.here=id;setPhase('village');saveVillages();toast(`The party is in ${v.name}`);render()};
/* ---------- the bar: one level of navigation. Its buttons ARE the screens, and the scene decides which (owner, 2026-11-12) ----------
   Player: the Sheet first (playerSheetHTML, with Actions inside it), then what the scene needs; Inventory is an overlay over any
   screen, opened from the round button at the bottom left (#invfab, openInventory). Ref: the scene's work · Loot · Map · Miasma.
   A scene still opens on its own screen (wsLand: the Journey on the road, the Village in a village), whatever the button order;
   the last screen opened in a scene comes back with it (S.vtab[area][scene]). */
const VICON={sheet:'<path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5"/><circle cx="12.5" cy="11.5" r="2"/><path d="M9 18a3.5 3.5 0 0 1 7 0"/>',inventory:'<path d="M3 11.5V9a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v2.5"/><rect x="3" y="11.5" width="18" height="9.5" rx="1"/><path d="M7.5 4.6V21M16.5 4.6V21"/><rect x="10.3" y="10" width="3.4" height="4.5" rx=".7"/>',
  // Actions and the Ref's road combat: crossed swords (Lucide “swords”, ISC); the lone blade read as a crutch (owner, 2026-11-23)
  actions:'<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4M7 17l-3 3M3 19l2 2"/>',rest:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  companions:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-.5A5.5 5.5 0 0 1 8 14h2a5.5 5.5 0 0 1 5.5 5.5v.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a5 5 0 0 1 3.5 5v1"/>',
  journey:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h6"/>',market:'<path d="M3 10h18l-1.5-5h-15z"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  traits:'<path d="M12 3v18"/><path d="M12 9 7 5M12 14l5-4M12 18l-5-3"/><circle cx="7" cy="5" r="1.5"/><circle cx="17" cy="10" r="1.5"/><circle cx="7" cy="15" r="1.5"/>',
  session:'<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',combat:'<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4M7 17l-3 3M3 19l2 2"/>',
  loot:'<path d="M4 11h16v9H4z"/><path d="M4 11l2-6h12l2 6"/><path d="M12 13v3"/>',rmap:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h6"/>',
  rmiasma:'<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 14h15a3 3 0 1 1-3 3"/><path d="M3 19h6"/>',village:'<path d="M2 21V12l5-4 5 4v9"/><path d="M12 21v-6l5-4 5 4v6"/><path d="M1 21h22"/><path d="M6 21v-3h2v3"/>',
  // the bar's own: who you are. The Referee: a person behind the Ref's screen (the open book read as a dumbbell, owner 2026-11-23); a player's person
  ref:'<circle cx="12" cy="6" r="3"/><path d="M2 11.5 9 12.5V21l-7-1zM9 12.5h6V21H9zM15 12.5l7-1V20l-7 1z"/>',person:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>'};
const vsvg=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const roadFight=()=>S.phase==='travel'&&(S.dt.fight==='on'||typeof jFighting==='function'&&jFighting()||S.combat.length>0); // a fight, or creatures waiting for Begin combat
// The order is a gradient (owner, 2026-11-23): the constant anchor (the Sheet; the scene's own screen for the Ref), then the scene's
// work, then what is used now and then, and the rare or closing ones last: Rest ends the player's bar, Miasma the Ref's. In a
// village the Ref's Map stays next to Villages: the next journey sets out from it.
const NAV={
  crow:()=>S.phase==='travel'?['sheet','journey','companions']:S.phase==='village'?['sheet','market','companions','traits','rest']:['sheet','companions','rest'],
  // the Ref's Journey is the travel day (journey.js); the map left play and the Miasma view went (owner, 2026-11-23: its Mind RRs
  // are in every rest, its table in Look up and Rules)
  session:()=>S.phase==='delve'?['session','loot','rmap','village']:S.phase==='travel'?['rmap',...(roadFight()?['session']:[]),'loot','village']:S.phase==='village'?['village','rmap','loot']:['session','rmap','loot','village']};
const NAVL={sheet:'Sheet',inventory:'Inventory',actions:'Actions',rest:'Rest',companions:'Companions',journey:'Journey',market:'Village',traits:'Traits',session:'Turn',loot:'Loot',rmap:'Journey',rmiasma:'Miasma',village:'Places'};
const navLabel=k=>k==='session'&&S.phase==='travel'?'Combat':NAVL[k]||TABS.crow.concat(TABS.session).find(t=>t[0]===k)?.[1]||k;
// Screens a link or an old save may still name, and where they live now (the player's Miasma is a card on the Sheet).
const NAV_ALIAS={crow:{map:'journey',pets:'companions',hirelings:'companions',miasma:'sheet',actions:'sheet',play:'sheet',pack:'sheet',crow:'sheet'},session:{table:'session',world:'rmap',journey:'rmap'}};
S.vtab={crow:{},session:{}};S.menu=null;
// The buttons of a workspace: the screens that exist and make sense now.
function wsNav(a){return NAV[a]().filter(t=>TABS[a].some(x=>x[0]===t))} // the Journey joins TABS with journey.js
// Where a scene opens: the player's Sheet leads the bar, but the road opens on the Journey and a village on the Village (owner, 2026-11-12).
const NAV_LAND={crow:()=>({travel:'journey',village:'market'})[S.phase]};
function wsLand(a){const L=wsNav(a),k=NAV_LAND[a]?.();return L.includes(k)?k:L[0]}
// The workspace the bar stands for: the open one, or this role's own when a page outside it is up (Look up, the roster, Home).
const wsHome=()=>TABS[S.area]?S.area:lobArea()?null:S.role==='ref'?(campNone()?null:'session'):ME?'crow':null; // the player's pick and wait (session.js): no crow tabs
// The one thing the player should do next, most urgent first. No button on the tab it points to.
function nextHTML(){const c=ME;if(!c||S.area!=='crow')return '';
  const ud=c.inv.filter(i=>!i.unid&&IT[i.id].ud&&/DT/.test(IT[i.id].ud[1])&&(i.lit||!IT[i.id].light));
  const n=S.pendingWounds?['bad',`<b>Mark ${S.pendingWounds} wound${S.pendingWounds>1?'s':''}</b> in your backpack.`,'inventory','Go to Inventory']
   :S.placing?['',`<b>A card is waiting for a slot.</b>`,'inventory','Go to Inventory']
   :S.phase==='delve'&&S.dt.end&&S.dt.end.step===1&&ud.length?['',`<b>DT ${S.dt.n} is over.</b> Roll your usage dice: ${ud.map(i=>`${esc(IT[i.id].name)} — ${i.ud}d6, remove a die for each 1–2`).join('; ')}.`,'inventory','Open Inventory']
   :c.stamina===0&&!c.wounds.size?['bad','<b>No Stamina left.</b> The next damage becomes wounds. A rest brings Stamina back.','rest','Rest']:null;
  if(!n)return ''; // shown on every tab, Inventory too: that is where the dice are
  return `<div class="banner ${n[0]}"><span class="msg">${n[1]}</span>${(n[2]==='inventory'?invShown():S.tab.crow===n[2])?'':`<button class="btn sm primary" data-action="tab" data-v="${n[2]}">${n[3]} →</button>`}</div>`}
// The first-visit intro on the Sheet ("Your sheet in 30 seconds") is gone (owner, 2026-11-16: outdated). An old ctk-intro key is left alone.
/* ---------- where the party is (owner, 2026-11-17: the scene switch left the bar) ----------
   A status line under the bar says it, the same for the Ref and the players, and is not a control (role=status, no hover).
   The Ref moves the party through doors where the party stands (journey.js: the place card on the Map's step panel and in the
   party's hex card, the scene banners); without a map, Menu → Move the party (moveDialog). Every door calls sceneTo/sceneArrive. */
const atTable=()=>S.role==='player'&&typeof NET!=='undefined'&&NET.ready&&!NET.host;
// A player who joined a table (even while the link reconnects) follows the Ref's scene, so only a device on its own asks.
const hasTable=()=>atTable()||S.role==='player'&&typeof NET!=='undefined'&&!!NET.code&&!NET.host;
// who may say where the party is: the Ref only. A player follows the Ref's table; on their own they have no scene (owner, 2026-11-23)
const canMove=()=>S.role==='ref'&&!campNone();
const WICON={village:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',travel:VICON.journey,
  delve:'<path d="M3 20h18"/><path d="M5 20v-7a7 7 0 0 1 14 0v7"/><path d="M9.5 20v-4.5a2.5 2.5 0 0 1 5 0V20"/>',
  poi:'<path d="M5 21V9l2-1.5V4h2.5v2H12V4h2.5v3.5L17 9v4"/><path d="M17 17v4"/><path d="M3 21h18"/><path d="M10 21v-3.5a2 2 0 0 1 4 0V21"/>',
  none:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.4"/><circle cx="12" cy="17" r=".6"/>'};
// [icon, place, …what else is worth a glance]; journey.js adds the day, the place on the road and the point of interest
// a campaign that has not begun (session 1 not started, no crow on its roster, still day 1): there is no party in the village yet,
// only the place where it will start (owner, 2026-11-22)
const partyWaits=()=>S.role==='ref'&&typeof sesOn==='function'&&!sesOn()&&sesN()<=1&&!campNone()&&!campRoster().length&&(S.rtravel.day||1)<=1;
let whereParts=()=>{const v=VILLAGES.find(x=>x.id===S.here);
  // a campaign before its first crows: the village is where the party starts (owner, 2026-11-22)
  if(S.phase==='village')return partyWaits()?['village',v?v.name:'A village',v?.home?'home village':'','the party starts here']:['village',v?`In ${v.name}`:'In a village',v?.home?'home village':'',S.role==='ref'?`day ${S.rtravel.day}`:''];
  if(S.phase==='travel')return ['travel','On the road',S.role==='ref'?`day ${S.rtravel.day}`:''];
  if(S.phase==='delve')return ['delve','In a dungeon',`DT ${S.dt.n}`];
  return ['none','Where is the party?',canMove()?'not set — Menu → Move the party':'the Ref has not said yet']};
// What the line says, or null for none. A player off a table has no scene; the Ref's line waits for an open campaign. Between
// sessions (one has ended, the next not started) the Ref's line names the next session first, so the place reads as where the
// last one ended, not as the game going on (owner, 2026-11-23: “leftovers of the last session”).
function whereLine(){if(S.role==='player'&&!hasTable()||S.role==='ref'&&campNone())return null;const w=whereParts();
  if(S.role!=='ref'||typeof sesOn!=='function'||sesOn()||!S.ses?.last)return w;
  const [ic,b,...rest]=w;return [ic,`Session ${sesN()} not started`,ic==='none'?'':`last: ${b.replace(/^(In|On)\b/,m=>m.toLowerCase())}`,...rest]}
// The line is always there (it carries the Table button, #netbtn, at its right end); outside a workspace it holds only that.
function drawWhere(){const wp=S.area!=='build'&&!!wsHome()&&whereLine(),l=$('#wherel');l.hidden=!wp;if(!wp){l.dataset.h='';l.innerHTML='';return}
  const [ic,b,...rest]=wp,h=`<svg class="wi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WICON[ic]||WICON.none}</svg><span><b>${esc(b)}</b>${rest.filter(Boolean).map(x=>`<span class="ws" aria-hidden="true"> · </span>${esc(x)}`).join('')}</span>`;
  if(l.dataset.h!==h){l.dataset.h=h;l.innerHTML=h}}
// The status line keeps its words first: when they would be cut, the Table button folds — its word and count go (always so at
// 768 px, bar-n), then its code; the dot and the wifi stay, and aria-label keeps everything.
function whereFit(){const w=$('#where'),t=$('#wherel>span');if(!w)return;w.classList.remove('w-f1','w-f2');
  const cut=()=>t&&!$('#wherel').hidden&&t.scrollWidth>t.clientWidth;
  if(document.documentElement.classList.contains('bar-n')||cut())w.classList.add('w-f1');if(cut())w.classList.add('w-f2')}
// Menu → Move the party (the Ref's only): the three places, each with why it is not possible now
const MOVE_L={village:['Village','In a village: trade, rest, train'],travel:['On the road','A journey day: route, roles, the road, camp'],delve:['Dungeon','Dungeon turns and the clock'],'':['No scene','Nowhere in particular']};
function moveDialog(){if(!canMove())return toast('The Ref moves the party between village, road and dungeon.');const dl=$('#dlg');dl.dataset.k='move';
  const row=k=>{const [n,sub]=MOVE_L[k],here=(S.phase||'')===k,why=here?'':sceneWhy(k),ic=k==='delve'&&PHASES.delve.n!=='Dungeon'?'poi':k||'none';
    return `<li class="mv${here?' here':''}"><span class="mv-i" aria-hidden="true">${vsvg(WICON[ic])}</span><span class="mv-t"><b>${esc(k==='delve'?PHASES.delve.n:n)}</b><span>${esc(why||(here?'The party is here':PHASES[k]?.tip||sub))}</span></span>
     ${here?'<span class="pilltag">here</span>':`<button type="button" class="btn${why?'':' primary'}" data-action="phase" data-v="${k}"${why?` aria-disabled="true" title="${esc(why)}"`:''} aria-label="${esc('Move the party: '+(k?n:'no scene'))}${why?' — not now':''}">${why?'Not now':'Go'}</button>`}</li>`};
  dl.innerHTML=`<form method="dialog" class="movedlg"><h2>Move the party</h2><p class="muted">Here are all three, with what stands in the way.</p>
   <ul class="mvl">${['village','travel','delve',''].map(row).join('')}</ul><div class="row" style="justify-content:flex-end;margin-top:.75rem"><button class="btn ghost">Close</button></div></form>`;
  dl.onclose=()=>{dl.dataset.k=''};dl.onclick=null;dl.onsubmit=null;if(!dl.open)dl.showModal();dl.querySelector('.btn.primary')?.focus()}
function nowHTML(){const ph=PHASES[S.phase];
  const ask=ph||!canMove()?'':`<section class="now" aria-label="Where the party is"><b>Where is the party?</b> <span class="muted">Say it once: the screen buttons then change to what you need there.</span> <button class="btn sm" data-action="move">${nest('Move the party')}</button></section>`;
  return campHomeHTML()+ask+nextHTML()} // campHomeHTML: an empty campaign's first step, its home village (campaign.js)
// Where a screen named by a link, a test or an old save lands now. Inventory opens over the screen; the old Pets, Hirelings,
// Miasma and Actions tabs are sections of Companions and the Sheet (S.navAt: the section to scroll to after the render).
// S.tab.crow 'inventory' (a jump from a banner, a test, an old link) opens the overlay and stays named until another screen is
// picked; the screen under it is the one last open in this scene. Going to another screen closes the overlay.
let NAV_LAST=null;
function navFix(a){let t=S.tab[a];const L=wsNav(a),under=()=>L.includes(S.vtab[a][S.phase])?S.vtab[a][S.phase]:wsLand(a);
  if(a==='crow'){S.hud??={};if(t==='inventory'){S.hud.inv=true;NAV_LAST=t;return under()}if(t!==NAV_LAST&&NAV_LAST!=null)S.hud.inv=false;if(t==='pets'||t==='hirelings')S.navAt=t==='pets'?'comp-pets':'comp-hires';
    else if(t==='miasma')S.navAt='ps-miasma';else if(t==='actions'){S.hud.actsCtx=playCtx();S.hud.acts=true;S.navAt='ps-actions'}}
  t=t&&(NAV_ALIAS[a][t]||t);
  if(!t||!SCREENS[t]&&!TABS[a].some(x=>x[0]===t))t=under(); // a screen whose script has not loaded yet stays named
  if(L.includes(t))S.vtab[a][S.phase]=t;if(a==='crow')NAV_LAST=t;return S.tab[a]=t}
let INV_RET=null;
function openInventory(from){if(!ME)return;S.hud.inv=true;S.hud.dmg=false;INV_RET=from?.dataset?.action?`[data-action="${from.dataset.action}"]${from.dataset.v?`[data-v="${from.dataset.v}"]`:''}`:null;
  if(S.area!=='crow')S.area='crow';S.tab.crow='inventory';render();$('#invfab')?.focus({preventScroll:true})}
function closeInventory(){if(!S.hud.inv)return;S.hud.inv=false;if(S.tab.crow==='inventory')S.tab.crow=null;S.moving=null;S.invPop=null;render();
  const r=INV_RET&&[...document.querySelectorAll(INV_RET)].find(e=>e.checkVisibility?.());INV_RET=null;(r||$('#main h2,#main .btn'))?.focus({preventScroll:true})}
const searchTitle=()=>S.role==='player'?'Search rules and items (/)':'Search rules, items and monsters (/)';
const invShown=()=>S.area==='crow'&&!!ME&&!!S.hud?.inv;
// One render at a time: rebuilding #main removes a focused number field, its blur/change handler renders again from inside
// the first rebuild, and the browser throws (“…no longer a child… blur event handler”). The inner request runs right after.
let RENDERING=false,RENDER_AGAIN=false;
function render(){if(RENDERING){RENDER_AGAIN=true;return}RENDERING=true;try{renderBody()}finally{RENDERING=false}if(RENDER_AGAIN){RENDER_AGAIN=false;render()}else lobPaintSave()}
function renderBody(){syncDerived();dqTakeOwed();toastRoomDone();
  // wounds owed never outnumber the backpack slots without one: at 10 wounds the crow is dead and the rest have nowhere to go
  // (owner, 2026-11-23: 0 Stamina, 1 free slot, 4 damage — wound mode could not be left)
  if(S.pendingWounds&&ME){const room=Math.max(0,10-ME.wounds.size);if(S.pendingWounds>room){S.pendingWounds=room;if(!room)S.pendingWoundType=null}}
  if(S.area==='crow'&&!ME||S.area==='build'&&!S.b)S.area='crows';if((S.area==='camps'||S.area==='start'||S.area==='maps'||S.area==='camp'||S.area==='homev')&&S.role!=='ref'||S.area==='seat'&&S.role!=='player')S.area='home'; // Campaigns and the starter are the Ref's, the seat a player's (campaign.js, session.js)
  if((S.area==='session'||S.area==='start')&&campNone())S.area='camps';if((S.area==='camp'||S.area==='homev')&&campNone())S.area='home';if(lobArea()||sesOn())S.prep=false;if(S.area!=='crow'||sesOn()||S.role!=='player')S.book=false; // no campaign open: the table waits for one (campaign.js)
  store.set('area',S.area);saveCrows();saveSession();savePend();if(S.area==='crow')S.crowOpen=true;else if(S.hud)S.hud.dmg=false;
  const v=VIEWS[S.area](),tabs=TABS[S.area];
  // the scene moved: a workspace on the old scene's own screen (or on one the new scene lacks) follows it to the new scene's
  if(S.sceneSeen!=null&&S.sceneSeen!==S.phase)for(const a of ['crow','session']){const L=wsNav(a);if(S.tab[a]!=='inventory'&&(S.tab[a]===S.sceneMain?.[a]||!L.includes(S.tab[a])))S.tab[a]=L.includes(S.vtab[a][S.phase])?S.vtab[a][S.phase]:wsLand(a)}
  S.sceneSeen=S.phase;
  const home=S.area==='build'?null:wsHome(),scr=home?navFix(home):null;
  S.sceneMain={crow:wsLand('crow'),session:wsLand('session')};
  const tab=tabs&&(home===S.area?scr:S.tab[S.area]),NB=home?wsNav(home):[],cur=home===S.area?tab:null,inv=invShown();
  const vb=k=>`<button class="vbtn" data-action="view" data-v="${k}" aria-current="${k===cur?'page':'false'}" aria-label="${navLabel(k)}">${vsvg(VICON[k==='session'&&S.phase==='travel'?'combat':k]||VICON.sheet)}<span class="lbl">${navLabel(k)}</span></button>`;
  // a prepared thing opened from the campaign page (lobby.js lob-prep): no play views before the start, the campaign first on the left
  const prep=S.role==='ref'&&S.prep&&!sesOn()&&['session','library','maps','crows'].includes(S.area),book=lobBook(),back=prep||book?`<button class="vbtn lob-back" data-action="go" data-v="${prep?'camp':'home'}"><span aria-hidden="true">←</span><span class="lbl">${prep?esc(campCurrent?.()?.name||'Campaign'):'Home'}</span></button>`:'';
  document.documentElement.classList.toggle('prep',!!prep);document.documentElement.classList.toggle('book',!!book);try{sessionStorage.setItem('ctk-prep',S.prep?'1':'')}catch{}
  $('#views').innerHTML=back+(prep||book?'':NB.map(vb).join(''));
  $('#nav').innerHTML=NB.map(vb).join('')+`<span class="spacer"></span><button class="vbtn" data-action="rules-index" aria-label="${searchTitle()}" title="${searchTitle()}">${vsvg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')}<span class="lbl">Rules</span></button><button class="vbtn" data-action="menu" aria-haspopup="true" aria-label="Menu">${vsvg('<path d="M4 7h16M4 12h16M4 17h16"/>')}<span class="lbl">Menu</span></button>`;
  document.documentElement.dataset.nb=NB.length;
  for(const u of $$('#utils [data-action=rules-index]')){u.title=u.ariaLabel=searchTitle();u.querySelector('.lbl').textContent='Rules'}
  // Who: the Ref's says Referee; on a player's device it says Crow (the sheet's heading names the crow; owner, 2026-11-20) and the screen reader still hears the name
  {const w=$('#who'),mine=S.area==='crow'&&S.role==='player',refc=S.area==='crow'&&S.role==='ref',name=S.area==='crow'&&!lobBook()?ME.name:S.area==='session'&&!(S.role==='ref'&&S.prep&&!sesOn())?'Referee':'',lbl=mine?'Crow':refc?'Referee':name;w.hidden=!name;w.innerHTML=name?`${vsvg(VICON[S.area==='session'||refc?'ref':'person'])}<span class="wn">${esc(lbl)}</span><i aria-hidden="true">▾</i>`:'';w.setAttribute('aria-label',name?(S.area==='session'?'You are the Referee: switch to a crow or back to the table':mine?`Crow: ${name}. Switch crow or table`:refc?`You are the Referee, viewing ${name}: switch crow or table`:`${name}: switch crow or table`):'')}
  // nothing on the bar's left before the game: the app's name there, not a control (owner, 2026-11-24)
  {const nest=lobArea()||!NB.length&&!v.title&&!$('#who').textContent;$('#ptl').textContent=nest?'Nest':v.title;$('#ptl').classList.toggle('sr',!nest&&(!!tabs||S.area==='home'))}$('#acts').innerHTML=v.acts||'';
  drawWhere();
  $('#tabs').hidden=true;$('#tabs').innerHTML='';
  closeMenu();
  // scrolling side lists (library, roll tables) keep their position across renders of the same screen
  // the same screen keeps every scrolled box where it was; another one (a Library shelf, a Village view, a journey step) starts at the top
  const lk=S.area+':'+(tab||S.b?.step||'')+(inv?':inv':''),sk=lk+(S.area==='library'?':'+S.lib.cat:'')+(tab==='market'?':'+(S.mkt||''):'')+(typeof jStep==='function'?':'+jStep():''),marks=scrollMarks();
  // the vitals strip tops every crow screen; the Sheet carries it itself (playerSheetHTML)
  const strip=S.area==='crow'&&tabs&&tab!=='sheet'&&typeof hudHTML==='function'?hudHTML():'';
  // Safari clamps the window scroll while it lays out a new .page (a size container); put it back before the frame paints.
  const sy=scrollY;$('#main').innerHTML=`<div class="page ${tabs?'':'solo'}">${tabs?strip+nowHTML()+(SCREENS[tab]||(()=>''))():v.body()}</div>`;if(scrollY!==sy)scrollTo(0,sy);
  // Inventory: one overlay over whatever screen is up; the screen under it keeps its state and scroll (openInventory / closeInventory)
  {const iv=$('#invov'),top=$('#invov .invov-b')?.scrollTop||0;iv.hidden=!inv;$('#main').inert=inv;document.body.classList.toggle('inv-open',inv);
    // the Who button stands for the player’s own crow (owner, 2026-11-20): the heading names a crow only on the Ref’s device
    iv.innerHTML=inv?`<header class="invov-h"><h2>Inventory${S.role==='player'?'':` <span class="muted">· ${esc(ME.name)}</span>`}</h2></header><div class="invov-b">${inventoryHTML(ME)}</div>`:'';
    if(inv){invRoom();if(top)$('#invov .invov-b').scrollTop=top;$('#invov .invov-b').inert=lobBook()}}
  // ... opened from the round button at the bottom left, on every crow screen (a player's, or the Ref's view of a crow). The loot count waits on it.
  // It steps aside while the overlay is open; the room kept for it under the page stays, so the screen beneath keeps its scroll.
  // The same button closes it (owner, 2026-11-14): open, it turns red with ✕ and takes you back to the screen you came from.
  // Closed it is a sulphur disc with the backpack and the loot count in a red chip (owner, 2026-11-16, sheet.css / visual.css).
  {const crow=S.area==='crow'&&!!ME&&!!tabs,f=$('#invfab'),open=crow&&inv,n=S.pool.length,k=!crow?'':open?'x':String(n);f.hidden=!crow;document.body.classList.toggle('has-fab',crow);
    if(f.dataset.k!==k){f.dataset.k=k;f.classList.toggle('open',open);f.dataset.action=open?'invov-close':'inv-open';f.setAttribute('aria-expanded',String(open));
      f.innerHTML=!crow?'':open?'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>':vsvg(VICON.inventory)+(n?`<span class="tbadge red" aria-hidden="true">${n}</span>`:'');
      f.setAttribute('aria-label',open?'Close the inventory (Esc)':`Inventory${n?`: ${n} in the party loot`:''}`);f.title=open?'Close the inventory (Esc)':`Inventory: your board and the party loot${n?` (${n} waiting)`:''}`}}
  pageRoom();
  if(SSK===sk)scrollBack(marks);SSK=sk;if(LSK!==lk)S.invPop=null;LSK=lk;
  closePops(0);hidePreview();
  {const R=document.documentElement.dataset;R.scene=S.phase||'none';R.mode=typeof inFight==='function'&&inFight()?'fight':'';R.area=S.area} // the scene and combat colour the chrome (visual.css)
  const k=tab||(S.area==='library'&&S.lib.cat)||(S.area==='maps'&&'maps');document.body.classList.remove('docked');AFTER[k]&&AFTER[k]();if(inv)AFTER.inventory();else inventoryPlacePop();
  if(S.navAt){const id=S.navAt;S.navAt=null;requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({block:'start'}))}
  sesAfterRender();barFit();drawDT();whereFit();campTick();window.syncOut?.();
  if(document.body.classList.contains('panel-open')&&/^(inst|journal|pool)$/.test(P.stack[P.i]?.t))renderPanel();
}
// the lowest y a page can use: above the status line fixed at the bottom (and the phone's nav under it)
const screenBottom=()=>{const w=$('#where');return w&&getComputedStyle(w).position==='fixed'?Math.min(innerHeight,w.getBoundingClientRect().top):innerHeight};
const SCREENS={},AFTER={};
function closeMenu(){const m=$('#wsmenu');if(m&&!m.hidden){m.hidden=true;S.menu=null;$$('[aria-haspopup=true]').forEach(b=>b.setAttribute('aria-expanded','false'))}}
function openMenu(kind,btn){const m=$('#wsmenu');if(S.menu===kind&&!m.hidden)return closeMenu();S.menu=kind;
  // the bar's own Rules, Journal and Home are not repeated here; on a phone (bar-xs) the bar hides them, so the menu has them
  const inBar=q=>[...document.querySelectorAll(`#top ${q},#nav ${q}`)].some(b=>b.checkVisibility()),own=(q,h)=>inBar(q)?'':h;
  const row=(act,attrs,h,sub,on,av)=>`<button class="mrow${av?' av':''}" role="menuitem" data-action="${act}" ${attrs}${on?' aria-current="true"':''}>${av||''}<span><b>${h}</b>${sub?`<span>${sub}</span>`:''}</span></button>`;
  m.innerHTML=kind==='who'
    ?`${S.role==='ref'&&!campNone()?row('go','data-v="session"','The table','Run the game: the scene, the party, the loot',S.area==='session')+'<h3>Crows</h3>':''}${PARTY.map((c,i)=>row('open-crow',`data-i="${i}" data-keep="1"${S.role==='ref'?' data-back="1"':''}`,esc(c.name),`${esc(c.bg)} · level ${level(c).lv} · ${crowDead(c)?'dead':`Stamina ${c.stamina}/${stMax(c)}`}${!crowDead(c)&&sesOut(c)?(sesFrozen(c)?' · frozen this session':' · not in this session'):''}`,S.area==='crow'&&c===ME,crowAv(c,36,crowDead(c)?'dead':sesOut(c)?'frozen':''))).join('')}
      ${row('new-crow','',nest('+ Create a crow'),'')}${PARTY.length>1?row('go','data-v="crows"',nest('All crows'),'The roster on this device'):''}`
    :`${S.role==='ref'&&campNone()?row('camp-new','',nest('New campaign'),'A new world, session 1')+row('go','data-v="camps"',nest('Campaigns'),'Open or import one',S.area==='camps'):''}${S.role==='ref'&&!campNone()?(c=>`<h3>${esc(c?.name||'Campaign')}</h3>`)(campCurrent())+(sesOn()?row('ses-endask','',`End session ${sesN()}`,`Started ${sesHM(S.ses.at)} · ${sesDur(S.ses.at)}${S.ses.frozen.length?` · ${S.ses.frozen.length} frozen`:''}`):row('ses-continue','',nest(`Start session ${sesN()}`),'Open the table, seat the crows, start',S.area==='start'))+row('go','data-v="camps"',nest('Campaigns'),'Switch, export or start a new one',S.area==='camps'):''}${S.role==='ref'?row('go','data-v="maps"',nest('Maps'),'Draw a hex map, generate one, export it',S.area==='maps'):''}${canMove()?row('move','',nest('Move the party'),'Village, road or dungeon, with what stands in the way'):''}${own('[data-action=rules-index]',row('rules-index','',nest('Search rules'),'Rules, items'+(S.role==='player'?'':', monsters')+' — key /'))}${row('go','data-v="library"',nest('Look up'),'Browse items, backgrounds, traits'+(S.role==='player'?'':', monsters, roll tables'))}${own('[data-action=journal]',row('journal','',nest('Journal'),'Every change with Undo and Go back'))}${row('net','',nest('Shared table'),'Host a table or join the Ref’s')}${row('settings','',nest('Display'),'Theme, text size, font')}${own('[data-action=go][data-v=home]',row('go','data-v="home"',nest('Home'),S.role?`You are the ${S.role==='ref'?'Ref':'player'} on this device`:'Choose Player or Ref'))}`;
  m.className='wsmenu '+kind;m.hidden=false;const r=btn?.getBoundingClientRect();m.style.left=kind==='who'&&r&&!document.documentElement.classList.contains('bar-xs')?Math.max(8,r.left)+'px':'';
  $$('[aria-haspopup=true]').forEach(b=>b.setAttribute('aria-expanded',b===btn));m.querySelector('.mrow')?.focus()}
let LSK='',SSK='';
// Every box that scrolls inside the page or the Inventory survives a render of the same screen (owner, 2026-11-23: the Village's
// stock jumped to its top row on each pick). A box is found again by its id, else by its tag, classes and order among its likes,
// and keeps its place only while it starts the same way (its first child's text): another creature in the dock starts at its top.
// ponytail: a box whose classes change in the same render is not found again; give it an id if that ever matters.
const scrollSig=e=>(e.firstElementChild?.textContent||'').slice(0,80);
function scrollMarks(){const out=[];for(const r of [$('#main'),$('#invov')])if(r)for(const e of r.querySelectorAll('*'))if(e.scrollTop||e.scrollLeft){
  const sel=e.id?'#'+CSS.escape(e.id):e.localName+[...e.classList].map(c=>'.'+CSS.escape(c)).join('');out.push([r.id,sel,[...r.querySelectorAll(sel)].indexOf(e),e.scrollTop,e.scrollLeft,scrollSig(e)])}
  return out}
function scrollBack(m){for(const [r,sel,k,t,l,sig] of m){const e=document.getElementById(r)?.querySelectorAll(sel)[k];if(e&&scrollSig(e)===sig){e.scrollTop=t;e.scrollLeft=l}}}

// Which actions the journal files, with a label and the scopes they touch. Runs once, after the actions are defined (see the end of the file).
function journalActions(){
  const C=()=>ME?[`crow:${ME.id}`]:null,CP=()=>ME?[`crow:${ME.id}`,'pool']:null,CV=()=>ME?[`crow:${ME.id}`,'villages']:null,SE=()=>['session'],ALL=()=>[...PARTY.map(c=>`crow:${c.id}`),'session'];
  const iN=b=>{const i=findInst(b.dataset.uid);return i?nm(i):'an item'},pN=b=>{const p=S.pool.find(x=>x.uid===+b.dataset.uid);return p?nm(p):'an item'},sg=b=>+b.dataset.d>0?'+1':'−1';
  const J={effort:[b=>`Effort ${sg(b)}`,C,1],cruelty:[b=>`Cruelty ${sg(b)}`,C,1],cond:[b=>`Condition: ${b.dataset.v}`,C,1],wound:[b=>`Wound mark, slot ${+b.dataset.v+1}`,C,1],
    'wound-type':[b=>`+ ${b.dataset.v} wound`,C],heal:[()=>'Healed',C],light:[()=>'Light lit or put out',C,1],wear:[()=>'Armor worn or taken off',C,1],ud:[b=>`Usage die: ${iN(b)}`,C],cnt:[b=>+b.dataset.d>0?`+1 ${iN(b)}`:`${/Ration|Feed/.test(iN(b))?'Ate':'Used'} 1 ${iN(b)}`,C],
    'id-use':[b=>`Tried to use ${iN(b)}`,C],'id-study':[b=>`Study: ${iN(b)}`,C,1],'pet-take':[()=>'Took an item back from a companion',C],'pet-wound':[()=>'Companion wound mark',C,1],coins:[()=>'Coins changed',C],pour:[()=>'Put coins in the purse',C],
    rfinish:[()=>'Finished a rest',CP],'mi-d10':[()=>'Miasma roll',C],'mi-clear':[()=>'Cruelty removed',C],'mi-rm':[()=>'Miasma effect removed',C],'lore-spend':[()=>'Spent lore Effort',C,1],
    tbuy:[()=>`Learned ${D.trees[S.tree]?.nodes[S.tnode??0]?.n||'a trait'}`,C],trefund:[()=>`Refunded ${D.trees[S.tree]?.nodes[S.tnode??0]?.n||'a trait'}`,C],treset:[()=>`Reset ${S.tree}`,C],
    lvok:[b=>`Level ${b.dataset.lv} choices`,C],'xp-add':[()=>'Added XP',C],'xp-unbank':[()=>'Cancelled waiting XP',C],'xp-fix':[()=>'Corrected TXP',C],
    take:[b=>`Took ${pN(b)} from the loot`,CP],'pool-remove':[b=>`Removed ${pN(b)} from the pool`,()=>['pool']],topool:[b=>`Gave ${iN(b)} to the loot`,CP],discard:[b=>`Threw away ${iN(b)}`,C],split:[b=>`Split ${iN(b)}`,C,1],
    dobuy:[()=>'Bought in the village',CV],dosell:[()=>'Sold in the village',CV],fund:[()=>'Invested in the village',CV],svc:[b=>`Paid for ${b.dataset.v}`,CV],gamble:[()=>'Gambled at the inn',CP],'hire-pay':[()=>'Paid a hireling',C],
    'pet-add':[()=>'Got a pet',CV],'pet-del':[()=>'Let a pet go',C],'hire-add':[()=>'Hired someone',CV],'hire-del':[()=>'Dismissed a hireling',C],
    'crow-del':[()=>`Deleted ${ME?.name}`,C],
    'next-dt':[()=>`DT ${S.dt.n} → ${S.dt.n+1}`,SE],'dt-end':[()=>`Ended DT ${S.dt.n}`,SE],'end-step':[()=>'End-of-DT step done',SE,1],fight:[()=>'Monster joined the combat',SE,1],unfight:[()=>'Creature removed from the tracker',SE],
    rnextday:[()=>`Day ${S.rtravel.day} → ${S.rtravel.day+1}`,()=>['session','villages','journey']],vcycle:[()=>'Ended a village cycle',()=>['villages']],vdel:[()=>'Deleted a village',()=>['villages']],nvadd:[()=>'Added a village',()=>['villages']],
    xpgive:[()=>'Gave XP for treasure',ALL],xpdel:[()=>'Removed a treasure line',SE],'loot-drop':[()=>'Dropped loot into the pool',()=>['pool']],
    rval:[f=>{const i=!f.dataset.pool&&PARTY[+f.dataset.c]?.inv.find(x=>x.uid===+f.dataset.uid),vs=rvalIn(f),x=i||S.pool.find(p=>p.uid===+f.dataset.pool);return `${x?nm(x):'An item'}${vs.length>1?' ×'+vs.length:''}: ${valWords({count:vs.length,vals:vs.map(v=>v??null)})||'no value yet'}`},f=>f.dataset.pool?['pool']:PARTY[+f.dataset.c]?[`crow:${PARTY[+f.dataset.c].id}`]:null]};
  for(const [k,[label,scopes,quiet]] of Object.entries(J)){const f=A[k];if(!f)continue;
    A[k]=b=>{const sc=scopes(b);if(!sc)return f(b);let l;try{l=label(b)}catch{l=k}journalStart(l,sc,{quiet});const r=f(b);if(!$('#dlg').open)journalSettle();return r}}}

/* ---------- DT clock (shared) ---------- */
// a rest at a point of interest is on (journey.js sets it): the turn has ended, the Mind RR is on the player's Rest screen
let poiResting=()=>false;
// state the Ref's device derives from the rest of its state, brought up to date before every save and sync (journey.js sets it:
// whether the camp lets the players finish their rest). A flag set by only some actions went stale (QA/2026-11-17-bugs6.md).
let syncDerived=()=>{};
const mmss=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
function drawDT(){
  const t=S.dt,g=[30,20,10][t.n-1];
  // the clock only earns header space while it runs or the party is in the dungeon
  const big=$('#bigclock'),bar=$('#bigbar');if(big)big.textContent=mmss(t.left);if(bar)bar.style.width=100*t.left/(t.len*60)+'%';
  // a rest at a point of interest ended the turn (journey.js): no clock to show until the next DT
  if(!t.running&&S.phase!=='delve'||big||$('.stage')||poiResting()){$('#dtchip').innerHTML='';return}
  $('#dtchip').innerHTML=`<span class="dtchip ${t.running?'':'idle'} ${t.running&&S.phase&&S.phase!=='delve'?'stray':''}" ${t.running&&S.phase&&S.phase!=='delve'?'title="The dungeon clock is still running outside the dungeon"':''}><a class="term" href="#rule/dt" data-term="dt" style="color:inherit">DT</a> <b>${t.n}</b> <span>${mmss(t.left)}</span>${t.running?'':' <span class="small">paused</span>'}</span>`;
}
// the tab bar sticks right under the title bar, and side panels stick under both, whatever height text size gives them
// …and what the bottom of the screen takes: --navh (the phone's bottom nav) and --nb (that + the status line, fixed at the bottom
// since 2026-11-18): every page, panel, overlay, toast and floating button keeps --nb clear (topbar.css “room”)
{const ro=new ResizeObserver(()=>{const r=document.documentElement.style,t=$('#top'),w=$('#where'),st=getComputedStyle(t).position==='sticky',nv=$('#nav'),nh=getComputedStyle(nv).display==='none'?0:nv.offsetHeight;
  r.setProperty('--tbar',(st?t.offsetHeight:0)+'px');r.setProperty('--th',(st?t.offsetHeight:0)+'px');r.setProperty('--tb',$('#tabs').offsetHeight+'px');r.setProperty('--navh',nh+'px');r.setProperty('--nb',nh+w.offsetHeight+'px')});ro.observe($('#top'));ro.observe($('#where'));ro.observe($('#tabs'));ro.observe($('#nav'))}
setInterval(()=>{const t=S.dt;if(!t.running)return;t.left=Math.max(0,t.left-1);if(t.left%5===0)saveSession();if(t.left===0){t.running=false;t.end={step:1};toast(`${typeof jPoiScene==='function'&&jPoiScene()?`DT ${t.n}`:'Dungeon turn'} is over — end-of-DT steps are ready`);if(S.area==='session'&&S.tab.session==='session')render()}drawDT()},1000);

/* ================= PLAYER: character sheet ================= */
// Conditions in force are chips to end; the others wait behind one button.
// Tone of a condition and of a health bar: what the eye should read before the word (iteration 4, visual.css)
const condTone=k=>k==='blessed'?'good':'harm',hpLv=(v,m)=>!v?'out':v/m>=.67?'ok':v/m>=.34?'mid':'low';
function condsHTML(c){const on=CONDITIONS.filter(k=>c.cond.has(k)),off=CONDITIONS.filter(k=>!c.cond.has(k));
  return `<div class="conds" role="group" aria-label="Conditions"><a class="term ql" href="#rule/conditions" data-term="conditions">Conditions</a>${on.map(k=>`<button class="chip on hint ${condTone(k)}" data-action="cond" data-v="${k}" data-term="c-${k}" aria-pressed="true" aria-label="${k}: end it">${k}<i aria-hidden="true">✕</i></button>`).join('')}
    ${S.condOpen?off.map(k=>`<button class="chip hint" data-action="cond" data-v="${k}" data-term="c-${k}" aria-pressed="false" aria-label="Add ${k}">+ ${k}</button>`).join('')+`<button class="btn sm ghost" data-action="cond-open">Done</button>`:off.length?`<button class="btn sm ghost" data-action="cond-open" aria-expanded="false">${on.length?'+ Another':'+ Add a condition'}</button>`:''}</div>`}
/* ---------- the Sheet: one renderer any container can host (playerSheetHTML; its order is described above it). o.vitals:false
   when the host shows the strip itself. The attacks live only in Actions: no separate attack block (owner, 2026-11-12). Inventory
   is the round button at the bottom left (#invfab), not part of the Sheet. */
const traitChip=t=>`<button class="chip hint" data-action="trait-go" data-v="${esc(t.tree)}" data-n="${esc(t.n)}" data-term="tr-${esc(t.tree+'|'+t.n.toLowerCase())}">${esc(t.n)}</button>`;
/* Actions open or closed: open by default in combat, closed elsewhere. The player's own choice holds while the situation lasts
   (playCtx) and gives way to the default when it changes. View state (S.hud), never in snap(). */
function actsOpen(){const ctx=playCtx();if(S.hud.actsCtx!==ctx){S.hud.actsCtx=ctx;S.hud.acts=null}return S.hud.acts??ctx==='fight'}
function actsHTML(c,open,fight){
  return `<section class="ps-sec ps-acts ${open?'open':''}" id="ps-actions" aria-label="Actions"><button class="btn ps-actb" data-action="ps-acts" aria-expanded="${open}" aria-controls="ps-actl">${vsvg(VICON.actions)}<span>Actions</span><span class="muted ps-acts-s">${open?(fight?'your attacks first':'everything you can do on a turn'):fight?'your attacks, then everything else':'your attacks and everything you can do on a turn'}</span><i aria-hidden="true"></i></button>
    ${open?`<div id="ps-actl" class="ps-actl">${playerActionsHTML(c)}</div><div class="ps-acts-end"><span class="muted">End of Actions</span><button class="btn sm ghost" data-action="ps-acts-hide">Hide Actions</button></div>`:''}</section>`}
// The Miasma on this crow, in blood (owner, 2026-11-16: the Miasma is harm, even while a roll waits): effects (mark ✕), cruelty
// and a Mind RR still to make (mark !).
// The roll after a rest in the Miasma is made here or on the Rest screen; on a Journey it belongs to the camp panel, and a tier
// answered there or the next day begun settles it (journey.js jMindSettled: tier 2 and 3 leave no mark on the crow).
const miPending=c=>c.lastRest==='miasma'&&!miDone(c)&&S.mi.t2!==`${c.id}:${c.rests||0}`&&!(typeof jMindSettled==='function'&&jMindSettled(c));
// The Mind RR still owed after a rest in the Miasma (a rest that ended without one): at a table a line with what to roll and a pill;
// without a Ref the same compact entry the Ref has (dice.js dqMindNowItem: the tiers, a d10 field, the effect's full name).
function miRRHTML(c){const it=dqMindNowItem(c);if(!it)return '';if(dqTable())return `<div class="dq-prow"><span class="t">${it.pt}</span>${it.pill}</div>`;
  return `<div class="dq-line" style="margin:.3rem 0">${it.tiers()}</div>${it.extra()?`<div class="dq-line" style="margin:.3rem 0">${it.extra()}</div>`:''}`}
// The Mind RR's result is news of that night only: once the next travel day begins the card goes (owner, 2026-11-22); an effect
// it gave stays below for as long as it lasts.
const miNight=()=>typeof jStep!=='function'||['off','camp','night','dawn'].includes(jStep());
function miCardHTML(c){const pend=miPending(c),fresh=c.lastRest==='miasma'&&miDone(c)&&c.miLast?.rest===(c.rests||0)&&miNight(),fx=c.miasma.length;
  if(!fx&&!pend&&!fresh)return ''; // cruelty alone is the stepper in the conditions row (ps-cr0)
  const poiR=poiResting(),camp=pend&&(campRest()||poiR),mark=fx||c.cruelty>=3?'✕':'!'; // the Miasma is always blood (owner); the mark is the second cue
  return `<section class="ps-mi harm" id="ps-miasma" aria-label="Miasma"><header class="ps-mih"><h2><span class="ps-mii" aria-hidden="true">${mark}</span><a class="term" href="#rule/miasma" data-term="miasma">Miasma</a></h2></header>
    ${pend?(camp?`<p class="ps-mip"><b>Mind RR waiting.</b> You rested in the Miasma: make the roll on ${poiR?'your Rest screen':'the Journey’s camp panel'}. <button class="btn sm" data-action="tab" data-v="${poiR?'rest':'journey'}">${poiR?'Rest':'Journey'} →</button></p>`
      :`<p class="ps-mip"><b>You rested in the Miasma: your Mind RR.</b>${dqTable()?' Roll and tell the Ref.':' Roll 2d10 + M and enter the tier.'}</p>${miRRHTML(c)}`):fresh?miResultHTML(c,dqTable()?'':'mi-undo'):''}
    ${fx?`<div class="ps-fx">${fxHTML(c,true)}</div>`:''}</section>`}
/* The Sheet under 48em of page width (a 768 px tablet): one column, the characteristics a compact strip of three — the owner's
   pick (2026-11-16, variant b of three shown). Laptops keep the three columns of the owner's mockup. */
/* The Sheet, top to bottom (the owner's mockup, 2026-11-16): the name with the distinctive feature beside it · the level card (TXP
   bar, XP to spend, Add XP, Correct TXP — the motivator, always on top) · the vitals strip · conditions and cruelty, with the wound
   from hunger or exhaustion at the right · the Miasma card when an effect or a roll is on the crow · characteristics | expertises by
   kind | traits and the village connection · Actions, folded. In combat Actions open right under the conditions. */
function playerSheetHTML(c,o={}){const dead=crowDead(c),fight=!dead&&playCtx()==='fight',open=actsOpen(),acts=dead?'':actsHTML(c,open,fight);
  const conn=c.npc||c.npcType?`<div class="chconn"><b class="small">Village connection</b><span class="small">${esc(c.npc||'unnamed')}${c.npcRel?` <span class="muted">— ${esc(c.npcRel)}</span>`:''}</span>${c.npcType?`<span class="chip hint" data-term="npc-${esc(c.npcType)}" tabindex="0">${esc(c.npcType)}</span>`:''}</div>`:'';
  const crT=c.cruelty>=3?'harm':c.cruelty?'warn':'';
  const cruel=`<span class="ps-cr0 ${crT}"><a class="term ql" href="#rule/cruelty" data-term="cruelty">Cruelty</a><span class="stepper"><button data-action="cruelty" data-d="-1" aria-label="Lower Cruelty">−</button><b aria-label="Cruelty ${c.cruelty}">${c.cruelty}</b><button data-action="cruelty" data-d="1" aria-label="Raise Cruelty">+</button></span></span>`;
  const wf=`<div class="ps-wf" role="group" aria-label="A wound from hunger or exhaustion"><span class="ql">A wound from</span><button class="btn sm ghost hint" data-action="wound-type" data-v="starvation" data-term="r-starvation">+ Starvation</button><button class="btn sm ghost hint" data-action="wound-type" data-v="exhaustion" data-term="r-exhaustion">+ Exhaustion</button></div>`;
  return `<div class="psheet">
  <header class="fs-h ps-h"><div class="ps-id"><h2>${esc(c.name)}</h2>${c.feature?`<p class="ps-feat">${esc(c.feature)}</p>`:''}</div>
    <button class="btn ghost" data-action="crow-edit" aria-label="Edit ${esc(c.name)}">Edit</button></header>
  ${dead?`${deadNote(c)}<p class="muted ps-deadlv">Level ${level(c).lv} · ${esc(c.bg)}${c.village?` of ${esc(c.village)}`:''}</p>` // a dead crow's sheet is a record: no vitals, conditions, Miasma or actions to play (owner, 2026-11-23)
    :`${advHTML(c)}
  ${o.vitals===false||typeof hudHTML!=='function'?'':hudHTML()}
  ${miCardHTML(c)}
  <section class="ps-sec ps-now" aria-label="Conditions"><div class="ps-nowl">${condsHTML(c)}${cruel}</div>${wf}</section>`}
  ${fight?acts:''}
  <div class="fs ps-who">
    <section class="fs-s ps-chs"><h2 class="sec-h">Characteristics</h2>
      <div class="kpis ch">${[['A','Agility'],['M','Mind'],['S','Strength']].map(([k,n])=>{const v=c.ch[k],note=`${n} ${fmt(v)}: on 2d10, ${12-v}–${16-v} is Tier 2 and ${17-v}+ is Tier 3`;return `<div class="kpi hint chr chr-${k}" data-term="tiers" data-note="${esc(note)}" tabindex="0" aria-label="${esc(note)}"><span class="k">${n}</span><span class="v">${fmt(v)}</span></div>`}).join('')}</div>
      ${c.extra?.length?`<p class="small chnote"><b>Also:</b> ${esc(c.extra.join(', '))}</p>`:''}</section>
    <section class="fs-s ps-exs"><h2 class="sec-h"><a class="term" href="#rule/expertise" data-term="expertise" style="color:inherit">Expertises</a></h2>
      ${c.lore?`<p class="small" style="margin:.2rem 0">From <b>${esc(c.lore.book)}</b> until your next rest: <span class="chip">${esc(c.lore.exp)}</span></p>`:''}${(()=>{const rows=[['General','gen'],['Weapon','wpn'],['Spellcasting','mag']].filter(([l,k])=>c.exp[k].length);return rows.length?rows.map(([l,k])=>`<div class="exrow" data-kind="${k}"><span class="muted small">${l}</span><span class="chips">${c.exp[k].map(expChip).join('')}</span></div>`).join(''):'<p class="muted small" style="margin:0">None yet. A level brings a new one.</p>'})()}</section>
    <section class="fs-s ps-trs"><h2 class="sec-h"><a class="term" href="#rule/traits" data-term="traits" style="color:inherit">Traits</a></h2>
      <div class="chips sm">${c.traits.map(traitChip).join('')||'<span class="muted small">None yet. XP buys them after a rest.</span>'}</div>${conn}</section>
  </div>
  ${fight?'':acts}
  </div>`}
SCREENS.sheet=()=>playerSheetHTML(ME,{vitals:true});

SCREENS.inventory=()=>inventoryHTML(ME);
AFTER.inventory=()=>{inventoryFilter();inventoryPlacePop()};
// Placing, moving and pending wounds share one bar above the bottom navigation, so the board never shifts.
function placeBar(){
  if(S.pendingWounds&&!S.placing)return `<div class="placebar bad" role="alert"><span><b>Mark ${S.pendingWounds} ${S.pendingWoundType?S.pendingWoundType+' ':''}wound${S.pendingWounds>1?'s':''}</b> · tap backpack slots. Empty ones are better: an item and a wound cost 1 Speed.</span></div>`;
  const mv=S.moving&&findInst(S.moving);if(mv)return `<div class="placebar" role="status"><span><b>Move ${esc(nm(mv))}</b> · tap a dashed slot, a card to swap, or party loot</span><button class="btn sm" data-action="cancel-place">Cancel · Esc</button></div>`;
  if(!S.placing)return '';const p=S.placing,n=sizeIn(IT[p.id],'pack');
  return `<div class="placebar" role="status"><span><b>Place ${esc(nm(p))}${p.count>1?' ×'+p.count:''}</b> · tap a dashed slot${n>1?` (needs ${n} in a row)`:''}${S.pendingWounds?` · then mark ${S.pendingWounds} wound${S.pendingWounds>1?'s':''}`:''}</span><button class="btn sm" data-action="cancel-place">Cancel · Esc</button></div>`;
}
// Only the Ref takes treasure out of the shared pool; a player may take back out only a card they put in themselves (topool sets from).
const poolCanRemove=p=>refView()||!!ME&&p.from===ME.name;
function poolHTML(ref){
  return `<section class="pool" id="pool" aria-label="Loot pool"><h3>Loot pool</h3><p class="small muted" style="margin:.2rem 0 .4rem">${ref?'Players take these from their Inventory.':'Shared with the party. Take what you want; drag your cards here to give them away.'}</p>
   ${S.pool.length?S.pool.map(p=>{const it=shown(ref?{...p,unid:false}:p);return `<div class="prow" data-pool="${p.uid}"><div class="nm"><b><a href="#" data-action="open-pool" data-uid="${p.uid}" style="color:inherit">${esc(it.name)}</a>${ref&&p.unid?' <span class="chip">unidentified</span>':''}${p.count>1?' ×'+p.count:''}</b><span>${it.looks?`looks like ${esc(it.looks)} · `:''}${it.slots||1} slot${(it.slots||1)>1?'s':''}${!ref&&!p.unid&&refPriced(p)&&valWords(p,1)?` · ${valWords(p,1)}`:''} · ${esc(p.from)}${noteOf(p)?' — '+esc(noteOf(p)):''}</span>${ref?valEditHTML(p,{pool:1},{row:true}):''}</div>${ref?'':`<button class="btn sm" data-action="take" data-uid="${p.uid}">Take</button>`}${poolCanRemove(p)?`<button class="xbtn" data-action="pool-remove" data-uid="${p.uid}" aria-label="Remove ${esc(it.name)} from the pool">✕</button>`:''}</div>`}).join(''):(ref?`<p class="muted small">Empty. ${S.area==='session'&&S.tab.session==='loot'?'Finds':'Drop cards from <a href="#" data-action="goto" data-v="session/loot">Loot</a>; finds'} from travel roles land here by themselves.</p>`:'<p class="muted small">Empty. When the Ref finds treasure it shows up here — tap <b>Take</b> to put it in a free slot.</p>')}
  </section>`;
}
AFTER.sheet=()=>{};

/* The players’ travel roles are on the Journey (journey.js); the old cheat sheet (SCREENS.travel) was unreachable and is gone (2026-11-21). */

/* ================= PLAYER: Miasma (my own resistance roll) ================= */
// The Miasma table, names and durations live in journey-rules.js.
const MI_ROWS=()=>JourneyRules.miasmaRows(TB['miasma-effects']);
const MI_DUR=JourneyRules.MI_DUR;
const DUR_TXT={cruelty:'until you have no cruelty',out:'until you rest outside the Miasma',once:'happens once — remove it when done',perm:'permanent'};
const fxRow=f=>MI_ROWS().find(r=>r.n===f.n)||{};
const miSnap=c=>({cruelty:c.cruelty,miasma:[...c.miasma]});
// The result is stored on the crow, so the player and the Ref see the same roll and can't apply it twice.
function miRoll(c){const o=JourneyRules.miasmaRoll(c,MI_ROWS(),()=>d(10),c.rests||0);c.cruelty=o.cruelty;c.miasma=o.miasma;return c.miLast=o.miLast}
function miClear(c){const o=JourneyRules.miasmaClear(c,MI_ROWS(),c.rests||0);c.cruelty=o.cruelty;c.miasma=o.miasma;return c.miLast=o.miLast}
function miUndo(c){const L=c.miLast;if(!L)return;c.cruelty=L.snap.cruelty;c.miasma=L.snap.miasma;c.miLast=null}
const miDone=JourneyRules.miasmaDone;
const fxHTML=(c,rm)=>c.miasma.map((m,k)=>{const r=fxRow(m);return `<div class="fx"><div><b>${esc(m.n)}.</b> ${esc(m.t)}${(m.up||r.up)?`<div class="small"><b>Also:</b> ${esc(m.up||r.up)}</div>`:''}<div class="small muted">Lasts ${DUR_TXT[m.dur||r.dur]||'as the table says'}</div></div>${rm?`<button class="xbtn" data-action="mi-rm" data-k="${k}" aria-label="Remove ${esc(m.n)}">✕</button>`:''}</div>`}).join('');
function miResultHTML(c,undo){const L=c.miLast,ub=undo?` <button class="btn sm" data-action="${undo}" data-k="${PARTY.indexOf(c)}">Undo</button>`:'';if(L.k==='t2')return `<div class="result good">Mind RR tier 2: the Miasma doesn’t touch ${undo==='mi-undo'||!undo?'you':esc(c.name)} this time.${ub}</div>`;if(L.k==='lift'){const o=PARTY.find(x=>x.id===L.to);return `<div class="result good">Mind RR tier 3: lifts ${esc(o?.name||'an ally')} a tier.${ub}</div>`}
  if(L.k==='clear')return `<div class="result good">Cruelty ${L.snap.cruelty} → 0.${L.snap.miasma.length!==c.miasma.length?' Effects that last until you have no cruelty ended.':''}${ub}</div>`;
  return `<div class="result bad">Cruelty is now ${L.cr}. d10 <span class="roll">${L.r}</span> + ${L.cr} = <b>${L.r+L.cr}: ${esc(L.hit.n)}</b>${L.rerolled?' <span class="small muted">(rerolled an effect you already had)</span>':''}
   <div style="margin-top:.35rem">${esc(L.hit.t)}</div><div class="small" style="margin-top:.35rem"><b>Also:</b> ${esc(L.hit.up)}</div>
   ${L.hit.lo>=13?'<p class="small" style="margin:.35rem 0 0"><b>This crow is lost to the Miasma and becomes an NPC run by the Ref.</b></p>':''}${undo?`<button class="btn sm" data-action="${undo}" data-k="${PARTY.indexOf(c)}" style="margin-top:.5rem">Undo</button>`:''}</div>`}
const MI_NAMES=JourneyRules.MI_NAMES;

/* ================= PLAYER: advancement ================= */
function petBack(c,p,i){p.inv=p.inv.filter(x=>x!==i);const pos=firstFitFor(c,i.id);if(pos){i.sec=pos.sec;i.idx=pos.idx;c.inv.push(i);toast(`${nm(i)} → ${SEC_NAME[pos.sec]} ${pos.idx+1}`)}else{S.pool.push(putVals({uid:UID++,id:i.id,count:i.count,from:c.name,ud:i.ud,unid:i.unid,topic:i.topic},valsOf(i)));toast(`No room — ${nm(i)} went to the loot pool`)}}
const firstFitFor=(c,id)=>{for(const sec of ['pack','belt','hand'])for(let k=0;k<lenOf(c,sec);k++)if(!canPlace(c,id,sec,k))return {sec,idx:k};return null};
function clearWounds(c,kind){const t=c.woundType||{};const ks=Object.keys(t).filter(k=>t[k]===kind);ks.forEach(k=>{c.wounds.delete(+k);delete t[k]});if(ks.length)toast(`${ks.length} ${kind} wound${ks.length>1?'s':''} gone`)}
const coinsOf=c=>c.inv.reduce((a,i)=>a+(i.coins||0)+(i.id==='gold-coins'?i.count:0),0);
// built on first use: BOOK is defined further down the file
let _allExp;const allExp=()=>_allExp||(_allExp=(()=>{const out={gen:[],mag:[],wpn:[]};let k=null;for(const p of BOOK['r-effort-expertise'].body){if(p.h)k=/General/.test(p.h)?'gen':/Spell/.test(p.h)?'mag':/Weapon/.test(p.h)?'wpn':null;if(p.tb&&k)out[k]=p.tb.map(r=>r[0].replace(/^Expertise /,''))}return out})());
const hasAnyExp=(c,e)=>[...c.exp.gen,...c.exp.wpn,...c.exp.mag].includes(e)||c.lore?.exp===e;
// Levels whose choices (a new expertise, maybe +1 to a characteristic) aren't made yet. XP only counts after a rest.
const pendingLevels=c=>LVL.filter(l=>l.lv>1&&l.lv<=level(c).lv&&!(c.lvDone||[]).includes(l.lv));
function advHTML(c){const lv=level(c),next=LVL.find(l=>l.min>c.txp),pend=pendingLevels(c),L=S.lvl||(S.lvl={});
  const pct=next?100*(c.txp-lv.min)/(next.min-lv.min):100;
  return `<div class="box xpstrip">
    <div class="xid"><a class="term" href="#rule/level" data-term="level">Level <b>${lv.lv}</b></a><span class="muted"><span class="xbg">${esc(c.bg)}${c.village?` of ${esc(c.village)}`:''} · </span>${coinsOf(c)} gc</span></div>
    <div class="xbar"><div class="small muted"><span><a class="term" href="#rule/c-advancement" data-term="c-advancement">TXP</a> <b>${c.txp}</b></span><span>${next?`${next.min-c.txp} to level ${next.lv}`:'top level'}</span></div><span class="hbar"><i style="width:${pct}%"></i></span></div>
    <div class="xsp">XP to spend <b>${c.txp-c.xpSpent}</b>${c.xpBank?` <span class="small muted">+${c.xpBank} after your next rest</span><button class="xbtn" data-action="xp-unbank" aria-label="Cancel the XP waiting for your rest">✕</button>`:''}</div>
    <div class="row"><button class="btn sm" data-action="xp-add" title="Added XP counts after you finish a rest">${nest('Add XP')}</button><button class="btn sm ghost" data-action="xp-fix" title="Fixes a mistake: levels and traits it no longer covers are undone">${nest('Correct TXP')}</button></div>
   ${pend.slice(0,1).map(l=>{const pick=L[l.lv]||{};return `<div class="lvup"><span><b>Level ${l.lv}:</b> +2 Stamina (done), choose a new expertise${l.ch?' and +1 to a characteristic (max 4)':''}.${pend.length>1?` <span class="muted">Then ${pend.length-1} more level${pend.length>2?'s':''}.</span>`:''}</span>
     <span class="row"><select data-action="lvexp" data-lv="${l.lv}" aria-label="New expertise"><option value="">New expertise</option>${Object.entries(allExp()).map(([k,a])=>`<optgroup label="${k==='gen'?'General':k==='mag'?'Spellcasting':'Weapon'}">${a.filter(e=>!hasAnyExp(c,e)).map(e=>`<option ${pick.exp===e?'selected':''}>${esc(e)}</option>`).join('')}</optgroup>`).join('')}</select>
     ${l.ch?['A','M','S'].map(k=>`<button class="btn sm ${pick.ch===k?'primary':''}" data-action="lvch" data-lv="${l.lv}" data-v="${k}" ${c.ch[k]>=4?'disabled':''}>${CHN[k]} ${fmt(c.ch[k])}→${fmt(c.ch[k]+1)}</button>`).join(''):''}
     <button class="btn sm primary" data-action="lvok" data-lv="${l.lv}" ${pick.exp&&(!l.ch||pick.ch)?'':'disabled'}>Apply</button></span></div>`}).join('')}
   </div>`}
/* ================= PLAYER: actions, maneuvers, reactions (Rules pp. 19-21) from what the crow holds ================= */
const bookLi=(id,name)=>{const B=BOOK[id].body,k=B.findIndex(p=>(p.li||'').startsWith('**'+name));if(k<0)return {t:'',rows:null};let i=k+1,head=null,rows=[];if(B[i]?.roll){head=B[i].roll;i++}while(B[i]?.tier){rows.push([B[i].tier,bookText(B[i].x)]);i++}
  return {t:B[k].li.replace(/^\*\*[^*]+\*\*\s*/,''),head,rows:rows.length?rows:null}};
const testMod=(c,head)=>{const ks=(head||'').replace(/^2d10 \+ /,'').split(/ or /).map(x=>x.trim()).filter(k=>'AMS'.includes(k)&&k);return ks.length?ks.reduce((a,k)=>c.ch[k]>c.ch[a]?k:a):null};
// One card of the Actions list, as on the rulebook's page: name and type, where it comes from, the rule text with linked terms,
// the tier table when it is a test (with what this crow adds and the dice each tier needs), and why it is greyed when it can't be done now.
const ABIL_KIND={Action:'Action',Maneuver:'Maneuver','Free action':'Free action',Reaction:'Reaction'};
function abilityHTML(c,a){const k=testMod(c,a.head);
  return `<article class="abil ${a.off?'off':''}" data-abil="${esc(a.name)}"><header><b>${esc(a.name)}</b><span class="chip">${ABIL_KIND[a.kind]||esc(a.kind)}</span></header>
   ${a.src?`<div class="small muted abil-src">${a.src}</div>`:''}${a.t?`<p class="small abil-t">${a.t}</p>`:''}
   ${a.rows?prHTML(a.rows,{head:esc(a.head||'Test'),sub:k?`you use ${k} ${fmt(c.ch[k])}`:'',mod:k?c.ch[k]:null}):''}
   ${a.off?`<p class="small why">${esc(a.off)}</p>`:''}</article>`}
function abilities(c){const out={Action:[],Maneuver:[],Reaction:[]};const hand=c.inv.filter(i=>i.sec==='hand'),handSlots=occ(c,'hand').filter(Boolean).length,free=2-handSlots,sp=speed(c);
  const weapons=hand.filter(i=>IT[i.id].cat==='weapon'&&!i.unid),melee=weapons.filter(i=>/Melee/.test(IT[i.id].range||''));
  const belt=c.inv.filter(i=>i.sec==='belt'),ammoFor=it=>/Crossbow/.test(it.name)?/Bolt/:/Arrow/;
  const add=(kind,o)=>out[kind].push(Object.assign({kind},o));
  // attacks with what is in hand. An action is one attack with one weapon: the same card twice in hand is one card (“in both hands”).
  // Light (Character p. 40): a melee hit while wielding two light weapons adds the unused one's tier 2 result without A or S; a throw
  // is not melee (owner, 2026-11-23: “a knife in each hand — one strike or two?”)
  const light=melee.filter(i=>/\bLight\b/.test(IT[i.id].q||'')),t2=it=>String(it.tiers?.v?.[0]||'').replace(/\s*\+\s*(A or S|A|S)$/,'');
  for(const i of weapons.filter((x,k)=>weapons.findIndex(y=>y.id===x.id)===k)){const it=IT[i.id],r=it.range||'',bow=it.wtype==='Bow',ammo=bow&&belt.some(b=>ammoFor(it).test(IT[b.id].name));
    const two=weapons.filter(x=>x.id===i.id).length>1,o=light.includes(i)&&light.find(x=>x!==i),plus=o?t2(IT[o.id]):'';
    const rows=[[1,/Ranged/.test(r)&&!/Melee/.test(r)?'Miss. Allies next to the target may be hit.':'Miss — the target can counter.'],...it.tiers.h.map((h,j)=>[j+2,esc(it.tiers.v[j])+' damage'])];
    const exp=it.wtype&&hasAnyExp(c,it.wtype)?` · your ${it.wtype} expertise lets you spend Effort`:'';
    add('Action',{name:`Attack: ${it.name}`,src:`${two?'In both hands · ':''}${esc(r)}${it.q?' · '+quals(it.q,it):''}${exp}${parryOf(c,it)&&adOf(c,i)===0?' · <b>no Parry AD left: −1 damage</b>':''}`
      +(plus?`<br><b>Two light weapons:</b> one attack; a melee hit adds ${esc(plus)} damage (the other ${esc(IT[o.id].name)}’s tier 2, without A or S).`:''),
      head:it.attack,rows:plus?rows.map(([t,x])=>[t,t>1?x.replace(/ damage$/,` + ${esc(plus)} damage`):x]):rows,off:bow&&!ammo?`No ${/Crossbow/.test(it.name)?'bolts':'arrows'} on your belt`:''});
    if(/Melee/.test(r)&&/Ranged/.test(r))add('Action',{name:`Throw: ${it.name}`,src:esc(r.replace(/Melee \d+\//,''))+(two?` · throws one ${esc(it.name)}`:'')+' · decide before the test'+(plus?' · no light-weapon bonus: it is not a melee attack':''),head:it.attack,rows:[[1,'Miss. Allies next to the target may be hit.'],...rows.slice(1)]})}
  const ub=BOOK['r-melee-attacks'].body,uk=ub.findIndex(p=>p.roll);
  add('Action',{name:'Unarmed strike',src:'Melee · punches, kicks, or an object that isn’t a weapon (a torch, a book). Fragile things like lanterns break.',head:ub[uk].roll,rows:ub.slice(uk+1).filter(p=>p.tier).map(p=>[p.tier,bookText(p.x.replace(/ dam$/,' damage'))])});
  for(const i of hand.filter(i=>IT[i.id].cat==='spellbook'&&!i.unid)){const it=IT[i.id];add('Action',{name:`Cast: ${it.name.replace(/ Book$/,'')}`,src:`Rank ${it.rank??'?'} · ${esc(it.school||'')} · ${i.ud??'–'} UD left`,t:linkify(it.text||''),head:'Casting test 2d10 + M',rows:it.tiers?it.tiers.h.map((h,j)=>[h.startsWith('≤')?1:h.startsWith('12')?2:3,esc(it.tiers.v[j])]):null,off:i.ud===0?'No usage dice left until you rest':''})}
  // what the cards themselves let you do — from hands, worn magic items, and the belt when the card says so
  for(const i of c.inv.filter(i=>!i.unid&&(i.sec==='hand'||i.sec==='magic'||(i.sec==='belt'&&/belt/i.test(IT[i.id].text||''))))){const it=IT[i.id];
    for(const m of (it.text||'').matchAll(/\*\*(Action|Maneuver|Reaction):\*\*\s*([^*]+)/g))add(m[1],{name:it.name,src:`${SEC_NAME[i.sec]} ${i.idx+1}`,t:linkify(m[2].trim())})}
  for(const [n,id] of [['Flee','r-actions'],['Ready an Action','r-actions'],['Taunt','r-actions']]){const b=bookLi(id,n);add('Action',{name:n,t:bookText(b.t),off:n==='Flee'&&sp<1?'Your speed is 0':''})}
  const M=n=>bookLi('r-maneuvers',n);
  add('Maneuver',{name:'Move',t:`Move up to <b>${sp}</b> squares.`,off:sp<1?'Your speed is 0':''});
  add('Maneuver',{name:'Shift',t:bookText(M('Shift').t)});
  if(c.cond.has('prone'))add('Maneuver',{name:'Stand Up',t:bookText(M('Stand Up').t),off:sp<1?'Your speed is 0':''});
  add('Maneuver',{name:'Draw From Belt',t:bookText(M('Draw From Belt').t),off:belt.length?'':'Nothing on your belt'});
  add('Maneuver',{name:'Draw From Pack',t:bookText(M('Draw From Pack').t),head:'Draw from your pack: 1d10',rows:null});
  add('Maneuver',{name:'Pick Up Item',t:bookText(M('Pick Up Item').t),off:free>0?'':'Both hands are full'});
  add('Maneuver',{name:'Dump Backpack',t:bookText(M('Dump Backpack').t)});
  for(const n of ['Grab','Knockback']){const b=M(n);add('Maneuver',{name:n,t:bookText(b.t),head:b.head,rows:b.rows,off:n==='Grab'&&free<1?'Both hands are full':''})}
  if(c.cond.has('grabbed')){const b=M('Escape Grab');add('Maneuver',{name:'Escape Grab',t:bookText(b.t),head:b.head,rows:b.rows})}
  if((c.pets||[]).length)add('Maneuver',{name:'Command',t:bookText(M('Command').t)});
  add('Reaction',{name:'Counter',t:bookText(BOOK['r-counter'].body.map(p=>p.x).join(' ')),off:melee.length?'':'You need a melee weapon in hand',src:melee.length?`with ${esc(melee.map(i=>IT[i.id].name).join(' or '))}: tier 2 damage`:''});
  add('Reaction',{name:'Opportunity Attack',t:bookText(BOOK['r-opportunity-attack'].body.map(p=>p.x).join(' ')),off:weapons.length?'':'You need a weapon in hand'});
  return out}
/* Where the party is, as the Sheet weighs it: in combat Actions open and lead the Sheet, the attacks first (actsOpen); elsewhere
   they wait behind one button. A player's choice holds until the situation changes. */
const playCtx=()=>S.phase==='delve'&&S.dt.fight==='on'||S.phase==='travel'&&(S.dt.fight==='on'||typeof jFighting==='function'&&jFighting())?'fight':S.phase==='delve'?'explore':S.phase==='travel'?'travel':S.phase==='village'?'village':'';
/* Actions (Rules pp. 19-21), the old Actions screen's layout restored on the Sheet (owner, 2026-11-12): a line on fast and slow
   turns, then Actions · Maneuvers · Reactions (and Free actions, should the rules give any) with how many are available now. The
   attacks with what is in hand come first under Actions; cards from the crow's items join their kind; what can't be done now is
   greyed with the reason. One renderer for any crow: the player's Sheet, the Ref's view of a crow. */
function playerActionsHTML(c){const A_=abilities(c),hand=c.inv.filter(i=>i.sec==='hand');
  const kinds=['Action','Maneuver','Free action','Reaction'].filter(k=>A_[k]?.length);
  return `<p class="muted abil-lead">What ${esc(c.name)} can do right now, from the cards in hand (${hand.length?esc(hand.map(i=>nm(i)).join(', ')):'empty hands'}) and the rules. Greyed cards tell you what’s missing.
    <a class="term" href="#rule/r-fast-turn" data-term="r-fast-turn">Fast turn</a>: one maneuver or one action. <a class="term" href="#rule/r-slow-turn" data-term="r-slow-turn">Slow turn</a>: a maneuver and an action, or two maneuvers.</p>
   ${kinds.map(k=>`<h3 class="sec-h abil-h" id="abil-${k.replace(/\s/g,'-').toLowerCase()}">${k}s <span class="muted">${A_[k].filter(a=>!a.off).length} available</span></h3><div class="abils">${A_[k].map(a=>abilityHTML(c,a)).join('')}</div>`).join('')}`}

/* ================= PLAYER: trait trees (Character Booklet pp. 7-30) ================= */
const traitOfTree=(tree,n)=>D.traits.find(t=>t.tree===tree&&t.n===n);
function traitState(c,tree,k){const T=D.trees[tree],nd=T.nodes[k],own=x=>c.traits.some(t=>t.tree===tree&&t.n===x);
  if(own(nd.n))return 'own';if(traitOfTree(tree,nd.n)?.start)return 'open';
  return T.links.some(([a,b])=>(a===k&&own(T.nodes[b].n))||(b===k&&own(T.nodes[a].n)))?'open':'locked'}
// A bought trait can be refunded only if every other trait you own in the tree stays connected without it.
const canRefund=(c,t)=>{const T=D.trees[t.tree],mine=c.traits.filter(x=>x.tree===t.tree&&x!==t),own=new Set(mine.map(x=>x.n));
  const idx=T.nodes.map((n,i)=>own.has(n.n)?i:-1).filter(i=>i>=0);
  const seen=new Set(idx.filter(i=>traitOfTree(t.tree,T.nodes[i].n)?.start||!mine.find(x=>x.n===T.nodes[i].n).xp)); // roots: start traits and background gifts
  for(let grew=true;grew;){grew=false;for(const [a,b] of T.links)for(const [x,y] of [[a,b],[b,a]])if(seen.has(x)&&own.has(T.nodes[y].n)&&!seen.has(y)){seen.add(y);grew=true}}
  return idx.every(i=>seen.has(i))};
// Traits: trees as tabs, the tree as compact nodes, and one panel for the picked trait. Buying and refunding happen only in the panel.
SCREENS.traits=()=>{const c=ME,xp=c.txp-c.xpSpent,names=Object.keys(D.trees);S.tree??=c.traits[0]?.tree&&D.trees[c.traits[0].tree]?c.traits[0].tree:names[0];const tree=S.tree,T=D.trees[tree],first=D.traits.find(t=>t.tree===tree);
  const bought=c.traits.filter(t=>t.tree===tree&&t.xp);
  const k=S.tnode!=null&&T.nodes[S.tnode]?S.tnode:Math.max(0,T.nodes.findIndex((_,i)=>traitState(c,tree,i)==='open')),nd=T.nodes[k],t=traitOfTree(tree,nd.n),st=traitState(c,tree,k),mine=c.traits.find(x=>x.tree===tree&&x.n===nd.n);
  const linked=T.links.filter(([a,b])=>a===k||b===k).map(([a,b])=>T.nodes[a===k?b:a].n);
  const act=st==='own'?(mine?.xp?(canRefund(c,mine)?`<button class="btn" data-action="trefund">Undo purchase (+${mine.xp.toLocaleString('en')} XP)</button>`:'<p class="small muted" style="margin:0">Other traits you own connect through this one; undo those first.</p>'):'<p class="small muted" style="margin:0">Starting trait from your background.</p>')
    :st==='open'?`<button class="btn primary" data-action="tbuy" ${t.xp>xp?'disabled':''}>${t.xp>xp?`Need ${t.xp.toLocaleString('en')} XP`:`Buy for ${t.xp.toLocaleString('en')} XP`}</button><p class="small muted" style="margin:.5rem 0 0">You buy traits when you finish a rest.</p>`
    :`<p class="small muted" style="margin:0">Needs a line to a trait you own${linked.length?`: ${linked.map(esc).join(' or ')}`:''}.</p>`;
  // the trees as chips and the chosen tree's text in one block (chips.js chipBox; owner, 2026-11-21): no heading repeats the tab
  return `${chipBox({cls:'ttabs-box',aria:'selected',label:'Trait trees',action:'tree',sel:tree,items:names.map(n=>{const m=c.traits.filter(t=>t.tree===n).length;
     return {v:n,label:`${esc(n)}${m?`<span class="n">${m}</span>`:''}`}}),desc:`<p>${cdName(esc(tree))}${esc(first?.treeText||'')}</p>`})}
   <div class="tsplit"><div class="tscroll"><div class="ttree" style="grid-template-columns:repeat(${T.cols},12.5rem)"><svg class="tlines" aria-hidden="true"></svg>
     ${T.nodes.map((n,i)=>{const x=traitOfTree(tree,n.n),s2=traitState(c,tree,i);return `<button class="tnode ${s2}" data-action="tnode" data-k="${i}" aria-pressed="${i===k}" style="grid-column:${n.c+1};grid-row:${n.r+1}">
       <span class="tn"><b>${esc(n.n)}</b><span class="small muted">${x.xp.toLocaleString('en')} XP</span></span><span class="small ts">${s2==='own'?'✓ learned':s2==='open'?'can buy':'locked'}</span></button>`}).join('')}</div></div>
    <aside class="box tpanel" aria-live="polite"><div class="tpx"><b>${xp.toLocaleString('en')}</b> XP to spend${c.xpBank?` <span class="muted">· +${c.xpBank.toLocaleString('en')} after your next rest</span>`:''}</div>
      <div class="small muted">${esc(tree)} · ${t.xp.toLocaleString('en')} XP</div><h2>${esc(t.n)}</h2><p>${linkify(t.t)}</p>${act}
      ${bought.length?`<div class="tdanger"><button class="btn sm danger" data-action="treset">Reset ${esc(tree)} (+${bought.reduce((a,x)=>a+x.xp,0).toLocaleString('en')} XP)</button></div>`:''}</aside></div>`};
// Draw the book's lines on top of the grid: page coordinates are mapped column by column and gutter by gutter.
AFTER.traits=()=>{const g=$('.ttree');if(!g)return;const T=D.trees[S.tree],box=g.getBoundingClientRect(),nodes=$$('.tnode',g);
  const colR=T.cx.map((_,k)=>{const n=nodes.find(e=>T.nodes[+e.dataset.k].c===k).getBoundingClientRect();return [n.left-box.left,n.right-box.left]});
  const rowR=T.ry.map((_,k)=>{const r=nodes.filter(e=>T.nodes[+e.dataset.k].r===k).map(e=>e.getBoundingClientRect());return [Math.min(...r.map(x=>x.top))-box.top,Math.max(...r.map(x=>x.bottom))-box.top]});
  const map=(v,src,dst)=>{for(let k=0;k<src.length;k++){const [a,b]=src[k];if(v<=b+.01||k===src.length-1){if(v>=a-.01||k===0)return dst[k][0]+(dst[k][1]-dst[k][0])*Math.min(1,Math.max(0,(v-a)/((b-a)||1)));const [pa,pb]=[src[k-1][1],a];return dst[k-1][1]+(dst[k][0]-dst[k-1][1])*(v-pa)/((pb-pa)||1)}}return dst.at(-1)[1]};
  const svg=$('.tlines',g);svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
  svg.innerHTML=T.lines.map(([x1,y1,x2,y2])=>`<line x1="${map(x1,T.cx,colR)}" y1="${map(y1,T.ry,rowR)}" x2="${map(x2,T.cx,colR)}" y2="${map(y2,T.ry,rowR)}"/>`).join('')};
addEventListener('resize',()=>{if(S.area==='crow'&&S.tab.crow==='traits')AFTER.traits()});

/* ================= PLAYER: pets (Character Booklet p. 46) and hirelings (p. 47) ================= */
const PET_PRICE=p=>({0:10,1:25,2:100,3:250,4:1000,5:2500,6:5000,7:7500,8:10000,9:15000,10:20000})[+p]??null;
const FEED={Large:2,Huge:4,'Holy Shit!':8};
const animals=()=>D.monsters.filter(m=>m.fam==='Animal').sort((a,b)=>a.name.localeCompare(b.name));
const humans=()=>D.monsters.filter(m=>m.fam==='Human').sort((a,b)=>a.name.localeCompare(b.name));
function mkPet(id,name){const m=MON[id],n=parseInt(m.st.Slots)||0;return {uid:UID++,mon:id,name:name||m.name,st:parseInt(m.st.Stamina)||1,wounds:[],inv:[],len:{pack:n}}}
const petMax=p=>parseInt(MON[p.mon].st.Stamina)||1;
// Pet and hireling slots: the player's inventory squares. Tap a card for its card; "Mark wounds" turns every square into the wound toggle.
function petSlotsHTML(p,k,kind='pets',wm=false){const o=occ(p,'pack');if(!o.length)return `<p class="small muted" style="padding:.9rem 1rem;margin:0">${kind==='pets'?'This animal':'They'} can’t carry anything.</p>`;
  return `<div class="inventory petinv ${wm?'wmode':''}"><div class="pet-slots">${o.map((x,i)=>{const w=p.wounds.includes(i),it=x&&shown(x.i),n=i+1;
    const wb=`<button class="wbtn" data-action="pet-wound" data-kind="${kind}" data-k="${k}" data-v="${i}" aria-pressed="${w}" aria-label="${w?'Remove the wound':'Mark a wound'} in slot ${n}">${INV_WOUND_ICON}<span>Wound</span></button>`;
    return `<div class="slot inv-slot ${x?'':'empty'} ${w?'wounded':''} ${x?.k?'inv-linked':''}">${x?`<button class="card inv-item tone-${inventoryVisual(it).tone}" data-action="comp-pop" data-kind="${kind}" data-k="${k}" data-uid="${x.i.uid}" data-id="${it.id}" aria-label="${esc(it.name)} · slot ${n}"><span class="inv-slot-no">${n}</span>${inventoryIcon(it,'',x.i.lit)}${x.i.count>1?`<span class="inv-count">${x.i.count}</span>`:''}${x.k?'<span class="inv-link">↳</span>':''}</button><span class="inv-item-name">${w?INV_WOUND_ICON:''}${esc(it.name)}</span>`
      :`<span class="inv-empty-art"><span class="inv-slot-no">${n}</span></span><span class="inv-item-name">${w?INV_WOUND_ICON+'Wound':'Empty'}</span>`}${wb}</div>`}).join('')}</div></div>`}
// Pets and hirelings: a list of your own on the left, the picked one on the right — sheet tiles on top, an inventory backpack below.
const COMP={pets:{one:'Pet',many:'Pets',add:'Add a pet',del:'Let go',delA:'pet-del',stA:'pet-st',nameA:'data-pet-name',
    intro:'Pets follow one owner. They don’t take turns: use the <a class="term" href="#rule/r-pets-in-combat" data-term="r-pets-in-combat">Command</a> maneuver. They carry cards and take wounds like you; they eat on rests.'},
  hires:{one:'Hireling',many:'Hirelings',add:'Hire someone',del:'Dismiss',delA:'hire-del',stA:'hire-st',nameA:'data-hire-name',
    intro:'Hirelings follow the same rules as crows but don’t gain XP. Each day: pay them (power × 10 gc, at least 10) and give them a day’s food. If one dies in your service, their family is owed their gear, pay and power × 500 gc.'}};
const compMax=x=>parseInt(MON[x.mon].st.Stamina)||1;
function compHTML(kind){const c=ME,L=(c[kind]??=[]),K=COMP[kind],n0=S.compN?.[kind];let k=S.compPick?.[kind];
  (S.compN??={})[kind]=L.length;if(n0!=null&&L.length>n0)k=(S.compPick??={})[kind]=L.length-1;if(k!=='add'&&!L[k])k=L.length?0:'add';
  const li=(x,i)=>`<li><button class="comp-li" data-action="comp-pick" data-kind="${kind}" data-v="${i}" aria-current="${k===i}"><b>${esc(x.name)}</b>${x.wounds?.length?`<em>${x.wounds.length} wound${x.wounds.length>1?'s':''}</em>`:'<em></em>'}<small>${esc(MON[x.mon].name)} · ${x.st}/${compMax(x)}</small><span class="comp-bar" aria-hidden="true"><i style="width:${Math.round(100*x.st/compMax(x))}%"></i></span></button></li>`;
  return `<p class="muted" style="margin:0 0 1rem">${K.intro}</p><div class="cols ld comp"><div class="box">
    <ul class="mlist comp-list">${L.map(li).join('')}<li><button class="comp-li comp-add" data-action="comp-pick" data-kind="${kind}" data-v="add" aria-current="${k==='add'}">+ ${K.add}</button></li></ul></div>
   <div class="box">${k==='add'?compAddHTML(kind):compDetailHTML(kind,k)}</div></div>`}
function compDetailHTML(kind,k){const c=ME,x=c[kind][k],m=MON[x.mon],K=COMP[kind],pack=x.len?.pack||0,used=occ(x,'pack').filter(Boolean).length,wm=S.compWound===kind+k;
  const tile=(l,v,cls='',st)=>`<div class="kpi ${cls}"><div class="kh"><span class="kl">${l}</span></div><div class="v">${st?`<button class="st" data-action="${K.stA}" data-k="${k}" data-d="-1" aria-label="Lower Stamina">−</button>`:''}<span>${v}</span>${st?`<button class="st" data-action="${K.stA}" data-k="${k}" data-d="1" aria-label="Raise Stamina">+</button>`:''}</div></div>`;
  const ren=S.compRename===kind+k;
  return `<div class="comp-head"><div><div class="small muted">${K.one} · ${esc(m.name)}${m.st.Size?' · '+esc(m.st.Size):''} · power ${esc(m.st.Power||'0')}</div>
      ${ren?`<label class="comp-name"><input type="text" value="${esc(x.name)}" ${K.nameA}="${k}" aria-label="${K.one} name" autofocus></label>`:`<h2 class="comp-title">${esc(x.name)}<button class="comp-ed" data-action="comp-rename" data-kind="${kind}" data-k="${k}" aria-label="Rename ${esc(x.name)}" title="Rename">✎</button></h2>`}</div>
     <div class="comp-acts"><button class="btn sm" data-action="open-mon" data-id="${m.id}">Stat block</button><span class="comp-sep"></span><button class="btn sm danger" data-action="${K.delA}" data-k="${k}">${K.del}</button></div></div>
    <div class="comp-body"><div class="kpis res comp-hud">${tile('Stamina',`${x.st}<small>/ ${compMax(x)}</small>`,x.st===0?'bad':'',1)}${tile('AD',parseInt(m.st.AD)||0)}${tile('Speed',esc(m.st.Speed||'5'))}${tile('Wounds',`${x.wounds.length}<small>/ ${pack}</small>`,x.wounds.length?'warn':'')}${kind==='pets'?tile('Feed',`${FEED[m.st.Size]||1}<small>/ rest</small>`):tile('Pay',`${hirePay(x)}<small> gc/day</small>`)}</div>
    <section class="inv-window comp-pack"><header class="inv-window-title"><h2>Backpack</h2><span><b>${pack-used}</b> free / ${pack}</span>${pack?`<button class="btn sm inv-wmode ${wm?'':'danger solid'}" data-action="comp-wmode" data-kind="${kind}" data-k="${k}" aria-pressed="${wm}">${INV_WOUND_ICON}${wm?'Done':'Mark wounds'}</button>`:''}</header>
      ${petSlotsHTML(x,k,kind,wm)}
      ${pack?`<div class="comp-give"><select data-pet-give="${k}" ${kind==='hires'?'data-kind="hires"':''} aria-label="Give a card from your inventory"><option value="">Give a card from your inventory</option>${c.inv.filter(i=>i.sec!=='magic').map(i=>`<option value="${i.uid}">${esc(nm(i))}${i.count>1?' ×'+i.count:''} — ${SEC_NAME[i.sec]} ${i.idx+1}</option>`).join('')}</select></div>`:''}</section></div>
    ${kind==='hires'&&m.st.Equipment?`<p class="small" style="margin:1rem 0 0"><b>Gear</b> ${esc(m.st.Equipment)}</p>`:''}
    ${kind==='hires'?`<div class="comp-pay"><span><b>Today: ${hirePay(x)} gc + 1 ration</b> <span class="small muted">· ${x.days||0} day${x.days===1?'':'s'} paid · death pay ${(parseInt(m.st.Power)||0)*500} gc</span></span><button class="btn primary" data-action="hire-pay" data-k="${k}">Pay today</button></div>`:''}`}
function compAddHTML(kind){
  if(kind==='pets'){const sel=S.petPick||'goat';
    return `<h2 class="sec-h">Add a pet <span class="muted">any animal; buy at the stables or befriend one in the wild</span></h2>
    <div class="row"><select data-action="pet-pick" aria-label="Animal">${animals().map(m=>`<option value="${m.id}" ${sel===m.id?'selected':''}>${esc(m.name)} — ${esc(m.st.Size||'')}, ${esc(m.st.Slots||0)} slot${+m.st.Slots===1?'':'s'}${PET_PRICE(m.st.Power)!=null?`, ${PET_PRICE(m.st.Power).toLocaleString('en')} gc`:''}</option>`).join('')}</select>
     <input type="text" id="petname" placeholder="Name (optional)" aria-label="Pet name"><button class="btn primary" data-action="pet-add">Add pet</button></div>
     ${(()=>{const v=vHere(),l=lvlOf(v,'stables');return l?`<label class="check small" style="margin-top:.4rem"><input type="checkbox" id="petbuy" checked> Buy it at the ${esc(v.name)} stables (pets up to power ${INST.stables.val[l-1]}${v.home?'':', +20% away from home'}) — untick for one you befriended</label>`:`<p class="small muted" style="margin:.4rem 0 0">${v?'No stables here':'Not in a village'}: add a pet you befriended (Pets, 2d10 + M).</p>`})()}`}
  const sel=S.hirePick||humans()[0].id;
  const owed=typeof hrDebts==='function'&&hrDebts().length>0; // no hireling works for a party that owes one (hires.js)
  return `${owed?hrDebtHTML():''}<h2 class="sec-h">Hire someone <span class="muted">stat blocks from the Bestiary</span></h2>
    <div class="row"><select data-action="hire-pick" aria-label="Hireling">${humans().map(m=>`<option value="${m.id}" ${sel===m.id?'selected':''}>${esc(m.name)} — ${Math.max(10,(parseInt(m.st.Power)||0)*10)} gc/day</option>`).join('')}</select>
     <input type="text" id="hirename" placeholder="Name (optional)" aria-label="Hireling name"><button class="btn primary" data-action="hire-add"${owed?' disabled':''}>Hire</button></div>
     <p class="small muted" style="margin:.4rem 0 0">${(()=>{const v=vHere(),l=lvlOf(v,'barracks');return l?`The ${esc(v.name)} barracks has hirelings up to power ${INST.barracks.val[l-1]}. Anyone stronger you meet on the road.`:v?'No barracks here: hire someone you met.':'Not in a village: hire someone you met.'})()}</p>`}
SCREENS.pets=()=>compHTML('pets');
const hirePay=h=>Math.max(10,(parseInt(MON[h.mon].st.Power)||0)*10);
SCREENS.hirelings=()=>compHTML('hires');
SCREENS.companions=()=>`<section class="compsec" id="comp-pets" aria-labelledby="comp-pets-h"><h2 class="sec-h comp-sh" id="comp-pets-h">Pets</h2>${compHTML('pets')}</section>
  <section class="compsec" id="comp-hires" aria-labelledby="comp-hires-h"><h2 class="sec-h comp-sh" id="comp-hires-h">Hirelings</h2>${compHTML('hires')}</section>`;

/* ================= PLAYER: rest & rest activities ================= */
const RACT=[['lore','Study a Lore Book','lore-book','Gain the book’s expertise and extra Effort for it until your next rest.'],['craft','Craft Equipment','r-craft-equipment','Make one crafting roll toward an item you can craft.'],['identify','Identify Item','r-identify-item','Learn everything about one magic item you carry.'],['repair','Repair Armor','r-repair-armor','Restore one suit of armor or shield to full AD.'],['harvest','Harvest','r-harvest','Take crafting parts from a monster corpse.'],['sleep','Good Night’s Rest','r-good-nights-rest','Just sleep: +1 Effort until you use it, even in the Miasma.'],['tend','Tend Wounds','r-tend-wounds','Another crow with 2+ wounds loses 2 wounds instead of 1.'],['seclude','Seclude Camp','r-seclude-camp','Hide the camp: EN −1 for this rest. One per group.']];
const TOOLS={Alchemy:'alchemists-tools',Blacksmithing:'blacksmiths-tools',Enchanting:'enchanters-tools'};
const hasExp=(c,e)=>[...c.exp.gen,...c.exp.wpn,...c.exp.mag].includes(e)||c.lore?.exp===e;
const LORE_EXP=['Historical Lore','Magic Lore','Monster Lore','Nature Lore','Religious Lore','Alchemy','Blacksmithing','Enchanting'];
const LORE_BOOKS={'lore-book':1,'fine-lore-book':2,'masterwork-lore-book':3};
const hasTools=(c,e)=>c.inv.some(i=>i.id.endsWith(TOOLS[e]||'~'));
const yes=(ok,t)=>`<li>${ok?'✓':'✗'} ${t}</li>`;
// One crafting roll (Rules p. 36, r-crafting-rolls; crits and dooms, r-crits-and-dooms): the player rolls 2d10 + M (+4 for Effort
// or a double edge, +2 Crafty connection) and says the total; the Ref enters it with crit or doom (dice.js dqCraftItem). Points:
// the total, minimum 1; a doom gives 0; a crit gives another roll for the same item.
// Rules p. 37: an unidentified magic item can be learned by the Identify Item rest activity, by a test (once per item), or by using it blind.
const held=i=>i.sec==='hand'||i.sec==='magic';
const isConsumable=r=>r.cat==='alchemy'||/potion/i.test(r.name)||/Useless/.test(r.ud?.[1]||'');
function idTestHTML(i){
  return `<div class="box"><h3 class="sec-h sm" style="margin-top:0">Find out what it is</h3>
   <p class="small" style="margin:0 0 .5rem">${held(i)?'You’re holding it, so you can:':'Hold it first — move it to a hand (or a magic slot if it’s wearable). Then you can:'}</p>
   <div class="grid2">
    <div><b>Study</b> <span class="small muted">a test, once per item</span>${prHTML([[1,'It goes off in a harmful way the Ref decides.'],[2,'You learn nothing.'],[3,'You learn everything about it.']],{head:'2d10 + M',mod:ME.ch.M})}
     ${idStudyHTML(i)}</div>
    <div><b>Use it</b> <span class="small muted">activate it blind</span><p class="small" style="margin:.4rem 0">Drink it, wear it, swing it, read it — and see what happens. You learn what it is, but a consumable is used up and the effect could be bad.</p>
     <button class="btn sm" data-action="id-use" data-uid="${i.uid}" ${held(i)?'':'disabled'}>Use it</button></div></div>
   <p class="small muted" style="margin:.5rem 0 0">Or pick it for the Identify Item activity on your next rest — that always works.</p></div>`}
// Study's controls: ask (a table: the Ref taps the tier) or the tiers on this device (no Ref); then the result as a pill
function idStudyHTML(i){const c=ME,r=c.sres?.uid===i.uid?c.sres:null,ask=c.sask?.uid===i.uid&&!i.tried;
  if(i.tried)return `<div class="dq-prow"><span class="t">Studied</span>${r?dqPill(r.t===1?'bad':'good',`Tier ${r.t}`):dqPill('good','done')}</div>`;
  if(dqTable())return ask?`<div class="dq-prow"><span class="t">2d10 ${fmt(c.ch.M).replace(/^([+−])/,'$1 ')}</span>${dqPill('wait','tell the Ref')}<button class="btn sm ghost" data-action="id-study" data-uid="${i.uid}">Take back</button></div>`
    :`<button class="btn sm" data-action="id-study" data-uid="${i.uid}" ${held(i)?'':'disabled'}>Study it</button>`;
  return S.dq.study===i.uid?`<div class="dq-tiers" role="group" aria-label="Your Study tier">${[1,2,3].map(t=>`<button type="button" class="btn" data-action="id-tier" data-uid="${i.uid}" data-v="${t}">Tier ${t}</button>`).join('')}</div>`
    :`<button class="btn sm" data-action="id-study" data-uid="${i.uid}" ${held(i)?'':'disabled'}>Study it</button>`}
function idResult(title,body){const dl=$('#dlg');dl.innerHTML=`<form method="dialog"><h2 style="margin-bottom:.5rem">${title}</h2>${body}<div class="row" style="justify-content:flex-end;margin-top:1rem"><button class="btn primary">OK</button></div></form>`;dl.onclick=null;dl.onclose=null;dl.showModal()}
// On a journey the rest belongs to the Ref's camp: the place is the camp's, it is finished only at camp, and the night step does the Miasma roll.
const campRest=()=>S.phase==='travel'&&typeof jStep==='function'&&jStep()!=='off';
const restCampOpen=()=>jStep()==='camp'&&!!S.journey.camp&&(!jRestAt().check||S.journey.camp.ready===true);
// Resting in a village (owner, 2026-11-16, from the rules): indoors, out of the Miasma (Rules p27: it can't enter enclosed indoor
// areas), so there is no place to choose; no rest encounter check (Rules p15: only in a dungeon or the wilderness), so no Seclude
// Camp, whose only effect is EN −1; no Harvest either (owner, 2026-11-16: no monster corpses in a village). Food is covered at home;
// away from home the crow rests at the inn, all-inclusive (owner, 2026-11-16; Character p59: 5 gc, a bed and a day's food): the
// night is paid as the rest is finished, unless it was paid in Services. A village without an inn, or a crow who can't pay the
// night (under 5 gc, owner 2026-11-16), leaves the crow sheltered in the village, out of the Miasma, on its own ration.
// Gambling is the inn's own rest activity (Inn: Gambling); its bets are on the inn's card in Services.
// at: 'home' | 'inn' | 'shelter'; poor: there is an inn but the crow can't pay it. null outside a village and on the Ref's Journey camp.
function restVillage(c=ME){if(campRest())return null;const v=vHere();if(!v)return null;const home=!!v.home,inn=!!lvlOf(v,'inn'),paid=!home&&!!c?.innFood,
  poor=!home&&inn&&!paid&&!!c&&coinsOf(c)<INN_NIGHT;
  return {v,home,inn,paid,poor,at:home?'home':inn&&!poor?'inn':'shelter'}}
const INN_NIGHT=5;
const RACT_GAMBLE=['gamble','Gamble at the inn','','Bet in the inn’s common room: Over/Under 7 or Guess the Number.'];
// The rest activities that make sense where the crow rests, the one list for the Rest tab and the Journey's camp: all of them on
// the road and in a dungeon; in a village (rv: restVillage(), or {inn} from the camp) no Seclude Camp, no Harvest, and Gamble
// where there is an inn.
const RACT_TOWN=['seclude','harvest'];
// Alteration Stone (trait, Alteration tree): “as a rest activity, you can create an alteration stone … it disappears if you create a
// new one”; its card: “choose one benefit when you make the stone”. The pick is the instance's `ben` (owner, 2026-11-22).
const RACT_STONE=['stone','Make an alteration stone','alteration-stone','Pick its benefit. A stone you made before disappears.'];
const STONE_BEN={food:['No food or drink','You don’t need to eat or drink to live.'],air:['No air','You don’t need to breathe to live.'],light:['Light 5/5','The stone sheds light 5/5.']};
const hasStoneTrait=c=>!!c?.traits?.some(t=>t.n==='Alteration Stone');
function restActs(rv=restVillage(),c){const l=rv?[...RACT.filter(a=>!RACT_TOWN.includes(a[0])),...(rv.inn?[RACT_GAMBLE]:[])]:RACT;return hasStoneTrait(c)?[...l,RACT_STONE]:l}
// "You choose which wound you lose" (Rules: Rest). Starvation and exhaustion wounds go by themselves when the crow eats and
// rests, so the choice is among the others. S.rest.wounds is this device's pick (never in snap()); the default is the highest slots.
const restWoundsCan=c=>[...c.wounds].filter(w=>!['starvation','exhaustion'].includes((c.woundType||{})[w])).sort((a,b)=>a-b);
function restWoundsPick(c,lazy){const can=restWoundsCan(c),n=Math.min(JourneyRules.restWoundsN(lazy),can.length);
  const sel=(rqOf(c)?.wounds||[]).filter(w=>can.includes(w)).slice(-n);for(const w of JourneyRules.restWoundsDefault(can,n))if(sel.length<n&&!sel.includes(w))sel.push(w);return sel}
function restWoundsHTML(c,lazy){const can=restWoundsCan(c);if(!can.length)return '';const n=Math.min(JourneyRules.restWoundsN(lazy),can.length),sel=restWoundsPick(c,lazy),o=occ(c,'pack');
  return `<div class="rwounds" role="group" aria-label="Wound to lose"><p class="small" style="margin:0 0 .35rem"><b>Which wound${n>1?'s':''} do you lose?</b> <span class="muted">${n>1?`tap ${n}`:can.length>1?'tap one':'your only one'}${lazy?' — Lazy':''}</span></p>
   <div class="optgrid sm">${can.map(w=>{const it=o[w]?.i;return `<button class="opt" data-action="rwound" data-v="${w}" aria-pressed="${sel.includes(w)}"><b>Backpack ${w+1}</b><span class="small muted">${sel.includes(w)?'✓ heals · ':''}${it?`under ${esc(nm(it))} · −1 Speed`:'empty slot'}</span></button>`}).join('')}</div></div>`}
// What each rest activity asks for (the Rest tab and the Journey's camp share it): what it is for, the dice the player rolls.
function restDetail(c,R){const unids=c.inv.filter(i=>i.unid),armor=c.inv.filter(i=>adBase(c,i)&&adOf(c,i)<adBase(c,i));
  c.crafts??=[];const proj=c.crafts.find(x=>x.id===R.pick);const it=R.act==='craft'&&R.pick&&IT[R.pick];
  const radio=(k,l,sub)=>`<button class="opt" data-action="rpick" data-v="${k}" aria-pressed="${R.pick===k}"><b>${esc(l)}</b>${sub?`<span class="small muted">${esc(sub)}</span>`:''}</button>`;
  const detail={
    identify:()=>unids.length?`<div class="optgrid">${unids.map(i=>radio(String(i.uid),nm(i),'looks like '+kindOf(IT[i.id]))).join('')}</div><p class="small muted">You learn all its properties when you finish the rest.</p>`:'<p class="muted">You carry no unidentified magic items.</p>',
    repair:()=>armor.length?`<div class="optgrid">${armor.map(i=>radio(String(i.uid),IT[i.id].name,`AD ${adOf(c,i)} / ${adBase(c,i)}`)).join('')}</div>`:'<p class="muted">Your armor, shields and parrying weapons are at full AD.</p>',
    craft:()=>`${c.crafts.length?`<h3 class="sec-h sm">Your projects</h3><div class="optgrid">${c.crafts.map(x=>radio(x.id,IT[x.id].name,`${x.pts} / ${IT[x.id].craft.goal} crafting points`)).join('')}</div>`:''}
      ${craftListHTML(c,R)}
      ${it?`<div class="box craftpick" style="margin-top:.75rem">${cardHTML(it,null,{full:true})}
        <div><b>${esc(it.name)}</b> — goal ${it.craft.goal} crafting points${proj?`, ${proj.pts} done`:''}
        <ul class="small" style="list-style:none;padding:0;margin:.4rem 0">${it.craft.yield?`<li>One project makes ${it.craft.yield}.</li>`:''}${yes(hasExp(c,it.craft.exp),`${esc(it.craft.exp)} expertise`)}${yes(c.ch.M>=it.craft.cx,`Mind ${it.craft.cx}+ (complexity) — you have ${fmt(c.ch.M)}`)}${TOOLS[it.craft.exp]?yes(hasTools(c,it.craft.exp),`${esc(IT[TOOLS[it.craft.exp]]?.name||it.craft.exp+' tools')} in your inventory`):''}<li>□ Materials: ${matLinks(it.craft.mats)}${proj?' (already used up)':''}</li></ul>
        <label class="check small"><input type="checkbox" data-action="rplus" ${R.plus?'checked':''}> Spend 1 Effort or have a double edge <span class="muted">+4</span></label>
        ${c.npcType==='Crafty'?`<label class="check small"><input type="checkbox" data-action="rcrafty" ${R.crafty?'checked':''}> Crafting in the village with my Crafty connection <span class="muted">+2</span></label>`:''}
        <p class="small muted" style="margin:.4rem 0 0">Roll 2d10 ${fmt(c.ch.M+(R.plus?4:0)+(R.crafty&&c.npcType==='Crafty'?2:0)).replace(/^([+−])/,'$1 ')} and say your total.</p></div></div>`:''}`,
    harvest:()=>`<div class="row"><label>Part <select data-action="rpart">${D.items.filter(x=>x.id.endsWith('-part')).map(x=>`<option value="${x.id}" ${R.part===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label>Corpse size <select data-action="rsize">${[[1,'Medium or smaller — 1d6'],[2,'Large — 2d6'],[3,'Huge — 3d6'],[4,'Holy Shit — 4d6']].map(([n,l])=>`<option value="${n}" ${R.size===n?'selected':''}>${l}</option>`).join('')}</select></label></div>
      <p class="small muted" style="margin:.5rem 0 0">Roll ${R.size}d6 and say the total. The corpse is destroyed.</p>`,
    tend:()=>{const l=PLAY().filter(x=>x!==c&&x.wounds.size>=2);return l.length?`<div class="optgrid">${l.map(x=>radio(x.name,x.name,`${x.wounds.size} wounds`)).join('')}</div>`:'<p class="muted">No one else here has 2 or more wounds.</p>'},
    lore:()=>{const books=c.inv.filter(i=>LORE_BOOKS[i.id]);if(!books.length)return '<p class="muted">You carry no lore book.</p>';
      return `<div class="optgrid sm">${books.map(i=>radio(String(i.uid),nm(i),`+${LORE_BOOKS[i.id]} Effort for its expertise`)).join('')}</div>
      ${books.find(i=>String(i.uid)===R.pick)?.topic?'':`<label class="fld" style="margin-top:.6rem"><b>The book is about</b><select data-action="rlore">${LORE_EXP.map(e=>`<option ${R.loreExp===e?'selected':''}>${e}</option>`).join('')}</select></label>`}`},
    stone:()=>`<div class="optgrid sm">${Object.entries(STONE_BEN).map(([k,[l,t]])=>radio(k,l,t)).join('')}</div>`,
    sleep:()=>'',seclude:()=>'<p class="small muted">Tell the Ref — it lowers the EN for this rest by 1. Only one person per group.</p>',
    gamble:()=>dqBetFormHTML(c)};
  return detail}
// What finishing the rest gives, as the rules say it (rfinish applies it)
const restGainsHTML=(c,R,lazy,where=R.where)=>`<ul class="small rgains"><li>Stamina back to ${stMax(c)}</li><li>Lose ${lazy?2:1} wound${lazy?'s':''}${c.wounds.size?'':' (you have none)'}${lazy?' — Lazy':''}${c.wounds.size&&!restWoundsCan(c).length?' <span class="muted">(starvation and exhaustion wounds go when you eat)</span>':''}</li><li>${where==='miasma'?'No Effort back in the Miasma, then the Miasma roll':where==='clear'?`Effort back to ${effMax(c)}; cruelty and Miasma effects end`:'Effort depends on where you rested'}</li><li>Items with “Rest” UD refill</li></ul>`;
// The rest itself, for one crow (Rules: Rest): food, then Stamina, wounds, Effort and cruelty by place, the activity, XP, pets, UD.
// R: {where, act, pick, part, size, loreExp, wounds, food ('own'|'inn'|'home'|'none'), cr (crafting points of each roll), hv (parts)}.
// No ME and no device state: the Ref's device finishes everyone's rest with it (dice.js dqFinish); a player without a Ref their own.
// A hungry rest owes a starvation wound: dqOwe puts it on the crow and the device that plays the crow marks it.
// ME is the crow while it runs: addCount and the board's placement work on ME (the Ref's device finishes everyone's rest)
function restApply(c,R){const was=ME;ME=c;try{return restApplyOf(c,R)}finally{ME=was}}
function restApplyOf(c,R){const log=[],rv=restVillage(c);
  if(rv){R.where='clear';if(R.act&&!restActs(rv,c).some(a=>a[0]===R.act))R.act=null;if(rv.at==='inn'&&R.food!=='none')R.food='inn';if(rv.at==='home')R.food='home'}
  if(R.food==='inn'&&!c.innFood){if(coinsOf(c)>=INN_NIGHT){payCoins(c,INN_NIGHT);c.innFood=true;log.push(`Paid ${INN_NIGHT} gc for a night at the inn`)}else{R.food=dqRations(c)?'own':'none';log.push(`Not enough coins for the inn (${INN_NIGHT} gc)`)}}
  const need=c.miasma.some(x=>x.n===MI_NAMES[3])?2:1,lazy=c.miasma.some(x=>x.n===MI_NAMES[9]),rats=c.inv.filter(i=>i.id==='ration'&&!i.unid),eatN=k=>{for(const r of [...rats]){if(k<=0)break;const t=Math.min(k,r.count);addCount(r,-t);k-=t}}; // rations may sit in several stacks
  const home=R.food==='home'&&R.where==='clear',food=JourneyRules.restFood({need,home,innFood:R.food==='inn'&&c.innFood,ration:R.food!=='none',have:rats.reduce((a,r)=>a+r.count,0)}),own=food.own;c.innFood=false;
  const ate=food.ate;
  if(ate){if(food.eat>0)eatN(food.eat);log.push(food.kind==='home'?'Fed at home':food.kind==='inn'?`Ate at the inn${own>0?` and ${own} ration${own>1?'s':''}`:''}`:`Ate ${need} ration${need>1?'s':''}`)}
  else if(food.kind==='short'){if(food.eat>0)eatN(food.eat);log.push(food.eat>0?'<b>Ravenous: 1 ration isn’t enough</b> — no benefits from this rest':'<b>Ravenous: the inn’s meal isn’t enough</b> — no benefits from this rest')}
  else{dqOwe(c,1,'starvation','No food');log.push('<b>No food</b> — no benefits from this rest; mark 1 starvation wound (it goes when you eat)')}
  // a rest only counts if you ate what you needed (Rules p. 15); journey-rules.js restBody says what it restores
  if(ate){const can=restWoundsCan(c),n=Math.min(JourneyRules.restWoundsN(lazy),can.length),pick=(R.wounds||[]).filter(w=>can.includes(w)).slice(-n);clearWounds(c,'starvation');clearWounds(c,'exhaustion');const body=JourneyRules.restBody(c,{where:R.where,lazy,stMax:stMax(c),effMax:effMax(c),rows:MI_ROWS(),pick});
    c.stamina=body.stamina;body.removed.forEach((w,k)=>{c.wounds.delete(w);if(c.woundType)delete c.woundType[w];log.push(`Lost the wound on backpack slot ${w+1}`+(lazy&&k?' (Lazy)':''))});
    if(body.effort!=null)c.effort=body.effort;if(body.cleared){c.cruelty=body.cruelty;c.miasma=body.miasma;log.push('Out of the Miasma: cruelty 0, Miasma effects ended')}}
  c.effortBonus=0;c.lore=null; // Good Night's Rest and lore book bonuses end when you finish a rest
  if(!ate&&c.xpBank)log.push(`+${c.xpBank} XP waits for a rest where you eat`);
  if(ate&&c.xpBank){c.txp+=c.xpBank;log.push(`+${c.xpBank} XP counted (TXP ${c.txp})`);c.xpBank=0;if(pendingLevels(c).length)log.push('<b>Level up!</b> Make your choices on the Sheet.');c.stamina=stMax(c);if(R.where==='clear')c.effort=effMax(c)}
  for(const p of c.pets||[]){const need=FEED[MON[p.mon].st.Size]||1,f=c.inv.find(i=>i.id==='animal-feed');
    if(R.where==='miasma'){p.st=petMax(p);if(p.wounds.length)p.wounds.pop();log.push(`${esc(p.name)} forages and rests`)}
    else if(f&&f.count>=need){addCount(f,-need);p.st=petMax(p);if(p.wounds.length)p.wounds.pop();log.push(`${esc(p.name)} ate ${need} animal feed and rests`)}
    else log.push(`<b>${esc(p.name)} has no feed</b> — no rest for them; in a dungeon they starve`)}
  c.rests=(c.rests||0)+1;c.lastRest=R.where;
  c.inv.forEach(i=>{const it=IT[i.id];if(it.ud&&/Rest/.test(it.ud[1]))i.ud=it.ud[0]});
  const pick=String(R.pick??''),inst=c.inv.find(x=>String(x.uid)===pick);
  if(R.act==='identify'&&inst){inst.unid=false;log.push(`Identified: <b>${esc(IT[inst.id].name)}</b>`)}
  if(R.act==='repair'&&inst){inst.ad=adBase(c,inst);log.push(`${esc(IT[inst.id].name)} is back to ${inst.ad} AD`)}
  if(R.act==='lore'&&inst){c.lore={exp:inst.topic||R.loreExp||LORE_EXP[0],n:LORE_BOOKS[inst.id],book:IT[inst.id].name};log.push(`Studied ${esc(c.lore.book)}: ${esc(c.lore.exp)} and +${c.lore.n} Effort for it until your next rest`)}
  if(ate&&R.act==='sleep'){c.effortBonus=1;log.push('+1 bonus Effort until you use it or finish your next rest')}
  if(R.act==='harvest'&&R.hv>0&&IT[R.part]){autoPlace(c,R.part,R.hv);log.push(`Harvested ${R.hv} × ${esc(IT[R.part].name)} (${R.size}d6)`)}
  if(R.act==='tend'){const x=PARTY.find(p=>p.name===R.pick);const w2=x&&[...x.wounds].sort((a,b)=>b-a)[0];if(w2!=null){x.wounds.delete(w2);log.push(`${esc(x.name)} loses 1 extra wound`)}}
  if(R.act==='seclude')log.push('Camp secluded (EN −1 for this rest)');
  if(R.act==='stone'&&STONE_BEN[R.pick]){for(let k=c.inv.length-1;k>=0;k--)if(c.inv[k].id==='alteration-stone')c.inv.splice(k,1);autoPlace(c,'alteration-stone',1,{ben:R.pick});log.push(`Made an alteration stone: ${esc(STONE_BEN[R.pick][0])}`)}
  if(R.act==='gamble')log.push('Gambled at the inn');
  if(R.act==='craft'&&IT[R.pick]?.craft){c.crafts??=[];const it=IT[R.pick];let pj=c.crafts.find(x=>x.id===it.id);if(!pj){pj={id:it.id,pts:0};c.crafts.push(pj)}
    const rolls=R.cr||[];pj.pts+=rolls.reduce((a,b)=>a+b,0);log.push(`Crafting roll${rolls.length>1?'s (crit!)':''}: ${rolls.join(' + ')||0} → ${pj.pts} / ${it.craft.goal} points`);
    let made=0;if(pj.pts>=it.craft.goal){pj.pts-=it.craft.goal;made=1}
    if(made){made*=it.craft.yield||1;autoPlace(c,it.id,made);log.push(`<b>Finished: ${esc(it.name)}${made>1?' ×'+made:''}</b>${pj.pts?` — ${pj.pts} spare points carry over if you gather materials for another`:''}`);if(!pj.pts)c.crafts=c.crafts.filter(x=>x!==pj)}}
  return {log,ate}}
// The player's Rest screen (owner, 2026-11-21): the activity in one container (chips, a rule, its text and controls); where, food
// and what the rest gives; “Your rest” — what to roll and one pill per line. At a table the Ref enters what the player says and
// finishes everyone's rest (dice.js); without a Ref the same compact lines take the values here and Finish is on this device.
SCREENS.rest=()=>{if(ME&&crowDead(ME))return deadNote(ME);
  const c=ME,camp=campRest();
  if(camp)return `${dqLogHTML(c)}<div class="box"><p style="margin:0 0 .6rem">On a journey you rest at the Ref’s camp: your activity, food and what to roll are on the Journey’s camp step.</p><button class="btn primary" data-action="tab" data-v="journey">The Journey →</button></div>`;
  const ctx=dqRest(),table=dqTable(),R=dqForm(c),rv=restVillage(c),acts=restActs(rv,c),own=!table&&!ctx;
  if(R.act&&!acts.some(a=>a[0]===R.act)){dqMine(c,{act:null,pick:null});R.act=null} // an activity this place doesn't offer (a Harvest chosen before the village) is dropped
  const where=rv?'clear':ctx?ctx.where:rqOf(c)?.where||null;
  const need=c.miasma.some(x=>x.n===MI_NAMES[3])?2:1,lazy=c.miasma.some(x=>x.n===MI_NAMES[9]),fed=rv?(rv.at==='home'?need:rv.at==='inn'?1:0):0,mine=need-fed;
  const vplace=rv&&`<p style="margin:0 0 .4rem"><b>Where:</b> ${rv.at==='home'?`at home in ${esc(rv.v.name)}`:rv.at==='inn'?`at the inn in ${esc(rv.v.name)}`:`in ${esc(rv.v.name)}, sheltered`} <span class="muted">· indoors, no Miasma</span></p>
   <p class="small rv-food" style="margin:.2rem 0">${rv.at==='home'?'At home your food is covered.':rv.at==='inn'?`${rv.paid?'Your night at the inn is paid: a bed and a day’s food':`A night at the inn: a bed and a day’s food for <b>${INN_NIGHT} gc</b>, paid as the rest ends`}${mine>0?'. Ravenous: you need 1 ration more':''}.`:`${rv.poor?'You can’t pay the inn':'No inn here'}: you rest sheltered and eat your own ration${need>1?'s (Ravenous: 2)':''}.${rv.poor?` <span class="muted">The night costs ${INN_NIGHT} gc; you carry ${coinsOf(c)}.</span>`:''}`}</p>`;
  const wherep=rv?vplace:ctx?.kind==='dungeon'?`<p style="margin:0 0 .4rem"><b>Where:</b> ${where==='miasma'?'in the dungeon, open to the Miasma':where==='clear'?'in the dungeon, closed off from the Miasma':'<span class="dq-st wait">the Ref says where</span>'}</p>`
    :own?`<p style="margin:0 0 .4rem"><b>Where did you rest?</b></p><div class="rwhere">${[['miasma','Outdoors','in the Miasma',''],['clear','Sheltered','no Miasma','village, ruin, stone or metal walls']].map(([k,l,sub,t])=>`<button class="opt" data-action="rwhere" data-v="${k}" aria-pressed="${where===k}" ${t?`title="${t}"`:''}><b>${l}</b><span class="small muted">${sub}</span></button>`).join('')}</div>`
    :`<p style="margin:0 0 .4rem"><b>Where:</b> <span class="dq-st wait">the Ref begins the rest</span></p>`;
  const foodp=rv?'':`<p style="margin:.6rem 0 .3rem"><b>Food</b> <span class="muted small">${need} ration${need>1?'s':''} · you carry ${dqRations(c)}</span></p>${dqFoodBlockHTML(c,ctx||{kind:'own'})}`;
  const innDue=rv?.at==='inn'&&!rv.paid;
  return `${dqLogHTML(c)}<p class="muted" style="margin:0 0 1rem">6 uninterrupted hours in one place, 4 of them asleep, and ${rv&&!mine?'a day’s food':'1 ration'}.</p>
  <div class="cols restcols"><div class="stack">
   <div class="box"><h2 class="sec-h">1 · <a class="term" href="#rule/r-rest-activities" data-term="r-rest-activities" style="color:inherit">Rest activity</a> <span class="muted">one per rest</span></h2>${dqActBlockHTML(c,acts)}</div>
  </div>
  <div class="box restfin"><h2 class="sec-h">2 · What you get</h2>${wherep}${foodp}
   ${restGainsHTML(c,R,lazy,where)}${restWoundsHTML(c,lazy)}
   ${dqMyRestHTML(c,ctx||(own?dqOwnCtx(c):null),{h:'<h3 class="sec-h sm">Your rest</h3>',wait:table&&!ctx?'The Ref begins the rest':''})}
   ${table?'':`<div class="row" style="margin-top:.75rem">${innDue?`<button class="btn primary" data-action="rfinish">Pay ${INN_NIGHT} gc and rest at the inn</button>`:'<button class="btn primary" data-action="rfinish">Finish the rest</button>'}</div>`}</div></div>`;
};
// What this crow can craft right now: has the expertise and Mind ≥ complexity. Grouped by expertise, with the tools check per group.
function craftListHTML(c,R){
  const can=D.items.filter(i=>i.craft&&hasExp(c,i.craft.exp)&&c.ch.M>=i.craft.cx&&!(c.crafts||[]).some(x=>x.id===i.id));
  const near=['Alchemy','Blacksmithing','Enchanting'].filter(e=>hasExp(c,e));
  if(!near.length)return `<h3 class="sec-h sm">What you can craft</h3><p class="small muted">Nothing yet: crafting needs the Alchemy, Blacksmithing or Enchanting expertise. You get more expertises as you level up.</p>`;
  const groups=near.map(e=>[e,can.filter(i=>i.craft.exp===e).sort((a,b)=>a.craft.cx-b.craft.cx||a.name.localeCompare(b.name)),D.items.filter(i=>i.craft&&i.craft.exp===e&&c.ch.M<i.craft.cx).length]);
  return `<h3 class="sec-h sm">What you can craft <span class="muted">${can.length} item${can.length===1?'':'s'} · your Mind ${fmt(c.ch.M)}</span></h3>
   <input type="search" id="craftq" placeholder="Filter…" aria-label="Filter craftable items" style="width:100%;margin-bottom:.5rem">
   <div class="craftlist">${groups.map(([e,l,hard])=>`<h4 class="bh">${e} <span class="small muted">${TOOLS[e]?(hasTools(c,e)?'✓ you have the tools':'✗ needs '+esc(IT[TOOLS[e]]?.name||'tools')):''}${hard?` · ${hard} more need higher Mind`:''}</span></h4>
     <ul class="mlist">${l.map(i=>`<li data-q="${esc(i.name.toLowerCase())}"><button data-action="rpick" data-v="${i.id}" aria-current="${R.pick===i.id}">${esc(i.name)}<span>cx ${i.craft.cx} · goal ${i.craft.goal} · ${esc(i.craft.mats)}</span></button></li>`).join('')||'<li class="small muted">Nothing at your Mind.</li>'}</ul>`).join('')}</div>`}
document.addEventListener('input',e=>{if(e.target.id==='buyf'){S.buy.f=e.target.value;buyKeepPick();const pos=e.target.selectionStart;render();const n=$('#buyf');n.focus();n.setSelectionRange(pos,pos);return}if(e.target.id==='craftq'){const q=e.target.value.toLowerCase();$$('.craftlist li[data-q]').forEach(li=>li.hidden=!li.dataset.q.includes(q))}});

/* ================= PLAYER: market ================= */
const salePct=p=>p<=-10?30:p<=-6?40:p<=-2?45:p<=1?50:p<=5?55:p<=9?60:70;
/* ================= Villages: institutions, stock, prices (Character: The Village, Trade, Institutions) ================= */
const ORD=n=>['1st','2nd','3rd','4th','5th','6th'][n-1]||n+'th';
// adv[i] = price to reach level i+1 (adv[0] is the founding level, so it's 0); val[i] = what that level gives
const INST={
  alchemist:{n:'Alchemist',rule:'c-institutions',found:500,adv:[0,1000,2000,4000],col:'Sells up to complexity',val:[1,2,3,4]},
  auction:{n:'Auction House',rule:'c-auction-house',found:250,adv:[0,500,1000,2000,4000],col:'Availability',val:['20%','30%','40%','50%','60%']},
  barracks:{n:'Barracks',rule:'c-barracks',found:500,adv:[0,1000,2000,4000,8000],col:'Hirelings up to power',val:[2,4,6,8,10]},
  beacon:{n:'Beacon',rule:'c-beacon',found:1000,adv:[0,2000,4000,8000,16000],col:'Fire radius',val:['1 hex','2 hexes','3 hexes','4 hexes','5 hexes']},
  blacksmith:{n:'Blacksmith',rule:'c-institutions',found:500,adv:[0,1000,2000,4000],col:'Sells up to complexity',val:[1,2,3,4]},
  bookseller:{n:'Bookseller',rule:'c-bookseller',found:500,adv:[0,1000,2000,4000,6000,12000],col:'Spellbooks up to rank',val:[0,1,2,3,4,5]},
  guild:{n:'Crow Guild House',rule:'c-crow-guild-house',found:125,adv:[0,250,500,1000,2000],col:'Uses per cycle',val:[1,2,3,4,5]},
  crypt:{n:'Crypt',rule:'c-crypt',found:125,adv:[0,250,500,1000,2000],col:'Boon strength',val:[1,2,3,4,5]},
  enchanter:{n:'Enchanter',rule:'c-enchanter',found:500,adv:[0,1000,2000,4000],col:'Sells up to complexity',val:[1,2,3,4]},
  store:{n:'General Store',rule:'c-general-store',found:500,adv:[0,1000,2000],col:'Quality sold',val:['standard','fine','masterwork']},
  inn:{n:'Inn',rule:'c-inn',found:125,adv:[0,250,500,1000,2000],col:'Max bet (gc, + Prosperity)',val:[15,25,35,45,60]},
  stables:{n:'Stables',rule:'c-stables',found:500,adv:[0,1000,2000,4000,8000],col:'Pets up to power',val:[2,4,6,8,10]},
  temple:{n:'Temple',rule:'c-temple',found:250,adv:[0,500,1000,2000,4000],col:'Service level',val:[1,2,3,4,5]},
};
const HOME_START=['blacksmith','crypt','store','inn','temple'];
// the two villages in the Dungeons booklet (p. 2)
const V_PRESETS={
  gadwick:{name:'Gadwick',note:'In the towers, dungeon and crypts of Castle Gadwick. Crypt boons: Greed (1), Rescue (1), Vitality (1).',inst:{alchemist:[1,'Brune'],auction:[1,'Lili'],barracks:[2,'Cormal'],blacksmith:[2,'Deirdre'],bookseller:[1,'Rion'],enchanter:[1,'Isaac'],store:[3,'Sorcha'],stables:[1,'Anna'],temple:[1,'Mackle'],inn:[1,'Duna'],crypt:[1,'Oda']}},
  liston:{name:'Liston',note:'Earthen halls dug by the monks of Liston Abbey. Crypt boons: Flight (1), Knowledge (1), Swiftness (1), Vitality (2).',inst:{alchemist:[3,'Cuthbert'],auction:[1,'Edith'],barracks:[1,'Piers'],blacksmith:[1,'Alfred'],bookseller:[2,'Gertrude'],guild:[1,'Jackdaw'],enchanter:[1,'Wulfric'],store:[2,'Winifred'],temple:[3,'Dreddard'],inn:[1,'Ethel'],crypt:[2,'Clara']}},
};
const VILLAGES=JSON.parse(store.get('villages')||'[]');
S.here=store.get('here')||'';
const saveVillages=()=>{store.set('villages',JSON.stringify(VILLAGES));store.set('here',S.here||'')};
const vHere=()=>VILLAGES.find(v=>v.id===S.here)||null;
// The campaign's other places (places.js): points of interest and dungeons, {id, label, kind:'poi'|'dungeon', fam, note, day}.
// A settlement is a village and keeps its sheet in VILLAGES; the Ref's Places screen lists both.
const PLACES=JSON.parse(store.get('places')||'[]');
const savePlaces=()=>store.set('places',JSON.stringify(PLACES));
function mkVillage(o={}){const v={id:'v'+Date.now().toString(36)+d(999),name:o.name||'New village',home:!!o.home,prosperity:o.prosperity??0,day:1,cycle:1,inst:{},fund:{},pending:[],spent:0,raised:false,saleMod:0,events:[],auction:{},note:o.note||'',q:{}};
  for(const [k,[l,s]] of Object.entries(o.inst||{}))v.inst[k]={lvl:l,steward:s||'',mod:0,closed:false};VILLAGES.push(v);saveVillages();return v}
// level this cycle: events can lower or raise it, or close the place; at 5th level and Prosperity 10 the temple and crypt count as 6th
function lvlOf(v,k){const x=v?.inst[k];if(!x||!x.lvl||x.closed)return 0;const l=Math.max(0,x.lvl+(x.mod||0));return (k==='temple'||k==='crypt')&&l>=5&&v.prosperity>=10?6:l}
const maxLvl=k=>INST[k].adv.length;
const isPart=it=>it.cat==='material'&&/Part$/.test(it.name),isLog=it=>it.cat==='material'&&/Log$/.test(it.name),isBar=it=>it.cat==='material'&&/Bar$/.test(it.name);
const quality=it=>/^Masterwork /.test(it.name)?3:/^Fine /.test(it.name)?2:1;
// Which institutions sell a card, and from what level
function sellersOf(it){const ex=it.craft?.exp,cx=it.craft?.cx||1,out=[];
  if(it.cat==='spellbook')out.push(['bookseller',(it.rank??0)+1]);
  if(/lore-book$/.test(it.id))out.push(['bookseller',[1,3,5][quality(it)-1]]);
  if(ex==='Alchemy')out.push(['alchemist',cx]);if(ex==='Blacksmithing')out.push(['blacksmith',cx]);if(ex==='Enchanting')out.push(['enchanter',cx]);
  if(/Alchemist’s Tools/.test(it.name))out.push(['alchemist',1]);if(/Blacksmith’s Tools/.test(it.name))out.push(['blacksmith',1]);if(/Enchanter’s Tools/.test(it.name))out.push(['enchanter',1]);
  if(['gear','ammo'].includes(it.cat)&&!it.magic&&!/lore-book$/.test(it.id))out.push(['store',quality(it)]);
  if(it.id==='animal-feed')out.push(['stables',1]);
  return out}
// Which institutions buy a card
function buyersOf(it){const ex=it.craft?.exp,out=new Set();
  if(ex==='Alchemy'||/Alchemist’s Tools/.test(it.name)||isPart(it))out.add('alchemist');
  if(ex==='Blacksmithing'||/Blacksmith’s Tools/.test(it.name)||isLog(it)||isBar(it))out.add('blacksmith');
  if(ex==='Enchanting'||/Enchanter’s Tools/.test(it.name)||isPart(it)||it.id==='gem')out.add('enchanter');
  if(it.cat==='spellbook'||/lore-book$/.test(it.id))out.add('bookseller');
  if((['gear','ammo'].includes(it.cat)&&!it.magic)||(it.cat==='treasure'&&it.id!=='gold-coins'))out.add('store');
  if(it.id==='animal-feed')out.add('stables');
  return [...out]}
const auctionable=it=>!['unidentified'].includes(it.cat)&&it.id!=='gold-coins'&&it.id!=='elemental-part'&&!it.id.startsWith('x-');
// what this card costs here, step by step: card price, +20% away from home, merchant extras
function priceSteps(v,it,extras=[]){const base=it.price;if(base==null)return null;const st=[[`Card price`,base]];let p=base;
  if(!v.home){p=Math.ceil(base*1.2);st.push(['Another village +20%',p])}
  for(const [l,m] of extras){p=Math.ceil(p+base*m);st.push([l,p])}return {each:p,steps:st}}
const salePctAt=v=>v.home?Math.max(0,salePct(v.prosperity)+(v.saleMod||0)):20;
// Selling one item here (Selling; Auction House “Sell Anything”). Every merchant that deals in it pays the village's sale %, so the first one
// is the best buyer; the auction house buys anything else for 1d10 × (10 + Prosperity)% — rolled once per item when it is quoted (roll) and kept
// in S.sell.ar. S.sell.to picks another buyer. Unidentified items: no buyer and no value (shown()). Used by the Village screen and dosell.
function saleOf(v,i,q=i.count||1,roll=false){const s=S.sell,it=shown(i),opts=[...buyersOf(it).filter(k=>lvlOf(v,k)),...(lvlOf(v,'auction')&&auctionable(it)?['auction']:[])];
  const k=opts.includes(s.to[i.uid])?s.to[i.uid]:opts[0]||null,tv=valNum(s.val[i.uid])??null;
  // the q pieces sold: the most valuable first (valsOf); a value typed at the sale (“Value the Ref gave”) stands for each one not valued yet
  const pv=i.unid?null:it.price!=null?Array(q).fill(it.price):valsOf(i).slice(0,q),miss=pv?pv.filter(x=>x==null).length:0,parts=pv&&(!miss||tv!=null)?pv.map(x=>x??tv):null;
  const val=parts&&parts.every(x=>x===parts[0])?parts[0]:null; // each, when the pieces sold share one value
  const g=+s.greed[i.uid]||0,base=parts?parts.reduce((a,x)=>a+x,0):null,wg=base==null?null:Math.floor(base*(1+[0,.3,.2,.1][g]));
  const pct=!k?null:k!=='auction'?salePctAt(v):s.ar[i.uid]??(roll?(s.ar[i.uid]=d(10)*(10+v.prosperity)):null);
  return {it,opts,k,val,parts,miss,typed:miss?tv:null,q,g,base,wg,pct,pay:wg==null||pct==null?null:Math.floor(wg*pct/100)}}
// extras merchants offer at higher levels (+% of the card price)
function extrasFor(v,it){const out=[],L=k=>lvlOf(v,k);
  if(it.cat==='weapon'&&L('blacksmith')>=2)out.push(['xq1','Extra Quality I: Brutal or Pummeling',.25]);
  if(it.cat==='weapon'&&L('blacksmith')>=3)out.push(['xq2','Extra Quality II: Defensive or Dismembering',.25]);
  if(it.craft?.exp==='Alchemy'&&it.ud&&/Potion|Poison/i.test(it.name)&&L('alchemist')>=2)out.push(['pp','Potent Poisons: +1 UD duration',.25]);
  if(it.craft?.exp==='Alchemy'&&/Bomb/i.test(it.name)&&L('alchemist')>=3)out.push(['bb','Big Bombs: area +1',.25]);
  if(it.craft?.exp==='Enchanting'&&it.wear&&L('enchanter')>=2)out.push(['rf','Retrofit: belt, ring, hat, mask, necklace, gloves or shoes',.1]);
  if(it.craft?.exp==='Enchanting'&&it.ud&&L('enchanter')>=3)out.push(['ll','Last Longer: +1 UD',.5]);
  return out}
// stock in this village: every card a present merchant sells at its level, plus what the auction house turned up this cycle
function stockOf(v){const out=[];for(const it of D.items){if(it.price==null||it.cat==='unidentified'||it.id.startsWith('x-'))continue;
  const s=sellersOf(it).map(([k,need])=>[k,need,lvlOf(v,k)]).filter(([k,need,l])=>l>=need);
  if(s.length)out.push({it,k:s[0][0],lvl:s[0][2]});else{const a=v.auction?.[it.id];if(a&&a.ok&&a.left>0)out.push({it,k:'auction',lvl:lvlOf(v,'auction'),a})}}
  return out.sort((a,b)=>a.it.name.localeCompare(b.it.name))}
function payCoins(c,n){for(const i of purses(c)){const k=Math.min(i.coins||0,n);i.coins=(i.coins||0)-k;n-=k}for(const i of c.inv.filter(i=>i.id==='gold-coins')){if(!n)break;const k=Math.min(i.count,n);n-=k;addCount(i,-k)}}
// buying goods from merchants counts toward the 10,000 gc that raises Prosperity this cycle
function vSpend(v,n){v.spent=(v.spent||0)+n;if(v.spent>=10000&&!v.raised){v.raised=true;v.prosperity=Math.min(10,v.prosperity+1);toast(`${v.name}: 10,000 gc spent this cycle — Prosperity +1`)}saveVillages()}

/* ---------- player side: the Village tab (was Market) ---------- */
function whereHTML(){const v=vHere();
  return `<div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:.75rem">${atTable()?`<div class="fld" style="margin:0"><b>Where you are</b><span>${v?`${esc(v.name)}${v.home?' (home)':''}`:'On the road — no village'}</span><span class="small muted">The Ref moves the party.</span></div>`:`<label class="fld" style="margin:0"><b>Where you are</b><select data-action="vhere" aria-label="Where the party is"><option value="">On the road — no village</option>${VILLAGES.map(x=>`<option value="${x.id}" ${x.id===S.here?'selected':''}>${esc(x.name)}${x.home?' (home)':''}</option>`).join('')}</select></label>`}
   ${v?`<div class="small" style="text-align:right">Prosperity <b>${fmt(v.prosperity)}</b> · merchants pay <b>${salePctAt(v)}%</b>${v.home?'':' (not your village)'} · cycle day <b>${v.day}</b> / 20<br><span class="muted">${v.home?'Your village: card prices':'Another village: +20% when you buy'}</span></div>`:''}</div>`}
// SCREENS.market (the player's Village: What do you want to do?) lives in village.js; it reuses whereHTML, buyHTML, svcHTML and investHTML.
// what the Buy search shows: names; card text only when asked (S.buy.txt); one merchant when a chip is on (S.buy.k)
function buyList(v,B,st=stockOf(v)){const q=(B.f||'').toLowerCase();return st.filter(s=>(!B.k||s.k===B.k)&&(!q||s.it.name.toLowerCase().includes(q)||B.txt&&(s.it.text||'').toLowerCase().includes(q)))}
// a new search never keeps a card it no longer shows (owner, 2026-11-16: the 11-Foot Pole stayed in the preview after a search for Sword)
function buyKeepPick(){const v=vHere(),B=S.buy;if(v&&B?.pick&&!buyList(v,B).some(s=>s.it.id===B.pick))Object.assign(B,{pick:null,q:1,x:{}})}
function buyHTML(v){const c=ME,B=S.buy??={pick:null,q:1,x:{},f:'',k:''},st=stockOf(v),have=coinsOf(c);
  const list=buyList(v,B,st);
  const sel=st.find(s=>s.it.id===B.pick),it=sel?.it;const ex=it?extrasFor(v,it).filter(([k])=>B.x[k]).map(([,l,m])=>[l,m]):[];
  let ps=it&&priceSteps(v,it,ex);if(ps&&sel.k==='auction'){ps={each:Math.ceil(ps.each*sel.a.mult),steps:[...ps.steps,[`Auction house ${sel.a.mult<1?'discount':'mark-up'} ${Math.round((sel.a.mult-1)*100)}%`,Math.ceil(ps.each*sel.a.mult)]]}}
  const tot=ps?ps.each*B.q:0,merchants=[...new Set(st.map(s=>s.k))];
  const auctionRow=lvlOf(v,'auction')?`<div class="box" style="margin-top:1rem"><h2 class="sec-h">Auction house <span class="muted">anything else: d100 ≤ ${INST.auction.val[lvlOf(v,'auction')-1]} this cycle</span></h2>
     <div class="row"><select id="auq" aria-label="Card to look for"><option value="">Look for a card</option>${D.items.filter(i=>i.price!=null&&auctionable(i)&&!st.some(s=>s.it===i)&&!(v.auction?.[i.id])).sort((a,b)=>a.name.localeCompare(b.name)).map(i=>`<option value="${i.id}">${esc(i.name)} — ${gc(i.price)}</option>`).join('')}</select><button class="btn sm" data-action="auroll">Roll d100</button></div>
     ${Object.entries(v.auction||{}).map(([id,a])=>`<div class="small" style="margin-top:.3rem">${esc(IT[id].name)}: rolled <b>${a.roll}</b> — ${a.ok?`in stock (${a.left} left), ${a.mult<1?'discount':'mark-up'} ${Math.abs(Math.round((a.mult-1)*100))}%`:'not this cycle'}</div>`).join('')}</div>`:'';
  return `<div class="cols ld"><div><div class="box"><h2 class="sec-h">In stock <span class="muted">${st.length} cards from ${merchants.length} merchant${merchants.length===1?'':'s'}</span></h2>
    <input type="search" id="buyf" value="${esc(B.f)}" placeholder="What do you need? torch, rope…" aria-label="Find an item to buy" style="width:100%">
    <label class="check small" style="margin-top:.4rem"><input type="checkbox" data-action="buytxt" ${B.txt?'checked':''}> Also search card text</label>
    <div class="chips" style="margin:.5rem 0"><button class="chip ${B.k?'':'on'}" data-action="buyk" data-v="">All</button>${merchants.map(k=>`<button class="chip ${B.k===k?'on':''}" data-action="buyk" data-v="${k}">${INST[k].n}</button>`).join('')}</div>
    <ul class="mlist" style="max-height:28rem;overflow:auto">${list.map(s=>`<li><button data-action="buypick" data-v="${s.it.id}" aria-current="${B.pick===s.it.id}">${esc(s.it.name)}<span>${INST[s.k].n} · ${gc(priceSteps(v,s.it).each)}</span></button></li>`).join('')||'<li class="muted small" style="padding:.5rem">Nothing matches.</li>'}</ul></div>${auctionRow}</div>
   <div class="box">${it?`<div class="grid2" style="align-items:start"><div>${cardHTML(it,null,{full:true,info:false})}</div><div class="stack">
     <p class="small" style="margin:0">Sold by <b>${INST[sel.k].n}</b> (${ORD(sel.lvl)} level)${it.price>=100&&sel.k!=='auction'?`. More than one: a 2nd copy is in stock on ${Math.max(10,10*v.prosperity)}%, each further one 10% less.`:''}</p>
     <label class="fld"><b>How many</b><input type="number" data-action="buyq" min="1" max="${sel.k==='auction'?sel.a.left:99}" value="${B.q}"></label>
     ${extrasFor(v,it).map(([k,l,m])=>`<label class="check small"><input type="checkbox" data-action="buyx" data-v="${k}" ${B.x[k]?'checked':''}> ${esc(l)} (+${m*100}%)</label>`).join('')}
     <table class="rt receipt">${ps.steps.map(([l,p])=>`<tr><td>${esc(l)}</td><td class="nw">${gc(p)}</td></tr>`).join('')}<tr class="tot"><td>${B.q} × ${gc(ps.each)}</td><td class="nw">${gc(tot)}</td></tr></table>
     ${tot>have?`<p class="small" style="color:var(--bad);margin:0">You carry ${gc(have)}.</p>`:''}
     <button class="btn primary" data-action="dobuy" ${tot>have?'disabled':''}>Buy for ${gc(tot)}</button>
     <p class="small muted" style="margin:0">Then tap the slot it goes to: you pay as it goes in.</p></div></div>`:'<p class="muted">Pick a card from the stock.</p>'}</div></div>`}

function svcHTML(v){const c=ME,L=k=>lvlOf(v,k),P=v.prosperity,rows=[];
  const row=(k,title,body,btn='')=>rows.push(`<div class="box"><h2 class="sec-h"><a class="term" href="#rule/${INST[k].rule}" data-term="vi-${k}" style="color:inherit">${INST[k].n}</a> <span class="muted">${ORD(L(k))} level${v.inst[k]?.steward?' · '+esc(v.inst[k].steward):''}</span></h2>${title?`<p style="margin:0 0 .4rem"><b>${title}</b></p>`:''}${body}${btn?`<div class="row" style="margin-top:.5rem">${btn}</div>`:''}</div>`);
  const armor=c.inv.filter(i=>IT[i.id].cat==='armor'&&adOf(c,i)<adBase(c,i));
  if(L('inn'))row('inn','',`${v.home?'':`<p class="small" style="margin:0 0 .4rem">A night with a day’s food: 5 gc.</p>`}<p class="small" style="margin:0 0 .4rem"><b>Gambling</b> (a rest activity)</p>${dqBetFormHTML(c)}`,
     v.home?'':'<button class="btn sm" data-action="svc" data-v="inn-night">Stay the night (5 gc)</button>');
  if(L('temple')){const l=L('temple');row('temple','',`<ul class="small" style="margin:0;padding-left:1.1rem"><li><b>Heal Wounds</b> — 100 gc: lose ${l} wound${l>1?'s':''} (you have ${c.wounds.size}).</li><li><b>Blessed Armor</b> — 200 gc: your worn armor or a shield gains ${2*l} AD until damage removes it.</li><li><b>Mount’s Prayer</b> — 100 gc: a pet’s speed +3 for ${l} day${l>1?'s':''}.</li><li><b>Greed Exchange</b> — a magic item worth 100+ gc becomes a Minor (100–500) or Major (501+) treasure; the Ref rolls, adding ${l} + Prosperity.</li><li><b>Prayer of Returning</b> — 50% of a lost item’s value; lost no more than ${5*l} days ago.</li></ul>`,
     `<button class="btn sm" data-action="svc" data-v="heal" ${c.wounds.size?'':'disabled'}>Heal wounds (100 gc)</button><button class="btn sm" data-action="svc" data-v="bless" ${armorOf(c)||adSources(c).length?'':'disabled'}>Bless armor (200 gc)</button><button class="btn sm" data-action="svc" data-v="mount" ${(c.pets||[]).length?'':'disabled'}>Mount’s prayer (100 gc)</button>`)}
  if(L('blacksmith'))row('blacksmith','',`<ul class="small" style="margin:0;padding-left:1.1rem"><li><b>Armor Repair</b> — 5 gc per suit or shield back to full AD.</li><li><b>Workshop</b> — 5 gc a day: +${L('blacksmith')} to your blacksmithing crafting rolls that day.</li>${L('blacksmith')>=4&&P>=10?'<li><b>Hone Weapon</b> — 500 gc: +1 damage until you roll a doom with it.</li>':''}</ul>`,
     `${armor.map(i=>`<button class="btn sm" data-action="svc" data-v="repair" data-uid="${i.uid}">Repair ${esc(IT[i.id].name)} (5 gc)</button>`).join('')}<button class="btn sm" data-action="svc" data-v="ws" data-k="blacksmith">Rent the workshop (5 gc)</button>`);
  if(L('alchemist')){const un=c.inv.filter(i=>i.unid&&IT[i.id].craft?.exp==='Alchemy');row('alchemist','',`<ul class="small" style="margin:0;padding-left:1.1rem"><li><b>Identify Alchemy</b> — 10 gc per item.</li><li><b>Workshop</b> — 5 gc a day: +${L('alchemist')} to alchemy crafting rolls that day.</li></ul>`,`${un.map(i=>`<button class="btn sm" data-action="svc" data-v="idalc" data-uid="${i.uid}">Identify ${esc(nm(i))} (10 gc)</button>`).join('')}<button class="btn sm" data-action="svc" data-v="ws" data-k="alchemist">Rent the workshop (5 gc)</button>`)}
  if(L('enchanter'))row('enchanter','',`<ul class="small" style="margin:0;padding-left:1.1rem"><li><b>Workshop</b> — 5 gc a day: +${L('enchanter')} to enchanting crafting rolls that day.</li>${L('enchanter')>=4&&P>=10?'<li><b>Ward</b> — 500 gc: a creature gains 10 AD until damage removes it.</li>':''}</ul>`,`<button class="btn sm" data-action="svc" data-v="ws" data-k="enchanter">Rent the workshop (5 gc)</button>`);
  if(L('barracks'))row('barracks','',`<p class="small" style="margin:0">Hirelings up to power <b>${INST.barracks.val[L('barracks')-1]}</b>.</p>`,'<button class="btn sm" data-action="tab" data-v="hirelings">Hire on the Hirelings tab →</button>');
  if(L('stables'))row('stables','',`<p class="small" style="margin:0">Pets up to power <b>${INST.stables.val[L('stables')-1]}</b>, animal feed (on the Buy tab), vehicles; vehicle repair 5 gc per Stamina.</p>`,'<button class="btn sm" data-action="tab" data-v="pets">Buy a pet on the Pets tab →</button>');
  if(L('crypt'))row('crypt','',`<p class="small" style="margin:0">Pray at a fallen crow’s grave once per cycle for their boon (strength ${L('crypt')}). ${esc(v.note||'')}</p>`);
  if(L('guild'))row('guild','',`<p class="small" style="margin:0">Crows stay free. Item Swap up to ${1000*L('guild')} gc, Shared Information and What’s in the Hex: ${L('guild')} each per cycle; Monster Catalogue.</p>`);
  if(L('beacon'))row('beacon','',`<p class="small" style="margin:0">Fire radius ${INST.beacon.val[L('beacon')-1]}: no Miasma there. Fade Out: 100 gc per hex. Fade In medallion: 500 gc.</p>`);
  if(L('bookseller')>=6&&P>=10)row('bookseller','',`<p class="small" style="margin:0">Read A Little Longer: +1 UD on a spellbook for 250 gc.</p>`);
  return rows.length?`<div class="grid2">${rows.join('')}</div>`:'<p class="muted">No services here.</p>'}

function investHTML(v){const c=ME,have=coinsOf(c);
  return `<p class="muted" style="margin-top:0">Pay together to found or upgrade an institution. It opens at its new level when the next cycle starts, and Prosperity goes up by 1 when it’s paid. You carry ${gc(have)}.</p>
  <div class="tw"><table class="rt form"><tr><th>Institution</th><th>Now</th><th>Next</th><th>Paid</th><th></th></tr>${Object.keys(INST).map(k=>{const x=v.inst[k],l=x?.lvl||0,pend=v.pending.find(p=>p.k===k),to=pend?null:l+1,price=to&&to<=maxLvl(k)?(l?INST[k].adv[l]:INST[k].found):null,f=v.fund[k];
    return `<tr><td><a class="term" href="#rule/${INST[k].rule}" data-term="vi-${k}">${INST[k].n}</a></td><td>${l?ORD(l):'<span class="muted">not founded</span>'}</td><td>${pend?`<b>${ORD(pend.to)}</b> next cycle`:price!=null?`${l?ORD(to):'found'} — ${gc(price)}`:'<span class="muted">max</span>'}</td>
     <td class="nw">${price!=null?`${gc(f?.paid||0)} / ${gc(price)}`:''}</td><td class="nw">${price!=null?`<input type="number" data-action="fundn" data-k="${k}" min="1" max="${price-(f?.paid||0)}" value="${Math.min(have,price-(f?.paid||0))||1}" aria-label="Amount"> <button class="btn sm" data-action="fund" data-k="${k}" ${have?'':'disabled'}>Pay</button>`:''}</td></tr>`}).join('')}</table></div>`}

/* ---------- Ref side: villages tracker ---------- */
function vTipsInit(){for(const k of Object.keys(INST))TIPS['vi-'+k]=[INST[k].n,`${INST[k].col?INST[k].col+': '+INST[k].val.join(' / ')+'. ':''}Founding ${INST[k].found.toLocaleString('en')} gc; levels ${INST[k].adv.slice(1).map((p,j)=>ORD(j+2)+' '+p.toLocaleString('en')).join(', ')} gc.`,INST[k].rule]}

/* ================= REF: session (DT clock, end of DT, party, combat) ================= */
const FAMS={angel:'Angel',blood:'Blood',demon:'Demon',plant:'Plant',undead:'Undead'};
function enOf(){const t=S.dt;return Math.min(5,3+(t.crowded?1:0)+(t.chaos?1:0))}
// The dungeon stage (SCREENS.session), the party tiles, the end-of-turn steps and the combat tracker live in play.js.
// Rolled once per result object (o), so the counts don't change when the page redraws.
function encounterText(s,o){if(o&&o.html&&o.src===s)return safeGameHTML(o.html,true);
  const html=esc(s).replace(/(?:(\d+)d6|(\d+)) (angel|blood creature|demon|plant|undead) ([A-J])\b/gi,(m,dn,n,f,l)=>{const k=dn?Array.from({length:+dn},()=>d(6)).reduce((a,b)=>a+b):+n,id=`${f.toLowerCase().replace(' ','-')}-${l.toLowerCase()}`;
    const lab=`${dn?`${dn}d6 <b class="roll" style="font-size:1rem">${k}</b>`:k} `;return MON[id]?`${lab}<a href="#mon/${id}" data-action="open-mon" data-id="${id}">${f} ${l}</a> <button class="btn sm" data-action="fight" data-id="${id}" data-n="${k}">+ ${k} to combat</button>`:lab+`${f} ${l}`})
   .replace(/(\d+)d6(?! <b)/g,m=>`${m} <b class="roll" style="font-size:1rem">${Array.from({length:+m.slice(0,-2)},()=>d(6)).reduce((a,b)=>a+b)}</b>`);
  if(o)Object.assign(o,{src:s,html});return html}
function rollTable(id,mod=0){const t=TB[id];const m=(t.rows[0][0].match(/(\d*)d(\d+)/)||[0,'',10]);const n=(+m[1]||1);let r=0;for(let k=0;k<n;k++)r+=d(+m[2]);r+=mod;const row=t.rows.slice(1).find(x=>inRange(x[0],r));if(!row)console.warn(`${t.title}: no row for ${r}`);return {r,row}}
function inRange(cell,r){cell=String(cell).trim();const n=s=>s==='00'?100:+s;let m;if((m=cell.match(/^(\d+)\s*[-–]\s*(\d+)$/)))return r>=n(m[1])&&r<=n(m[2]);if((m=cell.match(/^(\d+)\+$/)))return r>=n(m[1]);if((m=cell.match(/^(\d+)$/)))return r===n(m[1]);return false}
function doEncCheck(en){const r=d(10);const ec={r,en,hit:r<=en};if(ec.hit){ec.table=S.dt.dungeon+'-encounters';const x=rollTable(ec.table);ec.roll=x.r;ec.text=x.row?.[1]||'?'}return ec}

/* ================= REF: loot ================= */
SCREENS.loot=()=>{
  const L=S.lookup,it=L.pick&&(L.ench?.length?enchDef(L.pick,L.ench):IT[L.pick]);
  return `<div class="cols"><div class="stack"><div class="box"><h2 class="sec-h">Quick treasure <span class="muted">rolls go straight into the loot pool — remove what you don’t want</span>${LOOT.length?'':'<button class="sec-link linkbtn" data-action="loot-edit">'+nest('Prepare loot')+'</button>'}</h2><div class="row">${QT.map(([k,l])=>`<button class="btn sm hint" data-action="qroll" data-v="${k}" data-term="tip-${k}">${l}</button>`).join('')}</div>${S.lookup.qres||''}</div>
    ${LOOT.length?`<div class="box"><h2 class="sec-h">Prepared loot <span class="muted">presets you made in Look up → Loot presets</span></h2>${LOOT.map(p=>`<div class="prow"><div class="nm"><b>${esc(p.name||'Untitled')}</b><span>${esc(lootSummary(p))}</span></div><button class="btn sm primary" data-action="loot-drop" data-v="${p.id}">Drop into pool</button></div>`).join('')}<button class="btn sm" data-action="loot-edit" style="margin-top:.5rem">${nest('Prepare loot')}</button></div>`:''}
    ${L.find?`<div class="box" id="lootfind"><h2 class="sec-h">A specific card <span class="muted">${D.items.length} in the Playtest 3 decks — pick one to drop</span><button class="sec-link linkbtn" data-action="lootfind" aria-expanded="true">Close</button></h2>
    ${pickerHTML('loot','lootpick',L.pick)}
    <label class="check small" style="margin-top:.4rem"><input type="checkbox" data-action="kw" ${L.kw?'checked':''}> The filter also searches card text and what a card is crafted from</label></div>`
    :'<button class="btn" data-action="lootfind" aria-expanded="false">'+nest('Find a specific card')+'</button>'}
    ${it?`<div class="box"><div class="grid2" style="align-items:start"><div>${cardHTML(it,null,{full:true,info:false})}</div><div class="stack">
      ${enchKind(it)?`<div class="fld"><b>Enchantments</b>${enchPickHTML(L.pick,L.ench||[],'drop')}</div>`:''}<label class="fld"><b>How many</b><input type="number" id="dropq" min="1" max="99" value="1"></label>${LORE_BOOKS[it.id]?`<label class="fld"><b>The book is about</b><select id="dropt"><option value="">Player picks at rest</option>${LORE_EXP.map(e=>`<option>${e}</option>`).join('')}</select></label>`:''}
      <label class="fld"><b>Note for players</b><input type="text" id="dropn" placeholder="e.g. Room 4 — under the altar"></label>
      <label class="check"><input type="checkbox" id="dropu" ${isMagic(it)?'checked':''}> Unidentified — players see “${esc(shown({id:L.pick,unid:true}).name)}”, ${esc(kindOf(it))}</label>
      ${it.price==null?`<label class="fld"><b>Value you decide</b><input type="number" id="dropv" min="0" placeholder="gc"></label>`:''}
      <button class="btn primary" data-action="drop" data-id="${L.pick}">Drop into loot pool</button>
      <a href="#item/${it.id}" data-action="open-item" data-id="${it.id}">Crafting, uses and full rules →</a></div></div></div>`:''}
   </div>${poolHTML(true)}</div>`;
};


/* ================= REF: monsters ================= */
// One stat block for a creature, wherever it is read: the Bestiary, the side panel and the creature in focus in combat
// (play.js focusHTML). o.x: the creature on the tracker — its Stamina and AD read now/max; o.ctl: the combat controls, placed
// right under those numbers; o.fold: the description folds (in combat it is rarely needed). Same parts, same order, everywhere.
function statblockHTML(m,o={}){
  const st=m.st,x=o.x,max=parseInt(st.Stamina)||1,adMax=parseInt(st.AD)||0;
  const tile=(cls,k,v)=>`<div class="tile ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  const speed=String(st.Speed||'').match(/^(\d+)\s*,?\s*(.*)$/);
  const vit=[x?tile('t-st'+(x.st?'':' down'),'Stamina',`${x.st}<small>/${max}</small>`):st.Stamina?tile('t-st','Stamina',esc(st.Stamina)):'',
    st.AD?tile('t-ad','AD',x?`${x.ad||0}<small>/${adMax}</small>`:esc(st.AD)):'',
    st.Speed?tile('t-sp','Speed',speed?`${speed[1]}${speed[2]?`<small class="sb-sub">${esc(speed[2])}</small>`:''}`:esc(st.Speed)):'',
    st.Reactions||st.Slots?tile('t-re',st.Reactions?'Reactions':'Slots',esc(st.Reactions||st.Slots)):''].join('');
  const desc=m.desc?(o.fold?`<details class="sb-desc"><summary>Description</summary><p>${esc(m.desc)}</p></details>`:`<p class="sb-desc">${esc(m.desc)}</p>`):'';
  return `<div class="sb${x?' sb-live':''}">
   <p class="sb-id"><span class="chip">${esc(m.fam)}</span>${st.Size?`<span class="chip">${esc(st.Size)}</span>`:''}<span class="sb-pw">Power <b>${esc(st.Power||'?')}</b></span></p>
   <div class="sb-tiles sb-vit">${vit}</div>${o.ctl||''}
   <div class="sb-tiles sb-ch">${['Agility','Mind','Strength'].map(n=>tile('chr chr-'+n[0],n,esc(st[n]??'?'))).join('')}</div>
   ${desc}${st.Equipment?`<p class="sb-eq"><b>Equipment</b> ${esc(st.Equipment)}</p>`:''}${['Spells','Spellbooks'].map(k=>st[k]?`<p class="sb-eq sb-sp"><b>${k}</b> ${sbSpells(st[k])}</p>`:'').join('')}
   ${m.atk.length?`<h4 class="sb-h">Attacks</h4><div class="sb-atk">${m.atk.map(a=>a.bonus?prHTML([[2,linkify(a.t2)],[3,linkify(a.t3||'')]].filter(r=>r[1]),{head:`${esc(a.name)} <span class="chip">${esc(a.bonus)}</span>`,sub:a.range?esc(a.range):'range: see the book'}):`<p>${esc(a.name)}</p>`).join('')}</div>`:''}
   ${m.tr.length?`<h4 class="sb-h">Traits</h4><div class="sb-tr">${m.tr.map(([n,t,r])=>r?`<div class="trait sb-rr"><p><b>${esc(n)}</b> ${linkify(t)}</p>${prHTML(r.map((x,i)=>[i+1,linkify(x)]),{head:esc(((t.match(/(Agility|Mind|Strength) RR/g)||[]).pop())||'RR')})}</div>`:`<p class="trait"><b>${esc(n)}</b> ${linkify(t)}</p>`).join('')}</div>`:''}</div>`;
}
// "minor blessing, minor healing" → each spell links to its spellbook, where the book has one
const sbSpells=s=>s.split(/,\s*/).map(n=>{const it=IT[n.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-book'];return it?`<a href="#item/${it.id}" data-action="open-item" data-id="${it.id}">${esc(n)}</a>`:esc(n)}).join(', ');
SCREENS.monsters=()=>{
  const M=S.mon,q=M.q.toLowerCase();
  const list=D.monsters.filter(m=>(!M.fam||m.fam===M.fam)&&(!q||m.name.toLowerCase().includes(q)||m.desc.toLowerCase().includes(q)));
  const m=MON[M.pick];
  return `<div class="cols ld"><div class="box"><h2 class="sec-h">Bestiary <span class="muted">${D.monsters.length} stat blocks</span></h2>
    <input type="search" data-action="mq" value="${esc(M.q)}" placeholder="Name or description…" aria-label="Search monsters" style="width:100%">
    <div class="chips" style="margin:.5rem 0">${['','Angel','Blood','Demon','Plant','Undead','Human','Animal','Unique'].map(f=>`<button class="chip ${M.fam===f?'on':''}" data-action="mfam" data-v="${f}">${f||'All'}</button>`).join('')}</div>
    <ul class="mlist">${list.map(x=>`<li><button data-action="mpick" data-v="${x.id}" aria-current="${x.id===M.pick}">${esc(x.name)}<span>Power ${esc(x.st.Power||'?')}</span></button></li>`).join('')}</ul></div>
   <div class="box">${m?`<div class="row" style="justify-content:space-between"><h1>${esc(m.name)}</h1><button class="btn primary" data-action="fight" data-id="${m.id}">Add to combat</button></div>${statblockHTML(m)}`:'Pick a monster.'}</div></div>`;
};

/* ================= REF: roll tables ================= */
SCREENS.tables=()=>{
  const T=S.tbl,q=T.q.toLowerCase(),t=TB[T.pick];
  const groups=['Ref','Rules','Character'].map(src=>[src,D.tables.filter(x=>x.src===src&&(!q||x.title.toLowerCase().includes(q)))]);
  const die=t.rows[0][0];const needsMod=/\+/.test(die);
  return `<div class="cols ld"><div class="box"><h2 class="sec-h">Roll tables <span class="muted">${D.tables.length}</span></h2>
    <input type="search" data-action="tq" value="${esc(T.q)}" placeholder="Filter…" aria-label="Filter tables" style="width:100%">
    ${groups.map(([g,l])=>l.length?`<h3 class="small muted" style="margin:.75rem 0 .2rem;text-transform:uppercase;letter-spacing:.06em">${g} book</h3><ul class="mlist">${l.map(x=>`<li><button data-action="tpick" data-v="${x.id}" aria-current="${x.id===T.pick}">${esc(x.title)}<span>${esc(x.rows[0][0])}</span></button></li>`).join('')}</ul>`:'').join('')}</div>
   <div class="box"><div class="row" style="justify-content:space-between"><h1>${esc(t.title)}</h1>
     ${/d\d/.test(die)&&S.role==='ref'?`<div class="row">${needsMod?`<label class="small">${esc(die.replace(/^.*\+\s*/,''))} <input type="number" data-action="tmod" value="${T.mod}"></label>`:''}<button class="btn primary" data-action="troll">Roll ${esc(die.split(' ')[0])}${t.rows[0][1]==='d6'?' + d6':''}</button></div>`:''}</div>
     ${T.roll?`<div class="result" style="margin:.5rem 0"><span class="roll">${T.roll.r}</span> ${T.roll.row?encounterText(T.roll.row.slice(1).join(' — '),T.roll):'no row matches'}</div>`:''}
     <table class="rt n1"><tr>${t.rows[0].map(h=>`<th>${esc(h)}</th>`).join('')}</tr>${t.rows.slice(1).map(r=>`<tr class="${T.roll&&T.roll.row===r?'hit':''}">${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div></div>`;
};

/* ================= REF: travel day ================= */
// Each role result the Ref ticks: [key, label, effect text, effects]. The numbers come from journey-rules.js (FX):
// h = hexes, en = travel EN, ren = rest EN, chk = travel checks, rchk = rest checks.
const RTX=rows=>rows.map(([k,label,txt])=>[k,label,txt,JourneyRules.FX[k]]);
const RT_GUIDE=RTX([['normal','Normal Route (safe)','+1 hex'],['secret1','Secret Path — tier 1','lost'],['secret2','Secret Path — tier 2','EN −1, 1 hex slower'],['secret3','Secret Path — tier 3','EN −2'],
  ['short1','Shortcut — tier 1','lost'],['short2','Shortcut — tier 2','+1 hex, EN +1'],['short3','Shortcut — tier 3','+2 hexes']]);
const RT_BACK=RTX([['back1','Back on Track — tier 1','still lost'],['back2','Back on Track — tier 2','found at the end of today'],['back3','Back on Track — tier 3','found at the start of today']]);
const RT_SCOUT=RTX([['danger','Scout for Danger (safe)','EN −1'],['places','Scout for Places (safe)','finds POIs; a 2nd scout may take another task'],['shelter1','Scout for Shelter — tier 1','+1 check at the rest'],['shelter2','Scout for Shelter — tier 2','rest EN −1, travel EN +1'],['shelter3','Scout for Shelter — tier 3','a ruin outside the Miasma'],
  ['treasure1','Treasure Hunt — tier 1','+1 check'],['treasure2','Treasure Hunt — tier 2','Minor Treasure, +1 check'],['treasure3','Treasure Hunt — tier 3','Minor Treasure']]);
const RT_TRACK=RTX([['forage','Forage (safe)','1 ration'],['hunt1','Hunt — tier 1','+1 check'],['hunt2','Hunt — tier 2','1d6 rations, EN +1'],['hunt3','Hunt — tier 3','3d6 rations, 1d6 animal parts'],
  ['track1','Track Creature — tier 1','+1 check'],['track2','Track Creature — tier 2','a sign, 1 hex off the path'],['track3','Track Creature — tier 3','you meet it']]);
const RT_ROUTE=RTX([['road','Following a road all day','+1 hex'],['river','Crossing a river without a bridge, or going upstream','−1 hex'],['down','Downstream on water','+1 hex'],['dungeon','Passing a monster-infested hex','EN +1']]);
const RT_ALL=[...RT_GUIDE,...RT_BACK,...RT_SCOUT,...RT_TRACK,...RT_ROUTE];
const DIRS=JourneyRules.DIRS;
// The day's numbers (journey-rules.js dayTotals); the slowest crow sets the speed.
// the slowest creature with the group sets the pace (Rules: Changing Pace); journey.js adds mounts, vehicles, pets and hirelings
// the slowest living crow: a dead one (10 wounds) does not travel with the group and does not slow it
let groupSpeed=()=>{const l=PLAY().filter(c=>!crowDead(c));return l.length?Math.min(...l.map(speed)):5};
function rtDay(){return JourneyRules.dayTotals(S.rtravel,groupSpeed())}
const TRAVEL_SUB=JourneyRules.TRAVEL_SUB;
const encLine=(c,k,what)=>`<div class="${c.hit?'result bad':'result good'}" style="margin-top:.5rem">${what} ${k+1}: <span class="roll">${c.r}</span> ${c.hit?`encounter! Travel Encounters d100 <span class="roll">${c.roll}</span> → <b>${esc(c.text)}</b> ${c.sub?`<button class="btn sm" data-action="tgo" data-v="${c.sub}">Open ${esc(TB[c.sub].title)}</button>`:''}`:'— quiet.'}</div>`;
// The Ref's procedure rolls the checks (journey-rules.js encounterChecks takes the dice).
function encChecks(n,en){return JourneyRules.encounterChecks(n,en,{d10:()=>d(10),table:id=>rollTable(id)})}
SCREENS.rtravel=()=>{
  const R=S.rtravel,T=rtDay();
  const opt=(list,type)=>list.map(([k,l,e])=>`<label class="check small"><input type="${type}" name="${type==='radio'?'rguide':k}" data-action="rmod" data-v="${k}" ${R.mods[k]?'checked':''}><span>${l}<span class="small muted d">${e}</span></span></label>`).join('');
  return `<div class="box" style="margin-bottom:1rem"><div class="row" style="justify-content:space-between"><label class="fld" style="margin:0"><b>Where the party is</b><select data-action="vhere" aria-label="Where the party is"><option value="">On the road</option>${VILLAGES.map(x=>`<option value="${x.id}" ${x.id===S.here?'selected':''}>${esc(x.name)}${x.home?' (home)':''}</option>`).join('')}</select></label><button class="btn sm" data-action="go-villages">Add a village they found →</button></div><p class="small muted" style="margin:.4rem 0 0">Arriving in a village opens its trade, services and investing for the players.</p></div>
  <p class="muted" style="margin:0 0 1rem">The day in order (Rules p. 24). Players read their role tables on their own Travel tab and tell you their tiers; you tick them here.</p>
  ${R.lost?'<div class="banner bad"><b>The group is lost.</b> The guide can only try Back on Track today. You know where they really are; they don’t.</div>':''}
  <ol class="steps">
   <li><h3>Day ${R.day} — pace and route</h3>
    <div class="optgrid sm">${Object.entries(PACE).map(([k,x])=>`<button class="opt" data-action="rpace" data-v="${k}" aria-pressed="${R.pace===k}"><b>${x.label}</b><span class="small muted">${x.hex} hex${x.hex>1?'es':''} · EN ${x.en}${x.mod?` · role tests ${x.mod==='edge'?'+2':'−2'}`:''}</span></button>`).join('')}</div>
    <div class="checks" style="margin-top:.6rem">${opt(RT_ROUTE,'checkbox')}</div>
    <p class="small muted" style="margin:.4rem 0 0">Slowest crow: speed ${T.slow}${T.sp?` → ${T.sp>0?'+':''}${T.sp} hex`:' — no change'}. Mounts and vehicles use their own speed.</p></li>
   <li><h3>Role results <span class="small muted">supporters first, then guide, scouts, trackers</span></h3>
    <div class="grid3"><div><h4 class="bh">Guide <span class="small muted">one</span></h4><label class="check small"><input type="radio" name="rguide" data-action="rguide" data-v="" ${RT_GUIDE.concat(RT_BACK).some(([k])=>R.mods[k])?'':'checked'}> No guide</label>${opt(R.lost?RT_BACK:RT_GUIDE,'radio')}</div>
     <div><h4 class="bh">Scout <span class="small muted">one, two with Places</span></h4>${opt(RT_SCOUT,'checkbox')}</div>
     <div><h4 class="bh">Tracker <span class="small muted">any number</span></h4>${opt(RT_TRACK,'checkbox')}</div></div>
    <p class="small muted" style="margin:.5rem 0 0">Support Everyone and Fight the Miasma change the players’ own rolls, not these numbers.</p></li>
   <li><h3>Today</h3>
    <div class="kpis" style="margin:.4rem 0 .75rem">${[['Hexes',T.hexes,T.lost?'direction unknown':'toward the goal'],['Travel EN',T.en,'d10 ≤ EN = encounter'],['Checks',T.chk,'during the day'],['Rest EN',T.ren,`${T.rchk} check${T.rchk>1?'s':''} at camp`]].map(([k,v,m])=>`<div class="kpi"><span class="k">${k}</span><span class="v">${v}</span><span class="m">${m}</span></div>`).join('')}</div>
    ${hxHere()?`<div class="row" style="margin:-.25rem 0 .75rem"><span class="small">On the hex map the party has moved <b>${R.moved||0}</b> of ${T.hexes} today${HX.route.length?`; the players propose ${HX.route.length} step${HX.route.length>1?'s':''}`:''}.</span><button class="btn sm" data-action="tab" data-v="rmap">Hex map →</button></div>`:''}
    ${T.lost?`<div class="row"><button class="btn" data-action="rlostdir">Roll where each hex really goes</button>${R.dirs?`<span class="small">${R.dirs.map((x,k)=>`hex ${k+1}: <b>${x}</b>`).join(' · ')}</span>`:''}</div>`:''}
    <div class="row" style="margin-top:.5rem"><button class="btn primary" data-action="rcheck">Roll ${T.chk} encounter checks</button>${T.loot.length?`<button class="btn" data-action="rloot" ${R.looted?'disabled':''}>${R.looted?'Role finds are in the loot pool':'Roll role finds into the loot pool'}</button>`:''}</div>
    ${R.checks.map((c,k)=>encLine(c,k,'Check')).join('')}${R.lootLog?`<div class="result" style="margin-top:.5rem">${safeGameHTML(R.lootLog)}</div>`:''}</li>
   <li><h3>Camp</h3>
    <div class="optgrid sm">${[['miasma','Outdoors','in the Miasma'],['ruin','Ruin','outside the Miasma (Scout for Shelter tier 3)'],['village','Village or shelter','no Miasma']].map(([k,l,sub])=>`<button class="opt" data-action="rcamp" data-v="${k}" aria-pressed="${R.camp===k}" ${k==='ruin'&&!T.ruin?'disabled':''}><b>${l}</b><span class="small muted">${sub}</span></button>`).join('')}</div>
    ${R.camp==='ruin'?`<div class="row" style="margin-top:.5rem"><button class="btn sm" data-action="rruin">Roll if the ruin is inhabited (10%)</button>${R.ruinRoll?`<span>d100 <span class="roll">${R.ruinRoll}</span> ${R.ruinRoll<=10?'<b>inhabited</b> — use an encounter table':'empty'}</span>`:''}</div>`:''}
    <div class="row" style="margin-top:.6rem"><button class="btn" data-action="rrest">Roll ${T.rchk} rest encounter check${T.rchk>1?'s':''} (EN ${T.ren})</button></div>${R.restChecks.map((c,k)=>encLine(c,k,'Rest check')).join('')}
    <p class="small muted" style="margin:.6rem 0 0">Then each player finishes the rest on their Rest tab${R.camp==='miasma'?' and makes the Mind RR — tier 1 effects can be rolled here in Run game → Miasma':''}.${T.foundEnd?' At the end of today the guide works out where the group is.':''}</p></li>
  </ol>
  <button class="btn primary" data-action="rnextday">Start day ${R.day+1}</button>`;
};

/* ================= REF: Miasma (whole party) ================= */
// SCREENS.rmiasma, the Ref’s Miasma view, is in dice.js (one row per crow: the tiers, the d10 field, the effect’s full name).

/* ================= REF: village & XP ================= */
// Village events (d10 + Prosperity): the table in data starts at -4; the worst five rows sit in the book text
function villageEvent(r){const rows=TB['village-event'].rows.slice(1);const lo=Math.min(...rows.map(x=>+x[0]));
  if(r>=lo)return (rows.find(x=>+x[0]===Math.min(r,20))||rows.at(-1))[1];
  const b=BOOK['c-village-crafting']?.body.find(p=>p.tb)?.tb||[];const hit=b.find(x=>+x[0]===Math.max(-9,r));return hit?hit[1]:'(see the Village Event table)'}
function endCycle(v){const log=[];
  if(!v.raised&&v.prosperity>-10){v.prosperity--;log.push('Nothing raised Prosperity this cycle: −1')}
  for(const p of v.pending){v.inst[p.k]??={lvl:0,steward:'',mod:0,closed:false};v.inst[p.k].lvl=p.to;log.push(`${INST[p.k].n} opens at ${ORD(p.to)} level`)}
  for(const x of Object.values(v.inst)){x.mod=0;x.closed=false}
  const r=d(10)+v.prosperity,ev=villageEvent(r);v.events.unshift({cycle:v.cycle+1,roll:r,text:ev});
  Object.assign(v,{pending:[],spent:0,raised:false,saleMod:0,auction:{},day:1,cycle:v.cycle+1});log.push(`Village event (d10 + Prosperity = ${r}): ${ev}`);saveVillages();return log}
// The XP split: the living crows at the table, unless the Ref typed a number (pset). It used to be fixed when Villages first
// opened, often before anyone had joined (÷ 1).
function xpState(){const xp=S.xp||(S.xp={rows:[],players:1});if(!xp.pset)xp.players=Math.max(1,PLAY().filter(c=>!crowDead(c)).length);return xp} // in a session: the crows playing, not the frozen (session.js)
function vListHTML(sel){return `<ul class="mlist">${VILLAGES.map(v=>`<li><button data-action="vsel" data-v="${v.id}" aria-current="${sel?.id===v.id}">${esc(v.name)}${v.home?' · home':''}<span>${v.id===S.here?(partyWaits()?'party starts here · ':'party here · '):''}P ${fmt(v.prosperity)} · day ${v.day}</span></button></li>`).join('')||'<li class="muted small" style="padding:.5rem">No villages yet.</li>'}</ul>`}
SCREENS.village=()=>{const sel=VILLAGES.find(v=>v.id===S.vsel)||VILLAGES[0],xp=xpState();
  const tot=xp.rows.reduce((a,[n,val,g])=>a+Math.floor((+val||0)*(1+[0,.3,.2,.1][+g||0])),0);const NV=S.newv??={name:'',home:!VILLAGES.some(v=>v.home),preset:'start',extra:'alchemist'};
  const left=`<div class="stack"><div class="box">
    ${vListHTML(sel)}</div>
   ${VILLAGES.length&&!S.nvOpen?(typeof plNewHTML==='function'?plNewHTML():`<button class="btn" data-action="nvopen">+ New village</button>`):`<div class="box"><h2 class="sec-h">New village${VILLAGES.length?'<button class="sec-link linkbtn" data-action="nvopen">Close</button>':''}</h2>
    <label class="fld"><b>Start from</b><select data-action="nvpreset">${[['start','A starting village (Character p. 50)'],['gadwick','Gadwick (Dungeons p. 2)'],['liston','Liston (Dungeons p. 2)'],['empty','Empty — set institutions by hand']].map(([k,l])=>`<option value="${k}" ${NV.preset===k?'selected':''}>${l}</option>`).join('')}</select></label>
    ${NV.preset==='start'?`<p class="small muted" style="margin:0 0 .4rem">Blacksmith, crypt, general store, inn and temple at 1st level, plus one more the group chooses:</p><label class="fld"><b>Extra institution</b><select data-action="nvextra">${Object.keys(INST).filter(k=>!HOME_START.includes(k)).map(k=>`<option value="${k}" ${NV.extra===k?'selected':''}>${INST[k].n}</option>`).join('')}</select></label>`:''}
    ${NV.preset==='start'||NV.preset==='empty'?`<label class="fld"><b>Name</b><input type="text" data-action="nvname" value="${esc(NV.name)}" placeholder="e.g. Thornwick"></label>`:''}
    <label class="check small"><input type="checkbox" data-action="nvhome" ${NV.home?'checked':''}> The crows’ home village</label>
    <div style="margin-top:.6rem"><button class="btn primary" data-action="nvadd">Create village</button></div></div>`}</div>`;
  const pl=typeof plPageHTML==='function'&&plPageHTML();if(pl)return `<div class="cols ld">${left}${pl}</div>`; // a point of interest or a dungeon (places.js)
  if(!sel)return `<div class="cols">${left}<div class="box"><p class="muted">Create the crows’ village to start: its institutions decide what players can buy, sell and do there.</p></div></div>`;
  const v=sel,k13=Object.keys(INST),lv=k=>v.inst[k]?.lvl||0;
  // founded institutions, and those on the way (paid or partly paid); the rest wait behind “Found an institution”
  const listed=k13.filter(k=>lv(k)>0||v.pending.some(p=>p.k===k)||v.fund[k]?.paid),unf=k13.filter(k=>!lv(k)),founded=k13.filter(k=>lv(k)>0);
  const VQ=[['ruin','What old ruin contains the village?'],['ruler','Who runs the village?'],['food','Common staples to eat and drink'],['holiday','The most important holiday or festival']];
  const fills=[...founded.map(k=>v.inst[k].steward),...VQ.map(([k])=>v.q?.[k]),v.note],nAll=fills.length,nFill=fills.filter(x=>(x||'').trim()).length;
  const right=`<div class="stack"><div class="box"><div class="row" style="justify-content:space-between"><input type="text" data-action="vname" value="${esc(v.name)}" aria-label="Village name" style="font-weight:700;font-size:1.1rem;width:14rem">
     <div class="row">${v.id===S.here?`<span class="chip on good">${partyWaits()?'Party starts here':'Party is here'}</span>`:`<button class="btn sm primary" data-action="vhere-set" data-v="${v.id}"${sceneArriveWhy(v)?' disabled aria-describedby="vhere-why"':''}>${partyWaits()?'Start here':'Party arrives here'}</button>`}<button class="btn sm danger" data-action="vdel" data-v="${v.id}">Delete</button></div></div>
    ${v.id!==S.here&&sceneArriveWhy(v)?`<p class="small muted" id="vhere-why" style="margin:.4rem 0 0">${esc(sceneArriveWhy(v))}</p>`:''}
    <label class="check small"><input type="checkbox" data-action="vhome" ${v.home?'checked':''}> Home village (card prices; merchants pay by Prosperity). Elsewhere: +20% to buy, merchants pay 20%.</label>
    <div class="kpis" style="margin-top:.75rem"><div class="kpi"><span class="k">Prosperity</span><span class="v">${fmt(v.prosperity)}</span><span class="m"><span class="adj"><button data-action="vprosp" data-d="-1" aria-label="Lower">−</button><button data-action="vprosp" data-d="1" aria-label="Raise">+</button></span></span></div>
     <div class="kpi"><span class="k">Merchants pay</span><span class="v">${salePctAt(v)}%</span><span class="m"><span class="adj"><button data-action="vsale" data-d="-5" aria-label="−5% this cycle">−</button><button data-action="vsale" data-d="5" aria-label="+5% this cycle">+</button></span></span></div>
     <div class="kpi"><span class="k">Cycle ${v.cycle}</span><span class="v">${v.day}<small>/ 20</small></span><span class="m"><span class="adj"><button data-action="vday" data-d="-1" aria-label="Day back">−</button><button data-action="vday" data-d="1" aria-label="Next day">+</button></span></span></div>
     <div class="kpi ${v.raised?'':'warn'}"><span class="k">Raised this cycle</span><span class="v">${v.raised?'yes':'no'}</span><span class="m">${gc(v.spent||0)} spent on goods</span></div></div>
    <div class="row" style="margin-top:.6rem"><button class="btn" data-action="vcycle">End cycle: event, upgrades, Prosperity</button><span class="small muted">A cycle is 20 days. Without a raise, Prosperity drops by 1.</span></div>
    ${v.events[0]?`<div class="result" style="margin-top:.6rem"><b>Cycle ${v.events[0].cycle} event</b> (rolled ${v.events[0].roll}): ${esc(v.events[0].text)}</div>`:''}</div>
   <div class="box"><h2 class="sec-h">Institutions <span class="muted">founded and on the way; “this cycle” is for event effects</span></h2>
    ${listed.length?`<div class="tw"><table class="rt form"><tr><th>Institution</th><th>Level</th><th>This cycle</th><th>Gives</th></tr>${listed.map(k=>{const x=v.inst[k]||{lvl:0},pend=v.pending.find(p=>p.k===k),f=v.fund[k];
      return `<tr class="${x.lvl?'':'dim'}"><td><a class="term" href="#rule/${INST[k].rule}" data-term="vi-${k}">${INST[k].n}</a>${pend?`<br><span class="small" style="color:var(--ok)">→ ${ORD(pend.to)} next cycle</span>`:f?.paid?`<br><span class="small muted">${gc(f.paid)} paid</span>`:''}</td>
       <td class="nw"><span class="adj"><button data-action="vlvl" data-k="${k}" data-d="-1" aria-label="Lower ${INST[k].n}">−</button> <b>${x.lvl||'—'}</b> <button data-action="vlvl" data-k="${k}" data-d="1" aria-label="Raise ${INST[k].n}">+</button></span></td>
       <td class="nw">${x.lvl?`<span class="adj"><button data-action="vmod" data-k="${k}" data-d="-1" aria-label="Level down this cycle">−</button> ${x.mod?(x.mod>0?'+':'')+x.mod:'0'} <button data-action="vmod" data-k="${k}" data-d="1" aria-label="Level up this cycle">+</button></span> <label class="small"><input type="checkbox" data-action="vclosed" data-k="${k}" ${x.closed?'checked':''}> closed</label>`:''}</td>
       <td class="small">${lvlOf(v,k)&&INST[k].col?`${INST[k].col} <b>${INST[k].val[Math.min(lvlOf(v,k),INST[k].val.length)-1]}</b>`:''}</td></tr>`}).join('')}</table></div>`:'<p class="small muted">No institutions founded yet.</p>'}
    ${unf.length?`<div class="row" style="margin-top:.6rem"><button class="btn sm" data-action="vfound-open" aria-expanded="${!!S.vfound}">${nest('Found an institution')}</button></div>
     ${S.vfound?`<div class="vfound" role="group" aria-label="Found an institution at 1st level"><p class="small muted" style="margin:.5rem 0 .4rem">Pick one: it opens at 1st level now.</p><div class="row">${unf.map(k=>`<button class="btn sm" data-action="vfound" data-k="${k}">${INST[k].n}</button>`).join('')}</div></div>`:''}`:''}</div>
   <details class="box fold vnotes" data-fold="vnotes"${foldOpen('vnotes')}><summary><span class="sec-h">Village notes <span class="muted">optional, only you see this · ${nFill} of ${nAll} filled</span></span></summary>
    ${founded.length?`<h3 class="bh">Stewards</h3><div class="vstews">${founded.map(k=>`<label class="fld"><b>${INST[k].n}</b><input type="text" data-action="vstew" data-k="${k}" value="${esc(v.inst[k].steward||'')}" placeholder="Steward" style="width:100%"></label>`).join('')}</div>`:''}
    <h3 class="bh">About ${esc(v.name)}</h3>${VQ.map(([k,l])=>`<label class="fld"><b>${l}</b><input type="text" data-action="vq" data-k="${k}" value="${esc(v.q?.[k]||'')}" style="width:100%"></label>`).join('')}
    <label class="fld"><b>Notes</b><input type="text" data-action="vnote" value="${esc(v.note||'')}" style="width:100%"></label></details></div>`;
  const haul=PLAY().flatMap(c=>(c.haul||[]).map((h,k)=>({c,h,k}))),hv=h=>(h.val??IT[h.id].price??0)*h.n*(1+[0,.3,.2,.1][+h.g||0]);
  const htot=Math.floor(haul.filter(x=>!x.h.skip).reduce((a,x)=>a+hv(x.h),0)),all=htot+tot,home=vHere()?.home,hmiss=haulMiss();
  const xpBox=`<div class="box" id="xp-box" style="margin-top:1rem"><h2 class="sec-h"><a class="term" href="#rule/c-advancement" data-term="c-advancement" style="color:inherit">XP for treasure brought home</a> <span class="muted">${home?'the party is home':'XP counts when the party is back in its village'}</span></h2>
    <p class="small muted" style="margin:0 0 .5rem">Everything the crows took from your loot is listed — also what they sold in other villages or used up. Untick what doesn’t count: monster parts, pets, things taken from innocents or allies.</p>
    ${haul.length?`<div class="tw"><table class="rt form"><tr><th></th><th>Crow</th><th>Treasure</th><th>Value</th><th>Greed</th><th>XP value</th></tr>${haul.map(({c,h,k})=>`<tr class="${h.skip?'dim':''}"><td><input type="checkbox" data-action="xph" data-c="${PARTY.indexOf(c)}" data-k="${k}" ${h.skip?'':'checked'} aria-label="Counts for XP"></td><td>${esc(c.name)}</td><td>${esc(IT[h.id].name)}${h.n>1?' ×'+h.n:''}${noteOf(h)?`<div class="small muted">${esc(noteOf(h))}</div>`:''}${isPart(IT[h.id])?'<div class="small" style="color:var(--sel)">monster part — no XP</div>':''}</td>
      <td class="nw">${h.id==='gold-coins'?`${h.n} gc`:IT[h.id].price!=null?gc(IT[h.id].price)+(h.n>1?' each':''):`<input type="number" data-action="xphv" data-c="${PARTY.indexOf(c)}" data-k="${k}" min="0" value="${h.val??''}" placeholder="gc" aria-label="Value the Ref gives${h.n>1?', each':''}">${h.n>1?' each':''}`}</td>
      <td><select data-action="xphg" data-c="${PARTY.indexOf(c)}" data-k="${k}" aria-label="Greed">${['—','DT 1 +30%','DT 2 +20%','DT 3 +10%'].map((l,j)=>`<option value="${j}" ${(+h.g||0)===j?'selected':''}>${l}</option>`).join('')}</select></td><td class="nw">${h.skip?'—':Math.floor(hv(h))+' gc'}</td></tr>`).join('')}</table></div>`:'<p class="muted small">Nothing taken from the loot pool yet.</p>'}
    <h3 class="sec-h sm">Anything else <span class="muted">treasure that never went through the loot pool</span></h3>
    ${xp.rows.length?`<table class="rt form"><tr><th>Treasure</th><th>Value gc</th><th>Greed</th><th></th></tr>${xp.rows.map(([n,val,g],k)=>`<tr><td><input type="text" data-action="xpn" data-k="${k}" value="${esc(n)}" placeholder="e.g. bloodstone" style="width:100%" aria-label="Treasure name"></td><td><input type="number" data-action="xpv" data-k="${k}" value="${val||''}" aria-label="Value"></td><td><select data-action="xpg" data-k="${k}" aria-label="Greed">${['—','+30%','+20%','+10%'].map((l,j)=>`<option value="${j}" ${+g===j?'selected':''}>${l}</option>`).join('')}</select></td><td><button class="xbtn" data-action="xpdel" data-k="${k}" aria-label="Remove row">✕</button></td></tr>`).join('')}</table>`:''}
    <div class="row"><button class="btn sm" data-action="xpadd">+ Add a row</button><label>Players <input type="number" data-action="xpp" value="${xp.players}" min="1"></label></div>
    <div class="result good" style="margin-top:.6rem">Total value <b>${all} gc</b> → each PC gains <b>${Math.floor(all/xp.players)} XP</b></div>${hmiss?`<p class="small xp-miss" role="note">${hmiss} piece${hmiss>1?'s':''} of treasure ${hmiss>1?'have':'has'} no value yet and ${hmiss>1?'count':'counts'} 0. Set ${hmiss>1?'their values':'its value'} in the table above.</p>`:''}
    <button class="btn primary" data-action="xpgive" ${all?'':'disabled'}>Give ${Math.floor(all/xp.players)} XP to each crow</button> <span class="small muted">It counts after their next rest.</span></div>`;
  // back home with treasure: the one thing to do first, said at the top; the section itself stays where it always is
  const cue=home&&all>0?`<div class="cue" role="status"><span><b>Treasure brought home</b> · ${all} gc → <b>${Math.floor(all/xp.players)} XP</b> for each crow</span><button class="btn sm primary" data-action="jump" data-v="xp-box">Review and give XP ↓</button></div>`:'';
  return `${cue}<div class="cols ld">${left}${right}</div>${xpBox}`};

/* ================= Ref-made cards, treasure rolls, loot presets ================= */
const slugify=x=>x.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const CUSTOM=JSON.parse(store.get('customItems')||'[]');
const addItemDef=it=>{if(!IT[it.id]){D.items.push(it);IT[it.id]=it}return it.id};
addItemDef({id:'gold-coins',name:'Gold coins',cat:'treasure',stack:250,slots:1,price:1,text:'Loose coins. A slot holds 250 coins; a coin purse holds 500 gc in one slot.'});
CUSTOM.forEach(addItemDef);
// Weapon and armor enchantments (Character book). An enchanted item is a variant card saved with the custom items: same stats, magic, enchantment price added.
let ENCH=null;
function enchants(){if(ENCH)return ENCH;ENCH={};
  for(const [kind,key] of [['w','c-weapon-enchantments'],['a','c-armor-enchantments']]){let cur=null;const body=BOOK[key]?.body||[];
    for(const b of body){const m=b.li?.match(/^\*\*(.+?):\*\* ?([\s\S]*)/); // the table sits between list entries, so read it afterwards
      if(m)cur=ENCH[kind+':'+m[1]]={n:m[1],kind,t:m[2],rule:key};else if(b.x&&cur)cur.t+=' '+b.x;else if(b.h)cur=null}
    for(const b of body)for(const r of b.tb?.slice(1)||[]){const e=ENCH[kind+':'+r[0]];if(e){e.price=+r[1].replace(/\D/g,'');e.cx=+r[2];e.where=kind==='a'?r[3]:''}}}
  return ENCH}
const enchKind=it=>it?.cat==='weapon'?'w':it?.cat==='armor'?'a':null;
const enchOf=(name,kind)=>{const n=name.replace(/ \(.+\)$/,''),E=enchants();return E[kind+':'+n]||E[(kind==='a'?'w':'a')+':'+n]};
const SLAY=['Angel','Animal','Blood','Demon','Elemental','Human','Plant','Undead'];
function enchDef(id,names){const b=IT[id],E=names.map(n=>enchOf(n,enchKind(b)));
  const it={...b,id:`x-${id}--${names.map(slugify).join('-')}`,base:id,name:`${b.name} (${names.join(', ')})`,magic:true,
    price:b.price==null?null:b.price+E.reduce((t,e)=>t+(e?.price||0),0),q:[b.q,...names.map(n=>'Enchantment: '+n)].filter(Boolean).join(', '),
    text:[b.text,...E.map((e,k)=>e&&`**${names[k]}:** ${e.t}`)].filter(Boolean).join('\n\n')};
  delete it.craft;delete it.upg;return it}
function enchantItem(id,names){if(!names?.length)return id;const it=enchDef(id,names);if(!IT[it.id]){addItemDef(it);CUSTOM.push(it);store.set('customItems',JSON.stringify(CUSTOM))}return it.id}
// Picker: chips with ✕, then a select of what still fits (total complexity ≤ 4; one Slaying; shield/suit per the armor table).
function enchPickHTML(baseId,names,ctx){const b=IT[baseId],kind=enchKind(b);if(!kind)return '';
  const used=names.reduce((t,n)=>t+(enchOf(n,kind)?.cx||0),0),shield=/shield/i.test(b.name);
  const opts=Object.values(enchants()).filter(e=>e.kind===kind&&e.cx<=4-used&&(kind==='w'||e.where==='Both'||(e.where==='Shield')===shield)&&!names.some(n=>enchOf(n,kind)===e));
  const opt=(v,e)=>`<option value="${esc(v)}">${esc(v)} — ${gc(e.price)}, complexity ${e.cx}</option>`;
  return `<div class="ench"><span class="small muted">Enchantments ${used}/4</span>${names.map((n,k)=>`<span class="chip"><a class="term" href="#rule/${enchOf(n,kind)?.rule}" data-term="en-${kind}-${esc(n.replace(/ \(.+\)$/,''))}">${esc(n)}</a><button class="xbtn" data-action="ench-rm" data-ctx="${ctx}" data-k="${k}" aria-label="Remove ${esc(n)}">✕</button></span>`).join('')}
    ${opts.length?`<select data-action="ench-add" data-ctx="${ctx}" aria-label="Add an enchantment"><option value="">Add enchantment</option>${opts.map(e=>e.n==='Slaying'?SLAY.map(t=>opt(`Slaying (${t})`,e)).join(''):opt(e.n,e)).join('')}</select>`:''}</div>`}
function enchEdit(ctx,f){if(ctx==='drop'){f(S.lookup.ench??=[]);return render()}
  const x=curLoot().items[+ctx],l=[...(x.ench||[])];x.base??=x.id;f(l);x.id=enchantItem(x.base,l);if(l.length)x.ench=l;else{delete x.ench;delete x.base;delete x.u}saveLoot();render()}
function customItem(name,o={}){const id='x-'+slugify(name);if(!IT[id]){const it={id,name,cat:o.cat||'gear',stack:1,slots:o.slots||1,price:null,text:o.text||'A card the Ref made for this game.'};addItemDef(it);CUSTOM.push(it);store.set('customItems',JSON.stringify(CUSTOM))}return id}
const nkey=x=>x.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]/g,'');
const rollDice=x=>x.replace(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?(?:\s*×\s*(\d+))?/g,(m,n,f,op,k,mul)=>{let r=0;for(let i=0;i<+n;i++)r+=d(+f);if(op)r+=op==='+'?+k:-k;return String(mul?r*+mul:r)});
// "Fine torch" → Torch (note Fine), "Undead bone light armor" → Light Armor (note Undead bone), "13 arrows" → quiver.
function matchItem(t){const NI={};for(const i of D.items)NI[nkey(i.name)]=i.id;const f=x=>NI[nkey(x)]||NI[nkey(x.replace(/ (set|vial)$/i,''))]||NI[nkey(x.replace(/s$/,''))]||NI[nkey(x.replace(/ and | set$/g,' '))];let m;
  if((m=t.match(/(\d+) (crossbow bolts|arrows)/i)))return {id:/bolt/i.test(m[2])?'case-of-20-crossbow-bolts':'quiver-of-20-arrows',note:`${m[1]} ${m[2]}`};
  const w=t.replace(/^(an?|the|empty) /i,'').replace(/\s*\(.*\)$/,'').replace(/^[\d,]+ (feet of )?/,'').split(' ');
  for(let k=0;k<w.length;k++){const id=f(w.slice(k).join(' '));if(id)return {id,note:w.slice(0,k).join(' ')}}}
const pushPool=(id,count,note,val)=>S.pool.push({uid:UID++,id,count,from:'Ref',note,val,unid:isMagic(IT[id])});
/* ---------- the Ref's value for a card the rules leave to the Ref ---------- */
// Character p45: “The Ref determines the value of a gem or art object.” No table rolls it (The Ref p13 only names the gem or
// the art object), so there is no Roll button. Any card printed without a price (gems, art objects, the Ref's own cards,
// materials the Ref details) carries the Ref's value: on the pool entry, on the instance a crow takes from it (finishPlace), in that
// crow's haul rows (XP table) and at the sale (saleOf). x.val, or x.vals for a stack of different values (below); setItemVals keeps the haul rows in step.
// The roll's note “— the Ref sets its value” (treasureToPool) is dropped from what is shown once the value is set.
const noteOf=x=>x.note?(x.val!=null||Array.isArray(x.vals)&&x.vals.every(v=>v!=null)?String(x.note).replace(/ — the Ref sets its value$/,''):x.note):'';
const refPriced=x=>!!x&&!!IT[x.id]&&IT[x.id].price==null;
const valNum=t=>{t=String(t??'').trim();if(t==='')return null;const n=Math.floor(+t);return isFinite(n)&&n>=0?n:undefined};
/* ---------- a stack of pieces the Ref valued differently (owner, 2026-11-18) ---------- */
// Two gems of one card stack whatever the Ref made them worth; the stack is worth the sum. Each piece keeps its value:
// a stack of one value keeps the old shape (x.val = each, x.count pieces), a mixed one keeps x.vals (one entry per piece, highest
// first, null = not valued yet; x.val is then absent). Old saves need no change: val + count reads as count pieces of val.
// Which pieces leave: Split, Give to party, Take and Remove 1 ask (askPieces, by value) when the values differ; where nothing asks
// (Sell, Sell one, a hand takes one, a stack takes what fits) the most valuable go first, so the pieces not valued yet stay last.
const vcmp=(a,b)=>(b??-1)-(a??-1);
function valsOf(x){const n=Math.max(1,+x?.count||+x?.n||1),a=Array.isArray(x?.vals)?x.vals.map(v=>v==null||!isFinite(+v)?null:+v).sort(vcmp):Array(n).fill(x?.val??null);
  while(a.length<n)a.push(null); // pieces added by code that knows nothing of values have none yet
  return a.length>n?a.slice(a.length-n):a} // pieces gone that way were the most valuable (the rule above)
function putVals(x,a){a=a.map(v=>v==null?null:+v).sort(vcmp);x.count=a.length;
  if(a.every(v=>v===a[0])){delete x.vals;if(a[0]!=null||x.val!==undefined)x.val=a[0]??null}else{x.vals=a;delete x.val}return x}
// the values q would take from a: q pieces, most valuable first, or the listed values (any not there any more: the most valuable left)
function pickVals(a,q){a=[...a];if(!Array.isArray(q))return a.slice(0,Math.max(0,q));const out=[];for(const v of q){if(!a.length)break;const k=a.indexOf(v);out.push(...a.splice(k<0?0:k,1))}return out}
function takeVals(x,q){const a=valsOf(x),out=pickVals(a,q);for(const v of out)a.splice(a.indexOf(v),1);putVals(x,a);return out}
function addVals(x,add){putVals(x,[...valsOf(x),...add])}
function valSum(x){const a=valsOf(x),k=a.filter(v=>v!=null);return {a,k,n:a.length,sum:k.reduce((s,v)=>s+v,0),known:k.length,miss:a.length-k.length}}
// What a stack is worth, in words; '' while nothing is valued. “150 gc” · “40 gc each · 80 gc for 2” · “Total 250 gc (100 + 100 + 50)”
// · “Total 200 gc (100 + 100) + 1 not valued yet”. short: rows (“40 gc each”, no “Total”).
function valWords(x,short){const s=valSum(x);if(!s.known)return '';const k=s.k,one=k.every(v=>v===k[0]);
  if(s.n===1)return gc(k[0]);
  if(one&&!s.miss)return short?`${gc(k[0])} each`:`${gc(k[0])} each · ${gc(s.sum)} for ${s.n}`;
  return `${short?'':'Total '}${gc(s.sum)}${k.length>1?` (${k.map(v=>v.toLocaleString('en')).join(' + ')})`:''}${s.miss?` + ${s.miss} not valued yet`:''}`}
// the Ref's value form: one number per piece, in the order valsOf lists them (null = not set, undefined = not a number)
const rvalIn=f=>[...f.querySelectorAll('input[name=v]')].map(e=>valNum(e.value));
// pieces in the XP table that count but have no value yet (they add 0)
const haulMiss=()=>PLAY().reduce((a,c)=>a+(c.haul||[]).filter(h=>!h.skip&&h.id!=='gold-coins'&&IT[h.id]?.price==null&&h.val==null).reduce((s,h)=>s+(+h.n||1),0),0);
// Haul rows follow their pieces: one row is n pieces of one value, h.uid the instance holding them. Each change [from,id,a,to,b] moves
// one piece of value a from instance `from` to value b in instance `to`. A row splits only as far as needed; the parts of one row that
// move together stay one row. A row older than h.uid: the first unvalued row of that card, when the Ref values a piece in place.
function haulShift(c,ch){const h=c?.haul;if(!h)return;const made=[];
  for(const [from,id,a,to,b] of ch){if(from===to&&a===b)continue;
    const r=h.find(x=>x.uid===from&&x.id===id&&(x.val??null)===a)||(a==null&&from===to?h.find(x=>x.uid==null&&x.id===id&&x.val==null):null);if(!r)continue;
    const e=made.find(e=>e[0]===r&&e[1]===to&&e[2]===b);
    if(r.n>1){r.n--;if(e)e[3].n++;else{const m={...r,n:1,uid:to,val:b};h.splice(h.indexOf(r)+1,0,m);made.push([r,to,b,m])}}
    else if(e){e[3].n++;h.splice(h.indexOf(r),1)}else{r.uid=to;r.val=b}}}
const haulMove=(c,from,to,id,vals)=>haulShift(c,vals.map(v=>[from,id,v,to,v]));
// The Ref sets every piece of instance i at once (b in the order valsOf(i) lists them); its haul rows follow piece by piece.
function setItemVals(c,i,b){const a=valsOf(i);b=b.slice(0,a.length);while(b.length<a.length)b.push(null);haulShift(c,a.map((v,k)=>[i.uid,i.id,v,i.uid,b[k]]));putVals(i,b)}
// The Ref's control, wherever the Ref reads such a card: empty until set, then the value in the same field to change it. A stack has
// one field per piece (most valuable first) and “Same for all”. Players never get it.
function valEditHTML(x,at,o={}){if(S.role!=='ref'||!refPriced(x))return '';const a=valsOf(x),set=a.some(v=>v!=null),many=a.length>1;
  const inp=(v,k)=>`<input type="number" name="v" min="0" step="1" data-inc="10" inputmode="numeric" value="${v??''}" placeholder="${v==null?'not set':''}"${many?` class="stp-in" aria-label="${esc(nm(x))} ${k+1} of ${a.length}, value in gc"`:''}>`;
  const body=many?`<fieldset class="rval-many"><legend>${o.row?'Values':'Your values'} (gc), one per piece</legend><div class="rval-ps">${a.map((v,k)=>`<label class="rval-p"><span aria-hidden="true">${k+1}</span>${inp(v,k)}</label>`).join('')}</div></fieldset><div class="rval-b"><button class="btn sm ghost" type="button" data-rval-all>Same for all</button><button class="btn sm" type="submit">${set?'Change':'Set'}</button></div>${o.row||x.unid?`<p class="rval-t">${valWords(x)||'No value yet'}</p>`:''}`
    :`<label>${o.row?'Value':'Your value'} (gc)${inp(a[0],0)}</label><button class="btn sm" type="submit">${set?'Change':'Set'}</button>`;
  return `<form class="rval${o.row?' row':''}${many?' many':''}" data-form="rval" ${at.pool?`data-pool="${x.uid}"`:`data-c="${at.c}" data-uid="${x.uid}"`} data-n="${a.length}">${body}</form>${o.row?'':`<p class="rval-n">${x.unid?'Players see it once the item is identified. ':''}${many?'Pieces of one card stack whatever each is worth; the stack is worth the sum. ':''}The rules leave the value to you. The treasure tables price gems and art objects at 10–500 gc (Minor) and 1,000–5,000 gc (Major).</p>`}`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-rval-all]');if(!b)return;const ins=[...b.closest('form').querySelectorAll('input[name=v]')],v=(ins.find(i=>i.value.trim()!=='')||ins[0]).value;ins.forEach(i=>i.value=v);ins[0].focus()});
// One treasure-table result → loot-pool entries; gems and art objects get their own detail rolls.
function treasureToPool(table,row){
  const src=TB[table].title;if(!row)return `${src}: that roll has no row in this table — roll again`; // a gap in the extracted data must not break the roll
  if(table==='what-s-the-gem'){pushPool('gem',1,`${row[1]} — the Ref sets its value`);return row[1]}
  if(table==='what-s-the-art-object'){const size=row[2]==='Varies'?'Small':row[2];pushPool('art-object-'+size.toLowerCase(),1,`${row[1]} (${size}) — the Ref sets its value`);return `${row[1]} (${size})`}
  let t=rollDice(row[1]).trim(),m;
  if(/^Roll on the (Major|Minor) Treasures table/.test(t)){const k=/Major/.test(t)?'major-treasures':'minor-treasures';const x=rollTable(k);return `${t} → ${treasureToPool(k,x.row)}`}
  if((m=t.match(/^Gem worth ([\d,]+) gc/))){const g=rollTable('what-s-the-gem').row[1];pushPool('gem',1,`${g} — ${src}`,+m[1].replace(/,/g,''));return `${g}, a gem worth ${m[1]} gc`}
  if((m=t.match(/^Art object worth ([\d,]+) gc/))){const r=rollTable('what-s-the-art-object').row,size=r[2]==='Varies'?'Small':r[2];pushPool('art-object-'+size.toLowerCase(),1,`${r[1]} — ${src}`,+m[1].replace(/,/g,''));return `${r[1]} (${size}), worth ${m[1]} gc`}
  if((m=t.match(/^Rank (\d) spellbook/))){const l=D.items.filter(i=>i.cat==='spellbook'&&i.rank==+m[1]);if(l.length){const b=l[d(l.length)-1];pushPool(b.id,1,src);return `${t}: ${b.name}`}}
  if(/^Roll twice/.test(t))return t+': '+[0,1].map(()=>treasureToPool(table,rollTable(table).row)).join('; ');
  const mi=matchItem(t);if(mi){pushPool(mi.id,1,[mi.note,src].filter(Boolean).join(' — '));return t}
  const id=customItem(t.replace(/^(an?|the) /i,'').replace(/^./,c=>c.toUpperCase()),{cat:'treasure',text:`Rolled on ${src}. The Ref decides the details.`});
  pushPool(id,1,src);return t}
const QT=[['minor-treasures','Minor treasure'],['major-treasures','Major treasure'],['what-s-the-gem','What’s the gem?'],['what-s-the-art-object','What’s the art object?']];
const TIPS={
  'tip-dead-crow':['Replacing a dead crow','Roll once more for each level it had and pick any background you rolled.','r-damage-and-death'],
  'tip-lore':['Lore book Effort','Extra Effort from the lore book you studied. You can only spend it on tests where its expertise applies. Tap to spend 1. It ends when you finish your next rest.','r-rest-activities'],
  'tip-effort-bonus':['Bonus Effort','+1 Effort from Good Night’s Rest, on top of your maximum. It lasts until you spend it or finish your next rest, and works even in the Miasma. Spending uses it first.','r-good-nights-rest'],
  'tip-minor-treasures':['Minor Treasures (d100)','Everyday finds: gear, tools, crafting materials, corpses to harvest, art objects and gems worth 25–500 gc, rank 0–1 spellbooks. Roll it when the party helps travelers, finds a Treasure Hunt result, or you need a small reward. 100 = roll Major instead.','ref-treasure-tables'],
  'tip-major-treasures':['Major Treasures (d100)','Valuable finds: magic items and wands, fine and masterwork gear, special-material weapons and armor, gems and art objects up to thousands of gc, rank 2–5 spellbooks. 01 = roll Minor instead.','ref-treasure-tables'],
  'tip-what-s-the-gem':['What’s the gem? (d100)','Names the gem: agate … zircon. It does not set the value — you do, or the treasure table already did (“Gem worth 100 gc”). A gem card takes 1 slot and stacks 5. Rolled automatically when a treasure roll gives a gem.','ref-treasure-tables'],
  'tip-what-s-the-art-object':['What’s the art object? (d10)','Says what it is and its size, which sets its slots: Tiny 1 slot (stacks 5), Small 1, Medium 2, Large 16, Huge 54. You set the value. Rolled automatically when a treasure roll gives an art object.','c-treasure']};
const LOOT=JSON.parse(store.get('loot')||'[]');
const saveLoot=()=>store.set('loot',JSON.stringify(LOOT));
const curLoot=()=>LOOT.find(x=>x.id===S.lib.pick);
const lootSummary=p=>p.items.map(x=>x.id==='gold-coins'?`${x.n} gc`:(x.n>1?x.n+'× ':'')+shown(x).name).join(', ')||'empty';
function lootAdd(id,n){const p=curLoot(),ex=p.items.find(x=>x.id===id&&!LORE_BOOKS[id]);if(ex)ex.n+=n;else p.items.push({id,n});saveLoot()}
// Hints: glossary terms, rule-book sections, expertise lines, button tips → [title, short html, full rule key]
function expInfo(name){for(const p of BOOK['r-effort-expertise'].body)for(const r of p.tb||[]){const n=r[0].replace(/^Expertise /,'');if(n===name)return r[1].replace(/^Use /,'')}}
const expChip=e=>`<span class="chip hint" data-term="x-${esc(e)}" tabindex="0">${esc(e)}</span>`;
function termInfo(k){
  if(GLOSS[k])return GLOSS[k];if(TIPS[k])return TIPS[k];
  if(k.startsWith('npc-')){const t=NPCT.find(x=>x[0]===k.slice(4));if(t)return [t[0],esc(t[1]),'c-npc-connection']}
  if(k.startsWith('x-')){const n=k.slice(2),u=expInfo(n),kind=['Bashing','Bow','Chopping','Slashing','Stabbing','Unarmed'].includes(n)?'Weapon':['Alteration','Benefaction','Conjuration','Elemental','Illusion','Necromancy'].includes(n)?'Spellcasting':'General';
    return [n,`${kind} expertise${u?': '+esc(u):''}. After a non-doom test it applies to, spend 1 [[effort|Effort]] to raise the result one tier.`,'r-effort-expertise']}
  if(k.startsWith('mi-')&&ME){const m=ME.miasma.find(x=>x.n===k.slice(3)),r=m&&fxRow(m);if(m)return [esc(m.n),`${esc(m.t)}<br><b>Also:</b> ${esc(m.up||r.up||'')}<br><i>Lasts ${DUR_TXT[m.dur||r.dur]||'as the table says'}.</i>`,'miasma']}
  if(k.startsWith('en-')){const e=enchants()[k[3]+':'+k.slice(5)];if(e)return [esc(e.n),esc(e.t),e.rule]}
  if(k.startsWith('tr-')){const t=TRAIT[k.slice(3)];if(t)return [esc(t.n),esc(t.t),'traits']}
  if(BOOK[k])return [BOOK[k].t,esc(secText(BOOK[k]).replace(/\*\*/g,'').slice(0,260))+'…']}
LIBS_EXTRA={presets:()=>{const p=curLoot();
  return listDetail('Loot presets',[['',LOOT.filter(x=>lmatch(x.name)).map(x=>[x.id,x.name||'Untitled',`${x.items.length} item${x.items.length===1?'':'s'}`])]],
   p?`<label class="fld"><b>Name</b><input type="text" data-loot="name" value="${esc(p.name)}" placeholder="e.g. Room 4 chest"></label>
     <label class="fld"><b>Note for players</b><input type="text" data-loot="note" value="${esc(p.note)}" placeholder="e.g. under the altar"></label>
     <table class="rt form lootrows">${p.items.map((x,k)=>`<tr><td><a href="#item/${x.id}" data-action="open-item" data-id="${x.id}">${esc(IT[x.id].name)}</a>${isMagic(IT[x.id])?`<label class="check small"><input type="checkbox" data-loot-u="${k}" ${x.u??true?'checked':''}> unidentified</label>`:''}</td><td><input type="number" min="1" data-loot-n="${k}" value="${x.n}" aria-label="How many"></td><td><button class="xbtn" data-action="loot-rm" data-k="${k}" aria-label="Remove">✕</button></td></tr>${enchKind(IT[x.id])?`<tr class="sub"><td colspan="3">${enchPickHTML(x.base||x.id,x.ench||[],k)}</td></tr>`:''}${LORE_BOOKS[x.id]?`<tr class="sub"><td colspan="3"><label class="small">About <select data-loot-t="${k}" style="max-width:100%"><option value="">Player picks at rest</option>${LORE_EXP.map(e=>`<option ${x.topic===e?'selected':''}>${e}</option>`).join('')}</select></label></td></tr>`:''}`).join('')||'<tr><td colspan="3" class="muted small">Empty — add cards, gold or your own items below.</td></tr>'}</table>
     <h3 class="sec-h sm">Add a card</h3>${pickerHTML('preset','lootpickadd',null)}
     <h3 class="sec-h sm">Add gold</h3><div class="row"><input type="number" id="lgold" min="1" placeholder="gc" aria-label="Gold coins"><button class="btn sm" data-action="loot-gold">Add gold</button></div>
     <h3 class="sec-h sm">Add your own item <span class="muted">a key, a map, a letter…</span></h3><div class="row"><input type="text" id="lcname" placeholder="e.g. Rusty iron key" aria-label="Item name"><label class="small">Slots <input type="number" id="lcslots" min="1" value="1" style="width:4rem"></label></div><input type="text" id="lctext" placeholder="What it does (optional)" aria-label="Item text" style="width:100%;margin-top:.4rem"><button class="btn sm" data-action="loot-custom" style="margin-top:.4rem">Add item</button>
     <div class="row" style="margin-top:1.25rem">${campNone()?'':`<button class="btn primary" data-action="loot-drop" data-v="${p.id}">Drop into loot pool now</button>`}<button class="btn danger" data-action="loot-del">Delete preset</button></div>`
   :`<p>Prepare a chest, a corpse’s pockets or a hoard before the session — cards, gold and your own items. During play, drop the whole preset into the loot pool with one click from Run game → Loot.</p><div class="row"><button class="btn primary" data-action="loot-new">+ New loot preset</button>${LOOT.length?'<button class="btn" data-action="loot-export">Export presets file</button>':''}<label class="btn cpfile">${nest('Import presets file')}<input type="file" class="lootfile-in" accept=".json,application/json"></label></div>`)}};
/* Loot presets travel as a file (owner, 2026-11-21: device data, made before any campaign exists): {format:'crow-nest-loot', v:1,
   presets, items: the Ref's own cards they name}. Import adds, never replaces: new ids, the cards this device lacks, unknown rows dropped. */
function lootFile(){const all=JSON.stringify(LOOT);return {format:'crow-nest-loot',v:1,exported:new Date().toISOString(),presets:LOOT,items:CUSTOM.filter(it=>all.includes('"'+it.id+'"'))}}
function lootImport(f){if(!f||f.format!=='crow-nest-loot'||f.v!==1||!Array.isArray(f.presets))throw Error(f?.format==='crow-nest-campaign'?'This is a campaign file: import it on Campaigns.':'This is not a CROW NEST loot presets file.');
  if(Array.isArray(f.items))for(const it of f.items)if(it&&typeof it.id==='string'&&it.name&&!IT[it.id]){addItemDef(it);CUSTOM.push(it)}store.set('customItems',JSON.stringify(CUSTOM));
  let n=0,lost=0;f.presets.forEach((p,k)=>{if(!p||typeof p!=='object')return;const items=(Array.isArray(p.items)?p.items:[]).filter(x=>{const ok=x&&IT[x.id]&&+x.n>0;if(!ok)lost++;return ok});
    LOOT.push({...p,id:'l'+Date.now().toString(36)+k,name:String(p.name||'Untitled').slice(0,80),note:String(p.note||'').slice(0,200),items});n++});
  saveLoot();return {n,lost}}



/* ---------- card picker: every card visible, category chips, filter as you type ---------- */
const PICK={};
function pickerHTML(key,act,sel){const P=PICK[key]||(PICK[key]={cat:'',q:''}),q=P.q.toLowerCase(),kw=key==='loot'&&S.lookup.kw;
  const cats=Object.entries(CATL).filter(([k])=>D.items.some(i=>i.cat===k));
  const list=D.items.filter(i=>!i.base&&(!P.cat||i.cat===P.cat)).sort((a,b)=>a.name.localeCompare(b.name));
  const hay=i=>(kw?[i.name,i.text,i.q,i.craft?.mats]:[i.name]).join(' ').toLowerCase();
  return `<div class="picker"><input type="search" class="pq" data-key="${key}" value="${esc(P.q)}" placeholder="Filter by name…" aria-label="Filter cards">
   <div class="chips" style="margin:.5rem 0">${[['','All'],...cats].map(([k,l])=>`<button class="chip ${P.cat===k?'on':''}" data-action="pcat" data-key="${key}" data-v="${k}">${l}</button>`).join('')}</div>
   <ul class="mlist plist">${list.map(i=>`<li data-q="${esc(hay(i))}" ${q&&!hay(i).includes(q)?'hidden':''}><button data-action="${act}" data-v="${i.id}" aria-current="${sel===i.id}">${esc(i.name)}<span>${CATL[i.cat]} · ${i.slots||1} slot${(i.slots||1)>1?'s':''} · ${gc(i.price)}</span></button></li>`).join('')}</ul></div>`}
// A folded section remembers whether it is open across renders (S.fold, this device only)
document.addEventListener('toggle',e=>{const d=e.target;if(d.tagName==='DETAILS'&&d.dataset.fold)S.fold[d.dataset.fold]=d.open},true);
const foldOpen=k=>S.fold[k]?' open':'';
document.addEventListener('input',e=>{const t=e.target;if(!t.classList.contains('pq'))return;PICK[t.dataset.key].q=t.value;const q=t.value.toLowerCase();$$('li[data-q]',t.closest('.picker')).forEach(li=>li.hidden=!!q&&!li.dataset.q.includes(q))});

/* ================= sections (Forge Steel: Home · Crows · Library · Session) ================= */
const VIEWS={
  home:()=>({title:'CROW NEST',body:homeHTML}),
  crows:()=>({title:'Crows',body:crowsHTML}),
  crow:()=>({title:ME.name,acts:S.role==='ref'&&!campNone()?`<button class="tbtn" data-action="go" data-v="session" aria-label="Back to the table" title="Back to the table"><span aria-hidden="true">←</span><span class="lbl"> Back to the table</span></button>`:''}),
  build:()=>({title:S.b.edit?'Edit crow':'New crow',body:buildHTML}), // Save and Cancel: the builder's bottom bar only (bFootHTML)
  library:()=>({title:'Look up',body:libHTML}),
  camps:()=>({title:'Campaigns',body:campsHTML}), // campaign.js: the Ref's save slots
  // Menu → Maps: the map maker (hexmap.js hxMapsBody, hexedit.js). Back to the table is the title bar's, the one way out (Esc too).
  maps:()=>({title:'Maps',acts:S.prep&&!sesOn()?'':`<button class="tbtn" data-action="go" data-v="session" aria-label="Back to the table" title="Back to the table"><span aria-hidden="true">←</span><span class="lbl"> Back to the table</span></button>`,
    body:()=>typeof hxMapsBody==='function'?hxMapsBody():''}),
  start:()=>({title:'',body:startHTML}), // lobby.js: the Ref's table before the start
  camp:()=>({title:'',body:lobCampHTML}), // lobby.js: a campaign between sessions
  homev:()=>({title:'',body:lobHomeVHTML}), // lobby.js: the home village, right after New campaign
  seat:()=>({title:(n=>S.ses?.camp?`${S.ses.camp} · session ${n}`:`Session ${n}`)(sesN()),body:seatHTML}), // session.js: who a player plays tonight; the bar names the campaign and the session (textContent), the Table CODE is on the status line
  session:()=>({title:'Run the game'}),
};
// Home: lobby.js (homeHTML), the first screen of the pre-game frame.
function crowsHTML(){
  if(!PARTY.length)return `<div class="b2-empty">${vsvg(B_IC.crow)}<h2>No crows yet</h2><div class="acts"><button type="button" class="btn primary" data-action="new-crow">${bsvg('plus')} Create a crow</button>
    <label class="btn crowfile">${bsvg('imp')}<b>${nest('Import from a file')}</b><input type="file" class="crowfile-in" accept=".json,application/json" aria-label="Import a crow from a file"></label></div></div>`; // crowfile.js reads the file
  const st=(k,v,bad)=>`<span class="hst${bad?' bad':''}${({Agi:' chr chr-A',Mind:' chr chr-M',Str:' chr chr-S'})[k]||''}"><small>${k}</small><b>${v}</b></span>`;
  // a dead crow says so in words and a mark, not only in its numbers (owner, 2026-11-23); its card is the record, like the starter's
  return `<div class="hcards">${PARTY.map((c,i)=>{const mx=stMax(c),dead=crowDead(c);return `<button class="opt hcard${dead?' dead':''}" data-action="open-crow" data-i="${i}">
    <span class="hc-top"><h3>${esc(c.name)}</h3><span class="muted small">${dead?`<span class="hc-dead">${typeof sSvg==='function'?sSvg('skull',16):''}Dead</span> · `:''}Level ${level(c).lv}</span></span>
    <span class="muted">${esc(c.bg)}${c.village?` of ${esc(c.village)}`:''}</span>
    ${dead?'':`<span class="hbar" aria-hidden="true"><i style="width:${100*c.stamina/mx}%"></i></span>`}
    <span class="hstats">${st('Stamina',`${c.stamina}/${mx}`,c.stamina===0)}${st('Wounds',c.wounds.size,c.wounds.size>=7)}${st('Agi',fmt(c.ch.A))}${st('Mind',fmt(c.ch.M))}${st('Str',fmt(c.ch.S))}</span></button>`}).join('')}
    <button class="opt hcard hnew" data-action="new-crow"><span class="plus" aria-hidden="true">+</span>Create a crow</button>${crowImportBtn('hcard hnew')}</div>`}

/* ---------- crow builder ---------- */
var LIBS_EXTRA;// NPC connection benefits, straight from the Character booklet (a bullet may continue in the next paragraph).
const NPCT=(()=>{const b=D.book.find(x=>x.id==='c-npc-connection').body,out=[];b.forEach((p,k)=>{const m=(p.li||'').match(/^\*\*([^*]+?):\*\*\s*(.*)/);if(m){let t=m[2];if(b[k+1]?.x&&/^[a-z]/.test(b[k+1].x))t+=' '+b[k+1].x;out.push([m[1],t])}});return out})();
const BG={};D.backgrounds.forEach(b=>BG[b.id]=b);
// Quotes are normalised: the Executioner's trait is spelled with ’ in its background and ‘ in its tree.
const qkey=s=>s.toLowerCase().replace(/[‘’]/g,"'");
const TRAIT={};D.traits.forEach(t=>TRAIT[t.tree+'|'+qkey(t.n)]=t);
const traitOf=b=>TRAIT[b.trait[0]+'|'+qkey(b.trait[1])];
// Crows built before that fix got no starting trait: give it back once.
PARTY.forEach(c=>{const b=D.backgrounds.find(x=>x.n===c.bg);if(b&&/[‘’]/.test(b.trait?.[1]||'')&&!(c.traits||[]).length){const t=traitOf(b);if(t)c.traits=[{n:t.n,tree:t.tree,t:t.t}]}});
const CHN={A:'Agility',M:'Mind',S:'Strength'};
const KIT=[{id:'coin-purse',n:1},{id:'knife',n:1},{id:'rope',n:1},{id:'ration',n:6}];
const chText=b=>b.ch==='Any'?'any characteristic':b.ch.map(k=>CHN[k]).join(' or ');
const bgGold=b=>b.extra.reduce((a,x)=>a+(+(x.match(/(\d+).*gold/)||[0,0])[1]),0);
function editBuild(c){const bg=D.backgrounds.find(b=>b.n===c.bg),bump=chBumps(c),base={A:c.ch.A-bump.A,M:c.ch.M-bump.M,S:c.ch.S-bump.S};let two=null,arr=null;
  if(bg)for(const t of bg.ch==='Any'?['A','M','S']:bg.ch){const k=chOptions({two:t}).findIndex(o=>['A','M','S'].every(q=>o[q]===base[q]));if(k>=0){two=t;arr=k;break}}
  S.b={edit:c.id,pic:c.pic||'',step:'details',bg:bg?.id||null,ok:true,two,arr,roll:null,gold:null,coins:String(coinsOf(c)),name:c.name,feature:c.feature||'',npc:c.npc||'',npcRel:c.npcRel||'',npcType:c.npcType||'',village:c.village||''};
  S.area='build';closePanel();render();scrollTo(0,0)}
// S.b.ok: the background is confirmed (step 1 folds the table into one line). A background from the Library arrives picked, not confirmed.
function newBuild(bg){S.b={step:'background',bg:null,ok:false,two:null,arr:null,hi:null,roll:null,gold:null,name:'',feature:'',coins:'',npc:'',npcRel:'',npcType:'',village:''};if(bg&&BG[bg])selectBg(bg);S.area='build';closePanel();render();scrollTo(0,0)}
function selectBg(id){const b=BG[id];Object.assign(S.b,{bg:id,two:b.ch!=='Any'&&b.ch.length===1?b.ch[0]:null,arr:null,hi:null})}
// Background sets one characteristic to 2; the other two are 1 and 0, or −1 and 2, either way round.
function chOptions(B){if(!B.two)return [];const [x,y]=['A','M','S'].filter(k=>k!==B.two);return [[1,0],[0,1],[-1,2],[2,-1]].map(([p,q])=>({[B.two]:2,[x]:p,[y]:q}))}
// The builder asks it as two questions: which of the other two is better (x leads in options 0 and 3), and by a little (1/0) or a lot (2/−1).
const bHi=B=>B.hi??(B.arr==null?null:['A','M','S'].filter(k=>k!==B.two)[B.arr===0||B.arr===3?0:1]);
const bArr=(B,hi,much)=>hi===['A','M','S'].filter(k=>k!==B.two)[0]?(much?3:0):(much?2:1);
// Two steps (owner, 2026-11-21, mockup A2 grid a): 1 Background & gold — the app rolls 2d6 on the book's 6×6 table, Confirm folds it,
// then the characteristics, the 3d6 gold and the starting board on one screen; 2 Name & details. Save and Cancel live in the bar at
// the bottom of the page (bFootHTML), never in the top bar. Each step fits one screen at 1440×900, 1024×768 and 768×1024 (builder.css).
const BSTEPS=[['background','Background & gold'],['details','Name & details']];
// Edit mode: the same steps over a crow in play. Background and gear stay as they are; the base characteristics may be re-picked
// within the background's options, and level-up bonuses (lvLog) go back on top.
const chBumps=c=>{const b={A:0,M:0,S:0};for(const x of Object.values(c.lvLog||{}))if(x.ch)b[x.ch]++;return b};
const editCrowOf=B=>B.edit&&PARTY.find(c=>c.id===B.edit);
// what step 1 still needs before Next ('' when done)
function bMissing(){const B=S.b,bg=BG[B.bg];if(editCrowOf(B))return '';if(!bg)return 'Roll 2d6 or tap your background first';if(!B.ok)return `Confirm ${bg.n} first`;
  if(B.arr==null)return 'Pick your characteristics first';if(B.coins==='')return 'Roll your gold first';return ''}
const bTotal=B=>(+B.coins||0)+bgGold(BG[B.bg]);
function bState(k){const B=S.b,bg=BG[B.bg],ec=editCrowOf(B);
  if(k==='background'){if(ec)return ['ok lock',`${bg?bg.n:ec.bg} · kept`];if(!bg)return ['','Roll for your background'];if(!B.ok)return ['','Confirm your background'];
    if(B.arr==null)return ['','Pick your characteristics'];if(B.coins==='')return ['','Roll your gold'];return ['ok',`${bg.n} · ${bTotal(B)} gc`]}
  return ['',B.step==='details'||ec||B.name.trim()?'Feature, village, connection':'Needs a name']}
const B_IC={ok:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',chg:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',right:'<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',left:'<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  imp:'<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',crow:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>'};
const bsvg=k=>vsvg(B_IC[k]);
// after a re-render the builder puts the keyboard back where the next step is — only for keyboard users: a tap or a click leaves no ring
let B_KEY=false;addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')B_KEY=true},true);addEventListener('pointerdown',()=>{B_KEY=false},true);
const bFocus=sel=>{if(B_KEY)$(sel)?.focus({preventScroll:true})};
// the step header: done = green tick, current = ring + rule, future = dashed number; a crow in play keeps step 1 (grey tick)
const bTabsHTML=()=>{const B=S.b,miss=bMissing();return `<nav class="b2-steps" id="btabs" aria-label="Builder steps">${BSTEPS.map(([k,l],n)=>{const [c,sub]=bState(k),cur=B.step===k,off=k==='details'&&!!miss;
  return `<button type="button" class="b2-step ${c}" data-action="bstep" data-v="${k}" aria-current="${cur?'step':'false'}"${off?' aria-disabled="true"':''}><span class="n" aria-hidden="true">${/ok/.test(c)&&(!cur||/lock/.test(c))?'✓':n+1}</span><span class="t"><b>${B.edit&&k==='background'?'Background':l}</b><small>${esc(sub)}</small></span></button>`}).join('')}</nav>`};
// the bar at the bottom of the page: Cancel at the left, the step's one way on at the right
function bFootHTML(){const B=S.b,ec=editCrowOf(B),named=!!B.name.trim(),miss=bMissing();
  const right=ec?`<button type="button" class="btn ${named?'primary':'off'}" data-action="bsave"${named?'':' aria-disabled="true"'}>Save changes</button>`
    :B.step==='background'&&BG[B.bg]&&!B.ok?`<button type="button" class="btn primary" data-action="bok">${bsvg('ok')} Confirm ${esc(BG[B.bg].n)}</button>` // a picked background is confirmed here, where Next comes after (owner, 2026-11-21)
    :B.step==='background'?`<button type="button" class="btn ${miss?'off':'primary'}" data-action="bnext" data-v="details"${miss?' aria-disabled="true"':''}>Next: Name &amp; details ${bsvg('right')}</button>`
    :`<button type="button" class="b2-tert b2-back" data-action="bnext" data-v="background">${bsvg('left')} Background</button><button type="button" class="btn ${named?'primary':'off'}" data-action="bsave"${named?'':' aria-disabled="true"'}>Save crow</button>`;
  return `<div class="b2-foot" id="bfoot"><button type="button" class="b2-tert" data-action="bcancel">Cancel</button><span class="b2-sp"></span>${right}</div>`}
// the book's table: first die down, second die across; each word kept whole (owner: names never break inside a word)
const bWords=n=>esc(n).split(' ').map(w=>`<span class="w">${w}</span>`).join(' ');
const bRolled=(B,b)=>!!B.roll&&b.d.join()===B.roll.join();
function bTableHTML(){const B=S.b,r=[1,2,3,4,5,6];
  return `<div class="b2-t" role="group" aria-label="Backgrounds: first die down, second die across"><span class="h" aria-hidden="true"></span>${r.map(n=>`<span class="h" aria-hidden="true">${n}</span>`).join('')}
  ${r.map(a=>`<span class="h" aria-hidden="true">${a}</span>${r.map(c=>{const b=D.backgrounds.find(x=>x.d[0]===a&&x.d[1]===c);if(!b)return '<span></span>';
    return `<button type="button" class="b2-c" id="b2c-${b.id}" data-action="bbg" data-v="${b.id}" aria-pressed="${B.bg===b.id}" aria-label="${esc(b.n)}, ${a}·${c}${bRolled(B,b)?', rolled':''}"><span class="nm">${bWords(b.n)}</span></button>`}).join('')}`).join('')}</div>`}
// what a background gives, never cut: mode 'sel' (picked: ring + Confirm) or 'peek' (hover / focus)
function bDetailHTML(id,mode){const b=BG[id],B=S.b;
  if(!b)return `<aside class="b2-detail" id="b2-detail"><div class="b2-none"><b>Your background</b>Roll 2d6, or tap the one you rolled at the table.</div></aside>`;
  const tr=traitOf(b),sel=mode==='sel',rolled=bRolled(B,b),also=b.extra.filter(x=>!/gold/.test(x)),gold=bgGold(b);
  const gi=b.items.map(x=>{const it=IT[x.id];return `<span class="b2-gi">${inventoryIcon(it)}<span>${esc(it.name)}${x.n>1?` ×${x.n}`:''}</span></span>`}).join('')+also.map(x=>`<span class="b2-gi b2-gx"><span>${esc(x[0].toUpperCase()+x.slice(1))}</span></span>`).join('')+(gold?`<span class="b2-gi b2-gx"><span>${gold} gold coins</span></span>`:'');
  const ex=[...b.exp.gen,...b.exp.wpn,...b.exp.mag];
  return `<aside class="b2-detail${sel?' on':''}" id="b2-detail" data-id="${b.id}" aria-label="${esc(b.n)}">
   <div class="hd"><h2>${esc(b.n)}</h2><span class="b2-code${rolled?' on':''}">${rolled?'rolled ':''}${b.d.join('·')}</span>
    <span class="meta"><span><b>2 in</b> ${b.ch==='Any'?'any':b.ch.map(k=>CHN[k]).join(' or ')}</span><span><b>Stamina</b> ${b.st}</span></span></div>
   <p class="desc">${esc(b.desc)}</p>
   <div class="rw"><span class="b2-lbl">Expertises</span><span class="chips">${ex.map(expChip).join('')||'<span class="muted">none</span>'}</span></div>
   ${tr?`<div class="rw trait"><span class="b2-lbl">Starting trait</span><div><span class="chip hint" data-term="tr-${esc(tr.tree+'|'+tr.n.toLowerCase())}" tabindex="0">${esc(tr.n)}</span><p>${linkify(tr.t)}</p></div></div>`:''}
   <div class="rw"><span class="b2-lbl">Starting gear</span><div class="b2-gear">${gi}</div></div></aside>`}
// the Library's background card (Look up → Backgrounds)
function bgDetail(b){const tr=traitOf(b),ex=[['General',b.exp.gen],['Weapon',b.exp.wpn],['Spellcasting',b.exp.mag]].filter(x=>x[1].length);
  return `<div class="row" style="justify-content:space-between"><h2 class="opt-h">${esc(b.n)}</h2><span class="chip">2d6 · ${b.d.join(' · ')}</span></div><p>${esc(b.desc)}</p>
  <table class="rt"><tr><td>Characteristic at 2</td><td>${chText(b)}</td></tr><tr><td><a class="term" href="#rule/stamina" data-term="stamina">Stamina</a></td><td>${b.st} <span class="small muted">+2 per level</span></td></tr>
   <tr><td><a class="term" href="#rule/speed" data-term="speed">Speed</a></td><td>5 squares <span class="small muted">every crow</span></td></tr>
   <tr><td><a class="term" href="#rule/effort" data-term="effort">Effort</a></td><td>2 <span class="small muted">every crow · spend 1 to raise a test result one tier</span></td></tr>
   ${ex.map(([l,a])=>`<tr><td>${l} <a class="term" href="#rule/expertise" data-term="expertise">expertise</a></td><td><div class="chips">${a.map(expChip).join('')}</div></td></tr>`).join('')}</table>
  ${tr?`<h3 class="sec-h sm"><a class="term" href="#rule/traits" data-term="traits" style="color:inherit">Starting trait</a></h3><p class="trait"><b>${esc(tr.n)}</b> <span class="muted small">(${esc(tr.tree)})</span> ${linkify(tr.t)}</p>`:''}
  <h3 class="sec-h sm">Equipment</h3><ul class="list-links">${b.items.map(x=>`<li><a href="#item/${x.id}" data-action="open-item" data-id="${x.id}">${esc(IT[x.id].name)}${x.note?` (${esc(x.note)})`:''}<span>${x.n>1?'×'+x.n+' · ':''}${IT[x.id].slots||1} slot${(IT[x.id].slots||1)>1?'s':''}</span></a></li>`).join('')}${b.extra.map(x=>`<li style="padding:.45rem .25rem;font-weight:700">${esc(x)}</li>`).join('')}</ul>
  <p class="small muted">Plus what every crow gets: coin purse, knife, rope, 6 rations and 3d6 gc.</p>`}
// A M S (coloured, as on the Sheet) and Stamina Effort Speed: two groups, kept apart
function bStatsHTML(){const B=S.b,ec=editCrowOf(B),bg=BG[B.bg],o=B.two&&B.arr!=null?chOptions(B)[B.arr]:null,bump=ec?chBumps(ec):{A:0,M:0,S:0};
  const v=k=>o?fmt(o[k]+bump[k]):ec?fmt(ec.ch[k]):B.two===k?fmt(2):'?',c=ec||(bg?buildCrow(B):null);
  const kp=(cls,l,x)=>`<div class="kpi ${cls} ${x==='?'?'q':''}"><span class="k">${l}</span><span class="v">${x}</span></div>`;
  return `<div class="b2-stats"><div class="b2-kpis">${['A','M','S'].map(k=>kp('chr chr-'+k,CHN[k],v(k))).join('')}</div>
    <div class="b2-kpis">${kp('','Stamina',c?stMax(c):'?')}${kp('','Effort',c?effMax(c):'?')}${kp('','Speed',c?speed(c):5)}</div></div>`}
// Better at / By how much (and Which is 2 when the background offers two or any): one question at a time, the open one raised
function bQuestionsHTML(){const B=S.b,bg=BG[B.bg],ec=editCrowOf(B),opts=bg.ch==='Any'?['A','M','S']:bg.ch,others=['A','M','S'].filter(k=>k!==B.two);
  if(ec&&B.two==null)return `<p class="b2-note">These no longer match one of your background’s starting options, so they can’t be re-picked here. Level-ups change them; Correct TXP on the Sheet takes level-ups back.</p>`;
  const hi=bHi(B),lo=hi&&others.find(k=>k!==hi),much=B.arr==null?null:B.arr>=2;
  const q=(go,l,n,b)=>`<div class="b2-q ${go?'go':''}" role="group" aria-label="${l}" style="--n:${n}"><span class="l">${l}</span>${b}</div>`,
    qb=(on,act,val,main,sub)=>`<button type="button" class="b2-opt" data-action="${act}" data-v="${val}" aria-pressed="${on}">${main}${sub?`<small>${sub}</small>`:''}</button>`;
  const bump=ec?chBumps(ec):{A:0,M:0,S:0},bumpNote=ec&&B.arr!=null&&Object.values(bump).some(Boolean)?`<p class="b2-note">Your level-up bonuses stay on top: ${['A','M','S'].filter(k=>bump[k]).map(k=>`${CHN[k]} +${bump[k]}`).join(', ')}.</p>`:'';
  return [!ec&&opts.length>1?q(!B.two,'Which is 2',opts.length,opts.map(k=>qb(B.two===k,'btwo',k,CHN[k])).join('')):'',
    B.two?q(!hi,'Better at',2,others.map(k=>qb(hi===k,'bhi',k,CHN[k])).join('')):'',
    hi?q(much==null,'By how much',2,qb(much===false,'bmuch',0,'A little',`${CHN[hi]} +1 · ${CHN[lo]} +0`)+qb(much===true,'bmuch',1,'A lot',`${CHN[hi]} +2 · ${CHN[lo]} −1`)):''].join('')+bumpNote}
// the chosen background on one line: d66 · name · flavour (may be cut here) · Change
function bChosenHTML(){const B=S.b,bg=BG[B.bg],ec=editCrowOf(B);
  return `<div class="box b2-sum"><span class="b2-code">${bg.d.join('·')}</span><h2>${esc(bg.n)}</h2><p>${esc(bg.desc)}</p>${ec?'<span class="b2-lock">Kept for a crow in play</span>':`<button type="button" class="b2-tert b2-chg" data-action="bchange">${bsvg('chg')} Change</button>`}</div>`}
const BODY={
  background:()=>{const B=S.b,bg=BG[B.bg],ec=editCrowOf(B);
    if(ec&&!bg)return `<div class="b2-stage"><div class="box"><p style="margin:0">This crow’s background isn’t one from the book, so it stays as it is.</p></div></div>`;
    if(!B.ok)return `<div class="b2-stage b2-pick"><div class="b2-left"><div class="b2-roll"><button type="button" class="btn ${B.bg?'':'primary'}" data-action="broll">${B.roll?bsvg('chg')+' Roll again':'Roll 2d6'}</button>
        ${B.roll?`<span class="res">${B.roll.join('·')}<small>first die ${B.roll[0]}, second ${B.roll[1]}</small></span>`:''}<span class="b2-sp"></span><button type="button" class="b2-tert b2-quiet hint" data-term="tip-dead-crow">Replacing a dead crow?</button></div>
      ${bTableHTML()}</div>${bDetailHTML(B.bg,'sel')}</div>`;
    const c=ec||buildCrow(B),rolled=B.gold||B.coins!=='',g=bgGold(bg),qs=bQuestionsHTML();
    const gold=ec?`<b>Gold</b> <span class="big">${coinsOf(ec)} <small>gc</small></span> <span class="dice">in your coin purse</span>`
      :`<b>Gold</b><button type="button" class="btn ${!rolled&&B.arr!=null?'primary':''}" data-action="bgold">${rolled?bsvg('chg')+' Roll again':'Roll 3d6'}</button>
        ${rolled?`<span class="big">${bTotal(B)} <small>gc</small></span>`:'<span class="big muted" aria-label="not rolled yet">—</span>'}`;
    const also=bg.extra.filter(x=>!/gold/.test(x)&&!/\(pet\)$/.test(x)),pets=(c.pets||[]).map(p=>p.name||MON[p.mon]?.name).filter(Boolean);
    return `<div class="b2-stage b2-done">${bChosenHTML()}
      <div class="b2-col">${qs?`<div class="box b2-chars">${qs}</div>`:''}${bStatsHTML()}<div class="box b2-gold">${gold}</div></div>
      <div class="box b2-col b2-boardbox"><h2 class="sec-h${ec?'':' b2-bh'}">${ec?'Your board <span class="muted">change it in Inventory</span>':'Starting board'}</h2><div class="b2-board">${boardHTML(c)}</div>
        ${pets.length||also.length?`<p class="b2-note">${pets.length?`<b>Pet:</b> ${esc(pets.join(', '))}`:''}${pets.length&&also.length?' · ':''}${also.length?`<b>Also:</b> ${esc(also.join(', '))}`:''}</p>`:''}</div></div>`},
  details:()=>{const B=S.b,ec=editCrowOf(B),f=(k,l,ph)=>`<label class="fld"><b>${l}</b><input type="text" data-b="${k}" value="${esc(B[k]||'')}" placeholder="${ph}" autocomplete="off"></label>`,pick=NPCT.find(x=>x[0]===B.npcType);
    const danger=ec?`<div class="b2-danger bdanger"><button type="button" class="btn sm" data-action="crow-export" aria-label="Export ${esc(ec.name)} to a file">Export to a file</button><span class="b2-sp"></span><button type="button" class="btn sm danger" data-action="crow-del" aria-label="Delete ${esc(ec.name)}">Delete</button></div>`:''; // opens the confirmation (askName)
    return `<div class="b2-stage b2-det"><div class="box b2-hero"><input class="b2-name ${B.name.trim()?'':'go'}" type="text" data-b="name" value="${esc(B.name)}" placeholder="Your crow’s name" aria-label="Your crow’s name" autocomplete="off">${bStatsHTML()}</div>
      <div class="box b2-col b2-who"><h2 class="sec-h">Who and where</h2>
        <div class="b2-pic">${crowAv({name:B.name||'?',pic:B.pic},64)}<div><b>Portrait</b> <span class="muted">optional</span><div class="row"><label class="b2-tert picfile">${nest(B.pic?'Replace':'Add a portrait')}<input type="file" class="pic-in" accept="image/*" aria-label="${B.pic?'Replace the portrait':'Add a portrait'}"></label>${B.pic?'<button type="button" class="b2-tert" data-action="pic-del">Remove</button>':''}</div></div></div>
        <div class="b2-form">${f('feature','Distinguishing feature','a tattoo, a smell, a voice…')}${f('village','Home village','only for your group’s first crows')}</div>${danger}</div>
      <fieldset class="box b2-col b2-conn"><legend class="sec-h">Village connection</legend><div class="b2-form">${f('npc','Name','e.g. Old Marta')}${f('npcRel','How you know them','e.g. the herbalist who raised me')}</div>
        ${chipBox({cls:'b2-typebox',aria:'checked',label:'What they do for you',action:'bnpc',sel:B.npcType,items:NPCT.map(([n])=>({v:n,label:esc(n)})),
          desc:`<p class="b2-type">${pick?`${cdName(esc(pick[0]))}${esc(pick[1])}`:'<span class="muted">Pick a type: what your connection does for you.</span>'}</p>`})}</fieldset></div>`}};
// A crow's board as read-only slots: tap one for the full card.
const boardHTML=c=>`<div class="inventory bboard">${[['hand','Hands'],['belt','Belt'],['pack','Backpack']].map(([sec,l])=>`<div class="bsec"><h3>${l}</h3><div class="btiles">${occ(c,sec).map((x,k)=>{const i=x?.i;
  if(!i)return `<span class="slot inv-slot empty"><span class="inv-empty-art"><span class="inv-slot-no">${k+1}</span></span><span class="inv-item-name">Empty</span></span>`;const it=shown(i);
  return `<button class="slot inv-slot ${x.k?'inv-linked':''}" data-action="item-pop" data-id="${it.id}" data-pop-key="${sec}${k}" aria-label="${esc(it.name)}: open its card"><span class="card inv-item tone-${inventoryVisual(it).tone}" data-id="${it.id}"><span class="inv-slot-no">${k+1}</span>${inventoryIcon(it,'',i.lit)}${i.count>1?`<span class="inv-count">${i.count}</span>`:''}${i.worn?`<span class="inv-equipped" role="img" aria-label="Worn" title="Worn">${INV_WORN_ICON}</span>`:''}</span><span class="inv-item-name">${esc(it.name)}</span></button>`}).join('')}</div></div>`).join('')}</div>`;
// The page: the step header, the step, the bar at the bottom (builder.css). The foot's height goes to --footh for the toast.
function buildHTML(){requestAnimationFrame(()=>{const f=$('#bfoot');document.documentElement.style.setProperty('--footh',f?f.offsetHeight+'px':'0px')});return `<div class="b2">${bTabsHTML()}${BODY[S.b.step]()}${bFootHTML()}</div>`}
// The table: hover or focus shows a background in the panel without a render; leaving the table shows the picked one again.
// Arrow keys move across the table (first die = row, second = column); Enter or Space picks.
{const shownId=()=>$('#b2-detail')?.dataset.id||'',peek=id=>{const d=$('#b2-detail');if(!d||S.area!=='build'||!S.b||S.b.ok||shownId()===(id||''))return;d.outerHTML=bDetailHTML(id,id===S.b.bg?'sel':'peek')},
    back=()=>S.b&&peek(S.b.bg),inT=n=>!!n?.closest?.('.b2-t');
  document.addEventListener('mouseover',e=>{const c=e.target.closest?.('.b2-c');if(c)peek(c.dataset.v)});
  document.addEventListener('mouseout',e=>{if(inT(e.target)&&!inT(e.relatedTarget))back()});
  document.addEventListener('focusin',e=>{const c=e.target.closest?.('.b2-c');if(c)peek(c.dataset.v)});
  document.addEventListener('focusout',e=>{if(inT(e.target)&&!inT(e.relatedTarget)&&!e.relatedTarget?.closest?.('#b2-detail'))back()});
  document.addEventListener('keydown',e=>{const c=e.target.closest?.('.b2-c');if(!c)return;const m={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[e.key];if(!m)return;
    e.preventDefault();const [r,k]=BG[c.dataset.v].d,n=D.backgrounds.find(x=>x.d[0]===Math.min(6,Math.max(1,r+m[0]))&&x.d[1]===Math.min(6,Math.max(1,k+m[1])));if(n)$(`#b2c-${n.id}`)?.focus()})}
function autoPlace(c,id,n,x={}){const it=IT[id];
  const order=it.cat==='weapon'||it.light?['hand','belt','pack']:it.cat==='alchemy'||it.cat==='ammo'?['belt','pack']:['pack','belt'];
  while(n>0){let pos=null;for(const sec of order){for(let k=0;k<LEN[sec]&&!pos;k++)if(!canPlace(c,id,sec,k))pos={sec,idx:k};if(pos)break}
    if(!pos){toast(`No room for ${it.name}`);return n}const q=pos.sec==='hand'?1:Math.min(n,it.stack||1);c.inv.push(inst(id,pos.sec,pos.idx,{...x,count:q}));n-=q}return 0} // how many found no slot (trade.js puts them in the pool)
function saveBuild(){const B=S.b,ec=editCrowOf(B);
  if(ec){if(!B.name.trim()){B.step='details';render();$('.b2-name')?.focus();return toast('Your crow needs a name')}
    journalRun(`Edited ${ec.name}`,[`crow:${ec.id}`],()=>{if(B.pic)ec.pic=B.pic;else delete ec.pic;picsSave();Object.assign(ec,{name:B.name.trim(),feature:B.feature.trim(),npc:B.npc.trim(),npcRel:(B.npcRel||'').trim(),npcType:B.npcType||'',village:B.village.trim()});
      if(B.two&&B.arr!=null){const o=chOptions(B)[B.arr],bump=chBumps(ec);for(const k of ['A','M','S'])ec.ch[k]=o[k]+bump[k]}});
    ME=ec;S.b=null;S.area='crow';render();scrollTo(0,0);return}
  const m=bMissing();if(m){B.step='background';render();return toast(m)}
  if(!B.name.trim()){B.step='details';render();$('.b2-name')?.focus();return toast('Your crow needs a name')}
  const c=buildCrow(B);if(B.pic)c.pic=B.pic;PARTY.push(c);picsSave();ME=c;store.set('crow',PARTY.length-1);
  const atTable=S.role!=='ref'&&typeof NET!=='undefined'&&!!NET.code;
  if(atTable&&!sesSeatOk())sesPick(c);/* made at a table with no crow picked yet: the one played (session.js) */
  // already playing a crow at the table: straight to “Who do you play?” (owner, 2026-11-21): the picker's own path and session rules
  // (inside a running session a crow out of it waits for the Ref). Outside a session the seat is let go as Change does; picking the
  // old crow again keeps the table as it was. The new crow stays on this device until it is picked (sync.js partyOut).
  const was=atTable&&sesSeatOk()&&S.seat!==c.id?PARTY.find(x=>x.id===S.seat):null;
  if(was){ME=was;store.set('crow',PARTY.indexOf(was));if(!sesOn()){S.seat=null;store.set('seat','')}S.b=null;S.area='seat';toast(`${c.name} is ready: pick who you play`);render();scrollTo(0,0);return}
  S.b=null;if(S.role==='player'&&!atTable){S.area='home';store.set('crowsopen','1')}else if(S.role==='player'&&!sesOn())S.area='seat';else{S.area='crow';S.tab.crow='sheet'}
  toast(`${c.name} joins the party`);render();scrollTo(0,0)}
// The crow these choices make, without saving it (the review step draws it too).
function buildCrow(B){const bg=BG[B.bg];
  const tr=traitOf(bg),pets=bg.extra.map(x=>(x.match(/^(.+) \(pet\)$/)||[])[1]).filter(Boolean).map(n=>{const w=n.toLowerCase().split(' ');return [w.join('-'),[...w].reverse().join('-')].find(id=>MON[id])}).filter(Boolean);
  const c=mkChar({name:B.name.trim(),bg:bg.n,feature:B.feature.trim(),stBase:bg.st,ch:B.two&&B.arr!=null?chOptions(B)[B.arr]:{A:0,M:0,S:0},exp:JSON.parse(JSON.stringify(bg.exp)),traits:tr?[{n:tr.n,tree:tr.tree,t:tr.t}]:[],npc:B.npc.trim(),npcRel:(B.npcRel||'').trim(),npcType:B.npcType||'',village:B.village.trim(),extra:bg.extra.filter(x=>!/gold/.test(x))});
  for(const x of [...bg.items,...KIT])autoPlace(c,x.id,x.n,LORE_BOOKS[x.id]&&LORE_EXP.includes(x.note)?{topic:x.note}:{});c.pets=pets.map(id=>mkPet(id));c.extra=c.extra.filter(x=>!/\(pet\)$/.test(x)||!pets.length);
  const p=purse(c);if(p)p.coins=Math.min(purseMax(p),(+B.coins||0)+bgGold(bg));
  const ar=c.inv.find(i=>IT[i.id].cat==='armor'&&!isShield(IT[i.id])&&i.sec==='pack');if(ar){ar.worn=true;ar.ad=IT[ar.id].ad}
  c.stamina=stMax(c);c.effort=effMax(c);return c}

/* ---------- library: categories → list → detail ---------- */
const LIB=[['Rules',[['rules','Rules & questions',D.book.length]]],['For players',[['items','Items',D.items.length],['backgrounds','Backgrounds',D.backgrounds.length],['traits','Traits',D.traits.length]]],['For the Ref',[['monsters','Monsters',D.monsters.length],['tables','Roll tables',D.tables.length],['presets','Loot presets',null]]]];
function libHTML(){return `<div class="lib"><nav class="libnav" aria-label="Library">${LIB.map(([g,cats])=>`<h3>${g}</h3>${cats.map(([k,l,n])=>`<button data-action="libcat" data-v="${k}" aria-current="${S.lib.cat===k}">${l}<span>${n??LOOT.length}</span></button>`).join('')}`).join('')}</nav><div>${(LIBS[S.lib.cat]||LIBS_EXTRA[S.lib.cat]||SCREENS[S.lib.cat])()}</div></div>`}
function listDetail(title,groups,detail){const q=S.lib.q;
  return `<div class="cols ld"><div class="lcol"><input type="search" data-action="lq" value="${esc(q)}" placeholder="Filter ${title.toLowerCase()}…" aria-label="Filter ${title}" style="width:100%">
   <div class="lscroll">${groups.filter(g=>g[1].length).map(([h,l])=>`${h?`<h3 class="small muted lgh">${esc(h)}</h3>`:''}<ul class="mlist">${l.map(([id,n,sub])=>`<li><button data-action="lpick" data-v="${id}" aria-current="${S.lib.pick===id}">${esc(n)}<span>${esc(sub)}</span></button></li>`).join('')}</ul>`).join('')||'<p class="muted small">Nothing matches.</p>'}</div></div>
   <div class="box ldetail" id="ldetail">${detail||`<div class="lempty"><b>${title}</b><span class="muted">Pick one from the list — or type to filter.</span></div>`}</div></div>`}
const lmatch=s=>!S.lib.q||s.toLowerCase().includes(S.lib.q.toLowerCase());
const LIBS={
  // the same search as the side panel, as a page: results open beside it
  rules:()=>`<div class="box"><input type="search" id="lridx" value="${esc(S.lib.q)}" placeholder="Rules, items${S.role==='player'?'':', monsters'}: attack, torch, heal…" aria-label="Search rules, items${S.role==='player'?'':' and monsters'}" style="width:100%"><div id="lridxr" style="margin-top:.5rem">${findResults(S.lib.q)}</div></div>`,
  items:()=>{const it=IT[S.lib.pick];return listDetail('Items',Object.entries(CATL).map(([k,l])=>[l,D.items.filter(x=>x.cat===k&&!x.base&&lmatch(x.name)).map(x=>[x.id,x.name,x.price!=null?gc(x.price):''])]),it&&`<h1 style="margin-bottom:.5rem">${esc(it.name)}</h1>${panelBody({t:'item',id:it.id})}`)},
  backgrounds:()=>{const b=BG[S.lib.pick];return listDetail('Backgrounds',[['',D.backgrounds.filter(x=>lmatch(x.n)).map(x=>[x.id,x.n,x.d.join('·')])]],b&&bgDetail(b)+`<button class="btn primary" data-action="new-crow" data-bg="${b.id}">Create a crow with this background</button>`)},
  traits:()=>{const t=D.traits[S.lib.pick];const trees=[...new Set(D.traits.map(x=>x.tree))];
    return listDetail('Traits',trees.map(tr=>[tr,D.traits.map((x,i)=>[String(i),x.n,x.xp.toLocaleString('en')+' XP',x]).filter(r=>r[3].tree===tr&&lmatch(r[3].n+' '+tr))]),
      t&&`<div class="muted small" style="text-transform:uppercase;letter-spacing:.06em">${esc(t.tree)} — ${esc(t.treeText)}</div><h1>${esc(t.n)}</h1><p><b>${t.xp.toLocaleString('en')} XP</b>${t.start?' · starting trait (no other trait needed)':''}</p><p>${linkify(t.t)}</p>
      ${D.backgrounds.filter(b=>traitOf(b)===t).map(b=>`<p class="small">Starting trait of <b>${esc(b.n)}</b>.</p>`).join('')}
      <h3 class="sec-h sm">Also in ${esc(t.tree)}</h3><ul class="list-links">${D.traits.map((x,i)=>[x,i]).filter(([x])=>x.tree===t.tree&&x!==t).map(([x,i])=>`<li><a href="#" data-action="lpick" data-v="${i}">${esc(x.n)}<span>${x.xp.toLocaleString('en')} XP</span></a></li>`).join('')}</ul>
      <p class="small muted"><a class="term" href="#rule/traits" data-term="traits">Buying traits</a>: after a rest; a starting trait, or one linked to a trait you have in the same tree.</p>`)},
};

/* ================= rule books: sections, search, common questions ================= */
const BOOK={},SUBS=[],BOOKN={Rules:'Rules',Character:'Character',Ref:'The Ref'};
D.book.forEach(s=>{BOOK[s.id]=s;s.body.forEach((p,n)=>{const m=(p.li||'').match(/^\*\*([^*]{2,40}?):?\*\*/);if(m)SUBS.push({t:m[1].replace(/:$/,''),id:s.id,n})})});
const plain=s=>String(s||'').replace(/<[^>]+>/g,'').replace(/\[\[[\w-]+\|([^\]]+)\]\]/g,'$1').replace(/\*\*/g,'');
const secText=s=>s.body.map(p=>p.x||p.li||p.roll||p.h||(p.tb||[]).flat().join(' ')).join(' ');
// "(see Opportunity Attacks)" → the section with that title; Rules book first.
const TITLE={};[...D.book].reverse().forEach(s=>TITLE[s.t.toLowerCase()]=s.id);
const titleId=x=>{x=x.toLowerCase().replace(/^the /,'');return TITLE[x]||TITLE[x.replace(/s$/,'')]||TITLE[x+'s']};
const termTitle=k=>GLOSS[k]?.[0]||BOOK[k]?.t;
const GLOSS_BOOK=k=>titleId(GLOSS[k][0].replace(/\s*\(.*\)$/,''));
function bookText(t){return linkify(t).replace(/\b(see|See) ((?:the )?[A-Z][\w’'\- ]*?)(?=[).;:,]|$)/g,(m,s,x)=>{const id=titleId(x);return id?`${s} <a href="#rule/${id}" data-action="open-rule" data-k="${id}">${x}</a>`:m})}
function bookBody(s){
  const B=s.body,out=[];let i=0;
  const pr=()=>{const head=B[i].roll;if(head)i++;const rows=[];while(i<B.length&&B[i].tier){rows.push([B[i].tier,bookText(B[i].x)]);i++}return prHTML(rows,{head:esc(head||'Result')})};
  while(i<B.length){const p=B[i];
    if(p.roll||p.tier){out.push(pr());continue}
    if(p.li){let h=`<ul class="blist"><li data-n="${i}">${bookText(p.li)}`;i++;while(i<B.length&&(B[i].roll||B[i].tier))h+=pr();out.push(h+'</li></ul>');continue}
    if(p.tb)out.push(`<div class="tw"><table class="rt"><tr>${p.tb[0].map(c=>`<th>${esc(c)}</th>`).join('')}</tr>${p.tb.slice(1).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`);
    else if(p.h)out.push(`<h4 class="bh">${esc(p.h)}</h4>`);
    else if(/^1\. /.test(p.x))out.push(`<ol>${p.x.split(/\s(?=\d\. )/).map(x=>`<li>${bookText(x.replace(/^\d\. /,''))}</li>`).join('')}</ol>`);
    else out.push(`<p>${bookText(p.x)}</p>`);
    i++}
  const up=s.path.length&&D.book.find(x=>x.book===s.book&&x.t===s.path.at(-1)&&x.lvl<s.lvl);
  const kids=D.book.filter(x=>x.book===s.book&&x.lvl>s.lvl&&x.path.at(-1)===s.t&&x.path.length===s.path.length+1);
  return `<div class="small muted" style="margin-bottom:.5rem">${BOOKN[s.book]} booklet, p. ${s.p}${s.path.length?' · '+s.path.map(t=>{const id=titleId(t);return id?`<a href="#rule/${id}" data-action="open-rule" data-k="${id}">${esc(t)}</a>`:esc(t)}).join(' › '):''}</div>
   <div class="book">${out.join('')}</div>
   ${kids.length?`<h3 class="sec-h sm">In this section</h3><ul class="list-links">${kids.map(x=>`<li><a href="#rule/${x.id}" data-action="open-rule" data-k="${x.id}">${esc(x.t)}</a></li>`).join('')}</ul>`:''}
   ${up?`<p class="small" style="margin-top:1rem">Part of <a href="#rule/${up.id}" data-action="open-rule" data-k="${up.id}">${esc(up.t)}</a></p>`:''}`}
// One search over common questions, glossary terms, book sections, named list entries (Flee, Grab…) and full text.
const qGo=t=>{const [id,b]=t.split('#');const s=b&&SUBS.find(x=>x.id===id&&x.t===b);return s?`data-k="${id}" data-n="${s.n}"`:`data-k="${id}"`};
function ruleSearch(q){
  const ws=q.toLowerCase().split(/[^a-z0-9’']+/).filter(Boolean);if(!ws.length)return [];
  const stem=w=>w.length>3?w.replace(/(es|s)$/,''):w;
  // match at the start of a word, so "action" doesn't find "Reaction"
  const res=ws.map(w=>new RegExp('(^|[^a-z])'+stem(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  const all=txt=>res.every(r=>r.test(txt));
  const score=t=>{t=t.toLowerCase();const q1=ws.join(' ');return t===q1?100:t.startsWith(q1)?85:all(t)?70:0};
  const faq=[],hits=[],body=[];
  for(const [g,l] of QUICK)for(const [qq,t,words] of l){const w=(words+' '+qq).toLowerCase().split(/[^a-z0-9’']+/);if(ws.every(x=>w.some(y=>y===x||y===stem(x)||x.length>2&&y.startsWith(x))))faq.push([qq,t,g])}
  for(const [k,g] of Object.entries(GLOSS)){const s=score(g[0]);if(s)hits.push([s+2,`data-k="${k}"`,g[0],'Quick rule'])}
  for(const s of D.book){const sc=score(s.t);if(sc)hits.push([sc,`data-k="${s.id}"`,s.t,BOOKN[s.book]+(s.path.length?' · '+s.path.join(' › '):'')]);else{const t=secText(s).toLowerCase();if(all(t))body.push([t.split(stem(ws[0])).length,s])}}
  body.sort((a,b)=>b[0]-a[0]);
  for(const x of SUBS){const sc=score(x.t);if(sc)hits.push([sc+1,`data-k="${x.id}" data-n="${x.n}"`,x.t,BOOK[x.id].t])}
  hits.sort((a,b)=>b[0]-a[0]||a[2].length-b[2].length);
  const snip=s=>{const t=secText(s).replace(/\*\*/g,''),i=t.toLowerCase().indexOf(ws.find(w=>t.toLowerCase().includes(w))||ws[0]);return (i>40?'…':'')+t.slice(Math.max(0,i-40),i+90)+'…'};
  return [['Common questions',faq.map(([qq,t,g])=>[qGo(t),qq,g])],['Rules',hits.slice(0,25).map(h=>h.slice(1))],['Mentioned in',body.slice(0,25).map(([,s])=>[`data-k="${s.id}"`,s.t,snip(s)])]].filter(g=>g[1].length);
}
const rlist=l=>`<ul class="list-links">${l.map(([a,t,sub])=>`<li><a href="#" data-action="open-rule" ${a}>${esc(t)}<span>${esc(sub)}</span></a></li>`).join('')}</ul>`;
function rulesResults(q){
  if(!q.trim())return `<p class="small muted">Type a word — attack, initiative, heal, hide, carry… — or pick a common question.</p>
    ${QUICK.map(([g,l],k)=>`<details class="qg" ${k<2?'open':''}><summary>${g}</summary>${rlist(l.map(([qq,t])=>[qGo(t),qq,'']))}</details>`).join('')}
    <h3 class="sec-h sm">The books</h3>${['Rules','Character','Ref'].map(b=>`<details class="qg"><summary>${BOOKN[b]} booklet</summary><ul class="list-links toc">${D.book.filter(s=>s.book===b).map(s=>`<li class="l${s.lvl}"><a href="#rule/${s.id}" data-action="open-rule" data-k="${s.id}">${esc(s.t)}<span>p. ${s.p}</span></a></li>`).join('')}</ul></details>`).join('')}
    <details class="qg"><summary>Quick rules glossary</summary>${rlist(Object.entries(GLOSS).sort((a,b)=>a[1][0].localeCompare(b[1][0])).map(([k,g])=>[`data-k="${k}"`,g[0],'']))}</details>`;
  const r=ruleSearch(q);
  return r.length?r.map(([h,l])=>`<h3 class="sec-h sm">${h}</h3>${rlist(l)}`).join(''):`<p>Nothing found for “${esc(q)}”. Try a shorter word, or browse the questions and books below.</p>`+rulesResults('');
}

/* ================= panel (rules, items, monsters) with history ================= */
const P={stack:[],i:-1};
const entryTitle=e=>{if(e.t==='inst'){const i=ME?.inv.find(i=>i.uid===e.uid);return i&&nm(i)}if(e.t==='pool'){const p=S.pool.find(p=>p.uid===e.uid);return p&&(S.area==='session'?IT[p.id].name:nm(p))}return e.t==='journal'?'Journal':e.t==='rule'?termTitle(e.k):e.t==='item'?IT[e.id]?.name:e.t==='mon'?MON[e.id]?.name:'Search'};
let panelNav=false; // true while handling a click that started inside the panel (or a hint opened from it)
// A hint key (vi-guild, x-Search, npc-…, button tips) is not a rule: open the full rule it points to.
const ruleKey=k=>GLOSS[k]||BOOK[k]?k:termInfo(k)?.[2];
function openPanel(e,push=true){if(e.t==='rule'&&!GLOSS[e.k]&&!BOOK[e.k]&&ruleKey(e.k))e={...e,k:ruleKey(e.k)};if(push&&!(panelNav&&document.body.classList.contains('panel-open'))){P.stack=[];P.i=-1}if(push){P.stack=P.stack.slice(0,P.i+1);P.stack.push(e);P.i=P.stack.length-1}renderPanel();document.body.classList.add('panel-open');closePops(0);hidePreview()}
function closePanel(){document.body.classList.remove('panel-open');if(/^#(rule|item|mon)\//.test(location.hash))history.replaceState(null,'',location.pathname+location.search)}
function renderPanel(){
  const e=P.stack[P.i];if(!e)return;
  const inventoryItem=invShown()&&e.t==='inst';
  $('#panel').classList.toggle('inventory',inventoryItem);$('#panel').classList.toggle('inv-item-panel',inventoryItem);
  $('[data-action=pback]').disabled=P.i<=0;$('[data-action=pfwd]').disabled=P.i>=P.stack.length-1;
  $('#ptitle').textContent=entryTitle(e)||'';
  const href=e.t==='rule'?`#rule/${e.k}`:e.t==='mon'?`#mon/${e.id}`:e.t==='item'?`#item/${e.id}`:'';
  $('#pnew').hidden=!href;if(href)$('#pnew').href=location.pathname+href;
  const prev=P.i>0?P.stack[P.i-1]:null,same=P.shown===e,top=$('#pbody').scrollTop;P.shown=e; // the same entry drawn again (a render) keeps its scroll
  $('#pbody').innerHTML=(prev?`<button class="backlink" data-action="pback">← Back to ${esc(entryTitle(prev))}</button>`:'')+panelBody(e);
  $('#pbody').scrollTop=same?top:0;
  if(!same&&e.n!=null){const li=$(`#pbody [data-n="${e.n}"]`);if(li){li.classList.add('hit');const pb=$('#pbody');pb.scrollTop+=li.getBoundingClientRect().top-pb.getBoundingClientRect().top-90}}
}
function panelBody(e){
  if(e.t==='rule'){const g=GLOSS[e.k];if(!g)return BOOK[e.k]?bookBody(BOOK[e.k]):'<p>Unknown rule.</p>';const bk=GLOSS_BOOK(e.k);return `<p style="font-size:1.05rem">${rich(g[1])}</p>${rich(g[2]||'')}${g[3]?.length?`<div class="rel"><span class="muted small" style="width:100%">Related</span>${g[3].filter(k=>GLOSS[k]).map(k=>`<a href="#rule/${k}" data-action="open-rule" data-k="${k}">${GLOSS[k][0]}</a>`).join('')}</div>`:''}${bk?`<p class="small" style="margin-top:1rem"><a href="#rule/${bk}" data-action="open-rule" data-k="${bk}">Read “${esc(BOOK[bk].t)}” in the ${BOOKN[BOOK[bk].book]} booklet →</a></p>`:''}`}
  if(e.t==='index')return `<input type="search" id="ridx" value="${esc(e.q||'')}" placeholder="Rules, items${S.role==='player'?'':', monsters'}: attack, torch, heal…" aria-label="Search rules, items${S.role==='player'?'':' and monsters'}" style="width:100%"><div id="ridxr" style="margin-top:.5rem">${findResults(e.q||'')}</div>`;
  if(e.t==='journal')return journalHTML();
  if(e.t==='mon')return `<div class="sb-acts"><button class="btn primary" data-action="fight" data-id="${e.id}">Add to combat</button></div>`+statblockHTML(MON[e.id]);
  let i=null,p=null,it;
  if(e.t==='inst'){i=ME?.inv.find(x=>x.uid===e.uid);if(!i)return '<p>This item is no longer in your inventory.</p>';it=shown(i)}
  else if(e.t==='pool'){p=S.pool.find(x=>x.uid===e.uid);if(!p)return '<p>Already taken.</p>';it=S.area==='session'?IT[p.id]:shown(p)}
  else it=IT[e.id];
  if(!it)return '<p>This item is unavailable in this context.</p>';
  const used=it.real?[]:usedIn(it.id),n=i?i.count:p?.count||1;
  const sub=i?instWhere(i):p?`In the party loot${p.from?' · from '+esc(p.from):''}`:'';
  const craft=it.craft?`<table class="rt"><tr><td>Expertise</td><td>${esc(it.craft.exp)}</td></tr><tr><td>Complexity</td><td>${it.craft.cx} <span class="small muted">(needs Mind ${it.craft.cx}+)</span></td></tr><tr><td>Materials</td><td>${matLinks(it.craft.mats)}</td></tr><tr><td>Goal</td><td>${it.craft.goal} crafting points</td></tr></table>`:'';
  const upg=it.upg?`<h4>Upgrades</h4>${it.upg.map(([q,pr,t])=>`<p class="trait"><b>${q}</b> (${gc(pr)}): ${esc(t)}</p>`).join('')}`:'';
  const uses=used.length?`<h4>Used to craft ${used.length} item${used.length>1?'s':''}</h4><ul class="list-links">${used.map(x=>`<li><a href="#item/${x.id}" data-action="open-item" data-id="${x.id}">${esc(x.name)} <span>${esc(x.craft.exp)} · cx ${x.craft.cx}</span></a></li>`).join('')}</ul>`:'';
  return `<div class="inv-detail-card ifx-panel">${itemHeadHTML(it,itemEyebrow(it),`${esc(it.name)}${n>1?` <span class="inv-muted">×${n}</span>`:''}`,sub,false,!!i?.lit)}
   ${itemFactsHTML(it,i,{ro:!i,n,src:p,vedit:p?valEditHTML(p,{pool:1}):i?valEditHTML(i,{c:PARTY.indexOf(ME)}):''})}</div>
   ${i&&i.unid?idTestHTML(i):''}
   ${i?`${itemQuickHTML(ME,i)}<div class="ifx-actions"><button class="btn primary" data-action="inv-move" data-uid="${i.uid}">Move</button><button class="btn" data-action="topool" data-uid="${i.uid}">${i.count>1?nest('Give to party'):'Give to party'}</button><button class="btn danger" data-action="discard" data-uid="${i.uid}">Throw away</button></div>`:''}
   ${p&&S.area==='crow'?`<div class="ifx-actions"><button class="btn primary" data-action="take" data-uid="${p.uid}">${p.count>1?nest('Take'):'Take'}</button></div>`:''}
   ${craft||upg||uses?`<details class="ifx-more"><summary>${[craft&&'Crafting',upg&&'Upgrades',uses&&'Used to craft'].filter(Boolean).join(' · ')}</summary>${craft?`<p class="small muted">${ifTerm('crafting','How crafting works')}</p>${craft}`:''}${upg}${uses}</details>`:''}`;
}
function matLinks(m){const map=[[/treated iron bars?/i,'treated-iron-bar'],[/iron bars?/i,'iron-bar'],[/hickory log/i,'hickory-log'],[/(\w+ ?\w*) parts?/i,null]];
  for(const [re,id] of map){const x=m.match(re);if(!x)continue;let tid=id;if(!tid){const f=x[1].toLowerCase().replace(/^\d+\s*/,'');tid=({monster:'creature-part',creature:'creature-part','blood creature':'blood-creature-part',angel:'angel-part',demon:'demon-part',plant:'plant-part',undead:'undead-part',animal:'animal-part'})[f.replace(/ part.*/,'')]}if(tid&&IT[tid])return esc(m).replace(esc(x[0]),`<a href="#item/${tid}" data-action="open-item" data-id="${tid}">${esc(x[0])}</a>`)}
  return esc(m)}

/* ================= nested hint popovers ================= */
const pops=[];let openT=0,closeT=0;
function closePops(from){while(pops.length>from)pops.pop().el.remove()}
function openPop(term){
  clearTimeout(closeT);const k=term.dataset.term,g=termInfo(k);if(!g)return;const full=GLOSS[k]?k:g[2]||k; // GLOSS[k][2] is the long text, not a link
  const host=term.closest('.pop');const lvl=host?+host.dataset.lvl+1:0;
  if(pops[lvl]&&pops[lvl].term===term)return;
  closePops(lvl);
  const el=document.createElement('div');el.className='pop';el.dataset.lvl=lvl;el.setAttribute('role','tooltip');
  el.innerHTML=`<h4>${g[0]}</h4>${term.dataset.note?`<p class="pnote">Now: ${esc(term.dataset.note)}</p>`:''}<div>${rich(g[1])}</div><div class="foot"><a href="#rule/${full}" data-action="open-rule" data-k="${full}">Full rule →</a>${term.classList.contains('hint')?'':`<span class="small muted">${lastPointer==='touch'?'tap the word again to open':'click the word to open'}</span>`}</div>`;
  $('#pops').appendChild(el);pops.push({el,term});
  const r=term.getBoundingClientRect(),W=document.documentElement.clientWidth,H=innerHeight,w=el.offsetWidth,h=el.offsetHeight;
  let top=r.bottom+8;if(top+h>H-8)top=Math.max(8,r.top-h-8);
  el.style.top=top+'px';el.style.left=Math.max(8,Math.min(W-w-8,r.left))+'px';
}
let lastPointer='mouse';
document.addEventListener('pointerdown',e=>lastPointer=e.pointerType,true);
document.addEventListener('pointerover',e=>{
  if(e.pointerType!=='mouse')return;
  const t=e.target.closest?.('.term,.hint'),p=e.target.closest?.('.pop');
  let keep=p?+p.dataset.lvl:-1;
  clearTimeout(openT);
  if(t){const own=pops.findIndex(x=>x.term===t);if(own>=0)keep=Math.max(keep,own);else openT=setTimeout(()=>openPop(t),280)}
  clearTimeout(closeT);closeT=setTimeout(()=>closePops(keep+1),320);
  // hover preview of inventory cards
  const c=e.target.closest?.('.slot>.card');
  if(c&&!dragging&&!p&&!t){if(prevFor!==c){clearTimeout(prevT);prevT=setTimeout(()=>showPreview(c),420)}}else if(!e.target.closest?.('.slot>.card')){clearTimeout(prevT);hidePreview()}
});
document.addEventListener('focusin',e=>{const t=e.target.closest?.('.term,.hint');if(t&&t.matches(':focus-visible'))openPop(t)});

/* ---------- big card preview on hover (desktop) ---------- */
let prevFor=null,prevT=0;
function showPreview(c){if(S.invPop&&!$('#inv-pop')?.hidden)return;const uid=+c.dataset.uid,i=uid?[...(ME?.inv||[]),...[...(ME?.pets||[]),...(ME?.hires||[])].flatMap(p=>p.inv)].find(x=>x.uid===uid):null,it=i?shown(i):!uid&&IT[c.dataset.id];if(!it||!c.isConnected)return;const pv=$('#preview');pv.classList.toggle('inv-preview',c.classList.contains('inv-item'));pv.innerHTML=cardHTML(it,i||null,{full:true,info:false,ro:true});prevFor=c;
  const r=c.getBoundingClientRect(),W=document.documentElement.clientWidth;const w=pv.offsetWidth,h=pv.offsetHeight;
  let left=r.right+12;if(left+w>W-8)left=r.left-w-12;if(left<8)left=8;pv.style.left=left+'px';pv.style.top=Math.max(8,Math.min(innerHeight-h-8,r.top))+'px';pv.classList.add('on')}
function hidePreview(){clearTimeout(prevT);prevFor=null;$('#preview').classList.remove('on')}

/* ================= inventory actions ================= */
const findInst=uid=>ME.inv.find(i=>i.uid===+uid);
function addCount(i,n){if(refPriced(i)){if(n>0)addVals(i,Array(n).fill(null));else takeVals(i,-n)}else i.count+=n;if(i.count<=0){ME.inv=ME.inv.filter(x=>x!==i);toast(`${nm(i)}: none left`)}}
// q: how many (the most valuable first) or the values askPieces picked. Pieces of different values join one pool entry, each keeping its value.
function toPool(i,q){const it=shown(i),go=takeVals(i,Array.isArray(q)?q:Math.min(q,i.count+0)),n=go.length;const ex=S.pool.find(p=>p.id===i.id&&!p.unid===!i.unid&&p.topic===i.topic&&p.from===ME.name);if(ex)addVals(ex,go);else S.pool.push(putVals({uid:UID++,id:i.id,count:n,from:ME.name,ud:i.ud,unid:i.unid,topic:i.topic},go));
  if(i.lit)i.lit=false;if(i.count<=0)ME.inv=ME.inv.filter(x=>x!==i);toast(`${it.name}${n>1?' ×'+n:''} → loot pool`)}
function dlgOk(dl,fn){dl.onclose=()=>setTimeout(()=>{PENDING=null},50);const f=$('form',dl);f.addEventListener('submit',e=>{if((e.submitter?.value||'ok')==='ok'){const v=fn;setTimeout(()=>{v();journalSettle()},0)}});$$('[data-close]',dl).forEach(b=>b.onclick=()=>dl.close())}
// A toast with an Undo button: the cheap way back for anything done by mistake.
function toastUndo(t,undo,btn='Undo'){const e=$('#toast');e.innerHTML=`<span class="tmsg">${esc(t)}</span> <button class="tundo" type="button">${btn}</button>`;e.classList.add('on');toastRoom(e);
  $('.tundo',e).onclick=()=>{toastOff(e);undo()};clearTimeout(toast.t);toast.t=setTimeout(()=>toastOff(e),6000)}
/* ================= journal: every change, who made it and when; Undo one, or Rewind to before it ================= */
// Snapshots per scope (a crow, the loot pool, the session, the villages), kept on this device. The host also lists what joiners did.
const DEV=store.get('dev')||(()=>{const d='d'+Math.random().toString(36).slice(2,8);store.set('dev',d);return d})();
let JOURNAL=[];try{JOURNAL=JSON.parse(store.get('journal')||'[]')}catch{}
const REMOTE_LOG={};
const saveJournal=()=>{JOURNAL=JOURNAL.slice(-80);store.set('journal',JSON.stringify(JOURNAL))}; // ponytail: 80 entries keep localStorage small; a session rarely needs more
const ser=v=>JSON.stringify(v,(k,x)=>x instanceof Set?[...x]:x);
function scopeGet(sc){const [k,id]=sc.split(':');return k==='crow'?ser(PARTY.find(c=>c.id===id)||null):k==='pool'?ser(S.pool):k==='session'?ser({dt:S.dt,rtravel:S.rtravel,combat:S.combat,phase:S.phase,here:S.here,xp:S.xp}):k==='journey'?ser(S.journey):k==='ses'?ser({...(S.ses||SES0()),cn:typeof campSession==='function'?campSession():0}):k==='places'?ser(PLACES):ser(VILLAGES)}
function scopeSet(sc,v){const [k,id]=sc.split(':'),o=JSON.parse(v);
  if(k==='crow'){const i=PARTY.findIndex(c=>c.id===id);if(o===null){if(i>=0){PARTY.splice(i,1);if(typeof crowGone==='function')crowGone(id)}if(ME?.id===id)ME=PARTY[0]||null}else{const c=reviveCrow(o);if(i<0&&typeof GONE==='object'&&GONE[id])c.back=Date.now(); /* Undo brings a deleted crow back at the table too */c.stamina=Math.max(0,Math.min(c.stamina,stMax(c)));c.effort=Math.max(0,Math.min(c.effort,effMax(c)));if(i>=0)PARTY[i]=c;else PARTY.push(c);if(!ME||ME.id===id)ME=c}S.pendingWounds=0}
  else if(k==='pool')S.pool=o;
  else if(k==='session'){Object.assign(S.dt,{fight:'',held:false,encs:[]},o.dt);S.rtravel=o.rtravel;S.combat=o.combat;S.phase=o.phase;store.set('phase',o.phase||'');S.here=o.here;S.xp=o.xp}
  else if(k==='journey'){if(o&&typeof o==='object'){S.journey=o;store.set('journey',JSON.stringify(o))}}
  else if(k==='ses'){const {cn,...x}=o||{};S.ses=sesFix(x);if(cn&&typeof campSetSession==='function')campSetSession(cn);saveSession()} // the session's start, a let-in, its end (session.js) // the day the journey was on (end of a day: rnextday)
  else if(k==='places'){PLACES.splice(0,PLACES.length,...(Array.isArray(o)?o:[]));savePlaces()}
  else{VILLAGES.splice(0,VILLAGES.length,...o);saveVillages()}}
let PENDING=null;
// Run a change and file it: label, scopes it touches, the change. quiet = no Undo toast (steppers, toggles).
function journalRun(label,scopes,fn,o={}){journalStart(label,scopes,o);const r=fn();journalSettle();return r}
function journalStart(label,scopes,o={}){PENDING={label,scopes,before:scopes.map(scopeGet),o}}
function journalSettle(label){const p=PENDING;PENDING=null;if(!p)return;if(label)p.label=label;syncDerived();let after=p.scopes.map(scopeGet);if(p.before.every((x,k)=>x===after[k]))return;
  // a dead crow stays dead: no wound or Stamina comes back (owner); only the Journal's Undo of the death itself, in its session
  const died=[];p.scopes.forEach((sc,k)=>{if(!sc.startsWith('crow:'))return;const B=JSON.parse(p.before[k]||'null'),F=JSON.parse(after[k]||'null');if(!B||!F)return;const bd=(B.wounds||[]).length>=10,fd=(F.wounds||[]).length>=10;
    if(!p.o.undo&&bd&&((F.wounds||[]).length<B.wounds.length||F.stamina>B.stamina)){scopeSet(sc,p.before[k]);after[k]=p.before[k];toast(`${B.name} is dead: no wound or Stamina comes back`)}
    if(!bd&&fd)died.push(F.name)});
  if(p.before.every((x,k)=>x===after[k]))return; // derived state first: the entry's “after” is what the next render keeps
  const cr=p.scopes.find(x=>x.startsWith('crow:'));
  const e={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),t:Date.now(),dev:DEV,who:cr?cr.slice(5):'ref',label:p.label,scopes:p.scopes,before:p.before,after,
    ...(sesOn()?{ses:S.ses.id}:{}),...(died.length?{death:true,deathOf:died.join(', ')}:{})}; // ses / death: a death is undone only in its session (session.js sesUndoWhy)
  JOURNAL.push(e);saveJournal();if(!p.o.quiet)toastUndo(e.label,()=>undoEntry(e));
  if(document.body.classList.contains('panel-open')&&P.stack[P.i]?.t==='journal')renderPanel();return e}
// Undo one action. If nothing touched its scope since, restore it exactly; otherwise put back only the fields it changed
// (numbers by their difference) and say which parts were kept because they changed again later.
const hhmm=t=>new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false});
// Undo labels always name the original action (or the time a rewind went back to), so chains never nest.
function undoEntry(e){if(!e||e.undone)return;const kept=[],what=e.what||e.label,kind=e.kind==='undo'?'redo':'undo';
  {const why=sesUndoWhy([e]);if(why)return toast(why)}
  journalStart(e.back?(kind==='redo'?`Cancelled going back to ${e.back}`:`Went back to ${e.back} again`):`${kind==='undo'?'Undid':'Redid'}: ${what}`,e.scopes,{quiet:true,undo:true});
  e.scopes.forEach((sc,k)=>{const cur=scopeGet(sc);if(cur===e.after[k])return scopeSet(sc,e.before[k]);
    const C=JSON.parse(cur),B=JSON.parse(e.before[k]),F=JSON.parse(e.after[k]);
    if(!C||!B||!F||Array.isArray(C)){kept.push(sc.split(':')[0]);return}
    for(const key of new Set([...Object.keys(B),...Object.keys(F)])){if(ser(B[key])===ser(F[key]))continue;
      if(ser(C[key])===ser(F[key]))C[key]=B[key];else if([B[key],F[key],C[key]].every(x=>typeof x==='number'))C[key]+=B[key]-F[key];else kept.push(key)}
    scopeSet(sc,ser(C))});
  e.undone=Date.now();if(e.undoes)JOURNAL.forEach(x=>{if(e.undoes.includes(x.id))delete x.undone});
  const u=journalSettle();if(u)Object.assign(u,{undoes:[e.id],what,kind,back:e.back});saveJournal();render();
  const msg=`${u?.label||(kind==='undo'?'Undid: ':'Redid: ')+what}${kept.length?` — kept ${kept.join(', ')} (changed again since)`:''}`;u?toastUndo(msg,()=>undoEntry(u),kind==='undo'?'Redo':'Undo'):toast(msg)}
const refView=()=>S.area==='session'||S.role==='ref';
// Rewind: undo this action and every later one you can see, newest first.
function rewindTo(e){const ref=refView(),later=JOURNAL.filter(x=>x.t>=e.t&&!x.undone&&(ref||x.who===e.who));
  const n=`${later.length} action${later.length>1?'s':''}`,at=hhmm(e.t);
  {const why=sesUndoWhy(later);if(why)return toast(why)}
  askYes(`Go back to ${at}?`,`Takes back ${n}: “${e.label}” and everything after it.`,'Go back',()=>{
    journalStart(`Went back to ${at} (${n} undone)`,[...new Set(later.flatMap(x=>x.scopes))],{quiet:true,undo:true});
    for(const x of [...later].reverse())x.scopes.forEach((sc,k)=>scopeSet(sc,x.before[k]));
    later.forEach(x=>x.undoes&&JOURNAL.forEach(y=>{if(x.undoes.includes(y.id))delete y.undone}));later.forEach(x=>x.undone=Date.now());
    const u=journalSettle();if(u)Object.assign(u,{undoes:later.map(x=>x.id),what:n,kind:'undo',back:at});saveJournal();render();
    const msg=`Went back to ${at} — ${n} undone`;u?toastUndo(msg,()=>undoEntry(u),'Redo'):toast(msg)})}
function journalHTML(){const ref=refView(),mine=ME?.id;
  const loc=JOURNAL.filter(e=>ref||e.who===mine||!PARTY.some(c=>c.id===e.who)&&e.who!=='ref').map(e=>({...e,local:true}));
  const all=[...loc,...(ref?Object.values(REMOTE_LOG).flat():[])].sort((a,b)=>b.t-a.t);
  if(!all.length)return '<p class="muted">Nothing yet. Damage, rests, purchases, traits and the rest of your changes show up here with the time. Undo takes one back; Go back takes back everything after it too.</p>';
  const who=w=>w==='ref'?'Ref':esc(PARTY.find(c=>c.id===w)?.name||'a crow'),tm=hhmm;
  return `<p class="small muted" style="margin:0 0 .75rem">${ref?'Everything done at this table, newest first.':`Your changes to ${esc(ME?.name||'your crow')}, newest first.`} <b>Undo</b> takes back one action; <b>Go back</b> also takes back everything after it.</p>
   <ol class="jlist">${all.map(e=>`<li class="${e.undone?'undone':''}"><time>${tm(e.t)}</time><div><b>${esc(e.label)}</b>${ref?`<span class="small muted">${who(e.who)}${e.local?'':' · on their device'}</span>`:''}</div>
     ${e.undone?'<span class="small muted">undone</span>':e.local?`<span class="jact"><button class="btn sm ghost" data-action="j-undo" data-v="${e.id}">${e.kind==='undo'?'Redo':'Undo'}</button>${sesJournalBtn(e)}<button class="btn sm ghost" data-action="j-rewind" data-v="${e.id}" title="Take back this and everything after it">Go back</button></span>`:''}</li>`).join('')}</ol>`}
// Deleting something big: type its name. Optionally download a copy first.
function askName(title,msg,name,ok,cb,copy){const dl=$('#dlg');
  dl.innerHTML=`<form method="dialog"><h2>${esc(title)}</h2>${msg?`<p class="muted">${esc(msg)}</p>`:''}<label class="fld"><b>Type “${esc(name)}” to confirm</b><input type="text" id="aname" autocomplete="off" style="width:100%"></label>
   ${copy?'<p style="margin:.5rem 0 0"><button type="button" class="btn sm ghost" id="acopy">Download a copy first</button></p>':''}<div class="row" style="justify-content:flex-end;margin-top:1rem"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn danger" value="ok" disabled>${esc(ok)}</button></div></form>`;
  const inp=$('#aname'),okb=$('button[value=ok]',dl);inp.addEventListener('input',()=>okb.disabled=inp.value.trim().toLowerCase()!==name.trim().toLowerCase());
  if(copy)$('#acopy').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([copy()],{type:'application/json'}));a.download=(name.replace(/[^\w-]+/g,'_')||'crow')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  dlgOk(dl,()=>cb());dl.showModal();inp.focus()}
function askYes(title,msg,ok,cb,safe){const dl=$('#dlg');dl.innerHTML=`<form method="dialog"><h2>${esc(title)}</h2>${msg?`<p class="muted">${esc(msg)}</p>`:''}<div class="row" style="justify-content:flex-end;margin-top:1rem"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn ${safe?'primary':'danger'}" value="ok">${esc(ok)}</button></div></form>`;dlgOk(dl,()=>cb());dl.showModal()}
function askNum(title,val,max,cb){const dl=$('#dlg');dl.innerHTML=`<form method="dialog"><h2 style="margin-bottom:.5rem">${esc(title)}</h2><input type="number" id="an" min="0" ${max!=null?`max="${max}"`:''} value="${val}" aria-label="${esc(title)}"><div class="row" style="justify-content:flex-end;margin-top:1rem"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" value="ok">OK</button></div></form>`;dlgOk(dl,()=>cb(parseInt($('#an').value)||0));dl.showModal();$('#an').select()}
function askQty(title,max,cb){if(max<=1)return cb(1);const dl=$('#dlg');dl.returnValue='';
  dl.innerHTML=`<form method="dialog"><h2 style="margin-bottom:.5rem">${esc(title)}</h2><p class="muted" style="margin:0 0 .6rem">How many of ${max}?</p><div class="row"><input type="number" id="qn" min="1" max="${max}" value="1" aria-label="Quantity"><button type="button" class="btn sm" data-q="1">1</button><button type="button" class="btn sm" data-q="${Math.ceil(max/2)}">Half</button><button type="button" class="btn sm" data-q="${max}">All ${max}</button></div><div class="row" style="margin-top:1rem;justify-content:flex-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" value="ok">OK</button></div></form>`;
  dl.onclick=e=>{const b=e.target.closest('[data-q]');if(b)$('#qn').value=b.dataset.q};
  dlgOk(dl,()=>cb(Math.max(1,Math.min(max,parseInt($('#qn').value)||1))));dl.showModal();$('#qn').select()}
// Which pieces of a stack: askQty when they are worth the same (or the player may not see their values, unidentified), else one count per
// value, most valuable first, with All (or “Most valuable n”). cb gets the values picked (valsOf order); takeVals/toPool take exactly those.
function askPieces(title,x,max,cb){const a=valsOf(x);max=Math.max(1,Math.min(max,a.length));
  if(a.length<=1||x.unid&&S.role!=='ref'||!refPriced(x)||a.every(v=>v===a[0]))return askQty(title,max,q=>cb(a.slice(0,q)));
  const G=[];for(const v of a){const g=G.find(g=>g.v===v);if(g)g.n++;else G.push({v,n:1})}
  const lab=v=>v==null?'Not valued yet':gc(v),dl=$('#dlg');dl.returnValue='';
  dl.innerHTML=`<form method="dialog" class="pk"><h2 style="margin-bottom:.5rem">${esc(title)}</h2><p class="muted" style="margin:0 0 .6rem">Which ones? ${max<a.length?`Up to ${max} of the ${a.length}`:`${a.length} in the stack`}, worth different amounts.</p>
   <div class="pk-list">${G.map((g,k)=>`<label class="pk-row"><span class="pk-v">${lab(g.v)}</span><input type="number" class="pk-n" data-k="${k}" min="0" max="${g.n}" value="${k?0:1}" aria-label="How many at ${lab(g.v)}, of ${g.n}"><span class="pk-of">of ${g.n}</span></label>`).join('')}</div>
   <p class="pk-sum" role="status" aria-live="polite"></p>
   <div class="row" style="margin-top:1rem"><button type="button" class="btn sm ghost" data-pk-all>${max<a.length?`Most valuable ${max}`:`All ${a.length}`}</button><span style="flex:1"></span><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" value="ok">OK</button></div></form>`;
  const ins=()=>[...dl.querySelectorAll('.pk-n')],pick=()=>ins().flatMap((e,k)=>Array(Math.max(0,Math.min(G[k].n,parseInt(e.value)||0))).fill(G[k].v));
  const upd=()=>{const p=pick(),k=p.filter(v=>v!=null),ok=p.length>=1&&p.length<=max;$('.pk-sum',dl).textContent=!p.length?'Pick at least one.':p.length>max?`That is ${p.length}: at most ${max}.`:`${p.length} piece${p.length>1?'s':''}${k.length?`, ${valWords({count:p.length,vals:p})}`:''}`;$('button[value=ok]',dl).disabled=!ok};
  const f=$('form',dl);f.addEventListener('input',upd);f.addEventListener('change',upd);f.addEventListener('click',e=>{if(!e.target.closest('[data-pk-all]'))return;let m=max;ins().forEach((el,k)=>{const t=Math.min(G[k].n,m);el.value=t;m-=t});upd()});
  upd();dlgOk(dl,()=>{const p=pick();if(p.length>=1&&p.length<=max)cb(p)});dl.showModal();ins()[0].focus()}
function firstFit(id,ignore){for(const sec of ['pack','belt','hand','magic'])for(let k=0;k<LEN[sec];k++)if(!canPlace(ME,id,sec,k,ignore))return {sec,idx:k};return null}
// x.vals: the pieces' values, most valuable first (finishPlace); else x.count pieces of x.val. A stack of the card takes them whatever
// they are worth (owner, 2026-11-18): the first n that fit, so the most valuable go in and the rest stay where they came from.
function placeNew(id,sec,idx,x={}){const it=IT[id],{vals,val,...y}=x,pv=n=>(vals||Array(n).fill(val??null)).slice(0,n);
  const o=occ(ME,sec)[idx];
  if(o&&o.i.id===id&&!o.i.unid===!x.unid&&it.stack>1&&sec!=='hand'){const room=it.stack-o.i.count;const n=Math.min(room,x.count||1);if(n<=0){toast(`That stack is full (${it.stack}).`);return false}addVals(o.i,pv(n));if((x.count||1)>n)toast(`${(x.count||1)-n} didn’t fit in the stack`);return n}
  const err=canPlace(ME,id,sec,idx);if(err){toast(err);return false}
  let n=x.count||1;if(sec==='hand')n=1;n=Math.min(n,it.stack||1);
  ME.inv.push(putVals(inst(id,sec,idx,Object.assign({},y,{count:n})),pv(n)));return n}
// A two-slot item dropped on either hand takes both hands.
const dropIdx=(it,sec,idx)=>sec==='hand'?Math.max(0,Math.min(idx,lenOf(ME||{},'hand')-sizeIn(it,'hand'))):idx;
// Swap: the item takes the slots it is dropped on; whatever is there moves into the slots it leaves, in order,
// each item in one piece (canPlace on a trial copy). Any size on either side: a two-hander on the belt for a knife and a torch, and back.
// Returns null when nothing is in the way, {err} when the displaced items do not fit, else {moves:[[uid,sec,idx]], hit}.
function swapPlan(c,i,sec,idx){
  const it=IT[i.id],n=sizeIn(it,sec),from={sec:i.sec,idx:i.idx,n:sizeIn(it,i.sec)};
  const t={...c,inv:c.inv.map(x=>({...x}))},me=t.inv.find(x=>x.uid===i.uid);
  const hit=[...new Set(occ(t,sec).slice(idx,idx+n).filter(x=>x&&x.i.uid!==i.uid).map(x=>x.i))].sort((a,b)=>a.idx-b.idx);
  if(!hit.length)return null;
  if(sec==='hand'&&i.count>1)return {err:`A hand holds one item: free a hand to take one ${nm(i)} from the stack.`};
  me.sec=null;hit.forEach(x=>x.sec=null);
  const err=canPlace(t,i.id,sec,idx,i.uid);if(err)return {err};
  me.sec=sec;me.idx=idx;const moves=[[i.uid,sec,idx]],names=hit.map(x=>nm(x)).join(' and ');
  for(const x of hit){
    if(from.sec==='hand'&&x.count>1)return {err:`A hand holds one item: move ${nm(x)} ×${x.count} first.`};
    const m=sizeIn(IT[x.id],from.sec);let at=-1,why='';
    for(let k=from.idx;k+m<=from.idx+from.n;k++){const e=canPlace(t,x.id,from.sec,k,x.uid);if(!e){at=k;break}why=why||e}
    if(at<0)return {err:/^Magic/.test(why)?why:`${names} won’t fit in the ${from.n} ${SEC_NAME[from.sec].toLowerCase()} slot${from.n>1?'s':''} ${nm(i)} leaves.`};
    x.sec=from.sec;x.idx=at;moves.push([x.uid,from.sec,at]);
  }
  return {moves,hit:hit.map(x=>x.uid)};
}
// Every move is filed in the journal: the toast says what happened and offers Undo.
function moveInst(i,sec,idx){
  if(!ME)return;journalStart(`Moved ${nm(i)}`,[`crow:${ME.id}`]);
  const msg=moveInstNow(i,sec,idx);journalSettle(typeof msg==='string'&&msg?msg:undefined)}
function moveInstNow(i,sec,idx){
  const it=IT[i.id];idx=dropIdx(it,sec,idx);if(i.sec===sec&&i.idx===idx)return;
  const o=occ(ME,sec)[idx],to=`${SEC_NAME[sec]} ${idx+1}`;
  if(o&&i.id==='gold-coins'&&isPurse(o.i))return pourCoins(i,[o.i]);
  if(o&&o.i!==i&&o.i.id===i.id&&!o.i.unid===!i.unid&&it.stack>1&&sec!=='hand'){const n=Math.min(it.stack-o.i.count,i.count);if(n<=0)return toast('That stack is full.');const go=takeVals(i,n);addVals(o.i,go);haulMove(ME,i.uid,o.i.uid,i.id,go);if(!i.count)ME.inv=ME.inv.filter(x=>x!==i);return afterMove([i],`Stacked ${nm(i)} in ${to}`)}
  const err=canPlace(ME,i.id,sec,idx,i.uid);
  if(err){const plan=swapPlan(ME,i,sec,idx);if(!plan)return toast(err);if(plan.err)return toast(plan.err);
    const moved=plan.moves.map(([uid,s,k])=>{const x=findInst(uid);x.sec=s;x.idx=k;return x});
    return afterMove(moved,`Swapped ${nm(i)} with ${moved.slice(1).map(nm).join(' and ')}`)}
  if(sec==='hand'&&i.count>1){const go=takeVals(i,1),h=putVals(inst(i.id,sec,idx,{ud:i.ud,unid:i.unid,topic:i.topic}),go);ME.inv.push(h);haulMove(ME,i.uid,h.uid,i.id,go);return afterMove([h],`Took 1 ${nm(i)} into ${to}`)}
  i.sec=sec;i.idx=idx;return afterMove([i],`Moved ${nm(i)} to ${to}`)}
// Loose coins dropped on a purse (or "Into purse") go inside as far as there is room.
function pourCoins(i,ps){const k=i.count-addCoins(ME,i.count,ps);if(!k)return toast('No room in the purse.');i.count-=k;if(!i.count)ME.inv=ME.inv.filter(x=>x!==i);const m=`${k} gc → coin purse${i.count?` — ${i.count} gc stay loose`:''}`;toast(m);render();return m}
// A light leaving the hand goes out (roll its UD); armor leaving the backpack is no longer worn.
function afterMove(moved,msg){const out=[];
  for(const x of moved){if(x.lit&&x.sec!=='hand'){x.lit=false;out.push(nm(x))}if(x.worn&&x.sec!=='pack')x.worn=false}
  const m=(msg||'')+(out.length?`${msg?' — ':''}${out.join(' and ')} doused: roll its UD now`:'');render();return m}
// q: how many (the most valuable first) or the values askPieces picked
function takeFromPool(p,q){
  const it=shown(p);const pos=firstFit(p.id);if(!pos)return toast(`No room for ${it.name} (${it.slots} slot${it.slots>1?'s':''}).`);const vals=pickVals(valsOf(p),q);
  S.placing={id:p.id,count:vals.length,pool:p.uid,unid:p.unid,topic:p.topic,vals};S.tab.crow='inventory';render();
}
// From the pool: the pieces picked (pl.vals) as the pool entry holds them now (another device may have taken some or the Ref changed a value).
// A haul row per value taken, pointing at the instance they went into.
function finishPlace(sec,idx){const pl=S.placing;if(!pl)return;const p=S.pool.find(x=>x.uid===pl.pool),want=p?pickVals(valsOf(p),pl.vals||pl.count):pl.vals;
  const n=placeNew(pl.id,sec,idx,{count:want?want.length:pl.count,ud:p?.ud,vals:want,unid:pl.unid,topic:pl.topic});if(!n)return;
  if(p){const got=takeVals(p,want.slice(0,n));if(p.count<=0)S.pool=S.pool.filter(x=>x!==p);if(p.from==='Ref'){const uid=occ(ME,sec)[idx]?.i.uid;for(const v of [...new Set(got)])(ME.haul??=[]).push({id:pl.id,n:got.filter(x=>x===v).length,val:v,note:p.note||'',skip:isPart(IT[pl.id]),uid})}}
  if(pl.buy!=null){payCoins(ME,pl.buy*n);const bv=VILLAGES.find(x=>x.id===pl.v);if(bv){if(pl.auc&&bv.auction[pl.id])bv.auction[pl.id].left-=n;vSpend(bv,pl.buy*n)}if(pl.extra){const o=occ(ME,sec)[idx];if(o)o.i.extra=pl.extra}toast(`Bought ${nm(pl)}${n>1?' ×'+n:''} for ${(pl.buy*n).toLocaleString('en')} gc → ${SEC_NAME[sec]} ${idx+1}`);pl.count-=n;if(pl.count>0)return render()}
  else toast(`${nm(pl)}${n>1?' ×'+n:''} → ${SEC_NAME[sec]} ${idx+1}`);S.placing=null;render()}

/* ---------- pointer drag (mouse + touch) ---------- */
let drag=null,dragging=false;
// Drop the drag if the pointer is lost (Alt+Tab, window blur, touch cancel) so no ghost card is left behind.
// ponytail: rAF loop only while a drag is live; speed grows the closer the pointer is to the edge.
let edgeRAF=0;
function edgeScroll(){if(!dragging||!drag){edgeRAF=0;return}const y=drag.cy,top=Math.max(0,$('#top').getBoundingClientRect().bottom)+90,bot=screenBottom()-90;
  const dy=y<top?-Math.min(28,(top-y)/3+4):y>bot?Math.min(28,(y-bot)/3+4):0;if(dy)($('#invov:not([hidden]) .invov-b')||window).scrollBy(0,dy);edgeRAF=requestAnimationFrame(edgeScroll)}
function cancelDrag(){$$('.card.ghost').forEach(g=>g.remove());document.body.classList.remove('is-dragging');const was=dragging;drag=null;dragging=false;if(was)render()}
['blur','pointercancel'].forEach(t=>addEventListener(t,cancelDrag));
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelDrag()});
document.addEventListener('pointerdown',e=>{
  if(dragging||$('.card.ghost'))cancelDrag();
  if(e.button!==0||e.target.closest('button,a,input,select'))return;
  const c=e.target.closest('.slot>.card');const pr=e.target.closest('.prow[data-pool]');
  if(!c&&!(pr&&S.area==='crow'))return;
  e.preventDefault(); // no text selection while dragging
  drag={x:e.clientX,y:e.clientY,uid:c?+c.dataset.uid:null,pool:pr?+pr.dataset.pool:null,src:c||pr,id:c?c.dataset.id:null};
});
document.addEventListener('pointermove',e=>{
  if(!drag)return;
  if(e.buttons===0&&e.pointerType==='mouse')return cancelDrag(); // button was released outside the window
  if(!dragging){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<7)return;dragging=true;hidePreview();closePops(0);getSelection().removeAllRanges();document.body.classList.add('is-dragging');
    const src=drag.uid?findInst(drag.uid):S.pool.find(p=>p.uid===drag.pool),id=src.id;const g=document.createElement('div');g.innerHTML=cardHTML(shown(src),drag.uid?src:null,{info:false,ro:true});drag.ghost=g.firstElementChild;drag.ghost.classList.add('ghost');document.body.appendChild(drag.ghost);drag.src.classList.add('dragging');
    $$('.slot[data-sec]').forEach(s=>{const ok=s.classList.contains('inv-slot')?inventoryCanTarget(ME,src,s.dataset.sec,+s.dataset.idx,!!drag.uid):!canPlace(ME,id,s.dataset.sec,+s.dataset.idx,drag.uid)||(occ(ME,s.dataset.sec)[+s.dataset.idx]?.i.id===id);s.classList.add(ok?'target':'nope')})}
  drag.cy=e.clientY;if(!edgeRAF)edgeRAF=requestAnimationFrame(edgeScroll);
  drag.ghost.style.left=e.clientX+8+'px';drag.ghost.style.top=e.clientY+8+'px';
  $$('.drop-hover').forEach(x=>x.classList.remove('drop-hover'));
  const el=document.elementFromPoint(e.clientX,e.clientY);const t=el&&(el.closest('.slot[data-sec]')||el.closest('#pool,#pooldrop,.inv-loot-tab'));if(t)t.classList.add('drop-hover');
});
document.addEventListener('pointerup',e=>{
  if(!drag)return;const d0=drag;drag=null;
  if(!dragging){if(d0.uid&&e.target.closest('.slot>.card')&&!e.target.closest('button,a,input,select'))cardTap(d0.uid,e.target.closest('.slot[data-sec]'));return}dragging=false;$$('.card.ghost').forEach(g=>g.remove());document.body.classList.remove('is-dragging');
  const el=document.elementFromPoint(e.clientX,e.clientY);
  const slot=el&&el.closest('.slot[data-sec]'),pool=el&&el.closest('#pool,#pooldrop,.inv-loot-tab');
  if(d0.uid){const i=findInst(d0.uid);
    if(pool){askPieces(`Give ${nm(i)} to the loot pool`,i,i.count,q=>{toPool(i,q);render()});render();return}
    if(slot){moveInst(i,slot.dataset.sec,+slot.dataset.idx);render();return}}
  else if(d0.pool&&slot){const p=S.pool.find(x=>x.uid===d0.pool);const go=vals=>{S.placing={id:p.id,count:vals.length,pool:p.uid,unid:p.unid,topic:p.topic,vals};finishPlace(slot.dataset.sec,+slot.dataset.idx)};askPieces(`Take ${nm(p)}`,p,p.count,go);if(p.count<=1)return}
  render();
});

// Tap a card to pick it up, then tap where it goes (keyboard: Enter on the card, then on the target).
function cardTap(uid,slot){
  hidePreview();
  // an item the player chose to place (bought, taken from the pool) goes first; the wounds still wait to be marked after it
  if(S.placing)return finishPlace(slot.dataset.sec,+slot.dataset.idx);
  if(S.pendingWounds){if(slot?.dataset.sec==='pack')A.wound({dataset:{v:slot.dataset.idx}});return}
  if(slot?.classList.contains('inv-slot')&&!S.moving)return inventorySelect(uid);
  if(!S.moving||S.moving===uid){S.moving=S.moving===uid?null:uid;return render()}tapMove(slot)
}
function tapMove(slot){const i=findInst(S.moving);S.moving=null;if(i&&slot)moveInst(i,slot.dataset.sec,+slot.dataset.idx);render()}
document.addEventListener('click',e=>{if(!S.moving||!e.target.closest('#pooldrop,#pool')||e.target.closest('[data-action]'))return;const i=findInst(S.moving);S.moving=null;if(i)askPieces(`Give ${nm(i)} to the loot pool`,i,i.count,q=>{toPool(i,q);render()});render()});
document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const c=e.target.closest?.('.slot>.card[data-uid]');if(!c||e.target!==c||c.closest('.petinv'))return;e.preventDefault();cardTap(+c.dataset.uid,c.closest('.slot[data-sec]'));if(!document.body.classList.contains('panel-open'))$(`.slot>.card[data-uid="${c.dataset.uid}"]`)?.focus()});

/* ---------- empty-slot search popover ---------- */
const sp=$('#searchPop');let spFor=null;
// Empty slot → every card that fits this slot is listed at once; chips and the filter narrow it down.
function openSlotSearch(cell){
  spFor={sec:cell.dataset.sec,idx:+cell.dataset.idx,cat:'',q:'',kw:false};
  const fits=D.items.filter(it=>it.cat!=='unidentified'&&!it.base&&!canPlace(ME,it.id,spFor.sec,spFor.idx)).sort((a,b)=>a.name.localeCompare(b.name));
  const cats=Object.entries(CATL).filter(([k])=>fits.some(i=>i.cat===k));
  sp.innerHTML=`<div class="row" style="justify-content:space-between;margin-bottom:.4rem"><b>Add to ${SEC_NAME[spFor.sec]} ${spFor.idx+1}</b><button class="xbtn" data-action="sp-close" aria-label="Close">✕</button></div>
   <input type="search" id="spq" placeholder="Filter ${fits.length} cards that fit…" aria-label="Filter cards" style="width:100%">
   <label class="check small" style="margin:.35rem 0"><input type="checkbox" id="spkw"> Also search card text</label>
   <div class="chips" id="spc" style="margin-bottom:.4rem">${[['','All'],...cats].map(([k,l])=>`<button class="chip ${k?'':'on'}" data-c="${k}">${l}</button>`).join('')}</div>
   <ul class="mlist" id="spl" style="max-height:min(22rem,50vh);overflow:auto"></ul>`;
  const draw=()=>{const q=spFor.q.toLowerCase(),hay=it=>(spFor.kw?[it.name,it.text,it.q]:[it.name]).join(' ').toLowerCase();
    const l=fits.filter(it=>(!spFor.cat||it.cat===spFor.cat)&&(!q||hay(it).includes(q)));
    $('#spl').innerHTML=l.map(it=>`<li><button data-id="${it.id}">${esc(it.name)}<span>${CATL[it.cat]||''} · ${it.slots||1} slot${(it.slots||1)>1?'s':''} · ${gc(it.price)}</span></button></li>`).join('')||'<li class="muted small" style="padding:.5rem">No card fits this slot with that filter.</li>';
    $$('#spc .chip').forEach(c=>c.classList.toggle('on',c.dataset.c===spFor.cat))};
  $('#spq').oninput=e=>{spFor.q=e.target.value;draw()};
  $('#spkw').onchange=e=>{spFor.kw=e.target.checked;draw()};
  $('#spc').onclick=e=>{const c=e.target.closest('.chip');if(c){spFor.cat=c.dataset.c;draw()}};
  $('#spl').onclick=e=>{const b=e.target.closest('button[data-id]');if(!b)return;const it=IT[b.dataset.id];placeNew(it.id,spFor.sec,spFor.idx,{count:1});closeSlotSearch();toast(`${it.name} added`);render()};
  draw();sp.classList.add('on');
  const r=cell.getBoundingClientRect(),W=document.documentElement.clientWidth;sp.style.left=Math.max(8,Math.min(W-sp.offsetWidth-8,r.left))+'px';sp.style.top=Math.max(8,Math.min(innerHeight-sp.offsetHeight-8,r.top))+'px';
  if(lastPointer!=='touch')$('#spq').focus();
}
function closeSlotSearch(){sp.classList.remove('on');spFor=null}

/* ================= events ================= */
const A={
  // Crows remembers the open sheet and its tab; tapping it again (or Close) goes up to the roster.
  go:b=>{let v=b.dataset.v;if(v==='crows'&&b.closest('#nav')&&S.crowOpen&&ME&&!/^(crow|crows|build)$/.test(S.area))v='crow';if(v==='crows')S.crowOpen=false;S.area=v;S.back=null;S.placing=null;closePanel();render();scrollTo(0,0)},
  // a link to a screen; Inventory opens over the screen instead (openInventory), the old tabs land on their sections (navFix)
  tab:b=>{const v=b.dataset.v;if(S.area==='crow'&&v==='inventory')return openInventory(b);S.tab[S.area]=v;if(S.hud){S.hud.dmg=false;S.hud.inv=false}render();scrollTo(0,0)},
  goto:b=>{const [a,t]=b.dataset.v.split('/');S.area=a;if(t&&a==='library'){S.lib.cat=t;S.lib.pick=null}else if(t)S.tab[a]=t;closePanel();render();scrollTo(0,0)},
  // the role is the page's (owner, 2026-11-21): the switch saves what this page holds, writes the role and reloads, so nothing of the
  // other role (the Ref's pool, clock, map, journey) stays in memory; a player on a device with campaigns plays in its own world (campKey)
  whoami:b=>{const r=b.dataset.v;if(r===S.role)return render();if(S.role){if(typeof campFlush==='function')campFlush();savePend()} // no role yet: nothing to keep
    // a players-only device keeps one set of keys for both roles: the table joined as a player is left, a Ref never rejoins it
    if(typeof NET!=='undefined'&&NET.code&&!CAMP_PWORLD&&lsGet('ctk-camps')==null)leaveTable();
    S.role=r;store.set('role',r);S.area='home';store.set('area','home');
    try{sessionStorage.setItem('ctk-tabtake','1')}catch{}
    CAMP_LOCK=true;location.reload()},
  // a door (journey.js) or a place in Move the party: the party goes there, or the toast says why not (sceneWhy)
  phase:b=>{const dl=b.closest('#dlg');if(dl)dl.close();sceneTo(b.dataset.v||'')},
  move:()=>moveDialog(),
  jump:b=>{const t=document.getElementById(b.dataset.v);if(!t)return;t.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});t.tabIndex=-1;t.focus({preventScroll:true})}, // the section, not a field in it: keyboard users read on from its heading
  // a screen of the bar
  view:b=>{const a=wsHome();if(!a||!wsNav(a).includes(b.dataset.v))return;S.area=a;S.tab[a]=b.dataset.v;S.placing=null;if(S.hud){S.hud.dmg=false;S.hud.inv=false}closePanel();render();scrollTo(0,0)},
  'inv-open':b=>openInventory(b),'invov-close':()=>closeInventory(),
  who:b=>openMenu('who',b),menu:b=>openMenu('main',b),
  net:()=>netDialog(),
  'open-crow':b=>{ME=PARTY[+b.dataset.i];store.set('crow',+b.dataset.i);S.mi={last:null};S.rest.act=null;S.rest.log=null;S.sell={sel:{},greed:{},val:{},to:{},ar:{}};S.back=b.dataset.back?S.area:null;S.crowOpen=true;S.area='crow';if(!b.dataset.keep)S.tab.crow='sheet';closePanel();render();scrollTo(0,0)},
  journal:()=>openPanel({t:'journal'}),
  'j-undo':b=>undoEntry(JOURNAL.find(e=>e.id===b.dataset.v)),
  'j-rewind':b=>{const e=JOURNAL.find(e=>e.id===b.dataset.v);if(e)rewindTo(e)},
  'crow-export':()=>crowExport(editCrowOf(S.b)||ME), // crowfile.js
  'crow-import':()=>{const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.className='crowfile-in';i.hidden=true;document.body.append(i);i.addEventListener('change',()=>setTimeout(()=>i.remove(),0));i.click()},
  'crow-del':()=>{const c=ME;askName(`Delete ${c.name}?`,'The crow leaves this device. Right after, Undo in the message at the bottom still brings it back.',c.name,'Delete',()=>{PARTY.splice(PARTY.indexOf(c),1);if(typeof crowGone==='function')crowGone(c.id);ME=PARTY[0]||null;store.set('crow',0);S.b=null;S.crowOpen=false;S.area='crows';render()},()=>JSON.stringify(crowFileOf(c)))}, // the same file Import reads (crowfile.js)
  'new-crow':b=>newBuild(b.dataset.bg),
  // the app rolls here (owner's exception for making a crow): 3d6 gold, 2d6 on the book's table; no typed-in rolls
  bgold:()=>{const B=S.b;if(editCrowOf(B))return;B.gold=[d(6),d(6),d(6)];B.coins=String(B.gold.reduce((a,x)=>a+x));render();bFocus('[data-action=bgold]')},
  bnpc:b=>{S.b.npcType=S.b.npcType===b.dataset.v?'':b.dataset.v;render()},
  bstep:b=>{const m=b.dataset.v==='details'&&bMissing();if(m)return toast(m);S.b.step=b.dataset.v;render();scrollTo(0,0)},
  bnext:b=>A.bstep(b),
  bok:()=>{if(!BG[S.b.bg])return;S.b.ok=true;render();bFocus('.b2-chars .b2-q.go .b2-opt,[data-action=bgold]')},
  bchange:()=>{S.b.ok=false;render();bFocus(`#b2c-${S.b.bg}`)},
  broll:()=>{const B=S.b;B.roll=[d(6),d(6)];const b=D.backgrounds.find(x=>x.d.join()===B.roll.join());if(b&&B.bg!==b.id)selectBg(b.id);render();bFocus('[data-action=bok]')},
  bbg:b=>{const id=b.dataset.v;if(!BG[id])return;if(S.b.bg!==id)selectBg(id);render();bFocus(`#b2c-${id}`)},
  btwo:b=>{Object.assign(S.b,{two:b.dataset.v,arr:null,hi:null});render()},
  bhi:b=>{const B=S.b,m=B.arr==null?null:B.arr>=2;B.hi=b.dataset.v;if(m!=null)B.arr=bArr(B,B.hi,m);render()},
  bmuch:b=>{const B=S.b;B.arr=bArr(B,bHi(B),b.dataset.v==='1');render()},
  bsave:()=>saveBuild(),
  bcancel:()=>S.b.edit?askYes('Discard your changes?','','Discard',()=>{S.b=null;S.area='crow';render()}):askYes('Discard this crow?','','Discard',()=>{S.b=null;S.area='crows';render()}),
  'crow-edit':()=>editBuild(ME),
  libcat:b=>{S.lib.cat=b.dataset.v;S.lib.q='';S.lib.pick=null;render()},
  lpick:b=>{S.lib.pick=b.dataset.v;render();if(matchMedia('(max-width:900px)').matches)$('#ldetail')?.scrollIntoView({block:'start'})},
  'rules-index':()=>A.find(),
  'open-rule':b=>openPanel({t:'rule',k:b.dataset.k,n:b.dataset.n!=null?+b.dataset.n:undefined}),
  'open-item':b=>{if(b.closest?.('#inv-pop'))inventoryClosePop();openPanel({t:'item',id:b.dataset.id})},
  'item-pop':b=>{S.invPop=S.invPop?.key===b.dataset.popKey?null:{item:b.dataset.id,key:b.dataset.popKey};hidePreview();inventoryPlacePop()},
  'comp-pop':b=>{const uid=+b.dataset.uid;S.invPop=S.invPop?.uid===uid?null:{comp:b.dataset.kind,k:+b.dataset.k,uid};hidePreview();inventoryPlacePop()},
  'comp-pick':b=>{(S.compPick??={})[b.dataset.kind]=b.dataset.v==='add'?'add':+b.dataset.v;S.compWound=null;S.invPop=null;render()},
  'comp-rename':b=>{S.compRename=b.dataset.kind+b.dataset.k;render();const i=$('.comp-name input');i?.focus();i?.select()},
  'comp-wmode':b=>{const key=b.dataset.kind+b.dataset.k;S.compWound=S.compWound===key?null:key;S.invPop=null;render()},
  'open-inst':b=>{if(b.closest?.('#inv-pop'))inventoryClosePop();openPanel({t:'inst',uid:+b.dataset.uid})},
  'inv-move':b=>{const i=findInst(b.dataset.uid);if(!i||S.pendingWounds||S.placing)return;S.invSelected=i.uid;S.invPop=null;S.moving=i.uid;S.tab.crow='inventory';closePanel();render();$(`.inv-item[data-uid="${i.uid}"]`)?.focus()},
  'inv-filter':b=>{S.invFilter=b.dataset.v;inventoryFilter()},
  'inv-close':()=>inventoryClosePop(),
  'inv-to':b=>{const i=findInst(b.dataset.uid);if(!i||S.pendingWounds||S.placing)return;hidePreview();moveInst(i,b.dataset.sec,+b.dataset.idx);if(ME.inv.includes(i)&&S.invPop?.uid===i.uid)S.invSelected=i.uid;render()},
  'loot-pick':b=>{S.invPop={pool:+b.dataset.uid};hidePreview();$$('.inv-loot-row').forEach(r=>r.classList.toggle('inv-selected',+r.dataset.pool===S.invPop.pool));inventoryPlacePop()},
  // the drawer's shown state depends on width (CSS), so read it back before flipping
  'loot-toggle':()=>{if(S.moving)return A['inv-give']();const pn=$('.inv-loot-panel');S.lootOpen=!(pn&&getComputedStyle(pn).display!=='none');render()},
  wmode:()=>{S.woundMode=!S.woundMode;inventoryClosePop();render()},
  'inv-give':()=>{const i=findInst(S.moving||S.invSelected);if(!i||S.placing||S.pendingWounds)return toast('Select an item to share with the party.');S.moving=null;A.topool({dataset:{uid:i.uid}})},
  'open-pool':b=>openPanel({t:'pool',uid:+b.dataset.uid}),
  'open-mon':b=>openPanel({t:'mon',id:b.dataset.id}),
  pback:()=>{if(P.i>0){P.i--;renderPanel()}}, pfwd:()=>{if(P.i<P.stack.length-1){P.i++;renderPanel()}}, pclose:closePanel,
  slot:b=>{if(S.placing)return finishPlace(b.dataset.sec,+b.dataset.idx);if(S.pendingWounds){if(b.dataset.sec==='pack')A.wound({dataset:{v:b.dataset.idx}});return}if(S.moving)return tapMove(b);openSlotSearch(b)},
  'sp-close':closeSlotSearch,
  take:b=>{const p=S.pool.find(x=>x.uid===+b.dataset.uid);closePanel();if(!p){render();return} // already taken or removed on another device
  if(p.id==='gold-coins'){const room=purseRoom(ME);if(room>0){const q=Math.min(room,p.count);addCoins(ME,q);p.count-=q;if(p.from==='Ref')(ME.haul??=[]).push({id:'gold-coins',n:q,val:1,note:p.note||''});if(!p.count)S.pool=S.pool.filter(x=>x!==p);toast(`${q} gc → your coin purse${p.count?` — ${p.count} gc left in the pool (needs a slot or another purse)`:''}`);return render()}}askPieces(`Take ${nm(p)}`,p,p.count,q=>takeFromPool(p,q))},
  'cancel-place':()=>{S.placing=null;S.moving=null;render()},
  // The Ref's value for a card printed without a price (valEditHTML): the pool entry, or a crow's instance and its haul rows
  rval:f=>{if(S.role!=='ref')return;const vs=rvalIn(f);if(vs.some(v=>v===undefined))return toast('Type a whole number of gc, 0 or more');
    const c=!f.dataset.pool&&PARTY[+f.dataset.c],x=f.dataset.pool?S.pool.find(p=>p.uid===+f.dataset.pool):c?.inv.find(i=>i.uid===+f.dataset.uid);
    if(!x){toast('That card is no longer there');return render()}
    if(valsOf(x).length!==vs.length){toast('That stack changed meanwhile: check the values and set them again');return render()} // a piece came or went on another device
    if(f.dataset.pool)putVals(x,vs);else setItemVals(c,x,vs);render()}, // the journal's toast says what was set (journalActions)
  'pool-remove':b=>{const p=S.pool.find(x=>x.uid===+b.dataset.uid);if(!p){render();return}if(!poolCanRemove(p))return toast('Only the Ref removes treasure from the pool. Take it, or ask the Ref.');S.pool=S.pool.filter(x=>x!==p);toast(`${nm(p)} removed from the pool`);render()},
  lvexp:b=>{(S.lvl[b.dataset.lv]??={}).exp=b.value;render()},
  lvch:b=>{(S.lvl[b.dataset.lv]??={}).ch=b.dataset.v;render()},
  lvok:b=>{const c=ME,lv=+b.dataset.lv,pick=S.lvl[lv],e=pick.exp;const k=allExp().wpn.includes(e)?'wpn':allExp().mag.includes(e)?'mag':'gen';c.exp[k].push(e);if(pick.ch)c.ch[pick.ch]=Math.min(4,c.ch[pick.ch]+1);(c.lvDone??=[]).push(lv);(c.lvLog??={})[lv]={exp:e,k,ch:pick.ch||null};delete S.lvl[lv];toast(`Level ${lv}: ${e}${pick.ch?`, ${CHN[pick.ch]} +1`:''}`);render()},
  'lore-spend':()=>{const c=ME;if(c.lore?.n){c.lore.n--;toast(`Spent 1 ${c.lore.exp} Effort`);render()}},
  tree:b=>{S.tree=b.dataset.v;S.tnode=null;render()},
  tnode:b=>{S.tnode=+b.dataset.k;render()},
  trefund:()=>{const c=ME,n=D.trees[S.tree].nodes[S.tnode??0].n,t=c.traits.find(x=>x.tree===S.tree&&x.n===n);if(!t||!t.xp||!canRefund(c,t))return;
    c.traits=c.traits.filter(x=>x!==t);c.xpSpent-=t.xp;render()},
  treset:()=>{const c=ME,tree=S.tree,l=c.traits.filter(t=>t.tree===tree&&t.xp),sum=l.reduce((a,x)=>a+x.xp,0);if(!l.length)return;
    askYes(`Reset ${tree}?`,`Refunds ${l.length} bought trait${l.length>1?'s':''} (${sum.toLocaleString('en')} XP). Starting traits stay.`,'Reset tree',()=>{c.traits=c.traits.filter(t=>!l.includes(t));c.xpSpent-=sum;render()})},
  'xp-unbank':()=>{ME.xpBank=0;render()},
  'xp-add':()=>askNum('XP gained',0,null,n=>{if(n>0){ME.xpBank=(ME.xpBank||0)+n;toast(`+${n} XP after your next rest`);render()}}),
  'trait-go':b=>{S.tree=b.dataset.v;const n=b.dataset.n;S.tnode=n?D.trees[S.tree].nodes.findIndex(x=>x.n===n):null;if(S.tnode<0)S.tnode=null;S.tab.crow='traits';render();scrollTo(0,0)},
  'xp-fix':()=>{const c=ME,dl=$('#dlg'),lvAt=n=>(LVL.filter(l=>n>=l.min).pop()||{lv:1}).lv;
    const fx=n=>{const out=[];for(const l of (c.lvDone||[]).filter(l=>l>lvAt(n))){const x=c.lvLog?.[l];out.push(`Level ${l}${x?` choices: ${x.exp}${x.ch?', +1 '+CHN[x.ch]:''}`:''}`)}let sp=c.xpSpent;const tr=c.traits.filter(t=>t.xp);for(let i=tr.length-1;i>=0&&sp>n;i--){sp-=tr[i].xp;out.push(`${tr[i].n} (${tr[i].xp.toLocaleString('en')} XP)`)}return out};
    dl.innerHTML=`<form method="dialog"><h2>Correct total XP</h2><p class="small muted" style="margin:0 0 .6rem">For fixing a mistake. Now ${c.txp.toLocaleString('en')} TXP, level ${level(c).lv}.</p><input type="number" id="an" min="0" value="${c.txp}" aria-label="Total XP"><div id="txpfx" class="small" aria-live="polite" style="margin-top:.6rem"></div>
      <div class="row" style="justify-content:flex-end;margin-top:1rem"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" value="ok">Set TXP</button></div></form>`;
    const upd=()=>{const n=parseInt($('#an').value)||0,l=fx(n);$('#txpfx').innerHTML=l.length?`<b style="color:var(--bad)">This also undoes:</b><ul style="margin:.3rem 0 0">${l.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<span class="muted">Level ${lvAt(n)}. Nothing else changes.</span>`};
    $('#an').addEventListener('input',upd);upd();
    dlgOk(dl,()=>{const n=parseInt($('#an').value)||0,was=level(c).lv,log=[];c.txp=n;
    // levels you no longer have: take back their expertise and characteristic
    for(const lv of [...(c.lvDone||[])].filter(l=>l>level(c).lv)){const x=c.lvLog?.[lv];if(x){c.exp[x.k]=c.exp[x.k].filter(e=>e!==x.exp);if(x.ch)c.ch[x.ch]--;delete c.lvLog[lv]}c.lvDone=c.lvDone.filter(l=>l!==lv);log.push(`level ${lv}${x?'':' (check its expertise by hand)'}`)}
    // traits you can no longer afford: newest purchases go first
    while(c.xpSpent>c.txp){const k=c.traits.findLastIndex(t=>t.xp);if(k<0)break;const t=c.traits.splice(k,1)[0];c.xpSpent-=t.xp;log.push(t.n)}
    c.stamina=Math.min(c.stamina,stMax(c));c.effort=Math.min(c.effort,effMax(c));
    toast(log.length?`Undone: ${log.join(', ')}`:level(c).lv!==was?`Level ${level(c).lv}`:'XP corrected');render()});dl.showModal();$('#an').select()},
  tbuy:()=>{const c=ME,k=S.tnode??0,T=D.trees[S.tree],nd=T.nodes[k],t=traitOfTree(S.tree,nd.n);if(traitState(c,S.tree,k)!=='open')return;if(t.xp>c.txp-c.xpSpent)return toast('Not enough XP');
    const x={n:t.n,tree:t.tree,t:t.t,xp:t.xp};S.tnode=k;c.xpSpent+=t.xp;c.traits.push(x);render()},
  'pet-add':()=>{const c=ME,v=vHere(),id=S.petPick||$('[data-action=pet-pick]').value,m=MON[id];if($('#petbuy')?.checked){const max=INST.stables.val[lvlOf(v,'stables')-1],pw=parseInt(m.st.Power)||0,price=Math.ceil((PET_PRICE(pw)??0)*(v.home?1:1.2));if(pw>max)return toast(`These stables sell pets up to power ${max}`);if(coinsOf(c)<price)return toast(`You need ${price} gc`);payCoins(c,price);vSpend(v,price);toast(`${m.name}: ${price} gc`)}(c.pets??=[]).push(mkPet(S.petPick||$('[data-action=pet-pick]').value,$('#petname').value.trim()));render()},
  'pet-del':b=>{const c=ME,p=c.pets[+b.dataset.k];askYes(`Let ${p.name} go?`,p.inv.length?'Cards it carries go back to you if there’s room, otherwise to the loot pool.':'','Let go',()=>{for(const i of [...p.inv])petBack(c,p,i);c.pets.splice(+b.dataset.k,1);render()})},
  'pet-st':b=>{const p=ME.pets[+b.dataset.k];p.st=Math.max(0,Math.min(petMax(p),p.st+ +b.dataset.d));render()},
  'pet-wound':b=>{const p=ME[b.dataset.kind||'pets'][+b.dataset.k],v=+b.dataset.v;p.wounds=p.wounds.includes(v)?p.wounds.filter(x=>x!==v):[...p.wounds,v];if(p.wounds.length>=p.len.pack&&p.len.pack)toast(`${p.name} dies.`);render()},
  'pet-take':b=>{const c=ME,p=c[b.dataset.kind||'pets'][+b.dataset.k],i=p.inv.find(x=>x.uid===+b.dataset.uid);petBack(c,p,i);render()},
  'hire-add':()=>{const c=ME,m=MON[S.hirePick||$('[data-action=hire-pick]').value];(c.hires??=[]).push({uid:UID++,mon:m.id,name:$('#hirename').value.trim()||m.name,st:parseInt(m.st.Stamina)||1,days:0,wounds:[],inv:[],len:{pack:parseInt(m.st.Slots)||0}});render()},
  'hire-del':b=>{const c=ME,h=c.hires[+b.dataset.k];askYes(`Dismiss ${h.name}?`,h.inv?.length?'Your cards they carry come back to you if there’s room, otherwise to the loot pool.':'','Dismiss',()=>{for(const i of [...(h.inv||[])])petBack(c,h,i);c.hires.splice(+b.dataset.k,1);render()})},
  'hire-st':b=>{const h=ME.hires[+b.dataset.k];h.st=Math.max(0,Math.min(parseInt(MON[h.mon].st.Stamina)||1,h.st+ +b.dataset.d));render()},
  'hire-pay':b=>{const c=ME,h=c.hires[+b.dataset.k],pay=hirePay(h);if(coinsOf(c)<pay)return toast(`You need ${pay} gc`);const r=c.inv.find(i=>i.id==='ration');if(!r)return toast('You need a ration for them');payCoins(c,pay);addCount(r,-1);h.days=(h.days||0)+1;toast(`${h.name} paid for the day`);render()},
  'wound-type':b=>{S.pendingWounds+=1;S.pendingWoundType=b.dataset.v;S.tab.crow='inventory';render()},
  wound:b=>{const k=+b.dataset.v,c=ME;c.woundType??={};if(S.pendingWounds&&c.wounds.has(k))return toast('Already wounded — tap an empty or unwounded slot');if(c.wounds.has(k)){c.wounds.delete(k);delete c.woundType[k]}else{c.wounds.add(k);if(S.pendingWounds){if(S.pendingWoundType)c.woundType[k]=S.pendingWoundType;if(!--S.pendingWounds)S.pendingWoundType=null}}if(ME.wounds.size>=10)toast('10 wounds — your crow dies.');render()},
  effort:b=>{const c=ME;if(+b.dataset.d<0&&c.effortBonus)c.effortBonus--;else c.effort=Math.max(0,Math.min(effMax(c),c.effort+ +b.dataset.d));render()},
  cruelty:b=>{ME.cruelty=Math.max(0,ME.cruelty+ +b.dataset.d);render()},
  cond:b=>{const k=b.dataset.v;ME.cond.has(k)?ME.cond.delete(k):ME.cond.add(k);S.condOpen=false;render()},
  'cond-open':()=>{S.condOpen=!S.condOpen;render()},
  light:b=>{const i=findInst(b.dataset.uid);if(i.lit){i.lit=false;toast('Doused — roll its UD now')}else{if(!i.ud&&IT[i.id].ud)return toast('Out of fuel — refuel or replace it');ME.inv.forEach(x=>x.lit=false);i.lit=true}render()},
  wear:b=>{const i=findInst(b.dataset.uid);const on=!i.worn;ME.inv.forEach(x=>x.worn=false);i.worn=on;if(on)i.ad??=IT[i.id].ad;render()},
  cnt:b=>{const i=findInst(b.dataset.uid);const it=IT[i.id];if(+b.dataset.d>0&&i.count>=it.stack)return toast(`A slot holds ${it.stack} ${it.name}.`);
    if(+b.dataset.d<0&&refPriced(i)&&i.count>1)return askPieces(`Remove 1 ${nm(i)}`,i,1,vs=>{takeVals(i,vs);if(i.count<=0)ME.inv=ME.inv.filter(x=>x!==i);render()}); // which one, when they are worth different amounts
    addCount(i,+b.dataset.d);if(+b.dataset.d<0&&/ration/i.test(it.name))clearWounds(ME,'starvation');render()},
  // A pip is not a roll: the player rolls a real d6 and taps a pip off for each 1–2. The last die of a 'Useless' item asks first.
  ud:b=>{const i=findInst(b.dataset.uid);const it=IT[i.id];const pip=[...b.parentNode.children].indexOf(b);
    if(pip<i.ud&&i.ud===1&&/Useless/.test(it.ud[1])&&!b.dataset.sure){askYes(`${it.name}: last usage die`,`Only if your d6 came up 1 or 2. Removing the last die uses up ${i.count>1?'one ':'the '}${it.name}${i.count>1?'':' and it leaves your inventory'}. Undo brings it back.`,'Rolled 1–2: remove it',()=>{b.dataset.sure='1';A.ud(b)});return}
    if(pip<i.ud){i.ud--;if(i.ud===0){if(/Useless/.test(it.ud[1])){i.lit=false;if(i.count>1){i.count--;i.ud=it.ud[0];toast(`One ${it.name} is used up — ${i.count} left`)}else{ME.inv=ME.inv.filter(x=>x!==i);toast(`${it.name} is used up`)}}else{i.lit=false;toast(`${it.name} is out: ${it.ud[1].split(';')[0]}`)}}}
    else i.ud=Math.min(it.ud[0],i.ud+1);render()},
  pour:b=>pourCoins(findInst(b.dataset.uid)),
  coins:b=>{const i=findInst(b.dataset.uid);askNum(`Coins in the purse (max ${purseMax(i)})`,i.coins||0,purseMax(i),v=>{i.coins=Math.max(0,Math.min(purseMax(i),v));render()})},
  split:b=>{const i=findInst(b.dataset.uid);askPieces(`Split ${nm(i)}`,i,i.count-1,vs=>{const pos=firstFit(i.id);if(!pos)return toast('No free slot');const go=takeVals(i,vs),q=go.length,h=putVals(inst(i.id,pos.sec,pos.idx,{unid:i.unid,topic:i.topic}),go);ME.inv.push(h);haulMove(ME,i.uid,h.uid,i.id,go);toast(`Moved ${q} to ${SEC_NAME[pos.sec]} ${pos.idx+1}`);render();renderPanel()})},
  topool:b=>{const i=findInst(b.dataset.uid);askPieces(`Give ${nm(i)} to the loot pool`,i,i.count,q=>{toPool(i,q);closePanel();render()})},
  discard:b=>{const i=findInst(b.dataset.uid);askYes(`Throw away ${nm(i)}${i.count>1?' ×'+i.count:''}?`,'','Throw away',()=>{ME.inv=ME.inv.filter(x=>x!==i);closePanel();render()})},
  heal:b=>{const v=parseInt(b.closest('form').n.value)||0;if(v<=0)return toast('Type how much Stamina to regain');const was=ME.stamina;ME.stamina=Math.min(stMax(ME),ME.stamina+v);toast(`Stamina +${ME.stamina-was}`);if(S.hud)S.hud.dmg=false;render()},
  // travel
  pace:b=>{S.travel.pace=b.dataset.v;render()}, role:b=>{S.travel.role=b.dataset.v;S.travel.task=null;render()},
  // miasma (player)
  // the list opens under its button, which keeps the focus; the attack block above steps aside, so the button is brought back to the top
  'ps-acts':()=>{const open=!actsOpen();S.hud.acts=open;render();const b=$('.ps-actb');if(!b)return;b.focus({preventScroll:true});
    const h=$('.hud'),top=h&&getComputedStyle(h).position==='sticky'?h.getBoundingClientRect().bottom:$('#top').getBoundingClientRect().bottom,r=b.getBoundingClientRect();
    if(open||r.top<top||r.bottom>innerHeight)scrollTo(0,scrollY+r.top-top-12)},
  'ps-acts-hide':()=>A['ps-acts'](), // the end band of the open list: closes it and brings its header back into view
  'mi-clear':()=>{miClear(ME);render()},
  'mi-undo':()=>{miUndo(ME);render()},
  'mi-rm':b=>{ME.miasma.splice(+b.dataset.k,1);render()},
  // the player's rest answers live on the crow (c.rq, dice.js): the Ref's device reads them to finish the rest for everyone
  rwhere:b=>{if(ME){dqMine(ME,{where:b.dataset.v});render()}},
  ract:b=>{const c=ME;if(!c)return;const v=b.dataset.v,cur=dqAct(c),next=cur===v?null:v;dqMine(c,{act:next,pick:null});if(rvOf(c))c.rv={r:c.rests||0,...(rvOf(c).mind?{mind:rvOf(c).mind}:{})};render()},
  rpick:b=>{const c=ME;if(!c)return;const R=dqForm(c);dqMine(c,{pick:R.pick===b.dataset.v?null:b.dataset.v});if(rvOf(c)?.cr)dqRef(c,{cr:[]});render()},
  rwound:b=>{const c=ME,lazy=c.miasma.some(x=>x.n===MI_NAMES[9]),w=+b.dataset.v,sel=restWoundsPick(c,lazy);if(!sel.includes(w))dqMine(c,{wounds:[...sel,w].slice(-Math.max(1,sel.length))});render()},
  // Finish on the player's own device: only without a Ref (at a table the Ref finishes everyone's rest, dice.js dqFinish)
  rfinish:()=>{const c=ME;if(!c)return;if(crowDead(c))return toast(`${c.name} is dead — no rest brings them back`);
    if(dqTable())return toast('The Ref finishes the rest');
    if(campRest()&&!restCampOpen())return toast('You rest when the Ref makes camp on the Journey');
    const ctx=dqRest()||dqOwnCtx(c);
    if(!ctx||!ctx.where)return toast('Choose where you rested first');
    if(dqAct(c)===undefined)dqMine(c,{act:''}); // Finish with no activity chosen: no activity
    const left=dqCrowItems(c,ctx).filter(x=>x.st==='wait');if(left.length){S.dq.open=left[0].key;S.dq.fromWait=true;render();return toast(`${left.length===1?'One thing waits':left.length+' things wait'}: ${String(left[0].what||'').replace(/<[^>]+>/g,'')}`)}
    const R=dqRestR(c,ctx),mo=ctx.where==='miasma'?dqMindOf(c,ctx):null,out=restApply(c,R);if(mo)dqMindApply(c,ctx,out.log,mo);c.rlog={r:c.rests||0,l:out.log.slice(0,30)};S.dq.seen='';S.rest.log=out.log;
    render();scrollTo(0,0)},
  // Study (a test, once per item): at a table the player asks and says the tier, the Ref taps it (dice.js); without a Ref the tiers are here
  'id-study':b=>{const i=findInst(b.dataset.uid);if(!held(i))return toast('Hold it first: move it to a hand, or a magic slot if it’s wearable');if(i.tried)return toast('You can only study an item once');
    if(dqTable()){ME.sask=ME.sask?.uid===i.uid?null:{uid:i.uid};render();renderPanel();if(ME.sask)toast('Roll 2d10 + M and tell the Ref your tier');return}
    S.dq.study=S.dq.study===i.uid?null:i.uid;render();renderPanel()},
  'id-tier':b=>{const i=findInst(b.dataset.uid),t=+b.dataset.v;if(!i||i.tried||dqTable())return;const r=IT[i.id];dqStudySet(ME,i,t);S.dq.study=null;render();renderPanel();
    idResult(`Study: tier ${t}`,t===3?`<p>You work it out: it’s <b>${esc(r.name)}</b>.</p>${cardHTML(r,null,{full:true,info:false})}`:t===2?'<p>You learn nothing about it. Try the Identify Item activity on your next rest, or use it blind.</p>':'<p><b>It goes off in a harmful way.</b> Tell the Ref — they decide what happens. You still don’t know what it is.</p>')},
  'id-use':b=>{const i=findInst(b.dataset.uid);if(!held(i))return toast('Hold it first: move it to a hand, or a magic slot if it’s wearable');const r=IT[i.id];
    askYes('Use it without knowing what it is?','You activate it blind. The Ref describes what happens — it could help, waste it, or hurt.','Use it',()=>{const used=isConsumable(r);i.unid=false;if(used)addCount(i,-1);render();renderPanel();
      idResult(`It’s ${esc(r.name)}`,`<p>${used?'It’s used up. ':''}The Ref tells you what happened; from now on you know what it does.</p>${cardHTML(r,null,{full:true,info:false})}`)})},
  // market
  mkt:b=>{S.mkt=b.dataset.v;render()},
  'go-villages':()=>{S.area='session';S.tab.session='village';render();scrollTo(0,0)},
  buyk:b=>{S.buy.k=b.dataset.v;buyKeepPick();render()},
  buypick:b=>{Object.assign(S.buy,{pick:b.dataset.v,q:1,x:{}});render()},
  dobuy:()=>{const c=ME,v=vHere(),B=S.buy,sel=stockOf(v).find(x=>x.it.id===B.pick);if(!sel)return;const it=sel.it,ex=extrasFor(v,it).filter(([k])=>B.x[k]);
    let each=priceSteps(v,it,ex.map(([,l,m])=>[l,m])).each;if(sel.k==='auction')each=Math.ceil(each*sel.a.mult);
    // more than one of a 100+ gc card: a 2nd copy on 10 × Prosperity % (min 10%), each further one 10% less (Buying)
    let q=B.q,note='';if(sel.k!=='auction'&&it.price>=100&&q>1){let n=1;for(let k=2;k<=q;k++){const ch=Math.max(10,10*v.prosperity)-10*(k-2),r=d(100);if(r<=ch)n++;else{note=` Copy ${k}: rolled ${r} > ${ch}% — not in stock.`;break}}q=n}
    if(each*q>coinsOf(c))return toast('Not enough coins');
    // you pay as each card finds a slot, so nothing is paid for that has no room
    S.placing={id:it.id,count:q,buy:each,v:v.id,auc:sel.k==='auction',extra:ex.map(([,l])=>l.split(':')[0]).join(', ')};S.tab.crow='inventory';if(note)toast(`Only ${q} in stock.${note}`);render()},
  auroll:()=>{const v=vHere(),id=$('#auq').value;if(!id)return toast('Pick a card to look for');const it=IT[id],av=parseInt(INST.auction.val[lvlOf(v,'auction')-1]),r=d(100);
    const ok=r<=av,mult=ok?1+(d(6)%2?1:-1)*d(6)/10:1;v.auction[id]={roll:r,ok,mult,left:ok?(isMagic(it)?1:d(10)):0};saveVillages();toast(`${it.name}: d100 ${r} ${ok?'≤':'>'} ${av}% — ${ok?'for sale':'not this cycle'}`);render()},
  svc:b=>{const c=ME,v=vHere(),L=k=>lvlOf(v,k),k=b.dataset.v,cost={'inn-night':5,heal:100,bless:200,mount:100,repair:5,ws:5,idalc:10}[k];if(coinsOf(c)<cost)return toast(`You need ${cost} gc`);
    const go=fn=>{const r=fn();if(r===false)return;payCoins(c,cost);toast(r);render()};
    if(k==='inn-night')go(()=>{c.innFood=true;return 'A bed and a day’s food: 5 gc — no ration needed at this rest'});
    if(k==='heal')go(()=>{const n=Math.min(L('temple'),c.wounds.size);[...c.wounds].sort((a,b)=>b-a).slice(0,n).forEach(w=>c.wounds.delete(w));clearWounds(c,'starvation');return `The priests of the Healer remove ${n} wound${n>1?'s':''}`});
    if(k==='bless')go(()=>{const i=adSources(c).find(i=>!i.blessed&&(IT[i.id].cat==='armor'));if(!i){toast('Your armor or shield already has a blessing');return false}i.ad=adOf(c,i)+2*L('temple');i.blessed=true;return `${IT[i.id].name}: +${2*L('temple')} AD until damage removes it`});
    if(k==='mount')go(()=>{const p=c.pets[0];p.prayer=L('temple');return `${p.name}: speed +3 for ${L('temple')} day${L('temple')>1?'s':''}`});
    if(k==='repair')go(()=>{const i=c.inv.find(x=>x.uid===+b.dataset.uid);i.ad=adBase(c,i);i.blessed=false;return `${IT[i.id].name} repaired`});
    if(k==='ws')go(()=>`Workshop rented for today: +${L(b.dataset.k)} to your ${b.dataset.k==='blacksmith'?'blacksmithing':b.dataset.k==='alchemist'?'alchemy':'enchanting'} crafting rolls`);
    if(k==='idalc')go(()=>{const i=c.inv.find(x=>x.uid===+b.dataset.uid);i.unid=false;return `It’s ${IT[i.id].name}`})},
  gamble:()=>{const c=ME,v=vHere(),G=S.gamble,max=INST.inn.val[Math.min(lvlOf(v,'inn'),5)-1]+v.prosperity,bet=Math.max(1,Math.min(max,+G.bet||1));if(coinsOf(c)<bet)return toast('Not enough coins');let won=0,txt;
    if(G.game==='ou'){const a=d(6),b2=d(6),t=a+b2,res=t>7?'over':t<7?'under':'seven';won=res===G.pick?(res==='seven'?4:2)*bet:0;txt=`2d6: ${a} + ${b2} = <b>${t}</b> (${res}).`}
    else{const r=d(6);won=r===+G.pick?5*bet:0;txt=`d6: <b>${r}</b>.`}
    payCoins(c,bet);const over=won?addCoins(c,won):0;if(over)S.pool.push({uid:UID++,id:'gold-coins',count:over,from:c.name});G.last=`${txt} ${won?`You win <b>${won} gc</b>.`:`You lose ${bet} gc.`}`;render()},
  fund:b=>{const c=ME,v=vHere(),k=b.dataset.k,l=v.inst[k]?.lvl||0,price=l?INST[k].adv[l]:INST[k].found,f=v.fund[k]??={paid:0,by:{}},n=Math.min(+(S.fundn?.[k])||Math.min(coinsOf(c),price-f.paid),price-f.paid,coinsOf(c));if(n<=0)return;
    payCoins(c,n);f.paid+=n;f.by[c.name]=(f.by[c.name]||0)+n;
    if(f.paid>=price){delete v.fund[k];v.pending.push({k,to:l+1});v.prosperity=Math.min(10,v.prosperity+1);v.raised=true;toast(`${INST[k].n} ${l?'upgraded to '+ORD(l+1):'founded'} — opens next cycle. Prosperity +1`)}else toast(`${n} gc toward ${INST[k].n}: ${f.paid} / ${price}`);saveVillages();render()},
  vsel:b=>{S.vsel=b.dataset.v;render()},
  nvopen:()=>{S.nvOpen=!S.nvOpen;render()},
  nvadd:()=>{S.nvOpen=false;const N=S.newv,P=V_PRESETS[N.preset];let o;if(P)o={name:P.name,note:P.note,inst:P.inst};else if(N.preset==='start'){o={name:N.name||'Our village',inst:Object.fromEntries([...HOME_START,N.extra].map(k=>[k,[1,'']]))}}else o={name:N.name||'New village',inst:{}};
    o.home=N.home;if(N.home)VILLAGES.forEach(v=>v.home=false);const v=mkVillage(o);S.vsel=v.id;S.newv=null;toast(`${v.name} created`);render()},
  'vhere-set':b=>sceneArrive(b.dataset.v),
  vleave:()=>{if(S.role==='ref'&&typeof jStep==='function'&&jStep()==='off'){A.jstart();S.area='session';S.tab.session='rmap';saveVillages();render();scrollTo(0,0);return}
    S.here='';setPhase('travel');saveVillages();render()},
  vdel:b=>{const v=VILLAGES.find(x=>x.id===b.dataset.v);askName(`Delete ${v.name}?`,'Its institutions and history go too.',v.name,'Delete',()=>{VILLAGES.splice(VILLAGES.indexOf(v),1);if(S.here===v.id)S.here='';saveVillages();render()})},
  vprosp:b=>{const v=VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0];v.prosperity=Math.max(-10,Math.min(10,v.prosperity+ +b.dataset.d));saveVillages();render()},
  vsale:b=>{const v=VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0];v.saleMod=(v.saleMod||0)+ +b.dataset.d;saveVillages();render()},
  vday:b=>{const v=VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0];v.day=Math.max(1,v.day+ +b.dataset.d);if(v.day>20){v.day=20;toast('Day 20 — end the cycle')}saveVillages();render()},
  vcycle:()=>{const v=VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0];askYes(`End cycle ${v.cycle} in ${v.name}?`,'Prosperity drops if nothing raised it, paid upgrades open, this cycle’s event effects end, merchants restock and the next event is rolled.','End cycle',()=>{const log=endCycle(v);toast(log.slice(0,2).join(' · '));render()})},
  vlvl:b=>{const v=VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0],k=b.dataset.k,was=v.inst[k]?.lvl||0,to=Math.max(0,Math.min(maxLvl(k),was+ +b.dataset.d));if(to===was)return;
    journalRun(!was?`Founded ${INST[k].n} in ${v.name}`:!to?`Closed down ${INST[k].n} in ${v.name}`:`${INST[k].n}: level ${to}`,['villages'],()=>{const x=v.inst[k]??={lvl:0,steward:'',mod:0,closed:false};x.lvl=to;saveVillages()},{quiet:!!was&&!!to});render()},
  'vfound-open':()=>{S.vfound=!S.vfound;render()},
  vfound:b=>{S.vfound=false;A.vlvl({dataset:{k:b.dataset.k,d:1}})},
  vmod:b=>{const v=VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0],x=v.inst[b.dataset.k];x.mod=Math.max(-3,Math.min(2,(x.mod||0)+ +b.dataset.d));saveVillages();render()},
  dosell:()=>{const s=S.sell,v=vHere();let tot=0;for(const i of [...ME.inv]){const q=s.sel[i.uid];if(!q)continue;const o=saleOf(v,i,q,true);if(!o.k||o.pay==null)continue;
    // a value typed at the sale goes onto the pieces sold that had none (and their haul rows); then exactly those pieces leave
    if(o.typed!=null&&refPriced(i)){let m=o.miss;setItemVals(ME,i,valsOf(i).map(x=>x==null&&m-->0?o.typed:x))}
    tot+=o.pay;if(refPriced(i)&&!i.unid)takeVals(i,o.parts);else i.count-=q;if(i.count<=0)ME.inv=ME.inv.filter(x=>x!==i)}
    const left=addCoins(ME,tot);
    if(left>0){S.pool.push({uid:UID++,id:'gold-coins',count:left,from:ME.name});toast(`Sold for ${tot} gc — ${left} gc didn’t fit in the purse and wait in the loot pool`)}else toast(`Sold for ${tot} gc`);S.sell={sel:{},greed:{},val:{},to:{},ar:{}};render()},
  // ref session
  'dt-run':()=>{if(!S.dt.running&&S.phase!=='delve'){const why=sceneWhy('delve');if(why)return toast(why)} // starting the clock takes the party into the dungeon
    S.dt.running=!S.dt.running;if(S.dt.running&&S.phase!=='delve'){setPhase('delve');if(S.here){S.here='';saveVillages()}}if(S.dt.left===0)S.dt.left=S.dt.len*60;render()},
  'dt-end':()=>{S.dt.running=false;S.dt.end={step:1};render()},
  'end-step':()=>{S.dt.end.step=2;render()},
  'end-cond':()=>{PLAY().forEach(c=>DT_END_CONDITIONS.forEach(k=>c.cond.delete(k)));S.dt.end.step=3;render()},
  'end-roll':()=>{S.dt.end.check=doEncCheck(enOf());render()},
  // what waits (a sign from the last check, an encounter not fought) is due in the new turn; the journal entry takes it back with the turn
  'next-dt':()=>{const t=S.dt,ec=t.end?.check;t.encs=(t.encs||[]).filter(e=>e.from!==t.n).map(e=>({...e,due:true}));if(ec?.hit&&!ec.fought&&!t.end.fought)t.encs.push({...ec,k:UID++,due:true,from:t.n});
    t.fight='';t.held=false;if(S.scene)Object.assign(S.scene,{miss:null,pick:false,set:false});S.dt.n++;S.dt.left=S.dt.len*60;S.dt.end=null;S.dt.running=true;render()},
  'enc-check':()=>{const ec=doEncCheck(enOf());if(ec.hit){ec.k=UID++;(S.dt.encs||=[]).push(ec);S.scene.miss=null}else S.scene.miss=ec;render()},
  fight:b=>{const m=MON[b.dataset.id],k=+b.dataset.n||1;for(let j=0;j<k;j++){const n=S.combat.filter(x=>x.id===m.id).length+1;S.combat.push({uid:UID++,id:m.id,n,st:parseInt(m.st.Stamina)||1,ad:parseInt(m.st.AD)||0})}
    const on=typeof inFight==='function'&&inFight();toast(`${k>1?k+' × ':''}${m.name} ${on?`join${k>1?'':'s'} the combat`:S.phase==='delve'?'added to the encounter — Begin combat on the Table':S.phase==='travel'?'added to the encounter — Begin combat on the Journey':`join${k>1?'':'s'} the combat`}`);render()},
  unfight:b=>{S.combat=S.combat.filter(x=>x.uid!==+b.dataset.uid);render()},
  // loot / monsters / tables
  kw:b=>{S.lookup.kw=b.checked;render()},
  drop:b=>{const id=enchantItem(b.dataset.id,S.lookup.ench);const q=Math.max(1,parseInt($('#dropq').value)||1);const v=$('#dropv')?parseInt($('#dropv').value)||null:null;S.pool.push({uid:UID++,id,count:q,from:'Ref',note:$('#dropn').value.trim(),val:v,unid:!!$('#dropu')?.checked,topic:$('#dropt')?.value||undefined});toast(`${IT[id].name}${$('#dropt')?.value?` (${$('#dropt').value})`:''}${q>1?' ×'+q:''} is in the loot pool`);render()},
  qroll:b=>{const k=b.dataset.v,x=rollTable(k);S.lookup.qres=`<div class="result" style="margin-top:.5rem"><span class="roll">${x.r}</span> ${esc(TB[k].title)}: ${esc(treasureToPool(k,x.row))} <b>→ loot pool</b> <button class="xbtn" data-action="qres-x" aria-label="Hide this roll">✕</button></div>`;render()},
  'qres-x':()=>{S.lookup.qres='';render()},
  lootfind:()=>{const L=S.lookup;L.find=!L.find;if(!L.find){L.pick=null;L.ench=[]}render();if(L.find)$('.pq[data-key=loot]')?.focus();else $('[data-action=lootfind]')?.focus()},
  pcat:b=>{PICK[b.dataset.key].cat=b.dataset.v;render()},
  lootpick:b=>{S.lookup.pick=b.dataset.v;S.lookup.ench=[];render();$('#dropq')?.closest('.box')?.scrollIntoView({block:'nearest',behavior:'smooth'})},
  lootpickadd:b=>{lootAdd(b.dataset.v,1);toast(`${IT[b.dataset.v].name} added`);render()},
  'loot-drop':b=>{const p=LOOT.find(x=>x.id===b.dataset.v);for(const it of p.items)S.pool.push({uid:UID++,id:it.id,count:it.n,from:'Ref',note:p.name+(p.note?' — '+p.note:''),unid:it.u??isMagic(IT[it.id]),topic:it.topic});toast(`${p.name} is in the loot pool`);render()},
  'loot-edit':b=>{S.area='library';S.lib.cat='presets';S.lib.pick=b.dataset.v||null;render()},
  'loot-export':()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(lootFile())],{type:'application/json'}));a.download='loot-presets.crow-nest-loot.json';a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);toast(`${LOOT.length} preset${LOOT.length===1?'':'s'} exported`)},
  'loot-new':()=>{S.area='library';S.lib.cat='presets';const p={id:'l'+Date.now(),name:'New chest',note:'',items:[]};LOOT.push(p);saveLoot();S.lib.pick=p.id;render();$('[data-loot=name]')?.select()},
  'loot-del':()=>askName('Delete this preset?','',curLoot()?.name||'Untitled','Delete',()=>{LOOT.splice(LOOT.findIndex(x=>x.id===S.lib.pick),1);saveLoot();S.lib.pick=null;render()}),
  'ench-rm':b=>enchEdit(b.dataset.ctx,l=>l.splice(+b.dataset.k,1)),
  'loot-rm':b=>{curLoot().items.splice(+b.dataset.k,1);saveLoot();render()},
  'loot-gold':()=>{const n=parseInt($('#lgold').value)||0;if(n>0){lootAdd('gold-coins',n);render()}},
  'loot-custom':()=>{const n=$('#lcname').value.trim();if(!n)return;lootAdd(customItem(n,{slots:+$('#lcslots').value||1,text:$('#lctext').value.trim()||undefined}),1);render()},
  mfam:b=>{S.mon.fam=b.dataset.v;render()}, mpick:b=>{S.mon.pick=b.dataset.v;render()},
  tpick:b=>{S.tbl.pick=b.dataset.v;S.tbl.roll=null;render()},
  troll:()=>{const t=TB[S.tbl.pick];if(t.rows[0][1]==='d6'){const a=d(6),b2=d(6);S.tbl.roll={r:`${a}·${b2}`,row:t.rows.slice(1).find(r=>+r[0]===a&&+r[1]===b2)}}else S.tbl.roll=rollTable(S.tbl.pick,+S.tbl.mod||0);render()},
  tgo:b=>{S.area='library';S.lib.cat='tables';S.tbl.pick=b.dataset.v;S.tbl.roll=null;render()},
  rpace:b=>{S.rtravel.pace=b.dataset.v;render()},
  rmod:b=>{const R=S.rtravel,o=JourneyRules.setMod(R,b.dataset.v,b.type==='radio'||b.checked,{radio:b.type==='radio'});R.mods=o.mods;R.camp=o.camp;render()},
  rguide:()=>{S.rtravel.mods=JourneyRules.clearGuide(S.rtravel);render()},
  rcheck:()=>{const T=rtDay();S.rtravel.checks=encChecks(T.chk,T.en);render()},
  rrest:()=>{const T=rtDay();S.rtravel.restChecks=encChecks(T.rchk,T.ren);render()},
  rcamp:b=>{S.rtravel.camp=b.dataset.v;render()},
  rruin:()=>{S.rtravel.ruinRoll=d(100);render()},
  rlostdir:()=>{S.rtravel.dirs=Array.from({length:Math.max(1,rtDay().hexes)},()=>DIRS[d(6)-1]);render()},
  rloot:()=>{const R=S.rtravel,out=[];for(const l of rtDay().loot){
      if(l==='treasure'){const x=rollTable('minor-treasures');out.push('Minor Treasure: '+esc(treasureToPool('minor-treasures',x.row)))}
      if(l==='forage'){pushPool('ration',1,'Forage');out.push('Forage: 1 ration')}
      if(l==='hunt2'){const n=d(6);pushPool('ration',n,'Hunt');out.push(`Hunt: ${n} rations`)}
      if(l==='hunt3'){const n=d(6)+d(6)+d(6),a=d(6);pushPool('ration',n,'Hunt');pushPool('animal-part',a,'Hunt');out.push(`Hunt: ${n} rations, ${a} animal parts`)}}
    R.looted=true;R.lootLog=out.join('<br>')+' <b>→ loot pool</b>';render()},
  rnextday:()=>{setPhase('travel');const R=S.rtravel,T=rtDay();for(const v of VILLAGES)v.day=Math.min(20,v.day+1);saveVillages();const due=VILLAGES.filter(v=>v.day>=20);if(due.length)setTimeout(()=>toast(`Day 20 in ${due.map(v=>v.name).join(', ')} — end the cycle on Run game → Villages`),2900);S.rtravel=JourneyRules.nextDay(R,T);render();scrollTo(0,0);toast(`Day ${R.day+1}${S.rtravel.lost?' — still lost':''}`)},
  rmt:b=>{S.rmi[b.dataset.k]={t:+b.dataset.v};render()},
  rmundo:b=>{miUndo(PARTY[+b.dataset.k]);render()},
  prosp:b=>{S.village.prosperity=Math.max(-10,Math.min(10,S.village.prosperity+ +b.dataset.d));render()},
  xph:b=>{const h=PARTY[+b.dataset.c].haul[+b.dataset.k];h.skip=!b.checked;render()},
  xpgive:()=>{const xp=xpState(),haul=PLAY().flatMap(c=>(c.haul||[]).filter(h=>!h.skip)),all=Math.floor(haul.reduce((a,h)=>a+(h.val??IT[h.id].price??0)*h.n*(1+[0,.3,.2,.1][+h.g||0]),0))+xp.rows.reduce((a,[n,val,g])=>a+Math.floor((+val||0)*(1+[0,.3,.2,.1][+g||0])),0),each=Math.floor(all/xp.players);
    askYes(`Give ${each} XP to each crow?`,`${all} gc of treasure ÷ ${xp.players} players.${haulMiss()?` ${haulMiss()} piece${haulMiss()>1?'s':''} not valued yet count 0.`:''} The listed treasure is cleared.`,'Give XP',()=>{for(const c of PLAY()){if(!crowDead(c))c.xpBank=(c.xpBank||0)+each;c.haul=[]}xp.rows=[];toast(`+${each} XP each — counts after the next rest`);render()},true)},
  xpadd:()=>{S.xp.rows.push(['',0,0]);render()},
  xpdel:b=>{S.xp.rows.splice(+b.dataset.k,1);render()},
  settings:()=>settingsDialog(),
  stoneben:b=>{const [u,k]=String(b.dataset.v).split(':'),i=ME?.inv.find(x=>String(x.uid)===u);if(!i||!STONE_BEN[k])return;i.ben=k;render()},
};
document.addEventListener('click',e=>{
  const pe=e.target.closest('.pop');panelNav=!!(e.target.closest('#panel')||pe&&pops.find(x=>x.el===pe)?.term.closest('#panel'));
  const t=e.target.closest('.term');
  if(t&&!e.target.closest('[data-action]:not(.term)')){e.preventDefault();
    if(lastPointer==='touch'){const own=pops.find(x=>x.term===t);if(!own){openPop(t);return}}
    openPanel({t:'rule',k:t.dataset.term});return}
  const b=e.target.closest('[data-action]');
  if(S.menu&&!(b&&/^(who|menu)$/.test(b.dataset.action)))closeMenu();
  const h=!b&&e.target.closest('.hint');if(h){if(!pops.some(x=>x.term===h))openPop(h);return}
  if(!b){if(!e.target.closest('.pop'))closePops(0);if(spFor&&!e.target.closest('#searchPop'))closeSlotSearch();return}
  const f=A[b.dataset.action];if(!f)return;
  if(b.tagName==='A'||b.tagName==='BUTTON'&&b.type!=='submit')e.preventDefault();
  if(b.type==='checkbox'||b.tagName==='SELECT'||b.type==='number'||b.type==='text'||b.type==='search')return;
  f(b);
});
document.addEventListener('change',e=>{if(!e.target.classList?.contains('lootfile-in'))return;const f=e.target.files[0];e.target.value='';if(!f)return;
  f.text().then(t=>{let o;try{o=JSON.parse(t)}catch{return toast('That isn’t a loot presets file (not JSON).')}try{const r=lootImport(o);render();toast(`${r.n} preset${r.n===1?'':'s'} imported${r.lost?` · ${r.lost} unknown card${r.lost===1?'':'s'} left out`:''}`)}catch(err){toast(err.message)}})});
document.addEventListener('change',e=>{const b=e.target;
  if(b.dataset.petGive!=null&&b.value){const c=ME,p=c[b.dataset.kind||'pets'][+b.dataset.petGive],i=c.inv.find(x=>x.uid===+b.value);let pos=-1;for(let k=0;k<p.len.pack;k++)if(!canPlace(p,i.id,'pack',k)){pos=k;break}
    if(pos<0){toast(`${p.name} has no room for ${nm(i)}`);return render()}c.inv=c.inv.filter(x=>x!==i);i.sec='pack';i.idx=pos;i.lit=false;i.worn=false;p.inv.push(i);toast(`${nm(i)} → ${p.name}`);return render()}
  if(b.dataset.petName!=null){S.compRename=null;ME.pets[+b.dataset.petName].name=b.value||MON[ME.pets[+b.dataset.petName].mon].name;return render()}
  if(b.dataset.hireName!=null){S.compRename=null;ME.hires[+b.dataset.hireName].name=b.value||MON[ME.hires[+b.dataset.hireName].mon].name;return render()}if(b.dataset.lootT!=null){curLoot().items[+b.dataset.lootT].topic=b.value||undefined;saveLoot();return}if(b.dataset.lootU!=null){curLoot().items[+b.dataset.lootU].u=b.checked;saveLoot();return}if(b.dataset.lootN!=null){curLoot().items[+b.dataset.lootN].n=Math.max(1,+b.value||1);saveLoot();return render()}const a=b.dataset.action;const s=S.sell;
  const V=()=>VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0],sv=fn=>()=>{fn();saveVillages();render()};
  // vhere: the Ref's choice follows the scene rules (sceneArrive); a player at a table only reads where the party is
  const m={kw:A.kw,vhere:()=>{if(S.role==='ref')return b.value?sceneArrive(b.value):A.vleave();if(atTable())return render();S.here=b.value;saveVillages();render()},buyx:()=>{S.buy.x[b.dataset.v]=b.checked;render()},buytxt:()=>{S.buy.txt=b.checked;render()},selto:()=>{S.sell.to[b.dataset.uid]=b.value;render()},
   gmode:()=>{S.gamble.game=b.value;S.gamble.pick=b.value==='ou'?'over':'1';render()},gpick:()=>{S.gamble.pick=b.value},gbet:()=>{S.gamble.bet=+b.value},fundn:()=>{(S.fundn??={})[b.dataset.k]=+b.value},
   nvpreset:()=>{S.newv.preset=b.value;render()},nvextra:()=>{S.newv.extra=b.value},nvname:()=>{S.newv.name=b.value},nvhome:()=>{S.newv.home=b.checked},
   vname:sv(()=>V().name=b.value||V().name),vhome:sv(()=>{if(b.checked)VILLAGES.forEach(x=>x.home=false);V().home=b.checked}),vstew:sv(()=>V().inst[b.dataset.k].steward=b.value),vclosed:sv(()=>V().inst[b.dataset.k].closed=b.checked),vq:sv(()=>(V().q??={})[b.dataset.k]=b.value),vnote:sv(()=>V().note=b.value),
   buyq:()=>{S.buy.q=Math.max(1,+b.value||1);render()},'pet-pick':()=>{S.petPick=b.value},'hire-pick':()=>{S.hirePick=b.value},rlore:()=>{if(ME)dqMine(ME,{loreExp:b.value})},'ench-add':()=>{if(b.value)enchEdit(b.dataset.ctx,l=>l.push(b.value))},lvexp:()=>A.lvexp(b),rplus:()=>{if(ME){dqMine(ME,{plus:b.checked});render()}},rcrafty:()=>{if(ME){dqMine(ME,{crafty:b.checked});render()}},rpart:()=>{if(ME){dqMine(ME,{part:b.value});render()}},rsize:()=>{if(ME){dqMine(ME,{size:+b.value});if(rvOf(ME)?.hv!=null)dqRef(ME,{hv:null});render()}},
    sel:()=>{s.sel[b.dataset.uid]=b.checked?findInst(b.dataset.uid).count:0;render()},selq:()=>{s.sel[b.dataset.uid]=Math.max(0,Math.min(findInst(b.dataset.uid).count,+b.value||0));render()},selv:()=>{s.val[b.dataset.uid]=b.value;render()},selg:()=>{s.greed[b.dataset.uid]=+b.value;render()},
    'dt-len':()=>{const fresh=!S.dt.running&&S.dt.left>=S.dt.len*60;S.dt.len=+b.value;S.dt.left=fresh?S.dt.len*60:Math.min(S.dt.left,S.dt.len*60);render()},'dt-dun':()=>{S.dt.dungeon=b.value;if(typeof jFamPick==='function')jFamPick(b.value);render()},'dt-crowd':()=>{S.dt.crowded=b.checked;render()},'dt-chaos':()=>{S.dt.chaos=b.checked;render()},
    rmod:()=>A.rmod(b),jhrole:()=>A.jhrole(b),jhride:()=>A.jhride(b),tmod:()=>{S.tbl.mod=+b.value},
    xpn:()=>{S.xp.rows[b.dataset.k][0]=b.value},xph:()=>A.xph(b),xphv:()=>{const c=PARTY[+b.dataset.c],h=c.haul[+b.dataset.k],v=valNum(b.value);if(v===undefined)return;const i=h.uid!=null&&c.inv.find(x=>x.uid===h.uid);
      // this row's pieces in the instance take the value (as many as the row has, of the row's old value); other pieces keep theirs
      if(i&&refPriced(i)){const a=valsOf(i),old=h.val??null;let m=+h.n||1;putVals(i,a.map(x=>x===old&&m-->0?v:x))}h.val=v;render()},xphg:()=>{PARTY[+b.dataset.c].haul[+b.dataset.k].g=+b.value;render()},xpv:()=>{S.xp.rows[b.dataset.k][1]=+b.value;render()},xpg:()=>{S.xp.rows[b.dataset.k][2]=+b.value;render()},xpp:()=>{S.xp.players=Math.max(1,+b.value);S.xp.pset=true;render()}}[a];
  if(m)m();});
document.addEventListener('input',e=>{const b=e.target;
  if(b.dataset.action==='mq'){S.mon.q=b.value;const pos=b.selectionStart;render();const n=$('[data-action=mq]');n.focus();n.setSelectionRange(pos,pos)}
  if(b.dataset.action==='lq'){S.lib.q=b.value;const pos=b.selectionStart;render();const n=$('[data-action=lq]');n.focus();n.setSelectionRange(pos,pos)}
  if(b.dataset.loot){curLoot()[b.dataset.loot]=b.value;saveLoot()}
  if(b.dataset.b&&S.b){S.b[b.dataset.b]=b.value;$('#btabs').outerHTML=bTabsHTML();$('#bfoot').outerHTML=bFootHTML(); // typing keeps focus: only the step header and the bottom bar are redrawn
    if(b.dataset.b==='name'){b.classList.toggle('go',!b.value.trim());const av=$('.b2-pic .cav[data-i]');if(av)av.dataset.i=(b.value.trim()[0]||'?').toUpperCase()}}
  if(b.dataset.action==='tq'){S.tbl.q=b.value;const pos=b.selectionStart;render();const n=$('[data-action=tq]');n.focus();n.setSelectionRange(pos,pos)}
  if(b.id==='ridx'){P.stack[P.i].q=b.value;$('#ridxr').innerHTML=findResults(b.value)}
  if(b.id==='lridx'){S.lib.q=b.value;$('#lridxr').innerHTML=findResults(b.value)}});
document.addEventListener('submit',e=>{const f=e.target;if(f.method==='dialog')return;e.preventDefault();
  if(f.dataset.form==='rval')return A.rval(f);
  if(f.dataset.form==='dmg'){let n=parseInt(f.n.value)||0;if(n<=0)return;const piercing=f.p.checked;let log=[];const raw=n;journalStart(`Took ${n} damage`,[`crow:${ME.id}`]);
    const noParry=[...f.querySelectorAll('[name=parry]')].filter(x=>!x.checked).map(x=>+x.value); // Parry is optional: an unticked weapon keeps its AD
    if(!piercing){for(const src of adSources(ME)){if(!n)break;if(noParry.includes(src.uid))continue;const have=adOf(ME,src),take=Math.min(have,n);src.ad=have-take;n-=take;if(take)log.push(`${IT[src.id].name} AD −${take}`)}}
    const st=Math.min(ME.stamina,n);ME.stamina-=st;n-=st;if(st)log.push(`Stamina −${st}`);
    if(n>0){S.pendingWounds=n;S.tab.crow='inventory';log.push(`${n} wound${n>1?'s':''} to mark in your backpack`)}if(S.hud)S.hud.dmg=false;render();journalSettle(`Took ${raw}${piercing?' piercing':''}: ${log.join(' · ')||'no effect'}`)}
  if(f.dataset.form==='mdmg'){const x=S.combat.find(c=>c.uid===+f.dataset.uid);if(!x)return;let n=parseInt(f.n.value)||0;if(n<=0)return;const m=MON[x.id],max=parseInt(m.st.Stamina)||1,lab=typeof crLabel==='function'?crLabel(x):m.name;
    journalStart(lab,['session']);
    if(e.submitter?.name==='heal'){const was=x.st;x.st=Math.min(max,x.st+n);journalSettle(`${lab}: +${x.st-was} Stamina`)}
    else{const a=Math.min(x.ad||0,n);x.ad=(x.ad||0)-a;const d=n-a;x.st=Math.max(0,x.st-d);journalSettle(`${lab}: ${n} damage${a?` (${a} to AD)`:''}${x.st?'':' — down'}`);
      if(!x.st&&S.scene){const nx=S.combat.find(y=>y.st>0&&y.id===x.id)||S.combat.find(y=>y.st>0);if(nx)S.scene.focus=nx.uid}}
    render();$('#fo-n')?.focus({preventScroll:true})}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(S.menu)return closeMenu();if(pops.length)return closePops(0);if(S.invPop&&!$('#inv-pop')?.hidden)return inventoryClosePop();if(spFor)return closeSlotSearch();if(S.hud?.dmg&&$('#hud-pop')){S.hud.dmg=false;render();return $('.hud-dmg')?.focus()}if(S.placing||S.moving){S.placing=null;S.moving=null;return render()}if(document.body.classList.contains('panel-open'))return closePanel();if(invShown()&&!$('dialog[open]'))return closeInventory()}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.slot.empty')){e.preventDefault();A.slot(e.target)}
});
addEventListener('scroll',()=>{closePops(0);hidePreview()},{passive:true});

/* ================= dialogs ================= */
function settingsDialog(){const dl=$('#dlg');const th=store.get('theme')==='light'?'light':'dark',fs=+(store.get('fs')||18);
  dl.innerHTML=`<form method="dialog"><h2>Display</h2><p class="muted small">Saved on this device.</p>
   <p><b>Theme</b><br><span class="seg" style="background:var(--panel)">${[['dark','Dark'],['light','Bone']].map(([k,l])=>`<button type="button" data-set="theme" data-v="${k}" aria-pressed="${th===k}">${l}</button>`).join('')}</span></p>
   <p><b>Text size</b> <span id="fsv">${fs}px</span><br><input type="range" min="16" max="26" value="${fs}" id="fsr" style="width:100%" aria-label="Text size"></p>
   <p class="small muted">Keys: <b>/</b> search rules, items and monsters · <b>D</b> take damage on a crow · <b>Esc</b> close.</p>
   <div class="row" style="justify-content:flex-end"><button class="btn primary">Done</button></div></form>`;
  dl.onclose=null;dl.onclick=e=>{const b=e.target.closest('[data-set]');if(!b)return;store.set(b.dataset.set,b.dataset.v);applySettings();$$(`[data-set=${b.dataset.set}]`,dl).forEach(x=>x.setAttribute('aria-pressed',x===b))};
  $('#fsr').oninput=e=>{store.set('fs',e.target.value);$('#fsv').textContent=e.target.value+'px';applySettings()};dl.showModal()}
// two themes, dark and bone, and one font, Inter (owner, 2026-11-24): a stored high contrast reads as dark; an old ctk-font stays unread
function applySettings(){const r=document.documentElement;r.dataset.theme=store.get('theme')==='light'?'light':'dark';delete r.dataset.font;r.style.setProperty('--fs',(store.get('fs')||18)+'px');fitBar()}
// The bar folds by the room it has in text sizes, not pixels, so a larger Display text size folds it sooner (media queries cannot see the root font size).
function fitBar(){const r=document.documentElement,em=innerWidth/(parseFloat(getComputedStyle(r).fontSize)||18);r.classList.toggle('bar-l',em<73);r.classList.toggle('bar-m',em<66);r.classList.toggle('bar-s',em<62);r.classList.toggle('bar-n',em<47);r.classList.toggle('bar-xs',em<42.5);barFit();whereFit()}
// …and by what it holds: when its cells still do not fit (five views in a village, a long name, the Ref's Back to the table),
// the next fold, one at a time: the tools lose their words, the views lose their icons, the name
// shortens, then only Who's icon stays (the name is in its aria-label) and Back to the table is its arrow
function barFit(){const r=document.documentElement,t=$('#top'),F=['bar-f1','bar-f3','bar-f4','bar-f5'];if(!t)return;r.classList.remove(...F);
  for(const k of F){if(t.scrollWidth<=t.clientWidth+1)break;r.classList.add(k)}}
addEventListener('resize',fitBar);
// the fit is measured in the page's fonts: measure again once they have loaded
document.fonts?.addEventListener?.('loadingdone',()=>{barFit();whereFit()});document.fonts?.ready?.then(()=>{barFit();whereFit()});

/* ================= boot ================= */
function route(){const h=location.hash;let m;
  if((m=h.match(/^#rule\/([\w-]+)/))&&(GLOSS[m[1]]||BOOK[m[1]]))openPanel({t:'rule',k:m[1]});
  else if((m=h.match(/^#item\/([\w-]+)/))&&IT[m[1]])openPanel({t:'item',id:m[1]});
  else if((m=h.match(/^#mon\/([\w-]+)/))&&MON[m[1]])openPanel({t:'mon',id:m[1]})}
dqInit();journalActions();vTipsInit();applySettings();restoreSession();restorePend();lobBoot();render();route();addEventListener('hashchange',route);if(SESSION_NOTE)setTimeout(()=>toast(SESSION_NOTE),400);
// the boot cover (index.html) comes off in one frame once the screen is drawn and Inter is in; a font that takes longer than 400 ms swaps in later
{const off=()=>requestAnimationFrame(()=>document.documentElement.classList.remove('boot'));
  if(!document.fonts)off();else Promise.race([Promise.all(['400','600','700','800'].map(w=>document.fonts.load(w+' 1em Inter'))),new Promise(r=>setTimeout(r,400))]).then(off,off)}
