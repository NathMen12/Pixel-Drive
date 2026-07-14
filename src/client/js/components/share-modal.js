/**
 * Share Modal Component
 * Public link (pwd, expiry), User share
 */

import { store } from '../store.js';
import { nodesApi, sharesApi } from '../api.js';
import { showToast, formatBytes, escapeHtml } from '../utils/dom.js';
import { showModal } from '../utils/dom.js';

export class ShareModal {
  static async show(nodeId) {
    const node = store.getNode(nodeId);
    if (!node) return;

    const existingShares = await sharesApi.list(nodeId).catch(() => ({ shares: [] }));

    const result = await showModal({
      title: `Partager : ${escapeHtml(node.name)}`,
      size: 'lg',
      content: `
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Public Link -->
          <section>
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
              Lien public
            </h3>

            <div id="public-share-form" style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px;">Permission</label>
                <select id="public-permission" class="form-select" style="padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; width: 100%; box-sizing: border-box;">
                  <option value="read">Lecture seule</option>
                  <option value="write">Lecture/Écriture</option>
                </select>
              </div>

              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px;">Mot de passe (optionnel)</label>
                <input type="password" id="public-password" class="form-input" placeholder="Laisser vide pour aucun mot de passe" style="padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; width: 100%; box-sizing: border-box;">
              </div>

              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px;">Expiration (optionnel)</label>
                <select id="public-expiry" class="form-select" style="padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; width: 100%; box-sizing: border-box;">
                  <option value="">Jamais</option>
                  <option value="1h">1 heure</option>
                  <option value="24h">24 heures</option>
                  <option value="7d">7 jours</option>
                  <option value="30d">30 jours</option>
                </select>
              </div>

              <button id="create-public-share" class="btn btn-primary" style="width: 100%; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; background: #4f46e5; color: white; border: none;">Créer le lien</button>
            </div>

            <div id="public-share-result" style="display: none;">
              <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <input type="text" id="share-url" readonly class="form-input" style="flex: 1; padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px;">
                <button id="copy-share-url" class="btn btn-secondary" style="padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; background: #374151; color: white; border: 1px solid #4b5563;">Copier</button>
              </div>
              <div style="font-size: 12px; color: #9ca3af;">
                <span id="share-permission-badge" style="padding: 2px 8px; background: #1f2937; border-radius: 4px; margin-right: 8px;"></span>
                <span id="share-expiry-badge" style="padding: 2px 8px; background: #1f2937; border-radius: 4px;"></span>
              </div>
              <button id="revoke-public-share" class="btn btn-danger" style="margin-top: 12px; width: 100%; padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #dc2626; color: white; border: none;">Révoquer le lien</button>
            </div>
          </section>

          <hr style="border: none; border-top: 1px solid #1f2937;">

          <!-- User Shares -->
          <section>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
              <h3 style="font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                Partages utilisateurs
              </h3>
              <button id="add-user-share" class="btn btn-secondary" style="padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; background: #374151; color: white; border: 1px solid #4b5563;">Ajouter</button>
            </div>

            <div id="user-shares-list" style="display: flex; flex-direction: column; gap: 8px;">
              ${existingShares.shares?.filter(s => s.target_type === 'user').map(share => `
                <div class="user-share-item" data-id="${share.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #1f2937; border: 1px solid #374151; border-radius: 10px;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; color: white;">${escapeHtml(share.target_username?.charAt(0).toUpperCase() || 'U')}</div>
                    <div>
                      <div style="font-weight: 500;">${escapeHtml(share.target_username || 'Utilisateur')}</div>
                      <div style="font-size: 12px; color: #9ca3af;">${share.permission === 'read' ? 'Lecture' : 'Lecture/Écriture'}</div>
                    </div>
                  </div>
                  <button class="icon-btn danger remove-user-share" data-id="${share.id}" style="width: 32px; height: 32px; border-radius: 8px; background: #111827; border: 1px solid #374151; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </div>
              `).join('') || '<div style="text-align: center; padding: 24px; color: #6b7280;">Aucun partage utilisateur</div>'}
            </div>
          </section>

          <!-- Add User Share Modal Trigger -->
          <div id="add-user-share-modal" style="display: none;">
            <!-- Will be populated dynamically -->
          </div>
        </div>
      `,
      actions: [
        { label: 'Fermer', variant: 'ghost', value: 'close' },
      ],
    });

    // Bind events after modal is shown
    setTimeout(() => {
      this.bindEvents(nodeId, existingShares.shares || []);
    }, 100);
  }

