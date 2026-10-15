export const TILE=96, COLS=96, ROWS=72;
export type Rect={x:number,y:number,w:number,h:number};
/* Level 0 refinement v3 (lineage B02, owner L.O.S.T.): the map grows from 64 x 46 to 96 x 72 cells. The nine v11 areas move and
 * change size; ARCH GALLERY, PILLAR HALL and DEEP CARPET are new; FALSE EXIT became SEGMENTED ROOMS, DIM ROOMS the BLACKOUT ZONE and
 * FAR ROOMS the RED ROOMS. */
export const rooms=[
 {x:3,y:27,w:18,h:18,name:'YELLOW HALL',code:'01'},
 {x:25,y:25,w:19,h:20,name:'REPEATING ROOMS',code:'02'},
 {x:49,y:28,w:18,h:17,name:'SEGMENTED ROOMS',code:'03'},
 {x:25,y:7,w:20,h:12,name:'HUMMING ROOMS',code:'04'},
 {x:4,y:7,w:17,h:12,name:'NORTH ROOMS',code:'05'},
 {x:50,y:7,w:25,h:11,name:'LONG ROOM',code:'06'},
 {x:4,y:50,w:18,h:13,name:'BLACKOUT ZONE',code:'07'},
 {x:27,y:51,w:18,h:12,name:'DAMP ROOMS',code:'08'},
 {x:51,y:51,w:18,h:12,name:'RED ROOMS',code:'09'},
 {x:73,y:27,w:19,h:18,name:'ARCH GALLERY',code:'10'},
 {x:77,y:7,w:15,h:14,name:'PILLAR HALL',code:'11'},
 {x:73,y:51,w:19,h:13,name:'DEEP CARPET',code:'12'}
];
export const cells=new Uint8Array(COLS*ROWS);
/* (B02) carving and blocking ignore cells outside the map */
function carve(x:number,y:number,w:number,h:number){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(i>=0&&j>=0&&i<COLS&&j<ROWS)cells[j*COLS+i]=1;}
function block(x:number,y:number,w:number,h:number){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(i>=0&&j>=0&&i<COLS&&j<ROWS)cells[j*COLS+i]=0;}
rooms.forEach(r=>carve(r.x,r.y,r.w,r.h));
// Offset openings connect rooms whose partitions seem to repeat incorrectly. (B02: the corridors of the 96 x 72 map)
[[20,33,6,4],[43,34,7,4],[66,34,8,4],[21,56,7,4],[44,57,8,4],[68,56,6,4],[19,11,7,4],[44,11,7,4],[74,11,4,4],
 [10,18,4,10],[32,18,4,8],[57,17,4,12],[82,20,4,8],[10,44,4,7],[33,44,4,8],[58,44,4,8],[82,44,4,8]].forEach(r=>carve(...r as [number,number,number,number]));
// Partitions inside the rooms: half walls and blind alcoves. (B02)
[[9,28,1,8],[9,38,1,6],[15,32,1,12],[30,26,1,7],[30,35,1,9],[37,26,1,10],[37,38,1,6],[26,31,6,1],[34,39,9,1],
 [54,29,1,8],[54,39,1,5],[61,29,1,6],[61,37,1,7],[50,34,5,1],[57,40,9,1],[31,8,1,8],[38,10,1,8],[26,13,6,1],
 [34,15,10,1],[10,8,1,8],[16,10,1,8],[5,13,6,1],[56,8,1,7],[64,10,1,7],[71,8,1,8],[51,13,6,1],[59,15,6,1],
 [10,51,1,9],[16,53,1,9],[5,56,6,1],[33,52,1,10],[40,54,1,8],[28,57,6,1],[57,52,1,10],[64,54,1,8],[52,57,6,1],
 [79,28,1,7],[79,38,1,6],[86,31,1,12],[74,35,6,1],[83,8,1,5],[83,15,1,5],[79,52,1,10],[86,54,1,8],[74,58,6,1]].forEach(r=>block(...r as [number,number,number,number]));
// Doorways through those partitions. (B02)
[[9,35,1,2],[15,36,1,2],[30,32,1,3],[37,35,1,3],[31,31,2,1],[39,39,2,1],[54,36,1,3],[61,34,1,3],[53,34,2,1],
 [62,40,2,1],[31,12,1,2],[38,13,1,2],[30,13,2,1],[39,15,2,1],[10,12,1,2],[16,14,1,2],[9,13,2,1],[56,12,1,2],
 [64,13,1,2],[71,12,1,2],[55,13,2,1],[63,15,2,1],[10,55,1,2],[16,57,1,2],[9,56,2,1],[33,56,1,2],[40,58,1,2],
 [32,57,2,1],[57,56,1,2],[64,58,1,2],[56,57,2,1],[79,34,1,2],[86,36,1,2],[78,35,2,1],[83,12,1,2],[83,17,1,2],
 [79,56,1,2],[86,58,1,2],[78,58,2,1]].forEach(r=>carve(...r as [number,number,number,number]));
// The shared world's own openings: the damaged walls and pass-through windows of world.js (window.WORLD; lineage B14).
window.WORLD.carve(cells,COLS);
// A grid of impossible floor voids in the LONG ROOM. (B02: ten of them)
export const pitCells=[{x:53,y:9},{x:57,y:9},{x:61,y:9},{x:65,y:9},{x:69,y:9},{x:53,y:15},{x:57,y:15},{x:61,y:15},{x:65,y:15},{x:69,y:15}];
for(const p of pitCells)block(p.x,p.y,1,1);
export const solids:Rect[]=[];
for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(!cells[y*COLS+x])solids.push({x:x*TILE,y:y*TILE,w:TILE,h:TILE});
// The PILLAR HALL's nine pillars, solid blocks inside open floor. (B02)
export const crates:Rect[]=[];
for(const x of [79.5,84.5,89.5])for(const y of [9.5,14.5,19.5])crates.push({x:x*TILE-28,y:y*TILE-28,w:56,h:56});
// The working ceiling fixtures: one shared truth for the page and the server, world.js's WORLD.lamps (lineage B27).
export const lights:{x:number,y:number}[]=window.WORLD.lamps(rooms,(x,y)=>x>=0&&y>=0&&x<COLS&&y<ROWS&&!!cells[y*COLS+x],crates,COLS,ROWS);
export const spawn={x:10*TILE,y:34*TILE};
/* (B02) the first blackout after 36 s, the next ones 44 to 74 s apart */
export const lighting={blackout:false,elapsed:0,next:36,duration:0,number:0};
export function resetLighting(){Object.assign(lighting,{blackout:false,elapsed:0,next:36,duration:0,number:0});}
export function stepLighting(dt:number){lighting.elapsed+=dt;if(!lighting.blackout&&lighting.elapsed>=lighting.next){lighting.blackout=true;lighting.elapsed=0;lighting.duration=4.5+lighting.number%3;lighting.number++;return 'start';}if(lighting.blackout&&lighting.elapsed>=lighting.duration){lighting.blackout=false;lighting.elapsed=0;lighting.next=44+lighting.number%4*10;return 'end';}return null;}
export const arrival={x:8*TILE,y:21*TILE,w:4*TILE,h:4*TILE};
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
