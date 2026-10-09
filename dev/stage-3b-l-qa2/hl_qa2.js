/* QA2 corner polish: the line of sight's darkness clip shows a wall's or pillar's faces the way the art draws them.
 * (The text between the markers is what dev/stage-3b-l-qa2/apply_hl.py puts into the game bundle in place of its Hl.)
 *
 * Hl(x, y, n, r) builds the player's sight polygon: r 0 is the entity mask (creatures and other wanderers are drawn only
 * inside it), r 24 the darkness clip (outside it the screen is black).  The parent's clip went 24 px past every hit along
 * the ray: seen square-on that shows 24 px of a wall's face, seen at a slant only 24 x sin(angle), so a face shrank to a
 * thin wedge toward its far end and two faces met at a corner in a notch; near a corner the 24 px also went on into the
 * face around the corner (whose light belongs to floor the player cannot see).  Now, for r > 0:
 *   - a ray that stops at a wall or pillar face goes on into it only inside that face's band as the art draws it: depth r
 *     measured square to the face (the same 24 px seen square-on, now at every angle), between the face's mitred ends (the
 *     remaster's mitres: from a convex corner in to where the two faces' bands meet; at an inner corner on into the corner
 *     block, the two bands meeting on its diagonal - an L, as the art draws it), and only over the part of the face the player really sees (the rays that reach that face, in order; seen up
 *     to its end, the band goes on to its mitre);
 *   - where it leaves that band into the band of a neighbouring face the player also sees (a corner seen from the
 *     diagonal), it goes on through that one, the same way; never into a face turned away, never out of the blocker;
 *   - one more ray at each inner corner of those bands (three where it meets a neighbouring seen face's band: the edge of
 *     what a ray can reach jumps there), and where a band's face and inner edge cross the sight limit, so the polygon
 *     follows them exactly (and a face seen out to the sight limit counts as seen that far).
 * Both polygons also get angle - eps / angle + eps at the outline corners of every pillar in reach (the corners with one
 * side turned to the player; the walls' corners always had their rays), so a pillar's hidden wedge pivots on its corners;
 * the clip also at the corner nearest the player (both its sides seen: each band reaches its mitre).  The clip reuses the rays the entity mask
 * cast just before from the same point (Uc is exact and its tables static, so the result is the same).  The exact ray
 * query Uc, the wall corner list Vl and every caller are unchanged; the band depths are BR-RoLE's receivers' (the
 * remaster's faces: walls S 46, N 23, E / W 27; pillars S 18, N 12, E / W 14). */
// ---- begin (bundle text) ----
var HlqD={S:46,N:23,E:27,W:27,pS:18,pN:12,pE:14,pW:14},HlqF=null,HlqC=null,HlqK=-1;
/* the faces (wall runs and pillar sides) once: outward normal, line, extent along it, band depth, and the mitre shift
 * at each end (+ a convex end: the band ends inside it, on the art's mitre; - an inner corner: it goes on into the corner
 * block as far as it is deep - the two faces' bands meet on the block's own diagonal, an L, at any depth) */
function HlqFaces(){if(HlqF)return HlqF;let F=[],W=(x,y)=>!!Hc(x,y),D=HlqD,O=(h,nx,ny,L,a0,a1,d,s0,s1,p)=>({h,nx,ny,L,a0,a1,d,s0,s1,p,q:null,E:null,EF:null,b:null,v:0,w:0});
for(let y=0;y<=FBH;y++)for(let x=0;x<FBW;){let u=W(x,y-1),d=W(x,y);if(u===d){x++;continue}let e=x;while(e+1<FBW&&W(e+1,y-1)===u&&W(e+1,y)===d)e++;let ny=u?1:-1,wr=u?y-1:y,fr=u?y:y-1;
let dd=u?D.S:D.N;F.push(O(1,0,ny,y*96,x*96,(e+1)*96,dd,W(x-1,wr)&&W(x-1,fr)?-dd:D.W,W(e+1,wr)&&W(e+1,fr)?-dd:D.E,0));x=e+1}
for(let x=0;x<=FBW;x++)for(let y=0;y<FBH;){let l=W(x-1,y),r=W(x,y);if(l===r){y++;continue}let e=y;while(e+1<FBH&&W(x-1,e+1)===l&&W(x,e+1)===r)e++;let nx=l?1:-1,wc=l?x-1:x,fc=l?x:x-1;
let dd=l?D.E:D.W;F.push(O(0,nx,0,x*96,y*96,(e+1)*96,dd,W(wc,y-1)&&W(fc,y-1)?-dd:D.N,W(wc,e+1)&&W(fc,e+1)?-dd:D.S,0));y=e+1}
for(let p of Pc)F.push(O(1,0,1,p.y+p.h,p.x,p.x+p.w,D.pS,D.pW,D.pE,1),O(1,0,-1,p.y,p.x,p.x+p.w,D.pN,D.pW,D.pE,1),
O(0,1,0,p.x+p.w,p.y,p.y+p.h,D.pE,D.pN,D.pS,1),O(0,-1,0,p.x,p.y,p.y+p.h,D.pW,D.pN,D.pS,1));
F.D=0;F.S=0;return HlqF=F}
/* a face's band at depth D as a quad q (outer start, outer end, inner end, inner start), world px; its four edges E as
 * inward unit normals (mx, my, c: inside where mx x + my y >= c); its bounding box b */
