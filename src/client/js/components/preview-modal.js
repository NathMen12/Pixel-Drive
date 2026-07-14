/**
 * Preview Modal Component
 * Player for Video/Image/Audio/Text with Range support
 */

import { store } from '../store.js';
import { showToast, escapeHtml, getFileIconSvg } from '../utils/dom.js';
import { showModal } from '../utils/dom.js';

export class PreviewModal {
  static async show(node, mediaNodes = []) {
    if (!node) return;

    const currentIndex = mediaNodes.findIndex(n => n.id === node.id);
    const isImage = node.mime_type?.startsWith('image/');
    const isVideo = node.mime_type?.startsWith('video/');
    const isAudio = node.mime_type?.startsWith('audio/');
    const isText = node.mime_type?.startsWith('text/') || 
                   ['application/json', 'application/xml', 'application/javascript', 'application/typescript'].includes(node.mime_type);
    const streamUrl = `/shared/${node.id}`;
    const downloadUrl = `/shared/${node.id}?dl=1`;

    let content = '';

    if (isImage) {
      content = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; max-height: 90vh;">
          <img src="${streamUrl}" alt="${escapeHtml(node.name)}" style="max-width: 100%; max-height: 75vh; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);" id="preview-image">
          <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
            <button id="prev-btn" class="nav-btn" style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #374151; color: white; border: 1px solid #4b5563; ${currentIndex <= 0 ? 'opacity: 0.5; pointer-events: none;' : ''}"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>Précédent</button>
            <a href="${downloadUrl}" class="btn btn-primary" style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; text-decoration: none; background: #4f46e5; color: white; border: none; display: inline-flex; align-items: center; gap: 6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>Télécharger</a>
            <button id="next-btn" class="nav-btn" style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #374151; color: white; border: 1px solid #4b5563; ${currentIndex >= mediaNodes.length - 1 ? 'opacity: 0.5; pointer-events: none;' : ''}">Suivant<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-left: 6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></button>
          </div>
        </div>
      `;
    } else if (isVideo) {
      content = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; max-height: 90vh;">
          <video controls src="${streamUrl}" style="max-width: 100%; max-height: 75vh; border-radius: 8px; background: #000;" id="preview-video"></video>
          <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
            <button id="prev-btn" class="nav-btn" style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #374151; color: white; border: 1px solid #4b5563; ${currentIndex <= 0 ? 'opacity: 0.5; pointer-events: none;' : ''}"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>Précédent</button>
            <a href="${downloadUrl}" class="btn btn-primary" style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; text-decoration: none; background: #4f46e5; color: white; border: none; display: inline-flex; align-items: center; gap: 6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>Télécharger</a>
            <button id="next-btn" class="nav-btn" style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #374151; color: white; border: 1px solid #4b5563; ${currentIndex >= mediaNodes.length - 1 ? 'opacity: 0.5; pointer-events: none;' : ''}">Suivant<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-left: 6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></button>
          </div>
        </div>
      `;
    } else if (isAudio) {
      content = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; max-width: 500px;">
          <div style="width: 100%; text-align: center;">
            ${getFileIconSvg(node.mime_type, 80)}
          </div>
          <audio controls src="${streamUrl}" style="width: 100%;" id="preview-audio"></audio>
          <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
            <button id="prev-btn" class="nav-btn" style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #374151; color: white; border: 1px solid #4b5563; ${currentIndex <= 0 ? 'opacity: 0.5; pointer-events: none;' : ''}"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>Précédent</button>
            <a href="${downloadUrl}" class="btn btn-primary" style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; text-decoration: none; background: #4f46e5; color: white; border: none; display: inline-flex; align-items: center; gap: 6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>Télécharger</a>
            <button id="next-btn" class="nav-btn" style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #374151; color: white; border: 1px solid #4b5563; ${currentIndex >= mediaNodes.length - 1 ? 'opacity: 0.5; pointer-events: none;' : ''}">Suivant<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-left: 6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></button>
          </div>
        </div>
      `;
    } else if (isText) {
      // Fetch text content
      let textContent = 'Chargement...';
      try {
        const response = await fetch(streamUrl);
        if (response.ok) {
          textContent = await response.text();
        } else {
          textContent = 'Erreur de chargement';
        }
      } catch (err) {
        textContent = 'Erreur de chargement';
      }

      content = `
        <div style="display: flex; flex-direction: column; gap: 16px; max-height: 90vh;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #1f2937;">
            <h3 style="font-size: 14px; font-weight: 500;">${escapeHtml(node.name)}</h3>
            <a href="${downloadUrl}" class="btn btn-primary" style="padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 500; text-decoration: none; background: #4f46e5; color: white; border: none; display: inline-flex; align-items: center; gap: 6px;"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>Télécharger</a>
          </div>
          <pre style="flex: 1; overflow: auto; margin: 0; padding: 16px; background: #0d1117; border: 1px solid #1f2937; border-radius: 8px; font-size: 12px; line-height: 1.6; color: #e5e7eb; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; white-space: pre-wrap; word-wrap: break-word;"><code>${escapeHtml(textContent)}</code></pre>
        </div>
      `;
    } else {
      content = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 24px; text-align: center; padding: 40px;">
          ${getFileIconSvg(node.mime_type, 80)}
          <h3 style="font-size: 18px; font-weight: 600;">Aperçu non disponible</h3>
          <p style="color: #9ca3af;">Ce type de fichier ne peut pas être prévisualisé dans le navigateur.</p>
          <a href="${downloadUrl}" class="btn btn-primary" style="padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none; background: #4f46e5; color: white; border: none; display: inline-flex; align-items: center; gap: 8px;"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>Télécharger le fichier</a>
        </div>
      `;
    }

    await showModal({
      title: escapeHtml(node.name),
      size: isText ? 'xl' : 'full',
      content,
      actions: [],
    });

    // Bind navigation
    setTimeout(() => {
      const prevBtn = document.querySelector('#prev-btn');
      const nextBtn = document.querySelector('#next-btn');

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          if (currentIndex > 0) {
            this.show(mediaNodes[currentIndex - 1], mediaNodes);
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          if (currentIndex < mediaNodes.length - 1) {
            this.show(mediaNodes[currentIndex + 1], mediaNodes);
          }
        });
      }

      // Keyboard navigation
      const handleKeydown = (e) => {
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          this.show(mediaNodes[currentIndex - 1], mediaNodes);
        } else if (e.key === 'ArrowRight' && currentIndex < mediaNodes.length - 1) {
          this.show(mediaNodes[currentIndex + 1], mediaNodes);
        } else if (e.key === 'Escape') {
          document.removeEventListener('keydown', handleKeydown);
        }
      };
      document.addEventListener('keydown', handleKeydown);

      // Image zoom for images
      if (isImage) {
        const img = document.querySelector('#preview-image');
        let scale = 1;
        let isDragging = false;
        let startX, startY, translateX = 0, translateY = 0;

        img?.addEventListener('wheel', (e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? 0.9 : 1.1;
          scale = Math.min(Math.max(scale * delta, 0.5), 5);
          img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        }, { passive: false });

        img?.addEventListener('mousedown', (e) => {
          if (scale > 1) {
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            img.style.cursor = 'grabbing';
          }
        });

        document.addEventListener('mousemove', (e) => {
          if (isDragging) {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
          }
        });

        document.addEventListener('mouseup', () => {
          isDragging = false;
          img.style.cursor = scale > 1 ? 'grab' : 'default';
        });

        // Double click to reset
        img?.addEventListener('dblclick', () => {
          scale = 1;
          translateX = 0;
          translateY = 0;
          img.style.transform = 'translate(0, 0) scale(1)';
        });
      }
    }, 100);
  }
}