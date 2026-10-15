import type {Appearance} from './avatar';
import type {LightEquipment} from './equipment';
export type Corpse={
 id:string;ownerId:string;name:string;createdAt:number;cause:'Hound'|'Smiler'|'Vanish'|string;
 x:number;y:number;angle:number;scaleX:number;scaleY:number;attackAngle:number;
 appearance:Appearance;equipment:LightEquipment;
 blood:{x:number;y:number;seed:number}[];
 dropped:{x:number;y:number;angle:number};hat:{x:number;y:number;angle:number};
 /* (lineage B09) a body another player's page made, given by the server ('r' + its owner's id) */
 remote?:boolean;
 /* (B18, owner G.I.B.) a physical death's remains: where the hands fell, whether the hat stayed on */
 hands?:[number,number][];hatOn?:boolean;
 [more:string]:unknown;
};
// World records are independent of the live player and can be serialized for a room.
export const corpses:Corpse[]=[];
let run=1,sequence=0;
/* (B09, owner G.I.B.) one body per player: a new body replaces that player's earlier one, and the server's copy of it ('r' + id); the
 * body of this page's player is told to the server (B++'s window.__net.bodyMade) */
export function addCorpse(value:Omit<Corpse,'id'>){
 const record:Corpse=JSON.parse(JSON.stringify({...value,id:`${run}:${value.ownerId}:${++sequence}`}));
 for(let i=corpses.length;i--;)if(corpses[i].ownerId===record.ownerId||corpses[i].ownerId==='r'+record.ownerId)corpses.splice(i,1);
 corpses.push(record);
 if(!record.remote&&window.__net&&window.__net.bodyMade)window.__net.bodyMade(record);
 return record;
}
export function clearCorpses(){corpses.length=0;sequence=0;run++;}
