'use strict';
// Fog Line — the neighborhood as data: a fixed 1m tile map of Pilsen blocks, buildings, rooms, doors,
// windows, stairs, fences and yards. No rendering here (see world.js) and no movement (see nav.js).
// The map uses a fixed seed so the block is the same every run.

const LH=3.5;                 // floor-to-floor height
const NL=5;                   // levels 0..4 (4 = roof of a three-flat)
const GX0=-200, GZ0=-170, GW=400, GH=320, GN=GW*GH;
const CI=(x,z)=>(z-GZ0)*GW+(x-GX0);              // world integer cell -> index
const inMap=(x,z)=>x>=GX0&&z>=GZ0&&x<GX0+GW&&z<GZ0+GH;
const cellX=wx=>Math.floor(wx), cellZ=wz=>Math.floor(wz);

function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const MR=mulberry(1918);
const mr=(a,b)=>a+MR()*(b-a), mri=(a,b)=>Math.floor(a+MR()*(b-a+1)), mpick=a=>a[Math.floor(MR()*a.length)], mch=p=>MR()<p;

const SURF={ASPHALT:0,CONCRETE:1,GRASS:2,WOOD:3,TILE:4,GRAVEL:5,CARPET:6,METAL:7,DIRT:8,ALLEY:9,ROOF:10};
const BLK={FREE:0,SOLID:1,FURN:2,PROP:3,LINE:4};
const ET={NONE:0,WALL:1,IWALL:2,WIN:3,WINB:4,DOOR:5,DOPEN:6,DGONE:7,BOARD:8,FENCE:9,FCUT:10,RAIL:11};
const EK={WALL:0,DOOR:1,GATE:2,WIN:3,SHOPWIN:4};   // what an edge *is*, independent of its current state
const EHP=[0,0,260,14,0,140,0,0,220,320,0,0];

const MAP={
  floor:[],block:[],bld:[],surf:[],room:[],fl:[],eE:[],eS:[],
  blds:[],rooms:[],flights:[],links:new Map(),furn:[],yards:[],areas:[],props:[],decals:[],
  streetsNS:[],streetsEW:[],alleys:[],signs:[],
};
for(let L=0;L<NL;L++){
  MAP.floor.push(new Uint8Array(GN)); MAP.block.push(new Uint8Array(GN)); MAP.bld.push(new Int16Array(GN).fill(-1));
  MAP.surf.push(new Uint8Array(GN)); MAP.room.push(new Int16Array(GN).fill(-1)); MAP.fl.push(new Int16Array(GN));
  MAP.eE.push(new Int32Array(GN)); MAP.eS.push(new Int32Array(GN));
}
MAP.floor[0].fill(1);

/* ---------- edges: walls, doors, windows, fences live on the boundary between two cells ---------- */
const EMAX=260000;
const ED={t:new Uint8Array(EMAX),k:new Uint8Array(EMAX),hp:new Float32Array(EMAX),max:new Float32Array(EMAX),L:new Uint8Array(EMAX),
  x:new Int16Array(EMAX),z:new Int16Array(EMAX),d:new Uint8Array(EMAX),b:new Int16Array(EMAX),inst:new Int32Array(EMAX).fill(-1),open:new Float32Array(EMAX),hinge:new Int8Array(EMAX)};
let EN=1;
// d=0: edge on the east side of cell (x,z); d=1: on its south side
function edgeRef(ax,az,bx,bz){
  if(bx===ax+1&&bz===az) return [ax,az,0]; if(ax===bx+1&&az===bz) return [bx,bz,0];
  if(bz===az+1&&bx===ax) return [ax,az,1]; if(az===bz+1&&ax===bx) return [bx,bz,1]; return null;
}
function edgeAt(L,ax,az,bx,bz){ const r=edgeRef(ax,az,bx,bz); if(!r||!inMap(r[0],r[1])) return 0; return (r[2]?MAP.eS:MAP.eE)[L][CI(r[0],r[1])]; }
function setEdge(L,ax,az,bx,bz,t,b=-1,k=EK.WALL){
  const r=edgeRef(ax,az,bx,bz); if(!r||!inMap(r[0],r[1])) return 0;
  const arr=r[2]?MAP.eS[L]:MAP.eE[L], i=CI(r[0],r[1]); let id=arr[i];
  if(!id){ id=EN++; arr[i]=id; ED.L[id]=L; ED.x[id]=r[0]; ED.z[id]=r[1]; ED.d[id]=r[2]; }
  ED.t[id]=t; ED.k[id]=k; ED.b[id]=b; ED.hp[id]=ED.max[id]=EHP[t]; ED.hinge[id]=MR()<.5?1:-1;
  return id;
}
function clearEdge(L,ax,az,bx,bz){ const r=edgeRef(ax,az,bx,bz); if(!r) return; const arr=r[2]?MAP.eS[L]:MAP.eE[L], i=CI(r[0],r[1]); if(arr[i]) ED.t[arr[i]]=ET.NONE; }

/* ---------- streets, alleys and the outline of the neighborhood ---------- */
const ST_NS=[{n:'S DAMEN AVE',x:-72,h:13},{n:'S WOLCOTT AVE',x:0,h:13},{n:'S WOOD ST',x:72,h:13}];
const ST_EW=[{n:'W 17TH ST',z:-118,h:9},{n:'W 18TH ST',z:-32,h:9},{n:'W 19TH ST',z:62,h:9}];
const SIDEWALK=3;
const PLAY={x0:-111,x1:111,z0:-145,z1:130};
MAP.streetsNS=ST_NS; MAP.streetsEW=ST_EW;
const inNS=x=>ST_NS.some(s=>x>=s.x-s.h&&x<s.x+s.h), inEW=z=>ST_EW.some(s=>z>=s.z-s.h&&z<s.z+s.h);
function rectCells(x0,z0,x1,z1,fn){ for(let z=z0;z<z1;z++) for(let x=x0;x<x1;x++) if(inMap(x,z)) fn(x,z,CI(x,z)); }
// default ground: everything off-street starts as packed dirt and gets claimed below
rectCells(GX0,GZ0,GX0+GW,GZ0+GH,(x,z,c)=>{ MAP.surf[0][c]=SURF.DIRT; });
for(const s of ST_NS) rectCells(s.x-s.h,GZ0,s.x+s.h,GZ0+GH,(x,z,c)=>{ MAP.surf[0][c]=(x<s.x-s.h+SIDEWALK||x>=s.x+s.h-SIDEWALK)?SURF.CONCRETE:SURF.ASPHALT; });
for(const s of ST_EW) rectCells(GX0,s.z-s.h,GX0+GW,s.z+s.h,(x,z,c)=>{
  const walk=z<s.z-s.h+SIDEWALK||z>=s.z+s.h-SIDEWALK;
  if(inNS(x)){ if(MAP.surf[0][c]===SURF.CONCRETE&&!walk) MAP.surf[0][c]=SURF.ASPHALT; return; }
  MAP.surf[0][c]=walk?SURF.CONCRETE:SURF.ASPHALT; });
