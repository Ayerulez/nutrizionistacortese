import { sb, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';
import { mapOffToAlimento } from './off-model.js';
export { mapOffToAlimento } from './off-model.js';
const cache=new Map();
const TTL=24*60*60*1000;
let lastRequest=0;

export async function searchOpenFoodFacts(query,maxResults=25,{signal}={}) {
  query=String(query??'').trim();
  if(query.length<3)return [];
  if(query.length>100)throw new Error('Ricerca troppo lunga (massimo 100 caratteri).');
  maxResults=Math.max(1,Math.min(25,Math.trunc(maxResults)||25));
  const {data:{session},error}=await sb.auth.getSession();
  if(error)throw error;
  if(!session?.access_token)throw new Error('Accedi di nuovo per cercare su Open Food Facts.');
  const key=`${session.user.id}:${maxResults}:${query.toLowerCase()}`;
  const cached=cache.get(key);
  if(cached&&Date.now()-cached.at<TTL)return structuredClone(cached.products);
  const remaining=6500-(Date.now()-lastRequest);
  if(remaining>0)throw new Error(`Attendi ${Math.ceil(remaining/1000)} secondi prima di una nuova ricerca esterna.`);
  if(signal?.aborted)throw new DOMException('Ricerca annullata','AbortError');
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,15000);
  lastRequest=Date.now();
  try {
    const params=new URLSearchParams({q:query,page_size:String(maxResults)});
    const response=await fetch(`${SUPABASE_URL}/functions/v1/off-proxy?${params}`,{
      headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${session.access_token}`},
      signal:controller.signal,
    });
    if(!response.ok) {
      if(response.status===401||response.status===403)throw new Error('Il proxy Open Food Facts ha rifiutato l accesso. Accedi di nuovo e controlla la funzione off-proxy.');
      if(response.status===429)throw new Error('Limite di Open Food Facts raggiunto. Riprova tra un minuto.');
      throw new Error(`Open Food Facts non disponibile (HTTP ${response.status}).`);
    }
    const data=await response.json();
    if(!Array.isArray(data.products))throw new Error('Risposta del proxy Open Food Facts non valida.');
    const codes=new Set();
    const products=data.products.filter(p=>p&&typeof p.product_name==='string'&&p.product_name.trim())
      .filter(p=>{const code=String(p.code??'');if(!code)return true;if(codes.has(code))return false;codes.add(code);return true;})
      .slice(0,maxResults).map(p=>({...mapOffToAlimento(p),_off_source:true}));
    if(cache.size>=100)cache.delete(cache.keys().next().value);
    cache.set(key,{at:Date.now(),products});
    return structuredClone(products);
  } catch(error) {
    if(controller.signal.aborted&&!signal?.aborted)throw new Error('Open Food Facts non risponde. Riprova più tardi.');
    throw error;
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
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
