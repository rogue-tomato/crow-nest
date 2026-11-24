'use strict';
/* CROW NEST — “Back to top” (owner, 2026-11-21): a small button at the bottom right, above the status line, once a long page
   (Rules, the Sheet, the Look up lists) has scrolled about one screen. It takes the window back to the top and puts the keyboard at
   the start of the page. Local UI only: nothing here enters a snapshot or a save. Styles: builder.css (.totop). Loads after app.js. */
(()=>{const b=document.createElement('button');b.type='button';b.id='totop';b.className='totop';b.hidden=true;b.title='Back to top';b.setAttribute('aria-label','Back to top');
  b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14"/><path d="M12 20V8"/><path d="m6 14 6-6 6 6"/></svg>'; // ⤒: a bar, an arrow up to it; the name is the label
  document.body.append(b);
  let on=false;const upd=()=>{const v=scrollY>innerHeight*.9;if(v===on)return;on=v;b.hidden=!v;document.body.classList.toggle('totop-on',v)};
  addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd);
  b.addEventListener('click',()=>{scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    const m=document.getElementById('main');if(m){if(!m.hasAttribute('tabindex'))m.setAttribute('tabindex','-1');m.focus({preventScroll:true})}})})();
