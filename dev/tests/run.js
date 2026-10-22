'use strict';
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['s_percept.js', 's_hound.js', 's_smiler.js', 's_capture.js', 's_system.js', 's_admin.js', 's_commit.js', 's_nav.js', 's_chase.js', 's_audit.js', 's_evidence.js', 's_ir.js', 's_hound2e.js', 's_shared2f.js', 's_skinstealer.js', 's_skinbehave.js', 's_skinpredator.js', 's_skinsight.js', 's_skinmind.js', 's_skinroute.js', 's_skinr9.js', 's_skinbody.js', 's_skinrend.js'];   // (Trial 3: the Skin-Stealer; its behaviour refinement; its predator refinement; R10: its dread only in sight; R11: its mind; R12: its inference; R13: its cover - and R9-01, the owner's exposed ambush; R14: its body drawn top-down; R15: the Rend)
const only = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
let total = 0, pass = 0; const fails = [];
for (const f of files) {
  const S = require('./' + f);
  for (const s of S) {
    if (only && !only.test(s.name)) continue;
    const t0 = Date.now(); let r;
    try { r = s.fn(); } catch (e) { r = { ok: false, note: 'EXCEPTION ' + e.stack.split('\n').slice(0, 4).join(' | ') }; }
    total++; if (r.ok) pass++; else fails.push(s.name);
    console.log((r.ok ? 'PASS ' : 'FAIL ') + s.name + '  [' + (Date.now() - t0) + 'ms]\n       ' + (r.note || ''));
    if (!r.ok && r.data && process.env.DATA) console.log('       ', JSON.stringify(r.data).slice(0, 600));
  }
}
console.log(`\n${pass}/${total} passed` + (fails.length ? '\nFAILED: ' + fails.join('; ') : ''));
process.exitCode = fails.length ? 1 : 0;
