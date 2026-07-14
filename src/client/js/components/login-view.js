/**
 * Login View Component
 * Login/Register forms with terms checkbox
 */

import { store } from '../store.js';
import { navigate } from '../router.js';
import { authManager } from '../auth.js';
import { showToast, escapeHtml } from '../utils/dom.js';

export class LoginView {
  constructor() {
    this.element = null;
    this.mode = 'login'; // 'login' or 'register'
  }

  render() {
    this.element = document.createElement('main');
    this.element.className = 'login-view';
    this.element.innerHTML = `
      <div class="login-container" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: #0d1117;">
        <div class="login-card" style="width: 100%; max-width: 420px; background: #111827; border: 1px solid #1f2937; border-radius: 20px; padding: 40px; box-shadow: 0 25px 50px rgba(0,0,0,0.5);">
          <!-- Logo -->
          <div style="text-align: center; margin-bottom: 32px;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; color: #6366f1;">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor"/>
              <path d="M9 9h6v6H9z" fill="currentColor"/>
              <path d="M12 9v6M9 12h6" stroke="white" stroke-width="2"/>
            </svg>
            <h1 style="font-size: 28px; font-weight: 700; margin-bottom: 8px;">PixelDrive</h1>
            <p style="color: #9ca3af;">${this.mode === 'login' ? 'Connectez-vous à votre espace' : 'Créez votre compte'}</p>
          </div>

          <!-- Tabs -->
          <div class="auth-tabs" style="display: flex; background: #1f2937; border-radius: 10px; padding: 4px; margin-bottom: 24px;">
            <button data-mode="login" class="auth-tab ${this.mode === 'login' ? 'active' : ''}" style="flex: 1; padding: 10px; border-radius: 8px; border: none; background: ${this.mode === 'login' ? '#111827' : 'transparent'}; color: ${this.mode === 'login' ? 'white' : '#9ca3af'}; font-weight: 500; cursor: pointer; transition: all 0.15s;">Connexion</button>
            <button data-mode="register" class="auth-tab ${this.mode === 'register' ? 'active' : ''}" style="flex: 1; padding: 10px; border-radius: 8px; border: none; background: ${this.mode === 'register' ? '#111827' : 'transparent'}; color: ${this.mode === 'register' ? 'white' : '#9ca3af'}; font-weight: 500; cursor: pointer; transition: all 0.15s;">Inscription</button>
          </div>

          <!-- Login Form -->
          <form id="login-form" class="auth-form" style="${this.mode === 'login' ? '' : 'display: none;'}">
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px;">Nom d'utilisateur</label>
                <input type="text" name="username" id="login-username" autocomplete="username" required class="form-input" style="padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; width: 100%; box-sizing: border-box; outline: none; transition: all 0.2s;">
              </div>
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px;">Mot de passe</label>
                <input type="password" name="password" id="login-password" autocomplete="current-password" required class="form-input" style="padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; width: 100%; box-sizing: border-box; outline: none; transition: all 0.2s;">
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; background: #4f46e5; color: white; border: none; transition: background 0.15s;">Se connecter</button>
            </div>
          </form>

          <!-- Register Form -->
          <form id="register-form" class="auth-form" style="${this.mode === 'register' ? '' : 'display: none;'}">
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px;">Nom d'utilisateur</label>
                <input type="text" name="username" id="register-username" autocomplete="username" required minlength="3" maxlength="30" class="form-input" style="padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; width: 100%; box-sizing: border-box; outline: none; transition: all 0.2s;">
              </div>
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px;">Email (optionnel)</label>
                <input type="email" name="email" id="register-email" autocomplete="email" class="form-input" style="padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; width: 100%; box-sizing: border-box; outline: none; transition: all 0.2s;">
              </div>
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px;">Mot de passe</label>
                <input type="password" name="password" id="register-password" autocomplete="new-password" required minlength="8" class="form-input" style="padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; width: 100%; box-sizing: border-box; outline: none; transition: all 0.2s;">
                <p style="font-size: 11px; color: #6b7280; margin-top: 4px;">Minimum 8 caractères</p>
              </div>
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px;">Confirmer le mot de passe</label>
                <input type="password" name="confirmPassword" id="register-confirm" autocomplete="new-password" required class="form-input" style="padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; width: 100%; box-sizing: border-box; outline: none; transition: all 0.2s;">
              </div>
              <div>
                <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer;">
                  <input type="checkbox" name="acceptTerms" id="accept-terms" required style="width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px; flex-shrink: 0;">
                  <span style="font-size: 13px; color: #d1d5db; line-height: 1.5;">J'accepte les <a href="#/terms" style="color: #6366f1; text-decoration: none;">Conditions d'utilisation</a> et la <a href="#/privacy" style="color: #6366f1; text-decoration: none;">Politique de confidentialité</a> de PixelDrive. Je comprends que mes fichiers sont chiffrés de bout en bout et que <strong>perdre mon mot de passe = perdre mes données</strong>.</span>
                </label>
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; background: #4f46e5; color: white; border: none; transition: background 0.15s;">Créer mon compte</button>
            </div>
          </form>

          <!-- Divider -->
          <div style="display: flex; align-items: center; gap: 16px; margin: 24px 0; color: #6b7280; font-size: 13px;">
            <div style="flex: 1; height: 1px; background: #1f2937;"></div>
            <span>Ou</span>
            <div style="flex: 1; height: 1px; background: #1f2937;"></div>
          </div>

          <!-- Demo / Info -->
          <div style="text-align: center; padding: 16px; background: #1f2937; border-radius: 10px; border: 1px solid #374151;">
            <p style="font-size: 13px; color: #9ca3af; margin-bottom: 8px;">Stockage Zero-Knowledge • Chiffrement AES-GCM • Pixelisation ImgBB</p>
            <p style="font-size: 12px; color: #6b7280;">Vos données, vos clés, votre contrôle.</p>
          </div>
        </div>
      </div>

      <style>
        .form-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
        .form-input::placeholder { color: #6b7280; }
        .auth-tab:hover:not(.active) { background: #374151; color: white; }
        .btn-primary:hover { background: #4338ca; }
        .login-view { background: #0d1117; }
        @media (max-width: 480px) { .login-card { padding: 24px; } }
      </style>
    `;

    this.bindEvents();
    return this.element;
  }

