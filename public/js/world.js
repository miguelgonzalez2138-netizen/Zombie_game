'use strict';
// Fog Line — renders the neighborhood from MAP: ground, buildings (merged into chunks), doors, windows,
// fences, landmarks, street dressing, the barricade line and the scene lights.

const R2=mulberry(77);                       // fixed dressing so the block looks the same every run
const sr=(a,b)=>a+R2()*(b-a), spick=a=>a[Math.floor(R2()*a.length)];

/* ---------- textures ---------- */
const texBrick=canvasTex(64,64,(g,w,h)=>{
  g.fillStyle='#c8c4c0'; g.fillRect(0,0,w,h);
  for(let r=0;r<16;r++){ const off=(r%2)*8; for(let c=-1;c<5;c++){ const v=180+Math.random()*60|0;
    g.fillStyle=`rgb(${v},${v-4},${v-8})`; g.fillRect(c*16+off+1,r*4+1,14,3); } }
  speckle(g,w,h,600,'rgba(0,0,0,.18)','rgba(255,255,255,.12)');
  for(let i=0;i<4;i++){ g.fillStyle='rgba(30,26,22,.16)'; g.fillRect(Math.random()*w|0,Math.random()*h|0,3+Math.random()*8|0,10+Math.random()*30|0); }
});
const texFloor=canvasTex(32,32,(g,w,h)=>{ g.fillStyle='#d4d0cc'; g.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=8){ g.fillStyle='rgba(0,0,0,.22)'; g.fillRect(0,y,w,1); for(let k=0;k<2;k++){ g.fillRect(Math.random()*w|0,y,1,8);} }
  speckle(g,w,h,160,'rgba(0,0,0,.12)','rgba(255,255,255,.1)'); });
const texGrain=canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#d8d8d8'; g.fillRect(0,0,w,h); speckle(g,w,h,1800,'rgba(0,0,0,.22)','rgba(255,255,255,.14)');
  g.strokeStyle='rgba(0,0,0,.35)'; for(let i=0;i<3;i++){ g.beginPath(); let x=Math.random()*w,y=Math.random()*h; g.moveTo(x,y); for(let k=0;k<6;k++){ x+=rand(-8,8); y+=rand(-8,8); g.lineTo(x,y);} g.stroke(); } });
const texChain=(()=>{ const c=document.createElement('canvas'); c.width=c.height=32; const g=c.getContext('2d');
  g.strokeStyle='rgba(170,176,182,0.95)'; g.lineWidth=1;
  for(let i=-32;i<64;i+=6){ g.beginPath(); g.moveTo(i,0); g.lineTo(i+32,32); g.stroke(); g.beginPath(); g.moveTo(i,32); g.lineTo(i+32,0); g.stroke(); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.magFilter=THREE.NearestFilter; return t; })();

/* ---------- materials (everything on a building carries a building id for cutaways) ---------- */
const matExt=cutPatch(phong({map:texBrick,vertexColors:true}));
const matPlain=cutPatch(phong({vertexColors:true}));
const matFloorV=cutPatch(phong({map:texFloor,vertexColors:true}));
const matRoofV=cutPatch(phong({map:texRoof,vertexColors:true}));
const matFacV=texFacade.map(t=>cutPatch(phong({map:t,vertexColors:true})));
const matGroundV=new THREE.MeshPhongMaterial({map:texGrain,vertexColors:true,specular:0x1c2024,shininess:22});

/* ---------- ground ---------- */
const SURF_COL={[SURF.ASPHALT]:[.17,.18,.2],[SURF.CONCRETE]:[.42,.43,.44],[SURF.GRASS]:[.2,.25,.16],[SURF.DIRT]:[.27,.24,.2],[SURF.GRAVEL]:[.36,.35,.32],
  [SURF.ALLEY]:[.3,.3,.31],[SURF.WOOD]:[.42,.32,.22],[SURF.TILE]:[.52,.52,.5],[SURF.CARPET]:[.36,.3,.3],[SURF.METAL]:[.32,.33,.34],[SURF.ROOF]:[.34,.34,.35]};
{
  const gb=new GB(0.25);
  for(let z=GZ0;z<GZ0+GH;z++){
    let x=GX0;
    while(x<GX0+GW){
      const c=CI(x,z), s=MAP.surf[0][c], solid=MAP.block[0][c]===BLK.SOLID, inside=MAP.bld[0][c]>=0&&!solid;
      let x2=x+1; while(x2<GX0+GW){ const c2=CI(x2,z); if(MAP.surf[0][c2]!==s||(MAP.block[0][c2]===BLK.SOLID)!==solid||(MAP.bld[0][c2]>=0&&MAP.block[0][c2]!==BLK.SOLID)!==inside) break; x2++; }
      if(!solid&&!inside){ const col=SURF_COL[s]||SURF_COL[0], y=s===SURF.CONCRETE?0.06:s===SURF.GRASS?0.02:0;
        gb.quad([x,y,z+1],[x2,y,z+1],[x2,y,z],[x,y,z],0,1,0,col,CUT_NONE,[x*.25,(z+1)*.25,x2*.25,(z+1)*.25,x2*.25,z*.25,x*.25,z*.25]); }
      x=x2;
    }
  }
  const m=new THREE.Mesh(gb.build(),matGroundV); m.receiveShadow=true; scene.add(m);
  // curbs and lane markings
  const cb=new GB(0.5), curbCol=[.46,.47,.48];
  for(const s of ST_NS) for(const xs of [s.x-s.h+SIDEWALK,s.x+s.h-SIDEWALK]){
    let z=GZ0; while(z<GZ0+GH){ if(inEW(z)){ z++; continue; } let z2=z; while(z2<GZ0+GH&&!inEW(z2)) z2++; cb.box(xs-0.12,0,z,xs+0.12,0.15,z2,curbCol,CUT_NONE); z=z2; } }
  for(const s of ST_EW) for(const zs of [s.z-s.h+SIDEWALK,s.z+s.h-SIDEWALK]){
    let x=GX0; while(x<GX0+GW){ if(inNS(x)){ x++; continue; } let x2=x; while(x2<GX0+GW&&!inNS(x2)) x2++; cb.box(x,0,zs-0.12,x2,0.15,zs+0.12,curbCol,CUT_NONE); x=x2; } }
  const lane=[.48,.42,.2];
  for(const s of ST_NS) for(let z=GZ0;z<GZ0+GH;z+=7){ if(inEW(z)||inEW(z+3)) continue; cb.box(s.x-0.09,0.005,z,s.x+0.09,0.02,z+3,lane,CUT_NONE); }
  for(const s of ST_EW) for(let x=GX0;x<GX0+GW;x+=7){ if(inNS(x)||inNS(x+3)) continue; cb.box(x,0.005,s.z-0.09,x+3,0.02,s.z+0.09,lane,CUT_NONE); }
  // crosswalks at the corners
  for(const a of ST_NS) for(const b of ST_EW) for(const sgn of [-1,1]){
    const z0=b.z+sgn*(b.h+0.5); for(let x=a.x-a.h+SIDEWALK+0.5;x<a.x+a.h-SIDEWALK-0.5;x+=1.2) cb.box(x,0.005,Math.min(z0,z0+sgn*2.5),x+0.6,0.02,Math.max(z0,z0+sgn*2.5),[.5,.5,.48],CUT_NONE);
  }
  const cm=new THREE.Mesh(cb.build(),matPlain); cm.receiveShadow=true; scene.add(cm);
}

/* ---------- buildings, merged per 50m chunk ---------- */
const CHUNK=50, chunks=new Map();
function chunkOf(x,z){ const k=Math.floor((x-GX0)/CHUNK)+'_'+Math.floor((z-GZ0)/CHUNK); let c=chunks.get(k);
  if(!c){ c={ext:new GB(0.5),plain:new GB(0.5),floor:new GB(1),roof:new GB(0.25),fac:[0,1,2].map(()=>new GB(1))}; chunks.set(k,c); } return c; }
const tint=(c,k)=>[c[0]*k,c[1]*k,c[2]*k];
const mixc=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];

// geometry for one edge between two cells: a slab of wall from y0 to y1, faces routed so the
// outdoor side is brick and the indoor side is plaster
function edgeLine(e){ const x=ED.x[e], z=ED.z[e]; return ED.d[e]===0?{x0:x+1,z0:z,x1:x+1,z1:z+1,ax:'x'}:{x0:x,z0:z+1,x1:x+1,z1:z+1,ax:'z'}; }
function edgeCells(e){ const x=ED.x[e], z=ED.z[e]; return ED.d[e]===0?[[x,z],[x+1,z]]:[[x,z],[x,z+1]]; }
function wallPiece(C,e,y0,y1,T,outCol,inCol,bid,inSide,interior){
  const l=edgeLine(e), h=T/2, ext=T/2;
  let x0,x1,z0,z1;
  if(l.ax==='x'){ x0=l.x0-h; x1=l.x0+h; z0=l.z0-ext; z1=l.z1+ext; } else { x0=l.x0-ext; x1=l.x1+ext; z0=l.z0-h; z1=l.z0+h; }
  if(interior){ C.plain.box(x0,y0,z0,x1,y1,z1,inCol,bid); return; }
  // inSide: 0 = the first cell (west/north) is inside, 1 = the second is
  const inFace=l.ax==='x'?(inSide===0?'nx':'px'):(inSide===0?'nz':'pz');
  const all=['px','nx','pz','nz','py'];
  C.ext.box(x0,y0,z0,x1,y1,z1,outCol,bid,{skip:inFace});
  C.plain.box(x0,y0,z0,x1,y1,z1,inCol,bid,{skip:all.filter(f=>f!==inFace).join(',')});
}
// glass, boards, door leaves, gates and fence panels are instanced so they can change state
const EI={glass:new Int32Array(EMAX).fill(-1),board:new Int32Array(EMAX).fill(-1),leaf:new Int32Array(EMAX).fill(-1),fence:new Int32Array(EMAX).fill(-1)};
const OPEN={};   // per edge: {cx,cy,cz,w,h,ax,out}
const edgeList={glass:[],board:[],leaf:[],gate:[],fence:[]};
function opening(e,y0,yb,yt,ax,out){ const l=edgeLine(e); OPEN[e]={x:(l.x0+l.x1)/2,z:(l.z0+l.z1)/2,yb:y0+yb,yt:y0+yt,ax:l.ax,out,l}; }

