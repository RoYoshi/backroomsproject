import {carriedLightAt,type LightEquipment} from './equipment';
import {TILE,COLS,ROWS,blocksSight,rayDistance,lights,lighting,crates} from './world';
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

/* =================================================================== the walls' receivers (lineage B28, B29, B30; owner BR-RoLE)
 * The sight polygon (visibilityPolygon) reaches a little way into the walls it meets (wallDepth): the band of wall the light falls on,
 * a "receiver".  At B28 that band became exact along each face of every wall run and pillar: each face has its own band depth, the bands
 * of two faces meet in a mitre at a convex corner (B29: an inner corner's two bands meet on the block's own diagonal; B30: a convex corner
 * seen with both faces is one L on its own diagonal), and a ray that ends on a face goes on through that face's band and, across a
 * mitre, into the band of the next face the player sees.  The faces and their bands are built once per band depth and kept. */

/* each face's band depth in px, by the side of the wall it faces (S N E W) and for pillars (pS pN pE pW) */
const BAND_DEPTH={S:46,N:23,E:27,W:27,pS:18,pN:12,pE:14,pW:14};
/* A face: a straight run of wall edge (or a pillar's side), with what a ray needs to cross its band.
 *   h        1 a horizontal face (along x), 0 a vertical one;  nx, ny: its outward normal;  L: its line (y for a horizontal face, else x)
 *   a0, a1   its extent along the line;  d: its band depth;  p: 1 a pillar's face
 *   s0, s1   the mitre shift at its start and end: > 0 a convex end (the band ends inside it, on the art's mitre), < 0 an inner corner
 *            (the band goes on into the corner block as far as it is deep)
 *   n0, n1   at a convex end, the face that meets it there (-1: none);  c0, c1: which end of that face (0 its start, 1 its end)
 *   built for a depth (buildBands): q its band's quad (outer start, outer end, inner end, inner start), E its edges as inward unit normals
 *   (mx, my, c: inside where mx x + my y >= c), b its bounding box, EF the edges of its whole band (as the art draws it), EV the edges with
 *   neither / the start / the end / both convex ends on its own diagonal instead of the art's mitre, Q45 the quad of the last
 *   during one polygon: v / w the polygon's stamp when it was seen / checked */
type Face={h:number;nx:number;ny:number;L:number;a0:number;a1:number;d:number;s0:number;s1:number;p:number;q:number[];E:Float64Array;EF:Float64Array;b:number[];v:number;w:number;n0:number;n1:number;c0:number;c1:number;EV:Float64Array[];Q45:number[]};
/* every face, with its indexes: D the band depth they were built for, S the polygon stamp, G the faces by 96 px cell, K by 768 px block */
type Faces=Face[]&{D:number;S:number;G:Map<number,number[]>;K:Map<number,number[]>};
let facesBuilt:Faces|null=null;
/* the last polygon without receivers (its point, radius, angles and ray lengths): the next one at the same point reuses its rays */
let lastRays:{e:number;t:number;n:number;A:Float64Array;H:Float64Array}|null=null;
/* how the last bandExit() left the band: 0 by the face, 3 its end's mitre, 6 the inner edge, 9 its start's mitre, 12 the seen stretch's end */
let exitSide=-1;

/* the faces (wall runs and pillar sides) once: outward normal, line, extent along it, band depth, and the mitre shift at each end
   (+ a convex end: the band ends inside it, on the art's mitre; - an inner corner: it goes on into the corner block as far as it is deep -
   the two faces' bands meet on the block's own diagonal, an L, at any depth); at a convex end the face meeting it there (n0 / n1, and
   which of its ends: c0 / c1) */
