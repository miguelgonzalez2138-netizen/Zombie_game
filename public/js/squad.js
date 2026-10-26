'use strict';
// Fog Line — Squad depth: survivors to recruit, specific wounds, XP and perks, relationships, fatigue,
// per-soldier orders through the radial wheel, scavenging runs off the map, callouts, cover, the squad cards
// down the side and the squad screen.
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- XP, levels, roles, perks ---------- */
const LVL_CAP=10;
function xpNeed(l){ return Math.round(60*Math.pow(l,1.45)); }
const HIT={s:null};                       // who's dealing damage right now (for kill credit)
const PERKS={
  steady:{name:'STEADY HANDS',desc:'Tighter spread with every gun.',role:'fight'},
  quick:{name:'QUICK HANDS',desc:'Reloads a quarter faster.',role:'fight'},
  eagle:{name:'EAGLE EYE',desc:'More head shots.',role:'fight'},
  deadeye:{name:'DEADEYE',desc:'Better aim when you are not the one holding the gun.',role:'fight'},
  brawler:{name:'BRAWLER',desc:'Hits a third harder up close.',role:'melee'},
  tough:{name:'TOUGH',desc:'Takes a fifth less damage.',role:'melee'},
  runner:{name:'RUNNER',desc:'Sprinting burns less stamina.',role:'melee'},
  handy:{name:'HANDY',desc:'Repairs half again as fast.',role:'build'},
  mule:{name:'MULE',desc:'A bigger pack.',role:'search'},
  scrounger:{name:'SCROUNGER',desc:'Searches faster, brings back more from runs.',role:'search'},
  light:{name:'LIGHT FEET',desc:'Footsteps make half the noise.',role:'search'},
  medic:{name:'MEDIC',desc:'Meds go half again as far.',role:'heal'},
  cool:{name:'COOL HEAD',desc:'Nerves fray a third slower.',role:'heal'},
  iron:{name:'IRON GUT',desc:'Hunger, thirst and fatigue bite less.',role:'heal'},
};
const ROLE_NAME={fight:'RIFLEMAN',melee:'BRAWLER',build:'ENGINEER',search:'SCAVENGER',heal:'MEDIC',scav:'SCAVENGER',shot:'MARKSMAN'};
const hasPerk=(s,id)=>s.perks.includes(id);
function roleOf(s){ let best='fight', bv=-1; for(const k in s.did){ const v=s.did[k]*(k==='fight'?0.5:1); if(v>bv){ bv=v; best=k; } } if(bv<3) return s.trait.toUpperCase(); return ROLE_NAME[best]; }
function giveXP(s,amt,cat){
  if(!s||!s.alive) return;
  if(cat) s.did[cat]=(s.did[cat]||0)+1;
  if(s.lvl>=LVL_CAP) return;
  s.xp+=amt;
  while(s.lvl<LVL_CAP&&s.xp>=xpNeed(s.lvl)){ s.xp-=xpNeed(s.lvl); s.lvl++; s.perkPending++; s.offer=null;
    radio(nameOf(s)+' made level '+s.lvl+'. Pick a perk (J).'); }
}
// three perks to choose from, leaning toward what they actually do
function perkOffer(s){
  if(s.offer) return s.offer;
  const role=Object.keys(s.did).sort((a,b)=>s.did[b]-s.did[a])[0]||'fight';
  const pool=Object.keys(PERKS).filter(k=>!s.perks.includes(k));
  const w=pool.map(k=>PERKS[k].role===role||(role==='scav'&&PERKS[k].role==='search')||(role==='shot'&&PERKS[k].role==='fight')?3:1);
  const out=[];
  while(out.length<3&&pool.length){ let tot=w.reduce((a,b)=>a+b,0), r=Math.random()*tot; let i=0; for(;i<pool.length;i++){ r-=w[i]; if(r<=0) break; } i=Math.min(i,pool.length-1); out.push(pool[i]); pool.splice(i,1); w.splice(i,1); }
  return s.offer=out;
}
function pickPerk(s,id){
  if(s.perkPending<=0||!PERKS[id]) return;
  s.perks.push(id); s.perkPending--; s.offer=null;
  if(id==='brawler') s.melee*=1.33;
  if(id==='deadeye') s.acc=Math.min(0.95,s.acc+0.1);
  if(id==='mule'){ s.pack.h=7; }
}
function nameOf(s){ return s.short.charAt(0)+s.short.slice(1).toLowerCase(); }

