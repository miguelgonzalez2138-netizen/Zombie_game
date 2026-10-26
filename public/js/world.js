'use strict';
// Fog Line — The block: ground, buildings, the shop, street props, city dressing, barricade, lights.
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- ground ---------- */
{
  const g=scaleUV(new THREE.PlaneGeometry(380,300),380/8,300/8);
  const m=new THREE.Mesh(g,matGround); m.rotation.x=-Math.PI/2; m.receiveShadow=true; scene.add(m);
  // sidewalks along Wolcott
  for(const s of [-1,1]){
    for(const [z0,z1] of [[ST_Z0,CR_Z0-2],[CR_Z1+2,ST_Z1]]){
      const len=z1-z0, w=2.6;
      const sw=scaleUV(new THREE.PlaneGeometry(w,len),w/2,len/2);
      const sm=new THREE.Mesh(sw,matWalk); sm.rotation.x=-Math.PI/2; sm.position.set(s*(WALK_W-1.3+0.5+0.5),0.03,(z0+z1)/2); sm.receiveShadow=true; scene.add(sm);
      addMesh(new THREE.BoxGeometry(0.25,0.16,len),matCurb,s*(10.35),0.08,(z0+z1)/2,false,true);
    }
  }
  // sidewalks along 18th
  for(const z of [CR_Z0-1.3,CR_Z1+1.3]){
    for(const s of [-1,1]){
      const x0=12.5,x1=CR_X; const len=x1-x0;
      const sw=scaleUV(new THREE.PlaneGeometry(len,2.6),len/2,1.3);
      const sm=new THREE.Mesh(sw,matWalk); sm.rotation.x=-Math.PI/2; sm.position.set(s*(x0+len/2),0.03,z); sm.receiveShadow=true; scene.add(sm);
    }
  }
  // center dashes
  for(let z=ST_Z0;z<ST_Z1;z+=7){ if(z>CR_Z0-1&&z<CR_Z1+1) continue; addMesh(new THREE.BoxGeometry(0.18,0.02,3),matLine,0,0.02,z,false,true); }
  for(let x=-CR_X;x<CR_X;x+=7){ if(Math.abs(x)<12) continue; addMesh(new THREE.BoxGeometry(3,0.02,0.18),matLine,x,0.02,-32,false,true); }
}

/* ---------- buildings ---------- */
const homeBlock={};
const HOME={z0:6,z1:22,depth:18};
const frontBlocks=[];
function building(x0,x1,z0,z1,h){
  const sx=x1-x0, sz=z1-z0;
  if(Math.abs(x0-12.5)<0.01||Math.abs(x1+12.5)<0.01) frontBlocks.push({side:x0>0?1:-1,z0,z1,h});
  const geo=boxUV(sx,h,sz);
  const fm=matFacade[Math.random()*3|0];
  const m=new THREE.Mesh(geo,[fm,fm,matRoof,matRoof,fm,fm]);
  m.position.set((x0+x1)/2,h/2,(z0+z1)/2); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  const B={m,h,clutter:[]};
  const n=1+(Math.random()*3|0);
  for(let i=0;i<n;i++){
    const r=Math.random();
    let w,hh,d;
    if(r<.35){w=rand(3,5);hh=rand(2.5,3.5);d=rand(3,5);} else if(r<.8){w=rand(1.2,2);hh=rand(.8,1.2);d=rand(1.2,2);} else {w=rand(2,3);hh=rand(.6,1);d=rand(4,8);}
    if(w>sx-2||d>sz-2) continue;
    B.clutter.push(addMesh(new THREE.BoxGeometry(w,hh,d),matClutter,rand(x0+w/2+1,x1-w/2-1),h+hh/2,rand(z0+d/2+1,z1-d/2-1)));
  }
  return B;
}
let shopSouth=null;
for(const side of [-1,1]){
  for(let row=0;row<4;row++){
    const near=12.5+row*31, depth=rand(16,26);
    if(side<0&&row===0) HOME.depth=depth;
    let z=-128;
    while(z<128){
      let len=rand(14,32);
      if(z<CR_Z0-1.5 && z+len>CR_Z0-1.5){ len=CR_Z0-1.5-z; }
      if(z>=CR_Z0-1.5 && z<CR_Z1+1.5){ z=CR_Z1+1.5; continue; }
      if(len<6){ z+=len; continue; }
      const gap=Math.random()<.3?rand(2,4):0;
      let h=rand(15,36);
      const xa=side>0?near:-(near+depth), xb=side>0?near+depth:-near;
      if(side<0&&row===0){
        if(z<HOME.z0&&z+len>HOME.z0){ len=HOME.z0-z; if(len<4){ z=HOME.z1; continue; } }
        if(z>=HOME.z0&&z<HOME.z1){ z=HOME.z1; continue; }
      }
      const B=building(xa,xb,z,z+len-gap,h);
      if(side<0&&row===0&&Math.abs(z-HOME.z1)<0.01) shopSouth=B;
      z+=len;
    }
  }
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
      g.save(); g.translate(w/2,y); g.rotate(opts.tilt||rand(-.06,.06));
      g.globalAlpha=0.9; g.lineJoin='round'; g.strokeStyle=col; g.lineWidth=opts.stroke||3; g.fillStyle=col;
      if(opts.outline){ g.strokeStyle=opts.outline; g.lineWidth=10; g.strokeText(ln,0,0); }
      g.fillText(ln,0,0); g.restore();
      // drips
      g.fillStyle=col; for(let d=0;d<ln.length*0.8;d++){ const x=w/2+rand(-0.45,0.45)*g.measureText(ln).width, l=rand(6,28); g.globalAlpha=0.6; g.fillRect(x,y+lh*0.3,2,l); }
    });
  });
}
const decalMat=(tex,opts={})=>new THREE.MeshPhongMaterial(Object.assign({map:tex,transparent:true,alphaTest:0.08,depthWrite:false,shininess:0,specular:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.DoubleSide},opts));
// a decal flat on a street-facing wall (side -1 = west wall facing east)
function wallDecal(tex,side,z,y,w,h,opts){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),decalMat(tex,opts)); m.position.set(side*12.46,y,z); m.rotation.y=side>0?-Math.PI/2:Math.PI/2; onCharLayer(m); scene.add(m); return m; }
function groundDecal(tex,x,z,w,h,rot,opts){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),decalMat(tex,opts)); m.rotation.x=-Math.PI/2; m.rotation.z=rot||0; m.position.set(x,0.06,z); onCharLayer(m); scene.add(m); return m; }

