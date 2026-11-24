/* Choice + description in one block (owner-approved 2026-11-21; first in the builder's Village connection): the choice chips,
   a thin rule, the chosen option's text right under them. The selection is a ring, never a bone fill (chips.css).
   Callers escape labels and text with esc(); the block only arranges them.
     chipBox({items, sel, action, aria, label, desc, lead, cls})
       items  [{v, label (HTML), dis, why (HTML: a visible reason on a disabled chip), title}]
       aria   'pressed' (a group of toggles, the default) | 'checked' (role=radio) | 'selected' (role=tab)
       desc   HTML of the chosen option's text (under the rule); none → no rule
       lead   HTML before the chips (a small label) */
const CD_ROLE={pressed:'',checked:'radio',selected:'tab'},CD_GROUP={pressed:'group',checked:'radiogroup',selected:'tablist'};
function cdChips(o){const a=o.aria||'pressed',sel=o.sel==null?null:String(o.sel);
  return `<div class="cd-chips" role="${CD_GROUP[a]}"${o.label?` aria-label="${esc(o.label)}"`:''}>${o.items.map(i=>`<button type="button" class="cd-chip"${CD_ROLE[a]?` role="${CD_ROLE[a]}"`:''} data-action="${o.action}" data-v="${esc(String(i.v))}" aria-${a}="${String(i.v)===sel}"${i.dis?' disabled':''}${i.title?` title="${esc(i.title)}"`:''}>${i.label}${i.why?` <span class="cd-why">${i.why}</span>`:''}</button>`).join('')}</div>`}
function chipBox(o){return `<div class="cd-box${o.cls?' '+o.cls:''}">${o.lead||''}${cdChips(o)}${o.desc?`<div class="cd-desc">${o.desc}</div>`:''}</div>`}
const cdName=h=>`<b class="cd-name">${h}</b> `; // the chosen option's name at the start of its text
// A chip picked with the keyboard keeps the focus: render() replaces the block, so the same chip (action + value) is focused again.
document.addEventListener('click',e=>{const b=e.target.closest?.('.cd-chip');if(!b||e.detail!==0)return;const q=`.cd-chip[data-action="${b.dataset.action}"][data-v="${CSS.escape(b.dataset.v||'')}"]`;
  setTimeout(()=>{if(document.activeElement&&document.activeElement!==document.body&&document.activeElement.isConnected)return;document.querySelector(q)?.focus({preventScroll:true})},0)});
