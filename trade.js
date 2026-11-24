/* Trade on the road (owner, 2026-11-23; QA/2026-11-22-feedback.md, item 7). Two road encounters trade in the rules:
   - the Merchant caravan (The Ref: Merchant): it sells as its institution and level, and buys at the 1d10 × 10% the Ref rolled;
   - the Miasma-touched Cultists (Miasma-Touched Encounters 23–32): they trade “anything in their possession” for spellbooks,
     necromancy first. Their possessions are the Equipment and Spellbooks of the stat blocks rolled on Miasma-Touched Humans.
     The rules give no coin and no rate: the card prices are shown only as a guide.
   The trade opens from the encounter card on the Journey into a drawer that takes Party loot's place in the Inventory, beside
   Equipment and Backpack (the Witcher 3 / Diablo II vendor layout, built from the loot drawer's rows). Players act on their own
   crow, with no confirmation from the Ref (owner): every deal is one Journal entry, so its toast has Undo.
   S.trade is this device's view only ({k: the stop, tab, q, f, ask, give, hide}); it never enters snap(). What a player took from
   the cultists rides on the crow (c.took: {k: day:stop, got: {id: n}, gave: [names]}), so every device can count what is left. */
const TR_KIND={weapon:'Weapon',armor:'Armor',gear:'Gear',ammo:'Ammo',alchemy:'Alchemy',spellbook:'Spellbook',magic:'Magic',material:'Material',treasure:'Treasure'};
const TR_CATS={weapon:'Weapons',armor:'Armor',gear:'Gear',ammo:'Ammo',alchemy:'Alchemy',spellbook:'Spellbooks',magic:'Magic',material:'Materials',treasure:'Treasure'}; // the filter chips
const trKind=st=>st?.scene?.kind==='merchant'?'caravan':st?.scene?.kind==='touched'&&st.scene.goods?'cult':'';
// the trade at a shown stop of today's road, as every device sees it (the projection: the Ref's own device included)
function trStop(id){if(typeof jPub!=='function'||!S.journey?.script)return null;return (jPub().script?.stops||[]).find(st=>(!id||st.id===id)&&st.state==='shown'&&trKind(st))||null}
const trKey=st=>`${jDay()}:${st.id}`;
// the cultists' goods less what the crows took (each crow's c.took for this stop)
function trLeft(st){const g={...(st.scene.goods||{})},k=trKey(st);for(const c of PARTY)if(c.took?.k===k)for(const [id,n] of Object.entries(c.took.got||{}))g[id]=(g[id]||0)-n;
  for(const id of Object.keys(g))if(!(g[id]>0))delete g[id];return g}
