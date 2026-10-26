'use strict';
// Fog Line — Game state, phases, combat, input, soldier and zombie AI, HUD, overlay, main loop, boot.
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- game state ---------- */
const G={shake:0,mist:0.3,ashK:0.55,gust:0,gustT:0,gustTarget:0.2,phase:'day',t:0,night:1,anchorX:200,anchorSpeed:2.6,noise:0,weaponsFree:true,order:'hold',lightsOn:true,
  fogNear:18,fogFar:75,dead:false,paused:false,started:false,camH:68,camHTarget:68,afterPass:0,kills:0,peel:0.003,mapOpen:false};
const fogT={near:18,far:75,col:new THREE.Color(0x3a3631),amb:0.62,moon:0.75,ambCol:new THREE.Color(0x66707e),sunCol:new THREE.Color(0xe6e0d2),sunOff:new THREE.Vector3(-55,95,-35),mist:0.3,ash:0.55};
let time=0;

function bannerShow(t,s,dur=3.2){
  const b=document.getElementById('banner'); document.getElementById('bannerT').textContent=t; document.getElementById('bannerS').textContent=s||'';
  b.style.opacity=1; clearTimeout(bannerShow._h); bannerShow._h=setTimeout(()=>b.style.opacity=0,dur*1000);
}
const radioEl=document.getElementById('radio');
function radio(msg){
  const d=document.createElement('div'); d.textContent=msg; radioEl.appendChild(d);
  while(radioEl.children.length>4) radioEl.firstChild.remove();
  setTimeout(()=>{d.style.opacity=0;setTimeout(()=>d.remove(),1300);},9000);
}
const NIGHT_LINES=[
  'Kowalski tried battalion net. Static.',
  'Scheduled check-in, 0400. No answer.',
  'Dunn swears he heard rotors to the south. Nobody else did.',
  'Hale counted the MREs again.',
  'Somebody on a civilian band reading street names. Then nothing.',
  'Reyes logged the night in the notebook. Day eleven.',
];

function setFogTarget(kind){
  if(kind==='day'){fogT.near=18;fogT.far=78;fogT.col.setHex(0x4a4843);fogT.amb=0.85;fogT.moon=1.15;fogT.ambCol.setHex(0x6a7482);fogT.sunCol.setHex(0xeee6d4);fogT.sunOff.set(-48,100,-30);fogT.mist=0.28;fogT.ash=0.5;}
  else if(kind==='dawn'){fogT.near=12;fogT.far=50;fogT.col.setHex(0x5a4a46);fogT.amb=0.5;fogT.moon=0.95;fogT.ambCol.setHex(0x86767a);fogT.sunCol.setHex(0xffb488);fogT.sunOff.set(-95,32,-12);fogT.mist=0.65;fogT.ash=0.6;}
  else {fogT.near=5;fogT.far=24;fogT.col.setHex(0x23201d);fogT.amb=0.3;fogT.moon=0.5;fogT.ambCol.setHex(0x4e5a6e);fogT.sunCol.setHex(0xa9b9d6);fogT.sunOff.set(-72,58,-50);fogT.mist=0.95;fogT.ash=1;}
}
function despawnAll(onlyCalm){
  for(let i=0;i<MAXZ;i++){ if(!zst[i]) continue; if(onlyCalm&&zst[i]===3) continue; killZ(i,false); }
}
function startDay(){
  G.phase='day'; G.t=G.night===1?35:28; setFogTarget('day'); for(const f of flares){ f.on=false; f.m.visible=false; }
  despawnAll(false);
  if(G.night>1){
    let found=0;
    for(const s of squad){ if(!s.alive) continue; s.hp=Math.min(100,s.hp+35); s.stress*=0.3; s.res+=45; found+=45; }
    bannerShow('DAY '+G.night,'The fog thinned out. The squad is fixing the line.');
    radio('Pulled '+found+' rounds out of the bus wreck. Ammo topped up.');
  } else {
    bannerShow('DAY 1','Wolcott & 18th. Build the line before dark.',4);
  }
  // a few dead wander the neighborhood by day
  for(let k=0;k<26;k++){ const p=randomStreetSpot(40); if(p) spawnZ(p.x,p.z,4,0,0); }
}
function startDusk(){
  G.phase='dusk'; G.t=11; setFogTarget('night'); placeFlares();
  bannerShow('FOG ROLLING IN','Get on the line.');
  radio(NIGHT_LINES[(G.night-1)%NIGHT_LINES.length]);
}
function startNight(){
  G.phase='night'; G.afterPass=0;
  G.anchorX=150; G.anchorSpeed=2.4+G.night*0.25;
  G.peel=0.0025+G.night*0.0012;
  const n=Math.min(MAXZ-60,120+G.night*55);
  for(let k=0;k<n;k++){
    const ox=rand(-30,30), oz=rand(-6,6);
    spawnZ(G.anchorX+ox,-32+oz,1,ox,oz);
  }
  const strag=10+G.night*3;
  for(let k=0;k<strag;k++){ const p=randomStreetSpot(30); if(p) spawnZ(p.x,p.z,4,0,0); }
  bannerShow('NIGHT '+G.night,'The horde is moving along 18th. Let it pass.',4);
}
function startDawn(){
  G.phase='dawn'; G.t=9; setFogTarget('dawn');
  despawnAll(true);
  bannerShow('IT PASSED','Dawn on day '+(G.night+1)+'.');
  G.night++;
}
// a street or alley cell at least `away` metres from the compound
function randomStreetSpot(away){
  for(let t=0;t<40;t++){
    const x=rand(-108,108), z=rand(-142,126), cx=Math.floor(x), cz=Math.floor(z), c=CI(cx,cz);
    const s=MAP.surf[0][c]; if(MAP.bld[0][c]>=0||MAP.block[0][c]!==BLK.FREE) continue;
    if(!(s===SURF.ASPHALT||s===SURF.ALLEY||s===SURF.CONCRETE||s===SURF.GRASS)) continue;
    if(Math.hypot(x-0,z-15)<away) continue;
    return {x,z};
  }
  return null;
}

function spawnZ(x,z,state,ox,oz,L){
  for(let i=0;i<MAXZ;i++){ if(zst[i]) continue;
    zx[i]=x; zz[i]=z; zvx[i]=0; zvz[i]=0; zhp[i]=rand(80,120); zst[i]=state; zox[i]=ox; zoz[i]=oz;
    zspd[i]=rand(.8,1.2); zph[i]=Math.random()*10; zcd[i]=0; zmoan[i]=0; zang[i]=-Math.PI/2; ztgt[i]=-1;
    ztx[i]=x; ztz[i]=z; zwt[i]=0; zfl[i]=0; zgib[i]=0; zdrip[i]=0; dressZ(i);
    zl[i]=L||0; zyv[i]=(L||0)*LH; ztr[i]=null; zLosT[i]=Math.random()*0.3; zDirect[i]=0; zSees[i]=-1;
    const r=Math.random(); zvar[i]=r<.07?3:r<.2?2:r<.32?1:0;
    zsc[i]=zvar[i]===1?rand(1.12,1.24):rand(.9,1.04);
    zhunch[i]=zvar[i]===1?rand(.1,.3):rand(.25,.75);
    zarmL[i]=Math.random()<.35?1:0; zarmR[i]=Math.random()<.35?1:0; ztilt[i]=rand(-.35,.35);
    if(zvar[i]===3){ zhp[i]*=0.6; zspd[i]*=0.5; }
    if(zvar[i]===1){ zhp[i]*=1.6; zspd[i]*=0.85; }
    if(zbody[i]===1){ zhp[i]*=1.5; zspd[i]*=0.8; } else if(zbody[i]===2){ zspd[i]*=1.1; }
    return i;
  }
  return -1;
}
function killZ(i,corpse=true){
  if(!corpse||zst[i]===5){ zst[i]=0; ztr[i]=null; hideZ(i); return; }
  G.kills++;
  zst[i]=5; zdie[i]=0; ztr[i]=null;
  if(!zdx[i]&&!zdz[i]){ zdx[i]=Math.sin(zang[i]+Math.PI); zdz[i]=Math.cos(zang[i]+Math.PI); }
  const fwd=Math.sin(zang[i])*zdx[i]+Math.cos(zang[i])*zdz[i];
  zfall[i]=fwd>0?1:-1;
  const gp=zgib[i], y=zyv[i];
  if(gp===1){ zmiss[i]|=4; gib('head',i,zx[i],y+1.65*zsc[i],zz[i],zdx[i],zdz[i]); }
  else if(gp===2){ zmiss[i]|=8; gib('armL',i,zx[i]-0.3,y+1.3,zz[i],zdx[i],zdz[i]); }
  else if(gp===3){ zmiss[i]|=16; gib('armR',i,zx[i]+0.3,y+1.3,zz[i],zdx[i],zdz[i]); }
}
function updateDying(i,dt){
  zdie[i]+=dt; const u=Math.min(1,zdie[i]/0.55);
  poseDying(i,u);
  if(u>=1){
    pool(zx[i]+zdx[i]*0.8,zz[i]+zdz[i]*0.8,rand(1.0,1.8),zyv[i]);
    const ps=squad[me]; if(Math.hypot(zx[i]-ps.x,zz[i]-ps.z)<16) sThud(0.18);
    freezeCorpse(i); zst[i]=0; hideZ(i);
  }
}

/* noise: everything that hears it comes to look. Loud noise also seeds a flow field so the dead can
   find their way around walls, through yards and up stairs toward it. */
