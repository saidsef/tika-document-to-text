'use strict';

/* Loaded render-blocking in <head>: the attribute has to be on <html> before
   the first paint, or a dark-mode user sees a white flash. */

(() => {
  const KEY = 'colour-theme';
  const ORDER = ['auto', 'light', 'dark'];
  const LABELS = { auto: 'System theme', light: 'Light theme', dark: 'Dark theme' };
  const dark = window.matchMedia('(prefers-color-scheme: dark)');

  let choice = 'auto';
  try {
    if (ORDER.includes(localStorage.getItem(KEY))) choice = localStorage.getItem(KEY);
  } catch {
    // Storage can be blocked; the default is fine.
  }

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
      try {
        localStorage.setItem(KEY, choice);
      } catch {
        // Not persisting is better than failing the click.
      }
      apply();
      paint();
    });

    paint();
  });
})();
