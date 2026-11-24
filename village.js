/* The player's Village screen (bar button "Village", key market) — Village B, chosen by the owner (QA/2026-11-14-village-b.md).
   "What do you want to do?": four cards (Sell loot, Buy, Rest at the inn, Services), a row of goods that are often needed, and quiet links
   (Invest, where the party is, how villages work, the institutions here). Each card opens one focused view with a way back.
   Rules and money stay in app.js: stockOf/priceSteps/dobuy → S.placing → finishPlace (buying), saleOf/dosell (selling), svc (services,
   the inn's night), fund (investing), the Rest screen (resting). View state only: S.mkt ('' | buy | sell | svc | invest), S.mktAt, S.vbWhere,
   S.buy, S.sell, S.vbOft (the open Often needed tile) — none of it is in snap(). Unidentified items go through shown(): no name, no value,
   no buyer. Often needed (owner, 2026-11-16): a tap opens − n + and Buy on the tile itself; Buy goes through the same dobuy with that
   quantity, up to a stack and what you can pay. */
const VB_ICO={home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  sell:'<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v1.5M12 16v1.5"/>',
  buy:'<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',inn:'<path d="M3 20V8M3 14h18v6M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
  // Services: the counter bell (Lucide “concierge-bell”, ISC); the old blade was the Actions' crutch (owner, 2026-11-23)
  svc:'<path d="M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1z"/><path d="M20 16a8 8 0 1 0-16 0"/><path d="M12 4v4M10 4h4"/>',back:'<path d="M15 6l-6 6 6 6"/>'};
