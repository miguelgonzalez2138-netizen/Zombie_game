'use strict';
// Fog Line — Animation: ragdoll-ish deaths, the dead stumbling, falling and getting back up, grabbing and feeding,
// soldiers fidgeting, smoking at night and slumping when tired, magazines in hand, big melee arcs, cloth in the wind,
// and the bodies left around the neighborhood.
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- deaths: a little physics instead of one canned fall ---------- */
// per zombie: vx vy vz h pitch pitchV roll rollV armL armLV armR armRV legL legLV legR legRV head headV ox oz
const RD=new Float32Array(MAXZ*20), zlastK=new Float32Array(MAXZ), zblast=new Uint8Array(MAXZ), zspurt=new Float32Array(MAXZ);
function ragdollStart(i){
  const o=i*20, k=Math.min(2.5,zlastK[i]||0.2), blast=zblast[i];
  const dx=zdx[i]||Math.sin(zang[i]+Math.PI), dz=zdz[i]||Math.cos(zang[i]+Math.PI);
  RD[o]=dx*(0.8+k*3.6)*rand(.85,1.25); RD[o+2]=dz*(0.8+k*3.6)*rand(.85,1.25); RD[o+1]=blast?rand(5,9):rand(0.6,1.8)+k*1.1;
  RD[o+3]=0; RD[o+4]=0; RD[o+5]=zfall[i]*rand(4,7)*(1+k*0.8); RD[o+6]=0; RD[o+7]=rand(-4.5,4.5)*(1+k*0.5);
  for(let m=8;m<18;m+=2){ RD[o+m]=0; RD[o+m+1]=rand(-12,12)*(1+k*0.6); }
  zspurt[i]=k>0.3||blast?rand(0.4,0.9):0.2;
  RD[o+18]=0; RD[o+19]=0;
  zblast[i]=0; zlastK[i]=0;
}
const _rp={x:0,z:0};
function ragdollStep(i,dt){
  const o=i*20, f=zfall[i]||1, T=zdie[i];
  if(zspurt[i]>0){ zspurt[i]-=dt; if(Math.random()<dt*25) bleed(zx[i]+RD[o+18],zyv[i]+0.8+RD[o+3],zz[i]+RD[o+19],RD[o]*0.3,RD[o+2]*0.3,2,2.2,zyv[i]); }
  // root: thrown, falls, bounces, slides to a stop against walls
  RD[o+1]-=14*dt; RD[o+3]+=RD[o+1]*dt;
  if(RD[o+3]<0){ RD[o+3]=0; if(Math.abs(RD[o+1])>1.2){ for(let m=9;m<18;m+=2) RD[o+m]+=rand(-4,4); } RD[o+1]*=-0.25; RD[o]*=0.55; RD[o+2]*=0.55; }
  const nx=zx[i]+RD[o+18]+RD[o]*dt, nz=zz[i]+RD[o+19]+RD[o+2]*dt;
  if(cellWalk(zl[i],Math.floor(nx),Math.floor(nz))){ _rp.x=nx; _rp.z=nz; collideGrid(_rp,0.25,zl[i],AG.THING); RD[o+18]=_rp.x-zx[i]; RD[o+19]=_rp.z-zz[i]; }
  else { RD[o]*=-0.3; RD[o+2]*=-0.3; }
  if(RD[o+3]===0){ RD[o]*=Math.pow(0.05,dt); RD[o+2]*=Math.pow(0.05,dt); }
  // the body tips over and slams flat
  const lie=1.48*f;
  RD[o+5]+=f*10*dt*Math.min(1,Math.abs(RD[o+4])+0.3);
  RD[o+4]+=RD[o+5]*dt;
  if(f>0?RD[o+4]>lie:RD[o+4]<lie){ RD[o+4]=lie; RD[o+5]*=-0.22; if(Math.abs(RD[o+5])<0.5) RD[o+5]=0; for(let m=9;m<18;m+=2) RD[o+m]+=rand(-5,5); }
  RD[o+7]*=Math.pow(0.1,dt); RD[o+6]+=RD[o+7]*dt; RD[o+6]=clamp(RD[o+6],-0.9,0.9);
  // limbs: floppy springs toward a sprawl
  const rest=[-1.4*f-0.6,-0.5*f-0.3,0.35,-0.45,0.4*f];
  for(let m=0;m<5;m++){ const a=o+8+m*2; RD[a+1]+=((rest[m]-RD[a])*14-RD[a+1]*3.2)*dt; RD[a]+=RD[a+1]*dt; }
  const settled=T>0.9&&RD[o+3]===0&&Math.abs(RD[o+5])<0.3&&Math.hypot(RD[o],RD[o+2])<0.15;
  return settled||T>2.6;
}
function poseRagdoll(i){
  const R=zr, o=i*20, var_=zvar[i];
  const legY=lookZ(i);
  const p=Math.abs(RD[o+4]);
  R.root.position.set(zx[i]+RD[o+18],zyv[i]+RD[o+3]+0.1*Math.min(1,p/1.4),zz[i]+RD[o+19]);
  R.root.rotation.set(RD[o+4],zang[i],RD[o+6]+ztilt[i]*0.4); R.root.scale.setScalar(zsc[i]);
  if(var_===3){ R.hip.position.set(0,0.2,0); R.torso.rotation.set(1.5,0,0); }
  else { R.hip.position.set(0,0.92*legY,0); R.hip.rotation.set(0,0,0); R.torso.rotation.set(zhunch[i]*(1-Math.min(1,p)),0,0); }
  R.armL.rotation.set(RD[o+8],0,-0.3+RD[o+10]*0.2); R.armR.rotation.set(RD[o+10],0,0.3-RD[o+8]*0.2);
  R.legL.rotation.set(RD[o+12],0,-0.1); R.legR.rotation.set(RD[o+14],0,0.12);
  R.head.rotation.set(RD[o+16],0,ztilt[i]+RD[o+6]*0.5);
  writeZ(i);
}
// final resting place: freeze the pose where it landed
function ragdollEnd(i){ const o=i*20; zx[i]+=RD[o+18]; zz[i]+=RD[o+19]; RD[o+18]=0; RD[o+19]=0; }

