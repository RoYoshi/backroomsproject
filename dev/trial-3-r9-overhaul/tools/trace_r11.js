#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/trace_r11.js - R11's state traces with reasons (development evidence; Trial 3 is not owner-approved).
 * Runs four of s_skinmind.js's scenes on this tree's real simulation and writes, for each, a line whenever the creature's plan, its
 * stated reason, its reaction or its events change: the time, its plan and act, why, its head turn, for each person it sees whether they
 * could see it, each event with how and how fast it was answered, and its hunt's evidence log.  Everything printed is the creature's own
 * state (its mind and debug), never a player's real place.
 *
 *   node dev/trial-3-r9-overhaul/tools/trace_r11.js [--out FILE.txt]
 */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const T = path.join(__dirname, '..', '..', 'tests');
const { hall, planOf } = require(path.join(T, 's_skinmind.js')).helpers;
const { World, bystander, AI } = require(path.join(T, 'lib.js'));
const out = [];
function trace(title, w, e, secs, step) {
  out.push('', `== ${title}`);
  let last = '', logN = 0;
  w.run(secs, (ww, t) => {
    if (step) step(t);
    const mi = AI.SKIN.debug(w.eng, e).mi || { obs: [] }, M = e.mind, H = e.hunt, log = H && H.log ? H.log : [];
    const key = [planOf(e), e.dbg.why, e.rx ? e.rx.k + e.rx.pid : '', mi.obs.map(o => o.pid + ':' + o.view).join(','), M.ev.map(v => v.resp).join(',')].join('|');
    if (key !== last || log.length !== logN) {
      const obs = mi.obs.map(o => `P${o.pid}${o.view ? ' could see it' : ' could not see it'}`).join(', ') || 'nobody in sight';
      out.push(`${t.toFixed(2).padStart(6)}s  ${planOf(e).padEnd(9)} act ${String(e.act || '-').padEnd(8)} head ${(e.head || 0).toFixed(2).padStart(5)}  [${obs}]  why: ${e.dbg.why || '-'}${e.rx ? '  REACT ' + e.rx.k + ' P' + e.rx.pid : ''}`);
      for (const v of M.ev) if (!v.shown && v.resp >= 0) { v.shown = 1; out.push(`          event ${v.k}${v.pid ? ' P' + v.pid : ''} at ${v.t} s answered (${v.how}) in ${v.resp} s`); }
      for (const l of log.slice(logN > log.length ? 0 : logN)) out.push(`          evidence ${l[1]} ${l[2]},${l[3]} ±${l[4]} at ${l[0]} s${l[5] ? ': ' + l[5] : ''}`);
      last = key; logN = log.length;
    }
    return true;
  });
  for (const v of e.mind.ev) if (!v.shown) out.push(`          event ${v.k}${v.pid ? ' P' + v.pid : ''} at ${v.t} s ${v.resp >= 0 ? `answered (${v.how}) in ${v.resp} s` : 'not yet answered at the end'}`);
  out.push(`   record: ${Object.entries(e.tally).filter(([, n]) => n).map(([k, n]) => k + ' ' + n).join(', ')}`);
}
{ const { w, e } = hall(8101, { hunger: .75, watch: true }); trace('hungry (.75), watched in the lit hall (C01 / C14)', w, e, 8); }
{ const { w, e } = hall(8102, { hunger: .1, watch: true }); e.ang = Math.PI - 1; trace('satiated (.1), watched from 450 px, turned 57 deg away (C02)', w, e, 6); }
{ // one glimpse (s_skinmind.js glimpse()): a lit person walks north past the gap, torch off past y 5440, then east, then crouches
  const w = World(8103 + 3000); bystander(w, 8400, 900);
  const p = w.player(1300, 5600, { light: true, angle: -Math.PI / 2 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 2100, 5560, { hunger: .75 }); e.tier = 'near'; e.ang = Math.PI;
  trace('one glimpse, then gone east, hungry (.75) (C04)', w, e, 16, t => {
    if (t > .5 && !p.going) { p.going = 1; p.route([{ x: 1300, y: 5420 }, { x: 1300, y: 5150 }], 'walk'); }
    if (p.going === 1 && p.path && !p.path.length) { p.going = 2; p.route([{ x: 1720, y: 4900 }], 'walk'); }
    if (p.going === 2 && p.path && !p.path.length) { p.going = 3; p.stop('crouch'); }
    if (p.light && p.y < 5440) p.light = false;
  });
}
{ // starving, watched in the north corridor with no way round (C03)
  const w = World(8104 + 7300); bystander(w, 1200, 4500);
  const p = w.player(1170, 4400, { light: true, angle: Math.PI / 2 }); p.stop('stand');
  const e = w.eng.spawn('skinstealer', 1170, 4780, { hunger: .95 }); e.tier = 'near'; e.ang = -Math.PI / 2; p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
  trace('starving (.95), watched in the north corridor (C03)', w, e, 6);
}
const text = out.join('\n').replace(/^\n/, '') + '\n';
if (ARG.out) fs.writeFileSync(ARG.out, text); else process.stdout.write(text);
