'use strict';
/* Inventory presentation only. Game state and placement rules belong to app.js.
   Draw icons from shown() data, never the hidden identity of an unidentified item. */
// Ink icons in icons/items/, matched on the shown() name; first rule wins.
// Generated from icon_pack/manifest.json: python -I tools/icon_mj_build.py install
// No rule: a placeholder cross that marks art still missing.
const INV_ICONS=[[/^magic ring$/,'unid-ring'],[/^magic wand$/,'unid-wand'],[/^potion$/,'unid-potion'],[/^unidentified item$/,'unid-item'],[/lore book/,'lore-book'],[/^journal$/,'journal'],
  [/zaziel/,'book-of-elation'],[/\bbook\b/,'spellbook'],[/bolts/,'bolts'],[/arrows/,'arrows'],[/crossbow/,'crossbow'],[/shortbow/,'shortbow'],
  [/longbow/,'longbow'],[/handaxe/,'handaxe'],[/greataxe/,'greataxe'],[/halberd/,'halberd'],[/glaive/,'glaive'],[/\baxe\b/,'axe'],
  [/greatsword/,'greatsword'],[/sword/,'sword'],[/stiletto/,'stiletto'],[/knife/,'knife'],[/flail/,'flail'],[/mace/,'mace'],
  [/maul/,'maul'],[/warpick/,'warpick'],[/hammer/,'hammer'],[/\bspear\b/,'spear'],[/\bpike\b/,'pike'],[/shield/,'shield'],
  [/heavy armor/,'heavy-armor'],[/medium armor/,'medium-armor'],[/light armor/,'light-armor'],[/greater healing potion/,'greater-healing-potion'],[/healing potion/,'healing-potion'],[/rage potion/,'rage-potion'],
  [/speed potion/,'speed-potion'],[/phasing potion/,'phasing-potion'],[/blood concoction/,'blood-concoction'],[/acid/,'acid-vial'],[/strong poison/,'strong-poison'],[/sleep poison/,'sleep-poison'],
  [/hallucinogenic/,'hallucinogenic-poison'],[/truth poison/,'truth-poison'],[/poison/,'poison-vial'],[/demolition bomb/,'demolition-bomb'],[/smoke bomb/,'smoke-bomb'],[/gas bomb/,'gas-bomb'],
  [/bomb/,'bomb'],[/oil flask/,'oil-flask'],[/glue pot/,'glue-pot'],[/^soap$/,'soap'],[/soothing candy/,'soothing-candy'],[/alteration stone/,'alteration-stone'],
  [/beacon medallion/,'beacon-medallion'],[/boom wand/,'boom-wand'],[/earthfriend wand/,'earthfriend-wand'],[/hurling wand/,'hurling-wand'],[/chaos key/,'chaos-key'],[/chicken bag/,'chicken-bag'],
  [/cozy cottage/,'cozy-cottage'],[/crown of lightning/,'crown-of-lightning'],[/death ring/,'death-ring'],[/life ring/,'life-ring'],[/telekinesis ring/,'telekinesis-ring'],[/tree branch/,'deaths-tree-branch'],
  [/feather poulaines/,'feather-poulaines'],[/goat belt/,'goat-belt'],[/puddle girdle/,'puddle-girdle'],[/monster trap/,'monster-trap'],[/narration gloves/,'narration-gloves'],[/necklace of teeth/,'necklace-of-teeth'],
  [/whistle of dog/,'dog-whistle'],[/11-foot pole/,'pole'],[/alchemist/,'alchemist-tools'],[/blacksmith/,'blacksmith-tools'],[/enchanter/,'enchanter-tools'],[/cook/,'cooks-utensils'],
  [/surgical kit/,'surgical-kit'],[/animal feed/,'animal-feed'],[/ball bearings/,'ball-bearings'],[/bear trap/,'bear-trap'],[/block & tackle/,'block-and-tackle'],[/bucket/,'bucket'],
  [/caltrops/,'caltrops'],[/candle/,'candle'],[/coin purse/,'coin-purse'],[/cold weather gear/,'cold-weather-gear'],[/compass/,'compass'],[/crowbar/,'crowbar'],
  [/grappling hook/,'grappling-hook'],[/hearty ration/,'hearty-ration'],[/\bration\b/,'ration'],[/holy symbol/,'holy-symbol'],[/ladder/,'ladder'],[/lantern/,'lantern'],
  [/lockpick/,'lockpicks'],[/magnifying glass/,'magnifying-glass'],[/scales/,'merchants-scales'],[/miner/,'miners-pick'],[/^mirror$/,'mirror'],[/musical instrument/,'musical-instrument'],
  [/^net$/,'net'],[/padlock/,'padlock'],[/pitons/,'pitons'],[/^pot$/,'pot'],[/quill/,'quill-and-inkpot'],[/^rope$/,'rope'],
  [/shovel/,'shovel'],[/spyglass/,'spyglass'],[/^string$/,'string'],[/^tent$/,'tent'],[/torch/,'torch'],[/unfinished/,'unfinished-item'],
  [/^whistle$/,'whistle'],[/gold coins/,'gold-coins'],[/^gem$/,'gem'],[/art object, tiny/,'art-object-tiny'],[/art object, small/,'art-object-small'],[/art object, medium/,'art-object-medium'],
  [/treated iron bar/,'treated-iron-bar'],[/iron bar|crafting material, bar/,'iron-bar'],[/obsidian bar/,'obsidian-bar'],[/silver bar/,'silver-bar'],[/star diamond bar/,'star-diamond-bar'],[/hickory log|yew log|crafting material, log/,'log'],
  [/starwood log/,'starwood-log'],[/willow log/,'willow-log'],[/deathtree log/,'deathtree-log'],[/angel part/,'angel-part'],[/animal part/,'animal-part'],[/blood creature part/,'blood-creature-part'],
  [/demon part/,'demon-part'],[/elemental part/,'elemental-part'],[/undead part/,'undead-part'],[/plant part/,'plant-part'],[/creature part/,'creature-part'],[/^card deck$/,'card-deck'],
  [/^chain$/,'chain'],[/^chalk$/,'chalk'],[/plague mask/,'plague-mask'],[/spider box/,'spider-box'],[/monocle/,'strangers-monocle']];
