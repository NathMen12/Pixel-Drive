/**
 * Context Menu Component
 * Right-click context menu for files/folders
 */

import { store } from '../store.js';
import { navigate } from '../router.js';
import { nodesApi, sharesApi } from '../api.js';
import { showToast, escapeHtml } from '../utils/dom.js';
import { PreviewModal } from './preview-modal.js';
import { InfoModal } from './info-modal.js';
import { ShareModal } from './share-modal.js';
import { showRenameModal } from './rename-modal.js';
import { confirm } from './confirm-modal.js';

export class ContextMenu {
  static menu = null;
  static targetNode = null;
  static targetType = null; // 'node' | 'empty' | 'folder'

  static show(x, y, type, id = null) {
    this.hide();

    this.targetType = type;
    this.targetNode = id ? store.getNode(id) : null;

    const node = this.targetNode;
    const isFile = node?.type === 'file';
    const isFolder = node?.type === 'folder';
    const isMedia = isFile && (node.mime_type?.startsWith('image/') || node.mime_type?.startsWith('video/') || node.mime_type?.startsWith('audio/'));
    const isText = isFile && (node.mime_type?.startsWith('text/') || ['application/json', 'application/xml', 'application/javascript', 'application/typescript'].includes(node.mime_type));

    const items = [];

    if (type === 'node' && node) {
      // Preview
      if (isMedia || isText) {
        items.push({
          label: 'Aperçu',
          icon: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>',
          action: () => PreviewModal.show(node, store.getNodes().filter(n => n.type === 'file' && (n.mime_type?.startsWith('image/') || n.mime_type?.startsWith('video/') || n.mime_type?.startsWith('audio/') || n.mime_type?.startsWith('text/'))))
        });
      }

      // Download
      if (isFile) {
        items.push({
          label: 'Télécharger',
          icon: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>',
          action: () => window.open(`/shared/${node.id}?dl=1`, '_blank')
        });
      }

      // Share
      items.push({
        label: 'Partager',
        icon: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>',
        action: () => ShareModal.show(node.id)
      });

      // Info
      items.push({
        label: 'Informations',
        icon: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
        action: () => InfoModal.show(node)
      });

      items.push({ divider: true });

      // Rename
      items.push({
        label: 'Renommer',
        icon: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>',
        action: async () => {
          const newName = await showRenameModal(node);
          if (newName) {
            try {
              await nodesApi.rename(node.id, newName);
              showToast('Renommé', 'success');
              window.dispatchEvent(new CustomEvent('nodes:refresh'));
            } catch (err) {
              showToast('Erreur', 'error');
            }
          }
        }
      });

      // Favorite toggle
      items.push({
        label: node.is_fav ? 'Retirer des favoris' : 'Ajouter aux favoris',
        icon: node.is_fav
          ? '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>'
          : '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>',
        action: async () => {
          try {
            await nodesApi.toggleFav(node.id);
            showToast(node.is_fav ? 'Retiré des favoris' : 'Ajouté aux favoris', 'success');
            window.dispatchEvent(new CustomEvent('nodes:refresh'));
          } catch (err) {
            showToast('Erreur', 'error');
          }
        }
      });

      // Move to trash
      items.push({
        label: 'Corbeille',
        icon: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>',
        variant: 'danger',
        action: async () => {
          const confirmed = await confirm({
            title: 'Corbeille',
            message: `Déplacer "${escapeHtml(node.name)}" vers la corbeille ?`,
            confirmLabel: 'Déplacer',
            variant: 'danger',
          });
          if (confirmed) {
            try {
              await nodesApi.trash(node.id);
              showToast('Déplacé vers la corbeille', 'success');
              window.dispatchEvent(new CustomEvent('nodes:refresh'));
            } catch (err) {
              showToast('Erreur', 'error');
            }
          }
        }
      });

      // Delete permanently (if in trash)
      if (node.is_trashed) {
        items.push({ divider: true });
        items.push({
          label: 'Supprimer définitivement',
          icon: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>',
          variant: 'danger',
          action: async () => {
            const confirmed = await confirm({
              title: 'Supprimer définitivement',
              message: 'Cet élément sera supprimé pour de bon. Impossible à récupérer.',
              confirmLabel: 'Supprimer',
              variant: 'danger',
            });
            if (confirmed) {
              try {
                await nodesApi.delete(node.id);
                showToast('Supprimé définitivement', 'success');
                window.dispatchEvent(new CustomEvent('nodes:refresh'));
              } catch (err) {
                showToast('Erreur', 'error');
              }
            }
          }
        });
      }
    } else if (type === 'empty') {
      // New folder
      items.push({
        label: 'Nouveau dossier',
        icon: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>',
        action: async () => {
          const name = prompt('Nom du nouveau dossier :');
          if (name?.trim()) {
            try {
              await nodesApi.createFolder({ name: name.trim(), parentId: store.getCurrentFolder() });
              showToast('Dossier créé', 'success');
              window.dispatchEvent(new CustomEvent('nodes:refresh'));
            } catch (err) {
              showToast('Erreur', 'error');
            }
          }
        }
      });

      // Upload
      items.push({
        label: 'Importer des fichiers',
        icon: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>',
        action: () => {
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
        }
      });
    } else if (type === 'folder' && node) {
      // Open folder
      items.push({
        label: 'Ouvrir',
        icon: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>',
        action: () => navigate(`/drive?folder=${node.id}`)
      });
    }

    if (items.length === 0) return;

    this.menu = document.createElement('div');
    this.menu.className = 'context-menu';
    this.menu.style.cssText = `
      position: fixed;
      top: ${y}px;
      left: ${x}px;
      z-index: 1000;
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 10px;
      padding: 6px;
      min-width: 200px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      animation: fadeIn 0.1s ease-out;
    `;

    this.menu.innerHTML = items.map(item => {
      if (item.divider) {
        return '<hr style="border: none; border-top: 1px solid #1f2937; margin: 6px 0;">';
      }
      return `
        <button class="context-menu-item ${item.variant || ''}" data-action="${item.label}" style="
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: ${item.variant === 'danger' ? '#f87171' : '#e5e7eb'};
          font-size: 13px;
          cursor: pointer;
          text-align: left;
          transition: all 0.1s;
        ">
          ${item.icon}
          <span>${item.label}</span>
        </button>
      `;
    }).join('');

    document.body.appendChild(this.menu);

    // Add styles
    if (!document.getElementById('context-menu-styles')) {
      const style = document.createElement('style');
      style.id = 'context-menu-styles';
      style.textContent = `
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .context-menu-item:hover { background: #1f2937; }
        .context-menu-item.danger:hover { background: #7f1d1d; color: white; }
      `;
      document.head.appendChild(style);
    }

    // Bind events
    this.menu.querySelectorAll('.context-menu-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = items.find(i => i.label === btn.dataset.action);
        if (item?.action) item.action();
        this.hide();
      });
    });

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', this.hide.bind(this), { once: true });
      document.addEventListener('contextmenu', this.hide.bind(this), { once: true });
    }, 0);

    // Keep menu in viewport
    requestAnimationFrame(() => {
      const rect = this.menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.menu.style.left = `${window.innerWidth - rect.width - 8}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.menu.style.top = `${window.innerHeight - rect.height - 8}px`;
      }
    });
  }

  static hide() {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
    this.targetNode = null;
    this.targetType = null;
  }
}