/* ---------- knocked down: lies there, then gets back up ---------- */
const zdown=new Float32Array(MAXZ), zdownMax=new Float32Array(MAXZ);
function knockDown(i,k){ if(zvar[i]===3||zdown[i]>0||ztr[i]) return; const d=rand(1.4,2.6)*Math.min(1.4,0.7+k*0.5); zdown[i]=d; zdownMax[i]=d; zstun[i]=Math.max(zstun[i],d); zfall[i]=Math.random()<.65?-1:1; }
function poseDown(i){
  const R=zr, legY=lookZ(i), T=zdownMax[i]-zdown[i], M=zdownMax[i], f=zfall[i]||-1;
  // fall over in 0.3s, lie, push back up over the last 0.7s
  let u; if(T<0.3) u=T/0.3; else if(zdown[i]<0.7) u=zdown[i]/0.7; else u=1;
  const e=u*u*(3-2*u), wob=zdown[i]>0.7&&T>0.3?Math.sin(time*7+i)*0.05:0;
  R.root.position.set(zx[i]-Math.sin(zang[i])*f*0.5*e,zyv[i]+0.12*e,zz[i]-Math.cos(zang[i])*f*0.5*e);
  R.root.rotation.set(f*1.45*e,zang[i],ztilt[i]*0.4*e+wob); R.root.scale.setScalar(zsc[i]);
  R.hip.position.set(0,0.92*legY*(1-0.15*e),0); R.hip.rotation.set(0,0,0);
  R.torso.rotation.set(zhunch[i]*(1-e)+(zdown[i]<0.7&&T>0.3?0.5*(1-u):0),0,0);
  const push=zdown[i]<0.7&&T>0.3?Math.sin((1-u)*Math.PI):0;
  R.armL.rotation.set(-0.4-1.2*e+push*0.9,0,-0.4*e); R.armR.rotation.set(-0.6-1.0*e+push*0.9,0,0.5*e);
  R.legL.rotation.set(0.3*e,0,-0.1); R.legR.rotation.set(-0.2*e+push*0.6,0,0.1);
  R.head.rotation.set(0.3*e,0,ztilt[i]);
  writeZ(i);
}

/* ---------- grabs: it gets hold of you and pulls you in ---------- */
const zgrab=new Int8Array(MAXZ), zgrabT=new Float32Array(MAXZ);
function startGrab(i,k){ zgrab[i]=k+1; zgrabT[i]=1.4; const s=squad[k];
  const dx=s.x-zx[i], dz=s.z-zz[i], d=Math.hypot(dx,dz)||1; s.vx+=dx/d*2.2; s.vz+=dz/d*2.2;
  if(s.i===me){ radioLine('It\'s got you. Shove it off (V).'); G.shake=Math.max(G.shake,0.6); G.kickX+=dx/d*0.7; G.kickZ+=dz/d*0.7; hurtFlash=Math.max(hurtFlash,0.18); }
  zSound(i,'shriek'); }
