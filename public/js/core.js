'use strict';
// Fog Line — Helpers, constants, fog shader, renderer, procedural textures, materials, geometry helpers.
// Classic script: shares globals with the other files, load order matters (see index.html).

const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const randn=()=>(Math.random()+Math.random()+Math.random()-1.5)/1.5;

/* ---------- world constants ---------- */
const CAM_BACK=30;
const WALK_W=12, ST_Z0=-125, ST_Z1=125;
const CR_Z0=-40.5, CR_Z1=-23.5, CR_X=175;
const BZ=-14;                      // barricade line
const DOOR={x:-11.2,z:14};
const LIGHT_WORK={x:4,z:-10}, LIGHT_BARREL={x:-8,z:-9.5};

/* ---------- fog: world-space radial ground fog around the camera's focus ---------- */
THREE.ShaderChunk.fog_pars_vertex='#ifdef USE_FOG\nvarying vec3 vFogWorld;\n#endif';
THREE.ShaderChunk.fog_vertex=`#ifdef USE_FOG
vec4 fogP=vec4(transformed,1.0);
#ifdef USE_INSTANCING
fogP=instanceMatrix*fogP;
#endif
vFogWorld=(modelMatrix*fogP).xyz;
#endif`;
THREE.ShaderChunk.fog_pars_fragment=`#ifdef USE_FOG
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying vec3 vFogWorld;
#endif`;
THREE.ShaderChunk.fog_fragment=`#ifdef USE_FOG
vec2 fogC=cameraPosition.xz-vec2(0.0,${CAM_BACK.toFixed(1)});
float fogD=length(vFogWorld.xz-fogC);
float fogH=1.0-smoothstep(1.0,24.0,vFogWorld.y);
float fogF=smoothstep(fogNear,fogFar,fogD);
fogF=fogF*(0.28+0.72*fogH)+fogH*0.08;
gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(fogF,0.0,1.0));
#endif`;

/* ---------- renderer ---------- */
const glCanvas=document.getElementById('gl');
const renderer=new THREE.WebGLRenderer({canvas:glCanvas,antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(1);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.BasicShadowMap;
const scene=new THREE.Scene();
const fogCol=new THREE.Color(0x3a3631);
scene.fog=new THREE.Fog(fogCol,18,75);
scene.background=null; renderer.setClearColor(fogCol,1);
const camera=new THREE.PerspectiveCamera(32,1,1,420);
let pixelScale=0, lowW=0, lowH=0, userScaleBias=0;
const CHAR_RES=2;            // soldiers + zombies render at this multiple of the world's resolution
const LAYER_CHAR=1;
let rtLow=null;
renderer.shadowMap.autoUpdate=false;
// composite: low-res world color + its depth, so hi-res characters still get blocked by walls
const LIGHT_PROXIES=[];
function fakeLight(color,intensity,distance){ const p={isProxy:true,position:new THREE.Vector3(),color:new THREE.Color(color),intensity,distance,layers:{enableAll(){}}}; LIGHT_PROXIES.push(p); return p; }
const quadScene=new THREE.Scene(), quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const quadMat=new THREE.ShaderMaterial({
  uniforms:{tColor:{value:null},tDepth:{value:null}},
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
  fragmentShader:'uniform sampler2D tColor; uniform sampler2D tDepth; varying vec2 vUv; void main(){ gl_FragColor=texture2D(tColor,vUv); gl_FragDepthEXT=texture2D(tDepth,vUv).x; }',
  depthTest:true, depthWrite:true, depthFunc:THREE.AlwaysDepth, extensions:{fragDepth:true}
});
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),quadMat));
function onCharLayer(o){ o.traverse(c=>c.layers.set(LAYER_CHAR)); }
const LAYER_FX=2;
function onFxLayer(o){ o.traverse(c=>c.layers.set(LAYER_FX)); }

