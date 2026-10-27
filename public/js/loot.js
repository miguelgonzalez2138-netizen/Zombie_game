'use strict';
// Fog Line — Loot and supplies: item types, grid inventories (Tarkov style), the squad's packs and the stash,
// searchable containers rolled fresh each run, things lying on the ground, the supply pools, and the inventory screen.
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- item types ---------- */
// cat: food water fuel scrap med mod tool wpn ammo thr. val = supply units it turns into at the stash.
const IT={
  can:{name:'CANNED BEANS',w:1,h:1,cat:'food',val:1},       snack:{name:'CHIPS',w:1,h:1,cat:'food',val:1},
  mre:{name:'MRE',w:1,h:2,cat:'food',val:2},                rice:{name:'SACK OF RICE',w:2,h:2,cat:'food',val:4},
  bottle:{name:'WATER BOTTLE',w:1,h:2,cat:'water',val:1},   soda:{name:'SODA',w:1,h:1,cat:'water',val:1},
  jug:{name:'WATER JUG',w:2,h:2,cat:'water',val:4},
  fluid:{name:'LIGHTER FLUID',w:1,h:1,cat:'fuel',val:1},    propane:{name:'PROPANE TANK',w:2,h:2,cat:'fuel',val:3},
  fuelcan:{name:'JERRY CAN',w:2,h:3,cat:'fuel',val:5},
  scrap:{name:'SCRAP',w:1,h:1,cat:'scrap',val:1,stack:5},   planks:{name:'PLANKS',w:1,h:3,cat:'scrap',val:4},
  sheet:{name:'SHEET METAL',w:2,h:2,cat:'scrap',val:5},
  bandage:{name:'BANDAGE',w:1,h:1,cat:'med',stack:4,heal:15}, medkit:{name:'MEDKIT',w:2,h:2,cat:'med',heal:60},
  pills:{name:'PAINKILLERS',w:1,h:1,cat:'med',stack:3,calm:35},
  supp:{name:'SUPPRESSOR',w:1,h:2,cat:'mod',mod:'supp'},    scope:{name:'SCOPE',w:2,h:1,cat:'mod',mod:'scope'},
  ext:{name:'EXT MAG',w:1,h:2,cat:'mod',mod:'ext'},         grip:{name:'FOREGRIP',w:1,h:1,cat:'mod',mod:'grip'},
  cutters:{name:'BOLT CUTTERS',w:1,h:3,cat:'tool'},
};
// weapons as items: long guns 1x4, the SAW 2x4, pistols 1x2, melee 1x3
for(const k in WPN){ const W=WPN[k]; if(W.slot<0||k==='fists') continue;
  IT['w_'+k]={name:W.name,w:k==='saw'?2:1,h:W.slot===0?4:W.slot===1?2:3,cat:'wpn',wpn:k}; }
// ammo and throwables only pass through a grid: taking them puts them straight into the squad's pools
for(const a in AMMO_NAME) IT['a_'+a]={name:AMMO_NAME[a]+' ROUNDS',w:1,h:a==='762'||a==='12g'?2:1,cat:'ammo',ammo:a};
for(const t of THR_ORDER) IT['t_'+t]={name:THR_NAME[t],w:1,h:t==='molotov'?2:1,cat:'thr',thr:t};
const CAT_COL={food:'#6f7a3a',water:'#3d6a86',fuel:'#8a4a2a',scrap:'#6c6660',med:'#8c3a3a',mod:'#4c5446',tool:'#5a5040',wpn:'#3a3c36',ammo:'#7a6a36',thr:'#4a4d34'};

let itemSeq=1;
function mkItem(key,n,extra){ const T=IT[key]; return Object.assign({id:itemSeq++,key,n:n||1,rot:false,x:0,y:0},extra||{}); }
function iw(it){ const T=IT[it.key]; return it.rot?T.h:T.w; }
function ih(it){ const T=IT[it.key]; return it.rot?T.w:T.h; }
function itemLabel(it){ const T=IT[it.key];
  if(T.cat==='ammo'||T.stack&&it.n>1||T.cat==='thr') return it.n+'× '+T.name;
  if(T.cat==='wpn'){ const m=it.mods&&Object.keys(it.mods).filter(k=>it.mods[k]); return T.name+(m&&m.length?' +'+m.length:''); }
  return T.name; }

