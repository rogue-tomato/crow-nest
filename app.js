'use strict';
/* CROW NEST — prototype. Vanilla JS, no build step: open index.html.
   Data: data.js (generated from the Playtest 3 PDFs), rules.js (hand-written glossary). */
Object.assign(GLOSS,{
  'q-reload':['Reload','Use a maneuver to load 1 ammunition before each attack.','',[]],
  'q-heavy':['Heavy','Upgrading this weapon’s material costs more and gives a bigger bonus.','',['crafting']],
});
const D=window.DATA, IT={}, MON={}, TB={};
D.items.forEach(i=>IT[i.id]=i); D.monsters.forEach(m=>MON[m.id]=m); D.tables.forEach(t=>TB[t.id]=t);

/* ================= helpers ================= */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
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
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),2800)}
// ponytail: localStorage is this device's cache; sync.js shares the game state at the table.
const mem={};const store={get:k=>{try{return localStorage.getItem('ctk-'+k)??mem[k]}catch{return mem[k]}},set:(k,v)=>{mem[k]=v;try{localStorage.setItem('ctk-'+k,v)}catch{}}};

// Auto-link rule words inside card text so nobody has to search for them (first hit of each).
const AUTO=[[/\bManeuver\b/,'maneuver'],[/\b(?:Agility|Mind|Strength|M|A|S)? ?RR\b/,'rr'],[/\bDTs?\b|\bdungeon turns?\b/,'dt'],[/\bUD\b/,'ud'],[/\bwounds?\b/,'wounds'],[/\bStamina\b/,'stamina'],[/\bprone\b/,'c-prone'],[/\bgrabbed\b/,'c-grabbed'],[/\bweakened\b/,'c-weakened'],[/\bvulnerable\b/,'c-vulnerable'],[/\bblessed\b/,'c-blessed'],[/\bLight \d+\/\d+/,'light'],[/\bbane\b/,'bane'],[/\bedge\b/,'edge'],[/\brest\b/,'rest'],[/\bP dam\b/,'piercing'],[/\bcrafting rolls?\b/,'crafting'],
  [/\b[Oo]pportunity attacks?\b/,'r-opportunity-attack'],[/\bcounter\b/,'r-counter'],[/\breach\b/,'r-reach'],[/\bactions?\b/,'r-actions'],[/\bcrits?\b/,'r-crits-and-dooms'],[/\bdooms?\b/,'r-crits-and-dooms'],[/\b[Pp]ush \d+\b/,'r-forced-movement'],[/\bdifficult terrain\b/,'r-difficult-terrain'],[/\bline of effect\b/,'r-line-of-effect'],[/\bcover\b/,'r-cover'],[/\btests?\b/,'r-making-a-test'],[/\bsurprised\b/,'r-surprised'],[/\bsquares?\b/,'r-grid-and-distance']];
function linkify(t){
  let s=esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
  for(const [re,k] of AUTO){let done=false;s=s.replace(new RegExp(re.source,'g'),(m,off,all)=>{if(done)return m;const before=all.slice(0,off);if(/<[^>]*$/.test(before)||/<a [^>]*>[^<]*$/.test(before))return m;done=true;return `<a class="term" href="#rule/${k}" data-term="${k}">${m}</a>`})}
  return s;
}
const QK={light:'q-light',disengage:'q-disengage',parry:'q-parry',pummeling:'q-pummeling',dismember:'q-dismember',brutal:'q-brutal',cumbersome:'q-cumbersome',slashing:'slashing',bashing:'bashing',chopping:'chopping',stabbing:'stabbing',bow:'bow',reload:'q-reload',heavy:'q-heavy'};
const quals=q=>esc(q||'').split(/,\s*/).map(w=>{const k=QK[w.toLowerCase().split(' ')[0]];return k?`<a class="term" href="#rule/${k}" data-term="${k}">${w}</a>`:w}).join(', ');

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
const inst=(id,sec,idx,x={})=>{const it=IT[id];return Object.assign({uid:UID++,id,sec,idx,count:1,ud:it&&it.ud?it.ud[0]:undefined},x)};
function mkChar(o){return Object.assign({id:'c'+Date.now().toString(36)+d(1e6),txp:0,xpSpent:0,stBase:7,stamina:null,effort:null,cruelty:0,cond:new Set(),miasma:[],wounds:new Set(),inv:[],exp:{gen:[],wpn:[],mag:[]},traits:[],ch:{A:0,M:0,S:0}},o)}
let ME=null;
const PARTY=[];
const LVL=TB['character-level'].rows.slice(1).map(r=>({lv:parseInt(r[0]),min:+r[1].replace(/,/g,'').match(/\d+/)[0],eff:+r[2],ch:r[3]==='Yes'}));
const level=c=>LVL.filter(l=>c.txp>=l.min).pop();
const stMax=c=>c.stBase+2*(level(c).lv-1);
const effMax=c=>level(c).eff;
PARTY.forEach(c=>{c.stamina??=stMax(c);c.effort??=effMax(c)});
// Crows are cached on this device; at a shared table (sync.js) the host's copy wins.
const reviveCrow=c=>Object.assign(mkChar({}),c,{cond:new Set(c.cond),wounds:new Set(c.wounds),pets:(c.pets||[]).map(p=>Object.assign(p,{len:p.len||{pack:parseInt(MON[p.mon]?.st.Slots)||0}})),hires:(c.hires||[]).map(h=>Object.assign({wounds:[],inv:[]},h,{len:h.len||{pack:parseInt(MON[h.mon]?.st.Slots)||0}}))});
try{let saved=JSON.parse(store.get('crows')||'null');const DEMO=['Bram Hollow|Village Watch','Wren|Thief','Sister Ada|Acolyte of the Healer','Osk|Archer'];if(saved&&!store.get('demoGone')){saved=saved.filter(c=>!DEMO.includes(c.name+'|'+c.bg));store.set('demoGone','1')}if(saved){PARTY.splice(0,PARTY.length,...saved.map(reviveCrow));UID=Math.max(UID,...PARTY.flatMap(c=>c.inv.map(i=>i.uid+1)))}}catch{}
const saveCrows=()=>store.set('crows',JSON.stringify(PARTY,(k,v)=>v instanceof Set?[...v]:v));
// Effort above the maximum is a separate bonus (Good Night's Rest), so the sheet never shows 3 / 2.
PARTY.forEach(c=>{if(c.effort>effMax(c)){c.effortBonus=(c.effortBonus||0)+c.effort-effMax(c);c.effort=effMax(c)}});
ME=PARTY[+store.get('crow')||0]||PARTY[0];

const S={area:store.get('area')||'home',home:'players',tab:{crow:'sheet',session:'session'},b:null,lib:{cat:'items',q:'',pick:null},
  village:{prosperity:0},
  dt:{n:1,running:false,left:30*60,len:30,dungeon:'undead',crowded:false,chaos:false,end:null},
  pool:[],
  combat:[], placing:null, pendingWounds:0,
  travel:{pace:'normal',role:'Scout',task:null,tier:null},
  rtravel:{day:1,pace:'normal',mods:{},checks:[],restChecks:[],lost:false,camp:null},
  mi:{last:null},rest:{act:null,pick:null,where:null,ration:true,part:'angel-part',size:1,plus:false,log:null},test:null,
  rmi:{}, sell:{sel:{},greed:{},val:{},to:{},ar:{}},
  lookup:{q:'',kw:false,pick:null}, mon:{q:'',fam:'',pick:'angel-a'}, tbl:{q:'',pick:'travel-encounters',roll:null,mod:0},
};
const LEN={hand:2,magic:3,belt:4,pack:10};
const SEC_NAME={hand:'Hand',magic:'Magic slot',belt:'Belt',pack:'Backpack'};

/* ================= inventory rules ================= */
const isCumb=it=>/Cumbersome/.test(it.q||'');
const sizeIn=(it,sec)=>sec==='hand'&&isCumb(it)?2:it.slots||1;
const lenOf=(c,sec)=>c.len?.[sec]??LEN[sec];
function occ(c,sec){const a=Array(lenOf(c,sec)).fill(null);for(const i of c.inv){if(i.sec!==sec)continue;const n=sizeIn(IT[i.id],sec);for(let k=0;k<n;k++)if(i.idx+k<a.length)a[i.idx+k]={i,k}}return a}
const wearable=it=>it.wear||it.cat==='unidentified';
function canPlace(c,id,sec,idx,ignore){
  const it=IT[id],n=sizeIn(it,sec),o=occ(c,sec);
  if(sec==='magic'&&!wearable(it))return 'Magic slots hold wearable magic items (rings, belts, masks…).';
  if(idx+n>lenOf(c,sec))return `${it.name} needs ${n} neighbouring ${SEC_NAME[sec].toLowerCase()} slots.`;
  for(let k=0;k<n;k++){const x=o[idx+k];if(x&&x.i.uid!==ignore)return 'Those slots are taken.'}
  return '';
}
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
const purse=c=>c.inv.find(i=>i.id.includes('coin-purse'));
const purseMax=p=>p?({'coin-purse':500,'fine-coin-purse':750,'masterwork-coin-purse':1000}[p.id]||500):0;

