'use strict';
// Fog Line — Ambient soundscape and sound effects (all synthesized, no audio files).
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- audio ---------- */
let AC=null, master=null, noiseBuf=null, muffle=null;
function initAudio(){
  if(AC) return;
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    master=AC.createGain(); master.gain.value=0.55;
    muffle=AC.createBiquadFilter(); muffle.type='lowpass'; muffle.frequency.value=20000; muffle.Q.value=0.5; master.connect(muffle); muffle.connect(AC.destination);
    noiseBuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const bed=(type,freq,q,vol)=>{ const n=AC.createBufferSource(); n.buffer=noiseBuf; n.loop=true; n.playbackRate.value=rand(.9,1.1);
      const f=AC.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q; const g=AC.createGain(); g.gain.value=vol;
      n.connect(f); f.connect(g); g.connect(master); n.start(); return {g,f}; };
    amb.wind=bed('lowpass',340,0.7,0.06);
    amb.whistle=bed('bandpass',900,9,0.0);
    amb.rumble=bed('lowpass',75,0.7,0.07);
    amb.murmur=bed('bandpass',230,1.4,0.0);
    amb.rain=bed('highpass',2400,0.5,0.0);
    const hum=AC.createOscillator(); hum.type='sawtooth'; hum.frequency.value=60;
    const hf=AC.createBiquadFilter(); hf.type='lowpass'; hf.frequency.value=170; const hg=AC.createGain(); hg.gain.value=0;
    hum.connect(hf); hf.connect(hg); hg.connect(master); hum.start(); amb.hum={g:hg};
  }catch(e){AC=null;}
}
// gunshots by weapon: rifle, mg, big (.308/.357), shot(gun), pistol, small (.22), and suppressed
const GUN_SND={rifle:[3000,0.9,0.32,0],mg:[2400,1.0,0.34,60],big:[2000,1.15,0.6,48],shot:[1800,1.2,0.5,55],pistol:[3600,0.7,0.24,0],small:[4200,0.45,0.14,0]};
function sGun(dist,kind,supp,pan){
  if(!AC) return; const t=AC.currentTime, att=1/(1+dist*0.06), out=outNode(pan||0,1);
  if(supp){ const g=AC.createGain(); g.connect(out); env(g,t,0.002,0.22*att,0.09); nz(t,0.12,'bandpass',rand(900,1300),1.2,g);
    const g2=AC.createGain(); g2.connect(out); env(g2,t+0.01,0.001,0.05*att,0.04); osc(t+0.01,0.05,'square',rand(1800,2200),900,g2); return; }
  const P=GUN_SND[kind]||GUN_SND.rifle;
  const s=AC.createBufferSource(); s.buffer=noiseBuf; s.playbackRate.value=rand(.8,1.1);
  const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(rand(P[0]*0.85,P[0]*1.15)*att+400,t); f.frequency.exponentialRampToValueAtTime(220,t+P[2]*0.7);
  const g=AC.createGain(); g.gain.setValueAtTime(P[1]*att,t); g.gain.exponentialRampToValueAtTime(0.0008,t+P[2]);
  s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t+P[2]+0.05);
  if(P[3]){ const g3=AC.createGain(); g3.connect(out); env(g3,t,0.002,0.5*att,P[2]*0.8); osc(t,P[2],'sine',P[3]*2,P[3]*0.6,g3); }
}
function sMoan(dist){
  if(!AC||dist>40) return; const t=AC.currentTime, att=1/(1+dist*0.12);
  const o=AC.createOscillator(); o.type='sawtooth'; const f0=rand(70,105); o.frequency.setValueAtTime(f0,t); o.frequency.linearRampToValueAtTime(f0*0.72,t+1.3);
  const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=380;
  const g=AC.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.13*att,t+0.3); g.gain.linearRampToValueAtTime(0,t+1.4);
  o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t+1.5);
}
/* ambient one-shots: everything far off, panned, filtered */
const amb={wind:null,whistle:null,rumble:null,murmur:null,hum:null,next:4,crackle:0,lastFlutter:0};
function outNode(pan,vol){
  const g=AC.createGain(); g.gain.value=vol;
  if(AC.createStereoPanner){ const p=AC.createStereoPanner(); p.pan.value=clamp(pan,-1,1); g.connect(p); p.connect(master); } else g.connect(master);
  return g;
}
function nz(t,dur,type,freq,q,out){ const n=AC.createBufferSource(); n.buffer=noiseBuf; n.playbackRate.value=rand(.8,1.2);
  const f=AC.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q||1; n.connect(f); f.connect(out); n.start(t,Math.random()*0.5); n.stop(t+dur); return f; }
