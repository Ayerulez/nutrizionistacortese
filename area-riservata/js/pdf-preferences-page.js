import {requireAuth,logout} from './supabase.js?v=20261003-4';
import {loading,toast,initUI,showAlert,hideAlert,setBtn} from './ui.js?v=20261003-4';
import {setHTML,escapeHtml,guard,reportError} from './safe-dom.js?v=20261003-4';
import {PDF_DEFAULTS,EXPORT_SECTIONS,normalizePdfOptions} from './pdf-options.js?v=20261003-4';
import {loadPdfPreferences,savePdfPreferences} from './pdf-preferences.js?v=20261003-4';
import {loadJsPDF,loadPdfLogo,createPianoPDF} from './pdf-dieta.js?v=20261003-4';
const $=id=>document.getElementById(id);
let user,dirty=false,revision=0,previewUrl,sectionOrder=[...PDF_DEFAULTS.sectionOrder];
const groups={
  'pdf-nutrition':[['showCalories','Calorie degli alimenti'],['showMacros','Proteine, carboidrati e grassi'],['showDailyTotals','Totali giornalieri'],['showTarget','Target calorico del piano'],['showQuantities','Quantità in grammi']],
  'pdf-content':[['showAlternatives','Alternative ai singoli alimenti'],['showMealNotes','Note dei pasti'],['showEmptyMeals','Mostra anche i pasti vuoti'],['showCover','Copertina con paziente e specialista'],['showIntro','Introduzione / intestazione del piano'],['showPlanNotes','Note generali del piano'],['showGuidelines','Linee guida'],['showConclusions','Conclusioni'],['showRecommended','Alimenti consigliati'],['showDiscouraged','Alimenti sconsigliati']],
  'pdf-brand':[['showLogo','Logo dello studio'],['showContacts','Contatti a piè di pagina'],['showPageNumbers','Numeri di pagina'],['showDate','Data di generazione']],
};
function build(){
  for(const [id,items] of Object.entries(groups))setHTML($(id),items.map(([key,label])=>`<label class="pdf-check"><input type="checkbox" id="pf-${escapeHtml(key)}"><span>${escapeHtml(label)}</span></label>`).join(''));
  setHTML($('pdf-days'),['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map((name,i)=>`<label class="pdf-day"><input type="checkbox" name="day" value="${i+1}">${name}</label>`).join(''));
}
function renderOrder(){
  setHTML($('pdf-section-order'),sectionOrder.map((id,i)=>`<li><span><b>${i+1}.</b> ${escapeHtml(EXPORT_SECTIONS[id])}</span><div><button type="button" class="btn btn-secondary btn-icon" data-move="-1" data-section="${escapeHtml(id)}" aria-label="Sposta ${escapeHtml(EXPORT_SECTIONS[id])} prima" ${i===0?'disabled':''}>↑</button><button type="button" class="btn btn-secondary btn-icon" data-move="1" data-section="${escapeHtml(id)}" aria-label="Sposta ${escapeHtml(EXPORT_SECTIONS[id])} dopo" ${i===sectionOrder.length-1?'disabled':''}>↓</button></div></li>`).join(''));
}
function moveSection(event){const button=event.target.closest('[data-move]');if(!button)return;const i=sectionOrder.indexOf(button.dataset.section),next=i+Number(button.dataset.move);if(next<0||next>=sectionOrder.length)return;[sectionOrder[i],sectionOrder[next]]=[sectionOrder[next],sectionOrder[i]];renderOrder();markChanged();$('pdf-section-order').querySelector(`[data-section="${button.dataset.section}"][data-move="${button.dataset.move}"]`)?.focus();}
function fill(value){
  const o=normalizePdfOptions(value);sectionOrder=[...o.sectionOrder];renderOrder();
  for(const key of ['specialistName','specialistRole','specialistPhone','specialistEmail','specialistAddress','specialistWebsite'])$('pf-'+key).value=o[key];
  document.querySelector(`[name=layout][value="${o.layout}"]`).checked=true;
  for(const key of ['weeks','palette','textSize'])$('pf-'+key).value=o[key];
  for(const items of Object.values(groups))for(const [key] of items)$('pf-'+key).checked=o[key];
  document.querySelectorAll('[name=day]').forEach(el=>el.checked=o.days.includes(Number(el.value)));summary();
}
function collect(){
  const days=[...document.querySelectorAll('[name=day]:checked')].map(el=>Number(el.value));
  if(!days.length)throw new Error('Seleziona almeno un giorno da stampare.');
  const o={layout:document.querySelector('[name=layout]:checked')?.value,days};
  for(const key of ['weeks','palette','textSize'])o[key]=$('pf-'+key).value;
  for(const items of Object.values(groups))for(const [key] of items)o[key]=$('pf-'+key).checked;
  o.sectionOrder=sectionOrder;
  for(const key of ['specialistName','specialistRole','specialistPhone','specialistEmail','specialistAddress','specialistWebsite'])o[key]=$('pf-'+key).value;
  return normalizePdfOptions(o);
}
function summary(){
  const calories=$('pf-showCalories').checked;$('pf-showTarget').disabled=!calories;
  try{const o=collect();const layout={weekly:'Tabella settimanale in A4 orizzontale',daily:'Schede giornaliere in A4 verticale',both:'Riepilogo settimanale e schede giornaliere'}[o.layout];
    $('pdf-summary').textContent=`${layout}. ${o.days.length} giorni inclusi. ${o.weeks==='all'?'Tutte le settimane':'Solo la settimana aperta'}. ${o.showCalories?'Calorie visibili':'Calorie nascoste, anche nel target e nei totali'}. ${o.showMacros?'Macro visibili. ':''}${o.palette==='grayscale'?'Stampa in bianco e nero.':''}`;
  }catch(error){$('pdf-summary').textContent=error.message;}
}
function markChanged(){dirty=true;revision++;$('pdf-status').textContent='Modifiche non salvate. Premi Salva preferenze per applicarle alle diete.';hideAlert('pdf-error');summary();}
function sample(){
  const meals={};for(let day=1;day<=7;day++)meals[day]={colazione:[{alimento_nome:'Yogurt naturale',quantita_g:125,kcal:75,prot:5,carb:6,lip:3},{alimento_nome:'Fiocchi di avena',quantita_g:40,kcal:150,prot:5,carb:24,lip:3}],spuntino_mattina:[],pranzo:[{alimento_nome:'Pasta integrale',quantita_g:80,kcal:280,prot:10,carb:56,lip:2,note:'Cuocere al dente.',sostituti_ids:['riso']},{alimento_nome:'Olio extravergine',quantita_g:10,kcal:90,prot:0,carb:0,lip:10}],spuntino_pomeriggio:[],cena:[{alimento_nome:'Merluzzo',quantita_g:150,kcal:120,prot:26,carb:0,lip:1.8}]};
  return {dieta:{nome:'Piano di esempio',numero_settimane:1,target_kcal:1800,intestazione:'Esempio con dati fittizi.',note:'Nota generale del piano.',linee_guida:'Seguire le indicazioni concordate durante la visita.',conclusioni:'Indicazioni conclusive di esempio.',alimenti_consigliati:['riso']},paziente:{nome:'Anna',cognome:'Esempio'},piano:{1:meals},idx:{riso:{nome:'Riso integrale',energia_kcal:350}}};
}
async function preview(download=false){
  hideAlert('pdf-error');const id=download?'btn-example-pdf':'btn-preview-pdf';setBtn(id,true);
  try{
    const o=collect(),data=sample(),jsPDF=await loadJsPDF(),logo=o.showLogo?await loadPdfLogo():null;
    const doc=createPianoPDF(jsPDF,data.dieta,data.paziente,data.piano,data.idx,logo,o,{currentWeek:1});
    if(download)doc.save('Anteprima_preferenze_PDF.pdf');
    else{if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(doc.output('blob'));$('pdf-preview-frame').src=previewUrl;$('pdf-preview-frame').hidden=false;}
  }catch(error){showAlert('pdf-error',error.message);}finally{setBtn(id,false);}
}
async function save(event){
  event.preventDefault();hideAlert('pdf-error');setBtn('btn-save-pdf',true);
  try{const current=revision;await savePdfPreferences(user.id,collect());
    if(current===revision){dirty=false;$('pdf-status').textContent='Preferenze salvate sul tuo account.';}else $('pdf-status').textContent='Salvataggio completato. Ci sono altre modifiche da salvare.';
    toast('Preferenze di esportazione salvate');
  }catch(error){showAlert('pdf-error',error.message);}finally{setBtn('btn-save-pdf',false);}
}
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);});
async function init(){
  loading(true);initUI();user=await requireAuth();if(!user)return;
  $('topbar-email').textContent=user.email;$('app').style.display='block';build();fill(PDF_DEFAULTS);
  $('btn-logout').onclick=guard(logout);$('pdf-form').onsubmit=guard(save);$('pdf-form').onchange=guard(markChanged);$('pdf-section-order').onclick=guard(moveSection);
  $('btn-reset-pdf').onclick=guard(()=>{fill(PDF_DEFAULTS);markChanged();});
  $('btn-preview-pdf').onclick=guard(()=>preview());$('btn-example-pdf').onclick=guard(()=>preview(true));
  try{fill(await loadPdfPreferences(user.id));$('pdf-status').textContent='Le preferenze salvate vengono applicate al prossimo export del piano.';}
  catch(error){showAlert('pdf-error',error.message);$('btn-save-pdf').disabled=true;}
  finally{loading(false);}
}
init().catch(reportError);
