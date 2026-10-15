import {Container,Graphics} from 'pixi.js';
import {player} from '../shared/movement';
import {appearance,type Appearance} from './appearance';
import {equipment} from './loadout';
import {partsFor,type LightEquipment,type LightKind} from '../shared/equipment';
import {rayDistance} from '../shared/world';
import {drawGear} from './gear-art';
/* the body a view draws: the local player, or (lineage B06) another player's pose */
export type Subject={x:number;y:number;vx:number;vy:number;angle:number;distance:number};
/* (B15, B18; owner G.I.B.) a physical death pose from dphys.js / death-motion.js: the hands, whether the hat and the light are still on */
export type PhysicalPose={ph?:unknown;hands?:{x:number;y:number}[]|null;hatOn?:boolean;gearHeld?:boolean|number;rho?:number};
export class PlayerView extends Container {
 /* hat and gear are public: NEW RUN's vanish (arrival.ts, lineage B12) hides the light and keeps the hat */
 private body=new Container();private hands:Container[]=[];private pack=new Container();hat=new Container();private wounds=new Graphics();gear=new Graphics();private signature='';
 /* set the first time update() runs (B10, B11): the last time, the camcorder's raise (0..1), the eased beam aim; and the beam itself:
    where the carried light leaves the body, and its angle (window.__api.beam) */
 declare bt?:number;declare cr?:number;declare ba?:number;declare beam?:{x:number;y:number;angle:number};
 /* written by the page's death and gore scripts (B08): the key and cause G.I.B.'s wounds are drawn for */
 declare __key?:string;declare __cause?:string;
 constructor(private look:Appearance=appearance,private lightGear:LightEquipment=equipment){super();this.rebuild();}
 private rebuild(){
  this.removeChildren().forEach(c=>c.destroy({children:true}));this.hands=[];this.body=new Container();this.pack=new Container();this.hat=new Container();this.wounds=new Graphics();this.gear=new Graphics();
  const main=parseInt(this.look.main.slice(1),16),skin=parseInt(this.look.hands.slice(1),16);
  // (B40, owner BR-R) no decorative dark ellipse under the body: the light's own shadows ground it
  this.addChild(this.pack,this.body);
  const g=new Graphics().circle(0,1,18).fill(main).stroke({color:0x413d2b,width:1.6});
  // Keep the uploaded model's single circular body and two separate hands.
  if(this.look.texture==='freckles')for(let i=0;i<25;i++){const a=i*2.4,r=4+(i*7)%12;g.circle(Math.cos(a)*r,Math.sin(a)*r+1,.75+i%2*.3).fill({color:0x694729,alpha:.4});}
  if(this.look.texture==='stripes')for(let y=-10;y<=12;y+=7){const w=Math.sqrt(16*16-y*y);g.moveTo(-w,y+1).quadraticCurveTo(0,y+5,w,y+1).stroke({color:0x483f2f,alpha:.25,width:2.7});}
  if(this.look.texture==='patched'){g.roundRect(-10,0,9,10,2).fill({color:0x453e31,alpha:.32}).roundRect(3,-7,7,7,1).fill({color:0xffffff,alpha:.25});for(let i=0;i<4;i++)g.moveTo(-11+i*3,0).lineTo(-10+i*3,2).stroke({color:0xe9ddbc,width:.7});}
  this.body.addChild(g);
  if(this.look.backpack!=='none'){
   const utility=this.look.backpack==='utility',b=new Graphics().roundRect(-12,10,24,14,4).fill(utility?0x3b4147:0x68774e).stroke({color:0x242e27,width:1.5}).roundRect(-8,15,16,7,2).fill(utility?0x59606a:0x849067);
   for(const x of [-7,7])b.rect(x-1,11,2,12).fill(0x29372c).rect(x-2,14,4,3).fill(0xbbb69a);
   if(utility)b.roundRect(-16,13,5,9,1).roundRect(11,13,5,9,1).fill(0x777e71);this.pack.addChild(b);
  }
  for(const side of [-1,1]){const hand=new Container();hand.position.set(side*13,-13);hand.addChild(new Graphics().circle(0,0,6).fill(skin).stroke({color:0x494832,width:1.5}).arc(0,0,4.3,Math.PI,Math.PI*1.7).stroke({color:0xffffff,alpha:.25,width:1}));this.addChild(hand);this.hands.push(hand);}
  // Camera is directly overhead: crowns fill the top of the round body, and
  // the brim points in the character's forward direction (negative local Y).
  const h=new Graphics();
  if(this.look.hat==='cap'){
   h.ellipse(0,0,17,16).fill(0x344851).stroke({color:0x1b3034,width:1.6});
   h.ellipse(0,1,13,12).fill(0x527480);
   h.moveTo(0,-12).quadraticCurveTo(-3,0,-2,12).stroke({color:0x9ab4af,alpha:.6,width:1});
   h.ellipse(0,-15,11,6).fill(0x283e45).stroke({color:0x94a9a6,width:1});
   h.circle(0,0,1.8).fill(0xa6c1b8);
  }
  if(this.look.hat==='beanie'){
   h.circle(0,0,17).fill(0x713b47).stroke({color:0x38262e,width:1.8});
   h.circle(0,0,13).fill(0x9e5963).stroke({color:0xca8388,alpha:.7,width:1});
   for(let i=0;i<12;i++){const a=i*Math.PI/6;h.moveTo(Math.cos(a)*6,Math.sin(a)*6).lineTo(Math.cos(a)*12,Math.sin(a)*12).stroke({color:0xd49593,alpha:.55,width:.8});}
   h.circle(0,0,4).fill(0xb67879);
  }
  if(this.look.hat==='hardhat'){
   h.ellipse(0,0,19,17).fill(0x966e25).stroke({color:0x524522,width:1});
   h.ellipse(0,0,16,15).fill(0xd6ac38).stroke({color:0xf5d86b,width:1.5});
   h.roundRect(-3,-14,6,28,3).fill(0xf6d879);
   h.ellipse(0,-17,13,5).fill(0xb88527).stroke({color:0xffe18b,width:1});
   h.ellipse(-5,-6,3,2).fill({color:0xffefb1,alpha:.55});
  }
  this.hat.addChild(h);this.addChild(this.hat,this.wounds,this.gear);this.signature=JSON.stringify(this.look);
 }
 /* One frame of the body.  (B06) subject: whose pose (another player's, for drawPeers).  (B10, B11, owner P.O.C.K.E.T.) the hands carry
  * the light: each kind has its own hand position and sway; the beam's aim eases towards the player's aim (a lag); the camcorder is
  * raised to the eye while it is on; the gear is drawn by drawGear; the beam starts where the light is, pulled back from a wall in front
  * of it.  (B14) S.P.A.C.E.'s pose script (window.__pose) adjusts the pose last. */
 update(time:number,flash:boolean,preview=false,subject:Subject=player){
  if(this.signature!==JSON.stringify(this.look))this.rebuild();
  if(!preview){this.position.set(subject.x,subject.y);this.rotation=subject.angle+Math.PI/2;}
  const pace=preview?60:Math.hypot(subject.vx,subject.vy);
  const speed=preview?.35:Math.min(1,pace/175),swing=preview?.6:Math.min(1.7,pace/175),phase=preview?time*4:subject.distance*.085;
  const kind:LightKind=this.lightGear.kind,inHand=kind==='flashlight'||kind==='lantern'||kind==='camcorder',onHead=kind==='headlamp';
  const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
  this.hat.visible=true;this.pack.visible=true;this.wounds.clear();
  const dt=Math.min(.1,Math.max(0,time-(this.bt??time)));this.bt=time;
  const raised=kind==='camcorder'&&(flash||preview);
  this.cr=preview?+raised:(this.cr??0)+((raised?1:0)-(this.cr??0))*(1-Math.exp(-dt*8));
  const cr=this.cr,aim=subject.angle;
  if(this.ba===void 0||preview||!isFinite(this.ba))this.ba=aim;
  else this.ba+=Math.atan2(Math.sin(aim-this.ba),Math.cos(aim-this.ba))*(1-Math.exp(-dt*(onHead?24:kind==='camcorder'?18:13)));
  const lag=inHand||onHead?Math.atan2(Math.sin(this.ba-aim),Math.cos(this.ba-aim)):0;
  let sway=0,hx=13,hy=-13,gx=0,reach=0;                                    // the light hand, the gear's offset in it, the light's reach from it
  if(kind==='flashlight'){sway=swing*(.075*Math.sin(phase+1.1)+.045*Math.sin(2*phase+.4))+.012*Math.sin(time*1.9)+.008*Math.sin(time*3.1);hx=13+Math.sin(phase+.5)*2.4*swing+Math.sin(time*1.3)*.35;hy=-13+Math.sin(phase+Math.PI)*speed*3-1.5+Math.sin(time*1.7)*.3;reach=23;}
  else if(kind==='lantern'){sway=swing*(.17*Math.sin(phase+.5)+.075*Math.sin(2*phase+1.4))+.025*Math.sin(time*1.6)+.012*Math.sin(time*2.7);hx=13+Math.sin(phase+.5)*2*swing+Math.sin(time*1.1)*.4;hy=-10.5+Math.sin(phase+Math.PI)*speed*3+Math.sin(time*1.4)*.3;reach=13;}
  else if(kind==='camcorder'){sway=(1-cr)*swing*.05*Math.sin(phase+1)+cr*(swing*.012*Math.sin(2*phase)+.006*Math.sin(time*2.3));hx=lerp(13,4.5,cr)+(1-cr)*Math.sin(phase+.5)*1.4*swing+Math.sin(time*1.2)*.3;hy=lerp(-8,-17.5,cr)+Math.sin(phase+Math.PI)*speed*3*(1-cr*.7)+Math.sin(time*1.6)*.25*cr;gx=-3.7;}
  else{hx=13;hy=-13+Math.sin(phase+Math.PI)*speed*3;}
  const rho=onHead?lag*.5+swing*.012*Math.sin(2*phase):lag+sway;
  let lhx=-13,lhy=-13+Math.sin(phase)*speed*3;                           // the other hand
  if(kind==='camcorder'){lhx=lerp(-13,-9.5,cr);lhy=lerp(lhy,-14.5,cr);}
  this.hands.forEach((hand,i)=>{hand.x=i===0?lhx:hx;hand.y=i===0?lhy:hy;});
  this.gear.visible=true;this.gear.clear();const lamp=this.gear,color=parseInt(this.lightGear.color.slice(1),16),on=kind==='camcorder'?raised:flash||preview;
  if(onHead){lamp.position.set(0,0);lamp.rotation=0;}else{lamp.position.set(hx+gx,hy);lamp.rotation=inHand?rho:0;}
  drawGear(lamp,kind,partsFor(this.lightGear,kind),color,on,time,parseInt(this.look.hands.slice(1),16),{cr,hat:this.look.hat});
  const hatY=this.look.hat==='hardhat'||this.look.hat==='cap'?-27:-20.5,lx=onHead?0:hx+Math.sin(rho)*reach,ly=onHead?hatY-6:hy-Math.cos(rho)*reach;
  const turn=subject.angle+Math.PI/2,cos=Math.cos(turn),sin=Math.sin(turn);
  let wx=subject.x+lx*cos-ly*sin,wy=subject.y+lx*sin+ly*cos;
  if(!preview){let dx=wx-subject.x,dy=wy-subject.y;const d=Math.hypot(dx,dy);if(d>1){const free=rayDistance(subject.x,subject.y,Math.atan2(dy,dx),d+2);if(free<d+1){dx*=Math.max(0,free-3)/d;dy*=Math.max(0,free-3)/d;wx=subject.x+dx;wy=subject.y+dy;}}}
  this.beam={x:wx,y:wy,angle:subject.angle+rho};
  this.body.scale.x=1;this.body.scale.y=1+Math.sin(time*2)*.012;this.pack.y=Math.sin(phase*2)*speed*.7;this.hat.y=Math.sin(phase*2)*speed*.35;
  if(window.__pose)window.__pose.apply(this,subject,time,preview);
 }
 /* (B15, B18) a physical pose (pose.ph, from G.I.B.'s death physics) places the hands, the hat and the held light itself; otherwise the
  * v11 pose.  (B08) the wounds are G.I.B.'s (gore.js) when the page has it. */
 deathPose(progress:number,impact:number,hatDropped:boolean,pose?:PhysicalPose|null){
  if(pose&&pose.ph&&pose.hands){
   const head=this.lightGear.kind==='headlamp';
   this.hat.visible=!!pose.hatOn;this.gear.visible=head||!!pose.gearHeld;this.body.scale.set(1+progress*.05,1-progress*.07);
   this.hands.forEach((h,i)=>{h.x=pose.hands![i].x;h.y=pose.hands![i].y;});
   if(!head&&pose.gearHeld){this.gear.position.set(pose.hands[1].x,pose.hands[1].y);this.gear.rotation=pose.rho||0;}
  }else{
   this.hat.visible=!hatDropped;this.gear.visible=this.lightGear.kind==='headlamp'||!hatDropped;this.body.scale.set(1+progress*.12,1-progress*.18+impact*.08);
   this.hands.forEach((h,i)=>{const side=i===0?-1:1;h.x=side*(18+progress*12+impact*8);h.y=-6+progress*19+(i===0?-1:1)*impact*12;});
  }
  if(progress>.2){
   if(window.__gore)window.__gore.wounds(this.wounds,Math.min(1,progress),this.__key||this.signature,this.__cause||window.__lastCause);
   else for(let i=0;i<3;i++)this.wounds.moveTo(-10+i*6,-11).lineTo(-6+i*6,8).stroke({color:0x7e1116,width:2.5,alpha:Math.min(.95,progress)});
  }
 }
}
