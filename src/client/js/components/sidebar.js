/**
 * Sidebar Component - Folder tree, favorites, trash
 */

import { store } from '../store.js';
import { navigate, router } from '../router.js';
import { nodesApi } from '../api.js';
import { showToast, escapeHtml, getFileIconSvg, formatBytes } from '../utils/dom.js';
import { ContextMenu } from './context-menu.js';

export class Sidebar {
  constructor() {
    this.element = null;
    this.expandedFolders = new Set();
  }

  render() {
    this.element = document.createElement('aside');
    this.element.className = 'app-sidebar';
    this.element.style.cssText = `
      width: 280px;
      min-width: 280px;
      background: #111827;
      border-right: 1px solid #1f2937;
      display: flex;
      flex-direction: column;
      height: calc(100vh - 64px);
      overflow: hidden;
      transition: width 0.2s, min-width 0.2s;
    `;

    this.element.innerHTML = `
      <div style="flex: 1; overflow: auto; padding: 16px;">
        <!-- Navigation -->
        <nav style="margin-bottom: 24px;">
          <div class="nav-section">
            <a href="#/drive" class="nav-item active" data-route="/drive" style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; color: #e5e7eb; text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.15s; background: #1f2937;">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
              Mes fichiers
            </a>
            <a href="#/gallery" class="nav-item" data-route="/gallery" style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; color: #9ca3af; text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.15s;">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Galerie
            </a>
          </div>

          <!-- Favorites -->
          <div class="nav-section" style="margin-bottom: 16px;">
            <div class="nav-section-header" style="display: flex; align-items: center; justify-content: space-between; padding: 0 12px; margin-bottom: 8px;">
              <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Favoris</span>
              <span id="fav-count" style="font-size: 11px; color: #6b7280; background: #1f2937; padding: 2px 8px; border-radius: 10px;">${store.getFavorites().length}</span>
            </div>
            <div id="favorites-list" style="display: flex; flex-direction: column; gap: 4px;">
              ${this.renderFavorites()}
            </div>
          </div>

          <!-- Folder Tree -->
          <div class="nav-section">
            <div class="nav-section-header" style="display: flex; align-items: center; justify-content: space-between; padding: 0 12px; margin-bottom: 8px;">
              <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Dossiers</span>
              <button id="new-folder-btn" class="icon-btn" title="Nouveau dossier" style="width: 28px; height: 28px; border-radius: 8px; background: #1f2937; border: 1px solid #374151; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg></button>
            </div>
            <div id="folder-tree" style="display: flex; flex-direction: column; gap: 2px;">
              ${this.renderFolderTree()}
            </div>
          </div>

          <!-- Trash -->
          <div class="nav-section" style="margin-top: auto; padding-top: 16px; border-top: 1px solid #1f2937;">
            <div class="nav-section-header" style="display: flex; align-items: center; justify-content: space-between; padding: 0 12px; margin-bottom: 8px;">
              <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Corbeille</span>
              <span id="trash-count" style="font-size: 11px; color: #6b7280; background: #1f2937; padding: 2px 8px; border-radius: 10px;">${store.getTrash().length}</span>
            </div>
            <a href="#/drive?trash=1" class="nav-item" data-route="/drive?trash=1" style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; color: #9ca3af; text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.15s;">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #ef4444;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              Corbeille (${store.getTrash().length})
            </a>
          </div>
        </nav>
      </div>

      <!-- Storage bar at bottom -->
      <div style="padding: 16px; border-top: 1px solid #1f2937;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; margin-bottom: 6px;">
          <span>Stockage</span>
          <span id="sidebar-storage-text">${formatBytes(store.getStorage().used)} / ${formatBytes(store.getStorage().total)}</span>
        </div>
        <div style="height: 6px; background: #1f2937; border-radius: 3px; overflow: hidden;">
          <div id="sidebar-storage-fill" style="height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 3px; transition: width 0.3s; width: ${store.getStorage().total > 0 ? (store.getStorage().used / store.getStorage().total * 100) : 0}%;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #6b7280;">
          <span>${store.getNodes()?.filter(n => n.type === 'file').length || 0} fichiers</span>
          <span>${store.getNodes()?.filter(n => n.type === 'folder').length || 0} dossiers</span>
        </div>
      </div>

      <style>
        .nav-item:hover { background: #1f2937; color: white; }
        .nav-item.active { background: #1f2937; color: #6366f1; }
        .icon-btn:hover { background: #374151; color: white; }
        .folder-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; color: #d1d5db; text-decoration: none; font-size: 13px; transition: all 0.1s; cursor: pointer; }
        .folder-item:hover { background: #1f2937; color: white; }
        .folder-item.active { background: #1f2937; color: #6366f1; }
        .folder-toggle { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: #6b7280; flex-shrink: 0; }
        .folder-children { margin-left: 20px; border-left: 1px solid #1f2937; padding-left: 8px; }
        .favorite-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; color: #d1d5db; text-decoration: none; font-size: 13px; transition: all 0.1s; }
        .favorite-item:hover { background: #1f2937; color: white; }
        .favorite-item svg { color: #f59e0b; flex-shrink: 0; }
      </style>
    `;

    this.bindEvents();
    return this.element;
  }