// N-S alleys through the middle of each block
const ALLEYS=[{x:-111},{x:-39},{x:33},{x:105}];
const zBands=[[-145,-127],[-109,-41],[-23,53],[71,130]];
for(const a of ALLEYS) for(let [z0,z1] of zBands){
  if(z0===-145) continue;                                  // north of 17th: lots face the street, no alley
  if(z0===71&&(a.x===-39||a.x===33)) continue;             // school and park take the whole block
  if(z0===71) z1=89;
  rectCells(a.x,z0,a.x+6,z1,(x,z,c)=>{ MAP.surf[0][c]=SURF.ALLEY; });
  MAP.alleys.push({x0:a.x,x1:a.x+6,z0,z1});
}

/* ---------- buildings ---------- */
function mkBld(o){
  const B=Object.assign({id:MAP.blds.length,enter:true,floors:1,roof:false,wallH:LH,flights:[],rooms:[],doors:[],kind:'flat',
    name:'',brick:mpick(BRICKS),plaster:mpick(PLASTERS),trim:mpick(TRIMS),stairU:0,stairV:1},o);
  const ew=B.front==='E'||B.front==='W';
  B.W=ew?B.z1-B.z0:B.x1-B.x0; B.D=ew?B.x1-B.x0:B.z1-B.z0;
  MAP.blds.push(B); return B;
}
const BRICKS=[[0.55,0.32,0.26],[0.62,0.4,0.3],[0.66,0.55,0.4],[0.48,0.3,0.27],[0.58,0.5,0.44],[0.42,0.36,0.33],[0.7,0.62,0.5],[0.5,0.42,0.38]];
const PLASTERS=[[0.62,0.6,0.55],[0.55,0.58,0.56],[0.6,0.55,0.48],[0.5,0.52,0.56],[0.64,0.6,0.5],[0.52,0.48,0.46]];
const TRIMS=[[0.82,0.8,0.74],[0.3,0.32,0.3],[0.55,0.2,0.16],[0.22,0.3,0.36],[0.7,0.66,0.55]];
// local (u along the street front, v = depth from the front) -> world cell
function L2W(B,u,v){
  switch(B.front){
    case 'E': return [B.x1-1-v,B.z0+u];
    case 'W': return [B.x0+v,B.z1-1-u];
    case 'N': return [B.x0+u,B.z0+v];
    default:  return [B.x1-1-u,B.z1-1-v];
  }
}
function lEdge(B,L,u,v,ou,ov,t,k){ const a=L2W(B,u,v), b=L2W(B,ou,ov); return setEdge(L,a[0],a[1],b[0],b[1],t,B.id,k); }
function lCell(B,u,v){ const a=L2W(B,u,v); return CI(a[0],a[1]); }
function eachPerim(B,fn){
  for(let u=0;u<B.W;u++){ fn(u,0,u,-1,'front',u,B.W); fn(u,B.D-1,u,B.D,'back',u,B.W); }
  for(let v=0;v<B.D;v++){ fn(0,v,-1,v,'left',v,B.D); fn(B.W-1,v,B.W,v,'right',v,B.D); }
}
function outdoorAt(x,z){ return inMap(x,z)&&MAP.bld[0][CI(x,z)]<0&&MAP.block[0][CI(x,z)]!==BLK.SOLID; }

function shell(B,fsurf){
  B.fsurf=fsurf;
  const levels=B.floors+(B.roof?1:0);
  for(let L=0;L<levels;L++){
    const isRoof=L===B.floors;
    for(let v=0;v<B.D;v++) for(let u=0;u<B.W;u++){ const c=lCell(B,u,v);
      MAP.floor[L][c]=1; MAP.bld[L][c]=B.id; MAP.surf[L][c]=isRoof?SURF.ROOF:fsurf; if(L===0) MAP.block[0][c]=BLK.FREE; }
    eachPerim(B,(u,v,ou,ov)=>lEdge(B,L,u,v,ou,ov,isRoof?ET.RAIL:ET.WALL,EK.WALL));
  }
}
function solidBlock(x0,z0,x1,z1,h,kind,extra){
  const B=mkBld(Object.assign({x0,z0,x1,z1,front:'N',enter:false,h,kind:kind||'tower'},extra||{}));
  rectCells(x0,z0,x1,z1,(x,z,c)=>{ MAP.block[0][c]=BLK.SOLID; MAP.bld[0][c]=B.id; });
  return B;
}

/* stairs: a 4x4 hall of switchback flights, each 2 cells wide. Walking off an entry cell toward its
   steps carries you up a level; the matching cells above are the exits. */
function stairs(B,us,vs){
  B.stairU=us; B.stairV=vs;
  const nF=B.floors-1+(B.roof?1:0);
  for(let k=0;k<nF;k++){
    const col=k%2, u0=us+col*2, up=(k%2===0);
    const en=[],st=[];
    for(let du=0;du<2;du++) for(let dv=0;dv<2;dv++){
      const u=u0+du;
      en.push(L2W(B,u,up?vs+dv:vs+3-dv)); st.push(L2W(B,u,up?vs+2+dv:vs+1-dv));
    }
    const f={id:MAP.flights.length,b:B.id,L:k,en,st,dx:(st[0][0]-en[0][0])/2,dz:(st[0][1]-en[0][1])/2};
    MAP.flights.push(f); B.flights.push(f);
    for(const [x,z] of st){ const c=CI(x,z); MAP.floor[k][c]=0; MAP.fl[k][c]=0; }
    for(const [x,z] of en){ const c=CI(x,z); MAP.floor[k+1][c]=0; MAP.fl[k+1][c]=0; }
    for(const [x,z] of en){ MAP.fl[k][CI(x,z)]=f.id+1; }
    for(const [x,z] of st){ MAP.fl[k+1][CI(x,z)]=-(f.id+1); MAP.floor[k+1][CI(x,z)]=1; }
    for(let i=0;i<4;i++){
      const a=k*GN+CI(en[i][0],en[i][1]), b=(k+1)*GN+CI(st[i][0],st[i][1]);
      if(!MAP.links.has(a)) MAP.links.set(a,[]); if(!MAP.links.has(b)) MAP.links.set(b,[]);
      MAP.links.get(a).push(b); MAP.links.get(b).push(a);
    }
  }
}

/* rooms: rectangles in local coords, walled off with interior walls and a door */
function room(B,L,u0,v0,u1,v1,type){
  const R={id:MAP.rooms.length,b:B.id,L,u0,v0,u1,v1,type,cells:[]};
  MAP.rooms.push(R); B.rooms.push(R);
  for(let v=v0;v<v1;v++) for(let u=u0;u<u1;u++){ const c=lCell(B,u,v); MAP.room[L][c]=R.id; R.cells.push([u,v]);
    if(MAP.floor[L][c]) MAP.surf[L][c]=ROOM_SURF[type]??B.fsurf; }
  return R;
}
const ROOM_SURF={living:SURF.WOOD,bed:SURF.CARPET,kitchen:SURF.TILE,bath:SURF.TILE,store:SURF.TILE,back:SURF.CONCRETE,office:SURF.CARPET,
  ware:SURF.CONCRETE,hall:SURF.WOOD,class:SURF.TILE,exam:SURF.TILE,wait:SURF.TILE,cell:SURF.CONCRETE,armory:SURF.CONCRETE,nave:SURF.WOOD,mart:SURF.TILE,base:SURF.WOOD,garage:SURF.CONCRETE};
