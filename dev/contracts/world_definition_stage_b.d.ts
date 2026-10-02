/** Stage B runtime contract. Stage A spatial scaffold remains frozen; no spatial compilation exists yet. */
import type { WorldDefinition as SpatialScaffold, Point2 } from './spatial25d';
export interface FlatRoom {id:string;code:string;name:string;x:number;y:number;w:number;h:number}
export interface FlatProp {id:string;type:'low'|'under'|'gap'|'window';kind:string;tx:number;ty:number;tw:number;th:number;depth?:number;axis?:'x'|'y';conceal?:boolean}
export interface FlatWorldDefinition {
 schemaVersion:1;assetId:string;contentRevision:string;contentHash:string;
 geometryMode:'flat-compat';units:'legacy-world-unit';
 bounds:{min:{x:0;y:0;z:null};max:{x:number;y:number;z:null}};
 verticalExtent:'UNSPECIFIED — NOT SPATIAL GEOMETRY';spatialRecords:null;
 materials:string[];defaultMaterial:string;roomMaterials:Record<string,string>;
 anchors:Array<Point2 & {id:string;z:0;supportId:null}>;
 exits:{kind:'seeded-glitched-walls';owner:'dev/sim_glue.js';staticAnchors:[]};
 flat:{width:number;height:number;tile:96;navCell:48;navRadius:21;rooms:FlatRoom[];
 floorCarves:Array<[number,number,number,number]>;wallCarves:Array<[number,number,number,number]>;doorCarves:Array<[number,number,number,number]>;
 columns:Array<Point2 & {id:string}>;pillarGrid:{xs:number[];ys:number[];half:number;size:number;ids:string[]};
 lampRule:{excludeRoomId:string;offset:number;stride:number;margin:number;center:number};lampIds:string[];
 propDefs:FlatProp[];legacyItems:{roomIds:string[];ids:string[]};patrol:Array<Point2 & {id:string}>};
}
export type WorldDefinition = FlatWorldDefinition | (Omit<SpatialScaffold,'geometryMode'> & {geometryMode:'spatial'});
/** The union describes the future boundary; runtime compile accepts ONLY FlatWorldDefinition. */
