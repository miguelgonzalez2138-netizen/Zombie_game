'use strict';
// Fog Line — Days and nights: the clock, weather, the kinds of night (the horde passing, sieges, storms, quiet ones),
// horde growth from big noise, day events (people asking for help, raiders, the evac), the radio, night talks at
// the base, the dawn planning screen, run stats, the score board and epilogue, and saving (browser + file).
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- the clock ---------- */
const NIGHT_HOUR=22;                     // real seconds per in-game hour of night
const NIGHT_LEN=12*NIGHT_HOUR;           // 18:00 to 06:00
function clockMin(){
  if(G.phase==='day') return 6.5*60+(10.5*HOUR-G.t)/HOUR*60;
  if(G.phase==='dusk') return 17*60+(1-G.t/DUSK_LEN)*60;
  if(G.phase==='night') return 18*60+(G.nightT/NIGHT_HOUR)*60;
  return 6*60+(1-G.t/DAWN_LEN)*30;
}
const DUSK_LEN=24, DAWN_LEN=9;
function clockStr(){ const m=Math.floor(clockMin())%1440; return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
let timeScale=1;
function setSpeed(d){ const opts=[1,2,4]; let i=opts.indexOf(timeScale); i=clamp(i+d,0,2); timeScale=opts[i]; bannerShow(timeScale===1?'NORMAL SPEED':timeScale+'× SPEED','',1); }

/* ---------- run stats ---------- */
const STATS={kills:0,shots:0,heads:0,quiet:0,melee:0,searched:0,built:0,crafted:0,recruits:0,runs:0,lost:[],nights:[],scrapUsed:0,events:[],evac:false,maxSquad:4,start:Date.now()};
const NIGHT_LOG={kills:0,lost:[],hurt:new Set(),lineLost:0,type:''};

/* ---------- weather: late fall going into winter ---------- */
const WX={kind:'clear',k:0,snow:0,flash:0,thunder:0,gustK:0};
const WX_NAME={clear:'Clear',rain:'Rain',snow:'Snow',wind:'Wind',storm:'Storm',fog:'Heavy fog'};
function rollWeather(){
  const winter=clamp((G.night-2)/10,0,1);
  const r=Math.random();
  let k='clear';
  if(r<0.18) k='rain'; else if(r<0.18+0.3*winter) k='snow'; else if(r<0.55) k='wind'; else if(r<0.62) k='fog';
  if(k==='rain'&&winter>0.6&&Math.random()<.5) k='snow';
  WX.kind=k;
}
// rain and storms swallow noise, snow muffles it, wind carries it
function wxNoise(){ return WX.kind==='rain'?0.75:WX.kind==='storm'?0.6:WX.kind==='snow'?0.8:WX.kind==='wind'?1.2:1; }
function wxSight(){ return WX.kind==='fog'?0.7:WX.kind==='storm'?0.8:WX.kind==='snow'?0.9:1; }
function wxSpeed(s){ return WX.snow>0.4&&!indoors(s.L,s.x,s.z)?0.92:1; }
const drops=[]; for(let i=0;i<420;i++) drops.push({x:Math.random(),y:Math.random(),z:rand(.4,1.4),p:Math.random()*6});
function updateWeather(dt){
  const want=WX.kind==='clear'||WX.kind==='wind'||WX.kind==='fog'?0:1;
  WX.k=lerp(WX.k,want,Math.min(1,dt*0.4));
  if(WX.kind==='snow') WX.snow=Math.min(1,WX.snow+dt*0.004); else WX.snow=Math.max(0,WX.snow-dt*(WX.kind==='rain'?0.01:0.002));
  if(WX.kind==='storm'){ WX.thunder-=dt; if(WX.thunder<=0){ WX.thunder=rand(8,22); WX.flash=1; const d=rand(0.3,1.6); if(AC) setTimeout(()=>SFX.boom(rand(-1,1),0.35/d),d*1000); } }
  WX.flash=Math.max(0,WX.flash-dt*3);
  if(WX.kind==='wind'||WX.kind==='storm') G.gustTarget=Math.max(G.gustTarget,0.6);
  if(AC&&amb.rain) amb.rain.g.gain.setTargetAtTime((WX.kind==='rain'||WX.kind==='storm')?0.05*WX.k*(indoors(squad[me].L,squad[me].x,squad[me].z)?0.5:1):0,AC.currentTime,0.8);
}
function drawWeather(ctx,dt,inside){
  if(WX.k<0.02) return;
  const n=Math.round(drops.length*WX.k*(inside?0.25:1)), snow=WX.kind==='snow';
  ctx.strokeStyle='rgba(200,210,220,.35)'; ctx.fillStyle='rgba(235,235,240,.75)'; ctx.lineWidth=1*DPR;
  const wind=(0.3+G.gust)*(snow?0.06:0.25);
  ctx.beginPath();
  for(let i=0;i<n;i++){ const d=drops[i];
    if(snow){ d.y+=dt*0.05*d.z; d.x+=dt*(wind*d.z+Math.sin(time*0.8+d.p)*0.01); }
    else { d.y+=dt*1.6*d.z; d.x+=dt*wind*d.z; }
    if(d.y>1){ d.y-=1; d.x=Math.random(); } d.x=((d.x%1)+1)%1;
    const X=d.x*FW, Y=d.y*FH;
    if(snow){ ctx.moveTo(X+1.6*d.z*DPR,Y); ctx.arc(X,Y,1.6*d.z*DPR,0,7); }
    else { ctx.moveTo(X,Y); ctx.lineTo(X-wind*18*DPR,Y-14*d.z*DPR); }
  }
  if(snow) ctx.fill(); else ctx.stroke();
}

/* ---------- what kind of night it is ---------- */
const NIGHT_TYPES={
  pass:{name:'THE HORDE PASSES',sub:'They\'re moving along 18th. Let it pass.'},
  quiet:{name:'A QUIET NIGHT',sub:'Nothing on 18th. Stragglers only. Get some rest.'},
  siege:{name:'THEY\'RE COMING FOR THE LINE',sub:'The horde turned off 18th. Hold.'},
  brutal:{name:'ALL OF THEM',sub:'Everything in Pilsen is coming. Hold or die.'},
  two:{name:'TWO HORDES',sub:'One on 18th, one coming down Wolcott from the south.'},
  storm:{name:'STORM',sub:'Can\'t see, can\'t hear. Neither can they.'},
};
function rollNight(){
  if(G.night===1) return 'pass';
  if(G.night>=G.nextEvent){
    G.nextEvent=G.night+2+(Math.random()*3|0);
    const r=Math.random();
    if(r<0.12&&G.night>=5) return 'brutal';
    if(r<0.45) return 'siege';
    if(r<0.7) return 'two';
    return 'storm';
  }
  return Math.random()<0.3?'quiet':'pass';
}
// how many: grows with the nights, and with how loud you've been (only big noise counts)
function hordeSize(){ return Math.min(MAXZ-80,Math.round(110+G.night*30+G.hordeBonus)); }
function bigNoise(r){ if(r>=40) G.dayNoise+=r*(G.phase==='day'?1:0.35); }
function spawnPass(n,dir){
  // dir 0: along 18th from the east. 1: down Wolcott from the south
  for(let k=0;k<n;k++){
    const ox=rand(-30,30), oz=rand(-6,6);
    if(dir===0) spawnZ(G.anchorX+ox,-32+oz,1,ox,oz);
    else { const i=spawnZ(rand(-6,6),rand(120,160),2,0,0); if(i>=0){ ztx[i]=rand(-8,8); ztz[i]=rand(-60,-40); zwt[i]=0; } }
  }
}
// a siege comes in waves at the line from the north
function queueSiege(n){
  const waves=3+(Math.random()*2|0); G.waves=[];
  for(let w=0;w<waves;w++) G.waves.push({t:12+w*NIGHT_LEN/(waves+1)*rand(.7,1.1),n:Math.round(n/waves*rand(.8,1.2))});
}
function spawnWave(n){
  const from=[[0,-110],[-40,-34],[40,-34],[-72,-60],[72,-60]];
  for(let k=0;k<n;k++){ const f=from[Math.random()*from.length|0]; const i=spawnZ(f[0]+rand(-6,6),f[1]+rand(-6,6),2,0,0); if(i<0) break; ztx[i]=rand(-10,10); ztz[i]=-16; zwt[i]=0; }
  radio(['They\'re coming up Wolcott!','Here comes the next wave.','More of them. A lot more.'][Math.random()*3|0]);
}
function nightStart(){
  const type=G.nightType, n=hordeSize();
  NIGHT_LOG.kills=0; NIGHT_LOG.lost=[]; NIGHT_LOG.hurt=new Set(); NIGHT_LOG.lineLost=0; NIGHT_LOG.type=type;
  G.anchorX=150; G.anchorSpeed=(150+195)/(NIGHT_LEN*0.62); G.peel=0.0025+G.night*0.0012; G.waves=[];
  if(type==='pass'||type==='storm') spawnPass(n,0);
  else if(type==='two'){ spawnPass(Math.round(n*0.6),0); spawnPass(Math.round(n*0.4),1); }
  else if(type==='siege') queueSiege(Math.round(n*0.8));
  else if(type==='brutal'){ queueSiege(Math.round(n*1.0)); spawnPass(Math.round(n*0.4),0); }
  if(type==='storm'){ WX.kind='storm'; }
  const strag=(type==='quiet'?14:10)+G.night*3;
  for(let k=0;k<strag;k++){ const p=randomStreetSpot(30); if(p) spawnZ(p.x,p.z,4,0,0); }
  if(type==='quiet'||type==='pass') G.anchorX=type==='quiet'?999:150;
  if(type==='quiet'){ despawnAll(true); for(let k=0;k<strag;k++){ const p=randomStreetSpot(30); if(p) spawnZ(p.x,p.z,4,0,0); } }
  const T=NIGHT_TYPES[type]; bannerShow('NIGHT '+G.night+' · '+T.name,T.sub,4);
}
function updateNight(dt){
  G.nightT+=dt;
  if(G.nightType!=='quiet'&&G.nightType!=='siege') G.anchorX-=G.anchorSpeed*dt;
  for(const w of G.waves){ if(!w.done&&G.nightT>=w.t){ w.done=true; spawnWave(w.n); } }
  nightTalk(dt);
  if(G.nightT>=NIGHT_LEN) startDawn();
}

/* ---------- day events ---------- */
function dayEvent(){
  G.event=null;
  // the evac: rare, late, and you have to get there
  if(G.night>=7&&!STATS.evac&&Math.random()<0.1){
    G.event={kind:'evac',t0:13.5*60,t1:15*60}; radio('Military band, clear as day: "Evac bird, Harrison Park ball field, fourteen hundred. One lift. Be there."'); STATS.events.push('evac call'); return; }
  const r=Math.random();
  if(r<0.3&&G.night>1){
    // somebody's trapped and calling on a civilian band
    const v=placeSurvivor(); if(v){ G.event={kind:'help',v};
      for(let k=0;k<7;k++){ const p=findSpot(0,v.x+rand(-8,8),v.z+rand(-8,8)); if(p&&!indoors(0,p.x,p.z)) spawnZ(p.x,p.z,4,0,0); }
      v.seen=true; v.help=true;
      radio('Civilian band: "...anyone. We\'re at '+(whereIs({L:0,x:v.x,z:v.z})||'a house off 18th')+'. They\'re outside. Please."');
      STATS.events.push('call for help'); return; } }
  if(r<0.45&&G.night>2){ G.event={kind:'raiders'}; radio('Somebody\'s been watching the shop from the rooftops on 18th. Organized. Armed.'); return; }
}
// raiders hit the shop when nobody's home
function raidCheck(){
  if(!G.event||G.event.kind!=='raiders') { if(G.night>3&&Math.random()<0.08) G.event={kind:'raiders'}; else return; }
  const frac=G.baseEmpty/(10.5*HOUR);
  if(frac>0.6&&Math.random()<0.7){
    const took={}; for(const k of ['food','water','fuel','scrap']){ const n=Math.floor(SUP[k]*rand(0.25,0.45)); SUP[k]-=n; took[k]=n; }
    radio('Raiders hit the shop while it was empty. Took '+Object.keys(took).map(k=>took[k]+' '+k).join(', ')+'.'); STATS.events.push('raided');
  } else if(Math.random()<0.5){
    const g=squad.filter(s=>present(s)&&atBase(s)); if(g.length){ const s=g[Math.random()*g.length|0]; giveXP(s,20,'fight'); if(Math.random()<.35){ s.wounds.arm=Math.max(s.wounds.arm,1); s.hp-=15; }
      radio(nameOf(s)+' ran off raiders at the back door. They\'ll be back.'); STATS.events.push('raiders driven off'); }
  }
  G.event=null;
}
function updateDayEvents(dt){
  if(!squad.some(s=>present(s)&&atBase(s))) G.baseEmpty+=dt;
  const ev=G.event; if(!ev) return;
  if(ev.kind==='evac'){
    const m=clockMin();
    if(m>ev.t1){ G.event=null; radio('Rotors to the north. Then nothing. They didn\'t wait.'); return; }
    if(m>=ev.t0){ if(!ev.heard){ ev.heard=true; radio('Rotors. Close. Harrison Park.'); if(AC) SFX.rotor(0); }
      const p=squad[me]; if(p.x>13&&p.x<59&&p.z>71&&p.z<130&&p.L===0){ evacuate(); } }
  }
  if(ev.kind==='help'&&!survivors.includes(ev.v)){ G.event=null; }
}
function evacuate(){
  const p=squad[me], with_=squad.filter(s=>present(s)&&Math.hypot(s.x-p.x,s.z-p.z)<25);
  STATS.evac=true; STATS.evacWith=with_.map(s=>s.name);
  runOver('EVACUATED',with_.length+' got on the bird.');
}

/* ---------- the radio: never answered ---------- */
const RADIO_STORY={
  2:'Battalion net, scheduled check-in. Static. Reyes logged it.',
  3:'Civilian band: a man reading street names off a list. Damen. Wood. Blue Island. Then a long silence.',
  4:'Somebody keyed the battalion net twice and said nothing.',
  5:'Emergency broadcast on a loop: "Remain indoors. Do not approach the sick. Help is coming."',
  6:'A ham operator in Cicero says the fever started at a meat plant on the river. Then he stops making sense.',
  8:'Military traffic, encrypted. Then in the clear: "...Pilsen sector is written off..." Dunn turned it off.',
  10:'A kid on a walkie, counting floors in a building. She gets to six and stops.',
  12:'The emergency loop is gone. Just carrier hiss now.',
  15:'Someone on the net who sounds a lot like the captain. "Second squad, if you\'re out there—" and it cuts.',
};
function radioDawn(){ const m=RADIO_STORY[G.night]; if(m) setTimeout(()=>radio(m),2500); }

/* ---------- night talks at the base ---------- */
const TALK=[
  ['{a}: You ever think the trucks just forgot the address?','{b}: Every night.'],
  ['{a}: When this is over I\'m eating a whole tray of tamales.','{b}: From who? Everybody who made them is outside.','{a}: ...Still.'],
  ['{a}: How many rounds we got left?','{b}: Enough to make it interesting.'],
  ['{a}: I counted forty-one on the bus tonight.','{b}: Stop counting.'],
  ['{a}: My mom lived on Cullerton.','{b}: ...','{a}: Yeah.'],
  ['{a}: Snoring like that, they\'ll hear you in Cicero.','{b}: Then they can come get me.'],
  ['{a}: If I turn, you do it. Don\'t make it a speech.','{b}: No speeches. Promise.'],
  ['{a}: The radio did that click again.','{b}: It always does that.','{a}: I know. I just want it to mean something.'],
  ['{a}: You think the fog is them, somehow?','{b}: I think the fog is fog. Go to sleep.'],
  ['{a}: Best thing in this hardware store?','{b}: Duct tape.','{a}: Duct tape.'],
  ['{a}: I miss the L. The noise of it.','{b}: Don\'t say that out loud.'],
  ['{a}: We should write the names down. Everyone we lost.','{b}: Reyes has a notebook.'],
];
let talkT=20;
function nightTalk(dt){
  talkT-=dt; if(talkT>0) return; talkT=rand(22,40);
  let chasing=0; for(let i=0;i<MAXZ;i++) if(zst[i]===3) chasing++;
  if(chasing>2) return;
  const home=squad.filter(s=>present(s)&&indoors(s.L,s.x,s.z)&&atBase(s));
  if(home.length<2) return;
  const a=home[Math.random()*home.length|0]; let b=home[Math.random()*home.length|0]; if(a===b) b=home.find(q=>q!==a);
  const lines=TALK[Math.random()*TALK.length|0];
  lines.forEach((l,k)=>setTimeout(()=>radio(l.replace('{a}',nameOf(a)).replace('{b}',nameOf(b))),k*2600));
  relAdd(a,b,1.5); a.stress=Math.max(0,a.stress-6); b.stress=Math.max(0,b.stress-6);
}

/* ---------- the dawn planning screen ---------- */
const planEl=document.getElementById('plan');
const PLAN={open:false,tasks:{}};
const TASKS=[['guard','GUARD THE SHOP'],['repair','FIX THE LINE'],['rest','REST'],['follow','WITH ME'],['scav','SCAVENGE']];
function scavOptions(){
  const opts=[];
  const seen=new Set();
  for(const B of MAP.blds){ if(!B.enter||B.kind==='base') continue;
    const cx=(B.x0+B.x1)/2, cz=(B.z0+B.z1)/2, d=Math.hypot(cx+20,cz-14);
    const cs=containers.filter(c=>c.f.b===B.id), touched=cs.some(c=>c.rolled&&!c.grid.items.length);
    if(B.name&&B.kind!=='store') opts.push({B,d,label:B.name,touched});
    else if(d<90&&!touched) opts.push({B,d,label:(B.kind==='store'?'Storefront':B.kind==='ware'?'Warehouse':'Two-flat')+' on '+(whereIs({L:0,x:cx,z:B.z0-1})||'the block'),touched});
  }
  opts.sort((a,b)=>a.d-b.d);
  const named=opts.filter(o=>o.B.name).slice(0,8), plain=opts.filter(o=>!o.B.name).slice(0,6);
  return named.concat(plain).filter(o=>!seen.has(o.B.id)&&seen.add(o.B.id));
}
function planOpen(){
  PLAN.open=true; G.paused=true; planEl.hidden=false;
  PLAN.opts=scavOptions(); PLAN.tasks={};
  for(const s of squad) if(present(s)&&s.i!==me) PLAN.tasks[s.uid]={task:s.fat>70?'rest':s.wounds.leg?'rest':'repair',b:0};
  renderPlan();
}
function renderPlan(){
  const lost=NIGHT_LOG.lost, hurt=[...NIGHT_LOG.hurt].filter(n=>!lost.includes(n));
  const people=squad.filter(s=>present(s)&&s.i!==me);
  const rows=people.map(s=>{ const t=PLAN.tasks[s.uid];
    return `<div class="pr"><div><b>${s.short}</b><small>${roleOf(s)} · HP ${Math.round(s.hp)} · FATIGUE ${Math.round(s.fat)}${woundText(s).length?' · '+woundText(s).join(', '):''}</small></div>
      <div class="pt">${TASKS.map(([k,n])=>`<button class="${t.task===k?'on':''}" data-u="${s.uid}" data-t="${k}">${n}</button>`).join('')}</div>
      ${t.task==='scav'?`<select data-u="${s.uid}">${PLAN.opts.map((o,k)=>`<option value="${k}" ${k===t.b?'selected':''}>${o.label} · ${Math.round(o.d)}m${o.touched?' · picked over':''}</option>`).join('')}</select>`:''}</div>`; }).join('');
  planEl.innerHTML=`<div class="planbox"><div class="ttl">DAWN · DAY ${G.night}</div>
    <div class="sum"><span>THE NIGHT <b>${(NIGHT_TYPES[NIGHT_LOG.type]||{name:'—'}).name}</b></span><span>DROPPED <b>${NIGHT_LOG.kills}</b></span>${lost.length?`<span class="bad">LOST <b>${lost.join(', ')}</b></span>`:''}${hurt.length?`<span>HURT <b>${hurt.join(', ')}</b></span>`:''}<span>LINE <b>${Math.round(segs.reduce((a,g)=>a+(g.alive?g.hp/g.max:0),0)/segs.length*100)}%</b></span></div>
    <div class="sum"><span>FOOD <b>${SUP.food}</b></span><span>WATER <b>${SUP.water}</b></span><span>FUEL <b>${SUP.fuel}</b></span><span>SCRAP <b>${SUP.scrap}</b></span><span>WEATHER <b>${WX_NAME[WX.kind]}</b></span>${G.event&&G.event.kind==='evac'?'<span class="warn">EVAC <b>14:00 · HARRISON PARK</b></span>':''}</div>
    <div class="sub">TODAY</div>${rows||'<div class="note">Nobody else left. It\'s just you.</div>'}
    <div class="btns"><button id="planGo">START THE DAY</button></div><div class="hint">Guarding keeps raiders off the stash. Resting brings fatigue down. Scavengers come back hours later with a full pack, or hurt, or not at all.</div></div>`;
  planEl.querySelectorAll('button[data-t]').forEach(b=>b.onclick=()=>{ PLAN.tasks[+b.dataset.u].task=b.dataset.t; renderPlan(); });
  planEl.querySelectorAll('select[data-u]').forEach(sel=>sel.onchange=()=>{ PLAN.tasks[+sel.dataset.u].b=+sel.value; });
  document.getElementById('planGo').onclick=planGo;
}
function planGo(){
  PLAN.open=false; planEl.hidden=true; G.paused=false;
  for(const s of squad){ const t=PLAN.tasks[s.uid]; if(!t||!present(s)) continue;
    if(t.task==='guard'){ s.order='hold'; s.post=findSpot(0,-20+rand(-2,2),14+rand(-3,3))||{x:-20,z:14}; s.postL=0; s.postSet=true; }
    else if(t.task==='repair'){ s.order='hold'; s.post=linePost(s); s.postL=0; s.postSet=false; }
    else if(t.task==='rest') s.order='rest';
    else if(t.task==='follow') s.order='follow';
    else if(t.task==='scav'){ const o=PLAN.opts[t.b]; if(o){ s.order='hold'; scavTo(s,o.B); STATS.runs++; } }
  }
}

/* ---------- score, epilogue, the board ---------- */
function supplyTotal(){ return SUP.food+SUP.water+SUP.fuel+SUP.scrap; }
function runScore(){ return (G.night-1)*1000+STATS.kills*10+supplyTotal()*5+squad.filter(s=>s.alive).length*200+(STATS.evac?3000:0); }
function epilogue(){
  const nights=G.night-1, alive=squad.filter(s=>s.alive), dead=squad.filter(s=>!s.alive);
  const civ=squad.filter(s=>s.civ);
  const p=[];
  p.push(`Second Squad held Wolcott & 18th for ${nights} night${nights===1?'':'s'}.`);
  p.push(`They fired ${STATS.shots.toLocaleString()} rounds and put down ${STATS.kills.toLocaleString()} of the dead${STATS.quiet?`, ${STATS.quiet} of them quietly`:''}.`);
  if(civ.length) p.push(`${civ.length} civilian${civ.length===1?'':'s'} joined along the way${civ.filter(s=>s.alive).length?`; ${civ.filter(s=>s.alive).map(s=>s.name.split(' ')[0]).join(', ')} lasted to the end`:''}.`);
  if(dead.length) p.push(`${dead.map(s=>s.name).join(', ')} didn't make it.`);
  if(STATS.evac) p.push(`On day ${G.night} a helicopter set down on the Harrison Park ball field. ${STATS.evacWith.length} got on.${alive.length>STATS.evacWith.length?' The rest stayed with the shop.':''}`);
  else if(!alive.length) p.push('Nobody came back for the truck. The shop on Wolcott stayed lit for a while after.');
  p.push(`The stash still held ${SUP.food} food, ${SUP.water} water, ${SUP.fuel} fuel and ${SUP.scrap} scrap.`);
  return p.join(' ');
}
function loadBoard(){ try{ return JSON.parse(localStorage.getItem('fogline.board')||'[]'); }catch(e){ return []; } }
function saveBoard(b){ try{ localStorage.setItem('fogline.board',JSON.stringify(b.slice(0,20))); }catch(e){} }
function boardHTML(hl){
  const b=loadBoard(); if(!b.length) return '<div class="note">No runs yet.</div>';
  return '<table class="board"><tr><th></th><th>SCORE</th><th>NIGHTS</th><th>KILLS</th><th>SQUAD</th><th>END</th></tr>'+b.map((r,k)=>`<tr class="${r.id===hl?'hl':''}"><td>${k+1}</td><td>${r.score.toLocaleString()}</td><td>${r.nights}</td><td>${r.kills}</td><td>${r.alive}/${r.squad}</td><td>${r.end}</td></tr>`).join('')+'</table>';
}
function runOver(title,sub){
  if(G.dead) return; G.dead=true;
  const score=runScore(), id=Date.now();
  const b=loadBoard(); b.push({id,score,nights:G.night-1,kills:STATS.kills,alive:squad.filter(s=>s.alive).length,squad:squad.length,end:STATS.evac?'EVAC':'WIPED',date:new Date().toLocaleDateString()});
  b.sort((a,c)=>c.score-a.score); saveBoard(b);
  try{ localStorage.removeItem('fogline.save'); }catch(e){}
  const o=document.getElementById('over'); o.hidden=false;
  document.getElementById('overT').textContent=title;
  document.getElementById('overS').innerHTML=`<p>${epilogue()}</p>
    <div class="stats2"><span>SCORE <b>${score.toLocaleString()}</b></span><span>NIGHTS <b>${G.night-1}</b></span><span>KILLS <b>${STATS.kills}</b></span><span>HEAD SHOTS <b>${STATS.heads}</b></span><span>QUIET KILLS <b>${STATS.quiet}</b></span>
    <span>ROUNDS <b>${STATS.shots}</b></span><span>SEARCHED <b>${STATS.searched}</b></span><span>BUILT <b>${STATS.built}</b></span><span>RECRUITS <b>${STATS.recruits}</b></span><span>RUNS <b>${STATS.runs}</b></span><span>SUPPLIES <b>${supplyTotal()}</b></span></div>
    <div class="sub">THE BOARD</div>${boardHTML(id)}`;
}

/* ---------- corpses fade over the days ---------- */
const cNight=new Int16Array(MAXC).fill(-1);
function fadeCorpses(){ for(let k=0;k<MAXC;k++){ if(cNight[k]>=0&&cNight[k]<=G.night-3){ for(const n of ZPARTS){ cim[n].setMatrixAt(k,zeroM); cim[n].instanceMatrix.needsUpdate=true; } cNight[k]=-1; } } }

/* ---------- saving: the browser, and a file you can keep ---------- */
const ED_T0=ED.t.slice(), ED_HP0=ED.hp.slice();
function itemsOut(g){ return g.items.map(i=>({key:i.key,n:i.n,rot:i.rot,x:i.x,y:i.y,mag:i.mag,mods:i.mods,hidden:i.hidden})); }
function itemsIn(g,list){ g.items.length=0; for(const o of list){ const it=mkItem(o.key,o.n,{rot:o.rot,x:o.x,y:o.y}); if(o.mag!==undefined) it.mag=o.mag; if(o.mods) it.mods=o.mods; if(o.hidden) it.hidden=true; g.items.push(it); } }
function serialize(){
  const S={v:1,when:Date.now(),
    G:{phase:G.phase,t:G.t,night:G.night,nightT:G.nightT,nightType:G.nightType,anchorX:G.anchorX,anchorSpeed:G.anchorSpeed,peel:G.peel,afterPass:G.afterPass,kills:G.kills,order:G.order,weaponsFree:G.weaponsFree,lightsOn:G.lightsOn,
      hordeBonus:G.hordeBonus,dayNoise:G.dayNoise,nextEvent:G.nextEvent,waves:G.waves,baseEmpty:G.baseEmpty,event:G.event&&G.event.kind!=='help'?G.event:null},
    me,SUP,AMMO,THR,BASEUP,WX:{kind:WX.kind,snow:WX.snow},STATS,NIGHT_LOG:{kills:NIGHT_LOG.kills,lost:NIGHT_LOG.lost,type:NIGHT_LOG.type},time,
    squad:squad.map(s=>({name:s.name,short:s.short,trait:s.trait,acc:s.acc,stress:s.stressK,melee:s.melee,kit:s.kit,bay:s.bay,civ:s.civ,look:s.look,uid:s.uid,
      x:s.x,z:s.z,L:s.L,ang:s.ang,hp:s.hp,alive:s.alive,inv:s.inv,slot:s.slot,wpn:s.mounted?s.inv[s.prevSlot]:s.wpn,mags:s.mags,modes:s.modes,mods:s.mods,pack:itemsOut(s.pack),packH:s.pack.h,
      wounds:s.wounds,xp:s.xp,lvl:s.lvl,perks:s.perks,perkPending:s.perkPending,did:s.did,fat:s.fat,str:s.stress,order:s.order==='scav'||s.order==='mg'||s.order==='heal'?'hold':s.order,post:s.post,postSet:s.postSet,postL:s.postL,watch:s.watch,
      away:s.away?{b:s.away.B.id,left:s.away.left,total:s.away.total}:null,lightOn:s.lightOn,days:s.days})),
    rel:[...REL.entries()],stash:itemsOut(stash),
    cont:containers.map((c,k)=>c.rolled?[k,itemsOut(c.grid)]:null).filter(Boolean),
    ground:items.map(g=>({it:itemsOut({items:[g.it]})[0],x:g.x,z:g.z,L:g.L})),
    strs:strs.filter(S=>!S.dead).map(S=>({type:S.type,L:S.L,cx:S.cx,cz:S.cz,rot:S.rot,hp:S.hp,belt:S.belt})),
    edges:(()=>{ const o=[]; for(let e=1;e<EN;e++) if(ED.t[e]!==ED_T0[e]||Math.abs(ED.hp[e]-ED_HP0[e])>0.5) o.push([e,ED.t[e],Math.round(ED.hp[e]*10)/10,ED.max[e]]); return o; })(),
    segs:segs.map(g=>[g.hp,g.max,g.alive]),
    surv:survivors.map(v=>({d:v.d,x:v.x,z:v.z,L:v.L,b:v.B.id,help:!!v.help})),
    z:(()=>{ const o=[]; for(let i=0;i<MAXZ;i++){ const st=zst[i]; if(!st||st===5||ztr[i]) continue; o.push([Math.round(zx[i]*10)/10,Math.round(zz[i]*10)/10,zl[i],st,Math.round(zhp[i]),zox[i],zoz[i],Math.round(ztx[i]),Math.round(ztz[i])]); } return o; })(),
  };
  return S;
}
function saveGame(quiet){
  if(G.dead) return false;
  try{ localStorage.setItem('fogline.save',JSON.stringify(serialize())); if(!quiet) bannerShow('SAVED','',1.2); return true; }
  catch(e){ bannerShow('COULD NOT SAVE',String(e.message||e).slice(0,60),2.5); return false; }
}
function hasSave(){ try{ return !!localStorage.getItem('fogline.save'); }catch(e){ return false; } }
function exportSave(){
  const blob=new Blob([JSON.stringify(serialize())],{type:'application/json'}), a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='fogline-night'+G.night+'.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
function importSave(file){
  const r=new FileReader(); r.onload=()=>{ try{ const d=JSON.parse(r.result); if(!d||!d.squad) throw new Error('not a Fog Line save');
    localStorage.setItem('fogline.save',r.result); sessionStorage.setItem('fogline.loadNow','1'); location.reload(); }catch(e){ bannerShow('BAD SAVE FILE',String(e.message||e).slice(0,60),2.5); } };
  r.readAsText(file);
}
function loadAndRestart(){ sessionStorage.setItem('fogline.loadNow','1'); location.reload(); }
// rebuild the whole run from a save, on top of a fresh boot (the map itself is fixed)
function applySave(S){
  Object.assign(G,S.G); G.started=true; G.dead=false; G.paused=false; time=S.time||0;
  Object.assign(SUP,S.SUP); Object.assign(AMMO,S.AMMO); Object.assign(THR,S.THR); Object.assign(BASEUP,S.BASEUP); Object.assign(STATS,S.STATS);
  WX.kind=S.WX.kind; WX.snow=S.WX.snow||0;
  NIGHT_LOG.kills=S.NIGHT_LOG.kills; NIGHT_LOG.lost=S.NIGHT_LOG.lost; NIGHT_LOG.type=S.NIGHT_LOG.type;
  despawnAll(false);
  // squad
  S.squad.forEach((d,k)=>{
    let s=squad[k];
    if(!s){ s=makeSoldier({name:d.name,short:d.short,trait:d.trait,acc:d.acc,stress:d.stress,melee:d.melee,kit:d.kit||[null,null,null],bay:d.bay,civ:d.civ,look:d.look,post:d.post}); }
    Object.assign(s,{uid:d.uid,acc:d.acc,stressK:d.stress,melee:d.melee,x:d.x,z:d.z,L:d.L,y:d.L*LH,ang:d.ang,hp:d.hp,alive:d.alive,inv:d.inv,mags:d.mags,modes:d.modes,mods:d.mods||{},
      wounds:d.wounds,xp:d.xp,lvl:d.lvl,perks:d.perks,perkPending:d.perkPending,did:d.did,fat:d.fat,stress:d.str,order:d.order,post:d.post,postSet:d.postSet,postL:d.postL,watch:d.watch,lightOn:d.lightOn,days:d.days||0,trav:null,mounted:null,away:null});
    s.pack.h=d.packH||s.pack.h; itemsIn(s.pack,d.pack);
    if(!s.inv[d.slot]) ensureArmed(s); else equip(s,d.slot,true);
    if(d.away){ s.away={B:MAP.blds[d.away.b],left:d.away.left,total:d.away.total}; s.mesh.visible=false; }
    if(!s.alive){ s.light.intensity=0; s.mesh.rotation.set(Math.PI/2,s.ang,0); s.mesh.position.set(s.x,s.y+0.25,s.z); }
  });
  uidSeq=Math.max(uidSeq,...squad.map(s=>s.uid+1));
  me=S.me; REL.clear(); for(const [k,v] of S.rel) REL.set(k,v);
  itemsIn(stash,S.stash);
  for(const [k,list] of S.cont){ const c=containers[k]; if(!c) continue; c.rolled=true; itemsIn(c.grid,list); }
  for(const g of items.slice()){ scene.remove(g.m); } items.length=0;
  for(const g of S.ground){ const it=mkItem(g.it.key,g.it.n,{mag:g.it.mag,mods:g.it.mods}); dropGround(it,g.x,g.z,g.L); }
  for(const st of S.strs){ const fp=footprint(st.type,st.cx,st.cz,st.rot); const X=addStruct(st.type,st.L,fp,st.rot); X.hp=st.hp; X.belt=st.belt||0; }
  for(const [e,t,hp,max] of S.edges){ setEdgeType(e,t); ED.hp[e]=hp; if(max) ED.max[e]=max; }
  S.segs.forEach((a,k)=>{ const g=segs[k]; if(!g) return; g.hp=a[0]; g.max=a[1]; if(g.alive!==a[2]) setSegAlive(g,a[2]); });
  for(const v of survivors.slice()){ scene.remove(v.mesh); } survivors.length=0;
  for(const v of S.surv){ const sv=survivorAt(v.d,v.x,v.z,v.L,MAP.blds[v.b]); sv.help=v.help; }
  for(const a of S.z){ const i=spawnZ(a[0],a[1],a[3],a[5],a[6],a[2]); if(i>=0){ zhp[i]=a[4]; ztx[i]=a[7]; ztz[i]=a[8]; zwt[i]=a[2]; } }
  // the light and the fog for the time of day
  if(G.phase==='day') setFogTarget('day'); else if(G.phase==='dawn') setFogTarget('dawn'); else { setFogTarget('night'); placeFlares(); }
  minimapDirty=true; renderCards();
  bannerShow((G.phase==='day'?'DAY ':'NIGHT ')+G.night,'Picked up where you left off.',2.5);
}

/* ---------- the pause menu ---------- */
const pauseEl=document.getElementById('pause');
function pauseOpen(){
  G.paused=true; pauseEl.hidden=false;
  pauseEl.innerHTML=`<div class="box"><h1>PAUSED</h1><p class="sub">${(G.phase==='day'?'Day ':'Night ')+G.night} · ${clockStr()} · ${WX_NAME[WX.kind]}</p>
    <div class="col"><button data-a="resume">RESUME</button><button data-a="save">SAVE</button><button data-a="load" ${hasSave()?'':'disabled'}>LOAD LAST SAVE</button>
    <button data-a="export">SAVE TO FILE</button><label class="file">LOAD FROM FILE<input type="file" accept=".json,application/json" id="impFile"></label>
    ${typeof settingsOpen==='function'?'<button data-a="settings">SETTINGS</button>':''}<button data-a="quit">QUIT TO TITLE</button></div>
    <div class="sub">THE BOARD</div>${boardHTML()}</div>`;
  pauseEl.querySelectorAll('button[data-a]').forEach(b=>b.onclick=()=>{ const a=b.dataset.a;
    if(a==='resume') pauseClose(); else if(a==='save'){ saveGame(); pauseOpen(); } else if(a==='load') loadAndRestart(); else if(a==='export') exportSave();
    else if(a==='settings') settingsOpen(); else if(a==='quit'){ saveGame(true); location.reload(); } });
  document.getElementById('impFile').onchange=e=>{ if(e.target.files[0]) importSave(e.target.files[0]); };
}
function pauseClose(){ G.paused=false; pauseEl.hidden=true; bannerShow('','',0.01); }
