/* Network + dread layer.
 * - Talks to server.js over a WebSocket. When connected, the server owns the Hounds, Smilers,
 *   blackouts, glitched walls and dead bodies; this file mirrors them into the game's own objects every frame.
 * - Falls back to the game's built-in single-player AI when there is no server.
 * - Also draws other wanderers and adds the proximity scare effects. */
(() => {
const cv = document.getElementById('mp'), cx = cv.getContext('2d'), dread = document.getElementById('dread'),
  game = document.getElementById('game'), light = document.getElementById('light'),
  net = Object.assign(document.createElement('div'), { id: 'net', textContent: 'SOLO' });
document.body.appendChild(net);
const room = new URLSearchParams(location.search).get('room') || 'main';

let ws, retry = 0, myId = null, lastSend = 0, everConnected = false;
let snap = null, me = '', mseq = 0, handled = 0, peersN = 0, kicked = false, exited = false;
let bodiesList = [];                              // corpses from the server (everyone's, one per player)
const hMap = new Map(), hSlots = [null, null, null];
const sSlot = [null, null, null, null, null];     // entity id living in each of the game's five smiler objects
window.__hounds = hSlots;
let cpNow = 0, killSeq = -1, graceUntil = 0;      // what the server says is holding us / which death we already announced / the spawn grace
const EN = () => window.__ents;
if (EN()) EN().onFail = f => EN().smilerVoice(f.x, f.y, 'blackout');      // a lamp going out has a sound of its own
const adm = { unlocked: false, pass: null, open: false, data: null, you: null, err: '', sigP: '', sigW: '', dbg: false };
const peers = new Map();
const N = window.__net = {
  on: false,
  tick() {                                          // called by the game's fixed-step loop while online
    const A = window.__api;
    if (A && me && mseq > handled && !A.G.caught) {
      handled = mseq; A.G.caught = true; A.G.caughtBy = me;
      const K = window.__kill; let b = -1;
      if (K && K.slot >= 0) b = K.slot; else { let bd = 1e18; for (const o of hMap.values()) { const d = Math.hypot(o.x - A.H.x, o.y - A.H.y); if (d < bd) { bd = d; b = o.slot; } } }
      window.__killer = me === 'Hound' ? b : -1;             // that hound's own model is replaced by the attack animation
    }
  },
  join() { exited = false; graceUntil = performance.now() / 1000 + 4; window.__kill = null; window.__glitchSolo = false; if (!N.on) { window.__glitches = []; window.__items = []; } tx({ t: 'join' }); setTimeout(applyBodies, 80); },
  respawn() { handled = Math.max(handled, mseq); graceUntil = performance.now() / 1000 + 4; window.__kill = null; tx({ t: 'respawn' }); },
  leave() { tx({ t: 'leave' }); },
  fx: m => startFx(m),
  deathStart(d) { const A = window.__api; if (A) tx(Object.assign(fxBase(A), { t: 'fx', k: 'death', c: d.kind, x: d.victim.x, y: d.victim.y, a: d.victim.angle, sx: d.source.x, sy: d.source.y,
    v: d.variant || 'A', mi: d.motionInitial || null, w: d.wall ? [d.wall.x, d.wall.y, d.wall.ang] : 0 })); },
  vanish(d) { const A = window.__api; if (A) tx(Object.assign(fxBase(A), { t: 'fx', k: 'vanish', x: Math.round(d.x), y: Math.round(d.y), a: +d.a.toFixed(3) })); },
  bodyMade(t) {                                    // our own corpse is finished: tell the server so everyone can see it
    tx({ t: 'b', n: t.name, x: +t.x.toFixed(4), y: +t.y.toFixed(4), a: +t.angle.toFixed(6), sx: +t.scaleX.toFixed(3), sy: +t.scaleY.toFixed(3), c: t.cause, aa: +t.attackAngle.toFixed(3),
      lk: [t.appearance.hat, t.appearance.texture, t.appearance.hands, t.appearance.main, t.appearance.backpack].join('|'), ek: t.equipment.kind, ec: t.equipment.color, ep: partList(t.equipment), lo: t.lo ? 1 : 0, ps: t.pose || null,
      bl: t.blood.map(b => [Math.round(b.x), Math.round(b.y), b.seed]), dr: [+t.dropped.x.toFixed(4), +t.dropped.y.toFixed(4), +t.dropped.angle.toFixed(6)], ht: [+t.hat.x.toFixed(4), +t.hat.y.toFixed(4), +t.hat.angle.toFixed(6)] });
  },
};
const fxBase = A => ({ lk: [A.look.hat, A.look.texture, A.look.hands, A.look.main, A.look.backpack].join('|'), ek: A.H.equipment.kind, ec: A.H.equipment.color, ep: partList(A.H.equipment) });
const tx = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function connect() {
  if (location.protocol === 'file:') return;
  try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?room=' + encodeURIComponent(room)); } catch { return; }
  ws.onopen = () => {
    retry = 0; handled = 0; mseq = 0; me = ''; everConnected = true;
    const A = window.__api; if (A && A.started()) tx({ t: 'join' });      // re-enter the world after a reconnect
    if (adm.pass) tx({ t: 'admin', pass: adm.pass });                         // stay unlocked across reconnects (kept in memory only)
  };
  ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === 'hi') { myId = m.id; const A = window.__api; if (A) A.H.id = myId; }
    else if (m.t === 'admin') {
      adm.unlocked = !!m.ok; adm.err = m.ok ? '' : (m.wait ? 'TOO MANY TRIES · WAIT ' + m.wait + 'S' : 'WRONG PASSCODE');
      if (!m.ok) adm.pass = null;
      renderAdmin();
    }
    else if (m.t === 'tp') { const A = window.__api; A && A.tp(m.x, m.y); }
    else if (m.t === 'revive') { const A = window.__api; A && A.revive(); }
    else if (m.t === 'msg') showMsg(m.text, m.from);
    else if (m.t === 'kick') { kicked = true; document.getElementById('kicked').hidden = false; }
    else if (m.t === 'bodies') { bodiesList = m.b || []; applyBodies(); }
    else if (m.t === 'fx') startFx(m);
    else if (m.t === 'exit') doExit(m.secs);
    else if (m.t === 'got') giveItem(m.item);
    else if (m.t === 's') {
      const now = performance.now(), seen = new Set();
      for (const p of m.p) {
        seen.add(p.id);
        const o = peers.get(p.id) || { x: p.x, y: p.y };
        if (Math.hypot(p.x - o.x, p.y - o.y) > 400) { o.x = p.x; o.y = p.y; }      // respawned somewhere else: don't glide across the map
        Object.assign(o, p, { tx: p.x, ty: p.y, seen: now }); peers.set(p.id, o);
      }
      for (const [id, o] of peers) if (!seen.has(id)) { dropAvatar(o); peers.delete(id); }
      peersN = m.p.length; me = m.me || ''; mseq = m.ms | 0; cpNow = m.cp || 0;
      if (m.mk && m.ms !== killSeq) { killSeq = m.ms; announceKill(m.mk); }          // who killed us, how, and where the wall is
      if (m.e) { snap = m.e; N.on = true; entitySignals(m.e); }
      if (m.dbg && EN()) EN().setDebug(m.dbg);
      if (m.ad) { adm.data = m.ad; adm.you = m.you; renderAdminData(); }
    }
  };
  ws.onclose = () => {
    for (const f of fxs.splice(0)) killFx(f); N.on = false; snap = null; cpNow = 0; window.__kill = null; window.__glitchSolo = false; window.__glitches = []; window.__items = []; for (const o of peers.values()) dropAvatar(o); peers.clear(); window.__peerLights = []; hMap.clear(); hSlots.fill(null); sSlot.fill(null);
    if (EN()) { EN().setDebug(null); EN().drawDebug(); EN().setFails([]); }
    if (window.__mv) { window.__mv.down = 0; window.__mv.dragTo = null; }
    net.textContent = everConnected ? 'SOLO · RECONNECTING' : 'SOLO';
    adm.unlocked = false; adm.dbg = false; renderAdmin();
    if (!kicked) setTimeout(connect, Math.min(8000, 1000 * ++retry));
  };
}
connect();

