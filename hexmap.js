'use strict';
/* CROW NEST — hex crawl. The Ref imports a map made in Hexer (hexermap.com: File → Export → JSON Data) and moves the party
   on it as part of the travel day; players see what the party has seen, plan routes and ping hexes for the table.
   Hexer JSON (schema 6, checked 2026-11-10): settings.{width,height,orientation,fogEnabled}; hexes["q,r,layer"] =
   {q,r,layer,hexType,fogState}; offset coordinates, odd rows shifted right on pointy maps; pois[{type,hex:{q,r},label}];
   notes[{title,content,hex,dmOnly}]; paths[{type,points:[{x,y}]}] in units of one hex radius; regions[{name,hexes}].
   The Ref's full map (HX) stays on the Ref's device; the table only ever gets hxPub(): seen terrain, found places,
   non-DM notes, the party where the players think it is, and the journey log.
   Drawing: one <svg> whose viewBox is the camera (S.hx.cam), so pan and zoom never re-render the page. Terrain is a few
   long <path>s (one per terrain type) plus one art symbol per hex; clicks are hit-tested by coordinates. */
let HX=null;try{HX=JSON.parse(store.get('hexmap')||'null')}catch{}
const HX_SAVED={t:0,ok:true};
// saving: store.set keeps a memory copy when localStorage refuses, so read it back to know whether the map is really on this device
function saveHX(){const s=JSON.stringify(HX);store.set('hexmap',s);let ok;try{ok=localStorage.getItem('ctk-hexmap')===s}catch{ok=false}HX_SAVED.t=Date.now();HX_SAVED.ok=ok;hxPublish();return ok}
const hxSavedLine=()=>`<p class="small hxsaved${HX_SAVED.ok?'':' bad'}" role="status" style="margin:0">${HX_SAVED.ok?`Saved on this device${HX_SAVED.t?' · '+new Date(HX_SAVED.t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}`:'Not saved: this browser’s storage is full or blocked. Export the map to keep it.'}</p>`;
S.hxPub=null;try{S.hxPub=JSON.parse(store.get('hexpub')||'null')}catch{}
S.hx={sel:null,cam:null,vw:900,vh:600,asPlayers:false,panel:innerWidth>980,follow:null}; // local view state, never shared
S.hxPing=null;
// the travel day lives in S.rtravel (not saved); the map keeps the day count and today's moves across reloads
if(HX){HX.day??=1;HX.moved??=0;HX.days??={};HX.tokens??=[];S.rtravel.day=HX.day;S.rtravel.moved=HX.moved}

/* ---------- geometry ---------- */
const SQ=Math.sqrt(3),HXK=/^-?\d+,-?\d+$/;
// ponytail: flat maps assume odd columns shifted down, the mirror of the verified pointy layout; check against a flat export
const ctr=(m,k)=>{const [q,r]=k.split(',').map(Number);return m.flat?[1.5*q,SQ*(r+.5*(q&1))]:[SQ*(q+.5*(r&1)),1.5*r]};
const DIR8=['east','northeast','north','northwest','west','southwest','south','southeast'];
// the six neighbours, found by distance so both orientations and parities work; sorted by angle so a d6 picks one
function nbs(m,k){const [q,r]=k.split(',').map(Number),[x,y]=ctr(m,k),out=[];
  for(let dq=-1;dq<=1;dq++)for(let dr=-1;dr<=1;dr++){if(!dq&&!dr)continue;const n=(q+dq)+','+(r+dr),[a,b]=ctr(m,n);
    if(Math.abs(Math.hypot(a-x,b-y)-SQ)<.01){const ang=(Math.atan2(y-b,a-x)*180/Math.PI+360)%360;out.push({k:n,ang,dir:DIR8[Math.round(ang/45)%8]})}}
  return out.sort((a,b)=>a.ang-b.ang)}
const adj=(m,a,b)=>!!a&&nbs(m,a).some(n=>n.k===b);
function near(m,x,y){const q0=Math.round(m.flat?x/1.5:x/SQ),r0=Math.round(m.flat?y/SQ:y/1.5);let best='',bd=1e9;
  for(let dq=-1;dq<=1;dq++)for(let dr=-1;dr<=1;dr++){const k=(q0+dq)+','+(r0+dr),[a,b]=ctr(m,k),dd=(a-x)**2+(b-y)**2;if(dd<bd){bd=dd;best=k}}return best}
const hxCube=(m,k)=>{const [q,r]=k.split(',').map(Number);if(m.flat){const z=r-(q-(q&1))/2;return [q,-q-z,z]}const x=q-(r-(r&1))/2;return [x,-x-r,r]};
const hxDist=(m,a,b)=>{const A=hxCube(m,a),B=hxCube(m,b);return Math.max(...A.map((v,i)=>Math.abs(v-B[i])))};
const inGrid=(m,k)=>{if(m.t[k])return true;const [q,r]=k.split(',').map(Number);return q>=0&&r>=0&&q<m.w&&r<m.h};
const hxHash=k=>{let h=2166136261;for(const c of k)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};

/* ---------- terrain look ---------- */
const tName=(m,t)=>m.names?.[t]||String(t).replace(/-/g,' ').replace(/^./,c=>c.toUpperCase());
// terrain painting lives in hexart.js (hxPaint)
const HX_WATER=/ocean|sea|lake|pond|reef|abyss|deep|bay|^water/;
const HX_ROAD=/primary|secondary|road|trail|path/;
const CAMP={miasma:'outdoors in the Miasma',ruin:'a ruin',village:'a village or shelter'};

/* ---------- import ---------- */
function hxParse(text){const j=JSON.parse(text),st=j.settings||{};
  if(!j.hexes||typeof j.hexes!=='object')throw Error('No hexes in this file. In Hexer use File → Export → JSON Data.');
  const surf=o=>(o.layer||'surface')==='surface',K=h=>h&&Number.isFinite(+h.q)&&Number.isFinite(+h.r)?(+h.q)+','+(+h.r):null;
  const t={},seen={},names={},colors={};
  for(const c of Array.isArray(j.customHexTypes)?j.customHexTypes:[]){const id=String(c.id??c.key??c.name??'');if(!id)continue;if(c.name)names[id]=String(c.name);if(/^#[0-9a-f]{3,8}$/i.test(c.color||''))colors[id]=c.color}
  for(const h of Object.values(j.hexes)){const k=K(h);if(!k||!surf(h)||!h.hexType)continue;t[k]=String(h.hexType);if(st.fogEnabled&&!/hid/i.test(h.fogState||''))seen[k]=1}
  if(!Object.keys(t).length)throw Error('This map has no painted hexes on its surface layer.');
  const ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ','#39':"'"};
  // rich text to plain text; paragraphs and <br> become line breaks
  const strip=s=>String(s||'').replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g,(_,e)=>ENT[e])
    .split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter((l,i,a)=>l||i&&a[i-1]).join('\n').trim();
  return {name:String(j.name||'Hex map'),w:+st.width||0,h:+st.height||0,flat:st.orientation==='flat',t,names,colors,seen,
    pois:(j.pois||[]).filter(p=>surf(p)&&K(p.hex)).map(p=>({type:String(p.type||'place'),label:String(p.label||p.name||''),k:K(p.hex),found:false})),
    notes:(j.notes||[]).filter(n=>surf(n)&&K(n.hex)).map(n=>({title:strip(n.title),text:strip(n.content),k:K(n.hex),dm:n.dmOnly!==false})),
    paths:(j.paths||[]).filter(p=>surf(p)&&Array.isArray(p.points)&&p.points.length>1).map(p=>({type:String(p.type||''),pts:p.points.map(o=>[+o.x||0,+o.y||0])})),
    regs:(j.regions||[]).filter(surf).map(g=>({name:String(g.name||''),color:/^#[0-9a-f]{3,8}$/i.test(g.color||'')?g.color:'',ks:(g.hexes||[]).map(K).filter(Boolean)})),
    blk:Object.fromEntries(Object.values(j.hexes).filter(h=>surf(h)&&K(h)&&h.edgeData&&typeof h.edgeData==='object').map(h=>[K(h),Object.entries(h.edgeData).filter(([,v])=>v==='blocked').map(([e])=>+e).filter(e=>e>=0&&e<6)]).filter(([,es])=>es.length)),
    tokens:(j.tokens||[]).filter(o=>surf(o)&&K(o.hex)&&!o.isPartySource).map(o=>({name:String(o.name||'Token').slice(0,40),color:/^#[0-9a-f]{6}$/i.test(o.color||'')?o.color:'#8b4a3d',k:K(o.hex),show:o.visibility==='visible'})),
    party:null,known:null,trail:[],lostTrail:[],route:[],day:S.rtravel.day,moved:0,days:{}}}

/* ---------- roads and routes ---------- */
const hxRoadCache=new WeakMap();
// road edges between neighbouring hexes, from Hexer's road and trail paths (they run centre to centre)
function hxRoads(m){const P=m.paths||[];if(hxRoadCache.has(P))return hxRoadCache.get(P);const s=new Set();
  for(const p of P){if(!HX_ROAD.test(p.type))continue;let prev=null;
    for(let i=1;i<p.pts.length;i++){const [x0,y0]=p.pts[i-1],[x1,y1]=p.pts[i],n=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)/.25));
      for(let j=0;j<=n;j++){const k=near(m,x0+(x1-x0)*j/n,y0+(y1-y0)*j/n);if(prev&&k!==prev&&adj(m,prev,k)){s.add(prev+'|'+k);s.add(k+'|'+prev)}prev=k}}}
  hxRoadCache.set(P,s);return s}
// Rules: pace gives hexes a day; following a road all day gives one more. A road hex costs 1/(pace+1) of a day, others 1/pace.
// ponytail: a day that is only partly on a road is prorated; rivers and bridges are still the Ref's call on Travel day
const hxCost=(m,a,b,per)=>hxRoads(m).has(a+'|'+b)?1/(per+1):1/per;
const hxPass=(m,k,full)=>{const t=m.t[k];return t?!HX_WATER.test(t):!full&&inGrid(m,k)};
// a blocked edge (Hexer's Edge tool: wall, cliff, closed border) between a hex and its neighbour n
const hxEdgeI=(m,n)=>{const sa=(360-n.ang+360)%360;return ((Math.round((m.flat?sa-30:sa)/60)-(m.flat?0:1))%6+6)%6}; // Hexer's edge number towards neighbour n
const hxWall=(m,k,n)=>{if(!m.blk)return false;const i=hxEdgeI(m,n),o=(i+3)%6;return !!(m.blk[k]?.includes(i)||m.blk[n.k]?.includes(o))};
function hxPath(m,from,to,per,full){if(!from||!to||from===to||!hxPass(m,to,full))return null;
  const h=[[0,from]],g={[from]:0},prev={},done=new Set(),cR=1/(per+1);
  const push=x=>{h.push(x);let i=h.length-1;while(i){const p=(i-1)>>1;if(h[p][0]<=h[i][0])break;[h[p],h[i]]=[h[i],h[p]];i=p}};
  const pop=()=>{const top=h[0],last=h.pop();if(h.length){h[0]=last;for(let i=0;;){const l=2*i+1,r=l+1;let s=i;if(l<h.length&&h[l][0]<h[s][0])s=l;if(r<h.length&&h[r][0]<h[s][0])s=r;if(s===i)break;[h[s],h[i]]=[h[i],h[s]];i=s}}return top};
  while(h.length){const [,k]=pop();if(k===to)break;if(done.has(k))continue;done.add(k);
    for(const n of nbs(m,k)){if(!hxPass(m,n.k,full)||done.has(n.k)||hxWall(m,k,n))continue;const c=g[k]+hxCost(m,k,n.k,per);
      if(c<(g[n.k]??1e9)){g[n.k]=c;prev[n.k]=k;push([c+hxDist(m,n.k,to)*cR,n.k])}}}
  if(g[to]==null)return null;const path=[];for(let k=to;k!==from;k=prev[k])path.unshift(k);return path}
function hxRouteInfo(m,from,route,per){let days=0,road=0,marks=[],a=from;
  for(const k of route){const c=hxCost(m,a,k,per);if(c<1/per)road++;const d0=Math.floor(days+1e-9);days+=c;if(Math.floor(days+1e-9)>d0)marks.push([k,Math.floor(days+1e-9)]);a=k}
  return {n:route.length,days,road,marks}}
const dfmt=d=>{const h=Math.max(.5,Math.round(d*2)/2);return (h<1?'½':Math.floor(h)+(h%1?'½':''))+' day'+(h>1?'s':'')};
const hxPer=()=>Math.max(1,PACE[S.rtravel.pace].hex+rtDay().sp);

/* ---------- moves (Ref) ---------- */
const hxDayRec=()=>(HX.days[HX.day]??={hx:[],wander:0,found:[],enc:[],camp:null,lost:false,back:false});
function hxReveal(k){HX.seen[k]=1;for(const n of nbs(HX,k))HX.seen[n.k]=1}
// Lost (Rules): each time the group leaves a hex the Ref secretly moves it to a random neighbouring hex.
// exact: the Journey's script already rolled the lost walk for the day, so the party goes exactly there
function hxMove(to,exact){const lost=rtDay().lost;let dest=to,msg='';
  // the d6 counts from the northernmost neighbour clockwise (journey-rules.js lostOrder); water and walls are rolled again
  if(lost&&exact){if(!HX.t[to])return toast('Nothing is painted there');msg='Lost: the party wanders on. The players still see “?”.'}
  else if(lost){const ns=JourneyRules.lostOrder(nbs(HX,HX.party)),ok=n=>!!n&&hxPass(HX,n.k,true)&&!hxWall(HX,HX.party,n);
    if(!ns.some(ok))return toast('No hex around the party to wander into');let r;do{r=d(6)}while(!ok(ns[r-1]));dest=ns[r-1].k;msg=`Lost: d6 = ${r} → ${ns[r-1].dir}. The players still see “?”.`}
  else if(!HX.t[to])return toast('Nothing is painted there — the party can’t go that way');
  HX.party=dest;S.rtravel.moved=HX.moved=(S.rtravel.moved||0)+1;setPhase('travel');const rec=hxDayRec();
  if(lost){HX.lostTrail.push(dest);rec.wander++;rec.lost=true}else{HX.trail.push(dest);HX.known=dest;hxReveal(dest);rec.hx.push(dest)}
  HX.trail=HX.trail.slice(-400);S.hx.sel=dest;S.hx.follow=dest;saveHX();
  const T=rtDay(),over=S.rtravel.moved>T.hexes;toast(msg||`Moved ${S.rtravel.moved} of ${T.hexes} hex${T.hexes===1?'':'es'} today${over?' — past today’s pace':''}`)}
// Found again (Back on Track): the players learn where they really are and what they walked through.
function hxCatchUp(){if(!HX?.party||rtDay().lost||HX.known===HX.party&&!HX.lostTrail.length)return;
  for(const k of HX.lostTrail)hxReveal(k);hxReveal(HX.party);HX.trail=[...HX.trail,...HX.lostTrail].slice(-400);HX.lostTrail=[];HX.known=HX.party;hxDayRec().back=true;saveHX()}
// Travel day actions write the day's story into the map's journey log
{const wrap=(n,after)=>{const f=A[n];A[n]=b=>{const out=f(b);if(hxHere()){after();saveHX()}return out}};
  wrap('rcheck',()=>{hxDayRec().enc=S.rtravel.checks.filter(c=>c.hit).map(c=>c.text)});
  wrap('rrest',()=>{const r=hxDayRec();r.renc=S.rtravel.restChecks.filter(c=>c.hit).map(c=>c.text)});
  wrap('rcamp',()=>{hxDayRec().camp=S.rtravel.camp});
  wrap('rnextday',()=>{HX.day=S.rtravel.day;HX.moved=0})}
// Pace and role results change what players see of the day (hexes, pace, lost) without touching the map.
for(const n of ['rpace','rmod','rguide']){const f=A[n];A[n]=b=>{const out=f(b);hxPublish();return out}}
function hxLog(m,full){return Object.entries(m.days||{}).map(([d,r])=>({d:+d,terr:r.hx.map(k=>tName(m,m.t[k]||'')),wander:r.wander,found:r.found,enc:[...r.enc,...(r.renc||[])],camp:r.camp,lost:r.lost,back:r.back}))
  .filter(r=>r.terr.length||r.wander||r.found.length||r.enc.length||r.camp).sort((a,b)=>a.d-b.d)}
const logLine=r=>[`Day ${r.d}`,r.terr.length?`${r.terr.length} hex${r.terr.length>1?'es':''}: ${[...new Set(r.terr)].join(', ')}`:'',r.wander?`wandered lost for ${r.wander} hex${r.wander>1?'es':''}`:'',
  r.back?'found the way again':'',r.found.length?`found ${r.found.join(', ')}`:'',r.enc.length?`encounters: ${r.enc.join(', ')}`:'',r.camp?`camped in ${CAMP[r.camp]||r.camp}`:''].filter(Boolean);

/* ---------- what the table gets ---------- */
let HX_PUBC=null; // the players' terrain is kept while the map and the seen hexes stay the same, so it is painted once, not on every render
function hxPub(){if(!HX)return S.hxPub;hxCatchUp();const T=rtDay(),seen=HX.seen,sk=Object.keys(seen).filter(k=>HX.t[k]).join(';');let t={},paths=[];
  if(HX_PUBC&&HX_PUBC.src===HX.t&&HX_PUBC.ps===HX.paths&&HX_PUBC.sk===sk)({t,paths}=HX_PUBC);else{
  for(const k in seen)if(HX.t[k])t[k]=HX.t[k];
  // a road or river shows where it runs through seen hexes; a stretch through the fog between two seen points does not
  const clear=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.25));for(let j=1;j<n;j++)if(!seen[near(HX,a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n)])return false;return true};
  for(const p of HX.paths){let run=[];for(const pt of [...p.pts,null]){if(pt&&seen[near(HX,...pt)]&&(!run.length||clear(run.at(-1),pt)))run.push(pt);else{if(run.length>1)paths.push({type:p.type,pts:run});run=pt&&seen[near(HX,...pt)]?[pt]:[]}}}
  HX_PUBC={src:HX.t,ps:HX.paths,sk,t,paths}}
  // a region's name shows once its middle is seen; its label sits among the seen hexes, so it says nothing of the rest
  const mid=ks=>{const c=ks.map(k=>ctr(HX,k));return [c.reduce((a,v)=>a+v[0],0)/c.length,c.reduce((a,v)=>a+v[1],0)/c.length]};
  const regs=HX.regs.map(g=>{const ks=g.ks.filter(k=>seen[k]);if(!ks.length)return null;const [x,y]=mid(ks);return {name:seen[near(HX,...mid(g.ks))]?g.name:'',color:g.color,x,y,ks}}).filter(Boolean);
  // the log keeps places that are still found; encounters show once their day is over (the Ref rolls them before they happen)
  // "today" is the earlier of the map's day and the table's, so an undone "next day" does not show today's encounters
  const known=new Set(HX.pois.filter(p=>p.found).map(p=>p.label||tName(HX,p.type))),days={},today=Math.min(HX.day||1,S.rtravel.day||HX.day||1);
  for(const [d,r] of Object.entries(HX.days))days[d]={...r,hx:r.hx.filter(k=>seen[k]),found:(r.found||[]).filter(l=>known.has(l)),enc:+d<today?r.enc||[]:[],renc:+d<today?r.renc||[]:[]};
  const types=new Set(Object.values(t)),only=o=>Object.fromEntries(Object.entries(o||{}).filter(([k])=>types.has(k)));
  const blk={};for(const [k,es] of Object.entries(HX.blk||{}))if(seen[k])blk[k]=es;
  return {name:HX.name,w:HX.w,h:HX.h,flat:HX.flat,t,names:only(HX.names),colors:only(HX.colors),paths,regs,days,blk,
    pois:HX.pois.filter(p=>p.found&&seen[p.k]).map(({type,label,k})=>({type,label,k})),tokens:(HX.tokens||[]).filter(o=>o.show&&seen[o.k]).map(({name,color,k})=>({name,color,k})),
    notes:HX.notes.filter(n=>!n.dm&&seen[n.k]).map(({title,text,k})=>({title,text,k})),
    party:HX.known,lost:!!HX.party&&T.lost,trail:HX.trail,route:HX.route,day:today,moved:S.rtravel.moved||0,hexes:T.hexes,per:hxPer(),pace:PACE[S.rtravel.pace].label}}
// Everything that arrives from the table is checked: keys go into attributes, so only "q,r" passes.
// ponytail: the route is last write wins between the Ref's step and a player's edit; per-step ops if the table fights over it
function hxIn(o){const okK=k=>typeof k==='string'&&HXK.test(k),okR=r=>Array.isArray(r)?r.filter(okK).slice(0,60):[],arr=a=>Array.isArray(a)?a:[];
  if(HX){if(o)HX.route=okR(o.route);saveHX();return}
  hxRead(o)}
// The players' map as it arrived from the table (PeerJS snapshot or the server's mapPub).
function hxRead(o){const okK=k=>typeof k==='string'&&HXK.test(k),okR=r=>Array.isArray(r)?r.filter(okK).slice(0,60):[],arr=a=>Array.isArray(a)?a:[];
  if(!o||typeof o!=='object'||!o.t){S.hxPub=null}else{let t={};for(const [k,v] of Object.entries(o.t))if(okK(k))t[k]=String(v);
    // same terrain as before → keep the same object, so the painted map (cached on it) is not painted again
    const prev=S.hxPub;if(prev&&JSON.stringify(prev.t)===JSON.stringify(t)&&JSON.stringify(prev.paths)===JSON.stringify((o.paths||[]).map(p=>({type:String(p?.type||''),pts:(p?.pts||[]).map(v=>[+v[0]||0,+v[1]||0])}))))t=prev.t;
    const days={};for(const [d,r] of Object.entries(o.days&&typeof o.days==='object'?o.days:{}))if(r&&typeof r==='object')days[+d||0]={hx:arr(r.hx).filter(okK),wander:+r.wander||0,found:arr(r.found).map(String),enc:arr(r.enc).map(String),renc:arr(r.renc).map(String),camp:r.camp?String(r.camp):null,lost:!!r.lost,back:!!r.back};
    S.hxPub={name:String(o.name||'Hex map'),w:Math.min(200,+o.w||0),h:Math.min(200,+o.h||0),flat:!!o.flat,t,names:o.names||{},colors:o.colors||{},days,
      paths:t===prev?.t?prev.paths:arr(o.paths).filter(p=>Array.isArray(p?.pts)).map(p=>({type:String(p.type||''),pts:p.pts.map(v=>[+v[0]||0,+v[1]||0])})),
      regs:arr(o.regs).map(g=>({name:String(g?.name||''),color:/^#[0-9a-f]{3,8}$/i.test(g?.color||'')?g.color:'',x:+g?.x||0,y:+g?.y||0,ks:arr(g?.ks).filter(okK)})),
      blk:Object.fromEntries(Object.entries(o.blk&&typeof o.blk==='object'?o.blk:{}).filter(([k,es])=>okK(k)&&Array.isArray(es)).map(([k,es])=>[k,es.map(Number).filter(e=>e>=0&&e<6)])),pois:arr(o.pois).filter(p=>okK(p?.k)),notes:arr(o.notes).filter(n=>okK(n?.k)),
      tokens:arr(o.tokens).filter(x=>okK(x?.k)).slice(0,60).map(x=>({name:String(x.name||'').slice(0,40),color:/^#[0-9a-f]{6}$/i.test(x.color||'')?x.color:'#8b4a3d',k:x.k})),
      party:okK(o.party)?o.party:null,lost:!!o.lost,trail:arr(o.trail).filter(okK).slice(-400),route:okR(o.route),day:+o.day||0,moved:+o.moved||0,hexes:+o.hexes||0,per:Math.max(1,+o.per||2),pace:String(o.pace||'Normal')}}
  store.set('hexpub',JSON.stringify(S.hxPub))}
/* ---------- server tables (cloud-sync.js) ----------
   The Ref's full map stays on the Ref's device, as on a PeerJS table. The Ref's device publishes hxPub() as the
   adventure's mapPub entity (Ref-only writes, checked by server/rules.mjs validateMapPub); players read it.
   The map belongs to one adventure (HX.adv): it is shared when the Ref imports or makes it there, or presses Share.
   A player's proposed route goes on their own crow as trip {route, at}. The Ref's device takes in each trip it has not
   seen (HX.trips: crow id → at), so device clocks never decide; it publishes what it has seen, so a player's screen
   keeps showing their own proposal until then. */
const hxCloud=()=>!!window.Cloud?.isActive();
// The map this device uses here: its own off a server table; on one, only the Ref's map of the open adventure.
function hxHere(){return !!HX&&(!hxCloud()||S.role==='ref'&&HX.adv===Cloud.state.adventureId)}
const hxTripsNow=()=>Object.fromEntries(PARTY.filter(c=>c.trip&&Number.isFinite(c.trip.at)).map(c=>[c.id,c.trip.at]));
// Bind the map to the open adventure; proposals made before it are not taken in.
function hxClaim(){if(!HX||!hxCloud()||S.role!=='ref')return;HX.adv=Cloud.state.adventureId;HX.advName=String(Cloud.state.snapshot?.adventure?.name||'').slice(0,200);HX.trips=hxTripsNow();HX.pubSig=''}
// The player's crow in this adventure (the account's own; another player's crow is never written).
function hxMine(){const ids=window.Cloud?.ownCrows?.()||[];return ids.includes(ME?.id)?ME:PARTY.find(c=>ids.includes(c.id))||null}
// What goes to the server, trimmed to its limits (server/rules.mjs MAP_LIMITS); null when it is still too large to send.
const HX_PUB_MAX=900000,HXK4=/^-?\d{1,4},-?\d{1,4}$/;
function hxPack(p){if(!p||!p.t)return {};
  const cut=(v,n)=>{let x=String(v??'').replace(/\u0000/g,'').replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g,'\ufffd').slice(0,n);return /[\ud800-\udbff]$/.test(x)?x.slice(0,-1):x},arr=a=>Array.isArray(a)?a:[],keys=a=>arr(a).filter(k=>typeof k==='string'&&HXK4.test(k)),
    int=(v,lo,hi)=>Math.min(hi,Math.max(lo,Math.floor(+v||0))),hex=c=>/^#[0-9a-f]{3,8}$/i.test(c||'')?c:'',texts=(a,n)=>arr(a).slice(0,200).map(x=>cut(x,n));
  const groups=new Map();let n=0;for(const [k,v] of Object.entries(p.t)){if(n>=40000||!HXK4.test(k))continue;const ty=cut(v,200);if(!groups.has(ty))groups.set(ty,[]);groups.get(ty).push(k);n++}
  const t=[...groups].slice(0,2000).map(([ty,ks])=>[ty,ks.join(';')]),types=new Set(t.map(g=>g[0]));
  const names=Object.fromEntries(Object.entries(p.names||{}).filter(([ty,v])=>types.has(ty)&&typeof v==='string').map(([ty,v])=>[ty,cut(v,200)]));
  const colors=Object.fromEntries(Object.entries(p.colors||{}).filter(([ty,v])=>types.has(ty)&&hex(v)));
  const days=Object.fromEntries(Object.entries(p.days||{}).filter(([d,r])=>/^\d{1,5}$/.test(d)&&r&&typeof r==='object').slice(-2000).map(([d,r])=>[d,{hx:keys(r.hx).slice(0,2000),wander:int(r.wander,0,1e9),
    found:texts(r.found,200),enc:texts(r.enc,1000),renc:texts(r.renc,1000),camp:r.camp?cut(r.camp,40):null,lost:!!r.lost,back:!!r.back}]));
  const out={name:cut(p.name,200),w:int(p.w,0,200),h:int(p.h,0,200),flat:!!p.flat,t,names,colors,
    paths:arr(p.paths).slice(0,2000).map(x=>({type:cut(x?.type,60),pts:arr(x?.pts).filter(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)).slice(0,10000)})),
    regs:arr(p.regs).slice(0,500).map(g=>({name:cut(g?.name,200),color:hex(g?.color),x:Number.isFinite(g?.x)?g.x:0,y:Number.isFinite(g?.y)?g.y:0,ks:keys(g?.ks).slice(0,10000)})),days,
    blk:Object.entries(p.blk||{}).filter(([k,es])=>HXK4.test(k)&&Array.isArray(es)).slice(0,10000).map(([k,es])=>[k,es.filter(e=>Number.isInteger(e)&&e>=0&&e<6).slice(0,6)]),
    pois:arr(p.pois).filter(x=>HXK4.test(x?.k||'')).slice(0,2000).map(x=>({type:cut(x.type,60),label:cut(x.label,200),k:x.k})),
    tokens:arr(p.tokens).filter(x=>HXK4.test(x?.k||'')).slice(0,60).map(x=>({name:cut(x.name,40),color:/^#[0-9a-f]{6}$/i.test(x.color||'')?x.color:'#8b4a3d',k:x.k})),
    notes:arr(p.notes).filter(x=>HXK4.test(x?.k||'')).slice(0,2000).map(x=>({title:cut(x.title,200),text:cut(x.text,20000),k:x.k})),
    party:HXK4.test(p.party||'')?p.party:null,lost:!!p.lost,trail:keys(p.trail).slice(-400),route:keys(p.route).slice(0,60),
    day:int(p.day,0,1e9),moved:int(p.moved,0,1e9),hexes:int(p.hexes,0,1e9),per:int(p.per,1,20),pace:cut(p.pace,20),
    trips:Object.fromEntries(Object.entries(HX?.trips||{}).filter(([id,at])=>id.length<=200&&Number.isFinite(at)&&at>=0).slice(0,200))};
  return new TextEncoder().encode(JSON.stringify(out)).length>HX_PUB_MAX?null:out}
const hxUnpack=o=>{if(!o||!Array.isArray(o.t))return null;const t={};for(const g of o.t)if(Array.isArray(g)&&typeof g[1]==='string'&&g[1])for(const k of g[1].split(';'))t[k]=String(g[0]);
  return {...o,t,blk:Object.fromEntries((Array.isArray(o.blk)?o.blk:[]).filter(e=>Array.isArray(e)&&e.length===2))}};
// The server stores JSON with its own key order, so maps are compared with sorted keys.
const hxCanon=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(key=>[key,x[key]])):x);
let HX_PUBT=0,HX_PUBBING=false,HX_PUBERR='',HX_TRIED={sig:'',t:0};
// What of the published map comes from this device's map, not from the session the whole table shares.
const hxOwnSig=p=>{const {moved,hexes,per,pace,lost,...own}=p||{};const s=hxCanon(own);let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)}return (h>>>0).toString(36)+'.'+s.length};
/* After a map change on the Ref's device. Inside an action it joins that action's operation; while a snapshot is being
   installed, a save is being written or the adventure is opening it tries again shortly. With a conflict queued nothing
   is sent: every change fails until the Ref resolves it. After an install it sends only this device's own map change
   that the server does not have yet (HX.pubSig: the last of its maps the server confirmed), so a second Ref device
   with an older copy does not overwrite the map, and a publish that was dropped is sent again (at most every 10 s). */
function hxPublish(afterInstall){clearTimeout(HX_PUBT);if(HX_PUBBING||!hxCloud()||S.role!=='ref'||!hxHere()||Cloud.hasConflict())return;
  if(Cloud.isApplying()||Cloud.isCommitting()||Cloud.isOpening()){HX_PUBT=setTimeout(()=>hxPublish(afterInstall),300);return}
  HX_PUBBING=true;try{const next=hxPack(hxPub());
    if(!next){if(!HX_PUBERR)toast('This map is too large to share through the server. Players keep the last map they saw.');HX_PUBERR='Too large to share through the server: players keep the last map they saw. Hide hexes, notes or places from players to make it smaller.';return}
    HX_PUBERR='';const own=hxOwnSig(next),confirmed=Cloud.peekConfirmed('mapPub');
    if(confirmed&&hxOwnSig(confirmed)===own&&HX.pubSig!==own){HX.pubSig=own;store.set('hexmap',JSON.stringify(HX))}
    if(hxCanon(next)===hxCanon(S.mapPub??{}))return;
    if(afterInstall&&(own===HX.pubSig||own===HX_TRIED.sig&&Date.now()-HX_TRIED.t<10000))return;
    HX_TRIED={sig:own,t:Date.now()};Cloud.runMutation(()=>{S.mapPub=next})}finally{HX_PUBBING=false}}
window.hxCloudInstall=isRef=>{
  hxRead(hxUnpack(S.mapPub));
  if(!isRef){const ids=window.Cloud?.ownCrows?.()||[],pending=PARTY.filter(c=>ids.includes(c.id)&&c.trip&&Array.isArray(c.trip.route)&&Number.isFinite(c.trip.at)&&S.mapPub?.trips?.[c.id]!==c.trip.at);
    const trip=pending.reduce((a,c)=>!a||c.trip.at>a.at?c.trip:a,null);if(S.hxPub&&trip)S.hxPub.route=trip.route.filter(k=>typeof k==='string'&&HXK.test(k)).slice(0,60);return}
  if(!hxHere())return;
  const now=PARTY.filter(c=>c.trip&&Array.isArray(c.trip.route)&&Number.isFinite(c.trip.at));
  if(!HX.trips){HX.trips=hxTripsNow();store.set('hexmap',JSON.stringify(HX))}
  else{const fresh=now.filter(c=>HX.trips[c.id]!==c.trip.at);
    if(fresh.length){const t=fresh.reduce((a,c)=>c.trip.at>a.trip.at?c:a).trip;HX.route=t.route.filter(k=>typeof k==='string'&&HXK.test(k)).slice(0,60);HX.routeBy=fresh.find(c=>c.trip===t)?.id||'';
      for(const c of fresh)HX.trips[c.id]=c.trip.at;HX.trips=Object.fromEntries(Object.entries(HX.trips).filter(([id])=>PARTY.some(c=>c.id===id)));store.set('hexmap',JSON.stringify(HX))}}
  HX_PUBT=setTimeout(()=>hxPublish(true),0)};
// Back to the device's own saves: the map players last saw on a PeerJS table, if any.
window.hxCloudLeave=()=>{S.mapPub=null;clearTimeout(HX_PUBT);HX_TRIED={sig:'',t:0};HX_PUBERR='';try{S.hxPub=JSON.parse(store.get('hexpub')||'null')}catch{S.hxPub=null}};
// Ping: the newest one wins; everyone sees it for a few seconds
const PING={look:'Look here',danger:'Danger',go:'Go here'};
function hxPingIn(p){if(!p||typeof p!=='object'||!HXK.test(p.k||'')||!PING[p.kind]||!(+p.t))return;if(S.hxPing&&S.hxPing.t>=p.t)return;
  S.hxPing={k:p.k,kind:p.kind,by:String(p.by||'').slice(0,40),t:+p.t};if(Date.now()-S.hxPing.t<8000)toast(`${S.hxPing.by}: ${PING[p.kind]} — hex ${p.k}`)}

/* ---------- drawing ---------- */
const hxCorners=(m,s)=>Array.from({length:6},(_,i)=>{const a=(m.flat?60*i:60*i-30)*Math.PI/180;return [Math.cos(a)*s,Math.sin(a)*s]});
function hxPathD(m,keys,s=1){const C=hxCorners(m,s);let d='';for(const k of keys){const [x,y]=ctr(m,k);d+='M'+C.map(([a,b])=>(x+a).toFixed(2)+','+(y+b).toFixed(2)).join('L')+'Z'}return d}
// Catmull-Rom through the points, so rivers and roads bend instead of zig-zagging
function hxCurve(pts){if(pts.length<3)return 'M'+pts.map(p=>p.map(v=>v.toFixed(2)).join(',')).join('L');let d='M'+pts[0].map(v=>v.toFixed(2)).join(',');
  for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
    d+=`C${(p1[0]+(p2[0]-p0[0])/6).toFixed(2)},${(p1[1]+(p2[1]-p0[1])/6).toFixed(2)} ${(p2[0]-(p3[0]-p1[0])/6).toFixed(2)},${(p2[1]-(p3[1]-p1[1])/6).toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`}return d}
function hxBounds(m,keys){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const k of keys){const [x,y]=ctr(m,k);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}return [x0-1.2,y0-1.2,x1+1.2,y1+1.2]}
// the painted terrain, rivers, roads and grid only change with the map itself: keep that DOM and move it into each new <svg>
const HX_PC=new WeakMap();
// painting a map takes a few hundred ms: it runs in slices between frames (hxPaintAsync) while the stage says so, then renders
const HX_JOB=new WeakMap();
// WebGL turned out unusable (shader failed): forget paintings made for it so the flat preview is painted instead
function hxForget(){for(const m of [HX,S.hxPub])if(m?.t){HX_PC.delete(m.t);HX_JOB.delete(m.t)}}
function hxPaintG(m,keys,b){const j=HX_JOB.get(m.t);if(typeof j==='string')return `<g class="hxpaint">${j}</g>`;
  // the job paints a shallow copy: the editor swaps HX.paths/pois for new arrays while it runs (never mutates a painted t)
  if(!j){const t=m.t;HX_JOB.set(t,1);HX_LOAD.p=0;HX_LOAD.paint=0;hxPaintAsync({...m},keys,b,svg=>{HX_JOB.set(t,svg);HX_LOAD.paint=1;hxPainted(t);hxLoadTick()},n=>{HX_LOAD.paint=Math.min(1,n/101);hxLoadTick()})}
  return '<g class="hxpaint hxwait"></g>'}
// loading: the stage opens at once; a progress bar covers the map area until the terrain is painted and the GPU shader is ready,
// then it fades and the map shows. Painting (~0.5 s) and the shader compile (~2 s, in the GPU process) run side by side: progress is
// 30% painting steps + 70% compile (time-based, as the compiler reports nothing until it is done), and only ever grows.
// The finished painting is swapped into the stage as it is (no full render), so nothing on the page pauses.
const HX_LOAD={p:0,paint:0,iv:0};let HX_STAGE=null;
function hxLoadTick(){const s=HX_STAGE;if(!s||!s.st.isConnected){clearInterval(HX_LOAD.iv);HX_LOAD.iv=0;return}
  // editing: the last painting stays on screen (m.alt) while the new one paints and uploads; no progress bar; then it swaps in place
  if(!Object.keys(s.m.t).length){clearInterval(HX_LOAD.iv);HX_LOAD.iv=0;return hxLoadUI(s.st,false)} // a blank map: nothing to paint
  if(s.m.alt){hxLoadUI(s.st,false);const t=s.m.t;if(typeof HX_JOB.get(t)!=='string'&&!HX_PC.has(t))return;
    if(hxGLmay()){if(!HXGL.ready)return;const F=HXGL.maps.get(t);if(F&&F.up!==2){if(!F.up)hxGLShow(s.st,s.m);return}} // hxGLReady ticks again
    if(!s.ready){s.ready=1;setTimeout(()=>{if(HX_STAGE===s)hxEdSwap(s)},0)}return}
  const G=typeof HXGL!=='undefined'&&HXGL.gl!==false&&hxGLOK(),painting=HX_JOB.get(s.m.t)===1,gpu=G&&!HXGL.ready,F=G&&HXGL.maps.get(s.m.t),upl=G&&!painting&&!!F&&F.up!==2;
  if(!painting&&!gpu&&!upl){HX_LOAD.p=1;clearInterval(HX_LOAD.iv);HX_LOAD.iv=0;return hxLoadUI(s.st,false)}
  const pt=painting?HX_LOAD.paint:1,gt=!gpu?1:Math.min(.97,1-Math.exp(-(performance.now()-(HXGL.t0||performance.now()))/900)),ut=upl?(F.up?.5:0):1;
  HX_LOAD.p=Math.max(HX_LOAD.p,G?.3*pt+.62*gt+.08*ut:pt);HX_LOAD.iv||=setInterval(hxLoadTick,100);
  hxLoadUI(s.st,true)}
function hxLoadUI(st,on){let el=$('.hxload',st);st.classList.toggle('hxbusy',on);st.setAttribute('aria-busy',on);
  if(!on){if(el&&!el.classList.contains('done')){el.classList.add('done');setTimeout(()=>el.remove(),320)}return}
  if(!el||el.classList.contains('done')){el?.remove();$('svg',st).insertAdjacentHTML('afterend','<div class="hxload" role="progressbar" aria-label="Painting the map" aria-valuemin="0" aria-valuemax="100"><b>Painting the map</b><span class="hxbar"><i></i></span><small></small></div>');el=$('.hxload',st)}
  const v=Math.round(HX_LOAD.p*100);el.style.setProperty('--p',HX_LOAD.p.toFixed(3));el.setAttribute('aria-valuenow',v);el.querySelector('small').textContent=v+'%'}
function hxPainted(t){const s=HX_STAGE;if(!s||!s.st.isConnected||s.m.t!==t)return;const w=$('.hxwait',s.st);if(!w)return;
  w.insertAdjacentHTML('afterend',`<g class="hxpaint">${HX_JOB.get(t)}</g>`);const n=w.nextElementSibling;w.remove();HX_PC.set(t,n);HX_JOB.delete(t);
  if(typeof hxGLShow==='function')hxGLShow(s.st,s.m);hxLoadTick()}
function hxGLReady(){const s=HX_STAGE;if(s?.st.isConnected){hxGLShow(s.st,s.m);hxLoadTick()}}
function hxSVG(m,o){const keys=Object.keys(m.t),grid=new Set(keys),ref=o.ref&&!o.edit;
  if(!ref)for(let q=0;q<m.w;q++)for(let r=0;r<m.h;r++)grid.add(q+','+r);
  // fog: Ref dims unseen hexes, players (and the editor) see paper over blank cells; with WebGL the GPU paints it (hexgl.js),
  // not huge SVG paths — unless nothing is painted yet, so there is no GPU picture to paint it on
  const fogK=o.edit?[]:ref?(o.seen?keys.filter(k=>!o.seen[k]):[]):[...grid].filter(k=>!m.t[k]),GLon= // the editor draws its blank cells itself (hexedit.js)
typeof hxGLOK==='function'&&hxGLOK()&&keys.length>0;
  if(GLon)HXGL.fog={kind:ref?1:2,keys:fogK};
  const fog=GLon||!fogK.length?'':`<path class="${ref?'fogr':'fogp'}" d="${hxPathD(m,fogK,1.01)}"/>`;
  const regs=(o.regs||[]).filter(g=>g.name).map(g=>`<text class="reg" x="${g.x.toFixed(2)}" y="${g.y.toFixed(2)}"${/^#[0-9a-f]{3,8}$/i.test(g.color||'')?` style="fill:${g.color}"`:''}>${esc(g.name)}</text>`).join('');
  const line=(arr,cls)=>arr.length>1?`<path class="${cls}" d="M${arr.map(k=>ctr(m,k).map(v=>v.toFixed(2)).join(',')).join('L')}"/>`:'';
  const route=o.route?.length&&o.from?line([o.from,...o.route],'rt0')+line([o.from,...o.route],'rt')+(o.marks||[]).map(([k,n])=>{const [x,y]=ctr(m,k);return `<g class="rtd" transform="translate(${x.toFixed(2)},${y.toFixed(2)})"><rect x="-.62" y="-1.05" width="1.24" height=".46" rx=".1"/><text y="-.72">day ${n}</text></g>`}).join('')
    +`<circle class="rtend" r=".22" cx="${ctr(m,o.route.at(-1))[0].toFixed(2)}" cy="${ctr(m,o.route.at(-1))[1].toFixed(2)}"/>`:'';
  // Hexer's place badge: a half-clear disc and a ring in the place type's colour, the icon in dark ink, the name below
  const pois=(o.pois||[]).map(p=>{const [x,y]=ctr(m,p.k),ic=hxPoiIcon(p.type),z=.45*(HX_POI_TIER[p.type]||1);return `<g class="poi${p.found===false?' hid':''}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})" style="--c:${hxPoiCol(p.type)}"><circle class="esh" r=".483"/><circle class="ef" r=".46"/>${ic?`<path transform="translate(-.34,-.34) scale(${(.68/512).toFixed(6)})" d="${ic[2].join(' ')}"/>`:''}${p.label?`<text class="lbl" y="${(.55+.8*z).toFixed(3)}" style="font-size:${z.toFixed(3)}px;stroke-width:${(.22*z).toFixed(3)}px">${esc(p.label)}</text>`:''}</g>`}).join('');
  const mark=(k,q,drag)=>{if(!k)return '';const [x,y]=ctr(m,k);return `<g class="pty${q?' q':''}${drag?' drag':''}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})"><circle r=".5"/>${q?'<text y=".19">?</text>':'<image href="icons/icon_x64.png" x="-.36" y="-.36" width=".72" height=".72"/>'}</g>`};
  const sel=o.sel&&grid.has(o.sel)?`<path class="sel" d="${hxPathD(m,[o.sel],.96)}"/>`:'';
  const P=S.hxPing,pe=P?Date.now()-P.t:1e9,ping=P&&pe<4000&&grid.has(P.k)?(()=>{const [x,y]=ctr(m,P.k);return `<g class="hxping ${P.kind}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})" style="--d:-${pe}ms"><circle class="r1" r=".55"/><circle class="r2" r=".55"/><text y="-1">${esc(PING[P.kind])} · ${esc(P.by)}</text></g>`})():'';
  const [x0,y0,x1,y1]=hxBounds(m,grid.size?grid:keys),c=S.hx.cam||{x:(x0+x1)/2,y:(y0+y1)/2,k:30},W=S.hx.vw/c.k,H=S.hx.vh/c.k,b=[x0,y0,x1,y1];
  // the painting; while the editor's new terrain paints, the last painting (o.alt) stays in its place
  let paint='';if(keys.length){const ready=HX_PC.has(m.t)||typeof HX_JOB.get(m.t)==='string';
    if(o.alt&&!ready){hxPaintG(m,keys,b);paint=HX_PC.has(o.alt)?'<g class="hxslot" data-alt=""></g>':''}else paint=HX_PC.has(m.t)?'<g class="hxslot"></g>':hxPaintG(m,keys,b)}
  return `<svg class="hxmap${c.k<26?' small':''}${o.edit?' ed':''}" viewBox="${(c.x-W/2).toFixed(2)} ${(c.y-H/2).toFixed(2)} ${W.toFixed(2)} ${H.toFixed(2)}" data-b="${b.map(v=>v.toFixed(2))}" role="img" aria-label="${esc(m.name)} hex map">
   ${paint}${fog}
   <g class="ov">${o.ed||''}${typeof hxLines==='function'?hxLines(m):''}${regs}${line(o.trail||[],'tr')}${line(o.lostTrail||[],'tr lt')}${route}<path class="prev" d=""/>${sel}<path class="hov" d=""/>${pois}${hxTokSVG(m,o.tokens)}${mark(o.party,o.q,o.drag)}${o.ghost?mark(o.ghost,true):''}${ping}</g></svg>`}

// tokens (Hexer's map tokens: bands, armies, NPCs): a disc in the token's colour with its initials, the name below; hidden ones dashed
function hxTokSVG(m,ts){return (ts||[]).map(o=>{const [x,y]=ctr(m,o.k),ini=(o.name||'?').trim().split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
  return `<g class="tok${o.show===false?' hid':''}" transform="translate(${x.toFixed(2)},${(y+.08).toFixed(2)})" style="--c:${/^#[0-9a-f]{6}$/i.test(o.color||'')?o.color:'#8b4a3d'}"><circle r=".34"/><text class="ti" y=".11">${esc(ini)}</text>${o.name?`<text class="lbl" y=".72" style="font-size:.3px;stroke-width:.07px">${esc(o.name)}</text>`:''}</g>`}).join('')}
/* ---------- camera: drag, wheel, pinch, keys ---------- */
const KMAX=140;
// While a gesture runs the drawn map only moves as a GPU transform; the exact viewBox follows when it pauses.
function hxCamApply(st,now){const svg=$('svg',st),c=S.hx.cam;if(!svg||!c)return;const z=$('#hxzl',st);if(z)z.textContent=Math.round(c.k/30*100)+'%';
  const b=svg._c;if(!now&&b){svg.style.transform=`translate(${(b.x-c.x)*c.k}px,${(b.y-c.y)*c.k}px) scale(${c.k/b.k})`;if(typeof hxGLCam==='function')hxGLCam(st,false);clearTimeout(svg._t);svg._t=setTimeout(()=>hxCamApply(st,true),140);return}
  clearTimeout(svg._t);const W=st.clientWidth/c.k,H=st.clientHeight/c.k;svg.setAttribute('viewBox',`${c.x-W/2} ${c.y-H/2} ${W} ${H}`);svg.style.transform='';svg._c={...c};svg.classList.toggle('small',c.k<26);if(typeof hxGLCam==='function')hxGLCam(st,true)}
// fit into the part of the stage the side panel (right) or bottom sheet (narrow screens) leaves visible
function hxFit(st,keys,m){const [x0,y0,x1,y1]=hxBounds(m,keys),p=$('.hxpanel',st),sr=st.getBoundingClientRect(),pr=p?.offsetParent?p.getBoundingClientRect():null,
  side=pr&&pr.left>sr.left+8?pr.width:0,bot=pr&&!side?pr.height:0,k=Math.min(KMAX,Math.max(6,Math.min((st.clientWidth-side)/(x1-x0),(st.clientHeight-bot)/(y1-y0))*.95));
  return {x:(x0+x1)/2+side/2/k,y:(y0+y1)/2+bot/2/k,k}}
function hxAnim(st,to){const from={...S.hx.cam};if(matchMedia('(prefers-reduced-motion:reduce)').matches||!from.k){S.hx.cam=to;return hxCamApply(st)}
  const t0=performance.now(),step=t=>{const p=Math.min(1,(t-t0)/240),e=1-(1-p)**3;S.hx.cam={x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e,k:from.k*(to.k/from.k)**e};hxCamApply(st);if(p<1&&st.isConnected)requestAnimationFrame(step)};requestAnimationFrame(step)}
let HX_GLIDE=null;
function hxStage(m,o){const st=$('.hxstage');if(!st)return;
  // fill the screen below the tabs, above the bottom bar
  const nav=$('#nav'),navH=nav&&getComputedStyle(nav).position==='fixed'?nav.offsetHeight:0;
  if(!document.fullscreenElement)st.style.height=Math.max(420,innerHeight-(st.getBoundingClientRect().top+scrollY)-navH-12)+'px';
  S.hx.vw=st.clientWidth;S.hx.vh=st.clientHeight;const svg=$('svg',st),b=svg.dataset.b.split(',').map(Number);
  {const slot=$('.hxslot',svg),n=HX_PC.get(slot?.dataset.alt!=null?o.alt:m.t);if(slot&&n)slot.replaceWith(n);else{const p=$('.hxpaint',svg);if(p&&!p.classList.contains('hxwait')){HX_PC.set(m.t,p);HX_JOB.delete(m.t)}}}
  const gm=o.alt?{t:m.t,alt:o.alt}:m;HX_STAGE={st,m:gm};hxLoadTick();
  if(typeof hxGLShow==='function')hxGLShow(st,gm); // the GPU terrain under the SVG (hexgl.js)
  const allK=o.fitK||Object.keys(m.t),kmin=()=>Math.min(st.clientWidth/(b[2]-b[0]),st.clientHeight/(b[3]-b[1]))*.6;
  if(!S.hx.cam){if(o.party){const [x,y]=ctr(m,o.party);S.hx.cam={x,y,k:40}}else S.hx.cam=hxFit(st,allK,m)}
  // follow the token within the part of the stage the panel leaves open (beside it on wide screens, above it on narrow ones)
  if(S.hx.follow){const [x,y]=ctr(m,S.hx.follow),c=S.hx.cam,pn=$('.hxpanel',st),side=!!pn&&pn.offsetWidth>0&&pn.offsetLeft>0&&pn.offsetHeight>=st.clientHeight-1,low=!!pn&&pn.offsetHeight>0&&!side&&pn.offsetTop>0,
    ox=side?-pn.offsetWidth/2:0,oy=low?-pn.offsetHeight/2:0,vw=st.clientWidth-(side?pn.offsetWidth:0),vh=st.clientHeight-(low?pn.offsetHeight:0),dx=(x-c.x)*c.k-ox,dy=(y-c.y)*c.k-oy;S.hx.follow=null;
    if(Math.abs(dx)>vw*.35||Math.abs(dy)>vh*.35)hxAnim(st,{x:x-ox/c.k,y:y-oy/c.k,k:c.k})}
  hxCamApply(st,true);
  // the token glides from the last hex to the next one (not across the map, and not with reduced motion)
  {const g=$('g.pty',st),k=o.party;if(g&&k){const last=HX_GLIDE,[nx,ny]=ctr(m,k);if(last&&last.k!==k&&last.m===(m.name||'')+(o.ref?':ref':':pub')&&adj(m,last.k,k)&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&g.animate)
    g.animate([{transform:`translate(${last.x}px,${last.y}px)`},{transform:`translate(${nx}px,${ny}px)`}],{duration:450,easing:'ease-in-out'});HX_GLIDE={k,m:(m.name||'')+(o.ref?':ref':':pub'),x:nx,y:ny}}}
  const toMap=(cx,cy)=>{const r=st.getBoundingClientRect(),c=S.hx.cam;return [c.x+(cx-r.left-r.width/2)/c.k,c.y+(cy-r.top-r.height/2)/c.k]};
  const hexAt=(cx,cy)=>{const k=near(m,...toMap(cx,cy));return inGrid(m,k)?k:null};
  const zoomAt=(cx,cy,f)=>{const c=S.hx.cam,[mx,my]=toMap(cx,cy),k=Math.min(KMAX,Math.max(kmin(),c.k*f)),r=st.getBoundingClientRect();
    S.hx.cam={k,x:mx-(cx-r.left-r.width/2)/k,y:my-(cy-r.top-r.height/2)/k};hxCamApply(st)};
  st.hxZoom=f=>{const r=st.getBoundingClientRect();zoomAt(r.left+r.width/2,r.top+r.height/2,f)};
  st.hxFit=()=>hxAnim(st,hxFit(st,o.ref?allK:Object.keys(m.t).length?Object.keys(m.t):allK,m));
  st.hxCenter=()=>{const k=o.party||o.sel;if(k){const [x,y]=ctr(m,k);hxAnim(st,{x,y,k:Math.max(S.hx.cam.k,36)})}};
  const hov=$('path.hov',svg),prev=$('path.prev',svg),card=$('.hxcard',st),pty=$('.pty',svg);let lastHov=null;
  const showCard=(k,cx,cy)=>{if(k===lastHov&&card.hidden===false){placeCard(cx,cy);return}lastHov=k;if(!k){hov.setAttribute('d','');card.hidden=true;prev.setAttribute('d','');return}
    hov.setAttribute('d',hxPathD(m,[k],.96));card.innerHTML=o.card(k);card.hidden=!card.innerHTML;
    const pv=o.preview?.(k);prev.setAttribute('d',pv&&pv.length>1?'M'+pv.map(x=>ctr(m,x).map(v=>v.toFixed(2)).join(',')).join('L'):'');placeCard(cx,cy)};
  const placeCard=(cx,cy)=>{const r=st.getBoundingClientRect(),w=card.offsetWidth,h=card.offsetHeight;let x=cx-r.left+18,y=cy-r.top+18;if(x+w>r.width-8)x=cx-r.left-w-18;if(y+h>r.height-8)y=cy-r.top-h-18;card.style.transform=`translate(${Math.max(8,x)}px,${Math.max(8,y)}px)`};
  const pm=$('.hxpm',st),openPing=(cx,cy)=>{const k=hexAt(cx,cy);if(!k||!pm)return;const r=st.getBoundingClientRect();pm.dataset.k=k;pm.hidden=false;
    pm.style.transform=`translate(${Math.min(r.width-pm.offsetWidth-8,Math.max(8,cx-r.left-pm.offsetWidth/2))}px,${Math.min(r.height-pm.offsetHeight-8,Math.max(8,cy-r.top+12))}px)`;$('button',pm).focus()};
  const P=new Map();let g=null,lp=null,pinch=null;
  // Editor (o.paint): a single-pointer drag is a stroke of the current tool; the camera still pans with Space, the middle button,
  // the Pan tool (o.paint.pan) or two fingers. A touch waits ~90 ms or a few pixels before it paints, so a pinch paints nothing.
  const ed=o.paint,edHover=(cx,cy)=>{const [x,y]=toMap(cx,cy),k=near(m,x,y);hov.setAttribute('d',inGrid(m,k)?ed.hover(k,[x,y]):'');const pv=o.preview?.(k);prev.setAttribute('d',pv&&pv.length>1?'M'+pv.map(x=>ctr(m,x).map(v=>v.toFixed(2)).join(',')).join('L'):'')};
  const edStart=G=>{const [x,y]=toMap(G.e0.x,G.e0.y),k=near(m,x,y);G.on=true;G.xy=[x,y];G.last=inGrid(m,k)?k:null;ed.down(G.last,[x,y],G.e0)};
  st.onpointerdown=e=>{if(e.target.closest('.hxui')||e.button>1)return;if(!pm.hidden)pm.hidden=true;st.setPointerCapture(e.pointerId);P.set(e.pointerId,[e.clientX,e.clientY]);
    if(P.size===1){const stroke=ed&&!ed.pan(e);g={x:e.clientX,y:e.clientY,cam:{...S.hx.cam},moved:false,tok:o.drag&&pty&&(e.target.closest('.pty')||pty.getAnimations?.().length>0&&hexAt(e.clientX,e.clientY)===o.party), // while it glides, its hex is the token
      ping:false,
        ed:stroke?{on:false,t0:e.timeStamp,e0:{x:e.clientX,y:e.clientY,alt:e.altKey,shift:e.shiftKey}}:null};clearTimeout(lp);
      if(g.ed&&e.pointerType!=='touch')edStart(g.ed);
      if(!ed)lp=setTimeout(()=>{if(g&&!g.moved&&!g.tok){g.ping=true;openPing(g.x,g.y)}},550)}
    else if(P.size===2){clearTimeout(lp);if(g?.ed?.on)ed.up(g.ed.last,g.ed.xy);g=null;const [a,b2]=[...P.values()];pinch={d:Math.hypot(a[0]-b2[0],a[1]-b2[1]),cx:(a[0]+b2[0])/2,cy:(a[1]+b2[1])/2,cam:{...S.hx.cam}}}};
  st.onpointermove=e=>{if(!P.has(e.pointerId)){if(e.target.closest('.hxui'))showCard(null);else if(ed&&e.pointerType==='mouse')edHover(e.clientX,e.clientY);else if(e.pointerType==='mouse')showCard(hexAt(e.clientX,e.clientY),e.clientX,e.clientY);return}
    P.set(e.pointerId,[e.clientX,e.clientY]);
    if(g?.ed&&!pinch){const E=g.ed;if(!E.on){if(Math.hypot(e.clientX-g.x,e.clientY-g.y)<5&&e.timeStamp-E.t0<90)return;edStart(E)}
      // walk the segment since the last event, so a fast stroke doesn't skip hexes
      const [x,y]=toMap(e.clientX,e.clientY),[px,py]=E.xy,n=Math.max(1,Math.ceil(Math.hypot(x-px,y-py)/.4));E.xy=[x,y];
      for(let i=1;i<=n;i++){const k=near(m,px+(x-px)*i/n,py+(y-py)*i/n);if(k!==E.last&&inGrid(m,k)){E.last=k;ed.move(k,[x,y])}}
      edHover(e.clientX,e.clientY);return}
    if(pinch&&P.size===2){const [a,b2]=[...P.values()],d=Math.hypot(a[0]-b2[0],a[1]-b2[1]),cx=(a[0]+b2[0])/2,cy=(a[1]+b2[1])/2,r=st.getBoundingClientRect(),c0=pinch.cam;
      const mx=c0.x+(pinch.cx-r.left-r.width/2)/c0.k,my=c0.y+(pinch.cy-r.top-r.height/2)/c0.k,k=Math.min(KMAX,Math.max(kmin(),c0.k*d/pinch.d));
      S.hx.cam={k,x:mx-(cx-r.left-r.width/2)/k,y:my-(cy-r.top-r.height/2)/k};hxCamApply(st);return}
    if(!g)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.moved&&Math.hypot(dx,dy)>6){g.moved=true;clearTimeout(lp);showCard(null)}
    if(!g.moved)return;
    if(g.tok){const [x,y]=toMap(e.clientX,e.clientY);pty.setAttribute('transform',`translate(${x.toFixed(2)},${y.toFixed(2)})`);const k=hexAt(e.clientX,e.clientY);hov.setAttribute('d',k?hxPathD(m,[k],.96):'');return}
    S.hx.cam={...g.cam,x:g.cam.x-dx/g.cam.k,y:g.cam.y-dy/g.cam.k};hxCamApply(st)};
  st.onpointerup=st.onpointercancel=e=>{if(!P.has(e.pointerId))return;P.delete(e.pointerId);clearTimeout(lp);
    if(pinch){if(P.size<2)pinch=null;return}
    const G=g;g=null;if(G?.ed){if(!G.ed.on&&e.type==='pointercancel')return;if(!G.ed.on)edStart(G.ed);return ed.up(G.ed.last,G.ed.xy)}
    if(!G||e.type==='pointercancel'||G.ping)return;const k=hexAt(e.clientX,e.clientY);
    if(G.tok&&G.moved)return o.drop(k);if(!G.moved&&k)o.tap(k,e.pointerType)};
  st.onwheel=e=>{if(e.target.closest('.hxpanel'))return;e.preventDefault();showCard(null);const dy=e.deltaMode===1?e.deltaY*16:e.deltaY;zoomAt(e.clientX,e.clientY,Math.exp(-dy*(e.ctrlKey?.01:.0015)))};
  st.oncontextmenu=e=>{if(e.target.closest('.hxui'))return;e.preventDefault();if(!ed)openPing(e.clientX,e.clientY)};
  st.onpointerleave=e=>{if(e.pointerType==='mouse')showCard(null)};
  st.onkeydown=e=>{if(e.target!==st)return;const c=S.hx.cam,s=e.shiftKey?240:80,K={ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,-s],ArrowDown:[0,s]}[e.key];
    if(K){S.hx.cam={...c,x:c.x+K[0]/c.k,y:c.y+K[1]/c.k};hxCamApply(st)}else if(e.key==='+'||e.key==='=')st.hxZoom(1.25);else if(e.key==='-')st.hxZoom(.8);else if(e.key==='0')st.hxFit();else return;e.preventDefault()};
  if(pm)pm.onclick=e=>{const b2=e.target.closest('button');if(!b2)return;pm.hidden=true;if(b2.dataset.v)hxPingSend(pm.dataset.k,b2.dataset.v)};
  if(pm)pm.onkeydown=e=>{if(e.key==='Escape'){pm.hidden=true;st.focus()}}}
function hxPingSend(k,kind){S.hxPing={k,kind,by:S.area==='session'?'Ref':ME?.name||'Player',t:Date.now()};render()}
addEventListener('resize',()=>{const st=$('.hxstage');if(st){clearTimeout(hxPingSend.r);hxPingSend.r=setTimeout(render,120)}});
document.addEventListener('fullscreenchange',()=>{if($('.hxstage'))setTimeout(render,60)});

/* ---------- shared pieces of both screens ---------- */
const POS={northwest:'1/1',north:'1/2',northeast:'1/3',west:'2/1',east:'2/3',southwest:'3/1',south:'3/2',southeast:'3/3'};
const ABBR=s=>s.replace(/north/,'N').replace(/south/,'S').replace(/east/,'E').replace(/west/,'W').toUpperCase();
function hxPad(m,from,act,verb,ok){return `<div class="hxpad" role="group" aria-label="${verb}">${nbs(m,from).map(n=>`<button type="button" class="btn sm" style="grid-area:${POS[n.dir]}" data-action="${act}" data-k="${n.k}" aria-label="${verb} ${n.dir}" ${ok(n.k)?'':'disabled'}>${ABBR(n.dir)}</button>`).join('')}<span class="hxc" style="grid-area:2/2" aria-hidden="true">●</span></div>`}
const fileBtn=label=>`<label class="btn${HX?'':' primary'} hxfile"><input type="file" id="hxfile" accept=".json,application/json">${label}</label>`;
const ICO={fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',party:'<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  full:'<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/>',exit:'<path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"/>',panel:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M15 4v16"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'};
const hxIco=k=>`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[k]}</svg>`;
const canFull=()=>!!(document.documentElement.requestFullscreen);
// the view groups at the right end of the HUD bar (.hxhud.bar: left groups, a spacer, these; they wrap to a second row when the map is narrow)
function hxTools(extra='',noParty){return `<div class="hxtr"><div class="hxtools" role="group" aria-label="Map view">
   <button type="button" data-action="hxzoom" data-v="0.8" aria-label="Zoom out">−</button><button type="button" id="hxzl" data-action="hxfit" aria-label="Fit the map" title="Fit the map (0)">100%</button><button type="button" data-action="hxzoom" data-v="1.25" aria-label="Zoom in">+</button></div>
   <div class="hxtools" role="group" aria-label="Map tools">${noParty?'':`<button type="button" data-action="hxcenter" aria-label="Centre on the party" title="Centre on the party">${hxIco('party')}</button>`}${extra}
   ${canFull()?`<button type="button" data-action="hxfull" aria-label="${document.fullscreenElement?'Leave full screen':'Full screen'}" title="Full screen">${hxIco(document.fullscreenElement?'exit':'full')}</button>`:''}
   <button type="button" data-action="hxpanel" aria-pressed="${S.hx.panel}" aria-label="${S.hx.panel?'Hide':'Show'} the side panel" title="Side panel">${hxIco('panel')}</button></div></div>`}
const pingMenu=`<div class="hxpm hxui" hidden role="menu" aria-label="Ping this hex for the table"><button type="button" data-v="look" role="menuitem">Look here</button><button type="button" data-v="danger" role="menuitem">Danger</button><button type="button" data-v="go" role="menuitem">Go here</button><button type="button" class="x" role="menuitem">Cancel</button></div>`;
function journeyHTML(m){const L=hxLog(m);return `<section class="hxsec"><h3 class="hxh">Journey${L.length?` <button class="btn sm ghost" data-action="hxrecap">Copy recap</button>`:''}</h3>
  ${L.length?`<ol class="hxlog">${L.slice().reverse().map(r=>{const [d,...rest]=logLine(r);return `<li><b>${d}</b> ${esc(rest.join(' · '))}</li>`}).join('')}</ol>`:'<p class="small muted">Each travel day writes itself here: hexes walked, places found, encounters, camp.</p>'}</section>`}
const stageAttrs=label=>`class="hxstage" data-panel="${S.hx.panel?'open':'closed'}" tabindex="0" aria-label="${label}. Drag to move, wheel or pinch to zoom, arrow keys to pan, plus and minus to zoom, zero to fit. Long-press or right-click to ping a hex."`;

/* ---------- Ref: Hex map ---------- */
// On a server table the device's map is shared with one adventure; anywhere else the Ref chooses to share it.
function hxShareBox(){const other=!!HX.adv;return `<div class="box hxempty"><h2 class="sec-h">Hex map</h2>
  <p>${other?`The map on this device, <b>${esc(HX.name)}</b>, is shared with ${HX.advName?`another adventure, <b>${esc(HX.advName)}</b>`:'another adventure'}. Players here don’t see it.`:`The map on this device, <b>${esc(HX.name)}</b>, isn’t shared with this adventure yet.`}</p>
  <p class="muted">Once it is shared, players here see only what the party has seen. The full map stays on this device.${other?' The other adventure keeps the last map its players saw.':''}</p>
  <div class="row"><button class="btn primary" data-action="hxshare">${other?'Use this map here instead':'Share with this adventure'}</button>${other?'':fileBtn('Import another map')}</div></div>`}
// over: the side panel to show instead (the Journey tab puts the day's step there)
SCREENS.rmap=over=>{
  if(!HX)return `<div class="box hxempty"><h2 class="sec-h">Hex map</h2><p>Draw the map here, let the generator rough out a world, or bring one from <a href="https://hexermap.com" target="_blank" rel="noopener">Hexer</a> (<b>File → Export → JSON Data</b>). Terrain, places, notes, roads, rivers, regions and walls all work the same way.</p>
    <p class="muted">The map stays on this device. Players get only what the party has seen: the party’s hex and its neighbours, and the places you mark as found.</p>
    <div class="row"><button class="btn primary" data-action="hxnew">New map</button><button class="btn" data-action="hxgen">Generate a world</button>${fileBtn('Import from Hexer')}</div></div>`;
  if(!hxHere())return hxShareBox();
  if(S.hx.edit&&over===undefined)return hxEditScreen();
  hxCatchUp();const R=S.rtravel,T=rtDay(),P=HX.party,sel=S.hx.sel||P,per=hxPer(),view=S.hx.asPlayers?hxPub():null;
  const ri=HX.route.length&&HX.known?hxRouteInfo(HX,HX.known,HX.route,per):null;
  const pois=sel?HX.pois.filter(p=>p.k===sel):[],notes=sel?HX.notes.filter(n=>n.k===sel):[],reg=sel?HX.regs.filter(g=>g.ks.includes(sel)).map(g=>g.name).filter(Boolean):[];
  const road=k=>[...hxRoads(HX)].some(e=>e.startsWith(k+'|'));
  const selBox=!sel?'<section class="hxsec"><p class="small muted" style="margin:0">Tap a hex to see what is there and to start the party on it.</p></section>'
   :`<section class="hxsec"><h3 class="hxh">${HX.t[sel]?esc(tName(HX,HX.t[sel])):'Unpainted'} <span class="muted">hex ${sel}${reg.length?' · '+esc(reg.join(', ')):''}</span></h3>
    <p class="small" style="margin:0 0 .6rem">${HX.seen[sel]?'Players see this hex.':'Hidden from players.'}${road(sel)?' A road runs here.':''}${sel===P?` <b>The party is here${T.lost?' — lost':''}.</b>`:''}</p>
    <div class="row">${!P?`<button class="btn primary" data-action="hxput" data-k="${sel}" ${HX.t[sel]?'':'disabled'}>Start the party here</button>`
      :sel!==P&&adj(HX,P,sel)?`<button class="btn primary" data-action="hxgo" data-k="${sel}">${T.lost?'Head this way — lost, a d6 decides':'Move the party here'}</button>`
      :sel!==P?`<button class="btn" data-action="hxput" data-k="${sel}" ${HX.t[sel]?'':'disabled'}>Put the party here</button>`:''}
     <button class="btn" data-action="hxfog" data-k="${sel}">${HX.seen[sel]?'Hide from players':'Show to players'}</button></div>
    ${pois.length?`<h4 class="bh">Places</h4>${pois.map(p=>`<div class="row hxrow"><span><b>${esc(p.label||tName(HX,p.type))}</b> <span class="small muted">${esc(tName(HX,p.type))}${p.found?' · players know it':''}</span></span><button class="btn sm" data-action="hxfound" data-i="${HX.pois.indexOf(p)}">${p.found?'Hide it again':'Players found it'}</button></div>`).join('')}<p class="small muted" style="margin:.3rem 0 0">Scout for Places finds unknown places in the party’s hex.</p>`:''}
    ${notes.length?`<h4 class="bh">Notes</h4>${notes.map(n=>`<div class="hxnote"><b>${esc(n.title)}</b>${n.dm?' <span class="tag">Ref only</span>':' <span class="tag">players see it with the hex</span>'}<p>${esc(n.text)}</p></div>`).join('')}`:''}</section>`;
  const nextK=HX.route[0];
  const panel=over!==undefined?over:view?`<section class="hxsec"><h3 class="hxh">Players’ view</h3><p class="small">This is exactly what the players’ Map tab shows: seen hexes, found places, the party where they think it is.</p><button class="btn" data-action="hxasp">Back to the full map</button></section>`
   :`<section class="hxsec"><h3 class="hxh">Party <span class="muted">${P?`hex ${P}`:'not on the map yet'}</span> <button class="btn sm ghost" data-action="tab" data-v="rtravel">Travel day →</button></h3>
     ${T.lost&&P?'<p class="banner bad small"><b>Lost.</b> Each move goes to a random neighbour (d6). Players see “?” until the guide gets them Back on Track.</p>':''}
     ${P?`<div class="row" style="align-items:flex-start;gap:1rem">${hxPad(HX,P,'hxgo','Move',k=>!!HX.t[k])}
      <div class="stack" style="gap:.5rem;flex:1;min-width:10rem">${ri?`<p class="small" style="margin:0">Players propose <b>${ri.n}</b> hex${ri.n>1?'es':''} · ≈ ${dfmt(ri.days)}${ri.road?` (${ri.road} by road)`:''}.</p><button class="btn primary" data-action="hxstep">${T.lost?'Next step — lost, a d6 decides':`Next step → ${nbs(HX,P).find(n=>n.k===nextK)?.dir||'hex '+nextK}`}</button><button class="btn sm ghost" data-action="hxclear">Clear their route</button>`
        :'<p class="small muted" style="margin:0">No route from the players yet. Move with the pad, drag the token, or tap a neighbouring hex twice.</p>'}</div></div>`
      :'<p class="small muted" style="margin:0">Tap a hex on the map, then “Start the party here”.</p>'}</section>
    ${selBox}<section class="hxsec"><h3 class="hxh">Fog of war <span class="muted">${Object.keys(HX.t).filter(k=>!HX.seen[k]).length} hexes hidden</span></h3><div class="row"><button class="btn sm" data-action="hxfogtool">Reveal or hide by painting →</button></div></section>${journeyHTML(HX)}
    <section class="hxsec"><h3 class="hxh">${esc(HX.name)} <span class="muted">${Object.keys(HX.t).length} hexes · ${HX.pois.length} places</span></h3><div class="row"><button class="btn" data-action="hxmode" data-v="edit">Edit the map</button><button class="btn" data-action="hxexport">Export for Hexer</button><button class="btn" data-action="hxpng">Save as PNG</button>${fileBtn('Load another map')}<button class="btn ghost" data-action="hxdel">Remove the map</button></div>${hxSavedLine()}${hxCloud()?`<p class="small${HX_PUBERR?' bad':' muted'}" role="status" style="margin:.3rem 0 0">${esc(HX_PUBERR||'Shared with this adventure’s players: they see what the party has seen.')}</p>`:''}<p class="small muted" style="margin:.4rem 0 0">${typeof HX_ICON_CREDIT!=='undefined'?esc(HX_ICON_CREDIT):''}</p></section>`;
  return `<div ${stageAttrs(`${esc(HX.name)}, Ref’s map`)}>
    ${view?hxSVG(view,{pois:view.pois,tokens:view.tokens,party:view.party,q:view.lost,trail:view.trail,route:view.route,from:view.party,regs:view.regs})
      :hxSVG(HX,{ref:1,seen:HX.seen,pois:HX.pois,tokens:HX.tokens,sel,party:P,ghost:T.lost&&HX.known!==P?HX.known:null,trail:HX.trail,lostTrail:[HX.known,...HX.lostTrail].filter(Boolean),route:HX.route,from:HX.known,marks:ri?.marks,drag:!!P,
        regs:HX.regs.filter(g=>g.name&&g.ks.length).map(g=>{const c=g.ks.map(k=>ctr(HX,k));return {name:g.name,color:g.color,x:c.reduce((a,v)=>a+v[0],0)/c.length,y:c.reduce((a,v)=>a+v[1],0)/c.length}})})}
    <div class="hxhud bar hxui">${over!==undefined?'':hxModeSeg()}<span class="hxchip"><b>Day ${R.day}</b> · ${PACE[R.pace].label} · moved <b>${R.moved||0}</b>/${T.hexes}</span>${(R.moved||0)>T.hexes?'<span class="hxchip bad">Past today’s pace</span>':''}${T.lost&&P?'<span class="hxchip bad">Lost</span>':''}${view?'<span class="hxchip">Players’ view</span>':''}<span class="hxgrow"></span>
    ${hxTools(`<button type="button" data-action="hxasp" aria-pressed="${!!view}" aria-label="Players’ view" title="Players’ view">${hxIco('eye')}</button>`)}</div>
    <div class="hxcard hxui" hidden></div>${pingMenu}
    <aside class="hxpanel hxui" aria-label="${over!==undefined?'Journey panel':'Hex map panel'}">${panel}</aside></div>`};
AFTER.rmap=()=>{if(!hxHere())return;if(S.hx.edit)return hxEditAfter();const view=S.hx.asPlayers?hxPub():null,m=view||HX;
  hxStage(m,{ref:!view,party:view?view.party:HX.party,sel:S.hx.sel,drag:!view&&!!HX.party,
    card:k=>{const t=m.t[k];if(!t)return '';const pl=(view?view.pois:HX.pois).filter(p=>p.k===k),rd=[...hxRoads(m)].some(e=>e.startsWith(k+'|'));
      return `<b>${esc(tName(m,t))}</b> <span class="muted">hex ${k}</span>${rd?'<div>Road</div>':''}${pl.map(p=>`<div>${esc(p.label||tName(m,p.type))}${p.found===false?' <i>(not found yet)</i>':''}</div>`).join('')}
       ${!view&&!HX.seen[k]?'<div class="muted">Hidden from players</div>':''}${view?'':k===HX.party?'<div class="muted">The party is here · drag to move</div>':HX.party&&adj(HX,HX.party,k)?`<div class="muted">${hxScripted()?'Next hex on the Journey panel moves the party':'Tap twice to move here'}</div>`:''}`},
    tap:k=>{if(view)return;if(HX.party&&k!==HX.party&&adj(HX,HX.party,k)&&S.hx.sel===k){if(hxScripted()){S.hx.sel=k;render();return toast('Today the party walks the day’s script: Next hex on the Journey panel')}hxMove(k);return render()}S.hx.sel=k;render()},
    drop:k=>{HX_GLIDE=null; // dropped by hand: already there, no glide
      if(!k||k===HX.party||!HX.t[k])return render();if(adj(HX,HX.party,k)&&!hxScripted())hxMove(k);else{const on=hxScripted();A.hxput({dataset:{k}});return toast(on?'Put there — not counted as travel; today’s path ends here':'Put there — not counted as travel')}render()}})};
// the Journey's day script moves the token (journey.js); a tap does not walk outside it
const hxScripted=()=>typeof jOnScript==='function'&&jOnScript();

/* ---------- player: Map ---------- */
// On the Ref's own device the Map tab shows exactly what the players get.
const myPub=()=>hxHere()?hxPub():S.hxPub;
SCREENS.map=over=>{const m=myPub();
  if(!m)return `<div class="box hxempty"><h2 class="sec-h">Map</h2><p class="muted">The Ref hasn’t shared a hex map yet. When they do, you’ll see the land the party has crossed and can plan where to go.</p></div>`;
  const from=m.route.at(-1)||m.party,canAdd=k=>!!from&&k!==m.party&&adj(m,from,k)&&!m.route.includes(k),ri=m.route.length&&m.party?hxRouteInfo(m,m.party,m.route,m.per):null;
  return `<div ${stageAttrs(`${esc(m.name)}, the party’s map`)}>
    ${hxSVG(m,{pois:m.pois,tokens:m.tokens,party:m.party,q:m.lost,trail:m.trail,route:m.route,from:m.party,marks:ri?.marks,regs:m.regs})}
    <div class="hxhud bar hxui">${m.day?`<span class="hxchip"><b>Day ${m.day}</b> · ${esc(m.pace)} · moved <b>${m.moved}</b>/${m.hexes}</span>`:''}${m.lost?'<span class="hxchip bad">Lost</span>':''}${ri?`<span class="hxchip">Route ${ri.n} hex${ri.n>1?'es':''} · ≈ ${dfmt(ri.days)}</span>`:''}<span class="hxgrow"></span>${hxTools()}</div>
    <div class="hxcard hxui" hidden></div>${pingMenu}
    <aside class="hxpanel hxui" aria-label="${over!==undefined?'Journey panel':'Map panel'}">${over!==undefined?over:`
     ${m.lost?'<p class="banner bad small"><b>You are lost.</b> The “?” is the last place you were sure of. The Ref knows where you really are; the guide can try Back on Track.</p>':''}
     <section class="hxsec"><h3 class="hxh">Your route <span class="muted">${ri?`${ri.n} hex${ri.n>1?'es':''} · ≈ ${dfmt(ri.days)} at ${esc(m.pace)}${ri.road?` · ${ri.road} by road`:''}`:'none yet'}</span></h3>
      <p class="small muted" style="margin:0 0 .6rem">Tap where you want to go: the shortest way is drawn, roads first. Tap a hex on the route to cut it there. The Ref moves the party.</p>
      ${m.party?`<div class="row" style="align-items:flex-start;gap:1rem">${hxPad(m,from,'hxadd','Add a step',canAdd)}<div class="stack" style="gap:.5rem"><button class="btn" data-action="hxundo" ${m.route.length?'':'disabled'}>Take back a step</button><button class="btn ghost" data-action="hxrclear" ${m.route.length?'':'disabled'}>Clear the route</button></div></div>`
       :'<p class="small muted" style="margin:0">The Ref hasn’t put the party on the map yet.</p>'}</section>
     <section class="hxsec"><h3 class="hxh">Places you know</h3>${m.pois.length?m.pois.map(p=>`<div class="hxrow"><b>${esc(p.label||tName(m,p.type))}</b> <span class="small muted">${esc(tName(m,p.type))} · hex ${esc(p.k)}</span></div>`).join(''):'<p class="small muted" style="margin:0">None yet. A scout looking for places finds them.</p>'}
      ${m.notes.length?`<h4 class="bh">Notes</h4>${m.notes.map(n=>`<div class="hxnote"><b>${esc(n.title)}</b> <span class="small muted">hex ${esc(n.k)}</span><p>${esc(n.text)}</p></div>`).join('')}`:''}</section>
     ${journeyHTML(m)}`}</aside></div>`};
AFTER.map=()=>{const m=myPub();if(!m)return;const per=m.per||2;
  const plan=k=>{const end=m.route.at(-1)||m.party;if(!end||k===m.party||m.route.includes(k))return null;return hxPath(m,end,k,per,false)};
  hxStage(m,{party:m.party,sel:null,
    card:k=>{const t=m.t[k],pl=m.pois.filter(p=>p.k===k),p=plan(k),i=p&&hxRouteInfo(m,m.route.at(-1)||m.party,p,per),idx=m.route.indexOf(k);
      return `<b>${t?esc(tName(m,t)):'Unknown land'}</b> <span class="muted">hex ${k}</span>${pl.map(x=>`<div>${esc(x.label||tName(m,x.type))}</div>`).join('')}
       ${i?`<div>+${i.n} hex${i.n>1?'es':''} · ≈ ${dfmt(i.days)}${i.road?` · ${i.road} by road`:''}</div><div class="muted">Click to add to the route</div>`:idx>=0?`<div class="muted">Click to ${idx===m.route.length-1?'take back this step':'cut the route here'}</div>`:k===m.party?'<div class="muted">The party is here</div>':t&&HX_WATER.test(t)?'<div class="muted">No way on foot</div>':''}`},
    preview:k=>{const p=plan(k);return p?[m.route.at(-1)||m.party,...p]:null},
    tap:(k,pt)=>{if(!m.party)return;const idx=m.route.indexOf(k);
      if(idx>=0)return hxRoute(idx===m.route.length-1?m.route.slice(0,-1):m.route.slice(0,idx+1));
      const p=plan(k);if(!p)return toast(k===m.party?'The party is here':'No way there on foot');
      const r=[...m.route,...p].slice(0,60),i=hxRouteInfo(m,m.party,r,per);hxRoute(r);if(pt!=='mouse')toast(`Route: ${i.n} hexes · ≈ ${dfmt(i.days)}`)}})};

/* ---------- actions ---------- */
const hxRoute=r=>{if(hxHere()){HX.route=r;HX.routeBy='';saveHX()}else if(S.hxPub){
  // On a server table the proposal is written to the player's own crow; the Ref's device takes it in.
  if(hxCloud()){const mine=hxMine();if(!mine)return toast('Only a player with a crow in this adventure can propose a route');S.hxPub.route=r;Cloud.runMutation(()=>{mine.trip={...(mine.trip||{}),route:r.slice(0,60),at:Date.now()}})}
  else{S.hxPub.route=r;store.set('hexpub',JSON.stringify(S.hxPub))}}render()};
const hxSt=()=>$('.hxstage');
Object.assign(A,{
  hxzoom:b=>hxSt()?.hxZoom(+b.dataset.v),hxfit:()=>hxSt()?.hxFit(),hxcenter:()=>hxSt()?.hxCenter(),
  hxfull:()=>{const st=hxSt();if(!st)return;document.fullscreenElement?document.exitFullscreen():st.requestFullscreen?.().catch(()=>toast('This browser won’t go full screen here'))},
  hxpanel:()=>{S.hx.panel=!S.hx.panel;render()},hxasp:()=>{S.hx.asPlayers=!S.hx.asPlayers;render()},
  hxrecap:()=>{const m=hxHere()?HX:S.hxPub;if(!m)return;const txt=`${m.name}\n`+hxLog(m).map(r=>{const [d,...x]=logLine(r);return `${d}: ${x.join('; ')}`}).join('\n');
    navigator.clipboard?.writeText(txt).then(()=>toast('Recap copied'),()=>toast('Copy didn’t work in this browser'))},
  hxadd:b=>hxRoute([...myPub().route,b.dataset.k].slice(0,60)),
  hxundo:()=>hxRoute(myPub().route.slice(0,-1)),
  hxrclear:()=>hxRoute([]),
  // Start or correct the party's place (not a move: it doesn't count toward today's hexes)
  hxput:b=>{const k=b.dataset.k;HX.party=k;if(!rtDay().lost){HX.known=k;HX.trail=[k];HX.lostTrail=[];hxReveal(k)}else HX.lostTrail.push(k);HX.route=[];HX.routeBy='';S.hx.follow=k;saveHX();render()},
  hxgo:b=>{hxMove(b.dataset.k);render()},
  hxstep:()=>{const k=HX.route[0];if(!k)return;
    if(!rtDay().lost&&!adj(HX,HX.party,k)){toast('Their route doesn’t start next to the party — ask them to redraw it');HX.route=[];saveHX();return render()}
    HX.route.shift();hxMove(k);render()},
  hxclear:()=>{HX.route=[];HX.routeBy='';saveHX();render()},
  hxfog:b=>{const k=b.dataset.k;if(HX.seen[k])delete HX.seen[k];else HX.seen[k]=1;saveHX();render()},
  hxfound:b=>{const p=HX.pois[+b.dataset.i];p.found=!p.found;if(p.found){HX.seen[p.k]=1;hxDayRec().found.push(p.label||tName(HX,p.type))}saveHX();render()},
  hxshare:()=>{const go=()=>{hxClaim();store.set('hexmap',JSON.stringify(HX));hxPublish();render()};
    if(!HX.adv)return go();askYes('Use this map here?',`Players of this adventure will see what the party has seen on ${HX.name}. ${HX.advName||'The other adventure'} keeps the last map its players saw.`,'Use it here',go)},
  hxdel:()=>{if(hxCloud()&&hxHere()&&Cloud.hasConflict())return toast('Resolve the queued conflict first: until then the players’ copy of the map can’t be removed.');askYes('Remove the hex map?','The party’s place, what the players have seen and the journey log go with it. The file you exported from Hexer is untouched.','Remove',()=>{
    // on a server table the players' copy goes too
    if(hxCloud()&&hxHere())Cloud.runMutation(()=>{S.mapPub={}});HX=null;store.set('hexmap','null');S.hx.sel=null;S.hx.cam=null;S.hx.edit=false;hxEdReset();render()})}});
document.addEventListener('change',e=>{if(e.target.id!=='hxfile')return;const f=e.target.files[0];if(!f)return;
  const load=()=>f.text().then(txt=>{let m;try{m=hxParse(txt)}catch(err){return toast(err instanceof SyntaxError?'That isn’t a JSON file from Hexer':err.message)}
    HX=m;HX.day=S.rtravel.day;HX.moved=S.rtravel.moved||0;hxClaim();S.hx.sel=null;S.hx.cam=null;hxEdReset();saveHX();render();toast(`${m.name}: ${Object.keys(m.t).length} hexes, ${m.pois.length} places`)});
  if(HX)askYes('Replace the hex map?',`${HX.name}, the party’s place on it and its journey log give way to the new file.`,'Replace',load);else load()});
