import {Container,Graphics} from 'pixi.js';
import {clearPoint} from '../shared/navigation';
import {isFloor,TILE} from '../shared/world';
import {smooth} from '../shared/vision';
import {partsFor,type LightEquipment} from '../shared/equipment';
import {drawGear} from './gear-art';
export type CaptureKind='Hound'|'Smiler';
export const captureHits={Hound:[.24,.74,1.2,1.7],Smiler:[.38,.98,1.48]};
type Point={x:number,y:number};
type Burst={x:number,y:number,at:number,seed:number};
/* (lineage B12, owner G.I.B.) whose death a sequence shows: the local wanderer (window.__api.H), another wanderer (a peer's state, with
   its hat and whether it was exhausted: ex), or (B33) the victim the server's kill record names (window.__dvic) */
export type Victim=Point&{angle:number;vx?:number;vy?:number;exhausted?:boolean;stamina?:number;equipment:LightEquipment;hat?:string;ex?:boolean};
/* (B14, owners BR-R and G.I.B.) ents.js's plan for a death (window.__ents.deathPlan): its variant, the wall it uses, its hits, the
   knock-back and drag (their timing kt and dw, their lengths kn and dr), the spin, the squish and the black fade over time */
export type DeathPlan={v:string;wall:unknown;hits:number[]|null;kt:[number,number];dw:[number,number];spin:number;squish:number;black:((t:number)=>number)|null;kn:number;dr:number};
export class DeathSequence{
 blood=new Graphics();foreground=new Graphics();debris=new Container();
 active=false;kind:CaptureKind='Hound';startAt=0;elapsed=0;duration=3.85;attackerIndex=-1;
 source={x:0,y:0};victim={x:0,y:0,angle:0};direction={x:1,y:0};angle=0;knock=0;drag=0;
 body={x:0,y:0,angle:0,scaleX:1,scaleY:1,alpha:1};attacker={x:0,y:0,angle:0};
 impact=0;grip=0;injury=0;shade=0;shake=0;finished=false;corpseId:string|null=null;bursts:Burst[]=[];nextHit=0;
 torch={x:0,y:0,angle:0};
 /* set by start() and reset(), and read and written by the page's death scripts (ents.js, gore.js, dphys.js) through the sequence
    (window.__api.death()): the other wanderer who dies (B12); ents.js's plan (B14): the variant, the wall, the hits, the knock-back
    and drag timing, the spin, the squish, the black fade and how black it is now; the physical death (B15, B18: dphys.js's record,
    the hands, whether the light and the hat are still held, the evidence and the trail; the death lab's record __lab); the dropped
    light and hat (dEq, dHat) */
 declare V:Victim|null;declare variant:string;declare wall:unknown;declare hits:number[]|null;declare kt:[number,number];declare dw:[number,number];
 declare spin:number;declare squish:number;declare blackFn:((t:number)=>number)|null;declare black:number;
 declare ph:{dur:number;cam:{x:number;y:number}}|null;declare hands:{x:number;y:number}[]|null;declare gearHeld:boolean;declare hatOn:boolean;declare evi:number;declare trail:unknown;declare __lab:unknown;
 declare dEq:Graphics|null;declare dHat:Graphics|null;
 private safeDistance(origin:Point,angle:number,length:number){let d=0;for(let i=4;i<=length&&clearPoint(origin.x+Math.cos(angle)*i,origin.y+Math.sin(angle)*i,22);i+=4)d=i;return d;}
 /* kind and source: the attacker; index: which Smiler (-1: the Hound); other: (B12) another wanderer's death; kill: (B14, B33) the
    server's kill record */
 start(kind:CaptureKind,now:number,source:Point,index=-1,other:Victim|null=null,kill:unknown=null){
  const dying=other||window.__dvic&&window.__dvic(kill)||window.__api.H;
  this.reset();this.V=other;this.active=true;this.kind=kind;this.startAt=now;this.attackerIndex=index;this.source={...source};this.victim={x:dying.x,y:dying.y,angle:dying.angle};
  this.angle=Math.atan2(dying.y-source.y,dying.x-source.x);this.direction={x:Math.cos(this.angle),y:Math.sin(this.angle)};
  // (B14) ents.js plans the death; without a plan, v11's
  const plan=window.__ents&&window.__ents.deathPlan?window.__ents.deathPlan(this,kind,kill):null;
  this.variant=plan?plan.v:'A';this.wall=plan?plan.wall:null;this.hits=plan?plan.hits:null;this.kt=plan?plan.kt:[.08,.36];this.dw=plan?plan.dw:[2.03,3.12];
  this.spin=plan?plan.spin:1.65;this.squish=plan?plan.squish:1;this.blackFn=plan?plan.black:null;
  this.knock=this.safeDistance(this.victim,this.angle,plan?plan.kn:34);
  const fallen={x:dying.x+this.direction.x*this.knock,y:dying.y+this.direction.y*this.knock};
  this.drag=this.safeDistance(fallen,this.angle+Math.PI,plan?plan.dr:kind==='Hound'?128:86);
  this.torch={x:dying.x-12,y:dying.y+10,angle:dying.angle};
  // (B15, B18; owner G.I.B.) a physical death (dphys.js, window.__dphys) takes over the clock, the frame and the duration
  this.ph=null;this.hands=null;this.gearHeld=false;this.hatOn=false;this.evi=0;this.trail=null;
  this.ph=window.__dphys?window.__dphys.begin(this,plan,{vx:dying.vx||0,vy:dying.vy||0,exhausted:dying.exhausted||dying.stamina!==undefined&&dying.stamina<22||other&&other.ex,eqKind:dying.equipment.kind,hat:other?other.hat:window.__api.look.hat}):null;
  if(this.ph)this.duration=this.ph.dur;
  this.createDebris();
 }
 reset(){
  this.ph=null;this.__lab=null;this.dEq=null;this.dHat=null;this.hands=null;this.evi=0;this.trail=null;
  this.active=false;this.elapsed=0;this.finished=false;this.corpseId=null;this.bursts=[];this.nextHit=0;this.black=0;
  this.blood.clear();this.foreground.clear();this.debris.removeChildren().forEach(c=>c.destroy({children:true}));this.debris.visible=false;
 }
 private createDebris(){
  // (B12) the dying wanderer's light and hat: another wanderer's, or the local one's (window.__api)
  const dying=this.V||window.__api.H,look=this.V?{hat:this.V.hat}:window.__api.look;
  // (B10, B11) the dropped light, drawn from its equipment parts; a headlamp stays on the head. (B18) A physical death shows its own.
  if(dying.equipment.kind!=='headlamp'){const light=new Graphics();drawGear(light,dying.equipment.kind,partsFor(dying.equipment,dying.equipment.kind),parseInt(dying.equipment.color.slice(1),16),false,0,-1);light.position.set(this.torch.x,this.torch.y);light.rotation=this.angle+.8;this.debris.addChild(light);this.dEq=light;if(this.ph)light.visible=false;}
  if(look.hat!=='none'){
   const color=look.hat==='hardhat'?0xd6ac38:look.hat==='beanie'?0x9e5963:0x527480;
   const hat=new Graphics().ellipse(0,0,16,13).fill(color).stroke({color:0x252921,width:2});
   if(look.hat!=='beanie')hat.ellipse(0,-11,10,4).fill(color);
   hat.position.set(this.victim.x+Math.cos(this.angle+1.2)*40,this.victim.y+Math.sin(this.angle+1.2)*40);hat.rotation=this.angle+1.8;this.debris.addChild(hat);this.dHat=hat;if(this.ph)hat.visible=false;
  }
 }
 frame(now:number){
  if(!this.active)return false;
  const t=this.elapsed=this.ph?window.__dphys!.clock(this,now):Math.max(0,now-this.startAt);
  if(this.ph)return window.__dphys!.frame(this,t);
  // (B14) the knock-back's and the drag's timing, the hits, the spin and the squish are the plan's
  const u=this.direction,knock=smooth(this.kt[0],this.kt[1],t)*this.knock,drag=smooth(this.dw[0],this.dw[1],t)*this.drag,hits=this.hits||captureHits[this.kind];
  this.impact=hits.reduce((v,at)=>v+(t>=at?Math.exp(-(t-at)*18):0),0);
  this.injury=smooth(.2,1.82,t);this.grip=smooth(.15,.4,t);this.shake=this.impact*9;
  const struggle=(1-smooth(1.62,2.05,t))*smooth(.22,.4,t),jitter=Math.sin(t*37)*struggle*4+this.impact*5;
  this.body.x=this.victim.x+u.x*(knock-drag)-u.y*jitter;
  this.body.y=this.victim.y+u.y*(knock-drag)+u.x*jitter;
  this.body.angle=this.victim.angle+Math.PI/2+smooth(.08,.5,t)*this.spin+Math.sin(t*24)*struggle*.14+this.impact*.17;
  this.body.scaleX=1+smooth(.12,.45,t)*.17*this.squish;this.body.scaleY=1-smooth(.12,.45,t)*.18*this.squish;
  this.body.alpha=this.kind==='Smiler'?1-.65*smooth(1.8,2.35,t)*(1-smooth(2.6,3.1,t)):1;
  const target={x:this.body.x-u.x*(30-this.impact*9),y:this.body.y-u.y*(30-this.impact*9)},leap=smooth(0,.22,t);
  this.attacker.x=this.source.x+(target.x-this.source.x)*leap;this.attacker.y=this.source.y+(target.y-this.source.y)*leap;this.attacker.angle=this.angle;
  this.debris.visible=t>.24;this.torch.angle=this.angle+Math.PI+Math.sin(Math.min(t,.8)*11)*Math.max(0,.8-t)*2;
  while(this.nextHit<hits.length&&t>=hits[this.nextHit])this.bursts.push({x:this.body.x,y:this.body.y,at:hits[this.nextHit],seed:this.nextHit++});
  // (B11, B12) a headlamp stays on the body
  if((this.V||window.__api.H).equipment.kind==='headlamp'){this.torch.x=this.body.x;this.torch.y=this.body.y;this.torch.angle=this.body.angle-Math.PI/2;}
  this.black=this.blackFn?this.blackFn(t):0;
  this.drawBlood(t);this.drawShadow(t);this.foreground.alpha=1-smooth(2.65,3.2,t);
  this.shade=smooth(3.12,this.duration,t);this.finished=t>=this.duration;return this.finished;
 }
 private drawBlood(t:number){
  // (B08, owner G.I.B.) gore.js draws the blood when the page has it; (B14) ents.js adds the death's extras
  if(window.__gore){window.__gore.fx(this.blood,this,t,(x:number,y:number)=>isFloor(Math.floor(x/TILE),Math.floor(y/TILE)));return window.__ents&&window.__ents.deathExtras&&window.__ents.deathExtras(this.blood,this,t);}
  const g=this.blood;g.clear();
  for(const b of this.bursts){
   const age=t-b.at;if(age<0)continue;
   const pool=smooth(0,1.1,age),r=12+pool*21;
   g.ellipse(b.x,b.y+3,r,r*.62).fill({color:0x46090f,alpha:.87});
   g.ellipse(b.x-3,b.y,r*.68,r*.4).fill({color:0x761016,alpha:.8});
   for(let i=0;i<24;i++){
    const a=this.angle+(i*2.399+b.seed*.7),travel=Math.min(1,age*3.5),radius=12+(i*29+b.seed*11)%88;
    const x=b.x+Math.cos(a)*radius*travel,y=b.y+Math.sin(a)*radius*travel;
    if(!isFloor(Math.floor(x/TILE),Math.floor(y/TILE)))continue;
    const size=1.1+(i%4)*.8;g.ellipse(x,y,size*(1+travel),size).fill({color:i%3===0?0x991c1e:0x591019,alpha:.88});
    if(age<.26)g.moveTo(x,y).lineTo(x-Math.cos(a)*8,y-Math.sin(a)*8).stroke({color:0x9b1b20,width:2});
   }
  }
  if(t>2.03&&this.bursts.length){const from=this.bursts[this.bursts.length-1];
   for(let side=-1;side<=1;side++)g.moveTo(from.x-this.direction.y*side*7,from.y+this.direction.x*side*7).lineTo(this.body.x-this.direction.y*side*7,this.body.y+this.direction.x*side*7).stroke({color:0x601019,alpha:.58,width:side===0?18:4,cap:'round'});
  }
 }
 private drawShadow(t:number){const g=this.foreground;g.clear();if(this.kind!=='Smiler')return;
  const a=this.attacker,b=this.body,grip=smooth(.05,.43,t),devour=smooth(.75,1.8,t),size=22+devour*49;
  g.ellipse(a.x,a.y,size*.82,size).fill({color:0x010304,alpha:.97});
  for(const side of [-1,1]){
   const hx=b.x-this.direction.y*side*24,hy=b.y+this.direction.x*side*24;
   const mx=(a.x+hx)/2-this.direction.y*side*48,my=(a.y+hy)/2+this.direction.x*side*48;
   g.moveTo(a.x,a.y).quadraticCurveTo(mx,my,a.x+(hx-a.x)*grip,a.y+(hy-a.y)*grip).stroke({color:0x050508,width:12,cap:'round'});
   for(let k=0;k<3;k++)g.moveTo(hx,hy).lineTo(hx+this.direction.x*(9+k*3),hy+this.direction.y*(9+k*3)).stroke({color:0x181219,width:2});
  }
  // The jaw closes on the body in time with each impact.
  const open=(1-this.impact*.65)*(1-smooth(1.6,2.4,t)),cx=b.x,cy=b.y;
  for(const side of [-1,1])for(let i=-4;i<=4;i++){
   const along=i*7,across=side*(18+open*17);
   const x=cx+this.direction.x*across-this.direction.y*along,y=cy+this.direction.y*across+this.direction.x*along;
   g.poly([x-this.direction.y*3,y+this.direction.x*3,x+this.direction.y*3,y-this.direction.x*3,x-this.direction.x*side*10,y-this.direction.y*side*10]).fill({color:0xcfc9b1,alpha:devour*(1-smooth(2,2.65,t))});
  }
 }
}
