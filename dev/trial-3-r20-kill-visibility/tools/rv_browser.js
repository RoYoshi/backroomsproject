#!/usr/bin/env node
/* dev/trial-3-r20-kill-visibility/tools/rv_browser.js - Trial 3 R20, the owner's addendum (kill visibility, RV01-RV07): several creatures
 * on real pages while one of them kills.  Development tool; evidence, not a gate step.  Trial 3 is not owner-approved.
 *
 *   node dev/trial-3-r20-kill-visibility/tools/rv_browser.js --dir TREE [--part skin|other|all] [--only REGEX] [--out FILE.json] [--label NAME] [--shots DIR]
 *
 * The pages and the server are R9-R16's (dev/trial-3-r9-overhaul/tools/r9_browser.js: headless Chromium pages that enter the game with
 * their own keys, and the test-only qa_server.js that PLACES a creature exactly, as dev/tests do; R20 added its read-only 'kills' and
 * 'ents' reports).  A kill is the admin's DEATHS-tab preview: the real capture and kill path, which takes the creature of that kind nearest
 * to the victim.  The world is held (the admin's freeze) so nothing walks off.  Every page samples itself every frame
 * (requestAnimationFrame): each mirrored Skin-Stealer's view (its entity id, visible, alpha, and whether it is drawn at all - no hidden or
 * transparent parent), every other Skin-Stealer drawing on the page (a death's attacker), our own death, the replays playing, and the
 * Hound and Smiler slots the page hides while a kill plays (window.__killer, __fxKill, __fxKillS), with the entity in each slot.
 * What is judged is what the page drew, against the server's own record of who killed (its kill record's entity id, from qa 'kills').
 *   skin   RV01-RV04: two Skin-Stealers 60 and 130 px from the victim, each kill variant A-D (D: the Rend) - victim's page, a spectator's;
 *          the two swapped; four Skin-Stealers (the admin cap), two victims killed at once, a third page watching; repeated; a page joining
 *          mid-kill and a spectator reconnecting mid-kill; after the death and the revive every mirror back
 *   other  RV05: a Skin-Stealer's kill with a Hound and a Smiler beside it; two Hounds, one kills; two Smilers, one kills; a Hound's kill
 *          beside a Skin-Stealer; a Smiler's kill beside a Skin-Stealer - each from the victim's page and a spectator's, reported apiece
 * Every name and passcode is synthetic (r9_browser.js's); no address, path or secret is written to the output. */
'use strict';
const fs = require('fs'), path = require('path');
const B = require(path.join(__dirname, '..', '..', 'trial-3-r9-overhaul', 'tools', 'r9_browser.js'));
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const { sleep, until } = B, PART = ARG.part || 'all', SHOTS = ARG.shots ? path.resolve(ARG.shots) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const VP = { width: 800, height: 500 };   // (each page in a browser of its own: a page behind another in the same browser draws no frames)

