/* DEV ONLY: the real server, but hounds always "play" with a caught victim (never the quick kill) so the held / down / crawl / drag / release visuals can be watched in a browser.
 * usage: node play_server.js PORT [quick|play]     (never shipped) */
'use strict';
const GAME = require('../paths.js');
const AI = require(GAME + '/ai.js');
const mode = process.argv[3] === 'quick' ? 1 : 0;
AI.SPECIES.hound.capture.quick = () => mode;
AI.SPECIES.smiler.capture.quick = () => mode;
require(GAME + '/server.js');
