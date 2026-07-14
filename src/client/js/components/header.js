/**
 * Header Component - User menu, storage bar, global search
 */

import { store } from '../store.js';
import { authManager } from '../auth.js';
import { navigate, router } from '../router.js';
import { showToast, formatBytes, escapeHtml } from '../utils/dom.js';
import { themeManager } from '../theme.js';
import { ContextMenu } from './context-menu.js';

export class Header {
  constructor() {
    this.element = null;
    this.searchDebounce = null;
  }

  render() {
    this.element = document.createElement('header');
    this.element.className = 'app-header';
    this.element.style.cssText = `
      position: sticky;
      top: 0;
      z-index: 40;
      background: #111827;
      border-bottom: 1px solid #1f2937;
      padding: 0 24px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    `;

    this.element.innerHTML = `
      <div style="display: flex; align-items: center; gap: 24px; flex: 1; min-width: 0;">
        <!-- Logo -->
        <a href="#/drive" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: white;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: #6366f1;">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor"/>
            <path d="M9 9h6v6H9z" fill="currentColor"/>
            <path d="M12 9v6M9 12h6" stroke="white" stroke-width="2"/>
          </svg>
          <span style="font-size: 20px; font-weight: 700;">PixelDrive</span>
        </a>

        <!-- Search -->
        <div class="search-container" style="flex: 1; max-width: 480px; position: relative;">
          <svg class="search-icon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #6b7280; pointer-events: none;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input type="search" id="global-search" placeholder="Rechercher des fichiers..." class="search-input" style="width: 100%; padding: 10px 14px 10px 44px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; outline: none; transition: all 0.2s;">
          <div id="search-results" class="search-results" style="display: none; position: absolute; top: 100%; left: 0; right: 0; margin-top: 8px; background: #111827; border: 1px solid #1f2937; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); overflow: hidden; max-height: 300px; overflow-y: auto;"></div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 16px;">
        <!-- Storage Bar (desktop only) -->
        <div class="storage-bar" style="display: none; width: 200px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
            <span>Stockage</span>
            <span id="storage-text">${formatBytes(store.getStorage().used)} / ${formatBytes(store.getStorage().total)}</span>
          </div>
          <div style="height: 4px; background: #1f2937; border-radius: 2px; overflow: hidden;">
            <div id="storage-fill" style="height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 2px; transition: width 0.3s; width: ${store.getStorage().total > 0 ? (store.getStorage().used / store.getStorage().total * 100) : 0}%;"></div>
          </div>
        </div>

        <!-- Theme Toggle -->
        <button id="theme-toggle" class="icon-btn" title="Changer de thème" style="width: 40px; height: 40px; border-radius: 10px; background: #1f2937; border: 1px solid #374151; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s;">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
        </button>

        <!-- Upload Button -->
        <label class="upload-trigger" style="cursor: pointer;">
          <input type="file" id="file-upload" multiple style="display: none;">
          <button class="btn btn-primary" style="padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; background: #4f46e5; color: white; border: none; display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
            Importer
          </button>
        </label>

        <!-- User Menu -->
        <div class="user-menu-container" style="position: relative;">
          <button id="user-menu-btn" class="user-menu-btn" style="display: flex; align-items: center; gap: 10px; padding: 6px 12px 6px 6px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; cursor: pointer; transition: all 0.15s;">
            <div class="avatar" style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: white;">${store.getUser()?.username?.charAt(0).toUpperCase() || 'U'}</div>
            <span style="font-size: 13px; font-weight: 500; color: white;">${escapeHtml(store.getUser()?.username || 'Utilisateur')}</span>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #6b7280;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          <div id="user-dropdown" class="user-dropdown" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 8px; min-width: 220px; background: #111827; border: 1px solid #1f2937; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); overflow: hidden; z-index: 50;">
            <div style="padding: 12px 16px; border-bottom: 1px solid #1f2937;">
              <div style="font-weight: 600; font-size: 13px;">${escapeHtml(store.getUser()?.username || 'Utilisateur')}</div>
              <div style="font-size: 11px; color: #9ca3af;">${escapeHtml(store.getUser()?.email || 'Aucun email')}</div>
            </div>
            <a href="#/drive" class="dropdown-item" data-route="/drive" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #e5e7eb; text-decoration: none; font-size: 13px; transition: background 0.1s;"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg> Mes fichiers</a>
            <a href="#/gallery" class="dropdown-item" data-route="/gallery" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #e5e7eb; text-decoration: none; font-size: 13px; transition: background 0.1s;"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> Galerie</a>
            <a href="#/settings" class="dropdown-item" data-route="/settings" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #e5e7eb; text-decoration: none; font-size: 13px; transition: background 0.1s;"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> Paramètres</a>
            <hr style="border: none; border-top: 1px solid #1f2937; margin: 8px 0;">
            <button id="logout-btn" class="dropdown-item" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #f87171; text-decoration: none; font-size: 13px; background: none; border: none; width: 100%; text-align: left; cursor: pointer;"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg> Déconnexion</button>
          </div>
        </div>
      </div>

      <style>
        .search-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
        .search-input::placeholder { color: #6b7280; }
        .icon-btn:hover { background: #374151; color: white; }
        .user-menu-btn:hover { background: #374151; border-color: #4b5563; }
        .dropdown-item:hover { background: #1f2937; }
        .search-result-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; color: #e5e7eb; text-decoration: none; font-size: 13px; transition: background 0.1s; }
        .search-result-item:hover { background: #1f2937; }
        .search-result-item svg { color: #6b7280; flex-shrink: 0; }
        @media (min-width: 768px) { .storage-bar { display: block !important; } }
        @media (max-width: 767px) { .app-header { padding: 0 16px; } }
      </style>
    `;

    this.bindEvents();
    return this.element;
  }

