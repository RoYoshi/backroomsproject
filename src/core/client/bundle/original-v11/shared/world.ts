export const TILE=96, COLS=64, ROWS=46;
export type Rect={x:number,y:number,w:number,h:number};
export const rooms=[
 {x:3,y:15,w:16,h:17,name:'YELLOW HALL',code:'01'},
 {x:22,y:14,w:18,h:18,name:'REPEATING ROOMS',code:'02'},
 {x:44,y:15,w:17,h:17,name:'FALSE EXIT',code:'03'},
 {x:23,y:3,w:17,h:9,name:'HUMMING ROOMS',code:'04'},
 {x:4,y:3,w:15,h:9,name:'NORTH ROOMS',code:'05'},
 {x:44,y:3,w:16,h:9,name:'LONG ROOM',code:'06'},
 {x:4,y:35,w:17,h:8,name:'DIM ROOMS',code:'07'},
 {x:25,y:35,w:16,h:8,name:'DAMP ROOMS',code:'08'},
 {x:45,y:35,w:16,h:8,name:'FAR ROOMS',code:'09'}
];
export const cells=new Uint8Array(COLS*ROWS);
function carve(x:number,y:number,w:number,h:number){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)cells[j*COLS+i]=1;}
function block(x:number,y:number,w:number,h:number){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)cells[j*COLS+i]=0;}
rooms.forEach(r=>carve(r.x,r.y,r.w,r.h));
// Offset openings connect rooms whose partitions seem to repeat incorrectly.
[[18,20,5,3],[39,24,6,3],[9,11,3,5],[29,11,3,4],[51,11,3,5],
 [11,31,3,5],[30,31,3,5],[52,31,3,5],[18,7,6,3],[39,7,6,3],
 [19,37,7,3],[40,38,6,3]].forEach(r=>carve(...r as [number,number,number,number]));
// Half walls, blind alcoves, and openings wide enough for the character.
[[8,18,1,7],[14,22,1,7],[28,16,1,6],[35,24,1,6],[49,17,1,7],
 [55,23,1,7],[7,7,7,1],[28,6,8,1],[47,7,8,1],[8,38,6,1],
 [29,38,7,1],[49,38,8,1]].forEach(r=>block(...r as [number,number,number,number]));
// A column gallery, a grid of impossible floor voids, and broken partitions.
for(const x of [5,10,16])for(const y of [17,29])block(x,y,1,1);
for(const x of [25,32,38])for(const y of [17,29])block(x,y,1,1);
export const pitCells=[{x:47,y:5},{x:50,y:5},{x:53,y:5},{x:56,y:5},{x:47,y:9},{x:50,y:9},{x:53,y:9},{x:56,y:9}];
for(const p of pitCells)block(p.x,p.y,1,1);
export const solids:Rect[]=[];
for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(!cells[y*COLS+x])solids.push({x:x*TILE,y:y*TILE,w:TILE,h:TILE});
export const crates:Rect[]=[];
export const lights:{x:number,y:number}[]=[];
rooms.forEach((r,index)=>{if(index===6)return;for(let x=r.x+2;x<r.x+r.w-1;x+=5)for(let y=r.y+2;y<r.y+r.h-1;y+=5)if(cells[y*COLS+x])lights.push({x:(x+.5)*TILE,y:(y+.5)*TILE});});
export const spawn={x:10*TILE,y:23*TILE};
export const lighting={blackout:false,elapsed:0,next:31,duration:0,number:0};
export function resetLighting(){Object.assign(lighting,{blackout:false,elapsed:0,next:31,duration:0,number:0});}
export function stepLighting(dt:number){lighting.elapsed+=dt;if(!lighting.blackout&&lighting.elapsed>=lighting.next){lighting.blackout=true;lighting.elapsed=0;lighting.duration=4.5+lighting.number%3;lighting.number++;return 'start';}if(lighting.blackout&&lighting.elapsed>=lighting.duration){lighting.blackout=false;lighting.elapsed=0;lighting.next=37+lighting.number%4*9;return 'end';}return null;}
export const arrival={x:8*TILE,y:21*TILE,w:4*TILE,h:4*TILE};
export const isFloor=(x:number,y:number)=> x>=0&&y>=0&&x<COLS&&y<ROWS&&cells[y*COLS+x]===1;
export function nearby(x:number,y:number):Rect[]{const out:Rect[]=[];const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);for(let j=ty-1;j<=ty+1;j++)for(let i=tx-1;i<=tx+1;i++)if(!isFloor(i,j))out.push({x:i*TILE,y:j*TILE,w:TILE,h:TILE});for(const c of crates)if(Math.abs(c.x-x)<250&&Math.abs(c.y-y)<250)out.push(c);return out;}
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
