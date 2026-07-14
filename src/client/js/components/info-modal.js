/**
 * Info Modal Component
 * Shows file details: Size, Chunks, SHA256, SHA1, Thumb
 */

import { store } from '../store.js';
import { nodesApi } from '../api.js';
import { showToast, formatBytes, escapeHtml, getFileIconSvg } from '../utils/dom.js';
import { showModal } from '../utils/dom.js';

export class InfoModal {
  static async show(node) {
    if (!node) return;

    // Fetch fresh data for complete info
    let freshNode = node;
    try {
      const response = await nodesApi.get(node.id);
      freshNode = response.node || node;
    } catch (err) {
      console.warn('Could not fetch fresh node data:', err);
    }

    const chunks = freshNode.chunks || [];
    const totalChunkSize = chunks.reduce((sum, c) => sum + (c.size || 0), 0);
    const isImage = freshNode.mime_type?.startsWith('image/');
    const isVideo = freshNode.mime_type?.startsWith('video/');
    const thumbUrl = freshNode.thumb_url || (chunks[0]?.url);

    await showModal({
      title: `Informations : ${escapeHtml(freshNode.name)}`,
      size: 'lg',
      content: `
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Header with thumbnail -->
          <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            <div class="info-thumb" style="width: 120px; height: 120px; border-radius: 12px; background: #1f2937; border: 1px solid #374151; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
              ${thumbUrl && isImage ? `<img src="${thumbUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
              ${thumbUrl && isVideo ? `<video src="${thumbUrl}" muted playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>` : ''}
              ${!thumbUrl || (!isImage && !isVideo) ? `<div style="color: #6b7280;">${getFileIconSvg(freshNode.mime_type, 48)}</div>` : ''}
            </div>
            <div style="flex: 1; min-width: 200px;">
              <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 4px; word-break: break-word;">${escapeHtml(freshNode.name)}</h3>
              <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
                <span style="padding: 4px 10px; background: #1f2937; border: 1px solid #374151; border-radius: 6px; font-size: 11px; color: #9ca3af;">${escapeHtml(freshNode.mime_type || 'inconnu')}</span>
                <span style="padding: 4px 10px; background: #1f2937; border: 1px solid #374151; border-radius: 6px; font-size: 11px; color: #9ca3af;">${freshNode.type === 'folder' ? 'Dossier' : 'Fichier'}</span>
                ${freshNode.is_fav ? '<span style="padding: 4px 10px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; font-size: 11px; color: #92400e;">⭐ Favori</span>' : ''}
                ${freshNode.is_trashed ? '<span style="padding: 4px 10px; background: #fee2e2; border: 1px solid #ef4444; border-radius: 6px; font-size: 11px; color: #991b1b;">🗑 Corbeille</span>' : ''}
              </div>
              <div style="font-size: 13px; color: #9ca3af;">
                <div>ID: <code style="background: #1f2937; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${freshNode.id}</code></div>
                <div style="margin-top: 4px;">Dossier parent: <code style="background: #1f2937; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${freshNode.parent_id || 'Racine'}</code></div>
              </div>
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid #1f2937;">

          <!-- File Details Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <!-- Original Size -->
            <div class="info-card" style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 16px;">
              <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 8px;">Taille originale</div>
              <div style="font-size: 24px; font-weight: 700; color: #e5e7eb;">${formatBytes(freshNode.size)}</div>
              <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">${freshNode.size.toLocaleString()} octets</div>
            </div>

            <!-- ImgBB Size -->
            <div class="info-card" style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 16px;">
              <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 8px;">Taille sur ImgBB</div>
              <div style="font-size: 24px; font-weight: 700; color: #e5e7eb;">${formatBytes(totalChunkSize)}</div>
              <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">${chunks.length} chunk${chunks.length > 1 ? 's' : ''} • ${formatBytes(CHUNK_SIZE)} par chunk</div>
            </div>

            <!-- Chunks Count -->
            <div class="info-card" style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 16px;">
              <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 8px;">Chunks</div>
              <div style="font-size: 24px; font-weight: 700; color: #e5e7eb;">${chunks.length}</div>
              <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">Index 0 à ${chunks.length - 1}</div>
            </div>

            <!-- Encryption -->
            <div class="info-card" style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 16px;">
              <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 8px;">Chiffrement</div>
              <div style="font-size: 13px; font-weight: 500; color: #e5e7eb; margin-bottom: 4px;">${freshNode.enc_algo || 'AES-GCM'}</div>
              <div style="font-size: 11px; color: #6b7280;">DEK wrap: AES-KW</div>
            </div>
          </div>

          <!-- Integrity Hashes -->
          <div style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
              Intégrité (Fichier Original)
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
              <!-- SHA-256 -->
              <div>
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 8px;">SHA-256</div>
                <div style="display: flex; gap: 8px;">
                  <input type="text" id="sha256-value" readonly value="${freshNode.sha256 || '—'}" style="flex: 1; padding: 10px 12px; background: #1f2937; border: 1px solid #374151; border-radius: 8px; color: #e5e7eb; font-family: monospace; font-size: 12px;">
                  <button id="copy-sha256" class="icon-btn" style="width: 40px; height: 40px; border-radius: 8px; background: #374151; border: 1px solid #4b5563; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Copier SHA-256"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg></button>
                </div>
              </div>

              <!-- SHA-1 -->
              <div>
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 8px;">SHA-1</div>
                <div style="display: flex; gap: 8px;">
                  <input type="text" id="sha1-value" readonly value="${freshNode.sha1 || '—'}" style="flex: 1; padding: 10px 12px; background: #1f2937; border: 1px solid #374151; border-radius: 8px; color: #e5e7eb; font-family: monospace; font-size: 12px;">
                  <button id="copy-sha1" class="icon-btn" style="width: 40px; height: 40px; border-radius: 8px; background: #374151; border: 1px solid #4b5563; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Copier SHA-1"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg></button>
                </div>
              </div>
            </div>
          </div>

          <!-- Encryption Details -->
          <div style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              Détails de chiffrement
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; font-size: 12px;">
              <div>
                <div style="color: #6b7280; margin-bottom: 4px;">IV Global (Hex)</div>
                <div style="font-family: monospace; color: #e5e7eb; word-break: break-all;">${freshNode.enc_iv ? this.bytesToHex(new Uint8Array(freshNode.enc_iv)) : '—'}</div>
              </div>
              <div>
                <div style="color: #6b7280; margin-bottom: 4px;">DEK Wrappée (Base64)</div>
                <div style="font-family: monospace; color: #e5e7eb; word-break: break-all;">${freshNode.enc_key_wrapped ? freshNode.enc_key_wrapped.substring(0, 64) + '...' : '—'}</div>
              </div>
              <div>
                <div style="color: #6b7280; margin-bottom: 4px;">Algorithme</div>
                <div style="color: #e5e7eb;">${freshNode.enc_algo || 'AES-GCM'}</div>
              </div>
              <div>
                <div style="color: #6b7280; margin-bottom: 4px;">Version Clé Maître</div>
                <div style="color: #e5e7eb;">${freshNode.master_key_version || 1}</div>
              </div>
            </div>
          </div>

          <!-- Chunks Details -->
          ${chunks.length > 0 ? `
          <div style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 16px;">Détails des chunks</div>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="text-align: left; color: #6b7280; border-bottom: 1px solid #1f2937;">
                    <th style="padding: 10px 12px; font-weight: 500;">Index</th>
                    <th style="padding: 10px 12px; font-weight: 500;">Taille</th>
                    <th style="padding: 10px 12px; font-weight: 500;">IV (Base64)</th>
                    <th style="padding: 10px 12px; font-weight: 500;">URL ImgBB</th>
                  </tr>
                </thead>
                <tbody>
                  ${chunks.map((chunk, i) => `
                    <tr style="border-bottom: 1px solid #1f2937;">
                      <td style="padding: 10px 12px; font-family: monospace; color: #9ca3af;">${chunk.index ?? i}</td>
                      <td style="padding: 10px 12px; color: #e5e7eb;">${formatBytes(chunk.size)}</td>
                      <td style="padding: 10px 12px; font-family: monospace; color: #9ca3af; font-size: 11px;">${chunk.iv || '—'}</td>
                      <td style="padding: 10px 12px;">
                        <a href="${chunk.url}" target="_blank" style="color: #6366f1; font-size: 11px; word-break: break-all; text-decoration: none;">${chunk.url}</a>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          ` : ''}

          <!-- Timestamps -->
          <div style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 16px;">Horodatages</div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; font-size: 13px;">
              <div><span style="color: #6b7280;">Créé :</span> <span style="color: #e5e7eb; margin-left: 8px;">${freshNode.created_at ? new Date(freshNode.created_at).toLocaleString('fr-FR') : '—'}</span></div>
              <div><span style="color: #6b7280;">Modifié :</span> <span style="color: #e5e7eb; margin-left: 8px;">${freshNode.updated_at ? new Date(freshNode.updated_at).toLocaleString('fr-FR') : '—'}</span></div>
              ${freshNode.trashed_at ? `<div><span style="color: #6b7280;">Mis en corbeille :</span> <span style="color: #e5e7eb; margin-left: 8px;">${new Date(freshNode.trashed_at).toLocaleString('fr-FR')}</span></div>` : ''}
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 12px; flex-wrap: wrap; padding-top: 8px;">
            <button id="info-download" class="btn btn-primary" style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #4f46e5; color: white; border: none;">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px; vertical-align: middle;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              Télécharger
            </button>
            <button id="info-copy-link" class="btn btn-secondary" style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #374151; color: white; border: 1px solid #4b5563;">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px; vertical-align: middle;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
              Copier lien direct
            </button>
            <button id="info-open-thumb" class="btn btn-secondary" style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #374151; color: white; border: 1px solid #4b5563; ${!thumbUrl ? 'display: none;' : ''}">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px; vertical-align: middle;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              Ouvrir vignette
            </button>
          </div>
        </div>
      `,
      actions: [],
    });

    // Bind action buttons
    setTimeout(() => {
      document.querySelector('#copy-sha256')?.addEventListener('click', () => {
        navigator.clipboard.writeText(freshNode.sha256 || '');
        showToast('SHA-256 copié', 'success');
      });
      document.querySelector('#copy-sha1')?.addEventListener('click', () => {
        navigator.clipboard.writeText(freshNode.sha1 || '');
        showToast('SHA-1 copié', 'success');
      });
      document.querySelector('#info-download')?.addEventListener('click', () => {
        window.open(`/shared/${freshNode.id}?dl=1`, '_blank');
      });
      document.querySelector('#info-copy-link')?.addEventListener('click', () => {
        const url = `${window.location.origin}/shared/${freshNode.id}`;
        navigator.clipboard.writeText(url);
        showToast('Lien copié', 'success');
      });
      document.querySelector('#info-open-thumb')?.addEventListener('click', () => {
        if (thumbUrl) window.open(thumbUrl, '_blank');
      });
    }, 100);
  }

  static bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// CHUNK_SIZE constant
const CHUNK_SIZE = 25 * 1024 * 1024;