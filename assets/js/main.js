(() => {
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  const isBelarusian = document.documentElement.lang.toLowerCase().startsWith('be');
  const menuLabels = isBelarusian
    ? { open: 'Адкрыць меню', close: 'Закрыць меню' }
    : { open: 'Открыть меню', close: 'Закрыть меню' };

  const languageLinks = document.querySelectorAll('[data-language-switch] a');
  const syncLanguageAnchors = () => {
    languageLinks.forEach((link) => {
      const destination = new URL(link.href);
      destination.hash = window.location.hash;
      link.href = destination.href;
    });
  };
  syncLanguageAnchors();
  window.addEventListener('hashchange', syncLanguageAnchors);

  const closeMenu = () => {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', menuLabels.open);
    menu.hidden = true;
  };

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      toggle.setAttribute('aria-label', isOpen ? menuLabels.open : menuLabels.close);
      menu.hidden = isOpen;
    });

    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    document.addEventListener('click', (event) => {
      if (menu.hidden || menu.contains(event.target) || toggle.contains(event.target)) return;
      closeMenu();
    });
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealItems = document.querySelectorAll('.reveal');

  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });

    revealItems.forEach((item) => revealObserver.observe(item));
  }

})();
