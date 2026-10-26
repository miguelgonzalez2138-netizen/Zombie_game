'use strict';
// Fog Line — Tracers, mist, halos, beams, fire and smoke, pigeons, rats, trash, windows, spatial grid, walkable space.
// Classic script: shares globals with the other files, load order matters (see index.html).

let bIdx=0; const bF=new Float32Array(MAXB);
const imBrass=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018,0.018,0.07,5).rotateZ(Math.PI/2),new THREE.MeshPhongMaterial({color:0xb08a3e,specular:0xffe2a0,shininess:80}),MAXB);
imBrass.frustumCulled=false; imBrass.instanceMatrix.setUsage(THREE.DynamicDrawUsage); onCharLayer(imBrass); scene.add(imBrass);
for(let i=0;i<MAXB;i++) imBrass.setMatrixAt(i,zeroM);
function eject(s){
  bIdx=(bIdx+1)%MAXB; const j=bIdx, a=s.ang, rx=Math.cos(a), rz=-Math.sin(a);
  bX[j]=s.x+rx*0.25+Math.sin(a)*0.2; bY[j]=(s.y||0)+1.5; bF[j]=s.y||0; bZ[j]=s.z+rz*0.25+Math.cos(a)*0.2;
  bVX[j]=rx*rand(2,3.4)-Math.sin(a)*rand(.3,.9); bVZ[j]=rz*rand(2,3.4)-Math.cos(a)*rand(.3,.9); bVY[j]=rand(1.8,3); bR[j]=rand(0,6); bLive[j]=1;
}
function updateBrass(dt){
  let any=false;
  for(let j=0;j<MAXB;j++){ if(!bLive[j]) continue; any=true;
    bVY[j]-=14*dt; bX[j]+=bVX[j]*dt; bY[j]+=bVY[j]*dt; bZ[j]+=bVZ[j]*dt; bR[j]+=dt*25;
    if(bY[j]<bF[j]+0.03){ bY[j]=bF[j]+0.03; if(Math.abs(bVY[j])>1){ bVY[j]*=-0.35; bVX[j]*=0.5; bVZ[j]*=0.5; const ps=squad[me]; const d=Math.hypot(bX[j]-ps.x,bZ[j]-ps.z); if(AC&&d<10&&Math.random()<.5) SFX.tink(0,0.5/(1+d*0.4)); }
      else { bLive[j]=0; bR[j]=rand(0,6); } }
    dummy.position.set(bX[j],bY[j],bZ[j]); dummy.rotation.set(0,bR[j],bLive[j]?bR[j]*0.6:0); dummy.scale.set(1,1,1); dummy.updateMatrix(); imBrass.setMatrixAt(j,dummy.matrix);
  }
  if(any) imBrass.instanceMatrix.needsUpdate=true;
}
// sparks, dust and chips where a round lands: on a wall if it hit one, otherwise on the floor
function impact(hx,hz,y0,ux,uz,wall){
  const hp={x:hx,z:hz,wall}, y=wall?y0+rand(0.8,1.8):y0+0.05;
  for(let k=0;k<6;k++) emit(true,hp.x,y,hp.z,-ux*rand(1,4)+rand(-2,2),rand(.5,3),-uz*rand(1,4)+rand(-2,2),rand(.08,.18),rand(.12,.2),0.04,0xffe0a0,1);
  emit(false,hp.x,y,hp.z,-ux*0.6,rand(.3,.7),-uz*0.6,rand(.7,1.2),0.3,1.4,0x9a9690,0.45);
  chips(hp.x,y,hp.z,hp.wall?4:3,-ux,-uz,hp.wall?0x8a8f92:0x34373b);
  if(!hp.wall&&y0<0.5&&Math.random()<.5) splat(hp.x,hp.z,0.09,0.09);
  return hp;
}
function updateSegVisual(g){
  const r=g.alive?g.hp/g.max:0, dmg=1-r;
  for(const p of g.pieces){
    const gone=r<p.th;
    if(gone&&!p.gone&&g.mesh.visible){ const wx=g.mesh.position.x+p.pos.x, wz=BZ+p.pos.z; chips(wx,0.6,wz,8,0,-1,0x8a8f92); emit(false,wx,0.5,wz,0,0.6,0,1.4,0.5,2.4,0x8a8680,0.5); }
    p.gone=gone; p.m.visible=!gone;
    p.m.position.set(p.pos.x+p.dx*dmg*0.18,p.pos.y-dmg*0.06*Math.abs(p.tilt),p.pos.z+p.dz*dmg*0.2);
    p.m.rotation.set(p.rot.x+p.tilt*dmg*0.25,p.rot.y+p.dx*dmg*0.3,p.rot.z+p.tilt*dmg*0.2);
    p.m.material.color.copy(p.col).multiplyScalar(1-dmg*0.45);
  }
}

