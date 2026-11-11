'use strict';
/* CROW NEST — hex map editor: the Ref's Hex map tab in Edit mode. Modelled on Hexer's editor (hexermap.com, checked 2026-11-10):
   the same tools and keys — Brush B (sizes 1–5, pick terrain, fill), Places F, Eraser E, Paths P (road, trail, river),
   Regions R, Walls G (Hexer's Edge tool), Notes N, Pan H — undo/redo, New map, Generate, and export back to Hexer's JSON.
   It edits HX (hexmap.js) in place. A painted terrain object is never mutated: an edit copies HX.t first (hxTerrCopy), so the
   painting cached on the old object stays on screen (HXE.shown) while the new one paints in the background; until then the
   edit shows at once as flat colour (hxEdOverlay). Editor state lives in S.hx (local, never in snap()); history in HXE. */
Object.assign(S.hx,{edit:false,tool:'brush',terr:'plains',size:1,pick:false,ptype:'village',psel:-1,pk:'primary',draw:null,pthsel:-1,reg:-1,rmode:'add',rview:'fill',nsel:null,nedit:-1,q:'',pscroll:0,
  selK:[],smode:'add',fmode:'show',paste:false,tsel:-1,cp:null});
const HXE={u:[],r:[],shown:null,alt:null,pp:new WeakMap(),stroke:null,space:false,clip:null};
function hxEdReset(){Object.assign(HXE,{u:[],r:[],shown:null,alt:null,stroke:null});Object.assign(S.hx,{pick:false,psel:-1,draw:null,pthsel:-1,reg:-1,nsel:null,nedit:-1,selK:[],paste:false,tsel:-1,cp:null})}
if(HX)HX.blk??={};
const HX_MAXSIDE=80;
// Hexer's terrain palette, in its order (the 41 free types)
const HX_TGROUPS=[['Lowlands',['plains','grassland','meadow','farmland','valley','heath','savanna','steppe']],['Forests',['forest','dense-forest','jungle','glade']],
  ['Wetlands',['swamp','marsh','bog']],['Highlands',['hill','crag','mountain','mountain-peak','volcano']],['Arid',['desert','badlands','canyon','crater']],['Cold',['tundra','glacier']],
  ['Exotic',['oasis','mushroom-forest','crystal-cavern']],['Open water',['ocean','deep-ocean','sea']],['Fresh water',['lake','pond','frozen-lake','rapids']],
  ['Coastal',['coast','reef','fjord','delta']],['Special',['hot-spring']]];
const HX_PGROUPS=(()=>{const g={};for(const [t,[c]] of Object.entries(HX_POI))(g[c]??=[]).push(t);return Object.entries(g)})();
const HX_PK={primary:'Road',secondary:'Trail',water:'River'};
const hxPkName=t=>HX_PK[t]||tName(HX,t);
const HX_RCOL=['#8b4a3d','#35598a','#4f7a36','#7a4a86','#8a7330','#2f7a76'];

/* ---------- map and history ---------- */
const hxNewMap=({name,w,h,flat})=>({name:String(name||'').trim().slice(0,60)||'Untitled map',w,h,flat:!!flat,t:{},names:{},colors:{},seen:{},pois:[],notes:[],paths:[],regs:[],blk:{},tokens:[],
  party:null,known:null,trail:[],lostTrail:[],route:[],day:S.rtravel.day,moved:S.rtravel.moved||0,days:{}});
function hxSetMap(m){HX=m;hxClaim();hxEdReset();S.hx.sel=null;S.hx.cam=null;S.hx.edit=true;S.hx.panel=true;saveHX();render()}
const hxGLmay=()=>typeof HXGL!=='undefined'&&HXGL.gl!==false&&hxGLOK(); // WebGL 2 works or hasn't been tried yet
const hxEdReady=t=>{if(!Object.keys(t).length)return true;if(!HX_PC.has(t)&&typeof HX_JOB.get(t)!=='string')return false;return !hxGLmay()||HXGL.maps.get(t)?.up===2};
// a new terrain object (the old one keeps its painting on screen until the new painting is ready)
function hxTerrCopy(){if(hxEdReady(HX.t))HXE.shown=HX.t;HX.t={...HX.t}}
const HX_ED=['name','w','h','flat','t','names','colors','pois','notes','paths','regs','blk','seen','tokens'];
const hxEdSnap=()=>JSON.stringify(HX_ED.map(k=>HX[k]));
function hxDo(){HXE.u.push(hxEdSnap());if(HXE.u.length>80)HXE.u.shift();HXE.r=[]}
// unchanged parts keep their objects (and so their paintings); places and paths are part of the painting (clearings, rivers)
function hxEdApply(s){const v=JSON.parse(s),ch=new Set();HX_ED.forEach((k,i)=>{if(JSON.stringify(HX[k])!==JSON.stringify(v[i])){if(k==='t'&&hxEdReady(HX.t))HXE.shown=HX.t;HX[k]=v[i];ch.add(k)}});
  if(!ch.has('t')&&['pois','paths'].some(k=>ch.has(k)))hxTerrCopy();
  Object.assign(S.hx,{psel:-1,pthsel:-1,draw:null,nedit:-1,tsel:-1,paste:false});if(S.hx.reg>=HX.regs.length)S.hx.reg=-1;saveHX();render()}
function hxUndo(){if(!HXE.u.length)return toast('Nothing to undo');HXE.r.push(hxEdSnap());hxEdApply(HXE.u.pop())}
function hxRedo(){if(!HXE.r.length)return toast('Nothing to redo');HXE.u.push(hxEdSnap());hxEdApply(HXE.r.pop())}

/* ---------- tools on the map ---------- */
// brush footprint: size 1 is one hex, size n every hex closer than n steps
function hxFoot(m,k,size){if(!k)return [];if(size<=1)return [k];const [q0,r0]=k.split(',').map(Number),out=[];
  for(let q=q0-size;q<=q0+size;q++)for(let r=r0-size;r<=r0+size;r++){if(q<0||r<0||q>=m.w||r>=m.h)continue;const n=q+','+r;if(hxDist(m,k,n)<size)out.push(n)}return out}
// the neighbour across the hex edge nearest to a point in hex k
const hxEdgeNb=(m,k,[px,py])=>{const [x,y]=ctr(m,k),a=(Math.atan2(y-py,px-x)*180/Math.PI+360)%360,d=b=>Math.abs(((b-a)%360+540)%360-180);return nbs(m,k).sort((p,q)=>d(p.ang)-d(q.ang))[0]};
const hxEdgeLine=(m,k,n)=>{const [x,y]=ctr(m,k);return hxEdgeD(x,y,hxEdgeAng(m,hxEdgeI(m,n)))};
const hxLive=()=>$('.hxstage .hxed .live');
const hxLiveAdd=s=>hxLive()?.insertAdjacentHTML('beforeend',s);
const BLANK='<path class="eblank" d="';
function hxStrokeAt(k){const s=HXE.stroke;if(!s||!k)return;const T=s.T,col=T==='brush'&&hxType(HX,S.hx.terr)[1];
  for(const n of hxFoot(HX,k,S.hx.size)){
    if(T==='brush'){if(HX.t[n]===S.hx.terr)continue;HX.t[n]=S.hx.terr;hxLiveAdd(`<path class="pend" style="fill:${col}" d="${hxPathD(HX,[n],1.005)}"/>`)}
    else if(T==='erase'){if(!HX.t[n])continue;delete HX.t[n];hxLiveAdd(BLANK+hxPathD(HX,[n])+'"/>')}
    else if(T==='region'){const g=HX.regs[S.hx.reg];
      if(S.hx.rmode==='remove'){if(!g.ks.includes(n))continue;g.ks=g.ks.filter(x=>x!==n);hxLiveAdd(`<path class="ecut" d="${hxPathD(HX,[n],.9)}"/>`)}
      else{if(g.ks.includes(n))continue;for(const o of HX.regs)if(o!==g&&o.ks.includes(n))o.ks=o.ks.filter(x=>x!==n);g.ks.push(n);hxLiveAdd(S.hx.rview==='line'?`<path class="eadd" style="stroke:${g.color||HX_RCOL[0]}" d="${hxPathD(HX,[n],.82)}"/>`:`<path class="etint" style="fill:${g.color||HX_RCOL[0]}" d="${hxPathD(HX,[n])}"/>`)}}
    else if(T==='fog'){if(!HX.t[n]||(s.show?!!HX.seen[n]:!HX.seen[n]))continue;if(s.show)HX.seen[n]=1;else delete HX.seen[n];hxLiveAdd(`<path class="${s.show?'efogoff':'efog'}" d="${hxPathD(HX,[n])}"/>`)}
    else if(T==='select'){const i=S.hx.selK.indexOf(n);if(s.add){if(i>=0)continue;S.hx.selK.push(n);hxLiveAdd(`<path class="esela" d="${hxPathD(HX,[n])}"/>`)}else{if(i<0)continue;S.hx.selK.splice(i,1);hxLiveAdd(`<path class="ecut" d="${hxPathD(HX,[n],.9)}"/>`)}}
    s.n++}}
function hxDrawLive(){const d=S.hx.draw,g=hxLive();if(!d||!g)return;let p=$('.edraw',g);if(!p){g.insertAdjacentHTML('beforeend','<path class="edraw"/>');p=$('.edraw',g)}
  p.setAttribute('class','edraw '+d.type);p.setAttribute('d',hxCurve(d.ks.map(k=>ctr(HX,k))))}
function hxPathFinish(quiet){const d=S.hx.draw;S.hx.draw=null;if(!d)return;if(d.ks.length<2){if(!quiet)toast('A path needs two hexes or more');return render()}
  hxDo();HX.paths=[...HX.paths,{type:d.type,pts:d.ks.map(k=>ctr(HX,k))}];hxTerrCopy();S.hx.pthsel=HX.paths.length-1;saveHX();if(!quiet)render()}
function hxWallAt(k,xy){if(!k)return;const n=hxEdgeNb(HX,k,xy);if(!n)return;hxDo();HX.blk??={};const i=hxEdgeI(HX,n),o=(i+3)%6,rm=(h,e)=>{if(!HX.blk[h])return;HX.blk[h]=HX.blk[h].filter(x=>x!==e);if(!HX.blk[h].length)delete HX.blk[h]};
  if(hxWall(HX,k,n)){rm(k,i);rm(n.k,o)}else(HX.blk[k]??=[]).push(i);saveHX();render()}
