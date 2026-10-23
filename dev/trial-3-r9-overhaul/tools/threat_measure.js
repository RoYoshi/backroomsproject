#!/usr/bin/env node
/* dev/trial-3-r9-overhaul/tools/threat_measure.js - Trial 3 R18 (the owner's overtuned experiment, section 10: "measure actual threat
 * level"): what a Skin-Stealer actually did in a recorded real-page campaign (r16g_campaign.js --part continuous --raw FILE), measured the
 * same way for every tree, so R18 can be set beside R16i and R16h.  Development tool; it reads a saved record, nothing else.
 *
 *   node dev/trial-3-r9-overhaul/tools/threat_measure.js --raw A.json.gz [--label R18] [--run 270] [--raw B.json.gz --label R16i ...] [--out F.json]
 *
 * From the admin page's record (page A: every snapshot it received, 50 ms apart on the server, and the admin debug of the same tick):
 *   modes        time in each movement mode, by its speed as the snapshots carry it (its strike and its kill apart): still (< 10 px/s),
 *                stealth (10-110: creep, stalk), casual (110-185), prowl (185-222), investigation (222-248), aggressive (248-266), pursuit (266
 *                and over); and by its act (chase, pace, approach, creep, search, intercept, watch, wait, listen, leave)
 *   active       its mean speed while it pursued an objective (approach, chase, intercept, search, flank, listen-to-look: moving)
 *   idle         time standing still without a tactical purpose: its plan roam (a pause); apart, after a meal ("fed") and asleep far from
 *                every page (the engine's level of detail: 3,800 px; R18's hungry one prowls instead); and its time watching
 *   proactive    plans begun per minute: approach, chase, intercept, search, flank, ambush/lure; presses and chases begun
 *   reaction     from a new sighting of a page at hunting hunger, while it roamed, listened or left (not while it held a kill or sprang), to its
 *                answer - a change of plan, or a decision that weighed the sighting and kept the plan (its debug's interruption record)
 *   encounters   a page in its sight within 500 px, until 8 s unseen: how many ended in a death (captures) and how many did not (escapes)
 *   stamina      its mean stamina, time under 40, exhaustions and recoveries (only where the record carries them: R18's campaign tool)
 *   ignored      a page it saw within 600 px for over 4 s while hungry (0.4 and up), not exhausted, and its plan stayed roam, watch, leave or
 *                listen - an opportunity it did not take up (each listed)
 * Every name is synthetic; nothing is written but the output named. */
