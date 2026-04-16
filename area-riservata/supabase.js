/**
 * supabase.js — Client Supabase condiviso + tutte le funzioni DB
 * Importato da ogni pagina HTML con:
 *   import { sb, requireAuth, ... } from './js/supabase.js';
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ─── CONFIG — sostituire con valori reali ──────────────────────────────────
export const SUPABASE_URL      = 'https://lzxkfknqzvmykuumorwy.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_7Y5FPJcg9sDS653DPBB3sg_oHipCyFT';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

// ─── AUTH ──────────────────────────────────────────────────────────────────

/** Verifica sessione. Se non autenticato, redirect al login */
export async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = './index.html'; return null; }
  return session.user;
}

export async function login(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  await sb.auth.signOut();
  window.location.href = './index.html';
}

// ─── DASHBOARD KPI ────────────────────────────────────────────────────────

/**
 * Restituisce KPI per mese corrente e precedente.
 * Usa date_trunc lato DB per efficienza.
 */
export async function getKpiMensili() {
  const now = new Date();
  const inizioMeseCorr  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const inizioMesePrec  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const fineRicerca     = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data, error } = await sb
    .from('visite')
    .select(`
      id,
      data_visita,
      prestazioni(id, nome)
    `)
    .gte('data_visita', inizioMesePrec)
    .lte('data_visita', fineRicerca)
    .order('data_visita', { ascending: false });

  if (error) throw error;

  // Aggrega lato client (evita view con security_invoker per semplicità)
  const meseCorr = new Date(now.getFullYear(), now.getMonth(), 1);
  const mesePrec = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  function aggregaPerMese(visite, mese) {
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
    corrente: { mese: meseCorr, ...aggregaPerMese(data, meseCorr) },
    precedente: { mese: mesePrec, ...aggregaPerMese(data, mesePrec) },
  };
}

/** Contatori globali per le stat card */
export async function getStatGlobali() {
  const [r1, r2, r3, r4] = await Promise.all([
    sb.from('pazienti').select('*', { count: 'exact', head: true }),
    sb.from('visite').select('*', { count: 'exact', head: true }),
    sb.from('strutture').select('*', { count: 'exact', head: true }),
    sb.from('prestazioni').select('*', { count: 'exact', head: true }),
  ]);
  return {
    pazienti:   r1.count ?? 0,
    visite:     r2.count ?? 0,
    strutture:  r3.count ?? 0,
    prestazioni: r4.count ?? 0,
  };
}

// ─── PAZIENTI ─────────────────────────────────────────────────────────────

/**
 * Ricerca avanzata pazienti
 * @param {Object} filtri - { search, sesso, citta, eta_min, eta_max, order }
 */
export async function searchPazienti({ search = '', sesso = '', citta = '',
  eta_min = null, eta_max = null, order = 'cognome' } = {}) {

  let q = sb.from('pazienti').select(`
    id, nome, cognome, data_nascita, codice_fiscale, sesso, citta, created_at
  `);

  // Ricerca testuale (nome, cognome, CF)
  if (search.trim()) {
    q = q.or(
      `cognome.ilike.%${search}%,nome.ilike.%${search}%,codice_fiscale.ilike.%${search.toUpperCase()}%`
    );
  }

  if (sesso)    q = q.eq('sesso', sesso);
  if (citta)    q = q.ilike('citta', `%${citta}%`);

  // Filtro età: converti in range date_nascita
  if (eta_min != null) {
    const dataMax = new Date();
    dataMax.setFullYear(dataMax.getFullYear() - eta_min);
    q = q.lte('data_nascita', dataMax.toISOString().split('T')[0]);
  }
  if (eta_max != null) {
    const dataMin = new Date();
    dataMin.setFullYear(dataMin.getFullYear() - eta_max - 1);
    q = q.gte('data_nascita', dataMin.toISOString().split('T')[0]);
  }

  // Ordinamento
  if (order === 'data_creazione') {
    q = q.order('created_at', { ascending: false });
  } else {
    q = q.order('cognome').order('nome');
  }

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
  } else {
    const { data, error } = await sb.from('pazienti').insert(payload).select().single();
    if (error) throw error;
    return data;
  }
}

export async function deletePaziente(id) {
  const { error } = await sb.from('pazienti').delete().eq('id', id);
  if (error) throw error;
}