function renderBuilding(B){
  const cx=(B.x0+B.x1)/2, cz=(B.z0+B.z1)/2, C=chunkOf(cx,cz), bid=B.id;
  if(!B.enter){ renderSolid(B,C); return; }
  const brick=B.brick, plaster=B.plaster, trim=B.trim;
  const floorsH=B.floors===1?B.wallH:LH;
  // floors
  for(let L=0;L<=B.floors;L++){
    const roofL=L===B.floors; if(roofL&&!B.roof) continue;
    for(let z=B.z0;z<B.z1;z++){
      let x=B.x0;
      while(x<B.x1){
        const c=CI(x,z); const ok=MAP.floor[L][c]&&MAP.bld[L][c]===bid; const s=MAP.surf[L][c];
        let x2=x+1; while(x2<B.x1){ const c2=CI(x2,z); if((MAP.floor[L][c2]&&MAP.bld[L][c2]===bid)!==ok||MAP.surf[L][c2]!==s) break; x2++; }
        if(ok){ const y=L===0?0:(roofL?B.floors*floorsH:L*LH); const col=SURF_COL[s]||[.4,.4,.4];
          if(L===0) C.floor.box(x,0,z,x2,0.05,z+1,col,bid);
          else (roofL?C.roof:C.floor).box(x,y-0.3,z,x2,y+0.02,z+1,roofL?[.42,.42,.43]:col,bid,{faces:{nx:tint(plaster,.8),px:tint(plaster,.8),nz:tint(plaster,.8),pz:tint(plaster,.8)}}); }
        x=x2;
      }
    }
  }
  // roof slab when the roof isn't walkable
  if(!B.roof){ const y=B.floors*floorsH; C.roof.box(B.x0,y-0.3,B.z0,B.x1,y+0.05,B.z1,[.4,.4,.42],bid);
    for(const [a,b,c2,d] of [[B.x0,B.z0,B.x1,B.z0+0.3],[B.x0,B.z1-0.3,B.x1,B.z1],[B.x0,B.z0,B.x0+0.3,B.z1],[B.x1-0.3,B.z0,B.x1,B.z1]]) C.ext.box(a,y,b,c2,y+0.6,d,brick,bid);
    const n=1+Math.floor(R2()*3);
    for(let i=0;i<n;i++){ const w=sr(1,2.2), d=sr(1,2.2); if(B.x1-B.x0<w+2||B.z1-B.z0<d+2) continue; const x=sr(B.x0+1,B.x1-w-1), z=sr(B.z0+1,B.z1-d-1);
      C.plain.box(x,y,z,x+w,y+sr(.6,1.2),z+d,spick([[.5,.52,.54],[.42,.43,.44],[.6,.6,.58]]),bid); }
    if(B.kind==='church'){ // pitched roof
      const y2=y+5, mz=(B.z0+B.z1)/2, col=[.28,.24,.22];
      C.roof.quad([B.x0,y,B.z1],[B.x1,y,B.z1],[B.x1,y2,mz],[B.x0,y2,mz],0,0.7,0.7,col,bid);
      C.roof.quad([B.x1,y,B.z0],[B.x0,y,B.z0],[B.x0,y2,mz],[B.x1,y2,mz],0,0.7,-0.7,col,bid);
      C.ext.quad([B.x0,y,B.z0],[B.x0,y,B.z1],[B.x0,y2,mz],[B.x0,y2,mz],-1,0,0,brick,bid);
      C.ext.quad([B.x1,y,B.z1],[B.x1,y,B.z0],[B.x1,y2,mz],[B.x1,y2,mz],1,0,0,brick,bid);
    }
  }
  // stairs: steps climbing across each flight's upper cells
  for(const f of B.flights){
    const y0=f.L*LH, xs=f.st.map(p=>p[0]), zs=f.st.map(p=>p[1]), ex=f.en.map(p=>p[0]), ez=f.en.map(p=>p[1]);
    const mnx=Math.min(...xs,...ex), mxx=Math.max(...xs,...ex)+1, mnz=Math.min(...zs,...ez), mxz=Math.max(...zs,...ez)+1;
    const N=8, wood=[.38,.3,.22];
    for(let i=0;i<N;i++){
      const a=(i)/N, b=(i+1)/N, h=y0+LH*(i+1)/N;
      // steps occupy the far half (st cells) of the flight footprint
      let x0,x1,z0,z1;
      if(f.dx>0){ x0=mnx+2+2*a; x1=mnx+2+2*b; z0=mnz; z1=mxz; } else if(f.dx<0){ x1=mxx-2-2*a; x0=mxx-2-2*b; z0=mnz; z1=mxz; }
      else if(f.dz>0){ z0=mnz+2+2*a; z1=mnz+2+2*b; x0=mnx; x1=mxx; } else { z1=mxz-2-2*a; z0=mxz-2-2*b; x0=mnx; x1=mxx; }
      C.plain.box(x0,y0,z0,x1,h,z1,tint(wood,0.85+0.15*(i%2)),bid);
    }
  }
  // furniture
  for(const f of MAP.furn){ if(!f||f.b!==bid) continue; furnGeo(C,f,bid); }
}
function furnGeo(C,f,bid){
  const y=f.L*LH, i=0.06, x0=f.x0+i, x1=f.x1-i, z0=f.z0+i, z1=f.z1-i, col=f.col;
  const P=(a,b,c,d,e,g,k)=>C.plain.box(a,b,c,d,e,g,k,bid);
  switch(f.type){
    case 'bed': case 'bed1': P(x0,y,z0,x1,y+0.3,z1,[.32,.26,.2]); P(x0+.04,y+.3,z0+.04,x1-.04,y+.55,z1-.04,col);
      { const w=x1-x0>z1-z0; if(w) P(x0+.1,y+.55,z0+.1,x0+.5,y+.65,z1-.1,[.82,.8,.76]); else P(x0+.1,y+.55,z0+.1,x1-.1,y+.65,z0+.5,[.82,.8,.76]); } break;
    case 'couch': P(x0,y,z0,x1,y+.45,z1,col); { const w=x1-x0>z1-z0; if(w) P(x0,y+.45,z0,x1,y+.85,z0+.25,tint(col,.85)); else P(x0,y+.45,z0,x0+.25,y+.85,z1,tint(col,.85)); } break;
    case 'tv': P(x0+.1,y,z0+.1,x1-.1,y+.5,z1-.1,[.3,.24,.18]); P(x0+.2,y+.5,z0+.35,x1-.2,y+.95,z1-.35,[.06,.07,.08]); break;
    case 'shelf': case 'rack': P(x0,y,z0,x1,y+f.h,z1,col,);
      for(let k=1;k<4;k++) P(x0-.02,y+f.h*k/4,z0-.02,x1+.02,y+f.h*k/4+.04,z1+.02,tint(col,1.25)); break;
    case 'fridge': case 'cooler': P(x0,y,z0,x1,y+f.h,z1,col); P(x0+.1,y+f.h*.5,z0-.02,x0+.16,y+f.h*.8,z1+.02,[.3,.3,.3]); break;
    case 'table': case 'ctable': case 'sdesk': P(x0+.05,y+f.h-.06,z0+.05,x1-.05,y+f.h,z1-.05,col);
      for(const [a,b] of [[x0+.08,z0+.08],[x1-.14,z0+.08],[x0+.08,z1-.14],[x1-.14,z1-.14]]) P(a,y,b,a+.06,y+f.h-.06,b+.06,tint(col,.7)); break;
    case 'pew': P(x0,y,z0+.1,x1,y+.45,z1-.3,col); P(x0,y+.45,z1-.3,x1,y+.95,z1-.15,tint(col,.85)); break;
    case 'cot': P(x0+.08,y,z0+.05,x1-.08,y+.42,z1-.05,col); P(x0+.12,y+.42,z0+.08,x1-.12,y+.5,z0+.5,[.55,.52,.44]); break;
    case 'workbench': P(x0,y+.85,z0,x1,y+.95,z1,col); P(x0+.05,y,z0+.05,x1-.05,y+.85,z1-.05,tint(col,.6));
      P(x0+.3,y+.95,z0+.3,x0+.6,y+1.15,z0+.5,[.5,.2,.15]); break;
    case 'gunrack': P(x0,y,z0,x1,y+f.h,z1,col); for(let k=0;k<5;k++) P(x0+.15+k*.35,y+.3,z0-.05,x0+.22+k*.35,y+1.5,z0,[.1,.1,.1]); break;
    case 'altar': P(x0,y,z0,x1,y+1.0,z1,col); P(x0-.05,y+1.0,z0-.05,x1+.05,y+1.1,z1+.05,[.82,.8,.74]); break;
    case 'tub': P(x0,y,z0,x1,y+.55,z1,col); P(x0+.1,y+.2,z0+.1,x1-.1,y+.56,z1-.1,[.6,.66,.7]); break;
    default: P(x0,y,z0,x1,y+f.h,z1,col);
  }
  if(f.radio){ P(x0+.2,y+f.h,z0+.25,x0+.55,y+f.h+.22,z0+.5,[.2,.24,.18]); P(x0+.45,y+f.h+.22,z0+.4,x0+.48,y+f.h+1.0,z0+.43,[.1,.1,.1]); }
  if(f.stove){ P(x0+.2,y+f.h,z0+.2,x1-.2,y+f.h+.05,z1-.2,[1,.55,.2]); }
}
function renderSolid(B,C){
  const v=Math.floor(R2()*3), h=B.h, bid=B.id, fac=C.fac[v];
  const x0=B.x0,x1=B.x1,z0=B.z0,z1=B.z1, sx=x1-x0, sz=z1-z0;
  const ou=Math.floor(R2()*8)/8, ov=Math.floor(R2()*16)/16, col=spick([[1,1,1],[.92,.94,.98],[1,.97,.92],[.88,.9,.92]]);
  fac.quad([x0,0,z1],[x1,0,z1],[x1,h,z1],[x0,h,z1],0,0,1,col,bid,[ou,ov,ou+sx/32,ov,ou+sx/32,ov+h/56,ou,ov+h/56]);
  fac.quad([x1,0,z0],[x0,0,z0],[x0,h,z0],[x1,h,z0],0,0,-1,col,bid,[ou+.25,ov,ou+.25+sx/32,ov,ou+.25+sx/32,ov+h/56,ou+.25,ov+h/56]);
  fac.quad([x1,0,z1],[x1,0,z0],[x1,h,z0],[x1,h,z1],1,0,0,col,bid,[ou+.5,ov,ou+.5+sz/32,ov,ou+.5+sz/32,ov+h/56,ou+.5,ov+h/56]);
  fac.quad([x0,0,z0],[x0,0,z1],[x0,h,z1],[x0,h,z0],-1,0,0,col,bid,[ou+.75,ov,ou+.75+sz/32,ov,ou+.75+sz/32,ov+h/56,ou+.75,ov+h/56]);
  C.roof.box(x0,h-0.05,z0,x1,h,z1,[.42,.42,.44],bid,{skip:'px,nx,pz,nz'});
  const n=1+Math.floor(R2()*3);
  for(let i=0;i<n;i++){ const w=sr(1.2,4), d=sr(1.2,4); if(sx<w+2||sz<d+2) continue; const x=sr(x0+1,x1-w-1), z=sr(z0+1,z1-d-1);
    C.plain.box(x,h,z,x+w,h+sr(.8,3),z+d,spick([[.5,.52,.54],[.42,.43,.44],[.62,.62,.6]]),bid); }
  if(B.steeple){ const cx=(x0+x1)/2, cz=(z0+z1)/2, top=h+9;
    for(const [a,b,c,d,nx,nz] of [[[x0,h,z1],[x1,h,z1],[cx,top,cz],[cx,top,cz],0,1],[[x1,h,z0],[x0,h,z0],[cx,top,cz],[cx,top,cz],0,-1],[[x1,h,z1],[x1,h,z0],[cx,top,cz],[cx,top,cz],1,0],[[x0,h,z0],[x0,h,z1],[cx,top,cz],[cx,top,cz],-1,0]])
      C.roof.quad(a,b,c,d,nx,.6,nz,[.3,.34,.3],bid);
    C.plain.box(cx-.08,top,cz-.08,cx+.08,top+2,cz+.08,[.7,.66,.5],bid); C.plain.box(cx-.5,top+1.2,cz-.08,cx+.5,top+1.4,cz+.08,[.7,.66,.5],bid);
  }
}
// walls, openings, rails and fences from the edge table
function renderEdges(){
  for(let e=1;e<EN;e++){
    const t=ED.t[e], k=ED.k[e], b=ED.b[e], L=ED.L[e];
    if(t===ET.NONE&&k===EK.WALL) continue;
    const [A,Bc]=edgeCells(e); const l=edgeLine(e);
    const C=chunkOf((l.x0+l.x1)/2,(l.z0+l.z1)/2);
    if(b<0){ // fences and gates in yards
      if(t===ET.FENCE||(k===EK.GATE)) fenceEdge(C,e,k===EK.GATE);
      continue;
    }
    const B=MAP.blds[b], y0=L*LH, wh=B.floors===1?B.wallH:LH, roofL=L===B.floors;
    const cA=inMap(A[0],A[1])?CI(A[0],A[1]):-1, cB=inMap(Bc[0],Bc[1])?CI(Bc[0],Bc[1]):-1;
    const inA=cA>=0&&MAP.bld[L][cA]===b, inB=cB>=0&&MAP.bld[L][cB]===b;
    const interior=inA&&inB;
    if(t===ET.RAIL){
      if(B.kind==='station'&&L===2&&!(inA&&inB&&false)){ railEdge(C,e,y0,b); continue; }
      wallPiece(C,e,y0,y0+0.9,0.3,B.brick,B.brick,b,inA?0:1,false); C.plain.box(...railCap(e,y0+0.9),tint(B.trim,.9),b); continue;
    }
    const inSide=inA?0:1, outCol=B.brick, inCol=interior?B.plaster:tint(B.plaster,0.95);
    const T=interior?0.16:0.3;
    if(k===EK.WALL){
      if(t===ET.NONE) continue;
      wallPiece(C,e,y0,y0+wh,T,outCol,inCol,b,inSide,interior); continue;
    }
    if(k===EK.WIN||k===EK.SHOPWIN){
      const tall=wh>5, sill=k===EK.SHOPWIN?0.4:tall?1.2:0.9, lint=k===EK.SHOPWIN?2.9:tall?wh-1.4:2.25;
      wallPiece(C,e,y0,y0+sill,T,outCol,inCol,b,inSide,interior);
      wallPiece(C,e,y0+lint,y0+wh,T,outCol,inCol,b,inSide,interior);
      opening(e,y0,sill,lint,l.ax,inSide===0?1:-1);
      trimFrame(C,e,y0+sill,y0+lint,B.trim,b,inSide===0?1:-1,k===EK.SHOPWIN);
      edgeList.glass.push(e); edgeList.board.push(e);
      continue;
    }
    if(k===EK.DOOR||k===EK.GATE){
      const lint=Math.min(2.3,wh-0.2);
      wallPiece(C,e,y0+lint,y0+wh,T,outCol,inCol,b,inSide,interior);
      opening(e,y0,0,lint,l.ax,inSide===0?1:-1);
      if(!interior) trimFrame(C,e,y0,y0+lint,B.trim,b,inSide===0?1:-1,false,true);
      edgeList.leaf.push(e); edgeList.board.push(e);
    }
  }
}
function railCap(e,y){ const l=edgeLine(e); return l.ax==='x'?[l.x0-.2,y,l.z0-.15,l.x0+.2,y+.08,l.z1+.15]:[l.x0-.15,y,l.z0-.2,l.x1+.15,y+.08,l.z0+.2]; }
function railEdge(C,e,y0,b){
  const l=edgeLine(e), col=[.4,.42,.44];
  if(l.ax==='x'){ C.plain.box(l.x0-.04,y0,l.z0,l.x0+.04,y0+1.0,l.z0+.08,col,b); C.plain.box(l.x0-.04,y0+.95,l.z0,l.x0+.04,y0+1.05,l.z1,col,b); C.plain.box(l.x0-.03,y0+.5,l.z0,l.x0+.03,y0+.56,l.z1,col,b); }
  else { C.plain.box(l.x0,y0,l.z0-.04,l.x0+.08,y0+1.0,l.z0+.04,col,b); C.plain.box(l.x0,y0+.95,l.z0-.04,l.x1,y0+1.05,l.z0+.04,col,b); C.plain.box(l.x0,y0+.5,l.z0-.03,l.x1,y0+.56,l.z0+.03,col,b); }
}
function trimFrame(C,e,yb,yt,col,b,out,shop,door){
  const l=edgeLine(e), o=0.17*out, t=0.06;
  if(l.ax==='x'){
    const x=l.x0+o;
    if(!door) C.plain.box(x-.08,yb-.06,l.z0,x+.08,yb,l.z1,col,b);
    C.plain.box(x-.04,yt,l.z0,x+.04,yt+.1,l.z1,col,b);
    C.plain.box(x-.04,yb,l.z0,x+.04,yt,l.z0+t,col,b); C.plain.box(x-.04,yb,l.z1-t,x+.04,yt,l.z1,col,b);
  } else {
    const z=l.z0+o;
    if(!door) C.plain.box(l.x0,yb-.06,z-.08,l.x1,yb,z+.08,col,b);
    C.plain.box(l.x0,yt,z-.04,l.x1,yt+.1,z+.04,col,b);
    C.plain.box(l.x0,yb,z-.04,l.x0+t,yt,z+.04,col,b); C.plain.box(l.x1-t,yb,z-.04,l.x1,yt,z+.04,col,b);
  }
}
function fenceEdge(C,e,gate){
  const l=edgeLine(e), col=[.5,.52,.54];
  C.plain.box(l.x0-.04,0,l.z0-.04,l.x0+.04,1.95,l.z0+.04,col,CUT_NONE);
  C.plain.box(l.x1-.04,0,l.z1-.04,l.x1+.04,1.95,l.z1+.04,col,CUT_NONE);
  if(l.ax==='x') C.plain.box(l.x0-.025,1.88,l.z0,l.x0+.025,1.93,l.z1,col,CUT_NONE); else C.plain.box(l.x0,1.88,l.z0-.025,l.x1,1.93,l.z0+.025,col,CUT_NONE);
  OPEN[e]={x:(l.x0+l.x1)/2,z:(l.z0+l.z1)/2,yb:0,yt:1.9,ax:l.ax,out:1,l};
  if(gate) edgeList.gate.push(e); else edgeList.fence.push(e);
}

