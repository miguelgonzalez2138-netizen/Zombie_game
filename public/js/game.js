'use strict';
// Fog Line — Game state, phases, combat, input, soldier and zombie AI, HUD, overlay, main loop, boot.
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- game state ---------- */
const G={shake:0,mist:0.3,ashK:0.55,gust:0,gustT:0,gustTarget:0.2,phase:'day',t:0,night:1,anchorX:200,anchorSpeed:2.6,noise:0,weaponsFree:true,order:'hold',lightsOn:true,
  fogNear:18,fogFar:75,kickX:0,kickZ:0,dead:false,paused:false,started:false,camH:68,camHTarget:68,afterPass:0,kills:0,peel:0.003,mapOpen:false};
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
  G.phase='day'; G.t=10.5*HOUR; setFogTarget('day'); for(const f of flares){ f.on=false; f.m.visible=false; }
  despawnAll(false);
  if(G.night>1){
    let found=0;
    for(const s of squad){ if(!s.alive) continue; s.hp=Math.min(100,s.hp+(BASEUP.stove?25:15)); s.stress*=0.4; }
    bannerShow('DAY '+G.night,'The fog thinned out. Eat, fix the line, go find what we need.');
    dailyUpkeep(); squadDawn();
  } else {
    bannerShow('DAY 1','Wolcott & 18th. Food for a few days. Find more before dark.',4);
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
    zl[i]=L||0; zyv[i]=(L||0)*LH; ztr[i]=null; zLosT[i]=Math.random()*0.3; zDirect[i]=0; zSees[i]=-1; zburn[i]=0; zstun[i]=0; zLost[i]=0; zdx[i]=0; zdz[i]=0;
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
  G.kills++; corpseDrop(i); if(HIT.s) giveXP(HIT.s,HIT.quiet?12:8,HIT.melee?'melee':'fight');
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
function onDoorOpened(e,p,loud){ if(!loud) makeNoise(p.x,p.z,3,p.L); if(!AC) return; const s=squad[me]; const d=Math.hypot(p.x-s.x,p.z-s.z); if(d<20) SFX.creak(clamp((p.x-s.x)/20,-1,1),(loud?0.9:0.6)/(1+d*0.25)); }
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

/* ---------- combat (weapons themselves live in weapons.js) ---------- */
function flashAt(x,z,y,sc){ sc=sc===undefined?1:sc; const f=flashes[flashIdx]; const ms=muzzle[flashIdx], Lf=flashIdx?FL.mz1:FL.mz0; flashIdx=(flashIdx+1)%flashes.length; y=y||0;
  f.l.position.set(x,y+1.6,z); f.l.intensity=3.6*sc; f.t=0.06;
  ms.position.set(x,y+1.5,z); ms.material.rotation=rand(0,6); ms.scale.setScalar(rand(1.6,2.3)*Math.max(0.35,sc)); ms.visible=true; Lf.x=x; Lf.z=z; Lf.y=y+1.5; Lf.k=sc; }
// knock: how far the hit shoves it back (and staggers it); blast: explosions tear limbs, not just heads
function damageZ(j,dmg,fromX,fromZ,knock,blast){
  if(zst[j]===5||!zst[j]) return;
  knock=knock===undefined?0.18:knock;
  zhp[j]-=dmg; zfl[j]=1;
  const dx=zx[j]-fromX, dz=zz[j]-fromZ, d=Math.hypot(dx,dz)||1;
  pushZ(j,dx/d*Math.min(1.6,knock),dz/d*Math.min(1.6,knock));
  if(knock>=0.4) zstun[j]=Math.max(zstun[j],knock*0.4);
  zdx[j]=dx/d; zdz[j]=dz/d;
  bleed(zx[j],dmg>=200?1.6*zsc[j]:rand(1,1.4),zz[j],dx/d,dz/d,dmg>=200?22:9,dmg>=200?4:2.6,zyv[j]);
  if(zhp[j]<=0&&!blast){
    if(dmg>=200&&!(zmiss[j]&4)&&Math.random()<.75) zgib[j]=1;
    else if(Math.random()<.14){ const L=Math.random()<.5; if(!(zmiss[j]&(L?9:18))) zgib[j]=L?2:3; }
  }
  if(zhp[j]<=0){ killZ(j,true); return; }
  if(zst[j]!==3){ zst[j]=2; ztx[j]=fromX; ztz[j]=fromZ; zwt[j]=zl[j]; }
}
// can a shooter on level L hit a zombie at index j? Same floor, or from up high onto the street
function shootable(L,j){ return zl[j]===L||(L>0&&zl[j]===0&&!ztr[j]&&MAP.bld[0][CI(Math.floor(zx[j]),Math.floor(zz[j]))]<0); }

/* ---------- input ---------- */
const keys={}; let mouseX=innerWidth/2, mouseY=innerHeight/3, mouseDown=false, touchMode=false;
const ray=new THREE.Raycaster(), groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.2), hitV=new THREE.Vector3(), ndc=new THREE.Vector2();
// every action and its keys (rebinding comes with the settings menu)
const BIND={up:['w','arrowup'],down:['s','arrowdown'],left:['a','arrowleft'],right:['d','arrowright'],sprint:['shift'],sneak:['c'],dodge:[' '],
  reload:['r'],inv:['tab','i'],build:['k'],squad:['j'],shove:['v'],weapon:['x'],mode:['b'],supp:['n'],throw:['g'],thrNext:['t'],use:['e'],light:['f'],
  hold:['1'],follow:['2'],fallback:['3'],quiet:['4'],lines:['l'],swap:['q'],map:['m'],zoom:['z'],endDay:['enter'],keys:['h'],pixel:['p']};