const noiseSrc=[]; const noiseF=new FlowField(84); let noiseDirty=false, noiseBuiltT=-9;
function makeNoise(x,z,r,L){
  L=L||0;
  if(indoors(L,x,z)) r*=0.6;
  G.noise=Math.min(1,G.noise+r/60);
  scareBirds(x,z,r*0.8); if(r>20) for(const w of litWindows) if(Math.hypot(w.z-z,w.x-x)<70&&Math.random()<.5) w.off=rand(40,110);
  if(r>=10){ noiseSrc.push({x,z,L,t:time}); while(noiseSrc.length>6) noiseSrc.shift(); noiseDirty=true; }
  const r2=r*r;
  for(let i=0;i<MAXZ;i++){
    const st=zst[i]; if(st===0||st===3||st===5) continue;
    const dx=zx[i]-x, dz=zz[i]-z; if(dx*dx+dz*dz>r2) continue;
    zst[i]=2; ztx[i]=x+rand(-3,3); ztz[i]=z+rand(-3,3); zwt[i]=L;
  }
}
function noiseField(){
  for(let k=noiseSrc.length-1;k>=0;k--) if(time-noiseSrc[k].t>9) noiseSrc.splice(k,1);
  if(noiseDirty&&time-noiseBuiltT>0.7&&noiseSrc.length){
    buildField(noiseF,noiseSrc.slice().reverse().map(n=>[n.L,Math.floor(n.x),Math.floor(n.z)]),MODE.ZOMBIE,2000);
    noiseBuiltT=time; noiseDirty=false;
  }
  return noiseSrc.length?noiseF:null;
}
function moan(i){
  if(zmoan[i]>0) return; zmoan[i]=4;
  const s=squad[me]; sMoan(Math.hypot(zx[i]-s.x,zz[i]-s.z));
  eachNear(zx[i],zz[i],8,j=>{
    if(j===i||zl[j]!==zl[i]) return; const st=zst[j]; if(st===1||st===4){ if(Math.random()<.65){ zst[j]=2; ztx[j]=zx[i]+rand(-2,2); ztz[j]=zz[i]+rand(-2,2); zwt[j]=zl[i];} }
  });
}

/* ---------- doors, windows and things breaking ---------- */
let lastBash=0;
function onDoorOpened(e,p,loud){ if(!AC) return; const s=squad[me]; const d=Math.hypot(p.x-s.x,p.z-s.z); if(d<20) SFX.creak(0,0.6/(1+d*0.25)); }
function onEdgeHit(e,amt){
  const now=performance.now(); if(now-lastBash<260) return; lastBash=now;
  const p=edgeMid(e), y=p.L*LH, s=squad[me], d=Math.hypot(p.x-s.x,p.z-s.z);
  if(d<30){ sThud(0.35/(1+d*0.12)); }
  chips(p.x,y+rand(0.6,1.6),p.z,2,0,0,ED.t[e]===ET.FENCE?0x8a9096:0x6a5a44);
}
function onEdgeBroken(e,was){
  const p=edgeMid(e), y=p.L*LH, s=squad[me], d=Math.hypot(p.x-s.x,p.z-s.z);
  if(was===ET.WIN){ glassBurst(p.x,y+1.5,p.z); if(AC&&d<40) SFX.glass(clamp((p.x-s.x)/20,-1,1)); makeNoise(p.x,p.z,18,p.L); }
  else { chips(p.x,y+1,p.z,10,0,0,0x6a5a44); emit(false,p.x,y+0.8,p.z,0,0.6,0,1.4,0.5,2.2,0x8a8680,0.5); if(AC&&d<40) sThud(0.6/(1+d*0.08)); makeNoise(p.x,p.z,16,p.L); }
  if(was===ET.DOOR||was===ET.BOARD) radioLine(d<25?'They broke through a door close by.':'Something gave way out there.');
}
function glassBurst(x,y,z){ for(let k=0;k<10;k++) chips(x,y,z,1,rand(-1,1),rand(-1,1),0x9ab4c8); }
function breakGlass(e){ if(ED.t[e]!==ET.WIN) return; ED.hp[e]=0; setEdgeType(e,ET.WINB); onEdgeBroken(e,ET.WIN); }
// the nearest door to (x,z) on level L within r metres
function nearestDoor(L,x,z,r){
  let best=0, bd=r;
  for(let cz=Math.floor(z)-2;cz<=Math.floor(z)+2;cz++) for(let cx=Math.floor(x)-2;cx<=Math.floor(x)+2;cx++){
    if(!inMap(cx,cz)) continue; const c=CI(cx,cz);
    for(const e of [MAP.eE[L][c],MAP.eS[L][c]]){ if(!e) continue; const t=ED.t[e]; if(t!==ET.DOOR&&t!==ET.DOPEN) continue;
      const p=edgeMid(e), d=Math.hypot(p.x-x,p.z-z); if(d<bd){ bd=d; best=e; } }
  }
  return best;
}
function toggleDoor(e){
  const p=edgeMid(e);
  if(ED.t[e]===ET.DOPEN){
    // don't shut it on anyone standing in the doorway
    for(const s of squad) if(s.alive&&s.L===p.L&&Math.hypot(s.x-p.x,s.z-p.z)<0.55) return;
    for(let i=0;i<MAXZ;i++) if(zst[i]&&zst[i]!==5&&zl[i]===p.L&&Math.hypot(zx[i]-p.x,zz[i]-p.z)<0.6) return;
    setEdgeType(e,ET.DOOR); if(AC) SFX.creak(0,0.5);
  } else openDoor(e,false);
}

/* ---------- combat ---------- */
function flashAt(x,z,y){ const f=flashes[flashIdx]; const ms=muzzle[flashIdx], Lf=flashIdx?FL.mz1:FL.mz0; flashIdx=(flashIdx+1)%flashes.length; y=y||0;
  f.l.position.set(x,y+1.6,z); f.l.intensity=3.6; f.t=0.06;
  ms.position.set(x,y+1.5,z); ms.material.rotation=rand(0,6); ms.scale.setScalar(rand(1.6,2.3)); ms.visible=true; Lf.x=x; Lf.z=z; Lf.y=y+1.5; Lf.k=1; }
function damageZ(j,dmg,fromX,fromZ){
  if(zst[j]===5) return;
  zhp[j]-=dmg; zfl[j]=1;
  const dx=zx[j]-fromX, dz=zz[j]-fromZ, d=Math.hypot(dx,dz)||1;
  if(!ztr[j]){ zx[j]+=dx/d*0.18; zz[j]+=dz/d*0.18; }
  zdx[j]=dx/d; zdz[j]=dz/d;
  bleed(zx[j],dmg>=200?1.6*zsc[j]:rand(1,1.4),zz[j],dx/d,dz/d,dmg>=200?22:9,dmg>=200?4:2.6,zyv[j]);
  if(zhp[j]<=0){
    if(dmg>=200&&!(zmiss[j]&4)&&Math.random()<.75) zgib[j]=1;
    else if(Math.random()<.14){ const L=Math.random()<.5; if(!(zmiss[j]&(L?9:18))) zgib[j]=L?2:3; }
  }
  if(zhp[j]<=0){ killZ(j,true); return; }
  if(zst[j]!==3){ zst[j]=2; ztx[j]=fromX; ztz[j]=fromZ; }
}
// can a shooter on level L hit a zombie at index j? Same floor, or from up high onto the street
function shootable(L,j){ return zl[j]===L||(L>0&&zl[j]===0&&!ztr[j]&&MAP.bld[0][CI(Math.floor(zx[j]),Math.floor(zz[j]))]<0); }
const shotTest=(e)=>{ const t=ED.t[e]; if(t===ET.WIN){ breakGlass(e); return false; } return SHOTB[t]===1; };
function fire(s,ang,targetJ){
  s.mag--; s.recoil=1; const isMe=s.i===me; eject(s);
  s.fireCD=isMe?0.13:rand(0.34,0.52);
  const L=s.L, y=s.y, mx=s.x+Math.sin(ang)*0.75, mz=s.z+Math.cos(ang)*0.75;
  let a=ang;
  if(isMe){ const moving=Math.hypot(s.vx,s.vz)>0.5; a=ang+randn()*((moving?0.06:0.022)+s.stress*0.0007); }
  else if(targetJ>=0){ const d=Math.hypot(zx[targetJ]-mx,zz[targetJ]-mz); const chance=clamp(s.acc-s.stress*0.003-d*0.008,0.12,0.92);
    a=Math.atan2(zx[targetJ]-mx,zz[targetJ]-mz)+(Math.random()<chance?0:rand(.06,.14)*(Math.random()<.5?-1:1)); }
  const fx_=Math.sin(a), fz_=Math.cos(a), RANGE=36;
  const R=gridRay(L,mx,mz,mx+fx_*RANGE,mz+fz_*RANGE,shotTest);
  const wallT=R.t*RANGE, wall=R.blocked, wx=R.x, wz=R.z;
  let best=wallT,bj=-1;
  for(let j=0;j<MAXZ;j++){ if(!zst[j]||zst[j]===5||!shootable(L,j)) continue;
    const dx=zx[j]-mx, dz=zz[j]-mz, t=dx*fx_+dz*fz_; if(t<0||t>best) continue;
    if(Math.abs(dx*fz_-dz*fx_)<0.5){best=t;bj=j;}
  }
  let ex=mx+fx_*best, ez=mz+fz_*best;
  if(bj>=0) damageZ(bj,Math.random()<(isMe?.24:.2)?200:36,s.x,s.z);
  else if(wall){ impact(wx,wz,y,fx_,fz_,true); ex=wx; ez=wz; }
  else if(L===0) impact(ex,ez,0,fx_,fz_,false);
  tracer(mx,mz,ex,ez,y); flashAt(mx,mz,y);
  if(isMe) G.shake=Math.max(G.shake,0.16);
  const ps=squad[me]; sGun(Math.hypot(s.x-ps.x,s.z-ps.z));
  makeNoise(s.x,s.z,44,L);
}
function shove(s){
  if(s.meleeCD>0) return; s.meleeCD=0.6; s.shoveT=0.25;
  const fx_=Math.sin(s.ang), fz_=Math.cos(s.ang); let hit=false;
  eachNear(s.x,s.z,2.2,j=>{
    if(zl[j]!==s.L||zst[j]===5) return;
    const dx=zx[j]-s.x, dz=zz[j]-s.z, d=Math.hypot(dx,dz); if(d>1.9||d<1e-3) return;
    if((dx*fx_+dz*fz_)/d<0.25) return;
    zx[j]+=dx/d*1.3; zz[j]+=dz/d*1.3; zhp[j]-=48*s.melee; hit=true; zdx[j]=dx/d; zdz[j]=dz/d;
    bleed(zx[j],1.2,zz[j],dx/d,dz/d,4,1.5,zyv[j]);
    if(zhp[j]<=0) killZ(j,true);
  });
  sThud(hit?0.5:0.2);
  if(hit) makeNoise(s.x,s.z,5,s.L);
}
function reload(s){ if(s.reloadT>0||s.mag>=30||s.res<=0) return; s.reloadT=2.1; }

