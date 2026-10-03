'use strict';
// Stage E activation. The frozen future matrix remains a historical contract.
const {cases,standalone}=require('../stage_e/acceptance');
module.exports=cases(['Z10','Z11']);
if(require.main===module)standalone(module.exports);