/* ---------- grids ---------- */
class Grid{ constructor(w,h,name){ this.w=w; this.h=h; this.name=name||''; this.items=[]; } }
function gridFree(g,x,y,w,h,ignore){
  if(x<0||y<0||x+w>g.w||y+h>g.h) return false;
  for(const o of g.items){ if(o===ignore) continue; if(x<o.x+iw(o)&&x+w>o.x&&y<o.y+ih(o)&&y+h>o.y) return false; }
  return true;
}
// first spot it fits (stacking onto a partial stack first), trying both orientations
function autoPlace(g,it){
  const T=IT[it.key];
  if(T.stack){ for(const o of g.items){ if(o.key!==it.key||o.n>=T.stack) continue; const mv=Math.min(T.stack-o.n,it.n); o.n+=mv; it.n-=mv; if(it.n<=0) return true; } }
  for(const rot of [false,true]){ it.rot=rot; const w=iw(it), h=ih(it);
    for(let y=0;y<=g.h-h;y++) for(let x=0;x<=g.w-w;x++) if(gridFree(g,x,y,w,h)){ it.x=x; it.y=y; g.items.push(it); return true; } }
  it.rot=false; return false;
}
function removeItem(g,it){ const i=g.items.indexOf(it); if(i>=0) g.items.splice(i,1); }
function countKey(g,key){ let n=0; for(const o of g.items) if(o.key===key) n+=o.n; return n; }

/* ---------- the squad's supplies ---------- */
// simplified pools: food, water, fuel, scrap. Gear (meds, mods, weapons, tools) lives in the stash grid.
const SUP={food:0,water:0,fuel:0,scrap:0};
const stash=new Grid(10,8,'STASH');
forEachSoldier(s=>{ s.pack=new Grid(6,5,s.short); });
// random supplies each run
SUP.food=6+(Math.random()*5|0); SUP.water=6+(Math.random()*5|0); SUP.fuel=2+(Math.random()*3|0); SUP.scrap=10+(Math.random()*8|0);
autoPlace(squad[0].pack,mkItem('supp')); autoPlace(squad[0].pack,mkItem('bandage',2));
autoPlace(squad[3].pack,mkItem('bandage',2)); autoPlace(squad[1].pack,mkItem('mre')); autoPlace(squad[2].pack,mkItem('pills',1));
for(const k of ['bandage','bandage','medkit','pills']) autoPlace(stash,mkItem(k,k==='bandage'?3:1));
if(Math.random()<.6) autoPlace(stash,mkItem(Math.random()<.5?'grip':'scope'));
autoPlace(stash,weaponItem('axe',0));     // the hardware store's fire axe
autoPlace(stash,mkItem('cutters'));

/* ---------- things on the ground ---------- */
const items=[];
const matAmmoBox=phong({color:0x4a4d34}), matAmmoTag=phong({color:0xb0a070});
const matCat={}; for(const c in CAT_COL) matCat[c]=phong({color:new THREE.Color(CAT_COL[c]).multiplyScalar(1.3)});
function findSpot(L,x,z){
  for(let r=0;r<6;r++) for(let dz=-r;dz<=r;dz++) for(let dx=-r;dx<=r;dx++){ if(Math.max(Math.abs(dx),Math.abs(dz))!==r) continue;
    const cx=Math.floor(x)+dx, cz=Math.floor(z)+dz; if(cellWalk(L,cx,cz)) return {x:cx+0.5,z:cz+0.5}; }
  return null;
}
function itemMesh(g){
  const m=new THREE.Group(), it=g.it, T=IT[it.key];
  if(T.cat==='wpn'){ const gm=buildGun(T.wpn,it.mods,false); gm.rotation.set(0,0,Math.PI/2); gm.position.y=0.05; m.add(gm); m.scale.setScalar(1.2); }
  else if(T.cat==='ammo'){ gbox(m,0.36,0.18,0.22,matAmmoBox,0,0.09,0); gbox(m,0.37,0.04,0.12,matAmmoTag,0,0.12,0); }
  else if(T.cat==='thr'){ for(let k=0;k<Math.min(3,it.n);k++){ const p=new THREE.Mesh(projGeo[T.thr],T.thr==='frag'?matFrag:T.thr==='molotov'?matBottle:matDecoy); p.position.set(k*0.16-0.16,T.thr==='molotov'?0.13:0.08,0); m.add(p); } }
  else gbox(m,0.12*T.w+0.08,0.14,0.12*T.h+0.08,matCat[T.cat],0,0.07,0);
  m.position.set(g.x,g.L*LH,g.z); m.rotation.y=g.rot||0; onCharLayer(m); scene.add(m); g.m=m;
}
function dropGround(it,x,z,L){ const g={it,x,z,L,rot:rand(0,6)}; itemMesh(g); items.push(g); return g; }
function nearestItem(s,r){ let best=null, bd=r; for(const g of items){ if(g.L!==s.L) continue; const d=Math.hypot(g.x-s.x,g.z-s.z); if(d<bd){ bd=d; best=g; } } return best; }
function itemName(g){ return itemLabel(g.it); }
// into the pools, the pack, or (weapons) straight into an empty slot
function takeItem(s,it,fromGrid){
  const T=IT[it.key];
  if(T.cat==='ammo'){ AMMO[T.ammo]+=it.n; if(fromGrid) removeItem(fromGrid,it); radioLine('+'+it.n+' '+AMMO_NAME[T.ammo]+'.'); return true; }
  if(T.cat==='thr'){ THR[T.thr]+=it.n; if(fromGrid) removeItem(fromGrid,it); radioLine('+'+it.n+' '+THR_NAME[T.thr].toLowerCase()+'.'); return true; }
  if(T.cat==='wpn'&&!s.inv[WPN[T.wpn].slot]){ if(fromGrid) removeItem(fromGrid,it); equipFromItem(s,it); return true; }
  if(fromGrid) removeItem(fromGrid,it);
  if(autoPlace(s.pack,it)) return true;
  if(fromGrid) fromGrid.items.push(it);
  radioLine('No room in the pack.'); return false;
}
function pickUp(s,g){
  if(!takeItem(s,g.it,null)){
    // a weapon with a full slot and no room: swap it for what you're holding
    const T=IT[g.it.key]; if(T.cat!=='wpn') return;
    const slot=WPN[T.wpn].slot, old=unequipToItem(s,slot); dropGround(old,s.x+rand(-.3,.3),s.z+rand(-.3,.3),s.L); equipFromItem(s,g.it);
  }
  items.splice(items.indexOf(g),1); scene.remove(g.m);
  if(AC) SFX.click(0,0.4);
}
function weaponItem(key,mag,mods){ return mkItem('w_'+key,1,{mag,mods:Object.assign({},mods||{})}); }
function unequipToItem(s,slot){
  const key=s.inv[slot]; if(!key) return null;
  const it=weaponItem(key,s.mags[key]||0,s.mods[key]); s.inv[slot]=null; delete s.mods[key]; delete s.mags[key];
  if(s.slot===slot||!s.inv[s.slot]) ensureArmed(s);
  return it;
}
function equipFromItem(s,it){
  const key=IT[it.key].wpn, W=WPN[key];
  s.inv[W.slot]=key; s.mods[key]=Object.assign({},it.mods||{});
  s.mags[key]=it.mag!==undefined?Math.min(it.mag,magCap(s,key)):(W.melee?0:Math.floor(magCap(s,key)*0.5));
  s.modes[key]=s.modes[key]||0;
  equip(s,W.slot);
}

