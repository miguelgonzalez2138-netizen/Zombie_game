'use strict';
// Fog Line — Weapons and the player kit: the roster, shared ammo, gun models and hands, firing with spread, bloom
// and penetration, interruptible reloads, melee and stealth kills, kicks, throwables, explosions, fire, the laser,
// and things lying on the ground to pick up.
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- the roster ---------- */
// slot 0 long gun, 1 sidearm, 2 melee. rof = seconds between shots; semi = rate when switched to semi.
// spread/move/bloom in radians; pen = extra bodies a round goes through; crit = chance of a head shot.
const WPN={
  m4:  {name:'M4 CARBINE',slot:0,mods:['supp','scope','ext','grip'],ammo:'556',mag:30,dmg:38,rof:0.085,semi:0.13,modes:['AUTO','SEMI'],spread:0.016,move:0.05,bloom:0.010,bloomMax:0.08,range:40,pen:1,crit:0.2,noise:46,supp:true,reload:2.1,knock:0.22,shake:0.14,kick:0.22,muz:0.95,snd:'rifle',spd:1,hold:'rifle'},
  saw: {name:'M249 SAW',slot:0,mods:['grip'],ammo:'556',mag:100,dmg:34,rof:0.068,modes:['AUTO'],spread:0.028,move:0.12,bloom:0.015,bloomMax:0.12,range:42,pen:1,crit:0.14,noise:60,reload:4.4,knock:0.3,shake:0.2,kick:0.3,muz:1.05,snd:'mg',spd:0.8,hold:'rifle'},
  m24: {name:'M24 SNIPER',slot:0,ammo:'762',mag:5,dmg:240,rof:1.1,modes:['BOLT'],spread:0.0015,move:0.07,bloom:0,bloomMax:0,range:75,pen:4,crit:0.45,noise:68,reload:2.8,knock:0.9,shake:0.36,kick:0.7,muz:1.25,snd:'big',spd:0.9,hold:'rifle',heavy:true},
  m870:{name:'870 SHOTGUN',slot:0,mods:['ext','grip'],ammo:'12g',mag:6,dmg:24,pellets:9,cone:0.085,rof:0.8,modes:['PUMP'],spread:0.008,move:0.03,bloom:0,bloomMax:0,range:17,pen:0,crit:0.05,noise:54,shell:0.5,knock:0.5,shake:0.34,kick:0.6,muz:0.95,snd:'shot',spd:0.95,hold:'rifle'},
  r22: {name:'.22 RIFLE',slot:0,mods:['supp','scope','ext'],ammo:'22',mag:10,dmg:26,rof:0.24,modes:['SEMI'],spread:0.006,move:0.05,bloom:0.004,bloomMax:0.03,range:45,pen:0,crit:0.32,noise:14,reload:1.9,knock:0.05,shake:0.05,kick:0.08,muz:1.05,snd:'small',spd:1,hold:'rifle'},
  m9:  {name:'M9 PISTOL',slot:1,mods:['supp','ext'],ammo:'9mm',mag:15,dmg:30,rof:0.15,modes:['SEMI'],spread:0.02,move:0.04,bloom:0.014,bloomMax:0.07,range:30,pen:0,crit:0.2,noise:32,supp:true,reload:1.3,knock:0.15,shake:0.1,kick:0.16,muz:0.62,snd:'pistol',spd:1.05,hold:'pistol'},
  rev: {name:'.357 REVOLVER',slot:1,ammo:'357',mag:6,dmg:72,rof:0.38,modes:['SEMI'],spread:0.016,move:0.05,bloom:0.03,bloomMax:0.08,range:32,pen:1,crit:0.3,noise:44,shell:0.42,knock:0.45,shake:0.22,kick:0.4,muz:0.62,snd:'big',spd:1.05,hold:'pistol'},
  bat: {name:'BASEBALL BAT',slot:2,melee:true,dmg:58,reach:1.9,arc:0.8,cd:0.62,knock:1.4,crit:0.12,noise:4,spd:1.05,hold:'melee',stun:0.8,hits:3},
  axe: {name:'FIRE AXE',slot:2,melee:true,dmg:95,reach:1.85,arc:0.6,cd:0.9,knock:0.7,crit:0.35,noise:5,spd:1,hold:'melee',stun:0.4,hits:2,edge:true},
  fists:{name:'BARE HANDS',slot:2,melee:true,dmg:22,reach:1.5,arc:0.7,cd:0.5,knock:0.6,crit:0.04,noise:2,spd:1.05,hold:'pistol',stun:0.3,hits:1},
  m240:{name:'MOUNTED M240',slot:-1,ammo:'762',mag:100,dmg:52,rof:0.075,modes:['AUTO'],spread:0.012,move:0,bloom:0.008,bloomMax:0.05,range:50,pen:2,crit:0.2,noise:70,reload:5,knock:0.5,shake:0.22,kick:0.3,muz:1.3,snd:'mg',spd:0,hold:'rifle'},
};
const AMMO_NAME={'556':'5.56','762':'7.62','12g':'12GA','9mm':'9MM','357':'.357','22':'.22'};
const AMMO={'556':300,'762':80,'12g':36,'9mm':75,'357':0,'22':0};     // the squad's shared pool
const THR={frag:3,molotov:3,decoy:3};
const THR_ORDER=['frag','molotov','decoy'], THR_NAME={frag:'FRAG',molotov:'MOLOTOV',decoy:'DECOY'};
let thrSel=0;
const MOD_NAME={supp:'SUPPRESSOR',scope:'SCOPE',ext:'EXT MAG',grip:'GRIP'};
function modsOf(s,key){ key=key||s.wpn; return s.mods[key]||(s.mods[key]={}); }
function hasMod(s,m,key){ return !!modsOf(s,key)[m]; }
// rounds a weapon holds, with an extended mag if fitted
function magCap(s,key){ key=key||s.wpn; const W=WPN[key]; if(W.melee) return 0; return hasMod(s,'ext',key)?Math.ceil(W.mag*(W.shell?1.35:1.5)):W.mag; }

/* ---------- models ---------- */
const matSteel=phong({color:0x5c5f62}), matWood=phong({color:0x4e3420}), matWoodL=phong({color:0x9a7a52}), matOD=phong({color:0x3e4232}),
  matAxe=phong({color:0x8e1e16}), matBlade=phong({color:0x9a9ea2,specular:0x666666,shininess:40}), matGrip=phong({color:0x2a2420});