/* ---------- relationships ---------- */
const REL=new Map();
function relKey(a,b){ return a.uid<b.uid?a.uid+'-'+b.uid:b.uid+'-'+a.uid; }
function relGet(a,b){ return REL.get(relKey(a,b))||0; }
function relAdd(a,b,v){ if(a===b) return; REL.set(relKey(a,b),clamp(relGet(a,b)+v,-100,100)); }
// the original four have history
relAdd(squad[0],squad[2],30); relAdd(squad[0],squad[3],22); relAdd(squad[1],squad[2],-12); relAdd(squad[1],squad[3],18); relAdd(squad[0],squad[1],8); relAdd(squad[2],squad[3],10);
function relWord(v){ return v>=60?'TIGHT':v>=25?'FRIENDS':v>-15?'OK':v>-45?'TENSE':'CAN\'T STAND'; }
// how being around the others changes how fast nerves fray
function relStressMul(s){
  let m=1;
  for(const q of squad){ if(q===s||!present(q)||q.L!==s.L) continue; if(Math.hypot(q.x-s.x,q.z-s.z)>10) continue;
    const r=relGet(s,q); if(r>40) m-=0.08; else if(r<-30) m+=0.12; }
  return clamp(m,0.6,1.5);
}
function present(s){ return s.alive&&!s.away; }

/* ---------- wounds ---------- */
// a bite can open a specific wound: a leg (slow, no sprinting when bad), an arm (shaky aim, slow reloads), or a bleed
function woundOnBite(s,fromX,fromZ){
  if(Math.random()>0.35) return;
  const r=Math.random();
  if(r<0.4){ s.wounds.bleed=Math.min(2,s.wounds.bleed+1); bark(s,'bleed'); }
  else if(r<0.7){ s.wounds.leg=Math.min(2,s.wounds.leg+1); bark(s,'leg'); }
  else { s.wounds.arm=Math.min(2,s.wounds.arm+1); bark(s,'arm'); }
}
function woundSpeed(s){ return (s.wounds.leg===2?0.62:s.wounds.leg===1?0.82:1)*(s.fat>85?0.88:1); }
function aimMul(s){ return (s.wounds.arm===2?1.9:s.wounds.arm===1?1.4:1)*(s.fat>60?1+(s.fat-60)/90:1)*(hasPerk(s,'steady')?0.8:1); }
function reloadMul(s){ return (s.wounds.arm?1.35:1)*(hasPerk(s,'quick')?0.75:1); }
function stepWounds(s,dt){
  if(s.wounds.bleed>0){ s.hp-=s.wounds.bleed*0.55*dt; if(Math.random()<dt*1.5) splat(s.x+rand(-.2,.2),s.z+rand(-.2,.2),0.09,0.13,undefined,s.y);
    if(s.hp<=0) soldierDown(s); }
}
// meds: bandages close a bleed, a medkit sets a leg or an arm
function treatWounds(s,T){
  if(T.heal&&T.heal<30){ if(s.wounds.bleed>0){ s.wounds.bleed=0; return 'bleeding stopped'; } }
  if(T.heal>=30){ if(s.wounds.leg>0){ s.wounds.leg--; return 'leg patched'; } if(s.wounds.arm>0){ s.wounds.arm--; return 'arm patched'; } s.wounds.bleed=0; }
  return '';
}
function woundText(s){ const w=s.wounds, o=[]; if(w.bleed) o.push(w.bleed>1?'BLEEDING BAD':'BLEEDING'); if(w.leg) o.push(w.leg>1?'LEG ×2':'LEG'); if(w.arm) o.push(w.arm>1?'ARM ×2':'ARM'); return o; }

/* ---------- fatigue ---------- */
function stepFatigue(s,dt){
  const iron=hasPerk(s,'iron')?0.7:1;
  let d=0;
  if(G.phase==='night'||G.phase==='dusk') d+=0.045;
  else if(atBase(s)&&Math.hypot(s.vx,s.vz)<0.3&&s.order!=='scav') d-=s.order==='rest'&&s.resting?0.9:0.3;
  else d+=0.015;
  if(s.sprint) d+=0.35; if(s.loudT>0) d+=0.03;
  s.fat=clamp(s.fat+(d>0?d*iron:d)*dt,0,100);
}

