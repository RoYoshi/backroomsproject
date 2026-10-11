/* Stage 3H0 - does the client golden harness notice small behavior changes?  (development only)
 *
 *   node dev/stage-3h0/golden/cli_mutants.js [--out FILE.json]
 *
 * Takes the accepted parent's mp.js, makes one small deliberate change at a time (send cadence, rounding, interpolation constants, codec
 * rules, reconnect back-off, admin panel details, audio constants ...), runs the scenes that should see it, and checks the trace differs from
 * the unchanged parent's.  A mutant that is not noticed is a blind spot and is reported; none of these changes is applied to the real file. */
'use strict';
const fs = require('fs'), crypto = require('crypto');
const L = require('./cli_lib.js');
const REF = 'edd2af954627caf7721c7614df5ff1c7f20d3f3b';
const OUTF = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const M = [
  ['p every 51 ms in a run', 'now - lastSend > (started ? 50 : 250)', 'now - lastSend > (started ? 51 : 250)', ['run_online']],
  ['p every 240 ms in the menu', 'now - lastSend > (started ? 50 : 250)', 'now - lastSend > (started ? 50 : 240)', ['menu_online']],
  ['p angle with 3 decimals', 'a: +p.angle.toFixed(2), r: p.sprinting', 'a: +p.angle.toFixed(3), r: p.sprinting', ['run_online']],
  ['interpolation delay 0.11 s', 'DELAY: .1,', 'DELAY: .11,', ['interp']],
  ['extrapolation limit 0.2 s', 'Math.min(rt - b.t, .15)', 'Math.min(rt - b.t, .2)', ['interp']],
  ['no smoothing above 299 px', '> 300) return rt >= b.t ? b : a;', '> 299) return rt >= b.t ? b : a;', ['interp']],
  ['new world after a 0.5 s step back', 'e.st < NET.lastSt - .25', 'e.st < NET.lastSt - .5', ['interp']],
  ['history of 9 samples', 'if (h.length > 8) h.shift();', 'if (h.length > 9) h.shift();', ['interp']],
  ['histories pruned after 6 s', 'if (e.st - h.seen > 5) NET.hist.delete(k);', 'if (e.st - h.seen > 6) NET.hist.delete(k);', ['interp']],
  ['clock offset drifts faster', 'Math.min(.02, NET.off - smp) * .05', 'Math.min(.02, NET.off - smp) * .06', ['interp']],
  ['missing look parses another default', "String(s || 'none|plain|#e6bb76|#ffcc77|none')", "String(s || 'none|plain|#e6bb76|#ffcc78|none')", ['menu_online']],
  ['older clients\' backpacks drawn', "return { hat, texture, hands, main, backpack: 'none' }; };", "return { hat, texture, hands, main, backpack: String(s || '').split('|')[4] || 'none' }; };", ['menu_online']],
  ['light parts accept 3-digit colours', "if (/^#[0-9a-f]{6}$/i.test(v[i])) o[d[0]] = v[i];", "if (/^#[0-9a-f]{3,6}$/i.test(v[i])) o[d[0]] = v[i];", ['fx_bodies']],
  ['corpse hands with 3 values', 'b.ph && Array.isArray(b.hd) && b.hd.length === 4 ?', 'b.ph && Array.isArray(b.hd) && b.hd.length >= 3 ?', ['fx_bodies']],
  ['light part list joined with ;', "return A.gear.defs[eq.kind].map(d => P[d[0]]).join(',');", "return A.gear.defs[eq.kind].map(d => P[d[0]]).join(';');", ['run_online']],
  ['reconnect after 900 ms', 'Math.min(8000, 1000 * ++retry)', 'Math.min(8000, 900 * ++retry)', ['reconnect_solo']],
  ['badge says WANDERERS for one', "' WANDERER' + (peersN ? 'S' : '')", "' WANDERERS' + (peersN ? '' : '')", ['menu_online']],
  ['ping every 900 ms', "tx({ t: 'ping', ts: performance.now() }); }, 1000);", "tx({ t: 'ping', ts: performance.now() }); }, 900);", ['admin']],
  ['+10 hounds button sends 9', "data-mode=\"add\" data-n=\"10\"') + btn('− HOUND'", "data-mode=\"add\" data-n=\"9\"') + btn('− HOUND'", ['admin']],
  ['heartbeat at 71 Hz', 'thump(.5 * k + .1, 70)', 'thump(.5 * k + .1, 71)', ['hum_dread']],
  ['hum buzz gain 0.21', 'buzz.gain.value = .2;', 'buzz.gain.value = .21;', ['hum_dread']],
  ['vanish replay 2.6 s', 'const v = Math.min(1, t / 2.7)', 'const v = Math.min(1, t / 2.6)', ['fx_bodies']],
  ['corpse scale with 2 decimals', 'sx: +t.scaleX.toFixed(3)', 'sx: +t.scaleX.toFixed(2)', ['facade']],
  ['exhausted below 21 stamina', 'A.H.stamina < 22) ? 1 : 0, v: d.variant', 'A.H.stamina < 21) ? 1 : 0, v: d.variant', ['facade']],
  ['killer end for every cause', "return t.cause === 'Hound' && at && Number.isFinite(at.x)", 'return at && Number.isFinite(at.x)', ['facade']],
  ['no join when reopening during a run', "if (A && A.started()) tx({ t: 'join' });", 'if (A && A.started()) { }', ['run_online', 'reconnect_solo']],
  ['G parked at -9000', 'else { G.x = G.y = -9e4; G.state = \'patrol\'; }', 'else { G.x = G.y = -9e3; G.state = \'patrol\'; }', ['interp']],
  ['drag target [0,0] when none', 'mv.dragTo = mv.down && cp.d ? cp.d : null;', 'mv.dragTo = mv.down && cp.d ? cp.d : [0, 0];', ['run_online']],
  ['cartograph reach 50 px', 'Math.hypot(p.x - it[0], p.y - it[1]) > 46', 'Math.hypot(p.x - it[0], p.y - it[1]) > 50', ['run_online']],
  ['kill announced every snapshot', 'if (m.mk && m.ms !== killSeq)', 'if (m.mk)', ['run_online']],
  ['room name not encoded', "'/ws?room=' + encodeURIComponent(room)", "'/ws?room=' + room", ['load']],
  ['spawn grace 3 s', 'graceUntil = performance.now() / 1000 + 4; window.__kill = null; window.__glitchSolo', 'graceUntil = performance.now() / 1000 + 3; window.__kill = null; window.__glitchSolo', ['run_online']],
  ['banner shown 7 s', 'banner.hidden = true; }, 8000);', 'banner.hidden = true; }, 7000);', ['run_online', 'admin']],
  ['solo glitches 2500 px from the start', 'Math.hypot(x - A.Ic.x, y - A.Ic.y) < 2600', 'Math.hypot(x - A.Ic.x, y - A.Ic.y) < 2500', ['reconnect_solo']],
  ['peer avatars swept every 2.5 s', 'if (!peers.has(id)) dropAvatar(o); }, 2000);', 'if (!peers.has(id)) dropAvatar(o); }, 2500);', ['load']],
];
/* changes no input can reveal (reported, not counted): the snapshot handler copies every field of the peer record into the drawn peer
 * (Object.assign(o, p, ...)), x and y included, so the 400 px "snap instead of glide" test before it has no effect at all */