/* ---------- the shop: Ferreteria Morales, walk-in ---------- */
const SHOP={x0:-(12.5+HOME.depth), x1:-12.5, z0:HOME.z0, z1:HOME.z1, h:24, doorZ0:13, doorZ1:15};
const shopHide=[];      // roof, ceiling and the south wall fade out when you walk in
const shopCols=[];
{
  const S=SHOP, cx=(S.x0+S.x1)/2, cz=(S.z0+S.z1)/2, W=S.x1-S.x0, D=S.z1-S.z0, FH=4.2, T=0.4;
  const fm=matFacade[1];
  const upper=new THREE.Mesh(boxUV(W,S.h-FH,D),[fm,fm,matRoof,matRoof,fm,fm]); upper.position.set(cx,FH+(S.h-FH)/2,cz); upper.castShadow=upper.receiveShadow=true; scene.add(upper); shopHide.push(upper);
  for(let i=0;i<2;i++) addMesh(new THREE.BoxGeometry(rand(1.5,3),rand(.8,2.5),rand(1.5,3)),matClutter,cx+rand(-4,4),S.h+0.6,cz+rand(-4,4));
  const matWall=phong({color:0x6e7275}), matIn=phong({color:0x4a4740});
  const wall=(x0,x1,z0,z1,hide)=>{ const m=addMesh(new THREE.BoxGeometry(x1-x0,FH,z1-z0),matWall,(x0+x1)/2,FH/2,(z0+z1)/2); if(hide) shopHide.push(m); return m; };
  wall(S.x1-T,S.x1,S.z0,S.doorZ0); wall(S.x1-T,S.x1,S.doorZ1,S.z1);          // storefront with the door gap
  addMesh(new THREE.BoxGeometry(T,FH-2.7,S.doorZ1-S.doorZ0),matWall,S.x1-T/2,2.7+(FH-2.7)/2,(S.doorZ0+S.doorZ1)/2);
  wall(S.x0,S.x1,S.z0,S.z0+T);                                                 // north
  wall(S.x0,S.x1,S.z1-T,S.z1,true);                                            // south: cut away when inside
  wall(S.x0,S.x0+T,S.z0,S.z1);                                                 // back
  const ceil=addMesh(new THREE.BoxGeometry(W,0.2,D),matIn,cx,FH-0.1,cz); shopHide.push(ceil);
  // floor tiles
  const ft=canvasTex(32,32,(g,w,h)=>{ g.fillStyle='#4b4f52'; g.fillRect(0,0,w,h); g.fillStyle='#3d4043'; g.fillRect(0,0,16,16); g.fillRect(16,16,16,16); speckle(g,w,h,120,'rgba(0,0,0,.25)','rgba(255,255,255,.05)'); });
  const fl=new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(W-T*2,D-T*2),(W-T*2)/1.6,(D-T*2)/1.6),phong({map:ft,polygonOffset:true,polygonOffsetFactor:-1}));
  fl.rotation.x=-Math.PI/2; fl.position.set(cx,0.03,cz); fl.receiveShadow=true; scene.add(fl);
  // inside: counter, shelving, cots, footlockers, a stove, the radio table, the map wall
  const IN=(w,h,d,col,x,y,z)=>{ const m=addMesh(new THREE.BoxGeometry(w,h,d),phong({color:col}),x,y,z); onCharLayer(m); return m; };
  const counter=[IN(0.8,1.0,5,0x5a4632,S.x1-3.2,0.5,S.z0+3.6),IN(3,1.0,0.8,0x5a4632,S.x1-4.4,0.5,S.z0+6.0)];
  shopCols.push({x0:S.x1-3.6,x1:S.x1-2.8,z0:S.z0+1.1,z1:S.z0+6.1},{x0:S.x1-5.9,x1:S.x1-2.9,z0:S.z0+5.6,z1:S.z0+6.4});
  for(let k=0;k<4;k++){ const z=S.z0+1.4+k*2.2; IN(0.7,2.4,1.8,0x3b3d3f,S.x0+0.8,1.2,z);
    for(let b=0;b<5;b++) IN(rand(.2,.4),rand(.15,.35),rand(.2,.5),[0x8a5a2e,0x6f7a52,0xa08850,0x5b6670][b%4],S.x0+0.85,rand(.6,2.3),z+rand(-.7,.7)); }
  shopCols.push({x0:S.x0,x1:S.x0+1.3,z0:S.z0,z1:S.z0+9.6});
  for(let k=0;k<4;k++){ const x=S.x0+3+k*2.1, z=S.z1-1.6;
    IN(0.85,0.32,2.0,0x3e4230,x,0.36,z); IN(0.8,0.1,1.2,0x55593e,x,0.57,z+0.2); IN(0.5,0.12,0.35,0x8a8670,x,0.58,z-0.7);
    IN(0.7,0.4,0.45,0x4a4c34,x,0.2,z-1.25); }
  shopCols.push({x0:S.x0+2.4,x1:S.x0+10.6,z0:S.z1-2.7,z1:S.z1});
  IN(1.4,0.8,0.9,0x4a3a2a,S.x0+4.5,0.4,S.z0+4.5); IN(0.35,0.25,0.25,0x2e3226,S.x0+4.3,0.93,S.z0+4.4); // table + radio
  const ant=IN(0.02,0.8,0.02,0x22262a,S.x0+4.4,1.4,S.z0+4.4);
  IN(0.8,0.9,0.8,0x2a2a2c,S.x0+7.5,0.45,S.z0+1.2); const stoveGlow=IN(0.5,0.12,0.5,0xff8a3a,S.x0+7.5,0.92,S.z0+1.2);
  stoveGlow.material=new THREE.MeshBasicMaterial({color:0xff8a3a}); onCharLayer(stoveGlow);
  shopCols.push({x0:S.x0+3.7,x1:S.x0+5.3,z0:S.z0+3.9,z1:S.z0+5.1});
  // map of the block, taped to the north wall
  const mapTex=textTex(256,160,(g,w,h)=>{ g.fillStyle='#d8d0b8'; g.fillRect(0,0,w,h); g.strokeStyle='#5a5246'; g.lineWidth=10; g.beginPath(); g.moveTo(w*0.5,0); g.lineTo(w*0.5,h); g.moveTo(0,h*0.3); g.lineTo(w,h*0.3); g.stroke();
    g.fillStyle='#8a2a20'; g.font='bold 18px monospace'; g.fillText('X LINE',w*0.53,h*0.5); g.fillText('HORDE →',w*0.62,h*0.24); g.fillStyle='#2a2a26'; g.font='12px monospace'; g.fillText('WOLCOTT',w*0.52,h*0.92); g.fillText('18TH',8,h*0.27);
    g.fillText('DAY 11',8,h*0.9); g.strokeStyle='#8a2a20'; g.lineWidth=2; g.strokeRect(w*0.38,h*0.42,w*0.24,h*0.14); });
  const mp=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.1),phong({map:mapTex})); mp.position.set(S.x0+6.5,2.2,S.z0+T+0.03); onCharLayer(mp); scene.add(mp);
  // storefront: sign, sandbags, the open door
  const sign=textTex(512,96,(g,w,h)=>{ g.fillStyle='#2c3c46'; g.fillRect(0,0,w,h); g.fillStyle='#c9a24a'; g.textAlign='center'; g.textBaseline='middle'; fitText(g,'FERRETERIA MORALES',w-40,64,'bold PX Impact, sans-serif'); g.fillText('FERRETERIA MORALES',w/2,h/2+2);
    g.fillStyle='rgba(0,0,0,.35)'; for(let i=0;i<30;i++) g.fillRect(rand(0,w),rand(0,h),rand(8,40),rand(2,6)); });
  wallDecal(sign,-1,(S.z0+S.z1)/2,3.6,6.5,1.2).material=phong({map:sign}).clone();
  for(const dz of [-1.7,1.7]) addMesh(new THREE.BoxGeometry(0.9,0.7,0.9),matSand,-11.6,0.35,DOOR.z+dz);
}
function shopInside(x,z){ return x<SHOP.x1-0.2&&x>SHOP.x0&&z>SHOP.z0&&z<SHOP.z1; }