/* tracers */
const tracers=[];
const matTracer=new THREE.LineBasicMaterial({color:0xffc35a,fog:false,transparent:true});
for(let i=0;i<28;i++){
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,0,0],3));
  const l=new THREE.Line(g,matTracer); l.visible=false; l.frustumCulled=false; onCharLayer(l); scene.add(l); tracers.push({l,t:0});
}
let trIdx=0;
function tracer(x0,z0,x1,z1,y){
  const t=tracers[trIdx]; trIdx=(trIdx+1)%tracers.length; y=y||0;
  const p=t.l.geometry.attributes.position; p.setXYZ(0,x0,y+1.3,z0); p.setXYZ(1,x1,y+1.1,z1); p.needsUpdate=true;
  t.l.visible=true; t.t=0.05;
}

/* ---------- atmosphere: knee-high mist, halos, beams, fire & smoke ---------- */
const MAXFL=14;
const fxL=[]; // light sources the mist glows around: {x,y,z,r,col,k}
function fxLight(x,y,z,r,hex){ const o={x,y,z,r,col:new THREE.Color(hex),k:0}; fxL.push(o); return o; }
const mistU={uTime:{value:0},uCol:{value:new THREE.Color(0x3a3631)},uDen:{value:0.3},uCenter:{value:new THREE.Vector2()},
  uLP:{value:Array.from({length:MAXFL},()=>new THREE.Vector4())},uLC:{value:Array.from({length:MAXFL},()=>new THREE.Vector3())}};
const MIST_V='varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }';
const MIST_F=`uniform float uTime,uDen,uScale,uAmt; uniform vec2 uWind,uCenter; uniform vec3 uCol; uniform vec4 uLP[${MAXFL}]; uniform vec3 uLC[${MAXFL}]; varying vec3 vW;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y); }
float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
void main(){
  vec2 p=vW.xz*uScale+uWind*uTime;
  float n=fbm(p+fbm(p*0.6+uTime*0.04)*1.6);
  float a=smoothstep(0.32,0.82,n)*uDen*uAmt;
  vec3 glow=vec3(0.0);
  for(int i=0;i<${MAXFL};i++){ vec4 L=uLP[i]; if(L.w<=0.0) continue; float d=length(vW-L.xyz); float g=1.0-smoothstep(0.0,L.w,d); glow+=uLC[i]*g*g; }
  float gl=max(glow.r,max(glow.g,glow.b));
  a=clamp(a+gl*0.45*uDen*uAmt*(0.5+n),0.0,0.95);
  a*=1.0-smoothstep(42.0,62.0,length(vW.xz-uCenter));
  gl_FragColor=vec4(uCol+glow*1.6,a);
}`;
const mists=[];
for(const [y,scale,amt,wx,wz] of [[0.3,0.09,1.0,0.5,-0.2],[0.7,0.07,0.9,0.65,-0.3],[1.15,0.055,0.7,0.8,-0.35],[3.2,0.03,0.45,1.0,-0.45],[6.5,0.018,0.32,1.3,-0.55]]){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(130,130),new THREE.ShaderMaterial({
    uniforms:Object.assign({},mistU,{uScale:{value:scale},uAmt:{value:amt},uWind:{value:new THREE.Vector2(wx,wz)}}),
    vertexShader:MIST_V,fragmentShader:MIST_F,transparent:true,depthWrite:false,depthTest:true}));
  m.rotation.x=-Math.PI/2; m.position.y=y; m.frustumCulled=false; m.renderOrder=10+mists.length; onFxLayer(m); scene.add(m); mists.push(m);
}
// soft round sprite texture for halos, fire, smoke
function glowTex(stops){
  const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32); stops.forEach(([o,col])=>gr.addColorStop(o,col)); g.fillStyle=gr; g.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c); return t;
}
const texHalo=glowTex([[0,'rgba(255,255,255,1)'],[0.2,'rgba(255,255,255,.45)'],[0.6,'rgba(255,255,255,.08)'],[1,'rgba(255,255,255,0)']]);
const texSoft=glowTex([[0,'rgba(255,255,255,1)'],[0.5,'rgba(255,255,255,.5)'],[1,'rgba(255,255,255,0)']]);
const texFlash=(()=>{ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  g.translate(32,32); for(let i=0;i<6;i++){ g.rotate(Math.PI/3+rand(-.2,.2)); const gr=g.createLinearGradient(0,0,30,0); gr.addColorStop(0,'rgba(255,240,200,1)'); gr.addColorStop(1,'rgba(255,180,80,0)'); g.fillStyle=gr; g.beginPath(); g.moveTo(0,-3); g.lineTo(30,0); g.lineTo(0,3); g.fill(); }
  const gr=g.createRadialGradient(0,0,0,0,0,14); gr.addColorStop(0,'rgba(255,250,230,1)'); gr.addColorStop(1,'rgba(255,200,120,0)'); g.fillStyle=gr; g.beginPath(); g.arc(0,0,14,0,7); g.fill();
  return new THREE.CanvasTexture(c); })();
