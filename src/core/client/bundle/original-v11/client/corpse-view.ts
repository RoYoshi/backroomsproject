import {Container,Graphics} from 'pixi.js';
import {PlayerView} from './player-view';
import type {Corpse} from '../shared/remains';
import {isFloor,TILE} from '../shared/world';
export class CorpseView extends Container{
 constructor(public record:Corpse){super();const r=record,blood=new Graphics();this.addChild(blood);
  for(const b of r.blood){
   blood.ellipse(b.x,b.y,33,21).fill({color:0x430a12,alpha:.91});
   for(let i=0;i<24;i++){
    const a=r.attackAngle+i*2.399+b.seed*.7,radius=12+(i*29+b.seed*11)%88,x=b.x+Math.cos(a)*radius,y=b.y+Math.sin(a)*radius;
    if(isFloor(Math.floor(x/TILE),Math.floor(y/TILE)))blood.ellipse(x,y,2+(i%4)*1.3,1.2+(i%4)*.7).fill({color:0x64101a,alpha:.9});
   }
  }
  const from=r.blood[r.blood.length-1];if(from)blood.moveTo(from.x,from.y).lineTo(r.x,r.y).stroke({color:0x601019,alpha:.62,width:18,cap:'round'});
  const body=new PlayerView(r.appearance,r.equipment);body.update(0,false);body.deathPose(1,0,true);body.position.set(r.x,r.y);body.rotation=r.angle;body.scale.set(r.scaleX,r.scaleY);body.tint=r.cause==='Smiler'?0x9b8585:0xc8b1a4;this.addChild(body);
  if(r.equipment.kind!=='chestlamp'){
   const gear=new Graphics();if(r.equipment.kind==='torch')gear.rect(-3,-12,6,22).fill(0x4b3425).ellipse(0,-13,5,7).fill(0x161311);
   else gear.roundRect(-4,-13,8,24,2).fill(0x20262b).rect(-5,-14,10,4).fill(0x74786a);
   gear.position.set(r.dropped.x,r.dropped.y);gear.rotation=r.dropped.angle;this.addChild(gear);
  }
  if(r.appearance.hat!=='none'){
   const color=r.appearance.hat==='hardhat'?0xd6ac38:r.appearance.hat==='beanie'?0x9e5963:0x527480;
   const hat=new Graphics().ellipse(0,0,16,13).fill(color).stroke({color:0x252921,width:2});
   if(r.appearance.hat!=='beanie')hat.ellipse(0,-11,10,4).fill(color);
   hat.position.set(r.hat.x,r.hat.y);hat.rotation=r.hat.angle;this.addChild(hat);
  }
 }
}
