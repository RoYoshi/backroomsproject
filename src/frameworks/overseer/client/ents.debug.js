
/* ---------------------------------------------------------------- admin-only DEBUG MODE overlay (never drawn for ordinary players)
 * Layers (each can be switched on its own in the admin panel's DEBUG tab):
 *   ai   - every entity the server sends: state / act, target, last known position and how stale it is, vision range, the last sound it heard,
 *          its search goal, its path, mood, the capture decision, tier and how many players are near
 *   you  - your own movement state, speed, stamina, surface, how visible you are and how far you are heard right now (dashed circle)
 *   srv  - server timings: milliseconds per 60 Hz step, snapshot size, senses / paths per second, tiers, ping, frame rate
 *   log  - what the entities decided, as it happens: state changes, catches, kills (with variant and reason), releases, lamp failures */
E.dbg = null; E.dbgAt = 0;
E.dbgCfg = { on: false, ai: true, you: true, srv: true, log: true, compact: false, side: 'right', search: false, crawl: false, evid: false };
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
    const sel = E.navSel && d.i === E.navSel;
    if (sel) { cx.strokeStyle = '#ffffff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y, 34 * sc, 0, TAU); cx.stroke(); cx.lineWidth = 1; }
    if (d.nv && (cfg.nav || sel)) drawNav(cx, view, d, x, y, X, Y, sel);
    if (d.nv && cfg.col) drawCol(cx, view, d, x, y, X, Y);
    if (d.se && (cfg.search || sel)) drawSearch(cx, view, d, x, y, X, Y, sel);
    if (cfg.evid || sel) drawEvidence(cx, view, d, x, y, X, Y, sel);
    // label block
    const lines = [`${d.k.toUpperCase()}#${d.i}  ${d.s}${d.ac && d.ac !== '-' ? '/' + d.ac : ''}  tier:${d.tier}`];
    if (d.nv && sel) { const n = d.nv; lines.push(`NAV ${n.dir ? 'DIRECT' : 'ROUTE ' + n.rt.length + ' pts'}  sp ${n.sp}  stuck ${n.st}s  r${n.r}/rc${n.rc}  caps ${n.caps}${n.go ? '  [' + n.go + ']' : ''}`, `repath: ${n.why.slice(-3).join('  ') || '-'}`, `routes ${n.n[0]}  touches ${n.n[1]}  hits ${n.n[2]}  stuck ${n.n[3]}  recov ${n.n[4]}  EMERG ${n.n[5]}`); }
    if (!cfg.compact) {
      lines.push(`tgt:${d.tg || '-'}  v:${d.v}  near:${d.near}` + (d.lit !== undefined ? '  lit:' + d.lit : ''), `mood a${d.mood[0]} f${d.mood[1]} e${d.mood[2]} b${d.mood[3]}`);
      if (d.cp) lines.push(`CAPTURE ${d.cp.m}/${d.cp.ph} ${d.cp.v || ''} t${d.cp.t} next${d.cp.d} n${d.cp.n}`);
      if (d.cd) lines.push('decide: ' + Object.entries(d.cd).map(([k, v]) => k + ':' + v).join(' ').slice(0, 60));
      if (d.hm && (sel || cfg.evid)) {
        const m = d.hm; lines.push(`WHY ${m.why}`, `commit ${m.dwell}s  sight ${m.seen ? 'YES' : 'NO'}  conf ${m.conf ?? '-'}  rejected ${m.rejected}  branch ${m.branch || '-'}`);
        if (m.visual) lines.push(`last VISUAL ${m.visual[0]},${m.visual[1]}  ${m.visual[2]}s  observed heading ${m.visual[3]}`);
        if (m.listen) lines.push('PAUSE: ' + m.listen);
        if (sel && m.transition) lines.push(`last transition ${m.transition.from} → ${m.transition.to}: ${m.transition.why}`);
        if (m.investigation) lines.push(`anonymous ${m.investigation[2]} at ${m.investigation[0]},${m.investigation[1]} ±${m.investigation[3]}`);
        if (sel) lines.push(`gaze used ${m.gaze}s  ` + Object.entries(m.traits).map(([k,v]) => k + ' ' + v).join('  '));
      }
      if (sel && d.intel) {
        const I = d.intel; lines.push(`EVIDENCE ${I.winner || '-'}: ${I.why}`, `RNG ${I.rng}: ${I.tags.join('/')}`);
        for (const c of I.candidates.slice(0, 4)) lines.push(`${c.key} ${c.attribution} ${c.modality}: score ${c.score} c${c.c} ±${c.u} age ${c.age}s expires ${c.expires}s`);
        for (const t of I.targets.slice(0,3)) lines.push(`TARGET P${t.pid} score ${t.score}: ${t.why}`);
        lines.push(`commitment ${I.commitment.age}s / ${I.commitment.dwell.toFixed(2)}s dwell`);
        for(const r of I.rejectedHabits)lines.push(`HABIT P${r.pid} repeats ${r.count}: ${r.why}`);
        if(I.habitExpiry)lines.push(`HABIT ${I.habitExpiry.why}`);
        for (const h of I.habits) lines.push(`HABIT P${h.pid} repeats ${h.count} bias ${Math.round(h.bias*100)}% at ${h.x},${h.y} expires ${h.expires}s`);
        if (I.applied) lines.push(`habit candidate bias +${I.applied.delta.toFixed(2)} (hypothesis, not knowledge)`);
      }
      if (d.sm) { const m = d.sm;                                                     // (Part 2D) the canon Smiler: why it is doing this - debug mode only, never in normal play
        lines.push(`WHY ${m.why || '-'}`, `agitation ${m.ag}${m.agw ? ' (' + m.agw + ')' : ''}  light on it ${m.lit}${m.w ? '  WATCHED BY P' + m.w + ' ' + m.ht + 's' : ''}${m.dw !== null ? '  target kept ' + m.dw + 's' : ''}${m.cl ? '  walked in ' + m.cl + 'px' : ''}`);
        if (m.ab || m.rt) lines.push((m.ab ? 'abandoned: ' + m.ab : '') + (m.rt ? '  switched: ' + m.rt : ''));
        if (sel) lines.push(`patience ${m.pz.pat} curiosity ${m.pz.cur} persistence ${m.pz.per} boldness ${m.pz.bold}  eye contact ${m.ec.map(c => 'P' + c[0] + ' ' + c[1] + 's').join(', ') || '-'}  strikes ${m.st}`); }
      if (d.dec && (cfg.evid || sel)) { const q = d.dec; lines.push(`DECIDE ${q.s}${q.a ? '/' + q.a : ''}: ${q.why || '-'}${q.tq !== null ? '  tgt conf ' + q.tq : ''}`); if (q.rt) lines.push('retarget: ' + q.rt); if (q.lt) lines.push('light: ' + q.lt + (q.fl !== null && q.fl < 5 ? '  (beam in its eyes ' + q.fl + 's ago)' : '')); }
      if ((cfg.evid || sel) && (d.ld || d.inv || d.ec)) lines.push(`leads ${d.ld ? d.ld.length : 0}${d.inv ? '  investigate ' + d.inv.k + ' ±' + d.inv.u + ' (' + d.inv.age + 's)' : ''}${d.ec ? '  EYE CONTACT ' + d.ec.map(c => 'P' + c[0]).join(',') : ''}`);
      if (sel && d.tr) lines.push('traits ' + Object.entries(d.tr).map(([k, v]) => k + v).join(' '));
      if (d.pu) lines.push('pursuit ' + (d.pu.blind !== undefined ? 'blind ' + d.pu.blind + 's' : 'seen') + (d.pu.ear ? ' (by ear)' : ''));
      if (d.se && (cfg.search || sel)) { const q = d.se; lines.push(`SEARCH ${q.why || '-'} ${q.ph || ''} legs ${q.legs || '-'} t${q.t} left ${q.left}s  heard-again x${q.rq}`, `memory ${q.mem !== null ? q.mem + 's old' : '-'}  unsure ±${q.est ? q.est[2] : '-'} px${q.cz ? '  saw it go into ' + q.cz : ''}${q.tried.length ? '  tried ' + q.tried.join(',') : ''}`); if (q.g) lines.push(`looking: ${q.g[2]}${q.g[3] ? ' (' + q.g[3] + ' exit)' : ''}`); if (q.dis) lines.push('GAVE UP: ' + q.dis); }
    } else if (d.cp) lines[0] += `  ${d.cp.m}/${d.cp.ph}`;
    const w = Math.max(...lines.map(l => cx.measureText(l).width)) + 10, h = lines.length * 13 + 6;
    cx.fillStyle = 'rgba(0,0,0,.66)'; cx.fillRect(x + 10, y - h - 6, w, h); cx.fillStyle = col;
    lines.forEach((l, i) => cx.fillText(l, x + 15, y - h - 3 + i * 13));
  }
  cx.restore();
}
/* EVIDENCE (Part 2 / 2C): anonymous leads (dashed rings = how unsure; white = a light source it saw, yellow = a beam, orange = a lit wall,
 * brown = a lit floor), the one it would investigate (line from the entity), and the typed evidence on its best record (red = seen,
 * violet = heard, yellow = light it has since pinned on that person).  Leads carry no player: that is the point. */
