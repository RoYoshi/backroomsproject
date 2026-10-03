'use strict';
// Stage E portions only; Z14 presentation and Z17 death work remain later stages.
const {cases,standalone}=require('../stage_e/acceptance');
module.exports=cases(['Z12','Z13','Z14','Z15','Z16','Z17']);
if(require.main===module)standalone(module.exports);
