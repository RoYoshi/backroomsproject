/** @part public/mp.js - Spacious Audio: the dread's sound (the drone and the heartbeat); a module: audioDread
 * A module (continuation C3c, M-024): M8's part in its factory. The per-frame hook (core's mp.frame.js) set the drone's gain itself at
 * M8; now it asks (setDrone), and it shows or hides the pause screen's online note this module made through onlineNote. The heartbeat's
 * timer (beatT), which only the hook used, is the hook's.
 * imports: -
 * exports: burst, onlineNote, setDrone, thump
 * provides: audioDread
 * uses: -
 * writes: -
 */
function audioDread() {
/* ---------- audio ---------- */
let ac, drone, dg;
const soundOn = () => /ON/.test(document.getElementById('sound')?.textContent || 'ON');
function initAudio() {
  if (ac) return;
  try {
    ac = new AudioContext();
    drone = ac.createOscillator(); drone.type = 'sawtooth'; drone.frequency.value = 43;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140;
    dg = ac.createGain(); dg.gain.value = 0;
    drone.connect(f).connect(dg).connect(ac.destination); drone.start();
  } catch {}
}
addEventListener('pointerdown', initAudio); addEventListener('keydown', initAudio);
function thump(v, f) {
  if (!ac || !soundOn()) return;
  const o = ac.createOscillator(), g = ac.createGain(), n = ac.currentTime;
  o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(38, n + .16);
  g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.001, n + .2);
  o.connect(g).connect(ac.destination); o.start(n); o.stop(n + .22);
}
function burst(len, v) {
  if (!ac || !soundOn()) return;
  const b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 1.5;
  const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = v; s.buffer = b; s.connect(g).connect(ac.destination); s.start();
}
let capturedWas = false;                                      // (pre-Trial 3 polish P1: the burst once per capture, when `captured` arrives -
new MutationObserver(() => {                                  // not again on every later change of the body's classes while caught)
  const c = document.body.classList.contains('captured');
  if (c && !capturedWas) burst(1.1, .9);
  capturedWas = c;
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

/* online note on the pause screen */
const pauseNote = document.querySelector('#dialog .lore-credit');
if (pauseNote) {
  const n = document.createElement('p'); n.className = 'lore-credit'; n.id = 'onlineNote'; n.hidden = true;
  n.textContent = 'Online: pausing does not stop the halls. The monsters keep moving.';
  pauseNote.before(n);
}
/* (C3c) the drone's level from the dread (k, 0..1: the per-frame hook's), and the online note, shown while online */
function setDrone(k) { if (dg && ac) dg.gain.value = soundOn() ? k * k * .16 : 0; }
const onlineNote = on => { const note = document.getElementById('onlineNote'); if (note) note.hidden = !on; };
return { burst, onlineNote, setDrone, thump };
}
