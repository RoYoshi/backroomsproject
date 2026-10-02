'use strict';
const G=require('../../world_geometry'),D=require('../../levels/level0');G.validate(D);console.log(JSON.stringify({assetId:D.assetId,revision:D.contentRevision,contentHash:G.contentHash(D)},null,2));
