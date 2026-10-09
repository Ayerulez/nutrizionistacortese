import {selection,DAYS,SHORT,MEALS,foodsAt,foodDetails,totalText,documentBlocks,specialistLines,number,cleanText,roundedExportValue} from './diet-export-model.js?v=20261009-2';
import {loadPdfLogo} from './pdf-dieta.js?v=20261009-2';
import {mealColors} from './meal-colors.js?v=20261009-2';

// OOXML nativo: testo e tabelle modificabili, nessun HTML rinominato .doc.
export function createPianoWord(DX,dieta,paziente,piano,idx={},logo=null,options={},context={}){
  const {o,totalWeeks,weeks}=selection(dieta,options,context),scale=o.textSize==='large'?1.12:1;
  const green=o.palette==='grayscale'?'404040':'45664B',pale=o.palette==='grayscale'?'F5F5F5':'F3F7F3';
  const borders=Object.fromEntries(['top','bottom','left','right','insideHorizontal','insideVertical'].map(k=>[k,{style:DX.BorderStyle.SINGLE,size:4,color:'D9D9D9'}]));
  const sections=[];let imageId=0;
  const para=(text,{bold=false,size=10,color='000000',keepNext=false,after=60,align=DX.AlignmentType.LEFT,style}={})=>new DX.Paragraph({style,alignment:align,keepNext,spacing:{after,line:Math.round(size*scale*24),lineRule:DX.LineRuleType.EXACT},children:[new DX.TextRun({text:cleanText(text),bold,size:Math.round(size*scale*2),color,font:'Calibri'})]});
  const cell=(children,width,{fill='FFFFFF',span=1}={})=>new DX.TableCell({width:{size:width,type:DX.WidthType.DXA},columnSpan:span,shading:{fill,type:DX.ShadingType.CLEAR},verticalAlign:DX.VerticalAlign.CENTER,margins:{top:95,bottom:95,left:90,right:90},borders,children:children.length?children:[para('-')]});
  const table=(rows,width,widths)=>new DX.Table({rows,width:{size:width,type:DX.WidthType.DXA},columnWidths:widths,layout:DX.TableLayoutType.FIXED,borders});
  function image(width){
    const data=typeof logo==='string'?Uint8Array.from(atob(logo.split(',')[1]),c=>c.charCodeAt(0)):logo.data;
    return new DX.ImageRun({type:'png',data,transformation:{width,height:Math.round(typeof logo==='object'?width*logo.height/logo.width:width)},altText:{id:++imageId,name:'Logo Studio Cortese '+imageId,title:'Logo Studio Cortese',description:'Logo dello studio'}});
  }
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
    if(o.showContacts)children.push(para([o.specialistName,o.specialistPhone&&'Tel. '+o.specialistPhone,o.specialistWebsite].filter(Boolean).join(' · '),{size:7,color:'595959',align:DX.AlignmentType.CENTER,after:25}));
    const runs=[];
    if(o.showDate)runs.push(new DX.TextRun({text:new Date().toLocaleDateString('it-IT'),size:14,color:'595959'}));
    if(o.showPageNumbers){if(runs.length)runs.push(new DX.TextRun({text:' · ',size:14,color:'595959'}));runs.push(new DX.SimpleField('PAGE','1'),new DX.TextRun({text:' / ',size:14}),new DX.SimpleField('NUMPAGES','1'));}
    if(runs.length)children.push(new DX.Paragraph({style:'NutriFooter',alignment:DX.AlignmentType.CENTER,spacing:{after:0,line:168,lineRule:DX.LineRuleType.EXACT},children:runs}));
    return new DX.Footer({children});
  }
  function header(subtitle){
    const meta=[`Paziente: ${paziente.cognome||''} ${paziente.nome||''}`,subtitle];
    if(o.showCalories&&o.showTarget)meta.push(`Target: ${roundedExportValue(dieta.target_kcal)} kcal/giorno`);
    const a=[para(dieta.nome||'Piano alimentare',{size:20,bold:true,style:'NutriTitle',keepNext:true,after:100}),para(meta.join(' · '),{size:9,color:'595959',keepNext:true,after:100})];
    if(o.showQuantities)a.push(para('Grammature da crudo, al netto degli scarti (eccetto legumi in scatola).',{size:8,color:'595959',after:130}));
    return a;
  }
  function add(children,landscape,cover=false){
    const headers={};
    if(o.showLogo&&logo&&!cover){
      headers.default=new DX.Header({children:[new DX.Paragraph({children:[image(54)]})]});
    }
    sections.push({properties:{type:DX.SectionType.NEXT_PAGE,page:{size:{width:11906,height:16838,orientation:landscape?DX.PageOrientation.LANDSCAPE:DX.PageOrientation.PORTRAIT},margin:{top:cover?1500:o.showLogo&&logo?1100:850,right:850,bottom:850,left:850,header:250,footer:300}}},headers,footers:{default:footer()},children:[...children,para('',{size:1,after:0})]});
  }
  if(o.showCover){
    const centered={align:DX.AlignmentType.CENTER},children=[];
    if(o.showLogo&&logo)children.push(new DX.Paragraph({alignment:DX.AlignmentType.CENTER,spacing:{after:850},children:[image(185)]}));
    else children.push(para(o.specialistName||'Studio Cortese',{...centered,size:18,after:1500}));
    children.push(para('Piano nutrizionale di',{...centered,size:22,after:240}),para([paziente.nome,paziente.cognome].filter(Boolean).join(' '),{...centered,size:28,bold:true,after:280}),para(dieta.nome||'Piano alimentare',{...centered,size:11,color:'595959',after:1000}),...specialistLines(o).map(t=>para(t,{...centered,size:11,after:130})));
    add(children,false,true);
  }
  function weekly(s){
    const width=15138,labelWidth=1450,dayWidth=Math.floor((width-labelWidth)/o.days.length),widths=[labelWidth,...o.days.map(()=>dayWidth)];
    const rows=[new DX.TableRow({tableHeader:true,cantSplit:true,children:[cell([para('PASTO',{bold:true,size:8,align:DX.AlignmentType.CENTER})],labelWidth,{fill:'E8E8E8'}),...o.days.map(d=>cell([para(SHORT[d-1],{bold:true,size:8.5,align:DX.AlignmentType.CENTER})],dayWidth,{fill:'E8E8E8'}))]})];
    for(const [id,label] of MEALS){
      if(!o.showEmptyMeals&&o.days.every(day=>!foodsAt(piano,s,day,id).length))continue;
      const theme=mealColors(id,o.palette==='grayscale');
      rows.push(new DX.TableRow({children:[cell([para(label,{bold:true,size:8,color:theme.text})],labelWidth,{fill:theme.fill}),...o.days.map(day=>cell(foodsAt(piano,s,day,id).flatMap(p=>foodParagraphs(p,true)),dayWidth,{fill:theme.tint}))]}));
    }
    if(o.showDailyTotals&&(o.showCalories||o.showMacros))rows.push(new DX.TableRow({cantSplit:true,children:[cell([para('TOTALE',{bold:true,size:8})],labelWidth,{fill:pale}),...o.days.map(day=>cell(totalText(piano,s,day,o).map(t=>para(t,{bold:true,size:8})),dayWidth,{fill:pale}))]}));
    add([...header(`Settimana ${s} di ${totalWeeks}`),table(rows,width,widths)],true);
  }
  function daily(s,day){
    const width=10206,widths=[6500,3706],children=header(`${DAYS[day-1]} · Settimana ${s} di ${totalWeeks}`);
    for(const [id,label] of MEALS){
      const foods=foodsAt(piano,s,day,id);if(!foods.length&&!o.showEmptyMeals)continue;
      const theme=mealColors(id,o.palette==='grayscale');
      children.push(para(label,{bold:true,size:12,color:theme.text,keepNext:true,after:100,style:'NutriHeading2'}));
      const rows=[new DX.TableRow({tableHeader:true,cantSplit:true,children:[cell([para('Alimento',{bold:true,size:9})],widths[0],{fill:theme.fill}),cell([para('Quantità e valori',{bold:true,size:9})],widths[1],{fill:theme.fill})]})];
      (foods.length?foods:[null]).forEach(food=>{
        const d=food?foodDetails(food,idx,o):{measures:'',macros:'',notes:[]};
        rows.push(new DX.TableRow({cantSplit:true,children:[cell([para(food?.alimento_nome||'-',{bold:!!food,size:10}),...d.notes.flatMap(t=>cleanText(t).split('\n').map(line=>para(line,{size:9,color:'595959'})))],widths[0]),cell([d.measures,d.macros].filter(Boolean).map(t=>para(t,{size:10,color:green})),widths[1])]}));
      });children.push(table(rows,width,widths),para('',{size:3,after:80}));
    }
    if(o.showDailyTotals&&(o.showCalories||o.showMacros))children.push(para('Totale giornaliero',{bold:true,size:12,keepNext:true}),...totalText(piano,s,day,o).map(t=>para(t,{bold:true,size:10})));
    add(children,false);
  }
  for(const block of documentBlocks(dieta,idx,o)){
    if(block.type==='table'){
      if(o.layout!=='daily')weeks.forEach(weekly);
      if(o.layout!=='weekly')weeks.forEach(s=>o.days.forEach(day=>daily(s,day)));
    }else{
      const children=header(block.title);
      for(const [,title,text] of block.sections){if(title)children.push(para(title,{bold:true,size:13,keepNext:true,style:'NutriHeading2',after:150}));children.push(...cleanText(text).split('\n').map(t=>para(t,{size:11,after:120})));}
      add(children,false);
    }
  }
  return new DX.Document({creator:'Studio Cortese',title:cleanText(dieta.nome||'Piano alimentare'),description:'Piano alimentare modificabile',styles:{default:{document:{run:{font:'Calibri',size:20,color:'000000'},paragraph:{spacing:{after:80}}}},paragraphStyles:[{id:'NutriFooter',name:'Pie di pagina piano',basedOn:'Normal',run:{font:'Calibri',size:14,color:'595959'},paragraph:{spacing:{after:0}}},{id:'NutriTitle',name:'Titolo piano',basedOn:'Normal',next:'Normal',run:{size:40,bold:true,color:'000000'},paragraph:{spacing:{after:100}}},{id:'NutriHeading2',name:'Sezione piano',basedOn:'Normal',next:'Normal',run:{size:24,bold:true,color:'000000'},paragraph:{keepNext:true,spacing:{before:140,after:100}}}]},sections});
}

export async function esportaPianoWord(dieta,paziente,piano,idx,options={},context={}){
  const DX=await import('./vendor/docx.bundle.js?v=20261009-2'),{o}=selection(dieta,options,context);
  let logo=null;
  if(o.showLogo){const source=await loadPdfLogo();if(source){const img=new Image();await new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;img.src=source;});if(img.naturalWidth)logo={data:Uint8Array.from(atob(source.split(',')[1]),c=>c.charCodeAt(0)),width:img.naturalWidth,height:img.naturalHeight};}}
  const doc=createPianoWord(DX,dieta,paziente,piano,idx,logo,o,context),blob=await DX.Packer.toBlob(doc);
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;
  link.download=(`Piano_${paziente.cognome}_${paziente.nome}_${o.layout==='daily'?'giornaliero':o.layout==='both'?'completo':'settimanale'}`).replace(/[\\/:*?"<>|]/g,'_')+'.docx';
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