function gbox(p,w,h,d,mat,x,y,z){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=true; p.add(m); return m; }
// every gun is modelled along +z with the grip near the origin
function buildGun(key,mods,bay){
  mods=mods||{}; const supp=mods.supp;
  const g=new THREE.Group(), B=(w,h,d,m,x,y,z)=>gbox(g,w,h,d,m,x,y,z);
  if(key==='m4'){ B(.07,.11,.5,matGun,0,0,.12); B(.035,.035,.44,matGun,0,.02,.58); B(.06,.1,.24,matGun,0,-.02,-.22); B(.05,.17,.08,matGun,0,-.12,.14); B(.05,.05,.14,matGun,0,.08,.05);
    if(supp) B(.06,.06,.22,matGun,0,.02,.9); if(bay) B(.014,.035,.24,matBlade,0,-.04,.9+(supp?.08:0)); }
  else if(key==='saw'){ B(.09,.13,.56,matGun,0,0,.1); B(.045,.045,.5,matGun,0,.02,.62); B(.07,.11,.26,matGun,0,-.02,-.26); B(.12,.13,.11,matOD,-.06,-.12,.08); B(.05,.06,.2,matGun,0,.1,.02);
    for(const sx of [-1,1]){ const l=B(.02,.02,.3,matGun,sx*.04,-.09,.7); l.rotation.x=0.9; } }
  else if(key==='m24'){ B(.06,.1,.72,matOD,0,-.01,.0); B(.032,.032,.7,matGun,0,.03,.66); B(.055,.055,.32,matGun,0,.1,.08); B(.07,.07,.05,matGun,0,.1,.26); B(.07,.07,.05,matGun,0,.1,-.09); B(.02,.05,.03,matSteel,.05,.03,.18); }
  else if(key==='m870'){ B(.07,.1,.32,matGun,0,0,.1); B(.04,.04,.6,matGun,0,.03,.52); B(.035,.035,.42,matGun,0,-.02,.46); B(.06,.06,.18,matWood,0,-.02,.42); B(.06,.11,.34,matWood,0,-.03,-.2); }
  else if(key==='r22'){ B(.05,.08,.3,matSteel,0,0,.1); B(.025,.025,.62,matSteel,0,.02,.55); B(.055,.1,.62,matWoodL,0,-.03,.02); B(.035,.035,.18,matGun,0,.07,.1); }
  else if(key==='m9'){ B(.04,.06,.22,matGun,0,.03,.08); B(.035,.11,.06,matGun,0,-.04,0); if(supp) B(.04,.04,.18,matGun,0,.035,.28); }
  else if(key==='rev'){ B(.04,.05,.2,matSteel,0,.04,.1); B(.05,.06,.06,matSteel,0,.03,.02); B(.035,.1,.05,matWood,0,-.04,-.02); }
  else if(key==='bat'){ const h=B(.05,.05,.3,matGrip,0,0,.04); const b=B(.075,.075,.55,matWoodL,0,0,.45); }
  else if(key==='axe'){ B(.045,.045,.8,matWoodL,0,0,.3); B(.03,.16,.13,matAxe,0,.07,.66); B(.03,.07,.05,matBlade,0,.17,.66); B(.03,.06,.07,matGun,0,-.06,.66); }
  if(!WPN[key].melee&&key!=='m240'){
    const W=WPN[key], pistol=W.hold==='pistol';
    if(mods.scope&&!pistol){ B(.05,.05,.24,matGun,0,.12,.06); B(.06,.06,.03,matSteel,0,.12,.19); }
    if(mods.ext){ B(pistol?.032:.05,pistol?.08:.14,.07,matGun,0,pistol?-.14:-.24,pistol?0:.14); }
    if(mods.grip&&!pistol){ B(.035,.1,.04,matGun,0,-.09,.38); }
  }
  return g;
}
// hands and arms for a hold: rifle (two hands on the gun), pistol (both arms out), melee (choked up, weapon raised)
const HOLD={
  rifle:{gun:[0.1,0.42,0.22],gr:[0,0,0],hands:[[0.12,0.38,0.2],[0.08,0.43,0.6]]},
  pistol:{gun:[0.0,0.5,0.52],gr:[0,0,0],hands:[[0.02,0.47,0.5],[-0.04,0.46,0.48]]},
  melee:{gun:[0.12,0.44,0.3],gr:[-0.9,0,0],hands:[[0.12,0.44,0.3],[0.12,0.5,0.4]]},
};
function setHold(s){
  const u=s.mesh.userData, W=u.W;
  if(u.held) for(const m of u.held) W.remove(m);
  u.held=[]; u.armBands.length=0;
  const key=s.wpn, def=WPN[key], H=HOLD[def.hold];
  const gun=buildGun(key,modsOf(s,key),s.bay&&key==='m4'); gun.position.set(...H.gun); gun.rotation.set(...H.gr); W.add(gun); u.held.push(gun); u.gun=gun;
  for(let k=0;k<2;k++){
    const sx=k?-1:1, hand=new THREE.Vector3(...H.hands[k]), sh=new THREE.Vector3(sx*0.28,0.56,0), d=hand.clone().sub(sh), L=d.length();
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,L),u.M.uni); m.castShadow=true;
    m.position.copy(sh).add(hand).multiplyScalar(0.5); W.add(m); u.held.push(m);
    s.mesh.updateMatrixWorld(true); m.lookAt(W.localToWorld(hand.clone()));
    const hm=gbox(W,0.09,0.09,0.09,matSkin,hand.x,hand.y,hand.z); u.held.push(hm);
    const band=new THREE.Mesh(new THREE.BoxGeometry(0.135,0.135,0.11),matBandage); band.position.z=L*0.15; band.visible=false; m.add(band); u.armBands.push(band);
  }
  // lookAt above ran with the soldier's current pose; reset W so arms stay in W's local space
  onCharLayer(s.mesh);
}
function equip(s,slot,quiet){
  const key=s.inv[slot]; if(!key) return false;
  s.slot=slot; s.wpn=key; s.reloadT=0; s.drawT=quiet?0:0.35; s.bloom=0; s.cycleT=0;
  if(s.mags[key]===undefined) s.mags[key]=magCap(s,key);
  if(s.modes[key]===undefined) s.modes[key]=0;
  const u=s.mesh.userData, yaw=s.mesh.rotation.y, rx=s.mesh.rotation.x, W=u.W; s.mesh.rotation.set(0,0,0); W.position.set(0,0,0); W.rotation.set(0,0,0);
  u.torso.position.set(0,0.86,0); u.torso.rotation.set(0,0,0);
  const p=s.mesh.position.clone(); s.mesh.position.set(0,0,0);
  setHold(s);
  s.mesh.position.copy(p); s.mesh.rotation.set(rx,yaw,0);
  if(!quiet&&AC) SFX.rack(0,0.25);
  return true;
}
forEachSoldier(s=>{ s.mods=s.mods||{}; for(let k=0;k<3;k++){ const key=s.inv[k]; if(key){ s.mags[key]=magCap(s,key); s.modes[key]=0; } } if(!equip(s,0,true)&&!equip(s,1,true)&&!equip(s,2,true)){ s.wpn='fists'; s.slot=2; setHoldSafe(s); } });

