/** Stage C concrete API; the frozen Stage A forward contract remains unchanged. */
export interface Point3 { x:number; y:number; z:number }
export interface Cylinder { radius:number; height:number }
export interface Profile extends Cylinder { id:string; eyeHeight:number; maxSlopeDegrees:number; maxStepRise:number; stepLiftMax:number }
export interface Support { id:string; solidId:string; z:number; normal:Point3; point:Point3; materialId:string; navSurfaceId:string|null; plane:{a:number;b:number;c:number} }
export interface Hit { t:number; normal:Point3; primitiveId:string; point:Point3; diagnostic:string|null }
export interface Geometry {
 readonly identity:Readonly<{geometryMode:'spatial';contentHash:string;compilerRevision:string}>;
 supports(shape:Cylinder,root:Point3,interval:[number,number],previous?:string|null,direction?:Point3):Support[];
 clearance(shape:Cylinder,root:Point3):{fits:boolean;solids:string[]};
 sweep(shape:Cylinder,root:Point3,displacement:Point3,channel?:'collision'|'visible'|'ir',margin?:number):Hit|null;
 raycast(from:Point3,to:Point3,channel?:'collision'|'visible'|'ir'):Omit<Hit,'diagnostic'> & {materialId:string;distance:number}|null;
 contact(...args:unknown[]):never; // later Stage E/G; intentionally throws
 traceSupportMotion(...args:unknown[]):never; // later Stage E; intentionally throws
}
export interface Body extends Point3 {
 vx:number;vy:number;vz:number;shape:Profile;posture:string;
 supportId:string|null;lastSupportId:string|null;motionMode:'grounded'|'step'|'airborne';
 previousPosition?:Point3;tick:number;groundDistance:number;
 step:null|{startZ:number;targetZ:number;t:number;duration:number;dx:number;dy:number;targetId:string;phase:'raise'|'forward'};
 events:Array<{tick:number;type:string;[field:string]:unknown}>;
 diagnostics:Array<{tick:number;code:string}>;
}
export interface Motion {
 initialize(body:Point3 & Partial<Body>,posture?:string):Body;
 posture(body:Body,want:string):boolean;
 step(body:Body,dt?:number):Body; // exactly 1/60; rejects frame dt
 vaultSegment(body:Body,target:Point3,dt:number):boolean;
}
// Body.z is the lowest collider point. Eye offsets and normalized WORLD.PROFILE
// remain distinct. This API adds no wire fields, AI knowledge or render transforms.