function env(g,t,a,peak,d){ g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+d); }
function osc(t,dur,type,f0,f1,out){ const o=AC.createOscillator(); o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur); o.connect(out); o.start(t); o.stop(t+dur+0.05); return o; }
const SFX={
  dog(pan){ const t0=AC.currentTime, o=outNode(pan,1), lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1100; lp.connect(o);
    const n=2+(Math.random()*3|0); for(let i=0;i<n;i++){ const t=t0+i*rand(.28,.45), g=AC.createGain(); g.connect(lp); env(g,t,0.01,0.05,0.16);
      osc(t,0.16,'sawtooth',rand(420,520),rand(260,320),g); nz(t,0.12,'bandpass',800,2,g); } },
  alarm(pan){ const t0=AC.currentTime, o=outNode(pan,1), lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1400; lp.connect(o);
    const g=AC.createGain(); g.connect(lp); g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(0.018,t0+0.4); g.gain.setValueAtTime(0.018,t0+4.5); g.gain.linearRampToValueAtTime(0.0001,t0+5.5);
    const v=AC.createOscillator(); v.type='square'; for(let i=0;i<11;i++){ v.frequency.setValueAtTime(700,t0+i*0.5); v.frequency.linearRampToValueAtTime(1150,t0+i*0.5+0.45);} v.connect(g); v.start(t0); v.stop(t0+5.6); },
  farShot(pan){ const t=AC.currentTime, g=outNode(pan,1); env(g,t,0.005,0.13,1.3); nz(t,1.4,'lowpass',420,0.7,g);
    if(Math.random()<.4){ const g2=outNode(pan,1); env(g2,t+0.35,0.005,0.08,1.1); nz(t+0.35,1.2,'lowpass',380,0.7,g2);} },
  clang(pan){ const t=AC.currentTime, g=outNode(pan,1); env(g,t,0.005,0.05,1.8);
    nz(t,2,'bandpass',rand(900,1400),18,g); nz(t,2,'bandpass',rand(1800,2600),22,g); },
  birds(pan){ const t0=AC.currentTime, o=outNode(pan,1); const n=3+(Math.random()*5|0);
    for(let i=0;i<n;i++){ const t=t0+i*rand(.08,.22), g=AC.createGain(); g.connect(o); env(g,t,0.005,0.022,0.06); osc(t,0.07,'sine',rand(2600,3200),rand(3300,4200),g);} },
  crow(pan){ const t0=AC.currentTime, o=outNode(pan,1), bp=AC.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=900; bp.Q.value=3; bp.connect(o);
    for(let i=0;i<2+(Math.random()*2|0);i++){ const t=t0+i*0.42, g=AC.createGain(); g.connect(bp); env(g,t,0.02,0.07,0.28); osc(t,0.3,'sawtooth',rand(480,560),rand(380,430),g);} },
  siren(pan){ const t0=AC.currentTime, o=outNode(pan,1), lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; lp.connect(o);
    const g=AC.createGain(); g.connect(lp); g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(0.012,t0+3); g.gain.linearRampToValueAtTime(0.0001,t0+12);
    const v=AC.createOscillator(); v.type='sine'; for(let i=0;i<4;i++){ v.frequency.setValueAtTime(560,t0+i*3); v.frequency.linearRampToValueAtTime(880,t0+i*3+1.5); v.frequency.linearRampToValueAtTime(560,t0+i*3+3);} v.connect(g); v.start(t0); v.stop(t0+12.2); },
  rotor(pan){ const t0=AC.currentTime, o=outNode(pan,1), lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=180; lp.connect(o);
    const g=AC.createGain(); g.connect(lp); g.gain.value=0;
    for(let i=0;i<90;i++){ const t=t0+i*0.085, amp=Math.sin(i/90*Math.PI)*0.06; g.gain.setValueAtTime(amp,t); g.gain.linearRampToValueAtTime(amp*0.15,t+0.06); }
    nz(t0,8,'lowpass',260,0.7,g); },
  drip(pan){ const t0=AC.currentTime, o=outNode(pan,1); for(let i=0;i<2+(Math.random()*3|0);i++){ const t=t0+i*rand(.5,1.1), g=AC.createGain(); g.connect(o); env(g,t,0.002,0.02,0.05); osc(t,0.05,'sine',rand(1500,2000),rand(900,1100),g);} },
  glass(pan){ const t0=AC.currentTime, o=outNode(pan,1); for(let i=0;i<6;i++){ const t=t0+i*rand(.02,.09), g=AC.createGain(); g.connect(o); env(g,t,0.001,0.03,0.12); nz(t,0.15,'highpass',rand(3500,6000),4,g);} },
  farMoans(pan){ const t0=AC.currentTime, o=outNode(pan,1), lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=300; lp.connect(o);
    for(let i=0;i<4;i++){ const t=t0+rand(0,1.5), g=AC.createGain(); g.connect(lp); env(g,t,0.4,0.035,1.4); osc(t,1.8,'sawtooth',rand(70,110),rand(50,70),g);} },
  flutter(pan,vol){ const t0=AC.currentTime, o=outNode(pan,vol); for(let i=0;i<14;i++){ const t=t0+i*rand(.025,.05), g=AC.createGain(); g.connect(o); env(g,t,0.003,0.09,0.05); nz(t,0.07,'bandpass',rand(500,900),1.5,g);} },
  squeak(pan,vol){ const t=AC.currentTime, g=outNode(pan,vol); env(g,t,0.005,0.03,0.08); osc(t,0.09,'square',rand(2800,3400),rand(3600,4200),g); },
  tink(pan,vol){ const t=AC.currentTime, g=outNode(pan,vol); env(g,t,0.001,0.05,0.09); osc(t,0.1,'sine',rand(3800,5200),rand(3400,4600),g); },
  creak(pan,vol){ const t0=AC.currentTime, o=outNode(pan,vol), bp=AC.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=900; bp.Q.value=6; bp.connect(o);
    const g=AC.createGain(); g.connect(bp); env(g,t0,0.03,0.12,0.35); const s=AC.createOscillator(); s.type='sawtooth'; s.frequency.setValueAtTime(rand(180,260),t0); s.frequency.linearRampToValueAtTime(rand(120,170),t0+0.35); s.connect(g); s.start(t0); s.stop(t0+0.42);
    const g2=AC.createGain(); g2.connect(o); env(g2,t0+0.3,0.005,0.12,0.12); nz(t0+0.3,0.15,'lowpass',300,1,g2); },
  boom(pan,vol){ const t=AC.currentTime, o=outNode(pan,vol); const g=AC.createGain(); g.connect(o); env(g,t,0.003,1.2,1.6); nz(t,1.8,'lowpass',520,0.8,g);
    const g2=AC.createGain(); g2.connect(o); env(g2,t,0.003,0.9,0.9); osc(t,1,'sine',90,28,g2);
    const g3=AC.createGain(); g3.connect(o); env(g3,t+0.05,0.01,0.12,2.2); nz(t+0.05,2.4,'bandpass',1800,1.5,g3); },
  click(pan,vol){ const t=AC.currentTime, g=outNode(pan,vol); env(g,t,0.001,0.12,0.03); nz(t,0.04,'bandpass',2600,4,g); },
  rack(pan,vol){ const t=AC.currentTime; for(const [dt,f] of [[0,1800],[0.12,2400]]){ const g=outNode(pan,vol); env(g,t+dt,0.001,0.14,0.05); nz(t+dt,0.06,'bandpass',f,3,g);} },
  swing(pan,vol){ const t=AC.currentTime, g=outNode(pan,vol); env(g,t,0.06,0.09,0.12); const f=nz(t,0.22,'bandpass',600,1.4,g); f.frequency.setValueAtTime(400,t); f.frequency.linearRampToValueAtTime(1400,t+0.15); },
  chop(pan,vol){ const t=AC.currentTime, g=outNode(pan,vol); env(g,t,0.001,0.4,0.12); nz(t,0.15,'lowpass',900,1,g); const g2=AC.createGain(); g2.connect(g); osc(t,0.1,'triangle',160,60,g2); },
  bottle(pan,vol){ const t=AC.currentTime; for(let i=0;i<5;i++){ const g=outNode(pan,vol); env(g,t+i*0.02,0.001,0.08,0.2); nz(t+i*0.02,0.25,'highpass',rand(2500,5000),5,g);} const g=outNode(pan,vol); env(g,t,0.05,0.25,0.9); nz(t,1,'lowpass',700,0.7,g); },
  beep(pan,vol){ const t=AC.currentTime, g=outNode(pan,vol); env(g,t,0.003,0.06,0.08); osc(t,0.1,'square',2100,2100,g); },
  heart(vol){ const t=AC.currentTime; for(const dt of [0,0.22]){ const g=outNode(0,vol); env(g,t+dt,0.01,dt?0.25:0.4,0.14); osc(t+dt,0.16,'sine',62,40,g);} },
  kick(pan,vol){ const t=AC.currentTime, g=outNode(pan,vol); env(g,t,0.002,0.7,0.25); nz(t,0.3,'lowpass',420,1,g); const g2=AC.createGain(); g2.connect(g); osc(t,0.2,'triangle',120,45,g2); },
  crackle(pan,vol){ const t=AC.currentTime, g=outNode(pan,vol); env(g,t,0.001,0.06,0.03); nz(t,0.05,'highpass',rand(1500,4000),1,g); },
};
const AMB_DAY=[['birds',5],['crow',3],['dog',2],['clang',2],['drip',2],['alarm',1],['glass',1],['farShot',0.6],['siren',0.3]];
const AMB_NIGHT=[['dog',2],['clang',2.5],['drip',2],['farMoans',3],['farShot',1.4],['glass',1.2],['alarm',0.6],['rotor',0.25]];
function pickAmb(list){ let tot=0; for(const [,w] of list) tot+=w; let r=Math.random()*tot; for(const [n,w] of list){ r-=w; if(r<=0) return n; } return list[0][0]; }
function updateAmbience(dt,p){
  if(!AC) return; const t=AC.currentTime;
  const night=G.phase==='night'||G.phase==='dusk';
  // gusts drive wind, whistle and blowing trash
  G.gustT-=dt; if(G.gustT<=0){ G.gustT=rand(3,9); G.gustTarget=Math.random()<.3?rand(.6,1):rand(0,.35); }
  G.gust=lerp(G.gust,G.gustTarget,Math.min(1,dt*0.6));
  amb.wind.g.gain.setTargetAtTime(0.045+G.gust*0.09,t,0.4); amb.wind.f.frequency.setTargetAtTime(260+G.gust*380,t,0.4);
  amb.whistle.g.gain.setTargetAtTime(Math.max(0,G.gust-0.55)*0.035,t,0.6); amb.whistle.f.frequency.setTargetAtTime(700+G.gust*700,t,0.8);
  amb.rumble.g.gain.setTargetAtTime(night?0.05:0.075,t,2);
  // generator hum + barrel fire near the line
  const dl=Math.hypot(p.x-LIGHT_WORK.x,p.z-LIGHT_WORK.z), db=Math.hypot(p.x-LIGHT_BARREL.x,p.z-LIGHT_BARREL.z);
  amb.hum.g.gain.setTargetAtTime(G.lightsOn?0.028/(1+dl*0.25):0,t,0.15);
  if(G.lightsOn&&db<18&&Math.random()<dt*7) SFX.crackle(clamp((LIGHT_BARREL.x-p.x)/14,-1,1),0.9/(1+db*0.35));
  // the horde as a sound: a murmur that swells with how many are near
  let nearZ=0; if(G.phase==='night') eachNear(p.x,p.z,40,j=>{ if(zst[j]) nearZ++; });
  amb.murmur.g.gain.setTargetAtTime(Math.min(0.09,nearZ*0.0011),t,0.8);
  if(nearZ>0&&Math.random()<dt*Math.min(1.2,nearZ*0.02)){ // a random one groans
    let pick=-1, c=0; eachNear(p.x,p.z,40,j=>{ if(zst[j]&&Math.random()<1/(++c)) pick=j; });
    if(pick>=0){ const d=Math.hypot(zx[pick]-p.x,zz[pick]-p.z); if(d>3) SFX.farMoans(clamp((zx[pick]-p.x)/25,-1,1)); }
  }
  // distant one-shots
  amb.next-=dt;
  if(amb.next<=0){
    amb.next=rand(night?5:4,night?14:11);
    const n=pickAmb(night?AMB_NIGHT:AMB_DAY);
    const pan=rand(-0.9,0.9);
    if(n==='rotor'&&Math.random()<.5){} else { SFX[n](pan); const CAP={dog:'dogs barking',alarm:'car alarm',farShot:'distant gunfire',glass:'glass breaking far off',siren:'a siren, far off',rotor:'rotors?',farMoans:'moaning in the fog',clang:'metal clanging'}; if(CAP[n]&&typeof caption==='function') caption(CAP[n]+(pan<-0.3?' · west':pan>0.3?' · east':'')); }
  }
}