function cycleWeapon(s){ if(s.mounted) return; for(let k=1;k<=3;k++){ const n=(s.slot+k)%3; if(s.inv[n]){ if(n!==s.slot) equip(s,n); return; } } }
// nothing in any slot: fists
function ensureArmed(s){ if(s.inv[s.slot]) return; for(let k=0;k<3;k++) if(s.inv[k]){ equip(s,k,true); return; } s.wpn='fists'; s.slot=2; s.inv[2]=null; setHoldSafe(s); }
function setHoldSafe(s){ const u=s.mesh.userData, yaw=s.mesh.rotation.y, rx=s.mesh.rotation.x, p=s.mesh.position.clone(); s.mesh.rotation.set(0,0,0); s.mesh.position.set(0,0,0); u.W.position.set(0,0,0); u.W.rotation.set(0,0,0);
  u.torso.position.set(0,0.86,0); u.torso.rotation.set(0,0,0); setHold(s); s.mesh.position.copy(p); s.mesh.rotation.set(rx,yaw,0); }
function cycleMode(s){ const W=WPN[s.wpn]; if(!W.modes||W.modes.length<2) return; s.modes[s.wpn]=(s.modes[s.wpn]+1)%W.modes.length; if(AC) SFX.click(0,0.4); }
function modeOf(s){ const W=WPN[s.wpn]; return W.melee?'':W.modes[s.modes[s.wpn]||0]; }
// N: thread the can from your pack onto this gun, or take it off and stow it
function toggleSupp(s){
  const W=WPN[s.wpn]; if(!W.supp){ radioLine('Nothing to thread a can onto.'); return; }
  const m=modsOf(s);
  if(m.supp){ const it=mkItem('supp'); if(!autoPlace(s.pack,it)){ radioLine('No room in the pack for the can.'); return; } m.supp=false; }
  else { const it=s.pack.items.find(i=>i.key==='supp'); if(!it){ radioLine('No suppressor in the pack.'); return; } removeItem(s.pack,it); m.supp=true; }
  refreshWeapon(s); if(AC) SFX.click(0,0.4);
}
// rebuild the model after a mod change without the draw delay
function refreshWeapon(s){ s.mags[s.wpn]=Math.min(s.mags[s.wpn]||0,magCap(s)); setHoldSafe(s); }

/* ---------- firing ---------- */
const flashSm=[];
function muzzlePos(s,W){ const a=s.ang, r=Math.cos(a), rz=-Math.sin(a), side=W.hold==='pistol'?0:0.12*1.2;
  return {x:s.x+Math.sin(a)*W.muz*1.2+r*side, z:s.z+Math.cos(a)*W.muz*1.2+rz*side}; }
const _hits=[];
function fire(s,ang,targetJ){
  const W=WPN[s.wpn], isMe=s.i===me, supp=hasMod(s,'supp'), grip=hasMod(s,'grip'), scope=hasMod(s,'scope');
  s.mags[s.wpn]--; s.recoil=Math.min(1.6,0.6+W.kick*2); STATS.shots++;
  const mode=modeOf(s);
  s.fireCD=(mode==='SEMI'&&W.semi)?W.semi:W.rof;
  if(mode==='BOLT'||mode==='PUMP') s.cycleT=W.rof*0.9;
  if(!isMe){
    if(mode==='AUTO'){ if(--s.burst<=0){ s.burst=3+(Math.random()*4|0); s.fireCD=rand(.45,.85); } else s.fireCD=W.rof*1.25; }
    else s.fireCD=Math.max(W.rof,rand(0.32,0.5));
  }
  if(!(mode==='PUMP'||W.key==='rev')) eject(s);
  const L=s.L, y=s.y, M=muzzlePos(s,W);
  // where the round goes: player aim wanders with movement, bloom and nerves; buddies roll their skill
  let a=ang;
  const moving=Math.hypot(s.vx,s.vz)>0.5;
  if(isMe){ const sp=(W.spread+(moving?W.move*(grip?0.75:1):0)+s.bloom+s.stress*0.0006)*(s.sneak&&!moving?0.7:1)*(scope&&!moving?0.6:1)*aimMul(s); a=ang+randn()*sp; }
  else if(targetJ>=0){ const d=Math.hypot(zx[targetJ]-M.x,zz[targetJ]-M.z); const chance=clamp((s.acc+(W.key==='m24'?0.15:0)+(s.mounted?0.12:0))/aimMul(s)-s.stress*0.003-d*0.008*(W.key==='m24'?0.3:1),0.12,0.95);
    a=Math.atan2(zx[targetJ]-M.x,zz[targetJ]-M.z)+(Math.random()<chance?randn()*W.spread:rand(.05,.12)*(Math.random()<.5?-1:1)); }
  s.bloom=Math.min(W.bloomMax,s.bloom+W.bloom*(grip?0.65:1));
  const n=W.pellets||1;
  HIT.s=s; HIT.melee=false; HIT.quiet=false;
  for(let k=0;k<n;k++) shootRay(s,n>1?a+randn()*W.cone:a,W,M,k<3||n===1);
  HIT.s=null;
  flashAt(M.x,M.z,y,supp?0.25:1);
  if(isMe){ const kk=W.kick*(grip?0.65:1); G.shake=Math.max(G.shake,W.shake*(supp?0.7:1)*(grip?0.8:1)); G.kickX-=Math.sin(ang)*kk; G.kickZ-=Math.cos(ang)*kk; }
  const ps=squad[me]; sGun(Math.hypot(s.x-ps.x,s.z-ps.z),W.snd,supp,clamp((s.x-ps.x)/20,-1,1));
  makeNoise(s.x,s.z,W.noise*(supp?0.28:1),L);
  s.loudT=2.5;
  if(mode==='PUMP'||mode==='BOLT'){ const ss=s; setTimeout(()=>{ if(AC&&ss.alive) SFX.rack(clamp((ss.x-squad[me].x)/20,-1,1),0.3/(1+Math.hypot(ss.x-squad[me].x,ss.z-squad[me].z)*0.1)); if(ss.alive) eject(ss); },W.rof*450); }
}
for(const k in WPN) WPN[k].key=k;
// one round (or pellet) down the line: through glass, through bodies, heavy rounds through doors
function shootRay(s,a,W,M,showTracer){
  const fx_=Math.sin(a), fz_=Math.cos(a), R=W.range, L=s.L, y=s.y;
  const passed=[];
  const R0=gridRay(L,M.x,M.z,M.x+fx_*R,M.z+fz_*R,(e)=>{ const t=ED.t[e];
    if(t===ET.WIN){ breakGlass(e); return false; }
    if(W.heavy&&(t===ET.DOOR||t===ET.BOARD||t===ET.IWALL)&&passed.length<2){ passed.push(e); return false; }
    return SHOTB[t]===1; });
  const wallT=R0.t*R, wall=R0.blocked, wx=R0.x, wz=R0.z;
  for(const e of passed) damageEdge(e,40);
  _hits.length=0;
  for(let j=0;j<MAXZ;j++){ if(!zst[j]||zst[j]===5||!shootable(L,j)) continue;
    const dx=zx[j]-M.x, dz=zz[j]-M.z, t=dx*fx_+dz*fz_; if(t<-0.3||t>wallT) continue;
    const lat=Math.abs(dx*fz_-dz*fx_); if(lat<(zvar[j]===3?0.35:0.45)*zsc[j]) _hits.push(Math.max(0,Math.round(t*100))*1000+j); }
  _hits.sort((p,q)=>p-q);
  let dmg=W.dmg*(hasMod(s,'supp',W.key)?0.92:1)*(passed.length?0.7:1), left=(W.pen||0)+1, endT=wallT, stopped=false;
  for(const h of _hits){ if(left<=0) break; const j=h%1000, t=(h-j)/100000;
    const fall=W.pellets?clamp(1-t/R*0.75,0.25,1):1;
    const crit=Math.random()<(W.crit+(hasMod(s,'scope',W.key)?0.06:0)+(hasPerk(s,'eagle')?0.08:0))*(s.i===me?1.1:1)*(W.pellets?0.3:1);
    if(crit) STATS.heads++;
    damageZ(j,crit?Math.max(200,W.dmg*2.5):dmg*fall,s.x,s.z,W.knock*fall);
    dmg*=0.65; left--; endT=t; if(left<=0) stopped=true;
  }
  let ex=M.x+fx_*endT, ez=M.z+fz_*endT;
  if(!stopped){ if(wall){ impact(wx,wz,y,fx_,fz_,true); ex=wx; ez=wz; } else if(L===0) impact(ex,ez,0,fx_,fz_,false); }
  if(showTracer) tracer(M.x,M.z,ex,ez,y);
}

