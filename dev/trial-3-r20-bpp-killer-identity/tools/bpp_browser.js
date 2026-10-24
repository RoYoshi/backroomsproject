#!/usr/bin/env node
/* dev/trial-3-r20-bpp-killer-identity/tools/bpp_browser.js - Trial 3 R20, the B++ killer-identity branch: the owner's five real-page
 * scenarios (development tool; evidence, not a gate step; Trial 3 is not owner-approved).  A fork of
 * dev/trial-3-r20-kill-visibility/tools/rv_browser.js (its pages, server, sampler and Skin-Stealer judge, unchanged), with:
 *   - the sampler also keeps the ids of the Hounds and Smilers in this page's last snapshot (to judge a mirror that is there);
 *   - the sampler's own-death killer (window.__killer) is counted only while this page's own Hound death plays, as the bundle reads it
 *     (rv_browser.js counted a stale slot left from an earlier death);
 *   - judgeHS: for a Hound's or a Smiler's kill, on every frame it plays, the entity ids in the slots the page hides (window.__fxKill and
 *     window.__killer for Hounds, window.__fxKillS for Smilers, each slot mapped to the creature in it) against the server's own kill
 *     records (qa 'kills': the killer's id): the killer's mirror hidden (it is drawn once: by the attack), each bystander drawn;
 *   - the scenes:
 *       BPP1 two Hounds 110 px apart (and 34 px apart), the one that kills a step from the victim, its pack-mate nearer the attacker's
 *            place on a spectator's page (R20's RV05 scene where R19 / R20 hid the pack-mate)
 *       BPP2 two Smilers, one kills
 *       BPP3 two Skin-Stealers, variants A and D (R20's fix)
 *       BPP4 two victims killed at once by two Hounds, with a Smiler and a Skin-Stealer beside them and a third page watching
 *       BPP5 a delayed replay: a page whose replay message is held back on arrival and handed to its own handler 1.2 s later with its el
 *            (what a late joiner is sent); the spectator's connection dropped at 1.0 s and its page reconnecting (the server sends it the
 *            replay again, with el); and a fresh page told to enter at 0.7 s (it enters only if this machine is fast enough)
 *
 *   node dev/trial-3-r20-bpp-killer-identity/tools/bpp_browser.js --dir TREE [--only REGEX] [--out FILE.json] [--label NAME] [--raw 1]
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
    const kH = [...(window.__fxKill || [])].map(s => H[s] ? H[s].id : -1), own = D && D.active && D.kind === 'Hound' && window.__killer >= 0 && H[window.__killer] ? H[window.__killer].id : -1;   // (this fork: as the bundle reads it - only while our own Hound death plays)
    const kS = [...(window.__fxKillS || [])].map(i => { const q = A.q && A.q[i]; return q ? near(S.m, q.x, q.y) : -1; });
    const K = window.__killBy || null, Hp = A.H ? [Math.round(A.H.x), Math.round(A.H.y)] : [0, 0], Ds = D && D.active && D.source ? [Math.round(D.source.x), Math.round(D.source.y)] : null;
    R.rec.push([+(performance.now() / 1000).toFixed(3), mir, att, D && D.active ? D.kind : '', fx, kH, own, kS, K ? [K.k, K.e] : null, Hp, Ds, [S.h.map(q => q[0]), S.m.map(q => q[0])]]);
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
/* a Hound's or a Smiler's kill(s) on one page: on each frame one plays, which creatures' mirrors the page hides (by entity id), against the
 * server's kill records.  killerHidden / killerJudged: frames its killer is hidden while mirrored on this page (drawn once, by the attack);
 * bystanderHidden / bystanderSeen: frames another creature of that kind, mirrored here, is hidden; otherHidden: frames a creature of the
 * other kind is hidden.  ownDeath: frames of this page's own death (the victim's page) */
