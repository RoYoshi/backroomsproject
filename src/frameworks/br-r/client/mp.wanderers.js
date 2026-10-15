/** @part public/mp.js - BR-R: the other Wanderers: their hover names and avatars' clean-up; a module: brrWanderers
 * A module (continuation C3c, M-024): M8's part in its factory. G.I.B.'s drawing of the other Wanderers wrote this module's hover tip
 * itself at M8; now it finds the one under the mouse (mx(), my()) and this module shows its name or hides it (hoverTip). The last view
 * (view), which only that drawing used, is G.I.B.'s. It reads the session's peers map.
 * imports: session { peers }
 * exports: dropAvatar, hoverTip, mx, my
 * provides: brrWanderers
 * uses: -
 * writes: -
 */
function brrWanderers({ session: { peers } }) {
/* ---------- other wanderers ---------- */
const tip = Object.assign(document.createElement('div'), { id: 'peerTip' });
document.body.appendChild(tip);
let mx = -1e3, my = -1e3;
addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mx = e.clientX; my = e.clientY; } });
function dropAvatar(o) { if (o.av) { o.av.parent && o.av.parent.removeChild(o.av); o.av.destroy({ children: true }); o.av = null; } }
setInterval(() => { for (const [id, o] of [...peers]) if (!peers.has(id)) dropAvatar(o); }, 2000);
/* (C3c) the hover name: the wanderer the drawing found under the mouse (in line of sight), or none */
function hoverTip(hover, sc) {
  if (hover) {
    tip.textContent = (hover.o.n || 'WANDERER') + (hover.o.d ? ' · DEAD' : '');
    tip.style.left = hover.sx + 'px'; tip.style.top = (hover.sy - 26 * sc) + 'px'; tip.style.display = 'block';
  } else tip.style.display = 'none';
}
return { dropAvatar, hoverTip, mx: () => mx, my: () => my };
}
