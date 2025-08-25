import { startTraining } from './pose.js'; import { sendMetric } from './base44.js';
const $app=document.getElementById('app');
const store={ get(){ try{return JSON.parse(localStorage.getItem('guardai'))||{};}catch(e){return {};} }, set(d){ localStorage.setItem('guardai', JSON.stringify(d)); } };
function mount(html){ $app.innerHTML=html; }
function progressBar(p){ return `<div class="progressbar"><i style="width:${Math.max(0,Math.min(100,p))}%"></i></div>`; }
function route(){ const h=location.hash||'#/onboarding'; if(h.startsWith('#/onboarding')) return renderOnboarding(); if(h.startsWith('#/train')) return renderTrain(); if(h.startsWith('#/progress')) return renderProgress(); if(h.startsWith('#/badges')) return renderBadges(); return renderOnboarding(); }
function renderOnboarding(){ const d=store.get(); mount(`<section class="card section"><h2>ברוך הבא ל‑GuardAI</h2><p class="small">ענה על 3 שאלות קצרות כדי שנבנה לך תכנית התחלה מותאמת.</p>
<div class="grid grid-3"><button class="btn" data-goal="confidence">ביטחון</button><button class="btn" data-goal="safety">בטיחות</button><button class="btn" data-goal="fitness">כושר</button></div>
<div><p class="small">הרמה שלך?</p><div class="grid grid-2"><button class="btn" data-level="beginner">מתחיל</button><button class="btn" data-level="intermediate">מנוסה</button></div></div>
<div class="row justify-between"><span class="badge">תכנית: ${d.level||'—'} / ${d.goal||'—'}</span><button class="btn primary" id="start">התחל אימון</button></div></section>`);
  const set=(k,v)=>{ const x=store.get(); x[k]=v; store.set(x); route(); };
  $app.querySelectorAll('[data-goal]').forEach(b=>b.onclick=()=>set('goal',b.dataset.goal));
  $app.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>set('level',b.dataset.level));
  $app.querySelector('#start').onclick=()=>{ location.hash='#/train'; };
}
function renderTrain(){ mount(`<section class="card section"><h2>אימון: הרם הגנה ושמור על סנטר נמוך</h2>
<div class="video-wrap" id="vw"><video playsinline muted></video><canvas></canvas></div>
<div class="tips" id="tips"></div><div class="row justify-between"><div class="badge" id="stat">התקדמות: 0%</div>
<div class="row" style="gap:8px"><button class="btn ghost" id="pause">הפסק</button><button class="btn warn" id="end">סיום</button></div></div>${progressBar(0)}<p class="small">* מומלץ תאורה טובה ומרחק של ~2 מ׳ מהמצלמה.</p></section>`);
  const $wrap=document.getElementById('vw'), $tips=document.getElementById('tips'), $stat=document.getElementById('stat'), $pb=$app.querySelector('.progressbar > i');
  let goodStreak=0, total=0, stop=null;
  function onFeedback(fb){ $tips.innerHTML=''; if(fb.tips.length){ fb.tips.forEach(t=>{ const d=document.createElement('div'); d.className='tip bad'; d.textContent=t; $tips.appendChild(d); }); goodStreak=0; }
    else { fb.good.forEach(t=>{ const d=document.createElement('div'); d.className='tip good'; d.textContent=t; $tips.appendChild(d); }); goodStreak++; if(goodStreak%15===0){ total=Math.min(100,total+10);} $pb.style.width=total+'%'; $stat.textContent='התקדמות: '+total+'%'; } }
  startTraining($wrap,onFeedback).then(unsub=>stop=unsub);
  $app.querySelector('#pause').onclick=()=>{ alert('הפסקה קצרה. חזור כשאתה מוכן 🙂'); };
  $app.querySelector('#end').onclick=()=>{ try{ stop&&stop(); }catch(e){} const d=store.get(); d.progress=d.progress||{stance:0,punches:0,blocks:0,footwork:0,combos:0}; d.progress.stance=Math.max(d.progress.stance,total); store.set(d); sendMetric('train_end',{stancePercent:total}); location.hash='#/progress'; };
}
function renderProgress(){ const d=store.get(); const p=(d.progress||{stance:0,punches:0,blocks:0,footwork:0,combos:0}); mount(`<section class="card section"><h2>פרוגרס</h2>
<div class="grid"><div>עמידה — ${p.stance}% ${progressBar(p.stance)}</div><div>אגרופים — ${p.punches}% ${progressBar(p.punches)}</div><div>בלוקים — ${p.blocks}% ${progressBar(p.blocks)}</div><div>רגליים — ${p.footwork}% ${progressBar(p.footwork)}</div><div>קומבינציות — ${p.combos}% ${progressBar(p.combos)}</div></div>
<div class="row justify-between"><button class="btn ghost" id="reset">איפוס</button><button class="btn primary" onclick="location.hash='#/train'">אימון נוסף</button></div></section>`);
  $app.querySelector('#reset').onclick=()=>{ if(confirm('לאפס התקדמות?')){ const x=store.get(); x.progress={stance:0,punches:0,blocks:0,footwork:0,combos:0}; store.set(x); renderProgress(); } };
}
function renderBadges(){ const d=store.get(); const p=(d.progress||{stance:0,punches:0,blocks:0,footwork:0,combos:0}); const earned=[]; if(p.stance>=50) earned.push('אימון ראשון'); if(p.stance>=100) earned.push('עמידה מושלמת');
  mount(`<section class="card section"><h2>תגים</h2><div class="grid grid-3">${['אימון ראשון','100 אגרופים','רפלקס <1.5 שנ׳','עמידה מושלמת'].map(n=>{const got=earned.includes(n); return `<div class="card" style="text-align:center; opacity:${got?1:.4}">${n}</div>`;}).join('')}</div>
  <div class="row justify-between"><span class="small">שיתוף בקרוב</span><button class="btn primary" onclick="location.hash='#/train'">חזור לאימון</button></div></section>`);
}
addEventListener('hashchange',route); addEventListener('load',()=>{ route(); if('serviceWorker' in navigator){ navigator.serviceWorker.register('service-worker.js'); } });