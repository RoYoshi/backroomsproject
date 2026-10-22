/* C7 re-check: what holds it still in the long stretches of exp_stare3.js?  Plan segments with reason, distance, speed, its stamina,
 * pounce cooldown and why it does not strike.  Usage: node exp_stare4.js <lib.js> <scene> <hunger> <seed> */
'use strict';
const [LIB, scene, H, SEED] = [process.argv[2], process.argv[3], +process.argv[4], +process.argv[5]];
const { World, LONG, bystander } = require(LIB);
const SCENES = { hall450: { p: [5000, LONG.y], k: [5450, LONG.y] }, hall300: { p: [5150, LONG.y], k: [5450, LONG.y] }, sw: { p: [700, 5330], k: [1300, 5330] } };
const S = SCENES[scene];
const w = World(SEED + 31000 + Math.round(H * 100)); bystander(w, scene === 'sw' ? 5000 : 1300, scene === 'sw' ? LONG.y : 3300);
const p = w.player(S.p[0], S.p[1], { light: true, angle: 0 }); p.stop('stand');
const e = w.eng.spawn('skinstealer', S.k[0], S.k[1], { hunger: H }); e.tier = 'near'; e.ang = Math.PI;
p.look = () => Math.atan2(e.y - p.y, e.x - p.x);
let last = '', lastT = -9;
w.run(120, (ww, t) => {
  const k = (e.plan ? e.plan.k : '-') + (e.hunt ? '*' : '') + '/' + e.act + '/' + e.state;
  const d = Math.round(Math.hypot(p.x - e.x, p.y - e.y));
  if (k !== last || t - lastT >= 10) { console.log(`${t.toFixed(1)} ${k} d=${d} sp=${Math.round(e.speed)} h=${e.hunger.toFixed(2)} stam=${Math.round(e.stam)} exh=${e.exh} seen=${e.seenNow.has(p.id)} why="${(e.dbg.why || '').slice(0, 70)}" lv="${(e.dbg.lv || '').slice(0, 40)}"`); last = k; lastT = t; }
  return !w.kills.length; });
console.log('kills', w.kills.length);
