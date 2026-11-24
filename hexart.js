'use strict';
/* CROW NEST — the painted, top-down look of the hex map (hexmap.js draws routes, fog, places and the camera).
   Matched against Hexer's export of the same map, pixel by pixel (QA/hexmap.md, v8–v11):
   - hxPaint computes smooth fields once per map (≤1.2 Mpx, ≤16 px per hex radius): land/water/forest-floor colours,
     terrain masks drawn as hex shapes, height slopes, distance from shore, and signed distance fields for rivers, roads
     and delta channels; hexgl.js paints from them on the GPU at screen resolution (borders bent by noise, crisp shores,
     rivers merged with lakes and seas, roads with grain, tree crowns, corals, rock planes, peaks, hill domes);
   - vectors on top: a few marks Hexer also draws (grass tufts, meadow flowers, savanna tussocks, marsh puddles, reef
     foam, oasis pool), the hex grid, region borders in the region's colour, blocked edges as dark red walls;
   - without WebGL 2 a flat preview image (colours, water, rivers) stands in for the GPU painting.
   Units: 1 = one hex radius. Rebuilt only when the map changes (hexmap.js caches it). */
// Hexer's 41 free terrain types: group and base colour
const HXT={plains:['plain','#b6b47b'],grassland:['plain','#9ea468'],savanna:['sav','#b29452'],steppe:['plain','#b7a064'],meadow:['plain','#9ca765'],
  glade:['plain','#949d66'],valley:['plain','#7f9156'],farmland:['farm','#c3a74f'],heath:['heath','#858046'],hill:['hills','#a2a466'],
  forest:['forest','#4c3d25'],jungle:['forest','#2c2c17'],'mushroom-forest':['forest','#4a3a36'],'dense-forest':['forest','#4c3820'],
  swamp:['marsh','#676d3f'],marsh:['marsh','#8c8950'],bog:['marsh','#6f6a45'],delta:['marsh','#9a9362'],
  mountain:['mount','#8f7f6c'],'mountain-peak':['mount','#c4b8a6'],crag:['mount','#7e725e'],volcano:['mount','#6a5547'],'crystal-cavern':['mount','#9aa0aa'],
  desert:['sand','#d1ae6e'],coast:['sand','#d6bd83'],oasis:['sand','#c9b27a'],badlands:['bad','#bd6a3c'],canyon:['bad','#a65d37'],crater:['bad','#9b8a72'],
  tundra:['snow','#b9b3a8'],glacier:['snow','#e3e6e6'],'frozen-lake':['snow','#c9d9df'],
  ocean:['deep','#17374a'],'deep-ocean':['deep','#12303f'],sea:['deep','#2f516d'],fjord:['deep','#2f516d'],lake:['water','#41667a'],pond:['water','#5c7c8e'],
  'hot-spring':['water','#5f9aa6'],reef:['reef','#5e9093'],rapids:['water','#4f7695']};
// anything else (other tools, renamed types): guess the group from the name
const HXG=[['sand',/coast|beach|shore|dune|desert|oasis/,'#d6bd83'],['farm',/farm|field|orchard/,'#c3a74f'],['hills',/hill|moor|highland|bluff/,'#a2a466'],['heath',/heath/,'#858046'],
  ['bad',/badland|waste|salt|dust|ash|mesa|canyon|crater/,'#a96338'],['marsh',/swamp|marsh|bog|fen|mire|wet/,'#8c8950'],['snow',/glacier|ice|snow|tundra|frozen/,'#b9b3a8'],
  ['forest',/forest|wood|grove|thicket|jungle|taiga|pine/,'#4a3520'],['mount',/peak|mountain|crag|volcan|ridge|cliff/,'#8f7f6c'],
  ['deep',/ocean|abyss|deep|sea/,'#2f516d'],['water',/lake|pond|river|rapid|water|bay|spring/,'#4a7598']];
