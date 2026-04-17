/**
 * supabase.js — Client + Auth + DB functions
 *
 * SESSIONE (fix loop):
 *   login.html  = pubblica → chiama redirectIfAuth() → va a index.html se già loggato
 *   altre pagine = protette → chiamano requireAuth() → vanno a login.html se non loggato
 *   logout()    = sempre → login.html
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ─── CONFIG — sostituire con i valori reali ───────────────────────────────
export const SUPABASE_URL      = 'https://lzxkfknqzvmykuumorwy.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_7Y5FPJcg9sDS653DPBB3sg_oHipCyFT';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

// ─── AUTH ─────────────────────────────────────────────────────────────────

export async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.replace('./login.html'); return null; }
  return session.user;
}

export async function redirectIfAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) window.location.replace('./index.html');
}

export async function login(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  await sb.auth.signOut();
  window.location.replace('./login.html');
}

// ─── DASHBOARD KPI ────────────────────────────────────────────────────────

export async function getKpiMensili() {
  const now = new Date();
  const inizioMeseCorr = new Date(now.getFullYear(), now.getMonth(),     1).toISOString().split('T')[0];
  const inizioMesePrec = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const fineRicerca    = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data, error } = await sb
    .from('visite')
    .select('id, data_visita, prestazioni(id, nome)')
    .gte('data_visita', inizioMesePrec)
    .lte('data_visita', fineRicerca);
  if (error) throw error;

  const meseCorr = new Date(now.getFullYear(), now.getMonth(),     1);
  const mesePrec = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  function aggrega(visite, mese) {
    const filtered = visite.filter(v => {
      const d = new Date(v.data_visita);
      return d.getFullYear() === mese.getFullYear() && d.getMonth() === mese.getMonth();
    });
    const map = {};
    filtered.forEach(v => {
      const nome = v.prestazioni?.nome ?? 'Non specificata';
      map[nome] = (map[nome] ?? 0) + 1;
    });
    return { totale: filtered.length, breakdown: map };
  }

  return {
    corrente:   { mese: meseCorr, ...aggrega(data, meseCorr) },
    precedente: { mese: mesePrec, ...aggrega(data, mesePrec) },
  };
}

export async function getStatGlobali() {
  const [r1, r2, r3, r4] = await Promise.all([
    sb.from('pazienti').select('*',    { count: 'exact', head: true }),
    sb.from('visite').select('*',      { count: 'exact', head: true }),
    sb.from('strutture').select('*',   { count: 'exact', head: true }).eq('abilitato', true),
    sb.from('prestazioni').select('*', { count: 'exact', head: true }).eq('abilitato', true),
  ]);
  return {
    pazienti:    r1.count ?? 0,
    visite:      r2.count ?? 0,
    strutture:   r3.count ?? 0,
    prestazioni: r4.count ?? 0,
  };
}

// ─── PAZIENTI ─────────────────────────────────────────────────────────────

export async function searchPazienti({
  search = '', sesso = '', citta = '',
  eta_min = null, eta_max = null, order = 'cognome',
} = {}) {
  let q = sb.from('pazienti').select(
    'id, nome, cognome, data_nascita, codice_fiscale, sesso, citta, created_at, altezza_cm'
  );

  if (search.trim()) {
    q = q.or(`cognome.ilike.%${search}%,nome.ilike.%${search}%,codice_fiscale.ilike.%${search.toUpperCase()}%`);
  }
  if (sesso) q = q.eq('sesso', sesso);
  if (citta) q = q.ilike('citta', `%${citta}%`);

  if (eta_min != null) {
    const d = new Date(); d.setFullYear(d.getFullYear() - eta_min);
    q = q.lte('data_nascita', d.toISOString().split('T')[0]);
  }
  if (eta_max != null) {
    const d = new Date(); d.setFullYear(d.getFullYear() - eta_max - 1);
    q = q.gte('data_nascita', d.toISOString().split('T')[0]);
  }

  q = order === 'data_creazione'
    ? q.order('created_at', { ascending: false })
    : q.order('cognome').order('nome');

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getPaziente(id) {
  const { data, error } = await sb.from('pazienti').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function savePaziente(payload, editingId = null) {
  if (editingId) {
    const { user_id, ...upd } = payload;
    const { data, error } = await sb.from('pazienti').update(upd).eq('id', editingId).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await sb.from('pazienti').insert(payload).select().single();
  if (error) throw error;
  return data;
}

// NESSUN deletePaziente — soft delete non applicato ai pazienti per policy

// ─── VISITE ───────────────────────────────────────────────────────────────

export async function getListaVisite({
  struttura_id = null, prestazione_id = null, limit = 10, offset = 0,
} = {}) {
  let q = sb.from('visite')
    .select(
      'id, data_visita, peso_kg, bmi, pazienti(id, nome, cognome), strutture(id, nome), prestazioni(id, nome)',
      { count: 'exact' }
    )
    .order('data_visita', { ascending: false })
    .range(offset, offset + limit - 1);

  if (struttura_id)   q = q.eq('struttura_id',   struttura_id);
  if (prestazione_id) q = q.eq('prestazione_id', prestazione_id);

  const { data, error, count } = await q;
  if (error) throw error;
  return { visite: data, totale: count };
}

export async function getVisitePaziente(pazienteId) {
  const { data, error } = await sb.from('visite')
    .select('*, strutture(nome), prestazioni(id, nome)')
    .eq('paziente_id', pazienteId)
    .order('data_visita', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Ultima visita: include altezza_cm per calcolo BMI auto nelle visite successive.
 * Restituisce null se è la prima visita.
 */