function sThud(vol=0.4){
  if(!AC) return; const t=AC.currentTime;
  const o=AC.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(50,t+0.12);
  const g=AC.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+0.16);
}

/* ---------- mix: master, music and effects volumes (set from the settings menu) ---------- */
const VOL={master:0.8,music:0.6,sfx:1};
function applyVolumes(){ if(!AC) return; master.gain.setTargetAtTime(0.55*VOL.master*VOL.sfx,AC.currentTime,0.1); if(MUS.g) MUS.g.gain.setTargetAtTime(0.9*VOL.music*VOL.master,AC.currentTime,0.3); }

/* ---------- where a sound comes from: pan, falloff, and walls in the way ---------- */
function sndAt(x,z,L,range){
  const p=squad[me], dx=x-p.x, dz=z-p.z, d=Math.hypot(dx,dz);
  const occ=(L!==undefined&&(L!==p.L||!los(p.L,p.x,p.z,x,z)))?1:0;
  return {pan:clamp(dx/22,-1,1),vol:Math.max(0,1-d/(range||45))/(1+d*0.04),occ,d};
}
// an output that pans and, if a wall is in the way, muffles
function outAt(S,vol){
  const o=outNode(S.pan,vol*S.vol);
  if(!S.occ) return o;
  const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=650; f.connect(o); return f;
}

