/* src/frameworks/lost/server/sim.glitches.js - L.O.S.T.: the glitched walls, the way out of Level 0; a module of the sim
 * (src/core/server/sim.js).
 * Stage 3H continuation C3 (M-024, dev/stage-3h-modernization/tools/c3_sim_modules.py): a module.  Its lines are sim.js's
 * at M8, as they were, except what that tool lists: P.O.C.K.E.T.'s cartograph, which sat among these lines, is in its own module
 * (src/frameworks/pocket/server/sim.items.js).
 *   simGlitches({ ai, level })   returns the current walls (glitches(): the list changes at every world reset) and placeGlitches(),
 *     which places three new ones: the world reset and the admin call it where they used to assign the list themselves. */
'use strict';
module.exports = function simGlitches({ ai: { ANCHOR, RND }, level: { FBH, FBW, Hc, Ic, fl, sl, zc } }) {
/* --- glitched walls: the way out of Level 0 --- */
let glitches=[];
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
/* (C3) three new glitched walls */
const placeGlitches=()=>{glitches=makeGlitches(3)};
return { glitches: () => glitches, placeGlitches };
};