/* ---------- reloads: animated and interruptible ---------- */
function reload(s){
  const W=WPN[s.wpn]; if(W.melee||s.reloadT>0||s.drawT>0) return false;
  if(s.mags[s.wpn]>=magCap(s)) return false;
  if(AMMO[W.ammo]<=0){ if(s.i===me) radioLine('Out of '+AMMO_NAME[W.ammo]+'.'); return false; }
  s.reloadW=s.wpn; s.reloadT=s.reloadMax=(W.shell||W.reload)*reloadMul(s); s.magOut=false;
  if(s.i===me&&AC) SFX.click(0,0.35);
  return true;
}
function cancelReload(s){ s.reloadT=0; s.magOut=false; }
function stepReload(s,dt){
  if(s.reloadT<=0) return;
  if(s.reloadW!==s.wpn){ cancelReload(s); return; }
  const W=WPN[s.reloadW];
  s.reloadT-=dt; const u=1-s.reloadT/s.reloadMax;
  const near=Math.hypot(s.x-squad[me].x,s.z-squad[me].z), pan=clamp((s.x-squad[me].x)/20,-1,1), vol=0.35/(1+near*0.15);
  if(!W.shell&&!s.magOut&&u>0.28){ s.magOut=true; chips(s.x+Math.cos(s.ang)*0.2,s.y+1.0,s.z-Math.sin(s.ang)*0.2,1,0,0,0x1c1a18); if(AC) SFX.click(pan,vol); }
  if(s.reloadT>0) return;
  if(W.shell){
    if(W.key==='rev'&&s.mags.rev===0&&!s.magOut){ s.magOut=true; for(let k=0;k<6;k++) eject(s); }
    const cap=magCap(s,s.reloadW);
    if(AMMO[W.ammo]>0&&s.mags[s.reloadW]<cap){ s.mags[s.reloadW]++; AMMO[W.ammo]--; if(AC) SFX.click(pan,vol); }
    if(AMMO[W.ammo]>0&&s.mags[s.reloadW]<cap){ s.reloadT=s.reloadMax=W.shell*reloadMul(s); }
    else { s.reloadT=0; if(AC) SFX.rack(pan,vol); }
  } else {
    const take=Math.min(magCap(s,s.reloadW)-s.mags[s.reloadW],AMMO[W.ammo]); s.mags[s.reloadW]+=take; AMMO[W.ammo]-=take; s.reloadT=0;
    if(AC) SFX.rack(pan,vol);
  }
}