/* ---------- containers: every cupboard, fridge and locker, rolled when first opened ---------- */
const CSIZE={fridge:[3,3],cabinet:[3,2],shelf:[4,3],couch:[2,2],bed:[3,2],dresser:[3,3],rack:[4,3],till:[2,2],desk:[3,2],locker:[2,4],crate:[4,4],tools:[4,3],medcab:[3,3],armory:[5,4]};
const LT={  // [item, weight, min, max]
  fridge:[['can',3,1,1],['bottle',4,1,1],['jug',1,1,1],['snack',2,1,1],['soda',3,1,1],['mre',0.3,1,1]],
  cabinet:[['can',4,1,1],['rice',1,1,1],['bottle',2,1,1],['soda',2,1,1],['bandage',1,1,2],['pills',1,1,1],['fluid',1,1,1],['scrap',2,1,3]],
  shelf:[['scrap',3,1,4],['can',1,1,1],['fluid',1,1,1],['bandage',1,1,2],['a_22',0.6,10,25],['cutters',0.25,1,1],['sheet',0.8,1,1],['planks',1,1,1],['t_decoy',0.2,1,1]],
  couch:[['snack',1,1,1],['a_9mm',0.4,4,10],['scrap',0.6,1,1],['soda',0.6,1,1]],
  bed:[['snack',0.6,1,1],['pills',0.8,1,1],['a_9mm',0.4,5,12],['a_357',0.3,4,8],['w_rev',0.07,1,1],['w_m9',0.04,1,1],['w_bat',0.12,1,1]],
  dresser:[['snack',0.5,1,1],['pills',0.8,1,1],['bandage',0.8,1,2],['a_357',0.3,4,10],['a_22',0.3,10,20],['scrap',0.6,1,2]],
  desk:[['snack',1,1,1],['pills',0.6,1,1],['scrap',2,1,2],['a_9mm',0.4,4,12],['soda',1,1,1]],
  rack:[['can',3,1,1],['snack',3,1,1],['soda',2,1,1],['bottle',2,1,1],['rice',0.8,1,1],['fluid',0.5,1,1],['scrap',1,1,2],['jug',0.4,1,1]],
  till:[['snack',1,1,1],['a_9mm',0.3,5,10],['w_rev',0.08,1,1],['a_357',0.2,5,10]],
  locker:[['a_9mm',2,8,20],['a_556',1,15,30],['bandage',1,1,2],['pills',1,1,1],['w_bat',0.3,1,1],['w_m9',0.12,1,1],['a_12g',0.8,4,10],['ext',0.2,1,1]],
  crate:[['scrap',4,2,5],['planks',2,1,1],['sheet',1,1,1],['fuelcan',0.6,1,1],['can',1,1,1],['mre',0.7,1,1],['a_556',0.5,20,40],['propane',0.4,1,1]],
  tools:[['scrap',4,2,5],['planks',2,1,1],['cutters',0.5,1,1],['fluid',1,1,1],['grip',0.2,1,1],['w_axe',0.12,1,1]],
  medcab:[['bandage',4,1,3],['medkit',1.1,1,1],['pills',3,1,2]],
  armory:[['a_556',3,30,60],['a_762',2,20,50],['a_12g',2,8,16],['a_9mm',2,15,30],['w_m870',0.5,1,1],['w_m4',0.25,1,1],['w_r22',0.15,1,1],['scope',0.6,1,1],['ext',0.5,1,1],['grip',0.5,1,1],['supp',0.35,1,1],['t_frag',0.8,1,2],['medkit',0.4,1,1]],
};
// some places stock more of one thing
const KIND_BOOST={mart:{fuelcan:2,fluid:2,propane:2,snack:2,soda:2},market:{can:2,rice:2,jug:2},ware:{fuelcan:2,scrap:1.5,sheet:2,propane:1.5},clinic:{bandage:2,medkit:2,pills:1.5},
  police:{a_9mm:2,a_556:1.5,a_12g:1.5},school:{snack:2,soda:2,scrap:1.5},church:{can:2,bottle:2,rice:1.5},station:{snack:1.5,soda:1.5,scrap:1.5},fieldhouse:{bottle:2,snack:1.5}};
