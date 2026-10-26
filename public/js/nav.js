'use strict';
// Fog Line — moving through the map: collision against walls, doors, furniture and holes; stair traversal;
// line of sight and bullet rays through the grid; flow fields for zombies and the squad.

const WALKB=new Uint8Array(16), SIGHTB=new Uint8Array(16), SHOTB=new Uint8Array(16);
[ET.WALL,ET.IWALL,ET.WIN,ET.WINB,ET.DOOR,ET.BOARD,ET.FENCE,ET.RAIL].forEach(t=>WALKB[t]=1);
[ET.WALL,ET.IWALL,ET.DOOR,ET.BOARD].forEach(t=>{ SIGHTB[t]=1; SHOTB[t]=1; });
const EDGE_T=0.13;
const AG={SOLDIER:0,ZOMBIE:1,THING:2};

function cellWalk(L,cx,cz){
  if(!inMap(cx,cz)) return false; const c=CI(cx,cz);
  if(!MAP.floor[L][c]) return false; const b=MAP.block[L][c]; return b===BLK.FREE||b===BLK.LINE;
}
function edgeWalkable(e){ return !e||!WALKB[ED.t[e]]; }

// push circle (o.x,o.z,r) out of an axis-aligned box; true if it overlapped
function pushBox(o,r,x0,z0,x1,z1){
  const px=o.x<x0?x0:o.x>x1?x1:o.x, pz=o.z<z0?z0:o.z>z1?z1:o.z;
  let dx=o.x-px, dz=o.z-pz; const d2=dx*dx+dz*dz;
  if(d2>=r*r) return false;
  if(d2>1e-9){ const d=Math.sqrt(d2), k=(r-d)/d; o.x+=dx*k; o.z+=dz*k; return true; }
  // centre inside the box: shove out along the shallowest side
  const l=o.x-x0, rr=x1-o.x, u=o.z-z0, b=z1-o.z, m=Math.min(l,rr,u,b);
  if(m===l) o.x=x0-r; else if(m===rr) o.x=x1+r; else if(m===u) o.z=z0-r; else o.z=z1+r;
  return true;
}
// collide against the grid at level L. Soldiers open closed doors and gates they walk into.
// Returns the first breakable edge pressed against (for zombies to bash), or 0.
function collideGrid(o,r,L,ag){
  let hit=0;
  for(let pass=0;pass<2;pass++){
    const x0=Math.floor(o.x-r)-1, x1=Math.floor(o.x+r), z0=Math.floor(o.z-r)-1, z1=Math.floor(o.z+r);
    for(let cz=z0;cz<=z1;cz++) for(let cx=x0;cx<=x1;cx++){
      if(!inMap(cx,cz)){ pushBox(o,r,cx,cz,cx+1,cz+1); continue; }
      const c=CI(cx,cz);
      if(!cellWalk(L,cx,cz)) pushBox(o,r,cx,cz,cx+1,cz+1);
      let e=MAP.eE[L][c];
      if(e&&WALKB[ED.t[e]]&&pushBox(o,r,cx+1-EDGE_T,cz,cx+1+EDGE_T,cz+1)) hit=touchEdge(e,ag)||hit;
      e=MAP.eS[L][c];
      if(e&&WALKB[ED.t[e]]&&pushBox(o,r,cx,cz+1-EDGE_T,cx+1,cz+1+EDGE_T)) hit=touchEdge(e,ag)||hit;
    }
  }
  return hit;
}
function touchEdge(e,ag){
  const t=ED.t[e];
  if(ag===AG.SOLDIER&&t===ET.DOOR){ openDoor(e,false); return 0; }
  if(ag===AG.ZOMBIE&&(t===ET.DOOR||t===ET.WIN||t===ET.WINB||t===ET.BOARD||t===ET.FENCE)) return e;
  return 0;
}
// hooks the renderer fills in (world.js) so doors swing and glass vanishes
const EDGE_HOOKS={changed:(e)=>{}};
function setEdgeType(e,t){ if(ED.t[e]===t) return; ED.t[e]=t; if(t===ET.DOOR||t===ET.BOARD) ED.hp[e]=ED.max[e]=EHP[t]; EDGE_HOOKS.changed(e); }
function openDoor(e,loud){ if(ED.t[e]!==ET.DOOR) return; setEdgeType(e,ET.DOPEN); const p=edgeMid(e); if(typeof onDoorOpened==='function') onDoorOpened(e,p,loud); }
function edgeMid(e){ const x=ED.x[e], z=ED.z[e]; return ED.d[e]===0?{x:x+1,z:z+0.5,L:ED.L[e]}:{x:x+0.5,z:z+1,L:ED.L[e]}; }
// zombies (and explosions) wear edges down; returns true when it gives way
function damageEdge(e,amt){
  const t=ED.t[e]; if(!(t===ET.DOOR||t===ET.WIN||t===ET.BOARD||t===ET.FENCE||t===ET.IWALL)) return false;
  ED.hp[e]-=amt; if(typeof onEdgeHit==='function') onEdgeHit(e,amt);
  if(ED.hp[e]>0) return false;
  if(t===ET.DOOR) setEdgeType(e,ET.DGONE);
  else if(t===ET.WIN) setEdgeType(e,ET.WINB);
  else if(t===ET.BOARD) setEdgeType(e,(ED.k[e]===EK.WIN||ED.k[e]===EK.SHOPWIN)?ET.WINB:ET.DGONE);
  else if(t===ET.FENCE) setEdgeType(e,ET.FCUT);
  else if(t===ET.IWALL) setEdgeType(e,ET.NONE);
  if(typeof onEdgeBroken==='function') onEdgeBroken(e,t);
  return true;
}