/* ---------- melee, shoves, kicks and stealth kills ---------- */
function pushZ(j,dx,dz){
  if(ztr[j]) return; zA.x=zx[j]+dx; zA.z=zz[j]+dz; zA.L=zl[j]; zA.trav=null;
  collideGrid(zA,0.3,zl[j],AG.THING); if(zl[j]===0) pushCircles(zA,0.3); zx[j]=zA.x; zz[j]=zA.z;
}
// a zombie that hasn't clocked you: not chasing anyone, and either you're sneaking or you're behind it
function unaware(j,s){
  if(zst[j]===3||zst[j]===5||!zst[j]) return false;
  if(s.sneak) return true;
  const fx_=Math.sin(zang[j]), fz_=Math.cos(zang[j]), dx=s.x-zx[j], dz=s.z-zz[j], d=Math.hypot(dx,dz)||1;
  return (dx*fx_+dz*fz_)/d<0.2;
}
function frontZombie(s,reach,cosA,pred){
  let bj=-1, bd=reach; const fx_=Math.sin(s.ang), fz_=Math.cos(s.ang);
  eachNear(s.x,s.z,reach+0.4,j=>{ if(zl[j]!==s.L||zst[j]===5||ztr[j]) return;
    const dx=zx[j]-s.x, dz=zz[j]-s.z, d=Math.hypot(dx,dz); if(d>bd||d<1e-3) return;
    if((dx*fx_+dz*fz_)/d<cosA) return; if(pred&&!pred(j)) return; bd=d; bj=j; });
  return bj;
}
function stealthKill(s,j){
  s.actT=0.65; s.swingT=0.4; s.vx=s.vz=0;
  const dx=zx[j]-s.x, dz=zz[j]-s.z, d=Math.hypot(dx,dz)||1; zdx[j]=dx/d; zdz[j]=dz/d;
  bleed(zx[j],1.5*zsc[j],zz[j],dx/d,dz/d,10,1.2,zyv[j]);
  zhp[j]=0; HIT.s=s; HIT.quiet=true; HIT.melee=true; killZ(j,true); HIT.s=null; HIT.quiet=false;
  if(AC) SFX.chop(0,0.25); sThud(0.12);
  s.ang=Math.atan2(dx,dz);
}
function shove(s){
  if(s.meleeCD>0||s.actT>0) return;
  // nobody in reach but a closed door in front of you: kick it in
  if(s.i===me&&frontZombie(s,1.9,0.25)<0){ const e=doorAhead(s); if(e){ kickDoor(s,e); return; } }
  // somebody who hasn't seen you: quiet kill
  const sj=frontZombie(s,1.6,0.5,j=>unaware(j,s));
  if(sj>=0&&(s.i===me||s.sneak)){ stealthKill(s,sj); s.meleeCD=0.7; return; }
  s.meleeCD=0.6; s.shoveT=0.25;
  const fx_=Math.sin(s.ang), fz_=Math.cos(s.ang); let hit=false;
  const bay=s.bay&&s.wpn==='m4';
  HIT.s=s; HIT.melee=true;
  eachNear(s.x,s.z,2.4,j=>{
    if(zl[j]!==s.L||zst[j]===5) return;
    const dx=zx[j]-s.x, dz=zz[j]-s.z, d=Math.hypot(dx,dz); if(d>(bay?2.2:1.9)||d<1e-3) return;
    if((dx*fx_+dz*fz_)/d<0.25) return;
    pushZ(j,dx/d*(bay?0.6:1.3),dz/d*(bay?0.6:1.3)); zhp[j]-=(bay?72:48)*s.melee; hit=true; zdx[j]=dx/d; zdz[j]=dz/d; zstun[j]=Math.max(zstun[j],bay?0.3:0.6); zfl[j]=1;
    bleed(zx[j],1.2,zz[j],dx/d,dz/d,bay?9:4,1.5,zyv[j]);
    if(zhp[j]<=0) killZ(j,true);
  });
  HIT.s=null; HIT.melee=false;
  sThud(hit?0.5:0.2);
  if(hit) makeNoise(s.x,s.z,5,s.L);
}
function swing(s){
  const W=WPN[s.wpn]; if(!W.melee||s.meleeCD>0||s.actT>0||s.drawT>0) return;
  const sj=frontZombie(s,1.6,0.5,j=>unaware(j,s));
  if(sj>=0&&s.i===me){ stealthKill(s,sj); s.meleeCD=W.cd; return; }
  s.meleeCD=W.cd; s.swingT=0.32; s.stam=Math.max(0,s.stam-6);
  const fx_=Math.sin(s.ang), fz_=Math.cos(s.ang), cosA=Math.cos(W.arc), list=[];
  eachNear(s.x,s.z,W.reach+0.5,j=>{ if(zl[j]!==s.L||zst[j]===5) return;
    const dx=zx[j]-s.x, dz=zz[j]-s.z, d=Math.hypot(dx,dz); if(d>W.reach||d<1e-3) return; if((dx*fx_+dz*fz_)/d<cosA) return; list.push([d,j]); });
  list.sort((a,b)=>a[0]-b[0]);
  const pan=clamp((s.x-squad[me].x)/20,-1,1);
  if(AC) SFX.swing(pan,0.3);
  HIT.s=s; HIT.melee=true;
  for(let k=0;k<Math.min(W.hits,list.length);k++){
    const j=list[k][1], dx=zx[j]-s.x, dz=zz[j]-s.z, d=list[k][0]||1;
    const crit=Math.random()<W.crit;
    damageZ(j,crit?220:W.dmg*s.melee*(k?0.7:1),s.x,s.z,W.knock*(k?0.7:1));
    if(zst[j]&&zst[j]!==5) zstun[j]=Math.max(zstun[j],W.stun);
    if(AC) (W.edge?SFX.chop:SFX.kick)(pan,0.35);
  }
  HIT.s=null; HIT.melee=false;
  if(list.length) makeNoise(s.x,s.z,W.noise,s.L);
}
function doorAhead(s){
  const fx_=Math.sin(s.ang), fz_=Math.cos(s.ang);
  const e=nearestDoor(s.L,s.x+fx_*0.6,s.z+fz_*0.6,1.1);
  if(!e) return 0; const t=ED.t[e]; return (t===ET.DOOR||t===ET.BOARD)?e:0;
}
function kickDoor(s,e){
  s.kickT=0.35; s.meleeCD=0.7; s.actT=0.25;
  const p=edgeMid(e), pan=0;
  if(ED.t[e]===ET.BOARD){ damageEdge(e,70); }
  else { if(ED.hp[e]<ED.max[e]*0.5&&Math.random()<.5) setEdgeType(e,ET.DGONE); else openDoor(e,true);
    // anyone standing behind it gets knocked back
    eachNear(p.x,p.z,1.4,j=>{ if(zl[j]!==p.L||zst[j]===5) return; const dx=zx[j]-s.x, dz=zz[j]-s.z, d=Math.hypot(dx,dz)||1; pushZ(j,dx/d,dz/d); zstun[j]=Math.max(zstun[j],0.9); zfl[j]=1; }); }
  if(AC) SFX.kick(pan,0.6);
  G.shake=Math.max(G.shake,0.18);
  makeNoise(p.x,p.z,26,p.L);
}

