// Operazioni pure: il piano viene salvato con l'RPC atomica già esistente.
const value=v=>v!=null&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
export function swapMealFoods(items,from,to){
 if(!Array.isArray(items)||![from,to].every(i=>Number.isInteger(i)&&i>=0&&i<items.length))throw new Error('Posizione alimento non valida.');
 const next=[...items];[next[from],next[to]]=[next[to],next[from]];return next;
}
export function promoteSubstitute(food,alternative){
 if(!food||!alternative?.id||!(food.sostituti_ids||[]).includes(alternative.id))throw new Error('Sostituto non più disponibile.');
 const kcal=value(alternative.energia_kcal),base=value(food.kcal??food.kcal_calcolate),grams=value(food.quantita_g);
 if(kcal==null||kcal<0)throw new Error('Completa le calorie del sostituto nella scheda alimento.');
 const iso=kcal>0&&base!=null&&base>0;
 const quantity=iso?Math.round(base*100/kcal*10000)/10000:grams;
 if(!(quantity>0))throw new Error('Imposta una quantità valida prima di cambiare il principale.');
 const calc=(n,digits)=>{n=value(n);return n==null?null:Math.round(n*quantity/100*10**digits)/10**digits;};
 const substitutes=[...new Set(food.sostituti_ids.map(id=>id===alternative.id?food.alimento_id:id).filter(id=>id&&id!==alternative.id))];
 return {food:{...food,alimento_id:alternative.id,alimento_nome:alternative.nome,quantita_g:quantity,kcal:calc(kcal,0),prot:calc(alternative.proteine_g,1),carb:calc(alternative.carboidrati_g,1),lip:calc(alternative.lipidi_g,1),sostituti_ids:substitutes},isocaloric:iso};
}
