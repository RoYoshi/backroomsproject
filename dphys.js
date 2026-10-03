/* dphys.js - lightweight procedural physics for the death animations (v18).
 *
 * One small simulation per death, shared by the local victim and by every spectator's replay (the bundle's death class calls it; nothing else does).
 * It is deliberately NOT a physics engine: a handful of point masses and springs stepped at a fixed 240 Hz, so the same event parameters give the
 * same motion on every machine, and a death can be sampled at any time (slow motion, pause, single steps) without changing what it looks like.
 *
 *   attacker  a point mass steered by a damped spring, with real contact against the victim and against the walls
 *   victim    body position / velocity / angle / angular velocity, ground friction, wall collisions, a short squash impulse
 *   hands     two independent point masses on springs anchored to the body: they lag, overshoot, brace on the floor and slip - never glued
 *   gear      the light source and the hat leave the body carrying its velocity, then slide, spin, hit walls and go to sleep
 *   camera    one damped impulse per real impact
 *
 * The authored part is small: when the attacker grips, drags, pushes, lets go, and how hard the victim resists.  Everything the eye sees
 * between those moments - the direction the body flies, how it turns, how far the hands trail - is integrated, which is what keeps it continuous.
 * A death is ACTIVE while things move, SETTLING while they die away and SLEEPING once nothing moves any more (from then on it costs nothing).
 */