/* ---------- mirror the server's monsters into the game ---------- */
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
/* the kill the server just made: which entity, which variant (A-D), where the wall is.  The death sequence in the bundle reads this. */
function announceKill(k) {
  const K = window.__kill = Object.assign({}, k, { at: performance.now(), slot: -1 });
  if (K.k === 'Hound') { const o = hMap.get(K.e); K.slot = o ? o.slot : -1; } else K.slot = sSlot.indexOf(K.e);
}
/* sounds the entities make (positional, voiced by ents.js) and lamps the smilers are killing */
function entitySignals(e) {
  const E = EN(); if (!E) return;
  for (const q of e.sn || []) if (Array.isArray(q) && ['growl', 'snarl', 'lungecue', 'guard', 'kill'].includes(q[0])) E.houndVoice(q[1], q[2], q[0], q[3]);
  E.setFails(e.lf || []);
}
function applyServerState(dt) {
  const A = window.__api, s = snap, E = EN();
  if (!A || !s || !E) return;
  /* hounds: every hound has its own client-side copy in a fixed slot; the game's own hound object (G) mirrors the nearest one */
  const ids = new Set();
  for (const t of s.h) {
    ids.add(t.i);
    let o = hMap.get(t.i);
    if (!o) { const sl = hSlots.indexOf(null); if (sl < 0) continue; o = { x: t.x, y: t.y, angle: t.a, state: 'ROAMING', ls: 'patrol', act: '', distance: 0, slot: sl, id: t.i }; hMap.set(t.i, o); hSlots[sl] = o; }
    E.slotH(o, t, dt);
  }
  for (const [id, o] of hMap) if (!ids.has(id)) { hSlots[o.slot] = null; hMap.delete(id); }
  let best = null, bd = 1e18;
  for (const o of hMap.values()) { const d = Math.hypot(o.x - A.H.x, o.y - A.H.y); if (d < bd) { bd = d; best = o; } }
  const G = A.G, grace = Math.max(0, graceUntil - performance.now() / 1000);
  if (best) { G.x = best.x; G.y = best.y; G.angle = best.angle; G.state = best.ls; G.distance = best.distance; }
  else { G.x = G.y = -9e4; G.state = 'patrol'; }
  G.grace = grace; G.pressure = s.p || 0;
  /* smilers: up to five, each keeps its own one of the game's smiler objects; unused ones are parked far away and hidden */
  const sid = new Set();
  for (const t of s.m) {
    sid.add(t.i);
    let i = sSlot.indexOf(t.i);
    if (i < 0) { i = sSlot.indexOf(null); if (i < 0) continue; sSlot[i] = t.i; const o = A.q[i]; o.x = t.x; o.y = t.y; o.angle = t.a; o.distance = 0; }
    A.q[i].off = false; E.slotS(A.q[i], t, dt);
  }
  A.q.forEach((sm, i) => {
    if (sSlot[i] !== null && !sid.has(sSlot[i])) sSlot[i] = null;
    if (sSlot[i] === null) { sm.off = true; sm.x = sm.y = -9e4; sm.state = 'lurk'; sm.ls = 'lurk'; sm.face = 0; }
  });
  A.V.blackout = !!s.b;
  window.__glitches = s.gw || []; window.__items = s.it || [];
}
/* held by something: the server says down / crawl / (dragged toward a point).  move.js does the rest, this adds the sounds and the flash */
let cpPrev = '', hitFlash = 0;
function applyCaught() {
  const A = window.__api, mv = window.__mv, E = EN(); if (!A || !mv) return;
  const cp = N.on && !A.G.caught ? cpNow : 0, ph = cp ? cp.ph : '';
  mv.down = cp && ph !== 'release' ? (ph === 'crawl' ? 'crawl' : 'down') : 0;
  mv.dragTo = mv.down && cp.d ? cp.d : null;
  if (ph !== cpPrev) {
    if (E && ph === 'down' && !cpPrev) { E.sfxKnock(); hitFlash = 1; }
    else if (E && ph === 'crawl') E.sfxGasp();
    else if (E && !ph && cpPrev) E.sfxRelease();
    cpPrev = ph;
  }
}
/* ---------- glitched walls: touching one takes you out of Level 0 ---------- */
function doExit(secs) {
  const A = window.__api; if (!A || exited) return; exited = true;
  const box = document.getElementById('wonStats'); if (box) box.textContent = 'Time in Level 0 · ' + Math.floor((secs || 0) / 60) + ':' + String((secs || 0) % 60).padStart(2, '0');
  document.body.classList.add('gl-out');
  if (window.__glitchSound) window.__glitchSound.burst();
  setTimeout(() => { A.win(); document.body.classList.remove('gl-out'); }, 950);
}
N.exitLocal = () => doExit(Math.round(performance.now() / 1000 - (N.t0 || 0)));
/* offline fallback (no server): pick three glitched walls locally and let the player leave through them */
function soloGlitches(p) {
  const A = window.__api; if (!A || !A.zc) return;
  if (window.__glitchSolo !== true) {
    const out = [], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]; N.t0 = performance.now() / 1000;
    for (let t = 0; t < 8000 && out.length < 3; t++) {
      const tx = Math.random() * 96 | 0, ty = Math.random() * 72 | 0; if (!A.zc(tx, ty)) continue;
      const d = dirs[Math.random() * 4 | 0], nx = tx + d[0], ny = ty + d[1]; if (nx < 1 || ny < 1 || nx > 94 || ny > 70 || !A.Hc(nx, ny)) continue;
      const cx = (tx + .5) * 96, cy = (ty + .5) * 96; if (!A.sl(cx, cy)) continue;
      const x = cx + d[0] * 48, y = cy + d[1] * 48;
      if (Math.hypot(x - A.Ic.x, y - A.Ic.y) < 2600 || out.some(o => Math.hypot(o[0] - x, o[1] - y) < 2600)) continue;
      out.push([Math.round(x), Math.round(y), d[0], d[1]]);
    }
    window.__glitches = out; window.__glitchSolo = true;
  }
  for (const g of window.__glitches) if (Math.hypot(p.x - g[0], p.y - g[1]) < 54) { N.exitLocal(); break; }
}

