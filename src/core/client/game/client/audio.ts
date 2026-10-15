import {captureHits,type CaptureKind} from './death';
/* (lineage B34, owners SPACIOUS-AUDIO and G.I.B.) how one listener hears a death: the hits' times, a level, a low-pass and a pan (the
   death-only sound for the victim and for spectators) */
export type DeathHearing={hits?:number[];gain?:number|null;lp?:number;pan?:number};
/* (B07) the shapes of the capture sound's parts: a noise burst (its filter type, sweep f0 -> f1, Q, gain g, attack att, flutter fl,
   crackle, pan) and a tone (low-pass lp, attack att, vibrato vib of depth vd, pan) */
type NoiseShape={type?:BiquadFilterType;f0:number;f1?:number;q?:number;g:number;att?:number;fl?:number;crackle?:number;pan?:number};
type ToneShape={lp?:number;att?:number;vib?:number;vd?:number;pan?:number};
export class Ambience{
 whineGain:GainNode|null=null;breathGain:GainNode|null=null;breathPan:StereoPannerNode|null=null;droneGain:GainNode|null=null;context:AudioContext|null=null; gain:GainNode|null=null;muted=false;lastStep=0;stepIndex=0;
 /* (B07) the level follows the page's volume (window.__vol); (B02) without v11's three hum oscillators */
 start(){if(this.context){void this.context.resume();return;}const a=this.context=new AudioContext();this.gain=a.createGain();this.gain.gain.value=this.muted?0:.14*(window.__vol??1);this.gain.connect(a.destination);const breath=a.createOscillator();breath.type='sawtooth';breath.frequency.value=37;const filter=a.createBiquadFilter();filter.type='lowpass';filter.frequency.value=155;this.breathGain=a.createGain();this.breathGain.gain.value=0;this.breathPan=a.createStereoPanner();breath.connect(filter);filter.connect(this.breathGain);this.breathGain.connect(this.breathPan);this.breathPan.connect(this.gain);breath.start();const drone=a.createOscillator();drone.frequency.value=47;this.droneGain=a.createGain();this.droneGain.gain.value=0;drone.connect(this.droneGain);this.droneGain.connect(this.gain);drone.start();const whine=a.createOscillator(),wf=a.createBiquadFilter();whine.type='triangle';whine.frequency.value=740;wf.type='bandpass';wf.frequency.value=850;this.whineGain=a.createGain();this.whineGain.gain.value=0;whine.connect(wf);wf.connect(this.whineGain);this.whineGain.connect(this.gain);whine.start();}
 threat(dx:number,dy:number,chasing:boolean,active:boolean,kind:'hound'|'smiler'='hound'){if(!this.context||!this.breathGain||!this.breathPan||!this.droneGain||!this.whineGain)return;const t=this.context.currentTime,d=Math.hypot(dx,dy),proximity=Math.max(0,1-d/700);this.breathGain.gain.setTargetAtTime(active&&kind==='hound'?proximity*(.15+.12*Math.sin(t*3)):0,t,.15);this.whineGain.gain.setTargetAtTime(active&&kind==='smiler'?proximity*(.06+.018*Math.sin(t*9)):0,t,.14);this.breathPan.pan.setTargetAtTime(Math.max(-1,Math.min(1,dx/500)),t,.1);this.droneGain.gain.setTargetAtTime(active&&chasing?.1+.05*Math.sin(t*9):0,t,.5);}
 toggle(){this.muted=!this.muted;if(this.gain)this.gain.gain.setTargetAtTime(this.muted?0:.14*(window.__vol??1),this.context!.currentTime,.1);return this.muted;}
 /* (B02, owner SPACIOUS-AUDIO) the cadence: a step every 78 to 88 px (walking to sprinting), heard from 28 px/s; a shorter, darker,
    panned step and a smaller thud; (B08) sfx.js plays its own step when it can */
 footstep(distance:number,speed:number,surface:'carpet'|'wet'|'hollow'='carpet'){
  if(!this.context||!this.gain)return;
  // a respawn starts the distance again
  if(distance<this.lastStep)this.lastStep=distance;
  if(speed<28)return;
  const run=Math.min(1,Math.max(0,(speed-150)/145)),stride=78+run*10;
  if(distance-this.lastStep<stride)return;
  this.lastStep=distance;this.stepIndex++;
  if(window.__sfx&&window.__sfx.play('step',{rate:.93+Math.random()*.14,vol:.55+run*.45,pan:this.stepIndex%2?-.08:.08}))return;
  const a=this.context,t=a.currentTime,alternate=this.stepIndex%2?1:.91;
  const n=Math.floor(a.sampleRate*.12),buffer=a.createBuffer(1,n,a.sampleRate),data=buffer.getChannelData(0);
  let low=0;for(let i=0;i<n;i++){
   const seconds=i/a.sampleRate,noise=Math.random()*2-1;
   low=low*.86+noise*.14;
   const soft=Math.exp(-seconds/(surface==='wet'?.065:surface==='hollow'?.038:.022));
   const drag=Math.exp(-Math.max(0,seconds-.018)/.03)*(seconds>.018?1:0);
   data[i]=(low*.88+noise*.12)*soft+noise*drag*(surface==='wet'?.085:.025);
  }
  const source=a.createBufferSource(),filter=a.createBiquadFilter(),pan=a.createStereoPanner(),g=a.createGain();
  source.buffer=buffer;filter.type='lowpass';filter.frequency.value=(surface==='wet'?690:surface==='hollow'?1050:410)*(1+run*.22)*(.94+Math.random()*.12);pan.pan.value=this.stepIndex%2?-.08:.08;
  g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime((surface==='wet'?.31:surface==='hollow'?.25:.2)*alternate*(1+run*.38),t+.006);
  g.gain.exponentialRampToValueAtTime(.001,t+.11);source.connect(filter);filter.connect(pan);pan.connect(g);g.connect(this.gain);source.start(t);
  source.onended=()=>{source.disconnect();filter.disconnect();pan.disconnect();g.disconnect();};
  const thud=a.createOscillator(),pg=a.createGain();thud.type='sine';
  thud.frequency.setValueAtTime(surface==='hollow'?112:surface==='wet'?82:64,t);
  thud.frequency.exponentialRampToValueAtTime(surface==='hollow'?55:39,t+.06);
  pg.gain.setValueAtTime(.001,t);pg.gain.linearRampToValueAtTime((surface==='hollow'?.085:.043)*(1+run*.52)*alternate,t+.005);
  pg.gain.exponentialRampToValueAtTime(.001,t+.072);thud.connect(pg);pg.connect(this.gain);thud.start(t);thud.stop(t+.075);
  thud.onended=()=>{thud.disconnect();pg.disconnect();};
 }
 /* (B07, owners SPACIOUS-AUDIO and G.I.B.) the capture, synthesised through one compressor: at every hit an air swipe, then claws
    raking (the Hound) or a stab (a Smiler), a wet squelch with a body thud, and the victim's gasp or grunt; after the last hit, the
    final wound and the ringing ears, and the monster's tail. (B08) sfx.js plays its own when it can. (B34) Each listener hears it at
    their own hits' times (else the death lab's, window.__dsndHits, else captureHits), level, low-pass and pan. */
 death(kind:CaptureKind,hearing?:DeathHearing){
  if(!this.context||!this.gain)return;
  if(window.__sfx&&window.__sfx.death(kind,hearing))return;
  const ctx=this.context,now=ctx.currentTime,hound=kind==='Hound',hits=hearing&&hearing.hits||window.__dsndHits&&window.__dsndHits(kind)||captureHits[kind],bus=ctx.createDynamicsCompressor();
  bus.threshold.value=-14;bus.ratio.value=5;
  const level=ctx.createGain(),muffle=ctx.createBiquadFilter(),side=ctx.createStereoPanner();
  level.gain.value=hearing&&hearing.gain!=null?hearing.gain:1;muffle.type='lowpass';muffle.frequency.value=hearing&&hearing.lp||20000;side.pan.value=hearing&&hearing.pan||0;
  bus.connect(level);level.connect(muffle);muffle.connect(side);side.connect(this.gain);
  setTimeout(()=>{try{bus.disconnect();level.disconnect();muffle.disconnect();side.disconnect();}catch{}},6500);
  const rand=(a:number,b:number)=>a+Math.random()*(b-a),done=(src:AudioScheduledSourceNode,...nodes:AudioNode[])=>{src.onended=()=>{try{src.disconnect();nodes.forEach(x=>x.disconnect());}catch{}};};
  /* filtered noise burst: sweep f0->f1, optional amplitude flutter (tearing), pan */
  const noise=(at:number,d:number,o:NoiseShape)=>{
   const size=Math.ceil(ctx.sampleRate*d),buffer=ctx.createBuffer(1,size,ctx.sampleRate),data=buffer.getChannelData(0),flutter=o.fl||0;
   let low=0;
   for(let i=0;i<size;i++){
    const x=i/ctx.sampleRate,w=Math.random()*2-1;
    low=low*.6+w*.4;
    const m=flutter?(.25+.75*Math.abs(Math.sin(Math.PI*flutter*x+i*0))*(.6+.4*Math.random())):1;
    data[i]=(o.crackle?(Math.random()<.02?w*3:low*.15):w)*m;
   }
   const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain(),p=ctx.createStereoPanner();
   source.buffer=buffer;filter.type=o.type||'bandpass';filter.Q.value=o.q||1;filter.frequency.setValueAtTime(o.f0,now+at);filter.frequency.exponentialRampToValueAtTime(o.f1||o.f0,now+at+d);
   const attack=o.att||.004;
   g.gain.setValueAtTime(.0001,now+at);g.gain.linearRampToValueAtTime(o.g,now+at+attack);g.gain.exponentialRampToValueAtTime(.0001,now+at+d);
   p.pan.value=o.pan||0;
   source.connect(filter);filter.connect(g);g.connect(p);p.connect(bus);source.start(now+at);done(source,filter,g,p);
  };
  const tone=(at:number,d:number,type:OscillatorType,f0:number,f1:number,gain:number,o:ToneShape={})=>{
   const osc=ctx.createOscillator(),g=ctx.createGain(),p=ctx.createStereoPanner(),lp=ctx.createBiquadFilter();
   osc.type=type;osc.frequency.setValueAtTime(f0,now+at);osc.frequency.exponentialRampToValueAtTime(f1,now+at+d);
   lp.type='lowpass';lp.frequency.value=o.lp||4000;
   g.gain.setValueAtTime(.0001,now+at);g.gain.linearRampToValueAtTime(gain,now+at+(o.att||.006));g.gain.exponentialRampToValueAtTime(.0001,now+at+d);
   p.pan.value=o.pan||0;
   if(o.vib){const v=ctx.createOscillator(),vg=ctx.createGain();v.frequency.value=o.vib;vg.gain.value=o.vd||10;v.connect(vg);vg.connect(osc.frequency);v.start(now+at);v.stop(now+at+d+.02);}
   osc.connect(lp);lp.connect(g);g.connect(p);p.connect(bus);osc.start(now+at);osc.stop(now+at+d+.03);done(osc,lp,g,p);
  };
  /* voice: pained gasp/cry through two vowel formants */
  const voice=(at:number,d:number,f0:number,f1:number,gain:number,formant1:number,formant2:number,pan:number)=>{
   const osc=ctx.createOscillator(),a=ctx.createBiquadFilter(),b=ctx.createBiquadFilter(),g=ctx.createGain(),p=ctx.createStereoPanner(),jitter=ctx.createOscillator(),jg=ctx.createGain();
   osc.type='sawtooth';osc.frequency.setValueAtTime(f0,now+at);osc.frequency.exponentialRampToValueAtTime(f1,now+at+d);
   jitter.frequency.value=rand(38,52);jg.gain.value=f0*.05;jitter.connect(jg);jg.connect(osc.frequency);jitter.start(now+at);jitter.stop(now+at+d+.02);
   a.type=b.type='bandpass';a.frequency.value=formant1;b.frequency.value=formant2;a.Q.value=b.Q.value=5;
   g.gain.setValueAtTime(.0001,now+at);g.gain.linearRampToValueAtTime(gain,now+at+.03);g.gain.setValueAtTime(gain,now+at+d*.55);g.gain.exponentialRampToValueAtTime(.0001,now+at+d);
   p.pan.value=pan||0;
   osc.connect(a);osc.connect(b);a.connect(g);b.connect(g);g.connect(p);p.connect(bus);osc.start(now+at);osc.stop(now+at+d+.03);done(osc,a,b,g,p);
  };
  const last=hits[hits.length-1];
  hits.forEach((at,i)=>{
   const pan=rand(-.5,.5),k=1+i*.12;
   /* air swipe before contact */
   noise(Math.max(0,at-.11),.13,{type:'bandpass',f0:hound?900:1800,f1:hound?4200:6500,q:1.4,g:.32,att:.07,pan});
   if(hound){/* claws: three rapid rake ticks + long tearing gash */
    [0,.028,.058].forEach((o,j)=>noise(at+o,.05,{f0:rand(2600,3400),f1:1400,q:3,g:.55,pan:pan+(j-1)*.15}));
    noise(at+.01,.34,{f0:2800,f1:650,q:.9,g:.95,fl:rand(46,64),att:.01,pan});
    noise(at+.02,.22,{type:'lowpass',f0:1300,f1:300,g:.75,fl:rand(20,30),pan});
   }else{/* stab: sharp puncture, wet plunge, bone crunch */
    noise(at-.005,.05,{f0:4200,f1:1800,q:2.5,g:.8,pan});
    noise(at,.16,{f0:rand(2200,3000),f1:700,q:1.3,g:.7,fl:rand(50,70),pan});
    for(let c=0;c<3;c++)noise(at+.03+c*.045,.05,{type:'lowpass',f0:1800,f1:500,g:.5,crackle:1,pan});
   }
   /* wet squelch + body thud */
   noise(at+.03,.24,{f0:rand(350,500),f1:rand(1000,1400),q:4,g:.5,fl:rand(24,34),pan});
   tone(at,.24,'sine',rand(105,125)/k,36,.95,{pan});
   noise(at,.14,{type:'lowpass',f0:900,f1:250,g:.8,pan});
   /* victim reacts: first hit is a sharp gasp, later hits are ragged grunts */
   if(i===0)voice(at+.03,.34,290,190,.5,760,1250,-pan*.4);
   else voice(at+.04,.22+.05*i,rand(150,190),95,.32,560,1000,-pan*.4);
  });
  /* the final wound: long rip, blood spray, gurgling breath */
  noise(last+.08,.6,{f0:2200,f1:500,q:.8,g:.55,fl:38,att:.03});
  noise(last+.12,.9,{f0:rand(320,420),f1:220,q:5,g:.7,fl:9,att:.05});
  tone(last+.1,1,'triangle',110,55,.28,{vib:7,vd:14,lp:500});
  for(let d=0;d<7;d++)tone(last+.7+d*rand(.18,.3)+d*.05,.07,'sine',rand(700,1100),rand(280,420),.13,{att:.002,pan:rand(-.7,.7)});
  /* ringing ears + monster tail */
  tone(last+.15,3,'sine',3900,3900,.05,{att:.4});
  const growl=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  growl.type=hound?'sawtooth':'triangle';
  growl.frequency.setValueAtTime(hound?78:480,now);growl.frequency.exponentialRampToValueAtTime(hound?29:65,now+2.6);
  filter.type='lowpass';filter.frequency.value=hound?250:950;
  gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(.2,now+.2);gain.gain.exponentialRampToValueAtTime(.001,now+2.8);
  growl.connect(filter);filter.connect(gain);gain.connect(bus);growl.start(now);growl.stop(now+2.85);done(growl,filter,gain);
 }
 /* (B08) sfx.js plays its own pick-up sound when it can */
 collect(){if(!this.context||!this.gain)return;if(window.__sfx&&window.__sfx.play('collect'))return;const a=this.context,t=a.currentTime,o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.setValueAtTime(350,t);o.frequency.exponentialRampToValueAtTime(690,t+.2);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.12,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(this.gain);o.start(t);o.stop(t+.31);o.onended=()=>{o.disconnect();g.disconnect();};}
}
/* the page's one ambience (v11 made it in main.ts; the fall's sounds use it too: arrival.ts) */
export const ambience=new Ambience();