/* ---------- input ---------- */
const keys={}; let mouseX=innerWidth/2, mouseY=innerHeight/3, mouseDown=false, touchMode=false;
const ray=new THREE.Raycaster(), groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.2), hitV=new THREE.Vector3(), ndc=new THREE.Vector2();
function act(k){
  const s=squad[me];
  if(k==='1'){G.order='hold';radioLine('Hold the line.');}
  else if(k==='2'){G.order='follow';radioLine('On me.');}
  else if(k==='3'){G.order='fallback';radioLine('Back to the shop.');}
  else if(k==='4'){G.weaponsFree=!G.weaponsFree; for(const b of squad) if(b.i!==me) b.lightOn=G.weaponsFree; radioLine(G.weaponsFree?'Weapons free.':'Hold fire. Lights off. Quiet.');}
  else if(k==='q') swap();
  else if(k==='r') reload(s);
  else if(k==='v') shove(s);
  else if(k==='f') s.lightOn=!s.lightOn;
  else if(k==='e'){ if(!nearDamagedSeg(s)){ const e=nearestDoor(s.L,s.x,s.z,1.6); if(e) toggleDoor(e); } }
  else if(k==='l'){G.lightsOn=!G.lightsOn; bannerShow(G.lightsOn?'LIGHTS UP':'LIGHTS OUT','',1.4);}
  else if(k==='h'){const el=document.getElementById('keys'); el.hidden=!el.hidden;}
  else if(k==='z'){G.camHTarget=G.camHTarget>90?68:115;}
  else if(k==='m'){ G.mapOpen=!G.mapOpen; document.getElementById('bigmap').hidden=!G.mapOpen; if(G.mapOpen) drawBigMap(); }
  else if(k==='enter'){ if(G.phase==='day') G.t=0; }
  else if(k==='p'){ userScaleBias=(userScaleBias+1)%3; resize(); }
}
let lastOrderMsg=0;
function radioLine(m){ const n=performance.now(); if(n-lastOrderMsg>400){ radio(m); lastOrderMsg=n; } }
addEventListener('keydown',e=>{
  if(!G.started) return;
  const k=e.key.toLowerCase(); if(keys[k]) return; keys[k]=true;
  if(k==='escape'){ if(G.mapOpen){ act('m'); return; } G.paused=!G.paused; bannerShow(G.paused?'PAUSED':'', G.paused?'Esc to resume':'',G.paused?9999:0.1); return;}
  act(k);
});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
addEventListener('blur',()=>{for(const k in keys) keys[k]=false; mouseDown=false;});
glCanvas.addEventListener('contextmenu',e=>e.preventDefault());
glCanvas.addEventListener('wheel',e=>{e.preventDefault(); G.camHTarget=clamp(G.camHTarget+Math.sign(e.deltaY)*8,40,140);},{passive:false});

const sticks={move:null,aim:null};
glCanvas.addEventListener('pointerdown',e=>{
  initAudio();
  if(e.pointerType==='touch'){
    if(!touchMode){touchMode=true;document.body.classList.add('touch');}
    const st={id:e.pointerId,ox:e.clientX,oy:e.clientY,x:e.clientX,y:e.clientY};
    if(e.clientX<innerWidth/2){ if(!sticks.move) sticks.move=st; } else { if(!sticks.aim) sticks.aim=st; }
    return;
  }
  if(e.button===2) shove(squad[me]); else mouseDown=true;
});
addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'){ for(const k of ['move','aim']){const s=sticks[k]; if(s&&s.id===e.pointerId){s.x=e.clientX;s.y=e.clientY;}} return; }
  mouseX=e.clientX; mouseY=e.clientY;
});
const endPtr=e=>{
  if(e.pointerType==='touch'){ for(const k of ['move','aim']){const s=sticks[k]; if(s&&s.id===e.pointerId) sticks[k]=null;} return; }
  if(e.button!==2) mouseDown=false;
};
addEventListener('pointerup',endPtr); addEventListener('pointercancel',endPtr);
const tb=(id,fn)=>document.getElementById(id).addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();initAudio();fn();});
tb('tHold',()=>act('1')); tb('tFollow',()=>act('2')); tb('tBack',()=>act('3')); tb('tQuiet',()=>act('4')); tb('tLights',()=>act('l'));
tb('tShove',()=>act('v')); tb('tReload',()=>act('r')); tb('tSwap',()=>act('q')); tb('tZoom',()=>act('z')); tb('tDay',()=>act('enter'));
let touchFix=false;
const fixBtn=document.getElementById('tFix');
fixBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();touchFix=true;});
['pointerup','pointercancel','pointerleave'].forEach(ev=>fixBtn.addEventListener(ev,()=>touchFix=false));

function swap(){
  for(let k=1;k<=squad.length;k++){ const n=(me+k)%squad.length; if(squad[n].alive){ squad[me].lightOn=G.weaponsFree; me=n; squad[me].lightOn=true; return; } }
}

/* ---------- segment helpers ---------- */
function segAt(x,z,pad){ for(const s of segs){ if(!s.alive) continue; if(x>s.x0-pad&&x<s.x1+pad&&z>s.z0-pad&&z<s.z1+pad) return s; } return null; }
function setSegAlive(s,alive){ s.alive=alive; s.mesh.visible=alive; lineCells(s,alive); }
function nearDamagedSeg(s){ if(s.L!==0) return null; for(const g of segs){ if(g.hp>=g.max) continue; const cx=clamp(s.x,g.x0,g.x1), d=Math.hypot(s.x-cx,s.z-BZ); if(d<3.2) return g; } return null; }
function repairNear(s,amount,noisy){
  const best=nearDamagedSeg(s); if(!best) return false;
  best.hp=Math.min(best.max,best.hp+amount); if(!best.alive&&best.hp>best.max*0.25) setSegAlive(best,true);
  if(noisy){ G._ham=(G._ham||0)+amount; if(G._ham>40){G._ham=0; makeNoise(s.x,s.z,16); sThud(0.25);} }
  return true;
}

