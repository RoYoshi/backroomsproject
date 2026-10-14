import {TILE,rooms,nearby,spawn} from './world';
export type Trace={x:number;y:number;found:boolean;room:string};
// The fixed locations make every room worth learning and allow a clear finish.
const roomOrder=[1,2,3,4,5,6,7,8];
export const traces:Trace[]=roomOrder.map(i=>{
 const r=rooms[i];let x=(r.x+r.w*.48)*TILE,y=(r.y+r.h*.55)*TILE;
 // Shift deterministic positions away from crates and walls.
 if(nearby(x,y).some(c=>Math.hypot(x-Math.max(c.x,Math.min(x,c.x+c.w)),y-Math.max(c.y,Math.min(y,c.y+c.h)))<48)){
  x=(r.x+r.w*.7)*TILE;y=(r.y+r.h*.35)*TILE;
 }
 return {x,y,found:false,room:r.name};
});
export function resetTraces(){for(const t of traces)t.found=false;}
export function collected(){return traces.reduce((n,t)=>n+Number(t.found),0);}
export function takeTrace(x:number,y:number){const t=traces.find(t=>!t.found&&Math.hypot(x-t.x,y-t.y)<42);if(t){t.found=true;return t;}return null;}
export const entrance=spawn;
