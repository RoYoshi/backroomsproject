/** @part generated/server/sim.js - L.O.S.T.: the glitched walls, the way out of Level 0
 * P.O.C.K.E.T.'s cartograph placement (items, makeItems) sits between the walls' lines, as it always did; its pick-up (takeItem) is in
 * src/core/server/sim.glue.js.
 * provides: glitches, items, makeGlitches, makeItems
 * uses: ANCHOR, FBH, FBW, Hc, Ic, RND, fl, randomSpot, sl, zc
 * writes: -
 */
/* --- glitched walls: the way out of Level 0 --- */
let glitches=[];
/* one rare find per world: a paranormal cartograph lying somewhere in the halls (first to reach it keeps it) */
let items=[];
function makeItems(){const p=randomSpot(1800,glitches,700,true);return p?[{id:`cartograph`,x:Math.round(p.x),y:Math.round(p.y)}]:[]}
function makeGlitches(n=3){
  const out=[],dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  for(let t=0;t<6000&&out.length<n;t++){
    const tx=(RND()*FBW)|0,ty=(RND()*FBH)|0;if(!zc(tx,ty))continue;
    const d=dirs[(RND()*4)|0],nx=tx+d[0],ny=ty+d[1];
    if(nx<1||ny<1||nx>=FBW-1||ny>=FBH-1||!Hc(nx,ny))continue;
    const cx=(tx+.5)*96,cy=(ty+.5)*96;if(!sl(cx,cy))continue;
    const x=cx+d[0]*48,y=cy+d[1]*48;
    if(Math.hypot(x-Ic.x,y-Ic.y)<2600||out.some(o=>Math.hypot(o.x-x,o.y-y)<2600))continue;
    if(!fl({x:cx,y:cy},ANCHOR).length)continue;
    out.push({x,y,nx:d[0],ny:d[1]});
  }
  return out;
}