/* ---------- the cartograph: one rare item per world, lying on the floor until somebody walks over it ---------- */
let lastPick = 0;
function giveItem(id) { if (window.__inv) window.__inv.give(id, true); }
function itemsFrame(p) {
  const list = window.__items || [], A = window.__api;
  if (!list.length || !A) return;
  const now = performance.now();
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (Math.hypot(p.x - it[0], p.y - it[1]) > 46) continue;
    if (window.__inv && window.__inv.has(it[2])) continue;               // you already carry one
    if (N.on) { if (now - lastPick > 700) { lastPick = now; tx({ t: 'pick' }); } }
    else { list.splice(i, 1); giveItem(it[2]); }
    return;
  }
}
function soloItem() {                                                    // offline: drop one somewhere far from the start
  const A = window.__api; if (!A || !A.zc || window.__itemSolo === true) return; window.__itemSolo = true;
  for (let t = 0; t < 8000; t++) {
    const tx0 = Math.random() * 96 | 0, ty0 = Math.random() * 72 | 0; if (!A.zc(tx0, ty0)) continue;
    const x = (tx0 + .5) * 96, y = (ty0 + .5) * 96; if (!A.sl(x, y) || Math.hypot(x - A.Ic.x, y - A.Ic.y) < 1800) continue;
    window.__items = [[Math.round(x), Math.round(y), 'cartograph']]; return;
  }
}

/* ---------- everyone's bodies (one per player) ---------- */
const hasBody = id => bodiesList.some(b => b.k === id);
function toRec(b) {
  return { id: 'r:' + b.k + ':' + Math.round(b.x) + ':' + Math.round(b.y), ownerId: 'r' + b.k, remote: true, name: b.n, cause: b.c, x: b.x, y: b.y, angle: b.a, scaleX: b.sx, scaleY: b.sy, attackAngle: b.aa, lo: b.lo ? 1 : 0, pose: b.ps || null,
    appearance: parseLook(b.lk), equipment: { kind: b.eq.kind, color: b.eq.color, parts: { [b.eq.kind]: partObj(b.eq.kind, b.eq.parts) } }, blood: b.bl.map(([x, y, seed]) => ({ x, y, seed })), dropped: { x: b.dr[0], y: b.dr[1], angle: b.dr[2] }, hat: { x: b.ht[0], y: b.ht[1], angle: b.ht[2] } };
}
function applyBodies() { const A = window.__api; if (A && myId) A.H.id = myId; if (A && A.bodies) A.bodies(bodiesList.map(toRec)); }

/* ---------- audio ---------- */
let ac, drone, dg, beatT = 0;
const soundOn = () => /ON/.test(document.getElementById('sound')?.textContent || 'ON');
function initAudio() {
  if (ac) return;
  try {
    ac = new AudioContext();
    drone = ac.createOscillator(); drone.type = 'sawtooth'; drone.frequency.value = 43;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
    dg = ac.createGain(); dg.gain.value = 0;
    drone.connect(f).connect(dg).connect(ac.destination); drone.start();
  } catch {}
}
addEventListener('pointerdown', initAudio); addEventListener('keydown', initAudio);
function thump(v, f) {
  if (!ac || !soundOn()) return;
  const o = ac.createOscillator(), g = ac.createGain(), n = ac.currentTime;
  o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(38, n + .16);
  g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.001, n + .2);
  o.connect(g).connect(ac.destination); o.start(n); o.stop(n + .22);
}
function burst(len, v) {
  if (!ac || !soundOn()) return;
  const b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 1.5;
  const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = v; s.buffer = b; s.connect(g).connect(ac.destination); s.start();
}
new MutationObserver(() => { if (document.body.classList.contains('captured')) burst(1.1, .9); })
  .observe(document.body, { attributes: true, attributeFilter: ['class'] });

/* online note on the pause screen */
const pauseNote = document.querySelector('#dialog .lore-credit');
if (pauseNote) {
  const n = document.createElement('p'); n.className = 'lore-credit'; n.id = 'onlineNote'; n.hidden = true;
  n.textContent = 'Online: pausing does not stop the halls. The monsters keep moving.';
  pauseNote.before(n);
}