function releaseGrab(i){ zgrab[i]=0; zgrabT[i]=0; }
function poseGrab(i,s,dt){
  const R=zr, legY=lookZ(i), t=time*16+i, jerk=Math.sin(t)*Math.sin(t*0.37);
  R.root.position.set(zx[i]+Math.sin(zang[i])*jerk*0.12,zyv[i],zz[i]+Math.cos(zang[i])*jerk*0.12); R.root.rotation.set(0.15*jerk,zang[i],Math.sin(t)*0.16); R.root.scale.setScalar(zsc[i]);
  R.hip.position.set(0,0.92*legY,0); R.hip.rotation.set(0,Math.sin(t*0.5)*0.15,0);
  R.torso.rotation.set(0.7+jerk*0.25,0,Math.sin(t*0.7)*0.2);
  R.armL.rotation.set(-1.85+Math.sin(t)*0.4,0,0.45+jerk*0.2); R.armR.rotation.set(-1.75-Math.sin(t)*0.4,0,-0.45-jerk*0.2);
  R.legL.rotation.set(0.35,0,0); R.legR.rotation.set(-0.25,0,0);
  R.head.rotation.set(0.35+Math.sin(t*1.3)*0.35,Math.sin(t*0.8)*0.3,ztilt[i]);
  writeZ(i);
  if(Math.random()<dt*6) bleed(s.x,1.3,s.z,s.x-zx[i],s.z-zz[i],1,0.8,s.y);
}

/* ---------- feeding: where bodies are, the idle dead crouch and eat ---------- */
const feeds=[];      // {x,z,L}
const zfeed=new Uint8Array(MAXZ);
function feedSpot(i){ const L=zl[i]; let best=null, bd=9; for(const f of feeds){ if(f.L!==L) continue; const d=Math.hypot(f.x-zx[i],f.z-zz[i]); if(d<bd){ bd=d; best=f; } } return best; }
function poseFeed(i){
  const R=zr, legY=lookZ(i), t=time*2+i*1.7;
  R.root.position.set(zx[i],zyv[i]-0.35,zz[i]); R.root.rotation.set(0,zang[i],0); R.root.scale.setScalar(zsc[i]);
  R.hip.position.set(0,0.92*legY-0.15,0); R.hip.rotation.set(0,0,0);
  R.torso.rotation.set(1.05+Math.sin(t*1.7)*0.12,0,Math.sin(t)*0.05);
  R.armL.rotation.set(-0.9+Math.sin(t*2.1)*0.35,0,0.2); R.armR.rotation.set(-0.8-Math.sin(t*1.9)*0.3,0,-0.2);
  R.legL.rotation.set(-1.2,0,-0.2); R.legR.rotation.set(-0.6,0,0.2);
  R.head.rotation.set(0.6+Math.max(0,Math.sin(t*3))*0.35,Math.sin(t)*0.2,ztilt[i]);
  writeZ(i);
}

