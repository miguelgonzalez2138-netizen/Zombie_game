'use strict';
// Fog Line — Fortifying the block: build mode (sandbags, spike strips, bear traps, tripwire flares, MG nests,
// boarding windows and doors, cutting fences), what the dead do to it, manning the MG, and the workshop
// (crafting and base upgrades, paid for in scrap, fuel and daylight).
// Classic script: shares globals with the other files, load order matters (see index.html).

const HOUR=40;              // real seconds per in-game hour of daylight
// built cells (BLK.BUILT): the squad can't walk through them (the player vaults them); the dead path into them and tear them down
const STRUCT={
  sand:  {name:'SANDBAGS',w:2,d:1,cost:4,hours:0.5,hp:320,block:true},
  spikes:{name:'SPIKE STRIP',w:3,d:1,cost:3,hours:0.5,hp:240,trap:'spikes'},
  bear:  {name:'BEAR TRAP',w:1,d:1,cost:2,hours:0.25,trap:'bear'},
  flare: {name:'TRIPWIRE FLARE',w:2,d:1,cost:2,hours:0.25,trap:'flare'},
  mg:    {name:'MG NEST',w:3,d:1,cost:18,hours:2,hp:450,block:true,mg:true,needs:'tools'},
  board: {name:'BOARD UP',edge:true,cost:2,hours:0.25},
  cut:   {name:'CUT FENCE',edge:true,cost:0,hours:0.25,tool:'cutters'},
};
const BUILD_ORDER=['sand','spikes','bear','flare','mg','board','cut'];
const strs=[];
const trapGrid=[]; for(let L=0;L<NL;L++) trapGrid.push(new Int16Array(GN).fill(-1));
const builtGrid=[]; for(let L=0;L<NL;L++) builtGrid.push(new Int16Array(GN).fill(-1));
function costOf(T){ return Math.ceil(T.cost*(BASEUP.tools?0.75:1)); }