function makeSprite(tex,hex,additive,scale){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:hex,transparent:true,depthWrite:false,fog:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending}));
  s.scale.setScalar(scale); onFxLayer(s); scene.add(s); return s;
}
const halos=[]; // {spr,src:fxLight-like getter, base}
function halo(x,y,z,hex,size,base){ const spr=makeSprite(texHalo,hex,true,size); spr.position.set(x,y,z); const h={spr,base,k:1,size}; halos.push(h); return h; }
// flashlight beams
const CONE_V='varying float vA; varying vec3 vN; varying vec3 vV; void main(){ vA=uv.y; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }';
const CONE_F='uniform float uOp; uniform vec3 uCol; varying float vA; varying vec3 vN; varying vec3 vV; void main(){ float e=pow(abs(dot(normalize(vN),normalize(vV))),1.6); gl_FragColor=vec4(uCol,pow(vA,1.6)*e*uOp); }';
function makeCone(len,ang){
  const geo=new THREE.ConeGeometry(Math.tan(ang)*len,len,18,1,true).translate(0,-len/2,0).rotateX(-Math.PI/2);
  const m=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:{uOp:{value:0},uCol:{value:new THREE.Color(0xfff2d8)}},vertexShader:CONE_V,fragmentShader:CONE_F,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
  m.rotation.order='YXZ'; m.frustumCulled=false; onFxLayer(m); scene.add(m); return m;
}
// particle pool: fire (additive) and smoke (normal)
const PARTS=[];
for(let i=0;i<260;i++){ const add=i<110; const spr=makeSprite(add?texSoft:texSoft,add?0xff8a3a:0x8a8f96,add,1); spr.visible=false; PARTS.push({spr,add,live:false}); }
let partIdx=0;
function emit(add,x,y,z,vx,vy,vz,life,s0,s1,hex,op){
  for(let n=0;n<PARTS.length;n++){ partIdx=(partIdx+1)%PARTS.length; const q=PARTS[partIdx]; if(q.add!==add||q.live) continue;
    Object.assign(q,{live:true,x,y,z,vx,vy,vz,t:0,life,s0,s1,op}); q.spr.material.color.setHex(hex); q.spr.visible=true; return q; }
}
function updateParts(dt){
  const wx=(0.4+G.gust*1.6), wz=-(0.2+G.gust*0.7);
  for(const q of PARTS){ if(!q.live) continue;
    q.t+=dt; if(q.t>=q.life){ q.live=false; q.spr.visible=false; continue; }
    const u=q.t/q.life;
    if(!q.add){ q.vx=lerp(q.vx,wx,dt*0.8); q.vz=lerp(q.vz,wz,dt*0.8); }
    q.x+=q.vx*dt; q.y+=q.vy*dt; q.z+=q.vz*dt;
    q.spr.position.set(q.x,q.y,q.z); q.spr.scale.setScalar(lerp(q.s0,q.s1,u));
    q.spr.material.opacity=q.op*(q.add?(1-u):Math.sin(u*Math.PI));
  }
}
function fireAt(x,y,z,rate,dt,smoke){
  if(Math.random()<rate*dt) emit(true,x+rand(-.35,.35),y,z+rand(-.35,.35),rand(-.2,.2),rand(1.2,2.4),rand(-.2,.2),rand(.35,.7),rand(.6,1),rand(.1,.3),Math.random()<.5?0xff7a28:0xffb04a,0.9);
  if(smoke&&Math.random()<rate*0.35*dt) emit(false,x+rand(-.3,.3),y+0.8,z+rand(-.3,.3),0,rand(0.9,1.5),0,rand(4,7),rand(.8,1.2),rand(3.5,6),0x6a6f75,0.32);
}