/* ---------- street props ---------- */
const colliders=[]; // circles {x,z,r}
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
  g.position.set(x,0,z); g.rotation.y=rot; scene.add(g);
  const fx_=Math.sin(rot), fz_=Math.cos(rot); const n=Math.max(1,Math.round(len/2.2));
  for(let i=0;i<n;i++){const t=(i/(n-1||1)-.5)*(len-wid);colliders.push({x:x+fx_*t,z:z+fz_*t,r:wid/2+0.25});}
  return g;
}
const CAR_COLS=[0x6e2a24,0x2c3e56,0x86898c,0x4a4f3a,0x26282c,0x7a6a4a,0x9a9890,0x3c2e28,0x5c6670];
const carMat=()=>phong({color:CAR_COLS[Math.random()*CAR_COLS.length|0]});
wreck(5.5,-24,0.35,4.4,1.9,1.0,matRust,.5);
wreck(-6,-50,-0.7,6,2.2,1.6,matRust2,.35);
wreck(3,-63,0.1,4.4,1.9,1.0,matRust,.5);
wreck(-3.5,-84,0.08,11,2.6,2.2,phong({color:0x5a5248}),0);
wreck(6.5,-102,-0.3,4.4,1.9,1.0,matRust2,.5);
wreck(30,-29,1.4,4.4,1.9,1.0,matRust,.5);
wreck(-46,-35,1.7,6,2.2,1.6,matRust2,.35);
wreck(72,-35,1.2,4.4,1.9,1.0,matRust,.5);
wreck(-95,-28,1.5,4.4,1.9,1.0,matRust,.5);
wreck(7.5,7,0.15,4.8,2.2,1.3,phong({color:0x5a5440}),.45);   // the squad's dead truck
wreck(-6.5,34,-0.2,4.4,1.9,1.0,matRust,.5);
wreck(4,58,0.6,4.4,1.9,1.0,matRust2,.5);
// lamp posts (mostly dead)
for(let z=-110;z<120;z+=26){ for(const s of [-1,1]){ if(z>CR_Z0-3&&z<CR_Z1+3) continue;
  addMesh(new THREE.CylinderGeometry(0.1,0.12,6,5),matDark,s*10.7,3,z+s*6);
  addMesh(new THREE.BoxGeometry(1.6,0.12,0.2),matDark,s*10.0,6,z+s*6);
}}
// debris + stains
const matStain=new THREE.MeshPhongMaterial({color:0x14110f,transparent:true,opacity:.55,shininess:0,specular:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
for(let i=0;i<70;i++){
  const p=new THREE.Mesh(new THREE.CircleGeometry(rand(.5,2.2),7),matStain);
  p.rotation.x=-Math.PI/2; p.scale.y=rand(.4,1);
  const onCross=Math.random()<.35;
  p.position.set(onCross?rand(-150,150):rand(-11,11),0.04,onCross?rand(CR_Z0,CR_Z1):rand(-120,120)); scene.add(p);
}
const matPuddle=new THREE.MeshPhongMaterial({color:0x0d0f12,specular:0xaab4c2,shininess:95,transparent:true,opacity:.88,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
for(let i=0;i<55;i++){
  const p=new THREE.Mesh(new THREE.CircleGeometry(rand(.6,2.4),9),matPuddle);
  p.rotation.x=-Math.PI/2; p.rotation.z=rand(0,3); p.scale.y=rand(.35,.8); p.receiveShadow=true;
  const onCross=Math.random()<.3;
  p.position.set(onCross?rand(-120,120):rand(-10.5,10.5),0.045,onCross?rand(CR_Z0+1,CR_Z1-1):rand(-110,110)); scene.add(p);
}
for(let i=0;i<60;i++){
  const onCross=Math.random()<.3;
  addMesh(new THREE.BoxGeometry(rand(.2,.8),rand(.1,.35),rand(.2,.8)),Math.random()<.5?matClutter:matDark,
    onCross?rand(-150,150):rand(-11.5,11.5),0.1,onCross?rand(CR_Z0,CR_Z1):rand(-120,120),true,true);
}

/* ---------- city dressing ---------- */
// more abandoned cars along both streets
for(const [x,z,r] of [[8.6,-44,0.12],[-8.8,-70,-0.2],[8.2,-78,2.9],[-7.4,-96,0.4],[1.5,-114,1.3],[8.4,30,3.0],[-8.8,52,0.15],[7.2,76,-0.5],[-5.8,92,2.7],[8.6,104,0.1],
  [20,-26.5,1.5],[48,-37.5,1.65],[-26,-30,1.3],[-70,-37,1.55],[110,-29,1.45],[-130,-34,1.62],[150,-36,1.5],[-58,-26,1.7]])
  wreck(x,z,r,4.4,1.9,1.05,carMat(),.5);
wreck(-9.2,-108,0.3,5.4,2.1,1.6,carMat(),.32);  // a box van
// a city bus on its side across 18th
{
  const g=new THREE.Group(), L=11.5;
  const b=new THREE.Mesh(new THREE.BoxGeometry(2.9,2.6,L),phong({color:0x8a8a7e})); b.castShadow=b.receiveShadow=true; g.add(b);
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.5,L*0.98),phong({color:0x2c4a6e})); stripe.position.set(1.46,-0.6,0); g.add(stripe);
  for(let k=0;k<6;k++){ const w=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.9,1.4),matGlass); w.position.set(1.46,0.45,-L/2+1.2+k*1.8); g.add(w); }
  for(const sz of [-1,1]){ const w=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.35,8),matDark); w.position.set(-1.2,-1.32,sz*L*0.32); g.add(w); }
  g.rotation.set(0,1.18,Math.PI/2); g.position.set(26,1.45,-31.5); scene.add(g);
  for(let k=-2;k<=2;k++) colliders.push({x:26+Math.sin(1.18)*k*2.3,z:-31.5+Math.cos(1.18)*k*2.3,r:1.6});
}
// trash bags piled at the curbs
const matBag=new THREE.MeshPhongMaterial({color:0x14171a,specular:0x5a6068,shininess:50});
const matBag2=new THREE.MeshPhongMaterial({color:0x1d2a1e,specular:0x4a5a4c,shininess:40});
for(let k=0;k<22;k++){
  const side=Math.random()<.5?-1:1, z=rand(-110,110); if(z>CR_Z0-4&&z<CR_Z1+4) continue; if(side<0&&z>SHOP.z0-2&&z<SHOP.z1+2) continue; if(z>-20&&z<-6) continue;
  const n=3+(Math.random()*6|0);
  for(let i=0;i<n;i++){ const m=new THREE.Mesh(new THREE.IcosahedronGeometry(rand(.28,.42),0),Math.random()<.7?matBag:matBag2);
    m.scale.set(1,rand(.7,1),rand(.9,1.3)); m.rotation.set(rand(0,3),rand(0,3),0); m.position.set(side*rand(10.3,12.1),0.25,z+rand(-1.2,1.2)); m.castShadow=m.receiveShadow=true; scene.add(m); }
}
// the checkpoint the army left: sandbag nest, booth, barrier arm, HESCO, wire
{
  const nx=-9.4, nz=-20.6;
  for(let k=0;k<11;k++){ const a=Math.PI*0.15+k*(Math.PI*1.7/10), r=1.55;
    for(let lvl=0;lvl<2;lvl++){ const b=addMesh(new THREE.BoxGeometry(0.75,0.36,0.45),matSand,nx+Math.sin(a)*r,0.18+lvl*0.36,nz-Math.cos(a)*r); b.rotation.y=a+rand(-.1,.1); }
    colliders.push({x:nx+Math.sin(a)*r,z:nz-Math.cos(a)*r,r:0.45}); }
  for(let k=0;k<3;k++){ const l=addMesh(new THREE.CylinderGeometry(0.025,0.025,1.1,4),matDark,nx+Math.sin(k*2.1)*0.3,0.5,nz-0.2+Math.cos(k*2.1)*0.3); l.rotation.set(Math.cos(k*2.1)*0.35,0,-Math.sin(k*2.1)*0.35); }
  const mg=addMesh(new THREE.BoxGeometry(0.12,0.14,1.3),matDark,nx,1.02,nz-0.5); mg.rotation.x=0.05;
  const booth=addMesh(new THREE.BoxGeometry(1.7,2.5,1.9),phong({color:0xa6a296}),10.4,1.25,-19.6); colliders.push({x:10.4,z:-19.6,r:1.2});
  addMesh(new THREE.BoxGeometry(2.0,0.12,2.2),phong({color:0x5e6a52}),10.4,2.56,-19.6);
  const bw=new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.8),matGlass); bw.position.set(9.54,1.6,-19.6); bw.rotation.y=-Math.PI/2; scene.add(bw);
  const stripes=canvasTex(64,8,(g,w,h)=>{ for(let i=0;i<8;i++){ g.fillStyle=i%2?'#d8d2c4':'#8e2a22'; g.fillRect(i*8,0,8,h); } });
  addMesh(new THREE.BoxGeometry(0.4,1.0,0.4),phong({color:0x5e6a52}),8.6,0.5,-21.4);
  const arm=addMesh(new THREE.BoxGeometry(5.2,0.12,0.12),phong({map:stripes}),6.2,0.12,-21.0); arm.rotation.y=0.25; arm.rotation.z=0.03;
  const hesco=canvasTex(32,32,(g,w,h)=>{ g.fillStyle='#9a8a68'; g.fillRect(0,0,w,h); g.strokeStyle='rgba(40,38,30,.6)'; for(let i=0;i<=w;i+=8){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,h); g.moveTo(0,i); g.lineTo(w,i); g.stroke(); } });
  const hm=phong({map:hesco});
  for(let k=0;k<3;k++){ addMesh(new THREE.BoxGeometry(1.4,1.4,1.4),hm,-11.1,0.7,-24.4-k*1.45); colliders.push({x:-11.1,z:-24.4-k*1.45,r:0.95}); }
  const wireM=new THREE.MeshPhongMaterial({color:0x8a9096,specular:0xc0c8d0,shininess:60});
  for(let x=-12;x<=12;x+=0.85){ if(x>-2.5&&x<2.5) continue; const t=new THREE.Mesh(new THREE.TorusGeometry(0.42,0.018,3,12),wireM); t.position.set(x,0.42,-47+Math.sin(x)*0.3); t.rotation.y=Math.PI/2+rand(-.2,.2); scene.add(t); }
}
// what the army dropped on the way out
{
  const olive=phong({color:0x4a4d34}), tanM=phong({color:0x9a8a5e});
  for(const [x,z] of [[3.5,-17.5],[-4,4],[10.2,-8],[-6.5,-22.5],[6,12]]){ const h=new THREE.Mesh(new THREE.SphereGeometry(0.18,7,4,0,Math.PI*2,0,Math.PI/2),olive); h.position.set(x,0.02,z); h.rotation.set(rand(-.6,.6),rand(0,6),rand(-.5,.5)); h.castShadow=true; scene.add(h); }
  for(const [x,z] of [[9.8,-11],[10.4,-10.4],[-10.4,-6],[2.2,-21.5],[-3,-23.5],[7.6,4.5]]){ const a=addMesh(new THREE.BoxGeometry(0.3,0.22,0.15),olive,x,0.11,z); a.rotation.y=rand(0,3); }
  for(const [x,z] of [[-9.6,-4.5],[-9.2,-3.8],[1,-19],[5.6,13.2]]){ const m=addMesh(new THREE.BoxGeometry(0.4,0.12,0.28),tanM,x,0.06,z); m.rotation.y=rand(0,3); }
  const st=new THREE.Group(); st.add(new THREE.Mesh(new THREE.BoxGeometry(0.6,0.05,1.9),phong({color:0x3e4a36})));
  for(const sx of [-1,1]){ const pl=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,2.3),matDark); pl.position.x=sx*0.33; st.add(pl); }
  st.position.set(4.2,0.12,10.5); st.rotation.y=0.8; st.traverse(o=>o.castShadow=true); scene.add(st);
  for(let k=0;k<6;k++){ const m=addMesh(new THREE.BoxGeometry(0.05,0.02,0.16),matDark,rand(-6,9),0.02,rand(-22,-15)); m.rotation.y=rand(0,3); }
  const rifle=addMesh(new THREE.BoxGeometry(0.07,0.06,0.95),matDark,-5.2,0.04,-19.5); rifle.rotation.y=1.1;
  for(let k=0;k<5;k++){ const b=addMesh(new THREE.BoxGeometry(0.66,0.3,0.45),matSand,rand(-7,7),0.15,rand(-26,-17)); b.rotation.y=rand(0,3); }
  // torn evacuation banner strung across Wolcott
  const ban=textTex(1024,96,(g,w,h)=>{ g.fillStyle='#d6d0c0'; g.fillRect(0,0,w,h); g.fillStyle='#24467a'; g.fillRect(0,0,w,14); g.fillRect(0,h-14,w,14);
    g.fillStyle='#1d2a3a'; g.textAlign='center'; g.textBaseline='middle'; fitText(g,'EVACUATION ROUTE ▲ CENTRAL STAGING ▲ FOLLOW POSTED INSTRUCTIONS',w-60,52,'bold PX Impact, sans-serif');
    g.fillText('EVACUATION ROUTE ▲ CENTRAL STAGING ▲ FOLLOW POSTED INSTRUCTIONS',w/2,h/2);
    g.globalCompositeOperation='destination-out'; g.beginPath(); g.moveTo(w*0.62,0); for(let y=0;y<=h;y+=8) g.lineTo(w*0.62+rand(-14,14),y); g.lineTo(w,h); g.lineTo(w,0); g.fill();
    for(let i=0;i<5;i++){ g.beginPath(); g.arc(rand(0,w*0.6),rand(0,h),rand(4,14),0,7); g.fill(); } });
  const bm=new THREE.Mesh(new THREE.PlaneGeometry(25,2.3),decalMat(ban,{polygonOffset:false,depthWrite:true}));
  bm.position.set(0,7.2,-72); bm.rotation.x=-0.45; onCharLayer(bm); scene.add(bm);
  const flap=new THREE.Mesh(new THREE.PlaneGeometry(9.5,2.3),decalMat(textTex(64,16,(g,w,h)=>{ g.fillStyle='#cfc8b6'; g.fillRect(0,0,w,h); g.fillStyle='#24467a'; g.fillRect(0,0,w,2); g.fillRect(0,h-2,w,2); }),{polygonOffset:false,depthWrite:true}));
  flap.position.set(9.1,3.6,-72.3); flap.rotation.set(-0.15,0.1,1.45); onCharLayer(flap); scene.add(flap);
  for(const sx of [-1,1]) addMesh(new THREE.CylinderGeometry(0.02,0.02,25,3),matDark,0,7.95,-72.3).rotation.z=Math.PI/2;
}
// storefronts down both sides of Wolcott
const SHOPS=[['CARNICERIA LA ROSITA','#7a2a22','#e8d8b0'],['LAVANDERIA','#2a4a6a','#e8e4d8'],['TAQUERIA EL SOL','#c8a030','#3a1a10'],['FARMACIA','#2a6a4a','#f0f0e8'],
  ['CELL PHONE REPAIR','#1a1c22','#d84a4a'],['LIQUORS','#6a1a1a','#f0d070'],['PANADERIA','#e0c890','#6a2a1a'],['BARBER SHOP','#e8e4dc','#2a3a6a'],['DOLLAR PLUS','#2a8a4a','#f8f0a0'],
  ['LLANTAS · TIRES','#c8b830','#1a1a1a'],['EL MERCADITO','#a03a2a','#f0e0b0'],['CHECKS CASHED','#1a3a6a','#f0d050'],['PIZZA & SUBS','#2a6a2a','#f0e8d8'],['DENTISTA','#3a6a8a','#ffffff'],
  ['MUEBLES','#5a3a2a','#e8d0a0'],['TORTILLERIA','#d8a040','#5a1a10'],['SEGUROS · INSURANCE','#2a2a5a','#f0f0f0'],['PAWN · EMPEÑO','#6a5a1a','#f8e8a0'],['FLORERIA','#b85a7a','#fff0f4']];
