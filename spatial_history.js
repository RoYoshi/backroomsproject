/* One spatial presentation sampler. It never mutates simulation or chooses a floor. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./spatial_protocol'),require('./world_motion'));else root.TFB_HISTORY=factory(root.TFB_PROTOCOL,root.TFB_MOTION);})(typeof self!=='undefined'?self:this,function(P,M){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const angle=(a,b,u)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;
class History {
 constructor(geometry,onReset=()=>{}){this.g=geometry;this.motion=M.create(geometry);this.vaultAdapter=M.motorAdapter(geometry);this.onReset=onReset;this.reset(null);}
 reset(epoch){this.epoch=epoch;this.hist=new Map();this.generations=new Map();this.offset=null;this.lastTick=-1;this.onReset();}
 world(manifest){if(manifest.worldEpoch!==this.epoch)this.reset(manifest.worldEpoch);}
 ingest(poses,nowMs){for(const p of poses){if(!P.validPose(p)||p.worldEpoch!==this.epoch)continue;const prior=this.generations.get(p.entityId);if(prior!=null&&p.generation<prior)continue;
   const key=p.entityId;let h=this.hist.get(key);if(prior!==p.generation||h?.at(-1).discontinuity<p.discontinuity){this.hist.delete(key);this.generations.set(key,p.generation);h=null;this.onReset(key);}
   if(h&&(p.discontinuity!==h.at(-1).discontinuity||p.tick<=h.at(-1).tick))continue;
   if(!h)this.hist.set(key,h=[]);h.push(clone(p));if(h.length>8)h.shift();
   if(p.tick>this.lastTick){const off=p.tick/60-nowMs/1000;this.offset=this.offset===null||off>this.offset?off:this.offset-Math.min(.02,this.offset-off)*.05;this.lastTick=p.tick;}
  }for(const [key,h]of this.hist)if(this.lastTick-h.at(-1).tick>300){this.hist.delete(key);this.generations.delete(key);}}
 shape(p){return Object.values(M.PROFILES).find(s=>s.id===p.profile)||Object.values(M.ENTITY_PROFILES).find(s=>s.id===p.profile)||Object.values(M.DEATH_PROFILES).find(s=>s.id===p.profile)||null;}
 valid(p,shape){return shape&&this.g.clearance(shape,p).fits;}
 supported(a,b,u){const shape=this.shape(a);if(!shape||a.profile!==b.profile||a.navSurface!==b.navSurface)return null;
  const target={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u},range=Math.hypot(target.x-a.x,target.y-a.y)*Math.tan(shape.maxSlopeDegrees*Math.PI/180)+.11;
  const supports=this.g.supports(shape,target,[a.z-range,a.z+range],a.support).filter(s=>s.navSurfaceId===a.navSurface);
  for(const s of supports){const q={...target,z:s.z+M.POLICY.skin,supportId:s.id,navSurfaceId:s.navSurfaceId};const path=this.g.traceSupportMotion({...a,supportId:a.support,navSurfaceId:a.navSurface},[q],shape);if(path.ok)return {...a,...q,support:s.id,yaw:angle(a.yaw,b.yaw,u)};}
  return null;
 }
 physical(a,b,u){const shape=this.shape(a);if(!shape||a.profile!==b.profile)return null;
  // The starting snapshot contains physical transition state. Reconstruct through
  // the same fixed-tick kernel, including first landing/contact. Missing state holds.
  let body;try{body=this.motion.initialize({...a},'stand',shape);}catch{return null;}
  body.supportId=a.support;body.motionMode=a.mode;body.step=a.step?clone(a.step):null;
  if(a.mode==='step'&&!body.step)return null;
  let traversal=null;if(a.link&&!a.vault){const link=this.g.definition.traversalLinks.find(l=>l.id===a.link);if(!link||!a.traversal)return null;traversal={...clone(a.traversal),link};}
  let vault=a.vault?clone(a.vault):null;
  const n=b.tick-a.tick;if(n<=0||n>90)return null;const poses=[{...a}];
  for(let i=0;i<n;i++){if(vault){vault.t=Math.min(vault.dur,vault.t+M.POLICY.dt);if(!this.vaultAdapter.vault(body,vault,vault.t/vault.dur,M.POLICY.dt))return null;if(vault.t>=vault.dur-1e-8){body.vx=vault.nx*vault.exitSpeed;body.vy=vault.ny*vault.exitSpeed;body.vz=0;vault=null;}}else if(traversal){const target=traversal.link.corridor[Math.min(traversal.segment,traversal.link.corridor.length-1)],dx=target.x-body.x,dy=target.y-body.y,d=Math.hypot(dx,dy),v=Math.min(a.traversal.speed||172,d*60);if(d<1.8&&traversal.segment<traversal.link.corridor.length-1)traversal.segment++;this.motion.advanceTraversal(body,traversal,{x:d?dx/d*v:0,y:d?dy/d*v:0});}else this.motion.step(body);if(!this.valid(body,shape)||body.diagnostics.length)return null;poses.push({...body});}
  if(Math.hypot(body.x-b.x,body.y-b.y,body.z-b.z)>.2)return null;
  const t=Math.min(n,u*n),i=Math.min(n-1,Math.floor(t)),v=t-i,x=poses[i],y=poses[i+1],q={...a,x:x.x+(y.x-x.x)*v,y:x.y+(y.y-x.y)*v,z:x.z+(y.z-x.z)*v,yaw:angle(a.yaw,b.yaw,u)};
  const hit=this.g.sweep(shape,x,{x:q.x-x.x,y:q.y-x.y,z:q.z-x.z},'collision',0);return this.valid(q,shape)&&(!hit||hit.t>=1-1e-5)?q:null;
 }
 at(key,tick){const h=this.hist.get(key);if(!h?.length)return null;if(tick<=h[0].tick)return {...h[0]};
  for(let i=1;i<h.length;i++){const a=h[i-1],b=h[i];if(tick>b.tick)continue;if(tick===b.tick)return {...b};const u=(tick-a.tick)/(b.tick-a.tick);
   if(a.discontinuity!==b.discontinuity||a.generation!==b.generation)return {...a};
   if(a.death){const shape=this.shape(a);const q={...a,x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u,yaw:angle(a.yaw,b.yaw,u)};const hit=shape&&this.g.sweep(shape,a,{x:q.x-a.x,y:q.y-a.y,z:q.z-a.z},'collision',0);return a.death===b.death&&shape&&a.support===b.support&&this.valid(q,shape)&&(!hit||hit.t>=1-1e-5)?q:{...a};}
   const q=a.mode==='grounded'&&b.mode==='grounded'&&!a.link&&!b.link?this.supported(a,b,u):this.physical(a,b,u);return q||{...a};
  }
  const b=h.at(-1),dt=Math.min(P.LIMIT.extrapolate,Math.max(0,(tick-b.tick)/60));if(b.death||b.mode!=='grounded'||b.link)return {...b};
  // Unknown edge departure is a hold. No fabricated fall, hover or floor choice.
  return this.supported(b,{...b,x:b.x+b.vx*dt,y:b.y+b.vy*dt},1)||{...b};
 }
 sample(key,nowMs){return this.at(key,(nowMs/1000+(this.offset||0)-P.LIMIT.delay)*60);}
}
return Object.freeze({History});
});