  bindEvents() {
    // Tab switching
    this.element.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchMode(tab.dataset.mode));
    });

    // Login form
    this.element.querySelector('#login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const username = formData.get('username');
      const password = formData.get('password');

      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Connexion...';

      const success = await authManager.login(username, password);
      if (!success) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Se connecter';
      }
    });

    // Register form
    this.element.querySelector('#register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const username = formData.get('username');
      const email = formData.get('email');
      const password = formData.get('password');
      const confirmPassword = formData.get('confirmPassword');
      const acceptTerms = formData.get('acceptTerms');

      if (password !== confirmPassword) {
        showToast('Les mots de passe ne correspondent pas', 'error');
        return;
      }

      if (password.length < 8) {
        showToast('Le mot de passe doit faire au moins 8 caractères', 'error');
        return;
      }

      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Création...';

      const success = await authManager.register(username, password, !!acceptTerms);
      if (!success) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Créer mon compte';
      }
    });

    // Input focus styles
    this.element.querySelectorAll('.form-input').forEach(input => {
      input.addEventListener('focus', () => {
        input.style.borderColor = '#6366f1';
        input.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.15)';
      });
      input.addEventListener('blur', () => {
        input.style.borderColor = '#374151';
        input.style.boxShadow = 'none';
      });
    });
  }

  switchMode(mode) {
    this.mode = mode;
    this.element.querySelectorAll('.auth-tab').forEach(tab => {
      const isActive = tab.dataset.mode === mode;
      tab.classList.toggle('active', isActive);
      tab.style.background = isActive ? '#111827' : 'transparent';
      tab.style.color = isActive ? 'white' : '#9ca3af';
    });
    this.element.querySelector('#login-form').style.display = mode === 'login' ? 'block' : 'none';
    this.element.querySelector('#register-form').style.display = mode === 'register' ? 'block' : 'none';
  }
}