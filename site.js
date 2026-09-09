"use strict";

(() => {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#main-navigation');
  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.site-header')) setOpen(false);
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', () => setOpen(false));
  }

  // Preserve links to sections that now have their own pages.
  if (location.pathname === '/' || location.pathname === '/index.html') {
    const movedSections = {
      '#password-generator': '/features/#password-generator',
      '#supported': '/help/#backups',
      '#mobile-guide': '/help/#backups',
      '#security': '/security/',
      '#recovery': '/recovery/',
    };
    const redirect = () => {
      const destination = movedSections[location.hash];
      if (destination) location.replace(destination);
    };
    redirect();
    window.addEventListener('hashchange', redirect);
  }

  // A help link may point into a collapsed guide.
  const revealGuide = () => {
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); }
    catch { return; }
    if (target?.tagName === 'DETAILS') {
      target.open = true;
      target.scrollIntoView({ block: 'start' });
    }
  };
  revealGuide();
  window.addEventListener('hashchange', revealGuide);
})();
