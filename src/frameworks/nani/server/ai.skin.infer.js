/** @part generated/server/ai.js - N.A.N.I.: the Skin-Stealer's inference (Trial 3 R12): the ways its quarry could have gone, how likely each, what ruled one out
 * provides: SKI, skHypAt, skHypDbg, skHypHeard, skHypOf, skHyps
 * uses: SK, TAU, clamp, skMindLog
 * writes: -
 */
/* ---------------------------------------------------------------- THE SKIN-STEALER'S INFERENCE (Trial 3 R12; dev/trial-3-r9-overhaul/)
 * R8 guessed a quarry's way with ONE walk through the level: from its last evidence along their heading, and where something blocked the
 * way a seeded draw chose a side.  The other way existed only as "the other side of the first turn, once the first failed".  R12 keeps the
 * same evidence and the same physics but holds the alternatives openly, as HYPOTHESES (pack 02, "belief and imperfect prediction"):
 *   - from its belief of where they were and which way they moved (seen, or heard: never where they really are), it walks their heading
 *     until the way is blocked; there it lists every opening a person could take (16 directions, adjacent ones merged into one opening,
 *     each opening's way the one nearest their heading), walks each on (later blocks: the turn that keeps the heading best, no draw), and
 *     adds "they stopped or hid near where it last had them".  At most SKI.maxHyp (4) are kept.
 *   - each has a prior: exp(cos of its turn) - R8's own measure of how a person keeps their heading (straight on e, a right angle 1, back
 *     1/e) - and the stop its own weight (more when they were slow or their footsteps stopped).  Normalised, these are its probabilities.
 *   - evidence moves them: a place on a way's own stretch that it searched or waited at and found empty DISPROVES the way (its
 *     probability x .1, kept for the record: a wrong guess has cost it the time it spent); a fresh sound it takes for theirs re-weighs every way by
 *     how well it explains the sound (its nearest point a person could have reached by then, at a person's pace) and the ways far worse
 *     than the best are REJECTED, with the sound named.  The ways stay anchored on its last sighting while sounds and empty places weigh
 *     them; they are listed afresh from a newer sighting, or from its newest evidence once nothing is left of them.
 *   - its bet is still R8's own walk of their way (a seeded error at each turn that INTELLIGENCE shrinks and starvation grows - on the
 *     same scale as these priors); R12 labels each guess with the way it lies on (skHypOf), weighs it by how likely that way now is,
 *     never makes a guess on a way evidence has ruled out, and adds a guess along a likely way none of R8's lies on.
 * Bounded: the ways are listed again only on new evidence and at most every SKI.rebuild s (a few hundred line tests, no route search);
 * the real routes (geo.path) stay in the interception's own check (at most four).  Nothing here reads a player's real place. */