function wallFaces():Faces{
 if(facesBuilt)return facesBuilt;
 let faces=[] as unknown as Faces,wall=(x:number,y:number)=>!!blocksSight(x,y),depth=BAND_DEPTH,face=(h:number,nx:number,ny:number,L:number,a0:number,a1:number,d:number,s0:number,s1:number,p:number):Face=>({h,nx,ny,L,a0,a1,d,s0,s1,p,q:null as unknown as number[],E:null as unknown as Float64Array,EF:null as unknown as Float64Array,b:null as unknown as number[],v:0,w:0,n0:-1,n1:-1,c0:0,c1:0,EV:null as unknown as Float64Array[],Q45:null as unknown as number[]});
 for(let y=0;y<=ROWS;y++)for(let x=0;x<COLS;){                         // horizontal faces: runs of wall above or below a cell edge
  let up=wall(x,y-1),down=wall(x,y);
  if(up===down){x++;continue;}
  let end=x;
  while(end+1<COLS&&wall(end+1,y-1)===up&&wall(end+1,y)===down)end++;
  let ny=up?1:-1,wallRow=up?y-1:y,floorRow=up?y:y-1;
  let d=up?depth.S:depth.N;
  faces.push(face(1,0,ny,y*96,x*96,(end+1)*96,d,wall(x-1,wallRow)&&wall(x-1,floorRow)?-d:depth.W,wall(end+1,wallRow)&&wall(end+1,floorRow)?-d:depth.E,0));
  x=end+1;
 }
 for(let x=0;x<=COLS;x++)for(let y=0;y<ROWS;){                         // vertical faces
  let left=wall(x-1,y),right=wall(x,y);
  if(left===right){y++;continue;}
  let end=y;
  while(end+1<ROWS&&wall(x-1,end+1)===left&&wall(x,end+1)===right)end++;
  let nx=left?1:-1,wallCol=left?x-1:x,floorCol=left?x:x-1;
  let d=left?depth.E:depth.W;
  faces.push(face(0,nx,0,x*96,y*96,(end+1)*96,d,wall(wallCol,y-1)&&wall(floorCol,y-1)?-d:depth.N,wall(wallCol,end+1)&&wall(floorCol,end+1)?-d:depth.S,0));
  y=end+1;
 }
 for(let p of crates)faces.push(face(1,0,1,p.y+p.h,p.x,p.x+p.w,depth.pS,depth.pW,depth.pE,1),face(1,0,-1,p.y,p.x,p.x+p.w,depth.pN,depth.pW,depth.pE,1),face(0,1,0,p.x+p.w,p.y,p.y+p.h,depth.pE,depth.pN,depth.pS,1),face(0,-1,0,p.x,p.y,p.y+p.h,depth.pW,depth.pN,depth.pS,1));
 let ends=new Map<string,number>();                                     // the convex ends, by where they are and which way: who meets whom
 for(let i=0;i<faces.length;i++){
  let f=faces[i];
  for(let k=0;k<2;k++){
   if(!((k?f.s1:f.s0)>0))continue;
   let u=k?f.a1:f.a0,key=(f.h?u:f.L)+','+(f.h?f.L:u)+','+(f.h?k?-1:1:-f.nx)+','+(f.h?-f.ny:k?-1:1)+','+f.p,other=ends.get(key);
   if(other===undefined){ends.set(key,2*i+k);continue;}
   let j=other>>1,c=other&1,g=faces[j];
   if(g.h===f.h)continue;
   if(k){f.n1=j;f.c1=c;}else{f.n0=j;f.c0=c;}
   if(c){g.n1=i;g.c1=k;}else{g.n0=i;g.c0=k;}
  }
 }
 faces.D=0;faces.S=0;
 return facesBuilt=faces;
}
/* a face's band at depth D as a quad q (outer start, outer end, inner end, inner start), world px; its four edges E as inward unit
   normals (mx, my, c: inside where mx x + my y >= c); its bounding box b */
