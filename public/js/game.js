'use strict';
// Fog Line — Game state, phases, combat, input, soldier and zombie AI, HUD, overlay, main loop, boot.
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- game state ---------- */
const G={shake:0,mist:0.3,ashK:0.55,gust:0,gustT:0,gustTarget:0.2,phase:'day',t:0,night:1,anchorX:200,anchorSpeed:2.6,noise:0,weaponsFree:true,order:'hold',lightsOn:true,
  fogNear:18,fogFar:75,dead:false,paused:false,started:false,camH:68,camHTarget:68,afterPass:0,kills:0,peel:0.003};
const fogT={near:18,far:75,col:new THREE.Color(0x3a3631),amb:0.62,moon:0.75,ambCol:new THREE.Color(0x66707e),sunCol:new THREE.Color(0xe6e0d2),sunOff:new THREE.Vector3(-55,95,-35),mist:0.3,ash:0.55};

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
  const n=Math.min(MAXZ-30,120+G.night*55);
  for(let k=0;k<n;k++){
    const ox=rand(-30,30), oz=rand(-7,7);
    spawnZ(G.anchorX+ox,-32+oz,1,ox,oz);
  }
  const strag=6+G.night*2;
  for(let k=0;k<strag;k++) spawnZ(rand(-10,10),rand(-120,-50),4,0,0);
  bannerShow('NIGHT '+G.night,'The horde is moving along 18th. Let it pass.',4);
}
function startDawn(){
  G.phase='dawn'; G.t=9; setFogTarget('dawn');
  despawnAll(true);
  bannerShow('IT PASSED','Dawn on day '+(G.night+1)+'.');
  G.night++;
}

