/**
 * Gallery View Component - Masonry grid for images/videos
 */

import { store } from '../store.js';
import { navigate, router } from '../router.js';
import { showToast, formatBytes, escapeHtml, getFileIconSvg } from '../utils/dom.js';
import { PreviewModal } from './preview-modal.js';
import { ContextMenu } from './context-menu.js';

export class GalleryView {
  constructor() {
    this.element = null;
    this.observer = null;
  }

  render() {
    this.element = document.createElement('main');
    this.element.className = 'gallery-view';
    this.element.style.cssText = `
      flex: 1;
      overflow: auto;
      background: #0d1117;
      padding: 24px;
    `;

    const mediaNodes = store.getMediaNodes();

    this.element.innerHTML = `
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
        <div>
          <h1 style="font-size: 28px; font-weight: 700;">Galerie</h1>
          <p style="color: #9ca3af; margin-top: 4px;">${mediaNodes.length} média${mediaNodes.length > 1 ? 's' : ''}</p>
        </div>
        <div style="display: flex; gap: 12px;">
          <select id="gallery-filter" class="form-select" style="padding: 8px 12px; background: #1f2937; border: 1px solid #374151; border-radius: 8px; color: white; font-size: 13px; cursor: pointer;">
            <option value="all">Tous</option>
            <option value="images">Images</option>
            <option value="videos">Vidéos</option>
          </select>
        </div>
      </div>

      <!-- Masonry Grid -->
      <div id="gallery-grid" class="gallery-grid" style="
        columns: 1;
        column-gap: 12px;
      ">
        ${mediaNodes.length === 0 ? `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; text-align: center; color: #6b7280; column-span: all;">
            <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-bottom: 16px; opacity: 0.5;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #9ca3af;">Aucun média</h3>
            <p>Importez des images ou vidéos pour les voir ici</p>
          </div>
        ` : mediaNodes.map(node => this.renderGalleryItem(node)).join('')}
      </div>

      <style>
        .gallery-item {
          break-inside: avoid;
          margin-bottom: 12px;
          border-radius: 12px;
          overflow: hidden;
          background: #111827;
          border: 1px solid #1f2937;
          transition: all 0.2s;
          cursor: pointer;
          position: relative;
        }
        .gallery-item:hover {
          border-color: #374151;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          transform: translateY(-2px);
        }
        .gallery-item video {
          width: 100%;
          height: auto;
          display: block;
          background: #000;
        }
        .gallery-item img {
          width: 100%;
          height: auto;
          display: block;
        }
        .gallery-item-info {
          padding: 12px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .gallery-item-name {
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 70%;
        }
        .gallery-item-meta {
          display: flex;
          gap: 8px;
          font-size: 11px;
          color: #9ca3af;
        }
        .gallery-item-menu {
          position: absolute;
          top: 8px;
          right: 8px;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .gallery-item:hover .gallery-item-menu {
          opacity: 1;
        }
        .gallery-menu-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(17, 24, 39, 0.9);
          border: 1px solid #374151;
          color: #9ca3af;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(4px);
        }
        .gallery-menu-btn:hover {
          background: #1f2937;
          color: white;
        }

        /* Responsive columns */
        @media (min-width: 640px) { .gallery-grid { columns: 2; } }
        @media (min-width: 1024px) { .gallery-grid { columns: 3; } }
        @media (min-width: 1440px) { .gallery-grid { columns: 4; } }
      </style>
    `;

    this.bindEvents();
    this.setupLazyLoading();
    return this.element;
  }

  renderGalleryItem(node) {
    const isImage = node.mime_type?.startsWith('image/');
    const isVideo = node.mime_type?.startsWith('video/');
    const thumbUrl = node.thumb_url || (node.chunks?.[0]?.url);

    return `
      <div class="gallery-item" data-id="${node.id}" data-type="${node.type}" data-mime="${escapeHtml(node.mime_type || '')}">
        <div class="gallery-item-menu">
          <button class="gallery-menu-btn" data-id="${node.id}"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg></button>
        </div>
        ${thumbUrl ? `
          ${isImage ? `<img src="${thumbUrl}" alt="${escapeHtml(node.name)}" loading="lazy">` : ''}
          ${isVideo ? `<video src="${thumbUrl}" muted playsinline loop preload="metadata"></video>` : ''}
        ` : `
          <div style="aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center; color: #6b7280;">
            ${getFileIconSvg(node.mime_type, 48)}
          </div>
        `}
        <div class="gallery-item-info">
          <span class="gallery-item-name" title="${escapeHtml(node.name)}">${escapeHtml(node.name)}</span>
          <div class="gallery-item-meta">
            <span>${formatBytes(node.size)}</span>
            ${isVideo ? '<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 15.652l3.536-3.536a1 1 0 000-1.414l-3.536-3.536A1 1 0 0013.5 10.5v7a1 1 0 001.252.952z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Filter
    this.element.querySelector('#gallery-filter')?.addEventListener('change', (e) => {
      this.filterGallery(e.target.value);
    });

    // Item clicks
    this.element.querySelectorAll('.gallery-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.gallery-menu-btn')) return;
        const id = item.dataset.id;
        const node = store.getNode(id);
        if (node) {
          const mediaNodes = store.getMediaNodes();
          PreviewModal.show(node, mediaNodes);
        }
      });

      // Context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        ContextMenu.show(e.clientX, e.clientY, 'node', item.dataset.id);
      });

      // Menu button
      item.querySelector('.gallery-menu-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        ContextMenu.show(e.clientX, e.clientY, 'node', item.dataset.id);
      });
    });
  }

  filterGallery(filter) {
    const items = this.element.querySelectorAll('.gallery-item');
    items.forEach(item => {
      const mime = item.dataset.mime || '';
      const isImage = mime.startsWith('image/');
      const isVideo = mime.startsWith('video/');

      let show = false;
      if (filter === 'all') show = true;
      else if (filter === 'images' && isImage) show = true;
      else if (filter === 'videos' && isVideo) show = true;

      item.style.display = show ? 'block' : 'none';
    });
  }

  setupLazyLoading() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const media = entry.target.querySelector('img, video');
            if (media && media.dataset.src) {
              media.src = media.dataset.src;
              media.removeAttribute('data-src');
            }
            this.observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '100px' });

      this.element.querySelectorAll('.gallery-item img[loading="lazy"], .gallery-item video[preload="metadata"]').forEach(el => {
        this.observer.observe(el.parentElement);
      });
    }
  }

  refresh() {
    const grid = this.element.querySelector('#gallery-grid');
    const mediaNodes = store.getMediaNodes();

    if (grid) {
      if (mediaNodes.length === 0) {
        grid.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; text-align: center; color: #6b7280; column-span: all;">
            <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-bottom: 16px; opacity: 0.5;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #9ca3af;">Aucun média</h3>
            <p>Importez des images ou vidéos pour les voir ici</p>
          </div>
        `;
      } else {
        grid.innerHTML = mediaNodes.map(node => this.renderGalleryItem(node)).join('');
      }
    }

    this.bindEvents();
    this.setupLazyLoading();
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}