const LEAD_COL = { source: '#ffffff', beam: '#ffe27a', litwall: '#ffa94d', litfloor: '#c9955a' }, EV_COL = { see: '#ff4d4d', sound: '#d68cff', light: '#ffe27a' };
function drawEvidence(cx, view, d, x, y, X, Y, sel) {
  const sc = view.sc; cx.save(); cx.lineWidth = sel ? 1.6 : 1;
  if (d.ld) for (const L of d.ld) {
    const [id, k, lx, ly, u, c, age] = L, px = X(lx), py = Y(ly), col = LEAD_COL[k] || '#fff';
    cx.globalAlpha = Math.max(.25, Math.min(1, c * 1.2)); cx.strokeStyle = col; cx.setLineDash([4, 5]); cx.beginPath(); cx.arc(px, py, Math.max(6, u * sc), 0, TAU); cx.stroke(); cx.setLineDash([]);
    cx.beginPath(); cx.arc(px, py, 3, 0, TAU); cx.fillStyle = col; cx.fill(); cx.fillText(`${k} #${id} c${c} ${age}s`, px + 6, py + 4);
  }
  if (d.inv) { cx.globalAlpha = .9; cx.strokeStyle = LEAD_COL[d.inv.k] || '#fff'; cx.setLineDash([1, 4]); cx.beginPath(); cx.moveTo(x, y); cx.lineTo(X(d.inv.x), Y(d.inv.y)); cx.stroke(); cx.setLineDash([]); }
  if (d.ev) for (const q of d.ev) {
    const [k, ex, ey, u, c, age] = q, px = X(ex), py = Y(ey), col = EV_COL[k] || '#fff';
    cx.globalAlpha = Math.max(.3, c); cx.strokeStyle = col; cx.beginPath(); cx.moveTo(px, py - 5); cx.lineTo(px + 5, py); cx.lineTo(px, py + 5); cx.lineTo(px - 5, py); cx.closePath(); cx.stroke();
    if (sel) { cx.globalAlpha = .25; cx.beginPath(); cx.arc(px, py, Math.max(5, u * sc), 0, TAU); cx.stroke(); cx.globalAlpha = .9; cx.fillStyle = col; cx.fillText(`${k} ${age}s ±${u}`, px + 7, py - 12); }
  }
  cx.restore();
}
/* SEARCH + MEMORY (Part 1C): what the entity believes, and where it is looking */
function drawSearch(cx, view, d, x, y, X, Y, sel) {
  const q = d.se, sc = view.sc; cx.save(); cx.lineWidth = sel ? 2 : 1.2;
  if (d.lk) {
    const lx = X(d.lk.x), ly = Y(d.lk.y); cx.strokeStyle = '#ffb347'; cx.strokeRect(lx - 6, ly - 6, 12, 12);
    if (q.hd !== null) { const ex = lx + Math.cos(q.hd) * 60 * sc, ey = ly + Math.sin(q.hd) * 60 * sc; cx.beginPath(); cx.moveTo(lx, ly); cx.lineTo(ex, ey); cx.lineTo(ex - Math.cos(q.hd - .4) * 8, ey - Math.sin(q.hd - .4) * 8); cx.moveTo(ex, ey); cx.lineTo(ex - Math.cos(q.hd + .4) * 8, ey - Math.sin(q.hd + .4) * 8); cx.stroke(); }
  }
  if (q.est) { const ex = X(q.est[0]), ey = Y(q.est[1]); cx.strokeStyle = 'rgba(255,179,71,.7)'; cx.setLineDash([4, 5]); cx.beginPath(); cx.arc(ex, ey, Math.max(8, q.est[2] * sc), 0, TAU); cx.stroke(); cx.setLineDash([]); cx.beginPath(); cx.arc(ex, ey, 3, 0, TAU); cx.fillStyle = '#ffb347'; cx.fill(); if (sel) cx.fillText('ESTIMATE', ex + 6, ey + 4); }
  if (q.heard && q.heard[2] < 15) { const hx = X(q.heard[0]), hy = Y(q.heard[1]); cx.strokeStyle = '#d68cff'; cx.beginPath(); cx.arc(hx, hy, 9, 0, TAU); cx.stroke(); if (sel) { cx.fillStyle = '#d68cff'; cx.fillText('HEARD YOU ' + q.heard[2] + 's', hx + 11, hy - 4); } }
  if (q.g) { const gx = X(q.g[0]), gy = Y(q.g[1]); cx.strokeStyle = '#7aa2ff'; cx.setLineDash([2, 4]); cx.beginPath(); cx.moveTo(x, y); cx.lineTo(gx, gy); cx.stroke(); cx.setLineDash([]); cx.beginPath(); cx.moveTo(gx - 7, gy); cx.lineTo(gx + 7, gy); cx.moveTo(gx, gy - 7); cx.lineTo(gx, gy + 7); cx.stroke(); cx.fillStyle = '#7aa2ff'; cx.fillText('SEARCH: ' + q.g[2], gx + 9, gy + 2); }
  cx.restore();
}
/* CRAWLSPACES (Part 1C): the data a future cut-away view will use - inside, what covers it, the ways in and out, who can use it */
function drawCrawl(cx, view, sel) {
  const W0 = window.WORLD; if (!W0 || !W0.CRAWL) return; const { cam, sc, W, H } = view, X = x => W / 2 + (x - cam.x) * sc, Y = y => H / 2 + (y - cam.y) * sc;
  cx.save(); cx.font = MONO; cx.textBaseline = 'top';
  for (const c of W0.CRAWL) {
    const i = c.interior, o = c.occluder.rect; if (Math.abs(c.cx - cam.x) > W / sc && Math.abs(c.cy - cam.y) > H / sc) continue;
    const can = sel && sel.cc ? (c.needs === 'CAN_CRAWL' ? sel.cc[0] : sel.cc[1]) : null;
    cx.fillStyle = 'rgba(90,220,255,.16)'; cx.fillRect(X(i.x), Y(i.y), i.w * sc, i.h * sc); cx.strokeStyle = '#5adcff'; cx.lineWidth = 1.2; cx.strokeRect(X(i.x), Y(i.y), i.w * sc, i.h * sc);
    cx.setLineDash([5, 4]); cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.strokeRect(X(o.x), Y(o.y), o.w * sc, o.h * sc); cx.setLineDash([]);
    for (const x of c.exits) { cx.beginPath(); cx.arc(X(x.x), Y(x.y), 4, 0, TAU); cx.fillStyle = can === null ? '#5adcff' : can ? '#6dff8a' : '#ff6f61'; cx.fill(); cx.strokeStyle = cx.fillStyle; cx.beginPath(); cx.moveTo(X(x.x), Y(x.y)); cx.lineTo(X(x.x + x.nx * 22), Y(x.y + x.ny * 22)); cx.stroke(); }
    cx.fillStyle = '#5adcff'; cx.fillText(`${c.id} ${c.type} h${c.height} ${c.needs.replace('CAN_', '').toLowerCase()} · ${c.exits.length} exits${can === null ? '' : can ? ' · #' + sel.i + ' CAN USE' : ' · #' + sel.i + ' GOES ROUND'}`, X(i.x), Y(i.y + i.h) + 4);
  }
  cx.restore();
}
/* NAVIGATION layers (Part 1B) */
function drawNav(cx, view, d, x, y, X, Y, sel) {
  const n = d.nv, sc = view.sc; cx.save(); cx.globalAlpha = 1;
  if (n.dir && n.goal) { cx.strokeStyle = '#ffe36b'; cx.setLineDash([6, 5]); cx.beginPath(); cx.moveTo(x, y); cx.lineTo(X(n.goal[0]), Y(n.goal[1])); cx.stroke(); cx.setLineDash([]); }
  else if (n.rt.length) {
    cx.lineWidth = sel ? 2.5 : 1.5; let px = x, py = y;
    for (const w of n.rt) { cx.strokeStyle = w[2] === 1 ? '#ffa04d' : w[2] === 2 ? '#c38cff' : '#6dff8a'; cx.beginPath(); cx.moveTo(px, py); px = X(w[0]); py = Y(w[1]); cx.lineTo(px, py); cx.stroke(); cx.fillStyle = cx.strokeStyle; cx.fillRect(px - 2.5, py - 2.5, 5, 5); }
    cx.lineWidth = 1;
  }
  if (n.car) { const a = X(n.car[0]), b = Y(n.car[1]); cx.strokeStyle = '#ffffff'; cx.beginPath(); cx.moveTo(a - 5, b - 5); cx.lineTo(a + 5, b + 5); cx.moveTo(a + 5, b - 5); cx.lineTo(a - 5, b + 5); cx.stroke(); }
  const arrow = (a, len, col) => { const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len; cx.strokeStyle = col; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(ex, ey); cx.lineTo(ex - Math.cos(a - .4) * 7, ey - Math.sin(a - .4) * 7); cx.moveTo(ex, ey); cx.lineTo(ex - Math.cos(a + .4) * 7, ey - Math.sin(a + .4) * 7); cx.stroke(); cx.lineWidth = 1; };
  if (n.want !== null) arrow(n.want, 38 * sc, '#5fb4ff');
  const v = Math.hypot(n.vx, n.vy); if (v > 5) arrow(Math.atan2(n.vy, n.vx), Math.min(70, v * .22) * sc, '#ffffff');
  if (n.st > .15) { cx.fillStyle = '#ff6f61'; cx.fillText('STUCK ' + n.st + 's', x + 10, y + 12); }
  cx.restore();
}
function drawCol(cx, view, d, x, y, X, Y) {
  const n = d.nv, sc = view.sc, A = window.__api; cx.save();
  cx.strokeStyle = '#ff5d5d'; cx.beginPath(); cx.arc(x, y, n.rc * sc, 0, TAU); cx.stroke();
  cx.setLineDash([2, 3]); cx.strokeStyle = '#ffb0b0'; cx.beginPath(); cx.arc(x, y, n.r * sc, 0, TAU); cx.stroke(); cx.setLineDash([]);
  if (A && A.Bc) { cx.strokeStyle = 'rgba(255,93,93,.55)'; for (const b of A.Bc(d.x, d.y)) if (Math.abs(b.x + b.w / 2 - d.x) < 200 && Math.abs(b.y + b.h / 2 - d.y) < 200) cx.strokeRect(X(b.x), Y(b.y), b.w * sc, b.h * sc); }
  cx.restore();
}
/* walkable floor near the camera, brighter = more room (the same radii the server's clearance field uses); cached per camera cell */
let gridCache = { key: '', pts: [] };
function drawGrid(cx, view) {
  const A = window.__api; if (!A || !A.sl) return; const { cam, sc, W, H } = view, X = x => W / 2 + (x - cam.x) * sc, Y = y => H / 2 + (y - cam.y) * sc;
  const key = Math.round(cam.x / 96) + ',' + Math.round(cam.y / 96) + ',' + Math.round(sc * 10);
  if (gridCache.key !== key) {
    const pts = [], hw = W / 2 / sc + 48, hh = H / 2 / sc + 48;
    for (let gy = Math.floor((cam.y - hh) / 48); gy <= (cam.y + hh) / 48; gy++) for (let gx = Math.floor((cam.x - hw) / 48); gx <= (cam.x + hw) / 48; gx++) {
      const x = gx * 48 + 24, y = gy * 48 + 24; if (!A.sl(x, y, 21)) continue; pts.push([x, y, A.sl(x, y, 52) ? 3 : A.sl(x, y, 40) ? 2 : A.sl(x, y, 30) ? 1 : 0]);
    }
    gridCache = { key, pts };
  }
  cx.save(); for (const [x, y, c] of gridCache.pts) { cx.fillStyle = ['rgba(255,120,80,.55)', 'rgba(255,220,90,.45)', 'rgba(140,255,140,.35)', 'rgba(120,200,255,.25)'][c]; cx.fillRect(X(x) - 3, Y(y) - 3, 6, 6); } cx.restore();
}
function drawLinks(cx, view) {
  const W0 = window.WORLD; if (!W0 || !W0.LOW) return; const { cam, sc, W, H } = view, X = x => W / 2 + (x - cam.x) * sc, Y = y => H / 2 + (y - cam.y) * sc;
  cx.save(); cx.strokeStyle = '#ffa04d'; cx.fillStyle = '#ffa04d';
  for (const p of W0.LOW) { const r = p.rect, half = (p.cross === 'y' ? r.h : r.w) / 2 + 30; const A1 = p.cross === 'y' ? [p.cx, p.cy - half] : [p.cx - half, p.cy], B1 = p.cross === 'y' ? [p.cx, p.cy + half] : [p.cx + half, p.cy];
    cx.setLineDash([4, 3]); cx.beginPath(); cx.moveTo(X(A1[0]), Y(A1[1])); cx.lineTo(X(B1[0]), Y(B1[1])); cx.stroke(); cx.setLineDash([]); cx.fillText('VAULT ' + (p.kind || ''), X(p.cx) + 6, Y(p.cy) - 6); }
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
  if (cfg.grid) drawGrid(cx, view);
  if (cfg.links) drawLinks(cx, view);
  if (cfg.crawl) drawCrawl(cx, view, (list || []).find(d => d.i === E.navSel));
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