/* ================= unidentified magic items ================= */
// The real item stays in i.id (slots, stack, wearable are physical facts); only what the player reads is hidden.
const isMagic=it=>!!it&&(it.cat==='magic'||!!it.magic);
const KIND=[['ring','a ring'],['wand','a wand'],['potion','a potion'],['belt','a belt'],['crown','a crown'],['glove','gloves'],['gauntlet','gauntlets'],['boot','boots'],['poulaine','shoes'],['mask','a mask'],['necklace','a necklace'],['amulet','an amulet'],['cloak','a cloak'],['hat','a hat'],['key','a key'],['bag','a bag'],['box','a box'],['trap','a trap'],['branch','a branch'],['staff','a staff'],['monocle','a monocle'],['eye','an eye'],['medallion','a medallion'],['stone','a stone'],['cottage','a tiny house'],['book','a book'],['orb','an orb'],['whistle','a whistle'],['teeth','a string of teeth']];
function kindOf(r){const n=r.name.toLowerCase();const k=KIND.find(([w])=>new RegExp('\\b'+w).test(n));return k?k[1]:r.cat==='weapon'?'a weapon':r.cat==='armor'?'armor':'something'}
function shown(x){const r=IT[x.id];if(!x.unid)return r;const base=IT[/ring\b/i.test(r.name)?'magic-ring':/wand\b/i.test(r.name)?'magic-wand':/potion/i.test(r.name)?'potion':'unidentified-item'];
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
  if(it.q)lines.push(`<div class="q">${quals(it.q)}</div>`);
  if(it.looks)lines.push(`<div class="ln"><b>Looks like</b> ${esc(it.looks)} — it hums with magic. <a class="term" href="#rule/r-iding-magic-items" data-term="r-iding-magic-items">Identify it</a> to learn what it does.</div>`);
  if(it.text)lines.push(`<div class="txt">${linkify(it.text)}</div>`);
  if(it.ud){const left=i?.ud??it.ud[0];lines.push(`<div class="ln"><a class="term" href="#rule/ud" data-term="ud">UD</a> <span class="pips">${Array.from({length:it.ud[0]},(_,k)=>`<button class="pip ${k<left?'':'gone'}" data-action="${i&&!o.ro?'ud':''}" data-uid="${i?.uid||''}" aria-label="${k<left?'Remove a usage die (rolled 1–2)':'Restore a usage die'}" ${i&&!o.ro?'':'tabindex="-1"'}></button>`).join('')}</span> <span class="small">${esc(it.ud[1])}</span></div>`)}
  if(i&&i.coins!=null)lines.push(`<div class="ln"><b>${i.coins} gc</b> inside (max ${purseMax(i)})</div>`);
  const acts=[];
  if(i&&!o.ro){
    if(it.light&&i.sec==='hand')acts.push(`<button data-action="light" data-uid="${i.uid}" aria-pressed="${!!i.lit}">${i.lit?'Lit — douse':'Light it'}</button>`);
    if(it.cat==='armor'&&!isShield(it)&&i.sec==='pack')acts.push(`<button data-action="wear" data-uid="${i.uid}" aria-pressed="${!!i.worn}">${i.worn?'Worn':'Wear'}</button>`);
    if(it.stack>1&&!i.unid)acts.push(`<button data-action="cnt" data-d="-1" data-uid="${i.uid}" aria-label="Use one">${/Ration|Feed/.test(it.name)?'Eat 1':'Use 1'}</button><button data-action="cnt" data-d="1" data-uid="${i.uid}" aria-label="Add one">+1</button>`);
    if(i.coins!=null)acts.push(`<button data-action="coins" data-uid="${i.uid}">Coins…</button>`);
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
    ${i?.extra?`<div class="ln small"><b>${esc(i.extra)}</b></div>`:''}<div class="price"><span>${gc(i?.val??it.price)}${n>1&&it.price?' each':''}</span>${n>1?`<span>${n} / ${it.stack}</span>`:''}</div>
  </article>`;
}
const usedIn=id=>{const it=IT[id];const words=it.name.toLowerCase().replace(/^crafting material, /,'').split(' ').filter(w=>w.length>2);return D.items.filter(x=>x.craft&&(x.craft.mats.toLowerCase().includes(it.name.toLowerCase())||(it.cat==='material'&&words.every(w=>x.craft.mats.toLowerCase().includes(w.replace(/s$/,''))))))};

/* ================= search ================= */
function searchItems(q,kw){
  q=q.trim().toLowerCase();if(!q)return [];
  const name=[],made=[],text=[];
  for(const it of D.items){
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
const TABS={crow:[['sheet','Sheet'],['inventory','Inventory'],['actions','Actions'],['traits','Traits'],['pets','Pets'],['hirelings','Hirelings'],['travel','Travel'],['rest','Rest'],['miasma','Miasma'],['market','Village']],
  session:[['session','Dungeon turn'],['loot','Loot'],['rtravel','Travel day'],['rmiasma','Miasma'],['village','Villages & XP']]};
// Forge Steel layout: sections in the bottom bar, page title + page actions in the top bar, sub-tabs only inside a crow or the session.
function render(){
  if(S.area==='crow'&&!ME||S.area==='build'&&!S.b)S.area='crows';
  store.set('area',S.area);saveCrows();
  $$('#nav [data-action=go]').forEach(b=>b.setAttribute('aria-current',b.dataset.v===S.area||b.dataset.v==='crows'&&/^(crow|build)$/.test(S.area)?'page':'false'));
  const v=VIEWS[S.area](),tabs=TABS[S.area],tab=tabs&&S.tab[S.area];
  $('#ptl').textContent=v.title;$('#acts').innerHTML=v.acts||'';
  $('#tabs').hidden=!tabs;$('#tabs').innerHTML=tabs?tabs.map(([k,l])=>`<button role="tab" aria-selected="${k===tab}" data-action="tab" data-v="${k}">${l}</button>`).join(''):'';
  $('#main').innerHTML=`<div class="page ${tabs?'':'solo'}">${tabs?SCREENS[tab]():v.body()}</div>`;
  closePops(0);hidePreview();
  const k=tab||(S.area==='library'&&S.lib.cat);AFTER[k]&&AFTER[k]();
  drawDT();window.syncOut?.();
}
const SCREENS={},AFTER={};

/* ---------- DT clock (shared) ---------- */
const mmss=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
function drawDT(){
  const t=S.dt,g=[30,20,10][t.n-1];
  $('#dtchip').innerHTML=`<span class="dtchip ${t.running?'':'idle'}"><a class="term" href="#rule/dt" data-term="dt" style="color:inherit">DT</a> <b>${t.n}</b> <span>${mmss(t.left)}</span><span class="bar"><i style="width:${100*t.left/(t.len*60)}%"></i></span>${g?`<span class="small">greed +${g}%</span>`:''}${t.running?'':' <span class="small">paused</span>'}</span>`;
  const big=$('#bigclock');if(big)big.textContent=mmss(t.left);
}
setInterval(()=>{const t=S.dt;if(!t.running)return;t.left=Math.max(0,t.left-1);if(t.left===0){t.running=false;t.end={step:1};toast('Dungeon turn is over — end-of-DT steps are ready');if(S.area==='session'&&S.tab.session==='session')render()}drawDT()},1000);

/* ================= PLAYER: character sheet ================= */
SCREENS.sheet=()=>{
  const c=ME,lv=level(c),sp=speed(c),lit=lightOf(c),ar=armorOf(c);
  // Stat strip: every cell is label / value / one meta line, so values share a baseline. Controls live in the meta line.
  const tile=(key,label,v,cls,meta)=>`<div class="kpi ${cls}"><a class="k term" href="#rule/${key}" data-term="${key}">${label}</a><div class="v">${v}</div><div class="m">${meta}</div></div>`;
  const adj=(act,what)=>`<span class="adj"><button data-action="${act}" data-d="-1" aria-label="Lower ${what}">−</button><button data-action="${act}" data-d="1" aria-label="Raise ${what}">+</button></span>`;
  const next=LVL.find(l=>l.min>c.txp);
  return `${S.pendingWounds||S.placing?`<div class="banner ${S.pendingWounds?'bad':''}"><span class="msg">${S.pendingWounds?`<b>Mark ${S.pendingWounds} wound${S.pendingWounds>1?'s':''}</b> in your backpack.`:'<b>A card is waiting for a slot.</b>'}</span><button class="btn sm" data-action="tab" data-v="inventory">Go to Inventory →</button></div>`:''}
  <div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:.75rem">
    <div><div class="muted">${esc(c.bg)}${c.village?` of ${esc(c.village)}`:''} · <b>${coinsOf(c)} gc</b> carried · <a class="term" href="#rule/level" data-term="level">Level ${lv.lv}</a> · ${c.txp} TXP${next?` <span class="small">(${next.min-c.txp} to level ${next.lv})</span>`:''}${c.feature?` · ${esc(c.feature)}`:''}</div></div>
  </div>
  <div class="stack">
    <div class="kpis k7">
      ${tile('stamina','Stamina',`${c.stamina}<small>/ ${stMax(c)}</small>`,c.stamina===0?'bad':'',c.stamina===0?'next damage → wounds':c.stamina<stMax(c)?`${stMax(c)-c.stamina} lost`:'full')}
      ${tile('ad','AD',`${adNow(c)}<small>/ ${adMax(c)}</small>`,'',adSources(c).length?adSources(c).map(i=>IT[i.id].name).join(' + '):'no armor worn')}
      ${tile('wounds','Wounds',`${c.wounds.size}<small>/ 10</small>`,c.wounds.size>=7?'bad':c.wounds.size?'warn':'',c.wounds.size?'death at 10':'none')}
      ${tile('effort','Effort',`${c.effort}<small>/ ${effMax(c)}</small>${c.lore?.n?`<button class="bonus hint" data-action="lore-spend" data-term="tip-lore" aria-label="Spend 1 Effort for ${esc(c.lore.exp)}">+${c.lore.n} ${esc(c.lore.exp)}</button>`:''}${c.effortBonus?`<span class="bonus hint" data-term="tip-effort-bonus" tabindex="0">+${c.effortBonus}</span>`:''}`,'',adj('effort','Effort'))}
      ${tile('speed','Speed',`${sp}<small>/ 5</small>`,sp===0?'bad':sp<5?'warn':'',speedWhy(c))}
      ${tile('light','Light',lit?IT[lit.id].light.join('/'):'None',lit?'':'bad',lit?`${IT[lit.id].name}${lit.ud!=null?` · ${lit.ud} UD`:''}`:'dark: double bane')}
      ${tile('cruelty','Cruelty',`${c.cruelty}`,'',adj('cruelty','cruelty'))}
    </div>
    <div class="box">
      <div class="row" style="gap:1rem;align-items:flex-start">
        <div style="flex:1;min-width:min(16rem,100%)"><h2 class="sec-h">Take damage <span class="muted">AD first, then Stamina, then wounds</span></h2>
          <form class="row" data-form="dmg"><input type="number" name="n" min="0" max="99" inputmode="numeric" aria-label="Damage or healing amount" placeholder="0"><label class="check"><input type="checkbox" name="p"> <a class="term" href="#rule/piercing" data-term="piercing">Piercing</a></label><button class="btn primary">Take damage</button><button type="button" class="btn" data-action="heal">Heal</button></form>
          <div class="row small" style="margin-top:.5rem"><span class="muted">Other wounds:</span><button class="btn sm ghost hint" data-action="wound-type" data-v="starvation" data-term="r-starvation">+ Starvation</button><button class="btn sm ghost hint" data-action="wound-type" data-v="exhaustion" data-term="r-exhaustion">+ Exhaustion</button></div></div>
        <div style="min-width:min(14rem,100%)"><h2 class="sec-h"><a class="term" href="#rule/conditions" data-term="conditions" style="color:inherit">Conditions</a></h2>
          <div class="chips">${CONDITIONS.map(k=>`<button class="chip hint ${c.cond.has(k)?'on':''}" data-action="cond" data-v="${k}" data-term="c-${k}" aria-pressed="${c.cond.has(k)}">${k}</button>`).join('')}</div></div>
      </div>
    </div>
  </div>
  <div class="grid2 g32" style="margin-top:1rem">
   <div class="box">
     <h2 class="sec-h">Characteristics <span class="muted">tap one for its test table</span></h2>
     <div class="kpis">${[['A','Agility'],['M','Mind'],['S','Strength']].map(([k,n])=>`<button class="kpi" data-action="test" data-v="${k}" aria-pressed="${S.test===k}"><span class="k">${n}</span><span class="v">${fmt(c.ch[k])}</span><span class="m">${S.test===k?'hide':'&nbsp;'}</span></button>`).join('')}</div>
     ${S.test?`<div class="testbox">${prHTML([[1,'You don’t manage it, maybe with a setback'],[2,'You do it at a cost, or partly'],[3,'You do it cleanly']],{head:`Test 2d10 + ${S.test} <button class="xbtn" data-action="test" data-v="${S.test}" aria-label="Close" style="margin-left:auto">✕</button>`,sub:`${fmt(c.ch[S.test])} — with an edge +2, a bane −2. Natural 19–20 crit, 2–3 doom.`,mod:c.ch[S.test]})}</div>`:''}
     <h2 class="sec-h" style="margin-top:1rem"><a class="term" href="#rule/expertise" data-term="expertise" style="color:inherit">Expertises</a></h2>
     ${c.lore?`<p class="small" style="margin:.2rem 0">From <b>${esc(c.lore.book)}</b> until your next rest: <span class="chip">${esc(c.lore.exp)}</span></p>`:''}${[['General','gen'],['Weapon','wpn'],['Spellcasting','mag']].map(([l,k])=>`<div class="row" style="margin:.2rem 0"><span class="muted small" style="width:6.5rem">${l}</span><span class="chips">${c.exp[k].map(expChip).join('')||'<span class="muted small">none</span>'}</span></div>`).join('')}
   </div>
   <div class="box">
     ${advHTML(c)}
     <h2 class="sec-h" style="margin-top:1rem"><a class="term" href="#rule/traits" data-term="traits" style="color:inherit">Traits</a></h2>
     ${c.traits.map(t=>`<p class="trait"><b>${esc(t.n)}</b> <span class="muted small">(${esc(t.tree)})</span> ${linkify(t.t)}</p>`).join('')}
     ${c.miasma.length?`<h2 class="sec-h" style="margin-top:1rem">Miasma effects</h2>${fxHTML(c,true)}`:''}
     ${c.extra?.length?`<p class="small"><b>Also:</b> ${esc(c.extra.join(', '))}</p>`:''}${c.npc||c.npcType?`<p class="small"><b>Village connection:</b> ${esc(c.npc||'unnamed')}${c.npcRel?` — ${esc(c.npcRel)}`:''}${c.npcType?` <span class="chip hint" data-term="npc-${esc(c.npcType)}" tabindex="0">${esc(c.npcType)}</span>`:''}</p>`:''}
     <button class="btn sm" data-action="tab" data-v="traits" style="margin-top:.5rem">Trait trees →</button>
   </div>
  </div>`;
};

SCREENS.inventory=()=>{const c=ME,sp=speed(c),lit=lightOf(c);
  return `${placingBanner()}${woundBanner()}
  <div class="grid2" style="margin-bottom:1rem">${poolHTML(false)}
   <div class="box small"><h2 class="sec-h">How it works <span class="muted">Speed ${sp} · Light ${lit?esc(IT[lit.id].name):'none'} · ${c.wounds.size} wound${c.wounds.size===1?'':'s'}</span></h2><ul style="margin:0;padding-left:1.1rem"><li>Drag cards between slots (mouse or finger); drag to the top or bottom edge to scroll.</li><li>Tap an empty slot to add a card by name.</li><li>Drag a card onto the loot pool to give it to the party — stacks ask how many.</li><li>Hover a card to see it bigger; <b>i</b> opens everything about it.</li></ul></div></div>
  ${boardHTML(c)}`};
function placingBanner(){
  const mv=S.moving&&findInst(S.moving);if(mv)return `<div class="banner" role="status"><span class="msg"><b>Moving ${esc(nm(mv))}</b> — tap a green slot, another card to swap, or the loot pool.</span><button class="btn sm" data-action="cancel-place">Cancel (Esc)</button></div>`;
  if(!S.placing)return '';const p=S.placing;
  return `<div class="banner" role="status"><span class="msg"><b>Choose a slot for ${esc(nm(p))}${p.count>1?' ×'+p.count:''}</b> — green slots fit (${sizeIn(IT[p.id],'pack')} slot${IT[p.id].slots>1?'s':''}).</span><button class="btn sm" data-action="cancel-place">Cancel (Esc)</button></div>`;
}
function woundBanner(){
  if(!S.pendingWounds)return '';
  return `<div class="banner bad" role="alert"><span class="msg"><b>Mark ${S.pendingWounds} ${S.pendingWoundType?S.pendingWoundType+' ':''}wound${S.pendingWounds>1?'s':''}</b> — tap backpack slots to place them. A slot with an item <i>and</i> a wound costs 1 Speed, so prefer empty slots.</span></div>`;
}
function boardHTML(c){
  const cell=(sec,i,o)=>{
    const x=o[i],mv=S.moving&&findInst(S.moving);const tgt=S.placing?(!canPlace(c,S.placing.id,sec,i,S.placing.uid)?'target':'nope'):mv?(!canPlace(c,mv.id,sec,i,mv.uid)||(x&&x.i!==mv&&x.k===0)?'target':'nope'):'';
    const wbtn=sec==='pack'?`<button class="wbtn ${(c.woundType||{})[i]?'hint':''} ${S.pendingWounds&&!c.wounds.has(i)?'pending':''}" data-action="wound" data-v="${i}" aria-pressed="${c.wounds.has(i)}" ${(c.woundType||{})[i]?`data-term="r-${c.woundType[i]}"`:''}>${c.wounds.has(i)?({starvation:'Starving',exhaustion:'Exhausted'}[(c.woundType||{})[i]]||'Wound'):'No wound'}</button>`:'';
    const cls=`slot ${tgt} ${c.wounds.has(i)&&sec==='pack'?'wounded':''}`;
    const num=`<span class="num">${sec==='pack'?i+1:sec==='belt'?'Belt '+(i+1):sec==='hand'?'Hand '+(i+1):'Magic '+(i+1)}</span>`;
    if(!x)return `<div class="${cls} empty" data-sec="${sec}" data-idx="${i}" data-action="slot" role="button" tabindex="0" aria-label="Empty ${SEC_NAME[sec]} ${i+1}: add an item">${num}<span class="plus" aria-hidden="true">+</span><span>Add</span>${wbtn}</div>`;
    if(x.k>0)return `<div class="${cls} span" data-sec="${sec}" data-idx="${i}">${num}<div class="cont">↳ ${esc(nm(x.i))}<br>${x.k+1} / ${sizeIn(IT[x.i.id],sec)}</div>${wbtn}</div>`;
    return `<div class="${cls}" data-sec="${sec}" data-idx="${i}">${num}${cardHTML(shown(x.i),x.i)}${wbtn}</div>`;
  };
  // A card that takes several slots lies across them, like a real card turned sideways (Rules p. 11) — when they sit in one visual row.
  const wb=(sec,i)=>sec==='pack'?`<button class="wbtn ${(c.woundType||{})[i]?'hint':''} ${S.pendingWounds&&!c.wounds.has(i)?'pending':''}" data-action="wound" data-v="${i}" aria-pressed="${c.wounds.has(i)}" ${(c.woundType||{})[i]?`data-term="r-${c.woundType[i]}"`:''}>${c.wounds.has(i)?({starvation:'Starving',exhaustion:'Exhausted'}[(c.woundType||{})[i]]||'Wound'):'No wound'}</button>`:'';
  const rowOf=(sec,i)=>sec==='pack'?Math.floor(i/5):0;
  const row=sec=>{const o=occ(c,sec),out=[];for(let i=0;i<LEN[sec];i++){const x=o[i],n=x&&x.k===0?sizeIn(IT[x.i.id],sec):1;
    if(n>1&&rowOf(sec,i)===rowOf(sec,i+n-1)){const w=Array.from({length:n},(_,k)=>i+k);
      out.push(`<div class="slot wide ${w.some(k=>c.wounds.has(k))&&sec==='pack'?'wounded':''}" style="grid-column:span ${n};--n:${n}" data-sec="${sec}" data-idx="${i}"><span class="num">${sec==='pack'?`${i+1}–${i+n}`:sec==='hand'?'Both hands':SEC_NAME[sec]+' '+(i+1)+'–'+(i+n)}</span>${cardHTML(shown(x.i),x.i)}${sec==='pack'?`<div class="wrow">${w.map(k=>wb(sec,k)).join('')}</div>`:''}</div>`);i+=n-1}
    else out.push(cell(sec,i,o))}return out.join('')};
  return `<div class="board" aria-label="Inventory">
    <div class="grp g2"><div class="lab">Hands <span class="muted">equipped · <a class="term" href="#rule/hands-use" data-term="hands-use">use items from here</a></span></div>${row('hand')}</div><div class="grp g3"><div class="lab"><a class="term" href="#rule/magic-slots" data-term="magic-slots" style="color:inherit">Magic</a> <span class="muted">wearable magic items</span></div>${row('magic')}</div>
    <div class="lab">Belt <span class="muted">swap with hands as a <a class="term" href="#rule/maneuver" data-term="maneuver">maneuver</a></span></div>${row('belt')}<div class="slot pooldrop" id="pooldrop" aria-label="Drop a card here to give it to the loot pool"><div class="cont" style="color:var(--ok);flex-direction:column">⇢ Loot pool<span class="small muted" style="font-family:var(--body);font-weight:400">drop a card here to give it to the party</span></div></div>
    <div class="lab">Backpack <span class="muted">slot number matters for <a class="term" href="#rule/draw-pack" data-term="draw-pack">Draw From Pack</a> — keep key items low</span></div>${row('pack')}
  </div>`;
}
function poolHTML(ref){
  return `<section class="pool" id="pool" aria-label="Loot pool"><h3>Loot pool</h3><p class="small muted" style="margin:.2rem 0 .4rem">${ref?'Shared with the players. Remove anything nobody wants or that you added by mistake.':'Shared with the party. Take what you want; drag your cards here to give them away.'}</p>
   ${S.pool.length?S.pool.map(p=>{const it=ref?IT[p.id]:shown(p);return `<div class="prow" data-pool="${p.uid}"><div class="nm"><b><a href="#" data-action="open-pool" data-uid="${p.uid}" style="color:inherit">${esc(it.name)}</a>${ref&&p.unid?' <span class="chip">unidentified</span>':''}${p.count>1?' ×'+p.count:''}</b><span>${it.looks?`looks like ${esc(it.looks)} · `:''}${it.slots||1} slot${(it.slots||1)>1?'s':''} · ${esc(p.from)}${p.note?' — '+esc(p.note):''}</span></div>${ref?'':`<button class="btn sm" data-action="take" data-uid="${p.uid}">Take</button>`}<button class="xbtn" data-action="pool-remove" data-uid="${p.uid}" aria-label="Remove ${esc(it.name)} from the pool">✕</button></div>`}).join(''):'<p class="muted small">Empty.</p>'}
  </section>`;
}
AFTER.sheet=()=>{};

/* ================= PLAYER: travel roles ================= */
SCREENS.travel=()=>{
  const t=S.travel,c=ME,pace=PACE[t.pace];
  const role=TRAVEL.find(r=>r.role===t.role);
  return `<div class="row" style="justify-content:space-between"><h1>Travel roles</h1><span class="muted">Your cheat sheet for the travel day. You roll the dice; this shows what your number means.</span></div>
  <div class="grid2" style="margin-top:1rem">
   <div class="box"><h2 class="sec-h">1 · Today’s pace <span class="muted">the group decides</span></h2>
     <div class="optgrid sm">${Object.entries(PACE).map(([k,p])=>`<button class="opt" data-action="pace" data-v="${k}" aria-pressed="${t.pace===k}"><b>${p.label}</b><span class="small muted">${p.hex} hex${p.hex>1?'es':''} · EN ${p.en}${p.mod?` · role tests ${p.mod==='edge'?'+2':'−2'}`:''}</span></button>`).join('')}</div></div>
   <div class="box"><h2 class="sec-h">2 · Your role <span class="muted">supporters roll first, then guide, scouts, trackers</span></h2>
     <div class="optgrid sm">${TRAVEL.map(r=>`<button class="opt" data-action="role" data-v="${r.role}" aria-pressed="${r.role===t.role}"><b>${r.role}</b><span class="small muted">${r.limit}</span></button>`).join('')}</div></div>
  </div>
  <h2 class="sec-h" style="margin-top:1.25rem">3 · ${role.role} tasks <span class="muted">safe = automatic, risky = a test</span></h2>
  <div class="grid2">${role.tasks.map(k=>{
    if(k.safe)return `<div class="box"><div class="row" style="justify-content:space-between"><h3>${k.n}</h3><span class="chip">Safe</span></div><p style="margin:.4rem 0 0">${rich(k.d)}</p></div>`;
    const best=k.ch.reduce((a,b)=>c.ch[a]>=c.ch[b]?a:b);const mod=c.ch[best]+(pace.mod==='edge'?2:pace.mod==='bane'?-2:0);
    
    return `<div class="box"><div class="row" style="justify-content:space-between"><h3>${k.n}</h3><span class="chip">Risky</span></div><p style="margin:.4rem 0">${rich(k.d)}</p>
      ${prHTML(k.o.map((x,j)=>[j+1,rich(x)]),{head:`Test 2d10 + ${k.ch.join(' or ')}`,sub:`you use ${best} ${fmt(c.ch[best])}${pace.mod?`, ${pace.mod} ${pace.mod==='edge'?'+2':'−2'}`:''} → total ${fmt(mod)}`,mod})}
      </div>`}).join('')}</div>
  <p class="note small" style="margin-top:1rem">Anyone without a role can assist a risky task. The <a class="term" href="#rule/effort" data-term="effort">Effort</a> rule applies: with a fitting <a class="term" href="#rule/expertise" data-term="expertise">expertise</a>, spend 1 Effort to raise a non-doom result one tier.</p>`;
};

/* ================= PLAYER: Miasma (my own resistance roll) ================= */
const MI_ROWS=()=>TB['miasma-effects'].rows.slice(1).map(r=>{const [lo,hi]=r[0].includes('+')?[+r[0].replace('+',''),99]:r[0].split('-').map(Number);return {lo,hi,t:r[1],up:r[2],n:MI_NAMES[lo]||r[0],dur:MI_DUR[lo]}});
// How long each pair of effects lasts (Rules p. 27): ends when cruelty is gone, when out of the Miasma, once, or forever.
const MI_DUR={1:'cruelty',3:'out',5:'once',7:'cruelty',9:'out',11:'cruelty',13:'perm'};
const DUR_TXT={cruelty:'until you have no cruelty',out:'until you rest outside the Miasma',once:'happens once — remove it when done',perm:'permanent'};
const fxRow=f=>MI_ROWS().find(r=>r.n===f.n)||{};
const miSnap=c=>({cruelty:c.cruelty,miasma:[...c.miasma]});
// The result is stored on the crow, so the player and the Ref see the same roll and can't apply it twice.
function miRoll(c){const snap=miSnap(c);c.cruelty++;let r,hit,tries=0;
  do{r=d(10);hit=MI_ROWS().find(x=>r+c.cruelty>=x.lo&&r+c.cruelty<=x.hi);tries++}while(hit.lo<13&&c.miasma.some(x=>x.n===hit.n)&&tries<30);
  const cr=c.cruelty,fx={n:hit.n,t:hit.t,up:hit.up,dur:hit.dur};if(hit.lo>=13){c.miasma=[fx];c.cruelty=0}else c.miasma.push(fx);
  return c.miLast={rest:c.rests||0,k:'fx',snap,r,cr,hit,rerolled:tries>1}}
function miClear(c){const snap=miSnap(c);c.cruelty=0;c.miasma=c.miasma.filter(x=>(x.dur||fxRow(x).dur)!=='cruelty');return c.miLast={rest:c.rests||0,k:'clear',snap}}
function miUndo(c){const L=c.miLast;if(!L)return;c.cruelty=L.snap.cruelty;c.miasma=L.snap.miasma;c.miLast=null}
const miDone=c=>!!c.miLast&&c.miLast.rest===(c.rests||0);
const fxHTML=(c,rm)=>c.miasma.map((m,k)=>{const r=fxRow(m);return `<div class="fx"><div><b>${esc(m.n)}.</b> ${esc(m.t)}${(m.up||r.up)?`<div class="small"><b>Also:</b> ${esc(m.up||r.up)}</div>`:''}<div class="small muted">Lasts ${DUR_TXT[m.dur||r.dur]||'as the table says'}</div></div>${rm?`<button class="xbtn" data-action="mi-rm" data-k="${k}" aria-label="Remove ${esc(m.n)}">✕</button>`:''}</div>`}).join('');
function miResultHTML(c,undo){const L=c.miLast;if(L.k==='clear')return `<div class="result good">Cruelty ${L.snap.cruelty} → 0.${L.snap.miasma.length!==c.miasma.length?' Effects that last until you have no cruelty ended.':''} <button class="btn sm" data-action="${undo}" data-k="${PARTY.indexOf(c)}">Undo</button></div>`;
  return `<div class="result bad">Cruelty is now ${L.cr}. d10 <span class="roll">${L.r}</span> + ${L.cr} = <b>${L.r+L.cr}: ${esc(L.hit.n)}</b>${L.rerolled?' <span class="small muted">(rerolled an effect you already had)</span>':''}
   <div style="margin-top:.35rem">${esc(L.hit.t)}</div><div class="small" style="margin-top:.35rem"><b>Also:</b> ${esc(L.hit.up)}</div>
   ${L.hit.lo>=13?'<p class="small" style="margin:.35rem 0 0"><b>This crow is lost to the Miasma and becomes an NPC run by the Ref.</b></p>':''}<button class="btn sm" data-action="${undo}" data-k="${PARTY.indexOf(c)}" style="margin-top:.5rem">Undo</button></div>`}
const MI_NAMES={1:'Despondent',3:'Ravenous and greedy',5:'Destructive rage',7:'Secret jealousy',9:'Lazy',11:'Relish violence',13:'Lost to the Miasma'};
SCREENS.miasma=()=>{
  const c=ME,mod=c.ch.M-c.cruelty,rows=MI_ROWS(),done=miDone(c);
  const where=c.lastRest==='miasma'?(done?'':'You rested in the Miasma — make your Mind RR now.'):c.lastRest==='clear'?'Your last rest was outside the Miasma, so there is nothing to roll.':'';
  return `<p class="muted" style="margin:0 0 1rem">Every human makes a Mind resistance roll after resting in the <a class="term" href="#rule/miasma" data-term="miasma">Miasma</a>. Roll 2d10 at the table, find your result below and use the button for it.</p>
  ${where?`<div class="banner">${where}</div>`:''}
  <div class="cols"><div class="stack">
   ${prHTML([[1,'Gain 1 <a class="term" href="#rule/cruelty" data-term="cruelty">cruelty</a>, then roll d10 + cruelty on the Miasma effects table.'],[2,'Nothing happens.'],[3,'Remove all your cruelty — or improve another human’s result by one tier.']],{head:'Mind RR 2d10 + M',sub:`Mind ${fmt(c.ch.M)} · cruelty −${c.cruelty} → total ${fmt(mod)}`,mod})}
   ${done?miResultHTML(c,'mi-undo')
   :`<div class="grid2"><div class="box"><h3 class="sec-h sm" style="margin-top:0">Tier 1</h3><button class="btn primary" data-action="mi-fx">Gain 1 cruelty and roll the effect</button></div>
     <div class="box"><h3 class="sec-h sm" style="margin-top:0">Tier 3</h3><button class="btn" data-action="mi-clear" ${c.cruelty?'':'disabled'}>Remove all your cruelty (${c.cruelty})</button><p class="small muted" style="margin:.4rem 0 0">Or tell another player their result goes up one tier.</p></div></div>
     <p class="small muted">Tier 2: nothing to do. Your Ref can also roll the effect for you from the Session — it shows up here.</p>`}
   ${c.miasma.length?`<div class="box"><h2 class="sec-h">Your Miasma effects</h2>${fxHTML(c,true)}</div>`:''}
  </div>
  <div class="box"><h2 class="sec-h">Miasma effects <span class="muted">d10 + cruelty — you get both effects</span></h2><table class="rt n1"><tr><th>Roll</th><th>Effects</th></tr>${rows.map(r=>`<tr class="${done&&c.miLast.hit&&c.miLast.hit.lo===r.lo?'hit':''}"><td>${r.hi===99?r.lo+'+':r.lo+'–'+r.hi}</td><td>${esc(r.t)}<div class="small"><b>Also:</b> ${esc(r.up)}</div></td></tr>`).join('')}</table></div></div>`;
};

/* ================= PLAYER: advancement ================= */
function petBack(c,p,i){p.inv=p.inv.filter(x=>x!==i);const pos=firstFitFor(c,i.id);if(pos){i.sec=pos.sec;i.idx=pos.idx;c.inv.push(i);toast(`${nm(i)} → ${SEC_NAME[pos.sec]} ${pos.idx+1}`)}else{S.pool.push({uid:UID++,id:i.id,count:i.count,from:c.name,ud:i.ud,unid:i.unid});toast(`No room — ${nm(i)} went to the loot pool`)}}
const firstFitFor=(c,id)=>{for(const sec of ['pack','belt','hand'])for(let k=0;k<lenOf(c,sec);k++)if(!canPlace(c,id,sec,k))return {sec,idx:k};return null};
function clearWounds(c,kind){const t=c.woundType||{};const ks=Object.keys(t).filter(k=>t[k]===kind);ks.forEach(k=>{c.wounds.delete(+k);delete t[k]});if(ks.length)toast(`${ks.length} ${kind} wound${ks.length>1?'s':''} gone`)}
const coinsOf=c=>c.inv.reduce((a,i)=>a+(i.coins||0)+(i.id==='gold-coins'?i.count:0),0);
// built on first use: BOOK is defined further down the file
let _allExp;const allExp=()=>_allExp||(_allExp=(()=>{const out={gen:[],mag:[],wpn:[]};let k=null;for(const p of BOOK['r-effort-expertise'].body){if(p.h)k=/General/.test(p.h)?'gen':/Spell/.test(p.h)?'mag':/Weapon/.test(p.h)?'wpn':null;if(p.tb&&k)out[k]=p.tb.map(r=>r[0].replace(/^Expertise /,''))}return out})());
const hasAnyExp=(c,e)=>[...c.exp.gen,...c.exp.wpn,...c.exp.mag].includes(e)||c.lore?.exp===e;
// Levels whose choices (a new expertise, maybe +1 to a characteristic) aren't made yet. XP only counts after a rest.
const pendingLevels=c=>LVL.filter(l=>l.lv>1&&l.lv<=level(c).lv&&!(c.lvDone||[]).includes(l.lv));
function advHTML(c){const lv=level(c),next=LVL.find(l=>l.min>c.txp),pend=pendingLevels(c),L=S.lvl||(S.lvl={});
  return `<h2 class="sec-h"><a class="term" href="#rule/c-advancement" data-term="c-advancement" style="color:inherit">Level & XP</a></h2>
   <div class="pstats" style="font-size:.9rem;margin-bottom:.5rem"><span>Level <b>${lv.lv}</b></span><span>TXP <b>${c.txp}</b>${next?` <span class="muted">(${next.min-c.txp} to ${next.lv})</span>`:''}</span><span>XP to spend <b>${c.txp-c.xpSpent}</b></span>${c.xpBank?`<span>+${c.xpBank} <span class="muted">after your next rest</span> <button class="xbtn" data-action="xp-unbank" aria-label="Cancel the XP waiting for your rest">✕</button></span>`:''}</div>
   <form class="row" data-form="xp"><input type="number" name="n" min="0" data-inc="100" placeholder="XP" aria-label="XP gained"><button class="btn sm">Add XP</button><button type="button" class="btn sm ghost" data-action="xp-fix">Correct TXP…</button></form>
   <p class="small muted" style="margin:.35rem 0 0">Added XP counts after you finish a rest. Correct TXP fixes a mistake: levels and traits it no longer covers are undone.</p>
   ${pend.map(l=>{const pick=L[l.lv]||{};return `<div class="banner" style="margin:.6rem 0 0;display:block"><b>Level ${l.lv}:</b> +2 Stamina (done), choose a new expertise${l.ch?' and +1 to a characteristic (max 4)':''}.
     <div class="row" style="margin-top:.4rem"><select data-action="lvexp" data-lv="${l.lv}" aria-label="New expertise"><option value="">New expertise…</option>${Object.entries(allExp()).map(([k,a])=>`<optgroup label="${k==='gen'?'General':k==='mag'?'Spellcasting':'Weapon'}">${a.filter(e=>!hasAnyExp(c,e)).map(e=>`<option ${pick.exp===e?'selected':''}>${esc(e)}</option>`).join('')}</optgroup>`).join('')}</select>
     ${l.ch?['A','M','S'].map(k=>`<button class="btn sm ${pick.ch===k?'primary':''}" data-action="lvch" data-lv="${l.lv}" data-v="${k}" ${c.ch[k]>=4?'disabled':''}>${CHN[k]} ${fmt(c.ch[k])}→${fmt(c.ch[k]+1)}</button>`).join(''):''}
     <button class="btn sm primary" data-action="lvok" data-lv="${l.lv}" ${pick.exp&&(!l.ch||pick.ch)?'':'disabled'}>Apply</button></div></div>`}).join('')}`}
/* ================= PLAYER: actions, maneuvers, reactions (Rules pp. 19-21) from what the crow holds ================= */
const bookLi=(id,name)=>{const B=BOOK[id].body,k=B.findIndex(p=>(p.li||'').startsWith('**'+name));if(k<0)return {t:'',rows:null};let i=k+1,head=null,rows=[];if(B[i]?.roll){head=B[i].roll;i++}while(B[i]?.tier){rows.push([B[i].tier,bookText(B[i].x)]);i++}
  return {t:B[k].li.replace(/^\*\*[^*]+\*\*\s*/,''),head,rows:rows.length?rows:null}};
const testMod=(c,head)=>{const ks=(head||'').replace(/^2d10 \+ /,'').split(/ or /).map(x=>x.trim()).filter(k=>'AMS'.includes(k)&&k);return ks.length?ks.reduce((a,k)=>c.ch[k]>c.ch[a]?k:a):null};
function abilityHTML(a){const c=ME;const k=testMod(c,a.head);
  return `<article class="abil ${a.off?'off':''}"><header><b>${esc(a.name)}</b><span class="chip">${a.kind}</span></header>
   ${a.src?`<div class="small muted">${a.src}</div>`:''}${a.t?`<p class="small" style="margin:.35rem 0">${a.t}</p>`:''}
   ${a.rows?prHTML(a.rows,{head:esc(a.head||'Test'),sub:k?`you use ${k} ${fmt(c.ch[k])}`:'',mod:k?c.ch[k]:null}):''}
   ${a.off?`<p class="small why">${esc(a.off)}</p>`:''}</article>`}
function abilities(c){const out={Action:[],Maneuver:[],Reaction:[]};const hand=c.inv.filter(i=>i.sec==='hand'),handSlots=occ(c,'hand').filter(Boolean).length,free=2-handSlots,sp=speed(c);
  const weapons=hand.filter(i=>IT[i.id].cat==='weapon'&&!i.unid),melee=weapons.filter(i=>/Melee/.test(IT[i.id].range||''));
  const belt=c.inv.filter(i=>i.sec==='belt'),ammoFor=it=>/Crossbow/.test(it.name)?/Bolt/:/Arrow/;
  const add=(kind,o)=>out[kind].push(Object.assign({kind},o));
  // attacks with what is in hand
  for(const i of weapons){const it=IT[i.id],r=it.range||'',bow=it.wtype==='Bow',ammo=bow&&belt.some(b=>ammoFor(it).test(IT[b.id].name));
    const rows=[[1,/Ranged/.test(r)&&!/Melee/.test(r)?'Miss. Allies next to the target may be hit.':'Miss — the target can counter.'],...it.tiers.h.map((h,j)=>[j+2,esc(it.tiers.v[j])+' damage'])];
    const exp=it.wtype&&hasAnyExp(c,it.wtype)?` · your ${it.wtype} expertise lets you spend Effort`:'';
    add('Action',{name:`Attack: ${it.name}`,src:`${esc(r)}${it.q?' · '+quals(it.q):''}${exp}${parryOf(c,it)&&adOf(c,i)===0?' · <b>no Parry AD left: −1 damage</b>':''}`,head:it.attack,rows,off:bow&&!ammo?`No ${/Crossbow/.test(it.name)?'bolts':'arrows'} on your belt`:''});
    if(/Melee/.test(r)&&/Ranged/.test(r))add('Action',{name:`Throw: ${it.name}`,src:esc(r.replace(/Melee \d+\//,''))+' · decide before the test',head:it.attack,rows:[[1,'Miss. Allies next to the target may be hit.'],...rows.slice(1)]})}
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
SCREENS.actions=()=>{const c=ME,A_=abilities(c),hand=c.inv.filter(i=>i.sec==='hand');
  return `<p class="muted" style="margin:0 0 1rem">What ${esc(c.name)} can do right now, from the cards in hand (${hand.length?esc(hand.map(i=>nm(i)).join(', ')):'empty hands'}) and the rules. Greyed cards tell you what’s missing. <a class="term" href="#rule/r-fast-turn" data-term="r-fast-turn">Fast turn</a>: one maneuver or one action. <a class="term" href="#rule/r-slow-turn" data-term="r-slow-turn">Slow turn</a>: a maneuver and an action, or two maneuvers.</p>
   ${['Action','Maneuver','Reaction'].map(k=>`<h2 class="sec-h">${k}s <span class="muted">${A_[k].filter(a=>!a.off).length} available</span></h2><div class="abils">${A_[k].map(abilityHTML).join('')}</div>`).join('')}`};

/* ================= PLAYER: trait trees (Character Booklet pp. 7-30) ================= */
const traitOfTree=(tree,n)=>D.traits.find(t=>t.tree===tree&&t.n===n);
function traitState(c,tree,k){const T=D.trees[tree],nd=T.nodes[k],own=x=>c.traits.some(t=>t.tree===tree&&t.n===x);
  if(own(nd.n))return 'own';if(traitOfTree(tree,nd.n)?.start)return 'open';
  return T.links.some(([a,b])=>(a===k&&own(T.nodes[b].n))||(b===k&&own(T.nodes[a].n)))?'open':'locked'}
SCREENS.traits=()=>{const c=ME,xp=c.txp-c.xpSpent,names=Object.keys(D.trees);S.tree??=c.traits[0]?.tree&&D.trees[c.traits[0].tree]?c.traits[0].tree:names[0];const tree=S.tree,T=D.trees[tree],first=D.traits.find(t=>t.tree===tree);
  return `<div class="lib"><nav class="libnav tnav" aria-label="Trait trees"><h3>Trees</h3>${names.map(n=>{const k=c.traits.filter(t=>t.tree===n).length;return `<button data-action="tree" data-v="${esc(n)}" aria-current="${tree===n}">${esc(n)}<span>${k?k+' ✓':''}</span></button>`}).join('')}</nav>
   <div><div class="row" style="justify-content:space-between;margin-bottom:.5rem"><div><h2 style="font-size:1.4rem">${esc(tree)}</h2><span class="muted small">${esc(first?.treeText||'')}</span></div>
     <div class="small"><b>${xp}</b> XP to spend${c.xpBank?` <span class="muted">(+${c.xpBank} after your next rest)</span>`:''}</div></div>
    <p class="small muted" style="margin:0 0 .75rem">Buy traits when you finish a rest. A starting trait opens the tree; any other trait needs a line to one you already have.</p>
    <div class="tscroll"><div class="ttree" style="grid-template-columns:repeat(${T.cols},minmax(13rem,1fr));min-width:calc(${T.cols} * 13rem + ${T.cols-1} * 1.75rem)"><svg class="tlines" aria-hidden="true"></svg>
     ${T.nodes.map((nd,k)=>{const t=traitOfTree(tree,nd.n),st=traitState(c,tree,k);return `<div class="tnode ${st}" data-k="${k}" style="grid-column:${nd.c+1};grid-row:${nd.r+1}">
       <div class="row" style="justify-content:space-between;gap:.3rem"><b>${esc(nd.n)}</b><span class="small muted">${t.xp.toLocaleString('en')} XP</span></div>
       <p class="small" style="margin:.3rem 0">${linkify(t.t)}</p>
       ${st==='own'?`<div class="row" style="justify-content:space-between"><span class="chip on">✓ yours</span>${c.traits.find(x=>x.tree===tree&&x.n===nd.n)?.xp?`<button class="btn sm ghost" data-action="trefund" data-k="${k}">Undo</button>`:''}</div>`:st==='open'?`<button class="btn sm" data-action="tbuy" data-k="${k}" ${t.xp>xp?'disabled':''}>${t.xp>xp?`Need ${t.xp} XP`:'Buy'}</button>`:'<span class="small muted">needs a linked trait</span>'}</div>`}).join('')}</div></div></div></div>`};
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
function petSlotsHTML(p,k,kind='pets'){const o=occ(p,'pack');if(!o.length)return `<p class="small muted">${kind==='pets'?'This animal':'They'} can’t carry anything.</p>`;
  return `<div class="petslots">${o.map((x,i)=>{const w=p.wounds.includes(i),wb=`<button class="wbtn" data-action="pet-wound" data-kind="${kind}" data-k="${k}" data-v="${i}" aria-pressed="${w}">${w?'Wound':'No wound'}</button>`;
    if(x&&x.k>0)return `<div class="slot span ${w?'wounded':''}"><span class="num">${i+1}</span><div class="cont">↳ ${esc(nm(x.i))}</div>${wb}</div>`;
    if(x)return `<div class="slot ${w?'wounded':''}"><span class="num">${i+1}</span>${cardHTML(shown(x.i),x.i,{ro:true,info:false})}<div class="wrow"><button class="wbtn" data-action="pet-take" data-kind="${kind}" data-k="${k}" data-uid="${x.i.uid}">Take back</button>${wb}</div></div>`;
    return `<div class="slot empty ${w?'wounded':''}"><span class="num">${i+1}</span><span class="muted small">empty</span>${wb}</div>`}).join('')}</div>`}
SCREENS.pets=()=>{const c=ME;c.pets??=[];const sel=S.petPick||'goat';
  return `<p class="muted" style="margin:0 0 1rem">Pets follow one owner. They don’t take turns: use the <a class="term" href="#rule/r-pets-in-combat" data-term="r-pets-in-combat">Command</a> maneuver. Their backpack slots carry your gear and take wounds like yours; they eat on rests.</p>
   ${c.pets.map((p,k)=>{const m=MON[p.mon],used=occ(p,'pack').filter(Boolean).length;return `<div class="box" style="margin-bottom:1rem">
     <div class="row" style="justify-content:space-between"><div class="row"><input type="text" value="${esc(p.name)}" data-pet-name="${k}" aria-label="Pet name" style="font-weight:700;width:12rem"><span class="muted small">${esc(m.name)} · ${esc(m.st.Size||'')} · power ${esc(m.st.Power||'?')}</span></div>
      <div class="row"><button class="btn sm" data-action="open-mon" data-id="${m.id}">Stat block</button><button class="btn sm ghost" data-action="pet-del" data-k="${k}">Let go</button></div></div>
     <div class="kpis" style="margin:.75rem 0"><div class="kpi ${p.st===0?'bad':''}"><span class="k">Stamina</span><span class="v">${p.st}<small>/ ${petMax(p)}</small></span><span class="m"><span class="adj"><button data-action="pet-st" data-k="${k}" data-d="-1" aria-label="Lower">−</button><button data-action="pet-st" data-k="${k}" data-d="1" aria-label="Raise">+</button></span></span></div>
      <div class="kpi"><span class="k">Speed</span><span class="v">${esc(m.st.Speed||'—')}</span><span class="m">&nbsp;</span></div>
      <div class="kpi"><span class="k">AD</span><span class="v">${esc(m.st.AD||'0')}</span><span class="m">&nbsp;</span></div>
      <div class="kpi ${p.wounds.length?'warn':''}"><span class="k">Wounds</span><span class="v">${p.wounds.length}<small>/ ${p.len.pack}</small></span><span class="m">&nbsp;</span></div>
      <div class="kpi"><span class="k">Slots</span><span class="v">${used}<small>/ ${p.len.pack}</small></span><span class="m">${FEED[m.st.Size]?FEED[m.st.Size]+' feed per rest':'1 feed per rest'}</span></div></div>
     <h3 class="sec-h sm">Backpack <span class="muted">give a card from your inventory:</span></h3>
     <div class="row" style="margin-bottom:.5rem"><select data-pet-give="${k}" aria-label="Card to give"><option value="">Pick a card you carry…</option>${c.inv.filter(i=>i.sec!=='magic').map(i=>`<option value="${i.uid}">${esc(nm(i))}${i.count>1?' ×'+i.count:''} — ${SEC_NAME[i.sec]} ${i.idx+1}</option>`).join('')}</select></div>
     ${petSlotsHTML(p,k)}</div>`}).join('')||'<p class="muted">No pets yet.</p>'}
   <div class="box"><h2 class="sec-h">Add a pet <span class="muted">any animal; buy at the stables or befriend one in the wild</span></h2>
    <div class="row"><select data-action="pet-pick" aria-label="Animal">${animals().map(m=>`<option value="${m.id}" ${sel===m.id?'selected':''}>${esc(m.name)} — ${esc(m.st.Size||'')}, ${esc(m.st.Slots||0)} slot${+m.st.Slots===1?'':'s'}${PET_PRICE(m.st.Power)!=null?`, ${PET_PRICE(m.st.Power).toLocaleString('en')} gc`:''}</option>`).join('')}</select>
     <input type="text" id="petname" placeholder="Name (optional)" aria-label="Pet name"><button class="btn primary" data-action="pet-add">Add pet</button></div>
     ${(()=>{const v=vHere(),l=lvlOf(v,'stables');return l?`<label class="check small" style="margin-top:.4rem"><input type="checkbox" id="petbuy" checked> Buy it at the ${esc(v.name)} stables (pets up to power ${INST.stables.val[l-1]}${v.home?'':', +20% away from home'}) — untick for one you befriended</label>`:`<p class="small muted" style="margin:.4rem 0 0">${v?'No stables here':'Not in a village'}: add a pet you befriended (Pets, 2d10 + M).</p>`})()}</div>`};
const hirePay=h=>Math.max(10,(parseInt(MON[h.mon].st.Power)||0)*10);
SCREENS.hirelings=()=>{const c=ME;c.hires??=[];const sel=S.hirePick||humans()[0].id;
  return `<p class="muted" style="margin:0 0 1rem">Hirelings follow the same rules as crows but don’t gain XP. Each day: pay them (power × 10 gc, at least 10) and give them a day’s food. If one dies in your service, their family is owed their gear, pay and power × 500 gc.</p>
   ${c.hires.map((h,k)=>{const m=MON[h.mon],max=parseInt(m.st.Stamina)||1;return `<div class="box" style="margin-bottom:1rem">
     <div class="row" style="justify-content:space-between"><div class="row"><input type="text" value="${esc(h.name)}" data-hire-name="${k}" aria-label="Hireling name" style="font-weight:700;width:12rem"><span class="muted small">${esc(m.name)}</span></div>
      <div class="row"><button class="btn sm" data-action="open-mon" data-id="${m.id}">Stat block</button><button class="btn sm ghost" data-action="hire-del" data-k="${k}">Dismiss</button></div></div>
     <div class="kpis" style="margin:.75rem 0"><div class="kpi ${h.st===0?'bad':''}"><span class="k">Stamina</span><span class="v">${h.st}<small>/ ${max}</small></span><span class="m"><span class="adj"><button data-action="hire-st" data-k="${k}" data-d="-1" aria-label="Lower">−</button><button data-action="hire-st" data-k="${k}" data-d="1" aria-label="Raise">+</button></span></span></div>
      <div class="kpi"><span class="k">AD</span><span class="v">${parseInt(m.st.AD)||0}</span><span class="m">${esc((m.st.AD||'').replace(/^\d+\s*\(?|\)$/g,''))||'&nbsp;'}</span></div>
      <div class="kpi ${h.wounds?.length?'warn':''}"><span class="k">Wounds</span><span class="v">${h.wounds?.length||0}<small>/ ${h.len?.pack||0}</small></span><span class="m">&nbsp;</span></div>
      <div class="kpi"><span class="k">Power</span><span class="v">${esc(m.st.Power||'0')}</span><span class="m">death pay ${(parseInt(m.st.Power)||0)*500} gc</span></div>
      <div class="kpi"><span class="k">Pay / day</span><span class="v">${hirePay(h)}<small> gc</small></span><span class="m">${h.days||0} day${h.days===1?'':'s'} paid</span></div></div>
     ${m.st.Equipment?`<p class="small"><b>Gear</b> ${esc(m.st.Equipment)}</p>`:''}
     <h3 class="sec-h sm">Backpack <span class="muted">give a card from your inventory:</span></h3>
     <div class="row" style="margin-bottom:.5rem"><select data-pet-give="${k}" data-kind="hires" aria-label="Card to give"><option value="">Pick a card you carry…</option>${c.inv.filter(i=>i.sec!=='magic').map(i=>`<option value="${i.uid}">${esc(nm(i))}${i.count>1?' ×'+i.count:''} — ${SEC_NAME[i.sec]} ${i.idx+1}</option>`).join('')}</select></div>
     ${petSlotsHTML(h,k,'hires')}
     <div class="row" style="margin-top:.75rem"><button class="btn sm primary" data-action="hire-pay" data-k="${k}">Pay today: ${hirePay(h)} gc + 1 ration</button></div></div>`}).join('')||'<p class="muted">No hirelings.</p>'}
   <div class="box"><h2 class="sec-h">Hire someone <span class="muted">stat blocks from the Bestiary</span></h2>
    <div class="row"><select data-action="hire-pick" aria-label="Hireling">${humans().map(m=>`<option value="${m.id}" ${sel===m.id?'selected':''}>${esc(m.name)} — ${Math.max(10,(parseInt(m.st.Power)||0)*10)} gc/day</option>`).join('')}</select>
     <input type="text" id="hirename" placeholder="Name (optional)" aria-label="Hireling name"><button class="btn primary" data-action="hire-add">Hire</button></div>
     <p class="small muted" style="margin:.4rem 0 0">${(()=>{const v=vHere(),l=lvlOf(v,'barracks');return l?`The ${esc(v.name)} barracks has hirelings up to power ${INST.barracks.val[l-1]}. Anyone stronger you meet on the road.`:v?'No barracks here: hire someone you met.':'Not in a village: hire someone you met.'})()}</p></div>`};

/* ================= PLAYER: rest & rest activities ================= */
const RACT=[['lore','Study a Lore Book','lore-book','Gain the book’s expertise and extra Effort for it until your next rest.'],['craft','Craft Equipment','r-craft-equipment','Make one crafting roll toward an item you can craft.'],['identify','Identify Item','r-identify-item','Learn everything about one magic item you carry.'],['repair','Repair Armor','r-repair-armor','Restore one suit of armor or shield to full AD.'],['harvest','Harvest','r-harvest','Take crafting parts from a monster corpse.'],['sleep','Good Night’s Rest','r-good-nights-rest','Just sleep: +1 Effort until you use it, even in the Miasma.'],['tend','Tend Wounds','r-tend-wounds','Another crow with 2+ wounds loses 2 wounds instead of 1.'],['seclude','Seclude Camp','r-seclude-camp','Hide the camp: EN −1 for this rest. One per group.']];
const TOOLS={Alchemy:'alchemists-tools',Blacksmithing:'blacksmiths-tools',Enchanting:'enchanters-tools'};
const hasExp=(c,e)=>[...c.exp.gen,...c.exp.wpn,...c.exp.mag].includes(e)||c.lore?.exp===e;
const LORE_EXP=['Historical Lore','Magic Lore','Monster Lore','Nature Lore','Religious Lore','Alchemy','Blacksmithing','Enchanting'];
const LORE_BOOKS={'lore-book':1,'fine-lore-book':2,'masterwork-lore-book':3};
const hasTools=(c,e)=>c.inv.some(i=>i.id.endsWith(TOOLS[e]||'~'));
const yes=(ok,t)=>`<li>${ok?'✓':'✗'} ${t}</li>`;
// One crafting roll: 2d10 + M (+4 for Effort/double edge, +2 Crafty connection); doom = 0 points, crit = another roll, minimum 1.
function craftRolls(c,bonus){const out=[];let again=true;while(again&&out.length<5){const a=d(10),b=d(10),n=a+b;again=n>=19;out.push(n<=3?0:Math.max(1,n+c.ch.M+bonus))}return out}
// Rules p. 37: an unidentified magic item can be learned by the Identify Item rest activity, by a test (once per item), or by using it blind.
const held=i=>i.sec==='hand'||i.sec==='magic';
const isConsumable=r=>r.cat==='alchemy'||/potion/i.test(r.name)||/Useless/.test(r.ud?.[1]||'');
function idTestHTML(i){
  return `<div class="box"><h3 class="sec-h sm" style="margin-top:0">Find out what it is</h3>
   <p class="small" style="margin:0 0 .5rem">${held(i)?'You’re holding it, so you can:':'Hold it first — move it to a hand (or a magic slot if it’s wearable). Then you can:'}</p>
   <div class="grid2">
    <div><b>Study</b> <span class="small muted">a test, once per item</span>${prHTML([[1,'It goes off in a harmful way the Ref decides.'],[2,'You learn nothing.'],[3,'You learn everything about it.']],{head:'2d10 + M',mod:ME.ch.M})}
     <button class="btn sm" data-action="id-study" data-uid="${i.uid}" ${i.tried||!held(i)?'disabled':''}>${i.tried?'Already studied':'Roll the test'}</button></div>
    <div><b>Use it</b> <span class="small muted">activate it blind</span><p class="small" style="margin:.4rem 0">Drink it, wear it, swing it, read it — and see what happens. You learn what it is, but a consumable is used up and the effect could be bad.</p>
     <button class="btn sm" data-action="id-use" data-uid="${i.uid}" ${held(i)?'':'disabled'}>Use it</button></div></div>
   <p class="small muted" style="margin:.5rem 0 0">Or pick it for the Identify Item activity on your next rest — that always works.</p></div>`}
function idResult(title,body){const dl=$('#dlg');dl.innerHTML=`<form method="dialog"><h2 style="margin-bottom:.5rem">${title}</h2>${body}<div class="row" style="justify-content:flex-end;margin-top:1rem"><button class="btn primary">OK</button></div></form>`;dl.onclick=null;dl.onclose=null;dl.showModal()}
SCREENS.rest=()=>{
  const c=ME,R=S.rest,unids=c.inv.filter(i=>i.unid),armor=c.inv.filter(i=>adBase(c,i)&&adOf(c,i)<adBase(c,i));
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
        <p class="small muted" style="margin:.4rem 0 0">At the end of the rest: 2d10 + Mind${R.plus?' + 4':''}${R.crafty&&c.npcType==='Crafty'?' + 2':''}. A doom adds nothing; a crit gives another roll.</p></div></div>`:''}`,
    harvest:()=>`<div class="row"><label>Part <select data-action="rpart">${D.items.filter(x=>x.id.endsWith('-part')).map(x=>`<option value="${x.id}" ${R.part===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label>Corpse size <select data-action="rsize">${[[1,'Medium or smaller — 1d6'],[2,'Large — 2d6'],[3,'Huge — 3d6'],[4,'Holy Shit — 4d6']].map(([n,l])=>`<option value="${n}" ${R.size===n?'selected':''}>${l}</option>`).join('')}</select></label></div><p class="small muted">The corpse is destroyed. Parts go onto your board when you finish the rest.</p>`,
    tend:()=>{const l=PARTY.filter(x=>x!==c&&x.wounds.size>=2);return l.length?`<div class="optgrid">${l.map(x=>radio(x.name,x.name,`${x.wounds.size} wounds`)).join('')}</div>`:'<p class="muted">No one else here has 2 or more wounds.</p>'},
    lore:()=>{const books=c.inv.filter(i=>LORE_BOOKS[i.id]);if(!books.length)return '<p class="muted">You carry no lore book.</p>';
      return `<div class="optgrid sm">${books.map(i=>radio(String(i.uid),IT[i.id].name,`+${LORE_BOOKS[i.id]} Effort for its expertise`)).join('')}</div>
      <label class="fld" style="margin-top:.6rem"><b>The book is about</b><select data-action="rlore">${LORE_EXP.map(e=>`<option ${R.loreExp===e?'selected':''}>${e}</option>`).join('')}</select></label>`},
    sleep:()=>'',seclude:()=>'<p class="small muted">Tell the Ref — it lowers the EN for this rest by 1. Only one person per group.</p>'};
  const r=c.inv.find(i=>i.id==='ration'),need=c.miasma.some(x=>x.n===MI_NAMES[3])?2:1,lazy=c.miasma.some(x=>x.n===MI_NAMES[9]);
  return `<p class="muted" style="margin:0 0 1rem">6 uninterrupted hours in one place, 4 of them asleep, and 1 ration. Pick <b>one</b> <a class="term" href="#rule/r-rest-activities" data-term="r-rest-activities">rest activity</a>, then finish the rest.</p>
  ${R.log?`<div class="result good" style="margin-bottom:1rem"><b>Rest finished.</b><ul style="margin:.4rem 0 0">${R.log.map(x=>`<li>${x}</li>`).join('')}</ul>${c.lastRest==='miasma'&&!miDone(c)?`<button class="btn primary" style="margin-top:.5rem" data-action="tab" data-v="miasma">Now the Miasma roll →</button>`:''}</div>`:''}
  <div class="cols"><div class="stack">
   <div class="box"><h2 class="sec-h">1 · Rest activity <span class="muted">one per rest</span></h2>
    <div class="optgrid">${RACT.map(([k,l,id,sum])=>`<button class="opt" data-action="ract" data-v="${k}" aria-pressed="${R.act===k}"><h3>${l}</h3><p class="small" style="margin:0">${sum}</p></button>${R.act===k?`<div class="act-detail"><div class="row" style="justify-content:space-between;margin-bottom:.5rem"><b>${R.act==='sleep'||R.act==='seclude'?'Nothing to choose':'Choose'}</b>${BOOK[id]?`<a class="rule-link" href="#rule/${id}" data-action="open-rule" data-k="${id}">Full rule →</a>`:`<a class="rule-link" href="#item/${id}" data-action="open-item" data-id="${id}">The card →</a>`}</div>${detail[k]()||`<p class="small" style="margin:0">${sum} It applies when you finish the rest.</p>`}</div>`:''}`).join('')}</div></div>
  </div>
  <div class="box"><h2 class="sec-h">2 · Finish the rest</h2>
   <p style="margin:0 0 .4rem"><b>Where did you rest?</b></p><div class="optgrid sm" style="margin-bottom:.75rem">${[['miasma','Outdoors','in the Miasma'],['clear','Sheltered','no Miasma: village, ruin, stone or metal walls']].map(([k,l,sub])=>`<button class="opt" data-action="rwhere" data-v="${k}" aria-pressed="${R.where===k}"><b>${l}</b><span class="small muted">${sub}</span></button>`).join('')}</div>
   ${vHere()?.home?'<p class="small" style="margin:.2rem 0">At home your food is covered: no ration when you rest sheltered.</p>':ME.innFood?'<p class="small" style="margin:.2rem 0">Your inn night includes a day’s food (counts as 1 ration).</p>':''}
   <label class="check"><input type="checkbox" data-action="rrat" ${R.ration&&r?'checked':''} ${r?'':'disabled'}> Eat ${need} ration${need>1?'s':''} ${r?`(${r.count} left)`:'— you have none'}</label>${need>1?'<div class="small muted">Ravenous: you need 2 rations to get the benefits of this rest.</div>':''}
   <ul class="small"><li>Stamina back to ${stMax(c)}</li><li>Lose ${lazy?2:1} wound${lazy?'s':''}${c.wounds.size?'':' (you have none)'}${lazy?' — Lazy':''}</li><li>${R.where==='miasma'?'No Effort back in the Miasma, then the Miasma roll':R.where==='clear'?`Effort back to ${effMax(c)}; cruelty and Miasma effects end`:'Effort depends on where you rested'}</li><li>Items with “Rest” UD refill</li></ul>
   <button class="btn primary" data-action="rfinish">Finish the rest</button></div></div>`;
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
document.addEventListener('input',e=>{if(e.target.id==='buyf'){S.buy.f=e.target.value;const pos=e.target.selectionStart;render();const n=$('#buyf');n.focus();n.setSelectionRange(pos,pos);return}if(e.target.id==='craftq'){const q=e.target.value.toLowerCase();$$('.craftlist li[data-q]').forEach(li=>li.hidden=!li.dataset.q.includes(q))}});

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
function payCoins(c,n){for(const i of c.inv.filter(i=>i.coins!=null)){const k=Math.min(i.coins,n);i.coins-=k;n-=k}for(const i of c.inv.filter(i=>i.id==='gold-coins')){if(!n)break;const k=Math.min(i.count,n);n-=k;addCount(i,-k)}}
// buying goods from merchants counts toward the 10,000 gc that raises Prosperity this cycle
function vSpend(v,n){v.spent=(v.spent||0)+n;if(v.spent>=10000&&!v.raised){v.raised=true;v.prosperity=Math.min(10,v.prosperity+1);toast(`${v.name}: 10,000 gc spent this cycle — Prosperity +1`)}saveVillages()}

/* ---------- player side: the Village tab (was Market) ---------- */
const VT=[['buy','Buy'],['sell','Sell'],['svc','Services'],['invest','Invest']];
function whereHTML(){const v=vHere();
  return `<div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:.75rem"><label class="fld" style="margin:0"><b>Where you are</b><select data-action="vhere" aria-label="Where the party is"><option value="">On the road — no village</option>${VILLAGES.map(x=>`<option value="${x.id}" ${x.id===S.here?'selected':''}>${esc(x.name)}${x.home?' (home)':''}</option>`).join('')}</select></label>
   ${v?`<div class="small" style="text-align:right">Prosperity <b>${fmt(v.prosperity)}</b> · merchants pay <b>${salePctAt(v)}%</b>${v.home?'':' (not your village)'} · cycle day <b>${v.day}</b> / 20<br><span class="muted">${v.home?'Your village: card prices':'Another village: +20% when you buy'}</span></div>`:''}</div>`}
SCREENS.market=()=>{const v=vHere(),t=S.mkt||'buy';
  if(!VILLAGES.length)return `${whereHTML()}<div class="box"><p>No village yet. The Ref creates your village in <b>Session → Villages</b>.</p><button class="btn primary" data-action="go-villages">Set up a village</button></div>`;
  if(!v)return `${whereHTML()}<p class="muted">You’re on the road. Trade, services and investing open when the party is in a village.</p>`;
  const seg=`<div class="seg" role="group" aria-label="Village" style="background:var(--panel2);display:inline-flex;margin-bottom:1rem;flex-wrap:wrap">${VT.map(([k,l])=>`<button style="min-width:6.5rem" data-action="mkt" data-v="${k}" aria-pressed="${t===k}">${l}</button>`).join('')}</div>`;
  const inst=`<div class="chips" style="margin-bottom:1rem">${Object.keys(INST).filter(k=>v.inst[k]?.lvl).map(k=>{const l=lvlOf(v,k),x=v.inst[k];return `<a class="chip hint" data-term="vi-${k}" tabindex="0" href="#rule/${INST[k].rule}" style="text-decoration:none">${INST[k].n} ${l?ORD(l):'closed'}${x.mod?` (${x.mod>0?'+':''}${x.mod} this cycle)`:''}</a>`}).join('')}</div>`;
  return whereHTML()+seg+inst+({buy:buyHTML,sell:sellHTML,svc:svcHTML,invest:investHTML}[t])(v)};

function buyHTML(v){const c=ME,B=S.buy??={pick:null,q:1,x:{},f:'',k:''},st=stockOf(v),have=coinsOf(c),q=B.f.toLowerCase();
  const list=st.filter(s=>(!B.k||s.k===B.k)&&(!q||s.it.name.toLowerCase().includes(q)));
  const sel=st.find(s=>s.it.id===B.pick),it=sel?.it;const ex=it?extrasFor(v,it).filter(([k])=>B.x[k]).map(([,l,m])=>[l,m]):[];
  let ps=it&&priceSteps(v,it,ex);if(ps&&sel.k==='auction'){ps={each:Math.ceil(ps.each*sel.a.mult),steps:[...ps.steps,[`Auction house ${sel.a.mult<1?'discount':'mark-up'} ${Math.round((sel.a.mult-1)*100)}%`,Math.ceil(ps.each*sel.a.mult)]]}}
  const tot=ps?ps.each*B.q:0,merchants=[...new Set(st.map(s=>s.k))];
  const auctionRow=lvlOf(v,'auction')?`<div class="box" style="margin-top:1rem"><h2 class="sec-h">Auction house <span class="muted">anything else: d100 ≤ ${INST.auction.val[lvlOf(v,'auction')-1]} this cycle</span></h2>
     <div class="row"><select id="auq" aria-label="Card to look for"><option value="">Look for a card…</option>${D.items.filter(i=>i.price!=null&&auctionable(i)&&!st.some(s=>s.it===i)&&!(v.auction?.[i.id])).sort((a,b)=>a.name.localeCompare(b.name)).map(i=>`<option value="${i.id}">${esc(i.name)} — ${gc(i.price)}</option>`).join('')}</select><button class="btn sm" data-action="auroll">Roll d100</button></div>
     ${Object.entries(v.auction||{}).map(([id,a])=>`<div class="small" style="margin-top:.3rem">${esc(IT[id].name)}: rolled <b>${a.roll}</b> — ${a.ok?`in stock (${a.left} left), ${a.mult<1?'discount':'mark-up'} ${Math.abs(Math.round((a.mult-1)*100))}%`:'not this cycle'}</div>`).join('')}</div>`:'';
  return `<div class="cols ld"><div><div class="box"><h2 class="sec-h">In stock <span class="muted">${st.length} cards from ${merchants.length} merchant${merchants.length===1?'':'s'}</span></h2>
    <input type="search" id="buyf" value="${esc(B.f)}" placeholder="Filter by name…" aria-label="Filter stock" style="width:100%">
    <div class="chips" style="margin:.5rem 0"><button class="chip ${B.k?'':'on'}" data-action="buyk" data-v="">All</button>${merchants.map(k=>`<button class="chip ${B.k===k?'on':''}" data-action="buyk" data-v="${k}">${INST[k].n}</button>`).join('')}</div>
    <ul class="mlist" style="max-height:28rem;overflow:auto">${list.map(s=>`<li><button data-action="buypick" data-v="${s.it.id}" aria-current="${B.pick===s.it.id}">${esc(s.it.name)}<span>${INST[s.k].n} · ${gc(priceSteps(v,s.it).each)}</span></button></li>`).join('')||'<li class="muted small" style="padding:.5rem">Nothing matches.</li>'}</ul></div>${auctionRow}</div>
   <div class="box">${it?`<div class="grid2" style="align-items:start"><div>${cardHTML(it,null,{full:true,info:false})}</div><div class="stack">
     <p class="small" style="margin:0">Sold by <b>${INST[sel.k].n}</b> (${ORD(sel.lvl)} level)${it.price>=100&&sel.k!=='auction'?`. More than one: a 2nd copy is in stock on ${Math.max(10,10*v.prosperity)}%, each further one 10% less.`:''}</p>
     <label class="fld"><b>How many</b><input type="number" data-action="buyq" min="1" max="${sel.k==='auction'?sel.a.left:99}" value="${B.q}"></label>
     ${extrasFor(v,it).map(([k,l,m])=>`<label class="check small"><input type="checkbox" data-action="buyx" data-v="${k}" ${B.x[k]?'checked':''}> ${esc(l)} (+${m*100}%)</label>`).join('')}
     <table class="rt receipt">${ps.steps.map(([l,p])=>`<tr><td>${esc(l)}</td><td class="nw">${gc(p)}</td></tr>`).join('')}<tr class="tot"><td>${B.q} × ${gc(ps.each)}</td><td class="nw">${gc(tot)}</td></tr></table>
     ${tot>have?`<p class="small" style="color:var(--sel);margin:0">You carry ${gc(have)}.</p>`:''}
     <button class="btn primary" data-action="dobuy" ${tot>have?'disabled':''}>Buy for ${gc(tot)}</button>
     <p class="small muted" style="margin:0">Then choose the slot it goes to on the Inventory tab.</p></div></div>`:'<p class="muted">Pick a card from the stock.</p>'}</div></div>`}

function sellHTML(v){const c=ME,s=S.sell,pctBase=salePctAt(v);
  const mine=c.inv.filter(i=>!i.id.includes('coin-purse')&&i.id!=='gold-coins');let tot=0;const lines=[];
  const to=i=>{const it=shown(i),bs=buyersOf(it).filter(k=>lvlOf(v,k)),o=[...bs.map(k=>[k,INST[k].n]),...(lvlOf(v,'auction')&&auctionable(it)?[['auction','Auction house']]:[])];return o};
  for(const i of mine){const q=s.sel[i.uid];if(!q)continue;const it=shown(i),opts=to(i);if(!opts.length)continue;const k=s.to[i.uid]||opts[0][0];const val=i.val??it.price??(+s.val[i.uid]||0);const g=+s.greed[i.uid]||0;const base=val*q;const wg=Math.floor(base*(1+[0,.3,.2,.1][g]));
    const pct=k==='auction'?(s.ar[i.uid]??=d(10)*(10+v.prosperity)):pctBase;const pay=Math.floor(wg*pct/100);tot+=pay;lines.push([i,it,q,val,g,base,wg,pay,k,pct])}
  return `<p class="muted" style="margin-top:0">Sell to a merchant who deals in it. ${v.home?`Your village pays <b>${pctBase}%</b> of the value (Prosperity ${fmt(v.prosperity)}${v.saleMod?`, ${v.saleMod>0?'+':''}${v.saleMod}% this cycle`:''}).`:'Away from home merchants pay <b>20%</b> of the value.'}${lvlOf(v,'auction')?` The auction house pays 1d10 × (10 + Prosperity)%.`:''}</p>
  <div class="cols"><div class="box"><h2 class="sec-h">Your items <span class="muted">tick what you sell</span></h2>
   <div class="tw"><table class="rt form"><tr><th></th><th>Item</th><th>Qty</th><th>Value each</th><th>Sold to</th><th>Found in <a class="term" href="#rule/greed" data-term="greed">DT</a></th></tr>
   ${mine.map(i=>{const it=shown(i),q=s.sel[i.uid]||0,o=to(i);return `<tr class="${o.length?'':'dim'}"><td><input type="checkbox" data-action="sel" data-uid="${i.uid}" ${q?'checked':''} ${o.length?'':'disabled'} aria-label="Sell ${esc(it.name)}"></td><td><a href="#" data-action="open-inst" data-uid="${i.uid}">${esc(it.name)}</a><br><span class="small muted">${SEC_NAME[i.sec]} ${i.idx+1}</span></td>
     <td class="nw">${i.count>1?`<input type="number" min="0" max="${i.count}" value="${q}" data-action="selq" data-uid="${i.uid}" aria-label="How many"> / ${i.count}`:''}</td>
     <td class="nw">${(i.val??it.price)!=null?gc(i.val??it.price):`<input type="number" min="0" placeholder="gc" value="${esc(s.val[i.uid]||'')}" data-action="selv" data-uid="${i.uid}" aria-label="Value the Ref gave">`}</td>
     <td>${o.length?`<select data-action="selto" data-uid="${i.uid}" aria-label="Merchant">${o.map(([k,l])=>`<option value="${k}" ${(s.to[i.uid]||o[0][0])===k?'selected':''}>${l}</option>`).join('')}</select>`:'<span class="small muted">no buyer here</span>'}</td>
     <td><select data-action="selg" data-uid="${i.uid}" aria-label="Greed bonus">${['—','DT 1 (+30%)','DT 2 (+20%)','DT 3 (+10%)'].map((l,k)=>`<option value="${k}" ${(+s.greed[i.uid]||0)===k?'selected':''}>${l}</option>`).join('')}</select></td></tr>`}).join('')}</table></div></div>
   <div class="box"><h2 class="sec-h">Receipt</h2>
    ${lines.length?`<table class="rt receipt"><tr><th>Item</th><th>You get</th></tr>${lines.map(([i,it,q,val,g,base,wg,pay,k,pct])=>`<tr><td>${esc(it.name)}${q>1?' ×'+q:''}<div class="small muted">${q>1?`${val} × ${q} = `:''}${base} gc${g?` → greed +${[0,30,20,10][g]}% = ${wg}`:''} → ${INST[k].n} ${pct}%</div></td><td>${pay} gc</td></tr>`).join('')}<tr class="tot"><td>Total (rounded down)</td><td>${tot} gc</td></tr></table>
     <button class="btn primary" data-action="dosell">Sell for ${tot} gc</button>`:'<p class="muted">Tick items on the left to see what you’d get.</p>'}</div></div>`}

function svcHTML(v){const c=ME,L=k=>lvlOf(v,k),P=v.prosperity,rows=[];
  const row=(k,title,body,btn='')=>rows.push(`<div class="box"><h2 class="sec-h"><a class="term" href="#rule/${INST[k].rule}" data-term="vi-${k}" style="color:inherit">${INST[k].n}</a> <span class="muted">${ORD(L(k))} level${v.inst[k]?.steward?' · '+esc(v.inst[k].steward):''}</span></h2>${title?`<p style="margin:0 0 .4rem"><b>${title}</b></p>`:''}${body}${btn?`<div class="row" style="margin-top:.5rem">${btn}</div>`:''}</div>`);
  const armor=c.inv.filter(i=>IT[i.id].cat==='armor'&&adOf(c,i)<adBase(c,i));
  if(L('inn')){const max=INST.inn.val[Math.min(L('inn'),5)-1]+P,G=S.gamble??={bet:1,game:'ou',pick:'over'};
    row('inn','',`${v.home?'':`<p class="small" style="margin:0 0 .4rem">A night with a day’s food: 5 gc.</p>`}<p class="small" style="margin:0 0 .4rem">Gambling (a rest activity): bet 1–${max} gc.</p>
     <div class="row"><select data-action="gmode" aria-label="Game"><option value="ou" ${G.game==='ou'?'selected':''}>Over/Under 7 (2d6)</option><option value="num" ${G.game==='num'?'selected':''}>Guess the Number (d6)</option></select>
      ${G.game==='ou'?`<select data-action="gpick" aria-label="Your call">${['over','under','seven'].map(x=>`<option ${G.pick===x?'selected':''}>${x}</option>`).join('')}</select>`:`<select data-action="gpick" aria-label="Your number">${[1,2,3,4,5,6].map(x=>`<option ${+G.pick===x?'selected':''}>${x}</option>`).join('')}</select>`}
      <label class="small">Bet <input type="number" data-action="gbet" min="1" max="${max}" value="${Math.min(G.bet,max)}"></label></div>${G.last?`<div class="result" style="margin-top:.5rem">${G.last}</div>`:''}`,
     `${v.home?'':'<button class="btn sm" data-action="svc" data-v="inn-night">Stay the night (5 gc)</button>'}<button class="btn sm primary" data-action="gamble">Roll</button>`)}
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
SCREENS.session=()=>{
  const t=S.dt,g=[30,20,10][t.n-1],e=t.end;
  return `<div class="cols"><div class="stack">
   <div class="box"><h2 class="sec-h">Dungeon turn</h2>
     <div class="row" style="justify-content:space-between;align-items:center;gap:1rem">
      <div><span class="clock">DT ${t.n}</span> <span class="clock" id="bigclock" style="color:var(--muted)">${mmss(t.left)}</span>
       <div class="small muted">${g?`Treasure found now: <a class="term" href="#rule/greed" data-term="greed">greed</a> +${g}%`:'No greed bonus after DT 3'}</div></div>
      <div class="row"><button class="btn primary" data-action="dt-run" style="min-width:6.5rem">${t.running?'Pause':'Start'}</button><button class="btn" data-action="dt-end">End DT now</button><button class="btn" data-action="enc-check">Noise! Encounter check</button></div></div>
     <div class="fields">
      <label>Length <select data-action="dt-len">${[20,30,60].map(n=>`<option value="${n}" ${t.len===n?'selected':''}>${n} min</option>`).join('')}</select></label>
      <label>Dungeon monsters <select data-action="dt-dun">${Object.entries(FAMS).map(([k,v])=>`<option value="${k}" ${t.dungeon===k?'selected':''}>${v}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" data-action="dt-crowd" ${t.crowded?'checked':''}> Crowded level <span class="muted">+1 EN</span></label>
      <label class="check"><input type="checkbox" data-action="dt-chaos" ${t.chaos?'checked':''}> Trail of chaos <span class="muted">+1 EN</span></label>
      <span class="en"><a class="term" href="#rule/en" data-term="en">EN</a> <b>${enOf()}</b></span></div>
   </div>
   ${e?endDTHTML():''}
   <div class="box"><h2 class="sec-h">Combat <span class="muted">add monsters from an encounter or Library → Monsters</span></h2>${combatHTML()}</div>
  </div>
  <div class="stack"><div class="box"><h2 class="sec-h">Party</h2>${PARTY.map(partyTile).join('')||'<p class="muted small">No crows yet — players create them in Crows.</p>'}</div>${poolHTML(true)}</div></div>`;
};
function partyTile(c){const l=lightOf(c);return `<div class="ptile"><div class="row" style="justify-content:space-between"><a class="pname" href="#" data-action="open-crow" data-i="${PARTY.indexOf(c)}">${esc(c.name)}</a><span class="small muted">${esc(c.bg)} · L${level(c).lv}</span></div>
  <div class="pstats">${[['Stamina',`${c.stamina}/${stMax(c)}`],['AD',adNow(c)],['Wounds',c.wounds.size],['Speed',speed(c)],['Cruelty',c.cruelty]].map(([k,v])=>`<span>${k} <b>${v}</b></span>`).join('')}</div>
  <div class="pstats">${l?`<span>Light <b>${esc(IT[l.id].name)}</b> · ${l.ud??'–'} UD</span>`:'<span class="bad">No light</span>'}${[...c.cond].map(k=>`<span class="chip on hint" data-term="c-${k}" tabindex="0">${k}</span>`).join('')}</div></div>`}
// Rolled once per result object (o), so the counts don't change when the page redraws.
function encounterText(s,o){if(o&&o.html&&o.src===s)return o.html;
  const html=esc(s).replace(/(?:(\d+)d6|(\d+)) (angel|blood creature|demon|plant|undead) ([A-J])\b/gi,(m,dn,n,f,l)=>{const k=dn?Array.from({length:+dn},()=>d(6)).reduce((a,b)=>a+b):+n,id=`${f.toLowerCase().replace(' ','-')}-${l.toLowerCase()}`;
    const lab=`${dn?`${dn}d6 <b class="roll" style="font-size:1rem">${k}</b>`:k} `;return MON[id]?`${lab}<a href="#mon/${id}" data-action="open-mon" data-id="${id}">${f} ${l}</a> <button class="btn sm" data-action="fight" data-id="${id}" data-n="${k}">+ ${k} to combat</button>`:lab+`${f} ${l}`})
   .replace(/(\d+)d6(?! <b)/g,m=>`${m} <b class="roll" style="font-size:1rem">${Array.from({length:+m.slice(0,-2)},()=>d(6)).reduce((a,b)=>a+b)}</b>`);
  if(o)Object.assign(o,{src:s,html});return html}
function rollTable(id,mod=0){const t=TB[id];const m=(t.rows[0][0].match(/(\d*)d(\d+)/)||[0,'',10]);const n=(+m[1]||1);let r=0;for(let k=0;k<n;k++)r+=d(+m[2]);r+=mod;const row=t.rows.slice(1).find(x=>inRange(x[0],r));return {r,row}}
function inRange(cell,r){cell=String(cell).trim();const n=s=>s==='00'?100:+s;let m;if((m=cell.match(/^(\d+)\s*[-–]\s*(\d+)$/)))return r>=n(m[1])&&r<=n(m[2]);if((m=cell.match(/^(\d+)\+$/)))return r>=n(m[1]);if((m=cell.match(/^(\d+)$/)))return r===n(m[1]);return false}
function endDTHTML(){
  const e=S.dt.end;const st=n=>e.step>n?'done':e.step===n?'cur':'locked';
  const uds=PARTY.flatMap(c=>c.inv.filter(i=>!i.unid&&IT[i.id].ud&&/DT/.test(IT[i.id].ud[1])&&(i.lit||!IT[i.id].light)).map(i=>`${esc(c.name)}: ${esc(IT[i.id].name)} (${i.ud} UD)`));
  const conds=PARTY.flatMap(c=>[...c.cond].filter(k=>DT_END_CONDITIONS.includes(k)).map(k=>`${esc(c.name)} — ${k}`));
  const ec=e.check;
  return `<div class="box" style="border-color:var(--sel)"><h2 class="sec-h">End of DT ${S.dt.n} <span class="muted">three steps, then the next DT starts</span></h2><ol class="steps">
   <li class="${st(1)}"><h3>Everyone rolls <a class="term" href="#rule/ud-roll" data-term="ud-roll">UD</a></h3>${uds.length?`<ul class="small" style="margin:.3rem 0">${uds.map(x=>`<li>${x}</li>`).join('')}</ul>`:'<p class="small muted">No running UD.</p>'}<button class="btn sm" data-action="end-step" ${e.step!==1?'disabled':''}>Done</button></li>
   <li class="${st(2)}"><h3>Conditions that end now</h3>${conds.length?`<p class="small">${conds.join(' · ')}</p>`:'<p class="small muted">None active.</p>'}<button class="btn sm" data-action="end-cond" ${e.step!==2?'disabled':''}>${conds.length?'Clear them':'Next'}</button></li>
   <li class="${st(3)}"><h3><a class="term" href="#rule/enc-check" data-term="enc-check">Encounter check</a> — d10 ≤ EN ${enOf()}</h3>
     ${e.step>=3?(ec?encResultHTML(ec):`<button class="btn primary" data-action="end-roll">Roll d10</button>`):''}
     ${e.step>=3&&ec?`<div class="row" style="margin-top:.5rem"><button class="btn primary" data-action="next-dt">Start DT ${S.dt.n+1}</button></div>`:''}</li></ol></div>`;
}
function encResultHTML(ec){
  if(!ec.hit)return `<div class="result good"><span class="roll">${ec.r}</span> &gt; EN ${ec.en}: no encounter.</div>`;
  return `<div class="result bad"><span class="roll">${ec.r}</span> ≤ EN ${ec.en}: <b>encounter${ec.r===1?' — right now!':''}</b>${ec.r>1?' <span class="small">Give the players a sign; it happens during the next DT.</span>':''}
    <div style="margin-top:.4rem">${esc(TB[ec.table].title)} d100 <span class="roll" style="font-size:1rem">${ec.roll}</span> → ${encounterText(ec.text,ec)}</div></div>`;
}
function doEncCheck(en){const r=d(10);const ec={r,en,hit:r<=en};if(ec.hit){ec.table=S.dt.dungeon+'-encounters';const x=rollTable(ec.table);ec.roll=x.r;ec.text=x.row?.[1]||'?'}return ec}
function combatHTML(){
  if(!S.combat.length)return '<p class="muted small">No one is fighting.</p>';
  return S.combat.map(x=>{const m=MON[x.id];const max=parseInt(m.st.Stamina)||1;return `<div class="row crow-row"><a class="pname" href="#mon/${m.id}" data-action="open-mon" data-id="${m.id}" style="min-width:9rem">${esc(m.name)}${x.n>1?' #'+x.n:''}</a>
   <span class="hp" aria-hidden="true"><i style="width:${100*x.st/max}%;${x.st/max<.34?'background:var(--accent)':''}"></i></span><span>${x.st}/${max}${x.ad?` · AD ${x.ad}`:''}</span>
   <form class="row" data-form="mdmg" data-uid="${x.uid}"><input type="number" name="n" placeholder="dmg" aria-label="Damage to ${esc(m.name)}" style="width:4.5rem"><button class="btn sm">Hit</button></form><button class="xbtn" data-action="unfight" data-uid="${x.uid}" aria-label="Remove">✕</button></div>`}).join('');
}

/* ================= REF: loot ================= */
SCREENS.loot=()=>{
  const L=S.lookup,it=L.pick&&IT[L.pick];
  return `<div class="cols"><div class="stack"><div class="box"><h2 class="sec-h">Cards <span class="muted">${D.items.length} from the Playtest 3 decks — pick one to drop</span></h2>
    ${pickerHTML('loot','lootpick',L.pick)}
    <label class="check small" style="margin-top:.4rem"><input type="checkbox" data-action="kw" ${L.kw?'checked':''}> The filter also searches card text and what a card is crafted from</label></div>
    ${it?`<div class="box"><div class="grid2" style="align-items:start"><div>${cardHTML(it,null,{full:true,info:false})}</div><div class="stack">
      <label class="fld"><b>How many</b><input type="number" id="dropq" min="1" max="99" value="1"></label>
      <label class="fld"><b>Note for players</b><input type="text" id="dropn" placeholder="e.g. Room 4 — under the altar"></label>
      <label class="check"><input type="checkbox" id="dropu" ${isMagic(it)?'checked':''}> Unidentified — players see “${esc(shown({id:it.id,unid:true}).name)}”, ${esc(kindOf(it))}</label>
      ${it.price==null?`<label class="fld"><b>Value you decide</b><input type="number" id="dropv" min="0" placeholder="gc"></label>`:''}
      <button class="btn primary" data-action="drop" data-id="${it.id}">Drop into loot pool</button>
      <a href="#item/${it.id}" data-action="open-item" data-id="${it.id}">Crafting, uses and full rules →</a></div></div></div>`:''}
    <div class="box"><h2 class="sec-h">Quick treasure <span class="muted">rolls go straight into the loot pool — remove what you don’t want</span></h2><div class="row">${QT.map(([k,l])=>`<button class="btn sm hint" data-action="qroll" data-v="${k}" data-term="tip-${k}">${l}</button>`).join('')}</div>${S.lookup.qres||''}</div>
    <div class="box"><h2 class="sec-h">Prepared loot <span class="muted">presets you made in Library → Loot presets</span></h2>${LOOT.length?LOOT.map(p=>`<div class="prow"><div class="nm"><b>${esc(p.name||'Untitled')}</b><span>${esc(lootSummary(p))}</span></div><button class="btn sm primary" data-action="loot-drop" data-v="${p.id}">Drop into pool</button></div>`).join(''):'<p class="small muted">None yet.</p>'}<button class="btn sm" data-action="loot-edit" style="margin-top:.5rem">Prepare loot…</button></div>
   </div>${poolHTML(true)}</div>`;
};


/* ================= REF: monsters ================= */
function statblockHTML(m){
  const st=m.st,ch=[['A','Agility'],['M','Mind'],['S','Strength']];
  return `<div class="sb-head f-${m.fam}"><div><div class="chips"><span class="chip">${esc(m.fam)}</span><span class="chip">${esc(st.Size||'')}</span></div></div><div style="text-align:right"><div class="small">Power</div><b style="font-size:1.4rem">${esc(st.Power||'?')}</b></div></div>
   ${m.desc?`<p class="small">${esc(m.desc)}</p>`:''}
   <div class="sb-tiles">${[['Stamina',st.Stamina],['Speed',st.Speed],[st.Reactions?'Reactions':'Slots',st.Reactions||st.Slots],['AD',st.AD]].filter(x=>x[1]).map(([k,v])=>`<div class="tile"><div class="k">${k}</div><div class="v" style="font-size:1.2rem">${esc(v)}</div></div>`).join('')}</div>
   <div class="sb-tiles">${ch.map(([k,n])=>`<div class="tile"><div class="k">${n}</div><div class="v">${esc(st[n]??'?')}</div></div>`).join('')}</div>
   ${st.Equipment?`<p class="small"><b>Equipment</b> ${esc(st.Equipment)}</p>`:''}
   ${m.atk.map(a=>a.bonus?prHTML([[2,linkify(a.t2)],[3,linkify(a.t3||'')]].filter(r=>r[1]),{head:`${esc(a.name)} <span class="chip">${esc(a.bonus)}</span>`,sub:esc(a.range)}):`<p>${esc(a.name)}</p>`).join('')}
   ${m.tr.map(([n,t])=>`<p class="trait"><b>${esc(n)}</b> ${linkify(t)}</p>`).join('')}`;
}
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
     ${/d\d/.test(die)?`<div class="row">${needsMod?`<label class="small">${esc(die.replace(/^.*\+\s*/,''))} <input type="number" data-action="tmod" value="${T.mod}"></label>`:''}<button class="btn primary" data-action="troll">Roll ${esc(die.split(' ')[0])}${t.rows[0][1]==='d6'?' + d6':''}</button></div>`:''}</div>
     ${T.roll?`<div class="result" style="margin:.5rem 0"><span class="roll">${T.roll.r}</span> ${T.roll.row?encounterText(T.roll.row.slice(1).join(' — '),T.roll):'no row matches'}</div>`:''}
     <table class="rt n1"><tr>${t.rows[0].map(h=>`<th>${esc(h)}</th>`).join('')}</tr>${t.rows.slice(1).map(r=>`<tr class="${T.roll&&T.roll.row===r?'hit':''}">${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div></div>`;
};

/* ================= REF: travel day ================= */
// Each role result the Ref ticks: [key, label, effects]. h = hexes, en = travel EN, ren = rest EN, chk = travel checks, rchk = rest checks.
const RT_GUIDE=[['normal','Normal Route (safe)','+1 hex',{h:1}],['secret1','Secret Path — tier 1','lost',{lost:1}],['secret2','Secret Path — tier 2','EN −1, 1 hex slower',{en:-1,h:-1}],['secret3','Secret Path — tier 3','EN −2',{en:-2}],
  ['short1','Shortcut — tier 1','lost',{lost:1}],['short2','Shortcut — tier 2','+1 hex, EN +1',{h:1,en:1}],['short3','Shortcut — tier 3','+2 hexes',{h:2}]];
const RT_BACK=[['back1','Back on Track — tier 1','still lost',{}],['back2','Back on Track — tier 2','found at the end of today',{found:'end'}],['back3','Back on Track — tier 3','found at the start of today',{found:'start'}]];
const RT_SCOUT=[['danger','Scout for Danger (safe)','EN −1',{en:-1}],['places','Scout for Places (safe)','finds POIs; a 2nd scout may take another task',{}],['shelter1','Scout for Shelter — tier 1','+1 check at the rest',{rchk:1}],['shelter2','Scout for Shelter — tier 2','rest EN −1, travel EN +1',{ren:-1,en:1}],['shelter3','Scout for Shelter — tier 3','a ruin outside the Miasma',{ruin:1}],
  ['treasure1','Treasure Hunt — tier 1','+1 check',{chk:1}],['treasure2','Treasure Hunt — tier 2','Minor Treasure, +1 check',{chk:1,loot:'treasure'}],['treasure3','Treasure Hunt — tier 3','Minor Treasure',{loot:'treasure'}]];
const RT_TRACK=[['forage','Forage (safe)','1 ration',{loot:'forage'}],['hunt1','Hunt — tier 1','+1 check',{chk:1}],['hunt2','Hunt — tier 2','1d6 rations, EN +1',{en:1,loot:'hunt2'}],['hunt3','Hunt — tier 3','3d6 rations, 1d6 animal parts',{loot:'hunt3'}],
  ['track1','Track Creature — tier 1','+1 check',{chk:1}],['track2','Track Creature — tier 2','a sign, 1 hex off the path',{}],['track3','Track Creature — tier 3','you meet it',{}]];
const RT_ROUTE=[['road','Following a road all day','+1 hex',{h:1}],['river','Crossing a river without a bridge, or going upstream','−1 hex',{h:-1}],['down','Downstream on water','+1 hex',{h:1}],['dungeon','Passing a monster-infested hex','EN +1',{en:1}]];
const RT_ALL=[...RT_GUIDE,...RT_BACK,...RT_SCOUT,...RT_TRACK,...RT_ROUTE];
const DIRS=['north','northeast','southeast','south','southwest','northwest'];
function rtDay(){const R=S.rtravel,p=PACE[R.pace],on=RT_ALL.filter(([k])=>R.mods[k]).map(x=>x[3]),sum=k=>on.reduce((a,x)=>a+(x[k]||0),0);
  const slow=PARTY.length?Math.min(...PARTY.map(speed)):5,sp=slow<=3?-1:slow>=10?2:slow>=7?1:0;
  return {p,slow,sp,hexes:Math.max(0,p.hex+sum('h')+sp),en:Math.max(1,p.en+sum('en')),ren:Math.max(1,p.en+sum('ren')),chk:2+sum('chk'),rchk:1+sum('rchk'),
    lost:R.lost&&!on.some(x=>x.found==='start')||on.some(x=>x.lost),foundEnd:on.some(x=>x.found==='end'),ruin:on.some(x=>x.ruin),loot:on.map(x=>x.loot).filter(Boolean)}}
const TRAVEL_SUB={'Any Monster':'any-monster-encounter','Traveler':'traveler-encounters','Miasma-Touched':'miasma-touched-encounters','Wild Animal':'forest-animal-encounters'};
const encLine=(c,k,what)=>`<div class="${c.hit?'result bad':'result good'}" style="margin-top:.5rem">${what} ${k+1}: <span class="roll">${c.r}</span> ${c.hit?`encounter! Travel Encounters d100 <span class="roll">${c.roll}</span> → <b>${esc(c.text)}</b> ${c.sub?`<button class="btn sm" data-action="tgo" data-v="${c.sub}">Open ${esc(TB[c.sub].title)}</button>`:''}`:'— quiet.'}</div>`;
function encChecks(n,en){return Array.from({length:n},()=>{const r=d(10);const c={r,hit:r<=en};if(c.hit){const x=rollTable('travel-encounters');c.roll=x.r;c.text=x.row[1];c.sub=TRAVEL_SUB[c.text]}return c})}
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
    ${T.lost?`<div class="row"><button class="btn" data-action="rlostdir">Roll where each hex really goes</button>${R.dirs?`<span class="small">${R.dirs.map((x,k)=>`hex ${k+1}: <b>${x}</b>`).join(' · ')}</span>`:''}</div>`:''}
    <div class="row" style="margin-top:.5rem"><button class="btn primary" data-action="rcheck">Roll ${T.chk} encounter checks</button>${T.loot.length?`<button class="btn" data-action="rloot" ${R.looted?'disabled':''}>${R.looted?'Role finds are in the loot pool':'Roll role finds into the loot pool'}</button>`:''}</div>
    ${R.checks.map((c,k)=>encLine(c,k,'Check')).join('')}${R.lootLog?`<div class="result" style="margin-top:.5rem">${R.lootLog}</div>`:''}</li>
   <li><h3>Camp</h3>
    <div class="optgrid sm">${[['miasma','Outdoors','in the Miasma'],['ruin','Ruin','outside the Miasma (Scout for Shelter tier 3)'],['village','Village or shelter','no Miasma']].map(([k,l,sub])=>`<button class="opt" data-action="rcamp" data-v="${k}" aria-pressed="${R.camp===k}" ${k==='ruin'&&!T.ruin?'disabled':''}><b>${l}</b><span class="small muted">${sub}</span></button>`).join('')}</div>
    ${R.camp==='ruin'?`<div class="row" style="margin-top:.5rem"><button class="btn sm" data-action="rruin">Roll if the ruin is inhabited (10%)</button>${R.ruinRoll?`<span>d100 <span class="roll">${R.ruinRoll}</span> ${R.ruinRoll<=10?'<b>inhabited</b> — use an encounter table':'empty'}</span>`:''}</div>`:''}
    <div class="row" style="margin-top:.6rem"><button class="btn" data-action="rrest">Roll ${T.rchk} rest encounter check${T.rchk>1?'s':''} (EN ${T.ren})</button></div>${R.restChecks.map((c,k)=>encLine(c,k,'Rest check')).join('')}
    <p class="small muted" style="margin:.6rem 0 0">Then each player finishes the rest on their Rest tab${R.camp==='miasma'?' and makes the Mind RR — tier 1 effects can be rolled here in Session → Miasma':''}.${T.foundEnd?' At the end of today the guide works out where the group is.':''}</p></li>
  </ol>
  <button class="btn primary" data-action="rnextday">Start day ${R.day+1}</button>`;
};

/* ================= REF: Miasma (whole party) ================= */
SCREENS.rmiasma=()=>{
  const rows=MI_ROWS();
  return `<p class="muted" style="margin:0 0 1rem">After an outdoor rest each human rolls a Mind RR (2d10 + Mind − cruelty) at the table. Tier 2: nothing. Tier 3: they clear cruelty or help another human. Tier 1: roll the effect here, or the player rolls it on their sheet — either way it shows up in both places.</p>
  <table class="rt form"><tr><th>Crow</th><th>Last rest</th><th>Mind RR on the dice</th><th>Result</th></tr>${PARTY.length?'':'<tr><td colspan="4" class="muted">No crows yet.</td></tr>'}${PARTY.map((c,k)=>{const mod=c.ch.M-c.cruelty;return `<tr><td><b>${esc(c.name)}</b><div class="small muted">Mind ${fmt(c.ch.M)} · cruelty ${c.cruelty}</div></td>
   <td class="small">${c.lastRest==='miasma'?'in the Miasma':c.lastRest==='clear'?'outside the Miasma':'—'}</td>
   <td class="small">T1 ${diceFor(1,mod).replace('dice ','')} · T2 ${diceFor(2,mod).replace('dice ','')} · T3 ${diceFor(3,mod).replace('dice ','')}</td>
   <td>${miDone(c)?miResultHTML(c,'rmundo'):`<button class="btn sm" data-action="rmroll" data-k="${k}">Tier 1: +1 cruelty, roll d10</button>`}</td></tr>`}).join('')}</table>
  <div class="box" style="margin-top:1rem"><h2 class="sec-h">Miasma effects <span class="muted">d10 + cruelty — both effects apply</span></h2><table class="rt n1">${rows.map(r=>`<tr><td>${r.hi===99?r.lo+'+':r.lo+'–'+r.hi}</td><td>${esc(r.t)}<div class="small"><b>Also:</b> ${esc(r.up)}</div></td></tr>`).join('')}</table></div>`;
};

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
SCREENS.village=()=>{const sel=VILLAGES.find(v=>v.id===S.vsel)||VILLAGES[0],xp=S.xp||(S.xp={rows:[],players:Math.max(1,PARTY.length)});
  const tot=xp.rows.reduce((a,[n,val,g])=>a+Math.floor((+val||0)*(1+[0,.3,.2,.1][+g||0])),0);const NV=S.newv??={name:'',home:!VILLAGES.some(v=>v.home),preset:'start',extra:'alchemist'};
  const left=`<div class="stack"><div class="box"><h2 class="sec-h">Villages <span class="muted">players trade where the party is</span></h2>
    <ul class="mlist">${VILLAGES.map(v=>`<li><button data-action="vsel" data-v="${v.id}" aria-current="${sel?.id===v.id}">${esc(v.name)}${v.home?' · home':''}<span>${v.id===S.here?'party here · ':''}P ${fmt(v.prosperity)} · day ${v.day}</span></button></li>`).join('')||'<li class="muted small" style="padding:.5rem">No villages yet.</li>'}</ul></div>
   <div class="box"><h2 class="sec-h">New village</h2>
    <label class="fld"><b>Start from</b><select data-action="nvpreset">${[['start','A starting village (Character p. 50)'],['gadwick','Gadwick (Dungeons p. 2)'],['liston','Liston (Dungeons p. 2)'],['empty','Empty — set institutions by hand']].map(([k,l])=>`<option value="${k}" ${NV.preset===k?'selected':''}>${l}</option>`).join('')}</select></label>
    ${NV.preset==='start'?`<p class="small muted" style="margin:0 0 .4rem">Blacksmith, crypt, general store, inn and temple at 1st level, plus one more the group chooses:</p><label class="fld"><b>Extra institution</b><select data-action="nvextra">${Object.keys(INST).filter(k=>!HOME_START.includes(k)).map(k=>`<option value="${k}" ${NV.extra===k?'selected':''}>${INST[k].n}</option>`).join('')}</select></label>`:''}
    ${NV.preset==='start'||NV.preset==='empty'?`<label class="fld"><b>Name</b><input type="text" data-action="nvname" value="${esc(NV.name)}" placeholder="e.g. Thornwick"></label>`:''}
    <label class="check small"><input type="checkbox" data-action="nvhome" ${NV.home?'checked':''}> The crows’ home village</label>
    <div style="margin-top:.6rem"><button class="btn primary" data-action="nvadd">Create village</button></div></div></div>`;
  if(!sel)return `<div class="cols">${left}<div class="box"><p class="muted">Create the crows’ village to start: its institutions decide what players can buy, sell and do there.</p></div></div>`;
  const v=sel,k13=Object.keys(INST);
  const right=`<div class="stack"><div class="box"><div class="row" style="justify-content:space-between"><input type="text" data-action="vname" value="${esc(v.name)}" aria-label="Village name" style="font-weight:700;font-size:1.1rem;width:14rem">
     <div class="row">${v.id===S.here?'<span class="chip on">Party is here</span><button class="btn sm" data-action="vleave">Party leaves</button>':`<button class="btn sm primary" data-action="vhere-set" data-v="${v.id}">Party arrives here</button>`}<button class="btn sm ghost" data-action="vdel" data-v="${v.id}">Delete</button></div></div>
    <label class="check small"><input type="checkbox" data-action="vhome" ${v.home?'checked':''}> Home village (card prices; merchants pay by Prosperity). Elsewhere: +20% to buy, merchants pay 20%.</label>
    <div class="kpis" style="margin-top:.75rem"><div class="kpi"><span class="k">Prosperity</span><span class="v">${fmt(v.prosperity)}</span><span class="m"><span class="adj"><button data-action="vprosp" data-d="-1" aria-label="Lower">−</button><button data-action="vprosp" data-d="1" aria-label="Raise">+</button></span></span></div>
     <div class="kpi"><span class="k">Merchants pay</span><span class="v">${salePctAt(v)}%</span><span class="m"><span class="adj"><button data-action="vsale" data-d="-5" aria-label="−5% this cycle">−</button><button data-action="vsale" data-d="5" aria-label="+5% this cycle">+</button></span></span></div>
     <div class="kpi"><span class="k">Cycle ${v.cycle}</span><span class="v">${v.day}<small>/ 20</small></span><span class="m"><span class="adj"><button data-action="vday" data-d="-1" aria-label="Day back">−</button><button data-action="vday" data-d="1" aria-label="Next day">+</button></span></span></div>
     <div class="kpi ${v.raised?'':'warn'}"><span class="k">Raised this cycle</span><span class="v">${v.raised?'yes':'no'}</span><span class="m">${gc(v.spent||0)} spent on goods</span></div></div>
    <div class="row" style="margin-top:.6rem"><button class="btn" data-action="vcycle">End cycle: event, upgrades, Prosperity</button><span class="small muted">A cycle is 20 days. Without a raise, Prosperity drops by 1.</span></div>
    ${v.events[0]?`<div class="result" style="margin-top:.6rem"><b>Cycle ${v.events[0].cycle} event</b> (rolled ${v.events[0].roll}): ${esc(v.events[0].text)}</div>`:''}</div>
   <div class="box"><h2 class="sec-h">Institutions <span class="muted">level 0 = not founded; “this cycle” is for event effects</span></h2>
    <div class="tw"><table class="rt form"><tr><th>Institution</th><th>Level</th><th>Steward</th><th>This cycle</th><th>Gives</th></tr>${k13.map(k=>{const x=v.inst[k]||{lvl:0},pend=v.pending.find(p=>p.k===k),f=v.fund[k];
      return `<tr class="${x.lvl?'':'dim'}"><td><a class="term" href="#rule/${INST[k].rule}" data-term="vi-${k}">${INST[k].n}</a>${pend?`<br><span class="small" style="color:var(--ok)">→ ${ORD(pend.to)} next cycle</span>`:f?.paid?`<br><span class="small muted">${gc(f.paid)} paid</span>`:''}</td>
       <td class="nw"><span class="adj"><button data-action="vlvl" data-k="${k}" data-d="-1" aria-label="Lower">−</button> <b>${x.lvl||'—'}</b> <button data-action="vlvl" data-k="${k}" data-d="1" aria-label="Raise">+</button></span></td>
       <td><input type="text" data-action="vstew" data-k="${k}" value="${esc(x.steward||'')}" placeholder="Steward" aria-label="Steward of ${INST[k].n}" style="width:8rem" ${x.lvl?'':'disabled'}></td>
       <td class="nw">${x.lvl?`<span class="adj"><button data-action="vmod" data-k="${k}" data-d="-1" aria-label="Level down this cycle">−</button> ${x.mod?(x.mod>0?'+':'')+x.mod:'0'} <button data-action="vmod" data-k="${k}" data-d="1" aria-label="Level up this cycle">+</button></span> <label class="small"><input type="checkbox" data-action="vclosed" data-k="${k}" ${x.closed?'checked':''}> closed</label>`:''}</td>
       <td class="small">${lvlOf(v,k)&&INST[k].col?`${INST[k].col} <b>${INST[k].val[Math.min(lvlOf(v,k),INST[k].val.length)-1]}</b>`:''}</td></tr>`}).join('')}</table></div></div>
   <div class="box"><h2 class="sec-h">About ${esc(v.name)}</h2>${[['ruin','What old ruin contains the village?'],['ruler','Who runs the village?'],['food','Common staples to eat and drink'],['holiday','The most important holiday or festival']].map(([k,l])=>`<label class="fld"><b>${l}</b><input type="text" data-action="vq" data-k="${k}" value="${esc(v.q?.[k]||'')}" style="width:100%"></label>`).join('')}
    <label class="fld"><b>Notes</b><input type="text" data-action="vnote" value="${esc(v.note||'')}" style="width:100%"></label></div></div>`;
  const haul=PARTY.flatMap(c=>(c.haul||[]).map((h,k)=>({c,h,k}))),hv=h=>(h.val??IT[h.id].price??0)*h.n*(1+[0,.3,.2,.1][+h.g||0]);
  const htot=Math.floor(haul.filter(x=>!x.h.skip).reduce((a,x)=>a+hv(x.h),0)),all=htot+tot,home=vHere()?.home;
  const xpBox=`<div class="box" style="margin-top:1rem"><h2 class="sec-h"><a class="term" href="#rule/c-advancement" data-term="c-advancement" style="color:inherit">XP for treasure brought home</a> <span class="muted">${home?'the party is home':'XP counts when the party is back in its village'}</span></h2>
    <p class="small muted" style="margin:0 0 .5rem">Everything the crows took from your loot is listed — also what they sold in other villages or used up. Untick what doesn’t count: monster parts, pets, things taken from innocents or allies.</p>
    ${haul.length?`<div class="tw"><table class="rt form"><tr><th></th><th>Crow</th><th>Treasure</th><th>Value</th><th>Greed</th><th>XP value</th></tr>${haul.map(({c,h,k})=>`<tr class="${h.skip?'dim':''}"><td><input type="checkbox" data-action="xph" data-c="${PARTY.indexOf(c)}" data-k="${k}" ${h.skip?'':'checked'} aria-label="Counts for XP"></td><td>${esc(c.name)}</td><td>${esc(IT[h.id].name)}${h.n>1?' ×'+h.n:''}${h.note?`<div class="small muted">${esc(h.note)}</div>`:''}${isPart(IT[h.id])?'<div class="small" style="color:var(--sel)">monster part — no XP</div>':''}</td>
      <td class="nw">${h.id==='gold-coins'?`${h.n} gc`:(h.val??IT[h.id].price)!=null?gc(h.val??IT[h.id].price)+(h.n>1?' each':''):`<input type="number" data-action="xphv" data-c="${PARTY.indexOf(c)}" data-k="${k}" min="0" placeholder="gc" aria-label="Value the Ref gives">`}</td>
      <td><select data-action="xphg" data-c="${PARTY.indexOf(c)}" data-k="${k}" aria-label="Greed">${['—','DT 1 +30%','DT 2 +20%','DT 3 +10%'].map((l,j)=>`<option value="${j}" ${(+h.g||0)===j?'selected':''}>${l}</option>`).join('')}</select></td><td class="nw">${h.skip?'—':Math.floor(hv(h))+' gc'}</td></tr>`).join('')}</table></div>`:'<p class="muted small">Nothing taken from the loot pool yet.</p>'}
    <h3 class="sec-h sm">Anything else <span class="muted">treasure that never went through the loot pool</span></h3>
    ${xp.rows.length?`<table class="rt form"><tr><th>Treasure</th><th>Value gc</th><th>Greed</th><th></th></tr>${xp.rows.map(([n,val,g],k)=>`<tr><td><input type="text" data-action="xpn" data-k="${k}" value="${esc(n)}" placeholder="e.g. bloodstone" style="width:100%" aria-label="Treasure name"></td><td><input type="number" data-action="xpv" data-k="${k}" value="${val||''}" aria-label="Value"></td><td><select data-action="xpg" data-k="${k}" aria-label="Greed">${['—','+30%','+20%','+10%'].map((l,j)=>`<option value="${j}" ${+g===j?'selected':''}>${l}</option>`).join('')}</select></td><td><button class="xbtn" data-action="xpdel" data-k="${k}" aria-label="Remove row">✕</button></td></tr>`).join('')}</table>`:''}
    <div class="row"><button class="btn sm" data-action="xpadd">+ Add a row</button><label>Players <input type="number" data-action="xpp" value="${xp.players}" min="1"></label></div>
    <div class="result good" style="margin-top:.6rem">Total value <b>${all} gc</b> → each PC gains <b>${Math.floor(all/xp.players)} XP</b></div>
    <button class="btn primary" data-action="xpgive" ${all?'':'disabled'}>Give ${Math.floor(all/xp.players)} XP to each crow</button> <span class="small muted">It counts after their next rest.</span></div>`;
  return `<div class="cols ld">${left}${right}</div>${xpBox}`};

/* ================= Ref-made cards, treasure rolls, loot presets ================= */
const slugify=x=>x.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const CUSTOM=JSON.parse(store.get('customItems')||'[]');
const addItemDef=it=>{if(!IT[it.id]){D.items.push(it);IT[it.id]=it}return it.id};
addItemDef({id:'gold-coins',name:'Gold coins',cat:'treasure',stack:250,slots:1,price:1,text:'Loose coins. A slot holds 250 coins; a coin purse holds 500 gc in one slot.'});
CUSTOM.forEach(addItemDef);
function customItem(name,o={}){const id='x-'+slugify(name);if(!IT[id]){const it={id,name,cat:o.cat||'gear',stack:1,slots:o.slots||1,price:null,text:o.text||'A card the Ref made for this game.'};addItemDef(it);CUSTOM.push(it);store.set('customItems',JSON.stringify(CUSTOM))}return id}
const nkey=x=>x.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]/g,'');
const rollDice=x=>x.replace(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?(?:\s*×\s*(\d+))?/g,(m,n,f,op,k,mul)=>{let r=0;for(let i=0;i<+n;i++)r+=d(+f);if(op)r+=op==='+'?+k:-k;return String(mul?r*+mul:r)});
// "Fine torch" → Torch (note Fine), "Undead bone light armor" → Light Armor (note Undead bone), "13 arrows" → quiver.
function matchItem(t){const NI={};for(const i of D.items)NI[nkey(i.name)]=i.id;const f=x=>NI[nkey(x)]||NI[nkey(x.replace(/ (set|vial)$/i,''))]||NI[nkey(x.replace(/s$/,''))]||NI[nkey(x.replace(/ and | set$/g,' '))];let m;
  if((m=t.match(/(\d+) (crossbow bolts|arrows)/i)))return {id:/bolt/i.test(m[2])?'case-of-20-crossbow-bolts':'quiver-of-20-arrows',note:`${m[1]} ${m[2]}`};
  const w=t.replace(/^(an?|the|empty) /i,'').replace(/\s*\(.*\)$/,'').replace(/^[\d,]+ (feet of )?/,'').split(' ');
  for(let k=0;k<w.length;k++){const id=f(w.slice(k).join(' '));if(id)return {id,note:w.slice(0,k).join(' ')}}}
const pushPool=(id,count,note,val)=>S.pool.push({uid:UID++,id,count,from:'Ref',note,val,unid:isMagic(IT[id])});
// One treasure-table result → loot-pool entries; gems and art objects get their own detail rolls.
function treasureToPool(table,row){
  const src=TB[table].title;
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
  'tip-lore':['Lore book Effort','Extra Effort from the lore book you studied. You can only spend it on tests where its expertise applies. Tap to spend 1. It ends when you finish your next rest.','r-rest-activities'],
  'tip-effort-bonus':['Bonus Effort','+1 Effort from Good Night’s Rest, on top of your maximum. It lasts until you spend it or finish your next rest, and works even in the Miasma. Spending uses it first.','r-good-nights-rest'],
  'tip-minor-treasures':['Minor Treasures (d100)','Everyday finds: gear, tools, crafting materials, corpses to harvest, art objects and gems worth 25–500 gc, rank 0–1 spellbooks. Roll it when the party helps travelers, finds a Treasure Hunt result, or you need a small reward. 100 = roll Major instead.','ref-treasure-tables'],
  'tip-major-treasures':['Major Treasures (d100)','Valuable finds: magic items and wands, fine and masterwork gear, special-material weapons and armor, gems and art objects up to thousands of gc, rank 2–5 spellbooks. 01 = roll Minor instead.','ref-treasure-tables'],
  'tip-what-s-the-gem':['What’s the gem? (d100)','Names the gem: agate … zircon. It does not set the value — you do, or the treasure table already did (“Gem worth 100 gc”). A gem card takes 1 slot and stacks 5. Rolled automatically when a treasure roll gives a gem.','ref-treasure-tables'],
  'tip-what-s-the-art-object':['What’s the art object? (d10)','Says what it is and its size, which sets its slots: Tiny 1 slot (stacks 5), Small 1, Medium 2, Large 16, Huge 54. You set the value. Rolled automatically when a treasure roll gives an art object.','c-treasure']};
const LOOT=JSON.parse(store.get('loot')||'[]');
const saveLoot=()=>store.set('loot',JSON.stringify(LOOT));
const curLoot=()=>LOOT.find(x=>x.id===S.lib.pick);
const lootSummary=p=>p.items.map(x=>x.id==='gold-coins'?`${x.n} gc`:(x.n>1?x.n+'× ':'')+IT[x.id].name).join(', ')||'empty';
function lootAdd(id,n){const p=curLoot(),ex=p.items.find(x=>x.id===id);if(ex)ex.n+=n;else p.items.push({id,n});saveLoot()}
// Hints: glossary terms, rule-book sections, expertise lines, button tips → [title, short html, full rule key]
function expInfo(name){for(const p of BOOK['r-effort-expertise'].body)for(const r of p.tb||[]){const n=r[0].replace(/^Expertise /,'');if(n===name)return r[1].replace(/^Use /,'')}}
const expChip=e=>`<span class="chip hint" data-term="x-${esc(e)}" tabindex="0">${esc(e)}</span>`;
function termInfo(k){
  if(GLOSS[k])return GLOSS[k];if(TIPS[k])return TIPS[k];
  if(k.startsWith('npc-')){const t=NPCT.find(x=>x[0]===k.slice(4));if(t)return [t[0],esc(t[1]),'c-npc-connection']}
  if(k.startsWith('x-')){const n=k.slice(2),u=expInfo(n),kind=['Bashing','Bow','Chopping','Slashing','Stabbing','Unarmed'].includes(n)?'Weapon':['Alteration','Benefaction','Conjuration','Elemental','Illusion','Necromancy'].includes(n)?'Spellcasting':'General';
    return [n,`${kind} expertise${u?': '+esc(u):''}. After a non-doom test it applies to, spend 1 [[effort|Effort]] to raise the result one tier.`,'r-effort-expertise']}
  if(BOOK[k])return [BOOK[k].t,esc(secText(BOOK[k]).replace(/\*\*/g,'').slice(0,260))+'…']}
LIBS_EXTRA={presets:()=>{const p=curLoot();
  return listDetail('Loot presets',[['',LOOT.filter(x=>lmatch(x.name)).map(x=>[x.id,x.name||'Untitled',`${x.items.length} item${x.items.length===1?'':'s'}`])]],
   p?`<label class="fld"><b>Name</b><input type="text" data-loot="name" value="${esc(p.name)}" placeholder="e.g. Room 4 chest"></label>
     <label class="fld"><b>Note for players</b><input type="text" data-loot="note" value="${esc(p.note)}" placeholder="e.g. under the altar"></label>
     <table class="rt form"><tr><th>Item</th><th>How many</th><th></th></tr>${p.items.map((x,k)=>`<tr><td><a href="#item/${x.id}" data-action="open-item" data-id="${x.id}">${esc(IT[x.id].name)}</a></td><td><input type="number" min="1" data-loot-n="${k}" value="${x.n}" aria-label="How many">${isMagic(IT[x.id])?`<label class="check small"><input type="checkbox" data-loot-u="${k}" ${x.u??true?'checked':''}> unidentified</label>`:''}</td><td><button class="xbtn" data-action="loot-rm" data-k="${k}" aria-label="Remove">✕</button></td></tr>`).join('')||'<tr><td colspan="3" class="muted small">Empty — add cards, gold or your own items below.</td></tr>'}</table>
     <h3 class="sec-h sm">Add a card</h3>${pickerHTML('preset','lootpickadd',null)}
     <h3 class="sec-h sm">Add gold</h3><div class="row"><input type="number" id="lgold" min="1" placeholder="gc" aria-label="Gold coins"><button class="btn sm" data-action="loot-gold">Add gold</button></div>
     <h3 class="sec-h sm">Add your own item <span class="muted">a key, a map, a letter…</span></h3><div class="row"><input type="text" id="lcname" placeholder="e.g. Rusty iron key" aria-label="Item name"><label class="small">Slots <input type="number" id="lcslots" min="1" value="1" style="width:4rem"></label></div><input type="text" id="lctext" placeholder="What it does (optional)" aria-label="Item text" style="width:100%;margin-top:.4rem"><button class="btn sm" data-action="loot-custom" style="margin-top:.4rem">Add item</button>
     <div class="row" style="margin-top:1.25rem"><button class="btn primary" data-action="loot-drop" data-v="${p.id}">Drop into loot pool now</button><button class="btn ghost" data-action="loot-del">Delete preset</button></div>`
   :`<p>Prepare a chest, a corpse’s pockets or a hoard before the session — cards, gold and your own items. During play, drop the whole preset into the loot pool with one click from Session → Loot.</p><button class="btn primary" data-action="loot-new">+ New loot preset</button>`)}};



/* ---------- card picker: every card visible, category chips, filter as you type ---------- */
const PICK={};
function pickerHTML(key,act,sel){const P=PICK[key]||(PICK[key]={cat:'',q:''}),q=P.q.toLowerCase(),kw=key==='loot'&&S.lookup.kw;
  const cats=Object.entries(CATL).filter(([k])=>D.items.some(i=>i.cat===k));
  const list=D.items.filter(i=>!P.cat||i.cat===P.cat).sort((a,b)=>a.name.localeCompare(b.name));
  const hay=i=>(kw?[i.name,i.text,i.q,i.craft?.mats]:[i.name]).join(' ').toLowerCase();
  return `<div class="picker"><input type="search" class="pq" data-key="${key}" value="${esc(P.q)}" placeholder="Filter by name…" aria-label="Filter cards">
   <div class="chips" style="margin:.5rem 0">${[['','All'],...cats].map(([k,l])=>`<button class="chip ${P.cat===k?'on':''}" data-action="pcat" data-key="${key}" data-v="${k}">${l}</button>`).join('')}</div>
   <ul class="mlist plist">${list.map(i=>`<li data-q="${esc(hay(i))}" ${q&&!hay(i).includes(q)?'hidden':''}><button data-action="${act}" data-v="${i.id}" aria-current="${sel===i.id}">${esc(i.name)}<span>${CATL[i.cat]} · ${i.slots||1} slot${(i.slots||1)>1?'s':''} · ${gc(i.price)}</span></button></li>`).join('')}</ul></div>`}
document.addEventListener('input',e=>{const t=e.target;if(!t.classList.contains('pq'))return;PICK[t.dataset.key].q=t.value;const q=t.value.toLowerCase();$$('li[data-q]',t.closest('.picker')).forEach(li=>li.hidden=!!q&&!li.dataset.q.includes(q))});

/* ================= sections (Forge Steel: Home · Crows · Library · Session) ================= */
const VIEWS={
  home:()=>({title:'CROW NEST',body:homeHTML}),
  crows:()=>({title:'Crows',acts:`<button class="tbtn primary" data-action="new-crow">+ Create a crow</button>`,body:crowsHTML}),
  crow:()=>({title:ME.name,acts:`<button class="tbtn" data-action="tab" data-v="rest">Rest…</button><button class="tbtn" data-action="crow-del">Delete</button><button class="tbtn" data-action="go" data-v="crows">✕ Close</button>`}),
  build:()=>({title:'Crow builder',acts:`<button class="tbtn primary" data-action="bsave">Save crow</button><button class="tbtn" data-action="bcancel">✕ Cancel</button>`,body:buildHTML}),
  library:()=>({title:'Library',body:libHTML}),
  session:()=>({title:'Session'}),
};
const HOME={players:['Players','Make your crow, then play from their sheet in <b>Crows</b> (bottom bar).',`<ul><li>Create a crow step by step: roll your background at the table and tap the result — Stamina, expertises, starting trait and gear fill in for you.</li><li>At the table the sheet tracks damage (AD, Stamina, wounds), light, usage dice and your cards in hands, belt and backpack.</li><li>The sheet’s tabs hold your inventory, what you can do in a fight (from what you hold), trait trees, pets and hirelings, travel roles, rests, the Miasma steps, and the Village tab for trading, services and investing where the party is.</li><li>Every underlined word shows its rule on hover or tap. <b>Rules</b> in the bottom bar opens the full index.</li></ul>`,[['go','crows','Go to your Crows'],['new-crow','','Create a new crow']]],
  prep:['The Ref: prep time','In the <b>Library</b> you can look up everything before the game:',`<ul><li>All ${D.items.length} item cards with crafting, upgrades and what they are used to craft.</li><li>The ${D.backgrounds.length} backgrounds and ${D.traits.length} traits.</li><li>${D.monsters.length} monster stat blocks and ${D.tables.length} roll tables — roll any table right there.</li></ul>`,[['go','library','Go to the Library']]],
  game:['The Ref: game time','In the <b>Session</b> you run the delve:',`<ul><li>The dungeon-turn clock, greed bonus and the end-of-DT steps (UD, conditions, encounter check).</li><li>A combat tracker fed by encounter results and the bestiary.</li><li>The loot pool the players take items from, the travel day and the party’s Miasma rolls.</li><li>Villages: create the crows’ village and the ones they find, track institutions, Prosperity and cycles, and give XP for the treasure they bring home.</li><li>Open any crow from the party list to see their sheet.</li></ul>`,[['go','session','Go to the Session']]]};
function homeHTML(){const [h,lead,list,btns]=HOME[S.home];
  return `<div style="max-width:44rem;margin:0 auto"><p style="text-align:center">CROW NEST is a companion for <b>CROWS</b> players and Refs (Playtest 3).</p>
   <div class="seg" role="group" style="background:var(--panel2);display:flex;margin:1rem 0">${[['players','Players'],['prep','Ref · prep time'],['game','Ref · game time']].map(([k,l])=>`<button style="flex:1" data-action="home" data-v="${k}" aria-pressed="${S.home===k}">${l}</button>`).join('')}</div>
   <div class="box"><h2 class="sec-h">${h}</h2><p>${lead}</p>${list}<div class="row" style="margin-top:1rem">${btns.map(([a,v,l],k)=>`<button class="btn ${k?'':'primary'}" data-action="${a}" data-v="${v}">${l}</button>`).join('')}</div></div></div>`}
function crowsHTML(){
  if(!PARTY.length)return `<p class="muted" style="text-align:center;margin:3rem 0">No crows yet. <button class="btn primary" data-action="new-crow">Create a crow</button></p>`;
  return `<div class="hcards">${PARTY.map((c,i)=>`<button class="opt hcard" data-action="open-crow" data-i="${i}"><h3>${esc(c.name)}</h3>
    <div><b>Background</b> ${esc(c.bg)}</div><div><b>Level</b> ${level(c).lv} · ${c.txp} TXP</div>
    <div class="small">Stamina <b>${c.stamina}/${stMax(c)}</b> · Wounds <b>${c.wounds.size}</b> · A ${fmt(c.ch.A)} M ${fmt(c.ch.M)} S ${fmt(c.ch.S)}</div></button>`).join('')}</div>`}

/* ---------- crow builder ---------- */
var LIBS_EXTRA;// NPC connection benefits, straight from the Character booklet (a bullet may continue in the next paragraph).
const NPCT=(()=>{const b=D.book.find(x=>x.id==='c-npc-connection').body,out=[];b.forEach((p,k)=>{const m=(p.li||'').match(/^\*\*([^*]+?):\*\*\s*(.*)/);if(m){let t=m[2];if(b[k+1]?.x&&/^[a-z]/.test(b[k+1].x))t+=' '+b[k+1].x;out.push([m[1],t])}});return out})();
const BG={};D.backgrounds.forEach(b=>BG[b.id]=b);
const TRAIT={};D.traits.forEach(t=>TRAIT[t.tree+'|'+t.n.toLowerCase()]=t);
const traitOf=b=>TRAIT[b.trait[0]+'|'+b.trait[1].toLowerCase()];
const CHN={A:'Agility',M:'Mind',S:'Strength'};
const KIT=[{id:'coin-purse',n:1},{id:'knife',n:1},{id:'rope',n:1},{id:'ration',n:6}];
const chText=b=>b.ch==='Any'?'any characteristic':b.ch.map(k=>CHN[k]).join(' or ');
const bgGold=b=>b.extra.reduce((a,x)=>a+(+(x.match(/(\d+).*gold/)||[0,0])[1]),0);
function newBuild(bg){S.b={step:bg?'characteristics':'start',bg:null,two:null,arr:null,roll:null,gold:null,name:'',feature:'',coins:'',npc:'',village:''};if(bg)selectBg(bg);S.area='build';closePanel();render();scrollTo(0,0)}
function selectBg(id){const b=BG[id];Object.assign(S.b,{bg:id,two:b.ch!=='Any'&&b.ch.length===1?b.ch[0]:null,arr:null})}
// Background sets one characteristic to 2; the other two are 1 and 0, or −1 and 2, either way round.
function chOptions(B){if(!B.two)return [];const [x,y]=['A','M','S'].filter(k=>k!==B.two);return [[1,0],[0,1],[-1,2],[2,-1]].map(([p,q])=>({[B.two]:2,[x]:p,[y]:q}))}
const BSTEPS=[['start','Start'],['background','Background'],['characteristics','Characteristics'],['equipment','Equipment'],['details','Name & village']];
function bState(k){const B=S.b,bg=BG[B.bg];
  if(k==='start')return ['','How it works'];
  if(k==='background')return !bg?['no','Not selected']:B.two?['ok',bg.n]:['wip','Choose your 2'];
  if(k==='characteristics')return B.arr!=null?['ok',['A','M','S'].map(c=>c+' '+fmt(chOptions(B)[B.arr][c])).join(' ')]:['no','Not selected'];
  if(k==='equipment')return !bg?['no','Needs a background']:B.coins!==''?['ok',`${(+B.coins||0)+bgGold(bg)} gc`]:['wip','Enter your 3d6 gold'];
  return B.name.trim()?['ok',B.name.trim()]:['no','Needs a name']}
const bTabsHTML=()=>`<nav class="bsteps" id="btabs" aria-label="Builder steps">${BSTEPS.map(([k,l])=>{const [c,sub]=bState(k);return `<button class="${c}" data-action="bstep" data-v="${k}" aria-current="${S.b.step===k?'step':'false'}">${l}<small>${c==='ok'?'✓ ':''}${esc(sub)}</small></button>`}).join('')}</nav>`;
function bgFacts(b){return `<div class="small"><b>2 in</b> ${chText(b)} · <b>Stamina</b> ${b.st}</div><div class="small"><b>Trait</b> ${esc(b.trait[1])} <span class="muted">(${esc(b.trait[0])})</span></div>
  <div class="chips">${[...b.exp.gen,...b.exp.wpn,...b.exp.mag].map(expChip).join('')}</div>
  <div class="small muted">${esc([...b.items.map(x=>IT[x.id].name+(x.n>1?' ×'+x.n:'')),...b.extra].join(', '))}</div>`}
function bgDetail(b){const tr=traitOf(b),ex=[['General',b.exp.gen],['Weapon',b.exp.wpn],['Spellcasting',b.exp.mag]].filter(x=>x[1].length);
  return `<div class="row" style="justify-content:space-between"><h2 class="opt-h">${esc(b.n)}</h2><span class="chip">2d6 · ${b.d.join(' · ')}</span></div><p>${esc(b.desc)}</p>
  <table class="rt"><tr><td>Characteristic at 2</td><td>${chText(b)}</td></tr><tr><td><a class="term" href="#rule/stamina" data-term="stamina">Stamina</a></td><td>${b.st} <span class="small muted">+2 per level</span></td></tr>
   <tr><td><a class="term" href="#rule/speed" data-term="speed">Speed</a></td><td>5 squares <span class="small muted">every crow</span></td></tr>
   <tr><td><a class="term" href="#rule/effort" data-term="effort">Effort</a></td><td>2 <span class="small muted">every crow · spend 1 to raise a test result one tier</span></td></tr>
   ${ex.map(([l,a])=>`<tr><td>${l} <a class="term" href="#rule/expertise" data-term="expertise">expertise</a></td><td><div class="chips">${a.map(expChip).join('')}</div></td></tr>`).join('')}</table>
  ${tr?`<h3 class="sec-h sm"><a class="term" href="#rule/traits" data-term="traits" style="color:inherit">Starting trait</a></h3><p class="trait"><b>${esc(tr.n)}</b> <span class="muted small">(${esc(tr.tree)})</span> ${linkify(tr.t)}</p>`:''}
  <h3 class="sec-h sm">Equipment</h3><ul class="list-links">${b.items.map(x=>`<li><a href="#item/${x.id}" data-action="open-item" data-id="${x.id}">${esc(IT[x.id].name)}${x.note?` (${esc(x.note)})`:''}<span>${x.n>1?'×'+x.n+' · ':''}${IT[x.id].slots||1} slot${(IT[x.id].slots||1)>1?'s':''}</span></a></li>`).join('')}${b.extra.map(x=>`<li style="padding:.45rem .25rem;font-weight:700">${esc(x)}</li>`).join('')}</ul>
  <p class="small muted">Plus what every crow gets: coin purse, knife, rope, 6 rations and 3d6 gc.</p>`}
const choose=(on,lbl,act,v)=>`<button class="btn ${on?'primary':''}" data-action="${act}" data-v="${v}" aria-pressed="${on}">${lbl}</button>`;
const BODY={
  start:()=>`<div class="grid2"><div class="box"><h2 class="sec-h">Creating a crow</h2><ol class="small" style="padding-left:1.2rem;font-size:1rem">
     <li><b>Background</b> — roll 2d6 at the table and tap your result. It sets your Stamina, expertises, starting trait and gear.</li>
     <li><b>Characteristics</b> — your background makes one characteristic a 2; pick how the other two go.</li>
     <li><b>Equipment</b> — your gear lands on your card board; enter the 3d6 gold you rolled.</li>
     <li><b>Name & village</b> — a name, one thing that makes your crow stand out, and an NPC back home.</li></ol>
     <p class="muted small">Jump between steps any time with the tabs above. <b>Save crow</b> puts your crow on the Crows screen.</p></div>
   <div class="box"><h2 class="sec-h">Replacing a dead crow</h2><p>Roll on the Backgrounds table one extra time for each level the dead crow had, then pick any background you rolled.</p><p class="small muted">On the Background step just tap the one you want — the cards show their 2d6 result.</p></div></div>
   <button class="btn primary" style="margin-top:1rem" data-action="bstep" data-v="background">Start: background →</button>`,
  background:()=>{const B=S.b,bg=BG[B.bg];
    if(!bg)return `<div class="box row" style="margin-bottom:1rem;justify-content:space-between"><span>Roll <b>2d6</b> at the table and tap the background with that number, or let the app roll.</span>
       <span class="row">${B.roll?`<span class="roll">${B.roll.join(' · ')}</span><button class="btn sm ghost" data-action="broll" data-v="clear">Clear</button>`:''}<button class="btn primary" data-action="broll">${B.roll?'Roll again':'Roll 2d6'}</button></span></div>
      <div class="optgrid">${D.backgrounds.map(b=>`<button class="opt ${B.roll&&b.d.join()===B.roll.join()?'rolled':''}" data-action="bbg" data-v="${b.id}" id="bg-${b.id}"><div class="row" style="justify-content:space-between"><h3>${esc(b.n)}</h3><span class="chip ${B.roll&&b.d.join()===B.roll.join()?'on':''}">${B.roll&&b.d.join()===B.roll.join()?'rolled ':''}${b.d.join('·')}</span></div><p class="small" style="margin:0">${esc(b.desc)}</p>${bgFacts(b)}</button>`).join('')}</div>`;
    const opts=bg.ch==='Any'?['A','M','S']:bg.ch;
    return `<div class="cols"><div class="box">${bgDetail(bg)}<button class="btn" data-action="bbg" data-v="">Change background</button></div>
     <div class="stack"><h2 class="sec-h">Choices</h2><div class="box ${B.two?'':'choose'}"><h3 class="sec-h sm">Characteristic at 2</h3>
       ${opts.length>1?`<p class="small">Your background lets you choose.</p><div class="row">${opts.map(k=>choose(B.two===k,CHN[k],'btwo',k)).join('')}</div>`:`<p>${CHN[opts[0]]} is 2 — set by your background.</p>`}</div>
      ${B.two?`<button class="btn primary" data-action="bstep" data-v="characteristics">Next: characteristics →</button>`:''}</div></div>`},
  characteristics:()=>{const B=S.b;
    if(!B.two)return `<p class="muted">Pick a background and its characteristic at 2 first. <button class="btn" data-action="bstep" data-v="background">Go to Background</button></p>`;
    return `<p>Your background makes <b>${CHN[B.two]}</b> a 2. The other two are <b>1 and 0</b>, or <b>−1 and 2</b> — pick one. <span class="muted small"><a class="term" href="#rule/tiers" data-term="tiers">Tests</a> roll 2d10 + the characteristic.</span></p>
     <div class="optgrid">${chOptions(B).map((o,k)=>`<button class="opt" data-action="barr" data-v="${k}" aria-pressed="${B.arr===k}"><div class="tiles" style="grid-template-columns:repeat(3,1fr)">${['A','M','S'].map(c=>`<div class="tile"><div class="k">${CHN[c]}</div><div class="v">${fmt(o[c])}</div></div>`).join('')}</div><div class="small muted">${k<2?'1 and 0':'−1 and 2'}</div></button>`).join('')}</div>
     ${B.arr!=null?`<button class="btn primary" style="margin-top:1rem" data-action="bstep" data-v="equipment">Next: equipment →</button>`:''}`},
  equipment:()=>{const B=S.b,bg=BG[B.bg];
    if(!bg)return `<p class="muted">Your equipment comes from your background. <button class="btn" data-action="bstep" data-v="background">Go to Background</button></p>`;
    const cards=l=>`<div class="cardgrid">${l.map(x=>cardHTML(IT[x.id],null,{n:x.n})).join('')}</div>`,g=bgGold(bg);
    return `<p>When you save, these cards go onto your board — weapons and lights in your hands, alchemy on your belt, the rest in your backpack, armor worn. Rearrange them on the sheet.</p>
     <div class="box ${B.coins===''?'choose':''}" style="margin-bottom:1rem"><p style="margin:0 0 .5rem"><b>Starting gold: 3d6 gc</b> <span class="small muted">— every crow starts with an empty coin purse, a knife, a rope, six rations and 3d6 gc (<a href="#rule/c-3-equipment-cards" data-action="open-rule" data-k="c-3-equipment-cards">Character booklet, p. 1</a>)${g?` · your background adds ${g} gc`:''}</span></p>
      <div class="row"><button class="btn primary" data-action="bgold">${B.coins===''?'Roll 3d6':'Roll again'}</button>${B.coins!==''?`<b style="font-size:1.4rem">${+B.coins+g} gc</b>`:''}</div></div>
     <h2 class="sec-h">From your background</h2>${cards(bg.items)}${bg.extra.filter(x=>!/gold/.test(x)).length?`<p class="small"><b>Also:</b> ${esc(bg.extra.filter(x=>!/gold/.test(x)).join(', '))}</p>`:''}
     <h2 class="sec-h" style="margin-top:1.25rem">Every crow</h2>${cards(KIT)}
     <button class="btn primary" style="margin-top:1rem" data-action="bstep" data-v="details">Next: name & village →</button>`},
  details:()=>{const B=S.b,f=(k,l,ph,hint='')=>`<label class="fld"><b>${l}</b>${hint?` <span class="muted small">${hint}</span>`:''}<input type="text" data-b="${k}" value="${esc(B[k]||'')}" placeholder="${ph}"></label>`;
    return `<div class="box" style="max-width:44rem">${f('name','Name','e.g. Bram Hollow')}${f('feature','Distinguishing feature','a tattoo, a smell, a voice, a strong personality trait…','one thing that stands out')}</div>
     <h2 class="sec-h" style="margin-top:1.25rem">NPC connection <span class="muted">someone in your village who matters to you — and what they do for you</span></h2>
     <div class="box" style="max-width:44rem;margin-bottom:1rem">${f('npc','Their name','e.g. Old Marta')}${f('npcRel','How you know them','e.g. the herbalist who raised me')}</div>
     <div class="optgrid">${NPCT.map(([n,t])=>`<button class="opt" data-action="bnpc" data-v="${esc(n)}" aria-pressed="${B.npcType===n}"><h3>${esc(n)}</h3><p class="small" style="margin:0">${esc(t)}</p></button>`).join('')}</div>
     <div class="box" style="max-width:44rem;margin-top:1rem">${f('village','Village name','e.g. Thornwick','only if your group is making its first crows — name it together')}
     <button class="btn primary" data-action="bsave">Save crow</button></div>`}};
function buildHTML(){return bTabsHTML()+BODY[S.b.step]()}
function autoPlace(c,id,n){const it=IT[id];
  const order=it.cat==='weapon'||it.light?['hand','belt','pack']:it.cat==='alchemy'||it.cat==='ammo'?['belt','pack']:['pack','belt'];
  while(n>0){let pos=null;for(const sec of order){for(let k=0;k<LEN[sec]&&!pos;k++)if(!canPlace(c,id,sec,k))pos={sec,idx:k};if(pos)break}
    if(!pos){toast(`No room for ${it.name}`);return}const q=pos.sec==='hand'?1:Math.min(n,it.stack||1);c.inv.push(inst(id,pos.sec,pos.idx,{count:q}));n-=q}}
function saveBuild(){const B=S.b,bg=BG[B.bg];
  const miss=!B.two?'background':B.arr==null?'characteristics':!B.name.trim()?'details':null;
  if(miss){B.step=miss;render();return toast('This step still needs something')}
  const tr=traitOf(bg),pets=bg.extra.map(x=>(x.match(/^(.+) \(pet\)$/)||[])[1]).filter(Boolean).map(n=>{const w=n.toLowerCase().split(' ');return [w.join('-'),[...w].reverse().join('-')].find(id=>MON[id])}).filter(Boolean);
  const c=mkChar({name:B.name.trim(),bg:bg.n,feature:B.feature.trim(),stBase:bg.st,ch:chOptions(B)[B.arr],exp:JSON.parse(JSON.stringify(bg.exp)),traits:tr?[{n:tr.n,tree:tr.tree,t:tr.t}]:[],npc:B.npc.trim(),npcRel:(B.npcRel||'').trim(),npcType:B.npcType||'',village:B.village.trim(),extra:bg.extra.filter(x=>!/gold/.test(x))});
  for(const x of [...bg.items,...KIT])autoPlace(c,x.id,x.n);c.pets=pets.map(id=>mkPet(id));c.extra=c.extra.filter(x=>!/\(pet\)$/.test(x)||!pets.length);
  const p=purse(c);if(p)p.coins=Math.min(purseMax(p),(+B.coins||0)+bgGold(bg));
  const ar=c.inv.find(i=>IT[i.id].cat==='armor'&&!isShield(IT[i.id])&&i.sec==='pack');if(ar){ar.worn=true;ar.ad=IT[ar.id].ad}
  c.stamina=stMax(c);c.effort=effMax(c);
  PARTY.push(c);ME=c;store.set('crow',PARTY.length-1);S.b=null;S.area='crow';S.tab.crow='sheet';toast(`${c.name} joins the party`);render();scrollTo(0,0)}

/* ---------- library: categories → list → detail ---------- */
const LIB=[['For players',[['items','Items',D.items.length],['backgrounds','Backgrounds',D.backgrounds.length],['traits','Traits',D.traits.length]]],['For the Ref',[['monsters','Monsters',D.monsters.length],['tables','Roll tables',D.tables.length],['presets','Loot presets',null]]]];
function libHTML(){return `<div class="lib"><nav class="libnav" aria-label="Library">${LIB.map(([g,cats])=>`<h3>${g}</h3>${cats.map(([k,l,n])=>`<button data-action="libcat" data-v="${k}" aria-current="${S.lib.cat===k}">${l}<span>${n??LOOT.length}</span></button>`).join('')}`).join('')}</nav><div>${(LIBS[S.lib.cat]||LIBS_EXTRA[S.lib.cat]||SCREENS[S.lib.cat])()}</div></div>`}
function listDetail(title,groups,detail){const q=S.lib.q;
  return `<div class="cols ld"><div class="box"><h2 class="sec-h">${title}</h2>
   <input type="search" data-action="lq" value="${esc(q)}" placeholder="Filter…" aria-label="Filter ${title}" style="width:100%">
   <div class="lscroll">${groups.filter(g=>g[1].length).map(([h,l])=>`${h?`<h3 class="small muted lgh">${esc(h)}</h3>`:''}<ul class="mlist">${l.map(([id,n,sub])=>`<li><button data-action="lpick" data-v="${id}" aria-current="${S.lib.pick===id}">${esc(n)}<span>${esc(sub)}</span></button></li>`).join('')}</ul>`).join('')||'<p class="muted small">Nothing matches.</p>'}</div></div>
   <div class="box">${detail||'<p class="muted">Pick one from the list.</p>'}</div></div>`}
const lmatch=s=>!S.lib.q||s.toLowerCase().includes(S.lib.q.toLowerCase());
const LIBS={
  items:()=>{const it=IT[S.lib.pick];return listDetail('Items',Object.entries(CATL).map(([k,l])=>[l,D.items.filter(x=>x.cat===k&&lmatch(x.name)).map(x=>[x.id,x.name,x.price!=null?gc(x.price):''])]),it&&`<h1 style="margin-bottom:.5rem">${esc(it.name)}</h1>${panelBody({t:'item',id:it.id})}`)},
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
const entryTitle=e=>e.t==='rule'?termTitle(e.k):e.t==='item'?IT[e.id]?.name:e.t==='inst'?IT[ME.inv.find(i=>i.uid===e.uid)?.id]?.name:e.t==='pool'?IT[S.pool.find(p=>p.uid===e.uid)?.id]?.name:e.t==='mon'?MON[e.id]?.name:'Rules index';
let panelNav=false; // true while handling a click that started inside the panel (or a hint opened from it)
function openPanel(e,push=true){if(push&&!(panelNav&&document.body.classList.contains('panel-open'))){P.stack=[];P.i=-1}if(push){P.stack=P.stack.slice(0,P.i+1);P.stack.push(e);P.i=P.stack.length-1}renderPanel();document.body.classList.add('panel-open');closePops(0);hidePreview()}
function closePanel(){document.body.classList.remove('panel-open');if(/^#(rule|item|mon)\//.test(location.hash))history.replaceState(null,'',location.pathname+location.search)}
function renderPanel(){
  const e=P.stack[P.i];if(!e)return;
  $('[data-action=pback]').disabled=P.i<=0;$('[data-action=pfwd]').disabled=P.i>=P.stack.length-1;
  $('#ptitle').textContent=entryTitle(e)||'';
  const href=e.t==='rule'?`#rule/${e.k}`:e.t==='mon'?`#mon/${e.id}`:e.t==='item'?`#item/${e.id}`:'';
  $('#pnew').hidden=!href;if(href)$('#pnew').href=location.pathname+href;
  const prev=P.i>0?P.stack[P.i-1]:null;
  $('#pbody').innerHTML=(prev?`<button class="backlink" data-action="pback">← Back to ${esc(entryTitle(prev))}</button>`:'')+panelBody(e);
  $('#pbody').scrollTop=0;
  if(e.n!=null){const li=$(`#pbody [data-n="${e.n}"]`);if(li){li.classList.add('hit');const pb=$('#pbody');pb.scrollTop+=li.getBoundingClientRect().top-pb.getBoundingClientRect().top-90}}
}
function panelBody(e){
  if(e.t==='rule'){const g=GLOSS[e.k];if(!g)return BOOK[e.k]?bookBody(BOOK[e.k]):'<p>Unknown rule.</p>';const bk=GLOSS_BOOK(e.k);return `<p style="font-size:1.05rem">${rich(g[1])}</p>${rich(g[2]||'')}${g[3]?.length?`<div class="rel"><span class="muted small" style="width:100%">Related</span>${g[3].filter(k=>GLOSS[k]).map(k=>`<a href="#rule/${k}" data-action="open-rule" data-k="${k}">${GLOSS[k][0]}</a>`).join('')}</div>`:''}${bk?`<p class="small" style="margin-top:1rem"><a href="#rule/${bk}" data-action="open-rule" data-k="${bk}">Read “${esc(BOOK[bk].t)}” in the ${BOOKN[BOOK[bk].book]} booklet →</a></p>`:''}`}
  if(e.t==='index')return `<input type="search" id="ridx" value="${esc(e.q||'')}" placeholder="Search: attack, initiative, heal, carry…" aria-label="Search the rules" style="width:100%"><div id="ridxr" style="margin-top:.5rem">${rulesResults(e.q||'')}</div>`;
  if(e.t==='mon')return statblockHTML(MON[e.id])+`<button class="btn primary" data-action="fight" data-id="${e.id}">Add to combat</button>`;
  let i=null,p=null,it;
  if(e.t==='inst'){i=ME.inv.find(x=>x.uid===e.uid);if(!i)return '<p>This item is no longer in your inventory.</p>';it=shown(i)}
  else if(e.t==='pool'){p=S.pool.find(x=>x.uid===e.uid);if(!p)return '<p>Already taken.</p>';it=S.area==='session'?IT[p.id]:shown(p)}
  else it=IT[e.id];
  const used=it.real?[]:usedIn(it.id);
  return `${cardHTML(it,i,{full:true,info:false})}
   <div class="stack" style="margin-top:1rem">
   ${i&&i.unid?idTestHTML(i):''}${i?`<div class="row">${i.count>1?`<button class="btn sm" data-action="split" data-uid="${i.uid}">Split stack…</button>`:''}<button class="btn sm" data-action="topool" data-uid="${i.uid}">Drop to loot pool${i.count>1?'…':''}</button><button class="btn sm ghost" data-action="discard" data-uid="${i.uid}">Discard</button></div><p class="small muted" style="margin:0">In ${SEC_NAME[i.sec].toLowerCase()} slot ${i.idx+1}. Drag it on the board to move it.</p>`:''}
   ${p&&S.area==='crow'?`<button class="btn primary" data-action="take" data-uid="${p.uid}">Take${p.count>1?'…':''}</button>`:''}
   ${it.craft?`<div><h3 class="sec-h" style="font-size:1rem"><a class="term" href="#rule/crafting" data-term="crafting" style="color:inherit">Crafting</a></h3><table class="rt"><tr><td>Expertise</td><td>${esc(it.craft.exp)}</td></tr><tr><td>Complexity</td><td>${it.craft.cx} <span class="small muted">(needs Mind ${it.craft.cx}+)</span></td></tr><tr><td>Materials</td><td>${matLinks(it.craft.mats)}</td></tr><tr><td>Goal</td><td>${it.craft.goal} crafting points</td></tr></table></div>`:''}
   ${it.upg?`<div><h3 class="sec-h" style="font-size:1rem">Upgrades</h3>${it.upg.map(([q,pr,t])=>`<p class="trait"><b>${q}</b> (${gc(pr)}): ${esc(t)}</p>`).join('')}</div>`:''}
   ${used.length?`<div><h3 class="sec-h" style="font-size:1rem">Used to craft ${used.length} item${used.length>1?'s':''}</h3><ul class="list-links">${used.map(x=>`<li><a href="#item/${x.id}" data-action="open-item" data-id="${x.id}">${esc(x.name)} <span>${esc(x.craft.exp)} · cx ${x.craft.cx}</span></a></li>`).join('')}</ul></div>`:''}
   </div>`;
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
  el.innerHTML=`<h4>${g[0]}</h4><div>${rich(g[1])}</div><div class="foot"><a href="#rule/${full}" data-action="open-rule" data-k="${full}">Full rule →</a>${term.classList.contains('hint')?'':`<span class="small muted">${lastPointer==='touch'?'tap the word again to open':'click the word to open'}</span>`}</div>`;
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
function showPreview(c){const uid=+c.dataset.uid;const i=ME.inv.find(x=>x.uid===uid);if(!i)return;const pv=$('#preview');pv.innerHTML=cardHTML(shown(i),i,{full:true,info:false,ro:true});prevFor=c;
  const r=c.getBoundingClientRect(),W=document.documentElement.clientWidth;const w=pv.offsetWidth,h=pv.offsetHeight;
  let left=r.right+12;if(left+w>W-8)left=r.left-w-12;if(left<8)left=8;pv.style.left=left+'px';pv.style.top=Math.max(8,Math.min(innerHeight-h-8,r.top))+'px';pv.classList.add('on')}
function hidePreview(){prevFor=null;$('#preview').classList.remove('on')}

/* ================= inventory actions ================= */
const findInst=uid=>ME.inv.find(i=>i.uid===+uid);
function addCount(i,n){i.count+=n;if(i.count<=0){ME.inv=ME.inv.filter(x=>x!==i);toast(`${nm(i)}: none left`)}}
function toPool(i,q){q=Math.min(q,i.count);const it=shown(i);const ex=S.pool.find(p=>p.id===i.id&&!p.unid===!i.unid&&p.from===ME.name);if(ex)ex.count+=q;else S.pool.push({uid:UID++,id:i.id,count:q,from:ME.name,ud:i.ud,val:i.val,unid:i.unid});
  if(i.lit)i.lit=false;i.count-=q;if(i.count<=0)ME.inv=ME.inv.filter(x=>x!==i);toast(`${it.name}${q>1?' ×'+q:''} → loot pool`)}
function dlgOk(dl,fn){dl.onclose=null;const f=$('form',dl);f.addEventListener('submit',e=>{if((e.submitter?.value||'ok')==='ok'){const v=fn;setTimeout(v,0)}});$$('[data-close]',dl).forEach(b=>b.onclick=()=>dl.close())}
function askYes(title,msg,ok,cb){const dl=$('#dlg');dl.innerHTML=`<form method="dialog"><h2>${esc(title)}</h2>${msg?`<p class="muted">${esc(msg)}</p>`:''}<div class="row" style="justify-content:flex-end;margin-top:1rem"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" value="ok">${esc(ok)}</button></div></form>`;dlgOk(dl,()=>cb());dl.showModal()}
function askNum(title,val,max,cb){const dl=$('#dlg');dl.innerHTML=`<form method="dialog"><h2 style="margin-bottom:.5rem">${esc(title)}</h2><input type="number" id="an" min="0" ${max!=null?`max="${max}"`:''} value="${val}" aria-label="${esc(title)}"><div class="row" style="justify-content:flex-end;margin-top:1rem"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" value="ok">OK</button></div></form>`;dlgOk(dl,()=>cb(parseInt($('#an').value)||0));dl.showModal();$('#an').select()}
function askQty(title,max,cb){if(max<=1)return cb(1);const dl=$('#dlg');dl.returnValue='';
  dl.innerHTML=`<form method="dialog"><h2 style="margin-bottom:.5rem">${esc(title)}</h2><p class="muted" style="margin:0 0 .6rem">How many of ${max}?</p><div class="row"><input type="number" id="qn" min="1" max="${max}" value="1" aria-label="Quantity"><button type="button" class="btn sm" data-q="1">1</button><button type="button" class="btn sm" data-q="${Math.ceil(max/2)}">Half</button><button type="button" class="btn sm" data-q="${max}">All ${max}</button></div><div class="row" style="margin-top:1rem;justify-content:flex-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" value="ok">OK</button></div></form>`;
  dl.onclick=e=>{const b=e.target.closest('[data-q]');if(b)$('#qn').value=b.dataset.q};
  dlgOk(dl,()=>cb(Math.max(1,Math.min(max,parseInt($('#qn').value)||1))));dl.showModal();$('#qn').select()}
function firstFit(id,ignore){for(const sec of ['pack','belt','hand','magic'])for(let k=0;k<LEN[sec];k++)if(!canPlace(ME,id,sec,k,ignore))return {sec,idx:k};return null}
function placeNew(id,sec,idx,x={}){const it=IT[id];
  const o=occ(ME,sec)[idx];if(o&&o.i.id===id&&!o.i.unid===!x.unid&&it.stack>1&&sec!=='hand'){const room=it.stack-o.i.count;const n=Math.min(room,x.count||1);if(n<=0){toast(`That stack is full (${it.stack}).`);return false}o.i.count+=n;if((x.count||1)>n)toast(`${(x.count||1)-n} didn’t fit in the stack`);return n}
  const err=canPlace(ME,id,sec,idx);if(err){toast(err);return false}
  let n=x.count||1;if(sec==='hand')n=1;n=Math.min(n,it.stack||1);
  ME.inv.push(inst(id,sec,idx,Object.assign({},x,{count:n})));return n}
function moveInst(i,sec,idx){
  const it=IT[i.id];if(i.sec===sec&&i.idx===idx)return;
  const o=occ(ME,sec)[idx];
  if(o&&o.i!==i&&o.i.id===i.id&&!o.i.unid===!i.unid&&it.stack>1&&sec!=='hand'){const n=Math.min(it.stack-o.i.count,i.count);if(n<=0)return toast('That stack is full.');o.i.count+=n;i.count-=n;if(!i.count)ME.inv=ME.inv.filter(x=>x!==i);return afterMove(i,'Stacked')}
  if(o&&o.i!==i&&o.k===0&&sizeIn(IT[o.i.id],i.sec)===1&&sizeIn(it,sec)===1){const ok=!canPlace(ME,o.i.id,i.sec,i.idx,i.uid)||(i.sec==='magic'&&!wearable(IT[o.i.id]));const e2=i.sec==='magic'&&!wearable(IT[o.i.id])?'Magic slots hold wearable magic items.':'';const e1=sec==='magic'&&!wearable(it)?'Magic slots hold wearable magic items.':'';if(e1||e2)return toast(e1||e2);
    [o.i.sec,o.i.idx,i.sec,i.idx]=[i.sec,i.idx,sec,idx];return afterMove(i,'Swapped')}
  const err=canPlace(ME,i.id,sec,idx,i.uid);if(err)return toast(err);
  if(sec==='hand'&&i.count>1){i.count--;ME.inv.push(inst(i.id,sec,idx,{ud:i.ud}));return afterMove(i,`Took 1 ${it.name} into your hand`)}
  i.sec=sec;i.idx=idx;afterMove(i)}
function afterMove(i,msg){if(i.lit&&i.sec!=='hand'){i.lit=false;toast(`${nm(i)} doused — roll its UD now`)}else if(msg)toast(msg);if(i.worn&&i.sec!=='pack')i.worn=false;render()}
function takeFromPool(p,q){
  const it=shown(p);const pos=firstFit(p.id);if(!pos)return toast(`No room for ${it.name} (${it.slots} slot${it.slots>1?'s':''}).`);
  S.placing={id:p.id,count:q,pool:p.uid,unid:p.unid};S.tab.crow='inventory';render();
}
function finishPlace(sec,idx){const pl=S.placing;if(!pl)return;const p=S.pool.find(x=>x.uid===pl.pool);
  const n=placeNew(pl.id,sec,idx,{count:pl.count,ud:p?.ud,val:p?.val,unid:pl.unid});if(!n)return;
  if(p){p.count-=n;if(p.count<=0)S.pool=S.pool.filter(x=>x!==p);if(p.from==='Ref')(ME.haul??=[]).push({id:pl.id,n,val:p.val??null,note:p.note||'',skip:isPart(IT[pl.id])})}
  if(pl.buy!=null){payCoins(ME,pl.buy*n);const bv=VILLAGES.find(x=>x.id===pl.v);if(bv){if(pl.auc&&bv.auction[pl.id])bv.auction[pl.id].left-=n;vSpend(bv,pl.buy*n)}if(pl.extra){const o=occ(ME,sec)[idx];if(o)o.i.extra=pl.extra}toast(`Bought ${nm(pl)}${n>1?' ×'+n:''} for ${(pl.buy*n).toLocaleString('en')} gc → ${SEC_NAME[sec]} ${idx+1}`);pl.count-=n;if(pl.count>0)return render()}
  else toast(`${nm(pl)}${n>1?' ×'+n:''} → ${SEC_NAME[sec]} ${idx+1}`);S.placing=null;render()}

/* ---------- pointer drag (mouse + touch) ---------- */
let drag=null,dragging=false;
// Drop the drag if the pointer is lost (Alt+Tab, window blur, touch cancel) so no ghost card is left behind.
// ponytail: rAF loop only while a drag is live; speed grows the closer the pointer is to the edge.
let edgeRAF=0;
function edgeScroll(){if(!dragging||!drag){edgeRAF=0;return}const y=drag.cy,top=Math.max(0,$('#top').getBoundingClientRect().bottom)+90,bot=innerHeight-($('#nav').offsetHeight||0)-90;
  const dy=y<top?-Math.min(28,(top-y)/3+4):y>bot?Math.min(28,(y-bot)/3+4):0;if(dy)scrollBy(0,dy);edgeRAF=requestAnimationFrame(edgeScroll)}
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
    $$('.slot[data-sec]').forEach(s=>{const ok=!canPlace(ME,id,s.dataset.sec,+s.dataset.idx,drag.uid)||(occ(ME,s.dataset.sec)[+s.dataset.idx]?.i.id===id);s.classList.add(ok?'target':'nope')})}
  drag.cy=e.clientY;if(!edgeRAF)edgeRAF=requestAnimationFrame(edgeScroll);
  drag.ghost.style.left=e.clientX+8+'px';drag.ghost.style.top=e.clientY+8+'px';
  $$('.drop-hover').forEach(x=>x.classList.remove('drop-hover'));
  const el=document.elementFromPoint(e.clientX,e.clientY);const t=el&&(el.closest('.slot[data-sec]')||el.closest('#pool,#pooldrop'));if(t)t.classList.add('drop-hover');
});
document.addEventListener('pointerup',e=>{
  if(!drag)return;const d0=drag;drag=null;
  if(!dragging){if(d0.uid&&e.target.closest('.slot>.card')&&!e.target.closest('button,a,input,select'))cardTap(d0.uid,e.target.closest('.slot[data-sec]'));return}dragging=false;$$('.card.ghost').forEach(g=>g.remove());document.body.classList.remove('is-dragging');
  const el=document.elementFromPoint(e.clientX,e.clientY);
  const slot=el&&el.closest('.slot[data-sec]'),pool=el&&el.closest('#pool,#pooldrop');
  if(d0.uid){const i=findInst(d0.uid);
    if(pool){askQty(`Give ${nm(i)} to the loot pool`,i.count,q=>{toPool(i,q);render()});render();return}
    if(slot){moveInst(i,slot.dataset.sec,+slot.dataset.idx);render();return}}
  else if(d0.pool&&slot){const p=S.pool.find(x=>x.uid===d0.pool);const go=q=>{S.placing={id:p.id,count:q,pool:p.uid,unid:p.unid};finishPlace(slot.dataset.sec,+slot.dataset.idx)};askQty(`Take ${nm(p)}`,p.count,go);if(p.count<=1)return}
  render();
});

// Tap a card to pick it up, then tap where it goes (keyboard: Enter on the card, then on the target).
function cardTap(uid,slot){hidePreview();if(!S.moving||S.moving===uid){S.moving=S.moving===uid?null:uid;return render()}tapMove(slot)}
function tapMove(slot){const i=findInst(S.moving);S.moving=null;if(i&&slot)moveInst(i,slot.dataset.sec,+slot.dataset.idx);render()}
document.addEventListener('click',e=>{if(!S.moving||!e.target.closest('#pooldrop,#pool'))return;const i=findInst(S.moving);S.moving=null;if(i)askQty(`Give ${nm(i)} to the loot pool`,i.count,q=>{toPool(i,q);render()});render()});
document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const c=e.target.closest?.('.slot>.card[data-uid]');if(!c||e.target!==c)return;e.preventDefault();cardTap(+c.dataset.uid,c.closest('.slot[data-sec]'));$(`.slot>.card[data-uid="${c.dataset.uid}"]`)?.focus()});

/* ---------- empty-slot search popover ---------- */
const sp=$('#searchPop');let spFor=null;
// Empty slot → every card that fits this slot is listed at once; chips and the filter narrow it down.
function openSlotSearch(cell){
  spFor={sec:cell.dataset.sec,idx:+cell.dataset.idx,cat:'',q:'',kw:false};
  const fits=D.items.filter(it=>it.cat!=='unidentified'&&!canPlace(ME,it.id,spFor.sec,spFor.idx)).sort((a,b)=>a.name.localeCompare(b.name));
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
  go:b=>{S.area=b.dataset.v;S.placing=null;closePanel();render();scrollTo(0,0)},
  tab:b=>{S.tab[S.area]=b.dataset.v;render()},
  home:b=>{S.home=b.dataset.v;render()},
  'open-crow':b=>{ME=PARTY[+b.dataset.i];store.set('crow',+b.dataset.i);S.mi={last:null};S.test=null;S.rest.act=null;S.rest.log=null;S.sell={sel:{},greed:{},val:{},to:{},ar:{}};S.area='crow';S.tab.crow='sheet';closePanel();render();scrollTo(0,0)},
  'crow-del':()=>askYes(`Delete ${ME.name}?`,'This can’t be undone.','Delete',()=>{PARTY.splice(PARTY.indexOf(ME),1);ME=PARTY[0]||null;store.set('crow',0);S.area='crows';render()}),
  'new-crow':b=>newBuild(b.dataset.bg),
  bgold:b=>{const B=S.b;if(b.dataset.v){const v=+b.dataset.v;B.gold=null;B.coins=+B.coins===v?'':String(v)}else{B.gold=[d(6),d(6),d(6)];B.coins=String(B.gold.reduce((a,x)=>a+x))}render()},
  bnpc:b=>{S.b.npcType=S.b.npcType===b.dataset.v?'':b.dataset.v;render()},
  bstep:b=>{S.b.step=b.dataset.v;render();scrollTo(0,0)},
  broll:b=>{const B=S.b;if(b.dataset.v==='clear'){B.roll=null;return render()}B.roll=[d(6),d(6)];render();$('.opt.rolled')?.scrollIntoView({block:'center',behavior:'smooth'})},
  bbg:b=>{if(b.dataset.v)selectBg(b.dataset.v);else Object.assign(S.b,{bg:null,two:null,arr:null});render()},
  btwo:b=>{S.b.two=b.dataset.v;S.b.arr=null;render()},
  barr:b=>{S.b.arr=+b.dataset.v;render()},
  bsave:()=>saveBuild(),
  bcancel:()=>askYes('Discard this crow?','','Discard',()=>{S.b=null;S.area='crows';render()}),
  libcat:b=>{S.lib.cat=b.dataset.v;S.lib.q='';S.lib.pick=null;render()},
  lpick:b=>{S.lib.pick=b.dataset.v;render()},
  'rules-index':()=>{openPanel({t:'index'});$('#ridx').focus()},
  'open-rule':b=>openPanel({t:'rule',k:b.dataset.k,n:b.dataset.n!=null?+b.dataset.n:undefined}),
  'open-item':b=>openPanel({t:'item',id:b.dataset.id}),
  'open-inst':b=>openPanel({t:'inst',uid:+b.dataset.uid}),
  'open-pool':b=>openPanel({t:'pool',uid:+b.dataset.uid}),
  'open-mon':b=>openPanel({t:'mon',id:b.dataset.id}),
  pback:()=>{if(P.i>0){P.i--;renderPanel()}}, pfwd:()=>{if(P.i<P.stack.length-1){P.i++;renderPanel()}}, pclose:closePanel,
  slot:b=>{if(S.placing)return finishPlace(b.dataset.sec,+b.dataset.idx);if(S.moving)return tapMove(b);openSlotSearch(b)},
  'sp-close':closeSlotSearch,
  take:b=>{const p=S.pool.find(x=>x.uid===+b.dataset.uid);closePanel();if(p.id==='gold-coins'){const pu=purse(ME),room=pu?purseMax(pu)-pu.coins:0;if(room>0){const q=Math.min(room,p.count);pu.coins+=q;p.count-=q;if(p.from==='Ref')(ME.haul??=[]).push({id:'gold-coins',n:q,val:1,note:p.note||''});if(!p.count)S.pool=S.pool.filter(x=>x!==p);toast(`${q} gc → your coin purse${p.count?` — ${p.count} gc left in the pool (needs a slot or another purse)`:''}`);return render()}}askQty(`Take ${nm(p)}`,p.count,q=>takeFromPool(p,q))},
  'cancel-place':()=>{S.placing=null;S.moving=null;render()},
  'pool-remove':b=>{const p=S.pool.find(x=>x.uid===+b.dataset.uid);S.pool=S.pool.filter(x=>x!==p);toast(`${nm(p)} removed from the pool`);render()},
  lvexp:b=>{(S.lvl[b.dataset.lv]??={}).exp=b.value;render()},
  lvch:b=>{(S.lvl[b.dataset.lv]??={}).ch=b.dataset.v;render()},
  lvok:b=>{const c=ME,lv=+b.dataset.lv,pick=S.lvl[lv],e=pick.exp;const k=allExp().wpn.includes(e)?'wpn':allExp().mag.includes(e)?'mag':'gen';c.exp[k].push(e);if(pick.ch)c.ch[pick.ch]=Math.min(4,c.ch[pick.ch]+1);(c.lvDone??=[]).push(lv);(c.lvLog??={})[lv]={exp:e,k,ch:pick.ch||null};delete S.lvl[lv];toast(`Level ${lv}: ${e}${pick.ch?`, ${CHN[pick.ch]} +1`:''}`);render()},
  'lore-spend':()=>{const c=ME;if(c.lore?.n){c.lore.n--;toast(`Spent 1 ${c.lore.exp} Effort`);render()}},
  tree:b=>{S.tree=b.dataset.v;render()},
  trefund:b=>{const c=ME,n=D.trees[S.tree].nodes[+b.dataset.k].n,t=c.traits.find(x=>x.tree===S.tree&&x.n===n);
    askYes(`Undo ${t.n}?`,`Removes the trait and gives back ${t.xp.toLocaleString('en')} XP. For fixing a mistake.`,'Undo',()=>{c.traits=c.traits.filter(x=>x!==t);c.xpSpent-=t.xp;render()})},
  'xp-unbank':()=>{ME.xpBank=0;render()},
  'xp-fix':()=>{const c=ME;askNum('Total XP (TXP)',c.txp,null,n=>{const was=level(c).lv,log=[];c.txp=n;
    // levels you no longer have: take back their expertise and characteristic
    for(const lv of [...(c.lvDone||[])].filter(l=>l>level(c).lv)){const x=c.lvLog?.[lv];if(x){c.exp[x.k]=c.exp[x.k].filter(e=>e!==x.exp);if(x.ch)c.ch[x.ch]--;delete c.lvLog[lv]}c.lvDone=c.lvDone.filter(l=>l!==lv);log.push(`level ${lv}${x?'':' (check its expertise by hand)'}`)}
    // traits you can no longer afford: newest purchases go first
    while(c.xpSpent>c.txp){const k=c.traits.findLastIndex(t=>t.xp);if(k<0)break;const t=c.traits.splice(k,1)[0];c.xpSpent-=t.xp;log.push(t.n)}
    c.stamina=Math.min(c.stamina,stMax(c));c.effort=Math.min(c.effort,effMax(c));
    toast(log.length?`Undone: ${log.join(', ')}`:level(c).lv!==was?`Level ${level(c).lv}`:'XP corrected');render()})},
  tbuy:b=>{const c=ME,T=D.trees[S.tree],nd=T.nodes[+b.dataset.k],t=traitOfTree(S.tree,nd.n);if(traitState(c,S.tree,+b.dataset.k)!=='open')return;if(t.xp>c.txp-c.xpSpent)return toast('Not enough XP');
    askYes(`Buy ${t.n} for ${t.xp.toLocaleString('en')} XP?`,'You buy traits when you finish a rest.','Buy',()=>{c.xpSpent+=t.xp;c.traits.push({n:t.n,tree:t.tree,t:t.t,xp:t.xp});toast(`${t.n} learned`);render()})},
  'pet-add':()=>{const c=ME,v=vHere(),id=S.petPick||$('[data-action=pet-pick]').value,m=MON[id];if($('#petbuy')?.checked){const max=INST.stables.val[lvlOf(v,'stables')-1],pw=parseInt(m.st.Power)||0,price=Math.ceil((PET_PRICE(pw)??0)*(v.home?1:1.2));if(pw>max)return toast(`These stables sell pets up to power ${max}`);if(coinsOf(c)<price)return toast(`You need ${price} gc`);payCoins(c,price);vSpend(v,price);toast(`${m.name}: ${price} gc`)}(c.pets??=[]).push(mkPet(S.petPick||$('[data-action=pet-pick]').value,$('#petname').value.trim()));render()},
  'pet-del':b=>{const c=ME,p=c.pets[+b.dataset.k];askYes(`Let ${p.name} go?`,p.inv.length?'Cards it carries go back to you if there’s room, otherwise to the loot pool.':'','Let go',()=>{for(const i of [...p.inv])petBack(c,p,i);c.pets.splice(+b.dataset.k,1);render()})},
  'pet-st':b=>{const p=ME.pets[+b.dataset.k];p.st=Math.max(0,Math.min(petMax(p),p.st+ +b.dataset.d));render()},
  'pet-wound':b=>{const p=ME[b.dataset.kind||'pets'][+b.dataset.k],v=+b.dataset.v;p.wounds=p.wounds.includes(v)?p.wounds.filter(x=>x!==v):[...p.wounds,v];if(p.wounds.length>=p.len.pack&&p.len.pack)toast(`${p.name} dies.`);render()},
  'pet-take':b=>{const c=ME,p=c[b.dataset.kind||'pets'][+b.dataset.k],i=p.inv.find(x=>x.uid===+b.dataset.uid);petBack(c,p,i);render()},
  'hire-add':()=>{const c=ME,m=MON[S.hirePick||$('[data-action=hire-pick]').value];(c.hires??=[]).push({uid:UID++,mon:m.id,name:$('#hirename').value.trim()||m.name,st:parseInt(m.st.Stamina)||1,days:0,wounds:[],inv:[],len:{pack:parseInt(m.st.Slots)||0}});render()},
  'hire-del':b=>{const c=ME,h=c.hires[+b.dataset.k];askYes(`Dismiss ${h.name}?`,h.inv?.length?'Your cards they carry come back to you if there’s room, otherwise to the loot pool.':'','Dismiss',()=>{for(const i of [...(h.inv||[])])petBack(c,h,i);c.hires.splice(+b.dataset.k,1);render()})},
  'hire-st':b=>{const h=ME.hires[+b.dataset.k];h.st=Math.max(0,Math.min(parseInt(MON[h.mon].st.Stamina)||1,h.st+ +b.dataset.d));render()},
  'hire-pay':b=>{const c=ME,h=c.hires[+b.dataset.k],pay=hirePay(h),pu=purse(c);if(!pu||pu.coins<pay)return toast(`You need ${pay} gc in your coin purse`);const r=c.inv.find(i=>i.id==='ration');if(!r)return toast('You need a ration for them');pu.coins-=pay;addCount(r,-1);h.days=(h.days||0)+1;toast(`${h.name} paid for the day`);render()},
  'wound-type':b=>{S.pendingWounds+=1;S.pendingWoundType=b.dataset.v;S.tab.crow='inventory';render()},
  wound:b=>{const k=+b.dataset.v,c=ME;c.woundType??={};if(c.wounds.has(k)){c.wounds.delete(k);delete c.woundType[k]}else{c.wounds.add(k);if(S.pendingWounds){if(S.pendingWoundType)c.woundType[k]=S.pendingWoundType;if(!--S.pendingWounds)S.pendingWoundType=null}}if(ME.wounds.size>=10)toast('10 wounds — your crow dies.');render()},
  effort:b=>{const c=ME;if(+b.dataset.d<0&&c.effortBonus)c.effortBonus--;else c.effort=Math.max(0,Math.min(effMax(c),c.effort+ +b.dataset.d));render()},
  cruelty:b=>{ME.cruelty=Math.max(0,ME.cruelty+ +b.dataset.d);render()},
  cond:b=>{const k=b.dataset.v;ME.cond.has(k)?ME.cond.delete(k):ME.cond.add(k);render()},
  light:b=>{const i=findInst(b.dataset.uid);if(i.lit){i.lit=false;toast('Doused — roll its UD now')}else{if(!i.ud&&IT[i.id].ud)return toast('Out of fuel — refuel or replace it');ME.inv.forEach(x=>x.lit=false);i.lit=true}render()},
  wear:b=>{const i=findInst(b.dataset.uid);const on=!i.worn;ME.inv.forEach(x=>x.worn=false);i.worn=on;if(on)i.ad??=IT[i.id].ad;render()},
  cnt:b=>{const i=findInst(b.dataset.uid);const it=IT[i.id];if(+b.dataset.d>0&&i.count>=it.stack)return toast(`A slot holds ${it.stack} ${it.name}.`);addCount(i,+b.dataset.d);if(+b.dataset.d<0&&/ration/i.test(it.name))clearWounds(ME,'starvation');render()},
  ud:b=>{const i=findInst(b.dataset.uid);const it=IT[i.id];const pip=[...b.parentNode.children].indexOf(b);
    if(pip<i.ud){i.ud--;if(i.ud===0){if(/Useless/.test(it.ud[1])){i.lit=false;if(i.count>1){i.count--;i.ud=it.ud[0];toast(`One ${it.name} is used up — ${i.count} left`)}else{ME.inv=ME.inv.filter(x=>x!==i);toast(`${it.name} is used up`)}}else{i.lit=false;toast(`${it.name} is out: ${it.ud[1].split(';')[0]}`)}}}
    else i.ud=Math.min(it.ud[0],i.ud+1);render()},
  coins:b=>{const i=findInst(b.dataset.uid);askNum(`Coins in the purse (max ${purseMax(i)})`,i.coins,purseMax(i),v=>{i.coins=Math.max(0,Math.min(purseMax(i),v));render()})},
  split:b=>{const i=findInst(b.dataset.uid);askQty(`Split ${nm(i)}`,i.count-1,q=>{const pos=firstFit(i.id);if(!pos)return toast('No free slot');i.count-=q;ME.inv.push(inst(i.id,pos.sec,pos.idx,{count:q,unid:i.unid}));toast(`Moved ${q} to ${SEC_NAME[pos.sec]} ${pos.idx+1}`);render();renderPanel()})},
  topool:b=>{const i=findInst(b.dataset.uid);askQty(`Give ${nm(i)} to the loot pool`,i.count,q=>{toPool(i,q);closePanel();render()})},
  discard:b=>{const i=findInst(b.dataset.uid);askYes(`Throw away ${nm(i)}${i.count>1?' ×'+i.count:''}?`,'','Throw away',()=>{ME.inv=ME.inv.filter(x=>x!==i);closePanel();render()})},
  heal:b=>{const v=parseInt(b.closest('form').n.value)||0;if(v<=0)return toast('Type how much Stamina to regain');const was=ME.stamina;ME.stamina=Math.min(stMax(ME),ME.stamina+v);toast(`Stamina +${ME.stamina-was}`);render()},
  test:b=>{S.test=S.test===b.dataset.v?null:b.dataset.v;render()},
  // travel
  pace:b=>{S.travel.pace=b.dataset.v;render()}, role:b=>{S.travel.role=b.dataset.v;S.travel.task=null;render()},
  ttier:b=>{S.travel.task=b.dataset.task;S.travel.tier=+b.dataset.v;render()},
  // miasma (player)
  'mi-fx':()=>{miRoll(ME);render()},
  'mi-clear':()=>{miClear(ME);render()},
  'mi-undo':()=>{miUndo(ME);render()},
  'mi-rm':b=>{ME.miasma.splice(+b.dataset.k,1);render()},
  rwhere:b=>{S.rest.where=b.dataset.v;render()},
  ract:b=>{S.rest.act=S.rest.act===b.dataset.v?null:b.dataset.v;S.rest.pick=null;S.rest.log=null;render()},
  rpick:b=>{S.rest.pick=S.rest.pick===b.dataset.v?null:b.dataset.v;render()},
  rfinish:()=>{const c=ME,R=S.rest,log=[];
    if(!R.where)return toast('Choose where you rested first');
    if(R.act&&['identify','repair','tend','lore'].includes(R.act)&&!R.pick)return toast('Pick what the activity is for, or choose no activity');
    if(R.act==='craft'&&!R.pick)return toast('Pick what to craft');
    const need=c.miasma.some(x=>x.n===MI_NAMES[3])?2:1,lazy=c.miasma.some(x=>x.n===MI_NAMES[9]),rat=c.inv.find(i=>i.id==='ration');
    const home=vHere()?.home&&R.where==='clear',inn=home?need:c.innFood?1:0,own=need-inn;c.innFood=false;
    const ate=own<=0||(R.ration&&rat&&rat.count>=own);
    if(ate){if(own>0)addCount(rat,-own);log.push(home?'Fed at home':inn?`Ate at the inn${own>0?` and ${own} ration${own>1?'s':''}`:''}`:`Ate ${need} ration${need>1?'s':''}`)}
    else if(R.ration&&rat){addCount(rat,-1);log.push('<b>Ravenous: 1 ration isn’t enough</b> — no benefits from this rest')}
    else{S.pendingWounds+=1;S.pendingWoundType='starvation';log.push('<b>No food</b> — no benefits from this rest; mark 1 starvation wound (it goes when you eat)')}
    // a rest only counts if you ate what you needed (Rules p. 15)
    if(ate){clearWounds(c,'starvation');clearWounds(c,'exhaustion');c.stamina=stMax(c);for(let k=0;k<(lazy?2:1);k++){const w=[...c.wounds].sort((a,b)=>b-a)[0];if(w!=null){c.wounds.delete(w);log.push('Lost 1 wound'+(lazy&&k?' (Lazy)':''))}}
      if(R.where==='clear'){c.effort=effMax(c);if(c.cruelty||c.miasma.length){c.cruelty=0;c.miasma=c.miasma.filter(x=>!['cruelty','out'].includes(x.dur||fxRow(x).dur));log.push('Out of the Miasma: cruelty 0, Miasma effects ended')}}}
    c.effortBonus=0;c.lore=null; // Good Night's Rest and lore book bonuses end when you finish a rest
    if(!ate&&c.xpBank)log.push(`+${c.xpBank} XP waits for a rest where you eat`);
    if(ate&&c.xpBank){c.txp+=c.xpBank;log.push(`+${c.xpBank} XP counted (TXP ${c.txp})`);c.xpBank=0;if(pendingLevels(c).length)log.push('<b>Level up!</b> Make your choices on the Sheet.');if(ate){c.stamina=stMax(c);if(R.where==='clear')c.effort=effMax(c)}}
    for(const p of c.pets||[]){const need=FEED[MON[p.mon].st.Size]||1,f=c.inv.find(i=>i.id==='animal-feed');
      if(R.where==='miasma'){p.st=petMax(p);if(p.wounds.length)p.wounds.pop();log.push(`${esc(p.name)} forages and rests`)}
      else if(f&&f.count>=need){addCount(f,-need);p.st=petMax(p);if(p.wounds.length)p.wounds.pop();log.push(`${esc(p.name)} ate ${need} animal feed and rests`)}
      else log.push(`<b>${esc(p.name)} has no feed</b> — no rest for them; in a dungeon they starve`)}
    c.rests=(c.rests||0)+1;c.lastRest=R.where;
    c.inv.forEach(i=>{const it=IT[i.id];if(it.ud&&/Rest/.test(it.ud[1]))i.ud=it.ud[0]});
    if(R.act==='identify'){const i=c.inv.find(x=>x.uid===+R.pick);if(i){i.unid=false;log.push(`Identified: <b>${esc(IT[i.id].name)}</b>`)}}
    if(R.act==='repair'){const i=c.inv.find(x=>x.uid===+R.pick);if(i){i.ad=adBase(c,i);log.push(`${esc(IT[i.id].name)} is back to ${i.ad} AD`)}}
    if(R.act==='lore'){const i=c.inv.find(x=>x.uid===+R.pick);if(i){c.lore={exp:R.loreExp||LORE_EXP[0],n:LORE_BOOKS[i.id],book:IT[i.id].name};log.push(`Studied ${esc(c.lore.book)}: ${esc(c.lore.exp)} and +${c.lore.n} Effort for it until your next rest`)}}
    if(ate&&R.act==='sleep'){c.effortBonus=1;log.push('+1 bonus Effort until you use it or finish your next rest')}
    if(R.act==='harvest'){let n=0;for(let k=0;k<R.size;k++)n+=d(6);autoPlace(c,R.part,n);log.push(`Harvested ${n} × ${esc(IT[R.part].name)}`)}
    if(R.act==='tend'){const x=PARTY.find(p=>p.name===R.pick);const w2=x&&[...x.wounds].sort((a,b)=>b-a)[0];if(w2!=null){x.wounds.delete(w2);log.push(`${esc(x.name)} loses 1 extra wound`)}}
    if(R.act==='seclude')log.push('Camp secluded (EN −1 for this rest)');
    if(R.act==='craft'){const it=IT[R.pick];let pj=c.crafts.find(x=>x.id===it.id);if(!pj){pj={id:it.id,pts:0};c.crafts.push(pj)}
      const rolls=craftRolls(c,(R.plus?4:0)+(R.crafty&&c.npcType==='Crafty'?2:0));pj.pts+=rolls.reduce((a,b)=>a+b,0);log.push(`Crafting roll${rolls.length>1?'s (crit!)':''}: ${rolls.join(' + ')} → ${pj.pts} / ${it.craft.goal} points`);
      let made=0;if(pj.pts>=it.craft.goal){pj.pts-=it.craft.goal;made=1}
      if(made){made*=it.craft.yield||1;autoPlace(c,it.id,made);log.push(`<b>Finished: ${esc(it.name)}${made>1?' ×'+made:''}</b>${pj.pts?` — ${pj.pts} spare points carry over if you gather materials for another`:''}`);if(!pj.pts)c.crafts=c.crafts.filter(x=>x!==pj)}}
    R.log=log;R.act=null;R.pick=null;R.plus=false;R.where=null;render();scrollTo(0,0)},
  'id-study':b=>{const i=findInst(b.dataset.uid);if(!held(i))return toast('Hold it first: move it to a hand, or a magic slot if it’s wearable');if(i.tried)return toast('You can only study an item once');
    const a=d(10),bb=d(10),n=a+bb,t=n<=3?1:n>=19?3:tierOfTotal(n+ME.ch.M),r=IT[i.id];i.tried=true;if(t===3)i.unid=false;render();renderPanel();
    idResult(`Study: tier ${t}`,`<p>2d10 <span class="roll">${a} + ${bb}</span> ${n<=3?'— a doom':n>=19?'— a crit':`+ Mind ${fmt(ME.ch.M)} = <b>${n+ME.ch.M}</b>`}</p>
      ${t===3?`<p>You work it out: it’s <b>${esc(r.name)}</b>.</p>${cardHTML(r,null,{full:true,info:false})}`:t===2?'<p>You learn nothing about it. Try the Identify Item activity on your next rest, or use it blind.</p>':'<p><b>It goes off in a harmful way.</b> Tell the Ref — they decide what happens. You still don’t know what it is.</p>'}`)},
  'id-use':b=>{const i=findInst(b.dataset.uid);if(!held(i))return toast('Hold it first: move it to a hand, or a magic slot if it’s wearable');const r=IT[i.id];
    askYes('Use it without knowing what it is?','You activate it blind. The Ref describes what happens — it could help, waste it, or hurt.','Use it',()=>{const used=isConsumable(r);i.unid=false;if(used)addCount(i,-1);render();renderPanel();
      idResult(`It’s ${esc(r.name)}`,`<p>${used?'It’s used up. ':''}The Ref tells you what happened; from now on you know what it does.</p>${cardHTML(r,null,{full:true,info:false})}`)})},
  // market
  mkt:b=>{S.mkt=b.dataset.v;render()},
  'go-villages':()=>{S.area='session';S.tab.session='village';render();scrollTo(0,0)},
  buyk:b=>{S.buy.k=b.dataset.v;render()},
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
    payCoins(c,bet);if(won){const pu=purse(c);if(pu)pu.coins=Math.min(purseMax(pu),pu.coins+won)}G.last=`${txt} ${won?`You win <b>${won} gc</b>.`:`You lose ${bet} gc.`}`;render()},
  fund:b=>{const c=ME,v=vHere(),k=b.dataset.k,l=v.inst[k]?.lvl||0,price=l?INST[k].adv[l]:INST[k].found,f=v.fund[k]??={paid:0,by:{}},n=Math.min(+(S.fundn?.[k])||Math.min(coinsOf(c),price-f.paid),price-f.paid,coinsOf(c));if(n<=0)return;
    payCoins(c,n);f.paid+=n;f.by[c.name]=(f.by[c.name]||0)+n;
    if(f.paid>=price){delete v.fund[k];v.pending.push({k,to:l+1});v.prosperity=Math.min(10,v.prosperity+1);v.raised=true;toast(`${INST[k].n} ${l?'upgraded to '+ORD(l+1):'founded'} — opens next cycle. Prosperity +1`)}else toast(`${n} gc toward ${INST[k].n}: ${f.paid} / ${price}`);saveVillages();render()},
  vsel:b=>{S.vsel=b.dataset.v;render()},
  nvadd:()=>{const N=S.newv,P=V_PRESETS[N.preset];let o;if(P)o={name:P.name,note:P.note,inst:P.inst};else if(N.preset==='start'){o={name:N.name||'Our village',inst:Object.fromEntries([...HOME_START,N.extra].map(k=>[k,[1,'']]))}}else o={name:N.name||'New village',inst:{}};
    o.home=N.home;if(N.home)VILLAGES.forEach(v=>v.home=false);const v=mkVillage(o);S.vsel=v.id;S.newv=null;toast(`${v.name} created`);render()},
  'vhere-set':b=>{S.here=b.dataset.v;saveVillages();toast(`The party is in ${vHere().name}`);render()},
  vleave:()=>{S.here='';saveVillages();render()},
  vdel:b=>{const v=VILLAGES.find(x=>x.id===b.dataset.v);askYes(`Delete ${v.name}?`,'Its institutions and history go too.','Delete',()=>{VILLAGES.splice(VILLAGES.indexOf(v),1);if(S.here===v.id)S.here='';saveVillages();render()})},
  vprosp:b=>{const v=VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0];v.prosperity=Math.max(-10,Math.min(10,v.prosperity+ +b.dataset.d));saveVillages();render()},
  vsale:b=>{const v=VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0];v.saleMod=(v.saleMod||0)+ +b.dataset.d;saveVillages();render()},
  vday:b=>{const v=VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0];v.day=Math.max(1,v.day+ +b.dataset.d);if(v.day>20){v.day=20;toast('Day 20 — end the cycle')}saveVillages();render()},
  vcycle:()=>{const v=VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0];askYes(`End cycle ${v.cycle} in ${v.name}?`,'Prosperity drops if nothing raised it, paid upgrades open, this cycle’s event effects end, merchants restock and the next event is rolled.','End cycle',()=>{const log=endCycle(v);toast(log.slice(0,2).join(' · '));render()})},
  vlvl:b=>{const v=VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0],k=b.dataset.k,x=v.inst[k]??={lvl:0,steward:'',mod:0,closed:false};x.lvl=Math.max(0,Math.min(maxLvl(k),x.lvl+ +b.dataset.d));saveVillages();render()},
  vmod:b=>{const v=VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0],x=v.inst[b.dataset.k];x.mod=Math.max(-3,Math.min(2,(x.mod||0)+ +b.dataset.d));saveVillages();render()},
  dosell:()=>{const s=S.sell,v=vHere();let tot=0;for(const i of [...ME.inv]){const q=s.sel[i.uid];if(!q)continue;const it=shown(i);const bs=buyersOf(it).filter(k=>lvlOf(v,k));const k=s.to[i.uid]||bs[0]||(lvlOf(v,'auction')&&auctionable(it)?'auction':null);if(!k)continue;
    const pct=k==='auction'?(s.ar[i.uid]??d(10)*(10+v.prosperity)):salePctAt(v);const val=(i.val??it.price??(+s.val[i.uid]||0))*q;tot+=Math.floor(Math.floor(val*(1+[0,.3,.2,.1][+s.greed[i.uid]||0]))*pct/100);i.count-=q;if(i.count<=0)ME.inv=ME.inv.filter(x=>x!==i)}
    const p=purse(ME);let left=tot;if(p){const fit=Math.min(tot,purseMax(p)-p.coins);p.coins+=fit;left-=fit}
    if(left>0){S.pool.push({uid:UID++,id:'gold-coins',count:left,from:ME.name});toast(`Sold for ${tot} gc — ${left} gc didn’t fit in the purse and wait in the loot pool`)}else toast(`Sold for ${tot} gc`);S.sell={sel:{},greed:{},val:{},to:{},ar:{}};render()},
  // ref session
  'dt-run':()=>{S.dt.running=!S.dt.running;if(S.dt.left===0)S.dt.left=S.dt.len*60;render()},
  'dt-end':()=>{S.dt.running=false;S.dt.end={step:1};render()},
  'end-step':()=>{S.dt.end.step=2;render()},
  'end-cond':()=>{PARTY.forEach(c=>DT_END_CONDITIONS.forEach(k=>c.cond.delete(k)));S.dt.end.step=3;render()},
  'end-roll':()=>{S.dt.end.check=doEncCheck(enOf());render()},
  'next-dt':()=>{S.dt.n++;S.dt.left=S.dt.len*60;S.dt.end=null;S.dt.running=true;render()},
  'enc-check':()=>{const ec=doEncCheck(enOf());S.dt.end=S.dt.end||null;const dl=$('#dlg');dl.innerHTML=`<h2>Encounter check</h2><div style="margin:.75rem 0">${encResultHTML(ec)}</div><form method="dialog" class="row" style="justify-content:flex-end"><button class="btn primary">Close</button></form>`;dl.showModal()},
  fight:b=>{const m=MON[b.dataset.id],k=+b.dataset.n||1;for(let j=0;j<k;j++){const n=S.combat.filter(x=>x.id===m.id).length+1;S.combat.push({uid:UID++,id:m.id,n,st:parseInt(m.st.Stamina)||1,ad:parseInt(m.st.AD)||0})}toast(`${k>1?k+' × ':''}${m.name} join${k>1?'':'s'} the combat (Session → Dungeon turn)`);if(S.area==='session'||b.closest('#pbody'))render()},
  unfight:b=>{S.combat=S.combat.filter(x=>x.uid!==+b.dataset.uid);render()},
  // loot / monsters / tables
  kw:b=>{S.lookup.kw=b.checked;render()},
  drop:b=>{const id=b.dataset.id;const q=Math.max(1,parseInt($('#dropq').value)||1);const v=$('#dropv')?parseInt($('#dropv').value)||null:null;S.pool.push({uid:UID++,id,count:q,from:'Ref',note:$('#dropn').value.trim(),val:v,unid:!!$('#dropu')?.checked});toast(`${IT[id].name}${q>1?' ×'+q:''} is in the loot pool`);render()},
  qroll:b=>{const k=b.dataset.v,x=rollTable(k);S.lookup.qres=`<div class="result" style="margin-top:.5rem"><span class="roll">${x.r}</span> ${esc(TB[k].title)}: ${esc(treasureToPool(k,x.row))} <b>→ loot pool</b></div>`;render()},
  pcat:b=>{PICK[b.dataset.key].cat=b.dataset.v;render()},
  lootpick:b=>{S.lookup.pick=b.dataset.v;render();$('#dropq')?.closest('.box')?.scrollIntoView({block:'nearest',behavior:'smooth'})},
  lootpickadd:b=>{lootAdd(b.dataset.v,1);toast(`${IT[b.dataset.v].name} added`);render()},
  'loot-drop':b=>{const p=LOOT.find(x=>x.id===b.dataset.v);for(const it of p.items)S.pool.push({uid:UID++,id:it.id,count:it.n,from:'Ref',note:p.name+(p.note?' — '+p.note:''),unid:it.u??isMagic(IT[it.id])});toast(`${p.name} is in the loot pool`);render()},
  'loot-edit':b=>{S.area='library';S.lib.cat='presets';S.lib.pick=b.dataset.v||null;render()},
  'loot-new':()=>{const p={id:'l'+Date.now(),name:'New chest',note:'',items:[]};LOOT.push(p);saveLoot();S.lib.pick=p.id;render();$('[data-loot=name]')?.select()},
  'loot-del':()=>askYes('Delete this preset?','','Delete',()=>{LOOT.splice(LOOT.findIndex(x=>x.id===S.lib.pick),1);saveLoot();S.lib.pick=null;render()}),
  'loot-rm':b=>{curLoot().items.splice(+b.dataset.k,1);saveLoot();render()},
  'loot-gold':()=>{const n=parseInt($('#lgold').value)||0;if(n>0){lootAdd('gold-coins',n);render()}},
  'loot-custom':()=>{const n=$('#lcname').value.trim();if(!n)return;lootAdd(customItem(n,{slots:+$('#lcslots').value||1,text:$('#lctext').value.trim()||undefined}),1);render()},
  mfam:b=>{S.mon.fam=b.dataset.v;render()}, mpick:b=>{S.mon.pick=b.dataset.v;render()},
  tpick:b=>{S.tbl.pick=b.dataset.v;S.tbl.roll=null;render()},
  troll:()=>{const t=TB[S.tbl.pick];if(t.rows[0][1]==='d6'){const a=d(6),b2=d(6);S.tbl.roll={r:`${a}·${b2}`,row:t.rows.slice(1).find(r=>+r[0]===a&&+r[1]===b2)}}else S.tbl.roll=rollTable(S.tbl.pick,+S.tbl.mod||0);render()},
  tgo:b=>{S.area='library';S.lib.cat='tables';S.tbl.pick=b.dataset.v;S.tbl.roll=null;render()},
  rpace:b=>{S.rtravel.pace=b.dataset.v;render()},
  rmod:b=>{const R=S.rtravel,k=b.dataset.v;if(b.type==='radio'){[...RT_GUIDE,...RT_BACK].forEach(([g])=>delete R.mods[g]);R.mods[k]=true}else R.mods[k]=b.checked;if(k==='shelter3'&&!b.checked&&R.camp==='ruin')R.camp=null;render()},
  rguide:()=>{[...RT_GUIDE,...RT_BACK].forEach(([g])=>delete S.rtravel.mods[g]);render()},
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
  rnextday:()=>{const R=S.rtravel,T=rtDay();for(const v of VILLAGES)v.day=Math.min(20,v.day+1);saveVillages();const due=VILLAGES.filter(v=>v.day>=20);if(due.length)setTimeout(()=>toast(`Day 20 in ${due.map(v=>v.name).join(', ')} — end the cycle on Session → Villages`),2900);S.rtravel={day:R.day+1,pace:R.pace,mods:{},checks:[],restChecks:[],lost:T.lost&&!T.foundEnd,camp:null};render();scrollTo(0,0);toast(`Day ${R.day+1}${S.rtravel.lost?' — still lost':''}`)},
  rmt:b=>{S.rmi[b.dataset.k]={t:+b.dataset.v};render()},
  rmroll:b=>{miRoll(PARTY[+b.dataset.k]);render()},
  rmundo:b=>{miUndo(PARTY[+b.dataset.k]);render()},
  prosp:b=>{S.village.prosperity=Math.max(-10,Math.min(10,S.village.prosperity+ +b.dataset.d));render()},
  xph:b=>{const h=PARTY[+b.dataset.c].haul[+b.dataset.k];h.skip=!b.checked;render()},
  xpgive:()=>{const xp=S.xp,haul=PARTY.flatMap(c=>(c.haul||[]).filter(h=>!h.skip)),all=Math.floor(haul.reduce((a,h)=>a+(h.val??IT[h.id].price??0)*h.n*(1+[0,.3,.2,.1][+h.g||0]),0))+xp.rows.reduce((a,[n,val,g])=>a+Math.floor((+val||0)*(1+[0,.3,.2,.1][+g||0])),0),each=Math.floor(all/xp.players);
    askYes(`Give ${each} XP to each crow?`,`${all} gc of treasure ÷ ${xp.players} players. The listed treasure is cleared.`,'Give XP',()=>{for(const c of PARTY){c.xpBank=(c.xpBank||0)+each;c.haul=[]}xp.rows=[];toast(`+${each} XP each — counts after the next rest`);render()})},
  xpadd:()=>{S.xp.rows.push(['',0,0]);render()},
  xpdel:b=>{S.xp.rows.splice(+b.dataset.k,1);render()},
  settings:()=>settingsDialog(),
};
document.addEventListener('click',e=>{
  const pe=e.target.closest('.pop');panelNav=!!(e.target.closest('#panel')||pe&&pops.find(x=>x.el===pe)?.term.closest('#panel'));
  const t=e.target.closest('.term');
  if(t&&!e.target.closest('[data-action]:not(.term)')){e.preventDefault();
    if(lastPointer==='touch'){const own=pops.find(x=>x.term===t);if(!own){openPop(t);return}}
    openPanel({t:'rule',k:t.dataset.term});return}
  const b=e.target.closest('[data-action]');
  if(!b){if(!e.target.closest('.pop'))closePops(0);if(spFor&&!e.target.closest('#searchPop'))closeSlotSearch();return}
  const f=A[b.dataset.action];if(!f)return;
  if(b.tagName==='A'||b.tagName==='BUTTON'&&b.type!=='submit')e.preventDefault();
  if(b.type==='checkbox'||b.tagName==='SELECT'||b.type==='number'||b.type==='text'||b.type==='search')return;
  f(b);
});
document.addEventListener('change',e=>{const b=e.target;
  if(b.dataset.petGive!=null&&b.value){const c=ME,p=c[b.dataset.kind||'pets'][+b.dataset.petGive],i=c.inv.find(x=>x.uid===+b.value);let pos=-1;for(let k=0;k<p.len.pack;k++)if(!canPlace(p,i.id,'pack',k)){pos=k;break}
    if(pos<0){toast(`${p.name} has no room for ${nm(i)}`);return render()}c.inv=c.inv.filter(x=>x!==i);i.sec='pack';i.idx=pos;i.lit=false;i.worn=false;p.inv.push(i);toast(`${nm(i)} → ${p.name}`);return render()}
  if(b.dataset.petName!=null){ME.pets[+b.dataset.petName].name=b.value||MON[ME.pets[+b.dataset.petName].mon].name;return render()}
  if(b.dataset.hireName!=null){ME.hires[+b.dataset.hireName].name=b.value;return render()}if(b.dataset.lootU!=null){curLoot().items[+b.dataset.lootU].u=b.checked;saveLoot();return}if(b.dataset.lootN!=null){curLoot().items[+b.dataset.lootN].n=Math.max(1,+b.value||1);saveLoot();return render()}const a=b.dataset.action;const s=S.sell;
  const V=()=>VILLAGES.find(x=>x.id===S.vsel)||VILLAGES[0],sv=fn=>()=>{fn();saveVillages();render()};
  const m={kw:A.kw,vhere:()=>{S.here=b.value;saveVillages();render()},buyx:()=>{S.buy.x[b.dataset.v]=b.checked;render()},selto:()=>{S.sell.to[b.dataset.uid]=b.value;render()},
   gmode:()=>{S.gamble.game=b.value;S.gamble.pick=b.value==='ou'?'over':'1';render()},gpick:()=>{S.gamble.pick=b.value},gbet:()=>{S.gamble.bet=+b.value},fundn:()=>{(S.fundn??={})[b.dataset.k]=+b.value},
   nvpreset:()=>{S.newv.preset=b.value;render()},nvextra:()=>{S.newv.extra=b.value},nvname:()=>{S.newv.name=b.value},nvhome:()=>{S.newv.home=b.checked},
   vname:sv(()=>V().name=b.value||V().name),vhome:sv(()=>{if(b.checked)VILLAGES.forEach(x=>x.home=false);V().home=b.checked}),vstew:sv(()=>V().inst[b.dataset.k].steward=b.value),vclosed:sv(()=>V().inst[b.dataset.k].closed=b.checked),vq:sv(()=>(V().q??={})[b.dataset.k]=b.value),vnote:sv(()=>V().note=b.value),
   buyq:()=>{S.buy.q=Math.max(1,+b.value||1);render()},'pet-pick':()=>{S.petPick=b.value},'hire-pick':()=>{S.hirePick=b.value},rlore:()=>{S.rest.loreExp=b.value},lvexp:()=>A.lvexp(b),rplus:()=>{S.rest.plus=b.checked;render()},rcrafty:()=>{S.rest.crafty=b.checked;render()},rrat:()=>{S.rest.ration=b.checked},rpart:()=>{S.rest.part=b.value},rsize:()=>{S.rest.size=+b.value},
    sel:()=>{s.sel[b.dataset.uid]=b.checked?findInst(b.dataset.uid).count:0;render()},selq:()=>{s.sel[b.dataset.uid]=Math.max(0,Math.min(findInst(b.dataset.uid).count,+b.value||0));render()},selv:()=>{s.val[b.dataset.uid]=b.value;render()},selg:()=>{s.greed[b.dataset.uid]=+b.value;render()},
    'dt-len':()=>{S.dt.len=+b.value;S.dt.left=Math.min(S.dt.left,S.dt.len*60);render()},'dt-dun':()=>{S.dt.dungeon=b.value},'dt-crowd':()=>{S.dt.crowded=b.checked;render()},'dt-chaos':()=>{S.dt.chaos=b.checked;render()},
    rmod:()=>A.rmod(b),tmod:()=>{S.tbl.mod=+b.value},
    xpn:()=>{S.xp.rows[b.dataset.k][0]=b.value},xph:()=>A.xph(b),xphv:()=>{PARTY[+b.dataset.c].haul[+b.dataset.k].val=+b.value;render()},xphg:()=>{PARTY[+b.dataset.c].haul[+b.dataset.k].g=+b.value;render()},xpv:()=>{S.xp.rows[b.dataset.k][1]=+b.value;render()},xpg:()=>{S.xp.rows[b.dataset.k][2]=+b.value;render()},xpp:()=>{S.xp.players=Math.max(1,+b.value);render()}}[a];
  if(m)m();});
