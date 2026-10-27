'use strict';
// Fog Line — The block as a safehouse: quiet nights vs event nights, the dead turning back at the line,
// the squad off duty (one on watch, the rest at the fire, on the cots, at the stove), sitting and sleeping,
// dinner, night jobs at the workbench, and fixing up the shop.
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- quiet nights and event nights ---------- */
// only these nights bring the horde to the line; everything else is stragglers and scenery
const EVENT_NIGHTS=['siege','brutal','two'];
function eventNight(){ return (G.phase==='night'||G.phase==='dusk')&&EVENT_NIGHTS.includes(G.nightType); }
// the block: the line on the north, the wall on the south, the shop and the buildings either side of Wolcott
const SAFE={x0:-34,x1:14,z0:-14.2,z1:50};
function inSafe(x,z){ return x>SAFE.x0&&x<SAFE.x1&&z>SAFE.z0&&z<SAFE.z1; }
// is anything actually coming? (chasers near the block)
function threatNear(){ let n=0; for(let i=0;i<MAXZ;i++){ if(zst[i]!==3) continue; if(zx[i]>SAFE.x0-12&&zx[i]<SAFE.x1+12&&zz[i]>SAFE.z0-14&&zz[i]<SAFE.z1+8&&++n>3) return true; } return false; }
let offDutyCache=false, offDutyT=0;
function offDuty(){ return offDutyCache; }
function updateOffDuty(dt){ offDutyT-=dt; if(offDutyT>0) return; offDutyT=0.5;
  offDutyCache=(G.phase==='night'||G.phase==='dusk')&&!eventNight()&&!threatNear(); }
// a straggler at the line on a quiet night gives up and wanders back out
const zline=new Float32Array(MAXZ);
function boredAtLine(i,dt){ zline[i]+=dt; if(zline[i]<rand(1.5,4)) return false; zline[i]=0; zst[i]=4; ztx[i]=zx[i]+rand(-14,14); ztz[i]=zz[i]-rand(10,22); zwt[i]=rand(8,14); zDirect[i]=0; return true; }

/* ---------- places to be ---------- */
const SPOTS=[];   // {kind:'fire'|'cot'|'radio'|'stove'|'bench'|'watch'|'lookout', x,z,L,ang, by}
{
  const B=LANDMARK.base;
  for(let k=0;k<6;k++){ const a=k/6*Math.PI*2+0.3, x=LIGHT_BARREL.x+Math.sin(a)*1.45, z=LIGHT_BARREL.z+Math.cos(a)*1.45;
    if(cellWalk(0,Math.floor(x),Math.floor(z))) SPOTS.push({kind:'fire',x,z,L:0,ang:Math.atan2(LIGHT_BARREL.x-x,LIGHT_BARREL.z-z)}); }
  for(const f of MAP.furn){ if(!f||f.b!==B.id) continue; const cx=(f.x0+f.x1)/2, cz=(f.z0+f.z1)/2;
    if(f.type==='cot'){ const ap=findSpot(f.L,cx-1,cz)||{x:cx-1,z:cz}; SPOTS.push({kind:'cot',x:cx,z:cz,L:f.L,ang:(f.z1-f.z0)>(f.x1-f.x0)?0:Math.PI/2,f,lie:true,ax:ap.x,az:ap.z}); }
    if(f.radio){ const p=findSpot(f.L,cx-1.1,cz)||{x:cx-1,z:cz}; SPOTS.push({kind:'radio',x:p.x,z:p.z,L:f.L,ang:Math.atan2(cx-p.x,cz-p.z),f});
      const p2=findSpot(f.L,cx+1.1,cz+1)||{x:cx+1,z:cz+1}; SPOTS.push({kind:'radio',x:p2.x,z:p2.z,L:f.L,ang:Math.atan2(cx-p2.x,cz-p2.z),f}); }
    if(f.stove){ const p=findSpot(f.L,cx+1,cz)||{x:cx+1,z:cz}; SPOTS.push({kind:'stove',x:p.x,z:p.z,L:f.L,ang:Math.atan2(cx-p.x,cz-p.z),f,stand:true}); }
    if(f.workbench){ const p=findSpot(f.L,cx+1,cz)||{x:cx+1,z:cz}; SPOTS.push({kind:'bench',x:p.x,z:p.z,L:f.L,ang:Math.atan2(cx-p.x,cz-p.z),f,stand:true}); }
  }
  SPOTS.push({kind:'watch',x:-0.5,z:-12.4,L:0,ang:Math.PI,stand:true});
}
const STOOLS=[];
{ const m=phong({color:0x5a4a34}); for(const s of SPOTS) if(s.kind==='fire'){ const st=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.42,0.45),m); st.position.set(s.x,0.21,s.z); st.castShadow=true; scene.add(st); STOOLS.push(st); } }
function freeSpot(kind,s){ let best=null, bd=1e9; for(const p of SPOTS){ if(p.kind!==kind||(p.by&&p.by!==s&&present(p.by))) continue; const d=Math.hypot(p.x-s.x,p.z-s.z); if(d<bd){ bd=d; best=p; } } return best; }
function releaseSpot(s){ for(const p of SPOTS) if(p.by===s) p.by=null; if(s.atSpot&&s.atSpot.lie){ s.x=s.atSpot.ax; s.z=s.atSpot.az; } s.spot=null; s.atSpot=null; s.pose=''; }
function nearSpot(s,r){ let best=null, bd=r; for(const p of SPOTS){ if(p.L!==s.L||p.kind==='watch'||p.kind==='stove'||p.kind==='bench'||(p.by&&p.by!==s)) continue; const d=Math.hypot(p.x-s.x,p.z-s.z); if(d<bd){ bd=d; best=p; } } return best; }