function spawnZ(x,z,state,ox,oz){
  for(let i=0;i<MAXZ;i++){ if(zst[i]) continue;
    zx[i]=x; zz[i]=z; zvx[i]=0; zvz[i]=0; zhp[i]=rand(80,120); zst[i]=state; zox[i]=ox; zoz[i]=oz;
    zspd[i]=rand(.8,1.2); zph[i]=Math.random()*10; zcd[i]=0; zmoan[i]=0; zang[i]=-Math.PI/2; ztgt[i]=-1;
    ztx[i]=x; ztz[i]=z; zwt[i]=0; zfl[i]=0; zgib[i]=0; zdrip[i]=0; dressZ(i);
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
  if(!corpse||zst[i]===5){ zst[i]=0; hideZ(i); return; }
  G.kills++;
  zst[i]=5; zdie[i]=0;
  if(!zdx[i]&&!zdz[i]){ zdx[i]=Math.sin(zang[i]+Math.PI); zdz[i]=Math.cos(zang[i]+Math.PI); }
  // falls the way the hit pushed it: shot from behind topples forward
  const fwd=Math.sin(zang[i])*zdx[i]+Math.cos(zang[i])*zdz[i];
  zfall[i]=fwd>0?1:-1;
  const gp=zgib[i];
  if(gp===1){ zmiss[i]|=4; gib('head',i,zx[i],1.65*zsc[i],zz[i],zdx[i],zdz[i]); }
  else if(gp===2){ zmiss[i]|=8; gib('armL',i,zx[i]-0.3,1.3,zz[i],zdx[i],zdz[i]); }
  else if(gp===3){ zmiss[i]|=16; gib('armR',i,zx[i]+0.3,1.3,zz[i],zdx[i],zdz[i]); }
}
function updateDying(i,dt){
  zdie[i]+=dt; const u=Math.min(1,zdie[i]/0.55);
  poseDying(i,u);
  if(u>=1){
    pool(zx[i]+zdx[i]*0.8,zz[i]+zdz[i]*0.8,rand(1.0,1.8));
    const ps=squad[me]; if(Math.hypot(zx[i]-ps.x,zz[i]-ps.z)<16) sThud(0.18);
    freezeCorpse(i); zst[i]=0; hideZ(i);
  }
}

/* noise: everything that hears it comes to look */
function makeNoise(x,z,r){
  G.noise=Math.min(1,G.noise+r/60);
  scareBirds(x,z,r*0.8); if(r>20) for(const w of litWindows) if(Math.hypot(w.z-z,w.x-x)<70&&Math.random()<.5) w.off=rand(40,110);
  const r2=r*r;
  for(let i=0;i<MAXZ;i++){
    const st=zst[i]; if(st===0||st===3||st===5) continue;
    const dx=zx[i]-x, dz=zz[i]-z; if(dx*dx+dz*dz>r2) continue;
    zst[i]=2; ztx[i]=x+rand(-4,4); ztz[i]=z+rand(-4,4);
  }
}
function moan(i){
  if(zmoan[i]>0) return; zmoan[i]=4;
  const s=squad[me]; sMoan(Math.hypot(zx[i]-s.x,zz[i]-s.z));
  eachNear(zx[i],zz[i],8,j=>{
    if(j===i) return; const st=zst[j]; if(st===1||st===4){ if(Math.random()<.65){ zst[j]=2; ztx[j]=zx[i]+rand(-2,2); ztz[j]=zz[i]+rand(-2,2);} }
  });
}

/* ---------- combat ---------- */
function flashAt(x,z){ const f=flashes[flashIdx]; const ms=muzzle[flashIdx], L=flashIdx?FL.mz1:FL.mz0; flashIdx=(flashIdx+1)%flashes.length;
  f.l.position.set(x,1.6,z); f.l.intensity=3.6; f.t=0.06;
  ms.position.set(x,1.5,z); ms.material.rotation=rand(0,6); ms.scale.setScalar(rand(1.6,2.3)); ms.visible=true; L.x=x; L.z=z; L.k=1; }
function damageZ(j,dmg,fromX,fromZ){
  if(zst[j]===5) return;
  zhp[j]-=dmg; zfl[j]=1;
  const dx=zx[j]-fromX, dz=zz[j]-fromZ, d=Math.hypot(dx,dz)||1;
  zx[j]+=dx/d*0.18; zz[j]+=dz/d*0.18; zdx[j]=dx/d; zdz[j]=dz/d;
  bleed(zx[j],dmg>=200?1.6*zsc[j]:rand(1,1.4),zz[j],dx/d,dz/d,dmg>=200?22:9,dmg>=200?4:2.6);
  if(zhp[j]<=0){
    if(dmg>=200&&!(zmiss[j]&4)&&Math.random()<.75) zgib[j]=1;
    else if(Math.random()<.14){ const L=Math.random()<.5; if(!(zmiss[j]&(L?9:18))) zgib[j]=L?2:3; }
  }
  if(zhp[j]<=0){ killZ(j,true); return; }
  if(zst[j]!==3){ zst[j]=2; ztx[j]=fromX; ztz[j]=fromZ; }
}
function fire(s,ang,targetJ){
  s.mag--; s.recoil=1; const isMe=s.i===me; eject(s);
  s.fireCD=isMe?0.13:rand(0.34,0.52);
  const mx=s.x+Math.sin(ang)*0.75, mz=s.z+Math.cos(ang)*0.75;
  let ex=mx+Math.sin(ang)*34, ez=mz+Math.cos(ang)*34;
  if(isMe){
    const moving=Math.hypot(s.vx,s.vz)>0.5;
    const a=ang+randn()*((moving?0.06:0.022)+s.stress*0.0007);
    const fx_=Math.sin(a), fz_=Math.cos(a);
    let best=34,bj=-1;
    for(let j=0;j<MAXZ;j++){ if(!zst[j]||zst[j]===5) continue;
      const dx=zx[j]-mx, dz=zz[j]-mz, t=dx*fx_+dz*fz_; if(t<0||t>best) continue;
      if(Math.abs(dx*fz_-dz*fx_)<0.5){best=t;bj=j;}
    }
    ex=mx+fx_*best; ez=mz+fz_*best;
    if(bj>=0) damageZ(bj,Math.random()<.24?200:36,s.x,s.z);
    else { const hp=impact(mx,mz,ex,ez); ex=hp.x; ez=hp.z; }
  } else if(targetJ>=0){
    const d=Math.hypot(zx[targetJ]-mx,zz[targetJ]-mz);
    const chance=clamp(s.acc-s.stress*0.003-d*0.008,0.12,0.92);
    if(Math.random()<chance){ ex=zx[targetJ]; ez=zz[targetJ]; damageZ(targetJ,Math.random()<.2?200:36,s.x,s.z); }
    else { const a=ang+rand(-.12,.12); ex=mx+Math.sin(a)*(d+6); ez=mz+Math.cos(a)*(d+6); const hp=impact(mx,mz,ex,ez); ex=hp.x; ez=hp.z; }
  }
  tracer(mx,mz,ex,ez); flashAt(mx,mz);
  if(isMe) G.shake=Math.max(G.shake,0.16);
  const ps=squad[me]; sGun(Math.hypot(s.x-ps.x,s.z-ps.z));
  makeNoise(s.x,s.z,44);
}
function shove(s){
  if(s.meleeCD>0) return; s.meleeCD=0.6; s.shoveT=0.25;
  const fx_=Math.sin(s.ang), fz_=Math.cos(s.ang); let hit=false;
  eachNear(s.x,s.z,2.2,j=>{
    const dx=zx[j]-s.x, dz=zz[j]-s.z, d=Math.hypot(dx,dz); if(d>1.9||d<1e-3) return;
    if((dx*fx_+dz*fz_)/d<0.25) return;
    if(zst[j]===5) return;
    zx[j]+=dx/d*1.3; zz[j]+=dz/d*1.3; zhp[j]-=48*s.melee; hit=true; zdx[j]=dx/d; zdz[j]=dz/d;
    bleed(zx[j],1.2,zz[j],dx/d,dz/d,4,1.5);
    if(zhp[j]<=0) killZ(j,true);
  });
  sThud(hit?0.5:0.2);
  if(hit) makeNoise(s.x,s.z,5);
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
  else if(k==='l'){G.lightsOn=!G.lightsOn; bannerShow(G.lightsOn?'LIGHTS UP':'LIGHTS OUT','',1.4);}
  else if(k==='h'){const el=document.getElementById('keys'); el.hidden=!el.hidden;}
  else if(k==='z'){G.camHTarget=G.camHTarget>90?68:115;}
  else if(k==='enter'){ if(G.phase==='day') G.t=0; }
  else if(k==='p'){ userScaleBias=(userScaleBias+1)%3; resize(); }
}
let lastOrderMsg=0;
function radioLine(m){ const n=performance.now(); if(n-lastOrderMsg>400){ radio(m); lastOrderMsg=n; } }
addEventListener('keydown',e=>{
  if(!G.started) return;
  const k=e.key.toLowerCase(); if(keys[k]) return; keys[k]=true;
  if(k==='escape'){G.paused=!G.paused; bannerShow(G.paused?'PAUSED':'', G.paused?'Esc to resume':'',G.paused?9999:0.1); return;}
  act(k);
});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
addEventListener('blur',()=>{for(const k in keys) keys[k]=false; mouseDown=false;});
glCanvas.addEventListener('contextmenu',e=>e.preventDefault());
glCanvas.addEventListener('wheel',e=>{e.preventDefault(); G.camHTarget=clamp(G.camHTarget+Math.sign(e.deltaY)*8,52,140);},{passive:false});

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
  for(let k=1;k<=4;k++){ const n=(me+k)%4; if(squad[n].alive){ squad[me].lightOn=G.weaponsFree; me=n; squad[me].lightOn=true; return; } }
}