const EQUIVALENT = [['peer snap distance 450 px', 'Math.hypot(p.x - o.x, p.y - o.y) > 400', 'the following Object.assign(o, p, ...) copies x and y anyway']];
(async () => {
  const base = L.fromRef(REF), browser = await L.launch(), baseline = {}, results = [];
  const run = async (mp, sc) => { const r = await L.runScene(browser, { mp: Buffer.from(mp), helpers: base.helpers }, sc); return { sha: sha(r.trace), errs: r.errs }; };
  const text = base.mp.toString('utf8');
  for (const [, , , scs] of M) for (const s of scs) if (!baseline[s]) baseline[s] = (await run(text, s)).sha;
  for (const [name, from, to, scs] of M) {
    if (!text.includes(from)) { results.push({ name, applied: false, detected: null, note: 'pattern not found' }); console.log('SKIP ' + name + ' (pattern not found)'); continue; }
    const src = text.replace(from, to), per = [];
    for (const s of scs) { const r = await run(src, s); per.push({ scene: s, differs: r.sha !== baseline[s], errors: r.errs.length }); }
    const detected = per.some(p => p.differs); results.push({ name, applied: true, detected, per });
    console.log((detected ? 'CAUGHT ' : 'MISSED ') + name + '  [' + per.map(p => p.scene + (p.differs ? ' differs' : ' same') + (p.errors ? ' errors ' + p.errors : '')).join(', ') + ']');
  }
  await browser.close();
  const rep = { tool: 'dev/stage-3h0/golden/cli_mutants.js', ref: REF, equivalentNotCounted: EQUIVALENT.map(e => ({ name: e[0], why: e[2] })), mutants: results.length, applied: results.filter(r => r.applied).length, caught: results.filter(r => r.detected).length,
    missed: results.filter(r => r.applied && !r.detected).map(r => r.name), results };
  console.log(`${rep.caught}/${rep.applied} mutants caught` + (rep.missed.length ? '; missed: ' + rep.missed.join('; ') : ''));
  if (OUTF) fs.writeFileSync(OUTF, JSON.stringify(rep, null, 1) + '\n');
  process.exitCode = rep.missed.length || rep.applied !== rep.mutants ? 1 : 0;
})().catch(e => { console.error('ERROR', e && e.stack || e); process.exitCode = 2; });
