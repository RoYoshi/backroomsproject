/* (lineage B10, B11; owner P.O.C.K.E.T.) The light equipment: a flashlight, a headlamp (v11's chestlamp), a lantern (v11's torch) and a
 * camcorder, each with parts the player colours (LIGHT_PARTS). */
export type LightKind='flashlight'|'headlamp'|'lantern'|'camcorder';
export type LightParts=Record<string,string>;
export type LightEquipment={kind:LightKind;color:string;parts?:Record<string,LightParts>};
export const DEFAULT_LIGHT:LightEquipment={kind:'flashlight',color:'#ffe7b2'};
/* each kind's parts: [id, the label the loadout shows, the default colour] (B10; the headlamp, lantern and camcorder sets B11) */
export const LIGHT_PARTS:Record<LightKind,[string,string,string][]>={
 flashlight:[['body','Body','#3b4650'],['head','Head','#a1a9b0'],['button','Button','#d8443a'],['grip','Grip','#181b1e']],
 headlamp:[['strap','Strap','#2d3b46'],['housing','Housing','#3a4054'],['bracket','Bracket','#9a9ea6']],
 lantern:[['frame','Frame','#3d423c'],['handle','Handle','#9aa0a6'],['cap','Cap','#a3372c']],
 camcorder:[['body','Body','#2b2f36'],['lens','Lens ring','#69717c'],['grip','Grip','#1b1d20'],['trim','Trim','#c9ccd0']]
};
const HEX=/^#[0-9a-f]{6}$/i;
/* (B11) a light saved before the rename keeps working: chestlamp is the headlamp, torch the lantern */
export const migrateKind=(kind:unknown):unknown=>({chestlamp:'headlamp',torch:'lantern'} as Record<string,unknown>)[kind as string]||kind;
type SavedLight={parts?:Record<string,Record<string,unknown>|undefined>}|null|undefined;
/* one kind's part colours from a saved light, each a valid #rrggbb or the default (B10) */
export function partsFor(saved:SavedLight,kind:LightKind):LightParts{
 const out:LightParts={};
 for(const [id,,fallback] of LIGHT_PARTS[kind]){const v=saved&&saved.parts&&saved.parts[kind]&&saved.parts[kind]![id];out[id]=typeof v==='string'&&HEX.test(v)?v:fallback;}
 return out;
}
// Base gear leaves room for a future powerbulb upgrade. These are gameplay values. (B11: the four kinds' reach and spread)
/* a light's reach (range, px), spread (arc, rad), strength (power), spill; omni: all around; nv: night vision, no light (the camcorder) */
export type LightSpec={readonly label:string;readonly range:number;readonly arc:number;readonly power:number;readonly spill:number;readonly omni:boolean;readonly nv?:boolean};
export const LIGHT_SPECS:Record<LightKind,LightSpec>={
 flashlight:{label:'Flashlight',range:390,arc:.92,power:.58,spill:56,omni:false},
 headlamp:{label:'Headlamp',range:262,arc:1.95,power:.5,spill:82,omni:false},
 lantern:{label:'Lantern',range:228,arc:Math.PI*2,power:.5,spill:200,omni:true},
 camcorder:{label:'Camcorder',range:1,arc:.1,power:0,spill:1,omni:false,nv:true}
};
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function carriedLightAt(source:{x:number;y:number;angle:number;equipment?:LightEquipment},target:{x:number;y:number},on:boolean){
 if(!on)return 0;const spec=LIGHT_SPECS[source.equipment?.kind??'flashlight'];
 const dx=target.x-source.x,dy=target.y-source.y,d=Math.hypot(dx,dy);
 const a=Math.atan2(dy,dx)-source.angle,offset=Math.abs(Math.atan2(Math.sin(a),Math.cos(a)));
 const angular=spec.omni?1:1-smooth(spec.arc*.11,spec.arc*.5,offset);
 return spec.power*(1-smooth(24,spec.range,d))*Math.max(angular,(1-smooth(10,spec.spill,d))*.4);
}
/* a saved light, checked: its kind (an old name migrated), its colour, and every kind's part colours (B10, B11; a headlamp saved
 * before the rename keeps the chestlamp's part colours) */
export function validLight(value:unknown):LightEquipment&{parts:Record<string,LightParts>}{
 const v=(value&&typeof value==='object'?value:{}) as {kind?:unknown;color?:unknown;parts?:Record<string,Record<string,unknown>|undefined>};
 const out={kind:migrateKind(v.kind)&&['flashlight','headlamp','lantern','camcorder'].includes(migrateKind(v.kind) as string)?migrateKind(v.kind) as LightKind:'flashlight' as LightKind,color:typeof v.color==='string'&&/^#[0-9a-f]{6}$/i.test(v.color)?v.color:DEFAULT_LIGHT.color,parts:{} as Record<string,LightParts>};
 for(const kind of Object.keys(LIGHT_PARTS) as LightKind[])out.parts[kind]=partsFor(v.parts&&kind==='headlamp'&&!v.parts.headlamp&&v.parts.chestlamp?{parts:{headlamp:v.parts.chestlamp}}:v,kind);
 return out;
}