const vbIco=(k,cls='vb-ico')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${VB_ICO[k]}</svg>`;
// Often needed: common gear, in this order, as far as this village sells it now
const VB_OFTEN=['torch','ration','rope','lantern','oil-flask','candle','chalk','animal-feed'];
const VB_VIEWS={buy:'Buy',sell:'Sell loot',svc:'Services',invest:'Invest'};
const vbBuy=()=>S.buy??={pick:null,q:1,x:{},f:'',k:''};
// What the player can sell here, row by row; loot = treasure with a buyer and a known value (ticked when Sell loot opens). A stack with
// pieces the Ref has not valued yet offers the valued ones (q0: they come first, valsOf); the rest wait for “Value the Ref gave”.
function vbSellable(v){return ME.inv.filter(i=>!isPurse(i)&&i.id!=='gold-coins').map(i=>{const a=refPriced(i)&&!i.unid?valSum(i):null,q0=a&&a.miss&&a.known?a.known:(i.count||1),o=saleOf(v,i,q0);return {i,...o,q0,loot:o.it.cat==='treasure'&&!!o.k&&o.base!=null}})}
function vbPrefill(v){const s=S.sell;if(Object.values(s.sel).some(Boolean))return;for(const x of vbSellable(v))if(x.loot)s.sel[x.i.uid]=x.q0}
function vbOften(v){const st=stockOf(v);return VB_OFTEN.map(id=>st.find(s=>s.it.id===id)).filter(Boolean).slice(0,5)}
// one of it here, as dobuy charges it (the auction house's mark-up or discount included); how many one tap may buy: a stack, what you can pay
const vbEach=(v,s)=>{const p=priceSteps(v,s.it).each;return s.k==='auction'?Math.ceil(p*s.a.mult):p};
const vbMax=(v,s,have)=>{const e=vbEach(v,s);return Math.max(0,Math.min(s.it.stack||1,Math.floor(have/e),s.k==='auction'?s.a.left:99))};
// the Often needed tile: closed, a button; open, the quantity and Buy right there
function vbOftHTML(v,s,have){const e=vbEach(v,s),nm=esc(s.it.name),o=S.vbOft;
  if(o?.id!==s.it.id)return `<button class="vb-qb" data-action="vqopen" data-v="${s.it.id}" ${e>have?`disabled title="You carry ${gc(have)}"`:''} aria-label="${nm}, ${gc(e)} each${e>have?` — you carry ${gc(have)}`:': choose how many'}">${inventoryIcon(s.it,'vb-art')}<span>${nm}</span><span class="p">${gc(e)}</span></button>`;
  const max=vbMax(v,s,have),q=o.q=Math.max(1,Math.min(o.q||1,max||1)),why=max>=(s.it.stack||1)?(max>1?`up to ${max}: one stack`:'one fills a slot'):`up to ${max}: you carry ${gc(have)}`;
  return `<div class="vb-qb vb-qopen" role="group" aria-label="Buy ${nm}" data-v="${s.it.id}">
    <span class="vb-qhd">${inventoryIcon(s.it,'vb-art')}<span><b>${nm}</b><small>${gc(e)} each · ${why}</small></span><button class="xbtn vb-qx" data-action="vqx" aria-label="Close (Esc)" title="Close (Esc)">✕</button></span>
    <span class="vb-qrow"><span class="vb-qn"><button type="button" data-action="vqn" data-v="-1" ${q<=1?'disabled':''} aria-label="One fewer">−</button><output aria-live="polite" aria-label="How many">${q}</output><button type="button" data-action="vqn" data-v="1" ${q>=max?'disabled':''} aria-label="One more">+</button></span>
     <button class="btn primary vb-qbuy" data-action="vquick" data-v="${s.it.id}" ${max?'':'disabled'}>Buy ${q} for ${gc(e*q)}</button></span></div>`}
const vbNoBuyer=it=>{const b=buyersOf(it);return b.length?`only ${b.map(k=>INST[k].n).join(' or ')} buys this — none here`:'no one here buys this'};

SCREENS.market=()=>{const v=vHere();
  if(!VILLAGES.length)return `${whereHTML()}<div class="box"><p>No village yet. The Ref creates your village in <b>Run game → Villages</b>.</p><button class="btn primary" data-action="go-villages">Set up a village</button></div>`;
  if(!v)return `${whereHTML()}<p class="muted">You’re on the road. Trade, services and investing open when the party is in a village.</p>`;
  if(S.mkt&&S.mktAt&&S.mktAt!==v.id)S.mkt=''; // another village: start from its square
  const t=VB_VIEWS[S.mkt]?S.mkt:'';
  if(!t)return vbHubHTML(v);
  return `<div class="vb vb-sub"><button class="vb-back" data-action="vgo" data-v="">${vbIco('back')} What to do in ${esc(v.name)}</button>
   <h2 class="vb-title" id="vb-title" tabindex="-1">${t==='invest'?`Invest in ${esc(v.name)}`:VB_VIEWS[t]}${t==='sell'?` <span class="muted">${v.home?`merchants pay ${salePctAt(v)}%`:'away from home merchants pay 20%'} · each item goes to the best buyer here</span>`:''}</h2>
   ${({buy:buyHTML,sell:vbSellHTML,svc:svcHTML,invest:investHTML}[t])(v)}</div>`};

function vbHubHTML(v){if(S.vbOft&&!vbOften(v).some(s=>s.it.id===S.vbOft.id))S.vbOft=null;const c=ME,L=k=>lvlOf(v,k),st=stockOf(v),mer=[...new Set(st.map(s=>s.k))],loot=vbSellable(v).filter(x=>x.loot),sum=loot.reduce((a,x)=>a+x.pay,0),B=vbBuy();
  const inn=L('inn'),bet=inn?INST.inn.val[Math.min(inn,5)-1]+v.prosperity:0,paid=!v.home&&c.innFood;
  const svc=[L('temple')&&`Temple: heal wounds <b>100 gc</b> (you have ${c.wounds.size})`,L('blacksmith')&&'Blacksmith: repair <b>5 gc</b>',L('alchemist')&&'Alchemist: identify <b>10 gc</b>',
    inn&&`Inn: gamble, bet up to <b>${bet} gc</b>`,L('enchanter')&&'Enchanter: workshop <b>5 gc</b>',L('barracks')&&'Barracks: hirelings',L('stables')&&'Stables: pets',L('crypt')&&'Crypt: a fallen crow’s boon'].filter(Boolean);
  const often=vbOften(v),have=coinsOf(c);
  const insts=Object.keys(INST).filter(k=>v.inst[k]?.lvl).map(k=>{const l=L(k);return `<a class="term" data-term="vi-${k}" href="#rule/${INST[k].rule}">${INST[k].n} ${l?ORD(l):'closed'}</a>`});
  return `<div class="vb">
   <div class="vb-head"><h2 class="vb-name sr">${esc(v.name)}</h2><div class="vb-facts"><span>${v.home?'Card prices':'+20% when you buy'}</span><span>Prosperity <b>${fmt(v.prosperity)}</b></span><span>Merchants pay <b>${salePctAt(v)}%</b></span><span>Cycle day <b>${v.day}</b>/20</span><span>You carry <b>${gc(have)}</b></span></div></div>
   <h3 class="vb-ask">What do you want to do?</h3>
   <div class="vb-cards">
    <button class="vb-card${loot.length?' hot':''}" data-action="vgo" data-v="sell"><span class="h">${vbIco('sell')} Sell loot</span>${loot.length?`<span class="vb-badge"><i aria-hidden="true"></i>${loot.length} treasure${loot.length>1?'s':''} waiting</span><span class="s">${loot.map(x=>esc(x.it.name)).join(', ')} · about <b>${sum} gc</b>. Merchants pay <b>${salePctAt(v)}%</b>.</span>`:`<span class="s">No treasure waiting. Sell anything a merchant here deals in: they pay <b>${salePctAt(v)}%</b>.</span>`}<span class="go">Sell →</span></button>
    <div class="vb-card vb-buy"><button class="h" data-action="vgo" data-v="buy">${vbIco('buy')} Buy <span class="go">→</span></button><span class="s"><b>${st.length}</b> goods from ${mer.map(k=>INST[k].n).join(', ')||'no merchant'}.</span><input type="search" id="vb-q" value="${esc(B.f)}" placeholder="What do you need? torch, rope…" aria-label="Find an item to buy" autocomplete="off"></div>
    <button class="vb-card" data-action="vgo" data-v="svc"><span class="h">${vbIco('svc')} Services</span><span class="s">${svc.length?svc.slice(0,3).join(' · ')+(svc.length>3?' · and more':'')+'.':'No services here.'}</span><span class="go">Choose →</span></button>
    <button class="vb-card" data-action="vrest"><span class="h">${vbIco('inn')} ${inn?'Rest at the inn':'Rest in the village'}</span><span class="s">${inn&&v.inst.inn?.steward?esc(v.inst.inn.steward)+' · ':''}${v.home?'Free at home, food included':!inn?'No inn here: sheltered, on your own ration':paid?'Your night is paid, food included':have<5?'You can’t pay the inn (<b>5 gc</b>): sheltered, on your own ration':'A bed and a day’s food: <b>5 gc</b>'}. Stamina back, a wound heals, Effort back.</span><span class="go">${!v.home&&inn&&!paid&&have>=5?'Rest · 5 gc →':'Rest →'}</span></button>
   </div>
   ${often.length?`<section class="vb-often" aria-labelledby="vb-often-h"><h3 class="vb-ask" id="vb-often-h">Often needed <span class="muted">tap, choose how many, buy</span></h3><div class="vb-quick">${often.map(s=>vbOftHTML(v,s,have)).join('')}</div></section>`:''}
   <div class="vb-quiet"><button class="vb-link" data-action="vgo" data-v="invest">Invest in ${esc(v.name)} →</button>${canMove()?`<button class="vb-link" data-action="vwhere" aria-expanded="${!!S.vbWhere}">Not in ${esc(v.name)}?</button>`:''}<a class="vb-link" href="#rule/c-the-village" data-action="open-rule" data-k="c-the-village">How villages work</a></div>
   ${S.vbWhere&&canMove()?whereHTML():''}
   ${insts.length?`<p class="vb-inst small">In ${esc(v.name)}: ${insts.join(' · ')}</p>`:''}</div>`}

function vbSellHTML(v){const s=S.sell,rows=vbSellable(v);let tot=0,n=0;const lines=[],miss=[];
  for(const x of rows){const q=s.sel[x.i.uid];if(!q||!x.k)continue;const o=saleOf(v,x.i,q,true);if(o.pay==null){miss.push(o.it.name);continue}tot+=o.pay;n++;lines.push([x.i,o])}
  const row=x=>{const i=x.i,q=s.sel[i.uid]||0,can=!!x.k,o=q?saleOf(v,i,q,true):x,where=`${SEC_NAME[i.sec]} ${i.idx+1}`;
    const sub=(i.unid?'Unidentified — identify it before you sell':!can?vbNoBuyer(x.it):`to ${x.k==='auction'?'the Auction House':INST[x.k].n} · ${where}`)+(!i.unid&&Array.isArray(i.vals)?` · ${valWords(i)}; the most valuable sell first`:'');
    const pr=!can||o.base==null?(can&&!i.unid?'<span class="small muted">value?</span>':'—'):o.pay==null?`<span class="small muted">1d10 × ${10+v.prosperity}%</span><small>of ${gc(o.base)}</small>`:`<b>${o.pay} gc</b><small>of ${gc(o.base)}</small>`;
    return `<div class="vb-row${can?'':' dim'}"><label class="vb-tick"><input type="checkbox" data-action="sel" data-uid="${i.uid}" ${q?'checked':''} ${can?'':'disabled'} aria-label="Sell ${esc(x.it.name)}">${inventoryIcon(x.it,'vb-art')}<span class="n">${esc(x.it.name)}${i.count>1?' ×'+i.count:''}<small>${sub}</small></span></label>
     <span class="vb-in">${q&&i.count>1?`<label class="small">How many <input type="number" min="1" max="${i.count}" value="${q}" data-action="selq" data-uid="${i.uid}"></label>`:''}${q&&can&&!i.unid&&o.miss?`<label class="small">${o.miss<o.q?`Value of the ${o.miss} not valued yet${o.miss>1?', each':''}`:`Value the Ref gave${o.miss>1?', each':''}`} <input type="number" min="0" placeholder="gc" value="${esc(s.val[i.uid]||'')}" data-action="selv" data-uid="${i.uid}"></label>`:''}</span>
     <span class="vb-pr">${pr}</span></div>`};
  const rc=lines.map(([i,o])=>{const alt=o.opts.length>1?(o.k==='auction'?o.opts[0]:o.opts.includes('auction')?'auction':null):null;
    return `<tr><td>${esc(o.it.name)}${o.q>1?' ×'+o.q:''}<div class="small muted">${o.q>1?(o.val!=null?`${o.val} × ${o.q} = `:`${o.parts.join(' + ')} = `):''}${o.base} gc${o.g?` + greed ${[0,30,20,10][o.g]}% = ${o.wg}`:''} × ${o.pct}% · ${o.k==='auction'?`Auction House (d10 × ${10+v.prosperity}%)`:INST[o.k].n}</div>${alt?`<button class="vb-link small" data-action="vbto" data-uid="${i.uid}" data-v="${alt}">${alt==='auction'?'Auction House instead':`Back to ${INST[alt].n}`}</button>`:''}</td><td class="nw">${o.pay} gc</td></tr>`}).join('');
  return `<div class="vb-step"><div class="box vb-list">${rows.map(row).join('')||'<p class="muted">You carry nothing to sell.</p>'}</div>
   <div class="box vb-rc"><h3 class="vb-ask">Receipt</h3>${lines.length?`<table class="rt receipt">${rc}<tr class="tot"><td>You get</td><td class="nw">${tot} gc</td></tr></table>
     <details class="fold vb-greed" data-fold="vgreed"${foldOpen('vgreed')}><summary>Found in a dungeon turn? <a class="term" href="#rule/greed" data-term="greed">Greed</a> bonus</summary>
      ${lines.map(([i,o])=>`<label class="fld"><b>${esc(o.it.name)}</b><select data-action="selg" data-uid="${i.uid}" aria-label="Greed bonus for ${esc(o.it.name)}">${['Not in the first three DTs','DT 1 (+30%)','DT 2 (+20%)','DT 3 (+10%)'].map((l,k)=>`<option value="${k}" ${o.g===k?'selected':''}>${l}</option>`).join('')}</select></label>`).join('')}</details>`:'<p class="muted">Tick what you sell to see what you get.</p>'}
    ${miss.length?`<p class="small vb-miss">Enter the value the Ref gave for ${miss.map(esc).join(', ')}.</p>`:''}
    <button class="btn primary vb-go" data-action="dosell" ${n&&!miss.length?'':'disabled'}>${n?`Sell ${n} for ${tot} gc`:'Sell'}</button></div></div>`}

Object.assign(A,{
  vgo:b=>{const v=vHere(),k=b.dataset.v||'',was=S.mkt||'';if(!v)return;if(k==='sell')vbPrefill(v);if(was==='buy'&&k!=='buy')vbDropPick();S.mkt=k;S.mktAt=v.id;S.vbWhere=false;S.vbOft=null;render();scrollTo(0,0);
    (k?$('#vb-title'):$(`#main [data-action=vgo][data-v="${was}"]`)||$('#main .vb-card'))?.focus({preventScroll:true})}, // keyboard: the new view's title; back: the card it came from
  // Often needed: open a tile's quantity (focus on its Buy), change it, close it (✕ or Esc, focus back on the tile)
  vqopen:b=>{S.vbOft={id:b.dataset.v,q:1};render();$('#main .vb-qopen .vb-qbuy')?.focus({preventScroll:true})},
  vqn:b=>{const o=S.vbOft;if(!o)return;o.q=(o.q||1)+(+b.dataset.v);render();($(`#main .vb-qopen [data-action=vqn][data-v="${b.dataset.v}"]:not([disabled])`)||$('#main .vb-qopen .vb-qbuy'))?.focus({preventScroll:true})},
  vqx:()=>{const id=S.vbOft?.id;S.vbOft=null;render();$(`#main .vb-qb[data-v="${id}"]`)?.focus({preventScroll:true})},
  // Buy: that many, no extras, into the existing buy flow (dobuy → S.placing → tap a slot → finishPlace pays as it goes in).
  // The Buy view's own pick is left as it was.
  vquick:b=>{const v=vHere(),B=vbBuy(),s=v&&vbOften(v).find(x=>x.it.id===b.dataset.v);if(!s)return;const q=Math.max(1,Math.min(S.vbOft?.id===s.it.id?S.vbOft.q:1,vbMax(v,s,coinsOf(ME))||1)),was={pick:B.pick,q:B.q,x:B.x};
    S.vbOft=null;Object.assign(B,{pick:s.it.id,q,x:{}});A.dobuy(b);Object.assign(B,was)},
  // the Rest screen, indoors; away from home its one button pays the inn's night (5 gc, food included) as the rest is finished
  vrest:()=>{const v=vHere(),c=ME;if(!v||!c)return;S.rest.where='clear';S.tab.crow='rest';if(S.hud){S.hud.dmg=false;S.hud.inv=false}
    render();scrollTo(0,0)},
  // the Rest screen's Gamble activity: the games are on the inn's card in Services
  vgamble:()=>{if(!vHere())return;S.tab.crow='market';A.vgo({dataset:{v:'svc'}});$('#main [data-action=gamble]')?.scrollIntoView({block:'center'})},
  vbto:b=>{S.sell.to[b.dataset.uid]=b.dataset.v;render()},
  vwhere:()=>{S.vbWhere=!S.vbWhere;render()}});
