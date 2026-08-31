'use strict';

(() => {
  const KEY = 'colour-theme';
  const THEMES = [
    { id: 'auto', label: 'System theme' },
    { id: 'light', label: 'Light theme' },
    { id: 'dark', label: 'Dark theme' },
  ];
  const dark = window.matchMedia('(prefers-color-scheme: dark)');

  const read = () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  };

  const persist = (value) => {
    try {
      localStorage.setItem(KEY, value);
      return true;
    } catch {
      return false;
    }
  };

  const stored = read();
  let current = THEMES.find((theme) => theme.id === stored) || THEMES[0];

  const apply = () => {
    const preferred = dark.matches ? 'dark' : 'light';
    document.documentElement.dataset.bsTheme = current.id === 'auto' ? preferred : current.id;
  };

  apply();
  dark.addEventListener('change', () => { if (current.id === 'auto') apply(); });

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme');
    if (!button) return;

    const label = document.getElementById('theme-label');
    const paint = () => {
      button.dataset.theme = current.id;
      button.setAttribute('aria-label', `Colour theme: ${current.label.toLowerCase()}. Select to change.`);
      if (label) label.textContent = current.label;
    };

    button.addEventListener('click', () => {
      const rest = THEMES.slice(THEMES.indexOf(current) + 1);
      current = rest.length ? rest[0] : THEMES[0];
      persist(current.id);
      apply();
      paint();
    });

    paint();
  });
})();