  static bindEvents(nodeId, existingShares) {
    // Create public share
    document.querySelector('#create-public-share')?.addEventListener('click', async () => {
      const permission = document.querySelector('#public-permission')?.value;
      const password = document.querySelector('#public-password')?.value;
      const expiry = document.querySelector('#public-expiry')?.value;

      try {
        const response = await sharesApi.createPublic(nodeId, { permission, password: password || null, expiresAt: expiry || null });
        showToast('Lien créé', 'success');
        this.showPublicShareResult(response.share);
      } catch (err) {
        showToast(err.message || 'Erreur', 'error');
      }
    });

    // Copy share URL
    document.querySelector('#copy-share-url')?.addEventListener('click', () => {
      const input = document.querySelector('#share-url');
      input.select();
      document.execCommand('copy');
      showToast('Copié', 'success');
    });

    // Revoke public share
    document.querySelector('#revoke-public-share')?.addEventListener('click', async () => {
      const shareId = document.querySelector('#revoke-public-share')?.dataset.shareId;
      if (!shareId) return;

      const confirmed = await confirm({
        title: 'Révoquer le lien',
        message: 'Ce lien ne fonctionnera plus pour personne.',
        confirmLabel: 'Révoquer',
        variant: 'danger',
      });
      if (!confirmed) return;

      try {
        await sharesApi.delete(shareId);
        showToast('Lien révoqué', 'success');
        this.hidePublicShareResult();
      } catch (err) {
        showToast('Erreur', 'error');
      }
    });

    // Add user share
    document.querySelector('#add-user-share')?.addEventListener('click', () => this.showAddUserShareModal(nodeId));

    // Remove user shares
    document.querySelectorAll('.remove-user-share').forEach(btn => {
      btn.addEventListener('click', () => this.removeUserShare(btn.dataset.id));
    });

    // Check for existing public share
    const publicShare = existingShares.find(s => s.target_type === 'public');
    if (publicShare) {
      this.showPublicShareResult(publicShare);
    }
  }

  static showPublicShareResult(share) {
    const form = document.querySelector('#public-share-form');
    const result = document.querySelector('#public-share-result');
    const urlInput = document.querySelector('#share-url');
    const permBadge = document.querySelector('#share-permission-badge');
    const expiryBadge = document.querySelector('#share-expiry-badge');
    const revokeBtn = document.querySelector('#revoke-public-share');

    if (form) form.style.display = 'none';
    if (result) result.style.display = 'block';

    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/s/${share.id}`;
    if (urlInput) urlInput.value = shareUrl;
    if (permBadge) permBadge.textContent = share.permission === 'read' ? 'Lecture' : 'Lecture/Écriture';
    if (expiryBadge) {
      if (share.expires_at) {
        expiryBadge.textContent = `Expire le ${new Date(share.expires_at).toLocaleDateString('fr-FR')}`;
      } else {
        expiryBadge.textContent = 'Pas d\'expiration';
      }
    }
    if (revokeBtn) revokeBtn.dataset.shareId = share.id;
  }

  static hidePublicShareResult() {
    const form = document.querySelector('#public-share-form');
    const result = document.querySelector('#public-share-result');
    if (form) form.style.display = 'flex';
    if (result) result.style.display = 'none';
  }

  static async showAddUserShareModal(nodeId) {
    const result = await showModal({
      title: 'Partager avec un utilisateur',
      size: 'md',
      content: `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px;">Nom d'utilisateur ou email</label>
            <input type="text" id="share-username" class="form-input" placeholder="Rechercher un utilisateur..." style="padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; width: 100%; box-sizing: border-box;">
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px;">Permission</label>
            <select id="share-permission" class="form-select" style="padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; width: 100%; box-sizing: border-box;">
              <option value="read">Lecture seule</option>
              <option value="write">Lecture/Écriture</option>
            </select>
          </div>
          <div id="share-user-results" style="display: none; max-height: 200px; overflow-y: auto; background: #1f2937; border: 1px solid #374151; border-radius: 8px;"></div>
        </div>
      `,
      actions: [
        { label: 'Annuler', variant: 'ghost', value: 'cancel' },
        { label: 'Partager', variant: 'primary', value: 'share', disabled: true },
      ],
    });

    if (result === 'share') {
      const targetId = document.querySelector('#share-username')?.dataset.userId;
      const permission = document.querySelector('#share-permission')?.value;
      if (targetId) {
        try {
          await sharesApi.createUser(nodeId, { targetId, permission });
          showToast('Partagé', 'success');
          window.location.reload();
        } catch (err) {
          showToast(err.message || 'Erreur', 'error');
        }
      }
    }
  }

  static async removeUserShare(shareId) {
    const confirmed = await confirm({
      title: 'Retirer le partage',
      message: 'Cet utilisateur n\'aura plus accès à cet élément.',
      confirmLabel: 'Retirer',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await sharesApi.delete(shareId);
      showToast('Partage retiré', 'success');
      window.location.reload();
    } catch (err) {
      showToast('Erreur', 'error');
    }
  }
}

// Import confirm at the end to avoid circular dependency
import { confirm } from './confirm-modal.js';