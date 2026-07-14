/**
 * PixelDrive - Main Entry Point
 * Bootstrap: Store, Router, Components Registry
 */

import { store } from '../js/store.js';
import { router } from '../js/router.js';
import { auth } from '../js/auth.js';
import { theme } from '../js/theme.js';
import { defineCustomElements } from '../js/components/index.js';

// Define all custom elements
defineCustomElements();

// Initialize theme
theme.init();

// Initialize auth (checks for existing session)
auth.init().then(() => {
  // Start router after auth check
  router.start();
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K for search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const searchInput = document.querySelector('pd-header input[type="search"]');
    if (searchInput) searchInput.focus();
  }

  // Escape to close modals/sidebar
  if (e.key === 'Escape') {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && !sidebar.classList.contains('hidden')) {
      sidebar.classList.add('hidden');
      overlay?.classList.add('hidden');
    }
  }
});

// Expose for debugging
window.PixelDrive = { store, router, auth, theme };

console.log('🚀 PixelDrive initialized');