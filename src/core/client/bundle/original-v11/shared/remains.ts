import type {Appearance} from './avatar';
import type {LightEquipment} from './equipment';
export type Corpse={
 id:string;ownerId:string;name:string;createdAt:number;cause:'Hound'|'Smiler';
 x:number;y:number;angle:number;scaleX:number;scaleY:number;attackAngle:number;
 appearance:Appearance;equipment:LightEquipment;
 blood:{x:number;y:number;seed:number}[];
 dropped:{x:number;y:number;angle:number};hat:{x:number;y:number;angle:number};
};
// World records are independent of the live player and can be serialized for a room.
export const corpses:Corpse[]=[];
let run=1,sequence=0;
export function addCorpse(value:Omit<Corpse,'id'>){
 const record:Corpse=JSON.parse(JSON.stringify({...value,id:`${run}:${value.ownerId}:${++sequence}`}));
 corpses.push(record);return record;
}
export function clearCorpses(){corpses.length=0;sequence=0;run++;}