(() => {
  'use strict';
  const DT = 1 / 240, TAU = Math.PI * 2, RB = 18, PI = Math.PI;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const hyp = Math.hypot;
  const rng = seed => { let s = (seed >>> 0) || 1; const next=() => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; next.state=()=>s;next.restore=v=>{s=v>>>0;};return next; };
  /* a smooth irregular signal in [-1, 1]: three sines with seeded frequencies - never a loop the eye can learn */
  const noise = r => { const f = [], p = [], a = []; for (let i = 0; i < 3; i++) { f.push(.8 + r() * 2.2 + i * .9); p.push(r() * TAU); a.push((1 / (i + 1)) * (.6 + r() * .6)); } const n = a[0] + a[1] + a[2]; return t => (a[0] * Math.sin(TAU * f[0] * t + p[0]) + a[1] * Math.sin(TAU * f[1] * t + p[1]) + a[2] * Math.sin(TAU * f[2] * t + p[2])) / n; };
  const HAND_R = { x: 13, y: -13 }, HAND_L = { x: -13, y: -13 };
  const LEN = { flashlight: 23, lantern: 13, camcorder: 6, headlamp: 0 };

  /* circle against the level's wall blocks: pushes the circle out, reflects what is left of the velocity, drags the tangential part (friction), and says how hard it hit */
  function collide(walls, o, r, rest, fric) {
    let hit = null;
    for (let it = 0; it < 2; it++) {
      const rects = walls(o.x, o.y);
      for (let i = 0; i < rects.length; i++) {
        const q = rects[i], cx = clamp(o.x, q.x, q.x + q.w), cy = clamp(o.y, q.y, q.y + q.h);
        let dx = o.x - cx, dy = o.y - cy, d = hyp(dx, dy), nx, ny, pen;
        if (d >= r) continue;
        if (d > 1e-4) { nx = dx / d; ny = dy / d; pen = r - d; }
        else { const l = o.x - q.x, rr = q.x + q.w - o.x, u = o.y - q.y, dn = q.y + q.h - o.y, m = Math.min(l, rr, u, dn); if (m === l) { nx = -1; ny = 0; } else if (m === rr) { nx = 1; ny = 0; } else if (m === u) { nx = 0; ny = -1; } else { nx = 0; ny = 1; } pen = r + m; }
        o.x += nx * pen; o.y += ny * pen;
        const vn = o.vx * nx + o.vy * ny;
        if (vn < 0) {
          o.vx -= (1 + rest) * vn * nx; o.vy -= (1 + rest) * vn * ny;
          const tx = -ny, ty = nx, vt = o.vx * tx + o.vy * ty, cut = vt * Math.min(1, fric * -vn / (Math.abs(vt) + 1e-3) * .02 + fric * .3);
          o.vx -= tx * cut; o.vy -= ty * cut;
          if (!hit || -vn > hit.sp) hit = { sp: -vn, nx, ny, x: cx, y: cy, vt: cut };
        }
      }
    }
    return hit;
  }

  const CFG = {
    /* attacker speed on arrival, its restitution, when it grips, victim resistance (start / fade time / strength), the drag window, the light source and the hat */
    Hound: {
      A: { va: 330, e: .12, grip: .16, pin: [.3, 5], res: [.15, .55, 1], lock: [1.5, 2.4], eq: 'hit1', hat: 'hit2', back: [2.1, 3.0, 14], tw: 2.4 },
      B: { va: 235, e: .1, grip: .26, res: [.15, .5, 1], drag: [.9, 2.2], eq: 'drag', hat: 'drag', back: [2.5, 3.2, 10], hold: 1 },
      C: { va: 0, e: .1, grip: .62, res: [.2, .4, .55], wall: 1, eq: 'wall', hat: 'wall', pin: [.9, 5], back: [2.0, 2.9, 12] },
      D: { va: 175, e: .05, grip: .4, res: [.1, .35, .28], collapse: [.05, .9], eq: 'early', hat: 'none', back: [2.0, 2.9, 10], pin: [.7, 3] },
    },
    Smiler: {
      A: { va: 0, res: [.1, .5, .9], still: .25, shove: [.32, 105], draw: [2.03, 3.12, 86], eq: 'draw', hat: 'none', stand: 36 },
      B: { va: 0, res: [.05, .3, .5], still: .3, collapse: [.7, 1.4], eq: 'collapse', hat: 'none', stand: 44, closeIn: [.05, 1.15] },
      C: { va: 0, res: [.1, .5, .8], still: .25, shove: [.28, 60], draw: [1.7, 2.7, 36], eq: 'draw', hat: 'none', stand: 38 },
      D: { va: 0, res: [.1, .5, .8], still: .25, shove: [.32, 90], draw: [1.6, 3.0, 70], eq: 'draw', hat: 'none', stand: 36 },
    },
  };

  function create(ctx) {
    const hound = ctx.kind === 'Hound', cfg = CFG[hound ? 'Hound' : 'Smiler'][ctx.v] || CFG[hound ? 'Hound' : 'Smiler'].A;
    const r = rng(ctx.seed), walls = ctx.walls || (() => []);
    const nz = [noise(r), noise(r), noise(r), noise(r), noise(r), noise(r)];
    const ux = Math.cos(ctx.dir), uy = Math.sin(ctx.dir), th0 = ctx.victim.angle + PI / 2;
    const exh = ctx.exhausted ? .5 : 1;
    const S = {
      t: 0, cfg, ctx, hound, exh, ux, uy, walls, dur: ctx.dur, ended: false, state: 'ACTIVE', calm: 0, phase: 'contact', ev: [],
      b: { x: ctx.victim.x, y: ctx.victim.y, vx: (ctx.victim.vx || 0) * .8, vy: (ctx.victim.vy || 0) * .8, th: th0, om: 0, sq: 0, sqv: 0, nx: ux, ny: uy, cs: 0, csv: 0 },
      h: [
        { anc: HAND_L, x: 0, y: 0, vx: 0, vy: 0, off: { x: 0, y: 0 }, k: 380, dampingRatio: .55, brace: null, slipT: -9, tries: 0 },
        { anc: HAND_R, x: 0, y: 0, vx: 0, vy: 0, off: { x: 0, y: 0 }, k: 380, dampingRatio: .55, brace: null, slipT: -9, tries: 0 },
      ],
      eq: { has: ctx.eqKind !== 'headlamp', held: true, x: 0, y: 0, vx: 0, vy: 0, rot: 0, w: 0, rho: 0, rhov: 0, st: 'ACTIVE', still: 0, len: LEN[ctx.eqKind] != null ? LEN[ctx.eqKind] : 23 },
      hat: { has: ctx.hat && ctx.hat !== 'none', on: true, x: 0, y: 0, vx: 0, vy: 0, rot: 0, w: 0, st: 'ACTIVE', still: 0 },
      at: { x: ctx.src.x, y: ctx.src.y, vx: ux * (cfg.va || 0), vy: uy * (cfg.va || 0), a: ctx.dir, av: 0, contact: false, load: 0, str: 0, bite: 0, lunge: hound ? 1 : 0 },
      cam: { x: 0, y: 0, vx: 0, vy: 0 },
      rope: null, pull: 0, dragS: 0, dragOn: false, wallHit: null, hitsDone: 0, eqAt: -1, hatAt: -1, firstBlow: -1, trail: [], trace: { b: [], h0: [], h1: [], eq: [], at: [], hit: [] }, tr: 0,
      res: 0, contactT: -1, released: false, slipCount: 0, pitch: 0,
    };
    const b = S.b, c0 = Math.cos(th0), s0 = Math.sin(th0);
    S.h.forEach((h, i) => { h.x = b.x + h.anc.x * c0 - h.anc.y * s0; h.y = b.y + h.anc.x * s0 + h.anc.y * c0; h.vx = b.vx; h.vy = b.vy; });
    const hr = S.h[1]; S.eq.x = hr.x; S.eq.y = hr.y; S.eq.vx = b.vx; S.eq.vy = b.vy; S.eq.rot = th0;
    S.hat.x = b.x; S.hat.y = b.y; S.hat.vx = b.vx; S.hat.vy = b.vy; S.hat.rot = th0;
    S.nz = nz; S.rr = r;
    S.dragDir = { x: -ux, y: -uy };
    if (cfg.draw) { S.dragDir = { x: -ux, y: -uy }; }
    S.stepN = 0;
    if (ctx.geometry) initializeSpatial(S);
    return S;
  }

  const SPATIAL_VERSION='stage-g-death-1';
  function initializeSpatial(S){
    const M=window.TFB_MOTION||window.__motion;if(!M)throw Error('Spatial death requires shared world_motion');
    if(S.ctx.geometry.identity.geometryMode!=='spatial')throw Error('Explicit spatial geometry required');
    S.spatial=true;S.motion=M.passive(S.ctx.geometry);S.geometryHash=S.ctx.geometry.identity.contentHash;
    const P=M.DEATH_PROFILES,b=S.b,v=S.ctx.victim,a=S.ctx.src;
    S.motion.initialize(b,P.body,v.z,v.vz||0);
    S.motion.initialize(S.at,a.shape||P[S.hound?'hound':'smiler'],a.z,a.vz||0);
    if(Number.isFinite(a.vx))S.at.vx=a.vx;if(Number.isFinite(a.vy))S.at.vy=a.vy;
    S.h.forEach(h=>S.motion.initialize(h,P.hand,b.z+5,v.vz||0));
    S.eq.x=b.x;S.eq.y=b.y;S.motion.initialize(S.eq,P.light,b.z+9,v.vz||0);
    S.hat.x=b.x;S.hat.y=b.y;S.motion.initialize(S.hat,P.hat,b.z+9,v.vz||0);
    attachSpatial(S,S.eq,{x:S.h[1].x,y:S.h[1].y,z:S.h[1].z+2},true);
    attachSpatial(S,S.hat,{x:b.x,y:b.y,z:b.z+20},true);
    S.deathTick=0;S.decals=[];S.spatialTrail=[];S.trailSegment=0;S.trailContact=false;S.physicalEvents=[];S.physicalSequence=0;
  }
  function attachSpatial(S,o,target,initial=false){
    const b=S.b,start={x:b.x,y:b.y,z:b.z+9-o.shape.centerOffset},end={x:target.x,y:target.y,z:target.z-o.shape.centerOffset},delta={x:end.x-start.x,y:end.y-start.y,z:end.z-start.z};
    const hit=S.ctx.geometry.sweep(o.shape,start,delta),f=hit?hit.t:1,p={x:start.x+delta.x*f,y:start.y+delta.y*f,z:start.z+delta.z*f+o.shape.centerOffset};
    const vx=(p.x-o.x)/DT,vy=(p.y-o.y)/DT,vz=(p.z-o.z)/DT;
    Object.assign(o,p,{vx:initial?b.vx:vx,vy:initial?b.vy:vy,vz:initial?b.vz:vz});
  }
  function spatialReach(S,a,b,reach){
    const ac={x:a.x,y:a.y,z:a.z+(a.shape.centerOffset?0:a.shape.height/2)},bc={x:b.x,y:b.y,z:b.z+(b.shape.centerOffset?0:b.shape.height/2)};
    return hyp(ac.x-bc.x,ac.y-bc.y,ac.z-bc.z)<=reach&&!S.ctx.geometry.raycast(ac,bc,'collision');
  }
  function spatialBrace(S,h,x,y,t){
    const p={...S.motion.base(h),x,y},ss=S.ctx.geometry.supports(h.shape,p,[p.z-.1,p.z+.00001],h.supportId);
    if(!ss.length||!S.ctx.geometry.clearance(h.shape,p).fits||!spatialReach(S,S.b,h,40))return null;
    return {x,y,z:ss[0].z+h.shape.centerOffset,supportId:ss[0].id,t};
  }
  function moveSpatial(S,o,options){
    const oldSupport=o.supportId,contacts=S.motion.step(o,{...options,substep:S.stepN});
    if(oldSupport!==o.supportId)physicalEvent(S,'support',o,{from:oldSupport,to:o.supportId});
    for(const c of contacts)if(c.speed>6){const face=surfaceRecord(S,o,{...c,massBase:true});physicalEvent(S,'contact',o,{speed:c.speed,face});if(o===S.b&&S.firstBlow>=0&&c.speed>60&&face)addDecal(S,face,'impact');}
    if(o===S.b)updateTrail(S);
    const hit=contacts.filter(c=>Math.abs(c.normal.z)<.7).sort((a,b)=>b.speed-a.speed)[0];
    return hit?{sp:hit.speed,nx:hit.normal.x,ny:hit.normal.y,nz:hit.normal.z,x:hit.point.x,y:hit.point.y,z:hit.point.z,vt:0}:null;
  }
  function massId(S,o){return o===S.b?'body':o===S.at?'attacker':o===S.eq?'light':o===S.hat?'hat':'hand:'+S.h.indexOf(o);}
  function physicalEvent(S,type,o,data){
    const e={id:++S.physicalSequence,tick:Math.floor(S.stepN/4),substep:S.stepN%4,type,object:massId(S,o),...data};
    S.physicalEvents.push(e);if(S.physicalEvents.length>64)S.physicalEvents.shift();return e;
  }
  // Hit faces use local orthonormal coordinates on one named primitive. A
  // support is never inferred from XY, and an underside is not the slab top.
  function surfaceRecord(S,o,hit){
    const solid=S.ctx.geometry.definition.solids.find(s=>s.id===hit.primitiveId);if(!solid)return null;
    const unit=n=>{const l=hyp(n.x,n.y,n.z);return {x:n.x/l,y:n.y/l,z:n.z/l};};
    const origin=(q,z)=>({x:q.x,y:q.y,z:z.a*q.x+z.b*q.y+z.c}),q=solid.footprint[0];
    const faces=[{id:'top',n:unit({x:-solid.upper.a,y:-solid.upper.b,z:1}),origin:origin(q,solid.upper)},{id:'underside',n:unit({x:solid.lower.a,y:solid.lower.b,z:-1}),origin:origin(q,solid.lower)}];
    for(let i=0;i<solid.footprint.length;i++){const a=solid.footprint[i],b=solid.footprint[(i+1)%solid.footprint.length];faces.push({id:'side:'+i,n:unit({x:b.y-a.y,y:a.x-b.x,z:0}),origin:origin(a,solid.lower)});}
    const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
    faces.sort((a,b)=>dot(b.n,hit.normal)-dot(a.n,hit.normal)||a.id.localeCompare(b.id));const face=faces[0],n=face.n,p={...hit.point};
    if(hit.massBase){const xy=hyp(n.x,n.y);if(xy){p.x-=n.x/xy*o.shape.radius;p.y-=n.y/xy*o.shape.radius;}p.z+=n.z<0?o.shape.height:n.z===0?o.shape.height/2:0;}
    const d=dot({x:p.x-face.origin.x,y:p.y-face.origin.y,z:p.z-face.origin.z},n);p.x-=n.x*d;p.y-=n.y*d;p.z-=n.z*d;
    const u=unit(Math.abs(n.z)>.9?{x:1,y:0,z:-n.x/(n.z||1)}:{x:-n.y,y:n.x,z:0}),v={x:n.y*u.z-n.z*u.y,y:n.z*u.x-n.x*u.z,z:n.x*u.y-n.y*u.x};
    const rel={x:p.x-face.origin.x,y:p.y-face.origin.y,z:p.z-face.origin.z},support=face.id==='top'?S.ctx.geometry.definition.supportPatches.find(s=>s.solidId===solid.id)?.id||null:null;
    return {primitiveId:solid.id,face:face.id,support,point:p,normal:n,local:{u:dot(rel,u),v:dot(rel,v)},origin:face.origin,basis:{u,v},geometryHash:S.geometryHash};
  }
  function groundRecord(S,o){
    if(!o.supportId)return null;const b=S.motion.base(o),from={x:o.x,y:o.y,z:b.z+o.shape.height/2},hit=S.ctx.geometry.raycast(from,{x:o.x,y:o.y,z:b.z-.11},'collision');
    return hit&&hit.primitiveId===S.ctx.geometry.supportPatch(o.supportId)?.solidId?surfaceRecord(S,o,hit):null;
  }
  function addDecal(S,face,reason){const event=physicalEvent(S,'decal',S.b,{reason});S.decals.push({id:event.id,substep:S.stepN,...face});if(S.decals.length>32)S.decals.shift();}
  function updateTrail(S){
    const face=groundRecord(S,S.b);if(!face){if(S.trailContact){S.trailSegment++;physicalEvent(S,'trail-break',S.b,{});}S.trailContact=false;return;}
    S.trailContact=true;if(S.firstBlow<0||(S.stepN&7)||hyp(S.b.vx,S.b.vy)<22)return;
    const last=S.spatialTrail.at(-1);if(last&&last.segment===S.trailSegment&&hyp(last.point.x-face.point.x,last.point.y-face.point.y,last.point.z-face.point.z)<9)return;
    S.spatialTrail.push({substep:S.stepN,segment:S.trailSegment,...face});if(S.spatialTrail.length>60)S.spatialTrail.shift();
  }
  function beamState(S){
    const attached=S.ctx.eqKind==='headlamp',e=attached?S.b:S.eq,yaw=(attached?S.b.th:e.rot)-PI/2,n=e.normal||{x:0,y:0,z:1};
    let direction={x:Math.cos(yaw),y:Math.sin(yaw),z:0};if(e.supportId&&n.z>.1)direction.z=-(direction.x*n.x+direction.y*n.y)/n.z;
    const l=hyp(direction.x,direction.y,direction.z);for(const k of ['x','y','z'])direction[k]/=l;
    const center={x:e.x,y:e.y,z:attached?e.z+9:e.z},length=attached?0:S.eq.len,target={x:center.x+direction.x*length,y:center.y+direction.y*length,z:center.z+direction.z*length};
    const hit=S.ctx.geometry.raycast(center,target,'collision'),origin=hit?{x:hit.point.x+hit.normal.x*.05,y:hit.point.y+hit.normal.y*.05,z:hit.point.z+hit.normal.z*.05}:target;
    return {kind:S.ctx.eqKind,object:attached?'body':'light',origin,direction,support:e.supportId,clippedBy:hit?.primitiveId||null};
  }
  function constrainHand(S,h){
    const b=S.b,dx=h.x-b.x,dy=h.y-b.y,dz=h.z-(b.z+9),d=hyp(dx,dy,dz);
    if(d>40){const f=40/d;S.motion.sweep(h,{x:dx*(f-1),y:dy*(f-1),z:dz*(f-1)});
      const vn=((h.vx-b.vx)*dx+(h.vy-b.vy)*dy+(h.vz-b.vz)*dz)/d;
      if(vn>0){h.vx-=dx/d*vn;h.vy-=dy/d*vn;h.vz-=dz/d*vn;}
    }
    S.motion.support(h);
  }
  function settleSpatial(S){
    const dt=DT,b=S.b;S.ended=true;
    if(b.supportId)b.om*=Math.exp(-5*dt);b.th+=b.om*dt;b.sqv=0;
    moveSpatial(S,b,{mu:560,sleep:true});
    for(const h of S.h){
      if(!h.sleeping){const c=Math.cos(b.th),s=Math.sin(b.th),lx=h.anc.x+h.off.x,ly=h.anc.y+h.off.y;
        const x=b.x+lx*c-ly*s,y=b.y+lx*s+ly*c;
        h.vx+=(90*(x-h.x)-18*(h.vx-b.vx))*dt;h.vy+=(90*(y-h.y)-18*(h.vy-b.vy))*dt;
        h.vz+=(90*(b.z+5-h.z)-18*(h.vz-b.vz))*dt;
      }
      moveSpatial(S,h,{mu:250,sleep:true});constrainHand(S,h);
    }
    if(S.eq.has&&!S.eq.held)freeBody(S,S.eq,7,.38,250,2.3,dt,'eq');
    if(S.hat.has&&!S.hat.on)freeBody(S,S.hat,11,.3,200,2.6,dt,'hat');
    else if(S.hat.has){attachSpatial(S,S.hat,{x:b.x,y:b.y,z:b.z+20});Object.assign(S.hat,{rot:b.th,w:b.om,sleeping:b.sleeping,st:b.st,supportId:b.supportId,stable:b.stable});}
    const masses=[b,...S.h,...(S.eq.has&&!S.eq.held?[S.eq]:[]),...(S.hat.has&&!S.hat.on?[S.hat]:[])];
    S.state=masses.every(o=>o.sleeping)&&(S.stepN+1)%4===0?'SLEEPING':masses.some(o=>!o.stable)?'ACTIVE':'SETTLING';
    S.stepN++;S.t=S.stepN*DT;
  }
  function fromEvent(event,geometry){
    if(event.version!==SPATIAL_VERSION||event.geometry.contentHash!==geometry.identity.contentHash)throw Error('Death kernel/geometry mismatch');
    const p=event.plan,v=event.initial.victim,a=event.initial.attacker;
    return create({kind:event.kind,v:event.variant,seed:event.seed,victim:{...v},src:{...a},dir:event.direction,hits:p.hits||[.24,.74,1.2,1.7],kn:p.kn,drag:p.dr,dur:event.duration,eqKind:event.equipment.kind,hat:event.equipment.hat,exhausted:event.exhausted,geometry});
  }
  function tick(S){if(S.spatial&&S.state==='SLEEPING')return S;for(let i=0;i<4;i++)stepOnce(S);S.deathTick=(S.deathTick||0)+1;return S;}
  function save(S){
    if(!S.spatial)throw Error('Spatial checkpoint required');
    const skip=new Set(['motion','ctx','cfg','walls','nz','rr','out','trace','ev','trail','physicalEvents','decals','spatialTrail']);
    return {version:SPATIAL_VERSION,rng:S.rr.state(),data:JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(S).filter(([k])=>!skip.has(k)))))};
  }
  function restore(event,geometry,checkpoint,records){
    if(checkpoint.version!==SPATIAL_VERSION)throw Error('Death checkpoint version mismatch');
    const S=fromEvent(event,geometry);Object.assign(S,JSON.parse(JSON.stringify(checkpoint.data)));S.rr.restore(checkpoint.rng);
    if(records){S.physicalEvents=JSON.parse(JSON.stringify(records.events));S.decals=JSON.parse(JSON.stringify(records.decals));S.spatialTrail=JSON.parse(JSON.stringify(records.trail));}
    return S;
  }
  function rebindGeometry(S,geometry){
    if(!S.spatial)throw Error('Spatial death required');const M=window.TFB_MOTION||window.__motion,m=M.passive(geometry),masses=[S.b,...S.h,...(S.eq.has&&!S.eq.held?[S.eq]:[]),...(S.hat.has&&!S.hat.on?[S.hat]:[])];
    if(masses.some(o=>!m.fit(o)))throw Error('Geometry revision intersects existing aftermath');
    S.ctx={...S.ctx,geometry};S.motion=m;S.geometryHash=geometry.identity.contentHash;
    for(const o of masses){m.support(o);if(!o.stable){o.sleeping=false;o.st='ACTIVE';}}
    if(masses.some(o=>!o.sleeping))S.state='ACTIVE';return S;
  }
  function snapshot(S){
    if(!S.spatial)throw Error('Spatial snapshot required');
    const mass=(o,id)=>({id,x:o.x,y:o.y,z:o.z,vx:o.vx,vy:o.vy,vz:o.vz,shape:{...o.shape},support:o.supportId,normal:o.normal,stable:o.stable,sleeping:o.sleeping,mode:o.motionMode,revision:o.revision,yaw:o.th??o.rot??o.a??0,angularVelocity:o.om??o.w??o.av??0,tilt:o.tilt||{x:0,y:0},contacts:o.contacts.map(c=>({primitiveId:c.primitiveId,normal:c.normal,point:c.point,substep:c.substep})),diagnostics:o.diagnostics.slice(-4)});
    return {version:SPATIAL_VERSION,geometryHash:S.geometryHash,substep:S.stepN,time:S.t,duration:S.dur,state:S.state,phase:S.phase,body:mass(S.b,'body'),hands:S.h.map((h,i)=>mass(h,'hand:'+i)),attacker:mass(S.at,'attacker'),light:S.eq.has?{...mass(S.eq,'light'),held:S.eq.held}:null,hat:S.hat.has?{...mass(S.hat,'hat'),attached:S.hat.on}:null,beam:beamState(S),decals:S.decals.map(d=>({...d})),trail:S.spatialTrail.map(p=>({...p})),events:S.physicalEvents.map(e=>({...e})),eventSequence:S.physicalSequence};
  }

  /* how hard the victim is still fighting back at time t (0 = limp .. 1 = full strength); an exhausted victim starts weaker and gives up sooner */
  function resist(S, t) {
    const c = S.cfg.res, k = c[2] * S.exh;
    if (t < c[0]) return k * sm(0, c[0], t) * .5;
    return k * Math.exp(-Math.max(0, t - c[0]) / (c[1] * (S.exh < 1 ? .75 : 1)));
  }

  function release(S, what, t, kick) {
    const b = S.b,attached=S.spatial?{x:(what==='eq'?S.eq:S.hat).x,y:(what==='eq'?S.eq:S.hat).y,z:(what==='eq'?S.eq:S.hat).z,vx:(what==='eq'?S.eq:S.hat).vx,vy:(what==='eq'?S.eq:S.hat).vy,vz:(what==='eq'?S.eq:S.hat).vz}:null;
    if (what === 'eq') {
      const e = S.eq; if (!e.has || !e.held) return; e.held = false; S.eqAt = t;
      const h = S.h[1]; e.x = h.x; e.y = h.y; e.vx = h.vx + (kick && kick.x || 0); e.vy = h.vy + (kick && kick.y || 0);
      if(S.spatial){Object.assign(e,attached);e.vx+=(kick?.x||0);e.vy+=(kick?.y||0);e.sleeping=false;e.supportId=null;e.st='ACTIVE';}
      e.rot = b.th + e.rho; e.w = b.om + e.rhov + (S.rr() - .5) * 7; S.ev.push({ t, k: 'eq' });if(S.spatial)physicalEvent(S,'release',e,{velocity:{x:e.vx,y:e.vy,z:e.vz},angularVelocity:e.w});
    } else {
      const e = S.hat; if (!e.has || !e.on) return; e.on = false; S.hatAt = t;
      e.x = b.x; e.y = b.y; e.vx = b.vx + (kick && kick.x || 0); e.vy = b.vy + (kick && kick.y || 0); if(S.spatial){Object.assign(e,attached);e.vx+=(kick?.x||0);e.vy+=(kick?.y||0);e.sleeping=false;e.supportId=null;e.st='ACTIVE';} e.rot = b.th; e.w = b.om + (S.rr() - .5) * 9; S.ev.push({ t, k: 'hat' });if(S.spatial)physicalEvent(S,'release',e,{velocity:{x:e.vx,y:e.vy,z:e.vz},angularVelocity:e.w});
    }
  }

  function shock(S, x, y, mag) { const c = S.cam; c.vx += x * mag; c.vy += y * mag; }

  function stepOnce(S) {
    if (S.spatial && S.stepN >= Math.ceil(S.dur * 240)) { settleSpatial(S); return; }
    const t = S.t, dt = DT, cfg = S.cfg, b = S.b, at = S.at, hound = S.hound, ux = S.ux, uy = S.uy, W = S.walls, ctx = S.ctx;
    const res = S.res = resist(S, t);
    const dx0 = b.x - at.x, dy0 = b.y - at.y, dist = hyp(dx0, dy0) || 1, nAx = dx0 / dist, nAy = dy0 / dist;     // attacker -> victim
    const RA = hound ? 22 : 18, contactD = RB + RA;

    /* ---------------- attacker steering ---------------- */
    let tx, ty, kp = 170, kd = 24, amax = 3600, stand = hound ? contactD - 3 : (cfg.stand || 36);
    if (cfg.wall && t < .02) { /* the wall variants launch the victim: handled below on first contact */ }
    if (hound && cfg.drag && t >= cfg.drag[0]) {
      // dragging: the hound walks backwards along the drag line; strain from the rope slows it, so the pull visibly costs it something
      if (!S.dragOn) {
        S.dragOn = true; S.dragP0 = { x: at.x, y: at.y }; S.dragStart = t; S.dragS = 0;
        if (cfg.eq === 'drag') release(S, 'eq', t, { x: S.dragDir.x * -30, y: S.dragDir.y * -30 });
        if (cfg.hat === 'drag') release(S, 'hat', t, { x: 0, y: 0 });
      }
      const win = cfg.drag[1] - cfg.drag[0], ph = clamp((t - cfg.drag[0]) / win, 0, 1), env = Math.sin(clamp(ph, 0, 1) * PI) * .6 + .4 * sm(0, .25, ph) * (1 - sm(.75, 1, ph));
      const strain = S.rope ? clamp(S.rope.stretch / 16, 0, 1.5) : 0, want = ctx.drag / win * 2.3 * env, v = want / (1 + strain * 1.6);
      S.dragS += v * dt; if (S.dragS > ctx.drag) S.dragS = ctx.drag;
      tx = S.dragP0.x + S.dragDir.x * S.dragS; ty = S.dragP0.y + S.dragDir.y * S.dragS; kp = 130; kd = 22; at.str += (strain - at.str) * .06;
    } else if (!hound && cfg.draw && t >= cfg.draw[0]) {
      tx = at.x; ty = at.y; kp = 10; kd = 10;                                                                                // the smiler does not move: what it holds is drawn to it
    } else if (!hound && cfg.closeIn) {
      const k = sm(cfg.closeIn[0], cfg.closeIn[1], t), d = 130 + (stand - 130) * k;                                          // it closes on you deliberately: an S-curve, no lunge
      tx = b.x - nAx * d; ty = b.y - nAy * d; kp = 60; kd = 15;
    } else if (!hound) {
      const k = sm(.05, .95, t), d = dist + (stand - dist) * k * .5; tx = b.x - nAx * Math.max(stand, d); ty = b.y - nAy * Math.max(stand, d); kp = 55; kd = 14;
    } else {
      let d = stand; if (cfg.back && t > cfg.back[0]) d += cfg.back[2] * sm(cfg.back[0], cfg.back[1], t);                       // finished: it eases off, it does not vanish
      tx = b.x - nAx * d; ty = b.y - nAy * d;
    }
    let ax = kp * (tx - at.x) - kd * at.vx, ay = kp * (ty - at.y) - kd * at.vy; const am = hyp(ax, ay); if (am > amax) { ax *= amax / am; ay *= amax / am; }
    at.vx += ax * dt; at.vy += ay * dt;

    /* ---------------- contact between attacker and victim ---------------- */
    let overlap = hound ? contactD - dist : -1;
    if (S.spatial && !S.ctx.geometry.contact({...at,z:at.z,shape:at.shape},{...b,z:b.z,shape:b.shape},{reach:contactD+1}).touching) overlap = -1;                                                     // the smiler is not solid to what it draws in
    if (overlap > 0) {
      const mA = hound ? 2.4 : 3, mB = 1, tm = mA + mB, sepA = mB / tm, sepB = mA / tm;
      if (S.spatial) { S.motion.sweep(at,{x:-nAx*overlap*sepA,y:-nAy*overlap*sepA,z:0}); S.motion.sweep(b,{x:nAx*overlap*sepB,y:nAy*overlap*sepB,z:0}); }
      else { at.x -= nAx * overlap * sepA; at.y -= nAy * overlap * sepA; b.x += nAx * overlap * sepB; b.y += nAy * overlap * sepB; }
      const vr = (at.vx - b.vx) * nAx + (at.vy - b.vy) * nAy;
      if (vr > 0) {
        const e = cfg.e != null ? cfg.e : .1, j = (1 + e) * vr * (mA * mB / tm);
        b.vx += nAx * j / mB; b.vy += nAy * j / mB; at.vx -= nAx * j / mA; at.vy -= nAy * j / mA;
        const lat = (at.vx - b.vx) * -nAy + (at.vy - b.vy) * nAx;
        b.om += clamp(lat * .018, -3.2, 3.2) * (hound ? 1 : 0) + (S.rr() - .5) * .3 * j * .004;                        // an off-centre hit spins the body
        if (S.contactT < 0 && j > 6) {
          S.contactT = t; S.phase = 'impact'; b.nx = nAx; b.ny = nAy; b.sqv += clamp(j * .06, 0, 9);
          shock(S, nAx, nAy, clamp(j * .12, 0, 34)); S.ev.push({ t, k: 'contact', j });
          for (const h of S.h) { h.vx += nAx * j * .28 + (S.rr() - .5) * 60; h.vy += nAy * j * .28 + (S.rr() - .5) * 60; }        // the hands are thrown, and spread
          const s = S.h[0], q = S.h[1]; const px = -nAy, py = nAx; s.vx -= px * j * .3; s.vy -= py * j * .3; q.vx += px * j * .3; q.vy += py * j * .3;
          if (S.exh >= 1 && hound && j > 130) S.hatKick = { x: nAx * j * .5 + px * 40, y: nAy * j * .5 + py * 40 };
        }
      }
    }
    at.contact = overlap > -2;

    /* ---------------- grip rope (the pull point) ---------------- */
    if (!S.rope && cfg.grip != null && t >= cfg.grip && hound) {
      const c = Math.cos(b.th), s = Math.sin(b.th), lx = (-nAx * RB * .8), ly = (-nAy * RB * .8);      // the point of the body nearest the hound, fixed in body space
      S.rope = { lx: lx * c + ly * s, ly: -lx * s + ly * c, k: cfg.drag ? 70 : 34, c: cfg.drag ? 13 : 9, stretch: 0 };
    }
    if (S.rope && (!S.spatial || spatialReach(S, b, at, 90))) {
      if(S.spatial){const dz=(at.z+9)-(b.z+9),fz=clamp(S.rope.k*dz+S.rope.c*(at.vz-b.vz),-420,420);b.vz+=fz*dt;at.vz-=fz/2.4*dt;}
      const c = Math.cos(b.th), s = Math.sin(b.th), gx = b.x + S.rope.lx * c - S.rope.ly * s, gy = b.y + S.rope.lx * s + S.rope.ly * c;
      const hx = at.x + Math.cos(at.a) * 14, hy = at.y + Math.sin(at.a) * 14;
      // the hound's grip sits on its jaw: a little ahead of its body toward the victim
      const jx = at.x + nAx * 16, jy = at.y + nAy * 16;
      let fx = S.rope.k * (jx - gx) - S.rope.c * (b.vx - at.vx) * -1 * 0, fy = S.rope.k * (jy - gy);
      const rvx = at.vx - b.vx, rvy = at.vy - b.vy; fx += S.rope.c * rvx; fy += S.rope.c * rvy;
      const st = hyp(jx - gx, jy - gy); S.rope.stretch = st;
      const fm = hyp(fx, fy), fmax = cfg.drag ? 760 : 420; if (fm > fmax) { fx *= fmax / fm; fy *= fmax / fm; }
      // a jaw holds; it does not pull a body through itself: the rope only acts when it is stretched
      if (st > (cfg.drag ? 2 : 6)) {
        b.vx += fx * dt; b.vy += fy * dt; b.om += ((gx - b.x) * fy - (gy - b.y) * fx) / 162 * dt;
        at.vx -= fx / 2.4 * dt; at.vy -= fy / 2.4 * dt;
      }
    }

    /* ---------------- victim forces ---------------- */
    // ground friction: Coulomb + viscous; a pinned / held body loses momentum much faster
    let mu = 560, visc = 1.15;
    if (cfg.pin && t > cfg.pin[0]) { visc += cfg.pin[1] * sm(cfg.pin[0], cfg.pin[0] + .35, t) * (1 - sm(cfg.tw || 9, (cfg.tw || 9) + .5, t)); mu += 260 * sm(cfg.pin[0], cfg.pin[0] + .35, t); }
    if (!hound && cfg.still != null) { const k = sm(0, cfg.still, t) * (1 - (cfg.draw ? sm(cfg.draw[0] - .45, cfg.draw[0] - .3, t) : 0)); visc += 9 * k; b.om -= b.om * 5 * k * dt; }
    const sp = hyp(b.vx, b.vy);
    if (!S.spatial && sp > 1e-3) { const dv = Math.min(sp, (mu * dt) * sp / (sp + 10) + (visc + (sp < 14 ? 7 : 0)) * sp * dt); b.vx -= b.vx / sp * dv; b.vy -= b.vy / sp * dv; }
    if (!S.spatial || b.supportId) b.om -= b.om * 2.1 * dt + Math.sign(b.om) * Math.min(Math.abs(b.om), 5.5 * dt * Math.abs(b.om) / (Math.abs(b.om) + .5));
    // the fight: torque and side-shoves that never repeat, growing weaker as the victim is overpowered
    if (res > .001) {
      const n1 = S.nz[0](t), n2 = S.nz[1](t), n3 = S.nz[2](t);
      const px = -nAy, py = nAx;
      b.om += res * (hound ? 15 : 3) * n1 * dt * 2.2;
      b.vx += (px * n2 * 200 * res - nAx * n3 * 60 * res) * dt; b.vy += (py * n2 * 200 * res - nAy * n3 * 60 * res) * dt;
      // resisting turns the body against the force: a torque toward facing the attacker with a shoulder
      const face = wrap(Math.atan2(-nAy, -nAx) + PI / 2 - b.th); b.om += clamp(face, -1.2, 1.2) * res * (hound ? 8 : 5) * dt;
    }
    // planted hands resist the pull
    for (let i = 0; i < 2; i++) { const h = S.h[i]; if (h.brace) { const dx = h.brace.x - b.x, dy = h.brace.y - b.y, d = hyp(dx, dy); if (d > 20) { const f = Math.min(300, 11 * (d - 20)) * (S.res > .05 ? 1 : .3); b.vx += dx / d * f * dt; b.vy += dy / d * f * dt; } } }
    // hits: each blow lands as a jolt in the direction it came from, then the body goes back to being pulled by everything else
    const hits = ctx.hits;
    while (S.hitsDone < hits.length && t >= hits[S.hitsDone]) {
      const k = S.hitsDone++, mag = hound ? (k === 0 ? 30 : 48) : 20;
      if (S.firstBlow < 0) S.firstBlow = t;
      b.vx += nAx * mag * (.6 + .4 * S.rr()); b.vy += nAy * mag * (.6 + .4 * S.rr()); b.om += (S.rr() - .5) * 5 * (hound ? 1 : .3); b.sqv += hound ? 3.5 : 1.4;
      S.h[k & 1].vx += (S.rr() - .5) * 220; S.h[k & 1].vy += (S.rr() - .5) * 220; at.bite = 1; S.ev.push({ t, k: 'hit', i: k });if(S.spatial){const face=groundRecord(S,b);if(face)addDecal(S,face,'hit:'+k);}
      shock(S, nAx, nAy, hound ? 9 : 4);
      if (k === 1 && cfg.eq === 'hit1') release(S, 'eq', t, { x: -nAy * 150 + nAx * 60, y: nAx * 150 + nAy * 60 });
      if (k === 2 && cfg.hat === 'hit2') release(S, 'hat', t, { x: nAx * 90, y: nAy * 90 });
    }
    at.bite *= Math.exp(-dt * 9);

    /* ---------------- variant specific forces ---------------- */
    if (cfg.wall && !S.launched && at.contact === false && t < .25 && S.contactT < 0) {
      // C: the hound is already at the victim's back when the capture starts; it does not need a run-up.  Give it the speed of a driving shove on the first step.
      S.launched = true; const kn = Math.max(0, ctx.kn), vwall = 190, v0 = Math.sqrt(vwall * vwall + 2 * 880 * kn), va = v0 / .66;
      at.vx = ux * va; at.vy = uy * va;
    }
    if (cfg.collapse && t > cfg.collapse[0]) {                                                     // the legs go: the body sags, turns to the side it leans toward and slides where it stands
      const k = sm(cfg.collapse[0], cfg.collapse[0] + cfg.collapse[1], t);
      b.csv += (k * (hound ? 1 : .8) - b.cs) * 46 * dt - b.csv * 9 * dt; b.cs += b.csv * dt;
      const side = S.nz[3](.3) > 0 ? 1 : -1; b.om += side * (hound ? 1.6 : 2.4) * k * (1 - k) * 4 * dt * 8 * Math.exp(-(t - cfg.collapse[0]) * 1.2) * (hound ? .6 : 1);
    }
    if (!hound && cfg.shove && !S.shoved && t >= cfg.shove[0]) { S.shoved = true; b.vx += ux * cfg.shove[1]; b.vy += uy * cfg.shove[1]; b.sqv += 2; S.ev.push({ t, k: 'shove' }); S.h.forEach(h => { h.vx += (S.rr() - .5) * 90; h.vy += (S.rr() - .5) * 90; }); }
    if (!hound && cfg.draw && t >= cfg.draw[0] - .02 && (!S.spatial || spatialReach(S,b,at,160))) {
      // it draws its prey in: after a held breath the pull comes on smoothly and carries the body past it
      if (!S.drawOn) { S.drawOn = t; S.phase = 'drawn'; S.ev.push({ t, k: 'draw' }); if (cfg.eq === 'draw') release(S, 'eq', t, { x: -uy * 40, y: ux * 40 }); }
      const win = cfg.draw[1] - cfg.draw[0], ph = clamp((t - cfg.draw[0]) / win, 0, 1), ramp = sm(0, .45, ph) * (1 - sm(.8, 1, ph));
      const tdx = at.x - b.x, tdy = at.y - b.y, td = hyp(tdx, tdy) || 1, want = ctx.drag / win * 1.7 * ramp;
      const f = mu * (hyp(b.vx, b.vy) > 4 ? 1 : 0) + 420 * ramp;
      b.vx += tdx / td * f * ramp * dt * (want > 4 ? 1 : 0); b.vy += tdy / td * f * ramp * dt * (want > 4 ? 1 : 0);
      if (td < 14) { b.vx *= Math.exp(-dt * 6); b.vy *= Math.exp(-dt * 6); }
    }
    if (cfg.collapse && !hound && cfg.eq === 'collapse' && t >= cfg.collapse[0] + .08) release(S, 'eq', t, { x: 0, y: 0 });
    if (cfg.eq === 'early' && t >= .3) release(S, 'eq', t, { x: nAx * 40, y: nAy * 40 });
    if (t >= 1.7 && S.eq.held && S.eq.has) release(S, 'eq', t, { x: nAx * 10, y: nAy * 10 });                      // whatever happens, the light does not stay in a dead hand

    /* ---------------- integrate the body ---------------- */
    let spatialHit=null;
    if(S.spatial) spatialHit=moveSpatial(S,b,{mu,visc,rest:hound?.16:.08,sleep:false});
    else {b.x += b.vx * dt; b.y += b.vy * dt;}
    b.th += b.om * dt;
    // squash: one short impulse that rings once and dies
    b.sqv += (-b.sq * 420 - b.sqv * 26) * dt; b.sq += b.sqv * dt; b.sq = clamp(b.sq, -.12, .30);
    const bo = { x: b.x, y: b.y, vx: b.vx, vy: b.vy }, hit = S.spatial ? spatialHit : collide(W, bo, RB, hound ? .16 : .08, .5);
    if (hit) {
      b.x = bo.x; b.y = bo.y; b.om += clamp(-hit.vt * .05, -2.5, 2.5) * (hit.nx * b.vy - hit.ny * b.vx > 0 ? 1 : -1) * .3;
      b.vx = bo.vx; b.vy = bo.vy;
      if (hit.sp > 60) {
        b.nx = -hit.nx; b.ny = -hit.ny; b.sqv += clamp(hit.sp * .028, 0, 8); shock(S, -hit.nx, -hit.ny, clamp(hit.sp * .05, 0, 26));
        if (!S.wallHit || hit.sp > S.wallHit.sp * .6 && t - S.wallHit.t > .25) { if (!S.wallHit) S.wallHit = { t, x: hit.x, y: hit.y, sp: hit.sp, nx: hit.nx, ny: hit.ny }; }
        S.trace.hit.push([hit.x, hit.y, t]); S.ev.push({ t, k: 'wall', sp: hit.sp });
        S.h.forEach(h => { h.vx += (b.vx * 0 - hit.nx * 0) + (-hit.nx) * hit.sp * .25; h.vy += (-hit.ny) * hit.sp * .25; });                    // the hands keep going
        if (cfg.eq === 'wall') release(S, 'eq', t, { x: -hit.nx * hit.sp * -.25, y: -hit.ny * hit.sp * -.25 });
        if (cfg.hat === 'wall') release(S, 'hat', t, { x: hit.nx * hit.sp * .3, y: hit.ny * hit.sp * .3 });
        if (S.phase === 'impact') S.phase = 'collision';
      }
    }
    // the attacker is a solid too
    if(S.spatial) moveSpatial(S,at,{mu:0,visc:0,rest:.05,sleep:false});
    else {const ao = { x: at.x, y: at.y, vx: at.vx, vy: at.vy }; collide(W, ao, RA - 4, .05, .2); at.x = ao.x; at.y = ao.y; at.vx = ao.vx; at.vy = ao.vy;
    at.x += at.vx * dt; at.y += at.vy * dt;} at.walk = (at.walk || 0) + hyp(at.vx, at.vy) * dt;
    // heading follows where it is looking (the victim) with its own inertia
    const wantA = Math.atan2(dy0, dx0) + (hound && at.bite > .1 ? Math.sin(t * 31) * .06 : 0), da = wrap(wantA - at.a); at.av += (da * 60 - at.av * 12) * dt; at.a += at.av * dt;
    S.pitch += ((hyp(at.vx, at.vy) / 400) - S.pitch) * Math.min(1, dt * 8);

    /* ---------------- hands ---------------- */
    const cth = Math.cos(b.th), sth = Math.sin(b.th);
    // where the body is pushed from, in body space
    const alx = -nAx * cth - nAy * sth, aly = nAx * sth - nAy * cth;                         // direction toward the attacker in the body's own frame
    for (let i = 0; i < 2; i++) {
      const h = S.h[i], side = i === 0 ? -1 : 1, nzx = S.nz[(i * 2) & 5](t * 1.1 + i * 3), nzy = S.nz[(i * 2 + 1) & 5](t * 1.3 + i * 5);
      let ox = 0, oy = 0, k = 380, dampingRatio = .55;
      const fight = res;
      if (fight > .02) {
        // pushes toward the attacker (opposite pushes from each hand at different times), reaching a different length each moment
        const lead = i === 0 ? sm(.05, .2, t) * (1 - sm(1.0, 1.5, t)) : sm(.3, .5, t);
        const reach = (14 + 10 * (.5 + .5 * nzx)) * fight * (0.5 + .5 * lead * 2);
        ox = alx * -reach * -1 + nzx * 6 * fight; oy = aly * reach * 1 + nzy * 6 * fight;
        ox = alx * reach + nzx * 7 * fight; oy = aly * reach + nzy * 7 * fight;
        k = 240 + 220 * fight;
      } else {
        // overpowered: they go slack and trail (weaker springs, out and slightly back)
        ox = side * 5 - (cth * 0) + nzx * 3; oy = 7 + nzy * 3; k = 90; dampingRatio = .7;
      }
      if (!hound && cfg.still != null && t < (cfg.draw ? cfg.draw[0] : 9)) { const q = sm(.05, cfg.still + .15, t); ox = ox * .4 - side * 5 * q; oy = oy * .4 + 3 * q; }         // the smiler: they tense inward and hold still
      if (S.contactT >= 0 && t - S.contactT < .5) { const q = Math.exp(-(t - S.contactT) * 7); ox += side * 11 * q; }                      // spread outward at the moment of impact
      h.off.x = ox; h.off.y = oy; h.k = k; h.dampingRatio = dampingRatio;
      // bracing on the floor while being pulled: plant, resist, slip
      const dragging = (S.dragOn && cfg.drag && t < cfg.drag[1]) || (S.drawOn && cfg.draw && t < cfg.draw[1]);
      if (dragging && (!S.spatial || h.stable) && !h.brace && res > .12 && t - h.slipT > (i === 0 ? .18 : .4) && h.tries < 3 && (i === 0 || S.slipCount >= 1 || t > (cfg.drag ? cfg.drag[0] : cfg.draw[0]) + .35)) {
        const bx = h.x - S.dragDir.x * 6, by = h.y - S.dragDir.y * 6; h.brace = S.spatial ? spatialBrace(S,h,bx,by,t) : { x: bx, y: by, t }; if(h.brace) h.tries++;
      }
      if (h.brace) {
        const dd = hyp(h.brace.x - b.x, h.brace.y - b.y), grip = 30 + 7 * res * (i ? .8 : 1.1) * 3;
        if (dd > grip || res < .06 || (S.spatial && (!h.stable || !spatialReach(S,b,h,40)))) { h.brace = null; h.slipT = t; S.slipCount++; S.ev.push({ t, k: 'slip', i }); }
      }
      // spring toward the anchor (in world space), damped against the body's own velocity at that point
      const lx = h.anc.x + h.off.x, ly = h.anc.y + h.off.y;
      let wx = b.x + lx * cth - ly * sth, wy = b.y + lx * sth + ly * cth, bvx = b.vx - b.om * (wy - b.y), bvy = b.vy + b.om * (wx - b.x);
      if (h.brace) { wx = h.brace.x; wy = h.brace.y; bvx = 0; bvy = 0; k = 620; }
      // reaching for the dropped light while there is fight left
      if (i === 1 && !S.eq.held && S.eq.has && cfg.collapse !== undefined && hound && t < 1.1 && res > .04 && (!S.spatial || spatialReach(S,b,S.eq,40))) { wx = S.eq.x; wy = S.eq.y; bvx = S.eq.vx; bvy = S.eq.vy; k = 200; }
      const cd = 2 * dampingRatio * Math.sqrt(k);
      h.vx += (k * (wx - h.x) - cd * (h.vx - bvx) - 1.1 * h.vx) * dt; h.vy += (k * (wy - h.y) - cd * (h.vy - bvy) - 1.1 * h.vy) * dt;
      if(S.spatial){
        const targetZ=h.brace?h.brace.z:b.z+5;
        h.vz+=(k*(targetZ-h.z)-cd*(h.vz-(h.brace?0:b.vz)))*dt;
        moveSpatial(S,h,{mu:h.brace?300:0,visc:0,rest:.1,sleep:false});
        constrainHand(S,h);continue;
      }
      h.x += h.vx * dt; h.y += h.vy * dt;
      // arms have a length: outward limit is hard, inward is the body
      const ddx = h.x - b.x, ddy = h.y - b.y, dd = hyp(ddx, ddy) || 1, mx = 40, mn = 13;
      if (dd > mx) { const nx = ddx / dd, ny = ddy / dd; h.x = b.x + nx * mx; h.y = b.y + ny * mx; const vn = h.vx * nx + h.vy * ny - (b.vx * nx + b.vy * ny); if (vn > 0) { h.vx -= nx * vn * 1.0; h.vy -= ny * vn * 1.0; } }
      else if (dd < mn) { h.x = b.x + ddx / dd * mn; h.y = b.y + ddy / dd * mn; }
      collide(W, h, 5, .1, .6);
    }
    // the hands cannot hold a light that is being wrenched away: it goes with the body's acceleration, then leaves
    const eq = S.eq;
    if (eq.has && eq.held) {
      const h = S.h[1]; if(S.spatial)attachSpatial(S,eq,{x:h.x,y:h.y,z:h.z+2});else{eq.x = h.x; eq.y = h.y; eq.vx = h.vx; eq.vy = h.vy;}
      const target = clamp(-(wrap(Math.atan2(h.y - b.y, h.x - b.x) - (b.th - PI / 2 + .74))) * .3, -.9, .9);       // the beam trails the hand
      eq.rhov += ((target - eq.rho) * 130 - eq.rhov * 16) * dt; eq.rho += eq.rhov * dt; eq.rot = b.th + eq.rho; eq.w = b.om + eq.rhov;
    } else if (eq.has) freeBody(S, eq, 7, .38, 250, 2.3, dt, 'eq');
    const ha = S.hat;
    if (ha.has && ha.on) { if(S.spatial)attachSpatial(S,ha,{x:b.x,y:b.y,z:b.z+20});else{ha.x = b.x; ha.y = b.y; ha.vx = b.vx; ha.vy = b.vy;} ha.rot = b.th; ha.w = b.om; if (S.hatKick && t > .12 && S.exh >= 1) { release(S, 'hat', t, S.hatKick); S.hatKick = null; } }
    else if (ha.has) freeBody(S, ha, 11, .3, 200, 2.6, dt, 'hat');

    /* ---------------- camera impulse ---------------- */
    const cm = S.cam; cm.vx += (-cm.x * 260 - cm.vx * 21) * dt; cm.vy += (-cm.y * 260 - cm.vy * 21) * dt; cm.x += cm.vx * dt; cm.y += cm.vy * dt;

    /* ---------------- bookkeeping ---------------- */
    S.t += dt; S.stepN++; if(S.spatial) S.t=S.stepN*DT;
    if ((S.stepN & 7) === 0) {
      const tr = S.trace; if (tr.b.length < 700) { tr.b.push([b.x, b.y]); tr.h0.push([S.h[0].x, S.h[0].y]); tr.h1.push([S.h[1].x, S.h[1].y]); tr.at.push([at.x, at.y]); if (eq.has) tr.eq.push([eq.x, eq.y]); }
      const last = S.trail[S.trail.length - 1];
      if ((!S.spatial || b.supportId) && S.firstBlow >= 0 && hyp(b.vx, b.vy) > 22 && (!last || hyp(last[0] - b.x, last[1] - b.y) > 9)) { S.trail.push([b.x, b.y]); if (S.trail.length > 60) S.trail.shift(); }
    }
    // active -> settling -> sleeping
    const moving = hyp(b.vx, b.vy) > 6 || Math.abs(b.om) > .25 || S.h.some(h => hyp(h.vx - b.vx, h.vy - b.vy) > 14) || (eq.has && !eq.held && eq.st !== 'SLEEPING') || (ha.has && !ha.on && ha.st !== 'SLEEPING') || Math.abs(b.sqv) > .3;
    if (moving) S.calm = 0; else S.calm += dt;
    S.state = S.spatial ? 'ACTIVE' : S.calm > .5 && t > (S.cfg.back ? S.cfg.back[1] : 1.6) ? 'SLEEPING' : S.calm > .12 ? 'SETTLING' : 'ACTIVE';
  }

  /* a loose object (the light, the hat): carries the momentum it had, slides, spins, hits walls, and stops */
  function freeBody(S, o, rad, rest, mu, wdamp, dt, name) {
    if(S.spatial){
      if(o.supportId)o.w-=o.w*wdamp*dt+Math.sign(o.w)*Math.min(Math.abs(o.w),1.8*dt);
      o.rot+=o.w*dt;moveSpatial(S,o,{rest,mu,visc:.5,sleep:true});return;
    }
    if (o.st === 'SLEEPING') return;
    const sp = hyp(o.vx, o.vy);
    if (sp > 1e-3) { const dv = Math.min(sp, mu * dt * sp / (sp + 8) + .5 * sp * dt); o.vx -= o.vx / sp * dv; o.vy -= o.vy / sp * dv; }
    o.w -= o.w * wdamp * dt + Math.sign(o.w) * Math.min(Math.abs(o.w), 1.8 * dt);
    o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.w * dt;
    const hit = collide(S.walls, o, rad, rest, .6);
    if (hit) { o.w += clamp(hit.vt * .08, -6, 6) * (Math.sign(o.w) || 1) * .5 + (S.rr() - .5) * hit.sp * .02; S.ev.push({ t: S.t, k: name + 'hit', sp: hit.sp }); }
    if (hyp(o.vx, o.vy) < 3.5 && Math.abs(o.w) < .35) { o.still += dt; o.st = 'SETTLING'; if (o.still > .3) { o.st = 'SLEEPING'; o.vx = o.vy = o.w = 0; } } else { o.still = 0; o.st = 'ACTIVE'; }
  }

  function advance(S, t) { let n = 0; while ((!S.spatial||S.state!=='SLEEPING') && S.t + DT <= t + 1e-9 && n < 4000) { stepOnce(S); n++; } return S; }

  /* everything the renderer wants, in the frames it wants it (hands in body space: the avatar draws them as children) */
  function pose(S) {
    const b = S.b, c = Math.cos(b.th), s = Math.sin(b.th), out = S.out || (S.out = { hands: [{ x: 0, y: 0 }, { x: 0, y: 0 }], sx: 1, sy: 1 });
    for (let i = 0; i < 2; i++) { const h = S.h[i], dx = h.x - b.x, dy = h.y - b.y; out.hands[i].x = dx * c + dy * s; out.hands[i].y = -dx * s + dy * c; }
    // squash along the impact axis (in body space), perpendicular bulge; plus the collapse
    const lx = b.nx * c + b.ny * s, ly = -b.nx * s + b.ny * c, q = b.sq;
    out.sx = 1 - q * lx * lx + q * .55 * ly * ly + b.cs * .2; out.sy = 1 - q * ly * ly + q * .55 * lx * lx - b.cs * .22;
    return out;
  }


  /* ---------- the death class (in the bundle) hands its frames to this ---------- */
  const hsh = (x, y, c) => { let h = 2166136261; for (const v of [Math.round(x), Math.round(y), c.charCodeAt(0)]) { h ^= v & 0xffff; h = Math.imul(h, 16777619); } return h >>> 0; };
  const DURS = { Hound: { A: 4.5, B: 4.7, C: 4.3, D: 4.5 }, Smiler: { A: 3.95, B: 3.85, C: 3.95, D: 3.95 } };
  /* called from Jl.start: builds the simulation for this death (or returns null and the old scripted death plays) */
  function begin(jl, plan, opt) {
    try {
      const walls = window.__api && window.__api.Bc; if (!walls) return null;
      const v = plan && plan.v || 'A', kind = jl.kind === 'Smiler' ? 'Smiler' : 'Hound';
      const vic = jl.victim, hat = opt.hat || 'none';
      const S = create({ kind, v, victim: { x: vic.x, y: vic.y, angle: vic.angle, vx: opt.vx || 0, vy: opt.vy || 0 }, src: { x: jl.source.x, y: jl.source.y }, dir: jl.angle,
        hits: jl.hits || [.24, .74, 1.2, 1.7], kn: jl.knock, drag: jl.drag, seed: hsh(vic.x, vic.y, v + kind), exhausted: !!opt.exhausted, eqKind: opt.eqKind || 'flashlight', hat, walls, dur: (DURS[kind] || DURS.Hound)[v] || 4.4 });
      return S;
    } catch (e) { console.error('dphys', e); return null; }
  }
  /* the numbers of each death variant: how far the body is knocked (kn), dragged (dr), when the blows land (hits) and the bundle's timing knobs.
   * One table, read by the bundle's death class (through ents.deathPlan) and by the server's fallback aftermath (simulate below). */
  function PLAN(kind, v, wallDist) {
    const P = { v, kn: 34, dr: kind === 'Hound' ? 128 : 86, hits: null, kt: [.08, .36], dw: [2.03, 3.12], spin: 1.65, squish: 1 };
    if (kind === 'Hound') {
      if (v === 'A') { P.kn = 46; P.dr = 40; P.hits = [.2, .62, 1.05, 1.55]; P.spin = 1.9; }
      else if (v === 'B') { P.kn = 12; P.dr = 140; P.hits = [.3, .85, 1.5, 2.1]; P.dw = [.9, 2.2]; P.spin = 1.2; }
      else if (v === 'C') { P.kn = clamp((wallDist ?? 40) - 17, 0, 110); P.dr = 0; P.kt = [.04, .2]; P.hits = [.2, .21, .8, 1.4]; P.spin = 2.2; }
      else { P.kn = 24; P.dr = 26; P.hits = [.45, .95, 1.55]; P.spin = .3; P.squish = 1.9; }
    } else {
      if (v === 'B') { P.kn = 0; P.dr = 0; P.hits = [.7, 1.2, 1.7]; P.spin = 1.4; }
      else if (v === 'C') { P.kn = 18; P.dr = 36; P.hits = [.55, 1.1, 1.6]; }
      else if (v === 'D') { P.kn = 26; P.dr = 70; P.hits = [.6, 1.2, 1.8]; P.dw = [1.6, 3.0]; }
    }
    return P;
  }
  /* the whole death, start to rest, without a screen: the same inputs the death class gives begin(), the same knock / drag limits
   * (the bundle's safeDistance: 4 px steps while a 22 px circle is clear), the same seed.  Used by the server when a victim's own client
   * never reports its corpse (it disconnected): the aftermath is this simulation's last frame, as it would have been on the victim's screen. */
  function simulate(o) {
    const kind = o.kind === 'Smiler' ? 'Smiler' : 'Hound', v = /^[ABCD]$/.test(o.v) ? o.v : 'A', vic = o.victim, src = o.src;
    const wall = o.w && o.w.length === 3 ? { x: o.w[0], y: o.w[1], ang: o.w[2] } : null;
    const P = PLAN(kind, v, wall ? hyp(wall.x - vic.x, wall.y - vic.y) : 40), ang = Math.atan2(vic.y - src.y, vic.x - src.x);
    const safe = (p, a, n) => { let r = 0; for (let i = 4; i <= n && o.clear(p.x + Math.cos(a) * i, p.y + Math.sin(a) * i, 22); i += 4) r = i; return r; };
    const knock = safe(vic, ang, P.kn), i0 = { x: vic.x + Math.cos(ang) * knock, y: vic.y + Math.sin(ang) * knock }, drag = safe(i0, ang + PI, P.dr);
    const dur = (DURS[kind] || DURS.Hound)[v] || 4.4;
    const S = create({ kind, v, victim: { x: vic.x, y: vic.y, angle: vic.angle, vx: o.vx || 0, vy: o.vy || 0 }, src: { x: src.x, y: src.y }, dir: ang,
      hits: P.hits || [.24, .74, 1.2, 1.7], kn: knock, drag, seed: hsh(vic.x, vic.y, v + kind), exhausted: !!o.exhausted, eqKind: o.eqKind || 'flashlight', hat: o.hat || 'none', walls: o.walls, dur });
    const bursts = []; let evi = 0;
    for (let t = 0; t <= dur + 1e-9; t = Math.min(dur, t + 1 / 60)) {        // the frames a screen would have drawn: blood lands where the jaws are at each blow
      advance(S, t);
      while (evi < S.ev.length) { const q = S.ev[evi++]; if (q.k === 'hit') { const dx = S.at.x - S.b.x, dy = S.at.y - S.b.y, d = hyp(dx, dy) || 1; bursts.push({ x: S.b.x + dx / d * 9, y: S.b.y + dy / d * 9, seed: q.i }); } }
      if (t >= dur) break;
    }
    const pz = pose(S);
    return { S, kind, v, angle: ang, dur, body: { x: S.b.x, y: S.b.y, angle: S.b.th, scaleX: pz.sx, scaleY: pz.sy }, attacker: { x: S.at.x, y: S.at.y, angle: S.at.a }, bursts, remains: remains({ ph: S }) };
  }
  const lab = () => window.__dlab;
  /* the death's own clock: real time, or - for the admin's death lab - slowed, paused or stepped */
  function clock(jl, e) {
    const L = lab(); if (!L || !L.on) { jl.__lab = null; return Math.max(0, e - jl.startAt); }
    const c = jl.__lab || (jl.__lab = { last: e, t: Math.max(0, e - jl.startAt) });
    const dt = Math.max(0, Math.min(.1, e - c.last)); c.last = e;
    if (L.step > 0) { c.t += L.step / 60; L.step = 0; } else if (!L.paused) c.t += dt * (L.speed || 1);
    return c.t;
  }
  function frame(jl, t) {
    const S = jl.ph; advance(S, t);
    const b = S.b, pz = pose(S), cfg = S.cfg, hits = jl.hits || [];
    let im = 0; for (let i = 0; i < hits.length; i++) if (t >= hits[i]) im += Math.exp(-(t - hits[i]) * 18);
    if (S.contactT >= 0 && t >= S.contactT) im += .9 * Math.exp(-(t - S.contactT) * 16);
    if (S.wallHit && t >= S.wallHit.t) im += clamp(S.wallHit.sp / 300, .3, 1.1) * Math.exp(-(t - S.wallHit.t) * 15);
    jl.impact = Math.min(2, im); jl.injury = sm(.2, 1.82, t); jl.grip = sm(.15, .4, t); jl.shake = 0;
    jl.body.x = b.x; jl.body.y = b.y; jl.body.angle = b.th; jl.body.scaleX = pz.sx; jl.body.scaleY = pz.sy;
    jl.body.alpha = jl.kind === 'Smiler' ? 1 - .65 * sm(cfg.draw ? cfg.draw[0] + .1 : 1.8, cfg.draw ? cfg.draw[1] - .3 : 2.35, t) * (1 - sm(cfg.draw ? cfg.draw[1] + .4 : 2.6, cfg.draw ? cfg.draw[1] + .9 : 3.1, t)) : 1;
    jl.attacker.x = S.at.x; jl.attacker.y = S.at.y; jl.attacker.angle = S.at.a; jl.hands = pz.hands;
    const e = S.eq, hd = S.hat, hl = S.ctx.eqKind === 'headlamp';
    if (hl) { jl.torch.x = b.x; jl.torch.y = b.y; jl.torch.angle = b.th - PI / 2; }
    else { const bang = e.rot - PI / 2; jl.torch.x = e.x + Math.cos(bang) * e.len; jl.torch.y = e.y + Math.sin(bang) * e.len; jl.torch.angle = bang; }
    if (jl.dEq) { jl.dEq.visible = e.has && !e.held; jl.dEq.position.set(e.x, e.y); jl.dEq.rotation = e.rot; }
    if (jl.dHat) { jl.dHat.visible = hd.has && !hd.on; jl.dHat.position.set(hd.x, hd.y); jl.dHat.rotation = hd.rot; }
    jl.debris.visible = true; jl.gearHeld = e.held || hl; jl.hatOn = hd.on || !hd.has; jl.rho = e.rho; jl.trail = S.trail;
    // the blows: blood appears where the jaws are, at the moment of the blow
    while ((jl.evi | 0) < S.ev.length) {
      const q = S.ev[jl.evi | 0]; jl.evi = (jl.evi | 0) + 1;
      if (q.k === 'hit') { const dx = S.at.x - b.x, dy = S.at.y - b.y, d = hyp(dx, dy) || 1; jl.bursts.push({ x: b.x + dx / d * 9, y: b.y + dy / d * 9, at: q.t, seed: q.i }); jl.nextHit = q.i + 1; }
    }
    jl.black = jl.blackFn ? jl.blackFn(t) : 0;
    jl.drawBlood(t); jl.drawShadow(t);
    jl.foreground.alpha = 1 - sm(2.65, 3.2, t); jl.shade = sm(jl.duration - .75, jl.duration, t); jl.phase = S.phase; jl.settle = S.state;
    return jl.finished = t >= jl.duration;
  }
  /* the corpse is the last configuration of this same simulation */
  function remains(jl) {
    const S = jl.ph; if (!S) return null; const pz = pose(S), e = S.eq, hd = S.hat;
    return { hands: pz.hands.map(h => [+h.x.toFixed(1), +h.y.toFixed(1)]), dropped: { x: e.has ? e.x : S.b.x, y: e.has ? e.y : S.b.y, angle: e.has ? e.rot : S.b.th },
      hat: { x: hd.x, y: hd.y, angle: hd.rot }, hatOn: hd.on ? 1 : 0, trail: S.trail.slice(-24).map(p => [Math.round(p[0]), Math.round(p[1])]), held: e.held ? 1 : 0 };
  }

  window.__dphys = { create, advance, tick, pose, snapshot, save, restore, rebindGeometry, fromEvent, seedFor:hsh, CFG, begin, frame, clock, remains, PLAN, simulate, DURS, SPATIAL_VERSION };
})();
