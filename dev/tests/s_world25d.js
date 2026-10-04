'use strict';
// Final named world gate executes accepted production kernels, never a model.
const {suite,standalone}=require('../stage_i/runner'),s=suite('s_world25d');
const scripts={Z01:['stage_b/test_geometry.js','stage_c/test_spatial.js','stage_e/test_core.js'],Z02:['stage_c/test_spatial.js','stage_e/test_sensors.js'],Z03:['stage_c/test_spatial.js'],Z04:['stage_c/test_spatial.js'],Z05:['stage_c/test_spatial.js'],Z06:['stage_c/test_spatial.js','stage_c/test_adversarial.js'],Z07:['stage_c/test_spatial.js'],Z08:['stage_c/test_spatial.js'],Z09:['stage_c/test_spatial.js','stage_c/test_adversarial.js','stage_i/test_properties.js'],Z18:['stage_c/test_schedules.js','stage_i/test_z18.js','tests/s_fps_equality.js'],Z19:['stage_c/test_spatial.js','stage_c/test_schedules.js']};
const cases=require('../stage_a/future_matrix.json').filter(x=>x.entry==='s_world25d').map(x=>({name:x.id+' '+x.scenario,fn(){const rows=scripts[x.id].map(f=>s.run(f.replaceAll('/','_'),[process.execPath,'dev/'+f]));return{ok:rows.every(r=>r.ok),note:rows.map(r=>r.name+' exit '+r.exitCode+' '+r.seconds.toFixed(3)+'s').join('; ')+'; '+s.out};}}));
module.exports=cases;if(require.main===module)standalone(cases);