/* ---------- the squad off duty ---------- */
// one keeps watch at the line (the freshest), one cooks if there's food and fuel, the tired ones sleep, the rest sit at the fire or the radio
const G_DINNER={cooked:false,cookT:0,ate:new Set()};
function offDutyJob(s){
  const crew=squad.filter(q=>q.i!==me&&present(q)&&q.order==='hold'&&!q.postSet&&!q.mounted);
  const watcher=crew.slice().sort((a,b)=>a.fat-b.fat)[0];
  if(s===watcher) return BASEUP.lookout?'lookout':'watch';
  const cook=crew.filter(q=>q!==watcher).sort((a,b)=>a.uid-b.uid)[0];
  if(s===cook&&!G_DINNER.cooked&&SUP.food>=1&&SUP.fuel>=1) return 'stove';
  if(s.fat>55) return 'cot';
  return (s.uid%3===0&&squad.some(q=>q.i===me&&q.spot&&q.spot.kind==='radio'))?'radio':((s.uid+G.night)%4===0?'radio':'fire');
}
// returns true if it handled the buddy this frame
// told to rest: a cot (or a stool if the cots are taken), day or night, until told otherwise or something's on top of them
function restBuddy(s,dt){
  if(s.aimJ>=0&&zst[s.aimJ]&&Math.hypot(zx[s.aimJ]-s.x,zz[s.aimJ]-s.z)<7){ if(s.spot) releaseSpot(s); return false; }
  if(s.spot&&s.spot.kind!=='cot'&&freeSpot('cot',s)) releaseSpot(s);
  if(!s.spot||(s.spot.kind!=='cot'&&s.spot.kind!=='fire'&&s.spot.kind!=='radio')){ if(s.spot) releaseSpot(s); const sp=freeSpot('cot',s)||freeSpot('fire',s)||freeSpot('radio',s); if(!sp) return false; sp.by=s; s.spot=sp; }
  const sp=s.spot, gx=sp.lie?sp.ax:sp.x, gz=sp.lie?sp.az:sp.z, d=Math.hypot(gx-s.x,gz-s.z);
  if(!s.atSpot&&(d>0.45||s.L!==sp.L)){ s.pose=''; s.resting=false; navTo(s,gx,gz,sp.L,d>8?3.6:2.4,dt); s.status='TO A COT'; return true; }
  s.atSpot=sp; s.resting=true; s.x=lerp(s.x,sp.x,Math.min(1,dt*6)); s.z=lerp(s.z,sp.z,Math.min(1,dt*6)); s.vx=s.vz=0;
  let da=sp.ang-s.ang; while(da>Math.PI) da-=Math.PI*2; while(da<-Math.PI) da+=Math.PI*2; s.ang+=da*Math.min(1,dt*4);
  s.pose=sp.lie?'lie':'sit'; s.lightOn=false;
  s.fat=Math.max(0,s.fat-(sp.lie?1.2:0.3)*dt); s.stress=Math.max(0,s.stress-(sp.lie?3:2.5)*dt);
  s.status=sp.lie?'ASLEEP':'RESTING';
  return true;
}
function offDutyBuddy(s,dt){
  if(s.order==='rest'&&!s.mounted&&!s.away) return restBuddy(s,dt);
  if(!offDuty()||s.order!=='hold'||s.postSet||s.mounted||s.away){ if(s.spot) releaseSpot(s); return false; }
  // something right on top of us: drop everything
  if(s.aimJ>=0&&zst[s.aimJ]&&Math.hypot(zx[s.aimJ]-s.x,zz[s.aimJ]-s.z)<7){ if(s.spot) releaseSpot(s); return false; }
  s.jobT=(s.jobT||0)-dt;
  if(!s.spot||s.jobT<=0){ const kind=offDutyJob(s); if(!s.spot||(s.spot.kind!==kind&&!(s.spot.kind==='cot'&&s.fat>20))){ if(s.spot) releaseSpot(s); const sp=kind==='lookout'?SPOTS.find(p=>p.kind==='lookout'):freeSpot(kind,s)||freeSpot('fire',s)||freeSpot('radio',s); if(sp){ sp.by=s; s.spot=sp; } } s.jobT=rand(20,40); }
  const sp=s.spot; if(!sp) return false;
  const gx=sp.lie?sp.ax:sp.x, gz=sp.lie?sp.az:sp.z, d=Math.hypot(gx-s.x,gz-s.z);
  if(!s.atSpot&&(d>0.45||s.L!==sp.L)){ s.pose=''; navTo(s,gx,gz,sp.L,d>8?3.6:2.4,dt); s.status='OFF DUTY'; return sp.kind==='watch'||sp.kind==='lookout'?false:true; }
  s.atSpot=sp; s.x=lerp(s.x,sp.x,Math.min(1,dt*6)); s.z=lerp(s.z,sp.z,Math.min(1,dt*6)); s.vx=s.vz=0;
  let da=sp.ang-s.ang; while(da>Math.PI) da-=Math.PI*2; while(da<-Math.PI) da+=Math.PI*2; s.ang+=da*Math.min(1,dt*4);
  s.pose=sp.lie?'lie':sp.stand?(sp.kind==='stove'?'cook':sp.kind==='bench'?'work':'stand'):'sit';
  // what it does for them
  if(sp.kind==='cot'){ s.fat=Math.max(0,s.fat-1.2*dt); s.stress=Math.max(0,s.stress-3*dt); s.status='ASLEEP'; s.lightOn=false; }
  else if(sp.kind==='fire'||sp.kind==='radio'){ s.stress=Math.max(0,s.stress-(BASEUP.den?4:2.5)*dt); s.fat=Math.max(0,s.fat-0.15*dt); s.status=G_DINNER.ate.has(s.uid)?'EATING':'AT THE FIRE'; if(sp.kind==='radio') s.status='BY THE RADIO'; s.lightOn=false; }
  else if(sp.kind==='stove'){ s.status='COOKING'; cookStep(s,dt); }
  else if(sp.kind==='watch'||sp.kind==='lookout'){ s.status='ON WATCH'; s.pose=sp.kind==='lookout'?'sit':'stand'; return false; }
  return true;
}
function cookStep(s,dt){
  if(G_DINNER.cooked) return;
  G_DINNER.cookT+=dt; if(Math.random()<dt*3) emit(false,s.spot.f?(s.spot.f.x0+s.spot.f.x1)/2:s.x,s.y+1.3,s.spot.f?(s.spot.f.z0+s.spot.f.z1)/2:s.z,0,0.5,0,rand(2,3),0.2,0.8,0xb8b4ac,0.3);
  if(G_DINNER.cookT>=40){ G_DINNER.cooked=true; SUP.fuel=Math.max(0,SUP.fuel-1); G.hotMeal=true;
    radio(nameOf(s)+': '+['Chow\'s up.','Beans again. Hot beans, though.','Come eat before it\'s cold.','It\'s food. Mostly.'][Math.random()*4|0]);
    for(const q of squad) if(present(q)&&atBase(q)){ q.stress=Math.max(0,q.stress-20); G_DINNER.ate.add(q.uid); q.mealT=25; }
    if(squad[me]&&atBase(squad[me])) giveXP(s,6,'heal');
  }
}
function comfyDusk(){ G_DINNER.cooked=false; G_DINNER.cookT=0; G_DINNER.ate.clear(); }

