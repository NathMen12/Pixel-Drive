/**
 * Settings View Component - Theme, Keys, API Keys, Trash, Danger Zone
 */

import { store } from '../store.js';
import { authManager } from '../auth.js';
import { navigate, router } from '../router.js';
import { nodesApi, apiKeyApi, adminApi } from '../api.js';
import { showToast, formatBytes, escapeHtml } from '../utils/dom.js';
import { themeManager } from '../theme.js';
import { confirm } from './confirm-modal.js';

const ICON = {
  theme: '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.36 6.36l-.7-.7M6.34 6.34l-.7-.7m12.73 0l-.7.7M6.34 17.66l-.7.7M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>',
  user: '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>',
  storage: '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>',
  key: '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.7 5.7L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.6a1 1 0 01.3-.7l6-6A1 1 0 0111 10.6V9a1 1 0 011-1h2a1 1 0 011 1v1.6a1 1 0 01-.3.7l-2 2"></path></svg>',
  trash: '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.9 12.1a2 2 0 01-2 1.9H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M3 7h18M10 7V5a2 2 0 012-2h0a2 2 0 012 2v2"></path></svg>',
};

export class SettingsView {
  constructor() {
    this.element = null;
  }

  render() {
    this.element = document.createElement('main');
    this.element.className = 'settings-view';
    this.element.style.cssText = 'flex:1;overflow:auto;background:#0d1117;padding:24px;';
    const user = store.getUser();
    const storage = store.getStorage();
    const theme = themeManager.getTheme();
    this.element.innerHTML = this.getTemplate(user, storage, theme);
    this.bindEvents();
    return this.element;
  }

  section(title, icon, body) {
    return `<section class="settings-section" style="margin-bottom:32px;">
      <h2 style="font-size:18px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px;">${icon}${title}</h2>
      <div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;">${body}</div>
    </section>`;
  }