function judgeHS(rec, kills, kind) {
  const at = (q, k) => q && Math.hypot(q[0] - k.ax, q[1] - k.ay) < 40;
  const own = (r, k) => r[3] === kind && at(r[10], k), rep = (r, k) => r[4].some(f => f[0] === kind && at([f[2], f[3]], k));
  const P = rec.filter(r => kills.some(k => own(r, k) || rep(r, k))), killers = kills.map(k => k.e);
  const o = { frames: rec.length, playing: P.length, ownDeath: P.filter(r => kills.some(k => own(r, k))).length, killerJudged: 0, killerHidden: 0, bystanderSeen: 0, bystanderHidden: 0, otherHidden: 0, skinSeen: 0, skinHidden: 0, hiddenIds: [], replayIds: [] };
  const hid = new Set(), rid = new Set();
  for (const r of P) {
    const hH = new Set(r[5].concat(r[6] >= 0 ? [r[6]] : [])), hS = new Set(r[7]), mine = kind === 'Hound' ? hH : hS, other = kind === 'Hound' ? hS : hH;
    const present = (r[11] || [[], []])[kind === 'Hound' ? 0 : 1];
    for (const id of mine) hid.add(id); for (const f of r[4]) if (f[0] === kind) rid.add(f[1]);
    for (const k of kills) if ((own(r, k) || rep(r, k)) && present.includes(k.e)) { o.killerJudged++; if (mine.has(k.e)) o.killerHidden++; }
    for (const id of present) if (!killers.includes(id)) { o.bystanderSeen++; if (mine.has(id)) o.bystanderHidden++; }
    if (other.size) o.otherHidden++;
    for (const m of r[1]) if (m && Math.hypot(m[4] - r[9][0], m[5] - r[9][1]) < 1200) { o.skinSeen++; if (!m[3]) o.skinHidden++; }   // (a Skin-Stealer beside it: its own view drawn)
  }
  o.hiddenIds = [...hid]; o.replayIds = [...rid];
  return o;
}
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
      if (ARG.raw) F.raw = recs;                                                    // (--raw 1: every page's frames, for a closer look)
      F.pages = recs.map((rec, i) => Object.assign({ page: i }, kind === 'SkinStealer' ? judge(rec, kills, by, kind) : judgeHS(rec, kills, kind)));
      for (const pg of preview) await revive(pg); await sleep(1500);
      F.after = []; const live = pages.concat(opts.extra ? opts.extra() : []).filter(pg => pg && !pg.P.isClosed());
      for (const pg of live) { await tp(pg, C.x + 150, C.y - 60); } await sleep(1200); for (const pg of live) await pg.P.evaluate(() => { window.__rv.rec = []; }); await sleep(1500);   // (every page back beside them: nothing culled for distance)
      for (const pg of live) F.after.push(after(await take(pg)));
    } catch (e) { F.error = String(e && e.message || e).slice(0, 240); }
    R.cases.push(F); console.log(name + ': ' + JSON.stringify({ kills: F.kills, ents: F.ents, pages: F.pages, late: { heldAt: F.heldAt, lateFx: F.lateFx, lateAt: F.lateAt, joinAt: F.joinAt, jIn: F.jIn, dropAt: F.dropAt, backAt: F.backAt }, after: F.after, error: F.error }));
    return F;
  };
  try {
    const twoHounds = async () => [(await spawn('hound', C.x + 60, C.y)).id, (await spawn('hound', C.x - 50, C.y + 110)).id];
    await one('BPP1 two Hounds 110 px apart, one kills (its pack-mate nearer the attacker\'s place on the spectator\'s page)', [V, S], 'Hound', twoHounds, { v: 'A' });
    await one('BPP1 two Hounds 110 px apart, one kills, variant B', [V, S], 'Hound', twoHounds, { v: 'B' });
    await one('BPP1 two Hounds 34 px apart, one kills', [V, S], 'Hound', async () => [(await spawn('hound', C.x + 60, C.y)).id, (await spawn('hound', C.x + 60, C.y + 34)).id], { v: 'B' });
    await one('BPP2 two Smilers, one kills', [V, S], 'Smiler', async () => [(await spawn('smiler', C.x + 60, C.y)).id, (await spawn('smiler', C.x - 50, C.y + 120)).id], { v: 'A' });
    await one('BPP2 two Smilers, the other one nearer the spectator', [V, S], 'Smiler', async () => [(await spawn('smiler', C.x + 55, C.y - 10)).id, (await spawn('smiler', C.x + 150, C.y + 60)).id], { v: 'A' });
    for (const v of ['A', 'D']) await one(`BPP3 two Skin-Stealers, variant ${v}`, [V, S], 'SkinStealer', async () => [(await spawn('skinstealer', C.x + 60, C.y)).id, (await spawn('skinstealer', C.x - 40, C.y + 120)).id], { v });
    {
      const W = await B.runPage(await br(), port, room, VP, 'BppThird');
      await one('BPP4 two victims at once, two Hounds, a Smiler and a Skin-Stealer beside them, a third page watching', [V, S, W], 'Hound', async () => {
        const L = [(await spawn('hound', C.x + 60, C.y)).id, (await spawn('hound', C.x + 230 + 60, C.y + 40)).id, (await spawn('smiler', C.x + 120, C.y - 90)).id, (await spawn('skinstealer', C.x + 130, C.y + 150)).id];
        await tp(W, C.x + 110, C.y - 160); await torch(W, true); await W.P.evaluate(SAMPLER); return L; }, { v: 'A', victims: [V, S] });
      await W.ctx.close().catch(() => { });
    }
    {
      let J = null, Lp = null;
      await one('BPP5 a Hound kills beside its pack-mate: a replay delivered 1.2 s late (with el), the spectator reconnecting at 1.0 s, a fresh page entering at 0.7 s', [V, S], 'Hound', twoHounds, { v: 'A',
        pre: async () => { const Jp = await B.prepPage(await br(), port, room, VP, 'BppJoiner'); await Jp.P.evaluate(SAMPLER);
          Lp = await B.runPage(await br(), port, room, VP, 'BppLate'); await tp(Lp, C.x + 120, C.y + 170); await torch(Lp, true); await Lp.P.evaluate(SAMPLER);
          await Lp.P.evaluate(() => { const g = window.__k3.game, h = g.onmessage; window.__rvHold = { on: true, q: [] };
            g.onmessage = e => { try { const m = JSON.parse(e.data); if (window.__rvHold.on && m.t === 'fx' && m.k === 'death') { window.__rvHold.q.push([performance.now(), m]); return; } } catch (x) { } return h.call(g, e); };
            window.__rvRelease = () => { const H = window.__rvHold; H.on = false; const n = H.q.length; for (const [t, m] of H.q) h.call(g, { data: JSON.stringify(Object.assign({}, m, { el: +((performance.now() - t) / 1000 + (+m.el || 0)).toFixed(2) })) }); H.q = []; return n; }; });
          await sleep(900); return Jp; },
        during: async (t0, F, Jp) => {
          (async () => { await until(Lp.P, () => window.__rvHold && window.__rvHold.q.length > 0, null, 6000, 30); F.heldAt = +((Date.now() - t0) / 1000).toFixed(2); await sleep(1200); F.lateFx = await Lp.P.evaluate(() => window.__rvRelease()); F.lateAt = +((Date.now() - t0) / 1000).toFixed(2); })();
          await sleep(Math.max(0, 700 - (Date.now() - t0))); F.joinAt = +((Date.now() - t0) / 1000).toFixed(2);
          const jE = Jp.enter().then(async x => { J = x; await tp(J, C.x + 200, C.y - 120).catch(() => { }); F.jIn = +((Date.now() - t0) / 1000).toFixed(2); });
          await sleep(Math.max(0, 1000 - (Date.now() - t0)));
          await S.P.evaluate(() => window.__k3.game.close()); F.dropAt = +((Date.now() - t0) / 1000).toFixed(2);
          await until(S.P, () => !!(window.__net && __net.on && window.__k3.game && window.__k3.game.readyState === 1 && window.__api.H), null, 15000, 50);
          await tp(S, C.x + 230, C.y + 40).catch(() => { }); F.backAt = +((Date.now() - t0) / 1000).toFixed(2);
          await jE; },
        extra: () => [Lp, J].filter(Boolean), secs: 10 });
      if (J) await J.ctx.close().catch(() => { }); if (Lp) await Lp.ctx.close().catch(() => { });
    }
  } finally {
    R.errors = { V: V.errs.slice(0, 10), S: S.errs.slice(0, 10) };
    for (const x of browsers) await x.close().catch(() => { }); try { process.kill(srv.pid); } catch (e) { }
  }
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exitCode = 1; });
