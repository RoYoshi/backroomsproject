/** @part public/assets/skinstealer.js - BR-R: skinstealer.js's composition: it makes each owner's module in order, and closes the wrapper
 * Trial 3.  Each module is given what it uses of the modules made before it (the arguments below) and nothing else; what it publishes
 * it adds to the script's public object (window.__skin, made by the head) itself.
 * provides: -
 * uses: skinAudio, skinBody, skinHead, skinKill, skinMirror
 * writes: -
 */
/* (Trial 3) the modules, in the order of the parts */
const head = skinHead();
const mirror = skinMirror({ head });
const body = skinBody({ head, mirror });
skinKill({ head, body });
skinAudio({ head });
})();
