/* Stage 3H continuation (C2) - golden-trace scenarios for the WebSocket session and the admin login, for Stage 3H0's closed-world server
 * harness (development only; never served).
 *
 *   node dev/tools/gate/golden/bpp_golden.js --scenarios dev/tools/gate/golden/srv_scenarios_session.js ...   (the gate's session step)
 *
 * C2 moved the session and the admin login out of server.js as a relocation: the owner approved moving them, not changing what they do.
 * These scenarios pin what they do, byte for byte, on the accepted B++ server.js and on this one, in the same fake-clock world (seeded
 * randomness, fake timers and sockets, the real sim).  They add what Stage 3H0's admin scenario does not reach:
 *   session_login     the login and its lockout over time, per client identity: wrong guesses below the threshold, then a correct one (the
 *                     count is cleared); five wrong guesses (locked out); the passcode refused while locked, with the time left at several
 *                     moments of the lock (rounded up), and accepted after it; a second connection from the same identity locked out too, a
 *                     third identity unaffected; the count after a lock has run out, with and without a login between; the quiet answer;
 *                     commands before and after the login, from an unlocked and a locked connection
 *   session_identity  the identity the lockout counts by, derived as server.js derived it at M8: the first entry of a forwarded header when
 *                     one is present, else the socket's address (connections with and without the header, sharing one or the other)
 *   session_wire      one connection's life: the greeting, the fresher-pose answer, an unknown message type, a message before joining,
 *                     pings faster and slower than the server answers them, a pose with non-numeric coordinates, an error then a
 *                     close, the empty room thrown away and made again, the room cap reached and freed
 * The passcode is the harness's synthetic one; the real default is never used or recorded. */
'use strict';
const LOOK2 = 'none|plain|#e6bb76|#ffcc77|none';
const P = (x, y, o = {}) => Object.assign({ t: 'p', x, y, vx: 0, vy: 0, a: 0, r: 0, l: 1, ir: 0, k: 'flashlight', lp: '#ffe7b2,#333333,#888888', n: 'QA', c: '#ffe7b2', f: -1, lk: LOOK2 }, o);
const MV = (s = 1, sp = 150, st = 100, ex = 0) => ({ s, sp, st, ex });
const PASS = 'h0-synthetic-admin';
function coverage(H, clients) {
  const o = {};
  for (const c of clients) { const k = {}; for (const m of c.rx) { const t = m.t || ('op' + m.__op); k[t] = (k[t] || 0) + 1; } o[c.cid] = k; }
  H.out('coverage', o);
}
const login = (H, c, pass, extra = {}) => { c.send(Object.assign({ t: 'admin', pass }, extra)); H.advance(20); H.out('login', c.cid, c.last('admin')); };