/* ---------- stairs ---------- */
// o: {x,z,L,trav}. If o stands on a stair cell and moves toward the flight, start carrying it along.
function stairCheck(o,dx,dz){
  if(o.trav) return true;
  const cx=Math.floor(o.x), cz=Math.floor(o.z); if(!inMap(cx,cz)) return false;
  const f=MAP.fl[o.L][CI(cx,cz)]; if(!f) return false;
  const F=MAP.flights[Math.abs(f)-1], dir=f>0?1:-1, dl=Math.hypot(dx,dz); if(dl<1e-5) return false;
  if((dx*F.dx+dz*F.dz)*dir/dl<0.5) return false;
  // only when stepping across into the flight
  const ahead=dir>0?F.st:F.en, nx=Math.floor(o.x+F.dx*dir*0.55), nz=Math.floor(o.z+F.dz*dir*0.55);
  if(!ahead.some(([x,z])=>x===nx&&z===nz)) return false;
  o.trav={F,dir,t:0,x0:o.x,z0:o.z,x1:o.x+F.dx*dir*2,z1:o.z+F.dz*dir*2,L0:o.L,L1:o.L+dir};
  return true;
}
function travStep(o,dt,speed){
  const T=o.trav; T.t=Math.min(1,T.t+dt*speed/2.3);
  o.x=lerp(T.x0,T.x1,T.t); o.z=lerp(T.z0,T.z1,T.t);
  if(T.t>=1){ o.L=T.L1; o.trav=null; }
}
function agentY(o){ if(o.trav){ const T=o.trav; return lerp(T.L0*LH,T.L1*LH,T.t); } return o.L*LH; }
// move an agent: stairs first, then collide. Returns breakable edge it pressed against.
function moveAgent(o,dx,dz,r,ag){
  if(o.trav) return 0;
  if(stairCheck(o,dx,dz)) return 0;
  o.x+=dx; o.z+=dz;
  return collideGrid(o,r,o.L,ag);
}