function HlqQuad(f,D){let i0=f.a0+f.s0*D/f.d,i1=f.a1-f.s1*D/f.d;if(i0>i1)i0=i1=(i0+i1)/2;let P=(u,t)=>f.h?[u,f.L-f.ny*t]:[f.L-f.nx*t,u],q=[...P(f.a0,0),...P(f.a1,0),...P(i1,D),...P(i0,D)],
ar=(q[2]-q[0])*(q[5]-q[1])-(q[3]-q[1])*(q[4]-q[0])+(q[4]-q[0])*(q[7]-q[1])-(q[5]-q[1])*(q[6]-q[0]),sg=ar>=0?1:-1,E=new Float64Array(12);
for(let k=0;k<4;k++){let ax=q[2*k],ay=q[2*k+1],bx=q[(2*k+2)%8],by=q[(2*k+3)%8],mx=-(by-ay)*sg,my=(bx-ax)*sg,h=Math.hypot(mx,my)||1;E[3*k]=mx/h;E[3*k+1]=my/h;E[3*k+2]=(mx*ax+my*ay)/h}return{q,E,b:[Math.min(q[0],q[2],q[4],q[6]),Math.min(q[1],q[3],q[5],q[7]),Math.max(q[0],q[2],q[4],q[6]),Math.max(q[1],q[3],q[5],q[7])]}}
/* every face's band at depth D (and its whole band as the art draws it, EF: its edges), and two indexes of them: by 96 px
 * cell (the cells each band covers) and by 768 px block */
function HlqBuild(F,D){let G=new Map,K=new Map;for(let i=0;i<F.length;i++){let f=F[i],o=HlqQuad(f,D);f.q=o.q;f.E=o.E;f.b=o.b;f.EF=HlqQuad(f,Math.max(D,f.d)).E;let b=f.b;for(let cy=Math.floor((b[1]-1)/96);cy<=Math.floor((b[3]+1)/96);cy++)for(let cx=Math.floor((b[0]-1)/96);cx<=Math.floor((b[2]+1)/96);cx++){let k=cy*4096+cx,l=G.get(k);l||G.set(k,l=[]);l.push(i)}
for(let cy=Math.floor(b[1]/768);cy<=Math.floor(b[3]/768);cy++)for(let cx=Math.floor(b[0]/768);cx<=Math.floor(b[2]/768);cx++){let k=cy*4096+cx,l=K.get(k);l||K.set(k,l=[]);l.push(i)}}F.G=G;F.K=K;F.D=D}
/* the ray (ox, oy) + s (c, l), s >= t0: is it inside face f's band (and its along-face slab lo..hi), and where does it leave?
 * (HlqK: by which side: 0 the face, 3 its end's mitre, 6 the inner edge, 9 its start's mitre, 12 the seen stretch's end;
 * EE: another set of edges, the face's whole band) */