// the stroke callbacks hxStage (hexmap.js) calls for a drag or a tap on the map
const hxEdPaint={
  pan:e=>e.button===1||HXE.space||S.hx.tool==='pan',
  hover:(k,xy)=>{const T=S.hx.tool;if(T==='pan')return '';if(T==='wall'){const n=hxEdgeNb(HX,k,xy);return n?hxEdgeLine(HX,k,n):''}
    if(T==='select'&&S.hx.paste&&HXE.clip)return hxPathD(HX,hxClipAt(k).ks,.96);
    return hxPathD(HX,['brush','erase','region','select','fog'].includes(T)?hxFoot(HX,k,S.hx.size):[k],.96)},
  down:(k,xy,e)=>{const T=S.hx.tool;HXE.stroke=null;
    if(T==='brush'&&(e.alt||S.hx.pick)){if(k&&HX.t[k]){S.hx.terr=HX.t[k];S.hx.pick=false;toast(`Brush: ${tName(HX,HX.t[k])}`)}else toast('That hex is blank');return render()}
    if(T==='brush'||T==='erase'){const t0=HX.t;hxDo();hxTerrCopy();HXE.stroke={T,n:0,t0,sh:HXE.shown};return hxStrokeAt(k)}
    if(T==='region'){if(!HX.regs[S.hx.reg])return toast('Make a region first: New region');hxDo();HXE.stroke={T,n:0};return hxStrokeAt(k)}
    if(T==='wall')return hxWallAt(k,xy);
    if(T==='fog'){hxDo();HXE.stroke={T,n:0,show:!e.alt===(S.hx.fmode!=='hide')};return hxStrokeAt(k)}
    if(T==='select'){if(S.hx.paste){if(k)hxPasteAt(k);return}HXE.stroke={T,n:0,add:!e.alt&&S.hx.smode==='add'};return hxStrokeAt(k)}
    if(T==='note'){if(!k)return;S.hx.nsel=k;S.hx.nedit=-1;return render()}
    if(!k)return;
    if(T==='poi'){const i=HX.pois.findIndex(p=>p.k===k);if(i>=0){S.hx.psel=i;HXE.stroke={T,i,k0:k,to:k};return}
      hxDo();HX.pois=[...HX.pois,{type:S.hx.ptype,label:'',k,found:false}];S.hx.psel=HX.pois.length-1;hxTerrCopy();saveHX();return render()}
    if(T==='token'){const i=(HX.tokens||=[]).findIndex(o=>o.k===k);if(i>=0){S.hx.tsel=i;HXE.stroke={T,i,k0:k,to:k};return}
      hxDo();const n=HX.tokens.length;HX.tokens=[...HX.tokens,{name:`Token ${n+1}`,color:HX_RCOL[n%HX_RCOL.length],k,show:false}];S.hx.tsel=n;saveHX();return render()}
    if(T==='path'){const d=S.hx.draw;HXE.stroke={T};if(!d){S.hx.draw={type:S.hx.pk,ks:[k]};return hxDrawLive()}
      if(k===d.ks.at(-1)){HXE.stroke=null;return hxPathFinish()}d.ks.push(k);hxDrawLive()}},
  move:k=>{const s=HXE.stroke;if(!s)return;if(s.T==='poi'||s.T==='token'){s.to=k;return}
    if(s.T==='path'){const d=S.hx.draw;if(d&&k!==d.ks.at(-1)){d.ks.push(k);hxDrawLive()}return}hxStrokeAt(k)},
  up:()=>{const s=HXE.stroke;HXE.stroke=null;if(!s)return;
    if((s.T==='brush'||s.T==='erase')&&!s.n){HXE.u.pop();HX.t=s.t0;HXE.shown=s.sh;return render()} // nothing changed: no history, no repaint
    if(s.T==='region'&&!s.n){HXE.u.pop();return render()}
    if(s.T==='poi'){if(s.to&&s.to!==s.k0&&!HX.pois.some(p=>p.k===s.to)){hxDo();HX.pois=HX.pois.map((p,j)=>j===s.i?{...p,k:s.to}:p);hxTerrCopy();saveHX()}return render()}
    if(s.T==='token'){if(s.to&&s.to!==s.k0){hxDo();HX.tokens=HX.tokens.map((o,j)=>j===s.i?{...o,k:s.to}:o);saveHX()}return render()}
    if(s.T==='select')return render();
    if(s.T==='fog'){if(!s.n){HXE.u.pop();return render()}toast(`${s.n} hex${s.n===1?'':'es'} ${s.show?'shown to':'hidden from'} players`)}
    if(s.T!=='path')saveHX();render()}};
// selection: copy what lies inside (terrain, places, notes, tokens, paths wholly inside), paste with the first selected hex at the clicked one
// ponytail: a pasted copy moves by the world offset between two hex centres, which is a lattice step on both orientations
const hxSelSet=()=>new Set(S.hx.selK);
const hxOnGrid=k=>{const [q,r]=k.split(',').map(Number);return q>=0&&r>=0&&q<HX.w&&r<HX.h};
function hxCopy(){const ks=S.hx.selK.slice().sort((a,b)=>{const [q1,r1]=a.split(',').map(Number),[q2,r2]=b.split(',').map(Number);return r1-r2||q1-q2});if(!ks.length){toast('Select some hexes first');return 0}
  const set=new Set(ks),inside=pts=>pts.every(p=>set.has(near(HX,...p)));
  HXE.clip={a:ctr(HX,ks[0]),t:Object.fromEntries(ks.filter(k=>HX.t[k]).map(k=>[k,HX.t[k]])),ks,pois:HX.pois.filter(p=>set.has(p.k)),notes:HX.notes.filter(n=>set.has(n.k)),
    tokens:(HX.tokens||[]).filter(o=>set.has(o.k)),paths:HX.paths.filter(p=>inside(p.pts))};return ks.length}
function hxClipAt(k){const c=HXE.clip,[x,y]=ctr(HX,k),dx=x-c.a[0],dy=y-c.a[1],mv=kk=>{const [a,b]=ctr(HX,kk),n=near(HX,a+dx,b+dy);return hxOnGrid(n)?n:null};
  return {mv,dx,dy,ks:c.ks.map(mv).filter(Boolean)}}
function hxPasteAt(k){const c=HXE.clip;if(!c)return;const {mv,dx,dy,ks}=hxClipAt(k);hxDo();hxTerrCopy();
  for(const [kk,t] of Object.entries(c.t)){const n=mv(kk);if(n)HX.t[n]=t}
  const at=o=>({...o,k:mv(o.k)}),ok=o=>o.k,pois=c.pois.map(at).filter(ok),tgt=new Set(pois.map(p=>p.k));
  HX.pois=[...HX.pois.filter(p=>!tgt.has(p.k)),...pois];HX.notes=[...HX.notes,...c.notes.map(at).filter(ok)];HX.tokens=[...(HX.tokens||[]),...c.tokens.map(at).filter(ok)];
  HX.paths=[...HX.paths,...c.paths.map(p=>({type:p.type,pts:p.pts.map(([x,y])=>[x+dx,y+dy])}))];S.hx.selK=ks;S.hx.paste=false;saveHX();render();toast(`Pasted ${ks.length} hex${ks.length===1?'':'es'}`)}
// Delete clears the terrain; Cut also takes the places, notes, tokens and paths inside with it
function hxSelClear(cut){const set=hxSelSet();if(!set.size)return;hxDo();hxTerrCopy();for(const k of set)delete HX.t[k];
  if(cut){HX.pois=HX.pois.filter(p=>!set.has(p.k));HX.notes=HX.notes.filter(n=>!set.has(n.k));HX.tokens=(HX.tokens||[]).filter(o=>!set.has(o.k));const inside=pts=>pts.every(p=>set.has(near(HX,...p)));HX.paths=HX.paths.filter(p=>!inside(p.pts))}
  saveHX();render()}

/* ---------- drawing ---------- */
const hxBlankKeys=m=>{const out=[];for(let q=0;q<m.w;q++)for(let r=0;r<m.h;r++){const k=q+','+r;if(!m.t[k])out.push(k)}return out};
// blank cells as paper; terrain changed since the painting on screen (alt) as flat colour; the selection
function hxEdOverlay(alt){const d=S.hx.draw;return `<g class="hxed"><g class="base">${hxEdBase(alt)}</g><g class="live">${d?`<path class="edraw ${esc(d.type)}" d="${hxCurve(d.ks.map(k=>ctr(HX,k)))}"/>`:''}</g></g>`}
function hxEdBase(alt){const m=HX;let out='';const blank=hxBlankKeys(m);if(blank.length)out+=BLANK+hxPathD(m,blank)+'"/>';
  if(alt){const by={};for(const k in m.t)if(m.t[k]!==alt[k])(by[m.t[k]]??=[]).push(k);
    for(const [t,ks] of Object.entries(by))out+=`<path class="pend" style="fill:${hxType(m,t)[1]}" d="${hxPathD(m,ks,1.005)}"/>`;
    const old=HXE.pp.get(alt)||[];for(const p of m.paths)if(!old.includes(p)&&p.pts.length>1)out+=`<path class="edraw ${esc(p.type)}" d="${hxCurve(p.pts)}"/>`}
  const T=S.hx.tool,g=HX.regs[S.hx.reg],sel=d=>`<path class="esel0" d="${d}"/><path class="esel" d="${d}"/>`;
  if(T==='region'&&g?.ks.length)out+=S.hx.rview==='line'?`<path class="eline" style="stroke:${g.color||HX_RCOL[0]}" d="${hxEdges(m,g.ks)}"/>`:`<path class="etint" style="fill:${g.color||HX_RCOL[0]}" d="${hxPathD(m,g.ks)}"/>`;
  if(T==='fog'){const hid=Object.keys(m.t).filter(k=>!m.seen[k]);if(hid.length)out+=`<path class="efog" d="${hxPathD(m,hid)}"/>`}
  if(T==='select'){const hid=Object.keys(m.t).filter(k=>!m.seen[k]);if(hid.length)out+=`<path class="efog" d="${hxPathD(m,hid)}"/>`;
    if(S.hx.selK.length)out+=`<path class="esela" d="${hxPathD(m,S.hx.selK)}"/>`+sel(hxEdges(m,S.hx.selK))}
  if(T==='token'&&HX.tokens?.[S.hx.tsel]){const [x,y]=ctr(m,HX.tokens[S.hx.tsel].k);out+=sel(`M${(x-.5).toFixed(2)},${(y+.08).toFixed(2)}a.5,.5 0 1,0 1,0a.5,.5 0 1,0 -1,0`)}
  if(T==='path'&&HX.paths[S.hx.pthsel])out+=sel(hxCurve(HX.paths[S.hx.pthsel].pts));
  if(T==='note'){const ks=[...new Set(m.notes.map(n=>n.k))];out+=ks.map(k=>{const [x,y]=ctr(m,k);return `<circle class="enote" cx="${(x+.5).toFixed(2)}" cy="${(y-.5).toFixed(2)}" r=".16"/>`}).join('');
    if(S.hx.nsel)out+=sel(hxPathD(m,[S.hx.nsel],.92))}
  if(T==='poi'&&HX.pois[S.hx.psel]){const [x,y]=ctr(m,HX.pois[S.hx.psel].k);out+=sel(`M${(x-.66).toFixed(2)},${y.toFixed(2)}a.66,.66 0 1,0 1.32,0a.66,.66 0 1,0 -1.32,0`)}
  return out}
