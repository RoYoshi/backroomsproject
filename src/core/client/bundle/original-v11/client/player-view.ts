import {Container,Graphics} from 'pixi.js';
import {player} from '../shared/movement';
import {appearance,type Appearance} from './appearance';
import {equipment} from './loadout';
import type {LightEquipment} from '../shared/equipment';
export class PlayerView extends Container {
 private body=new Container();private hands:Container[]=[];private pack=new Container();private hat=new Container();private wounds=new Graphics();private gear=new Graphics();private signature='';
 constructor(private look:Appearance=appearance,private lightGear:LightEquipment=equipment){super();this.rebuild();}
 private rebuild(){
  this.removeChildren().forEach(c=>c.destroy({children:true}));this.hands=[];this.body=new Container();this.pack=new Container();this.hat=new Container();this.wounds=new Graphics();this.gear=new Graphics();
  const main=parseInt(this.look.main.slice(1),16),skin=parseInt(this.look.hands.slice(1),16);
  this.addChild(new Graphics().ellipse(1,5,19,19).fill({color:0x000000,alpha:.3}),this.pack,this.body);
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
 update(time:number,flash:boolean,preview=false){
  if(this.signature!==JSON.stringify(this.look))this.rebuild();
  if(!preview){this.position.set(player.x,player.y);this.rotation=player.angle+Math.PI/2;}
  const speed=preview?.35:Math.min(1,Math.hypot(player.vx,player.vy)/175),phase=preview?time*4:player.distance*.085;
  this.hat.visible=true;this.pack.visible=true;this.wounds.clear();
  this.hands.forEach((h,i)=>{h.x=i===0?-13:13;h.y=-13+Math.sin(phase+i*Math.PI)*speed*3;});
  this.gear.visible=true;this.gear.clear();const lamp=this.gear,color=parseInt(this.lightGear.color.slice(1),16),on=flash||preview;
  if(this.lightGear.kind==='chestlamp'){
   lamp.moveTo(-13,3).lineTo(0,-11).lineTo(13,3).stroke({color:0x272a26,width:3});
   lamp.roundRect(-7,-16,14,9,2).fill(0x333b38).rect(-5,-17,10,3).fill(on?color:0x58584a);
  }else if(this.lightGear.kind==='torch'){
   lamp.moveTo(13,-13).lineTo(13,-28).stroke({color:0x705031,width:5});
   if(on){const wave=Math.sin(time*19)*2;lamp.poly([8,-27,10,-34,13+wave,-42,16,-34,18,-26]).fill(color).poly([11,-27,13,-35,16,-27]).fill(0xfff1b1);}
  }else lamp.roundRect(9,-28,8,17,2).fill(0x293438).rect(8,-30,10,4).fill(on?color:0x59645e);
  this.body.scale.x=1;this.body.scale.y=1+Math.sin(time*2)*.012;this.pack.y=Math.sin(phase*2)*speed*.7;this.hat.y=Math.sin(phase*2)*speed*.35;
 }
 deathPose(progress:number,impact:number,hatDropped:boolean){
  this.hat.visible=!hatDropped;this.gear.visible=this.lightGear.kind==='chestlamp'||!hatDropped;this.body.scale.set(1+progress*.12,1-progress*.18+impact*.08);
  this.hands.forEach((h,i)=>{const side=i===0?-1:1;h.x=side*(18+progress*12+impact*8);h.y=-6+progress*19+(i===0?-1:1)*impact*12;});
  if(progress>.2){for(let i=0;i<3;i++)this.wounds.moveTo(-10+i*6,-11).lineTo(-6+i*6,8).stroke({color:0x7e1116,width:2.5,alpha:Math.min(.95,progress)});}
 }
}
