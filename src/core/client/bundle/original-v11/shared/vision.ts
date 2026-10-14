import {carriedLightAt,type LightEquipment} from './equipment';
import {TILE,COLS,ROWS,blocksSight,rayDistance,lights,lighting} from './world';
export const smooth=(a:number,b:number,value:number)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};
export const rangeFade=(distance:number)=>1-smooth(420,670,distance);
export function beamExposure(distance:number,offset:number,flash:boolean){
 return carriedLightAt({x:0,y:0,angle:0},{x:Math.cos(offset)*distance,y:Math.sin(offset)*distance},flash);
}
const corners:{x:number,y:number}[]=[];
for(let y=0;y<=ROWS;y++)for(let x=0;x<=COLS;x++){
 const nw=blocksSight(x-1,y-1),ne=blocksSight(x,y-1),sw=blocksSight(x-1,y),se=blocksSight(x,y);
 const count=Number(nw)+Number(ne)+Number(sw)+Number(se);
 if(count===1||count===3||count===2&&nw===se)corners.push({x:x*TILE,y:y*TILE});
}
// Rays on either side of each corner preserve partial reveals through doorways.
export function visibilityPolygon(x:number,y:number,radius=700,wallDepth=0){
 const angles:number[]=[];for(let i=0;i<96;i++)angles.push(i/96*Math.PI*2-Math.PI);
 for(const p of corners){if(Math.hypot(p.x-x,p.y-y)>radius+TILE)continue;const a=Math.atan2(p.y-y,p.x-x);angles.push(a-.00002,a,a+.00002);}
 angles.sort((a,b)=>a-b);const points:number[]=[];
 for(const a of angles){const hit=rayDistance(x,y,a,radius),d=Math.min(radius,hit+(hit<radius?wallDepth:0));points.push(x+Math.cos(a)*d,y+Math.sin(a)*d);}
 return points;
}
export function exposureAt(x:number,y:number,observer:{x:number,y:number,angle:number,equipment?:LightEquipment},flash:boolean){
 const d=Math.hypot(x-observer.x,y-observer.y);
 let strength=Math.max((1-smooth(28,100,d))*.5,carriedLightAt(observer,{x,y},flash));
 if(!lighting.blackout)for(const l of lights){
  const ld=Math.hypot(x-l.x,y-l.y);if(ld>=380)continue;
  if(rayDistance(l.x,l.y,Math.atan2(y-l.y,x-l.x),ld+1)>=ld-.5)strength=Math.max(strength,(1-smooth(40,380,ld))*.43);
 }
 return rangeFade(d)*(.12+strength*.88);
}