/* ---------- the player: sit, sleep ---------- */
// E at a stool, a cot or the radio. Sleeping on a quiet night runs the clock fast until something happens.
function sitDown(s,sp){ releaseSpot(s); sp.by=s; s.spot=sp; s.atSpot=sp; s.pose=sp.lie?'lie':'sit'; s.x=sp.x; s.z=sp.z; s.ang=sp.ang; s.vx=s.vz=0; cancelReload(s);
  if(sp.lie){ if(offDuty()){ s.sleeping=true; s.prevScale=timeScale; timeScale=4; bannerShow('SLEEPING','4× until morning or trouble',2); } else radioLine('Can\'t sleep with them this close.'); }
  else radioLine(sp.kind==='radio'?(BASEUP.gen?'The radio plays something old.':'Just static. Somebody should rig up power.'):'You pull a stool up to the fire.'); }
function standUp(s){ if(s.sleeping){ s.sleeping=false; timeScale=s.prevScale||1; } releaseSpot(s); }
function playerComfy(s,moving,dt){
  if(!s.spot) return;
  if(moving||s.L!==s.spot.L){ standUp(s); return; }
  s.x=s.spot.x; s.z=s.spot.z; s.vx=s.vz=0;
  if(s.spot.lie){ s.fat=Math.max(0,s.fat-2*dt); s.stress=Math.max(0,s.stress-3*dt); if(s.sleeping&&!offDuty()){ standUp(s); bannerShow('WAKE UP','Something\'s out there.',2.5); } }
  else { s.stress=Math.max(0,s.stress-(BASEUP.den?4:2.5)*dt); }
}

