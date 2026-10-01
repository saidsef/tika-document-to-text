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
    const isDark = current.id === 'auto' ? dark.matches : current.id === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
  };

  // Runs in <head>, before first paint, so a dark page never flashes white.
  apply();
  dark.addEventListener('change', () => { if (current.id === 'auto') apply(); });

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme');
    if (!button) return;

    const items = document.querySelectorAll('[data-theme-value]');
    const paint = () => {
      button.setAttribute('aria-label', `Colour theme: ${current.label.toLowerCase()}`);
      items.forEach((item) => item.setAttribute('aria-checked', String(item.dataset.themeValue === current.id)));
    };

    items.forEach((item) => item.addEventListener('click', () => {
      current = THEMES.find((theme) => theme.id === item.dataset.themeValue) || THEMES[0];
      persist(current.id);
      apply();
      paint();
    }));

    paint();
  });
})();
