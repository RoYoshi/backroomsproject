#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/trace_r12.js - R12's inference traces (development evidence; Trial 3 is not owner-approved).
 * Three of s_skinroute.js's scenes on this tree's real simulation: a person seen walking north past the gap who then (a) runs east (it
 * hears them), (b) doubles back crouching (unheard: its first guess is wrong), (c) crouches north-west and stays silent.  For each: every
 * listing of its ways (anchor, kind, first turn, probability), every sound it took for theirs and how it re-weighed the ways, every way
 * ruled out and why, every guess with the way it lies on and the rivals it rejected, and its plans.  Everything printed is the creature's
 * own state; the person's place is printed beside it only as the test's knowledge (marked "person"), never read by the creature.
 *
 *   node dev/trial-3-r9-overhaul/tools/trace_r12.js [--out FILE.txt]
 */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const { sw } = require(path.join(__dirname, '..', '..', 'tests', 's_skinroute.js')).helpers;
const out = [];
function trace(title, seed, way, mode, T) {
  out.push('', `== ${title}`);
  let lastY = null, lastHeard = null, lastG = null, lastP = null; const why = new Map();
  sw(seed, .8, way, mode, T, { on: (t, p, e) => {
    const H = e.hunt, Y = H && H.hyp, at = `${t.toFixed(2).padStart(6)}s`, who = `(person ${Math.round(p.x)},${Math.round(p.y)})`;
    if (Y && Y !== lastY) { lastY = Y; lastHeard = Y.heard; out.push(`${at}  WAYS listed from its ${Y.ev} evidence at ${Math.round(Y.x)},${Math.round(Y.y)} heading ${Math.round(Math.atan2(Y.vy, Y.vx) * 180 / Math.PI)} deg ${who}`);
      for (const h of Y.list) out.push(`          way ${h.id} ${h.k.padEnd(4)} first turn ${h.a === null ? '-' : h.a} (${Math.round(h.turn * 180 / Math.PI)} deg off the heading)  p ${h.p.toFixed(2)}  ends ${Math.round(h.pts[h.pts.length - 1].x)},${Math.round(h.pts[h.pts.length - 1].y)}`); }
    if (Y && Y.heard && Y.heard !== lastHeard) { lastHeard = Y.heard; const q = e.mem.sounds[0];
      out.push(`${at}  HEARD a sound at ${q ? Math.round(q.x) + ',' + Math.round(q.y) + ' ±' + Math.round(q.u) : '?'}: it fits ${Y.heard.fit} of ${Y.heard.of} ways; now ${Y.list.map(h => h.id + ' ' + h.p.toFixed(2)).join(', ')} ${who}`); }
    if (Y) for (const h of Y.list) if (h.why && why.get(h.id) !== h.why) { why.set(h.id, h.why); out.push(`${at}  RULED OUT way ${h.id} (${h.k}): ${h.why}`); }
    if (e.dbg.guess && e.dbg.guess !== lastG) { lastG = e.dbg.guess; const g = e.dbg.guess;
      out.push(`${at}  GUESS ${g.k}${g.hyp ? ' on way ' + g.hyp : ''} (of ${g.of || '-'})${g.rej && g.rej.length ? '; rejected: ' + g.rej.map(x => x[0] + (x[1] ? '#' + x[1] : '') + ' ' + x[2]).join(', ') : ''}`); }
    if (e.plan !== lastP) { lastP = e.plan; out.push(`${at}  plan ${e.plan ? e.plan.k : '-'}${e.plan && e.plan.k === 'intercept' && e.plan.g.hyp ? ' on way ' + e.plan.g.hyp : ''}: ${e.dbg.why || '-'} ${who}`); }
  } });
}
trace('runs east after the glimpse (it hears them): the sound re-weighs its ways', 61, 'east', 'run', 14);
trace('runs north-west after the glimpse (it hears them): the sound re-weighs its ways', 61, 'north', 'run', 14);
trace('doubles back crouching (unheard): its bet is wrong, the way is ruled out, the next guess goes elsewhere, it gives up', 4, 'back', 'crouch', 40);
trace('crouches north-west and stays silent: nothing it senses changes its ways', 41, 'north', 'crouch', 24);
const text = out.join('\n').replace(/^\n/, '') + '\n';
if (ARG.out) fs.writeFileSync(ARG.out, text); else process.stdout.write(text);
