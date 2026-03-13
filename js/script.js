/**
 * nutrizionistacortese.it — Vanilla JS
 * Funzionalità: sticky header, menu mobile, scroll reveal, form, back-to-top
 */

(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     1. Sticky Header — aggiunge classe .scrolled oltre 40px di scroll
     --------------------------------------------------------------------- */
  const header = document.querySelector('.header');

  function handleHeaderScroll() {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 40);
  }

  window.addEventListener('scroll', handleHeaderScroll, { passive: true });
  handleHeaderScroll(); // trigger all'avvio

  /* -----------------------------------------------------------------------
     2. Menu mobile hamburger
     --------------------------------------------------------------------- */
  const hamburger   = document.querySelector('.hamburger');
  const mobileMenu  = document.querySelector('.mobile-menu');
  const mobileLinks = document.querySelectorAll('.mobile-menu__link');

  function closeMobileMenu() {
    if (!hamburger || !mobileMenu) return;
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Chiudi cliccando su un link
    mobileLinks.forEach(link => link.addEventListener('click', closeMobileMenu));

    // Chiudi cliccando fuori
    document.addEventListener('click', (e) => {
      if (!header.contains(e.target) && !mobileMenu.contains(e.target)) {
        closeMobileMenu();
      }
    });
  }

  /* -----------------------------------------------------------------------
     3. Active nav link — in base alla pagina corrente
     --------------------------------------------------------------------- */
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav__link, .mobile-menu__link');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  /* -----------------------------------------------------------------------
     4. Scroll Reveal — Intersection Observer
     --------------------------------------------------------------------- */
  const revealElements = document.querySelectorAll('.reveal');

  if (revealElements.length > 0) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    revealElements.forEach(el => revealObserver.observe(el));
  }

  /* -----------------------------------------------------------------------
     5. Back to top
     --------------------------------------------------------------------- */
  const backToTop = document.querySelector('.back-to-top');

  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* -----------------------------------------------------------------------
     6. Contatto Form — validazione frontend + feedback visivo
     --------------------------------------------------------------------- */
  const contactForm = document.querySelector('#contact-form');

  if (contactForm) {
    const statusEl = contactForm.querySelector('.form-status');

    function showStatus(type, message) {
      if (!statusEl) return;
      statusEl.className = 'form-status ' + type;
      statusEl.textContent = message;
      statusEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function validateEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validatePhone(phone) {
      return phone === '' || /^[\d\s\+\-\(\)]{6,20}$/.test(phone);
    }

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      // Raccogli dati
      const nome    = contactForm.querySelector('#nome')?.value.trim()    || '';
      const cognome = contactForm.querySelector('#cognome')?.value.trim() || '';
      const email   = contactForm.querySelector('#email')?.value.trim()   || '';
      const telefono= contactForm.querySelector('#telefono')?.value.trim()|| '';
      const servizio= contactForm.querySelector('#servizio')?.value       || '';
      const messaggio= contactForm.querySelector('#messaggio')?.value.trim()|| '';
      const privacy = contactForm.querySelector('#privacy')?.checked      || false;

      // Validazione
      if (!nome) { showStatus('error', 'Inserisci il tuo nome.'); return; }
      if (!email || !validateEmail(email)) { showStatus('error', 'Inserisci un indirizzo email valido.'); return; }
      if (!validatePhone(telefono)) { showStatus('error', 'Il numero di telefono non è valido.'); return; }
      if (!messaggio) { showStatus('error', 'Scrivi un messaggio.'); return; }
      if (!privacy) { showStatus('error', 'Devi accettare la Privacy Policy per procedere.'); return; }

      // Simula invio (sostituire con fetch a un endpoint reale, Formspree, ecc.)
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Invio in corso...'; }

      setTimeout(() => {
        showStatus('success', '✓ Messaggio inviato con successo! Ti risponderò al più presto.');
        contactForm.reset();
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Invia Messaggio'; }
      }, 1200);
    });
  }

  /* -----------------------------------------------------------------------
     7. Smooth scroll per anchor link interni
     --------------------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80; // altezza header
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
        closeMobileMenu();
      }
    });
  });

  /* -----------------------------------------------------------------------
     8. Counters animati nella hero (opzionale, attivati quando visibili)
     --------------------------------------------------------------------- */
  function animateCounter(el, target, duration) {
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const value = Math.round(progress * target);
      el.textContent = value + (el.dataset.suffix || '');
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const counters = document.querySelectorAll('[data-counter]');
  if (counters.length > 0) {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            animateCounter(el, parseInt(el.dataset.counter, 10), 1600);
            counterObserver.unobserve(el);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach(el => counterObserver.observe(el));
  }

})();
