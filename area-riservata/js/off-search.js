// v=202607022054 — cache bust
/**
 * off-search.js — Integrazione Open Food Facts API
 *
 * Funzionalità:
 * - Ricerca prodotti su OFF con cache Supabase (TTL 24h)
 * - Mapping campi OFF → schema alimenti Supabase
 * - Deduplicazione via off_code (barcode EAN)
 * - Import prodotto esterno nel DB locale
 */

import { sb, SUPABASE_URL } from './supabase.js';

// Proxy Supabase Edge Function — evita CORS
function getOffProxyUrl() {
  return SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/off-proxy';
}
const OFF_FIELDS = 'code,product_name,brands,categories_tags,nutriments,serving_size,image_small_url';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 ore

// ─── MAPPING CATEGORIA OFF → Supabase ────────────────────────────────────────
const CAT_MAP = [
  { tags: ['en:pastas','en:pasta','en:noodles','en:bread','en:breads','en:cereals','en:flours',
           'en:rice','en:grains','en:biscuits','en:crackers','en:breakfast-cereals'],
    cat: 'CEREALI E DERIVATI' },
  { tags: ['en:legumes','en:beans','en:lentils','en:chickpeas','en:peas','en:soybeans'],
    cat: 'LEGUMI' },
  { tags: ['en:vegetables','en:fresh-vegetables','en:frozen-vegetables'],
    cat: 'VERDURA' },
  { tags: ['en:fruits','en:fresh-fruits','en:dried-fruits'],
    cat: 'FRUTTA' },
  { tags: ['en:meats','en:beef','en:chicken','en:pork','en:turkey','en:veal','en:lamb',
           'en:poultry','en:meat'],
    cat: 'CARNE' },
  { tags: ['en:processed-meats','en:deli-meats','en:sausages','en:ham','en:salami'],
    cat: 'CARNI TRASFORMATE' },
  { tags: ['en:offal','en:organ-meats'],
    cat: 'FRATTAGLIE' },
  { tags: ['en:fish','en:seafood','en:fishes','en:tuna','en:salmon','en:cod','en:shrimps',
           'en:shellfish'],
    cat: 'PESCE' },
  { tags: ['en:milks','en:dairy','en:yogurts','en:kefir','en:milk'],
    cat: 'LATTE E YOGURT' },
  { tags: ['en:cheeses','en:cheese'],
    cat: 'FORMAGGI' },
  { tags: ['en:eggs','en:egg-products'],
    cat: 'UOVA' },
  { tags: ['en:fats','en:oils','en:olive-oils','en:butter','en:margarines','en:condiments',
           'en:sauces','en:dressings'],
    cat: 'GRASSI E CONDIMENTI' },
  { tags: ['en:sweets','en:chocolates','en:candies','en:cookies','en:cakes','en:ice-creams',
           'en:jams','en:spreads','en:sweet-spreads'],
    cat: 'DOLCI' },
  { tags: ['en:alcoholic-beverages','en:wines','en:beers','en:spirits'],
    cat: 'ALCOOL' },
];

function mapCategoria(categoryTags) {
  if (!categoryTags || !categoryTags.length) return 'PRODOTTI VARI';
  const tagsLower = categoryTags.map(t => t.toLowerCase());
  for (const rule of CAT_MAP) {
    if (rule.tags.some(rt => tagsLower.some(t => t.includes(rt.replace('en:',''))))) {
      return rule.cat;
    }
  }
  return 'PRODOTTI VARI';
}

function parseServing(servingStr) {
  if (!servingStr) return null;
  const m = servingStr.match(/(\d+(?:[.,]\d+)?)\s*g/i);
  return m ? Math.round(parseFloat(m[1].replace(',','.'))) : null;
}

/**
 * Mappa un prodotto OFF verso lo schema alimenti Supabase.
 */
export function mapOffToAlimento(product) {
  const n = product.nutriments || {};
  const nome = [product.product_name, product.brands]
    .filter(Boolean).join(' — ').trim() || 'Prodotto senza nome';

  return {
    off_code:         product.code || null,
    nome:             nome,
    categoria:        mapCategoria(product.categories_tags),
    energia_kcal:     n['energy-kcal_100g'] ?? n['energy-kcal'] ?? null,
    proteine_g:       n['proteins_100g'] ?? null,
    carboidrati_g:    n['carbohydrates_100g'] ?? null,
    zuccheri_g:       n['sugars_100g'] ?? null,
    lipidi_g:         n['fat_100g'] ?? null,
    grassi_saturi_g:  n['saturated-fat_100g'] ?? null,
    fibra_g:          n['fiber_100g'] ?? null,
    sodio_mg:         n['sodium_100g'] != null ? Math.round(n['sodium_100g'] * 1000) : null,
    sale_g:           n['salt_100g'] ?? null,
    porzione_default_g: parseServing(product.serving_size),
    abilitato:        true,
    // user_id viene aggiunto al momento dell'import
    _off_image:       product.image_small_url || null, // non va in DB, solo display
  };
}

