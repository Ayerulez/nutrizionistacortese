export const DOCUMENT_FIELDS={intro:'intestazione',guidelines:'linee_guida',planNotes:'note',conclusions:'conclusioni'};
export const DOCUMENT_SECTIONS=['intro','guidelines','planNotes','table','recommended','discouraged','conclusions'];
export const MAX_PARAGRAPHS=40;
export function normalizeExportDocument(value){
 const paragraphs=[];
 if(value&&typeof value==='object'&&Array.isArray(value.paragraphs))for(const p of value.paragraphs.slice(0,MAX_PARAGRAPHS)){
  if(!p||typeof p!=='object'||!/^((before|after):)(intro|guidelines|planNotes|table|recommended|discouraged|conclusions)$/.test(p.anchor||''))continue;
  const id=typeof p.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)?p.id:'paragraph-'+paragraphs.length;
  if(paragraphs.some(item=>item.id===id))continue;
  paragraphs.push({id,anchor:p.anchor,title:typeof p.title==='string'?p.title.slice(0,160):'',text:typeof p.text==='string'?p.text.slice(0,8000):'',pageBreak:p.pageBreak===true});
 }
 return {version:1,paragraphs};
}
export function previewLink(dietaId,week=1){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dietaId||''))return null;
 return 'anteprima-dieta.html?'+new URLSearchParams({dieta:dietaId,settimana:String(Math.max(1,Math.min(2,Math.trunc(Number(week))||1)))});
}
