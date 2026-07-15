/**
 * Theme Manager - Dark/Light/System theme with persistence
 */

export const themeManager = {
  init() {
    // Load saved theme
    const saved = localStorage.getItem('pixeldrive_theme') || 'system';
    this.apply(saved);

    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.getTheme() === 'system') {
          this.apply('system');
        }
      });
    }
  },

  getTheme() {
    return localStorage.getItem('pixeldrive_theme') || 'system';
  },

  setTheme(theme) {
    localStorage.setItem('pixeldrive_theme', theme);
    this.apply(theme);
  },

  apply(theme) {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#0d1117' : '#ffffff');
    }
  },

  toggle() {
    const current = this.getTheme();
    const themes = ['light', 'dark', 'system'];
    const next = themes[(themes.indexOf(current) + 1) % themes.length];
    this.setTheme(next);
    return next;
  },
};

// Initialize on load
if (typeof window !== 'undefined') {
  themeManager.init();
}

// Export function for main.js compatibility
export function initTheme() {
  themeManager.init();
}