// ─── CACHE ───────────────────────────────────────────────────────────────────
// Cache in memoria (sessione) — livello 1, velocissima
const memCache = new Map();

async function getCached(query) {
  // L1: memoria
  const mem = memCache.get(query);
  if (mem && Date.now() - mem.ts < CACHE_TTL_MS) return mem.data;

  // L2: Supabase
  const { data } = await sb.from('off_search_cache')
    .select('risultati,created_at')
    .eq('query', query)
    .maybeSingle();  // maybeSingle: null se non trovato, non 406

  if (data) {
    const age = Date.now() - new Date(data.created_at).getTime();
    if (age < CACHE_TTL_MS) {
      memCache.set(query, { data: data.risultati, ts: Date.now() - age });
      return data.risultati;
    }
  }
  return null;
}

async function setCache(query, risultati) {
  memCache.set(query, { data: risultati, ts: Date.now() });
  // Scrivi su Supabase in background (upsert)
  sb.from('off_search_cache')
    .upsert({ query, risultati, created_at: new Date().toISOString() })
    .then(() => {})
    .catch(() => {});
}

// ─── RICERCA OFF ─────────────────────────────────────────────────────────────
/**
 * Cerca su Open Food Facts.
 * Restituisce array di prodotti già mappati con campo _off_source=true.
 * Usa cache L1 (memoria) + L2 (Supabase).
 */
export async function searchOpenFoodFacts(query, maxResults = 15) {
  if (!query || query.length < 2) return [];

  const cacheKey = `off:${query.toLowerCase().trim()}`;

  // Prova cache
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const proxyUrl = getOffProxyUrl();
  const params = new URLSearchParams({
    q:         query,
    page_size: String(maxResults),
    lc:        'it',
    cc:        'it',
  });

  try {
    const res = await fetch(`${proxyUrl}?${params}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const prodotti = (data.products || [])
      .filter(p => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
      .map(p => ({ ...mapOffToAlimento(p), _off_source: true, _off_raw: p }));

    await setCache(cacheKey, prodotti);
    return prodotti;
  } catch (e) {
    console.warn('OFF search error:', e.message);
    return [];
  }
}

// ─── DEDUPLICAZIONE ──────────────────────────────────────────────────────────
/**
 * Dato un prodotto OFF, verifica se esiste già nel DB locale.
 * Logica a cascata:
 *   1. Match esatto su off_code (barcode EAN)
 *   2. Match fuzzy su nome (similarità ≥ 80%)
 * Restituisce l'alimento locale se trovato, altrimenti null.
 */
export async function checkDuplicate(offProdotto, allLocalAlimenti) {
  // 1. Match barcode
  if (offProdotto.off_code) {
    const byCode = allLocalAlimenti.find(a => a.off_code === offProdotto.off_code);
    if (byCode) return { alimento: byCode, metodo: 'barcode' };
  }

  // 2. Match fuzzy nome (normalizza: lowercase, no brand, no punteggiatura)
  const normalize = s => s.toLowerCase()
    .replace(/[^a-z0-9àèéìòù\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  const nomeOff = normalize(offProdotto.nome.split('—')[0]); // solo product_name
  const threshold = 0.75;

  for (const loc of allLocalAlimenti) {
    const nomeLoc = normalize(loc.nome);
    const sim = similarity(nomeOff, nomeLoc);
    if (sim >= threshold) return { alimento: loc, metodo: 'nome', similarita: sim };
  }
  return null;
}

// Algoritmo Sørensen–Dice per similarità stringhe
function similarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = new Set(), bigramsB = new Set();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a[i] + a[i+1]);
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b[i] + b[i+1]);
  let inter = 0;
  for (const bg of bigramsA) if (bigramsB.has(bg)) inter++;
  return (2 * inter) / (bigramsA.size + bigramsB.size);
}

// ─── IMPORT ──────────────────────────────────────────────────────────────────
/**
 * Importa un prodotto OFF nel DB Supabase locale.
 * Restituisce il nuovo record alimento.
 */
export async function importOffProdotto(offProdotto, userId) {
  const payload = { ...offProdotto };
  // Rimuovi campi non DB
  delete payload._off_source;
  delete payload._off_raw;
  delete payload._off_image;

  payload.user_id = userId; // alimento custom dell'utente

  const { data, error } = await sb.from('alimenti').insert(payload).select().single();
  if (error) throw error;
  return data;
}
