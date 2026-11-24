'use strict';
/* CROW NEST — crow portraits (owner, 2026-11-20; QA/2026-11-20-seats.md, round 2).
   A crow carries only `pic`: a short hash. The image itself lives in PICS (hash → JPEG data URL, device storage ctk-pics), so the
   Journal (crow snapshots before/after), the local backups (syncbak) and every crow comparison at the table stay small.
   At the table a snapshot carries `pics` only for hashes this device has not sent since its connections opened (syncOut,
   picsForSend); a receiver keeps what it gets (picsIn). An export file carries its crow's picture.
   Input: an image/* file (never SVG), re-encoded through a canvas: cropped square (drag and zoom), 256 × 256 JPEG, at most
   PIC_MAX characters as a data URL (the quality steps down, then the size). Anything else is refused.
   Loads before app.js: functions only (the actions are wired on DOMContentLoaded). */
const PIC_MAX=40000,PIC_PX=256,PIC_RE=/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
const PICS=(()=>{try{const o=JSON.parse(localStorage.getItem('ctk-pics')||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch{return {}}})();
const picHash=d=>{let h=2166136261;for(let i=0;i<d.length;i++)h=Math.imul(h^d.charCodeAt(i),16777619);return 'p'+(h>>>0).toString(36)+d.length.toString(36)};
const picOk=(h,d)=>typeof h==='string'&&typeof d==='string'&&d.length<=PIC_MAX&&PIC_RE.test(d)&&picHash(d)===h;
// keep what a crow here or the Journal still names; the rest goes
function picsSave(){const keep=new Set([...PARTY.map(c=>c.pic),typeof S!=='undefined'&&S.b?.pic].filter(Boolean)),j=typeof JOURNAL!=='undefined'?JSON.stringify(JOURNAL):'';
  for(const h of Object.keys(PICS))if(!keep.has(h)&&!j.includes(h))delete PICS[h];
  try{store.set('pics',JSON.stringify(PICS))}catch{}}
const picOf=c=>c&&c.pic&&PICS[c.pic]&&PIC_RE.test(PICS[c.pic])?PICS[c.pic]:'';
// a crow's disc: its portrait, or its initial; state = '', 'dead', 'frozen', 'away' (greyed)
function crowAv(c,size=48,state=''){const p=picOf(c),n=String(c?.name||'?').trim(),ini=esc((n[0]||'?').toUpperCase());
  // the initial is drawn by CSS (data-i), so a name next to the disc reads the same to a screen reader and to textContent
  return `<span class="cav${state?' '+state:''}${p?' pic':''}" style="--av:${size}px" aria-hidden="true"${p?'':` data-i="${ini}"`}>${p?`<img src="${p}" alt="" width="${size}" height="${size}" decoding="async">`:''}</span>`}
// the table: pictures this device has sent since its connections opened
const PICS_SENT=new Set();
function picsForSend(all){const out={};for(const c of PARTY){const h=c.pic;if(h&&PICS[h]&&(all||!PICS_SENT.has(h))){out[h]=PICS[h];if(!all)PICS_SENT.add(h)}}return out}
function picsIn(o){if(!o||typeof o!=='object')return;let n=0;for(const [h,d] of Object.entries(o))if(!PICS[h]&&picOk(h,d)){PICS[h]=d;n++}if(n)try{store.set('pics',JSON.stringify(PICS))}catch{}} // no clean-up here: the crow naming it may arrive in the same message

/* ---------- picking and cropping ---------- */
function picRead(file,done){if(!file)return;if(!/^image\//.test(file.type||'')||/svg/i.test(file.type)||/\.svg$/i.test(file.name||''))return toast('That isn’t a photo or a picture: choose a JPEG, PNG, WebP or HEIC image.');
  if(file.size>25*1024*1024)return toast('That image is too big (over 25 MB).');
  const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{picCrop(img,d=>{URL.revokeObjectURL(url);done(d)},()=>URL.revokeObjectURL(url))};img.onerror=()=>{URL.revokeObjectURL(url);toast('That image could not be read.')};img.src=url}
// the square that goes into the portrait, from the crop state: zoom z ≥ 1 (1 = the whole short side), centre (cx, cy) in image pixels
function picRect(img,st){const s=Math.min(img.naturalWidth,img.naturalHeight)/st.z,h=s/2;st.cx=Math.max(h,Math.min(img.naturalWidth-h,st.cx));st.cy=Math.max(h,Math.min(img.naturalHeight-h,st.cy));return [st.cx-h,st.cy-h,s]}
function picEncode(img,st){const [x,y,s]=picRect(img,st);let px=PIC_PX,d='';
  for(const q of [.86,.78,.7,.6,.5,.42])for(const p of [px]){const cv=document.createElement('canvas');cv.width=cv.height=p;const g=cv.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,x,y,s,s,0,0,p,p);d=cv.toDataURL('image/jpeg',q);if(d.length<=PIC_MAX)return d}
  for(px=192;px>=96;px-=32){const cv=document.createElement('canvas');cv.width=cv.height=px;cv.getContext('2d').drawImage(img,x,y,s,s,0,0,px,px);d=cv.toDataURL('image/jpeg',.6);if(d.length<=PIC_MAX)return d}
  return ''}
function picCrop(img,ok,gone){const dl=$('#dlg'),st={z:1,cx:img.naturalWidth/2,cy:img.naturalHeight/2},V=280;dl.dataset.k='piccrop';
  dl.innerHTML=`<form method="dialog" class="cpd piccrop"><h2>Portrait</h2><p>Drag to move, zoom to fit the face. It is saved square and small.</p>
    <canvas id="pic-cv" width="${V*2}" height="${V*2}" style="width:${V}px;height:${V}px" tabindex="0" aria-label="Portrait crop: arrow keys move, + and − zoom"></canvas>
    <label class="cpf"><span>Zoom</span><input type="range" id="pic-z" min="1" max="4" step="0.05" value="1"></label>
    <div class="row"><button type="button" class="btn ghost" data-pc="no">Cancel</button><button type="button" class="btn primary" data-pc="ok">Use this portrait</button></div></form>`;
  const cv=$('#pic-cv'),g=cv.getContext('2d'),draw=()=>{const [x,y,s]=picRect(img,st);g.clearRect(0,0,cv.width,cv.height);g.drawImage(img,x,y,s,s,0,0,cv.width,cv.height);
    g.save();g.fillStyle='rgba(0,0,0,.45)';g.beginPath();g.rect(0,0,cv.width,cv.height);g.arc(cv.width/2,cv.height/2,cv.width/2-2,0,Math.PI*2,true);g.fill('evenodd');g.restore()};
  let drag=null;cv.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,cx:st.cx,cy:st.cy};cv.setPointerCapture(e.pointerId)};
  cv.onpointermove=e=>{if(!drag)return;const k=Math.min(img.naturalWidth,img.naturalHeight)/st.z/V;st.cx=drag.cx-(e.clientX-drag.x)*k;st.cy=drag.cy-(e.clientY-drag.y)*k;draw()};
  cv.onpointerup=cv.onpointercancel=()=>{drag=null};
  cv.onwheel=e=>{e.preventDefault();st.z=Math.max(1,Math.min(4,st.z*(e.deltaY<0?1.08:1/1.08)));$('#pic-z').value=st.z;draw()};
  cv.onkeydown=e=>{const k=Math.min(img.naturalWidth,img.naturalHeight)/st.z/20,m={ArrowLeft:[-k,0],ArrowRight:[k,0],ArrowUp:[0,-k],ArrowDown:[0,k]}[e.key];
    if(m){e.preventDefault();st.cx+=m[0];st.cy+=m[1];draw()}else if(e.key==='+'||e.key==='='||e.key==='-'){e.preventDefault();st.z=Math.max(1,Math.min(4,st.z*(e.key==='-'?1/1.1:1.1)));$('#pic-z').value=st.z;draw()}};
  $('#pic-z').oninput=e=>{st.z=+e.target.value;draw()};
  dl.onclose=()=>{dl.dataset.k='';gone()};dl.onsubmit=null;
  dl.onclick=e=>{const b=e.target.closest('[data-pc]');if(!b)return;if(b.dataset.pc==='ok'){const d=picEncode(img,st);dl.close();if(!d)return toast('That image could not be made small enough.');ok(d)}else dl.close()};
  draw();if(!dl.open)dl.showModal();cv.focus()}
// a portrait for the crow being built or edited (S.b.pic)
function picSet(d){const h=picHash(d);PICS[h]=d;if(S.b)S.b.pic=h;picsSave();render();toast(`Portrait ready: ${Math.round(d.length/1024)} KB`)}
const picFieldHTML=B=>{const c={name:B.name||'?',pic:B.pic};
  return `<div class="picf">${crowAv(c,96)}<div class="picf-a"><b>Portrait</b><span class="muted small">${B.pic?'Saved small and square with the crow.':'Optional: a photo or a drawing. Without one, the crow shows its initial.'}</span>
    <div class="row"><label class="btn sm picfile">${nest(B.pic?'Replace':'Add a portrait')}<input type="file" class="pic-in" accept="image/*" aria-label="${B.pic?'Replace the portrait':'Add a portrait'}"></label>${B.pic?'<button type="button" class="btn sm ghost" data-action="pic-del">Remove</button>':''}</div></div></div>`};
addEventListener('DOMContentLoaded',()=>{Object.assign(A,{'pic-del':()=>{if(S.b){S.b.pic='';render()}}})});
document.addEventListener('change',e=>{if(!e.target.classList?.contains('pic-in'))return;const f=e.target.files[0];e.target.value='';picRead(f,picSet)});
