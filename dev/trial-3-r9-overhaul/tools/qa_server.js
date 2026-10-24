#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/qa_server.js - TEST-ONLY: the real game server (DIR's server.js, unchanged) with a scene hook for the
 * browser evidence (Trial 3 R9-R17; not owner-approved).  Never part of the game: nothing under src/ or public/ requires it.
 *
 *   node dev/trial-3-r9-overhaul/tools/qa_server.js DIR PORT        (ADMIN_PASSCODE from the environment, as for server.js)
 *
 * Before DIR's server.js is loaded, the sim factory it requires (src/core/server/sim.js) is wrapped so that every room's sim is kept here;
 * nothing else is touched.  Commands arrive one JSON line at a time on stdin, answers leave one JSON line at a time on stdout:
 *   {op:'spawn', kind, x, y, hunger}   a creature put exactly there, with that spawn hunger (as a scenario test places one), in the newest room;
 *                                      (R16g) goal {x, y}: a Skin-Stealer's roam begun toward it, as dev/tests and repro_ap.js give one a route
 *   {op:'probe', id}                   where it is and what it is doing (reported only; the scene never steers it)
 *   {op:'kills'} / {op:'ents'}         (R20 RV) the players' kill records (the killer's entity id) and every creature's id, kind and place (reported only)
 *   {op:'disguise', id, look} / {op:'undress', id}   (R10 V09) the borrowed look it would wear after feeding at a kill, set or taken off for
 *                                      the scene (its body state, as a hunger is; the server sends it as it sends a real one)
 * The creature's AI is the tree's own: a scene only PLACES it, exactly as dev/tests do with eng.spawn. */
'use strict';
const path = require('path'), readline = require('readline');
const DIR = path.resolve(process.argv[2]), PORT = process.argv[3];
const simPath = require.resolve(path.join(DIR, 'src', 'core', 'server', 'sim.js'));
const make = require(simPath), sims = [];
require.cache[simPath].exports = function (o) { const s = make(o); sims.push(s); return s; };
process.argv[2] = PORT; process.argv.length = 3;
const log = console.log; console.log = (...a) => process.stderr.write(a.join(' ') + '\n');   // (the server's own lines go to stderr; stdout carries only answers)
require(path.join(DIR, 'server.js'));
const out = o => process.stdout.write(JSON.stringify(o) + '\n');
readline.createInterface({ input: process.stdin }).on('line', line => {
  let m; try { m = JSON.parse(line); } catch (e) { return out({ ok: false, err: 'bad json' }); }
  const sim = sims[sims.length - 1], eng = sim && sim.engine;
  if (!eng) return out({ ok: false, err: 'no room yet', op: m.op });
  const ent = id => eng.entities.find(o => o.id === +id);                      // (eng.byId holds the players)
  if (m.op === 'spawn') {
    const e = eng.spawn(m.kind === 'hound' ? 'hound' : m.kind === 'smiler' ? 'smiler' : 'skinstealer', +m.x, +m.y, Number.isFinite(+m.hunger) && m.hunger !== null ? { hunger: +m.hunger } : {});
    if (e && Number.isFinite(+m.ang)) e.ang = +m.ang;
    if (e && e.roam && m.goal && Number.isFinite(+m.goal.x) && Number.isFinite(+m.goal.y)) { e.roam.goal = { x: +m.goal.x, y: +m.goal.y }; e.roam.until = eng.now + 60; e.roam.pause = 0; }
    return out({ ok: !!e, op: 'spawn', id: e ? e.id : 0, x: e ? Math.round(e.x) : 0, y: e ? Math.round(e.y) : 0, hunger: e && e.hunger !== undefined ? +e.hunger.toFixed(3) : null });
  }
  if (m.op === 'disguise' || m.op === 'undress') {                             // (R10 V09: the borrowed look a kill would give it, set for the scene)
    const e = ent(m.id); if (!e) return out({ ok: false, op: m.op, err: 'no such entity' });
    e.disguise = m.op === 'disguise' ? { look: String(m.look || 'cap|plain|#336699|#e6bb76'), from: 0, t0: eng.now, until: eng.now + 600 } : null;
    return out({ ok: true, op: m.op, id: e.id });
  }
  if (m.op === 'kills') {                                                      // (R20 RV) every player's kill record as the server holds it: who killed them (eid), what kind, which variant
    return out({ ok: true, op: 'kills', kills: (sim.players ? [...(sim.players.values ? sim.players.values() : sim.players)] : eng.pl || []).filter(p => p && p.kill).map(p => ({ pid: p.id, e: p.kill.e, k: p.kill.k, v: p.kill.v, ax: p.kill.ax, ay: p.kill.ay })) });
  }
  if (m.op === 'ents') {                                                       // (R20 RV) every creature: id, kind, place (reported only)
    return out({ ok: true, op: 'ents', ents: eng.entities.map(e => ({ id: e.id, kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), cap: e.cap ? e.cap.pid : 0 })) });
  }
  if (m.op === 'probe') {
    const e = ent(m.id);
    return out({ ok: !!e, op: 'probe', id: +m.id, x: e ? Math.round(e.x) : 0, y: e ? Math.round(e.y) : 0, plan: e && e.plan ? e.plan.k : '', hunger: e && e.hunger !== undefined ? +e.hunger.toFixed(3) : null });
  }
  out({ ok: false, err: 'unknown op', op: m.op });
});
void log;