/* ---------- per-frame: soldiers ---------- */
function inLight(s){
  if(s.L!==0) return false;
  if(G.lightsOn){ if(Math.hypot(s.x-LIGHT_WORK.x,s.z-LIGHT_WORK.z)<11) return true; if(Math.hypot(s.x-LIGHT_BARREL.x,s.z-LIGHT_BARREL.z)<7) return true; }
  return Math.hypot(s.x-DOOR.x,s.z-DOOR.z)<5;
}
function moveSoldier(s,dx,dz,speed,dt){
  if(s.trav){ travStep(s,dt,speed*0.9); s.y=agentY(s); s.vx*=0.9; s.vz*=0.9; return; }
  if(s.hp<45) speed*=0.8;
  const seg=s.L===0?segAt(s.x,s.z,0.1):null; if(seg) speed*=0.45;
  s.vx=lerp(s.vx,dx*speed,Math.min(1,dt*12)); s.vz=lerp(s.vz,dz*speed,Math.min(1,dt*12));
  moveAgent(s,s.vx*dt,s.vz*dt,0.33,AG.SOLDIER);
  if(s.L===0&&!s.trav) pushCircles(s,0.35);
  s.y=agentY(s);
}
// walk toward a goal on any floor: straight when the way is clear, otherwise down a flow field
function navTo(s,gx,gz,gL,speed,dt){
  if(s.trav){ moveSoldier(s,0,0,speed,dt); return false; }
  const d=Math.hypot(gx-s.x,gz-s.z);
  if(s.L===gL&&d<0.4){ s.vx*=0.8; s.vz*=0.8; return true; }
  let tx=gx, tz=gz;
  if(!(s.L===gL&&d<30&&walkLine(s.L,s.x,s.z,gx,gz))){
    const key=gL+':'+Math.floor(gx)+':'+Math.floor(gz);
    if(!s.field) s.field=new FlowField(60);
    if(s.field.key!==key||time-s.field.t>3){ buildField(s.field,[[gL,Math.floor(gx),Math.floor(gz)]],MODE.SOLDIER,1400); s.field.key=key; s.field.t=time; }
    const st=fieldStep(s.field,s.L,s.x,s.z); if(st){ tx=st.x; tz=st.z; }
  }
  const dx=tx-s.x, dz=tz-s.z, dl=Math.hypot(dx,dz)||1;
  moveSoldier(s,dx/dl,dz/dl,speed*(d<2?0.75:1),dt);
  return false;
}
function updatePlayer(s,dt){
  let mx=0,mz=0;
  if(keys['w']||keys['arrowup']) mz-=1; if(keys['s']||keys['arrowdown']) mz+=1;
  if(keys['a']||keys['arrowleft']) mx-=1; if(keys['d']||keys['arrowright']) mx+=1;
  let firing=mouseDown;
  if(sticks.move){ const dx=sticks.move.x-sticks.move.ox, dy=sticks.move.y-sticks.move.oy, m=Math.hypot(dx,dy); if(m>6){const k=Math.min(1,m/60)/m; mx=dx*k; mz=dy*k;} }
  const ml=Math.hypot(mx,mz); if(ml>1){mx/=ml;mz/=ml;}
  moveSoldier(s,mx,mz,4.3,dt);
  if(touchMode){
    if(sticks.aim){ const dx=sticks.aim.x-sticks.aim.ox, dy=sticks.aim.y-sticks.aim.oy, m=Math.hypot(dx,dy); if(m>12) s.ang=Math.atan2(dx,dy); firing=m>48; }
    else if(ml>0.2) s.ang=Math.atan2(mx,mz);
    if(firing&&!sticks.aim) firing=false;
  } else {
    groundPlane.constant=-(s.y+1.2);
    ndc.set(mouseX/innerWidth*2-1,-(mouseY/innerHeight)*2+1); ray.setFromCamera(ndc,camera);
    if(ray.ray.intersectPlane(groundPlane,hitV)) s.ang=Math.atan2(hitV.x-s.x,hitV.z-s.z);
  }
  if(firing&&s.fireCD<=0&&s.reloadT<=0&&!G.mapOpen){ if(s.mag>0) fire(s,s.ang,-1); else { reload(s); s.fireCD=0.3; } }
  if(keys['e']||touchFix) repairNear(s,70*dt,G.phase!=='day');
  s.status=s.reloadT>0?'RELOAD':'YOU';
}
// nearest zombie this soldier can actually see
function pickTarget(s,R){
  let bj=-1,bd=R*R; const cand=[];
  for(let j=0;j<MAXZ;j++){ if(!zst[j]||zst[j]===5||!shootable(s.L,j)) continue; const ex=zx[j]-s.x, ez=zz[j]-s.z, d2=ex*ex+ez*ez; if(d2<bd) cand.push([d2,j]); }
  cand.sort((a,b)=>a[0]-b[0]);
  for(let k=0;k<Math.min(5,cand.length);k++){ const j=cand[k][1]; if(los(s.L,s.x,s.z,zx[j],zz[j])) return j; }
  return bj;
}
function updateBuddy(s,dt){
  const p=squad[me];
  let gx=s.post.x, gz=s.post.z, gL=0;
  if(G.order==='follow'){ const sl=FOLLOW_SLOTS[(s.i-me+3)%4]||FOLLOW_SLOTS[0]; gx=p.x+sl.x; gz=p.z+sl.z; gL=p.L;
    if(!cellWalk(gL,Math.floor(gx),Math.floor(gz))){ gx=p.x; gz=p.z; } }
  else if(G.order==='fallback'){ const sp=BACK_SPOTS[s.i]; gx=sp.x; gz=sp.z; }
  let fixing=false;
  if(G.phase==='day'&&G.order==='hold'){
    let worst=null; for(const g of segs) if(g.hp<g.max&&(!worst||g.hp/g.max<worst.hp/worst.max)) worst=g;
    if(worst){ gx=clamp((worst.x0+worst.x1)/2+(s.i-1.5)*0.8,worst.x0+0.5,worst.x1-0.5); gz=BZ+1.6; gL=0; fixing=true; }
  }
  const d=Math.hypot(gx-s.x,gz-s.z);
  navTo(s,gx,gz,gL,d>6?4.4:3.2,dt);
  if(fixing&&d<1.6) repairNear(s,40*dt,false);
  // find a target
  s.aimT=(s.aimT||0)-dt;
  if(s.aimT<=0){ s.aimT=0.25; s.aimJ=pickTarget(s,Math.min(26,G.fogFar*1.05+3)); }
  let bj=s.aimJ??-1; if(bj>=0&&(!zst[bj]||zst[bj]===5)) bj=-1;
  const td=bj>=0?Math.hypot(zx[bj]-s.x,zz[bj]-s.z):99;
  let want=d>0.6?Math.atan2(s.vx,s.vz):s.ang;
  if(bj>=0) want=Math.atan2(zx[bj]-s.x,zz[bj]-s.z);
  let da=want-s.ang; while(da>Math.PI) da-=Math.PI*2; while(da<-Math.PI) da+=Math.PI*2; s.ang+=da*Math.min(1,dt*8);
  if(!G.weaponsFree&&s.stress>85&&s.panic<=0&&bj>=0&&Math.random()<dt*0.45){ s.panic=1.4; radio(s.short.charAt(0)+s.short.slice(1).toLowerCase()+' is losing it.'); }
  if(s.panic>0) s.panic-=dt;
  s.status=fixing?'REPAIR':G.order==='follow'?'FOLLOW':G.order==='fallback'?'FALL BACK':'HOLD';
  if(s.reloadT>0){ s.status='RELOAD'; return; }
  if(bj>=0&&td<1.8&&s.meleeCD<=0&&Math.abs(da)<0.8){ shove(s); return; }
  const canFire=(G.weaponsFree||s.panic>0)&&bj>=0&&Math.abs(da)<0.25&&s.fireCD<=0&&!s.trav;
  if(!G.weaponsFree) s.status=s.panic>0?'PANIC':'QUIET';
  if(canFire){ if(s.mag>0) fire(s,s.ang,bj); else reload(s); }
  else if(bj<0&&s.mag<12&&s.res>0) reload(s);
}

