'use strict';

(() => {
  const KEY = 'colour-theme';
  const ORDER = ['auto', 'light', 'dark'];
  const LABELS = { auto: 'System theme', light: 'Light theme', dark: 'Dark theme' };
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

  let choice = ORDER.includes(read()) ? read() : 'auto';

  const apply = () => {
    document.documentElement.dataset.bsTheme = choice === 'auto' ? (dark.matches ? 'dark' : 'light') : choice;
  };

  apply();
  dark.addEventListener('change', () => { if (choice === 'auto') apply(); });

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme');
    if (!button) return;

    const label = document.getElementById('theme-label');
    const paint = () => {
      button.dataset.theme = choice;
      button.setAttribute('aria-label', `Colour theme: ${LABELS[choice].toLowerCase()}. Select to change.`);
      if (label) label.textContent = LABELS[choice];
    };

    button.addEventListener('click', () => {
      choice = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
      persist(choice);
      apply();
      paint();
    });

    paint();
  });
})();
