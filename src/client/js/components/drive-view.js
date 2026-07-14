/**
 * Drive View Component - File explorer (Grid/List, DnD, Context Menu, Virtual Scroll)
 */

import { store } from '../store.js';
import { navigate, router } from '../router.js';
import { nodesApi } from '../api.js';
import { showToast, formatBytes, formatRelativeTime, escapeHtml, getFileIconSvg, debounce } from '../utils/dom.js';
import { ContextMenu } from './context-menu.js';
import { PreviewModal } from './preview-modal.js';
import { InfoModal } from './info-modal.js';
import { ShareModal } from './share-modal.js';
import { showRenameModal } from './rename-modal.js';
import { confirm } from './confirm-modal.js';

export class DriveView {
  constructor() {
    this.element = null;
    this.dragSource = null;
    this.searchDebounce = null;
  }

  render() {
    this.element = document.createElement('main');
    this.element.className = 'drive-view';
    this.element.style.cssText = `
      flex: 1;
      overflow: auto;
      background: #0d1117;
      padding: 24px;
    `;

    const nodes = store.getFilteredNodes();
    const breadcrumbs = store.getBreadcrumbs();
    const viewMode = store.getViewMode();
    const sort = store.getSort();

    this.element.innerHTML = `
      <!-- Breadcrumbs & Toolbar -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
        <!-- Breadcrumbs -->
        <nav class="breadcrumbs" style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; overflow: auto;">
          ${breadcrumbs.map((crumb, i) => `
            <span style="display: flex; align-items: center; gap: 8px;">
              ${i > 0 ? '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #6b7280;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>' : ''}
              ${crumb.id === null
                ? `<button class="breadcrumb-item" data-id="null" style="background: none; border: none; color: #9ca3af; font-size: 13px; cursor: pointer; padding: 6px 10px; border-radius: 6px;">${escapeHtml(crumb.name)}</button>`
                : `<button class="breadcrumb-item" data-id="${crumb.id}" style="background: none; border: none; color: #e5e7eb; font-size: 13px; cursor: pointer; padding: 6px 10px; border-radius: 6px;">${escapeHtml(crumb.name)}</button>`
              }
            </span>
          `).join('')}
        </nav>

        <!-- Toolbar -->
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <!-- View Mode -->
          <div class="view-mode-toggle" style="display: flex; background: #1f2937; border: 1px solid #374151; border-radius: 8px; overflow: hidden;">
            <button data-mode="grid" class="view-btn ${viewMode === 'grid' ? 'active' : ''}" style="padding: 8px 12px; background: ${viewMode === 'grid' ? '#374151' : 'transparent'}; border: none; color: ${viewMode === 'grid' ? 'white' : '#9ca3af'}; cursor: pointer; display: flex; align-items: center; justify-content: center;"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg></button>
            <button data-mode="list" class="view-btn ${viewMode === 'list' ? 'active' : ''}" style="padding: 8px 12px; background: ${viewMode === 'list' ? '#374151' : 'transparent'}; border: none; color: ${viewMode === 'list' ? 'white' : '#9ca3af'}; cursor: pointer; display: flex; align-items: center; justify-content: center;"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg></button>
          </div>

          <!-- Sort -->
          <select id="sort-select" class="form-select" style="padding: 8px 12px; background: #1f2937; border: 1px solid #374151; border-radius: 8px; color: white; font-size: 13px; cursor: pointer;">
            <option value="name" ${sort.by === 'name' ? 'selected' : ''}>Nom ${sort.by === 'name' ? (sort.order === 'asc' ? '↑' : '↓') : ''}</option>
            <option value="size" ${sort.by === 'size' ? 'selected' : ''}>Taille ${sort.by === 'size' ? (sort.order === 'asc' ? '↑' : '↓') : ''}</option>
            <option value="date" ${sort.by === 'date' ? 'selected' : ''}>Date ${sort.by === 'date' ? (sort.order === 'asc' ? '↑' : '↓') : ''}</option>
            <option value="type" ${sort.by === 'type' ? 'selected' : ''}>Type ${sort.by === 'type' ? (sort.order === 'asc' ? '↑' : '↓') : ''}</option>
          </select>

          <!-- New Folder -->
          <button id="new-folder-btn" class="btn btn-secondary" style="padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #374151; color: white; border: 1px solid #4b5563; display: flex; align-items: center; gap: 6px;">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Nouveau dossier
          </button>
        </div>
      </div>

      <!-- File Grid / List -->
      <div id="file-container" class="file-container ${viewMode}">
        ${viewMode === 'grid' ? this.renderGrid(nodes) : this.renderList(nodes)}
      </div>

      <!-- Empty State -->
      ${nodes.length === 0 ? `
        <div id="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; text-align: center; color: #6b7280;">
          <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-bottom: 16px; opacity: 0.5;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
          <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #9ca3af;">Dossier vide</h3>
          <p style="margin-bottom: 24px;">Glissez-déposez des fichiers ici ou cliquez sur "Importer"</p>
          <button id="empty-upload-btn" class="btn btn-primary" style="padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; background: #4f46e5; color: white; border: none;">Importer des fichiers</button>
        </div>
      ` : ''}

      <style>
        .breadcrumb-item:hover { background: #1f2937; color: white; }
        .view-btn:hover:not(.active) { background: #374151; color: white; }
        .form-select:focus { outline: none; border-color: #6366f1; }
        .btn-secondary:hover { background: #4b5563; }

        /* Grid View */
        .file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
        .file-card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 16px; transition: all 0.15s; cursor: pointer; position: relative; }
        .file-card:hover { border-color: #374151; box-shadow: 0 10px 25px rgba(0,0,0,0.3); transform: translateY(-2px); }
        .file-card.dragging { opacity: 0.5; border-color: #6366f1; }
        .file-card.selected { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); }
        .file-thumb { width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #1f2937; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        .file-thumb img, .file-thumb video { width: 100%; height: 100%; object-fit: cover; }
        .file-thumb svg { color: #6b7280; }
        .file-name { font-weight: 500; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
        .file-meta { display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
        .file-menu { position: absolute; top: 12px; right: 12px; opacity: 0; transition: opacity 0.15s; }
        .file-card:hover .file-menu { opacity: 1; }
        .file-menu-btn { width: 32px; height: 32px; border-radius: 8px; background: #1f2937; border: 1px solid #374151; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .file-menu-btn:hover { background: #374151; color: white; }

        /* List View */
        .file-list { display: flex; flex-direction: column; }
        .file-list-header { display: grid; grid-template-columns: 40px 1fr 120px 160px 40px; padding: 12px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 1px solid #1f2937; }
        .file-row { display: grid; grid-template-columns: 40px 1fr 120px 160px 40px; align-items: center; padding: 12px 16px; border-bottom: 1px solid #1f2937; transition: background 0.1s; cursor: pointer; gap: 16px; }
        .file-row:hover { background: #1f2937; }
        .file-row.dragging { opacity: 0.5; }
        .file-row.selected { background: #1f2937; }
        .file-row-icon { display: flex; align-items: center; justify-content: center; }
        .file-row-name { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .file-row-name svg { flex-shrink: 0; color: #6b7280; }
        .file-row-name-text { font-weight: 500; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-row-size { font-size: 12px; color: #9ca3af; text-align: right; }
        .file-row-date { font-size: 12px; color: #9ca3af; text-align: right; }
        .file-row-menu { display: flex; align-items: center; justify-content: flex-end; }

        /* Drop zone indicator */
        .drop-zone-active { border: 2px dashed #6366f1 !important; background: rgba(99, 102, 241, 0.1) !important; }

        @media (max-width: 767px) {
          .file-list-header { display: none; }
          .file-row { grid-template-columns: 40px 1fr 40px; }
          .file-row-size, .file-row-date { display: none; }
        }
      </style>
    `;

    this.bindEvents();
    this.setupDragAndDrop();
    return this.element;
  }