const fx=document.getElementById('fx'), fctx=fx.getContext('2d');
let FW=0,FH=0,DPR=1, vignette=null;
function resize(){
  const W=innerWidth,H=innerHeight;
  const short=Math.min(W,H);
  pixelScale=Math.max(1,Math.round(short/240)+userScaleBias);
  lowW=Math.max(80,Math.round(W/pixelScale)); lowH=Math.max(80,Math.round(H/pixelScale));
  renderer.setSize(lowW*CHAR_RES,lowH*CHAR_RES,false);
  if(rtLow){ rtLow.depthTexture.dispose(); rtLow.dispose(); }
  rtLow=new THREE.WebGLRenderTarget(lowW,lowH,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});
  rtLow.depthTexture=new THREE.DepthTexture(lowW,lowH,THREE.UnsignedIntType);
  rtLow.depthTexture.minFilter=rtLow.depthTexture.magFilter=THREE.NearestFilter;
  quadMat.uniforms.tColor.value=rtLow.texture; quadMat.uniforms.tDepth.value=rtLow.depthTexture;
  camera.aspect=W/H; camera.updateProjectionMatrix();
  DPR=Math.min(devicePixelRatio||1,1.5);
  FW=fx.width=Math.round(W*DPR); FH=fx.height=Math.round(H*DPR);
  vignette=document.createElement('canvas'); vignette.width=FW; vignette.height=FH;
  const v=vignette.getContext('2d');
  const gr=v.createRadialGradient(FW/2,FH/2,Math.min(FW,FH)*0.28,FW/2,FH/2,Math.max(FW,FH)*0.72);
  gr.addColorStop(0,'rgba(8,7,6,0)'); gr.addColorStop(1,'rgba(8,7,6,0.78)');
  v.fillStyle=gr; v.fillRect(0,0,FW,FH);
}
addEventListener('resize',resize);

/* ---------- procedural textures ---------- */
function canvasTex(w,h,draw){
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d'); draw(g,w,h);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestMipmapNearestFilter;
  return t;
}
function speckle(g,w,h,n,dark,light){
  for(let i=0;i<n;i++){ g.fillStyle=Math.random()<.5?dark:light; g.fillRect(Math.random()*w|0,Math.random()*h|0,1,1); }
}
function facadeTex(base,frame){
  return canvasTex(128,256,(g,w,h)=>{
    g.fillStyle=base; g.fillRect(0,0,w,h);
    speckle(g,w,h,5000,'rgba(0,0,0,.18)','rgba(255,250,240,.10)');
    for(let r=0;r<16;r++) for(let c=0;c<8;c++){
      const x=c*16,y=r*16;
      g.fillStyle=frame; g.fillRect(x+1,y+2,14,12);
      const roll=Math.random();
      g.fillStyle=roll<.05?'#5b4a31':roll<.12?'#4a443b':roll<.16?'#2a2622':'#121110';
      g.fillRect(x+3,y+4,10,9);
      if(roll>=.05&&roll<.12){g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x+3,y+7,10,1);g.fillRect(x+3,y+10,10,1);}
      g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x,y+15,16,1);
    }
    for(let i=0;i<14;i++){
      const x=Math.random()*w|0,y=Math.random()*h|0,l=20+Math.random()*90;
      g.fillStyle='rgba(20,16,12,'+(0.08+Math.random()*0.14)+')';
      g.fillRect(x,y,2+Math.random()*4|0,l);
    }
  });
}
const texFacade=[facadeTex('#82878a','#929799'),facadeTex('#71767a','#80858a'),facadeTex('#8f9496','#9fa4a6')];
const texRoof=canvasTex(64,64,(g,w,h)=>{
  g.fillStyle='#62676b'; g.fillRect(0,0,w,h);
  speckle(g,w,h,1400,'rgba(0,0,0,.22)','rgba(255,255,255,.08)');
  for(let i=0;i<5;i++){g.fillStyle='rgba(30,26,22,.22)';g.beginPath();g.ellipse(Math.random()*w,Math.random()*h,4+Math.random()*10,3+Math.random()*7,Math.random()*3,0,7);g.fill();}
});
const texAsphalt=canvasTex(64,64,(g,w,h)=>{
  g.fillStyle='#212428'; g.fillRect(0,0,w,h);
  speckle(g,w,h,900,'rgba(0,0,0,.35)','rgba(255,245,230,.07)');
  g.strokeStyle='rgba(8,7,6,.7)'; g.lineWidth=1;
  for(let i=0;i<3;i++){g.beginPath();let x=Math.random()*w,y=Math.random()*h;g.moveTo(x,y);for(let k=0;k<6;k++){x+=rand(-8,8);y+=rand(-8,8);g.lineTo(x,y);}g.stroke();}
});
const texWalk=canvasTex(32,32,(g,w,h)=>{
  g.fillStyle='#565b5f'; g.fillRect(0,0,w,h);
  speckle(g,w,h,200,'rgba(0,0,0,.2)','rgba(255,255,255,.06)');
  g.fillStyle='#3e3a36';
  for(let i=0;i<w;i+=4){g.fillRect(i,0,2,1);g.fillRect(0,i,1,2);}
});