const AWN=[0x6a2a24,0x2a4a3a,0x2c3e5a,0x7a6a2a,0x5a2a4a,0x3a3a3a];
const BOARD_MSG=['NO ONE\nINSIDE','DEAD\nINSIDE','THEY FOLLOW\nNOISE','DONT GO\nNORTH','MARIA + KIDS\n→ ST PIUS','WATER\nINSIDE →','EVAC\nCANCELLED?','STILL HERE\nDAY 9'];
const TAGS=['KOZE','REYNA','SPOOK','ZURDO','NOX','BEBO','LTD','MOTA','SK8','ROJO'];
const TAG_COL=['#e05aa0','#4ac0b8','#f0f0e8','#d84a3a','#e8d050','#8a6ad8'];
const plyTex=textTex(128,128,(g,w,h)=>{ g.fillStyle='#8a7a5a'; g.fillRect(0,0,w,h); g.strokeStyle='rgba(50,40,25,.5)'; for(let y=0;y<h;y+=32){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); }
  g.fillStyle='rgba(60,45,25,.25)'; for(let i=0;i<40;i++) g.fillRect(rand(0,w),rand(0,h),rand(10,40),1); });
const matShutter=phong({map:canvasTex(16,32,(g,w,h)=>{ g.fillStyle='#6a6e72'; g.fillRect(0,0,w,h); g.fillStyle='#55595c'; for(let y=0;y<h;y+=3) g.fillRect(0,y,w,1); })});
let shopN=0, msgN=0;
for(const b of frontBlocks){
  for(let z=b.z0+3;z<b.z1-3;z+=rand(7,10)){
    if(z<-112||z>112) continue;
    const side=b.side, nm=SHOPS[shopN++%SHOPS.length];
    // awning over the sidewalk
    const aw=new THREE.Mesh(new THREE.BoxGeometry(1.3,0.08,4.2),phong({color:AWN[Math.random()*AWN.length|0]}));
    aw.position.set(side*11.85,3.0,z); aw.rotation.z=side*0.28; aw.castShadow=true; aw.receiveShadow=true; scene.add(aw);
    // sign
    const st=textTex(512,96,(g,w,h)=>{ g.fillStyle=nm[1]; g.fillRect(0,0,w,h); g.fillStyle=nm[2]; g.textAlign='center'; g.textBaseline='middle';
      fitText(g,nm[0],w-36,66,'bold PX Impact, "Arial Black", sans-serif'); g.fillText(nm[0],w/2,h/2+2);
      g.globalCompositeOperation='destination-out'; for(let i=0;i<26;i++){ g.globalAlpha=rand(.1,.5); g.fillRect(rand(0,w),rand(0,h),rand(10,60),rand(2,8)); } });
    wallDecal(st,side,z,3.75,4.2,0.78);
    // window: glass, shutter, or plywood with a message
    const r=Math.random();
    if(r<0.45){ const gl=new THREE.Mesh(new THREE.PlaneGeometry(3.4,2.1),matGlass); gl.position.set(side*12.47,1.3,z); gl.rotation.y=side>0?-Math.PI/2:Math.PI/2; scene.add(gl); }
    else if(r<0.72){ const sh=new THREE.Mesh(new THREE.PlaneGeometry(3.6,2.5),matShutter); sh.position.set(side*12.47,1.25,z); sh.rotation.y=side>0?-Math.PI/2:Math.PI/2; scene.add(sh);
      wallDecal(sprayTex(TAGS[Math.random()*TAGS.length|0],TAG_COL[Math.random()*TAG_COL.length|0],{outline:'rgba(20,20,20,.8)',px:120}),side,z+rand(-.3,.3),1.3,3.0,1.0); }
    else { const pw=new THREE.Mesh(new THREE.PlaneGeometry(3.5,2.3),phong({map:plyTex})); pw.position.set(side*12.46,1.25,z); pw.rotation.y=side>0?-Math.PI/2:Math.PI/2; onCharLayer(pw); scene.add(pw);
      wallDecal(sprayTex(BOARD_MSG[msgN++%BOARD_MSG.length],Math.random()<.6?'#f0ece0':'#c8382a',{px:70,stroke:2}),side,z,1.3,3.2,1.6).position.x=side*12.43; }
  }
}
// faded painted ads high on the walls
const ADS=[['COLD BEER · CERVEZA FRIA','#a8402a','#efe2c8'],['INJURED? 312-555-0148 · ABOGADOS','#25406a','#f2ead8'],['LA FIESTA 104.3 FM','#c88a2a','#2a1a10'],['WE BUY GOLD · COMPRAMOS ORO','#6a5a20','#f4e6a8'],['FUEGO CHIPS · HOT HOT HOT','#b8301a','#f8d860']];
{ const picks=frontBlocks.filter(b=>b.h>18&&b.z1-b.z0>12&&b.z0>-100&&b.z1<100).sort(()=>Math.random()-.5).slice(0,5);
  picks.forEach((b,k)=>{ const ad=ADS[k%ADS.length];
    const t=textTex(512,256,(g,w,h)=>{ g.fillStyle=ad[1]; g.fillRect(0,0,w,h); g.fillStyle=ad[2]; g.textAlign='center'; g.textBaseline='middle';
      const words=ad[0].split(' · '); words.forEach((wd,i)=>{ fitText(g,wd,w-50,90,'bold PX Impact, sans-serif'); g.fillText(wd,w/2,h*(words.length===1?0.5:0.33+i*0.36)); });
      g.globalCompositeOperation='destination-out'; for(let i=0;i<120;i++){ g.globalAlpha=rand(.15,.6); g.fillRect(rand(0,w),rand(0,h),rand(6,50),rand(3,14)); } });
    wallDecal(t,b.side,(b.z0+b.z1)/2+rand(-2,2),rand(8.5,Math.min(b.h-4,13)),8,4,{opacity:0.78}); }); }