/* ---------- footsteps: what you're walking on ---------- */
const STEP_SND={
  [SURF.ASPHALT]:['bandpass',1300,1.2,0.05,0.045],[SURF.CONCRETE]:['bandpass',1600,1.4,0.05,0.045],[SURF.ALLEY]:['bandpass',1100,1,0.06,0.05],
  [SURF.GRASS]:['lowpass',650,0.7,0.08,0.035],[SURF.DIRT]:['lowpass',500,0.7,0.07,0.04],[SURF.GRAVEL]:['bandpass',2600,0.8,0.09,0.05],
  [SURF.WOOD]:['lowpass',420,1.2,0.06,0.06],[SURF.TILE]:['bandpass',3000,2,0.03,0.04],[SURF.CARPET]:['lowpass',300,0.7,0.05,0.02],
  [SURF.METAL]:['bandpass',900,6,0.08,0.05],[SURF.ROOF]:['bandpass',1200,1.2,0.05,0.04],
};
function stepSound(s,vol){
  if(!AC) return;
  const cx=Math.floor(s.x), cz=Math.floor(s.z); if(!inMap(cx,cz)) return;
  let surf=MAP.surf[Math.min(s.L,NL-1)][CI(cx,cz)];
  const snowy=WX.snow>0.35&&!indoors(s.L,s.x,s.z);
  const P=snowy?['lowpass',900,0.6,0.1,0.05]:(STEP_SND[surf]||STEP_SND[SURF.CONCRETE]);
  const S=sndAt(s.x,s.z,s.L,25); if(S.vol<=0.01) return;
  const t=AC.currentTime, g=outAt(S,vol*P[4]*(s.sneak?0.35:s.sprint?1.5:1));
  const gg=AC.createGain(); gg.connect(g); env(gg,t,0.002,1,P[3]); nz(t,P[3]+0.03,P[0],P[1]*rand(.85,1.15),P[2],gg);
  if(surf===SURF.WOOD&&!snowy){ const g2=AC.createGain(); g2.connect(g); env(g2,t,0.002,0.6,0.07); osc(t,0.08,'sine',rand(95,130),70,g2); }
}

