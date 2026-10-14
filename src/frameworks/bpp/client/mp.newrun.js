/** @part public/mp.js - B++: NEW RUN's state on this page, and the server's answers (nrAnswer)
 * provides: nrAnswer, nrBusy, nrBusyAt, nrLast, nrQ, nrSent, nrWaitT, worldW
 * uses: nrButton, runMenuWords
 * writes: -
 */
/* Stage 3D HQ2: NEW RUN's state on this page: the world epoch the server last named (s.w), the press numbers sent and their callbacks,
 * whether a press is waiting or approved (busy), the last answer (for tests: window.__nrDebug) */
let worldW = null, nrQ = 0, nrBusy = 0, nrBusyAt = 0, nrLast = null, nrWaitT = 0;   // nrBusy: 1 a press waits for its answer, 2 approved (until the next run)
const nrSent = new Map();
/* Stage 3H2 (C-3): nrButton (what the pause dialog's NEW RUN button says) and runMenuWords (the run menu's words after a blast) are
 * assets/net-newrun.js's, with nrButton's own timer; mp.js reads them at start-up (above). */
function nrAnswer(m) {
  const ok = nrSent.get(m.q); nrSent.delete(m.q);
  nrLast = { q: m.q, ok: m.ok ? 1 : 0, why: m.why || '', wait: m.wait, de: m.de, at: Date.now() / 1000 };
  if (m.ok) { nrBusy = 2; nrButton(''); runMenuWords(true); if (ok) ok(m); }      // the server has taken us out of the world: the bundle's beat, then its run menu
  else { nrBusy = 0; nrButton(m.why === 'cooldown' ? 'WAIT ' + Math.ceil(+m.wait || 0) + ' S' : 'NOT NOW'); }
}
window.__nrDebug = () => ({ q: nrQ, busy: nrBusy, w: worldW, last: nrLast });