/* ---------- meshes ---------- */
const matNail=phong({color:0x6a6c70}), matTrap=phong({color:0x3a3632}), matPost=phong({color:0x4a3a2a}), matWire=new THREE.LineBasicMaterial({color:0x9a9a90});
function structMesh(S){
  const g=new THREE.Group(), T=STRUCT[S.type], B=(w,h,d,m,x,y,z)=>gbox(g,w,h,d,m,x,y,z);
  const W=T.w, D=T.d;
  if(S.type==='sand'||S.type==='mg'){
    const n=Math.round(W/0.66);
    for(let r=0;r<3;r++) for(let i=0;i<n-(r%2);i++){ const b=B(0.62,0.3,0.48,matSand,-W/2+0.33+i*0.66+(r%2)*0.33,0.15+r*0.29,rand(-.04,.04)); b.rotation.y=rand(-.08,.08); }
    if(S.type==='mg'){ // tripod and the gun, behind the bags
      const mg=new THREE.Group(); mg.position.set(0,1.05,0.5); mg.rotation.y=Math.PI; g.add(mg); S.gun=mg;
      gbox(mg,0.1,0.13,0.9,matGun,0,0,0.2); gbox(mg,0.05,0.05,0.7,matGun,0,0.02,0.9); gbox(mg,0.14,0.14,0.14,matOD,-0.12,-0.04,0.1); gbox(mg,0.06,0.1,0.25,matGun,0,-0.02,-0.3);
      for(const a of [0,2.1,4.2]){ const l=gbox(g,0.04,1.0,0.04,matGun,Math.sin(a)*0.25,0.5,0.5+Math.cos(a)*0.25); l.rotation.set(Math.cos(a)*0.25,0,-Math.sin(a)*0.25); }
    }
  } else if(S.type==='spikes'){
    B(W-0.1,0.06,0.5,matPost,0,0.03,0);
    for(let i=0;i<W*4;i++){ const n=B(0.03,0.2,0.03,matNail,-W/2+0.12+i*0.25,0.12,rand(-.18,.18)); n.rotation.set(rand(-.5,.5),0,rand(-.5,.5)); }
  } else if(S.type==='bear'){
    const r=new THREE.Mesh(new THREE.TorusGeometry(0.22,0.03,4,10),matTrap); r.rotation.x=Math.PI/2; r.position.y=0.05; g.add(r); S.jaw=r;
    B(0.1,0.04,0.1,matTrap,0,0.03,0);
  } else if(S.type==='flare'){
    B(0.06,0.5,0.06,matPost,-W/2+0.1,0.25,0); B(0.06,0.5,0.06,matPost,W/2-0.1,0.25,0);
    const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute([-W/2+0.1,0.3,0,W/2-0.1,0.3,0],3)); g.add(new THREE.Line(lg,matWire));
    const c=B(0.08,0.2,0.08,phong({color:0xa02a1a}),W/2-0.1,0.6,0); S.can=c;
  }
  g.position.set(S.cx,S.L*LH,S.cz); g.rotation.y=S.yaw!==undefined?S.yaw:S.rot?Math.PI/2:0;
  g.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; } });
  onCharLayer(g); scene.add(g); S.m=g;
}
// footprint cells for a structure of type at (cx,cz) centre, rotated or not
function footprint(type,cx,cz,rot){
  const T=STRUCT[type], w=rot?T.d:T.w, d=rot?T.w:T.d, x0=Math.round(cx-w/2), z0=Math.round(cz-d/2), out=[];
  for(let dz=0;dz<d;dz++) for(let dx=0;dx<w;dx++) out.push([x0+dx,z0+dz]);
  return {cells:out,x0,z0,w,d,cx:x0+w/2,cz:z0+d/2};
}
function canPlace(type,L,fp,s){
  for(const [x,z] of fp.cells){
    if(!inMap(x,z)) return false; const c=CI(x,z);
    if(!MAP.floor[L][c]||MAP.block[L][c]!==BLK.FREE||MAP.fl[L][c]||trapGrid[L][c]>=0) return false;
  }
  // no walls cut through the middle of it
  for(const [x,z] of fp.cells){ const c=CI(x,z);
    if(fp.cells.some(([a,b])=>a===x+1&&b===z)&&MAP.eE[L][c]&&ED.t[MAP.eE[L][c]]!==ET.NONE) return false;
    if(fp.cells.some(([a,b])=>a===x&&b===z+1)&&MAP.eS[L][c]&&ED.t[MAP.eS[L][c]]!==ET.NONE) return false; }
  // not on top of anyone
  const T=STRUCT[type];
  if(T.block){ for(const q of squad) if(q.alive&&q.L===L&&q.x>fp.x0-0.4&&q.x<fp.x0+fp.w+0.4&&q.z>fp.z0-0.4&&q.z<fp.z0+fp.d+0.4) return false;
    let hit=false; eachNear(fp.cx,fp.cz,3,j=>{ if(zl[j]===L&&zx[j]>fp.x0-0.3&&zx[j]<fp.x0+fp.w+0.3&&zz[j]>fp.z0-0.3&&zz[j]<fp.z0+fp.d+0.3) hit=true; }); if(hit) return false; }
  // the MG needs room behind it for the gunner
  if(T.mg){ const gp=mgSpot({cx:fp.cx,cz:fp.cz,rot:!!(fp.w<fp.d),L}); if(!cellWalk(L,Math.floor(gp.x),Math.floor(gp.z))) return false; }
  return true;
}
function addStruct(type,L,fp,rot){
  const T=STRUCT[type];
  const S={type,L,cx:fp.cx,cz:fp.cz,rot,cells:fp.cells.map(([x,z])=>CI(x,z)),hp:T.hp||1,max:T.hp||1,armed:true,rearm:0,belt:0,t:0};
  if(T.mg){ const b=mgBack(S); S.yaw=Math.atan2(b.x,b.z); S.ang=S.yaw+Math.PI; }
  structMesh(S); const id=strs.length; strs.push(S); S.id=id;
  for(const c of S.cells){ if(T.block){ MAP.block[L][c]=BLK.BUILT; builtGrid[L][c]=id; } else trapGrid[L][c]=id; }
  minimapDirty=true;
  return S;
}
function removeStruct(S,broken){
  const T=STRUCT[S.type];
  for(const c of S.cells){ if(T.block){ if(MAP.block[S.L][c]===BLK.BUILT) MAP.block[S.L][c]=BLK.FREE; builtGrid[S.L][c]=-1; } else trapGrid[S.L][c]=-1; }
  scene.remove(S.m); S.dead=true;
  if(broken){ chips(S.cx,S.L*LH+0.5,S.cz,14,0,0,0x8a7a58); emit(false,S.cx,S.L*LH+0.5,S.cz,0,0.6,0,1.4,0.6,2.4,0x8a8680,0.5); }
  for(const q of squad) if(q.mounted===S) dismount(q);
  minimapDirty=true;
}
// where the gunner stands: one metre behind the bags
function mgBack(S){ return S.rot?(S.cx<0?{x:1,z:0}:{x:-1,z:0}):{x:0,z:1}; }
function mgSpot(S){ const back=mgBack(S); return {x:S.cx+back.x*1.1,z:S.cz+back.z*1.1}; }

