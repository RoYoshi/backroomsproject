'use strict';
/* Part 2 FPS equality regression.
 * Same inputs + same elapsed real time must produce the same fixed 60 Hz
 * gameplay trace independent of render FPS. This test deliberately drives the
 * real move.js headlessly through the same accumulator policy used by the client.
 */
const assert = require('assert');
const path = require('path');
const GAME = require('../paths');
const timing = require(path.join(GAME, 'timing_policy.js'));
const { World, WORLD } = require('../harness');
const { makeMover } = require('../move_model');
const fs = require('fs');

// Verify the shipped browser loop is actually wired to the policy under test.
{
  const html = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8');
  const bundle = fs.readFileSync(path.join(GAME, 'assets/index-DKbV5Nv9.js'), 'utf8');
  assert(html.indexOf('./timing_policy.js') >= 0 && html.indexOf('./timing_policy.js') < html.indexOf('./assets/index-DKbV5Nv9.js'), 'timing policy must load before the game module');
  assert(bundle.includes('__tm.frameDelta(e,su)'), 'shipped render loop must use timing_policy frameDelta');
  assert(bundle.includes('__tm.FIXED_DT') && bundle.includes('__tm.MAX_CATCHUP_STEPS'), 'shipped gameplay loop must use fixed-step policy constants');
  assert(!bundle.includes('let t=Math.min((e-su)/1e3,.05);su=e;'), 'old 50 ms render-delta clamp must not remain');
  console.log('PASS shipped integration: browser loop is wired to timing_policy.js');
}

function runSchedule(frameDts, label) {
  const w = World(12345);
  let simTime = 0;
  const m = makeMover(w.sim, WORLD, () => simTime);
  const H = m.H;
  H.x = 4000; H.y = 3504; H.vx = H.vy = 0; H.stamina = 100; H.exhausted = false;
  let acc = 0, ticks = 0;
  for (const fdt of frameDts) {
    const r = timing.consume(acc, fdt, dt => {
      simTime += dt;
      // Ten-second input script: sprint right, walk diagonally, stop/recover.
      if (simTime <= 4) m.step(1, 0, true, false, dt, false);
      else if (simTime <= 7) m.step(1, 1, false, false, dt, false);
      else m.step(0, 0, false, false, dt, false);
      ticks++;
    });
    acc = r.accumulator;
  }
  return {
    label, ticks,
    x: H.x, y: H.y, vx: H.vx, vy: H.vy,
    stamina: H.stamina, distance: H.distance,
    exhausted: H.exhausted, state: m.mv.s,
    acc,
  };
}

function constant(fps, seconds = 10) {
  const n = Math.round(fps * seconds);
  return Array(n).fill(1 / fps);
}

function jittered(seconds = 10) {
  // Alternating render intervals that sum to exactly ten seconds. None are
  // simulation ticks; they merely feed the accumulator like rAF would.
  const pattern = [1/240, 1/90, 1/165, 1/48, 1/120, 1/75];
  const out = []; let t = 0, i = 0;
  while (t < seconds - 1e-12) {
    const d = Math.min(pattern[i++ % pattern.length], seconds - t);
    out.push(d); t += d;
  }
  return out;
}

const cases = [30, 60, 120, 144, 240, 360].map(f => runSchedule(constant(f), `${f} FPS`));
cases.push(runSchedule(jittered(), 'jittered FPS'));
const base = cases.find(x => x.label === '60 FPS');
const keys = ['ticks','x','y','vx','vy','stamina','distance','exhausted','state'];
for (const r of cases) {
  assert.strictEqual(r.ticks, 600, `${r.label}: expected 600 fixed ticks, got ${r.ticks}`);
  for (const k of keys) assert.strictEqual(r[k], base[k], `${r.label}: ${k} differs from 60 FPS (${r[k]} vs ${base[k]})`);
  assert(r.acc >= -1e-9 && r.acc < timing.FIXED_DT + 1e-9, `${r.label}: bad accumulator ${r.acc}`);
  console.log(`PASS ${r.label}: ${r.ticks} ticks, x=${r.x.toFixed(6)}, y=${r.y.toFixed(6)}, stamina=${r.stamina.toFixed(6)}`);
}

// Catch-up behavior: 15 FPS must still advance four 60 Hz gameplay ticks per rendered frame.
{
  let ticks = 0, acc = 0;
  for (let i = 0; i < 15; i++) { const r = timing.consume(acc, 1/15, () => ticks++); acc = r.accumulator; }
  assert.strictEqual(ticks, 60);
  console.log('PASS 15 FPS catch-up: 60 fixed gameplay ticks in one real second');
}

// High FPS must never run more gameplay ticks merely because more render callbacks occur.
{
  const count = fps => { let ticks=0, acc=0; for(let i=0;i<fps;i++){const r=timing.consume(acc,1/fps,()=>ticks++); acc=r.accumulator;} return ticks; };
  assert.deepStrictEqual([count(60),count(120),count(240),count(360)], [60,60,60,60]);
  console.log('PASS render-rate isolation: 60/120/240/360 FPS all execute exactly 60 gameplay ticks per second');
}

console.log('FPS EQUALITY PASS — rendering frequency does not determine gameplay speed');