/* ---------- segment helpers ---------- */
function segAt(x,z,pad){ for(const s of segs){ if(!s.alive) continue; if(x>s.x0-pad&&x<s.x1+pad&&z>s.z0-pad&&z<s.z1+pad) return s; } return null; }
function setSegAlive(s,alive){ s.alive=alive; s.mesh.visible=alive; }
function repairNear(s,amount,noisy){
  let best=null,bd=3.2;
  for(const g of segs){ if(g.hp>=g.max) continue; const cx=clamp(s.x,g.x0,g.x1), d=Math.hypot(s.x-cx,s.z-BZ); if(d<bd){bd=d;best=g;} }
  if(!best) return false;
  best.hp=Math.min(best.max,best.hp+amount); if(!best.alive&&best.hp>best.max*0.25) setSegAlive(best,true);
  if(noisy){ G._ham=(G._ham||0)+amount; if(G._ham>40){G._ham=0; makeNoise(s.x,s.z,16); sThud(0.25);} }
  return true;
}

/* ---------- per-frame: soldiers ---------- */
function inLight(s){
  if(G.lightsOn){ if(Math.hypot(s.x-LIGHT_WORK.x,s.z-LIGHT_WORK.z)<11) return true; if(Math.hypot(s.x-LIGHT_BARREL.x,s.z-LIGHT_BARREL.z)<7) return true; }
  return Math.hypot(s.x-DOOR.x,s.z-DOOR.z)<5;
}
function moveSoldier(s,dx,dz,speed,dt){
  if(s.hp<45) speed*=0.8;
  const seg=segAt(s.x,s.z,0.1); if(seg) speed*=0.45;
  s.vx=lerp(s.vx,dx*speed,Math.min(1,dt*12)); s.vz=lerp(s.vz,dz*speed,Math.min(1,dt*12));
  P.x=s.x+s.vx*dt; P.z=s.z+s.vz*dt; pushColliders(0.35); clampWalk(); s.x=P.x; s.z=P.z;
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
    ndc.set(mouseX/innerWidth*2-1,-(mouseY/innerHeight)*2+1); ray.setFromCamera(ndc,camera);
    if(ray.ray.intersectPlane(groundPlane,hitV)) s.ang=Math.atan2(hitV.x-s.x,hitV.z-s.z);
  }
  if(firing&&s.fireCD<=0&&s.reloadT<=0){ if(s.mag>0) fire(s,s.ang,-1); else { reload(s); s.fireCD=0.3; } }
  if(keys['e']||touchFix) repairNear(s,70*dt,G.phase!=='day');
  s.status=s.reloadT>0?'RELOAD':'YOU';
}
function updateBuddy(s,dt){
  const p=squad[me];
  let gx=s.post.x, gz=s.post.z;
  if(G.order==='follow'){ const sl=FOLLOW_SLOTS[(s.i-me+3)%4]||FOLLOW_SLOTS[0]; gx=p.x+sl.x; gz=p.z+sl.z; }
  else if(G.order==='fallback'){ const sp=BACK_SPOTS[s.i]; gx=sp.x; gz=sp.z; }
  // daytime: work the line
  let fixing=false;
  if(G.phase==='day'&&G.order==='hold'){
    let worst=null; for(const g of segs) if(g.hp<g.max&&(!worst||g.hp/g.max<worst.hp/worst.max)) worst=g;
    if(worst){ gx=clamp((worst.x0+worst.x1)/2+(s.i-1.5)*0.8,worst.x0+0.5,worst.x1-0.5); gz=BZ+1.6; fixing=true; }
  }
  const dx=gx-s.x, dz=gz-s.z, d=Math.hypot(dx,dz);
  if(d>0.35) moveSoldier(s,dx/d,dz/d,d>6?4.4:3.2,dt); else { s.vx*=0.8; s.vz*=0.8; }
  if(fixing&&d<1.6) repairNear(s,40*dt,false);
  // find a target
  const R=Math.min(26,G.fogFar*1.05+3);
  let bj=-1,bd=R*R;
  for(let j=0;j<MAXZ;j++){ if(!zst[j]||zst[j]===5) continue; const ex=zx[j]-s.x, ez=zz[j]-s.z, d2=ex*ex+ez*ez; if(d2<bd){bd=d2;bj=j;} }
  const td=Math.sqrt(bd);
  let want=d>0.6?Math.atan2(s.vx,s.vz):Math.PI;
  if(bj>=0) want=Math.atan2(zx[bj]-s.x,zz[bj]-s.z);
  let da=want-s.ang; while(da>Math.PI) da-=Math.PI*2; while(da<-Math.PI) da+=Math.PI*2; s.ang+=da*Math.min(1,dt*8);
  // panic
  if(!G.weaponsFree&&s.stress>85&&s.panic<=0&&bj>=0&&Math.random()<dt*0.45){ s.panic=1.4; radio(s.short.charAt(0)+s.short.slice(1).toLowerCase()+' is losing it.'); }
  if(s.panic>0) s.panic-=dt;
  s.status=fixing?'REPAIR':G.order==='follow'?'FOLLOW':G.order==='fallback'?'FALL BACK':'HOLD';
  if(s.reloadT>0){ s.status='RELOAD'; return; }
  if(bj>=0&&td<1.8&&s.meleeCD<=0&&Math.abs(da)<0.8){ shove(s); return; }
  const canFire=(G.weaponsFree||s.panic>0)&&bj>=0&&Math.abs(da)<0.25&&s.fireCD<=0;
  if(!G.weaponsFree) s.status=s.panic>0?'PANIC':'QUIET';
  if(canFire){ if(s.mag>0) fire(s,s.ang,bj); else reload(s); }
  else if(bj<0&&s.mag<12&&s.res>0) reload(s);
}