  getTemplate(user, storage, theme) {
    const themeBtns = ['light', 'dark', 'system'].map(t => `
      <button class="theme-option ${theme === t ? 'active' : ''}" data-theme="${t}" style="padding:10px 16px;border-radius:8px;border:1px solid ${theme === t ? '#6366f1' : '#374151'};background:${theme === t ? 'rgba(99,102,241,0.1)' : '#1f2937'};color:${theme === t ? '#6366f1' : '#e5e7eb'};font-size:13px;font-weight:500;cursor:pointer;">${t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '💻'} ${t[0].toUpperCase() + t.slice(1)}</button>`).join('');

    const appearance = `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div><h3 style="font-weight:500;">Thème</h3><p style="font-size:13px;color:#9ca3af;margin-top:4px;">Choisissez l'apparence de l'interface</p></div>
      <div class="theme-options" style="display:flex;gap:8px;">${themeBtns}</div></div>`;

    const account = `<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #1f2937;">
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:24px;color:white;">${(user?.username || 'U')[0].toUpperCase()}</div>
        <div>
          <h3 style="font-size:18px;font-weight:600;">${escapeHtml(user?.username || 'Utilisateur')}</h3>
          <p style="color:#9ca3af;font-size:14px;">${escapeHtml(user?.email || 'Aucun email')}</p>
          <span style="display:inline-block;margin-top:8px;padding:4px 10px;background:#1f2937;border-radius:10px;font-size:11px;color:#9ca3af;">${user?.is_admin ? 'Administrateur' : 'Utilisateur'}</span>
        </div>
      </div>
      <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">
        <div>
          <label style="display:block;font-size:13px;font-weight:500;margin-bottom:8px;color:#d1d5db;">Changer le mot de passe</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input type="password" id="current-password" placeholder="Mot de passe actuel" style="flex:1;min-width:200px;padding:10px 12px;background:#1f2937;border:1px solid #374151;border-radius:8px;color:white;font-size:13px;">
            <input type="password" id="new-password" placeholder="Nouveau mot de passe" style="flex:1;min-width:200px;padding:10px 12px;background:#1f2937;border:1px solid #374151;border-radius:8px;color:white;font-size:13px;">
            <button id="change-password-btn" style="padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;background:#4f46e5;color:white;border:none;">Modifier</button>
          </div>
        </div>
      </div>`;

    const pct = storage.total > 0 ? (storage.used / storage.total * 100) : 0;
    const nodes = store.getNodes() || [];
    const storageBody = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:14px;color:#9ca3af;">Utilisé</span>
        <span style="font-weight:600;">${formatBytes(storage.used)} / ${formatBytes(storage.total)}</span>
      </div>
      <div style="height:8px;background:#1f2937;border-radius:4px;overflow:hidden;"><div style="height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:4px;width:${pct}%;transition:width 0.3s;"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:16px;font-size:13px;color:#9ca3af;">
        <span>${nodes.filter(n => n.type === 'file').length} fichiers</span>
        <span>${nodes.filter(n => n.type === 'folder').length} dossiers</span>
      </div>`;

    const apiBody = `<p style="font-size:13px;color:#9ca3af;margin-bottom:12px;">Générez des clés API pour utiliser PixelDrive en ligne de commande.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <input type="text" id="apikey-name" placeholder="Nom de la clé (ex: CLI)" style="flex:1;min-width:200px;padding:10px 12px;background:#1f2937;border:1px solid #374151;border-radius:8px;color:white;font-size:13px;">
        <button id="create-apikey-btn" style="padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;background:#4f46e5;color:white;border:none;">Créer</button>
      </div>
      <div id="apikey-list" style="margin-top:16px;"></div>`;

    const trashBody = `<p style="font-size:13px;color:#9ca3af;margin-bottom:12px;">Les éléments supprimés peuvent être restaurés depuis la corbeille.</p>
      <button id="open-trash-btn" style="padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;background:#374151;color:#e5e7eb;border:none;">Ouvrir la corbeille</button>`;

    const dangerBody = `<p style="font-size:13px;color:#9ca3af;margin-bottom:12px;">Action irréversible. Supprime définitivement votre compte et toutes vos données.</p>
      <button id="danger-delete-btn" style="padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;background:#dc2626;color:white;border:none;">Supprimer mon compte</button>`;

    return `<div style="max-width:800px;margin:0 auto;">
      <h1 style="font-size:28px;font-weight:700;margin-bottom:24px;">Paramètres</h1>
      ${this.section('Apparence', ICON.theme, appearance)}
      ${this.section('Compte', ICON.user, account)}
      ${this.section('Stockage', ICON.storage, storageBody)}
      ${this.section('Clés API', ICON.key, apiBody)}
      ${this.section('Corbeille', ICON.trash, trashBody)}
      ${this.section('Zone de danger', ICON.trash, dangerBody)}
    </div>`;
  }

  bindEvents() {
    this.element.querySelectorAll('.theme-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.theme;
        themeManager.setTheme(t);
        this.element.querySelectorAll('.theme-option').forEach(b => {
          const active = b.dataset.theme === t;
          b.classList.toggle('active', active);
          b.style.borderColor = active ? '#6366f1' : '#374151';
          b.style.background = active ? 'rgba(99,102,241,0.1)' : '#1f2937';
          b.style.color = active ? '#6366f1' : '#e5e7eb';
        });
      });
    });

    const pwBtn = this.element.querySelector('#change-password-btn');
    if (pwBtn) pwBtn.addEventListener('click', async () => {
      const cur = this.element.querySelector('#current-password').value;
      const neu = this.element.querySelector('#new-password').value;
      if (!cur || !neu) return showToast('Remplissez les deux champs', 'error');
      try {
        await authManager.changePassword(cur, neu);
        showToast('Mot de passe modifié', 'success');
        this.element.querySelector('#current-password').value = '';
        this.element.querySelector('#new-password').value = '';
      } catch (e) {
        showToast(e.message || 'Erreur', 'error');
      }
    });

    const createKey = this.element.querySelector('#create-apikey-btn');
    if (createKey) createKey.addEventListener('click', async () => {
      const name = this.element.querySelector('#apikey-name').value.trim();
      if (!name) return showToast('Nom requis', 'error');
      try {
        const res = await apiKeyApi.create(name);
        showToast('Clé créée: ' + res.data.key, 'success', 8000);
        this.loadApiKeys();
      } catch (e) {
        showToast(e.message || 'Erreur', 'error');
      }
    });

    const trashBtn = this.element.querySelector('#open-trash-btn');
    if (trashBtn) trashBtn.addEventListener('click', () => navigate('/trash'));

    const delBtn = this.element.querySelector('#danger-delete-btn');
    if (delBtn) delBtn.addEventListener('click', async () => {
      const ok = await confirm('Supprimer définitivement votre compte ? Cette action est irréversible.');
      if (!ok) return;
      try {
        await authManager.deleteAccount();
        showToast('Compte supprimé', 'success');
        navigate('/login');
      } catch (e) {
        showToast(e.message || 'Erreur', 'error');
      }
    });

    this.loadApiKeys();
  }

  async loadApiKeys() {
    const list = this.element.querySelector('#apikey-list');
    if (!list) return;
    try {
      const res = await apiKeyApi.list();
      const keys = res.data || [];
      if (!keys.length) { list.innerHTML = '<p style="font-size:13px;color:#6b7280;">Aucune clé.</p>'; return; }
      list.innerHTML = keys.map(k => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#1f2937;border-radius:8px;margin-bottom:8px;font-size:13px;">
        <span>${escapeHtml(k.name)} <span style="color:#6b7280;">(${k.prefix}...)</span></span>
        <button data-id="${k.id}" class="del-key" style="background:none;border:none;color:#dc2626;cursor:pointer;">Supprimer</button>
      </div>`).join('');
      list.querySelectorAll('.del-key').forEach(b => b.addEventListener('click', async () => {
        await apiKeyApi.delete(b.dataset.id);
        this.loadApiKeys();
      }));
    } catch {
      list.innerHTML = '';
    }
  }
}