
/* ---------------------------------------------------------------- SMILER: darkness with a face
 * A drifting mass of black with long limp arms.  What you remember is the grin: a huge crescent of teeth and two glowing eyes,
 * drawn again on the darkness layer (E.smilerGlow) so it can be seen at the edge of the dark even where nothing lights the body. */
const SC = { black: 0x030404, black2: 0x0a0c0b, rim: 0x1b201d, glow: 0xf1f4dc, glow2: 0xdfe6c8, gap: 0x0a0d0b };
E.initSmiler = function (view) {
  const Gf = view.body.constructor;
  view.removeChildren();
  view.mist = new Gf(); view.arms = new Gf(); view.body = new Gf(); view.face = new Gf();
  view.addChild(view.mist, view.arms, view.body, view.face);
  view.__smiler = true; view.__s = { seed: Math.random() * 100, fx: 0, ex: 0 };
};

/* the mouth: an exaggerated crescent, upper and lower rows of teeth.  g draws with the PIXI or canvas API through small callbacks */
function grinShape(f) {                    // f: 0..1 how far the face has formed
  const gw = 15 + 9 * f, depth = 7 + 15 * f;
  return { gw, depth, n: 11 };
}
function paintFace(gfx, f, t, alpha, seed) {
  gfx.clear();
  const S = grinShape(f), gw = S.gw, dp = S.depth, a = alpha;
  gfx.ellipse(0, -3, 19, 20).fill({ color: SC.black, alpha: .98 }).stroke({ color: SC.rim, width: 1.4, alpha: .6 });
  // eyes: tall, slightly slanted, brighter as the face forms
  const ew = 2.3 + .9 * f, eh = 4.6 + 2.6 * f;
  for (const sx of [-1, 1]) {                                                    // tall, narrow, leaning in: no pupils, nothing behind them
    const ex = sx * 8.6, ey = -10.5, sl = sx * .16, tilt = (x, y) => [ex + x * Math.cos(sl) - y * Math.sin(sl), ey + x * Math.sin(sl) + y * Math.cos(sl)];
    const ring = (k, n = 14) => { const o = []; for (let i = 0; i < n; i++) { const t = i / n * TAU, p = tilt(Math.cos(t) * (ew + k), Math.sin(t) * (eh + k)); o.push(p[0], p[1]); } return o; };
    gfx.poly(ring(2.2)).fill({ color: SC.glow, alpha: .12 * a });
    gfx.poly(ring(.9)).fill({ color: SC.glow, alpha: .3 * a });
    gfx.poly(ring(0)).fill({ color: SC.glow, alpha: a });
  }
  // the grin
  const top = x => 1 + (1 - Math.pow(x / gw, 2)) * 2.5, bot = x => 1 + (1 - Math.pow(x / gw, 2)) * dp;
  const pts = []; for (let i = 0; i <= 16; i++) { const x = -gw + i / 16 * 2 * gw; pts.push(x, top(x)); } for (let i = 16; i >= 0; i--) { const x = -gw + i / 16 * 2 * gw; pts.push(x, bot(x)); }
  gfx.poly(pts).fill({ color: SC.glow, alpha: a });
  gfx.moveTo(-gw, 1).quadraticCurveTo(0, 1 + (top(0) - 1) * 2 + (bot(0) - top(0)) * .0, gw, 1).stroke({ color: SC.glow2, width: 1.6, alpha: a });
  // the line where the rows meet is a zig-zag of interlocking points; thin gaps separate the teeth
  const mid = x => (top(x) + bot(x)) / 2, N2 = S.n * 2;
  const zz = []; for (let i = 0; i <= N2; i++) { const x = -gw + i / N2 * 2 * gw, m = mid(x), amp = 1.5 + .6 * f; zz.push([x, m + (i % 2 ? amp : -amp)]); }
  gfx.moveTo(zz[0][0], zz[0][1]); for (let i = 1; i < zz.length; i++) gfx.lineTo(zz[i][0], zz[i][1]); gfx.stroke({ color: SC.gap, width: 1.1, alpha: .85 * a, join: 'miter' });
  for (let i = 1; i < S.n; i++) {
    const x = -gw + i / S.n * 2 * gw;
    gfx.moveTo(x, top(x) + .4).lineTo(x + Math.sin(i * 2.3) * .4, mid(x) - 1.4).stroke({ color: SC.gap, width: .8, alpha: .6 * a });
    gfx.moveTo(x + .5, mid(x) + 1.4).lineTo(x + .2, bot(x) - .4).stroke({ color: SC.gap, width: .8, alpha: .6 * a });
  }
}