/* ---------- other wanderers ---------- */
const tip = Object.assign(document.createElement('div'), { id: 'peerTip' });
document.body.appendChild(tip);
let mx = -1e3, my = -1e3;
addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mx = e.clientX; my = e.clientY; } });
let view = null;
/* light parts <-> 'c1,c2,c3' strings (order comes from the game's own part table) */
const partList = eq => { const A = window.__api; if (!A || !A.gear || !eq) return ''; const P = A.gear.parts(eq, eq.kind); return A.gear.defs[eq.kind].map(d => P[d[0]]).join(','); };
const partObj = (kind, s) => { const A = window.__api, defs = A && A.gear && A.gear.defs[kind]; if (!defs) return {}; const v = String(s || '').split(','), o = {}; defs.forEach((d, i) => { if (/^#[0-9a-f]{6}$/i.test(v[i])) o[d[0]] = v[i]; }); return o; };
const parseLook = s => { const [hat, texture, hands, main, backpack] = String(s || 'none|plain|#e6bb76|#ffcc77|none').split('|'); return { hat, texture, hands, main, backpack }; };
function dropAvatar(o) { if (o.av) { o.av.parent && o.av.parent.removeChild(o.av); o.av.destroy({ children: true }); o.av = null; } }
setInterval(() => { for (const [id, o] of [...peers]) if (!peers.has(id)) dropAvatar(o); }, 2000);

/* ---------- other players' deaths and vanishings, replayed for everybody in line of sight ---------- */
const fxs = window.__fxs = [];
const fxActive = id => fxs.some(f => f.id === id && !f.gone);
window.__hideBodies = new Set(); window.__fxKill = new Set(); window.__fxKillS = new Set();
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function killFx(f) {
  f.gone = true;
  for (const x of [f.av, f.jl && f.jl.blood, f.jl && f.jl.foreground, f.jl && f.jl.debris, f.att]) { if (!x) continue; try { x.parent && x.parent.removeChild(x); x.destroy({ children: true }); } catch { } }
  window.__hideBodies.delete('r' + f.id);
}
function startFx(m) {
  const A = window.__api, layer = A && A.layer && A.layer(); if (!A || !layer || !A.mkAvatar || !A.Jl || m.id === myId) return;
  for (const f of fxs) if (f.id === m.id) f.end = true;                          // a newer event for the same player replaces the older one
  const look = parseLook(m.lk), gear = { kind: m.ek || 'flashlight', color: m.ec || '#ffe7b2', parts: {} }; gear.parts[gear.kind] = partObj(gear.kind, m.ep);
  const now = performance.now() / 1000, av = A.mkAvatar(look, gear); av.__key = m.id; av.__cause = m.c; layer.addChild(av);
  const f = { id: m.id, k: m.k, t0: now, av, look, gear, src: { x: m.x, y: m.y, angle: m.a, vx: 0, vy: 0, distance: 0 }, old: bodiesList.find(b => b.k === m.id) };
  if (m.k === 'death') {
    const jl = new A.Jl(); jl.start(m.c === 'Smiler' ? 'Smiler' : 'Hound', now, { x: m.sx, y: m.sy }, -1, { x: m.x, y: m.y, angle: m.a, equipment: gear, hat: look.hat, appearance: look }, { v: m.v, w: m.w, mi: m.mi });
    f.jl = jl; A.floor().addChild(jl.blood); layer.addChild(jl.foreground, jl.debris);
    f.att = m.c === 'Smiler' ? new A.Gl({ x: m.sx, y: m.sy, angle: 0, state: 'ATTACKING', off: false, side: 0 }) : new A.Wl(); layer.addChild(f.att);
    f.cause = m.c; f.kill = { h: -1, s: -1 };                                    // hide the real monster that made the kill while its attack replays
    let bd = 240; for (const o of hMap.values()) { const d = Math.hypot(o.x - m.sx, o.y - m.sy); if (d < bd) { bd = d; f.kill.h = o.slot; } }
    bd = 240; (A.q || []).forEach((s, i) => { const d = Math.hypot(s.x - m.sx, s.y - m.sy); if (!s.off && d < bd) { bd = d; f.kill.s = i; } });
    if (m.c === 'Smiler') f.kill.h = -1; else f.kill.s = -1;
    window.__hideBodies.add('r' + m.id);
  }
  fxs.push(f);
}
function updateFx(now) {
  const A = window.__api; window.__fxKill.clear(); window.__fxKillS.clear();
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i], t = now - f.t0;
    if (f.end || !A) { killFx(f); fxs.splice(i, 1); continue; }
    if (f.k === 'vanish') {
      f.av.update(now, false, false, f.src); f.av.gear.visible = false;
      const v = Math.min(1, t / 2.7), s = sm(.22, .95, v), fl = Math.sin(now * 47) > .55 && v > .35 && v < .9 ? .35 : 0;
      f.av.alpha = Math.max(0, 1 - s - fl * (1 - s)); f.av.scale.set(1 - .06 * s); f.av.x += Math.sin(now * 61) * (1 - s) * s * 4;
      if (t > 2.8) { killFx(f); fxs.splice(i, 1); }
      continue;
    }
    const jl = f.jl, done = jl.frame(now), b = jl.body;
    f.av.update(now, false, false, f.src);
    f.av.position.set(b.x, b.y); f.av.rotation = b.angle; f.av.scale.set(b.scaleX, b.scaleY); f.av.alpha = b.alpha; f.av.deathPose(jl.injury, jl.impact, jl.elapsed > .24, jl.physicalPose);
    f.att.visible = !done; f.att.position.set(jl.attacker.x, jl.attacker.y); f.att.rotation = jl.attacker.angle + Math.PI / 2; f.att.alpha = 1;
    if (f.cause === 'Smiler') { f.att.scale.set(1 + sm(.3, 1.7, jl.elapsed) * .9); if (EN()) EN().attackSmiler(f.att, now, 1 / 60); } else f.att.attackPose(jl.grip, jl.impact, jl.variant);
    if (!done) { if (f.kill.h >= 0) window.__fxKill.add(f.kill.h); if (f.kill.s >= 0) window.__fxKillS.add(f.kill.s); }
    else { f.doneAt = f.doneAt || now; const nb = bodiesList.find(x => x.k === f.id); if ((nb && (!f.old || nb.x !== f.old.x || nb.y !== f.old.y || nb.a !== f.old.a)) || now - f.doneAt > 8) { killFx(f); fxs.splice(i, 1); } }
  }
}

/* how another wanderer moves, from what the server relays: [state, speed, stamina, exhausted] -> the pose data the avatar code reads */
const SNAMES = (window.WORLD && window.WORLD.SN) || ['stand', 'walk', 'run', 'crouch', 'crawl', 'slide', 'vault', 'down'];
function peerMv(o, now) {
  const a = o.mv; if (!Array.isArray(a)) return undefined;
  const s = SNAMES[a[0]] || 'stand';
  if (o.mvS !== s) { o.mvS = s; o.mvT0 = now; }
  const t = now - (o.mvT0 || now);
  return { s, t, sp: a[1] || 0, st: a[2] === undefined ? 100 : a[2], ex: a[3] ? 1 : 0, vp: s === 'vault' ? Math.min(1, t / .55) : 0, lean: o.mvLean || 1, tw: s === 'down' && (a[1] || 0) > 4 ? 1 : 0 };
}
/* what a fallen wanderer left behind can still shine: a flashlight lying on its side keeps its beam, a lantern keeps lighting the floor */
function bodyLights(p, out) {
  const A = window.__api; if (!A || !A.bodyList) return;
  for (const b of A.bodyList()) {
    if (!b.lo || b.cause === 'Vanish' || !b.equipment || b.equipment.kind === 'camcorder' || !b.dropped) continue;
    if (Math.hypot(b.dropped.x - p.x, b.dropped.y - p.y) > 950) continue;
    out.push({ x: b.dropped.x, y: b.dropped.y, angle: b.dropped.angle, kind: b.equipment.kind, color: b.equipment.color, on: true, dead: false });
  }
}
function drawPeers(p, cam, sc, los, dt, W, H) {
  const A = window.__api; const lights = []; let hover = null, best = 1e9;
  const layer = A && A.layer && A.layer();
  const now = performance.now() / 1000;
  updateFx(now);
  view = { cam, sc, W, H };
  for (const o of peers.values()) {
    const px = o.x, py = o.y;
    o.x += (o.tx - o.x) * .3; o.y += (o.ty - o.y) * .3;
    const step = Math.hypot(o.x - px, o.y - py), inv = 1 / Math.max(dt, .001);
    o.vx = (o.vx || 0) + (((o.x - px) * inv) - (o.vx || 0)) * .25;
    o.vy = (o.vy || 0) + (((o.y - py) * inv) - (o.vy || 0)) * .25;
    o.dist = (o.dist || 0) + step;
    o.ang = o.ang === undefined ? o.a : o.ang + angDiff(o.a, o.ang) * .35;
    if (A && A.mkAvatar && layer) {
      if (!o.av) { o.look = parseLook(o.lk); o.gear = { kind: o.k || 'flashlight', color: o.c || '#ffe7b2', parts: {} }; o.av = A.mkAvatar(o.look, o.gear); layer.addChild(o.av); }
      Object.assign(o.look, parseLook(o.lk)); o.gear.kind = o.k || 'flashlight'; o.gear.color = o.c || '#ffe7b2'; o.gear.parts[o.gear.kind] = partObj(o.gear.kind, o.lp);
      o.src = Object.assign(o.src || {}, { x: o.x, y: o.y, angle: o.ang, vx: o.vx, vy: o.vy, distance: o.dist, mv: peerMv(o, now) });
      o.av.update(now, !!o.l && !o.d, false, o.src);
      if (o.d) { o.av.__key = o.id; o.av.deathPose(1, 0, false); if (o.dAt === undefined) o.dAt = now; } else o.dAt = undefined;
      if (o.f >= 0 && o.f < 1 && !o.d) {                          // they are still falling in
        const k = .62, p2 = o.f;
        if (p2 < k) { const h = p2 / k, hs = h * h * (3 - 2 * h), z = 1 + (1 - hs) * (1 - hs) * 1.25; o.av.scale.set(z, z); o.av.alpha = Math.min(1, p2 / .22); o.av.rotation += (1 - hs) * 1.7; }
        else { const u = (p2 - k) / (1 - k), b = Math.exp(-u * 5) * Math.sin(u * 22); o.av.scale.set(1 + .11 * b, 1 - .11 * b); o.av.alpha = 1; }
      } else if (!o.d) { o.av.scale.set(1, 1); o.av.alpha = 1; }
      o.av.visible = !(fxActive(o.id) || (o.d && (hasBody(o.id) || now - o.dAt < .6)));     // their replayed death / finished corpse takes over
    }
    const dx = o.x - p.x, dy = o.y - p.y, dist = Math.hypot(dx, dy);
    const bm = o.av && o.av.beam; if (dist < 950) lights.push({ x: bm ? bm.x : o.x, y: bm ? bm.y : o.y, angle: bm ? bm.angle : o.ang, kind: o.k || 'flashlight', color: o.c || '#ffe7b2', on: !!o.l, dead: !!o.d });
    /* hover: only for wanderers you can actually see (in line of sight and lit) */
    const sx = W / 2 + (o.x - cam.x) * sc, sy = H / 2 + (o.y - cam.y) * sc;
    const dm = Math.hypot(mx - sx, my - sy);
    if (dm < 30 * sc && dm < best && dist < 800 && (dist < 30 || !los || los(p.x, p.y, Math.atan2(dy, dx), dist) >= dist - 20)) {
      best = dm; hover = { o, sx, sy };          // every wanderer carries a small aura, so anyone in line of sight is visible
    }
  }
  bodyLights(p, lights);
  window.__peerLights = lights;
  if (EN() && N.on) EN().drawDebug(cx, view);                                 // admin-only overlay (the server only sends its data to unlocked admins who switched it on)
  if (hover) {
    tip.textContent = (hover.o.n || 'WANDERER') + (hover.o.d ? ' · DOWN' : '');
    tip.style.left = hover.sx + 'px'; tip.style.top = (hover.sy - 26 * sc) + 'px'; tip.style.display = 'block';
  } else tip.style.display = 'none';
}
N.peerScreen = () => peers.size && view ? [...peers.values()].map(o => ({ n: o.n, look: o.lk, kind: o.k, color: o.c, lp: o.lp, lightOn: o.l, hasAvatar: !!o.av,
  sx: view.W / 2 + (o.x - view.cam.x) * view.sc, sy: view.H / 2 + (o.y - view.cam.y) * view.sc })) : [];



/* ---------- admin menu (press ` ) ---------- */
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const panel = document.createElement('div'); panel.id = 'adminPanel'; panel.hidden = true;
panel.innerHTML = `<div class="adm-head"><b>ADMIN</b><span id="admWho"></span><button class="adm" data-a="close" aria-label="Close admin">✕</button></div>
<div id="admLogin"><label for="admPass">PASSCODE</label><div class="adm-row"><input id="admPass" type="password" autocomplete="off" maxlength="40"><button class="adm" data-a="unlock">UNLOCK</button></div><p class="adm-note" id="admErr"></p></div>
<div id="admMain" hidden><div id="admPlayers"></div><div id="admWorld"></div>
<div class="adm-sec">BROADCAST</div><div class="adm-row"><input id="admText" maxlength="140" placeholder="Message to everyone" autocomplete="off"><button class="adm" data-a="msg">SEND</button></div></div>`;
document.body.appendChild(panel);
const banner = Object.assign(document.createElement('div'), { id: 'adminMsg', hidden: true }); document.body.appendChild(banner);
const kickedBox = Object.assign(document.createElement('div'), { id: 'kicked', hidden: true, innerHTML: '<div><h2>Removed by an admin.</h2><p>Reload the page to rejoin.</p></div>' }); document.body.appendChild(kickedBox);
let msgTimer = 0;
function showMsg(text, from) {
  banner.textContent = (from ? from + ': ' : '') + text; banner.hidden = false;
  clearTimeout(msgTimer); msgTimer = setTimeout(() => { banner.hidden = true; }, 8000);
}
const $a = id => document.getElementById(id);
function renderAdmin() {
  panel.hidden = !adm.open;
  $a('admLogin').hidden = adm.unlocked; $a('admMain').hidden = !adm.unlocked;
  $a('admErr').textContent = ws && ws.readyState === 1 ? adm.err : 'Admin needs the online server (not available in solo mode).';
  $a('admWho').textContent = adm.unlocked ? ' · ROOM ' + room.toUpperCase() : '';
  if (adm.open && !adm.unlocked) setTimeout(() => $a('admPass').focus(), 0);
  if (adm.unlocked) renderAdminData();
}
function renderAdminData() {
  const d = adm.data; if (!adm.open || !adm.unlocked || !d) return;
  const btn = (label, attrs, on) => `<button class="adm${on ? ' on' : ''}" ${attrs}>${label}</button>`;
  const players = d.pl.map(pl => {
    const you = pl.id === adm.you, tags = [you ? 'YOU' : '', pl.ad ? 'ADMIN' : '', !pl.a ? 'MENU' : '', pl.d ? 'DOWN' : '', pl.g ? 'GOD' : ''].filter(Boolean).join(' · ');
    return `<div class="adm-player"><div><b>${esc(pl.n || 'WANDERER')}</b> <i>${tags}</i></div><div class="adm-row wrap">` +
      (you ? '' : btn('BRING', `data-c="bring" data-id="${pl.id}"`) + btn('GO TO', `data-c="goto" data-id="${pl.id}"`)) +
      (pl.d ? btn('REVIVE', `data-c="revive" data-id="${pl.id}"`) : '') + btn('GOD', `data-c="god" data-id="${pl.id}"`, pl.g) +
      (you ? '' : btn('KICK', `data-c="kick" data-id="${pl.id}" data-confirm="Kick ${esc(pl.n)}?"`)) + '</div></div>';
  }).join('');
  const sp = v => btn(v + '×', `data-c="speed" data-v="${v}"`, d.sp === v);
  const world = `<div class="adm-sec">MONSTERS · ${d.hn} HOUND${d.hn === 1 ? '' : 'S'} (MAX 3)${d.pk ? ' · PACK' : ''} · ${d.sn} SMILER${d.sn === 1 ? '' : 'S'} (MAX 5)</div><div class="adm-row wrap">` +
    btn(d.fz ? 'FROZEN' : 'FREEZE', `data-c="freeze" data-on="${d.fz ? 0 : 1}"`, d.fz) + btn('SUMMON HOUND TO ME', 'data-c="summon"') + btn('RESPAWN ALL', 'data-c="monsters"') + '</div>' +
    `<div class="adm-row wrap">` + btn('+ HOUND', 'data-c="hounds" data-mode="add"') + btn('− HOUND', 'data-c="hounds" data-mode="remove"') + btn('+ SMILER', 'data-c="smilers" data-mode="add"') + btn('− SMILER', 'data-c="smilers" data-mode="remove"') + '</div>' +
    `<div class="adm-sec">AI TOOLS</div><div class="adm-row wrap">` + btn(adm.dbg ? 'AI DEBUG ON' : 'AI DEBUG', `data-c="debug" data-on="${adm.dbg ? 0 : 1}"`, adm.dbg) + btn('+ HOUND NEAR', 'data-c="near" data-k="hound"') + btn('+ SMILER NEAR', 'data-c="near" data-k="smiler"') + '</div>' +
    `<div class="adm-sec">WORLD SPEED</div><div class="adm-row wrap">${sp(0.5)}${sp(1)}${sp(2)}${sp(3)}</div>` +
    `<div class="adm-sec">LIGHTS</div><div class="adm-row wrap">` + ['auto', 'on', 'off'].map(m => btn(m === 'auto' ? 'AUTO' : 'BLACKOUT ' + m.toUpperCase(), `data-c="blackout" data-mode="${m}"`, d.bo === m)).join('') + '</div>' +
    `<div class="adm-sec">GLITCHED WALLS · ${d.gw}</div><div class="adm-row wrap">` + btn('GO TO NEAREST', 'data-c="glitch" data-mode="tp"') + btn('MOVE THEM', 'data-c="glitch" data-mode="new"') + '</div>' +
    `<div class="adm-sec">CARTOGRAPH · ${d.it ? 'ON THE FLOOR' : 'TAKEN'}</div><div class="adm-row wrap">` + btn('GO TO IT', 'data-c="item" data-mode="tp"') + btn('MOVE IT', 'data-c="item" data-mode="new"') + btn('GIVE ME ONE', 'data-a="give"') + '</div>' +
    `<div class="adm-sec">RUN</div><div class="adm-row wrap">` + btn('NEW RUN FOR EVERYONE', 'data-c="world" data-confirm="Reset the whole world?"') + '</div>';
  if (players !== adm.sigP) { $a('admPlayers').innerHTML = '<div class="adm-sec">WANDERERS</div>' + players; adm.sigP = players; }
  if (world !== adm.sigW) { $a('admWorld').innerHTML = world; adm.sigW = world; }
}
function toggleAdmin() { adm.open = !adm.open; renderAdmin(); }
function unlock() { const v = $a('admPass').value; if (!v) return; adm.pass = v; adm.err = ''; tx({ t: 'admin', pass: v }); $a('admPass').value = ''; }
function sendMsg() { const el = $a('admText'), text = el.value.trim(); if (text) { tx({ t: 'a', c: 'msg', text }); el.value = ''; } }
panel.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.a === 'close') { adm.open = false; renderAdmin(); return; }
  if (b.dataset.a === 'unlock') return unlock();
  if (b.dataset.a === 'msg') return sendMsg();
  if (b.dataset.a === 'give') { giveItem('cartograph'); return; }
  if (!b.dataset.c) return;
  if (b.dataset.confirm && !confirm(b.dataset.confirm)) return;
  const o = { t: 'a', c: b.dataset.c };
  if (b.dataset.id) o.id = +b.dataset.id;
  if (b.dataset.v) o.v = +b.dataset.v;
  if (b.dataset.mode) o.mode = b.dataset.mode;
  if (b.dataset.k) o.k = b.dataset.k;
  if (b.dataset.on !== undefined) o.on = +b.dataset.on;
  if (o.c === 'debug') { adm.dbg = !!o.on; if (!adm.dbg && EN()) EN().setDebug(null); adm.sigW = ''; renderAdminData(); }
  tx(o);
});
panel.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { if (e.target.id === 'admPass') unlock(); else if (e.target.id === 'admText') sendMsg(); } if (e.key === 'Escape') { adm.open = false; renderAdmin(); } });
addEventListener('keydown', e => { if (e.code === 'Backquote' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); toggleAdmin(); } });