  bindEvents() {
    // Search
    const searchInput = this.element.querySelector('#global-search');
    const searchResults = this.element.querySelector('#search-results');

    searchInput?.addEventListener('input', debounce(async (e) => {
      const query = e.target.value.trim();
      if (query.length < 2) {
        searchResults.style.display = 'none';
        return;
      }

      try {
        const response = await fetch(`/api/nodes/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
        const data = await response.json();
        const nodes = data.nodes || [];

        if (nodes.length === 0) {
          searchResults.innerHTML = '<div style="padding: 16px; text-align: center; color: #6b7280;">Aucun résultat</div>';
        } else {
          searchResults.innerHTML = nodes.map(node => `
            <a href="#/drive?folder=${node.parent_id || ''}" class="search-result-item" data-id="${node.id}">
              ${getFileIconSvg(node.mime_type, 18)}
              <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(node.name)}</span>
              ${node.type === 'file' ? `<span style="font-size: 11px; color: #6b7280;">${formatBytes(node.size)}</span>` : ''}
            </a>
          `).join('');
        }
        searchResults.style.display = 'block';
      } catch (err) {
        searchResults.style.display = 'none';
      }
    }, 300));

    // Close search on click outside
    document.addEventListener('click', (e) => {
      if (!this.element?.contains(e.target)) {
        searchResults.style.display = 'none';
      }
    });

    // Theme toggle
    this.element.querySelector('#theme-toggle')?.addEventListener('click', () => {
      themeManager.toggle();
      this.updateThemeIcon();
    });

    // File upload
    this.element.querySelector('#file-upload')?.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        window.dispatchEvent(new CustomEvent('upload:add-files', {
          detail: { files: Array.from(e.target.files), parentId: store.getCurrentFolder() }
        }));
        e.target.value = '';
      }
    });

    // User dropdown
    const userMenuBtn = this.element.querySelector('#user-menu-btn');
    const userDropdown = this.element.querySelector('#user-dropdown');

    userMenuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
      userDropdown.style.display = 'none';
    });

    // Dropdown navigation
    this.element.querySelectorAll('.dropdown-item[data-route]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.route);
        userDropdown.style.display = 'none';
      });
    });

    // Logout
    this.element.querySelector('#logout-btn')?.addEventListener('click', async () => {
      await authManager.logout();
      navigate('/login');
    });

    // Search result clicks
    searchResults?.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (item) {
        searchResults.style.display = 'none';
        searchInput.value = '';
      }
    });

    this.updateThemeIcon();
  }

  updateThemeIcon() {
    const btn = this.element.querySelector('#theme-toggle');
    const theme = themeManager.getTheme();
    if (btn) {
      btn.innerHTML = theme === 'dark'
        ? '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>'
        : theme === 'light'
        ? '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>'
        : '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>';
    }
  }

  updateStorage() {
    const storage = store.getStorage();
    const textEl = this.element.querySelector('#storage-text');
    const fillEl = this.element.querySelector('#storage-fill');
    if (textEl) textEl.textContent = `${formatBytes(storage.used)} / ${formatBytes(storage.total)}`;
    if (fillEl) fillEl.style.width = `${storage.total > 0 ? (storage.used / storage.total * 100) : 0}%`;
  }
}

// Debounce utility
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
