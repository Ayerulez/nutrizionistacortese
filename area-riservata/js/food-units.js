export const FOOD_UNITS={biscotto:['biscotto','biscotti'],fetta:['fetta','fette'],pezzo:['pezzo','pezzi'],cracker:['cracker','cracker'],galletta:['galletta','gallette'],uovo:['uovo','uova'],barretta:['barretta','barrette'],vasetto:['vasetto','vasetti']};
const aliases={biscotto:'biscotto',biscotti:'biscotto',biscuit:'biscotto',biscuits:'biscotto',cookie:'biscotto',cookies:'biscotto',fetta:'fetta',fette:'fetta',slice:'fetta',slices:'fetta',pezzo:'pezzo',pezzi:'pezzo',piece:'pezzo',pieces:'pezzo',unit:'pezzo',units:'pezzo',cracker:'cracker',crackers:'cracker',galletta:'galletta',gallette:'galletta',uovo:'uovo',uova:'uovo',egg:'uovo',eggs:'uovo',barretta:'barretta',barrette:'barretta',bar:'barretta',bars:'barretta',vasetto:'vasetto',vasetti:'vasetto',pot:'vasetto',pots:'vasetto'};
const positive=v=>v!=null&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0&&Number(v)<=10000?Number(v):null;
export function parseUnitServing(text,servingQuantity=null,quantityUnit='g'){
 text=String(text||'').toLowerCase();if(text.length>1000||/[−-]\s*\d|\d\s*[–-]\s*\d/.test(text)||quantityUnit==='ml'||/\bml\b/.test(text))return null;
 const counts=[...text.matchAll(new RegExp('\\b(\\d+(?:[.,]\\d+)?)\\s*('+Object.keys(aliases).join('|')+')\\b','g'))];
 const masses=[...text.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(?:g|gr|grammi|grams)\b/g)];
 if(counts.length!==1||masses.length>1||(!masses.length&&quantityUnit!=='g'))return null;
 const count=positive(counts[0][1].replace(',','.')),mass=masses.length?positive(masses[0][1].replace(',','.')):positive(servingQuantity);
 if(!count||!mass||!positive(mass/count))return null;
 if(masses.length&&quantityUnit==='g'&&positive(servingQuantity)&&Math.abs(mass-Number(servingQuantity))>Math.max(.01,mass*.01))return null;
 return {peso_unita_g:Math.round(mass/count*10000)/10000,unita_misura:aliases[counts[0][2]]};
}
export function unitInfo(food){const weight=positive(food?.peso_unita_g),kind=food?.unita_misura;return weight&&FOOD_UNITS[kind]?{weight,kind,labels:FOOD_UNITS[kind],source:String(food.unita_fonte||'')}:null;}
export function portionUnits(food,grams,{print=false}={}){
 const unit=unitInfo(food),quantity=positive(grams);if(!unit||!quantity)return '';
 const count=quantity/unit.weight;if(!Number.isFinite(count))return '';
 const exact=Math.abs(count-Math.round(count))<.0001,number=new Intl.NumberFormat('it-IT',{maximumFractionDigits:print?0:1});
 if(print&&count<1){for(const [v,fraction] of [[.25,'¼'],[.5,'½'],[.75,'¾']])if(Math.abs(count-v)<.02)return fraction+' '+unit.labels[0];return 'meno di 1 '+unit.labels[0];}
 const amount=exact?Math.round(count):print?Math.max(1,Math.round(count)):Math.round(count*10)/10;
 if(!amount)return 'meno di 1 '+unit.labels[0];
 return (exact?'':'circa ')+number.format(amount)+' '+unit.labels[amount===1?0:1];
}
export function unitPayload(weight,kind,source=''){
 if(weight==null||String(weight).trim()==='')return {peso_unita_g:null,unita_misura:null,unita_fonte:null};
 const parsed=positive(String(weight).replace(',','.'));if(!parsed||!FOOD_UNITS[kind])throw new Error('Inserisci un peso unitario maggiore di zero (massimo 10.000 g) e il tipo di pezzo.');
 if(String(source).length>500)throw new Error('La fonte del peso unitario è troppo lunga.');
 return {peso_unita_g:parsed,unita_misura:kind,unita_fonte:String(source).trim()||'Inserimento manuale'};
}
