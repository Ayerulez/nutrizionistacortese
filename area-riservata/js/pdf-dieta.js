import {normalizePdfOptions} from './pdf-options.js';
const DAYS=['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const SHORT=['LUN','MAR','MER','GIO','VEN','SAB','DOM'];
const MEALS=[['colazione','Colazione'],['spuntino_mattina','Spuntino mattina'],['pranzo','Pranzo'],['spuntino_pomeriggio','Spuntino pomeriggio'],['cena','Cena']];
let libraryPromise;
export async function loadJsPDF(){
  if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
  if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL('./vendor/jspdf.umd.min.js',import.meta.url).href;
    script.onload=()=>{if(window.jspdf?.jsPDF)resolve(window.jspdf.jsPDF);else{libraryPromise=null;reject(new Error('jsPDF non disponibile'));}};
    script.onerror=()=>{libraryPromise=null;reject(new Error('Impossibile caricare la libreria PDF'));};document.head.appendChild(script);
  });return libraryPromise;
}
const number=v=>v!=null&&v!==''&&Number.isFinite(Number(v))?Number(v):0;
const grams=v=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(number(v));
const clean=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/↔/g,' / ').replace(/\p{Extended_Pictographic}/gu,'');
const foodsAt=(p,s,g,m)=>{const a=p?.[s]?.[g]?.[m];return Array.isArray(a)?a:a?[a]:[];};
const energy=p=>number(p.kcal??p.kcal_calcolate);
const macro=(p,key)=>p[key]??p[({prot:'proteine_calcolate',carb:'carboidrati_calcolati',lip:'lipidi_calcolati'})[key]];
const macroText=p=>['prot','carb','lip'].map((key,i)=>`${['P','C','G'][i]} ${macro(p,key)==null?'-':grams(macro(p,key))} g`).join(' · ');

