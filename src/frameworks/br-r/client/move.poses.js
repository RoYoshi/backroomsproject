/** @part public/move.js - BR-R: the avatar poses (window.__pose), for the local player and everybody else
 * provides: -
 * uses: clamp
 * writes: -
 */
/* ---------------------------------------------------------------- avatar poses (local player and everybody else) */
window.__pose = {
  apply(av, S_, e, preview) {
    const m = S_ && S_.mv; if (!m || preview) return;
    const s = m.s, t = m.t || 0, k = clamp(t / .35, 0, 1), sw = Math.sin(e * 6);
    const b = av.body, hs = av.hands;
    if (s === 'crouch') { b.scale.set(1 - .07 * k, 1 - .15 * k); av.hat.y += 3 * k; av.pack.y += 2 * k; hs.forEach(h => { h.x *= .9; }); }
    else if (s === 'crawl') { const mvng = (m.sp || 0) > 8; b.scale.set(1.04, 1 - .3 * k); av.hat.y += 5 * k; av.pack.y += 4 * k; hs.forEach((h, i) => { h.y = -17 + (mvng ? Math.sin(e * 7 + i * Math.PI) * 7 : 0); h.x *= .85; }); }
    else if (s === 'slide') { b.scale.set(.92, 1.22); b.rotation = .18 * Math.sign(m.lean || 1); av.hat.y += 4; hs.forEach((h, i) => { h.y += 9; h.x *= .8; }); }
    else if (s === 'vault') { const u = clamp(m.vp || .5, 0, 1), arc = Math.sin(u * Math.PI); b.scale.set(1 + .06 * arc, 1 + .1 * arc); hs.forEach(h => { h.y = -16 - 3 * arc; h.x *= .9; }); av.hat.y -= 1.5 * arc; }
    else if (s === 'down') { b.scale.set(1.16, .8); hs.forEach((h, i) => { h.x = (i ? 1 : -1) * 22; h.y = 6 + Math.sin(e * 9 + i) * 2; }); av.hat.y += 5; }
    if (m.ex && s !== 'down' && s !== 'crawl') { const br = Math.sin(e * 8.5); b.scale.x *= 1 + .028 * br; b.scale.y *= 1 - .02 * br; av.hat.y += 1.2 + .8 * br; hs.forEach(h => { h.y += 1.2; }); }
    if (m.st !== undefined && m.st < 22 && !m.ex && s !== 'down') { const br = Math.sin(e * 6.5); b.scale.x *= 1 + .014 * br; }
    if (m.tw) { b.x = Math.sin(e * 52) * 1.6; } else b.x = 0;                              // struggling
  },
};