function hxType(m,t){if(HXT[t]&&!m.colors?.[t])return HXT[t];const g=HXG.find(x=>x[1].test(t));return [g?g[0]:'plain',m.colors?.[t]||(g?g[2]:'#b6b47b')]}
// height: mountains (the rest is flat)
const HX_HGT={'mountain-peak':1,volcano:.9,mountain:.72,crag:.62,'crystal-cavern':.6}; // badlands are flat: per-hex mounds read as polka dots in a field
const HX_TREES=16,HX_FERNS=13,HX_WET=new Set(['water','deep','reef']);
const hxRand=a=>()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}; // mulberry32
const f2=v=>(+v).toFixed(2),f3=v=>(+v).toFixed(3);
const hxRGB=c=>{const n=parseInt(c.slice(1),16);return c.length===4?[(n>>8&15)*17,(n>>4&15)*17,(n&15)*17]:[n>>16&255,n>>8&255,n&255]};
const hxHex=([r,g,b])=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const hxShade=(c,f)=>hxHex(hxRGB(c).map(v=>f<1?v*f:v+(255-v)*(f-1)));
// six wobbly blob outlines: shores and forest edges are organic, not hex-straight
const HX_BLOBS=(()=>{const R=hxRand(7);return Array.from({length:6},()=>{const a=R()*6.3,b=R()*6.3,c=R()*6.3;
  return new Path2D('M'+Array.from({length:36},(_,j)=>{const t=j/36*Math.PI*2,r=1+.08*Math.sin(3*t+a)+.05*Math.sin(5*t+b)+.03*Math.sin(8*t+c);return (Math.cos(t)*r).toFixed(3)+','+(Math.sin(t)*r).toFixed(3)}).join('L')+'Z')})})();
// separable box blur, three passes ≈ gaussian; one channel, w×h
function hxBlur(a,w,h,r){if(r<1)return a;const tmp=new Float32Array(a.length),pass=(src,dst,n,len,stride,step)=>{for(let i=0;i<n;i++){const o=i*stride;let s=0;
    for(let k=-r;k<=r;k++)s+=src[o+Math.min(len-1,Math.max(0,k))*step];
    for(let j=0;j<len;j++){dst[o+j*step]=s/(2*r+1);s+=src[o+Math.min(len-1,j+r+1)*step]-src[o+Math.max(0,j-r)*step]}}};
  for(let p=0;p<3;p++){pass(a,tmp,h,w,w,1);pass(tmp,a,w,h,1,w)}return a}
// value noise, ridged fBm (mountain relief)
const hxN=(ix,iy)=>{let h=Math.imul(ix,374761393)+Math.imul(iy,668265263)|0;h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296};
function hxVN(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),a=hxN(ix,iy),b=hxN(ix+1,iy),c=hxN(ix,iy+1),d=hxN(ix+1,iy+1);return a+(b-a)*sx+(c-a+(a-b-c+d)*sx)*sy}
// broad fBm with a gentle ridge: big lit and shaded planes, a little rock texture on top
function hxRidge(x,y){let s=0,a=.6,f=.45;for(let o=0;o<4;o++){const v=hxVN(x*f+o*17.3,y*f-o*9.1),r=o<2?1-Math.abs(2*v-1):v;s+=a*r;a*=o?.42:.5;f*=2.1}return s}
const sst=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
// sample a Catmull-Rom curve into points (rivers are drawn as tapered pieces)
function hxSample(pts,per=8){if(pts.length<2)return pts;const out=[];for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
  for(let s=0;s<per;s++){const t=s/per,t2=t*t,t3=t2*t;out.push([0,1].map(c=>.5*(2*p1[c]+(-p0[c]+p2[c])*t+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t2+(-p0[c]+3*p1[c]-3*p2[c]+p3[c])*t3)))}}out.push(pts.at(-1));return out}
// ponytail: blocked-edge index i faces 60·(i+1)° (screen angle, y down) on pointy maps, read from a real export; flat maps unverified
const hxEdgeAng=(m,i)=>m.flat?60*i+30:60*(i+1);
const hxEdgeD=(x,y,ang)=>{const a1=(ang-30)*Math.PI/180,a2=(ang+30)*Math.PI/180;return `M${f2(x+Math.cos(a1))},${f2(y+Math.sin(a1))}L${f2(x+Math.cos(a2))},${f2(y+Math.sin(a2))}`};
// the painting in small steps (a generator): hxPaintAsync runs it between frames so opening the map never freezes the page
function hxPaint(m,keys,b){const g=hxPaintSteps(m,keys,b);for(;;){const r=g.next();if(r.done)return r.value}}
// starts after the next frame is on screen (the tab shows first), then ~8 ms slices
function hxPaintAsync(m,keys,b,done,step){const g=hxPaintSteps(m,keys,b);let n=0,go=0;const run=()=>{const t=performance.now();for(;;){const r=g.next();if(r.done)return done(r.value);n++;if(performance.now()-t>8)break}step?.(n);setTimeout(run,0)};
  const kick=()=>{if(!go++)setTimeout(run,0)};requestAnimationFrame(kick);setTimeout(kick,120)} // after the next frame (or soon, if frames are paused)
