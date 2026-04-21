/**
 * ui.js — Helper UI condivisi
 *
 * Novità v2:
 * - confirmClose: banner "dati non salvati" su ogni modal con dati
 * - ModalManager registra se una modale ha modifiche pendenti
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

// ─── DIRTY TRACKING ──────────────────────────────────────────────────────
/**
 * Tiene traccia di quali modali hanno modifiche non salvate.
 * Usare markDirty(modalId) quando l'utente inizia a modificare un campo.
 * Usare markClean(modalId) dopo il salvataggio.
 */
const _dirtyModals = new Set();

export function markDirty(modalId) { _dirtyModals.add(modalId); }
export function markClean(modalId) { _dirtyModals.delete(modalId); }
export function isDirty(modalId)   { return _dirtyModals.has(modalId); }

// ─── MODAL MANAGER ────────────────────────────────────────────────────────
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

  /**
   * Chiude la modale.
   * Se la modale è "dirty" (ha modifiche non salvate), mostra un banner
   * di conferma invece di chiudere immediatamente.
   */
  close(id) {
    const targetId = id ?? document.querySelector('.modal-overlay.open')?.id;
    if (!targetId) { document.body.style.overflow = ''; return; }

    if (_dirtyModals.has(targetId)) {
      _showConfirmBanner(targetId);
      return;
    }
    _doClose(targetId);
  },

  closeAll() {
    // Chiudi solo le modali pulite; le dirty mostrano il banner
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      if (_dirtyModals.has(m.id)) {
        _showConfirmBanner(m.id);
      } else {
        m.classList.remove('open');
      }
    });
    if (!document.querySelector('.modal-overlay.open')) {
      document.body.style.overflow = '';
    }
  },

  forceClose(id) {
    // Chiude senza controllo dirty (usato dopo salvataggio)
    const targetId = id ?? document.querySelector('.modal-overlay.open')?.id;
    _dirtyModals.delete(targetId);
    _doClose(targetId);
  },
};

function _doClose(id) {
  if (id) document.getElementById(id)?.classList.remove('open');
  else document.querySelector('.modal-overlay.open')?.classList.remove('open');
  if (!document.querySelector('.modal-overlay.open')) {
    document.body.style.overflow = '';
  }
  _hideConfirmBanner();
}

function _showConfirmBanner(modalId) {
  // Crea il banner se non esiste
  let banner = document.getElementById('_confirm-close-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = '_confirm-close-banner';
    banner.className = 'confirm-close-banner';
    banner.innerHTML = `
      <p>⚠ Hai modifiche non salvate. Uscire senza salvare?</p>
      <button class="btn btn-ghost btn-sm" id="_ccb-stay" style="border-color:rgba(255,255,255,.3);color:white;">Rimani</button>
      <button class="btn btn-danger btn-sm" id="_ccb-leave">Esci senza salvare</button>`;
    document.body.appendChild(banner);
  }
  banner.classList.add('show');
  banner.dataset.targetModal = modalId;

  document.getElementById('_ccb-stay').onclick = _hideConfirmBanner;
  document.getElementById('_ccb-leave').onclick = () => {
    _dirtyModals.delete(modalId);
    _doClose(modalId);
  };
}

function _hideConfirmBanner() {
  document.getElementById('_confirm-close-banner')?.classList.remove('show');
}

// Alias esportati
export const openModal  = id => ModalManager.open(id);
export const closeModal = id => ModalManager.close(id);

/**
 * initUI() — chiamare UNA VOLTA all'avvio di ogni pagina.
 * - Installa event delegation per data-modal-open/close
 * - Gestisce ESC con controllo dirty
 * - Registra input listener per markDirty automatico su tutti i modal
 */
export function initUI() {
  window.closeModal = id => ModalManager.close(id);
  window.openModal  = id => ModalManager.open(id);

  document.addEventListener('click', e => {
    const opener = e.target.closest('[data-modal-open]');
    if (opener) { e.preventDefault(); ModalManager.open(opener.dataset.modalOpen); return; }

    const closer = e.target.closest('[data-modal-close], .modal-close');
    if (closer) { e.preventDefault(); ModalManager.close(closer.dataset.modalClose || undefined); return; }

    // Click su overlay
    if (e.target.classList.contains('modal-overlay')) {
      ModalManager.close(e.target.id || undefined);
    }
  });

  // ESC con controllo dirty
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') ModalManager.closeAll();
  });

  // Auto-markDirty: ogni input/change dentro una modal-overlay segna la modal come dirty
  document.addEventListener('input', e => {
    const modal = e.target.closest('.modal-overlay');
    if (modal) markDirty(modal.id);
  });
  document.addEventListener('change', e => {
    const modal = e.target.closest('.modal-overlay');
    if (modal) markDirty(modal.id);
  });
}

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