export async function getUltimaVisita(pazienteId) {
  const { data, error } = await sb.from('visite')
    .select(`
      id, data_visita,
      peso_kg, bmi, vita_cm, fianchi_cm, braccio_cm,
      ffm_kg, fm_kg, ecw_l, tbw_l, bia_angolo_fase,
      mb_attuale, fe_attuale, altezza_cm
    `)
    .eq('paziente_id', pazienteId)
    .order('data_visita', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveVisita(payload, editingId = null) {
  if (editingId) {
    const { user_id, paziente_id, ...upd } = payload;
    const { data, error } = await sb.from('visite').update(upd).eq('id', editingId).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await sb.from('visite').insert(payload).select().single();
  if (error) throw error;
  return data;
}

// NESSUN deleteVisita — le visite non si eliminano per policy

// ─── STRUTTURE ────────────────────────────────────────────────────────────

/**
 * @param {boolean|null} soloAbilitate - true = solo abilitate (default),
 *   false = solo disabilitate, null = tutte
 */
export async function getStrutture(soloAbilitate = true) {
  let q = sb.from('strutture').select('*').order('nome');
  if (soloAbilitate === true)  q = q.eq('abilitato', true);
  if (soloAbilitate === false) q = q.eq('abilitato', false);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function saveStruttura({ nome, indirizzo }, userId) {
  const { data, error } = await sb.from('strutture')
    .insert({ user_id: userId, nome, indirizzo: indirizzo || null, abilitato: true })
    .select().single();
  if (error) throw error;
  return data;
}

/** Soft disable/enable struttura (mai eliminazione fisica) */
export async function toggleStruttura(id, abilitato) {
  const { error } = await sb.from('strutture').update({ abilitato }).eq('id', id);
  if (error) throw error;
}

// ─── PRESTAZIONI ──────────────────────────────────────────────────────────

/**
 * @param {boolean|null} soloAbilitate - true = solo abilitate, false = disabilitate, null = tutte
 */
export async function getPrestazioni(soloAbilitate = true) {
  let q = sb.from('prestazioni')
    .select('*, prestazioni_strutture(struttura_id, prezzo_override)')
    .order('nome');
  if (soloAbilitate === true)  q = q.eq('abilitato', true);
  if (soloAbilitate === false) q = q.eq('abilitato', false);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/**
 * FIX BUG UUID:
 * struttura_ids è array di { id: string, prezzo_override: number|null }
 * Usiamo String() esplicito per garantire che struttura_id sia sempre una stringa UUID.
 */
export async function savePrestazione({
  nome, descrizione, durata_minuti, prezzo, struttura_ids = [],
}, userId, editingId = null) {

  let prestazioneId;

  if (editingId) {
    const { error } = await sb.from('prestazioni')
      .update({
        nome,
        descrizione:    descrizione    || null,
        durata_minuti:  durata_minuti  || null,
        prezzo:         prezzo         || null,
      })
      .eq('id', editingId);
    if (error) throw error;
    prestazioneId = editingId;
    // Rimuovi vecchie associazioni
    const { error: delErr } = await sb.from('prestazioni_strutture')
      .delete().eq('prestazione_id', editingId);
    if (delErr) throw delErr;
  } else {
    const { data, error } = await sb.from('prestazioni')
      .insert({
        user_id:       userId,
        nome,
        descrizione:   descrizione   || null,
        durata_minuti: durata_minuti || null,
        prezzo:        prezzo        || null,
        abilitato:     true,
      })
      .select().single();
    if (error) throw error;
    prestazioneId = data.id;
  }

  // Inserisci nuove associazioni strutture
  // FIX: conversione esplicita a stringa UUID per evitare "invalid input syntax for type uuid"
  if (struttura_ids.length > 0) {
    const rows = struttura_ids.map(item => ({
      user_id:         String(userId),
      prestazione_id:  String(prestazioneId),
      struttura_id:    String(item.id),           // ← String() esplicito, bug fix
      prezzo_override: item.prezzo_override != null
        ? parseFloat(item.prezzo_override)
        : null,
    }));
    const { error } = await sb.from('prestazioni_strutture').insert(rows);
    if (error) throw error;
  }

  return prestazioneId;
}

/** Soft disable/enable prestazione (mai eliminazione fisica) */
export async function togglePrestazione(id, abilitato) {
  const { error } = await sb.from('prestazioni').update({ abilitato }).eq('id', id);
  if (error) throw error;
}

// ─── PATOLOGIE ────────────────────────────────────────────────────────────

/** Catalogo patologie (tabella pubblica, visibile a tutti gli autenticati) */
export async function getPatologieCatalogo() {
  const { data, error } = await sb.from('patologie_catalogo')
    .select('id, codice, nome, categoria')
    .order('categoria').order('nome');
  if (error) throw error;
  return data;
}

/** Patologie associate a un paziente */
export async function getPatologiePaziente(pazienteId) {
  const { data, error } = await sb.from('pazienti_patologie')
    .select('id, patologia_id, note, patologie_catalogo(id, codice, nome, categoria)')
    .eq('paziente_id', pazienteId);
  if (error) throw error;
  return data;
}

/** Sostituisce le patologie di un paziente con il nuovo set */
export async function savePatologiePaziente(pazienteId, userId, patologiaIds, note = {}) {
  // Elimina le esistenti
  const { error: delErr } = await sb.from('pazienti_patologie')
    .delete().eq('paziente_id', pazienteId);
  if (delErr) throw delErr;

  if (patologiaIds.length === 0) return;

  const rows = patologiaIds.map(pid => ({
    user_id:     String(userId),
    paziente_id: String(pazienteId),
    patologia_id: String(pid),
    note:        note[pid] || null,
  }));
  const { error } = await sb.from('pazienti_patologie').insert(rows);
  if (error) throw error;
}
