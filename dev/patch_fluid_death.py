"""Checked incremental renderer hooks: v16 Codex physical -> fluid motion.
The full distribution is already patched. Review/merge these hooks on other builds.
"""
from pathlib import Path
import sys
root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
p = root / 'assets/index-DKbV5Nv9.js'
s = p.read_text()
def sub(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:100], s.count(a), n)
    s = s.replace(a, b)
sub('attackPose(e,t,v){this.alpha=1,window.__ents&&window.__ents.attackHound(this,e,t,v)}',
    'attackPose(e,t,v,d=null){this.alpha=1,window.__ents&&window.__ents.attackHound(this,e,t,v,d)}')
sub('this.entityView.attackPose(i.grip,i.impact,i.variant)', 'this.entityView.attackPose(i.grip,i.impact,i.variant,i)')
sub('Math.min(1,e),p.seed,this.__cause', 'Math.min(1,e)*(p.v===2?.55:1),p.seed,this.__cause')
sub('blood:t.bursts.map(e=>({x:e.x,y:e.y,seed:e.seed})),dropped:{...t.torch}',
    'blood:t.bursts.map(e=>({x:e.x,y:e.y,seed:e.seed,at:e.at,angle:e.angle})),dropped:{...(t.equipmentTransform||t.torch)}')
sub('if(t.appearance.hat!==`none`){if(t.pose)', 'if(t.appearance.hat!==`none`&&(!t.pose||t.pose.hd)){if(t.pose)')
sub('let i=new $c(t.appearance,t.equipment);if(i.__cause=t.cause,i.__key=',
    'let adopted=window.__deathMotion&&window.__deathMotion.takeCorpse(t.ownerId),i=adopted||new $c(t.appearance,t.equipment);if(i.__cause=t.cause,i.__key=')
sub('i.update(0,!1),i.deathPose(1,0,!0,t.pose)', 'adopted||(i.update(0,!1),i.deathPose(1,0,!0,t.pose))')
sub('if(!t.finished||t.corpseId)return;t.corpseId=Ql(', 'if(!t.finished||t.corpseId)return;let donor=this.person;t.corpseId=Ql(')
sub('variant:t.variant}).id;let n=t.attackerIndex',
    'variant:t.variant}).id;if(t.physicalPose?.v===2&&donor){window.__deathMotion.registerCorpse(H.id,donor);this.person=new $c(U,H.equipment);this.creatures.addChild(this.person);this.person.visible=!1}let n=t.attackerIndex')
sub('i.active?Math.sin(r*97)*i.shake:0', 'i.active?(i.cameraX??Math.sin(r*97)*i.shake):0')
sub('i.active?Math.cos(r*113)*i.shake*.7:0', 'i.active?(i.cameraY??Math.cos(r*113)*i.shake*.7):0')
sub('this.baseScale*(i.active?1.4:1)', 'this.baseScale*(i.active?(i.physicalPose?.v===2?1.08:1.4):1)')
sub('avatar:()=>X.person,mkCorpse:e=>new eu(e),',
    'avatar:()=>X.person,scene:()=>X,corpseViews:()=>X.corpseViews,replaceEntity:(kind,slot,view)=>{let list=kind===`Hound`?X.hv:Kl,old=list[slot];if(!old)return!1;let p=old.parent,at=p?p.getChildIndex(old):0;if(p){p.removeChild(old);p.addChildAt(view,at)}old.destroy({children:!0});list[slot]=view;if(kind===`Smiler`)view.smiler=q[slot];return!0},mkCorpse:e=>new eu(e),')
# Avoid rendering a second local avatar over the transferred corpse.
sub('this.person.alpha=1,this.person.scale.set(1),Ff(this,r)', 'this.person.visible=!i.corpseId,this.person.alpha=1,this.person.scale.set(1),Ff(this,r)')
sub('t.visible=(e.id!==i.corpseId||!i.active)', 't.visible=(e.id!==i.corpseId||!i.active||e.pose?.v===2)')
sub('let hs=window.__hideSelf,pr=o.person;', 'let hs=window.__hideSelf||(o.death.physicalPose?.v===2&&o.death.corpseId),pr=o.person;')
p.write_text(s)
print('Applied fluid motion renderer hooks')