for(const B of MAP.blds) renderBuilding(B);
renderEdges();
for(const [k,c] of chunks){
  const add=(gb,m,cast=true)=>{ if(gb.empty) return; const mesh=new THREE.Mesh(gb.build(),m); mesh.castShadow=cast; mesh.receiveShadow=true; scene.add(mesh); };
  add(c.ext,matExt); add(c.plain,matPlain); add(c.floor,matFloorV,false); add(c.roof,matRoofV); c.fac.forEach((g,i)=>add(g,matFacV[i]));
}

/* ---------- instanced doors, glass, boards, fences ---------- */
function instPool(geo,mat,list,shadow){
  const im=new THREE.InstancedMesh(geo,mat,Math.max(1,list.length));
  const bid=new Float32Array(Math.max(1,list.length));
  list.forEach((e,i)=>{ bid[i]=ED.b[e]>=0?ED.b[e]:CUT_NONE; });
  geo.setAttribute('bid',new THREE.InstancedBufferAttribute(bid,1));
  im.castShadow=!!shadow; im.receiveShadow=true; im.frustumCulled=false; scene.add(im); return im;
}
const matGlassI=cutPatch(new THREE.MeshPhongMaterial({color:0x141a22,specular:0x8a98aa,shininess:80,transparent:true,opacity:.82}));
const matBoardI=cutPatch(phong({map:canvasTex(16,16,(g,w,h)=>{ g.fillStyle='#8a7a5a'; g.fillRect(0,0,w,h); speckle(g,w,h,60,'rgba(0,0,0,.2)','rgba(255,255,255,.1)'); })}));
const matLeafI=cutPatch(phong({color:0x5a4230}));
const matChain=cutPatch(new THREE.MeshPhongMaterial({map:texChain,transparent:true,alphaTest:0.4,color:0xa8aeb4,shininess:30,specular:0x606468}));
const geoBoard=(()=>{ const g=new GB(1); for(const [y,r] of [[-.38,.04],[-.02,-.06],[.32,.05]]) g.box(-.56,y,-.025,.56,y+.2,.025,[1,1,1],0,{faces:{}}); const geo=g.build(); geo.deleteAttribute('bid'); geo.deleteAttribute('color'); return geo; })();
const glassIM=instPool(new THREE.PlaneGeometry(1,1),matGlassI,edgeList.glass,false);
const boardIM=instPool(geoBoard,matBoardI,edgeList.board,true);
const leafIM=instPool(new THREE.BoxGeometry(1,1,1).translate(.5,.5,0),matLeafI,edgeList.leaf,true);
const gateIM=instPool(new THREE.PlaneGeometry(1,1).translate(.5,.5,0),matChain,edgeList.gate,false);
const fenceIM=instPool(new THREE.PlaneGeometry(1,1).translate(0,.5,0),matChain,edgeList.fence,false);
edgeList.glass.forEach((e,i)=>EI.glass[e]=i); edgeList.board.forEach((e,i)=>EI.board[e]=i);
edgeList.leaf.forEach((e,i)=>EI.leaf[e]=i); edgeList.gate.forEach((e,i)=>EI.leaf[e]=i); edgeList.fence.forEach((e,i)=>EI.fence[e]=i);
const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _s=new THREE.Vector3(), _p=new THREE.Vector3(), _eu=new THREE.Euler();
function setInst(im,i,x,y,z,ry,sx,sy,sz){ if(i<0) return; if(sx===0){ im.setMatrixAt(i,zeroMat); } else { _p.set(x,y,z); _eu.set(0,ry,0); _q.setFromEuler(_eu); _s.set(sx,sy,sz); _m.compose(_p,_q,_s); im.setMatrixAt(i,_m); } im.instanceMatrix.needsUpdate=true; }
const zeroMat=new THREE.Matrix4().makeScale(0,0,0);
function refreshEdge(e){
  const O=OPEN[e]; if(!O) return; const t=ED.t[e], k=ED.k[e];
  const ry=O.ax==='x'?Math.PI/2:0, h=O.yt-O.yb, yc=(O.yb+O.yt)/2;
  const ox=O.ax==='x'?O.out*0.2:0, oz=O.ax==='z'?O.out*0.2:0;
  if(EI.glass[e]>=0) setInst(glassIM,EI.glass[e],O.x+ox*.2,yc,O.z+oz*.2,ry,t===ET.WIN?0.92:0,h,1);
  if(EI.board[e]>=0){ const on=t===ET.BOARD; setInst(boardIM,EI.board[e],O.x+ox,yc,O.z+oz,ry,on?1:0,h,1); }
  if(EI.fence[e]>=0) setInst(fenceIM,EI.fence[e],O.x,0,O.z,ry,t===ET.FENCE?1:0,1.9,1);
  if(EI.leaf[e]>=0){
    const show=t===ET.DOOR||t===ET.DOPEN, hg=ED.hinge[e], ang=ED.open[e]*Math.PI*0.5*hg;
    // leaf runs along the edge from the hinge corner
    let hx,hz,base;
    if(O.ax==='x'){ hx=O.l.x0; hz=hg>0?O.l.z0:O.l.z1; base=hg>0?-Math.PI/2:Math.PI/2; }
    else { hz=O.l.z0; hx=hg>0?O.l.x0:O.l.x1; base=hg>0?0:Math.PI; }
    const im=k===EK.GATE?gateIM:leafIM;
    setInst(im,EI.leaf[e],hx,O.yb,hz,base+ang,show?0.96:0,k===EK.GATE?1.8:h-0.05,k===EK.GATE?1:0.05);
  }
}
for(const list of Object.values(edgeList)) for(const e of list) refreshEdge(e);
const swinging=new Set();
EDGE_HOOKS.changed=(e)=>{ if(EI.leaf[e]>=0) swinging.add(e); refreshEdge(e); if(typeof minimapDirty!=='undefined') minimapDirty=true; };
for(let e=1;e<EN;e++) if(ED.t[e]===ET.DOPEN){ ED.open[e]=1; refreshEdge(e); }
function updateDoors(dt){
  for(const e of swinging){ const tgt=ED.t[e]===ET.DOPEN?1:0; const v=ED.open[e]+Math.sign(tgt-ED.open[e])*dt*4.5;
    ED.open[e]=tgt>ED.open[e]?Math.min(tgt,v):Math.max(tgt,v); refreshEdge(e); if(ED.open[e]===tgt) swinging.delete(e); }
}

