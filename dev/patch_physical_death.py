"""Apply the readable physics hooks to the unmodified v16(2) compiled renderer.

Run once against the baseline. Every replacement asserts its exact anchor count;
on a different Claude build merge these small hooks into the equivalent methods.
The actual animation implementation lives in ../death-motion.js.
"""
from pathlib import Path
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
p = root / 'assets/index-DKbV5Nv9.js'
s = p.read_text()

def replace(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:100], s.count(old), count)
    s = s.replace(old, new)

replace('this.createDebris()}reset(){this.active=!1',
        'this.createDebris();if(window.__deathMotion)window.__deathMotion.begin(this,H,K)}reset(){this.motion=null;this.physicalPose=null;this.active=!1')
replace('frame(e){if(!this.active)return!1;let t=this.elapsed=Math.max(0,e-this.startAt),n=this.direction',
        'frame(e){if(this.motion&&window.__deathMotion)return window.__deathMotion.frame(this,e);if(!this.active)return!1;let t=this.elapsed=Math.max(0,e-this.startAt),n=this.direction')
replace('deathPose(e,t,n){if(this.hat.visible=',
        'deathPose(e,t,n,p=null){if(p&&window.__deathMotion){window.__deathMotion.applyAvatar(this,p);this.wounds.clear();if(e>.2&&window.__gore)window.__gore.wounds(this.wounds,Math.min(1,e),p.seed,this.__cause||window.__lastCause);return}if(this.hat.visible=')
replace('this.person.deathPose(i.injury,i.impact,i.elapsed>.24)',
        'this.person.deathPose(i.injury,i.impact,i.elapsed>.24,i.physicalPose)')
replace('dropped:{...t.torch},hat:{x:t.victim.x+Math.cos(t.angle+1.2)*40,y:t.victim.y+Math.sin(t.angle+1.2)*40,angle:t.angle+1.8},lo:au?1:0,variant:t.variant',
        'dropped:{...t.torch},hat:t.physicalHat?{...t.physicalHat}:{x:t.victim.x+Math.cos(t.angle+1.2)*40,y:t.victim.y+Math.sin(t.angle+1.2)*40,angle:t.angle+1.8},pose:t.physicalPose,lo:au?1:0,variant:t.variant')
replace('i.__key=t.id,i.update(0,!1),i.deathPose(1,0,!0)',
        'i.__key=t.pose?t.pose.seed:t.id,i.update(0,!1),i.deathPose(1,0,!0,t.pose)')
replace('i.tint=t.cause===`Smiler`?10192261:13152676',
        'i.tint=t.pose?16777215:t.cause===`Smiler`?10192261:13152676')
# Both Vanish and death draw loose gear here; only physical corpses use the
# actual world-facing beam convention. Legacy records retain their old rendering.
replace('e.rotation=t.dropped.angle,this.addChild(e)',
        'e.rotation=t.dropped.angle+(t.pose?Math.PI/2:0),this.addChild(e)', count=2)
replace('if(t.appearance.hat!==`none`){let e=t.appearance.hat===`hardhat`?',
        'if(t.appearance.hat!==`none`){if(t.pose){let h=i.hat.children[0].clone(!0);h.position.set(t.hat.x,t.hat.y);h.rotation=t.hat.angle;this.addChild(h)}else{let e=t.appearance.hat===`hardhat`?')
replace('n.rotation=t.hat.angle,this.addChild(n)}}},tu=class',
        'n.rotation=t.hat.angle,this.addChild(n)}}}},tu=class')
replace('window.__api={bodyList:()=>Yl,death:()=>X.death,',
        'window.__api={bodyList:()=>Yl,avatar:()=>X.person,mkCorpse:e=>new eu(e),death:()=>X.death,')
p.write_text(s)
print('Applied checked renderer hooks')
