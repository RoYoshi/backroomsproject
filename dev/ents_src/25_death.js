
/* ---------------------------------------------------------------- how a death plays out: four variants per killer
 * The server decides which one (ai.js: variant A-D, and the real wall behind the victim for the hound's wall impact).  Here they only
 * change the choreography of the death sequence: how far the body is knocked, whether it is dragged, when the blows land, whether
 * the world blacks out.  Nothing is teleported: every distance is limited by the level's own geometry in the bundle (safeDistance). */
E.deathPlan = function (jl, kind, K) {
  const v = K && /^[ABCD]$/.test(K.v) ? K.v : 'A';
  const wall = K && K.w && K.w.length === 3 ? { x: K.w[0], y: K.w[1], ang: K.w[2] } : null;
  const P = { v, wall, kn: 34, dr: kind === 'Hound' ? 128 : 86, hits: null, kt: [.08, .36], dw: [2.03, 3.12], spin: 1.65, squish: 1, black: null };
  if (kind === 'Hound') {
    if (v === 'A') { P.kn = 46; P.dr = 40; P.hits = [.2, .62, 1.05, 1.55]; P.spin = 1.9; }                               // at the throat: knocked hard, held down
    else if (v === 'B') { P.kn = 12; P.dr = 140; P.hits = [.3, .85, 1.5, 2.1]; P.dw = [.9, 2.2]; P.spin = 1.2; }             // pulled down and dragged away
    else if (v === 'C') {                                                                                                  // slammed into a wall that is really there
      const d = wall ? Math.hypot(wall.x - jl.victim.x, wall.y - jl.victim.y) : 40;
      P.kn = clamp(d - 17, 0, 110); P.dr = 0; P.kt = [.04, .2]; P.hits = [.2, .21, .8, 1.4]; P.spin = 2.2;
    } else { P.kn = 24; P.dr = 26; P.hits = [.45, .95, 1.55]; P.spin = .3; P.squish = 1.9; }                                // D: nothing left, goes down in a heap
  } else {
    if (v === 'B') { P.kn = 0; P.dr = 0; P.hits = [.7, 1.2, 1.7]; P.spin = 1.4; P.black = t => sm(.05, .12, t) * (1 - sm(.85, 1.6, t)); }   // cornered: it closes, everything goes black, the body falls where it stood
    else if (v === 'C') { P.kn = 18; P.dr = 36; P.hits = [.55, 1.1, 1.6]; P.black = t => sm(.02, .07, t) * (1 - sm(.4, .9, t)) * .8; }         // the lights failed: the last dark
    else if (v === 'D') { P.kn = 26; P.dr = 70; P.hits = [.6, 1.2, 1.8]; P.dw = [1.6, 3.0]; }                                                // it has played long enough
  }
  return P;
};

/* extra marks a variant leaves on the floor (drawn into the same Graphics as the blood, after it) */
const hsh = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
E.deathExtras = function (g, jl, t) {
  if (jl.kind !== 'Hound' || jl.variant !== 'C' || !jl.wall) return;
  const at = jl.ph && jl.ph.wallHit ? jl.ph.wallHit.t : jl.kt[1] * .9; if (t < at) return;
  const w = jl.wall, back = w.ang + Math.PI, k = clamp((t - at) / .55, 0, 1), fresh = 1 - clamp((t - .2) / 9, 0, 1), col = fresh > .5 ? 0x7a1512 : 0x4a0b0a;
  const px = -Math.sin(w.ang), py = Math.cos(w.ang);
  // where the body struck: a wet smear running along the base of the wall, and spray thrown back off it
  g.moveTo(w.x - px * 16 - Math.cos(w.ang) * 3, w.y - py * 16 - Math.sin(w.ang) * 3).lineTo(w.x + px * 16 - Math.cos(w.ang) * 3, w.y + py * 16 - Math.sin(w.ang) * 3).stroke({ color: col, width: 6, alpha: .5 * k, cap: 'round' });
  for (let i = 0; i < 20; i++) {
    const a = back + (hsh(i, 1) - .5) * 1.7, d = (6 + hsh(i, 2) * 50) * k, s = .9 + hsh(i, 3) * 2.4, x = w.x + Math.cos(a) * d, y = w.y + Math.sin(a) * d;
    g.ellipse(x, y, s * (1 + .8 * hsh(i, 4)), s).fill({ color: hsh(i, 5) < .5 ? 0x7a1512 : 0x4a0b0a, alpha: .85 });
    if (k < 1) g.moveTo(x, y).lineTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6).stroke({ color: 0xa3201a, width: 1.3, alpha: .7 * (1 - k) });
  }
  // a run of blood from the wall down to where the body ended up
  const jx = jl.body.x, jy = jl.body.y, len = Math.hypot(jx - w.x, jy - w.y);
  if (len > 4) g.moveTo(w.x, w.y).lineTo(jx, jy).stroke({ color: 0x5c0f0c, width: 9, alpha: .34 * k, cap: 'round' });
};

/* the smiler that attacks in a death sequence: fully formed, arms reaching */
E.attackSmiler = function (view, t, dt) {
  E.drawSmiler(view, { state: 'ATTACKING', act: 'rush', face: 1, head: 0, special: 1 }, t, dt || .016, 1);
};

/* ---------------------------------------------------------------- offline (no server): the same variety, chosen from the geometry around the victim */
const kHist = {};
function wallBehind(A, x, y, a, maxD) {
  const d = A.Uc(x, y, a, maxD + 40); if (d < 55 || d > maxD) return null;
  if (A.Uc(x, y, a + .5, maxD + 40) < 45 || A.Uc(x, y, a - .5, maxD + 40) < 45) return null;
  return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, ang: a };
}
function openFrac(A, x, y, R) { let open = 0; const n = 24; for (let i = 0; i < n; i++) if (A.Uc(x, y, i / n * TAU, R) >= R - 6) open++; return open / n; }
E.localKill = function (kind, H, src) {
  const A = API(); if (!A || !A.Uc) return { v: 'A', k: kind, w: 0 };
  const ang = Math.atan2(H.y - src.y, H.x - src.x), rel = Math.abs(angDiff(ang, H.angle)), facing = rel > 2.0, behind = rel < 1.0;
  let items, wall = null;
  if (kind === 'Hound') {
    wall = wallBehind(A, H.x, H.y, ang, 128); const exhausted = H.stamina < 22 || H.exhausted;
    items = [{ k: 'A', w: facing ? 1.5 : .55 }, { k: 'B', w: .95 * (behind ? 1.25 : 1) }, { k: 'C', w: wall ? 1.7 : 0 }, { k: 'D', w: exhausted ? 3.2 * (behind ? 1.3 : .6) : 0 }];
  } else {
    const cornered = openFrac(A, H.x, H.y, 380) < .34;
    items = [{ k: 'A', w: 2 }, { k: 'B', w: cornered ? 3 : 0 }, { k: 'C', w: 0 }, { k: 'D', w: 0 }];
  }
  const hist = kHist[kind] || (kHist[kind] = []);
  for (const it of items) { const i = hist.lastIndexOf(it.k); if (i >= 0) { const age = hist.length - i; it.w *= age === 1 ? .35 : age === 2 ? .6 : .8; } }
  let tot = 0; for (const it of items) tot += Math.max(0, it.w);
  let r = Math.random() * tot, v = 'A'; for (const it of items) { if (it.w <= 0) continue; v = it.k; r -= it.w; if (r <= 0) break; }
  hist.push(v); if (hist.length > 6) hist.shift();
  return { v, k: kind, w: v === 'C' && wall ? [wall.x, wall.y, wall.ang] : 0 };
};
