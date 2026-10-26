'use strict';
// Fog Line — Settings (pixel size, UI text size, screen shake, volumes, captions for sound cues, hold or toggle,
// fullscreen, key rebinding), sound captions, and the dev menu.
// Classic script: shares globals with the other files, load order matters (see index.html).

const SET={pixel:0,ui:1,shake:true,master:0.8,music:0.6,sfx:1,captions:false,sprintHold:true,sneakHold:false,throwHold:true,binds:null};
try{ Object.assign(SET,JSON.parse(localStorage.getItem('fogline.settings')||'{}')); }catch(e){}
function saveSettings(){ try{ localStorage.setItem('fogline.settings',JSON.stringify(SET)); }catch(e){} }
function applySettings(){
  userScaleBias=SET.pixel; resize();
  document.documentElement.style.setProperty('--ui',SET.ui);
  VOL.master=SET.master; VOL.music=SET.music; VOL.sfx=SET.sfx; applyVolumes();
  capEl.hidden=!SET.captions;
}

/* ---------- captions for sounds: what you heard and roughly where ---------- */
const capEl=document.getElementById('captions');
const capSeen=new Map();
function dirWord(x,z){
  const p=squad[me], dx=x-p.x, dz=z-p.z, d=Math.hypot(dx,dz);
  if(d<5) return 'close';
  const a=Math.atan2(dx,-dz), w=['north','northeast','east','southeast','south','southwest','west','northwest'][((Math.round(a/(Math.PI/4))%8)+8)%8];
  return (d<15?'close, ':d>40?'far, ':'')+w;
}
function caption(text,x,z){
  if(!SET.captions||!G.started) return;
  const key=text, now=performance.now(); if(now-(capSeen.get(key)||0)<2500) return; capSeen.set(key,now);
  const d=document.createElement('div'); d.textContent='['+text+(x!==undefined?' · '+dirWord(x,z):'')+']'; capEl.appendChild(d);
  while(capEl.children.length>4) capEl.firstChild.remove();
  setTimeout(()=>{ d.style.opacity=0; setTimeout(()=>d.remove(),800); },3200);
}

/* ---------- the settings screen ---------- */
const setEl=document.getElementById('settings');
let rebinding=null;
const ACT_NAME={up:'Move up',down:'Move down',left:'Move left',right:'Move right',sprint:'Sprint',sneak:'Sneak',dodge:'Dodge / vault',reload:'Reload',shove:'Shove / kick / quiet kill',weapon:'Switch weapon',mode:'Fire mode',supp:'Suppressor',throw:'Throw',thrNext:'Next throwable',use:'Use / search / door',light:'Flashlight',inv:'Inventory',build:'Build mode',squad:'Squad screen',hold:'All: hold',follow:'All: follow',fallback:'All: fall back',quiet:'Weapons free / hold fire',lines:'Line lights',swap:'Swap (hold: orders)',map:'Map',zoom:'Zoom',endDay:'End the day',keys:'Show keys'};
function keyName(k){ return k===' '?'SPACE':k==='arrowup'?'↑':k==='arrowdown'?'↓':k==='arrowleft'?'←':k==='arrowright'?'→':k.toUpperCase(); }
function settingsOpen(){ setEl.hidden=false; renderSettings(); }
function settingsClose(){ setEl.hidden=true; rebinding=null; saveSettings(); }
function renderSettings(){
  const sl=(id,label,min,max,step,v)=>`<label class="sr"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-s="${id}"><em>${id==='pixel'?['NORMAL','CHUNKIER','CHUNKIEST'][v]:id==='ui'?Math.round(v*100)+'%':Math.round(v*100)+'%'}</em></label>`;
  const tg=(id,label,on,offL,onL)=>`<label class="sr"><span>${label}</span><button data-t="${id}" class="${SET[id]?'on':''}">${SET[id]?(onL||'ON'):(offL||'OFF')}</button></label>`;
  const binds=Object.keys(ACT_NAME).map(a=>`<div class="kb"><span>${ACT_NAME[a]}</span><button data-b="${a}" class="${rebinding===a?'wait':''}">${rebinding===a?'PRESS A KEY':BIND[a].map(keyName).join(' / ')}</button></div>`).join('');
  setEl.innerHTML=`<div class="setbox"><div class="ttl">SETTINGS</div>
    <div class="cols"><div>
      <div class="sub">PICTURE</div>${sl('pixel','Pixel size',0,2,1,SET.pixel)}${sl('ui','Text size',0.85,1.4,0.05,SET.ui)}${tg('shake','Screen shake')}
      <label class="sr"><span>Fullscreen</span><button data-f="1">${document.fullscreenElement?'ON':'OFF'}</button></label>
      <div class="sub">SOUND</div>${sl('master','Master',0,1,0.05,SET.master)}${sl('music','Music',0,1,0.05,SET.music)}${sl('sfx','Effects',0,1,0.05,SET.sfx)}${tg('captions','Sound captions')}
      <div class="sub">CONTROLS</div>${tg('sprintHold','Sprint',0,'TOGGLE','HOLD')}${tg('sneakHold','Sneak',0,'TOGGLE','HOLD')}${tg('throwHold','Throw',0,'CLICK TO AIM','HOLD G')}
    </div><div><div class="sub">KEYS</div><div class="binds">${binds}</div><button data-r="1" class="rst">RESET KEYS</button></div></div>
    <div class="hint">Esc or the button to close.</div><div class="btns"><button id="setDone">DONE</button></div></div>`;
  setEl.querySelectorAll('input[data-s]').forEach(i=>i.oninput=()=>{ SET[i.dataset.s]=+i.value; applySettings(); i.nextElementSibling.textContent=i.dataset.s==='pixel'?['NORMAL','CHUNKIER','CHUNKIEST'][+i.value]:Math.round(i.value*100)+'%'; });
  setEl.querySelectorAll('button[data-t]').forEach(b=>b.onclick=()=>{ SET[b.dataset.t]=!SET[b.dataset.t]; applySettings(); renderSettings(); });
  setEl.querySelectorAll('button[data-b]').forEach(b=>b.onclick=()=>{ rebinding=b.dataset.b; renderSettings(); });
  const f=setEl.querySelector('button[data-f]'); if(f) f.onclick=()=>{ if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(()=>{}); setTimeout(renderSettings,300); };
  setEl.querySelector('button[data-r]').onclick=()=>{ SET.binds=null; Object.assign(BIND,JSON.parse(JSON.stringify(BIND_DEFAULT))); rebuildKeyMap(); renderSettings(); };
  document.getElementById('setDone').onclick=settingsClose;
}
// capture a key for rebinding before the game sees it
addEventListener('keydown',e=>{
  if(!rebinding||setEl.hidden) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const k=e.key.toLowerCase();
  if(k!=='escape'){ for(const a in BIND) BIND[a]=BIND[a].filter(x=>x!==k); BIND[rebinding]=[k]; SET.binds=BIND; rebuildKeyMap(); }
  rebinding=null; saveSettings(); renderSettings();
},true);

