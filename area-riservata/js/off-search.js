import { sb, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js?v=20261003-5';
import { mapOffToAlimento } from './off-model.js?v=20261003-5';
export { mapOffToAlimento } from './off-model.js?v=20261003-5';
const cache=new Map();
const TTL=24*60*60*1000, PAGE_SIZE=15;
const STORAGE='nutri.off.v2:';
let lastRequest=0, blockedUntil=0;
function readCache(key){
  const memory=cache.get(key);if(memory&&Date.now()-memory.at<TTL)return memory;
  try{const item=JSON.parse(sessionStorage.getItem(STORAGE+key)||'null');if(item&&Date.now()-item.at<TTL&&Array.isArray(item.products)){cache.set(key,item);return item;}}catch{}
  return null;
}
function writeCache(key,products){
  const item={at:Date.now(),products};if(cache.size>=50)cache.delete(cache.keys().next().value);cache.set(key,item);
  try{
    const keys=Object.keys(sessionStorage).filter(k=>k.startsWith(STORAGE)&&k!==STORAGE+'lastRequest');
    if(keys.length>=50)sessionStorage.removeItem(keys[0]);
    sessionStorage.setItem(STORAGE+key,JSON.stringify(item));
  }catch{} // La cache e facoltativa; la ricerca funziona anche senza storage.
}
export async function searchOpenFoodFacts(query,maxResults=PAGE_SIZE,{signal}={}) {
  query=String(query??'').normalize('NFKC').trim().replace(/\s+/g,' ');
  if(query.length<3)return [];
  if(query.length>100)throw new Error('Ricerca troppo lunga (massimo 100 caratteri).');
  maxResults=Math.max(1,Math.min(PAGE_SIZE,Math.trunc(maxResults)||PAGE_SIZE));
  const {data:{session},error}=await sb.auth.getSession();
  if(error)throw error;
  if(!session?.access_token)throw new Error('Accedi di nuovo per cercare su Open Food Facts.');
  if(signal?.aborted)throw new DOMException('Ricerca annullata','AbortError');
  const key=`${session.user.id}:${query.toLocaleLowerCase('it')}`;
  const cached=readCache(key);
  if(cached)return structuredClone(cached.products.slice(0,maxResults));
  try{lastRequest=Math.max(lastRequest,Number(sessionStorage.getItem(STORAGE+'lastRequest'))||0);}catch{}
  const remaining=Math.max(lastRequest+6500,blockedUntil)-Date.now();
  if(remaining>0)throw new Error(`Attendi ${Math.ceil(remaining/1000)} secondi prima di una nuova ricerca esterna.`);
  const controller=new AbortController();
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,40000);
  lastRequest=Date.now();try{sessionStorage.setItem(STORAGE+'lastRequest',String(lastRequest));}catch{}
  try {
    // Le due pagine chiedono lo stesso insieme: niente cache separata per lo slot.
    const params=new URLSearchParams({q:query,page_size:String(PAGE_SIZE)});
    const response=await fetch(`${SUPABASE_URL}/functions/v1/off-proxy?${params}`,{
      headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${session.access_token}`},signal:controller.signal,
    });
    let data;try{data=await response.json();}catch{throw new Error(`Il proxy ha restituito una risposta non valida (HTTP ${response.status}).`);}
    if(!response.ok) {
      if(response.status===429)blockedUntil=Date.now()+60000;
      const fallback=response.status===401?'Sessione scaduta. Accedi di nuovo.':response.status===403?'Origine del sito non autorizzata dal proxy.':`Open Food Facts non disponibile (HTTP ${response.status}).`;
      const message=typeof data.error==='string'?data.error:fallback;
      const detail=data.code?` [${data.code}]`:'';
      throw Object.assign(new Error(message+detail),{status:response.status,code:data.code,requestId:data.requestId});
    }
    if(!Array.isArray(data.products))throw new Error('Risposta del proxy Open Food Facts non valida.');
    const codes=new Set();
    const products=data.products.filter(p=>p&&typeof p.product_name==='string'&&p.product_name.trim())
      .filter(p=>{const code=String(p.code??'');if(!code)return true;if(codes.has(code))return false;codes.add(code);return true;})
      .slice(0,PAGE_SIZE).map(p=>({...mapOffToAlimento(p),_off_source:true}));
    writeCache(key,products);return structuredClone(products.slice(0,maxResults));
  }catch(error){
    if(controller.signal.aborted&&!signal?.aborted)throw new Error('La ricerca ha superato il tempo massimo. Riprova tra poco.');
    throw error;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

// Nomi simili non identificano lo stesso prodotto: le formulazioni possono cambiare.
export async function checkDuplicate(product,localFoods) {
  const code=product.off_code;
  if(!code)return null;
  const alimento=localFoods.find(a=>String(a.off_code||'')===String(code));
  return alimento?{alimento,metodo:'barcode'}:null;
}

export async function importOffProdotto(product,userId) {
  const {data:{session},error}=await sb.auth.getSession();
  if(error)throw error;
  if(!session?.user?.id||session.user.id!==userId)throw new Error('Utente non valido per l importazione.');
  async function existing() {
    if(!product.off_code)return null;
    const {data}=await sb.from('alimenti').select('*').eq('off_code',product.off_code).limit(1).throwOnError();
    return data?.[0]||null;
  }
  const match=await existing();
  if(match)return match;
  const fields=['off_code','nome','categoria','energia_kcal','energia_kj','proteine_g','carboidrati_g',
    'zuccheri_g','lipidi_g','grassi_saturi_g','fibra_g','sodio_mg','porzione_default_g','note_porzione'];
  const payload={user_id:userId,abilitato:true};
  for(const field of fields)if(product[field]!==undefined)payload[field]=product[field];
  const {data,error:insertError}=await sb.from('alimenti').insert(payload).select().single();
  if(insertError?.code==='23505'){const match=await existing();if(match)return match;}
  if(insertError)throw insertError;
  return data;
}