const containers=[];
{
  const qual=new Map();
  for(const B of MAP.blds){ if(!B.enter) continue;
    // most places have been picked over; a few haven't
    qual.set(B.id,B.name?rand(0.7,1.1):Math.random()<0.4?rand(0.05,0.25):rand(0.45,1)); }
  for(const f of MAP.furn){ if(!f||!f.loot) continue; const B=MAP.blds[f.b];
    if(B.kind==='base'&&f.type==='crate') { f.stash=true; continue; }
    if(B.kind==='base'&&f.type==='workbench'){ f.workbench=true; continue; }
    if(f.stove&&B.kind==='base') continue;
    const sz=CSIZE[f.loot]||[3,3];
    containers.push({f,L:f.L,x:(f.x0+f.x1)/2,z:(f.z0+f.z1)/2,kind:f.loot,grid:new Grid(sz[0],sz[1],f.loot.toUpperCase()),rolled:false,q:B.kind==='base'?1:qual.get(B.id)||0.5,bk:B.kind,seen:0});
  }
}
function rollContainer(c){
  c.rolled=true;
  const tab=LT[c.kind]; if(!tab) return;
  const boost=KIND_BOOST[c.bk]||{};
  const cells=c.grid.w*c.grid.h, n=Math.round(rand(0,1)*c.q*(1+cells/5)*(c.bk==='base'?1.4:0.8));
  let tot=0; const w=tab.map(r=>{ const v=r[1]*(boost[r[0]]||1); tot+=v; return v; });
  for(let k=0;k<n;k++){
    let r=Math.random()*tot, row=tab[0]; for(let i=0;i<tab.length;i++){ r-=w[i]; if(r<=0){ row=tab[i]; break; } }
    const key=row[0], cnt=row[2]+(Math.random()*(row[3]-row[2]+1)|0);
    const it=IT[key].cat==='wpn'?weaponItem(IT[key].wpn,WPN[IT[key].wpn].melee?0:Math.floor(WPN[IT[key].wpn].mag*rand(0.2,0.9))):mkItem(key,cnt);
    if(!autoPlace(c.grid,it)) break;
  }
  for(const it of c.grid.items) it.hidden=true;
}
function boxDist(f,x,z){ const px=clamp(x,f.x0,f.x1), pz=clamp(z,f.z0,f.z1); return Math.hypot(x-px,z-pz); }
function nearestFurn(s,pred,r){ let best=null, bd=r; for(const f of MAP.furn){ if(!f||f.L!==s.L||!pred(f)) continue; const d=boxDist(f,s.x,s.z); if(d<bd){ bd=d; best=f; } } return best; }
function nearestContainer(s){ let best=null, bd=1.0; for(const c of containers){ if(c.L!==s.L) continue; const d=boxDist(c.f,s.x,s.z); if(d<bd){ bd=d; best=c; } } return best; }
const CNAME={fridge:'FRIDGE',cabinet:'CUPBOARD',shelf:'SHELF',couch:'COUCH',bed:'BED',dresser:'DRESSER',rack:'SHELVES',till:'REGISTER',desk:'DESK',locker:'LOCKER',crate:'CRATE',tools:'TOOL BENCH',medcab:'MED CABINET',armory:'GUN RACK'};
// a cop or soldier sometimes still has something on them
function corpseDrop(i){
  if(zl[i]>4) return; const o=zout[i];
  if(o===1&&Math.random()<.22) dropGround(mkItem('a_9mm',4+(Math.random()*9|0)),zx[i],zz[i],zl[i]);
  else if(o===2&&Math.random()<.3) dropGround(mkItem(Math.random()<.7?'a_556':'t_frag',Math.random()<.7?10+(Math.random()*20|0):1),zx[i],zz[i],zl[i]);
}