document.addEventListener('input',e=>{const b=e.target;
  if(b.dataset.action==='mq'){S.mon.q=b.value;const pos=b.selectionStart;render();const n=$('[data-action=mq]');n.focus();n.setSelectionRange(pos,pos)}
  if(b.dataset.action==='lq'){S.lib.q=b.value;const pos=b.selectionStart;render();const n=$('[data-action=lq]');n.focus();n.setSelectionRange(pos,pos)}
  if(b.dataset.loot){curLoot()[b.dataset.loot]=b.value;saveLoot()}
  if(b.dataset.b){S.b[b.dataset.b]=b.value;$('#btabs').outerHTML=bTabsHTML()}
  if(b.dataset.action==='tq'){S.tbl.q=b.value;const pos=b.selectionStart;render();const n=$('[data-action=tq]');n.focus();n.setSelectionRange(pos,pos)}
  if(b.id==='ridx'){P.stack[P.i].q=b.value;$('#ridxr').innerHTML=rulesResults(b.value)}});
document.addEventListener('submit',e=>{const f=e.target;if(f.method==='dialog')return;e.preventDefault();
  if(f.dataset.form==='xp'){const n=parseInt(f.n.value)||0;if(n>0){ME.xpBank=(ME.xpBank||0)+n;toast(`+${n} XP after your next rest`);render()}return}
  if(f.dataset.form==='dmg'){let n=parseInt(f.n.value)||0;if(n<=0)return;const piercing=f.p.checked;let log=[];
    if(!piercing){for(const src of adSources(ME)){if(!n)break;const have=adOf(ME,src),take=Math.min(have,n);src.ad=have-take;n-=take;if(take)log.push(`${IT[src.id].name} AD −${take}`)}}
    const st=Math.min(ME.stamina,n);ME.stamina-=st;n-=st;if(st)log.push(`Stamina −${st}`);
    if(n>0){S.pendingWounds=n;S.tab.crow='inventory';log.push(`${n} wound${n>1?'s':''} to mark in your backpack`)}toast(log.join(' · ')||'No damage');render()}
  if(f.dataset.form==='mdmg'){const x=S.combat.find(c=>c.uid===+f.dataset.uid);let n=parseInt(f.n.value)||0;const a=Math.min(x.ad||0,n);x.ad=(x.ad||0)-a;n-=a;x.st=Math.max(0,x.st-n);if(!x.st)toast(`${MON[x.id].name} is down`);render()}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(pops.length)return closePops(0);if(spFor)return closeSlotSearch();if(S.placing||S.moving){S.placing=null;S.moving=null;return render()}if(document.body.classList.contains('panel-open'))closePanel()}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.slot.empty')){e.preventDefault();A.slot(e.target)}
});
addEventListener('scroll',()=>{closePops(0);hidePreview()},{passive:true});