/* ---------- text textures (signs, graffiti, painted messages) ---------- */
function textTex(w,h,draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); draw(g,w,h);
  const t=new THREE.CanvasTexture(c); t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter; t.anisotropy=4; return t; }
function fitText(g,text,w,maxPx,font){ let px=maxPx; do{ g.font=font.replace('PX',px+'px'); px-=2; } while(g.measureText(text).width>w&&px>8); }
function sprayTex(text,col,opts={}){
  return textTex(512,160,(g,w,h)=>{
    g.textAlign='center'; g.textBaseline='middle';
    const lines=text.split('\n'), lh=h/(lines.length+0.4);
    lines.forEach((ln,k)=>{
      fitText(g,ln,w-30,opts.px||110,(opts.weight||'bold')+' PX '+(opts.font||'Impact, "Arial Black", sans-serif'));
      const y=lh*(k+0.7);
      g.save(); g.translate(w/2,y); g.rotate(opts.tilt??sr(-.06,.06));
      g.globalAlpha=0.9; g.lineJoin='round'; g.strokeStyle=col; g.lineWidth=opts.stroke||3; g.fillStyle=col;
      if(opts.outline){ g.strokeStyle=opts.outline; g.lineWidth=10; g.strokeText(ln,0,0); }
      g.fillText(ln,0,0); g.restore();
      g.fillStyle=col; for(let d=0;d<ln.length*0.8;d++){ const x=w/2+sr(-0.45,0.45)*g.measureText(ln).width, l=sr(6,28); g.globalAlpha=0.6; g.fillRect(x,y+lh*0.3,2,l); }
    });
  });
}
const decalMat=(tex,opts={})=>cutPatch(new THREE.MeshPhongMaterial(Object.assign({map:tex,transparent:true,alphaTest:0.08,depthWrite:false,shininess:0,specular:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2},opts)));
// a decal on a vertical face: (x,z) on the wall line, normal (nx,nz) pointing out
function facadeDecal(tex,x,y,z,nx,nz,w,h,bid,opts){
  const g=new THREE.PlaneGeometry(w,h); const ba=new Float32Array(4).fill(bid??CUT_NONE); g.setAttribute('bid',new THREE.BufferAttribute(ba,1));
  const m=new THREE.Mesh(g,decalMat(tex,opts)); m.position.set(x+nx*0.17,y,z+nz*0.17); m.rotation.y=Math.atan2(nx,nz); onCharLayer(m); scene.add(m); return m;
}
function groundDecal(tex,x,z,w,h,rot,opts){ const g=new THREE.PlaneGeometry(w,h); g.setAttribute('bid',new THREE.BufferAttribute(new Float32Array(4).fill(CUT_NONE),1));
  const m=new THREE.Mesh(g,decalMat(tex,opts)); m.rotation.x=-Math.PI/2; m.rotation.z=rot||0; m.position.set(x,0.07,z); onCharLayer(m); scene.add(m); return m; }
// the outward face of a building's front: point, normal, along-vector
function frontFace(B){
  switch(B.front){
    case 'E': return {x:B.x1,z:(B.z0+B.z1)/2,nx:1,nz:0,ax:0,az:1,len:B.z1-B.z0};
    case 'W': return {x:B.x0,z:(B.z0+B.z1)/2,nx:-1,nz:0,ax:0,az:-1,len:B.z1-B.z0};
    case 'N': return {x:(B.x0+B.x1)/2,z:B.z0,nx:0,nz:-1,ax:1,az:0,len:B.x1-B.x0};
    default:  return {x:(B.x0+B.x1)/2,z:B.z1,nx:0,nz:1,ax:-1,az:0,len:B.x1-B.x0};
  }
}

