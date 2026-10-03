import {selection,DAYS,SHORT,MEALS,foodsAt,foodDetails,totalText,planSections,number,cleanText} from './diet-export-model.js';
import {loadPdfLogo} from './pdf-dieta.js?v=20261002-3';

// OOXML nativo: testo e tabelle modificabili, nessun HTML rinominato .doc.
export function createPianoWord(DX,dieta,paziente,piano,idx={},logo=null,options={},context={}){
  const {o,totalWeeks,weeks}=selection(dieta,options,context),scale=o.textSize==='large'?1.12:1;
  const green=o.palette==='grayscale'?'404040':'45664B',pale=o.palette==='grayscale'?'F5F5F5':'F3F7F3';
  const borders=Object.fromEntries(['top','bottom','left','right','insideHorizontal','insideVertical'].map(k=>[k,{style:DX.BorderStyle.SINGLE,size:4,color:'D9D9D9'}]));
  const sections=[];
  const para=(text,{bold=false,size=10,color='000000',keepNext=false,after=60,align=DX.AlignmentType.LEFT,style}={})=>new DX.Paragraph({style,alignment:align,keepNext,spacing:{after,line:Math.round(size*scale*24),lineRule:DX.LineRuleType.EXACT},children:[new DX.TextRun({text:cleanText(text),bold,size:Math.round(size*scale*2),color,font:'Calibri'})]});
  const cell=(children,width,{fill='FFFFFF',span=1}={})=>new DX.TableCell({width:{size:width,type:DX.WidthType.DXA},columnSpan:span,shading:{fill},verticalAlign:DX.VerticalAlign.CENTER,margins:{top:95,bottom:95,left:90,right:90},borders,children:children.length?children:[para('-')]});
  const table=(rows,width,widths)=>new DX.Table({rows,width:{size:width,type:DX.WidthType.DXA},columnWidths:widths,layout:DX.TableLayoutType.FIXED,borders});
  function foodParagraphs(food,weekly){
    const size=weekly?8.5:10,details=foodDetails(food,idx,o);
    const a=[para(food.alimento_nome||'Alimento',{bold:true,size,keepNext:!!(details.measures||details.macros),after:30})];
    if(details.measures)a.push(para(details.measures,{size:weekly?8:10,color:green,keepNext:!!details.macros,after:30}));
    if(details.macros)a.push(para(details.macros,{size:weekly?7.5:9,color:'595959',after:30}));
    details.notes.forEach(t=>a.push(para(t,{size:weekly?8:9,color:'595959',after:40})));
    a.push(para('',{size:2,after:20}));return a;
  }
  function footer(){
    const children=[];
    if(o.showContacts)children.push(para('Dott.ssa Giulia Cortese · Biologa Nutrizionista · Tel. 320 145 9853 · nutrizionistacortese.it',{size:7,color:'595959',align:DX.AlignmentType.CENTER,after:25}));
    const runs=[];
    if(o.showDate)runs.push(new DX.TextRun({text:new Date().toLocaleDateString('it-IT'),size:14,color:'595959'}));
    if(o.showPageNumbers){if(runs.length)runs.push(new DX.TextRun(' · '));runs.push(new DX.TextRun({children:[DX.PageNumber.CURRENT,' / ',DX.PageNumber.TOTAL_PAGES],size:14,color:'595959'}));}
    if(runs.length)children.push(new DX.Paragraph({alignment:DX.AlignmentType.CENTER,children:runs}));
    return new DX.Footer({children});
  }
  function header(subtitle){
    const meta=[`Paziente: ${paziente.cognome||''} ${paziente.nome||''}`,subtitle];
    if(o.showCalories&&o.showTarget)meta.push(`Target: ${Math.round(number(dieta.target_kcal))} kcal/giorno`);
    const a=[para(dieta.nome||'Piano alimentare',{size:20,bold:true,style:'Title',keepNext:true,after:100}),para(meta.join(' · '),{size:9,color:'595959',keepNext:true,after:100})];
    if(o.showQuantities)a.push(para('Grammature da crudo, al netto degli scarti (eccetto legumi in scatola).',{size:8,color:'595959',after:130}));
    return a;
  }
  function add(children,landscape){
    const headers={};
    if(o.showLogo&&logo){
      const data=typeof logo==='string'?Uint8Array.from(atob(logo.split(',')[1]),c=>c.charCodeAt(0)):logo.data;
      headers.default=new DX.Header({children:[new DX.Paragraph({children:[new DX.ImageRun({type:'png',data,transformation:{width:64,height:typeof logo==='object'?64*logo.height/logo.width:46},altText:{title:'Logo Studio Cortese',description:'Logo dello studio'}})]})]});
    }
    sections.push({properties:{type:DX.SectionType.NEXT_PAGE,page:{size:{width:11906,height:16838,orientation:landscape?DX.PageOrientation.LANDSCAPE:DX.PageOrientation.PORTRAIT},margin:{top:o.showLogo&&logo?1100:620,right:620,bottom:850,left:620,header:250,footer:300}}},headers,footers:{default:footer()},children});
  }
  function weekly(s){
    const width=15598,labelWidth=1450,dayWidth=Math.floor((width-labelWidth)/o.days.length),widths=[labelWidth,...o.days.map(()=>dayWidth)];
    const rows=[new DX.TableRow({tableHeader:true,cantSplit:true,children:[cell([para('PASTO',{bold:true,size:8,align:DX.AlignmentType.CENTER})],labelWidth,{fill:'E8E8E8'}),...o.days.map(d=>cell([para(SHORT[d-1],{bold:true,size:8.5,align:DX.AlignmentType.CENTER})],dayWidth,{fill:'E8E8E8'}))]})];
    for(const [id,label] of MEALS){
      if(!o.showEmptyMeals&&o.days.every(day=>!foodsAt(piano,s,day,id).length))continue;
      rows.push(new DX.TableRow({cantSplit:false,children:[cell([para(label,{bold:true,size:8})],labelWidth,{fill:pale}),...o.days.map(day=>cell(foodsAt(piano,s,day,id).flatMap(p=>foodParagraphs(p,true)),dayWidth))]}));
    }
    if(o.showDailyTotals&&(o.showCalories||o.showMacros))rows.push(new DX.TableRow({cantSplit:true,children:[cell([para('TOTALE',{bold:true,size:8})],labelWidth,{fill:pale}),...o.days.map(day=>cell(totalText(piano,s,day,o).map(t=>para(t,{bold:true,size:8})),dayWidth,{fill:pale}))]}));
    add([...header(`Settimana ${s} di ${totalWeeks}`),table(rows,width,widths)],true);
  }
  function daily(s,day){
    const width=10666,widths=[6800,3866],children=header(`${DAYS[day-1]} · Settimana ${s} di ${totalWeeks}`);
    for(const [id,label] of MEALS){
      const foods=foodsAt(piano,s,day,id);if(!foods.length&&!o.showEmptyMeals)continue;
      children.push(para(label,{bold:true,size:12,keepNext:true,after:100,style:'Heading2'}));
      const rows=[new DX.TableRow({tableHeader:true,cantSplit:true,children:[cell([para('Alimento',{bold:true,size:9})],widths[0],{fill:'E8E8E8'}),cell([para('Quantità e valori',{bold:true,size:9})],widths[1],{fill:'E8E8E8'})]})];
      (foods.length?foods:[null]).forEach(food=>{
        const d=food?foodDetails(food,idx,o):{measures:'',macros:'',notes:[]};
        rows.push(new DX.TableRow({cantSplit:true,children:[cell([para(food?.alimento_nome||'-',{bold:!!food,size:10}),...d.notes.flatMap(t=>cleanText(t).split('\n').map(line=>para(line,{size:9,color:'595959'})))],widths[0]),cell([d.measures,d.macros].filter(Boolean).map(t=>para(t,{size:10,color:green})),widths[1])]}));
      });children.push(table(rows,width,widths),para('',{size:3,after:80}));
    }
    if(o.showDailyTotals&&(o.showCalories||o.showMacros))children.push(para('Totale giornaliero',{bold:true,size:12,keepNext:true}),...totalText(piano,s,day,o).map(t=>para(t,{bold:true,size:10})));
    add(children,false);
  }
  if(o.layout!=='daily')weeks.forEach(weekly);
  if(o.layout!=='weekly')weeks.forEach(s=>o.days.forEach(day=>daily(s,day)));
  const notes=planSections(dieta,idx,o);
  if(notes.length){const children=header('Note e indicazioni');for(const [,title,text] of notes){children.push(para(title,{bold:true,size:12,keepNext:true,style:'Heading2',after:100}),...cleanText(text).split('\n').map(t=>para(t,{size:10,after:100})));}add(children,o.layout!=='daily');}
  return new DX.Document({creator:'Studio Cortese',title:cleanText(dieta.nome||'Piano alimentare'),description:'Piano alimentare modificabile',styles:{default:{document:{run:{font:'Calibri',size:20,color:'000000'},paragraph:{spacing:{after:80}}}},paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',next:'Normal',run:{size:40,bold:true,color:'000000'},paragraph:{spacing:{after:100}}},{id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',run:{size:24,bold:true,color:'000000'},paragraph:{keepNext:true,spacing:{before:140,after:100}}}]},sections});
}

export async function esportaPianoWord(dieta,paziente,piano,idx,options={},context={}){
  const DX=await import('./vendor/docx.bundle.js'),{o}=selection(dieta,options,context);
  let logo=null;
  if(o.showLogo){const source=await loadPdfLogo();if(source){const img=new Image();await new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;img.src=source;});if(img.naturalWidth)logo={data:Uint8Array.from(atob(source.split(',')[1]),c=>c.charCodeAt(0)),width:img.naturalWidth,height:img.naturalHeight};}}
  const doc=createPianoWord(DX,dieta,paziente,piano,idx,logo,o,context),blob=await DX.Packer.toBlob(doc);
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;
  link.download=(`Piano_${paziente.cognome}_${paziente.nome}_${o.layout==='daily'?'giornaliero':o.layout==='both'?'completo':'settimanale'}`).replace(/[\\/:*?"<>|]/g,'_')+'.docx';
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
