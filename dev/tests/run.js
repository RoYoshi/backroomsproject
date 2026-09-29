'use strict';
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['s_percept.js'];
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