/* ---------- survivors out there ---------- */
const FIRST=['Marisol','Tomasz','Deshawn','Lupe','Ana','Mike','Jun','Rosa','Victor','Halina','Earl','Teresa','Danny','Kasia','Luis','Patrice','Nick','Yolanda','Ray','Bogdan','Imani','Javier','Gloria','Stan','Lena','Omar','Graciela','Pete','Esther','Mateo','Dorota','Curtis','Inez','Frank','Lucia','Andre','Zofia','Hector','Bernice','Sal'];
const LAST=['Ortega','Wilk','Price','Navarro','Kowal','Brennan','Park','Delgado','Ruiz','Nowak','Simmons','Gomez','Flores','Zielinski','Barrera','Holloway','Petrakis','Mendez','Sokol','Washington','Cruz','Lis','Hernandez','Dabrowski','Moreno','Kaminski','Fuentes','Gallagher','Pacheco','Novak','Rios','Bell','Salazar','Wozniak','Castillo','Jablonski','Vega','Murphy','Ibarra','Lopez'];
const SHIRTS=[0x5a3a3a,0x3a4a5e,0x6a6a5a,0x2e3a2e,0x7a5a3a,0x4a2e4a,0x8a8070,0x30343a,0x6a2a22,0x3e5a5a],PANTS=[0x2a2e3a,0x3a3a3a,0x4a4030,0x22262e,0x5a5244],HAIR=[0x1a1410,0x2e2216,0x4a3420,0x6a6058,0x111111,0x5a3a20];
const SKINS=[0xa98466,0x8a6448,0xc69c7c,0x6a4a34,0xb08868,0x7a5840];
const survivors=[];
function rollSurvivor(){
  const used=new Set(squad.map(s=>s.short).concat(survivors.map(v=>v.d.short)));
  let first, last; do{ first=FIRST[Math.random()*FIRST.length|0]; last=LAST[Math.random()*LAST.length|0]; } while(used.has(last.toUpperCase()));
  const r=Math.random();
  const kit=r<0.35?[null,null,null]:r<0.6?[null,null,Math.random()<.6?'bat':'axe']:r<0.85?[null,Math.random()<.6?'m9':'rev',null]:[Math.random()<.6?'m870':'r22',null,null];
  const look={civ:true,shirt:SHIRTS[Math.random()*SHIRTS.length|0],pants:PANTS[Math.random()*PANTS.length|0],hair:HAIR[Math.random()*HAIR.length|0],skin:SKINS[Math.random()*SKINS.length|0],
    cap:Math.random()<.3,long:Math.random()<.4,jacket:Math.random()<.5?SHIRTS[Math.random()*SHIRTS.length|0]:0,bag:Math.random()<.5?0x4a4038:0};
  const trait=['steady','jumpy','quiet','tough','careful','loud'][Math.random()*6|0];
  return {name:first+' '+last,short:last.toUpperCase(),trait,acc:rand(.32,.62),stress:rand(.8,1.6),melee:rand(.8,1.4),kit,look,post:{x:0,z:0},civ:true};
}
function placeSurvivor(){
  if(squad.filter(s=>s.alive).length+survivors.length>=MAX_SQUAD) return null;
  for(let t=0;t<60;t++){
    const B=MAP.blds[Math.random()*MAP.blds.length|0]; if(!B.enter||B.kind==='base') continue;
    const cx=(B.x0+B.x1)/2, cz=(B.z0+B.z1)/2, d=Math.hypot(cx+20,cz-14); if(d<45||d>170) continue;
    const L=Math.random()*B.floors|0;
    const p=findSpot(L,rand(B.x0+1,B.x1-1),rand(B.z0+1,B.z1-1)); if(!p||bldAt(L,p.x,p.z)!==B.id) continue;
    const d0=rollSurvivor(); const mesh=soldierMesh(-1,d0.look); mesh.scale.setScalar(1.2); mesh.rotation.order='YXZ'; onCharLayer(mesh); scene.add(mesh);
    const v={d:d0,x:p.x,z:p.z,L,mesh,B,ang:rand(0,6),t:rand(0,9)};
    mesh.position.set(p.x,L*LH,p.z); mesh.rotation.y=v.ang;
    // sitting on the floor, hugging their knees
    const u=mesh.userData; u.legs[0].rotation.x=-1.3; u.legs[1].rotation.x=-1.2; u.torso.position.y=0.5;
    for(const sx of [-1,1]){ const a=gbox(u.W,0.11,0.11,0.42,u.M.uni,sx*0.2,0.42,0.2); a.rotation.x=0.5; gbox(u.W,0.09,0.09,0.09,u.M.skin,sx*0.12,0.3,0.4); }
    survivors.push(v); return v;
  }
  return null;
}
for(let k=0;k<4;k++) placeSurvivor();
function nearestSurvivor(s){ let best=null, bd=1.8; for(const v of survivors){ if(v.L!==s.L) continue; const d=Math.hypot(v.x-s.x,v.z-s.z); if(d<bd){ bd=d; best=v; } } return best; }
const JOIN_LINES=['"Took you long enough."','"You got food? Then yeah."','"I can carry. I can shoot. Mostly carry."','"Thank God. I thought you were them."','"I heard the shooting every night. Figured that was the safest place."','"Fine. But I\'m not sleeping next to the loud one."'];
function recruit(v){
  if(squad.filter(s=>s.alive).length>=MAX_SQUAD){ radioLine('No room in the squad.'); return; }
  survivors.splice(survivors.indexOf(v),1); scene.remove(v.mesh);
  const d=Object.assign({},v.d,{post:{x:v.x,z:v.z}});
  const s=makeSoldier(d);
  s.x=v.x; s.z=v.z; s.L=v.L; s.y=v.L*LH; s.order='follow'; s.lightOn=G.weaponsFree; s.fat=30;
  for(const q of squad) if(q!==s) relAdd(s,q,rand(-10,15));
  autoPlace(s.pack,mkItem(Math.random()<.5?'can':'snack')); if(Math.random()<.5) autoPlace(s.pack,mkItem('bandage',1));
  radio(d.name+' joins. '+JOIN_LINES[Math.random()*JOIN_LINES.length|0]);
  renderCards();
}
function updateSurvivors(dt){
  for(const v of survivors){ v.t+=dt; const u=v.mesh.userData; u.torso.rotation.x=0.35+Math.sin(v.t*0.7)*0.05;
    v.mesh.visible=!charHidden(v.L,v.x,v.z,v.L*LH); }
}

