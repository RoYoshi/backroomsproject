export type LightKind='flashlight'|'chestlamp'|'torch';
export type LightEquipment={kind:LightKind;color:string};
export const DEFAULT_LIGHT:LightEquipment={kind:'flashlight',color:'#ffe7b2'};
// Base gear leaves room for a future powerbulb upgrade. These are gameplay values.
export const LIGHT_SPECS={
 flashlight:{label:'Flashlight',range:340,arc:1.0,power:.56,spill:62,omni:false},
 chestlamp:{label:'Chestlamp',range:245,arc:1.65,power:.48,spill:72,omni:false},
 torch:{label:'Torch',range:175,arc:Math.PI*2,power:.49,spill:175,omni:true}
} as const;
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function carriedLightAt(source:{x:number;y:number;angle:number;equipment?:LightEquipment},target:{x:number;y:number},on:boolean){
 if(!on)return 0;const spec=LIGHT_SPECS[source.equipment?.kind??'flashlight'];
 const dx=target.x-source.x,dy=target.y-source.y,d=Math.hypot(dx,dy);
 const a=Math.atan2(dy,dx)-source.angle,offset=Math.abs(Math.atan2(Math.sin(a),Math.cos(a)));
 const angular=spec.omni?1:1-smooth(spec.arc*.11,spec.arc*.5,offset);
 return spec.power*(1-smooth(24,spec.range,d))*Math.max(angular,(1-smooth(10,spec.spill,d))*.4);
}
export function validLight(value:unknown):LightEquipment{
 const v=(value&&typeof value==='object'?value:{}) as Partial<LightEquipment>;
 return {kind:v.kind&&['flashlight','chestlamp','torch'].includes(v.kind)?v.kind:'flashlight',color:typeof v.color==='string'&&/^#[0-9a-f]{6}$/i.test(v.color)?v.color:DEFAULT_LIGHT.color};
}
