/**
 * Theme & Appearance Manager for FinSight
 * Handles Dark Mode, Compact Layout, and Accent Theme Colors
 */

export interface AppearanceSettings {
  darkMode: boolean;
  themeColor: string;
  compactMode: boolean;
}

export const getStoredAppearance = (): AppearanceSettings => {
  let darkMode = false;
  let themeColor = 'blue';
  let compactMode = false;

  try {
    const storedDark = localStorage.getItem('darkMode');
    if (storedDark !== null) darkMode = JSON.parse(storedDark);

    const storedTheme = localStorage.getItem('themeColor');
    if (storedTheme) themeColor = storedTheme;

    const storedCompact = localStorage.getItem('compactMode');
    if (storedCompact !== null) compactMode = JSON.parse(storedCompact);
  } catch (e) {
    console.error('Failed reading appearance settings from localStorage:', e);
  }

  return { darkMode, themeColor, compactMode };
};

export const applyAppearance = (settings: AppearanceSettings) => {
  const root = document.documentElement;

  // 1. Dark Mode
  root.classList.toggle('dark', Boolean(settings.darkMode));

  // 2. Compact Mode
  root.classList.toggle('compact', Boolean(settings.compactMode));

  // 3. Theme Accent Color
  root.setAttribute('data-theme', settings.themeColor || 'blue');

  // Persist locally for instant hydration across reloads
  try {
    localStorage.setItem('darkMode', JSON.stringify(Boolean(settings.darkMode)));
    localStorage.setItem('themeColor', settings.themeColor || 'blue');
    localStorage.setItem('compactMode', JSON.stringify(Boolean(settings.compactMode)));
  } catch (e) {
    console.error('Failed writing appearance settings to localStorage:', e);
  }
};