function wallRoom(B,R){
  for(const [u,v] of R.cells){
    for(const [du,dv] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const ou=u+du, ov=v+dv; if(ou<0||ov<0||ou>=B.W||ov>=B.D) continue;
      const oc=lCell(B,ou,ov); if(MAP.room[R.L][oc]===R.id) continue;
      const e=edgeAt(R.L,...L2W(B,u,v),...L2W(B,ou,ov));
      if(e&&ED.t[e]!==ET.NONE&&ED.t[e]!==ET.IWALL) continue;
      lEdge(B,R.L,u,v,ou,ov,ET.IWALL,EK.WALL);
    }
  }
}
// a doorway from room R toward a cell that is walkable on the same level and not in R
function roomDoor(B,R,prefer,leaf=0.65){
  const opts=[];
  for(const [u,v] of R.cells){
    for(const [du,dv] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const ou=u+du, ov=v+dv; if(ou<0||ov<0||ou>=B.W||ov>=B.D) continue;
      const oc=lCell(B,ou,ov), c=lCell(B,u,v);
      if(MAP.room[R.L][oc]===R.id||!MAP.floor[R.L][oc]||!MAP.floor[R.L][c]||MAP.fl[R.L][oc]||MAP.fl[R.L][c]) continue;
      if(prefer!==undefined&&MAP.room[R.L][oc]!==prefer) continue;
      opts.push([u,v,ou,ov]);
    }
  }
  if(!opts.length) return false;
  const o=opts[Math.floor(MR()*opts.length)];
  if(MR()<leaf) lEdge(B,R.L,o[0],o[1],o[2],o[3],ET.DOOR,EK.DOOR); else lEdge(B,R.L,o[0],o[1],o[2],o[3],ET.NONE,EK.WALL);
  R.door=[o[0],o[1],o[2],o[3]];
  return true;
}
function exteriorDoor(B,L,u,v,side,kind){
  let ou=u,ov=v; if(side==='front') ov=-1; else if(side==='back') ov=B.D; else if(side==='left') ou=-1; else ou=B.W;
  const id=lEdge(B,L,u,v,ou,ov,ET.DOOR,kind||EK.DOOR); B.doors.push(id); return id;
}
// windows on every outward wall that faces open air; queued so every neighbor exists first
const WINQ=[];
function windows(B,opt={}){ WINQ.push([B,opt]); }
function doWindows(B,opt={}){
  for(let L=0;L<B.floors;L++){
    eachPerim(B,(u,v,ou,ov,side,t,len)=>{
      const a=L2W(B,u,v), b=L2W(B,ou,ov);
      const e=edgeAt(L,a[0],a[1],b[0],b[1]); if(!e||ED.t[e]!==ET.WALL) return;
      if(!outdoorAt(b[0],b[1])) return;
      if(t===0||t===len-1) return;
      const c=CI(a[0],a[1]); if(MAP.fl[L][c]||!MAP.floor[L][c]) return;
      let want;
      if(L===0&&side==='front'&&opt.storefront){ want=true; }
      else if(side==='front') want=t%3!==0;
      else want=(t%4===2);
      if(!want) return;
      const shop=L===0&&side==='front'&&opt.storefront;
      const boarded=MR()<(L===0?(opt.boardP??0.22):0.06);
      setEdge(L,a[0],a[1],b[0],b[1],boarded?ET.BOARD:ET.WIN,B.id,shop?EK.SHOPWIN:EK.WIN);
    });
  }
}

