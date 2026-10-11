/* Stage 3H0 - one extra server scenario for srv_harness.js (development only), used by summon_seeds.js at H0-5.
 *
 * QA2's probe_q2 and the real-server summon_probe.js summon a Hound to an admin standing in god mode at the spawn point and measure how
 * close any monster comes in 10 s.  This is the same sequence in the closed world (fake clock, seeded world), so that it can be run on
 * the parent's server.js and the working tree's with the very same seed and compared byte for byte, for many seeds. */
'use strict';
const PASS = 'h0-synthetic-admin';
const P = (x, y, o = {}) => Object.assign({ t: 'p', x, y, vx: 0, vy: 0, a: 0, r: 0, l: 1, ir: 0, k: 'flashlight', lp: '#ffe7b2,#333333,#888888', n: 'OBSERVER', c: '#ffe7b2', f: -1,
  lk: 'none|plain|#e6bb76|#ffcc77|none', mv: { s: 0, sp: 0, st: 0, ex: 0, ev: [] } }, o);
module.exports = {
  async summon(H) {
    const A = H.connect('/ws?room=summon', { ip: '203.0.113.60' });
    const sim = H.sims[H.sims.length - 1], Ic = sim.debug.Ic;
    const stand = n => { for (let i = 0; i < n; i++) { H.advance(50); A.send(P(Ic.x, Ic.y)); } };
    const cmd = o => A.send(Object.assign({ t: 'a' }, o));
    A.send({ t: 'admin', pass: PASS, quiet: 1 }); H.advance(100);
    A.send({ t: 'join' }); H.advance(60); stand(30);
    cmd({ c: 'freeze', on: 0 });
    for (let k = 0; k < 6; k++) { cmd({ c: 'hounds', mode: 'remove', n: 10 }); cmd({ c: 'smilers', mode: 'remove', n: 10 }); stand(9); }
    cmd({ c: 'god', id: A.id }); stand(8);
    cmd({ c: 'freeze', on: 1 }); stand(6);
    cmd({ c: 'freeze', on: 0 }); cmd({ c: 'near', k: 'hound' }); cmd({ c: 'near', k: 'smiler' }); stand(8);
    const from = A.rx.length; cmd({ c: 'summon' }); stand(200);
    let minD = Infinity;
    for (const m of A.rx.slice(from)) if (m.t === 's' && m.e) for (const e of (m.e.h || []).concat(m.e.m || [])) minD = Math.min(minD, Math.hypot(e.x - Ic.x, e.y - Ic.y));
    H.note('summon minD ' + Math.round(minD));
    A.close(); H.advance(100);
  },
};