const SKI = Object.freeze({
  maxHyp: 4,                                     // ways on it holds at once
  dirs: 16,                                      // directions tried at a block (adjacent open ones are one opening)
  probe: 210,                                    // px a way must be open for a person to take it
  stopW: .3, stopSlow: 1.4, stopQuiet: .8,       // weight of "they stopped near where it last had them": always; when they were slow; when their footsteps stopped
  disproved: .1,                                 // a disproved way's weight is multiplied by this (kept, not erased)
  soundFit: 90, reject: .2,                      // a sound's fit to a way: px of spread (plus half the sound's fuzz); under this share of the best way's, a way is rejected
  pace: [40, 320],                               // px/s a person may have gone along a way since the evidence (standing still .. running)
  minP: .06,                                     // a way less likely than this is not worth a guess
  onWay: 200,                                    // px: a place this near a way's own stretch lies on that way
  rebuild: .4,                                   // seconds between two listings (bounded work)
  fresh: 4,                                      // seconds of evidence after which an interception is not tried: it cannot get ahead of where they might be
  uWeak: 900,                                    // px: a guess whose uncertainty on its arrival is wider than this is a weak one
});
/* the ways on from a place and a heading (x, y, vx, vy): R12's hypotheses, unweighted by evidence */
function skHypList(eng, e, x0, y0, vx, vy) {
  const geo = eng.geo, sp = Math.hypot(vx, vy), out = [], step = 48, look = SK.predictLook;
  const walk = (x, y, a, d) => geo.lineClear(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, 16, 'walk');
  const norm = a => +(((a % TAU) + TAU) % TAU).toFixed(2);
  const on = (x, y, th, s, pts, turns) => {                                     // walk on; at a block the turn that keeps the heading best
    while (s < look) {
      if (!walk(x, y, th, 100)) {
        if (turns.length >= SK.predictTurns) break;
        let best = null, bc = -2; for (let k = -4; k <= 4; k++) { if (!k) continue; const a = th + k * Math.PI / 8; if (walk(x, y, a, SKI.probe) && Math.cos(k * Math.PI / 8) > bc) { bc = Math.cos(k * Math.PI / 8); best = a; } }
        if (best === null) break; turns.push({ x: Math.round(x), y: Math.round(y), a: norm(best) }); th = best;
      }
      x += Math.cos(th) * step; y += Math.sin(th) * step; s += step; pts.push({ x, y, s });
    }
    return pts;
  };
  if (sp >= 40) {
    const th = Math.atan2(vy, vx); let x = x0, y = y0, s = 0; const pre = [{ x, y, s: 0 }];
    while (s < look && walk(x, y, th, 100)) { x += Math.cos(th) * step; y += Math.sin(th) * step; s += step; pre.push({ x, y, s }); }
    if (s >= look) out.push({ k: 'on', a: norm(th), turn: 0, pts: pre, turns: [], fs: -1, w: Math.exp(1) });
    else {
      // the openings here: runs of adjacent open directions (straight on is blocked, so none wraps round it); a wide one (over 6
      // directions, 135 deg) is split in parts of about four; each opening's way is its direction nearest their heading
      const D = SKI.dirs, runs = []; let cur = null;
      for (let i = 1; i < D; i++) { if (walk(x, y, th + i * TAU / D, SKI.probe)) { if (!cur) runs.push(cur = []); cur.push(i); } else cur = null; }
      const opens = []; for (const R of runs) { const k = R.length <= 6 ? 1 : Math.ceil(R.length / 4), n = Math.ceil(R.length / k); for (let j = 0; j < R.length; j += n) opens.push(R.slice(j, j + n)); }
      for (const R of opens) {
        let bi = R[0]; for (const i of R) if (Math.cos(i * TAU / D) > Math.cos(bi * TAU / D)) bi = i;
        const a = th + bi * TAU / D, c = Math.cos(bi * TAU / D), turns = [{ x: Math.round(x), y: Math.round(y), a: norm(a), n: opens.length }];
        const pts = on(x + Math.cos(a) * step, y + Math.sin(a) * step, a, s + step, pre.concat([{ x: x + Math.cos(a) * step, y: y + Math.sin(a) * step, s: s + step }]), turns);
        if (pts.length >= 5) out.push({ k: c < -.7 ? 'back' : 'turn', a: norm(a), turn: +Math.acos(clamp(c, -1, 1)).toFixed(2), pts, turns, fs: s, w: Math.exp(c) });
      }
    }
  }
  return out;
}
/* the hunt's hypotheses now.  They are ANCHORED on a sighting (its place, heading and time): listed when it last saw them (or, in a hunt
 * begun from a memory, from that), and listed again only from a newer sighting - or, when evidence has ruled out every one, from its
 * newest evidence (a heard place and the heading its sounds gave).  Between, sounds re-weigh them (skHypHeard) and empty places and failed
 * turns disprove them; at most every SKI.rebuild s */
function skHyps(eng, e, H) {
  const now = eng.now; let Y = H.hyp;
  const fresh = Y && H.ev === 'seen' && H.bt > Y.t + 1e-6, dead = Y && !Y.list.some(h => h.f >= 1) && H.bt > Y.t + 1e-6;   // (nothing left of them, and newer evidence to list from)
  if (!Y || ((fresh || dead) && now - Y.at >= SKI.rebuild)) {
    const list = skHypList(eng, e, H.x, H.y, H.vx, H.vy).sort((a, b) => b.w - a.w).slice(0, SKI.maxHyp - 1);
    const sp = Math.hypot(H.vx, H.vy), quiet = H.ev === 'heard' && H.heard >= 2;
    list.push({ k: 'stop', a: null, turn: 0, pts: [{ x: H.x, y: H.y, s: 0 }], turns: [], fs: -1, w: SKI.stopW + (sp < 60 ? SKI.stopSlow : 0) + (quiet ? SKI.stopQuiet : 0) });
    list.forEach((h, i) => { h.id = (Y ? Y.n : 0) + i + 1; h.f = 1; h.lk = 1; h.why = ''; });
    Y = H.hyp = { at: now, t: H.bt, x: H.x, y: H.y, vx: H.vx, vy: H.vy, u: H.u, ev: H.ev, n: (Y ? Y.n : 0) + list.length, list, bet: 0, builds: (Y ? Y.builds : 0) + 1, heard: null };
    e.tally.hypBuild = (e.tally.hypBuild || 0) + 1;
  }
  // what it has found since: an empty place on a way's own stretch - a step clear of its fork (near the fork an empty place says nothing
  // about which way they took: R8's failed turn steers its own walk, not these); the stop: where it last had them - the way is disproved
  // (not erased: the record of what the wrong guess cost)
  for (const h of Y.list) {
    if (h.f < 1) continue;
    const empty = H.failed.find(f => f.t > Y.t && h.pts.some(q => (h.k === 'stop' || q.s > h.fs + SK.failedNear) && Math.hypot(q.x - f.x, q.y - f.y) < SK.failedNear * .75));
    if (empty) { h.f = SKI.disproved; h.why = `found empty at ${empty.x},${empty.y} (${empty.k})`; skMindLog(e, H, now, 'disproved', h.pts[h.pts.length - 1].x, h.pts[h.pts.length - 1].y, 0, `way ${h.id} (${h.k})`); }
  }
  let S = 0; for (const h of Y.list) S += h.w * h.f * h.lk; for (const h of Y.list) h.p = S > 0 ? h.w * h.f * h.lk / S : 0;
  return Y;
}
/* a fresh sound it takes for theirs (before the belief moves to it): how well does each way explain it?  Its nearest point that a person
 * could have reached by then (at SKI.pace) - near the sound, the way is likelier; far, less; much farther than the best (under SKI.reject
 * of its likelihood) it is REJECTED, the sound named.  What the belief does next is skHeardQuarry's (it moves to the sound: the ways are
 * listed again from there) */