/* ---------- build mode ---------- */
const BUILD={on:false,sel:0,rot:false,ghost:null,ghostType:'',ok:false,fp:null,edge:0};
const matGhostOK=new THREE.MeshBasicMaterial({color:0x8ad06a,transparent:true,opacity:0.45,depthWrite:false});
const matGhostNo=new THREE.MeshBasicMaterial({color:0xd0503e,transparent:true,opacity:0.45,depthWrite:false});
const buildBar=document.getElementById('buildbar');
function buildToggle(){
  BUILD.on=!BUILD.on; throwAiming=false;
  if(!BUILD.on&&BUILD.ghost){ scene.remove(BUILD.ghost); BUILD.ghost=null; BUILD.ghostType=''; }
  buildBar.hidden=!BUILD.on; renderBuildBar();
}
function renderBuildBar(){
  if(!BUILD.on) return;
  buildBar.innerHTML=BUILD_ORDER.map((k,i)=>{ const T=STRUCT[k], locked=T.needs&&!BASEUP[T.needs];
    return `<span class="${i===BUILD.sel?'on':''}${locked?' lock':''}"><kbd>${i+1}</kbd>${T.name}<em>${locked?'NEEDS TOOLS':T.tool?'CUTTERS':costOf(T)+' SCRAP'}</em></span>`; }).join('')
    +`<div class="bh">Click to build · R rotate · right-click a structure to take it down · K or Esc to stop · Scrap: <b>${SUP.scrap}</b>${G.phase==='day'?' · building costs daylight':' · building at night is loud'}</div>`;
}
function buildSelect(i){ if(i>=0&&i<BUILD_ORDER.length){ BUILD.sel=i; renderBuildBar(); } }
function ghostFor(type){
  if(BUILD.ghost) scene.remove(BUILD.ghost);
  const T=STRUCT[type]; const g=new THREE.Group();
  if(T.edge){ g.add(new THREE.Mesh(new THREE.BoxGeometry(1,2.2,0.2).translate(0,1.1,0),matGhostOK)); }
  else g.add(new THREE.Mesh(new THREE.BoxGeometry(T.w,T.block?0.9:0.15,T.d).translate(0,T.block?0.45:0.08,0),matGhostOK));
  onFxLayer(g); scene.add(g); BUILD.ghost=g; BUILD.ghostType=type;
}
// the edge (window, door, fence) nearest the cursor
function edgeNear(L,x,z,r,pred){
  let best=0, bd=r;
  for(let cz=Math.floor(z)-2;cz<=Math.floor(z)+2;cz++) for(let cx=Math.floor(x)-2;cx<=Math.floor(x)+2;cx++){ if(!inMap(cx,cz)) continue; const c=CI(cx,cz);
    for(const e of [MAP.eE[L][c],MAP.eS[L][c]]){ if(!e||!pred(ED.t[e])) continue; const p=edgeMid(e), d=Math.hypot(p.x-x,p.z-z); if(d<bd){ bd=d; best=e; } } }
  return best;
}
const BOARDABLE=t=>t===ET.WIN||t===ET.WINB||t===ET.DOOR||t===ET.DOPEN||t===ET.DGONE;
function updateBuild(){
  if(!BUILD.on) return;
  const s=squad[me], type=BUILD_ORDER[BUILD.sel], T=STRUCT[type];
  if(BUILD.ghostType!==type) ghostFor(type);
  const p=aimPoint(s,0), g=BUILD.ghost, L=s.L;
  const far=Math.hypot(p.x-s.x,p.z-s.z)>9;
  if(T.edge){
    const e=edgeNear(L,p.x,p.z,1.4,type==='board'?BOARDABLE:(t=>t===ET.FENCE)); BUILD.edge=e;
    if(e){ const m=edgeMid(e); g.position.set(m.x,L*LH,m.z); g.rotation.y=ED.d[e]===0?Math.PI/2:0; g.visible=true; }
    else { g.position.set(p.x,L*LH,p.z); g.visible=true; }
    BUILD.ok=!!e&&!far&&(T.tool?countKey(s.pack,T.tool)>0:SUP.scrap>=costOf(T));
  } else {
    const rot=BUILD.rot, fp=footprint(type,p.x,p.z,rot); BUILD.fp=fp;
    g.position.set(fp.cx,L*LH,fp.cz); g.rotation.y=rot?Math.PI/2:0; g.visible=true;
    BUILD.ok=!far&&!(T.needs&&!BASEUP[T.needs])&&SUP.scrap>=costOf(T)&&canPlace(type,L,fp,s);
  }
  g.children[0].material=BUILD.ok?matGhostOK:matGhostNo;
}
function spendTime(hours){
  if(G.phase==='day'){ G.t=Math.max(1,G.t-hours*HOUR); }
  else makeNoise(squad[me].x,squad[me].z,22,squad[me].L);
}
function buildClick(){
  const s=squad[me], type=BUILD_ORDER[BUILD.sel], T=STRUCT[type];
  if(!BUILD.ok){ if(T.needs&&!BASEUP[T.needs]) radioLine('Need the workshop tools for that.'); else if(T.tool&&!countKey(s.pack,T.tool)) radioLine('Need bolt cutters in the pack.'); else if(SUP.scrap<costOf(T)&&!T.tool) radioLine('Not enough scrap.'); return; }
  if(T.edge){
    const e=BUILD.edge;
    if(type==='board'){ setEdgeType(e,ET.BOARD); SUP.scrap-=costOf(T); }
    else setEdgeType(e,ET.FCUT);
    const m=edgeMid(e); chips(m.x,m.L*LH+1,m.z,6,0,0,0x6a5a44);
  } else { addStruct(type,s.L,BUILD.fp,BUILD.rot); SUP.scrap-=costOf(T); }
  giveXP(s,6,'build'); STATS.built++;
  if(AC){ sThud(0.35); setTimeout(()=>sThud(0.3),180); }
  spendTime(T.hours);
  minimapDirty=true; renderBuildBar();
}
function buildRightClick(){
  const s=squad[me], p=aimPoint(s,0), c=inMap(Math.floor(p.x),Math.floor(p.z))?CI(Math.floor(p.x),Math.floor(p.z)):-1; if(c<0) return;
  const id=builtGrid[s.L][c]>=0?builtGrid[s.L][c]:trapGrid[s.L][c]; if(id<0) return;
  const S=strs[id]; if(Math.hypot(S.cx-s.x,S.cz-s.z)>9) return;
  SUP.scrap+=Math.floor(costOf(STRUCT[S.type])*0.5*(S.hp/S.max)); removeStruct(S,false); spendTime(0.25); renderBuildBar();
}