/* furniture: boxes on cells, mostly against walls; rooms stay connected */
const FURN={
  couch:{w:2,d:1,h:.8,col:[[.38,.32,.28],[.3,.34,.4],[.42,.28,.24],[.36,.36,.3]],loot:'couch'},
  chair:{w:1,d:1,h:.9,col:[[.4,.3,.22],[.3,.3,.32]]},
  ctable:{w:1,d:1,h:.42,col:[[.42,.3,.2]],free:true},
  tv:{w:1,d:1,h:.7,col:[[.18,.18,.2]]},
  shelf:{w:1,d:1,h:1.9,col:[[.45,.34,.24],[.36,.34,.32]],loot:'shelf'},
  bed:{w:2,d:2,h:.55,col:[[.62,.6,.56],[.5,.55,.62],[.6,.5,.48]],loot:'bed'},
  bed1:{w:1,d:2,h:.55,col:[[.6,.58,.55],[.5,.52,.6]],loot:'bed'},
  dresser:{w:1,d:1,h:1.05,col:[[.42,.3,.2],[.5,.42,.32]],loot:'dresser'},
  counter:{w:1,d:1,h:.92,col:[[.55,.52,.46],[.4,.36,.3]],loot:'cabinet'},
  fridge:{w:1,d:1,h:1.8,col:[[.78,.78,.74],[.62,.62,.6]],loot:'fridge'},
  stove:{w:1,d:1,h:.92,col:[[.7,.7,.66],[.2,.2,.2]],loot:'cabinet'},
  table:{w:1,d:1,h:.76,col:[[.45,.32,.22],[.55,.5,.42]],free:true},
  tub:{w:1,d:2,h:.55,col:[[.85,.85,.82]]},
  toilet:{w:1,d:1,h:.5,col:[[.85,.85,.82]],loot:'cabinet'},
  rack:{w:1,d:1,h:1.75,col:[[.5,.52,.54],[.32,.34,.36]],loot:'rack'},
  cooler:{w:1,d:1,h:2.0,col:[[.7,.74,.78]],loot:'fridge'},
  till:{w:1,d:1,h:1.0,col:[[.3,.28,.26]],loot:'till'},
  desk:{w:2,d:1,h:.76,col:[[.42,.36,.3],[.5,.5,.48]],loot:'desk'},
  filing:{w:1,d:1,h:1.3,col:[[.45,.48,.46]],loot:'desk'},
  locker:{w:1,d:1,h:1.9,col:[[.36,.42,.38],[.3,.36,.44]],loot:'locker'},
  crate:{w:1,d:1,h:1.0,col:[[.48,.4,.28],[.42,.36,.26]],loot:'crate'},
  pallet:{w:2,d:2,h:1.3,col:[[.5,.44,.34]],loot:'crate'},
  exam:{w:1,d:2,h:.85,col:[[.7,.74,.72]]},
  medcab:{w:1,d:1,h:1.6,col:[[.8,.82,.8]],loot:'medcab'},
  sdesk:{w:1,d:1,h:.7,col:[[.5,.42,.32]],free:true},
  pew:{w:4,d:1,h:.9,col:[[.36,.24,.16]]},
  altar:{w:3,d:1,h:1.1,col:[[.7,.66,.58]]},
  workbench:{w:2,d:1,h:.95,col:[[.42,.34,.24]],loot:'tools'},
  cot:{w:1,d:2,h:.45,col:[[.36,.38,.28]]},
  gunrack:{w:2,d:1,h:1.7,col:[[.3,.32,.3]],loot:'armory'},
};
function placeFurn(B,L,u,v,type,rot,extra){
  const F=FURN[type]; const w=rot?F.d:F.w, d=rot?F.w:F.d;
  const cells=[];
  for(let dv=0;dv<d;dv++) for(let du=0;du<w;du++){
    const uu=u+du, vv=v+dv; if(uu<0||vv<0||uu>=B.W||vv>=B.D) return null;
    const c=lCell(B,uu,vv); if(!MAP.floor[L][c]||MAP.block[L][c]||MAP.fl[L][c]) return null;
    cells.push(c);
  }
  for(const c of cells) MAP.block[L][c]=BLK.FURN;
  const a=L2W(B,u,v), b=L2W(B,u+w-1,v+d-1);
  const f={id:MAP.furn.length,b:B.id,L,type,x0:Math.min(a[0],b[0]),z0:Math.min(a[1],b[1]),x1:Math.max(a[0],b[0])+1,z1:Math.max(a[1],b[1])+1,
    h:F.h,col:mpick(F.col),loot:F.loot||null,cells};
  if(extra) Object.assign(f,extra);
  MAP.furn.push(f); return f;
}
function unplace(f){ for(const c of f.cells) MAP.block[f.L][c]=BLK.FREE; MAP.furn[f.id]=null; }
// is everything walkable in this room still reachable from its doorway?
function roomConnected(B,R){
  const seen=new Set(), free=[];
  for(const [u,v] of R.cells){ const c=lCell(B,u,v); if(MAP.floor[R.L][c]&&!MAP.block[R.L][c]) free.push(u+','+v); }
  if(!free.length) return false;
  const start=R.door?R.door[0]+','+R.door[1]:free[0];
  if(!free.includes(start)) return false;
  const q=[start]; seen.add(start);
  while(q.length){ const [u,v]=q.pop().split(',').map(Number);
    for(const [du,dv] of [[1,0],[-1,0],[0,1],[0,-1]]){ const k=(u+du)+','+(v+dv); if(seen.has(k)||!free.includes(k)) continue;
      const e=edgeAt(R.L,...L2W(B,u,v),...L2W(B,u+du,v+dv)); if(e&&ED.t[e]!==ET.NONE) continue; seen.add(k); q.push(k); } }
  return seen.size===free.length;
}
function furnish(B,R,list){
  for(const type of list){
    for(let tries=0;tries<14;tries++){
      const rot=MR()<.5, F=FURN[type], w=rot?F.d:F.w, d=rot?F.w:F.d;
      const ru=R.u1-R.u0-w, rv=R.v1-R.v0-d; if(ru<0||rv<0) break;
      let u,v;
      if(F.free){ u=R.u0+mri(0,ru); v=R.v0+mri(0,rv); }
      else { // against a wall
        const s=mri(0,3);
        if(s===0){ u=R.u0; v=R.v0+mri(0,rv); } else if(s===1){ u=R.u1-w; v=R.v0+mri(0,rv); }
        else if(s===2){ v=R.v0; u=R.u0+mri(0,ru); } else { v=R.v1-d; u=R.u0+mri(0,ru); }
      }
      const f=placeFurn(B,R.L,u,v,type,rot); if(!f) continue;
      if(!roomConnected(B,R)){ unplace(f); continue; }
      break;
    }
  }
}
const ROOM_FURN={
  living:()=>['couch','tv','ctable','shelf',mch(.5)?'chair':'shelf'],
  bed:()=>[mch(.6)?'bed':'bed1','dresser',mch(.5)?'dresser':'shelf'],
  kitchen:()=>['fridge','stove','counter','counter','table'],
  bath:()=>['tub','toilet'],
  store:()=>['till','rack','rack','rack','rack','cooler','rack'],
  back:()=>['crate','crate','rack','shelf'],
  office:()=>['desk','filing','desk','chair'],
  ware:()=>['pallet','crate','crate','pallet','crate','workbench'],
  hall:()=>[],
};

/* ---------- building recipes ---------- */
function residential(B){
  shell(B,SURF.WOOD);
  const us=MR()<.5?0:B.W-4; B.stairU=us;
  stairs(B,us,1);
  for(let L=0;L<B.floors;L++){
    const ru0=us===0?4:0, ru1=us===0?B.W:B.W-4;
    room(B,L,us,0,us+4,B.D,'hall');
    if(ru1-ru0<3) continue;
    const split=ru1-ru0>=9;
    const halves=split?[[ru0,ru0+Math.floor((ru1-ru0)/2)],[ru0+Math.floor((ru1-ru0)/2),ru1]]:[[ru0,ru1]];
    for(const [a,b] of halves){
      let v=0; const types=L===0?['living','kitchen','bath','bed']:['living','bed','bath','bed','kitchen'];
      let ti=0;
      while(v<B.D){ let d=Math.min(B.D-v,mri(3,6)); if(B.D-(v+d)<3) d=B.D-v;
        const t=(v+d>=B.D&&L===0)?'kitchen':types[ti++%types.length];
        const R=room(B,L,a,v,b,v+d,t); v+=d; }
    }
  }
  for(const R of B.rooms){ if(R.type==='hall') continue; wallRoom(B,R); }
  for(const R of B.rooms){ if(R.type==='hall') continue;
    const hall=B.rooms.find(h=>h.type==='hall'&&h.L===R.L);
    if(!roomDoor(B,R,hall?hall.id:undefined)) roomDoor(B,R); }
  exteriorDoor(B,0,us+2,0,'front'); exteriorDoor(B,0,us+1,B.D-1,'back');
  windows(B,{});
  for(const R of B.rooms) furnish(B,R,(ROOM_FURN[R.type]||(()=>[]))());
}
function storefront(B,name){
  shell(B,SURF.TILE); B.name=name; B.kind='store';
  const us=MR()<.5?0:B.W-4, vs=B.D-5; B.stairU=us; B.stairV=vs;
  if(B.floors>1||B.roof) stairs(B,us,vs);
  const vb=Math.max(4,B.D-7);
  room(B,0,0,0,B.W,vb,'store'); room(B,0,0,vb,B.W,B.D,'back');
  for(let L=1;L<B.floors;L++){
    const ru0=us===0?4:0, ru1=us===0?B.W:B.W-4;
    room(B,L,us,0,us+4,B.D,'hall');
    let v=0, ti=0; const types=['living','bed','kitchen','bath','bed'];
    while(v<B.D){ let d=Math.min(B.D-v,mri(3,6)); if(B.D-(v+d)<3) d=B.D-v; room(B,L,ru0,v,ru1,v+d,types[ti++%types.length]); v+=d; }
  }
  for(const R of B.rooms){ if(R.type==='hall') continue; wallRoom(B,R); }
  const st=B.rooms.find(r=>r.type==='store'), bk=B.rooms.find(r=>r.type==='back');
  roomDoor(B,bk,st.id,0.9);
  for(const R of B.rooms){ if(R.L===0||R.type==='hall') continue; const hall=B.rooms.find(h=>h.type==='hall'&&h.L===R.L); if(!roomDoor(B,R,hall?hall.id:undefined)) roomDoor(B,R); }
  exteriorDoor(B,0,Math.floor(B.W/2),0,'front'); exteriorDoor(B,0,us===0?B.W-2:1,B.D-1,'back');
  windows(B,{storefront:true,boardP:0.3});
  // aisles in the shop: rows of racks with a walkway between
  for(let u=1;u<B.W-1;u+=3) for(let v=2;v<vb-1;v++) if(MR()<.85) placeFurn(B,0,u,v,'rack',false);
  if(!roomConnected(B,st)){ for(const f of MAP.furn) if(f&&f.b===B.id&&f.L===0&&f.type==='rack') unplace(f); }
  placeFurn(B,0,B.W-2,1,'till',false);
  for(const R of B.rooms) if(R.type!=='store') furnish(B,R,(ROOM_FURN[R.type]||(()=>[]))());
}
function warehouse(B){
  shell(B,SURF.CONCRETE); B.kind='ware';
  if(B.floors>1||B.roof) stairs(B,0,1);
  for(let L=0;L<B.floors;L++){ room(B,L,0,0,B.W,B.D,L===0?'ware':'office'); }
  exteriorDoor(B,0,2,0,'front'); exteriorDoor(B,0,B.W-2,0,'front'); exteriorDoor(B,0,B.W-3,B.D-1,'back');
  windows(B,{boardP:0.4});
  for(const R of B.rooms) furnish(B,R,(ROOM_FURN[R.type]||(()=>[]))());
}