/* ---------- rays ---------- */
// walk a ray across cell boundaries at level L. test(e,t) returns true to stop at an edge.
// Tall solid blocks always stop it. Returns {t,x,z,e,blocked}.
const RAYHIT={t:1,x:0,z:0,e:0,blocked:false};
function gridRay(L,x0,z0,x1,z1,test,cellTest){
  let cx=Math.floor(x0), cz=Math.floor(z0);
  const dx=x1-x0, dz=z1-z0, sx=dx>0?1:-1, sz=dz>0?1:-1;
  const tdx=dx!==0?Math.abs(1/dx):Infinity, tdz=dz!==0?Math.abs(1/dz):Infinity;
  let tmx=dx!==0?(dx>0?(cx+1-x0):(x0-cx))*tdx:Infinity, tmz=dz!==0?(dz>0?(cz+1-z0):(z0-cz))*tdz:Infinity;
  RAYHIT.blocked=false; RAYHIT.e=0;
  for(let i=0;i<600;i++){
    let t,nx=cx,nz=cz,e;
    if(tmx<tmz){ t=tmx; if(t>1) break; nx=cx+sx; tmx+=tdx; if(inMap(cx,cz)&&inMap(nx,cz)) e=MAP.eE[L][CI(sx>0?cx:nx,cz)]; }
    else { t=tmz; if(t>1) break; nz=cz+sz; tmz+=tdz; if(inMap(cx,cz)&&inMap(cx,nz)) e=MAP.eS[L][CI(cx,sz>0?cz:nz)]; }
    if(!inMap(nx,nz)){ return stopAt(t,x0,z0,dx,dz,0); }
    if(e&&test&&test(e,t)) return stopAt(t,x0,z0,dx,dz,e);
    const c=CI(nx,nz);
    if(MAP.block[0][c]===BLK.SOLID) return stopAt(t,x0,z0,dx,dz,0);
    if(cellTest&&cellTest(L,nx,nz,c)) return stopAt(t,x0,z0,dx,dz,0);
    cx=nx; cz=nz;
  }
  RAYHIT.t=1; RAYHIT.x=x1; RAYHIT.z=z1; return RAYHIT;
}
function stopAt(t,x0,z0,dx,dz,e){ RAYHIT.t=t; RAYHIT.x=x0+dx*t; RAYHIT.z=z0+dz*t; RAYHIT.e=e; RAYHIT.blocked=true; return RAYHIT; }
const sightTest=(e)=>SIGHTB[ED.t[e]]===1;
function los(L,x0,z0,x1,z1){ return !gridRay(L,x0,z0,x1,z1,sightTest).blocked; }
const walkTestE=(e)=>WALKB[ED.t[e]]===1;
const walkTestC=(L,x,z)=>!cellWalk(L,x,z);
function walkLine(L,x0,z0,x1,z1){ return !gridRay(L,x0,z0,x1,z1,walkTestE,walkTestC).blocked; }

/* ---------- flow fields ---------- */
// Dijkstra out from a target over a window of the map (all levels). Costs are x10 (straight 10, diagonal 14).
const MODE={SOLDIER:0,ZOMBIE:1};
function edgePen(e,mode){
  if(!e) return 0;
  switch(ED.t[e]){
    case ET.NONE: case ET.DOPEN: case ET.DGONE: case ET.FCUT: return 0;
    case ET.DOOR: return mode?90:4;
    case ET.WIN: return mode?70:-1;
    case ET.WINB: return mode?30:-1;
    case ET.BOARD: return mode?180:-1;
    case ET.FENCE: return mode?260:-1;
    default: return -1;
  }
}
function cellPen(L,c,mode){
  if(!MAP.floor[L][c]) return -1;
  const b=MAP.block[L][c];
  if(b===BLK.FREE) return 0;
  if(b===BLK.LINE) return mode?160:14;
  if(b===5) return mode?200:-1;
  return -1;
}
class FlowField{
  constructor(R){ this.R=R; this.W=2*R+1; this.N=this.W*this.W; this.d=new Uint16Array(this.N*NL); this.ox=0; this.oz=0; this.t=-1e9; this.key=''; this.mode=0; this.valid=false; }
  ix(L,cx,cz){ const u=cx-this.ox, v=cz-this.oz; if(u<0||v<0||u>=this.W||v>=this.W||L<0||L>=NL) return -1; return L*this.N+v*this.W+u; }
  at(L,x,z){ const i=this.ix(L,Math.floor(x),Math.floor(z)); return i<0?65535:this.d[i]; }
}
const _bk=[]; for(let i=0;i<4200;i++) _bk.push([]);
// edge penalties by type, per mode; -1 = impassable
const EPEN=[new Int16Array(16).fill(-1),new Int16Array(16).fill(-1)];
for(const m of [0,1]){ const t=EPEN[m]; t[ET.NONE]=0; t[ET.DOPEN]=0; t[ET.DGONE]=0; t[ET.FCUT]=0;
  t[ET.DOOR]=m?90:4; if(m){ t[ET.WIN]=70; t[ET.WINB]=30; t[ET.BOARD]=180; t[ET.FENCE]=260; } }