/* ---------- poses ---------- */
const matBowl=phong({color:0x8a8478});
function applyPose(s,u){
  if(!s.pose) { if(u.bowl) u.bowl.visible=false; return; }
  if(s.pose==='sit'){ s.mesh.position.y-=0.5; u.legs[0].rotation.x=-1.45; u.legs[1].rotation.x=-1.3; u.torso.position.y=0.86; u.torso.rotation.x=0.12+Math.sin(time*0.6+s.uid)*0.03; u.W.rotation.x=1.0; u.W.rotation.y=-0.4; }
  else if(s.pose==='lie'){ s.mesh.rotation.set(-Math.PI/2,s.spot?s.spot.ang:s.ang,0); s.mesh.position.y+=0.62; u.legs[0].rotation.x=0.05; u.legs[1].rotation.x=-0.1; u.torso.rotation.set(0,0,0); u.W.rotation.x=1.3; if(u.head) u.head.rotation.y=0.4; }
  else if(s.pose==='cook'||s.pose==='work'){ u.W.rotation.x=0.9+Math.sin(time*(s.pose==='cook'?5:8))*0.1; u.torso.rotation.x=0.25; }
  else if(s.pose==='stand'){ }
  // a bowl in hand after dinner
  if(!u.bowl){ u.bowl=gbox(u.torso,0.16,0.07,0.16,matBowl,0,0.38,0.3); u.bowl.visible=false; }
  u.bowl.visible=(s.mealT||0)>0&&s.pose==='sit';
}