/* ---------- dev menu (backquote) ---------- */
const devEl=document.getElementById('dev');
const DEV={god:false};
function devToggle(){ devEl.hidden=!devEl.hidden; if(!devEl.hidden) renderDev(); }
function renderDev(){
  const B=(id,l)=>`<button data-d="${id}">${l}</button>`;
  devEl.innerHTML=`<div class="ttl">DEV</div>${B('z20','Spawn 20 near')}${B('z100','Spawn 100 on 18th')}${B('kill','Kill all dead')}${B('ammo','Ammo + throwables')}${B('sup','Supplies +20')}${B('heal','Heal squad')}
    ${B('god',DEV.god?'God mode: ON':'God mode: OFF')}${B('dusk','Skip to dusk')}${B('dawn','Skip to dawn')}${B('siege','Next night: siege')}${B('xp','Squad +300 XP')}${B('surv','New survivor')}${B('tools','All upgrades')}
    <div class="dv">fps ${devFps.toFixed(0)} · dead ${(()=>{let n=0;for(let i=0;i<MAXZ;i++) if(zst[i]) n++; return n;})()} · night ${G.night} · ${G.nightType}</div>`;
  devEl.querySelectorAll('button[data-d]').forEach(b=>b.onclick=()=>{ const d=b.dataset.d, p=squad[me];
    if(d==='z20') for(let k=0;k<20;k++){ const a=rand(0,6.28), r=rand(10,18), q=findSpot(p.L,p.x+Math.sin(a)*r,p.z+Math.cos(a)*r); if(q) spawnZ(q.x,q.z,2,0,0,p.L); }
    if(d==='z100'){ for(let k=0;k<100;k++){ spawnZ(rand(-40,40),-32+rand(-5,5),2,0,0); } }
    if(d==='kill') for(let i=0;i<MAXZ;i++) if(zst[i]&&zst[i]!==5) killZ(i,false);
    if(d==='ammo'){ for(const a in AMMO) AMMO[a]+=200; for(const t in THR) THR[t]+=5; }
    if(d==='sup') for(const k in SUP) SUP[k]+=20;
    if(d==='heal') for(const s of squad) if(s.alive){ s.hp=100; s.wounds={leg:0,arm:0,bleed:0}; s.fat=0; s.stress=0; }
    if(d==='god') DEV.god=!DEV.god;
    if(d==='dusk'&&G.phase==='day') G.t=0.05;
    if(d==='dawn'&&G.phase==='night') G.nightT=NIGHT_LEN;
    if(d==='siege') G.nextEvent=G.night;
    if(d==='xp') for(const s of squad) giveXP(s,300,null);
    if(d==='surv'){ const v=placeSurvivor(); if(v){ v.seen=true; radio('A survivor is hiding at '+(whereIs({L:v.L,x:v.x,z:v.z})||'somewhere')+'.'); } }
    if(d==='tools') for(const k in BASEUP) BASEUP[k]=true;
    renderDev(); });
}
let devFps=60, devFrames=0, devT=0;
function devTick(dt){ devFrames++; devT+=dt; if(devT>=1){ devFps=devFrames/devT; devFrames=0; devT=0; if(!devEl.hidden) renderDev(); } }