/* ---------- signs, awnings, graffiti, messages ---------- */
const AWN=[0x6a2a24,0x2a4a3a,0x2c3e5a,0x7a6a2a,0x5a2a4a,0x3a3a3a];
const SIGN_COL=[['#7a2a22','#e8d8b0'],['#2a4a6a','#e8e4d8'],['#c8a030','#3a1a10'],['#2a6a4a','#f0f0e8'],['#1a1c22','#d84a4a'],['#6a1a1a','#f0d070'],['#e0c890','#6a2a1a'],['#e8e4dc','#2a3a6a'],['#2a8a4a','#f8f0a0'],['#a03a2a','#f0e0b0'],['#1a3a6a','#f0d050']];
const BOARD_MSG=['NO ONE\nINSIDE','DEAD\nINSIDE','THEY FOLLOW\nNOISE','DONT GO\nNORTH','MARIA + KIDS\n→ ST PIUS','WATER\nINSIDE →','EVAC\nCANCELLED?','STILL HERE\nDAY 9','KEEP\nQUIET','2 ALIVE','SHOOT\nTHE HEAD','GONE TO\nTHE LAKE'];
const TAGS=['KOZE','REYNA','SPOOK','ZURDO','NOX','BEBO','LTD','MOTA','SK8','ROJO','PILSEN','18ST'];
const TAG_COL=['#e05aa0','#4ac0b8','#f0f0e8','#d84a3a','#e8d050','#8a6ad8'];
function signTex(name,bg,fg){ return textTex(512,96,(g,w,h)=>{ g.fillStyle=bg; g.fillRect(0,0,w,h); g.fillStyle=fg; g.textAlign='center'; g.textBaseline='middle';
  fitText(g,name,w-36,66,'bold PX Impact, "Arial Black", sans-serif'); g.fillText(name,w/2,h/2+2);
  g.globalCompositeOperation='destination-out'; for(let i=0;i<26;i++){ g.globalAlpha=sr(.1,.5); g.fillRect(sr(0,w),sr(0,h),sr(10,60),sr(2,8)); } }); }
for(const B of MAP.blds){
  if(!B.enter||!B.name) continue;
  const F=frontFace(B); const sc=spick(SIGN_COL);
  const w=Math.min(F.len-1.5,B.kind==='store'?6:9), y=B.kind==='store'||B.kind==='base'||B.kind==='mart'||B.kind==='market'?3.15:B.floors===1?B.wallH-0.9:LH*B.floors-0.9;
  const t=B.kind==='base'?signTex(B.name,'#2c3c46','#c9a24a'):B.kind==='church'?signTex(B.name,'#6a6458','#f0ece0'):B.kind==='clinic'?signTex(B.name,'#e8ecec','#1a6a7a'):
    B.kind==='police'?signTex(B.name,'#1a2440','#e8e8f0'):B.kind==='school'?signTex(B.name,'#5a3a22','#f0e0a0'):B.kind==='station'?signTex('18TH  ·  PINK LINE','#1a1c22','#e86aa8'):signTex(B.name,sc[0],sc[1]);
  facadeDecal(t,F.x,y,F.z,F.nx,F.nz,w,w*0.19,B.id,{transparent:false,alphaTest:0});
  if(B.kind==='store'){ // awning
    const aw=new THREE.Mesh(new THREE.BoxGeometry(F.nx?1.3:F.len-1,0.08,F.nx?F.len-1:1.3),cutPatch(phong({color:spick(AWN)})));
    aw.geometry.setAttribute('bid',new THREE.BufferAttribute(new Float32Array(aw.geometry.attributes.position.count).fill(B.id),1));
    aw.position.set(F.x+F.nx*0.7,2.95,F.z+F.nz*0.7); if(F.nx) aw.rotation.z=F.nx*0.28; else aw.rotation.x=-F.nz*0.28; aw.castShadow=true; scene.add(aw);
  }
}
const xTex=textTex(128,128,(g,w,h)=>{ g.strokeStyle='#d84a2a'; g.lineWidth=7; g.beginPath(); g.moveTo(16,16); g.lineTo(112,112); g.moveTo(112,16); g.lineTo(16,112); g.stroke();
  g.fillStyle='#d84a2a'; g.font='bold 18px Impact'; g.textAlign='center'; g.fillText('9-14',64,22); g.fillText('0',26,70); g.fillText('2',104,70); g.fillText('2PLT',64,120); });
// messages on boarded ground-floor windows, tags on walls, sweep-team marks on doors
let msgN=0;
for(let e=1;e<EN;e++){
  if(ED.L[e]!==0||ED.b[e]<0) continue; const O=OPEN[e]; const B=MAP.blds[ED.b[e]];
  const t=ED.t[e]; const nx=O?(O.ax==='x'?O.out:0):0, nz=O?(O.ax==='z'?O.out:0):0;
  if(t===ET.BOARD&&O&&R2()<.45) facadeDecal(sprayTex(BOARD_MSG[msgN++%BOARD_MSG.length],R2()<.6?'#f0ece0':'#c8382a',{px:70,stroke:2}),O.x,(O.yb+O.yt)/2,O.z,nx*1.25,nz*1.25,1.1,0.8,B.id);
  if(ED.k[e]===EK.DOOR&&O&&B.kind!=='base'&&R2()<.18) facadeDecal(xTex,O.x,1.9,O.z,nx,nz,0.75,0.75,B.id);
  if(t===ET.WALL&&!O&&R2()<.035){ const l=edgeLine(e), [A,Bc]=edgeCells(e); const inA=MAP.bld[0][CI(A[0],A[1])]===ED.b[e];
    const out=inA?1:-1; const ax=l.ax==='x'; if(!outdoorAt(...(inA?Bc:A))) continue;
    facadeDecal(sprayTex(spick(TAGS),spick(TAG_COL),{outline:R2()<.5?'rgba(15,15,15,.85)':null,px:120}),(l.x0+l.x1)/2,sr(1,2.2),(l.z0+l.z1)/2,ax?out:0,ax?0:out,sr(1.4,2.4),sr(.5,.8),B.id); }
}
// faded painted ads on tall blocks facing the streets
const ADS=[['COLD BEER · CERVEZA FRIA','#a8402a','#efe2c8'],['INJURED? 312-555-0148 · ABOGADOS','#25406a','#f2ead8'],['LA FIESTA 104.3 FM','#c88a2a','#2a1a10'],['WE BUY GOLD · COMPRAMOS ORO','#6a5a20','#f4e6a8'],['FUEGO CHIPS · HOT HOT HOT','#b8301a','#f8d860'],['PILSEN PRIDE','#2a5a3a','#f0ece0']];
{ let k=0;
  for(const B of MAP.blds){ if(B.enter||B.h<20||R2()>.35) continue;
    for(const [x,z,nx,nz,len] of [[B.x1,(B.z0+B.z1)/2,1,0,B.z1-B.z0],[B.x0,(B.z0+B.z1)/2,-1,0,B.z1-B.z0],[(B.x0+B.x1)/2,B.z0,0,-1,B.x1-B.x0],[(B.x0+B.x1)/2,B.z1,0,1,B.x1-B.x0]]){
      const px=Math.floor(x+nx*2), pz=Math.floor(z+nz*2); if(!inMap(px,pz)||MAP.surf[0][CI(px,pz)]!==SURF.CONCRETE&&MAP.surf[0][CI(px,pz)]!==SURF.ASPHALT) continue;
      if(len<10) continue; const ad=ADS[k++%ADS.length];
      const t=textTex(512,256,(g,w,h)=>{ g.fillStyle=ad[1]; g.fillRect(0,0,w,h); g.fillStyle=ad[2]; g.textAlign='center'; g.textBaseline='middle';
        const words=ad[0].split(' · '); words.forEach((wd,i)=>{ fitText(g,wd,w-50,90,'bold PX Impact, sans-serif'); g.fillText(wd,w/2,h*(words.length===1?0.5:0.33+i*0.36)); });
        g.globalCompositeOperation='destination-out'; for(let i=0;i<120;i++){ g.globalAlpha=sr(.15,.6); g.fillRect(sr(0,w),sr(0,h),sr(6,50),sr(3,14)); } });
      facadeDecal(t,x,sr(9,Math.min(B.h-4,15)),z,nx*0.6,nz*0.6,8,4,B.id,{opacity:0.78}); break; }
  }
}
// street-name blades on every corner
{
  const blade=(txt)=>textTex(256,48,(g,w,h)=>{ g.fillStyle='#1f5a3a'; g.fillRect(0,0,w,h); g.strokeStyle='#e8ece4'; g.lineWidth=3; g.strokeRect(3,3,w-6,h-6); g.fillStyle='#f0f2ec'; g.textAlign='center'; g.textBaseline='middle'; fitText(g,txt,w-24,34,'bold PX Arial, sans-serif'); g.fillText(txt,w/2,h/2+1); });
  const signPost=phong({color:0x3a4a3e});
  for(const a of ST_NS) for(const b of ST_EW){
    const px=a.x+a.h-1.2, pz=b.z-b.h+1.2;
    addStatic(new THREE.CylinderGeometry(0.06,0.06,3.6,5),signPost,px,1.8,pz);
    const A=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.3,0.03),[matDark,matDark,matDark,matDark,phong({map:blade(a.n)}),phong({map:blade(a.n)})]); A.position.set(px,3.45,pz); A.rotation.y=Math.PI/2; onCharLayer(A); scene.add(A);
    const Bm=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.3,0.03),[matDark,matDark,matDark,matDark,phong({map:blade(b.n)}),phong({map:blade(b.n)})]); Bm.position.set(px,3.15,pz); onCharLayer(Bm); scene.add(Bm);
  }
  const stop=textTex(256,128,(g,w,h)=>{ g.fillStyle='#e8e4d8'; g.fillRect(0,0,w,h); g.fillStyle='#9a2a20'; g.fillRect(0,0,w,40); g.fillStyle='#f4f0e8'; g.textAlign='center'; g.font='bold 30px Impact, sans-serif'; g.fillText('STOP',w/2,32);
    g.fillStyle='#1a1a1a'; g.font='bold 22px Impact, sans-serif'; g.fillText('MILITARY CHECKPOINT',w/2,72); g.font='16px Arial'; g.fillText('HAVE ID READY · NO WEAPONS',w/2,104); });
  addStatic(new THREE.CylinderGeometry(0.04,0.04,1.6,4),matDark,8.2,0.8,-23.2);
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(1.3,0.65),phong({map:stop,side:THREE.DoubleSide})); sg.position.set(8.2,1.7,-23.15); sg.rotation.x=-0.25; onCharLayer(sg); scene.add(sg);
}
groundDecal(sprayTex('TURN BACK','#e8e6dc',{px:130,stroke:2,tilt:0}),0,-56,10,3.2,0);
groundDecal(sprayTex('SOS','#e8e6dc',{px:140,tilt:0}),44,-31.5,6,2.4,0);
groundDecal(sprayTex('HELP','#d8d4c8',{px:120,tilt:0.05}),-2,30,7,2.6,0);
groundDecal(sprayTex('FERRETERIA\nHAS WATER','#e8e6dc',{px:90,stroke:2,tilt:0}),-6,-62,8,3,0);

