import {sb,requireAuth,logout,getAllRows} from './supabase.js?v=20261009-1';
import {initUI,loading,toast,showAlert,hideAlert,fmtDateShort,updateSearchControls} from './ui.js?v=20261009-1';
import {setHTML,escapeHtml,guard,reportError} from './safe-dom.js?v=20261009-1';
import {DIET_TYPES,loadModels,loadModelUsage,filterModels,openModelForm,updateModel,modelPlan,patientDietType} from './modelli.js?v=20261009-1';
import {DAYS,MEALS,foodDetails,planSections} from './diet-export-model.js?v=20261009-1';
import {normalizePdfOptions} from './pdf-options.js?v=20261009-1';
const $=id=>document.getElementById(id),escape=escapeHtml;
let models=[],catalog=[],patients=[],foods={},current=null,usage=[],detailGeneration=0;
const pathNames=m=>(m.patologie_ids||[]).map(id=>catalog.find(p=>p.id===id)?.nome||'Categoria non disponibile');
function renderList(){
 updateSearchControls();const list=filterModels(models,{q:$('models-q').value.trim(),type:$('models-type').value,path:$('models-path').value,archived:$('models-state').value==='archived'});
 $('models-count').textContent=`${list.length} ${list.length===1?'modello':'modelli'} ${$('models-state').value==='archived'?(list.length===1?'archiviato':'archiviati'):(list.length===1?'attivo':'attivi')}`;
 setHTML($('models-list'),list.length?`<div class="record-list"><div class="record-head record-head--models"><span>Modello</span><span>Tipo dieta</span><span>Patologie</span><span>Settimane</span><span></span></div>${list.map(m=>`<div class="record-row record-row--models" data-model="${escape(m.id)}" data-row-open role="link" tabindex="0" aria-label="Apri modello ${escape(m.nome)}"><div class="row-summary"><div class="record-name">${escape(m.nome)}</div><div class="record-sub">${escape(m.descrizione||'Piano riutilizzabile')}</div></div><span class="list-value" data-label="Dieta">${escape(DIET_TYPES[m.tipo_dieta])}</span><span class="list-value" data-label="Patologie">${escape(pathNames(m).join(', ')||'Non classificate')}</span><span class="list-value" data-label="Durata">${escape(m.piano.numero_settimane)} sett.</span><span class="record-chevron" aria-hidden="true">›</span></div>`).join('')}</div>`:'<div class="card"><p>Nessun modello corrisponde ai filtri. Puoi creare un modello dalla schermata di una dieta.</p></div>');
}
function renderDay(){
 if(!current)return;const plan=modelPlan(current),week=Number($('model-week').value),day=Number($('model-day').value),o=normalizePdfOptions({showMacros:true});
 setHTML($('model-meals'),MEALS.map(([key,label])=>{const meals=plan[week]?.[day]?.[key]||[];return `<div class="model-meal"><strong>${label}</strong>${meals.map(p=>{const d=foodDetails(p,foods,o);return `<p>${escape(p.alimento_nome)} · ${escape(d.measures)}<br><small>${escape(d.macros)}</small>${d.notes.length?'<br>'+d.notes.map(escape).join('<br>'):''}</p>`;}).join('')||'<p>—</p>'}</div>`;}).join(''));
}
function renderHistory(){
 const q=$('model-history-q').value.trim().toLocaleLowerCase('it'),list=usage.filter(u=>!q||`${u.pazienti?.nome||''} ${u.pazienti?.cognome||''}`.toLocaleLowerCase('it').includes(q));updateSearchControls();
 $('model-history-count').textContent=`${list.length} ${list.length===1?'applicazione':'applicazioni'} · ${new Set(list.map(u=>u.paziente_id)).size} ${new Set(list.map(u=>u.paziente_id)).size===1?'paziente':'pazienti'}`;
 setHTML($('model-history'),list.map(u=>`<div class="model-usage"><strong>${escape(u.pazienti?.nome||'Paziente')} ${escape(u.pazienti?.cognome||'')}</strong><small>${escape(fmtDateShort(u.used_at))} · ${u.origine==='clonazione'?'Clonazione':'Applicazione dal modello'} · ${escape(u.modello_nome)}</small><a class="btn btn-secondary btn-sm" href="pazienti.html?id=${escape(u.paziente_id)}">Scheda paziente</a>${u.dieta_id?`<a class="btn btn-secondary btn-sm" href="diete.html?paziente=${escape(u.paziente_id)}&dieta=${escape(u.dieta_id)}">Apri dieta</a>`:'<p class="model-help">Dieta eliminata; utilizzo conservato nello storico.</p>'}${u.avvisi_confermati?.length?`<details><summary>Avvisi confermati (${u.avvisi_confermati.length})</summary><ul>${u.avvisi_confermati.map(w=>`<li>${escape(w.messaggio)}</li>`).join('')}</ul></details>`:''}</div>`).join('')||'<p class="model-help">Nessun utilizzo trovato.</p>');
}
async function openModel(id){
 const m=models.find(m=>m.id===id);if(!m)throw new Error('Modello non disponibile.');const generation=++detailGeneration;current=m;
 $('models-list-view').hidden=true;$('model-detail').hidden=false;$('model-name').textContent=m.nome;$('model-description').textContent=m.descrizione||'Copia indipendente del piano di partenza.';$('model-use').disabled=!m.attivo;
 setHTML($('model-meta'),[DIET_TYPES[m.tipo_dieta],m.attivo?'Attivo':'Archiviato',m.piano.numero_settimane+' settimane',Math.round(m.piano.target_kcal)+' kcal/giorno',...pathNames(m)].map(t=>`<span>${escape(t)}</span>`).join(''));
 setHTML($('model-week'),Array.from({length:m.piano.numero_settimane},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join(''));setHTML($('model-day'),DAYS.map((name,i)=>`<option value="${i+1}">${name}</option>`).join(''));renderDay();
 setHTML($('model-texts'),planSections(m.piano,foods,normalizePdfOptions()).map(([,title,text])=>`<div class="model-meal"><h4>${escape(title)}</h4><p class="model-text">${escape(text)}</p></div>`).join(''));
 $('model-history-q').value='';$('model-history').textContent='Caricamento dello storico…';
 try{const records=await loadModelUsage(id);if(generation!==detailGeneration)return;usage=records;renderHistory();}
 catch(error){if(generation===detailGeneration){$('model-history').textContent=error.message;$('model-history-count').textContent='Storico non disponibile.';}}
 const url=new URL(location.href);url.searchParams.set('id',id);history.replaceState(null,'',url);
}
function choosePatient(){
 if(!current?.attivo)return;const model=current,el=document.createElement('dialog');el.className='model-dialog';setHTML(el,`<form><div class="modal-header"><h3>Usa ${escape(model.nome)}</h3></div><div class="modal-body"><p>Scegli il paziente. Il modello verrà proposto nella creazione della nuova dieta e gli eventuali avvisi verranno mostrati prima dell’applicazione.</p><div class="form-group"><label for="model-patient-search">Cerca paziente</label><input id="model-patient-search" type="search" placeholder="Nome o cognome…"></div><div class="form-group"><label for="model-patient">Paziente *</label><select id="model-patient" required></select></div></div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-cancel>Annulla</button><button class="btn btn-primary" type="submit">Continua alla nuova dieta</button></div></form>`);document.body.appendChild(el);
 const render=()=>{const q=el.querySelector('input').value.toLocaleLowerCase('it');setHTML(el.querySelector('select'),'<option value="">Seleziona paziente</option>'+patients.filter(p=>(p.nome+' '+p.cognome).toLocaleLowerCase('it').includes(q)).map(p=>`<option value="${escape(p.id)}">${escape(p.cognome)} ${escape(p.nome)} · ${escape(DIET_TYPES[patientDietType(p)])}</option>`).join(''));};render();el.querySelector('input').oninput=render;
 const close=()=>{el.close();el.remove();};el.querySelector('[data-cancel]').onclick=close;el.addEventListener('cancel',event=>{event.preventDefault();close();});el.querySelector('form').onsubmit=event=>{event.preventDefault();const id=el.querySelector('select').value;if(id)location.href=`diete.html?paziente=${encodeURIComponent(id)}&new=1&modello=${encodeURIComponent(model.id)}`;};el.showModal();
}
async function init(){
 loading(true);initUI();const user=await requireAuth();if(!user)return;$('app').style.display='block';$('topbar-email').textContent=user.email;$('btn-logout').onclick=guard(logout);
 try{[models,catalog,patients]=await Promise.all([loadModels(),getAllRows(()=>sb.from('patologie_catalogo').select('id,nome').order('nome').order('id')),getAllRows(()=>sb.from('pazienti').select('id,nome,cognome,vegetariano_vegano,tipo_dieta_strutturato').order('cognome').order('id'))]);const foodRows=await getAllRows(()=>sb.from('alimenti').select('id,nome,energia_kcal').order('nome').order('id'));foods=Object.fromEntries(foodRows.map(f=>[f.id,f]));
  setHTML($('models-type'),'<option value="">Tutti</option>'+Object.entries(DIET_TYPES).map(([id,name])=>`<option value="${id}">${escape(name)}</option>`).join(''));setHTML($('models-path'),'<option value="">Tutte</option>'+catalog.map(p=>`<option value="${escape(p.id)}">${escape(p.nome)}</option>`).join(''));
  $('models-q').oninput=renderList;['models-type','models-path','models-state'].forEach(id=>$(id).onchange=guard(renderList));$('models-reset').onclick=()=>{['models-q','models-type','models-path'].forEach(id=>$(id).value='');$('models-state').value='active';renderList();};$('models-list').onclick=guard(async event=>{const row=event.target.closest('[data-model]');if(row)await openModel(row.dataset.model);});
  $('models-back').onclick=()=>{++detailGeneration;$('model-detail').hidden=true;$('models-list-view').hidden=false;const url=new URL(location.href);url.searchParams.delete('id');history.replaceState(null,'',url);renderList();};['model-day','model-week'].forEach(id=>$(id).onchange=guard(renderDay));$('model-history-q').oninput=renderHistory;$('model-use').onclick=guard(choosePatient);
  $('model-edit').onclick=()=>openModelForm({catalog,model:current,onSave:async value=>{await updateModel(current.id,value);Object.assign(current,value);toast('Modello aggiornato');await openModel(current.id);}});renderList();const id=new URLSearchParams(location.search).get('id');if(id)await openModel(id);
 }catch(error){showAlert('models-error',error.message);}finally{loading(false);}
}
init().catch(reportError);
