'use strict';
// Fog Line — Squad models, zombie rig and outfits, blood, gibs, corpses, chips, casings, impacts.
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- squad ---------- */
const matUni=phong({color:0xccb88f}), matUni2=phong({color:0xb09c74}), matVest=phong({color:0x7c6e4e}), matHelm=phong({color:0x8e7f58}),
  matGun=phong({color:0x1c1a18}), matSkin=phong({color:0xa98466}), matBoot=phong({color:0x2e2a24}), matPack=phong({color:0x6b6145});
const matBandage=phong({color:0xcfc8b8}), matRadio=phong({color:0x3e4232}), matGoggle=phong({color:0x22262a});
function soldierMesh(idx){
  const g=new THREE.Group();
  const M={uni:matUni.clone(),uni2:matUni2.clone(),vest:matVest.clone(),pack:matPack.clone(),helm:matHelm.clone()};
  if(idx===3) M.helm.color.setHex(0x6d6a4c);
  if(idx===1) M.helm.color.setHex(0x7d7454);
  const box=(parent,w,h,d,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
  const legs=[];
  for(const sx of [-1,1]){
    const hip=new THREE.Group(); hip.position.set(sx*0.12,0.86,0); g.add(hip);
    box(hip,0.17,0.48,0.2,M.uni2,0,-0.24,0);
    box(hip,0.15,0.36,0.17,M.uni2,0,-0.62,0);
    box(hip,0.17,0.12,0.29,matBoot,0,-0.8,0.04);
    legs.push(hip);
  }
  const torso=new THREE.Group(); torso.position.set(0,0.86,0); g.add(torso);
  box(torso,0.42,0.18,0.24,M.uni2,0,0.06,0);
  box(torso,0.46,0.5,0.26,M.uni,0,0.38,0);
  box(torso,0.5,0.4,0.31,M.vest,0,0.4,0.01);
  for(const px of [-0.13,0,0.13]) box(torso,0.1,0.13,0.07,M.pack,px,0.3,0.18);
  box(torso,0.4,0.48,0.22,M.pack,0,0.42,-0.25);
  box(torso,0.36,0.12,0.18,M.pack,0,0.72,-0.24);
  for(const sx of [-1,1]) box(torso,0.14,0.12,0.24,M.uni,sx*0.29,0.58,0);
  if(idx===0){ // radio pack + whip antenna + handset on the shoulder
    box(torso,0.3,0.34,0.15,matRadio,0,0.44,-0.42);
    const ant=box(torso,0.018,1.0,0.018,matGoggle,0.1,1.05,-0.44); ant.rotation.z=-0.12; ant.rotation.x=-0.15;
    box(torso,0.07,0.12,0.06,matGoggle,-0.22,0.6,0.12);
  }
  const head=new THREE.Group(); head.position.set(0,0.66,0.02); torso.add(head);
  box(head,0.2,0.22,0.2,matSkin,0,0.11,0);
  const headBand=box(head,0.215,0.06,0.215,matBandage,0,0.13,0); headBand.visible=false;
  if(idx===2){ // patrol cap instead of a helmet
    box(head,0.23,0.09,0.25,M.helm,0,0.24,0);
    box(head,0.22,0.02,0.13,M.helm,0,0.2,0.17);
  } else {
    const helm=new THREE.Mesh(new THREE.SphereGeometry(0.175,8,5,0,Math.PI*2,0,Math.PI/2),M.helm);
    helm.scale.set(1,0.9,1.12); helm.position.set(0,0.19,0); helm.castShadow=true; head.add(helm);
    box(head,0.37,0.035,0.42,M.helm,0,0.19,0.01);
    if(idx===1){ box(head,0.36,0.05,0.4,matGoggle,0,0.26,0); box(head,0.16,0.06,0.05,matGoggle,0,0.27,0.19); }
    if(idx===3){ for(let k=0;k<3;k++){ const n=box(head,0.33,0.012,0.012,matGoggle,0,0.31,-0.08+k*0.08); } }
  }
  const W=new THREE.Group(); torso.add(W);
  const gun=new THREE.Group(); gun.position.set(0.1,0.42,0.22); W.add(gun);
  box(gun,0.07,0.11,0.5,matGun,0,0,0.12);
  box(gun,0.035,0.035,idx===2?0.6:0.44,matGun,0,0.02,idx===2?0.66:0.58);
  box(gun,0.06,0.1,0.24,matGun,0,-0.02,-0.22);
  box(gun,0.05,0.17,0.08,matGun,0,-0.12,0.14);
  box(gun,idx===2?0.07:0.05,idx===2?0.07:0.05,idx===2?0.24:0.14,matGun,0,idx===2?0.1:0.08,0.05);
  g.updateMatrixWorld(true);
  const arms=[];
  const arm=(sx,hand)=>{
    const sh=new THREE.Vector3(sx*0.28,0.56,0), d=hand.clone().sub(sh), L=d.length();
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,L),M.uni); m.castShadow=true;
    m.position.copy(sh).add(hand).multiplyScalar(0.5); W.add(m);
    m.lookAt(hand.clone().add(new THREE.Vector3(0,0.86,0)));
    box(W,0.09,0.09,0.09,matSkin,hand.x,hand.y,hand.z);
    const band=new THREE.Mesh(new THREE.BoxGeometry(0.135,0.135,0.11),matBandage); band.position.z=L*0.15; band.visible=false; m.add(band);
    arms.push(band);
  };
  arm(1,new THREE.Vector3(0.12,0.38,0.2));
  arm(-1,new THREE.Vector3(0.08,0.43,0.6));
  g.userData={legs,torso,W,M,headBand,armBands:arms,base:{uni:M.uni.color.clone(),uni2:M.uni2.color.clone(),vest:M.vest.color.clone(),pack:M.pack.color.clone()}};
  return g;
}
const DIRT=new THREE.Color(0x4e4636);
function applyWear(s){
  const u=s.mesh.userData, w=Math.min(0.55,(G.night-1)*0.11+(100-s.hp)*0.002);
  for(const k of ['uni','uni2','vest','pack']) u.M[k].color.copy(u.base[k]).lerp(DIRT,w);
  u.armBands[1].visible=s.i===3||s.hp<75;          // Hale's had his arm wrapped since day one
  u.armBands[0].visible=s.hp<50;
  u.headBand.visible=s.hp<35;
}
const SQUAD_DEF=[
  {name:'Cpl. Reyes',short:'REYES',trait:'steady',acc:.62,stress:.9,melee:1.0,post:{x:-2.2,z:-12.0}},
  {name:'Pvt. Dunn',short:'DUNN',trait:'jumpy',acc:.48,stress:1.7,melee:.9,post:{x:-8.5,z:-12.0}},
  {name:'PFC Kowalski',short:'KOWALSKI',trait:'marksman',acc:.76,stress:1.0,melee:.9,post:{x:2.8,z:-12.0}},
  {name:'Pvt. Hale',short:'HALE',trait:'quiet',acc:.5,stress:.8,melee:1.7,post:{x:8.6,z:-12.0}},
];
const FOLLOW_SLOTS=[{x:-1.6,z:1.8},{x:1.6,z:1.8},{x:0,z:3.0}];
const BACK_SPOTS=[{x:-14.6,z:11.4},{x:-15.2,z:14},{x:-14.6,z:16.6},{x:-17,z:13}];
const squad=SQUAD_DEF.map((d,i)=>{
  const mesh=soldierMesh(i); mesh.scale.setScalar(1.2); onCharLayer(mesh); scene.add(mesh);
  const light=new THREE.SpotLight(0xfff0d0,i===0?1.7:0.9,i===0?32:22,0.42,0.6,1.4);
  const tgt=new THREE.Object3D(); scene.add(tgt); light.target=tgt; light.layers.enableAll(); scene.add(light);
  return Object.assign({},d,{i,x:d.post.x,z:d.post.z,ang:Math.PI,hp:100,mag:30,res:120,reloadT:0,fireCD:0,meleeCD:0,stress:0,alive:true,
    mesh,light,tgt,lightOn:true,panic:0,status:'HOLD',near:0,sight:7,vx:0,vz:0,walk:0,recoil:0,shoveT:0,boots:0,step:0,foot:1,L:0,trav:null,y:0,field:null,goalKey:''});
});
let me=0;
const ring=new THREE.Mesh(new THREE.RingGeometry(0.55,0.68,16),new THREE.MeshBasicMaterial({color:0xcdb88e,fog:false,transparent:true,opacity:.7}));
ring.rotation.x=-Math.PI/2; onCharLayer(ring); scene.add(ring);

