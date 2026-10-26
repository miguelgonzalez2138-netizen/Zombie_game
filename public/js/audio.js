'use strict';
// Fog Line — Ambient soundscape and sound effects (all synthesized, no audio files).
// Classic script: shares globals with the other files, load order matters (see index.html).

/* ---------- audio ---------- */
let AC=null, master=null, noiseBuf=null;
function initAudio(){
  if(AC) return;
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    master=AC.createGain(); master.gain.value=0.55; master.connect(AC.destination);
    noiseBuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const bed=(type,freq,q,vol)=>{ const n=AC.createBufferSource(); n.buffer=noiseBuf; n.loop=true; n.playbackRate.value=rand(.9,1.1);
      const f=AC.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q; const g=AC.createGain(); g.gain.value=vol;
      n.connect(f); f.connect(g); g.connect(master); n.start(); return {g,f}; };
    amb.wind=bed('lowpass',340,0.7,0.06);
    amb.whistle=bed('bandpass',900,9,0.0);
    amb.rumble=bed('lowpass',75,0.7,0.07);
    amb.murmur=bed('bandpass',230,1.4,0.0);
    const hum=AC.createOscillator(); hum.type='sawtooth'; hum.frequency.value=60;
    const hf=AC.createBiquadFilter(); hf.type='lowpass'; hf.frequency.value=170; const hg=AC.createGain(); hg.gain.value=0;
    hum.connect(hf); hf.connect(hg); hg.connect(master); hum.start(); amb.hum={g:hg};
  }catch(e){AC=null;}
}
function sGun(dist){
  if(!AC) return; const t=AC.currentTime, att=1/(1+dist*0.06);
  const s=AC.createBufferSource(); s.buffer=noiseBuf; s.playbackRate.value=rand(.8,1.1);
  const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(rand(2600,3600)*att+400,t); f.frequency.exponentialRampToValueAtTime(260,t+0.22);
  const g=AC.createGain(); g.gain.setValueAtTime(0.9*att,t); g.gain.exponentialRampToValueAtTime(0.0008,t+0.32);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t+0.35);
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
    if(n==='rotor'&&Math.random()<.5){} else SFX[n](rand(-0.9,0.9));
  }
}

function sThud(vol=0.4){
  if(!AC) return; const t=AC.currentTime;
  const o=AC.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(50,t+0.12);
  const g=AC.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+0.16);
}