/* ---------- callouts ---------- */
const BARKS={
  reload:['Reloading!','Changing mags!','Cover me, reloading.','Mag out!'],
  contact:['Contact!','Movement!','They\'re coming.','Here they come.'],
  bleed:['I\'m bleeding.','It got me. I\'m leaking.','Shit. Shit. I\'m bleeding.'],
  leg:['My leg!','It bit my leg, I can walk. Sort of.','Leg\'s bad.'],
  arm:['My arm—I can still shoot.','Got my arm.','Arm\'s chewed.'],
  low:['Running low.','Low on ammo.','Last mag.'],
  ok:['Copy.','On it.','Moving.','Roger.','Yeah, yeah.'],
  refuse:['Not a chance.','You go do it.','Screw that.','I\'m not going out there.','Ask someone else.'],
  down:['Man down!','We lost one!','No—no, no.'],
  many:['There\'s a lot of them.','Big group!','We\'re gonna need more bullets.'],
  rest:['Five minutes. Just five.','Wake me if they get in.'],
  back:['Back. Brought what I could.','Home. Don\'t ask what I saw.','Back in one piece. Mostly.'],
};
const barkT=new Map(); let barkGlobal=0;
function bark(s,kind,force){
  const now=time; if(!force&&(now-barkGlobal<2.5||(barkT.get(s.uid+kind)||-99)>now-9)) return;
  barkT.set(s.uid+kind,now); barkGlobal=now;
  const L=BARKS[kind]; radio(nameOf(s)+': '+L[Math.random()*L.length|0]);
}