/* ---------- fluorescent light hum ---------- */
/* Modelled on an old magnetic ballast: a 60 Hz mains buzz that is strongest at 120 Hz with a long tail of
 * harmonics, two slightly detuned copies beating slowly, a band of arc hiss chopped at 120 Hz, and a very
 * faint high whine. It is loudest near ceiling fixtures (and pans toward the nearest one), stutters with the
 * flickering fixtures, pops and crackles at random, and drops out with a thunk when a blackout hits and
 * comes back with a ballast-strike stutter. All levels are pre-master (the game's master gain is 0.14). */
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function buildHum(ctx, dest) {
  const out = ctx.createGain(); out.gain.value = 0;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) { out.connect(pan); pan.connect(dest); } else out.connect(dest);
  const src = [];
  const amps = [0, .42, 1, .5, .62, .24, .34, .12, .18, .07];              // harmonics 1..9 of 60 Hz
  const wave = ctx.createPeriodicWave(new Float32Array(amps.length), Float32Array.from(amps));
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900; lp.Q.value = .4;
  const buzz = ctx.createGain(); buzz.gain.value = .2; lp.connect(buzz); buzz.connect(out);
  for (const f of [60.0, 60.42]) {                                          // slow beating between the two
    const o = ctx.createOscillator(); o.setPeriodicWave(wave); o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = .5; o.connect(g); g.connect(lp); src.push(o);
  }
  const lfo = ctx.createOscillator(); lfo.frequency.value = .23;            // the buzz slowly breathes
  const lfoG = ctx.createGain(); lfoG.gain.value = .02; lfo.connect(lfoG); lfoG.connect(buzz.gain); src.push(lfo);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;      // arc hiss, chopped at 120 Hz
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3100; bp.Q.value = .8;
  const hiss = ctx.createGain(); hiss.gain.value = .05;
  const am = ctx.createOscillator(); am.frequency.value = 120; const amG = ctx.createGain(); amG.gain.value = .05;
  am.connect(amG); amG.connect(hiss.gain); ns.connect(bp); bp.connect(hiss); hiss.connect(out); src.push(am);
  const wh = ctx.createOscillator(); wh.frequency.value = 9300;             // faint ballast whine, drifting
  const whG = ctx.createGain(); whG.gain.value = .0022; wh.connect(whG); whG.connect(out);
  const dr = ctx.createOscillator(); dr.frequency.value = .07; const drG = ctx.createGain(); drG.gain.value = 40;
  dr.connect(drG); drG.connect(wh.frequency); src.push(wh, dr);
  src.forEach(o => o.start()); ns.start();
  return { ctx, dest, out, pan, buzz, hiss };
}
function humPop(h, vol, when) {                                              // tiny electrical crackle
  const c = h.ctx, len = Math.floor(c.sampleRate * (.006 + Math.random() * .02));
  const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * .25));
  const s = c.createBufferSource(); s.buffer = b;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900 + Math.random() * 1400;
  const g = c.createGain(); g.gain.value = vol; s.connect(hp); hp.connect(g); g.connect(h.out); s.start(when ?? c.currentTime);
}
function humThunk(h, when) {                                                 // relay / ballast dropping out
  const c = h.ctx, o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(95, when); o.frequency.exponentialRampToValueAtTime(30, when + .35);
  g.gain.setValueAtTime(.55, when); g.gain.exponentialRampToValueAtTime(.001, when + .4);
  o.connect(g); g.connect(h.dest); o.start(when); o.stop(when + .42);
}
function humTink(h, when) {                                                  // starter strike: click + short ring
  const c = h.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(1350, when); o.frequency.exponentialRampToValueAtTime(900, when + .05);
  g.gain.setValueAtTime(.09, when); g.gain.exponentialRampToValueAtTime(.001, when + .07);
  o.connect(g); g.connect(h.dest); o.start(when); o.stop(when + .08);
  humPop(h, .9, when);
}
let hum = null, prevBo = false, holdUntil = 0, nextPopT = 0, nextDip = 8, dipEnd = 0, lastFlick = 1;
function humUpdate() {
  const A = window.__api; if (!A || !A.audio || !A.lamps) return;
  const Z = A.audio(); if (!Z || !Z.context || !Z.gain) return;
  if (!hum || hum.ctx !== Z.context) hum = buildHum(Z.context, Z.gain);
  const c = hum.ctx, now = c.currentTime, tt = performance.now() / 1000, bo = !!A.V.blackout, P = A.H;
  let d = 1e9, li = -1;
  for (let i = 0; i < A.lamps.length; i++) { const dd = Math.hypot(A.lamps[i].x - P.x, A.lamps[i].y - P.y); if (dd < d) { d = dd; li = i; } }
  let level = bo ? .025 : .34 + .66 * (1 - smooth(70, 640, d));             // whole level hums; near a fixture it roars
  const near = !bo && li >= 0 && li % 13 === 0 && d < 520;                   // the game's flickering fixtures
  if (near) {
    const sn = Math.sin(tt * 11 + li); level *= .5 + .5 * Math.max(0, sn);
    if ((sn > .02) !== (lastFlick > .02)) humPop(hum, .7, now);
    lastFlick = sn;
  }
  if (!bo && tt > nextDip) { nextDip = tt + 9 + Math.random() * 18; dipEnd = tt + .06 + Math.random() * .12; }   // ballast struggling
  if (tt < dipEnd) level *= .3;
  const F = window.__sfx;
  if (F && F.has('hum')) {                                                   // user-supplied hum replaces the synthesized one
    hum.out.gain.setTargetAtTime(0, now, .05);
    if (bo !== prevBo) { prevBo = bo; if (F.has('blackout')) F.play('blackout'); }
    F.loop('hum', bo ? .03 : Math.min(1, level), bo || li < 0 ? 0 : Math.max(-.7, Math.min(.7, (A.lamps[li].x - P.x) / 450)));
    return;
  }
  if (bo !== prevBo) {
    prevBo = bo; const g = hum.out.gain; g.cancelScheduledValues(now);
    if (bo) { g.setTargetAtTime(.02, now, .04); humThunk(hum, now); humPop(hum, .8, now); holdUntil = now + .4; }
    else {
      const L = .34 + .66 * (1 - smooth(70, 640, d)); g.setValueAtTime(.02, now);
      for (const [t, v] of [[.05, .7], [.09, .05], [.15, .9], [.2, .12], [.3, 1.15], [.6, 1]]) g.linearRampToValueAtTime(Math.min(1.2, v * L), now + t);
      humTink(hum, now + .05); humTink(hum, now + .15); humPop(hum, .6, now + .3); holdUntil = now + .65;
    }
  }
  if (now >= holdUntil) hum.out.gain.setTargetAtTime(level, now, .06);
  if (hum.pan) hum.pan.pan.setTargetAtTime(bo || li < 0 ? 0 : Math.max(-.7, Math.min(.7, (A.lamps[li].x - P.x) / 450)), now, .15);
  if (now >= nextPopT) {
    humPop(hum, (bo ? .15 : .5) * (.5 + Math.random()), now);
    if (Math.random() < .25) humPop(hum, .3 * Math.random(), now + .03 + Math.random() * .06);
    nextPopT = now + (bo ? 3 + Math.random() * 6 : near ? .18 + Math.random() * .5 : 1.4 + Math.random() * 5.5);
  }
}
/* offline spectrum check (used by tests): energy at chosen frequencies, in dB relative to full scale */
N.testHum = async freqs => {
  const oc = new OfflineAudioContext(1, 44100 * 3, 44100), h = buildHum(oc, oc.destination); h.out.gain.value = 1;
  const buf = await oc.startRendering(), x = buf.getChannelData(0).subarray(44100), out = {};
  for (const f of freqs) { let re = 0, im = 0; for (let i = 0; i < x.length; i++) { const w = 2 * Math.PI * f * i / 44100; re += x[i] * Math.cos(w); im += x[i] * Math.sin(w); } out[f] = +(20 * Math.log10(Math.hypot(re, im) * 2 / x.length + 1e-9)).toFixed(1); }
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); out.peak = +pk.toFixed(3); return out;
};