function inventoryVisual(it){
  const n=it.name.toLowerCase();
  const key=INV_ICONS.find(([re])=>re.test(n))?.[1]||'missing';
  const tone=it.cat==='unidentified'?'mystery':isMagic(it)||it.cat==='spellbook'?'arcane':it.cat==='weapon'||it.cat==='armor'||it.cat==='ammo'?'steel':it.cat==='alchemy'||/ration|feed/.test(n)?'herbal':it.cat==='treasure'||/coin|purse/.test(n)?'gold':'leather';
  return {key,tone};
}
const INV_MISSING='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><rect x="8" y="8" width="48" height="48" rx="4" stroke-dasharray="6 5"/><path d="m18 18 28 28m0-28L18 46" stroke-width="5" stroke-linecap="round"/></svg>';
// lit: a burning light source shows its <key>-lit art.
// ponytail: every item with `light` (torch, lantern, candle) has a -lit icon; a new light source needs one too.
function inventoryIcon(it,cls='',lit=false){
  const key=inventoryVisual(it).key+(lit&&it.light?'-lit':'');
  if(key==='missing')return `<span class="inv-art inv-missing ${cls}" title="No icon yet">${INV_MISSING}</span>`;
  return `<span class="inv-art inv-material ${cls}"><img src="icons/items/${key}.webp" alt="" draggable="false" loading="lazy"></span>`;
}
function inventoryCanTarget(c,source,sec,idx,moving=false){
  if(!canPlace(c,source.id,sec,idx,source.uid))return true;
  const x=occ(c,sec)[idx],it=IT[source.id];if(!x||x.i.uid===source.uid)return false;
  if(x.i.id===source.id&&!x.i.unid===!source.unid&&it.stack>1&&sec!=='hand'&&x.i.count<it.stack)return true;
  return moving&&x.k===0&&sizeIn(IT[x.i.id],source.sec)===1&&sizeIn(it,sec)===1&&(sec!=='magic'||wearable(it))&&(source.sec!=='magic'||wearable(IT[x.i.id]));
}
// Three claw strokes: reads as "wound" at a glance, unlike a bare glyph.
// State badges (top right): flame = lit light source, check = worn armor. Drawn knocked out of a round chalk badge.
const INV_LIT_ICON='<svg class="inv-lit-ico" viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M8 1c.6 2.3 4.5 4.6 4.5 8.6 0 2.8-2 4.9-4.5 4.9S3.5 12.4 3.5 9.8c0-1.9 1.1-3.2 2.1-4.2.1 1.4.6 2.2 1.3 2.7C6.7 5.5 7.5 3.2 8 1Zm0 12.2c1.1 0 1.9-.8 1.9-1.9 0-1.2-1-1.9-1.4-3-.5 1-1.2 1.4-1.8 2.1-.4.4-.6.8-.6 1.2 0 .9.8 1.6 1.9 1.6Z"/></svg>';
const INV_WORN_ICON='<svg class="inv-worn-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.6 11.5 12.5 4.5"/></svg>';
const INV_WOUND_ICON='<svg class="inv-wound-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5 2.5 13M8.5 2 7 14M13 3l-1.5 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
function inventorySlot(c,sec,idx){
  const x=occ(c,sec)[idx],i=x?.i,it=i&&shown(i),w=sec==='pack'&&c.wounds.has(idx),mv=S.moving&&findInst(S.moving),placing=S.placing||mv;
  const fit=placing?inventoryCanTarget(c,placing,sec,idx,!!mv):false;
  const n=i?sizeIn(IT[i.id],sec):1,selected=i&&S.invSelected===i.uid;
  const label=sec==='hand'?`Hand ${idx+1}`:sec==='magic'?`Magic ${idx+1}`:sec==='belt'?`Belt ${idx+1}`:`Slot ${idx+1}`;
  const title=i?`${it.name} · ${label}${n>1?` · ${x.k+1} of ${n} slots`:''}`:`Empty ${SEC_NAME[sec]} ${idx+1}: add an item`;
  const woundName=({starvation:'Starving',exhaustion:'Exhausted'}[(c.woundType||{})[idx]]||'Wound');
  const woundRule=({starvation:'r-starvation',exhaustion:'r-exhaustion'}[(c.woundType||{})[idx]]||'');
  return `<div class="slot inv-slot ${!i?'empty':''} ${w?'wounded':''} ${placing?(fit?'target':'nope'):''} ${selected?'inv-selected':''} ${x?.k?'inv-linked':''}" data-sec="${sec}" data-idx="${idx}" ${!i?`data-action="slot" role="button" tabindex="0" aria-label="${esc(title)}"`:''}>
    ${i?`<article class="card inv-item tone-${inventoryVisual(it).tone} ${S.moving===i.uid?'moving':''} ${i.lit?'lit':''}" data-uid="${i.uid}" data-id="${it.id}" tabindex="0" role="button" aria-label="${esc(title)}: inspect; M to move" aria-pressed="${!!selected}">
      <span class="inv-slot-no">${idx+1}</span>${inventoryIcon(it,'',i.lit)}
      ${n>1?`<span class="inv-link" aria-label="${x.k+1} of ${n} linked slots">${x.k?'↳ ':''}${x.k+1}/${n}</span>`:''}
      ${i.count>1?`<span class="inv-count">${i.count}</span>`:''}
      ${i.worn||i.lit?`<span class="inv-equipped" role="img" aria-label="${i.worn?'Worn':'Lit'}" title="${i.worn?'Worn':'Lit'}">${i.worn?INV_WORN_ICON:INV_LIT_ICON}</span>`:''}
    </article><span class="inv-item-name" title="${esc(it.name)}">${w?INV_WOUND_ICON:''}${esc(it.name)}</span>`:
    `<span class="inv-empty-art" aria-hidden="true"><span class="inv-slot-no">${idx+1}</span>${inventoryIcon({name:sec==='hand'?'Sword':sec==='magic'?'Ring':'Backpack',cat:'gear'})}<span class="inv-add">+</span></span><span class="inv-item-name">${w?INV_WOUND_ICON+woundName:sec==='hand'?'Empty hand':sec==='magic'?'Magic slot':'Empty'}</span>`}
    ${sec==='pack'?`<button class="wbtn ${woundRule?'hint':''} ${S.pendingWounds&&!w?'pending':''}" ${woundRule?`data-term="${woundRule}"`:''} data-action="wound" data-v="${idx}" aria-pressed="${!!w}" aria-label="${w?'Remove '+woundName.toLowerCase():'Mark wound'} in backpack slot ${idx+1}" title="${w?woundName+(i?' · −1 Speed':''):'Mark a wound in slot '+(idx+1)}">${INV_WOUND_ICON}<span>${w?woundName:'Wound'}</span></button>`:''}
  </div>`;
}
// The picked item's card opens next to its slot (or, for party loot, left of the drawer).
// Destructive actions sit apart, last and red.
function inventoryDetails(c){
  const p=S.invPop,x=p?.pool&&S.pool.find(q=>q.uid===p.pool);
  const head=(it,eye,name,sub)=>`<div class="inv-detail-heading">${inventoryIcon(it)}<div><span class="inv-eyebrow">${eye}</span><h3>${name}</h3><span class="inv-muted">${sub}</span></div><button class="xbtn" data-action="inv-close" aria-label="Close">✕</button></div>`;
  // a card that is not on your board yet (builder): read only
  if(p?.item){const it=IT[p.item];if(!it)return '';
    return head(it,esc(CATL[it.cat]||'Item'),esc(it.name),`${it.slots||1} slot${(it.slots||1)>1?'s':''}`)+`<div class="inv-detail-card">${cardHTML(it,null,{full:true,info:false,ro:true})}</div>
      <div class="inv-pop-foot"><button class="lnk" data-action="open-item" data-id="${it.id}">Full details ↗</button></div>`}
  // a card a pet or hireling carries
  if(p?.comp){const o=c[p.comp]?.[p.k],i=o?.inv.find(q=>q.uid===p.uid);if(!i)return '';const it=shown(i);
    return head(it,`${esc(CATL[it.cat]||'Item')} · ${esc(o.name)}`,esc(it.name),`Backpack ${i.idx+1}${i.count>1?' · ×'+i.count:''}`)+`<div class="inv-detail-card">${cardHTML(it,i,{full:true,info:false,ro:true})}</div>
      <div class="inv-detail-actions one"><button class="btn primary inv-primary" data-action="pet-take" data-kind="${p.comp}" data-k="${p.k}" data-uid="${i.uid}">Take back</button></div>
      ${i.unid?'':`<div class="inv-pop-foot"><button class="lnk" data-action="open-item" data-id="${it.id}">Full details ↗</button></div>`}`}
  if(x){const it=shown(x);
    return `<div class="inv-detail-heading">${inventoryIcon(it)}<div><span class="inv-eyebrow">${esc(CATL[it.cat]||'Item')} · Party loot</span><h3>${esc(nm(x))}${x.count>1?` <span class="inv-muted">×${x.count}</span>`:''}</h3><span class="inv-muted">${it.slots||1} slot${(it.slots||1)>1?'s':''}${x.from?' · from '+esc(x.from):''}</span></div><button class="xbtn" data-action="inv-close" aria-label="Close">✕</button></div>
      <div class="inv-detail-card">${cardHTML(it,null,{full:true,info:false,ro:true})}</div>
      <div class="inv-detail-actions one"><button class="btn primary inv-primary" data-action="take" data-uid="${x.uid}">Take${x.count>1?'…':''}</button></div>
      <div class="inv-pop-foot"><button class="btn danger" data-action="pool-remove" data-uid="${x.uid}">Remove from pool</button></div>`}
  const i=c.inv.find(x=>x.uid===p?.uid);if(!i)return '';
  const it=shown(i),n=sizeIn(IT[i.id],i.sec);
  return `<div class="inv-detail-heading">${inventoryIcon(it,'',i.lit)}<div><span class="inv-eyebrow">${esc(CATL[it.cat]||'Item')}</span><h3>${esc(it.name)}</h3><span class="inv-muted">${SEC_NAME[i.sec]} ${i.idx+1}${n>1?'–'+(i.idx+n):''}${i.worn?' · Worn':''}</span></div><button class="xbtn" data-action="inv-close" aria-label="Close">✕</button></div>
    <div class="inv-detail-card">${cardHTML(it,i,{full:true,info:false})}</div>
    ${i.sec==='pack'?`<p class="inv-draw"><a class="term" href="#rule/draw-pack" data-term="draw-pack">Draw From Pack</a> <b>d10 ≥ ${i.idx+1}</b> <span class="inv-muted">· ${(10-i.idx)*10}%</span></p>`:''}
    <div class="inv-detail-actions"><button class="btn primary inv-primary" data-action="inv-move" data-uid="${i.uid}">Move</button><button class="btn" data-action="topool" data-uid="${i.uid}">Give to party${i.count>1?'…':''}</button></div>
    <div class="inv-pop-foot"><button class="lnk" data-action="open-inst" data-uid="${i.uid}">Full details ↗</button>${i.count>1?`<button class="lnk" data-action="split" data-uid="${i.uid}">Split…</button>`:''}<button class="btn danger" data-action="discard" data-uid="${i.uid}">Throw away</button></div>`;
}
function inventoryHTML(c){
  const used=occ(c,'pack').filter(Boolean).length,lit=lightOf(c),wm=!!(S.woundMode||S.pendingWounds),n=S.pool.length;
  // Loot drawer: open while there is loot and room for it, a slim tab otherwise. CSS decides "room".
  const mode=S.lootOpen===true?'open':S.lootOpen===false||!n?'closed':'auto';
  const slots=(sec,start=0,end=LEN[sec])=>Array.from({length:end-start},(_,idx)=>inventorySlot(c,sec,start+idx)).join('');
  const stat=(k,v,cl='')=>`<div class="${cl}"><span>${k}</span><b>${v}</b></div>`;
  const status=`<div class="inv-status" aria-label="Status">${stat('AD',`${adNow(c)}/${adMax(c)}`)}${stat('Light',lit?esc(shown(lit).name):'none','lt')}${stat('Speed',speed(c))}${stat('Wounds',c.wounds.size,c.wounds.size?'inv-danger':'')}${stat('Gold',coinsOf(c).toLocaleString('en')+' gc')}</div>`;
  const packRow=start=>`<div class="inv-pack-row"><div class="inv-subheading"></div><div class="inv-pack-slots">${slots('pack',start,start+5)}</div></div>`;
  return `<div class="inventory ${wm?'wmode':''}" aria-label="Inventory">
    <div class="inv-shell ${mode}"><div class="inv-main"><div class="inv-layout">
      <div class="inv-bag-tools"><label class="inv-search"><span aria-hidden="true">⌕</span><input id="inv-search" type="search" placeholder="Find an item…" value="${esc(S.invQuery||'')}" aria-label="Find an inventory item"><span class="inv-filter-status" id="inv-filter-status" role="status" aria-live="polite"></span></label><div class="inv-filters" role="group" aria-label="Filter inventory">${[['','All'],['equipment','Equipment'],['supplies','Supplies'],['magic','Magic']].map(([key,name])=>`<button type="button" data-action="inv-filter" data-v="${key}" aria-pressed="${(S.invFilter||'')===key}">${name}</button>`).join('')}</div></div>
      <section class="inv-window inv-equipment" aria-label="Equipment"><header class="inv-window-title"><h2>Equipment</h2><span>9 slots</span></header>
        <div class="inv-ready-row">
          <div class="inv-ready-group inv-hands-group"><div class="inv-subheading"><h3><a class="term" href="#rule/hands-use" data-term="hands-use">Hands</a></h3></div><div class="inv-equip-slots inv-hands-slots">${slots('hand')}</div></div>
          <div class="inv-ready-group inv-magic-group"><div class="inv-subheading"><h3><a class="term" href="#rule/magic-slots" data-term="magic-slots">Magic</a></h3></div><div class="inv-equip-slots inv-magic-slots">${slots('magic')}</div></div>
        </div>
        <div class="inv-belt-row"><div class="inv-subheading"><h3>Belt</h3><span>Swap to hand: <a class="term" href="#rule/maneuver" data-term="maneuver">maneuver</a></span></div><div class="inv-equip-slots inv-belt-slots">${slots('belt')}</div></div>
      </section>
      <section class="inv-window inv-backpack" aria-label="Backpack"><header class="inv-window-title"><h2>Backpack</h2><span><b>${10-used}</b> free / 10</span><button class="btn sm inv-wmode ${wm?'':'danger solid'}" data-action="wmode" aria-pressed="${wm}" ${S.pendingWounds?'disabled':''}>${INV_WOUND_ICON}${wm?'Done':'Mark wounds'}</button></header>
        ${packRow(0)}${packRow(5)}
      </section>${status}
    </div></div>
    <aside class="inv-loot" aria-label="Party loot">
      <button class="inv-loot-tab" type="button" data-action="loot-toggle" aria-label="Show party loot (${n})"><span>‹</span> Party loot · ${n}</button>
      <section class="inv-window inv-loot-panel"><header class="inv-window-title"><h2>Party loot</h2><span>${n} stack${n===1?'':'s'}</span><button class="xbtn" data-action="loot-toggle" aria-label="Hide party loot">›</button></header><div id="pool" class="inv-loot-body" role="region" aria-label="Loot pool">
        ${n?S.pool.map(p=>`<div class="inv-loot-row ${S.invPop?.pool===p.uid?'inv-selected':''}" data-pool="${p.uid}"><button class="inv-loot-pick" data-action="loot-pick" data-uid="${p.uid}" aria-label="Inspect ${esc(nm(p))}">${inventoryIcon(shown(p))}<span class="nm"><b>${esc(nm(p))}${p.count>1?` <span>×${p.count}</span>`:''}</b><span>${shown(p).slots||1} slot${shown(p).slots>1?'s':''}${p.from?' · '+esc(p.from):''}${p.note?' — '+esc(p.note):''}</span></span></button><button class="btn" data-action="take" data-uid="${p.uid}">Take</button></div>`).join(''):'<div class="inv-loot-empty">No unclaimed items.<span>Items shared with the party appear here.</span></div>'}
        <button class="inv-pool-drop" id="pooldrop" type="button" aria-label="Give selected item to party loot" data-action="inv-give">↗ <span>${S.moving?'Place moving item here':'Drag an item here to share'}</span></button>
      </div></section>
    </aside></div>
  </div>${placeBar()}`;
}
function inventorySelect(uid){
  S.invSelected=uid;S.invPop={uid};hidePreview();
  document.querySelectorAll('.inv-slot').forEach(cell=>{const item=cell.querySelector('.inv-item'),on=+item?.dataset.uid===uid;cell.classList.toggle('inv-selected',on);item?.setAttribute('aria-pressed',on)});
  document.querySelectorAll('.inv-loot-row').forEach(r=>r.classList.remove('inv-selected'));
  inventoryPlacePop();
}
// Fill and place the card beside its anchor, flipped to fit, clear of the sticky bars and the bottom navigation.
function inventoryPlacePop(){
  // one card element for the whole page, outside any container query so position:fixed works
  let pop=document.getElementById('inv-pop');
  if(!pop){document.body.insertAdjacentHTML('beforeend','<div class="inv-pop" id="inv-pop" role="dialog" aria-label="Item" hidden><div id="inv-detail-body"></div></div>');pop=document.getElementById('inv-pop')}
  const p=S.invPop,show=p&&!S.moving&&!S.placing&&!S.pendingWounds&&!S.woundMode;
  const anchor=show&&document.querySelector(p.pool?`.inv-loot-row[data-pool="${p.pool}"]`:p.item?`[data-pop-key="${p.key}"]`:`.inv-item[data-uid="${p.uid}"]`);
  document.querySelectorAll('.pop-on').forEach(x=>x.classList.remove('pop-on'));
  if(!anchor||!ME&&!p.item){pop.hidden=true;if(show)S.invPop=null;return}
  if(p.item||p.comp)(anchor.closest('.inv-slot')||anchor).classList.add('pop-on');
  pop.firstElementChild.innerHTML=inventoryDetails(ME||{});pop.hidden=false;
  const top=(document.getElementById('tabs')?.getBoundingClientRect().bottom||0)+8,bottom=(document.getElementById('nav')?.getBoundingClientRect().top||innerHeight)-8;
  pop.style.maxHeight=(bottom-top)+'px';
  const r=anchor.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight,g=12;
  const edge=document.body.classList.contains('panel-open')?document.getElementById('panel').getBoundingClientRect().left:innerWidth;
  const right=r.right+g+w<=edge-8,left=r.left-g-w>=8;
  let x=p.pool||!right?(left?r.left-g-w:null):r.right+g,y=r.top-12;
  if(x==null){x=Math.max(8,Math.min(r.left,edge-w-8));y=r.bottom+g;if(y+h>bottom)y=r.top-g-h}
  pop.style.left=x+'px';pop.style.top=Math.max(top,Math.min(y,bottom-h))+'px';
}
function inventoryClosePop(){S.invPop=null;const pop=document.getElementById('inv-pop');if(pop)pop.hidden=true;document.querySelectorAll('.inv-loot-row.inv-selected').forEach(r=>r.classList.remove('inv-selected'))}
addEventListener('scroll',()=>S.invPop&&inventoryPlacePop(),{passive:true});addEventListener('resize',()=>S.invPop&&inventoryPlacePop());
document.addEventListener('pointerdown',e=>{if(S.invPop&&!e.target.closest('#inv-pop,.inv-item,.inv-loot-pick,[data-pop-key],#dlg,#panel,#toast,#preview'))inventoryClosePop()});
function inventoryFilter(){
  const q=(S.invQuery||'').trim().toLowerCase(),filter=S.invFilter||'',active=!!(q||filter),hits=new Set();
  document.querySelectorAll('.inv-slot').forEach(cell=>{
    const item=cell.querySelector('.inv-item'),i=item&&findInst(item.dataset.uid),it=i&&shown(i);
    const category=it&&(filter==='equipment'?['weapon','armor','ammo'].includes(it.cat):filter==='supplies'?['gear','alchemy','material'].includes(it.cat):filter==='magic'?['magic','spellbook','unidentified'].includes(it.cat)||isMagic(it):true);
    const match=it&&it.name.toLowerCase().includes(q)&&category;if(match)hits.add(i.uid);
    // Keep numbered slots in place, especially while choosing wounds or a move destination.
    cell.classList.toggle('inv-muted-match',active&&!match&&!S.moving&&!S.placing&&!S.pendingWounds);
  });
  const status=document.getElementById('inv-filter-status');if(status){status.hidden=!active;status.textContent=active?`${hits.size} matching`:''}
  document.querySelectorAll('[data-action="inv-filter"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===filter));
}
document.addEventListener('input',e=>{if(e.target.id==='inv-search'){S.invQuery=e.target.value;inventoryFilter()}});
document.addEventListener('keydown',e=>{
  if(S.area!=='crow'||S.tab.crow!=='inventory'||!document.querySelector('#main .inventory')||e.target.closest('input,textarea,select,dialog')||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Escape'&&S.invPop){inventoryClosePop();return}
});
