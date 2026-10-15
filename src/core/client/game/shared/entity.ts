import {rayDistance,TILE,lighting} from './world';
import {clearPoint,clearSegment,findPath,moveCircle,type Point} from './navigation';
import {carriedLightAt,type LightEquipment} from './equipment';
export type EntityState='patrol'|'investigate'|'stalk'|'chase'|'search';
type Wanderer=Point&{vx:number;vy:number;angle:number;equipment?:LightEquipment;sprinting?:boolean};
/* (lineage B02, owner N.A.N.I.) the Hound's den and patrol on the 96 x 72 map, and a 14 s grace at the start */
export const entity={x:82*TILE,y:34*TILE,angle:Math.PI,state:'patrol' as EntityState,distance:0,grace:14,caught:false,caughtBy:'' as ''|'Hound'|'Smiler',pressure:0,adaptation:0,memory:{x:82*TILE,y:34*TILE,vx:0,vy:0,age:100,confidence:0}};
const patrol=[{x:82*TILE,y:34*TILE},{x:59*TILE,y:35*TILE},{x:84*TILE,y:56*TILE},{x:59*TILE,y:12*TILE}];
let patrolIndex=0,goal:Point={...patrol[0]},route:Point[]=[],repath=0,sense=0,clock=0,lost=0,searchTime=0,heardCooldown=0,stare=0,stareCooldown=0,scan=0,searchLeg=0,flankUntil=0,nextFlank=0;
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function hasLine(from:Point,to:Point,max=700){const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy);return d<max&&rayDistance(from.x,from.y,Math.atan2(dy,dx),d+1)>=d-.5;}
function transition(state:EntityState,target?:Point){if(entity.state!==state){entity.state=state;route=[];repath=0;searchTime=0;scan=0;}if(target)goal={...target};}
function reachableNear(center:Point,angle:number,radius:number){for(const offset of [0,.6,-.6,1.2,-1.2,Math.PI]){const p={x:center.x+Math.cos(angle+offset)*radius,y:center.y+Math.sin(angle+offset)*radius};if(clearPoint(p.x,p.y)&&findPath(entity,p).length)return p;}return {x:center.x,y:center.y};}
export function resetEntity(){Object.assign(entity,{x:82*TILE,y:34*TILE,angle:Math.PI,state:'patrol',distance:0,grace:14,caught:false,caughtBy:'',pressure:0,adaptation:0});Object.assign(entity.memory,{x:entity.x,y:entity.y,vx:0,vy:0,age:100,confidence:0});patrolIndex=0;goal={...patrol[0]};route=[];repath=0;sense=0;clock=0;lost=0;searchTime=0;heardCooldown=0;stare=0;stareCooldown=0;scan=0;searchLeg=0;nextFlank=0;flankUntil=0;resetSmilers();}
// Respawning a wanderer does not erase the world's hunters or their memory.
export function resumeEntities(){entity.caught=false;entity.caughtBy='';entity.grace=5;transition('search',entity.memory);searchLeg=0;smilers.forEach(s=>{s.state='search';s.lost=0;s.repath=0;});}
export function canSee(target:Wanderer,flash=true){
 const d=Math.hypot(target.x-entity.x,target.y-entity.y),lit=carriedLightAt(target,entity,flash)>.025;
 const facing=Math.abs(angleDelta(Math.atan2(target.y-entity.y,target.x-entity.x),entity.angle));
 return hasLine(entity,target,lit?560:lighting.blackout?270:460)&&(d<85||facing<1.4||lit&&d<360);
}
export function updateEntity(target:Wanderer,sprinting:boolean,dt:number,flash=true){
 if(entity.caught)return;clock+=dt;entity.grace=Math.max(0,entity.grace-dt);sense-=dt;repath-=dt;heardCooldown-=dt;stareCooldown=Math.max(0,stareCooldown-dt);entity.memory.age+=dt;
 if(sense<=0){sense=.12;const sees=entity.grace<=0&&canSee(target,flash),d=Math.hypot(target.x-entity.x,target.y-entity.y);
  if(sees){
   Object.assign(entity.memory,{x:target.x,y:target.y,vx:target.vx,vy:target.vy,age:0,confidence:1});lost=0;searchLeg=0;
   // (B02) a Hound that sees the wanderer chases: v11's flank (a stalk to one side while it is watched) is gone. B02 also computes
   // here whether the wanderer meets its eyes (facing it within .4 rad, not sprinting), and never reads it.
   transition('chase');
   if(entity.state==='chase'){
    const intercept={x:target.x+target.vx*.42,y:target.y+target.vy*.42};goal=clearPoint(intercept.x,intercept.y)?intercept:{x:target.x,y:target.y};
   }
  }else{
   lost+=.12;entity.memory.confidence=Math.max(0,entity.memory.confidence-.015);
   if((entity.state==='chase'||entity.state==='stalk')&&lost>.42){transition('search',entity.memory);searchLeg=0;}
   const moving=Math.hypot(target.vx,target.vy),hearing=sprinting?850:260;
   if(entity.grace<=0&&moving>38&&d<hearing&&heardCooldown<=0&&entity.state!=='chase'){
    heardCooldown=.85;const soundPath=findPath(entity,target);let length=0,last:Point=entity;for(const p of soundPath){length+=Math.hypot(p.x-last.x,p.y-last.y);last=p;}
    if(soundPath.length&&length<hearing){
     // Sound gives a coarse location, not a continuous fix through walls.
     const heard={x:(Math.floor(target.x/(TILE/2))+.5)*(TILE/2),y:(Math.floor(target.y/(TILE/2))+.5)*(TILE/2)};
     if(clearPoint(heard.x,heard.y)){Object.assign(entity.memory,{...heard,vx:0,vy:0,age:0,confidence:.55});transition('investigate',heard);searchLeg=0;}
    }
   }
  }
 }
 if(entity.state==='search'||entity.state==='investigate'){searchTime+=dt;if(searchTime>14){patrolIndex=(patrolIndex+1)%patrol.length;transition('patrol',patrol[patrolIndex]);}}
 const arrived=Math.hypot(goal.x-entity.x,goal.y-entity.y)<33;
 if(arrived&&entity.state!=='chase'&&entity.state!=='stalk'){
  scan+=dt;entity.angle+=Math.sin(scan*3.6)*dt*1.7;
  if(scan>(entity.state==='patrol'?.65:1.15)){
   scan=0;if(entity.state==='patrol'){patrolIndex=(patrolIndex+1)%patrol.length;goal={...patrol[patrolIndex]};}
   else if(++searchLeg<4){const direction=Math.atan2(entity.memory.vy,entity.memory.vx)+[0,.85,-.85,Math.PI][searchLeg%4];goal=reachableNear(entity.memory,direction,120+searchLeg*48);entity.state='search';}
   else{patrolIndex=(patrolIndex+1)%patrol.length;transition('patrol',patrol[patrolIndex]);}
   route=[];repath=0;
  }
 }else{
  if(repath<=0){repath=.4;route=findPath(entity,goal);}
  while(route.length&&Math.hypot(route[0].x-entity.x,route[0].y-entity.y)<19)route.shift();
  let waypoint=route[0];if(waypoint){
   for(let i=Math.min(route.length-1,6);i>0;i--)if(clearSegment(entity,route[i])){waypoint=route[i];break;}
   const dx=waypoint.x-entity.x,dy=waypoint.y-entity.y,angle=Math.atan2(dy,dx),turn=angleDelta(angle,entity.angle);entity.angle+=Math.max(-4*dt,Math.min(4*dt,turn));
   let speed=entity.state==='chase'?256+entity.pressure*30:entity.state==='stalk'?92:entity.state==='investigate'?158:entity.state==='search'?117:97;
   /* (B02) eye contact slows a chasing Hound: within 360 px, in sight, the wanderer facing it within .38 rad.  As shipped, the test
      also asks that the eye contact computed above be false - but the name it reads there is this waypoint, which is always set,
      so the slowdown never applies and the stare only decays.  Kept exactly so (FINDINGS M-029). */
   const d=Math.hypot(target.x-entity.x,target.y-entity.y),watched=d<360&&hasLine(target,entity)&&Math.abs(angleDelta(Math.atan2(entity.y-target.y,entity.x-target.x),target.angle))<.38&&!waypoint;
   if(watched&&entity.state==='chase'&&stareCooldown<=0){stare+=dt;speed*=.3+entity.adaptation*.1;if(stare>1.15){stare=0;stareCooldown=5;entity.adaptation=Math.min(3,entity.adaptation+1);}}
   else stare=Math.max(0,stare-dt*2);
   const travel=Math.min(Math.hypot(dx,dy),speed*dt*Math.max(.15,Math.cos(turn))),old={x:entity.x,y:entity.y};moveCircle(entity,Math.cos(entity.angle)*travel,Math.sin(entity.angle)*travel);entity.distance+=Math.hypot(entity.x-old.x,entity.y-old.y);
  }
 }
 if(entity.grace<=0&&Math.hypot(target.x-entity.x,target.y-entity.y)<34&&hasLine(entity,target)){entity.caught=true;entity.caughtBy='Hound';}
}
/* off (lineage B09): a Smiler slot the bundle does not move itself (the server's, drawn from its snapshots) */
/* (B14, owners BR-R and N.A.N.I.) a Smiler the server moves has the server's states too (PROVOKED, ATTACKING, WATCHING), and keeps the
   local one it would have had (ls) */
