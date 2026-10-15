import {nearby,spawn,rooms,TILE} from './world';
import {DEFAULT_LIGHT} from './equipment';
/* (lineage B02, owner S.P.A.C.E.) stamina, sprinting and exhaustion */
export const player={id:'local-wanderer',name:'Wanderer',equipment:{...DEFAULT_LIGHT},...spawn,vx:0,vy:0,angle:0,distance:0,stamina:100,sprinting:false,exhausted:false};
/* One fixed step of the local player's movement.  The page's movement script (move.js, S.P.A.C.E., window.__mv) steps the player when
 * it is loaded (lineage B14); what follows is the bundle's own movement, used without it (B02):
 *   - a sprint drains 23 stamina a second; at 0.1 the player is exhausted until stamina is back to 32; stamina returns at 12 a second
 *     while moving and 21 standing;
 *   - speed: 278 sprinting, 158 exhausted, 172 otherwise; DEEP CARPET (room 11) slows to 83 % and drains 4 more a second sprinting. */
export function step(dx:number,dy:number,sprint:boolean,dt:number){
 if(window.__mv)return window.__mv.step(dx,dy,sprint,dt);
 const length=Math.hypot(dx,dy),moving=length>0;
 if(length>0){dx/=length;dy/=length;}
 if(player.exhausted&&player.stamina>=32)player.exhausted=false;
 let sprinting=!!(sprint&&moving&&!player.exhausted&&player.stamina>.1);
 if(sprinting){player.stamina=Math.max(0,player.stamina-23*dt);if(player.stamina<=.1){player.exhausted=true;sprinting=false;}}
 else player.stamina=Math.min(100,player.stamina+(moving?12:21)*dt);
 player.sprinting=sprinting;
 let speed=sprinting?278:player.exhausted?158:172;
 const deep=rooms[11],onDeepCarpet=player.x>=deep.x*TILE&&player.x<(deep.x+deep.w)*TILE&&player.y>=deep.y*TILE&&player.y<(deep.y+deep.h)*TILE;
 if(onDeepCarpet){speed*=.83;if(sprinting){player.stamina=Math.max(0,player.stamina-4*dt);if(player.stamina<=.1){player.exhausted=true;player.sprinting=false;}}}
 const rate=1-Math.exp(-18*dt);player.vx+=(dx*speed-player.vx)*rate;player.vy+=(dy*speed-player.vy)*rate;const oldX=player.x,oldY=player.y;for(const axis of ['x','y'] as const){player[axis]+=player[axis==='x'?'vx':'vy']*dt;for(const r of nearby(player.x,player.y)){const cx=Math.max(r.x,Math.min(player.x,r.x+r.w)),cy=Math.max(r.y,Math.min(player.y,r.y+r.h));const ax=player.x-cx,ay=player.y-cy,dist=Math.hypot(ax,ay);if(dist<15){if(dist>0){player.x+=ax/dist*(15-dist);player.y+=ay/dist*(15-dist);}else player[axis]=axis==='x'?oldX:oldY;}}}player.distance+=Math.hypot(player.x-oldX,player.y-oldY);}
