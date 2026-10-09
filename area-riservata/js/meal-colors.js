// Una sola palette per editor, PDF e Word. Le etichette restano sempre leggibili.
export const MEAL_COLORS=Object.freeze({
 colazione:Object.freeze({fill:'F8EED8',tint:'FFFCF5',accent:'C5A264',text:'71582F'}),
 spuntino_mattina:Object.freeze({fill:'EAF3E8',tint:'F8FBF7',accent:'91B190',text:'416344'}),
 pranzo:Object.freeze({fill:'E8F0F7',tint:'F7FAFD',accent:'92AEC9',text:'405F7B'}),
 spuntino_pomeriggio:Object.freeze({fill:'FAEBE3',tint:'FFFAF7',accent:'CE9B83',text:'875A46'}),
 cena:Object.freeze({fill:'F0EAF6',tint:'FBF9FD',accent:'AD99C5',text:'685281'}),
});
const NEUTRAL=Object.freeze({fill:'EFEFEF',tint:'FAFAFA',accent:'999999',text:'454545'});
export const mealColors=(id,grayscale=false)=>grayscale?NEUTRAL:MEAL_COLORS[id]||NEUTRAL;
export const colorRgb=hex=>[0,2,4].map(start=>parseInt(hex.slice(start,start+2),16));
export function applyMealColors(root=document.documentElement){
 for(const [meal,colors] of Object.entries(MEAL_COLORS))for(const [key,value] of Object.entries(colors))root.style.setProperty('--meal-'+meal+'-'+key,'#'+value);
}