/* the per-frame sampler, in each page */
const SAMPLER = `(() => { if (window.__rv) { window.__rv.rec = []; return; } const R = window.__rv = { rec: [], snap: null, ws: null };
  const hear = () => { const g = window.__k3 && window.__k3.game; if (!g || R.ws === g) return; R.ws = g;   // (a page sampled from before it enters: the game's socket is listened to once it is open)
    g.addEventListener('message', e => { try { const m = JSON.parse(e.data); if (m.t === 's' && m.e) R.snap = { h: (m.e.h || []).map(q => [q.i, q.x, q.y]), m: (m.e.m || []).map(q => [q.i, q.x, q.y]) }; } catch (x) { } }); };
  const eff = o => { for (let x = o; x; x = x.parent) if (x.visible === false || x.alpha === 0) return 0; return 1; };
  const near = (L, x, y) => { let b = null, bd = 30; for (const q of L || []) { const d = Math.hypot(q[1] - x, q[2] - y); if (d < bd) { bd = d; b = q[0]; } } return b; };
  const f = () => { try {
    hear(); const A = window.__api; if (!A || !A.layer || !A.layer()) throw 0; let root = A.layer(); while (root.parent) root = root.parent;
    const mir = [], att = []; const walk = o => { if (o.__skin) { if (o.__id !== undefined) mir.push([o.__id, o.visible ? 1 : 0, +(+o.alpha).toFixed(2), eff(o), Math.round(o.x), Math.round(o.y)]); else if (eff(o) && !o.destroyed) att.push(o.label || '?'); } for (const c of o.children || []) walk(c); };
    walk(root);
    const D = A.death && A.death(), H = window.__hounds || [], S = R.snap || { h: [], m: [] };
    const fx = (window.__fxs || []).filter(x => !x.gone && x.jl && !x.jl.finished).map(x => [x.cause, x.eid || 0, Math.round(x.jl.source ? x.jl.source.x : 0), Math.round(x.jl.source ? x.jl.source.y : 0)]);
    const kH = [...(window.__fxKill || [])].map(s => H[s] ? H[s].id : -1), own = window.__killer >= 0 && H[window.__killer] ? H[window.__killer].id : -1;
    const kS = [...(window.__fxKillS || [])].map(i => { const q = A.q && A.q[i]; return q ? near(S.m, q.x, q.y) : -1; });
    const K = window.__killBy || null, Hp = A.H ? [Math.round(A.H.x), Math.round(A.H.y)] : [0, 0], Ds = D && D.active && D.source ? [Math.round(D.source.x), Math.round(D.source.y)] : null;
    R.rec.push([+(performance.now() / 1000).toFixed(3), mir, att, D && D.active ? D.kind : '', fx, kH, own, kS, K ? [K.k, K.e] : null, Hp, Ds]);
    if (R.rec.length > 20000) R.rec.shift();
  } catch (x) { } requestAnimationFrame(f); }; f(); })()`;
const take = pg => pg.P.isClosed() ? Promise.resolve([]) : pg.P.evaluate(() => { const r = window.__rv.rec.slice(); window.__rv.rec = []; return r; }).catch(() => []);

/* what one page drew while a kill (or kills) played.  kills: the server's records [{e, ax, ay}]; a kill is playing on this page while our
 * own death's source or a replay's source is at its attacker's place (40 px) - the same test on any tree, an id or none.  A creature
 * counts only while it is near enough to this page's player to be drawn at all (within 1200 px: a page culls what is 1600 px off) */
function judge(rec, kills, bystanders, kind = 'SkinStealer') {
  const at = (q, k) => q && Math.hypot(q[0] - k.ax, q[1] - k.ay) < 40;
  const playingK = (r, k) => (r[3] === kind && at(r[10], k)) || r[4].some(f => f[0] === kind && at([f[2], f[3]], k));
  const near = (r, m) => m && Math.hypot(m[4] - r[9][0], m[5] - r[9][1]) < 1200;
  const P = rec.filter(r => kills.some(k => playingK(r, k)));
  const out = { frames: rec.length, playing: P.length, bystanderHidden: 0, bystanderFaded: 0, bystanderSeen: 0, killerShown: 0, killerJudged: 0, attackers: [0, 0], mostSkins: 0 };
  for (const r of P) {
    for (const id of bystanders) { const m = r[1].find(q => q[0] === id); if (!near(r, m)) continue; out.bystanderSeen++; if (!m[3]) out.bystanderHidden++; else if (m[2] < .99) out.bystanderFaded++; }
    for (const k of kills) { if (!playingK(r, k)) continue; const m = r[1].find(q => q[0] === k.e); if (!near(r, m)) continue; out.killerJudged++; if (m[3]) out.killerShown++; }
    out.mostSkins = Math.max(out.mostSkins, r[1].filter(q => q[3]).length + r[2].length);
  }
  out.attackers = P.length ? [Math.min(...P.map(r => r[2].length)), Math.max(...P.map(r => r[2].length))] : [0, 0];
  out.hSlotsHidden = [...new Set(P.flatMap(r => r[5].concat(r[6] >= 0 ? [r[6]] : [])))];
  out.sSlotsHidden = [...new Set(P.flatMap(r => r[7]))];
  out.killBy = P.length && P[0][8] ? P[0][8] : null;
  out.replayIds = [...new Set(P.flatMap(r => r[4].map(f => f[1])))];
  return out;
}
/* after: every mirror drawn again (nothing left hidden or faded), no attacker left */
function after(rec) {
  const L = rec.slice(-20); if (!L.length) return { frames: 0 };
  const nr = (r, q) => Math.hypot(q[4] - r[9][0], q[5] - r[9][1]) < 1200;
  return { frames: L.length, hidden: L.filter(r => r[1].some(q => nr(r, q) && !q[3])).length, faded: L.filter(r => r[1].some(q => nr(r, q) && q[3] && q[2] < .99)).length, attackers: Math.max(...L.map(r => r[2].length)), playing: L.filter(r => r[3] || r[4].length).length, mirrors: Math.max(...L.map(r => r[1].filter(q => nr(r, q)).length)) };
}

