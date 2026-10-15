/* Stage 3H continuation C5 (evidence, development only): a V8 sampling profile (50 us) of one client perf scene, M8's mp.js against this
 * tree's, alternating; self time in mp.js by function, summed over the rounds.  node profile_menu.js [scene] [rounds] (from the repository) */
const L = require('/home/claude/backrooms-modern/dev/tools/gate/golden/cli_lib.js');
const SCENE = process.argv[2] || 'menu_online', ROUNDS = +(process.argv[3] || 8);
(async () => {
  const b = await L.launch(), OLD = L.fromRef('c34f0c22bbacc5ac2813d173bc0591b67af7169f'), NEW = L.fromTree();
  // runScene creates its own page; patch browser.newContext to attach a profiler to the page it makes
  const agg = { old: new Map(), new: new Map() }, tot = { old: 0, new: 0 }, mp = { old: [], new: [] };
  const realNew = b.newContext.bind(b);
  let side = null;
  b.newContext = async (o) => { const ctx = await realNew(o); const realPage = ctx.newPage.bind(ctx);
    ctx.newPage = async () => { const p = await realPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 50 });
      const ev = p.evaluate.bind(p);
      p.evaluate = async (fn, arg) => { if (typeof fn === 'function' && String(fn).includes('__RUN')) { await cdp.send('Profiler.start'); const r = await ev(fn, arg); const { profile } = await cdp.send('Profiler.stop');
          const dt = profile.timeDeltas, ids = profile.samples, byId = new Map(profile.nodes.map(n => [n.id, n])), m = agg[side];
          for (let i = 0; i < ids.length; i++) { const n = byId.get(ids[i]); const cf = n.callFrame; const url = (cf.url || '').split('/').pop(); const k = `${cf.functionName || '(anon)'} @${url}:${cf.lineNumber + 1}`; m.set(k, (m.get(k) || 0) + (dt[i] || 0)); tot[side] += dt[i] || 0; }
          return r; } return ev(fn, arg); };
      return p; };
    return ctx; };
  for (let r = 0; r < ROUNDS; r++) for (const [s, v] of [['old', OLD], ['new', NEW]]) { side = s; const x = await L.runScene(b, v, SCENE); mp[s].push(x.perf.mpMs); }
  await b.close();
  const med = a => { const q = a.slice().sort((x, y) => x - y); return q[q.length >> 1]; };
  console.log(`${SCENE}: mp hook ms median old ${med(mp.old).toFixed(1)} new ${med(mp.new).toFixed(1)}; sampled total us old ${tot.old} new ${tot.new}`);
  for (const s of ['old', 'new']) {
    const rows = [...agg[s]].filter(([k]) => /@mp\.js/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 14);
    console.log(`-- ${s}: mp.js self time (us, summed over ${ROUNDS} rounds)`); for (const [k, us] of rows) console.log(`   ${String(us).padStart(8)}  ${k}`);
    const all = [...agg[s]].filter(([k]) => /@mp\.js/.test(k)).reduce((a, [, us]) => a + us, 0); console.log(`   total in mp.js: ${all}`);
  }
})();
