import {defaults,type Appearance} from '../shared/avatar';
export {defaults,type Appearance} from '../shared/avatar';
export const appearance:Appearance={...defaults};
try{const v=JSON.parse(localStorage.getItem('wanderer-appearance')||'{}');for(const k of ['hands','main'] as const)if(/^#[0-9a-f]{6}$/i.test(v[k]))appearance[k]=v[k];for(const [k,values] of Object.entries({hat:['none','cap','beanie','hardhat'],texture:['plain','freckles','stripes','patched'],backpack:['none','canvas','utility']}))if(values.includes(v[k]))appearance[k as 'hat'|'texture'|'backpack']=v[k];}catch{}
export function saveAppearance(){try{localStorage.setItem('wanderer-appearance',JSON.stringify(appearance));}catch{}}