/* ---------- per-frame: zombies ---------- */
const zA={x:0,z:0,L:0,trav:null};
const chaseF=[];
function chaseField(k){
  let F=chaseF[k]; if(!F) F=chaseF[k]=new FlowField(64);
  const s=squad[k], key=s.L+':'+Math.floor(s.x)+':'+Math.floor(s.z);
  if((F.key!==key&&time-F.t>0.4)||time-F.t>2.5){ buildField(F,[[s.L,Math.floor(s.x),Math.floor(s.z)]],MODE.ZOMBIE,1600); F.key=key; F.t=time; }
  return F;
}
function updateZombies(dt){
  rebuildGrid();
  const nightMul=1+(G.night-1)*0.07;
  for(const s of squad){ s.near=0; s.sight=s.alive?(6.5+(s.lightOn?7.5:0)+(inLight(s)?6:0))*(G.fogFar<35?0.9:1.25):0; }
  const NF=noiseField();
  for(let i=0;i<MAXZ;i++){
    const st=zst[i]; if(!st) continue;
    if(st===5){ updateDying(i,dt); continue; }
    zA.x=zx[i]; zA.z=zz[i]; zA.L=zl[i]; zA.trav=ztr[i];
    // on the stairs or climbing through a window
    if(zA.trav){
      const T=zA.trav; travStep(zA,dt,T.climb?1.5:1.6*zspd[i]);
      zx[i]=zA.x; zz[i]=zA.z; zl[i]=zA.L; ztr[i]=zA.trav;
      zyv[i]=T.climb?zl[i]*LH+Math.sin(Math.min(1,T.t)*Math.PI)*0.55:agentY(zA);
      zph[i]+=dt*3; drawZ(i,1.0,dt); continue;
    }
    zyv[i]=zl[i]*LH;
    let x=zx[i], z=zz[i]; const L=zl[i];
    zmoan[i]-=dt; zcd[i]-=dt; zLosT[i]-=dt;
    // senses: nearest soldier it can see on its own floor
    let bs=-1,bd2=1e9;
    for(let k=0;k<squad.length;k++){ const s=squad[k]; if(!s.alive||s.L!==L) continue; const dx=s.x-x, dz=s.z-z, d2=dx*dx+dz*dz; if(d2<64) s.near++; if(d2<bd2){bd2=d2;bs=k;} }
    const bd=Math.sqrt(bd2);
    if(zLosT[i]<=0){ zLosT[i]=0.22+Math.random()*0.1;
      zSees[i]=(bs>=0&&bd<squad[bs].sight&&los(L,x,z,squad[bs].x,squad[bs].z))?bs:-1;
      if(st===2) zDirect[i]=((zwt[i]|0)===L&&walkLine(L,x,z,ztx[i],ztz[i]))?1:0; }
    if(zSees[i]>=0&&st!==3){ zst[i]=3; ztgt[i]=zSees[i]; moan(i); }
    // goal
    let tx,tz,spd,wantE=0;
    const cs=zst[i];
    if(cs===1){
      tx=G.anchorX+zox[i]; tz=-32+zoz[i];
      const dd=Math.hypot(tx-x,tz-z); spd=clamp(dd*0.5,0.6,G.anchorSpeed*1.6)*zspd[i];
      if(Math.abs(x)<9&&Math.random()<G.peel*dt*60*0.016){ zst[i]=4; ztx[i]=rand(-10,10); ztz[i]=rand(-26,-17); zwt[i]=rand(6,14); }
      if(G.anchorX<-195&&x<-150){ killZ(i,false); continue; }
    } else if(cs===3){
      let s=squad[ztgt[i]]; if(!s||!s.alive){ zst[i]=4; zwt[i]=2; continue; }
      const sd=Math.hypot(s.x-x,s.z-z);
      if(zSees[i]<0&&sd>s.sight*1.8+10){ zst[i]=2; ztx[i]=s.x; ztz[i]=s.z; zwt[i]=s.L; }
      spd=2.25*zspd[i]*nightMul;
      if(s.L===L&&zSees[i]===ztgt[i]&&sd<16){ tx=s.x; tz=s.z; }
      else { const step=fieldStep(chaseField(ztgt[i]),L,x,z); if(step){ tx=step.x; tz=step.z; wantE=step.e; } else { tx=s.x; tz=s.z; } }
    } else if(cs===2){
      spd=1.7*zspd[i]*nightMul;
      const goalL=zwt[i]|0;
      if(Math.hypot(ztx[i]-x,ztz[i]-z)<2.2&&goalL===L){ zst[i]=4; zwt[i]=rand(4,9); ztx[i]=x+rand(-6,6); ztz[i]=z+rand(-6,6); tx=ztx[i]; tz=ztz[i]; }
      else {
        if(zDirect[i]){ tx=ztx[i]; tz=ztz[i]; }
        else { const step=NF?fieldStep(NF,L,x,z):null; if(step){ tx=step.x; tz=step.z; wantE=step.e; } else { tx=ztx[i]; tz=ztz[i]; } }
      }
    } else {
      tx=ztx[i]; tz=ztz[i]; spd=0.65*zspd[i];
      zwt[i]-=dt;
      if(zwt[i]<=0||Math.hypot(tx-x,tz-z)<1){ zwt[i]=rand(4,10); ztx[i]=x+rand(-7,7); ztz[i]=z+rand(-7,7);
        if(!walkLine(L,x,z,ztx[i],ztz[i])){ ztx[i]=x+rand(-2,2); ztz[i]=z+rand(-2,2); } }
    }
    let dx=tx-x, dz=tz-z; const dl=Math.hypot(dx,dz)||1; dx/=dl; dz/=dl;
    zvx[i]=lerp(zvx[i],dx*spd,Math.min(1,dt*3)); zvz[i]=lerp(zvz[i],dz*spd,Math.min(1,dt*3));
    let mvx=zvx[i]*dt, mvz=zvz[i]*dt;
    // separation from the crowd and the squad
    let sx=0,sz=0;
    eachNear(x,z,1,j=>{ if(j===i||zl[j]!==L) return; const ex=x-zx[j], ez=z-zz[j], d2=ex*ex+ez*ez; if(d2<0.5&&d2>1e-6){ const d=Math.sqrt(d2), k=(0.71-d)/d; sx+=ex*k; sz+=ez*k; } });
    mvx+=sx*0.5; mvz+=sz*0.5;
    for(const s of squad){ if(!s.alive||s.L!==L) continue; const ex=x+mvx-s.x, ez=z+mvz-s.z, d2=ex*ex+ez*ez; if(d2<0.5&&d2>1e-6){const d=Math.sqrt(d2),k=(0.71-d)/d; mvx+=ex*k; mvz+=ez*k;} }
    const hit=moveAgent(zA,mvx,mvz,0.3,AG.ZOMBIE);
    if(L===0&&!zA.trav) pushCircles(zA,0.3);
    let nx=zA.x, nz=zA.z;
    // pressing against a door, window, boards or a fence it wants through: bash it, or climb a broken window
    const e=hit&&(cs===3||cs===2)?hit:0;
    if(e){
      if(ED.t[e]===ET.WINB){
        const m=edgeMid(e), ox=nx-m.x, oz=nz-m.z, across=ED.d[e]===0?{x:m.x-Math.sign(ox)*0.6,z:nz}:{x:nx,z:m.z-Math.sign(oz)*0.6};
        zA.trav={climb:true,t:0,x0:nx,z0:nz,x1:across.x,z1:across.z,L0:L,L1:L};
      } else damageEdge(e,(zbody[i]===1?14:9)*nightMul*dt);
    }
    if(zA.trav) ztr[i]=zA.trav;
    // the barricade line
    if(L===0) for(const g of segs){
      if(!g.alive) continue;
      if(nx>g.x0-0.3&&nx<g.x1+0.3&&nz>g.z0-0.32&&nz<g.z1+0.32){
        const north=z<BZ;
        nz=north?g.z0-0.32:g.z1+0.32;
        if((north&&tz>BZ)||(!north&&tz<BZ)){
          g.hp-=2.2*nightMul*dt;
          if(Math.random()<dt*1.6){ chips(nx,0.7,(g.z0+g.z1)/2+(north?-0.4:0.4),2,0,north?1:-1,g.kind==='sand'?0x6b6146:0x8a8f92); if(Math.random()<.4) emit(false,nx,0.6,BZ,0,0.5,0,1.2,0.4,1.8,0x8a8680,0.35); }
          if(g.hp<=0){ g.hp=0; setSegAlive(g,false); bannerShow('LINE BROKEN','They are through on the '+(g.x0<-3?'west':g.x1>3?'east':'center')+' side.',2.4); sThud(0.7); }
        }
      }
    }
    zx[i]=nx; zz[i]=nz; zl[i]=zA.L;
    // bite
    if(bs>=0&&zcd[i]<=0){
      const s=squad[bs];
      if(s.L===L&&Math.hypot(s.x-nx,s.z-nz)<1.05){
        zcd[i]=0.95; s.hp-=10*nightMul; s.stress=Math.min(100,s.stress+9);
        bleed(s.x,1.2,s.z,s.x-nx,s.z-nz,7,1.6,s.y);
        if(bs===me){ hurtFlash=0.35; G.shake=Math.max(G.shake,0.55); }
        else if(Math.hypot(s.x-squad[me].x,s.z-squad[me].z)<9) G.shake=Math.max(G.shake,0.25);
        if(s.hp<=0) soldierDown(s);
      }
    }
    const v=Math.hypot(zvx[i],zvz[i]);
    if(v>0.05){ let want=Math.atan2(zvx[i],zvz[i]), da=want-zang[i]; while(da>Math.PI)da-=Math.PI*2; while(da<-Math.PI)da+=Math.PI*2; zang[i]+=da*Math.min(1,dt*5); }
    zph[i]+=dt*(0.9+v*(zvar[i]===3?3.4:2.6)/Math.max(0.8,zsc[i]));
    if(zfl[i]>0) zfl[i]=Math.max(0,zfl[i]-dt*4);
    if((zhp[i]<45||zmiss[i])&&v>0.3){ zdrip[i]-=dt; if(zdrip[i]<=0){ zdrip[i]=rand(.25,.6); const r=rand(.07,.16); splat(nx+rand(-.15,.15),nz+rand(-.15,.15),r,r*rand(1,1.8),undefined,zyv[i]); } }
    drawZ(i,v,dt);
  }
  for(const n of ZPARTS) zim[n].instanceMatrix.needsUpdate=true;
}
// hidden when inside a closed building or above the current cutaway
function charHidden(L,x,z,y){
  const cx=Math.floor(x), cz=Math.floor(z); if(!inMap(cx,cz)) return false;
  const b=MAP.bld[Math.min(L,NL-1)][CI(cx,cz)]; if(b<0) return false;
  const B=MAP.blds[b]; if(!B.enter) return false;
  const cut=getCut(b);
  if(cut>=999) return L<B.floors;           // indoors with the roof on: out of sight
  return y+0.4>cut;
}
function drawZ(i,v,dt){ if(charHidden(zl[i],zx[i],zz[i],zyv[i])) hideZ(i); else poseZ(i,zx[i],zz[i],v,dt); }
let hurtFlash=0;
function soldierDown(s){
  s.alive=false; s.hp=0; s.lightOn=false; s.light.intensity=0;
  s.mesh.rotation.set(Math.PI/2,s.ang,0); s.mesh.position.y=s.y+0.25;
  bannerShow(s.short+' IS DOWN','',2.2);
  if(s.i===me){ const alive=squad.find(q=>q.alive); if(alive) me=alive.i; }
  if(!squad.some(q=>q.alive)) gameOver();
}
function gameOver(){
  G.dead=true;
  const o=document.getElementById('over'); o.hidden=false;
  document.getElementById('overS').textContent='Second squad held Wolcott & 18th for '+(G.night-1)+' full night'+(G.night-1===1?'':'s')+' and dropped '+G.kills+'. Nobody came back for the truck.';
}

/* ---------- phase logic ---------- */
function updatePhase(dt){
  if(G.phase==='day'){ G.t-=dt; if(G.t<=0) startDusk(); }
  else if(G.phase==='dusk'){ G.t-=dt; if(G.t<=0) startNight(); }
  else if(G.phase==='night'){
    G.anchorX-=G.anchorSpeed*dt;
    if(G.anchorX<-195){
      let active=0; for(let i=0;i<MAXZ;i++){ const st=zst[i]; if(st===3||(st===2&&Math.abs(zx[i])<14)) active++; }
      G.afterPass+=dt;
      if((active===0&&G.afterPass>4)||G.afterPass>45) startDawn();
    }
  } else if(G.phase==='dawn'){ G.t-=dt; if(G.t<=0) startDay(); }
}

/* ---------- cutaways: open the building you're in, slice anything between you and the camera ---------- */
const BLD_H=MAP.blds.map(B=>B.enter?(B.floors===1?B.wallH:B.floors*LH)+(B.kind==='church'?5:0)+1:B.h+(B.steeple?11:3));
const cutWant=new Float32Array(MAP.blds.length);
function updateCuts(p){
  cutWant.fill(999);
  const cx=Math.floor(p.x), cz=Math.floor(p.z);
  const L=p.trav?Math.max(p.trav.L0,p.trav.L1):p.L;
  if(inMap(cx,cz)){ for(const l of [L,Math.max(0,L-1)]){ const b=MAP.bld[l][CI(cx,cz)]; if(b>=0&&MAP.blds[b].enter&&l<MAP.blds[b].floors){ cutWant[b]=p.y+1.3; break; } } }
  const C=camera.position, T={x:p.x,y:p.y+1.0,z:p.z};
  const dx=T.x-C.x, dy=T.y-C.y, dz=T.z-C.z;
  for(let b=0;b<MAP.blds.length;b++){
    const B=MAP.blds[b]; if(B.x1<p.x-50||B.x0>p.x+50||B.z1<p.z-10||B.z0>p.z+50) continue;
    // slab test against the building's box
    let t0=0,t1=0.985; const h=BLD_H[b];
    for(const [o,d,lo,hi] of [[C.x,dx,B.x0-0.3,B.x1+0.3],[C.y,dy,0,h],[C.z,dz,B.z0-0.3,B.z1+0.3]]){
      if(Math.abs(d)<1e-6){ if(o<lo||o>hi){ t0=2; break; } continue; }
      let a=(lo-o)/d, c=(hi-o)/d; if(a>c){ const tmp=a; a=c; c=tmp; } t0=Math.max(t0,a); t1=Math.min(t1,c); if(t0>t1) break;
    }
    if(t0<=t1) cutWant[b]=Math.min(cutWant[b],p.y+1.25);
  }
  for(let b=0;b<MAP.blds.length;b++) setCut(b,cutWant[b]);
}