/* ---------- the dead: more than one kind of noise ---------- */
function zSound(i,kind){
  if(!AC) return;
  const S=sndAt(zx[i],zz[i],zl[i],40); if(S.vol<=0.01) return;
  const t=AC.currentTime, o=outAt(S,1);
  const pitch=(zbody[i]===1?0.75:zbody[i]===2?1.2:1)*rand(.85,1.15);
  if(kind==='moan'){ const f=AC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=rand(300,700); f.Q.value=2; f.connect(o);
    const g=AC.createGain(); g.connect(f); env(g,t,0.25,0.22,1.3); osc(t,1.6,'sawtooth',rand(80,115)*pitch,rand(55,75)*pitch,g);
    const g2=AC.createGain(); g2.connect(o); env(g2,t+0.1,0.2,0.04,1); nz(t+0.1,1.2,'bandpass',rand(500,900),3,g2); }
  else if(kind==='shriek'){ const g=AC.createGain(); g.connect(o); env(g,t,0.05,0.18,0.6); osc(t,0.7,'sawtooth',rand(260,340)*pitch,rand(150,190)*pitch,g);
    const g2=AC.createGain(); g2.connect(o); env(g2,t,0.03,0.08,0.5); nz(t,0.6,'bandpass',1800,4,g2); }
  else if(kind==='hurt'){ const g=AC.createGain(); g.connect(o); env(g,t,0.01,0.12,0.25); osc(t,0.3,'square',rand(140,190)*pitch,90*pitch,g); }
  else if(kind==='gurgle'){ for(let k=0;k<5;k++){ const g=AC.createGain(); g.connect(o); env(g,t+k*0.07,0.005,0.05,0.06); osc(t+k*0.07,0.07,'sine',rand(180,320)*pitch,rand(90,140),g); } }
  else if(kind==='feed'){ const g=AC.createGain(); g.connect(o); env(g,t,0.01,0.09,0.18); nz(t,0.2,'lowpass',700,1,g); const g2=AC.createGain(); g2.connect(o); env(g2,t+0.08,0.01,0.05,0.12); osc(t+0.08,0.14,'sine',rand(120,200),70,g2); }
}