/* ---------- per-frame: zombies ---------- */
function updateZombies(dt,time){
  rebuildGrid();
  const nightMul=1+(G.night-1)*0.07;
  for(const s of squad){ s.near=0; s.sight=s.alive?(6.5+(s.lightOn?7.5:0)+(inLight(s)?6:0))*(G.fogFar<35?0.9:1.25):0; }
  for(let i=0;i<MAXZ;i++){
    const st=zst[i]; if(!st) continue;
    if(st===5){ updateDying(i,dt); continue; }
    let x=zx[i], z=zz[i];
    zmoan[i]-=dt; zcd[i]-=dt;
    // perception
    let bs=-1,bd2=1e9;
    for(let k=0;k<4;k++){ const s=squad[k]; if(!s.alive) continue; const dx=s.x-x, dz=s.z-z, d2=dx*dx+dz*dz; if(d2<64) s.near++; if(d2<bd2){bd2=d2;bs=k;} }
    const bd=Math.sqrt(bd2);
    if(bs>=0){
      const sight=squad[bs].sight;
      if(st!==3&&bd<sight){ zst[i]=3; ztgt[i]=bs; moan(i); }
      else if(st===3&&bd>sight*1.8+4){ zst[i]=2; const s=squad[ztgt[i]>=0?ztgt[i]:bs]; ztx[i]=s.x; ztz[i]=s.z; }
    }
    // goal
    let tx,tz,spd;
    const cs=zst[i];
    if(cs===1){
      tx=G.anchorX+zox[i]; tz=-32+zoz[i];
      const dd=Math.hypot(tx-x,tz-z); spd=clamp(dd*0.5,0.6,G.anchorSpeed*1.6)*zspd[i];
      if(Math.abs(x)<9&&Math.random()<G.peel*dt*60*0.016){ zst[i]=4; ztx[i]=rand(-10,10); ztz[i]=rand(-26,-17); zwt[i]=rand(6,14); }
      if(G.anchorX<-195&&x<-150){ killZ(i,false); continue; }
    } else if(cs===3){
      let s=squad[ztgt[i]]; if(!s||!s.alive){ s=squad[bs]; ztgt[i]=bs; }
      if(!s){ zst[i]=4; continue; }
      tx=s.x; tz=s.z; spd=2.25*zspd[i]*nightMul;
    } else if(cs===2){
      tx=ztx[i]; tz=ztz[i]; spd=1.7*zspd[i]*nightMul;
      if(Math.hypot(tx-x,tz-z)<2.2){ zst[i]=4; zwt[i]=rand(4,9); ztx[i]=x+rand(-6,6); ztz[i]=z+rand(-6,6); }
    } else {
      tx=ztx[i]; tz=ztz[i]; spd=0.65*zspd[i];
      zwt[i]-=dt;
      if(zwt[i]<=0||Math.hypot(tx-x,tz-z)<1){ zwt[i]=rand(4,10); ztx[i]=x+rand(-7,7); ztz[i]=z+rand(-7,7); }
    }
    let dx=tx-x, dz=tz-z; const dl=Math.hypot(dx,dz)||1; dx/=dl; dz/=dl;
    zvx[i]=lerp(zvx[i],dx*spd,Math.min(1,dt*3)); zvz[i]=lerp(zvz[i],dz*spd,Math.min(1,dt*3));
    let nx=x+zvx[i]*dt, nz=z+zvz[i]*dt;
    // separation
    let sx=0,sz=0;
    eachNear(x,z,1,j=>{ if(j===i) return; const ex=x-zx[j], ez=z-zz[j], d2=ex*ex+ez*ez; if(d2<0.5&&d2>1e-6){ const d=Math.sqrt(d2), k=(0.71-d)/d; sx+=ex*k; sz+=ez*k; } });
    nx+=sx*0.5; nz+=sz*0.5;
    for(const s of squad){ if(!s.alive) continue; const ex=nx-s.x, ez=nz-s.z, d2=ex*ex+ez*ez; if(d2<0.5&&d2>1e-6){const d=Math.sqrt(d2),k=(0.71-d)/d; nx+=ex*k; nz+=ez*k;} }
    P.x=nx; P.z=nz; pushColliders(0.3); clampWalk(); nx=P.x; nz=P.z;
    // barricade
    for(const g of segs){
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
    zx[i]=nx; zz[i]=nz;
    // bite
    if(bs>=0&&zcd[i]<=0){
      const s=squad[bs];
      if(Math.hypot(s.x-nx,s.z-nz)<1.05){
        zcd[i]=0.95; s.hp-=10*nightMul; s.stress=Math.min(100,s.stress+9);
        bleed(s.x,1.2,s.z,s.x-nx,s.z-nz,7,1.6);
        if(bs===me){ hurtFlash=0.35; G.shake=Math.max(G.shake,0.55); }
        else if(Math.hypot(s.x-squad[me].x,s.z-squad[me].z)<9) G.shake=Math.max(G.shake,0.25);
        if(s.hp<=0) soldierDown(s);
      }
    }
    // pose
    const v=Math.hypot(zvx[i],zvz[i]);
    if(v>0.05){ let want=Math.atan2(zvx[i],zvz[i]), da=want-zang[i]; while(da>Math.PI)da-=Math.PI*2; while(da<-Math.PI)da+=Math.PI*2; zang[i]+=da*Math.min(1,dt*5); }
    zph[i]+=dt*(0.9+v*(zvar[i]===3?3.4:2.6)/Math.max(0.8,zsc[i]));
    if(zfl[i]>0) zfl[i]=Math.max(0,zfl[i]-dt*4);
    if((zhp[i]<45||zmiss[i])&&v>0.3){ zdrip[i]-=dt; if(zdrip[i]<=0){ zdrip[i]=rand(.25,.6); const r=rand(.07,.16); splat(nx+rand(-.15,.15),nz+rand(-.15,.15),r,r*rand(1,1.8)); } }
    poseZ(i,nx,nz,v,dt);
  }
  for(const n of ZPARTS) zim[n].instanceMatrix.needsUpdate=true;
}
let hurtFlash=0;
function soldierDown(s){
  s.alive=false; s.hp=0; s.lightOn=false; s.light.intensity=0;
  s.mesh.rotation.set(Math.PI/2,s.ang,0); s.mesh.position.y=0.25;
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

/* ---------- HUD ---------- */
const squadEl=document.getElementById('squad'), lineEl=document.getElementById('line');
squadEl.innerHTML=squad.map(s=>`<div class="card" id="c${s.i}"><div class="n">${s.short}</div><div class="t"><span>${s.trait}</span><span class="st">HOLD</span></div><div class="bar"><b></b></div><div class="bar s"><b></b></div><div class="a">30 / 120</div></div>`).join('');
lineEl.innerHTML='<span>LINE</span>'+segs.map(()=>'<i><b></b></i>').join('');
const cards=squad.map(s=>{const c=document.getElementById('c'+s.i);return {c,st:c.querySelector('.st'),hp:c.querySelectorAll('.bar b')[0],str:c.querySelectorAll('.bar b')[1],a:c.querySelector('.a')};});
const lineBars=[...lineEl.querySelectorAll('b')];
const ordersEl=document.getElementById('orders');
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
    if(chasing>12){hordeTxt='Horde: coming down Wolcott';hot=true;}
    else if(ax>14&&ax<195) hordeTxt='Horde: on 18th, '+Math.round(ax)+' m east';
    else if(ax>=-14&&ax<=14){hordeTxt='Horde: crossing in front of the line';hot=true;}
    else if(ax<-14&&ax>-195) hordeTxt='Horde: on 18th, '+Math.round(-ax)+' m west';
    else if(ax>=195) hordeTxt='Horde: somewhere east';
    else hordeTxt='Horde: moving off';
  } else if(G.phase==='day') hordeTxt='Horde: gone for now';
  hordeEl.textContent=hordeTxt; hordeEl.classList.toggle('hot',hot);
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
  const ashN=Math.round(ash.length*G.ashK);
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
  // name tags over the squad
  fctx.textAlign='center'; fctx.font=(11*DPR)+'px "Big Shoulders Stencil Display", Impact, sans-serif';
  for(const s of squad){
    if(s.i===me&&s.alive) continue;
    tagV.set(s.x,s.alive?2.75:0.9,s.z).project(camera);
    if(tagV.z>1) continue;
    const tx=(tagV.x*0.5+0.5)*FW, ty=(-tagV.y*0.5+0.5)*FH;
    const label=s.short+(s.alive?'':' · DOWN');
    fctx.lineWidth=3*DPR; fctx.strokeStyle='rgba(10,11,8,.75)'; fctx.strokeText(label,tx,ty);
    fctx.fillStyle=s.alive?(s.panic>0?'#d8893c':'#c9c08e'):'#7d7a66'; fctx.fillText(label,tx,ty);
  }
  // reticle / sticks
  if(!touchMode&&G.started){
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

/* ---------- main loop ---------- */
let last=performance.now(), hudT=0, time=0;
function frame(now){
  requestAnimationFrame(frame);
  let dt=Math.min(0.05,(now-last)/1000); last=now;
  if(!G.started||G.paused||G.dead) dt=0;
  time+=dt;
  if(dt>0){
    updatePhase(dt);
    for(const s of squad){ if(!s.alive) continue;
      s.fireCD-=dt; s.meleeCD-=dt;
      if(s.reloadT>0){ s.reloadT-=dt; if(s.reloadT<=0){ const take=Math.min(30-s.mag,s.res); s.mag+=take; s.res-=take; } }
      if(s.i===me) updatePlayer(s,dt); else updateBuddy(s,dt);
    }
    updateZombies(dt,time);
    for(const s of squad){ if(!s.alive) continue;
      const lit=inLight(s);
      s.stress=clamp(s.stress+(s.near*3.2*SQUAD_DEF[s.i].stress)*dt-(s.near===0?(lit?7:2.5):0)*dt,0,100);
    }
    G.noise=Math.max(0,G.noise-dt*0.35);
    hurtFlash=Math.max(0,hurtFlash-dt);
    updateBlood(dt); updateGibs(dt); updateChips(dt); updateBrass(dt);
    for(const g of segs) updateSegVisual(g);
    updateBirds(dt,time); updateRats(dt,squad[me]); updatePapers(dt,squad[me]); updateAmbience(dt,squad[me]);
  }
  updateWindows(dt,time);
  // fog + light blend
  const k=Math.min(1,dt*0.45+ (G.started?0:1));
  G.fogNear=lerp(G.fogNear,fogT.near,k); G.fogFar=lerp(G.fogFar,fogT.far,k);
  const roll=(G.phase==='night')?Math.sin(time*0.21)*3.5+Math.sin(time*0.077)*2.5:0;
  scene.fog.near=G.fogNear; scene.fog.far=Math.max(G.fogNear+6,G.fogFar+roll);
  scene.fog.color.lerp(fogT.col,k); renderer.setClearColor(scene.fog.color,1);
  ambient.intensity=lerp(ambient.intensity,fogT.amb,k); moon.intensity=lerp(moon.intensity,fogT.moon,k);
  ambient.color.lerp(fogT.ambCol,k); moon.color.lerp(fogT.sunCol,k); sunOff.lerp(fogT.sunOff,k);
  G.mist=lerp(G.mist,fogT.mist,k); G.ashK=lerp(G.ashK,fogT.ash,k);
  const fogDen=clamp((62-scene.fog.far)/36,0.12,1);
  const night=G.phase==='night'||G.phase==='dusk';
  // streetlamp buzzes and cuts out
  const lampOn=(Math.sin(time*0.9)+Math.sin(time*2.3+1)>-1.2)&&Math.random()>0.03;
  lampLight.intensity=lampOn?1.2*(0.9+Math.random()*0.1):0.05; lampBulb.material.color.setHex(lampOn?0xdfe6ff:0x30343c);
  const cflick=0.8+Math.sin(time*11)*0.12+Math.sin(time*27+2)*0.08;
  carLight.intensity=1.8*cflick;
  for(const f of flares){ f.l.intensity=f.on?1.3*(0.75+Math.random()*0.35):0; }
  const flick=0.85+Math.sin(time*13)*0.08+Math.sin(time*31)*0.06;
  workLight.intensity=G.lightsOn?1.5:0; barrelLight.intensity=G.lightsOn?1.3*flick:0;
  lampHead.material.color.setHex(G.lightsOn?0xffe2b0:0x2a2622); fireTop.material.color.setHex(G.lightsOn?0xff9a42:0x2a1a12);
  for(let fi=0;fi<flashes.length;fi++){ const f=flashes[fi]; if(f.t>0){ f.t-=dt||0.016; if(f.t<=0){ f.l.intensity=0; muzzle[fi].visible=false; (fi?FL.mz1:FL.mz0).k=0; } } }
  // fire + smoke
  if(dt>0){
    fireAt(CARFIRE.x,1.1,CARFIRE.z,26,dt,true);
    if(G.lightsOn) fireAt(LIGHT_BARREL.x,1.05,LIGHT_BARREL.z,12,dt,true);
    for(const f of flares) if(f.on){ if(Math.random()<dt*18) emit(true,f.x,0.15,f.z,rand(-.3,.3),rand(.4,1),rand(-.3,.3),rand(.15,.3),.25,.08,0xff5038,1);
      if(Math.random()<dt*2.5) emit(false,f.x,0.3,f.z,0,rand(.5,.9),0,rand(3,5),.3,2.2,0x8a6a68,0.22); }
    updateParts(dt);
  }
  // halos: stronger the thicker the fog
  const hk=0.35+fogDen*0.85;
  H.work.k=G.lightsOn?1:0; H.barrel.k=G.lightsOn?cflick:0; H.door.k=1; H.lamp.k=lampOn?1:0; H.car.k=cflick;
  H.f0.k=flares[0].on?(0.8+Math.random()*0.3):0; H.f1.k=flares[1].on?(0.8+Math.random()*0.3):0;
  H.f0.spr.position.set(flares[0].x,0.4,flares[0].z); H.f1.spr.position.set(flares[1].x,0.4,flares[1].z);
  for(const h of halos){ h.spr.material.opacity=h.base*h.k*hk; h.spr.visible=h.k>0.01; }
  FL.work.k=G.lightsOn?0.22:0; FL.barrel.k=G.lightsOn?0.3*cflick:0; FL.door.k=0.22; FL.lamp.k=lampOn?0.28:0; FL.car.k=0.45*cflick;
  FL.f0.k=flares[0].on?0.4:0; FL.f1.k=flares[1].on?0.4:0; FL.f0.x=flares[0].x; FL.f0.z=flares[0].z; FL.f1.x=flares[1].x; FL.f1.z=flares[1].z;
  { const pm=squad[me]; FL.me.x=pm.x+Math.sin(pm.ang)*3; FL.me.z=pm.z+Math.cos(pm.ang)*3; FL.me.k=pm.lightOn&&pm.alive?0.12:0; }
  for(let li=0;li<MAXFL;li++){ const L=fxL[li]; const v=mistU.uLP.value[li], c=mistU.uLC.value[li];
    if(!L||L.k<=0){ v.set(0,0,0,0); continue; } v.set(L.x,L.y,L.z,L.r); c.set(L.col.r*L.k,L.col.g*L.k,L.col.b*L.k); }
  mistU.uTime.value=time; mistU.uDen.value=G.mist; mistU.uCol.value.copy(scene.fog.color).multiplyScalar(1.25).addScalar(night?0.07:0.05).lerp(moon.color,0.12);
  for(const t of tracers){ if(t.t>0){ t.t-=dt||0.016; if(t.t<=0) t.l.visible=false; } }
  // soldiers' visuals
  for(const s of squad){
    if(!s.alive) continue;
    s.mesh.position.set(s.x,0,s.z); s.mesh.rotation.y=s.ang;
    { const u=s.mesh.userData, sp=Math.hypot(s.vx,s.vz), d=dt||0.016;
      s.walk+=d*sp*2.4; const st=Math.min(1,sp/3.5);
      // legs swing relative to facing: back-pedal and strafe still animate
      const hurt=s.hp<45;
      // bloody boots: step in a puddle, leave prints for a while
      if(d>0&&!(s.boots>0)){ for(let pi=pools.length-1;pi>=0&&pi>pools.length-30;pi--){ const q=pools[pi]; if(Math.hypot(q.x-s.x,q.z-s.z)<q.r+0.3){ s.boots=10; break; } } }
      if(s.boots>0&&sp>0.6){ s.step+=sp*d; if(s.step>0.62){ s.step=0; s.foot*=-1; const a=Math.atan2(s.vx,s.vz), k=s.boots/10;
        splat(s.x+Math.cos(a)*0.13*s.foot,s.z-Math.sin(a)*0.13*s.foot,0.12*(0.6+k*0.4),0.24*(0.6+k*0.4),a); s.boots-=1; } }
      u.legs[0].rotation.x=Math.sin(s.walk)*0.65*st; u.legs[1].rotation.x=-Math.sin(s.walk)*(hurt?0.18:0.65)*st+(hurt?0.12*st:0);
      u.torso.position.y=0.86+(hurt?Math.max(0,Math.sin(s.walk))*0.08:Math.abs(Math.sin(s.walk))*0.035)*st;
      u.torso.rotation.z=hurt?(0.06+Math.sin(s.walk)*0.07*st):0;
      s.recoil=Math.max(0,s.recoil-d*9); s.shoveT=Math.max(0,s.shoveT-d);
      const shv=s.shoveT>0?Math.sin((0.25-s.shoveT)/0.25*Math.PI):0;
      u.W.position.set(0,0,-s.recoil*0.09+shv*0.28);
      u.W.rotation.set(s.reloadT>0?0.55+Math.sin(s.reloadT*6)*0.08:-s.recoil*0.08-shv*0.3,shv*0.4,0);
    }
    s.light.position.set(s.x+Math.sin(s.ang)*0.4,1.6,s.z+Math.cos(s.ang)*0.4);
    s.tgt.position.set(s.x+Math.sin(s.ang)*8,0,s.z+Math.cos(s.ang)*8);
    s.light.intensity=s.lightOn?(s.i===me?1.7:0.9):0;
    s.light.distance=s.i===me?32:22;
    s.cone.position.set(s.x+Math.sin(s.ang)*0.55,1.5,s.z+Math.cos(s.ang)*0.55); s.cone.rotation.set(0.1,s.ang,0);
    s.cone.material.uniforms.uOp.value=s.lightOn?(s.i===me?0.42:0.3)*(0.3+fogDen):0;
    const lh=lensHalos[s.i]; lh.position.copy(s.cone.position); lh.material.opacity=s.lightOn?0.5*(0.4+fogDen):0;
  }
  for(const s of squad) if(!s.alive){ s.cone.material.uniforms.uOp.value=0; lensHalos[s.i].material.opacity=0; }
  // camera
  const p=squad[me];
  G.camH=lerp(G.camH,G.camHTarget,Math.min(1,(dt||0.016)*3));
  const cx=lerp(camera.position.x,p.x,Math.min(1,(dt||0.016)*5)), cz=lerp(camera.position.z-CAM_BACK,p.z,Math.min(1,(dt||0.016)*5));
  G.shake=Math.max(0,G.shake-(dt||0.016)*2.8);
  const shk=G.shake*G.shake*0.9, sx_=(Math.random()*2-1)*shk, sz_=(Math.random()*2-1)*shk;
  camera.position.set(cx+sx_,G.camH,cz+CAM_BACK+sz_); camera.lookAt(cx+sx_,0,cz-1+sz_);
  ring.position.set(p.x,0.06,p.z);
  { const inside=shopInside(p.x,p.z); for(const m of shopHide) m.visible=!inside;
    if(shopSouth){ const B=shopSouth, hh=inside?4.2:B.h; B.m.scale.y=hh/B.h; B.m.position.y=hh/2; for(const c of B.clutter) c.visible=!inside; } }
  moon.target.position.set(cx,0,cz); moon.position.set(cx+sunOff.x,sunOff.y,cz+sunOff.z);
  for(const m of mists){ m.position.x=Math.round(cx); m.position.z=Math.round(cz); }
  mistU.uCenter.value.set(cx,cz);
  // pass 1: world at low res (shadow map includes characters)
  renderer.shadowMap.needsUpdate=true;
  renderer.autoClear=true;
  camera.layers.set(0);
  renderer.setRenderTarget(rtLow); renderer.render(scene,camera);
  // pass 2: blow the world up, then characters at CHAR_RES on top with depth
  renderer.setRenderTarget(null);
  renderer.render(quadScene,quadCam);
  renderer.autoClear=false;
  camera.layers.set(LAYER_CHAR);
  renderer.render(scene,camera);
  // pass 3: mist, halos, beams, fire and smoke over everything
  camera.layers.set(LAYER_FX);
  renderer.render(scene,camera);
  renderer.autoClear=true;
  drawFX(dt||0.016,time);
  hudT-=dt||0.016; if(hudT<=0){ updateHUD(); hudT=0.12; }
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