(async () => {
  const { p: srv, port, qa } = await B.serve();
  const browsers = [], br = async () => { const x = await B.pw.chromium.launch({ args: B.LAUNCH }); browsers.push(x); return x; };
  const b = await br();
  const R = { tool: 'dev/trial-3-r20-kill-visibility/tools/rv_browser.js', chromium: b.version(), tree: ARG.label || path.basename(B.DIR), cases: [] };
  const room = 'rv' + (Date.now() % 1e6);
  let V = await B.runPage(b, port, room, VP, 'RvVictim'), S = await B.runPage(await br(), port, room, VP, 'RvWitness');
  const pid = async pg => pg.P.evaluate(() => __api.H.id);
  const tp = (pg, x, y) => pg.P.evaluate(q => __api.tp(q.x, q.y), { x, y });
  const torch = async (pg, on) => { if ((await pg.P.evaluate(() => __api.lightOn()).catch(() => on)) !== on) await pg.P.keyboard.press('KeyF'); };
  const clear = async () => { V.cmd({ c: 'skinstealers', mode: 'remove', n: 4 }); V.cmd({ c: 'hounds', mode: 'remove', n: 10 }); V.cmd({ c: 'smilers', mode: 'remove', n: 10 }); await sleep(800); };
  const revive = async (pg) => { const id = await pid(pg); for (let k = 0; k < 3; k++) { if (!(await pg.P.evaluate(() => !!(__api.death() && __api.death().active) || !!__api.H.dead).catch(() => false))) return; V.cmd({ c: 'revive', id }); await sleep(1800); } };
  const spawn = async (kind, x, y, hunger) => qa({ op: 'spawn', kind, x, y, hunger: hunger ?? .2, ang: 0 });
  V.cmd({ c: 'freeze', on: true }); await clear(); await sleep(300); await clear();
  const C = { x: 6700, y: 3440 };                                                // (R15's Rend place: open floor, a lamp)
  const set = async pages => { await tp(V, C.x, C.y); await tp(S, C.x + 230, C.y + 40); await sleep(700); for (const pg of pages) { await torch(pg, true); await pg.P.evaluate(SAMPLER); } };
  const shot = async (pg, name) => { if (!SHOTS) return; await pg.P.screenshot({ path: path.join(SHOTS, name + '.png') }).catch(() => { }); };
  const one = async (name, pages, kind, mk, opts = {}) => {
    if (ARG.only && !new RegExp(ARG.only).test(name)) return null;
    const F = { name }; try {
      for (const pg of pages) await revive(pg); await clear(); await set(pages);
      const ids = await mk(); await sleep(900);                                  // (every page has them mirrored)
      for (const pg of pages) await take(pg);
      const preview = opts.victims || [V], pre = opts.pre ? await opts.pre() : null;
      const t0 = Date.now(); for (const pg of preview) pg.cmd({ c: 'preview', k: kind === 'SkinStealer' ? 'skinstealer' : kind.toLowerCase(), var: opts.v || 'A' });
      if (opts.during) await opts.during(t0, F, pre);
      await sleep(Math.max(0, 1300 - (Date.now() - t0))); for (const pg of pages) await shot(pg, `${R.tree}_${name.replace(/[^A-Za-z0-9]+/g, '_')}_${pages.indexOf(pg)}`);
      await sleep(Math.max(0, (opts.secs || 6.5) * 1000 - (Date.now() - t0)));
      const kills = (await qa({ op: 'kills' })).kills || [], ents = (await qa({ op: 'ents' })).ents || [];
      const killers = kills.map(k => k.e), all = ents.map(e => e.id), by = all.filter(id => !killers.includes(id) && ents.find(e => e.id === id).kind === 'skinstealer');
      F.kills = kills.map(k => ({ e: k.e, k: k.k, v: k.v })); F.ents = ents.map(e => ({ id: e.id, kind: e.kind }));
      const recs = []; for (const pg of pages.concat(opts.extra ? opts.extra() : [])) recs.push(await take(pg));
      F.pages = recs.map((rec, i) => Object.assign({ page: i }, judge(rec, kills, by, kind)));
      for (const pg of preview) await revive(pg); await sleep(1500);
      F.after = []; const live = pages.concat(opts.extra ? opts.extra() : []).filter(pg => pg && !pg.P.isClosed());
      for (const pg of live) { await tp(pg, C.x + 150, C.y - 60); } await sleep(1200); for (const pg of live) await pg.P.evaluate(() => { window.__rv.rec = []; }); await sleep(1500);   // (every page back beside them: nothing culled for distance)
      for (const pg of live) F.after.push(after(await take(pg)));
    } catch (e) { F.error = String(e && e.message || e).slice(0, 240); }
    R.cases.push(F); console.log(name + ': ' + JSON.stringify({ kills: F.kills, pages: (F.pages || []).map(p => [p.playing, p.bystanderSeen, p.bystanderHidden, p.killerJudged, p.killerShown, p.attackers, p.hSlotsHidden, p.sSlotsHidden]), after: F.after, error: F.error }));
    return F;
  };
  try {
    if (PART === 'skin' || PART === 'all') {
      for (const v of ['A', 'B', 'C', 'D']) await one(`RV01/02 two Skin-Stealers, variant ${v}`, [V, S], 'SkinStealer', async () => { const a = await spawn('skinstealer', C.x + 60, C.y), b0 = await spawn('skinstealer', C.x - 40, C.y + 120); return [a.id, b0.id]; }, { v });
      await one('RV03 swapped: the second-spawned nearer (it kills), variant A', [V, S], 'SkinStealer', async () => { const a = await spawn('skinstealer', C.x - 40, C.y + 130), b0 = await spawn('skinstealer', C.x + 55, C.y - 10); return [a.id, b0.id]; }, { v: 'A' });
      const W = await B.runPage(await br(), port, room, VP, 'RvThird');
      const four = async () => { const L = []; for (const [dx, dy] of [[60, 0], [-50, 110], [230 + 60, 40], [230 - 40, 160]]) L.push((await spawn('skinstealer', C.x + dx, C.y + dy)).id); await tp(W, C.x + 110, C.y - 160); await torch(W, true); await W.P.evaluate(SAMPLER); return L; };
      for (const v of ['A', 'D']) await one(`RV03 four Skin-Stealers, two victims at once, variant ${v} (a third page watching)`, [V, S, W], 'SkinStealer', four, { v, victims: [V, S] });
      await one('RV03 four Skin-Stealers, two victims at once, again (repeated)', [V, S, W], 'SkinStealer', four, { v: 'B', victims: [V, S] });
      // a page joining mid-kill; the spectator reconnecting mid-kill (a new page in its place)
      let J = null, Lp = null;
      await one('RV04 a fresh page joins at 0.7 s, the spectator\'s connection drops at 1.0 s and reconnects, variant D', [V, S], 'SkinStealer', async () => { const a = await spawn('skinstealer', C.x + 60, C.y), b0 = await spawn('skinstealer', C.x - 40, C.y + 120); return [a.id, b0.id]; }, { v: 'D',
        pre: async () => { const Jp = await B.prepPage(await br(), port, room, VP, 'RvJoiner'); await Jp.P.evaluate(SAMPLER);
          // (a page in the room whose replay arrives mid-kill: the server's own 'fx' message held back on arrival and handed to the page's own
          //  handler 1.2 s later with its el - what aftSend gives a page that joins then; on this machine a fresh page takes ~12 s to enter,
          //  a reconnect ~5 s, and a Skin-Stealer's death lasts 3.2-3.6 s)
          Lp = await B.runPage(await br(), port, room, VP, 'RvLate'); await tp(Lp, C.x + 120, C.y + 170); await torch(Lp, true); await Lp.P.evaluate(SAMPLER);
          await Lp.P.evaluate(() => { const g = window.__k3.game, h = g.onmessage; window.__rvHold = { on: true, q: [] };
            g.onmessage = e => { try { const m = JSON.parse(e.data); if (window.__rvHold.on && m.t === 'fx' && m.k === 'death') { window.__rvHold.q.push([performance.now(), m]); return; } } catch (x) { } return h.call(g, e); };
            window.__rvRelease = () => { const H = window.__rvHold; H.on = false; const n = H.q.length; for (const [t, m] of H.q) h.call(g, { data: JSON.stringify(Object.assign({}, m, { el: +((performance.now() - t) / 1000 + (+m.el || 0)).toFixed(2) })) }); H.q = []; return n; }; });
          await sleep(900); return Jp; },
        during: async (t0, F, Jp) => {
          (async () => { await until(Lp.P, () => window.__rvHold && window.__rvHold.q.length > 0, null, 6000, 30); F.heldAt = +((Date.now() - t0) / 1000).toFixed(2); await sleep(1200); F.lateFx = await Lp.P.evaluate(() => window.__rvRelease()); F.lateAt = +((Date.now() - t0) / 1000).toFixed(2); })();   // (held from its arrival, given 1.2 s later)                                             // (the fresh page enters at its moment; entering takes its own seconds, as a real join does)
          await sleep(Math.max(0, 700 - (Date.now() - t0))); F.joinAt = +((Date.now() - t0) / 1000).toFixed(2);
          const jE = Jp.enter().then(async x => { J = x; await tp(J, C.x + 200, C.y - 120).catch(() => { }); F.jIn = +((Date.now() - t0) / 1000).toFixed(2); });
          await sleep(Math.max(0, 1000 - (Date.now() - t0)));                      // (the spectator's socket closed: the page's own reconnect - a new connection, a new join, the replay sent again with its el)
          await S.P.evaluate(() => window.__k3.game.close()); F.dropAt = +((Date.now() - t0) / 1000).toFixed(2);
          await until(S.P, () => !!(window.__net && __net.on && window.__k3.game && window.__k3.game.readyState === 1 && window.__api.H), null, 15000, 50);
          await tp(S, C.x + 230, C.y + 40).catch(() => { }); F.backAt = +((Date.now() - t0) / 1000).toFixed(2);
          await jE; },
        extra: () => [Lp, J].filter(Boolean), secs: 10 });
      if (J) await J.ctx.close().catch(() => { }); if (Lp) await Lp.ctx.close().catch(() => { });
      await W.ctx.close().catch(() => { });
    }
    if (PART === 'other' || PART === 'all') {
      await one('RV05 a Skin-Stealer kills beside a Hound and a Smiler', [V, S], 'SkinStealer', async () => [(await spawn('skinstealer', C.x + 60, C.y)).id, (await spawn('hound', C.x - 60, C.y + 110)).id, (await spawn('smiler', C.x + 20, C.y - 140)).id], { v: 'A' });
      await one('RV05 two Hounds, one kills', [V, S], 'Hound', async () => [(await spawn('hound', C.x + 60, C.y)).id, (await spawn('hound', C.x - 50, C.y + 110)).id], { v: 'A' });
      await one('RV05 two Hounds side by side (30 px apart), one kills', [V, S], 'Hound', async () => [(await spawn('hound', C.x + 60, C.y)).id, (await spawn('hound', C.x + 60, C.y + 34)).id], { v: 'B' });
      await one('RV05 two Smilers, one kills', [V, S], 'Smiler', async () => [(await spawn('smiler', C.x + 60, C.y)).id, (await spawn('smiler', C.x - 50, C.y + 120)).id], { v: 'A' });
      await one('RV05 a Hound kills beside a Skin-Stealer', [V, S], 'Hound', async () => [(await spawn('hound', C.x + 60, C.y)).id, (await spawn('skinstealer', C.x - 50, C.y + 110)).id], { v: 'A' });
      await one('RV05 a Smiler kills beside a Skin-Stealer', [V, S], 'Smiler', async () => [(await spawn('smiler', C.x + 60, C.y)).id, (await spawn('skinstealer', C.x - 50, C.y + 110)).id], { v: 'A' });
    }
  } finally {
    R.errors = { V: V.errs.slice(0, 10), S: S.errs.slice(0, 10) };
    for (const x of browsers) await x.close().catch(() => { }); try { process.kill(srv.pid); } catch (e) { }
  }
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exitCode = 1; });
