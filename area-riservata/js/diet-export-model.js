import {normalizePdfOptions} from './pdf-options.js';
export const DAYS=['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
export const SHORT=['LUN','MAR','MER','GIO','VEN','SAB','DOM'];
export const MEALS=[['colazione','Colazione'],['spuntino_mattina','Spuntino mattina'],['pranzo','Pranzo'],['spuntino_pomeriggio','Spuntino pomeriggio'],['cena','Cena']];
export const number=v=>v!=null&&v!==''&&Number.isFinite(Number(v))?Number(v):0;
export const grams=v=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(number(v));
export const cleanText=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/↔/g,' / ').replace(/\p{Extended_Pictographic}/gu,'');
export const foodsAt=(p,s,g,m)=>{const a=p?.[s]?.[g]?.[m];return Array.isArray(a)?a:a?[a]:[];};
export const energy=p=>number(p.kcal??p.kcal_calcolate);
export const macro=(p,key)=>p[key]??p[({prot:'proteine_calcolate',carb:'carboidrati_calcolati',lip:'lipidi_calcolati'})[key]];
export const macroText=p=>['prot','carb','lip'].map((key,i)=>`${['P','C','G'][i]} ${macro(p,key)==null?'-':grams(macro(p,key))} g`).join(' · ');
export function selection(dieta,options={},context={}){
  const o=normalizePdfOptions(options),totalWeeks=Math.max(1,Math.min(2,Math.trunc(number(dieta.numero_settimane))||1));
  const current=Math.max(1,Math.min(totalWeeks,Math.trunc(number(context.currentWeek))||1));
  return {o,totalWeeks,weeks:o.weeks==='current'?[current]:Array.from({length:totalWeeks},(_,i)=>i+1)};
}
export function dayTotals(piano,s,g){
  const items=MEALS.flatMap(([m])=>foodsAt(piano,s,g,m));
  return {kcal:items.reduce((n,p)=>n+energy(p),0),prot:items.reduce((n,p)=>n+number(macro(p,'prot')),0),carb:items.reduce((n,p)=>n+number(macro(p,'carb')),0),lip:items.reduce((n,p)=>n+number(macro(p,'lip')),0),incomplete:items.some(p=>['prot','carb','lip'].some(k=>macro(p,k)==null))};
}
export function foodDetails(food,idx,o){
  const measures=[];if(o.showQuantities)measures.push(`${grams(food.quantita_g)} g`);if(o.showCalories)measures.push(`${Math.round(energy(food))} kcal`);
  const notes=[];if(o.showMealNotes&&food.note)notes.push('Nota: '+food.note);
  if(o.showAlternatives)(food.sostituti_ids||[]).forEach(id=>{
    const alt=idx[id];if(!alt){notes.push('Alternativa non disponibile');return;}
    const amount=o.showQuantities?(number(alt.energia_kcal)>0?` - ${grams(energy(food)*100/number(alt.energia_kcal))} g`:' - quantità da definire'):'';
    notes.push('Alternativa: '+alt.nome+amount);
  });
  return {measures:measures.join(' · '),macros:o.showMacros?macroText(food):'',notes};
}
export function totalText(piano,s,g,o){const t=dayTotals(piano,s,g),lines=[];if(o.showCalories)lines.push(`${Math.round(t.kcal)} kcal`);if(o.showMacros){lines.push(macroText(t));if(t.incomplete)lines.push('Macro parziali');}return lines;}
export function planSections(dieta,idx,o){return [
  [o.showIntro,'Intestazione',dieta.intestazione],[o.showPlanNotes,'Note del piano',dieta.note],
  [o.showGuidelines,'Linee guida',dieta.linee_guida],[o.showConclusions,'Conclusioni',dieta.conclusioni],
  [o.showRecommended,'Alimenti consigliati',(dieta.alimenti_consigliati||[]).map(id=>idx[id]?.nome||'Alimento non disponibile').join('\n')],
  [o.showRecommended,'Alimenti sconsigliati',(dieta.alimenti_sconsigliati||[]).map(id=>idx[id]?.nome||'Alimento non disponibile').join('\n')],
].filter(([enabled,,value])=>enabled&&value);}