/* ---------- the radio, and the noise in your own head ---------- */
SFX.static=function(vol){ const t=AC.currentTime, g=outNode(0,vol); env(g,t,0.01,1,0.35); nz(t,0.4,'bandpass',rand(1800,2600),0.8,g); const g2=outNode(0,vol*0.5); env(g2,t+0.3,0.005,1,0.05); nz(t+0.3,0.06,'highpass',3000,1,g2); };
let ringT=0;
function stressAudio(dt,p){
  if(!AC) return;
  if(!amb.ring){ const o=AC.createOscillator(); o.type='sine'; o.frequency.value=5600; const g=AC.createGain(); g.gain.value=0; o.connect(g); g.connect(master); o.start(); amb.ring={g}; }
  const k=p.alive?clamp((p.stress-60)/40,0,1):0;
  amb.ring.g.gain.setTargetAtTime(k*0.006,AC.currentTime,0.6);
}

/* ---------- music: dark ambient drones that lean in when it gets bad ---------- */
const MUS={g:null,voices:[],pulse:null,cluster:null,chord:0,t:0,threat:0};
const CHORDS=[[73.42,110,174.6],[65.41,98,155.6],[58.27,87.31,138.6],[69.3,103.8,164.8]];
function musicInit(){
  if(!AC||MUS.g) return;
  MUS.g=AC.createGain(); MUS.g.gain.value=0.9*VOL.music*VOL.master; MUS.g.connect(AC.destination);
  const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=700; lp.Q.value=0.5; lp.connect(MUS.g); MUS.lp=lp;
  const lfo=AC.createOscillator(); lfo.frequency.value=0.05; const lg=AC.createGain(); lg.gain.value=260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  for(let k=0;k<3;k++) for(const det of [-4,5]){
    const o=AC.createOscillator(); o.type=k===0?'sine':'triangle'; o.frequency.value=CHORDS[0][k]; o.detune.value=det;
    const g=AC.createGain(); g.gain.value=k===0?0.022:0.012; o.connect(g); g.connect(lp); o.start(); MUS.voices.push({o,k}); }
  // threat: a slow sub pulse and a faint dissonant cluster up high
  const sub=AC.createOscillator(); sub.type='sine'; sub.frequency.value=41.2; const sg=AC.createGain(); sg.gain.value=0;
  const am=AC.createOscillator(); am.frequency.value=0.9; const amg=AC.createGain(); amg.gain.value=0.5; am.connect(amg); amg.connect(sg.gain); am.start();
  sub.connect(sg); sg.connect(MUS.g); sub.start(); MUS.pulse=sg;
  const cg=AC.createGain(); cg.gain.value=0; cg.connect(MUS.g); MUS.cluster=cg;
  for(const f of [622,659,698]){ const o=AC.createOscillator(); o.type='sine'; o.frequency.value=f; const g=AC.createGain(); g.gain.value=0.004; o.connect(g); g.connect(cg); o.start(); }
}
function updateMusic(dt){
  if(!AC) return; if(!MUS.g) musicInit();
  MUS.t-=dt; if(MUS.t<=0){ MUS.t=rand(18,32); MUS.chord=(MUS.chord+1+(Math.random()*2|0))%CHORDS.length;
    for(const v of MUS.voices) v.o.frequency.setTargetAtTime(CHORDS[MUS.chord][v.k],AC.currentTime,3); }
  let chasing=0; for(let i=0;i<MAXZ;i++) if(zst[i]===3) chasing++;
  const night=G.phase==='night'||G.phase==='dusk';
  const want=clamp(chasing/18,0,1)*0.8+(night?0.2:0);
  MUS.threat=lerp(MUS.threat,want,Math.min(1,dt*0.5));
  MUS.pulse.gain.setTargetAtTime(MUS.threat*0.05,AC.currentTime,1);
  MUS.cluster.gain.setTargetAtTime(Math.max(0,MUS.threat-0.4)*1.2,AC.currentTime,1.5);
  MUS.lp.frequency.setTargetAtTime(500+MUS.threat*700,AC.currentTime,2);
}