/* ---------- yards, fences, vacant lots ---------- */
function fenceLine(L,x0,z0,x1,z1,gateAt){ // along a straight cell boundary, from (x0,z0) to (x1,z1) exclusive
  if(z0===z1){ for(let x=x0;x<x1;x++){ const g=gateAt!==undefined&&x===gateAt; setEdge(L,x,z0-1,x,z0,g?ET.DOOR:ET.FENCE,-1,g?EK.GATE:EK.WALL); } }
  else { for(let z=z0;z<z1;z++){ const g=gateAt!==undefined&&z===gateAt; setEdge(L,x0-1,z,x0,z,g?ET.DOOR:ET.FENCE,-1,g?EK.GATE:EK.WALL); } }
}
function yard(x0,z0,x1,z1,kind){
  rectCells(x0,z0,x1,z1,(x,z,c)=>{ MAP.surf[0][c]=kind==='lot'?SURF.GRAVEL:(MR()<.7?SURF.GRASS:SURF.DIRT); });
  MAP.yards.push({x0,z0,x1,z1,kind});
}

/* ---------- lots along a street front ---------- */
const STORE_NAMES=['CARNICERIA LA ROSITA','LAVANDERIA','TAQUERIA EL SOL','FARMACIA','CELL PHONE REPAIR','LIQUORS','PANADERIA','BARBER SHOP','DOLLAR PLUS',
  'LLANTAS · TIRES','EL MERCADITO','CHECKS CASHED','PIZZA & SUBS','DENTISTA','MUEBLES','TORTILLERIA','SEGUROS · INSURANCE','PAWN · EMPEÑO','FLORERIA',
  'HARDWARE','LAUNDROMAT','NAIL SALON','TATTOO','FRUTERIA','BAKERY','DISCOUNT SHOES','RESTAURANT','PALETERIA','TAX SERVICE','CAFE'];
let storeN=0;
// face: which way the front looks ('E','W','N','S'); range along the front [a,b); depth band [d0,d1) away from the street
function lotsAlong(face,fixed0,fixed1,a,b,opts={}){
  const cuts=(opts.cuts||[]).slice(), reserve=opts.reserve||[];
  let p=a;
  while(p<b){
    const r=reserve.find(r=>p>=r[0]&&p<r[1]); if(r){ p=r[1]; continue; }
    let w=mri(8,13);
    const nextCut=cuts.filter(c=>c>p).sort((x,y)=>x-y)[0];
    const nextRes=reserve.filter(r=>r[0]>p).map(r=>r[0]).sort((x,y)=>x-y)[0];
    const lim=Math.min(b,nextCut??Infinity,nextRes??Infinity);
    if(p+w>lim||lim-(p+w)<7) w=lim-p;
    if(w>15){ w=Math.floor(w/2); }
    lot(face,fixed0,fixed1,p,p+w,opts);
    p+=w;
  }
}
function lot(face,f0,f1,a,b,opts){
  const ew=face==='E'||face==='W';
  // rect in world: for E/W fronts, x spans [f0,f1), z spans [a,b); for N/S fronts, x spans [a,b), z spans [f0,f1)
  const R=ew?{x0:f0,x1:f1,z0:a,z1:b}:{x0:a,x1:b,z0:f0,z1:f1};
  const width=b-a, depthAll=f1-f0;
  const roll=MR();
  let type=roll<(opts.storeP??.38)?'store':roll<.8?'flat':roll<.88?'tower':roll<.94?'vacant':'ware';
  if(opts.force) type=opts.force;
  if(width<7&&type!=='vacant') type='flat';
  const gang=type==='flat'&&width>=9&&MR()<.55?1:0;
  let depth=type==='flat'?mri(12,Math.min(16,depthAll-4)):type==='store'?Math.min(depthAll,mri(14,18)):depthAll;
  if(opts.maxDepth) depth=Math.min(depth,opts.maxDepth);
  // building rect inside the lot (front flush with the street)
  const bw=width-gang;
  let x0,x1,z0,z1;
  if(face==='E'){ x1=f1; x0=f1-depth; z0=a; z1=a+bw; }
  else if(face==='W'){ x0=f0; x1=f0+depth; z0=a+gang; z1=b; }
  else if(face==='N'){ z0=f0; z1=f0+depth; x0=a; x1=a+bw; }
  else { z1=f1; z0=f1-depth; x0=a+gang; x1=b; }
  if(type==='vacant'){
    yard(R.x0,R.z0,R.x1,R.z1,'lot');
    if(face==='E') fenceLine(0,R.x1,R.z0,R.x1,R.z1,mri(R.z0+1,R.z1-2)); else if(face==='W') fenceLine(0,R.x0,R.z0,R.x0,R.z1,mri(R.z0+1,R.z1-2));
    else if(face==='N') fenceLine(0,R.x0,R.z0,R.x1,R.z0,mri(R.x0+1,R.x1-2)); else fenceLine(0,R.x0,R.z1,R.x1,R.z1,mri(R.x0+1,R.x1-2));
    MAP.areas.push({kind:'vacant',...R});
    return null;
  }
  if(type==='tower'){ return solidBlock(R.x0,R.z0,R.x1,R.z1,mr(16,34),'tower'); }
  const floors=type==='ware'?mri(1,2):type==='store'?mri(2,3):mri(2,3);
  const B=mkBld({x0,x1,z0,z1,front:face,floors,roof:MR()<.22,kind:type});
  if(type==='store') storefront(B,STORE_NAMES[storeN++%STORE_NAMES.length]);
  else if(type==='ware') warehouse(B);
  else residential(B);
  // the rest of the lot behind the building is a yard, fenced at the alley with a gate
  if(depth<depthAll){
    let yr;
    if(face==='E') yr={x0:R.x0,x1:x0,z0:R.z0,z1:R.z1}; else if(face==='W') yr={x0:x1,x1:R.x1,z0:R.z0,z1:R.z1};
    else if(face==='N') yr={x0:R.x0,x1:R.x1,z0:z1,z1:R.z1}; else yr={x0:R.x0,x1:R.x1,z0:R.z0,z1:z0};
    yard(yr.x0,yr.z0,yr.x1,yr.z1,'yard');
    if(ew){ const xa=face==='E'?yr.x0:yr.x1; fenceLine(0,xa,yr.z0,xa,yr.z1,mri(yr.z0+1,yr.z1-2));
      fenceLine(0,yr.x0,yr.z0,yr.x1,yr.z0); fenceLine(0,yr.x0,yr.z1,yr.x1,yr.z1); }
    else { const za=face==='N'?yr.z1:yr.z0; fenceLine(0,yr.x0,za,yr.x1,za,mri(yr.x0+1,yr.x1-2));
      fenceLine(0,yr.x0,yr.z0,yr.x0,yr.z1); fenceLine(0,yr.x1,yr.z0,yr.x1,yr.z1); }
  }
  if(gang){ // the gangway beside the house
    const gr=face==='E'?{x0:x0,x1:x1,z0:b-1,z1:b}:face==='W'?{x0:x0,x1:x1,z0:a,z1:a+1}:face==='N'?{x0:b-1,x1:b,z0:z0,z1:z1}:{x0:a,x1:a+1,z0:z0,z1:z1};
    rectCells(gr.x0,gr.z0,gr.x1,gr.z1,(x,z,c)=>{ MAP.surf[0][c]=SURF.CONCRETE; });
    if(opts.closedFront){ // blocked at the street for the compound
      if(face==='E') fenceLine(0,x1,gr.z0,x1,gr.z1); else if(face==='W') fenceLine(0,x0,gr.z0,x0,gr.z1);
    } else if(MR()<.6){
      if(face==='E') fenceLine(0,x1,gr.z0,x1,gr.z1,gr.z0); else if(face==='W') fenceLine(0,x0,gr.z0,x0,gr.z1,gr.z0);
      else if(face==='N') fenceLine(0,gr.x0,z0,gr.x1,z0,gr.x0); else fenceLine(0,gr.x0,z1,gr.x1,z1,gr.x0);
    }
  }
  return B;
}

