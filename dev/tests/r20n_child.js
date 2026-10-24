/* (Trial 3 R20, the N track; Trial 3 is not owner-approved) the open-air STUCK checks' runs (r20n_scenes.js) in a child process: the built
 * ai.js the harness requires is compiled with its follower's functions exposed (plan, follow, steerTo, navOf, stopMoving) and - mode r19 -
 * with exactly R20 N's hunks (r19n_patch.js R20) taken back out: R19 combined's shared engine, nothing else of the tree changes (R20 D: the
 * head swivel's helper, headAhead, stays and is exposed too: the Skin-Stealer's code calls it).  Prints the
 * scene's result as JSON.  Not a suite: run.js does not list it.
 *
 *   node dev/tests/r20n_child.js now|r19 SCENE|FILE:SCENE [ROOT] */
'use strict';
const path = require('path'), Module = require('module'), RN = require('./r19n_patch.js');
const mode = process.argv[2], scene = process.argv[3], root = path.resolve(process.argv[4] || path.join(__dirname, '..', '..')), AI = path.join(root, 'generated', 'server', 'ai.js');
const ret = 'return { create, S, SNAMES,', compile = Module.prototype._compile;
let took = 0;
Module.prototype._compile = function (content, filename) {
  if (path.resolve(filename) === AI) {
    let out = mode === 'r19' ? RN.without(content, RN.R20) : content; if (out === null) throw new Error('r20n_child: the R20 hunks are not in the built ai.js exactly once');
    if (out.split(ret).length !== 2) throw new Error('r20n_child: ai.js has its return not where expected');
    content = out.replace(ret, 'return { plan, follow, steerTo, navOf, stopMoving, headAhead, create, S, SNAMES,'); took++;
  }
  return compile.call(this, content, filename);
};
const [file, name] = scene.includes(':') ? scene.split(':') : ['r20n_scenes', scene];   // (R20 D) a scene of another file: FILE:SCENE (r20d_scenes)
const r = require('./' + file + '.js')[name](require('./lib.js'));
process.stdout.write(JSON.stringify(Object.assign({ took, mode, scene }, r)) + '\n');