/* ---------- the radio, once there's power: something old and warm on quiet nights ---------- */
const RM={t:0,step:0,on:0};
const RM_PROG=[[220,261.6,329.6],[196,246.9,293.7],[174.6,220,261.6],[196,246.9,329.6]];
function radioMusic(dt,on){
  if(!AC) return;
  RM.on=lerp(RM.on,on?1:0,Math.min(1,dt*0.8)); if(RM.on<0.03) return;
  RM.t-=dt; if(RM.t>0) return; RM.t=0.42;
  const t=AC.currentTime, chord=RM_PROG[Math.floor(RM.step/8)%RM_PROG.length], k=RM.step%8, v=0.03*RM.on*VOL.music;
  const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1400; lp.connect(master);
  const note=(f,when,dur,vol,type)=>{ const g=AC.createGain(); g.connect(lp); env(g,when,0.01,vol,dur); osc(when,dur+0.1,type||'triangle',f,f*0.999,g); };
  note(chord[[0,1,2,1,0,2,1,2][k]]*2,t,0.35,v);
  if(k===0||k===4) note(chord[0]/2,t,0.8,v*1.6,'sine');
  if(k%2===1&&Math.random()<.5) note(chord[2]*2*1.5,t+0.21,0.18,v*0.5);
  if(Math.random()<0.3){ const g=AC.createGain(); g.connect(lp); env(g,t,0.001,v*0.4,0.03); nz(t,0.04,'highpass',3000,1,g); }
  RM.step++;
}