/* ---------- night jobs at the workbench ---------- */
// these take real time (you stand at the bench) instead of daylight, so the quiet nights have something to do
const NIGHT_JOBS=[
  {id:'clean',name:'CLEAN THE GUNS',desc:'Everyone shoots a bit tighter tomorrow.',cost:{scrap:1},secs:20,give:()=>{ G.buffs.clean=G.night+1; }},
  {id:'sharpen',name:'SHARPEN BLADES',desc:'Melee hits harder tomorrow.',cost:{},secs:15,give:()=>{ G.buffs.sharp=G.night+1; }},
  {id:'patch',name:'MAKE A PATCH KIT',desc:'Two bandages from rags and tape.',cost:{scrap:1},secs:18,give:()=>gearOut(mkItem('bandage',2))},
  {id:'boards',name:'CUT BOARDS FOR THE LINE',desc:'Every barricade section gets patched up.',cost:{scrap:3},secs:25,give:()=>{ for(const g of segs){ g.hp=Math.min(g.max,g.hp+g.max*0.3); if(!g.alive&&g.hp>g.max*0.25) setSegAlive(g,true); } }},
  {id:'molly',name:'FILL BOTTLES',desc:'A Molotov, the slow way.',cost:{fuel:1},secs:20,give:()=>{ THR.molotov++; }},
  {id:'letter',name:'WRITE A LETTER HOME',desc:'Nobody\'s getting it. Helps anyway.',cost:{},secs:25,give:()=>{ const s=squad[me]; s.stress=0; radio(nameOf(s)+' folds the letter and puts it in a jacket pocket.'); }},
];
const JOB={cur:null,t:0};
function startJob(id){
  const j=NIGHT_JOBS.find(x=>x.id===id); if(!j||!affordable(j.cost)) return;
  for(const k in j.cost) SUP[k]-=j.cost[k];
  JOB.cur=j; JOB.t=0; const s=squad[me]; const sp=SPOTS.find(p=>p.kind==='bench'); if(sp){ releaseSpot(s); sp.by=s; s.spot=sp; s.pose='work'; s.x=sp.x; s.z=sp.z; s.ang=sp.ang; }
  if(wsOpen) wsToggle();
}
function updateJob(dt,moving){
  if(!JOB.cur) return;
  const s=squad[me];
  if(moving||!present(s)){ radioLine('Left it half done.'); JOB.cur=null; releaseSpot(s); return; }
  JOB.t+=dt; if(Math.random()<dt*3&&AC) SFX.click(0,0.15);
  if(JOB.t>=JOB.cur.secs){ JOB.cur.give(); bannerShow(JOB.cur.name,'Done.',1.4); giveXP(s,5,'build'); JOB.cur=null; releaseSpot(s); }
}