E.drawSmiler = function (view, sm_, t, dt, vis, o) {
  if (!view.__smiler) E.initSmiler(view);
  const S = view.__s, f = clamp(sm_.face === undefined ? (sm_.state === 'watch' || sm_.state === 'pursue' ? 1 : .7) : sm_.face, 0, 1);
  /* EXPOSURE BUDGET: the face is always the readable part; the rest of the creature is an impression.  It is shown more only at commitment, at a very
   * close range, or in the first moment of a glimpse - and the longer somebody stares at it, the less of it there is to study. */
  const HH = window.__api && window.__api.H, dd = HH ? Math.hypot(view.x - HH.x, view.y - HH.y) : 600;
  if (S.look === undefined) S.look = 0;
  if (vis > .3 && dd < 760) S.look = Math.min(24, S.look + dt); else S.look = Math.max(0, S.look - dt * .6);
  const commit = sm_.state === 'ATTACKING' || sm_.state === 'PROVOKED' || sm_.state === 'PLAYING' || sm_.special || sm_.act === 'rush' ? 1 : 0;
  let reveal = Math.max(commit, sm(300, 110, dd) * .8, (1 - sm(1.2, 3.5, S.look)) * .55, o && o.reveal || 0);
  const study = commit ? 0 : sm(5, 15, S.look) * .5;
  S.fx += (f - S.fx) * (1 - Math.exp(-dt * 6));
  const ff = S.fx, dark = 1 - clamp(vis, 0, 1);
  // mist / darkness: soft black blobs drifting around the body
  const mg = view.mist; mg.clear();
  for (let i = 0; i < 8; i++) {
    const a = t * (.25 + (i % 3) * .07) + i * 2.1 + S.seed, r = 10 + (i % 4) * 5;
    mg.ellipse(Math.cos(a) * r * 1.4, 6 + Math.sin(a * 1.2) * r, 15 + (i % 3) * 5, 11 + (i % 2) * 6).fill({ color: SC.black, alpha: .1 + .04 * (i % 3) });
  }
  // long limp arms, swaying slowly; fingers far too long
  const ag = view.arms; ag.clear();
  S.rch = (S.rch || 0) + ((sm_.act === 'rush' || sm_.state === 'PROVOKED' || commit ? -14 : 0) - (S.rch || 0)) * (1 - Math.exp(-dt * 3.2));   // reach eases in and out: no posture switch to read
  const sway = Math.sin(t * .8 + S.seed) * 4, reach = S.rch;
  for (const sx of [-1, 1]) {
    const bx = sx * 22, sw = sway * sx;
    const ex = sx * (38 + sw * .4), ey = 22 + reach, hx2 = sx * (46 + sw), hy2 = 56 + reach * 1.5 + Math.sin(t * 1.1 + sx) * 3;
    ag.moveTo(bx, -2).quadraticCurveTo(ex + sx * 8, ey - 8, hx2, hy2).stroke({ color: SC.black, width: 8, cap: 'round' });
    ag.moveTo(bx, -2).quadraticCurveTo(ex + sx * 8, ey - 8, hx2, hy2).stroke({ color: SC.black2, width: 3.6, cap: 'round', alpha: .8 });
    for (let k = 0; k < 5; k++) { const fa = Math.PI / 2 + sx * (-.55 + k * .28) + Math.sin(t * 1.3 + k) * .08, fl = 15 + (k % 2) * 4; ag.moveTo(hx2, hy2).lineTo(hx2 + Math.cos(fa) * fl, hy2 + Math.sin(fa) * fl).stroke({ color: SC.black2, width: 1.5, cap: 'round' }); }
  }
  // the body: a tall black mass, shoulders, a hint of legs
  const bg = view.body; bg.clear();
  bg.ellipse(0, 12, 21, 30).fill({ color: SC.black, alpha: .97 });
  bg.ellipse(0, -2, 31, 12).fill({ color: SC.black, alpha: .97 });
  bg.poly([-8, 30, -13, 58, -7, 60, -1, 34, 2, 34, 8, 60, 14, 57, 9, 30]).fill({ color: SC.black2, alpha: .9 });
  bg.ellipse(-6, 4, 6, 14).fill({ color: SC.rim, alpha: .16 });
  const bodyAlpha = clamp(.12 + sm(.18, .78, vis) * .88, 0, 1) * clamp(.36 + .64 * reveal, 0, 1) * (1 - study);
  bg.alpha = bodyAlpha; ag.alpha = bodyAlpha * (.4 + .5 * reveal); view.mist.alpha = clamp(.35 + dark * .4 + study * .5, 0, 1);
  // face
  const fa = clamp(.18 + ff * .82, 0, 1);
  paintFace(view.face, ff, t, .94 * fa, S.seed);
  view.face.alpha = 1;
  view.face.rotation = (sm_.act === 'watch' || sm_.state === 'WATCHING' ? Math.sin(t * 1.35 + S.seed) * .05 : Math.sin(t * 3.4 + S.seed) * .014) + (sm_.head || 0) * .25;
  view.face.position.set(0, -6 - ff * 2);
  const grow = 1 + ff * .12 + (sm_.special ? .08 * Math.sin(t * 9) : 0);
  view.face.scale.set(grow, grow * (1 + .06 * Math.sin(t * 2.2 + S.seed)));
};