function faceBand(f:Pick<Face,'h'|'nx'|'ny'|'L'|'a0'|'a1'|'d'|'s0'|'s1'>,D:number){
 let i0=f.a0+f.s0*D/f.d,i1=f.a1-f.s1*D/f.d;
 if(i0>i1)i0=i1=(i0+i1)/2;
 let at=(u:number,t:number)=>f.h?[u,f.L-f.ny*t]:[f.L-f.nx*t,u],q=[...at(f.a0,0),...at(f.a1,0),...at(i1,D),...at(i0,D)],area=(q[2]-q[0])*(q[5]-q[1])-(q[3]-q[1])*(q[4]-q[0])+(q[4]-q[0])*(q[7]-q[1])-(q[5]-q[1])*(q[6]-q[0]),sign=area>=0?1:-1,E=new Float64Array(12);
 for(let k=0;k<4;k++){
  let ax=q[2*k],ay=q[2*k+1],bx=q[(2*k+2)%8],by=q[(2*k+3)%8],mx=-(by-ay)*sign,my=(bx-ax)*sign,len=Math.hypot(mx,my)||1;
  E[3*k]=mx/len;E[3*k+1]=my/len;E[3*k+2]=(mx*ax+my*ay)/len;
 }
 return {q,E,b:[Math.min(q[0],q[2],q[4],q[6]),Math.min(q[1],q[3],q[5],q[7]),Math.max(q[0],q[2],q[4],q[6]),Math.max(q[1],q[3],q[5],q[7])]};
}
/* every face's band at depth D (and its whole band as the art draws it, EF: its edges; EV: its edges with neither, the start, the end or
   both convex ends on its own diagonal instead of the art's mitre, Q45 the last one's quad), and two indexes of them: by 96 px cell (the
   cells each band covers) and by 768 px block */
function buildBands(faces:Faces,D:number){
 let byCell=new Map<number,number[]>(),byBlock=new Map<number,number[]>();
 for(let i=0;i<faces.length;i++){
  let f=faces[i],band=faceBand(f,D);
  f.q=band.q;f.E=band.E;f.b=band.b;
  f.EF=faceBand(f,Math.max(D,f.d)).E;
  let withEnds=(s0:number,s1:number)=>faceBand({h:f.h,nx:f.nx,ny:f.ny,L:f.L,a0:f.a0,a1:f.a1,d:f.d,s0,s1},D),t0=f.s0>0?f.d:f.s0,t1=f.s1>0?f.d:f.s1,both=withEnds(t0,t1);
  f.EV=[band.E,withEnds(t0,f.s1).E,withEnds(f.s0,t1).E,both.E];
  f.Q45=both.q;
  let b=f.b;
  for(let cy=Math.floor((b[1]-1)/96);cy<=Math.floor((b[3]+1)/96);cy++)for(let cx=Math.floor((b[0]-1)/96);cx<=Math.floor((b[2]+1)/96);cx++){let key=cy*4096+cx,list=byCell.get(key);if(!list)byCell.set(key,list=[]);list.push(i);}
  for(let cy=Math.floor(b[1]/768);cy<=Math.floor(b[3]/768);cy++)for(let cx=Math.floor(b[0]/768);cx<=Math.floor(b[2]/768);cx++){let key=cy*4096+cx,list=byBlock.get(key);if(!list)byBlock.set(key,list=[]);list.push(i);}
 }
 faces.G=byCell;faces.K=byBlock;faces.D=D;
}
/* the ray (ox, oy) + s (c, l), s >= t0: is it inside face f's band (and its along-face slab lo..hi), and where does it leave?  (exitSide:
   by which side: 0 the face, 3 its end's mitre, 6 the inner edge, 9 its start's mitre, 12 the seen stretch's end; edges: another set of
   edges, the face's whole band) */
function bandExit(f:Face,lo:number,hi:number,ox:number,oy:number,c:number,l:number,t0:number,edges?:Float64Array){
 exitSide=-1;
 let E=edges||f.E,px=ox+c*t0,py=oy+l*t0,T=Infinity,side=-1;
 for(let k=0;k<12;k+=3){
  let v=E[k]*px+E[k+1]*py-E[k+2];
  if(v<-1e-6)return -1;
  let w=E[k]*c+E[k+1]*l;
  if(w<0){let z=t0+v/-w;if(z<T){T=z;side=k;}}
 }
 let du=f.h?c:l,uu=f.h?px:py;
 if(uu<lo-.5||uu>hi+.5)return -1;
 if(du>0){let z=t0+(hi+.5-uu)/du;if(z<T){T=z;side=12;}}
 else if(du<0){let z=t0+(lo-.5-uu)/du;if(z<T){T=z;side=12;}}
 exitSide=side;
 return T;
}
/* is a face (its seen stretches) seen right to its end (0 its start, 1 its end)? */
function seenToEnd(stretches:number[][]|undefined,end:number){
 if(stretches)for(let v of stretches)if(end?v[1]>=1e9:v[0]<=-1e9)return true;
 return false;
}