/* ---------- orders ---------- */
const ORDERS=[
  {id:'hold',name:'HOLD HERE'},{id:'watch',name:'WATCH THERE'},{id:'follow',name:'FOLLOW ME'},{id:'fallback',name:'FALL BACK'},
  {id:'heal',name:'HEAL'},{id:'scav',name:'SCAVENGE'},{id:'mg',name:'MAN THE GUN'},{id:'rest',name:'REST'},
];
// some orders get refused: wound-up, worn out, or they can't stand whoever's giving it
function disobeys(s,order){
  if(order==='fallback'||order==='rest') return false;
  const leader=squad[me];
  let p=0; if(s.stress>80) p+=0.35; if(s.fat>85) p+=0.15; if(leader&&relGet(s,leader)<-30) p+=0.25;
  if(order==='scav'&&s.wounds.leg) p+=0.3;
  return Math.random()<p;
}
function setOrder(s,order,pt,quiet){
  if(!present(s)||s.i===me) return false;
  if(disobeys(s,order)){ bark(s,'refuse',true); relAdd(s,squad[me],-3); return false; }
  if(s.mounted&&order!=='mg') dismount(s);
  s.order=order; s.resting=false; s.cover=null;
  if(order==='hold'&&pt){ const f=findSpot(squad[me].L,pt.x,pt.z)||pt; s.post={x:f.x,z:f.z}; s.postL=squad[me].L; s.watch=null; s.postSet=true; }
  if(order==='watch'&&pt){ if(!s.postSet){ s.post={x:s.x,z:s.z}; s.postL=s.L; } s.postSet=true; s.watch=Math.atan2(pt.x-s.post.x,pt.z-s.post.z); }
  if(order==='hold'&&!pt){ s.watch=null; }
  if(order==='heal'){ const t=mostHurt(s); if(!t){ s.order='hold'; if(!quiet) radioLine('Nobody needs patching.'); return false; } s.healTgt=t; }
  if(order==='mg'){ const n=freeNest(s); if(!n){ s.order='hold'; if(!quiet) radioLine('No free gun.'); return false; } s.nest=n; }
  if(order==='scav'){ if(G.phase!=='day'){ s.order='hold'; if(!quiet) radioLine('Not with the light going.'); return false; } }
  if(!quiet) bark(s,order==='rest'?'rest':'ok');
  return true;
}
function orderAll(order){ for(const s of squad) if(s.i!==me&&present(s)) setOrder(s,order,null,true); }
function mostHurt(s){ let best=null, bv=0; for(const q of squad){ if(!present(q)) continue; const need=(100-q.hp)+q.wounds.bleed*30+q.wounds.leg*20+q.wounds.arm*20; if(need>bv&&need>15){ bv=need; best=q; } } return best; }
function freeNest(s){ let best=null, bd=60; for(const S of strs){ if(S.dead||S.type!=='mg'||S.manned) continue; const d=Math.hypot(S.cx-s.x,S.cz-s.z); if(d<bd){ bd=d; best=S; } } return best; }
function healSomeone(s,t){
  let it=s.pack.items.find(i=>IT[i.key].cat==='med'&&IT[i.key].heal&&(t.wounds.bleed?IT[i.key].heal<30:true)), g=s.pack;
  if(!it&&atBase(s)){ it=stash.items.find(i=>IT[i.key].cat==='med'&&IT[i.key].heal); g=stash; }
  if(!it){ radioLine(nameOf(s)+': No meds on me.'); return false; }
  const T=IT[it.key]; t.hp=Math.min(100,t.hp+T.heal*(hasPerk(s,'medic')?1.5:1)); const what=treatWounds(t,T);
  it.n--; if(it.n<=0) removeItem(g,it);
  giveXP(s,8,'heal'); relAdd(s,t,6);
  radio(nameOf(s)+' patched up '+(t.i===me?'you':nameOf(t))+(what?' ('+what+')':'')+'.');
  return true;
}