function* hxPaintSteps(m,keys,b){const [x0,y0,x1,y1]=b,W=x1-x0,H=y1-y0,GL=typeof hxGLOK==='function'&&hxGLOK()&&hxGLInit(), // the context is made here, in the first slice
    // with WebGL these are smooth fields the GPU shades per screen pixel (≤1.2 Mpx); without it, the picture itself (≤2.6 Mpx)
    P=GL?Math.min(12,Math.sqrt(8e5/(W*H)),(HXGL.max||4096)/W,(HXGL.max||4096)/H):Math.min(26,Math.sqrt(2.6e6/(W*H))),cw=Math.ceil(W*P),ch=Math.ceil(H*P),n=cw*ch;
  const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const g=cv.getContext('2d',{willReadFrequently:true});
  const info=keys.map(k=>{const [x,y]=ctr(m,k),h=hxHash(k),[grp,col]=hxType(m,m.t[k]);return {k,x,y,h,t:m.t[k],grp,col}}).sort((a,b)=>a.h-b.h);
  // terrain patches follow the hex outline, as in Hexer; with WebGL the shader bends every border with noise (no wobble here),
  // without it the old wobbly round blobs keep the flat preview organic
  const HEXP=new Path2D('M'+Array.from({length:6},(_,j)=>{const a=(m.flat?60*j:60*j-30)*Math.PI/180;return Math.cos(a).toFixed(4)+','+Math.sin(a).toFixed(4)}).join('L')+'Z');
  const blob=GL?(i,s)=>{g.setTransform(P*s,0,0,P*s,(i.x-x0)*P,(i.y-y0)*P);g.fill(HEXP)}:(i,s)=>{g.setTransform(P*s,0,0,P*s,(i.x-x0)*P,(i.y-y0)*P);g.rotate(i.h%360*Math.PI/180);g.fill(HX_BLOBS[i.h%6])};
  const read=()=>{g.setTransform(1,0,0,1,0,0);const d=g.getImageData(0,0,cw,ch).data,a=new Float32Array(n);for(let j=0;j<n;j++)a[j]=d[j*4]/255;return a};
  const Z=new Float32Array(n);
  yield 67;
  // masks and colour fields are generators too (yield* …): drawing, reading back and blurring are separate slices
  const mask=function*(pick,scale,r,extra=[],draw){if(!extra.length&&!draw&&!info.some(pick))return Z;g.setTransform(1,0,0,1,0,0);g.fillStyle='#000';g.fillRect(0,0,cw,ch);g.fillStyle='#fff';let nb=0;for(const i of info)if(pick(i)){blob(i,typeof scale==='function'?scale(i):scale);if(++nb%300===0)yield 0}for(const i of extra)blob(i,1.3);if(draw)draw();const a=read();yield 0;return hxBlur(a,cw,ch,Math.max(1,Math.round(r*P)))};
  yield 68;
  const rgbField=function*(draw,r){g.setTransform(1,0,0,1,0,0);const dr=draw();if(dr&&dr.next)yield* dr;g.setTransform(1,0,0,1,0,0);const d=g.getImageData(0,0,cw,ch).data,out=[];yield 0;
    for(let k=0;k<3;k++){const a=new Float32Array(n);for(let j=0;j<n;j++)a[j]=d[j*4+k];out.push(hxBlur(a,cw,ch,Math.max(1,Math.round(r*P))));yield 0}return out};
  yield 69;
  const poiK=new Set((m.pois||[]).map(p=>p.k)),wet=i=>HX_WET.has(i.grp),wood=i=>i.grp==='forest'&&!poiK.has(i.k),clear=i=>i.grp==='forest'&&poiK.has(i.k);
  // 1. land colour, soft between hexes; water hexes get the colour of the land around them (shores never blend into blue)
  yield 71;
  const land=yield* rgbField(function*(){g.fillStyle='#a8a46b';g.fillRect(0,0,cw,ch);let nb=0;for(const i of info)if(!wet(i)){g.fillStyle=wood(i)?'#8f9455':i.col;blob(i,1.9);if(++nb%250===0)yield 0}
    for(const i of info)if(!wet(i)){g.fillStyle=clear(i)?'#5f8d3c':wood(i)?'#8f9455':i.col;blob(i,1.0);if(++nb%300===0)yield 0}
    for(const i of info)if(i.t==='hill'){g.fillStyle='#9ca062';blob(i,.62)}
    for(const i of info)if(i.grp==='bad'){const r=hxRand(i.h^31),a=r()*6.283,d=.12+r()*.18;g.fillStyle=hxShade(i.col,.84);blob({...i,x:i.x+Math.cos(a)*d,y:i.y+Math.sin(a)*d},.3+r()*.22)}},.11); // off-centre hollows, so a badland field is no polka-dot grid
  // 2. height field (max of per-hex heights, blurred) with ridged noise in the mountains → hillshade
  yield 76;
  g.setTransform(1,0,0,1,0,0);g.fillStyle='#000';g.fillRect(0,0,cw,ch);g.globalCompositeOperation='lighten';
  yield 77;
  for(const i of info){const v=HX_HGT[i.t];if(!v)continue;const c=Math.round(v*255);g.fillStyle=`rgb(${c},${c},${c})`;blob(i,i.grp==='mount'?1.1:.85)}
  yield 78;
  g.globalCompositeOperation='source-over';const hgt=info.some(i=>HX_HGT[i.t])?hxBlur(read(),cw,ch,Math.round(.85*P)):Z;
  yield 79;
  const sandM=yield* mask(i=>i.grp==='sand'&&i.t!=='oasis',1,.12);yield 0;const snowM=yield* mask(i=>i.t==='tundra'||i.grp==='snow'&&!/glacier|frozen/.test(i.t),1,.12);
  yield 80;
  // peaks soft: their snow follows the relief, not the hex outline; core: how deep inside a range a point lies
  const peak=yield* mask(i=>i.t==='mountain-peak'||i.t==='glacier',1.02,.4);yield 0;const mtn=yield* mask(i=>i.grp==='mount',1.02,.25);yield 0;
  const core=info.some(i=>i.grp==='mount')?yield* mask(i=>i.grp==='mount',1.02,1.1):Z;yield 0;const crg=yield* mask(i=>i.t==='crag',1,.18);yield 0;const hil=(()=>{if(!info.some(i=>i.t==='hill'))return Z;g.setTransform(1,0,0,1,0,0);g.fillStyle='#000';g.fillRect(0,0,cw,ch);g.globalCompositeOperation='lighten';
    for(const i of info)if(i.t==='hill'){const x=(i.x-x0)*P,y=(i.y-y0)*P,R=1.02*P,gr=g.createRadialGradient(x,y,0,x,y,R);gr.addColorStop(0,'#fff');gr.addColorStop(.25,'#f5f5f5');gr.addColorStop(.5,'#d1d1d1');gr.addColorStop(.75,'#808080');gr.addColorStop(1,'#000');/* a round dome sloped over the whole hex */g.fillStyle=gr;g.beginPath();g.arc(x,y,R,0,6.283);g.fill()}
    g.globalCompositeOperation='source-over';return hxBlur(read(),cw,ch,Math.max(1,Math.round(.05*P)))})();yield 0;const badm=yield* mask(i=>i.grp==='bad',.75,.15);
  yield 83;
  // mountains rise towards the middle of a range and are cut by ridged noise into crests and valleys, so a big range reads as
  // relief (as in Hexer), not as a flat grey pool; a lone mountain stays about as high as before
  const Hf=new Float32Array(n);for(let j=0;j<n;j++){const v=hgt[j];if(v<.005)continue;const x=x0+(j%cw)/P,y=y0+(j/cw|0)/P,m=mtn[j];
    Hf[j]=v*(1-m+m*(.75+.55*core[j])*(.5+.8*Math.min(1,hxRidge(x*1.05+3.1,y*1.05-1.7))))+.18*peak[j]*m}
  yield 84;
  const Hs=info.some(i=>i.grp==='mount')?hxBlur(Float32Array.from(Hf),cw,ch,Math.round(.3*P)):Z; // smooth slope direction for the brush streaks
  // 3. water: wavy shore, shelf bands near land, deep colour in the open
  yield 86;
  const ghosts=[];for(const i of info)if(wet(i))for(const nb of nbs(m,i.k))if(!m.t[nb.k]){const [x,y]=ctr(m,nb.k);ghosts.push({x,y,h:hxHash(nb.k)})}
  yield 87;
  const wraw=yield* mask(wet,1.07,.1,ghosts),dist=new Float32Array(n);
  // chamfer distance (in hex radii) from the nearest land pixel
  yield 89;
  if(info.some(wet)){const BIG=1e9;for(let j=0;j<n;j++)dist[j]=wraw[j]<.5?0:BIG;const D=1.4142;yield 0;
    for(let y=0;y<ch;y++){if(y%120===119)yield 0;for(let x=0;x<cw;x++){const j=y*cw+x;let v=dist[j];if(!v)continue;if(x)v=Math.min(v,dist[j-1]+1);if(y){v=Math.min(v,dist[j-cw]+1);if(x)v=Math.min(v,dist[j-cw-1]+D);if(x<cw-1)v=Math.min(v,dist[j-cw+1]+D)}dist[j]=v}}
    for(let y=ch-1;y>=0;y--){if(y%120===0)yield 0;for(let x=cw-1;x>=0;x--){const j=y*cw+x;let v=dist[j];if(!v)continue;if(x<cw-1)v=Math.min(v,dist[j+1]+1);if(y<ch-1){v=Math.min(v,dist[j+cw]+1);if(x<cw-1)v=Math.min(v,dist[j+cw+1]+D);if(x)v=Math.min(v,dist[j+cw-1]+D)}dist[j]=v}}
    for(let j=0;j<n;j++)dist[j]/=P}
  yield 93;
  const anyWet=info.some(wet),wcol=!anyWet?[Z,Z,Z]:yield* rgbField(function*(){g.fillStyle='#2f516d';g.fillRect(0,0,cw,ch);let nb=0;for(const i of info)if(wet(i)){g.fillStyle=i.col;blob(i,1.6);if(++nb%250===0)yield 0}for(const i of info)if(i.grp==='reef'){g.fillStyle=i.col;blob(i,1.05)}},.45);
  // 4. forests: floor with a crisp organic edge, green halo around it
  yield 95;
  const poiM=(()=>{const ps=(m.pois||[]).filter(p=>m.t[p.k]&&HXT[m.t[p.k]]?.[0]==='forest');if(!ps.length)return Z;g.setTransform(1,0,0,1,0,0);g.fillStyle='#000';g.fillRect(0,0,cw,ch);g.fillStyle='#fff';
    for(const p of ps){const [x,y]=ctr(m,p.k);g.beginPath();g.arc((x-x0)*P,(y-y0)*P,.42*P,0,6.283);g.fill()}return hxBlur(read(),cw,ch,Math.round(.12*P))})();
  yield 97;
  const fraw=yield* mask(wood,1.02,.06);yield 0;const halo=yield* mask(i=>wood(i)||clear(i),1.3,.17);yield 0;const fcol=info.some(wood)?yield* rgbField(function*(){g.fillStyle='#4a3420';g.fillRect(0,0,cw,ch);let nb=0;for(const i of info)if(wood(i)){g.fillStyle=i.col;blob(i,1.5);if(++nb%250===0)yield 0}},.35):[Z,Z,Z];
  // 5. farmland patchwork (Voronoi fields with darker seams)
  yield 99;
  const farm=yield* mask(i=>i.grp==='farm',1.06,.04),FS=.95,seed=(cx,cy)=>{const r=hxRand(Math.imul(cx,73856093)^Math.imul(cy,19349663));return [(cx+.15+r()*.7)*FS,(cy+.15+r()*.7)*FS,r()]};
  yield 100;
  const FT=[[204,172,78],[190,160,68],[212,184,94],[180,156,70],[196,176,98],[170,158,84]];
  yield 101;
  const CS=.8,cell=(x,y)=>{x+=(hxVN(x*5,y*5)-.5)*.12;y+=(hxVN(x*5+9,y*5)-.5)*.12;const gx=Math.floor(x/CS),gy=Math.floor(y/CS);let d1=9,d2=9,c1=0;for(let a=-1;a<=1;a++)for(let q=-1;q<=1;q++){const r=hxRand(Math.imul(gx+a,92837111)^Math.imul(gy+q,689287499)),sx=(gx+a+r())*CS,sy=(gy+q+r())*CS,dd=Math.hypot(sx-x,sy-y);if(dd<d1){d2=d1;d1=dd;c1=r()}else if(dd<d2)d2=dd}return [d1,d2,c1]};
  // rivers: signed distance to the river line minus its half width (hex radii); the GPU unions it with the lakes and seas
  // rivers and roads as signed distance fields (distance to the line minus its half width, hex radii): the GPU merges rivers
  // with lakes and seas and lays roads over the ground with rough edges
  yield 105;
  const sdLine=(F,s,h0,h1)=>{let Lr=0;const cl=[0];for(let k=1;k<s.length;k++)cl.push(Lr+=Math.hypot(s[k][0]-s[k-1][0],s[k][1]-s[k-1][1]));
    for(let k=0;k<s.length-1;k++){const [ax,ay]=s[k],[bx,by]=s[k+1],ha=h0+(h1-h0)*cl[k]/(Lr||1),hb=h0+(h1-h0)*cl[k+1]/(Lr||1),dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy||1e-9,M=.45;
      const i0=Math.max(0,Math.floor((Math.min(ax,bx)-M-x0)*P)),i1=Math.min(cw-1,Math.ceil((Math.max(ax,bx)+M-x0)*P)),j0=Math.max(0,Math.floor((Math.min(ay,by)-M-y0)*P)),j1=Math.min(ch-1,Math.ceil((Math.max(ay,by)+M-y0)*P));
      for(let yy=j0;yy<=j1;yy++)for(let xx=i0;xx<=i1;xx++){const px=x0+(xx+.5)/P,py=y0+(yy+.5)/P,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/l2)),v=Math.hypot(ax+t*dx-px,ay+t*dy-py)-(ha+(hb-ha)*t),j=yy*cw+xx;if(v<F[j])F[j]=v}}};
  yield 109;
  const RS=new Float32Array(n).fill(.5),RP=new Float32Array(n).fill(.5),RT=new Float32Array(n).fill(.5),rivS=[],roadS=[];
  // deltas: each delta hex drains by one winding channel towards the nearest open water (a branching network), as in Hexer
  yield 111;
  const RC=new Float32Array(n).fill(.5),dD={},isW=k=>m.t[k]&&HX_WET.has(hxType(m,m.t[k])[0]);let fr=info.filter(i=>i.t==='delta'&&nbs(m,i.k).some(nb=>isW(nb.k)));
  yield 112;
  for(const i of fr)dD[i.k]=0;for(let d=1;fr.length;d++){const nx=[];for(const i of fr)for(const nb of nbs(m,i.k))if(m.t[nb.k]==='delta'&&dD[nb.k]===undefined){dD[nb.k]=d;nx.push(info.find(j=>j.k===nb.k))}fr=nx}
  yield 113;
  for(const i of info){if(i.t!=='delta'||dD[i.k]===undefined)continue;const r=hxRand(i.h^0xd17a);
    const to=nbs(m,i.k).map(nb=>nb.k).filter(k=>isW(k)||dD[k]<dD[i.k]).sort((a,b)=>(isW(a)?-1:dD[a])-(isW(b)?-1:dD[b])||hxHash(a)-hxHash(b))[0];if(!to)continue;
    const [nx,ny]=ctr(m,to),mx=(i.x+nx)/2+(r()-.5)*.5,my=(i.y+ny)/2+(r()-.5)*.5,w0=.08+.03*Math.min(3,dD[i.k])/3,w1=.12+r()*.03;
    sdLine(RC,Array.from({length:9},(_,k)=>{const t2=k/8,a=(1-t2)**2,b2=2*t2*(1-t2),c=t2*t2;return [a*i.x+b2*mx+c*nx,a*i.y+b2*my+c*ny]}),Math.min(w0,w1),w1)}
  yield 117;
  for(const p of m.paths||[]){if(p.pts.length<2)continue;const s=hxSample(p.pts,10);
    if(p.type==='water'){rivS.push(s);sdLine(RS,s,.085,.115)}else if(HX_ROAD.test(p.type)){roadS.push(s);/primary|road/.test(p.type)?sdLine(RP,s,.1,.1):sdLine(RT,s,.105,.105)}}
  yield 119;
  let img='';
  yield 120;
  if(GL){// pack the fields into eight RGBA textures for hexgl.js (slopes as hex radii per hex radius, ±4)
    const grad=a=>{const gx=new Float32Array(n),gy=new Float32Array(n);if(a===Z)return [Z,Z];for(let yy=0;yy<ch;yy++)for(let xx=0;xx<cw;xx++){const j=yy*cw+xx;gx[j]=(a[xx<cw-1?j+1:j]-a[xx?j-1:j])*P/2;gy[j]=(a[yy<ch-1?j+cw:j]-a[yy?j-cw:j])*P/2}return [gx,gy]};
    const pk=(...cs)=>{const o=new Uint8Array(n*4);cs.forEach(([a,sc=1,of=0],k)=>{for(let j=0;j<n;j++){const v=(a[j]*sc+of)*255;o[j*4+k]=v<0?0:v>255?255:v+.5}});return o};
    const C=1/255,G=1/8,[hgx,hgy]=grad(Hf),[sgx,sgy]=grad(Hs),[igx,igy]=grad(hil);
    const ks=keys.map(k=>k.split(',').map(Number)),q0=Math.min(...ks.map(v=>v[0])),r0=Math.min(...ks.map(v=>v[1])),nq=Math.max(...ks.map(v=>v[0]))-q0+1,nr=Math.max(...ks.map(v=>v[1]))-r0+1,hd=new Uint8Array(nq*nr*4);
    for(const i of info){const [q,r]=i.k.split(',').map(Number),j=((r-r0)*nq+q-q0)*4;hd[j]=255;hd[j+1]=i.grp==='reef'?1:i.grp==='deep'?2:i.grp==='water'?3:i.t==='jungle'?6:i.t==='dense-forest'?5:i.t==='mushroom-forest'?7:i.grp==='forest'?4:i.t==='oasis'?8:i.grp==='sav'?14:i.t==='delta'?16:i.grp==='marsh'?15:i.grp==='heath'?13:i.grp==='hills'?12:/meadow|glade/.test(i.t)?11:i.grp==='plain'?10:0}
    const tex=[];for(const f of [()=>pk([land[0],C],[land[1],C],[land[2],C],[farm]),()=>pk([wcol[0],C],[wcol[1],C],[wcol[2],C],[wraw]),()=>pk([fcol[0],C],[fcol[1],C],[fcol[2],C],[fraw]),()=>pk([mtn],[crg],[badm],[halo]),
      ()=>pk([sandM],[snowM],[poiM],[hil]),()=>pk([Hf,.8],[hgx,G,.5],[hgy,G,.5],[dist,1/3]),()=>pk([sgx,G,.5],[sgy,G,.5],[igx,G,.5],[igy,G,.5]),()=>pk([RS,1.25,.375],[RP,1.25,.375],[RT,1.25,.375],[RC,1.25,.375]),()=>pk([peak],[Z],[Z],[Z])]){tex.push(f());yield 0} // packed now, uploaded by hxGLUpload once the shader is ready
    HXGL.maps.set(m.t,{x0,y0,P,cw,ch,flat:!!m.flat,hex:{q0,r0,nq,nr,data:hd},data:tex,up:0})}
  else{// no WebGL 2: a flat preview (land colours, water, rivers), no relief
    const out=new Uint8ClampedArray(n*4);for(let j=0;j<n;j++){const wa=Math.max(sst(.4,.6,wraw[j]),RS[j]<0?1:0),fa=sst(.4,.56,fraw[j])*(1-poiM[j]);
      for(let k=0;k<3;k++){let v=land[k][j];v+=(fcol[k][j]-v)*fa;v+=((RS[j]<0&&wraw[j]<.5?[122,150,155][k]:wcol[k][j])-v)*wa;out[j*4+k]=v}out[j*4+3]=255}
    g.setTransform(1,0,0,1,0,0);g.putImageData(new ImageData(out,cw,ch),0,0);
    img=`<image href="${cv.toDataURL('image/jpeg',.9)}" x="${f2(x0)}" y="${f2(y0)}" width="${f2(cw/P)}" height="${f2(ch/P)}" preserveAspectRatio="none"/>`}
  yield 134;
  const pick=(a,x,y)=>{const i=Math.round((y-y0)*P),j=Math.round((x-x0)*P);return i<0||j<0||i>=ch||j>=cw?0:a[i*cw+j]};
  yield 135;
  const onLand=(x,y)=>pick(wraw,x,y)<.35&&pick(fraw,x,y)<.3&&pick(mtn,x,y)<.5;
  // 6. rivers are water now (painted by the GPU from RS); their lines still keep trees and marks off the banks
  yield 137;
  const lanes=[];for(const s0 of rivS)for(let k=1;k<s0.length;k++)lanes.push([...s0[k-1],...s0[k],.2]);
  // 7. roads are painted by the GPU too (RP, RT); their lines keep trees and marks off them
  yield 139;
  for(const s0 of roadS)for(let k=1;k<s0.length;k++)lanes.push([...s0[k-1],...s0[k],.27]);
  yield 140;
  const nearLane=(x,y,s)=>lanes.some(([ax,ay,bx,by,d0])=>{const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l)),d=d0+s*.3;return (ax+t*dx-x)**2+(ay+t*dy-y)**2<d*d});
  // 8. marks, as sparse as Hexer's, kept off rivers and roads: a few grass tufts, meadow flowers, savanna tussocks, reeds; sand, badlands, snow and reefs are texture (above)
  // ponytail: with WebGL the GPU scatters these marks itself (hexgl.js); this vector copy only serves the flat preview
  yield 143;
  const mk={},add=(col,w,d,op=.85)=>{(mk[col+'|'+w+'|'+op]??=[]).push(d)},dot=(x,y,r)=>`M${f3(x-r)},${f3(y)}a${f3(r)},${f3(r)} 0 1 0 ${f3(2*r)},0a${f3(r)},${f3(r)} 0 1 0 ${f3(-2*r)},0`;
  yield 144;
  const tuft=(x,y,s)=>`M${f3(x-.035*s)},${f3(y)}l${f3(-.025*s)},${f3(-.07*s)}M${f3(x)},${f3(y)}l0,${f3(-.09*s)}M${f3(x+.035*s)},${f3(y)}l${f3(.025*s)},${f3(-.07*s)}`;
  yield 145;
  const clump=(x,y)=>dot(x-.024,y-.014,.02)+dot(x+.024,y-.014,.02)+dot(x,y+.019,.021); // savanna tussock: three tiny blobs
  yield 146;
  if(!GL)for(const i of info){if(wet(i)||wood(i)||i.grp==='mount')continue;const r=hxRand(i.h^0x9e37),pt=()=>{const a=r()*6.283,d=Math.sqrt(r())*.82;return [i.x+Math.cos(a)*d,i.y+Math.sin(a)*d]};
    const dark=hxShade(i.col,.62),grp=i.grp,each=(cnt,f)=>{for(let c=0;c<cnt;c++){const [x,y]=pt();if(onLand(x,y)&&!nearLane(x,y,0))f(x,y)}};
    if(grp==='plain'||grp==='hills'||grp==='heath'){const fl=/meadow|glade/.test(i.t);each(grp==='hills'?1:fl?3:2,(x,y)=>add(dark,.024,tuft(x,y,1+r()*.4),.75));
      if(fl)each(2,(x,y)=>{const c=r()<.6?'#b4cfe0':'#eee8d6';for(let k=0;k<4;k++)add(c,0,dot(x+(r()-.5)*.11,y+(r()-.5)*.09,.017),.9)})}
    else if(grp==='sav')each(30,(x,y)=>add(hxShade(i.col,.62),0,clump(x,y),.75));
    else if(grp==='marsh'){each(i.t==='delta'?1:5,(x,y)=>{const rx=.04+r()*.08,ry=rx*(.55+r()*.25),e=`M${f3(x-rx)},${f3(y)}a${f3(rx)},${f3(ry)} 0 1 0 ${f3(2*rx)},0a${f3(rx)},${f3(ry)} 0 1 0 ${f3(-2*rx)},0`;add('#5b5a36',0,e,.8);add('#36351f',.016,e,.7)}); // dark puddles with a rim
      each(3,(x,y)=>add('#3d4a2c',.024,tuft(x,y,1.2),.75));each(6,(x,y)=>add('#45442a',0,dot(x,y,.012),.7))}
    else if(i.t==='oasis'&&!GL){ // with WebGL the pool and palm are painted by hexgl.js
      const rr=hxRand(i.h^77),ph=rr()*6.283,pool=q0=>{let d='';for(let k=0;k<48;k++){const a=k/48*6.283,q=q0*(1+.07*Math.sin(3*a+ph)+.04*Math.sin(5*a+ph*1.7));d+=(k?'L':'M')+f3(i.x+Math.cos(a)*q)+','+f3(i.y+Math.sin(a)*q/1.12)}return d+'Z'};
      add('#7a9c4e',0,pool(.35),1);add('#5a7ea6',0,pool(.31),1)}} // the same smooth pool as the GPU one, without the palm
  yield 156;
  if(!GL)for(const i of info)if(i.grp==='reef'){const r=hxRand(i.h^5);for(let c=0;c<3;c++){const a=r()*6.283,d=Math.sqrt(r())*.7,x=i.x+Math.cos(a)*d,y=i.y+Math.sin(a)*d,l=.25+r()*.25;add('#eef3f0',.016,`M${f3(x-l)},${f3(y)}q${f3(l)},${f3(-.12)} ${f3(2*l)},0`,.55)}}
  yield 157;
  let marks='';for(const [key,ds] of Object.entries(mk)){const [col,w,op]=key.split('|');marks+=+w?`<path d="${ds.join('')}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`:`<path d="${ds.join('')}" fill="${col}" opacity="${op}"/>`}
  // 9. tree crowns and oasis palms are painted by the GPU (hexgl.js)
  yield 159;
  let trees='';
  // 10. region borders in the region's colour, blocked edges as dark red walls
  yield 161;
  // (region borders and walls are live SVG in the map's overlay: hxLines, below — the editor changes them without a repaint)
  yield 164;
  yield 165;
  const cid='hc'+hxHash(keys.join(';')).toString(36);
  yield 166;
  // with WebGL the SVG keeps nothing: no clip path, no grid, no marks (huge paths that made zooming re-raster in tiles)
  if(GL)return '';
  return `<defs><clipPath id="${cid}"><path d="${hxPathD(m,keys,1.002)}"/></clipPath></defs><g clip-path="url(#${cid})">${img}<g class="mk">${marks}</g>
   <g class="spr">${trees}</g></g><path class="grid" d="${hxPathD(m,keys)}"/>`}
// region borders in the region's colour, blocked edges as dark red walls; drawn by hxSVG with every render (cheap: edges only)
function hxLines(m){let regb='';for(const rg of m.regs||[]){if(!rg.ks?.length)continue;const set=new Set(rg.ks);let d='';
    for(const k of rg.ks){if(!m.t[k])continue;const [x,y]=ctr(m,k);for(const nb of nbs(m,k))if(!set.has(nb.k)&&m.t[nb.k])d+=hxEdgeD(x,y,360-Math.round(nb.ang/60)*60)}
    if(d)regb+=`<path class="regb" d="${d}" stroke="${/^#[0-9a-f]{3,8}$/i.test(rg.color||'')?rg.color:'#8b4a3d'}"/>`}
  let walls='';for(const [k,es] of Object.entries(m.blk||{})){if(!m.t[k])continue;const [x,y]=ctr(m,k);for(const e of es)walls+=hxEdgeD(x,y,hxEdgeAng(m,e))}
  return regb+(walls?`<path class="wall" d="${walls}"/>`:'')}