/* ---------- zombies (instanced) ---------- */
const MAXZ=380;
const zx=new Float32Array(MAXZ), zz=new Float32Array(MAXZ), zvx=new Float32Array(MAXZ), zvz=new Float32Array(MAXZ);
const zhp=new Float32Array(MAXZ), ztx=new Float32Array(MAXZ), ztz=new Float32Array(MAXZ), zang=new Float32Array(MAXZ);
const zspd=new Float32Array(MAXZ), zph=new Float32Array(MAXZ), zox=new Float32Array(MAXZ), zoz=new Float32Array(MAXZ);
const zcd=new Float32Array(MAXZ), zmoan=new Float32Array(MAXZ), zwt=new Float32Array(MAXZ);
const zst=new Uint8Array(MAXZ);   // 0 dead 1 drift 2 hunt 3 chase 4 wander
const ztgt=new Int8Array(MAXZ);
// levels and stairs: which floor each zombie is on, its height, and any stair or window climb in progress
const zl=new Int8Array(MAXZ), zyv=new Float32Array(MAXZ), ztr=new Array(MAXZ).fill(null);
const zLosT=new Float32Array(MAXZ), zDirect=new Uint8Array(MAXZ), zSees=new Int8Array(MAXZ).fill(-1);
const zvar=new Uint8Array(MAXZ);           // gait: 0 shambler 1 big 2 limper 3 crawler
const zhunch=new Float32Array(MAXZ), zarmL=new Uint8Array(MAXZ), zarmR=new Uint8Array(MAXZ), ztilt=new Float32Array(MAXZ), zsc=new Float32Array(MAXZ), zfl=new Float32Array(MAXZ);
const zout=new Uint8Array(MAXZ);   // outfit: 0 civilian 1 cop 2 soldier 3 hospital gown 4 hi-vis vest
const zbody=new Uint8Array(MAXZ);  // 0 normal 1 heavy 2 tall & thin
const zmiss=new Uint8Array(MAXZ);  // 1/2 arm stump L/R, 4 head gone, 8/16 arm gone L/R
const zwound=new Uint8Array(MAXZ), zwx=new Float32Array(MAXZ), zwy=new Float32Array(MAXZ);
const zdie=new Float32Array(MAXZ), zdx=new Float32Array(MAXZ), zdz=new Float32Array(MAXZ), zfall=new Int8Array(MAXZ), zgib=new Uint8Array(MAXZ), zdrip=new Float32Array(MAXZ);
const matZ=phong({color:0xffffff});
matZ.onBeforeCompile=sh=>{
  sh.fragmentShader=sh.fragmentShader.replace('#include <fog_fragment>',`
  #ifdef USE_FOG
  vec2 fogC=cameraPosition.xz-vec2(0.0,${CAM_BACK.toFixed(1)});
  float fogD=length(vFogWorld.xz-fogC);
  float sil=smoothstep(fogNear,fogFar,fogD);
  gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor*0.22,clamp(sil*1.05,0.0,1.0));
  gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,smoothstep(fogFar*1.2,fogFar*2.0,fogD));
  #endif`);
};
const ZGEO={
  pelvis:new THREE.BoxGeometry(0.4,0.2,0.24),
  torso:new THREE.BoxGeometry(0.46,0.62,0.27).translate(0,0.31,0),
  head:new THREE.BoxGeometry(0.25,0.27,0.26).translate(0,0.13,0.04),
  arm:new THREE.BoxGeometry(0.11,0.72,0.12).translate(0,-0.36,0),
  leg:new THREE.BoxGeometry(0.17,0.9,0.19).translate(0,-0.45,0),
  hat:new THREE.BoxGeometry(0.28,0.07,0.34).translate(0,0.29,0.07),
  helmet:new THREE.SphereGeometry(0.17,8,5,0,Math.PI*2,0,Math.PI/2).scale(1,0.85,1.12).translate(0,0.23,0.04),
  stripe:new THREE.BoxGeometry(0.47,0.06,0.28).translate(0,0.34,0),
  wound:new THREE.BoxGeometry(0.17,0.15,0.03),
};
const ZPARTS=['pelvis','torso','head','armL','armR','legL','legR','hat','helmet','stripe','wound'];
const partGeo=n=>ZGEO[n]||ZGEO[n.slice(0,3)];
const zim={};
for(const n of ZPARTS){
  const im=new THREE.InstancedMesh(partGeo(n),matZ,MAXZ); im.castShadow=n!=='wound'&&n!=='stripe'; im.frustumCulled=false;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); onCharLayer(im); scene.add(im); zim[n]=im;
}
const O3=()=>new THREE.Object3D();
const zr={root:O3(),hip:O3(),pelv:O3(),torso:O3(),tmesh:O3(),head:O3(),armL:O3(),armR:O3(),legL:O3(),legR:O3(),hat:O3(),helmet:O3(),stripe:O3(),wound:O3()};
zr.root.rotation.order='YXZ';
zr.root.add(zr.hip); zr.hip.add(zr.pelv); zr.hip.add(zr.torso); zr.hip.add(zr.legL); zr.hip.add(zr.legR);
zr.torso.add(zr.tmesh); zr.torso.add(zr.head); zr.torso.add(zr.armL); zr.torso.add(zr.armR);
zr.tmesh.add(zr.stripe); zr.tmesh.add(zr.wound); zr.head.add(zr.hat); zr.head.add(zr.helmet);
zr.legL.position.x=-0.11; zr.legR.position.x=0.11; zr.head.position.set(0,0.6,0.02);
const ZNODE={pelvis:zr.pelv,torso:zr.tmesh,head:zr.head,armL:zr.armL,armR:zr.armR,legL:zr.legL,legR:zr.legR,hat:zr.hat,helmet:zr.helmet,stripe:zr.stripe,wound:zr.wound};
const dummy=new THREE.Object3D(), tmpC=new THREE.Color(), zeroM=new THREE.Matrix4().makeScale(0,0,0);
const CLOTH=[[0.2,0.18,0.16],[0.17,0.18,0.2],[0.19,0.2,0.15],[0.24,0.2,0.16],[0.15,0.14,0.13],[0.36,0.34,0.3],[0.28,0.16,0.14],[0.16,0.2,0.24]];
const BLOOD=new THREE.Color(0x5a1410);
function setZC(n,i,r,g,b){ tmpC.setRGB(r,g,b); zim[n].setColorAt(i,tmpC); }
function dressZ(i){
  const v=rand(.8,1.15);
  const r=Math.random(); zout[i]=r<.55?0:r<.65?1:r<.77?2:r<.88?3:4;
  const rb=Math.random(); zbody[i]=rb<.12?1:rb<.24?2:0;
  zmiss[i]=Math.random()<.1?(Math.random()<.5?1:2):0;
  zwound[i]=Math.random()<.6?1:0; zwx[i]=rand(-.14,.14); zwy[i]=rand(.15,.5);
  const sk=[0.4*v,0.41*v,0.35*v];
  let top,bot,armsSkin=Math.random()<.5;
  const o=zout[i];
  if(o===0){ const c=CLOTH[Math.random()*CLOTH.length|0], c2=CLOTH[Math.random()*5|0]; top=c.map(x=>x*v); bot=c2.map(x=>x*v*.9); }
  else if(o===1){ top=[0.1,0.12,0.19]; bot=[0.08,0.09,0.11]; armsSkin=Math.random()<.3; }
  else if(o===2){ top=[0.23,0.24,0.16]; bot=[0.21,0.22,0.15]; armsSkin=false; }
  else if(o===3){ top=[0.42,0.53,0.52]; bot=top; armsSkin=true; }
  else { top=Math.random()<.6?[0.78,0.36,0.06]:[0.66,0.68,0.12]; bot=[0.15,0.17,0.21]; armsSkin=Math.random()<.5; }
  setZC('torso',i,...top);
  const arm=armsSkin?sk:top; setZC('armL',i,...arm); setZC('armR',i,...arm);
  if(zmiss[i]&1) setZC('armL',i,0.34,0.07,0.05); if(zmiss[i]&2) setZC('armR',i,0.34,0.07,0.05);
  setZC('pelvis',i,...bot);
  const leg=o===3?sk:bot; setZC('legL',i,...leg); setZC('legR',i,...leg);
  tmpC.setRGB(...sk); if(Math.random()<.35) tmpC.lerp(BLOOD,rand(.25,.55)); zim.head.setColorAt(i,tmpC);
  setZC('hat',i,0.07,0.08,0.12); setZC('helmet',i,0.21,0.22,0.15); setZC('stripe',i,0.72,0.74,0.76); setZC('wound',i,0.3,0.04,0.03);
  for(const n of ZPARTS) zim[n].instanceColor.needsUpdate=true;
}
for(let i=0;i<MAXZ;i++){ dressZ(i); for(const n of ZPARTS) zim[n].setMatrixAt(i,zeroM); }
function hideZ(i){ for(const n of ZPARTS) zim[n].setMatrixAt(i,zeroM); }
function lookZ(i){
  const R=zr, b=zbody[i], o=zout[i], m=zmiss[i];
  const tx=b===1?1.35:b===2?0.82:1, tz=b===1?1.45:b===2?0.85:1, ty=b===2?1.08:1, legY=b===2?1.12:1;
  R.tmesh.scale.set(tx,ty,tz); R.pelv.scale.set(b===1?1.3:tx,1,b===1?1.35:tz);
  R.legL.scale.set(b===1?1.25:1,legY,b===1?1.25:1); R.legR.scale.copy(R.legL.scale);
  R.legL.position.x=-0.11*(b===1?1.3:1); R.legR.position.x=-R.legL.position.x;
  const ay=b===2?1.1:1;
  R.armL.scale.set(1,(m&8)?0:(m&1)?0.33:ay,1); R.armR.scale.set(1,(m&16)?0:(m&2)?0.33:ay,1);
  R.armL.position.set(-0.29*tx,0.56*ty,0); R.armR.position.set(0.29*tx,0.56*ty,0);
  R.head.position.set(0,0.6*ty,0.02); R.head.scale.setScalar((m&4)?0:1);
  R.hat.scale.setScalar(o===1?1:0); R.helmet.scale.setScalar(o===2?1:0); R.stripe.scale.setScalar(o===4?1:0);
  R.wound.scale.setScalar(zwound[i]?1:0); R.wound.position.set(zwx[i],zwy[i],0.14);
  return legY;
}
function writeZ(i){ zr.root.updateMatrixWorld(true); for(const n of ZPARTS) zim[n].setMatrixAt(i,ZNODE[n].matrixWorld); }
function poseZ(i,x,z,v,dt){
  const ph=zph[i], var_=zvar[i], h=zhunch[i];
  const R=zr;
  const legY=lookZ(i);
  R.root.position.set(x,zyv[i],z); R.root.rotation.set(0,zang[i],Math.sin(ph*0.5)*0.06); R.root.scale.setScalar(zsc[i]);
  const stride=Math.min(1,v/1.2), fl=zfl[i];
  const chasing=zst[i]===3;
  if(var_===3){
    R.hip.position.set(0,0.2,0); R.hip.rotation.set(0,0,Math.sin(ph)*0.08);
    R.torso.rotation.set(1.42-fl*0.4,0,0);
    R.legL.rotation.set(1.3+Math.sin(ph)*0.15,0,-0.1); R.legR.rotation.set(1.3-Math.sin(ph)*0.15,0,0.1);
    R.armL.rotation.set(-2.9+Math.sin(ph)*0.55,0,0.2); R.armR.rotation.set(-2.9-Math.sin(ph)*0.55,0,-0.2);
    R.head.rotation.set(-1.15,0,ztilt[i]);
  } else {
    const limp=var_===2;
    const sw=Math.sin(ph)*0.5*stride;
    const dip=limp?Math.max(0,Math.sin(ph))*0.07:Math.abs(Math.sin(ph))*0.03*stride;
    R.hip.position.set(0,0.92*legY-dip,0); R.hip.rotation.set(0,Math.sin(ph)*0.12*stride,limp?Math.sin(ph)*0.06:0);
    R.torso.rotation.set(h+Math.sin(ph*2)*0.04-fl*0.5,0,Math.sin(ph)*0.07+ztilt[i]*0.3);
    R.legL.rotation.set(sw,0,0); R.legR.rotation.set(limp?-sw*0.2+0.15:-sw,0,0);
    const reach=a=>-1.42-h+Math.sin(ph+a)*0.12;
    const hang=a=>-h*0.7+Math.sin(ph+a)*0.32*stride+0.05;
    R.armL.rotation.set((chasing||zarmL[i])?reach(0):hang(Math.PI),0,-0.12);
    R.armR.rotation.set((chasing||zarmR[i])?reach(1.3):hang(0),0,0.12);
    R.head.rotation.set(-h*0.55+0.25,Math.sin(ph*0.7)*0.15,ztilt[i]);
  }
  writeZ(i);
}
function poseDying(i,u){
  const R=zr, e=u*u, var_=zvar[i];
  const legY=lookZ(i);
  R.root.position.set(zx[i]+zdx[i]*0.8*e,zyv[i]+0.12*e,zz[i]+zdz[i]*0.8*e);
  R.root.scale.setScalar(zsc[i]);
  if(var_===3){
    R.root.rotation.set(0,zang[i],0); R.hip.position.set(0,0.2-0.08*e,0);
    R.torso.rotation.set(1.42+0.14*e,0,0); R.head.rotation.set(-1.15+0.9*e,0,ztilt[i]);
    R.armL.rotation.set(-2.9+0.6*e,0,0.2+0.8*e); R.armR.rotation.set(-2.9+0.4*e,0,-0.2-0.9*e);
  } else {
    R.root.rotation.set(zfall[i]*1.5*e,zang[i],ztilt[i]*0.5*e);
    R.hip.position.set(0,0.92*legY,0); R.hip.rotation.set(0,0,0);
    R.torso.rotation.set(lerp(zhunch[i],-0.1*zfall[i],e),0,0);
    R.head.rotation.set(0.5*zfall[i]*e,0,ztilt[i]+0.4*e);
    R.armL.rotation.set(lerp(-0.4,-1.6*zfall[i]-1.2,e*0.8),0,-0.2-1.0*e);
    R.armR.rotation.set(lerp(-0.4,-0.6,e),0,0.2+1.2*e);
    R.legL.rotation.set(0.2*e,0,-0.1*e); R.legR.rotation.set(-0.3*e,0,0.15*e);
  }
  writeZ(i);
}