/* the glow on the darkness layer (canvas 2D, world transform already applied and clipped to the player's line of sight) */
E.smilerGlow = function (n, view, sm_, t, pl, k) {
  const d = Math.hypot(view.x - pl.x, view.y - pl.y), f = clamp(view.__s ? view.__s.fx : (sm_.face === undefined ? .8 : sm_.face), 0, 1);
  const a = view.alpha, blk = window.__api && window.__api.V && window.__api.V.blackout ? 1.25 : 1;
  const i = (1 - sm(200, 1100, d)) * (.2 + .72 * (1 - a)) * Math.min(1, .25 + a * 2.8) * (.14 + .86 * f) * blk;
  if (i < .004) return;
  const flick = Math.sin(t * 43 + view.x) > .985 ? .55 : 1;
  const S = grinShape(f), gw = S.gw, dp = S.depth, top = x => 1 + (1 - Math.pow(x / gw, 2)) * 2.5, bot = x => 1 + (1 - Math.pow(x / gw, 2)) * dp;
  n.save(); n.translate(view.x, view.y); n.rotate(view.rotation); n.scale(view.scale.x, view.scale.y);
  n.translate(0, -6 - f * 2); const gr = 1 + f * .12; n.scale(gr, gr);
  n.globalAlpha = Math.min(1, i * flick); n.shadowColor = '#edffe7'; n.shadowBlur = 5 + 10 * f * (k || 1); n.fillStyle = '#f2f5df';
  const ew = 2.3 + .9 * f, eh = 4.6 + 2.6 * f;
  for (const sx of [-1, 1]) { n.beginPath(); n.ellipse(sx * 8.6, -10.5, ew, eh, sx * .16, 0, TAU); n.fill(); }
  n.beginPath(); n.moveTo(-gw, top(-gw));
  for (let q = 0; q <= 16; q++) { const x = -gw + q / 16 * 2 * gw; n.lineTo(x, top(x)); }
  for (let q = 16; q >= 0; q--) { const x = -gw + q / 16 * 2 * gw; n.lineTo(x, bot(x)); }
  n.closePath(); n.fill();
  n.shadowBlur = 0; n.strokeStyle = 'rgba(8,10,8,.85)'; n.lineWidth = 1.05; n.lineJoin = 'miter';
  const N2 = S.n * 2, amp = 1.5 + .6 * f;
  n.beginPath(); for (let q = 0; q <= N2; q++) { const x = -gw + q / N2 * 2 * gw, y = (top(x) + bot(x)) / 2 + (q % 2 ? amp : -amp); q ? n.lineTo(x, y) : n.moveTo(x, y); } n.stroke();
  for (let q = 1; q < S.n; q++) { const x = -gw + q / S.n * 2 * gw; n.beginPath(); n.moveTo(x, top(x)); n.lineTo(x, bot(x)); n.stroke(); }
  n.restore();
};
