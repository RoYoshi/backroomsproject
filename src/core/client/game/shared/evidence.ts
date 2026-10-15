import {spawn} from './world';
export type Trace={x:number;y:number;found:boolean;room:string};
/* (lineage B09, owner BPP) the level has no evidence traces any more: the list is empty (v11 placed one in each of eight rooms), so
   none is drawn or found, and the evidence count went from the HUD (main.ts) */
export const traces:Trace[]=[];
export function resetTraces(){for(const t of traces)t.found=false;}
export function collected(){return traces.reduce((n,t)=>n+Number(t.found),0);}
export function takeTrace(x:number,y:number){const t=traces.find(t=>!t.found&&Math.hypot(x-t.x,y-t.y)<42);if(t){t.found=true;return t;}return null;}
export const entrance=spawn;