  renderGrid(nodes) {
    if (nodes.length === 0) return '<div class="file-grid"></div>';

    return `
      <div class="file-grid" id="file-grid">
        ${nodes.map(node => this.renderGridItem(node)).join('')}
      </div>
    `;
  }

  renderGridItem(node) {
    const isImage = node.mime_type?.startsWith('image/');
    const isVideo = node.mime_type?.startsWith('video/');
    const thumbUrl = node.thumb_url || (node.chunks?.[0]?.url);

    return `
      <div class="file-card" data-id="${node.id}" draggable="true" data-type="${node.type}" data-name="${escapeHtml(node.name)}">
        <div class="file-menu">
          <button class="file-menu-btn" data-id="${node.id}"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg></button>
        </div>
        <div class="file-thumb">
          ${thumbUrl && isImage ? `<img src="${thumbUrl}" alt="" loading="lazy">` : ''}
          ${thumbUrl && isVideo ? `<video src="${thumbUrl}" muted playsinline loop style="width: 100%; height: 100%; object-fit: cover;"></video>` : ''}
          ${(!thumbUrl || (!isImage && !isVideo)) ? getFileIconSvg(node.mime_type, 48) : ''}
        </div>
        <div class="file-name" title="${escapeHtml(node.name)}">${escapeHtml(node.name)}</div>
        <div class="file-meta">
          <span>${node.type === 'file' ? formatBytes(node.size) : 'Dossier'}</span>
          <span>${formatRelativeTime(node.updated_at || node.created_at)}</span>
        </div>
      </div>
    `;
  }