// street signs at the corner
{
  const blade=(txt)=>textTex(256,48,(g,w,h)=>{ g.fillStyle='#1f5a3a'; g.fillRect(0,0,w,h); g.strokeStyle='#e8ece4'; g.lineWidth=3; g.strokeRect(3,3,w-6,h-6); g.fillStyle='#f0f2ec'; g.textAlign='center'; g.textBaseline='middle'; fitText(g,txt,w-24,34,'bold PX Arial, sans-serif'); g.fillText(txt,w/2,h/2+1); });
  for(const [px,pz] of [[11.3,-22.2],[-11.4,-41.8]]){
    addMesh(new THREE.CylinderGeometry(0.06,0.06,3.6,5),phong({color:0x3a4a3e}),px,1.8,pz);
    const a=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.3,0.03),[matDark,matDark,matDark,matDark,phong({map:blade('S WOLCOTT AV')}),phong({map:blade('S WOLCOTT AV')})]); a.position.set(px,3.45,pz); a.rotation.y=Math.PI/2; onCharLayer(a); scene.add(a);
    const c=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.3,0.03),[matDark,matDark,matDark,matDark,phong({map:blade('W 18TH ST  1800 S')}),phong({map:blade('W 18TH ST  1800 S')})]); c.position.set(px,3.15,pz); onCharLayer(c); scene.add(c);
  }
  const stop=textTex(256,128,(g,w,h)=>{ g.fillStyle='#e8e4d8'; g.fillRect(0,0,w,h); g.fillStyle='#9a2a20'; g.fillRect(0,0,w,40); g.fillStyle='#f4f0e8'; g.textAlign='center'; g.font='bold 30px Impact, sans-serif'; g.fillText('STOP',w/2,32);
    g.fillStyle='#1a1a1a'; g.font='bold 22px Impact, sans-serif'; g.fillText('MILITARY CHECKPOINT',w/2,72); g.font='16px Arial'; g.fillText('HAVE ID READY · NO WEAPONS',w/2,104); });
  addMesh(new THREE.CylinderGeometry(0.04,0.04,1.6,4),matDark,8.2,0.8,-23.2);
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(1.3,0.65),phong({map:stop,side:THREE.DoubleSide})); sg.position.set(8.2,1.7,-23.15); sg.rotation.x=-0.25; onCharLayer(sg); scene.add(sg);
}
// paint on the street and walls from people who were here
groundDecal(sprayTex('TURN BACK','#e8e6dc',{px:130,stroke:2,tilt:0}),0,-56,10,3.2,0);
groundDecal(sprayTex('SOS','#e8e6dc',{px:140,tilt:0}),44,-31.5,6,2.4,0);
groundDecal(sprayTex('HELP','#d8d4c8',{px:120,tilt:0.05}),-2,64,7,2.6,0);
for(let k=0;k<22;k++){ const side=Math.random()<.5?-1:1, z=rand(-105,105); if(z>CR_Z0-3&&z<CR_Z1+3) continue; if(side<0&&z>SHOP.z0-1&&z<SHOP.z1+1) continue;
  wallDecal(sprayTex(TAGS[Math.random()*TAGS.length|0],TAG_COL[Math.random()*TAG_COL.length|0],{outline:Math.random()<.5?'rgba(15,15,15,.85)':null,px:120}),side,z,rand(0.9,2.4),rand(2,3.4),rand(.7,1.1)); }
