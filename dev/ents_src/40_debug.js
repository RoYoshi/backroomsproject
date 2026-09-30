
/* ---------------------------------------------------------------- admin-only DEBUG MODE overlay (never drawn for ordinary players)
 * Layers (each can be switched on its own in the admin panel's DEBUG tab):
 *   ai   - every entity the server sends: state / act, target, last known position and how stale it is, vision range, the last sound it heard,
 *          its search goal, its path, mood, the capture decision, tier and how many players are near
 *   you  - your own movement state, speed, stamina, surface, how visible you are and how far you are heard right now (dashed circle)
 *   srv  - server timings: milliseconds per 60 Hz step, snapshot size, senses / paths per second, tiers, ping, frame rate
 *   log  - what the entities decided, as it happens: state changes, catches, kills (with variant and reason), releases, lamp failures */
E.dbg = null; E.dbgAt = 0;
E.dbgCfg = { on: false, ai: true, you: true, srv: true, log: true, compact: false, side: 'right' };
E.dbgX = { lg: [], pf: null, ping: -1, at: 0 };
E.fps = 60; let fpsT = 0;
E.setDebug = function (list) { E.dbg = list; E.dbgAt = performance.now(); };
/* the extras that ride along with the entity list: new event-log lines and the server's own timings */
E.setDebugX = function (dx) {
  if (!dx) return; const now = performance.now();
  for (const l of dx.lg || []) E.dbgX.lg.push({ s: l[0], t: l[1], x: l[2], at: now });
  if (E.dbgX.lg.length > 40) E.dbgX.lg.splice(0, E.dbgX.lg.length - 40);
  if (dx.pf) E.dbgX.pf = dx.pf; E.dbgX.at = now;
};
E.clearDebug = function () { E.dbg = null; E.dbgX = { lg: [], pf: null, ping: -1, at: 0 }; };
let dbgCv = null;
/* its own canvas above the darkness layer: the overlay must be readable in the dark, and it exists only while an unlocked admin has it on */
function dbgCtx(on) {
  if (!on) { if (dbgCv && dbgCv.style.display !== 'none') dbgCv.style.display = 'none'; return null; }
  if (!dbgCv) { dbgCv = document.createElement('canvas'); dbgCv.id = 'aiDebug'; dbgCv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:8'; document.body.appendChild(dbgCv); }
  dbgCv.style.display = 'block'; const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  if (dbgCv.width !== W * dpr || dbgCv.height !== H * dpr) { dbgCv.width = W * dpr; dbgCv.height = H * dpr; }
  const c = dbgCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); return c;
}
const MONO = '11px ui-monospace,Consolas,monospace';
/* a small panel of text lines; returns the y below it */
function dbox(cx, x, y, w, title, lines, col, colors) {
  const h = 18 + lines.length * 13 + 6;
  cx.save(); cx.globalAlpha = 1; cx.fillStyle = 'rgba(0,0,0,.7)'; cx.fillRect(x, y, w, h); cx.strokeStyle = col; cx.globalAlpha = .55; cx.strokeRect(x + .5, y + .5, w - 1, h - 1); cx.globalAlpha = 1;
  cx.fillStyle = col; cx.font = 'bold 11px ui-monospace,Consolas,monospace'; cx.fillText(title, x + 8, y + 5);
  cx.font = MONO; lines.forEach((l, i) => { cx.fillStyle = colors && colors[i] || '#cfd8cb'; cx.fillText(l, x + 8, y + 20 + i * 13); });
  cx.restore(); return y + h + 6;
}
/* how far you are heard from right now (the same radii the server uses, scaled by the floor) */
function hearRadius(mv, H) {
  const W = window.WORLD; if (!W || !W.NOISE) return 0; const N = W.NOISE, s = mv.s, moving = (mv.speed || 0) > 12; let r = 0;
  if (s === 'walk') r = N.walk; else if (s === 'run') r = N.run; else if (s === 'crouch') r = moving ? N.crouchMove : 0; else if (s === 'crawl') r = moving ? N.crawl : 0; else if (s === 'slide') r = N.slide;
  else if (s === 'vault') r = [N.vaultSlow, N.vaultNormal, N.vaultFast][mv.q | 0] || N.vaultNormal;
  const su = W.SURF && W.SURF[mv.surf]; if (su && su.step) r *= su.step;
  if (H.exhausted) r = Math.max(r, N.exhaled * .6);
  return Math.round(r);
}
function drawEntities(cx, view, list, cfg, stale) {
  const { cam, sc, W, H } = view, X = x => W / 2 + (x - cam.x) * sc, Y = y => H / 2 + (y - cam.y) * sc;
  cx.save(); cx.font = MONO; cx.textBaseline = 'top'; cx.globalAlpha = stale ? .35 : 1;
  for (const d of list) {
    const col = d.k === 'hound' ? '#ff9a5c' : '#9fe8ff', x = X(d.x), y = Y(d.y);
    // vision radius (dashed) and body
    cx.strokeStyle = col; cx.lineWidth = 1; cx.setLineDash([5, 6]); cx.globalAlpha = (stale ? .35 : 1) * .35; cx.beginPath(); cx.arc(x, y, d.vr * sc, 0, TAU); cx.stroke(); cx.setLineDash([]);
    cx.globalAlpha = stale ? .35 : 1;
    cx.beginPath(); cx.arc(x, y, 5, 0, TAU); cx.fillStyle = col; cx.fill();
    cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + Math.cos(d.a) * 26 * sc, y + Math.sin(d.a) * 26 * sc); cx.stroke();
    if (!cfg.compact) {
      // path
      if (d.path && d.path.length) { cx.strokeStyle = 'rgba(120,255,140,.8)'; cx.beginPath(); cx.moveTo(x, y); for (const p of d.path) cx.lineTo(X(p[0]), Y(p[1])); cx.stroke(); }
      // last known position of its target (with age) and the line to it
      if (d.lk) {
        const lx = X(d.lk.x), ly = Y(d.lk.y); cx.strokeStyle = d.lk.seen ? '#ff4d4d' : '#ffd24d'; cx.setLineDash([3, 4]); cx.beginPath(); cx.moveTo(x, y); cx.lineTo(lx, ly); cx.stroke(); cx.setLineDash([]);
        cx.beginPath(); cx.rect(lx - 5, ly - 5, 10, 10); cx.stroke(); cx.fillStyle = cx.strokeStyle; cx.fillText('LKP ' + d.lk.age + 's c' + d.lk.c, lx + 8, ly - 5);
      }
      if (d.hr) { const hx = X(d.hr.x), hy = Y(d.hr.y); cx.strokeStyle = '#d68cff'; cx.beginPath(); cx.arc(hx, hy, 7, 0, TAU); cx.stroke(); cx.fillStyle = '#d68cff'; cx.fillText('HEARD ' + d.hr.ty + ' ' + d.hr.t + 's I' + d.hr.I, hx + 9, hy - 4); }
      if (d.sg) { const sx = X(d.sg.x), sy = Y(d.sg.y); cx.strokeStyle = '#7aa2ff'; cx.beginPath(); cx.moveTo(sx - 6, sy); cx.lineTo(sx + 6, sy); cx.moveTo(sx, sy - 6); cx.lineTo(sx, sy + 6); cx.stroke(); cx.fillStyle = '#7aa2ff'; cx.fillText('SEARCH', sx + 8, sy + 2); }
    }
    // label block
    const lines = [`${d.k.toUpperCase()}#${d.i}  ${d.s}${d.ac && d.ac !== '-' ? '/' + d.ac : ''}  tier:${d.tier}`];
    if (!cfg.compact) {
      lines.push(`tgt:${d.tg || '-'}  v:${d.v}  near:${d.near}` + (d.lit !== undefined ? '  lit:' + d.lit : ''), `mood a${d.mood[0]} f${d.mood[1]} e${d.mood[2]} b${d.mood[3]}`);
      if (d.cp) lines.push(`CAPTURE ${d.cp.m}/${d.cp.ph} ${d.cp.v || ''} t${d.cp.t} next${d.cp.d} n${d.cp.n}`);
      if (d.cd) lines.push('decide: ' + Object.entries(d.cd).map(([k, v]) => k + ':' + v).join(' ').slice(0, 60));
      if (d.sm) lines.push('quirk ' + d.sm.q + ' exposed ' + d.sm.ex + (d.sm.le ? ' light:' + d.sm.le : '') + (d.sm.enc ? ' enc[' + d.sm.enc + ']' : ''));   // internal values: debug mode only, never in normal play
      if (d.pu) lines.push('pursuit ' + (d.pu.blind !== undefined ? 'blind ' + d.pu.blind + 's' : 'seen'));
    } else if (d.cp) lines[0] += `  ${d.cp.m}/${d.cp.ph}`;
    const w = Math.max(...lines.map(l => cx.measureText(l).width)) + 10, h = lines.length * 13 + 6;
    cx.fillStyle = 'rgba(0,0,0,.66)'; cx.fillRect(x + 10, y - h - 6, w, h); cx.fillStyle = col;
    lines.forEach((l, i) => cx.fillText(l, x + 15, y - h - 3 + i * 13));
  }
  cx.restore();
}
function drawYou(cx, view) {
  const A = window.__api, mv = window.__mv; if (!A || !mv || !A.H) return null;
  const { cam, sc, W, H } = view, X = x => W / 2 + (x - cam.x) * sc, Y = y => H / 2 + (y - cam.y) * sc, P = A.H, r = hearRadius(mv, P);
  cx.save();
  if (r > 0) {                                           // how far you are heard right now
    cx.strokeStyle = '#7fe0ff'; cx.lineWidth = 1.2; cx.setLineDash([6, 6]); cx.globalAlpha = .55; cx.beginPath(); cx.arc(X(P.x), Y(P.y), r * sc, 0, TAU); cx.stroke(); cx.setLineDash([]);
    cx.globalAlpha = .9; cx.fillStyle = '#7fe0ff'; cx.font = MONO; cx.textBaseline = 'top'; cx.fillText('heard within ~' + r + ' px', X(P.x) + 6, Y(P.y) - r * sc - 15);
  }
  cx.restore();
  const sector = (document.getElementById('sector') || {}).textContent || '';
  return { r, lines: [`state ${String(mv.s).toUpperCase()}${mv.down ? ' (' + mv.down + ')' : ''}   speed ${Math.round(mv.speed || 0)} px/s`, `stamina ${Math.round(P.stamina)}${P.exhausted ? '  EXHAUSTED' : ''}`,
    `x ${Math.round(P.x)}  y ${Math.round(P.y)}  ${mv.surf || ''}`, sector, `visibility x${(mv.prof === undefined ? 1 : mv.prof).toFixed(2)}   heard ${r ? '~' + r + ' px' : 'nowhere (silent)'}`].filter(Boolean) };
}
/* the death lab's overlay: what the death simulation is doing, drawn over the world (admin only, off in normal play) */
function drawDeathViz(cx, view) {
  const A = window.__api, d = A && A.death && A.death(), S = d && d.active && d.ph; if (!S) return;
  const { cam, sc, W, H } = view, X = x => W / 2 + (x - cam.x) * sc, Y = y => H / 2 + (y - cam.y) * sc, b = S.b, tr = S.trace;
  cx.save(); cx.lineWidth = 1.4; cx.font = MONO; cx.textBaseline = 'top';
  const path = (pts, col, dash) => { if (pts.length < 2) return; cx.strokeStyle = col; cx.setLineDash(dash || []); cx.beginPath(); cx.moveTo(X(pts[0][0]), Y(pts[0][1])); for (let i = 1; i < pts.length; i++) cx.lineTo(X(pts[i][0]), Y(pts[i][1])); cx.stroke(); cx.setLineDash([]); };
  path(tr.b, '#9dff9d'); path(tr.h0, '#ffb15c', [3, 3]); path(tr.h1, '#7fe0ff', [3, 3]); path(tr.eq, '#ffe36b'); path(tr.at, '#ff6f61', [5, 4]);
  const dot = (x, y, r, col, fill) => { cx.beginPath(); cx.arc(X(x), Y(y), r, 0, TAU); if (fill) { cx.fillStyle = col; cx.fill(); } else { cx.strokeStyle = col; cx.stroke(); } };
  const c = Math.cos(b.th), sn = Math.sin(b.th);
  S.h.forEach((h, i) => { const col = i ? '#7fe0ff' : '#ffb15c', lx = h.anc.x + h.off.x, ly = h.anc.y + h.off.y, tx = h.brace ? h.brace.x : b.x + lx * c - ly * sn, ty = h.brace ? h.brace.y : b.y + lx * sn + ly * c;
    cx.strokeStyle = col; cx.globalAlpha = .5; cx.beginPath(); cx.moveTo(X(h.x), Y(h.y)); cx.lineTo(X(tx), Y(ty)); cx.stroke(); cx.globalAlpha = 1; dot(tx, ty, 4, col, false); dot(h.x, h.y, 3, col, true);
    if (h.brace) { cx.fillStyle = col; cx.fillText('brace', X(h.brace.x) + 6, Y(h.brace.y) - 4); } });
  for (const [x, y, t] of tr.hit) { cx.strokeStyle = '#ff4d4d'; cx.beginPath(); cx.moveTo(X(x) - 6, Y(y) - 6); cx.lineTo(X(x) + 6, Y(y) + 6); cx.moveTo(X(x) + 6, Y(y) - 6); cx.lineTo(X(x) - 6, Y(y) + 6); cx.stroke(); }
  if (S.eq.has) dot(S.eq.x, S.eq.y, 4, '#ffe36b', !S.eq.held);
  cx.strokeStyle = '#ffffff'; cx.beginPath(); cx.moveTo(X(b.x), Y(b.y)); cx.lineTo(X(b.x + b.vx * .3), Y(b.y + b.vy * .3)); cx.stroke();      // velocity (x0.3 s)
  cx.strokeStyle = '#d9a3ff'; cx.beginPath(); cx.arc(X(b.x), Y(b.y), 24 * sc, b.th, b.th + clamp(b.om * .25, -2.6, 2.6), b.om < 0); cx.stroke();      // angular velocity
  const fs = Math.hypot(b.vx, b.vy);
  const L = [`t ${d.elapsed.toFixed(2)}s   phase ${S.phase}   ${S.state}`, `speed ${Math.round(fs)} px/s   spin ${b.om.toFixed(1)} rad/s`, `squash ${b.sq.toFixed(2)}   res ${S.res.toFixed(2)}${S.exh < 1 ? '  EXHAUSTED' : ''}`, `light ${S.eq.has ? (S.eq.held ? 'held' : S.eq.st.toLowerCase()) : 'headlamp'}   hat ${S.hat.has ? (S.hat.on ? 'on' : S.hat.st.toLowerCase()) : '-'}`];
  cx.fillStyle = 'rgba(0,0,0,.72)'; cx.fillRect(10, H - 92, 250, 78); cx.fillStyle = '#9dff9d'; L.forEach((t, i) => cx.fillText(t, 18, H - 86 + i * 17));
  cx.restore();
}
E.drawDebug = function (cx0, view) {
  const cfg = E.dbgCfg, lab = window.__dlab, viz = !!(lab && lab.viz && view), on = !!(cfg.on && view), cx = dbgCtx(on || viz); if (!(on || viz) || !cx) return;
  if (viz) drawDeathViz(cx, view);
  if (!on) return;
  const { W, H } = view, now = performance.now();
  if (fpsT) { const f = 1000 / Math.max(1, now - fpsT); E.fps += (f - E.fps) * .05; } fpsT = now;
  const list = E.dbg, stale = now - E.dbgAt > 1500;
  if (cfg.ai && list && list.length) drawEntities(cx, view, list, cfg, stale);
  cx.save(); cx.font = MONO; cx.textBaseline = 'top';
  const bw = 268, bx = cfg.side === 'left' ? 12 : W - bw - 12; let by = 64;
  if (cfg.you) { const y = drawYou(cx, view); if (y) by = dbox(cx, bx, by, bw, 'YOU', y.lines, '#7fe0ff'); }
  if (cfg.srv) {
    const p = E.dbgX.pf, ping = E.dbgX.ping, tiers = { n: 0, m: 0, f: 0 }; for (const d of list || []) tiers[d.tier[0]]++;
    const ln = p ? [`sim ${p.ms} ms/step  (worst ${p.mx})   ${p.ms > 4 ? 'SLOW' : 'ok'}`, `snapshot ${p.kb} KB   players ${p.pl}`, `senses ${p.se}/s   paths ${p.pa}/s`, `entities ${(list || []).length}   near ${tiers.n} · mid ${tiers.m} · far ${tiers.f}`,
      `ping ${ping >= 0 ? Math.round(ping) + ' ms' : '...'}   fps ${Math.round(E.fps)}`] : ['waiting for the server...'];
    by = dbox(cx, bx, by, bw, 'SERVER', ln, '#9dff9d', p && p.ms > 4 ? [ '#ff8a7a'] : null);
  }
  if (cfg.log) {
    const L = E.dbgX.lg.slice(-11), cols = [];
    const ln = L.length ? L.map(l => { const a = (now - l.at) / 1000; cols.push(/KILLED/.test(l.x) ? '#ff6f61' : /caught|released|now /.test(l.x) ? '#ffb15c' : /lamps/.test(l.x) ? '#ffe36b' : a > 30 ? '#7d8a80' : '#b9c7bc'); return ('[' + l.t.toFixed(0) + '] ' + l.x).slice(0, 44); }) : ['(nothing yet)'];
    by = dbox(cx, bx, by, bw, 'AI EVENTS', ln, '#ffb15c', cols);
  }
  cx.globalAlpha = 1; cx.fillStyle = 'rgba(0,0,0,.7)'; const title = 'DEBUG MODE' + (cfg.ai ? ' · ' + (list ? list.length : 0) + ' ENTITIES' : '') + '  (admin)', tw = cx.measureText(title).width + 20;
  cx.fillRect(W / 2 - tw / 2, 6, tw, 22); cx.fillStyle = '#9dff9d'; cx.fillText(title, W / 2 - tw / 2 + 10, 11);
  cx.restore();
};

/* light failures the server announces: [x, y, r, seconds left] -> lamp dimming for the lighting pass */
E.fails = []; E.failsAt = 0;
E.setFails = function (list) {
  const had = E.fails.length; E.fails = (list || []).map(f => ({ x: f[0], y: f[1], r: f[2], until: performance.now() / 1000 + f[3] })); E.failsAt = performance.now();
  if (E.fails.length > had && E.onFail) E.onFail(E.fails[E.fails.length - 1]);
};
/* multiplier (0..1) for a lamp at (x,y): flickers hard while a failure is active near it */
E.lamp = function (x, y, t) {
  if (!E.fails.length) return 1; const now = performance.now() / 1000; let m = 1;
  for (const f of E.fails) { if (f.until < now) continue; const d = Math.hypot(x - f.x, y - f.y); if (d > f.r) continue; const k = 1 - sm(f.r * .55, f.r, d); const fl = Math.sin(t * 61 + x * .07) > .65 ? .5 : 0; m *= 1 - k * (.94 - fl * .5); }
  return m;
};
})();