/* ---------- HUD ---------- */
const squadEl=document.getElementById('squad'), lineEl=document.getElementById('line');
squadEl.innerHTML=squad.map(s=>`<div class="card" id="c${s.i}"><div class="n">${s.short}</div><div class="t"><span>${s.trait}</span><span class="st">HOLD</span></div><div class="bar"><b></b></div><div class="bar s"><b></b></div><div class="a">30 / 120</div></div>`).join('');
lineEl.innerHTML='<span>LINE</span>'+segs.map(()=>'<i><b></b></i>').join('');
const cards=squad.map(s=>{const c=document.getElementById('c'+s.i);return {c,st:c.querySelector('.st'),hp:c.querySelectorAll('.bar b')[0],str:c.querySelectorAll('.bar b')[1],a:c.querySelector('.a')};});
const lineBars=[...lineEl.querySelectorAll('b')];
const ordersEl=document.getElementById('orders');
function whereIs(s){
  const b=bldAt(s.L,s.x,s.z); if(b>=0&&MAP.blds[b].enter){ const B=MAP.blds[b]; const nm=B.name||({flat:'a two-flat',store:'a storefront',ware:'a warehouse'}[B.kind]||'a building');
    return (s.L>=B.floors?'Roof of ':s.L>0?'Floor '+(s.L+1)+', ':'')+(B.name?nm.charAt(0)+nm.slice(1).toLowerCase():nm); }
  const x=s.x, z=s.z, ns=ST_NS.find(t=>x>=t.x-t.h&&x<t.x+t.h), ew=ST_EW.find(t=>z>=t.z-t.h&&z<t.z+t.h);
  const nm=t=>t.n.replace(/^[SW] /,'').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
  if(ns&&ew) return nm(ns)+' & '+nm(ew); if(ns) return nm(ns); if(ew) return nm(ew);
  if(MAP.surf[0][CI(Math.floor(x),Math.floor(z))]===SURF.ALLEY) return 'Alley'; return 'Yards';
}
function updateHUD(){
  for(const s of squad) if(s.alive) applyWear(s);
  const nightEl=document.getElementById('night'), phaseEl=document.getElementById('phase'), hordeEl=document.getElementById('horde');
  nightEl.textContent=(G.phase==='day'?'DAY ':'NIGHT ')+G.night;
  if(G.phase==='day') phaseEl.textContent='Fog thin · '+Math.ceil(G.t)+'s of light left';
  else if(G.phase==='dusk') phaseEl.textContent='Fog rolling in';
  else if(G.phase==='night') phaseEl.textContent='Fog thick';
  else phaseEl.textContent='Fog lifting';
  let hordeTxt='Horde: not seen', hot=false;
  if(G.phase==='night'){
    let chasing=0; for(let i=0;i<MAXZ;i++) if(zst[i]===3) chasing++;
    const ax=G.anchorX;
    if(chasing>12){hordeTxt='Horde: coming for you';hot=true;}
    else if(ax>14&&ax<195) hordeTxt='Horde: on 18th, '+Math.round(ax)+' m east';
    else if(ax>=-14&&ax<=14){hordeTxt='Horde: crossing in front of the line';hot=true;}
    else if(ax<-14&&ax>-195) hordeTxt='Horde: on 18th, '+Math.round(-ax)+' m west';
    else if(ax>=195) hordeTxt='Horde: somewhere east';
    else hordeTxt='Horde: moving off';
  } else if(G.phase==='day') hordeTxt='Horde: gone for now';
  hordeEl.textContent=hordeTxt; hordeEl.classList.toggle('hot',hot);
  document.getElementById('where').textContent=whereIs(squad[me]);
  document.getElementById('noiseBar').style.width=(G.noise*100).toFixed(0)+'%';
  squad.forEach((s,k)=>{
    const c=cards[k];
    c.c.classList.toggle('me',k===me); c.c.classList.toggle('down',!s.alive);
    c.st.textContent=s.alive?s.status:'DOWN';
    c.st.className='st'+(s.status==='PANIC'||!s.alive?' bad':s.status==='RELOAD'?' warn':'');
    c.hp.style.width=Math.max(0,s.hp)+'%'; c.str.style.width=s.stress+'%';
    c.a.textContent=s.mag+' / '+s.res;
  });
  segs.forEach((g,k)=>{ lineBars[k].style.width=(g.hp/g.max*100)+'%'; lineBars[k].style.background=g.alive?(g.hp/g.max<.35?'var(--warn)':'var(--ink)'):'var(--bad)'; });
  ordersEl.innerHTML=['hold','follow','fallback'].map(o=>`<span class="${G.order===o?'on':''}">${o==='fallback'?'FALL BACK':o.toUpperCase()}</span>`).join('')+
    `<span class="${G.weaponsFree?'on':'q'}">${G.weaponsFree?'WEAPONS FREE':'HOLD FIRE'}</span><span class="${G.lightsOn?'on':''}">${G.lightsOn?'LIGHTS ON':'LIGHTS OUT'}</span>`;
  const tmap={tHold:G.order==='hold',tFollow:G.order==='follow',tBack:G.order==='fallback',tQuiet:!G.weaponsFree,tLights:!G.lightsOn};
  for(const id in tmap) document.getElementById(id).classList.toggle('on',tmap[id]);
  document.getElementById('tDay').hidden=G.phase!=='day';
}

/* ---------- minimap and the full map ---------- */
const MM_COL={[SURF.ASPHALT]:'#25272a',[SURF.CONCRETE]:'#55575a',[SURF.GRASS]:'#2f3a26',[SURF.DIRT]:'#3a342c',[SURF.GRAVEL]:'#4a4842',[SURF.ALLEY]:'#3c3c3e'};
const mapBase=document.createElement('canvas'); mapBase.width=GW; mapBase.height=GH;
let minimapDirty=true;
function drawMapBase(){
  const g=mapBase.getContext('2d'), img=g.createImageData(GW,GH), d=img.data;
  const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const KC={base:hex('#c9bc80'),church:hex('#8a7a6a'),market:hex('#7a6a5a'),clinic:hex('#7a8a8a'),police:hex('#5a6278'),school:hex('#8a7050'),mart:hex('#7a6a5a'),station:hex('#8a5a7a'),fieldhouse:hex('#6a6a50')};
  for(let cz=0;cz<GH;cz++) for(let cx=0;cx<GW;cx++){
    const c=cz*GW+cx, o=c*4; let col;
    const b=MAP.bld[0][c];
    if(b>=0){ const B=MAP.blds[b]; col=B.enter?(KC[B.kind]||hex('#6a5c50')):hex('#1a1b1d'); }
    else col=hex(MM_COL[MAP.surf[0][c]]||'#2a2a2a');
    if(MAP.block[0][c]===BLK.PROP) col=hex('#4a3e34');
    d[o]=col[0]; d[o+1]=col[1]; d[o+2]=col[2]; d[o+3]=255;
  }
  // doors and broken things
  for(let e=1;e<EN;e++){ if(ED.L[e]!==0) continue; const t=ED.t[e]; let col=null;
    if(t===ET.FENCE) col=[110,114,118]; else if(t===ET.DOOR||t===ET.DOPEN||t===ET.DGONE) col=t===ET.DGONE?[180,60,40]:[150,120,80]; else if(t===ET.WINB) col=[160,70,60];
    if(!col) continue; const c=(ED.z[e]-GZ0)*GW+(ED.x[e]-GX0), o=c*4; d[o]=col[0]; d[o+1]=col[1]; d[o+2]=col[2]; }
  g.putImageData(img,0,0);
  minimapDirty=false;
}
const mm=document.getElementById('minimap'), mmx=mm.getContext('2d');
function drawMinimap(){
  if(minimapDirty) drawMapBase();
  const W=mm.width, H=mm.height, p=squad[me], span=96, k=W/span;
  mmx.imageSmoothingEnabled=false; mmx.fillStyle='#111'; mmx.fillRect(0,0,W,H);
  mmx.drawImage(mapBase,p.x-span/2-GX0,p.z-span/2-GZ0,span,span,0,0,W,H);
  const toS=(x,z)=>[(x-p.x)*k+W/2,(z-p.z)*k+H/2];
  // the dead you can actually see
  mmx.fillStyle='#c0503e';
  for(let i=0;i<MAXZ;i++){ if(!zst[i]||zst[i]===5) continue; const dx=zx[i]-p.x, dz=zz[i]-p.z; if(dx*dx+dz*dz>Math.pow(Math.min(40,G.fogFar*0.9),2)) continue;
    if(zl[i]!==p.L&&!(p.L>0&&zl[i]===0)) continue; const [sx,sy]=toS(zx[i],zz[i]); mmx.fillRect(sx-1.5,sy-1.5,3,3); }
  for(const n of noiseSrc){ const a=1-(time-n.t)/9; if(a<=0) continue; const [sx,sy]=toS(n.x,n.z); mmx.strokeStyle=`rgba(216,137,60,${a})`; mmx.beginPath(); mmx.arc(sx,sy,4+(1-a)*10,0,7); mmx.stroke(); }
  for(const s of squad){ if(!s.alive) continue; const [sx,sy]=toS(s.x,s.z); mmx.fillStyle=s.i===me?'#f0e6b8':'#c9bc80'; mmx.beginPath(); mmx.arc(sx,sy,s.i===me?3.5:2.5,0,7); mmx.fill(); }
  const [sx,sy]=toS(p.x,p.z); mmx.strokeStyle='#f0e6b8'; mmx.lineWidth=1.5; mmx.beginPath(); mmx.moveTo(sx,sy); mmx.lineTo(sx+Math.sin(p.ang)*9,sy+Math.cos(p.ang)*9); mmx.stroke();
  mmx.strokeStyle='rgba(201,188,128,.5)'; mmx.lineWidth=1; mmx.strokeRect(0.5,0.5,W-1,H-1);
}
const bm=document.getElementById('bigmapC'), bmx=bm.getContext('2d');
function drawBigMap(){
  if(minimapDirty) drawMapBase();
  const X0=-125,X1=125,Z0=-150,Z1=138, W=X1-X0, H=Z1-Z0;
  const sc=Math.min((innerWidth*0.9)/W,(innerHeight*0.84)/H);
  bm.width=Math.round(W*sc); bm.height=Math.round(H*sc);
  bmx.imageSmoothingEnabled=false; bmx.drawImage(mapBase,X0-GX0,Z0-GZ0,W,H,0,0,bm.width,bm.height);
  const toS=(x,z)=>[(x-X0)*sc,(z-Z0)*sc];
  bmx.font=`${Math.max(10,sc*3.2)|0}px "IBM Plex Mono", monospace`; bmx.textAlign='center'; bmx.fillStyle='rgba(220,214,182,.75)';
  for(const s of ST_NS){ const [x,y]=toS(s.x,-134); bmx.save(); bmx.translate(x,y); bmx.rotate(-Math.PI/2); bmx.fillText(s.n,0,4); bmx.restore(); }
  for(const s of ST_EW){ const [x,y]=toS(-36,s.z); bmx.fillText(s.n,x,y+4); }
  bmx.font=`bold ${Math.max(10,sc*3)|0}px "Big Shoulders Stencil Display", Impact, sans-serif`; bmx.fillStyle='#f0e6b8';
  for(const B of MAP.blds){ if(!B.enter||!B.name||B.kind==='store') continue; const [x,y]=toS((B.x0+B.x1)/2,(B.z0+B.z1)/2); bmx.fillText(B.kind==='base'?'BASE':B.name,x,y); }
  for(const s of squad){ if(!s.alive) continue; const [x,y]=toS(s.x,s.z); bmx.fillStyle=s.i===me?'#f0e6b8':'#c9bc80'; bmx.beginPath(); bmx.arc(x,y,s.i===me?5:3.5,0,7); bmx.fill(); }
}

