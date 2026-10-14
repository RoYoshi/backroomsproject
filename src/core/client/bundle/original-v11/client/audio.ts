import {captureHits} from './death';
export class Ambience{
 whineGain:GainNode|null=null;breathGain:GainNode|null=null;breathPan:StereoPannerNode|null=null;droneGain:GainNode|null=null;context:AudioContext|null=null; gain:GainNode|null=null;muted=false;lastStep=0;stepIndex=0;
 start(){if(this.context){void this.context.resume();return;}const a=this.context=new AudioContext();this.gain=a.createGain();this.gain.gain.value=this.muted?0:.14;this.gain.connect(a.destination);for(const hz of [59.5,120,181]){const o=a.createOscillator(),g=a.createGain();o.frequency.value=hz;g.gain.value=hz===59.5?.15:.035;o.connect(g);g.connect(this.gain);o.start();}const breath=a.createOscillator();breath.type='sawtooth';breath.frequency.value=37;const filter=a.createBiquadFilter();filter.type='lowpass';filter.frequency.value=155;this.breathGain=a.createGain();this.breathGain.gain.value=0;this.breathPan=a.createStereoPanner();breath.connect(filter);filter.connect(this.breathGain);this.breathGain.connect(this.breathPan);this.breathPan.connect(this.gain);breath.start();const drone=a.createOscillator();drone.frequency.value=47;this.droneGain=a.createGain();this.droneGain.gain.value=0;drone.connect(this.droneGain);this.droneGain.connect(this.gain);drone.start();const whine=a.createOscillator(),wf=a.createBiquadFilter();whine.type='triangle';whine.frequency.value=740;wf.type='bandpass';wf.frequency.value=850;this.whineGain=a.createGain();this.whineGain.gain.value=0;whine.connect(wf);wf.connect(this.whineGain);this.whineGain.connect(this.gain);whine.start();}
 threat(dx:number,dy:number,chasing:boolean,active:boolean,kind:'hound'|'smiler'='hound'){if(!this.context||!this.breathGain||!this.breathPan||!this.droneGain||!this.whineGain)return;const t=this.context.currentTime,d=Math.hypot(dx,dy),proximity=Math.max(0,1-d/700);this.breathGain.gain.setTargetAtTime(active&&kind==='hound'?proximity*(.15+.12*Math.sin(t*3)):0,t,.15);this.whineGain.gain.setTargetAtTime(active&&kind==='smiler'?proximity*(.06+.018*Math.sin(t*9)):0,t,.14);this.breathPan.pan.setTargetAtTime(Math.max(-1,Math.min(1,dx/500)),t,.1);this.droneGain.gain.setTargetAtTime(active&&chasing?.1+.05*Math.sin(t*9):0,t,.5);}
 toggle(){this.muted=!this.muted;if(this.gain)this.gain.gain.setTargetAtTime(this.muted?0:.14,this.context!.currentTime,.1);return this.muted;}
 footstep(distance:number,speed:number,surface:'carpet'|'wet'|'hollow'='carpet'){
  if(!this.context||!this.gain||speed<38)return;
  // Step spacing follows distance travelled; stride length grows while sprinting.
  const run=Math.min(1,Math.max(0,(speed-170)/130)),stride=65+run*36;
  if(distance-this.lastStep<stride)return;
  this.lastStep=distance;this.stepIndex++;
  const a=this.context,t=a.currentTime,alternate=this.stepIndex%2?1:.84;
  const n=Math.floor(a.sampleRate*.14),buffer=a.createBuffer(1,n,a.sampleRate),data=buffer.getChannelData(0);
  let low=0;for(let i=0;i<n;i++){
   const seconds=i/a.sampleRate,noise=Math.random()*2-1;
   low=low*.82+noise*.18;
   const soft=Math.exp(-seconds/(surface==='wet'?.07:surface==='hollow'?.043:.025));
   const drag=Math.exp(-Math.max(0,seconds-.024)/.038)*(seconds>.024?1:0);
   data[i]=(low*.84+noise*.16)*soft+noise*drag*(surface==='wet'?.10:.035);
  }
  const source=a.createBufferSource(),filter=a.createBiquadFilter(),g=a.createGain();
  source.buffer=buffer;filter.type='lowpass';filter.frequency.value=(surface==='wet'?720:surface==='hollow'?1150:450)*(1+run*.25)*(0.91+Math.random()*.18);
  g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime((surface==='wet'?.37:surface==='hollow'?.3:.24)*alternate*(1+run*.48),t+.008);
  g.gain.exponentialRampToValueAtTime(.001,t+.13);source.connect(filter);filter.connect(g);g.connect(this.gain);source.start(t);
  source.onended=()=>{source.disconnect();filter.disconnect();g.disconnect();};
  const thud=a.createOscillator(),pg=a.createGain();thud.type='sine';
  thud.frequency.setValueAtTime(surface==='hollow'?125:surface==='wet'?91:70,t);
  thud.frequency.exponentialRampToValueAtTime(surface==='hollow'?58:42,t+.07);
  pg.gain.setValueAtTime(.001,t);pg.gain.linearRampToValueAtTime((surface==='hollow'?.12:.055)*(1+run*.65)*alternate,t+.006);
  pg.gain.exponentialRampToValueAtTime(.001,t+.085);thud.connect(pg);pg.connect(this.gain);thud.start(t);thud.stop(t+.09);
  thud.onended=()=>{thud.disconnect();pg.disconnect();};
 }
 death(kind:'Hound'|'Smiler'){
  if(!this.context||!this.gain)return;const a=this.context,start=a.currentTime;
  const noise=(at:number,duration:number,frequency:number,volume:number,wet=false)=>{
   const size=Math.ceil(a.sampleRate*duration),buffer=a.createBuffer(1,size,a.sampleRate),data=buffer.getChannelData(0);let low=0;
   for(let i=0;i<size;i++){const t=i/a.sampleRate,n=Math.random()*2-1;low=low*.73+n*.27;const teeth=wet?(.5+.5*Math.sin(t*190))**2:1;data[i]=(wet?low*.6+n*.4:n)*teeth*Math.exp(-t/(duration*.34));}
   const source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=frequency;
   gain.gain.setValueAtTime(volume,start+at);gain.gain.exponentialRampToValueAtTime(.001,start+at+duration);
   source.connect(filter);filter.connect(gain);gain.connect(this.gain!);source.start(start+at);
   source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  };
  noise(.01,.24,1700,.65);
  for(const [i,at] of captureHits[kind].entries()){
   noise(at,.2,1650,.92,true);noise(at+.027,.10,3500,.5,true);
   const o=a.createOscillator(),gain=a.createGain();o.type='sine';
   o.frequency.setValueAtTime(105-i*7,start+at);o.frequency.exponentialRampToValueAtTime(31,start+at+.15);
   gain.gain.setValueAtTime(.001,start+at);gain.gain.linearRampToValueAtTime(.62,start+at+.007);gain.gain.exponentialRampToValueAtTime(.001,start+at+.22);
   o.connect(gain);gain.connect(this.gain);o.start(start+at);o.stop(start+at+.23);o.onended=()=>{o.disconnect();gain.disconnect();};
  }
  // The scrape follows the body across the carpet, after the struggle stops.
  for(let i=0;i<6;i++)noise(2.08+i*.16,.26,620,.24);
  const growl=a.createOscillator(),filter=a.createBiquadFilter(),gain=a.createGain();growl.type=kind==='Hound'?'sawtooth':'triangle';
  growl.frequency.setValueAtTime(kind==='Hound'?78:480,start);growl.frequency.exponentialRampToValueAtTime(kind==='Hound'?29:65,start+2.6);
  filter.type='lowpass';filter.frequency.value=kind==='Hound'?250:950;
  gain.gain.setValueAtTime(.001,start);gain.gain.linearRampToValueAtTime(.22,start+.2);gain.gain.exponentialRampToValueAtTime(.001,start+2.8);
  growl.connect(filter);filter.connect(gain);gain.connect(this.gain);growl.start(start);growl.stop(start+2.85);
  growl.onended=()=>{growl.disconnect();filter.disconnect();gain.disconnect();};
 }
 collect(){if(!this.context||!this.gain)return;const a=this.context,t=a.currentTime,o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.setValueAtTime(350,t);o.frequency.exponentialRampToValueAtTime(690,t+.2);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.12,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(this.gain);o.start(t);o.stop(t+.31);o.onended=()=>{o.disconnect();g.disconnect();};}
}