/* ---------- soldiers: fidgets, a smoke at night, slumping when tired, the mag in hand ---------- */
const matEmber=new THREE.SpriteMaterial({map:texSoft,color:0xff7a30,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false});
const matMag=phong({color:0x1c1a18});
forEachSoldier(s=>{ const e=new THREE.Sprite(matEmber.clone()); e.scale.setScalar(0.18); e.visible=false; onFxLayer(e); scene.add(e); s.ember=e; s.idle={t:rand(2,6),kind:'',k:0}; s.smokeT=rand(0,10); });
function soldierIdle(s,u,dt,still){
  const I=s.idle;
  // smoking: at the shop, at night, nothing going on
  let chasing=0; if(still&&atBase(s)&&(G.phase==='night'||G.phase==='dusk')) for(let i=0;i<MAXZ&&chasing<2;i++) if(zst[i]===3) chasing++;
  const smoke=still&&atBase(s)&&(G.phase==='night'||G.phase==='dusk')&&chasing<2&&s.i!==me&&s.stress<60&&!s.mounted;
  if(smoke){ s.smokeT+=dt; const draw=(s.smokeT%9)<1.2;
    s.ember.visible=true; const hx=s.x+Math.sin(s.ang)*0.22, hz=s.z+Math.cos(s.ang)*0.22; s.ember.position.set(hx,s.y+1.98,hz);
    s.ember.material.opacity=draw?1:0.45+Math.sin(time*3)*0.1; s.ember.scale.setScalar(draw?0.22:0.15);
    if(draw&&Math.random()<dt*6) emit(false,hx,s.y+2.05,hz,rand(-.1,.1),rand(.25,.5),rand(-.1,.1),rand(2,3.5),0.15,0.9,0xa8a6a0,0.25);
    u.W.rotation.x+=0.75;
  } else s.ember.visible=false;
  if(!still){ I.kind=''; I.t=Math.max(I.t,rand(2,4)); return; }
  I.t-=dt;
  if(!I.kind&&I.t<=0){ I.kind=['look','look','shift','stretch','look'][Math.random()*5|0]; I.k=0; I.dir=Math.random()<.5?-1:1; }
  if(I.kind){ I.k+=dt/1.8; const w=Math.sin(Math.min(1,I.k)*Math.PI);
    if(I.kind==='look'&&u.head) u.head.rotation.y=w*0.7*I.dir;
    else if(I.kind==='shift') u.W.rotation.x+=w*0.35;
    else if(I.kind==='stretch'){ u.torso.rotation.x-=w*0.18; u.torso.rotation.z+=w*0.12*I.dir; }
    if(I.k>=1){ I.kind=''; I.t=rand(4,9); if(u.head) u.head.rotation.y=0; } }
}
function fatiguePose(s,u){ if(s.fat>70){ const k=(s.fat-70)/30; u.torso.rotation.x+=0.12+0.14*k; if(u.head) u.head.rotation.x=0.15*k; } else if(u.head) u.head.rotation.x=0; }
// the magazine leaves the gun, goes to the pouch, comes back full
function magInHand(s,u){
  if(!u.mag){ u.mag=gbox(u.W,0.05,0.16,0.08,matMag,0,0,0); u.mag.visible=false; }
  const W=WPN[s.wpn];
  if(s.reloadT<=0||W.shell||W.melee||s.wpn==='m240'){ u.mag.visible=false; return; }
  const k=1-s.reloadT/s.reloadMax;
  if(k<0.25||k>0.88){ u.mag.visible=false; return; }
  u.mag.visible=true;
  const pistol=W.hold==='pistol', well=pistol?[0,0.36,0.5]:[0.1,0.26,0.36], pouch=[-0.12,0.18,0.2];
  const t=k<0.55?(k-0.25)/0.3:1-(k-0.55)/0.33, e=Math.sin(Math.min(1,t)*Math.PI/2);
  u.mag.position.set(lerp(well[0],pouch[0],e),lerp(well[1],pouch[1],e),lerp(well[2],pouch[2],e)); u.mag.rotation.set(e*0.8,0,e*0.4);
}