// Rays on either side of each corner preserve partial reveals through doorways.  (B28) wallDepth > 0: the walls' receivers, above.
export function visibilityPolygon(x:number,y:number,radius=700,wallDepth=0){
 let angles:number[]|Float64Array=[];
 for(let i=0;i<96;i++)(angles as number[]).push(i/96*Math.PI*2-Math.PI);
 for(let p of corners){if(Math.hypot(p.x-x,p.y-y)>radius+96)continue;let a=Math.atan2(p.y-y,p.x-x);(angles as number[]).push(a-2e-5,a,a+2e-5);}
 for(let p of crates){                                                   // (B28) a pillar's corners the player sees round
  if(Math.hypot(p.x+p.w/2-x,p.y+p.h/2-y)>radius+Math.hypot(p.w,p.h)/2)continue;
  for(let cx of [p.x,p.x+p.w])for(let cy of [p.y,p.y+p.h]){
   let besideX=cx===p.x?x<cx:x>cx,besideY=cy===p.y?y<cy:y>cy,a;
   if(besideX===besideY&&!(besideX&&wallDepth>0))continue;
   a=Math.atan2(cy-y,cx-x);
   (angles as number[]).push(a-2e-5,a+2e-5);
  }
 }
 let faces=wallDepth>0?wallFaces():null,stamp=0;
 if(faces){                                                              // the bands' corners and where the view's edge crosses them
  if(faces.D!==wallDepth)buildBands(faces,wallDepth);
  stamp=++faces.S;
  let r2=radius*radius,inner2=(radius-1)*(radius-1);
  for(let by=Math.floor((y-radius)/768);by<=Math.floor((y+radius)/768);by++)for(let bx=Math.floor((x-radius)/768);bx<=Math.floor((x+radius)/768);bx++){
   let block=faces.K.get(by*4096+bx);
   if(block)for(let j of block){
    let f=faces[j];
    if(f.v===stamp||f.w===stamp)continue;
    f.w=stamp;
    if(!((x-(f.h?f.a0:f.L))*f.nx+(y-(f.h?f.L:f.a0))*f.ny>1e-9))continue;
    let b=f.b,dx=b[0]-x>0?b[0]-x:x-b[2]>0?x-b[2]:0,dy=b[1]-y>0?b[1]-y:y-b[3]>0?y-b[3]:0;
    if(dx*dx+dy*dy>r2)continue;
    f.v=stamp;
    let q=f.q;
    for(let k=4;k<8;k+=2){
     let X=q[k]-x,Y=q[k+1]-y;
     if(X*X+Y*Y<r2){
      let a=Math.atan2(Y,X),w=f.h?x:y;
      (angles as number[]).push(a);
      if((k===4?f.s1:f.s0)<0||(k===4?w>f.a1:w<f.a0))(angles as number[]).push(a-2e-5,a+2e-5);
     }
     let nj=k===4?f.n1:f.n0;
     if(nj>=0){
      let g=faces[nj];
      if((x-(g.h?g.a0:g.L))*g.nx+(y-(g.h?g.L:g.a0))*g.ny>1e-9){X=f.Q45[k]-x;Y=f.Q45[k+1]-y;if(X*X+Y*Y<r2)(angles as number[]).push(Math.atan2(Y,X));}
     }
    }
    let gx=Math.max(Math.abs(b[0]-x),Math.abs(b[2]-x)),gy=Math.max(Math.abs(b[1]-y),Math.abs(b[3]-y));
    if(gx*gx+gy*gy>inner2)for(let k=0;k<13;k+=6){                       // where the radius crosses the band's outer edges
     let Z=k>6?f.Q45:q,kk=k>6?6:k,j=kk?4:2,ax=Z[kk],ay=Z[kk+1],bx=Z[j]-ax,by=Z[j+1]-ay,fx=ax-x,fy=ay-y,A=bx*bx+by*by,B=fx*bx+fy*by,C=fx*fx+fy*fy-inner2,D=B*B-A*C;
     if(A>0&&D>0){
      let z=(-B-Math.sqrt(D))/A;
      if(z>0&&z<1)(angles as number[]).push(Math.atan2(ay+by*z-y,ax+bx*z-x));
      z=(-B+Math.sqrt(D))/A;
      if(z>0&&z<1)(angles as number[]).push(Math.atan2(ay+by*z-y,ax+bx*z-x));
     }
    }
   }
  }
 }
 angles=Float64Array.from(angles).sort();
 let points:number[]=[],m=angles.length,hits=new Float64Array(m),faceOf=faces?new Int32Array(m).fill(-1):null,along=faces?new Float64Array(m):null,cosines=faces?new Float64Array(m):null,sines=faces?new Float64Array(m):null;
 let cache=faces&&lastRays&&lastRays.e===x&&lastRays.t===y&&lastRays.n===radius?lastRays:null,cachedAngles=cache?cache.A:null,cachedCount=cache?cachedAngles!.length:0,cp=0;
 for(let k=0;k<m;k++){                                                    // every ray: how far it goes, and the face it ends on
  let a=angles[k],d;
  if(cache){while(cp<cachedCount&&cachedAngles![cp]<a)cp++;d=cp<cachedCount&&cachedAngles![cp]===a?cache.H[cp]:rayDistance(x,y,a,radius);}
  else d=rayDistance(x,y,a,radius);
  hits[k]=d;
  if(!faces)continue;
  let c=Math.cos(a),l=Math.sin(a);
  cosines![k]=c;sines![k]=l;
  if(!(d<radius))continue;
  let hx=x+c*d,hy=y+l*d,cell=faces.G.get(Math.floor((hy+l*.01)/96)*4096+Math.floor((hx+c*.01)/96));
  if(!cell)continue;
  for(let j of cell){
   let f=faces[j];
   if(f.v!==stamp)continue;
   let w=f.h?hx:hy,z=f.h?hy:hx;
   if(Math.abs(z-f.L)<.001&&w>f.a0-.001&&w<f.a1+.001){faceOf![k]=j;along![k]=w;break;}
  }
 }
 if(!faces)lastRays={e:x,t:y,n:radius,A:angles,H:hits};
 /* the rays that reach each face, in order: the stretches of it the player sees (a run of rays; the first and last ray are one run) */
 let seen:Map<number,number[][]>|null=null,seenLo:Float64Array|null=null,seenHi:Float64Array|null=null;
 if(faces){
  seen=new Map();seenLo=new Float64Array(m);seenHi=new Float64Array(m);
  for(let k=0;k<m;){
   let j=faceOf![k];
   if(j<0){k++;continue;}
   let first=k,lo=along![k],hi=along![k];
   while(k+1<m&&faceOf![k+1]===j){k++;if(along![k]<lo)lo=along![k];if(along![k]>hi)hi=along![k];}
   let run=[lo,hi,first,k];
   (seen.get(j)||seen.set(j,[]).get(j))!.push(run);
   k++;
  }
  if(m>1&&faceOf![0]>=0&&faceOf![0]===faceOf![m-1]){
   let runs=seen.get(faceOf![0])!,A=runs[0],B=runs[runs.length-1];
   if(runs.length>1){A[0]=Math.min(A[0],B[0]);A[1]=Math.max(A[1],B[1]);B[0]=A[0];B[1]=A[1];}
  }
  for(let runs of seen.values())for(let v of runs){
   let f=faces[faceOf![v[2]]];
   if(v[0]<=f.a0+.5)v[0]=-1e9;
   if(v[1]>=f.a1-.5)v[1]=1e9;
   for(let k=v[2];k<=v[3];k++){seenLo[k]=v[0];seenHi[k]=v[1];}
  }
  /* a convex corner whose two faces the player sees right to it: the two bands meet on their own diagonal (the 24 px L, the art's
     mitre drawn inside it), not on the art's mitre (which, where a face's art is deeper than 24 px, left a notch) */
  for(let j of seen.keys()){
   let f=faces[j],v=0;
   if(f.n0>=0&&seenToEnd(seen.get(f.n0),f.c0))v=1;
   if(f.n1>=0&&seenToEnd(seen.get(f.n1),f.c1))v+=2;
   f.E=f.EV[v];
  }
 }
 for(let k=0;k<m;k++){                                                    // every ray's end: into the band of the face it reaches
  let a=angles[k],d=hits[k],c=faces?cosines![k]:Math.cos(a),l=faces?sines![k]:Math.sin(a),into=d<radius&&wallDepth>0?wallDepth:0;
  if(faces&&d<radius&&faceOf![k]>=0){
   let f=faces[faceOf![k]],T=bandExit(f,seenLo![k],seenHi![k],x,y,c,l,d+.01),side=exitSide,P0=T;
   if(!(T>d)){T=P0=d;side=3;}
   /* a ray seen along a side face that leaves this band by its inner edge near a convex end can still cross the face's whole band (the
      art's) and its mitre into the side face's band: it goes on there (or the side face's band thins near the corner); only where the
      player sees this face across the whole corner square (else the polygon's edge to the next ray would cut across the face's band past
      the stretch seen).  (Leaving it right where the band's inner edge meets the mitre: the same) */
   else if(side===6){
    let u=f.h?x+c*T:y+l*T;
    if(f.s1>0&&u>f.a1-f.s1-2&&seenLo![k]<=f.a1-f.s1-1||f.s0>0&&u<f.a0+f.s0+2&&seenHi![k]>=f.a0+f.s0+1){
     let X=bandExit(f,seenLo![k],seenHi![k],x,y,c,l,T+.01,f.EF);
     if(X>T&&(exitSide===3||exitSide===9)){P0=X;side=3;}
     else if(X<0)side=3;
    }
   }
   /* where it leaves the band across a mitre (or hits the face right at its end) it can go on through the band of the neighbouring face,
      if the player sees that one too */
   if(side===3||side===9)for(let g=0;g<3;g++){
    let hx=x+c*(P0+.01),hy=y+l*(P0+.01),cell=faces.G.get(Math.floor(hy/96)*4096+Math.floor(hx/96)),N=-1,NK=-1;
    if(cell)for(let j of cell){
     let h=faces[j],runs=h.v===stamp&&seen!.get(j);
     if(!runs)continue;
     let w=h.h?hx:hy;
     for(let v of runs){
      if(w<v[0]-.5||w>v[1]+.5)continue;
      let X=bandExit(h,v[0],v[1],x,y,c,l,P0+.01);
      if(X>N){N=X;NK=exitSide;}
     }
    }
    if(!(N>P0+.01))break;
    T=P0=N;
    if(NK!==3&&NK!==9)break;
   }
   into=Math.max(0,T-d);
  }
  let z=Math.min(radius,d+into);
  points.push(x+c*z,y+l*z);
 }
 return points;
}
/* how lit a point is for the observer.  (B19, owner BR-RoLE) each fixture's light is scaled by its state now (ents.js's
 * window.__ents.lamp: a flicker, a failing tube); (B20, owner BR-R) through the camcorder's night vision (window.__cam.nv) the reading is
 * the camcorder's own (nvRead) and the range fade is its own; the response is steeper (B20). */
export function exposureAt(x:number,y:number,observer:{x:number,y:number,angle:number,equipment?:LightEquipment},flash:boolean){
 const d=Math.hypot(x-observer.x,y-observer.y);
 let strength=Math.max((1-smooth(28,100,d))*.5,carriedLightAt(observer,{x,y},flash));
 if(!lighting.blackout)for(const l of lights){
  const ld=Math.hypot(x-l.x,y-l.y);if(ld>=380)continue;
  if(rayDistance(l.x,l.y,Math.atan2(y-l.y,x-l.x),ld+1)>=ld-.5)strength=Math.max(strength,(1-smooth(40,380,ld))*.43*(window.__ents?window.__ents.lamp(l.x,l.y,performance.now()/1e3):1));
 }
 const nv=window.__cam&&window.__cam.nv;
 if(nv)strength=window.__cam!.nvRead(x,y,strength,d);
 return (nv?1-smooth(560,700,d):rangeFade(d))*Math.min(1,.04+strength*2.08);
}