/* ---------- landmarks ---------- */
const LANDMARK={};
// Ferreteria Morales: the squad's base on the west side of Wolcott
function baseShop(){
  const B=mkBld({x0:-33,x1:-13,z0:6,z1:22,front:'E',floors:2,roof:true,kind:'base',name:'FERRETERIA MORALES',brick:[0.5,0.34,0.28],trim:[0.22,0.3,0.36]});
  shell(B,SURF.WOOD);
  stairs(B,12,13);              // back corner, south side
  const R0=room(B,0,0,0,B.W,B.D,'base');
  // upstairs: the old apartment
  room(B,1,12,0,16,B.D,'hall');
  room(B,1,0,0,12,6,'living'); room(B,1,0,6,12,12,'bed'); room(B,1,0,12,12,20,'kitchen');
  for(const R of B.rooms) if(R.L===1&&R.type!=='hall'){ wallRoom(B,R); roomDoor(B,R,B.rooms.find(h=>h.type==='hall'&&h.L===1).id,0.5); }
  exteriorDoor(B,0,7,0,'front'); exteriorDoor(B,0,8,0,'front'); exteriorDoor(B,0,2,B.D-1,'back');
  for(const id of B.doors.slice(0,2)) ED.t[id]=ET.DOPEN;
  windows(B,{storefront:true,boardP:0.5});
  // the squad's corner: counter, shelving, cots, the radio table, the stove
  for(let v=1;v<=4;v++) placeFurn(B,0,4,v,'counter',false);
  placeFurn(B,0,5,4,'counter',false); placeFurn(B,0,6,4,'counter',false);
  for(let u=4;u<11;u++) placeFurn(B,0,u,B.D-1,'shelf',false);
  for(let v=4;v<12;v+=2) placeFurn(B,0,B.W-1,v,'cot',false);
  placeFurn(B,0,3,10,'table',false,{radio:true});
  placeFurn(B,0,0,12,'stove',false,{stove:true});
  placeFurn(B,0,0,8,'workbench',true);
  placeFurn(B,0,8,15,'crate',false); placeFurn(B,0,9,15,'crate',false);
  for(const R of B.rooms) if(R.L===1) furnish(B,R,(ROOM_FURN[R.type]||(()=>[]))());
  LANDMARK.base=B; return B;
}
function church(){
  const B=mkBld({x0:13,x1:33,z0:-98,z1:-64,front:'W',floors:1,wallH:8.5,kind:'church',name:'ST. ADALBERT',brick:[0.6,0.48,0.36],trim:[0.75,0.72,0.66]});
  shell(B,SURF.WOOD);
  room(B,0,0,0,B.W,B.D-4,'nave'); const sac=room(B,0,0,B.D-4,B.W,B.D,'office');
  wallRoom(B,sac); roomDoor(B,sac,B.rooms[0].id,1);
  exteriorDoor(B,0,Math.floor(B.W/2),0,'front'); exteriorDoor(B,0,Math.floor(B.W/2)+1,0,'front'); exteriorDoor(B,0,2,B.D-1,'back');
  windows(B,{boardP:0.1});
  for(let v=3;v<B.D-7;v+=2){ placeFurn(B,0,2,v,'pew',false); placeFurn(B,0,B.W-6,v,'pew',false); if(B.W>=20){ placeFurn(B,0,6,v,'pew',false); placeFurn(B,0,B.W-10,v,'pew',false);} }
  placeFurn(B,0,Math.floor(B.W/2)-1,B.D-6,'altar',false);
  furnish(B,sac,['shelf','desk','dresser']);
  solidBlock(13,-104,19,-98,26,'steeple',{steeple:true});
  LANDMARK.church=B; return B;
}
function supermarket(){
  const B=mkBld({x0:-33,x1:-13,z0:-98,z1:-62,front:'E',floors:1,wallH:5.2,kind:'market',name:'MERCADO DEL BARRIO',brick:[0.6,0.58,0.54],trim:[0.6,0.16,0.12]});
  shell(B,SURF.TILE);
  room(B,0,0,0,B.W,B.D-5,'mart'); const bk=room(B,0,0,B.D-5,B.W,B.D,'back'); wallRoom(B,bk); roomDoor(B,bk,B.rooms[0].id,1);
  exteriorDoor(B,0,6,0,'front'); exteriorDoor(B,0,7,0,'front'); exteriorDoor(B,0,B.W-3,B.D-1,'back');
  windows(B,{storefront:true,boardP:0.35});
  for(let u=10;u<B.W-1;u+=3) for(let v=3;v<B.D-7;v++) if(v!==Math.floor((B.D-7)/2)+1) placeFurn(B,0,u,v,'rack',false);
  for(let u=1;u<B.W-1;u+=3) placeFurn(B,0,u,B.D-6,'cooler',false);
  for(let v=2;v<9;v+=3) placeFurn(B,0,3,v,'till',false);
  furnish(B,bk,['pallet','crate','crate','pallet']);
  LANDMARK.market=B; return B;
}
function clinic(){
  const B=mkBld({x0:13,x1:33,z0:24,z1:44,front:'W',floors:2,kind:'clinic',name:'CLÍNICA PILSEN',brick:[0.7,0.68,0.62],trim:[0.2,0.42,0.5]});
  shell(B,SURF.TILE); stairs(B,0,1);
  for(let L=0;L<2;L++){
    room(B,L,0,0,4,B.D,'hall'); const types=L===0?['wait','exam','exam','office']:['exam','exam','office','exam'];
    let v=0,ti=0; while(v<B.D){ const d=Math.min(B.D-v,5); room(B,L,4,v,B.W,v+d,types[ti++%types.length]); v+=d; }
  }
  for(const R of B.rooms) if(R.type!=='hall'){ wallRoom(B,R); roomDoor(B,R,B.rooms.find(h=>h.type==='hall'&&h.L===R.L).id,0.8); }
  exteriorDoor(B,0,2,0,'front'); exteriorDoor(B,0,1,B.D-1,'back');
  windows(B,{boardP:0.3});
  for(const R of B.rooms){ if(R.type==='exam') furnish(B,R,['exam','medcab','medcab','chair']); if(R.type==='wait') furnish(B,R,['chair','chair','chair','desk','medcab']); if(R.type==='office') furnish(B,R,['desk','filing','medcab']); }
  LANDMARK.clinic=B; return B;
}
function police(){
  const B=mkBld({x0:85,x1:99,z0:-100,z1:-64,front:'W',floors:2,roof:true,kind:'police',name:'POLICE · DISTRICT 12',brick:[0.56,0.5,0.44],trim:[0.18,0.22,0.36]});
  shell(B,SURF.TILE); stairs(B,0,2);
  for(let L=0;L<2;L++){
    room(B,L,0,0,4,B.D,'hall');
    const types=L===0?['office','office','cell','cell','armory','office']:['office','office','office','locker','office'];
    let v=0,ti=0; while(v<B.D){ let d=Math.min(B.D-v,mri(5,7)); if(B.D-(v+d)<4) d=B.D-v; room(B,L,4,v,B.W,v+d,types[ti++%types.length]); v+=d; }
  }
  for(const R of B.rooms) if(R.type!=='hall'){ wallRoom(B,R); roomDoor(B,R,B.rooms.find(h=>h.type==='hall'&&h.L===R.L).id,R.type==='armory'?1:0.8); }
  exteriorDoor(B,0,2,0,'front'); exteriorDoor(B,0,1,B.D-1,'back');
  windows(B,{boardP:0.2});
  for(const R of B.rooms){
    if(R.type==='office') furnish(B,R,['desk','desk','filing','locker']);
    if(R.type==='armory'){ R.type='armory'; furnish(B,R,['gunrack','locker','locker','crate']); }
    if(R.type==='cell') furnish(B,R,['cot','toilet']);
    if(R.type==='locker') furnish(B,R,['locker','locker','locker','locker']);
  }
  LANDMARK.police=B; return B;
}
function school(){
  const B=mkBld({x0:-57,x1:-15,z0:73,z1:99,front:'N',floors:2,kind:'school',name:'BENITO JUÁREZ ELEMENTARY',brick:[0.62,0.52,0.4],trim:[0.7,0.6,0.3]});
  shell(B,SURF.TILE); stairs(B,19,9);
  for(let L=0;L<2;L++){
    room(B,L,0,9,B.W,13,'hall');
    for(let u=0;u<B.W;u+=8){ const w=Math.min(8,B.W-u); if(w<4) continue;
      if(!(u<=19&&u+w>19)) room(B,L,u,0,u+w,9,'class'); room(B,L,u,13,u+w,B.D,'class'); }
  }
  for(const R of B.rooms) if(R.type!=='hall'){ wallRoom(B,R); roomDoor(B,R,B.rooms.find(h=>h.type==='hall'&&h.L===R.L).id,0.7); }
  exteriorDoor(B,0,Math.floor(B.W/2),0,'front'); exteriorDoor(B,0,Math.floor(B.W/2)+1,0,'front'); exteriorDoor(B,0,3,B.D-1,'back');
  windows(B,{boardP:0.15});
  for(const R of B.rooms) if(R.type==='class'){
    for(let v=R.v0+1;v<R.v1-1;v+=2) for(let u=R.u0+1;u<R.u1-1;u+=2) placeFurn(B,R.L,u,v,'sdesk',false);
    furnish(B,R,['desk','shelf','locker']);
  }
  // fenced schoolyard behind it
  yard(-57,99,-15,128,'lot'); rectCells(-57,99,-15,128,(x,z,c)=>{ MAP.surf[0][c]=SURF.ASPHALT; });
  fenceLine(0,-57,128,-15,128,-36); fenceLine(0,-57,99,-57,128); fenceLine(0,-15,99,-15,128,110);
  MAP.areas.push({kind:'schoolyard',x0:-57,x1:-15,z0:99,z1:128});
  LANDMARK.school=B; return B;
}
function gasStation(){
  rectCells(-105,-23,-85,-1,(x,z,c)=>{ MAP.surf[0][c]=SURF.CONCRETE; });
  const B=mkBld({x0:-105,x1:-98,z0:-21,z1:-9,front:'E',floors:1,kind:'mart',name:'GAS · FOOD MART',brick:[0.7,0.7,0.68],trim:[0.7,0.2,0.14]});
  shell(B,SURF.TILE); room(B,0,0,0,B.W,B.D,'store');
  exteriorDoor(B,0,6,0,'front'); exteriorDoor(B,0,2,B.D-1,'back');
  windows(B,{storefront:true,boardP:0.3});
  for(let u=2;u<B.W-1;u+=3) for(let v=2;v<B.D-1;v++) placeFurn(B,0,u,v,'rack',false);
  placeFurn(B,0,B.W-1,1,'till',false); placeFurn(B,0,0,B.D-1,'cooler',false);
  MAP.areas.push({kind:'gas',x0:-97,x1:-86,z0:-20,z1:-5});
  for(const [x,z] of [[-93,-16],[-89,-16],[-93,-10],[-89,-10]]){ MAP.block[0][CI(x,z)]=BLK.PROP; MAP.props.push({kind:'pump',x,z}); }
  LANDMARK.gas=B; return B;
}
function park(){
  rectCells(13,71,59,130,(x,z,c)=>{ MAP.surf[0][c]=SURF.GRASS; });
  // paths crossing the park
  rectCells(34,71,38,130,(x,z,c)=>{ MAP.surf[0][c]=SURF.CONCRETE; });
  rectCells(13,92,59,95,(x,z,c)=>{ MAP.surf[0][c]=SURF.CONCRETE; });
  const B=mkBld({x0:40,x1:54,z0:98,z1:108,front:'W',floors:1,kind:'fieldhouse',name:'HARRISON PARK',brick:[0.64,0.5,0.38],trim:[0.3,0.36,0.26]});
  shell(B,SURF.WOOD); room(B,0,0,0,B.W,B.D,'ware');
  exteriorDoor(B,0,4,0,'front'); exteriorDoor(B,0,B.W-3,B.D-1,'back'); windows(B,{boardP:0.25});
  furnish(B,B.rooms[0],['crate','crate','workbench','shelf','locker']);
  for(let k=0;k<26;k++){ const x=mri(15,57), z=mri(73,128); const c=CI(x,z);
    if(MAP.surf[0][c]!==SURF.GRASS||MAP.bld[0][c]>=0||MAP.block[0][c]) continue; MAP.block[0][c]=BLK.PROP; MAP.props.push({kind:'tree',x,z,s:mr(.8,1.3)}); }
  for(const [x,z] of [[33,80],[39,86],[33,110],[39,118]]){ MAP.props.push({kind:'bench',x,z}); }
  MAP.areas.push({kind:'park',x0:13,x1:59,z0:71,z1:130});
  LANDMARK.park=B; return B;
}
function station(){
  const B=mkBld({x0:89,x1:105,z0:-23,z1:-13,front:'N',floors:2,roof:true,kind:'station',name:'18TH',brick:[0.5,0.48,0.46],trim:[0.7,0.3,0.5]});
  shell(B,SURF.TILE); stairs(B,1,2);
  room(B,0,0,0,B.W,B.D,'hall'); room(B,1,0,0,B.W,B.D,'hall');
  exteriorDoor(B,0,8,0,'front'); exteriorDoor(B,0,9,0,'front');
  windows(B,{boardP:0.2});
  // the elevated platform runs north over 18th along the tracks, level 2
  const L=2;
  rectCells(99,-62,105,-10,(x,z,c)=>{ MAP.floor[L][c]=1; MAP.bld[L][c]=B.id; MAP.surf[L][c]=SURF.METAL; });
  // rails around the platform's outer edges (open where it joins the station roof)
  for(let z=-62;z<-10;z++){ setEdge(L,98,z,99,z,ET.RAIL,B.id); setEdge(L,104,z,105,z,ET.RAIL,B.id); }
  for(let x=99;x<105;x++){ setEdge(L,x,-63,x,-62,ET.RAIL,B.id); setEdge(L,x,-11,x,-10,ET.RAIL,B.id); }
  for(let x=99;x<105;x++) clearEdge(L,x,-24,x,-23);
  for(let z=-23;z<-13;z++) clearEdge(L,98,z,99,z);
  for(let x=99;x<105;x++) clearEdge(L,x,-14,x,-13);
  rectCells(85,-23,89,-13,(x,z,c)=>{ MAP.surf[0][c]=SURF.CONCRETE; });
  rectCells(99,-170,105,150,(x,z,c)=>{ if(MAP.surf[0][c]===SURF.DIRT) MAP.surf[0][c]=SURF.GRASS; });
  MAP.areas.push({kind:'platform',x0:99,x1:105,z0:-62,z1:-10});
  LANDMARK.station=B; return B;
}