const H={
  work:halo(LIGHT_WORK.x,3.5,LIGHT_WORK.z-0.1,0xffe0b0,4.2,0.28), barrel:halo(LIGHT_BARREL.x,1.4,LIGHT_BARREL.z,0xff8a3a,5,0.5),
  door:halo(DOOR.x+0.4,1.6,DOOR.z,0xffb06a,3.5,0.3), lamp:halo(LAMP.x,5.8,LAMP.z,0xc8d4ff,6,0.5), car:halo(CARFIRE.x,1.8,CARFIRE.z,0xff7a2a,8,0.6),
  f0:halo(0,0.4,0,0xff3020,4.5,0.7), f1:halo(0,0.4,0,0xff3020,4.5,0.7),
};
const muzzle=[0,1].map(()=>{ const s=makeSprite(texFlash,0xffe8c0,true,1.9); s.visible=false; return s; });
forEachSoldier(s=>{ s.halo=makeSprite(texHalo,0xfff2d8,true,1.1); });
const FL={work:fxLight(LIGHT_WORK.x,3.3,LIGHT_WORK.z,9,0xffd29a),barrel:fxLight(LIGHT_BARREL.x,1.2,LIGHT_BARREL.z,6,0xff8a3a),door:fxLight(DOOR.x+0.6,1.8,DOOR.z,5,0xffb06a),
  lamp:fxLight(LAMP.x,5,LAMP.z,7,0xc8d4ff),car:fxLight(CARFIRE.x,1.6,CARFIRE.z,9,0xff7a2a),f0:fxLight(0,0.5,0,6,0xff2a1e),f1:fxLight(0,0.5,0,6,0xff2a1e),
  mz0:fxLight(0,1.5,0,7,0xffd08a),mz1:fxLight(0,1.5,0,7,0xffd08a),me:fxLight(0,1.2,0,6,0xfff0d0),
  boom:fxLight(0,1,0,12,0xffb060),fire0:fxLight(0,1,0,7,0xff7a2a),fire1:fxLight(0,1,0,7,0xff7a2a)};
forEachSoldier(s=>{ s.cone=makeCone(s.i===0?13:10,0.3); });

