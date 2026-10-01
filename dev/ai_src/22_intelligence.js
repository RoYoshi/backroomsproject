/* Stage 2F: shared evidence tools, never a species action brain. Inputs are observations only.
 * See STAGE_2F_DESIGN.md: physical contact, lifecycle and LOD are explicit system boundaries. */
const INTEL = Object.freeze({ players: 16, sounds: 8, soundTTL: 25, leads: 6, leadTTL: 45, evidence: 4, recordTTL: 120, visited: 128, visitedTTL: 60, habitObs: 6, hypotheses: 3, habitTTL: 30, habitRepeats: 3, habitBias: .12, candidates: 70, debugCandidates: 12 });
const evidenceModality = k => k === 'see' ? 'sight' : k === 'sound' ? 'sound' : 'light';
const evidenceWeights = e => e.kind === 'hound' ? { sight: 4, sound: 1.4, light: .8 } : { sight: 2, sound: 1.2, light: 2.2 };
function observationScore(e, q, now) {
  const modality = q.modality || evidenceModality(q.k), age = Math.max(0, now - q.t);
  const c = clamp(q.c ?? q.confidence ?? 0, 0, 1), u = Math.max(0, q.u ?? q.unc ?? 0);
  return evidenceWeights(e)[modality] * c * Math.exp(-age / (modality === 'sight' ? 4 : 3)) / (1 + u / 600) + (q.pid > 0 && q.pid === e.target ? .25 : 0);
}
function soundChoice(e, now) {
  let best = null, score = -Infinity;
  for (const h of e.mem.sounds) {
    if (h.t <= (e.lastHearT ?? -99) || now - h.t > 1.2) continue;
    const s = observationScore(e, h, now) * (.5 + h.I);
    if (s > score || (s === score && h.id < best.id)) { best = h; score = s; }
  }
  return best;
}
function evidenceCandidates(e, now) {
  const out = [];
  for (const r of e.mem.p.values()) for (const q of r.ev) out.push({ key: `P${r.id}/${q.k}`, pid: r.id, attribution: 'identified', modality: evidenceModality(q.k), x: q.x, y: q.y, t: q.t, c: q.c, u: q.u, expires: q.t + memHalfLife(e) * 3 });
  for (const L of e.mem.leads) out.push({ key: `L${L.id}`, pid: null, attribution: 'anonymous', modality: evidenceModality(L.k), x: L.x, y: L.y, t: L.t, c: L.c, u: L.u, expires: L.t + LEAD_MAXAGE, lead: L.id });
  for (const q of out) q.score = observationScore(e, q, now);
  out.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return out.slice(0, INTEL.candidates);
}
function arbitrateEvidence(eng, e) {
  const heard = soundChoice(e, eng.now); if (heard) e.hear = heard; else if (e.hear && eng.now - e.hear.t > INTEL.soundTTL) e.hear = null;
  const all = evidenceCandidates(e, eng.now), top = all[0];
  e.evidence = { candidates: all.slice(0, INTEL.debugCandidates), winner: top ? top.key : null,
    why: top ? `${e.kind} weights: ${top.modality}, ${top.attribution}, confidence/age/uncertainty${top.pid === e.target ? ', current-target continuity' : ''}; species state/commitment/canon triggers decide the action` : 'no credible evidence',
    weights: evidenceWeights(e) };
}
// Only a direct, currently valid visual continuation can name a sound. SourceId alone is never proof.
function identifySound(eng, e, ev) {
  if (!(ev.src > 0)) return null;
  const r = e.mem.p.get(ev.src);
  if (!r || !r.seen || !r.visual || eng.now - r.seenAt > .12) return null;
  let unique = null;
  for (const p of eng.candidates(e, 1750)) {
    if (Math.hypot(p.x - ev.x, p.y - ev.y) > 24 || !visualObservation(e, eng, p).vis) continue;
    if (unique) return null; // overlapping visible people do not make source identity unambiguous
    unique = p;
  }
  return unique && unique.id === r.id ? r : null;
}
function habitObserve(e, r, now) {
  const v = r.visual; if (!v || !r.seen) return;
  const cell = `${Math.floor(v.x / 192)},${Math.floor(v.y / 192)}`;
  const prev = r.habitLast, moving = Math.hypot(v.vx, v.vy) > 30;
  if (!moving || (prev && cell === prev.cell) || (prev && now - prev.t < 1.5)) return;
  r.habitLast = { cell, t: now };
  const dir = Math.atan2(v.vy, v.vx), key = cell + '/' + ((Math.round(dir / (Math.PI / 2)) + 4) % 4);
  const entries = e.mem.habits.get(r.id) || []; entries.push({ key, x: v.x, y: v.y, dir, t: now });
  while (entries.length > INTEL.habitObs) entries.shift(); e.mem.habits.set(r.id, entries);
}
function cleanHabits(e, now) {
  if(e.dbg.habitRejected && now-e.dbg.habitRejected.t>30)e.dbg.habitRejected=null;
  const hs = [];
  for (const [id, history] of e.mem.habits) {
    const r = e.mem.p.get(id), recent = history.filter(q => now - q.t <= INTEL.habitTTL);
    if (!r || now - Math.max(r.seenAt, r.heardAt) > INTEL.habitTTL || !recent.length) { e.mem.habits.delete(id); e.dbg.habitRejected = {t:now, why:'observations expired or identity stale'}; if (r) r.habitLast = null; continue; }
    e.mem.habits.set(id, recent);
    const groups = new Map(); for (const q of recent) { const g = groups.get(q.key) || []; g.push(q); groups.set(q.key, g); }
    for (const [key, qs] of groups) if (qs.length >= INTEL.habitRepeats) hs.push({ pid: id, key, ...qs[qs.length - 1], count: qs.length, bias: INTEL.habitBias, expires: qs[0].t + INTEL.habitTTL });
  }
  hs.sort((a, b) => b.count - a.count || b.t - a.t || a.pid - b.pid || a.key.localeCompare(b.key)); e.mem.hypotheses = hs.slice(0, INTEL.hypotheses);
  if(e.dbg.habit && !e.mem.hypotheses.some(h=>h.pid===e.dbg.habit.pid&&h.key===e.dbg.habit.key))e.dbg.habit=null;
  if (!e.seenNow.size && [S.ROAMING, S.DORMANT, S.HIDDEN, S.DISAPPEARING].includes(e.state)) { if(e.mem.habits.size)e.dbg.habitRejected={t:now,why:'encounter ended'};e.mem.habits.clear(); e.mem.hypotheses = [];e.dbg.habit=null; for (const r of e.mem.p.values()) r.habitLast = null; }
}
function habitBias(e, id, x, y, score) {
  const h = e.mem.hypotheses.find(h => h.pid === id && Math.hypot(h.x - x, h.y - y) < 280);
  if (!h) return score;
  const delta = Math.abs(score) * h.bias; e.dbg.habit = { pid: id, key: h.key, count: h.count, bias: h.bias, delta, x, y };
  return score + delta; // only already-plausible geometry candidates reach this function
}
function forgetIdentity(e, id) {
  e.mem.p.delete(id); e.mem.habits.delete(id); e.mem.hypotheses = e.mem.hypotheses.filter(h => h.pid !== id); e.seenNow.delete(id);
  e.mem.sounds = e.mem.sounds.filter(h => h.pid !== id);
  if (e.hear && e.hear.pid === id) e.hear = null;
  if (e.target === id) { e.target = null; e.hEye = null; e.dbg.retarget = 'identity lifecycle ended'; }
  if (e.att) e.att.delete(id);
  if (e.pulledOff?.id === id) e.pulledOff = null;
  if (e.heldRetreatId === id) { e.heldRetreatId = null; e.heldRetreatAt = -99; }
  if (e.feed?.guard === id) e.feed.guard = null;
  if (e.search?.rid === id) e.search = null;
  if (e.caut?.rid === id) e.caut = null;
  if (e.alert?.rid === id) e.alert = null;
  if (e.cur?.rid === id) e.cur = null;
  e.evidence = null; e.dbg.habit = null; e.dbg.habitRejected=null;
}
function cleanupKnowledge(eng, e) {
  const now = eng.now;
  for (const [id, r] of e.mem.p) if (!eng.byId.has(id) || now - Math.max(r.seenAt, r.heardAt) > INTEL.recordTTL) forgetIdentity(e, id);
  for (const [cell, t] of e.mem.visited) if (now - t > INTEL.visitedTTL) e.mem.visited.delete(cell);
  while (e.mem.visited.size > INTEL.visited) e.mem.visited.delete(e.mem.visited.keys().next().value);
  if (e.hChecked) e.hChecked = e.hChecked.filter(q => q.until > now).slice(-6);
  if (e.att) for (const id of e.att.keys()) if (!e.mem.p.has(id)) e.att.delete(id);
  cleanHabits(e, now);
}
function intelligenceDebug(eng, e) {
  const A = e.evidence;
  const targets=[...e.mem.p.values()].map(r=>({pid:r.id,score:+(e.kind==='hound'?houndTargetScore(e,r,eng.now)+(r.id===e.target ? .65 : 0):sScore(eng,e,r)).toFixed(3),current:r.id===e.target,seen:r.seen,
    why:tgtGone(eng,e,r)?'rejected: perceived unavailable':e.kind==='hound'&&!hMaySwitch(e,r,eng.now)?'commitment prevents switch':e.kind==='smiler'&&!r.seen&&(eng.now-r.seenAt>2.5||r.conf<.3)?'rejected: stale/uncertain':r.id===e.target?'current target; species state/trigger rules apply':'observed candidate; species state/trigger rules apply'})).sort((a,b)=>b.score-a.score||a.pid-b.pid).slice(0,12);
  const pending=[];for(const [pid,history]of e.mem.habits){const counts=new Map();for(const q of history)counts.set(q.key,(counts.get(q.key)||0)+1);for(const [key,count]of counts)if(count<INTEL.habitRepeats)pending.push({pid,key,count,why:'rejected: fewer than three observed repetitions'});}
  return { winner: A?.winner || null, why: A?.why || 'no evidence', weights: A?.weights || evidenceWeights(e),
    candidates: (A?.candidates || []).map(q => ({ key: q.key, attribution: q.attribution, modality: q.modality, score: +q.score.toFixed(3), c: +q.c.toFixed(2), u: Math.round(q.u), age: +(eng.now - q.t).toFixed(2), expires: +(q.expires - eng.now).toFixed(1) })),
    sound: e.hear ? { attribution: e.hear.attribution, x: Math.round(e.hear.x), y: Math.round(e.hear.y), type: e.hear.type } : null,
    habits: e.mem.hypotheses.map(h => ({ pid: h.pid, count: h.count, bias: h.bias, x: Math.round(h.x), y: Math.round(h.y), expires: +(h.expires - eng.now).toFixed(1) })),
    target:e.target||null, targets, commitment:{age:+(eng.now-(e.tgtSince??eng.now)).toFixed(2),dwell:e.kind==='hound'?hDwell(e):SM_DWELL}, rejectedHabits:pending.slice(0,3), habitExpiry:e.dbg.habitRejected||null, applied: e.dbg.habit || null, rng: e.rngKey, tags: Object.keys(e.streams),
    counts: { players: e.mem.p.size, sounds: e.mem.sounds.length, leads: e.mem.leads.length, visits: e.mem.visited.size, habitObservations: [...e.mem.habits.values()].reduce((n,h) => n+h.length,0), hypotheses: e.mem.hypotheses.length } };
}