// "Acid vial (5), alchemist’s tools, lore book (4; Historical Lore, Magic Lore)" → its parts, commas inside brackets kept
function trSplit(s){const out=[];let d=0,cur='';for(const ch of String(s||'')){if(ch==='(')d++;if(ch===')')d--;if(ch===','&&!d){if(cur.trim())out.push(cur.trim());cur=''}else cur+=ch}if(cur.trim())out.push(cur.trim());return out}
const trBook=b=>{const id=slugify(b)+'-book';return IT[id]?id:null};
// the stat blocks' gear and spellbooks as cards, times how many of each human; a part no card matches is left out and named
function trGoods(who){const g={},miss=[],add=(id,n)=>{g[id]=(g[id]||0)+n};
  for(const [name,k] of Object.entries(who||{})){const st=jMon(name)?.st;if(!st)continue;
    for(const p of trSplit(st.Equipment)){const sb=p.match(/^spellbooks?:\s*(.+)$/i);
      if(sb){for(const b of trSplit(sb[1])){const id=trBook(b);if(id)add(id,k);else miss.push(b)}continue}
      const q=+(p.match(/\((\d+)/)||[])[1]||1,t=p.replace(/\s*\(.*\)$/,''),r=matchItem(t)||matchItem(t.replace(/es$/i,''));
      if(r?.id&&IT[r.id])add(r.id,q*k);else miss.push(p)}
    for(const b of trSplit(st.Spellbooks)){const id=trBook(b);if(id)add(id,k);else miss.push(b)}}
  return {g,miss}}
// The Ref's device keeps each Miasma-touched stop's goods in step with its reaction: Cultists → the goods; any other → none.
// Players get them with the stop once it is shown (journey-rules sceneFor).
const trCult=st=>/^Cultists\b/.test(String(jAttRow(jAttOf(st,'miasma-touched-encounters'))?.[1]||''));
function trCultSync(){if(S.role!=='ref'||!Array.isArray(S.journey?.script?.stops))return;const fix={};
  for(const st of S.journey.script.stops){if(st.scene?.kind!=='touched')continue;const g=trCult(st)?trGoods(st.scene.who).g:null,want=g&&Object.keys(g).length?g:null;
    if(JSON.stringify(want)!==JSON.stringify(st.scene.goods||null))fix[st.id]=want}
  if(!Object.keys(fix).length)return; // the journey object changes only when a stop's goods do
  jScriptSet(sc=>{for(const st of sc.stops)if(st.id in fix){if(fix[st.id])st.scene.goods=fix[st.id];else delete st.scene.goods}});jDone()}
for(const a of ['jtouched','jattset','jattroll','jreveal']){const f=A[a];if(f)A[a]=b=>{f(b);trCultSync()}}

/* ---------- the player's encounter card: one button opens the trade ---------- */
function trOpenHTML(st){const k=trKind(st);if(!k)return '';
  return `<div class="tr-open"><button type="button" class="btn" data-action="tr-open" data-k="${esc(st.id)}">${nest(k==='cult'?'Trade with them':'Trade with the caravan')}</button><span class="small">${k==='cult'?'they want spellbooks':`buy at the card’s price · sell at ${+st.scene.pct||0}%`}</span></div>`}

/* ---------- the drawer in the Inventory, in Party loot's place ---------- */
const trRow=(it,name,meta,price,btn,cls='')=>`<div class="inv-loot-row tr-row ${cls}"><span class="inv-loot-pick">${inventoryIcon(it)}<span class="nm"><b>${name}</b><span>${meta}</span></span></span>${price==null?'':`<span class="tr-price">${price.toLocaleString('en')} gc</span>`}${btn}</div>`;
const trSlots=it=>`${it.slots||1} slot${(it.slots||1)>1?'s':''}`;
const trShell=(st,label,inner)=>`<aside class="inv-loot tr-drawer" aria-label="Trade: ${label}"><button class="inv-loot-tab has" type="button" data-action="tr-show" aria-label="Show the trade"><span>‹</span> ${label}</button>
  <section class="inv-window inv-loot-panel">${inner}</section></aside>`;
const trHead=(t,sub,tabs='')=>`<header class="inv-window-title"><h2>${t}</h2><span>${sub}</span>${tabs}<button class="xbtn" type="button" data-action="tr-hide" aria-label="Hide the trade">${NEST_SVG}</button></header>`;
function trAsideHTML(c){const T=S.trade;if(!T)return '';const st=trStop(T.k);if(!st||!c){S.trade=null;return ''}return trKind(st)==='cult'?trCultHTML(st,c,T):trCaravanHTML(st,c,T)}
function trInsts(sc){return [sc.inst,sc.inst2].filter(Boolean)}
function trStock(sc){const v={inst:Object.fromEntries(trInsts(sc).map((k,j)=>[k,{lvl:+(j?sc.lvl2:sc.lvl)}])),prosperity:0,auction:{}};
  return stockOf(v).filter(s=>trInsts(sc).includes(s.k)).map(s=>s.it).sort((a,b)=>a.price-b.price||a.name.localeCompare(b.name))}
// what this caravan buys of the crow's: the cards its institutions buy, worth something; a stack sells one at a time
const trSells=(c,sc)=>c.inv.filter(i=>{const it=shown(i);return it&&!isPurse(i)&&i.id!=='gold-coins'&&it.cat!=='unidentified'&&buyersOf(it).some(k=>trInsts(sc).includes(k))&&(valsOf(i)[0]??it.price)>0});
const trSellPrice=(i,sc)=>Math.floor((valsOf(i)[0]??shown(i).price)*(+sc.pct||0)/100);
function trCaravanHTML(st,c,T){const sc=st.scene,have=coinsOf(c),who=`${esc(sc.name)} · ${J_ORD[+sc.lvl]||''} level${sc.inst2?` + ${esc(sc.name2)}`:''}`;
  const tabs=`<div class="inv-filters tr-tabs" role="group" aria-label="Buy or sell">${[['buy','Buy'],['sell','Sell']].map(([k,l])=>`<button type="button" data-action="tr-tab" data-v="${k}" aria-pressed="${T.tab===k}">${l}</button>`).join('')}</div>`;
  if(T.tab==='sell'){const l=trSells(c,sc);
    return trShell(st,'Caravan',trHead('Caravan',who,tabs)+`<p class="tr-line">They pay <b>${+sc.pct||0}%</b> of an item’s value</p><div class="inv-loot-body">${l.map(i=>{const it=shown(i);
      return trRow(it,`${esc(nm(i))}${i.count>1?` <span>×${i.count}</span>`:''}`,`${SEC_NAME[i.sec]||i.sec} ${i.idx+1} · worth ${(valsOf(i)[0]??it.price).toLocaleString('en')} gc`,trSellPrice(i,sc),`<button type="button" class="btn" data-action="tr-sell" data-uid="${i.uid}" aria-label="Sell ${esc(nm(i))} for ${trSellPrice(i,sc)} gc">Sell</button>`)}).join('')||'<div class="inv-loot-empty">Nothing they buy.</div>'}</div>`)}
  const all=trStock(sc),cats=[...new Set(all.map(it=>it.cat))].filter(k=>TR_KIND[k]),f=cats.includes(T.f)?T.f:'',q=(T.q||'').toLowerCase().trim();
  const l=all.filter(it=>(!f||it.cat===f)&&(!q||it.name.toLowerCase().includes(q)));
  const chips=cats.length>1?`<div class="inv-filters tr-cats" role="group" aria-label="Filter the stock">${[['','All'],...cats.map(k=>[k,TR_CATS[k]])].map(([k,n])=>`<button type="button" data-action="tr-f" data-v="${k}" aria-pressed="${f===k}">${n}</button>`).join('')}</div>`:'';
  return trShell(st,'Caravan',trHead('Caravan',who,tabs)+`<div class="tr-tools"><label class="inv-search tr-search"><span aria-hidden="true">⌕</span><input id="tr-q" type="search" placeholder="Find an item" value="${esc(T.q||'')}" aria-label="Find an item to buy"></label>
    <span class="tr-have"><b>${have.toLocaleString('en')} gc</b> to spend</span></div>${chips}
    <div class="inv-loot-body">${l.map(it=>trRow(it,esc(it.name),`${TR_KIND[it.cat]||'Item'} · ${trSlots(it)}`,it.price,`<button type="button" class="btn" data-action="tr-buy" data-v="${esc(it.id)}" ${it.price>have?'disabled':''} aria-label="Buy ${esc(it.name)} for ${it.price} gc">Buy</button>`,it.price>have?'dear':'')).join('')||'<div class="inv-loot-empty">Nothing matches.</div>'}
    ${l.length?`<p class="tr-line tr-n">${l.length} of ${all.length} · cheapest first</p>`:''}</div>`)}
const trNecro=it=>/^Necromancy/i.test(it?.school||'');
function trCultHTML(st,c,T){const left=trLeft(st),ask=Object.fromEntries(Object.entries(T.ask||{}).filter(([id,n])=>n>0&&left[id]>=n)),give=c.inv.filter(i=>T.give?.[i.uid]);
  const mine=c.inv.filter(i=>!isPurse(i)&&i.id!=='gold-coins'),books=mine.filter(i=>shown(i)?.cat==='spellbook').sort((a,b)=>trNecro(shown(b))-trNecro(shown(a))),rest=mine.filter(i=>!books.includes(i));
  const giveRow=i=>{const it=shown(i),on=!!T.give?.[i.uid];return trRow(it,`${esc(nm(i))}${i.count>1?` <span>×${i.count}</span>`:''}`,it.cat==='spellbook'?(trNecro(it)?'Necromancy — they want it most':`${esc(String(it.school||'').split(' ')[0])} spellbook`):`${SEC_NAME[i.sec]||i.sec} ${i.idx+1}`,it.price??null,
    `<button type="button" class="btn" data-action="tr-give" data-uid="${i.uid}" aria-pressed="${on}">${on?'Offered ✓':'Offer'}</button>`,on?'in':'')};
  const theirs=Object.entries(left).map(([id,n])=>{const it=IT[id],on=!!ask[id];return trRow(it,`${esc(it.name)}${n>1?` <span>×${n}</span>`:''}`,`${TR_KIND[it.cat]||'Item'} · ${trSlots(it)}`,it.price,
    `<button type="button" class="btn" data-action="tr-ask" data-v="${esc(id)}" aria-pressed="${on}">${on?'Asked ✓':'Ask'}</button>`,on?'in':'')}).join('');
  const got=Object.entries(ask),sum=a=>a.reduce((s,x)=>s+(x||0),0),gv=sum(give.map(i=>shown(i).price)),gt=sum(got.map(([id,n])=>IT[id].price*n));
  const deal=`<div class="tr-deal"><div class="tr-side"><span>You give</span><b>${give.map(i=>esc(nm(i))).join(', ')||`<span class="muted">${got.length?'a favour':'nothing yet'}</span>`}</b><span>${give.length?gv.toLocaleString('en')+' gc':''}</span></div>
    <div class="tr-side"><span>You get</span><b>${got.map(([id,n])=>esc(IT[id].name)+(n>1?' ×'+n:'')).join(', ')||'<span class="muted">nothing yet</span>'}</b><span>${got.length?gt.toLocaleString('en')+' gc':''}</span></div>
    <button type="button" class="btn primary" data-action="tr-swap" ${got.length?'':'disabled'}>${give.length||!got.length?'Swap':'Take it for a favour'}</button></div>`;
  return trShell(st,'Cultists',trHead('Cultists','barter for spellbooks, <b>necromancy first</b>, or a favour')+`<div class="inv-loot-body"><h3 class="tr-h">They carry <span>· at card prices</span></h3>${theirs||'<div class="inv-loot-empty">They have nothing left to trade.</div>'}
    <h3 class="tr-h">Your spellbooks</h3>${books.map(giveRow).join('')||'<p class="tr-line">You carry no spellbook.</p>'}
    ${rest.length?`<details class="tr-more"${rest.some(i=>T.give?.[i.uid])?' open':''}><summary>${nest('Offer something else')}</summary>${rest.map(giveRow).join('')}</details>`:''}</div>${deal}`)}

/* ---------- the Ref's card: who carries what, and what the crows took ---------- */
function trRefHTML(st){const sc=st.scene;if(sc?.kind!=='touched'||!sc.goods)return '';const k=`${jDay()}:${st.id}`,{miss}=trGoods(sc.who);
  const who=Object.entries(sc.who||{}).map(([n,x])=>{const m=jMon(n)?.st||{},g=[m.Equipment,m.Spellbooks&&'books: '+m.Spellbooks].filter(Boolean).join('; ');return `<li><b>${esc(n.replace(/ \(Power \d+\)/,''))}${x>1?' ×'+x:''}</b> <span>${esc(g||'nothing')}${x>1&&g?' (each)':''}</span></li>`}).join('');
  const log=PARTY.filter(c=>c.took?.k===k).map(c=>`<li><b>${esc(c.name)}</b> <span>${c.took.gave?.length?'gave '+esc(c.took.gave.join(', ')):'a favour'} · took ${esc(Object.entries(c.took.got||{}).map(([id,n])=>(IT[id]?.name||id)+(n>1?' ×'+n:'')).join(', '))}</span></li>`).join('');
  return `<div class="tr-ref"><h4>They trade <span>for spellbooks, necromancy first</span></h4><ul class="tr-goods">${who}</ul>
    ${miss.length?`<p class="small muted" style="margin:.3rem 0 0">No card for: ${esc(miss.join(', '))}. Say it if they trade it.</p>`:''}
    <p class="small muted" style="margin:.4rem 0 0">The players trade in their Inventory while this card is open. A swap has its Undo there.</p>
    ${log?`<h4 style="margin-top:.6rem">Traded</h4><ul class="tr-goods">${log}</ul>`:''}</div>`}

/* ---------- actions ---------- */
const trNarrow=()=>{const e=document.querySelector('.inventory');return !!e&&e.clientWidth<64*parseFloat(getComputedStyle(document.documentElement).fontSize)};
Object.assign(A,{
  'tr-open':b=>{const st=trStop(b.dataset.k);if(!st)return toast('The trade is over');const c=typeof jMe==='function'&&jMe();if(c)ME=c;
    S.trade={k:st.id,tab:'buy',q:'',f:'',ask:{},give:{},hide:false};S.area='crow';S.tab.crow='inventory';render()},
  'tr-hide':()=>{if(S.trade){S.trade.hide=true;render()}},
  'tr-show':()=>{if(S.trade){S.trade.hide=false;render()}},
  'tr-tab':b=>{if(S.trade){S.trade.tab=b.dataset.v;render()}},
  'tr-f':b=>{if(S.trade){S.trade.f=b.dataset.v;render()}},
  // a purchase is the village's: the card goes to placing at its price, paid as it goes into the slot the player taps
  'tr-buy':b=>{const st=trStop(S.trade?.k),it=IT[b.dataset.v];if(!st||!it||!ME)return;if(coinsOf(ME)<it.price)return toast(`You need ${it.price} gc`);
    if(!trStock(st.scene).includes(it))return;S.placing={id:it.id,count:1,buy:it.price,trade:st.id};if(trNarrow())S.trade.hide='buy';render()},
  'tr-sell':b=>{const st=trStop(S.trade?.k),c=ME,i=c?.inv.find(x=>String(x.uid)===b.dataset.uid);if(!st||!i||!trSells(c,st.scene).includes(i))return;const p=trSellPrice(i,st.scene),name=nm(i);
    journalRun(`Sold ${name} to the caravan for ${p} gc`,[`crow:${c.id}`,'pool'],()=>{if((i.count||1)<=1)c.inv=c.inv.filter(x=>x!==i);else takeVals(i,1);const left=addCoins(c,p);
      if(left>0){S.pool.push({uid:UID++,id:'gold-coins',count:left,from:c.name});toast(`${left} gc didn’t fit in the purse: they wait in the loot pool`)}});render()},
  'tr-ask':b=>{const T=S.trade;if(!T)return;const id=b.dataset.v;T.ask={...T.ask};if(T.ask[id])delete T.ask[id];else T.ask[id]=1;render()},
  'tr-give':b=>{const T=S.trade;if(!T)return;const u=b.dataset.uid;T.give={...T.give};if(T.give[u])delete T.give[u];else T.give[u]=true;render()},
  // the swap: what the crow gives leaves the game with the cultists, what it gets goes into its slots (the pool if no room);
  // no confirmation from the Ref (owner): one Journal entry, its toast has Undo
  'tr-swap':()=>{const T=S.trade,st=trStop(T?.k),c=ME;if(!st||!c||trKind(st)!=='cult')return;const left=trLeft(st),
      got=Object.entries(T.ask||{}).filter(([id,n])=>n>0&&left[id]>=n),give=c.inv.filter(i=>T.give?.[i.uid]);if(!got.length)return toast('Ask for something first');
    const k=trKey(st),gotN=got.map(([id,n])=>IT[id].name+(n>1?' ×'+n:'')),gaveN=give.map(i=>nm(i));
    journalRun(gaveN.length?`Swapped ${gaveN.join(', ')} for ${gotN.join(', ')}`:`Took ${gotN.join(', ')} for a favour`,[`crow:${c.id}`,'pool'],()=>{
      for(const i of give){if((i.count||1)>1)takeVals(i,1);else c.inv=c.inv.filter(x=>x!==i)}
      for(const [id,n] of got){const rest=autoPlace(c,id,n);if(rest>0)S.pool.push({uid:UID++,id,count:rest,from:c.name})}
      const t=c.took?.k===k?c.took:{k,got:{},gave:[]},g={...t.got};for(const [id,n] of got)g[id]=(g[id]||0)+n;c.took={k,got:g,gave:[...(t.gave||[]),...gaveN]}});
    T.ask={};T.give={};render()}});
// a purchase from the caravan is one Journal entry (Undo gives the coins back and takes the card out); on a tablet the drawer
// stepped aside for the slots and comes back once the card is in
{const f=finishPlace;finishPlace=(sec,idx)=>{const pl=S.placing;if(!pl?.trade||!ME)return f(sec,idx);
  journalRun(`Bought ${IT[pl.id]?.name||pl.id} from the caravan for ${pl.buy} gc`,[`crow:${ME.id}`],()=>f(sec,idx));if(!S.placing&&S.trade?.hide==='buy')S.trade.hide=false;render()}}
document.addEventListener('input',e=>{if(e.target.id!=='tr-q'||!S.trade)return;S.trade.q=e.target.value;const pos=e.target.selectionStart;render();const n=$('#tr-q');if(n){n.focus();n.setSelectionRange(pos,pos)}});