  renderFavorites() {
    const favs = store.getFavorites();
    if (favs.length === 0) {
      return '<div style="padding: 12px; text-align: center; color: #6b7280; font-size: 13px;">Aucun favori</div>';
    }
    return favs.map(node => `
      <a href="#/drive?folder=${node.parent_id || ''}" class="favorite-item" data-id="${node.id}">
        ${getFileIconSvg(node.mime_type, 18)}
        <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(node.name)}</span>
      </a>
    `).join('');
  }

  renderFolderTree(parentId = null, depth = 0) {
    const folders = store.getNodes()?.filter(n => n.type === 'folder' && n.parent_id === parentId && !n.is_trashed) || [];
    if (folders.length === 0 && depth === 0) {
      return '<div style="padding: 12px; text-align: center; color: #6b7280; font-size: 13px;">Aucun dossier</div>';
    }
    return folders.map(folder => {
      const hasChildren = store.getNodes()?.some(n => n.type === 'folder' && n.parent_id === folder.id) || false;
      const isExpanded = this.expandedFolders.has(folder.id);
      const isActive = store.getCurrentFolder() === folder.id;
      return `
        <div class="folder-tree-item" data-id="${folder.id}">
          <div class="folder-item ${isActive ? 'active' : ''}" data-id="${folder.id}" style="${depth > 0 ? 'margin-left: ' + (depth * 16) + 'px;' : ''}">
            ${hasChildren ? `<button class="folder-toggle" data-id="${folder.id}"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></button>` : '<div class="folder-toggle"></div>'}
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #f59e0b;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
            <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(folder.name)}</span>
          </div>
          ${hasChildren && isExpanded ? `
            <div class="folder-children" data-parent="${folder.id}">
              ${this.renderFolderTree(folder.id, depth + 1)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  bindEvents() {
    // Navigation items
    this.element.querySelectorAll('.nav-item[data-route]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.route);
        this.updateActiveNav(item.dataset.route);
      });
    });

    // New folder
    this.element.querySelector('#new-folder-btn')?.addEventListener('click', async () => {
      const name = prompt('Nom du nouveau dossier :');
      if (name?.trim()) {
        try {
          await nodesApi.createFolder({ name: name.trim(), parentId: store.getCurrentFolder() });
          showToast('Dossier créé', 'success');
          this.refresh();
        } catch (err) {
          showToast('Erreur', 'error');
        }
      }
    });

    // Folder toggle
    this.element.querySelectorAll('.folder-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (this.expandedFolders.has(id)) {
          this.expandedFolders.delete(id);
        } else {
          this.expandedFolders.add(id);
        }
        this.refreshFolderTree();
      });
    });

    // Folder click
    this.element.querySelectorAll('.folder-item[data-id]').forEach(item => {
      item.addEventListener('click', () => {
        navigate(`/drive?folder=${item.dataset.id}`);
      });

      // Context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        ContextMenu.show(e.clientX, e.clientY, 'folder', item.dataset.id);
      });
    });

    // Favorite clicks
    this.element.querySelectorAll('.favorite-item[data-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(`/drive?folder=${store.getNode(item.dataset.id)?.parent_id || ''}`);
      });
    });
  }

  updateActiveNav(route) {
    this.element.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === route);
    });
  }

  refresh() {
    const folderTree = this.element.querySelector('#folder-tree');
    const favoritesList = this.element.querySelector('#favorites-list');
    const favCount = this.element.querySelector('#fav-count');
    const trashCount = this.element.querySelector('#trash-count');
    const storageText = this.element.querySelector('#sidebar-storage-text');
    const storageFill = this.element.querySelector('#sidebar-storage-fill');

    if (folderTree) folderTree.innerHTML = this.renderFolderTree();
    if (favoritesList) favoritesList.innerHTML = this.renderFavorites();
    if (favCount) favCount.textContent = store.getFavorites().length;
    if (trashCount) trashCount.textContent = store.getTrash().length;

    const storage = store.getStorage();
    if (storageText) storageText.textContent = `${formatBytes(storage.used)} / ${formatBytes(storage.total)}`;
    if (storageFill) storageFill.style.width = `${storage.total > 0 ? (storage.used / storage.total * 100) : 0}%`;

    this.bindEvents();
  }

  refreshFolderTree() {
    const folderTree = this.element.querySelector('#folder-tree');
    if (folderTree) {
      folderTree.innerHTML = this.renderFolderTree();
      this.bindEvents();
    }
  }

  setCurrentFolder(folderId) {
    this.element.querySelectorAll('.folder-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === folderId);
    });
  }
}