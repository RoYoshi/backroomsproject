/* Stage 3B-L QA2 - the human-QA scenes, before (QA1 parent) and after (QA2), side by side (development only; never served).
 *
 *   node dev/stage-3b-l-qa2/scenes_qa2.js --before DIR [--game PATH] [--ports 9502,9503] [--scenes A1,A2,..] [--out DIR]
 *
 * Each scene is drawn by both builds at the same frozen instant (1920 x 1080, MEDIUM, no monsters, UI hidden), cropped to a
 * world box and put side by side (left: QA1 parent, right: QA2), plus QA2's full frame.  Scenes (STAGE_3B_FINAL_VISUAL_POLISH
 * _HUMAN_QA.md): A corner, flashlight sweep (three aims); B fluorescent-lit corners (convex, inner, a pillar); C a convex
 * corner, nothing round it revealed; D night vision, a wall in the infrared; E night vision, a pillar's infrared shadow;
 * F night vision, a wall between the lens and what is behind it; G night vision, range and falloff (LOW, HIGH); H the
 * camcorder raised with night vision OFF (the visible world). */
'use strict';
const fs = require('fs'), path = require('path');
const Q = require('./qa2_lib.js'); const { sharp } = Q;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const GAME = path.resolve(opt('game') || path.join(__dirname, '..', '..')), BEFORE = path.resolve(opt('before'));
const [PA, PB] = (opt('ports') || '9502,9503').split(',').map(Number), OUT = path.resolve(opt('out') || '/tmp/scenesqa2'); fs.mkdirSync(OUT, { recursive: true });
const C = c => c * 96 + 48;
const ALL = [
  ['A1', 'A corner, flashlight sweep: diagonal', { x: 1136, y: 5360, aim: -2.356, kind: 'flashlight', blackout: true }, [976, 5200, 160, 160]],
  ['A2', 'A corner, flashlight sweep: across the side face', { x: 1200, y: 5300, aim: -2.97, kind: 'flashlight', blackout: true }, [976, 5200, 160, 160]],
  ['A3', 'A corner, flashlight sweep: along the side face', { x: 1076, y: 5420, aim: -1.75, kind: 'flashlight', blackout: true }, [976, 5200, 160, 160]],
  ['A4', 'A inner corner, flashlight', { x: 470, y: 4890, aim: -2.33, kind: 'flashlight', blackout: true }, [344, 4760, 160, 160]],
  ['B1', 'B fluorescent-lit convex corner', { x: 1040, y: 3056, aim: -2.356 }, [880, 2896, 160, 160]],
  ['B2', 'B fluorescent-lit inner corner', { x: 380, y: 2690, aim: -2.3 }, [248, 2552, 160, 160]],
  ['B3', 'B fluorescent-lit pillar corners (PILLAR HALL)', { x: 8700, y: 1480, aim: -2.4 }, [8520, 1320, 240, 160]],
  ['C1', 'C convex corner: nothing round it revealed', { x: 1000, y: 2900, aim: 1.9 }, [880, 2860, 160, 160]],
  ['C2', 'C pillar corner: nothing round it revealed', { x: 8640, y: 1392, aim: Math.PI }, [8540, 1300, 160, 160]],
  ['D1', 'D night vision: a wall in the infrared (LOW)', { x: C(13), y: C(53), aim: Math.PI, kind: 'camcorder', nv: true, ir: 1, blackout: true }, [900, 4880, 440, 420]],
  ['D2', 'D night vision: swept away from the wall', { x: C(13), y: C(53), aim: -Math.PI / 2, kind: 'camcorder', nv: true, ir: 1, blackout: true }, [900, 4880, 440, 420]],
  ['E1', 'E night vision: a pillar\'s infrared shadow (LOW)', { x: 8760, y: 1392, aim: Math.PI, kind: 'camcorder', nv: true, ir: 1, blackout: true }, [8360, 1180, 440, 420]],
  ['F1', 'F night vision: a wall between the lens and what is behind it', { x: 1150, y: 5136, aim: Math.PI, kind: 'camcorder', nv: true, ir: 2, blackout: true }, [820, 4900, 400, 420]],
  ['G1', 'G night vision: range and falloff, LOW', { x: 2352, y: 5424, aim: 2.749, kind: 'camcorder', nv: true, ir: 1, blackout: true }, null],
  ['G2', 'G night vision: range and falloff, HIGH', { x: 2352, y: 5424, aim: 2.749, kind: 'camcorder', nv: true, ir: 2, blackout: true }, null],
  ['H1', 'H camcorder raised, night vision OFF (YELLOW HALL)', { x: C(12), y: C(35), aim: 0, kind: 'camcorder', nv: false, ir: 1 }, null],
];
const ONLY = opt('scenes') ? opt('scenes').split(',') : null, SCENES = ALL.filter(s => !ONLY || ONLY.includes(s[0]));
const label = (w, txt) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="26"><rect width="100%" height="100%" fill="#1b1b1b"/><text x="8" y="18" font-size="15" fill="#f2f2f2" font-family="sans-serif">${txt.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
(async () => {
  const sA = await Q.open(BEFORE, PA, { quality: 'medium' }), sB = await Q.open(GAME, PB, { quality: 'medium', browser: sA.browser }), R = [];
  try {
    for (const [id, title, sc, crop] of SCENES) {
      const stA = await Q.scene(sA, sc), stB = await Q.scene(sB, sc);
      const a = await Q.shot(sA, stA, { crop }), b = await Q.shot(sB, stB, { crop });
      const W = crop ? Math.min(560, Math.round(crop[2] * (crop[2] <= 200 ? 3.5 : 1.25))) : 900;
      const ra = await sharp(a).resize({ width: W }).png().toBuffer(), rb = await sharp(b).resize({ width: W }).png().toBuffer(), h = (await sharp(ra).metadata()).height;
      await sharp({ create: { width: 2 * W + 12, height: h + 26 + 26, channels: 3, background: '#111' } })
        .composite([{ input: label(2 * W + 12, `${id}  ${title}`), top: 0, left: 0 }, { input: label(W, 'before: QA1 parent (d3ec226)'), top: 26, left: 0 }, { input: label(W, 'after: QA2'), top: 26, left: W + 12 }, { input: ra, top: 52, left: 0 }, { input: rb, top: 52, left: W + 12 }])
        .jpeg({ quality: 86 }).toFile(path.join(OUT, `${id}_before_after.jpg`));
      if (!crop) await sharp(await Q.shot(sB, stB)).jpeg({ quality: 82 }).toFile(path.join(OUT, `${id}_qa2_full.jpg`));
      R.push({ id, title, scene: sc, crop, before: stA, after: stB }); console.log(id, title, JSON.stringify({ nv: stB.nv, ir: stB.ir, blackout: stB.blackout, lamps: stB.lamps }));
    }
  } finally { await Q.close(sB); await Q.close(sA); }
  fs.writeFileSync(path.join(OUT, 'scenes.json'), JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
