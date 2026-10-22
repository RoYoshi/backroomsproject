#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/qa_server.js - TEST-ONLY: the real game server (DIR's server.js, unchanged) with a scene hook for the
 * browser evidence (Trial 3 R9-R17; not owner-approved).  Never part of the game: nothing under src/ or public/ requires it.
 *
 *   node dev/trial-3-r9-overhaul/tools/qa_server.js DIR PORT        (ADMIN_PASSCODE from the environment, as for server.js)
 *
 * Before DIR's server.js is loaded, the sim factory it requires (src/core/server/sim.js) is wrapped so that every room's sim is kept here;
 * nothing else is touched.  Commands arrive one JSON line at a time on stdin, answers leave one JSON line at a time on stdout:
 *   {op:'spawn', kind, x, y, hunger}   a creature put exactly there, with that spawn hunger (as a scenario test places one), in the newest room
 *   {op:'probe', id}                   where it is and what it is doing (reported only; the scene never steers it)
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
  if (m.op === 'spawn') {
    const e = eng.spawn(m.kind === 'hound' ? 'hound' : m.kind === 'smiler' ? 'smiler' : 'skinstealer', +m.x, +m.y, Number.isFinite(+m.hunger) && m.hunger !== null ? { hunger: +m.hunger } : {});
    if (e && Number.isFinite(+m.ang)) e.ang = +m.ang;
    return out({ ok: !!e, op: 'spawn', id: e ? e.id : 0, x: e ? Math.round(e.x) : 0, y: e ? Math.round(e.y) : 0, hunger: e && e.hunger !== undefined ? +e.hunger.toFixed(3) : null });
  }
  if (m.op === 'probe') {
    const e = eng.byId.get(+m.id);
    return out({ ok: !!e, op: 'probe', id: +m.id, x: e ? Math.round(e.x) : 0, y: e ? Math.round(e.y) : 0, plan: e && e.plan ? e.plan.k : '', hunger: e && e.hunger !== undefined ? +e.hunger.toFixed(3) : null });
  }
  out({ ok: false, err: 'unknown op', op: m.op });
});
void log;