/* ---------- small signs of life ---------- */
const birds=[], BIRD_HOMES=[{x:-10.9,z:-3.5},{x:9.6,z:19},{x:3.5,z:-31},{x:-8.5,z:44},{x:-2.5,z:3.5},{x:10.6,z:-58}];
const matPig=phong({color:0x77736d}), matPig2=phong({color:0x56534f}), matBeak=phong({color:0x8c7a5a});
BIRD_HOMES.forEach((h,hi)=>{
  const n=4+(Math.random()*5|0);
  for(let k=0;k<n;k++){
    const g=new THREE.Group();
    const bx=(w,hh,d,m,x,y,z)=>{const q=new THREE.Mesh(new THREE.BoxGeometry(w,hh,d),m);q.position.set(x,y,z);q.castShadow=true;g.add(q);return q;};
    bx(0.17,0.14,0.3,matPig,0,0.12,0); const head=bx(0.1,0.1,0.11,matPig2,0,0.23,0.15); bx(0.03,0.03,0.05,matBeak,0,0.22,0.22);
    bx(0.09,0.03,0.12,matPig2,0,0.13,-0.2);
    const wl=new THREE.Group(), wr=new THREE.Group(); wl.position.set(-0.08,0.17,0); wr.position.set(0.08,0.17,0); g.add(wl); g.add(wr);
    const wg=new THREE.BoxGeometry(0.26,0.02,0.17); const a=new THREE.Mesh(wg,matPig2); a.position.x=-0.13; wl.add(a); const b=new THREE.Mesh(wg,matPig2); b.position.x=0.13; wr.add(b);
    g.scale.setScalar(1.1); onCharLayer(g); scene.add(g);
    const hx=h.x+rand(-1.8,1.8), hz=h.z+rand(-1.8,1.8);
    birds.push({g,wl,wr,head,home:hi,hx,hz,x:hx,y:0,z:hz,vx:0,vy:0,vz:0,state:'idle',t:rand(0,2),ang:rand(0,6.28),ph:Math.random()*6});
  }
});
function scareBird(b,fx,fz){
  if(b.state==='flying'||b.state==='gone') return;
  let dx=b.x-fx, dz=b.z-fz, d=Math.hypot(dx,dz)||1; dx/=d; dz/=d;
  const sp=rand(4,7); b.vx=dx*sp+rand(-1,1); b.vz=dz*sp+rand(-1,1); b.vy=rand(3.5,6); b.state='flying';
  const now=performance.now(); if(AC&&now-amb.lastFlutter>600){ amb.lastFlutter=now; const p=squad[me]; const dd=Math.hypot(b.x-p.x,b.z-p.z); SFX.flutter(clamp((b.x-p.x)/15,-1,1),0.9/(1+dd*0.12)); }
}
function scareBirds(x,z,r){ for(const b of birds) if(Math.hypot(b.x-x,b.z-z)<r) scareBird(b,x,z); }
function updateBirds(dt,time){
  const day=G.phase==='day'||G.phase==='dawn';
  for(const b of birds){
    if(b.state==='idle'){
      if(!day){ b.state='gone'; b.t=rand(5,20); b.g.visible=false; continue; }
      b.t-=dt;
      if(b.t<=0){ b.t=rand(.6,2.6); b.ang+=rand(-1.6,1.6); if(Math.random()<.4){ const nx=b.x+Math.sin(b.ang)*0.35, nz=b.z+Math.cos(b.ang)*0.35; if(Math.hypot(nx-b.hx,nz-b.hz)<2.4){b.x=nx;b.z=nz;} } }
      const peck=Math.max(0,Math.sin(time*7+b.ph));
      b.head.position.y=0.23-peck*0.09; b.head.position.z=0.15+peck*0.05;
      b.wl.rotation.z=0; b.wr.rotation.z=0;
      for(const s of squad){ if(s.alive&&Math.hypot(s.x-b.x,s.z-b.z)<2.6){ scareBird(b,s.x,s.z); break; } }
      if(b.state==='idle') eachNear(b.x,b.z,4,j=>{ if(zst[j]&&b.state==='idle'&&Math.hypot(zx[j]-b.x,zz[j]-b.z)<3.5) scareBird(b,zx[j],zz[j]); });
    } else if(b.state==='flying'){
      b.vy+=dt*1.2; b.x+=b.vx*dt; b.y+=b.vy*dt; b.z+=b.vz*dt; b.ang=Math.atan2(b.vx,b.vz);
      const f=Math.sin(time*34+b.ph)*0.9; b.wl.rotation.z=f; b.wr.rotation.z=-f;
      if(b.y>45){ b.state='gone'; b.t=rand(25,55); b.g.visible=false; }
    } else if(b.state==='gone'){
      if(day){ b.t-=dt; if(b.t<=0&&G.noise<0.08){ b.state='landing'; b.x=b.hx+rand(-25,25); b.z=b.hz+rand(-25,25); b.y=rand(28,40); b.g.visible=true; } }
    } else if(b.state==='landing'){
      const dx=b.hx-b.x, dz=b.hz-b.z, d=Math.hypot(dx,dz);
      const sp=Math.min(6,d*1.2+1); b.x+=dx/(d||1)*sp*dt; b.z+=dz/(d||1)*sp*dt; b.y=Math.max(0,b.y-dt*Math.max(4,b.y*0.6)); b.ang=Math.atan2(dx,dz);
      const f=Math.sin(time*24+b.ph)*(b.y>1?0.8:0.3); b.wl.rotation.z=f; b.wr.rotation.z=-f;
      if(d<0.3&&b.y<=0.01){ b.state='idle'; b.y=0; b.t=rand(1,3); }
      if(!day){ b.state='gone'; b.g.visible=false; }
    }
    b.g.position.set(b.x,b.y,b.z); b.g.rotation.y=b.ang;
  }
}
// rats along the curbs
const rats=[], matRat=phong({color:0x2f2a25});
for(let i=0;i<5;i++){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.08,0.24),matRat); body.position.y=0.05; g.add(body);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.02,0.24),matRat); tail.position.set(0,0.03,-0.22); g.add(tail);
  onCharLayer(g); scene.add(g);
  const side=Math.random()<.5?-1:1;
  rats.push({g,x:side*rand(10.1,11.7),z:rand(-40,40),tx:0,tz:0,t:rand(0,4),moving:false,ang:0});
}
function updateRats(dt,p){
  for(const r of rats){
    if(Math.hypot(r.x-p.x,r.z-p.z)>48){ const side=Math.random()<.5?-1:1; r.x=side*rand(10.1,11.7); r.z=p.z+rand(-35,35); r.moving=false; r.t=rand(1,5); }
    let flee=false; for(const s of squad){ if(s.alive&&Math.hypot(s.x-r.x,s.z-r.z)<3){ flee=true; r.tx=r.x>0?rand(10.3,11.8):-rand(10.3,11.8); r.tz=r.z+(r.z>s.z?1:-1)*rand(6,12); r.moving=true; break; } }
    if(!r.moving){ r.t-=dt; if(r.t<=0){ r.moving=true; r.tx=(r.x>0?1:-1)*rand(10.1,11.8); r.tz=r.z+rand(-9,9);
      if(Math.random()<.25){ const d=Math.hypot(r.x-p.x,r.z-p.z); if(d<16&&AC) SFX.squeak(clamp((r.x-p.x)/12,-1,1),0.8/(1+d*0.3)); } } }
    else { const dx=r.tx-r.x, dz=r.tz-r.z, d=Math.hypot(dx,dz); if(d<0.15){ r.moving=false; r.t=rand(1.5,6); }
      else { const sp=flee?6.5:4.2; r.x+=dx/d*Math.min(d,sp*dt); r.z+=dz/d*Math.min(d,sp*dt); r.ang=Math.atan2(dx,dz); } }
    r.g.position.set(r.x,0,r.z); r.g.rotation.y=r.ang;
  }
}
// trash that blows down the street on gusts
const papers=[], matPaper=new THREE.MeshPhongMaterial({color:0xb8b1a3,shininess:0,specular:0,side:THREE.DoubleSide});
for(let i=0;i<14;i++){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(rand(.25,.4),rand(.3,.45)),matPaper); m.castShadow=true; scene.add(m);
  papers.push({m,x:rand(-11,11),z:rand(-30,30),y:0.03,vx:0,vz:0,vy:0,rx:-Math.PI/2,ry:rand(0,6),spin:0});
}
function updatePapers(dt,p){
  const wx=1.0, wz=-0.45;
  for(const q of papers){
    if(Math.hypot(q.x-p.x,q.z-p.z)>38){ for(let t=0;t<8;t++){ const nx=p.x-wx*rand(20,32)+rand(-6,6), nz=p.z-wz*rand(20,32)+rand(-25,25); if(streetOpen(nx,nz)){ q.x=nx; q.z=nz; break; } } q.y=0.03; }
    const push=Math.max(0,G.gust-0.25)*rand(4,7);
    q.vx=lerp(q.vx,wx*push,dt*2); q.vz=lerp(q.vz,wz*push,dt*2);
    if(push>1.5&&q.y<0.05&&Math.random()<dt*1.5) q.vy=rand(1,2.5);
    q.vy-=dt*6; q.y=Math.max(0.03,q.y+q.vy*dt); if(q.y<=0.03) q.vy=0;
    { const nx=q.x+q.vx*dt, nz=q.z+q.vz*dt; if(streetOpen(nx,nz)){ q.x=nx; q.z=nz; } else { q.vx*=-0.3; q.vz*=-0.3; } }
    const sp=Math.hypot(q.vx,q.vz); q.spin+=dt*sp*4;
    q.m.position.set(q.x,q.y,q.z);
    q.m.rotation.set(q.y>0.05?-Math.PI/2+Math.sin(q.spin)*1.2:-Math.PI/2,q.ry+q.spin*0.3,0);
  }
}
// a few windows where somebody is still home: real windows on upper floors near the compound
const litWindows=[];
{
  const cands=[]; for(let e=1;e<EN;e++){ if(ED.t[e]!==ET.WIN||ED.L[e]<1||!OPEN[e]) continue; const B=MAP.blds[ED.b[e]]; if(!B||B.kind==='base') continue;
    const O=OPEN[e]; if(Math.abs(O.z)>90||Math.abs(O.x)>70) continue; cands.push(e); }
  for(let k=0;k<7&&cands.length;k++){
    const e=cands.splice(Math.floor(Math.random()*cands.length),1)[0], O=OPEN[e];
    const g=new THREE.PlaneGeometry(0.86,(O.yt-O.yb)*0.92); g.setAttribute('bid',new THREE.BufferAttribute(new Float32Array(4).fill(ED.b[e]),1));
    const m=new THREE.Mesh(g,cutPatch(new THREE.MeshBasicMaterial({color:0x000000})));
    const nx=O.ax==='x'?O.out:0, nz=O.ax==='z'?O.out:0;
    m.position.set(O.x-nx*0.05,(O.yb+O.yt)/2,O.z-nz*0.05); m.rotation.y=O.ax==='x'?Math.PI/2:0; scene.add(m);
    litWindows.push({m,x:O.x,z:O.z,ph:Math.random()*10,off:0,candle:Math.random()<.6});
  }
}
function updateWindows(dt,time){
  const night=G.phase==='night'||G.phase==='dusk';
  for(const w of litWindows){
    if(w.off>0) w.off-=dt;
    let k=0;
    if(night&&w.off<=0){ k=w.candle?0.55+Math.sin(time*9+w.ph)*0.12+Math.sin(time*23+w.ph)*0.08:0.45+(Math.sin(time*0.7+w.ph)>0.95?-0.3:0); }
    w.m.material.color.setRGB(0.85*k,0.58*k,0.3*k);
  }
}