// the outline of a set of hexes (edges whose neighbour is outside it)
function hxEdges(m,ks){const set=new Set(ks);let d='';for(const k of ks){const [x,y]=ctr(m,k);for(const nb of nbs(m,k))if(!set.has(nb.k))d+=hxEdgeD(x,y,360-Math.round(nb.ang/60)*60)}return d}
// the new painting is ready (hxLoadTick): swap it in place of the old one and redraw the overlay; the panel, and anything typed in it, stays
function hxEdSwap(s){const t=s.m.t,svg=$('svg',s.st);if(!svg)return;let n=HX_PC.get(t);
  if(!n){const j=HX_JOB.get(t);if(typeof j!=='string')return;n=document.createElementNS('http://www.w3.org/2000/svg','g');n.setAttribute('class','hxpaint');n.innerHTML=j;HX_PC.set(t,n);HX_JOB.delete(t)}
  const old=$(':scope>.hxpaint',svg);if(old!==n){if(old)old.replaceWith(n);else svg.prepend(n)}
  HXE.shown=t;HXE.alt=null;s.m=HX.t===t?HX:{t};if(typeof hxGLShow==='function')hxGLShow(s.st,s.m);
  const b=$('.hxed .base',svg);if(b)b.innerHTML=hxEdBase(HX.t!==t?t:null)}
// place icons for the palette: one hidden sprite, <use> in the buttons
function hxIconSprite(){if($('#hxisprite'))return;document.body.insertAdjacentHTML('beforeend',`<svg id="hxisprite" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${
  Object.keys(HX_POI).map(t=>{const ic=hxPoiIcon(t);return ic?`<symbol id="hxi-${t}" viewBox="0 0 512 512"><path d="${ic[2].join(' ')}"/></symbol>`:''}).join('')}</defs></svg>`)}