/* ---------- moving like a soldier: sprint, sneak, dodge, vault ---------- */
function edgeBetween(L,ax,az,bx,bz){
  if(bx===ax+1&&bz===az) return MAP.eE[L][CI(ax,az)];
  if(bx===ax-1&&bz===az) return MAP.eE[L][CI(bx,bz)];
  if(bz===az+1&&bx===ax) return MAP.eS[L][CI(ax,az)];
  if(bz===az-1&&bx===ax) return MAP.eS[L][CI(bx,bz)];
  return -1;
}
const _probe={x:0,z:0};
function clearSpot(L,x,z,r){ _probe.x=x; _probe.z=z; collideGrid(_probe,r,L,AG.THING); if(L===0) pushCircles(_probe,r); return Math.hypot(_probe.x-x,_probe.z-z)<0.04; }
// something low in front of you (fence, broken window, counter, car, the barricade) with floor on the far side
function findVault(s,dx,dz){
  const L=s.L; let crossed=false, px=s.x, pz=s.z;
  for(let d=0.15;d<=3.4;d+=0.15){
    const nx=s.x+dx*d, nz=s.z+dz*d, cx0=Math.floor(px), cz0=Math.floor(pz), cx1=Math.floor(nx), cz1=Math.floor(nz);
    if(cx0!==cx1||cz0!==cz1){
      if(!inMap(cx1,cz1)) return null;
      const steps=(cx0!==cx1&&cz0!==cz1)?[[cx0,cz0,cx1,cz0],[cx1,cz0,cx1,cz1]]:[[cx0,cz0,cx1,cz1]];
      for(const [a,b,c,dd] of steps){ const e=edgeBetween(L,a,b,c,dd); if(e<0) return null;
        if(e){ const t=ED.t[e]; if(t===ET.FENCE||t===ET.WINB||(t===ET.RAIL&&L===0)) crossed=true; else if(WALKB[t]) return null; } }
      const c=CI(cx1,cz1); if(!MAP.floor[L][c]) return null; const bk=MAP.block[L][c];
      if(bk===BLK.SOLID) return null; if(bk===BLK.FURN||bk===BLK.PROP||bk===BLK.LINE) crossed=true;
    }
    if(!crossed&&!clearSpot(L,nx,nz,0.2)){ /* pressed against a collider circle (a wreck) */ crossed=true; }
    if(crossed&&d>=0.6&&cellWalk(L,cx1,cz1)&&MAP.block[L][CI(cx1,cz1)]!==BLK.LINE&&clearSpot(L,nx,nz,0.34)) return {x:nx,z:nz};
    if(!crossed&&d>1.1) return null;
    px=nx; pz=nz;
  }
  return null;
}
function moveDir(){ let mx=0,mz=0; if(keyDown('up')) mz-=1; if(keyDown('down')) mz+=1; if(keyDown('left')) mx-=1; if(keyDown('right')) mx+=1; const l=Math.hypot(mx,mz); return l>0?{x:mx/l,z:mz/l}:null; }
function dodgeOrVault(s){
  if(s.dodge||s.vault||s.trav||s.actT>0) return;
  const md=moveDir(), dir=md||{x:Math.sin(s.ang),z:Math.cos(s.ang)};
  const v=findVault(s,dir.x,dir.z);
  if(v){ cancelReload(s); const d=Math.hypot(v.x-s.x,v.z-s.z); s.vault={t:0,dur:0.32+d*0.09,x0:s.x,z0:s.z,x1:v.x,z1:v.z}; s.stam=Math.max(0,s.stam-8); s.stamT=0.6; makeNoise(s.x,s.z,4,s.L); if(AC) SFX.swing(0,0.15); return; }
  if(s.stam<18) return;
  const dd=md||{x:-Math.sin(s.ang),z:-Math.cos(s.ang)};
  cancelReload(s); s.dodge={t:0,dur:0.42,dx:dd.x,dz:dd.z}; s.iframe=0.36; s.stam-=22; s.stamT=0.8;
  if(AC) SFX.swing(0,0.2);
}
function stepVault(s,dt){
  const V=s.vault; V.t+=dt/V.dur; const u=Math.min(1,V.t);
  s.x=lerp(V.x0,V.x1,u); s.z=lerp(V.z0,V.z1,u); s.vx=(V.x1-V.x0)/V.dur*0.3; s.vz=(V.z1-V.z0)/V.dur*0.3;
  s.y=agentY(s); s.hop=Math.sin(u*Math.PI)*0.75;
  if(u>=1){ s.vault=null; s.hop=0; }
}
function stepDodge(s,dt){
  const D=s.dodge; D.t+=dt; const u=Math.min(1,D.t/D.dur), sp=9.5*Math.pow(1-u,0.6)+1.5;
  s.vx=D.dx*sp; s.vz=D.dz*sp;
  moveAgent(s,s.vx*dt,s.vz*dt,0.33,AG.SOLDIER); if(s.L===0&&!s.trav) pushCircles(s,0.35); s.y=agentY(s);
  // shoulder through the crowd
  eachNear(s.x,s.z,0.9,j=>{ if(zl[j]!==s.L||zst[j]===5) return; const dx=zx[j]-s.x, dz=zz[j]-s.z, d=Math.hypot(dx,dz)||1; if(d<0.7) pushZ(j,dx/d*0.3,dz/d*0.3); });
  if(u>=1) s.dodge=null;
}
// footsteps carry: walking a little, sprinting a lot, sneaking not at all
function footsteps(s,dt){
  if(s.trav||s.vault) return;
  const sp=Math.hypot(s.vx,s.vz); if(sp<0.8) return;
  s.stepD+=sp*dt; if(s.stepD<0.75) return; s.stepD=0;
  if(s.sneak) return;
  const r=(s.sprint?9.5:sp>4.2?5:3)*(hasPerk(s,'light')?0.5:1);
  makeNoise(s.x,s.z,r,s.L);
}