/* ---------- scavenging runs: off the map and back ---------- */
let pickScav=null;   // soldier waiting for a building to be picked on the map
function startPickScav(s){ if(G.phase!=='day'){ radioLine('Not with the light going.'); return; } pickScav=s; if(!G.mapOpen) act('map'); radio('Pick a building on the map for '+nameOf(s)+'.'); }
function scavTo(s,B){
  if(!setOrder(s,'scav')) return;
  const cx=(B.x0+B.x1)/2, cz=(B.z0+B.z1)/2, d=Math.hypot(cx-s.x,cz-s.z);
  s.scav={B,hours:1+d/55+(B.name?0.5:0),leave:time};
  radio(nameOf(s)+' heads for '+(B.name?B.name.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()):'a '+(B.kind==='store'?'storefront':B.kind==='ware'?'warehouse':'two-flat'))+'. Back in about '+Math.round(s.scav.hours*10)/10+' hours.');
}
// called from the buddy update while they're walking out: once out of sight, they're gone
function stepScavOut(s,dt){
  const p=squad[me], B=s.scav.B, gx=(B.x0+B.x1)/2, gz=(B.z0+B.z1)/2;
  navTo(s,gx,gz,0,4.2,dt);
  const far=Math.hypot(s.x-p.x,s.z-p.z)>Math.min(30,G.fogFar*0.8);
  if(far||time-s.scav.leave>25){ s.away={B,left:s.scav.hours*HOUR,total:s.scav.hours*HOUR}; s.scav=null; s.mesh.visible=false; s.fat=Math.min(100,s.fat+18); }
}
function stepAway(s,dt){
  const A=s.away; if(G.phase==='day') A.left-=dt; else A.left=0;
  if(A.left>0) return;
  // back: roll their luck, then empty the building's cupboards into their pack
  const danger=0.06+A.total/HOUR*0.03+(G.phase!=='day'?0.25:0);
  const B=A.B; let n=0;
  for(const c of containers){ const f=c.f; if(f.b!==B.id) continue; if(!c.rolled) rollContainer(c);
    for(const it of c.grid.items.slice()){ it.hidden=false; const T=IT[it.key];
      if(T.cat==='ammo'){ AMMO[T.ammo]+=it.n; removeItem(c.grid,it); n++; continue; }
      if(T.cat==='thr'){ THR[T.thr]+=it.n; removeItem(c.grid,it); n++; continue; }
      if(autoPlace(s.pack,it)){ removeItem(c.grid,it); n++; } } }
  if(hasPerk(s,'scrounger')) autoPlace(s.pack,mkItem(Math.random()<.5?'can':'scrap',Math.random()<.5?1:2));
  s.away=null; s.mesh.visible=true; s.order='fallback';
  const gate=findSpot(0,0,46)||{x:0,z:44}; s.x=gate.x; s.z=gate.z; s.L=0; s.y=0; s.trav=null; s.field=null;
  giveXP(s,30,'scav');
  if(Math.random()<danger*0.12){ s.hp=0; soldierDown(s); radio(nameOf(s)+' never came back from the run.'); return; }
  if(Math.random()<danger){ s.hp=Math.max(15,s.hp-rand(15,40)); const r=Math.random(); if(r<.5) s.wounds.bleed=1; else if(r<.8) s.wounds.leg=1; else s.wounds.arm=1; radio(nameOf(s)+' is back, hurt. '+n+' things in the pack.'); }
  else radio(nameOf(s)+': '+BARKS.back[Math.random()*BARKS.back.length|0]+' ('+n+' things)');
}

/* ---------- cover: stand behind something solid between you and them ---------- */
function solidCell(L,x,z){ if(!inMap(x,z)) return false; const b=MAP.block[L][CI(x,z)]; return b===BLK.BUILT||b===BLK.LINE||b===BLK.PROP||b===BLK.FURN; }
function findCover(s,tx,tz){
  const dx=tx-s.post.x, dz=tz-s.post.z, d=Math.hypot(dx,dz)||1, ux=dx/d, uz=dz/d, L=s.L;
  let best=null, bd=9;
  for(let r=0;r<=2.6;r+=0.65) for(let a=0;a<8;a++){ const px=s.post.x+Math.cos(a*0.785)*r, pz=s.post.z+Math.sin(a*0.785)*r;
    if(!cellWalk(L,Math.floor(px),Math.floor(pz))||MAP.block[L][CI(Math.floor(px),Math.floor(pz))]===BLK.LINE) continue;
    if(!solidCell(L,Math.floor(px+ux*1.1),Math.floor(pz+uz*1.1))) continue;
    const c=Math.hypot(px-s.post.x,pz-s.post.z); if(c<bd){ bd=c; best={x:px,z:pz}; } if(r===0) break; }
  return best;
}

