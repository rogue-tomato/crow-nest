'use strict';
/* Shared physical inventory rules. Both browser and server use the same catalog.
   This module deliberately has no DOM, transport or persistence dependencies. */
(function(root){
  const LEN={hand:2,magic:3,belt:4,pack:10};
  const names={hand:'Hand',magic:'Magic slot',belt:'Belt',pack:'Backpack'};
  function createRules(items){
    const isCumb=it=>/Cumbersome/.test(it?.q||'');
    const sizeIn=(it,sec)=>sec==='hand'&&isCumb(it)?2:it?.slots||1;
    const lenOf=(c,sec)=>c.len?.[sec]??LEN[sec];
    const wearable=it=>!!it&&(it.wear||it.cat==='unidentified');
    function occ(c,sec){const a=Array(lenOf(c,sec)||0).fill(null);for(const i of c.inv||[]){if(i.sec!==sec)continue;const n=sizeIn(items[i.id],sec);for(let k=0;k<n;k++)if(i.idx+k>=0&&i.idx+k<a.length)a[i.idx+k]={i,k}}return a}
    function canPlace(c,id,sec,idx,ignore){
      const it=items[id];if(!it)return 'Unknown item.';
      if(!Object.hasOwn(LEN,sec)||!Number.isInteger(idx)||idx<0)return 'Choose a valid inventory slot.';
      const n=sizeIn(it,sec),o=occ(c,sec);
      if(sec==='magic'&&!wearable(it))return 'Magic slots hold wearable magic items (rings, belts, masks…).';
      if(idx+n>lenOf(c,sec))return `${it.name} needs ${n} neighbouring ${names[sec].toLowerCase()} slots.`;
      for(let k=0;k<n;k++){const x=o[idx+k];if(x&&x.i.uid!==ignore)return 'Those slots are taken.'}return '';
    }
    function validateCrow(c){
      const errors=[],uids=new Set(),placed={...c,inv:[]};
      if(!c||!Array.isArray(c.inv))return ['Invalid inventory.'];
      for(const i of c.inv){
        if(!Number.isSafeInteger(i.uid)||i.uid<1||uids.has(i.uid))errors.push('Invalid or duplicate item UID.');uids.add(i.uid);
        const it=items[i.id];if(!it){errors.push('Unknown item.');continue}
        const err=canPlace(placed,i.id,i.sec,i.idx);if(err)errors.push(err);
        if(!Number.isInteger(i.count)||i.count<1||i.count>(i.sec==='hand'?1:it.stack||1))errors.push('Invalid stack size.');
        if(i.worn&&(i.sec!=='pack'||it.cat!=='armor'||/Shield$/.test(it.name)))errors.push('Invalid worn armor.');
        if(i.lit&&(i.sec!=='hand'||!it.light))errors.push('Invalid light placement.');
        if(i.ud!=null&&(!Number.isInteger(i.ud)||i.ud<0||(it.ud&&i.ud>it.ud[0])))errors.push('Invalid usage dice.');
        placed.inv.push(i);
      }
      if(c.inv.filter(i=>i.worn).length>1)errors.push('Only one armor can be worn.');
      const wounds=c.wounds instanceof Set?[...c.wounds]:c.wounds||[];
      if(!Array.isArray(wounds)||wounds.some(w=>!Number.isInteger(w)||w<0||w>=lenOf(c,'pack')))errors.push('Invalid wound slot.');
      for(const p of [...(c.pets||[]),...(c.hires||[])])errors.push(...validateCrow(p));
      return errors;
    }
    return {LEN,isCumb,sizeIn,lenOf,wearable,occ,canPlace,validateCrow};
  }
  function createLevels(levels){const level=c=>levels.filter(l=>c.txp>=l.min).pop();return {level,stMax:c=>c.stBase+2*(level(c).lv-1),effMax:c=>level(c).eff}}
  root.CrowsRules={createRules,createLevels,LEN};
})(globalThis);
