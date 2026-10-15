import {ambience} from './audio';
import {player} from '../shared/movement';
import {smooth} from '../shared/vision';
import {entity,smilers} from '../shared/entity';
import {W,H,passable,center} from '../shared/navigation';
import {spawn} from '../shared/world';
import type {Renderer} from './render';
/* NEW RUN's arrival and departure (lineage B12, owners G.I.B. and FRONT; B37, B38 in main.ts).
 *   fall    a wanderer who starts a run falls into the level at a safe point: over 1.35 s it drops from above (bigger, turning), lands
 *           at 62% with a thud, a shake (fallShake) and two dust rings, and settles;
 *   vanish  a wanderer who leaves for a new run fades out where it stood, its light left on the floor (main.ts starts and ends it).
 * The state is this module's; main.ts starts and clears it, the renderer draws it each frame (drawArrival). */
export type Fall={t0:number;dur:number;hit:number;w:number};
export type Vanish={t0:number;dur:number};
export const arrival:{fall:Fall|null;vanish:Vanish|null}={fall:null,vanish:null};
/* where a wanderer arrives: a random floor cell at least 1,500 px from every Hound and 900 px from every active Smiler (400 tries;
   then the level's spawn). Starts the fall. */
export function safeRespawn(){
 const hunters=[entity,...(window.__hounds||[]).filter(Boolean) as {x:number;y:number}[]];
 for(let n=0;n<400;n++){
  const id=Math.floor(Math.random()*W*H);
  if(!passable[id])continue;
  const p=center(id);
  if(hunters.some(b=>Math.hypot(b.x-p.x,b.y-p.y)<1500)||smilers.some(b=>!b.off&&Math.hypot(b.x-p.x,b.y-p.y)<900))continue;
  arrival.fall={t0:performance.now()/1e3,dur:1.35,hit:0,w:0};
  return p;
 }
 arrival.fall={t0:performance.now()/1e3,dur:1.35,hit:0,w:0};
 return {...spawn};
}
/* the camera's shake after a fall's landing, along x (axis 0) or y (axis 1) */
export function fallShake(time:number,axis:number){return arrival.fall&&arrival.fall.hit?Math.sin(time*(axis?77:91))*Math.exp(-(time-arrival.fall.hit)*7)*(axis?5:8):0;}
/* a burst of noise that fades out, through a swept filter: from sweep[0] to sweep[1] Hz over the burst's seconds, starting at seconds
   from now */
function noiseBurst(sweep:[number,number],type:BiquadFilterType,q:number,gain:number,seconds:number,at?:number){
 try{
  const ctx=ambience.context,out=ambience.gain;
  if(!ctx||!out)return;
  const start=ctx.currentTime+(at||0),length=Math.max(64,ctx.sampleRate*seconds|0),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),level=ctx.createGain();
  source.buffer=buffer;filter.type=type;filter.frequency.setValueAtTime(sweep[0],start);filter.frequency.exponentialRampToValueAtTime(sweep[1],start+seconds);filter.Q.value=q;level.gain.value=gain;
  source.connect(filter);filter.connect(level);level.connect(out);source.start(start);
 }catch{}
}
/* the landing: a falling sine thud and a low rumble */
function landingThud(){
 try{
  const ctx=ambience.context,out=ambience.gain;
  if(!ctx||!out)return;
  const t=ctx.currentTime,osc=ctx.createOscillator(),level=ctx.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(125,t);osc.frequency.exponentialRampToValueAtTime(36,t+.3);
  level.gain.setValueAtTime(1e-4,t);level.gain.exponentialRampToValueAtTime(.55,t+.012);level.gain.exponentialRampToValueAtTime(1e-4,t+.36);
  osc.connect(level);level.connect(out);osc.start(t);osc.stop(t+.4);noiseBurst([700,140],'lowpass',.7,.35,.22);
 }catch{}
}
/* the wanderer's view during a vanish and a fall, each frame after the view's own update. The page may hide the wanderer altogether
   (window.__hideSelf: after a vanish). */
export function drawArrival(view:Renderer,time:number){
 const hidden=window.__hideSelf,person=view.person;
 person.visible=!hidden;
 if(hidden)return;
 if(arrival.vanish){
  // fades out over the vanish (flickering in its middle) and trembles; the light is gone, the hat stays
  const v=Math.min(1,(time-arrival.vanish.t0)/arrival.vanish.dur),fade=smooth(.22,.95,v),flicker=Math.sin(time*47)>.55&&v>.35&&v<.9?.35:0;
  person.alpha=Math.max(0,1-fade-flicker*(1-fade));person.scale.set(1-.06*fade,1-.06*fade);person.x+=Math.sin(time*61)*(1-fade)*fade*4;person.gear.visible=false;person.hat.alpha=1;
 }
 const ground=view.death.foreground;
 if(arrival.fall&&!view.death.active){
  const p=Math.min(1,(time-arrival.fall.t0)/arrival.fall.dur),landing=.62;
  // the whoosh of the fall, once
  if(!arrival.fall.w){arrival.fall.w=1;noiseBurst([250,1400],'bandpass',.8,.07,.8);}
  const t=Math.min(1,p/landing),h=smooth(0,1,t);
  // the landing, once: the thud (and from now on the shake)
  if(p>=landing&&!arrival.fall.hit){arrival.fall.hit=time;landingThud();}
  if(p<landing){
   // still falling: larger the higher it is, turning, appearing over the first .22 of the fall
   const z=1+(1-h)*(1-h)*1.25;
   person.scale.set(z,z);person.alpha=Math.min(1,p/.22);person.rotation+=(1-h)*1.7;
  }else{
   // landed: a damped squash and stretch
   const u=(p-landing)/(1-landing),b=Math.exp(-u*5)*Math.sin(u*22);
   person.scale.set(1+.11*b,1-.11*b);
  }
  // its shadow grows as it falls; at the landing, two dust rings spread
  ground.clear();ground.ellipse(player.x,player.y+7,28*(.35+.65*h),16*(.35+.65*h)).fill({color:0x000000,alpha:.4*(p<landing?h:1-smooth(landing,1,p)*.6)});
  if(p>=landing){
   const u=(p-landing)/(1-landing);
   ground.circle(player.x,player.y+4,20+u*95).stroke({color:0xb9ac7a,width:5*(1-u),alpha:.32*(1-u)});
   ground.circle(player.x,player.y+4,12+u*60).stroke({color:0xb9ac7a,width:3*(1-u),alpha:.22*(1-u)});
  }
  ground.alpha=1;
  if(p>=1){arrival.fall=null;ground.clear();}
 }
}