for(const [side,z,msg,col] of [[1,-9,'THEY HEAR\nYOU','#f0ece0'],[-1,-30.5,'HELP\n4TH FLOOR','#f0ece0'],[1,40,'2 ALIVE ↑','#d84a3a'],[-1,-64,'NO ONE\nLEFT','#f0ece0'],[1,-86,'EVAC\nWAS A LIE','#d84a3a'],[-1,30,'FERRETERIA\nHAS WATER →','#f0ece0']]){
  if(z>CR_Z0-2&&z<CR_Z1+2) continue;
  wallDecal(sprayTex(msg,col,{px:80,stroke:2}),side,z,rand(1.6,2.6),3.6,1.6);
}
// search marks the sweep teams sprayed on doors
const xTex=textTex(128,128,(g,w,h)=>{ g.strokeStyle='#d84a2a'; g.lineWidth=7; g.beginPath(); g.moveTo(16,16); g.lineTo(112,112); g.moveTo(112,16); g.lineTo(16,112); g.stroke();
  g.fillStyle='#d84a2a'; g.font='bold 18px Impact'; g.textAlign='center'; g.fillText('9-14',64,22); g.fillText('0',26,70); g.fillText('2',104,70); g.fillText('2PLT',64,120); });
wallDecal(xTex,1,-2,1.6,1.3,1.3); wallDecal(xTex,-1,-48,1.6,1.3,1.3); wallDecal(xTex,1,58,1.6,1.3,1.3);