// leaving Buy forgets the card picked there (owner, 2026-11-16)
function vbDropPick(){if(S.buy)Object.assign(S.buy,{pick:null,q:1,x:{}})}
// The bar's Village button on the Village screen goes back to its square, like the back link (owner, 2026-11-16).
{const view0=A.view;A.view=b=>{if(b.dataset.v==='market'&&S.area==='crow'&&S.tab.crow==='market'&&(S.mkt||S.vbOft)){const was=S.mkt;if(was==='buy')vbDropPick();S.mkt='';S.vbOft=null;S.vbWhere=false}view0(b)}}
// the square's search field is the Buy view's: the first letter opens Buy with the caret where it was
document.addEventListener('input',e=>{if(e.target.id!=='vb-q')return;const pos=e.target.selectionStart;vbBuy().f=e.target.value;buyKeepPick();S.mkt='buy';S.mktAt=S.here;S.vbOft=null;render();const n=$('#buyf');if(n){n.focus();n.setSelectionRange(pos,pos)}});
document.addEventListener('keydown',e=>{if(e.target.id==='vb-q'&&e.key==='Enter'){e.preventDefault();A.vgo({dataset:{v:'buy'}})}
  if(e.key==='Escape'&&S.vbOft&&$('#main .vb-qopen')&&!$('dialog[open]')&&!invShown()){e.preventDefault();A.vqx()}});