/* ---------- throwables ---------- */
const matFrag=phong({color:0x4a4d34}), matBottle=new THREE.MeshPhongMaterial({color:0x3a6a3a,transparent:true,opacity:0.85,shininess:60,specular:0x445544}), matDecoy=phong({color:0x222222});
const projGeo={frag:new THREE.SphereGeometry(0.08,6,4),molotov:new THREE.CylinderGeometry(0.05,0.06,0.26,6),decoy:new THREE.BoxGeometry(0.16,0.1,0.1)};
const proj=[];
const G_GRAV=14;
function throwTarget(s){
  const p=aimPoint(s); let tx=p.x, tz=p.z; const dx=tx-s.x, dz=tz-s.z, d=Math.hypot(dx,dz), maxD=21;
  if(d>maxD){ tx=s.x+dx/d*maxD; tz=s.z+dz/d*maxD; }
  let ty=s.y; const c=inMap(Math.floor(tx),Math.floor(tz))?CI(Math.floor(tx),Math.floor(tz)):-1;
  if(s.L>0&&c>=0&&!MAP.floor[s.L][c]) ty=0;
  return {x:tx,z:tz,y:ty};
}
function throwPath(s,T){
  const a=s.ang, x0=s.x+Math.sin(a)*0.35, z0=s.z+Math.cos(a)*0.35, y0=s.y+1.7;
  const d=Math.hypot(T.x-x0,T.z-z0), ft=0.42+d/19;
  return {x0,y0,z0,vx:(T.x-x0)/ft,vz:(T.z-z0)/ft,vy:(T.y+0.1-y0+0.5*G_GRAV*ft*ft)/ft,ft};
}
function throwIt(s,kind){
  if(THR[kind]<=0){ radioLine('No '+THR_NAME[kind].toLowerCase()+'s left.'); return; }
  if(s.throwT>0||s.actT>0) return;
  THR[kind]--; cancelReload(s); s.throwT=0.45;
  const T=throwTarget(s), P=throwPath(s,T);
  const m=new THREE.Mesh(projGeo[kind],kind==='frag'?matFrag:kind==='molotov'?matBottle:matDecoy); m.castShadow=true; onCharLayer(m); scene.add(m);
  proj.push({by:s,kind,x:P.x0,y:P.y0,z:P.z0,vx:P.vx,vy:P.vy,vz:P.vz,L:s.L,t:0,fuse:kind==='frag'?2.3:kind==='decoy'?15:0,m,rest:false,spin:rand(-12,12),beep:0,call:0,
    lit:kind==='decoy'?halo(0,0,0,0xff3020,1.2,0.8):null});
  if(AC) SFX.swing(0,0.25);
  makeNoise(s.x,s.z,2,s.L);
}
// does a projectile at height y (above its floor) get stopped by edge e?
function projBlocks(e,yrel){ const t=ED.t[e]; if(t===ET.FENCE) return yrel<1.7; if(t===ET.RAIL) return yrel<1.05; return WALKB[t]===1&&t!==ET.WINB; }
function updateProj(dt){
  for(let k=proj.length-1;k>=0;k--){
    const p=proj[k]; p.t+=dt;
    if(!p.rest){
      p.vy-=G_GRAV*dt;
      const nx=p.x+p.vx*dt, nz=p.z+p.vz*dt, floorY=p.L*LH, yrel=p.y-floorY;
      // walls, windows, fences, low furniture and wrecks
      let hitE=0, hitCell=false;
      const R=gridRay(p.L,p.x,p.z,nx,nz,(e)=>{ if(ED.t[e]===ET.WIN&&yrel>0.6&&yrel<2.4){ breakGlass(e); p.vx*=0.6; p.vz*=0.6; return false; } if(projBlocks(e,yrel)){ hitE=e; return true; } return false; },
        (L,cx,cz,c)=>{ if(!MAP.floor[L][c]) return false; const b=MAP.block[L][c]; if(b===BLK.SOLID||((b===BLK.FURN||b===BLK.PROP)&&yrel<1.0)){ hitCell=true; return true; } return false; });
      if(R.blocked){
        if(p.kind==='molotov'){ shatter(p,R.x,R.z); proj.splice(k,1); continue; }
        const crossX=Math.floor(R.x+p.vx*0.001)!==Math.floor(p.x)||(hitE&&ED.d[hitE]===0);
        p.x=R.x-Math.sign(p.vx)*0.05*(crossX?1:0); p.z=R.z-Math.sign(p.vz)*0.05*(crossX?0:1);
        if(hitE?ED.d[hitE]===0:crossX){ p.vx*=-0.35; p.vz*=0.6; } else { p.vz*=-0.35; p.vx*=0.6; }
        if(AC) SFX.tink(0,0.25);
      } else { p.x=nx; p.z=nz; }
      p.y+=p.vy*dt;
      // ceiling indoors
      if(indoors(p.L,p.x,p.z)&&p.y>floorY+LH-0.25&&p.vy>0){ p.vy=-p.vy*0.3; }
      // no floor here (off a roof or a balcony): fall a level
      const c=inMap(Math.floor(p.x),Math.floor(p.z))?CI(Math.floor(p.x),Math.floor(p.z)):-1;
      if(c>=0&&p.L>0&&!MAP.floor[p.L][c]&&p.y<floorY+0.1){ p.L--; }
      const fy=p.L*LH;
      if(p.y<=fy+0.06){
        p.y=fy+0.06;
        if(p.kind==='molotov'){ shatter(p,p.x,p.z); proj.splice(k,1); continue; }
        if(Math.abs(p.vy)>1.5&&AC) SFX.tink(clamp((p.x-squad[me].x)/20,-1,1),0.3);
        p.vy=-p.vy*0.3; p.vx*=0.55; p.vz*=0.55; p.spin*=0.5;
        if(Math.abs(p.vy)<0.8&&Math.hypot(p.vx,p.vz)<0.6){ p.rest=true; p.vy=0; }
      }
      if(p.rest){ p.vx=p.vz=0; }
    }
    p.m.position.set(p.x,p.y,p.z); p.m.rotation.set(p.t*p.spin,p.t*p.spin*0.6,0);
    if(p.kind==='molotov'&&Math.random()<dt*30) emit(true,p.x,p.y+0.15,p.z,0,0.5,0,0.25,0.25,0.05,0xff8a3a,0.9);
    if(p.kind==='frag'){ p.fuse-=dt; if(p.fuse<=0){ HIT.s=p.by; explode(p.x,p.y,p.z,p.L); HIT.s=null; scene.remove(p.m); proj.splice(k,1); continue; } }
    if(p.kind==='decoy'&&p.rest){
      p.fuse-=dt; p.beep-=dt; p.call-=dt;
      p.lit.spr.position.set(p.x,p.y+0.12,p.z); p.lit.k=(p.beep>0.45)?1:0.15;
      if(p.beep<=0){ p.beep=0.6; const d=Math.hypot(p.x-squad[me].x,p.z-squad[me].z); if(AC&&d<45) SFX.beep(clamp((p.x-squad[me].x)/20,-1,1),0.35/(1+d*0.08)); }
      if(p.call<=0){ p.call=1.4; makeNoise(p.x,p.z,34,p.L); }
      if(p.fuse<=0){ p.lit.k=0; p.lit.spr.visible=false; halos.splice(halos.indexOf(p.lit),1); scene.remove(p.lit.spr); scene.remove(p.m); proj.splice(k,1); continue; }
    }
  }
}