/* ---------- barricade ---------- */
const segs=[];
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
    th:rand(0.05,0.5),dx:rand(-1,1),dz:rand(-1,1),tilt:rand(-1,1),gone:false}; });
  segs.push({x0,x1,z0:BZ-0.75,z1:BZ+0.75,hp:max,max,mesh:g,alive:true,kind,pieces});
}
addSeg(-12,-7,'jersey'); addSeg(-7,-1.5,'car'); addSeg(-1.5,3,'jersey'); addSeg(3,7,'sand'); addSeg(7,12,'jersey');
// work light on a tripod + burning barrel
const matLamp=new THREE.MeshBasicMaterial({color:0xffe2b0});
addMesh(new THREE.CylinderGeometry(0.06,0.08,3.4,5),matDark,LIGHT_WORK.x,1.7,LIGHT_WORK.z);
const lampHead=addMesh(new THREE.BoxGeometry(0.7,0.35,0.3),matLamp,LIGHT_WORK.x,3.5,LIGHT_WORK.z-0.1,false,false);
addMesh(new THREE.CylinderGeometry(0.42,0.42,1.0,8),matRust2,LIGHT_BARREL.x,0.5,LIGHT_BARREL.z);
const matFire=new THREE.MeshBasicMaterial({color:0xff9a42});
const fireTop=addMesh(new THREE.CylinderGeometry(0.36,0.36,0.08,8),matFire,LIGHT_BARREL.x,1.02,LIGHT_BARREL.z,false,false);
// crates behind the line
for(let i=0;i<5;i++) addMesh(new THREE.BoxGeometry(0.9,0.5,0.6),phong({color:0x4e4a34}),rand(-10,10),0.25,rand(-9,-5));