'use strict';
const fs = require('fs'), zlib = require('zlib');
const args = process.argv.slice(2), runs = []; let out = null, cur = null;
for (let i = 0; i < args.length; i += 2) {
  const k = args[i].replace(/^--/, ''), v = args[i + 1];
  if (k === 'raw') { cur = { raw: v, label: v.split('/').pop(), run: 270 }; runs.push(cur); } else if (k === 'label' && cur) cur.label = v; else if (k === 'run' && cur) cur.run = +v; else if (k === 'out') out = v;
}
if (!runs.length) { console.error('usage: threat_measure.js --raw FILE.json.gz [--label L] [--run 270] ... [--out F.json]'); process.exit(2); }
const MODES = [['still', 0, 10], ['stealth', 10, 110], ['casual', 110, 185], ['prowl', 185, 222], ['investigation', 222, 248], ['aggressive', 248, 266], ['pursuit', 266, 1e9]];
const ACT = { 1: 'watch', 2: 'back', 3: 'leave', 4: 'wait', 5: 'lure', 6: 'intercept', 7: 'search', 8: 'listen', 9: 'approach', 10: 'creep', 11: 'chase', 12: 'wind', 13: 'pounce', 14: 'recover', 15: 'feed', 16: 'mimic', 17: 'rest', 18: 'pace' };
const DT = .05, q = (a, p) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2); };
function measure(R) {
  const X = JSON.parse(zlib.gunzipSync(fs.readFileSync(R.raw))), rA = X.recs[0], ids = X.ids, pages = [ids.A, ids.B];
  const kids = [...new Set(rA.flatMap(s => s[2].map(k => k[0])))];
  const M = { label: R.label, minutes: +((rA.length ? rA[rA.length - 1][0] - rA[0][0] : 0) / 60).toFixed(1), creatures: kids.length, deaths: X.deaths,
    modes: Object.fromEntries(MODES.map(m => [m[0], 0])), strikeKill: 0, acts: {}, activeSpeed: null, idleRoam: 0, idleFed: 0, idleFar: 0, watching: 0, begun: {}, presses: 0,
    reaction: null, encounters: { n: 0, captures: 0, escapes: 0 }, stamina: null, ignored: [], overRun: 0 };
  let actSum = 0, actN = 0; const reacts = []; const st = []; let lowSt = 0, exhN = 0, recN = 0;
  for (const id of kids) {
    let lastPl = null, lastEx = null, lastWhy = '', lastPe = '', seenPrev = new Set(), enc = new Map(), ign = new Map();
    let pendingReact = [];
    let D = null;                                                                   // its debug as last received (the admin's, every third tick)
    for (const s of rA) {
      const k = s[2].find(q => q[0] === id); const d = s[3].find(q => q[0] === id); if (d) D = d; if (!k) continue;
      const v = k[6] || 0, ac = k[5], t = s[0];
      // movement modes (its strike and its kill apart)
      if (ac >= 12 && ac <= 15) M.strikeKill += DT; else { const m = MODES.find(m => v >= m[1] && v < m[2]); M.modes[m[0]] += DT; if (v > R.run + 1) M.overRun++; }
      const an = ACT[ac] || 'none'; M.acts[an] = (M.acts[an] || 0) + DT;
      if (!D) continue;
      const pl = D[1], hu = D[7], sn = D[6] || [], why = D[2] || '', sta = D[9], ex = D[10];
      if (/approach|chase|intercept|search|flank/.test(pl) && v >= 10 && !(ac >= 12 && ac <= 15)) { actSum += v; actN++; }
      if (v < 10 && pl === 'roam' && !(ac >= 12 && ac <= 15) && !/it has P|feeds/.test(why)) { if (/^fed/.test(why)) M.idleFed += DT; else if (/nobody within reach/.test(why)) M.idleFar += DT; else M.idleRoam += DT; }
      if (ac === 1) M.watching += DT;
      const peKey = D[3] ? D[3][3] + '|' + D[3][0] : '';
      if (pl !== lastPl || (peKey && peKey !== lastPe && D[3][0] < .3)) { if (pl !== lastPl && lastPl !== null) M.begun[pl] = (M.begun[pl] || 0) + 1; for (const p of pendingReact) reacts.push(+(t - p).toFixed(2)); pendingReact = []; lastPl = pl; }
      lastPe = peKey;
      if (why !== lastWhy) { if (/its press/.test(why)) M.presses++; lastWhy = why; }
      if (sta !== undefined && sta !== null) { st.push(sta); if (sta < 40) lowSt += DT; if (ex && !lastEx) exhN++; if (!ex && lastEx) recN++; lastEx = ex; }
      // positions of the pages (page A's own, the others from its peers)
      const pos = new Map([[s[1][6] || ids.A, [s[1][0], s[1][1], s[1][5]]]]); for (const p of (s[6] || [])) pos.set(p[0], [p[1], p[2], 0]);
      for (const pid of pages) {
        const P = pos.get(pid); if (!P) continue; const dd = Math.hypot(P[0] - k[1], P[1] - k[2]), sees = sn.includes(pid);
        if (sees && !seenPrev.has(pid) && hu >= .4 && /roam|leave|listen/.test(pl) && !(ac >= 12 && ac <= 15) && !/it has P/.test(why)) pendingReact.push(t);
        // encounters: in its sight within 500 px, until 8 s unseen; a death of that page meanwhile is a capture
        let E = enc.get(pid);
        if (sees && dd < 500) { if (!E) { E = { t0: t, last: t, dead: false }; enc.set(pid, E); M.encounters.n++; } E.last = t; }
        if (E && pid === ids.A && s[1][5]) E.dead = true;
        if (E && t - E.last > 8) { if (E.dead) M.encounters.captures++; else M.encounters.escapes++; enc.delete(pid); }
        // an opportunity not taken up
        let G = ign.get(pid);
        if (sees && dd < 600 && hu >= .4 && !ex && /^(roam|watch|leave|listen)$/.test(pl)) { if (!G) { G = { t0: t, pl, d: Math.round(dd) }; ign.set(pid, G); } if (t - G.t0 > 4 && !G.n) { G.n = 1; M.ignored.push({ t: +G.t0.toFixed(1), id, page: pid === ids.A ? 'A' : 'B', plan: G.pl, d: G.d, hunger: +hu.toFixed(2) }); } }
        else ign.delete(pid);
      }
      seenPrev = new Set(sn);
    }
    for (const E of enc.values()) { if (E.dead) M.encounters.captures++; else M.encounters.escapes++; }
  }
  // (deaths of page B are counted from the campaign's own tally: page A's record carries only A's own death flag)
  M.encounters.note = 'captures from page A\'s own death flag; page B\'s deaths are in the campaign\'s tally (deaths)';
  M.activeSpeed = actN ? Math.round(actSum / actN) : null;
  M.reaction = { n: reacts.length, median: q(reacts, .5), p90: q(reacts, .9) };
  M.stamina = st.length ? { mean: Math.round(st.reduce((a, b) => a + b, 0) / st.length), under40s: +lowSt.toFixed(1), exhaustions: exhN, recoveries: recN } : 'not in this record (R16i and earlier tools did not keep it)';
  for (const k of Object.keys(M.modes)) M.modes[k] = +M.modes[k].toFixed(1); M.strikeKill = +M.strikeKill.toFixed(1);
  for (const k of Object.keys(M.acts)) M.acts[k] = +M.acts[k].toFixed(1); M.idleRoam = +M.idleRoam.toFixed(1); M.idleFed = +M.idleFed.toFixed(1); M.idleFar = +M.idleFar.toFixed(1); M.watching = +M.watching.toFixed(1);
  const tot = Object.values(M.modes).reduce((a, b) => a + b, 0) + M.strikeKill; M.share = Object.fromEntries(Object.entries(M.modes).map(([k, v]) => [k, Math.round(100 * v / Math.max(1e-9, tot))]));
  const per = M.minutes || 1; M.perMinute = Object.fromEntries(Object.entries(M.begun).map(([k, v]) => [k, +(v / per).toFixed(2)])); M.perMinute.press = +(M.presses / per).toFixed(2);
  return M;
}
const res = runs.map(measure);
const row = (name, f) => `| ${name} | ${res.map(f).join(' | ')} |`;
const lines = [`| Measure | ${res.map(r => r.label).join(' | ')} |`, '|---' + '|---'.repeat(res.length) + '|',
  row('minutes recorded, creatures, deaths (A/B)', r => `${r.minutes}, ${r.creatures}, ${r.deaths ? r.deaths.A + '/' + r.deaths.B : '-'}`),
  ...MODES.map(m => row(`time ${m[0]} (${m[1]}-${m[2] > 1e8 ? '' : m[2]} px/s)`, r => `${r.modes[m[0]]} s (${r.share[m[0]]} %)`)),
  row('its strike and its kill', r => `${r.strikeKill} s`),
  row('mean speed while it pursued an objective', r => `${r.activeSpeed} px/s`),
  row('standing still roaming, no tactical purpose', r => `${r.idleRoam} s`),
  row('standing still after a meal; asleep far from everyone (3,800 px: the level of detail)', r => `${r.idleFed} s; ${r.idleFar} s`),
  row('watching (a standoff, its stare)', r => `${r.watching} s`),
  row('plans begun per minute', r => Object.entries(r.perMinute).filter(([k]) => k !== 'press').map(([k, v]) => `${k} ${v}`).join(', ')),
  row('presses begun per minute', r => `${r.perMinute.press}`),
  row('from a new sighting (hungry, roaming) to its answer', r => `median ${r.reaction.median} s, 90 % ${r.reaction.p90} s (${r.reaction.n})`),
  row('encounters (page A captures / escapes)', r => `${r.encounters.n} (${r.encounters.captures} / ${r.encounters.escapes})`),
  row('stamina', r => typeof r.stamina === 'string' ? r.stamina : `mean ${r.stamina.mean}, ${r.stamina.under40s} s under 40, ${r.stamina.exhaustions} exhaustions, ${r.stamina.recoveries} recoveries`),
  row('opportunities not taken up (hungry, seen within 600 px, > 4 s)', r => `${r.ignored.length}`),
  row('samples over its run (crossings not excepted here)', r => `${r.overRun}`)];
console.log(lines.join('\n'));
for (const r of res) if (r.ignored.length) console.log(`${r.label} ignored: ${JSON.stringify(r.ignored)}`);
if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