export type SmilerState='lurk'|'watch'|'stalk'|'pursue'|'search'|'return'|'PROVOKED'|'ATTACKING'|'WATCHING';
export type Smiler=Point&{off:boolean;origin:Point;angle:number;state:SmilerState;ls?:SmilerState;distance:number;route:Point[];repath:number;lost:number;notice:number;wait:number;memory:Point;goal:Point;side:number};
/* (B02, B09) five lairs: the first three the bundle's own Smilers, the last two the server's; (B21) 64 slots, the list repeated */
const smilerOrigins=[{x:6432,y:1152},{x:1632,y:5568},{x:8280,y:5640},{x:4248,y:5064},{x:3816,y:1032}];
for(let i=smilerOrigins.length;i<64;i++)smilerOrigins.push({...smilerOrigins[i%5]});
export const smilers:Smiler[]=smilerOrigins.map((p,i)=>({off:i>2,...p,origin:{...p},angle:0,state:'lurk',distance:0,route:[],repath:0,lost:0,notice:0,wait:0,memory:{...p},goal:{...p},side:i===0?1:-1}));
export function resetSmilers(){smilers.forEach((s,i)=>Object.assign(s,{...smilerOrigins[i],state:'lurk',angle:0,distance:0,route:[],repath:0,lost:0,notice:0,wait:0,memory:{...smilerOrigins[i]},goal:{...smilerOrigins[i]}}));}
export function updateSmilers(target:Wanderer,flash:boolean,dt:number){
 if(entity.caught)return;
 for(const s of smilers){
  if(s.off)continue;
  s.repath-=dt;s.wait+=dt;const d=Math.hypot(target.x-s.x,target.y-s.y),line=entity.grace<=0&&hasLine(s,target,560);
  // (B02) a Smiler notices fainter light and a sprint; it is watched when the wanderer faces it (within .48 rad), lit or not
  const beam=carriedLightAt(target,s,flash),seen=line&&(beam>.014||d<165||s.state!=='lurk'&&d<420||target.sprinting&&d<470);
  const watched=seen&&Math.abs(angleDelta(Math.atan2(s.y-target.y,s.x-target.x),target.angle))<.48;
  if(seen){
   s.memory={x:target.x,y:target.y};s.lost=0;
   if(s.state==='lurk'||s.state==='return'||s.state==='search'){s.state='watch';s.wait=0;s.notice=0;}
   s.notice+=dt;
   if(s.state==='watch'){
    s.angle+=angleDelta(Math.atan2(target.y-s.y,target.x-s.x),s.angle)*Math.min(1,dt*4);
    // (B02) a sprint, or looking away, or coming close starts the pursuit (a blackout no longer does; nor does it flank to a stalk)
    if(target.sprinting||(!watched&&s.notice>.48)||d<82){s.state='pursue';s.wait=0;}
   }
   if(s.state==='stalk'&&(!watched||s.wait>2.4)){s.state='pursue';s.wait=0;}
   // (B02) a pursuing Smiler stops to watch only a wanderer who walks, faces it and has no light
   if(s.state==='pursue'){s.goal={...s.memory};if(!target.sprinting&&watched&&!flash&&s.wait>.72&&d>125){s.state='watch';s.wait=0;}}
  }else{
   s.lost+=dt;s.notice=Math.max(0,s.notice-dt*.3);
   if(['pursue','stalk','watch'].includes(s.state)&&s.lost>.5){s.state='search';s.goal={...s.memory};s.repath=0;s.wait=0;}
   if(s.state==='search'&&s.lost>7){s.state='return';s.goal={...s.origin};s.repath=0;}
  }
  if(s.state==='lurk'){s.angle+=Math.sin(clock*.45+s.side)*dt*.12;continue;}
  if(s.state==='watch')continue;
  if(s.state==='return'&&Math.hypot(s.x-s.origin.x,s.y-s.origin.y)<25){s.state='lurk';s.route=[];continue;}
  if(s.state==='search'&&Math.hypot(s.x-s.goal.x,s.y-s.goal.y)<25){s.angle+=Math.sin(s.wait*2)*dt;continue;}
  if(s.repath<=0){s.route=findPath(s,s.goal);s.repath=.5;}
  while(s.route.length&&Math.hypot(s.route[0].x-s.x,s.route[0].y-s.y)<20)s.route.shift();
  const waypoint=s.route[0];if(!waypoint)continue;
  const angle=Math.atan2(waypoint.y-s.y,waypoint.x-s.x),turn=angleDelta(angle,s.angle);s.angle+=Math.max(-4*dt,Math.min(4*dt,turn));
  const speed=s.state==='pursue'?232+entity.pressure*18:s.state==='stalk'?92:112,old={x:s.x,y:s.y};moveCircle(s,Math.cos(s.angle)*speed*dt*Math.max(.2,Math.cos(turn)),Math.sin(s.angle)*speed*dt*Math.max(.2,Math.cos(turn)));s.distance+=Math.hypot(s.x-old.x,s.y-old.y);
  if(s.state==='pursue'&&d<29&&hasLine(s,target)){entity.caught=true;entity.caughtBy='Smiler';return;}
 }
}
