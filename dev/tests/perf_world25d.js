'use strict';
// Serial real-code workloads and package-relative Z32. Timing misses are retained;
// assertion failures stay failures. Full I2/I4 evidence extends these bounded cases.
const path=require('path'),{suite,standalone}=require('../stage_i/runner'),s=suite('perf_world25d');
const workloads=[
 ['geometry',[process.execPath,'dev/stage_c/perf_spatial.js']],
 ['navigation-perception',[process.execPath,'dev/tests/run.js','s_nav25d.js','s_perception25d.js']],
 ['navigation-measurement',[process.execPath,'dev/stage_e/perf_spatial.js',path.join(s.out,'navigation.json')]],
 ['authority-eight-clients',[process.execPath,'dev/stage_f/test_room_perf.js',path.join(s.out,'eight-client.json')]],
 ['aftermath-1-3-24',[process.execPath,'dev/stage_g/performance.js']],
 ['production-browser',[process.execPath,'dev/stage_i/browser_probe.js',path.join(s.out,'browser')]],
 ['Z32-portability',['python','dev/stage_i/portability_gate.py',path.join(s.out,'portable')]]
];
const cases=workloads.map(([name,args])=>({name:'perf_world25d '+name,fn(){const r=s.run(name,args,900000);return{ok:r.ok,note:'exit '+r.exitCode+' '+r.seconds.toFixed(3)+'s; '+r.evidence};}}));
module.exports=cases;if(require.main===module)standalone(cases);