/* ---------- lights (fixed count, toggled by intensity) ---------- */
const ambient=new THREE.AmbientLight(0x66707e,0.6); scene.add(ambient);
const moon=new THREE.DirectionalLight(0xe6e0d2,0.9);
moon.castShadow=true; moon.shadow.mapSize.set(2048,2048);
const sc=moon.shadow.camera; sc.left=-95;sc.right=95;sc.top=95;sc.bottom=-95;sc.near=1;sc.far=360; moon.shadow.bias=-0.0009;
const sunOff=new THREE.Vector3(-55,95,-35);
scene.add(moon); scene.add(moon.target);
const workLight=new THREE.PointLight(0xffd29a,1.5,28,2); workLight.position.set(LIGHT_WORK.x,3.3,LIGHT_WORK.z-0.4); scene.add(workLight);
const barrelLight=new THREE.PointLight(0xff8a3a,1.3,16,2); barrelLight.position.set(LIGHT_BARREL.x,1.6,LIGHT_BARREL.z); scene.add(barrelLight);
const doorLight=new THREE.PointLight(0xffb06a,1.3,16,2); doorLight.position.set(-16.5,3.2,DOOR.z); scene.add(doorLight);
const flashes=[0,1].map(()=>{const l=new THREE.PointLight(0xffd08a,0,19,2);scene.add(l);return {l,t:0};});
// one streetlamp that still half works, a burning car, two road flares
const LAMP={x:10.0,z:-52}, CARFIRE={x:5.5,z:-24};
const lampLight=new THREE.PointLight(0xd8e2ff,1.2,20,2); lampLight.position.set(LAMP.x,5.6,LAMP.z); scene.add(lampLight);
const lampBulb=addMesh(new THREE.BoxGeometry(0.5,0.12,0.3),new THREE.MeshBasicMaterial({color:0xdfe6ff}),LAMP.x,5.92,LAMP.z,false,false);
const carLight=new THREE.PointLight(0xff7a2a,1.8,22,2); carLight.position.set(CARFIRE.x,2.2,CARFIRE.z); scene.add(carLight);
const flares=[0,1].map(()=>{
  const l=new THREE.PointLight(0xff2a1e,0,15,2); scene.add(l);
  const m=addMesh(new THREE.CylinderGeometry(0.05,0.05,0.35,5),new THREE.MeshBasicMaterial({color:0xff4030}),0,0.08,0,false,false);
  m.rotation.z=Math.PI/2; m.visible=false;
  return {l,m,x:0,z:0,on:false};
});
function placeFlares(){
  for(const f of flares){ f.x=rand(-9,9); f.z=rand(-62,-30); if(f.z>CR_Z0-1&&f.z<CR_Z1+1) f.z=CR_Z1+rand(2,5);
    f.l.position.set(f.x,0.5,f.z); f.m.position.set(f.x,0.08,f.z); f.m.rotation.y=rand(0,3); f.on=true; f.m.visible=true; }
}
scene.traverse(o=>{ if(o.isLight) o.layers.enableAll(); });
moon.shadow.camera.layers.enableAll();
let flashIdx=0;