function skHypHeard(eng, e, H, q) {
  const Y = skHyps(eng, e, H);                                                       // (its ways as they stand before this sound: listed now if it held none)
  const dt = Math.max(0, q.t - Y.t), fuzz = Y.u + q.u, lo = SKI.pace[0] * dt - fuzz, hi = SKI.pace[1] * dt + fuzz, sg = SKI.soundFit + q.u * .5;
  const live = Y.list.filter(h => h.f >= 1), L = new Map(); let mx = 0;
  for (const h of live) {
    let d = 1e9; for (const p of h.pts) if (p.s >= lo && p.s <= hi) d = Math.min(d, Math.hypot(p.x - q.x, p.y - q.y));
    const l = d >= 1e9 ? 0 : Math.exp(-Math.pow(Math.max(0, d - q.u * .5), 2) / (2 * sg * sg)); L.set(h, l); if (l > mx) mx = l;
  }
  if (!(mx > 0)) { Y.heard = { t: +q.t.toFixed(2), fit: 0, of: live.length, shift: 0 }; return; }   // (none explains it: skFits let it through on the belief's ring alone)
  const p0 = new Map(Y.list.map(h => [h, h.p])); let fit = 0;
  for (const h of live) { const rel = L.get(h) / mx; if (rel < SKI.reject) { h.f = SKI.disproved; h.why = `a sound at ${Math.round(q.x)},${Math.round(q.y)} does not fit it`; } else { fit++; h.lk = Math.max(.05, h.lk * rel); } }
  let S = 0; for (const h of Y.list) S += h.w * h.f * h.lk; for (const h of Y.list) h.p = S > 0 ? h.w * h.f * h.lk / S : 0;
  let shift = 0; for (const h of Y.list) shift = Math.max(shift, h.p - p0.get(h));
  Y.heard = { t: +q.t.toFixed(2), fit, of: live.length, shift: +shift.toFixed(2) };
  skMindLog(e, H, q.t, 'heard', q.x, q.y, q.u, `fits ${fit} of ${live.length} ways`);
}
/* which of its ways a place lies on: the way whose own stretch (beyond its fork; the stop: where it last had them) passes nearest, within
 * SKI.onWay px - or none (a place on the stretch all its ways share, or off them all) */
function skHypOf(Y, x, y) {
  let best = null, bd = SKI.onWay;
  for (const h of Y.list) for (const q of h.pts) if (q.s > h.fs) { const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = h; } }
  return best;
}
/* where they would be along a way by now (from its anchor, at a walker's pace; never past its end), on open floor */
function skHypAt(Y, h, now, geo, rc) {
  let i = Math.min(h.pts.length - 1, Math.round(clamp(140 * (now - Y.t) + 150, 250, SK.predictLook) / 48));
  while (i > 2 && !geo.clear(h.pts[i].x, h.pts[i].y, rc, 'walk')) i--;
  return h.pts[i];
}
/* the overlay's and the tests' view: each way, its kind, first turn, probability and why it was ruled out */
function skHypDbg(H) {
  const Y = H && H.hyp; if (!Y) return null;
  return { n: Y.list.length, bet: Y.bet, builds: Y.builds, from: Y.ev, heard: Y.heard || null, ways: Y.list.map(h => [h.id, h.k, h.a, +h.p.toFixed(2), h.why]) };
}
