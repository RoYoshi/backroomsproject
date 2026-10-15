/* src/frameworks/nani/server/sim.feed.js - N.A.N.I.: what the AI reads of the players every step (feed), its events (processEvents), and
 * a capture as the snapshot sends it (capInfo); a module of the sim (src/core/server/sim.js).
 * Stage 3H continuation C3 (M-024, dev/stage-3h-modernization/tools/c3_sim_modules.py): a module; its lines are sim.js's
 * at M8, as they were.
 *   simFeed({ WORLD, opts, players, level, ai })   players is the roster (feed writes the fields the AI reads on each record; a kill
 *     marks its victim dead and calls opts.onDeath). */
'use strict';
module.exports = function simFeed({ WORLD, opts, players, level: { Gc }, ai: { SNn, eng, isAlive } }) {
/* the numbers the AI reads about each player, refreshed every step */
function feed(){
  for(const p of players){
    p.alive=isAlive(p);p.kind=p.equipment.kind;
    if(p.light&&!(Gc[p.kind]&&Gc[p.kind].power>0))p.light=false;   // (v23) `light` is VISIBLE light only: a raised camcorder emits none (its raised pose is presentation, server.js)
    if(p.caught)p.st=p.caught.phase===`down`?7:4;
    p.prof=WORLD.PROFILE[SNn[p.st]]??1;
  }
  eng.setPlayers(players);
}
function processEvents(){
  for(const ev of eng.drainEvents()){
    if(ev.t===`kill`){
      const p=eng.playerById(ev.pid);if(!p)continue;
      p.dead=ev.kind;p.dseq++;p.caught=null;eng.endHabits(p.id);
      const g=ev.geo;
      p.kill={v:ev.variant,k:ev.kind,e:ev.eid,ax:Math.round(g.ax),ay:Math.round(g.ay),aa:+g.aa.toFixed(3),w:g.wall?[Math.round(g.wall.x),Math.round(g.wall.y),+g.wall.ang.toFixed(3)]:0,
        x:Math.round(ev.victim.x),y:Math.round(ev.victim.y),a:+ev.victim.a.toFixed(3),why:ev.why};
      if(opts.onDeath)opts.onDeath(p);                                  // the death is committed: the server keeps its aftermath from this instant (server.js)
    }
  }
}
const capInfo=p=>{const c=p.caught;return c?{ph:c.phase,e:c.eid,k:c.kind,d:c.drag?[Math.round(c.drag.x),Math.round(c.drag.y)]:0}:0};
return { capInfo, feed, processEvents };
};
