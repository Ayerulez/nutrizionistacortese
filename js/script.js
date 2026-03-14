/**
 * nutrizionistacortese.it — Vanilla JS v2
 * Header sticky · Menu mobile · Scroll reveal · Counter · Form · Back-to-top
 */
(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     1. Sticky header
  ----------------------------------------------------------------------- */
  const header = document.querySelector('.header');
  const onScroll = () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* -----------------------------------------------------------------------
     2. Mobile menu
  ----------------------------------------------------------------------- */
  const hamburger  = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');

  function closeMobileMenu() {
    hamburger?.classList.remove('open');
    mobileMenu?.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
      hamburger.setAttribute('aria-expanded', open);
    });
    document.querySelectorAll('.mobile-menu__link').forEach(l => l.addEventListener('click', closeMobileMenu));
    document.addEventListener('click', e => {
      if (!header?.contains(e.target) && !mobileMenu.contains(e.target)) closeMobileMenu();
    });
  }

  /* -----------------------------------------------------------------------
     3. Active nav link
  ----------------------------------------------------------------------- */
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__link, .mobile-menu__link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) link.classList.add('active');
  });

  /* -----------------------------------------------------------------------
     4. Scroll reveal (IntersectionObserver)
  ----------------------------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });
    revealEls.forEach(el => io.observe(el));
  }

  /* -----------------------------------------------------------------------
     5. Animated counters
  ----------------------------------------------------------------------- */
  function animateCount(el, target, duration = 1600) {
    const start = performance.now();
    const suffix = el.dataset.suffix || '';
    const step = now => {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(p * target) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const counterEls = document.querySelectorAll('[data-counter]');
  if (counterEls.length) {
    const cio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          animateCount(e.target, parseInt(e.target.dataset.counter, 10));
          cio.unobserve(e.target);
        }
      });
    }, { threshold: 0.6 });
    counterEls.forEach(el => cio.observe(el));
  }

  /* -----------------------------------------------------------------------
     6. Back to top
  ----------------------------------------------------------------------- */
  const btt = document.querySelector('.back-to-top');
  if (btt) {
    window.addEventListener('scroll', () => btt.classList.toggle('visible', window.scrollY > 400), { passive: true });
    btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* -----------------------------------------------------------------------
     7. Smooth anchor scroll
  ----------------------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
        closeMobileMenu();
      }
    });
  });

  /* -----------------------------------------------------------------------
     8. Contact form — validation + feedback
  ----------------------------------------------------------------------- */
  const form = document.querySelector('#contact-form');
  if (form) {
    const status = form.querySelector('.form-status');

    function showStatus(type, msg) {
      if (!status) return;
      status.className = 'form-status ' + type;
      status.textContent = msg;
      status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      const nome     = form.querySelector('#nome')?.value.trim()     || '';
      const email    = form.querySelector('#email')?.value.trim()    || '';
      const telefono = form.querySelector('#telefono')?.value.trim() || '';
      const messaggio= form.querySelector('#messaggio')?.value.trim()|| '';
      const privacy  = form.querySelector('#privacy')?.checked       || false;

      if (!nome)                                 return showStatus('error', 'Inserisci il tuo nome.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showStatus('error', 'Email non valida.');
      if (telefono && !/^[\d\s\+\-\(\)]{6,20}$/.test(telefono)) return showStatus('error', 'Numero di telefono non valido.');
      if (!messaggio)                            return showStatus('error', 'Scrivi un breve messaggio.');
      if (!privacy)                              return showStatus('error', 'Accetta la Privacy Policy per procedere.');

      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Invio in corso…'; }

      // Simulazione invio — sostituire con fetch a Formspree/Netlify/EmailJS
      setTimeout(() => {
        showStatus('success', '✓ Messaggio inviato! Ti risponderò entro 24 ore lavorative.');
        form.reset();
        if (btn) { btn.disabled = false; btn.textContent = 'Invia Messaggio'; }
      }, 1200);
    });
  }

  /* -----------------------------------------------------------------------
     9. Micro-interaction: card tilt on mousemove (desktop only)
  ----------------------------------------------------------------------- */
  if (window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.svc-card, .review-card, .step-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width  - 0.5;
        const y = (e.clientY - rect.top)  / rect.height - 0.5;
        card.style.transform = `translateY(-6px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

})();

/* -----------------------------------------------------------------------
   Cookie Banner
----------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function() { (function cookieBanner() {
  const COOKIE_KEY = 'nc_cookie_v2';
  if (localStorage.getItem(COOKIE_KEY)) return; // già scelto

  const banner = document.querySelector('.cookie-banner');
  if (!banner) return;

  // Mostra dopo 800ms per non disturbare il caricamento
  setTimeout(() => banner.classList.add('visible'), 800);

  function dismiss(accepted) {
    localStorage.setItem(COOKIE_KEY, accepted ? 'accepted' : 'rejected');
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 500);
  }

  banner.querySelector('.cookie-btn--accept')?.addEventListener('click', () => dismiss(true));
  banner.querySelector('.cookie-btn--reject')?.addEventListener('click', () => dismiss(false));
  })();
});