/* ---------- explosions, fire, scorch marks ---------- */
const MAXSC=60; let scIdx=0;
const imScorch=new THREE.InstancedMesh(new THREE.CircleGeometry(0.5,10).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({color:0x0e0c0a,transparent:true,opacity:0.7,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),MAXSC);
imScorch.frustumCulled=false; onCharLayer(imScorch); scene.add(imScorch); for(let i=0;i<MAXSC;i++) imScorch.setMatrixAt(i,zeroM);
function scorch(x,z,y,r){ dummy.position.set(x,(y||0)+0.04,z); dummy.rotation.set(0,rand(0,6),0); dummy.scale.set(r*2,1,r*2*rand(.8,1.1)); dummy.updateMatrix(); imScorch.setMatrixAt(scIdx,dummy.matrix); scIdx=(scIdx+1)%MAXSC; imScorch.instanceMatrix.needsUpdate=true; }
const boomLight=new THREE.PointLight(0xffb060,0,26,2); boomLight.layers.enableAll(); scene.add(boomLight);
const fireLights=[0,1].map(()=>{ const l=new THREE.PointLight(0xff7a2a,0,14,2); l.layers.enableAll(); scene.add(l); return l; });
let boomT=0;
function explode(x,y,z,L){
  const R=6.5, ps=squad[me], dp=Math.hypot(x-ps.x,z-ps.z);
  boomLight.position.set(x,y+1.2,z); boomLight.intensity=7; boomT=0.3;
  FL.boom.x=x; FL.boom.y=y+1; FL.boom.z=z; FL.boom.k=1.4;
  for(let k=0;k<16;k++) emit(true,x,y+0.4,z,rand(-5,5),rand(1,5),rand(-5,5),rand(.2,.45),rand(.8,1.6),0.2,Math.random()<.5?0xffa040:0xffe0a0,1);
  for(let k=0;k<12;k++) emit(false,x+rand(-1,1),y+0.5,z+rand(-1,1),rand(-1.5,1.5),rand(0.6,2),rand(-1.5,1.5),rand(3,6),rand(1,1.6),rand(4,7),0x5a5856,0.5);
  chips(x,y+0.3,z,24,0,0,0x34373b); scorch(x,z,y,1.6);
  for(let i=0;i<MAXZ;i++){ if(!zst[i]||zst[i]===5||zl[i]!==L) continue;
    const dx=zx[i]-x, dz=zz[i]-z, d=Math.hypot(dx,dz); if(d>R) continue;
    if(d>0.8&&!los(L,x,z,zx[i],zz[i])) continue;
    const k=1-d/R, dmg=40+440*k*k;
    if(dmg>=110&&Math.random()<0.6){ const r=Math.random(); zgib[i]=r<.4?1:r<.7?2:3; }
    damageZ(i,dmg,x,z,2.6*k,true);
    if(zst[i]&&zst[i]!==5) zstun[i]=Math.max(zstun[i],1.4*k);
  }
  // doors, boards and fences close by give; glass goes further out
  for(let cz=Math.floor(z)-7;cz<=Math.floor(z)+7;cz++) for(let cx=Math.floor(x)-7;cx<=Math.floor(x)+7;cx++){
    if(!inMap(cx,cz)) continue; const c=CI(cx,cz);
    for(const e of [MAP.eE[L][c],MAP.eS[L][c]]){ if(!e) continue; const m=edgeMid(e), d=Math.hypot(m.x-x,m.z-z);
      if(ED.t[e]===ET.WIN&&d<7) breakGlass(e); else if(d<3.2) damageEdge(e,320*(1-d/3.2)); } }
  if(AC) SFX.boom(clamp((x-ps.x)/25,-1,1),1/(1+dp*0.05));
  G.shake=Math.max(G.shake,1.1/(1+dp*0.07));
  if(dp<12){ G.kickX+=(ps.x-x)/(dp||1)*0.6; G.kickZ+=(ps.z-z)/(dp||1)*0.6; }
  makeNoise(x,z,85,L);
  scareBirds(x,z,80);
}
const fires=[];
function shatter(p,x,z){
  scene.remove(p.m);
  const y=p.L*LH, ps=squad[me], d=Math.hypot(x-ps.x,z-ps.z);
  if(AC) SFX.bottle(clamp((x-ps.x)/20,-1,1),0.6/(1+d*0.06));
  fires.push({x,z,y,L:p.L,r:2.6,t:10,max:10}); scorch(x,z,y,2.2);
  for(let k=0;k<12;k++) emit(true,x,y+0.3,z,rand(-3,3),rand(1,3),rand(-3,3),rand(.3,.6),rand(.8,1.4),0.2,0xff8a3a,1);
  makeNoise(x,z,18,p.L);
}
function updateFires(dt){
  boomT-=dt; boomLight.intensity=boomT>0?7*boomT/0.3:0; FL.boom.k=Math.max(0,FL.boom.k-dt*4);
  for(let k=fires.length-1;k>=0;k--){
    const f=fires[k]; f.t-=dt; const life=f.t/f.max, r=f.r*(0.6+0.4*Math.min(1,life*2));
    for(let n=0;n<3;n++){ const a=rand(0,6.28), rr=Math.sqrt(Math.random())*r; fireAt(f.x+Math.sin(a)*rr,f.y+0.15,f.z+Math.cos(a)*rr,30*life+6,dt,n===0); }
    eachNear(f.x,f.z,r+0.5,j=>{ if(zl[j]!==f.L||zst[j]===5) return; if(Math.hypot(zx[j]-f.x,zz[j]-f.z)<r) zburn[j]=Math.max(zburn[j],5); });
    if(f.t<=0) fires.splice(k,1);
  }
  // the two nearest fires get real lights
  const ps=squad[me];
  const near=fires.slice().sort((a,b)=>Math.hypot(a.x-ps.x,a.z-ps.z)-Math.hypot(b.x-ps.x,b.z-ps.z));
  for(let k=0;k<2;k++){ const f=near[k], l=fireLights[k], fl=k?FL.fire1:FL.fire0;
    if(f){ l.position.set(f.x,f.y+1.2,f.z); l.intensity=1.8*Math.min(1,f.t/2)*(0.8+Math.random()*0.3); fl.x=f.x; fl.y=f.y+0.8; fl.z=f.z; fl.k=0.5*Math.min(1,f.t/2); }
    else { l.intensity=0; fl.k=0; } }
}
// burning dead: hurts them, they keep walking, and they light up whoever they bump into
function burnZ(i,dt){
  zburn[i]-=dt; zhp[i]-=17*dt; zfl[i]=Math.max(zfl[i],0.3);
  if(Math.random()<dt*14) emit(true,zx[i]+rand(-.2,.2),zyv[i]+rand(.6,1.6),zz[i]+rand(-.2,.2),0,rand(1,2),0,rand(.25,.5),rand(.4,.7),0.1,Math.random()<.5?0xff7a28:0xffb04a,0.9);
  if(Math.random()<dt*2) eachNear(zx[i],zz[i],0.8,j=>{ if(j!==i&&zl[j]===zl[i]&&zst[j]!==5&&Math.random()<.3) zburn[j]=Math.max(zburn[j],3); });
  if(zhp[i]<=0){ zdx[i]=0; zdz[i]=0; killZ(i,true); return true; }
  return false;
}

/* ---------- the laser ---------- */
const laserGeo=new THREE.BufferGeometry(); laserGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,0,0],3));
const laser=new THREE.Line(laserGeo,new THREE.LineBasicMaterial({color:0xff2a1a,transparent:true,opacity:0.45,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
laser.frustumCulled=false; onFxLayer(laser); scene.add(laser);
const laserDot=makeSprite(texHalo,0xff3020,true,0.55);
function updateLaser(){
  const s=squad[me], W=WPN[s.wpn];
  const show=s.alive&&!W.melee&&!s.sprint&&!s.dodge&&!s.vault&&s.reloadT<=0&&s.drawT<=0&&G.started&&!G.mapOpen;
  laser.visible=show; laserDot.visible=show; if(!show) return;
  const M=muzzlePos(s,W), fx_=Math.sin(s.ang), fz_=Math.cos(s.ang), R=Math.min(W.range,hasMod(s,'scope')?60:48);
  const H=gridRay(s.L,M.x,M.z,M.x+fx_*R,M.z+fz_*R,(e)=>SHOTB[ED.t[e]]===1);
  let t=H.t*R;
  for(let j=0;j<MAXZ;j++){ if(!zst[j]||zst[j]===5||!shootable(s.L,j)) continue; const dx=zx[j]-M.x, dz=zz[j]-M.z, tt=dx*fx_+dz*fz_; if(tt<0||tt>t) continue; if(Math.abs(dx*fz_-dz*fx_)<0.35) t=tt; }
  const y=s.y+1.48, P=laserGeo.attributes.position;
  P.setXYZ(0,M.x,y,M.z); P.setXYZ(1,M.x+fx_*t,y-0.1*t/R,M.z+fz_*t); P.needsUpdate=true;
  laserDot.position.set(M.x+fx_*t,y-0.1*t/R,M.z+fz_*t);
  laser.material.opacity=G.phase==='day'?0.25:0.45;
}

