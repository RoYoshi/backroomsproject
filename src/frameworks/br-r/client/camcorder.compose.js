/** @part public/camcorder.js - BR-R: camcorder.js's composition: it makes each owner's module in the order the parts ran, and closes the wrapper
 * Continuation C3b (M-024). Each module is given what it uses of the modules made before it (the arguments below) and nothing else; what
 * it registers on window or on the script's public object it registers itself, at the same moment as before.
 * dev/stage-3h-modernization/tools/c3_client_modules.js wrote this composition and proved, from the code, that nothing else changed.
 * provides: -
 * uses: camcorderCore, camcorderAudio, camcorderView
 * writes: -
 */
  /* (C3b) the modules, in the order the parts ran */
  const core = camcorderCore();
  const audio = camcorderAudio({ core });
  camcorderView({ core, audio });
})();