/* ---------- fixing up the shop ---------- */
const SHOP_UPS=[
  {id:'lights',name:'STRING LIGHTS',desc:'Warm bulbs over the block and in the shop.',cost:{scrap:6},hours:1},
  {id:'den',name:'FIX UP THE SHOP',desc:'A couch, a rug, a card table. Nerves settle faster at the base.',cost:{scrap:10},hours:2},
  {id:'gen',name:'RIG A GENERATOR',desc:'Power for the radio. Music on quiet nights.',cost:{scrap:12,fuel:3},hours:2},
  {id:'garden',name:'ROOFTOP GARDEN',desc:'Planters on the roof. A little food every morning.',cost:{scrap:12,water:2},hours:3},
  {id:'lookout',name:'LOOKOUT',desc:'A chair and a lamp on the roof. Whoever\'s on watch sits up there.',cost:{scrap:10},hours:2},
];
const upMeshes={};
function buildShopUp(id){
  if(upMeshes[id]) return; const g=new THREE.Group(); upMeshes[id]=g; scene.add(g);
  const B=LANDMARK.base, P=(w,h,d,col,x,y,z,basic)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),basic?new THREE.MeshBasicMaterial({color:col}):phong({color:col})); m.position.set(x,y,z); m.castShadow=!basic; g.add(m); return m; };
  if(id==='lights'){
    const runs=[[[-12.6,3.2,-12],[-12.6,3.2,4]],[[12.6,3.2,-12],[12.6,3.2,4]],[[-12.6,3.4,-6],[12.6,3.4,-6]],[[-31,3.1,8],[-15,3.1,20]]];
    const gIn=new THREE.Group(); scene.add(gIn); upMeshes.lightsIn=gIn;
    for(const [a,b] of runs){ const tgt=a[0]<-14?gIn:g; const n=Math.round(Math.hypot(b[0]-a[0],b[2]-a[2])/1.1);
      const lg=new THREE.BufferGeometry(); const pts=[]; for(let k=0;k<=n;k++){ const t=k/n; pts.push(lerp(a[0],b[0],t),a[1]-Math.sin(t*Math.PI*3)*0.25,lerp(a[2],b[2],t)); }
      lg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); tgt.add(new THREE.Line(lg,new THREE.LineBasicMaterial({color:0x2a2620})));
      for(let k=0;k<=n;k++){ const b2=P(0.1,0.12,0.1,k%3===0?0xffc070:k%3===1?0xffe0a0:0xff9a60,pts[k*3],pts[k*3+1]-0.08,pts[k*3+2],true); if(tgt!==g){ g.remove(b2); tgt.add(b2); } } }
    onCharLayer(g); onCharLayer(gIn);
  }
  if(id==='den'){ const f=MAP.furn.find(q=>q&&q.radio&&q.b===B.id); const cx=f?(f.x0+f.x1)/2:-28, cz=f?(f.z0+f.z1)/2:16;
    P(2.4,0.02,1.8,0x6a2e26,cx+0.4,0.06,cz-1.6); P(2.2,0.02,1.6,0x8a5a32,cx+0.4,0.07,cz-1.6);
    P(1.9,0.42,0.8,0x3e4a5a,cx+0.4,0.21,cz-3); P(1.9,0.5,0.22,0x34404e,cx+0.4,0.62,cz-3.35); for(const sx of [-1,1]) P(0.22,0.6,0.8,0x34404e,cx+0.4+sx*0.95,0.3,cz-3);
    P(0.8,0.05,0.8,0x5a4632,cx+0.4,0.72,cz-1.5); P(0.06,0.7,0.06,0x3a2e22,cx+0.4,0.35,cz-1.5); for(let k=0;k<5;k++) P(0.08,0.005,0.12,0xe8e0d0,cx+0.2+k*0.1,0.755,cz-1.5+Math.sin(k)*0.15);
    onCharLayer(g); }
  if(id==='gen'){ P(0.9,0.6,0.6,0x9a2a1e,-12.6,0.3,9,false); P(0.5,0.12,0.5,0x2a2a2a,-12.6,0.66,9,false); onCharLayer(g); }
  if(id==='garden'){ const y=2*LH; for(let k=0;k<4;k++){ P(2.2,0.4,0.9,0x5a4632,-30+k*0.0,y+0.2,8.5+k*1.6); P(2.0,0.08,0.75,0x3a2e1e,-30,y+0.42,8.5+k*1.6); for(let j=0;j<6;j++) P(0.12,0.25+Math.random()*0.15,0.12,0x4a7a32,-30.8+j*0.32,y+0.55,8.5+k*1.6+rand(-.2,.2)); }
    onCharLayer(g); }
  if(id==='lookout'){ const y=2*LH; P(0.5,0.45,0.5,0x5a4a34,-14.2,y+0.22,7.5); P(0.06,1.6,0.06,0x2a2a2a,-14,y+0.8,6.8); P(0.3,0.2,0.3,0xfff0c0,-14,y+1.65,6.6,true);
    if(!SPOTS.some(p=>p.kind==='lookout')) SPOTS.push({kind:'lookout',x:-14.2,z:7.5,L:2,ang:Math.PI/2}); onCharLayer(g); }
}
for(const u of SHOP_UPS) UPGRADES.push(Object.assign({},u,{apply:()=>buildShopUp(u.id)}));
function jobsHTML(day){
  if(day) return '';
  const quiet=offDuty();
  return '<div class="sub">NIGHT JOBS</div>'+NIGHT_JOBS.map(j=>`<div class="wr"><div><b>${j.name}</b><small>${j.desc}</small></div><em>${Object.keys(j.cost).length?costStr(j.cost)+' · ':''}${j.secs}s</em><button data-j="${j.id}" ${quiet&&affordable(j.cost)&&!JOB.cur?'':'disabled'}>START</button></div>`).join('')+(quiet?'':'<div class="note">Not with them this close.</div>');
}
function applyShopUps(){ for(const u of SHOP_UPS) if(BASEUP[u.id]) buildShopUp(u.id); }
function updateComfy(dt){
  updateOffDuty(dt);
  if(upMeshes.lights){ const night=G.phase!=='day'; for(const c of upMeshes.lights.children) if(c.isMesh) c.visible=night; }
  // anything on the roof or up near the ceiling hides when the shop is cut open
  const cut=getCut(LANDMARK.base.id);
  if(upMeshes.lightsIn) upMeshes.lightsIn.visible=cut>3.2;
  if(upMeshes.garden) upMeshes.garden.visible=cut>2*LH+0.5;
  if(upMeshes.lookout) upMeshes.lookout.visible=cut>2*LH+0.5;
  for(const s of squad) if(s.mealT>0) s.mealT-=dt;
}
// the radio plays when there's power, it's quiet, and you're near it
function radioMusicOn(){ const p=squad[me]; return BASEUP.gen&&offDuty()&&p.L===0&&atBase(p)&&indoors(p.L,p.x,p.z); }