/* ---------- spatial grid ---------- */
const CELL=2.5, SGX0=-200, SGZ0=-170, SGW=160, SGH=128;
const cellHead=new Int32Array(SGW*SGH), cellNext=new Int32Array(MAXZ);
const cellOf=(x,z)=>clamp(Math.floor((z-SGZ0)/CELL),0,SGH-1)*SGW+clamp(Math.floor((x-SGX0)/CELL),0,SGW-1);
function rebuildGrid(){ cellHead.fill(-1); for(let i=0;i<MAXZ;i++){ if(!zst[i]||zst[i]===5) continue; const c=cellOf(zx[i],zz[i]); cellNext[i]=cellHead[c]; cellHead[c]=i; } }
function eachNear(x,z,r,cb){
  const cr=Math.ceil(r/CELL), cx=clamp(Math.floor((x-SGX0)/CELL),0,SGW-1), cz=clamp(Math.floor((z-SGZ0)/CELL),0,SGH-1);
  for(let gz=Math.max(0,cz-cr);gz<=Math.min(SGH-1,cz+cr);gz++) for(let gx=Math.max(0,cx-cr);gx<=Math.min(SGW-1,cx+cr);gx++){
    for(let j=cellHead[gz*SGW+gx];j!==-1;j=cellNext[j]) cb(j);
  }
}

/* ---------- walkable space ---------- */
const P={x:0,z:0,L:0,trav:null};
// outdoors at street level and free of walls, props and buildings
function streetOpen(x,z){ const cx=Math.floor(x), cz=Math.floor(z); if(!inMap(cx,cz)) return false; const c=CI(cx,cz); return MAP.bld[0][c]<0&&MAP.block[0][c]===BLK.FREE; }
// round props (cars, sandbags, the barrel) are circles on top of the grid
function pushCircles(o,r){
  for(const c of colliders){const dx=o.x-c.x,dz=o.z-c.z,d2=dx*dx+dz*dz,rr=c.r+r; if(d2<rr*rr&&d2>1e-6){const d=Math.sqrt(d2),k=(rr-d)/d;o.x+=dx*k;o.z+=dz*k;}}
}
