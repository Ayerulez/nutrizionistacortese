/** PDF nativo: alimenti multipli, note complete e paginazione per ogni settimana. */
const DAYS=['LUN','MAR','MER','GIO','VEN','SAB','DOM'];
const MEALS=[['colazione','COLAZIONE'],['spuntino_mattina','SPUNTINO MAT.'],['pranzo','PRANZO'],['spuntino_pomeriggio','SPUNTINO POM.'],['cena','CENA']];
const GREEN=[90,130,96], PALE=[240,245,241], BORDER=[200,216,200], DARK=[42,42,42], GREY=[105,105,105];
const WIDTH=297, HEIGHT=210, MARGIN=8, W=WIDTH-2*MARGIN, LABEL_W=20, CELL_W=(W-LABEL_W)/7;
const LINE=3.1, END=HEIGHT-15;
let libraryPromise;
export async function loadJsPDF() {
  if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
  if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=new URL('./vendor/jspdf.umd.min.js',import.meta.url).href;
    script.onload=()=>window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF non disponibile'));
    script.onerror=()=>{libraryPromise=null;reject(new Error('Impossibile caricare la libreria PDF'));};
    document.head.appendChild(script);
  });
  return libraryPromise;
}
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const grams=value=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(num(value));
const text=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/↔/g,' / ').replace(/\p{Extended_Pictographic}/gu,'');
const slot=(piano,s,g,m)=>{const v=piano?.[s]?.[g]?.[m];return Array.isArray(v)?v:v?[v]:[];};
const kcal=p=>num(p.kcal??p.kcal_calcolate);
function wrap(doc,value,width,size=6.8,bold=false) {
  doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);
  return doc.splitTextToSize(text(value),width);
}
function rect(doc,x,y,w,h,fill) {
  doc.setFillColor(...fill);doc.setDrawColor(...BORDER);doc.setLineWidth(0.15);doc.rect(x,y,w,h,'FD');
}
function cellLines(doc,foods,idx) {
  const result=[];
  const add=(value,size,bold,color=DARK)=>wrap(doc,value,CELL_W-3,size,bold).forEach(t=>result.push({text:t,size,bold,color}));
  foods.forEach((food,i)=>{
    if(i)result.push({text:'',size:6,bold:false,color:GREY});
    add(food.alimento_nome||'Alimento',6.8,true);
    add(`${grams(food.quantita_g)} g · ${Math.round(kcal(food))} kcal`,6.4,false,GREEN);
    if(food.note)add('Nota: '+food.note,6.1,false,GREY);
    (food.sostituti_ids||[]).forEach(id=>{
      const alt=idx[id];
      if(!alt){add('Alternativa non disponibile',6,false,GREY);return;}
      const energy=num(alt.energia_kcal);
      const quantity=energy>0?`${grams(kcal(food)*100/energy)} g`:'quantita da definire';
      add(`Alternativa: ${alt.nome} - ${quantity}`,6,false,GREY);
    });
  });
  return result.length?result:[{text:'—',size:6.5,bold:false,color:GREY}];
}
function header(doc,dieta,paziente,subtitle,logo) {
  let x=MARGIN,y=8;
  if(logo){
    try{const p=doc.getImageProperties(logo);const scale=Math.min(19/p.width,14/p.height);doc.addImage(logo,'PNG',x,y,p.width*scale,p.height*scale);x+=23;}catch{}
  }
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...GREEN);
  const name=wrap(doc,dieta.nome,W-(x-MARGIN),12,true);
  name.forEach(t=>{doc.text(t,x,y+4);y+=4.8;});
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...GREY);
  const meta=`Paziente: ${paziente.cognome} ${paziente.nome} · Target: ${Math.round(num(dieta.target_kcal))} kcal/giorno · ${subtitle}`;
  wrap(doc,meta,W-(x-MARGIN),8).forEach(t=>{doc.text(t,x,y+4);y+=3.6;});
  doc.setFontSize(6.5);doc.text('Grammature da crudo, al netto degli scarti (eccetto legumi in scatola).',x,y+4);
  y=Math.max(29,y+10);
  doc.setDrawColor(...GREEN);doc.setLineWidth(.4);doc.line(MARGIN,y-3,WIDTH-MARGIN,y-3);
  return y;
}
function dayHeader(doc,y) {
  rect(doc,MARGIN,y,LABEL_W,6,PALE);
  DAYS.forEach((day,i)=>{
    const x=MARGIN+LABEL_W+i*CELL_W;rect(doc,x,y,CELL_W,6,GREEN);
    doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(255,255,255);doc.text(day,x+CELL_W/2,y+4.1,{align:'center'});
  });
  return y+6;
}
export function createPianoPDF(jsPDF,dieta,paziente,piano,idx={},logo=null) {
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
  let first=true;
  const page=subtitle=>{if(!first)doc.addPage('a4','landscape');first=false;return header(doc,dieta,paziente,subtitle,logo);};
  for(let s=1;s<=Math.max(1,num(dieta.numero_settimane));s++){
    let part=1;
    const newWeekPage=()=>dayHeader(doc,page(`Settimana ${s} di ${dieta.numero_settimane}${part>1?' - segue':''}`));
    let y=newWeekPage();
    for(const [id,label] of MEALS){
      const cells=DAYS.map((_,i)=>cellLines(doc,slot(piano,s,i+1,id),idx));
      const count=Math.max(...cells.map(c=>c.length));
      let offset=0;
      while(offset<count){
        let capacity=Math.floor((END-y-4)/LINE);
        if(capacity<2){part++;y=newWeekPage();capacity=Math.floor((END-y-4)/LINE);}
        const take=Math.min(count-offset,capacity),height=Math.max(10,take*LINE+4);
        rect(doc,MARGIN,y,LABEL_W,height,PALE);
        doc.setFont('helvetica','bold');doc.setFontSize(6);doc.setTextColor(...GREEN);
        const labels=wrap(doc,label+(offset?' (segue)':''),LABEL_W-3,6,true);
        labels.forEach((t,i)=>doc.text(t,MARGIN+LABEL_W/2,y+4+i*2.6,{align:'center'}));
        cells.forEach((lines,i)=>{
          const x=MARGIN+LABEL_W+i*CELL_W;rect(doc,x,y,CELL_W,height,[255,255,255]);
          lines.slice(offset,offset+take).forEach((line,j)=>{
            doc.setFont('helvetica',line.bold?'bold':'normal');doc.setFontSize(line.size);doc.setTextColor(...line.color);
            doc.text(line.text,x+1.5,y+3+j*LINE);
          });
        });
        y+=height;offset+=take;
      }
    }
    if(y+7>END){part++;y=newWeekPage();}
    rect(doc,MARGIN,y,LABEL_W,7,GREEN);
    doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.setTextColor(255,255,255);doc.text('TOTALE',MARGIN+LABEL_W/2,y+4.5,{align:'center'});
    DAYS.forEach((_,i)=>{
      const total=MEALS.reduce((sum,[m])=>sum+slot(piano,s,i+1,m).reduce((v,p)=>v+kcal(p),0),0);
      const x=MARGIN+LABEL_W+i*CELL_W;rect(doc,x,y,CELL_W,7,GREEN);
      doc.setFontSize(6.7);doc.setTextColor(255,255,255);doc.text(`${Math.round(total)} kcal`,x+CELL_W/2,y+4.5,{align:'center'});
    });
  }
  const sections=[
    ['Intestazione',dieta.intestazione],['Note del piano',dieta.note],['Linee guida',dieta.linee_guida],['Conclusioni',dieta.conclusioni],
    ['Alimenti consigliati',(dieta.alimenti_consigliati||[]).map(id=>idx[id]?.nome||'Alimento non disponibile').join('\n')],
    ['Alimenti sconsigliati',(dieta.alimenti_sconsigliati||[]).map(id=>idx[id]?.nome||'Alimento non disponibile').join('\n')],
  ].filter(([,value])=>value);
  if(sections.length){
    let y=page('Note e indicazioni');
    for(const [title,value] of sections){
      if(y+13>END)y=page('Note e indicazioni - segue');
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...GREEN);doc.text(title,MARGIN,y+4);y+=9;
      const lines=wrap(doc,value,W,9);
      for(const line of lines){
        if(y+4>END)y=page('Note e indicazioni - segue');
        doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...DARK);doc.text(line,MARGIN,y+3);y+=4.3;
      }
      y+=5;
    }
  }
  for(let i=1;i<=doc.getNumberOfPages();i++){
    doc.setPage(i);doc.setDrawColor(...BORDER);doc.setLineWidth(.2);doc.line(MARGIN,HEIGHT-11,WIDTH-MARGIN,HEIGHT-11);
    doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(...GREY);
    doc.text('Dott.ssa Giulia Cortese · Biologa Nutrizionista · Tel. 320 145 9853',MARGIN,HEIGHT-7);
    doc.text(`nutrizionistacortese.it · ${i}/${doc.getNumberOfPages()}`,WIDTH-MARGIN,HEIGHT-7,{align:'right'});
  }
  return doc;
}
export async function esportaPianoPDF(dieta,paziente,piano,idx) {
  const jsPDF=await loadJsPDF();
  let logo=null;
  try{
    const response=await fetch(new URL('../../images/logo.png',import.meta.url));
    if(response.ok){const blob=await response.blob();logo=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
  }catch{}
  const doc=createPianoPDF(jsPDF,dieta,paziente,piano,idx,logo);
  const name=(`Piano_${paziente.cognome}_${paziente.nome}`).replace(/[\\/:*?"<>|]/g,'_');
  doc.save(name+'.pdf');
}
