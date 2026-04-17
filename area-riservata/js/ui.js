/**
 * ui.js — Helper UI condivisi tra tutte le pagine
 *
 * ARCHITETTURA MODALE:
 * I moduli ES hanno scope isolato — funzioni come closeModal non finiscono
 * su window automaticamente. Soluzione adottata:
 *   1. ModalManager gestisce tutto via event delegation (data-modal-open/close)
 *   2. Ogni pagina chiama initUI() una volta all'avvio
 *   3. initUI() espone window.closeModal/openModal come safety net globale
 *   4. Zero onclick inline nei template HTML
 */

// ─── LOADING ──────────────────────────────────────────────────────────────
export function loading(show, text = 'Caricamento…') {
  const el = document.getElementById('loading-overlay');
  const tx = document.getElementById('loading-text');
  if (el) el.classList.toggle('show', show);
  if (tx && text) tx.textContent = text;
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
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
export function hideAlert(id) {
  document.getElementById(id)?.classList.remove('show');
}

// ─── BUTTON LOADING ───────────────────────────────────────────────────────
export function setBtn(id, on) {
  const b = document.getElementById(id);
  if (!b) return;
  b.disabled = on;
  if (on) { b.dataset.orig = b.textContent; b.textContent = 'Attendere…'; }
  else if (b.dataset.orig) b.textContent = b.dataset.orig;
}

// ─── MODAL MANAGER ────────────────────────────────────────────────────────
/**
 * API programmatica:
 *   ModalManager.open('id')
 *   ModalManager.close('id')   ← id opzionale, senza chiude l'ultima aperta
 *   ModalManager.closeAll()
 *
 * API markup (NESSUN onclick inline):
 *   data-modal-open="id"    su qualsiasi elemento cliccabile
 *   data-modal-close        su bottoni X / Annulla (chiude la corrente)
 *   data-modal-close="id"   chiude modale specifica
 */
export const ModalManager = {
  open(id) {
    const el = document.getElementById(id);
    if (!el) { console.warn(`ModalManager.open: #${id} non trovato`); return; }
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const first = el.querySelector(
        'input:not([readonly]):not([disabled]), select, textarea'
      );
      first?.focus();
    });
  },

  close(id) {
    if (id) {
      document.getElementById(id)?.classList.remove('open');
    } else {
      document.querySelector('.modal-overlay.open')?.classList.remove('open');
    }
    if (!document.querySelector('.modal-overlay.open')) {
      document.body.style.overflow = '';
    }
  },

  closeAll() {
    document.querySelectorAll('.modal-overlay.open')
      .forEach(m => m.classList.remove('open'));
    document.body.style.overflow = '';
  },
};

// Alias esportati per uso programmatico nei moduli JS
export const openModal  = id => ModalManager.open(id);
export const closeModal = id => ModalManager.close(id);

/**
 * initUI() — chiamare UNA VOLTA all'avvio di ogni pagina.
 * - Installa event delegation globale per data-modal-open/close
 * - Chiusura con ESC
 * - Espone window.closeModal/openModal come safety net assoluto
 */
export function initUI() {
  // Safety net: previene ReferenceError da qualsiasi onclick residuo
  window.closeModal = id => ModalManager.close(id);
  window.openModal  = id => ModalManager.open(id);

  document.addEventListener('click', e => {
    // Apri modale
    const opener = e.target.closest('[data-modal-open]');
    if (opener) {
      e.preventDefault();
      ModalManager.open(opener.dataset.modalOpen);
      return;
    }
    // Chiudi modale (bottone X, Annulla, o qualsiasi data-modal-close)
    const closer = e.target.closest('[data-modal-close], .modal-close');
    if (closer) {
      e.preventDefault();
      ModalManager.close(closer.dataset.modalClose || undefined);
      return;
    }
    // Click diretto sull'overlay (fuori dal .modal)
    if (e.target.classList.contains('modal-overlay')) {
      ModalManager.close(e.target.id || undefined);
    }
  });

  // ESC chiude tutto
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') ModalManager.closeAll();
  });
}

// Retrocompatibilità con vecchio nome
export const initModals = initUI;

// ─── FORM HELPERS ─────────────────────────────────────────────────────────
export const n   = id => document.getElementById(id);
export const val = id => document.getElementById(id)?.value?.trim() ?? '';
export const flt = id => {
  const v = parseFloat(document.getElementById(id)?.value);
  return isNaN(v) ? null : v;
};
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

// ─── VALORI PRECEDENTI ────────────────────────────────────────────────────
/**
 * Mostra sotto ogni label numerico antropometrico:
 *   "01/02/2026 — 78.2 kg"
 * come .prec-hint, inserito tra <label> e <input>.
 * NON tocca mai campi testuali (note, andamento, indicazioni, ecc.).
 *
 * @param {Object|null} ultimaVisita - riga completa dal DB (getUltimaVisita)
 */
export function showValoriPrecedenti(ultimaVisita) {
  clearValoriPrecedenti();
  if (!ultimaVisita) return;

  const dataPrec = ultimaVisita.data_visita
    ? fmtDateShort(ultimaVisita.data_visita)
    : null;

  const campi = {
    'v-peso':     { v: ultimaVisita.peso_kg,         u: 'kg'   },
    'v-bmi':      { v: ultimaVisita.bmi,             u: ''     },
    'v-vita':     { v: ultimaVisita.vita_cm,         u: 'cm'   },
    'v-fianchi':  { v: ultimaVisita.fianchi_cm,      u: 'cm'   },
    'v-braccio':  { v: ultimaVisita.braccio_cm,      u: 'cm'   },
    'v-ffm':      { v: ultimaVisita.ffm_kg,          u: 'kg'   },
    'v-fm':       { v: ultimaVisita.fm_kg,           u: 'kg'   },
    'v-ecw':      { v: ultimaVisita.ecw_l,           u: 'L'    },
    'v-tbw':      { v: ultimaVisita.tbw_l,           u: 'L'    },
    'v-ang-fase': { v: ultimaVisita.bia_angolo_fase, u: '°'    },
    'v-mb-att':   { v: ultimaVisita.mb_attuale,      u: 'kcal' },
    'v-fe-att':   { v: ultimaVisita.fe_attuale,      u: '%'    },
  };

  Object.entries(campi).forEach(([inputId, { v, u }]) => {
    if (v == null) return;
    const input = document.getElementById(inputId);
    if (!input) return;
    const formGroup = input.closest('.form-group');
    if (!formGroup) return;
    const label = formGroup.querySelector('label');
    if (!label) return;

    const hint = document.createElement('div');
    hint.className = 'prec-hint';
    hint.innerHTML = dataPrec
      ? `<span class="prec-hint__date">${dataPrec}</span><span class="prec-hint__sep">—</span><span class="prec-hint__val">${v}${u ? '\u00a0' + u : ''}</span>`
      : `<span class="prec-hint__val">Prec: ${v}${u ? '\u00a0' + u : ''}</span>`;

    label.insertAdjacentElement('afterend', hint);
    input.placeholder = `Es: ${v}`;
    input.dataset.precVal = String(v);
  });
}

export function clearValoriPrecedenti() {
  document.querySelectorAll('.prec-hint').forEach(h => h.remove());
  document.querySelectorAll('[data-prec-val]').forEach(el => {
    el.removeAttribute('placeholder');
    delete el.dataset.precVal;
  });
}