/* ---------- materials ---------- */
const phong=(o)=>new THREE.MeshPhongMaterial(Object.assign({shininess:0,specular:0x000000},o));
const matFacade=texFacade.map(t=>phong({map:t}));
const matRoof=phong({map:texRoof});
const matGround=new THREE.MeshPhongMaterial({map:texAsphalt,specular:0x464d56,shininess:38});
const matWalk=phong({map:texWalk,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
const matCurb=phong({color:0x72777b});
const matClutter=phong({color:0x82878b});
const matDark=phong({color:0x1f1c19});
const matRust=phong({color:0x3d3029});
const matRust2=phong({color:0x4b3a2c});
const matConcrete=phong({color:0x8a8f92});
const matStripe=phong({color:0x7c6a30});
const matSand=phong({color:0x6b6146});
const matLine=phong({color:0x7d6e36});

/* ---------- geometry helpers ---------- */
function scaleUV(geo,su,sv,ou=0,ov=0){
  const uv=geo.attributes.uv;
  for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*su+ou,uv.getY(i)*sv+ov);
  uv.needsUpdate=true; return geo;
}
function boxUV(sx,sy,sz){
  const geo=new THREE.BoxGeometry(sx,sy,sz);
  const uv=geo.attributes.uv;
  const ou=Math.floor(Math.random()*8)/8, ov=Math.floor(Math.random()*16)/16;
  const faces=[[sz/32,sy/56,ou,ov],[sz/32,sy/56,ou+.5,ov],[sx/16,sz/16,0,0],[sx/16,sz/16,0,0],[sx/32,sy/56,ou+.25,ov],[sx/32,sy/56,ou+.75,ov]];
  for(let f=0;f<6;f++){const [a,b,c,d]=faces[f];for(let k=0;k<4;k++){const i=f*4+k;uv.setXY(i,uv.getX(i)*a+c,uv.getY(i)*b+d);}}
  uv.needsUpdate=true; return geo;
}
function addMesh(geo,mat,x,y,z,cast=true,recv=true){
  const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.castShadow=cast; m.receiveShadow=recv; scene.add(m); return m;
}

/* ---------- merged geometry builder ---------- */
// Boxes and quads with vertex colors, world-space UVs and a building id per vertex (for cutaways).
class GB{
  constructor(us=0.5){ this.p=[]; this.n=[]; this.u=[]; this.c=[]; this.b=[]; this.i=[]; this.v=0; this.us=us; }
  // four corners counter-clockwise seen from the front; uv given per corner
  quad(a,b,c,d,nx,ny,nz,col,bid,uv){
    const v=this.v;
    for(const q of [a,b,c,d]){ this.p.push(q[0],q[1],q[2]); this.n.push(nx,ny,nz); this.c.push(col[0],col[1],col[2]); this.b.push(bid); }
    if(uv) this.u.push(...uv); else this.u.push(0,0,1,0,1,1,0,1);
    this.i.push(v,v+1,v+2,v,v+2,v+3); this.v+=4;
  }
  // axis-aligned box; faces: 'px','nx','py','ny','pz','nz' may be skipped or recolored via opt
  box(x0,y0,z0,x1,y1,z1,col,bid,opt){
    const s=this.us, o=opt||{}, sk=o.skip||'', fc=o.faces||{};
    const C=f=>fc[f]||col;
    if(!sk.includes('py')) this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],0,1,0,C('py'),bid,[x0*s,z1*s,x1*s,z1*s,x1*s,z0*s,x0*s,z0*s]);
    if(sk.includes('ny')===false&&o.bottom) this.quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],0,-1,0,C('ny'),bid);
    if(!sk.includes('pz')) this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],0,0,1,C('pz'),bid,[x0*s,y0*s,x1*s,y0*s,x1*s,y1*s,x0*s,y1*s]);
    if(!sk.includes('nz')) this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],0,0,-1,C('nz'),bid,[x1*s,y0*s,x0*s,y0*s,x0*s,y1*s,x1*s,y1*s]);
    if(!sk.includes('px')) this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],1,0,0,C('px'),bid,[z1*s,y0*s,z0*s,y0*s,z0*s,y1*s,z1*s,y1*s]);
    if(!sk.includes('nx')) this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],-1,0,0,C('nx'),bid,[z0*s,y0*s,z1*s,y0*s,z1*s,y1*s,z0*s,y1*s]);
  }
  get empty(){ return this.v===0; }
  build(){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));
    g.setAttribute('bid',new THREE.Float32BufferAttribute(this.b,1));
    g.setIndex(this.i); g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