/* ---------- per-frame hook (called by the game every frame) ---------- */
let k = 0, stingCd = 6;
window.__mp = ({ p, cam, sc, run, started, light: lightOn, G, q, los, t }) => {
  const dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);

  if (N.on) { applyServerState(t); applyCaught(); if (EN() && window.__api) EN().entAudio(t, hSlots, window.__api.q); }
  else { if (window.__mv && window.__mv.down) { window.__mv.down = 0; window.__mv.dragTo = null; } if (started && !exited) { soloGlitches(p); if (!(window.__items && window.__items.length) && window.__itemSolo !== true) soloItem(); } }
  if (run && !exited) itemsFrame(p);
  humUpdate();
  if (window.__glitchFrame) window.__glitchFrame({ p, cam, sc, los, W, H, t, run: run && !exited });
  const note = document.getElementById('onlineNote'); if (note) note.hidden = !N.on;

  /* --- network send --- */
  const now = performance.now();
  if (ws && ws.readyState === 1 && now - lastSend > (started ? 50 : 250)) {
    lastSend = now;
    ws.send(JSON.stringify({
      t: 'p', x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy),
      a: +p.angle.toFixed(2), r: p.sprinting ? 1 : 0, l: lightOn ? 1 : 0, k: p.equipment?.kind, lp: partList(p.equipment),
      n: (document.getElementById('nameplate')?.textContent || 'WANDERER').slice(0, 20), c: p.equipment?.color,
      f: window.__api && window.__api.fall ? +window.__api.fall().toFixed(2) : -1,
      lk: window.__api ? [window.__api.look.hat, window.__api.look.texture, window.__api.look.hands, window.__api.look.main, window.__api.look.backpack].join('|') : undefined,
      mv: started && window.__mv ? window.__mv.net() : undefined,           // how we move: state, speed, stamina, vault / slide noises - the entities hear these
    }));
    net.textContent = N.on ? 'ONLINE · ROOM ' + room.toUpperCase() + ' · ' + (peersN + 1) + ' WANDERER' + (peersN ? 'S' : '') + ' · SHARED MONSTERS' + (adm.unlocked ? ' · ADMIN' : '')
                           : 'CONNECTING…';
  }
  /* --- other wanderers: real avatars (same look as yours), their own lights, hover name --- */
  drawPeers(p, cam, sc, los, t, W, H);
  /* --- dread: proximity to hound + smilers drives heartbeat, drone, vignette, shake, flicker --- */
  let d = 1e9;
  if (run) { d = Math.hypot(G.x - p.x, G.y - p.y); for (const s of q) d = Math.min(d, Math.hypot(s.x - p.x, s.y - p.y)); }
  const target = run ? Math.max(0, Math.min(1, 1 - d / 620)) : 0;
  k += (target - k) * Math.min(1, t * (target > k ? 3 : .8));
  if (dg && ac) dg.gain.value = soundOn() ? k * k * .16 : 0;
  beatT -= t;
  if (k > .08 && beatT <= 0) { beatT = .95 - .6 * k; thump(.5 * k + .1, 70); setTimeout(() => thump(.35 * k + .06, 58), 140); }
  hitFlash = Math.max(0, hitFlash - t * 1.6);
  const dv = k < .05 ? 0 : Math.min(1, k * 1.15) * (.75 + .25 * Math.sin(now / (140 - 70 * k)));
  dread.style.opacity = Math.max(dv, hitFlash * .95);
  game.style.transform = k > .55 ? `translate(${(Math.random() - .5) * k * 5}px,${(Math.random() - .5) * k * 5}px)` : '';
  light.style.opacity = k > .35 && Math.random() < k * .09 ? .35 + Math.random() * .4 : 1;
  stingCd -= t;
  if (k > .45 && stingCd <= 0) { stingCd = 9 + Math.random() * 10; if (!(window.__sfx && window.__sfx.play('sting', { vol: Math.min(1, .5 + k) }))) burst(.35, .12 * k); }
};
})();
