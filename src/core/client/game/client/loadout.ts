import {player} from '../shared/movement';
import {validLight} from '../shared/equipment';
export const equipment=player.equipment;
try{Object.assign(equipment,validLight(JSON.parse(localStorage.getItem('wanderer-light')||'{}')));}catch{}
export function saveEquipment(){try{localStorage.setItem('wanderer-light',JSON.stringify(equipment));}catch{}}