/* ---------- street props ---------- */
const colliders=[]; // circles {x,z,r}
function markProp(x,z,r){ for(let cz=Math.floor(z-r);cz<=Math.floor(z+r);cz++) for(let cx=Math.floor(x-r);cx<=Math.floor(x+r);cx++){
  if(!inMap(cx,cz)) continue; if(Math.hypot(cx+.5-x,cz+.5-z)<r-0.15&&MAP.block[0][CI(cx,cz)]===BLK.FREE) MAP.block[0][CI(cx,cz)]=BLK.PROP; } }
const matGlass=new THREE.MeshPhongMaterial({color:0x12161c,specular:0x7a8898,shininess:70});
const matTail=new THREE.MeshBasicMaterial({color:0x5a1410}), matHead=new THREE.MeshBasicMaterial({color:0x7a7a70});
function wreck(x,z,rot,len,wid,hgt,mat,cabin){
  const g=new THREE.Group();
  const part=(w,h,d,m,px,py,pz)=>{ const q=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); q.position.set(px,py,pz); q.castShadow=q.receiveShadow=true; g.add(q); return q; };
  if(cabin){
    const bh=hgt*0.58;
    part(wid,bh,len,mat,0,0.32+bh/2,0);
    part(wid*1.01,0.12,len*1.02,matDark,0,0.3,0);
    part(wid*0.88,hgt*0.48,len*cabin,matGlass,0,0.32+bh+hgt*0.24,-len*0.05);
    part(wid*0.84,0.07,len*cabin*0.78,mat,0,0.32+bh+hgt*0.5,-len*0.05);
    for(const sx of [-1,1]){ part(0.3,0.1,0.05,matHead,sx*wid*0.32,0.32+bh*0.7,len/2+0.01); part(0.28,0.1,0.05,matTail,sx*wid*0.33,0.32+bh*0.75,-len/2-0.01); }
  } else {
    part(wid,hgt,len,mat,0,hgt/2+0.3,0);
    for(let k=0;k<Math.floor(len/1.6);k++) for(const sx of [-1,1]) part(0.04,hgt*0.32,1.1,matGlass,sx*(wid/2+0.01),hgt*0.68+0.3,-len/2+0.9+k*1.6);
  }
  for(const sx of [-1,1]) for(const sz of [-1,1]){ const w=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,0.24,8),matDark); w.rotation.z=Math.PI/2; w.position.set(sx*wid*.47,0.32,sz*len*.32); w.castShadow=true; g.add(w); }
  g.position.set(x,0,z); g.rotation.y=rot; g.updateMatrixWorld(true); g.traverse(c=>{ if(c.isMesh) addStaticM(c.geometry,c.material,c.matrixWorld,true); });
  const fx_=Math.sin(rot), fz_=Math.cos(rot); const n=Math.max(1,Math.round(len/2.2));
  for(let i=0;i<n;i++){const t=(i/(n-1||1)-.5)*(len-wid); const cx=x+fx_*t, cz=z+fz_*t; colliders.push({x:cx,z:cz,r:wid/2+0.25}); markProp(cx,cz,wid/2+0.25);}
  return g;
}
const CAR_COLS=[0x6e2a24,0x2c3e56,0x86898c,0x4a4f3a,0x26282c,0x7a6a4a,0x9a9890,0x3c2e28,0x5c6670];
const carMat=()=>pc(spick(CAR_COLS));
// cars on Wolcott north of the line and up 18th, parked and abandoned everywhere else
wreck(5.5,-24,0.35,4.4,1.9,1.0,matRust,.5);
wreck(-6,-50,-0.7,6,2.2,1.6,matRust2,.35);
wreck(3,-63,0.1,4.4,1.9,1.0,matRust,.5);
wreck(-3.5,-84,0.08,11,2.6,2.2,pc(0x5a5248),0);
wreck(6.5,-102,-0.3,4.4,1.9,1.0,matRust2,.5);
wreck(7.5,7,0.15,4.8,2.2,1.3,pc(0x5a5440),.45);   // the squad's dead truck
for(const s of ST_NS) for(let z=-160;z<145;z+=sr(9,22)){ if(inEW(z-3)||inEW(z+3)||(s.x===0&&z>-16&&z<52)) continue;
  const side=R2()<.5?-1:1; const x=s.x+side*sr(6.5,8.2); if(R2()<.55) wreck(x,z,sr(-.15,.15)+(R2()<.5?0:Math.PI),4.4,1.9,1.05,carMat(),.5); }
for(const s of ST_EW) for(let x=-190;x<190;x+=sr(10,24)){ if(inNS(x-3)||inNS(x+3)) continue;
  const side=R2()<.5?-1:1; if(R2()<.5) wreck(x,s.z+side*sr(3.5,5),Math.PI/2+sr(-.15,.15),4.4,1.9,1.05,carMat(),.5); }
// the compound's south wall: buses and cars pushed nose to tail across Wolcott
wreck(-7,49,Math.PI/2+0.05,11,2.6,2.2,pc(0x8a8a7e),0); wreck(5,49.2,Math.PI/2-0.04,11,2.6,2.2,pc(0x6a6a60),0);
wreck(-12.2,47.6,0.2,4.4,1.9,1.05,carMat(),.5); wreck(12.2,47.8,-0.15,4.4,1.9,1.05,carMat(),.5);
// a city bus on its side across 18th
{
  const g=new THREE.Group(), L=11.5;
  const b=new THREE.Mesh(new THREE.BoxGeometry(2.9,2.6,L),pc(0x8a8a7e)); b.castShadow=b.receiveShadow=true; g.add(b);
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.5,L*0.98),pc(0x2c4a6e)); stripe.position.set(1.46,-0.6,0); g.add(stripe);
  for(let k=0;k<6;k++){ const w=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.9,1.4),matGlass); w.position.set(1.46,0.45,-L/2+1.2+k*1.8); g.add(w); }
  for(const sz of [-1,1]){ const w=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.35,8),matDark); w.position.set(-1.2,-1.32,sz*L*0.32); g.add(w); }
  g.rotation.set(0,1.18,Math.PI/2); g.position.set(30,1.45,-28.5); g.updateMatrixWorld(true); g.traverse(c=>{ if(c.isMesh) addStaticM(c.geometry,c.material,c.matrixWorld,true); });
  for(let k=-2;k<=2;k++){ const cx=30+Math.sin(1.18)*k*2.3, cz=-28.5+Math.cos(1.18)*k*2.3; colliders.push({x:cx,z:cz,r:1.6}); markProp(cx,cz,1.6); }
}
// lamp posts along every street
for(const s of ST_NS) for(let z=-160;z<145;z+=26){ if(inEW(z)) continue; for(const sd of [-1,1]){
  const x=s.x+sd*(s.h-1.0); addStatic(new THREE.CylinderGeometry(0.1,0.12,6,5),matDark,x,3,z+sd*6); addStatic(new THREE.BoxGeometry(1.6,0.12,0.2),matDark,x-sd*0.7,6,z+sd*6); } }
for(const s of ST_EW) for(let x=-190;x<190;x+=26){ if(inNS(x)) continue; for(const sd of [-1,1]){
  const z=s.z+sd*(s.h-1.0); addStatic(new THREE.CylinderGeometry(0.1,0.12,6,5),matDark,x+sd*6,3,z); addStatic(new THREE.BoxGeometry(0.2,0.12,1.6),matDark,x+sd*6,6,z-sd*0.7); } }