/* ---------- big melee arcs ---------- */
const arcs=[];
for(let k=0;k<4;k++){ const m=new THREE.Mesh(new THREE.RingGeometry(1,1.18,18,1,0,1.4),new THREE.MeshBasicMaterial({color:0xf6eedc,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
  m.rotation.order='YXZ'; m.visible=false; onFxLayer(m); scene.add(m); arcs.push({m,t:0}); }
let arcIdx=0;
function swingArc(s,reach,arc,bat){
  const A=arcs[arcIdx]; arcIdx=(arcIdx+1)%arcs.length;
  A.m.geometry.dispose(); A.m.geometry=new THREE.RingGeometry(reach*0.55,reach,18,1,-arc,arc*2);
  A.m.position.set(s.x,s.y+1.15,s.z); A.m.rotation.set(-Math.PI/2,s.ang-Math.PI/2,0); A.m.visible=true; A.t=0.18; A.m.material.color.setHex(bat?0xf6eedc:0xffd8b0);
}
function updateArcs(dt){ for(const A of arcs){ if(A.t<=0) continue; A.t-=dt; A.m.material.opacity=Math.max(0,A.t/0.18)*0.45; if(A.t<=0) A.m.visible=false; } }

/* ---------- cloth: laundry, flags, tarps moving in the wind ---------- */
const CLOTH_U={uTime:{value:0},uGust:{value:0.3}};
function clothMat(hex){
  const m=new THREE.MeshPhongMaterial({color:hex,side:THREE.DoubleSide,shininess:0});
  m.onBeforeCompile=sh=>{ sh.uniforms.uTime=CLOTH_U.uTime; sh.uniforms.uGust=CLOTH_U.uGust;
    sh.vertexShader='uniform float uTime; uniform float uGust;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float hang=uv.x; float w=sin(uTime*(2.2+uGust*3.0)+position.x*2.6+position.y*1.3)*0.5+sin(uTime*3.7+position.x*5.0)*0.25;
      transformed.z+=w*hang*(0.12+uGust*0.45); transformed.y-=hang*hang*0.05*(1.0-uGust);`); };
  return m;
}
const cloths=[];
function addCloth(x,y,z,w,h,ry,hex,anchorTop){
  const g=new THREE.PlaneGeometry(w,h,8,4);
  // uv.x = how free this vertex is to move (0 at the anchored edge)
  const uv=g.attributes.uv; for(let k=0;k<uv.count;k++){ const u=uv.getX(k), v=uv.getY(k); uv.setX(k,anchorTop?1-v:u); }
  const m=new THREE.Mesh(g,clothMat(hex)); m.position.set(x,y,z); m.rotation.y=ry; m.castShadow=true; scene.add(m); cloths.push(m); return m;
}
{
  const lines=[[-39,4],[-39,30],[-39,-58],[33,-8],[33,56],[-111,20]];
  const cols=[0xb8b0a0,0x8a3a32,0x3a5a7a,0xd0c8b0,0x6a7a4a,0x9a8a6a];
  for(const [x,z] of lines){ if(!inMap(Math.floor(x),Math.floor(z))||MAP.bld[0][CI(Math.floor(x),Math.floor(z))]>=0) continue;
    for(let k=0;k<3;k++) addCloth(x+rand(-1.5,1.5),3.2,z+k*1.1-1.1,0.9,1.1,Math.PI/2,cols[Math.random()*cols.length|0],true);
    const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute([x-3,3.75,z-2,x+3,3.75,z+2],3)); scene.add(new THREE.Line(lg,new THREE.LineBasicMaterial({color:0x5a5650}))); }
  // a flag over the police station, a tarp on the bus, a torn banner at the checkpoint
  addCloth(85.5,9.2,-82,1.6,1.0,0,0x2a3a6a,false);
  addCloth(30,3.0,-28.5,3,1.6,1.18,0x4a5a3a,true);
  addCloth(-12,2.6,-21.5,2.4,0.7,0,0xd8d0b8,false);
}
function updateCloth(){ CLOTH_U.uTime.value=time; CLOTH_U.uGust.value=G.gust; }

/* ---------- bodies around the neighborhood ---------- */
function placeBody(x,z,L,ang,outfit){
  const i=spawnZ(x,z,4,0,0,L||0); if(i<0) return;
  if(outfit!==undefined) zout[i]=outfit;
  zang[i]=ang||rand(0,6); zfall[i]=Math.random()<.5?1:-1; zdx[i]=0; zdz[i]=0; zgib[i]=0;
  poseDying(i,1); freezeCorpse(i); const k=(cIdx-1+MAXC)%MAXC; cNight[k]=-1;
  zst[i]=0; hideZ(i);
  pool(x+rand(-.4,.4),z+rand(-.4,.4),rand(0.8,1.4),(L||0)*LH);
  feeds.push({x,z,L:L||0});
}
const VIGNETTES=[[-39.5,-50,0],[-24,-29.5,0],[-52,-36,0],[19,32,0],[22,-80,0],[-91,-13,0],[-36,112,0],[96,-17,0],[-60,60,0],[48,-36,0]];
function placeVignettes(){
  for(const [x,z,L] of VIGNETTES){ const p=findSpot(L,x,z); if(p) placeBody(p.x,p.z,L,undefined,Math.random()<.7?0:3); }
}
// a few of the dead hunched over each body when the day starts
function spawnFeeders(){
  for(const f of feeds){ if(Math.random()<.45) continue; if(Math.hypot(f.x-(-20),f.z-14)<30) continue;
    const n=1+(Math.random()*3|0); for(let k=0;k<n;k++){ const a=rand(0,6.28), p=findSpot(f.L,f.x+Math.sin(a)*0.9,f.z+Math.cos(a)*0.9); if(!p) continue;
      const i=spawnZ(p.x,p.z,4,0,0,f.L); if(i>=0){ zang[i]=Math.atan2(f.x-p.x,f.z-p.z); zfeed[i]=1; zwt[i]=99; } } }
}
