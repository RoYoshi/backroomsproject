/* Drop-in custom sounds. Put audio files in ./sounds (mp3 / ogg / wav / m4a / flac) named like:
     death_hound  death_smiler  death      (played when caught; "death" is the fallback for both)
     collect                                (evidence pickup)
     step                                   (footsteps, pitch-varied)
     hum                                    (looping light hum, louder near fixtures, ducks in blackouts)
     ambient                                (looping background bed)
     blackout   sting                       (lights failing / dread sting)
   Numbered variants (step1, step2, death_hound_2 ...) are picked at random. Anything not provided keeps
   the built-in synthesized sound. Volume follows the master volume in Settings. */
(() => {
  const EXT = /\.(mp3|ogg|wav|m4a|aac|flac|webm)$/i, files = {}, loops = {};
  const key = n => n.replace(EXT, '').toLowerCase().replace(/[\s-]+/g, '_').replace(/_?\d+$/, '');
  const Zc = () => { const z = window.__api && window.__api.audio && window.__api.audio(); return z && z.context && z.gain ? z : null; };
  const has = n => !!(files[n] && files[n].length);
  const pick = n => files[n][Math.random() * files[n].length | 0];
  const api = window.__sfx = {
    files, has, ready: false,
    play(n, o = {}) {
      const z = Zc(); if (!z || !has(n)) return false;
      const c = z.context, s = c.createBufferSource(), g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
      s.buffer = pick(n); s.playbackRate.value = o.rate || 1; g.gain.value = o.vol == null ? 1 : o.vol;
      s.connect(g); if (p) { p.pan.value = o.pan || 0; g.connect(p); p.connect(z.gain); } else g.connect(z.gain);
      s.onended = () => { try { s.disconnect(); g.disconnect(); p && p.disconnect(); } catch (e) {} };
      s.start(); return true;
    },
    death(kind) { return api.play('death_' + String(kind).toLowerCase(), { vol: 1 }) || api.play('death', { vol: 1 }); },
    loop(n, vol, pan = 0) {                                     // start on first use, then just steer gain/pan
      const z = Zc(); if (!z || !has(n)) return false;
      let l = loops[n];
      if (!l || l.ctx !== z.context) {
        const c = z.context, s = c.createBufferSource(), g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
        s.buffer = pick(n); s.loop = true; g.gain.value = 0; s.connect(g); if (p) { g.connect(p); p.connect(z.gain); } else g.connect(z.gain); s.start();
        l = loops[n] = { ctx: c, g, p };
      }
      const t = l.ctx.currentTime; l.g.gain.setTargetAtTime(vol, t, .12); if (l.p) l.p.pan.setTargetAtTime(pan, t, .2);
      return true;
    },
  };
  async function load() {
    let list = [];
    try { const r = await fetch('./sounds/', { cache: 'no-store' }); if (r.ok) list = await r.json(); } catch (e) {}
    if (!Array.isArray(list)) list = [];
    const z = Zc(); if (!z) return false;
    await Promise.all(list.filter(n => EXT.test(n)).map(async n => {
      try {
        const r = await fetch('./sounds/' + encodeURIComponent(n)); if (!r.ok) return;
        const b = await z.context.decodeAudioData(await r.arrayBuffer());
        (files[key(n)] = files[key(n)] || []).push(b);
      } catch (e) { console.warn('[sfx] could not decode', n); }
    }));
    api.ready = true;
    if (has('ambient')) { const t = setInterval(() => { if (!api.loop('ambient', .7)) clearInterval(t); }, 1500); }
    return true;
  }
  const iv = setInterval(async () => { if (Zc()) { clearInterval(iv); try { await load(); } catch (e) {} } }, 400);
})();
