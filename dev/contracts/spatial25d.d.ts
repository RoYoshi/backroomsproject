/** STAGE A CONTRACT ONLY. Not imported by any runtime module. Architecture sections 2–10. */
export type StableId = string; // explicit typed namespace; never array offset or coordinate hash
export interface Point3 { x:number; y:number; z:number }
export interface Velocity3 { vx:number; vy:number; vz:number }
export interface Point2 { x:number; y:number }
export interface Plane { a:number; b:number; c:number } // z = ax+by+c
export interface Bounds3 { min:Point3; max:Point3 }
export interface Channels { collision:boolean; visible:boolean; ir:boolean; acousticTransmission:number }
export interface Solid { id:StableId; footprint:Point2[]; lower:Plane; upper:Plane; materialId:StableId; channels:Channels }
export interface SupportPatch { id:StableId; polygon:Point2[]; plane:Plane; normal:Point3; solidId:StableId; materialId:StableId; navSurfaceId:StableId|null; supports:boolean }
export interface NavSurface { id:StableId; patchIds:StableId[]; origin:Point2; cellSize:number; boundaryLinkIds:StableId[]; chart:string; clearanceProfileIds:StableId[] }
export type TraversalKind='walk-seam'|'ramp'|'stairs'|'step'|'drop'|'crawl'|'vault';
export interface TraversalLink { id:StableId; kind:TraversalKind; fromSurfaceId:StableId; toSurfaceId:StableId; entry:Point3[]; exit:Point3[]; corridor:Point3[]; supportPatchIds:StableId[]; profileIds:StableId[]; capabilityFlags:string[]; durationRule:string; progressRule:string; interruptionRule:string; landingRule:string; costRule:string; directed:true; clearanceRequired:boolean }
export interface Space { id:StableId; bounds:Bounds3; portalIds:StableId[]; volumeSpec:string }
export interface Portal { id:StableId; fromSpaceId:StableId; toSpaceId:StableId; polygon:Point3[]; channels:Channels; traversalLinkId:StableId|null }
export interface Material { id:StableId; friction:number; noiseClass:string; visibleTransmission:number; irTransmission:number; acousticTransmission:number }
export interface LightSource { id:StableId; position:Point3; direction:Point3; channel:'visible'|'ir'; range:number; power:number; supportId:StableId|null; spaceId:StableId|null }
export interface ViewGroup { id:StableId; solidIds:StableId[]; spaceIds:StableId[]; cutawayEligible:boolean }
export interface Anchor { id:StableId; kind:'spawn'|'exit'|'item'|'corpse-test'; position:Point3; yaw:number; supportId:StableId; spaceId:StableId|null; colliderProfileId:StableId }
export interface ColliderProfile { id:StableId; radius:number; height:number; eyeHeight:number; maxSlopeDegrees:number; maxStepRise:number; stepLiftMax:number; capabilities:string[] }
export interface WorldDefinition { schemaVersion:1; assetId:StableId; geometryRevision:string; geometryMode:'flat-compat'|'spatial'; units:'legacy-world-unit'; bounds:Bounds3; solids:Solid[]; supportPatches:SupportPatch[]; navSurfaces:NavSurface[]; traversalLinks:TraversalLink[]; spaces:Space[]; portals:Portal[]; materials:Material[]; lights:LightSource[]; viewGroups:ViewGroup[]; anchors:Anchor[]; colliderProfiles:ColliderProfile[] }
export interface PoseIdentity { worldAssetId:StableId; worldEpoch:string; geometryRevision:string; entityId:StableId; entityGeneration:number; lifeGeneration:number; poseSequence:number }
export type MotionMode='grounded'|'step'|'traversal'|'airborne'|'captured'|'dead-active'|'sleeping';
export interface ContactState { primitiveId:StableId; point:Point3; normal:Point3; impulse:number }
export interface TraversalState { linkId:StableId; startTick:number; progress:number; interrupted:boolean }
export interface RootBodyState { identity:PoseIdentity; position:Point3; velocity:Velocity3; previousPosition:Point3; yaw:number; angularVelocity:number; colliderProfileId:StableId; physicalHeight:number; posture:string; locomotionState:string; motionMode:MotionMode; supportId:StableId|null; lastSupportId:StableId|null; navSurfaceId:StableId|null; spaceId:StableId|null; contacts:ContactState[]; traversal:TraversalState|null }
export interface DeathIdentity { worldEpoch:string; victimId:StableId; lifeGeneration:number; deathSequence:number }
export interface PhysicalObjectIdentity { worldEpoch:string; objectId:StableId; generation:number; death:DeathIdentity|null }
export interface LooseBodyState { identity:PhysicalObjectIdentity; center:Point3; velocity:Velocity3; supportId:StableId|null; sleeping:boolean; parentObjectId:StableId|null }
/** Future API contracts only: Stage A supplies NO implementation of these functions. */
export interface SpatialQueryContracts {
 supports(footprint:Point2[], zInterval:[number,number], previousSupport:StableId|null, contactDirection:Point3):unknown;
 clearance(body:RootBodyState, channel:string):unknown;
 sweep(shape:unknown, start:Point3, displacement:Point3, mask:string):unknown;
 raycast(from:Point3,to:Point3,channel:'collision'|'visible'|'ir'|'sound'):unknown;
 contact(a:RootBodyState,b:RootBodyState):unknown;
 traceSupportMotion(start:RootBodyState,xyRoute:Point2[],elapsedTicks:number):unknown;
}