/* ---------- the dead against it ---------- */
// called when a zombie at (x,z) was blocked moving toward (dx,dz): tear at whatever built thing is in the way
function bashBuilt(i,L,x,z,dx,dz,dt,mul){
  const cx=Math.floor(x+dx*0.6), cz=Math.floor(z+dz*0.6); if(!inMap(cx,cz)) return false;
  const id=builtGrid[L][CI(cx,cz)]; if(id<0) return false;
  const S=strs[id]; S.hp-=(zbody[i]===1?12:7)*mul*dt;
  if(Math.random()<dt*2) chips(x+dx*0.5,L*LH+0.6,z+dz*0.5,2,-dx,-dz,0x6b6146);
  if(S.hp<=0) removeStruct(S,true);
  else if(Math.random()<dt*0.8){ const ps=squad[me], d=Math.hypot(x-ps.x,z-ps.z); if(d<30) sThud(0.25/(1+d*0.12)); }
  return true;
}
// spikes chew them up, bear traps hold them, tripwires light a flare
function stepTraps(i,dt){
  const L=zl[i], cx=Math.floor(zx[i]), cz=Math.floor(zz[i]); if(!inMap(cx,cz)) return 1;
  const id=trapGrid[L][CI(cx,cz)]; if(id<0) return 1;
  const S=strs[id];
  if(S.type==='spikes'){ zhp[i]-=28*dt; zfl[i]=Math.max(zfl[i],0.3); S.hp-=5*dt; if(Math.random()<dt*3) bleed(zx[i],0.3,zz[i],0,0,2,0.6,zyv[i]);
    if(S.hp<=0) removeStruct(S,true); if(zhp[i]<=0){ killZ(i,true); return 0; } return 0.45; }
  if(S.type==='bear'&&S.armed){ S.armed=false; S.rearm=25; zstun[i]=Math.max(zstun[i],3.5); damageZ(i,55,zx[i],zz[i]-0.01,0); if(S.jaw) S.jaw.scale.set(0.6,0.6,1.6);
    const ps=squad[me], d=Math.hypot(zx[i]-ps.x,zz[i]-ps.z); if(AC&&d<35) SFX.clang(clamp((zx[i]-ps.x)/20,-1,1)); return 0; }
  if(S.type==='flare'&&S.armed){ S.armed=false; S.rearm=0; lightTripFlare(S); return 1; }
  return 1;
}
const tripLights=[0,1].map(()=>{ const l=new THREE.PointLight(0xff2a1e,0,16,2); l.layers.enableAll(); scene.add(l); return {l,S:null,t:0}; });
let tripIdx=0;
function lightTripFlare(S){
  const T=tripLights[tripIdx]; tripIdx=(tripIdx+1)%tripLights.length; T.S=S; T.t=40;
  T.l.position.set(S.cx,S.L*LH+0.6,S.cz); makeNoise(S.cx,S.cz,8,S.L);
  radioLine('Tripwire flare on '+(whereIs({L:S.L,x:S.cx,z:S.cz})||'the block')+'.');
  if(S.can) S.can.material.color.setHex(0xff5030);
}
function updateStructs(dt){
  for(const S of strs){ if(S.dead) continue;
    if(!S.armed&&S.type==='bear'){ S.rearm-=dt; if(S.rearm<=0){ S.armed=true; if(S.jaw) S.jaw.scale.set(1,1,1); } }
    if(S.type==='sand'||S.type==='mg'){ const k=S.hp/S.max; S.m.scale.y=0.55+0.45*k; }
  }
  for(const T of tripLights){ if(T.t<=0){ T.l.intensity=0; continue; } T.t-=dt; const S=T.S;
    T.l.intensity=1.6*(0.75+Math.random()*0.35)*Math.min(1,T.t/3);
    if(Math.random()<dt*16) emit(true,S.cx,S.L*LH+0.6,S.cz,rand(-.3,.3),rand(.4,1),rand(-.3,.3),rand(.15,.3),.25,.08,0xff5038,1);
    if(Math.random()<dt*2.5) emit(false,S.cx,S.L*LH+0.7,S.cz,0,rand(.5,.9),0,rand(3,5),.3,2.2,0x8a6a68,0.22);
    if(T.t<=0&&!S.dead){ S.armed=true; if(S.can) S.can.material.color.setHex(0xa02a1a); } }
}

