import { initRouter } from './router.js';
import { initStore } from './store.js';
import { initAuth } from './auth.js';
import { initTheme } from './theme.js';
import { registerComponents } from './components/index.js';
import { showToast } from './utils/dom.js';

// Global app state
window.PixelDrive = {
  version: '1.0.0',
  apiBase: '/api',
};

// Initialize app
async function initApp() {
  try {
    // Initialize theme first (before rendering)
    initTheme();

    // Initialize store (reactive state)
    const store = initStore();

    // Register custom elements
    registerComponents();

    // Initialize authentication
    await initAuth();

    // Initialize router
    initRouter();

    // Hide loading screen, show main layout
    const loadingScreen = document.getElementById('loading-screen');
    const mainLayout = document.getElementById('main-layout');

    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
        mainLayout.classList.remove('hidden');
        mainLayout.classList.add('flex');
      }, 300);
    }

    console.log('🎨 PixelDrive initialized');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showToast('Erreur lors du chargement de l\'application', 'error');
  }
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Export for debugging
export { initApp };