function HlqExit(f,lo,hi,ox,oy,c,l,t0,EE){HlqK=-1;let E=EE||f.E,px=ox+c*t0,py=oy+l*t0,T=1/0,K=-1;for(let k=0;k<12;k+=3){let v=E[k]*px+E[k+1]*py-E[k+2];if(v<-1e-6)return-1;let w=E[k]*c+E[k+1]*l;if(w<0){let z=t0+v/-w;if(z<T){T=z;K=k}}}
let du=f.h?c:l,uu=f.h?px:py;if(uu<lo-.5||uu>hi+.5)return-1;if(du>0){let z=t0+(hi+.5-uu)/du;if(z<T){T=z;K=12}}else if(du<0){let z=t0+(lo-.5-uu)/du;if(z<T){T=z;K=12}}HlqK=K;return T}
function Hl(e,t,n=700,r=0){let i=[];for(let e=0;e<96;e++)i.push(e/96*Math.PI*2-Math.PI);for(let r of Vl){if(Math.hypot(r.x-e,r.y-t)>n+96)continue;let a=Math.atan2(r.y-t,r.x-e);i.push(a-2e-5,a,a+2e-5)}
for(let p of Pc){if(Math.hypot(p.x+p.w/2-e,p.y+p.h/2-t)>n+Math.hypot(p.w,p.h)/2)continue;for(let o of[p.x,p.x+p.w])for(let s of[p.y,p.y+p.h]){let u=o===p.x?e<o:e>o,v=s===p.y?t<s:t>s,a;if(u===v&&!(u&&r>0))continue;a=Math.atan2(s-t,o-e);i.push(a-2e-5,a+2e-5)}}
let F=r>0?HlqFaces():null,V=0;if(F){if(F.D!==r)HlqBuild(F,r);V=++F.S;let n2=n*n,m2=(n-1)*(n-1);for(let by=Math.floor((t-n)/768);by<=Math.floor((t+n)/768);by++)for(let bx=Math.floor((e-n)/768);bx<=Math.floor((e+n)/768);bx++){let Q=F.K.get(by*4096+bx);if(Q)for(let j of Q){let f=F[j];if(f.v===V||f.w===V)continue;f.w=V;if(!((e-(f.h?f.a0:f.L))*f.nx+(t-(f.h?f.L:f.a0))*f.ny>1e-9))continue;let b=f.b,dx=b[0]-e>0?b[0]-e:e-b[2]>0?e-b[2]:0,dy=b[1]-t>0?b[1]-t:t-b[3]>0?t-b[3]:0;if(dx*dx+dy*dy>n2)continue;f.v=V;let q=f.q;
for(let k=4;k<8;k+=2){let X=q[k]-e,Y=q[k+1]-t;if(X*X+Y*Y<n2){let a=Math.atan2(Y,X),w=f.h?e:t;i.push(a);if((k===4?f.s1:f.s0)<0||(k===4?w>f.a1:w<f.a0))i.push(a-2e-5,a+2e-5)}}
let gx=Math.max(Math.abs(b[0]-e),Math.abs(b[2]-e)),gy=Math.max(Math.abs(b[1]-t),Math.abs(b[3]-t));if(gx*gx+gy*gy>m2)for(let k=0;k<8;k+=6){let j=k?4:2,ax=q[k],ay=q[k+1],bx=q[j]-ax,by=q[j+1]-ay,fx=ax-e,fy=ay-t,A=bx*bx+by*by,B=fx*bx+fy*by,Cq=fx*fx+fy*fy-m2,Dq=B*B-A*Cq;if(A>0&&Dq>0){let z=(-B-Math.sqrt(Dq))/A;z>0&&z<1&&i.push(Math.atan2(ay+by*z-t,ax+bx*z-e));z=(-B+Math.sqrt(Dq))/A;z>0&&z<1&&i.push(Math.atan2(ay+by*z-t,ax+bx*z-e))}}}}}
i=Float64Array.from(i).sort();let a=[],m=i.length,H=new Float64Array(m),J=F?new Int32Array(m).fill(-1):null,U=F?new Float64Array(m):null,CS=F?new Float64Array(m):null,SN=F?new Float64Array(m):null;
let C=F&&HlqC&&HlqC.e===e&&HlqC.t===t&&HlqC.n===n?HlqC:null,CA=C?C.A:null,cm=C?CA.length:0,cp=0;
for(let k=0;k<m;k++){let o=i[k],d;if(C){while(cp<cm&&CA[cp]<o)cp++;d=cp<cm&&CA[cp]===o?C.H[cp]:Uc(e,t,o,n)}else d=Uc(e,t,o,n);H[k]=d;if(!F)continue;let c=Math.cos(o),l=Math.sin(o);CS[k]=c;SN[k]=l;if(!(d<n))continue;let x=e+c*d,y=t+l*d,L=F.G.get(Math.floor((y+l*.01)/96)*4096+Math.floor((x+c*.01)/96));if(!L)continue;
for(let j of L){let f=F[j];if(f.v!==V)continue;let w=f.h?x:y,z=f.h?y:x;if(Math.abs(z-f.L)<1e-3&&w>f.a0-1e-3&&w<f.a1+1e-3){J[k]=j;U[k]=w;break}}}
if(!F)HlqC={e,t,n,A:i,H};
/* the rays that reach each face, in order: the stretches of it the player sees (a run of rays; the first and last ray are one run) */
let R=null,RL=null,RH=null;if(F){R=new Map;RL=new Float64Array(m);RH=new Float64Array(m);for(let k=0;k<m;){let j=J[k];if(j<0){k++;continue}let b=k,lo=U[k],hi=U[k];while(k+1<m&&J[k+1]===j){k++;if(U[k]<lo)lo=U[k];if(U[k]>hi)hi=U[k]}let I=[lo,hi,b,k];(R.get(j)||R.set(j,[]).get(j)).push(I);k++}
if(m>1&&J[0]>=0&&J[0]===J[m-1]){let I=R.get(J[0]),A=I[0],B=I[I.length-1];if(I.length>1){A[0]=Math.min(A[0],B[0]);A[1]=Math.max(A[1],B[1]);B[0]=A[0];B[1]=A[1]}}
for(let I of R.values())for(let v of I){let f=F[J[v[2]]];if(v[0]<=f.a0+.5)v[0]=-1e9;if(v[1]>=f.a1-.5)v[1]=1e9;for(let k=v[2];k<=v[3];k++){RL[k]=v[0];RH[k]=v[1]}}}
for(let k=0;k<m;k++){let o=i[k],d=H[k],c=F?CS[k]:Math.cos(o),l=F?SN[k]:Math.sin(o),s=d<n&&r>0?r:0;
if(F&&d<n&&J[k]>=0){let f=F[J[k]],T=HlqExit(f,RL[k],RH[k],e,t,c,l,d+.01),K=HlqK,P0=T;if(!(T>d)){T=P0=d;K=3}
/* a ray seen along a side face that leaves this band by its inner edge near a convex end can still cross the face's whole
 * band (the art's) and its mitre into the side face's band: it goes on there (or the side face's band thins near the corner);
 * only where the player sees this face across the whole corner square (else the polygon's edge to the next ray would cut
 * across the face's band past the stretch seen).  (Leaving it right where the band's inner edge meets the mitre: the same) */
else if(K===6){let u=f.h?e+c*T:t+l*T;if(f.s1>0&&u>f.a1-f.s1-2&&RL[k]<=f.a1-f.s1-1||f.s0>0&&u<f.a0+f.s0+2&&RH[k]>=f.a0+f.s0+1){let X=HlqExit(f,RL[k],RH[k],e,t,c,l,T+.01,f.EF);if(X>T&&(HlqK===3||HlqK===9)){P0=X;K=3}else if(X<0)K=3}}
/* where it leaves the band across a mitre (or hits the face right at its end) it can go on through the band of the neighbouring face, if the player sees that one too */
if(K===3||K===9)for(let g=0;g<3;g++){let x=e+c*(P0+.01),y=t+l*(P0+.01),L=F.G.get(Math.floor(y/96)*4096+Math.floor(x/96)),N=-1,NK=-1;if(L)for(let j of L){let h=F[j],I=h.v===V&&R.get(j);if(!I)continue;let w=h.h?x:y;
for(let v of I){if(w<v[0]-.5||w>v[1]+.5)continue;let X=HlqExit(h,v[0],v[1],e,t,c,l,P0+.01);if(X>N){N=X;NK=HlqK}}}if(!(N>P0+.01))break;T=P0=N;if(NK!==3&&NK!==9)break}s=Math.max(0,T-d)}
let z=Math.min(n,d+s);a.push(e+c*z,t+l*z)}return a}
// ---- end (bundle text) ----