/* ---------- manning the MG ---------- */
function nearestNest(s){ let best=null, bd=1.4; for(const S of strs){ if(S.dead||S.type!=='mg'||S.L!==s.L) continue; const g=mgSpot(S), d=Math.hypot(g.x-s.x,g.z-s.z); if(d<bd){ bd=d; best=S; } } return best; }
function mount(s,S){
  if(S.manned) return; cancelReload(s);
  const g=mgSpot(S); s.x=g.x; s.z=g.z; s.vx=s.vz=0;
  s.mounted=S; S.manned=s; s.prevSlot=s.slot; s.wpn='m240'; s.mags.m240=S.belt; s.modes.m240=0; s.sprint=false;
  const u=s.mesh.userData; if(u.gun) u.gun.visible=false;
  if(s.i===me) radioLine('On the gun. '+S.belt+' in the belt.');
}
function dismount(s){
  const S=s.mounted; if(!S) return;
  S.belt=s.mags.m240||0; S.manned=null; s.mounted=null; cancelReload(s);
  const u=s.mesh.userData; if(u.gun) u.gun.visible=true;
  s.wpn=s.inv[s.prevSlot]||'fists'; s.slot=s.prevSlot; ensureArmed(s);
}
function stepMounted(s,dt){
  const S=s.mounted, g=mgSpot(S); s.x=g.x; s.z=g.z; s.vx=s.vz=0;
  let da=s.ang-S.ang; while(da>Math.PI) da-=Math.PI*2; while(da<-Math.PI) da+=Math.PI*2;
  da=clamp(da,-1.25,1.25); s.ang=S.ang+da;
  if(S.gun) S.gun.rotation.y=s.ang-S.yaw;
}