/* ---------- using things ---------- */
function useItem(s,it,g){
  const T=IT[it.key];
  if(T.cat==='med'){
    let what='';
    if(T.heal){ const hurt=s.hp<100||s.wounds.bleed||s.wounds.leg||s.wounds.arm; if(!hurt){ radioLine(s.short.charAt(0)+s.short.slice(1).toLowerCase()+' is fine.'); return; } s.hp=Math.min(100,s.hp+T.heal*(hasPerk(s,'medic')?1.5:1)); what=treatWounds(s,T); giveXP(s,3,'heal'); }
    if(T.calm) s.stress=Math.max(0,s.stress-T.calm);
    it.n--; if(it.n<=0) removeItem(g,it);
    radioLine(s.short.charAt(0)+s.short.slice(1).toLowerCase()+' used '+T.name.toLowerCase()+(what?' ('+what+')':'')+'.');
    if(AC) SFX.click(0,0.3); return;
  }
  if(T.cat==='mod'){ attachMod(s,it,g,null); return; }
  if(T.cat==='wpn'){ removeItem(g,it); const slot=WPN[T.wpn].slot, old=unequipToItem(s,slot); equipFromItem(s,it); if(old&&!autoPlace(g,old)&&!autoPlace(s.pack,old)) dropGround(old,s.x,s.z,s.L); }
}
// fit a mod to a weapon (the one in `slot`, or the first one that takes it)
function attachMod(s,it,g,slot){
  const m=IT[it.key].mod;
  const slots=slot!==null&&slot!==undefined?[slot]:[0,1];
  for(const k of slots){ const key=s.inv[k]; if(!key) continue; const W=WPN[key]; if(!W.mods||!W.mods.includes(m)) continue;
    const ms=modsOf(s,key); if(ms[m]){ continue; }
    ms[m]=true; removeItem(g,it); if(s.wpn===key) refreshWeapon(s); else s.mags[key]=Math.min(s.mags[key]||0,magCap(s,key));
    radioLine(MOD_NAME[m].toLowerCase()+' on the '+W.name.toLowerCase()+'.'); return true; }
  radioLine('Nothing here takes a '+MOD_NAME[m].toLowerCase()+'.'); return false;
}
function detachMod(s,slot,m){
  const key=s.inv[slot]; if(!key||!hasMod(s,m,key)) return;
  const it=mkItem(m); if(!autoPlace(s.pack,it)){ radioLine('No room in the pack.'); return; }
  modsOf(s,key)[m]=false; if(s.wpn===key) refreshWeapon(s); else s.mags[key]=Math.min(s.mags[key]||0,magCap(s,key));
}
// buddies patch themselves up when it gets bad
function autoHeal(s){
  if(s.hp>=45) return;
  const it=s.pack.items.find(i=>IT[i.key].heal)||null; if(it){ useItem(s,it,s.pack); return; }
  if(atBase(s)){ const st=stash.items.find(i=>IT[i.key].heal); if(st) useItem(s,st,stash); }
}
function atBase(s){ return s.L<=1&&s.x>-34&&s.x<14&&s.z>-15&&s.z<48; }
// at the stash: supplies in the pack turn into the pools
function depositSupplies(s){
  let got={food:0,water:0,fuel:0,scrap:0};
  for(const it of s.pack.items.slice()){ const T=IT[it.key]; if(T.val&&got[T.cat]!==undefined){ got[T.cat]+=T.val*it.n; SUP[T.cat]+=T.val*it.n; removeItem(s.pack,it); } }
  const parts=Object.keys(got).filter(k=>got[k]).map(k=>'+'+got[k]+' '+k);
  if(parts.length) radioLine(s.short.charAt(0)+s.short.slice(1).toLowerCase()+' stocked '+parts.join(', ')+'.');
  return parts.length>0;
}
// dawn: everyone eats and drinks from the pools; hot food if there's fuel for the stove
function dailyUpkeep(){
  const alive=squad.filter(s=>s.alive&&!s.away);
  // whoever's home empties their pack into the stash first
  for(const s of alive) if(atBase(s)) depositSupplies(s);
  let hungry=0, thirsty=0, hot=false;
  if(G.hotMeal){ hot=true; G.hotMeal=false; } else if(SUP.fuel>=1&&SUP.food>=1){ SUP.fuel-=1; hot=true; }
  for(const s of alive){
    const k=hasPerk(s,'iron')?0.5:1;
    if(SUP.food>=1) SUP.food--; else { hungry++; s.hp=Math.max(5,s.hp-18*k); s.fat=Math.min(100,s.fat+10*k); }
    if(SUP.water>=1) SUP.water--; else { thirsty++; s.hp=Math.max(5,s.hp-22*k); }
    if(hot) s.stress=Math.max(0,s.stress-15);
  }
  if(BASEUP.barrels) SUP.water+=2;
  if(BASEUP.garden){ SUP.food+=1; radio('A handful of greens off the roof.'); }
  const msg=[]; if(hot) msg.push('Hot meal on the stove.'); else if(SUP.fuel<1) msg.push('No fuel for the stove. Cold beans.');
  if(hungry) msg.push(hungry+' went without food.'); if(thirsty) msg.push(thirsty+' went without water.');
  if(msg.length) radio(msg.join(' '));
  if(SUP.food<squad.length*2) radio('Food for '+Math.floor(SUP.food/Math.max(1,alive.length))+' more day'+(Math.floor(SUP.food/Math.max(1,alive.length))===1?'':'s')+'.');
}
const BASEUP={line:false,tools:false,barrels:false,stove:false,lights:false,den:false,gen:false,garden:false,lookout:false};