// stains, puddles, debris
const matStain=new THREE.MeshPhongMaterial({color:0x14110f,transparent:true,opacity:.55,shininess:0,specular:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const matPuddle=new THREE.MeshPhongMaterial({color:0x0d0f12,specular:0xaab4c2,shininess:95,transparent:true,opacity:.88,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
function streetSpot(){ for(let t=0;t<30;t++){ const x=sr(-150,150), z=sr(-150,140), c=CI(Math.floor(x),Math.floor(z)); const s=MAP.surf[0][c];
  if((s===SURF.ASPHALT||s===SURF.ALLEY||s===SURF.CONCRETE)&&MAP.bld[0][c]<0&&MAP.block[0][c]===BLK.FREE) return [x,z,s]; } return [0,0,0]; }
for(let i=0;i<220;i++){ const [x,z]=streetSpot(); const p=new THREE.Mesh(new THREE.CircleGeometry(sr(.5,2.2),7),matStain); p.rotation.x=-Math.PI/2; p.scale.y=sr(.4,1); p.position.set(x,0.075,z); p.castShadow=false; staticMesh(p); }
for(let i=0;i<200;i++){ const [x,z]=streetSpot(); const p=new THREE.Mesh(new THREE.CircleGeometry(sr(.6,2.4),9),matPuddle); p.rotation.x=-Math.PI/2; p.rotation.z=sr(0,3); p.scale.y=sr(.35,.8); p.position.set(x,0.08,z); p.castShadow=false; staticMesh(p); }
for(let i=0;i<240;i++){ const [x,z]=streetSpot(); addStatic(new THREE.BoxGeometry(sr(.2,.8),sr(.1,.35),sr(.2,.8)),R2()<.5?matClutter:matDark,x,0.1,z,true,true); }
// trash bags piled at the curbs
const matBag=new THREE.MeshPhongMaterial({color:0x14171a,specular:0x5a6068,shininess:50});
const matBag2=new THREE.MeshPhongMaterial({color:0x1d2a1e,specular:0x4a5a4c,shininess:40});
for(let k=0;k<70;k++){
  const s=spick(ST_NS), side=R2()<.5?-1:1, z=sr(-150,140); if(inEW(z-2)||inEW(z+2)||(s.x===0&&z>-20&&z<-6)) continue;
  const x0=s.x+side*(s.h-1.6); const n=3+Math.floor(R2()*6);
  for(let i=0;i<n;i++){ const m=new THREE.Mesh(new THREE.IcosahedronGeometry(sr(.28,.42),0),R2()<.7?matBag:matBag2);
    m.scale.set(1,sr(.7,1),sr(.9,1.3)); m.rotation.set(sr(0,3),sr(0,3),0); m.position.set(x0+sr(-.6,.6),0.3,z+sr(-1.2,1.2)); staticMesh(m); }
}
// gas station: canopy and pumps
{
  const A=MAP.areas.find(a=>a.kind==='gas');
  for(const [x,z] of [[A.x0+.3,A.z0+.3],[A.x1-.6,A.z0+.3],[A.x0+.3,A.z1-.6],[A.x1-.6,A.z1-.6]]) addStatic(new THREE.BoxGeometry(.3,4.6,.3),pc(0xc8c8c4),x,2.3,z);
  addStatic(new THREE.BoxGeometry(A.x1-A.x0,0.5,A.z1-A.z0),pc(0xd8d4cc),(A.x0+A.x1)/2,4.8,(A.z0+A.z1)/2);
  addStatic(new THREE.BoxGeometry(A.x1-A.x0+.1,0.2,A.z1-A.z0+.1),pc(0x9a2a20),(A.x0+A.x1)/2,4.6,(A.z0+A.z1)/2,false);
  for(const p of MAP.props) if(p.kind==='pump'){ addStatic(new THREE.BoxGeometry(.7,1.5,.5),pc(0xc8c4bc),p.x+.5,.75,p.z+.5); addStatic(new THREE.BoxGeometry(.72,.3,.52),pc(0x9a2a20),p.x+.5,1.4,p.z+.5); }
}
// park trees and benches, L tracks overhead
{
  const trunk=pc(0x3a2e24), leaf=[pc(0x2e3a26),pc(0x3a3a24),pc(0x34302a)];
  for(const p of MAP.props){
    if(p.kind==='tree'){ const s=p.s; addStatic(new THREE.CylinderGeometry(.14*s,.2*s,3*s,5),trunk,p.x+.5,1.5*s,p.z+.5);
      for(let k=0;k<3;k++){ const m=addStatic(new THREE.IcosahedronGeometry(sr(1.2,1.8)*s,0),spick(leaf),p.x+.5+sr(-.8,.8),3.2*s+sr(0,1.2),p.z+.5+sr(-.8,.8)); m.rotation.set(sr(0,3),sr(0,3),0); } }
    if(p.kind==='bench'){ addStatic(new THREE.BoxGeometry(1.8,.08,.5),pc(0x4a3a2a),p.x,.45,p.z); addStatic(new THREE.BoxGeometry(1.8,.4,.06),pc(0x4a3a2a),p.x,.75,p.z-.22); }
    if(p.kind==='pillar') addStatic(new THREE.BoxGeometry(.8,6.8,.8),pc(0x3a3c3e),p.x+.5,3.4,p.z+.5);
  }
  const steel=pc(0x2c2e30);
  addStatic(new THREE.BoxGeometry(6,0.6,316),steel,108,6.9,-11);
  for(const x of [106.5,109.5]) addStatic(new THREE.BoxGeometry(.12,.14,316),pc(0x6a6a68),x,7.3,-11,false);
}
// the checkpoint the army left: sandbag nest, booth, barrier arm, HESCO, wire
{
  const nx=-9.4, nz=-20.6;
  for(let k=0;k<11;k++){ const a=Math.PI*0.15+k*(Math.PI*1.7/10), r=1.55;
    for(let lvl=0;lvl<2;lvl++){ const b=addStatic(new THREE.BoxGeometry(0.75,0.36,0.45),matSand,nx+Math.sin(a)*r,0.18+lvl*0.36,nz-Math.cos(a)*r); b.rotation.y=a+sr(-.1,.1); }
    colliders.push({x:nx+Math.sin(a)*r,z:nz-Math.cos(a)*r,r:0.45}); }
  for(let k=0;k<3;k++){ const l=addStatic(new THREE.CylinderGeometry(0.025,0.025,1.1,4),matDark,nx+Math.sin(k*2.1)*0.3,0.5,nz-0.2+Math.cos(k*2.1)*0.3); l.rotation.set(Math.cos(k*2.1)*0.35,0,-Math.sin(k*2.1)*0.35); }
  const mg=addStatic(new THREE.BoxGeometry(0.12,0.14,1.3),matDark,nx,1.02,nz-0.5); mg.rotation.x=0.05;
  addStatic(new THREE.BoxGeometry(1.7,2.5,1.9),pc(0xa6a296),10.4,1.25,-19.6); colliders.push({x:10.4,z:-19.6,r:1.2}); markProp(10.4,-19.6,1.2);
  addStatic(new THREE.BoxGeometry(2.0,0.12,2.2),pc(0x5e6a52),10.4,2.56,-19.6);
  const bw=new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.8),matGlass); bw.position.set(9.54,1.6,-19.6); bw.rotation.y=-Math.PI/2; staticMesh(bw);
  const stripes=canvasTex(64,8,(g,w,h)=>{ for(let i=0;i<8;i++){ g.fillStyle=i%2?'#d8d2c4':'#8e2a22'; g.fillRect(i*8,0,8,h); } });
  addStatic(new THREE.BoxGeometry(0.4,1.0,0.4),pc(0x5e6a52),8.6,0.5,-21.4);
  const arm=addStatic(new THREE.BoxGeometry(5.2,0.12,0.12),phong({map:stripes}),6.2,0.12,-21.0); arm.rotation.y=0.25; arm.rotation.z=0.03;
  const hesco=canvasTex(32,32,(g,w,h)=>{ g.fillStyle='#9a8a68'; g.fillRect(0,0,w,h); g.strokeStyle='rgba(40,38,30,.6)'; for(let i=0;i<=w;i+=8){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,h); g.moveTo(0,i); g.lineTo(w,i); g.stroke(); } });
  const hm=phong({map:hesco});
  for(let k=0;k<3;k++){ addStatic(new THREE.BoxGeometry(1.4,1.4,1.4),hm,-11.1,0.7,-24.4-k*1.45); colliders.push({x:-11.1,z:-24.4-k*1.45,r:0.95}); markProp(-11.1,-24.4-k*1.45,0.95); }
  const wireM=new THREE.MeshPhongMaterial({color:0x8a9096,specular:0xc0c8d0,shininess:60});
  for(let x=-12;x<=12;x+=0.85){ if(x>-2.5&&x<2.5) continue; const t=new THREE.Mesh(new THREE.TorusGeometry(0.42,0.018,3,12),wireM); t.position.set(x,0.42,-47+Math.sin(x)*0.3); t.rotation.y=Math.PI/2+sr(-.2,.2); t.castShadow=false; staticMesh(t); }
}
// what the army dropped on the way out
{
  const olive=pc(0x4a4d34), tanM=pc(0x9a8a5e);
  for(const [x,z] of [[3.5,-17.5],[-4,4],[10.2,-8],[-6.5,-22.5],[6,12]]){ const h=new THREE.Mesh(new THREE.SphereGeometry(0.18,7,4,0,Math.PI*2,0,Math.PI/2),olive); h.position.set(x,0.02,z); h.rotation.set(sr(-.6,.6),sr(0,6),sr(-.5,.5)); staticMesh(h); }
  for(const [x,z] of [[9.8,-11],[10.4,-10.4],[-10.4,-6],[2.2,-21.5],[-3,-23.5],[7.6,4.5]]){ const a=addStatic(new THREE.BoxGeometry(0.3,0.22,0.15),olive,x,0.11,z); a.rotation.y=sr(0,3); }
  for(const [x,z] of [[-9.6,-4.5],[-9.2,-3.8],[1,-19],[5.6,13.2]]){ const m=addStatic(new THREE.BoxGeometry(0.4,0.12,0.28),tanM,x,0.06,z); m.rotation.y=sr(0,3); }
  const st=new THREE.Group(); st.add(new THREE.Mesh(new THREE.BoxGeometry(0.6,0.05,1.9),pc(0x3e4a36)));
  for(const sx of [-1,1]){ const pl=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,2.3),matDark); pl.position.x=sx*0.33; st.add(pl); }
  st.position.set(4.2,0.12,10.5); st.rotation.y=0.8; st.updateMatrixWorld(true); st.traverse(c=>{ if(c.isMesh) addStaticM(c.geometry,c.material,c.matrixWorld,true); });
  for(let k=0;k<6;k++){ const m=addStatic(new THREE.BoxGeometry(0.05,0.02,0.16),matDark,sr(-6,9),0.02,sr(-22,-15)); m.rotation.y=sr(0,3); }
  const rifle=addStatic(new THREE.BoxGeometry(0.07,0.06,0.95),matDark,-5.2,0.04,-19.5); rifle.rotation.y=1.1;
  for(let k=0;k<5;k++){ const b=addStatic(new THREE.BoxGeometry(0.66,0.3,0.45),matSand,sr(-7,7),0.15,sr(-26,-17)); b.rotation.y=sr(0,3); }
  const ban=textTex(1024,96,(g,w,h)=>{ g.fillStyle='#d6d0c0'; g.fillRect(0,0,w,h); g.fillStyle='#24467a'; g.fillRect(0,0,w,14); g.fillRect(0,h-14,w,14);
    g.fillStyle='#1d2a3a'; g.textAlign='center'; g.textBaseline='middle'; fitText(g,'EVACUATION ROUTE ▲ CENTRAL STAGING ▲ FOLLOW POSTED INSTRUCTIONS',w-60,52,'bold PX Impact, sans-serif');
    g.fillText('EVACUATION ROUTE ▲ CENTRAL STAGING ▲ FOLLOW POSTED INSTRUCTIONS',w/2,h/2);
    g.globalCompositeOperation='destination-out'; g.beginPath(); g.moveTo(w*0.62,0); for(let y=0;y<=h;y+=8) g.lineTo(w*0.62+sr(-14,14),y); g.lineTo(w,h); g.lineTo(w,0); g.fill();
    for(let i=0;i<5;i++){ g.beginPath(); g.arc(sr(0,w*0.6),sr(0,h),sr(4,14),0,7); g.fill(); } });
  const bm=new THREE.Mesh(new THREE.PlaneGeometry(25,2.3),new THREE.MeshPhongMaterial({map:ban,transparent:true,alphaTest:0.08,side:THREE.DoubleSide}));
  bm.position.set(0,7.2,-72); bm.rotation.x=-0.45; onCharLayer(bm); scene.add(bm);
  for(const sx of [-1,1]) addStatic(new THREE.CylinderGeometry(0.02,0.02,25,3),matDark,0,7.95,-72.3).rotation.z=Math.PI/2;
}
// the map of the block, taped to the wall in the shop
{
  const B=LANDMARK.base;
  const mapTex=textTex(256,160,(g,w,h)=>{ g.fillStyle='#d8d0b8'; g.fillRect(0,0,w,h); g.strokeStyle='#5a5246'; g.lineWidth=10; g.beginPath(); g.moveTo(w*0.5,0); g.lineTo(w*0.5,h); g.moveTo(0,h*0.3); g.lineTo(w,h*0.3); g.stroke();
    g.fillStyle='#8a2a20'; g.font='bold 18px monospace'; g.fillText('X LINE',w*0.53,h*0.5); g.fillText('HORDE →',w*0.62,h*0.24); g.fillStyle='#2a2a26'; g.font='12px monospace'; g.fillText('WOLCOTT',w*0.52,h*0.92); g.fillText('18TH',8,h*0.27);
    g.fillText('DAY 11',8,h*0.9); g.strokeStyle='#8a2a20'; g.lineWidth=2; g.strokeRect(w*0.38,h*0.42,w*0.24,h*0.14); });
  facadeDecal(mapTex,-22,2.0,B.z0,0,1,1.8,1.1,B.id,{transparent:false,alphaTest:0});
  for(const dz of [-1.7,1.7]) addStatic(new THREE.BoxGeometry(0.9,0.7,0.9),matSand,-12.1,0.35,14+dz);
}

