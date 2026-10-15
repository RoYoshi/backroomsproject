/* Stage 3H continuation (C3b) - seam mutants of the page's module scripts (development only; used by the gate's page step through
 * dev/tools/gate/golden/page_scripts.js --mutants).
 *
 * Each mutant breaks one seam C3b made - a module not made, made from the wrong giver, handed the wrong thing, a late binding not made,
 * the script's return not the object its modules built - in the built script (public/<file>), in a scratch copy.  Each must change what
 * the script does: the page differential (page_scripts.js, for move, camcorder, glitch, ents) or world.js's own differential
 * (world_diff.js) must FAIL on the copy.  A mutant that changes nothing would prove nothing, so every one here changes behaviour. */
'use strict';
module.exports = [
  { id: 'move_sound_not_handed', file: 'move.js', find: 'useSound(mvSfx);', repl: 'void mvSfx;', why: 'the sound module does not hand its sounds to the movement module (vaults and slides fall silent)' },
  { id: 'move_poses_not_made', file: 'move.js', find: '\nmovePoses({ move });\n', repl: '\n', why: 'the composition does not make the poses module (window.__pose is missing)' },
  { id: 'camcorder_whine_lost', file: 'camcorder.js', find: 'const setWhine = w => { S.whine = w; };', repl: 'const setWhine = w => { };', why: "the camera's state does not keep the whine's nodes (the sound module builds them again and again)" },
  { id: 'camcorder_view_wrong_audio', file: 'camcorder.js', find: '  camcorderView({ core, audio });', repl: '  camcorderView({ core, audio: { snd: audio.snd, whine: () => {} } });', why: 'the view is given a silent whine instead of the sound module\'s' },
  { id: 'glitch_draw_wrong_walls', file: 'glitch.js', find: '  glitchDraw({ walls, audio });', repl: '  glitchDraw({ walls: Object.assign({}, walls, { NEAR: walls.NEAR * 2 }), audio });', why: 'the drawing module is given another near distance than the walls module\'s' },
  { id: 'glitch_draw_silent', file: 'glitch.js', find: '  glitchDraw({ walls, audio });', repl: '  glitchDraw({ walls, audio: { updateSnd() {} } });', why: 'the drawing module is given a silent sound module' },
  { id: 'ents_smiler_gives_hound', file: 'ents.js', find: '\nreturn { drawSmiler };\n', repl: '\nreturn { drawSmiler: E.drawHound };\n', why: "the Smiler module gives the Hound's drawing (the death scene draws the wrong creature)" },
  { id: 'ents_audio_other_E', file: 'ents.js', find: '\nentsAudio({ head });\n', repl: '\nentsAudio({ head: Object.assign({}, head, { E: {} }) });\n', why: "the sound module is given another public object (its voices never reach window.__ents)" },
  { id: 'ents_debug_not_made', file: 'ents.js', find: '\nentsDebug({ head });\n', repl: '\n', why: 'the composition does not make the debug module' },
  { id: 'world_order_swapped', file: 'world.js', find: '  worldLamps({ head });\n  worldCrawl({ head });\n', repl: '  worldCrawl({ head });\n  worldLamps({ head });\n', why: "two modules made out of order (the world's keys in another order)" },
  { id: 'world_returns_copy', file: 'world.js', find: '  return head.W;', repl: '  return Object.assign({}, head.W);', why: 'the script returns a copy of the object its modules built (setMode no longer shows in WORLD.mode)' },
  { id: 'world_surfaces_not_made', file: 'world.js', find: '  worldSurfaces({ head });\n', repl: '', why: 'the composition does not make the surfaces module (no surfaceAt)' },
];