const OPEN_T=new Uint8Array(16); OPEN_T[ET.NONE]=1; OPEN_T[ET.DOPEN]=1; OPEN_T[ET.DGONE]=1; OPEN_T[ET.FCUT]=1;
const EDT=ED.t;
const linkFlag=[]; for(let L=0;L<NL;L++) linkFlag.push(new Uint8Array(GN));
for(const k of MAP.links.keys()){ const L=(k/GN)|0; linkFlag[L][k-L*GN]=1; }
// cell cost: -1 blocked, else extra cost (barricade cells are slow to get through)
function cpen(fl,bl,c,mode){ if(!fl[c]) return -1; const b=bl[c]; if(b===0) return 0; if(b===BLK.LINE) return mode?160:14; if(b===5) return mode?200:-1; return -1; }
const eo=(e)=>e===0||OPEN_T[EDT[e]]===1;
function buildField(F,srcs,mode,maxCost){
  const c0=srcs[0]; F.ox=c0[1]-F.R; F.oz=c0[2]-F.R; F.d.fill(65535); F.mode=mode; F.valid=true;
  maxCost=Math.min(maxCost||1600,4100);
  const EP=EPEN[mode], N=F.N, W=F.W, ox=F.ox, oz=F.oz, d=F.d;
  let hi=0;
  for(const [L,cx,cz] of srcs){ const i=F.ix(L,cx,cz); if(i<0) continue; d[i]=0; _bk[0].push(i); }
  const push=(j,nc)=>{ if(nc<d[j]&&nc<=maxCost){ d[j]=nc; _bk[nc].push(j); if(nc>hi) hi=nc; } };
  for(let cost=0;cost<=hi&&cost<=maxCost;cost++){
    const B=_bk[cost];
    while(B.length){
      const i=B.pop(); if(d[i]!==cost) continue;
      const L=(i/N)|0, r=i-L*N, v=(r/W)|0, u=r-v*W, cx=u+ox, cz=v+oz;
      if(cx<=GX0||cz<=GZ0||cx>=GX0+GW-1||cz>=GZ0+GH-1) continue;
      const c=(cz-GZ0)*GW+(cx-GX0), fl=MAP.floor[L], bl=MAP.block[L], eE=MAP.eE[L], eS=MAP.eS[L];
      let p, ep;
      // east, west, south, north
      if(u+1<W&&(p=cpen(fl,bl,c+1,mode))>=0&&(ep=eE[c]?EP[EDT[eE[c]]]:0)>=0) push(i+1,cost+10+p+ep);
      if(u>0&&(p=cpen(fl,bl,c-1,mode))>=0&&(ep=eE[c-1]?EP[EDT[eE[c-1]]]:0)>=0) push(i-1,cost+10+p+ep);
      if(v+1<W&&(p=cpen(fl,bl,c+GW,mode))>=0&&(ep=eS[c]?EP[EDT[eS[c]]]:0)>=0) push(i+W,cost+10+p+ep);
      if(v>0&&(p=cpen(fl,bl,c-GW,mode))>=0&&(ep=eS[c-GW]?EP[EDT[eS[c-GW]]]:0)>=0) push(i-W,cost+10+p+ep);
      // diagonals through open corners only
      const fe=cpen(fl,bl,c+1,mode)===0, fw=cpen(fl,bl,c-1,mode)===0, fs=cpen(fl,bl,c+GW,mode)===0, fn=cpen(fl,bl,c-GW,mode)===0;
      if(u+1<W&&v+1<W&&fe&&fs&&cpen(fl,bl,c+GW+1,mode)===0&&eo(eE[c])&&eo(eS[c])&&eo(eS[c+1])&&eo(eE[c+GW])) push(i+W+1,cost+14);
      if(u>0&&v+1<W&&fw&&fs&&cpen(fl,bl,c+GW-1,mode)===0&&eo(eE[c-1])&&eo(eS[c])&&eo(eS[c-1])&&eo(eE[c-1+GW])) push(i+W-1,cost+14);
      if(u+1<W&&v>0&&fe&&fn&&cpen(fl,bl,c-GW+1,mode)===0&&eo(eE[c])&&eo(eS[c-GW])&&eo(eS[c+1-GW])&&eo(eE[c-GW])) push(i-W+1,cost+14);
      if(u>0&&v>0&&fw&&fn&&cpen(fl,bl,c-GW-1,mode)===0&&eo(eE[c-1])&&eo(eS[c-GW])&&eo(eS[c-1-GW])&&eo(eE[c-1-GW])) push(i-W-1,cost+14);
      // stairs
      if(linkFlag[L][c]){ const lk=MAP.links.get(L*GN+c);
        for(const node of lk){ const L2=(node/GN)|0, c2=node-L2*GN, x2=(c2%GW)+GX0, z2=((c2/GW)|0)+GZ0; const j=F.ix(L2,x2,z2); if(j>=0) push(j,cost+30); } }
    }
  }
  for(let c=0;c<=Math.min(hi,4199);c++) _bk[c].length=0;
}
// best next step from (L,x,z): {x,z,L,e,link} toward lower cost, or null when off the field
const STEP={x:0,z:0,L:0,e:0,link:false,d:0};
function fieldStep(F,L,x,z){
  const cx=Math.floor(x), cz=Math.floor(z), i=F.ix(L,cx,cz); if(i<0) return null;
  if(cx<=GX0||cz<=GZ0||cx>=GX0+GW-1||cz>=GZ0+GH-1) return null;
  const d=F.d, here=d[i]; if(here===65535) return null;
  const W=F.W, u=cx-F.ox, v=cz-F.oz, c=(cz-GZ0)*GW+(cx-GX0), eE=MAP.eE[L], eS=MAP.eS[L], EP=EPEN[F.mode];
  let best=here, bj=-1, be=0;
  const tryN=(ok,j,e)=>{ if(!ok) return; const dj=d[j]; if(dj>=best) return; if(e&&EP[EDT[e]]<0) return; best=dj; bj=j; be=e; };
  tryN(u+1<W,i+1,eE[c]); tryN(u>0,i-1,eE[c-1]); tryN(v+1<W,i+W,eS[c]); tryN(v>0,i-W,eS[c-GW]);
  const fl=MAP.floor[L], bl=MAP.block[L];
  const free=(cc)=>fl[cc]&&(bl[cc]===0||bl[cc]===BLK.LINE);
  if(u+1<W&&v+1<W&&free(c+1)&&free(c+GW)&&eo(eE[c])&&eo(eS[c])) tryN(true,i+W+1,0);
  if(u>0&&v+1<W&&free(c-1)&&free(c+GW)&&eo(eE[c-1])&&eo(eS[c])) tryN(true,i+W-1,0);
  if(u+1<W&&v>0&&free(c+1)&&free(c-GW)&&eo(eE[c])&&eo(eS[c-GW])) tryN(true,i-W+1,0);
  if(u>0&&v>0&&free(c-1)&&free(c-GW)&&eo(eE[c-1])&&eo(eS[c-GW])) tryN(true,i-W-1,0);
  let bL=L, link=false, lx=0, lz=0;
  if(linkFlag[L][c]){ for(const node of MAP.links.get(L*GN+c)){ const L2=(node/GN)|0, c2=node-L2*GN, x2=(c2%GW)+GX0, z2=((c2/GW)|0)+GZ0; const j=F.ix(L2,x2,z2);
    if(j>=0&&d[j]<best){ best=d[j]; bj=-2; bL=L2; link=true; lx=x2; lz=z2; be=0; } } }
  if(best===here||bj===-1) return null;
  if(link){ STEP.x=lx+0.5; STEP.z=lz+0.5; }
  else { const r=bj%F.N, vv=(r/W)|0, uu=r-vv*W; STEP.x=uu+F.ox+0.5; STEP.z=vv+F.oz+0.5; }
  STEP.L=bL; STEP.link=link; STEP.d=best; STEP.e=be&&!OPEN_T[EDT[be]]?be:0;
  return STEP;
}
