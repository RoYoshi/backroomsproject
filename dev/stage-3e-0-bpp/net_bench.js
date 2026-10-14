/* Stage 3E-0 B++ - how much the two candidate serialisation savings could buy at most (development only)
 *
 *   node dev/stage-3e-0-bpp/net_bench.js --sample SAMPLE.json [--out FILE.json] [--n 7]
 *
 * SAMPLE.json: a real snapshot ('s') and pose update ('q') as a B+ player received them (net_profile.js --sample).  For N recipients, as
 * the server's tick builds them:
 *   snapshot   now: JSON.stringify of each recipient's whole message ({t:'s', p: the others, e: the entities, me, ms, cp, w, k});
 *              candidate: the entity list stringified once per tick and spliced in (the rest per recipient).  The candidate's bytes
 *              must equal the current ones exactly, recipient by recipient.
 *   pose       now: per recipient, the changed poses without its own entry and JSON.stringify;
 *              candidate: each entry stringified once per tick, joined per recipient.  Same equality check.
 * Timed: 2,000 warm-up ticks, then 20,000 ticks, best of 5.  Reported: microseconds per tick for N recipients, and what the
 * saving would be at 20 snapshot ticks + 20 pose ticks a second, as a share of one CPU core. */
'use strict';
const fs = require('fs');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const N = +(ARG.n || 7), smp = JSON.parse(fs.readFileSync(ARG.sample, 'utf8')), S = JSON.parse(smp.s), Q = JSON.parse(smp.q);
const me0 = Object.assign({}, S.p[0], { id: 9999 }), peers = [...S.p, me0].slice(0, N), ids = peers.map(p => p.id);
const ent = S.e, base = { me: S.me, ms: S.ms, cp: S.cp, w: S.w, k: S.k };
const qAll = ids.map((id, i) => [id, 5000 + i, 3000 + i, +(i / 10).toFixed(2)]);
function snapNow() { let n = 0; for (const id of ids) { const msg = { t: 's', p: peers.filter(p => p.id !== id), e: ent, me: base.me, ms: base.ms, cp: base.cp, w: base.w }; if (base.k != null) msg.k = base.k; n += JSON.stringify(msg).length; } return n; }
function snapCand() { let n = 0; const ej = JSON.stringify(ent); for (const id of ids) { const head = JSON.stringify({ t: 's', p: peers.filter(p => p.id !== id) }), tail = JSON.stringify({ me: base.me, ms: base.ms, cp: base.cp, w: base.w, k: base.k }); n += (head.slice(0, -1) + ',"e":' + ej + ',' + tail.slice(1)).length; } return n; }
function poseNow() { let n = 0; for (const id of ids) { const p = qAll.filter(q => q[0] !== id); n += JSON.stringify({ t: 'q', w: Q.w, k: Q.k, p }).length; } return n; }
function poseCand() { let n = 0; const parts = qAll.map(q => JSON.stringify(q)), pre = '{"t":"q","w":' + Q.w + ',"k":' + Q.k + ',"p":['; for (const id of ids) { const ps = []; for (let i = 0; i < qAll.length; i++) if (qAll[i][0] !== id) ps.push(parts[i]); n += (pre + ps.join(',') + ']}').length; } return n; }
/* equality, recipient by recipient */
const eq = { snapshot: true, pose: true };
{ const ej = JSON.stringify(ent);
  for (const id of ids) {
    const msg = { t: 's', p: peers.filter(p => p.id !== id), e: ent, me: base.me, ms: base.ms, cp: base.cp, w: base.w }; if (base.k != null) msg.k = base.k;
    const head = JSON.stringify({ t: 's', p: peers.filter(p => p.id !== id) }), tail = JSON.stringify({ me: base.me, ms: base.ms, cp: base.cp, w: base.w, k: base.k });
    if (JSON.stringify(msg) !== head.slice(0, -1) + ',"e":' + ej + ',' + tail.slice(1)) eq.snapshot = false;
    const parts = qAll.filter(q => q[0] !== id);
    if (JSON.stringify({ t: 'q', w: Q.w, k: Q.k, p: parts }) !== '{"t":"q","w":' + Q.w + ',"k":' + Q.k + ',"p":[' + parts.map(q => JSON.stringify(q)).join(',') + ']}') eq.pose = false; } }
const time = f => { for (let i = 0; i < 2000; i++) f(); let best = Infinity; for (let r = 0; r < 5; r++) { const t0 = process.hrtime.bigint(); for (let i = 0; i < 20000; i++) f(); best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e3 / 20000); } return best; };
const R = { tool: 'dev/stage-3e-0-bpp/net_bench.js', recipients: N, snapshotBytesEach: Math.round(snapNow() / N), entityBytes: JSON.stringify(ent).length, poseBytesEach: Math.round(poseNow() / N), identicalBytes: eq };
R.usPerTick = { snapshotNow: +time(snapNow).toFixed(2), snapshotCandidate: +time(snapCand).toFixed(2), poseNow: +time(poseNow).toFixed(2), poseCandidate: +time(poseCand).toFixed(2) };
const u = R.usPerTick; R.savingPerSecondUs = { snapshot: +((u.snapshotNow - u.snapshotCandidate) * 20).toFixed(1), pose: +((u.poseNow - u.poseCandidate) * 20).toFixed(1) };
R.savingShareOfOneCorePct = { snapshot: +(R.savingPerSecondUs.snapshot / 1e6 * 100).toFixed(4), pose: +(R.savingPerSecondUs.pose / 1e6 * 100).toFixed(4) };
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
console.log(JSON.stringify(R));
