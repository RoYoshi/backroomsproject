import {Container,Graphics} from 'pixi.js';
import {entity,smilers,type Smiler} from '../shared/entity';
import {player} from '../shared/movement';
import {exposureAt} from '../shared/vision';

// A Hound is an emaciated humanoid built to move on all fours.
export class EntityView extends Container{
 private limbs=new Graphics();private spine=new Container();private hair=new Graphics();private jaw=new Graphics();
 constructor(){super();this.addChild(new Graphics().ellipse(0,10,36,22).fill({color:0x000000,alpha:.4}),this.limbs,this.spine);
  const body=new Graphics().poly([-11,-28,-18,-13,-13,9,-5,22,11,23,16,8,17,-17,9,-30]).fill(0x57594c).stroke({color:0x191f1e,width:2});
  body.poly([-8,-26,-14,-14,-10,9,0,18,1,-24]).fill(0xa9a995).poly([2,-26,10,-27,15,-12,11,12,3,17]).fill(0x747968);
  for(let i=0;i<7;i++){const y=-24+i*6;body.ellipse(0,y,2.8,2.2).fill(0xb2b09c);if(i<5)for(const side of [-1,1])body.moveTo(side*3,y+1).quadraticCurveTo(side*12,y+6,side*14,y+3).stroke({color:0xbbb59c,alpha:.72,width:1.5});}
  body.moveTo(-13,-15).quadraticCurveTo(-18,-2,-10,13).moveTo(13,-16).quadraticCurveTo(17,-4,9,15).stroke({color:0x32372e,width:2});
  const jaw=this.jaw.ellipse(0,-30,13,14).fill(0x8d917d).stroke({color:0x2e332d,width:2}).ellipse(0,-29,9,11).fill(0x141714);
  for(let i=0;i<7;i++){const x=-7+i*2.4;jaw.poly([x,-39,x+1.3,-34,x+2.5,-39]).fill(0xd1c4a7);jaw.poly([x,-19,x+1.1,-25,x+2.2,-19]).fill(0xd1c4a7);}
  this.spine.addChild(body,jaw,this.hair);
 }
 update(active:boolean,time:number,dt:number,flash:boolean){this.visible=active;if(!active){this.alpha=0;return;}const target=exposureAt(entity.x,entity.y,player,flash);this.alpha+=(target-this.alpha)*(1-Math.exp(-dt*(target>this.alpha?10:7)));this.scale.set(1);this.jaw.scale.set(1);
  this.position.set(entity.x,entity.y);this.rotation=entity.angle+Math.PI/2;
  const chase=entity.state==='chase',phase=entity.distance*.065,g=this.limbs;g.clear();
  for(const side of [-1,1]){const swing=Math.sin(phase+(side===1?Math.PI:0));
   const shoulderX=side*14,shoulderY=-18,elbowX=side*(26+swing*3),elbowY=-12+swing*9,clawX=side*(30-swing*3),clawY=11+swing*13;
   g.moveTo(shoulderX,shoulderY).lineTo(elbowX,elbowY).lineTo(clawX,clawY).stroke({color:0x202721,width:11,cap:'round',join:'round'});
   g.moveTo(shoulderX,shoulderY).lineTo(elbowX,elbowY).lineTo(clawX,clawY).stroke({color:0x969b82,width:5,cap:'round',join:'round'});
   for(let i=0;i<4;i++)g.moveTo(clawX-side*4+i*side*2,clawY).lineTo(clawX-side*6+i*side*3,clawY+9+i%2*2).stroke({color:0xc3bfa6,width:1.2});
   const kneeX=side*(16-swing*4),kneeY=28-swing*6,footX=side*(18+swing*5),footY=45-swing*10;
   g.moveTo(side*8,14).lineTo(kneeX,kneeY).lineTo(footX,footY).stroke({color:0x353b30,width:9,cap:'round',join:'round'});
   g.moveTo(side*8,14).lineTo(kneeX,kneeY).lineTo(footX,footY).stroke({color:0x777c68,width:4,cap:'round',join:'round'});
   for(let i=0;i<3;i++)g.moveTo(footX-3+i*3,footY).lineTo(footX-5+i*4,footY+7).stroke({color:0xbab7a0,width:1});
  }
  this.hair.clear();for(let i=0;i<13;i++){const x=-13+i*2.2,y=-40+(i%3)*2;this.hair.moveTo(x,y).quadraticCurveTo(x+Math.sin(time*3+i)*4,y+9,x+Math.sin(time*2+i)*5,y+18+i%4*3).stroke({color:0x101716,width:1.8+i%3*.4});}
  this.spine.rotation=Math.sin(phase)*.08;this.spine.position.y=Math.sin(phase*2)*(chase?2:1);
  this.jaw.rotation=entity.state==='search'||entity.state==='investigate'?Math.sin(time*2.1)*.12:entity.state==='stalk'?Math.sin(time*1.5)*.06:0;

 }
 attackPose(grip:number,impact:number){
  this.alpha=1;this.spine.rotation=impact*.13;this.spine.y=-impact*9;
  this.jaw.scale.set(1+impact*.2,1+impact*.7);
  if(grip<=0)return;const g=this.limbs;g.clear();
  for(const side of [-1,1]){
   g.moveTo(side*14,-18).lineTo(side*(38+impact*9),-28).lineTo(side*22,-51+impact*8).stroke({color:0x24251f,width:12,cap:'round',join:'round'});
   g.moveTo(side*14,-18).lineTo(side*(38+impact*9),-28).lineTo(side*22,-51+impact*8).stroke({color:0x9a9a83,width:5,cap:'round',join:'round'});
   for(let k=0;k<4;k++)g.moveTo(side*(17+k*3),-50+impact*8).lineTo(side*(15+k*3),-61+impact*8).stroke({color:0xd9c7a8,width:2});
   g.moveTo(side*9,13).lineTo(side*29,32).lineTo(side*39,45).stroke({color:0x787b67,width:6,cap:'round',join:'round'});
  }
 }

}
export class SmilerView extends Container{
 private face=new Graphics();private smiler:Smiler;
 constructor(smiler:Smiler){super();this.smiler=smiler;this.addChild(this.face);this.face.ellipse(0,0,17,20).fill({color:0x050808,alpha:.85});
  this.face.ellipse(-8,-7,3.5,5.5).ellipse(8,-7,3.5,5.5).fill(0xf3f4d7);
  this.face.poly([-15,1,-11,9,-3,13,5,13,13,9,16,1,11,6,4,7,-4,7,-11,5]).fill(0xecebd1).stroke({color:0xe7efe4,width:1});
  this.face.poly([-12,4,-8,7,-5,5,-2,9,1,6,4,9,7,5,11,7,13,4,10,10,0,11,-10,9]).fill(0x0a0a0b);
 }
 update(active:boolean,time:number,dt:number,flash:boolean){const s=this.smiler;this.visible=active;if(!active){this.alpha=0;return;}const target=exposureAt(s.x,s.y,player,flash);this.alpha+=(target-this.alpha)*(1-Math.exp(-dt*(target>this.alpha?10:7)));
  this.position.set(s.x,s.y);this.rotation=s.angle+Math.PI/2;this.face.rotation=s.state==='watch'?Math.sin(time*1.4)*.06:0;this.scale.set(this.scale.x+((s.state==='pursue'?1.08:1)-this.scale.x)*(1-Math.exp(-dt*8)));
 }
}
export const smilerViews=smilers.map(s=>new SmilerView(s));
