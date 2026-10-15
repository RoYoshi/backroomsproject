import {Container,Graphics} from 'pixi.js';
import {PlayerView} from './player-view';
import type {Corpse} from '../shared/remains';
import {isFloor,TILE} from '../shared/world';
import {migrateKind,partsFor,type LightKind} from '../shared/equipment';
import {drawGear} from './gear-art';
export class CorpseView extends Container{
 constructor(public record:Corpse){super();const r=record,blood=new Graphics();this.addChild(blood);
  // (lineage B12, owner G.I.B.) a wanderer who vanished at NEW RUN leaves only the light it dropped
  if(r.cause==='Vanish'){
   const light=new Graphics(),kind=migrateKind(r.equipment.kind) as LightKind;
   drawGear(light,kind,partsFor(r.equipment,kind),parseInt(r.equipment.color.slice(1),16),false,0,-1,{cr:0,hat:'none'});
   if(kind==='headlamp')light.pivot.set(0,-20.5);else if(kind==='camcorder')light.pivot.set(-6.5,-2);
   light.position.set(r.dropped.x,r.dropped.y);light.rotation=r.dropped.angle;this.addChild(light);
   return;
  }
  // (B08, owner G.I.B.) gore.js draws the blood of the remains when the page has it
  if(window.__gore)window.__gore.corpse(blood,r,(x:number,y:number)=>isFloor(Math.floor(x/TILE),Math.floor(y/TILE)));
  else{
   for(const b of r.blood){
    blood.ellipse(b.x,b.y,33,21).fill({color:0x430a12,alpha:.91});
    for(let i=0;i<24;i++){
     const a=r.attackAngle+i*2.399+b.seed*.7,radius=12+(i*29+b.seed*11)%88,x=b.x+Math.cos(a)*radius,y=b.y+Math.sin(a)*radius;
     if(isFloor(Math.floor(x/TILE),Math.floor(y/TILE)))blood.ellipse(x,y,2+(i%4)*1.3,1.2+(i%4)*.7).fill({color:0x64101a,alpha:.9});
    }
   }
   const from=r.blood[r.blood.length-1];if(from)blood.moveTo(from.x,from.y).lineTo(r.x,r.y).stroke({color:0x601019,alpha:.62,width:18,cap:'round'});
  }
  // (B08) the body carries its cause and its record's id, for gore.js's wounds; (B15, B18) a physical death's pose: the hands where
  // they fell, the hat if it stayed on
  const body=new PlayerView(r.appearance,r.equipment);body.__cause=r.cause;body.__key=r.id;body.update(0,false);
  body.deathPose(1,0,true,r.hands?{ph:1,hands:r.hands.map(h=>({x:h[0],y:h[1]})),hatOn:r.hatOn,gearHeld:0,rho:0}:null);
  body.position.set(r.x,r.y);body.rotation=r.angle;body.scale.set(r.scaleX,r.scaleY);body.tint=r.cause==='Smiler'?0x9b8585:0xc8b1a4;this.addChild(body);
  // (B10, B11) the dropped light, drawn from its equipment parts (a headlamp stays on the head)
  if(r.equipment.kind!=='headlamp'){
   const gear=new Graphics();
   drawGear(gear,migrateKind(r.equipment.kind) as LightKind,partsFor(r.equipment,migrateKind(r.equipment.kind) as LightKind),parseInt(r.equipment.color.slice(1),16),false,0,-1);
   gear.position.set(r.dropped.x,r.dropped.y);gear.rotation=r.dropped.angle;this.addChild(gear);
  }
  if(r.appearance.hat!=='none'&&!(r.hands&&r.hatOn)){
   const color=r.appearance.hat==='hardhat'?0xd6ac38:r.appearance.hat==='beanie'?0x9e5963:0x527480;
   const hat=new Graphics().ellipse(0,0,16,13).fill(color).stroke({color:0x252921,width:2});
   if(r.appearance.hat!=='beanie')hat.ellipse(0,-11,10,4).fill(color);
   hat.position.set(r.hat.x,r.hat.y);hat.rotation=r.hat.angle;this.addChild(hat);
  }
  // (B32, owner G.I.B.) gore.js caches the settled remains
  if(window.__gore&&window.__gore.cached)window.__gore.cached(this,r);
 }
}