/* ---------- the radial order wheel (hold Q) ---------- */
const wheelEl=document.getElementById('wheel');
const WHEEL={open:false,downT:0,cx:0,cy:0,sel:-1,target:null,pt:null};
function wheelOpen(){
  const p=squad[me]; WHEEL.open=true; WHEEL.cx=mouseX; WHEEL.cy=mouseY; WHEEL.sel=-1; WHEEL.pt=aimPoint(p,0);
  let best=null, bd=2.5; for(const s of squad){ if(s.i===me||!present(s)||s.L!==p.L) continue; const d=Math.hypot(s.x-WHEEL.pt.x,s.z-WHEEL.pt.z); if(d<bd){ bd=d; best=s; } }
  WHEEL.target=best;
  wheelEl.style.left=WHEEL.cx+'px'; wheelEl.style.top=WHEEL.cy+'px'; wheelEl.hidden=false; renderWheel();
}
function renderWheel(){
  const R=96;
  wheelEl.innerHTML=`<div class="wc">${WHEEL.target?WHEEL.target.short:'SQUAD'}</div>`+ORDERS.map((o,k)=>{ const a=-Math.PI/2+k*Math.PI/4;
    return `<div class="wo${k===WHEEL.sel?' on':''}" style="left:${Math.cos(a)*R}px;top:${Math.sin(a)*R}px">${o.name}</div>`; }).join('');
}
function wheelMove(e){ if(!WHEEL.open) return; const mx=e?e.clientX:mouseX, my=e?e.clientY:mouseY, dx=mx-WHEEL.cx, dy=my-WHEEL.cy; let sel=-1;
  if(Math.hypot(dx,dy)>28){ const a=Math.atan2(dy,dx)+Math.PI/2; sel=((Math.round(a/(Math.PI/4))%8)+8)%8; }
  if(sel!==WHEEL.sel){ WHEEL.sel=sel; renderWheel(); } }
function wheelClose(){
  WHEEL.open=false; wheelEl.hidden=true; if(WHEEL.sel<0) return;
  const o=ORDERS[WHEEL.sel].id, list=WHEEL.target?[WHEEL.target]:squad.filter(s=>s.i!==me&&present(s));
  if(!list.length){ radioLine('Nobody to order.'); return; }
  if(o==='scav'){ const s=WHEEL.target||list.find(q=>q.order!=='scav'); if(s) startPickScav(s); return; }
  let i=0;
  for(const s of list){
    let pt=WHEEL.pt;
    if((o==='hold'||o==='watch')&&!WHEEL.target){ const k=i-(list.length-1)/2; pt={x:WHEEL.pt.x+k*1.4,z:WHEEL.pt.z}; }
    if(o==='mg'&&!WHEEL.target&&i>0) break;
    setOrder(s,o,pt,list.length>1&&i>0); i++;
  }
  if(o==='follow') G.order='follow'; else if(o==='fallback') G.order='fallback'; else if(o==='hold') G.order='hold';
}
addEventListener('pointermove',wheelMove);

/* ---------- squad cards down the side ---------- */
const sideEl=document.getElementById('squad');
let cardEls=[];
function renderCards(){
  sideEl.innerHTML=squad.map(s=>`<div class="card" data-i="${s.i}"><div class="n"><span>${s.short}</span><i></i></div><div class="t"><span class="ro"></span><span class="st">HOLD</span></div><div class="bar"><b></b></div><div class="bar s"><b></b></div><div class="bar f"><b></b></div><div class="w"></div><div class="a"></div></div>`).join('');
  cardEls=[...sideEl.querySelectorAll('.card')].map(c=>({c,lv:c.querySelector('.n i'),ro:c.querySelector('.ro'),st:c.querySelector('.st'),hp:c.querySelectorAll('.bar b')[0],str:c.querySelectorAll('.bar b')[1],fat:c.querySelectorAll('.bar b')[2],w:c.querySelector('.w'),a:c.querySelector('.a')}));
  sideEl.querySelectorAll('.card').forEach(c=>c.onclick=()=>{ const s=squad[+c.dataset.i]; if(present(s)&&s.i!==me){ squad[me].lightOn=G.weaponsFree; me=s.i; s.lightOn=true; } });
}
function updateCards(){
  if(cardEls.length!==squad.length) renderCards();
  squad.forEach((s,k)=>{ const c=cardEls[k];
    c.c.classList.toggle('me',k===me); c.c.classList.toggle('down',!s.alive); c.c.classList.toggle('away',!!s.away);
    c.lv.textContent='L'+s.lvl+(s.perkPending?' +':'');
    c.ro.textContent=roleOf(s);
    c.st.textContent=!s.alive?'DOWN':s.away?'AWAY '+Math.ceil(s.away.left/HOUR*10)/10+'H':s.status;
    c.st.className='st'+(s.status==='PANIC'||!s.alive?' bad':s.status==='RELOAD'||s.status==='REFUSED'?' warn':'');
    c.hp.style.width=Math.max(0,s.hp)+'%'; c.str.style.width=s.stress+'%'; c.fat.style.width=s.fat+'%';
    const w=woundText(s); c.w.textContent=w.join(' · '); c.w.style.display=w.length?'':'none';
    const W=WPN[s.wpn]; c.a.textContent=W.melee?W.name:(s.mags[s.wpn]+' · '+AMMO[W.ammo]+' '+AMMO_NAME[W.ammo]);
  });
}
renderCards();

