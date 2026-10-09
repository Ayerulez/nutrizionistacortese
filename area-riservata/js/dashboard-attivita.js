import {sb,requireAuth,logout} from './supabase.js?v=20261009-3';
import {initUI,loading,setBtn,showAlert,hideAlert} from './ui.js?v=20261009-3';
import {setHTML,escapeHtml as esc,guard,reportError} from './safe-dom.js?v=20261009-3';
import {planDuration} from './plan-structure.js?v=20261009-3';
const $=id=>document.getElementById(id);let user,busy=false;
const fullName=p=>[p?.nome,p?.cognome].filter(Boolean).join(' ')||'Paziente';
const initials=p=>(p?.nome?.[0]||'')+(p?.cognome?.[0]||'');
const date=value=>{if(!value)return '';const d=new Date(String(value).length===10?value+'T12:00:00':value);return Number.isNaN(+d)?'':d.toLocaleDateString('it-IT',{day:'2-digit',month:'short'});};
const link=(page,params)=>page+'?'+new URLSearchParams(params);
function row(p,title,sub,href,stamp){return `<a class="activity-row" href="${esc(href)}"><span class="activity-avatar" aria-hidden="true">${esc(initials(p).toUpperCase()||'SC')}</span><span class="activity-row-copy"><span class="activity-row-name">${esc(title)}</span><span class="activity-row-sub">${esc(sub)}</span></span>${stamp?`<span class="activity-date-pill">${esc(date(stamp))}</span>`:''}<span class="activity-row-arrow" aria-hidden="true">›</span></a>`;}
function list(id,rows,empty){const el=$('activity-'+id);setHTML(el,rows.join('')||`<p class="activity-empty">${esc(empty)}</p>`);el.setAttribute('aria-busy','false');}
async function refresh(){
 if(busy)return;busy=true;setBtn('activity-refresh',true);hideAlert('activity-error');$('activity-status').textContent='Aggiornamento…';
 try{
  // Le letture mantengono esplicito il proprietario oltre alle RLS.
  const results=await Promise.allSettled([
   sb.from('visite').select('id,paziente_id,data_visita,created_at,prestazioni(nome)').eq('user_id',user.id).order('data_visita',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(6).throwOnError(),
   sb.from('pazienti').select('id,nome,cognome,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(6).throwOnError(),
   sb.from('diete').select('id,paziente_id,nome,created_at,struttura_piano,numero_settimane,attiva').eq('user_id',user.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(6).throwOnError(),
   ...['pazienti','visite','diete'].map(table=>sb.from(table).select('id',{count:'exact',head:true}).eq('user_id',user.id).throwOnError())
  ]);
  const data=i=>results[i].status==='fulfilled'?results[i].value.data||[]:[],visits=data(0),patients=data(1),diets=data(2),index=Object.fromEntries(patients.map(p=>[p.id,p]));
  let incomplete=results.some(r=>r.status==='rejected');
  const missing=[...new Set([...visits,...diets].map(r=>r.paziente_id).filter(id=>id&&!index[id]))];
  if(missing.length){try{const {data}=await sb.from('pazienti').select('id,nome,cognome').eq('user_id',user.id).in('id',missing).throwOnError();for(const p of data||[])index[p.id]=p;}catch{incomplete=true;}}
  for(const [i,key] of ['patient','visit','diet'].entries())$('activity-'+key+'-count').textContent=results[i+3].status==='fulfilled'?results[i+3].value.count??'—':'—';
  list('visits',visits.map(v=>{const p=index[v.paziente_id];return row(p,fullName(p),v.prestazioni?.nome||'Visita',link('pazienti.html',{id:v.paziente_id,visita:v.id}),v.data_visita);}),results[0].status==='rejected'?'Le visite non sono disponibili. Riprova con Aggiorna.':'Ancora nessuna visita. Le visite registrate compariranno qui.');
  list('patients',patients.map(p=>row(p,fullName(p),'Paziente appena registrato',link('pazienti.html',{id:p.id}),p.created_at)),results[1].status==='rejected'?'I pazienti non sono disponibili. Riprova con Aggiorna.':'Il primo paziente del tuo studio comparirà qui.');
  list('diets',diets.map(d=>{const p=index[d.paziente_id];return row(p,d.nome,fullName(p)+' · '+planDuration(d)+(d.attiva===false?' · Inattivo':''),link('diete.html',{paziente:d.paziente_id,dieta:d.id}),d.created_at);}),results[2].status==='rejected'?'I piani non sono disponibili. Riprova con Aggiorna.':'Crea il primo piano dalla scheda di un paziente.');
  if(incomplete)showAlert('activity-error','Alcune attività non sono disponibili. Riprova con Aggiorna.');
  $('activity-status').textContent=incomplete?'Dati parziali':'Aggiornato alle '+new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
 }finally{busy=false;setBtn('activity-refresh',false);}
}
async function init(){initUI();loading(true,'Apertura dello studio…');try{user=await requireAuth();if(!user)return;$('app').style.display='block';$('topbar-email').textContent=user.email;$('btn-logout').onclick=guard(logout);$('activity-date').textContent=new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});$('activity-refresh').onclick=guard(refresh);loading(false);await refresh();}finally{loading(false);}}
init().catch(reportError);