module.exports = {
  async session_login(H) {
    const room = 'lgn';
    const A = H.connect('/ws?room=' + room, { ip: '203.0.113.101', label: 'A' });
    const B = H.connect('/ws?room=' + room, { ip: '203.0.113.102', label: 'B' });
    const B2 = H.connect('/ws?room=' + room, { ip: '203.0.113.102', label: 'B2' });
    const C = H.connect('/ws?room=' + room, { ip: '203.0.113.103', label: 'C' });
    for (const c of [A, B, C]) { c.send({ t: 'join' }); H.advance(40); }
    /* a command before any login does nothing */
    A.send({ t: 'a', c: 'msg', text: 'before login' }); A.send({ t: 'a', c: 'freeze', on: 1 }); H.advance(100);
    /* below the threshold, then the passcode: the count is cleared */
    for (let i = 0; i < 4; i++) login(H, A, 'wrong-a' + i);
    login(H, A, PASS);
    A.send({ t: 'a', c: 'msg', text: 'after login' }); H.advance(100);
    login(H, A, 'wrong-after');                                            // an unlocked connection's wrong guess is still counted
    /* five wrong guesses: locked out; the same identity on another connection too; another identity not */
    for (let i = 0; i < 5; i++) login(H, B, 'wrong-b' + i);
    login(H, B, PASS); login(H, B2, PASS); login(H, C, PASS);
    for (const step of [10000, 19500, 20000, 9400, 600]) { H.advance(step); login(H, B, PASS); }
    H.advance(1000); login(H, B, PASS);                                    // the lock has run out
    login(H, B2, 'wrong-b2'); login(H, B2, PASS, { quiet: 1 });            // the count after a lock, then a quiet unlock
    B.send({ t: 'a', c: 'msg', text: 'from B' }); B2.send({ t: 'a', c: 'freeze', on: 0 }); H.advance(200);
    /* a locked connection's commands are refused like anyone's who is not unlocked */
    const D = H.connect('/ws?room=' + room, { ip: '203.0.113.104', label: 'D' });
    for (let i = 0; i < 6; i++) login(H, D, 'wrong-d' + i);
    D.send({ t: 'a', c: 'msg', text: 'from a locked connection' }); H.advance(200);
    H.advance(61000); login(H, D, 'wrong-d-after');                       // the lock has run out: the count starts again from zero
    for (const c of [A, B, B2, C, D]) c.close();
    H.advance(100);
    coverage(H, [A, B, B2, C, D]);
  },
  async session_identity(H) {
    const room = 'idn', XF = { 'x-forwarded-for': '198.51.100.7, 203.0.113.9' };
    const F = H.connect('/ws?room=' + room, { ip: '203.0.113.130', headers: XF, label: 'F' });
    const G = H.connect('/ws?room=' + room, { ip: '203.0.113.131', headers: { 'x-forwarded-for': '198.51.100.7' }, label: 'G' });
    const K = H.connect('/ws?room=' + room, { ip: '203.0.113.130', label: 'K' });
    const N = H.connect('/ws?room=' + room, { ip: '203.0.113.132', headers: { 'x-forwarded-for': '' }, label: 'N' });
    for (let i = 0; i < 5; i++) login(H, F, 'wrong-f' + i);
    login(H, G, PASS); login(H, K, PASS); login(H, N, 'wrong-n');
    H.advance(61000); login(H, G, PASS);
    for (const c of [F, G, K, N]) c.close();
    H.advance(100);
    coverage(H, [F, G, K, N]);
  },
  async session_wire(H) {
    const room = 'wire';
    const A = H.connect('/ws?room=' + room, { ip: '203.0.113.141', label: 'A' });
    A.send({ t: 'caps', fp: 1 }); A.send({ t: 'caps', fp: 0 }); A.send({ t: 'caps', fp: 'yes' }); A.send({ t: 'caps', fp: 1 }); H.advance(30);
    A.send({ t: 'nonsense', x: 1 }); A.send({ t: 'pick' }); A.send({ t: 'leave' }); A.send({ t: 'respawn' }); H.advance(30);
    A.send(P('x', null, { mv: MV(0, 0) })); A.send(P(1e12, -5)); H.advance(50);
    for (let i = 0; i < 6; i++) { A.send({ t: 'ping', ts: i }); H.advance(350); }
    for (let i = 0; i < 3; i++) { A.send({ t: 'ping', ts: 'n' + i }); H.advance(450); }
    A.send({ t: 'join' }); H.advance(40);
    const sim = H.sims[H.sims.length - 1], Ic = sim.debug.Ic;
    A.send(P(Ic.x, Ic.y, { mv: MV(0, 0) })); H.advance(40);
    A.send(P(Ic.x + 3, Ic.y, { mv: MV(1, 60) })); A.send(P(Ic.x + 4, Ic.y, { mv: MV(1, 60) })); H.advance(40);
    A.sock.emit('error', new Error('reset by peer')); H.advance(50);
    A.close(); H.advance(100);
    const again = H.connect('/ws?room=' + room, { ip: '203.0.113.141', label: 'A2' }); H.advance(50); again.close(); H.advance(50);
    /* the room cap: eight connections, a ninth refused, then one leaves and a ninth gets in */
    const many = []; for (let i = 0; i < 9; i++) { many.push(H.connect('/ws?room=cap', { ip: '203.0.113.15' + (i % 10), label: 'M' + i })); H.advance(10); }
    many[0].close(); H.advance(20);
    const late = H.connect('/ws?room=cap', { ip: '203.0.113.160', label: 'L' }); H.advance(50);
    for (const c of many.concat([late])) c.close();
    H.advance(100);
    coverage(H, [A, again, late].concat(many));
  },
};
