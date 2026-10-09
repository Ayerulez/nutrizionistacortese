import {sb,requireAuth,logout,getAllRows} from './supabase.js?v=20261009-1';
import {initUI,loading,showAlert,hideAlert,toast,setBtn} from './ui.js?v=20261009-1';
import {setHTML,escapeHtml,guard,reportError} from './safe-dom.js?v=20261009-1';
import {DOCUMENT_FIELDS,MAX_PARAGRAPHS,normalizeExportDocument,previewLink} from './export-document.js?v=20261009-1';
import {EXPORT_SECTIONS} from './pdf-options.js?v=20261009-1';
import {loadPdfPreferences} from './pdf-preferences.js?v=20261009-1';
import {loadJsPDF,loadPdfLogo,createPianoPDF} from './pdf-dieta.js?v=20261009-1';
import {esportaPianoWord} from './word-dieta.js?v=20261009-1';
import {PdfPreview} from './pdf-preview-renderer.js?v=20261009-1';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const S={revision:0,saved:0,renderRevision:-1,paragraphs:[],ready:false,busy:false};
let saveTimer,previewTimer,saveQueue,renderQueue,renderer,jsPDF,logo;
const flags={intro:'showIntro',guidelines:'showGuidelines',planNotes:'showPlanNotes',conclusions:'showConclusions'};
function fail(error){const missing=['PGRST202','PGRST204','42703'].includes(error.code);showAlert('document-error',missing?'Attiva il salvataggio dell’anteprima eseguendo db/004_anteprima_documento.sql su Supabase. Le modifiche qui restano aperte finché non riesci a salvarle.':error.message||String(error));$('document-status').textContent='Operazione non completata. Le modifiche non salvate restano in questa schermata.';}
function snapshot(){const dieta={...S.dieta,documento_export:normalizeExportDocument({paragraphs:S.paragraphs})};for(const field of Object.values(DOCUMENT_FIELDS))dieta[field]=$('document-field-'+field).value;return dieta;}
function anchorOptions(selected){return S.options.sectionOrder.flatMap(id=>['before','after'].map(position=>`<option value="${position}:${id}" ${selected===position+':'+id?'selected':''}>${position==='before'?'Prima di':'Dopo'}: ${escapeHtml(EXPORT_SECTIONS[id])}</option>`)).join('');}
function buildFields(){
 setHTML($('document-fields'),Object.entries(DOCUMENT_FIELDS).map(([id,field],i)=>`<details class="document-field" ${i===0?'open':''}><summary>${escapeHtml(EXPORT_SECTIONS[id])}<small>${S.options[flags[id]]?'Incluso se compilato':'Escluso dalle preferenze'}</small></summary><label for="document-field-${field}" class="sr-only">${escapeHtml(EXPORT_SECTIONS[id])}</label><textarea id="document-field-${field}" maxlength="20000" rows="6"></textarea>${S.options[flags[id]]?'':'<p class="document-field-hidden">Per stampare questa sezione, attivala nelle preferenze.</p>'}</details>`).join(''));
 for(const field of Object.values(DOCUMENT_FIELDS))$('document-field-'+field).value=S.dieta[field]||'';
 setHTML($('document-anchor'),anchorOptions('after:guidelines'));
}
function buildParagraphs(focusId){
 setHTML($('document-paragraphs'),S.paragraphs.map((p,i)=>`<section class="document-paragraph" data-paragraph="${escapeHtml(p.id)}"><div class="document-paragraph-head"><span>Paragrafo ${i+1}</span><div class="document-paragraph-actions"><button class="btn btn-ghost" data-move="-1" aria-label="Sposta prima nella stessa posizione il paragrafo ${i+1}" ${S.paragraphs.slice(0,i).some(other=>other.anchor===p.anchor)?'':'disabled'}>↑</button><button class="btn btn-ghost" data-move="1" aria-label="Sposta dopo nella stessa posizione il paragrafo ${i+1}" ${S.paragraphs.slice(i+1).some(other=>other.anchor===p.anchor)?'':'disabled'}>↓</button><button class="btn btn-ghost" data-remove aria-label="Elimina il paragrafo ${i+1}">×</button></div></div><label for="anchor-${p.id}">Posizione</label><select id="anchor-${p.id}" data-field="anchor">${anchorOptions(p.anchor)}</select><label for="title-${p.id}">Titolo (facoltativo)</label><input id="title-${p.id}" data-field="title" maxlength="160"><label for="text-${p.id}">Testo</label><textarea id="text-${p.id}" data-field="text" maxlength="8000" rows="5"></textarea><label class="document-break"><input type="checkbox" data-field="pageBreak" ${p.pageBreak?'checked':''}> Inizia una nuova pagina</label></section>`).join(''));
 for(const p of S.paragraphs){$('title-'+p.id).value=p.title;$('text-'+p.id).value=p.text;}
 $('document-add').disabled=S.paragraphs.length>=MAX_PARAGRAPHS;
 if(focusId)$('text-'+focusId)?.focus();
}
function changed(){S.revision++;hideAlert('document-error');$('document-status').textContent='Modifiche in corso…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>flush().catch(fail),1200);clearTimeout(previewTimer);previewTimer=setTimeout(()=>refresh().catch(fail),500);}
function updateMoveButtons(){
 document.querySelectorAll('[data-paragraph]').forEach(card=>{const i=S.paragraphs.findIndex(p=>p.id===card.dataset.paragraph),p=S.paragraphs[i];card.querySelector('[data-move="-1"]').disabled=!S.paragraphs.slice(0,i).some(other=>other.anchor===p.anchor);card.querySelector('[data-move="1"]').disabled=!S.paragraphs.slice(i+1).some(other=>other.anchor===p.anchor);});
}
async function flush(){
 clearTimeout(saveTimer);
 if(saveQueue){await saveQueue;if(S.saved<S.revision)return flush();return;}
 saveQueue=(async()=>{while(S.saved<S.revision){
  const revision=S.revision,dieta=snapshot(),testi=Object.fromEntries(Object.values(DOCUMENT_FIELDS).map(field=>[field,dieta[field]]));
  $('document-status').textContent='Salvataggio dei testi…';
  const {data}=await sb.rpc('nutri_save_documento',{p_dieta_id:S.dieta.id,p_expected_updated_at:S.dieta.updated_at,p_testi:testi,p_documento:dieta.documento_export}).throwOnError();
  S.dieta={...dieta,updated_at:data};S.saved=revision;
 }$('document-status').textContent='Tutte le modifiche sono salvate sul piano.';})();
 try{await saveQueue;}finally{saveQueue=null;}
}
async function refresh(){
 clearTimeout(previewTimer);
 if(renderQueue){await renderQueue;if(S.renderRevision!==S.revision)return refresh();return;}
 renderQueue=(async()=>{while(S.renderRevision!==S.revision){
  const revision=S.revision,dieta=snapshot();
  const doc=createPianoPDF(jsPDF,dieta,S.paziente,S.piano,S.idx,logo,S.options,{currentWeek:S.week});
  await renderer.show(doc.output('arraybuffer'));S.renderRevision=revision;S.pdf=doc;
 }})();try{await renderQueue;}finally{renderQueue=null;}
}
async function action(id,fn){
 if(!S.ready||S.busy)return;S.busy=true;hideAlert('document-error');
 const controls=['document-save','document-preferences','document-word','document-pdf','document-refresh'];controls.forEach(k=>$(k).disabled=true);setBtn(id,true);document.querySelector('.document-editor').inert=true;
 try{await flush();await fn();}catch(error){fail(error);}
 finally{setBtn(id,false);controls.forEach(k=>$(k).disabled=false);document.querySelector('.document-editor').inert=false;S.busy=false;}
}
function wire(){
 $('document-fields').oninput=changed;
 $('document-paragraphs').oninput=event=>{const field=event.target.dataset.field,card=event.target.closest('[data-paragraph]');if(!field||!card)return;const p=S.paragraphs.find(p=>p.id===card.dataset.paragraph);p[field]=field==='pageBreak'?event.target.checked:event.target.value;if(field==='anchor')updateMoveButtons();changed();};
 $('document-paragraphs').onclick=event=>{const button=event.target.closest('[data-move],[data-remove]');if(!button)return;const id=button.closest('[data-paragraph]').dataset.paragraph,index=S.paragraphs.findIndex(p=>p.id===id);if(button.hasAttribute('data-remove'))S.paragraphs.splice(index,1);else{const direction=Number(button.dataset.move);let next=index+direction;while(next>=0&&next<S.paragraphs.length&&S.paragraphs[next].anchor!==S.paragraphs[index].anchor)next+=direction;if(next<0||next>=S.paragraphs.length)return;[S.paragraphs[index],S.paragraphs[next]]=[S.paragraphs[next],S.paragraphs[index]];}buildParagraphs();changed();};
 $('document-add').onclick=()=>{if(S.paragraphs.length>=MAX_PARAGRAPHS)return;const p={id:crypto.randomUUID(),anchor:$('document-anchor').value,title:'',text:'',pageBreak:false};S.paragraphs.push(p);buildParagraphs(p.id);changed();};
 $('document-save').onclick=guard(()=>action('document-save',()=>toast('Modifiche del piano salvate')));
 $('document-refresh').onclick=guard(()=>action('document-refresh',refresh));
 $('document-pdf').onclick=guard(()=>action('document-pdf',async()=>{await refresh();S.pdf.save('Piano_'+[S.paziente.cognome,S.paziente.nome].join('_').replace(/[^\p{L}\p{N}_-]/gu,'')+'.pdf');}));
 $('document-word').onclick=guard(()=>action('document-word',()=>esportaPianoWord(snapshot(),S.paziente,S.piano,S.idx,S.options,{currentWeek:S.week})));
 $('document-preferences').onclick=guard(()=>action('document-preferences',()=>{location.href='preferenze-pdf.html?'+new URLSearchParams({ritorno:'anteprima',dieta:S.dieta.id,settimana:S.week});}));
 $('document-back').onclick=guard(event=>{event.preventDefault();return action('document-save',()=>{location.href=$('document-back').href;});});
 $('document-zoom').onchange=()=>renderer.setZoom($('document-zoom').value);
}
async function init(){
 initUI();loading(true,'Caricamento anteprima…');
 try{
  const user=await requireAuth();if(!user)return;$('app').style.display='block';$('topbar-email').textContent=user.email;$('btn-logout').onclick=guard(logout);
  const id=params.get('dieta');if(!previewLink(id))throw new Error('Apri l’anteprima dal piano di un paziente.');
  const {data:dieta}=await sb.from('diete').select('*').eq('id',id).eq('user_id',user.id).single().throwOnError();S.dieta=dieta;
  const [{data:paziente},meals,foods,options]=await Promise.all([
   sb.from('pazienti').select('*').eq('id',dieta.paziente_id).eq('user_id',user.id).single().throwOnError(),
   getAllRows(()=>sb.from('pasti_dieta').select('*').eq('dieta_id',id).eq('user_id',user.id).order('settimana').order('giorno').order('momento').order('ordine').order('id')),
   getAllRows(()=>sb.from('alimenti').select('*').order('id')),loadPdfPreferences(user.id)
  ]);
  Object.assign(S,{paziente,options,piano:{},idx:Object.fromEntries(foods.map(f=>[f.id,f])),week:Math.max(1,Math.min(dieta.numero_settimane||1,Math.trunc(Number(params.get('settimana')))||1)),paragraphs:normalizeExportDocument(dieta.documento_export).paragraphs});
  for(const p of meals){S.piano[p.settimana]??={};S.piano[p.settimana][p.giorno]??={};S.piano[p.settimana][p.giorno][p.momento]??=[];S.piano[p.settimana][p.giorno][p.momento].push(p);}
  $('document-name').textContent=dieta.nome+' · '+[paziente.nome,paziente.cognome].filter(Boolean).join(' ');
  $('document-back').href='diete.html?'+new URLSearchParams({paziente:paziente.id,dieta:id,settimana:S.week});
  buildFields();buildParagraphs();wire();
  renderer=new PdfPreview($('document-canvas-scroll'),$('document-pages'),$('document-pages-count'),fail);
  [jsPDF,logo]=await Promise.all([loadJsPDF(),options.showLogo?loadPdfLogo():null]);
  $('document-layout').hidden=false;await refresh();S.ready=true;$('document-status').textContent='Anteprima del PDF effettivo. Le aggiunte saranno incluse anche nel Word; Word adatta le pagine al proprio layout.';
 }catch(error){fail(error);for(const id of ['document-save','document-preferences','document-word','document-pdf'])$(id).disabled=true;}
 finally{loading(false);}
}
window.addEventListener('beforeunload',event=>{if(S.revision>S.saved){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',()=>{clearTimeout(saveTimer);clearTimeout(previewTimer);renderer?.destroy();});
init().catch(reportError);
