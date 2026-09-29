/* where the game files are: dev/ sits next to them (working tree: ../g) or inside the game folder (shipped: ..) */
'use strict';
const fs = require('fs'), path = require('path');
module.exports = [path.join(__dirname, '..', 'g'), path.join(__dirname, '..')].find(d => fs.existsSync(path.join(d, 'server.js')));