/* ---------- fx overlay: soft ash close to the lens ---------- */
const sprite=document.createElement('canvas'); sprite.width=sprite.height=64;
{const g=sprite.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(232,220,198,1)'); gr.addColorStop(.35,'rgba(232,220,198,.55)'); gr.addColorStop(1,'rgba(232,220,198,0)'); g.fillStyle=gr; g.fillRect(0,0,64,64);}
const ash=[]; for(let i=0;i<280;i++) ash.push({x:Math.random(),y:Math.random(),d:rand(.35,1.7),s:rand(.6,1.4),p:Math.random()*6});
let lastCamX=0,lastCamZ=0; const tagV=new THREE.Vector3();
function drawFX(dt,time){
  fctx.clearRect(0,0,FW,FH);
  const pxm=FH/(2*G.camH*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
  const dcx=(camera.position.x-lastCamX)*pxm, dcz=(camera.position.z-lastCamZ)*pxm;
  lastCamX=camera.position.x; lastCamZ=camera.position.z;
  const night=G.phase==='night'||G.phase==='dusk';
  const p=squad[me], inside=indoors(p.L,p.x,p.z);
  const ashN=Math.round(ash.length*G.ashK*(inside?0.15:1));
  for(let ai=0;ai<ashN;ai++){ const a=ash[ai];
    a.x+=(-dcx*a.d*1.3/FW)+(0.004+Math.sin(time*0.5+a.p)*0.003)*dt*a.d;
    a.y+=(-dcz*a.d*1.3/FH)+0.012*dt*a.d;
    a.x=((a.x%1)+1)%1; a.y=((a.y%1)+1)%1;
    const size=(4+a.d*a.d*9)*DPR*a.s;
    fctx.globalAlpha=(night?0.32:0.18)*(0.5+a.d*0.35);
    fctx.drawImage(sprite,a.x*FW-size/2,a.y*FH-size/2,size,size);
  }
  fctx.globalAlpha=1;
  if(vignette) fctx.drawImage(vignette,0,0);
  if(hurtFlash>0){ fctx.fillStyle='rgba(150,30,20,'+(hurtFlash*0.6)+')'; fctx.fillRect(0,0,FW,FH); }
  fctx.textAlign='center'; fctx.font=(11*DPR)+'px "Big Shoulders Stencil Display", Impact, sans-serif';
  for(const s of squad){
    if(s.i===me&&s.alive) continue; if(!s.mesh.visible) continue;
    tagV.set(s.x,(s.alive?2.75:0.9)+s.y,s.z).project(camera);
    if(tagV.z>1) continue;
    const tx=(tagV.x*0.5+0.5)*FW, ty=(-tagV.y*0.5+0.5)*FH;
    const label=s.short+(s.alive?'':' · DOWN');
    fctx.lineWidth=3*DPR; fctx.strokeStyle='rgba(10,11,8,.75)'; fctx.strokeText(label,tx,ty);
    fctx.fillStyle=s.alive?(s.panic>0?'#d8893c':'#c9c08e'):'#7d7a66'; fctx.fillText(label,tx,ty);
  }
  if(!touchMode&&G.started&&!G.mapOpen){
    const x=mouseX*DPR,y=mouseY*DPR,r=7*DPR;
    fctx.strokeStyle='rgba(230,220,203,.85)'; fctx.lineWidth=1.5*DPR;
    fctx.beginPath(); fctx.moveTo(x-r,y); fctx.lineTo(x-r/2.5,y); fctx.moveTo(x+r/2.5,y); fctx.lineTo(x+r,y); fctx.moveTo(x,y-r); fctx.lineTo(x,y-r/2.5); fctx.moveTo(x,y+r/2.5); fctx.lineTo(x,y+r); fctx.stroke();
  }
  for(const k of ['move','aim']){ const s=sticks[k]; if(!s) continue;
    fctx.strokeStyle='rgba(230,220,203,.35)'; fctx.lineWidth=2*DPR;
    fctx.beginPath(); fctx.arc(s.ox*DPR,s.oy*DPR,60*DPR,0,7); fctx.stroke();
    const dx=s.x-s.ox, dy=s.y-s.oy, m=Math.hypot(dx,dy), c=Math.min(1,60/(m||1));
    fctx.fillStyle=k==='aim'&&m>48?'rgba(216,137,60,.6)':'rgba(230,220,203,.45)';
    fctx.beginPath(); fctx.arc((s.ox+dx*c)*DPR,(s.oy+dy*c)*DPR,20*DPR,0,7); fctx.fill();
  }
}

/* ---------- simulation step (no rendering) ---------- */
function stepSim(dt){
  time+=dt;
  updatePhase(dt);
    for(const s of squad){ if(!s.alive) continue;
      s.fireCD-=dt; s.meleeCD-=dt;
      if(s.reloadT>0){ s.reloadT-=dt; if(s.reloadT<=0){ const take=Math.min(30-s.mag,s.res); s.mag+=take; s.res-=take; } }
      if(s.i===me) updatePlayer(s,dt); else updateBuddy(s,dt);
    }
    updateZombies(dt);
    for(const s of squad){ if(!s.alive) continue;
      const lit=inLight(s);
      s.stress=clamp(s.stress+(s.near*3.2*SQUAD_DEF[s.i].stress)*dt-(s.near===0?(lit?7:2.5):0)*dt,0,100);
    }
    G.noise=Math.max(0,G.noise-dt*0.35);
    hurtFlash=Math.max(0,hurtFlash-dt);
    updateBlood(dt); updateGibs(dt); updateChips(dt); updateBrass(dt); updateDoors(dt);
    for(const g of segs) updateSegVisual(g);
    updateBirds(dt,time); updateRats(dt,squad[me]); updatePapers(dt,squad[me]); updateAmbience(dt,squad[me]);
}

/* ---------- main loop ---------- */
let last=performance.now(), hudT=0, mmT=0;
function frame(now){
  requestAnimationFrame(frame);
  let dt=Math.min(0.05,(now-last)/1000); last=now;
  if(!G.started||G.paused||G.dead) dt=0;
  if(dt>0) stepSim(dt);
  updateWindows(dt,time);  const k=Math.min(1,dt*0.45+ (G.started?0:1));
  G.fogNear=lerp(G.fogNear,fogT.near,k); G.fogFar=lerp(G.fogFar,fogT.far,k);
  const roll=(G.phase==='night')?Math.sin(time*0.21)*3.5+Math.sin(time*0.077)*2.5:0;
  scene.fog.near=G.fogNear; scene.fog.far=Math.max(G.fogNear+6,G.fogFar+roll);
  scene.fog.color.lerp(fogT.col,k); renderer.setClearColor(scene.fog.color,1);
  ambient.intensity=lerp(ambient.intensity,fogT.amb,k); moon.intensity=lerp(moon.intensity,fogT.moon,k);
  ambient.color.lerp(fogT.ambCol,k); moon.color.lerp(fogT.sunCol,k); sunOff.lerp(fogT.sunOff,k);
  G.mist=lerp(G.mist,fogT.mist,k); G.ashK=lerp(G.ashK,fogT.ash,k);
  const fogDen=clamp((62-scene.fog.far)/36,0.12,1);
  const night=G.phase==='night'||G.phase==='dusk';
  const lampOn=(Math.sin(time*0.9)+Math.sin(time*2.3+1)>-1.2)&&Math.random()>0.03;
  lampLight.intensity=lampOn?1.2*(0.9+Math.random()*0.1):0.05; lampBulb.material.color.setHex(lampOn?0xdfe6ff:0x30343c);
  const cflick=0.8+Math.sin(time*11)*0.12+Math.sin(time*27+2)*0.08;
  carLight.intensity=1.8*cflick;
  for(const f of flares){ f.l.intensity=f.on?1.3*(0.75+Math.random()*0.35):0; }
  const flick=0.85+Math.sin(time*13)*0.08+Math.sin(time*31)*0.06;
  workLight.intensity=G.lightsOn?1.5:0; barrelLight.intensity=G.lightsOn?1.3*flick:0;
  lampHead.material.color.setHex(G.lightsOn?0xffe2b0:0x2a2622); fireTop.material.color.setHex(G.lightsOn?0xff9a42:0x2a1a12);
  for(let fi=0;fi<flashes.length;fi++){ const f=flashes[fi]; if(f.t>0){ f.t-=dt||0.016; if(f.t<=0){ f.l.intensity=0; muzzle[fi].visible=false; (fi?FL.mz1:FL.mz0).k=0; } } }
  if(dt>0){
    fireAt(CARFIRE.x,1.1,CARFIRE.z,26,dt,true);
    if(G.lightsOn) fireAt(LIGHT_BARREL.x,1.05,LIGHT_BARREL.z,12,dt,true);
    for(const f of flares) if(f.on){ if(Math.random()<dt*18) emit(true,f.x,0.15,f.z,rand(-.3,.3),rand(.4,1),rand(-.3,.3),rand(.15,.3),.25,.08,0xff5038,1);
      if(Math.random()<dt*2.5) emit(false,f.x,0.3,f.z,0,rand(.5,.9),0,rand(3,5),.3,2.2,0x8a6a68,0.22); }
    updateParts(dt);
  }
  const hk=0.35+fogDen*0.85;
  H.work.k=G.lightsOn?1:0; H.barrel.k=G.lightsOn?cflick:0; H.door.k=1; H.lamp.k=lampOn?1:0; H.car.k=cflick;
  H.f0.k=flares[0].on?(0.8+Math.random()*0.3):0; H.f1.k=flares[1].on?(0.8+Math.random()*0.3):0;
  H.f0.spr.position.set(flares[0].x,0.4,flares[0].z); H.f1.spr.position.set(flares[1].x,0.4,flares[1].z);
  for(const h of halos){ h.spr.material.opacity=h.base*h.k*hk; h.spr.visible=h.k>0.01; }
  FL.work.k=G.lightsOn?0.22:0; FL.barrel.k=G.lightsOn?0.3*cflick:0; FL.door.k=0.22; FL.lamp.k=lampOn?0.28:0; FL.car.k=0.45*cflick;
  FL.f0.k=flares[0].on?0.4:0; FL.f1.k=flares[1].on?0.4:0; FL.f0.x=flares[0].x; FL.f0.z=flares[0].z; FL.f1.x=flares[1].x; FL.f1.z=flares[1].z;
  const pm=squad[me];
  { FL.me.x=pm.x+Math.sin(pm.ang)*3; FL.me.z=pm.z+Math.cos(pm.ang)*3; FL.me.y=pm.y+1.2; FL.me.k=pm.lightOn&&pm.alive&&!indoors(pm.L,pm.x,pm.z)?0.12:0; }
  for(let li=0;li<MAXFL;li++){ const Lt=fxL[li]; const v=mistU.uLP.value[li], c=mistU.uLC.value[li];
    if(!Lt||Lt.k<=0){ v.set(0,0,0,0); continue; } v.set(Lt.x,Lt.y,Lt.z,Lt.r); c.set(Lt.col.r*Lt.k,Lt.col.g*Lt.k,Lt.col.b*Lt.k); }
  mistU.uTime.value=time; mistU.uDen.value=G.mist*(indoors(pm.L,pm.x,pm.z)?0.35:1); mistU.uCol.value.copy(scene.fog.color).multiplyScalar(1.25).addScalar(night?0.07:0.05).lerp(moon.color,0.12);
  for(const t of tracers){ if(t.t>0){ t.t-=dt||0.016; if(t.t<=0) t.l.visible=false; } }
  // soldiers' visuals
  for(const s of squad){
    const hidden=s.i!==me&&charHidden(s.L,s.x,s.z,s.y);
    s.mesh.visible=!hidden;
    if(!s.alive) continue;
    s.mesh.position.set(s.x,s.y,s.z); s.mesh.rotation.y=s.ang;
    { const u=s.mesh.userData, sp=s.trav?2.5:Math.hypot(s.vx,s.vz), d=dt||0.016;
      s.walk+=d*sp*2.4; const st=Math.min(1,sp/3.5);
      const hurt=s.hp<45;
      if(d>0&&!(s.boots>0)){ for(let pi=pools.length-1;pi>=0&&pi>pools.length-30;pi--){ const q=pools[pi]; if(Math.abs((q.y||0)-s.y)<1&&Math.hypot(q.x-s.x,q.z-s.z)<q.r+0.3){ s.boots=10; break; } } }
      if(s.boots>0&&sp>0.6&&!s.trav){ s.step+=sp*d; if(s.step>0.62){ s.step=0; s.foot*=-1; const a=Math.atan2(s.vx,s.vz), kk=s.boots/10;
        splat(s.x+Math.cos(a)*0.13*s.foot,s.z-Math.sin(a)*0.13*s.foot,0.12*(0.6+kk*0.4),0.24*(0.6+kk*0.4),a,s.y); s.boots-=1; } }
      u.legs[0].rotation.x=Math.sin(s.walk)*0.65*st; u.legs[1].rotation.x=-Math.sin(s.walk)*(hurt?0.18:0.65)*st+(hurt?0.12*st:0);
      u.torso.position.y=0.86+(hurt?Math.max(0,Math.sin(s.walk))*0.08:Math.abs(Math.sin(s.walk))*0.035)*st;
      u.torso.rotation.z=hurt?(0.06+Math.sin(s.walk)*0.07*st):0;
      s.recoil=Math.max(0,s.recoil-d*9); s.shoveT=Math.max(0,s.shoveT-d);
      const shv=s.shoveT>0?Math.sin((0.25-s.shoveT)/0.25*Math.PI):0;
      u.W.position.set(0,0,-s.recoil*0.09+shv*0.28);
      u.W.rotation.set(s.reloadT>0?0.55+Math.sin(s.reloadT*6)*0.08:-s.recoil*0.08-shv*0.3,shv*0.4,0);
    }
    const lit=s.lightOn&&!hidden;
    s.light.position.set(s.x+Math.sin(s.ang)*0.4,s.y+1.6,s.z+Math.cos(s.ang)*0.4);
    s.tgt.position.set(s.x+Math.sin(s.ang)*8,s.y,s.z+Math.cos(s.ang)*8);
    s.light.intensity=lit?(s.i===me?1.7:0.9):0;
    s.light.distance=s.i===me?32:22;
    s.cone.position.set(s.x+Math.sin(s.ang)*0.55,s.y+1.5,s.z+Math.cos(s.ang)*0.55); s.cone.rotation.set(0.1,s.ang,0);
    const inside=indoors(s.L,s.x,s.z);
    s.cone.material.uniforms.uOp.value=lit?(s.i===me?0.42:0.3)*(0.3+fogDen)*(inside?0.35:1):0;
    const lh=lensHalos[s.i]; lh.position.copy(s.cone.position); lh.material.opacity=lit?0.5*(0.4+fogDen)*(inside?0.5:1):0;
  }
  for(const s of squad) if(!s.alive){ s.cone.material.uniforms.uOp.value=0; lensHalos[s.i].material.opacity=0; }
  // camera
  const p=squad[me];
  G.camH=lerp(G.camH,G.camHTarget,Math.min(1,(dt||0.016)*3));
  const cx=lerp(camera.position.x,p.x,Math.min(1,(dt||0.016)*5)), cz=lerp(camera.position.z-CAM_BACK,p.z,Math.min(1,(dt||0.016)*5));
  G.shake=Math.max(0,G.shake-(dt||0.016)*2.8);
  const shk=G.shake*G.shake*0.9, sx_=(Math.random()*2-1)*shk, sz_=(Math.random()*2-1)*shk;
  const cy=G.camH+p.y;
  camera.position.set(cx+sx_,cy,cz+CAM_BACK+sz_); camera.lookAt(cx+sx_,p.y,cz-1+sz_);
  updateCuts(p);
  ring.position.set(p.x,p.y+0.06,p.z);
  moon.target.position.set(cx,0,cz); moon.position.set(cx+sunOff.x,sunOff.y,cz+sunOff.z);
  for(const m of mists){ m.position.x=Math.round(cx); m.position.z=Math.round(cz); }
  mistU.uCenter.value.set(cx,cz);
  renderer.shadowMap.needsUpdate=true;
  renderer.autoClear=true;
  camera.layers.set(0);
  renderer.setRenderTarget(rtLow); renderer.render(scene,camera);
  renderer.setRenderTarget(null);
  renderer.render(quadScene,quadCam);
  renderer.autoClear=false;
  camera.layers.set(LAYER_CHAR);
  renderer.render(scene,camera);
  camera.layers.set(LAYER_FX);
  renderer.render(scene,camera);
  renderer.autoClear=true;
  drawFX(dt||0.016,time);
  hudT-=dt||0.016; if(hudT<=0){ updateHUD(); hudT=0.12; }
  mmT-=dt||0.016; if(mmT<=0){ drawMinimap(); mmT=0.2; }
  if(G.mapOpen&&Math.random()<0.1) drawBigMap();
}

/* ---------- boot ---------- */
resize();
camera.position.set(squad[0].x,68,squad[0].z+CAM_BACK);
lastCamX=camera.position.x; lastCamZ=camera.position.z;
requestAnimationFrame(frame);
function begin(){
  initAudio();
  document.getElementById('start').hidden=true;
  G.started=true; startDay();
}
document.getElementById('startBtn').addEventListener('click',begin);
document.getElementById('againBtn').addEventListener('click',()=>location.reload());
