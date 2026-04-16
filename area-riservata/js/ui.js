/**
 * ui.js — Helper UI condivisi tra tutte le pagine
 */

// ─── LOADING ──────────────────────────────────────────────────────────────
export function loading(show, text = 'Caricamento…') {
  const el = document.getElementById('loading-overlay');
  const tx = document.getElementById('loading-text');
  if (el) el.classList.toggle('show', show);
  if (tx) tx.textContent = text;
}

// ─── TOAST ────────────────────────────────────────────────────────────────
export function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = (type === 'success' ? '✓ ' : '✕ ') + msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ─── ALERT ────────────────────────────────────────────────────────────────
export function showAlert(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}
export function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

// ─── BUTTON LOADING ───────────────────────────────────────────────────────
export function setBtn(id, on) {
  const b = document.getElementById(id);
  if (!b) return;
  b.disabled = on;
  b.dataset.orig = b.dataset.orig || b.textContent;
  b.textContent = on ? 'Attendere…' : b.dataset.orig;
}

// ─── MODAL ────────────────────────────────────────────────────────────────
export function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
export function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

/** Chiudi modal cliccando overlay */
export function initModals() {
  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
  );
}

// ─── FORM ─────────────────────────────────────────────────────────────────
export const n   = id => document.getElementById(id);
export const val = id => document.getElementById(id)?.value?.trim() ?? '';
export const flt = id => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v; };

export function resetFields(ids) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

// ─── DATE FORMAT ──────────────────────────────────────────────────────────
export function fmtDate(iso, opts = { day: '2-digit', month: 'long', year: 'numeric' }) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('it-IT', opts);
}
export function fmtDateShort(iso) {
  return fmtDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Calcola età da data_nascita */
export function calcEta(dataNascita) {
  if (!dataNascita) return null;
  return Math.floor((Date.now() - new Date(dataNascita)) / (365.25 * 24 * 3600 * 1000));
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────
export function emptyState(icon, title, text = '') {
  return `<div class="empty-state">
    <div class="empty-state__icon">${icon}</div>
    <h3>${title}</h3>
    ${text ? `<p>${text}</p>` : ''}
  </div>`;
}

// ─── NAVIGATION (sidebar active) ──────────────────────────────────────────
export function setActiveNav(page) {
  document.querySelectorAll('.sidebar-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });
}

// ─── VALORE PRECEDENTE (UX visita) ────────────────────────────────────────
/**
 * Mostra i valori della visita precedente come placeholder grigio
 * nei campi numerici del form visita.
 * @param {Object} ultimaVisita - dati ultima visita dal DB
 */
export function showValoriPrecedenti(ultimaVisita) {
  if (!ultimaVisita) return;

  const mappaCampi = {
    'v-peso':    ultimaVisita.peso_kg,
    'v-bmi':     ultimaVisita.bmi,
    'v-vita':    ultimaVisita.vita_cm,
    'v-fianchi': ultimaVisita.fianchi_cm,
    'v-braccio': ultimaVisita.braccio_cm,
    'v-ffm':     ultimaVisita.ffm_kg,
    'v-fm':      ultimaVisita.fm_kg,
    'v-ecw':     ultimaVisita.ecw_l,
    'v-tbw':     ultimaVisita.tbw_l,
    'v-ang-fase':ultimaVisita.bia_angolo_fase,
  };

  Object.entries(mappaCampi).forEach(([id, valore]) => {
    const el = document.getElementById(id);
    if (!el || valore == null) return;
    // Mostra come placeholder + badge grigio
    el.placeholder = `↩ Prec.: ${valore}`;
    el.dataset.precedente = valore;
    // Aggiunge badge visivo accanto al campo
    const badge = el.nextElementSibling;
    if (badge?.classList.contains('prec-badge')) badge.remove();
    const b = document.createElement('span');
    b.className = 'prec-badge';
    b.textContent = `Prec. ${valore}`;
    el.insertAdjacentElement('afterend', b);
  });
}

/** Rimuovi tutti i badge "precedente" */
export function clearValoriPrecedenti() {
  document.querySelectorAll('.prec-badge').forEach(b => b.remove());
  document.querySelectorAll('[data-precedente]').forEach(el => {
    el.placeholder = '';
    delete el.dataset.precedente;
  });
}