/* ---------- squad screen (J) ---------- */
const sqEl=document.getElementById('squadscr');
const SQ={open:false,sel:0};
function sqToggle(){ SQ.open=!SQ.open; sqEl.hidden=!SQ.open; if(SQ.open){ SQ.sel=me; renderSQ(); } }
function renderSQ(){
  if(!SQ.open) return;
  const s=squad[SQ.sel];
  const list=squad.map((q,k)=>`<button class="${k===SQ.sel?'on':''}${q.alive?'':' dead'}" data-k="${k}">${q.short} <i>L${q.lvl}${q.perkPending?' +':''}</i></button>`).join('');
  const offer=s.alive&&s.perkPending?perkOffer(s):[];
  const rels=squad.filter(q=>q!==s&&q.alive).map(q=>{ const v=relGet(s,q); return `<div class="rel"><span>${q.short}</span><i><b style="width:${Math.abs(v)/2}%;${v<0?'right:50%;background:var(--bad)':'left:50%'}"></b></i><em>${relWord(v)}</em></div>`; }).join('');
  sqEl.innerHTML=`<div class="sqbox"><div class="sqL">${list}</div><div class="sqR">
    <div class="ttl">${s.name.toUpperCase()}</div>
    <div class="sub2">${roleOf(s)} · LEVEL ${s.lvl}${s.lvl<LVL_CAP?` · ${Math.floor(s.xp)}/${xpNeed(s.lvl)} XP`:''}${roleOf(s)!==s.trait.toUpperCase()?' · '+s.trait.toUpperCase():''}${s.civ?' · CIVILIAN':''}</div>
    <div class="stats"><span>AIM <b>${Math.round(s.acc*100)}</b></span><span>MELEE <b>${Math.round(s.melee*100)}</b></span><span>NERVE <b>${Math.round(100/s.stressK)}</b></span><span>HP <b>${Math.round(s.hp)}</b></span><span>STRESS <b>${Math.round(s.stress)}</b></span><span>FATIGUE <b>${Math.round(s.fat)}</b></span></div>
    <div class="stats"><span>WOUNDS <b>${woundText(s).join(', ')||'NONE'}</b></span></div>
    <div class="sub">PERKS</div><div class="perks">${s.perks.map(p=>`<span title="${PERKS[p].desc}">${PERKS[p].name}</span>`).join('')||'<em>None yet.</em>'}</div>
    ${offer.length?`<div class="sub">PICK ONE</div><div class="offer">${offer.map(p=>`<button data-p="${p}"><b>${PERKS[p].name}</b><small>${PERKS[p].desc}</small></button>`).join('')}</div>`:''}
    <div class="sub">THE OTHERS</div>${rels||'<em>Nobody left.</em>'}
  </div><div class="hint">J or Esc to close</div></div>`;
  sqEl.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{ SQ.sel=+b.dataset.k; renderSQ(); });
  sqEl.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ pickPerk(s,b.dataset.p); renderSQ(); });
}

/* ---------- daily: a night survived together, wounds mending, new faces ---------- */
function squadDawn(){
  const alive=squad.filter(s=>s.alive&&!s.away);
  for(const s of alive){ giveXP(s,25,null); s.days++;
    if(atBase(s)){ if(s.wounds.leg&&Math.random()<.4) s.wounds.leg--; if(s.wounds.arm&&Math.random()<.4) s.wounds.arm--; } }
  for(let a=0;a<alive.length;a++) for(let b=a+1;b<alive.length;b++) relAdd(alive[a],alive[b],rand(1,4));
  if(Math.random()<0.4) placeSurvivor();
}
function onSoldierLost(s){
  for(const q of squad){ if(q===s||!q.alive) continue; const r=relGet(q,s); if(r>25){ q.stress=Math.min(100,q.stress+30+r*0.4); } }
  const close=squad.filter(q=>q!==s&&q.alive&&relGet(q,s)>40);
  if(close.length) radio(nameOf(close[0])+' won\'t stop staring at where '+nameOf(s)+' went down.');
}
