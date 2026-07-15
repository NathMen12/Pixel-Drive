/**
 * Auth Manager - Handles authentication state, login, register, session
 */

import { store } from './store.js';
import { authApi } from './api.js';
import { showToast } from './utils/dom.js';

export const authManager = {
  async init() {
    try {
      const user = await authApi.me();
      if (user) {
        store.setUser(user);
        return true;
      }
    } catch (err) {
      // Not authenticated
    }
    return false;
  },

  async login(username, password) {
    try {
      const response = await authApi.login(username, password);
      if (response.user) {
        store.setUser(response.user);
        // Store password temporarily for encryption (in sessionStorage for security)
        sessionStorage.setItem('pixelDrivePassword', password);
        showToast('Connexion réussie', 'success');
        return true;
      }
    } catch (err) {
      showToast(err.message || 'Identifiants invalides', 'error');
    }
    return false;
  },

  async register(username, password, email, acceptTerms) {
    try {
      const response = await authApi.register(username, password, email, acceptTerms);
      if (response.user) {
        store.setUser(response.user);
        sessionStorage.setItem('pixelDrivePassword', password);
        showToast('Compte créé avec succès', 'success');
        return true;
      }
    } catch (err) {
      showToast(err.message || 'Erreur lors de l\'inscription', 'error');
    }
    return false;
  },

  async logout() {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      sessionStorage.removeItem('pixelDrivePassword');
      store.clearUser();
      showToast('Déconnecté', 'info');
    }
  },

  async changePassword(current, newPassword) {
    try {
      await authApi.changePassword(current, newPassword);
      sessionStorage.setItem('pixelDrivePassword', newPassword);
      showToast('Mot de passe modifié', 'success');
      return true;
    } catch (err) {
      showToast(err.message || 'Erreur', 'error');
      return false;
    }
  },

  async deleteAccount() {
    await authApi.deleteAccount();
    sessionStorage.removeItem('pixelDrivePassword');
    store.clearUser();
  },

  getStoredPassword() {
    return sessionStorage.getItem('pixelDrivePassword') || '';
  },

  isAuthenticated() {
    return !!store.getUser();
  },
};

// Export initAuth function for main.js compatibility
export async function initAuth() {
  return authManager.init();
}