const KEY2ACT={}; for(const a in BIND) for(const k of BIND[a]) KEY2ACT[k]=a;
function keyDown(a){ for(const k of BIND[a]) if(keys[k]) return true; return false; }
// the point on the floor (plus h metres) under the cursor
function aimPoint(s,h){
  groundPlane.constant=-(s.y+(h||0));
  ndc.set(mouseX/innerWidth*2-1,-(mouseY/innerHeight)*2+1); ray.setFromCamera(ndc,camera);
  if(ray.ray.intersectPlane(groundPlane,hitV)) return {x:hitV.x,z:hitV.z};
  return {x:s.x+Math.sin(s.ang)*8,z:s.z+Math.cos(s.ang)*8};
}
let throwAiming=false;
const LINE_POSTS=[{x:-2.2,z:-12},{x:-8.5,z:-12},{x:2.8,z:-12},{x:8.6,z:-12},{x:-5.4,z:-12},{x:0.3,z:-12},{x:5.7,z:-12},{x:11.2,z:-12}];
function linePost(q){ const p=LINE_POSTS[q.i%LINE_POSTS.length]; return {x:p.x,z:p.z}; }
// E: whatever is closest and makes sense, in this order
function useKey(s){
  if(wsOpen){ wsToggle(); return; }
  if(INV.open){ invClose(); return; }
  if(s.mounted){ dismount(s); return; }
  const g=nearestItem(s,1.6); if(g){ pickUp(s,g); return; }
  const sv=nearestSurvivor(s); if(sv){ recruit(sv); return; }
  const n=nearestNest(s); if(n&&!n.manned){ mount(s,n); return; }
  const wb=nearestFurn(s,f=>f.workbench,1.0); if(wb){ wsToggle(); return; }
  const st=nearestFurn(s,f=>f.stash,1.0); if(st){ invOpen('stash',stash); return; }
  const c=nearestContainer(s); if(c){ invOpen('container',c); return; }
  if(!nearDamagedSeg(s)){ const e=nearestDoor(s.L,s.x,s.z,1.6); if(e) toggleDoor(e); }
}
function act(a,up){
  const s=squad[me];
  if(up){ if(a==='throw'&&throwAiming){ throwAiming=false; if(s.alive) throwIt(s,THR_ORDER[thrSel]); } return; }
  if(a==='hold'){G.order='hold';radioLine('Hold the line.'); for(const q of squad){ if(q.i===me||!present(q)) continue; q.post=linePost(q); q.postL=0; q.postSet=false; } orderAll('hold');}
  else if(a==='follow'){G.order='follow';radioLine('On me.'); orderAll('follow');}
  else if(a==='fallback'){G.order='fallback';radioLine('Back to the shop.'); orderAll('fallback');}
  else if(a==='squad'){ if(INV.open) invClose(); if(wsOpen) wsToggle(); sqToggle(); }
  else if(a==='quiet'){G.weaponsFree=!G.weaponsFree; for(const b of squad) if(b.i!==me) b.lightOn=G.weaponsFree; radioLine(G.weaponsFree?'Weapons free.':'Hold fire. Lights off. Quiet.');}
  else if(a==='swap') swap();
  else if(a==='reload') reload(s);
  else if(a==='shove') shove(s);
  else if(a==='light') s.lightOn=!s.lightOn;
  else if(a==='use') useKey(s);
  else if(a==='inv'){ if(wsOpen) wsToggle(); invToggle(); }
  else if(a==='build'){ if(s.mounted) return; buildToggle(); }
  else if(a==='weapon') cycleWeapon(s);
  else if(a==='mode') cycleMode(s);
  else if(a==='supp') toggleSupp(s);
  else if(a==='throw'){ if(THR[THR_ORDER[thrSel]]>0) throwAiming=true; else radioLine('No '+THR_NAME[THR_ORDER[thrSel]].toLowerCase()+'s left.'); }
  else if(a==='thrNext') thrSel=(thrSel+1)%THR_ORDER.length;
  else if(a==='sneak'){ s.sneak=!s.sneak; }
  else if(a==='dodge') dodgeOrVault(s);
  else if(a==='lines'){G.lightsOn=!G.lightsOn; bannerShow(G.lightsOn?'LIGHTS UP':'LIGHTS OUT','',1.4);}
  else if(a==='keys'){const el=document.getElementById('keys'); el.hidden=!el.hidden;}
  else if(a==='zoom'){G.camHTarget=G.camHTarget>90?68:115;}
  else if(a==='map'){ G.mapOpen=!G.mapOpen; document.getElementById('bigmap').hidden=!G.mapOpen; if(G.mapOpen) drawBigMap(); }
  else if(a==='endDay'){ if(G.phase==='day') G.t=0; }
  else if(a==='pixel'){ userScaleBias=(userScaleBias+1)%3; resize(); }
}
let lastOrderMsg=0;
function radioLine(m){ const n=performance.now(); if(n-lastOrderMsg>400){ radio(m); lastOrderMsg=n; } }
addEventListener('keydown',e=>{
  if(!G.started) return;
  const k=e.key.toLowerCase();
  if(k===' '||k==='tab') e.preventDefault();
  if(keys[k]) return; keys[k]=true;
  if(k==='escape'){ if(G.mapOpen){ act('map'); return; } if(INV.open){ invClose(); return; } if(wsOpen){ wsToggle(); return; } if(SQ.open){ sqToggle(); return; } if(BUILD.on){ buildToggle(); return; }
    G.paused=!G.paused; bannerShow(G.paused?'PAUSED':'', G.paused?'Esc to resume':'',G.paused?9999:0.1); return;}
  if(G.paused) return;
  const a=KEY2ACT[k];
  // with a screen open, only movement and closing it
  if(INV.open||wsOpen||SQ.open){ if(a==='inv'||a==='use'||a==='squad') act(a); return; }
  if(BUILD.on){ if(k>='1'&&k<='9'){ buildSelect(+k-1); return; } if(k==='r'){ BUILD.rot=!BUILD.rot; return; } if(a==='build'){ act(a); return; }
    if(['up','down','left','right','sprint','sneak','map','zoom','light','keys','lines'].includes(a)) act(a); return; }
  if(a==='swap'){ WHEEL.downT=performance.now(); WHEEL.pending=true; return; }
  if(a) act(a);
});
addEventListener('keyup',e=>{ const k=e.key.toLowerCase(); keys[k]=false; const a=KEY2ACT[k];
  if(a==='swap'&&G.started){ if(WHEEL.open) wheelClose(); else if(WHEEL.pending&&!INV.open&&!wsOpen&&!SQ.open) act('swap'); WHEEL.pending=false; return; }
  if(a&&G.started) act(a,true); });
addEventListener('blur',()=>{for(const k in keys) keys[k]=false; mouseDown=false; throwAiming=false;});
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
  if(BUILD.on){ if(e.button===2) buildRightClick(); else buildClick(); return; }
  if(e.button===2) shove(squad[me]); else { mouseDown=true; squad[me].trig=true; }
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
tb('tHold',()=>act('hold')); tb('tFollow',()=>act('follow')); tb('tBack',()=>act('fallback')); tb('tQuiet',()=>act('quiet')); tb('tLights',()=>act('lines'));
tb('tShove',()=>act('shove')); tb('tReload',()=>act('reload')); tb('tSwap',()=>act('swap')); tb('tZoom',()=>act('zoom')); tb('tDay',()=>act('endDay'));
let touchFix=false;
const fixBtn=document.getElementById('tFix');
fixBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();touchFix=true;});
['pointerup','pointercancel','pointerleave'].forEach(ev=>fixBtn.addEventListener(ev,()=>touchFix=false));

function swap(){
  const o=squad[me]; o.sprint=false; o.sneak=false; throwAiming=false;
  for(let k=1;k<=squad.length;k++){ const n=(me+k)%squad.length; if(present(squad[n])){ squad[me].lightOn=G.weaponsFree; me=n; squad[me].lightOn=true; return; } }
}

