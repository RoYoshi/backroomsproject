/* (Trial 3 R19, the N track; Trial 3 is not owner-approved) NC04's run of r19n_chase.js with the N track's shared-engine hunks taken back
 * out (r19n_patch.js): a child process, so the built ai.js the harness requires is compiled with exactly those hunks removed - nothing else
 * of the tree changes.  Prints the result as JSON.  Not a suite: run.js does not list it.
 * (R20, the N track: only R19's cornering hunk - NC04's subject - is taken out; R20's open-air STUCK hunks stay on both sides, so the
 * comparison is the cornering's alone.  R20's own are compared with R19 by s_r20stuck.js.)
 *
 *   node dev/tests/r19n_child.js ROOT */
'use strict';
const path = require('path'), Module = require('module'), RN = require('./r19n_patch.js');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..')), AI = path.join(root, 'generated', 'server', 'ai.js');
const compile = Module.prototype._compile;
let took = 0;
Module.prototype._compile = function (content, filename) {
  if (path.resolve(filename) === AI) { const out = RN.without(content, RN.R19); if (out === null) throw new Error('r19n_child: the R19 N hunk is not in the built ai.js exactly once'); took++; content = out; }
  return compile.call(this, content, filename);
};
const r = require('./r19n_chase.js').run(require('./lib.js'));
process.stdout.write(JSON.stringify(Object.assign({ took }, r)) + '\n');