/* ---------- lay out the neighborhood ---------- */
baseShop(); church(); supermarket(); clinic(); police(); school(); gasStation(); park(); station();
// band 2: between 17th and 18th
lotsAlong('E',-105,-85,-109,-41,{});
lotsAlong('W',-59,-39,-109,-41,{});
lotsAlong('E',-33,-13,-109,-41,{reserve:[[-98,-62]],storeP:.5});
lotsAlong('W',13,33,-109,-41,{reserve:[[-104,-64]],storeP:.5});
lotsAlong('E',39,59,-109,-41,{});
lotsAlong('W',85,99,-109,-41,{reserve:[[-100,-64]],maxDepth:14});
// band 3: between 18th and 19th (the compound is on Wolcott between the line and 19th)
lotsAlong('E',-105,-85,-23,53,{reserve:[[-23,-1]]});
lotsAlong('W',-59,-39,-23,53,{});
lotsAlong('E',-33,-13,-23,53,{reserve:[[6,22]],cuts:[-14],storeP:.55,closedFront:true});
lotsAlong('W',13,33,-23,53,{reserve:[[24,44]],cuts:[-14],storeP:.55,closedFront:true});
lotsAlong('E',39,59,-23,53,{});
lotsAlong('W',85,99,-13,53,{maxDepth:14});
// north of 17th and south of 19th, lots face the cross streets
lotsAlong('S',-145,-127,-111,-85,{});
lotsAlong('S',-145,-127,-59,-13,{});
lotsAlong('S',-145,-127,13,59,{});
lotsAlong('S',-145,-127,85,111,{});
lotsAlong('N',71,89,-105,-85,{});
lotsAlong('N',71,89,85,105,{});

