/* (Stage 3H continuation C4c, M-003) Level 0's definition is L.O.S.T.'s src/frameworks/lost/shared/level0.json, which the server reads
 * too: its values are the LEVEL0_ constants (level-data.cjs; the build writes each value where its name is). The cells' 96 px are the
 * engine's, not the level's. */
export const TILE=96, COLS=LEVEL0_COLS, ROWS=LEVEL0_ROWS;
export type Rect={x:number,y:number,w:number,h:number};
/* Level 0 refinement v3 (lineage B02, owner L.O.S.T.): the map grows from 64 x 46 to 96 x 72 cells. The nine v11 areas move and
 * change size; ARCH GALLERY, PILLAR HALL and DEEP CARPET are new; FALSE EXIT became SEGMENTED ROOMS, DIM ROOMS the BLACKOUT ZONE and
 * FAR ROOMS the RED ROOMS. */
export const rooms=LEVEL0_ROOMS;
export const cells=new Uint8Array(COLS*ROWS);
/* (B02) carving and blocking ignore cells outside the map */
function carve(x:number,y:number,w:number,h:number){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(i>=0&&j>=0&&i<COLS&&j<ROWS)cells[j*COLS+i]=1;}
function block(x:number,y:number,w:number,h:number){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(i>=0&&j>=0&&i<COLS&&j<ROWS)cells[j*COLS+i]=0;}
rooms.forEach(r=>carve(r.x,r.y,r.w,r.h));
// Offset openings connect rooms whose partitions seem to repeat incorrectly. (B02: the corridors of the 96 x 72 map)
LEVEL0_CORRIDORS.forEach(r=>carve(...r as [number,number,number,number]));
// Partitions inside the rooms: half walls and blind alcoves. (B02)
LEVEL0_PARTITIONS.forEach(r=>block(...r as [number,number,number,number]));
// Doorways through those partitions. (B02)
LEVEL0_DOORWAYS.forEach(r=>carve(...r as [number,number,number,number]));
// The shared world's own openings: the damaged walls and pass-through windows of world.js (window.WORLD; lineage B14).
window.WORLD.carve(cells,COLS);
// A grid of impossible floor voids in the LONG ROOM. (B02: ten of them)
export const pitCells=LEVEL0_PITS;
for(const p of pitCells)block(p.x,p.y,1,1);
export const solids:Rect[]=[];
for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(!cells[y*COLS+x])solids.push({x:x*TILE,y:y*TILE,w:TILE,h:TILE});
// The PILLAR HALL's nine pillars, solid blocks inside open floor. (B02)
export const crates:Rect[]=[];
for(const x of LEVEL0_PILLAR_COLUMNS)for(const y of LEVEL0_PILLAR_ROWS)crates.push({x:x*TILE-LEVEL0_PILLAR_HALF,y:y*TILE-LEVEL0_PILLAR_HALF,w:LEVEL0_PILLAR_SIZE,h:LEVEL0_PILLAR_SIZE});
// The working ceiling fixtures: one shared truth for the page and the server, world.js's WORLD.lamps (lineage B27).
export const lights:{x:number,y:number}[]=window.WORLD.lamps(rooms,(x,y)=>x>=0&&y>=0&&x<COLS&&y<ROWS&&!!cells[y*COLS+x],crates,COLS,ROWS);
export const spawn={x:LEVEL0_SPAWN_X*TILE,y:LEVEL0_SPAWN_Y*TILE};
/* (B02) the first blackout after 36 s, the next ones 44 to 74 s apart */
export const lighting={blackout:false,elapsed:0,next:LEVEL0_BLACKOUT_FIRST,duration:0,number:0};
export function resetLighting(){Object.assign(lighting,{blackout:false,elapsed:0,next:LEVEL0_BLACKOUT_FIRST,duration:0,number:0});}
export function stepLighting(dt:number){lighting.elapsed+=dt;if(!lighting.blackout&&lighting.elapsed>=lighting.next){lighting.blackout=true;lighting.elapsed=0;lighting.duration=LEVEL0_BLACKOUT_LENGTH+lighting.number%LEVEL0_BLACKOUT_LENGTH_CYCLE;lighting.number++;return 'start';}if(lighting.blackout&&lighting.elapsed>=lighting.duration){lighting.blackout=false;lighting.elapsed=0;lighting.next=LEVEL0_BLACKOUT_GAP+lighting.number%LEVEL0_BLACKOUT_GAP_CYCLE*LEVEL0_BLACKOUT_GAP_STEP;return 'end';}return null;}
export const isFloor=(x:number,y:number)=> x>=0&&y>=0&&x<COLS&&y<ROWS&&cells[y*COLS+x]===1;
/* the walls and pillars around a point, and (B14) the shared world's props there: world.js's WORLD.addNear */
export function nearby(x:number,y:number):Rect[]{const out:Rect[]=[];const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);for(let j=ty-1;j<=ty+1;j++)for(let i=tx-1;i<=tx+1;i++)if(!isFloor(i,j))out.push({x:i*TILE,y:j*TILE,w:TILE,h:TILE});for(const c of crates)if(Math.abs(c.x-x)<250&&Math.abs(c.y-y)<250)out.push(c);return window.WORLD.addNear(out,x,y);}
const pits=new Set(pitCells.map(p=>p.y*COLS+p.x));
export const blocksSight=(x:number,y:number)=>x<0||y<0||x>=COLS||y>=ROWS||!isFloor(x,y)&&!pits.has(y*COLS+x);
// Walk only the grid cells crossed by a ray. Floor openings do not block light.
export function rayDistance(x:number,y:number,angle:number,max:number){
 const dx=Math.cos(angle),dy=Math.sin(angle),sx=dx>=0?1:-1,sy=dy>=0?1:-1;
 let tx=Math.floor(x/TILE),ty=Math.floor(y/TILE),distance=max;
 if(blocksSight(tx,ty))return 0;
 const deltaX=Math.abs(dx)<1e-10?Infinity:TILE/Math.abs(dx),deltaY=Math.abs(dy)<1e-10?Infinity:TILE/Math.abs(dy);
 let nextX=Math.abs(dx)<1e-10?Infinity:((tx+(sx>0?1:0))*TILE-x)/dx;
 let nextY=Math.abs(dy)<1e-10?Infinity:((ty+(sy>0?1:0))*TILE-y)/dy;
 while(Math.min(nextX,nextY)<distance){
  if(Math.abs(nextX-nextY)<1e-8){
   const hit=nextX;if(blocksSight(tx+sx,ty)||blocksSight(tx,ty+sy)){distance=hit;break;}
   tx+=sx;ty+=sy;nextX+=deltaX;nextY+=deltaY;if(blocksSight(tx,ty)){distance=hit;break;}
  }else if(nextX<nextY){const hit=nextX;tx+=sx;nextX+=deltaX;if(blocksSight(tx,ty)){distance=hit;break;}}
  else{const hit=nextY;ty+=sy;nextY+=deltaY;if(blocksSight(tx,ty)){distance=hit;break;}}
 }
 for(const r of crates){
  if(Math.abs(dx)<1e-10&&(x<r.x||x>r.x+r.w)||Math.abs(dy)<1e-10&&(y<r.y||y>r.y+r.h))continue;
  const a=Math.abs(dx)<1e-10?-Infinity:(r.x-x)/dx,b=Math.abs(dx)<1e-10?Infinity:(r.x+r.w-x)/dx;
  const c=Math.abs(dy)<1e-10?-Infinity:(r.y-y)/dy,d=Math.abs(dy)<1e-10?Infinity:(r.y+r.h-y)/dy;
  const near=Math.max(Math.min(a,b),Math.min(c,d)),far=Math.min(Math.max(a,b),Math.max(c,d));
  if(far>=Math.max(0,near)&&near>=0)distance=Math.min(distance,near);
 }
 return Math.max(0,distance);
}
