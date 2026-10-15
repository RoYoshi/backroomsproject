/* Stage 3H continuation (C3a) - one-line mutants of the sim's module seams (development only; never served).
 *
 *   node dev/tools/gate/golden/bpp_mutants.js --scenarios dev/stage-3h0/golden/srv_scenarios.js --mutants dev/tools/gate/golden/sim_mutants.js
 *
 * C3a made the sim's eleven parts into modules: where a part assigned another owner's variable it now calls that owner's function
 * (the run's controls, the blackout's, the walls' and the cartograph's placing, the bodies' clearing and clock), and where it read a
 * value that changes it now calls a getter.  Each mutant breaks one of those seams, or the composition's wiring, and at least one of
 * Stage 3H0's server scenarios must see it in its trace.  bpp_mutants.js finds the text in whichever server file holds it.  None is a
 * proposal: they exist to be caught. */
'use strict';
module.exports = [
  { id: 'run_freeze_ignored', scenarios: ['admin'], find: 'freeze:on=>{frozen=on}', repl: 'freeze:on=>{}', why: "the admin's freeze no longer reaches the run" },
  { id: 'run_speed_ignored', scenarios: ['admin'], find: 'setSpeed:v=>{speed=v}', repl: 'setSpeed:v=>{}', why: "the admin's speed no longer reaches the run" },
  { id: 'run_blackout_ignored', scenarios: ['admin'], find: 'setBlackout:m=>{bmode=m}', repl: 'setBlackout:m=>{}', why: "the admin's blackout mode no longer reaches the run" },
  { id: 'blackout_forced_wrong', scenarios: ['admin'], find: 'const forceBlackout = on => { V.blackout = on; };', repl: 'const forceBlackout = on => { V.blackout = !on; };', why: 'a forced blackout set the wrong way' },
  { id: 'reset_items_first', scenarios: ['lifecycle', 'admin'], find: 'placeGlitches();placeItems();', repl: 'placeItems();placeGlitches();', why: 'the world reset places the cartograph before the walls (the random stream in another order)' },
  { id: 'reset_bodies_kept', scenarios: ['deaths', 'admin'], find: '  clearBodies();\n}', repl: '\n}', why: 'the world reset keeps the bodies' },
  { id: 'clock_double', scenarios: ['lifecycle'], find: 'function tick(dt){clockT+=dt;', repl: 'function tick(dt){clockT+=2*dt;', why: "the sim's clock runs at twice the step" },
  { id: 'walls_stale', scenarios: ['exit_glitch', 'lifecycle'], find: 'return { glitches: () => glitches, placeGlitches };', repl: 'return { glitches: (g => () => g)(glitches), placeGlitches };', why: 'the walls read once, when the module was made (a stale copy instead of the current list)' },
  { id: 'items_stale', scenarios: ['lifecycle', 'admin'], find: 'return { items: () => items, placeItems, takeItem };', repl: 'return { items: (i => () => i)(items), placeItems, takeItem };', why: 'the cartograph read once, when the module was made' },
  { id: 'debug_never', scenarios: ['admin'], find: 'return { admin, debugOn: () => debugOn };', repl: 'return { admin, debugOn: () => false };', why: "the admin's debug switch never reaches the sim's getter" },
  { id: 'run_time_zero', scenarios: ['exit_glitch', 'admin'], find: 'runT: () => runT,', repl: 'runT: () => 0,', why: "the run's clock read as zero outside the run" },
  { id: 'world_count_one', scenarios: ['deaths', 'admin', 'lifecycle'], find: 'worldSeq: () => worldSeq }', repl: 'worldSeq: () => 1 }', why: 'the world count read as one outside the run' },
  { id: 'body_version_one', scenarios: ['deaths'], find: 'bodyVer: () => bodyVer }', repl: 'bodyVer: () => 1 }', why: "the bodies' version read as one outside G.I.B." },
  { id: 'roster_copied', scenarios: ['lifecycle', 'deaths', 'admin'], find: 'const ai=simAi({AI,WORLD,opts,players,level});', repl: 'const ai=simAi({AI,WORLD,opts,players:players.slice(),level});', why: 'the AI given a copy of the roster (it would never see a player join)' },
  { id: 'cap_run_time_61', scenarios: ['admin'], find: 'controls.capRunTime(60)', repl: 'controls.capRunTime(61)', why: "the admin's monster reset caps the run's clock at 61 s" },
];