/* ---------- cutaways ---------- */
// Every building vertex carries its building id. A 1-pixel-tall texture holds a cut height per building;
// fragments above it are discarded, and back faces exposed by the cut render as dark wall tops.
const CUT_N=1024, CUT_NONE=1023, CUT_MAX=64;
const cutData=new Uint8Array(CUT_N*4).fill(255);
const cutTex=new THREE.DataTexture(cutData,CUT_N,1,THREE.RGBAFormat);
cutTex.magFilter=THREE.NearestFilter; cutTex.minFilter=THREE.NearestFilter; cutTex.needsUpdate=true;
function cutPatch(m){
  m.onBeforeCompile=sh=>{
    sh.uniforms.tCut={value:cutTex};
    sh.vertexShader='attribute float bid;\nvarying float vBid;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBid=bid;');
    sh.fragmentShader='uniform sampler2D tCut;\nvarying float vBid;\n'+sh.fragmentShader
      .replace('void main() {','void main() {\n  float cutY=texture2D(tCut,vec2((vBid+0.5)/'+CUT_N+'.0,0.5)).r*'+CUT_MAX+'.0;\n  if(cutY<63.0&&vFogWorld.y>cutY) discard;')
      .replace('#include <dithering_fragment>','#include <dithering_fragment>\n  if(!gl_FrontFacing) gl_FragColor.rgb=vec3(0.045,0.045,0.05);');
  };
  m.side=THREE.DoubleSide; m.shadowSide=THREE.FrontSide;
  return m;
}
function setCut(b,h){ const v=h>=CUT_MAX?255:Math.max(0,Math.min(254,Math.round(h/CUT_MAX*255))); if(cutData[b*4]!==v){ cutData[b*4]=v; cutTex.needsUpdate=true; } }
function getCut(b){ const v=cutData[b*4]; return v===255?999:v/255*CUT_MAX; }

/* ---------- static dressing gets merged by material ---------- */
const statics=[];
const MC=new Map(); const pc=hex=>{ if(!MC.has(hex)) MC.set(hex,phong({color:hex})); return MC.get(hex); };
function addStatic(geo,mat,x,y,z,cast=true){ const o=new THREE.Object3D(); o.position.set(x,y,z); statics.push({geo,mat,o,cast}); return o; }
function addStaticM(geo,mat,m,cast=true){ statics.push({geo,mat,m:m.clone(),cast}); }
function staticMesh(mesh){ statics.push({geo:mesh.geometry,mat:mesh.material,o:mesh,cast:mesh.castShadow!==false}); return mesh; }
function flushStatics(){
  const groups=new Map();
  for(const s of statics){ const key=s.mat.uuid+(s.cast?'c':'n'); if(!groups.has(key)) groups.set(key,{mat:s.mat,cast:s.cast,list:[]}); groups.get(key).list.push(s); }
  for(const g of groups.values()){
    const P=[],N=[],U=[]; let n=0;
    for(const s of g.list){
      const geo=(s.geo.index?s.geo.toNonIndexed():s.geo.clone());
      let m=s.m; if(!m){ s.o.updateMatrix(); m=s.o.matrix; }
      geo.applyMatrix4(m);
      P.push(geo.attributes.position.array); N.push(geo.attributes.normal.array);
      U.push(geo.attributes.uv?geo.attributes.uv.array:new Float32Array(geo.attributes.position.count*2)); n+=geo.attributes.position.count;
    }
    const cat=(arrs,k)=>{ const out=new Float32Array(n*k); let o=0; for(const a of arrs){ out.set(a,o); o+=a.length; } return out; };
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(cat(P,3),3)); geo.setAttribute('normal',new THREE.BufferAttribute(cat(N,3),3)); geo.setAttribute('uv',new THREE.BufferAttribute(cat(U,2),2));
    geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,g.mat); mesh.castShadow=g.cast; mesh.receiveShadow=true; scene.add(mesh);
  }
  statics.length=0;
}