export function createPianoPDF(jsPDF,dieta,paziente,piano,idx={},logo=null,options={},context={}){
  const o=normalizePdfOptions(options),scale=o.textSize==='large'?1.15:1;
  const c=o.palette==='grayscale'?{green:[55,55,55],pale:[244,244,244],border:[195,195,195],dark:[35,35,35],grey:[95,95,95]}:
    {green:[90,130,96],pale:[240,245,241],border:[200,216,200],dark:[42,42,42],grey:[105,105,105]};
  const doc=new jsPDF({orientation:o.layout==='daily'?'portrait':'landscape',unit:'mm',format:'a4',compress:true});
  let first=true;
  const font=(size,bold=false,color=c.dark)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size*scale);doc.setTextColor(...color);};
  const wrap=(value,width,size,bold=false)=>{font(size,bold);return doc.splitTextToSize(clean(value),width);};
  const rect=(x,y,w,h,fill)=>{doc.setFillColor(...fill);doc.setDrawColor(...c.border);doc.setLineWidth(.15);doc.rect(x,y,w,h,'FD');};
  function newPage(subtitle,orientation){
    if(!first)doc.addPage('a4',orientation);first=false;
    const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight(),margin=8;
    const g={width,height,margin,w:width-2*margin,end:height-15,y:8};let x=margin,y=8;
    if(o.showLogo&&logo){try{const p=doc.getImageProperties(logo),r=Math.min(19/p.width,14/p.height);doc.addImage(logo,'PNG',x,y,p.width*r,p.height*r);x+=23;}catch{}}
    const title=wrap(dieta.nome,g.w-(x-margin),12,true);font(12,true,c.green);
    title.forEach(t=>{doc.text(t,x,y+4);y+=4.8*scale;});
    const meta=[`Paziente: ${paziente.cognome||''} ${paziente.nome||''}`];
    if(o.showCalories&&o.showTarget)meta.push(`Target: ${Math.round(number(dieta.target_kcal))} kcal/giorno`);
    meta.push(subtitle);const lines=wrap(meta.join(' · '),g.w-(x-margin),8);font(8,false,c.grey);
    lines.forEach(t=>{doc.text(t,x,y+4);y+=3.6*scale;});
    if(o.showQuantities){font(6.5,false,c.grey);wrap('Grammature da crudo, al netto degli scarti (eccetto legumi in scatola).',g.w-(x-margin),6.5).forEach(t=>{doc.text(t,x,y+4);y+=3*scale;});}
    g.y=Math.max(29,y+7);doc.setDrawColor(...c.green);doc.setLineWidth(.4);doc.line(margin,g.y-3,width-margin,g.y-3);return g;
  }
  function foodLines(food,width,daily=false){
    const result=[],base=daily?10:6.4;
    const add=(value,size,bold=false,color=c.dark)=>wrap(value,width,size,bold).forEach(t=>result.push({text:t,size,bold,color}));
    add(food.alimento_nome||'Alimento',daily?11.5:6.8,true);
    const measures=[];if(o.showQuantities)measures.push(`${grams(food.quantita_g)} g`);if(o.showCalories)measures.push(`${Math.round(energy(food))} kcal`);
    if(measures.length)add(measures.join(' · '),base,false,c.green);
    if(o.showMacros)add(macroText(food),daily?9:6.1,false,c.grey);
    if(o.showMealNotes&&food.note)add('Nota: '+food.note,daily?9:6.1,false,c.grey);
    if(o.showAlternatives)(food.sostituti_ids||[]).forEach(id=>{
      const alt=idx[id];if(!alt){add('Alternativa non disponibile',daily?9:6,false,c.grey);return;}
      const details=[];if(o.showQuantities)details.push(number(alt.energia_kcal)>0?`${grams(energy(food)*100/number(alt.energia_kcal))} g`:'quantità da definire');
      add(`Alternativa: ${alt.nome}${details.length?' - '+details.join(' · '):''}`,daily?9:6,false,c.grey);
    });return result;
  }
  function writeLines(lines,x,y,lineHeight){lines.forEach((line,j)=>{font(line.size,line.bold,line.color);doc.text(line.text,x,y+j*lineHeight);});}
  const totals=(s,g)=>{const items=MEALS.flatMap(([m])=>foodsAt(piano,s,g,m));return {kcal:items.reduce((n,p)=>n+energy(p),0),
    prot:items.reduce((n,p)=>n+number(macro(p,'prot')),0),carb:items.reduce((n,p)=>n+number(macro(p,'carb')),0),lip:items.reduce((n,p)=>n+number(macro(p,'lip')),0),
    incomplete:items.some(p=>['prot','carb','lip'].some(k=>macro(p,k)==null))};};
  const totalLines=(s,g)=>{const t=totals(s,g),a=[];if(o.showCalories)a.push(`${Math.round(t.kcal)} kcal`);if(o.showMacros){a.push(macroText(t));if(t.incomplete)a.push('Macro parziali');}return a;};
  const totalWeeks=Math.max(1,Math.min(2,Math.trunc(number(dieta.numero_settimane))||1));
  const current=Math.max(1,Math.min(totalWeeks,Math.trunc(number(context.currentWeek))||1));
  const weeks=o.weeks==='current'?[current]:Array.from({length:totalWeeks},(_,i)=>i+1);
  function weekly(s){
    let part=1,g,y,labelW=22,cellW,lineHeight=3.1*scale;
    const page=()=>{
      g=newPage(`Settimana ${s} di ${totalWeeks}${part>1?' - segue':''}`,'landscape');y=g.y;cellW=(g.w-labelW)/o.days.length;
      rect(g.margin,y,labelW,6,c.pale);
      o.days.forEach((day,i)=>{const x=g.margin+labelW+i*cellW;rect(x,y,cellW,6,c.green);font(7,true,[255,255,255]);doc.text(SHORT[day-1],x+cellW/2,y+4.1,{align:'center'});});y+=6;
    };page();
    for(const [id,label] of MEALS){
      if(!o.showEmptyMeals&&o.days.every(day=>!foodsAt(piano,s,day,id).length))continue;
      const cells=o.days.map(day=>{
        const lines=[];foodsAt(piano,s,day,id).forEach((food,i)=>{if(i)lines.push({text:'',size:6,bold:false,color:c.grey});lines.push(...foodLines(food,cellW-3));});
        return lines.length?lines:[{text:'-',size:6.5,bold:false,color:c.grey}];
      });
      const count=Math.max(...cells.map(a=>a.length));let offset=0;
      while(offset<count){
        let capacity=Math.floor((g.end-y-4)/lineHeight);
        if(capacity<2){part++;page();capacity=Math.floor((g.end-y-4)/lineHeight);}
        if(capacity<1)throw new Error('Intestazione troppo lunga per il formato PDF. Riduci il nome del piano.');
        const take=Math.min(count-offset,capacity),h=Math.max(10,take*lineHeight+4);
        rect(g.margin,y,labelW,h,c.pale);const labels=wrap(label.toUpperCase()+(offset?' (segue)':''),labelW-3,6,true);font(6,true,c.green);
        labels.forEach((t,i)=>doc.text(t,g.margin+labelW/2,y+4+i*2.6*scale,{align:'center'}));
        cells.forEach((lines,i)=>{const x=g.margin+labelW+i*cellW;rect(x,y,cellW,h,[255,255,255]);writeLines(lines.slice(offset,offset+take),x+1.5,y+3,lineHeight);});
        y+=h;offset+=take;
      }
    }
    if(o.showDailyTotals&&(o.showCalories||o.showMacros)){
      const contents=o.days.map(day=>totalLines(s,day).flatMap(t=>wrap(t,cellW-3,6.4,true))),h=Math.max(7,Math.max(...contents.map(a=>a.length))*lineHeight+3);
      if(y+h>g.end){part++;page();}
      rect(g.margin,y,labelW,h,c.green);font(6.5,true,[255,255,255]);doc.text('TOTALE',g.margin+labelW/2,y+4.5,{align:'center'});
      contents.forEach((lines,i)=>{const x=g.margin+labelW+i*cellW;rect(x,y,cellW,h,c.green);font(6.4,true,[255,255,255]);lines.forEach((t,j)=>doc.text(t,x+cellW/2,y+4+j*lineHeight,{align:'center'}));});
    }
  }
  function daily(s,day){
    let part=1,g,y;const subtitle=()=>`${DAYS[day-1]} · Settimana ${s} di ${totalWeeks}${part>1?' - segue':''}`;
    const page=()=>{g=newPage(subtitle(),'portrait');y=g.y;};page();
    const mealHeading=(label,follow=false)=>{rect(g.margin,y,g.w,7,c.green);font(9,true,[255,255,255]);doc.text(label.toUpperCase()+(follow?' - SEGUE':''),g.margin+3,y+4.8);y+=11;};
    for(const [id,label] of MEALS){
      const foods=foodsAt(piano,s,day,id);if(!foods.length&&!o.showEmptyMeals)continue;
      if(y+19>g.end){part++;page();}mealHeading(label);
      const entries=foods.length?foods:[null];
      for(const food of entries){
        const lines=food?foodLines(food,g.w-6,true):[{text:'-',size:10,bold:false,color:c.grey}],lineHeight=4.6*scale;
        const fullHeight=lines.length*lineHeight+5;
        if(fullHeight<g.end-g.y-12&&y+fullHeight>g.end){part++;page();mealHeading(label,true);}
        let offset=0;
        while(offset<lines.length){
          let capacity=Math.floor((g.end-y-3)/lineHeight);
          if(capacity<1){part++;page();mealHeading(label,true);capacity=Math.floor((g.end-y-3)/lineHeight);}
          if(capacity<1)throw new Error('Intestazione troppo lunga per il formato PDF. Riduci il nome del piano.');
          const take=Math.min(lines.length-offset,capacity);writeLines(lines.slice(offset,offset+take),g.margin+3,y+3,lineHeight);y+=take*lineHeight;offset+=take;
        }
        y+=5;doc.setDrawColor(...c.border);doc.setLineWidth(.15);doc.line(g.margin,y-2,g.width-g.margin,y-2);
      }y+=3;
    }
    if(o.showDailyTotals&&(o.showCalories||o.showMacros)){
      const lines=totalLines(s,day),h=12+lines.length*5*scale;
      if(y+h>g.end){part++;page();}
      rect(g.margin,y,g.w,h,c.pale);font(10,true,c.green);doc.text('TOTALE GIORNALIERO',g.margin+3,y+6);
      lines.forEach((t,i)=>{font(10,i===0,c.dark);doc.text(t,g.margin+3,y+12+i*5*scale);});
    }
  }
  if(o.layout!=='daily')weeks.forEach(weekly);
  if(o.layout!=='weekly')weeks.forEach(s=>o.days.forEach(day=>daily(s,day)));
  const sections=[
    [o.showIntro,'Intestazione',dieta.intestazione],[o.showPlanNotes,'Note del piano',dieta.note],
    [o.showGuidelines,'Linee guida',dieta.linee_guida],[o.showConclusions,'Conclusioni',dieta.conclusioni],
    [o.showRecommended,'Alimenti consigliati',(dieta.alimenti_consigliati||[]).map(id=>idx[id]?.nome||'Alimento non disponibile').join('\n')],
    [o.showRecommended,'Alimenti sconsigliati',(dieta.alimenti_sconsigliati||[]).map(id=>idx[id]?.nome||'Alimento non disponibile').join('\n')],
  ].filter(([enabled,,value])=>enabled&&value);
  if(sections.length){
    const orientation=o.layout==='daily'?'portrait':'landscape';let g=newPage('Note e indicazioni',orientation),y=g.y;
    const page=()=>{g=newPage('Note e indicazioni - segue',orientation);y=g.y;};
    for(const [,title,value] of sections){
      if(y+15>g.end)page();font(10,true,c.green);doc.text(title,g.margin,y+4);y+=9*scale;
      for(const line of wrap(value,g.w,9)){
        if(y+4.3*scale>g.end)page();font(9);doc.text(line,g.margin,y+3);y+=4.3*scale;
      }y+=5;
    }
  }
  const count=doc.getNumberOfPages();
  for(let page=1;page<=count;page++){
    doc.setPage(page);const w=doc.internal.pageSize.getWidth(),h=doc.internal.pageSize.getHeight();
    if(o.showContacts||o.showPageNumbers||o.showDate){
      doc.setDrawColor(...c.border);doc.setLineWidth(.2);doc.line(8,h-11,w-8,h-11);font(6,false,c.grey);
      if(o.showContacts)doc.text('Dott.ssa Giulia Cortese · Biologa Nutrizionista · Tel. 320 145 9853',8,h-7);
      if(o.showDate)doc.text(new Date().toLocaleDateString('it-IT'),w/2,h-7,{align:'center'});
      const right=[o.showContacts?'nutrizionistacortese.it':'',o.showPageNumbers?`${page}/${count}`:''].filter(Boolean).join(' · ');
      if(right)doc.text(right,w-8,h-7,{align:'right'});
    }
  }return doc;
}
export async function loadPdfLogo(){
  try{const response=await fetch(new URL('../../images/logo.png',import.meta.url));if(response.ok){const blob=await response.blob();return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}}catch{}
  return null;
}
export async function esportaPianoPDF(dieta,paziente,piano,idx,options={},context={}){
  const jsPDF=await loadJsPDF(),o=normalizePdfOptions(options),logo=o.showLogo?await loadPdfLogo():null;
  const doc=createPianoPDF(jsPDF,dieta,paziente,piano,idx,logo,o,context);
  const name=(`Piano_${paziente.cognome}_${paziente.nome}_${o.layout==='daily'?'giornaliero':o.layout==='both'?'completo':'settimanale'}`).replace(/[\\/:*?"<>|]/g,'_');doc.save(name+'.pdf');
}