/* ---------- barricade ---------- */
const segs=[];
function lineCells(s,on){ for(let x=Math.floor(s.x0);x<Math.ceil(s.x1);x++) for(const z of [-15,-14]){ const c=CI(x,z); if(on){ if(MAP.block[0][c]===BLK.FREE) MAP.block[0][c]=BLK.LINE; } else if(MAP.block[0][c]===BLK.LINE) MAP.block[0][c]=BLK.FREE; } }
function addSeg(x0,x1,kind){
  const w=x1-x0, cx=(x0+x1)/2, g=new THREE.Group();
  let max=600;
  if(kind==='jersey'){
    const n=Math.round(w/2);
    for(let i=0;i<n;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(w/n-0.08,0.95,0.7),matConcrete);b.position.set(-w/2+(i+.5)*(w/n),0.48,0);b.castShadow=b.receiveShadow=true;g.add(b);
      const s=new THREE.Mesh(new THREE.BoxGeometry(w/n-0.1,0.06,0.72),matStripe);s.position.set(b.position.x,0.6,0);g.add(s);}
  } else if(kind==='car'){
    max=900;
    const b=new THREE.Mesh(new THREE.BoxGeometry(w-0.2,1.15,1.9),matRust); b.position.y=0.6; b.castShadow=b.receiveShadow=true; g.add(b);
    for(const sx of [-1,1]) for(const sz of [-1,1]){const t=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.25,7),matDark);t.position.set(sx*(w/2-0.9),1.3,sz*0.62);g.add(t);}
  } else {
    max=420;
    for(let i=0;i<Math.round(w/0.7);i++) for(let r=0;r<2;r++){const b=new THREE.Mesh(new THREE.BoxGeometry(0.66,0.38,0.5),matSand);b.position.set(-w/2+0.35+i*0.7+(r?0.3:0),0.2+r*0.38,(r?0:0.15));b.castShadow=b.receiveShadow=true;g.add(b);}
  }
  g.position.set(cx,0,BZ); scene.add(g);
  const pieces=g.children.map(c=>{ c.material=c.material.clone(); return {m:c,col:c.material.color.clone(),pos:c.position.clone(),rot:c.rotation.clone(),
    th:sr(0.05,0.5),dx:sr(-1,1),dz:sr(-1,1),tilt:sr(-1,1),gone:false}; });
  const s={x0,x1,z0:BZ-0.75,z1:BZ+0.75,hp:max,max,mesh:g,alive:true,kind,pieces};
  segs.push(s); lineCells(s,true);
}
addSeg(-13,-7,'jersey'); addSeg(-7,-1.5,'car'); addSeg(-1.5,3,'jersey'); addSeg(3,7,'sand'); addSeg(7,13,'jersey');
const matLamp=new THREE.MeshBasicMaterial({color:0xffe2b0});
addStatic(new THREE.CylinderGeometry(0.06,0.08,3.4,5),matDark,LIGHT_WORK.x,1.7,LIGHT_WORK.z);
const lampHead=addMesh(new THREE.BoxGeometry(0.7,0.35,0.3),matLamp,LIGHT_WORK.x,3.5,LIGHT_WORK.z-0.1,false,false);
addStatic(new THREE.CylinderGeometry(0.42,0.42,1.0,8),matRust2,LIGHT_BARREL.x,0.5,LIGHT_BARREL.z);
const matFire=new THREE.MeshBasicMaterial({color:0xff9a42});
const fireTop=addMesh(new THREE.CylinderGeometry(0.36,0.36,0.08,8),matFire,LIGHT_BARREL.x,1.02,LIGHT_BARREL.z,false,false);
colliders.push({x:LIGHT_BARREL.x,z:LIGHT_BARREL.z,r:0.45});
for(let i=0;i<5;i++) addStatic(new THREE.BoxGeometry(0.9,0.5,0.6),pc(0x4e4a34),sr(-10,10),0.25,sr(-9,-5));

/* ---------- lights (fixed count, toggled by intensity) ---------- */
const ambient=new THREE.AmbientLight(0x66707e,0.6); scene.add(ambient);
const moon=new THREE.DirectionalLight(0xe6e0d2,0.9);
moon.castShadow=true; moon.shadow.mapSize.set(2048,2048);
const sc=moon.shadow.camera; sc.left=-95;sc.right=95;sc.top=95;sc.bottom=-95;sc.near=1;sc.far=360; moon.shadow.bias=-0.0009;
const sunOff=new THREE.Vector3(-55,95,-35);
scene.add(moon); scene.add(moon.target);
const workLight=fakeLight(0xffd29a,1.5,28); workLight.position.set(LIGHT_WORK.x,3.3,LIGHT_WORK.z-0.4);
const barrelLight=fakeLight(0xff8a3a,1.3,16); barrelLight.position.set(LIGHT_BARREL.x,1.6,LIGHT_BARREL.z);
const doorLight=fakeLight(0xffb06a,1.3,16); doorLight.position.set(-18,2.6,DOOR.z);
const flashes=[0,1].map(()=>{const l=fakeLight(0xffd08a,0,19);return {l,t:0};});
const LAMP={x:10.0,z:-52}, CARFIRE={x:5.5,z:-24};
const lampLight=fakeLight(0xd8e2ff,1.2,20); lampLight.position.set(LAMP.x,5.6,LAMP.z);
const lampBulb=addMesh(new THREE.BoxGeometry(0.5,0.12,0.3),new THREE.MeshBasicMaterial({color:0xdfe6ff}),LAMP.x,5.92,LAMP.z,false,false);
const carLight=fakeLight(0xff7a2a,1.8,22); carLight.position.set(CARFIRE.x,2.2,CARFIRE.z);
const flares=[0,1].map(()=>{
  const l=fakeLight(0xff2a1e,0,15);
  const m=addMesh(new THREE.CylinderGeometry(0.05,0.05,0.35,5),new THREE.MeshBasicMaterial({color:0xff4030}),0,0.08,0,false,false);
  m.rotation.z=Math.PI/2; m.visible=false;
  return {l,m,x:0,z:0,on:false};
});
function placeFlares(){
  for(const f of flares){ f.x=rand(-9,9); f.z=rand(-62,-30); if(f.z>CR_Z0-1&&f.z<CR_Z1+1) f.z=CR_Z1+rand(2,5);
    f.l.position.set(f.x,0.5,f.z); f.m.position.set(f.x,0.08,f.z); f.m.rotation.y=rand(0,3); f.on=true; f.m.visible=true; }
}
flushStatics();
// the real lights: a pool that follows the proxies nearest the action
const LIGHT_POOL=[];
for(let i=0;i<5;i++){ const l=new THREE.PointLight(0xffffff,0,10,2); scene.add(l); LIGHT_POOL.push(l); }
const _lc=[];
function assignLights(px,pz){
  _lc.length=0;
  for(const p of LIGHT_PROXIES){ if(p.intensity<0.02) continue; const d=Math.hypot(p.position.x-px,p.position.z-pz); if(d>p.distance+38) continue; _lc.push([p.intensity*(1.4-Math.min(1.2,d/(p.distance+38))),p]); }
  _lc.sort((a,b)=>b[0]-a[0]);
  for(let i=0;i<LIGHT_POOL.length;i++){ const l=LIGHT_POOL[i], c=_lc[i];
    if(!c){ l.intensity=0; continue; } const p=c[1]; l.position.copy(p.position); l.color.copy(p.color); l.intensity=p.intensity; l.distance=p.distance; }
}
scene.traverse(o=>{ if(o.isLight) o.layers.enableAll(); });
moon.shadow.camera.layers.enableAll();
let flashIdx=0;