/* ---------- segment helpers ---------- */
function segAt(x,z,pad){ for(const s of segs){ if(!s.alive) continue; if(x>s.x0-pad&&x<s.x1+pad&&z>s.z0-pad&&z<s.z1+pad) return s; } return null; }
function setSegAlive(s,alive){ s.alive=alive; s.mesh.visible=alive; lineCells(s,alive); }
function nearDamagedSeg(s){ if(s.L!==0) return null; for(const g of segs){ if(g.hp>=g.max) continue; const cx=clamp(s.x,g.x0,g.x1), d=Math.hypot(s.x-cx,s.z-BZ); if(d<3.2) return g; } return null; }
let repairScrap=0;
function repairNear(s,amount,noisy){
  const best=nearDamagedSeg(s); if(!best) return false;
  // scrap goes into the line: one per 30 points
  if(SUP.scrap<=0){ if(s.i===me) radioLine('Out of scrap to fix the line with.'); return false; }
  repairScrap+=amount/30; while(repairScrap>=1){ repairScrap-=1; SUP.scrap=Math.max(0,SUP.scrap-1); }
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
  speed*=(WPN[s.wpn].spd||1)*woundSpeed(s);
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
  const md=moveDir(); let mx=md?md.x:0, mz=md?md.z:0;
  let firing=mouseDown;
  if(sticks.move){ const dx=sticks.move.x-sticks.move.ox, dy=sticks.move.y-sticks.move.oy, m=Math.hypot(dx,dy); if(m>6){const k=Math.min(1,m/60)/m; mx=dx*k; mz=dy*k;} }
  const ml=Math.hypot(mx,mz);
  // aim
  if(touchMode){
    if(sticks.aim){ const dx=sticks.aim.x-sticks.aim.ox, dy=sticks.aim.y-sticks.aim.oy, m=Math.hypot(dx,dy); if(m>12) s.ang=Math.atan2(dx,dy); firing=m>48; }
    else if(ml>0.2) s.ang=Math.atan2(mx,mz);
    if(firing&&!sticks.aim) firing=false;
  } else if(s.actT<=0){ const p=aimPoint(s,1.2); s.ang=Math.atan2(p.x-s.x,p.z-s.z); }
  if(s.vault){ stepVault(s,dt); s.status='VAULT'; return; }
  if(s.mounted){ stepMounted(s,dt); const W=WPN.m240;
    if(firing&&!G.mapOpen&&!INV.open&&s.reloadT<=0&&s.fireCD<=0){ if(s.mags.m240>0) fire(s,s.ang,-1); else if(s.trig){ s.trig=false; if(!reload(s)&&AC) SFX.click(0,0.4); } }
    if(!mouseDown) s.trig=true; s.status='ON THE GUN'; return; }
  if(s.dodge){ stepDodge(s,dt); s.status='DODGE'; return; }
  // sprint: fast, loud, gun down, burns stamina
  if(BUILD.on||INV.open||wsOpen||WHEEL.open||SQ.open) firing=false;
  const wantSprint=keyDown('sprint')&&ml>0.2&&!firing&&!throwAiming&&s.actT<=0;
  if(wantSprint&&!s.sprint&&s.stam>20&&s.wounds.leg<2){ s.sprint=true; s.sneak=false; cancelReload(s); }
  if(s.sprint&&(!wantSprint||s.stam<=0)) s.sprint=false;
  if(s.sprint){ s.stam=Math.max(0,s.stam-19*dt*(hasPerk(s,'runner')?0.6:1)); s.stamT=0.7; }
  const speed=s.actT>0?0:s.sprint?6.6:s.sneak?1.9:throwAiming?2.6:3.9;
  moveSoldier(s,mx,mz,speed,dt);
  footsteps(s,dt);
  // trigger
  const W=WPN[s.wpn], mode=modeOf(s);
  if(firing&&!G.mapOpen&&!s.sprint&&!throwAiming&&s.actT<=0&&s.drawT<=0&&s.throwT<=0){
    if(W.melee){ swing(s); }
    else if(s.reloadT>0){ if(s.mags[s.wpn]>0&&s.trig){ cancelReload(s); } }
    else if(s.fireCD<=0&&s.cycleT<=0){
      const auto=mode==='AUTO';
      if(s.mags[s.wpn]>0){ if(auto||s.trig){ fire(s,s.ang,-1); s.trig=false; } }
      else if(s.trig){ s.trig=false; if(!reload(s)){ if(AC) SFX.click(0,0.4); s.fireCD=0.3; } }
    }
  }
  if(!mouseDown) s.trig=true;
  if((keyDown('use')||touchFix)&&repairNear(s,70*dt*(hasPerk(s,'handy')?1.5:1),G.phase!=='day')){ s.repXP=(s.repXP||0)+dt; if(s.repXP>5){ s.repXP=0; giveXP(s,3,'build'); } }
  s.status=s.reloadT>0?'RELOAD':s.sprint?'SPRINT':s.hiding?'HIDDEN':s.sneak?'SNEAK':'YOU';
}
// nearest zombie this soldier can actually see
function pickTarget(s,R,sector){
  let bj=-1,bd=R*R; const cand=[];
  for(let j=0;j<MAXZ;j++){ if(!zst[j]||zst[j]===5||!shootable(s.L,j)) continue; const ex=zx[j]-s.x, ez=zz[j]-s.z, d2=ex*ex+ez*ez; if(d2>=bd) continue;
    if(sector){ let da=Math.atan2(ex,ez)-sector.a; while(da>Math.PI) da-=Math.PI*2; while(da<-Math.PI) da+=Math.PI*2; if(Math.abs(da)>sector.w&&d2>9) continue; }
    cand.push([d2,j]); }
  cand.sort((a,b)=>a[0]-b[0]);
  for(let k=0;k<Math.min(5,cand.length);k++){ const j=cand[k][1]; if(los(s.L,s.x,s.z,zx[j],zz[j])) return j; }
  return bj;
}
function updateBuddy(s,dt){
  const p=squad[me];
  if(s.vault){ stepVault(s,dt); return; }
  if(s.scav){ stepScavOut(s,dt); s.status='HEADING OUT'; footsteps(s,dt); return; }
  // where this soldier wants to be, from their own order
  let gx=s.post.x, gz=s.post.z, gL=s.postL||0, fixing=false;
  const o=s.order;
  if(o==='follow'){ const followers=squad.filter(q=>q.i!==me&&present(q)&&q.order==='follow'); const sl=followSlot(Math.max(0,followers.indexOf(s)));
    gx=p.x+sl.x; gz=p.z+sl.z; gL=p.L;
    if(!cellWalk(gL,Math.floor(gx),Math.floor(gz))){ gx=p.x; gz=p.z; } }
  else if(o==='fallback'){ const sp=BACK_SPOTS[s.i%BACK_SPOTS.length]; gx=sp.x; gz=sp.z; gL=0; }
  else if(o==='heal'){ const t=s.healTgt; if(!t||!present(t)){ s.order='hold'; } else { gx=t.x; gz=t.z; gL=t.L;
    if(t.L===s.L&&Math.hypot(t.x-s.x,t.z-s.z)<1.4){ healSomeone(s,t); s.order='hold'; } } }
  else if(o==='mg'){ const n=s.nest; if(!n||n.dead||(n.manned&&n.manned!==s)){ s.order='hold'; } else if(!s.mounted){ const g=mgSpot(n); gx=g.x; gz=g.z; gL=n.L; if(Math.hypot(g.x-s.x,g.z-s.z)<0.9) mount(s,n); } }
  else if(o==='rest'){ if(G.phase==='night'){ s.order='hold'; s.resting=false; } else { const cot=s.cot||(s.cot=nearestFurn({L:0,x:-15,z:12},f=>f.type==='cot'&&MAP.blds[f.b].kind==='base'&&!squad.some(q=>q!==s&&q.cot===f),40));
    if(cot){ const cx=(cot.x0+cot.x1)/2, cz=(cot.z0+cot.z1)/2, sp=findSpot(0,cx-1,cz)||{x:cx-1,z:cz}; gx=sp.x; gz=sp.z; gL=0; s.resting=Math.hypot(gx-s.x,gz-s.z)<0.8; } } }
  else if(o==='scav'){ s.order='hold'; }
  if(G.phase==='day'&&o==='hold'&&!s.postSet){
    let worst=null; for(const g of segs) if(g.hp<g.max&&(!worst||g.hp/g.max<worst.hp/worst.max)) worst=g;
    if(worst&&SUP.scrap>0){ gx=clamp((worst.x0+worst.x1)/2+((s.i%4)-1.5)*0.8,worst.x0+0.5,worst.x1-0.5); gz=BZ+1.6; gL=0; fixing=true; }
  }
  // the gun: stay put, sweep the arc, fire at whatever's in it
  if(s.mounted){ stepMounted(s,dt); s.status='ON THE GUN'; }
  // in a fight at a post: get behind something
  if((o==='hold'||o==='watch')&&!fixing&&s.aimJ>=0&&zst[s.aimJ]&&!s.mounted){
    s.coverT=(s.coverT||0)-dt;
    if(s.coverT<=0){ s.coverT=1.6; s.cover=findCover(s,zx[s.aimJ],zz[s.aimJ]); }
    if(s.cover&&Math.hypot(s.cover.x-s.post.x,s.cover.z-s.post.z)<3){ gx=s.cover.x; gz=s.cover.z; }
  }
  // follow the player into quiet: sneak when they sneak
  s.sneak=o==='follow'&&p.sneak;
  const d=Math.hypot(gx-s.x,gz-s.z);
  if(s.mounted){}
  else if(s.actT<=0) navTo(s,gx,gz,gL,(s.sneak?1.9:d>6?4.4:3.2),dt); else { s.vx*=0.8; s.vz*=0.8; }
  footsteps(s,dt);
  if(fixing&&d<1.6&&repairNear(s,40*dt*(hasPerk(s,'handy')?1.5:1),false)) s.repXP=(s.repXP||0)+dt;
  if(s.repXP>6){ s.repXP=0; giveXP(s,3,'build'); }
  autoHeal(s);
  const W=WPN[s.wpn];
  // out of ammo for this gun: go to the next one that has some
  if(!s.mounted&&!W.melee&&s.mags[s.wpn]<=0&&AMMO[W.ammo]<=0&&s.reloadT<=0){ for(let k=0;k<3;k++){ const kk=s.inv[k]; if(kk&&kk!==s.wpn&&(WPN[kk].melee||s.mags[kk]>0||AMMO[WPN[kk].ammo]>0)){ equip(s,k); break; } } }
  // find a target
  s.aimT=(s.aimT||0)-dt;
  const range=W.melee?6:Math.min(W.pellets?15:W.range*0.9,26+(W.key==='m24'?8:0)+(s.mounted?10:0),G.fogFar*1.05+3);
  const had=s.aimJ>=0;
  if(s.aimT<=0){ s.aimT=0.25; s.aimJ=pickTarget(s,range,s.mounted?{a:s.mounted.ang,w:1.25}:s.order==='watch'&&s.watch!==null?{a:s.watch,w:1.0}:null); }
  let bj=s.aimJ??-1; if(bj>=0&&(!zst[bj]||zst[bj]===5)) bj=-1;
  if(bj>=0&&!had&&time-(s.lastContact||-99)>20){ s.lastContact=time; if(G.phase!=='day') bark(s,'contact'); }
  const td=bj>=0?Math.hypot(zx[bj]-s.x,zz[bj]-s.z):99;
  let want=d>0.6&&!s.mounted?Math.atan2(s.vx,s.vz):(o==='watch'&&s.watch!==null?s.watch:s.mounted?s.mounted.ang:s.ang);
  if(bj>=0) want=Math.atan2(zx[bj]-s.x,zz[bj]-s.z);
  let da=want-s.ang; while(da>Math.PI) da-=Math.PI*2; while(da<-Math.PI) da+=Math.PI*2; if(s.actT<=0) s.ang+=da*Math.min(1,dt*(s.mounted?4:8));
  if(!G.weaponsFree&&s.stress>85&&s.panic<=0&&bj>=0&&Math.random()<dt*0.45){ s.panic=1.4; radio(nameOf(s)+' is losing it.'); for(const q of squad) if(q!==s&&present(q)&&Math.hypot(q.x-s.x,q.z-s.z)<10) relAdd(q,s,-2); }
  if(s.panic>0) s.panic-=dt;
  if(!s.mounted) s.status=fixing?'REPAIR':s.resting?'RESTING':({follow:'FOLLOW',fallback:'FALL BACK',watch:'WATCH',heal:'MEDIC',mg:'TO THE GUN',rest:'TO A COT'}[o]||'HOLD');
  if(s.reloadT>0){ if(W.shell&&bj>=0&&td<10&&s.mags[s.wpn]>0) cancelReload(s); else { s.status='RELOAD'; return; } }
  if(s.drawT>0||s.actT>0) return;
  if(!s.mounted&&bj>=0&&td<1.9&&s.meleeCD<=0&&Math.abs(da)<0.8){ if(W.melee) swing(s); else shove(s); return; }
  if(W.melee) return;
  const canFire=(G.weaponsFree||s.panic>0)&&bj>=0&&Math.abs(da)<0.25&&s.fireCD<=0&&s.cycleT<=0&&!s.trav;
  if(!G.weaponsFree) s.status=s.panic>0?'PANIC':'QUIET';
  if(canFire){ if(s.mags[s.wpn]>0) fire(s,s.ang,bj); else { if(reload(s)&&bj>=0) bark(s,'reload'); } }
  else if(bj<0&&s.mags[s.wpn]<magCap(s)*0.4) reload(s);
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
  // how far away the dead can pick each soldier out: lights make you visible, sneaking and hiding in the dark don't
  for(const s of squad){ s.near=0; s.sight=present(s)?(6.5+(s.lightOn?7.5:0)+(inLight(s)?6:0))*(G.fogFar<35?0.9:1.25)*(s.sneak?0.6:1):0; if(s.hiding) s.sight=Math.min(s.sight,2.2); }
  const NF=noiseField();
  for(let i=0;i<MAXZ;i++){
    const st=zst[i]; if(!st) continue;
    if(st===5){ updateDying(i,dt); continue; }
    if(zburn[i]>0&&burnZ(i,dt)) continue;
    zA.x=zx[i]; zA.z=zz[i]; zA.L=zl[i]; zA.trav=ztr[i];
    // on the stairs or climbing through a window
    if(zA.trav){
      const T=zA.trav; travStep(zA,dt,T.climb?1.5:1.6*zspd[i]);
      zx[i]=zA.x; zz[i]=zA.z; zl[i]=zA.L; ztr[i]=zA.trav;
      zyv[i]=T.climb?zl[i]*LH+Math.sin(Math.min(1,T.t)*Math.PI)*0.55:agentY(zA);
      zph[i]+=dt*3; drawZ(i,1.0,dt); continue;
    }
    zyv[i]=zl[i]*LH;
    // staggered: stands there reeling
    if(zstun[i]>0){ zstun[i]-=dt; zvx[i]*=0.85; zvz[i]*=0.85; zph[i]+=dt*0.6; if(zfl[i]>0) zfl[i]=Math.max(0,zfl[i]-dt*2); drawZ(i,0.2,dt); continue; }
    let x=zx[i], z=zz[i]; const L=zl[i];
    zmoan[i]-=dt; zcd[i]-=dt; zLosT[i]-=dt;
    // senses: nearest soldier it can see on its own floor
    let bs=-1,bd2=1e9;
    for(let k=0;k<squad.length;k++){ const s=squad[k]; if(!present(s)||s.L!==L) continue; const dx=s.x-x, dz=s.z-z, d2=dx*dx+dz*dz; if(d2<64) s.near++; if(d2<bd2){bd2=d2;bs=k;} }
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
      let s=squad[ztgt[i]]; if(!s||!present(s)){ zst[i]=4; zwt[i]=2; continue; }
      const sd=Math.hypot(s.x-x,s.z-z);
      if(zSees[i]===ztgt[i]){ zLost[i]=0; ztx[i]=s.x; ztz[i]=s.z; zwt[i]=s.L; } else zLost[i]+=dt;
      // lost them: gone dark and quiet somewhere, or just too far. Go look where they were last seen
      if((s.hiding&&zLost[i]>2.5)||(zSees[i]<0&&sd>s.sight*1.8+10)){ zst[i]=2; ztx[i]+=rand(-2,2); ztz[i]+=rand(-2,2); zDirect[i]=0; continue; }
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
    for(const s of squad){ if(!present(s)||s.L!==L) continue; const ex=x+mvx-s.x, ez=z+mvz-s.z, d2=ex*ex+ez*ez; if(d2<0.5&&d2>1e-6){const d=Math.sqrt(d2),k=(0.71-d)/d; mvx+=ex*k; mvz+=ez*k;} }
    { const tk=stepTraps(i,dt); if(!zst[i]||zst[i]===5) continue; mvx*=tk; mvz*=tk; }
    const ox0=zA.x, oz0=zA.z;
    const hit=moveAgent(zA,mvx,mvz,0.3,AG.ZOMBIE);
    // blocked by something the squad built: tear at it
    if((cs===3||cs===2)&&!zA.trav){ const want=Math.hypot(mvx,mvz); if(want>1e-4&&Math.hypot(zA.x-ox0,zA.z-oz0)<want*0.4) bashBuilt(i,L,zA.x,zA.z,dx,dz,dt,nightMul); }
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
      if(s.L===L&&Math.hypot(s.x-nx,s.z-nz)<1.05&&s.iframe<=0&&!s.vault){
        zcd[i]=0.95; s.hp-=10*nightMul*(hasPerk(s,'tough')?0.8:1); s.stress=Math.min(100,s.stress+9); woundOnBite(s,nx,nz); if(s.mounted&&s.i!==me) dismount(s);
        bleed(s.x,1.2,s.z,s.x-nx,s.z-nz,7,1.6,s.y);
        if(bs===me){ hurtFlash=0.35; G.shake=Math.max(G.shake,0.55); const dd=Math.hypot(s.x-nx,s.z-nz)||1; G.kickX+=(s.x-nx)/dd*0.5; G.kickZ+=(s.z-nz)/dd*0.5; cancelReload(s); }
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
  bannerShow(s.short+' IS DOWN','',2.2); if(s.mounted) dismount(s); onSoldierLost(s); const wit=squad.find(q=>q!==s&&present(q)); if(wit) bark(wit,'down',true);
  if(s.i===me){ const alive=squad.find(q=>present(q)); if(alive){ me=alive.i; alive.lightOn=true; } }
  if(!squad.some(q=>present(q))&&!squad.some(q=>q.alive&&q.away)) gameOver();
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
const lineEl=document.getElementById('line');
lineEl.innerHTML='<span>LINE</span>'+segs.map(()=>'<i><b></b></i>').join('');
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
  if(G.phase==='day'){ const h=Math.floor(G.t/HOUR), m=Math.floor((G.t%HOUR)/HOUR*60); phaseEl.textContent='Fog thin · '+h+'h '+String(m).padStart(2,'0')+'m of light left'; }
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
  document.getElementById('supplies').textContent='FOOD '+SUP.food+' · WATER '+SUP.water+' · FUEL '+SUP.fuel+' · SCRAP '+SUP.scrap;
  if(BUILD.on&&Math.random()<0.3) renderBuildBar();
  document.getElementById('noiseBar').style.width=(G.noise*100).toFixed(0)+'%';
  { const s=squad[me], W=WPN[s.wpn], el=id=>document.getElementById(id);
    const tags=[]; for(const m of ['supp','scope','ext','grip']) if(hasMod(s,m)) tags.push(m==='supp'?'SUPP':m==='ext'?'EXT':m.toUpperCase()); if(s.bay&&s.wpn==='m4') tags.push('BAYONET');
    el('stance').textContent=[s.sprint?'SPRINTING':'',s.sneak?'SNEAKING':'',s.hiding?'HIDDEN':''].filter(Boolean).join(' · ');
    el('wName').textContent=W.name; el('wTags').textContent=tags.join(' ');
    const mg=el('wMag');
    if(W.melee){ mg.textContent='—'; mg.className=''; el('wPool').textContent=s.inv[0]||s.inv[1]?'X to draw a gun':''; el('wMode').textContent='MELEE'; }
    else { const m=s.mags[s.wpn]; mg.textContent=m; mg.className=m===0?'out':m<=magCap(s)*0.25?'low':''; el('wPool').textContent='/ '+AMMO[W.ammo]+' '+AMMO_NAME[W.ammo]; el('wMode').textContent=modeOf(s); }
    el('wRel').style.width=(s.reloadT>0?(1-s.reloadT/s.reloadMax)*100:0)+'%';
    el('wThr').innerHTML=THR_ORDER.map((k,i)=>`<span class="${i===thrSel?'on':''}">${THR_NAME[k]} ${THR[k]}</span>`).join('');
    el('wStam').style.width=s.stam.toFixed(0)+'%'; el('wStam').style.background=s.stam<20?'var(--warn)':''; }
  updateCards();
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
    else if(MAP.block[0][c]===BLK.BUILT) col=hex('#b0a070');
    else if(trapGrid[0][c]>=0) col=hex('#7a6040');
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
  for(const s of squad){ if(!present(s)) continue; const [sx,sy]=toS(s.x,s.z); mmx.fillStyle=s.i===me?'#f0e6b8':'#c9bc80'; mmx.beginPath(); mmx.arc(sx,sy,s.i===me?3.5:2.5,0,7); mmx.fill(); }
  const [sx,sy]=toS(p.x,p.z); mmx.strokeStyle='#f0e6b8'; mmx.lineWidth=1.5; mmx.beginPath(); mmx.moveTo(sx,sy); mmx.lineTo(sx+Math.sin(p.ang)*9,sy+Math.cos(p.ang)*9); mmx.stroke();
  mmx.strokeStyle='rgba(201,188,128,.5)'; mmx.lineWidth=1; mmx.strokeRect(0.5,0.5,W-1,H-1);
}
const bm=document.getElementById('bigmapC'), bmx=bm.getContext('2d');
function drawBigMap(){
  if(minimapDirty) drawMapBase();
  const X0=-125,X1=125,Z0=-150,Z1=138, W=X1-X0, H=Z1-Z0;
  const sc=Math.min((innerWidth*0.9)/W,(innerHeight*0.84)/H);
  bm.width=Math.round(W*sc); bm.height=Math.round(H*sc);
  G.bmS={X0,Z0,sc};
  bmx.imageSmoothingEnabled=false; bmx.drawImage(mapBase,X0-GX0,Z0-GZ0,W,H,0,0,bm.width,bm.height);
  const toS=(x,z)=>[(x-X0)*sc,(z-Z0)*sc];
  bmx.font=`${Math.max(10,sc*3.2)|0}px "IBM Plex Mono", monospace`; bmx.textAlign='center'; bmx.fillStyle='rgba(220,214,182,.75)';
  for(const s of ST_NS){ const [x,y]=toS(s.x,-134); bmx.save(); bmx.translate(x,y); bmx.rotate(-Math.PI/2); bmx.fillText(s.n,0,4); bmx.restore(); }
  for(const s of ST_EW){ const [x,y]=toS(-36,s.z); bmx.fillText(s.n,x,y+4); }
  bmx.font=`bold ${Math.max(10,sc*3)|0}px "Big Shoulders Stencil Display", Impact, sans-serif`; bmx.fillStyle='#f0e6b8';
  for(const B of MAP.blds){ if(!B.enter||!B.name||B.kind==='store') continue; const [x,y]=toS((B.x0+B.x1)/2,(B.z0+B.z1)/2); bmx.fillText(B.kind==='base'?'BASE':B.name,x,y); }
  for(const v of survivors){ if(!v.seen) continue; const [x,y]=toS(v.x,v.z); bmx.strokeStyle='#d8893c'; bmx.beginPath(); bmx.arc(x,y,4,0,7); bmx.stroke(); }
  if(pickScav){ bmx.fillStyle='#d8893c'; bmx.font=`bold ${Math.max(12,sc*3.6)|0}px "Big Shoulders Stencil Display", Impact, sans-serif`; bmx.fillText('CLICK A BUILDING FOR '+pickScav.short,bm.width/2,24); }
  for(const s of squad){ if(!present(s)) continue; const [x,y]=toS(s.x,s.z); bmx.fillStyle=s.i===me?'#f0e6b8':'#c9bc80'; bmx.beginPath(); bmx.arc(x,y,s.i===me?5:3.5,0,7); bmx.fill(); }
}

// picking a building on the big map for a scavenging run
bm.addEventListener('click',e=>{
  if(!pickScav||!G.bmS) return;
  const r=bm.getBoundingClientRect(), x=G.bmS.X0+(e.clientX-r.left)/G.bmS.sc, z=G.bmS.Z0+(e.clientY-r.top)/G.bmS.sc;
  const b=bldAt(0,x,z); if(b<0||!MAP.blds[b].enter||MAP.blds[b].kind==='base'){ radioLine('Pick a building you can get into.'); return; }
  const s=pickScav; pickScav=null; scavTo(s,MAP.blds[b]); act('map');
});
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
    if(s.i===me&&s.alive) continue; if(!s.mesh.visible||s.away) continue;
    tagV.set(s.x,(s.alive?2.75:0.9)+s.y,s.z).project(camera);
    if(tagV.z>1) continue;
    const tx=(tagV.x*0.5+0.5)*FW, ty=(-tagV.y*0.5+0.5)*FH;
    const label=s.short+(s.alive?'':' · DOWN');
    fctx.lineWidth=3*DPR; fctx.strokeStyle='rgba(10,11,8,.75)'; fctx.strokeText(label,tx,ty);
    fctx.fillStyle=s.alive?(s.panic>0?'#d8893c':'#c9c08e'):'#7d7a66'; fctx.fillText(label,tx,ty);
  }
  const pp=squad[me];
  if(throwAiming&&pp.alive){
    const T=throwTarget(pp), P=throwPath(pp,T);
    fctx.fillStyle='rgba(230,220,203,.7)';
    for(let k=1;k<=18;k++){ const t=P.ft*k/18; tagV.set(P.x0+P.vx*t,P.y0+P.vy*t-0.5*G_GRAV*t*t,P.z0+P.vz*t).project(camera); fctx.beginPath(); fctx.arc((tagV.x*0.5+0.5)*FW,(-tagV.y*0.5+0.5)*FH,1.6*DPR,0,7); fctx.fill(); }
    const kind=THR_ORDER[thrSel], R=kind==='frag'?6.5:kind==='molotov'?2.6:1.2;
    fctx.strokeStyle=kind==='decoy'?'rgba(230,220,203,.6)':'rgba(216,137,60,.75)'; fctx.lineWidth=1.5*DPR; fctx.beginPath();
    for(let k=0;k<=32;k++){ const a=k/32*Math.PI*2; tagV.set(T.x+Math.sin(a)*R,T.y+0.05,T.z+Math.cos(a)*R).project(camera); const X=(tagV.x*0.5+0.5)*FW, Y=(-tagV.y*0.5+0.5)*FH; k?fctx.lineTo(X,Y):fctx.moveTo(X,Y); }
    fctx.stroke();
  }
  if(pp.alive&&G.started){
    const it=nearestItem(pp,1.6);
    fctx.font=(11*DPR)+'px "IBM Plex Mono", monospace';
    if(it){ tagV.set(it.x,it.L*LH+0.6,it.z).project(camera); const X=(tagV.x*0.5+0.5)*FW, Y=(-tagV.y*0.5+0.5)*FH, t='E · '+itemName(it);
      fctx.lineWidth=3*DPR; fctx.strokeStyle='rgba(10,11,8,.8)'; fctx.strokeText(t,X,Y); fctx.fillStyle='#f0e6b8'; fctx.fillText(t,X,Y); }
    else if(!INV.open&&!wsOpen&&(()=>{ const n=nearestNest(pp), wb=nearestFurn(pp,f=>f.workbench,1.0), st=nearestFurn(pp,f=>f.stash,1.0), c=(n||wb||st)?null:nearestContainer(pp);
      let t='', x=0, y=0, z=0;
      const sv=nearestSurvivor(pp);
      if(sv){ t='E · TALK TO '+sv.d.name.toUpperCase(); x=sv.x; z=sv.z; y=sv.L*LH+1.8; sv.seen=true; }
      else if(pp.mounted){ t='E · LEAVE THE GUN'; x=pp.x; z=pp.z; y=pp.y+2.4; }
      else if(n&&!n.manned){ const g=mgSpot(n); t='E · MAN THE GUN'; x=g.x; z=g.z; y=pp.y+1.6; }
      else if(wb){ t='E · WORKBENCH'; x=(wb.x0+wb.x1)/2; z=(wb.z0+wb.z1)/2; y=wb.L*LH+1.4; }
      else if(st){ t='E · STASH'; x=(st.x0+st.x1)/2; z=(st.z0+st.z1)/2; y=st.L*LH+1.4; }
      else if(c){ t='E · '+(c.rolled&&!c.grid.items.length?'EMPTY ':'')+(c.rolled?'':'SEARCH ')+(CNAME[c.kind]||'CONTAINER'); x=c.x; z=c.z; y=c.L*LH+(c.f.h||1)+0.4; }
      if(!t) return false;
      tagV.set(x,y,z).project(camera); const X=(tagV.x*0.5+0.5)*FW, Y=(-tagV.y*0.5+0.5)*FH;
      fctx.lineWidth=3*DPR; fctx.strokeStyle='rgba(10,11,8,.8)'; fctx.strokeText(t,X,Y); fctx.fillStyle='#f0e6b8'; fctx.fillText(t,X,Y); return true; })()){}
    else if(pp.actT<=0){ const j=frontZombie(pp,1.6,0.5,j=>unaware(j,pp));
      if(j>=0){ tagV.set(zx[j],zyv[j]+2.3,zz[j]).project(camera); const X=(tagV.x*0.5+0.5)*FW, Y=(-tagV.y*0.5+0.5)*FH, t='V · QUIET KILL';
        fctx.lineWidth=3*DPR; fctx.strokeStyle='rgba(10,11,8,.8)'; fctx.strokeText(t,X,Y); fctx.fillStyle='#d8893c'; fctx.fillText(t,X,Y); } }
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
      if(s.away){ stepAway(s,dt); continue; }
      stepWounds(s,dt); if(!s.alive) continue; stepFatigue(s,dt);
      s.fireCD-=dt; s.meleeCD-=dt; s.cycleT-=dt; s.drawT-=dt; s.actT-=dt; s.iframe-=dt; s.throwT-=dt; s.loudT-=dt;
      s.bloom=Math.max(0,s.bloom-dt*(WPN[s.wpn].bloomMax||0)*2.2);
      s.stamT-=dt; if(s.stamT<=0&&!s.sprint) s.stam=Math.min(100,s.stam+(s.hp<45?9:16)*(s.fat>60?0.6:1)*dt);
      stepReload(s,dt);
      if(s.i===me) updatePlayer(s,dt); else updateBuddy(s,dt);
      // hidden: inside, light off, keeping still or creeping, and not having fired lately
      s.hiding=indoors(s.L,s.x,s.z)&&!s.lightOn&&(s.sneak||Math.hypot(s.vx,s.vz)<0.4)&&s.loudT<=0;
    }
    updateZombies(dt);
    for(const s of squad){ if(!present(s)) continue;
      const lit=inLight(s), gain=s.near*3.2*s.stressK*relStressMul(s)*(hasPerk(s,'cool')?0.7:1)*(s.fat>60?1.2:1);
      s.stress=clamp(s.stress+gain*dt-(s.near===0?(lit?7:2.5)+(s.resting?6:0):0)*dt,0,100);
    }
    updateSurvivors(dt);
    G.noise=Math.max(0,G.noise-dt*0.35);
    hurtFlash=Math.max(0,hurtFlash-dt);
    updateProj(dt); updateFires(dt); updateStructs(dt); updateInv(dt);
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
    const hidden=(s.i!==me&&charHidden(s.L,s.x,s.z,s.y))||!!s.away;
    s.mesh.visible=!hidden;
    if(!s.alive||s.away) continue;
    { const u=s.mesh.userData, sp=s.trav?2.5:Math.hypot(s.vx,s.vz), d=dt||0.016;
      // body: rolls, vault hops, a crouch when sneaking, a lean when sprinting
      let rx=0, ry=s.ang, ox=0, oz=0, oy=s.hop||0;
      if(s.dodge){ const k=Math.min(1,s.dodge.t/s.dodge.dur), c=0.9; ry=Math.atan2(s.dodge.dx,s.dodge.dz); rx=k*Math.PI*2;
        oy=c-c*Math.cos(rx); ox=-Math.sin(ry)*c*Math.sin(rx); oz=-Math.cos(ry)*c*Math.sin(rx); }
      else if(s.vault){ const k=Math.min(1,s.vault.t); ry=Math.atan2(s.vault.x1-s.vault.x0,s.vault.z1-s.vault.z0); rx=Math.sin(k*Math.PI)*0.45; }
      s.mesh.position.set(s.x+ox,s.y+oy,s.z+oz); s.mesh.rotation.set(rx,ry,0);
      s.walk+=d*sp*(s.sprint?1.9:2.4); const st=Math.min(1,sp/3.5);
      const hurt=s.hp<45;
      if(d>0&&!(s.boots>0)){ for(let pi=pools.length-1;pi>=0&&pi>pools.length-30;pi--){ const q=pools[pi]; if(Math.abs((q.y||0)-s.y)<1&&Math.hypot(q.x-s.x,q.z-s.z)<q.r+0.3){ s.boots=10; break; } } }
      if(s.boots>0&&sp>0.6&&!s.trav){ s.step+=sp*d; if(s.step>0.62){ s.step=0; s.foot*=-1; const a=Math.atan2(s.vx,s.vz), kk=s.boots/10;
        splat(s.x+Math.cos(a)*0.13*s.foot,s.z-Math.sin(a)*0.13*s.foot,0.12*(0.6+kk*0.4),0.24*(0.6+kk*0.4),a,s.y); s.boots-=1; } }
      const crouch=s.sneak?1:0, swingA=s.sprint?0.95:0.65;
      u.legs[0].rotation.x=Math.sin(s.walk)*swingA*st+crouch*0.35; u.legs[1].rotation.x=-Math.sin(s.walk)*(hurt?0.18:swingA)*st+(hurt?0.12*st:0)+crouch*0.35;
      if(s.kickT>0){ s.kickT-=d; u.legs[0].rotation.x=-1.4*Math.sin(Math.max(0,0.35-s.kickT)/0.35*Math.PI); }
      if(s.vault){ u.legs[0].rotation.x=-0.9; u.legs[1].rotation.x=-0.3; }
      u.torso.position.y=0.86-crouch*0.12+(hurt?Math.max(0,Math.sin(s.walk))*0.08:Math.abs(Math.sin(s.walk))*0.035)*st;
      u.torso.rotation.z=hurt?(0.06+Math.sin(s.walk)*0.07*st):0;
      u.torso.rotation.x=crouch*0.3+(s.sprint?0.22:0);
      s.recoil=Math.max(0,s.recoil-d*9); s.shoveT=Math.max(0,s.shoveT-d); s.swingT=Math.max(0,s.swingT-d);
      const shv=s.shoveT>0?Math.sin((0.25-s.shoveT)/0.25*Math.PI):0;
      const W=WPN[s.wpn];
      let wx=-s.recoil*0.08-shv*0.3, wy=shv*0.4, wz=-s.recoil*0.09+shv*0.28;
      if(s.reloadT>0){ const k=1-s.reloadT/s.reloadMax; wx=W.shell?0.35+Math.sin(time*14)*0.05:0.55+Math.sin(k*Math.PI*3)*0.12; wy=W.shell?0:-0.25*Math.sin(k*Math.PI); }
      if(s.cycleT>0) wz-=Math.sin(s.cycleT/(W.rof*0.9)*Math.PI)*0.06;
      if(s.sprint) { wx=0.85; wy=-0.6; }
      if(s.drawT>0) wx=0.9*s.drawT/0.35;
      if(s.swingT>0){ const k=1-s.swingT/0.32; wx=-0.7+k*1.7; wy=0.9-k*1.8; }
      if(s.throwT>0){ const k=1-s.throwT/0.45; wx=-1.6*Math.sin(k*Math.PI); }
      else if(s.i===me&&throwAiming) wx=-1.2;
      u.W.position.set(0,0,wz); u.W.rotation.set(wx,wy,0);
    }
    const lit=s.lightOn&&!hidden;
    s.light.position.set(s.x+Math.sin(s.ang)*0.4,s.y+1.6,s.z+Math.cos(s.ang)*0.4);
    s.tgt.position.set(s.x+Math.sin(s.ang)*8,s.y,s.z+Math.cos(s.ang)*8);
    s.light.intensity=lit?(s.i===me?1.7:0.9):0;
    s.light.distance=s.i===me?32:22;
    s.cone.position.set(s.x+Math.sin(s.ang)*0.55,s.y+1.5,s.z+Math.cos(s.ang)*0.55); s.cone.rotation.set(0.1,s.ang,0);
    const inside=indoors(s.L,s.x,s.z);
    s.cone.material.uniforms.uOp.value=lit?(s.i===me?0.42:0.3)*(0.3+fogDen)*(inside?0.35:1):0;
    const lh=s.halo; lh.position.copy(s.cone.position); lh.material.opacity=lit?0.5*(0.4+fogDen)*(inside?0.5:1):0;
  }
  for(const s of squad) if(!s.alive||s.away){ s.cone.material.uniforms.uOp.value=0; s.halo.material.opacity=0; s.light.intensity=0; }
  // camera
  const p=squad[me];
  G.camH=lerp(G.camH,G.camHTarget,Math.min(1,(dt||0.016)*3));
  const cx=lerp(camera.position.x,p.x,Math.min(1,(dt||0.016)*5)), cz=lerp(camera.position.z-CAM_BACK,p.z,Math.min(1,(dt||0.016)*5));
  G.shake=Math.max(0,G.shake-(dt||0.016)*2.8);
  const shk=G.shake*G.shake*0.9, sx_=(Math.random()*2-1)*shk, sz_=(Math.random()*2-1)*shk;
  const cy=G.camH+p.y, kd=Math.min(1,(dt||0.016)*9);
  G.kickX=lerp(G.kickX,0,kd); G.kickZ=lerp(G.kickZ,0,kd);
  const kx=sx_+G.kickX*0.5, kz=sz_+G.kickZ*0.5;
  camera.position.set(cx+kx,cy,cz+CAM_BACK+kz); camera.lookAt(cx+kx,p.y,cz-1+kz);
  lowHealth(p,dt||0.016);
  updateLaser(); updateBuild();
  if(WHEEL.pending&&!WHEEL.open&&performance.now()-WHEEL.downT>180&&!INV.open&&!wsOpen&&!SQ.open&&!BUILD.on) wheelOpen();
  if(SQ.open&&Math.random()<0.05) renderSQ();
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

// low health: the world drains of colour and the sound goes underwater; a heartbeat when it's bad
let lowK=0, lastFilter='', heartT=0;
function lowHealth(p,dt){
  const want=p.alive?clamp((48-p.hp)/38,0,1):0; lowK=lerp(lowK,want,Math.min(1,dt*3));
  const f=lowK>0.02?`saturate(${(1-0.85*lowK).toFixed(2)}) contrast(${(1+0.12*lowK).toFixed(2)})`:'';
  if(f!==lastFilter){ glCanvas.style.filter=f; lastFilter=f; }
  if(AC&&muffle) muffle.frequency.setTargetAtTime(lowK>0.02?20000*Math.pow(0.03,lowK):20000,AC.currentTime,0.2);
  heartT-=dt; if(AC&&lowK>0.3&&heartT<=0&&G.started&&!G.paused){ heartT=1.25-lowK*0.45; SFX.heart(0.5*lowK); }
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