/* ================= dialogs ================= */
function settingsDialog(){const dl=$('#dlg');const th=store.get('theme')||'dark',fs=+(store.get('fs')||18),fo=store.get('font')||'atkinson';
  dl.innerHTML=`<form method="dialog"><h2>Display</h2><p class="muted small">Saved on this device.</p>
   <p><b>Theme</b><br><span class="seg" style="background:var(--panel)">${[['dark','Dark'],['light','Bone'],['contrast','High contrast']].map(([k,l])=>`<button type="button" data-set="theme" data-v="${k}" aria-pressed="${th===k}">${l}</button>`).join('')}</span></p>
   <p><b>Text size</b> <span id="fsv">${fs}px</span><br><input type="range" min="16" max="26" value="${fs}" id="fsr" style="width:100%" aria-label="Text size"></p>
   <p><b>Font</b><br><span class="seg" style="background:var(--panel)">${[['atkinson','Atkinson Hyperlegible'],['system','System']].map(([k,l])=>`<button type="button" data-set="font" data-v="${k}" aria-pressed="${fo===k}">${l}</button>`).join('')}</span></p>
   <div class="row" style="justify-content:flex-end"><button class="btn primary">Done</button></div></form>`;
  dl.onclose=null;dl.onclick=e=>{const b=e.target.closest('[data-set]');if(!b)return;store.set(b.dataset.set,b.dataset.v);applySettings();$$(`[data-set=${b.dataset.set}]`,dl).forEach(x=>x.setAttribute('aria-pressed',x===b))};
  $('#fsr').oninput=e=>{store.set('fs',e.target.value);$('#fsv').textContent=e.target.value+'px';applySettings()};dl.showModal()}
function applySettings(){const r=document.documentElement;r.dataset.theme=store.get('theme')||'dark';r.dataset.font=store.get('font')||'atkinson';r.style.setProperty('--fs',(store.get('fs')||18)+'px')}

/* ================= boot ================= */
function route(){const h=location.hash;let m;
  if((m=h.match(/^#rule\/([\w-]+)/))&&(GLOSS[m[1]]||BOOK[m[1]]))openPanel({t:'rule',k:m[1]});
  else if((m=h.match(/^#item\/([\w-]+)/))&&IT[m[1]])openPanel({t:'item',id:m[1]});
  else if((m=h.match(/^#mon\/([\w-]+)/))&&MON[m[1]])openPanel({t:'mon',id:m[1]})}
vTipsInit();applySettings();render();route();addEventListener('hashchange',route);