/* ---------- the inventory screen ---------- */
const CS=34; // px per cell
const INV={open:false,who:me,other:null,otherKind:'',drag:null,searchT:0};
const invEl=document.getElementById('inv');
function invOpen(kind,other){
  const s=squad[me]; INV.open=true; INV.who=me; INV.otherKind=kind||''; INV.other=other||null;
  if(kind==='container'&&!other.rolled){ rollContainer(other); giveXP(s,3,'search'); STATS.searched++; }
  invEl.hidden=false; mouseDown=false; throwAiming=false; renderInv();
}
function invClose(){ INV.open=false; invEl.hidden=true; cancelDrag(); }
function invToggle(){ if(INV.open){ invClose(); return; } const s=squad[me]; invOpen(atBase(s)?'stash':'',atBase(s)?stash:null); }
function whoCanSee(k){ const p=squad[me], s=squad[k]; return s.alive&&(k===me||(s.L===p.L&&Math.hypot(s.x-p.x,s.z-p.z)<4)||(atBase(s)&&atBase(p))); }
function gridHTML(g,id,opts){
  let h=`<div class="grid" id="${id}" style="width:${g.w*CS}px;height:${g.h*CS}px;background-size:${CS}px ${CS}px">`;
  for(const it of g.items){ const T=IT[it.key];
    const st=`left:${it.x*CS}px;top:${it.y*CS}px;width:${iw(it)*CS-2}px;height:${ih(it)*CS-2}px;`;
    if(it.hidden) h+=`<div class="it hid" style="${st}"><span>?</span></div>`;
    else h+=`<div class="it c-${T.cat}${it.rot?' rot':''}" data-g="${id}" data-id="${it.id}" style="${st}background:${CAT_COL[T.cat]}"><span>${itemLabel(it)}</span></div>`; }
  return h+'</div>';
}
function slotHTML(s){
  const names=['PRIMARY','SIDEARM','MELEE'];
  return names.map((n,k)=>{ const key=s.inv[k], W=key?WPN[key]:null;
    const mods=key&&W.mods?W.mods.map(m=>`<i class="${hasMod(s,m,key)?'on':''}" data-slot="${k}" data-mod="${m}" title="${MOD_NAME[m]}">${MOD_NAME[m]}</i>`).join(''):'';
    return `<div class="slot${k===s.slot&&!s.mounted?' cur':''}" data-slot="${k}"><b>${n}</b><span>${W?W.name:'—'}</span>${W&&!W.melee?`<em>${s.mags[key]}/${magCap(s,key)}</em>`:''}<div class="mods">${mods}</div></div>`; }).join('');
}
function renderInv(){
  if(!INV.open) return;
  const s=squad[INV.who];
  const tabs=squad.map((q,k)=>`<button class="${k===INV.who?'on':''}" data-who="${k}" ${whoCanSee(k)?'':'disabled'}>${q.short}</button>`).join('');
  const pools=`<div class="pools"><span>FOOD <b>${SUP.food}</b></span><span>WATER <b>${SUP.water}</b></span><span>FUEL <b>${SUP.fuel}</b></span><span>SCRAP <b>${SUP.scrap}</b></span></div>
    <div class="pools am">${Object.keys(AMMO_NAME).map(a=>`<span>${AMMO_NAME[a]} <b>${AMMO[a]}</b></span>`).join('')}${THR_ORDER.map(t=>`<span>${THR_NAME[t]} <b>${THR[t]}</b></span>`).join('')}</div>`;
  let right='';
  if(INV.otherKind==='container'){ const c=INV.other; right=`<div class="ttl">${CNAME[c.kind]||'CONTAINER'}${c.grid.items.some(i=>i.hidden)?' · SEARCHING':c.grid.items.length?'':' · EMPTY'}</div>${gridHTML(c.grid,'gO')}<div class="btns"><button id="bTakeAll">TAKE ALL</button></div>`; }
  else if(INV.otherKind==='stash'){ right=`<div class="ttl">STASH · FERRETERIA MORALES</div>${gridHTML(stash,'gO')}<div class="btns"><button id="bDeposit">STOCK SUPPLIES</button></div><div class="note">Food, water, fuel and scrap dropped here go into the squad's supplies.</div>`; }
  else right=`<div class="ttl dim">NOTHING OPEN</div><div class="note">Search a container with E, or open this at the base to reach the stash. Drag an item off the screen to drop it.</div>`;
  invEl.innerHTML=`<div class="invbox"><div class="invL"><div class="tabs">${tabs}</div><div class="slots">${slotHTML(s)}</div><div class="ttl">PACK · ${s.short}</div>${gridHTML(s.pack,'gP')}${pools}</div>
    <div class="invR">${right}</div>
    <div class="hint">Drag to move · R rotates while dragging · Shift-click moves across · Right-click uses, fits a mod or detaches it · Tab / Esc close</div></div>`;
  invEl.querySelectorAll('[data-who]').forEach(b=>b.onclick=()=>{ INV.who=+b.dataset.who; renderInv(); });
  const bt=document.getElementById('bTakeAll'); if(bt) bt.onclick=()=>{ const c=INV.other; for(const it of c.grid.items.slice()) if(!it.hidden) takeItem(squad[INV.who],it,c.grid); renderInv(); };
  const bd=document.getElementById('bDeposit'); if(bd) bd.onclick=()=>{ depositSupplies(squad[INV.who]); renderInv(); };
}
function gridById(id){ return id==='gP'?squad[INV.who].pack:id==='gO'?(INV.otherKind==='container'?INV.other.grid:stash):null; }
function itemById(g,id){ return g.items.find(i=>i.id===id); }
// moving into the stash: supplies dissolve into the pools
function intoStash(it,g){ const T=IT[it.key]; if(T.val&&SUP[T.cat]!==undefined){ SUP[T.cat]+=T.val*it.n; removeItem(g,it); return true; } return false; }
invEl.addEventListener('contextmenu',e=>{
  e.preventDefault(); const s=squad[INV.who];
  const md=e.target.closest('[data-mod]'); if(md){ detachMod(s,+md.dataset.slot,md.dataset.mod); renderInv(); return; }
  const el=e.target.closest('.it[data-id]'); if(!el) return;
  const g=gridById(el.dataset.g), it=itemById(g,+el.dataset.id); if(!it) return;
  if(IT[it.key].cat==='ammo'||IT[it.key].cat==='thr'){ takeItem(s,it,g); renderInv(); return; }
  useItem(s,it,g); renderInv();
});
invEl.addEventListener('pointerdown',e=>{
  if(e.button!==0) return;
  const el=e.target.closest('.it[data-id]'); if(!el) return;
  const g=gridById(el.dataset.g), it=itemById(g,+el.dataset.id); if(!it) return;
  const s=squad[INV.who];
  if(e.shiftKey){ // quick move across
    if(g===s.pack){ if(INV.otherKind==='stash'){ if(!intoStash(it,g)){ removeItem(g,it); if(!autoPlace(stash,it)) g.items.push(it); } } else if(INV.otherKind==='container'){ removeItem(g,it); if(!autoPlace(INV.other.grid,it)) g.items.push(it); } }
    else takeItem(s,it,g);
    renderInv(); return; }
  const r=el.getBoundingClientRect();
  INV.drag={it,g,ox:e.clientX-r.left,oy:e.clientY-r.top,rot0:it.rot,ghost:el.cloneNode(true)};
  const gh=INV.drag.ghost; gh.classList.add('ghost'); gh.style.left=r.left+'px'; gh.style.top=r.top+'px'; gh.style.position='fixed'; document.body.appendChild(gh);
  el.style.opacity=0.3; e.preventDefault();
});
function cancelDrag(){ const d=INV.drag; if(!d) return; d.it.rot=d.rot0; d.ghost.remove(); INV.drag=null; renderInv(); }
function dragGhost(e){ const d=INV.drag; const gh=d.ghost; gh.style.width=(iw(d.it)*CS-2)+'px'; gh.style.height=(ih(d.it)*CS-2)+'px'; gh.style.left=(e.clientX-Math.min(d.ox,iw(d.it)*CS-6))+'px'; gh.style.top=(e.clientY-Math.min(d.oy,ih(d.it)*CS-6))+'px'; }
addEventListener('pointermove',e=>{ if(INV.drag) dragGhost(e); });
addEventListener('keydown',e=>{ if(INV.drag&&e.key.toLowerCase()==='r'){ INV.drag.it.rot=!INV.drag.it.rot; INV.drag.ghost.classList.toggle('rot'); dragGhost({clientX:INV.lastX||0,clientY:INV.lastY||0}); } });
addEventListener('pointermove',e=>{ INV.lastX=e.clientX; INV.lastY=e.clientY; });
addEventListener('pointerup',e=>{
  const d=INV.drag; if(!d) return; INV.drag=null; d.ghost.style.display='none';
  const s=squad[INV.who], it=d.it, under=document.elementFromPoint(e.clientX,e.clientY); d.ghost.remove();
  const slotEl=under&&under.closest('.slot'), gridEl=under&&under.closest('.grid'), box=under&&under.closest('.invbox');
  const T=IT[it.key];
  if(slotEl){ const k=+slotEl.dataset.slot;
    if(T.cat==='mod'){ attachMod(s,it,d.g,k); }
    else if(T.cat==='wpn'&&WPN[T.wpn].slot===k){ removeItem(d.g,it); const old=unequipToItem(s,k); equipFromItem(s,it); if(old&&!autoPlace(d.g,old)&&!autoPlace(s.pack,old)) dropGround(old,s.x,s.z,s.L); }
    else it.rot=d.rot0;
    renderInv(); return; }
  if(gridEl){ const g=gridById(gridEl.id), r=gridEl.getBoundingClientRect();
    const x=Math.round((e.clientX-r.left-Math.min(d.ox,iw(it)*CS-6))/CS), y=Math.round((e.clientY-r.top-Math.min(d.oy,ih(it)*CS-6))/CS);
    if(g===stash&&intoStash(it,d.g)){ renderInv(); return; }
    // stack onto a matching partial stack
    const tgt=g.items.find(o=>o!==it&&o.key===it.key&&T.stack&&e.clientX-r.left>=o.x*CS&&e.clientX-r.left<(o.x+iw(o))*CS&&e.clientY-r.top>=o.y*CS&&e.clientY-r.top<(o.y+ih(o))*CS);
    if(tgt&&tgt.n<T.stack){ const mv=Math.min(T.stack-tgt.n,it.n); tgt.n+=mv; it.n-=mv; if(it.n<=0) removeItem(d.g,it); renderInv(); return; }
    if((T.cat==='ammo'||T.cat==='thr')&&g!==d.g){ takeItem(s,it,d.g); renderInv(); return; }
    if(gridFree(g,x,y,iw(it),ih(it),g===d.g?it:null)){ removeItem(d.g,it); it.x=x; it.y=y; g.items.push(it); }
    else it.rot=d.rot0;
    renderInv(); return; }
  if(!box){ // off the screen: drop it at your feet
    removeItem(d.g,it); dropGround(it,s.x+rand(-.4,.4),s.z+rand(-.4,.4),s.L); renderInv(); return; }
  it.rot=d.rot0; renderInv();
});
// searching reveals a container's contents one at a time; standing there makes a little noise
function updateInv(dt){
  if(!INV.open) return;
  const s=squad[me];
  if(INV.otherKind==='container'){ const c=INV.other;
    if(c.L!==s.L||boxDist(c.f,s.x,s.z)>1.6){ invClose(); return; }
    const h=c.grid.items.find(i=>i.hidden);
    if(h){ INV.searchT-=dt; if(INV.searchT<=0){ INV.searchT=hasPerk(s,'scrounger')?0.25:0.45; h.hidden=false; c.seen++; if(AC) SFX.click(0,0.15); if(Math.random()<.3) makeNoise(s.x,s.z,3,s.L); if(!INV.drag) renderInv(); } }
  } else if(INV.otherKind==='stash'&&!atBase(s)){ INV.otherKind=''; INV.other=null; renderInv(); }
  if(INV.who!==me&&!whoCanSee(INV.who)){ INV.who=me; renderInv(); }
}
