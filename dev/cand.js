const sim=require('./sim_geo.js')();const D=sim.debug;const {kc,FBW,FBH,Oc}=D;
const fl=(x,y)=>x>=0&&y>=0&&x<FBW&&y<FBH&&kc[y*FBW+x]===1;
const roomOf=(x,y)=>Oc.findIndex(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
// low props: horizontal 3x1 at (x,y) needs rows y-2..y+2 free over cols x-1..x+3 ; vertical similar
const out=[];
for(let y=2;y<FBH-2;y++)for(let x=2;x<FBW-4;x++){
  let okH=true;for(let yy=y-2;yy<=y+2&&okH;yy++)for(let xx=x-1;xx<=x+3;xx++)if(!fl(xx,yy)){okH=false;break}
  if(okH)out.push({t:'H',x,y,room:roomOf(x,y)});
  let okV=true;for(let yy=y-1;yy<=y+3&&okV;yy++)for(let xx=x-2;xx<=x+2;xx++)if(!fl(xx,yy)){okV=false;break}
  if(okV)out.push({t:'V',x,y,room:roomOf(x,y)});
}
const byRoom={};for(const o of out){(byRoom[o.room]=byRoom[o.room]||[]).push(o)}
for(const r in byRoom){const a=byRoom[r];console.log('room',r,Oc[r]&&Oc[r].name,a.length,'e.g.',a.filter((_,i)=>i%Math.max(1,Math.floor(a.length/6))===0).slice(0,6).map(o=>o.t+'('+o.x+','+o.y+')').join(' '))}
// gaps: wall cell with floor on both sides (2 deep) along one axis and wall on both sides along the other
const gaps=[];
for(let y=2;y<FBH-2;y++)for(let x=2;x<FBW-2;x++){
  if(fl(x,y))continue;
  const ew=fl(x-1,y)&&fl(x-2,y)&&fl(x+1,y)&&fl(x+2,y)&&!fl(x,y-1)&&!fl(x,y+1);
  const ns=fl(x,y-1)&&fl(x,y-2)&&fl(x,y+1)&&fl(x,y+2)&&!fl(x-1,y)&&!fl(x+1,y);
  if(ew||ns)gaps.push({t:ew?'EW':'NS',x,y,room:roomOf(x-(ew?2:0),y-(ns?2:0))});
}
console.log('gaps',gaps.length);
for(const g of gaps)console.log(g.t,g.x,g.y,'room',g.room);