/* ---------- screen ---------- */
const HX_TOOLS=[['brush','Brush','B'],['poi','Places','F'],['erase','Eraser','E'],['select','Select','S'],['fog','Fog','V'],['path','Paths','P'],['region','Regions','R'],['wall','Walls','G'],['note','Notes','N'],['token','Tokens','M'],['pan','Pan','H']];
const HX_KEYS=Object.fromEntries(HX_TOOLS.map(([v,,k])=>[k.toLowerCase(),v]));
const ICO2={brush:'<path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L11.6 15.2l-2.9-2.9z"/><path d="M8.2 13.4c-2.1 0-3.7 1.6-3.7 3.7 0 1.3-.8 2.4-2 2.9 1 .6 2.4 1 3.6 1 2.8 0 4.6-1.9 4.6-4.5z"/>',
  erase:'<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L11 21z"/><path d="M22 21H7M5.5 11.5l7 7"/>',
  poi:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  path:'<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19h8a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7h8"/>',
  region:'<path d="M12 2.5 20.5 7.3v9.4L12 21.5l-8.5-4.8V7.3z" stroke-dasharray="3.2 2.4"/>',
  wall:'<path d="M12 3 4.2 7.5v9L12 21l7.8-4.5v-9z" stroke-opacity=".5"/><path d="M19.8 7.5v9" stroke-width="3.6"/>',
  note:'<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5z"/><path d="M15 3v6h6M7 13h10M7 17h6"/>',
  pan:'<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  select:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M11 4h2M11 20h2M4 11v2M20 11v2"/>',
  token:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
  fog:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16" stroke-opacity=".55"/>',
  save:'<path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  pick:'<path d="m2 22 1-1h3l9-9M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3z"/>'};
const hxIco2=k=>`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICO2[k]}</svg>`;
function hxModeSeg(){return `<div class="hxtools hxmode" role="group" aria-label="Map mode"><button type="button" data-action="hxmode" data-v="edit" aria-pressed="${!!S.hx.edit}">Edit</button><button type="button" data-action="hxmode" data-v="play" aria-pressed="${!S.hx.edit}">Play</button></div>`}
const hxSizeSeg=label=>`<div class="seg hxseg" role="group" aria-label="${label||'Brush size'}">${[1,2,3,4,5].map(n=>`<button type="button" data-action="hxsize" data-v="${n}" aria-pressed="${S.hx.size===n}" title="${n===1?'One hex':`${3*n*(n-1)+1} hexes`}">${n}</button>`).join('')}</div>`;
// the app's own colour picker: map inks in six hues, three shades each, and neutrals; a hex field for anything else
const HX_PAL=['#6e2a24','#7a4a1f','#3f5a26','#224a6e','#4f2f66','#6b5a1c','#8b4a3d','#a0642c','#4f7a36','#35598a','#7a4a86','#8a7330','#c0705e','#c9924e','#7fa35a','#6f93bf','#a882b3','#c4a95a','#1f1b17','#4a423a','#7a6f63','#a89c8c','#d8ccb4','#f3ecd9'];
const hxColOK=c=>/^#[0-9a-f]{6}$/i.test(c||'');
const hxColT=id=>id==='region'?HX.regs[S.hx.reg]:id==='token'?HX.tokens?.[S.hx.tsel]:null;
const hxColField=(id,label,val)=>`<div class="fld hxcolf"><span class="small">${label}</span><button type="button" class="btn sm hxcolb" data-action="hxcolor" data-for="${id}" aria-expanded="${S.hx.cp===id}"><i style="--c:${val}"></i>${val}</button>
  ${S.hx.cp===id?`<div class="hxcp" role="group" aria-label="${label}"><div class="hxcpg">${HX_PAL.map(c=>`<button type="button" data-action="hxcpick" data-for="${id}" data-v="${c}" aria-label="${c}" aria-pressed="${c===val}" style="--c:${c}"></button>`).join('')}</div>
   <label class="hxcph"><span class="small">Hex</span><input type="text" id="hxcp-hex" data-for="${id}" value="${val}" maxlength="7" autocomplete="off" spellcheck="false"></label></div>`:''}</div>`;
// painted terrain swatches: crops of our own painting of each type (tools/hexswatch.cjs → icons/terrain-swatches.webp), in this order
const HX_SWI=Object.fromEntries(HX_TGROUPS.flatMap(g=>g[1]).map((t,i)=>[t,i]));
const hxH=(l,key,extra='')=>`<h3 class="hxh">${l}${key?` <kbd class="hxk" title="Shortcut">${key}</kbd>`:''}${extra}</h3>`;
function hxEdPanel(){const T=S.hx.tool,m=HX;let b='';
  if(T==='brush'){const q=S.hx.q.trim().toLowerCase(),known=new Set(HX_TGROUPS.flatMap(g=>g[1])),own=[...new Set(Object.values(m.t))].filter(t=>!known.has(t));
    const sw=t=>{const n=tName(m,t);return `<button type="button" class="hxswb" data-action="hxterr" data-v="${esc(t)}" data-q="${esc(n.toLowerCase())}" aria-pressed="${S.hx.terr===t}"${q&&!n.toLowerCase().includes(q)?' hidden':''}><i${HX_SWI[t]!=null&&!m.colors?.[t]?` class="sp" style="--c:${hxType(m,t)[1]};--sx:${HX_SWI[t]}"`:` style="--c:${hxType(m,t)[1]}"`}></i>${esc(n)}</button>`};
    b=`<section class="hxsec">${hxH('Brush','B')}${hxSizeSeg()}
      <div class="hxsrch"><input type="search" id="hxe-q" placeholder="Search terrain" aria-label="Search terrain" value="${esc(S.hx.q)}" autocomplete="off">
       <button type="button" class="btn sm" data-action="hxpick" aria-pressed="${S.hx.pick}" title="Pick a terrain from the map (Alt-click)">${hxIco2('pick')}Pick</button></div>
      <p class="small muted">Drag to paint. Alt-click picks the terrain under the pointer; [ and ] change the size.</p>
      ${[...HX_TGROUPS,...own.length?[['On this map',own]]:[]].map(([g,ts])=>`<div class="hxtg"><h4 class="bh">${g}</h4><div class="hxsw">${ts.map(sw).join('')}</div></div>`).join('')}
      <button type="button" class="btn" data-action="hxfill">Fill the blank hexes with ${esc(tName(m,S.hx.terr))}</button></section>`}
  else if(T==='erase')b=`<section class="hxsec">${hxH('Eraser','E')}${hxSizeSeg('Eraser size')}<p class="small muted">Drag across hexes to clear their terrain. Places, notes, paths and walls stay where they are.</p></section>`;
  else if(T==='fog'){const hid=Object.keys(m.t).filter(k=>!m.seen[k]).length;
    b=`<section class="hxsec">${hxH('Fog','V')}<div class="seg hxseg" role="group" aria-label="Fog brush"><button type="button" data-action="hxfmode" data-v="show" aria-pressed="${S.hx.fmode!=='hide'}">Reveal</button><button type="button" data-action="hxfmode" data-v="hide" aria-pressed="${S.hx.fmode==='hide'}">Hide</button></div>${hxSizeSeg('Fog brush size')}
      <p class="small muted" style="margin:0">Paint over hexes to show them to the players at once; Hide paints the fog back. Alt-drag does the other. Shaded hexes are hidden: ${hid} of ${Object.keys(m.t).length}.</p>
      ${HX.party?`<h4 class="bh">Around the party</h4><div class="row">${[1,2,3].map(r=>`<button type="button" class="btn sm" data-action="hxfogr" data-v="${r}">Reveal ${r} hex${r>1?'es':''} around</button>`).join('')}</div>`:''}
      <div class="row"><button type="button" class="btn sm" data-action="hxfogall" data-v="show"${hid?'':' disabled'}>Reveal the whole map</button><button type="button" class="btn sm" data-action="hxfogall" data-v="hide">Hide everything</button></div></section>`}
  else if(T==='select'){const n=S.hx.selK.length,dis=n?'':' disabled';
    b=`<section class="hxsec">${hxH('Select','S')}<div class="seg hxseg" role="group" aria-label="Selection brush"><button type="button" data-action="hxsmode" data-v="add" aria-pressed="${S.hx.smode==='add'}">Add</button><button type="button" data-action="hxsmode" data-v="remove" aria-pressed="${S.hx.smode==='remove'}">Remove</button></div>${hxSizeSeg('Selection brush size')}
      <div class="row"><button type="button" class="btn sm" data-action="hxsel" data-v="all">Select all</button><button type="button" class="btn sm" data-action="hxsel" data-v="invert">Invert</button><button type="button" class="btn sm" data-action="hxsel" data-v="none"${dis}>Deselect</button></div>
      <p class="small muted" style="margin:0">Paint over hexes to select them; Alt-drag takes hexes out. Hexes the players haven’t seen are shaded.</p></section>
     <section class="hxsec"><h3 class="hxh">${n?`${n} hex${n===1?'':'es'} selected`:'Nothing selected'}</h3>
      <h4 class="bh" style="margin-top:0">Fog of war</h4><div class="row"><button type="button" class="btn sm primary" data-action="hxsfog" data-v="show"${dis}>Show to players</button><button type="button" class="btn sm" data-action="hxsfog" data-v="hide"${dis}>Hide from players</button></div>
      <h4 class="bh">Terrain and copies</h4><div class="row"><button type="button" class="btn sm" data-action="hxsfill"${dis}>Fill with ${esc(tName(m,S.hx.terr))}</button><button type="button" class="btn sm" data-action="hxsdel"${dis}>Clear terrain</button></div>
      <div class="row"><button type="button" class="btn sm" data-action="hxscopy"${dis}>Copy</button><button type="button" class="btn sm" data-action="hxscut"${dis}>Cut</button><button type="button" class="btn sm" data-action="hxspaste" aria-pressed="${S.hx.paste}"${HXE.clip?'':' disabled'}>Paste</button></div>
      ${S.hx.paste?'<p class="small" style="margin:0"><b>Click a hex</b> to paste the copy there, its first hex on the one you click. Esc cancels.</p>':'<p class="small muted" style="margin:0">Fill uses the brush’s terrain. Copy takes terrain, places, notes, tokens and paths wholly inside. Keys: Ctrl+C, Ctrl+X, Ctrl+V, Delete, Ctrl+A, Esc.</p>'}</section>`}
  else if(T==='token'){const o=m.tokens?.[S.hx.tsel],col=c=>hxColOK(c)?c:HX_RCOL[0];
    b=(o?`<section class="hxsec">${hxH(esc(o.name||'Token'),'',` <span class="muted">hex ${o.k}</span>`)}
      <label class="fld"><span class="small">Name</span><input type="text" id="hxt-name" value="${esc(o.name)}" maxlength="40" autocomplete="off"></label>
      ${hxColField('token','Colour',col(o.color))}
      <label class="hxchk"><input type="checkbox" id="hxt-show"${o.show?' checked':''}> Players see it, once they have seen its hex</label>
      <div class="row"><button type="button" class="btn sm" data-action="hxtdesel">Done</button><button type="button" class="btn sm danger" data-action="hxtdel">Delete token</button></div>
      <p class="small muted" style="margin:0">Drag a token on the map to move it.</p></section>`:'')
     +`<section class="hxsec">${hxH('Tokens','M')}<p class="small muted" style="margin:0">Click a hex to put a token there: raiders on the move, an army, a rival band. Click a token to edit it, drag to move it.</p>
      ${(m.tokens||[]).map((t,i)=>`<div class="hxrow"><button type="button" class="hxlnk" data-action="hxtsel" data-i="${i}" aria-pressed="${i===S.hx.tsel}"><i class="hxdot" style="--c:${col(t.color)}"></i>${esc(t.name||'Token')} <span class="small muted">hex ${t.k}${t.show?' · players see it':' · hidden'}</span></button></div>`).join('')}</section>`}
  else if(T==='poi'){hxIconSprite();const p=m.pois[S.hx.psel];
    b=(p?`<section class="hxsec">${hxH(esc(p.label||tName(m,p.type)),'',` <span class="muted">hex ${p.k}</span>`)}
      <label class="fld"><span class="small">Name on the map</span><input type="text" id="hxp-label" value="${esc(p.label)}" maxlength="60" autocomplete="off"></label>
      <label class="fld"><span class="small">Type</span><select id="hxp-type">${HX_PGROUPS.map(([g,ts])=>`<optgroup label="${g}">${ts.map(t=>`<option value="${t}"${t===p.type?' selected':''}>${esc(tName(m,t))}</option>`).join('')}</optgroup>`).join('')}${HX_POI[p.type]?'':`<option value="${esc(p.type)}" selected>${esc(tName(m,p.type))}</option>`}</select></label>
      <label class="hxchk"><input type="checkbox" id="hxp-found"${p.found?' checked':''}> Players know about it</label>
      <div class="row"><button type="button" class="btn sm" data-action="hxpdesel">Done</button><button type="button" class="btn sm danger" data-action="hxpdel">Delete place</button></div>
      <p class="small muted">Drag a place on the map to move it.</p></section>`:'')
     +`<section class="hxsec">${hxH('Places','F')}<p class="small muted">Pick a type, then click a hex. Click a place to rename, retype or delete it.</p>
      ${HX_PGROUPS.map(([g,ts])=>`<div class="hxtg"><h4 class="bh">${g}</h4><div class="hxsw">${ts.map(t=>`<button type="button" class="hxptb" data-action="hxptype" data-v="${t}" aria-pressed="${S.hx.ptype===t}" style="--c:${hxPoiCol(t)}"><svg viewBox="0 0 512 512" aria-hidden="true"><use href="#hxi-${t}"/></svg>${esc(tName(m,t))}</button>`).join('')}</div></div>`).join('')}</section>`}
  else if(T==='path'){const d=S.hx.draw,cur=d?d.type:S.hx.pk;
    b=`<section class="hxsec">${hxH('Paths','P')}<div class="seg hxseg" role="group" aria-label="Path type">${Object.entries(HX_PK).map(([v,l])=>`<button type="button" data-action="hxpk" data-v="${v}" aria-pressed="${cur===v}"><i class="hxpl ${v}"></i>${l}</button>`).join('')}</div>
      ${d?`<p class="small" style="margin:0"><b>Drawing a ${hxPkName(d.type).toLowerCase()}:</b> ${d.ks.length} hex${d.ks.length>1?'es':''}. Click the last hex again or press Enter to finish.</p>
        <div class="row"><button type="button" class="btn sm primary" data-action="hxpfin">Finish</button><button type="button" class="btn sm" data-action="hxpback"${d.ks.length>1?'':' disabled'}>Take back a hex</button><button type="button" class="btn sm ghost" data-action="hxpcancel">Cancel</button></div>`
       :'<p class="small muted" style="margin:0">Click hexes one after another, or drag through them. Click the last hex again or press Enter to finish; Esc cancels. Roads and trails make travel faster.</p>'}</section>
     <section class="hxsec"><h3 class="hxh">On the map <span class="muted">${m.paths.length}</span></h3>${m.paths.length?m.paths.map((p,i)=>`<div class="hxrow${i===S.hx.pthsel?' on':''}"><button type="button" class="hxlnk" data-action="hxpthsel" data-i="${i}" aria-pressed="${i===S.hx.pthsel}"><i class="hxpl ${esc(p.type)}"></i>${esc(hxPkName(p.type))} <span class="small muted">${p.pts.length} hexes · ${near(m,...p.pts[0])} → ${near(m,...p.pts.at(-1))}</span></button><button type="button" class="btn sm ghost" data-action="hxpthdel" data-i="${i}">Delete</button></div>`).join(''):'<p class="small muted" style="margin:0">No roads, trails or rivers yet.</p>'}</section>`}
  else if(T==='region'){const g=m.regs[S.hx.reg],col=c=>/^#[0-9a-f]{6}$/i.test(c||'')?c:HX_RCOL[0];
    b=`<section class="hxsec">${hxH('Regions','R')}${m.regs.length?`<div class="hxregs">${m.regs.map((r,i)=>`<button type="button" class="hxrg" data-action="hxrsel" data-i="${i}" aria-pressed="${i===S.hx.reg}"><i style="--c:${col(r.color)}"></i>${esc(r.name||'Unnamed')}<span class="small muted">${r.ks.length} hex${r.ks.length===1?'':'es'}</span></button>`).join('')}</div>`:'<p class="small muted" style="margin:0">No regions yet: kingdoms, baronies, wilds with a name.</p>'}
      <div class="row"><button type="button" class="btn sm" data-action="hxrnew">New region</button></div>
      <div class="seg hxseg" role="group" aria-label="Show the region"><button type="button" data-action="hxrview" data-v="fill" aria-pressed="${S.hx.rview!=='line'}">Fill</button><button type="button" data-action="hxrview" data-v="line" aria-pressed="${S.hx.rview==='line'}">Border only</button></div></section>
     ${g?`<section class="hxsec">${hxH(esc(g.name||'Unnamed'))}
      <label class="fld"><span class="small">Name</span><input type="text" id="hxr-name" value="${esc(g.name)}" maxlength="40" autocomplete="off"></label>
      ${hxColField('region','Border colour',col(g.color))}
      <div class="seg hxseg" role="group" aria-label="Paint mode"><button type="button" data-action="hxrmode" data-v="add" aria-pressed="${S.hx.rmode==='add'}">Add hexes</button><button type="button" data-action="hxrmode" data-v="remove" aria-pressed="${S.hx.rmode==='remove'}">Remove hexes</button></div>
      ${hxSizeSeg('Region brush size')}<p class="small muted" style="margin:0">Drag over hexes to ${S.hx.rmode==='remove'?'take them out of':'add them to'} this region. A hex belongs to one region at a time.</p>
      <div class="row"><button type="button" class="btn sm danger" data-action="hxrdel">Delete region</button></div></section>`:''}`}
  else if(T==='wall'){const n=Object.values(m.blk||{}).reduce((a,e)=>a+e.length,0);
    b=`<section class="hxsec">${hxH('Walls','G')}<p class="small muted" style="margin:0">Click near a hex edge to put up a wall — a cliff, a palisade, a closed border — and click it again to take it down. Routes go around walls.</p><p class="small" style="margin:0">${n} wall${n===1?'':'s'} on the map.</p></section>`}
  else if(T==='note'){const k=S.hx.nsel,ns=k?m.notes.map((n,i)=>[n,i]).filter(([n])=>n.k===k):[],e=m.notes[S.hx.nedit];
    b=`<section class="hxsec">${hxH('Notes','N')}${!k?'<p class="small muted" style="margin:0">Click a hex to read its notes or add one. Ref-only notes never reach the players; the others show once the party has seen the hex.</p>'
     :`<h4 class="bh">Hex ${k}${m.t[k]?' · '+esc(tName(m,m.t[k])):''}</h4>${ns.map(([n,i])=>`<div class="hxnote"><b>${esc(n.title||'Untitled')}</b> <span class="tag">${n.dm?'Ref only':'players see it'}</span>${n.text?`<p>${esc(n.text)}</p>`:''}
        <div class="row"><button type="button" class="btn sm ghost" data-action="hxnedit" data-i="${i}">Edit</button><button type="button" class="btn sm ghost" data-action="hxndel" data-i="${i}">Delete</button></div></div>`).join('')}
      <div class="hxform"><label class="fld"><span class="small">Title</span><input type="text" id="hxnt-title" value="${e?esc(e.title):''}" maxlength="80" autocomplete="off"></label>
       <label class="fld"><span class="small">Text</span><textarea id="hxnt-text" rows="4" maxlength="4000">${e?esc(e.text):''}</textarea></label>
       <label class="hxchk"><input type="checkbox" id="hxnt-dm"${!e||e.dm?' checked':''}> Ref only</label>
       <div class="row"><button type="button" class="btn sm primary" data-action="hxnadd">${e?'Save the note':'Add the note'}</button>${e?'<button type="button" class="btn sm ghost" data-action="hxncancel">Cancel</button>':''}</div></div>`}</section>
     ${m.notes.length?`<section class="hxsec"><h3 class="hxh">All notes <span class="muted">${m.notes.length}</span></h3>${m.notes.map(n=>`<button type="button" class="hxlnk hxrow" data-action="hxnsel" data-k="${n.k}">${esc(n.title||'Untitled')} <span class="small muted">hex ${n.k}${n.dm?' · Ref only':''}</span></button>`).join('')}</section>`:''}`}
  else b=`<section class="hxsec">${hxH('Pan','H')}<p class="small muted" style="margin:0">Drag to move the map. With any tool: hold Space and drag, drag with the middle button, or use two fingers. The wheel or a pinch zooms.</p></section>`;
  const painted=Object.keys(m.t).length;
  return b+`<section class="hxsec">${hxH('Map')}<label class="fld"><span class="small">Name</span><input type="text" id="hxm-name" value="${esc(m.name)}" maxlength="60" autocomplete="off"></label>
    <p class="small muted" style="margin:0">${m.w} × ${m.h} hexes · ${m.flat?'flat':'pointy'}-top · ${painted} painted · ${m.pois.length} place${m.pois.length===1?'':'s'}</p>
    ${hxSavedLine()}
    <div class="row"><button type="button" class="btn sm primary" data-action="hxsave">Save</button><button type="button" class="btn sm" data-action="hxexport">Export for Hexer</button><button type="button" class="btn sm" data-action="hxpng">Save as PNG</button></div>
    <div class="row"><button type="button" class="btn sm" data-action="hxnew">New map</button><button type="button" class="btn sm" data-action="hxgen">Generate</button>${fileBtn('Import from Hexer').replace('class="btn','class="btn sm')}</div>
    <p class="small muted" style="margin:0">${esc(HX_ICON_CREDIT)}</p></section>`}
function hxEditScreen(){HX.blk??={};const ready=hxEdReady(HX.t);if(ready)HXE.shown=HX.t;const alt=HXE.alt=!ready&&HXE.shown&&HXE.shown!==HX.t?HXE.shown:null;HXE.pp.set(HX.t,HX.paths);
  const regs=HX.regs.filter(g=>g.name&&g.ks.length).map(g=>{const c=g.ks.map(k=>ctr(HX,k));return {name:g.name,color:g.color,x:c.reduce((a,v)=>a+v[0],0)/c.length,y:c.reduce((a,v)=>a+v[1],0)/c.length}});
  return `<div class="hxstage hxedit" data-panel="${S.hx.panel?'open':'closed'}" data-tool="${S.hx.tool}" tabindex="0" aria-label="${esc(HX.name)}, map editor. Drag to use the current tool; hold Space and drag, or use two fingers, to move the map; wheel or pinch to zoom; arrow keys pan.">
    ${hxSVG(HX,{edit:1,alt,pois:HX.pois.map(({found,...p})=>p),party:HX.party,regs,ed:hxEdOverlay(alt)})}
    <div class="hxhud bar hxui">${hxModeSeg()}<div class="hxtools" role="group" aria-label="History"><button type="button" data-action="hxeundo" aria-label="Undo" title="Undo (Ctrl+Z)"${HXE.u.length?'':' disabled'}>${hxIco2('undo')}</button><button type="button" data-action="hxeredo" aria-label="Redo" title="Redo (Ctrl+Y)"${HXE.r.length?'':' disabled'}>${hxIco2('redo')}</button><button type="button" data-action="hxsave" class="hxsavebtn" aria-label="Save" title="Save (Ctrl+S)">${hxIco2('save')}<span>Save</span></button></div><span class="hxgrow"></span>${hxTools('',true)}
     <i class="hxbr" aria-hidden="true"></i><div class="hxrail" role="toolbar" aria-label="Map tools">${HX_TOOLS.map(([v,l,k])=>`<button type="button" data-action="hxtool" data-v="${v}" aria-pressed="${S.hx.tool===v}" aria-label="${l}" aria-keyshortcuts="${k}" title="${l} (${k})">${hxIco2(v)}</button>`).join('')}</div></div>
    <div class="hxcard hxui" hidden></div>${pingMenu}
    <aside class="hxpanel hxui" aria-label="Map editor">${hxEdPanel()}</aside></div>`}
function hxEditAfter(){HXE.stroke=null;const grid=[];for(let q=0;q<HX.w;q++)for(let r=0;r<HX.h;r++)grid.push(q+','+r);
  hxStage(HX,{edit:1,alt:HXE.alt,party:null,sel:null,fitK:grid.length?grid:null,card:()=>'',paint:hxEdPaint,
    preview:k=>S.hx.tool==='path'&&S.hx.draw?[S.hx.draw.ks.at(-1),k]:null});
  const p=$('.hxedit .hxpanel');if(p){p.scrollTop=S.hx.pscroll||0;p.onscroll=()=>{S.hx.pscroll=p.scrollTop}}
  // a short stage (large text, a wrapped HUD): the tool column scrolls instead of running off the map
  const st=$('.hxedit'),rl=$('.hxedit .hxrail');if(st&&rl&&getComputedStyle(rl).flexDirection==='column'){const top=rl.getBoundingClientRect().top-st.getBoundingClientRect().top;rl.style.maxHeight=Math.max(132,st.clientHeight-top-12)+'px'}}

/* ---------- dialogs ---------- */
const hxSide=(v,d)=>Math.max(4,Math.min(HX_MAXSIDE,Math.round(+v)||d));
const hxReplace=go=>HX?askYes('Replace the hex map?',`${HX.name}, the party’s place on it and its journey log give way to the new map. Export it for Hexer first if you want to keep it.`,'Replace',go):go();
const hxOri=`<fieldset class="hxori"><legend class="small">Hexes</legend><label title="Rows stagger side to side"><input type="radio" name="hxo" value="pointy" checked> Pointy-top</label><label title="Columns stagger up and down"><input type="radio" name="hxo" value="flat"> Flat-top</label></fieldset>`;
function hxNewDlg(){const dl=$('#dlg');
  dl.innerHTML=`<form method="dialog" class="hxdlg"><h2>New map</h2>
   <label class="fld"><b>Name</b><input type="text" id="hxn-name" placeholder="The Western Marches" maxlength="60" autocomplete="off"></label>
   <div class="row"><label class="fld"><b>Width</b><input type="number" id="hxn-w" min="4" max="${HX_MAXSIDE}" value="30" required></label><label class="fld"><b>Height</b><input type="number" id="hxn-h" min="4" max="${HX_MAXSIDE}" value="20" required></label></div>
   ${hxOri}<p class="small muted">The map starts blank. Paint it with the brush, or use Generate for a rough world to refine.</p>
   <div class="row" style="justify-content:flex-end;margin-top:1rem"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" value="ok">Create</button></div></form>`;
  dlgOk(dl,()=>{const o={name:$('#hxn-name').value,w:hxSide($('#hxn-w').value,30),h:hxSide($('#hxn-h').value,20),flat:$('input[name=hxo]:checked',dl).value==='flat'};hxReplace(()=>hxSetMap(hxNewMap(o)))});
  dl.showModal();$('#hxn-name').focus()}
const HX_GEN={island:{n:'Island',d:'One island in a deep sea, mountains at its heart.',w:30,h:22,sea:.5,temp:.55,wet:.55,f:1.6},
  continent:{n:'Continent',d:'A wide land with coasts, ranges, forests and plains.',w:40,h:30,sea:.4,temp:.52,wet:.5,f:2.2},
  archipelago:{n:'Archipelago',d:'Scattered islands across a wide sea.',w:36,h:28,sea:.53,temp:.6,wet:.6,f:3.4},
  north:{n:'Frozen north',d:'Tundra and glaciers, sparse pines, mountain passes.',w:30,h:24,sea:.36,temp:.14,wet:.45,f:2.2},
  desert:{n:'Desert',d:'Dunes and badlands, canyons, rare oases.',w:30,h:24,sea:.2,temp:.9,wet:.14,f:2},
  valley:{n:'River valley',d:'Green lowlands between two ranges, cut by rivers.',w:24,h:32,sea:.18,temp:.52,wet:.5,f:2}};
function hxGenDlg(){const dl=$('#dlg'),T=HX_GEN.continent;
  dl.innerHTML=`<form method="dialog" class="hxdlg hxgen"><h2>Generate a world</h2><p class="small muted" style="margin-top:0">Terrain, mountain ranges, rivers and lakes from a seed; no settlements or names. The same seed gives the same world. Refine it by hand afterwards.</p>
   <fieldset class="hxtpl"><legend class="small">Start from</legend>${Object.entries(HX_GEN).map(([k,g])=>`<label><input type="radio" name="hxg-tpl" value="${k}" data-w="${g.w}" data-h="${g.h}"${k==='continent'?' checked':''}><b>${g.n}</b><span class="small muted">${g.d}</span></label>`).join('')}</fieldset>
   <div class="row"><label class="fld"><b>Width</b><input type="number" id="hxg-w" min="4" max="${HX_MAXSIDE}" value="${T.w}" required></label><label class="fld"><b>Height</b><input type="number" id="hxg-h" min="4" max="${HX_MAXSIDE}" value="${T.h}" required></label></div>
   <div class="fld"><label for="hxg-seed"><b>Seed</b></label><div class="row" style="flex-wrap:nowrap"><input type="text" id="hxg-seed" value="${1+Math.floor(Math.random()*9999)}" maxlength="24" autocomplete="off" style="flex:1;min-width:0"><button type="button" class="btn" id="hxg-rnd">Surprise me</button></div></div>
   ${hxOri}<div class="row" style="justify-content:flex-end;margin-top:1rem"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" value="ok">Generate</button></div></form>`;
  dl.querySelectorAll('input[name=hxg-tpl]').forEach(r=>r.onchange=()=>{$('#hxg-w').value=r.dataset.w;$('#hxg-h').value=r.dataset.h});
  $('#hxg-rnd').onclick=()=>{$('#hxg-seed').value=1+Math.floor(Math.random()*99999)};
  dlgOk(dl,()=>{const o={tpl:$('input[name=hxg-tpl]:checked',dl).value,w:hxSide($('#hxg-w').value,30),h:hxSide($('#hxg-h').value,20),seed:$('#hxg-seed').value.trim()||'1',flat:$('input[name=hxo]:checked',dl).value==='flat'};
    hxReplace(()=>hxSetMap(hxGen(o)))});dl.showModal()}

/* ---------- world generator ---------- */
// Elevation from value noise shaped by the template, sea below a level; a priority flood from the sea and the map edge gives every
// land hex a way down, rivers run where enough land drains through, pits that hold water become lakes; climate picks the biome.
function hxGen({tpl='continent',w=30,h=20,seed=1,flat=false}){const G=HX_GEN[tpl]||HX_GEN.continent,S0=/^\d+$/.test(String(seed))?+seed:hxHash(String(seed)),R=hxRand(Math.imul(S0,2654435761)>>>0||1);
  const m=hxNewMap({name:`${G.n} ${seed}`,w,h,flat}),K=[],n=w*h,ox=R()*512,oy=R()*512,mx=R()*512,my=R()*512,tx=R()*512;
  const fbm=(x,y,o=4)=>{let s=0,a=.5,f=1,t=0;for(let i=0;i<o;i++){s+=a*hxVN(x*f+i*19.1,y*f-i*7.7);t+=a;a*=.5;f*=2.03}return s/t};
  const rnd=(i,salt)=>hxN(i*31+salt,S0);
  for(let r=0;r<h;r++)for(let q=0;q<w;q++)K.push(q+','+r);const idx=new Map(K.map((k,i)=>[k,i])),XY=K.map(k=>ctr(m,k));
  let X0=1e9,X1=-1e9,Y0=1e9,Y1=-1e9;for(const [x,y] of XY){X0=Math.min(X0,x);X1=Math.max(X1,x);Y0=Math.min(Y0,y);Y1=Math.max(Y1,y)}
  const L=Math.max(X1-X0,Y1-Y0)/G.f||1,E=new Float32Array(n),RG=new Float32Array(n),Mo=new Float32Array(n),Te=new Float32Array(n),N=K.map(k=>nbs(m,k).map(x=>idx.get(x.k)).filter(i=>i!=null)),edge=new Uint8Array(n);
  const long=w>=h;
  K.forEach((k,i)=>{const [q,r]=k.split(',').map(Number),[x,y]=XY[i],u=(x-X0)/(X1-X0||1),v=(y-Y0)/(Y1-Y0||1),de=Math.min(q,r,w-1-q,h-1-r);edge[i]=de===0;
    const base=fbm(x/L+ox,y/L+oy),det=fbm(x*.17+ox*2,y*.17+oy*2,3);let e=.62*base+.22*det+.16*Math.min(1,hxRidge(x/L*2.2+ox*.7,y/L*2.2-oy*.7));RG[i]=hxRidge(x*.11+oy,y*.11-ox);
    if(tpl==='island'){const d=Math.hypot((u-.5)*2,(v-.5)*2);e=e*.55+.66-.62*d*d}
    else if(tpl==='archipelago')e=.45*base+.55*fbm(x*.3+ox*3,y*.3+oy*3,3)+.04;
    else if(tpl==='valley'){const a=Math.abs((long?v:u)-.5)*2;e=.3+.55*a**1.5+.3*(e-.5)-.1*(long?u:v)}
    else{const d=Math.max(Math.abs(u-.5),Math.abs(v-.5))*2;e=e*.8+.3-.32*d**3}
    if(!['desert','valley'].includes(tpl))e*=sst(0,tpl==='continent'||tpl==='north'?3:2.4,de); // the sea all round
    E[i]=e;Mo[i]=G.wet+(fbm(x/L*1.3+mx,y/L*1.3+my)-.5)*.75;Te[i]=G.temp+(v-.5)*.34+(fbm(x/L+tx,y/L-tx,2)-.5)*.12});
  const sea=G.sea,water=new Uint8Array(n);for(let i=0;i<n;i++)water[i]=E[i]<sea;
  // priority flood: from the sea and the map edge inwards, lowest first; each hex drains to the one it was reached from
  const Ef=new Float32Array(n),down=new Int32Array(n).fill(-1),seen=new Uint8Array(n),order=[],hp=[];
  const push=(v,i)=>{hp.push([v,i]);let j=hp.length-1;while(j){const p=(j-1)>>1;if(hp[p][0]<=hp[j][0])break;[hp[p],hp[j]]=[hp[j],hp[p]];j=p}};
  const pop=()=>{const top=hp[0],last=hp.pop();if(hp.length){hp[0]=last;for(let j=0;;){const l=2*j+1,r=l+1;let s=j;if(l<hp.length&&hp[l][0]<hp[s][0])s=l;if(r<hp.length&&hp[r][0]<hp[s][0])s=r;if(s===j)break;[hp[s],hp[j]]=[hp[j],hp[s]];j=s}}return top};
  for(let i=0;i<n;i++)if(water[i]||edge[i]){seen[i]=1;Ef[i]=E[i];push(E[i],i)}
  while(hp.length){const [v,i]=pop();order.push(i);for(const j of N[i])if(!seen[j]){seen[j]=1;Ef[j]=Math.max(E[j],v+1e-4);down[j]=i;push(Ef[j],j)}}
  const acc=new Float32Array(n);for(let i=0;i<n;i++)acc[i]=water[i]?0:1;for(let o=order.length-1;o>=0;o--){const i=order[o];if(down[i]>=0)acc[down[i]]+=acc[i]}
  const land=[];for(let i=0;i<n;i++)if(!water[i])land.push(i);
  // climate and terrain
  const hl=i=>Math.max(0,(E[i]-sea)/(1-sea)),T={};
  // highlands: the land ranked by height plus a ridge line, so the top ~10% (mountains) and next ~14% (hills) follow chains
  const up=i=>hl(i)*.7+.3*Math.min(1,RG[i]),rk=land.map(up).sort((a,b)=>b-a),q=f=>rk[Math.min(rk.length-1,Math.floor(rk.length*f))]??9,qPk=q(.025),qMt=q(.1),qHl=q(.24);
  for(const i of land){const H=hl(i),U=up(i),te=Te[i]-.4*H,mo=Mo[i],a=rnd(i,1);let t;
    if(U>=qMt&&H>.25)t=U>=qPk?(te<.15?'glacier':'mountain-peak'):'mountain';
    else if(U>=qHl&&H>.12)t=te>.7&&mo<.3?(a<.3?'canyon':'badlands'):a<.22?'crag':'hill';
    else if(te<.16)t=mo>.7?'glacier':'tundra';
    else if(te<.3)t=mo>.52?'forest':mo>.36?'heath':'tundra';
    else if(te<.68)t=mo>.8&&H<.1?(a<.5?'swamp':'marsh'):mo>.72?'dense-forest':mo>.57?(a<.06?'glade':'forest'):mo>.44?(a<.2?'meadow':'grassland'):mo>.3?'plains':'steppe';
    else t=mo>.72?'jungle':mo>.48?'grassland':mo>.33?'savanna':mo>.2?'steppe':'desert';
    T[i]=t}
  for(let i=0;i<n;i++)if(water[i])T[i]=E[i]<sea-.17&&!N[i].some(j=>!water[j])?'deep-ocean':'ocean';
  // lakes in pits that hold water (oases in the desert); then rivers where enough land drains through
  const pits=land.filter(i=>Ef[i]-E[i]>.045&&!edge[i]).sort((a,b)=>(Ef[b]-E[b])-(Ef[a]-E[a])).slice(0,Math.max(1,Math.round(land.length/140)));
  for(const i of pits){if(Mo[i]<.25&&Te[i]>.6){T[i]='oasis';continue}water[i]=1;T[i]=Te[i]-.4*hl(i)<.2?'frozen-lake':'lake'}
  const accs=land.filter(i=>!water[i]).map(i=>acc[i]).sort((a,b)=>b-a),th=Math.max(2,Math.min(accs[0]||2,Math.max(5,accs[Math.floor(accs.length*Math.min(.07,G.wet*.14))]||5))) /* dry lands: fewer rivers */,riv=new Uint8Array(n);
  for(const i of land)riv[i]=!water[i]&&acc[i]>=th&&T[i]!=='oasis';
  const heads=land.filter(i=>riv[i]&&!N[i].some(j=>riv[j]&&down[j]===i)).sort((a,b)=>E[b]-E[a]||a-b),used=new Uint8Array(n);
  for(const s of heads){const p=[s];used[s]=1;let c=s;for(;;){c=down[c];if(c<0)break;p.push(c);if(water[c]||used[c])break;used[c]=1}
    if(p.length>=3||!m.paths.length&&p.length>=2)m.paths.push({type:'water',pts:p.map(i=>XY[i])})}
  // coast, reefs, fjords and deltas at the shore; farms along temperate rivers; a volcano on some islands
  for(const i of land){if(water[i])continue;const sh=N[i].some(j=>water[j]&&/ocean/.test(T[j])),a=rnd(i,2);
    if(sh&&/mountain|crag/.test(T[i])&&Te[i]<.3&&a<.4)T[i]='fjord';
    else if(sh&&riv[i]&&acc[i]>=th*3&&Te[i]>.3&&Te[i]<.7)T[i]='delta';
    else if(sh&&hl(i)<.14&&!/mountain|glacier|swamp|marsh|forest|jungle/.test(T[i])&&a<.7)T[i]=Te[i]<.2?'tundra':'coast';
    else if(!sh&&/plains|grassland|meadow/.test(T[i])&&N[i].some(j=>riv[j])&&a<.4)T[i]='farmland'}
  for(let i=0;i<n;i++)if(T[i]==='ocean'&&Te[i]>.62&&N[i].some(j=>!water[j])&&rnd(i,3)<.18)T[i]='reef';
  if(['island','archipelago'].includes(tpl)&&land.length){const top=land.reduce((a,b)=>E[b]>E[a]?b:a);if(R()<.6&&!water[top])T[top]='volcano'}
  if(tpl==='north'){const hs=land.filter(i=>T[i]==='hill');if(hs.length)T[hs[Math.floor(R()*hs.length)]]='hot-spring'}
  K.forEach((k,i)=>{m.t[k]=T[i]});return m}

/* ---------- Hexer JSON (schema 6, same shape as its File → Export → JSON Data) ---------- */
function hxExport(m){const now=new Date().toISOString(),id=()=>crypto.randomUUID?.()||Math.random().toString(36).slice(2),H=k=>{const [q,r]=k.split(',').map(Number);return {q,r}},L='surface',hexes={};
  for(const [k,t] of Object.entries(m.t)){const {q,r}=H(k),e=m.blk?.[k];hexes[`${q},${r},${L}`]={q,r,layer:L,hexType:t,fogState:'visible',edgeData:e?Object.fromEntries(e.map(i=>[i,'blocked'])):{},connections:[],rotation:0}}
  return {id:'crow-'+id(),name:m.name,description:'',ownerId:null,
    settings:{width:m.w,height:m.h,hexSize:30,terrainIconOpacity:.85,orientation:m.flat?'flat':'pointy',showGrid:true,showLabels:true,showCoordinates:false,fogEnabled:false,fogDistance:2,layersEnabled:false,showBiomeBleed:true,viewMode:'hexcrawl',theme:'fantasy',style:'painted'},
        // field sets as in Hexer's own export (2026-11-10): it skips paths without style/closed
    hexes,regions:m.regs.map(g=>({id:id(),name:g.name,color:g.color||HX_RCOL[0],hexes:g.ks.map(H),borderWidth:3,borderStyle:'solid',labelVisible:!!g.name,fillOpacity:0,labelFontScale:1.2,labelPosition:null,layer:L})),
    paths:m.paths.map(p=>({id:id(),name:'',type:p.type,layer:L,points:p.pts.map(([x,y])=>({x:+x.toFixed(4),y:+y.toFixed(4)})),style:{},closed:false})),
    notes:m.notes.map(n=>({id:id(),title:n.title,content:n.text?n.text.split('\n').map(l=>`<p>${esc(l)}</p>`).join(''):'',hex:H(n.k),dmOnly:n.dm,layer:L})),
    pointCrawl:{nodes:[],edges:[]},tokens:(m.tokens||[]).map(o=>({id:id(),name:o.name,color:o.color,hex:H(o.k),layer:L,visibility:o.show?'visible':'hidden',moveableBy:'anyone',isPartySource:false})),pois:m.pois.map(p=>({id:id(),type:p.type,hex:H(p.k),layer:L,label:p.label,display:{}})),
    customHexTypes:Object.keys(m.names||{}).map(k=>({id:k,name:m.names[k],color:m.colors?.[k]||'#8b8b8b'})),activeLayer:L,schemaVersion:6,createdAt:now,updatedAt:now}}

/* ---------- actions and keys ---------- */
const hxSaveR=()=>{saveHX();render()};
// a field's change commits while the pointer is down on another control (a blur from mousedown): render after that click, not before,
// so the button under the pointer is still there to receive it
let hxPtr=false,hxPend=false;
document.addEventListener('pointerdown',()=>{hxPtr=true},true);
for(const ev of ['pointerup','pointercancel'])document.addEventListener(ev,()=>{hxPtr=false;if(hxPend){hxPend=false;setTimeout(render,0)}},true);
const hxLater=()=>{saveHX();if(hxPtr)hxPend=true;else render()};
const hxFile=ext=>(String(HX?.name||'').replace(/[\\/:*?"<>|\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim()||'hex map')+ext;
// attached to the page while it clicks: Firefox ignores the download name of a detached link
function hxDownload(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
function hxSetCol(id,c){const o=hxColT(id);c=String(c||'').trim();if(/^[0-9a-f]{6}$/i.test(c))c='#'+c;if(!o)return;if(!hxColOK(c))return toast('Use a colour like #8b4a3d');hxDo();o.color=c.toLowerCase();S.hx.cp=null;hxLater()}
// PNG of the whole map as the Ref sees it (all places, no fog): the GPU painting at up to 48 px per hex radius, then borders, walls,
// region names and places drawn on top; without WebGL, flat colours
async function hxPNG(){if(!HX)return;toast('Drawing the map…');
  for(let i=0;i<200&&!hxEdReady(HX.t);i++)await new Promise(r=>setTimeout(r,50));
  try{await document.fonts?.load('600 24px Alegreya')}catch{}
  const grid=[];for(let q=0;q<HX.w;q++)for(let r=0;r<HX.h;r++)grid.push(q+','+r);const keys=Object.keys(HX.t),b=hxBounds(HX,grid.length?grid:keys),W=b[2]-b[0],H=b[3]-b[1],
    lim=Math.min(4096,typeof HXGL!=='undefined'&&HXGL.max||4096),k=Math.min(48,lim/W,lim/H),cv=document.createElement('canvas');
  cv.width=Math.round(W*k);cv.height=Math.round(H*k);const g=cv.getContext('2d'),px=(x,y)=>[(x-b[0])*k,(y-b[1])*k];
  g.fillStyle='#e4d8bc';g.fillRect(0,0,cv.width,cv.height);
  const gl=typeof hxGLSnap==='function'&&keys.length&&hxGLSnap(HX,b,k,c=>g.drawImage(c,0,0));
  if(!gl){const C=hxCorners(HX,1);for(const kk of keys){const [x,y]=ctr(HX,kk);g.beginPath();C.forEach(([a,c],i)=>{const [X,Y]=px(x+a*1.01,y+c*1.01);i?g.lineTo(X,Y):g.moveTo(X,Y)});g.fillStyle=hxType(HX,HX.t[kk])[1];g.fill()}}
  g.setTransform(k,0,0,k,-b[0]*k,-b[1]*k);g.lineCap='round';g.lineJoin='round';
  for(const [,cls,d,st] of hxLines(HX).matchAll(/<path class="(regb|wall)" d="([^"]*)"(?: stroke="([^"]*)")?\/>/g)){g.strokeStyle=cls==='wall'?'#7d1a16':st;g.lineWidth=cls==='wall'?.12:.08;g.globalAlpha=cls==='wall'?1:.85;g.stroke(new Path2D(d))}
  g.globalAlpha=1;g.setTransform(1,0,0,1,0,0);g.textAlign='center';g.textBaseline='alphabetic';
  const text=(t,x,y,size,fill,stroke,sw)=>{g.font=`600 ${size}px Alegreya, Georgia, serif`;g.lineWidth=sw;g.strokeStyle=stroke;g.fillStyle=fill;g.strokeText(t,x,y);g.fillText(t,x,y)};
  for(const rg of HX.regs){if(!rg.name||!rg.ks.length)continue;const c=rg.ks.map(kk=>ctr(HX,kk)),[X,Y]=px(c.reduce((a,v)=>a+v[0],0)/c.length,c.reduce((a,v)=>a+v[1],0)/c.length);
    g.letterSpacing=(.04*k)+'px';text(rg.name.toUpperCase(),X,Y,.42*k,hxColOK(rg.color)?rg.color:'#8b4a3d','rgba(255,255,255,.8)',.22*k);g.letterSpacing='0px'}
  for(const p of HX.pois){const [x,y]=ctr(HX,p.k),[X,Y]=px(x,y),col=hxPoiCol(p.type),ic=hxPoiIcon(p.type),z=.45*(HX_POI_TIER[p.type]||1);
    g.beginPath();g.arc(X,Y,.46*k,0,6.283);g.globalAlpha=.5;g.fillStyle=col;g.fill();g.globalAlpha=.9;g.lineWidth=.05*k;g.strokeStyle=col;g.stroke();g.globalAlpha=1;
    if(ic){const sc=.68/512*k;g.setTransform(sc,0,0,sc,X-.34*k,Y-.34*k);g.globalAlpha=.85;g.fillStyle='#1a0f08';g.fill(new Path2D(ic[2].join(' ')));g.globalAlpha=1;g.setTransform(1,0,0,1,0,0)}
    if(p.label)text(p.label,X,Y+(.55+.8*z)*k,z*k,'#2c1810','#f0dbb8',.2*z*k)}
  cv.toBlob(bl=>{if(!bl)return toast('The picture is too large for this browser');hxDownload(bl,hxFile('.png'));toast(`Saved ${cv.width}×${cv.height} PNG`)},'image/png')}
Object.assign(A,{
  hxmode:b=>{const ed=b.dataset.v==='edit';if(ed===!!S.hx.edit)return;if(S.hx.draw)hxPathFinish(true);S.hx.edit=ed;S.hx.psel=-1;if(ed)S.hx.panel=true;render()},
  hxfmode:b=>{S.hx.fmode=b.dataset.v;render()},
  hxfogr:b=>{const r=+b.dataset.v,ks=Object.keys(HX.t).filter(k=>hxDist(HX,HX.party,k)<=r&&!HX.seen[k]);if(!ks.length)return toast('Already shown');hxDo();for(const k of ks)HX.seen[k]=1;hxSaveR();toast(`${ks.length} hex${ks.length===1?'':'es'} shown to players`)},
  hxfogall:b=>{const show=b.dataset.v==='show',go=()=>{hxDo();for(const k of Object.keys(HX.t)){if(show)HX.seen[k]=1;else delete HX.seen[k]}hxSaveR();toast(show?'The whole map is shown':'Everything is hidden')};
    if(show)go();else askYes('Hide the whole map from players?','They keep nothing they have seen. Undo brings it back.','Hide everything',go)},
  // from Play: straight to the fog brush
  hxfogtool:()=>{S.hx.edit=true;S.hx.tool='fog';S.hx.panel=true;render()},
  hxtool:b=>{if(S.hx.draw&&b.dataset.v!=='path')hxPathFinish(true);S.hx.panel=S.hx.panel||S.hx.tool!==b.dataset.v||innerWidth>980;S.hx.tool=b.dataset.v;S.hx.pick=false;S.hx.pscroll=0;render()},
  hxterr:b=>{S.hx.terr=b.dataset.v;S.hx.pick=false;S.hx.tool='brush';render()},
  hxsize:b=>{S.hx.size=+b.dataset.v;render()},hxpick:()=>{S.hx.pick=!S.hx.pick;render()},
  hxfill:()=>{const ks=hxBlankKeys(HX);if(!ks.length)return toast('No blank hexes left');hxDo();hxTerrCopy();for(const k of ks)HX.t[k]=S.hx.terr;hxSaveR();toast(`${ks.length} blank hexes → ${tName(HX,S.hx.terr)}`)},
  hxeundo:()=>hxUndo(),hxeredo:()=>hxRedo(),
  hxptype:b=>{S.hx.ptype=b.dataset.v;S.hx.psel=-1;render()},hxpdesel:()=>{S.hx.psel=-1;render()},
  hxpdel:()=>{const i=S.hx.psel;if(!HX.pois[i])return;hxDo();HX.pois=HX.pois.filter((_,j)=>j!==i);S.hx.psel=-1;hxTerrCopy();hxSaveR()},
  hxpk:b=>{S.hx.pk=b.dataset.v;if(S.hx.draw)S.hx.draw.type=b.dataset.v;render()},
  hxpfin:()=>hxPathFinish(),hxpback:()=>{const d=S.hx.draw;d?.ks.pop();if(!d?.ks.length)S.hx.draw=null;render()},hxpcancel:()=>{S.hx.draw=null;render()},
  hxpthsel:b=>{const i=+b.dataset.i;S.hx.pthsel=i===S.hx.pthsel?-1:i;render()},
  hxpthdel:b=>{hxDo();HX.paths=HX.paths.filter((_,j)=>j!==+b.dataset.i);S.hx.pthsel=-1;hxTerrCopy();hxSaveR()},
  hxrnew:()=>{hxDo();const i=HX.regs.length;HX.regs.push({name:`Region ${i+1}`,color:HX_RCOL[i%HX_RCOL.length],ks:[]});S.hx.reg=i;S.hx.rmode='add';hxSaveR();const n=$('#hxr-name');n?.focus();n?.select()},
  hxrsel:b=>{const i=+b.dataset.i;S.hx.reg=i===S.hx.reg?-1:i;render()},hxrmode:b=>{S.hx.rmode=b.dataset.v;render()},
  hxrdel:()=>{const g=HX.regs[S.hx.reg];if(!g)return;askYes(`Delete ${g.name||'this region'}?`,'Its hexes keep their terrain; the border and the name go. Undo brings it back.','Delete',()=>{hxDo();HX.regs.splice(S.hx.reg,1);S.hx.reg=-1;hxSaveR()})},
  hxnsel:b=>{S.hx.tool='note';S.hx.nsel=b.dataset.k;S.hx.nedit=-1;S.hx.follow=b.dataset.k;render()},
  hxnadd:()=>{const k=S.hx.nsel,title=$('#hxnt-title').value.trim().slice(0,80),text=$('#hxnt-text').value.trim().slice(0,4000),dm=$('#hxnt-dm').checked;if(!k)return;
    if(!title&&!text)return toast('Give the note a title or some text');hxDo();const n={title,text,k,dm};if(HX.notes[S.hx.nedit])HX.notes[S.hx.nedit]=n;else HX.notes.push(n);S.hx.nedit=-1;hxSaveR()},
  hxnedit:b=>{S.hx.nedit=+b.dataset.i;render()},hxncancel:()=>{S.hx.nedit=-1;render()},hxndel:b=>{hxDo();HX.notes.splice(+b.dataset.i,1);S.hx.nedit=-1;hxSaveR()},
  hxnew:()=>hxNewDlg(),hxgen:()=>hxGenDlg(),
  hxexport:()=>{if(!HX)return;hxDownload(new Blob([JSON.stringify(hxExport(HX))],{type:'application/json'}),hxFile('.json'));toast('Exported. In Hexer: File → Import')},
  hxpng:()=>{hxPNG()},
  hxsave:()=>{if(!HX)return;const ok=saveHX();toast(ok?'Map saved on this device':'Couldn’t save on this device: its storage is full or blocked. Export the map to keep it.');$$('.hxsaved').forEach(el=>el.outerHTML=hxSavedLine())},
  hxsmode:b=>{S.hx.smode=b.dataset.v;render()},
  hxsel:b=>{const v=b.dataset.v,all=[];for(let q=0;q<HX.w;q++)for(let r=0;r<HX.h;r++)all.push(q+','+r);const cur=hxSelSet();S.hx.selK=v==='all'?all:v==='invert'?all.filter(k=>!cur.has(k)):[];S.hx.paste=false;render()},
  hxsfog:b=>{const ks=S.hx.selK,show=b.dataset.v==='show';if(!ks.length)return;hxDo();for(const k of ks){if(show)HX.seen[k]=1;else delete HX.seen[k]}hxSaveR();toast(`${ks.length} hex${ks.length===1?'':'es'} ${show?'shown to':'hidden from'} the players`)},
  hxsfill:()=>{if(!S.hx.selK.length)return;hxDo();hxTerrCopy();for(const k of S.hx.selK)HX.t[k]=S.hx.terr;hxSaveR()},
  hxsdel:()=>hxSelClear(false),hxscut:()=>{if(hxCopy())hxSelClear(true)},
  hxscopy:()=>{const n=hxCopy();if(n)toast(`Copied ${n} hex${n===1?'':'es'}`);render()},
  hxspaste:()=>{if(!HXE.clip)return toast('Copy something first');S.hx.paste=!S.hx.paste;render()},
  hxrview:b=>{S.hx.rview=b.dataset.v;render()},
  hxcolor:b=>{S.hx.cp=S.hx.cp===b.dataset.for?null:b.dataset.for;render()},hxcpick:b=>hxSetCol(b.dataset.for,b.dataset.v),
  hxtsel:b=>{const i=+b.dataset.i;S.hx.tsel=i===S.hx.tsel?-1:i;S.hx.follow=HX.tokens[i]?.k;render()},hxtdesel:()=>{S.hx.tsel=-1;render()},
  hxtdel:()=>{const i=S.hx.tsel;if(!HX.tokens?.[i])return;hxDo();HX.tokens=HX.tokens.filter((_,j)=>j!==i);S.hx.tsel=-1;hxSaveR()}});
// fields in the editor panel: commit on change (Enter commits a one-line field)
document.addEventListener('change',e=>{const t=e.target;if(!HX||!S.hx.edit||!t.closest?.('.hxedit'))return;const p=HX.pois[S.hx.psel],g=HX.regs[S.hx.reg];
  const o=HX.tokens?.[S.hx.tsel];
  if(t.id==='hxp-label'&&p){hxDo();p.label=t.value.trim().slice(0,60);hxLater()}
  else if(t.id==='hxt-name'&&o){hxDo();o.name=t.value.trim().slice(0,40)||o.name;hxLater()}
  else if(t.id==='hxt-show'&&o){hxDo();o.show=t.checked;hxSaveR()}
  else if(t.id==='hxcp-hex')hxSetCol(t.dataset.for,t.value)
  else if(t.id==='hxp-type'&&p){hxDo();HX.pois=HX.pois.map(x=>x===p?{...p,type:t.value}:x);hxTerrCopy();hxSaveR()}
  else if(t.id==='hxp-found'&&p){p.found=t.checked;if(p.found)HX.seen[p.k]=1;hxSaveR()}
  else if(t.id==='hxr-name'&&g){hxDo();g.name=t.value.trim().slice(0,40);hxLater()}
  else if(t.id==='hxm-name'){hxDo();HX.name=t.value.trim().slice(0,60)||HX.name;hxLater()}});
document.addEventListener('input',e=>{if(e.target.id!=='hxe-q')return;S.hx.q=e.target.value;const q=S.hx.q.trim().toLowerCase();
  $$('.hxedit .hxswb').forEach(b=>b.hidden=!!q&&!b.dataset.q.includes(q));$$('.hxedit .hxtg').forEach(g=>g.hidden=!$$('.hxswb',g).some(b=>!b.hidden))});
// tool buttons don't take the focus from the map on a mouse click, so Space (pan) and the shortcuts keep working
document.addEventListener('mousedown',e=>{if(e.target.closest?.('.hxedit .hxrail button,.hxedit .hxtools button'))e.preventDefault()});
const hxTyping=t=>t.closest?.('input,textarea,select,[contenteditable=true]')||$('#dlg')?.open;
document.addEventListener('keydown',e=>{const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
  if(mod&&k==='s'&&HX&&$('.hxstage')&&!$('#dlg')?.open){e.preventDefault();if(hxTyping(e.target))e.target.blur();return A.hxsave()}
  if(!HX||!S.hx.edit||!$('.hxedit'))return;if(hxTyping(e.target)){if(e.key==='Enter'&&e.target.matches?.('.hxedit input[type=text]'))e.target.blur();return}
  if(e.key==='Escape'&&(S.hx.cp||S.hx.paste||S.hx.selK.length&&S.hx.tool==='select')){S.hx.cp=null;if(S.hx.paste)S.hx.paste=false;else if(S.hx.tool==='select')S.hx.selK=[];return render()}
  if(S.hx.tool==='select'&&!S.hx.draw){
    if(mod&&k==='a'){e.preventDefault();return A.hxsel({dataset:{v:'all'}})}if(mod&&k==='c'){e.preventDefault();return A.hxscopy()}if(mod&&k==='x'){e.preventDefault();return A.hxscut()}
    if(mod&&k==='v'){e.preventDefault();return A.hxspaste()}if(!mod&&(e.key==='Delete'||e.key==='Backspace')&&S.hx.selK.length){e.preventDefault();return A.hxsdel()}}
  if(mod&&k==='z'){e.preventDefault();return e.shiftKey?hxRedo():hxUndo()}if(mod&&k==='y'){e.preventDefault();return hxRedo()}
  if(e.key===' '&&!e.target.closest?.('button')){e.preventDefault();if(!HXE.space){HXE.space=true;$('.hxedit')?.classList.add('panning')}return}
  if(mod||e.altKey)return;
  if(S.hx.draw&&e.key==='Enter'){e.preventDefault();return hxPathFinish()}if(S.hx.draw&&e.key==='Escape'){S.hx.draw=null;return render()}
  if(S.hx.draw&&e.key==='Backspace'){e.preventDefault();return A.hxpback()}
  if(HX_KEYS[k]){S.hx.tool!==HX_KEYS[k]&&A.hxtool({dataset:{v:HX_KEYS[k]}});return}
  if(e.key==='['||e.key===']'){S.hx.size=Math.max(1,Math.min(5,S.hx.size+(e.key===']'?1:-1)));render()}});
document.addEventListener('keyup',e=>{if(e.key===' '&&HXE.space){HXE.space=false;$('.hxedit')?.classList.remove('panning')}});
addEventListener('blur',()=>{HXE.space=false});