/* ---------- blood ---------- */
const MAXD=700, dFl=new Float32Array(MAXD), dX=new Float32Array(MAXD), dY=new Float32Array(MAXD), dZ=new Float32Array(MAXD), dVX=new Float32Array(MAXD), dVY=new Float32Array(MAXD), dVZ=new Float32Array(MAXD), dL=new Uint8Array(MAXD);
let dIdx=0;
const imDrop=new THREE.InstancedMesh(new THREE.BoxGeometry(0.07,0.07,0.07),new THREE.MeshBasicMaterial({color:0x8e120c}),MAXD);
imDrop.frustumCulled=false; imDrop.instanceMatrix.setUsage(THREE.DynamicDrawUsage); onCharLayer(imDrop); scene.add(imDrop);
for(let i=0;i<MAXD;i++) imDrop.setMatrixAt(i,zeroM);
const MAXS=1400; let sIdx=0;
const imSplat=new THREE.InstancedMesh(new THREE.CircleGeometry(0.5,8).rotateX(-Math.PI/2),
  new THREE.MeshPhongMaterial({color:0x560c08,specular:0x8a5a58,shininess:70,transparent:true,opacity:.92,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),MAXS);
imSplat.frustumCulled=false; imSplat.receiveShadow=true; onCharLayer(imSplat); scene.add(imSplat);
for(let i=0;i<MAXS;i++) imSplat.setMatrixAt(i,zeroM);
const pools=[]; // recent big puddles, for bloody boots
function splat(x,z,sx,sz,ang,y){
  dummy.position.set(x,(y||0)+0.05+(y?0.04:0),z); dummy.rotation.set(0,ang===undefined?Math.random()*6.28:ang,0); dummy.scale.set(sx,1,sz); dummy.updateMatrix();
  imSplat.setMatrixAt(sIdx,dummy.matrix); sIdx=(sIdx+1)%MAXS; imSplat.instanceMatrix.needsUpdate=true;
}
function pool(x,z,r,y){ splat(x,z,r*rand(.8,1.2),r*rand(.8,1.2),undefined,y); pools.push({x,z,r:r*0.5,y:y||0}); if(pools.length>80) pools.shift(); }
function bleed(x,y,z,dx,dz,n,force,fy){
  for(let k=0;k<n;k++){
    dIdx=(dIdx+1)%MAXD; const j=dIdx;
    dFl[j]=fy||0; dX[j]=x+rand(-.1,.1); dY[j]=y+(fy||0)+rand(-.15,.15); dZ[j]=z+rand(-.1,.1);
    const f=force*rand(.4,1.2);
    dVX[j]=dx*f+rand(-1.2,1.2); dVZ[j]=dz*f+rand(-1.2,1.2); dVY[j]=rand(0.5,3.2); dL[j]=1;
  }
}
function updateBlood(dt){
  let any=false;
  for(let j=0;j<MAXD;j++){ if(!dL[j]) continue; any=true;
    dVY[j]-=14*dt; dX[j]+=dVX[j]*dt; dY[j]+=dVY[j]*dt; dZ[j]+=dVZ[j]*dt;
    if(dY[j]<=dFl[j]+0.05){ dL[j]=0; imDrop.setMatrixAt(j,zeroM); const r=rand(.12,.32); splat(dX[j],dZ[j],r,r*rand(1,2.2),Math.atan2(dVX[j],dVZ[j]),dFl[j]); continue; }
    dummy.position.set(dX[j],dY[j],dZ[j]); dummy.rotation.set(0,0,0); dummy.scale.set(1,1,1); dummy.updateMatrix(); imDrop.setMatrixAt(j,dummy.matrix);
  }
  if(any) imDrop.instanceMatrix.needsUpdate=true;
}
// severed parts
const gibs=[]; let gibIdx=0;
const GIB_MAX=50;
function gib(part,i,x,y,z,dx,dz){
  let g=gibs[gibIdx];
  const geo=partGeo(part==='head'?'head':'arm');
  if(!g){ g={m:new THREE.Mesh(geo,phong({color:0xffffff}))}; g.m.castShadow=true; onCharLayer(g.m); scene.add(g.m); gibs[gibIdx]=g; }
  else g.m.geometry=geo;
  gibIdx=(gibIdx+1)%GIB_MAX;
  const src=zim[part==='head'?'head':(part==='armL'?'armL':'armR')].instanceColor.array;
  g.m.material.color.setRGB(src[i*3],src[i*3+1],src[i*3+2]);
  Object.assign(g,{x,y,z,vx:dx*rand(3,6)+rand(-1,1),vy:rand(3,5.5),vz:dz*rand(3,6)+rand(-1,1),rx:rand(0,6),ry:rand(0,6),wx:rand(-12,12),wy:rand(-12,12),rest:false,t:0});
  g.m.visible=true;
  bleed(x,y,z,dx,dz,26,3.5);
}
function updateGibs(dt){
  for(const g of gibs){ if(!g||g.rest) continue;
    g.t+=dt; g.vy-=14*dt; g.x+=g.vx*dt; g.y+=g.vy*dt; g.z+=g.vz*dt; g.rx+=g.wx*dt; g.ry+=g.wy*dt;
    if(Math.random()<dt*20) bleed(g.x,g.y,g.z,0,0,1,0.3);
    if(g.y<=0.08){ g.y=0.08; g.vy*=-0.3; g.vx*=0.55; g.vz*=0.55; g.wx*=0.5; g.wy*=0.5; if(Math.abs(g.vy)<0.6){ g.rest=true; pool(g.x,g.z,0.6); g.rx=Math.PI/2; } }
    if(!cellWalk(0,Math.floor(g.x),Math.floor(g.z))&&g.y<2.5){ g.x-=g.vx*dt; g.z-=g.vz*dt; g.vx*=-0.4; g.vz*=-0.4; }
    g.m.position.set(g.x,g.y,g.z); g.m.rotation.set(g.rx,g.ry,0);
  }
}
// corpses keep the exact pose the body landed in
const MAXC=300; let cIdx=0;
const cim={};
for(const n of ZPARTS){
  const im=new THREE.InstancedMesh(partGeo(n),phong({color:0xffffff}),MAXC); im.frustumCulled=false; im.receiveShadow=true; im.castShadow=n==='torso';
  for(let k=0;k<MAXC;k++){ im.setMatrixAt(k,zeroM); tmpC.setRGB(0,0,0); im.setColorAt(k,tmpC); }
  onCharLayer(im); scene.add(im); cim[n]=im;
}
function freezeCorpse(i){
  for(const n of ZPARTS){
    cim[n].setMatrixAt(cIdx,ZNODE[n].matrixWorld);
    const a=zim[n].instanceColor.array; tmpC.setRGB(a[i*3]*0.85,a[i*3+1]*0.85,a[i*3+2]*0.85); cim[n].setColorAt(cIdx,tmpC);
    cim[n].instanceMatrix.needsUpdate=true; cim[n].instanceColor.needsUpdate=true;
  }
  cIdx=(cIdx+1)%MAXC;
}

/* ---------- combat effects: chips, casings, impacts, barricade wear ---------- */
const MAXCH=260, chX=new Float32Array(MAXCH), chY=new Float32Array(MAXCH), chZ=new Float32Array(MAXCH), chVX=new Float32Array(MAXCH), chVY=new Float32Array(MAXCH), chVZ=new Float32Array(MAXCH), chT=new Float32Array(MAXCH), chR=new Float32Array(MAXCH);
let chIdx=0;
const imChip=new THREE.InstancedMesh(new THREE.BoxGeometry(0.06,0.04,0.06),phong({color:0xffffff}),MAXCH);
imChip.frustumCulled=false; imChip.instanceMatrix.setUsage(THREE.DynamicDrawUsage); onCharLayer(imChip); scene.add(imChip);
for(let i=0;i<MAXCH;i++){ imChip.setMatrixAt(i,zeroM); tmpC.setRGB(.6,.62,.63); imChip.setColorAt(i,tmpC); }
function chips(x,y,z,n,dx,dz,hex){
  tmpC.setHex(hex||0x8f9496);
  for(let k=0;k<n;k++){ chIdx=(chIdx+1)%MAXCH; const j=chIdx;
    chX[j]=x; chY[j]=y; chZ[j]=z; chVX[j]=dx*rand(1,3)+rand(-2,2); chVZ[j]=dz*rand(1,3)+rand(-2,2); chVY[j]=rand(1.5,4.5); chT[j]=rand(1.5,3.5); chR[j]=rand(0,6);
    imChip.setColorAt(j,tmpC); }
  imChip.instanceColor.needsUpdate=true;
}
function updateChips(dt){
  let any=false;
  for(let j=0;j<MAXCH;j++){ if(chT[j]<=0) continue; any=true;
    chT[j]-=dt; if(chT[j]<=0){ imChip.setMatrixAt(j,zeroM); continue; }
    if(chY[j]>0.03||chVY[j]>0){ chVY[j]-=14*dt; chX[j]+=chVX[j]*dt; chY[j]+=chVY[j]*dt; chZ[j]+=chVZ[j]*dt; chR[j]+=dt*14;
      if(chY[j]<0.03){ chY[j]=0.03; chVY[j]=Math.abs(chVY[j])>1.2?-chVY[j]*0.3:0; chVX[j]*=0.5; chVZ[j]*=0.5; } }
    dummy.position.set(chX[j],chY[j],chZ[j]); dummy.rotation.set(chR[j],chR[j]*0.7,0); dummy.scale.set(1,1,1); dummy.updateMatrix(); imChip.setMatrixAt(j,dummy.matrix);
  }
  if(any) imChip.instanceMatrix.needsUpdate=true;
}
// brass that stays where it lands
const MAXB=420, bX=new Float32Array(MAXB), bY=new Float32Array(MAXB), bZ=new Float32Array(MAXB), bVX=new Float32Array(MAXB), bVY=new Float32Array(MAXB), bVZ=new Float32Array(MAXB), bR=new Float32Array(MAXB), bLive=new Uint8Array(MAXB);
