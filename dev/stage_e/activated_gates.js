'use strict';
// Activate the frozen matrix's Stage E entries through the real component and
// species suites. Cache completed suites within this one invocation only.
const assert = require('node:assert/strict');
const matrix = require('../stage_a/future_matrix.json');
const completed = new Map();
const coverage = {
  Z10: ['core', 'motion', 'entities'], Z11: ['core', 'motion'],
  Z12: ['entities'], Z13: ['sensors'], Z14: ['sensors', 'entities'],
  Z15: ['sensors', 'entities'], Z16: ['entities'], Z17: ['motion', 'entities']
};
function cases(entry) {
  return matrix.filter(c => c.entry === entry).map(c => ({
    name: c.id + ' ' + c.scenario + (c.stages.includes('/') ? ' (Stage E portion)' : ''),
    fn() {
      const suites = coverage[c.id];
      assert(suites, 'Unimplemented gate: ' + c.id);
      for (const suite of suites) {
        if (!completed.has(suite)) {
          const result = require('./test_' + suite).run();
          assert.equal(result.status, 'PASS');
          assert(result.groups > 0);
          completed.set(suite, result);
        }
      }
      return {ok: true, note: suites.map(s => s + ': ' + completed.get(s).groups + ' real-system groups').join('; ') + '. Stage F/G/H portions remain deferred.'};
    }
  }));
}
function direct(cases) {
  let failed = 0;
  for (const c of cases) {
    try { const r = c.fn(); console.log('PASS ' + c.name + ': ' + r.note); }
    catch (e) { failed++; console.error('FAIL ' + c.name, e.stack); }
  }
  process.exitCode = failed ? 1 : 0;
}
module.exports = {cases, direct};
