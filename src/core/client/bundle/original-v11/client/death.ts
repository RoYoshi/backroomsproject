import {Container,Graphics} from 'pixi.js';
import {appearance} from './appearance';
import {player} from '../shared/movement';
import {clearPoint} from '../shared/navigation';
import {isFloor,TILE} from '../shared/world';
import {smooth} from '../shared/vision';
export type CaptureKind='Hound'|'Smiler';
export const captureHits={Hound:[.24,.74,1.2,1.7],Smiler:[.38,.98,1.48]};
type Point={x:number,y:number};
type Burst={x:number,y:number,at:number,seed:number};
export class DeathSequence{
 blood=new Graphics();foreground=new Graphics();debris=new Container();
 active=false;kind:CaptureKind='Hound';startAt=0;elapsed=0;duration=3.85;attackerIndex=-1;
 source={x:0,y:0};victim={x:0,y:0,angle:0};direction={x:1,y:0};angle=0;knock=0;drag=0;
 body={x:0,y:0,angle:0,scaleX:1,scaleY:1,alpha:1};attacker={x:0,y:0,angle:0};
 impact=0;grip=0;injury=0;shade=0;shake=0;finished=false;corpseId:string|null=null;bursts:Burst[]=[];nextHit=0;
 torch={x:0,y:0,angle:0};
 private safeDistance(origin:Point,angle:number,length:number){let d=0;for(let i=4;i<=length;i+=4){if(!clearPoint(origin.x+Math.cos(angle)*i,origin.y+Math.sin(angle)*i,22))break;d=i;}return d;}
 start(kind:CaptureKind,now:number,source:Point,index=-1){
  this.reset();this.active=true;this.kind=kind;this.startAt=now;this.attackerIndex=index;this.source={...source};this.victim={x:player.x,y:player.y,angle:player.angle};
  this.angle=Math.atan2(player.y-source.y,player.x-source.x);this.direction={x:Math.cos(this.angle),y:Math.sin(this.angle)};
  this.knock=this.safeDistance(this.victim,this.angle,34);
  const fallen={x:player.x+this.direction.x*this.knock,y:player.y+this.direction.y*this.knock};
  this.drag=this.safeDistance(fallen,this.angle+Math.PI,kind==='Hound'?128:86);
  this.torch={x:player.x-12,y:player.y+10,angle:player.angle};this.createDebris();
 }
 reset(){this.active=false;this.elapsed=0;this.finished=false;this.corpseId=null;this.bursts=[];this.nextHit=0;this.blood.clear();this.foreground.clear();this.debris.removeChildren().forEach(c=>c.destroy({children:true}));this.debris.visible=false;}
 private createDebris(){
  if(player.equipment.kind!=='chestlamp'){const torch=new Graphics();if(player.equipment.kind==='torch')torch.rect(-3,-12,6,24).fill(0x705031).ellipse(0,-15,5,7).fill(parseInt(player.equipment.color.slice(1),16));else torch.roundRect(-4,-13,8,24,2).fill(0x20262b).rect(-6,-14,12,5).fill(0xc0c5ae);torch.position.set(this.torch.x,this.torch.y);torch.rotation=this.angle+.8;this.debris.addChild(torch);}
  if(appearance.hat!=='none'){
   const color=appearance.hat==='hardhat'?0xd6ac38:appearance.hat==='beanie'?0x9e5963:0x527480;
   const hat=new Graphics().ellipse(0,0,16,13).fill(color).stroke({color:0x252921,width:2});
   if(appearance.hat!=='beanie')hat.ellipse(0,-11,10,4).fill(color);
   hat.position.set(this.victim.x+Math.cos(this.angle+1.2)*40,this.victim.y+Math.sin(this.angle+1.2)*40);hat.rotation=this.angle+1.8;this.debris.addChild(hat);
  }
 }
 frame(now:number){
  if(!this.active)return false;const t=this.elapsed=Math.max(0,now-this.startAt),u=this.direction;
  const knock=smooth(.08,.36,t)*this.knock,drag=smooth(2.03,3.12,t)*this.drag;
  const hits=captureHits[this.kind];this.impact=hits.reduce((v,at)=>v+(t>=at?Math.exp(-(t-at)*18):0),0);
  this.injury=smooth(.2,1.82,t);this.grip=smooth(.15,.4,t);this.shake=this.impact*9;
  const struggle=(1-smooth(1.62,2.05,t))*smooth(.22,.4,t);
  const jitter=Math.sin(t*37)*struggle*4+this.impact*5;
  this.body.x=this.victim.x+u.x*(knock-drag)-u.y*jitter;
  this.body.y=this.victim.y+u.y*(knock-drag)+u.x*jitter;
  this.body.angle=this.victim.angle+Math.PI/2+smooth(.08,.5,t)*1.65+Math.sin(t*24)*struggle*.14+this.impact*.17;
  this.body.scaleX=1+smooth(.12,.45,t)*.17;this.body.scaleY=1-smooth(.12,.45,t)*.18;
  this.body.alpha=this.kind==='Smiler'?1-.65*smooth(1.8,2.35,t)*(1-smooth(2.6,3.1,t)):1;
  const target={x:this.body.x-u.x*(30-this.impact*9),y:this.body.y-u.y*(30-this.impact*9)};
  const leap=smooth(0,.22,t);this.attacker.x=this.source.x+(target.x-this.source.x)*leap;this.attacker.y=this.source.y+(target.y-this.source.y)*leap;this.attacker.angle=this.angle;
  this.debris.visible=t>.24;this.torch.angle=this.angle+Math.PI+Math.sin(Math.min(t,.8)*11)*Math.max(0,.8-t)*2;
  while(this.nextHit<hits.length&&t>=hits[this.nextHit]){this.bursts.push({x:this.body.x,y:this.body.y,at:hits[this.nextHit],seed:this.nextHit++});}
  if(player.equipment.kind==='chestlamp'){this.torch.x=this.body.x;this.torch.y=this.body.y;this.torch.angle=this.body.angle-Math.PI/2;}
  this.drawBlood(t);this.drawShadow(t);this.foreground.alpha=1-smooth(2.65,3.2,t);
  this.shade=smooth(3.12,this.duration,t);this.finished=t>=this.duration;return this.finished;
 }
 private drawBlood(t:number){const g=this.blood;g.clear();
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
