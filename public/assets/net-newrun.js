/* net-newrun.js - the NEW RUN button's words and the run menu's, for the multiplayer layer (mp.js).
 *
 * Stage 3H2 (C-3): moved out of mp.js without a change (B++ mp.js lines 85-90 and 98-103, as they were), so what a player reads of NEW RUN
 * lives in one small file:
 *   nrButton(text)      the pause dialog's NEW RUN button (#reset): its own label, or the label and a word - '…' while a press waits (the
 *                       button disabled then), 'WAIT N S' or 'NOT NOW' after a refusal, back to the label alone 2.5 s later
 *   runMenuWords(boom)  the run menu's eyebrow and intro (#runMenu): the blast's words after an approved NEW RUN, its own words otherwise
 * nrTold, the timer that brings the button's label back, came with nrButton, its only user (mp.js declared it with NEW RUN's state).
 * NEW RUN's state and its decisions stay in mp.js (__net.nr, nrAnswer): the world epoch and the solidity rule read them too.
 * The functions read the page when they are called, exactly as they did inside mp.js, and keep no other state.
 * Loaded by index.html right after glitch.js, before net-wire.js and net-interp.js, as a classic script; its only global is
 * window.__mpLib.newrun, which mp.js reads once at start-up.  Never loaded by the server. */
(() => {
let nrTold = 0;
function nrButton(text) {                             // the pause dialog's NEW RUN button says what is happening, then goes back to itself
  const b = document.getElementById('reset'); if (!b) return;
  if (b.dataset.label === undefined) b.dataset.label = b.textContent;
  clearTimeout(nrTold); b.textContent = text ? b.dataset.label + ' · ' + text : b.dataset.label; b.disabled = text === '…';
  if (text && text !== '…') nrTold = setTimeout(() => nrButton(''), 2500);
}
/* Stage 3D HQ2: the run menu after an approved NEW RUN says what happened (the offline fade keeps the menu's own words) */
function runMenuWords(boom) {
  const r = document.getElementById('runMenu'), e = r && r.querySelector('.eyebrow'), i = r && r.querySelector('.intro'); if (!e || !i) return;
  if (e.dataset.fade === undefined) { e.dataset.fade = e.textContent; i.dataset.fade = i.textContent; }
  e.textContent = boom ? 'YOU BLEW YOURSELF UP' : e.dataset.fade; i.textContent = boom ? 'What is left of you stays where you stood.' : i.dataset.fade;
}
(window.__mpLib = window.__mpLib || {}).newrun = Object.freeze({ nrButton, runMenuWords });
})();