/* ---------- the workshop ---------- */
const RECIPES=[
  {id:'molotov',name:'MOLOTOV',cost:{scrap:1,fuel:1},hours:0.5,give:()=>{THR.molotov++;}},
  {id:'frag',name:'PIPE BOMB',cost:{scrap:3,fuel:1},hours:1,give:()=>{THR.frag++;}},
  {id:'decoy',name:'NOISE MAKER',cost:{scrap:2},hours:0.5,give:()=>{THR.decoy++;}},
  {id:'bandage',name:'BANDAGES ×2',cost:{scrap:1},hours:0.5,give:()=>gearOut(mkItem('bandage',2))},
  {id:'grip',name:'FOREGRIP',cost:{scrap:3},hours:1,give:()=>gearOut(mkItem('grip'))},
  {id:'ext',name:'EXTENDED MAG',cost:{scrap:4},hours:1.5,needs:'tools',give:()=>gearOut(mkItem('ext'))},
  {id:'supp',name:'SUPPRESSOR',cost:{scrap:5,fuel:1},hours:2,needs:'tools',give:()=>gearOut(mkItem('supp'))},
];
const UPGRADES=[
  {id:'line',name:'REINFORCE THE LINE',desc:'The barricade takes 60% more punishment.',cost:{scrap:20},hours:3,apply:()=>{ for(const g of segs){ g.max=Math.round(g.max*1.6); g.hp=g.max; if(!g.alive) setSegAlive(g,true); } }},
  {id:'tools',name:'WORKSHOP TOOLS',desc:'Unlocks the MG nest, extended mags and suppressors. Building costs a quarter less.',cost:{scrap:15,fuel:2},hours:3,apply:()=>{}},
  {id:'barrels',name:'RAIN BARRELS',desc:'Two more water every morning.',cost:{scrap:12},hours:2,apply:()=>{}},
  {id:'stove',name:'FIX THE STOVE',desc:'Hot meals patch everyone up a little.',cost:{scrap:8},hours:1,apply:()=>{}},
];
function gearOut(it){ if(!autoPlace(stash,it)&&!autoPlace(squad[me].pack,it)) dropGround(it,squad[me].x,squad[me].z,squad[me].L); }
function affordable(cost){ for(const k in cost) if(SUP[k]<cost[k]) return false; return true; }
function costStr(cost){ return Object.keys(cost).map(k=>cost[k]+' '+k).join(' · '); }
const wsEl=document.getElementById('workshop');
let wsOpen=false;
function wsToggle(){ wsOpen=!wsOpen; wsEl.hidden=!wsOpen; if(wsOpen) renderWS(); }
function renderWS(){
  if(!wsOpen) return;
  const day=G.phase==='day';
  const hrs=Math.floor(G.t/HOUR), mins=Math.floor((G.t%HOUR)/HOUR*60);
  const row=(r,up)=>{ const done=up&&BASEUP[r.id], locked=r.needs&&!BASEUP[r.needs], can=!done&&!locked&&day&&affordable(r.cost)&&G.t>r.hours*HOUR;
    return `<div class="wr${done?' done':''}"><div><b>${r.name}</b>${r.desc?`<small>${r.desc}</small>`:''}</div><em>${done?'DONE':locked?'NEEDS TOOLS':costStr(r.cost)+' · '+r.hours+'H'}</em><button data-r="${r.id}" data-up="${up?1:0}" ${can?'':'disabled'}>${up?'BUILD':'MAKE'}</button></div>`; };
  wsEl.innerHTML=`<div class="wsbox"><div class="ttl">WORKBENCH · FERRETERIA MORALES</div>
    <div class="pools"><span>SCRAP <b>${SUP.scrap}</b></span><span>FUEL <b>${SUP.fuel}</b></span><span>FOOD <b>${SUP.food}</b></span><span>WATER <b>${SUP.water}</b></span><span>${day?`DAYLIGHT <b>${hrs}h ${String(mins).padStart(2,'0')}m</b>`:'<b class="bad">TOO DARK TO WORK</b>'}</span></div>
    <div class="sub">MAKE</div>${RECIPES.map(r=>row(r,false)).join('')}
    <div class="sub">UPGRADES</div>${UPGRADES.map(r=>row(r,true)).join('')}
    <div class="hint">Every job burns daylight. E or Esc to step away.</div></div>`;
  wsEl.querySelectorAll('button[data-r]').forEach(b=>b.onclick=()=>{
    const up=b.dataset.up==='1', r=(up?UPGRADES:RECIPES).find(x=>x.id===b.dataset.r);
    if(!affordable(r.cost)||G.phase!=='day') return;
    for(const k in r.cost) SUP[k]-=r.cost[k];
    if(up){ BASEUP[r.id]=true; r.apply(); } else r.give();
    giveXP(squad[me],up?15:5,'build'); STATS.crafted++;
    spendTime(r.hours); if(AC){ sThud(0.3); setTimeout(()=>SFX.clang(0),200); }
    bannerShow(r.name,'+'+r.hours+(r.hours===1?' HOUR':' HOURS'),1.4);
    renderWS();
  });
}