// ─── VISITE ───────────────────────────────────────────────────────────────

/**
 * Lista visite globale (sezione visite)
 * Ordinate per data DESC, con join paziente + struttura + prestazione
 * Supporta filtri per struttura e prestazione
 */
export async function getListaVisite({ struttura_id = null, prestazione_id = null,
  limit = 10, offset = 0 } = {}) {

  let q = sb.from('visite')
    .select(`
      id, data_visita, peso_kg, bmi,
      pazienti(id, nome, cognome),
      strutture(id, nome),
      prestazioni(id, nome)
    `, { count: 'exact' })
    .order('data_visita', { ascending: false })
    .range(offset, offset + limit - 1);

  if (struttura_id)    q = q.eq('struttura_id', struttura_id);
  if (prestazione_id)  q = q.eq('prestazione_id', prestazione_id);

  const { data, error, count } = await q;
  if (error) throw error;
  return { visite: data, totale: count };
}

/** Visite di un singolo paziente */
export async function getVisitePaziente(pazienteId) {
  const { data, error } = await sb.from('visite')
    .select('*, strutture(nome), prestazioni(id, nome)')
    .eq('paziente_id', pazienteId)
    .order('data_visita', { ascending: false });
  if (error) throw error;
  return data;
}

/** Ultima visita di un paziente (per i valori di riferimento) */
export async function getUltimaVisita(pazienteId) {
  const { data, error } = await sb.from('visite')
    .select('peso_kg, bmi, vita_cm, fianchi_cm, braccio_cm, ffm_kg, fm_kg, ecw_l, tbw_l, bia_angolo_fase')
    .eq('paziente_id', pazienteId)
    .order('data_visita', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data; // null se prima visita
}

export async function saveVisita(payload, editingId = null) {
  if (editingId) {
    const { user_id, paziente_id, ...upd } = payload;
    const { data, error } = await sb.from('visite').update(upd).eq('id', editingId).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await sb.from('visite').insert(payload).select().single();
    if (error) throw error;
    return data;
  }
}

export async function deleteVisita(id) {
  const { error } = await sb.from('visite').delete().eq('id', id);
  if (error) throw error;
}

// ─── STRUTTURE ────────────────────────────────────────────────────────────

export async function getStrutture() {
  const { data, error } = await sb.from('strutture').select('*').order('nome');
  if (error) throw error;
  return data;
}

export async function saveStruttura({ nome, indirizzo }, userId) {
  const { data, error } = await sb.from('strutture')
    .insert({ user_id: userId, nome, indirizzo: indirizzo || null })
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteStruttura(id) {
  const { error } = await sb.from('strutture').delete().eq('id', id);
  if (error) throw error;
}

// ─── PRESTAZIONI ──────────────────────────────────────────────────────────

export async function getPrestazioni() {
  const { data, error } = await sb.from('prestazioni')
    .select('*, prestazioni_strutture(struttura_id)')
    .order('nome');
  if (error) throw error;
  return data;
}

export async function savePrestazione({ nome, descrizione, durata_minuti, prezzo,
  struttura_ids = [] }, userId, editingId = null) {

  let prestazioneId;

  if (editingId) {
    const { error } = await sb.from('prestazioni')
      .update({ nome, descrizione, durata_minuti: durata_minuti || null, prezzo: prezzo || null })
      .eq('id', editingId);
    if (error) throw error;
    prestazioneId = editingId;
    // Rimuovi associazioni strutture precedenti
    await sb.from('prestazioni_strutture').delete().eq('prestazione_id', editingId);
  } else {
    const { data, error } = await sb.from('prestazioni')
      .insert({ user_id: userId, nome, descrizione, durata_minuti: durata_minuti || null, prezzo: prezzo || null })
      .select().single();
    if (error) throw error;
    prestazioneId = data.id;
  }

  // Inserisci nuove associazioni strutture
  if (struttura_ids.length > 0) {
    const rows = struttura_ids.map(sid => ({
      user_id: userId, prestazione_id: prestazioneId, struttura_id: sid
    }));
    const { error } = await sb.from('prestazioni_strutture').insert(rows);
    if (error) throw error;
  }

  return prestazioneId;
}

export async function deletePrestazione(id) {
  const { error } = await sb.from('prestazioni').delete().eq('id', id);
  if (error) throw error;
}