/* ---------- the outer city: tall blocks nobody goes into ---------- */
function fillTowers(x0,z0,x1,z1){
  const W=x1-x0, D=z1-z0; if(W<4||D<4) return;
  if(W>D){ let x=x0; while(x<x1){ let w=Math.min(x1-x,mri(14,30)); if(x1-(x+w)<8) w=x1-x;
      fillTowersDepth(x,z0,x+w,z1); x+=w; } }
  else { let z=z0; while(z<z1){ let d=Math.min(z1-z,mri(14,30)); if(z1-(z+d)<8) d=z1-z; fillTowersDepth(x0,z,x1,z+d); z+=d; } }
}
function fillTowersDepth(x0,z0,x1,z1){
  const W=x1-x0, D=z1-z0;
  if(W>40){ const m=x0+Math.floor(W/2); fillTowersDepth(x0,z0,m,z1); fillTowersDepth(m,z0,x1,z1); return; }
  if(D>40){ const m=z0+Math.floor(D/2); fillTowersDepth(x0,z0,x1,m); fillTowersDepth(x0,m,x1,z1); return; }
  solidBlock(x0,z0,x1,z1,mr(18,46),'tower');
}
{
  const xb=[[-200,-85],[-59,-13],[13,59],[85,200]], zb=[[-170,-127],[-109,-41],[-23,53],[71,150]];
  // west and east of the playable area
  for(const [z0,z1] of zb){ fillTowers(-200,z0,-111,z1); fillTowers(111,z0,200,z1); }
  for(const [x0,x1] of xb){
    const a=Math.max(x0,-111), b=Math.min(x1,111); if(b<=a) continue;
    fillTowers(a,-170,b,-145);
    if(a===-59||a===13) fillTowers(a,130,b,150); else fillTowers(a,89,b,150);
  }
}
// the south end of Wolcott is walled off with wrecks: the compound
MAP.compound={x0:-13,x1:13,z0:-14,z1:48};
rectCells(-13,48,13,50,(x,z,c)=>{ MAP.block[0][c]=BLK.PROP; });
// L tracks: pillars down the east alley
for(let z=-166;z<148;z+=8){ if(inEW(z)) continue; MAP.block[0][CI(107,z)]=BLK.PROP; MAP.props.push({kind:'pillar',x:107,z}); }

for(const [B,o] of WINQ) doWindows(B,o);

/* ---------- lookups ---------- */
function bldAt(L,x,z){ const cx=Math.floor(x), cz=Math.floor(z); if(!inMap(cx,cz)) return -1; return MAP.bld[L][CI(cx,cz)]; }
function surfAt(L,x,z){ const cx=Math.floor(x), cz=Math.floor(z); if(!inMap(cx,cz)) return SURF.ASPHALT; return MAP.surf[L][CI(cx,cz)]; }
function indoors(L,x,z){ const b=bldAt(L,x,z); return b>=0&&MAP.blds[b].enter&&L<MAP.blds[b].floors; }