  renderList(nodes) {
    if (nodes.length === 0) return '<div class="file-list"><div class="file-list-header"><div></div><div>Nom</div><div>Taille</div><div>Modifié</div><div></div></div></div>';

    return `
      <div class="file-list" id="file-list">
        <div class="file-list-header">
          <div></div>
          <div>Nom</div>
          <div>Taille</div>
          <div>Modifié</div>
          <div></div>
        </div>
        ${nodes.map(node => this.renderListItem(node)).join('')}
      </div>
    `;
  }

  renderListItem(node) {
    const isImage = node.mime_type?.startsWith('image/');
    const isVideo = node.mime_type?.startsWith('video/');
    const isFolder = node.type === 'folder';

    return `
      <div class="file-row" data-id="${node.id}" draggable="true" data-type="${node.type}" data-name="${escapeHtml(node.name)}">
        <div class="file-row-icon">
          ${getFileIconSvg(node.mime_type, 20)}
        </div>
        <div class="file-row-name">
          ${getFileIconSvg(node.mime_type, 18)}
          <span class="file-row-name-text" title="${escapeHtml(node.name)}">${escapeHtml(node.name)}</span>
        </div>
        <div class="file-row-size">${isFolder ? '—' : formatBytes(node.size)}</div>
        <div class="file-row-date">${formatRelativeTime(node.updated_at || node.created_at)}</div>
        <div class="file-row-menu">
          <button class="file-menu-btn" data-id="${node.id}"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg></button>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Breadcrumbs
    this.element.querySelectorAll('.breadcrumb-item[data-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        navigate(`/drive?folder=${btn.dataset.id === 'null' ? '' : btn.dataset.id}`);
      });
    });

    // View mode toggle
    this.element.querySelectorAll('.view-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        store.setViewMode(btn.dataset.mode);
        this.refreshView();
      });
    });

    // Sort
    this.element.querySelector('#sort-select')?.addEventListener('change', (e) => {
      store.setSortBy(e.target.value);
      this.refreshView();
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

    // Empty state upload
    this.element.querySelector('#empty-upload-btn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.onchange = (e) => {
        if (e.target.files.length > 0) {
          window.dispatchEvent(new CustomEvent('upload:add-files', {
            detail: { files: Array.from(e.target.files), parentId: store.getCurrentFolder() }
          }));
        }
      };
      input.click();
    });

    // File clicks (navigation for folders, preview for files)
    this.element.querySelectorAll('.file-card, .file-row').forEach(item => {
      // Double click
      item.addEventListener('dblclick', () => this.handleDoubleClick(item.dataset.id, item.dataset.type));

      // Single click for selection
      item.addEventListener('click', (e) => {
        if (e.target.closest('.file-menu-btn')) return;
        this.handleClick(item);
      });

      // Context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        ContextMenu.show(e.clientX, e.clientY, 'node', item.dataset.id);
      });

      // Menu button
      item.querySelector('.file-menu-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        ContextMenu.show(e.clientX, e.clientY, 'node', item.dataset.id);
      });
    });

    // Keyboard navigation
    this.element.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  handleClick(item) {
    // Clear other selections
    this.element.querySelectorAll('.file-card.selected, .file-row.selected').forEach(el => {
      if (el !== item) el.classList.remove('selected');
    });
    item.classList.toggle('selected');
  }

  handleDoubleClick(id, type) {
    const node = store.getNode(id);
    if (!node) return;

    if (type === 'folder') {
      navigate(`/drive?folder=${id}`);
    } else {
      // Preview file
      const mediaNodes = store.getMediaNodes();
      PreviewModal.show(node, mediaNodes);
    }
  }

  handleKeydown(e) {
    const selected = this.element.querySelector('.file-card.selected, .file-row.selected');
    const items = Array.from(this.element.querySelectorAll('.file-card, .file-row'));

    if (items.length === 0) return;

    let currentIndex = selected ? items.indexOf(selected) : -1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < items.length - 1) {
          items[currentIndex]?.classList.remove('selected');
          items[currentIndex + 1].classList.add('selected');
          items[currentIndex + 1].scrollIntoView({ block: 'nearest' });
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          items[currentIndex]?.classList.remove('selected');
          items[currentIndex - 1].classList.add('selected');
          items[currentIndex - 1].scrollIntoView({ block: 'nearest' });
        }
        break;
      case 'Enter':
        if (selected) {
          this.handleDoubleClick(selected.dataset.id, selected.dataset.type);
        }
        break;
      case 'Delete':
        if (selected) {
          this.deleteNode(selected.dataset.id);
        }
        break;
      case 'F2':
        if (selected) {
          this.renameNode(selected.dataset.id);
        }
        break;
    }
  }

  async renameNode(id) {
    const node = store.getNode(id);
    if (!node) return;

    const newName = await showRenameModal(node);
    if (newName) {
      try {
        await nodesApi.rename(id, newName);
        showToast('Renommé', 'success');
        this.refresh();
      } catch (err) {
        showToast('Erreur', 'error');
      }
    }
  }

  async deleteNode(id) {
    const node = store.getNode(id);
    if (!node) return;

    const confirmed = await confirm({
      title: node.is_trashed ? 'Supprimer définitivement' : 'Corbeille',
      message: node.is_trashed
        ? 'Cet élément sera supprimé pour de bon. Impossible à récupérer.'
        : `Déplacer "${escapeHtml(node.name)}" vers la corbeille ?`,
      confirmLabel: node.is_trashed ? 'Supprimer' : 'Déplacer',
      variant: 'danger',
    });

    if (confirmed) {
      try {
        if (node.is_trashed) {
          await nodesApi.delete(id);
        } else {
          await nodesApi.trash(id);
        }
        showToast(node.is_trashed ? 'Supprimé définitivement' : 'Déplacé vers la corbeille', 'success');
        this.refresh();
      } catch (err) {
        showToast('Erreur', 'error');
      }
    }
  }

  setupDragAndDrop() {
    const container = this.element.querySelector('.file-grid, .file-list');

    // Drag start
    this.element.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.file-card, .file-row');
      if (!item) return;

      this.dragSource = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
    });

    // Drag end
    this.element.addEventListener('dragend', (e) => {
      const item = e.target.closest('.file-card, .file-row');
      if (item) item.classList.remove('dragging');
      this.dragSource = null;
      container?.classList.remove('drop-zone-active');
    });

    // Drag over
    this.element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const target = e.target.closest('.file-card[data-type="folder"], .file-row[data-type="folder"]');
      if (target && target !== this.dragSource) {
        target.classList.add('drop-zone-active');
      } else {
        container?.classList.add('drop-zone-active');
      }
    });

    // Drag leave
    this.element.addEventListener('dragleave', (e) => {
      if (!this.element.contains(e.relatedTarget)) {
        this.element.querySelectorAll('.drop-zone-active').forEach(el => el.classList.remove('drop-zone-active'));
      }
    });

    // Drop
    this.element.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.element.querySelectorAll('.drop-zone-active').forEach(el => el.classList.remove('drop-zone-active'));

      const target = e.target.closest('.file-card[data-type="folder"], .file-row[data-type="folder"]');
      const sourceId = e.dataTransfer.getData('text/plain');

      if (sourceId && target && sourceId !== target.dataset.id) {
        // Move file/folder to target folder
        try {
          await nodesApi.move(sourceId, target.dataset.id);
          showToast('Déplacé', 'success');
          this.refresh();
        } catch (err) {
          showToast('Erreur lors du déplacement', 'error');
        }
      }
    });
  }

  refresh() {
    const container = this.element.querySelector('#file-container');
    const emptyState = this.element.querySelector('#empty-state');
    const nodes = store.getFilteredNodes();
    const viewMode = store.getViewMode();

    if (nodes.length === 0) {
      if (container) container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
    } else {
      if (emptyState) emptyState.style.display = 'none';
      if (container) {
        container.className = `file-container ${viewMode}`;
        container.innerHTML = viewMode === 'grid' ? this.renderGrid(nodes) : this.renderList(nodes);
      }
    }

    this.bindEvents();
    this.setupDragAndDrop();
  }

  refreshView() {
    const viewMode = store.getViewMode();
    const container = this.element.querySelector('#file-container');
    const nodes = store.getFilteredNodes();

    if (container) {
      container.className = `file-container ${viewMode}`;
      container.innerHTML = viewMode === 'grid' ? this.renderGrid(nodes) : this.renderList(nodes);
    }

    this.bindEvents();
    this.setupDragAndDrop();
  }
}